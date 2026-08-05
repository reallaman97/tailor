"use server";

import { revalidatePath } from "next/cache";
import { requireInterviewAccess } from "@/lib/auth/require-user";
import { disconnectCalendar } from "@/lib/calendar/connections";
import { syncConnection } from "@/lib/calendar/sync";

export async function disconnectCalendarAction(): Promise<void> {
  const user = await requireInterviewAccess();
  await disconnectCalendar(user.id);
  revalidatePath("/interview");
}

export type SyncState = { message?: string; error?: string } | undefined;

export async function syncNowAction(_prev: SyncState): Promise<SyncState> {
  const user = await requireInterviewAccess();
  const r = await syncConnection(user.id);
  revalidatePath("/interview");
  if (r.status === "needs_reauth") return { error: "Reconnect required — your calendar access expired." };
  if (r.status === "error") return { error: r.error || "Sync failed." };
  return { message: `Synced ${r.synced} event${r.synced === 1 ? "" : "s"}.` };
}
