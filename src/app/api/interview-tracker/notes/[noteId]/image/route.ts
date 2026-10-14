import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/require-user";
import { getTrackerNoteImage } from "@/lib/interview-tracker/tracker";

export async function GET(_request: Request, { params }: { params: Promise<{ noteId: string }> }) {
  const { noteId } = await params;
  await requireSuperAdmin();
  const image = await getTrackerNoteImage(noteId);
  if (!image) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.mimeType,
      // A note's image never changes (notes are deleted, not edited) — let the
      // browser keep it, so each image leaves the database once per viewer.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
