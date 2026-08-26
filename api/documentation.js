import { getList, setList, KEYS } from '../lib/storage.js';
import { sendJson, sendEmpty, readBody, isAdmin, clean, getParam } from '../lib/http.js';
import { addAudit } from '../lib/audit.js';
import { syncRegistry, readDocBody } from '../lib/docs/registry.js';
import { search, buildIndex } from '../lib/docs/search.js';
import { summarize } from '../lib/docs/integrity.js';
import { DOC_TYPES, DOC_STATUS } from '../lib/docs/config.js';

const MAX_DETAIL = 300;

export const maxDuration = 60;

export default function handler(req, res) {
  if (req.method === 'OPTIONS') return sendEmpty(res);

  const action = getParam(req, 'action') || 'list';

  // Public actions.
  if (action === 'stats') return doStats(req, res);
  if (action === 'list') return doList(req, res);
  if (action === 'search') return doSearch(req, res);
  if (action === 'get') return doGet(req, res);
  if (action === 'departments') return doDepartments(req, res);
  if (action === 'types') return doTypes(req, res);
  if (action === 'integrity') return doIntegrity(req, res);
  if (action === 'sync-state') return doSyncState(req, res);

  // Admin-only actions.
  if (!isAdmin(req)) {
    return sendJson(res, { error: 'Admin access required.' }, 403);
  }
  if (action === 'sync' && req.method === 'POST') return doSync(req, res);
  if (action === 'update' && req.method === 'POST') return doUpdate(req, res);

  return sendJson(res, { error: `Unknown action '${action}'.` }, 404);
}

// Report used by the Documentation Control Center dashboard.
function doStats(req, res) {
  getList(KEYS.docsRegistry).then((docs) => {
    getList(KEYS.docsIntegrity).then((findings) => {
      const byStatus = {};
      const byType = {};
      for (const d of docs) {
        byStatus[d.status] = (byStatus[d.status] || 0) + 1;
        byType[d.documentType] = (byType[d.documentType] || 0) + 1;
      }
      sendJson(res, {
        total: docs.length,
        byStatus,
        byType,
        integrity: summarize(findings),
        availableTypes: DOC_TYPES,
        availableStatuses: DOC_STATUS,
      });
    }).catch(() => sendJson(res, { error: 'Storage error.' }, 500));
  }).catch(() => sendJson(res, { error: 'Storage error.' }, 500));
}

function doList(req, res) {
  const dept = clean(getParam(req, 'dept'), 60);
  const type = clean(getParam(req, 'type'), 60);
  const status = clean(getParam(req, 'status'), 40);
  const authority = clean(getParam(req, 'authority'), 40);
  const q = clean(getParam(req, 'q'), 200);
  const limit = Math.min(100, Math.max(1, parseInt(getParam(req, 'limit') || '50', 10) || 50));
  const page = Math.max(1, parseInt(getParam(req, 'page') || '1', 10) || 1);

  getList(KEYS.docsRegistry).then((docs) => {
    let rows = docs;
    if (dept) rows = rows.filter((d) => d.department.toLowerCase().includes(dept.toLowerCase()));
    if (type) rows = rows.filter((d) => d.documentType.toLowerCase().includes(type.toLowerCase()));
    if (status) rows = rows.filter((d) => d.status.toLowerCase().includes(status.toLowerCase()));
    if (authority) rows = rows.filter((d) => d.authority.toLowerCase().includes(authority.toLowerCase()));
    if (q) {
      const index = buildIndex(rows);
      const hits = new Set();
      for (const [token, ids] of index.entries()) {
        if (q.toLowerCase().includes(token) || token.includes(q.toLowerCase())) {
          for (const id of ids) hits.add(id);
        }
      }
      rows = hits.size ? rows.filter((d) => hits.has(d.documentId)) : [];
    }
    const total = rows.length;
    const pages = Math.max(1, Math.ceil(total / limit));
    const slice = rows.slice((page - 1) * limit, page * limit);
    sendJson(res, {
      documents: slice.map(publicDoc),
      total,
      page,
      pages,
      limit,
    });
  }).catch(() => sendJson(res, { error: 'Storage error.' }, 500));
}

function doSearch(req, res) {
  const q = clean(getParam(req, 'q'), 300);
  if (!q) {
    return sendJson(res, { error: 'Query parameter q is required.' }, 422);
  }
  const filters = {
    department: clean(getParam(req, 'dept'), 60),
    documentType: clean(getParam(req, 'type'), 60),
    status: clean(getParam(req, 'status'), 40),
    authority: clean(getParam(req, 'authority'), 40),
  };
  getList(KEYS.docsRegistry).then((docs) => {
    const results = search(docs, q, filters).slice(0, 60);
    sendJson(res, { results: results.map(publicDoc), count: results.length, query: q });
  }).catch(() => sendJson(res, { error: 'Storage error.' }, 500));
}

function doGet(req, res) {
  const id = clean(getParam(req, 'id'), 120);
  if (!id) return sendJson(res, { error: 'Document id is required.' }, 422);
  getList(KEYS.docsRegistry).then((docs) => {
    const doc = docs.find((d) =>
      d.documentId.toLowerCase() === id.toLowerCase() ||
      d.path.toLowerCase() === id.toLowerCase() ||
      d.slug.toLowerCase() === id.toLowerCase());
    if (!doc) return sendJson(res, { error: 'Document not found.' }, 404);
    const body = readDocBody(doc.path);
    if (body === null) {
      return sendJson(res, { error: 'Source file not available for reading.' }, 503);
    }
    const backlinks = docs
      .filter((d) => (d.references || []).includes(doc.documentId) && d.documentId !== doc.documentId)
      .map(publicDoc);
    sendJson(res, {
      document: { ...publicDoc(doc), content: body.length <= 200000 ? body : null },
      referencedBy: backlinks,
    });
  }).catch(() => sendJson(res, { error: 'Storage error.' }, 500));
}

function doDepartments(req, res) {
  getList(KEYS.docsRegistry).then((docs) => {
    const map = {};
    for (const d of docs) {
      (map[d.department] = map[d.department] || []).push(publicDoc(d));
    }
    sendJson(res, { departments: map });
  }).catch(() => sendJson(res, { error: 'Storage error.' }, 500));
}

function doTypes(req, res) {
  sendJson(res, { types: DOC_TYPES });
}

function doIntegrity(req, res) {
  getList(KEYS.docsIntegrity).then((findings) => {
    const severity = clean(getParam(req, 'severity'), 20);
    let rows = findings;
    if (severity) rows = rows.filter((f) => f.severity === severity);
    const limit = Math.min(200, Math.max(1, parseInt(getParam(req, 'limit') || '100', 10) || 100));
    sendJson(res, { findings: rows.slice(0, limit), total: rows.length, summary: summarize(findings) });
  }).catch(() => sendJson(res, { error: 'Storage error.' }, 500));
}

function doSyncState(req, res) {
  getList(KEYS.docsSyncState).then((state) => {
    const s = state[0] || null;
    sendJson(res, { sync: s ? { ...s, hashes: undefined } : null });
  }).catch(() => sendJson(res, { error: 'Storage error.' }, 500));
}

// Admin: trigger a full repository sync (scan + resolve + integrity + persist).
async function doSync(req, res) {
  try {
    const report = await syncRegistry();
    await addAudit('DOCUMENTATION_SYNC', getAdminEmail(req), { filesScanned: report.filesScanned });
    sendJson(res, { ok: true, ...report, integrity: report.integrity });
  } catch (err) {
    console.error('docs sync failed:', err);
    sendJson(res, { error: 'Documentation sync failed.' }, 500);
  }
}

// Admin: update registry-driven fields on a document (visibility/status/owner/authority).
async function doUpdate(req, res) {
  const payload = await readBody(req);
  const id = clean(payload.id, 120);
  if (!id) return sendJson(res, { error: 'Document id is required.' }, 422);
  const allowed = ['visibility', 'status', 'owner', 'approvingAuthority', 'authority'];
  const docs = await getList(KEYS.docsRegistry);
  const idx = docs.findIndex((d) =>
    d.documentId.toLowerCase() === id.toLowerCase() ||
    d.path.toLowerCase() === id.toLowerCase() || d.slug.toLowerCase() === id.toLowerCase());
  if (idx === -1) return sendJson(res, { error: 'Document not found.' }, 404);
  const before = { ...docs[idx] };
  let changed = false;
  for (const field of allowed) {
    if (payload[field] !== undefined && String(payload[field]).trim() !== '') {
      docs[idx][field] = clean(payload[field], 120);
      changed = true;
    }
  }
  if (!changed) return sendJson(res, { error: 'Nothing to update.' }, 422);
  await setList(KEYS.docsRegistry, docs);
  await addAudit('DOCUMENT_UPDATE', getAdminEmail(req), { documentId: docs[idx].documentId, from: before, to: docs[idx] });
  sendJson(res, { ok: true, document: publicDoc(docs[idx]) });
}

function publicDoc(d) {
  const copy = {
    documentId: d.documentId,
    title: d.title,
    slug: d.slug,
    path: d.path,
    documentType: d.documentType,
    category: d.category,
    department: d.department,
    status: d.status,
    authority: d.authority,
    version: d.version,
    effectiveDate: d.effectiveDate,
    reviewDate: d.reviewDate,
    owner: d.owner,
    approvingAuthority: d.approvingAuthority,
    visibility: d.visibility,
    references: d.references || [],
    referencedBy: d.referencedBy || [],
    unresolvedReferences: d.unresolvedReferences || [],
    syncAt: d.syncAt,
  };
  copy.description = String(d.description || d.title || '').slice(0, MAX_DETAIL);
  return copy;
}

function getAdminEmail(req) {
  return String(req.headers['x-admin-email'] || 'administrator');
}

export { publicDoc };