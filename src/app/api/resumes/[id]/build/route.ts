import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireResumePlatformAccess } from "@/lib/auth/require-user";
import { ResumeNotFoundError } from "@/lib/resumes/resumes";
import { buildApplication } from "@/lib/resumes/build";

// Generation typically takes 1–2 minutes. A route handler, not a server
// action, so it can be stopped — see src/lib/resumes/build.ts.
export const maxDuration = 300;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireResumePlatformAccess();
  try {
    // request.signal aborts when the browser cancels the request ("Stop
    // generation", or the tab closing), which cancels the DeepSeek call too.
    const result = await buildApplication(user, id, request.signal);
    revalidatePath("/resumes");
    revalidatePath("/dashboard");
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (err) {
    if (err instanceof ResumeNotFoundError) {
      return NextResponse.json({ ok: false, error: "This application no longer exists." }, { status: 404 });
    }
    throw err;
  }
}
