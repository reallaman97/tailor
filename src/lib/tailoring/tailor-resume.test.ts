import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { createTestUser, deleteTestUser, MINIMAL_PERSONAL_INFO } from "@/lib/profile/test-helpers";
import { createProfile } from "@/lib/profile/personal-info";
import { assignProfileToUser } from "@/lib/admin/profiles";
import { getProfileDek } from "@/lib/profile/dek";
import { encryptJson } from "@/lib/profile/crypto";
import { createResume } from "@/lib/resumes/resumes";
import { ResumeNotFoundError } from "@/lib/resumes/resumes";
import { RateLimitExceededError, recordUsageEvent } from "@/lib/tailoring/usage";
import { tailorResume, getTailoredContent, sanitizeTailoredContent, ProfileIncompleteError } from "./tailor-resume";

describe("sanitizeTailoredContent (pure)", () => {
  it("drops work history entries with an entryId the candidate doesn't have", () => {
    const result = sanitizeTailoredContent(
      {
        summary: "A summary",
        workHistory: [
          { entryId: "real-1", bullets: ["kept"] },
          { entryId: "hallucinated-id", bullets: ["dropped"] },
        ],
        orderedSkills: [],
      },
      new Set(["real-1"]),
      []
    );
    expect(result.workHistory).toEqual([{ entryId: "real-1", bullets: ["kept"] }]);
  });

  it("drops skills not in the candidate's real skill list, case-insensitively matching kept ones", () => {
    const result = sanitizeTailoredContent(
      { summary: "s", workHistory: [], orderedSkills: ["typescript", "Hallucinated Skill", "PYTHON"] },
      new Set(),
      ["TypeScript", "Python"]
    );
    // Preserves the original casing from the candidate's real list, not the model's casing.
    expect(result.orderedSkills).toEqual(["TypeScript", "Python"]);
  });

  it("preserves the model's ordering among kept skills", () => {
    const result = sanitizeTailoredContent(
      { summary: "s", workHistory: [], orderedSkills: ["Go", "Rust"] },
      new Set(),
      ["Rust", "Go"]
    );
    expect(result.orderedSkills).toEqual(["Go", "Rust"]);
  });
});

describe("tailorResume error paths (integration, no live LLM call)", () => {
  let userId: string;
  let profileId: string | undefined;

  beforeAll(async () => {
    ({ id: userId } = await createTestUser());
  });

  afterAll(async () => {
    if (profileId) await db.profile.delete({ where: { id: profileId } });
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

  it("throws RateLimitExceededError before ever calling the LLM once the daily cap is hit", async () => {
    profileId = await createProfile(MINIMAL_PERSONAL_INFO);
    await assignProfileToUser(profileId, userId);
    const resumeId = await createResume(userId, {
      jobLink: undefined,
      companyName: "Globex",
      jobTitle: "Manager",
      jobDescription: "A description that is definitely long enough to pass validation.",
    });

    // No OPENAI_API_KEY is configured in this test environment, so if
    // tailorResume reached the LLM call it would throw a different, unrelated
    // error — asserting RateLimitExceededError here proves the rate limit
    // check runs (and blocks) before that point.
    for (let i = 0; i < 3; i++) {
      await recordUsageEvent({
        userId,
        kind: "tailoring",
        model: "gpt-4.1-mini",
        inputTokens: 10,
        outputTokens: 10,
      });
    }

    const originalLimit = process.env.TAILORING_DAILY_LIMIT;
    process.env.TAILORING_DAILY_LIMIT = "3";
    try {
      await expect(tailorResume(userId, resumeId)).rejects.toThrow(RateLimitExceededError);
    } finally {
      if (originalLimit) process.env.TAILORING_DAILY_LIMIT = originalLimit;
      else delete process.env.TAILORING_DAILY_LIMIT;
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
