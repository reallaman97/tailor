"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireInterviewManager } from "@/lib/auth/require-user";
import { duplicateInterview, softDeleteInterview, InterviewNotFoundError } from "@/lib/interview/interviews";

function revalidate() {
  revalidatePath("/interview/list");
  revalidatePath("/interview");
}

/** Duplicate an interview and open the copy so it can be adjusted immediately. */
export async function duplicateInterviewAction(id: string): Promise<void> {
  const manager = await requireInterviewManager();
  const newId = await duplicateInterview(manager.id, id);
  revalidate();
  redirect(`/interview/${newId}`);
}

/** Soft-delete from the list (stays on the list; the row disappears on revalidation). */
export async function deleteInterviewAction(id: string): Promise<void> {
  await requireInterviewManager();
  try {
    await softDeleteInterview(id);
  } catch (err) {
    if (!(err instanceof InterviewNotFoundError)) throw err;
  }
  revalidate();
}
