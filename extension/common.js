// Shared helpers for the background service worker, options, and popup.

/** Reads persisted settings (API URL + selected profile). Auth itself is the reused session cookie. */
export async function getSettings() {
  return chrome.storage.local.get({ apiUrl: "", profileId: "", profileName: "" });
}

export async function setSettings(patch) {
  await chrome.storage.local.set(patch);
}

/** Normalizes the configured base URL (strips trailing slashes). */
export function apiBase(url) {
  return String(url || "").trim().replace(/\/+$/, "");
}

/** fetch against the platform, always including the reused session cookie. */
export function apiFetch(apiUrl, path, options = {}) {
  return fetch(apiBase(apiUrl) + path, { credentials: "include", ...options });
}

/**
 * Logs in through the platform's normal Auth.js credentials flow so the browser
 * stores the same session cookie the web app uses. Returns the authenticated
 * user, or throws on failure.
 */
export async function login(apiUrl, email, password) {
  const base = apiBase(apiUrl);
  if (!base) throw new Error("Set the API URL first.");

  const csrfRes = await fetch(base + "/api/auth/csrf", { credentials: "include" });
  if (!csrfRes.ok) throw new Error("Couldn't reach the API — check the URL.");
  const { csrfToken } = await csrfRes.json();

  const body = new URLSearchParams({
    email,
    password,
    csrfToken,
    callbackUrl: base + "/resumes",
    json: "true",
  });
  await fetch(base + "/api/auth/callback/credentials", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    redirect: "manual",
  });

  // The callback sets the cookie but doesn't cleanly report success cross-origin;
  // confirm by asking the API who we are.
  const me = await fetch(base + "/api/ext/me", { credentials: "include" });
  if (!me.ok) throw new Error("Invalid email/password, or the account isn't approved for the Resume Platform.");
  return (await me.json()).user;
}

/** Clears the platform session (best-effort Auth.js signout). */
export async function logout(apiUrl) {
  const base = apiBase(apiUrl);
  try {
    const csrfRes = await fetch(base + "/api/auth/csrf", { credentials: "include" });
    const { csrfToken } = await csrfRes.json();
    await fetch(base + "/api/auth/signout", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ csrfToken, callbackUrl: base, json: "true" }).toString(),
      redirect: "manual",
    });
  } catch {
    // ignore — worst case the cookie expires on its own
  }
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
