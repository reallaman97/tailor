import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { getScreenshot } from "@/lib/resumes/resumes";
import { getApplicationScreenshot } from "@/lib/admin/applications";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  let screenshot = await getScreenshot(user.id, id);

  if (!screenshot) {
    // Not the owner (or no screenshot) — allow a superadmin to view it for
    // review. Re-check the role fresh rather than trusting the JWT claim.
    const fresh = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { role: true } });
    if (fresh.role === "SUPERADMIN") {
      screenshot = await getApplicationScreenshot(id);
    }
  }

  if (!screenshot) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(screenshot.data), {
    headers: {
      "Content-Type": screenshot.mimeType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
