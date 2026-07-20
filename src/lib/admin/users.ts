import { db } from "@/lib/db";
import { deleteAccount } from "@/lib/profile/account";
import { getProfileNames } from "@/lib/profile/personal-info";
import type { UserRole } from "@/generated/prisma/client";

export type AdminUserSummary = {
  id: string;
  email: string;
  role: UserRole;
  approved: boolean;
  createdAt: Date;
  assignedProfileId: string | null;
  assignedProfileName: string | null;
  /** Superadmin-verified count of successfully submitted job applications. */
  approvedApplicationsCount: number;
};

export async function listAllUsers(): Promise<AdminUserSummary[]> {
  const users = await db.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      role: true,
      approved: true,
      createdAt: true,
      profileId: true,
    },
  });

  const profileIds = users
    .map((u) => u.profileId)
    .filter((id): id is string => id !== null);
  const namesByProfileId = await getProfileNames(profileIds);

  const approvedCounts = await db.resume.groupBy({
    by: ["userId"],
    where: { approvalStatus: "APPROVED" },
    _count: { _all: true },
  });
  const approvedCountByUserId = new Map(approvedCounts.map((c) => [c.userId, c._count._all]));

  return users.map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    approved: u.approved,
    createdAt: u.createdAt,
    assignedProfileId: u.profileId,
    assignedProfileName: u.profileId ? (namesByProfileId.get(u.profileId) ?? null) : null,
    approvedApplicationsCount: approvedCountByUserId.get(u.id) ?? 0,
  }));
}

export class CannotUnapproveSelfError extends Error {
  constructor() {
    super("You can't revoke your own approval");
  }
}

export async function updateUserApproval(
  callerId: string,
  targetUserId: string,
  approved: boolean
): Promise<void> {
  if (callerId === targetUserId && !approved) {
    throw new CannotUnapproveSelfError();
  }
  await db.user.update({ where: { id: targetUserId }, data: { approved } });
}

export class CannotDemoteSelfError extends Error {
  constructor() {
    super("You can't remove your own admin access");
  }
}

export async function updateUserRole(
  callerId: string,
  targetUserId: string,
  role: UserRole
): Promise<void> {
  if (callerId === targetUserId && role !== "SUPERADMIN") {
    throw new CannotDemoteSelfError();
  }
  await db.user.update({ where: { id: targetUserId }, data: { role } });
}

export class CannotDeleteSelfError extends Error {
  constructor() {
    super("You can't delete your own account from here");
  }
}

export async function deleteUserAsAdmin(callerId: string, targetUserId: string): Promise<void> {
  if (callerId === targetUserId) {
    throw new CannotDeleteSelfError();
  }
  await deleteAccount(targetUserId);
}
