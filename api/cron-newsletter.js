import { getList, setList, getDate, setDate, KEYS, LIMITS } from '../lib/storage.js';
import { sendJson, sendEmpty, getParam } from '../lib/http.js';
import { buildNewsletter, getUpcomingEvents, getUpcomingStreams, buildUnsubscribeUrl } from '../lib/newsletter.js';
import { sendEmail } from '../lib/email.js';
import { addAudit } from '../lib/audit.js';
import { aiConfigured, generateJson } from '../lib/ai.js';
import { notifyOwner } from '../lib/notify.js';
import { normalizeIdeaPayload, validateIdea } from '../lib/event-model.js';
import { normalizeStoryMeta, wordCount, buildHistorySummary } from '../lib/story-model.js';
import { buildStoryPrompt, buildIdeasPrompt, parseStoryResponse, parseIdeasResponse, pickSurpriseParams } from '../lib/generation.js';

export const maxDuration = 60;

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

  const target = getParam(req, 'target') || 'newsletter';

  if (target === 'content') {
    if (!aiConfigured()) return sendJson(res, { ok: true, skipped: 'no_ai_key' });
    handleContentCron().then(result => sendJson(res, result)).catch(() => sendJson(res, { error: 'Storage error.' }, 500));
    return;
  }

  handleNewsletterCron(req, res);
}
function handleNewsletterCron(req, res) {
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

async function handleContentCron() {
  const current = await getList(KEYS.contentSettings);
  const settings = (Array.isArray(current) ? current[0] : null) || {};
  const now = Date.now();
  const results = { stories: null, ideas: null };

  if (settings.autoStories !== false) {
    const lastStory = settings.lastStoryRun ? new Date(settings.lastStoryRun).getTime() : 0;
    const storyInterval = (settings.storyFrequencyDays || 7) * 86400000;
    if (now - lastStory >= storyInterval) {
      try {
        results.stories = await generateStory();
        settings.lastStoryRun = new Date().toISOString();
      } catch (err) {
        results.stories = { error: err.message };
        await addAudit('cron_story_failed', 'system', { error: err.message });
        notifyOwner('generation-failed', { message: `Cron story: ${err.message}` }).catch(() => {});
      }
    } else {
      results.stories = { skipped: 'too_soon' };
    }
  }

  if (settings.autoIdeas !== false) {
    const lastIdea = settings.lastIdeaRun ? new Date(settings.lastIdeaRun).getTime() : 0;
    const ideaInterval = (settings.ideaFrequencyDays || 14) * 86400000;
    if (now - lastIdea >= ideaInterval) {
      try {
        results.ideas = await generateCronIdeas();
        settings.lastIdeaRun = new Date().toISOString();
      } catch (err) {
        results.ideas = { error: err.message };
        await addAudit('cron_ideas_failed', 'system', { error: err.message });
        notifyOwner('generation-failed', { message: `Cron ideas: ${err.message}` }).catch(() => {});
      }
    } else {
      results.ideas = { skipped: 'too_soon' };
    }
  }

  settings.updatedAt = new Date().toISOString();
  await setList(KEYS.contentSettings, [settings]);
  return { ok: true, ...results };
}

async function generateStory() {
  const params = pickSurpriseParams();
  const stories = await getList(KEYS.stories);
  const prompt = buildStoryPrompt(params, buildHistorySummary(stories));
  const result = await generateJson({ prompt, maxOutputTokens: 4096, temperature: 0.95 });
  const parsed = parseStoryResponse(result);
  if (!parsed) throw new Error('Invalid story response');

  const meta = normalizeStoryMeta({
    ...parsed,
    id: 'st-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10),
    text: parsed.text,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });

  stories.unshift(meta);
  await setList(KEYS.stories, stories.slice(0, LIMITS.stories));
  await addAudit('cron_story_generated', 'system', { storyId: meta.id, title: meta.title });
  notifyOwner('story-generated', { title: meta.title, reason: `Cron-generated. Theme: ${meta.theme}` }).catch(() => {});
  return { generated: meta.id, title: meta.title };
}

async function generateCronIdeas() {
  const events = await getList(KEYS.events);
  const prompt = buildIdeasPrompt(events);
  const result = await generateJson({ prompt, maxOutputTokens: 4096, temperature: 0.8 });
  const parsed = parseIdeasResponse(result);
  if (!parsed || !parsed.length) throw new Error('No ideas returned');

  const ideas = await getList(KEYS.eventIdeas);
  let count = 0;
  for (const raw of parsed) {
    const idea = normalizeIdeaPayload({ ...raw, source: 'ai-generated', sourceUrl: raw.sourceUrl || '' });
    if (!validateIdea(idea)) {
      idea.id = 'ei-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10) + '-' + Math.random().toString(36).slice(2, 6);
      idea.status = 'pending';
      idea.generatedAt = new Date().toISOString();
      ideas.unshift(idea);
      count++;
    }
  }
  await setList(KEYS.eventIdeas, ideas.slice(0, LIMITS.eventIdeas));
  await addAudit('cron_ideas_generated', 'system', { count });
  notifyOwner('event-generated', { title: `${count} event idea${count > 1 ? 's' : ''} generated (cron)` }).catch(() => {});
  return { generated: count };
}
