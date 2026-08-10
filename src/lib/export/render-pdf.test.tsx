import { describe, it, expect } from "vitest";
import { PDFParse } from "pdf-parse";
import { renderResumePdf } from "./render-pdf";
import type { ResumeDocument } from "./build-document";

const SAMPLE_DOCUMENT: ResumeDocument = {
  fullName: "Jane Doe",
  contactEmail: "jane@example.com",
  phone: "555-0100",
  linkedinUrl: "https://linkedin.com/in/janedoe",
  city: "Austin",
  state: "TX",
  headline: "Distributed Systems Specialist | Go & Kafka",
  summary: "Backend engineer focused on distributed systems.",
  workHistory: [
    {
      company: "Globex",
      jobTitle: "Senior Backend Engineer",
      location: "Remote",
      workingStyle: "FULL_TIME",
      workingType: "REMOTE",
      startDate: "2020-02-01",
      endDate: null,
      bullets: ["Built a payments service handling 10k requests/day"],
    },
  ],
  education: [
    {
      institution: "State University",
      degree: "B.S.",
      field: "Computer Science",
      startDate: "2014-09-01",
      endDate: "2018-05-01",
    },
  ],
  certifications: [{ name: "AWS Certified Solutions Architect", issuer: "Amazon Web Services", issueDate: "2022-06-01" }],
  skills: [{ category: "Languages", skills: ["TypeScript", "Python", "Docker"] }],
};

describe("renderResumePdf", () => {
  it("produces a real PDF with extractable, correctly-ordered text (ATS-parseable)", async () => {
    const buffer = await renderResumePdf(SAMPLE_DOCUMENT);
    expect(buffer.subarray(0, 5).toString("utf8")).toBe("%PDF-");

    const parser = new PDFParse({ data: buffer });
    const { text } = await parser.getText();
    await parser.destroy();

    for (const expected of [
      "Jane Doe",
      "Distributed Systems Specialist | Go & Kafka",
      "jane@example.com",
      "555-0100",
      "linkedin.com/in/janedoe",
      "Austin, TX",
      "SUMMARY",
      "Backend engineer focused on distributed systems.",
      "EXPERIENCE",
      "Senior Backend Engineer",
      "Globex",
      "Remote",
      "Full-time",
      "Built a payments service handling 10k requests/day",
      "EDUCATION",
      "State University",
      "TECHNICAL SKILLS",
      "TypeScript, Python, Docker",
      "CERTIFICATIONS",
      "AWS Certified Solutions Architect",
    ]) {
      expect(text).toContain(expected);
    }

    // Reading order matters for ATS parsers: job title before company,
    // company before the bullet, section headings before their content.
    expect(text.indexOf("Senior Backend Engineer")).toBeLessThan(text.indexOf("Globex"));
    expect(text.indexOf("Globex")).toBeLessThan(
      text.indexOf("Built a payments service handling 10k requests/day")
    );
    // Section order: Summary → Technical Skills → Experience → Education → Certifications.
    expect(text.indexOf("TECHNICAL SKILLS")).toBeLessThan(text.indexOf("EXPERIENCE"));
    expect(text.indexOf("EXPERIENCE")).toBeLessThan(text.indexOf("EDUCATION"));
    expect(text.indexOf("EDUCATION")).toBeLessThan(text.indexOf("CERTIFICATIONS"));
  });

  it("omits empty sections instead of rendering blank headings", async () => {
    const buffer = await renderResumePdf({ ...SAMPLE_DOCUMENT, education: [], summary: null });
    const parser = new PDFParse({ data: buffer });
    const { text } = await parser.getText();
    await parser.destroy();

    expect(text).not.toContain("EDUCATION");
    expect(text).not.toContain("SUMMARY");
  });

  it("renders **bold** keyword emphasis as clean text, stripping the markers (ATS-safe)", async () => {
    const buffer = await renderResumePdf({
      ...SAMPLE_DOCUMENT,
      summary: "Backend engineer skilled in **Kubernetes** and **CI/CD pipelines**.",
      workHistory: [
        {
          ...SAMPLE_DOCUMENT.workHistory[0],
          bullets: ["Built a **payments service** handling **10k requests/day**"],
        },
      ],
    });
    const parser = new PDFParse({ data: buffer });
    const { text } = await parser.getText();
    await parser.destroy();

    // Emphasized keywords render as normal, extractable text...
    for (const kw of ["Kubernetes", "CI/CD pipelines", "payments service", "10k requests/day"]) {
      expect(text).toContain(kw);
    }
    // ...and the ** markers never leak into the parsed output (they'd pollute ATS).
    expect(text).not.toContain("**");
    expect(text).not.toContain("*Kubernetes");
  });
});

describe("renderResumePdf (CLASSIC template)", () => {
  it("produces a real, extractable, correctly-ordered PDF using the classic layout", async () => {
    const buffer = await renderResumePdf(SAMPLE_DOCUMENT, "classic");
    expect(buffer.subarray(0, 5).toString("utf8")).toBe("%PDF-");

    const parser = new PDFParse({ data: buffer });
    const { text } = await parser.getText();
    await parser.destroy();

    for (const expected of [
      "JANE DOE", // classic template uppercases the name
      "jane@example.com",
      "555-0100",
      "SUMMARY",
      "Backend engineer focused on distributed systems.",
      "EXPERIENCE",
      "Senior Backend Engineer",
      "Globex",
      "Remote",
      "Full-time",
      "Built a payments service handling 10k requests/day",
      "EDUCATION",
      "State University",
      "TECHNICAL SKILLS",
      "CERTIFICATIONS",
    ]) {
      expect(text).toContain(expected);
    }

    expect(text.indexOf("Senior Backend Engineer")).toBeLessThan(text.indexOf("Globex"));
    expect(text.indexOf("TECHNICAL SKILLS")).toBeLessThan(text.indexOf("EXPERIENCE"));
    expect(text.indexOf("EXPERIENCE")).toBeLessThan(text.indexOf("EDUCATION"));
    expect(text.indexOf("EDUCATION")).toBeLessThan(text.indexOf("CERTIFICATIONS"));
  });
});
