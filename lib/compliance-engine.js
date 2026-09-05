import { randomBytes } from 'node:crypto';
import { COMPLIANCE_WORKFLOW_MANIFEST } from './compliance-workflows.generated.js';
import { findDocumentByCode, DOCUMENT_SOURCE_REVISION } from './document-registry.js';

export const COMPLIANCE_WORKFLOWS = Object.freeze(COMPLIANCE_WORKFLOW_MANIFEST.workflows.map((workflow) => Object.freeze({
  ...workflow,
  stages: workflow.stages.map((stage) => Object.freeze({ ...stage })),
})));

export function getComplianceWorkflow(id) {
  return COMPLIANCE_WORKFLOWS.find((workflow) => workflow.id === id) || null;
}

export function publicWorkflow(workflow) {
  return {
    ...workflow,
    stages: workflow.stages.map((stage) => ({
      ...stage,
      documents: stage.document_ids.map((id) => {
        const document = findDocumentByCode(id);
        return document ? { document_id: id, document_code: document.document_code, title: document.title } : { document_id: id, document_code: null, title: null };
      }),
    })),
  };
}

function event(type, actor, details = {}) {
  return { id: randomBytes(8).toString('hex'), at: new Date().toISOString(), type, actor, ...details };
}

export function createComplianceTransaction(workflow, input, actor) {
  const now = new Date().toISOString();
  const prefix = workflow.id.split('-').map((part) => part[0]).join('').slice(0, 4).toUpperCase();
  return {
    id: `${prefix}-${new Date().getUTCFullYear()}-${randomBytes(3).toString('hex').toUpperCase()}`,
    workflow_id: workflow.id,
    workflow_source: {
      document_id: workflow.source_document_id,
      source_path: workflow.source_path,
      source_version: workflow.source_version,
      source_revision: DOCUMENT_SOURCE_REVISION,
      source_hash: workflow.source_hash,
      source_section: workflow.source_section,
    },
    title: input.title,
    responsible_person: input.responsible_person,
    counterparty: input.counterparty || '',
    amount: input.amount ?? null,
    status: 'active',
    current_stage: 0,
    created_at: now,
    updated_at: now,
    created_by: actor,
    requirements: workflow.stages.map((stage) => ({
      stage_id: stage.id,
      status: 'incomplete',
      evidence: [],
      approval: null,
    })),
    audit: [event('transaction_created', actor, { workflow_id: workflow.id })],
  };
}

export function addComplianceEvidence(transaction, workflow, stageId, evidence, actor) {
  if (transaction.status !== 'active') throw new Error('Completed transactions cannot be changed.');
  const stageIndex = workflow.stages.findIndex((stage) => stage.id === stageId);
  if (stageIndex < 0) throw new Error('Requirement not found.');
  if (stageIndex !== transaction.current_stage) throw new Error('Evidence may only be added to the current requirement.');
  const requirement = transaction.requirements[stageIndex];
  const record = { id: randomBytes(8).toString('hex'), at: new Date().toISOString(), actor, description: evidence.description, url: evidence.url || '' };
  requirement.evidence.push(record);
  requirement.status = workflow.stages[stageIndex].approval_required ? 'awaiting_approval' : 'complete';
  transaction.updated_at = record.at;
  transaction.audit.unshift(event('evidence_added', actor, { stage_id: stageId, evidence_id: record.id }));
  return transaction;
}

export function approveComplianceRequirement(transaction, workflow, stageId, actor, approvalRuleId = '') {
  if (transaction.status !== 'active') throw new Error('Completed transactions cannot be changed.');
  const stageIndex = workflow.stages.findIndex((stage) => stage.id === stageId);
  if (stageIndex < 0) throw new Error('Requirement not found.');
  const stage = workflow.stages[stageIndex];
  const requirement = transaction.requirements[stageIndex];
  if (!stage.approval_required) throw new Error('This requirement does not require approval.');
  if (!requirement.evidence.length) throw new Error('Evidence is required before approval.');
  if (requirement.evidence.some((item) => item.actor === actor)) throw new Error('The evidence submitter cannot approve the same requirement.');
  const approvalRule = stage.approval_rules.find((rule) => rule.id === approvalRuleId);
  if (stage.approval_rules.length && !approvalRule) throw new Error('Applicable canonical approval authority is required.');
  requirement.approval = {
    at: new Date().toISOString(),
    actor,
    rule_id: approvalRule?.id || null,
    authority: approvalRule?.authority || 'Approval authority documented in the stage control record',
    condition: approvalRule?.condition || '',
    source_document_id: approvalRule?.source_document_id || stage.document_ids[0] || workflow.source_document_id,
  };
  requirement.status = 'complete';
  transaction.updated_at = requirement.approval.at;
  transaction.audit.unshift(event('requirement_approved', actor, { stage_id: stageId }));
  return transaction;
}

export function advanceComplianceTransaction(transaction, workflow, actor) {
  if (transaction.status !== 'active') throw new Error('Transaction is already complete.');
  const requirement = transaction.requirements[transaction.current_stage];
  if (!requirement || requirement.status !== 'complete') throw new Error('Current requirement is blocking progression.');
  const previous = transaction.current_stage;
  if (previous === workflow.stages.length - 1) {
    transaction.status = 'complete';
    transaction.completed_at = new Date().toISOString();
  } else {
    transaction.current_stage += 1;
  }
  transaction.updated_at = new Date().toISOString();
  transaction.audit.unshift(event('transaction_advanced', actor, { from_stage: previous, to_stage: transaction.current_stage, status: transaction.status }));
  return transaction;
}
