import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { unwrapDek } from "@/lib/crypto/envelope";
import { decryptField } from "@/lib/profile/crypto";
import { readMetaValues, type MetaValues } from "@/lib/interview/fields";
import { getProfileNames } from "@/lib/profile/personal-info";
import { hasTeamAdminPower } from "@/lib/auth/roles";
import { getResumeFieldsForResume } from "@/lib/profile/resume-fields";
import { decryptTailoredContent } from "@/lib/tailoring/tailor-resume";
import { buildResumeDocument } from "@/lib/export/build-document";
import { renderResumePdf } from "@/lib/export/render-pdf";
import { effectiveStyleKey } from "@/lib/export/styles";
import { getProfileTemplate } from "@/lib/profile/template";
import { getSettings } from "@/lib/settings";
import type { UserRole } from "@/generated/prisma/client";

// ── Errors ─────────────────────────────────────────────

export class InterviewNotFoundError extends Error {
  constructor() {
    super("Interview not found");
  }
}

export class InvalidCallerError extends Error {
  constructor() {
    super("That user can't be assigned — a caller account is required");
  }
}

export class InvalidFileError extends Error {}

// ── Access / scope ─────────────────────────────────────

export type InterviewAccess = { id: string; role: UserRole };

/** Managers and Super Admins operate on every interview; Callers only their own. */
export function canManageInterviews(role: UserRole): boolean {
  return hasTeamAdminPower(role) || role === "MANAGER";
}

/**
 * The row-level scope for a caller. Managers/Super Admins see everything (minus
 * soft-deleted); a Caller is hard-restricted to interviews assigned to them,
 * enforced in SQL — the boundary is here, not the UI.
 */
function scopeWhere(access: InterviewAccess): { deletedAt: null; callerId?: string } {
  const base = { deletedAt: null as null };
  return canManageInterviews(access.role) ? base : { ...base, callerId: access.id };
}

function emptyToNull(value: string | undefined | null): string | null {
  return value && value.trim() !== "" ? value.trim() : null;
}

// ── View types ─────────────────────────────────────────

export type InterviewSummary = {
  id: string;
  jobTitle: string;
  companyName: string;
  scheduledAt: Date | null;
  stage: { id: string; label: string } | null;
  status: { id: string; label: string; color: string } | null;
  caller: { id: string; name: string } | null;
  /** The candidate profile this interview is for (name decrypted). */
  profile: { id: string; name: string } | null;
  createdAt: Date;
  updatedAt: Date;
};

export type InterviewCommentView = {
  id: string;
  body: string;
  authorName: string;
  createdAt: Date;
};

export type InterviewFileView = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: Date;
};

export type InterviewDetail = InterviewSummary & {
  jobDescription: string;
  jobPostLink: string | null;
  salaryRange: string | null;
  meetingLink: string | null;
  meetingType: { id: string; label: string } | null;
  interviewerInfo: string | null;
  applicationId: string | null;
  profileId: string | null;
  hasResumeFile: boolean;
  resumeFilename: string | null;
  meta: MetaValues;
  createdByName: string;
  referenceFiles: InterviewFileView[];
  comments: InterviewCommentView[];
};

const SUMMARY_SELECT = {
  id: true,
  jobTitle: true,
  companyName: true,
  scheduledAt: true,
  createdAt: true,
  updatedAt: true,
  profileId: true,
  stage: { select: { id: true, label: true } },
  status: { select: { id: true, label: true, color: true } },
  caller: { select: { id: true, username: true } },
} as const;

type SummaryRow = {
  id: string;
  jobTitle: string;
  companyName: string;
  scheduledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  profileId: string | null;
  stage: { id: string; label: string } | null;
  status: { id: string; label: string; color: string } | null;
  caller: { id: string; username: string } | null;
};

/** Maps a row to a summary. `profileNames` resolves the (encrypted) profile name; missing → "Unnamed profile". */
function toSummary(row: SummaryRow, profileNames?: Map<string, string>): InterviewSummary {
  return {
    id: row.id,
    jobTitle: row.jobTitle,
    companyName: row.companyName,
    scheduledAt: row.scheduledAt,
    stage: row.stage,
    status: row.status,
    caller: row.caller ? { id: row.caller.id, name: row.caller.username } : null,
    profile: row.profileId
      ? { id: row.profileId, name: profileNames?.get(row.profileId) ?? "Unnamed profile" }
      : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ── Write input ────────────────────────────────────────

export type InterviewWriteInput = {
  jobTitle: string;
  companyName: string;
  jobDescription?: string;
  jobPostLink?: string;
  salaryRange?: string;
  scheduledAt: Date | null;
  meetingLink?: string;
  interviewerInfo?: string;
  stageId?: string;
  statusId?: string;
  meetingTypeId?: string;
  callerId?: string;
  meta: Record<string, string | number>;
};

export type CreateInterviewInput = InterviewWriteInput & { applicationId?: string; profileId?: string };

function writeData(input: InterviewWriteInput) {
  return {
    jobTitle: input.jobTitle.trim(),
    companyName: input.companyName.trim(),
    jobDescription: input.jobDescription?.trim() ?? "",
    jobPostLink: emptyToNull(input.jobPostLink),
    salaryRange: emptyToNull(input.salaryRange),
    scheduledAt: input.scheduledAt,
    meetingLink: emptyToNull(input.meetingLink),
    interviewerInfo: emptyToNull(input.interviewerInfo),
    stageId: emptyToNull(input.stageId),
    statusId: emptyToNull(input.statusId),
    meetingTypeId: emptyToNull(input.meetingTypeId),
    meta: input.meta,
  };
}

// ── Create ─────────────────────────────────────────────

export async function createInterview(createdById: string, input: CreateInterviewInput): Promise<string> {
  const callerId = emptyToNull(input.callerId);
  if (callerId) await assertCallerValid(callerId);

  // Use the explicitly-chosen profile if provided; otherwise fall back to the
  // linked application's profile so the (login-gated) Profile view and any
  // attached resume stay anchored to the same candidate record.
  let profileId: string | null = emptyToNull(input.profileId);
  if (profileId) {
    const exists = await db.profile.findUnique({ where: { id: profileId }, select: { id: true } });
    if (!exists) profileId = null;
  } else if (input.applicationId) {
    const application = await db.resume.findUnique({
      where: { id: input.applicationId },
      select: { profileId: true },
    });
    profileId = application?.profileId ?? null;
  }

  const interview = await db.interview.create({
    data: {
      ...writeData(input),
      createdById,
      callerId,
      applicationId: input.applicationId ?? null,
      profileId,
    },
    select: { id: true },
  });

  // Best-effort: attach the application's tailored resume as a downloadable PDF.
  // Never let a render failure block interview creation.
  if (input.applicationId) {
    try {
      const resume = await buildApplicationResumePdf(input.applicationId);
      if (resume) {
        await db.interview.update({
          where: { id: interview.id },
          data: {
            resumeData: new Uint8Array(resume.data),
            resumeMimeType: "application/pdf",
            resumeFilename: resume.filename,
          },
        });
      }
    } catch {
      // leave the resume file unset; a manager can upload one manually
    }
  }

  return interview.id;
}

// ── Read ───────────────────────────────────────────────

export type ListInterviewsFilter = {
  callerId?: string;
  statusId?: string;
  stageId?: string;
  company?: string;
  from?: Date;
  to?: Date;
};

export async function listInterviews(
  access: InterviewAccess,
  filter: ListInterviewsFilter = {}
): Promise<InterviewSummary[]> {
  const scheduledAt =
    filter.from || filter.to
      ? { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) }
      : undefined;

  const rows = await db.interview.findMany({
    where: {
      ...scopeWhere(access),
      ...(filter.callerId ? { callerId: filter.callerId } : {}),
      ...(filter.statusId ? { statusId: filter.statusId } : {}),
      ...(filter.stageId ? { stageId: filter.stageId } : {}),
      ...(filter.company ? { companyName: { contains: filter.company, mode: "insensitive" } } : {}),
      ...(scheduledAt ? { scheduledAt } : {}),
    },
    orderBy: [{ scheduledAt: "desc" }, { createdAt: "desc" }],
    select: SUMMARY_SELECT,
  });
  const profileNames = await getProfileNames(
    [...new Set(rows.map((r) => r.profileId).filter((id): id is string => id !== null))]
  );
  return rows.map((r) => toSummary(r, profileNames));
}

/** All (non-deleted) interviews linked to an application. Used from the Applications tracker (superadmin). */
export async function listInterviewsForApplication(applicationId: string): Promise<InterviewSummary[]> {
  const rows = await db.interview.findMany({
    where: { applicationId, deletedAt: null },
    orderBy: [{ scheduledAt: "desc" }, { createdAt: "desc" }],
    select: SUMMARY_SELECT,
  });
  const profileNames = await getProfileNames(
    [...new Set(rows.map((r) => r.profileId).filter((id): id is string => id !== null))]
  );
  return rows.map((r) => toSummary(r, profileNames));
}

export async function getInterview(access: InterviewAccess, id: string): Promise<InterviewDetail | null> {
  const row = await db.interview.findFirst({
    where: { id, ...scopeWhere(access) },
    select: {
      ...SUMMARY_SELECT,
      jobDescription: true,
      jobPostLink: true,
      salaryRange: true,
      meetingLink: true,
      interviewerInfo: true,
      applicationId: true,
      profileId: true,
      resumeData: true,
      resumeFilename: true,
      meta: true,
      meetingType: { select: { id: true, label: true } },
      createdBy: { select: { username: true } },
      referenceFiles: {
        orderBy: { createdAt: "asc" },
        select: { id: true, filename: true, mimeType: true, size: true, createdAt: true },
      },
      comments: {
        orderBy: { createdAt: "asc" },
        select: { id: true, body: true, createdAt: true, author: { select: { username: true } } },
      },
    },
  });
  if (!row) return null;

  const profileNames = row.profileId ? await getProfileNames([row.profileId]) : undefined;

  return {
    ...toSummary(row, profileNames),
    jobDescription: row.jobDescription,
    jobPostLink: row.jobPostLink,
    salaryRange: row.salaryRange,
    meetingLink: row.meetingLink,
    meetingType: row.meetingType,
    interviewerInfo: row.interviewerInfo,
    applicationId: row.applicationId,
    profileId: row.profileId,
    hasResumeFile: row.resumeData !== null,
    resumeFilename: row.resumeFilename,
    meta: readMetaValues(row.meta),
    createdByName: row.createdBy.username,
    referenceFiles: row.referenceFiles,
    comments: row.comments.map((c) => ({
      id: c.id,
      body: c.body,
      authorName: c.author?.username ?? "Unknown",
      createdAt: c.createdAt,
    })),
  };
}

// ── Update / delete (manager) ──────────────────────────

export async function updateInterview(id: string, input: InterviewWriteInput): Promise<void> {
  const callerId = emptyToNull(input.callerId);
  if (callerId) await assertCallerValid(callerId);

  const result = await db.interview.updateMany({
    where: { id, deletedAt: null },
    data: { ...writeData(input), callerId },
  });
  if (result.count === 0) throw new InterviewNotFoundError();
}

export async function softDeleteInterview(id: string): Promise<void> {
  const result = await db.interview.updateMany({
    where: { id, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (result.count === 0) throw new InterviewNotFoundError();
}

/**
 * Creates a new interview copying another's editable fields (core fields, config
 * FKs, caller, application/profile links, and meta). Comments, reference files,
 * and the attached resume are NOT copied — a duplicate starts a fresh record.
 */
export async function duplicateInterview(createdById: string, id: string): Promise<string> {
  const src = await db.interview.findFirst({
    where: { id, deletedAt: null },
    select: {
      jobTitle: true,
      companyName: true,
      jobDescription: true,
      jobPostLink: true,
      salaryRange: true,
      scheduledAt: true,
      meetingLink: true,
      interviewerInfo: true,
      stageId: true,
      statusId: true,
      meetingTypeId: true,
      callerId: true,
      applicationId: true,
      profileId: true,
      meta: true,
    },
  });
  if (!src) throw new InterviewNotFoundError();

  const copy = await db.interview.create({
    data: {
      createdById,
      jobTitle: src.jobTitle,
      companyName: src.companyName,
      jobDescription: src.jobDescription,
      jobPostLink: src.jobPostLink,
      salaryRange: src.salaryRange,
      scheduledAt: src.scheduledAt,
      meetingLink: src.meetingLink,
      interviewerInfo: src.interviewerInfo,
      stageId: src.stageId,
      statusId: src.statusId,
      meetingTypeId: src.meetingTypeId,
      callerId: src.callerId,
      applicationId: src.applicationId,
      profileId: src.profileId,
      meta: (src.meta ?? {}) as Prisma.InputJsonValue,
    },
    select: { id: true },
  });
  return copy.id;
}

export async function assignCaller(id: string, callerId: string | null): Promise<void> {
  if (callerId) await assertCallerValid(callerId);
  const result = await db.interview.updateMany({
    where: { id, deletedAt: null },
    data: { callerId },
  });
  if (result.count === 0) throw new InterviewNotFoundError();
}

/** Set (or clear, with null) the candidate profile this interview is for. */
export async function setInterviewProfile(id: string, profileId: string | null): Promise<void> {
  if (profileId) {
    const exists = await db.profile.findUnique({ where: { id: profileId }, select: { id: true } });
    if (!exists) throw new InterviewNotFoundError();
  }
  const result = await db.interview.updateMany({
    where: { id, deletedAt: null },
    data: { profileId },
  });
  if (result.count === 0) throw new InterviewNotFoundError();
}

/** Candidate profiles a manager can pick from when assigning one to an interview. */
export async function listAssignableProfiles(): Promise<{ id: string; name: string }[]> {
  const rows = await db.profile.findMany({
    select: { id: true, fullNameEnc: true, encryptedDek: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((p) => ({ id: p.id, name: decryptField(unwrapDek(p.encryptedDek), p.fullNameEnc) }));
}

// ── Status + comments (caller-or-manager, scoped) ──────

/** A Caller may re-status only interviews assigned to them; managers, any. */
export async function updateStatus(access: InterviewAccess, id: string, statusId: string | null): Promise<void> {
  const result = await db.interview.updateMany({
    where: { id, ...scopeWhere(access) },
    data: { statusId },
  });
  if (result.count === 0) throw new InterviewNotFoundError();
}

export async function addComment(access: InterviewAccess, id: string, body: string): Promise<void> {
  // Verify visibility first (a Caller can only comment on their own interview).
  const visible = await db.interview.findFirst({ where: { id, ...scopeWhere(access) }, select: { id: true } });
  if (!visible) throw new InterviewNotFoundError();

  await db.interviewComment.create({
    data: { interviewId: id, authorId: access.id, body: body.trim() },
  });
}

// ── Files ──────────────────────────────────────────────

export const MAX_INTERVIEW_FILE_BYTES = 8 * 1024 * 1024;
export const ALLOWED_INTERVIEW_FILE_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function assertFileValid(size: number, mimeType: string) {
  if (!ALLOWED_INTERVIEW_FILE_TYPES.has(mimeType)) {
    throw new InvalidFileError("Unsupported file type — upload a PDF, Word doc, or image.");
  }
  if (size > MAX_INTERVIEW_FILE_BYTES) {
    throw new InvalidFileError("File is too large (max 8MB).");
  }
}

/** Manager-only (the action gate enforces role); scoped to non-deleted interviews. */
export async function addReferenceFile(
  interviewId: string,
  uploadedById: string,
  file: { data: Buffer; filename: string; mimeType: string }
): Promise<void> {
  assertFileValid(file.data.byteLength, file.mimeType);
  const interview = await db.interview.findFirst({ where: { id: interviewId, deletedAt: null }, select: { id: true } });
  if (!interview) throw new InterviewNotFoundError();

  await db.interviewReferenceFile.create({
    data: {
      interviewId,
      uploadedById,
      filename: file.filename.slice(0, 255),
      mimeType: file.mimeType,
      size: file.data.byteLength,
      data: new Uint8Array(file.data),
    },
  });
}

export async function deleteReferenceFile(interviewId: string, fileId: string): Promise<void> {
  const result = await db.interviewReferenceFile.deleteMany({ where: { id: fileId, interviewId } });
  if (result.count === 0) throw new InterviewNotFoundError();
}

/** Download a reference file — scoped so a Caller can only read their own interview's files. */
export async function getReferenceFile(
  access: InterviewAccess,
  interviewId: string,
  fileId: string
): Promise<{ data: Buffer; mimeType: string; filename: string } | null> {
  const visible = await db.interview.findFirst({ where: { id: interviewId, ...scopeWhere(access) }, select: { id: true } });
  if (!visible) return null;

  const file = await db.interviewReferenceFile.findFirst({
    where: { id: fileId, interviewId },
    select: { data: true, mimeType: true, filename: true },
  });
  if (!file) return null;
  return { data: Buffer.from(file.data), mimeType: file.mimeType, filename: file.filename };
}

export async function setResumeFile(
  interviewId: string,
  file: { data: Buffer; filename: string; mimeType: string }
): Promise<void> {
  assertFileValid(file.data.byteLength, file.mimeType);
  const result = await db.interview.updateMany({
    where: { id: interviewId, deletedAt: null },
    data: {
      resumeData: new Uint8Array(file.data),
      resumeMimeType: file.mimeType,
      resumeFilename: file.filename.slice(0, 255),
    },
  });
  if (result.count === 0) throw new InterviewNotFoundError();
}

export async function getResumeFile(
  access: InterviewAccess,
  interviewId: string
): Promise<{ data: Buffer; mimeType: string; filename: string } | null> {
  const row = await db.interview.findFirst({
    where: { id: interviewId, ...scopeWhere(access) },
    select: { resumeData: true, resumeMimeType: true, resumeFilename: true },
  });
  if (!row?.resumeData || !row.resumeMimeType) return null;
  return {
    data: Buffer.from(row.resumeData),
    mimeType: row.resumeMimeType,
    filename: row.resumeFilename ?? "resume",
  };
}

// ── Helpers ────────────────────────────────────────────

/** Users that can be assigned as the Caller on an interview. */
export async function listCallers(): Promise<{ id: string; name: string; email: string }[]> {
  const rows = await db.user.findMany({
    where: { role: "CALLER" },
    orderBy: { username: "asc" },
    select: { id: true, username: true, email: true },
  });
  return rows.map((r) => ({ id: r.id, name: r.username, email: r.email }));
}

async function assertCallerValid(callerId: string): Promise<void> {
  const user = await db.user.findUnique({ where: { id: callerId }, select: { role: true } });
  if (!user || user.role !== "CALLER") throw new InvalidCallerError();
}

/** Limited, plaintext application fields for pre-filling the "new interview" form. */
export async function getApplicationPrefill(applicationId: string): Promise<{
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  jobPostLink: string | null;
  profileId: string | null;
} | null> {
  const resume = await db.resume.findUnique({
    where: { id: applicationId },
    select: { companyName: true, jobTitle: true, jobDescription: true, jobLink: true, profileId: true },
  });
  if (!resume) return null;
  return {
    companyName: resume.companyName,
    jobTitle: resume.jobTitle,
    jobDescription: resume.jobDescription,
    jobPostLink: resume.jobLink,
    profileId: resume.profileId,
  };
}

function sanitizeFilenamePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "resume";
}

/**
 * Renders the linked application's resume to a PDF using the same export
 * pipeline as the Resume Platform. Returns null when there's nothing to render
 * (no profile / personal info yet) — the interview simply won't have an
 * attached resume until one is uploaded.
 */
async function buildApplicationResumePdf(applicationId: string): Promise<{ data: Buffer; filename: string } | null> {
  const resume = await db.resume.findUnique({
    where: { id: applicationId },
    select: { userId: true, profileId: true, companyName: true, tailoredContentEnc: true },
  });
  if (!resume) return null;

  const resumeFields = await getResumeFieldsForResume(resume.userId, resume.profileId);
  if (!resumeFields) return null;

  const tailoredContent = await decryptTailoredContent(resume.profileId, resume.tailoredContentEnc);
  const document = buildResumeDocument(resumeFields, tailoredContent);
  const settings = await getSettings();
  const profileTemplate = resume.profileId ? await getProfileTemplate(resume.profileId) : null;
  const pdfBuffer = await renderResumePdf(document, effectiveStyleKey(profileTemplate, settings.resumeTemplate));

  const filename = `${sanitizeFilenamePart(resumeFields.fullName)}-${sanitizeFilenamePart(resume.companyName)}.pdf`;
  return { data: Buffer.from(pdfBuffer), filename };
}
