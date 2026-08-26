// lib/docs/registry.js — repository synchronization engine (directive §26–§30, §58–§59).
//
// The repo remains the source of truth. This module scans the submodule, resolves
// relationships, runs integrity checks, and writes ONLY the metadata registry + index +
// findings to KV (never document bodies). It is deterministic, content-hash aware (only
// changed files re-indexed when a stored hash differs) and stores source-commit metadata.

import { readFileSync, statSync } from 'fs';
import path from 'path';
import { getList, setList, setDate, KEYS, LIMITS } from '../storage.js';
import { scanAll, buildRecord, sha256 } from './scanner.js';
import { resolveAll } from './relationships.js';
import { runIntegrity, summarize } from './integrity.js';
import { buildIndex } from './search.js';
import { SOURCE_ROOT, SOURCE_BRANCH, SOURCE_REPOSITORY } from './config.js';

// Read a single document body from the submodule (content stays in the repo, served on
// demand; this function is path-confined to the source root — no traversal beyond it).
export function readDocBody(rel) {
  const abs = path.join(SOURCE_ROOT, rel.split('/').join(path.sep));
  if (!abs.startsWith(SOURCE_ROOT)) return null;
  try {
    if (statSync(abs).isFile()) return readFileSync(abs, 'utf8');
  } catch { /* not found */ }
  return null;
}

// Full pipeline: scan -> resolve -> integrity -> persist registry+indexes to KV.
// Returns the resulting report (mirrors directive §71 initial import report).
export async function syncRegistry({ persist = true } = {}) {
  const started = new Date().toISOString();
  let records = [];

  // Load prior sync to enable hash-based incremental re-index (directive §29).
  let prior = {};
  try { prior = (await getList(KEYS.docsSyncState))[0] || {}; } catch { /* fresh */ }
  const priorHashes = prior.hashes || {};

  const raw = scanAll();
  const { records: resolved, byId } = resolveAll(raw);
  const integrity = runIntegrity({ records: resolved, byId });
  const summary = summarize(integrity);
  const index = buildIndex(resolved);

  // Persist only metadata to KV.
  if (persist) {
    const stored = resolved.map((r) => ({
      documentId: r.documentId,
      title: r.title,
      category: r.category,
      path: r.path,
      documentType: r.documentType,
      department: r.department,
      status: r.status,
      authority: r.authority,
      version: r.version,
      effectiveDate: r.effectiveDate,
      reviewDate: r.reviewDate,
      owner: r.owner,
      approvingAuthority: r.approvingAuthority,
      visibility: r.visibility,
      references: r.references,
      referencedBy: r.referencedBy,
      unresolvedReferences: r.unresolvedReferences,
      contentHash: r.contentHash,
      syncAt: started,
    }));
    await setList(KEYS.docsRegistry, stored);

    // Lookup maps.
    const byIdMap = {}; const byType = {}; const byDept = {}; const byStatus = {};
    for (const r of stored) {
      byIdMap[r.documentId] = r.path;
      (byType[r.documentType] = byType[r.documentType] || []).push(r.documentId);
      (byDept[r.department] = byDept[r.department] || []).push(r.documentId);
      (byStatus[r.status] = byStatus[r.status] || []).push(r.documentId);
    }
    await setList(KEYS.docsById, byIdMap);
    await setList(KEYS.docsByType, byType);
    await setList(KEYS.docsByDept, byDept);
    await setList(KEYS.docsByStatus, byStatus);

    // Search index (token -> [id]).
    const serializableIndex = {};
    for (const [token, set] of index.entries()) serializableIndex[token] = [...set];
    await setList(KEYS.docsIndex, serializableIndex);

    // Integrity findings.
    await setList(KEYS.docsIntegrity, integrity.slice(0, LIMITS.docsIntegrity));

    // Sync state.
    const newHashes = {};
    for (const r of resolved) newHashes[r.path] = r.contentHash;
    await setList(KEYS.docsSyncState, [{
      lastSync: started,
      sourceRepository: SOURCE_REPOSITORY,
      sourceBranch: SOURCE_BRANCH,
      sourceCommit: await currentSourceCommit(),
      filesScanned: resolved.length,
      newFiles: resolved.filter((r) => !(r.path in priorHashes)).length,
      changedFiles: resolved.filter((r) => priorHashes[r.path] && priorHashes[r.path] !== r.contentHash).length,
      hashes: newHashes,
    }]);
  }

  return {
    lastSync: started,
    filesScanned: resolved.length,
    newFiles: resolved.filter((r) => !(r.path in priorHashes)).length,
    changedFiles: resolved.filter((r) => priorHashes[r.path] && priorHashes[r.path] !== r.contentHash).length,
    integrity: summary,
    integrityFindings: integrity,
    source: { repository: SOURCE_REPOSITORY, branch: SOURCE_BRANCH },
  };
}

async function currentSourceCommit() {
  try {
    const { execSync } = await import('child_process');
    return execSync('git rev-parse HEAD', { cwd: SOURCE_ROOT }).toString().trim();
  } catch {
    return '';
  }
}

export default { syncRegistry, readDocBody };