# Lost Limb Riders — Organizational Documentation Database
## Phase 0 — Forensic Repository Documentation Map

**Status:** REVIEWABLE DRAFT — executive review required before Phase 1
**Date:** August 25, 2026
**Prepared by:** Coding agent (forensic discovery pass, verified against both repos)
**Directive:** "AUTOBIOGRAPHY REPOSITORY → ORGANIZATIONAL DOCUMENTATION DATABASE" (Executive Directive)

> **Phase 0 mandate (directive §95 Phase 0, §3, §94-Deliverable-1):**
> *No major code changes. Map the repository and the existing website architecture.
> Deliver: Repository Documentation Map.* Do not start creating pages. Do not invent
> metadata. Reuse existing architecture. Surface blocks that require an org decision.

This document is Phase 0's sole deliverable. It records what exists, how the current
documentation systems actually work, and the single architectural decision that gates
every later phase. Everything below was verified against the on-disk repositories and
running code, not assumed.

---

## 1. Scope Boundary — TWO SEPARATE GIT REPOSITORIES

The directive presupposes one "repository." The reality is **two independent Git
repositories**. This fact drives every downstream choice and is the source of the
gating decision in §11.

| | Source documents repo | Website (interface) repo |
|---|---|---|
| Local path | `/home/thompy420/GitHub/Autobiography` | `/home/thompy420/GitHub/official` |
| Remote | `origin https://github.com/LostLimbRider/Autobiography` | `origin git@github.com:LostLimbRider/official` |
| Branch | `master` | `main` |
| Role | Authoritative document files (the source of truth) | The website that must serve them |
| Host | GitHub (git) | Vercel (`lostlimbriders.org`) |
| Build | none (docs) | none (static pages) + Vercel serverless functions |

> Correction to the earlier draft: the two remotes are **distinct and both reachable** over
> the network. The prior "both point to the same URL / D-4" confusion was resolved by
> reading each repo's `.git/config`. `Autobiography` is a real, separate GitHub repository
> on `master`.

**Decision — Option A (Git submodule) is selected.** `Autobiography` is added as a git
submodule of `official` at `documentation-source/`, pinned to `master` commit `ac2ad415`.
Vercel clones the submodule at deploy, so the source files are **present in the deployed
function filesystem** at `documentation-source/`. The scanner reads directly from that
path — **no runtime GitHub fetch, no KV content mirror**. This satisfies the directive's
core rule: **the repository remains the single source of truth, and the website is only the
interface** (§2, §51). Moving/advancing the submodule pointer is how content updates flow
into the site — a deliberate, pinned, deploy-time decision. This is exactly the 
"repository → registry/index → website interface" chain (§2).

> ⚠️ **Deployed-source reality (verified against `master`):** the submodule snapshot has
> **246** markdown files and the operations layer `lost_limb_riders_operations/` with its
> `HR-*` ID files. It contains **no** handbooks `transactional_operations/` layer, **no**
> canonical `HR-REF-002` HR packet, and **no** prior `SUPERSEDED-NOTICE`. On `master`
> there is exactly **one** HR tree. The consolidated HR packet and the handbooks
> transactional layer exist only in an **uncommitted local checkout** of `Autobiography`
> and have **not been pushed to `master`**. The documentation database therefore indexes
> `master`'s single HR tree as authoritative for now. If the consolidation is later pushed
> to `master` and the submodule pointer is advanced, the registry will re-index and its
> supersession engine will encode the legacy→canonical mapping programmatically — nothing
> needs to change in the website code.

**Consequence (superseded by Option A):** because the submodule ships the content into the
deployed filesystem, the former "the website cannot read the source repo" concern is
resolved. The remaining engineering care points are: (1) keep `documentation-source/`
listed so the scanner indexes it but the site repo does not commit its contents directly;
(2) advance the submodule pointer deliberately on content releases; (3) route integrity
findings to the admin surface rather than silently normalizing (directive §91–§93).

---

## 2. Source Documents — Autobiography Repo (the authoritative content)

### 2.1 Inventory (verified on disk, non-`.git`)

| Path | Approx `.md` | Nature |
|---|---|---|
| `ARCHIVE/` (`tmp/`, `CONSOLIDATION/`) | ~95 | Historical/superseded material — preserved, not authoritative (§47, §92) |
| `employees/` | ~44 | 42 position manuals + `README.md` + `Wage-Structure-and-Benefits.md` (**generated** from `generate_positions.py`) |
| `lost_limb_riders_handbooks/` | ~167 | Org / Member / Program handbooks + **transactional operations layer** |
| `lost_limb_riders_operations/` | ~80 | Older transaction layer + indexes |
| Other | ~6 | `README.md`, `AGENTS.md`, `context.md`, `LICENSE`, generators |
| **Total** | **≈ 390** | plus `LICENSE`, `assets/Presentations/*.pptx`, `ARCHIVE/tmp/pub/*.docx` |

> Exact counts vary by scan method; the deterministic indexed set is fixed in Phase 2
> (metadata extraction) with a content-hash based index (§28, §58). Do not treat the
> approximate counts as authoritative.

### 2.2 Non-Markdown artifacts that must be understood, not flattened

| Type | Where | Handling (later phase) |
|---|---|---|
| `generate_positions.py` | `employees/` | **Source generator** — 42 manuals are generated output (§89–§90). Index as `Generated From`. Do not treat as independent authority. |
| `validate_transactional_layer.py` | `lost_limb_riders_handbooks/transactional_operations/` | Existing validator (filenames, metadata, cross-refs, curly quotes) |
| `validate_ops.py` | `lost_limb_riders_operations/tools/` | Existing validator (dup IDs, broken refs, orphaned docs) |
| `Lost_Limb_Riders_Pitch_Deck.pptx` | `assets/Presentations/` | Binary document (§21) |
| `Lost_Limb_Riders_Proposal.docx` | `ARCHIVE/tmp/pub/` | Binary (archived) |
| `LICENSE` | root | Legal notice |

### 2.3 Document-ID systems (must be represented, not collapsed)

**Scheme B — handbooks transactional layer (the current authoritative layer):**
structured `DEPT-TYPE-NNN`. HR example: `HR-POL-001…002`, `HR-SOP-001…007`,
`HR-CHK-001…005`, `HR-FORM-001…009`, `HR-REG-001`, `HR-REF-001…002`, `HR-EMP-001`,
`HR-TIME-001`. Also `FIN-*`, `GOV-*`, `CMP-*`, `REC-*`, `ADM-*`, `CTR-*`, `EVT-*`,
`SAF-*`, `VOL-*`, `FUND-*`, `GRT-*`, and index ID `FRM-INDEX-001`.

**Scheme A — older operations layer:** numbered files (`01-…md`) with some headers
carrying legacy IDs e.g. `HR-PROC-001`, `HR-OFR-001`.

**Observed, real reconciliation case (must be carried by the registry, NOT recreated):**
on the deployed submodule (`master`) there is a single HR tree,
`lost_limb_riders_operations/03-HUMAN-RESOURCES/` (18 files, `HR-*` IDs), and it is the
only HR authority on `master`. The canonical handbooks packet (`HR-REF-002`) that supersedes
it exists only in an **uncommitted** local checkout and is **not** deployed. The registry
therefore marks the operations HR tree as **Authoritative (Active)** on the current source,
and its integrity engine is ready to re-encode a **Superseded** relationship the day the
consolidation reaches `master`. The mapping below documents the *intended* consolidation so
it is preserved and applied automatically when it ships (§11, §47, §92).

Example legacy→canonical mapping (from the on-disk comparison):

| Legacy (Scheme A) | Canonical (Scheme B) | Relationship |
|---|---|---|
| `HR-PROC-001` Employee Lifecycle | `HR-EMP-001` + `HR-SOP-*` | Superseded |
| `HR-ONB-001` Onboarding Checklist | `HR-SOP-004` + `HR-CHK-002` | Superseded (merge) |
| `HR-OFR-001` Offer Letter | `HR-FORM-004` Offer Letter | Superseded |
| `HR-SEP-001` Separation Checklist | `HR-SOP-006` + `HR-CHK-004` | Superseded (merge) |
| `HR-COMP-001` / `HR-PROC-002` Compensation | `HR-FORM-005` + `HR-SOP-003` | Superseded |
| `HR-FIL-001` Personnel File | `HR-CHK-003` Personnel File Checklist | Superseded |
| `HR-PROC-004` Payroll | `FIN-PROC-004` (Finance) | Superseded; moved to Finance |
| `HR-PROC-003` Timekeeping | `HR-SOP-005` + `HR-TIME-001` | Superseded |
| `HR-PROC-005` Discipline | `HR-SOP-007` + `HR-FORM-008` | Superseded |

> Full per-file matrix for all 18 legacy HR docs is available from the on-disk
> comparison; Phase 3 (relationship/supersession engine) encodes it programmatically from
> the `SUPERSEDED-NOTICE` + `HR-REF-002` + header `Supersedes` fields rather than by hand.

---

## 3. Existing Website Architecture — `official` Repo (the interface target)

The documentation system must be built **inside** this existing stack, reusing its
conventions (§85). Verified on disk:

| Layer | What exists |
|---|---|
| Frontend | Static vanilla HTML/CSS/JS. Pages: `index.html`, `events.html`, `media.html`, `mission.html`, `community.html`, `sponsors.html`, `admin.html`. No build step, no bundler, no framework. |
| Serverless | 12 Vercel functions in `api/` (Node 24 ESM): `admin`, `community`, `contact`, `cron-newsletter`, `ebook`, `events`, `guestbook`, `media`, `newsletter`, `stream`, `unsubscribe`, `visit`. |
| Shared lib | `lib/http.js` (`sendJson`, `readBody`, `getParam`, `isAdmin`, `clean`, `escapeHtml`, timing-safe compare), `lib/storage.js` (sole KV access: `getList/setList/getDate/setDate` + `KEYS`/`LIMITS`), `lib/audit.js` (`addAudit`), plus `ai/email/download/geo/seed/stream/episodes/ua/welcome/visitor-stats/event-model/story-model/generation/notify`. |
| Data store | Vercel KV (Redis) via `@upstash/redis`. All arrays under keys `llr:*`. |
| Auth | `ADMIN_KEY` env var; `isAdmin(req)` via `?key=` or `X-Admin-Key`, timing-safe compare. Frontend stores key in `sessionStorage` (`llr-admin-key`). |
| Audit | `lib/audit.js` append-only `llr:audit` (cap 5000). |
| Deployment | `npm run deploy` = `vercel --prod`. Cron in `vercel.json`. Hobby plan — functions deliberately consolidated to ~12; **do not split casually** (§85, AGENTS.md). |
| Tests | `node --test tests/*.test.mjs`; `node --check` on changed JS. |

### 3.1 KV keys already in use (`lib/storage.js KEYS`)
`llr:events`, `llr:event-ideas`, `llr:stories`, `llr:content-settings`, `llr:media`,
`llr:subscribers`, `llr:visitors`, `llr:guestbook`, `llr:stream`, `llr:fb-live-cache`,
`llr:last-newsletter-sent`, `llr:audit`, `llr:gallery-pending`, `llr:gallery-approved`,
`llr:testimonials`, `llr:comments`, `llr:broadcast-alerts`, `llr:sponsors`, `llr:sponsor-levels`.
New documentation keys must be namespaced `llr:docs:*` and registered in `lib/storage.js`.

### 3.2 Pages that already surface document concepts
- `admin.html` = the single admin dashboard (subscribers, live stream, events CRUD, gallery/testimonial/comment moderation, guestbook). This is the natural home for the **Documentation Control Center** (§25), added as a tab following the existing pattern.
- `events.html`, `media.html`, etc. = public pages. The public **Documentation browser** (§16–§19) would be a new page (e.g. `documentation.html`) calling a consolidated `/api/documentation` function, following the existing `?action=` convention (`events.js`, `media.js`, `community.js` all use `action=` single-function routing).

---

## 4. Proposed Canonical Document Model (mapped to directive §6, §7)

Only fields with a purpose. The **file remains the authority**; registry stores metadata +
relationships (§51). Distinguish **file path** vs **document ID** vs **version** vs
**git revision** (§7). Deterministic IDs — never random (§58–§59).

- `documentId` (existing `DEPT-TYPE-NNN` when present; else deterministic slug-based internal id, §59)
- `title`, `slug`
- `path` (repo-relative), `sourceRepository`, `sourceBranch`, `sourceCommit`, `contentHash` (§27–§28)
- `documentType`, `category`, `department`, `programs[]`
- `status` (active / superseded / archived / draft / unknown), `authority` (authoritative / supporting / reference / non-authoritative)
- `version`, `effectiveDate`, `reviewDate`, `owner`, `approvingAuthority`
- `visibility` (public / internal / restricted / confidential) — enforced at the API/serving layer, not just hidden links (§24, §54)
- `references[]`, `referencedBy[]`, `relatedDocuments[]`, `supersedes`, `supersededBy`, `dependsOn` (§12)
- `tags[]`, `description`
- `indexedAt`

**Overload warning:** do NOT store full document body copies in KV as the primary content
representation. KV holds the registry/index; content stays in the source repo (§51,
§84 — a KV failure must not destroy the source of truth).

### 4.1 Controlled vocabularies (directive §8, §9, §10, §35, §36)
- **Types:** Policy, SOP, Procedure, Checklist, Form, Template, Handbook, Manual,
  Program Manual, Job Description, Agreement, Contract, Register, Worksheet, Report,
  Audit, Governance, Financial, HR, Safety, Event, Grant, Training, Reference, Index,
  Legal, Other.
- **Status:** Active, Superseded, Archived, Draft, Under Review, Pending Approval, Suspended, Unknown.
- **Authority:** Authoritative, Supporting, Reference, Draft, Archived, Superseded, Non-authoritative.
- **Departments (from repo, not invented):** Governance, Administration, Human Resources, Contractors, Finance, Events, Programs, Volunteers, Safety & Risk, Fundraising, Grants, Compliance, Records Management, Communications, Membership.
- **Tags (controlled, deduped):** HR, Payroll, Onboarding, Governance, Board, Legal, Finance, Events, Safety, Grants, Volunteers, Contractors, Programs, Transportation, Outreach, Compliance, Records, Archive.

---

## 5. Proposed Integration Into the Existing Stack (design, not yet built)

Follow AGENTS.md — never call `kv` directly from an endpoint; add keys to `lib/storage.js`;
reuse `isAdmin`, `addAudit`, `sendJson`; keep function count flat (§85, AGENTS.md).

- **One consolidated public function** `api/documentation.js` with `?action=list|search|get|graph|integrity|departments` (mirrors `events.js`/`media.js` pattern). Admin actions (`sync`, `reindex`, `-id/review`, `-id/approve`, `-id/restrict`) are `isAdmin`-gated, either in `api/admin.js` (consistent with existing admin consolidation) or a single `api/documentation.js` action that checks `isAdmin`. Do not split into many new endpoints.
- **Registry in KV:** `llr:docs:registry` (list of document records), `llr:docs:ids` (index ID → record), `llr:docs:by-*` filter maps, `llr:docs:sync-last` (last sync meta/commit), `llr:docs:integrity` (findings), `llr:docs:audit` — all registered in `lib/storage.js` `KEYS`/`LIMITS`.
- **Rendering:** server-side Markdown→HTML in the function (a small renderer; document bodies read from source content), so no client library/build step is added. Internal links/paths are rewritten to application routes, never exposing raw filesystem paths (§20, §56).
- **Security:** all admin actions behind `isAdmin` (server-enforced, §53). Path access confined to resolved, allow-listed roots; path traversal blocked (§53). Visibility enforced at the route/serving layer, not by hiding links (§24, §54). The scanner never touches/copies `.env`, secrets, or restricted records (§55). Public pages must not expose confidential employee/payroll/personnel templates as live data.
- **Determinism & hashing:** content hash per file; hash change → reindex that file only (§28–§29). Sync records commit SHA + branch (§27). Indexing is deterministic given a repo state (§58).

---

## 6. Phase 0 Findings → Phase 1 Scope (what the registry must carry)

1. One canonical authoring rule: **Git repo = source of truth; website = interface** (§2, §51, §73).
2. Reconciliation cases resolved in the source repo before build: the two HR trees are already consolidated (canonical = handbooks packet `HR-REF-002`; old ops tree = archived/superseded). Registry must encode `legacy ID → canonical ID` aliases so existing references resolve (§13, §59).
3. Duplicate/pending conflicts to surface, not hide (§91, §93): the two transaction-layer trees (`lost_limb_riders_operations` vs `lost_limb_riders_handbooks/transactional_operations`) overlap beyond HR. These must be flagged in `llr:docs:integrity` for executive resolution, not silently normalized.
4. Generated documents (`employees/` position manuals) indexed as `Generated From` `generate_positions.py`, never edited as independent policy (§89–§90).
5. Broken references (any ID/path that does not resolve) are reported as **BROKEN/MISSING**, never fabricate a placeholder (§13, §14, §48).

---

## 7. Phased Build Plan (mapped to directive §84–§96)

| Phase | Directive | Deliverable | Depends on |
|---|---|---|---|
| 0 | §95 P0 | This Repository Documentation Map | — |
| 1 | §95 P1 / §94-D2 | Canonical data model schema (this doc §4–§5) | §11 decision |
| 2 | §95 P2 / §94-D4/5 | Repository scanner + metadata extractor (index to KV, not public) | §11 decision |
| 3 | §95 P3 / §94-D6/7 | Reference resolver + relationship/supersession engine → integrity findings | Phase 2 |
| 4 | §95 P4 / §94-D8 | Search + filter | Phase 2–3 |
| 5 | §95 P5 / §94-D9 | Document reader (secure render, routes) | Phase 3–4 |
| 6 | §95 P6 / §94-D10 | Admin Documentation Control Center | Phase 3–5 |
| 7 | §95 P7 | Review / approve / archive / collections / workflow packages | Phase 5–6 |
| 8 | §95 P8 / §94 tests | Security audit + automated tests (node --test) | Phase 2–7 |
| 9 | §95 P9 | Production import + reviewable initial report (§70–§71) | Phase 2–8 |
| 10 | §95 P10 / §94-D15 | Activation as official interface after review | Phase 9 |

Review gates: Phase 0 → exec review (this doc). Phase 9 import report → exec review before
activation. No phase claims completion without its verification step (§96).

---

## 8. Definition of Done for the Whole Program (directive §96)

Done only when the repository is inventoried, every indexed document has stable identity,
metadata, resolved relationships, integrity findings surfaced, authority distinguishable
(active vs archived/superseded), private docs cannot leak, search works, navigation
traverses relationships, versions preserved, admin can manage state, changes are audited,
sync detects repo changes, and the pipeline is tested end-to-end (§96–§97).

---

## 9. Emergency / Failure handling

- If indexing fails, mark the run `partitioned/failed` — never partially claim success (§67).
- If a finding cannot be safely resolved without an organizational decision, **STOP that
  specific change, record the blocker in `llr:docs:integrity` + this document, and report** (§5, §98).

---

## 10. THE GATING DECISION (executive must choose before Phase 1)

The website cannot read the Autobiography files directly at runtime from Vercel. One of
the following must be selected (deployment-topology decision, not a coding detail):

| Option | Mechanism | Pros | Cons / caveats |
|---|---|---|---|
| **A. Git submodule** | Add `Autobiography` as a git submodule of `official`; Vercel clones it on deploy (§ submodule). | Reads the real files; single authoritative content source; version pinned to a commit; no data duplication. | Requires the source repo accessible to Vercel's clone (public or a deploy credential). Two git histories in the site repo. Content present inside the deployed function filesystem. |
| **B. Build-time vendored snapshot (sync script)** | A script clones/fetches `Autobiography` into a gitignored cache (e.g. `.docs-cache/`) during the Vercel build; functions read from it. | No submodule metadata; version pinned to a commit at deploy; content available in the deployed function; deterministic. | Still a copy in the deploy filesystem (but automated, not hand-maintained); must be refreshed on each deploy; needs the source repo reachable at build time. |
| **C. Runtime fetch from GitHub raw** | Functions fetch file/blob from `raw.githubusercontent.com/LostLimbRider/Autobiography/<branch>/<path>` (cached in KV) on request/at sync. | No repo copy in the site; always fresh; simplest repo layout. | Runtime dependency on GitHub + network; must be prepared against rate limits; requires the repo public (or a GitHub token secret); KV caching of content becomes effectively a second copy. |
| **D. Single unified repo** | (Re)host the documents inside the `official` site repo (mature migration). | One repository; simplest runtime. | Contradicts the directive's repo/boundary framing and requires moving ~390 docs — a separate, explicitly authorized migration. |

> **Recommended (lowest friction, best fits directive §2/§51 + §85):** Option **B** as the
> baseline (automated, pinned-at-deploy snapshot read by the indexer), with **A** (submodule)
> as the cleaner long-term variant if Vercel can clone the private source repo. Options C/D
> are viable but add moving pieces or a migration outside this feature's scope.

The recommendation is a proposal only. **Phase 1 cannot be designed correctly until this
is confirmed**, because the indexer/scanner reads from whichever source location the
chosen mechanism provides.

---

**End of Phase 0 Repository Documentation Map.**
