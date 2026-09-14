import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const library = await readFile(new URL('../documentation.html', import.meta.url), 'utf8');
const viewer = await readFile(new URL('../documentation-viewer.html', import.meta.url), 'utf8');

test('library and viewer use one sessionStorage bearer session', () => {
  assert.match(library, /sessionStorage\.setItem\('llr-docs-session'/);
  assert.match(library, /sessionStorage\.getItem\('llr-docs-session'/);
  assert.match(viewer, /sessionStorage\.getItem\('llr-docs-session'/);
  assert.match(viewer, /headers\.Authorization = 'Bearer ' \+ session\.token/);
});

test('opening a document preserves the same browsing-context session', () => {
  assert.match(library, /window\.location\.href = 'documentation-viewer\.html\?code='/);
  assert.doesNotMatch(library, /window\.open\('documentation-viewer\.html/);
  assert.match(viewer, /href="documentation\.html"/);
});

test('public documents remain rendered while authenticated documents are added', () => {
  assert.match(library, /renderGroup\(document\.getElementById\('publicList'\)/);
  assert.match(library, /showInternalDocs\(result\.data\.name\)/);
  assert.doesNotMatch(library, /publicList[^\n]*display\s*=\s*['"]none/);
});

test('Document Library does not masquerade as ACE', () => {
  assert.doesNotMatch(library, /<h2[^>]*>Compliance\s*<span[^>]*>Engine/);
  assert.doesNotMatch(library, /docs-compliance-update/);
  assert.match(library, /operational compliance workflows are a separate feature/);
});

test('viewer renders provenance-labelled, collapsible referenced material', () => {
  assert.match(viewer, /Referenced requirement/);
  assert.match(viewer, /Open canonical source/);
  assert.match(viewer, /document\.createElement\('details'\)/);
  assert.match(viewer, /renderDocument\(reference\.content/);
});

test('library progressively discloses category, functional area, and document groups', () => {
  assert.match(library, /function buildTree\(docs\)/);
  assert.match(library, /function showMajorCategories\(containerId\)/);
  assert.match(library, /function showSubcategories\(containerId, major\)/);
  assert.match(library, /function showDocuments\(containerId, major, subcategory\)/);
  assert.match(library, /<details class="document-group">/);
  assert.match(library, /class="category-card"/);
  assert.match(library, /class="subcategory-card"/);
});

test('search covers complete authorized metadata rather than rendered cards', () => {
  assert.match(library, /allDocs\.filter\(function\(doc\) \{ return searchText\(doc\)/);
  assert.match(library, /doc\.document_id,doc\.document_code,doc\.type,doc\.section,doc\.domain,doc\.responsible_area,doc\.canonical_path/);
  assert.match(library, /Search includes collapsed categories/);
});

test('position manuals preserve canonical source-series order', () => {
  assert.match(library, /canonical_path\.startsWith\('employees\/'\)/);
  assert.match(library, /localeCompare\(right\.canonical_path, undefined, \{ numeric:true \}\)/);
  assert.match(library, /Canonical organizational order/);
  assert.match(library, /alphabetical title sorting is intentionally not used/);
});

test('library disclosures and document actions use semantic controls', () => {
  assert.doesNotMatch(library, /<div[^>]+onclick=/);
  assert.match(library, /aria-live="polite"/);
  assert.match(library, /button:focus-visible/);
  assert.match(library, /min-height:44px/);
});
