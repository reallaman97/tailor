-- Caller weekly availability. One row per available hour slot, keyed by
-- day-of-week (0=Sun..6=Sat) and hour (0..23) in the platform timezone.
-- Presence = available; a caller's set is replaced wholesale on save.

-- CreateTable
CREATE TABLE "CallerAvailability" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "hour" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallerAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CallerAvailability_userId_idx" ON "CallerAvailability"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CallerAvailability_userId_dayOfWeek_hour_key" ON "CallerAvailability"("userId", "dayOfWeek", "hour");

-- AddForeignKey
ALTER TABLE "CallerAvailability" ADD CONSTRAINT "CallerAvailability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
