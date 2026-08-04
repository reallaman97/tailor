import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getExtUser } from "@/lib/ext/session";
import { getAssignedProfileId } from "@/lib/profile/shared";
import { uploadScreenshot, InvalidScreenshotError } from "@/lib/resumes/resumes";
import { normalizeJobUrl } from "@/lib/resumes/normalize-url";

export const maxDuration = 30;

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

export async function POST(request: Request) {
  const user = await getExtUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (err) {
    const message = err instanceof z.ZodError ? err.issues[0]?.message ?? "Invalid request" : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!body.resumeId && !body.pageUrl) {
    return NextResponse.json({ error: "No page to complete — open the job page you generated the resume from." }, { status: 400 });
  }

  // Which profile's applications may this account complete? Mirrors the generate
  // route's scoping (the tracker is shared per profile).
  let scope: { profileId: string } | { userId: string; profileId: null };
  if (user.role === "SUPERADMIN") {
    if (!body.profileId) return NextResponse.json({ error: "Select a profile first" }, { status: 400 });
    scope = { profileId: body.profileId };
  } else {
    const assigned = await getAssignedProfileId(user.id);
    if (body.profileId && assigned && body.profileId !== assigned) {
      return NextResponse.json({ error: "You can only complete applications for your assigned profile" }, { status: 403 });
    }
    scope = assigned ? { profileId: assigned } : { userId: user.id, profileId: null };
  }

  // Locate the application: by recorded id, else by the posting URL it was built
  // from (jobLink is stored normalized, so normalize the incoming URL to match).
  const resume = await db.resume.findFirst({
    where: {
      ...scope,
      ...(body.resumeId
        ? { id: body.resumeId }
        : { jobLink: { equals: normalizeJobUrl(body.pageUrl ?? ""), mode: "insensitive" as const } }),
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, userId: true, companyName: true, jobTitle: true },
  });
  if (!resume) {
    return NextResponse.json(
      { error: "No application found for this page — generate a resume here first." },
      { status: 404 }
    );
  }

  const parsed = parseScreenshot(body.screenshot);
  if (!parsed) return NextResponse.json({ error: "Unsupported screenshot format" }, { status: 400 });

  try {
    // Scope by the application's own owner account so the shared-profile check passes.
    await uploadScreenshot(resume.userId, resume.id, parsed.data, parsed.mimeType);
  } catch (err) {
    if (err instanceof InvalidScreenshotError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }

  return NextResponse.json({
    completed: true,
    resumeId: resume.id,
    companyName: resume.companyName,
    jobTitle: resume.jobTitle,
  });
}
