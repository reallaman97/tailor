import { db } from "@/lib/db";
import { isResumeStyleKey } from "@/lib/export/styles";

export class InvalidTemplateError extends Error {
  constructor() {
    super("Unknown resume style");
  }
}

/** The profile's chosen resume style key, or null to use the app-wide default. */
export async function getProfileTemplate(profileId: string): Promise<string | null> {
  const profile = await db.profile.findUnique({
    where: { id: profileId },
    select: { resumeTemplate: true },
  });
  return profile?.resumeTemplate ?? null;
}

/** Sets the profile's resume style. Pass "" to clear it (fall back to the app default). */
export async function setProfileTemplate(profileId: string, styleKey: string): Promise<void> {
  const value = styleKey.trim();
  if (value !== "" && !isResumeStyleKey(value)) throw new InvalidTemplateError();
  await db.profile.update({
    where: { id: profileId },
    data: { resumeTemplate: value === "" ? null : value },
  });
}
