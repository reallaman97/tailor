import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/require-user";
import { prepareResumeForEmail } from "@/lib/inbox/store";

// Building a tailored resume takes 1–2 minutes, like the Resume Builder.
export const maxDuration = 300;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await requireSuperAdmin();
  // requireSuperAdmin has verified team-admin power, which building on a profile's behalf needs.
  const result = await prepareResumeForEmail({ id: admin.id, role: "TEAM_ADMIN" }, id);
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
