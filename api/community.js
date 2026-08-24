import { getList, setList, KEYS, LIMITS } from '../lib/storage.js';
import { sendJson, sendEmpty, readBody, isAdmin, clean, getParam } from '../lib/http.js';
import { put, del } from '@vercel/blob';
import { defaultSponsorLevels } from '../lib/seed.js';

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
  if (type === 'sponsor') {
    return handleSponsor(req, res, action);
  }
  sendJson(res, { error: 'Invalid type. Use gallery, testimonial, comment, or sponsor.' }, 422);
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

function handleSponsor(req, res, action) {
  if (action === 'list') {
    Promise.all([getList(KEYS.sponsors), ensureSponsorLevels()])
      .then(([sponsors, levels]) => {
        const active = sortSponsors(sponsors.filter((s) => s.active), levels);
        sendJson(res, { sponsors: active.map(publicSponsor), levels });
      })
      .catch(() => sendJson(res, { sponsors: [], levels: [] }));
    return;
  }

  if (action === 'list-all') {
    if (!isAdmin(req)) return sendJson(res, { error: 'Admin access required.' }, 403);
    Promise.all([getList(KEYS.sponsors), ensureSponsorLevels()])
      .then(([sponsors, levels]) => sendJson(res, { sponsors: sortSponsors(sponsors, levels), levels }))
      .catch(() => sendJson(res, { error: 'Storage error.' }, 500));
    return;
  }

  if (req.method !== 'POST') return sendJson(res, { error: 'Unsupported sponsor action.' }, 404);
  if (!isAdmin(req)) return sendJson(res, { error: 'Admin access required.' }, 403);

  readBody(req).then(async (payload) => {
    if (action === 'add') return addSponsor(res, payload);
    if (action === 'update') return updateSponsor(res, payload);
    if (action === 'delete') return deleteSponsor(res, payload);
    if (action === 'reorder') return reorderSponsors(res, payload);
    if (action === 'add-level') return addSponsorLevel(res, payload);
    if (action === 'rename-level') return renameSponsorLevel(res, payload);
    if (action === 'delete-level') return deleteSponsorLevel(res, payload);
    sendJson(res, { error: 'Unsupported sponsor action.' }, 404);
  }).catch(() => sendJson(res, { error: 'Storage error.' }, 500));
}

async function ensureSponsorLevels() {
  const levels = await getList(KEYS.sponsorLevels);
  if (levels.length) return levels;
  await setList(KEYS.sponsorLevels, defaultSponsorLevels);
  return defaultSponsorLevels;
}

function sortSponsors(sponsors, levels) {
  const ranks = {};
  for (const level of levels) ranks[level.id] = Number(level.rank) || 0;
  return [...sponsors].sort((a, b) =>
    ((Number(a.order) || 0) - (Number(b.order) || 0)) ||
    ((ranks[a.levelId] || 0) - (ranks[b.levelId] || 0)) ||
    String(a.name || '').localeCompare(String(b.name || ''))
  );
}

function publicSponsor(s) {
  return {
    id: s.id,
    name: s.name,
    levelId: s.levelId,
    description: s.description || '',
    websiteUrl: s.websiteUrl || '',
    contactInfo: s.contactInfo || '',
    logo: s.logo && s.logo.url ? { url: s.logo.url } : null,
    order: Number(s.order) || 0,
    active: Boolean(s.active),
  };
}

function nextSponsorId() {
  return 'sp-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function normalizeOrder(value, fallback) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return Number.isInteger(fallback) ? fallback : 0;
  return Math.min(9999, Math.max(0, n));
}

function isValidWebsiteUrl(url) {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function slugifyLevelName(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function decodeSponsorLogo(dataUrl) {
  const match = String(dataUrl).match(/^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) return null;
  let ext = match[1] === 'jpeg' ? 'jpg' : match[1];
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > 512 * 1024) return null;
  return { ext, buffer };
}

function sponsorLogoPathname(id, ext) {
  return `sponsors/logos/${id}.${ext}`;
}

// Returns the stored logo object, null when no logo was provided,
// or false when an invalid logo was rejected (response already sent).
async function storeSponsorLogo(res, id, logoData) {
  const data = String(logoData || '');
  if (!data) return null;
  const decoded = decodeSponsorLogo(data);
  if (!decoded) {
    sendJson(res, { error: 'Logo must be a PNG, JPG, WebP, or GIF image under 512KB.' }, 422);
    return false;
  }
  try {
    const pathname = sponsorLogoPathname(id, decoded.ext);
    const blob = await put(pathname, decoded.buffer, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return { url: blob.url, pathname };
  } catch (err) {
    sendJson(res, { error: 'Logo upload failed: ' + (err.message || err) }, 500);
    return false;
  }
}

async function removeSponsorLogoFile(logo) {
  if (!logo || !logo.pathname) return;
  try { await del(logo.pathname, { token: process.env.BLOB_READ_WRITE_TOKEN }); } catch {}
}

async function addSponsor(res, payload) {
  const levels = await ensureSponsorLevels();
  const name = clean(payload.name, 120);
  const levelId = clean(payload.levelId, 60);
  if (!name) return sendJson(res, { error: 'Sponsor name is required.' }, 422);
  if (!levels.some((l) => l.id === levelId)) {
    return sendJson(res, { error: 'A valid recognition level is required.' }, 422);
  }
  const websiteUrl = clean(payload.websiteUrl, 500);
  if (!isValidWebsiteUrl(websiteUrl)) {
    return sendJson(res, { error: 'Website URL must be a valid http:// or https:// URL.' }, 422);
  }

  const id = nextSponsorId();
  const logo = await storeSponsorLogo(res, id, payload.logoData);
  if (logo === false) return;

  const sponsors = await getList(KEYS.sponsors);
  const sponsor = {
    id,
    name,
    levelId,
    description: clean(payload.description, 600),
    websiteUrl,
    contactInfo: clean(payload.contactInfo, 200),
    logo,
    active: payload.active === undefined ? true : Boolean(payload.active),
    order: normalizeOrder(payload.order, sponsors.length),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  sponsors.unshift(sponsor);
  await setList(KEYS.sponsors, sponsors.slice(0, LIMITS.sponsors));
  return sendJson(res, { ok: true, sponsor }, 201);
}

async function updateSponsor(res, payload) {
  const id = String(payload.id || '');
  if (!id) return sendJson(res, { error: 'ID is required.' }, 422);

  const sponsors = await getList(KEYS.sponsors);
  const idx = sponsors.findIndex((s) => s.id === id);
  if (idx === -1) return sendJson(res, { error: 'Sponsor not found.' }, 404);

  const sponsor = sponsors[idx];

  if (payload.levelId !== undefined) {
    const levels = await ensureSponsorLevels();
    const levelId = clean(payload.levelId, 60);
    if (!levels.some((l) => l.id === levelId)) {
      return sendJson(res, { error: 'Unknown recognition level.' }, 422);
    }
    sponsor.levelId = levelId;
  }
  if (payload.name !== undefined) {
    const name = clean(payload.name, 120);
    if (!name) return sendJson(res, { error: 'Sponsor name cannot be empty.' }, 422);
    sponsor.name = name;
  }
  if (payload.websiteUrl !== undefined) {
    const websiteUrl = clean(payload.websiteUrl, 500);
    if (!isValidWebsiteUrl(websiteUrl)) {
      return sendJson(res, { error: 'Website URL must be a valid http:// or https:// URL.' }, 422);
    }
    sponsor.websiteUrl = websiteUrl;
  }
  if (payload.description !== undefined) sponsor.description = clean(payload.description, 600);
  if (payload.contactInfo !== undefined) sponsor.contactInfo = clean(payload.contactInfo, 200);
  if (payload.active !== undefined) sponsor.active = Boolean(payload.active);
  if (payload.order !== undefined) sponsor.order = normalizeOrder(payload.order, sponsor.order);

  if (payload.removeLogo) {
    await removeSponsorLogoFile(sponsor.logo);
    sponsor.logo = null;
  }
  if (String(payload.logoData || '')) {
    const logo = await storeSponsorLogo(res, sponsor.id, payload.logoData);
    if (logo === false) return;
    await removeSponsorLogoFile(sponsor.logo);
    sponsor.logo = logo;
  }

  sponsor.updatedAt = new Date().toISOString();
  sponsors[idx] = sponsor;
  await setList(KEYS.sponsors, sponsors);
  return sendJson(res, { ok: true, sponsor });
}

async function deleteSponsor(res, payload) {
  const id = String(payload.id || '');
  if (!id) return sendJson(res, { error: 'ID is required.' }, 422);

  const sponsors = await getList(KEYS.sponsors);
  const idx = sponsors.findIndex((s) => s.id === id);
  if (idx === -1) return sendJson(res, { error: 'Sponsor not found.' }, 404);

  await removeSponsorLogoFile(sponsors[idx].logo);
  sponsors.splice(idx, 1);
  await setList(KEYS.sponsors, sponsors);
  return sendJson(res, { ok: true });
}

async function reorderSponsors(res, payload) {
  const ids = Array.isArray(payload.order) ? payload.order.map((v) => String(v)) : [];
  if (!ids.length) return sendJson(res, { error: 'Order list is required.' }, 422);

  const sponsors = await getList(KEYS.sponsors);
  const known = new Set(sponsors.map((s) => s.id));
  if (ids.some((id) => !known.has(id))) {
    return sendJson(res, { error: 'Unknown sponsor in order list.' }, 422);
  }
  const position = {};
  ids.forEach((id, i) => { position[id] = i; });
  const now = new Date().toISOString();
  for (const sponsor of sponsors) {
    if (position[sponsor.id] !== undefined) {
      sponsor.order = position[sponsor.id];
      sponsor.updatedAt = now;
    }
  }
  await setList(KEYS.sponsors, sponsors);
  return sendJson(res, { ok: true });
}

async function addSponsorLevel(res, payload) {
  const name = clean(payload.name, 40);
  if (!name) return sendJson(res, { error: 'Level name is required.' }, 422);
  const id = slugifyLevelName(name);
  if (!id) return sendJson(res, { error: 'Level name must contain letters or numbers.' }, 422);

  const levels = await ensureSponsorLevels();
  if (levels.some((l) => l.id === id)) {
    return sendJson(res, { error: 'A recognition level with that name already exists.' }, 422);
  }
  const maxRank = levels.reduce((max, l) => Math.max(max, Number(l.rank) || 0), 0);
  const level = { id, name, rank: maxRank + 10 };
  levels.push(level);
  await setList(KEYS.sponsorLevels, levels.slice(0, LIMITS.sponsorLevels));
  return sendJson(res, { ok: true, level }, 201);
}

async function renameSponsorLevel(res, payload) {
  const id = clean(payload.id, 60);
  const name = clean(payload.name, 40);
  if (!id || !name) return sendJson(res, { error: 'Level ID and new name are required.' }, 422);

  const levels = await getList(KEYS.sponsorLevels);
  const level = levels.find((l) => l.id === id);
  if (!level) return sendJson(res, { error: 'Recognition level not found.' }, 404);
  level.name = name;
  await setList(KEYS.sponsorLevels, levels);
  return sendJson(res, { ok: true, level });
}

async function deleteSponsorLevel(res, payload) {
  const id = clean(payload.id, 60);
  if (!id) return sendJson(res, { error: 'Level ID is required.' }, 422);

  const levels = await getList(KEYS.sponsorLevels);
  const idx = levels.findIndex((l) => l.id === id);
  if (idx === -1) return sendJson(res, { error: 'Recognition level not found.' }, 404);

  const sponsors = await getList(KEYS.sponsors);
  if (sponsors.some((s) => s.levelId === id)) {
    return sendJson(res, { error: 'This level still has sponsors assigned. Move them to another level first.' }, 422);
  }
  levels.splice(idx, 1);
  await setList(KEYS.sponsorLevels, levels);
  return sendJson(res, { ok: true });
}
