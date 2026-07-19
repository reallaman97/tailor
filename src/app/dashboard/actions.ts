"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { updateResumeStatusSchema } from "@/lib/resumes/schemas";
import { updateResumeStatus, deleteResume } from "@/lib/resumes/resumes";

export async function updateResumeStatusAction(resumeId: string, status: string): Promise<void> {
  const user = await requireUser();

  const parsed = updateResumeStatusSchema.safeParse({ status });
  if (!parsed.success) return;

  await updateResumeStatus(user.id, resumeId, parsed.data.status);
  revalidatePath("/dashboard");
}

export async function deleteResumeAction(resumeId: string): Promise<void> {
  const user = await requireUser();
  await deleteResume(user.id, resumeId);
  revalidatePath("/dashboard");
}
