import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getActiveDocuments,
  filterDocuments,
  buildComplianceMatrix,
  evaluateRequirement,
  findDocumentByCode,
} from '../lib/document-registry.js';

test('document registry keeps metadata only and preserves authoritative source paths', () => {
  const docs = getActiveDocuments();
  assert.ok(docs.length > 0);
  for (const doc of docs) {
    assert.equal(doc.source_repository, 'Autobiography');
    assert.ok(doc.canonical_path.startsWith('documentation-source/'));
    assert.ok(doc.canonical_path.endsWith('.md'));
    assert.ok(!('body' in doc));
    assert.ok(!('content' in doc));
  }
});

test('document filtering supports search across codes, titles, and domains', () => {
  const matches = filterDocuments('finance', getActiveDocuments());
  assert.ok(matches.some((doc) => doc.domain === 'finance'));
  const byCode = filterDocuments('GOV-POL-001', getActiveDocuments());
  assert.equal(byCode[0].document_code, 'GOV-POL-001');
});

test('compliance matrix produces traceable evidence mappings', () => {
  const findings = buildComplianceMatrix();
  assert.ok(findings.length >= 4);
  const requirement = findings.find((item) => item.id === 'REQ-ORG-01');
  assert.ok(requirement);
  assert.ok(Array.isArray(requirement.evidence));
  assert.ok(requirement.evidence.length >= 2);
  assert.ok(requirement.evidence.every((entry) => entry.document_code));
  assert.ok(requirement.evidence.every((entry) => entry.canonical_path.startsWith('documentation-source/')));
});

test('evaluateRequirement returns a traceable result for a known requirement', () => {
  const result = evaluateRequirement('REQ-FIN-01');
  assert.equal(result.status, 'Compliant');
  assert.equal(result.evidence[0].document_code, 'FIN-EXP-002');
  assert.ok(findDocumentByCode('FIN-EXP-002'));
});
