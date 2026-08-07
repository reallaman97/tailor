"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/require-user";
import { requireTeamAdmin } from "@/lib/auth/team-context";
import { hasTeamAdminPower } from "@/lib/auth/roles";
import {
  updateUserAsAdmin,
  setUserTeamAndRole,
  updateUserApproval,
  adminSetPassword,
  deleteUserAsAdmin,
  DuplicateUserError,
} from "@/lib/admin/users";
import { editUserSchema, adminPasswordSchema } from "@/lib/admin/user-schemas";

export type EditUserState = { error?: string; success?: boolean } | undefined;

function revalidate(userId: string) {
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

export async function editUserAction(userId: string, _prev: EditUserState, formData: FormData): Promise<EditUserState> {
  const admin = await requireTeamAdmin();
  const adminId = admin.userId;

  const parsed = editUserSchema.safeParse({
    email: formData.get("email"),
    username: formData.get("username"),
    role: formData.get("role"),
    teamId: formData.get("teamId") || undefined,
    approved: formData.get("approved") === "true",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { email, username, role, teamId, approved } = parsed.data;

  // Only a service admin may grant the platform SERVICE_ADMIN role or move a
  // user to an arbitrary team; a team admin acts within their own active team.
  if (role === "SERVICE_ADMIN" && !admin.isServiceAdmin) {
    return { error: "Only a Service Admin can grant the Service Admin role." };
  }
  const targetTeamId =
    admin.isServiceAdmin && teamId
      ? admin.teams.some((t) => t.id === teamId)
        ? teamId
        : null
      : admin.activeTeamId;
  if (!targetTeamId) {
    return { error: "Select a team for this user." };
  }

  // Guard self-lockout up front so no partial update happens.
  if (userId === adminId && !hasTeamAdminPower(role)) {
    return { error: "You can't remove your own admin access." };
  }
  if (userId === adminId && !approved) {
    return { error: "You can't revoke your own approval." };
  }

  try {
    await updateUserAsAdmin(userId, { email, username });
  } catch (err) {
    if (err instanceof DuplicateUserError) return { error: err.message };
    throw err;
  }
  await setUserTeamAndRole(adminId, userId, targetTeamId, role);
  await updateUserApproval(adminId, userId, approved);

  revalidate(userId);
  return { success: true };
}

export async function resetPasswordAction(userId: string, _prev: EditUserState, formData: FormData): Promise<EditUserState> {
  await requireSuperAdmin();

  const parsed = adminPasswordSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid password" };

  await adminSetPassword(userId, parsed.data.password);
  return { success: true };
}

/** Delete from the edit page, then return to the list (unlike the list's inline delete). */
export async function deleteUserFromEditAction(userId: string): Promise<void> {
  const admin = await requireSuperAdmin();
  await deleteUserAsAdmin(admin.id, userId);
  revalidatePath("/admin/users");
  revalidatePath("/admin");
  redirect("/admin/users");
}
