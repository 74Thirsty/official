import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { COMPLIANCE_WORKFLOW_MANIFEST } from '../lib/compliance-workflows.generated.js';
import {
  COMPLIANCE_WORKFLOWS,
  getComplianceWorkflow,
  publicWorkflow,
  createComplianceTransaction,
  addComplianceEvidence,
  approveComplianceRequirement,
  advanceComplianceTransaction,
} from '../lib/compliance-engine.js';

test('controlled manifest derives all ten Transaction Map workflows', () => {
  assert.equal(COMPLIANCE_WORKFLOWS.length, 10);
  assert.deepEqual(COMPLIANCE_WORKFLOWS.map((workflow) => workflow.intent), [
    'Employee Hire and Pay',
    'Contractor Engagement and Payment',
    'Event Lifecycle',
    'Expense and Reimbursement',
    'Donation',
    'Sponsorship',
    'Grant',
    'Asset Acquisition and Disposal',
    'Incident',
    'Volunteer Lifecycle',
  ]);
  assert.ok(COMPLIANCE_WORKFLOWS.every((workflow) => workflow.source_document_id === 'ADM-REF-002'));
  assert.ok(COMPLIANCE_WORKFLOWS.every((workflow) => workflow.source_hash));
});

test('generated workflow manifest is versioned against the unchanged canonical source', async () => {
  const source = await readFile(new URL(`../documentation-source/${COMPLIANCE_WORKFLOW_MANIFEST.source_path}`, import.meta.url));
  assert.equal(createHash('sha256').update(source).digest('hex'), COMPLIANCE_WORKFLOW_MANIFEST.source_hash);
});

test('workflow document references use the shared registry and expose canonical defects', () => {
  const event = publicWorkflow(getComplianceWorkflow('event-lifecycle'));
  const referenced = event.stages.flatMap((stage) => stage.documents);
  assert.ok(referenced.some((document) => document.document_id === 'EVT-AUTH-001'));
  assert.equal(referenced.find((document) => document.document_id === 'EVT-AUTH-001').document_code, 'EVT-AUTH-001');
  assert.deepEqual(referenced.filter((document) => !document.document_code).map((document) => document.document_id), [
    'EVT-HR-002',
    'EVT-CHK-001',
    'EVT-PROC-002',
  ]);
});

test('server engine blocks progression until evidence satisfies the current gate', () => {
  const workflow = getComplianceWorkflow('donation');
  const transaction = createComplianceTransaction(workflow, {
    title: 'September donation',
    responsible_person: 'Treasurer',
    amount: 100,
  }, 'operator');

  assert.throws(() => advanceComplianceTransaction(transaction, workflow, 'operator'), /blocking progression/);
  addComplianceEvidence(transaction, workflow, workflow.stages[0].id, { description: 'Deposit intake record retained.' }, 'operator');
  assert.equal(transaction.requirements[0].status, 'complete');
  advanceComplianceTransaction(transaction, workflow, 'operator');
  assert.equal(transaction.current_stage, 1);
  assert.equal(transaction.audit.some((item) => item.type === 'transaction_advanced'), true);
});

test('approval gates require evidence and prohibit self-approval', () => {
  const workflow = getComplianceWorkflow('event-lifecycle');
  const transaction = createComplianceTransaction(workflow, {
    title: 'Fall ride',
    responsible_person: 'Events Director',
  }, 'operator');

  addComplianceEvidence(transaction, workflow, workflow.stages[0].id, { description: 'Opportunity brief.' }, 'operator');
  advanceComplianceTransaction(transaction, workflow, 'operator');
  const stage = workflow.stages[1];
  assert.equal(stage.approval_required, true);
  assert.throws(() => approveComplianceRequirement(transaction, workflow, stage.id, 'admin'), /Evidence is required/);
  addComplianceEvidence(transaction, workflow, stage.id, { description: 'Authorization form submitted.' }, 'operator');
  assert.equal(transaction.requirements[1].status, 'awaiting_approval');
  assert.throws(() => approveComplianceRequirement(transaction, workflow, stage.id, 'operator'), /cannot approve/);
  assert.throws(() => approveComplianceRequirement(transaction, workflow, stage.id, 'admin'), /canonical approval authority/);
  const approvalRule = stage.approval_rules.find((rule) => /Event acceptance/.test(rule.action));
  approveComplianceRequirement(transaction, workflow, stage.id, 'admin', approvalRule.id);
  assert.equal(transaction.requirements[1].status, 'complete');
  assert.equal(transaction.requirements[1].approval.authority, approvalRule.authority);
});

test('a transaction completes only after every generated requirement advances', () => {
  const workflow = getComplianceWorkflow('sponsorship');
  const transaction = createComplianceTransaction(workflow, { title: 'Sponsor A', responsible_person: 'Coordinator' }, 'operator');
  for (const stage of workflow.stages) {
    addComplianceEvidence(transaction, workflow, stage.id, { description: `Evidence for ${stage.label}` }, 'operator');
    if (stage.approval_required) approveComplianceRequirement(transaction, workflow, stage.id, 'admin');
    advanceComplianceTransaction(transaction, workflow, 'operator');
  }
  assert.equal(transaction.status, 'complete');
  assert.ok(transaction.completed_at);
  assert.equal(transaction.requirements.every((requirement) => requirement.status === 'complete'), true);
});
