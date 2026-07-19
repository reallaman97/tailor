import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { createTestUser, deleteTestUser } from "@/lib/profile/test-helpers";
import { getPersonalInfo, savePersonalInfo } from "@/lib/profile/personal-info";

describe("personal info (integration)", () => {
  let userId: string;

  beforeAll(async () => {
    ({ id: userId } = await createTestUser());
  });

  afterAll(async () => {
    await deleteTestUser(userId);
  });

  it("returns null before any personal info has been saved", async () => {
    expect(await getPersonalInfo(userId)).toBeNull();
  });

  it("saves and round-trips full personal info, including reference-only fields", async () => {
    await savePersonalInfo(userId, {
      fullName: "Jane Doe",
      contactEmail: "jane@example.com",
      phone: "555-0100",
      linkedinUrl: "https://linkedin.com/in/janedoe",
      professionalSummary: "Experienced engineer.",
      city: "Austin",
      state: "TX",
      dateOfBirth: "1990-05-15",
      addressLine1: "123 Main St",
      addressLine2: "Apt 4",
      postalCode: "78701",
      country: "US",
    });

    const info = await getPersonalInfo(userId);
    expect(info).toEqual({
      fullName: "Jane Doe",
      contactEmail: "jane@example.com",
      phone: "555-0100",
      linkedinUrl: "https://linkedin.com/in/janedoe",
      professionalSummary: "Experienced engineer.",
      city: "Austin",
      state: "TX",
      dateOfBirth: "1990-05-15",
      addressLine1: "123 Main St",
      addressLine2: "Apt 4",
      postalCode: "78701",
      country: "US",
    });
  });

  it("stores sensitive fields as ciphertext in the database, not plaintext", async () => {
    const raw = await db.profile.findUniqueOrThrow({ where: { userId } });
    expect(raw.fullNameEnc).not.toContain("Jane Doe");
    expect(raw.dateOfBirthEnc).not.toContain("1990-05-15");
    expect(raw.addressEnc).not.toContain("Main St");
  });

  it("updates in place on a second save (upsert), overwriting prior values", async () => {
    await savePersonalInfo(userId, {
      fullName: "Jane A. Doe",
      contactEmail: "jane@example.com",
      phone: "555-0100",
      professionalSummary: undefined,
      city: undefined,
      state: undefined,
      dateOfBirth: undefined,
      addressLine1: undefined,
      addressLine2: undefined,
      postalCode: undefined,
      country: undefined,
      linkedinUrl: undefined,
    });

    const info = await getPersonalInfo(userId);
    expect(info?.fullName).toBe("Jane A. Doe");
    expect(info?.linkedinUrl).toBeNull();
    expect(info?.dateOfBirth).toBeNull();
    expect(info?.addressLine1).toBeNull();

    const profileCount = await db.profile.count({ where: { userId } });
    expect(profileCount).toBe(1);
  });
});
