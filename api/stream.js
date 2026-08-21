import { getList, setList, KEYS, LIMITS } from '../lib/storage.js';
import { sendJson, sendEmpty, readBody, isAdmin, clean, getParam, getClientIp } from '../lib/http.js';
import { seedStream } from '../lib/seed.js';
import { autoArchive, normalizeKeep, publicArchive, checkLiveStatus, deriveLiveState, hasArchive } from '../lib/stream.js';
import { validateEpisode, sanitizeSchedule, syncEpisodeEvent, removeLinkedEvent } from '../lib/episodes.js';
import { stripStreamKeyRefs } from '../lib/streamconfig.js';
import { sendEmail } from '../lib/email.js';

const FIELDS = [
  ['platform', 20],
  ['streamId', 200],
  ['title', 200],
  ['description', 2000],
  ['status', 20],
];

async function sendBroadcastAlerts(stream) {
  const entries = await getList(KEYS.broadcastAlerts);
  const active = entries.filter((e) => e.active);
  if (!active.length) return;
  const platform = stream.platform || 'facebook';
  const title = stream.title || 'Lost Limb Riders Live';
  const subject = `🔴 LIVE NOW: ${title}`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0; padding:0; background:#111; font-family:Arial,sans-serif;"><div style="max-width:560px; margin:0 auto; padding:32px 24px;"><h1 style="color:#ff6a00; font-size:24px; margin:0 0 16px;">🔴 We're Live Now!</h1><p style="color:#d7d7d7; font-size:16px; line-height:1.6; margin:0 0 24px;"><strong>${title}</strong> is streaming live on ${platform} right now.</p><a href="${platform === 'youtube' ? 'https://youtube.com' : 'https://facebook.com'}" style="display:inline-block; background:#ff6a00; color:#fff; font-weight:900; font-size:14px; text-transform:uppercase; letter-spacing:.06em; text-decoration:none; padding:14px 30px; border-radius:10px;">Watch Now</a><p style="color:#8f8f8f; font-size:12px; margin:32px 0 0;">You're receiving this because you signed up for broadcast alerts at lostlimbriders.org.</p></div></body></html>`;
  let sent = 0;
  for (const sub of active) {
    const result = await sendEmail(sub.email, subject, html);
    if (result.ok) sent++;
  }
  console.log(`Broadcast alerts: ${sent}/${active.length} sent`);
}

function normalizeStream(s) {
  if (!s) return { ...seedStream };
  if (s.featured !== undefined) delete s.featured;
  return s;
}

// Facebook stream keys look like "FB-<pageId>-<num>-<hash>" and are secrets.
// "streamId" must hold a viewer-facing Facebook video/page URL, never the key.
const FB_STREAM_KEY_SHAPE = /^FB-\d+-\d+-/;

function publicStream(stream, state) {
  let streamId = stream.streamId || '';
  if ((stream.platform || 'facebook') === 'facebook' && FB_STREAM_KEY_SHAPE.test(streamId)) {
    streamId = '';
  }
  const safe = {
    platform: stream.platform || 'facebook',
    streamId,
    title: stream.title || 'Lost Limb Riders Live',
    description: stream.description || '',
    status: stream.status || 'offline',
    viewerCount: stream.viewerCount || 0,
    archiveKeep: stream.archiveKeep || 20,
    liveStartedAt: stream.liveStartedAt || null,
    liveState: state.liveState,
    platformLive: state.platformLive,
    platformVerified: state.platformVerified,
    lastLiveCheck: stream.lastLiveCheck || null,
    currentEpisode: state.currentEpisode,
    nextEpisode: state.nextEpisode,
    episodes: state.episodes,
    schedule: state.episodes,
  };
  return safe;
}

export default function handler(req, res) {
  if (req.method === 'OPTIONS') return sendEmpty(res);

  const action = getParam(req, 'action') || 'get';

  if (action === 'get') {
    getList(KEYS.stream)
      .then(async (arr) => {
        let stream;
        if (!arr.length) {
          stream = { ...seedStream };
          await setList(KEYS.stream, [stream]);
        } else {
          stream = normalizeStream(arr[0]);
        }
        const archive = await hasArchive();
        const state = deriveLiveState(stream, { hasArchive: archive });
        sendJson(res, { stream: publicStream(stream, state) });
      })
      .catch(() => sendJson(res, { error: 'Storage error.' }, 500));
    return;
  }

  if (action === 'archive') {
    publicArchive()
      .then((archive) => sendJson(res, { archive }))
      .catch(() => sendJson(res, { error: 'Storage error.' }, 500));
    return;
  }

  if (action === 'check') {
    if (!isAdmin(req)) {
      return sendJson(res, { error: 'Admin access required.' }, 403);
    }
    getList(KEYS.stream).then(async (arr) => {
      const stream = arr.length ? { ...arr[0] } : { ...seedStream };
      const archive = await hasArchive();
      const result = await checkLiveStatus(stream, { hasArchive: archive });
      result.stream.updatedAt = new Date().toISOString();
      await setList(KEYS.stream, [result.stream]);
      sendJson(res, {
        ok: true,
        platform: result.platformResult,
        liveState: result.state.liveState,
        status: result.stream.status,
      });
    }).catch(() => sendJson(res, { error: 'Storage error.' }, 500));
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
      const oldStream = arr.length ? { ...arr[0] } : { ...seedStream };
      const stream = { ...oldStream };

      for (const [field, limit] of FIELDS) {
        if (payload[field] !== undefined) {
          stream[field] = clean(payload[field], limit);
        }
      }
      if (payload.viewerCount !== undefined) stream.viewerCount = parseInt(payload.viewerCount, 10) || 0;
      if (payload.archiveKeep !== undefined) stream.archiveKeep = normalizeKeep(payload.archiveKeep);
      if (stream.platform && !['youtube', 'facebook', 'twitch', 'owncast'].includes(stream.platform)) {
        return sendJson(res, { error: 'Platform must be youtube, facebook, twitch, or owncast.' }, 422);
      }
      const cleaned = sanitizeSchedule(payload.schedule);
      if (cleaned) stream.schedule = cleaned;
      if (stream.status === 'live' && oldStream.status !== 'live') {
        stream.liveStartedAt = new Date().toISOString();
        sendBroadcastAlerts(stream).catch(() => {});
      }
      if (stream.status !== 'live') delete stream.liveStartedAt;
      stream.updatedAt = new Date().toISOString();
      await autoArchive(oldStream, stream);
      await setList(KEYS.stream, [stream]);
      const state = deriveLiveState(stream, { hasArchive: await hasArchive() });
      return sendJson(res, { stream: publicStream(stream, state) });
    }

    if (action === 'add-schedule' && req.method === 'POST') {
      const { episode, errors } = validateEpisode(payload, { stream: {} });
      if (errors.length) {
        return sendJson(res, { error: errors[0], errors }, 422);
      }
      const arr = await getList(KEYS.stream);
      const stream = arr.length ? { ...arr[0] } : { ...seedStream };
      if (!stream.schedule) stream.schedule = [];
      stream.schedule.unshift(episode);
      stream.updatedAt = new Date().toISOString();
      const events = await syncEpisodeEvent(await getList(KEYS.events), episode);
      await setList(KEYS.events, events);
      await setList(KEYS.stream, [stream]);
      return sendJson(res, { stream: stripStreamKeyRefs(stream), episode: stripStreamKeyRefs(episode) }, 201);
    }

    if (action === 'update-schedule' && req.method === 'POST') {
      const id = String(payload.id ?? '');
      if (!id) return sendJson(res, { error: 'Schedule ID required.' }, 422);

      const arr = await getList(KEYS.stream);
      const stream = arr.length ? { ...arr[0] } : { ...seedStream };
      const idx = (stream.schedule || []).findIndex((s) => s.id === id);
      if (idx === -1) return sendJson(res, { error: 'Schedule item not found.' }, 404);

      const { episode, errors } = validateEpisode(payload, { stream, id });
      if (errors.length) {
        return sendJson(res, { error: errors[0], errors }, 422);
      }
      stream.schedule[idx] = episode;
      stream.updatedAt = new Date().toISOString();
      const events = await syncEpisodeEvent(await getList(KEYS.events), episode);
      await setList(KEYS.events, events);
      await setList(KEYS.stream, [stream]);
      return sendJson(res, { stream: stripStreamKeyRefs(stream), episode: stripStreamKeyRefs(episode) });
    }

    if (action === 'delete-schedule' && req.method === 'POST') {
      const id = String(payload.id ?? '');
      if (!id) return sendJson(res, { error: 'Schedule ID required.' }, 422);

      const arr = await getList(KEYS.stream);
      const stream = arr.length ? { ...arr[0] } : { ...seedStream };
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
      return sendJson(res, { stream: stripStreamKeyRefs(stream) });
    }

    sendJson(res, { error: 'Unsupported action.' }, 404);
  }).catch(() => sendJson(res, { error: 'Storage error.' }, 500));
}
