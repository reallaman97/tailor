import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestUser, deleteTestUser, MINIMAL_PERSONAL_INFO } from "@/lib/profile/test-helpers";
import { savePersonalInfo } from "@/lib/profile/personal-info";
import { ProfileNotFoundError } from "@/lib/profile/shared";
import {
  listWorkHistory,
  createWorkHistoryEntry,
  updateWorkHistoryEntry,
  deleteWorkHistoryEntry,
  EntryNotFoundError,
} from "@/lib/profile/work-history";

describe("work history (integration)", () => {
  let userId: string;
  let otherUserId: string;

  beforeAll(async () => {
    ({ id: userId } = await createTestUser());
    ({ id: otherUserId } = await createTestUser());
  });

  afterAll(async () => {
    await deleteTestUser(userId);
    await deleteTestUser(otherUserId);
  });

  it("returns an empty list before a profile exists", async () => {
    expect(await listWorkHistory(userId)).toEqual([]);
  });

  it("refuses to create an entry before a profile exists", async () => {
    await expect(
      createWorkHistoryEntry(userId, {
        company: "Acme",
        jobTitle: "Engineer",
        location: undefined,
        startDate: "2020-01-01",
        endDate: undefined,
        achievements: ["Did things"],
      })
    ).rejects.toThrow(ProfileNotFoundError);
  });

  it("creates, lists, updates, and deletes entries once a profile exists", async () => {
    await savePersonalInfo(userId, MINIMAL_PERSONAL_INFO);

    const id1 = await createWorkHistoryEntry(userId, {
      company: "Acme",
      jobTitle: "Engineer",
      location: "Remote",
      startDate: "2020-01-01",
      endDate: "2022-06-15",
      achievements: ["Shipped feature X", "Reduced latency 30%"],
    });

    const id2 = await createWorkHistoryEntry(userId, {
      company: "Globex",
      jobTitle: "Senior Engineer",
      location: undefined,
      startDate: "2022-07-01",
      endDate: undefined, // current role
      achievements: ["Led migration"],
    });

    const list = await listWorkHistory(userId);
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({
      id: id1,
      company: "Acme",
      jobTitle: "Engineer",
      location: "Remote",
      startDate: "2020-01-01",
      endDate: "2022-06-15",
      achievements: ["Shipped feature X", "Reduced latency 30%"],
    });
    expect(list[1]).toMatchObject({ id: id2, company: "Globex", endDate: null });

    await updateWorkHistoryEntry(userId, id1, {
      company: "Acme Corp",
      jobTitle: "Engineer",
      location: "Remote",
      startDate: "2020-01-01",
      endDate: "2022-06-15",
      achievements: ["Updated achievement"],
    });

    const updated = (await listWorkHistory(userId)).find((e) => e.id === id1);
    expect(updated?.company).toBe("Acme Corp");
    expect(updated?.achievements).toEqual(["Updated achievement"]);

    await deleteWorkHistoryEntry(userId, id1);
    expect((await listWorkHistory(userId)).map((e) => e.id)).toEqual([id2]);

    await deleteWorkHistoryEntry(userId, id2);
  });

  it("does not allow one user to update or delete another user's entry", async () => {
    await savePersonalInfo(otherUserId, MINIMAL_PERSONAL_INFO);
    const id = await createWorkHistoryEntry(otherUserId, {
      company: "Other Co",
      jobTitle: "Engineer",
      location: undefined,
      startDate: "2020-01-01",
      endDate: undefined,
      achievements: ["Something"],
    });

    await expect(
      updateWorkHistoryEntry(userId, id, {
        company: "Hijacked",
        jobTitle: "Engineer",
        location: undefined,
        startDate: "2020-01-01",
        endDate: undefined,
        achievements: [],
      })
    ).rejects.toThrow(EntryNotFoundError);

    await expect(deleteWorkHistoryEntry(userId, id)).rejects.toThrow(EntryNotFoundError);

    const stillThere = await listWorkHistory(otherUserId);
    expect(stillThere.map((e) => e.id)).toContain(id);
  });
});
