# Resume Generator — Chrome extension

A Chrome (MV3) extension for the Cute Job Platform: select a job description on
any web page, right-click **→ Generate resume**, and a tailored resume PDF is
built by the platform and **downloaded automatically, named after the candidate
profile**.

It reuses the platform's normal login session (Auth.js cookie), so signing in
here is the same account you use on the site.

## What it does

1. You select a job description on any page and right-click → **Generate resume**.
2. The extension sends the selection (plus the page title/URL) to the platform's
   `POST /api/ext/generate`.
3. The server derives the company + job title, creates a tracked application
   (exactly like the web "Build resume"), tailors the resume with AI in the
   profile's chosen PDF style, and returns the PDF.
4. The extension downloads it as `<profile-name>-<company>.pdf`.

## Install (load unpacked)

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select this `extension/` folder.
4. Click the extension's **Details → Extension options** (or the toolbar icon →
   Settings) and:
   - **API URL** — defaults to `https://cutejobplatform.space`. Change it only
     for another deployment (e.g. `http://localhost:3000` for local dev), then
     click **Save URL**.
   - **Sign in** — email + password of a Resume Platform account (bidder or
     superadmin). This stores the same session cookie the website uses.
   - **Profile** — pick the candidate profile to build for (bidders have one;
     superadmins can pick any). Click **Save profile**.

## Use

On any job posting, highlight the full job description, right-click, and choose
**Generate resume for `<profile>`**. A notification shows progress; the PDF
downloads when it's ready (generation can take up to ~a minute).

## Permissions

- `contextMenus`, `downloads`, `notifications`, `storage` — the core flow.
- `host_permissions: <all_urls>` — so the background worker can call your
  configured API URL (unknown at build time) and reuse its session cookie. If
  you prefer, edit `manifest.json` to restrict this to your exact API host.

## Server API (in the main app)

- `GET  /api/ext/me` — is the reused session a valid Resume Platform login?
- `GET  /api/ext/profiles` — profiles this account may build for.
- `POST /api/ext/generate` — build + tailor + return the PDF.

All three authenticate with the shared Auth.js session cookie and enforce the
same scoping as the web app (bidders only build for their assigned profile).

## Notes

- No build step — plain MV3 JavaScript. Edit files and hit **Reload** on the
  extension card.
- The session cookie must reach the extension's requests; keep the API on HTTPS
  in production. If a browser blocks the cross-site cookie, sign in again from
  the options page.
