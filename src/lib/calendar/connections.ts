import { db } from "@/lib/db";
import { getMasterKey, encryptText, decryptText } from "@/lib/crypto/envelope";
import { refreshAccessToken, type GoogleTokens } from "@/lib/calendar/google";

export type ConnectionView = {
  provider: string;
  accountEmail: string | null;
  status: string; // active | needs_reauth
  lastSyncedAt: Date | null;
  lastError: string | null;
};

/** UI-facing connection state for the current user — never exposes tokens. */
export async function getConnectionView(userId: string): Promise<ConnectionView | null> {
  const row = await db.calendarConnection.findUnique({
    where: { userId },
    select: { provider: true, accountEmail: true, status: true, lastSyncedAt: true, lastError: true },
  });
  return row ?? null;
}

/** Creates/replaces the user's Google connection with freshly-encrypted tokens. */
export async function saveGoogleConnection(userId: string, tokens: GoogleTokens, accountEmail: string | null): Promise<void> {
  const key = getMasterKey();
  const accessTokenEnc = encryptText(key, tokens.accessToken);
  const refreshTokenEnc = tokens.refreshToken ? encryptText(key, tokens.refreshToken) : undefined;

  await db.calendarConnection.upsert({
    where: { userId },
    create: {
      userId,
      provider: "google",
      accountEmail,
      accessTokenEnc,
      refreshTokenEnc: refreshTokenEnc ?? "",
      expiresAt: tokens.expiresAt,
      status: "active",
    },
    update: {
      accountEmail,
      accessTokenEnc,
      // Only overwrite the refresh token if Google returned a new one.
      ...(refreshTokenEnc ? { refreshTokenEnc } : {}),
      expiresAt: tokens.expiresAt,
      status: "active",
      lastError: null,
    },
  });
}

export async function disconnectCalendar(userId: string): Promise<void> {
  // Cascades to ExternalEvent rows.
  await db.calendarConnection.deleteMany({ where: { userId } });
}

type ConnectionRow = {
  id: string;
  userId: string;
  accessTokenEnc: string;
  refreshTokenEnc: string | null;
  expiresAt: Date;
  status: string;
};

/** Loads the raw connection row (with encrypted tokens) — internal to the calendar module. */
export async function getConnectionRow(userId: string): Promise<ConnectionRow | null> {
  return db.calendarConnection.findUnique({
    where: { userId },
    select: { id: true, userId: true, accessTokenEnc: true, refreshTokenEnc: true, expiresAt: true, status: true },
  });
}

export class NeedsReauthError extends Error {
  constructor() {
    super("Calendar connection needs to be reconnected.");
  }
}

/**
 * Returns a usable access token for the connection, refreshing (and persisting
 * the new token) when the current one is expired. Marks the connection
 * needs_reauth and throws if the refresh token is missing or rejected.
 */
export async function getValidAccessToken(row: ConnectionRow): Promise<string> {
  const key = getMasterKey();

  if (row.expiresAt.getTime() > Date.now()) {
    return decryptText(key, row.accessTokenEnc);
  }

  if (!row.refreshTokenEnc) {
    await db.calendarConnection.update({ where: { id: row.id }, data: { status: "needs_reauth" } });
    throw new NeedsReauthError();
  }

  try {
    const refreshed = await refreshAccessToken(decryptText(key, row.refreshTokenEnc));
    await db.calendarConnection.update({
      where: { id: row.id },
      data: {
        accessTokenEnc: encryptText(key, refreshed.accessToken),
        expiresAt: refreshed.expiresAt,
        ...(refreshed.refreshToken ? { refreshTokenEnc: encryptText(key, refreshed.refreshToken) } : {}),
        status: "active",
        lastError: null,
      },
    });
    return refreshed.accessToken;
  } catch {
    await db.calendarConnection.update({
      where: { id: row.id },
      data: { status: "needs_reauth", lastError: "Token refresh failed — reconnect the calendar." },
    });
    throw new NeedsReauthError();
  }
}
