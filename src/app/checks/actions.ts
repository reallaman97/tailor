"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/require-user";
import { runPendingChecks, updateCheckCriteria } from "@/lib/checks/application-checks";
import type { WorkStyle } from "@/lib/checks/application-checks";

function parseDate(value: FormDataEntryValue | null): Date | undefined {
  const s = typeof value === "string" ? value : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export type RunState = { ok?: string; error?: string } | undefined;

/** Checks pending (missing/stale) applications in the current filter, in as few LLM calls as possible. */
export async function runChecksAction(_prev: RunState, formData: FormData): Promise<RunState> {
  await requireSuperAdmin();

  const from = parseDate(formData.get("from"));
  const toRaw = parseDate(formData.get("to"));
  // The `to` in the URL is an inclusive day; make it an exclusive next-day bound.
  const to = toRaw ? new Date(toRaw.getTime() + 86_400_000) : undefined;
  const bidderId = (formData.get("bidder") as string) || undefined;
  const profileId = (formData.get("profile") as string) || undefined;

  try {
    const r = await runPendingChecks({ from, to, bidderId, profileId });
    revalidatePath("/checks");
    if (r.checked === 0) return { ok: "Everything in range is already checked." };
    const remaining = r.remaining > 0 ? ` ${r.remaining} still pending — run again.` : "";
    return {
      ok: `Checked ${r.checked} application${r.checked === 1 ? "" : "s"} (${r.passed} pass, ${r.failed} fail) in ${r.apiCalls} API call${r.apiCalls === 1 ? "" : "s"}.${remaining}`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Check failed." };
  }
}

export type CriteriaState = { ok?: string; error?: string } | undefined;

const WORK_STYLES = ["REMOTE", "HYBRID", "ONSITE", "ANY"];

/** Saves the checking criteria. Changing them marks existing verdicts stale (re-run to apply). */
export async function saveCriteriaAction(_prev: CriteriaState, formData: FormData): Promise<CriteriaState> {
  await requireSuperAdmin();

  const country = String(formData.get("country") ?? "").trim();
  const rawStyle = String(formData.get("workStyle") ?? "REMOTE");
  const workStyle = (WORK_STYLES.includes(rawStyle) ? rawStyle : "REMOTE") as WorkStyle;
  const jobCategory = String(formData.get("jobCategory") ?? "").trim();

  if (!jobCategory) return { error: "Job category can't be empty." };

  try {
    await updateCheckCriteria({ country: country || "ANY", workStyle, jobCategory });
    revalidatePath("/checks");
    return { ok: "Criteria saved. Re-run checks to apply them." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Save failed." };
  }
}
