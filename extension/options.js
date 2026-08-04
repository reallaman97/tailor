import { getSettings, setSettings, login, logout, whoAmI, fetchProfiles } from "./common.js";

const $ = (id) => document.getElementById(id);

async function refresh() {
  const { apiUrl, profileId } = await getSettings();
  $("apiUrl").value = apiUrl || "";

  const user = apiUrl ? await whoAmI(apiUrl) : null;
  $("loggedOut").style.display = user ? "none" : "block";
  $("loggedIn").style.display = user ? "block" : "none";
  if (user) {
    $("who").textContent = user.email;
    $("role").textContent = `(${user.role})`;
    await loadProfiles(apiUrl, profileId);
  } else {
    $("profile").innerHTML = '<option value="">Sign in to load profiles</option>';
  }
}

async function loadProfiles(apiUrl, selectedId) {
  try {
    const profiles = await fetchProfiles(apiUrl);
    const select = $("profile");
    if (profiles.length === 0) {
      select.innerHTML = '<option value="">No profiles available for this account</option>';
      return;
    }
    select.innerHTML = profiles
      .map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`)
      .join("");
    if (selectedId && profiles.some((p) => p.id === selectedId)) {
      select.value = selectedId;
    } else {
      // Default to the first profile and persist it.
      select.value = profiles[0].id;
      await setSettings({ profileId: profiles[0].id, profileName: profiles[0].name });
    }
  } catch {
    $("profile").innerHTML = '<option value="">Sign in to load profiles</option>';
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

$("saveUrl").addEventListener("click", async () => {
  const apiUrl = $("apiUrl").value.trim();
  await setSettings({ apiUrl });
  $("urlStatus").textContent = "Saved.";
  setTimeout(() => ($("urlStatus").textContent = ""), 1500);
  refresh();
});

$("login").addEventListener("click", async () => {
  const apiUrl = $("apiUrl").value.trim();
  await setSettings({ apiUrl });
  const status = $("loginStatus");
  status.textContent = "Signing in…";
  status.className = "status muted";
  try {
    const user = await login(apiUrl, $("email").value.trim(), $("password").value);
    status.textContent = `Signed in as ${user.email}`;
    status.className = "status ok";
    $("password").value = "";
    refresh();
  } catch (err) {
    status.textContent = err.message || "Sign in failed.";
    status.className = "status err";
  }
});

$("logout").addEventListener("click", async () => {
  const { apiUrl } = await getSettings();
  await logout(apiUrl);
  await setSettings({ profileId: "", profileName: "" });
  refresh();
});

$("saveProfile").addEventListener("click", async () => {
  const select = $("profile");
  const profileId = select.value;
  const profileName = select.options[select.selectedIndex]?.textContent || "";
  await setSettings({ profileId, profileName });
  $("profileStatus").textContent = "Saved.";
  setTimeout(() => ($("profileStatus").textContent = ""), 1500);
});

refresh();
