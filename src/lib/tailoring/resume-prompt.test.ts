import { describe, it, expect, afterEach } from "vitest";
import { createHash } from "node:crypto";
import { getResumePrompt, getResumePromptFingerprint, ResumePromptMissingError } from "./resume-prompt";

// Characters that commonly get mangled by copy/paste or re-encoding.
const PROMPT = "# TITLE\n\nThe candidate’s path: A → B → C.\nInclude 90–100% of keywords.\n\n---\n";

describe("resume prompt (env-only secret)", () => {
  const original = process.env.RESUME_PROMPT_B64;

  afterEach(() => {
    if (original) process.env.RESUME_PROMPT_B64 = original;
    else delete process.env.RESUME_PROMPT_B64;
  });

  it("decodes the prompt byte-for-byte, with no trimming or rewriting", () => {
    process.env.RESUME_PROMPT_B64 = Buffer.from(PROMPT, "utf8").toString("base64");
    expect(getResumePrompt()).toBe(PROMPT);
  });

  it("throws when the prompt isn't configured", () => {
    delete process.env.RESUME_PROMPT_B64;
    expect(() => getResumePrompt()).toThrow(ResumePromptMissingError);
    expect(getResumePromptFingerprint()).toEqual({ configured: false });
  });

  it("fingerprints the prompt without exposing its text", () => {
    process.env.RESUME_PROMPT_B64 = Buffer.from(PROMPT, "utf8").toString("base64");
    const fp = getResumePromptFingerprint();
    expect(fp).toEqual({
      configured: true,
      sha256: createHash("sha256").update(PROMPT, "utf8").digest("hex"),
      characters: PROMPT.length,
      words: PROMPT.split(/\s+/).filter(Boolean).length,
    });
    expect(JSON.stringify(fp)).not.toContain("candidate");
  });
});
