import { getList, setList, KEYS } from '../lib/storage.js';
import { sendJson, sendEmpty, readBody, isAdmin, clean, getParam } from '../lib/http.js';
import { seedStream } from '../lib/seed.js';
import { autoArchive, normalizeKeep, publicArchive, checkLiveStatus, deriveLiveState, hasArchive } from '../lib/stream.js';
import { validateEpisode, sanitizeSchedule, syncEpisodeEvent, removeLinkedEvent } from '../lib/episodes.js';
import { stripStreamKeyRefs } from '../lib/streamconfig.js';

const FIELDS = [
  ['platform', 20],
  ['streamId', 200],
  ['title', 200],
  ['description', 2000],
  ['status', 20],
];

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
