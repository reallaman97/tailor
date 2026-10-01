// Shared helpers for the background service worker, options, and popup.

/** Default platform URL — used until the user overrides it in the options page. */
// The current live deployment. Update when Visa moves to its own domain;
// users can also change it in the extension's options.
export const DEFAULT_API_URL = "https://www.cutejobplatform.space";

/** Reads persisted settings (API URL + selected profile). Auth is a bearer token (see below). */
export async function getSettings() {
  return chrome.storage.local.get({ apiUrl: DEFAULT_API_URL, profileId: "", profileName: "" });
}

export async function setSettings(patch) {
  await chrome.storage.local.set(patch);
}

/** Normalizes the configured base URL (strips trailing slashes). */
export function apiBase(url) {
  return String(url || "").trim().replace(/\/+$/, "");
}

// ---------------------------------------------------------------------------
// Auth — a bearer token from /api/ext/login. A Chrome extension is cross-site
// to the platform, so the SameSite=Lax session cookie can't be reused; the
// token is sent as `Authorization: Bearer <token>` on every request instead.
// ---------------------------------------------------------------------------

export async function getToken() {
  return (await chrome.storage.local.get({ extToken: "" })).extToken;
}

async function setToken(token) {
  await chrome.storage.local.set({ extToken: token || "" });
}

/** Merges the Authorization header (if signed in) into a headers object. */
export async function authHeaders(extra = {}) {
  const token = await getToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra };
}

/** fetch against the platform with the bearer token attached. */
export async function apiFetch(apiUrl, path, options = {}) {
  const headers = await authHeaders(options.headers || {});
  return fetch(apiBase(apiUrl) + path, { credentials: "include", ...options, headers });
}

/**
 * Logs in and stores the returned bearer token. Returns the authenticated user,
 * or throws with the server's message on failure.
 */
export async function login(apiUrl, email, password) {
  const base = apiBase(apiUrl);
  if (!base) throw new Error("Set the API URL first.");

  let res;
  try {
    res = await fetch(base + "/api/ext/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error("Couldn't reach the API — check the URL.");
  }

  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.error || "Sign in failed.");
  }
  const data = await res.json();
  if (!data.token) throw new Error("Sign in failed.");
  await setToken(data.token);
  return data.user;
}

/** Clears the stored token (stateless server-side — nothing to revoke). */
export async function logout() {
  await setToken("");
}

/** Current login state, or null. */
export async function whoAmI(apiUrl) {
  try {
    const res = await apiFetch(apiUrl, "/api/ext/me");
    if (!res.ok) return null;
    return (await res.json()).user;
  } catch {
    return null;
  }
}

/** Profiles this user may build for. */
export async function fetchProfiles(apiUrl) {
  const res = await apiFetch(apiUrl, "/api/ext/profiles");
  if (!res.ok) throw new Error("Not logged in.");
  return (await res.json()).profiles ?? [];
}
