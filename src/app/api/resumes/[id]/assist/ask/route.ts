import { NextResponse } from "next/server";
import { requireResumePlatformAccess } from "@/lib/auth/require-user";
import { runAskQuestion } from "@/lib/assist/service";

// A route handler, not a server action, so it never queues the page's other
// actions behind it — see src/lib/assist/service.ts.
export const maxDuration = 120;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireResumePlatformAccess();
  const body = await request.json().catch(() => null);
  const result = await runAskQuestion(user, id, body);
  return NextResponse.json(result, { status: result.error ? 422 : 200 });
}
