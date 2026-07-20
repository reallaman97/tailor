-- Skill categories are now free text, editable per profile by a superadmin,
-- instead of a fixed 4-value enum.

ALTER TABLE "SkillGroup" ALTER COLUMN "category" TYPE TEXT USING "category"::text;

UPDATE "SkillGroup" SET "category" = CASE "category"
  WHEN 'LANGUAGES' THEN 'Languages'
  WHEN 'FRAMEWORKS' THEN 'Frameworks'
  WHEN 'TOOLS' THEN 'Tools'
  WHEN 'SOFT_SKILLS' THEN 'Soft skills'
  ELSE "category"
END;

DROP TYPE "SkillCategory";
