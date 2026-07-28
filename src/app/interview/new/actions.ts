"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireInterviewManager } from "@/lib/auth/require-user";
import { createInterview, InvalidCallerError } from "@/lib/interview/interviews";
import { createInterviewSchema, metaFromFormData } from "@/lib/interview/schemas";
import { datetimeLocalToUtc } from "@/lib/interview/timezone";
import { getInterviewTimezone } from "@/lib/settings";
import { readInterviewValues, type NewInterviewState } from "@/app/interview/shared";

export async function createInterviewAction(
  _prev: NewInterviewState,
  formData: FormData
): Promise<NewInterviewState> {
  const manager = await requireInterviewManager();

  const parsed = createInterviewSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input", values: readInterviewValues(formData) };
  }

  const timezone = await getInterviewTimezone();
  const scheduledAt = datetimeLocalToUtc(parsed.data.scheduledAt, timezone);
  const meta = metaFromFormData(formData);

  let interviewId: string;
  try {
    interviewId = await createInterview(manager.id, {
      ...parsed.data,
      scheduledAt,
      meta,
      applicationId: parsed.data.applicationId || undefined,
    });
  } catch (err) {
    if (err instanceof InvalidCallerError) {
      return { error: err.message, values: readInterviewValues(formData) };
    }
    throw err;
  }

  revalidatePath("/interview");
  revalidatePath("/interview/list");
  redirect(`/interview/${interviewId}`);
}
