import { describe, it, expect } from "vitest";
import { normalizeJobUrl } from "@/lib/resumes/normalize-url";

describe("normalizeJobUrl", () => {
  it("strips utm_* and other known tracking params", () => {
    expect(
      normalizeJobUrl("https://example.com/jobs/123?utm_source=linkedin&utm_medium=social&fbclid=abc")
    ).toBe("https://example.com/jobs/123");
  });

  it("keeps params that identify the specific posting", () => {
    expect(normalizeJobUrl("https://boards.greenhouse.io/acme?gh_jid=98765&utm_source=indeed")).toBe(
      "https://boards.greenhouse.io/acme?gh_jid=98765"
    );
  });

  it("drops the hash fragment", () => {
    expect(normalizeJobUrl("https://example.com/jobs/123#apply-section")).toBe("https://example.com/jobs/123");
  });

  it("drops a bare trailing slash but keeps the root path", () => {
    expect(normalizeJobUrl("https://example.com/jobs/123/")).toBe("https://example.com/jobs/123");
    expect(normalizeJobUrl("https://example.com/")).toBe("https://example.com/");
  });

  it("sorts remaining query params so differently-ordered links match", () => {
    expect(normalizeJobUrl("https://example.com/jobs?b=2&a=1")).toBe(
      normalizeJobUrl("https://example.com/jobs?a=1&b=2")
    );
  });

  it("two differently-tagged links to the same posting normalize identically", () => {
    const a = normalizeJobUrl("https://example.com/jobs/123?utm_source=linkedin&utm_campaign=x");
    const b = normalizeJobUrl("https://example.com/jobs/123/?ref=twitter#top");
    expect(a).toBe(b);
  });

  it("leaves an invalid/relative URL untouched", () => {
    expect(normalizeJobUrl("not a url")).toBe("not a url");
  });

  it("leaves an empty string untouched", () => {
    expect(normalizeJobUrl("")).toBe("");
    expect(normalizeJobUrl("   ")).toBe("");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeJobUrl("  https://example.com/jobs/123  ")).toBe("https://example.com/jobs/123");
  });
});
