export const DOCUMENT_SOURCE_REPO = 'https://github.com/LostLimbRider/Autobiography';
export const DOCUMENT_SOURCE_PATH = 'https://github.com/LostLimbRider/Autobiography/blob/master/';

const BASE_DOCS = [
  {
    document_code: 'GOV-POL-001',
    title: 'Master Document Control Policy',
    type: 'Policy',
    domain: 'governance',
    section: 'Governance',
    access: 'internal',
    source_repository: 'Autobiography',
    canonical_path: 'documentation-source/lost_limb_riders_operations/01-GOVERNANCE/01-Master-Document-Control-Policy.md',
    status: 'active',
    version: '1.0',
    effective_date: '2026-01-01',
    responsible_area: 'Governance',
    description: 'Defines the authoritative document-control framework for the organization.',
  },
  {
    document_code: 'GOV-REC-001',
    title: 'Records Policy',
    type: 'Policy',
    domain: 'records',
    section: 'Governance',
    access: 'internal',
    source_repository: 'Autobiography',
    canonical_path: 'documentation-source/lost_limb_riders_operations/01-GOVERNANCE/03-Records-Policy.md',
    status: 'active',
    version: '1.0',
    effective_date: '2026-01-01',
    responsible_area: 'Governance',
    description: 'Sets retention rules, records ownership, and documented control requirements.',
  },
  {
    document_code: 'HR-PROC-001',
    title: 'Employee Lifecycle Procedure',
    type: 'Procedure',
    domain: 'human-resources',
    section: 'Human Resources',
    access: 'internal',
    source_repository: 'Autobiography',
    canonical_path: 'documentation-source/lost_limb_riders_operations/03-HUMAN-RESOURCES/02-Employee-Lifecycle-Procedure.md',
    status: 'active',
    version: '1.0',
    effective_date: '2026-01-01',
    responsible_area: 'Human Resources',
    description: 'Governs hiring, classification, onboarding, and separation controls.',
  },
  {
    document_code: 'HR-PROC-005',
    title: 'Disciplinary Procedure',
    type: 'Procedure',
    domain: 'human-resources',
    section: 'Human Resources',
    access: 'internal',
    source_repository: 'Autobiography',
    canonical_path: 'documentation-source/lost_limb_riders_operations/03-HUMAN-RESOURCES/17-Disciplinary-Procedure.md',
    status: 'active',
    version: '1.0',
    effective_date: '2026-01-01',
    responsible_area: 'Human Resources',
    description: 'Documents progressive discipline and corrective action expectations.',
  },
  {
    document_code: 'FIN-EXP-002',
    title: 'Expense and Reimbursement Procedure',
    type: 'Procedure',
    domain: 'finance',
    section: 'Finance',
    access: 'internal',
    source_repository: 'Autobiography',
    canonical_path: 'documentation-source/lost_limb_riders_operations/05-FINANCE/02-Expense-and-Reimbursement-Procedure.md',
    status: 'active',
    version: '1.0',
    effective_date: '2026-01-01',
    responsible_area: 'Finance',
    description: 'Provides the approval and substantiation controls for organization spending.',
  },
  {
    document_code: 'FIN-PUR-001',
    title: 'Purchasing Procedure',
    type: 'Procedure',
    domain: 'finance',
    section: 'Finance',
    access: 'internal',
    source_repository: 'Autobiography',
    canonical_path: 'documentation-source/lost_limb_riders_operations/05-FINANCE/05-Purchasing-Procedure.md',
    status: 'active',
    version: '1.0',
    effective_date: '2026-01-01',
    responsible_area: 'Finance',
    description: 'Defines purchase approval, vendor review, and transaction control requirements.',
  },
  {
    document_code: 'EVT-PROC-001',
    title: 'Event Procedures Overview',
    type: 'Procedure',
    domain: 'events',
    section: 'Events',
    access: 'internal',
    source_repository: 'Autobiography',
    canonical_path: 'documentation-source/lost_limb_riders_operations/06-EVENTS/01-Event-Procedures-Overview.md',
    status: 'active',
    version: '1.0',
    effective_date: '2026-01-01',
    responsible_area: 'Events',
    description: 'Covers event authorization, staffing, and event-day operational controls.',
  },
  {
    document_code: 'VOL-PROC-001',
    title: 'Volunteer System Procedure',
    type: 'Procedure',
    domain: 'volunteers',
    section: 'Volunteers',
    access: 'internal',
    source_repository: 'Autobiography',
    canonical_path: 'documentation-source/lost_limb_riders_operations/08-VOLUNTEERS/01-Volunteer-System-Procedure.md',
    status: 'active',
    version: '1.0',
    effective_date: '2026-01-01',
    responsible_area: 'Volunteer Services',
    description: 'Supports volunteer onboarding, assignment, reimbursement, and conflict controls.',
  },
  {
    document_code: 'CMP-IRS-001',
    title: 'Federal 501(c)(3) Compliance Matrix',
    type: 'Reference',
    domain: 'compliance',
    section: 'Compliance',
    access: 'internal',
    source_repository: 'Autobiography',
    canonical_path: 'documentation-source/lost_limb_riders_operations/12-COMPLIANCE/01-IRS-Compliance-Matrix.md',
    status: 'active',
    version: '1.0',
    effective_date: '2026-01-01',
    responsible_area: 'Compliance',
    description: 'Maps federal tax-exempt obligations to the organization’s control documentation.',
  },
  {
    document_code: 'CMP-IA-001',
    title: 'Iowa Compliance Matrix',
    type: 'Reference',
    domain: 'compliance',
    section: 'Compliance',
    access: 'internal',
    source_repository: 'Autobiography',
    canonical_path: 'documentation-source/lost_limb_riders_operations/12-COMPLIANCE/02-Iowa-Compliance-Matrix.md',
    status: 'active',
    version: '1.0',
    effective_date: '2026-01-01',
    responsible_area: 'Compliance',
    description: 'Maps Iowa nonprofit legal and filing obligations to the governing records.',
  },
  {
    document_code: 'REC-LOC-001',
    title: 'Records Location Register',
    type: 'Register',
    domain: 'records',
    section: 'Records Management',
    access: 'internal',
    source_repository: 'Autobiography',
    canonical_path: 'documentation-source/lost_limb_riders_operations/14-RECORDS-MANAGEMENT/01-Records-Location-Register.md',
    status: 'active',
    version: '1.0',
    effective_date: '2026-01-01',
    responsible_area: 'Records',
    description: 'Identifies where authorized records are held and how they are controlled.',
  },
  {
    document_code: 'MEM-HBK-001',
    title: 'Member Handbook',
    type: 'Handbook',
    domain: 'community',
    section: 'Handbooks',
    access: 'public',
    source_repository: 'Autobiography',
    canonical_path: 'documentation-source/lost_limb_riders_handbooks/02-Member-Handbook/00-MEMBER-HANDBOOK.md',
    status: 'active',
    version: '1.0',
    effective_date: '2026-01-01',
    responsible_area: 'Operations',
    description: 'Public operational guide for members and participants.',
  },
  {
    document_code: 'PART-REL-001',
    title: 'Participant Release of Liability',
    type: 'Form',
    domain: 'community',
    section: 'Forms & Templates',
    access: 'public',
    source_repository: 'Autobiography',
    canonical_path: 'documentation-source/lost_limb_riders_handbooks/04-Forms-and-Templates/01-Participant-Release-of-Liability.md',
    status: 'active',
    version: '1.0',
    effective_date: '2026-01-01',
    responsible_area: 'Program Operations',
    description: 'Required release form for participants in activities and events.',
  },
  {
    document_code: 'ORG-HBK-001',
    title: 'Organization Handbook',
    type: 'Handbook',
    domain: 'governance',
    section: 'Governance',
    access: 'internal',
    source_repository: 'Autobiography',
    canonical_path: 'documentation-source/lost_limb_riders_handbooks/01-Organization-Handbook/00-ORGANIZATION-HANDBOOK.md',
    status: 'active',
    version: '1.0',
    effective_date: '2026-01-01',
    responsible_area: 'Governance',
    description: 'The core governance handbook for the organization and leadership.',
  },
];

export const DOCUMENT_REGISTRY = BASE_DOCS.map((doc) => ({
  ...doc,
  source_url: `${DOCUMENT_SOURCE_PATH}${doc.canonical_path.replace(/^documentation-source\//, '')}`,
}));

export function getDocumentRegistry() {
  return DOCUMENT_REGISTRY.map((doc) => ({ ...doc }));
}

export function getActiveDocuments() {
  return getDocumentRegistry().filter((doc) => doc.status === 'active');
}

export function classifyDocumentsByDomain(docs = getActiveDocuments()) {
  const map = new Map();
  for (const doc of docs) {
    const key = doc.section || doc.domain || 'Other';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(doc);
  }
  return Array.from(map.entries()).map(([section, items]) => ({ section, items }));
}

export function findDocumentByCode(code) {
  return getDocumentRegistry().find((doc) => doc.document_code === code) || null;
}

export function filterDocuments(query = '', docs = getActiveDocuments()) {
  const value = String(query || '').trim().toLowerCase();
  if (!value) return docs;
  return docs.filter((doc) => {
    const haystack = [
      doc.document_code,
      doc.title,
      doc.type,
      doc.domain,
      doc.description,
      doc.section,
      doc.responsible_area,
    ].join(' ').toLowerCase();
    return haystack.includes(value);
  });
}

export const COMPLIANCE_REQUIREMENTS = [
  {
    id: 'REQ-ORG-01',
    title: 'Governance and document control',
    domain: 'governance',
    review_interval_days: 365,
    summary: 'The organization maintains a current governing and records framework with explicit control ownership.',
    evidence: [
      { document_code: 'GOV-POL-001', section: 'Document control and versioning', canonical_path: 'documentation-source/lost_limb_riders_operations/01-GOVERNANCE/01-Master-Document-Control-Policy.md' },
      { document_code: 'ORG-HBK-001', section: 'Governance overview', canonical_path: 'documentation-source/lost_limb_riders_handbooks/01-Organization-Handbook/00-ORGANIZATION-HANDBOOK.md' },
      { document_code: 'REC-LOC-001', section: 'Records register', canonical_path: 'documentation-source/lost_limb_riders_operations/14-RECORDS-MANAGEMENT/01-Records-Location-Register.md' },
    ],
  },
  {
    id: 'REQ-FIN-01',
    title: 'Financial controls and approval integrity',
    domain: 'finance',
    review_interval_days: 365,
    summary: 'Approval, purchasing, and reimbursement controls are mapped to active finance documents and authorization procedures.',
    evidence: [
      { document_code: 'FIN-EXP-002', section: 'Expense controls', canonical_path: 'documentation-source/lost_limb_riders_operations/05-FINANCE/02-Expense-and-Reimbursement-Procedure.md' },
      { document_code: 'FIN-PUR-001', section: 'Purchase controls', canonical_path: 'documentation-source/lost_limb_riders_operations/05-FINANCE/05-Purchasing-Procedure.md' },
      { document_code: 'GOV-REC-001', section: 'Records retention', canonical_path: 'documentation-source/lost_limb_riders_operations/01-GOVERNANCE/03-Records-Policy.md' },
    ],
  },
  {
    id: 'REQ-HR-01',
    title: 'Employment lifecycle and disciplinary management',
    domain: 'human-resources',
    review_interval_days: 365,
    summary: 'Human resources policies define lifecycle controls from recruitment through separation and disciplinary action.',
    evidence: [
      { document_code: 'HR-PROC-001', section: 'Employee lifecycle control', canonical_path: 'documentation-source/lost_limb_riders_operations/03-HUMAN-RESOURCES/02-Employee-Lifecycle-Procedure.md' },
      { document_code: 'HR-PROC-005', section: 'Corrective action', canonical_path: 'documentation-source/lost_limb_riders_operations/03-HUMAN-RESOURCES/17-Disciplinary-Procedure.md' },
    ],
  },
  {
    id: 'REQ-EVT-01',
    title: 'Event safety and participant management',
    domain: 'events',
    review_interval_days: 365,
    summary: 'Operational event procedures define authorization, staffing, and participant management controls.',
    evidence: [
      { document_code: 'EVT-PROC-001', section: 'Event control overview', canonical_path: 'documentation-source/lost_limb_riders_operations/06-EVENTS/01-Event-Procedures-Overview.md' },
      { document_code: 'PART-REL-001', section: 'Participant release', canonical_path: 'documentation-source/lost_limb_riders_handbooks/04-Forms-and-Templates/01-Participant-Release-of-Liability.md' },
    ],
  },
  {
    id: 'REQ-CMP-01',
    title: 'Regulatory and compliance review',
    domain: 'compliance',
    review_interval_days: 365,
    summary: 'The compliance matrix identifies federal and Iowa obligations, and review status should be updated as the organization completes annual checks.',
    evidence: [
      { document_code: 'CMP-IRS-001', section: 'Federal matrix', canonical_path: 'documentation-source/lost_limb_riders_operations/12-COMPLIANCE/01-IRS-Compliance-Matrix.md' },
      { document_code: 'CMP-IA-001', section: 'Iowa matrix', canonical_path: 'documentation-source/lost_limb_riders_operations/12-COMPLIANCE/02-Iowa-Compliance-Matrix.md' },
    ],
  },
];

export function buildComplianceMatrix(documentState = [], complianceState = [], now = new Date()) {
  return COMPLIANCE_REQUIREMENTS.map((requirement) => evaluateRequirement(
    requirement.id,
    documentState,
    complianceState,
    now,
  ));
}

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function evaluateRequirement(requirementId, documentState = [], complianceState = [], now = new Date()) {
  const requirement = COMPLIANCE_REQUIREMENTS.find((entry) => entry.id === requirementId);
  if (!requirement) {
    return { id: requirementId, status: 'Unknown', summary: 'Requirement is not defined in the registry.', evidence: [] };
  }
  const record = complianceState.find((item) => item && item.requirement_id === requirement.id) || {};
  const evidence = requirement.evidence.map((item) => {
    const document = findDocumentByCode(item.document_code);
    const state = documentState.find((entry) => entry && entry.document_code === item.document_code) || {};
    return { ...item, document, availability: state.availability || 'unknown', checked_at: state.checked_at || null, error: state.error || null };
  });
  let status = 'Unknown';
  const today = validDate(now) || new Date();
  const dueDate = validDate(record.due_date);
  const expiresAt = validDate(record.expires_at);
  if (record.not_applicable === true) status = 'Not Applicable';
  else if (evidence.some((item) => !item.document || item.availability === 'missing')) status = 'Missing';
  else if (evidence.some((item) => item.availability === 'unavailable')) status = 'Incomplete';
  else if (expiresAt && expiresAt < today) status = 'Expired';
  else if (dueDate && dueDate < today) status = 'Overdue';
  else if (dueDate && dueDate.getTime() - today.getTime() <= 30 * 86400000) status = 'Due Soon';
  else if (record.review_status === 'pending') status = 'Pending Review';
  else if (evidence.some((item) => item.availability === 'unknown')) status = 'Unknown';
  else if (record.review_status === 'approved') status = 'Compliant';
  else status = 'Incomplete';
  return {
    id: requirement.id,
    title: requirement.title,
    domain: requirement.domain,
    status,
    summary: requirement.summary,
    due_date: record.due_date || null,
    expires_at: record.expires_at || null,
    review_status: record.review_status || null,
    reviewed_at: record.reviewed_at || null,
    evidence,
  };
}

export function calculateComplianceScore(results) {
  const applicable = results.filter((item) => item.status !== 'Not Applicable');
  if (!applicable.length) return null;
  return Math.round((applicable.filter((item) => item.status === 'Compliant').length / applicable.length) * 100);
}
