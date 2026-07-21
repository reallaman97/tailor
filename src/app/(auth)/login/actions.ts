"use server";

import { AuthError } from "next-auth";
import { signIn, AccountPendingApprovalError } from "@/auth";
import { loginSchema } from "@/lib/auth/schemas";

export type LoginState = { error?: string } | undefined;

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/",
    });
  } catch (err) {
    if (err instanceof AccountPendingApprovalError) {
      return { error: "Your account is pending approval. You'll be able to log in once a superadmin approves it." };
    }
    if (err instanceof AuthError) {
      return { error: "Invalid email or password" };
    }
    throw err;
  }
}
