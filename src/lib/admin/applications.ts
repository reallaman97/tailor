import { db } from "@/lib/db";
import { getProfileNames } from "@/lib/profile/personal-info";
import type { ResumeDetail } from "@/lib/resumes/resumes";
import type {
  ApprovalStatus,
  ResumeStatus,
  RoleTrack,
  ApplicationSource,
} from "@/generated/prisma/client";

export async function setApplicationApproval(resumeId: string, approvalStatus: ApprovalStatus): Promise<void> {
  await db.resume.update({
    where: { id: resumeId },
    data: {
      approvalStatus,
      approvedAt: approvalStatus === "APPROVED" ? new Date() : null,
    },
  });
}

/** Bulk approval change for a superadmin's multi-selected rows in the tracker table. */
export async function setApplicationsApproval(
  resumeIds: string[],
  approvalStatus: "APPROVED" | "REJECTED"
): Promise<void> {
  await Promise.all(resumeIds.map((id) => setApplicationApproval(id, approvalStatus)));
}

export async function getApplicationScreenshot(
  resumeId: string
): Promise<{ data: Buffer; mimeType: string } | null> {
  const resume = await db.resume.findUnique({
    where: { id: resumeId },
    select: { screenshotData: true, screenshotMimeType: true },
  });
  if (!resume?.screenshotData || !resume.screenshotMimeType) return null;
  return { data: Buffer.from(resume.screenshotData), mimeType: resume.screenshotMimeType };
}

/** A user's count of superadmin-verified, successfully submitted applications. */
export async function countApprovedApplications(userId: string): Promise<number> {
  return db.resume.count({ where: { userId, approvalStatus: "APPROVED" } });
}

/** Deletes any user's application record — superadmin-only; normal users may not remove their own. */
export async function deleteApplication(resumeId: string): Promise<void> {
  await db.resume.delete({ where: { id: resumeId } });
}

/** Bulk delete for a superadmin's multi-selected rows in the tracker table. */
export async function deleteApplications(resumeIds: string[]): Promise<void> {
  await db.resume.deleteMany({ where: { id: { in: resumeIds } } });
}

/**
 * Replaces an application's full status set on behalf of any user — the
 * superadmin-only counterpart to updateResumeStatus, unscoped by owner.
 * Preserves the same "set appliedAt once, on first entry of APPLIED" rule.
 */
export async function setApplicationStatus(resumeId: string, statuses: ResumeStatus[]): Promise<void> {
  const existing = await db.resume.findUniqueOrThrow({
    where: { id: resumeId },
    select: { appliedAt: true },
  });

  await db.resume.update({
    where: { id: resumeId },
    data: {
      statuses,
      appliedAt: statuses.includes("APPLIED") && !existing.appliedAt ? new Date() : undefined,
    },
  });
}

/**
 * Bulk action for a superadmin's multi-selected rows — ADDS one status to
 * each selected application's existing set (rather than replacing it),
 * consistent with statuses being an accumulating history per application.
 */
export async function addStatusToApplications(resumeIds: string[], status: ResumeStatus): Promise<void> {
  const existing = await db.resume.findMany({
    where: { id: { in: resumeIds } },
    select: { id: true, statuses: true, appliedAt: true },
  });

  await Promise.all(
    existing.map((r) =>
      db.resume.update({
        where: { id: r.id },
        data: {
          statuses: r.statuses.includes(status) ? r.statuses : [...r.statuses, status],
          appliedAt: status === "APPLIED" && !r.appliedAt ? new Date() : undefined,
        },
      })
    )
  );
}

/** Inline source change — leaves notes untouched, unlike the full updateApplicationDetails form. */
export async function setApplicationSource(resumeId: string, source: ApplicationSource): Promise<void> {
  await db.resume.update({ where: { id: resumeId }, data: { source } });
}

export type UpdateApplicationDetailsInput = {
  source: ApplicationSource;
  notes?: string;
};

/** Superadmin-only tracking-metadata edit — source/notes, unscoped by owner. Role track is never manually editable (AI-classified at creation). */
export async function updateApplicationDetails(
  resumeId: string,
  input: UpdateApplicationDetailsInput
): Promise<void> {
  await db.resume.update({
    where: { id: resumeId },
    data: {
      source: input.source,
      notes: input.notes ?? null,
    },
  });
}

export type AdminApplicationDetail = ResumeDetail & {
  userId: string;
  profileId: string | null;
  profileName: string | null;
};

/** Fetches one application by id regardless of owner — for a superadmin viewing any user's tracker entry. */
export async function getApplicationDetail(resumeId: string): Promise<AdminApplicationDetail | null> {
  const resume = await db.resume.findUnique({
    where: { id: resumeId },
    include: { user: { select: { id: true, email: true, username: true } } },
  });
  if (!resume) return null;

  const profileName = resume.profileId
    ? ((await getProfileNames([resume.profileId])).get(resume.profileId) ?? null)
    : null;

  return {
    id: resume.id,
    companyName: resume.companyName,
    jobTitle: resume.jobTitle,
    jobLink: resume.jobLink,
    statuses: resume.statuses,
    roleTrack: resume.roleTrack,
    source: resume.source,
    approvalStatus: resume.approvalStatus,
    hasScreenshot: resume.screenshotData !== null,
    createdAt: resume.createdAt,
    updatedAt: resume.updatedAt,
    jobDescription: resume.jobDescription,
    notes: resume.notes,
    generatedAt: resume.generatedAt,
    appliedAt: resume.appliedAt,
    approvedAt: resume.approvedAt,
    modelUsed: resume.modelUsed,
    tailoredContentEnc: resume.tailoredContentEnc,
    userId: resume.user.id,
    profileId: resume.profileId,
    profileName,
    appliedByEmail: resume.user.email,
    appliedByName: resume.user.username,
  };
}

export type AdminTrackerRow = {
  id: string;
  userId: string;
  /** "Applied By" — who actually created this entry (may differ from other team members sharing the same profile). */
  userEmail: string;
  /** The creator's public handle — how "Applied By" is shown in the tracker. */
  userName: string;
  profileId: string | null;
  profileName: string | null;
  companyName: string;
  jobTitle: string;
  jobLink: string | null;
  statuses: ResumeStatus[];
  roleTrack: RoleTrack;
  source: ApplicationSource;
  approvalStatus: ApprovalStatus;
  hasScreenshot: boolean;
  createdAt: Date;
  updatedAt: Date;
  appliedAt: Date | null;
};

export type AdminTrackerFilter = {
  status?: ResumeStatus;
  roleTrack?: RoleTrack;
  source?: ApplicationSource;
  approvalStatus?: ApprovalStatus;
  userId?: string;
  profileId?: string;
  /** Scope to one team's applications (multi-tenancy). Omitted = all teams. */
  teamId?: string;
};

/** The superadmin's view of every user's tracker — default sort is applied date/time newest first. */
export async function listAllApplications(filter: AdminTrackerFilter = {}): Promise<AdminTrackerRow[]> {
  const resumes = await db.resume.findMany({
    where: {
      ...(filter.status ? { statuses: { has: filter.status } } : {}),
      ...(filter.roleTrack ? { roleTrack: filter.roleTrack } : {}),
      ...(filter.source ? { source: filter.source } : {}),
      ...(filter.approvalStatus ? { approvalStatus: filter.approvalStatus } : {}),
      ...(filter.userId ? { userId: filter.userId } : {}),
      ...(filter.profileId ? { profileId: filter.profileId } : {}),
      ...(filter.teamId ? { teamId: filter.teamId } : {}),
    },
    orderBy: [{ appliedAt: "desc" }, { createdAt: "desc" }],
    include: { user: { select: { id: true, email: true, username: true } } },
  });

  const profileIds = [...new Set(resumes.map((r) => r.profileId).filter((id): id is string => id !== null))];
  const namesByProfileId = await getProfileNames(profileIds);

  return resumes.map((r) => ({
    id: r.id,
    userId: r.user.id,
    userEmail: r.user.email,
    userName: r.user.username,
    profileId: r.profileId,
    profileName: r.profileId ? (namesByProfileId.get(r.profileId) ?? null) : null,
    companyName: r.companyName,
    jobTitle: r.jobTitle,
    jobLink: r.jobLink,
    statuses: r.statuses,
    roleTrack: r.roleTrack,
    source: r.source,
    approvalStatus: r.approvalStatus,
    hasScreenshot: r.screenshotData !== null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    appliedAt: r.appliedAt,
  }));
}
