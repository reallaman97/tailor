"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
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
import { saveSkillGroup } from "@/lib/profile/skills";
import { deleteAccount } from "@/lib/profile/account";
import { signOut } from "@/auth";

export type ActionState = { error?: string; success?: boolean } | undefined;

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}

function formDataToObject(formData: FormData): Record<string, string> {
  return Object.fromEntries(formData.entries()) as Record<string, string>;
}

export async function savePersonalInfoAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = personalInfoSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  await savePersonalInfo(user.id, parsed.data);
  revalidatePath("/profile");
  return { success: true };
}

export async function createWorkHistoryAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = workHistoryEntrySchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  await createWorkHistoryEntry(user.id, parsed.data);
  revalidatePath("/profile");
  return { success: true };
}

export async function updateWorkHistoryAction(
  entryId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = workHistoryEntrySchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  await updateWorkHistoryEntry(user.id, entryId, parsed.data);
  revalidatePath("/profile");
  return { success: true };
}

export async function deleteWorkHistoryAction(entryId: string): Promise<void> {
  const user = await requireUser();
  await deleteWorkHistoryEntry(user.id, entryId);
  revalidatePath("/profile");
}

export async function createEducationAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = educationEntrySchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  await createEducationEntry(user.id, parsed.data);
  revalidatePath("/profile");
  return { success: true };
}

export async function updateEducationAction(
  entryId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = educationEntrySchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  await updateEducationEntry(user.id, entryId, parsed.data);
  revalidatePath("/profile");
  return { success: true };
}

export async function deleteEducationAction(entryId: string): Promise<void> {
  const user = await requireUser();
  await deleteEducationEntry(user.id, entryId);
  revalidatePath("/profile");
}

export async function saveSkillGroupAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = skillGroupSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  await saveSkillGroup(user.id, parsed.data);
  revalidatePath("/profile");
  return { success: true };
}

const deleteAccountSchema = z.object({
  confirmation: z.literal("DELETE", { message: 'Type "DELETE" to confirm' }),
});

export async function deleteAccountAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = deleteAccountSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  await deleteAccount(user.id);
  await signOut({ redirectTo: "/" });
}
