import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db } from "@/lib/db";
import { createTestProfile, deleteTestProfile, MINIMAL_PERSONAL_INFO } from "@/lib/profile/test-helpers";
import { createWorkHistoryEntry, listWorkHistory } from "@/lib/profile/work-history";
import { createSkillGroup, listSkillGroups } from "@/lib/profile/skills";
import { getPersonalInfo } from "@/lib/profile/personal-info";
import { listEducation } from "@/lib/profile/education";
import { listCertifications } from "@/lib/profile/certifications";
import { applyReviewedProfile, createProfileFromReviewedResume, InvalidBaseResumeError } from "./apply";
import { getBaseResumeStatus, getBaseResumeText } from "./status";
import { validateReviewedProfile, type ReviewedProfile, type ReviewedProfileInput } from "./reviewed-profile";

const SOURCE = { sourceText: "Jordan A Rivera\nSr. AI Engineer / Team Lead\nNorthwind Analytics ...", fileName: "jordan.docx" };

function input(): ReviewedProfileInput {
  return {
    personal: {
      fullName: "Jordan A Rivera",
      contactEmail: "jordan@example.com",
      phone: "+1 (555) 010-4477",
      linkedinUrl: "",
      city: "Springfield",
      state: "TX",
      professionalSummary: "Senior AI/ML Engineer & Team Lead with 12+ years of experience.",
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
        workingType: "",
        startDate: "2020-08",
        endDate: "",
        bullets: "Architected an AI-driven inventory forecasting platform.\nBuilt retrieval pipelines.",
      },
      {
        company: "Contoso Data Services",
        jobTitle: "Data Engineer",
        location: "",
        workingStyle: "",
        workingType: "",
        startDate: "2013-07",
        endDate: "2016-09",
        bullets: "Designed ETL pipelines.",
      },
    ],
    education: [
      { institution: "State University", degree: "Bachelor of Science", field: "Computer Science", startDate: "2009-08", endDate: "2013-05" },
    ],
    certifications: [{ name: "Azure AI Engineer Associate", issuer: "Microsoft", issueDate: "2022-01" }],
    skills: [{ category: "Programming Languages", skills: "Python, Java, TypeScript" }],
  };
}

function reviewed(mutate?: (i: ReviewedProfileInput) => void): ReviewedProfile {
  const i = input();
  mutate?.(i);
  const result = validateReviewedProfile(i);
  if (!result.ok) throw new Error(JSON.stringify(result.fieldErrors));
  return result.data;
}

describe("applyReviewedProfile (integration)", () => {
  let profileId: string;

  beforeEach(async () => {
    profileId = await createTestProfile({ ...MINIMAL_PERSONAL_INFO, dateOfBirth: "1990-01-01" });
  });

  afterEach(async () => {
    await deleteTestProfile(profileId);
  });

  it("replaces the profile's content with the reviewed resume and records the base resume", async () => {
    await createSkillGroup(profileId, { category: "Old", skills: ["Cobol"] });

    await applyReviewedProfile(profileId, reviewed(), SOURCE);

    const [info, work, education, certs, skills, status, text] = await Promise.all([
      getPersonalInfo(profileId),
      listWorkHistory(profileId),
      listEducation(profileId),
      listCertifications(profileId),
      listSkillGroups(profileId),
      getBaseResumeStatus(profileId),
      getBaseResumeText(profileId),
    ]);

    expect(info).toMatchObject({
      fullName: "Jordan A Rivera",
      contactEmail: "jordan@example.com",
      phone: "+1 (555) 010-4477",
      city: "Springfield",
      state: "TX",
      // Reference-only fields are never touched by a base-resume replacement.
      dateOfBirth: "1990-01-01",
    });
    expect(work.map((w) => [w.company, w.jobTitle, w.startDate, w.endDate, w.achievements.length])).toEqual([
      ["Northwind Analytics", "Sr. AI Engineer / Team Lead", "2020-08", null, 2],
      ["Contoso Data Services", "Data Engineer", "2013-07", "2016-09", 1],
    ]);
    expect(education).toHaveLength(1);
    expect(certs.map((c) => c.name)).toEqual(["Azure AI Engineer Associate"]);
    expect(skills).toEqual([{ category: "Programming Languages", skills: ["Python", "Java", "TypeScript"] }]);
    expect(status?.fileName).toBe("jordan.docx");
    expect(text).toBe(SOURCE.sourceText);
  });

  it("keeps work-history ids for roles that match by company + start month, and removes the rest", async () => {
    const common = { location: undefined, workingStyle: undefined, workingType: undefined, endDate: undefined };
    const keptId = await createWorkHistoryEntry(profileId, {
      ...common,
      company: "northwind analytics",
      jobTitle: "Engineer",
      startDate: "2020-08",
      achievements: [],
    });
    const removedId = await createWorkHistoryEntry(profileId, {
      ...common,
      company: "Gone Corp",
      jobTitle: "Engineer",
      startDate: "2010-01",
      achievements: ["old"],
    });

    await applyReviewedProfile(profileId, reviewed(), SOURCE);

    const work = await listWorkHistory(profileId);
    const matched = work.find((w) => w.company === "Northwind Analytics");
    // Same row, so earlier applications' tailored bullets (keyed by entry id) still map.
    expect(matched?.id).toBe(keptId);
    expect(matched?.achievements).toHaveLength(2);
    expect(work.some((w) => w.id === removedId)).toBe(false);
    expect(work).toHaveLength(2);
  });

  it("refuses an empty base resume text, leaving the profile unchanged", async () => {
    await expect(applyReviewedProfile(profileId, reviewed(), { sourceText: "  ", fileName: null })).rejects.toThrow(
      InvalidBaseResumeError
    );
    expect(await getBaseResumeStatus(profileId)).toBeNull();
    expect(await db.workHistoryEntry.count({ where: { profileId } })).toBe(0);
  });
});

describe("createProfileFromReviewedResume (integration)", () => {
  it("creates a complete profile, with the reference-only fields from the form", async () => {
    const profileId = await createProfileFromReviewedResume(
      reviewed((i) => {
        i.personal.dateOfBirth = "1991-06-15";
        i.personal.country = "USA";
      }),
      SOURCE,
      null
    );
    try {
      const [info, work, status] = await Promise.all([
        getPersonalInfo(profileId),
        listWorkHistory(profileId),
        getBaseResumeStatus(profileId),
      ]);
      expect(info).toMatchObject({ fullName: "Jordan A Rivera", dateOfBirth: "1991-06-15", country: "USA" });
      expect(work).toHaveLength(2);
      expect(status).not.toBeNull();
    } finally {
      await deleteTestProfile(profileId);
    }
  });

  it("creates nothing when the resume text is invalid", async () => {
    const before = await db.profile.count();
    await expect(createProfileFromReviewedResume(reviewed(), { sourceText: "", fileName: null }, null)).rejects.toThrow(
      InvalidBaseResumeError
    );
    expect(await db.profile.count()).toBe(before);
  });
});
