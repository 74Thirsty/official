// lib/docs/config.js — centralized documentation configuration.
// The repository (Autobiography, mounted as a git submodule at documentation-source/)
// remains the single source of truth; this module defines how the website indexes and
// categorizes it. No document bodies are stored here — only the registry schema.

import { fileURLToPath } from 'url';
import path from 'path';

// Resolve the submodule source root relative to this file: <repo>/lib/docs -> <repo>/
export const REPO_ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

// Default source content root: the pinned Autobiography git submodule.
export const SOURCE_ROOT = path.join(REPO_ROOT, process.env.DOCS_SOURCE_ROOT || 'documentation-source');

// Deployed/known snapshot commit (advance the submodule pointer + update this when
// content is released to master). Used for source-commit metadata on sync.
export const SOURCE_BRANCH = 'master';
export const SOURCE_REPOSITORY = 'https://github.com/LostLimbRider/Autobiography';

// Paths never indexed (directive §55, §88).
export const EXCLUDED_DIRS = new Set(['.git', 'node_modules', '.github', 'assets']);
export const EXCLUDED_FILES = new Set(['README.md', 'AGENTS.md', 'context.md', 'LICENSE', 'LICENSE.md']);

// Controlled vocabularies (directive §8, §9, §10).
export const DOC_TYPES = [
  'Policy', 'SOP', 'Procedure', 'Checklist', 'Form', 'Template', 'Handbook', 'Manual',
  'Program Manual', 'Job Description', 'Agreement', 'Contract', 'Register', 'Worksheet',
  'Report', 'Audit', 'Governance', 'Financial', 'HR', 'Safety', 'Event', 'Grant', 'Training',
  'Reference', 'Index', 'Legal', 'Other',
];

export const DOC_STATUS = [
  'Active', 'Superseded', 'Archived', 'Draft', 'Under Review', 'Pending Approval',
  'Suspended', 'Unknown',
];

export const AUTHORITY = [
  'Authoritative', 'Supporting', 'Reference', 'Draft', 'Archived', 'Superseded',
  'Non-authoritative',
];

export const VISIBILITY = ['public', 'internal', 'restricted', 'confidential'];

// Department derived from path segment; anything unmapped -> 'Other'.
export const DEPARTMENT_BY_DIR = {
  '01-GOVERNANCE': 'Governance',
  '02-ADMINISTRATION': 'Administration',
  '03-HUMAN-RESOURCES': 'Human Resources',
  '04-CONTRACTORS': 'Contractors',
  '05-FINANCE': 'Finance',
  '06-EVENTS': 'Events',
  '07-PROGRAMS': 'Programs',
  '08-VOLUNTEERS': 'Volunteers',
  '09-SAFETY-RISK': 'Safety & Risk',
  '10-FUNDRAISING': 'Fundraising',
  '11-GRANTS': 'Grants',
  '12-COMPLIANCE': 'Compliance',
  '13-FORMS-AND-TEMPLATES': 'Forms & Templates',
  '14-RECORDS-MANAGEMENT': 'Records Management',
  employees: 'Human Resources',
  ARCHIVE: 'Archive',
};

// Document-Id token used for cross-reference resolution.
// Matches three-part controlled IDs (HR-FORM-001, FIN-PROC-004, GOV-POL-001) and
// two-part IDs (CTR-001). Ordered alternation prevents partial matches.
export const ID_TOKEN_RE =
  /\b[A-Z]{2,5}-[A-Z]+-\d{3}\b|\b[A-Z]{2,5}-\d{3}\b/g;

// Transaction/record IDs that are live data (not controlled documents) — used to
// avoid flagging them as broken document references.
export const TRANSACTION_PREFIXES = ['EMP-', 'CTR-', 'EVT-', 'EXP-', 'DON-', 'SPN-',
  'GRT-', 'AST-', 'INC-', 'BRD-', 'TIM-', 'PAY-'];

// Header fields recognized in controlled docs (directive §6 metadata).
export const HEADER_FIELDS = [
  'Document ID', 'Document Title', 'Department', 'Document Type', 'Version',
  'Effective Date', 'Review Date', 'Document Owner', 'Approving Authority',
  'Supersedes', 'Related Documents', 'Related Forms', 'Record Classification',
  'Retention Requirement', 'Status',
];

export default {
  REPO_ROOT,
  SOURCE_ROOT,
  SOURCE_BRANCH,
  SOURCE_REPOSITORY,
  EXCLUDED_DIRS,
  EXCLUDED_FILES,
  DOC_TYPES,
  DOC_STATUS,
  AUTHORITY,
  VISIBILITY,
  DEPARTMENT_BY_DIR,
};