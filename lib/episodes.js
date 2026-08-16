import { clean } from './http.js';

export const MODES = {
  realtime: 'Real-Time Live',
  prerecorded: 'Prerecorded Broadcast',
};

export const DESTINATIONS = {
  youtube: 'YouTube Live',
  facebook: 'Facebook Live',
  twitch: 'Twitch',
  owncast: 'Owncast',
};

export const STARTING_SOON_MS = 30 * 60000;
export const DEFAULT_WINDOW_MS = 4 * 3600000;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{1,2}:\d{2}$/;
const MEDIA_EXT_RE = /\.(mp4|mkv|mov|webm|m4v|mp3|m4a|wav|flac|aac|ogg|opus)$/i;

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function isValidMediaFilename(value) {
  const name = String(value || '').trim();
  if (!name || name.length > 200) return false;
  if (name.includes('/') || name.includes('\\') || name.includes('..')) return false;
  if (!MEDIA_EXT_RE.test(name)) return false;
  return true;
}

export function validateEpisode(payload = {}, ctx = {}) {
  const errors = [];
  const recurring = payload.recurring !== 'false' && payload.recurring !== false;
  const mode = payload.mode === 'prerecorded' ? 'prerecorded' : payload.mode === 'realtime' ? 'realtime' : 'realtime';
  const date = clean(payload.date, 10);
  const time = clean(payload.time, 10);

  const title = clean(payload.title, 200);
  if (!title) errors.push('Title is required.');

  if (date && !DATE_RE.test(date)) errors.push('Date must use YYYY-MM-DD.');
  if (recurring && !clean(payload.day, 30)) errors.push('A day is required for recurring broadcasts.');
  if (!recurring && !date) errors.push('A date is required for one-time broadcasts.');
  if (time && !TIME_RE.test(time)) errors.push('Time must use HH:MM.');

  const mediaFile = clean(payload.mediaFile, 200);
  const mediaVerified = payload.mediaVerified === true || payload.mediaVerified === 'true' || payload.mediaVerified === '1';
  if (mode === 'prerecorded') {
    if (!isValidMediaFilename(mediaFile)) {
      errors.push('A safe media file name is required for prerecorded broadcasts (e.g. LLR-Episode-042.mp4).');
    }
    if (!mediaVerified) {
      errors.push('Prerecorded broadcasts require confirming the media file is available and playable in OBS.');
    }
  }

  const destination = clean(payload.destination || (ctx.stream && ctx.stream.platform) || 'facebook', 20);
  if (destination && !DESTINATIONS[destination]) {
    errors.push('Destination must be one of: ' + Object.keys(DESTINATIONS).join(', ') + '.');
  }

  const visibility = payload.visibility === 'private' ? 'private' : 'public';

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
    mode,
    mediaFile: mode === 'prerecorded' ? mediaFile : '',
    mediaVerified: mode === 'prerecorded' ? mediaVerified : false,
    durationMin,
    featuredTopic: clean(payload.featuredTopic, 200),
    host: clean(payload.host, 200),
    guest: clean(payload.guest, 200),
    destination,
    thumbnail: clean(payload.thumbnail, 500),
    visibility,
    scene: clean(payload.scene, 60),
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

export function deriveEpisodeState(episode, now = new Date(), platformLive = false) {
  const start = getEpisodeStart(episode, now);
  if (!start) return 'ended';
  const t = now.getTime();
  const s = start.getTime();
  const w = windowMs(episode);
  if (platformLive && t >= s && t <= s + w) return 'live';
  if (t >= s - STARTING_SOON_MS && t <= s + w) return 'starting-soon';
  if (t < s) return 'scheduled';
  return 'ended';
}

export function findCurrentEpisode(schedule, now = new Date(), platformLive = false) {
  if (!Array.isArray(schedule)) return null;
  return schedule.find((ep) => deriveEpisodeState(ep, now, platformLive) === 'live') || null;
}

export function nextEpisode(schedule, now = new Date()) {
  if (!Array.isArray(schedule)) return null;
  const withStart = schedule
    .map((ep) => ({ ep, start: getEpisodeStart(ep, now) }))
    .filter((x) => x.start && x.start.getTime() >= now.getTime() - STARTING_SOON_MS)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  return withStart.length ? withStart[0].ep : null;
}

export function publicEpisode(episode, now = new Date(), platformLive = false) {
  const out = { ...episode };
  delete out.eventId;
  delete out.mediaVerified;
  out.state = deriveEpisodeState(out, now, platformLive);
  return out;
}

export function publicSchedule(schedule, now = new Date(), platformLive = false) {
  if (!Array.isArray(schedule)) return [];
  return schedule
    .filter((ep) => ep.visibility !== 'private')
    .map((ep) => publicEpisode(ep, now, platformLive));
}

export function computeLiveState(stream, now = new Date(), opts = {}) {
  const schedule = Array.isArray(stream.schedule) ? stream.schedule : [];
  const platformLive = opts.platformLive === true;
  const platformVerified = opts.platformVerified === true;
  const manualLive = opts.manualLive === true;
  const hasArchive = opts.hasArchive === true;

  const isLive = platformVerified ? platformLive : manualLive;
  const currentEpisode = findCurrentEpisode(schedule, now, isLive);
  const next = nextEpisode(schedule, now);

  let liveState = 'offline';
  if (isLive) {
    liveState = currentEpisode && currentEpisode.mode === 'prerecorded' ? 'live-prerecorded' : 'live-realtime';
  } else {
    const nextState = next ? deriveEpisodeState(next, now, false) : 'ended';
    if (nextState === 'starting-soon') liveState = 'starting-soon';
    else if (nextState === 'scheduled') liveState = 'scheduled';
    else if (hasArchive) liveState = 'replay';
  }

  return {
    liveState,
    platformLive: isLive,
    platformVerified,
    currentEpisode: currentEpisode ? publicEpisode(currentEpisode, now, isLive) : null,
    nextEpisode: next ? publicEpisode(next, now, false) : null,
    episodes: publicSchedule(schedule, now, isLive),
  };
}

export function syncEpisodeEvent(events, episode) {
  const list = Array.isArray(events) ? events.slice() : [];
  if (episode.recurring || !episode.eventId || !episode.date) return list;
  const idx = list.findIndex((e) => e.streamEpisodeId === episode.id);
  const location = 'Live broadcast · ' + (DESTINATIONS[episode.destination] || episode.destination || 'Online');
  const description =
    String(episode.description || '') +
    (episode.mode === 'prerecorded'
      ? ' (Prerecorded episode broadcast live via OBS at the scheduled time.)'
      : ' (Live broadcast via OBS at the scheduled time.)');
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
      streamMode: episode.mode,
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
    streamMode: episode.mode,
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
