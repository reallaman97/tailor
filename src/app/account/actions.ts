"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import {
  updateUsername,
  changePassword,
  UsernameTakenError,
  IncorrectPasswordError,
} from "@/lib/profile/account";
import { usernameSchema, changePasswordSchema } from "@/lib/auth/schemas";

export type UsernameActionState = { error?: string; success?: boolean } | undefined;

export async function updateUsernameAction(
  _prevState: UsernameActionState,
  formData: FormData
): Promise<UsernameActionState> {
  const user = await requireUser();

  const parsed = usernameSchema.safeParse(formData.get("username"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid username" };
  }

  try {
    await updateUsername(user.id, parsed.data);
  } catch (err) {
    if (err instanceof UsernameTakenError) return { error: err.message };
    throw err;
  }

  revalidatePath("/account");
  return { success: true };
}

export type PasswordActionState = { error?: string; success?: boolean } | undefined;

export async function changePasswordAction(
  _prevState: PasswordActionState,
  formData: FormData
): Promise<PasswordActionState> {
  const user = await requireUser();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmNewPassword: formData.get("confirmNewPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await changePassword(user.id, parsed.data.currentPassword, parsed.data.newPassword);
  } catch (err) {
    if (err instanceof IncorrectPasswordError) return { error: err.message };
    throw err;
  }

  return { success: true };
}
