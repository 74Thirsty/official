import test from 'node:test';
import assert from 'node:assert/strict';
import { DOCUMENT_SOURCE_REVISION, getActiveDocuments, getAccessibleDocuments, filterDocuments, findDocumentByCode } from '../lib/document-registry.js';

test('generated registry contains the complete canonical corpus at a pinned revision', () => {
  const documents = getActiveDocuments();
  assert.equal(documents.length, 250);
  assert.match(DOCUMENT_SOURCE_REVISION, /^[0-9a-f]{40}$/);
  assert.equal(new Set(documents.map((document) => document.canonical_path)).size, documents.length);
  assert.equal(new Set(documents.map((document) => document.canonical_name.toLowerCase())).size, documents.length);
});

test('public access is explicit and authentication expands rather than replaces access', () => {
  const publicDocuments = getAccessibleDocuments(false);
  const authenticatedDocuments = getAccessibleDocuments(true);
  assert.equal(publicDocuments.length, 2);
  assert.equal(authenticatedDocuments.length, 250);
  assert.ok(publicDocuments.every((document) => document.access === 'public'));
  assert.ok(publicDocuments.every((document) => authenticatedDocuments.some((allowed) => allowed.key === document.key)));
});

test('documents resolve by generated key, controlled ID, and canonical path', () => {
  const controlled = findDocumentByCode('FIN-CTRL-001');
  assert.equal(controlled.document_id, 'FIN-CTRL-001');
  assert.equal(findDocumentByCode(controlled.key).canonical_path, controlled.canonical_path);
  assert.equal(findDocumentByCode(controlled.canonical_path).key, controlled.key);
});

test('filtering covers titles, IDs, departments, and paths', () => {
  assert.ok(filterDocuments('FIN-CTRL-001').some((document) => document.document_id === 'FIN-CTRL-001'));
  assert.ok(filterDocuments('Member Handbook').some((document) => document.canonical_path.includes('/02-Member-Handbook/')));
  assert.ok(filterDocuments('employees/').some((document) => document.canonical_path.startsWith('employees/')));
});
