-- MinHash signature of the job description: the near-duplicate check compares
-- these in the database instead of downloading recent descriptions (src/lib/resumes/duplicates.ts).
ALTER TABLE "Resume" ADD COLUMN IF NOT EXISTS "jdMinhash" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
