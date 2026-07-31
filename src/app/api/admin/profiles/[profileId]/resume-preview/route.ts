import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/require-user";
import { getResumeFieldsForProfile } from "@/lib/profile/resume-fields";
import { buildResumeDocument } from "@/lib/export/build-document";
import { renderResumePdf } from "@/lib/export/render-pdf";
import { getResumeStyle } from "@/lib/export/styles";

/** Superadmin: preview a profile's (untailored) resume rendered in a given style. */
export async function GET(request: Request, { params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  await requireSuperAdmin();

  const style = getResumeStyle(new URL(request.url).searchParams.get("style"));
  const fields = await getResumeFieldsForProfile(profileId);
  if (!fields) {
    return NextResponse.json({ error: "Save the profile's personal info before previewing." }, { status: 400 });
  }

  const document = buildResumeDocument(fields, null);
  const pdf = await renderResumePdf(document, style.key);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="preview-${style.key}.pdf"`,
    },
  });
}
