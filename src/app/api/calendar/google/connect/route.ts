import { NextResponse } from "next/server";
import { requireInterviewAccess } from "@/lib/auth/require-user";
import { isGoogleConfigured, googleAuthUrl, googleRedirectUri } from "@/lib/calendar/google";
import { createExtToken } from "@/lib/ext/token";

/** Kicks off the Google Calendar connect flow for the signed-in user. */
export async function GET(request: Request) {
  const user = await requireInterviewAccess();
  const origin = new URL(request.url).origin;

  if (!isGoogleConfigured()) {
    return NextResponse.redirect(`${origin}/interview?calendar=not_configured`);
  }

  const redirectUri = googleRedirectUri(origin);
  // Signed state ties the callback back to this exact user (CSRF protection).
  const state = createExtToken(user.id);
  return NextResponse.redirect(googleAuthUrl(redirectUri, state));
}
