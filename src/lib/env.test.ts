import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getServerEnv, _resetServerEnvCache } from "./env";

const KEYS = [
  "DATABASE_URL",
  "MASTER_KEY",
  "AUTH_SECRET",
  "APP_URL",
  "EMAIL_FROM",
  "OPENAI_MODEL",
] as const;

describe("getServerEnv", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of KEYS) saved[key] = process.env[key];
    // A valid baseline; individual tests override to exercise failures.
    process.env.DATABASE_URL = "postgresql://u:p@localhost:5432/db";
    process.env.MASTER_KEY = Buffer.alloc(32).toString("base64");
    process.env.AUTH_SECRET = "test-secret";
    _resetServerEnvCache();
  });

  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    _resetServerEnvCache();
  });

  it("parses a valid environment and applies documented defaults", () => {
    delete process.env.APP_URL;
    delete process.env.EMAIL_FROM;
    delete process.env.OPENAI_MODEL;
    _resetServerEnvCache();

    const env = getServerEnv();
    expect(env.APP_URL).toBe("http://localhost:3000");
    expect(env.EMAIL_FROM).toBe("onboarding@resend.dev");
    expect(env.OPENAI_MODEL).toBe("gpt-4.1-mini");
  });

  it("rejects a MASTER_KEY that doesn't decode to 32 bytes", () => {
    process.env.MASTER_KEY = "too-short";
    _resetServerEnvCache();
    expect(() => getServerEnv()).toThrow(/MASTER_KEY/);
  });

  it("rejects a missing DATABASE_URL", () => {
    delete process.env.DATABASE_URL;
    _resetServerEnvCache();
    expect(() => getServerEnv()).toThrow(/DATABASE_URL/);
  });
});
