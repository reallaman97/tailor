/**
 * Timezone helpers for Interview Management. Every interview time is stored as a
 * UTC instant (Prisma DateTime) and rendered in the single platform-wide IANA
 * timezone configured in Settings (AppSettings.interviewTimezone). We lean on
 * the built-in `Intl` APIs rather than adding a date library.
 */

/** True if `tz` is an IANA zone the runtime's Intl understands (e.g. "America/New_York"). */
export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    // Throws RangeError for an unknown/invalid timezone.
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * The list of IANA zones offered in the Settings picker. Prefers the runtime's
 * full canonical list (Node 20+/modern browsers) and falls back to a compact,
 * representative set if `Intl.supportedValuesOf` isn't available.
 */
export function supportedTimeZones(): string[] {
  const withSupported = Intl as typeof Intl & {
    supportedValuesOf?: (key: string) => string[];
  };
  if (typeof withSupported.supportedValuesOf === "function") {
    try {
      return withSupported.supportedValuesOf("timeZone");
    } catch {
      // fall through to the static list
    }
  }
  return FALLBACK_TIMEZONES;
}

const FALLBACK_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Madrid",
  "Africa/Cairo",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
];

/** Falls back to UTC for a null/invalid stored value so rendering never throws. */
function safeZone(tz: string | null | undefined): string {
  return tz && isValidTimeZone(tz) ? tz : "UTC";
}

/**
 * Formats a UTC instant for display in the given timezone, e.g.
 * "Jul 24, 2026, 2:30 PM". Returns "" for a null date (unscheduled interview).
 */
export function formatInterviewTime(date: Date | null | undefined, tz: string): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: safeZone(tz),
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/** Just the time-of-day portion in the given zone, e.g. "2:30 PM" — for compact calendar pills. */
export function formatInterviewClock(date: Date | null | undefined, tz: string): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: safeZone(tz),
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/**
 * The calendar day a UTC instant falls on *in the target timezone*, as
 * `{ year, month, day }` (month 1-12). Used to bucket interviews into calendar
 * cells so an 11pm-UTC interview lands on the correct local date.
 */
export function zonedYmd(date: Date, tz: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: safeZone(tz),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** A stable "YYYY-MM-DD" key for the interview's local calendar day in `tz`. */
export function zonedDayKey(date: Date, tz: string): string {
  const { year, month, day } = zonedYmd(date, tz);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Milliseconds `tz` is ahead of UTC at the given instant (handles DST). */
function tzOffsetMs(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: safeZone(tz),
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - date.getTime();
}

/**
 * Converts a wall-clock time entered *in `tz`* (from a `datetime-local` input,
 * "YYYY-MM-DDTHH:mm") into the corresponding UTC instant for storage. Returns
 * null for an empty/malformed value. The manager types the interview time in
 * the platform timezone; this is what makes that interpretation correct.
 */
export function datetimeLocalToUtc(value: string | null | undefined, tz: string): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number) as unknown as number[];

  // First approximation: treat the wall components as if they were UTC, then
  // subtract the zone offset at that instant. One correction pass is enough for
  // ordinary times; DST-gap/overlap edges are rare and non-critical here.
  const naiveUtc = Date.UTC(y, mo - 1, d, h, mi);
  const offset = tzOffsetMs(new Date(naiveUtc), tz);
  return new Date(naiveUtc - offset);
}

/**
 * Renders a UTC instant as a `datetime-local` input value ("YYYY-MM-DDTHH:mm")
 * expressed in `tz`, so the edit form shows the time the manager originally
 * entered. Returns "" for null.
 */
export function utcToDatetimeLocal(date: Date | null | undefined, tz: string): string {
  if (!date) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: safeZone(tz),
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
