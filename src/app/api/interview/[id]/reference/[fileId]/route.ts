import { NextResponse } from "next/server";
import { requireInterviewAccess } from "@/lib/auth/require-user";
import { getReferenceFile } from "@/lib/interview/interviews";

function sanitizeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "file";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const { id, fileId } = await params;
  const access = await requireInterviewAccess();

  // Scoped in the domain layer: a Caller only reads files on their own interview.
  const file = await getReferenceFile(access, id, fileId);
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
