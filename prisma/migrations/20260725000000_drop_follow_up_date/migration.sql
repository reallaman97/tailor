-- Follow-up is now derived purely from the Updated timestamp; the manual
-- follow-up date field is removed.
ALTER TABLE "Resume" DROP COLUMN "followUpDate";
