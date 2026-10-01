import { describe, it, expect } from "vitest";
import { resumeToText } from "./resume-text";
import type { ResumeDocument } from "@/lib/export/build-document";

const DOC: ResumeDocument = {
  fullName: "Jordan A Rivera",
  headline: "Senior **ML** Engineer",
  contactEmail: "jordan.private@example.com",
  phone: "+1 (555) 010-4477",
  linkedinUrl: "https://linkedin.com/in/jordan",
  city: "Springfield",
  state: "TX",
  summary: "Builds forecasting systems.",
  workHistory: [
    {
      company: "Northwind Analytics",
      jobTitle: "Senior Machine Learning Engineer",
      location: "Springfield, IL",
      workingStyle: null,
      workingType: null,
      startDate: "2020-08",
      endDate: null,
      bullets: ["Built **Kafka** pipelines."],
    },
  ],
  education: [{ institution: "State University", degree: "B.S.", field: "Computer Science", startDate: "2009-08", endDate: "2013-05" }],
  certifications: [{ name: "Azure AI Engineer", issuer: "Microsoft", issueDate: "2022-01" }],
  skills: [{ category: "Languages", skills: ["Python", "SQL"] }],
};

describe("resumeToText", () => {
  const text = resumeToText(DOC);

  it("never includes contact email or phone (they're not sent to the AI provider)", () => {
    expect(text).not.toContain("jordan.private@example.com");
    expect(text).not.toContain("010-4477");
  });

  it("includes the submitted titles, dates, bullets, skills, education and certifications", () => {
    expect(text).toContain("Senior Machine Learning Engineer — Northwind Analytics (Springfield, IL) | 2020-08 – Present");
    expect(text).toContain("- Built Kafka pipelines.");
    expect(text).toContain("Languages: Python, SQL");
    expect(text).toContain("B.S., Computer Science — State University | 2009-08 – 2013-05");
    expect(text).toContain("Azure AI Engineer — Microsoft (2022-01)");
  });

  it("strips bold markers left by older generations", () => {
    expect(text).not.toContain("**");
    expect(text).toContain("Senior ML Engineer");
  });
});
