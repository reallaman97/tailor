import { db } from "@/lib/db";
import { getProfileDek } from "@/lib/profile/dek";
import { encryptField, decryptField, decryptOptionalField } from "@/lib/profile/crypto";
import { getProfileNames } from "@/lib/profile/personal-info";
import { getResumeFieldsForResume } from "@/lib/profile/resume-fields";
import { decryptTailoredContent } from "@/lib/tailoring/tailor-resume";
import { buildResumeDocument } from "@/lib/export/build-document";
import { renderResumeDocx } from "@/lib/export/render-docx";
import { createResume, DuplicateApplicationError } from "@/lib/resumes/resumes";
import { buildApplication } from "@/lib/resumes/build";
import { recordUsageEvent } from "@/lib/tailoring/usage";
import { suggestReply } from "@/lib/inbox/classify-llm";
import { testMailbox, sendReply } from "@/lib/inbox/mailbox";
import { getMailboxCredentials } from "@/lib/inbox/process";
import type { EmailCategory, WorkMode } from "@/generated/prisma/client";

// The Inbox page's data: connections per profile, filed emails, and the
// actions on them (reclassify, link, prepare a Word resume, suggest/send a reply).

type Viewer = { id: string; role: string };

// ── Connections ──────────────────────────────────────────────────────────────

export type InboxProfile = {
  id: string;
  name: string;
  mailbox: { email: string; status: string; lastError: string | null; lastCheckedAt: Date | null } | null;
  openAttention: number;
  openReview: number;
};

export async function listInboxProfiles(teamId?: string): Promise<InboxProfile[]> {
  const profiles = await db.profile.findMany({
    where: teamId ? { teamId } : {},
    select: {
      id: true,
      mailbox: { select: { email: true, status: true, lastError: true, lastCheckedAt: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const ids = profiles.map((p) => p.id);
  const [names, attention, review] = await Promise.all([
    getProfileNames(ids),
    db.inboundEmail.groupBy({ by: ["profileId"], where: { profileId: { in: ids }, needsAttention: true, status: "open" }, _count: true }),
    db.inboundEmail.groupBy({ by: ["profileId"], where: { profileId: { in: ids }, needsReview: true, status: "open" }, _count: true }),
  ]);
  const count = (rows: { profileId: string; _count: number }[], id: string) => rows.find((r) => r.profileId === id)?._count ?? 0;
  return profiles.map((p) => ({
    id: p.id,
    name: names.get(p.id) ?? "Untitled profile",
    mailbox: p.mailbox,
    openAttention: count(attention, p.id),
    openReview: count(review, p.id),
  }));
}

export async function connectMailbox(profileId: string, email: string, appPassword: string): Promise<void> {
  const address = email.trim().toLowerCase();
  const password = appPassword.replace(/\s+/g, "");
  await testMailbox({ email: address, appPassword: password });
  const dek = await getProfileDek(profileId);
  const existing = await db.mailboxConnection.findUnique({ where: { profileId }, select: { email: true } });
  const sameMailbox = existing?.email === address;
  await db.mailboxConnection.upsert({
    where: { profileId },
    create: { profileId, email: address, appPasswordEnc: encryptField(dek, password) },
    update: {
      email: address,
      appPasswordEnc: encryptField(dek, password),
      status: "active",
      lastError: null,
      // A different mailbox starts over; a new password for the same one keeps its place.
      ...(sameMailbox ? {} : { uidValidity: null, lastUid: 0 }),
    },
  });
}

export async function disconnectMailbox(profileId: string): Promise<void> {
  await db.mailboxConnection.deleteMany({ where: { profileId } });
}

// ── Lists ────────────────────────────────────────────────────────────────────

export type InboxTab = "attention" | "review" | "updates" | "opportunities" | "filtered" | "all";

export const INBOX_TABS: { value: InboxTab; label: string; hint: string }[] = [
  { value: "attention", label: "Needs attention", hint: "Scheduling, questions, resume requests and remote opportunities waiting on a reply." },
  { value: "review", label: "To review", hint: "Rejections and next steps that couldn't be applied to the tracker automatically." },
  { value: "updates", label: "Tracker updates", hint: "Rejections and next steps that updated the Interview tracker." },
  { value: "opportunities", label: "Remote opportunities", hint: "Recruiters reaching out about remote roles." },
  { value: "filtered", label: "Filtered out", hint: "Hybrid and onsite outreach, confirmations, job alerts and other noise." },
  { value: "all", label: "All mail", hint: "Everything checked for this profile, newest first." },
];

function tabWhere(tab: InboxTab) {
  switch (tab) {
    case "attention":
      return { needsAttention: true, status: "open" };
    case "review":
      return { needsReview: true, status: "open" };
    case "updates":
      return { appliedUpdate: { not: null } };
    case "opportunities":
      return { category: "RECRUITER_OUTREACH" as const, workMode: { in: ["REMOTE", "UNKNOWN"] as WorkMode[] } };
    case "filtered":
      return {
        needsAttention: false,
        needsReview: false,
        appliedUpdate: null,
        OR: [
          { category: { in: ["OTHER", "APPLICATION_RECEIVED"] as EmailCategory[] } },
          { workMode: { in: ["HYBRID", "ONSITE"] as WorkMode[] } },
        ],
      };
    default:
      return {};
  }
}

export type InboxEmailRow = {
  id: string;
  fromName: string | null;
  fromAddress: string;
  subject: string;
  receivedAt: Date;
  category: EmailCategory;
  workMode: WorkMode;
  confidence: number;
  classifiedBy: string;
  companyName: string | null;
  jobTitle: string | null;
  nextStepKind: string | null;
  summary: string | null;
  appliedUpdate: string | null;
  needsAttention: boolean;
  needsReview: boolean;
  status: string;
  replySentAt: Date | null;
  prepareStatus: string | null;
  application: { id: string; companyName: string; jobTitle: string } | null;
};

const PAGE = 100;

export async function listInboxEmails(profileId: string, tab: InboxTab): Promise<{ rows: InboxEmailRow[]; counts: Record<InboxTab, number> }> {
  const [rows, ...countList] = await Promise.all([
    db.inboundEmail.findMany({
      where: { profileId, ...tabWhere(tab) },
      orderBy: { receivedAt: "desc" },
      take: PAGE,
      // Never the body — only what the list shows.
      select: {
        id: true,
        fromName: true,
        fromAddress: true,
        subject: true,
        receivedAt: true,
        category: true,
        workMode: true,
        confidence: true,
        classifiedBy: true,
        companyName: true,
        jobTitle: true,
        nextStepKind: true,
        summaryEnc: true,
        appliedUpdate: true,
        needsAttention: true,
        needsReview: true,
        status: true,
        replySentAt: true,
        prepareStatus: true,
        resume: { select: { id: true, companyName: true, jobTitle: true } },
      },
    }),
    ...INBOX_TABS.map((t) => db.inboundEmail.count({ where: { profileId, ...tabWhere(t.value) } })),
  ]);
  const dek = await getProfileDek(profileId);
  const counts = Object.fromEntries(INBOX_TABS.map((t, i) => [t.value, countList[i]])) as Record<InboxTab, number>;
  return {
    counts,
    rows: rows.map(({ summaryEnc, resume, ...r }) => ({
      ...r,
      summary: decryptOptionalField(dek, summaryEnc),
      application: resume,
    })),
  };
}

// ── One email ────────────────────────────────────────────────────────────────

export type InboxEmailDetail = InboxEmailRow & {
  profileId: string;
  replyTo: string | null;
  body: string | null;
  suggestedReply: string | null;
  preparedResume: { id: string; companyName: string; jobTitle: string } | null;
  prepareError: string | null;
  mailboxEmail: string | null;
};

export async function getInboxEmail(emailId: string): Promise<InboxEmailDetail | null> {
  const e = await db.inboundEmail.findUnique({
    where: { id: emailId },
    include: {
      resume: { select: { id: true, companyName: true, jobTitle: true } },
      preparedResume: { select: { id: true, companyName: true, jobTitle: true } },
      profile: { select: { mailbox: { select: { email: true } } } },
    },
  });
  if (!e) return null;
  const dek = await getProfileDek(e.profileId);
  return {
    id: e.id,
    profileId: e.profileId,
    fromName: e.fromName,
    fromAddress: e.fromAddress,
    replyTo: e.replyTo,
    subject: e.subject,
    receivedAt: e.receivedAt,
    category: e.category,
    workMode: e.workMode,
    confidence: e.confidence,
    classifiedBy: e.classifiedBy,
    companyName: e.companyName,
    jobTitle: e.jobTitle,
    nextStepKind: e.nextStepKind,
    summary: decryptOptionalField(dek, e.summaryEnc),
    body: decryptOptionalField(dek, e.bodyEnc),
    appliedUpdate: e.appliedUpdate,
    needsAttention: e.needsAttention,
    needsReview: e.needsReview,
    status: e.status,
    replySentAt: e.replySentAt,
    suggestedReply: decryptOptionalField(dek, e.suggestedReplyEnc),
    prepareStatus: e.prepareStatus,
    prepareError: e.prepareError,
    application: e.resume,
    preparedResume: e.preparedResume,
    mailboxEmail: e.profile.mailbox?.email ?? null,
  };
}

/** A person's correction: what the email is, whether it needs a reply, which application it's about. */
export async function updateInboxEmail(
  emailId: string,
  patch: { category?: EmailCategory; workMode?: WorkMode; resumeId?: string | null; status?: "open" | "done" | "dismissed"; needsAttention?: boolean }
): Promise<void> {
  const data: Record<string, unknown> = { ...patch };
  if (patch.category) {
    data.classifiedBy = "manual";
    data.confidence = 1;
    data.needsReview = false;
  }
  if (patch.resumeId !== undefined) data.needsReview = false;
  if (patch.status && patch.status !== "open") data.needsReview = false;
  if (patch.category === "RESUME_REQUEST") data.needsAttention = true;
  await db.inboundEmail.update({ where: { id: emailId }, data });
}

// ── Resume requests ──────────────────────────────────────────────────────────

/**
 * Gets a tailored resume ready to attach for a resume request — only when
 * someone clicks "Prepare resume", since a new build spends tokens: the matched
 * application's, or — for a role not applied to yet — a new application built
 * from the email (it's the job description the recruiter sent), tailored with
 * the usual resume prompt. Takes as long as a normal build (1–2 minutes).
 */
export async function prepareResumeForEmail(viewer: Viewer, emailId: string): Promise<{ ok: boolean; error?: string }> {
  const email = await db.inboundEmail.findUnique({
    where: { id: emailId },
    select: {
      profileId: true,
      companyName: true,
      jobTitle: true,
      subject: true,
      fromAddress: true,
      bodyEnc: true,
      resume: { select: { id: true, tailoredContentEnc: true } },
    },
  });
  if (!email) return { ok: false, error: "This email no longer exists." };

  const fail = async (error: string) => {
    await db.inboundEmail.update({ where: { id: emailId }, data: { prepareStatus: "failed", prepareError: error } });
    return { ok: false, error };
  };

  if (email.resume?.tailoredContentEnc) {
    await db.inboundEmail.update({
      where: { id: emailId },
      data: { preparedResumeId: email.resume.id, prepareStatus: "ready", prepareError: null },
    });
    return { ok: true };
  }

  const owner = await db.user.findFirst({ where: { profileId: email.profileId }, orderBy: { email: "asc" }, select: { id: true } });
  if (!owner) return fail("This profile has no assigned account to build the resume for.");
  const dek = await getProfileDek(email.profileId);
  const body = email.bodyEnc ? decryptField(dek, email.bodyEnc) : "";
  const jobDescription = `${email.subject}\n\n${body}`.trim().slice(0, 20_000);
  if (jobDescription.length < 20) return fail("The email has too little text to tailor a resume from.");

  // Claim the job, so a second page (or a reload) doesn't build it twice. A
  // claim older than 10 minutes is a build that died — it can be retaken.
  const staleClaim = `building:${new Date(Date.now() - 10 * 60_000).toISOString()}`;
  const claimed = await db.inboundEmail.updateMany({
    where: {
      id: emailId,
      OR: [
        { prepareStatus: null },
        { prepareStatus: "failed" },
        { AND: [{ prepareStatus: { startsWith: "building:" } }, { prepareStatus: { lt: staleClaim } }] },
      ],
    },
    data: { prepareStatus: `building:${new Date().toISOString()}`, prepareError: null },
  });
  if (claimed.count === 0) return { ok: false, error: "Already being prepared." };
  let resumeId: string;
  try {
    resumeId = await createResume(owner.id, {
      companyName: (email.companyName || email.fromAddress.split("@")[1]?.split(".")[0] || "Recruiter role").slice(0, 200),
      jobTitle: (email.jobTitle || email.subject || "Role").slice(0, 200),
      jobDescription,
      roleTrack: "OTHER",
      source: "RECRUITER",
      status: "APPLIED",
    });
  } catch (err) {
    if (!(err instanceof DuplicateApplicationError)) return fail(err instanceof Error ? err.message : "Couldn't create the application.");
    resumeId = err.existing.id; // already applied there — use that application's resume
  }

  const built = await buildApplication(viewer, resumeId);
  if (!built.ok) return fail(built.error);
  await db.inboundEmail.update({
    where: { id: emailId },
    data: { preparedResumeId: resumeId, resumeId, prepareStatus: "ready", prepareError: null },
  });
  return { ok: true };
}

/** The application's tailored resume as a Word file. */
export async function renderApplicationDocx(resumeId: string): Promise<{ filename: string; content: Buffer } | null> {
  const r = await db.resume.findUnique({
    where: { id: resumeId },
    select: { userId: true, profileId: true, companyName: true, tailoredContentEnc: true },
  });
  if (!r?.tailoredContentEnc) return null;
  const fields = await getResumeFieldsForResume(r.userId, r.profileId);
  if (!fields) return null;
  const tailored = await decryptTailoredContent(r.profileId, r.tailoredContentEnc);
  const content = await renderResumeDocx(buildResumeDocument(fields, tailored));
  const safe = (v: string) => v.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "Resume";
  return { filename: `${safe(fields.fullName)}-Resume.docx`, content };
}

// ── Replies ──────────────────────────────────────────────────────────────────

/** Writes a suggested reply — only on request ("Suggest a reply"), since it spends tokens. */
export async function suggestReplyForEmail(viewer: { id: string }, emailId: string): Promise<string> {
  const e = await getInboxEmail(emailId);
  if (!e) throw new Error("This email no longer exists.");
  const candidateName = (await getProfileNames([e.profileId])).get(e.profileId) ?? "the candidate";
  const { reply, usage } = await suggestReply({
    candidateName,
    email: { fromName: e.fromName, fromAddress: e.fromAddress, subject: e.subject, text: e.body ?? e.summary ?? "" },
    application: e.application,
    attachingResume: e.category === "RESUME_REQUEST",
  });
  await recordUsageEvent({ userId: viewer.id, kind: "inbox", ...usage }).catch(() => {});
  const dek = await getProfileDek(e.profileId);
  await db.inboundEmail.update({ where: { id: emailId }, data: { suggestedReplyEnc: encryptField(dek, reply) } });
  return reply;
}

export class ReplyError extends Error {}

/** Sends the (edited) reply from the profile's Gmail, attaching the Word resume when asked. */
export async function sendEmailReply(emailId: string, text: string, attachResume: boolean): Promise<void> {
  const body = text.trim();
  if (body.length < 2) throw new ReplyError("Write the reply first.");
  const e = await db.inboundEmail.findUnique({
    where: { id: emailId },
    select: { profileId: true, messageId: true, references: true, fromAddress: true, replyTo: true, subject: true, preparedResumeId: true },
  });
  if (!e) throw new ReplyError("This email no longer exists.");

  let attachment: { filename: string; content: Buffer } | null = null;
  if (attachResume) {
    if (!e.preparedResumeId) throw new ReplyError("The resume isn't ready yet — prepare it first.");
    attachment = await renderApplicationDocx(e.preparedResumeId);
    if (!attachment) throw new ReplyError("Couldn't build the Word resume for this application.");
  }

  const creds = await getMailboxCredentials(e.profileId);
  const fromName = (await getProfileNames([e.profileId])).get(e.profileId) ?? creds.email;
  await sendReply(creds, {
    fromName,
    to: e.replyTo ?? e.fromAddress,
    subject: e.subject,
    inReplyTo: e.messageId,
    references: e.references,
    text: body,
    attachment,
  });
  const dek = await getProfileDek(e.profileId);
  await db.inboundEmail.update({
    where: { id: emailId },
    data: { replySentAt: new Date(), status: "done", needsReview: false, suggestedReplyEnc: encryptField(dek, body) },
  });
}
