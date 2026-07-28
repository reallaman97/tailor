import { db } from "@/lib/db";

/**
 * Caller weekly availability — a recurring Sun–Sat × 24h grid. Each stored row
 * is one available hour slot (dayOfWeek 0–6, hour 0–23) in the platform
 * timezone. A caller owns their own set; saving replaces it wholesale. Managers
 * and Super Admins read every caller's set plus an aggregate ("how many callers
 * are free at each slot").
 */

export const DAYS_IN_WEEK = 7;
export const HOURS_IN_DAY = 24;

export type AvailabilitySlot = { dayOfWeek: number; hour: number };

export class InvalidAvailabilityError extends Error {}

function isValidSlot(s: AvailabilitySlot): boolean {
  return (
    Number.isInteger(s.dayOfWeek) &&
    Number.isInteger(s.hour) &&
    s.dayOfWeek >= 0 &&
    s.dayOfWeek < DAYS_IN_WEEK &&
    s.hour >= 0 &&
    s.hour < HOURS_IN_DAY
  );
}

/** The signed-in caller's own available slots. */
export async function getMyAvailability(userId: string): Promise<AvailabilitySlot[]> {
  const rows = await db.callerAvailability.findMany({
    where: { userId },
    select: { dayOfWeek: true, hour: true },
    orderBy: [{ dayOfWeek: "asc" }, { hour: "asc" }],
  });
  return rows;
}

/**
 * Replaces the caller's entire availability set with `slots` (deduped, validated).
 * Delete-then-insert in one transaction so a save is atomic.
 */
export async function saveMyAvailability(userId: string, slots: AvailabilitySlot[]): Promise<void> {
  // Dedupe by (day,hour) and validate.
  const seen = new Set<string>();
  const clean: AvailabilitySlot[] = [];
  for (const s of slots) {
    if (!isValidSlot(s)) throw new InvalidAvailabilityError("Invalid availability slot");
    const key = `${s.dayOfWeek}-${s.hour}`;
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push({ dayOfWeek: s.dayOfWeek, hour: s.hour });
  }

  await db.$transaction([
    db.callerAvailability.deleteMany({ where: { userId } }),
    db.callerAvailability.createMany({
      data: clean.map((s) => ({ userId, dayOfWeek: s.dayOfWeek, hour: s.hour })),
    }),
  ]);
}

export type CallerAvailabilityView = {
  id: string;
  name: string;
  email: string;
  slots: AvailabilitySlot[];
  totalHours: number;
};

export type AvailabilityOverview = {
  callers: CallerAvailabilityView[];
  /** totals[dayOfWeek][hour] = number of callers available at that slot. */
  totals: number[][];
  callerCount: number;
  /** The largest value in `totals` — handy for scaling a heatmap. */
  maxCount: number;
};

/** Every caller (even those who haven't submitted) plus the aggregate per-slot counts. */
export async function getAvailabilityOverview(): Promise<AvailabilityOverview> {
  const callers = await db.user.findMany({
    where: { role: "CALLER" },
    orderBy: { username: "asc" },
    select: {
      id: true,
      username: true,
      email: true,
      availability: { select: { dayOfWeek: true, hour: true } },
    },
  });

  const totals = Array.from({ length: DAYS_IN_WEEK }, () => Array<number>(HOURS_IN_DAY).fill(0));
  let maxCount = 0;

  const views: CallerAvailabilityView[] = callers.map((c) => {
    for (const s of c.availability) {
      if (s.dayOfWeek >= 0 && s.dayOfWeek < DAYS_IN_WEEK && s.hour >= 0 && s.hour < HOURS_IN_DAY) {
        const next = ++totals[s.dayOfWeek][s.hour];
        if (next > maxCount) maxCount = next;
      }
    }
    return {
      id: c.id,
      name: c.username,
      email: c.email,
      slots: c.availability,
      totalHours: c.availability.length,
    };
  });

  return { callers: views, totals, callerCount: callers.length, maxCount };
}
