import { getList, setList, KEYS, LIMITS } from '../lib/storage.js';
import { sendJson, sendEmpty, readBody, isAdmin, clean, getParam, getClientIp } from '../lib/http.js';
import { seedStream } from '../lib/seed.js';
import { getPublicStreamState } from '../lib/stream.js';
import { validateEpisode, syncEpisodeEvent, removeLinkedEvent } from '../lib/episodes.js';
import { sendEmail } from '../lib/email.js';

const FIELDS = [
  ['pageUrl', 300],
  ['title', 200],
  ['description', 2000],
];

async function loadStream() {
  const arr = await getList(KEYS.stream);
  if (!arr.length) {
    const fresh = { ...seedStream };
    await setList(KEYS.stream, [fresh]);
    return fresh;
  }
  return arr[0];
}

// Alert once per broadcast: guarded on the live video permalink.
async function maybeSendBroadcastAlerts(stream, state) {
  if (!state.live || !state.liveUrl || stream.lastAlertedLiveUrl === state.liveUrl) return;
  const entries = await getList(KEYS.broadcastAlerts);
  const active = entries.filter((e) => e.active);
  stream.lastAlertedLiveUrl = state.liveUrl;
  if (!active.length) return;
  const title = state.title || 'Lost Limb Riders Live';
  const watchUrl = state.liveUrl || state.pageUrl || 'https://lostlimbriders.org/media.html';
  const platform = state.platform === 'youtube' ? 'YouTube' : 'Facebook';
  const subject = `🔴 LIVE NOW: ${title}`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0; padding:0; background:#111; font-family:Arial,sans-serif;"><div style="max-width:560px; margin:0 auto; padding:32px 24px;"><h1 style="color:#ff6a00; font-size:24px; margin:0 0 16px;">🔴 We're Live Now!</h1><p style="color:#d7d7d7; font-size:16px; line-height:1.6; margin:0 0 24px;"><strong>${title}</strong> is streaming live on ${platform} right now.</p><a href="${watchUrl}" style="display:inline-block; background:#ff6a00; color:#fff; font-weight:900; font-size:14px; text-transform:uppercase; letter-spacing:.06em; text-decoration:none; padding:14px 30px; border-radius:10px;">Watch Now</a><p style="color:#8f8f8f; font-size:12px; margin:32px 0 0;">You're receiving this because you signed up for broadcast alerts at lostlimbriders.org.</p></div></body></html>`;
  let sent = 0;
  for (const sub of active) {
    const result = await sendEmail(sub.email, subject, html);
    if (result.ok) sent++;
  }
  console.log(`Broadcast alerts: ${sent}/${active.length} sent`);
}

async function persistAlertGuard(stream) {
  if (!stream.lastAlertedLiveUrl) return;
  const arr = await getList(KEYS.stream);
  if (arr.length) {
    arr[0].lastAlertedLiveUrl = stream.lastAlertedLiveUrl;
    await setList(KEYS.stream, arr);
  }
}

export default function handler(req, res) {
  if (req.method === 'OPTIONS') return sendEmpty(res);

  const action = getParam(req, 'action') || 'get';

  if (action === 'get') {
    loadStream()
      .then(async (stream) => {
        const state = await getPublicStreamState(stream);
        sendJson(res, { stream: state });
        maybeSendBroadcastAlerts(stream, state)
          .then(() => persistAlertGuard(stream))
          .catch(() => {});
      })
      .catch(() => sendJson(res, { error: 'Storage error.' }, 500));
    return;
  }

  if (action === 'check') {
    if (!isAdmin(req)) {
      return sendJson(res, { error: 'Admin access required.' }, 403);
    }
    loadStream()
      .then(async (stream) => {
        const state = await getPublicStreamState(stream, { force: true });
        await maybeSendBroadcastAlerts(stream, state).catch(() => {});
        await persistAlertGuard(stream);
        sendJson(res, { ok: true, stream: state });
      })
      .catch(() => sendJson(res, { error: 'Storage error.' }, 500));
    return;
  }

  if (action === 'subscribe-alerts' && req.method === 'POST') {
    return readBody(req).then(async (payload) => {
      const email = String(payload.email ?? '').trim().toLowerCase();
      const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !EMAIL_RE.test(email)) {
        return sendJson(res, { error: 'Valid email required.' }, 422);
      }
      const entries = await getList(KEYS.broadcastAlerts);
      const existing = entries.find((e) => e.email === email);
      if (existing) {
        if (existing.active) return sendJson(res, { ok: true, message: 'You are already signed up for broadcast alerts.' });
        existing.active = true;
        existing.resubscribedAt = new Date().toISOString();
        await setList(KEYS.broadcastAlerts, entries);
        return sendJson(res, { ok: true, message: 'Welcome back! You will be notified when we go live.' }, 201);
      }
      entries.unshift({
        email,
        name: clean(payload.name, 120) || '',
        createdAt: new Date().toISOString(),
        active: true,
        ip: getClientIp(req),
      });
      await setList(KEYS.broadcastAlerts, entries.slice(0, LIMITS.broadcastAlerts));
      return sendJson(res, { ok: true, message: 'You will be notified when we go live.' }, 201);
    }).catch(() => sendJson(res, { error: 'Storage error.' }, 500));
  }

  if (!isAdmin(req)) {
    return sendJson(res, { error: 'Admin access required.' }, 403);
  }

  readBody(req).then(async (payload) => {
    if (action === 'update' && req.method === 'POST') {
      const arr = await getList(KEYS.stream);
      const stream = arr.length ? arr[0] : { ...seedStream };
      for (const [field, limit] of FIELDS) {
        if (payload[field] !== undefined) {
          stream[field] = clean(payload[field], limit);
        }
      }
      stream.updatedAt = new Date().toISOString();
      await setList(KEYS.stream, [stream]);
      const state = await getPublicStreamState(stream);
      return sendJson(res, { stream: state });
    }

    if (action === 'add-schedule' && req.method === 'POST') {
      const { episode, errors } = validateEpisode(payload, {});
      if (errors.length) {
        return sendJson(res, { error: errors[0], errors }, 422);
      }
      const stream = await loadStream();
      if (!stream.schedule) stream.schedule = [];
      stream.schedule.unshift(episode);
      stream.updatedAt = new Date().toISOString();
      const events = syncEpisodeEvent(await getList(KEYS.events), episode);
      await setList(KEYS.events, events);
      await setList(KEYS.stream, [stream]);
      return sendJson(res, { episode }, 201);
    }

    if (action === 'update-schedule' && req.method === 'POST') {
      const id = String(payload.id ?? '');
      if (!id) return sendJson(res, { error: 'Schedule ID required.' }, 422);

      const stream = await loadStream();
      const idx = (stream.schedule || []).findIndex((s) => s.id === id);
      if (idx === -1) return sendJson(res, { error: 'Schedule item not found.' }, 404);

      const { episode, errors } = validateEpisode(payload, { id });
      if (errors.length) {
        return sendJson(res, { error: errors[0], errors }, 422);
      }
      stream.schedule[idx] = episode;
      stream.updatedAt = new Date().toISOString();
      const events = syncEpisodeEvent(await getList(KEYS.events), episode);
      await setList(KEYS.events, events);
      await setList(KEYS.stream, [stream]);
      return sendJson(res, { episode });
    }

    if (action === 'delete-schedule' && req.method === 'POST') {
      const id = String(payload.id ?? '');
      if (!id) return sendJson(res, { error: 'Schedule ID required.' }, 422);

      const stream = await loadStream();
      const removed = (stream.schedule || []).find((s) => s.id === id);
      if (stream.schedule) {
        stream.schedule = stream.schedule.filter((s) => s.id !== id);
      }
      stream.updatedAt = new Date().toISOString();
      if (removed) {
        const events = removeLinkedEvent(await getList(KEYS.events), removed.id);
        await setList(KEYS.events, events);
      }
      await setList(KEYS.stream, [stream]);
      return sendJson(res, { ok: true });
    }

    sendJson(res, { error: 'Unsupported action.' }, 404);
  }).catch(() => sendJson(res, { error: 'Storage error.' }, 500));
}
