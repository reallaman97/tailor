import { NextResponse } from "next/server";
import { requireInterviewAccess } from "@/lib/auth/require-user";
import { getResumeFile } from "@/lib/interview/interviews";

function sanitizeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "resume";
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireInterviewAccess();

  // Scoped in the domain layer: a Caller only reads their own interview's file.
  const file = await getResumeFile(access, id);
  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `attachment; filename="${sanitizeFilename(file.filename)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
