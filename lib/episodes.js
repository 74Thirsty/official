/**
 * @file        episodes.js
 * @description Scheduled broadcast validation and calendar event syncing
 * @project     Lost Limb Riders (lostlimbriders.org)
 * @author      C. Hirschauer
 * @copyright   Copyright (c) 2026 C. Hirschauer. All rights reserved.
 * @license     Proprietary. No unauthorized reproduction or distribution.
 */
import { clean } from './http.js';

export const STARTING_SOON_MS = 30 * 60000;
export const DEFAULT_WINDOW_MS = 4 * 3600000;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{1,2}:\d{2}$/;

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function validateEpisode(payload = {}, ctx = {}) {
  const errors = [];
  const recurring = payload.recurring !== 'false' && payload.recurring !== false;
  const date = clean(payload.date, 10);
  const time = clean(payload.time, 10);

  const title = clean(payload.title, 200);
  if (!title) errors.push('Title is required.');

  if (date && !DATE_RE.test(date)) errors.push('Date must use YYYY-MM-DD.');
  if (recurring && !clean(payload.day, 30)) errors.push('A day is required for recurring broadcasts.');
  if (!recurring && !date) errors.push('A date is required for one-time broadcasts.');
  if (time && !TIME_RE.test(time)) errors.push('Time must use HH:MM.');

  let durationMin = parseInt(payload.durationMin, 10);
  if (!Number.isFinite(durationMin) || durationMin < 1) durationMin = 0;
  if (durationMin > 600) durationMin = 600;

  const episode = {
    id: ctx.id || ('ls-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)),
    title,
    day: clean(payload.day, 30),
    time,
    date,
    recurring,
    description: clean(payload.description, 2000),
    durationMin,
    featuredTopic: clean(payload.featuredTopic, 200),
    host: clean(payload.host, 200),
    guest: clean(payload.guest, 200),
    thumbnail: clean(payload.thumbnail, 500),
    visibility: payload.visibility === 'private' ? 'private' : 'public',
    eventId: '',
  };

  if (!recurring && date) episode.eventId = 'ev-stream-' + episode.id.replace(/^ls-/, '');
  return { episode, errors };
}

export function getEpisodeStart(episode, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const [h = 0, m = 0] = String(episode.time || '00:00').split(':').map((n) => parseInt(n, 10));
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, m, 0, 0));
  if (!episode.recurring) {
    if (!episode.date) return null;
    if (episode.date > today) {
      const d = new Date(episode.date + 'T00:00:00Z');
      d.setUTCHours(h, m, 0, 0);
      return d;
    }
    if (episode.date === today) return todayStart;
    return null;
  }
  const targetDay = DAYS.indexOf(episode.day);
  if (targetDay === -1) return null;
  if (now.getUTCDay() === targetDay) return todayStart;
  const diff = (targetDay - now.getUTCDay() + 7) % 7;
  const next = new Date(todayStart.getTime());
  next.setUTCDate(next.getUTCDate() + diff);
  return next;
}

function windowMs(episode) {
  if (episode.durationMin && episode.durationMin > 0) return episode.durationMin * 60000;
  return DEFAULT_WINDOW_MS;
}

export function deriveEpisodeState(episode, now = new Date()) {
  const start = getEpisodeStart(episode, now);
  if (!start) return 'ended';
  const t = now.getTime();
  const s = start.getTime();
  const w = windowMs(episode);
  if (t >= s && t <= s + w) return 'starting-soon';
  if (t < s) return 'scheduled';
  return 'ended';
}

export function nextEpisode(schedule, now = new Date()) {
  if (!Array.isArray(schedule)) return null;
  const withStart = schedule
    .map((ep) => ({ ep, start: getEpisodeStart(ep, now) }))
    .filter((x) => x.start && x.start.getTime() >= now.getTime() - STARTING_SOON_MS)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  return withStart.length ? withStart[0].ep : null;
}

export function publicEpisode(episode, now = new Date()) {
  const out = { ...episode };
  delete out.eventId;
  out.state = deriveEpisodeState(out, now);
  return out;
}

export function publicSchedule(schedule, now = new Date()) {
  if (!Array.isArray(schedule)) return [];
  return schedule
    .filter((ep) => ep.visibility !== 'private')
    .map((ep) => publicEpisode(ep, now));
}

// liveState is driven by the Facebook Live check alone.
export function computeLiveState(stream, opts = {}) {
  const schedule = Array.isArray(stream.schedule) ? stream.schedule : [];
  const isLive = opts.live === true;
  const now = opts.now || new Date();
  const next = nextEpisode(schedule, now);

  let liveState = 'offline';
  if (isLive) {
    liveState = 'live';
  } else {
    const nextState = next ? deriveEpisodeState(next, now) : 'ended';
    if (nextState === 'starting-soon') liveState = 'starting-soon';
    else if (nextState === 'scheduled') liveState = 'scheduled';
  }

  return {
    liveState,
    currentEpisode: null,
    nextEpisode: next ? publicEpisode(next, now) : null,
    episodes: publicSchedule(schedule, now),
  };
}

export function syncEpisodeEvent(events, episode) {
  const list = Array.isArray(events) ? events.slice() : [];
  if (episode.recurring || !episode.eventId || !episode.date) return list;
  const idx = list.findIndex((e) => e.streamEpisodeId === episode.id);
  const location = 'Live on Facebook · facebook.com';
  const description = String(episode.description || '') + ' (Watch live at lostlimbriders.org or on Facebook.)';
  if (idx >= 0) {
    list[idx] = {
      ...list[idx],
      title: episode.title,
      date: episode.date,
      endDate: '',
      time: String(episode.time || '').slice(0, 5),
      category: 'livestream',
      location,
      description,
      updatedAt: new Date().toISOString(),
    };
    return list;
  }
  list.unshift({
    id: episode.eventId,
    title: episode.title,
    date: episode.date,
    endDate: '',
    time: String(episode.time || '').slice(0, 5),
    category: 'livestream',
    location,
    description,
    streamEpisodeId: episode.id,
    createdAt: new Date().toISOString(),
  });
  return list;
}

export function removeLinkedEvent(events, episodeId) {
  const list = Array.isArray(events) ? events.slice() : [];
  return list.filter((e) => !(e.streamEpisodeId === episodeId));
}

export function sanitizeSchedule(list) {
  if (!Array.isArray(list)) return null;
  return list.map((item) => validateEpisode(item, { id: item.id }).episode);
}
