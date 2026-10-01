import { describe, it, expect, afterEach } from "vitest";
import {
  getSettings,
  updateSettings,
  getOpenAiApiKey,
  NoOpenAiApiKeyError,
  getDeepSeekApiKey,
  NoDeepSeekApiKeyError,
  DEFAULT_OPENAI_MODEL,
} from "./settings";
import { db } from "@/lib/db";
import { DEFAULT_RESUME_MODEL } from "@/lib/tailoring/models";

describe("app settings (integration)", () => {
  afterEach(async () => {
    // This is a single global row shared with the running dev server — reset
    // it (including clearing any custom API key) after each test so other
    // tests/manual usage see defaults again.
    await updateSettings({
      openaiModel: DEFAULT_OPENAI_MODEL,
      resumeModel: DEFAULT_RESUME_MODEL,
      resumeTemplate: "MODERN",
      openaiApiKey: null,
    });
  });

  it("returns the built-in defaults before anything has been customized", async () => {
    const settings = await getSettings();
    expect(settings.openaiModel).toBe(DEFAULT_OPENAI_MODEL);
    expect(settings.resumeModel).toBe(DEFAULT_RESUME_MODEL);
    expect(settings.resumeTemplate).toBe("MODERN");
    expect(settings.hasCustomApiKey).toBe(false);
    expect(settings.apiKeyHint).toBeNull();
    // The resume prompt is secret — it must never be part of the settings view.
    expect(settings).not.toHaveProperty("tailoringPrompt");
  });

  it("persists an updated OpenAI model, resume model, and template", async () => {
    await updateSettings({
      openaiModel: "gpt-4.1",
      resumeModel: "deepseek-flash",
      resumeTemplate: "CLASSIC",
    });

    const settings = await getSettings();
    expect(settings.openaiModel).toBe("gpt-4.1");
    expect(settings.resumeModel).toBe("deepseek-flash");
    expect(settings.resumeTemplate).toBe("CLASSIC");
  });

  it("falls back to the default resume model when a non-DeepSeek model is stored", async () => {
    // e.g. a row migrated from when resume generation ran on OpenAI.
    await db.appSettings.update({ where: { id: "singleton" }, data: { resumeModel: "gpt-4.1-mini" } });
    expect((await getSettings()).resumeModel).toBe(DEFAULT_RESUME_MODEL);
  });

  it("reads the DeepSeek key from the environment only", () => {
    const original = process.env.DEEPSEEK_API_KEY;
    try {
      process.env.DEEPSEEK_API_KEY = "sk-deepseek-test";
      expect(getDeepSeekApiKey()).toBe("sk-deepseek-test");
      delete process.env.DEEPSEEK_API_KEY;
      expect(() => getDeepSeekApiKey()).toThrow(NoDeepSeekApiKeyError);
    } finally {
      if (original) process.env.DEEPSEEK_API_KEY = original;
      else delete process.env.DEEPSEEK_API_KEY;
    }
  });

  it("stores a custom API key encrypted, exposing only a masked hint", async () => {
    await updateSettings({
      openaiModel: DEFAULT_OPENAI_MODEL,
      resumeModel: DEFAULT_RESUME_MODEL,
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
      resumeModel: DEFAULT_RESUME_MODEL,
      resumeTemplate: "MODERN",
      openaiApiKey: "sk-test-abcd1234",
    });
    await updateSettings({
      openaiModel: DEFAULT_OPENAI_MODEL,
      resumeModel: DEFAULT_RESUME_MODEL,
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
