import { NextResponse } from "next/server";
import { requireResumePlatformAccess } from "@/lib/auth/require-user";
import { hasTeamAdminPower } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { getResume } from "@/lib/resumes/resumes";
import { getApplicationDetail } from "@/lib/admin/applications";

function sanitizeFilenamePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "job";
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireResumePlatformAccess();

  let resume = await getResume(user.id, id);

  if (!resume) {
    // Not the owner (or no profile access) — allow a superadmin to download
    // any user's job description. Re-check the role fresh rather than trusting the JWT claim.
    const fresh = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { role: true } });
    if (hasTeamAdminPower(fresh.role)) {
      resume = await getApplicationDetail(id);
    }
  }
  if (!resume) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filename = `${sanitizeFilenamePart(resume.companyName)}-${sanitizeFilenamePart(resume.jobTitle)}-job-description.txt`;

  return new NextResponse(resume.jobDescription, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
