import { describe, it, expect } from "vitest";
import mammoth from "mammoth";
import { renderResumeDocx } from "./render-docx";
import type { ResumeDocument } from "./build-document";

const doc: ResumeDocument = {
  fullName: "Jordan A Rivera",
  headline: "Senior Backend Engineer",
  contactEmail: "jordan@example.com",
  phone: "555-0100",
  linkedinUrl: null,
  city: "Austin",
  state: "TX",
  summary: "Backend engineer with nine years of distributed-systems experience.",
  workHistory: [
    {
      company: "Acme Robotics",
      jobTitle: "Senior Software Engineer",
      location: "Remote",
      workingStyle: null,
      workingType: null,
      startDate: "2021-03",
      endDate: null,
      bullets: ["Built the fleet telemetry pipeline on Kafka and Go."],
    },
  ],
  education: [{ institution: "UT Austin", degree: "BS", field: "Computer Science", startDate: "2011-09", endDate: "2015-05" }],
  certifications: [],
  skills: [{ category: "Languages", skills: ["Go", "Python"] }],
};

describe("renderResumeDocx", () => {
  it("produces a real Word file whose text reads in order", async () => {
    const buffer = await renderResumeDocx(doc);
    expect(buffer.subarray(0, 2).toString()).toBe("PK"); // a .docx is a zip
    const { value: text } = await mammoth.extractRawText({ buffer });
    const order = ["Jordan A Rivera", "Senior Backend Engineer", "SUMMARY", "SKILLS", "Go, Python", "EXPERIENCE", "Senior Software Engineer", "Mar 2021 - Present", "Kafka", "EDUCATION", "UT Austin"];
    let at = 0;
    for (const piece of order) {
      const i = text.indexOf(piece, at);
      expect(i, `"${piece}" in order`).toBeGreaterThanOrEqual(0);
      at = i;
    }
  });
});
