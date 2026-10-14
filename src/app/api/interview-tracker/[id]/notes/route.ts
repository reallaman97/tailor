import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/require-user";
import { addTrackerNote, NoteInputError } from "@/lib/interview-tracker/tracker";
import { compressNoteImage } from "@/lib/resumes/screenshot-archive";

// A route handler (not a server action) so a screenshot isn't held to the
// server-action body limit, and so posting never queues behind other actions.
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
// Vercel functions accept request bodies up to 4.5MB; the form downsizes larger images first.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await requireSuperAdmin();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Couldn't read the note." }, { status: 400 });
  }
  const body = typeof form.get("body") === "string" ? (form.get("body") as string) : "";
  const file = form.get("image");

  let image: { data: Buffer; mimeType: string } | null = null;
  if (file instanceof File && file.size > 0) {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Screenshots must be PNG, JPEG, or WEBP." }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: "That image is too large (max 4MB)." }, { status: 400 });
    const original = { data: Buffer.from(await file.arrayBuffer()), mimeType: file.type };
    image = (await compressNoteImage(original.data)) ?? original;
  }

  try {
    await addTrackerNote(admin.id, id, { body, image });
  } catch (err) {
    if (err instanceof NoteInputError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
  revalidatePath(`/interview-tracker/${id}`);
  revalidatePath("/interview-tracker");
  return NextResponse.json({ ok: true });
}
