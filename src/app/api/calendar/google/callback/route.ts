import { NextResponse } from "next/server";
import { requireInterviewAccess } from "@/lib/auth/require-user";
import { exchangeCode, fetchAccountEmail, googleRedirectUri } from "@/lib/calendar/google";
import { saveGoogleConnection } from "@/lib/calendar/connections";
import { syncConnection } from "@/lib/calendar/sync";
import { verifyExtToken } from "@/lib/ext/token";

/** Google redirects here with an authorization code; exchange it, store tokens, initial sync. */
export async function GET(request: Request) {
  const user = await requireInterviewAccess();
  const url = new URL(request.url);
  const origin = url.origin;
  const back = (status: string) => NextResponse.redirect(`${origin}/interview?calendar=${status}`);

  if (url.searchParams.get("error")) return back("denied");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  // The signed state must decode to the same user completing the flow.
  if (!code || !state || verifyExtToken(state) !== user.id) return back("error");

  try {
    const redirectUri = googleRedirectUri(origin);
    const tokens = await exchangeCode(code, redirectUri);
    const email = await fetchAccountEmail(tokens.accessToken);
    await saveGoogleConnection(user.id, tokens, email);
    // Best-effort first sync so events show up immediately.
    await syncConnection(user.id).catch(() => {});
    return back("connected");
  } catch {
    return back("error");
  }
}
