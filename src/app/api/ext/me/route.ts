import { NextResponse } from "next/server";
import { getExtUser } from "@/lib/ext/session";

/** Extension: check whether the reused session cookie is a valid Resume Platform login. */
export async function GET() {
  const user = await getExtUser();
  if (!user) return NextResponse.json({ authenticated: false }, { status: 401 });
  return NextResponse.json({ authenticated: true, user: { email: user.email, role: user.role } });
}
