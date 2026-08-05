/**
 * Minimal Google OAuth 2.0 + Calendar API client (raw fetch — no SDK).
 *
 * This is a *calendar-connection* flow, separate from Auth.js login: an
 * already-signed-in user grants read-only calendar access, and we store the
 * tokens against their account. Keep the app an "Internal" / Testing OAuth app
 * so the calendar.readonly restricted scope needs no Google verification.
 *
 * Required env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET.
 * The redirect URI is derived from the request origin (or GOOGLE_REDIRECT_URI)
 * and must be registered in the Google Cloud OAuth client.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const EVENTS_ENDPOINT = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v2/userinfo";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];

export function isGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function clientCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google Calendar is not configured (GOOGLE_CLIENT_ID/SECRET).");
  return { clientId, clientSecret };
}

/** The callback URL — must exactly match a redirect URI registered in Google Cloud. */
export function googleRedirectUri(requestOrigin: string): string {
  return process.env.GOOGLE_REDIRECT_URI || `${requestOrigin}/api/calendar/google/callback`;
}

/** The consent-screen URL to send the user to. `state` ties the callback back to the user + CSRF. */
export function googleAuthUrl(redirectUri: string, state: string): string {
  const { clientId } = clientCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline", // ask for a refresh token
    prompt: "consent", // force a refresh token even on re-connect
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export type GoogleTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
};

function tokensFromResponse(json: { access_token: string; refresh_token?: string; expires_in: number }): GoogleTokens {
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    // Renew a minute early to avoid edge-of-expiry failures.
    expiresAt: new Date(Date.now() + (json.expires_in - 60) * 1000),
  };
}

export async function exchangeCode(code: string, redirectUri: string): Promise<GoogleTokens> {
  const { clientId, clientSecret } = clientCredentials();
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status}): ${await res.text()}`);
  return tokensFromResponse(await res.json());
}

export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const { clientId, clientSecret } = clientCredentials();
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed (${res.status})`);
  const tokens = tokensFromResponse(await res.json());
  // A refresh response usually omits refresh_token; keep the existing one.
  if (!tokens.refreshToken) tokens.refreshToken = refreshToken;
  return tokens;
}

export async function fetchAccountEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(USERINFO_ENDPOINT, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) return null;
    const json = (await res.json()) as { email?: string };
    return json.email ?? null;
  } catch {
    return null;
  }
}

export type GoogleEvent = {
  id: string;
  status: string; // "confirmed" | "tentative" | "cancelled"
  iCalUID?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  organizer?: { email?: string; displayName?: string };
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

/**
 * One page of a calendar's events, expanded (singleEvents) within a window and
 * including cancellations (showDeleted) so we can reconcile removals.
 */
export async function fetchEventsPage(
  accessToken: string,
  params: { timeMin: string; timeMax: string; pageToken?: string }
): Promise<{ items: GoogleEvent[]; nextPageToken?: string }> {
  const query = new URLSearchParams({
    timeMin: params.timeMin,
    timeMax: params.timeMax,
    singleEvents: "true",
    showDeleted: "true",
    orderBy: "startTime",
    maxResults: "250",
    ...(params.pageToken ? { pageToken: params.pageToken } : {}),
  });
  const res = await fetch(`${EVENTS_ENDPOINT}?${query.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) throw new Error(`Google events fetch failed (${res.status})`);
  const json = (await res.json()) as { items?: GoogleEvent[]; nextPageToken?: string };
  return { items: json.items ?? [], nextPageToken: json.nextPageToken };
}

/** Thrown when the access token is rejected — the caller should refresh and retry, or mark needs_reauth. */
export class UnauthorizedError extends Error {
  constructor() {
    super("Google access token unauthorized");
  }
}
