import { db } from "@/lib/db";
import { hasTeamAdminPower } from "@/lib/auth/roles";
import { scopeFilter, ResumeNotFoundError } from "@/lib/resumes/resumes";
import { getResumeFieldsForResume } from "@/lib/profile/resume-fields";
import { getProfileDek } from "@/lib/profile/dek";
import { encryptField, decryptField } from "@/lib/profile/crypto";
import { decryptTailoredContent } from "@/lib/tailoring/tailor-resume";
import { buildResumeDocument } from "@/lib/export/build-document";
import { resumeToText } from "@/lib/assist/resume-text";
import type { AssistContext } from "@/lib/assist/generate";
import type { AnswerLength } from "@/lib/assist/prompts";

export class AssistUnavailableError extends Error {
  constructor() {
    super("Generate the tailored resume for this application first — cover letters and answers are written from it.");
  }
}

/** The signed-in user, with their role freshly read from the database (requireResumePlatformAccess). */
type Viewer = { id: string; role: string };

/**
 * The application, if this viewer may open it — the same rule as its detail
 * page: team admins can open any application; everyone else only those in
 * their profile scope.
 */
async function findApplication(viewer: Viewer, resumeId: string) {
  const where = hasTeamAdminPower(viewer.role)
    ? { id: resumeId }
    : { id: resumeId, ...(await scopeFilter(viewer.id)) };
  return db.resume.findFirst({
    where,
    select: {
      id: true,
      userId: true,
      profileId: true,
      companyName: true,
      jobTitle: true,
      jobDescription: true,
      tailoredContentEnc: true,
    },
  });
}

export type LoadedAssist = { resumeId: string; profileId: string; ctx: AssistContext };

/** Everything the assistant needs for one application. Throws if it's not accessible or has no tailored resume. */
export async function loadAssistContext(viewer: Viewer, resumeId: string): Promise<LoadedAssist> {
  const resume = await findApplication(viewer, resumeId);
  if (!resume) throw new ResumeNotFoundError();
  if (!resume.profileId || !resume.tailoredContentEnc) throw new AssistUnavailableError();

  const [fields, tailored] = await Promise.all([
    getResumeFieldsForResume(resume.userId, resume.profileId),
    decryptTailoredContent(resume.profileId, resume.tailoredContentEnc),
  ]);
  if (!fields || !tailored) throw new AssistUnavailableError();

  return {
    resumeId: resume.id,
    profileId: resume.profileId,
    ctx: {
      resumeText: resumeToText(buildResumeDocument(fields, tailored)),
      companyName: resume.companyName,
      jobTitle: resume.jobTitle,
      jobDescription: resume.jobDescription,
    },
  };
}

export async function saveCoverLetter(loaded: LoadedAssist, coverLetter: string): Promise<Date> {
  const dek = await getProfileDek(loaded.profileId);
  const generatedAt = new Date();
  await db.resume.update({
    where: { id: loaded.resumeId },
    data: { coverLetterEnc: encryptField(dek, coverLetter), coverLetterGeneratedAt: generatedAt },
  });
  return generatedAt;
}

export type SavedAnswer = {
  id: string;
  question: string;
  answer: string;
  length: AnswerLength;
  charLimit: number | null;
  needsReview: boolean;
  reviewNote: string | null;
  createdAt: string;
};

export async function addAnswer(
  loaded: LoadedAssist,
  input: {
    question: string;
    answer: string;
    length: AnswerLength;
    charLimit: number | null;
    needsReview: boolean;
    reviewNote: string;
    createdById: string;
  }
): Promise<SavedAnswer> {
  const dek = await getProfileDek(loaded.profileId);
  const row = await db.applicationAnswer.create({
    data: {
      resumeId: loaded.resumeId,
      questionEnc: encryptField(dek, input.question),
      answerEnc: encryptField(dek, input.answer),
      length: input.length,
      charLimit: input.charLimit,
      needsReview: input.needsReview,
      reviewNote: input.reviewNote || null,
      createdById: input.createdById,
    },
  });
  return {
    id: row.id,
    question: input.question,
    answer: input.answer,
    length: input.length,
    charLimit: row.charLimit,
    needsReview: row.needsReview,
    reviewNote: row.reviewNote,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Case-, spacing- and punctuation-insensitive form of a question, for spotting repeats. */
function questionKey(question: string): string {
  return question.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * An answer already saved on this application for the same question (same
 * wording ignoring case/punctuation, same length and character limit) — so
 * asking again reuses it instead of paying for another AI call.
 */
export async function findSavedAnswer(
  loaded: LoadedAssist,
  question: string,
  length: AnswerLength,
  charLimit: number | null
): Promise<SavedAnswer | null> {
  const rows = await db.applicationAnswer.findMany({
    where: { resumeId: loaded.resumeId, length, charLimit },
    orderBy: { createdAt: "desc" },
  });
  if (rows.length === 0) return null;
  const dek = await getProfileDek(loaded.profileId);
  const key = questionKey(question);
  const hit = rows.find((r) => questionKey(decryptField(dek, r.questionEnc)) === key);
  if (!hit) return null;
  return {
    id: hit.id,
    question: decryptField(dek, hit.questionEnc),
    answer: decryptField(dek, hit.answerEnc),
    length: hit.length as AnswerLength,
    charLimit: hit.charLimit,
    needsReview: hit.needsReview,
    reviewNote: hit.reviewNote,
    createdAt: hit.createdAt.toISOString(),
  };
}

export async function deleteAnswer(viewer: Viewer, resumeId: string, answerId: string): Promise<void> {
  if (!(await findApplication(viewer, resumeId))) throw new ResumeNotFoundError();
  await db.applicationAnswer.deleteMany({ where: { id: answerId, resumeId } });
}

export type AssistData = {
  coverLetter: { text: string; generatedAt: string } | null;
  answers: SavedAnswer[];
};

/**
 * The saved cover letter and answers for the detail page. The caller must have
 * already authorized the viewer for this application (the page does).
 */
export async function getAssistData(resumeId: string, profileId: string | null): Promise<AssistData> {
  if (!profileId) return { coverLetter: null, answers: [] };
  const [resume, answers, dek] = await Promise.all([
    db.resume.findUnique({ where: { id: resumeId }, select: { coverLetterEnc: true, coverLetterGeneratedAt: true } }),
    db.applicationAnswer.findMany({ where: { resumeId }, orderBy: { createdAt: "desc" } }),
    getProfileDek(profileId),
  ]);
  return {
    coverLetter:
      resume?.coverLetterEnc && resume.coverLetterGeneratedAt
        ? { text: decryptField(dek, resume.coverLetterEnc), generatedAt: resume.coverLetterGeneratedAt.toISOString() }
        : null,
    answers: answers.map((a) => ({
      id: a.id,
      question: decryptField(dek, a.questionEnc),
      answer: decryptField(dek, a.answerEnc),
      length: a.length as AnswerLength,
      charLimit: a.charLimit,
      needsReview: a.needsReview,
      reviewNote: a.reviewNote,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}
