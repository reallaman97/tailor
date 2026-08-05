import { db } from "@/lib/db";
import { getConnectionView, type ConnectionView } from "@/lib/calendar/connections";
import { syncConnection } from "@/lib/calendar/sync";

const STALE_MS = 15 * 60 * 1000;

export type ExternalCalendarEvent = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  allDay: boolean;
  location: string | null;
  organizer: string | null;
  htmlLink: string | null;
  linkedInterviewId: string | null;
};

/**
 * The user's own confirmed external calendar events, for overlaying on the
 * interview calendar. Naturally bounded by the sync window kept in the DB.
 */
export async function listExternalEventsForUser(userId: string): Promise<ExternalCalendarEvent[]> {
  return db.externalEvent.findMany({
    where: { userId, status: "confirmed" },
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      title: true,
      startsAt: true,
      endsAt: true,
      allDay: true,
      location: true,
      organizer: true,
      htmlLink: true,
      linkedInterviewId: true,
    },
  });
}

/**
 * Loads the connection state + overlay events for the interview calendar,
 * refreshing on the fly when the local mirror is stale (so events stay current
 * between daily cron runs). Kept out of the page component so the impurity
 * (time check) lives in the data layer, not in render.
 */
export async function loadCalendarOverlay(
  userId: string
): Promise<{ connection: ConnectionView | null; events: ExternalCalendarEvent[] }> {
  let connection = await getConnectionView(userId);
  if (connection && connection.status === "active") {
    const stale = !connection.lastSyncedAt || Date.now() - connection.lastSyncedAt.getTime() > STALE_MS;
    if (stale) {
      await syncConnection(userId).catch(() => {});
      connection = await getConnectionView(userId);
    }
  }
  const events = connection ? await listExternalEventsForUser(userId) : [];
  return { connection, events };
}
