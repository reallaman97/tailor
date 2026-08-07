"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/require-user";
import { requireTeamAdmin } from "@/lib/auth/team-context";
import {
  updateUserRole,
  CannotDemoteSelfError,
  deleteUserAsAdmin,
  updateUserApproval,
  CannotUnapproveSelfError,
} from "@/lib/admin/users";
import { assignProfileToUser, unassignUser } from "@/lib/admin/profiles";
import type { UserRole } from "@/generated/prisma/client";

export type RoleActionState = { error?: string } | undefined;

export async function updateUserRoleAction(
  targetUserId: string,
  _prevState: RoleActionState,
  formData: FormData
): Promise<RoleActionState> {
  const admin = await requireTeamAdmin();

  const role = formData.get("role");
  if (role !== "SUPERADMIN" && role !== "BIDDER" && role !== "CALLER" && role !== "MANAGER") {
    return { error: "Invalid role" };
  }

  try {
    await updateUserRole(admin.userId, targetUserId, role as UserRole, admin.activeTeamId ?? undefined);
  } catch (err) {
    if (err instanceof CannotDemoteSelfError) return { error: err.message };
    throw err;
  }

  revalidatePath("/admin/users");
}

// The UI never renders a delete control for the admin's own row, so
// CannotDeleteSelfError should only ever fire if that's bypassed somehow —
// treated as a defense-in-depth failure, not one we build a friendly inline
// message for (matches how other last-resort guards are handled elsewhere).
export async function deleteUserAction(targetUserId: string): Promise<void> {
  const admin = await requireSuperAdmin();
  await deleteUserAsAdmin(admin.id, targetUserId);
  revalidatePath("/admin/users");
}

/** Lets a superadmin assign (or unassign) a user's profile directly from the Users table — the reverse of AssignedUsersManager on the profile's own page. */
export async function updateUserProfileAction(targetUserId: string, profileId: string): Promise<void> {
  await requireSuperAdmin();

  if (profileId) {
    await assignProfileToUser(profileId, targetUserId);
  } else {
    await unassignUser(targetUserId);
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin/profiles");
  if (profileId) revalidatePath(`/admin/profiles/${profileId}`);
}

export type ApprovalActionState = { error?: string } | undefined;

export async function updateUserApprovalAction(
  targetUserId: string,
  _prevState: ApprovalActionState,
  formData: FormData
): Promise<ApprovalActionState> {
  const admin = await requireSuperAdmin();

  const approved = formData.get("approved") === "true";

  try {
    await updateUserApproval(admin.id, targetUserId, approved);
  } catch (err) {
    if (err instanceof CannotUnapproveSelfError) return { error: err.message };
    throw err;
  }

  revalidatePath("/admin/users");
}
