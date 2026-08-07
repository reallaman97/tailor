import { db } from "@/lib/db";
import { getProfileDek } from "@/lib/profile/dek";
import { generateDek, wrapDek, unwrapDek } from "@/lib/crypto/envelope";
import {
  encryptField,
  decryptField,
  encryptOptionalField,
  decryptOptionalField,
  encryptJson,
  decryptJson,
} from "@/lib/profile/crypto";
import type { PersonalInfoInput } from "@/lib/profile/schemas";

type AddressJson = {
  line1: string | null;
  line2: string | null;
  postalCode: string | null;
  country: string | null;
};

export type DecryptedPersonalInfo = {
  fullName: string;
  contactEmail: string;
  phone: string;
  linkedinUrl: string | null;
  professionalSummary: string | null;
  city: string | null;
  state: string | null;
  // Reference-only fields — callers must not forward these to tailoring/export.
  dateOfBirth: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  country: string | null;
};

function toAddressJson(input: PersonalInfoInput): AddressJson | null {
  const hasAddress = Boolean(
    input.addressLine1 || input.addressLine2 || input.postalCode || input.country
  );
  if (!hasAddress) return null;
  return {
    line1: input.addressLine1 ?? null,
    line2: input.addressLine2 ?? null,
    postalCode: input.postalCode ?? null,
    country: input.country ?? null,
  };
}

export async function getPersonalInfo(profileId: string): Promise<DecryptedPersonalInfo | null> {
  const profile = await db.profile.findUnique({ where: { id: profileId } });
  if (!profile) return null;

  // profile already has encryptedDek from the fetch above — no need for a
  // second round trip via getProfileDek to re-fetch the same row.
  const dek = unwrapDek(profile.encryptedDek);
  const address = profile.addressEnc ? decryptJson<AddressJson>(dek, profile.addressEnc) : null;

  return {
    fullName: decryptField(dek, profile.fullNameEnc),
    contactEmail: decryptField(dek, profile.contactEmailEnc),
    phone: decryptField(dek, profile.phoneEnc),
    linkedinUrl: decryptOptionalField(dek, profile.linkedinUrlEnc),
    professionalSummary: decryptOptionalField(dek, profile.professionalSummaryEnc),
    city: decryptOptionalField(dek, profile.cityEnc),
    state: decryptOptionalField(dek, profile.stateEnc),
    dateOfBirth: decryptOptionalField(dek, profile.dateOfBirthEnc),
    addressLine1: address?.line1 ?? null,
    addressLine2: address?.line2 ?? null,
    postalCode: address?.postalCode ?? null,
    country: address?.country ?? null,
  };
}

/**
 * Bulk, name-only lookup for list views (e.g. admin Users/Profiles tables) —
 * one query for every profile instead of an N+1 getPersonalInfo per row.
 */
export async function getProfileNames(profileIds: string[]): Promise<Map<string, string>> {
  if (profileIds.length === 0) return new Map();

  const profiles = await db.profile.findMany({
    where: { id: { in: profileIds } },
    select: { id: true, fullNameEnc: true, encryptedDek: true },
  });

  return new Map(
    profiles.map((p) => [p.id, decryptField(unwrapDek(p.encryptedDek), p.fullNameEnc)])
  );
}

/** Updates an existing, already-created profile's personal info. */
export async function savePersonalInfo(profileId: string, input: PersonalInfoInput): Promise<void> {
  const dek = await getProfileDek(profileId);
  const address = toAddressJson(input);
  const addressEnc = address ? encryptJson<AddressJson>(dek, address) : null;

  await db.profile.update({
    where: { id: profileId },
    data: {
      fullNameEnc: encryptField(dek, input.fullName),
      contactEmailEnc: encryptField(dek, input.contactEmail),
      phoneEnc: encryptField(dek, input.phone),
      linkedinUrlEnc: encryptOptionalField(dek, input.linkedinUrl),
      professionalSummaryEnc: encryptOptionalField(dek, input.professionalSummary),
      cityEnc: encryptOptionalField(dek, input.city),
      stateEnc: encryptOptionalField(dek, input.state),
      dateOfBirthEnc: encryptOptionalField(dek, input.dateOfBirth),
      addressEnc,
    },
  });
}

/** Creates a brand-new, unassigned profile in the admin-managed pool with its own encryption key. */
export async function createProfile(input: PersonalInfoInput, teamId?: string | null): Promise<string> {
  const dek = generateDek();
  const encryptedDek = wrapDek(dek);
  const address = toAddressJson(input);
  const addressEnc = address ? encryptJson<AddressJson>(dek, address) : null;

  const profile = await db.profile.create({
    data: {
      teamId: teamId ?? null,
      encryptedDek,
      fullNameEnc: encryptField(dek, input.fullName),
      contactEmailEnc: encryptField(dek, input.contactEmail),
      phoneEnc: encryptField(dek, input.phone),
      linkedinUrlEnc: encryptOptionalField(dek, input.linkedinUrl),
      professionalSummaryEnc: encryptOptionalField(dek, input.professionalSummary),
      cityEnc: encryptOptionalField(dek, input.city),
      stateEnc: encryptOptionalField(dek, input.state),
      dateOfBirthEnc: encryptOptionalField(dek, input.dateOfBirth),
      addressEnc,
    },
  });

  return profile.id;
}
