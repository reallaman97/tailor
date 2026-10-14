"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/require-user";
import { setTrackerStage, deleteTrackerNote, TRACKER_STAGES } from "@/lib/interview-tracker/tracker";
import type { ResumeStatus } from "@/generated/prisma/client";

function revalidate(resumeId: string) {
  revalidatePath("/interview-tracker");
  revalidatePath(`/interview-tracker/${resumeId}`);
  revalidatePath(`/resumes/${resumeId}`);
  revalidatePath("/resumes");
}

/** Moves an application to an interview stage — this is also how one starts being tracked. */
export async function setTrackerStageAction(resumeId: string, stage: string): Promise<{ error?: string }> {
  await requireSuperAdmin();
  if (!TRACKER_STAGES.includes(stage as ResumeStatus)) return { error: "Choose an interview stage." };
  await setTrackerStage(resumeId, stage as ResumeStatus);
  revalidate(resumeId);
  return {};
}

/** Form action for ConfirmDialog. */
export async function deleteTrackerNoteAction(noteId: string): Promise<void> {
  await requireSuperAdmin();
  const resumeId = await deleteTrackerNote(noteId);
  if (resumeId) revalidate(resumeId);
}
