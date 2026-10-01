"use server";

import { requireResumePlatformAccess } from "@/lib/auth/require-user";
import { hasTeamAdminPower } from "@/lib/auth/roles";
import { getAssignedProfileId } from "@/lib/profile/shared";
import { findDuplicateApplication, duplicateScope, duplicateMessage, type DuplicateReason } from "@/lib/resumes/resumes";

export type DuplicateCheckResult = {
  duplicate?: { id: string; companyName: string; jobTitle: string; reason: DuplicateReason; message: string };
};

/**
 * The builder form's pre-check (no AI involved): would this job be a duplicate
 * for the candidate? The same check runs again server-side when building, so
 * this only exists to warn before the user clicks Build.
 */
export async function checkDuplicateAction(input: {
  companyName: string;
  jobLink: string;
  jobDescription: string;
  /** Admins building on behalf of a profile pass it; bidders always use their own. */
  profileId?: string;
}): Promise<DuplicateCheckResult> {
  const user = await requireResumePlatformAccess();
  const profileId = hasTeamAdminPower(user.role) && input.profileId ? input.profileId : await getAssignedProfileId(user.id);

  const hit = await findDuplicateApplication(duplicateScope(user.id, profileId), {
    companyName: input.companyName.slice(0, 200),
    jobLink: input.jobLink.slice(0, 2000),
    jobDescription: input.jobDescription.slice(0, 20_000),
  });
  if (!hit) return {};
  return { duplicate: { ...hit.existing, reason: hit.reason, message: duplicateMessage(hit.existing, hit.reason) } };
}
