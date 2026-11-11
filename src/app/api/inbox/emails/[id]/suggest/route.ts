import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/require-user";
import { suggestReplyForEmail } from "@/lib/inbox/store";

export const maxDuration = 120;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await requireSuperAdmin();
  try {
    return NextResponse.json({ reply: await suggestReplyForEmail(admin, id) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't write a reply." }, { status: 502 });
  }
}
