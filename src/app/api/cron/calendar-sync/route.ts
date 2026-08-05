import { NextResponse } from "next/server";
import { syncAllConnections } from "@/lib/calendar/sync";

// A calendar sync can take a while across many connections.
export const maxDuration = 60;

/**
 * Scheduled calendar sync (Vercel Cron). Vercel automatically sends
 * `Authorization: Bearer <CRON_SECRET>` when the CRON_SECRET env var is set;
 * we require it so the endpoint can't be triggered publicly.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authorized = request.headers.get("authorization") === `Bearer ${secret}`;
    if (!authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncAllConnections();
  return NextResponse.json({ ok: true, ...result });
}
