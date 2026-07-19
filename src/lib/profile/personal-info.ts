import { db } from "@/lib/db";
import { getUserDek } from "@/lib/profile/dek";
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

export async function getPersonalInfo(userId: string): Promise<DecryptedPersonalInfo | null> {
  const profile = await db.profile.findUnique({ where: { userId } });
  if (!profile) return null;

  const dek = await getUserDek(userId);
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

export async function savePersonalInfo(userId: string, input: PersonalInfoInput): Promise<void> {
  const dek = await getUserDek(userId);

  const hasAddress = Boolean(
    input.addressLine1 || input.addressLine2 || input.postalCode || input.country
  );
  const addressEnc = hasAddress
    ? encryptJson<AddressJson>(dek, {
        line1: input.addressLine1 ?? null,
        line2: input.addressLine2 ?? null,
        postalCode: input.postalCode ?? null,
        country: input.country ?? null,
      })
    : null;

  const fields = {
    fullNameEnc: encryptField(dek, input.fullName),
    contactEmailEnc: encryptField(dek, input.contactEmail),
    phoneEnc: encryptField(dek, input.phone),
    linkedinUrlEnc: encryptOptionalField(dek, input.linkedinUrl),
    professionalSummaryEnc: encryptOptionalField(dek, input.professionalSummary),
    cityEnc: encryptOptionalField(dek, input.city),
    stateEnc: encryptOptionalField(dek, input.state),
    dateOfBirthEnc: encryptOptionalField(dek, input.dateOfBirth),
    addressEnc,
  };

  await db.profile.upsert({
    where: { userId },
    create: { userId, ...fields },
    update: fields,
  });
}
