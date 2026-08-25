import { getList, setList, getDate, setDate, KEYS } from '../lib/storage.js';
import { sendJson, sendEmpty, readBody, isAdmin, clean, getParam } from '../lib/http.js';
import { buildNewsletter, getUpcomingEvents, getUpcomingStreams, buildWelcomeEmail, buildUnsubscribeUrl, signedCopyAvailable } from '../lib/newsletter.js';
import { sendEmail } from '../lib/email.js';
import { addAudit } from '../lib/audit.js';
import { randomBytes } from 'crypto';
import { parseBrowser } from '../lib/ua.js';
import { facebookDetectionConfigured } from '../lib/stream.js';
import { computeVisitorStats } from '../lib/visitor-stats.js';

export default function handler(req, res) {
  if (req.method === 'OPTIONS') return sendEmpty(res);
  if (!isAdmin(req)) {
    return sendJson(res, { error: 'Admin access required.' }, 403);
  }

  const action = getParam(req, 'action') || 'stats';
  const fail = () => sendJson(res, { error: 'Storage error.' }, 500);

  if (action === 'stats') {
    Promise.all([getList(KEYS.visitors), getList(KEYS.subscribers)]).then(([visitors, subscribers]) => {
      sendJson(res, {
        ...computeVisitorStats(visitors),
        subscribers: subscribers.length,
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

  if (action === 'blast-newsletter' && req.method === 'POST') {
    const MAX_BLAST = 100;
    readBody(req).then(async (payload) => {
      const msg = String(payload.message || '').trim();
      const subscribers = await getList(KEYS.subscribers);
      const active = subscribers.filter((s) => (s.status ?? 'active') === 'active');
      if (!active.length) {
        return sendJson(res, { ok: true, sent: 0, failed: 0, total: 0, message: 'No active subscribers.' });
      }

      const events = await getList(KEYS.events);
      const upcoming = getUpcomingEvents(events);
      const streamArr = await getList(KEYS.stream);
      const streamSchedule = (streamArr && streamArr[0] && streamArr[0].schedule) || [];
      const streamList = getUpcomingStreams(streamSchedule);
      const userMessage = msg || process.env.NEWSLETTER_MESSAGE || '';
      const { dateRange } = buildNewsletter(userMessage, upcoming, streamList);
      const subject = `Lost Limb Riders — Events ${dateRange}`;

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      let sent = 0;
      let failed = 0;
      const failures = [];

      for (const sub of active) {
        if (sent + failed >= MAX_BLAST) break;
        const to = String(sub.email || '').trim().toLowerCase();
        if (!emailRegex.test(to)) {
          failed++;
          failures.push({ email: to, reason: 'invalid_email' });
          continue;
        }
        const name = String(sub.name || 'Rider').replace(/[<>]/g, '').trim() || 'Rider';
        const { html } = buildNewsletter(userMessage, upcoming, streamList, name, buildUnsubscribeUrl(sub.unsubToken || ''));
        const result = await sendEmail(to, subject, html);
        if (result.ok) {
          sent++;
        } else {
          failed++;
          failures.push({ email: to, reason: result.message || result.reason || `status_${result.status}` });
        }
      }

      if (sent > 0) {
        await setDate(KEYS.lastNewsletterSent, new Date().toISOString());
      }

      await addAudit('newsletter_blast', 'admin', { sent, failed, total: active.length });

      return sendJson(res, {
        ok: true,
        sent,
        failed,
        total: active.length,
        capped: active.length > MAX_BLAST,
        dateRange,
        failures: failures.slice(0, 10),
      });
    }).catch(fail);
    return;
  }

  if (action === 'stream') {
    getList(KEYS.stream).then((arr) => {
      const raw = arr.length ? arr[0] : {};
      sendJson(res, {
        stream: {
          pageUrl: raw.pageUrl || '',
          title: raw.title || 'Lost Limb Riders Live',
          description: raw.description || '',
          schedule: Array.isArray(raw.schedule) ? raw.schedule : [],
        },
        detection: facebookDetectionConfigured() ? 'ok' : 'unconfigured',
      });
    }).catch(fail);
    return;
  }

  if (action === 'update-stream' && req.method === 'POST') {
    readBody(req).then(async (payload) => {
      const arr = await getList(KEYS.stream);
      const stream = arr.length ? arr[0] : {};
      const FIELDS = [['pageUrl', 300], ['title', 200], ['description', 2000]];
      for (const [field, limit] of FIELDS) {
        if (payload[field] !== undefined) {
          stream[field] = clean(String(payload[field] ?? ''), limit);
        }
      }
      stream.updatedAt = new Date().toISOString();
      await setList(KEYS.stream, [stream]);
      sendJson(res, { ok: true });
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

      const { html, subject } = await buildWelcomeEmail(sub);
      const result = await sendEmail(email, subject, html);
      if (result.ok) {
        sub.welcomeStatus = 'sent';
        sub.welcomeSentAt = new Date().toISOString();
        sub.ebookLinkIssued = true;
        sub.ebookTokenIssuedAt = new Date().toISOString();
      } else {
        sub.welcomeStatus = 'failed';
        sub.welcomeError = String(result.message || result.reason || `status_${result.status}`);
      }
      entries[index] = sub;
      await setList(KEYS.subscribers, entries);

      await addAudit('welcome_resend', email, { welcomeStatus: sub.welcomeStatus, welcomeError: sub.welcomeError });

      return sendJson(res, { ok: true, email, welcomeStatus: sub.welcomeStatus, welcomeError: sub.welcomeError || null });
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
