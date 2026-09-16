import { GrantsGovProvider } from './grants-gov.js';
import { normalizeSearchHit, normalizeDetailResponse, mergeNormalized } from './normalize.js';
import { buildExternalId, findExisting, upsertOpportunity } from './dedup.js';
import { screenOpportunity } from './screening.js';

const provider = new GrantsGovProvider();

export function buildSearchParams(raw) {
  return {
    keyword: raw.keyword || '',
    oppNum: raw.oppNum || '',
    aln: raw.aln || '',
    agencies: raw.agencies || '',
    oppStatuses: raw.oppStatuses || 'posted',
    eligibilities: raw.eligibilities || '',
    fundingCategories: raw.fundingCategories || '',
    fundingInstruments: raw.fundingInstruments || '',
    rows: Math.min(Math.max(Number(raw.rows) || 25, 1), 100),
    startRecordNum: Math.max(Number(raw.startRecordNum) || 0, 0),
  };
}

export async function searchGrants(params, signal) {
  const searchParams = buildSearchParams(params);
  const result = await provider.search({ ...searchParams, signal });
  const hits = (result.hits || []).map(normalizeSearchHit);
  return {
    hitCount: result.hitCount,
    startRecord: result.startRecord,
    rows: result.rows,
    hits,
    facets: result.facets,
  };
}

export async function fetchGrantDetails(opportunityId, signal) {
  const raw = await provider.fetchDetails(opportunityId, signal);
  return normalizeDetailResponse(raw);
}

export function mergeSearchAndDetail(searchHit, detail) {
  const normalized = normalizeDetailResponse(detail, searchHit);
  return normalized;
}

export async function syncOpportunities(opportunities, existingList, signal) {
  const stats = { newCount: 0, updatedCount: 0, unchangedCount: 0, errorCount: 0, errors: [] };
  for (const hit of opportunities) {
    try {
      const fresh = normalizeSearchHit(hit);
      const result = upsertOpportunity(existingList, fresh, mergeNormalized);
      if (result.isNew) {
        stats.newCount++;
      } else {
        stats.updatedCount++;
      }
    } catch (err) {
      stats.errorCount++;
      stats.errors.push({ opportunityId: hit.id, error: err.message });
    }
  }
  return stats;
}

export function runScreening(opportunities) {
  for (const opp of opportunities) {
    if (opp.status === 'promoted' || opp.status === 'rejected') continue;
    opp.screening = screenOpportunity(opp);
    opp.status = opp.screening.overallStatus;
  }
  return opportunities;
}

export function reviewOpportunity(opportunities, externalId, decision, notes) {
  const opp = findExisting(opportunities, externalId);
  if (!opp) return null;
  opp.adminNotes = notes || opp.adminNotes || '';
  if (decision === 'reject') {
    opp.status = 'rejected';
  } else if (decision === 'keep') {
    opp.status = 'needs-review';
  }
  opp.reviewedAt = new Date().toISOString();
  opp.updatedAt = opp.reviewedAt;
  return opp;
}

export function promoteToAce(opportunities, externalId) {
  const opp = findExisting(opportunities, externalId);
  if (!opp) return { error: 'Opportunity not found.' };
  if (opp.aceInstanceId) return { error: 'This opportunity has already been promoted to ACE.' };
  if (opp.status === 'rejected') return { error: 'Cannot promote a rejected opportunity.' };

  const now = new Date().toISOString();
  const creationValues = buildAceCreationValues(opp);

  opp.aceStatus = 'pending';
  opp.updatedAt = now;

  return {
    opportunity: opp,
    creationValues,
    workflowId: 'pursue-grant',
    idempotencyKey: `grant-intel-${opp.externalId.replace(/[^A-Za-z0-9]/g, '').slice(0, 40)}-${Date.now().toString(36)}`,
  };
}

function buildAceCreationValues(opp) {
  const deadline = opp.closingDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return {
    grant_name: (opp.title || 'Untitled Grant').slice(0, 140),
    funder: (opp.issuingAgency || 'Unknown Funder').slice(0, 120),
    funding_program: (opp.assistanceListings?.[0]?.title || '').slice(0, 120) || undefined,
    opportunity_url: (opp.officialSourceUrl || '').slice(0, 500) || undefined,
    opportunity_source: `Grants.gov (${opp.opportunityNumber || opp.providerOpportunityId})`,
    date_identified: new Date().toISOString().slice(0, 10),
    application_deadline: deadline,
  };
}

export function filterOpportunities(opportunities, filters = {}) {
  let list = [...opportunities];

  if (filters.status) {
    const statuses = filters.status.split(',').map((s) => s.trim().toLowerCase());
    list = list.filter((o) => statuses.includes((o.status || '').toLowerCase()));
  }
  if (filters.provider) {
    list = list.filter((o) => o.provider === filters.provider);
  }
  if (filters.agency) {
    const a = filters.agency.toLowerCase();
    list = list.filter((o) => (o.issuingAgency || '').toLowerCase().includes(a));
  }
  if (filters.search) {
    const s = filters.search.toLowerCase();
    list = list.filter((o) =>
      (o.title || '').toLowerCase().includes(s) ||
      (o.opportunityNumber || '').toLowerCase().includes(s) ||
      (o.issuingAgency || '').toLowerCase().includes(s) ||
      (o.assistanceListings || []).some((a) => (a.number || '').includes(s) || (a.title || '').toLowerCase().includes(s))
    );
  }
  if (filters.deadlineBefore) {
    const d = new Date(filters.deadlineBefore);
    list = list.filter((o) => o.closingDate && new Date(o.closingDate) <= d);
  }
  if (filters.deadlineAfter) {
    const d = new Date(filters.deadlineAfter);
    list = list.filter((o) => o.closingDate && new Date(o.closingDate) >= d);
  }

  list.sort((a, b) => {
    if (a.closingDate && b.closingDate) return a.closingDate.localeCompare(b.closingDate);
    if (a.closingDate) return -1;
    if (b.closingDate) return 1;
    return (a.createdAt || '').localeCompare(b.createdAt || '');
  });

  return list;
}
