import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { createTestProfile, deleteTestProfile } from "@/lib/profile/test-helpers";
import { getPersonalInfo, savePersonalInfo, createProfile } from "@/lib/profile/personal-info";

describe("personal info (integration)", () => {
  let profileId: string;

  beforeAll(async () => {
    profileId = await createTestProfile({
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

  afterAll(async () => {
    await deleteTestProfile(profileId);
  });

  it("returns null for a nonexistent profile", async () => {
    expect(await getPersonalInfo("nonexistent-id")).toBeNull();
  });

  it("round-trips full personal info, including reference-only fields", async () => {
    const info = await getPersonalInfo(profileId);
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
    const raw = await db.profile.findUniqueOrThrow({ where: { id: profileId } });
    expect(raw.fullNameEnc).not.toContain("Jane Doe");
    expect(raw.dateOfBirthEnc).not.toContain("1990-05-15");
    expect(raw.addressEnc).not.toContain("Main St");
  });

  it("updates in place on save, overwriting prior values", async () => {
    await savePersonalInfo(profileId, {
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

    const info = await getPersonalInfo(profileId);
    expect(info?.fullName).toBe("Jane A. Doe");
    expect(info?.linkedinUrl).toBeNull();
    expect(info?.dateOfBirth).toBeNull();
    expect(info?.addressLine1).toBeNull();

    const profileCount = await db.profile.count({ where: { id: profileId } });
    expect(profileCount).toBe(1);
  });

  it("gives each newly created profile its own distinct encryption key", async () => {
    const otherId = await createProfile({
      fullName: "Other Person",
      contactEmail: "other@example.com",
      phone: "555-0200",
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
    try {
      const [a, b] = await Promise.all([
        db.profile.findUniqueOrThrow({ where: { id: profileId }, select: { encryptedDek: true } }),
        db.profile.findUniqueOrThrow({ where: { id: otherId }, select: { encryptedDek: true } }),
      ]);
      expect(a.encryptedDek).not.toBe(b.encryptedDek);
    } finally {
      await db.profile.delete({ where: { id: otherId } });
    }
  });
});
