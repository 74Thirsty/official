import { getList, setList, KEYS } from '../lib/storage.js';
import { sendJson, sendEmpty, readBody, isAdmin, clean, getParam } from '../lib/http.js';
import { buildNewsletter, getUpcomingEvents, getUpcomingStreams, buildWelcomeEmail, signedCopyAvailable } from '../lib/newsletter.js';
import { sendEmail } from '../lib/email.js';
import { addAudit } from '../lib/audit.js';
import { randomBytes } from 'crypto';
import { seedStream } from '../lib/seed.js';
import { parseBrowser } from '../lib/ua.js';
import { autoArchive, normalizeKeep, adminArchive, purgeExpired, checkLiveStatus, hasArchive } from '../lib/stream.js';
import { sanitizeSchedule } from '../lib/episodes.js';

function getBrowserStats(visitors) {
  const stats = { Chrome: 0, Firefox: 0, Safari: 0, Edge: 0, Other: 0 };
  for (const v of visitors) {
    const browser = parseBrowser(v.userAgent);
    if (stats[browser] !== undefined) stats[browser]++;
    else stats.Other++;
  }
  return stats;
}

export default function handler(req, res) {
  if (req.method === 'OPTIONS') return sendEmpty(res);
  if (!isAdmin(req)) {
    return sendJson(res, { error: 'Admin access required.' }, 403);
  }

  const action = getParam(req, 'action') || 'stats';
  const fail = () => sendJson(res, { error: 'Storage error.' }, 500);

  if (action === 'stats') {
    Promise.all([getList(KEYS.visitors), getList(KEYS.subscribers)]).then(async ([visitors, subscribers]) => {
      const todayStr = new Date().toISOString().slice(0, 10);
      let today = 0;
      const countries = {};
      for (const v of visitors) {
        if ((v.timestamp || '').slice(0, 10) === todayStr) today++;
        const c = v.country;
        if (c && c !== 'N/A') countries[c] = (countries[c] || 0) + 1;
      }

      const topCountries = Object.entries(countries)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .reduce((acc, [k, n]) => {
          acc[k] = n;
          return acc;
        }, {});

      sendJson(res, {
        totalVisits: visitors.length,
        todayVisits: today,
        subscribers: subscribers.length,
        topCountries,
        browserStats: getBrowserStats(visitors),
        signedCopyReady: signedCopyAvailable(),
      });
    }).catch(fail);
    return;
  }

  if (action === 'visitors') {
    getList(KEYS.visitors).then((visitors) => {
      const page = Math.max(1, parseInt(getParam(req, 'page') || '1', 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(getParam(req, 'limit') || '25', 10) || 25));
      const total = visitors.length;
      const pages = Math.ceil(total / limit);
      const slice = visitors.slice((page - 1) * limit, page * limit);
      const withBrowser = slice.map((v) => ({ ...v, browser: parseBrowser(v.userAgent) }));
      sendJson(res, { visitors: withBrowser, total, page, pages });
    }).catch(fail);
    return;
  }

  if (action === 'subscribers') {
    getList(KEYS.subscribers).then((subscribers) => {
      sendJson(res, { subscribers, total: subscribers.length });
    }).catch(fail);
    return;
  }

  if (action === 'send-newsletter' && req.method === 'POST') {
    Promise.all([readBody(req), getList(KEYS.events), getList(KEYS.stream)]).then(async ([payload, events, streamArr]) => {
      const upcoming = getUpcomingEvents(events);
      const streamSchedule = (streamArr && streamArr[0] && streamArr[0].schedule) || [];
      const { html, eventCount, streamCount } = buildNewsletter(
        String(payload.message || '').trim(),
        upcoming,
        getUpcomingStreams(streamSchedule)
      );
      sendJson(res, { html, eventCount, streamCount });
    }).catch(fail);
    return;
  }

  if (action === 'stream') {
    getList(KEYS.stream).then((arr) => {
      const stream = arr.length ? arr[0] : seedStream;
      sendJson(res, { stream });
    }).catch(fail);
    return;
  }

  if (action === 'stream-check' && req.method === 'POST') {
    readBody(req).then(async () => {
      const arr = await getList(KEYS.stream);
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
    }).catch(fail);
    return;
  }

  if (action === 'archive') {
    adminArchive().then((data) => sendJson(res, data)).catch(fail);
    return;
  }

  if (action === 'purge-archive' && req.method === 'POST') {
    purgeExpired().then((data) => sendJson(res, data)).catch(fail);
    return;
  }

  if (action === 'update-stream' && req.method === 'POST') {
    readBody(req).then(async (payload) => {
      const arr = await getList(KEYS.stream);
      const oldStream = arr.length ? { ...arr[0] } : { ...seedStream };
      const stream = { ...oldStream };
      const FIELDS = [['platform', 20], ['streamId', 200], ['title', 200], ['description', 2000], ['status', 20]];
      for (const [field, limit] of FIELDS) {
        if (payload[field] !== undefined) {
          stream[field] = clean(String(payload[field] ?? ''), limit);
        }
      }
      if (payload.viewerCount !== undefined) stream.viewerCount = parseInt(payload.viewerCount, 10) || 0;
      if (payload.archiveKeep !== undefined) stream.archiveKeep = normalizeKeep(payload.archiveKeep);
      if (stream.platform && !['youtube', 'facebook', 'twitch', 'owncast'].includes(stream.platform)) {
        return sendJson(res, { error: 'Platform must be youtube, facebook, twitch, or owncast.' }, 422);
      }
      if (stream.status === 'live' && oldStream.status !== 'live') {
        stream.liveStartedAt = new Date().toISOString();
      }
      if (stream.status !== 'live') delete stream.liveStartedAt;
      if (payload.schedule !== undefined) {
        const cleaned = sanitizeSchedule(payload.schedule);
        if (cleaned) stream.schedule = cleaned;
      }
      stream.updatedAt = new Date().toISOString();
      await autoArchive(oldStream, stream);
      await setList(KEYS.stream, [stream]);
      sendJson(res, { stream });
    }).catch(fail);
    return;
  }

  if (action === 'resend-welcome' && req.method === 'POST') {
    readBody(req).then(async (payload) => {
      const email = String(payload.email ?? '').trim().toLowerCase();
      if (!email) {
        return sendJson(res, { error: 'Email is required.' }, 422);
      }
      const entries = await getList(KEYS.subscribers);
      const index = entries.findIndex((e) => e.email === email);
      if (index < 0) {
        return sendJson(res, { error: 'Subscriber not found.' }, 404);
      }
      const sub = entries[index];
      if ((sub.status ?? 'active') !== 'active') {
        return sendJson(res, { error: 'Unsubscribed subscribers do not receive welcome emails.' }, 422);
      }

      sub.ebookToken = randomBytes(24).toString('hex');
      sub.ebookTokenUsed = false;
      sub.ebookTokenIssuedAt = null;
      sub.ebookLinkIssued = false;
      sub.welcomeStatus = null;
      sub.welcomeError = null;
      sub.welcomeResendCount = (sub.welcomeResendCount || 0) + 1;

      const { html, subject } = buildWelcomeEmail(sub);
      const result = await sendEmail(email, subject, html);
      if (result.ok) {
        sub.welcomeStatus = 'sent';
        sub.welcomeSentAt = new Date().toISOString();
        sub.ebookLinkIssued = true;
        sub.ebookTokenIssuedAt = new Date().toISOString();
      } else {
        sub.welcomeStatus = 'failed';
        sub.welcomeError = String(result.reason || `status_${result.status}`);
      }
      entries[index] = sub;
      await setList(KEYS.subscribers, entries);

      await addAudit('welcome_resend', email, { welcomeStatus: sub.welcomeStatus });

      return sendJson(res, { ok: true, email, welcomeStatus: sub.welcomeStatus });
    }).catch(fail);
    return;
  }

  if (action === 'audit') {
    getList(KEYS.audit).then((audit) => {
      const limit = Math.min(200, Math.max(1, parseInt(getParam(req, 'limit') || '100', 10) || 100));
      sendJson(res, { audit: audit.slice(0, limit), total: audit.length });
    }).catch(fail);
    return;
  }

  sendJson(res, { error: 'Unsupported action.' }, 404);
}
