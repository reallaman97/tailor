import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestProfile, deleteTestProfile } from "@/lib/profile/test-helpers";
import {
  listSkillGroups,
  createSkillGroup,
  updateSkillGroupSkills,
  renameSkillGroupCategory,
  deleteSkillGroup,
  upsertSkillGroupSkills,
  DuplicateCategoryError,
  CategoryNotFoundError,
} from "@/lib/profile/skills";

describe("skills (integration)", () => {
  let profileId: string;

  beforeAll(async () => {
    profileId = await createTestProfile();
  });

  afterAll(async () => {
    await deleteTestProfile(profileId);
  });

  it("returns no categories before any are created", async () => {
    expect(await listSkillGroups(profileId)).toEqual([]);
  });

  it("creates categories in insertion order and lets skills be updated", async () => {
    await createSkillGroup(profileId, { category: "Languages", skills: ["TypeScript", "Python"] });
    await createSkillGroup(profileId, { category: "Tools", skills: ["Docker"] });

    let groups = await listSkillGroups(profileId);
    expect(groups.map((g) => g.category)).toEqual(["Languages", "Tools"]);
    expect(groups.find((g) => g.category === "Languages")?.skills).toEqual(["TypeScript", "Python"]);

    await updateSkillGroupSkills(profileId, "Languages", ["Go"]);
    groups = await listSkillGroups(profileId);
    expect(groups.find((g) => g.category === "Languages")?.skills).toEqual(["Go"]);
  });

  it("refuses to create a duplicate category name on the same profile", async () => {
    await expect(
      createSkillGroup(profileId, { category: "Tools", skills: ["Kubernetes"] })
    ).rejects.toThrow(DuplicateCategoryError);
  });

  it("refuses to update skills for a category that doesn't exist", async () => {
    await expect(
      updateSkillGroupSkills(profileId, "Nonexistent", ["x"])
    ).rejects.toThrow(CategoryNotFoundError);
  });

  it("renames a category, refusing a name collision", async () => {
    await createSkillGroup(profileId, { category: "Frameworks", skills: ["React"] });

    await renameSkillGroupCategory(profileId, "Frameworks", "Libraries & Frameworks");
    const groups = await listSkillGroups(profileId);
    expect(groups.map((g) => g.category)).toContain("Libraries & Frameworks");
    expect(groups.find((g) => g.category === "Libraries & Frameworks")?.skills).toEqual(["React"]);

    await expect(
      renameSkillGroupCategory(profileId, "Libraries & Frameworks", "Tools")
    ).rejects.toThrow(DuplicateCategoryError);
  });

  it("deletes a category entirely, not just clearing its skills", async () => {
    await deleteSkillGroup(profileId, "Libraries & Frameworks");
    const groups = await listSkillGroups(profileId);
    expect(groups.map((g) => g.category)).not.toContain("Libraries & Frameworks");
  });

  it("upsert creates the category if missing, or overwrites skills if it exists", async () => {
    await upsertSkillGroupSkills(profileId, "Soft skills", ["Communication"]);
    let groups = await listSkillGroups(profileId);
    expect(groups.find((g) => g.category === "Soft skills")?.skills).toEqual(["Communication"]);

    await upsertSkillGroupSkills(profileId, "Soft skills", ["Leadership"]);
    groups = await listSkillGroups(profileId);
    expect(groups.find((g) => g.category === "Soft skills")?.skills).toEqual(["Leadership"]);
  });
});
