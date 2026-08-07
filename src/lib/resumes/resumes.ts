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

/** The application this new build collides with — surfaced so the UI can name it and link to it. */
export type DuplicateMatch = { id: string; companyName: string; jobTitle: string };

export class DuplicateApplicationError extends Error {
  readonly existing: DuplicateMatch;
  constructor(existing: DuplicateMatch) {
    super(
      `A resume for “${existing.jobTitle}” at “${existing.companyName}” has already been generated for this profile.`
    );
    this.existing = existing;
    this.name = "DuplicateApplicationError";
  }
}

export type ResumeSummary = {
  id: string;
  /** The candidate profile this entry is anchored to — the authoritative source
   * for rendering/exporting it, so its fields and any tailored content always
   * come from the same profile even after a reassignment. Null if none was
   * assigned when it was logged. */
  profileId: string | null;
  companyName: string;
  jobTitle: string;
  jobLink: string | null;
  statuses: ResumeStatus[];
  roleTrack: RoleTrack;
  source: ApplicationSource;
  approvalStatus: ApprovalStatus;
  hasScreenshot: boolean;
  appliedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /** Who actually created/submitted this entry — several accounts can share one profile's tracker. */
  appliedByEmail: string;
  /** The creator's public handle — how they're shown in the tracker. */
  appliedByName: string;
};

export type ResumeDetail = ResumeSummary & {
  jobDescription: string;
  notes: string | null;
  generatedAt: Date | null;
  approvedAt: Date | null;
  modelUsed: string | null;
  /** Encrypted tailored output, carried on the detail so callers can decrypt it
   * without a second round trip to re-read the same row. */
  tailoredContentEnc: string | null;
};

const SUMMARY_SELECT = {
  id: true,
  profileId: true,
  companyName: true,
  jobTitle: true,
  jobLink: true,
  statuses: true,
  roleTrack: true,
  source: true,
  approvalStatus: true,
  appliedAt: true,
  createdAt: true,
  updatedAt: true,
  screenshotData: true,
  user: { select: { email: true, username: true } },
} as const;

function toSummary(row: {
  id: string;
  profileId: string | null;
  companyName: string;
  jobTitle: string;
  jobLink: string | null;
  statuses: ResumeStatus[];
  roleTrack: RoleTrack;
  source: ApplicationSource;
  approvalStatus: ApprovalStatus;
  appliedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  screenshotData: Buffer | Uint8Array | null;
  user: { email: string; username: string };
}): ResumeSummary {
  return {
    id: row.id,
    profileId: row.profileId,
    companyName: row.companyName,
    jobTitle: row.jobTitle,
    jobLink: row.jobLink,
    statuses: row.statuses,
    roleTrack: row.roleTrack,
    source: row.source,
    approvalStatus: row.approvalStatus,
    hasScreenshot: row.screenshotData !== null,
    appliedAt: row.appliedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    appliedByEmail: row.user.email,
    appliedByName: row.user.username,
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
): Promise<DuplicateMatch | null> {
  const trimmedLink = jobLink?.trim();

  return db.resume.findFirst({
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
    select: { id: true, companyName: true, jobTitle: true },
  });
}

/** The team an application belongs to — the profile's team, else the creator's team. Null when neither has one. */
async function resolveTeamId(userId: string, profileId: string | null): Promise<string | null> {
  if (profileId) {
    const profile = await db.profile.findUnique({ where: { id: profileId }, select: { teamId: true } });
    if (profile?.teamId) return profile.teamId;
  }
  const membership = await db.teamMembership.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { teamId: true },
  });
  return membership?.teamId ?? null;
}

export async function createResume(userId: string, input: CreateResumeInput): Promise<string> {
  const profileId = await getAssignedProfileId(userId);
  const scope: { profileId: string } | { userId: string; profileId: null } = profileId
    ? { profileId }
    : { userId, profileId: null };
  const teamId = await resolveTeamId(userId, profileId);

  // Normalized once here, so both the duplicate check and the stored value
  // see the same canonical link — trims tracking params/hash/trailing slash
  // that would otherwise let the exact same posting slip past URL matching.
  const jobLink = input.jobLink ? normalizeJobUrl(input.jobLink) : undefined;

  const duplicate = await findDuplicate(scope, jobLink, input.companyName, input.jobTitle);
  if (duplicate) {
    throw new DuplicateApplicationError(duplicate);
  }

  const status = input.status ?? "DRAFT";
  const resume = await db.resume.create({
    data: {
      userId,
      profileId,
      teamId,
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

/**
 * A bidder's own Applications list — scoped to what THEY personally logged
 * (userId), so a bidder sees only their own applications, not the whole
 * shared-profile tracker. (A superadmin uses listAllApplications to see
 * everyone's.) Shared-profile operations — proof upload, duplicate detection,
 * opening a specific entry — still span teammates via scopeFilter.
 */
export async function listResumes(userId: string, filter: ListResumesFilter = {}): Promise<ResumeSummary[]> {
  const resumes = await db.resume.findMany({
    where: {
      userId,
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
      tailoredContentEnc: true,
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
    tailoredContentEnc: resume.tailoredContentEnc,
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
