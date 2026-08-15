# AGENTS.md

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
- **Verify** with the repo's existing tooling (see below — there is no test suite). Never claim success without running the available verification.
- **Emergency brake.** If you realize you've gone outside scope, stop, review, and restore only your own unrelated changes (never user work), then continue inside the boundary.

### Final report structure

Use exactly: **## COMPLETED** (what/where/why), **## NOT CHANGED** (related areas left alone), **## VERIFICATION** (checks + results), **## WARNINGS** (limitations, env issues), **## FOLLOW-UP** (only genuinely useful work; do not perform it without authorization).

---

## Project overview

Static vanilla HTML/CSS/JS frontend (no build step, no bundler, no framework) with **Vercel serverless functions** (Node.js ESM) serving JSON APIs. Deployed on **Vercel**; all data lives in **Vercel KV (Redis)** via `@upstash/redis`. No tests, no lint, no formatter, no CI. `README.md` is GitHub-profile boilerplate, not project docs — ignore it.

## Verification reality

- **No test suite, no lint, no typecheck, no build.** Verification means: `node --check <file>` for syntax, running `vercel dev` locally for manual checks, and reviewing deploy logs after `vercel --prod`.
- `npm run dev` = `vercel dev` (serves site + functions at `http://localhost:3000`; requires the project linked / KV env vars present or functions fail on `Redis.fromEnv()`).
- `npm run deploy` = `vercel --prod`.

## Pages

- `index.html` — hero, book offering, newsletter signup (free book download), guestbook, contact. Calls `/api/newsletter`, `/api/visit`, `/api/guestbook`.
- `events.html` — **public-only** interactive calendar (month/week views, category filters). Calls `/api/events?action=list`.
- `media.html` — **public-only** podcast player, YouTube vlogs, Coffee Talk episodes, live stream + schedule/archive display. Calls `/api/media`, `/api/stream`, `/api/podcast-rss` (subscribe link).
- `mission.html` — mission, board, programs, donate. No API calls.
- `admin.html` — **the single admin dashboard**: key login (`sessionStorage` key `llr-admin-key`), tabs for Subscribers, Visitor Log, Send Newsletter (preview builder only — does **not** send), Live Stream (config, schedule, archive approval/purge), and Events CRUD. Calls `/api/admin`, `/api/events`.

There is **no hidden admin mode** anywhere anymore — no A-keypress toggles. All admin UI was consolidated into `admin.html`.

## API endpoints (Vercel Functions, all extensionless)

- `/api/events` — `action=list` (public, auto-seeds `llr:events` from `lib/seed.js` when empty), `action=validate`, `add|update|delete` (POST, admin). Event fields: `title, date, endDate, time, category, location, description` (clean()'d, capped).
- `/api/newsletter` — POST signup (public). Validates name+email, silently captures full profile: IP, ip-api.com geolocation, browser/device/screen/timezone, proxy/hosting flags. Dedupes by email.
- `/api/visit` — POST (public) on every page load; logs IP, geolocation, browser, page, etc.
- `/api/admin` — admin-only. `action=stats|visitors|subscribers|send-newsletter|stream|archive|purge-archive|update-stream`.
- `/api/guestbook` — `list`/`add` (public), `download`/`clear` (admin). Server-side persisted; do not revert to localStorage.
- `/api/media` — `list` (public, auto-seeds `llr:media`), `add|update|delete` (admin, POST). Media types: `podcast|vlog|coffeetalk`. Fields include `num, season, title, date, duration, durationSec, desc, audioUrl, videoId, featured` (normalized to boolean + `hasVideo`). No admin UI is currently wired to the CRUD actions.
- `/api/stream` — live-stream status: `get` (public, seeds `llr:stream` from `seedStream`), `archive` (public), `update`, `add-schedule`, `delete-schedule` (admin).
- `/api/podcast-rss` — public RSS 2.0 feed generated from `llr:media` episodes where `type === 'podcast'`.
- `/api/cron-newsletter` — Vercel Cron sender (see Deployment). Refuses requests without `Authorization: Bearer $CRON_SECRET`.

## Shared library (`lib/`)

- `lib/http.js` — `sendJson`, `sendEmpty`, `sendDownload`, `readBody`, `getParam`, `getClientIp`, `clean()` (strips tags, collapses whitespace, truncates), `timingSafeStrEqual`, `isAdmin(req)` (checks `?key=` query param or `X-Admin-Key` header against `ADMIN_KEY` via timing-safe compare).
- `lib/storage.js` — sole KV access layer (`Redis.fromEnv()`). Use `getList`/`setList`/`getDate`/`setDate` + the `KEYS`/`LIMITS` constants — **never call `kv` directly from an endpoint**. List caps are enforced here.
- `lib/geo.js` — ip-api.com lookup (`http://ip-api.com`, ~45 req/min free tier). Returns `{ status:'unavailable' }` on failure; localhost returns empty.
- `lib/newsletter.js` — `buildNewsletter(userMessage, events)` + `getUpcomingEvents`. Placeholders in template: `{{DATE_RANGE}}`, `{{EVENTS_LIST}}`, `{{MESSAGE}}`, `{{NAME}}`.
- `lib/seed.js` — source of truth for `seedEvents`, `seedMedia`, `seedStream`, `podcastLinks`, and the embedded `newsletterTemplate`. Edit here to change them; do not read `data/`.
- `lib/stream.js` — stream auto-archiving (`autoArchive` when status goes live→offline), `publicArchive`, `adminArchive`, `purgeExpired`, keep-amount normalization.
- `lib/ua.js` — `parseBrowser(userAgent)` used by the admin panel.

## Storage (Vercel KV) — JSON arrays under `llr:*`

- `llr:events` (auto-seeds when empty), `llr:media` (auto-seeds when empty), `llr:stream` (single object in an array, auto-seeds), `llr:stream-archive` (cap 500).
- `llr:subscribers` (cap 5000), `llr:visitors` (cap 5000), `llr:guestbook` (cap 500), `llr:last-newsletter-sent` (ISO date string).
- Re-seeding tip: deleting `llr:events`/`llr:media`/`llr:stream` in the Vercel KV dashboard causes the next public read to re-seed from `lib/seed.js`.

## Key conventions

- CSS is **inline in each HTML file** (no shared stylesheet). All pages share the same `:root` custom properties (`--orange`, `--black`, `--charcoal`, `--card`, `--white`, `--muted`, `--line`, `--shadow`) — keep them consistent across all pages.
- Admin auth: `ADMIN_KEY` env var on Vercel is the source of truth. Frontend stores it in `sessionStorage` under `llr-admin-key` and sends it as `?key=` (API also accepts `X-Admin-Key` header). Timing-safe compare only.
- Every visitor page load hits `/api/visit` → one ip-api.com lookup; newsletter signup does another. Keep this in mind re: geo rate limits.
- Response conventions: JSON, errors as `{ "error": "..." }` with proper status (403 admin, 422 validation, 404 not found/unsupported, 500 storage). 201 on create, 204 on delete/OPTIONS.

## Environment variables (Vercel)

- `ADMIN_KEY` — admin API secret (`openssl rand -base64 32`).
- `CRON_SECRET` — sent by Vercel Cron as `Authorization: Bearer`; cron endpoint refuses requests without it.
- `RESEND_API_KEY` + `RESEND_FROM` — email sending (free tier 100/day).
- `NEWSLETTER_MESSAGE` — optional default intro for the cron newsletter.
- `KV_*` — auto-created by `vercel link` when attaching the KV store (not set by hand).

## Deployment & cron

1. `npm install`
2. `vercel link` (attach KV store → creates `KV_*` env vars)
3. Set env vars in the Vercel dashboard
4. `npm run deploy` (`vercel --prod`)
5. Cron configured in `vercel.json`: `"0 9 * * 1"` (Mondays 09:00 UTC). The function gates itself: sends at most every **13 days** and caps **100 sends/run** via Resend. Sending only happens via cron — `admin.html`'s newsletter tab only builds preview HTML.

## Editing newsletter template / seed data

Edit `lib/seed.js` (embedded), then redeploy. Keep the `{{...}}` placeholders intact. `data/` is dead (empty `.gitkeep` only) — never read/write it at runtime. The site is a PHP→Node migration; do not add `.php` files.

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
5. **PUSH TO GITHUB** — push to the appropriate branch (`main`; remote `origin` at `https://github.com/LostLimbRider/official`).
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

`.github/copilot-instructions.md` contains a detailed, currently-accurate project reference (API response codes, CSS tokens, troubleshooting, testing checklist). When it conflicts with this file, this file wins; report the conflict.
