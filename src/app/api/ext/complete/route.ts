import { NextResponse } from "next/server";
import { z } from "zod";
import { hasTeamAdminPower } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { archiveScreenshot } from "@/lib/resumes/screenshot-archive";
import { getExtUser, type ExtUser } from "@/lib/ext/session";
import { getAssignedProfileId } from "@/lib/profile/shared";
import { normalizeJobUrl } from "@/lib/resumes/normalize-url";
import type { Prisma } from "@/generated/prisma/client";

export const maxDuration = 30;

const MAX_SCREENSHOT_BYTES = 4.5 * 1024 * 1024;

const bodySchema = z.object({
  profileId: z.string().optional(),
  // The application to complete — identified by the id the extension recorded at
  // generate time, or (fallback) matched to the page it was generated from.
  resumeId: z.string().optional(),
  pageUrl: z.string().optional(),
  // Proof-of-application screenshot as a data: URL (image/png|jpeg|webp).
  screenshot: z.string().min(1, "Missing screenshot"),
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

type AuthResult =
  | { ok: true; where: Prisma.ResumeWhereInput; fallbackWhere: Prisma.ResumeWhereInput }
  | { ok: false; response: NextResponse };

/**
 * Which applications this account may complete. `where` authorizes a specific
 * target (by id or page URL); `fallbackWhere` finds the most-recent
 * unproofed application to offer when the page matches nothing:
 * - SUPERADMIN acts on a chosen profile's applications.
 * - a BIDDER acts on their own applications (and their assigned profile's),
 *   and the fallback is strictly *their own* last unproofed one.
 */
async function resolveAuth(user: ExtUser, profileId: string | undefined): Promise<AuthResult> {
  if (hasTeamAdminPower(user.role)) {
    if (!profileId) {
      return { ok: false, response: NextResponse.json({ error: "Select a profile first" }, { status: 400 }) };
    }
    return { ok: true, where: { profileId }, fallbackWhere: { profileId, screenshotData: null } };
  }

  const assigned = await getAssignedProfileId(user.id);
  if (profileId && assigned && profileId !== assigned) {
    return {
      ok: false,
      response: NextResponse.json({ error: "You can only complete applications for your assigned profile" }, { status: 403 }),
    };
  }
  const where: Prisma.ResumeWhereInput = assigned
    ? { OR: [{ userId: user.id }, { profileId: assigned }] }
    : { userId: user.id };
  return { ok: true, where, fallbackWhere: { userId: user.id, screenshotData: null } };
}

/** Narrows an auth filter to one application by recorded id, else by posting URL. */
function targetWhere(
  base: Prisma.ResumeWhereInput,
  target: { resumeId?: string; pageUrl?: string }
): Prisma.ResumeWhereInput | null {
  if (target.resumeId) return { AND: [base, { id: target.resumeId }] };
  if (target.pageUrl) {
    return { AND: [base, { jobLink: { equals: normalizeJobUrl(target.pageUrl), mode: "insensitive" } }] };
  }
  return null;
}

/**
 * Resolve which application a "Complete application" click would attach to,
 * WITHOUT uploading — so the extension can confirm a fallback with the user
 * first. Returns { match: "page" | "fallback" | "none" }.
 */
export async function GET(request: Request) {
  const user = await getExtUser(request);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const profileId = params.get("profileId") ?? undefined;
  const pageUrl = params.get("pageUrl") ?? undefined;
  const resumeId = params.get("resumeId") ?? undefined;

  const auth = await resolveAuth(user, profileId);
  if (!auth.ok) return auth.response;

  const tw = targetWhere(auth.where, { resumeId, pageUrl });
  const match = tw
    ? await db.resume.findFirst({
        where: tw,
        orderBy: { createdAt: "desc" },
        select: { id: true, companyName: true, jobTitle: true },
      })
    : null;
  if (match) {
    return NextResponse.json({ match: "page", resumeId: match.id, companyName: match.companyName, jobTitle: match.jobTitle });
  }

  // No application is linked to this page — offer the last unproofed one.
  const fallback = await db.resume.findFirst({
    where: auth.fallbackWhere,
    orderBy: [{ appliedAt: "desc" }, { createdAt: "desc" }],
    select: { id: true, companyName: true, jobTitle: true, appliedAt: true, createdAt: true },
  });
  if (!fallback) return NextResponse.json({ match: "none" });

  return NextResponse.json({
    match: "fallback",
    resumeId: fallback.id,
    companyName: fallback.companyName,
    jobTitle: fallback.jobTitle,
    appliedAt: (fallback.appliedAt ?? fallback.createdAt).toISOString(),
  });
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

  if (!body.resumeId && !body.pageUrl) {
    return NextResponse.json({ error: "No application specified." }, { status: 400 });
  }

  const auth = await resolveAuth(user, body.profileId);
  if (!auth.ok) return auth.response;

  const tw = targetWhere(auth.where, { resumeId: body.resumeId, pageUrl: body.pageUrl });
  const resume = tw
    ? await db.resume.findFirst({
        where: tw,
        orderBy: { createdAt: "desc" },
        select: { id: true, companyName: true, jobTitle: true },
      })
    : null;
  if (!resume) {
    return NextResponse.json(
      { error: "No application found for this page — generate a resume here first." },
      { status: 404 }
    );
  }

  const parsed = parseScreenshot(body.screenshot);
  if (!parsed) return NextResponse.json({ error: "Unsupported screenshot format" }, { status: 400 });
  if (parsed.data.byteLength > MAX_SCREENSHOT_BYTES) {
    return NextResponse.json({ error: "Image is too large (max 4.5MB)." }, { status: 400 });
  }

  // The resume was already authorized above (via `where`/`targetWhere`), so write
  // the proof directly — uploading proof always resets approval to PENDING for
  // superadmin re-review, matching the web upload.
  const stored = (await archiveScreenshot(parsed.data)) ?? parsed;
  await db.resume.update({
    where: { id: resume.id },
    data: {
      screenshotData: new Uint8Array(stored.data),
      screenshotMimeType: stored.mimeType,
      approvalStatus: "PENDING",
      approvedAt: null,
    },
  });

  return NextResponse.json({
    completed: true,
    resumeId: resume.id,
    companyName: resume.companyName,
    jobTitle: resume.jobTitle,
  });
}
