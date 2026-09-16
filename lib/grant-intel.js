// Grant Intelligence — the application-preparation assistant.
//
// DISCOVER -> MATCH -> REVIEW OPPORTUNITY -> PREPARE APPLICATION -> HUMAN REVIEW -> HUMAN SUBMISSION
//
// Non-negotiable boundary: this module prepares. It never submits, never transmits,
// never certifies, never signs, and never represents anything on behalf of Lost Limb Riders.
// Every external submission remains a human action. The module has no send capability at all.
//
// Canonical organizational knowledge is read-only (mission.html section text and the
// document registry). Missing information is flagged ACTION REQUIRED — never invented.

export const OPP_STATUSES = Object.freeze([
  'discovered',
  'potential-match',
  'eligibility-review',
  'selected-for-application',
  'application-in-preparation',
  'human-review-required',
  'ready-for-submission',
  'submitted',
]);

export const APP_STATUSES = Object.freeze([
  'in-preparation',
  'human-review-required',
  'ready-for-submission',
  'submitted',
]);

// Source attribution for every answer (addendum §5).
export const SOURCE_TYPES = Object.freeze([
  'auto-populated',      // pulled verbatim from canonical organizational records
  'generated-draft',     // narrative drafted by the engine, grounded in org sources + funder question
  'administrator-entered', // supplied or corrected by an authorized administrator
  'action-required',     // missing information flagged for human supply — engine refused to guess
  'validation-error',    // present but failed a validation check
]);

export const MATCH_LEVELS = Object.freeze(['unlikely', 'possible', 'strong']);

// ---------------------------------------------------------------------------
// Organizational knowledge base (§1)
// ---------------------------------------------------------------------------

// Canonical facts derived from tracked in-repo public source (mission.html) and the
// document registry. These are authoritative and read-only. Values that are not
// verifiable here (budgets, financials, tax determination dates) live in the
// administrator-confirmed supplement store instead — never invented.
export const ORG_CORE_FACTS = Object.freeze({
  legal_name: {
    label: 'Legal organization name',
    value: 'Lost Limb Riders',
    source: 'Organization Info — mission.html (§ Closing)',
  },
  mission_statement: {
    label: 'Mission statement',
    value: 'Lost Limb Riders exists to provide hope, peer support, mentorship, education, and opportunity to amputees and people with disabilities.',
    source: 'Our Mission — mission.html (§ 2)',
  },
  belief: {
    label: 'Core belief',
    value: 'no one should have to navigate limb loss alone',
    source: 'Our Mission — mission.html (§ 2)',
  },
  tagline: {
    label: 'Tagline',
    value: 'Building Hope, Independence, and Community for Amputees and People with Disabilities',
    source: 'Organization Info — mission.html (§ Closing)',
  },
  address: {
    label: 'Mailing / physical address',
    value: '514 N 6th St, Fort Dodge, IA 50501',
    source: 'Organization Info — mission.html (§ Closing)',
  },
  phone: {
    label: 'Phone',
    value: '515-890-5765',
    source: 'Organization Info — mission.html (§ Closing)',
  },
  ein: {
    label: 'Employer Identification Number (EIN)',
    value: '42-4078619',
    source: 'Organization Info — mission.html (§ Employer Identification Number)',
  },
  founder: {
    label: 'Founder',
    value: 'John Thompson',
    source: 'Organization Info — mission.html (§ Closing)',
  },
  service_area: {
    label: 'Geographic service area',
    value: 'Iowa — Fort Dodge, Iowa',
    source: 'Organization Handbook (ORG-HBK-001) — authorized location',
  },
  population_served: {
    label: 'Population served',
    value: 'Amputees and people with disabilities and their families and caregivers; recent and long-term amputees; veterans and first responders living with limb differences; children and young people with limb differences',
    source: 'Our Mission — mission.html (§ We Serve)',
  },
  programs: {
    label: 'Programs',
    value: 'Peer Connection; Ride Forward; Hospital and Prosthetic Outreach; Housing and Independence Advocacy; Community Resource and Assistance; Family Support',
    source: 'Program/Area options — VOL-FORM-004 and volunteer program manuals',
  },
  vision: {
    label: 'Vision',
    value: 'An annual fundraising ride and community event in Iowa that brings together amputees, people with disabilities, motorcyclists, families, businesses, healthcare providers, and community supporters.',
    source: 'The Vision — mission.html (§ 3)',
  },
  motto: {
    label: 'Motto',
    value: 'I Can. I Will.',
    source: 'Organization Info — mission.html (§ Closing)',
  },
});

// Which org fact answers which kind of grant question. Matching is deterministic:
// normalized label keywords. Grants that ask information we do not hold stay
// unanswered (flagged ACTION REQUIRED), per §4.
const KNOWLEDGE_MAP = Object.freeze({
  legal_name: ['legal name', 'legal organization name', 'organization legal name', 'legal applicant name', 'organization name', 'name of organization', 'name of the organization', 'applicant name', 'registered name', 'applicant organization name'],
  mission: ['mission statement', 'organization mission', 'mission of your organization', 'describe your mission', 'statement of mission', 'organizational mission', 'what is the mission', 'narrative mission'],
  address: ['mailing address', 'organization address', 'physical address', 'street address', 'primary address', 'applicant address', 'contact address'],
  phone: ['phone', 'telephone', 'contact phone', 'phone number'],
  ein: ['ein', 'employer identification number', 'tax id', 'tax identification number', 'federal tax id'],
  founder: ['founder', 'founding director'],
  service_area: ['service area', 'geographic area', 'geographic service area', 'area served', 'communities served', 'service territory', 'geographic reach'],
  population_served: ['population served', 'who you serve', 'target population', 'clients served', 'community served', 'beneficiaries', 'population served by', 'who do you serve', 'constituents served'],
  programs: ['programs', 'program description', 'describe your programs', 'core programs', 'programs and services', 'program and services', 'services offered'],
  vision: ['vision', 'organizational vision', 'aspiration'],
  tagline: ['tagline'],
  motto: ['motto'],
});

function normalizeText(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[''\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function mapFieldToOrgFact(label) {
  const key = normalizeText(label);
  return Object.keys(KNOWLEDGE_MAP).find((factKey) =>
    KNOWLEDGE_MAP[factKey].some((keyword) => key.includes(normalizeText(keyword))),
  ) || null;
}

export function buildOrgProfile(adminRecord) {
  const supplements = (adminRecord && typeof adminRecord === 'object' && adminRecord.facts) || {};
  const facts = {};
  for (const [key, fact] of Object.entries(ORG_CORE_FACTS)) {
    facts[key] = { ...fact, confirmed: true, source: fact.source };
    if (supplements[key] && typeof supplements[key] === 'object' && supplements[key].value !== undefined && String(supplements[key].value).trim() !== '') {
      facts[key] = {
        label: fact.label,
        value: String(supplements[key].value).trim(),
        source: supplements[key].source || 'Administrator-confirmed grant knowledge',
        confirmed: true,
        confirmedBy: supplements[key].confirmedBy || undefined,
        confirmedAt: supplements[key].confirmedAt || undefined,
      };
    }
  }
  const extraKeys = Object.keys(supplements).filter((key) => !(key in ORG_CORE_FACTS));
  const extras = {};
  for (const key of extraKeys) {
    const fact = supplements[key];
    if (fact && typeof fact === 'object' && fact.value !== undefined) {
      extras[key] = {
        label: fact.label || key,
        value: String(fact.value).trim(),
        source: fact.source || 'Administrator-confirmed grant knowledge',
        confirmed: String(fact.value).trim() !== '',
        confirmedBy: fact.confirmedBy || undefined,
        confirmedAt: fact.confirmedAt || undefined,
      };
    }
  }
  return {
    facts,
    extras,
    updatedAt: adminRecord?.updatedAt || null,
  };
}

export function getOrgFact(profile, key) {
  return profile?.facts?.[key] || profile?.extras?.[key] || null;
}

// ---------------------------------------------------------------------------
// Opportunity matching (§2 "Why does this match Lost Limb Riders?")
// ---------------------------------------------------------------------------

export const ORGANIZATION_KEYWORDS = Object.freeze([
  'amputee', 'amputees', 'limb loss', 'limb difference', 'prosthetic', 'disability', 'disabilities',
  'peer support', 'peer visit', 'mentorship', 'mentoring', 'family support', 'caregiver',
  'veteran', 'community', 'motorcycle', 'ride', 'cycling', 'housing', 'advocacy',
  'independence', 'accessibility', 'outreach', 'education', 'rehabilitation', 'recovery',
  'iowa', 'fort dodge', 'adaptive', 'confidence', 'inclusion',
]);

export function evaluateMatch(opportunity, profile) {
  const haystack = normalizeText([
    opportunity.title,
    opportunity.description,
    (opportunity.categories || []).join(' '),
    (opportunity.eligibility || ''),
    (opportunity.fundingProgram || ''),
  ].join(' '));

  const found = ORGANIZATION_KEYWORDS.filter((keyword) =>
    haystack.includes(normalizeText(keyword)),
  );
  const score = found.length;
  const level = score >= 6 ? 'strong' : score >= 3 ? 'possible' : 'unlikely';

  const eligible = assessEligibility(opportunity);

  const reasons = [...new Set(found)].slice(0, 12);
  const summary = [];
  if (reasons.length) summary.push(`Matches Lost Limb Riders on: ${reasons.join(', ')}.`);
  if (eligible === 'eligible') summary.push('Lost Limb Riders appears to meet the stated applicant eligibility.');
  else if (eligible === 'not-eligible') summary.push('Eligibility appears restricted in a way that may exclude Lost Limb Riders.');
  else summary.push('Eligibility is not yet confirmed — review the funder terms.');
  return { score, level, matchedKeywords: reasons, eligible, summary };
}

function assessEligibility(opportunity) {
  const rawEligibility = String(opportunity?.eligibility || '');
  const eligibility = normalizeText(rawEligibility);
  if (!eligibility) return 'unknown';
  const terms = eligibility.split(' ').filter(Boolean).length;
  const nonprofitTerms = ['501(c)(3)', 'nonprofit', 'non-profit', 'nonprofits', 'tax-exempt', 'charity', 'charitable'];
  const blockedTerms = ['individuals', 'individual', 'state agency', 'for-profit', 'private business', 'higher education institution only'];
  const mentionsNonprofit = nonprofitTerms.some((term) => rawEligibility.toLowerCase().includes(term.toLowerCase()));
  const mentionsBlocked = blockedTerms.some((term) => rawEligibility.toLowerCase().includes(term.toLowerCase()));
  if (terms <= 8 && mentionsBlocked && !mentionsNonprofit) return 'not-eligible';
  return mentionsNonprofit ? 'eligible' : 'unknown';
}

// ---------------------------------------------------------------------------
// Grants.gov public APIs (no key required) — normalized ingestion
// ---------------------------------------------------------------------------

const GRANTS_GOV_BASE = 'https://api.grants.gov/v1/api';

export async function searchGrantsGov({ keywords, categories, statuses, rows = 100, page = 1 }) {
  const body = {};
  const kw = Array.isArray(keywords) ? keywords : String(keywords || '').split(',').map((item) => item.trim()).filter(Boolean);
  if (kw.length) body.keywords = kw;
  if (Array.isArray(categories) && categories.length) body.fundingCategories = categories;
  const statusList = Array.isArray(statuses) && statuses.length
    ? statuses
    : ['forecasted', 'posted'];
  body.oppStatuses = statusList;
  body.rows = Math.min(100, Math.max(1, Number(rows) || 100));
  body.startRecordNum = Math.max(1, Number(page) || 1);

  const response = await fetch(`${GRANTS_GOV_BASE}/search2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Grants.gov search failed: HTTP ${response.status}`);
  const data = await response.json();
  return {
    hits: (data?.oppHits || []).map(normalizeGrantsGovSearchHit).filter(Boolean),
    numFound: Number(data?.numFound || data?.totalNumGrants || data?.oppHits?.length || 0),
  };
}

export async function fetchGrantsGovDetail(oppId) {
  const response = await fetch(`${GRANTS_GOV_BASE}/fetchOpportunity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: Number(oppId) }),
  });
  if (!response.ok) throw new Error(`Grants.gov detail failed: HTTP ${response.status}`);
  const data = await response.json();
  const detail = data?.opportunityDetail || data?.opportunity || data;
  return normalizeGrantsGovDetail(detail || data);
}

export function normalizeGrantsGovSearchHit(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const title = String(raw.oppTitle || raw.title || raw.opportunityTitle || '').trim();
  if (!title) return null;
  return {
    sourceId: String(raw.oppId || raw.id || ''),
    title,
    funder: String(raw.agencyName || raw.agency || ''),
    opportunityNumber: String(raw.oppNumber || ''),
    category: String(raw.agencyCode || ''),
    status: String(raw.oppStatus || '').toLowerCase(),
    openDate: cleanDate(raw.openDate),
    closeDate: cleanDate(raw.closeDate),
    amountMin: toNumber(raw.awardFloor),
    amountMax: toNumber(raw.awardCeiling),
    totalFunding: toNumber(raw.estimatedTotalProgramFunding),
    description: String(raw.description || ''),
    applicantTypes: String(raw.applicantTypes || raw.eligibility || ''),
  };
}

export function normalizeGrantsGovDetail(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const title = String(raw.opportunityTitle || raw.oppTitle || raw.title || '').trim();
  const sourceId = String(raw.opportunityNumber || raw.oppNumber || raw.id || '');
  if (!sourceId && !title) return null;
  let description = '';
  for (const candidate of [raw.synopsis, raw.summary, raw.description, raw.opportunityDescription]) {
    if (candidate && typeof candidate === 'object') {
      description = String(candidate.description || candidate.abstractText || candidate.researchOpportunityDescription || '').trim();
      if (description) break;
    }
  }
  if (!description) {
    description = String(raw.summary || raw.description || '').trim();
  }
  let eligibility = '';
  const eligObj = raw.eligibility || {};
  if (eligObj && typeof eligObj === 'object') {
    eligibility = [
      eligObj.eligibleApplicants,
      eligObj.eligibilityDescription,
      eligObj.additionalEligibility,
    ].filter(Boolean).join(' ').trim();
  }
  const attachments = (raw.synopsis?.packages || raw.packages || raw.attachments || []).map((item) => ({
    label: String(item.name || item.documentName || item.fileName || 'Attachment'),
    url: String(item.link || item.url || ''),
  }));
  return {
    sourceId,
    title,
    funder: String(raw.agencyName || raw.agency || ''),
    opportunityNumber: String(raw.opportunityNumber || raw.oppNumber || ''),
    status: String(raw.opportunityStatus || raw.oppStatus || '').toLowerCase(),
    openDate: cleanDate(raw.openDate || raw.openDateOther),
    closeDate: cleanDate(raw.closeDate || raw.closeDateOther),
    amountMin: toNumber(raw.awardFloor ?? raw.estimatedFunding?.awardFloor),
    amountMax: toNumber(raw.awardCeiling ?? raw.estimatedFunding?.awardCeiling),
    totalFunding: toNumber(raw.estimatedTotalProgramFunding ?? raw.estimatedFunding?.total),
    description,
    eligibility,
    applicantTypes: String(eligObj?.applicantTypes || raw.applicantTypes || eligibility).trim(),
    categories: [String(raw.agencyCode || raw.category || '')].filter(Boolean),
    attachments,
    instructionsUrl: stringOr(raw.instructionsUrl || raw.synopsis?.responseDate || ''),
  };
}

function cleanDate(value) {
  const text = String(value || '').trim();
  const match = text.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : (text || '');
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && String(value).trim() !== '' ? number : null;
}

function stringOr(value) {
  const text = String(value || '').trim();
  return text && text !== 'null' && text !== 'undefined' ? text : '';
}

// ---------------------------------------------------------------------------
// Requirement model (§2 — actual grant requirements, never one generic form)
// ---------------------------------------------------------------------------

export function emptyRequirementModel() {
  return {
    source: 'administrator',
    sections: [],
    narrativePrompts: [],
    budget: null,
    attachments: [],
    certifications: [],
    signatures: [],
    eligibility: [],
    submission: {
      method: 'unknown',
      url: '',
      portalName: '',
      deadline: '',
      notes: '',
    },
  };
}

export function normalizeRequirementModel(input) {
  const model = input && typeof input === 'object' ? input : {};
  const result = emptyRequirementModel();
  result.source = sanitizeOne(model.source, ['grants-gov-synopsis', 'ai-extracted', 'administrator'], 'administrator');
  if (Array.isArray(model.sections)) {
    result.sections = model.sections.map((section, sectionIndex) => ({
      id: sanitizeOne(section?.id, undefined, `section-${sectionIndex}`),
      title: String(section?.title || `Section ${sectionIndex + 1}`).slice(0, 200),
      fields: (Array.isArray(section.fields) ? section.fields : []).map((field, fieldIndex) => ({
        id: sanitizeOne(field?.id, undefined, `field-${fieldIndex}`),
        label: String(field?.label || `Question ${fieldIndex + 1}`).slice(0, 240),
        kind: sanitizeOne(field?.kind, ['text', 'textarea', 'number', 'date', 'select', 'boolean'], 'text'),
        required: Boolean(field?.required),
        maxChars: field?.maxChars ? Math.max(1, Number(field.maxChars)) : null,
        maxWords: field?.maxWords ? Math.max(1, Number(field.maxWords)) : null,
        options: Array.isArray(field?.options) ? field.options.map((option) => String(option).slice(0, 160)) : null,
        help: String(field?.help || '').slice(0, 500),
        mapsTo: sanitizeOne(field?.mapsTo, undefined, null),
      })),
    }));
  }
  // Merge top-level narrative prompts into the first/its own section as textarea fields so the
  // review workspace treats every question uniformly but preserves draft semantics.
  const narrativeFields = (Array.isArray(model.narrativePrompts) ? model.narrativePrompts : []).map((prompt, promptIndex) => ({
    id: sanitizeOne(prompt?.id, undefined, `narrative-${promptIndex}`),
    label: String(prompt?.label || `Narrative ${promptIndex + 1}`).slice(0, 240),
    kind: 'textarea',
    required: Boolean(prompt?.required),
    maxChars: prompt?.charLimit ? Math.max(1, Number(prompt.charLimit)) : null,
    maxWords: prompt?.wordLimit ? Math.max(1, Number(prompt.wordLimit)) : null,
    help: String(prompt?.help || prompt?.prompt || '').slice(0, 600),
    mapsTo: null,
    narrative: true,
    sourcePrompt: String(prompt?.prompt || '').slice(0, 2000),
  }));
  if (narrativeFields.length) {
    result.sections.push({
      id: 'narratives',
      title: 'Narrative Responses',
      fields: narrativeFields,
    });
  }
  result.narrativePrompts = narrativeFields;

  if (model.budget && typeof model.budget === 'object') {
    result.budget = {
      required: Boolean(model.budget.required),
      allowMultiple: Boolean(model.budget.allowMultiple),
      maxAmount: model.budget.maxAmount ? Math.max(0, Number(model.budget.maxAmount)) : null,
      minAmount: model.budget.minAmount ? Math.max(0, Number(model.budget.minAmount)) : null,
      totalFieldId: sanitizeOne(model.budget.totalFieldId, undefined, null),
    };
  } else {
    result.budget = {
      required: false,
      allowMultiple: false,
      maxAmount: null,
      minAmount: null,
      totalFieldId: null,
    };
  }

  result.attachments = (Array.isArray(model.attachments) ? model.attachments : []).map((attachment, attachmentIndex) => ({
    id: sanitizeOne(attachment?.id, undefined, `attachment-${attachmentIndex}`),
    label: String(attachment?.label || `Attachment ${attachmentIndex + 1}`).slice(0, 240),
    required: Boolean(attachment?.required),
    kind: sanitizeOne(attachment?.kind, ['file', 'pdf', 'document', 'image'], 'file'),
    notes: String(attachment?.notes || '').slice(0, 400),
  }));

  result.certifications = (Array.isArray(model.certifications) ? model.certifications : []).map((cert, certIndex) => ({
    id: sanitizeOne(cert?.id, undefined, `certification-${certIndex}`),
    label: String(cert?.label || `Certification ${certIndex + 1}`).slice(0, 400),
    required: Boolean(cert?.required),
    acknowledgeBy: sanitizeOne(cert?.acknowledgeBy, undefined, 'Executive Director'),
  }));

  result.signatures = (Array.isArray(model.signatures) ? model.signatures : []).map((signature, signatureIndex) => ({
    id: sanitizeOne(signature?.id, undefined, `signature-${signatureIndex}`),
    label: String(signature?.label || `Signature ${signatureIndex + 1}`).slice(0, 240),
    role: sanitizeOne(signature?.role, undefined, 'Authorized Officer'),
    required: Boolean(signature?.required),
  }));

  result.eligibility = (Array.isArray(model.eligibility) ? model.eligibility : []).map((item, itemIndex) => ({
    id: sanitizeOne(item?.id, undefined, `eligibility-${itemIndex}`),
    label: String(item?.label || item?.requirement || `Eligibility item ${itemIndex + 1}`).slice(0, 400),
    requirement: String(item?.requirement || item?.label || '').slice(0, 800),
    met: sanitizeOne(item?.met, ['met', 'unknown', 'not-met'], 'unknown'),
    notes: String(item?.notes || '').slice(0, 500),
  }));

  if (model.submission && typeof model.submission === 'object') {
    result.submission = {
      method: sanitizeOne(model.submission.method, ['online', 'email', 'mail', 'portal', 'unknown'], 'unknown'),
      url: String(model.submission.url || '').slice(0, 1000),
      portalName: String(model.submission.portalName || '').slice(0, 160),
      deadline: cleanDate(model.submission.deadline),
      notes: String(model.submission.notes || '').slice(0, 800),
    };
  }

  return result;
}

function sanitizeOne(value, allowed, fallback) {
  const text = String(value || '').trim();
  if (!text) return fallback;
  if (Array.isArray(allowed) && !allowed.includes(text)) return fallback;
  return text.slice(0, 200);
}

// Fallback requirement model built from the actual opportunity record (no AI, no fiction).
// If the opportunity carries no instructions, the honest model is an explicit
// ACTION REQUIRED for the application instructions themselves.
export function buildFallbackRequirementModel(opportunity) {
  const model = normalizeRequirementModel({
    source: opportunity?.source === 'grants-gov' ? 'grants-gov-synopsis' : 'administrator',
    sections: [
      {
        id: 'organization',
        title: 'Organization',
        fields: [
          field('org_legal_name', 'Legal Organization Name', 'text', { mapsTo: 'legal_name' }),
          field('org_ein', 'Employer Identification Number', 'text', { mapsTo: 'ein' }),
          field('org_mission', 'Mission Statement', 'textarea', { mapsTo: 'mission' }),
          field('org_address', 'Mailing Address', 'text', { mapsTo: 'address' }),
          field('org_service_area', 'Geographic Service Area', 'text', { mapsTo: 'service_area' }),
          field('org_population', 'Population Served', 'textarea', { mapsTo: 'population_served' }),
          field('org_programs', 'Programs and Services', 'textarea', { mapsTo: 'programs' }),
        ],
      },
      {
        id: 'project',
        title: 'Funding Request',
        fields: [
          field('project_summary', 'Project Summary', 'textarea'),
          field('project_use_of_funds', 'Proposed Use of Funds', 'textarea'),
          field('requested_amount', 'Requested Amount (USD)', 'number'),
        ],
      },
      {
        id: 'contact',
        title: 'Contact',
        fields: [
          field('contact_name', 'Primary Contact Name', 'text'),
          field('contact_email', 'Primary Contact Email', 'text'),
          field('contact_phone', 'Primary Contact Phone', 'text', { mapsTo: 'phone' }),
        ],
      },
    ],
    submission: {
      method: opportunity?.submissionMethod || 'unknown',
      url: opportunity?.url || '',
      portalName: opportunity?.portalName || '',
      deadline: opportunity?.deadline || '',
      notes: opportunity?.submissionNotes || '',
    },
    eligibility: (
      opportunity?.applicantTypes
        ? [{ id: 'eligibility-applicant-types', requirement: opportunity.applicantTypes, met: 'unknown' }]
        : []
    ),
    attachments: (opportunity?.attachments || []).map((attachment, index) => ({
      id: `att-${index}`,
      label: attachment.label || `Attachment ${index + 1}`,
      required: true,
      kind: 'file',
      notes: '',
    })),
    certifications: [],
    signatures: [],
    budget: {
      required: !!opportunity?.amountMax || !!opportunity?.amountMin,
      minAmount: opportunity?.amountMin || null,
      maxAmount: opportunity?.amountMax || null,
    },
  });

  const hasRealInstructions = Boolean(
    (opportunity && (opportunity.instructionsText || opportunity.description)) && model.sections.length,
  );
  if (opportunity && !hasRealInstructions && opportunity.source !== 'grants-gov') {
    model.sections.unshift({
      id: 'instructions',
      title: 'Application Instructions (ACTION REQUIRED)',
      fields: [
        {
          id: 'application_instructions',
          label: 'Paste or link the actual grant application instructions, questions, and limits',
          kind: 'textarea',
          required: true,
          maxChars: 6000,
          maxWords: null,
          options: null,
          help: 'This opportunity was not sourced from a structured grant listing. The engine refuses to guess the funder\u2019s requirements.',
          mapsTo: null,
          narrative: false,
        },
      ],
    });
  }
  return model;
}

function field(id, label, kind, options = {}) {
  return {
    id,
    label,
    kind,
    required: true,
    maxChars: options.maxChars || (kind === 'textarea' ? 2000 : kind === 'text' ? 200 : null),
    maxWords: options.maxWords || null,
    options: options.options || null,
    help: options.help || '',
    mapsTo: options.mapsTo || null,
    narrative: false,
  };
}

// AI-assisted requirement structuring (§2 — the engine works from the actual grant).
// Strictly an extraction/structuring assistant; output is normalized and admin-reviewed.
export async function analyzeRequirementsWithAi({ instructions, opportunity }) {
  if (!process.env.GEMINI_API_KEY) return null;
  const { generateJson } = await import('./ai.js');
  const system = [
    'You structure grant application requirements for Lost Limb Riders, a 501(c)(3) nonprofit serving amputees and people with disabilities in Iowa.',
    'Output JSON only, exactly this shape (empty arrays allowed):',
    JSON.stringify(schemaShape()),
    'Rules:',
    '- Only include requirements that actually appear in the instructions. Do not invent questions.',
    '- Split questions into sections. Include character/word limits only when stated.',
    '- Map organization questions to one of: legal_name, mission, address, phone, ein, founder, service_area, population_served, programs, vision, tagline, motto, or null.',
    '- budget.lines refers to whether the application asks for budget line items with a total.',
    '- eligibility items carry met: "unknown" — you do not decide eligibility.',
  ].join('\n');
  const prompt = [
    `Grant title: ${opportunity?.title || 'Untitled'}`,
    `Funder: ${opportunity?.funder || 'Unknown'}`,
    `Deadline: ${opportunity?.deadline || 'Unknown'}`,
    `Funding description:\n${(opportunity?.description || '').slice(0, 4000)}`,
    `Application instructions / questions:\n${String(instructions || '').slice(0, 12000)}`,
    '\nExtract the application requirements.',
  ].join('\n');
  try {
    const result = await generateJson({ prompt, system, maxOutputTokens: 8192, temperature: 0.2 });
    return normalizeRequirementModel(result);
  } catch {
    return null;
  }
}

function schemaShape() {
  return {
    sections: [{ id: 'string', title: 'string', fields: [{ id: 'string', label: 'string', kind: 'text|textarea|number|date|select|boolean', required: true, maxChars: null, maxWords: null, options: [], help: '', mapsTo: 'legal_name|mission|...|null' }] }],
    narrativePrompts: [{ id: 'string', label: 'string', prompt: 'string', charLimit: null, wordLimit: null, required: true }],
    budget: { required: false, allowMultiple: false, lines: false, maxAmount: null, minAmount: null },
    attachments: [{ id: 'string', label: 'string', required: true, kind: 'file|pdf|document|image', notes: '' }],
    certifications: [{ id: 'string', label: 'string', required: true, acknowledgeBy: 'string' }],
    signatures: [{ id: 'string', label: 'string', role: 'string', required: true }],
    submission: { method: 'online|email|mail|portal|unknown', url: '', portalName: '', deadline: 'YYYY-MM-DD', notes: '' },
    eligibility: [{ id: 'string', requirement: 'string', met: 'unknown', notes: '' }],
  };
}

// ---------------------------------------------------------------------------
// Auto-population (§3 auto-populated / generated-draft / action-required)
// ---------------------------------------------------------------------------

export function autoFillRequirements(requirementModel, profile) {
  const answers = {};
  const fields = allFields(requirementModel);
  for (const fieldItem of fields) {
    const factKey = fieldItem.mapsTo || mapFieldToOrgFact(fieldItem.label);
    const fact = factKey ? getOrgFact(profile, factKey) : null;
    if (fieldItem.narrative) {
      answers[fieldItem.id] = {
        value: '',
        sourceType: 'action-required',
        sourceRef: null,
        notes: 'Narrative drafted at review time using the funder question and approved organizational sources; verify before submission.',
        updatedAt: null,
        updatedBy: null,
        generated: false,
      };
      continue;
    }
    if (fact && fact.value && fact.confirmed) {
      answers[fieldItem.id] = {
        value: fact.value,
        sourceType: 'auto-populated',
        sourceRef: { factKey, source: fact.source },
        notes: '',
        updatedAt: null,
        updatedBy: null,
      };
    } else {
      answers[fieldItem.id] = {
        value: '',
        sourceType: 'action-required',
        sourceRef: null,
        notes: `Required information is not available from approved Lost Limb Riders records.${fact ? '' : ' Supply it in the organization knowledge base or this answer.'}`,
        updatedAt: null,
        updatedBy: null,
      };
    }
  }
  return answers;
}

export function allFields(requirementModel) {
  return (requirementModel?.sections || []).flatMap((section) => section.fields || []);
}

// Narrative drafting — grounded in approved org sources + the funder's actual question.
export async function draftNarrative({ fieldItem, profile, opportunity }) {
  if (!process.env.GEMINI_API_KEY) {
    return { value: '', drafted: false, reason: 'AI not configured.' };
  }
  const { generateJson } = await import('./ai.js');
  const system = [
    'You draft a grant narrative for Lost Limb Riders, a 501(c)(3) nonprofit serving amputees and people with disabilities in Iowa.',
    'Ground every sentence in the approved organizational facts provided. Do not invent figures, dates, outcomes, or claims.',
    'Where a fact is not provided, write nothing for it — never fabricate.',
    'Keep the draft within the stated limits. Return JSON: { "text": "..." }.',
  ].join('\n');
  const facts = Object.entries(profile.facts).map(([key, fact]) => `${key}: ${fact.value}`).join('\n');
  const prompt = [
    `Grant: ${opportunity?.title || 'Untitled'}`,
    `Funder question: ${fieldItem.sourcePrompt || fieldItem.label}`,
    `Word limit: ${fieldItem.maxWords || 'none'}, character limit: ${fieldItem.maxChars || 'none'}`,
    `Approved organizational facts:\n${facts}`,
    '\nDraft the response. Never exceed the limits. Do not include a title or salutation.',
  ].join('\n');
  try {
    const result = await generateJson({ prompt, system, maxOutputTokens: 3000, temperature: 0.5 });
    let text = String(result?.text || '').trim();
    if (fieldItem.maxWords) text = truncateWords(text, fieldItem.maxWords);
    if (fieldItem.maxChars) text = text.slice(0, fieldItem.maxChars);
    return { value: text, drafted: Boolean(text), reason: text ? '' : 'Draft produced empty response.' };
  } catch (error) {
    return { value: '', drafted: false, reason: error.message };
  }
}

function truncateWords(text, maxWords) {
  const words = String(text || '').trim().split(/\s+/);
  return words.length > maxWords ? words.slice(0, maxWords).join(' ') : String(text || '').trim();
}

// ---------------------------------------------------------------------------
// Application lifecycle (§11, §12)
// ---------------------------------------------------------------------------

export function createApplication({ opportunity, requirementModel, profile, actor, existingIds }) {
  const id = uniqueId('gapp', existingIds);
  const now = new Date().toISOString();
  const answers = autoFillRequirements(requirementModel, profile);
  const application = {
    schema: 'grant-application',
    schemaVersion: 1,
    id,
    status: 'in-preparation',
    opportunityId: opportunity?.id || null,
    title: opportunity?.title || 'Untitled application',
    answers,
    attachmentStatus: Object.fromEntries((requirementModel.attachments || []).map((attachment) => [attachment.id, 'missing'])),
    certificationsAcknowledged: Object.fromEntries((requirementModel.certifications || []).map((certification) => [certification.id, false])),
    signaturesIdentified: Object.fromEntries((requirementModel.signatures || []).map((signature) => [signature.id, ''])),
    budgetLines: [],
    requirementSnapshot: JSON.parse(JSON.stringify(requirementModel)),
    orgSnapshot: JSON.parse(JSON.stringify(profile)),
    validation: null,
    submission: null,
    submissionSnapshotId: null,
    locked: false,
    audit: [{ at: now, actor, event: 'application_created', detail: `Prepared application for ${opportunity?.title || 'a grant opportunity'}` }],
    createdBy: actor,
    createdAt: now,
    updatedAt: now,
  };
  return application;
}

export function saveAnswer(application, questionId, { value, sourceType, notes }, actor) {
  assertMutable(application);
  const answer = application.answers[questionId];
  if (!answer) throw new Error('Question not found in this application.');
  const cleanValue = String(value ?? '').trim();
  answer.value = cleanValue;
  if (sourceType === 'administrator-entered' || sourceType === 'validation-error') {
    answer.sourceType = cleanValue ? sourceType : 'action-required';
  } else if (sourceType === 'auto-populated' && cleanValue && answer.sourceType === 'action-required') {
    answer.sourceType = 'auto-populated';
  }
  if (notes !== undefined) answer.notes = String(notes).slice(0, 600);
  answer.updatedAt = new Date().toISOString();
  answer.updatedBy = actor;
  application.updatedAt = answer.updatedAt;
  application.audit.push({ at: answer.updatedAt, actor, event: 'answer_saved', detail: `${questionId} — ${answer.sourceType}` });
  return application;
}

export function setAttachmentStatus(application, attachmentId, status, actor) {
  assertMutable(application);
  if (!(attachmentId in application.attachmentStatus)) throw new Error('Attachment not found in this application.');
  const next = sanitizeOne(status, ['missing', 'identified', 'present'], 'missing');
  application.attachmentStatus[attachmentId] = next;
  application.updatedAt = new Date().toISOString();
  application.audit.push({ at: application.updatedAt, actor, event: 'attachment_status_set', detail: `${attachmentId} → ${next}` });
  return application;
}

export function setCertificationAcknowledgment(application, certificationId, acknowledged, actor) {
  assertMutable(application);
  if (!(certificationId in application.certificationsAcknowledged)) throw new Error('Certification not found in this application.');
  application.certificationsAcknowledged[certificationId] = Boolean(acknowledged);
  application.updatedAt = new Date().toISOString();
  application.audit.push({ at: application.updatedAt, actor, event: 'certification_acknowledged', detail: certificationId });
  return application;
}

export function identifySignature(application, signatureId, name, actor) {
  assertMutable(application);
  if (!(signatureId in application.signaturesIdentified)) throw new Error('Signature requirement not found in this application.');
  application.signaturesIdentified[signatureId] = String(name || '').trim();
  application.updatedAt = new Date().toISOString();
  application.audit.push({ at: application.updatedAt, actor, event: 'signature_identified', detail: `${signatureId} → ${application.signaturesIdentified[signatureId]}` });
  return application;
}

export function setBudgetLines(application, { lines, total, requestAmount }, actor) {
  assertMutable(application);
  const normalizedLines = (Array.isArray(lines) ? lines : []).map((line) => ({
    id: line.id || `line-${Math.random().toString(36).slice(2, 8)}`,
    category: String(line.category || '').slice(0, 140),
    budgeted: toNumber(line.budgeted),
    notes: String(line.notes || '').slice(0, 300),
  }));
  application.budgetLines = normalizedLines;
  if (total !== undefined) application.budgetTotal = toNumber(total);
  if (requestAmount !== undefined) {
    application.answers.requested_amount = application.answers.requested_amount || {
      value: '', sourceType: 'action-required', sourceRef: null, notes: '', updatedAt: null, updatedBy: null,
    };
    application.answers.requested_amount.value = String(requestAmount ?? '').trim();
    application.answers.requested_amount.sourceType = String(requestAmount ?? '').trim() ? 'administrator-entered' : 'action-required';
    application.answers.requested_amount.updatedAt = new Date().toISOString();
    application.answers.requested_amount.updatedBy = actor;
  }
  application.updatedAt = new Date().toISOString();
  application.audit.push({ at: application.updatedAt, actor, event: 'budget_updated', detail: `${normalizedLines.length} line items` });
  return application;
}

// §6 review checklist. Confidence only when every error is resolved.
export function validateApplication(application, profile) {
  const requirement = application.requirementSnapshot;
  const errors = [];
  const warnings = [];
  const fields = allFields(requirement);

  for (const fieldItem of fields) {
    const answer = application.answers[fieldItem.id];
    const value = String(answer?.value || '');
    if (fieldItem.required && !value) {
      errors.push({ field: fieldItem.id, label: fieldItem.label, message: 'Required question is unanswered.' });
      continue;
    }
    if (!value) continue;
    if (answer.sourceType === 'action-required' && !value) {
      errors.push({ field: fieldItem.id, label: fieldItem.label, message: 'ACTION REQUIRED — information missing.' });
      continue;
    }
    if (fieldItem.maxChars && value.length > fieldItem.maxChars) {
      errors.push({ field: fieldItem.id, label: fieldItem.label, message: `Exceeds the ${fieldItem.maxChars}-character limit (${value.length}).` });
    }
    if (fieldItem.maxWords && countWords(value) > fieldItem.maxWords) {
      errors.push({ field: fieldItem.id, label: fieldItem.label, message: `Exceeds the ${fieldItem.maxWords}-word limit (${countWords(value)}).` });
    }
    if (fieldItem.kind === 'date' && !isValidDate(value)) {
      errors.push({ field: fieldItem.id, label: fieldItem.label, message: 'Date must use YYYY-MM-DD and be a real calendar date.' });
    }
  }

  // Attachments
  for (const attachment of requirement.attachments || []) {
    const status = application.attachmentStatus[attachment.id] || 'missing';
    if (attachment.required && status === 'missing') {
      errors.push({ attachment: attachment.id, label: attachment.label, message: 'Required attachment is missing. Identify or attach it.' });
    } else if (status === 'identified' && !attachment.notes) {
      warnings.push({ attachment: attachment.id, label: attachment.label, message: 'Attachment identified but location/note not recorded.' });
    }
  }

  // Certifications
  for (const certification of requirement.certifications || []) {
    const acknowledged = application.certificationsAcknowledged[certification.id];
    if (certification.required && !acknowledged) {
      errors.push({ certification: certification.id, label: certification.label, message: `Certification must be acknowledged by ${certification.acknowledgeBy || 'an authorized officer'}.` });
    }
  }

  // Signatures
  for (const signature of requirement.signatures || []) {
    const identified = application.signaturesIdentified[signature.id];
    if (signature.required && !identified) {
      errors.push({ signature: signature.id, label: signature.label, message: `Required signature (${signature.role || 'Authorized Officer'}) has not been identified.` });
    }
  }

  // Eligibility
  for (const item of requirement.eligibility || []) {
    if (item.met === 'not-met') {
      errors.push({ eligibility: item.id, label: item.label || item.requirement, message: 'Eligibility requirement is NOT met. Do not proceed.' });
    } else if (item.met === 'unknown') {
      warnings.push({ eligibility: item.id, label: item.label || item.requirement, message: 'Eligibility not yet confirmed. Review the funder terms before submission.' });
    }
  }

  // Funding request internal consistency
  const requestedAmount = toNumber(application.answers.requested_amount?.value);
  if (requirement.budget?.minAmount && requestedAmount !== null && requestedAmount < requirement.budget.minAmount) {
    errors.push({ finance: 'requested_amount', label: 'Requested amount', message: `Below the funder's award floor of $${requirement.budget.minAmount}.` });
  }
  if (requirement.budget?.maxAmount && requestedAmount !== null && requestedAmount > requirement.budget.maxAmount) {
    errors.push({ finance: 'requested_amount', label: 'Requested amount', message: `Exceeds the funder's award ceiling of $${requirement.budget.maxAmount}.` });
  }
  if (requestedAmount === null && requirement.budget?.required) {
    errors.push({ finance: 'requested_amount', label: 'Requested amount', message: 'No request amount recorded; the funder requires a requested amount.' });
  }

  // Budget math
  const sumLines = (application.budgetLines || []).reduce((sum, line) => sum + (Number(line.budgeted) || 0), 0);
  const hasLines = (application.budgetLines || []).length > 0;
  const hasTotal = application.budgetTotal !== undefined && application.budgetTotal !== null;
  if (hasLines && hasTotal && !numbersClose(sumLines, application.budgetTotal)) {
    errors.push({ finance: 'budget', label: 'Budget', message: `Budget line items total $${sumLines} but the stated total is $${application.budgetTotal}.` });
  }
  if (hasLines && hasTotal && requestedAmount !== null && !numbersClose(sumLines, requestedAmount)) {
    warnings.push({ finance: 'budget', label: 'Budget', message: `Budget line items total $${sumLines} but the request amount is $${requestedAmount}.` });
  }
  if (hasLines && !hasTotal) {
    warnings.push({ finance: 'budget', label: 'Budget', message: 'Budget lines entered without a stated total.' });
  }

  // Organizational consistency — auto-populated values must still match the canonical records.
  for (const fieldItem of fields) {
    const answer = application.answers[fieldItem.id];
    if (!answer || answer.sourceType !== 'auto-populated') continue;
    const factKey = answer.sourceRef?.factKey;
    if (!factKey) continue;
    const fact = getOrgFact(profile, factKey);
    if (fact && String(fact.value).trim() !== String(answer.value).trim()) {
      warnings.push({ field: fieldItem.id, label: fieldItem.label, message: `Auto-populated value no longer matches the canonical record (now: ${fact.value}). Consider refreshing.` });
    }
  }

  // Deadline
  if (requirement.submission?.deadline && isValidDate(requirement.submission.deadline)) {
    const deadline = new Date(`${requirement.submission.deadline}`);
    if (deadline.getTime() < Date.now()) {
      warnings.push({ deadline: true, message: `Application deadline (${requirement.submission.deadline}) is in the past. Confirm with the funder before submitting.` });
    }
  }

  const ready = errors.length === 0;
  const validation = {
    ready,
    status: ready ? 'READY FOR FINAL HUMAN REVIEW' : 'NOT READY — ACTION REQUIRED',
    errors,
    warnings,
    checkedAt: new Date().toISOString(),
  };
  application.validation = validation;
  application.status = ready ? 'human-review-required' : 'in-preparation';
  application.updatedAt = validation.checkedAt;
  return application;
}

// §12 — immutable submitted snapshot. markSubmitted only records a human-submitted
// application; it creates a snapshot that no later edit can affect.
export function markSubmitted(application, submissionInput, actor) {
  if (application.status === 'submitted') throw new Error('Application is already marked submitted.');
  if (!submissionInput || submissionInput.confirmHumanSubmission !== true) {
    throw new Error('A human must confirm the application was actually submitted.');
  }
  assertMutable(application);
  const now = new Date().toISOString();
  const submission = {
    date: cleanDate(submissionInput.date) || now.slice(0, 10),
    method: sanitizeOne(submissionInput.method, ['online', 'email', 'mail', 'portal', 'other'], 'other'),
    reference: String(submissionInput.reference || '').slice(0, 200),
    version: String(submissionInput.version || 'v1').slice(0, 60),
    portal: String(submissionInput.portal || '').slice(0, 400),
    notes: String(submissionInput.notes || '').slice(0, 1500),
    followUpDate: cleanDate(submissionInput.followUpDate),
  };
  const snapshot = {
    schema: 'grant-submission',
    schemaVersion: 1,
    id: `gsub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    applicationId: application.id,
    opportunityId: application.opportunityId,
    title: application.title,
    submittedAt: now,
    submittedBy: actor,
    submission,
    answers: JSON.parse(JSON.stringify(application.answers)),
    requirementSnapshot: JSON.parse(JSON.stringify(application.requirementSnapshot)),
    orgSnapshot: JSON.parse(JSON.stringify(application.orgSnapshot)),
    attachmentStatus: { ...application.attachmentStatus },
    certificationsAcknowledged: { ...application.certificationsAcknowledged },
    signaturesIdentified: { ...application.signaturesIdentified },
    budgetLines: JSON.parse(JSON.stringify(application.budgetLines || [])),
    budgetTotal: application.budgetTotal ?? null,
    validation: application.validation,
    package: {
      exportable: true,
      printableView: true,
      formats: ['json', 'html'],
    },
  };
  application.status = 'submitted';
  application.submission = submission;
  application.submissionSnapshotId = snapshot.id;
  application.locked = true;
  application.updatedAt = now;
  application.audit.push({ at: now, actor, event: 'application_submitted', detail: `Marked as submitted on ${submission.date} (${submission.method}) — snapshot ${snapshot.id}` });
  return { application, snapshot };
}

function assertMutable(application) {
  if (application.locked) throw new Error('This application is submitted and locked. Open the snapshot for the immutable record.');
  if (application.status === 'submitted') throw new Error('This application is submitted and can no longer be edited.');
}

// ---------------------------------------------------------------------------
// Helpers / summaries
// ---------------------------------------------------------------------------

function uniqueId(prefix, existingIds) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const id = `${prefix}-${suffix}`;
    if (!existingIds || !existingIds.has(id)) return id;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-${Math.random().toString(36).slice(2, 4)}`;
}

export function countWords(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean).length;
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function numbersClose(a, b) {
  return Math.abs(Number(a) - Number(b)) < 0.01;
}

export function summarizeOpportunity(opportunity) {
  if (!opportunity) return null;
  return {
    id: opportunity.id,
    title: opportunity.title,
    funder: opportunity.funder,
    source: opportunity.source,
    sourceId: opportunity.sourceId || '',
    opportunityNumber: opportunity.opportunityNumber || '',
    url: opportunity.url || '',
    deadline: opportunity.deadline || '',
    openDate: opportunity.openDate || '',
    amount: {
      min: opportunity.amountMin ?? null,
      max: opportunity.amountMax ?? null,
      total: opportunity.totalFunding ?? null,
    },
    categories: opportunity.categories || [],
    status: opportunity.status || 'discovered',
    match: opportunity.match || null,
    hasRequirementModel: Boolean(opportunity.requirementModel),
    hasInstructions: Boolean(opportunity.instructionsText),
    createdAt: opportunity.createdAt,
    updatedAt: opportunity.updatedAt,
  };
}

export function summarizeApplication(application) {
  if (!application) return null;
  const requiredCount = allFields(application.requirementSnapshot).filter((fieldItem) => fieldItem.required).length;
  const answeredCount = allFields(application.requirementSnapshot).filter((fieldItem) => String(application.answers[fieldItem.id]?.value || '').trim()).length;
  return {
    id: application.id,
    title: application.title,
    opportunityId: application.opportunityId,
    status: application.status,
    locked: application.locked,
    progress: requiredCount ? Math.round((answeredCount / requiredCount) * 100) : 0,
    answeredRequired: answeredCount,
    requiredTotal: requiredCount,
    validation: application.validation,
    submission: application.submission,
    submissionSnapshotId: application.submissionSnapshotId,
    sectionCount: (application.requirementSnapshot?.sections || []).length,
    attachmentCount: (application.requirementSnapshot?.attachments || []).length,
    certificationCount: (application.requirementSnapshot?.certifications || []).length,
    signatureCount: (application.requirementSnapshot?.signatures || []).length,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
  };
}

// Public detail payload for the review workspace with every answer's source attribution.
export function publicApplication(application) {
  const fields = allFields(application.requirementSnapshot);
  const reviewFields = fields.map((fieldItem) => {
    const answer = application.answers[fieldItem.id] || { value: '', sourceType: 'action-required', sourceRef: null, notes: '', updatedAt: null, updatedBy: null };
    return { ...fieldItem, answer };
  });
  return {
    ...summarizeApplication(application),
    sections: (application.requirementSnapshot?.sections || []).map((section) => ({
      id: section.id,
      title: section.title,
      fields: reviewFields.filter((fieldItem) => (
        application.requirementSnapshot.sections.find((match) => match.id === section.id)?.fields.some((raw) => raw.id === fieldItem.id)
      )),
    })),
    attachments: (application.requirementSnapshot?.attachments || []).map((attachment) => ({
      ...attachment,
      status: application.attachmentStatus[attachment.id] || 'missing',
    })),
    certifications: (application.requirementSnapshot?.certifications || []).map((certification) => ({
      ...certification,
      acknowledged: Boolean(application.certificationsAcknowledged[certification.id]),
    })),
    signatures: (application.requirementSnapshot?.signatures || []).map((signature) => ({
      ...signature,
      identifiedBy: application.signaturesIdentified[signature.id] || '',
    })),
    eligibility: application.requirementSnapshot?.eligibility || [],
    budget: {
      ...(application.requirementSnapshot?.budget || {}),
      lines: application.budgetLines || [],
      total: application.budgetTotal ?? null,
    },
    submission: application.requirementSnapshot?.submission || { method: 'unknown', url: '', portalName: '', deadline: '', notes: '' },
    audit: application.audit || [],
    orgSnapshot: application.orgSnapshot || {},
  };
}