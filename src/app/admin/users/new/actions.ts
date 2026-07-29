"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/require-user";
import { createUserAsAdmin, DuplicateUserError } from "@/lib/admin/users";
import { createUserSchema } from "@/lib/admin/user-schemas";

export type CreateUserValues = { email: string; username: string; role: string; approved: boolean };
export type CreateUserState = { error?: string; values?: CreateUserValues } | undefined;

function readValues(formData: FormData): CreateUserValues {
  return {
    email: String(formData.get("email") ?? ""),
    username: String(formData.get("username") ?? ""),
    role: String(formData.get("role") ?? "BIDDER"),
    approved: formData.get("approved") === "true",
  };
}

export async function createUserAction(_prev: CreateUserState, formData: FormData): Promise<CreateUserState> {
  await requireSuperAdmin();

  const parsed = createUserSchema.safeParse({
    email: formData.get("email"),
    username: formData.get("username"),
    password: formData.get("password"),
    role: formData.get("role"),
    approved: formData.get("approved") === "true",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input", values: readValues(formData) };
  }

  try {
    await createUserAsAdmin(parsed.data);
  } catch (err) {
    if (err instanceof DuplicateUserError) return { error: err.message, values: readValues(formData) };
    throw err;
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  redirect("/admin/users");
}
