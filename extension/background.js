import { getSettings, apiBase } from "./common.js";

const MENU_ID = "cjp-generate-resume";
const PROGRESS_NOTIFICATION = "cjp-progress";
const JOB_KEY = "activeJob"; // last/current generation, shared with the popup

// ---------------------------------------------------------------------------
// Context menu
// ---------------------------------------------------------------------------

function menuTitle(profileName) {
  return profileName ? `Generate resume for ${profileName}` : "Generate resume";
}

async function refreshMenu() {
  const { profileName } = await getSettings();
  chrome.contextMenus.update(MENU_ID, { title: menuTitle(profileName) }).catch(() => {});
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU_ID, title: menuTitle(""), contexts: ["selection"] });
    refreshMenu();
  });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.profileName) refreshMenu();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  generate((info.selectionText || "").trim(), tab);
});

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

function notify(title, message) {
  chrome.notifications.create({ type: "basic", iconUrl: "icons/icon128.png", title, message: message || "" });
}

// Notifications that open a URL when clicked (e.g. the existing application).
const notificationLinks = new Map();

function notifyWithLink(title, message, url) {
  chrome.notifications.create(
    { type: "basic", iconUrl: "icons/icon128.png", title, message: message || "" },
    (id) => {
      if (url) notificationLinks.set(id, url);
    }
  );
}

chrome.notifications.onClicked.addListener((id) => {
  const url = notificationLinks.get(id);
  if (url) {
    chrome.tabs.create({ url });
    notificationLinks.delete(id);
  }
  chrome.notifications.clear(id);
});

function updateProgressNotification(job) {
  chrome.notifications.create(PROGRESS_NOTIFICATION, {
    type: "progress",
    iconUrl: "icons/icon128.png",
    title: "Generating resume",
    message: job.profileName ? `${job.stage} · ${job.profileName}` : job.stage,
    progress: Math.max(0, Math.min(100, Math.round(job.progress))),
  });
}

// ---------------------------------------------------------------------------
// Toolbar badge — draws the user to open the popup for detail
// ---------------------------------------------------------------------------

function setBadge(text, color) {
  chrome.action.setBadgeText({ text });
  if (color) chrome.action.setBadgeBackgroundColor({ color });
}

// The popup clears the badge when opened (it has seen the result).
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "popup-opened") setBadge("", null);
  if (msg?.type === "get-job") {
    chrome.storage.local.get({ [JOB_KEY]: null }).then((r) => sendResponse(r[JOB_KEY]));
    return true; // async response
  }
});

// ---------------------------------------------------------------------------
// Shared job state (persisted + broadcast to any open popup)
// ---------------------------------------------------------------------------

async function setJob(job) {
  await chrome.storage.local.set({ [JOB_KEY]: job });
  // No receiver (popup closed) rejects — swallow it.
  chrome.runtime.sendMessage({ type: "job-update", job }).catch(() => {});
}

const STAGE_FOR_PCT = [
  [8, "Sending request…"],
  [25, "Reading the job description…"],
  [80, "Tailoring your resume with AI…"],
  [100, "Preparing your PDF…"],
];

function stageForPct(pct) {
  for (const [ceiling, label] of STAGE_FOR_PCT) if (pct < ceiling) return label;
  return "Preparing your PDF…";
}

let progressTimer = null;

function startTicker(job) {
  stopTicker();
  progressTimer = setInterval(async () => {
    const elapsed = Date.now() - job.startedAt;
    // Ease toward 90% (the server does the real work in one request, so this is
    // an honest estimate of the wait — it snaps to 100% the moment it returns).
    const pct = Math.min(90, Math.round(90 * (1 - Math.exp(-elapsed / 18000))));
    job.progress = Math.max(job.progress, pct);
    job.stage = stageForPct(job.progress);
    job.elapsedMs = elapsed;
    await setJob(job);
    updateProgressNotification(job);
  }, 900);
}

function stopTicker() {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
}

function openOptions() {
  chrome.runtime.openOptionsPage();
}

// ---------------------------------------------------------------------------
// Download helpers (MV3 service workers have no URL.createObjectURL)
// ---------------------------------------------------------------------------

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

function decodeHeader(res, name) {
  const raw = res.headers.get(name);
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

// ---------------------------------------------------------------------------
// The generation flow
// ---------------------------------------------------------------------------

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

  const job = {
    status: "running",
    stage: "Sending request…",
    progress: 4,
    profileName: profileName || "",
    pageTitle: tab?.title || "",
    pageUrl: tab?.url || "",
    company: "",
    filename: "",
    error: "",
    existingUrl: "",
    startedAt: Date.now(),
    finishedAt: 0,
    elapsedMs: 0,
  };
  await setJob(job);
  setBadge("…", "#0f766e");
  updateProgressNotification(job);
  startTicker(job);

  const finish = async (patch, notifyFn, badge) => {
    stopTicker();
    chrome.notifications.clear(PROGRESS_NOTIFICATION);
    Object.assign(job, { progress: 100, finishedAt: Date.now(), elapsedMs: Date.now() - job.startedAt }, patch);
    await setJob(job);
    if (badge) setBadge(badge.text, badge.color);
    if (notifyFn) notifyFn();
  };

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
      await finish(
        { status: "error", stage: "Not signed in", error: "Sign in to the Resume Platform from the extension options." },
        () => notify("Please sign in", "Open the extension options to log in to the Resume Platform."),
        { text: "!", color: "#b91c1c" }
      );
      openOptions();
      return;
    }

    if (res.status === 409) {
      const detail = await res.json().catch(() => ({}));
      const existingUrl = detail.existing?.id ? apiBase(apiUrl) + "/resumes/" + detail.existing.id : "";
      await finish(
        {
          status: "duplicate",
          stage: "Already added",
          company: detail.existing?.companyName || "",
          jobTitle: detail.existing?.jobTitle || "",
          error: detail.error || "A resume for this job was already generated for this profile.",
          existingUrl,
        },
        () =>
          notifyWithLink(
            "Already added",
            (detail.error || "A resume for this job was already generated for this profile.") +
              (existingUrl ? " Click to view it." : ""),
            existingUrl
          ),
        { text: "•", color: "#b45309" }
      );
      return;
    }

    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      const message = detail.error || `Error ${res.status}`;
      await finish(
        { status: "error", stage: "Couldn't generate", error: message },
        () => notify("Couldn't generate resume", message),
        { text: "!", color: "#b91c1c" }
      );
      return;
    }

    // Success — pull the derived company/profile straight off the response.
    job.stage = "Downloading…";
    job.progress = 96;
    await setJob(job);

    const blob = await res.blob();
    const filename = filenameFromResponse(res, `${profileName || "resume"}.pdf`);
    const company = decodeHeader(res, "X-Company");
    const derivedProfile = decodeHeader(res, "X-Profile-Name");
    const dataUrl = await blobToDataUrl(blob);
    await chrome.downloads.download({ url: dataUrl, filename, saveAs: false });

    await finish(
      {
        status: "done",
        stage: "Resume ready",
        filename,
        company,
        profileName: derivedProfile || job.profileName,
      },
      () => notify("Resume ready", `Downloaded ${filename}`),
      { text: "✓", color: "#15803d" }
    );
  } catch (err) {
    await finish(
      { status: "error", stage: "Generation failed", error: String(err?.message || err) },
      () => notify("Generation failed", String(err?.message || err)),
      { text: "!", color: "#b91c1c" }
    );
  }
}
