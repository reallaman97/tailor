"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { createResumeSchema } from "@/lib/resumes/schemas";
import { createResume } from "@/lib/resumes/resumes";

export type NewResumeState = { error?: string } | undefined;

export async function createResumeAction(
  _prevState: NewResumeState,
  formData: FormData
): Promise<NewResumeState> {
  const user = await requireUser();

  const parsed = createResumeSchema.safeParse({
    jobLink: formData.get("jobLink"),
    companyName: formData.get("companyName"),
    jobTitle: formData.get("jobTitle"),
    jobDescription: formData.get("jobDescription"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await createResume(user.id, parsed.data);
  redirect("/dashboard");
}
