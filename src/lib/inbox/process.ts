import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { getProfileDek } from "@/lib/profile/dek";
import { encryptField, decryptField } from "@/lib/profile/crypto";
import { STATUS_LABEL } from "@/lib/resume-status";
import { recordUsageEvent } from "@/lib/tailoring/usage";
import { setTrackerStage } from "@/lib/interview-tracker/tracker";
import { classifyByRules, AUTO_UPDATE_CONFIDENCE, RESUME_REQUEST, type Classification } from "@/lib/inbox/classify-rules";
import { classifyWithLlm } from "@/lib/inbox/classify-llm";
import { companyCandidates, matchApplication, nextStageFor } from "@/lib/inbox/match";
import { CATEGORY_LABEL } from "@/lib/inbox/labels";
import { fetchNewEmails, MailboxAuthError, type FetchedEmail, type MailCredentials } from "@/lib/inbox/mailbox";

// "Check now" for one profile's inbox: fetch new mail, classify it (rules,
// then the LLM for what rules can't decide), find the application it's about,
// update the Interview tracker when confident, and file it for the inbox page.

/** Emails processed per request — each may take an LLM call; the page keeps calling until done. */
export const CHECK_BATCH = 12;
/** Body text kept per email (encrypted) — enough to read and to write a reply from. */
const MAX_BODY_CHARS = 8000;



export class MailboxNotConnectedError extends Error {
  constructor() {
    super("Connect this profile's Gmail first.");
  }
}

export async function getMailboxCredentials(profileId: string): Promise<MailCredentials & { position: { uidValidity: string | null; lastUid: number } }> {
  const conn = await db.mailboxConnection.findUnique({ where: { profileId } });
  if (!conn) throw new MailboxNotConnectedError();
  const dek = await getProfileDek(profileId);
  return {
    email: conn.email,
    appPassword: decryptField(dek, conn.appPasswordEnc),
    position: { uidValidity: conn.uidValidity, lastUid: conn.lastUid },
  };
}

export type CheckResult = { processed: number; remaining: number; updates: number; attention: number };

export async function checkMailbox(profileId: string, actingUserId: string): Promise<CheckResult> {
  const creds = await getMailboxCredentials(profileId);
  let fetched;
  try {
    fetched = await fetchNewEmails(creds, creds.position, CHECK_BATCH);
  } catch (err) {
    await db.mailboxConnection.update({
      where: { profileId },
      data: { status: "error", lastError: err instanceof Error ? err.message : "Couldn't read the mailbox" },
    });
    throw err instanceof MailboxAuthError ? err : new Error(err instanceof Error ? err.message : "Couldn't read the mailbox");
  }

  const dek = await getProfileDek(profileId);
  const known = new Set(
    (
      await db.inboundEmail.findMany({
        where: { profileId, messageId: { in: fetched.emails.map((e) => e.messageId) } },
        select: { messageId: true },
      })
    ).map((e) => e.messageId)
  );

  let updates = 0;
  let attention = 0;
  for (const email of fetched.emails) {
    if (known.has(email.messageId) || email.fromAddress === creds.email.toLowerCase()) continue;
    const result = await processEmail(profileId, actingUserId, dek, email);
    if (result.updated) updates++;
    if (result.attention) attention++;
  }

  await db.mailboxConnection.update({
    where: { profileId },
    data: {
      uidValidity: fetched.uidValidity,
      lastUid: fetched.lastUid,
      lastCheckedAt: new Date(),
      status: "active",
      lastError: null,
    },
  });
  return { processed: fetched.emails.length, remaining: fetched.remaining, updates, attention };
}

/**
 * Outreach or a conversation that asks for a resume is a resume request first —
 * that's what needs doing. The LLM is told so, but the wording is distinctive
 * enough to make sure.
 */
function promoteResumeRequest(c: Classification, email: FetchedEmail): Classification {
  if ((c.category === "RECRUITER_OUTREACH" || c.category === "CONVERSATION") && RESUME_REQUEST.test(`${email.subject}
${email.text.slice(0, 4000)}`)) {
    return { ...c, category: "RESUME_REQUEST", needsReply: true };
  }
  return c;
}

async function classify(email: FetchedEmail, actingUserId: string): Promise<Classification & { classifiedBy: string }> {
  const input = { fromAddress: email.fromAddress, fromName: email.fromName, subject: email.subject, text: email.text };
  const byRules = classifyByRules(input);
  if (byRules) return { ...byRules, classifiedBy: "rules" };
  try {
    const { classification, usage } = await classifyWithLlm(input);
    await recordUsageEvent({ userId: actingUserId, kind: "inbox", ...usage }).catch(() => {});
    return { ...promoteResumeRequest(classification, email), classifiedBy: "llm" };
  } catch {
    // The AI is unavailable — keep the email for a person to look at.
    return {
      category: "OTHER",
      workMode: "UNKNOWN",
      confidence: 0,
      nextStepKind: null,
      needsReply: false,
      companyName: null,
      jobTitle: null,
      summary: "Couldn't classify automatically — please review.",
      classifiedBy: "rules",
    };
  }
}

/** Files one fetched email (exported for tests). */
export async function processEmail(
  profileId: string,
  actingUserId: string,
  dek: Buffer,
  email: FetchedEmail
): Promise<{ updated: boolean; attention: boolean }> {
  const c = await classify(email, actingUserId);
  const confident = c.confidence >= AUTO_UPDATE_CONFIDENCE;

  const linkable = c.category !== "OTHER" && c.category !== "RECRUITER_OUTREACH";
  const application = linkable
    ? await matchApplication(profileId, companyCandidates({ companyName: c.companyName, fromName: email.fromName, fromAddress: email.fromAddress }))
    : null;

  // Tracker update: confident rejections and next steps on a matched application.
  let appliedUpdate: string | null = null;
  if (application && confident && (c.category === "REJECTION" || c.category === "NEXT_STEP")) {
    const stage = nextStageFor(application.statuses, c.category, c.nextStepKind);
    if (stage) {
      await setTrackerStage(application.id, stage);
      appliedUpdate = `Stage → ${STATUS_LABEL[stage]}`;
    }
  }
  // Keep the application's interview history in step: a note per meaningful email.
  if (application && confident && c.category !== "APPLICATION_RECEIVED") {
    await db.applicationNote.create({
      data: {
        resumeId: application.id,
        authorId: null,
        stage: null,
        body: `Email — ${CATEGORY_LABEL[c.category]}: ${c.summary}\nFrom ${email.fromName ? `${email.fromName} <${email.fromAddress}>` : email.fromAddress} · “${email.subject}”${appliedUpdate ? `\n${appliedUpdate}` : ""}`,
      },
    });
  }

  const remoteish = c.workMode === "REMOTE" || c.workMode === "UNKNOWN";
  const needsAttention =
    (c.category === "NEXT_STEP" && c.needsReply) ||
    c.category === "CONVERSATION" ||
    ((c.category === "RESUME_REQUEST" || c.category === "RECRUITER_OUTREACH") && remoteish);
  // A person decides when the tracker couldn't be updated safely: unsure what
  // it is, or no application found for it.
  const needsReview =
    c.confidence === 0 || ((c.category === "REJECTION" || c.category === "NEXT_STEP") && (!confident || !application));

  const keepBody = c.category !== "OTHER" && c.category !== "APPLICATION_RECEIVED";
  try {
    await db.inboundEmail.create({
      data: {
        profileId,
        messageId: email.messageId,
        references: email.references,
        fromAddress: email.fromAddress,
        fromName: email.fromName,
        replyTo: email.replyTo,
        subject: email.subject,
        receivedAt: email.receivedAt,
        bodyEnc: keepBody || c.confidence === 0 ? encryptField(dek, email.text.slice(0, MAX_BODY_CHARS)) : null,
        category: c.category,
        workMode: c.workMode,
        confidence: c.confidence,
        classifiedBy: c.classifiedBy,
        companyName: c.companyName ?? application?.companyName ?? null,
        jobTitle: c.jobTitle ?? application?.jobTitle ?? null,
        nextStepKind: c.nextStepKind,
        summaryEnc: encryptField(dek, c.summary),
        resumeId: application?.id ?? null,
        appliedUpdate,
        needsAttention,
        needsReview,
        prepareStatus: c.category === "RESUME_REQUEST" && remoteish ? "pending" : null,
      },
    });
  } catch (err) {
    // Another check got to it first.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return { updated: false, attention: false };
    throw err;
  }
  return { updated: appliedUpdate !== null, attention: needsAttention };
}
