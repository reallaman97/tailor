import { describe, it, expect } from "vitest";
import { generateResetToken, hashResetToken, resetTokenMatches } from "./reset-tokens";

describe("password reset tokens", () => {
  it("generates a raw token whose hash matches resetTokenMatches", () => {
    const { raw, hash } = generateResetToken();
    expect(resetTokenMatches(raw, hash)).toBe(true);
  });

  it("does not store the raw token as its own hash", () => {
    const { raw, hash } = generateResetToken();
    expect(hash).not.toBe(raw);
  });

  it("produces different tokens on each call", () => {
    const a = generateResetToken();
    const b = generateResetToken();
    expect(a.raw).not.toBe(b.raw);
  });

  it("rejects a tampered token", () => {
    const { raw, hash } = generateResetToken();
    const tampered = raw.slice(0, -1) + (raw.at(-1) === "a" ? "b" : "a");
    expect(resetTokenMatches(tampered, hash)).toBe(false);
  });

  it("hashResetToken is deterministic", () => {
    const { raw, hash } = generateResetToken();
    expect(hashResetToken(raw)).toBe(hash);
  });
});
