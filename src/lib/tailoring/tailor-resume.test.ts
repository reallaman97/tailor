import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { createTestUser, deleteTestUser, MINIMAL_PERSONAL_INFO } from "@/lib/profile/test-helpers";
import { createProfile } from "@/lib/profile/personal-info";
import { assignProfileToUser } from "@/lib/admin/profiles";
import { getProfileDek } from "@/lib/profile/dek";
import { encryptJson } from "@/lib/profile/crypto";
import { createResume } from "@/lib/resumes/resumes";
import { ResumeNotFoundError } from "@/lib/resumes/resumes";
import {
  tailorResume,
  getTailoredContent,
  sanitizeTailoredContent,
  ProfileIncompleteError,
  NO_BASE_RESUME_MESSAGE,
} from "./tailor-resume";
import { createWorkHistoryEntry } from "@/lib/profile/work-history";
import type { ModelOutput } from "./schema";

const EMPTY_REPORT: ModelOutput["validationReport"] = {
  atsMatchScore: 0,
  aiProbability: 0,
  researchContributionCheck: "",
  evidencePlacementCheck: "",
  titleRealismCheck: "",
  gapsAndRisks: [],
};

/** A model answer with everything empty except what a test overrides. */
function modelOutput(
  resume: Partial<ModelOutput["resume"]> = {},
  validationReport: Partial<ModelOutput["validationReport"]> = {}
): ModelOutput {
  return {
    resume: { headline: "h", summary: "s", experience: [], skills: [], certifications: [], ...resume },
    validationReport: { ...EMPTY_REPORT, ...validationReport },
  };
}

describe("sanitizeTailoredContent (pure)", () => {
  it("drops work history entries with an entryId the candidate doesn't have (or repeats)", () => {
    const result = sanitizeTailoredContent(
      modelOutput({
        experience: [
          { entryId: "real-1", jobTitle: "Integration Engineer", bullets: ["kept"] },
          { entryId: "hallucinated-id", jobTitle: "CTO", bullets: ["dropped"] },
          { entryId: "real-1", jobTitle: "Duplicate", bullets: ["dropped"] },
        ],
      }),
      new Set(["real-1"]),
      []
    );
    expect(result.workHistory).toEqual([{ entryId: "real-1", jobTitle: "Integration Engineer", bullets: ["kept"] }]);
  });

  it("trims realigned titles and caps absurdly long ones", () => {
    const result = sanitizeTailoredContent(
      modelOutput({
        experience: [
          { entryId: "a", jobTitle: "  Senior Implementation Engineer  ", bullets: [] },
          { entryId: "b", jobTitle: "X".repeat(500), bullets: [] },
        ],
      }),
      new Set(["a", "b"]),
      []
    );
    expect(result.workHistory[0].jobTitle).toBe("Senior Implementation Engineer");
    expect(result.workHistory[1].jobTitle.length).toBe(100);
  });

  it("keeps the model's skill categories but trims, dedupes, and drops empties", () => {
    const result = sanitizeTailoredContent(
      modelOutput({
        skills: [
          { category: "Languages", skills: ["TypeScript", " TypeScript ", "Python", ""] },
          { category: "Empty", skills: ["   "] },
        ],
      }),
      new Set(),
      []
    );
    expect(result.skillCategories).toEqual([{ category: "Languages", skills: ["TypeScript", "Python"] }]);
  });

  it("keeps only real certifications, case-insensitively, preserving real casing and model order", () => {
    const result = sanitizeTailoredContent(
      modelOutput({ certifications: ["aws certified solutions architect", "Fabricated Cert", "CKA"] }),
      new Set(),
      ["CKA", "AWS Certified Solutions Architect"]
    );
    expect(result.orderedCertifications).toEqual(["AWS Certified Solutions Architect", "CKA"]);
  });

  it("clamps report scores to whole percentages and drops blank notes", () => {
    const result = sanitizeTailoredContent(
      modelOutput({}, { atsMatchScore: 92.6, aiProbability: -5, gapsAndRisks: [" Salesforce gap ", "", "  "] }),
      new Set(),
      []
    );
    expect(result.validationReport.atsMatchScore).toBe(93);
    expect(result.validationReport.aiProbability).toBe(0);
    expect(result.validationReport.gapsAndRisks).toEqual(["Salesforce gap"]);
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

  it("refuses to generate (before any LLM call) when the profile has no base resume", async () => {
    const profileId = await createProfile(MINIMAL_PERSONAL_INFO);
    const { id: bidderId } = await createTestUser();
    try {
      await assignProfileToUser(profileId, bidderId);
      await createWorkHistoryEntry(profileId, {
        company: "Acme",
        jobTitle: "Engineer",
        location: undefined,
        workingStyle: undefined,
        workingType: undefined,
        startDate: "2020-01",
        endDate: undefined,
        achievements: ["Built things."],
      });
      const resumeId = await createResume(bidderId, {
        jobLink: undefined,
        companyName: "Target Co",
        jobTitle: "Engineer",
        jobDescription: "A description that is definitely long enough to pass validation.",
      });

      await expect(tailorResume(bidderId, resumeId)).rejects.toThrow(NO_BASE_RESUME_MESSAGE);
    } finally {
      await deleteTestUser(bidderId);
      await db.profile.delete({ where: { id: profileId } });
    }
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
