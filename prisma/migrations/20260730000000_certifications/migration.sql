-- Candidate certifications — a resume section, mirroring EducationEntry
-- (plaintext, per-profile, sortOrder-ordered).

-- CreateTable
CREATE TABLE "CertificationEntry" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT,
    "issueDate" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CertificationEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CertificationEntry_profileId_idx" ON "CertificationEntry"("profileId");

-- AddForeignKey
ALTER TABLE "CertificationEntry" ADD CONSTRAINT "CertificationEntry_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
