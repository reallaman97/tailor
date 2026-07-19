import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { createTestUser, MINIMAL_PERSONAL_INFO } from "@/lib/profile/test-helpers";
import { savePersonalInfo } from "@/lib/profile/personal-info";
import { createWorkHistoryEntry } from "@/lib/profile/work-history";
import { createEducationEntry } from "@/lib/profile/education";
import { saveSkillGroup } from "@/lib/profile/skills";
import { deleteAccount } from "@/lib/profile/account";

describe("account deletion (integration)", () => {
  it("cascades to remove all derived data", async () => {
    const { id: userId } = await createTestUser();

    await savePersonalInfo(userId, MINIMAL_PERSONAL_INFO);
    await createWorkHistoryEntry(userId, {
      company: "Acme",
      jobTitle: "Engineer",
      location: undefined,
      startDate: "2020-01-01",
      endDate: undefined,
      achievements: ["Did things"],
    });
    await createEducationEntry(userId, {
      institution: "State University",
      degree: "B.S.",
      field: undefined,
      startDate: undefined,
      endDate: undefined,
    });
    await saveSkillGroup(userId, { category: "LANGUAGES", skills: ["TypeScript"] });

    const profile = await db.profile.findUniqueOrThrow({ where: { userId } });

    await deleteAccount(userId);

    expect(await db.user.findUnique({ where: { id: userId } })).toBeNull();
    expect(await db.profile.findUnique({ where: { userId } })).toBeNull();
    expect(await db.workHistoryEntry.findMany({ where: { profileId: profile.id } })).toEqual([]);
    expect(await db.educationEntry.findMany({ where: { profileId: profile.id } })).toEqual([]);
    expect(await db.skillGroup.findMany({ where: { profileId: profile.id } })).toEqual([]);
  });
});
