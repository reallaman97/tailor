import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { createTestUser, deleteTestUser, MINIMAL_PERSONAL_INFO } from "@/lib/profile/test-helpers";
import { createProfile } from "@/lib/profile/personal-info";
import { assignProfileToUser } from "@/lib/admin/profiles";
import { getProfileDek } from "@/lib/profile/dek";
import { encryptJson } from "@/lib/profile/crypto";
import { createResume } from "@/lib/resumes/resumes";
import { ResumeNotFoundError } from "@/lib/resumes/resumes";
import { tailorResume, getTailoredContent, sanitizeTailoredContent, ProfileIncompleteError } from "./tailor-resume";

describe("sanitizeTailoredContent (pure)", () => {
  it("drops work history entries with an entryId the candidate doesn't have", () => {
    const result = sanitizeTailoredContent(
      {
        headline: "h",
        summary: "A summary",
        workHistory: [
          { entryId: "real-1", bullets: ["kept"] },
          { entryId: "hallucinated-id", bullets: ["dropped"] },
        ],
        skillCategories: [],
        orderedCertifications: [],
      },
      new Set(["real-1"]),
      []
    );
    expect(result.workHistory).toEqual([{ entryId: "real-1", bullets: ["kept"] }]);
  });

  it("keeps the model's skill categories (ATS expansion allowed) but trims, dedupes, and drops empties", () => {
    const result = sanitizeTailoredContent(
      {
        headline: "h",
        summary: "s",
        workHistory: [],
        skillCategories: [
          { category: "Languages", skills: ["TypeScript", " TypeScript ", "Python", ""] },
          { category: "Empty", skills: ["   "] },
        ],
        orderedCertifications: [],
      },
      new Set(),
      []
    );
    expect(result.skillCategories).toEqual([{ category: "Languages", skills: ["TypeScript", "Python"] }]);
  });

  it("keeps only real certifications, case-insensitively, preserving real casing and model order", () => {
    const result = sanitizeTailoredContent(
      {
        headline: "h",
        summary: "s",
        workHistory: [],
        skillCategories: [],
        orderedCertifications: ["aws certified solutions architect", "Fabricated Cert", "CKA"],
      },
      new Set(),
      ["CKA", "AWS Certified Solutions Architect"]
    );
    expect(result.orderedCertifications).toEqual(["AWS Certified Solutions Architect", "CKA"]);
  });
});

describe("tailorResume error paths (integration, no live LLM call)", () => {
  let userId: string;

  beforeAll(async () => {
    ({ id: userId } = await createTestUser());
  });

  afterAll(async () => {
    await deleteTestUser(userId);
  });

  it("throws ResumeNotFoundError for a resume that doesn't belong to this user", async () => {
    await expect(tailorResume(userId, "nonexistent-id")).rejects.toThrow(ResumeNotFoundError);
  });

  it("throws ProfileIncompleteError before ever calling the LLM if no profile is saved", async () => {
    const resumeId = await createResume(userId, {
      jobLink: undefined,
      companyName: "Acme",
      jobTitle: "Engineer",
      jobDescription: "A description that is definitely long enough to pass validation.",
    });

    await expect(tailorResume(userId, resumeId)).rejects.toThrow(ProfileIncompleteError);
  });
});

describe("getTailoredContent (profile-DEK sharing)", () => {
  it("lets any teammate sharing the profile decrypt tailored content generated under it", async () => {
    const sharedProfileId = await createProfile(MINIMAL_PERSONAL_INFO);
    const { id: creatorId } = await createTestUser();
    const { id: teammateId } = await createTestUser();

    try {
      await assignProfileToUser(sharedProfileId, creatorId);
      await assignProfileToUser(sharedProfileId, teammateId);

      const resumeId = await createResume(creatorId, {
        jobLink: undefined,
        companyName: "Shared DEK Co",
        jobTitle: "Engineer",
        jobDescription: "A description that is definitely long enough to pass validation.",
      });

      // Simulate what tailorResume() would have written, without a live LLM call.
      const dek = await getProfileDek(sharedProfileId);
      const content = { summary: "Tailored summary", workHistory: [], orderedSkills: ["Go"] };
      await db.resume.update({
        where: { id: resumeId },
        data: { profileId: sharedProfileId, tailoredContentEnc: encryptJson(dek, content) },
      });

      const asCreator = await getTailoredContent(creatorId, resumeId);
      const asTeammate = await getTailoredContent(teammateId, resumeId);
      expect(asCreator).toEqual(content);
      expect(asTeammate).toEqual(content);
    } finally {
      await deleteTestUser(creatorId);
      await deleteTestUser(teammateId);
      await db.profile.delete({ where: { id: sharedProfileId } });
    }
  });
});
