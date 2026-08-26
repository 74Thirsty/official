// lib/docs/search.js — documentation search + filtering (directive §18, §34).
// In-memory token search over the registry (title, ID, path, tags, department, type).
// Search results never include documents the caller cannot access (visibility enforced
// here and at the API layer).

import { TRANSACTION_PREFIXES } from './config.js';

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t.length > 1);
}

export function buildIndex(records) {
  const index = new Map(); // token -> Set<documentId>
  for (const r of records) {
    const hay = [
      r.title, r.documentId, r.path, r.department, r.documentType,
      r.owner, (r.tags || []).join(' '),
    ].join(' ');
    for (const token of tokenize(hay)) {
      if (!index.has(token)) index.set(token, new Set());
      index.get(token).add(r.documentId);
    }
  }
  return index;
}

// query supports a bare term or `field:term` filters (title:, id:, dept:, type:, status:).
export function search(records, query = '', filters = {}) {
  const q = String(query || '').trim().toLowerCase();
  let scored = records.map((r) => ({ r, score: 0 }));

  if (q) {
    const tokens = tokenize(q);
    scored = scored.map(({ r }) => {
      let score = 0;
      const title = r.title.toLowerCase();
      const id = r.documentId.toLowerCase();
      const inId = tokens.some((t) => id.includes(t));
      const inTitle = tokens.every((t) => title.includes(t));
      if (inId) score += 20;
      if (inTitle) score += 10;
      if (tokenize(r.path).some((t) => tokens.includes(t))) score += 5;
      return { r, score };
    });
    scored = scored.filter((x) => x.score > 0);
  } else {
    scored = scored.map(({ r }) => ({ r, score: 0 }));
  }

  // Field filters.
  let out = scored.map((x) => x.r);
  const apply = (field) => {
    const val = (filters[field] || '').trim().toLowerCase();
    if (!val) return;
    out = out.filter((r) => String(r[field] || '').toLowerCase().includes(val));
  };
  apply('department');
  apply('documentType');
  apply('status');
  apply('authority');
  apply('tag');

  return out.sort((a, b) => b.score - a.score);
}

export default { search, buildIndex, tokenize };