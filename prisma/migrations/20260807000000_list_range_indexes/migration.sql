-- The Applications lists load a recent date range instead of every application (src/app/resumes/page.tsx).
CREATE INDEX IF NOT EXISTS "Resume_teamId_createdAt_idx" ON "Resume"("teamId", "createdAt");
CREATE INDEX IF NOT EXISTS "Resume_userId_createdAt_idx" ON "Resume"("userId", "createdAt");
