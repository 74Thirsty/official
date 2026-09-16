import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { normalizeSearchHit, normalizeDetailResponse, mergeNormalized } from '../lib/grants/normalize.js';
import { buildExternalId, findExisting, upsertOpportunity } from '../lib/grants/dedup.js';
import { screenOpportunity } from '../lib/grants/screening.js';
import { GrantsGovProvider } from '../lib/grants/grants-gov.js';
import { mergeSearchAndDetail, filterOpportunities, buildSearchParams } from '../lib/grants/intelligence.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// --- Provider Tests ---

test('GrantsGovProvider declares id and name', () => {
  const p = new GrantsGovProvider();
  assert.equal(p.id, 'grants-gov');
  assert.equal(p.name, 'Grants.gov');
});

test('buildSearchParams returns defaults', () => {
  const p = buildSearchParams({});
  assert.equal(p.keyword, '');
  assert.equal(p.oppStatuses, 'posted');
  assert.equal(p.rows, 25);
  assert.equal(p.startRecordNum, 0);
});

test('buildSearchParams passes through values', () => {
  const p = buildSearchParams({ keyword: 'disability', rows: 50, oppStatuses: 'posted|closed' });
  assert.equal(p.keyword, 'disability');
  assert.equal(p.rows, 50);
  assert.equal(p.oppStatuses, 'posted|closed');
});

test('buildSearchParams clamps rows', () => {
  assert.equal(buildSearchParams({ rows: 0 }).rows, 25);
  assert.equal(buildSearchParams({ rows: 200 }).rows, 100);
  assert.equal(buildSearchParams({ rows: -5 }).rows, 1);
});

// --- Normalization Tests ---

test('normalizeSearchHit maps fields correctly', () => {
  const hit = {
    id: '12345',
    number: 'PA-25-245',
    title: 'Test Grant',
    agencyName: 'Health & Human Services',
    agencyCode: 'HHS',
    oppStatus: 'posted',
    openDate: '09/15/2026',
    closeDate: '12/31/2026',
    docType: 'synopsis',
    alnist: ['93.223', '93.866'],
  };
  const result = normalizeSearchHit(hit);
  assert.equal(result.provider, 'grants-gov');
  assert.equal(result.providerOpportunityId, '12345');
  assert.equal(result.opportunityNumber, 'PA-25-245');
  assert.equal(result.title, 'Test Grant');
  assert.equal(result.issuingAgency, 'Health & Human Services');
  assert.equal(result.agencyCode, 'HHS');
  assert.equal(result.opportunityStatus, 'posted');
  assert.equal(result.postingDate, '2026-09-15');
  assert.equal(result.closingDate, '2026-12-31');
  assert.deepEqual(result.assistanceListings, ['93.223', '93.866']);
});

test('normalizeSearchHit handles missing fields', () => {
  const result = normalizeSearchHit({});
  assert.equal(result.provider, 'grants-gov');
  assert.equal(result.providerOpportunityId, '');
  assert.equal(result.opportunityNumber, null);
  assert.equal(result.title, null);
  assert.equal(result.issuingAgency, null);
  assert.equal(result.postingDate, null);
  assert.equal(result.closingDate, null);
  assert.deepEqual(result.assistanceListings, []);
});

test('normalizeSearchHit parses dates in MM/DD/YYYY format', () => {
  const hit = { id: '1', openDate: '01/05/2026', closeDate: '06/30/2026' };
  const result = normalizeSearchHit(hit);
  assert.equal(result.postingDate, '2026-01-05');
  assert.equal(result.closingDate, '2026-06-30');
});

test('normalizeDetailResponse maps synopsis fields', () => {
  const detail = {
    id: 99999,
    opportunityNumber: 'TEST-001',
    opportunityTitle: 'Detail Title',
    opportunityCategory: { category: 'D', description: 'Discretionary' },
    synopsis: {
      agencyName: 'Test Agency',
      agencyCode: 'TA',
      synopsisDesc: 'A test description.',
      postingDate: 'Sep 10, 2026 12:00:00 AM EDT',
      responseDateDesc: '12/15/2026',
      awardCeiling: '500000',
      awardFloor: '50000',
      costSharing: false,
      applicantTypes: [{ id: '20', description: 'Nonprofit organizations' }],
      fundingInstruments: [{ id: 'G', description: 'Grant' }],
      fundingActivityCategories: [{ id: 'HL', description: 'Health' }],
      agencyContactName: 'Jane Doe',
      agencyContactEmail: 'jane@test.gov',
      agencyContactPhone: '555-1234',
    },
    alns: [{ alnNumber: '93.223', programTitle: 'Rural Health' }],
    synopsisAttachmentFolders: [],
  };
  const result = normalizeDetailResponse(detail);
  assert.equal(result.providerOpportunityId, '99999');
  assert.equal(result.opportunityNumber, 'TEST-001');
  assert.equal(result.title, 'Detail Title');
  assert.equal(result.issuingAgency, 'Test Agency');
  assert.equal(result.synopsis, 'A test description.');
  assert.equal(result.awardCeiling, 500000);
  assert.equal(result.awardFloor, 50000);
  assert.equal(result.costSharing, false);
  assert.equal(result.eligibility.applicantTypes[0].description, 'Nonprofit organizations');
  assert.equal(result.fundingInstrument[0].description, 'Grant');
  assert.equal(result.fundingCategory[0].description, 'Health');
  assert.equal(result.assistanceListings[0].number, '93.223');
  assert.equal(result.contactInfo.name, 'Jane Doe');
  assert.equal(result.contactInfo.email, 'jane@test.gov');
  assert.equal(result.officialSourceUrl, 'https://www.grants.gov/search-results-detail/99999');
});

test('normalizeDetailResponse handles missing fields as null', () => {
  const result = normalizeDetailResponse({ id: 1 });
  assert.equal(result.synopsis, null);
  assert.equal(result.awardCeiling, null);
  assert.equal(result.awardFloor, null);
  assert.equal(result.costSharing, false);
  assert.deepEqual(result.eligibility.applicantTypes, []);
  assert.deepEqual(result.assistanceListings, []);
});

test('mergeNormalized updates source-controlled fields', () => {
  const existing = {
    provider: 'grants-gov',
    providerOpportunityId: '123',
    title: 'Old Title',
    closingDate: '2026-01-01',
    adminNotes: 'my notes',
    status: 'needs-review',
    retrievedAt: '2026-09-01T00:00:00.000Z',
  };
  const fresh = {
    provider: 'grants-gov',
    providerOpportunityId: '123',
    title: 'New Title',
    closingDate: '2026-06-01',
  };
  const result = mergeNormalized(existing, fresh);
  assert.equal(result.title, 'New Title');
  assert.equal(result.closingDate, '2026-06-01');
  assert.equal(result.adminNotes, 'my notes');
  assert.ok(result.retrievedAt, 'retrievedAt should be set');
});

// --- Deduplication Tests ---

test('buildExternalId returns provider:id', () => {
  assert.equal(buildExternalId({ provider: 'grants-gov', providerOpportunityId: '123' }), 'grants-gov:123');
});

test('findExisting finds matching record', () => {
  const list = [
    { externalId: 'grants-gov:100' },
    { externalId: 'grants-gov:200' },
  ];
  assert.equal(findExisting(list, 'grants-gov:200'), list[1]);
  assert.equal(findExisting(list, 'grants-gov:999'), null);
});

test('upsertOpportunity creates new record', () => {
  const list = [];
  const fresh = { provider: 'grants-gov', providerOpportunityId: '500', title: 'Test' };
  const { record, isNew } = upsertOpportunity(list, fresh, mergeNormalized);
  assert.equal(isNew, true);
  assert.equal(record.externalId, 'grants-gov:500');
  assert.equal(record.status, 'new');
  assert.equal(record.screening, null);
  assert.equal(record.adminNotes, '');
  assert.equal(record.aceInstanceId, null);
});

test('upsertOpportunity updates existing record and preserves human notes', () => {
  const list = [
    {
      externalId: 'grants-gov:500',
      provider: 'grants-gov',
      providerOpportunityId: '500',
      title: 'Old Title',
      adminNotes: 'Important note',
      status: 'needs-review',
      createdAt: '2026-09-01T00:00:00.000Z',
    },
  ];
  const fresh = { provider: 'grants-gov', providerOpportunityId: '500', title: 'New Title' };
  const { record, isNew } = upsertOpportunity(list, fresh, mergeNormalized);
  assert.equal(isNew, false);
  assert.equal(record.title, 'New Title');
  assert.equal(record.adminNotes, 'Important note');
  assert.equal(record.status, 'needs-review');
});

// --- Screening Tests ---

test('screenOpportunity rejects expired deadline', () => {
  const opp = {
    closingDate: '2020-01-01',
    eligibility: { applicantTypes: [{ id: '20', description: 'Nonprofit organizations' }] },
    costSharing: false,
    geographicRestrictions: '',
    synopsis: 'test',
  };
  const result = screenOpportunity(opp);
  const deadlineCheck = result.hardFails.find((f) => f.rule === 'deadline');
  assert.ok(deadlineCheck, 'deadline hard fail should exist');
  assert.match(deadlineCheck.reason, /passed/);
});

test('screenOpportunity passes future deadline', () => {
  const futureDate = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
  const opp = {
    closingDate: futureDate,
    eligibility: { applicantTypes: [{ id: '20', description: 'Nonprofit organizations' }] },
    costSharing: false,
    geographicRestrictions: '',
    synopsis: 'test',
  };
  const result = screenOpportunity(opp);
  const deadlineCheck = result.checks.find((c) => c.rule === 'deadline');
  assert.ok(deadlineCheck, 'deadline pass should exist');
  assert.match(deadlineCheck.reason, /day/);
});

test('screenOpportunity rejects government-only applicant types', () => {
  const opp = {
    closingDate: '2030-12-31',
    eligibility: { applicantTypes: [{ id: '01', description: 'County governments' }] },
    costSharing: false,
    geographicRestrictions: '',
    synopsis: 'test',
  };
  const result = screenOpportunity(opp);
  const typeCheck = result.hardFails.find((f) => f.rule === 'applicant-type');
  assert.ok(typeCheck, 'applicant-type hard fail should exist');
  assert.match(typeCheck.reason, /INELIGIBLE/);
});

test('screenOpportunity passes nonprofit applicant types', () => {
  const opp = {
    closingDate: '2030-12-31',
    eligibility: { applicantTypes: [{ id: '20', description: 'Nonprofit organizations' }] },
    costSharing: false,
    geographicRestrictions: '',
    synopsis: 'test about amputees and mobility',
  };
  const result = screenOpportunity(opp);
  assert.equal(result.hardFails.length, 0);
  const typeCheck = result.checks.find((c) => c.rule === 'applicant-type');
  assert.ok(typeCheck, 'applicant-type pass should exist');
});

test('screenOpportunity returns unknown when applicant types missing', () => {
  const opp = {
    closingDate: '2030-12-31',
    eligibility: { applicantTypes: [] },
    costSharing: false,
    geographicRestrictions: '',
    synopsis: 'test',
  };
  const result = screenOpportunity(opp);
  const typeCheck = result.unknowns.find((u) => u.rule === 'applicant-type');
  assert.ok(typeCheck, 'applicant-type unknown should exist');
});

test('screenOpportunity detects mission relevance', () => {
  const opp = {
    closingDate: '2030-12-31',
    eligibility: { applicantTypes: [{ id: '20', description: 'Nonprofit organizations' }] },
    costSharing: false,
    geographicRestrictions: '',
    synopsis: 'Support for amputees with mobility and accessibility needs including prosthetics and adaptive recreation.',
  };
  const result = screenOpportunity(opp);
  assert.ok(result.relevances.length >= 3, 'should have multiple relevance hits');
  assert.ok(result.relevances.includes('amputees'));
  assert.ok(result.relevances.includes('mobility'));
  assert.ok(result.relevances.includes('accessibility'));
});

test('screenOpportunity flags geography unknown when no data', () => {
  const opp = {
    closingDate: '2030-12-31',
    eligibility: { applicantTypes: [{ id: '20', description: 'Nonprofit organizations' }] },
    costSharing: false,
    geographicRestrictions: '',
    synopsis: 'test',
  };
  const result = screenOpportunity(opp);
  const geoCheck = result.unknowns.find((u) => u.rule === 'geography');
  assert.ok(geoCheck, 'geography unknown should exist');
});

test('screenOpportunity rejects incompatible geography', () => {
  const opp = {
    closingDate: '2030-12-31',
    eligibility: { applicantTypes: [{ id: '20', description: 'Nonprofit organizations' }] },
    costSharing: false,
    geographicRestrictions: 'Restricted to California only',
    synopsis: 'test',
  };
  const result = screenOpportunity(opp);
  const geoCheck = result.hardFails.find((f) => f.rule === 'geography');
  assert.ok(geoCheck, 'geography hard fail should exist');
  assert.match(geoCheck.reason, /INELIGIBLE/);
});

test('screenOpportunity detects cost sharing required', () => {
  const opp = {
    closingDate: '2030-12-31',
    eligibility: { applicantTypes: [{ id: '20', description: 'Nonprofit organizations' }] },
    costSharing: true,
    geographicRestrictions: '',
    synopsis: 'test',
  };
  const result = screenOpportunity(opp);
  const csCheck = result.unknowns.find((u) => u.rule === 'cost-sharing');
  assert.ok(csCheck, 'cost-sharing unknown should exist');
  assert.match(csCheck.reason, /cost sharing/);
});

// --- mergeSearchAndDetail ---

test('mergeSearchAndDetail combines search and detail data', () => {
  const searchHit = { id: '123', number: 'PA-25-245', title: 'Search Title', docType: 'synopsis' };
  const rawDetail = {
    id: 123,
    opportunityNumber: 'PA-25-245',
    opportunityTitle: 'Detail Title',
    synopsis: {
      agencyName: 'Health & Human Services',
      agencyCode: 'HHS',
      synopsisDesc: 'Test description',
    },
    alns: [{ alnNumber: '93.223', programTitle: 'Rural Health' }],
    synopsisAttachmentFolders: [],
  };
  const result = mergeSearchAndDetail(searchHit, rawDetail);
  assert.equal(result.title, 'Detail Title');
  assert.equal(result.issuingAgency, 'Health & Human Services');
  assert.equal(result.assistanceListings[0].number, '93.223');
});

// --- filterOpportunities ---

test('filterOpportunities filters by status', () => {
  const opps = [
    { status: 'new', title: 'A' },
    { status: 'potential-match', title: 'B' },
    { status: 'new', title: 'C' },
    { status: 'rejected', title: 'D' },
  ];
  const result = filterOpportunities(opps, { status: 'new' });
  assert.equal(result.length, 2);
  assert.ok(result.every((o) => o.status === 'new'));
});

test('filterOpportunities filters by search text', () => {
  const opps = [
    { title: 'Health Grant', opportunityNumber: 'PA-001', issuingAgency: 'HHS', assistanceListings: [], status: 'new' },
    { title: 'Education Fund', opportunityNumber: 'ED-001', issuingAgency: 'Dept of Ed', assistanceListings: [], status: 'new' },
  ];
  const result = filterOpportunities(opps, { search: 'health' });
  assert.equal(result.length, 1);
  assert.equal(result[0].title, 'Health Grant');
});

test('filterOpportunities sorts by closing date', () => {
  const opps = [
    { closingDate: '2026-12-31', status: 'new' },
    { closingDate: '2026-06-01', status: 'new' },
    { closingDate: null, status: 'new' },
  ];
  const result = filterOpportunities(opps, {});
  assert.equal(result[0].closingDate, '2026-06-01');
  assert.equal(result[1].closingDate, '2026-12-31');
  assert.equal(result[2].closingDate, null);
});

// --- Admin HTML Tests ---

test('admin.html contains Grant Intelligence tab', () => {
  const html = readFileSync(join(root, 'admin.html'), 'utf8');
  assert.ok(html.includes('switchTab(\'grant-intel\''), 'Grant Intelligence tab menu item');
  assert.ok(html.includes('id="panel-grant-intel"'), 'Grant Intelligence panel');
  assert.ok(html.includes('giSyncNow'), 'Sync button handler');
  assert.ok(html.includes('giOpenDetail'), 'Detail view handler');
  assert.ok(html.includes('giPromote'), 'Promote handler');
  assert.ok(html.includes('giReject'), 'Reject handler');
  assert.ok(html.includes('giLoadList'), 'List loading');
});

test('admin.html Grant Intelligence panel has required UI elements', () => {
  const html = readFileSync(join(root, 'admin.html'), 'utf8');
  assert.ok(html.includes('id="giSearch"'), 'search input');
  assert.ok(html.includes('id="giStatusFilter"'), 'status filter');
  assert.ok(html.includes('id="giDetailModal"'), 'detail modal');
  assert.ok(html.includes('id="giScreeningContent"'), 'screening display');
  assert.ok(html.includes('id="giDetailNotes"'), 'admin notes textarea');
  assert.ok(html.includes('id="giPromoteBtn"'), 'promote button');
  assert.ok(html.includes('id="giRejectBtn"'), 'reject button');
  assert.ok(html.includes('id="giKeepBtn"'), 'keep button');
});
