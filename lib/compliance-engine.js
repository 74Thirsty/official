import { randomBytes } from 'node:crypto';
import { COMPLIANCE_WORKFLOW_MANIFEST } from './compliance-workflows.generated.js';
import { findDocumentByCode, DOCUMENT_SOURCE_REVISION } from './document-registry.js';

import safetyReportIncident from './workflows/01-safety-report-incident.workflow.js';
import peopleHireEmployee from './workflows/02-people-hire-employee.workflow.js';
import peopleProcessPayroll from './workflows/03-people-process-payroll.workflow.js';
import peopleChangeCompensation from './workflows/04-people-change-compensation.workflow.js';
import peoplePerformanceReview from './workflows/05-people-performance-review.workflow.js';
import peopleEmployeeDiscipline from './workflows/06-people-employee-discipline.workflow.js';
import peopleTerminateEmployee from './workflows/07-people-terminate-employee.workflow.js';
import peopleEngageContractor from './workflows/08-people-engage-contractor.workflow.js';
import financeContractorPayment from './workflows/09-finance-contractor-payment.workflow.js';
import financeContractor1099Review from './workflows/10-finance-contractor-1099-review.workflow.js';
import peopleOnboardVolunteer from './workflows/11-people-onboard-volunteer.workflow.js';
import peopleAssignVolunteer from './workflows/12-people-assign-volunteer.workflow.js';
import peopleRecordVolunteerService from './workflows/13-people-record-volunteer-service.workflow.js';
import peopleEndVolunteerAssignment from './workflows/14-people-end-volunteer-assignment.workflow.js';
import eventsAuthorizeEvent from './workflows/15-events-authorize-event.workflow.js';
import eventsCloseOutEvent from './workflows/16-events-close-out-event.workflow.js';
import financeProcessPurchase from './workflows/17-finance-process-purchase.workflow.js';
import financeRequestReimbursement from './workflows/18-finance-request-reimbursement.workflow.js';
import financeAcceptDonation from './workflows/19-finance-accept-donation.workflow.js';
import financeExecuteSponsorship from './workflows/20-finance-execute-sponsorship.workflow.js';
import financeAdministerGrant from './workflows/21-finance-administer-grant.workflow.js';
import assetsAcquireAsset from './workflows/22-assets-acquire-asset.workflow.js';
import assetsDisposeAsset from './workflows/23-assets-dispose-asset.workflow.js';
import peopleChangeVolunteerAssignment from './workflows/24-people-change-volunteer-assignment.workflow.js';
import peopleSuspendVolunteer from './workflows/25-people-suspend-volunteer.workflow.js';

const WORKFLOW_DEFINITIONS = [
  safetyReportIncident,
  peopleHireEmployee,
  peopleProcessPayroll,
  peopleChangeCompensation,
  peoplePerformanceReview,
  peopleEmployeeDiscipline,
  peopleTerminateEmployee,
  peopleEngageContractor,
  financeContractorPayment,
  financeContractor1099Review,
  peopleOnboardVolunteer,
  peopleAssignVolunteer,
  peopleRecordVolunteerService,
  peopleEndVolunteerAssignment,
  eventsAuthorizeEvent,
  eventsCloseOutEvent,
  financeProcessPurchase,
  financeRequestReimbursement,
  financeAcceptDonation,
  financeExecuteSponsorship,
  financeAdministerGrant,
  assetsAcquireAsset,
  assetsDisposeAsset,
  peopleChangeVolunteerAssignment,
  peopleSuspendVolunteer,
];

export const WORKFLOW_PROVENANCE = Object.freeze({
  document_id: 'ADM-REF-002',
  source_path: COMPLIANCE_WORKFLOW_MANIFEST.source_path,
  source_version: COMPLIANCE_WORKFLOW_MANIFEST.source_version,
  source_hash: COMPLIANCE_WORKFLOW_MANIFEST.source_hash,
});

export const COMPLIANCE_WORKFLOWS = Object.freeze(WORKFLOW_DEFINITIONS.map((workflow) => Object.freeze({
  ...workflow,
  source: Object.freeze(workflow.source.map((entry) => Object.freeze({ ...entry }))),
  intake: Object.freeze(workflow.intake.map((field) => Object.freeze({ ...field, options: Object.freeze(field.options || []) }))),
  requirements: Object.freeze(workflow.requirements.map((requirement) => Object.freeze({
    ...requirement,
    source: Object.freeze({ ...requirement.source }),
    documents: Object.freeze(requirement.documents.map((document) => Object.freeze({ ...document }))),
    evidence: Object.freeze({ ...requirement.evidence }),
  }))),
})));

export function getComplianceWorkflow(id) {
  return COMPLIANCE_WORKFLOWS.find((workflow) => workflow.id === id) || null;
}

export function publicWorkflow(workflow) {
  return {
    id: workflow.id,
    intent: workflow.intent,
    domain: workflow.domain,
    idPrefix: workflow.idPrefix,
    summary: workflow.summary,
    source: workflow.source.map((entry) => {
      const resolved = findDocumentByCode(entry.id);
      return { id: entry.id, section: entry.section, document_code: resolved ? resolved.document_code : null, title: resolved ? resolved.title : null };
    }),
    source_provenance: WORKFLOW_PROVENANCE,
    intake: workflow.intake,
    requirements: workflow.requirements.map((requirement) => ({
      id: requirement.id,
      title: requirement.title,
      instructions: requirement.instructions,
      purpose: requirement.purpose,
      role: requirement.role,
      source: requirement.source,
      approval_required: Boolean(requirement.approval_required),
      satisfied_by_intake: Boolean(requirement.satisfied_by_intake),
      auto_register: requirement.auto_register ? { register_id: requirement.auto_register.register_id } : null,
      auto_register_close: requirement.auto_register_close ? { status: requirement.auto_register_close.status } : null,
      documents: requirement.documents.map((document) => {
        const resolved = findDocumentByCode(document.id);
        return {
          document_id: document.id,
          note: document.note || '',
          document_code: resolved ? resolved.document_code : null,
          title: resolved ? resolved.title : null,
        };
      }),
      evidence: requirement.evidence,
    })),
  };
}

export function validateIntake(workflow, input) {
  const payload = (input && typeof input === 'object') ? input : {};
  const errors = [];
  const values = {};
  for (const field of workflow.intake || []) {
    const raw = payload[field.name];
    const value = (typeof raw === 'string' ? raw : raw == null ? '' : String(raw)).trim();
    if (field.type === 'number') {
      const numeric = value === '' ? null : Number(value);
      if (field.required && (value === '' || numeric == null || !Number.isFinite(numeric))) {
        errors.push(`${field.label} is required.`);
        continue;
      }
      if (value !== '' && (numeric == null || !Number.isFinite(numeric))) {
        errors.push(`${field.label} must be a number.`);
        continue;
      }
      values[field.name] = numeric;
      continue;
    }
    if (field.required && value === '') {
      errors.push(`${field.label} is required.`);
      continue;
    }
    if (field.maxlen && value.length > field.maxlen) {
      errors.push(`${field.label} must be ${field.maxlen} characters or fewer.`);
      continue;
    }
    if (field.type === 'select' && value && Array.isArray(field.options) && field.options.length && !field.options.includes(value)) {
      errors.push(`${field.label} has an invalid option.`);
      continue;
    }
    values[field.name] = value;
  }
  return errors.length ? { errors } : { values };
}

function event(type, actor, details = {}) {
  return { id: randomBytes(8).toString('hex'), at: new Date().toISOString(), type, actor, ...details };
}

function expandTemplate(template, transaction) {
  return String(template).replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    if (path === 'id') return transaction.id;
    if (path.startsWith('intake.')) {
      const key = path.slice('intake.'.length);
      const value = transaction.intake && transaction.intake[key];
      return value == null ? '' : String(value);
    }
    return match;
  });
}

function buildRegisters(workflow, transaction) {
  const registers = [];
  for (const requirement of workflow.requirements) {
    if (!requirement.auto_register) continue;
    const rowColumns = {};
    const columns = requirement.auto_register.columns || {};
    for (const header of Object.keys(columns)) {
      rowColumns[header] = expandTemplate(columns[header], transaction);
    }
    registers.push({
      register_id: requirement.auto_register.register_id,
      requirement_id: requirement.id,
      columns: rowColumns,
      closed_at: null,
    });
  }
  return registers;
}

export function createComplianceTransaction(workflow, input, actor) {
  const now = new Date().toISOString();
  const prefix = String(workflow.idPrefix || workflow.id.split('-').map((part) => part[0]).join('').slice(0, 4)).toUpperCase();
  const transaction = {
    id: `${prefix}-${new Date().getUTCFullYear()}-${randomBytes(3).toString('hex').toUpperCase()}`,
    workflow_id: workflow.id,
    intent: workflow.intent,
    workflow_source: {
      ...WORKFLOW_PROVENANCE,
      source_revision: DOCUMENT_SOURCE_REVISION,
      sources: workflow.source,
    },
    title: String(input[workflow.titleField.name] ?? ''),
    intake: { ...input },
    status: 'active',
    current_requirement: 0,
    created_at: now,
    updated_at: now,
    created_by: actor,
    requirements: workflow.requirements.map((requirement) => {
      if (requirement.satisfied_by_intake) {
        return {
          requirement_id: requirement.id,
          status: 'complete',
          evidence: [{
            id: randomBytes(8).toString('hex'),
            at: now,
            actor,
            description: `${requirement.evidence?.label || 'Entered when the transaction was created.'}`,
            url: '',
            kind: 'intake',
          }],
          approval: null,
        };
      }
      return { requirement_id: requirement.id, status: 'incomplete', evidence: [], approval: null };
    }),
    registers: [],
    audit: [event('transaction_created', actor, { workflow_id: workflow.id, intent: workflow.intent })],
  };
  transaction.registers = buildRegisters(workflow, transaction);
  return transaction;
}

export function addComplianceEvidence(transaction, workflow, requirementId, evidence, actor) {
  if (transaction.status !== 'active') throw new Error('Completed transactions cannot be changed.');
  const requirementIndex = workflow.requirements.findIndex((requirement) => requirement.id === requirementId);
  if (requirementIndex < 0) throw new Error('Requirement not found.');
  if (requirementIndex !== transaction.current_requirement) throw new Error('Evidence may only be added to the current requirement.');
  const requirement = transaction.requirements[requirementIndex];
  const definition = workflow.requirements[requirementIndex];
  if (definition.satisfied_by_intake) throw new Error('This requirement is satisfied by the information entered at creation.');
  const record = {
    id: randomBytes(8).toString('hex'),
    at: new Date().toISOString(),
    actor,
    description: evidence.description,
    url: evidence.url || '',
    kind: 'operator',
  };
  requirement.evidence.push(record);
  requirement.status = definition.approval_required ? 'awaiting_approval' : 'complete';
  if (definition.auto_register_close) {
    for (const register of transaction.registers) {
      if (register.closed_at) continue;
      register.closed_at = record.at;
      for (const header of Object.keys(register.columns)) {
        if (String(register.columns[header]).toLowerCase() === 'open') {
          register.columns[header] = definition.auto_register_close.status || 'Closed';
        }
      }
    }
  }
  transaction.updated_at = record.at;
  transaction.audit.unshift(event('evidence_added', actor, { requirement_id: requirementId, evidence_id: record.id }));
  return transaction;
}

export function approveComplianceRequirement(transaction, workflow, requirementId, actor, approvalRuleId = '') {
  if (transaction.status !== 'active') throw new Error('Completed transactions cannot be changed.');
  const requirementIndex = workflow.requirements.findIndex((requirement) => requirement.id === requirementId);
  if (requirementIndex < 0) throw new Error('Requirement not found.');
  const requirement = transaction.requirements[requirementIndex];
  const definition = workflow.requirements[requirementIndex];
  if (!definition.approval_required) throw new Error('This requirement does not require approval.');
  if (!requirement.evidence.length) throw new Error('Evidence is required before approval.');
  if (requirement.evidence.some((item) => item.actor === actor)) throw new Error('The evidence submitter cannot approve the same requirement.');
  const rule = (definition.approval_rules || []).find((item) => item.id === approvalRuleId);
  if (definition.approval_rules && definition.approval_rules.length && !rule) {
    throw new Error('Applicable canonical approval authority is required.');
  }
  requirement.approval = {
    at: new Date().toISOString(),
    actor,
    rule_id: rule ? rule.id : null,
    authority: rule ? rule.authority : 'Approval authority documented in the referenced control record',
    condition: rule ? rule.condition : '',
    source_document_id: rule ? rule.source_document_id : (definition.documents[0]?.id || workflow.source[0]?.id || WORKFLOW_PROVENANCE.document_id),
  };
  requirement.status = 'complete';
  transaction.updated_at = requirement.approval.at;
  transaction.audit.unshift(event('requirement_approved', actor, { requirement_id: requirementId }));
  return transaction;
}

export function advanceComplianceTransaction(transaction, workflow, actor) {
  if (transaction.status !== 'active') throw new Error('Transaction is already complete.');
  const requirement = transaction.requirements[transaction.current_requirement];
  if (!requirement || requirement.status !== 'complete') throw new Error('Current requirement is blocking progression.');
  const previous = transaction.current_requirement;
  if (previous === workflow.requirements.length - 1) {
    transaction.status = 'complete';
    transaction.completed_at = new Date().toISOString();
    transaction.audit.unshift(event('transaction_completed', actor, { completed_requirement: previous }));
  } else {
    transaction.current_requirement += 1;
  }
  transaction.updated_at = new Date().toISOString();
  transaction.audit.unshift(event('transaction_advanced', actor, { from_requirement: previous, to_requirement: transaction.current_requirement, status: transaction.status }));
  return transaction;
}