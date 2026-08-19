import { getList, setList, KEYS } from '../lib/storage.js';
import { readFile } from 'node:fs/promises';
import { sendJson, sendEmpty, getParam } from '../lib/http.js';
import { addAudit } from '../lib/audit.js';

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

    const pdfPath = new URL('../assets/i-can-i-will-STANDARD-PRINT-READY and Certificate.pdf', import.meta.url);
    let pdf;
    try {
      pdf = await readFile(pdfPath);
    } catch (err) {
      console.error('E-book asset unavailable:', err);
      return sendJson(res, { error: 'Book asset unavailable.' }, 503);
    }

    sub.ebookTokenUsed = true;
    sub.ebookAccessedAt = new Date().toISOString();
    sub.ebookDownloadCount = (sub.ebookDownloadCount || 0) + 1;
    sub.ebookUrlKind = 'asset';
    await setList(KEYS.subscribers, subs);

    await addAudit('ebook_accessed', sub.email, { downloadCount: sub.ebookDownloadCount, kind: 'asset' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="I Can I Will.pdf"');
    return res.status(200).send(pdf);
  }).catch(() => sendJson(res, { error: 'Storage error.' }, 500));
}
