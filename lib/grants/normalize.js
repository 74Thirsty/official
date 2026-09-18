/**
 * @file        normalize.js
 * @description Grant data normalization
 * @project     Lost Limb Riders (lostlimbriders.org)
 * @author      C. Hirschauer
 * @copyright   Copyright (c) 2026 C. Hirschauer. All rights reserved.
 * @license     Proprietary. No unauthorized reproduction or distribution.
 */
function parseDate(str) {
  if (!str || typeof str !== 'string') return null;
  const trimmed = str.trim();
  if (!trimmed) return null;
  const mdy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const d = new Date(trimmed);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function parseMoney(str) {
  if (str == null) return null;
  const s = typeof str === 'string' ? str : String(str);
  const cleaned = s.replace(/[^0-9.\-]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function pick(...vals) {
  for (const v of vals) {
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
}

export function normalizeSearchHit(hit) {
  return {
    provider: 'grants-gov',
    providerOpportunityId: String(hit.id || ''),
    opportunityNumber: hit.number || null,
    title: hit.title || null,
    issuingAgency: hit.agencyName || null,
    agencyCode: hit.agencyCode || null,
    opportunityStatus: hit.oppStatus || null,
    postingDate: parseDate(hit.openDate),
    closingDate: parseDate(hit.closeDate),
    assistanceListings: Array.isArray(hit.alnist) ? hit.alnist : [],
    docType: hit.docType || null,
  };
}

export function normalizeDetailResponse(detail, searchHit) {
  const synopsis = detail.synopsis || {};
  const forecast = detail.forecast || {};
  const source = (synopsis.agencyName || synopsis.synopsisDesc || synopsis.applicantTypes) ? synopsis : forecast;
  const applicantTypes = (source.applicantTypes || []).map((t) => ({
    id: t.id || null,
    description: t.description || null,
  }));
  const fundingInstruments = (source.fundingInstruments || []).map((t) => ({
    id: t.id || null,
    description: t.description || null,
  }));
  const fundingCategories = (source.fundingActivityCategories || []).map((t) => ({
    id: t.id || null,
    description: t.description || null,
  }));
  const alns = (detail.alns || []).map((a) => ({
    number: a.alnNumber || null,
    title: a.programTitle || null,
  }));
  const category = detail.opportunityCategory || null;
  const attachments = [];
  for (const folder of (detail.synopsisAttachmentFolders || [])) {
    for (const att of (folder.synopsisAttachments || [])) {
      attachments.push({
        id: att.id || null,
        fileName: att.fileName || null,
        mimeType: att.mimeType || null,
        description: att.fileDescription || null,
        size: att.fileLobSize || 0,
      });
    }
  }

  return {
    provider: 'grants-gov',
    providerOpportunityId: String(detail.id || ''),
    opportunityNumber: detail.opportunityNumber || (searchHit && searchHit.number) || null,
    title: detail.opportunityTitle || (searchHit && searchHit.title) || null,
    issuingAgency: synopsis.agencyName || (searchHit && searchHit.agencyName) || null,
    agencyCode: synopsis.agencyCode || (searchHit && searchHit.agencyCode) || null,
    issuingOffice: null,
    assistanceListings: alns,
    opportunityStatus: (searchHit && searchHit.oppStatus) || null,
    opportunityCategory: category ? { category: category.category, description: category.description } : null,
    postingDate: parseDate(synopsis.postingDate || synopsis.postingDateStr),
    openingDate: parseDate(synopsis.postingDate || synopsis.postingDateStr),
    closingDate: parseDate(synopsis.responseDateDesc || (searchHit && searchHit.closeDate)),
    archiveDate: null,
    fundingInstrument: fundingInstruments,
    fundingCategory: fundingCategories,
    eligibility: {
      applicantTypes,
      description: null,
    },
    geographicRestrictions: null,
    awardCeiling: parseMoney(synopsis.awardCeiling),
    awardFloor: parseMoney(synopsis.awardFloor),
    estimatedTotalFunding: null,
    expectedNumberOfAwards: null,
    costSharing: synopsis.costSharing || false,
    synopsis: synopsis.synopsisDesc || null,
    programDescription: synopsis.synopsisDesc || null,
    contactInfo: {
      name: synopsis.agencyContactName || null,
      email: synopsis.agencyContactEmail || null,
      phone: synopsis.agencyContactPhone || null,
      description: synopsis.agencyContactDesc || null,
    },
    officialSourceUrl: `https://www.grants.gov/search-results-detail/${detail.id}`,
    attachments,
    rawHash: null,
  };
}

export function mergeNormalized(existing, fresh) {
  const merged = { ...existing };
  const sourceControlled = [
    'opportunityNumber', 'title', 'issuingAgency', 'agencyCode', 'issuingOffice',
    'opportunityStatus', 'opportunityCategory', 'postingDate', 'openingDate',
    'closingDate', 'archiveDate', 'fundingInstrument', 'fundingCategory',
    'eligibility', 'geographicRestrictions', 'awardCeiling', 'awardFloor',
    'estimatedTotalFunding', 'expectedNumberOfAwards', 'costSharing',
    'synopsis', 'programDescription', 'contactInfo', 'officialSourceUrl',
    'assistanceListings', 'attachments',
  ];
  for (const key of sourceControlled) {
    if (fresh[key] !== undefined) merged[key] = fresh[key];
  }
  merged.retrievedAt = fresh.retrievedAt || existing.retrievedAt || new Date().toISOString();
  if (fresh.rawHash) merged.rawHash = fresh.rawHash;
  return merged;
}
