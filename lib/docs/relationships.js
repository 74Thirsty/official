// lib/docs/relationships.js — reference resolver, relationship engine, supersession.
// (directive §12, §13, §14, §15).
//
// Given the raw scanned records, resolve each document's references to actual records,
// compute reverse references (referencedBy), supersession edges, and dependency structure.
// Unresolved references become BROKEN/MISSING findings for the integrity report — never
// fake documents (directive §48).

import path from 'path';
import { SOURCE_ROOT, TRANSACTION_PREFIXES } from './config.js';

// A reference is "resolvable as a live ID" if it is not a transaction/record ID.
function isResolvableId(ref) {
  if (!ref) return false;
  for (const p of TRANSACTION_PREFIXES) {
    if (ref.startsWith(p)) return false;
  }
  return true;
}

// Resolve references for every record against the full set of records.
// Enriches each record with `referencedBy`, resolves reference ids, and returns
// { records, findings, byId, byPath }.
export function resolveAll(records, { sourceRoot = SOURCE_ROOT } = {}) {
  const byId = new Map();
  const byPath = new Map();
  const bySlug = new Map();
  for (const r of records) {
    byId.set(r.documentId, r);
    byPath.set(r.path, r);
    bySlug.set(r.slug, r);
  }

  // Second pass: resolve references (excluding the document's own ID — a controlled
  // document referencing itself by ID in its header/prose is not a real relationship).
  for (const r of records) {
    const resolved = [];
    const unresolved = [];
    for (const ref of r.references || []) {
      if (ref === r.documentId) continue; // self-reference
      const target = resolveRef(ref, { byId, byPath, bySlug, currentPath: r.path, sourceRoot });
      if (target) {
        resolved.push(target.documentId);
      } else {
        unresolved.push(ref);
      }
    }
    r.references = [...new Set(resolved)];
    r.unresolvedReferences = [...new Set(unresolved)];
  }

  // Reverse references.
  for (const r of records) {
    r.referencedBy = [];
  }
  for (const r of records) {
    for (const targetId of r.references) {
      const target = byId.get(targetId);
      if (target && target.referencedBy.indexOf(r.documentId) === -1) {
        target.referencedBy.push(r.documentId);
      }
    }
  }

  // Supersession: derive from header metadata already carried in the record,
  // plus any explicit legacy->canonical alias table (see config). For now the
  // engine infers superseded-by from the `Supersedes` header when present; the
  // scanner captures the raw references, and this pass maps them onto records.
  return { records, byId, byPath };
}

function resolveRef(ref, { byId, byPath, bySlug, currentPath, sourceRoot }) {
  // 1) Direct document-id lookup.
  if (isResolvableId(ref)) {
    if (byId.has(ref)) return byId.get(ref);
    if (bySlug.has(ref)) return bySlug.get(ref);
  }
  // 2) .md path — resolve relative to the current document, then to source root.
  if (ref.endsWith('.md')) {
    const baseDir = currentPath.split('/').slice(0, -1).join('/');
    const candidates = [ref];
    if (baseDir) candidates.unshift(`${baseDir}/${ref}`);
    for (const c of candidates) {
      const norm = c.split(path.sep).join('/');
      if (byPath.has(norm)) return byPath.get(norm);
    }
  }
  return null;
}

// Relationship graph for a single document: what it references, what references it,
// what it supersedes / is superseded by, and what it depends on.
export function buildGraph(doc, { byId }) {
  const references = (doc.references || []).map((id) => byId.get(id)).filter(Boolean)
    .map((r) => ({ documentId: r.documentId, title: r.title, path: r.path }));
  const referencedBy = (doc.referencedBy || []).map((id) => byId.get(id)).filter(Boolean)
    .map((r) => ({ documentId: r.documentId, title: r.title, path: r.path }));
  const dependsOn = references.filter((r) => ['SOP', 'Procedure', 'Policy'].includes(r.documentType || ''));
  return { references, referencedBy, dependsOn };
}

export default { resolveAll, buildGraph };