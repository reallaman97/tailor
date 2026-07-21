import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestProfile, deleteTestProfile } from "@/lib/profile/test-helpers";
import {
  listWorkHistory,
  createWorkHistoryEntry,
  updateWorkHistoryEntry,
  deleteWorkHistoryEntry,
  EntryNotFoundError,
} from "@/lib/profile/work-history";

describe("work history (integration)", () => {
  let profileId: string;
  let otherProfileId: string;

  beforeAll(async () => {
    profileId = await createTestProfile();
    otherProfileId = await createTestProfile();
  });

  afterAll(async () => {
    await deleteTestProfile(profileId);
    await deleteTestProfile(otherProfileId);
  });

  it("returns an empty list for a profile with no entries", async () => {
    expect(await listWorkHistory(profileId)).toEqual([]);
  });

  it("creates, lists, updates, and deletes entries", async () => {
    const id1 = await createWorkHistoryEntry(profileId, {
      company: "Acme",
      jobTitle: "Engineer",
      location: "Remote",
      workingStyle: "FULL_TIME",
      workingType: "REMOTE",
      startDate: "2020-01",
      endDate: "2022-06",
      achievements: ["Shipped feature X", "Reduced latency 30%"],
    });

    const id2 = await createWorkHistoryEntry(profileId, {
      company: "Globex",
      jobTitle: "Senior Engineer",
      location: undefined,
      workingStyle: undefined,
      workingType: undefined,
      startDate: "2022-07",
      endDate: undefined, // current role
      achievements: ["Led migration"],
    });

    const list = await listWorkHistory(profileId);
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({
      id: id1,
      company: "Acme",
      jobTitle: "Engineer",
      location: "Remote",
      workingStyle: "FULL_TIME",
      workingType: "REMOTE",
      startDate: "2020-01",
      endDate: "2022-06",
      achievements: ["Shipped feature X", "Reduced latency 30%"],
    });
    expect(list[1]).toMatchObject({
      id: id2,
      company: "Globex",
      endDate: null,
      workingStyle: null,
      workingType: null,
    });

    await updateWorkHistoryEntry(profileId, id1, {
      company: "Acme Corp",
      jobTitle: "Engineer",
      location: "Remote",
      workingStyle: "CONTRACT",
      workingType: "HYBRID",
      startDate: "2020-01",
      endDate: "2022-06",
      achievements: ["Updated achievement"],
    });

    const updated = (await listWorkHistory(profileId)).find((e) => e.id === id1);
    expect(updated?.company).toBe("Acme Corp");
    expect(updated?.achievements).toEqual(["Updated achievement"]);
    expect(updated?.workingStyle).toBe("CONTRACT");
    expect(updated?.workingType).toBe("HYBRID");

    await deleteWorkHistoryEntry(profileId, id1);
    expect((await listWorkHistory(profileId)).map((e) => e.id)).toEqual([id2]);

    await deleteWorkHistoryEntry(profileId, id2);
  });

  it("does not allow updating or deleting another profile's entry", async () => {
    const id = await createWorkHistoryEntry(otherProfileId, {
      company: "Other Co",
      jobTitle: "Engineer",
      location: undefined,
      workingStyle: undefined,
      workingType: undefined,
      startDate: "2020-01",
      endDate: undefined,
      achievements: ["Something"],
    });

    await expect(
      updateWorkHistoryEntry(profileId, id, {
        company: "Hijacked",
        jobTitle: "Engineer",
        location: undefined,
        workingStyle: undefined,
        workingType: undefined,
        startDate: "2020-01",
        endDate: undefined,
        achievements: [],
      })
    ).rejects.toThrow(EntryNotFoundError);

    await expect(deleteWorkHistoryEntry(profileId, id)).rejects.toThrow(EntryNotFoundError);

    const stillThere = await listWorkHistory(otherProfileId);
    expect(stillThere.map((e) => e.id)).toContain(id);
  });
});
