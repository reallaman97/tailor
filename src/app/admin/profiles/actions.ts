"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth/require-user";
import { requireTeamAdmin } from "@/lib/auth/team-context";
import { personalInfoSchema } from "@/lib/profile/schemas";
import {
  createProfile,
  deleteProfile,
  assignProfileToUser,
  unassignUser,
} from "@/lib/admin/profiles";

export type CreateProfileState = { error?: string } | undefined;

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}

function formDataToObject(formData: FormData): Record<string, string> {
  return Object.fromEntries(formData.entries()) as Record<string, string>;
}

export async function createProfileAction(
  _prevState: CreateProfileState,
  formData: FormData
): Promise<CreateProfileState> {
  const ctx = await requireTeamAdmin();
  const parsed = personalInfoSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const profileId = await createProfile(parsed.data, ctx.activeTeamId ?? undefined);
  revalidatePath("/admin/profiles");
  redirect(`/admin/profiles/${profileId}`);
}

export async function deleteProfileAction(profileId: string): Promise<void> {
  await requireSuperAdmin();
  await deleteProfile(profileId);
  revalidatePath("/admin/profiles");
  revalidatePath("/admin/users");
}

/** Adds another account to this profile — a profile may be shared by any number of accounts. */
export async function addUserToProfileAction(profileId: string, formData: FormData): Promise<void> {
  await requireSuperAdmin();

  const raw = formData.get("userId");
  const userId = typeof raw === "string" && raw.length > 0 ? raw : null;
  if (userId) await assignProfileToUser(profileId, userId);

  revalidatePath(`/admin/profiles/${profileId}`);
  revalidatePath("/admin/profiles");
  revalidatePath("/admin/users");
}

export async function removeUserFromProfileAction(profileId: string, userId: string): Promise<void> {
  await requireSuperAdmin();
  await unassignUser(userId);

  revalidatePath(`/admin/profiles/${profileId}`);
  revalidatePath("/admin/profiles");
  revalidatePath("/admin/users");
}
