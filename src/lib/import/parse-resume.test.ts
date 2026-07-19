import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { parseResumeText } from "./parse-resume";

describe("parseResumeText", () => {
  const originalKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    if (originalKey) process.env.OPENAI_API_KEY = originalKey;
  });

  it("throws a clear error when OPENAI_API_KEY is not set", async () => {
    await expect(parseResumeText("some resume text")).rejects.toThrow(
      /OPENAI_API_KEY environment variable is not set/
    );
  });
});
