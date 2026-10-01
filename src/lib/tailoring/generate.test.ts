import { describe, it, expect, afterEach } from "vitest";
import { generateTailoredContent, buildInput, parseModelOutput, InvalidModelOutputError } from "./generate";
import { NoDeepSeekApiKeyError } from "@/lib/settings";
import { ResumePromptMissingError } from "./resume-prompt";
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

const VALID_OUTPUT = {
  resume: {
    headline: "Senior Implementation Engineer",
    summary: "Summary.",
    experience: [{ entryId: "wh-1", jobTitle: "Senior Implementation Engineer", bullets: ["Did a thing."] }],
    skills: [{ category: "Integration", skills: ["FHIR", "HL7 v2"] }],
    certifications: ["AWS Certified Cloud Practitioner"],
  },
  validationReport: {
    atsMatchScore: 92,
    aiProbability: 14,
    researchContributionCheck: "Two research bullets.",
    evidencePlacementCheck: "Required stack in latest role.",
    titleRealismCheck: "Natural progression.",
    gapsAndRisks: ["No Salesforce experience."],
  },
};

describe("buildInput (PII minimisation + token economy)", () => {
  const role = (id: string, start: string) => ({
    id,
    company: `Company started ${start}`,
    jobTitle: "Engineer",
    location: null,
    workingStyle: null,
    workingType: null,
    startDate: start,
    endDate: null,
    achievements: [`Did the ${start} work.`],
  });
  const fields: ResumeFields = {
    ...MINIMAL_RESUME_FIELDS,
    contactEmail: "secret-pii@example.com",
    phone: "555-SECRET",
    linkedinUrl: "https://linkedin.com/in/secret",
    professionalSummary: "Seasoned engineer",
    workHistory: [role("cuid-older-0000000000000", "2015-01"), role("cuid-newer-0000000000000", "2021-06")],
    skills: [{ category: "Languages", skills: ["TypeScript"] }],
  };

  it("never sends contact details or the name, but keeps resume-relevant fields", () => {
    const { text } = buildInput(fields, "job description here");
    for (const secret of ["secret-pii@example.com", "555-SECRET", "linkedin.com/in/secret", "Jane Doe"]) {
      expect(text).not.toContain(secret);
    }
    expect(text).toContain("Seasoned engineer");
    expect(text).toContain("TypeScript");
    expect(text).toContain("job description here");
    // Labelled the way the output contract refers to them.
    expect(text).toContain("CURRENT RESUME (JSON):");
    expect(text).toContain("TARGET JOB DESCRIPTION:");
  });

  it("uses short role ids (newest first) instead of database ids, with the mapping back", () => {
    const { text, entryIds } = buildInput(fields, "jd");
    expect(text).not.toContain("cuid-");
    // r1 is the newest role.
    expect(text).toContain('{"id":"r1","title":"Engineer","company":"Company started 2021-06"');
    expect(text).toContain('{"id":"r2","title":"Engineer","company":"Company started 2015-01"');
    expect(entryIds).toEqual(["cuid-newer-0000000000000", "cuid-older-0000000000000"]);
  });

  it("sends compact JSON without empty fields, and drops legal boilerplate from the description", () => {
    const { text } = buildInput(fields, "Build APIs.\n\nWe are an Equal Opportunity Employer and do not discriminate.");
    expect(text).not.toMatch(/\n {2}"/); // no pretty-printing
    expect(text).not.toContain("null");
    expect(text).not.toContain('"certifications"'); // empty sections omitted
    expect(text).toContain("Build APIs.");
    expect(text).not.toContain("Equal Opportunity");
  });
});

describe("parseModelOutput", () => {
  it("parses a well-formed answer", () => {
    const out = parseModelOutput(JSON.stringify(VALID_OUTPUT));
    expect(out.resume.experience[0].jobTitle).toBe("Senior Implementation Engineer");
    expect(out.validationReport.atsMatchScore).toBe(92);
  });

  it("tolerates a ```json fence and string scores", () => {
    const withStrings = {
      ...VALID_OUTPUT,
      validationReport: { ...VALID_OUTPUT.validationReport, atsMatchScore: "88", aiProbability: "12" },
    };
    const out = parseModelOutput("```json\n" + JSON.stringify(withStrings) + "\n```");
    expect(out.validationReport.atsMatchScore).toBe(88);
    expect(out.validationReport.aiProbability).toBe(12);
  });

  it("rejects empty content, non-JSON, and a missing resume", () => {
    expect(() => parseModelOutput("")).toThrow(InvalidModelOutputError);
    expect(() => parseModelOutput("Could you share your resume?")).toThrow(InvalidModelOutputError);
    expect(() => parseModelOutput(JSON.stringify({ validationReport: VALID_OUTPUT.validationReport }))).toThrow(
      InvalidModelOutputError
    );
  });
});

describe("generateTailoredContent configuration errors (no live call)", () => {
  const originalKey = process.env.DEEPSEEK_API_KEY;
  const originalPrompt = process.env.RESUME_PROMPT_B64;

  afterEach(() => {
    if (originalKey) process.env.DEEPSEEK_API_KEY = originalKey;
    else delete process.env.DEEPSEEK_API_KEY;
    if (originalPrompt) process.env.RESUME_PROMPT_B64 = originalPrompt;
    else delete process.env.RESUME_PROMPT_B64;
  });

  it("throws a clear error when the secret prompt isn't configured", async () => {
    delete process.env.RESUME_PROMPT_B64;
    process.env.DEEPSEEK_API_KEY = "sk-unused";
    await expect(
      generateTailoredContent(MINIMAL_RESUME_FIELDS, "some job description", { model: "deepseek-flash" })
    ).rejects.toThrow(ResumePromptMissingError);
  });

  it("throws a clear error when no DeepSeek key is configured", async () => {
    process.env.RESUME_PROMPT_B64 = Buffer.from("Test prompt").toString("base64");
    delete process.env.DEEPSEEK_API_KEY;
    await expect(
      generateTailoredContent(MINIMAL_RESUME_FIELDS, "some job description", { model: "deepseek-flash" })
    ).rejects.toThrow(NoDeepSeekApiKeyError);
  });
});
