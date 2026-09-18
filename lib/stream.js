/**
 * @file        stream.js
 * @description Live stream management — auto-archive, archive rotation, purge, public/admin views
 * @project     Lost Limb Riders (lostlimbriders.org)
 * @author      C. Hirschauer
 * @copyright   Copyright (c) 2026 C. Hirschauer. All rights reserved.
 * @license     Proprietary. No unauthorized reproduction or distribution.
 */
// Facebook and YouTube Live status: detection, normalization, and short-lived cache.
//
// The website detects current broadcasts and embeds the appropriate public
// Facebook or YouTube player. No stream keys, RTMP, OBS, or relays are used.
//
// Detection credentials remain server-side. Without them the site gracefully
// shows its offline state and approved channel links.

import { getDate, setDate, KEYS } from './storage.js';

const GRAPH_VERSION = 'v21.0';
const CACHE_TTL_MS = 60 * 1000;
const YOUTUBE_CHANNELS = [
  { id: 'UCbwHcDHNGlwWj7HnWuL2zxw', label: 'Lost Limb Riders on YouTube', url: 'https://www.youtube.com/@lostlimbriders' },
];

export function facebookDetectionConfigured() {
  return Boolean(process.env.FACEBOOK_PAGE_ID && process.env.FACEBOOK_ACCESS_TOKEN);
}

export function youtubeDetectionConfigured() {
  return Boolean(process.env.YOUTUBE_API_KEY);
}

export function youtubePublicChannels() {
  return YOUTUBE_CHANNELS.map(({ label, url }) => ({ label, url }));
}

export function parseYouTubeLiveResponse(data, channel) {
  const item = Array.isArray(data && data.items) ? data.items[0] : null;
  const videoId = String(item && item.id && item.id.videoId || '');
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return { live: false, videoUrl: '', title: '', viewers: 0 };
  return {
    live: true,
    videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
    title: String(item && item.snippet && item.snippet.title || ''),
    viewers: 0,
    pageUrl: channel.url,
    channelLabel: channel.label,
  };
}

async function fetchYouTubeLive(opts = {}) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const fetchImpl = opts.fetch || globalThis.fetch;
  if (!apiKey) return { configured: false, reason: 'not_configured', platform: 'youtube', ...emptyStatus() };
  try {
    const results = await Promise.all(YOUTUBE_CHANNELS.map(async (channel) => {
      const params = new URLSearchParams({
        part: 'snippet', channelId: channel.id, eventType: 'live', type: 'video', maxResults: '1', key: apiKey,
      });
      const response = await fetchImpl(`https://www.googleapis.com/youtube/v3/search?${params}`, { headers: { Accept: 'application/json' } });
      if (!response.ok) return null;
      return parseYouTubeLiveResponse(await response.json(), channel);
    }));
    const live = results.find((result) => result && result.live);
    return {
      configured: true,
      reason: live ? 'live' : 'offline',
      platform: 'youtube',
      ...(live || emptyStatus()),
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    return { configured: true, reason: 'error:' + String(error && error.message || error), platform: 'youtube', ...emptyStatus() };
  }
}

export function normalizePageUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  let url;
  try {
    url = new URL(raw.startsWith('http') ? raw : 'https://' + raw);
  } catch {
    return '';
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
  const host = url.hostname.toLowerCase();
  if (!/(^|\.)facebook\.com$/.test(host)) return '';
  return 'https://www.facebook.com' + url.pathname.replace(/\/+$/, '') + (url.search || '');
}

export function absoluteFacebookUrl(permalink, pageId) {
  const p = String(permalink || '').trim();
  if (!p) return '';
  if (/^https:\/\//i.test(p)) {
    return normalizePageUrl(p);
  }
  const path = p.startsWith('/') ? p : '/' + p;
  const base = pageId ? 'https://www.facebook.com/' + String(pageId) : 'https://www.facebook.com';
  try {
    return normalizePageUrl(new URL(path, base).href);
  } catch {
    return '';
  }
}

// Parses a /{page}/live_videos Graph API response. Pure function.
export function parseLiveVideosResponse(data) {
  const items = Array.isArray(data && data.data) ? data.data : [];
  const live = items.find((v) => v && v.status === 'LIVE') || null;
  const ended = items
    .filter((v) => v && v.status === 'LIVE_ENDED')
    .sort((a, b) => String(b.created_time || '').localeCompare(String(a.created_time || '')))[0] || null;
  return {
    live: Boolean(live),
    videoUrl: live ? String(live.permalink_url || '') : '',
    title: live ? String(live.title || '') : '',
    viewers: live ? parseInt(live.live_views, 10) || 0 : 0,
    lastReplayUrl: ended ? String(ended.permalink_url || '') : '',
  };
}

async function fetchFacebookLive(opts = {}) {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const token = process.env.FACEBOOK_ACCESS_TOKEN;
  const fetchImpl = opts.fetch || globalThis.fetch;
  if (!pageId || !token) {
    return { configured: false, reason: 'not_configured', ...emptyStatus() };
  }
  const url =
    'https://graph.facebook.com/' + GRAPH_VERSION + '/' +
    encodeURIComponent(pageId) +
    '/live_videos?fields=status,title,permalink_url,live_views,created_time&limit=25&access_token=' +
    encodeURIComponent(token);
  try {
    const res = await fetchImpl(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return { configured: true, reason: 'http_' + res.status, ...emptyStatus() };
    const parsed = parseLiveVideosResponse(await res.json());
    return {
      configured: true,
      reason: parsed.live ? 'live' : 'offline',
      ...parsed,
      checkedAt: new Date().toISOString(),
    };
  } catch (err) {
    return { configured: true, reason: 'error:' + String(err && err.message || err), ...emptyStatus() };
  }
}

async function fetchLiveStatus(opts = {}) {
  const [youtube, facebook] = await Promise.all([fetchYouTubeLive(opts), fetchFacebookLive(opts)]);
  const live = youtube.live ? youtube : facebook.live ? { ...facebook, platform: 'facebook' } : null;
  return {
    ...(live || emptyStatus()),
    platform: live ? live.platform : 'facebook',
    configured: youtube.configured || facebook.configured,
    reason: live ? 'live' : (youtube.configured || facebook.configured ? 'offline' : 'not_configured'),
    checkedAt: live && live.checkedAt || youtube.checkedAt || facebook.checkedAt || new Date().toISOString(),
  };
}

function emptyStatus() {
  return { live: false, videoUrl: '', title: '', viewers: 0, lastReplayUrl: '' };
}

export async function getCachedLiveStatus(opts = {}) {
  const now = Date.now();
  const cachedRaw = await getDate(KEYS.fbLiveCache);
  if (cachedRaw) {
    try {
      const cached = JSON.parse(cachedRaw);
      if (cached && cached.checkedAt && now - new Date(cached.checkedAt).getTime() < CACHE_TTL_MS) {
        return cached;
      }
    } catch {}
  }
  const fresh = await fetchLiveStatus(opts);
  await setDate(KEYS.fbLiveCache, JSON.stringify(fresh));
  return fresh;
}

export async function forceRefreshLiveStatus(opts = {}) {
  const fresh = await fetchLiveStatus(opts);
  await setDate(KEYS.fbLiveCache, JSON.stringify(fresh));
  return fresh;
}

export async function getPageUrl(stream) {
  const fromConfig = normalizePageUrl(stream && stream.pageUrl);
  if (fromConfig) return fromConfig;
  const envUrl = normalizePageUrl(process.env.FACEBOOK_PAGE_URL);
  if (envUrl) return envUrl;
  const pageId = String(process.env.FACEBOOK_PAGE_ID || '').trim();
  return pageId ? 'https://www.facebook.com/' + encodeURIComponent(pageId) : '';
}

export async function getPublicStreamState(stream, opts = {}) {
  const [status, pageUrl] = await Promise.all([
    opts.force ? forceRefreshLiveStatus(opts) : getCachedLiveStatus(opts),
    getPageUrl(stream),
  ]);
  return {
    platform: status.platform || 'facebook',
    pageUrl: status.pageUrl || pageUrl,
    youtubeChannels: youtubePublicChannels(),
    title: status.live && status.title ? status.title : String(stream.title || 'Lost Limb Riders Live'),
    description: String(stream.description || ''),
    live: status.configured ? status.live === true : false,
    liveUrl: status.videoUrl ? (status.platform === 'youtube' ? status.videoUrl : absoluteFacebookUrl(status.videoUrl, process.env.FACEBOOK_PAGE_ID)) : '',
    replayUrl: status.platform === 'facebook' && status.lastReplayUrl ? absoluteFacebookUrl(status.lastReplayUrl, process.env.FACEBOOK_PAGE_ID) : '',
    viewers: status.viewers || 0,
    detection: status.configured ? 'ok' : 'unconfigured',
    lastCheckedAt: status.checkedAt || null,
    schedule: Array.isArray(stream.schedule) ? stream.schedule : [],
  };
}
