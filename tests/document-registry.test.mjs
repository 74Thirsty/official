import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getActiveDocuments,
  filterDocuments,
  buildComplianceMatrix,
  evaluateRequirement,
  findDocumentByCode,
  calculateComplianceScore,
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

test('requirement remains unknown until document availability is verified', () => {
  const result = evaluateRequirement('REQ-FIN-01', [], [], new Date('2026-09-02T00:00:00Z'));
  assert.equal(result.status, 'Unknown');
});

test('verified evidence plus approval produces a compliant result', () => {
  const documentState = [
    { document_code: 'FIN-EXP-002', availability: 'available' },
    { document_code: 'FIN-PUR-001', availability: 'available' },
    { document_code: 'GOV-REC-001', availability: 'available' },
  ];
  const result = evaluateRequirement('REQ-FIN-01', documentState, [
    { requirement_id: 'REQ-FIN-01', review_status: 'approved' },
  ], new Date('2026-09-02T00:00:00Z'));
  assert.equal(result.status, 'Compliant');
  assert.equal(result.evidence[0].document_code, 'FIN-EXP-002');
  assert.ok(findDocumentByCode('FIN-EXP-002'));
});

test('missing evidence cannot be classified as compliant', () => {
  const result = evaluateRequirement('REQ-FIN-01', [
    { document_code: 'FIN-EXP-002', availability: 'available' },
    { document_code: 'FIN-PUR-001', availability: 'missing' },
    { document_code: 'GOV-REC-001', availability: 'available' },
  ], [{ requirement_id: 'REQ-FIN-01', review_status: 'approved' }], new Date('2026-09-02T00:00:00Z'));
  assert.equal(result.status, 'Missing');
});

test('date rules distinguish overdue, due soon, and expired', () => {
  const available = getActiveDocuments().map((doc) => ({ document_code: doc.document_code, availability: 'available' }));
  const now = new Date('2026-09-02T00:00:00Z');
  assert.equal(evaluateRequirement('REQ-ORG-01', available, [{ requirement_id: 'REQ-ORG-01', due_date: '2026-09-01' }], now).status, 'Overdue');
  assert.equal(evaluateRequirement('REQ-ORG-01', available, [{ requirement_id: 'REQ-ORG-01', due_date: '2026-09-20' }], now).status, 'Due Soon');
  assert.equal(evaluateRequirement('REQ-ORG-01', available, [{ requirement_id: 'REQ-ORG-01', expires_at: '2026-08-31' }], now).status, 'Expired');
});

test('not-applicable requirements are excluded from the score', () => {
  assert.equal(calculateComplianceScore([{ status: 'Compliant' }, { status: 'Missing' }, { status: 'Not Applicable' }]), 50);
  assert.equal(calculateComplianceScore([{ status: 'Not Applicable' }]), null);
});

test('unknown requirement is reported as unknown, not compliant or applicable', () => {
  assert.equal(evaluateRequirement('DOES-NOT-EXIST').status, 'Unknown');
});
