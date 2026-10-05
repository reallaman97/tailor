"use server";

import { requireSuperAdmin } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { createResumeSchema, applicationSourceSchema } from "@/lib/resumes/schemas";
import { createResume, DuplicateApplicationError } from "@/lib/resumes/resumes";
import type { CreateApplicationResult } from "./shared";

/**
 * A superadmin building on behalf of a candidate: they pick which profile to
 * tailor for (not a specific user account — several accounts can share one
 * profile), and choose the source explicitly rather than it defaulting to
 * Job Board. The resulting application is attributed to that profile's
 * earliest-registered assigned account, so it shows up in the shared
 * tracker rather than the superadmin's own. Creates the application only; the
 * page then builds it via /api/resumes/[id]/build.
 */
export async function createResumeAsAdminAction(formData: FormData): Promise<CreateApplicationResult> {
  await requireSuperAdmin();

  const profileId = formData.get("profileId");
  if (typeof profileId !== "string" || profileId.trim() === "") {
    return { error: "Select a profile to build this resume for" };
  }

  const sourceParsed = applicationSourceSchema.safeParse(formData.get("source"));
  if (!sourceParsed.success) return { error: "Select a source" };

  const parsed = createResumeSchema.safeParse({
    jobLink: formData.get("jobLink"),
    companyName: formData.get("companyName"),
    jobTitle: formData.get("jobTitle"),
    jobDescription: formData.get("jobDescription"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const targetUser = await db.user.findFirst({
    where: { profileId },
    orderBy: { email: "asc" },
    select: { id: true },
  });
  if (!targetUser) return { error: "That profile has no assigned account to build for" };

  // The duplicate check inside createResume runs before ANY AI call, so a duplicate costs nothing.
  try {
    const createdId = await createResume(targetUser.id, {
      ...parsed.data,
      roleTrack: "OTHER", // classified during the build
      source: sourceParsed.data,
      status: "APPLIED",
    });
    return { createdId };
  } catch (err) {
    if (err instanceof DuplicateApplicationError) return { error: err.message, duplicateId: err.existing.id };
    throw err;
  }
}
