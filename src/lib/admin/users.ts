import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { hasTeamAdminPower } from "@/lib/auth/roles";
import { deleteAccount } from "@/lib/profile/account";
import { getProfileNames } from "@/lib/profile/personal-info";
import { hashPassword } from "@/lib/auth/password";
import { generateDek, wrapDek } from "@/lib/crypto/envelope";
import type { CreateUserInput } from "@/lib/admin/user-schemas";
import type { UserRole } from "@/generated/prisma/client";

export type AdminUserSummary = {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  approved: boolean;
  createdAt: Date;
  assignedProfileId: string | null;
  assignedProfileName: string | null;
  /** Superadmin-verified count of successfully submitted job applications. */
  approvedApplicationsCount: number;
};

export async function listAllUsers(teamId?: string): Promise<AdminUserSummary[]> {
  const users = await db.user.findMany({
    where: teamId ? { memberships: { some: { teamId } } } : {},
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      username: true,
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
    username: u.username,
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
  role: UserRole,
  teamId?: string
): Promise<void> {
  if (callerId === targetUserId && !hasTeamAdminPower(role)) {
    throw new CannotDemoteSelfError();
  }
  await db.user.update({ where: { id: targetUserId }, data: { role } });
  // Keep the team-scoped membership role in sync (multi-tenancy).
  if (teamId) {
    await db.teamMembership.upsert({
      where: { userId_teamId: { userId: targetUserId, teamId } },
      create: { userId: targetUserId, teamId, role: membershipRole(role) },
      update: { role: membershipRole(role) },
    });
  }
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

// ── Create / edit / password (superadmin) ──────────────

/** Raised when an email or username collides with an existing account. */
export class DuplicateUserError extends Error {
  constructor(public field: "email" | "username") {
    super(`That ${field} is already in use`);
  }
}

/** Maps a Prisma P2002 unique-violation to the offending field (email/username). */
function duplicateFieldFrom(err: unknown): "email" | "username" | null {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") return null;
  const target = err.meta?.target;
  const text = Array.isArray(target) ? target.join(",") : String(target ?? "");
  return text.includes("username") ? "username" : "email";
}

/** Superadmin creates an account directly (its own envelope DEK, chosen role/approval). */
/** Maps the (legacy global) role chosen in the admin form to a team-scoped membership role. */
function membershipRole(role: string): "TEAM_ADMIN" | "MANAGER" | "CALLER" | "BIDDER" {
  if (role === "SUPERADMIN" || role === "TEAM_ADMIN" || role === "SERVICE_ADMIN") return "TEAM_ADMIN";
  if (role === "MANAGER") return "MANAGER";
  if (role === "CALLER") return "CALLER";
  return "BIDDER";
}

export async function createUserAsAdmin(input: CreateUserInput, teamId?: string): Promise<string> {
  const passwordHash = await hashPassword(input.password);
  const encryptedDek = wrapDek(generateDek());
  try {
    const user = await db.user.create({
      data: {
        email: input.email,
        username: input.username,
        passwordHash,
        encryptedDek,
        role: input.role,
        approved: input.approved,
      },
      select: { id: true },
    });
    // Add the new user to the creating admin's team (multi-tenancy).
    if (teamId) {
      await db.teamMembership.create({ data: { userId: user.id, teamId, role: membershipRole(input.role) } });
    }
    return user.id;
  } catch (err) {
    const field = duplicateFieldFrom(err);
    if (field) throw new DuplicateUserError(field);
    throw err;
  }
}

export type AdminUserDetail = {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  approved: boolean;
  createdAt: Date;
  assignedProfileId: string | null;
};

export async function getUserForAdmin(id: string): Promise<AdminUserDetail | null> {
  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, email: true, username: true, role: true, approved: true, createdAt: true, profileId: true },
  });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    approved: user.approved,
    createdAt: user.createdAt,
    assignedProfileId: user.profileId,
  };
}

/** Updates an account's identity fields (email / username). */
export async function updateUserAsAdmin(id: string, input: { email: string; username: string }): Promise<void> {
  try {
    await db.user.update({ where: { id }, data: { email: input.email, username: input.username } });
  } catch (err) {
    const field = duplicateFieldFrom(err);
    if (field) throw new DuplicateUserError(field);
    throw err;
  }
}

/** Resets an account's password to a new value (no current-password check — admin action). */
export async function adminSetPassword(id: string, newPassword: string): Promise<void> {
  const passwordHash = await hashPassword(newPassword);
  await db.user.update({ where: { id }, data: { passwordHash } });
}
