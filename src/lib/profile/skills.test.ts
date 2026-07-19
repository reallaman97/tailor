import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestUser, deleteTestUser, MINIMAL_PERSONAL_INFO } from "@/lib/profile/test-helpers";
import { savePersonalInfo } from "@/lib/profile/personal-info";
import { ProfileNotFoundError } from "@/lib/profile/shared";
import { listSkillGroups, saveSkillGroup } from "@/lib/profile/skills";

describe("skills (integration)", () => {
  let userId: string;

  beforeAll(async () => {
    ({ id: userId } = await createTestUser());
  });

  afterAll(async () => {
    await deleteTestUser(userId);
  });

  it("returns all four categories, empty, before a profile exists", async () => {
    const groups = await listSkillGroups(userId);
    expect(groups.map((g) => g.category)).toEqual([
      "LANGUAGES",
      "FRAMEWORKS",
      "TOOLS",
      "SOFT_SKILLS",
    ]);
    expect(groups.every((g) => g.skills.length === 0)).toBe(true);
  });

  it("refuses to save before a profile exists", async () => {
    await expect(
      saveSkillGroup(userId, { category: "LANGUAGES", skills: ["TypeScript"] })
    ).rejects.toThrow(ProfileNotFoundError);
  });

  it("saves and updates (upsert) a category's skills", async () => {
    await savePersonalInfo(userId, MINIMAL_PERSONAL_INFO);

    await saveSkillGroup(userId, { category: "LANGUAGES", skills: ["TypeScript", "Python"] });
    await saveSkillGroup(userId, { category: "TOOLS", skills: ["Docker"] });

    let groups = await listSkillGroups(userId);
    expect(groups.find((g) => g.category === "LANGUAGES")?.skills).toEqual([
      "TypeScript",
      "Python",
    ]);
    expect(groups.find((g) => g.category === "TOOLS")?.skills).toEqual(["Docker"]);
    expect(groups.find((g) => g.category === "FRAMEWORKS")?.skills).toEqual([]);

    // Re-saving the same category overwrites rather than duplicating.
    await saveSkillGroup(userId, { category: "LANGUAGES", skills: ["Go"] });
    groups = await listSkillGroups(userId);
    expect(groups.find((g) => g.category === "LANGUAGES")?.skills).toEqual(["Go"]);
  });

  it("removes the group when saved with an empty skill list", async () => {
    await saveSkillGroup(userId, { category: "TOOLS", skills: [] });
    const groups = await listSkillGroups(userId);
    expect(groups.find((g) => g.category === "TOOLS")?.skills).toEqual([]);
  });
});
