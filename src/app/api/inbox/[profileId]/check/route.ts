import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/require-user";
import { checkMailbox, MailboxNotConnectedError } from "@/lib/inbox/process";

// One batch of new mail per call (classification can take an LLM call per
// email); the page calls again while `remaining` > 0.
export const maxDuration = 300;

export async function POST(_request: Request, { params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  const admin = await requireSuperAdmin();
  try {
    const result = await checkMailbox(profileId, admin.id);
    revalidatePath("/interview-tracker");
    return NextResponse.json(result);
  } catch (err) {
    const status = err instanceof MailboxNotConnectedError ? 400 : 502;
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't check the mailbox." }, { status });
  }
}
