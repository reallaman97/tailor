import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { createTestUser, deleteTestUser } from "@/lib/profile/test-helpers";
import {
  getMyAvailability,
  saveMyAvailability,
  getAvailabilityOverview,
  InvalidAvailabilityError,
} from "@/lib/interview/availability";

describe("caller availability (integration)", () => {
  let callerA: string;
  let callerB: string;

  beforeAll(async () => {
    ({ id: callerA } = await createTestUser());
    ({ id: callerB } = await createTestUser());
    await db.user.update({ where: { id: callerA }, data: { role: "CALLER" } });
    await db.user.update({ where: { id: callerB }, data: { role: "CALLER" } });
  });

  afterAll(async () => {
    await deleteTestUser(callerA);
    await deleteTestUser(callerB);
  });

  it("saves and reads back a caller's slots, deduped", async () => {
    await saveMyAvailability(callerA, [
      { dayOfWeek: 1, hour: 9 },
      { dayOfWeek: 1, hour: 10 },
      { dayOfWeek: 1, hour: 9 }, // duplicate
    ]);
    const slots = await getMyAvailability(callerA);
    expect(slots).toHaveLength(2);
    expect(slots).toContainEqual({ dayOfWeek: 1, hour: 9 });
    expect(slots).toContainEqual({ dayOfWeek: 1, hour: 10 });
  });

  it("replaces the whole set on save (not append)", async () => {
    await saveMyAvailability(callerA, [{ dayOfWeek: 3, hour: 14 }]);
    const slots = await getMyAvailability(callerA);
    expect(slots).toEqual([{ dayOfWeek: 3, hour: 14 }]);
  });

  it("rejects out-of-range slots", async () => {
    await expect(saveMyAvailability(callerA, [{ dayOfWeek: 7, hour: 9 }])).rejects.toBeInstanceOf(
      InvalidAvailabilityError
    );
    await expect(saveMyAvailability(callerA, [{ dayOfWeek: 0, hour: 24 }])).rejects.toBeInstanceOf(
      InvalidAvailabilityError
    );
  });

  it("aggregates across callers with per-slot totals", async () => {
    await saveMyAvailability(callerA, [
      { dayOfWeek: 2, hour: 8 },
      { dayOfWeek: 2, hour: 9 },
    ]);
    await saveMyAvailability(callerB, [{ dayOfWeek: 2, hour: 8 }]);

    const overview = await getAvailabilityOverview();
    // Both test callers are included.
    expect(overview.callerCount).toBeGreaterThanOrEqual(2);
    // Two callers free at Tue 8:00, one at Tue 9:00.
    expect(overview.totals[2][8]).toBeGreaterThanOrEqual(2);
    expect(overview.totals[2][9]).toBeGreaterThanOrEqual(1);

    const a = overview.callers.find((c) => c.id === callerA);
    expect(a?.totalHours).toBe(2);
  });
});
