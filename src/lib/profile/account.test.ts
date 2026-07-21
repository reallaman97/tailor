import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { createTestUser, deleteTestUser } from "@/lib/profile/test-helpers";
import { createProfile } from "@/lib/profile/personal-info";
import { createWorkHistoryEntry } from "@/lib/profile/work-history";
import { createEducationEntry } from "@/lib/profile/education";
import { createSkillGroup } from "@/lib/profile/skills";
import { assignProfileToUser } from "@/lib/admin/profiles";
import { deleteAccount } from "@/lib/profile/account";

describe("account deletion (integration)", () => {
  it("deletes everything user-owned but leaves a shared profile (and its data) untouched for other accounts", async () => {
    const { id: userId } = await createTestUser();
    const { id: otherUserId } = await createTestUser();
    const profileId = await createProfile({
      fullName: "Test User",
      contactEmail: "test@example.com",
      phone: "555-0100",
      linkedinUrl: undefined,
      professionalSummary: undefined,
      city: undefined,
      state: undefined,
      dateOfBirth: undefined,
      addressLine1: undefined,
      addressLine2: undefined,
      postalCode: undefined,
      country: undefined,
    });
    await assignProfileToUser(profileId, userId);
    await assignProfileToUser(profileId, otherUserId);

    await createWorkHistoryEntry(profileId, {
      company: "Acme",
      jobTitle: "Engineer",
      location: undefined,
      workingStyle: undefined,
      workingType: undefined,
      startDate: "2020-01",
      endDate: undefined,
      achievements: ["Did things"],
    });
    await createEducationEntry(profileId, {
      institution: "State University",
      degree: "B.S.",
      field: undefined,
      startDate: undefined,
      endDate: undefined,
    });
    await createSkillGroup(profileId, { category: "Languages", skills: ["TypeScript"] });

    try {
      await deleteAccount(userId);

      expect(await db.user.findUnique({ where: { id: userId } })).toBeNull();

      // The profile survives, still assigned to the other account that shared it.
      expect(await db.profile.findUnique({ where: { id: profileId } })).not.toBeNull();
      const otherUser = await db.user.findUniqueOrThrow({ where: { id: otherUserId } });
      expect(otherUser.profileId).toBe(profileId);

      expect(await db.workHistoryEntry.findMany({ where: { profileId } })).toHaveLength(1);
      expect(await db.educationEntry.findMany({ where: { profileId } })).toHaveLength(1);
      expect(await db.skillGroup.findMany({ where: { profileId } })).toHaveLength(1);
    } finally {
      await db.profile.delete({ where: { id: profileId } });
      await deleteTestUser(otherUserId);
    }
  });
});
