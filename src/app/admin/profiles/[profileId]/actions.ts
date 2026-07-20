"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth/require-user";
import {
  personalInfoSchema,
  workHistoryEntrySchema,
  educationEntrySchema,
  skillGroupSchema,
} from "@/lib/profile/schemas";
import { savePersonalInfo } from "@/lib/profile/personal-info";
import {
  createWorkHistoryEntry,
  updateWorkHistoryEntry,
  deleteWorkHistoryEntry,
} from "@/lib/profile/work-history";
import {
  createEducationEntry,
  updateEducationEntry,
  deleteEducationEntry,
} from "@/lib/profile/education";
import {
  createSkillGroup,
  updateSkillGroupSkills,
  renameSkillGroupCategory,
  deleteSkillGroup,
  DuplicateCategoryError,
} from "@/lib/profile/skills";

// All actions in this file edit a profile in the admin-managed pool —
// normal users can no longer edit profile fields at all, so every mutation
// here requires superadmin and takes an explicit profileId (bound from the
// /admin/profiles/[profileId] route) rather than "the caller".

export type ActionState = { error?: string; success?: boolean } | undefined;

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}

function formDataToObject(formData: FormData): Record<string, string> {
  return Object.fromEntries(formData.entries()) as Record<string, string>;
}

export async function savePersonalInfoAction(
  profileId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSuperAdmin();
  const parsed = personalInfoSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  await savePersonalInfo(profileId, parsed.data);
  revalidatePath(`/admin/profiles/${profileId}`);
  revalidatePath("/admin/profiles");
  revalidatePath("/admin/users");
  return { success: true };
}

export async function createWorkHistoryAction(
  profileId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSuperAdmin();
  const parsed = workHistoryEntrySchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  await createWorkHistoryEntry(profileId, parsed.data);
  revalidatePath(`/admin/profiles/${profileId}`);
  return { success: true };
}

export async function updateWorkHistoryAction(
  profileId: string,
  entryId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSuperAdmin();
  const parsed = workHistoryEntrySchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  await updateWorkHistoryEntry(profileId, entryId, parsed.data);
  revalidatePath(`/admin/profiles/${profileId}`);
  return { success: true };
}

export async function deleteWorkHistoryAction(profileId: string, entryId: string): Promise<void> {
  await requireSuperAdmin();
  await deleteWorkHistoryEntry(profileId, entryId);
  revalidatePath(`/admin/profiles/${profileId}`);
}

export async function createEducationAction(
  profileId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSuperAdmin();
  const parsed = educationEntrySchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  await createEducationEntry(profileId, parsed.data);
  revalidatePath(`/admin/profiles/${profileId}`);
  return { success: true };
}

export async function updateEducationAction(
  profileId: string,
  entryId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSuperAdmin();
  const parsed = educationEntrySchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  await updateEducationEntry(profileId, entryId, parsed.data);
  revalidatePath(`/admin/profiles/${profileId}`);
  return { success: true };
}

export async function deleteEducationAction(profileId: string, entryId: string): Promise<void> {
  await requireSuperAdmin();
  await deleteEducationEntry(profileId, entryId);
  revalidatePath(`/admin/profiles/${profileId}`);
}

export async function createSkillGroupAction(
  profileId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSuperAdmin();
  const parsed = skillGroupSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  try {
    await createSkillGroup(profileId, parsed.data);
  } catch (err) {
    if (err instanceof DuplicateCategoryError) return { error: err.message };
    throw err;
  }
  revalidatePath(`/admin/profiles/${profileId}`);
  return { success: true };
}

/** originalCategory is the category name this form last rendered with — if the
 * submitted name differs, the category is renamed before its skills are saved. */
export async function saveSkillGroupAction(
  profileId: string,
  originalCategory: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireSuperAdmin();
  const parsed = skillGroupSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  try {
    if (parsed.data.category !== originalCategory) {
      await renameSkillGroupCategory(profileId, originalCategory, parsed.data.category);
    }
    await updateSkillGroupSkills(profileId, parsed.data.category, parsed.data.skills);
  } catch (err) {
    if (err instanceof DuplicateCategoryError) return { error: err.message };
    throw err;
  }
  revalidatePath(`/admin/profiles/${profileId}`);
  return { success: true };
}

export async function deleteSkillGroupAction(profileId: string, category: string): Promise<void> {
  await requireSuperAdmin();
  await deleteSkillGroup(profileId, category);
  revalidatePath(`/admin/profiles/${profileId}`);
}
