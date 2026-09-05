import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { COMPLIANCE_WORKFLOW_MANIFEST } from '../lib/compliance-workflows.generated.js';
import {
  COMPLIANCE_WORKFLOWS,
  WORKFLOW_PROVENANCE,
  getComplianceWorkflow,
  publicWorkflow,
  validateIntake,
  createComplianceTransaction,
  addComplianceEvidence,
  approveComplianceRequirement,
  advanceComplianceTransaction,
} from '../lib/compliance-engine.js';

function startWorkflow(workflowId, intake) {
  const workflow = getComplianceWorkflow(workflowId);
  const result = validateIntake(workflow, intake);
  assert.ok(!result.errors, `intake validation: ${(result.errors || []).join(' ')}`);
  const transaction = createComplianceTransaction(workflow, result.values, 'operator');
  return { workflow, transaction };
}

function runToEnd(workflow, transaction, approver = 'admin') {
  for (const requirement of workflow.requirements) {
    const record = transaction.requirements.find((item) => item.requirement_id === requirement.id);
    if (record.status !== 'complete' && !requirement.satisfied_by_intake) {
      addComplianceEvidence(transaction, workflow, requirement.id, { description: `Evidence for ${requirement.title}` }, 'operator');
    }
    if (requirement.approval_required) approveComplianceRequirement(transaction, workflow, requirement.id, approver);
    advanceComplianceTransaction(transaction, workflow, 'operator');
  }
}

test('controlled workflow definitions load the full canonical operation set', () => {
  assert.equal(COMPLIANCE_WORKFLOWS.length, 25);
  assert.equal(new Set(COMPLIANCE_WORKFLOWS.map((workflow) => workflow.id)).size, 25);
  assert.ok(COMPLIANCE_WORKFLOWS.every((workflow) => (
    workflow.id && workflow.intent && workflow.idPrefix && workflow.titleField?.name && workflow.summary
  )));
  assert.ok(COMPLIANCE_WORKFLOWS.every((workflow) => Array.isArray(workflow.intake) && workflow.intake.length));
  assert.ok(COMPLIANCE_WORKFLOWS.every((workflow) => Array.isArray(workflow.requirements) && workflow.requirements.length));
  assert.ok(COMPLIANCE_WORKFLOWS.flatMap((workflow) => workflow.requirements).every((requirement) => (
    requirement.id && requirement.title && requirement.instructions && requirement.purpose && requirement.role && requirement.evidence?.type
  )));
  assert.equal(COMPLIANCE_WORKFLOWS.some((workflow) => workflow.intent === 'Report an Incident'), true);
  assert.equal(COMPLIANCE_WORKFLOWS.some((workflow) => workflow.intent === 'Onboard a Volunteer'), true);
});

test('workflows retain ADM-REF-002 provenance versioned against the unchanged canonical source', async () => {
  assert.equal(WORKFLOW_PROVENANCE.document_id, 'ADM-REF-002');
  assert.equal(WORKFLOW_PROVENANCE.source_path, COMPLIANCE_WORKFLOW_MANIFEST.source_path);
  const source = await readFile(new URL(`../documentation-source/${COMPLIANCE_WORKFLOW_MANIFEST.source_path}`, import.meta.url));
  assert.equal(createHash('sha256').update(source).digest('hex'), COMPLIANCE_WORKFLOW_MANIFEST.source_hash);
  const { transaction } = startWorkflow('report-incident', {
    incident_title: 'Test incident',
    incident_date: '2026-09-05',
    incident_time: '12:00',
    location: 'HQ',
    incident_type: 'Near-miss',
    people_involved: 'A rider',
    what_happened: 'Close call on the trail.',
    injuries_damage: 'None',
    reported_by: 'Rider',
  });
  assert.equal(transaction.workflow_source.document_id, 'ADM-REF-002');
  assert.equal(transaction.workflow_source.source_path, COMPLIANCE_WORKFLOW_MANIFEST.source_path);
  assert.equal(transaction.workflow_source.source_hash, COMPLIANCE_WORKFLOW_MANIFEST.source_hash);
  assert.ok(transaction.workflow_source.sources.length >= 1);
});

test('workflow document and source references use the shared registry and expose canonical defects', () => {
  const incident = publicWorkflow(getComplianceWorkflow('report-incident'));
  const referenced = incident.requirements.flatMap((requirement) => requirement.documents);
  const form = referenced.find((document) => document.document_id === 'SAF-FORM-001');
  assert.equal(form.document_code, 'SAF-FORM-001');
  assert.ok(form.title);
  const documentDefects = referenced.filter((document) => !document.document_code).map((document) => document.document_id);
  assert.deepEqual(documentDefects, []);
  const supreme = incident.source.find((entry) => entry.id === 'SAF-POL-002');
  assert.equal(supreme.document_code, 'SAF-POL-002');
  const sourceDefects = incident.source.filter((entry) => !entry.document_code).map((entry) => entry.id);
  assert.ok(sourceDefects.includes('SAF-INC-001'));
});

test('intake validation rejects incomplete submissions and normalizes values', () => {
  const workflow = getComplianceWorkflow('request-reimbursement');
  const empty = validateIntake(workflow, {});
  assert.ok(empty.errors.some((error) => /Amount \(USD\) is required/.test(error)));
  assert.ok(empty.errors.some((error) => /Reimbursement Request Title is required/.test(error)));
  const good = validateIntake(workflow, {
    reimbursement_title: 'Staff meeting coffee',
    requester: 'Jane Doe',
    expense_date: '2026-09-05',
    amount: '42.50',
    business_purpose: 'Refreshments for the coordination meeting.',
    receipt_available: 'Yes',
  });
  assert.equal(good.values.amount, 42.5);
  assert.equal(good.values.requester, 'Jane Doe');
  const badOption = validateIntake(workflow, {
    reimbursement_title: 'X',
    requester: 'Jane Doe',
    expense_date: '2026-09-05',
    amount: '10',
    business_purpose: 'Purpose.',
    receipt_available: 'Maybe',
  });
  assert.ok(badOption.errors.some((error) => /Receipt Available has an invalid option/.test(error)));
});

test('server engine blocks progression until evidence satisfies the current gate', () => {
  const { workflow, transaction } = startWorkflow('contractor-1099-review', {
    review_year: '2026',
    prepared_by: 'Treasurer',
    approved_by: 'Executive Director',
  });
  assert.equal(transaction.requirements[0].status, 'incomplete');
  assert.throws(() => advanceComplianceTransaction(transaction, workflow, 'operator'), /blocking progression/);
  addComplianceEvidence(transaction, workflow, workflow.requirements[0].id, { description: 'Payment list and W-9 classifications compiled.' }, 'operator');
  assert.equal(transaction.requirements[0].status, 'complete');
  advanceComplianceTransaction(transaction, workflow, 'operator');
  assert.equal(transaction.current_requirement, 1);
  assert.equal(transaction.audit.some((item) => item.type === 'transaction_advanced'), true);
});

test('approval gates require evidence and prohibit self-approval', () => {
  const { workflow, transaction } = startWorkflow('onboard-volunteer', {
    volunteer_name: 'Alex Rider',
    area_of_interest: 'Trail safety crew',
    volunteer_coordinator: 'Sam Coordinator',
  });
  addComplianceEvidence(transaction, workflow, workflow.requirements[0].id, { description: 'Application received and disposition recorded.' }, 'operator');
  advanceComplianceTransaction(transaction, workflow, 'operator');
  addComplianceEvidence(transaction, workflow, workflow.requirements[1].id, { description: 'No screening required for this role.' }, 'operator');
  advanceComplianceTransaction(transaction, workflow, 'operator');
  const approval = workflow.requirements[2];
  assert.equal(approval.approval_required, true);
  assert.throws(() => approveComplianceRequirement(transaction, workflow, approval.id, 'admin'), /Evidence is required/);
  addComplianceEvidence(transaction, workflow, approval.id, { description: 'Approval packet submitted to the authorizing authority.' }, 'operator');
  assert.equal(transaction.requirements[2].status, 'awaiting_approval');
  assert.throws(() => approveComplianceRequirement(transaction, workflow, approval.id, 'operator'), /cannot approve/);
  approveComplianceRequirement(transaction, workflow, approval.id, 'admin');
  assert.equal(transaction.requirements[2].status, 'complete');
  assert.equal(transaction.requirements[2].approval.actor, 'admin');
  assert.ok(transaction.requirements[2].approval.authority);
});

test('an incident transaction auto-registers the controlled row and closes it at closeout', () => {
  const { workflow, transaction } = startWorkflow('report-incident', {
    incident_title: 'Summit mishap',
    incident_date: '2026-09-05',
    incident_time: '14:30',
    location: 'Summit trailhead',
    event_reference: 'EVT-2026-012',
    incident_type: 'Accident',
    people_involved: 'Rider, medic',
    what_happened: 'Rider fell on loose gravel.',
    witnesses: 'Two other riders',
    injuries_damage: 'Minor abrasions',
    reported_by: 'Trail lead',
  });
  assert.equal(transaction.requirements[0].status, 'complete');
  assert.equal(transaction.requirements[0].evidence[0].kind, 'intake');
  assert.equal(transaction.registers.length, 1);
  assert.equal(transaction.registers[0].register_id, 'SAF-REG-001');
  assert.equal(transaction.registers[0].columns['Incident #'], transaction.id);
  assert.equal(transaction.registers[0].columns['Status (Open/Closed)'], 'Open');
  runToEnd(workflow, transaction);
  assert.equal(transaction.status, 'complete');
  assert.ok(transaction.completed_at);
  assert.equal(transaction.requirements.every((requirement) => requirement.status === 'complete'), true);
  assert.ok(transaction.registers[0].closed_at);
  assert.equal(transaction.registers[0].columns['Status (Open/Closed)'], 'Closed');
  assert.equal(transaction.audit.some((item) => item.type === 'transaction_completed'), true);
});

test('a transaction completes only after every requirement advances', () => {
  const { workflow, transaction } = startWorkflow('execute-sponsorship', {
    sponsor_name: 'Custom Components Co.',
    amount: '2500',
    benefits_summary: 'Logo on the event banner and two live mentions.',
    event_reference: 'EVT-2026-004',
    prepared_by: 'Fundraising Director',
  });
  runToEnd(workflow, transaction, 'board-admin');
  assert.equal(transaction.status, 'complete');
  assert.ok(transaction.completed_at);
  assert.equal(transaction.requirements.every((requirement) => requirement.status === 'complete'), true);
  assert.equal(transaction.requirements[1].approval.source_document_id, 'FUND-SPON-001');
});