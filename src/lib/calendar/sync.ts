import { db } from "@/lib/db";
import { fetchEventsPage, UnauthorizedError, type GoogleEvent } from "@/lib/calendar/google";
import { getConnectionRow, getValidAccessToken, NeedsReauthError } from "@/lib/calendar/connections";

// The window we keep mirrored locally: a little past + a couple months ahead.
const WINDOW_BACK_DAYS = 7;
const WINDOW_FORWARD_DAYS = 60;
const MAX_PAGES = 20;

export type SyncResult = { synced: number; removed: number; status: "ok" | "needs_reauth" | "error"; error?: string };

function toDate(part?: { dateTime?: string; date?: string }): { at: Date | null; allDay: boolean } {
  if (part?.dateTime) return { at: new Date(part.dateTime), allDay: false };
  if (part?.date) return { at: new Date(`${part.date}T00:00:00.000Z`), allDay: true };
  return { at: null, allDay: false };
}

/**
 * Pulls the user's Google events for the mirrored window and reconciles them
 * into ExternalEvent: upserts current events, deletes cancelled/removed ones.
 * A bounded window + full reconcile avoids Google syncToken edge cases.
 */
export async function syncConnection(userId: string): Promise<SyncResult> {
  const row = await getConnectionRow(userId);
  if (!row) return { synced: 0, removed: 0, status: "ok" };

  const now = Date.now();
  const timeMin = new Date(now - WINDOW_BACK_DAYS * 86_400_000);
  const timeMax = new Date(now + WINDOW_FORWARD_DAYS * 86_400_000);

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(row);
  } catch (err) {
    if (err instanceof NeedsReauthError) return { synced: 0, removed: 0, status: "needs_reauth" };
    throw err;
  }

  // Collect all events across pages.
  const items: GoogleEvent[] = [];
  try {
    let pageToken: string | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await fetchEventsPage(accessToken, {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        pageToken,
      });
      items.push(...res.items);
      if (!res.nextPageToken) break;
      pageToken = res.nextPageToken;
    }
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      await db.calendarConnection.update({
        where: { id: row.id },
        data: { status: "needs_reauth", lastError: "Access was revoked — reconnect the calendar." },
      });
      return { synced: 0, removed: 0, status: "needs_reauth" };
    }
    const message = err instanceof Error ? err.message : "Sync failed";
    await db.calendarConnection.update({ where: { id: row.id }, data: { lastError: message } });
    return { synced: 0, removed: 0, status: "error", error: message };
  }

  const seenIds: string[] = [];
  const cancelledIds: string[] = [];
  let synced = 0;

  for (const e of items) {
    if (e.status === "cancelled") {
      cancelledIds.push(e.id);
      continue;
    }
    const start = toDate(e.start);
    if (!start.at) continue; // no usable start — skip
    const end = toDate(e.end);

    const data = {
      userId,
      provider: "google",
      icalUid: e.iCalUID ?? null,
      title: (e.summary ?? "(no title)").slice(0, 300),
      description: e.description?.slice(0, 2000) ?? null,
      location: e.location?.slice(0, 300) ?? null,
      organizer: (e.organizer?.email ?? e.organizer?.displayName ?? "")?.slice(0, 200) || null,
      htmlLink: e.htmlLink ?? null,
      startsAt: start.at,
      endsAt: end.at,
      allDay: start.allDay,
      status: "confirmed",
    };

    await db.externalEvent.upsert({
      where: { connectionId_externalId: { connectionId: row.id, externalId: e.id } },
      create: { connectionId: row.id, externalId: e.id, ...data },
      update: data,
    });
    seenIds.push(e.id);
    synced++;
  }

  // Remove explicitly-cancelled events, plus anything in-window we no longer see.
  let removed = 0;
  if (cancelledIds.length > 0) {
    const r = await db.externalEvent.deleteMany({
      where: { connectionId: row.id, externalId: { in: cancelledIds } },
    });
    removed += r.count;
  }
  const reconcile = await db.externalEvent.deleteMany({
    where: {
      connectionId: row.id,
      startsAt: { gte: timeMin, lt: timeMax },
      externalId: { notIn: seenIds.length > 0 ? seenIds : ["__none__"] },
    },
  });
  removed += reconcile.count;

  await db.calendarConnection.update({
    where: { id: row.id },
    data: { lastSyncedAt: new Date(), status: "active", lastError: null },
  });

  return { synced, removed, status: "ok" };
}

/** Syncs every active connection — used by the cron endpoint. */
export async function syncAllConnections(): Promise<{ connections: number; synced: number }> {
  const conns = await db.calendarConnection.findMany({ where: { status: "active" }, select: { userId: true } });
  let synced = 0;
  for (const c of conns) {
    try {
      const r = await syncConnection(c.userId);
      synced += r.synced;
    } catch {
      // isolate failures — one bad connection shouldn't stop the rest
    }
  }
  return { connections: conns.length, synced };
}
