"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/require-user";
import {
  updateResumeStatusSchema,
  applicationSourceSchema,
  resumeStatusSchema,
  approvalStatusSchema,
} from "@/lib/resumes/schemas";
import {
  setApplicationStatus,
  addStatusToApplications,
  setApplicationSource,
  setApplicationApproval,
  setApplicationsApproval,
  deleteApplication,
  deleteApplications,
} from "@/lib/admin/applications";

function revalidateTracker(resumeId?: string) {
  revalidatePath("/resumes");
  if (resumeId) revalidatePath(`/resumes/${resumeId}`);
  revalidatePath("/dashboard");
}

/** Only a superadmin may change an application's status set — for any user, not just their own. Replaces the whole set. */
export async function updateResumeStatusAction(resumeId: string, statuses: string[]): Promise<void> {
  await requireSuperAdmin();

  const parsed = updateResumeStatusSchema.safeParse({ statuses });
  if (!parsed.success) return;

  await setApplicationStatus(resumeId, parsed.data.statuses);
  revalidateTracker(resumeId);
}

/** Bulk action over a superadmin's multi-selected rows — ADDS one status to each row's existing set. */
export async function bulkUpdateResumeStatusAction(resumeIds: string[], status: string): Promise<void> {
  await requireSuperAdmin();

  const parsed = resumeStatusSchema.safeParse(status);
  if (!parsed.success || resumeIds.length === 0) return;

  await addStatusToApplications(resumeIds, parsed.data);
  revalidateTracker();
}

/** Only a superadmin may change an application's approval status — inline, from the tracker table, like source. */
export async function updateResumeApprovalAction(resumeId: string, approvalStatus: string): Promise<void> {
  await requireSuperAdmin();

  const parsed = approvalStatusSchema.safeParse(approvalStatus);
  if (!parsed.success) return;

  await setApplicationApproval(resumeId, parsed.data);
  revalidateTracker(resumeId);
  revalidatePath("/admin/users");
}

/** Bulk approve/reject over a superadmin's multi-selected rows in the tracker table. */
export async function bulkUpdateResumeApprovalAction(
  resumeIds: string[],
  approvalStatus: "APPROVED" | "REJECTED"
): Promise<void> {
  await requireSuperAdmin();
  if (resumeIds.length === 0) return;

  await setApplicationsApproval(resumeIds, approvalStatus);
  revalidateTracker();
  revalidatePath("/admin/users");
}

/** Only a superadmin may change an application's source — inline, from the tracker table. */
export async function updateResumeSourceAction(resumeId: string, source: string): Promise<void> {
  await requireSuperAdmin();

  const parsed = applicationSourceSchema.safeParse(source);
  if (!parsed.success) return;

  await setApplicationSource(resumeId, parsed.data);
  revalidateTracker(resumeId);
}

/** Only a superadmin may remove an application record — normal users cannot delete their own. */
export async function deleteResumeAction(resumeId: string): Promise<void> {
  await requireSuperAdmin();
  await deleteApplication(resumeId);
  revalidatePath("/resumes");
  revalidatePath("/dashboard");
}

/** Bulk delete over a superadmin's multi-selected rows in the tracker table. */
export async function bulkDeleteResumesAction(resumeIds: string[]): Promise<void> {
  await requireSuperAdmin();
  if (resumeIds.length === 0) return;

  await deleteApplications(resumeIds);
  revalidatePath("/resumes");
  revalidatePath("/dashboard");
}
