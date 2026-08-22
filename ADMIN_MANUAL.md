# Lost Limb Riders — Admin User Manual

Complete reference for managing the website: events, live streaming (OBS → Facebook/YouTube/Twitch/Owncast), newsletter, community moderation, guestbook, and visitor data.

**Stack:** static HTML/CSS/JS frontend · Vercel serverless functions (Node) · Vercel KV (Redis) storage · Resend email · deployed at `lostlimbriders.org`. There are no PHP endpoints and no `data/*.json` files anymore — all data lives in KV under `llr:*` keys.

---

## Table of Contents

1. [Site Overview](#site-overview)
2. [Accessing Admin](#accessing-admin)
3. [Admin Dashboard Tour](#admin-dashboard-tour)
4. [Live Streaming & Going Live with OBS](#live-streaming--going-live-with-obs)
5. [Scheduled Broadcasts](#scheduled-broadcasts)
6. [Stream Archive](#stream-archive)
7. [Events Calendar](#events-calendar)
8. [Newsletter System](#newsletter-system)
9. [Community Moderation (Gallery / Testimonials / Comments)](#community-moderation)
10. [Guestbook](#guestbook)
11. [API Reference](#api-reference)
12. [Storage (Vercel KV)](#storage-vercel-kv)
13. [Environment Variables](#environment-variables)
14. [Cron](#cron)
15. [Troubleshooting](#troubleshooting)
16. [Quick Reference Card](#quick-reference-card)

---

## Site Overview

### Pages

| File | Path | Purpose |
|------|------|---------|
| `index.html` | `/` | Hero, book, newsletter signup (free e-book), guestbook, contact |
| `events.html` | `/events.html` | Public calendar — month/week views, category filters (read-only for visitors) |
| `media.html` | `/media.html` | Podcast player, vlogs, Coffee Talk, **live stream player + schedule**, broadcast-alert signup |
| `mission.html` | `/mission.html` | Mission, board, programs, donate |
| `community.html` | `/community.html` | Community hub — photo gallery, testimonials, comments (visitor submissions are moderated) |
| `sponsors.html` | `/sponsors.html` | Sponsor wall (Title/Major/Supporting tiers) |
| `admin.html` | `/admin.html` | **Single admin dashboard** — everything is managed here |

There is no hidden admin mode anywhere (the old press-A toggle is gone). Events and all other content are managed from `admin.html`.

### API Endpoints (all extensionless, JSON)

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `/api/events` | mixed | Calendar list (public, auto-seeds), add/update/delete (admin) |
| `/api/newsletter` | No | Signup — captures profile + geolocation, sends welcome email with e-book link |
| `/api/visit` | No | Visitor logging on every page load |
| `/api/guestbook` | mixed | list/add (public), download/clear (admin) |
| `/api/contact` | No | Contact form (sends via Resend) |
| `/api/media` | mixed | Podcast/vlog/coffeetalk episodes; `action=podcast-rss` serves the RSS feed |
| `/api/stream` | mixed | Stream status/config, schedule CRUD, archive, broadcast-alert signup |
| `/api/ebook` | Token | One-time e-book download links (`?token=...`) |
| `/api/unsubscribe` | Token | Newsletter unsubscribe links |
| `/api/community` | mixed | Gallery/testimonials/comments list+submit (public), pending/approve/delete (admin) |
| `/api/admin` | Yes | Stats, subscribers, visitors, newsletter preview + blast, stream config, stream keys, archive, audit |
| `/api/cron-newsletter` | Cron | Automated weekly sender (gated by `CRON_SECRET`) |

Admin auth everywhere: `?key=YOUR_ADMIN_KEY` query param or `X-Admin-Key` header, timing-safe compared against the `ADMIN_KEY` env var.

---

## Accessing Admin

1. Open `admin.html`
2. Enter your admin key in the login overlay
3. The key is kept in `sessionStorage` (`llr-admin-key`) — you stay logged in until the browser tab closes
4. Re-enter the key each new session

If login fails with "Invalid admin key," the `ADMIN_KEY` env var on Vercel is the source of truth — see [Environment Variables](#environment-variables).

---

## Admin Dashboard Tour

**Top cards:** Total Visits · Today · Subscribers (+ signed e-book status dot).

**Charts:** Top Countries (top 10) · Browser breakdown (Chrome/Firefox/Safari/Edge/Other).

**Tabs:**

| Tab | What it does |
|-----|--------------|
| Subscribers | Full marketing profiles: name, email, geo, ISP, device, proxy/hosting badges, welcome-email status |
| Visitor Log | Paginated (25/page) raw visit log with browser parsing |
| Send Newsletter | Build preview, **send real blast**, resend welcome emails (see [Newsletter](#newsletter-system)) |
| Live Stream | Platform selection, stream keys, OBS setup, schedule, go-live controls, archive — see next section |
| Events | Create/edit/delete calendar events (same data as the public calendar) |
| Gallery / Testimonials / Comments | Moderate visitor submissions — approve/unapprove/delete |
| Guestbook | Read entries, download JSON backup, clear |

---

## Live Streaming & Going Live with OBS

This is the full workflow: configure a platform once, then go live from OBS Studio each week.

### 1. How platform availability works

The **Platform** dropdown always shows all four supported platforms:

- **YouTube Live**
- **Facebook Live**
- **Twitch**
- **Owncast**

A platform is *available* when its stream key exists. Platforms without a key appear **greyed out and italic** with "— no stream key" — but they are still selectable so you can add their key right there. You never need to redeploy just to add a key.

Where keys come from (in priority order):

1. **Saved from this panel** — stored server-side in KV (`llr:stream-keys`); overrides the env var until removed
2. **Environment variables** — `FB_STREAM_KEY`, `YOUTUBE_STREAM_KEY`, `TWITCH_STREAM_KEY`, `OWNCAST_STREAM_KEY`

Stream keys are secrets: they are validated server-side, never displayed again, never returned by any API, and never logged. Minimum length is 20 chars for Facebook/YouTube, 10 for Twitch/Owncast, no spaces.

### 2. Adding or updating a stream key

1. Live Stream tab → select the platform in the dropdown (greyed ones work too)
2. The **platform panel** opens showing its status:
   - `✓ Ready — stream key loaded from environment (FB_STREAM_KEY)`
   - `✓ Ready — stream key saved from this panel`
   - `✗ Not configured — add the stream key below or set <ENV_VAR>`
3. Paste the key into the **Stream Key** field (password-masked)
4. Click **Save Key**
5. The panel reloads — the platform unlocks and the rest of the form becomes editable

While a platform has no key, the stream config form (Status, Stream ID, Title, etc.) is **locked** — only the key field is active.

### 3. Configure the stream

Once the platform is ready, fill in:

| Field | Notes |
|-------|-------|
| Status | `Offline` / `Live` (manual control; the platform check can also set this) |
| Stream ID | Viewer-facing URL — **Facebook video/page URL** or **YouTube video ID**. Never paste a secret key here. |
| Title / Description | Shown on `media.html` |
| Viewer Count | Optional display number |
| Keep Last N Recordings | Archive retention (default 20, max 500) |

Click **Save**.

### 4. OBS setup (per platform)

When a platform is selected, the **OBS Studio Setup** panel below shows *only that platform's* settings:

| Platform | OBS Service | Server URL |
|----------|-------------|------------|
| Facebook Live | Facebook Live | `rtmps://live-api-s.facebook.com:443/rtmp/` |
| YouTube Live | YouTube - RTMPS | `rtmps://a.rtmp.youtube.com/live2` |
| Twitch | Twitch | `rtmps://live.twitch.tv/app` |
| Owncast | Custom… | your Owncast URL (`OWNCAST_URL`) |

In OBS Studio:

1. **Settings → Stream** → pick the Service / Server above
2. **Stream Key** = the same key you saved in step 2 (OBS needs it locally; the site never displays it — get it from the platform's dashboard, e.g. Facebook Live Producer)
3. Recommended output: 1080p @ ~4500–6000 Kbps, keyframe interval **2 s**

Optional — let the admin panel watch OBS itself: in OBS enable **Tools → WebSocket Server Settings** (port 4455). Then in the **OBS Studio Status** section of the admin panel enter `ws://localhost:4455` (+ password) and click **Connect**. This verifies OBS is running, shows the current scene, and confirms the media source for prerecorded broadcasts. The WebSocket password stays in your browser memory only.

### 5. Going live (weekly routine)

1. Get your stream key from the platform (Facebook: **Live Producer → Use stream key** — use the persistent key)
2. In OBS: confirm Service/Server/Key are set for the platform you chose in the admin panel → **Start Streaming**
3. Back in the admin panel: click **Check Live Status**
   - If platform status-check credentials are configured (see [Environment Variables](#environment-variables)), the site asks the platform directly and flips the public state automatically
   - Otherwise click **Go Live Now** to set Status = Live manually
4. `media.html` switches to the live embed automatically; riders who signed up for **broadcast alerts** get notified by email
5. When you stop streaming in OBS, run **Check Live Status** again (or set Status = Offline) — the broadcast is archived automatically

### 6. Ending a stream

When status goes live → offline, the stream is auto-archived (requires a Stream ID/viewer URL to be set). See [Stream Archive](#stream-archive).

---

## Scheduled Broadcasts

The **Scheduled Streams** list (inside the Live Stream tab) drives the "upcoming" display on `media.html`, the newsletter, and linked calendar events.

- **+ Add Scheduled Stream** — title, day/time or one-off date, recurring flag, realtime vs prerecorded mode, destination platform (only platforms with keys are offered), description, host/guest, thumbnail
- Prerecorded mode lets you declare a media file + duration and verify it plays
- Editing or deleting a scheduled stream keeps its linked calendar event in sync automatically

---

## Stream Archive

- Ended streams land in the archive automatically (newest first)
- Only the most recent **Keep Last N** recordings are publicly visible; older ones are hidden immediately
- Nothing is deleted silently: hidden recordings are purged permanently only after you click **Approve & Purge**

---

## Events Calendar

All management happens in `admin.html` → **Events** tab (the public page is read-only):

- **Create** — fill Title (required), Date (required), End Date (optional), Time, Category (Ride/Fundraiser/Community/Meeting/Rally/Livestream), Location, Description
- **Edit / Delete** — buttons on each event row
- Events auto-seed from `lib/seed.js` if the store is ever empty
- Scheduled livestreams create/update linked calendar events on their own

---

## Newsletter System

### Signup → Welcome

1. Visitor submits name + email on the homepage
2. Backend captures the full marketing profile (IP → ip-api.com geolocation, ISP, proxy/hosting flags, device/screen/timezone, referrer) and dedupes by email
3. They receive a **welcome email** (Resend) with a **one-time e-book download link** (`/api/ebook?token=…`)
4. If signed-copy hosting is configured, the email advertises the signed edition; otherwise it honestly offers the free digital copy

### Sending newsletters

Two ways, both real sends via Resend:

- **Manual blast** — Send Newsletter tab → optional intro message → Preview → **Send to All Subscribers** → confirm. Sends immediately to active subscribers (capped at 100 per run), records an audit entry, and updates the last-sent timestamp.
- **Automated cron** — runs Mondays 09:00 UTC but only actually sends every **≥ 13 days**, also capped at 100. Requires `CRON_SECRET`.

Every email includes a personalized **unsubscribe link** (`/api/unsubscribe`). Unsubscribed members stay in the list but receive nothing.

**Resend welcome email:** Subscribers tab → resend button re-issues the e-book token and resends the welcome message.

### Template

Built into `lib/seed.js` (`newsletterTemplate`) — placeholders `{{DATE_RANGE}}`, `{{EVENTS_LIST}}`, `{{MESSAGE}}`, `{{NAME}}`. Edit there and redeploy. Upcoming events + scheduled streams auto-populate.

---

## Community Moderation

`community.html` lets visitors submit photos, testimonials, and comments. Everything lands in a **pending queue**; nothing goes public until approved.

For each of Gallery / Testimonials / Comments (admin tabs of the same name):

- **Approve** — publishes the submission
- **Unapprove** — pulls it back from public view
- **Delete** — removes permanently
- Caps: 200 pending gallery items, 500 approved gallery, 500 testimonials, 2000 comments

---

## Guestbook

Server-side persisted in KV (cap 500) — entries survive across browsers and devices. Admin tab allows: reading all entries, downloading a JSON backup, clearing (with confirmation).

---

## API Reference

### `/api/admin` (all actions require admin auth)

| Action | Method | Purpose |
|--------|--------|---------|
| `stats` | GET | Dashboard stats |
| `visitors` | GET | Paginated visitor log (`page`, `limit`) |
| `subscribers` | GET | Full subscriber profiles |
| `send-newsletter` | POST | Build preview HTML (no send) |
| `blast-newsletter` | POST | Send real newsletter (cap 100) |
| `stream` | GET | Stream config + platform availability (keys never included) |
| `set-stream-key` | POST | Add/update a platform stream key (`{platform, streamKey}`) |
| `stream-check` | POST | Query the platform's live status |
| `archive` | GET | Admin archive view with pending-purge count |
| `purge-archive` | POST | Permanently delete expired recordings |
| `update-stream` | POST | Save stream metadata/schedule |
| `resend-welcome` | POST | Re-send welcome email to one subscriber |
| `audit` | GET | Audit trail (blasts, welcome resends, …) |

### `/api/stream`

| Action | Method | Auth | Purpose |
|--------|--------|------|---------|
| `get` | GET | No | Public stream state (sanitized) |
| `archive` | GET | No | Public archive (respects Keep N) |
| `check` | POST | Yes | Same as admin stream-check |
| `subscribe-alerts` | POST | No | Sign an email up for go-live alerts |
| `update` | POST | Yes | Update stream fields / status |
| `add-schedule` / `update-schedule` / `delete-schedule` | POST | Yes | Manage scheduled broadcasts (syncs calendar events) |

### Other endpoints

- `/api/events?action=list|validate|add|update|delete`
- `/api/media?action=list|podcast-rss` (public) · `add|update|delete` (admin)
- `/api/community?action=list|submit` (public) · `pending|approve|unapprove|delete` (admin)
- `/api/guestbook?action=list|add` (public) · `download|clear` (admin)
- `/api/newsletter` (POST signup) · `/api/contact` (POST) · `/api/visit` (POST)
- `/api/ebook?token=` · `/api/unsubscribe?token=`

Errors follow `{ "error": "..." }` with proper HTTP codes (403 admin, 422 validation, 404 unknown, 500 storage).

---

## Storage (Vercel KV)

JSON arrays under `llr:*` — access goes through `lib/storage.js` only.

| Key | Cap | Contents |
|-----|-----|----------|
| `llr:events` | — | Calendar events (auto-seeds) |
| `llr:media` | — | Episodes: podcast / vlog / coffeetalk (auto-seeds) |
| `llr:stream` | — | Single stream object + schedule (auto-seeds) |
| `llr:stream-archive` | 500 | Archived broadcasts |
| `llr:stream-keys` | 8 | Panel-saved platform stream keys (secrets, write-only from the UI) |
| `llr:broadcast-alerts` | 5000 | Go-live alert opt-ins |
| `llr:subscribers` | 5000 | Newsletter profiles |
| `llr:visitors` | 5000 | Visit log |
| `llr:guestbook` | 500 | Guestbook entries |
| `llr:last-newsletter-sent` | — | ISO timestamp (cron gate) |
| `llr:gallery-pending` / `llr:gallery-approved` | 200 / 500 | Community photos |
| `llr:testimonials` | 500 | Community testimonials |
| `llr:comments` | 2000 | Community comments |
| `llr:audit` | 5000 | Audit trail |

Re-seed tip: deleting `llr:events` / `llr:media` / `llr:stream` in the Vercel KV dashboard makes the next public read re-seed from `lib/seed.js`.

---

## Environment Variables

Full checklist with priorities lives in [`VERCEL_ENV_CHECKLIST.md`](VERCEL_ENV_CHECKLIST.md). Summary:

| Variable | Required | Purpose |
|----------|----------|---------|
| `ADMIN_KEY` | **Yes** | Admin login/API — source of truth for the admin key |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | **Yes** | Auto-created by `vercel link` |
| `CRON_SECRET` | **Yes** | Bearer auth for `/api/cron-newsletter` |
| `RESEND_API_KEY` / `RESEND_FROM` | **Yes** | All outgoing email (100/day free tier) |
| `FB_STREAM_KEY` | Optional | Facebook Live stream key (dropdown availability) |
| `YOUTUBE_STREAM_KEY` / `TWITCH_STREAM_KEY` / `OWNCAST_STREAM_KEY` | Optional | Same, other platforms |
| `FACEBOOK_ACCESS_TOKEN` + `FACEBOOK_PAGE_ID` | Optional | Automatic "is the page really live?" checks |
| `YOUTUBE_API_KEY` + `YOUTUBE_VIDEO_ID` | Optional | Same for YouTube |
| `TWITCH_CLIENT_ID` / `TWITCH_ACCESS_TOKEN` / `TWITCH_USER_LOGIN` | Optional | Same for Twitch |
| `OWNCAST_URL` | Optional | Owncast server for status checks |
| `NEWSLETTER_MESSAGE` | Optional | Default cron newsletter intro |
| `EBOOK_SIGNED` + `EBOOK_STORAGE_*` (or `EBOOK_DOWNLOAD_URL`) | Optional | Signed-copy e-book delivery |

Note: `.env.local` only applies to local `vercel dev`. Production reads env vars from the Vercel dashboard — set them there (Project → Settings → Environment Variables).

---

## Cron

Configured in `vercel.json`: `0 9 * * 1` — Mondays 09:00 UTC, hitting `/api/cron-newsletter`.

The function self-gates:

1. Refuses requests without `Authorization: Bearer $CRON_SECRET`
2. Skips if the last send was less than **13 days** ago (`too_soon`)
3. Caps at **100 sends per run**
4. Records failures and updates `llr:last-newsletter-sent`

No system crontab involved — Vercel runs it.

---

## Troubleshooting

| Symptom | Cause / Fix |
|---------|-------------|
| "Invalid admin key" / 403 | `ADMIN_KEY` on Vercel is the truth — check for typos/case; header `X-Admin-Key` also works |
| A platform is greyed out | No stream key yet — select it and use **Save Key** (or set its `*_STREAM_KEY` env var) |
| "Stream key is too short or contains invalid characters" | Keys: 20+ chars for Facebook/YouTube, 10+ for Twitch/Owncast, no spaces |
| Saved a key but behavior didn't change | Panel keys override env vars — make sure you saved for the correct platform, then reopen the tab |
| OBS Status says "Could not connect" | Start OBS, enable Tools → WebSocket Server Settings (port 4455), confirm URL `ws://localhost:4455` |
| Check Live Status says "manual status" | Optional platform status-check credentials aren't set — use Go Live Now instead |
| Stream went offline but isn't in the archive | Auto-archive needs a viewer URL in **Stream ID**; set one before going live |
| Newsletter blast stopped at 100 | Hard cap per run — run again for the next batch |
| Cron replies `too_soon` | Working as intended — sends at most every 13 days |
| Cron replies 401 | `CRON_SECRET` mismatch between Vercel env and what Vercel Cron sends |
| Podcast RSS 404 | Feed moved into `/api/media?action=podcast-rss` |
| Visitor/subscriber counts frozen | KV REST tokens expired — re-link with `vercel link` |

---

## Quick Reference Card

| Task | How |
|------|-----|
| Add/update a stream key | admin.html → Live Stream → select platform → paste key → **Save Key** |
| Configure OBS for Facebook | OBS Settings → Stream → Service: Facebook Live → `rtmps://live-api-s.facebook.com:443/rtmp/` → paste FB key |
| Go live | Start Streaming in OBS → admin panel → **Check Live Status** (or **Go Live Now**) |
| End a stream | Stop OBS stream → **Check Live Status** → auto-archives |
| Schedule a broadcast | Live Stream → + Add Scheduled Stream (auto-creates calendar event) |
| Add an event | admin.html → Events tab → create |
| Send a newsletter now | Send Newsletter → Preview → Send to All Subscribers → confirm |
| Approve community photos/testimonials/comments | Gallery/Testimonials/Comments tabs → Approve |
| Back up guestbook | Guestbook tab → Download |
| Change archive retention | Live Stream → Keep Last N Recordings → Save |
| Purge old recordings | Stream Archive → Approve & Purge |
| Watch OBS from the panel | Enable OBS WebSocket server (4455) → Connect |
