import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { generateTailoredContent } from "./generate";
import { updateSettings, NoOpenAiApiKeyError, DEFAULT_TAILORING_PROMPT, DEFAULT_OPENAI_MODEL } from "@/lib/settings";
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
  skills: [],
};

describe("generateTailoredContent", () => {
  const originalKey = process.env.OPENAI_API_KEY;

  beforeEach(async () => {
    delete process.env.OPENAI_API_KEY;
    // Ensure no custom Settings key is left over from another test/run.
    await updateSettings({
      openaiModel: DEFAULT_OPENAI_MODEL,
      tailoringPrompt: DEFAULT_TAILORING_PROMPT,
      resumeTemplate: "MODERN",
      openaiApiKey: null,
    });
  });

  afterEach(() => {
    if (originalKey) process.env.OPENAI_API_KEY = originalKey;
  });

  it("throws a clear error when no API key is configured anywhere", async () => {
    await expect(
      generateTailoredContent(MINIMAL_RESUME_FIELDS, "some job description", {
        model: "gpt-4.1-mini",
        systemPrompt: "irrelevant for this test",
      })
    ).rejects.toThrow(NoOpenAiApiKeyError);
  });
});
