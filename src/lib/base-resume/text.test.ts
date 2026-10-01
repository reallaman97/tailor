import { describe, it, expect } from "vitest";
import {
  normalizeResumeText,
  extractContact,
  redactContact,
  checkBulletsVerbatim,
  toYearMonth,
} from "./text";
import { baseResumeDraftSchema } from "./schema";

const HEADER = `Sr. AI/ML Engineer
Jordan A Rivera
 jordan.rivera@example.com       +1 (555) 010-4477         Springfield, IL
linkedin.com/in/jordan-rivera`;

describe("normalizeResumeText", () => {
  it("unifies newlines, expands tabs, trims line ends, and caps blank lines", () => {
    expect(normalizeResumeText("A\r\n•\tBullet  \r\n\r\n\r\n\r\nB")).toBe("A\n•  Bullet\n\nB");
  });
});

describe("contact handling", () => {
  it("finds email, phone, and LinkedIn locally", () => {
    expect(extractContact(HEADER)).toEqual({
      email: "jordan.rivera@example.com",
      phone: "+1 (555) 010-4477",
      linkedinUrl: "https://linkedin.com/in/jordan-rivera",
    });
  });

  it("masks email and phone before text is sent to the parser model", () => {
    const redacted = redactContact(HEADER);
    expect(redacted).not.toContain("jordan.rivera");
    expect(redacted).not.toContain("010-4477");
    expect(redacted).toContain("[email]");
    expect(redacted).toContain("[phone]");
    expect(redacted).toContain("Jordan A Rivera");
  });

  it("doesn't mistake dates, percentages, or counts for phone numbers", () => {
    const line = "08/2009 – 05/2013, reduced latency by 50% across 5,000 stores and 2TB/day";
    expect(redactContact(line)).toBe(line);
  });
});

describe("checkBulletsVerbatim", () => {
  const source = "•\tBuilt Elasticsearch and transformer-based retrieval\npipelines, reducing latency by nearly 50%.";

  it("matches bullets regardless of glyphs, punctuation, case, or line wrapping", () => {
    const check = checkBulletsVerbatim(
      ["Built Elasticsearch and transformer-based retrieval pipelines, reducing latency by nearly 50%."],
      source
    );
    expect(check).toEqual({ bulletsTotal: 1, bulletsMatched: 1, unmatched: [] });
  });

  it("flags a reworded bullet", () => {
    const check = checkBulletsVerbatim(["Created Elasticsearch retrieval pipelines that cut latency in half."], source);
    expect(check.bulletsMatched).toBe(0);
    expect(check.unmatched).toHaveLength(1);
  });
});

describe("toYearMonth", () => {
  it("normalizes the date shapes a model returns", () => {
    expect(toYearMonth("2020-08")).toBe("2020-08");
    expect(toYearMonth("2020-08-01")).toBe("2020-08");
    expect(toYearMonth("2020")).toBe("2020-01");
    expect(toYearMonth("Present")).toBeNull();
    expect(toYearMonth(null)).toBeNull();
  });
});

describe("base resume draft", () => {
  it("parses a lenient model answer, trimming text and dropping bad enum values", () => {
    const draft = baseResumeDraftSchema.parse({
      fullName: " Jordan A Rivera ",
      workHistory: [
        {
          company: "Northwind Analytics",
          jobTitle: "Sr. AI Engineer / Team Lead",
          startDate: "2020-08-01",
          endDate: null,
          workingStyle: "FULLTIME",
          bullets: [" First ", ""],
        },
      ],
      skills: "not-a-list",
    });
    expect(draft.fullName).toBe("Jordan A Rivera");
    expect(draft.workHistory[0]).toMatchObject({ startDate: "2020-08", workingStyle: null, bullets: ["First"] });
    expect(draft.skills).toEqual([]);
  });

  it("keeps an unusable date as null for the admin to fill in, rather than guessing", () => {
    const draft = baseResumeDraftSchema.parse({
      fullName: "",
      workHistory: [{ company: "Acme", jobTitle: "Engineer", startDate: "sometime", bullets: [] }],
    });
    expect(draft.workHistory[0].startDate).toBeNull();
  });
});
