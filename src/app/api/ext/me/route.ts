import { NextResponse } from "next/server";
import { getExtUser } from "@/lib/ext/session";

/** Extension: check whether the bearer token (or session cookie) is a valid Resume Platform login. */
export async function GET(request: Request) {
  const user = await getExtUser(request);
  if (!user) return NextResponse.json({ authenticated: false }, { status: 401 });
  return NextResponse.json({ authenticated: true, user: { email: user.email, role: user.role } });
}
