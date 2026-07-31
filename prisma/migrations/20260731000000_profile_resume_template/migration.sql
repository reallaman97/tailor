-- Per-profile resume PDF style key (see src/lib/export/styles.ts).
-- Null = use the app-wide default (AppSettings.resumeTemplate).
ALTER TABLE "Profile" ADD COLUMN "resumeTemplate" TEXT;
