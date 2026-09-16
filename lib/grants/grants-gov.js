import { GrantProvider } from './provider.js';

const BASE = 'https://api.grants.gov';
const SEARCH_URL = `${BASE}/v1/api/search2`;
const FETCH_URL = `${BASE}/v1/api/fetchOpportunity`;

const DEFAULT_ROWS = 25;
const MAX_ROWS = 100;

export class GrantsGovProvider extends GrantProvider {
  get id() { return 'grants-gov'; }
  get name() { return 'Grants.gov'; }

  async search(params = {}) {
    const body = {
      keyword: params.keyword || '',
      oppNum: params.oppNum || '',
      aln: params.aln || '',
      agencies: params.agencies || '',
      oppStatuses: params.oppStatuses || '',
      eligibilities: params.eligibilities || '',
      fundingCategories: params.fundingCategories || '',
      fundingInstruments: params.fundingInstruments || '',
      rows: Math.min(params.rows || DEFAULT_ROWS, MAX_ROWS),
      startRecordNum: params.startRecordNum || 0,
      sortBy: params.sortBy || '',
      resultType: 'json',
    };
    if (params.searchOnly) body.searchOnly = true;

    const res = await fetch(SEARCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: params.signal,
    });
    if (!res.ok) throw new Error(`Grants.gov search failed: HTTP ${res.status}`);
    const json = await res.json();
    if (json.errorcode !== 0) throw new Error(`Grants.gov search error: ${json.msg || 'unknown'}`);
    return {
      hitCount: json.data?.hitCount || 0,
      startRecord: json.data?.startRecord || 0,
      rows: json.data?.searchParams?.rows || body.rows,
      hits: json.data?.oppHits || [],
      facets: {
        oppStatusOptions: json.data?.oppStatusOptions || [],
        eligibilities: json.data?.eligibilities || [],
        fundingCategories: json.data?.fundingCategories || [],
        fundingInstruments: json.data?.fundingInstruments || [],
        agencies: json.data?.agencies || [],
      },
    };
  }

  async fetchDetails(opportunityId, signal) {
    const numericId = Number(opportunityId);
    if (!Number.isFinite(numericId) || numericId <= 0) throw new Error('Invalid opportunity ID.');
    const res = await fetch(FETCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opportunityId: numericId }),
      signal,
    });
    if (!res.ok) throw new Error(`Grants.gov detail fetch failed: HTTP ${res.status}`);
    const json = await res.json();
    if (json.errorcode !== 0) throw new Error(`Grants.gov detail error: ${json.msg || 'unknown'}`);
    return json.data || {};
  }
}
