import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestUser, deleteTestUser, MINIMAL_PERSONAL_INFO } from "@/lib/profile/test-helpers";
import { savePersonalInfo } from "@/lib/profile/personal-info";
import { ProfileNotFoundError } from "@/lib/profile/shared";
import {
  listEducation,
  createEducationEntry,
  updateEducationEntry,
  deleteEducationEntry,
  EntryNotFoundError,
} from "@/lib/profile/education";

describe("education (integration)", () => {
  let userId: string;

  beforeAll(async () => {
    ({ id: userId } = await createTestUser());
  });

  afterAll(async () => {
    await deleteTestUser(userId);
  });

  it("returns an empty list before a profile exists", async () => {
    expect(await listEducation(userId)).toEqual([]);
  });

  it("refuses to create an entry before a profile exists", async () => {
    await expect(
      createEducationEntry(userId, {
        institution: "State University",
        degree: "B.S. Computer Science",
        field: undefined,
        startDate: undefined,
        endDate: undefined,
      })
    ).rejects.toThrow(ProfileNotFoundError);
  });

  it("creates, lists, updates, and deletes entries", async () => {
    await savePersonalInfo(userId, MINIMAL_PERSONAL_INFO);

    const id = await createEducationEntry(userId, {
      institution: "State University",
      degree: "B.S. Computer Science",
      field: "Computer Science",
      startDate: "2014-09-01",
      endDate: "2018-05-15",
    });

    expect(await listEducation(userId)).toEqual([
      {
        id,
        institution: "State University",
        degree: "B.S. Computer Science",
        field: "Computer Science",
        startDate: "2014-09-01",
        endDate: "2018-05-15",
      },
    ]);

    await updateEducationEntry(userId, id, {
      institution: "State University",
      degree: "M.S. Computer Science",
      field: "Computer Science",
      startDate: "2018-09-01",
      endDate: "2020-05-15",
    });

    expect((await listEducation(userId))[0].degree).toBe("M.S. Computer Science");

    await deleteEducationEntry(userId, id);
    expect(await listEducation(userId)).toEqual([]);
  });

  it("rejects updates/deletes for entries not owned by this user", async () => {
    const { id: otherId } = await createTestUser();
    try {
      await savePersonalInfo(otherId, MINIMAL_PERSONAL_INFO);
      const entryId = await createEducationEntry(otherId, {
        institution: "Other School",
        degree: "B.A.",
        field: undefined,
        startDate: undefined,
        endDate: undefined,
      });

      await expect(
        updateEducationEntry(userId, entryId, {
          institution: "Hijacked",
          degree: "B.A.",
          field: undefined,
          startDate: undefined,
          endDate: undefined,
        })
      ).rejects.toThrow(EntryNotFoundError);

      await expect(deleteEducationEntry(userId, entryId)).rejects.toThrow(EntryNotFoundError);
    } finally {
      await deleteTestUser(otherId);
    }
  });
});
