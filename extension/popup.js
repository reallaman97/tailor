import { getSettings, whoAmI } from "./common.js";

const $ = (id) => document.getElementById(id);

$("openOptions").addEventListener("click", () => chrome.runtime.openOptionsPage());

// Opening the popup means the user has seen the result — clear the toolbar badge.
chrome.action.setBadgeText({ text: "" }).catch(() => {});
chrome.runtime.sendMessage({ type: "popup-opened" }).catch(() => {});

// ---------------------------------------------------------------------------
// Account status
// ---------------------------------------------------------------------------

(async () => {
  const { apiUrl, profileName } = await getSettings();
  const status = $("status");

  if (!apiUrl) {
    status.textContent = "Not configured — open Settings.";
    status.className = "row err";
    return;
  }

  const user = await whoAmI(apiUrl);
  if (user) {
    status.innerHTML = `<span class="who">${escapeHtml(user.email)}</span>`;
    status.className = "row ok";
    $("profile").textContent = profileName ? `Building for: ${profileName}` : "No profile selected — open Settings.";
  } else {
    status.textContent = "Not signed in — open Settings.";
    status.className = "row err";
  }
})();

// ---------------------------------------------------------------------------
// Live job status
// ---------------------------------------------------------------------------

let elapsedTimer = null;

function fmtElapsed(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function renderJob(job) {
  const card = $("jobCard");
  if (!job) {
    card.classList.remove("show");
    return;
  }
  card.classList.add("show");

  $("jobStage").textContent = job.stage || "";
  $("jobStage").className = "stage " + (job.status === "error" ? "err" : job.status === "duplicate" ? "warn" : job.status === "done" ? "ok" : "");

  // Progress bar
  const bar = $("jobBar");
  const fill = $("jobBarFill");
  bar.className = "bar" + (job.status === "done" ? " done" : job.status === "error" ? " err" : job.status === "duplicate" ? " warn" : "");
  if (job.status === "running" && (job.progress ?? 0) < 6) {
    bar.classList.add("indeterminate");
    fill.style.width = "35%";
  } else {
    fill.style.width = `${Math.max(0, Math.min(100, job.progress ?? 0))}%`;
  }

  // Elapsed
  const running = job.status === "running";
  const elapsed = running ? Date.now() - job.startedAt : job.elapsedMs ?? 0;
  $("jobElapsed").textContent = fmtElapsed(elapsed) + (running ? "" : " · done");

  // Detail line + link
  const detail = $("jobDetail");
  const link = $("jobLink");
  link.style.display = "none";
  const setLink = (text, url) => {
    if (!url) return;
    link.style.display = "inline-block";
    link.textContent = text;
    link.href = url;
  };
  const isComplete = job.kind === "complete";

  if (job.status === "running") {
    if (isComplete) {
      detail.innerHTML = job.pageTitle ? escapeHtml(job.pageTitle) : "Uploading proof of application…";
    } else {
      const target = [job.profileName && `<strong>${escapeHtml(job.profileName)}</strong>`, job.pageTitle && escapeHtml(job.pageTitle)]
        .filter(Boolean)
        .join(" — ");
      detail.innerHTML = target || "Working…";
    }
  } else if (job.status === "done") {
    if (isComplete) {
      detail.innerHTML =
        `Proof uploaded — <strong>${escapeHtml(job.jobTitle || "application")}</strong>` +
        (job.company ? ` at ${escapeHtml(job.company)}` : "") +
        ` marked complete.`;
      setLink("View the application →", job.existingUrl);
    } else {
      detail.innerHTML =
        `Downloaded <strong>${escapeHtml(job.filename || "resume.pdf")}</strong>` +
        (job.company ? ` for ${escapeHtml(job.company)}` : "") +
        (job.proofSaved ? `<br>Application recorded with a screenshot.` : `<br>Application recorded.`);
    }
  } else if (job.status === "duplicate") {
    detail.innerHTML =
      `<strong>${escapeHtml(job.jobTitle || "This role")}</strong>` +
      (job.company ? ` at ${escapeHtml(job.company)}` : "") +
      ` was already generated for this profile.`;
    setLink("View the existing application →", job.existingUrl);
  } else {
    detail.innerHTML = `<span class="err">${escapeHtml(job.error || "Something went wrong.")}</span>`;
  }

  // Keep the elapsed counter live while running.
  if (running && !elapsedTimer) {
    elapsedTimer = setInterval(() => {
      $("jobElapsed").textContent = fmtElapsed(Date.now() - job.startedAt);
    }, 1000);
  }
  if (!running && elapsedTimer) {
    clearInterval(elapsedTimer);
    elapsedTimer = null;
  }
}

// Initial render from stored state, then live updates.
chrome.runtime.sendMessage({ type: "get-job" }).then(renderJob).catch(() => {
  chrome.storage.local.get({ activeJob: null }).then((r) => renderJob(r.activeJob));
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "job-update") renderJob(msg.job);
});
