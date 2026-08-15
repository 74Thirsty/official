import { getList, setList, KEYS, LIMITS } from './storage.js';
import { checkPlatformLive } from './platform.js';
import { computeLiveState } from './episodes.js';

export const STREAM_KEEP_DEFAULT = 20;

export function normalizeKeep(value) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1) return STREAM_KEEP_DEFAULT;
  return Math.min(500, Math.floor(n));
}

async function getStream() {
  const arr = await getList(KEYS.stream);
  return arr.length ? arr[0] : null;
}

export async function getArchiveKeep() {
  const stream = await getStream();
  return stream && stream.archiveKeep ? normalizeKeep(stream.archiveKeep) : STREAM_KEEP_DEFAULT;
}

export function makeArchiveEntry(stream) {
  return {
    id: 'arc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
    title: String(stream.title || 'Lost Limb Riders Live'),
    date: stream.liveStartedAt || new Date().toISOString(),
    platform: stream.platform || 'facebook',
    url: String(stream.streamId || ''),
    description: String(stream.description || ''),
  };
}

export async function autoArchive(oldStream, newStream) {
  const wasLive = oldStream && oldStream.status === 'live';
  const isOffline = newStream.status === 'offline';
  if (!wasLive || !isOffline) return null;

  const url = String(newStream.streamId || '').trim();
  if (!url) return null;

  const entries = await getList(KEYS.streamArchive);
  if (entries.some((e) => e.url === url)) return null;

  const entry = makeArchiveEntry({
    ...newStream,
    liveStartedAt: newStream.liveStartedAt || (oldStream ? oldStream.liveStartedAt : ''),
  });
  entries.unshift(entry);
  await setList(KEYS.streamArchive, entries.slice(0, LIMITS.streamArchive));
  return entry;
}

export async function publicArchive() {
  const [entries, keep] = await Promise.all([getList(KEYS.streamArchive), getArchiveKeep()]);
  return entries.slice(0, keep);
}

export async function adminArchive() {
  const [entries, keep] = await Promise.all([getList(KEYS.streamArchive), getArchiveKeep()]);
  const archive = entries.map((e, i) => ({ ...e, expired: i >= keep }));
  return {
    archive,
    keep,
    pendingPurge: archive.filter((e) => e.expired).length,
  };
}

export async function purgeExpired() {
  const [entries, keep] = await Promise.all([getList(KEYS.streamArchive), getArchiveKeep()]);
  const kept = entries.filter((_, i) => i < keep);
  await setList(KEYS.streamArchive, kept);
  return { kept, purged: entries.length - kept.length };
}

export async function hasArchive() {
  const entries = await getList(KEYS.streamArchive);
  return entries.length > 0;
}

export function platformConfigured(platform) {
  const p = String(platform || '').toLowerCase();
  if (p === 'youtube') return Boolean(process.env.YOUTUBE_API_KEY && (process.env.YOUTUBE_VIDEO_ID || process.env.STREAM_VIDEO_ID));
  if (p === 'facebook') return Boolean(process.env.FACEBOOK_ACCESS_TOKEN && process.env.FACEBOOK_PAGE_ID);
  if (p === 'twitch') return Boolean(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_ACCESS_TOKEN && (process.env.TWITCH_USER_LOGIN || ''));
  if (p === 'owncast') return Boolean(process.env.OWNCAST_URL);
  return false;
}

export function deriveLiveState(stream, opts = {}) {
  const verified = platformConfigured(stream.platform);
  const platformLive = verified ? stream.platformLive === true : stream.status === 'live';
  return computeLiveState(stream, opts.now || new Date(), {
    platformLive,
    platformVerified: verified,
    manualLive: stream.status === 'live',
    hasArchive: opts.hasArchive === true,
  });
}

export async function checkLiveStatus(stream, opts = {}) {
  const platformResult = await checkPlatformLive({ platform: stream.platform, streamId: stream.streamId, fetch: opts.fetch });
  const now = new Date();
  const prevLive = stream.platformLive === true;
  const next = { ...stream };

  next.platformLive = platformResult.configured ? platformResult.live : null;
  next.platformVerified = platformResult.configured;
  next.lastLiveCheck = now.toISOString();

  if (platformResult.configured) {
    if (platformResult.live && !prevLive) next.liveStartedAt = now.toISOString();
    if (!platformResult.live && prevLive) {
      await autoArchive({ ...stream, status: 'live' }, { ...next, status: 'offline' });
      delete next.liveStartedAt;
    }
    next.status = platformResult.live ? 'live' : 'offline';
  } else if (next.status === 'live') {
    next.liveStartedAt = next.liveStartedAt || now.toISOString();
  }

  const state = deriveLiveState(next, { hasArchive: opts.hasArchive });
  next.liveState = state.liveState;
  return { stream: next, platformResult, state };
}
