"use server";

import { revalidatePath } from "next/cache";
import { requireRatesManager } from "@/lib/auth/team-context";
import { setBidderRate, InvalidRateError } from "@/lib/admin/rates";

export type SetRateResult = { ok: boolean; error?: string };

/**
 * Sets one bidder's per-application rate in the caller's active team. Gated to
 * team admins and Managers (requireRatesManager). Called directly from the
 * rates table's inline editor.
 */
export async function setBidderRateAction(userId: string, rate: number): Promise<SetRateResult> {
  const ctx = await requireRatesManager();
  try {
    await setBidderRate(ctx.activeTeamId!, userId, rate);
  } catch (err) {
    if (err instanceof InvalidRateError) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath("/rates");
  revalidatePath("/dashboard");
  return { ok: true };
}
