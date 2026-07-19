import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { getResume } from "@/lib/resumes/resumes";
import { getResumeFields } from "@/lib/profile/resume-fields";
import { getTailoredContent } from "@/lib/tailoring/tailor-resume";
import { buildResumeDocument } from "@/lib/export/build-document";
import { renderResumePdf } from "@/lib/export/render-pdf";

function sanitizeFilenamePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "resume";
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const resume = await getResume(user.id, id);
  if (!resume) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }

  const resumeFields = await getResumeFields(user.id);
  if (!resumeFields) {
    return NextResponse.json(
      { error: "Save your personal info before exporting a resume" },
      { status: 400 }
    );
  }

  const tailoredContent = await getTailoredContent(user.id, id);
  const document = buildResumeDocument(resumeFields, tailoredContent);
  const pdfBuffer = await renderResumePdf(document);

  const filename = `${sanitizeFilenamePart(resumeFields.fullName)}-${sanitizeFilenamePart(resume.companyName)}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
