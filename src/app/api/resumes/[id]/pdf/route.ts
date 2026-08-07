import { NextResponse } from "next/server";
import { requireResumePlatformAccess } from "@/lib/auth/require-user";
import { hasTeamAdminPower } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { getResume } from "@/lib/resumes/resumes";
import { getApplicationDetail } from "@/lib/admin/applications";
import { getResumeFieldsForResume } from "@/lib/profile/resume-fields";
import { decryptTailoredContent } from "@/lib/tailoring/tailor-resume";
import { buildResumeDocument } from "@/lib/export/build-document";
import { renderResumePdf } from "@/lib/export/render-pdf";
import { effectiveStyleKey } from "@/lib/export/styles";
import { getProfileTemplate } from "@/lib/profile/template";
import { getSettings } from "@/lib/settings";

function sanitizeFilenamePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "resume";
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireResumePlatformAccess();

  let resume = await getResume(user.id, id);
  let ownerUserId = user.id;

  if (!resume) {
    // Not the owner (or no profile access) — allow a superadmin to download
    // any user's resume. Re-check the role fresh rather than trusting the JWT claim.
    const fresh = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { role: true } });
    if (hasTeamAdminPower(fresh.role)) {
      const adminResume = await getApplicationDetail(id);
      if (adminResume) {
        resume = adminResume;
        ownerUserId = adminResume.userId;
      }
    }
  }
  if (!resume) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }

  // Anchor the exported fields to the resume's own profile so a name/contact
  // block can never be paired with another profile's tailored bullets after a
  // reassignment (the tailored content below is keyed to the same profileId).
  const resumeFields = await getResumeFieldsForResume(ownerUserId, resume.profileId);
  if (!resumeFields) {
    return NextResponse.json(
      { error: "Save your personal info before exporting a resume" },
      { status: 400 }
    );
  }

  const tailoredContent = await decryptTailoredContent(resume.profileId, resume.tailoredContentEnc);
  const document = buildResumeDocument(resumeFields, tailoredContent);
  const settings = await getSettings();
  const profileTemplate = resume.profileId ? await getProfileTemplate(resume.profileId) : null;
  const pdfBuffer = await renderResumePdf(document, effectiveStyleKey(profileTemplate, settings.resumeTemplate));

  const filename = `${sanitizeFilenamePart(resumeFields.fullName)}-${sanitizeFilenamePart(resume.companyName)}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
