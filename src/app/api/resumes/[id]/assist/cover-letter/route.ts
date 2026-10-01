import { NextResponse } from "next/server";
import { requireResumePlatformAccess } from "@/lib/auth/require-user";
import { runCoverLetter } from "@/lib/assist/service";

// A route handler, not a server action, so it never queues the page's other
// actions behind it — see src/lib/assist/service.ts. The AI call itself is
// capped well under this (see OVERALL_DEADLINE_MS).
export const maxDuration = 120;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireResumePlatformAccess();
  const body = (await request.json().catch(() => ({}))) as { instructions?: unknown };
  const instructions = typeof body.instructions === "string" ? body.instructions : "";
  const result = await runCoverLetter(user, id, instructions);
  return NextResponse.json(result, { status: result.error ? 422 : 200 });
}
