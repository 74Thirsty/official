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

export function computeCounts(opportunities) {
  const counts = { all: opportunities.length, new: 0, 'potential-match': 0, 'needs-review': 0, rejected: 0, promoted: 0, closingSoon: 0 };
  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 86400000);
  for (const opp of opportunities) {
    const s = opp.status || 'new';
    if (counts[s] !== undefined) counts[s]++;
    if (opp.closingDate && s !== 'rejected' && s !== 'promoted') {
      const close = new Date(opp.closingDate);
      if (Number.isFinite(close.getTime()) && close > now && close <= thirtyDays) counts.closingSoon++;
    }
  }
  return counts;
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
      (o.assistanceListings || []).some((a) => (a.number || '').includes(s) || (a.title || '').toLowerCase().includes(s)) ||
      (o.synopsis || '').toLowerCase().includes(s)
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
  if (filters.deadlineSoon) {
    const days = Number(filters.deadlineSoon);
    if (Number.isFinite(days) && days > 0) {
      const now = new Date();
      const cutoff = new Date(now.getTime() + days * 86400000);
      list = list.filter((o) => {
        if (!o.closingDate) return false;
        const close = new Date(o.closingDate);
        return Number.isFinite(close.getTime()) && close > now && close <= cutoff;
      });
    }
  }
  if (filters.costShare) {
    const v = filters.costShare.toLowerCase();
    if (v === 'required') list = list.filter((o) => o.costSharing === true);
    else if (v === 'none' || v === 'not-required') list = list.filter((o) => o.costSharing === false);
    else if (v === 'unknown') list = list.filter((o) => o.costSharing !== true && o.costSharing !== false);
  }
  if (filters.fundingCategory) {
    const fc = filters.fundingCategory.toLowerCase();
    list = list.filter((o) => (o.fundingCategory || []).some((c) => (c.description || '').toLowerCase().includes(fc)));
  }
  if (filters.fundingInstrument) {
    const fi = filters.fundingInstrument.toLowerCase();
    list = list.filter((o) => (o.fundingInstrument || []).some((i) => (i.description || '').toLowerCase().includes(fi)));
  }

  const sort = filters.sort || 'deadline-asc';
  list.sort((a, b) => {
    switch (sort) {
      case 'deadline-asc':
        if (a.closingDate && b.closingDate) return a.closingDate.localeCompare(b.closingDate);
        if (a.closingDate) return -1;
        if (b.closingDate) return 1;
        return 0;
      case 'deadline-desc':
        if (a.closingDate && b.closingDate) return b.closingDate.localeCompare(a.closingDate);
        if (a.closingDate) return 1;
        if (b.closingDate) return -1;
        return 0;
      case 'title':
        return (a.title || '').localeCompare(b.title || '');
      case 'agency':
        return (a.issuingAgency || '').localeCompare(b.issuingAgency || '');
      case 'amount-desc': {
        const ca = a.awardCeiling || 0;
        const cb = b.awardCeiling || 0;
        return cb - ca;
      }
      case 'amount-asc': {
        const sa = a.awardCeiling || 0;
        const sb = b.awardCeiling || 0;
        return sa - sb;
      }
      case 'newest':
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      case 'updated':
        return (b.updatedAt || '').localeCompare(a.updatedAt || '');
      case 'relevance': {
        const ra = (a.screening?.relevances || []).length;
        const rb = (b.screening?.relevances || []).length;
        if (rb !== ra) return rb - ra;
        if (a.closingDate && b.closingDate) return a.closingDate.localeCompare(b.closingDate);
        return 0;
      }
      default:
        return 0;
    }
  });

  return list;
}

export function paginateResults(list, page, pageSize) {
  const total = list.length;
  const size = Math.min(Math.max(Number(pageSize) || 25, 1), 100);
  const totalPages = Math.max(1, Math.ceil(total / size));
  const p = Math.min(Math.max(Number(page) || 1, 1), totalPages);
  const start = (p - 1) * size;
  const items = list.slice(start, start + size);
  return { items, page: p, pageSize: size, total, totalPages };
}
