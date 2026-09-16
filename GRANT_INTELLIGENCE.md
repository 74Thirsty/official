# Grant Intelligence & Discovery — Technical Documentation

## Architecture

```
External Grant Sources (Grants.gov)
    ↓
Provider Adapters (lib/grants/provider.js → lib/grants/grants-gov.js)
    ↓
Normalized Grant Opportunity Record (lib/grants/normalize.js)
    ↓
Deduplication (lib/grants/dedup.js)
    ↓
Deterministic Eligibility / Relevance Screening (lib/grants/screening.js)
    ↓
Grant Intelligence Inbox (api/admin.js → grant-intelligence-* actions)
    ↓
Human Review (admin.html → Grant Intelligence tab)
    ↓
Promote to ACE (existing pursue-grant workflow via lib/ace/engine.js)
```

## Provider Interface

`lib/grants/provider.js` — Abstract base class:

- `id` — Provider identifier (e.g., `'grants-gov'`)
- `name` — Human-readable name (e.g., `'Grants.gov'`)
- `search(params)` — Returns `{ hitCount, startRecord, rows, hits, facets }`
- `fetchDetails(opportunityId, signal)` — Returns raw provider detail response

## Grants.gov Integration

`lib/grants/grants-gov.js` — Concrete provider:

- **Production base:** `https://api.grants.gov`
- **search2 endpoint:** `POST /v1/api/search2` — No authentication required
- **fetchOpportunity endpoint:** `POST /v1/api/fetchOpportunity` — No authentication required
- Pagination: offset-based via `startRecordNum` + `rows`
- Rate limiting: No published numeric limits; fair-use applies

## Normalized Opportunity Schema

`lib/grants/normalize.js` — Fields:

| Field | Type | Source |
|-------|------|--------|
| provider | string | Always `'grants-gov'` |
| providerOpportunityId | string | Grants.gov numeric ID |
| opportunityNumber | string | e.g., `'PA-25-245'` |
| title | string | Opportunity title |
| issuingAgency | string | Agency name |
| agencyCode | string | Agency code |
| issuingOffice | string | Office (null for Grants.gov) |
| assistanceListings | array | `{ number, title }` |
| opportunityStatus | string | `forecasted/posted/closed/archived` |
| opportunityCategory | object | `{ category, description }` |
| postingDate | string | ISO date `YYYY-MM-DD` |
| openingDate | string | ISO date |
| closingDate | string | ISO date |
| archiveDate | string | null for Grants.gov |
| fundingInstrument | array | `{ id, description }` |
| fundingCategory | array | `{ id, description }` |
| eligibility | object | `{ applicantTypes: [{id, description}], description }` |
| geographicRestrictions | string | null from Grants.gov |
| awardCeiling | number | Max award |
| awardFloor | number | Min award |
| estimatedTotalFunding | null | Not in Grants.gov |
| expectedNumberOfAwards | null | Not in Grants.gov |
| costSharing | boolean | Cost sharing required |
| synopsis | string | Program description |
| programDescription | string | Same as synopsis |
| contactInfo | object | `{ name, email, phone, description }` |
| officialSourceUrl | string | Link to Grants.gov |
| attachments | array | File metadata |
| rawHash | null | Not computed |

### Intelligence Metadata

| Field | Type | Description |
|-------|------|-------------|
| externalId | string | `provider:providerOpportunityId` |
| status | string | `new/potential-match/needs-review/rejected/promoted` |
| screening | object | Screening result (see below) |
| relevanceScore | null | Not computed |
| adminNotes | string | Human review notes |
| aceInstanceId | string | ACE record ID if promoted |
| aceStatus | string | `pending/promoted` |
| createdAt | string | ISO timestamp |
| updatedAt | string | ISO timestamp |
| retrievedAt | string | Last sync timestamp |

## Deduplication

`lib/grants/dedup.js` — Strategy:

- External ID = `provider:providerOpportunityId` (e.g., `grants-gov:219999`)
- Idempotent upsert: existing records are updated, not duplicated
- Source-controlled fields are overwritten from the provider
- Human-decided fields (`adminNotes`, `status`, `aceInstanceId`, etc.) are never overwritten

## Screening Rules

`lib/grants/screening.js` — Deterministic, source-derived rules:

### Hard Failures (rejection)

1. **Applicant type** — Explicitly excludes nonprofits, or limited to government/tribal/education only
2. **Deadline** — Application deadline has passed
3. **Geography** — Restrictive language excluding Iowa

### Unknown (human review required)

1. **Applicant type** — No applicant type data available
2. **Deadline** — No deadline provided or unparseable
3. **Geography** — No geographic restriction data
4. **Cost sharing** — Unknown or source indicates required

### Relevance Assessment

Keywords checked against synopsis/description:
`amputees`, `limb difference`, `disability`, `accessibility`, `mobility`, `transportation`, `independence`, `peer support`, `community health`, `rehabilitation`, `prosthetics`, `adaptive recreation`, `veterans`, `wheelchair`, `adaptive`

### Overall Status Logic

- `rejected` — Any hard failure
- `needs-review` — All unknowns, or moderate relevance
- `potential-match` — 3+ relevance keyword matches

## ACE Promotion Boundary

`lib/grants/intelligence.js` — `promoteToAce()`:

1. Validates opportunity exists and hasn't been promoted
2. Builds creation values for the `pursue-grant` workflow's `opportunity` section
3. Maps: title → `grant_name`, agency → `funder`, ALN title → `funding_program`, URL → `opportunity_url`, opportunity number → `opportunity_source`, today → `date_identified`, closing date → `application_deadline`
4. Returns creation values and idempotency key
5. API handler calls `createInstance()` from the existing ACE engine
6. Stores relationship: `opportunity.aceInstanceId = instance.id`
7. Marks opportunity as `promoted`

**The ACE Grant Lifecycle remains unchanged.** The intelligence subsystem ends where ACE begins.

## API Endpoints

All actions on `/api/admin?action=...`:

| Action | Method | Description |
|--------|--------|-------------|
| `grant-intelligence-list` | GET | List opportunities with filters, pagination, sorting |
| `grant-intelligence-detail` | GET | Get single opportunity by external ID |
| `grant-intelligence-fetch-details` | GET | Fetch full details from provider |
| `grant-intelligence-sync` | POST | Synchronize with Grants.gov |
| `grant-intelligence-review` | POST | Review: reject or keep for review |
| `grant-intelligence-promote` | POST | Promote into ACE Grant Lifecycle |

All require admin authentication.

### List Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Comma-separated statuses: `new`, `potential-match`, `needs-review`, `rejected`, `promoted` |
| `q` | string | Search title, number, agency, ALN, synopsis |
| `deadline_soon` | number | Deadline within N days: `7`, `30`, `60`, `90` |
| `sort` | string | Sort order: `relevance` (default), `deadline-asc`, `deadline-desc`, `amount-desc`, `amount-asc`, `title`, `agency`, `newest`, `updated` |
| `page` | number | Page number (default: 1) |
| `page_size` | number | Results per page (default: 25, max: 100) |
| `agency` | string | Filter by agency name substring |
| `cost_share` | string | Filter: `required`, `none`, `unknown` |

### List Response

```json
{
  "opportunities": [...],
  "counts": { "all": 900, "new": 50, "potential-match": 42, "needs-review": 10, "rejected": 3, "promoted": 2, "closingSoon": 8 },
  "pagination": { "page": 1, "pageSize": 25, "total": 42, "totalPages": 2 },
  "lastSync": { "lastRun": "...", "stats": {...}, "state": "..." }
}

## Synchronization

- Manual trigger: "Sync Grants Now" button in admin UI
- Searches Grants.gov for posted opportunities
- Upserts into `llr:grant-opportunities` (cap: 2000)
- Runs screening on all opportunities
- State tracked in `llr:grant-sync-state`
- KV lock prevents concurrent syncs
- No automated cron — manual only per directive

## Security

- All endpoints require admin key authentication
- No public exposure of Grant Intelligence
- No provider credentials stored (Grants.gov requires none)
- Raw API responses not persisted
- Admin notes stay server-side only
- Standard LLR data handling and audit practices

## Troubleshooting

- **Sync fails:** Check network connectivity to `api.grants.gov`. Existing grant records are not modified on failure.
- **No opportunities appear:** Try broader search terms. Grants.gov may have limited posted opportunities for the given filters.
- **Screening shows all unknowns:** This is expected when source data is sparse. Human review is required.
- **Promotion fails:** Ensure the opportunity hasn't already been promoted (duplicate check).

## Future Provider Integration

To add a new provider (e.g., SAM.gov):

1. Create `lib/grants/<provider>.js` extending `GrantProvider`
2. Implement `search()`, `fetchDetails()`, and normalization
3. Register in `lib/grants/intelligence.js`
4. Add API action for triggering the new provider
5. No changes needed to screening or ACE integration
