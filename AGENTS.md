# LOST LIMB RIDERS — CODING AGENT OPERATING CONTRACT

**STATUS:** MANDATORY · **SCOPE:** Entire repository · **MODE:** Inspect → Plan → Change → Verify → Report
**PRIMARY RULE:** Do exactly the requested work. Do not invent additional work.

## Operating rules (all mandatory)

- **Scope discipline.** Fix what was asked and nothing else. Refactoring, rewrites, cleanup, doc updates, dependency changes, and "improvements" are separate tasks — do not do them without explicit authorization.
- **Do not guess.** Never invent requirements, APIs, file paths, config values, env vars, routes, commands, schemas, or intent. Inspect the repo first. If it cannot be determined, **STOP and ask**, stating: **BLOCKED:** what was found, why it blocks completion, and what specific information/decision is required.
- **Preserve existing behavior.** Treat working code as intentional. Before changing it, know what happens now, why, and what must stay the same.
- **Smallest correct change.** Prefer targeted edits using existing patterns, utilities, and dependencies. Search before creating — never duplicate an existing implementation or add a dependency the runtime already covers.
- **Destructive operations** (deleting files/data, resetting DBs, rewriting git history, force push, removing functionality/security/auth, changing prod infra or deployment) require explicit authorization.
- **Git safety.** Do not reset, discard, checkout-over, rebase, force-push, amend, or create commits unless explicitly requested. Inspect `git status` / `git diff` before committing; never commit secrets.
- **Secrets.** Never expose, print, commit, or hard-code credentials. Use env vars. Never invent secret values; if config is missing, stop and identify what is required.
- **Error handling.** Never swallow exceptions, suppress warnings, hide errors, or return fake success to make the app look functional.
- **Do not fake completion.** Use precise status language:
  - **VERIFIED** — successfully tested.
  - **PARTIALLY VERIFIED** — some verification done, limitations remain.
  - **UNVERIFIED** — implemented but could not be verified.
  - **BLOCKED** — cannot safely complete without more info/action.
- **Verify** with the repo's existing tooling (see below). Never claim success without running the available verification.
- **Emergency brake.** If you realize you've gone outside scope, stop, review, and restore only your own unrelated changes (never user work), then continue inside the boundary.

### Final report structure

Use exactly: **## COMPLETED** (what/where/why), **## NOT CHANGED** (related areas left alone), **## VERIFICATION** (checks + results), **## WARNINGS** (limitations, env issues), **## FOLLOW-UP** (only genuinely useful work; do not perform it without authorization).

---

## Project overview

Static vanilla HTML/CSS/JS frontend (no build step, no bundler, no framework) with **Vercel serverless functions** (Node.js 24.x ESM) serving JSON APIs. Deployed on **Vercel** (`lostlimbriders.org`); all data lives in **Vercel KV (Redis)** via `@upstash/redis`; community photo uploads use **Vercel Blob** (`@vercel/blob`). Email via **Resend**. Git remote is `official-llr` (`git@github.com:LostLimbRider/official.git`, branch `main`).

## Verification reality

- Test suite: `node --test tests/streamconfig.test.mjs` (stream-key/platform availability logic; extend it when touching `lib/streamconfig.js`).
- Syntax: `node --check <file>` for every JS file changed; for inline JS in HTML pages, extract `<script>` blocks to temp files and `node --check` them.
- No lint, no formatter, no CI, no bundler.
- `npm run dev` = `vercel dev` (serves site + functions at `localhost:3000`; requires linked project / `.env.local`). Note: invoking `vercel dev` from inside this repo can trip the CLI's recursive-invocation guard because the `dev` script itself is `vercel dev`.
- `npm run deploy` = `vercel --prod`. Verify after deploy by curling public endpoints and checking that served pages contain the expected markers.

## Pages

- `index.html` — hero, book offering, newsletter signup (welcome email delivers one-time e-book link), guestbook, contact. Calls `/api/newsletter`, `/api/visit`, `/api/guestbook`, `/api/contact`.
- `events.html` — **public-only** interactive calendar (month/week views, category filters). Calls `/api/events?action=list`. No admin mode anywhere.
- `media.html` — podcast player, YouTube vlogs, Coffee Talk, live stream player + schedule/archive display, broadcast-alert signup. Calls `/api/media`, `/api/stream`, `/api/media?action=podcast-rss` (RSS subscribe link), `/api/stream?action=subscribe-alerts`.
- `mission.html` — mission, board, programs, donate. No API calls.
- `community.html` — community hub: photo gallery, testimonials, comments. Public submit goes to a pending queue; calls `/api/community`.
- `sponsors.html` — sponsor wall (Title/Major/Supporting tiers). Static.
- `admin.html` — **the single admin dashboard**: key login (`sessionStorage` key `llr-admin-key`), tabs: Subscribers, Visitor Log, Send Newsletter (**Preview builds only; "Send to All Subscribers" performs a real blast** capped at 100), Live Stream, Events CRUD, Gallery / Testimonials / Comments moderation, Guestbook. Calls `/api/admin`, `/api/events`, `/api/stream`.

There is **no hidden admin mode** anywhere — all admin UI lives in `admin.html`.

## API endpoints (Vercel Functions, all extensionless)

- `/api/events` — `action=list` (public, auto-seeds `llr:events` from `lib/seed.js` when empty), `validate`, `add|update|delete` (admin POST).
- `/api/newsletter` — POST signup (public). Validates name+email, silently captures IP/ip-api.com geolocation/device data, dedupes by email, issues e-book token, sends welcome email.
- `/api/visit` — POST (public) on every page load; logs IP, geolocation, browser, page. Also sets `llr_vid` cookie.
- `/api/guestbook` — `list`/`add` (public), `download`/`clear` (admin). Server-side persisted in KV.
- `/api/contact` — POST (public) contact form via Resend.
- `/api/media` — `list` (public, auto-seeds `llr:media`) and `podcast-rss` (public RSS 2.0 feed built from podcast episodes — the old `/api/podcast-rss` function was consolidated into here); `add|update|delete` (admin POST).
- `/api/stream` — `get` (public), `archive` (public), `subscribe-alerts` (public POST — go-live email opt-ins); `update`, `add-schedule`, `update-schedule`, `delete-schedule`, `check` (admin). Scheduled streams stay in sync with linked calendar events.
- `/api/community` — gallery/testimonials/comments: `list|submit` (public), `pending|approve|unapprove|delete` (admin). Photos persist to Vercel Blob.
- `/api/ebook` — one-time tokenized e-book download links.
- `/api/unsubscribe` — tokenized newsletter unsubscribe.
- `/api/admin` — admin-only. Actions: `stats`, `visitors`, `subscribers`, `send-newsletter` (preview HTML only), `blast-newsletter` (real send, cap 100), `stream` (config + sanitized platform availability), `set-stream-key` (add/update platform stream key → `llr:stream-keys`), `stream-check`, `archive`, `purge-archive`, `update-stream`, `resend-welcome`, `audit`.
- `/api/cron-newsletter` — Vercel Cron sender (see Deployment). Refuses requests without `Authorization: Bearer $CRON_SECRET`.

Response conventions: JSON, errors as `{ "error": "..." }` with proper status (403 admin, 422 validation, 404 not found/unsupported, 500 storage). 201 on create, 204 on delete/OPTIONS.

## Shared library (`lib/`)

- `lib/http.js` — `sendJson`, `sendEmpty`, `sendDownload`, `readBody`, `getParam`, `getClientIp`, `clean()`, `timingSafeStrEqual`, `isAdmin(req)` (checks `?key=` query param or `X-Admin-Key` header against `ADMIN_KEY` via timing-safe compare).
- `lib/storage.js` — sole KV access layer (`Redis.fromEnv()`). Use `getList`/`setList`/`getDate`/`setDate` + the `KEYS`/`LIMITS` constants — **never call `kv` directly from an endpoint**. List caps enforced here.
- `lib/geo.js` — ip-api.com lookup (~45 req/min free tier). Returns `{ status:'unavailable' }` on failure; localhost returns empty.
- `lib/newsletter.js` — `buildNewsletter(userMessage, events, streams, name, unsubscribeUrl)`, `getUpcomingEvents`, `getUpcomingStreams`, `buildWelcomeEmail`, unsubscribe URL builder. Template placeholders: `{{DATE_RANGE}}`, `{{EVENTS_LIST}}`, `{{MESSAGE}}`, `{{NAME}}`.
- `lib/seed.js` — source of truth for `seedEvents`, `seedMedia`, `seedStream`, `podcastLinks`, and the embedded `newsletterTemplate`. Edit here to change them; do not read `data/`.
- `lib/stream.js` — auto-archiving (live→offline), `publicArchive`, `adminArchive`, `purgeExpired`, keep-amount normalization, live-state derivation.
- `lib/platform.js` — optional per-platform "is it really live?" checks (YouTube Data API, Facebook Graph, Twitch Helix, Owncast status) driven by status-check credentials; separate concern from stream keys.
- `lib/streamconfig.js` — pure/sync platform registry. Stream keys are secrets read only from env (`FB_STREAM_KEY`, `YOUTUBE_STREAM_KEY`, `TWITCH_STREAM_KEY`, `OWNCAST_STREAM_KEY`) or an injected stored-keys map; `platformStatuses(storedKeys)` emits sanitized availability `{platform,label,available,source}` (stored key overrides env). Never return keys or env names of secrets to the browser beyond these fields.
- `lib/streamkeys.js` — KV-backed store (`llr:stream-keys`) for keys saved from the admin panel; write-only from the UI's perspective, never echoed back.
- `lib/episodes.js` — scheduled-broadcast validation/normalization + calendar event syncing + live-state computation.
- `lib/email.js` — Resend sender wrapper (`RESEND_API_KEY`, `RESEND_FROM`).
- `lib/download.js` — e-book delivery: presigned S3/R2 URLs (`EBOOK_STORAGE_*`) or static fallback (`EBOOK_DOWNLOAD_URL`).
- `lib/audit.js` — append-only audit trail (`llr:audit`).
- `lib/ua.js` — `parseBrowser(userAgent)` used by the admin panel.

## Storage (Vercel KV) — JSON arrays under `llr:*`

| Key | Cap | Notes |
|-----|-----|-------|
| `llr:events` | — | auto-seeds |
| `llr:media` | — | auto-seeds |
| `llr:stream` | — | single object in array, auto-seeds |
| `llr:stream-archive` | 500 | archived broadcasts |
| `llr:stream-keys` | 8 | panel-saved platform stream keys (secrets; override env vars) |
| `llr:broadcast-alerts` | 5000 | go-live alert opt-ins |
| `llr:subscribers` | 5000 | includes e-book/unsubscribe tokens |
| `llr:visitors` | 5000 | visit log |
| `llr:guestbook` | 500 | server-side persisted |
| `llr:last-newsletter-sent` | — | ISO date string; cron gate |
| `llr:gallery-pending` / `llr:gallery-approved` | 200 / 500 | community photos |
| `llr:testimonials` | 500 | community |
| `llr:comments` | 2000 | community |
| `llr:audit` | 5000 | audit trail |

Re-seeding tip: deleting `llr:events`/`llr:media`/`llr:stream` in the Vercel KV dashboard causes the next public read to re-seed from `lib/seed.js`.

## Key conventions

- CSS is **inline in each HTML file** (no shared stylesheet). All pages share the same `:root` custom properties (`--orange`, `--black`, `--charcoal`, `--card`, `--white`, `--muted`, `--line`, `--shadow`) — keep them consistent across all pages.
- Admin auth: `ADMIN_KEY` env var on Vercel is the source of truth. Frontend stores it in `sessionStorage` under `llr-admin-key` and sends it as `?key=` (API also accepts `X-Admin-Key` header). Timing-safe compare only.
- Every visitor page load hits `/api/visit` → one ip-api.com lookup; newsletter signup does another. Keep this in mind re: geo rate limits.
- Stream keys are secrets: validated server-side (min length, charset), never displayed, never returned by any endpoint, never logged. Panel-saved keys override their env var until removed from KV.
- The site was a PHP→Node migration; do not add `.php` files. Hobby plan limits Vercel functions — endpoints were deliberately consolidated to ~12; don't split them back out casually.

## Environment variables (Vercel dashboard — `.env.local` only affects local dev)

- Required: `ADMIN_KEY`, `CRON_SECRET`, `RESEND_API_KEY`, `RESEND_FROM`, `KV_*` (auto-created by `vercel link`), `BLOB_READ_WRITE_TOKEN` (gallery uploads).
- Optional streaming: `FB_STREAM_KEY`, `YOUTUBE_STREAM_KEY`, `TWITCH_STREAM_KEY`, `OWNCAST_STREAM_KEY` (dropdown availability); status-check creds `FACEBOOK_ACCESS_TOKEN`+`FACEBOOK_PAGE_ID`, `YOUTUBE_API_KEY`+`YOUTUBE_VIDEO_ID` (alias `STREAM_VIDEO_ID`), `TWITCH_CLIENT_ID`+`TWITCH_ACCESS_TOKEN`(+`TWITCH_USER_LOGIN`), `OWNCAST_URL`, default platform `STREAM_PLATFORM`.
- Optional other: `NEWSLETTER_MESSAGE` (cron intro), `EBOOK_SIGNED`, `EBOOK_LINK_TTL_DAYS`, `EBOOK_DOWNLOAD_URL`, `EBOOK_STORAGE_*`.

Full details: [`VERCEL_ENV_CHECKLIST.md`](VERCEL_ENV_CHECKLIST.md). User-facing operations guide: [`ADMIN_MANUAL.md`](ADMIN_MANUAL.md) (tracked in git).

## Deployment & cron

1. `npm install`
2. `vercel link` (attach KV store → creates `KV_*` env vars)
3. Set env vars in the Vercel dashboard
4. `npm run deploy` (`vercel --prod`)
5. Cron configured in `vercel.json`: `"0 9 * * 1"` (Mondays 09:00 UTC). The function gates itself: sends at most every **13 days** and caps **100 sends/run** via Resend. Manual blasts from the admin panel also cap at 100 and update `llr:last-newsletter-sent`.

## Editing seed data

Edit `lib/seed.js` (embedded), then redeploy. Keep the `{{...}}` placeholders intact. `data/` is dead (empty `.gitkeep` only) — never read/write it at runtime.

---

# EXECUTIVE DIRECTIVE 001

## Mandatory Change → Build → Deploy → GitHub Protocol

**STATUS:** IMMEDIATE / MANDATORY

Every code change is subject to a mandatory completion cycle. No change is complete merely because code was edited locally.

### REQUIRED WORKFLOW

1. **IMPLEMENT** — make the requested change, scoped to the request.
2. **BUILD** — compile/build the affected app; resolve failures first.
3. **TEST / VERIFY** — run applicable checks and confirm it works.
4. **COMMIT TO GIT** — create an intentional commit with the change.
5. **PUSH TO GITHUB** — push to the appropriate branch (`main`; remote `official-llr` at `https://github.com/LostLimbRider/official`).
6. **REDEPLOY** — redeploy via the established process (`npm run deploy`).
7. **VERIFY DEPLOYMENT** — confirm the deployed app reflects the new code.

### COMPLETION STANDARD

A task is **not** complete until: **Code changed → Build successful → Tests/verification successful → Git commit created → GitHub push successful → Deployment successful → Deployed version verified.**

### PROHIBITED

- Leaving changes only local, skipping build/verify, committing without pushing, pushing without redeploying, claiming completion when GitHub/deploy doesn't have the changes, or skipping stages because a change "looks trivial."

### FAILURE HANDLING

If any stage fails: **STOP THE COMPLETION CLAIM.** Report the exact failed stage, the error, and corrective action taken or required. The workflow stays blocked until the human confirms the change should proceed.

### EXECUTIVE RULE

**NO CHANGE IS COMPLETE UNTIL IT IS BUILT, VERIFIED, COMMITTED, PUSHED TO GITHUB, REDEPLOYED, AND VERIFIED IN THE DEPLOYED ENVIRONMENT.** Applies to all subsequent coding work unless superseded by a later directive.

---

## Other instruction sources

`.github/copilot-instructions.md` may contain older project references; treat this file as authoritative and report conflicts. `ADMIN_MANUAL.md` documents operator workflows (kept user-facing; align it when behavior changes). `VERCEL_ENV_CHECKLIST.md` is the env-var source of truth.
