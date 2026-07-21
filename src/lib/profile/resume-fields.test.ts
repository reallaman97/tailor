import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { createTestUser, deleteTestUser } from "@/lib/profile/test-helpers";
import { createProfile } from "@/lib/profile/personal-info";
import { createWorkHistoryEntry } from "@/lib/profile/work-history";
import { assignProfileToUser } from "@/lib/admin/profiles";
import { getResumeFields, getResumeFieldsForResume } from "@/lib/profile/resume-fields";

describe("getResumeFields — the reference-only-data boundary (integration)", () => {
  let userId: string;
  let profileId: string | undefined;

  beforeAll(async () => {
    ({ id: userId } = await createTestUser());
  });

  afterAll(async () => {
    if (profileId) await db.profile.delete({ where: { id: profileId } });
    await deleteTestUser(userId);
  });

  it("returns null when no profile is assigned", async () => {
    expect(await getResumeFields(userId)).toBeNull();
  });

  it("NEVER includes date of birth or street address, even though they are set on the profile", async () => {
    profileId = await createProfile({
      fullName: "Jane Doe",
      contactEmail: "jane@example.com",
      phone: "555-0100",
      linkedinUrl: undefined,
      professionalSummary: "Experienced engineer.",
      city: "Austin",
      state: "TX",
      // Reference-only fields, deliberately set to distinctive values so any
      // leak is trivially detectable below.
      dateOfBirth: "1990-05-15",
      addressLine1: "123 Secret Street",
      addressLine2: "Apt 9",
      postalCode: "78701-SECRET",
      country: "Wakanda",
    });
    await assignProfileToUser(profileId, userId);
    await createWorkHistoryEntry(profileId, {
      company: "Acme",
      jobTitle: "Engineer",
      location: undefined,
      workingStyle: undefined,
      workingType: undefined,
      startDate: "2020-01",
      endDate: undefined,
      achievements: ["Shipped feature X"],
    });

    const fields = await getResumeFields(userId);
    expect(fields).not.toBeNull();

    // Structural check: the reference-only keys must not exist at all.
    expect(fields).not.toHaveProperty("dateOfBirth");
    expect(fields).not.toHaveProperty("addressLine1");
    expect(fields).not.toHaveProperty("addressLine2");
    expect(fields).not.toHaveProperty("postalCode");
    expect(fields).not.toHaveProperty("country");

    // Value check: none of the sensitive values leaked into some other field.
    const serialized = JSON.stringify(fields);
    expect(serialized).not.toContain("1990-05-15");
    expect(serialized).not.toContain("Secret Street");
    expect(serialized).not.toContain("78701-SECRET");
    expect(serialized).not.toContain("Wakanda");

    // Sanity check: legitimate resume fields ARE present, so this isn't
    // passing by returning an empty/broken object.
    expect(fields?.fullName).toBe("Jane Doe");
    expect(fields?.city).toBe("Austin");
    expect(fields?.workHistory).toHaveLength(1);
    expect(fields?.workHistory[0].company).toBe("Acme");
  });
});

// Regression guard for the cross-candidate PII bug: a resume must render from
// the profile it was logged/generated against, never from whatever profile the
// owner happens to be assigned to now (which can differ after a reassignment).
describe("getResumeFieldsForResume — anchors rendering to the resume's profile (integration)", () => {
  let userId: string;
  const profileIds: string[] = [];

  async function makeProfile(fullName: string): Promise<string> {
    const id = await createProfile({
      fullName,
      contactEmail: `${fullName.replace(/\s+/g, "").toLowerCase()}@example.com`,
      phone: "555-0100",
      linkedinUrl: undefined,
      professionalSummary: undefined,
      city: undefined,
      state: undefined,
      dateOfBirth: undefined,
      addressLine1: undefined,
      addressLine2: undefined,
      postalCode: undefined,
      country: undefined,
    });
    profileIds.push(id);
    return id;
  }

  beforeAll(async () => {
    ({ id: userId } = await createTestUser());
  });

  afterAll(async () => {
    await deleteTestUser(userId);
    for (const id of profileIds) await db.profile.delete({ where: { id } });
  });

  it("uses the resume's stored profile, not the owner's current assignment", async () => {
    const generatedAgainst = await makeProfile("Alice Generated");
    const reassignedTo = await makeProfile("Bob Reassigned");

    // The owner is now assigned to a DIFFERENT profile than the resume was
    // generated against — the exact post-reassignment condition that produced
    // wrong-candidate PII in exports.
    await assignProfileToUser(reassignedTo, userId);

    const fields = await getResumeFieldsForResume(userId, generatedAgainst);
    expect(fields?.fullName).toBe("Alice Generated");
  });

  it("falls back to the owner's current assignment when the resume has no profile", async () => {
    const current = await makeProfile("Carol Current");
    await assignProfileToUser(current, userId);

    const fields = await getResumeFieldsForResume(userId, null);
    expect(fields?.fullName).toBe("Carol Current");
  });
});
