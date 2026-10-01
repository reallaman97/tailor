"use server";

import { revalidatePath } from "next/cache";
import { requireTeamAdmin } from "@/lib/auth/team-context";
import { runPendingChecks, updateCheckCriteria, parseTechStack } from "@/lib/checks/application-checks";

function parseDate(value: FormDataEntryValue | null): Date | undefined {
  const s = typeof value === "string" ? value : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export type RunState = { ok?: string; error?: string } | undefined;

/** Checks pending (missing/stale) applications in the current filter, in as few LLM calls as possible. */
export async function runChecksAction(_prev: RunState, formData: FormData): Promise<RunState> {
  const ctx = await requireTeamAdmin();
  const teamId = ctx.activeTeamId ?? undefined;

  const from = parseDate(formData.get("from"));
  const toRaw = parseDate(formData.get("to"));
  // The `to` in the URL is an inclusive day; make it an exclusive next-day bound.
  const to = toRaw ? new Date(toRaw.getTime() + 86_400_000) : undefined;
  const bidderId = (formData.get("bidder") as string) || undefined;
  const profileId = (formData.get("profile") as string) || undefined;

  try {
    const r = await runPendingChecks({ from, to, bidderId, profileId, teamId });
    revalidatePath("/checks");
    if (r.checked === 0) return { ok: "Everything in range is already checked." };
    const remaining = r.remaining > 0 ? ` ${r.remaining} still pending — run again.` : "";
    return {
      ok: `Checked ${r.checked} application${r.checked === 1 ? "" : "s"} (${r.passed} relevant, ${r.failed} not relevant) in ${r.apiCalls} API call${r.apiCalls === 1 ? "" : "s"}.${remaining}`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Check failed." };
  }
}

export type CriteriaState = { ok?: string; error?: string } | undefined;

/** Saves the target tech stack. Changing it marks existing verdicts stale (re-run to apply). */
export async function saveCriteriaAction(_prev: CriteriaState, formData: FormData): Promise<CriteriaState> {
  const ctx = await requireTeamAdmin();

  const techStack = String(formData.get("techStack") ?? "");
  const stack = parseTechStack(techStack);
  if (stack.length === 0) return { error: "Enter at least one technology." };
  if (stack.length > 60) return { error: "That's too many technologies — keep it to the core stack (max 60)." };
  if (stack.some((t) => t.length > 60)) return { error: "Each technology name must be under 60 characters." };

  try {
    await updateCheckCriteria({ techStack }, ctx.activeTeamId);
    revalidatePath("/checks");
    return { ok: "Stack saved. Run checks to apply it." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Save failed." };
  }
}
