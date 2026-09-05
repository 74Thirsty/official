import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const page = await readFile(new URL('../compliance.html', import.meta.url), 'utf8');
const library = await readFile(new URL('../documentation.html', import.meta.url), 'utf8');

test('Compliance Engine is a separate intent-driven route', () => {
  assert.match(page, /What are you trying to do\?/);
  assert.match(page, /compliance-workflows/);
  assert.match(page, /compliance-create/);
  assert.match(page, /compliance-evidence/);
  assert.match(page, /compliance-approve/);
  assert.match(page, /compliance-advance/);
  assert.match(library, /href="compliance\.html"/);
});

test('Compliance Engine reuses the Document Library bearer session without URL secrets', () => {
  assert.match(page, /sessionStorage\.getItem\('llr-docs-session'\)/);
  assert.match(page, /'Authorization':'Bearer '\+session\.token/);
  assert.doesNotMatch(page, /[?&](?:key|token)=/i);
});

test('Compliance Engine presents source provenance, evidence, approvals, gates, and audit history', () => {
  assert.match(page, /ADM-REF-002/);
  assert.match(page, /Evidence description/);
  assert.match(page, /Approve requirement/);
  assert.match(page, /Advance to next requirement/);
  assert.match(page, /Audit history/);
});
