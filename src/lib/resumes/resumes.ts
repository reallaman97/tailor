import { db } from "@/lib/db";
import { getAssignedProfileId } from "@/lib/profile/shared";
import { normalizeJobUrl } from "@/lib/resumes/normalize-url";
import { archiveScreenshot } from "@/lib/resumes/screenshot-archive";
import {
  companyKey,
  jobPostingKey,
  jdFingerprint,
  shingles,
  similarity,
  NEAR_DUPLICATE_THRESHOLD,
} from "@/lib/resumes/duplicates";
import type { CreateResumeInput } from "@/lib/resumes/schemas";
import type { ResumeStatus, RoleTrack, ApplicationSource, ApprovalStatus } from "@/generated/prisma/client";

export class ResumeNotFoundError extends Error {
  constructor() {
    super("Resume not found");
  }
}

/** The application this new build collides with — surfaced so the UI can name it and link to it. */
export type DuplicateMatch = { id: string; companyName: string; jobTitle: string };

/**
 * Why it's a duplicate: the same employer (one application per company per
 * candidate), the same posting (same job-board id / URL), or the same job
 * description text (exact, or a near-identical repost).
 */
export type DuplicateReason = "company" | "posting" | "description";

export function duplicateMessage(existing: DuplicateMatch, reason: DuplicateReason): string {
  const app = `“${existing.jobTitle}” at “${existing.companyName}”`;
  switch (reason) {
    case "company":
      return `This candidate already has an application at ${existing.companyName} (${app}). Only one application per company is allowed.`;
    case "posting":
      return `This job posting was already used for ${app}.`;
    case "description":
      return `This job description matches an existing application — ${app}.`;
  }
}

export class DuplicateApplicationError extends Error {
  readonly existing: DuplicateMatch;
  readonly reason: DuplicateReason;
  constructor(existing: DuplicateMatch, reason: DuplicateReason) {
    super(duplicateMessage(existing, reason));
    this.existing = existing;
    this.reason = reason;
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

export type DuplicateScope = { profileId: string } | { userId: string; profileId: null };

// How many of the scope's most recent descriptions to compare for near-
// duplicates (the exact keys above are indexed and cover all history).
const NEAR_DUPLICATE_WINDOW = 300;

const NOT_CANCELED = { NOT: { statuses: { has: "CANCELED" as const } } };

/**
 * The thorough duplicate check, run before anything costs tokens. Scoped to a
 * candidate (profile) — several accounts can share one, and different
 * candidates may each apply to the same company. In order:
 *  1. Same company — one application per company per candidate.
 *  2. Same posting — the job board's posting id, or the cleaned URL.
 *  3. Same description — identical text, or a near-identical repost (catches
 *     the same job re-posted by a recruiter under a different company name).
 * Any field may be missing (e.g. the extension knows only the link and text
 * before it extracts the company) — absent fields just skip their rule.
 * Canceled applications never count: canceling one frees the company again.
 */
export async function findDuplicateApplication(
  scope: DuplicateScope,
  input: { companyName?: string; jobLink?: string; jobDescription?: string }
): Promise<{ existing: DuplicateMatch; reason: DuplicateReason } | null> {
  const company = input.companyName ? companyKey(input.companyName) : null;
  const posting = jobPostingKey(input.jobLink);
  const fingerprint = input.jobDescription ? jdFingerprint(input.jobDescription) : null;
  const select = { id: true, companyName: true, jobTitle: true, companyKey: true, jobKey: true, jdFingerprint: true };

  const exact = await db.resume.findMany({
    where: {
      ...scope,
      ...NOT_CANCELED,
      OR: [
        ...(company ? [{ companyKey: company }] : []),
        ...(posting ? [{ jobKey: posting }] : []),
        ...(fingerprint ? [{ jdFingerprint: fingerprint }] : []),
        // Rows created before the keys existed, until setup backfills them.
        ...(input.companyName?.trim()
          ? [{ companyKey: null, companyName: { equals: input.companyName.trim(), mode: "insensitive" as const } }]
          : []),
      ],
    },
    select,
    take: 5,
  });
  const pick = (reason: DuplicateReason, test: (r: (typeof exact)[number]) => boolean) => {
    const hit = exact.find(test);
    return hit ? { existing: { id: hit.id, companyName: hit.companyName, jobTitle: hit.jobTitle }, reason } : null;
  };
  const exactHit =
    pick("company", (r) => company !== null && (r.companyKey === company || (r.companyKey === null && companyKey(r.companyName) === company))) ??
    pick("posting", (r) => posting !== null && r.jobKey === posting) ??
    pick("description", (r) => fingerprint !== null && r.jdFingerprint === fingerprint);
  if (exactHit) return exactHit;

  // Near-identical description among the scope's recent applications.
  if (!input.jobDescription) return null;
  const candidate = shingles(input.jobDescription);
  if (candidate.size < 20) return null;
  const recent = await db.resume.findMany({
    where: { ...scope, ...NOT_CANCELED },
    orderBy: { createdAt: "desc" },
    take: NEAR_DUPLICATE_WINDOW,
    select: { id: true, companyName: true, jobTitle: true, jobDescription: true },
  });
  for (const r of recent) {
    if (similarity(candidate, shingles(r.jobDescription)) >= NEAR_DUPLICATE_THRESHOLD) {
      return { existing: { id: r.id, companyName: r.companyName, jobTitle: r.jobTitle }, reason: "description" };
    }
  }
  return null;
}

/** The duplicate-check scope for building on behalf of a profile (or a user with none). */
export function duplicateScope(userId: string, profileId: string | null): DuplicateScope {
  return profileId ? { profileId } : { userId, profileId: null };
}

/**
 * Fills in the duplicate keys for applications created before they existed.
 * Idempotent (only touches rows still missing them); run by `npm run setup`.
 */
export async function backfillDuplicateKeys(batchSize = 200): Promise<number> {
  let updated = 0;
  for (;;) {
    const rows = await db.resume.findMany({
      where: { companyKey: null, jdFingerprint: null, jobKey: null },
      select: { id: true, companyName: true, jobLink: true, jobDescription: true },
      take: batchSize,
      orderBy: { createdAt: "asc" },
    });
    if (rows.length === 0) break;
    for (const r of rows) {
      await db.resume.update({
        where: { id: r.id },
        data: {
          companyKey: companyKey(r.companyName),
          jobKey: jobPostingKey(r.jobLink),
          // "" rather than null when there's nothing to fingerprint, so a row whose
          // keys are all null ("Confidential", no link, short text) isn't re-selected forever.
          jdFingerprint: jdFingerprint(r.jobDescription) ?? "",
        },
      });
    }
    updated += rows.length;
    if (rows.length < batchSize) break;
  }
  return updated;
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

  const duplicate = await findDuplicateApplication(scope, {
    companyName: input.companyName,
    jobLink,
    jobDescription: input.jobDescription,
  });
  if (duplicate) {
    throw new DuplicateApplicationError(duplicate.existing, duplicate.reason);
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
      companyKey: companyKey(input.companyName),
      jobKey: jobPostingKey(jobLink),
      // "" (not null) when the text is too short to fingerprint, so backfill skips the row.
      jdFingerprint: jdFingerprint(input.jobDescription) ?? "",
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
  const stored = (await archiveScreenshot(data)) ?? { data, mimeType };
  const result = await db.resume.updateMany({
    where: { id: resumeId, ...scope },
    data: {
      screenshotData: new Uint8Array(stored.data),
      screenshotMimeType: stored.mimeType,
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
