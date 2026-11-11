import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { renderApplicationDocx } from "@/lib/inbox/store";

/** The Word resume that will be attached to this email's reply — to check it before sending. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSuperAdmin();
  const email = await db.inboundEmail.findUnique({ where: { id }, select: { preparedResumeId: true } });
  const file = email?.preparedResumeId ? await renderApplicationDocx(email.preparedResumeId) : null;
  if (!file) return NextResponse.json({ error: "No resume prepared for this email." }, { status: 404 });
  return new NextResponse(new Uint8Array(file.content), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${file.filename}"`,
    },
  });
}
