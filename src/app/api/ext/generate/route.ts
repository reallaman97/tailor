import { NextResponse } from "next/server";
import { z } from "zod";
import { hasTeamAdminPower } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { getExtUser } from "@/lib/ext/session";
import { getAssignedProfileId } from "@/lib/profile/shared";
import { getProfileNames } from "@/lib/profile/personal-info";
import { createResume, DuplicateApplicationError, uploadScreenshot } from "@/lib/resumes/resumes";
import { extractJobPosting } from "@/lib/resumes/extract-job-posting";
import { tailorResume, decryptTailoredContent, ProfileIncompleteError } from "@/lib/tailoring/tailor-resume";
import { getResumeFieldsForResume } from "@/lib/profile/resume-fields";
import { buildResumeDocument } from "@/lib/export/build-document";
import { renderResumePdf } from "@/lib/export/render-pdf";
import { effectiveStyleKey } from "@/lib/export/styles";
import { getProfileTemplate } from "@/lib/profile/template";
import { getSettings } from "@/lib/settings";
import type { RoleTrack } from "@/generated/prisma/client";

// The OpenAI tailoring call runs inline; give the route headroom (see the web
// generation route). Raise to 300 on Vercel Pro if generations run long.
export const maxDuration = 60;

const bodySchema = z.object({
  profileId: z.string().optional(),
  jobDescription: z
    .string()
    .trim()
    .min(20, "Select the full job description (at least 20 characters)")
    .max(20_000, "Job description is too long (max 20,000 characters)"),
  jobLink: z.union([z.url(), z.literal("")]).optional(),
  companyName: z.string().optional(),
  jobTitle: z.string().optional(),
  pageTitle: z.string().optional(),
  pageUrl: z.string().optional(),
  // Optional proof-of-application screenshot of the job page, captured by the
  // extension as a data: URL (image/png|jpeg|webp) — stored like the web upload.
  screenshot: z.string().optional(),
});

/** Parses a `data:image/...;base64,...` URL into bytes + mime, or null if malformed/unsupported. */
function parseScreenshot(dataUrl: string): { data: Buffer; mimeType: string } | null {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(dataUrl.trim());
  if (!match) return null;
  try {
    return { data: Buffer.from(match[2], "base64"), mimeType: match[1] };
  } catch {
    return null;
  }
}

function sanitizeFilenamePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "resume";
}

export async function POST(request: Request) {
  const user = await getExtUser(request);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues[0]?.message ?? "Invalid request" : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Resolve which account "owns" the application and which profile to tailor for.
  // Building as one of a profile's assigned accounts is how the web app scopes
  // this too (several accounts can share one profile).
  let ownerUserId: string;
  if (hasTeamAdminPower(user.role)) {
    if (!body.profileId) return NextResponse.json({ error: "Select a profile to build for" }, { status: 400 });
    const owner = await db.user.findFirst({
      where: { profileId: body.profileId },
      orderBy: { email: "asc" },
      select: { id: true },
    });
    if (!owner) {
      return NextResponse.json({ error: "That profile has no assigned account to build for" }, { status: 400 });
    }
    ownerUserId = owner.id;
  } else {
    const assigned = await getAssignedProfileId(user.id);
    if (!assigned) return NextResponse.json({ error: "You have no assigned profile yet" }, { status: 400 });
    if (body.profileId && body.profileId !== assigned) {
      return NextResponse.json({ error: "You can only build for your assigned profile" }, { status: 403 });
    }
    ownerUserId = user.id;
  }

  // Derive company / title (and role track) from the description + page hints
  // when the extension didn't supply them (the one-click flow).
  let companyName = body.companyName?.trim();
  let jobTitle = body.jobTitle?.trim();
  let roleTrack: RoleTrack = "OTHER";
  if (!companyName || !jobTitle) {
    const extracted = await extractJobPosting(body.jobDescription, {
      pageTitle: body.pageTitle,
      pageUrl: body.pageUrl,
    });
    companyName = companyName || extracted.companyName;
    jobTitle = jobTitle || extracted.jobTitle;
    roleTrack = extracted.roleTrack;
  }

  // Record the job posting URL like the web form does — prefer an explicit
  // jobLink, else the page the description was selected from. It's also a
  // duplicate-detection key (normalized server-side).
  const pageUrlAsLink = body.pageUrl && /^https?:\/\//i.test(body.pageUrl) ? body.pageUrl : undefined;

  // Create the tracked application (same as the web "Build resume").
  let resumeId: string;
  try {
    resumeId = await createResume(ownerUserId, {
      jobLink: body.jobLink || pageUrlAsLink,
      companyName,
      jobTitle,
      jobDescription: body.jobDescription,
      roleTrack,
      source: "JOB_BOARD",
      status: "APPLIED",
    });
  } catch (err) {
    if (err instanceof DuplicateApplicationError) {
      return NextResponse.json(
        { error: err.message, duplicate: true, existing: err.existing },
        { status: 409 }
      );
    }
    throw err;
  }

  // Tailor; on failure roll the application back so nothing partial is recorded.
  try {
    await tailorResume(ownerUserId, resumeId);
  } catch (err) {
    await db.resume.delete({ where: { id: resumeId } }).catch(() => {});
    if (err instanceof ProfileIncompleteError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const detail = err instanceof Error ? err.message : "Tailoring failed";
    return NextResponse.json({ error: detail }, { status: 502 });
  }

  // Store the proof-of-application screenshot (same record as the web upload).
  // Best-effort: a bad/oversized image must not throw away a successful build.
  let proofSaved = false;
  if (body.screenshot) {
    const parsed = parseScreenshot(body.screenshot);
    if (parsed) {
      try {
        await uploadScreenshot(ownerUserId, resumeId, parsed.data, parsed.mimeType);
        proofSaved = true;
      } catch {
        // ignore — the application is still recorded, just without proof
      }
    }
  }

  // Render the tailored PDF in the profile's style.
  const resume = await db.resume.findUnique({
    where: { id: resumeId },
    select: { profileId: true, tailoredContentEnc: true },
  });
  const resumeFields = await getResumeFieldsForResume(ownerUserId, resume?.profileId ?? null);
  if (!resumeFields) return NextResponse.json({ error: "Profile has no personal info saved" }, { status: 400 });

  const tailored = await decryptTailoredContent(resume?.profileId ?? null, resume?.tailoredContentEnc ?? null);
  const document = buildResumeDocument(resumeFields, tailored);
  const settings = await getSettings();
  const styleKey = effectiveStyleKey(
    resume?.profileId ? await getProfileTemplate(resume.profileId) : null,
    settings.resumeTemplate
  );
  const pdf = await renderResumePdf(document, styleKey);

  const profileName = resume?.profileId
    ? (await getProfileNames([resume.profileId])).get(resume.profileId) ?? resumeFields.fullName
    : resumeFields.fullName;
  const filename = `${sanitizeFilenamePart(profileName)}-${sanitizeFilenamePart(companyName)}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Resume-Id": resumeId,
      "X-Profile-Name": encodeURIComponent(profileName),
      "X-Company": encodeURIComponent(companyName),
      "X-Job-Title": encodeURIComponent(jobTitle),
      "X-Proof-Saved": proofSaved ? "1" : "0",
    },
  });
}
