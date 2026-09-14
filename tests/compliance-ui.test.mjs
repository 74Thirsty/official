import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../compliance.html', import.meta.url), 'utf8');
const library = await readFile(new URL('../documentation.html', import.meta.url), 'utf8');

test('ACE is a separate catalog-driven route', () => {
  assert.match(page, /Workflow library/);
  assert.match(page, /compliance-workflows/);
  assert.match(page, /compliance-start/);
  assert.match(page, /compliance-create/);
  assert.match(page, /predefined and deterministic/);
  assert.match(library, /href="compliance\.html"/);
});

test('workflow discovery is focused and scalable instead of rendering the entire library', () => {
  assert.match(page, /Operational dashboard/);
  assert.match(page, /Search employee, grant, expense, volunteer, board/);
  assert.match(page, /data-category/);
  assert.match(page, /showWorkflowResults/);
  assert.match(page, /Recently used workflows/);
  assert.match(page, /Requires action/);
  assert.match(page, /Awaiting approval/);
  assert.match(page, /Archived/);
});

test('definition preview, record creation, and record retrieval use distinct requests', () => {
  assert.match(page, /api\('compliance-start',null,\{workflow_id:workflowId\}\)/);
  assert.match(page, /api\('compliance-create'/);
  assert.match(page, /api\('compliance-detail',null,\{id:id\}\)/);
  assert.doesNotMatch(page, /compliance-start\?workflow_id/);
});

test('workflow starts are idempotent and disable duplicate submissions', () => {
  assert.match(page, /idempotency_key:currentStartKey/);
  assert.match(page, /randomUUID/);
  assert.match(page, /submit\.disabled=true/);
  assert.match(page, /duplicate start prevented/);
});

test('record route state survives browser refresh', () => {
  assert.match(page, /#record=/);
  assert.match(page, /location\.hash\.match/);
});

test('ACE reuses the Document Library bearer session without URL secrets', () => {
  assert.match(page, /sessionStorage\.getItem\('llr-docs-session'\)/);
  assert.match(page, /'Authorization':'Bearer '\+session\.token/);
  assert.doesNotMatch(page, /[?&](?:key|token)=/i);
});

test('ACE presents predefined stages, provenance, evidence, approvals, gates, and audit history', () => {
  assert.match(page, /ADM-REF-002/);
  assert.match(page, /predefined stages/);
  assert.match(page, /Evidence description/);
  assert.match(page, /Approve stage/);
  assert.match(page, /Audit history/);
  assert.match(page, /Current stage gate/);
});

test('ACE renders controlled template sections and works from a managed catalog', () => {
  assert.match(page, /creationSection/);
  assert.match(page, /canonical approval authority/);
  assert.match(page, /data-save-section/);
  assert.match(page, /compliance-doc-create/);
  assert.match(page, /compliance-doc-sign/);
  assert.match(page, /compliance-doc-finalize/);
  assert.match(page, /compliance-export/);
  assert.match(page, /Required controlled document/);
  assert.match(page, /definition\.fields/);
  assert.doesNotMatch(page, /Notes \/ form data/);
  assert.match(page, /controlled template/);
  assert.match(page, /flattened legacy template/);
});

test('ACE lists legacy records as read-only migrations', () => {
  assert.match(page, /legacy \u00b7 read-only/);
  assert.match(page, /adapted definition/);
});

test('workflow execution is self-guided, conditional, and procedurally unified', () => {
  assert.match(page, /When to use/);
  assert.match(page, /Before you begin/);
  assert.match(page, /Completion criteria/);
  assert.match(page, /Successful completion produces/);
  assert.match(page, /If something is unavailable/);
  assert.match(page, /data-when-field/);
  assert.match(page, /applyConditionalFields/);
  assert.match(page, /\[data-field\]:not\(:disabled\)/);
  assert.match(page, /field-kind/);
  assert.match(page, /Restricted record/);
  assert.match(page, /stage\.blockingRules/);
});
