import { getList, setList, KEYS, LIMITS } from '../lib/storage.js';
import { sendJson, sendEmpty, readBody, isAdmin, clean, getParam } from '../lib/http.js';
import { put, del } from '@vercel/blob';

function decodeDataUrl(dataUrl) {
  const match = String(dataUrl).match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) return null;
  return { ext: match[1] === 'jpeg' ? 'jpg' : match[1], buffer: Buffer.from(match[2], 'base64') };
}

function blobPathname(id, ext) {
  return `community/gallery/${id}.${ext}`;
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
  if (type === 'comment') {
    return handleComment(req, res, action);
  }
  sendJson(res, { error: 'Invalid type. Use gallery, testimonial, or comment.' }, 422);
}

function handleGallery(req, res, action) {
  if (action === 'list') {
    getList(KEYS.galleryApproved)
      .then((images) => sendJson(res, { images }))
      .catch(() => sendJson(res, { images: [] }));
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
        return sendJson(res, { error: 'Image must be under 600KB after compression.' }, 422);
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
      const decoded = decodeDataUrl(entry.image);
      if (!decoded) return sendJson(res, { error: 'Could not decode image data.' }, 422);

      const pathname = blobPathname(entry.id, decoded.ext);
      const blob = await put(pathname, decoded.buffer, {
        access: 'public',
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });

      const approved = await getList(KEYS.galleryApproved);
      approved.unshift({
        id: entry.id,
        name: entry.name,
        caption: entry.caption || null,
        title: clean(payload.title, 120) || entry.name,
        url: blob.url,
        pathname,
        submittedAt: entry.submittedAt,
        approvedAt: new Date().toISOString(),
      });
      await setList(KEYS.galleryApproved, approved.slice(0, LIMITS.galleryApproved));

      pending.splice(idx, 1);
      await setList(KEYS.galleryPending, pending);

      return sendJson(res, { ok: true, message: 'Approved and uploaded.' });
    }).catch((err) => sendJson(res, { error: 'Approve failed: ' + (err.message || err) }, 500));
    return;
  }

  if (action === 'unapprove' && req.method === 'POST') {
    if (!isAdmin(req)) return sendJson(res, { error: 'Admin access required.' }, 403);
    readBody(req).then(async (payload) => {
      const id = String(payload.id || '');
      if (!id) return sendJson(res, { error: 'ID is required.' }, 422);

      const approved = await getList(KEYS.galleryApproved);
      const idx = approved.findIndex((a) => a.id === id);
      if (idx < 0) return sendJson(res, { error: 'Approved entry not found.' }, 404);

      const entry = approved[idx];
      if (entry.pathname) {
        try { await del(entry.pathname, { token: process.env.BLOB_READ_WRITE_TOKEN }); } catch {}
      }

      approved.splice(idx, 1);
      await setList(KEYS.galleryApproved, approved);

      return sendJson(res, { ok: true, message: 'Unapproved. Image removed from gallery.' });
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

function handleComment(req, res, action) {
  if (action === 'list') {
    const targetType = getParam(req, 'targetType') || '';
    const targetId = getParam(req, 'targetId') || '';
    if (!targetType || !targetId) {
      return sendJson(res, { error: 'targetType and targetId are required.' }, 422);
    }
    getList(KEYS.comments)
      .then((all) => {
        const approved = all.filter(
          (c) => c.status === 'approved' && c.targetType === targetType && c.targetId === targetId
        );
        sendJson(res, { comments: approved });
      })
      .catch(() => sendJson(res, { comments: [] }));
    return;
  }

  if (action === 'submit' && req.method === 'POST') {
    readBody(req).then(async (payload) => {
      const targetType = clean(payload.targetType, 20);
      const targetId = clean(payload.targetId, 40);
      const name = clean(payload.name, 80);
      const text = clean(payload.text, 1000);

      if (!targetType || !targetId || !name || !text) {
        return sendJson(res, { error: 'All fields are required.' }, 422);
      }
      if (targetType !== 'gallery' && targetType !== 'testimonial') {
        return sendJson(res, { error: 'Invalid target type.' }, 422);
      }

      const comment = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        targetType,
        targetId,
        name,
        text,
        status: 'pending',
        submittedAt: new Date().toISOString(),
      };

      const all = await getList(KEYS.comments);
      all.unshift(comment);
      const trimmed = all.slice(0, LIMITS.comments);
      await setList(KEYS.comments, trimmed);

      return sendJson(res, { ok: true, message: 'Comment submitted for review.' }, 201);
    }).catch(() => sendJson(res, { error: 'Storage error.' }, 500));
    return;
  }

  if (action === 'pending') {
    if (!isAdmin(req)) return sendJson(res, { error: 'Admin access required.' }, 403);
    getList(KEYS.comments)
      .then((all) => {
        const pending = all.filter((c) => c.status === 'pending');
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

      const all = await getList(KEYS.comments);
      const idx = all.findIndex((c) => c.id === id);
      if (idx < 0) return sendJson(res, { error: 'Comment not found.' }, 404);

      all[idx].status = 'approved';
      all[idx].approvedAt = new Date().toISOString();
      await setList(KEYS.comments, all);

      return sendJson(res, { ok: true, message: 'Approved.' });
    }).catch(() => sendJson(res, { error: 'Storage error.' }, 500));
    return;
  }

  if (action === 'delete' && req.method === 'POST') {
    if (!isAdmin(req)) return sendJson(res, { error: 'Admin access required.' }, 403);
    readBody(req).then(async (payload) => {
      const id = String(payload.id || '');
      if (!id) return sendJson(res, { error: 'ID is required.' }, 422);

      const all = await getList(KEYS.comments);
      const idx = all.findIndex((c) => c.id === id);
      if (idx < 0) return sendJson(res, { error: 'Comment not found.' }, 404);

      all.splice(idx, 1);
      await setList(KEYS.comments, all);

      return sendJson(res, { ok: true, message: 'Deleted.' });
    }).catch(() => sendJson(res, { error: 'Storage error.' }, 500));
    return;
  }

  sendJson(res, { error: 'Unsupported comment action.' }, 404);
}
