# Lost Limb Riders — Admin User Manual

Complete reference for managing the website: events, live streaming (Facebook Live), newsletter, community moderation, guestbook, visitor data, the Document Library, and operational compliance.

**Stack:** static HTML/CSS/JS frontend · Vercel serverless functions (Node) · Vercel KV (Redis) storage · Resend email · deployed at `lostlimbriders.org`. There are no PHP endpoints or runtime `data/*.json` files. Operational data lives in KV under `llr:*` keys; the protected repository file `SOCIAL_MEDIA.json` supplies the initial social-media configuration.

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
17. [Compliance Engine](#compliance-engine)
18. [Social Media Configuration](#social-media-configuration)

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
| `documentation.html` | `/documentation.html` | Canonical document discovery, authentication, and reading |
| `compliance.html` | `/compliance.html` | Authenticated operational workflow enforcement |

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
| `/api/admin` | Yes | Stats, subscribers, visitors, newsletter preview + blast, stream config, social-media configuration, audit |
| `/api/cron-newsletter` | Cron | Automated weekly sender (gated by `CRON_SECRET`) |

Admin auth everywhere: `?key=YOUR_ADMIN_KEY` query param or `X-Admin-Key` header, timing-safe compared against the `ADMIN_KEY` env var.

Document Library and Compliance Engine requests use the signed bearer session issued by `docs-login`. Bearer secrets remain in `sessionStorage` and are never placed in URLs.

---

## Compliance Engine

The Compliance Engine is separate from the Document Library. The Library answers “what does the controlled document say?” The engine answers “what must I complete next, and what is blocking this transaction?”

1. Sign in at `documentation.html`.
2. Open `compliance.html`.
3. Use workflow search or choose one of the category landing cards. The engine does not render every workflow on the home screen.
4. Select a workflow, enter its required initialization fields, and press **Start workflow**. This creates one new compliance record; it does not require an existing record.
5. Read the workflow’s **Purpose**, **When to use**, **Do not use when**, **Before you begin**, **Completion criteria**, **Successful completion produces**, and exception guidance. Fields are marked Required, Conditional, or Optional.
6. The new record opens immediately with its record ID, workflow/version snapshot, status, current stage, progress, required information, controlled documents, evidence, approvals, and audit history. Conditional fields appear only when the controlling answer makes them applicable.
7. Save the current procedural section and record evidence that identifies the completed action, result, responsible person, and retained record. An authorized HTTPS link is optional.
8. If the canonical stage is an authorization or approval stage, a different person must approve it. Approval actions require the administrator session.
9. Advance only after the current gate reports complete. The server lists the specific missing field, document, signature, evidence, decision, or approval instead of permitting an incomplete transition.
10. Return through **Requires action**, **In progress**, **Awaiting approval**, **Completed**, **Cancelled**, **Archived**, or **All records**. Record URLs retain `#record=<record-id>` so an ordinary refresh reopens the same record.
11. Continue until closeout. Every evidence, approval, non-applicable branch, and transition appears in the transaction audit history and the central audit log.

The engine stores operational records under `llr:compliance-transactions`. It does not copy or alter canonical documents. Each record snapshots the exact workflow and template used at creation and retains canonical source provenance. Creation uses a one-time idempotency key and serialized KV update so double-clicks and request retries reopen the original record instead of creating duplicates.

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
| Social Media | View and edit the protected hierarchical social-media configuration with validation |

---

## Social Media Configuration

Open `admin.html` → **Administration** → **Social Media**. The editor displays the internal configuration as labeled hierarchical sections and fields; operators do not edit raw JSON.

1. Expand the organization, accounts, profile, governance, or metadata section.
2. Edit the required values without changing the locked field structure.
3. Select **Validate & Save**.
4. A successful save persists the validated configuration to `llr:social-media-config` and records an audit event.

The browser reads and writes only through authenticated `/api/admin?action=social-media-config` requests. Direct public access to `/SOCIAL_MEDIA.json` is blocked. When KV has no saved administrative configuration, the server initializes the editor from the protected repository JSON source.

---

## Live Streaming — Facebook and YouTube Live

The website is the viewing layer for Facebook Live, Chris's personal YouTube channel, and the Lost Limb Riders business YouTube channel.

### Going live (the whole workflow)

1. Start a broadcast on the Lost Limb Riders Facebook page, Chris's personal YouTube channel, or the Lost Limb Riders business YouTube channel.
2. `media.html` detects the broadcast within ~60 seconds, displays its actual title, embeds the correct platform player, and sends broadcast alerts.

No OBS, no stream keys, no RTMP, nothing to configure. When you end the broadcast, the site returns to its offline state (with a link to the replay on Facebook).

### One-time setup (already done? skip this)

Facebook detection needs `FACEBOOK_PAGE_ID` and `FACEBOOK_ACCESS_TOKEN`. YouTube detection needs `YOUTUBE_API_KEY`. These values are configured only in Vercel and are never returned to browsers. If one platform is unconfigured, any configured platform can still be detected.

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

## Content Engine

Two admin tabs: **Content Engine** (stories + settings) and **Event Ideas** (approval queue).

### Story generator

Generates original fictional short stories (600–1,000 words) for newsletter use. All stories require **admin approval** before publication.

- **Generate Story** — on-demand; pick theme/tone/character manually or hit **Surprise Me** for random picks
- Stories enter `pending` status → **Approve** / **Reject** / **Archive**
- Once approved, the next newsletter blast or cron send includes the story with a fiction disclosure
- After inclusion, the story status changes to `used` with the newsletter issue label
- The generator receives full story history to avoid repetition in characters, themes, and settings

### Event idea recommendations

AI generates practical event ideas scored by outreach, membership, fundraising, sponsor, and visibility value. Each recommendation includes a rationale explaining why it would benefit Lost Limb Riders.

- **Generate Ideas** — on-demand, produces ~3 ideas per run
- All ideas enter the **Event Approval Queue** as `pending`
- **Approve** publishes the idea as an official calendar event (status `published`)
- **Reject** hides it and logs the rejection
- Ideas never appear on the public calendar until approved

### Settings

Toggle automatic generation (stories/events), set frequency (days), and enable/disable Discord notifications. Approval is always required — cannot be disabled.

### Notifications

Requires `DISCORD_OWNER_WEBHOOK_URL` in Vercel env. Notifications fire for: idea generated, idea approved/rejected, story generated/approved/rejected/used, generation failures, notification failures. Discord failure never blocks content creation.

### Cron

`/api/cron-content` runs Mondays 06:00 UTC. Generates stories and/or ideas based on frequency settings stored in `llr:content-settings`. Self-gates like the newsletter cron (`CRON_SECRET` required, skips if too soon, logs failures).

---

## Newsletter System

### Signup → Welcome

1. Visitor submits name + email on the homepage
2. Backend captures the full marketing profile (IP → ip-api.com geolocation, ISP, proxy/hosting flags, device/screen/timezone, referrer) and dedupes by email
3. They receive a **welcome email** (Resend) with a **one-time e-book download link** (`/api/ebook?token=…`)
4. If signed-copy hosting is configured, the email advertises the signed edition; otherwise it honestly offers the free digital copy

### Sending newsletters

Two ways, both real sends via Resend:

- **Manual blast** — Send Newsletter tab → optional intro message → Preview → **Send to All Subscribers** → confirm. Sends immediately to active subscribers (capped at 100 per run), records an audit entry, and updates the last-sent timestamp. If an approved story is available, it's included automatically.
- **Automated cron** — runs Mondays 09:00 UTC but only actually sends every **≥ 13 days**, also capped at 100. Requires `CRON_SECRET`. Also includes the next approved story if available.

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

### Onboarding restricted-data boundary

Compliance records may track onboarding status and an opaque restricted HR/payroll file reference. Never enter an SSN, birth date, bank information, W-4/I-9 contents, government ID number, or identity-document image into a Compliance Engine field, evidence description, URL, or working document. Those records belong in the separate encrypted, need-to-know HR/payroll system required by REC-SOP-001. The current application does not provide that restricted-record upload or value-collection capability.

Volunteer Onboarding is separate from employment. Select the canonical program/area and Fort Dodge location, define the assignment under VOL-FORM-006, name its supervisor, answer the assignment-risk questions, and complete the resulting screening, driving, data-access, acknowledgment, training, and approval gates. Never enter screening details, emergency-contact details, driver-license numbers, or other protected records into evidence text; retain them in the restricted volunteer file and use its opaque reference.

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
| `llr:event-ideas` | 200 | AI-generated event recommendations awaiting approval |
| `llr:stories` | 500 | Story library — generated fiction with status/metadata |
| `llr:content-settings` | — | Content Engine settings (frequencies, toggles) |
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

Configured in `vercel.json`:

| Schedule | Endpoint | Purpose |
|----------|----------|---------|
| `0 9 * * 1` | `/api/cron-newsletter` | Weekly newsletter blast (Mondays 09:00 UTC) |
| `0 6 * * 1` | `/api/cron-content` | Content generation — stories + event ideas (Mondays 06:00 UTC) |

### Newsletter cron

The function self-gates:

1. Refuses requests without `Authorization: Bearer $CRON_SECRET`
2. Skips if the last send was less than **13 days** ago (`too_soon`)
3. Caps at **100 sends per run**
4. Records failures and updates `llr:last-newsletter-sent`
5. Includes the next approved story (if available) and marks it `used` after sending

### Content cron

Same `CRON_SECRET` gate. Requires `GEMINI_API_KEY` set (skips with `no_ai_key` if missing). Self-gates based on `llr:content-settings` frequencies (default: stories every 7 days, ideas every 14 days). Generation failures log to audit and notify via Discord if configured — never block other operations.

No system crontab involved — Vercel runs both.

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
