-- DropIndex
DROP INDEX "SkillGroup_profileId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "SkillGroup_profileId_category_key" ON "SkillGroup"("profileId", "category");
