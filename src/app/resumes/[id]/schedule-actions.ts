"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/require-user";
import { createInterview, getApplicationPrefill, InvalidCallerError } from "@/lib/interview/interviews";
import { createInterviewSchema, metaFromFormData } from "@/lib/interview/schemas";
import { datetimeLocalToUtc } from "@/lib/interview/timezone";
import { getInterviewTimezone } from "@/lib/settings";

export type ScheduleState = { error?: string; interviewId?: string } | undefined;

/**
 * Creates an Interview linked to an application from the Applications tracker.
 * Job title / company / description / candidate profile and the tailored resume
 * are pulled from the application (via createInterview's applicationId handling);
 * the form only supplies interview-specific fields (time, interviewer, meeting).
 * Superadmin-only — the tracker's status controls are already superadmin-gated,
 * and a superadmin may create interviews.
 */
export async function scheduleInterviewFromApplicationAction(
  applicationId: string,
  _prev: ScheduleState,
  formData: FormData
): Promise<ScheduleState> {
  const admin = await requireSuperAdmin();

  const prefill = await getApplicationPrefill(applicationId);
  if (!prefill) return { error: "Application not found" };

  const parsed = createInterviewSchema.safeParse({
    ...Object.fromEntries(formData.entries()),
    jobTitle: prefill.jobTitle,
    companyName: prefill.companyName,
    jobDescription: prefill.jobDescription,
    jobPostLink: prefill.jobPostLink ?? "",
    applicationId,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const timezone = await getInterviewTimezone();
  const scheduledAt = datetimeLocalToUtc(parsed.data.scheduledAt, timezone);
  const meta = metaFromFormData(formData);

  let interviewId: string;
  try {
    interviewId = await createInterview(admin.id, {
      ...parsed.data,
      scheduledAt,
      meta,
      applicationId,
      profileId: parsed.data.profileId || undefined,
    });
  } catch (err) {
    if (err instanceof InvalidCallerError) return { error: err.message };
    throw err;
  }

  revalidatePath(`/resumes/${applicationId}`);
  revalidatePath("/interview");
  revalidatePath("/interview/list");
  return { interviewId };
}
