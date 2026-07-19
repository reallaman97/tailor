import { db } from "@/lib/db";
import { requireProfileId } from "@/lib/profile/shared";
import type { SkillGroupInput } from "@/lib/profile/schemas";
import { SkillCategory } from "@/generated/prisma/client";

const CATEGORY_ORDER: SkillCategory[] = ["LANGUAGES", "FRAMEWORKS", "TOOLS", "SOFT_SKILLS"];

export type SkillGroupView = {
  category: SkillCategory;
  skills: string[];
};

export async function listSkillGroups(userId: string): Promise<SkillGroupView[]> {
  const profile = await db.profile.findUnique({ where: { userId }, select: { id: true } });
  const groups = profile
    ? await db.skillGroup.findMany({ where: { profileId: profile.id } })
    : [];

  const byCategory = new Map(groups.map((g) => [g.category, g.skills]));
  return CATEGORY_ORDER.map((category) => ({
    category,
    skills: byCategory.get(category) ?? [],
  }));
}

export async function saveSkillGroup(userId: string, input: SkillGroupInput): Promise<void> {
  const profileId = await requireProfileId(userId);

  if (input.skills.length === 0) {
    await db.skillGroup.deleteMany({ where: { profileId, category: input.category } });
    return;
  }

  await db.skillGroup.upsert({
    where: { profileId_category: { profileId, category: input.category } },
    create: { profileId, category: input.category, skills: input.skills },
    update: { skills: input.skills },
  });
}
