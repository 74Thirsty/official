import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extractSection, identifyContextualReferences, expandDocument } from '../lib/document-references.js';
import { findDocumentByCode } from '../lib/document-registry.js';

const root = { key: 'TEST-ROOT', canonical_path: 'tests/root.md', access: 'public' };
const controlledHeader = (id, body) => `**Document ID:** ${id}\n\n---\n\n${body}`;

test('section extraction stops at the next heading of equal or higher level', () => {
  const source = '# Title\n\n## 1. Approval Authority\nAllowed text.\n\n### Detail\nMore.\n\n## 2. Next\nNo.';
  assert.equal(extractSection(source, 'Approval Authority'), '## 1. Approval Authority\nAllowed text.\n\n### Detail\nMore.');
});

test('contextual references ignore metadata-only IDs', () => {
  const source = controlledHeader('EVT-AUTH-001', 'Ordinary mention FIN-CTRL-001.\n\nComplete approval per FIN-CTRL-001.');
  const references = identifyContextualReferences(source, root.canonical_path);
  assert.equal(references.length, 1);
  assert.equal(references[0].token, 'FIN-CTRL-001');
});

test('whole-document references expand for authenticated readers', async () => {
  const result = await expandDocument(root, 'Complete FIN-CTRL-001 before continuing.', {
    authenticated: true,
    fetchMarkdown: async () => '# Approval Matrix\n\nComplete.',
  });
  assert.equal(result.references[0].status, 'included');
  assert.match(result.references[0].content, /Approval Matrix/);
});

test('a specifically named section expands without the rest of the document', async () => {
  const result = await expandDocument(root, 'Follow FIN-CTRL-001 Section “Approval Authority”.', {
    authenticated: true,
    fetchMarkdown: async () => '# Matrix\n\n## Approval Authority\nRequired excerpt.\n\n## Other\nExcluded.',
  });
  assert.equal(result.references[0].status, 'included');
  assert.match(result.references[0].content, /Required excerpt/);
  assert.doesNotMatch(result.references[0].content, /Excluded/);
});

test('nested references resolve and circular references terminate', async () => {
  const content = {
    'FIN-CTRL-001': controlledHeader('FIN-CTRL-001', 'Follow EVT-FIN-001 procedure.'),
    'EVT-FIN-001': controlledHeader('EVT-FIN-001', 'See FIN-CTRL-001 policy.'),
  };
  const result = await expandDocument(root, 'Complete FIN-CTRL-001.', {
    authenticated: true,
    fetchMarkdown: async (document) => content[document.document_id],
  });
  assert.equal(result.references[0].children[0].status, 'included');
  assert.equal(result.references[0].children[0].children[0].status, 'cycle');
});

test('broken references produce controlled diagnostics', async () => {
  const result = await expandDocument(root, 'Complete XYZ-PROC-999 before continuing.', {
    authenticated: true,
    fetchMarkdown: async () => { throw new Error('not found'); },
  });
  assert.equal(result.references[0].status, 'broken');
});

test('public documents cannot transclude internal documents anonymously', async () => {
  let fetched = false;
  const result = await expandDocument(root, 'Complete FIN-CTRL-001 before continuing.', {
    authenticated: false,
    fetchMarkdown: async () => { fetched = true; return 'secret'; },
  });
  assert.equal(findDocumentByCode('FIN-CTRL-001').access, 'internal');
  assert.equal(result.references[0].status, 'restricted');
  assert.equal(fetched, false);
});

test('render-time expansion leaves canonical source bytes unchanged', async () => {
  const path = new URL('../documentation-source/lost_limb_riders_handbooks/transactional_operations/05-FINANCE/FIN-CTRL-001-Organizational-Approval-Matrix.md', import.meta.url);
  const before = await readFile(path);
  await expandDocument(root, 'Complete FIN-CTRL-001 before continuing.', {
    authenticated: true,
    fetchMarkdown: async () => before.toString('utf8'),
  });
  const after = await readFile(path);
  assert.equal(createHash('sha256').update(after).digest('hex'), createHash('sha256').update(before).digest('hex'));
});
