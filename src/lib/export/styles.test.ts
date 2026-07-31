import { describe, it, expect } from "vitest";
import {
  RESUME_STYLES,
  getResumeStyle,
  isResumeStyleKey,
  styleKeyFromAppDefault,
  effectiveStyleKey,
  DEFAULT_STYLE_KEY,
} from "./styles";

describe("resume styles registry", () => {
  it("provides 10 styles with unique keys", () => {
    expect(RESUME_STYLES).toHaveLength(10);
    const keys = RESUME_STYLES.map((s) => s.key);
    expect(new Set(keys).size).toBe(10);
    expect(keys).toContain("modern");
    expect(keys).toContain("classic");
  });

  it("resolves a known key, and falls back to the default for unknown/empty", () => {
    expect(getResumeStyle("technical").key).toBe("technical");
    expect(getResumeStyle("does-not-exist").key).toBe(DEFAULT_STYLE_KEY);
    expect(getResumeStyle(null).key).toBe(DEFAULT_STYLE_KEY);
  });

  it("validates keys", () => {
    expect(isResumeStyleKey("executive")).toBe(true);
    expect(isResumeStyleKey("nope")).toBe(false);
  });

  it("maps the legacy app default enum to a style key", () => {
    expect(styleKeyFromAppDefault("MODERN")).toBe("modern");
    expect(styleKeyFromAppDefault("CLASSIC")).toBe("classic");
  });

  it("prefers a valid profile style over the app default", () => {
    expect(effectiveStyleKey("bold", "MODERN")).toBe("bold");
    expect(effectiveStyleKey(null, "CLASSIC")).toBe("classic");
    expect(effectiveStyleKey("garbage", "MODERN")).toBe("modern");
  });
});
