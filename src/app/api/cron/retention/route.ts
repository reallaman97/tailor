import { NextResponse } from "next/server";
import { applyRetention } from "@/lib/resumes/retention";

export const maxDuration = 60;

/**
 * Daily clean-up of old screenshots and generated text (Vercel Cron) — see
 * src/lib/resumes/retention.ts. Like the calendar sync, it requires
 * `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set. It only ever
 * clears data past its retention age, so an extra run changes nothing early.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await applyRetention();
  return NextResponse.json({ ok: true, ...result });
}
