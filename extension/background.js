import { getSettings, apiBase } from "./common.js";

const MENU_ID = "cjp-generate-resume";

function menuTitle(profileName) {
  return profileName ? `Generate resume for ${profileName}` : "Generate resume";
}

async function refreshMenu() {
  const { profileName } = await getSettings();
  chrome.contextMenus.update(MENU_ID, { title: menuTitle(profileName) }).catch(() => {});
}

chrome.runtime.onInstalled.addListener(async () => {
  chrome.contextMenus.removeAll(() => {
    const { profileName } = { profileName: "" };
    chrome.contextMenus.create({ id: MENU_ID, title: menuTitle(profileName), contexts: ["selection"] });
    refreshMenu();
  });
});

// Keep the menu label in sync with the chosen profile.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.profileName) refreshMenu();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  generate((info.selectionText || "").trim(), tab);
});

function notify(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon128.png",
    title,
    message: message || "",
  });
}

function openOptions() {
  chrome.runtime.openOptionsPage();
}

/** MV3 service workers have no URL.createObjectURL, so download via a data: URL. */
async function blobToDataUrl(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return `data:application/pdf;base64,${btoa(binary)}`;
}

function filenameFromResponse(res, fallback) {
  const cd = res.headers.get("Content-Disposition") || "";
  const match = /filename="([^"]+)"/.exec(cd);
  return match ? match[1] : fallback;
}

async function generate(jobDescription, tab) {
  const { apiUrl, profileId, profileName } = await getSettings();

  if (!apiUrl) {
    notify("Set up required", "Open the extension options and set the API URL.");
    openOptions();
    return;
  }
  if (!jobDescription || jobDescription.length < 20) {
    notify("Select a job description", "Highlight the full job description on the page, then right-click → Generate resume.");
    return;
  }

  notify("Generating resume…", "Tailoring with AI — this can take up to a minute.");

  try {
    const res = await fetch(apiBase(apiUrl) + "/api/ext/generate", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId: profileId || undefined,
        jobDescription,
        pageTitle: tab?.title,
        pageUrl: tab?.url,
      }),
    });

    if (res.status === 401) {
      notify("Please sign in", "Open the extension options to log in to the Resume Platform.");
      openOptions();
      return;
    }
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      notify("Couldn't generate resume", detail.error || `Error ${res.status}`);
      return;
    }

    const blob = await res.blob();
    const filename = filenameFromResponse(res, `${profileName || "resume"}.pdf`);
    const dataUrl = await blobToDataUrl(blob);
    await chrome.downloads.download({ url: dataUrl, filename, saveAs: false });
    notify("Resume ready", `Downloaded ${filename}`);
  } catch (err) {
    notify("Generation failed", String(err?.message || err));
  }
}
