import { getSettings, apiBase } from "./common.js";

const MENU_ID = "cjp-generate-resume";
const COMPLETE_MENU_ID = "cjp-complete-application";
const PROGRESS_NOTIFICATION = "cjp-progress";
const JOB_KEY = "activeJob"; // last/current job, shared with the popup

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    chrome.contextMenus.create({
      id: COMPLETE_MENU_ID,
      title: "Complete application (upload proof)",
      contexts: ["page", "selection"],
    });
    refreshMenu();
  });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.profileName) refreshMenu();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_ID) generate((info.selectionText || "").trim(), tab);
  else if (info.menuItemId === COMPLETE_MENU_ID) completeApplication(tab);
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

// The tab that triggered the current generation — where the in-page toast lives.
let activeTabId = null;

/** Injects the on-page status toast into the triggering tab (once per generation). */
async function injectToast(tabId) {
  if (tabId == null) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["toast.js"] });
  } catch {
    // Restricted page (chrome://, the Web Store, PDF viewer, etc.) — can't inject;
    // fall back to the notification + popup only.
    activeTabId = null;
  }
}

async function setJob(job) {
  await chrome.storage.local.set({ [JOB_KEY]: job });
  // No receiver (popup closed) rejects — swallow it.
  chrome.runtime.sendMessage({ type: "job-update", job }).catch(() => {});
  // Push the same state to the in-page toast on the triggering tab.
  if (activeTabId != null) chrome.tabs.sendMessage(activeTabId, { type: "cjp-toast", job }).catch(() => {});
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
  const mime = blob.type || "application/octet-stream";
  return `data:${mime};base64,${btoa(binary)}`;
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

  // Proof-of-application screenshot is left blank for now (the server records
  // the application without one; the capture path can be re-enabled later).
  const screenshot = undefined;

  // Show the in-page toast on the triggering tab right away.
  activeTabId = tab?.id ?? null;
  await injectToast(activeTabId);

  const job = {
    kind: "generate",
    status: "running",
    stage: "Sending request…",
    progress: 4,
    profileName: profileName || "",
    pageTitle: tab?.title || "",
    pageUrl: tab?.url || "",
    company: "",
    jobTitle: "",
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
        screenshot: screenshot || undefined,
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
    const jobTitle = decodeHeader(res, "X-Job-Title");
    const resumeId = res.headers.get("X-Resume-Id") || "";
    const proofSaved = res.headers.get("X-Proof-Saved") === "1";
    const dataUrl = await blobToDataUrl(blob);
    await chrome.downloads.download({ url: dataUrl, filename, saveAs: false });

    // Remember which application this page produced, so "Complete application"
    // on this same page can attach the proof screenshot to it.
    if (job.pageUrl && resumeId) {
      const store = await chrome.storage.local.get({ appByUrl: {} });
      const map = store.appByUrl || {};
      map[job.pageUrl] = { resumeId, company, jobTitle, at: Date.now() };
      await chrome.storage.local.set({ appByUrl: map });
    }

    await finish(
      {
        status: "done",
        stage: "Resume ready",
        filename,
        company,
        profileName: derivedProfile || job.profileName,
        proofSaved,
      },
      () => notify("Resume ready", `Downloaded ${filename}${proofSaved ? " · application recorded with proof" : ""}`),
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

// ---------------------------------------------------------------------------
// Full-page screenshot: scroll the page one viewport at a time, grab each
// frame, and stitch them onto a downscaled (≤600px-wide) low-quality JPEG so
// the proof upload stays small. Returns a data: URL, or null if the page can't
// be captured.
// ---------------------------------------------------------------------------

async function captureFullPage(tab, onProgress) {
  const tabId = tab?.id;
  if (tabId == null) return null;
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ["capture.js"] });
  } catch {
    return null; // restricted page
  }

  const send = (m) => chrome.tabs.sendMessage(tabId, m);

  let metrics;
  try {
    metrics = await send({ type: "cjp-cap-metrics" });
  } catch {
    return null;
  }
  if (!metrics || !metrics.vh || !metrics.vw) return null;
  const { totalHeight, vh, vw, origScrollY } = metrics;

  const targetW = Math.max(1, Math.min(600, Math.round(vw)));
  const scale = targetW / vw;
  const MAX_SEGMENTS = 30; // guard against absurdly long pages
  const segCount = Math.min(MAX_SEGMENTS, Math.max(1, Math.ceil(totalHeight / vh)));
  const capturedHeight = Math.min(totalHeight, segCount * vh);
  const finalH = Math.max(1, Math.round(capturedHeight * scale));

  const canvas = new OffscreenCanvas(targetW, finalH);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, targetW, finalH);

  let lastGrab = 0;
  try {
    for (let i = 0; i < segCount; i++) {
      const prep = await send({ type: "cjp-cap-prep", y: i * vh });
      const scrollY = prep && typeof prep.scrollY === "number" ? prep.scrollY : i * vh;

      // captureVisibleTab is rate-limited (~2/sec) — keep a safe gap.
      const gap = Date.now() - lastGrab;
      if (gap < 600) await delay(600 - gap);

      let dataUrl;
      try {
        dataUrl =
          tab.windowId != null
            ? await chrome.tabs.captureVisibleTab(tab.windowId, { format: "jpeg", quality: 80 })
            : await chrome.tabs.captureVisibleTab({ format: "jpeg", quality: 80 });
      } finally {
        await send({ type: "cjp-cap-unprep" }).catch(() => {});
      }
      lastGrab = Date.now();

      const bmp = await createImageBitmap(await (await fetch(dataUrl)).blob());
      ctx.drawImage(bmp, 0, 0, bmp.width, bmp.height, 0, Math.round(scrollY * scale), targetW, Math.round(vh * scale));
      bmp.close();

      if (onProgress) onProgress((i + 1) / segCount);
      if (scrollY + vh >= totalHeight) break; // reached the bottom early
    }
  } finally {
    await send({ type: "cjp-cap-restore", y: origScrollY }).catch(() => {});
  }

  // Compress hard: ≤600px wide, low-quality JPEG.
  const out = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.5 });
  return blobToDataUrl(out); // data:image/jpeg;base64,...
}

// ---------------------------------------------------------------------------
// "Complete application" — capture the finished page and upload it as proof to
// the application generated from this page.
// ---------------------------------------------------------------------------

async function completeApplication(tab) {
  const { apiUrl, profileId, profileName } = await getSettings();

  if (!apiUrl) {
    notify("Set up required", "Open the extension options and set the API URL.");
    openOptions();
    return;
  }

  activeTabId = tab?.id ?? null;
  await injectToast(activeTabId);

  const job = {
    kind: "complete",
    status: "running",
    stage: "Capturing the page…",
    progress: 6,
    profileName: profileName || "",
    pageTitle: tab?.title || "",
    pageUrl: tab?.url || "",
    company: "",
    jobTitle: "",
    filename: "",
    error: "",
    existingUrl: "",
    startedAt: Date.now(),
    finishedAt: 0,
    elapsedMs: 0,
  };
  await setJob(job);
  setBadge("…", "#0f766e");

  const finish = async (patch, notifyFn, badge) => {
    Object.assign(job, { progress: 100, finishedAt: Date.now(), elapsedMs: Date.now() - job.startedAt }, patch);
    await setJob(job);
    if (badge) setBadge(badge.text, badge.color);
    if (notifyFn) notifyFn();
  };

  // 1) Full-page screenshot (compressed).
  const screenshot = await captureFullPage(tab, async (frac) => {
    job.progress = Math.min(70, Math.round(frac * 70));
    job.stage = `Capturing the page… ${Math.round(frac * 100)}%`;
    await setJob(job);
  });

  if (!screenshot) {
    await finish(
      { status: "error", stage: "Couldn't capture", error: "This page can't be captured (it may block extensions)." },
      () => notify("Couldn't capture page", "This page can't be captured."),
      { text: "!", color: "#b91c1c" }
    );
    return;
  }

  // 2) Upload it as proof to the application built from this page.
  job.stage = "Uploading proof…";
  job.progress = 85;
  await setJob(job);

  const store = await chrome.storage.local.get({ appByUrl: {} });
  const rec = (store.appByUrl || {})[tab?.url || ""];

  try {
    const res = await fetch(apiBase(apiUrl) + "/api/ext/complete", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId: profileId || undefined,
        resumeId: rec?.resumeId || undefined,
        pageUrl: tab?.url,
        screenshot,
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
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      const message = detail.error || `Error ${res.status}`;
      await finish(
        { status: "error", stage: "Couldn't complete", error: message },
        () => notify("Couldn't complete application", message),
        { text: "!", color: "#b91c1c" }
      );
      return;
    }

    const detail = await res.json().catch(() => ({}));
    const company = detail.companyName || rec?.company || "";
    const jobTitle = detail.jobTitle || rec?.jobTitle || "";
    const existingUrl = detail.resumeId ? apiBase(apiUrl) + "/resumes/" + detail.resumeId : "";
    await finish(
      { status: "done", stage: "Application completed", company, jobTitle, existingUrl },
      () =>
        notifyWithLink(
          "Application completed",
          `Proof uploaded${company ? " for " + company : ""}.` + (existingUrl ? " Click to view it." : ""),
          existingUrl
        ),
      { text: "✓", color: "#15803d" }
    );
  } catch (err) {
    await finish(
      { status: "error", stage: "Upload failed", error: String(err?.message || err) },
      () => notify("Upload failed", String(err?.message || err)),
      { text: "!", color: "#b91c1c" }
    );
  }
}
