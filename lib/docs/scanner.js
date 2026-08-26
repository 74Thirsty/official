// lib/docs/scanner.js — repository scanner + metadata extractor (directive §26, §28, §49).
//
// The repository (Autobiography submodule) remains the source of truth. This module walks
// the Markdown files, extracts metadata, IDs, references, and a content hash, and returns
// raw document records. No document body text is stored in the registry; only metadata and
// hashes are persisted. Content is served from the submodule on demand.

import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import {
  SOURCE_ROOT, EXCLUDED_DIRS, EXCLUDED_FILES, ID_TOKEN_RE, TRANSACTION_PREFIXES,
  DEPARTMENT_BY_DIR,
} from './config.js';

export function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

// Parse the ``**Field:** value`` header block present in controlled documents.
export function parseHeader(text) {
  const fields = {};
  for (const line of text.split(/\r?\n/).slice(0, 90)) {
    const m = line.match(/^\*\*(.+?):\*\*\s*(.*)$/);
    if (m) fields[m[1].trim()] = m[2].trim();
  }
  return fields;
}

// Collapse a token set to allowed lookups (non-empty, no whitespace). Keeps only
// controlled-ID-shaped tokens so prose does not produce garbage references.
function normalizeIds(tokens) {
  const out = new Set();
  for (const t of tokens) {
    const s = String(t || '').trim();
    if (!s) continue;
    if (/\s/.test(s)) continue;
    out.add(s);
  }
  return [...out];
}

export function extractIds(text) {
  const matches = text.match(ID_TOKEN_RE) || [];
  return normalizeIds(matches);
}

export function extractRefs({ text, fields }) {
  const refs = new Set();
  // (1) Document IDs referenced in prose.
  for (const id of extractIds(text)) refs.add(id);
  // (2) Explicit relationships in the header block.
  for (const key of ['Related Documents', 'Related Forms', 'Supersedes']) {
    if (!fields[key]) continue;
    for (const id of extractIds(fields[key])) refs.add(id);
  }
  // (3) Relative .md path references that resolve within the source tree.
  const mdRe = /[\w./\-]+\.md/g;
  for (const m of (text.match(mdRe) || [])) {
    refs.add(m);
  }
  return [...refs];
}

function lookupDir(rel) {
  const parts = rel.split('/');
  for (let i = 0; i < parts.length; i += 1) {
    const dir = parts.slice(0, i + 1).join('/');
    if (DEPARTMENT_BY_DIR[dir]) return DEPARTMENT_BY_DIR[dir];
  }
  return 'Other';
}

export function classify({ fields, rel }) {
  // Department: prefer the header, fall back to path mapping.
  const headerDept = (fields['Department'] || '').trim();
  const dept = headerDept || lookupDir(rel);

  // Type from header, else infer from ID prefix / filename.
  let type = (fields['Document Type'] || '').trim();
  if (!type) {
    const id = (fields['Document ID'] || '');
    const prefix = (id.split('-')[1] || '').toUpperCase();
    const map = {
      POL: 'Policy', SOP: 'SOP', PROC: 'Procedure', CHK: 'Checklist', FORM: 'Form',
      TMP: 'Template', REG: 'Register', REF: 'Reference', TMPL: 'Template',
      MAN: 'Manual', HAN: 'Handbook',
    };
    type = map[prefix] || 'Other';
  }

  // Status & authority.
  let status = (fields['Status'] || '').trim() || 'Active';
  let authority = 'Authoritative';
  const slug = rel.toLowerCase();
  if (slug.startsWith('archive/') || slug.includes('/archive/')) {
    status = 'Archived';
    authority = 'Archived';
  }
  if (status === 'Superseded') authority = 'Superseded';
  if (['Draft', 'Under Review', 'Pending Approval', 'Unknown'].includes(status)) {
    if (authority === 'Authoritative') authority = 'Draft';
  }

  return { department: dept, type, status, authority };
}

// Gather a stable internal slug for documents that have no controlled Document ID.
export function slugFromRel(rel) {
  return rel
    .replace(/\.md$/i, '')
    .replace(/^.*\//, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

// Scan every Markdown file under sourceRoot and return raw records (no relationships yet).
export function scanAll({ sourceRoot = SOURCE_ROOT } = {}) {
  const records = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      if (EXCLUDED_DIRS.has(name)) continue;
      const abs = path.join(dir, name);
      const rel = path.relative(sourceRoot, abs).split(path.sep).join('/');
      let st;
      try { st = statSync(abs); } catch { continue; }
      if (st.isDirectory()) { walk(abs); continue; }
      if (!name.toLowerCase().endsWith('.md')) continue;
      if (EXCLUDED_FILES.has(name)) continue;
      let text;
      try { text = readFileSync(abs, 'utf8'); } catch { continue; }
      records.push(buildRecord(rel, text));
    }
  };
  walk(sourceRoot);
  records.sort((a, b) => a.path.localeCompare(b.path));
  return records;
}

export function buildRecord(rel, text) {
  const fields = parseHeader(text);
  const docId = (fields['Document ID'] || '').trim();
  const { department, type, status, authority } = classify({ fields, rel });
  return {
    documentId: docId || slugFromRel(rel),
    hasControlledId: Boolean(docId),
    title: (fields['Document Title'] || '').trim() || rel.replace(/\.md$/i, ''),
    slug: slugFromRel(rel),
    path: rel,
    documentType: type,
    department,
    category: type,
    status,
    authority,
    version: (fields['Version'] || '').trim(),
    effectiveDate: (fields['Effective Date'] || '').trim(),
    reviewDate: (fields['Review Date'] || '').trim(),
    owner: (fields['Document Owner'] || '').trim(),
    approvingAuthority: (fields['Approving Authority'] || '').trim(),
    recordClassification: (fields['Record Classification'] || '').trim(),
    retention: (fields['Retention Requirement'] || '').trim(),
    visibility: 'public', // computed/by admin later; template content is public-safe
    references: extractRefs({ text, fields }),
    sourceRepository: undefined,
    sourceBranch: undefined,
    sourceCommit: undefined,
    contentHash: sha256(text),
    indexedAt: new Date().toISOString(),
  };
}

export default { scanAll, buildRecord, sha256, parseHeader, extractIds, extractRefs, classify, slugFromRel };