import { getList, setList, KEYS, LIMITS } from '../lib/storage.js';
import { sendJson, sendEmpty, readBody, isAdmin, clean, getParam } from '../lib/http.js';

export default function handler(req, res) {
  if (req.method === 'OPTIONS') return sendEmpty(res);

  const action = getParam(req, 'action') || 'list';

  if (action === 'list') {
    getList(KEYS.testimonials)
      .then((entries) => {
        const approved = entries.filter((t) => t.status === 'approved');
        sendJson(res, { testimonials: approved });
      })
      .catch(() => sendJson(res, { error: 'Storage error.' }, 500));
    return;
  }

  if (action === 'submit' && req.method === 'POST') {
    readBody(req).then(async (payload) => {
      const name = clean(payload.name, 80);
      const quote = clean(payload.quote, 1000);
      const ridingInfo = clean(payload.ridingInfo, 120);

      if (!name || !quote) {
        return sendJson(res, { error: 'Name and testimonial are required.' }, 422);
      }

      const entry = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name,
        quote,
        ridingInfo: ridingInfo || null,
        status: 'pending',
        submittedAt: new Date().toISOString(),
      };

      const entries = await getList(KEYS.testimonials);
      entries.unshift(entry);
      const trimmed = entries.slice(0, LIMITS.testimonials);
      await setList(KEYS.testimonials, trimmed);

      return sendJson(res, { ok: true, message: 'Testimonial submitted for review.' }, 201);
    }).catch(() => sendJson(res, { error: 'Storage error.' }, 500));
    return;
  }

  if (action === 'pending') {
    if (!isAdmin(req)) return sendJson(res, { error: 'Admin access required.' }, 403);
    getList(KEYS.testimonials)
      .then((entries) => {
        const pending = entries.filter((t) => t.status === 'pending');
        sendJson(res, { pending, total: pending.length });
      })
      .catch(() => sendJson(res, { error: 'Storage error.' }, 500));
    return;
  }

  if (action === 'approve' && req.method === 'POST') {
    if (!isAdmin(req)) return sendJson(res, { error: 'Admin access required.' }, 403);
    readBody(req).then(async (payload) => {
      const id = String(payload.id || '');
      if (!id) return sendJson(res, { error: 'ID is required.' }, 422);

      const entries = await getList(KEYS.testimonials);
      const idx = entries.findIndex((t) => t.id === id);
      if (idx < 0) return sendJson(res, { error: 'Testimonial not found.' }, 404);

      entries[idx].status = 'approved';
      entries[idx].approvedAt = new Date().toISOString();
      await setList(KEYS.testimonials, entries);

      return sendJson(res, { ok: true, message: 'Approved.' });
    }).catch(() => sendJson(res, { error: 'Storage error.' }, 500));
    return;
  }

  if (action === 'delete' && req.method === 'POST') {
    if (!isAdmin(req)) return sendJson(res, { error: 'Admin access required.' }, 403);
    readBody(req).then(async (payload) => {
      const id = String(payload.id || '');
      if (!id) return sendJson(res, { error: 'ID is required.' }, 422);

      const entries = await getList(KEYS.testimonials);
      const idx = entries.findIndex((t) => t.id === id);
      if (idx < 0) return sendJson(res, { error: 'Testimonial not found.' }, 404);

      entries.splice(idx, 1);
      await setList(KEYS.testimonials, entries);

      return sendJson(res, { ok: true, message: 'Deleted.' });
    }).catch(() => sendJson(res, { error: 'Storage error.' }, 500));
    return;
  }

  sendJson(res, { error: 'Unsupported action.' }, 404);
}
