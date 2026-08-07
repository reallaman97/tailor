"use server";

import { revalidatePath } from "next/cache";
import { requireTeamAdmin } from "@/lib/auth/team-context";
import {
  createUserAsAdmin,
  updateUserRole,
  updateUserApproval,
  adminSetPassword,
  removeUserFromTeam,
  DuplicateUserError,
  CannotDemoteSelfError,
  CannotUnapproveSelfError,
} from "@/lib/admin/users";
import { createUserSchema, adminPasswordSchema } from "@/lib/admin/user-schemas";
import type { UserRole } from "@/generated/prisma/client";

export type TeamUserFormState = { ok?: string; error?: string } | undefined;

// A team admin manages roles within their team only — never SERVICE_ADMIN.
const TEAM_ROLES: UserRole[] = ["TEAM_ADMIN", "MANAGER", "CALLER", "BIDDER"];

function revalidate() {
  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

/** Create a user directly into the admin's team. */
export async function createTeamUserAction(
  _prev: TeamUserFormState,
  formData: FormData
): Promise<TeamUserFormState> {
  const admin = await requireTeamAdmin();
  if (!admin.activeTeamId) return { error: "No active team." };

  const parsed = createUserSchema.safeParse({
    email: formData.get("email"),
    username: formData.get("username"),
    password: formData.get("password"),
    role: formData.get("role"),
    approved: formData.get("approved") === "true",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  if (!TEAM_ROLES.includes(parsed.data.role)) return { error: "Invalid role for a team." };

  try {
    await createUserAsAdmin(parsed.data, admin.activeTeamId);
  } catch (err) {
    if (err instanceof DuplicateUserError) return { error: err.message };
    throw err;
  }
  revalidate();
  return { ok: `Created ${parsed.data.email}.` };
}

/** Change a member's role within the team. */
export async function setTeamUserRoleAction(userId: string, role: string): Promise<{ error?: string }> {
  const admin = await requireTeamAdmin();
  if (!admin.activeTeamId) return { error: "No active team." };
  if (!TEAM_ROLES.includes(role as UserRole)) return { error: "Invalid role." };
  try {
    await updateUserRole(admin.userId, userId, role as UserRole, admin.activeTeamId);
  } catch (err) {
    if (err instanceof CannotDemoteSelfError) return { error: err.message };
    throw err;
  }
  revalidate();
  return {};
}

/** Approve or block a member's sign-in. */
export async function setTeamApprovalAction(userId: string, approved: boolean): Promise<{ error?: string }> {
  const admin = await requireTeamAdmin();
  try {
    await updateUserApproval(admin.userId, userId, approved);
  } catch (err) {
    if (err instanceof CannotUnapproveSelfError) return { error: err.message };
    throw err;
  }
  revalidate();
  return {};
}

/** Set a new password for a team member. */
export async function resetTeamPasswordAction(
  userId: string,
  _prev: TeamUserFormState,
  formData: FormData
): Promise<TeamUserFormState> {
  await requireTeamAdmin();
  const parsed = adminPasswordSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid password" };
  await adminSetPassword(userId, parsed.data.password);
  return { ok: "Password reset." };
}

/** Remove a member from the team (keeps their account). Form action for ConfirmDialog. */
export async function removeFromTeamAction(userId: string): Promise<void> {
  const admin = await requireTeamAdmin();
  if (!admin.activeTeamId) return;
  if (admin.userId === userId) return; // the UI never offers this on your own row
  await removeUserFromTeam(admin.activeTeamId, userId);
  revalidate();
}
