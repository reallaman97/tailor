import { z } from "zod";
import { emailSchema, usernameSchema, passwordSchema } from "@/lib/auth/schemas";

// Assignable roles under the multi-tenant model. Legacy SUPERADMIN is still
// accepted (existing accounts) but is no longer offered in the UI.
const roleSchema = z.enum(["SERVICE_ADMIN", "TEAM_ADMIN", "MANAGER", "CALLER", "BIDDER", "SUPERADMIN"]);

/** Superadmin creating an account directly (no email verification / self-signup flow). */
export const createUserSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  password: passwordSchema,
  role: roleSchema,
  approved: z.boolean(),
});

/** Editing an existing account: identity, team + role, and approval in one form. */
export const editUserSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  role: roleSchema,
  // Which team the user belongs to (service-admin only can change it). Optional
  // so team admins editing within their own team can omit it.
  teamId: z.string().min(1).optional(),
  approved: z.boolean(),
});

/** Admin-set new password (no current-password check — this is a reset). */
export const adminPasswordSchema = z.object({
  password: passwordSchema,
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type EditUserInput = z.infer<typeof editUserSchema>;
