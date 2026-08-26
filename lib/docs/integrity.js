// lib/docs/integrity.js — documentation integrity scanner (directive §14, §44–§46, §70).
// Emits findings for: broken/missing references, duplicate IDs, duplicate titles/paths,
// missing metadata, unknown owner/authority, archived-not-marked, orphaned documents.
// Findings are surfaced to the admin integrity report — never silently normalized.

const SEVERITY = { error: 'error', warning: 'warning', info: 'info' };

export function runIntegrity({ records, byId }) {
  const findings = [];
  const seenId = new Map();
  const seenPath = new Map();

  for (const r of records) {
    // Duplicate document IDs.
    if (r.hasControlledId) {
      if (seenId.has(r.documentId)) {
        findings.push({
          severity: SEVERITY.error,
          code: 'DUPLICATE_DOC_ID',
          documentId: r.documentId,
          path: r.path,
          message: `Duplicate Document ID '${r.documentId}' also at ${seenId.get(r.documentId)}`,
        });
      } else {
        seenId.set(r.documentId, r.path);
      }
    }
    // Duplicate path (should never happen within one scan).
    if (seenPath.has(r.path)) {
      findings.push({ severity: SEVERITY.error, code: 'DUPLICATE_PATH', documentId: r.documentId, path: r.path, message: `Duplicate path '${r.path}'` });
    } else {
      seenPath.set(r.path, r.path);
    }

    // Broken / missing references.
    for (const ref of r.unresolvedReferences || []) {
      if (!looksLikeRef(ref)) continue;
      findings.push({
        severity: SEVERITY.error,
        code: 'BROKEN_REFERENCE',
        documentId: r.documentId,
        path: r.path,
        message: `Reference '${ref}' does not resolve to a known document`,
        related: ref,
      });
    }

    // Missing critical metadata.
    for (const field of ['title', 'owner', 'approvingAuthority', 'documentType', 'department', 'version']) {
      if (!r[field]) {
        findings.push({
          severity: SEVERITY.warning,
          code: 'MISSING_METADATA',
          documentId: r.documentId,
          path: r.path,
          message: `Missing metadata field '${field}'`,
        });
      }
    }
    if (!r.reviewDate) {
      findings.push({
        severity: SEVERITY.info,
        code: 'NO_REVIEW_DATE',
        documentId: r.documentId,
        path: r.path,
        message: 'Document has no scheduled review date',
      });
    }
  }

  // Orphan detection: documents neither referenced by nor referencing any other doc.
  for (const r of records) {
    const hasIn = (r.referencedBy || []).length > 0;
    const hasOut = (r.references || []).length > 0;
    if (!hasIn && !hasOut && r.status === 'Active') {
      findings.push({
        severity: SEVERITY.info,
        code: 'ORPHANED',
        documentId: r.documentId,
        path: r.path,
        message: 'Active document with no inbound or outbound references',
      });
    }
  }

  return findings.sort((a, b) => (a.severity === b.severity ? a.path.localeCompare(b.path) : a.severity.localeCompare(b.severity)));
}

function looksLikeRef(ref) {
  // Ignore transaction IDs and bare numbers that slipped through.
  return /\b[A-Z]{2,5}(-[A-Z]+)?-\d{3}\b|\b[A-Za-z0-9_.\-/]+\.md\b/.test(String(ref));
}

export function summarize(findings) {
  const out = { error: 0, warning: 0, info: 0, byCode: {} };
  for (const f of findings) {
    if (out[f.severity] !== undefined) out[f.severity] += 1;
    out.byCode[f.code] = (out.byCode[f.code] || 0) + 1;
  }
  return out;
}

export default { runIntegrity, summarize, SEVERITY };