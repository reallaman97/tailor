"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/require-user";
import { requireTeamAdmin } from "@/lib/auth/team-context";
import { hasTeamAdminPower } from "@/lib/auth/roles";
import {
  updateUserAsAdmin,
  adminSetPassword,
  updateUserRole,
  updateUserApproval,
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
    approved: formData.get("approved") === "true",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { email, username, role, approved } = parsed.data;

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
  await updateUserRole(adminId, userId, role, admin.activeTeamId ?? undefined);
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
