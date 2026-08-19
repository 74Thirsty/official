import { getList, setList, KEYS, LIMITS } from '../lib/storage.js';
import { sendJson, sendEmpty, readBody, isAdmin, clean, getParam } from '../lib/http.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(__dirname, '..', 'assets', 'approved', 'manifest.json');

function getManifest() {
  try {
    const raw = readFileSync(manifestPath, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export default function handler(req, res) {
  if (req.method === 'OPTIONS') return sendEmpty(res);

  const type = getParam(req, 'type') || 'gallery';
  const action = getParam(req, 'action') || 'list';

  if (type === 'gallery') {
    return handleGallery(req, res, action);
  }
  if (type === 'testimonial') {
    return handleTestimonial(req, res, action);
  }
  sendJson(res, { error: 'Invalid type. Use gallery or testimonial.' }, 422);
}

function handleGallery(req, res, action) {
  if (action === 'list') {
    try {
      const images = getManifest();
      sendJson(res, { images });
    } catch {
      sendJson(res, { images: [] });
    }
    return;
  }

  if (action === 'submit' && req.method === 'POST') {
    readBody(req).then(async (payload) => {
      const name = clean(payload.name, 80);
      const caption = clean(payload.caption, 300);
      const imageData = String(payload.image || '');

      if (!name || !imageData) {
        return sendJson(res, { error: 'Name and image are required.' }, 422);
      }

      if (!imageData.startsWith('data:image/')) {
        return sendJson(res, { error: 'Invalid image data.' }, 422);
      }

      const sizeKB = Math.round((imageData.length * 3) / 4 / 1024);
      if (sizeKB > 600) {
        return sendJson(res, { error: 'Image must be under 500KB after compression.' }, 422);
      }

      const submission = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name,
        caption,
        image: imageData,
        status: 'pending',
        submittedAt: new Date().toISOString(),
      };

      const pending = await getList(KEYS.galleryPending);
      pending.unshift(submission);
      const trimmed = pending.slice(0, LIMITS.galleryPending);
      await setList(KEYS.galleryPending, trimmed);

      return sendJson(res, { ok: true, message: 'Photo submitted for review.' }, 201);
    }).catch(() => sendJson(res, { error: 'Storage error.' }, 500));
    return;
  }

  if (action === 'pending') {
    if (!isAdmin(req)) return sendJson(res, { error: 'Admin access required.' }, 403);
    getList(KEYS.galleryPending)
      .then((pending) => sendJson(res, { pending, total: pending.length }))
      .catch(() => sendJson(res, { error: 'Storage error.' }, 500));
    return;
  }

  if (action === 'approve' && req.method === 'POST') {
    if (!isAdmin(req)) return sendJson(res, { error: 'Admin access required.' }, 403);
    readBody(req).then(async (payload) => {
      const id = String(payload.id || '');
      if (!id) return sendJson(res, { error: 'ID is required.' }, 422);

      const pending = await getList(KEYS.galleryPending);
      const idx = pending.findIndex((p) => p.id === id);
      if (idx < 0) return sendJson(res, { error: 'Submission not found.' }, 404);

      const entry = pending[idx];
      delete entry.image;
      entry.status = 'approved';
      entry.approvedAt = new Date().toISOString();
      entry.title = clean(payload.title, 120) || entry.name;

      pending.splice(idx, 1);
      await setList(KEYS.galleryPending, pending);

      return sendJson(res, { ok: true, message: 'Approved. Add image to assets/approved/ and update manifest.json.' });
    }).catch(() => sendJson(res, { error: 'Storage error.' }, 500));
    return;
  }

  if (action === 'delete' && req.method === 'POST') {
    if (!isAdmin(req)) return sendJson(res, { error: 'Admin access required.' }, 403);
    readBody(req).then(async (payload) => {
      const id = String(payload.id || '');
      if (!id) return sendJson(res, { error: 'ID is required.' }, 422);

      const pending = await getList(KEYS.galleryPending);
      const idx = pending.findIndex((p) => p.id === id);
      if (idx < 0) return sendJson(res, { error: 'Submission not found.' }, 404);

      pending.splice(idx, 1);
      await setList(KEYS.galleryPending, pending);

      return sendJson(res, { ok: true, message: 'Deleted.' });
    }).catch(() => sendJson(res, { error: 'Storage error.' }, 500));
    return;
  }

  sendJson(res, { error: 'Unsupported gallery action.' }, 404);
}

function handleTestimonial(req, res, action) {
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

  sendJson(res, { error: 'Unsupported testimonial action.' }, 404);
}
