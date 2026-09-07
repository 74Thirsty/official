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

- Test suite: `node --test tests/facebook.test.mjs` (Facebook live-detection logic in `lib/stream.js`; extend it when touching that file), `node --test tests/mission-nav.test.mjs` (Mission page eight-tile navigation; extend when touching `mission.html`), plus `tests/admin-day.test.mjs`, `tests/content-engine.test.mjs`, `tests/docs-auth.test.mjs`, `tests/document-registry.test.mjs`, `tests/markdown-render.test.mjs`. Run the full suite with `node --test tests/`.
- Syntax: `node --check <file>` for every JS file changed; for inline JS in HTML pages, extract `<script>` blocks to temp files and `node --check` them.
- No lint, no formatter, no CI, no bundler.
- `npm run dev` = `vercel dev` (serves site + functions at `localhost:3000`; requires linked project / `.env.local`). Note: invoking `vercel dev` from inside this repo can trip the CLI's recursive-invocation guard because the `dev` script itself is `vercel dev`.
- `npm run deploy` = `vercel --prod`. Verify after deploy by curling public endpoints and checking that served pages contain the expected markers.

## Pages

- `index.html` — hero, book offering, newsletter signup (welcome email delivers one-time e-book link), guestbook, contact. Calls `/api/newsletter`, `/api/visit`, `/api/guestbook`, `/api/contact`.
- `events.html` — **public-only** interactive calendar (month/week views, category filters). Calls `/api/events?action=list`. No admin mode anywhere.
- `media.html` — podcast player, YouTube vlogs, Coffee Talk, Facebook Live embed (auto-detects go-live, shows replay when offline) + schedule display, broadcast-alert signup. Calls `/api/media`, `/api/stream`, `/api/media?action=podcast-rss` (RSS subscribe link), `/api/stream?action=subscribe-alerts`.
- `mission.html` — mission, board, programs, donate. **Eight section-navigation tiles** on the Table of Contents must navigate to their matching on-page `section[id]` (see Engineering invariants + `tests/mission-nav.test.mjs`). No API calls.
- `community.html` — community hub: photo gallery, testimonials, comments. Public submit goes to a pending queue; calls `/api/community`.
- `compliance.html` — authenticated intent-driven Compliance Engine. Creates operational transactions from the generated `ADM-REF-002` workflow manifest and enforces evidence, approval, transition, and audit gates through `/api/admin?action=compliance-*`.
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
- `/api/stream` — `get` (public), `subscribe-alerts` (public POST — go-live email opt-ins); `update`, `add-schedule`, `update-schedule`, `delete-schedule`, `check` (admin). Live state comes from the Facebook Graph API (`/{page}/live_videos`, 60s KV cache); scheduled streams stay in sync with linked calendar events.
- `/api/community` — gallery/testimonials/comments: `list|submit` (public), `pending|approve|unapprove|delete` (admin). Photos persist to Vercel Blob.
- `/api/ebook` — one-time tokenized e-book download links.
- `/api/unsubscribe` — tokenized newsletter unsubscribe.
- `/api/admin` — admin-only. Actions: `stats`, `visitors`, `subscribers`, `send-newsletter` (preview HTML only), `blast-newsletter` (real send, cap 100), `stream` (config + Facebook live-detection state), `update-stream` (Facebook page URL/title/description), `resend-welcome`, `audit`.
- `/api/cron-newsletter` — Vercel Cron sender (see Deployment). Refuses requests without `Authorization: Bearer $CRON_SECRET`.

Response conventions: JSON, errors as `{ "error": "..." }` with proper status (403 admin, 422 validation, 404 not found/unsupported, 500 storage). 201 on create, 204 on delete/OPTIONS.

## Shared library (`lib/`)

- `lib/http.js` — `sendJson`, `sendEmpty`, `sendDownload`, `readBody`, `getParam`, `getClientIp`, `clean()`, `timingSafeStrEqual`, `isAdmin(req)` (checks `?key=` query param or `X-Admin-Key` header against `ADMIN_KEY` via timing-safe compare).
- `lib/storage.js` — sole KV access layer (`Redis.fromEnv()`). Use `getList`/`setList`/`getDate`/`setDate` + the `KEYS`/`LIMITS` constants — **never call `kv` directly from an endpoint**. List caps enforced here.
- `lib/geo.js` — ip-api.com lookup (~45 req/min free tier). Returns `{ status:'unavailable' }` on failure; localhost returns empty.
- `lib/newsletter.js` — `buildNewsletter(userMessage, events, streams, name, unsubscribeUrl)`, `getUpcomingEvents`, `getUpcomingStreams`, `buildWelcomeEmail`, unsubscribe URL builder. Template placeholders: `{{DATE_RANGE}}`, `{{EVENTS_LIST}}`, `{{MESSAGE}}`, `{{NAME}}`.
- `lib/seed.js` — source of truth for `seedEvents`, `seedMedia`, `seedStream`, `podcastLinks`, and the embedded `newsletterTemplate`. Edit here to change them; do not read `data/`.
- `lib/stream.js` — Facebook-only live detection: Graph API `/{page}/live_videos` (60s KV cache in `llr:fb-live-cache`), live/replay/offline state derivation, broadcast-alert dedupe (`lastAlertedLiveUrl`). Requires optional `FACEBOOK_ACCESS_TOKEN` + `FACEBOOK_PAGE_ID`; page URL falls back to `FACEBOOK_PAGE_URL`.
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
| `llr:fb-live-cache` | — | cached Facebook live check (~60s TTL) |
| `llr:broadcast-alerts` | 5000 | go-live alert opt-ins |
| `llr:subscribers` | 5000 | includes e-book/unsubscribe tokens |
| `llr:visitors` | 5000 | visit log |
| `llr:guestbook` | 500 | server-side persisted |
| `llr:last-newsletter-sent` | — | ISO date string; cron gate |
| `llr:gallery-pending` / `llr:gallery-approved` | 200 / 500 | community photos |
| `llr:testimonials` | 500 | community |
| `llr:comments` | 2000 | community |
| `llr:audit` | 5000 | audit trail |
| `llr:compliance-transactions` | 500 | Operational compliance transactions, requirement status, evidence, approvals, and transaction audit history |

Re-seeding tip: deleting `llr:events`/`llr:media`/`llr:stream` in the Vercel KV dashboard causes the next public read to re-seed from `lib/seed.js`.

## Key conventions

- CSS is **inline in each HTML file** (no shared stylesheet). All pages share the same `:root` custom properties (`--orange`, `--black`, `--charcoal`, `--card`, `--white`, `--muted`, `--line`, `--shadow`) — keep them consistent across all pages.
- Admin auth: `ADMIN_KEY` env var on Vercel is the source of truth. Frontend stores it in `sessionStorage` under `llr-admin-key` and sends it as `?key=` (API also accepts `X-Admin-Key` header). Timing-safe compare only.
- Every visitor page load hits `/api/visit` → one ip-api.com lookup; newsletter signup does another. Keep this in mind re: geo rate limits.
- Streaming is **Facebook-only**: go live on the Facebook page, the site auto-detects and embeds it. No OBS/RTMP/stream keys anywhere. Detection creds are secrets (`FACEBOOK_ACCESS_TOKEN`, `FACEBOOK_PAGE_ID`) — server-side only, never returned to browsers.
- The site was a PHP→Node migration; do not add `.php` files. Hobby plan limits Vercel functions — endpoints were deliberately consolidated to ~12; don't split them back out casually.

## Environment variables (Vercel dashboard — `.env.local` only affects local dev)

- Required: `ADMIN_KEY`, `CRON_SECRET`, `RESEND_API_KEY`, `RESEND_FROM`, `KV_*` (auto-created by `vercel link`), `BLOB_READ_WRITE_TOKEN` (gallery uploads).
- Optional streaming: `FACEBOOK_ACCESS_TOKEN` + `FACEBOOK_PAGE_ID` (auto live detection), `FACEBOOK_PAGE_URL` (fallback "Follow on Facebook" link).
- Optional other: `NEWSLETTER_MESSAGE` (cron intro), `EBOOK_SIGNED`, `EBOOK_LINK_TTL_DAYS`, `EBOOK_DOWNLOAD_URL`, `EBOOK_STORAGE_*`.

Full details: [`VERCEL_ENV_CHECKLIST.md`](VERCEL_ENV_CHECKLIST.md). User-facing operations guide: [`ADMIN_MANUAL.md`](ADMIN_MANUAL.md) (tracked in git).

## Deployment & cron

1. `npm install`
2. `vercel link` (attach KV store → creates `KV_*` env vars)
3. Set env vars in the Vercel dashboard
4. `npm run deploy` (`vercel --prod`)
5. Cron configured in `vercel.json`: `"0 9 * * 1"` (Mondays 09:00 UTC). The function gates itself: sends at most every **13 days** and caps **100 sends/run** via Resend. Manual blasts from the admin panel also cap at 100 and update `llr:last-newsletter-sent`.

### Deploy gotchas (write it down — do not repeat these mistakes)

- **Deploy with `npm run deploy` — always.** Do not run `npx vercel --prod` with a hand-supplied `VERCEL_TOKEN`.
- **Do NOT set `VERCEL_TOKEN` for deploys.** The CLI's stored auth (`~/.local/share/com.vercel.cli/auth.json`) auto-refreshes the expired access token — `vercel whoami` → `lostlimbrider`. Overriding with a stale `VERCEL_TOKEN` produces a spurious `Error: Not authorized`, which is NOT a real auth problem.
- **Vercel uploads from the filesystem, not git.** Untracked/git-ignored files physically present in `api/` still count as serverless functions and will trip the Hobby-plan cap of **12 functions** (`Error: No more than 12 Serverless Functions...`). There are currently exactly 12 deployable functions (see `api/`).
- **Parked work goes in `.vercelignore`, never deleted.** The parked docs function `api/docs-auth.js` is excluded via `.vercelignore` so it doesn't count against the 12-function cap while staying on the back burner. Keep ignored/unwanted api files out of deployment with `.vercelignore`, and keep its entries in sync with what should NOT ship.

## Editing seed data

Edit `lib/seed.js` (embedded), then redeploy. Keep the `{{...}}` placeholders intact. `data/` is dead (empty `.gitkeep` only) — never read/write it at runtime.

---

## Engineering invariants

These are guaranteed behaviors. Preserve them; changes that threaten them need explicit verification before deployment.

### TWO-REPOSITORY COMPLIANCE ARCHITECTURE INVARIANT

`LostLimbRider/Autobiography` is the authoritative institutional documentation and controlled-process source. Policies, procedures, forms, checklists, registers, canonical Document IDs, approval requirements, and workflow requirements remain authoritative there.

`LostLimbRider/official` is the executable production application. Operational compliance enforcement—including workflow definitions, transaction instances, requirement status, evidence, approvals, gate evaluation, state transitions, audit history, persistence, APIs, and user interfaces—lives here and consumes controlled requirements derived from Autobiography.

Do not implement the production compliance engine in Autobiography. Do not create an independently maintained controlled-document or policy corpus in `official` or a third system. Any machine-readable compliance manifest used by `official` must be reproducibly derived from, traceable to, and versioned against the canonical Autobiography source.

### COMPLIANCE ENGINE INVARIANTS

- **Intent First:** The Compliance Engine begins with an intended organizational action, not a filtered document list.
- **Canonical Derivation:** Workflow definitions are reproducibly generated from the canonical Autobiography Transaction Map (`ADM-REF-002`) and retain source ID, path, version, and hash provenance.
- **Operational Separation:** Transaction instances, requirement status, evidence, approvals, gates, transitions, and audit events are runtime records in `official`; they are not controlled-document copies.
- **Server Enforcement:** The server rejects progression until the current requirement is complete. Approval-designated stages require evidence and a separate administrator approval; an evidence submitter cannot approve the same requirement.
- **Shared Resolution:** Controlled Document IDs in workflows resolve through `lib/document-registry.js`, the same canonical abstraction used by the Document Library.
- **Immutable Source:** Compliance operations never write to or rewrite canonical Markdown.
- **Definition / Record Boundary:** `compliance-start` previews a workflow definition and never looks up or creates a record. `compliance-create` atomically creates and persists a new record. `compliance-detail` alone opens an existing record and may return “Compliance record not found.”
- **Idempotent Initialization:** Every creation request carries an idempotency key. A global KV creation lock serializes list updates, and replaying the same intentional start returns the original record instead of creating a duplicate.
- **Historical Definition Integrity:** Each new record snapshots its complete workflow and template definitions. Reopening and executing that record uses its snapshot, so later catalog changes cannot rewrite historical requirements.
- **Scalable Discovery:** The engine home shows operational record metrics and category landing cards. Individual definitions appear only after category selection, search, or recent-workflow selection; it never renders the whole workflow library by default.

Protected by `tests/compliance-engine.test.mjs`, `tests/compliance-ui.test.mjs`, and `tests/docs-auth.test.mjs`.

### DOCUMENT LIBRARY INVARIANTS

- **Complete Library:** The Document Library provides access to the complete canonical document corpus subject only to explicit access-control rules. It is not a curated compliance subset.
- **Access:** Every canonical document has one authoritative access classification. Explicit `PUBLIC` documents are publicly readable. Internal or unclassified documents require authentication. Authenticated authorized users may access the complete canonical corpus.
- **Authentication Monotonicity:** Authentication may grant additional document access but must not remove documents already publicly accessible.
- **Session Continuity:** An authenticated Document Library session survives ordinary navigation between the library and document viewer according to the defined session lifetime.
- **Feature Separation:** The Document Library and Compliance Engine are separate product features. The Library provides comprehensive document discovery and reading; the Compliance Engine enforces controlled organizational workflows.
- **Source Preservation:** Render-time transformations, including reference expansion, never modify canonical source documents.
- **Canonical Name Uniqueness:** Every canonical document name is unique across the authoritative corpus.
- **Reference Transclusion:** When canonical documents reference other canonical material, the Document Library may resolve and transclude the relevant authorized material at render time to provide a coherent reading experience while preserving source provenance.
- **Transclusion Authorization:** Render-time reference expansion never exposes material the requesting user is not authorized to access.

### MISSION PAGE NAVIGATION INVARIANT

The Mission page contains **eight section-navigation tiles** in its Table of Contents: Our Story, Mission Statement, Our Vision, How the Funds Will Help, Why We're Asking for Help, How People Can Get Involved, Closing, and Organization Info. Each tile MUST navigate to its matching on-page `section[id]` (`#story`, `#mission-statement`, `#vision`, `#funds`, `#help`, `#involved`, `#closing`, `#org-info`) and land **clear of the sticky header**.

Changes touching Mission page markup, global CSS, scroll/overflow behavior, shared JavaScript, routing, or deployment behavior must preserve this. Protected by `tests/mission-nav.test.mjs`. **

### DOCUMENT LIBRARY RENDERING INVARIANT

Authoritative organizational documents remain **Markdown source** (single source of truth in the Autobiography repo). The Document Library must render that Markdown as formatted, human-readable documents. Raw Markdown must never be the normal viewing experience, and source documents must never be rewritten to compensate for presentation-layer failures. Protected by `tests/markdown-render.test.mjs`.

## Incidents

### 2026-09-07 — Workflow initiation routed into record lookup

- **Reported:** Selecting a workflow returned “Compliance record not found,” and the landing page rendered the full workflow catalog as a large card wall.
- **Root cause:** The browser passed `compliance-start?workflow_id=…` as the action string to a helper that URL-encoded the entire value. The server therefore received an invalid action, bypassed the definition-preview branch, and reached the existing-record lookup with no record ID. Creation also had no idempotency key or serialized KV update, and stored only a workflow version label while later execution reloaded the live definition.
- **Correction:** Build query parameters separately from the action; keep definition preview, atomic creation, and existing-record retrieval as distinct operations; serialize creation with a KV lock and idempotency replay; snapshot workflow/template definitions into new records; reopen records from a hash-addressable record state; replace the full card wall with dashboard, category, search, recent, and filtered-record views.
- **Regression protection:** `tests/compliance-ui.test.mjs`, `tests/compliance-engine.test.mjs`, and production persistent-lifecycle verification.

### 2026-09-04 — Document Library corpus, session, and feature-boundary failures

- **Reported:** Authentication appeared to remove public documents, authenticated discovery exposed only a curated subset, opening an internal document lost the session, and the library presented a document matrix as a Compliance Engine.
- **Root causes:** `lib/document-registry.js` contained 14 hand-maintained entries instead of a generated canonical inventory. The library stored its bearer token in `sessionStorage` but opened the viewer in a new `noopener` browsing context, which did not carry that session. Compliance review controls were embedded directly in the library page.
- **Correction:** Generate the complete metadata-only manifest from the pinned Autobiography source and its canonical access register; treat unclassified documents as internal; navigate the viewer in the same browsing context; keep public results rendered after authentication; remove Compliance Engine presentation from the library; resolve authorized references into bounded, provenance-labelled render-time expansions.
- **Canonical-name determination:** The two `00-FORMS-INDEX.md` basenames are scoped indexes with different canonical names and roles: the public handbook forms index and controlled `FRM-INDEX-001` transactional index. The canonical controlled naming system is Document ID plus Document Title; `validate_ops.py` explicitly limits filename uniqueness to active controlled documents. This is not a canonical-name collision.
- **Regression protection:** `tests/document-registry.test.mjs`, `tests/document-references.test.mjs`, `tests/document-library.test.mjs`, `tests/docs-auth.test.mjs`, and `tests/markdown-render.test.mjs`.

### 2026-09-04 — Mission page navigation tiles not working

- **Reported:** On mobile, the section-navigation tiles did not visibly move the page; destinations could land underneath the sticky header.
- **Root cause:** The tiles were plain native `<a href="#...">` anchors relying on default fragment jump against `html { scroll-behavior: smooth }` with `body { overflow-x: hidden }`. That combination renders fragment navigation unreliable across viewports (Chrome/smooth-scroll behavior), and there was no `scroll-margin-top` offset, so section tops landed `≈0px` from the viewport top — concealed behind the sticky nav. The bug existed since the page's creation but was aggravated by the sticky header; it was mis-attributed to the Document Library markdown work, which it was unrelated to.
- **Correction:** Added an explicit click handler in `mission.html` that `preventDefault()`s the default jump, calls `target.scrollIntoView({ behavior: 'smooth', block: 'start' })`, and updates `history.replaceState`. Added `section[id] { scroll-margin-top: 96px }` so scripted and native navigation both land below the sticky header. No new dependencies.
- **Verification:** Real Chromium (desktop `1440x900` + mobile `390x844`) against local and production — all 8 tiles scroll to their target with `targetTop ≈ 96px` (clear of header). Document Library markdown rendering re-verified unaffected.
- **Regression protection:** `tests/mission-nav.test.mjs` (add/keep in the suite when touching `mission.html`).

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
