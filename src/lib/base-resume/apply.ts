import { db } from "@/lib/db";
import { withDbRetry } from "@/lib/db-retry";
import { getProfileDek } from "@/lib/profile/dek";
import { encryptField, encryptOptionalField, encryptJson } from "@/lib/profile/crypto";
import { fromDateOnly, toDateOnly } from "@/lib/profile/date-utils";
import { createProfile } from "@/lib/profile/personal-info";
import type { ReviewedProfile } from "@/lib/base-resume/reviewed-profile";
import { MAX_BASE_RESUME_CHARS } from "@/lib/base-resume/text";

export class InvalidBaseResumeError extends Error {}

export type BaseResumeSource = { sourceText: string; fileName: string | null };

// The replace runs ~10–40 sequential statements (one per role plus the section
// rewrites). Prisma aborts interactive transactions after 5s by default, which
// a high-latency database link (~300ms per round trip) can exceed with a long
// resume — observed in practice. All-or-nothing still holds; it just gets room.
const TRANSACTION_OPTIONS = { maxWait: 15_000, timeout: 45_000 };

function key(company: string, startDate: string): string {
  return `${company.trim().toLowerCase()}|${startDate}`;
}

function checkSource(source: BaseResumeSource): string {
  const text = source.sourceText.trim();
  if (!text) throw new InvalidBaseResumeError("The base resume text is empty.");
  if (text.length > MAX_BASE_RESUME_CHARS) throw new InvalidBaseResumeError("The base resume is too long.");
  return text;
}

/**
 * Writes an admin-reviewed base resume onto an existing profile in one
 * transaction: personal info (except the reference-only date of birth and
 * address, which a resume never replaces), summary, work history, education,
 * certifications, skills, and the stored base-resume text.
 *
 * Work-history entries are matched to existing ones by company + start month
 * and updated in place, so their ids survive — applications generated earlier
 * key their tailored bullets/titles by entry id, and re-rendering their PDFs
 * must keep working. Unmatched old entries are removed.
 *
 * `profile` must already be validated (validateReviewedProfile).
 */
export async function applyReviewedProfile(
  profileId: string,
  profile: ReviewedProfile,
  source: BaseResumeSource
): Promise<void> {
  const sourceText = checkSource(source);

  const [dek, existingWork] = await Promise.all([
    getProfileDek(profileId),
    db.workHistoryEntry.findMany({ where: { profileId }, select: { id: true, company: true, startDate: true } }),
  ]);
  const existingByKey = new Map(existingWork.map((w) => [key(w.company, toDateOnly(w.startDate)), w.id]));
  const keptIds = new Set<string>();
  const p = profile.personal;

  // Replace-style and all-or-nothing, so re-running it after any transient
  // failure (even one mid-commit) converges on the same result.
  await withDbRetry(() => db.$transaction(async (tx) => {
    for (const [index, w] of profile.workHistory.entries()) {
      const data = {
        company: w.company,
        jobTitle: w.jobTitle,
        location: w.location,
        workingStyle: w.workingStyle,
        workingType: w.workingType,
        startDate: fromDateOnly(w.startDate),
        endDate: w.endDate ? fromDateOnly(w.endDate) : null,
        achievementsEnc: encryptJson(dek, w.bullets),
        sortOrder: index,
      };
      const matchId = existingByKey.get(key(w.company, w.startDate));
      if (matchId && !keptIds.has(matchId)) {
        keptIds.add(matchId);
        await tx.workHistoryEntry.update({ where: { id: matchId }, data });
      } else {
        const created = await tx.workHistoryEntry.create({ data: { profileId, ...data }, select: { id: true } });
        keptIds.add(created.id);
      }
    }
    // Everything not matched or just created is a role the base resume no longer has.
    await tx.workHistoryEntry.deleteMany({ where: { profileId, id: { notIn: [...keptIds] } } });

    await tx.educationEntry.deleteMany({ where: { profileId } });
    await tx.educationEntry.createMany({
      data: profile.education.map((e, index) => ({
        profileId,
        institution: e.institution,
        degree: e.degree,
        field: e.field,
        startDate: e.startDate ? fromDateOnly(e.startDate) : null,
        endDate: e.endDate ? fromDateOnly(e.endDate) : null,
        sortOrder: index,
      })),
    });

    await tx.certificationEntry.deleteMany({ where: { profileId } });
    await tx.certificationEntry.createMany({
      data: profile.certifications.map((c, index) => ({
        profileId,
        name: c.name,
        issuer: c.issuer,
        issueDate: c.issueDate ? fromDateOnly(c.issueDate) : null,
        sortOrder: index,
      })),
    });

    await tx.skillGroup.deleteMany({ where: { profileId } });
    await tx.skillGroup.createMany({
      data: profile.skills.map((g, index) => ({ profileId, category: g.category, skills: g.skills, sortOrder: index })),
    });

    await tx.profile.update({
      where: { id: profileId },
      data: {
        fullNameEnc: encryptField(dek, p.fullName),
        contactEmailEnc: encryptField(dek, p.contactEmail),
        phoneEnc: encryptField(dek, p.phone),
        linkedinUrlEnc: encryptOptionalField(dek, p.linkedinUrl),
        cityEnc: encryptOptionalField(dek, p.city),
        stateEnc: encryptOptionalField(dek, p.state),
        professionalSummaryEnc: encryptOptionalField(dek, p.professionalSummary),
        baseResumeTextEnc: encryptField(dek, sourceText),
        baseResumeFileName: source.fileName,
        baseResumeImportedAt: new Date(),
      },
    });
  }, TRANSACTION_OPTIONS), { idempotent: true });
}

/**
 * Creates a brand-new profile from an admin-reviewed base resume. The profile
 * row (with its own encryption key and the reference-only fields) is created
 * first; if writing the resume content then fails, it's removed again so no
 * half-built profile is left behind.
 */
export async function createProfileFromReviewedResume(
  profile: ReviewedProfile,
  source: BaseResumeSource,
  teamId: string | null
): Promise<string> {
  checkSource(source);
  const p = profile.personal;

  const profileId = await createProfile(
    {
      fullName: p.fullName,
      contactEmail: p.contactEmail,
      phone: p.phone,
      linkedinUrl: p.linkedinUrl ?? undefined,
      professionalSummary: p.professionalSummary ?? undefined,
      city: p.city ?? undefined,
      state: p.state ?? undefined,
      dateOfBirth: p.dateOfBirth ?? undefined,
      addressLine1: p.addressLine1 ?? undefined,
      addressLine2: p.addressLine2 ?? undefined,
      postalCode: p.postalCode ?? undefined,
      country: p.country ?? undefined,
    },
    teamId
  );

  try {
    await applyReviewedProfile(profileId, profile, source);
  } catch (err) {
    await db.profile.delete({ where: { id: profileId } }).catch(() => {});
    throw err;
  }
  return profileId;
}
