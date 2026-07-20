import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { createTestUser, deleteTestUser } from "@/lib/profile/test-helpers";
import { createProfile } from "@/lib/profile/personal-info";
import { createWorkHistoryEntry } from "@/lib/profile/work-history";
import { assignProfileToUser } from "@/lib/admin/profiles";
import { getResumeFields } from "@/lib/profile/resume-fields";

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
