"use server";

import { revalidatePath } from "next/cache";
import { requireInterviewManager } from "@/lib/auth/require-user";
import { updateInterviewTimezone } from "@/lib/settings";
import {
  createStage,
  renameStage,
  setStageActive,
  moveStage,
  createStatus,
  updateStatus,
  setStatusActive,
  moveStatus,
  createMeetingType,
  renameMeetingType,
  setMeetingTypeActive,
  moveMeetingType,
  ConfigItemNotFoundError,
} from "@/lib/interview/config";
import { configLabelSchema, statusConfigSchema, timezoneSchema } from "@/lib/interview/schemas";
import { isValidTimeZone } from "@/lib/interview/timezone";

export type SettingsActionState = { error?: string; success?: boolean } | undefined;
type Result = { error?: string };
type Direction = "up" | "down";

function revalidate() {
  revalidatePath("/interview/settings");
  // Labels/colors show throughout the tool.
  revalidatePath("/interview");
  revalidatePath("/interview/list");
}

async function run(fn: () => Promise<void>): Promise<Result> {
  await requireInterviewManager();
  try {
    await fn();
  } catch (err) {
    if (err instanceof ConfigItemNotFoundError) return { error: err.message };
    throw err;
  }
  revalidate();
  return {};
}

// ── Timezone (useActionState form) ─────────────────────

export async function updateTimezoneAction(
  _prev: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  await requireInterviewManager();
  const parsed = timezoneSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  if (!isValidTimeZone(parsed.data.interviewTimezone)) {
    return { error: "Unknown timezone" };
  }
  await updateInterviewTimezone(parsed.data.interviewTimezone);
  revalidate();
  return { success: true };
}

// ── Stages ─────────────────────────────────────────────

export async function createStageAction(label: string): Promise<Result> {
  await requireInterviewManager();
  const parsed = configLabelSchema.safeParse(label);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid name" };
  return run(async () => {
    await createStage(parsed.data);
  });
}

export async function renameStageAction(id: string, label: string): Promise<Result> {
  await requireInterviewManager();
  const parsed = configLabelSchema.safeParse(label);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid name" };
  return run(() => renameStage(id, parsed.data));
}

export async function setStageActiveAction(id: string, active: boolean): Promise<Result> {
  return run(() => setStageActive(id, active));
}

export async function moveStageAction(id: string, direction: Direction): Promise<Result> {
  return run(() => moveStage(id, direction));
}

// ── Statuses ───────────────────────────────────────────

export async function createStatusAction(label: string, color: string): Promise<Result> {
  await requireInterviewManager();
  const parsed = statusConfigSchema.safeParse({ label, color });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid status" };
  return run(async () => {
    await createStatus(parsed.data);
  });
}

export async function updateStatusAction(id: string, label: string, color: string): Promise<Result> {
  await requireInterviewManager();
  const parsed = statusConfigSchema.safeParse({ label, color });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid status" };
  return run(() => updateStatus(id, parsed.data));
}

export async function setStatusActiveAction(id: string, active: boolean): Promise<Result> {
  return run(() => setStatusActive(id, active));
}

export async function moveStatusAction(id: string, direction: Direction): Promise<Result> {
  return run(() => moveStatus(id, direction));
}

// ── Meeting types ──────────────────────────────────────

export async function createMeetingTypeAction(label: string): Promise<Result> {
  await requireInterviewManager();
  const parsed = configLabelSchema.safeParse(label);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid name" };
  return run(async () => {
    await createMeetingType(parsed.data);
  });
}

export async function renameMeetingTypeAction(id: string, label: string): Promise<Result> {
  await requireInterviewManager();
  const parsed = configLabelSchema.safeParse(label);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid name" };
  return run(() => renameMeetingType(id, parsed.data));
}

export async function setMeetingTypeActiveAction(id: string, active: boolean): Promise<Result> {
  return run(() => setMeetingTypeActive(id, active));
}

export async function moveMeetingTypeAction(id: string, direction: Direction): Promise<Result> {
  return run(() => moveMeetingType(id, direction));
}
