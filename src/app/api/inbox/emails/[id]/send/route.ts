import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/require-user";
import { sendEmailReply, ReplyError } from "@/lib/inbox/store";

export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSuperAdmin();
  const body = (await request.json().catch(() => ({}))) as { text?: unknown; attachResume?: unknown };
  try {
    await sendEmailReply(id, typeof body.text === "string" ? body.text : "", body.attachResume === true);
  } catch (err) {
    const status = err instanceof ReplyError ? 400 : 502;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't send the reply." }, { status });
  }
  revalidatePath("/interview-tracker/inbox");
  return NextResponse.json({ ok: true });
}
