import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { generateTailoredContent, buildInput } from "./generate";
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
  certifications: [],
  skills: [],
};

describe("buildInput (PII minimisation)", () => {
  it("never sends contact email or phone to the model, but keeps resume-relevant fields", () => {
    const fields: ResumeFields = {
      ...MINIMAL_RESUME_FIELDS,
      contactEmail: "secret-pii@example.com",
      phone: "555-SECRET",
      professionalSummary: "Seasoned engineer",
      skills: [{ category: "Languages", skills: ["TypeScript"] }],
    };

    const input = buildInput(fields, "job description here");

    expect(input).not.toContain("secret-pii@example.com");
    expect(input).not.toContain("555-SECRET");
    // Fields the model legitimately needs are still present.
    expect(input).toContain("Jane Doe");
    expect(input).toContain("Seasoned engineer");
    expect(input).toContain("TypeScript");
    expect(input).toContain("job description here");
  });
});

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
