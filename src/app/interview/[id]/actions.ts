"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireInterviewAccess, requireInterviewManager } from "@/lib/auth/require-user";
import {
  updateInterview,
  softDeleteInterview,
  assignCaller,
  updateStatus,
  addComment,
  addReferenceFile,
  deleteReferenceFile,
  setResumeFile,
  InterviewNotFoundError,
  InvalidCallerError,
  InvalidFileError,
} from "@/lib/interview/interviews";
import { updateInterviewSchema, commentSchema, metaFromFormData } from "@/lib/interview/schemas";
import { datetimeLocalToUtc } from "@/lib/interview/timezone";
import { getInterviewTimezone } from "@/lib/settings";
import type { EditInterviewState } from "@/app/interview/shared";

export type CommentState = { error?: string; success?: boolean } | undefined;
export type FileUploadState = { error?: string; success?: boolean } | undefined;
type Result = { error?: string };

function revalidateDetail(id: string) {
  revalidatePath(`/interview/${id}`);
  revalidatePath("/interview");
  revalidatePath("/interview/list");
}

// ── Edit core fields (manager) ─────────────────────────

export async function updateInterviewAction(
  id: string,
  _prev: EditInterviewState,
  formData: FormData
): Promise<EditInterviewState> {
  await requireInterviewManager();

  const parsed = updateInterviewSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const timezone = await getInterviewTimezone();
  const scheduledAt = datetimeLocalToUtc(parsed.data.scheduledAt, timezone);
  const meta = metaFromFormData(formData);

  try {
    await updateInterview(id, { ...parsed.data, scheduledAt, meta });
  } catch (err) {
    if (err instanceof InvalidCallerError) return { error: err.message };
    if (err instanceof InterviewNotFoundError) return { error: "Interview not found" };
    throw err;
  }

  revalidateDetail(id);
  return { success: true };
}

// ── Delete (manager) ───────────────────────────────────

export async function deleteInterviewAction(id: string): Promise<void> {
  await requireInterviewManager();
  await softDeleteInterview(id);
  revalidatePath("/interview");
  revalidatePath("/interview/list");
  redirect("/interview/list");
}

// ── Inline status (caller-or-manager) ──────────────────

export async function setStatusAction(id: string, statusId: string): Promise<Result> {
  const access = await requireInterviewAccess();
  try {
    await updateStatus(access, id, statusId || null);
  } catch (err) {
    if (err instanceof InterviewNotFoundError) return { error: "You can't update this interview" };
    throw err;
  }
  revalidateDetail(id);
  return {};
}

// ── Assign caller (manager) ────────────────────────────

export async function assignCallerAction(id: string, callerId: string): Promise<Result> {
  await requireInterviewManager();
  try {
    await assignCaller(id, callerId || null);
  } catch (err) {
    if (err instanceof InvalidCallerError) return { error: err.message };
    if (err instanceof InterviewNotFoundError) return { error: "Interview not found" };
    throw err;
  }
  revalidateDetail(id);
  return {};
}

// ── Comments (caller-or-manager) ───────────────────────

export async function addCommentAction(
  id: string,
  _prev: CommentState,
  formData: FormData
): Promise<CommentState> {
  const access = await requireInterviewAccess();
  const parsed = commentSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid comment" };

  try {
    await addComment(access, id, parsed.data.body);
  } catch (err) {
    if (err instanceof InterviewNotFoundError) return { error: "You can't comment on this interview" };
    throw err;
  }
  revalidatePath(`/interview/${id}`);
  return { success: true };
}

// ── Files (manager upload/delete; downloads via API route) ──

async function fileFromForm(formData: FormData): Promise<{ data: Buffer; filename: string; mimeType: string } | null> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return null;
  return { data: Buffer.from(await file.arrayBuffer()), filename: file.name, mimeType: file.type };
}

export async function uploadReferenceFileAction(
  id: string,
  _prev: FileUploadState,
  formData: FormData
): Promise<FileUploadState> {
  const manager = await requireInterviewManager();
  const file = await fileFromForm(formData);
  if (!file) return { error: "Choose a file to upload" };

  try {
    await addReferenceFile(id, manager.id, file);
  } catch (err) {
    if (err instanceof InvalidFileError) return { error: err.message };
    if (err instanceof InterviewNotFoundError) return { error: "Interview not found" };
    throw err;
  }
  revalidatePath(`/interview/${id}`);
  return { success: true };
}

export async function deleteReferenceFileAction(id: string, fileId: string): Promise<Result> {
  await requireInterviewManager();
  try {
    await deleteReferenceFile(id, fileId);
  } catch (err) {
    if (err instanceof InterviewNotFoundError) return { error: "File not found" };
    throw err;
  }
  revalidatePath(`/interview/${id}`);
  return {};
}

export async function uploadResumeFileAction(
  id: string,
  _prev: FileUploadState,
  formData: FormData
): Promise<FileUploadState> {
  await requireInterviewManager();
  const file = await fileFromForm(formData);
  if (!file) return { error: "Choose a file to upload" };

  try {
    await setResumeFile(id, file);
  } catch (err) {
    if (err instanceof InvalidFileError) return { error: err.message };
    if (err instanceof InterviewNotFoundError) return { error: "Interview not found" };
    throw err;
  }
  revalidatePath(`/interview/${id}`);
  return { success: true };
}
