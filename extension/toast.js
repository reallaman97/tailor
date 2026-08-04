// Injected on demand into the active tab (chrome.scripting.executeScript) so the
// user sees live generation status right on the page where they triggered it.
// The background worker pushes { type: "cjp-toast", job } messages as the job
// advances. Guarded so repeated injection into the same frame is a no-op.
(() => {
  const HOST_ID = "__cjp_resume_toast__";
  if (window.__cjpToast) {
    window.__cjpToast.ping();
    return;
  }

  let job = null;
  let host = null;
  let shadow = null;
  let dismissTimer = null;
  let elapsedTimer = null;

  const TEMPLATE = `
    <style>
      .card { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        background: #ffffff; color: #0f172a; border: 1px solid rgba(0,0,0,.08);
        border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.2); padding: 12px 14px;
        animation: cjp-in .18s ease-out; }
      @media (prefers-color-scheme: dark) {
        .card { background: #1e293b; color: #e2e8f0; border-color: rgba(255,255,255,.12); }
      }
      @keyframes cjp-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
      .top { display: flex; align-items: center; gap: 8px; }
      .logo { width: 8px; height: 8px; border-radius: 50%; background: #0f766e; flex: 0 0 auto; }
      .stage { font-weight: 600; font-size: 13px; flex: 1 1 auto; }
      .elapsed { font-size: 11px; opacity: .6; font-variant-numeric: tabular-nums; }
      .x { cursor: pointer; border: 0; background: transparent; color: inherit; opacity: .5;
        font-size: 16px; line-height: 1; padding: 2px 4px; }
      .x:hover { opacity: 1; }
      .bar { height: 7px; border-radius: 999px; background: rgba(120,120,120,.22);
        overflow: hidden; margin: 9px 0 8px; }
      .bar > i { display: block; height: 100%; border-radius: 999px; background: #0f766e;
        width: 0%; transition: width .35s ease; }
      .bar > i.indet { width: 35%; animation: cjp-slide 1.1s ease-in-out infinite; }
      @keyframes cjp-slide { 0% { margin-left: -35%; } 100% { margin-left: 100%; } }
      .detail { font-size: 12px; opacity: .9; word-break: break-word; line-height: 1.4; }
      .detail b { font-weight: 600; }
      a.link { display: inline-block; margin-top: 7px; font-size: 12px; font-weight: 600;
        color: #0f766e; text-decoration: none; }
      a.link:hover { text-decoration: underline; }
    </style>
    <div class="card">
      <div class="top">
        <span class="logo"></span>
        <span class="stage" id="stage"></span>
        <span class="elapsed" id="elapsed"></span>
        <button class="x" id="close" title="Dismiss" aria-label="Dismiss">&times;</button>
      </div>
      <div class="bar"><i id="barfill"></i></div>
      <div class="detail" id="detail"></div>
      <a class="link" id="link" target="_blank" rel="noopener"></a>
    </div>`;

  function ensure() {
    if (host && host.isConnected) return;
    host = document.createElement("div");
    host.id = HOST_ID;
    host.style.cssText =
      "position:fixed;z-index:2147483647;bottom:20px;right:20px;width:320px;max-width:calc(100vw - 40px);";
    shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = TEMPLATE;
    (document.body || document.documentElement).appendChild(host);
    shadow.getElementById("close").addEventListener("click", remove);
  }

  function remove() {
    clearTimeout(dismissTimer);
    clearInterval(elapsedTimer);
    elapsedTimer = null;
    if (host) host.remove();
    host = null;
  }

  function fmtElapsed(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function accentFor(status) {
    return status === "done" ? "#15803d" : status === "error" ? "#b91c1c" : status === "duplicate" ? "#b45309" : "#0f766e";
  }

  function render() {
    if (!job) return;
    ensure();
    const q = (id) => shadow.getElementById(id);
    const accent = accentFor(job.status);
    const running = job.status === "running";

    q("stage").textContent = job.stage || "";
    q("stage").style.color = accent;

    const elapsed = running ? Date.now() - job.startedAt : job.elapsedMs || 0;
    q("elapsed").textContent = fmtElapsed(elapsed);

    const fill = q("barfill");
    fill.style.background = accent;
    if (running && (job.progress || 0) < 6) {
      fill.classList.add("indet");
      fill.style.width = "35%";
    } else {
      fill.classList.remove("indet");
      fill.style.width = `${Math.max(0, Math.min(100, job.progress || 0))}%`;
    }

    const detail = q("detail");
    const link = q("link");
    link.style.display = "none";

    if (running) {
      detail.innerHTML = job.profileName ? `Building for <b>${esc(job.profileName)}</b>…` : "Working…";
    } else if (job.status === "done") {
      detail.innerHTML = `Downloaded <b>${esc(job.filename || "resume.pdf")}</b>` + (job.company ? ` for ${esc(job.company)}` : "");
    } else if (job.status === "duplicate") {
      detail.innerHTML =
        `<b>${esc(job.jobTitle || "This role")}</b>` +
        (job.company ? ` at ${esc(job.company)}` : "") +
        ` was already generated for this profile.`;
      if (job.existingUrl) {
        link.style.display = "inline-block";
        link.textContent = "View the existing application →";
        link.href = job.existingUrl;
      }
    } else {
      detail.innerHTML = `<span style="color:#ef4444">${esc(job.error || "Something went wrong.")}</span>`;
    }

    // Auto-dismiss finished states; keep errors/duplicates around longer.
    clearTimeout(dismissTimer);
    if (!running) dismissTimer = setTimeout(remove, job.status === "done" ? 6000 : 12000);

    // Keep the elapsed counter live while running.
    if (running && !elapsedTimer) {
      elapsedTimer = setInterval(() => {
        if (job && job.status === "running" && shadow) {
          shadow.getElementById("elapsed").textContent = fmtElapsed(Date.now() - job.startedAt);
        }
      }, 1000);
    } else if (!running && elapsedTimer) {
      clearInterval(elapsedTimer);
      elapsedTimer = null;
    }
  }

  window.__cjpToast = {
    update(next) {
      job = next;
      render();
    },
    ping() {
      if (job) render();
    },
    remove,
  };

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "cjp-toast") window.__cjpToast.update(msg.job);
  });
})();
