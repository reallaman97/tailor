import { db } from "@/lib/db";
import { getAssignedProfileId } from "@/lib/profile/shared";
import { normalizeJobUrl } from "@/lib/resumes/normalize-url";
import type { CreateResumeInput } from "@/lib/resumes/schemas";
import type { ResumeStatus, RoleTrack, ApplicationSource, ApprovalStatus } from "@/generated/prisma/client";

export class ResumeNotFoundError extends Error {
  constructor() {
    super("Resume not found");
  }
}

export class DuplicateApplicationError extends Error {
  constructor() {
    super("You've already logged an application for this job");
  }
}

export type ResumeSummary = {
  id: string;
  companyName: string;
  jobTitle: string;
  jobLink: string | null;
  statuses: ResumeStatus[];
  roleTrack: RoleTrack;
  source: ApplicationSource;
  approvalStatus: ApprovalStatus;
  followUpDate: Date | null;
  hasScreenshot: boolean;
  appliedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /** Who actually created/submitted this entry — several accounts can share one profile's tracker. */
  appliedByEmail: string;
};

export type ResumeDetail = ResumeSummary & {
  jobDescription: string;
  notes: string | null;
  generatedAt: Date | null;
  approvedAt: Date | null;
  modelUsed: string | null;
};

const SUMMARY_SELECT = {
  id: true,
  companyName: true,
  jobTitle: true,
  jobLink: true,
  statuses: true,
  roleTrack: true,
  source: true,
  approvalStatus: true,
  followUpDate: true,
  appliedAt: true,
  createdAt: true,
  updatedAt: true,
  screenshotData: true,
  user: { select: { email: true } },
} as const;

function toSummary(row: {
  id: string;
  companyName: string;
  jobTitle: string;
  jobLink: string | null;
  statuses: ResumeStatus[];
  roleTrack: RoleTrack;
  source: ApplicationSource;
  approvalStatus: ApprovalStatus;
  followUpDate: Date | null;
  appliedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  screenshotData: Buffer | Uint8Array | null;
  user: { email: string };
}): ResumeSummary {
  return {
    id: row.id,
    companyName: row.companyName,
    jobTitle: row.jobTitle,
    jobLink: row.jobLink,
    statuses: row.statuses,
    roleTrack: row.roleTrack,
    source: row.source,
    approvalStatus: row.approvalStatus,
    followUpDate: row.followUpDate,
    hasScreenshot: row.screenshotData !== null,
    appliedAt: row.appliedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    appliedByEmail: row.user.email,
  };
}

/**
 * The tracker is shared by every user account assigned to the same profile
 * (several team members can log applications for one candidate), so reads
 * scope by profile rather than by the exact creating account. A caller with
 * no profile assigned yet only sees what they personally created.
 */
export async function scopeFilter(
  callerUserId: string
): Promise<{ profileId: string } | { userId: string; profileId: null }> {
  const profileId = await getAssignedProfileId(callerUserId);
  return profileId ? { profileId } : { userId: callerUserId, profileId: null };
}

/**
 * A duplicate is the same job link OR the same company+title, checked
 * together (not either/or) — a genuine duplicate might be missing a
 * recorded link even when the new entry has one. Scoped by profile so two
 * team members sharing a profile can't independently double-log the same job.
 */
async function findDuplicate(
  scope: { profileId: string } | { userId: string; profileId: null },
  jobLink: string | undefined,
  companyName: string,
  jobTitle: string
): Promise<boolean> {
  const trimmedLink = jobLink?.trim();

  const match = await db.resume.findFirst({
    where: {
      ...scope,
      OR: [
        ...(trimmedLink ? [{ jobLink: { equals: trimmedLink, mode: "insensitive" as const } }] : []),
        {
          companyName: { equals: companyName.trim(), mode: "insensitive" as const },
          jobTitle: { equals: jobTitle.trim(), mode: "insensitive" as const },
        },
      ],
    },
    select: { id: true },
  });
  return match !== null;
}

export async function createResume(userId: string, input: CreateResumeInput): Promise<string> {
  const profileId = await getAssignedProfileId(userId);
  const scope: { profileId: string } | { userId: string; profileId: null } = profileId
    ? { profileId }
    : { userId, profileId: null };

  // Normalized once here, so both the duplicate check and the stored value
  // see the same canonical link — trims tracking params/hash/trailing slash
  // that would otherwise let the exact same posting slip past URL matching.
  const jobLink = input.jobLink ? normalizeJobUrl(input.jobLink) : undefined;

  if (await findDuplicate(scope, jobLink, input.companyName, input.jobTitle)) {
    throw new DuplicateApplicationError();
  }

  const status = input.status ?? "DRAFT";
  const resume = await db.resume.create({
    data: {
      userId,
      profileId,
      companyName: input.companyName,
      jobTitle: input.jobTitle,
      jobLink: jobLink || null,
      jobDescription: input.jobDescription,
      roleTrack: input.roleTrack ?? "OTHER",
      source: input.source ?? "OTHER",
      statuses: [status],
      // Creating directly at APPLIED (the normal-user/admin-builder flow)
      // skips the DRAFT step, so appliedAt must be set here too — mirrors
      // the "set once, on first transition to APPLIED" rule in setApplicationStatus.
      appliedAt: status === "APPLIED" ? new Date() : null,
    },
  });
  return resume.id;
}

export type ListResumesFilter = {
  status?: ResumeStatus;
  roleTrack?: RoleTrack;
  source?: ApplicationSource;
  approvalStatus?: ApprovalStatus;
};

export async function listResumes(userId: string, filter: ListResumesFilter = {}): Promise<ResumeSummary[]> {
  const scope = await scopeFilter(userId);
  const resumes = await db.resume.findMany({
    where: {
      ...scope,
      ...(filter.status ? { statuses: { has: filter.status } } : {}),
      ...(filter.roleTrack ? { roleTrack: filter.roleTrack } : {}),
      ...(filter.source ? { source: filter.source } : {}),
      ...(filter.approvalStatus ? { approvalStatus: filter.approvalStatus } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: SUMMARY_SELECT,
  });
  return resumes.map(toSummary);
}

export async function getResume(userId: string, resumeId: string): Promise<ResumeDetail | null> {
  const scope = await scopeFilter(userId);
  const resume = await db.resume.findFirst({
    where: { id: resumeId, ...scope },
    select: {
      ...SUMMARY_SELECT,
      jobDescription: true,
      notes: true,
      generatedAt: true,
      approvedAt: true,
      modelUsed: true,
    },
  });
  if (!resume) return null;

  return {
    ...toSummary(resume),
    jobDescription: resume.jobDescription,
    notes: resume.notes,
    generatedAt: resume.generatedAt,
    approvedAt: resume.approvedAt,
    modelUsed: resume.modelUsed,
  };
}

const MAX_SCREENSHOT_BYTES = 4.5 * 1024 * 1024;
const ALLOWED_SCREENSHOT_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export class InvalidScreenshotError extends Error {}

/** Uploading new proof always resets approval back to PENDING — a superadmin re-reviews it. Any team member sharing the profile may upload, not just the original creator. */
export async function uploadScreenshot(
  userId: string,
  resumeId: string,
  data: Buffer,
  mimeType: string
): Promise<void> {
  if (!ALLOWED_SCREENSHOT_TYPES.has(mimeType)) {
    throw new InvalidScreenshotError("Unsupported file type — upload a PNG, JPEG, or WEBP image.");
  }
  if (data.byteLength > MAX_SCREENSHOT_BYTES) {
    throw new InvalidScreenshotError("Image is too large (max 4.5MB).");
  }

  const scope = await scopeFilter(userId);
  const result = await db.resume.updateMany({
    where: { id: resumeId, ...scope },
    data: {
      screenshotData: new Uint8Array(data),
      screenshotMimeType: mimeType,
      approvalStatus: "PENDING",
      approvedAt: null,
    },
  });
  if (result.count === 0) throw new ResumeNotFoundError();
}

export async function getScreenshot(
  userId: string,
  resumeId: string
): Promise<{ data: Buffer; mimeType: string } | null> {
  const scope = await scopeFilter(userId);
  const resume = await db.resume.findFirst({
    where: { id: resumeId, ...scope },
    select: { screenshotData: true, screenshotMimeType: true },
  });
  if (!resume?.screenshotData || !resume.screenshotMimeType) return null;
  return { data: Buffer.from(resume.screenshotData), mimeType: resume.screenshotMimeType };
}
