import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestProfile, deleteTestProfile } from "@/lib/profile/test-helpers";
import {
  listEducation,
  createEducationEntry,
  updateEducationEntry,
  deleteEducationEntry,
  EntryNotFoundError,
} from "@/lib/profile/education";

describe("education (integration)", () => {
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
    expect(await listEducation(profileId)).toEqual([]);
  });

  it("creates, lists, updates, and deletes entries", async () => {
    const id = await createEducationEntry(profileId, {
      institution: "State University",
      degree: "B.S. Computer Science",
      field: "Computer Science",
      startDate: "2014-09",
      endDate: "2018-05",
    });

    expect(await listEducation(profileId)).toEqual([
      {
        id,
        institution: "State University",
        degree: "B.S. Computer Science",
        field: "Computer Science",
        startDate: "2014-09",
        endDate: "2018-05",
      },
    ]);

    await updateEducationEntry(profileId, id, {
      institution: "State University",
      degree: "M.S. Computer Science",
      field: "Computer Science",
      startDate: "2018-09",
      endDate: "2020-05",
    });

    expect((await listEducation(profileId))[0].degree).toBe("M.S. Computer Science");

    await deleteEducationEntry(profileId, id);
    expect(await listEducation(profileId)).toEqual([]);
  });

  it("rejects updates/deletes for entries not owned by this profile", async () => {
    const entryId = await createEducationEntry(otherProfileId, {
      institution: "Other School",
      degree: "B.A.",
      field: undefined,
      startDate: undefined,
      endDate: undefined,
    });

    await expect(
      updateEducationEntry(profileId, entryId, {
        institution: "Hijacked",
        degree: "B.A.",
        field: undefined,
        startDate: undefined,
        endDate: undefined,
      })
    ).rejects.toThrow(EntryNotFoundError);

    await expect(deleteEducationEntry(profileId, entryId)).rejects.toThrow(EntryNotFoundError);
  });
});
