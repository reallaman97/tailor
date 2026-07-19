import { describe, it, expect } from "vitest";
import { buildResumeDocument } from "./build-document";
import type { ResumeFields } from "@/lib/profile/resume-fields";
import type { TailoredContent } from "@/lib/tailoring/schema";

const BASE_FIELDS: ResumeFields = {
  fullName: "Jane Doe",
  contactEmail: "jane@example.com",
  phone: "555-0100",
  linkedinUrl: "https://linkedin.com/in/janedoe",
  professionalSummary: "Original default summary.",
  city: "Austin",
  state: "TX",
  workHistory: [
    {
      id: "entry-old",
      company: "OldCo",
      jobTitle: "Junior Engineer",
      location: "Austin",
      startDate: "2018-01-01",
      endDate: "2020-01-01",
      achievements: ["Original old bullet"],
    },
    {
      id: "entry-new",
      company: "NewCo",
      jobTitle: "Senior Engineer",
      location: "Remote",
      startDate: "2020-02-01",
      endDate: null,
      achievements: ["Original new bullet"],
    },
  ],
  education: [
    { institution: "State University", degree: "M.S.", field: "CS", startDate: "2016-01-01", endDate: "2018-01-01" },
    { institution: "Community College", degree: "A.S.", field: null, startDate: null, endDate: null },
    { institution: "First College", degree: "Cert", field: null, startDate: "2014-01-01", endDate: "2015-01-01" },
  ],
  skills: {
    languages: ["TypeScript", "Python"],
    frameworks: ["React"],
    tools: ["Docker"],
    softSkills: ["Communication"],
  },
};

describe("buildResumeDocument", () => {
  it("orders work history newest-first by startDate, regardless of input order", () => {
    const doc = buildResumeDocument(BASE_FIELDS, null);
    expect(doc.workHistory.map((w) => w.company)).toEqual(["NewCo", "OldCo"]);
  });

  it("orders education newest-first, with undated entries last", () => {
    const doc = buildResumeDocument(BASE_FIELDS, null);
    expect(doc.education.map((e) => e.institution)).toEqual([
      "State University",
      "First College",
      "Community College",
    ]);
  });

  it("falls back to original achievements and default summary/skills when there's no tailored content", () => {
    const doc = buildResumeDocument(BASE_FIELDS, null);
    expect(doc.summary).toBe("Original default summary.");
    expect(doc.workHistory[0].bullets).toEqual(["Original new bullet"]);
    expect(doc.skills).toEqual(["TypeScript", "Python", "React", "Docker", "Communication"]);
  });

  it("substitutes tailored bullets/summary/skills only where a matching entryId exists", () => {
    const tailored: TailoredContent = {
      summary: "Tailored summary for this job.",
      workHistory: [{ entryId: "entry-new", bullets: ["Tailored new bullet"] }],
      orderedSkills: ["Docker", "TypeScript"],
    };

    const doc = buildResumeDocument(BASE_FIELDS, tailored);
    expect(doc.summary).toBe("Tailored summary for this job.");
    // entry-new got tailored bullets; entry-old (untouched by tailoring) keeps its original.
    expect(doc.workHistory.find((w) => w.company === "NewCo")?.bullets).toEqual([
      "Tailored new bullet",
    ]);
    expect(doc.workHistory.find((w) => w.company === "OldCo")?.bullets).toEqual([
      "Original old bullet",
    ]);
    expect(doc.skills).toEqual(["Docker", "TypeScript"]);
  });

  it("still includes every real work history entry even if tailored content omits one", () => {
    const tailored: TailoredContent = {
      summary: "s",
      workHistory: [{ entryId: "entry-new", bullets: ["only new tailored"] }],
      orderedSkills: [],
    };
    const doc = buildResumeDocument(BASE_FIELDS, tailored);
    expect(doc.workHistory).toHaveLength(2);
    expect(doc.workHistory.find((w) => w.company === "OldCo")?.bullets).toEqual([
      "Original old bullet",
    ]);
  });

  it("falls back to default skill order when tailored orderedSkills is empty", () => {
    const tailored: TailoredContent = { summary: "s", workHistory: [], orderedSkills: [] };
    const doc = buildResumeDocument(BASE_FIELDS, tailored);
    expect(doc.skills).toEqual(["TypeScript", "Python", "React", "Docker", "Communication"]);
  });
});
