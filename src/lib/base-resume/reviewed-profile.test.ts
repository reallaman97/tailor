import { describe, it, expect } from "vitest";
import {
  validateReviewedProfile,
  draftToInput,
  EMPTY_WORK_ENTRY,
  type ReviewedProfileInput,
} from "./reviewed-profile";
import { baseResumeDraftSchema } from "./schema";

function valid(): ReviewedProfileInput {
  return {
    personal: {
      fullName: "Jordan A Rivera",
      contactEmail: "jordan@example.com",
      phone: "+1 (555) 010-4477",
      linkedinUrl: "",
      city: "Springfield",
      state: "TX",
      professionalSummary: "Senior AI/ML Engineer.",
      dateOfBirth: "",
      addressLine1: "",
      addressLine2: "",
      postalCode: "",
      country: "",
    },
    workHistory: [
      {
        company: "Northwind Analytics",
        jobTitle: "Sr. AI Engineer / Team Lead",
        location: "Springfield, IL, USA",
        workingStyle: "",
        workingType: "REMOTE",
        startDate: "2020-08",
        endDate: "",
        bullets: "•\tArchitected a forecasting platform.\n\n- Built retrieval pipelines.\n",
      },
    ],
    education: [{ institution: "State University", degree: "B.S.", field: "", startDate: "2009-08", endDate: "2013-05" }],
    certifications: [],
    skills: [{ category: "Programming Languages", skills: "Python, Java,\nTypeScript" }],
  };
}

describe("validateReviewedProfile", () => {
  it("accepts a complete profile and normalizes it for storage", () => {
    const result = validateReviewedProfile(valid());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.workHistory[0]).toMatchObject({
      workingStyle: null,
      workingType: "REMOTE",
      endDate: null,
      // One bullet per non-empty line, leading bullet glyphs stripped.
      bullets: ["Architected a forecasting platform.", "Built retrieval pipelines."],
    });
    expect(result.data.skills[0].skills).toEqual(["Python", "Java", "TypeScript"]);
    expect(result.data.personal.linkedinUrl).toBeNull();
  });

  it("reports each invalid field by its path", () => {
    const input = valid();
    input.personal.fullName = " ";
    input.personal.contactEmail = "not-an-email";
    input.personal.linkedinUrl = "linkedin.com/in/jordan";
    input.workHistory[0].startDate = "";
    input.workHistory[0].bullets = "\n \n";
    input.education[0].degree = "";

    const result = validateReviewedProfile(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors).toMatchObject({
      "personal.fullName": "Full name is required",
      "personal.contactEmail": "Enter a valid email address",
      "personal.linkedinUrl": expect.stringContaining("full URL"),
      "workHistory.0.startDate": "Start date is required",
      "workHistory.0.bullets": "Add at least one bullet point",
      "education.0.degree": "Degree is required",
    });
  });

  it("rejects an end date before the start date", () => {
    const input = valid();
    input.workHistory[0].endDate = "2019-01";
    const result = validateReviewedProfile(input);
    expect(!result.ok && result.fieldErrors["workHistory.0.endDate"]).toBe("End date can't be before the start date");
  });

  it("requires at least one role", () => {
    const input = valid();
    input.workHistory = [];
    const result = validateReviewedProfile(input);
    expect(!result.ok && result.fieldErrors["workHistory"]).toBe("Add at least one role");
  });

  it("flags a duplicate skill category (case-insensitive) on the later one", () => {
    const input = valid();
    input.skills.push({ category: "programming languages", skills: "Go" });
    const result = validateReviewedProfile(input);
    expect(!result.ok && result.fieldErrors["skills.1.category"]).toBe("This category is already used above");
  });

  it("flags every field of a freshly added, empty role", () => {
    const input = valid();
    input.workHistory.push({ ...EMPTY_WORK_ENTRY });
    const result = validateReviewedProfile(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.fieldErrors).sort()).toEqual([
      "workHistory.1.bullets",
      "workHistory.1.company",
      "workHistory.1.jobTitle",
      "workHistory.1.startDate",
    ]);
  });
});

describe("draftToInput", () => {
  it("prefills the form from the parsed resume and locally-found contact details", () => {
    const draft = baseResumeDraftSchema.parse({
      fullName: "Jordan A Rivera",
      city: "Springfield",
      summary: "Summary.",
      workHistory: [{ company: "Northwind Analytics", jobTitle: "Lead", startDate: "2020-08", bullets: ["One", "Two"] }],
      skills: [{ category: "Languages", skills: ["Python", "Java"] }],
    });
    const input = draftToInput(draft, { email: "b@example.com", phone: "555-000-1111", linkedinUrl: null });
    expect(input.personal).toMatchObject({ fullName: "Jordan A Rivera", contactEmail: "b@example.com", city: "Springfield", state: "" });
    expect(input.workHistory[0]).toMatchObject({ bullets: "One\nTwo", endDate: "" });
    expect(input.skills[0].skills).toBe("Python, Java");
    expect(validateReviewedProfile(input).ok).toBe(true);
  });
});
