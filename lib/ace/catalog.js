import { TEMPLATES as CONTROLLED_TEMPLATES } from './templates.js';
import { findDocumentByCode, DOCUMENT_SOURCE_REVISION } from '../document-registry.js';
import { COMPLIANCE_WORKFLOW_MANIFEST } from '../compliance-workflows.generated.js';
import { buildLegacyWorkflows, buildLegacyTemplates } from './legacy.js';

import pursueGrant from './workflows/01-grants-pursue-grant.workflow.js';
import onboardMember from './workflows/02-onboarding-onboard-member.workflow.js';
import onboardVolunteer from './workflows/03-onboarding-onboard-volunteer.workflow.js';
import onboardEmployee from './workflows/04-onboarding-onboard-employee.workflow.js';
import hostEvent from './workflows/05-events-host-event.workflow.js';
import safetyTraining from './workflows/06-safety-safety-training.workflow.js';

const REFERENCE_WORKFLOWS = [
  pursueGrant,
  onboardMember,
  onboardVolunteer,
  onboardEmployee,
  hostEvent,
  safetyTraining,
];

export const WORKFLOW_PROVENANCE = Object.freeze({
  document_id: 'ADM-REF-002',
  source_path: COMPLIANCE_WORKFLOW_MANIFEST.source_path,
  source_version: COMPLIANCE_WORKFLOW_MANIFEST.source_version,
  source_hash: COMPLIANCE_WORKFLOW_MANIFEST.source_hash,
});

function normalizeDefinition(workflow) {
  const lifecycle = workflow.lifecycle || [];
  const referencedDocuments = Array.from(new Set([
    ...(workflow.workingDocuments || []),
    ...lifecycle.flatMap((stage) => (stage.documentsRequired || []).map((entry) => entry.documentId)),
  ]));
  return {
    ...workflow,
    legacy: Boolean(workflow.legacy),
    source: workflow.source || [],
    governingDocuments: workflow.governingDocuments || [],
    referenceDocuments: workflow.referenceDocuments || [],
    workingDocuments: workflow.workingDocuments || [],
    activeSections: workflow.activeSections || [],
    purpose: workflow.purpose || workflow.summary,
    whenToUse: workflow.whenToUse || [`Use this workflow when performing: ${workflow.name || workflow.intent}.`],
    whenNotToUse: workflow.whenNotToUse || ['Do not use this record for a different organizational action; return to the workflow library and select the matching process.'],
    prerequisites: workflow.prerequisites || (lifecycle[0] ? [`Be prepared to complete “${lifecycle[0].label}” with the ${lifecycle[0].role || 'responsible role'} and retain the evidence it requests.`] : []),
    beforeYouBegin: workflow.beforeYouBegin || (referencedDocuments.length
      ? referencedDocuments.map((id) => `Have the information needed to complete or reference ${id}.`)
      : [`Review ${workflow.source?.[0]?.id || 'the governing source'} and have the information requested by the first stage available.`]),
    outputs: workflow.outputs || [`A completed, auditable ${workflow.name || workflow.intent} compliance record.`],
    exceptions: workflow.exceptions || ['If a required item is unavailable, do not enter placeholder information or bypass the gate. Record the issue in evidence and contact the responsible role shown for the current stage.'],
    followUp: workflow.followUp || (lifecycle.at(-1) ? [`After “${lifecycle.at(-1).label}” is complete, retain the resulting record and carry out any follow-up stated in that stage.`] : []),
    retention: workflow.retention || 'Retain this record and its evidence according to the controlled source documents and records schedule referenced by the workflow.',
    completionCriteria: workflow.completionCriteria || lifecycle.map((stage) => `Complete “${stage.label}” and satisfy every displayed field, evidence, document, signature, and approval gate.`),
  };
}

export const WORKFLOWS = Object.freeze([...REFERENCE_WORKFLOWS, ...buildLegacyWorkflows()].map((workflow) => Object.freeze(normalizeDefinition(workflow))));

export const TEMPLATES = Object.freeze({
  ...CONTROLLED_TEMPLATES,
  ...buildLegacyTemplates(),
});

export const CATEGORY_GROUPS = Object.freeze({
  grants: { id: 'grants', name: 'Grants & Restricted Funds', parent: 'Financial Stewardship', description: 'Grant pursuit, award administration, reporting, closeout, and restricted-fund controls.' },
  onboarding: { id: 'onboarding', name: 'Onboarding', parent: 'People Operations', description: 'Controlled entry of members, volunteers, and employees.' },
  people: { id: 'people', name: 'Workforce, Volunteers & Contractors', parent: 'People Operations', description: 'Employment, volunteer, contractor, payroll, performance, discipline, and separation operations.' },
  events: { id: 'events', name: 'Events & Programs', parent: 'Programs & Service', description: 'Event authorization, execution, financial reconciliation, and closeout.' },
  safety: { id: 'safety', name: 'Safety, Incidents & Risk', parent: 'Programs & Service', description: 'Incident response, safety training, escalation, insurance review, and corrective action.' },
  finance: { id: 'finance', name: 'Finance, Procurement & Fundraising', parent: 'Financial Stewardship', description: 'Purchasing, accounting, reimbursements, contractor payments, donations, and sponsorships.' },
  assets: { id: 'assets', name: 'Assets & Equipment', parent: 'Organizational Operations', description: 'Acquisition, custody, records, and disposal of organizational assets and equipment.' },
});

export function resolveCategoryGroups() {
  const groups = {};
  for (const category of Object.keys(CATEGORY_GROUPS)) {
    groups[category] = {
      ...CATEGORY_GROUPS[category],
      workflows: WORKFLOWS.filter((workflow) => workflow.category === category).map((workflow) => publicWorkflow(workflow)),
    };
  }
  return groups;
}

export function getWorkflow(id) {
  return WORKFLOWS.find((workflow) => workflow.id === id) || null;
}

export function getTemplate(id) {
  return TEMPLATES[id] || null;
}

export function resolveDocumentCode(id) {
  const resolved = findDocumentByCode(id);
  return {
    document_id: id,
    document_code: resolved ? resolved.document_code : null,
    title: resolved ? resolved.title : null,
    available: Boolean(resolved),
  };
}

export function publicWorkflow(workflow) {
  return {
    id: workflow.id,
    name: workflow.name,
    category: workflow.category,
    categoryGroup: workflow.categoryGroup,
    idPrefix: workflow.idPrefix,
    workflowVersion: workflow.workflowVersion,
    legacy: Boolean(workflow.legacy),
    summary: workflow.summary,
    purpose: workflow.purpose,
    whenToUse: workflow.whenToUse,
    whenNotToUse: workflow.whenNotToUse,
    prerequisites: workflow.prerequisites,
    beforeYouBegin: workflow.beforeYouBegin,
    outputs: workflow.outputs,
    exceptions: workflow.exceptions,
    followUp: workflow.followUp,
    retention: workflow.retention,
    completionCriteria: workflow.completionCriteria,
    source: workflow.source.map((entry) => ({ id: entry.id, section: entry.section, ...resolveDocumentCode(entry.id) })),
    source_provenance: WORKFLOW_PROVENANCE,
    templateId: workflow.templateId,
    creationSection: workflow.creationSection,
    titleField: workflow.titleField,
    activeSections: workflow.activeSections,
    governingDocuments: (workflow.governingDocuments || []).map((entry) => ({ ...entry, ...resolveDocumentCode(entry.id) })),
    referenceDocuments: (workflow.referenceDocuments || []).map((entry) => ({ ...entry, ...resolveDocumentCode(entry.id) })),
    workingDocuments: (workflow.workingDocuments || []).map((id) => resolveDocumentCode(id)),
    lifecycle: workflow.lifecycle.map((stage) => publicStage(stage)),
  };
}

function publicStage(stage) {
  return {
    id: stage.id,
    label: stage.label,
    instructions: stage.instructions,
    purpose: stage.purpose,
    role: stage.role,
    source: stage.source ? { id: stage.source.id, section: stage.source.section, ...resolveDocumentCode(stage.source.id) } : null,
    sectionsRequired: stage.sectionsRequired || [],
    documentsRequired: (stage.documentsRequired || []).map((entry) => ({ ...entry, ...resolveDocumentCode(entry.documentId) })),
    signaturesRequired: stage.signaturesRequired || [],
    evidenceRequired: Boolean(stage.evidenceRequired) || Boolean(stage.approvalRequired),
    evidenceLabel: stage.evidenceLabel || '',
    approvalRequired: Boolean(stage.approvalRequired),
    approvalRules: stage.approvalRules || [],
    referenceDocuments: (stage.referenceDocuments || []).map((entry) => ({ ...entry, ...resolveDocumentCode(entry.id) })),
    satisfiedByIntake: Boolean(stage.satisfiedByIntake),
    legacyEvidenceType: stage.legacyEvidenceType || 'TEXT',
    when: stage.when || null,
    blockingRules: stage.blockingRules || [],
  };
}

export function publicTemplate(template) {
  return {
    id: template.id,
    name: template.name,
    version: template.version || '1.0',
    description: template.description || '',
    controlled: template.controlled !== false && template.legacyGenerated !== true,
    legacyGenerated: Boolean(template.legacyGenerated),
    sections: (template.sections || []).map((section) => ({
      id: section.id,
      name: section.name || section.title || section.id,
      role: section.role || '',
      sectionFile: section.sectionFile || null,
      description: section.description || section.help || '',
      fields: (section.fields || []).map((field) => ({ ...field })),
    })),
    documents: (template.documents || []).map((document) => ({
      id: document.id,
      title: document.title,
      note: document.note || '',
      fields: (document.fields || []).map((field) => ({ ...field })),
      signatureDefinitions: (document.signatureDefinitions || []).map((signature) => ({ ...signature })),
    })),
  };
}

export function workflowSourceRevision() {
  return {
    ...WORKFLOW_PROVENANCE,
    source_revision: DOCUMENT_SOURCE_REVISION,
  };
}
