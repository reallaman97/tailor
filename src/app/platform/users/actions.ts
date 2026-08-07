"use server";

import { revalidatePath } from "next/cache";
import { requireServiceAdmin } from "@/lib/auth/team-context";
import {
  createUserAsAdmin,
  setUserTeamAndRole,
  updateUserApproval,
  adminSetPassword,
  deleteUserAsAdmin,
  DuplicateUserError,
  CannotDemoteSelfError,
  CannotUnapproveSelfError,
} from "@/lib/admin/users";
import { createUserSchema, adminPasswordSchema } from "@/lib/admin/user-schemas";
import type { UserRole } from "@/generated/prisma/client";

export type PlatformUserFormState = { ok?: string; error?: string } | undefined;

const VALID_ROLES: UserRole[] = ["SERVICE_ADMIN", "TEAM_ADMIN", "MANAGER", "CALLER", "BIDDER"];

function revalidate() {
  revalidatePath("/platform/users");
  revalidatePath("/admin/users");
}

/** Service Admin creates a user directly in any team, with any role. */
export async function createPlatformUserAction(
  _prev: PlatformUserFormState,
  formData: FormData
): Promise<PlatformUserFormState> {
  await requireServiceAdmin();

  const teamId = String(formData.get("teamId") ?? "");
  if (!teamId) return { error: "Select a team." };

  const parsed = createUserSchema.safeParse({
    email: formData.get("email"),
    username: formData.get("username"),
    password: formData.get("password"),
    role: formData.get("role"),
    approved: formData.get("approved") === "true",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    await createUserAsAdmin(parsed.data, teamId);
  } catch (err) {
    if (err instanceof DuplicateUserError) return { error: err.message };
    throw err;
  }
  revalidate();
  return { ok: `Created ${parsed.data.email}.` };
}

/** Change a user's team and/or role (moves them to exactly the chosen team). */
export async function setUserTeamRoleAction(
  userId: string,
  teamId: string,
  role: string
): Promise<{ error?: string }> {
  const ctx = await requireServiceAdmin();
  if (!teamId) return { error: "Select a team." };
  if (!VALID_ROLES.includes(role as UserRole)) return { error: "Invalid role." };
  try {
    await setUserTeamAndRole(ctx.userId, userId, teamId, role as UserRole);
  } catch (err) {
    if (err instanceof CannotDemoteSelfError) return { error: err.message };
    throw err;
  }
  revalidate();
  return {};
}

/** Approve or unapprove (block) a user's ability to log in. */
export async function setApprovalAction(userId: string, approved: boolean): Promise<{ error?: string }> {
  const ctx = await requireServiceAdmin();
  try {
    await updateUserApproval(ctx.userId, userId, approved);
  } catch (err) {
    if (err instanceof CannotUnapproveSelfError) return { error: err.message };
    throw err;
  }
  revalidate();
  return {};
}

/** Set a new password for any user. */
export async function resetPasswordAction(
  userId: string,
  _prev: PlatformUserFormState,
  formData: FormData
): Promise<PlatformUserFormState> {
  await requireServiceAdmin();
  const parsed = adminPasswordSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid password" };
  await adminSetPassword(userId, parsed.data.password);
  return { ok: "Password reset." };
}

/** Permanently delete a user account (and its generated resumes). */
export async function deletePlatformUserAction(userId: string): Promise<void> {
  const ctx = await requireServiceAdmin();
  await deleteUserAsAdmin(ctx.userId, userId);
  revalidate();
}
