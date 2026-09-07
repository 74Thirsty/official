import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../compliance.html', import.meta.url), 'utf8');
const library = await readFile(new URL('../documentation.html', import.meta.url), 'utf8');

test('Compliance Engine is a separate catalog-driven route', () => {
  assert.match(page, /Workflow catalog/);
  assert.match(page, /compliance-workflows/);
  assert.match(page, /compliance-start/);
  assert.match(page, /compliance-create/);
  assert.match(page, /predefined and deterministic/);
  assert.match(library, /href="compliance\.html"/);
});

test('Compliance Engine reuses the Document Library bearer session without URL secrets', () => {
  assert.match(page, /sessionStorage\.getItem\('llr-docs-session'\)/);
  assert.match(page, /'Authorization':'Bearer '\+session\.token/);
  assert.doesNotMatch(page, /[?&](?:key|token)=/i);
});

test('Compliance Engine presents predefined stages, provenance, evidence, approvals, gates, and audit history', () => {
  assert.match(page, /ADM-REF-002/);
  assert.match(page, /predefined stages/);
  assert.match(page, /Evidence description/);
  assert.match(page, /Approve stage/);
  assert.match(page, /Audit history/);
  assert.match(page, /Current stage gate/);
});

test('Compliance Engine renders controlled template sections and works from a managed catalog', () => {
  assert.match(page, /creationSection/);
  assert.match(page, /canonical approval authority/);
  assert.match(page, /data-save-section/);
  assert.match(page, /compliance-doc-create/);
  assert.match(page, /compliance-doc-sign/);
  assert.match(page, /compliance-doc-finalize/);
  assert.match(page, /compliance-export/);
  assert.match(page, /Controlled working document/);
  assert.match(page, /controlled template/);
  assert.match(page, /flattened legacy template/);
});

test('Compliance Engine lists legacy records as read-only migrations', () => {
  assert.match(page, /legacy \u00b7 read-only/);
  assert.match(page, /legacy definition/);
});