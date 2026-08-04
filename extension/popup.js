import { getSettings, whoAmI } from "./common.js";

const $ = (id) => document.getElementById(id);

$("openOptions").addEventListener("click", () => chrome.runtime.openOptionsPage());

(async () => {
  const { apiUrl, profileName } = await getSettings();
  const status = $("status");

  if (!apiUrl) {
    status.textContent = "Not configured — open Settings.";
    status.className = "line err";
    return;
  }

  const user = await whoAmI(apiUrl);
  if (user) {
    status.textContent = `Signed in as ${user.email}`;
    status.className = "line ok";
    $("profile").textContent = profileName ? `Building for: ${profileName}` : "No profile selected — open Settings.";
  } else {
    status.textContent = "Not signed in — open Settings.";
    status.className = "line err";
  }
})();
