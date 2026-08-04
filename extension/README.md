# Resume Generator — Chrome extension

A Chrome (MV3) extension for the Cute Job Platform: select a job description on
any web page, right-click **→ Generate resume**, and a tailored resume PDF is
built by the platform and **downloaded automatically, named after the candidate
profile**.

It reuses the platform's normal login session (Auth.js cookie), so signing in
here is the same account you use on the site.

## What it does

1. You select a job description on any page and right-click → **Generate resume**.
2. The extension sends the selection and the **page URL** to the platform's
   `POST /api/ext/generate`.
3. The server derives the company + job title and **records a tracked
   application** — like the web "Build resume": job description, company, title,
   role track, the **posting URL** (`jobLink`), source = Job Board, status =
   Applied. It then tailors the resume with AI in the profile's chosen PDF style
   and returns the PDF.
4. The extension downloads it as `<profile-name>-<company>.pdf`.

Extension-built resumes show up in the tracker with the same application data as
the website.

## Complete application (upload proof)

After you've actually finished applying on the job page, right-click →
**Complete application (upload proof)**. The extension:

1. Takes a **full-page screenshot** of the tab (it scrolls the page and stitches
   the frames; the status toast is hidden for each grab so it's never in the
   shot).
2. **Compresses it hard** — downscaled to **≤600px wide** and saved as a
   low-quality JPEG — so the upload stays small.
3. Uploads it to `POST /api/ext/complete`, which attaches it as the
   **proof-of-application screenshot** on the application generated from this
   page (matched by the id recorded at generate time, or by the page URL).

**If the page isn't linked to any application** (e.g. you applied somewhere the
extension didn't build a resume), it falls back to your **most recent
application that has no screenshot yet** — and shows a **confirmation popup**
naming that application before uploading. Confirm to attach the proof there, or
cancel to do nothing. If you have no unproofed applications at all, it stops
with a clear message.

Every step is shown in the on-page toast (finding → capturing % → uploading →
completed). When it's done the toast links straight to the application.

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
**Generate resume for `<profile>`**. Generation can take up to ~a minute; you
get live status the whole way:

- An **on-page status toast** (bottom-right of the page you're on) shows the
  live stage, a progress bar, and elapsed time — then the result right there:
  the downloaded file, an "already added" duplicate (with a link to the
  existing application), or the error. It appears the moment you click and
  auto-dismisses when done. (On pages that block extensions — `chrome://`, the
  Web Store, the PDF viewer — it falls back to the notification + popup.)
- A **progress notification** advances through the stages — _reading the job
  description → tailoring with AI → preparing your PDF_.
- The **toolbar icon shows a badge** (`…` working, `✓` done, `!` error).
- Click the toolbar icon to open the **popup**, which shows a detailed,
  live-updating status card: current stage, a progress bar, elapsed time, the
  profile being built, and the final result (downloaded file, an "already
  added" duplicate with a link to the existing application, or the error).

The PDF downloads automatically when it's ready.

**Duplicates are blocked.** If a resume for the same **profile** and the same
**company + job title** was already generated, nothing new is built — an
**"Already added"** notification appears instead; click it to open the existing
application. (This is the same rule the website enforces.)

## Permissions

- `contextMenus`, `downloads`, `notifications`, `storage` — the core flow.
- `host_permissions: <all_urls>` — so the background worker can call your
  configured API URL (unknown at build time) and reuse its session cookie. If
  you prefer, edit `manifest.json` to restrict this to your exact API host.

## Server API (in the main app)

- `GET  /api/ext/me` — is the reused session a valid Resume Platform login?
- `GET  /api/ext/profiles` — profiles this account may build for.
- `POST /api/ext/generate` — build + tailor + return the PDF.
- `POST /api/ext/complete` — attach a proof-of-application screenshot to the
  application built from a page.

All three authenticate with the shared Auth.js session cookie and enforce the
same scoping as the web app (bidders only build for their assigned profile).

## Notes

- No build step — plain MV3 JavaScript. Edit files and hit **Reload** on the
  extension card.
- The session cookie must reach the extension's requests; keep the API on HTTPS
  in production. If a browser blocks the cross-site cookie, sign in again from
  the options page.
