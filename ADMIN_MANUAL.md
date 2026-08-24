# Lost Limb Riders — Admin User Manual

Complete reference for managing the website: events, live streaming (Facebook Live), newsletter, community moderation, guestbook, and visitor data.

**Stack:** static HTML/CSS/JS frontend · Vercel serverless functions (Node) · Vercel KV (Redis) storage · Resend email · deployed at `lostlimbriders.org`. There are no PHP endpoints and no `data/*.json` files anymore — all data lives in KV under `llr:*` keys.

---

## Table of Contents

1. [Site Overview](#site-overview)
2. [Accessing Admin](#accessing-admin)
3. [Admin Dashboard Tour](#admin-dashboard-tour)
4. [Live Streaming — Facebook Live](#live-streaming--facebook-live)
5. [Scheduled Broadcasts](#scheduled-broadcasts)
6. [Events Calendar](#events-calendar)
7. [Sponsor Wall](#sponsor-wall)
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
| `sponsors.html` | `/sponsors.html` | Sponsor wall — fully populated from sponsor records managed in admin (no hard-coded sponsors) |
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
| `/api/stream` | mixed | Facebook Live status, config + schedule CRUD, broadcast-alert signup |
| `/api/ebook` | Token | One-time e-book download links (`?token=...`) |
| `/api/unsubscribe` | Token | Newsletter unsubscribe links |
| `/api/community` | mixed | Gallery/testimonials/comments list+submit (public), pending/approve/delete (admin); sponsor list (public) + sponsor CRUD/levels/reorder (admin) |
| `/api/admin` | Yes | Stats, subscribers, visitors, newsletter preview + blast, stream config, audit |
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
 | Live Stream | Facebook Live status, page URL, schedule, broadcast alerts — see next section |
| Events | Create/edit/delete calendar events (same data as the public calendar) |
| Sponsors | Full Sponsor Wall management: add/edit/delete, activate/deactivate, reorder, logos, recognition levels |
| Gallery / Testimonials / Comments | Moderate visitor submissions — approve/unapprove/delete |
| Guestbook | Read entries, download JSON backup, clear |

---

## Live Streaming — Facebook Live

Streaming is simple now: **Facebook Live is the only platform**, and the website is just the viewing layer.

### Going live (the whole workflow)

1. Open **Facebook on your phone**
2. Press **Go Live** on the Lost Limb Riders page
3. That's it. `media.html` detects the broadcast within ~60 seconds, shows a big **LIVE NOW** player, and riders who signed up for **broadcast alerts** get an email

No OBS, no stream keys, no RTMP, nothing to configure. When you end the broadcast, the site returns to its offline state (with a link to the replay on Facebook).

### One-time setup (already done? skip this)

Automatic detection needs two environment variables on Vercel: `FACEBOOK_PAGE_ID` and `FACEBOOK_ACCESS_TOKEN` (a Page access token). Facebook offers no public way to detect a live Page without them. Without them the site still works but always shows the offline view with a link to your Facebook page — the admin panel's Live Stream tab tells you when they're missing.

### Live Stream tab

| Field | Notes |
|-------|-------|
| Status card | Shows what Facebook reports right now + **Refresh Status** |
| Facebook Page URL | Used for the "Follow on Facebook" button in the offline view |
| Default Title / Description | Shown around the player |
| Scheduled Broadcasts | See below |

Click **Save** after editing.

---

## Scheduled Broadcasts

The **Scheduled Broadcasts** list (inside the Live Stream tab) drives the "upcoming" display on `media.html`, the newsletter, and linked calendar events.

- **+ Add Scheduled Broadcast** — title, day/time or one-off date, recurring flag, description, host/guest, thumbnail
- Editing or deleting a scheduled broadcast keeps its linked calendar event in sync automatically

---

## Events Calendar

All management happens in `admin.html` → **Events** tab (the public page is read-only):

- **Create** — fill Title (required), Date (required), End Date (optional), Time, Category (Ride/Fundraiser/Community/Meeting/Rally/Livestream), Location, Description
- **Edit / Delete** — buttons on each event row
- Events auto-seed from `lib/seed.js` if the store is ever empty
- Scheduled livestreams create/update linked calendar events on their own

---

## Sponsor Wall

All management happens in `admin.html` → **Sponsors** tab; the public `sponsors.html` page is read-only and rebuilds itself from the saved records on every visit. Nothing on the wall is hard-coded.

### Adding a sponsor

1. **Sponsors** tab → **+ Add Sponsor**
2. Fill in: Name (required), Recognition Level (required), Website URL, Contact Info, Description
3. Optionally upload a logo (PNG/JPG/WebP/GIF under 400KB — stored in Vercel Blob)
4. Set **Display Order** (lower number = shown earlier) and Status (Active/Inactive)
5. **Save Sponsor** — it appears on the public wall immediately

### Managing sponsors

Each row in the table shows order number (with ▲/▼ move buttons), logo preview, name/contact, level badge, status badge, website link, and actions:

- **Edit** — change any field, replace the logo (upload a new one or Remove Logo), rename, etc.
- **Activate / Deactivate** — hides a sponsor from the public wall *without* deleting the record (status shows Inactive; reactivate anytime)
- **Del** — permanently deletes the sponsor and its logo (asks to confirm)
- Moving a sponsor with ▲/▼ re-numbers display order automatically

### Recognition levels

The levels at the top of the Sponsors tab are configurable data (not code):

- The public wall renders one section per level, top-to-bottom by rank — Platinum first by default, then Gold, Silver, Bronze, Community Sponsor, Individual Supporter
- **+ Add Level** appends a new level to the bottom of the wall (e.g. "Presenting Partner")
- **✎** renames a level everywhere instantly (public wall included)
- **×** deletes a level — only allowed when no sponsors still use it
- Within a level section, sponsors sort by Display Order

Sponsor records persist in KV (`llr:sponsors`, cap 200) and survive refreshes and redeploys.

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
| `stream` | GET | Stream config + Facebook live-detection state (no secrets) |
| `update-stream` | POST | Save Facebook page URL / title / description |
| `resend-welcome` | POST | Re-send welcome email to one subscriber |
| `audit` | GET | Audit trail (blasts, welcome resends, …) |

### `/api/stream`

| Action | Method | Auth | Purpose |
|--------|--------|------|---------|
| `get` | GET | No | Public stream state (Facebook live/replay/offline) |
| `check` | POST | Yes | Force a fresh Facebook live-status check |
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
| `llr:fb-live-cache` | — | Cached Facebook live check (~60s TTL) |
| `llr:broadcast-alerts` | 5000 | Go-live alert opt-ins |
| `llr:subscribers` | 5000 | Newsletter profiles |
| `llr:visitors` | 5000 | Visit log |
| `llr:guestbook` | 500 | Guestbook entries |
| `llr:last-newsletter-sent` | — | ISO timestamp (cron gate) |
| `llr:gallery-pending` / `llr:gallery-approved` | 200 / 500 | Community photos |
| `llr:testimonials` | 500 | Community testimonials |
| `llr:comments` | 2000 | Community comments |
| `llr:sponsors` | 200 | Sponsor records (logos live in Vercel Blob under `sponsors/logos/`) |
| `llr:sponsor-levels` | 24 | Recognition levels (auto-seeds Platinum → Individual Supporter) |
| `llr:audit` | 5000 | Audit trail |

Re-seed tip: deleting `llr:events` / `llr:media` / `llr:stream` in the Vercel KV dashboard makes the next public read re-seed from `lib/seed.js`. Deleting `llr:sponsor-levels` restores the six default levels the same way.

---

## Environment Variables

Full checklist with priorities lives in [`VERCEL_ENV_CHECKLIST.md`](VERCEL_ENV_CHECKLIST.md). Summary:

| Variable | Required | Purpose |
|----------|----------|---------|
| `ADMIN_KEY` | **Yes** | Admin login/API — source of truth for the admin key |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | **Yes** | Auto-created by `vercel link` |
| `CRON_SECRET` | **Yes** | Bearer auth for `/api/cron-newsletter` |
| `RESEND_API_KEY` / `RESEND_FROM` | **Yes** | All outgoing email (100/day free tier) |
| `FACEBOOK_ACCESS_TOKEN` + `FACEBOOK_PAGE_ID` | Optional | Automatic "is the page live?" detection via Graph API |
| `FACEBOOK_PAGE_URL` | Optional | Fallback "Follow on Facebook" link when page ID isn't set |
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
| Site stays "offline" during a Facebook broadcast | Detection creds missing/wrong — set `FACEBOOK_ACCESS_TOKEN` + `FACEBOOK_PAGE_ID` on Vercel (page access token, numeric page ID) |
| Live state lags behind Facebook | Results cached ~60s in `llr:fb-live-cache` — admin **Check** forces a fresh check |
| Replay link missing after a stream | Facebook didn't expose the replay yet, or the previous live URL wasn't recorded — check the page directly |
| Newsletter blast stopped at 100 | Hard cap per run — run again for the next batch |
| Cron replies `too_soon` | Working as intended — sends at most every 13 days |
| Cron replies 401 | `CRON_SECRET` mismatch between Vercel env and what Vercel Cron sends |
| Podcast RSS 404 | Feed moved into `/api/media?action=podcast-rss` |
| Visitor/subscriber counts frozen | KV REST tokens expired — re-link with `vercel link` |

---

## Quick Reference Card

| Task | How |
|------|-----|
| Update page link/title | admin.html → Live Stream → edit → Save |
| Go live | Start a live broadcast on the Lost Limb Riders Facebook page (phone or Creator Studio) — site auto-detects within ~60s |
| End a stream | End the broadcast on Facebook — site returns to offline state with replay link |
| Force a live check | admin.html → Live Stream → **Check** |
| Schedule a broadcast | Live Stream → + Add Scheduled Stream (auto-creates calendar event) |
| Add an event | admin.html → Events tab → create |
| Add a sponsor | admin.html → Sponsors tab → + Add Sponsor → Save |
| Hide a sponsor without deleting | Sponsors tab → **Deactivate** on its row |
| Reorder the Sponsor Wall | Sponsors tab → ▲/▼ arrows, or set Display Order when editing |
| Send a newsletter now | Send Newsletter → Preview → Send to All Subscribers → confirm |
| Approve community photos/testimonials/comments | Gallery/Testimonials/Comments tabs → Approve |
| Back up guestbook | Guestbook tab → Download |
