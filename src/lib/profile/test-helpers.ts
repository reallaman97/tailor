import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { generateDek, wrapDek } from "@/lib/crypto/envelope";
import { createProfile } from "@/lib/profile/personal-info";
import type { PersonalInfoInput } from "@/lib/profile/schemas";

/** Minimal valid personal info input, with every optional field explicitly undefined. */
export const MINIMAL_PERSONAL_INFO: PersonalInfoInput = {
  fullName: "Test User",
  contactEmail: "test@example.com",
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
};

/** Creates a throwaway, already-approved user (with a real wrapped DEK) for integration tests against the real dev DB. */
export async function createTestUser(): Promise<{ id: string; email: string }> {
  const email = `test-${randomUUID()}@example.com`;
  const passwordHash = await hashPassword("irrelevant-test-password");
  const encryptedDek = wrapDek(generateDek());

  const user = await db.user.create({
    data: { email, passwordHash, encryptedDek, approved: true },
  });
  return { id: user.id, email: user.email };
}

export async function deleteTestUser(userId: string): Promise<void> {
  await db.user.delete({ where: { id: userId } });
}

/** Creates a throwaway, unassigned profile (with its own real wrapped DEK) for integration tests. */
export async function createTestProfile(
  input: PersonalInfoInput = MINIMAL_PERSONAL_INFO
): Promise<string> {
  return createProfile(input);
}

export async function deleteTestProfile(profileId: string): Promise<void> {
  await db.profile.delete({ where: { id: profileId } });
}
