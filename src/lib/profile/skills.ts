import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import type { SkillGroupInput } from "@/lib/profile/schemas";

export type SkillGroupView = {
  category: string;
  skills: string[];
};

export class DuplicateCategoryError extends Error {
  constructor() {
    super("A category with that name already exists on this profile");
  }
}

export class CategoryNotFoundError extends Error {
  constructor() {
    super("Skill category not found");
  }
}

function isUniqueConstraintViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

export async function listSkillGroups(profileId: string): Promise<SkillGroupView[]> {
  const groups = await db.skillGroup.findMany({
    where: { profileId },
    orderBy: { sortOrder: "asc" },
  });
  return groups.map((g) => ({ category: g.category, skills: g.skills }));
}

/** Adds a brand-new category to this profile. Fails if the name is already used here. */
export async function createSkillGroup(profileId: string, input: SkillGroupInput): Promise<void> {
  const count = await db.skillGroup.count({ where: { profileId } });
  try {
    await db.skillGroup.create({
      data: { profileId, category: input.category, skills: input.skills, sortOrder: count },
    });
  } catch (err) {
    if (isUniqueConstraintViolation(err)) throw new DuplicateCategoryError();
    throw err;
  }
}

/** Replaces the skill list for an existing category (does not create or delete categories). */
export async function updateSkillGroupSkills(
  profileId: string,
  category: string,
  skills: string[]
): Promise<void> {
  const result = await db.skillGroup.updateMany({
    where: { profileId, category },
    data: { skills },
  });
  if (result.count === 0) throw new CategoryNotFoundError();
}

/** Renames an existing category. Fails if the new name is already used on this profile. */
export async function renameSkillGroupCategory(
  profileId: string,
  oldCategory: string,
  newCategory: string
): Promise<void> {
  if (oldCategory === newCategory) return;
  try {
    const result = await db.skillGroup.updateMany({
      where: { profileId, category: oldCategory },
      data: { category: newCategory },
    });
    if (result.count === 0) throw new CategoryNotFoundError();
  } catch (err) {
    if (isUniqueConstraintViolation(err)) throw new DuplicateCategoryError();
    throw err;
  }
}

export async function deleteSkillGroup(profileId: string, category: string): Promise<void> {
  await db.skillGroup.deleteMany({ where: { profileId, category } });
}

/** Creates the category if it doesn't exist yet, otherwise overwrites its skills — used by resume import. */
export async function upsertSkillGroupSkills(
  profileId: string,
  category: string,
  skills: string[]
): Promise<void> {
  try {
    await updateSkillGroupSkills(profileId, category, skills);
  } catch (err) {
    if (err instanceof CategoryNotFoundError) {
      await createSkillGroup(profileId, { category, skills });
      return;
    }
    throw err;
  }
}
