import { db } from "@/lib/db";
import { withDbRetry } from "@/lib/db-retry";
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

export type PlatformUserRow = {
  id: string;
  email: string;
  username: string;
  role: UserRole; // global role
  approved: boolean;
  createdAt: Date;
  teamId: string | null; // primary team
  teamName: string | null;
  teamRole: UserRole | null;
  approvedApplicationsCount: number;
};

/**
 * Every user on the platform (across all teams) with their primary team, role,
 * approval, and approved-application count. Powers the Service Admin's all-in-one
 * user console at /platform/users.
 */
export async function listPlatformUsers(): Promise<PlatformUserRow[]> {
  const users = await db.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      approved: true,
      createdAt: true,
      memberships: {
        select: { teamId: true, role: true, team: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });

  const approvedCounts = await db.resume.groupBy({
    by: ["userId"],
    where: { approvalStatus: "APPROVED" },
    _count: { _all: true },
  });
  const countByUser = new Map(approvedCounts.map((c) => [c.userId, c._count._all]));

  return users.map((u) => {
    const m = u.memberships[0] ?? null;
    return {
      id: u.id,
      email: u.email,
      username: u.username,
      role: u.role,
      approved: u.approved,
      createdAt: u.createdAt,
      teamId: m?.teamId ?? null,
      teamName: m?.team.name ?? null,
      teamRole: m?.role ?? null,
      approvedApplicationsCount: countByUser.get(u.id) ?? 0,
    };
  });
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

/**
 * Assigns a user to a team with a role, moving them so they belong to exactly
 * that team afterwards (memberships in other teams are removed). Used by the
 * admin edit page where a service admin picks the user's team + role. Keeps the
 * global User.role in sync (SERVICE_ADMIN maps to a TEAM_ADMIN membership).
 */
export async function setUserTeamAndRole(
  callerId: string,
  targetUserId: string,
  teamId: string,
  role: UserRole
): Promise<void> {
  if (callerId === targetUserId && !hasTeamAdminPower(role)) {
    throw new CannotDemoteSelfError();
  }
  const memberRole = membershipRole(role);
  // Sets role + membership to fixed values, so it's safe to repeat after a transient failure.
  await withDbRetry(
    () =>
      db.$transaction([
        db.user.update({ where: { id: targetUserId }, data: { role } }),
        // Move semantics: drop memberships in any other team...
        db.teamMembership.deleteMany({ where: { userId: targetUserId, teamId: { not: teamId } } }),
        // ...and set (create or update) the membership in the chosen team.
        db.teamMembership.upsert({
          where: { userId_teamId: { userId: targetUserId, teamId } },
          create: { userId: targetUserId, teamId, role: memberRole },
          update: { role: memberRole },
        }),
      ]),
    { idempotent: true }
  );
}

// ── New sign-ups (accounts in no team yet) ─────────────

export type UnassignedSignup = {
  id: string;
  email: string;
  username: string;
  approved: boolean;
  createdAt: Date;
};

// Platform-level accounts span every team and are never "unassigned sign-ups".
const PLATFORM_ROLES: UserRole[] = ["SERVICE_ADMIN", "SUPERADMIN"];

/**
 * Accounts that belong to no team — self-service sign-ups waiting for a team
 * admin to approve them and bring them into a team (or reject them). Signing
 * up doesn't pick a team, so these are visible to every team admin; the first
 * to claim one adds it to their team.
 */
export async function listUnassignedSignups(): Promise<UnassignedSignup[]> {
  return db.user.findMany({
    where: { memberships: { none: {} }, role: { notIn: PLATFORM_ROLES } },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, username: true, approved: true, createdAt: true },
  });
}

export class SignupNotAvailableError extends Error {
  constructor() {
    super("That account is no longer waiting — another admin may have already handled it.");
  }
}

/** Throws unless the account still exists and is in no team (so a team admin may claim or reject it). */
async function assertUnassignedSignup(userId: string): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, _count: { select: { memberships: true } } },
  });
  if (!user || PLATFORM_ROLES.includes(user.role) || user._count.memberships > 0) {
    throw new SignupNotAvailableError();
  }
}

/**
 * Approves a new sign-up and adds it to the caller's team with the given role.
 * Only accounts still in no team can be claimed, so a team admin can never pull
 * in another team's member this way.
 */
export async function claimSignupForTeam(
  callerId: string,
  userId: string,
  teamId: string,
  role: UserRole
): Promise<void> {
  await assertUnassignedSignup(userId);
  await setUserTeamAndRole(callerId, userId, teamId, role);
  await db.user.update({ where: { id: userId }, data: { approved: true } });
}

/** Rejects a new sign-up by deleting the account — only while it's still in no team. */
export async function rejectSignup(callerId: string, userId: string): Promise<void> {
  await assertUnassignedSignup(userId);
  await deleteUserAsAdmin(callerId, userId);
}

/**
 * Removes a user from a team (deletes the membership) without deleting the
 * account. Used by a team admin to take someone off their team. If it was the
 * user's only team they'll have no team until reassigned.
 */
export async function removeUserFromTeam(teamId: string, userId: string): Promise<void> {
  await db.teamMembership.deleteMany({ where: { userId, teamId } });
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
  /** The team the user currently belongs to (their first membership), if any. */
  teamId: string | null;
  teamRole: UserRole | null;
};

export async function getUserForAdmin(id: string): Promise<AdminUserDetail | null> {
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      approved: true,
      createdAt: true,
      profileId: true,
      memberships: {
        select: { teamId: true, role: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });
  if (!user) return null;
  const primary = user.memberships[0] ?? null;
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    approved: user.approved,
    createdAt: user.createdAt,
    assignedProfileId: user.profileId,
    teamId: primary?.teamId ?? null,
    teamRole: primary?.role ?? null,
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
