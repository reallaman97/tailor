// Injected on demand to drive a full-page screenshot: the background worker
// scrolls the page one viewport at a time (via these messages), grabs each
// visible frame with chrome.tabs.captureVisibleTab, and stitches + downscales
// them. The in-page status toast is hidden for the instant of each grab so it
// never ends up in the screenshot. Guarded against duplicate injection.
(() => {
  if (window.__cjpCapture) return;
  window.__cjpCapture = true;

  const TOAST_HOST_ID = "__cjp_resume_toast__";

  function toast(hide) {
    const t = document.getElementById(TOAST_HOST_ID);
    if (t) t.style.visibility = hide ? "hidden" : "";
  }

  function metrics() {
    const de = document.documentElement;
    const b = document.body;
    const totalHeight = Math.max(
      de.scrollHeight,
      b ? b.scrollHeight : 0,
      de.offsetHeight,
      b ? b.offsetHeight : 0,
      de.clientHeight
    );
    return {
      totalHeight,
      vh: window.innerHeight,
      vw: window.innerWidth,
      dpr: window.devicePixelRatio || 1,
      origScrollY: window.scrollY,
    };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || typeof msg.type !== "string" || !msg.type.startsWith("cjp-cap-")) return;

    if (msg.type === "cjp-cap-metrics") {
      sendResponse(metrics());
      return; // sync
    }

    if (msg.type === "cjp-cap-prep") {
      // Scroll to the segment, let it settle + lazy-load, then hide the toast
      // right before the background grabs this frame.
      window.scrollTo(0, msg.y);
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          setTimeout(() => {
            toast(true);
            sendResponse({ scrollY: window.scrollY });
          }, 220)
        )
      );
      return true; // async response
    }

    if (msg.type === "cjp-cap-unprep") {
      toast(false); // grab done — show the toast again
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === "cjp-cap-restore") {
      toast(false);
      window.scrollTo(0, msg.y || 0);
      sendResponse({ ok: true });
      return;
    }
  });
})();
