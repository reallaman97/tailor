import { describe, it, expect } from "vitest";
import {
  isValidTimeZone,
  datetimeLocalToUtc,
  utcToDatetimeLocal,
  zonedDayKey,
  formatInterviewClock,
} from "@/lib/interview/timezone";

describe("interview timezone helpers", () => {
  it("validates IANA timezones", () => {
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Asia/Kolkata")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });

  it("interprets a datetime-local value as wall time in the given zone (UTC)", () => {
    const utc = datetimeLocalToUtc("2026-07-01T12:00", "UTC");
    expect(utc?.toISOString()).toBe("2026-07-01T12:00:00.000Z");
  });

  it("converts wall time in a western zone to the correct UTC instant (EDT = UTC-4)", () => {
    // July → America/New_York is on daylight time (UTC-4), so noon local = 16:00 UTC.
    const utc = datetimeLocalToUtc("2026-07-01T12:00", "America/New_York");
    expect(utc?.toISOString()).toBe("2026-07-01T16:00:00.000Z");
  });

  it("converts wall time in a half-hour-offset zone (IST = UTC+5:30)", () => {
    const utc = datetimeLocalToUtc("2026-07-01T12:00", "Asia/Kolkata");
    expect(utc?.toISOString()).toBe("2026-07-01T06:30:00.000Z");
  });

  it("returns null for empty or malformed datetime-local input", () => {
    expect(datetimeLocalToUtc("", "UTC")).toBeNull();
    expect(datetimeLocalToUtc(undefined, "UTC")).toBeNull();
    expect(datetimeLocalToUtc("not-a-date", "UTC")).toBeNull();
  });

  it("round-trips an instant through the datetime-local representation", () => {
    const original = new Date("2026-03-15T09:45:00.000Z");
    const local = utcToDatetimeLocal(original, "Europe/Berlin");
    const back = datetimeLocalToUtc(local, "Europe/Berlin");
    expect(back?.toISOString()).toBe(original.toISOString());
  });

  it("buckets an instant onto the correct local calendar day", () => {
    // 02:00 UTC on Jul 2 is still 22:00 on Jul 1 in New York (UTC-4 in summer).
    const instant = new Date("2026-07-02T02:00:00.000Z");
    expect(zonedDayKey(instant, "America/New_York")).toBe("2026-07-01");
    expect(zonedDayKey(instant, "UTC")).toBe("2026-07-02");
  });

  it("formats a clock time in the target zone", () => {
    const instant = new Date("2026-07-01T16:00:00.000Z");
    // 16:00 UTC = 12:00 (noon) in New York during summer.
    expect(formatInterviewClock(instant, "America/New_York")).toMatch(/12:00\s?PM/);
  });
});
