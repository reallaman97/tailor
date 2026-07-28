"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireInterviewAccess } from "@/lib/auth/require-user";
import { saveMyAvailability, InvalidAvailabilityError } from "@/lib/interview/availability";

const slotsSchema = z
  .array(z.object({ dayOfWeek: z.number().int().min(0).max(6), hour: z.number().int().min(0).max(23) }))
  .max(168, "Too many slots");

export type SaveAvailabilityState = { error?: string; success?: boolean };

/** Callers submit their own weekly availability (managers view, don't submit). */
export async function saveAvailabilityAction(
  slots: { dayOfWeek: number; hour: number }[]
): Promise<SaveAvailabilityState> {
  const access = await requireInterviewAccess();
  if (access.role !== "CALLER") {
    return { error: "Only callers submit availability." };
  }

  const parsed = slotsSchema.safeParse(slots);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid availability" };

  try {
    await saveMyAvailability(access.id, parsed.data);
  } catch (err) {
    if (err instanceof InvalidAvailabilityError) return { error: err.message };
    throw err;
  }

  revalidatePath("/interview/availability");
  return { success: true };
}
