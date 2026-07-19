import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { generateTailoredContent } from "./generate";
import type { ResumeFields } from "@/lib/profile/resume-fields";

const MINIMAL_RESUME_FIELDS: ResumeFields = {
  fullName: "Jane Doe",
  contactEmail: "jane@example.com",
  phone: "555-0100",
  linkedinUrl: null,
  professionalSummary: null,
  city: null,
  state: null,
  workHistory: [],
  education: [],
  skills: { languages: [], frameworks: [], tools: [], softSkills: [] },
};

describe("generateTailoredContent", () => {
  const originalKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    if (originalKey) process.env.OPENAI_API_KEY = originalKey;
  });

  it("throws a clear error when OPENAI_API_KEY is not set", async () => {
    await expect(
      generateTailoredContent(MINIMAL_RESUME_FIELDS, "some job description")
    ).rejects.toThrow(/OPENAI_API_KEY environment variable is not set/);
  });
});
