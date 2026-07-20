import { describe, it, expect, afterEach } from "vitest";
import {
  getSettings,
  updateSettings,
  getOpenAiApiKey,
  NoOpenAiApiKeyError,
  DEFAULT_TAILORING_PROMPT,
  DEFAULT_OPENAI_MODEL,
} from "./settings";

describe("app settings (integration)", () => {
  afterEach(async () => {
    // This is a single global row shared with the running dev server — reset
    // it (including clearing any custom API key) after each test so other
    // tests/manual usage see defaults again.
    await updateSettings({
      openaiModel: DEFAULT_OPENAI_MODEL,
      tailoringPrompt: DEFAULT_TAILORING_PROMPT,
      resumeTemplate: "MODERN",
      openaiApiKey: null,
    });
  });

  it("returns the built-in defaults before anything has been customized", async () => {
    const settings = await getSettings();
    expect(settings.openaiModel).toBe(DEFAULT_OPENAI_MODEL);
    expect(settings.tailoringPrompt).toBe(DEFAULT_TAILORING_PROMPT);
    expect(settings.resumeTemplate).toBe("MODERN");
    expect(settings.hasCustomApiKey).toBe(false);
    expect(settings.apiKeyHint).toBeNull();
  });

  it("persists an updated model, prompt, and template", async () => {
    await updateSettings({
      openaiModel: "gpt-4.1",
      tailoringPrompt: "Custom prompt text.",
      resumeTemplate: "CLASSIC",
    });

    const settings = await getSettings();
    expect(settings.openaiModel).toBe("gpt-4.1");
    expect(settings.tailoringPrompt).toBe("Custom prompt text.");
    expect(settings.resumeTemplate).toBe("CLASSIC");
  });

  it("stores a custom API key encrypted, exposing only a masked hint", async () => {
    await updateSettings({
      openaiModel: DEFAULT_OPENAI_MODEL,
      tailoringPrompt: DEFAULT_TAILORING_PROMPT,
      resumeTemplate: "MODERN",
      openaiApiKey: "sk-test-abcd1234",
    });

    const settings = await getSettings();
    expect(settings.hasCustomApiKey).toBe(true);
    expect(settings.apiKeyHint).toBe("••••1234");
    expect(settings.apiKeyHint).not.toContain("sk-test");

    expect(await getOpenAiApiKey()).toBe("sk-test-abcd1234");
  });

  it("clears the custom key back to the environment variable when set to null", async () => {
    await updateSettings({
      openaiModel: DEFAULT_OPENAI_MODEL,
      tailoringPrompt: DEFAULT_TAILORING_PROMPT,
      resumeTemplate: "MODERN",
      openaiApiKey: "sk-test-abcd1234",
    });
    await updateSettings({
      openaiModel: DEFAULT_OPENAI_MODEL,
      tailoringPrompt: DEFAULT_TAILORING_PROMPT,
      resumeTemplate: "MODERN",
      openaiApiKey: null,
    });

    const settings = await getSettings();
    expect(settings.hasCustomApiKey).toBe(false);
    expect(settings.apiKeyHint).toBeNull();
  });

  it("falls back to OPENAI_API_KEY when no custom key is set", async () => {
    const original = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "sk-env-fallback";
    try {
      expect(await getOpenAiApiKey()).toBe("sk-env-fallback");
    } finally {
      if (original) process.env.OPENAI_API_KEY = original;
      else delete process.env.OPENAI_API_KEY;
    }
  });

  it("throws when neither a custom key nor the environment variable is set", async () => {
    const original = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      await expect(getOpenAiApiKey()).rejects.toThrow(NoOpenAiApiKeyError);
    } finally {
      if (original) process.env.OPENAI_API_KEY = original;
    }
  });
});
