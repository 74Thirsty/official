import { getList, getDate, setDate, KEYS } from '../lib/storage.js';
import { sendJson, sendEmpty } from '../lib/http.js';
import { buildNewsletter, getUpcomingEvents, getUpcomingStreams, buildUnsubscribeUrl } from '../lib/newsletter.js';
import { sendEmail } from '../lib/email.js';

const SEND_INTERVAL_MS = 13 * 86400000;
const MAX_SENDS_PER_RUN = 100;

function verifyCronSecret(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = String(req.headers['authorization'] || '');
  return auth === `Bearer ${secret}`;
}

export default function handler(req, res) {
  if (req.method === 'OPTIONS') return sendEmpty(res);
  if (!verifyCronSecret(req)) {
    return sendJson(res, { error: 'Unauthorized.' }, 401);
  }

  getList(KEYS.subscribers).then(async (subscribers) => {
    if (!subscribers.length) {
      return sendJson(res, { ok: true, sent: 0, failed: 0, skipped: 'no_subscribers' });
    }

    const lastSent = await getDate(KEYS.lastNewsletterSent);
    if (lastSent && Date.now() - new Date(lastSent).getTime() < SEND_INTERVAL_MS) {
      return sendJson(res, { ok: true, sent: 0, failed: 0, skipped: 'too_soon' });
    }

    const events = await getList(KEYS.events);
    const upcoming = getUpcomingEvents(events);
    const streamArr = await getList(KEYS.stream);
    const streamSchedule = (streamArr && streamArr[0] && streamArr[0].schedule) || [];
    const streamList = getUpcomingStreams(streamSchedule);
    const userMessage = process.env.NEWSLETTER_MESSAGE || '';

    let storyForNewsletter = null;
    let storyId = null;
    const stories = await getList(KEYS.stories);
    const storyIdx = stories.findIndex(s => s.status === 'approved');
    if (storyIdx !== -1) {
      storyForNewsletter = stories[storyIdx];
      storyId = stories[storyIdx].id;
    }

    const { dateRange } = buildNewsletter(userMessage, upcoming, streamList, 'Rider', '', storyForNewsletter);
    const subject = `Lost Limb Riders — Events ${dateRange}`;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let sent = 0;
    let failed = 0;
    const failures = [];
    const activeSubscribers = subscribers.filter((s) => (s.status ?? 'active') === 'active');

    for (const sub of activeSubscribers) {
      if (sent + failed >= MAX_SENDS_PER_RUN) break;
      const to = String(sub.email || '').trim().toLowerCase();
      if (!emailRegex.test(to)) {
        failed++;
        failures.push({ email: to, reason: 'invalid_email' });
        continue;
      }
      const name = String(sub.name || 'Rider').replace(/[<>]/g, '').trim() || 'Rider';
      const { html } = buildNewsletter(userMessage, upcoming, streamList, name, buildUnsubscribeUrl(sub.unsubToken || ''), storyForNewsletter);
      const result = await sendEmail(to, subject, html);
      if (result.ok) {
        sent++;
      } else {
        failed++;
        failures.push({ email: to, reason: result.reason || `status_${result.status}` });
      }
    }

    if (sent > 0) {
      await setDate(KEYS.lastNewsletterSent, new Date().toISOString());
    }

    if (storyId && sent > 0) {
      const allStories = await getList(KEYS.stories);
      const si = allStories.findIndex(s => s.id === storyId);
      if (si !== -1) {
        allStories[si].status = 'used';
        allStories[si].newsletterIssue = subject;
        allStories[si].usedAt = new Date().toISOString();
        await setList(KEYS.stories, allStories);
      }
    }

    return sendJson(res, {
      ok: true,
      sent,
      failed,
      skipped: activeSubscribers.length - sent - failed,
      failures: failures.slice(0, 5),
      storyIncluded: Boolean(storyForNewsletter),
    });
  }).catch(() => sendJson(res, { error: 'Storage error.' }, 500));
}
