import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireResumePlatformAccess } from "@/lib/auth/require-user";
import { ResumeNotFoundError } from "@/lib/resumes/resumes";
import { cancelApplication, ApplicationCancelError } from "@/lib/resumes/build";

// A route handler, not a server action: it's also used to stop a build that's
// still running, and server actions would queue it behind that build.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireResumePlatformAccess();
  try {
    await cancelApplication(user, id);
  } catch (err) {
    if (err instanceof ResumeNotFoundError) {
      return NextResponse.json({ error: "This application no longer exists." }, { status: 404 });
    }
    if (err instanceof ApplicationCancelError) return NextResponse.json({ error: err.message }, { status: 409 });
    throw err;
  }
  revalidatePath("/resumes");
  revalidatePath(`/resumes/${id}`);
  revalidatePath("/dashboard");
  return NextResponse.json({ ok: true });
}
