import { z } from "zod";
import { emailSchema, usernameSchema, passwordSchema } from "@/lib/auth/schemas";

const roleSchema = z.enum(["SUPERADMIN", "BIDDER", "CALLER", "MANAGER"]);

/** Superadmin creating an account directly (no email verification / self-signup flow). */
export const createUserSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  password: passwordSchema,
  role: roleSchema,
  approved: z.boolean(),
});

/** Editing an existing account: identity plus role/approval in one form. */
export const editUserSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  role: roleSchema,
  approved: z.boolean(),
});

/** Admin-set new password (no current-password check — this is a reset). */
export const adminPasswordSchema = z.object({
  password: passwordSchema,
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type EditUserInput = z.infer<typeof editUserSchema>;
