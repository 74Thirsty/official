import { getList, setList, KEYS } from '../lib/storage.js';
import { sendJson, sendEmpty, sendRedirect, getParam } from '../lib/http.js';
import { addAudit } from '../lib/audit.js';
import { generateDownloadUrl } from '../lib/download.js';

function ttlMs() {
  const days = parseInt(process.env.EBOOK_LINK_TTL_DAYS || '7', 10) || 7;
  return days * 86400000;
}

export default function handler(req, res) {
  if (req.method === 'OPTIONS') return sendEmpty(res);
  if (req.method !== 'GET') {
    return sendJson(res, { error: 'GET required.' }, 405);
  }

  const token = getParam(req, 'token') || '';
  if (!token) {
    return sendJson(res, { error: 'Missing download token.' }, 404);
  }

  getList(KEYS.subscribers).then(async (subs) => {
    const sub = subs.find((s) => s.ebookToken === token);
    if (!sub) {
      return sendJson(res, { error: 'This download link is not valid.' }, 404);
    }
    if (sub.ebookTokenUsed) {
      return sendJson(res, {
        error: 'This download link has already been used. Contact us to request a new link.',
      }, 410);
    }
    const issuedMs = new Date(sub.ebookTokenIssuedAt || sub.signedAt || 0).getTime();
    if (!issuedMs || Date.now() - issuedMs > ttlMs()) {
      return sendJson(res, {
        error: 'This download link has expired. Contact us to request a new link.',
      }, 410);
    }

    const target = generateDownloadUrl();
    if (!target.ok) {
      console.error('No e-book download target configured on the server.');
      return sendJson(res, { error: 'Download not configured.' }, 503);
    }

    sub.ebookTokenUsed = true;
    sub.ebookAccessedAt = new Date().toISOString();
    sub.ebookDownloadCount = (sub.ebookDownloadCount || 0) + 1;
    sub.ebookUrlKind = target.kind;
    await setList(KEYS.subscribers, subs);

    await addAudit('ebook_accessed', sub.email, { downloadCount: sub.ebookDownloadCount, kind: target.kind });

    return sendRedirect(res, target.url);
  }).catch(() => sendJson(res, { error: 'Storage error.' }, 500));
}
