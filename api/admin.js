import { getList, setList, getDate, setDate, KEYS, LIMITS } from '../lib/storage.js';
import { sendJson, sendEmpty, readBody, isAdmin, clean, getParam } from '../lib/http.js';
import { buildNewsletter, getUpcomingEvents, getUpcomingStreams, buildWelcomeEmail, buildUnsubscribeUrl, signedCopyAvailable } from '../lib/newsletter.js';
import { sendEmail } from '../lib/email.js';
import { addAudit } from '../lib/audit.js';
import { randomBytes } from 'crypto';
import { parseBrowser } from '../lib/ua.js';
import { facebookDetectionConfigured } from '../lib/stream.js';
import { computeVisitorStats } from '../lib/visitor-stats.js';
import { aiConfigured, generateJson } from '../lib/ai.js';
import { notifyOwner } from '../lib/notify.js';
import { normalizeIdeaPayload, validateIdea } from '../lib/event-model.js';
import { normalizeStoryMeta, wordCount, buildHistorySummary, similarityFlags } from '../lib/story-model.js';
import { buildStoryPrompt, buildIdeasPrompt, parseStoryResponse, parseIdeasResponse, pickSurpriseParams } from '../lib/generation.js';

export const maxDuration = 60;

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
    Promise.all([readBody(req), getList(KEYS.events), getList(KEYS.stream), getList(KEYS.stories)]).then(async ([payload, events, streamArr, stories]) => {
      const upcoming = getUpcomingEvents(events);
      const streamSchedule = (streamArr && streamArr[0] && streamArr[0].schedule) || [];
      const storyForNewsletter = stories.find(s => s.status === 'approved') || null;
      const { html, eventCount, streamCount } = buildNewsletter(
        String(payload.message || '').trim(),
        upcoming,
        getUpcomingStreams(streamSchedule),
        'Rider',
        '',
        storyForNewsletter
      );
      sendJson(res, { html, eventCount, streamCount, storyIncluded: Boolean(storyForNewsletter) });
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
      const allStories = await getList(KEYS.stories);
      const storyIdx = allStories.findIndex(s => s.status === 'approved');
      const storyForNewsletter = storyIdx !== -1 ? allStories[storyIdx] : null;
      const storyId = storyForNewsletter?.id || null;
      const { dateRange } = buildNewsletter(userMessage, upcoming, streamList, 'Rider', '', storyForNewsletter);
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
        const { html } = buildNewsletter(userMessage, upcoming, streamList, name, buildUnsubscribeUrl(sub.unsubToken || ''), storyForNewsletter);
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

      if (storyId && sent > 0) {
        const si = allStories.findIndex(s => s.id === storyId);
        if (si !== -1) {
          allStories[si].status = 'used';
          allStories[si].newsletterIssue = subject;
          allStories[si].usedAt = new Date().toISOString();
          await setList(KEYS.stories, allStories);
        }
      }

      await addAudit('newsletter_blast', 'admin', { sent, failed, total: active.length, storyIncluded: Boolean(storyForNewsletter) });

      return sendJson(res, {
        ok: true,
        sent,
        failed,
        total: active.length,
        capped: active.length > MAX_BLAST,
        storyIncluded: Boolean(storyForNewsletter),
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

  if (action === 'subscriber-unsubscribe' && req.method === 'POST') {
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
      if ((sub.status ?? 'active') === 'unsubscribed') {
        return sendJson(res, { ok: true, email, alreadyUnsubscribed: true });
      }
      sub.status = 'unsubscribed';
      sub.unsubscribedAt = new Date().toISOString();
      entries[index] = sub;
      await setList(KEYS.subscribers, entries);
      await addAudit('subscriber_unsubscribed', email, {});
      return sendJson(res, { ok: true, email });
    }).catch(fail);
    return;
  }

  if (action === 'subscriber-delete' && req.method === 'POST') {
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
      const [removed] = entries.splice(index, 1);
      await setList(KEYS.subscribers, entries);
      await addAudit('subscriber_deleted', email, { name: removed.name || '' });
      return sendJson(res, { ok: true, email });
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

  if (action === 'content-settings') {
    handleContentSettings(req, res).catch(fail);
    return;
  }

  if (action === 'content-stories') {
    handleContentStories(req, res).catch(fail);
    return;
  }

  if (action === 'content-generate-story' && req.method === 'POST') {
    handleContentGenerateStory(req, res).catch(fail);
    return;
  }

  if (action === 'content-generate-ideas' && req.method === 'POST') {
    handleContentGenerateIdeas(req, res).catch(fail);
    return;
  }

  if (action === 'content-update-story' && req.method === 'POST') {
    handleContentUpdateStory(req, res).catch(fail);
    return;
  }

  sendJson(res, { error: 'Unsupported action.' }, 404);
}

async function handleContentSettings(req, res) {
  if (req.method === 'POST') {
    const payload = await readBody(req);
    const current = await getList(KEYS.contentSettings);
    const settings = (Array.isArray(current) ? current[0] : current) || defaultContentSettings();
    const allowedFields = [
      'autoStories', 'autoIdeas', 'storyFrequencyDays', 'ideaFrequencyDays',
      'notificationsEnabled', 'notifyEvents', 'notifyStories', 'notifySystem',
    ];
    for (const field of allowedFields) {
      if (payload[field] !== undefined) settings[field] = payload[field];
    }
    settings.requireApproval = true;
    settings.updatedAt = new Date().toISOString();
    await setList(KEYS.contentSettings, [settings]);
    return sendJson(res, { settings });
  }

  const current = await getList(KEYS.contentSettings);
  const settings = (Array.isArray(current) ? current[0] : current) || defaultContentSettings();
  settings.discordConfigured = Boolean(process.env.DISCORD_OWNER_WEBHOOK_URL);
  settings.aiConfigured = aiConfigured();
  sendJson(res, { settings });
}

async function handleContentStories(req, res) {
  const stories = await getList(KEYS.stories);
  const statusFilter = getParam(req, 'status');
  const filtered = statusFilter ? stories.filter(s => s.status === statusFilter) : stories;
  sendJson(res, { stories: filtered, total: stories.length });
}

async function handleContentGenerateStory(req, res) {
  if (!aiConfigured()) return sendJson(res, { error: 'AI not configured. Set GEMINI_API_KEY.' }, 422);

  let params = {};
  try {
    params = await readBody(req);
  } catch {}

  if (params.surprise || !Object.keys(params).some(k => ['theme', 'tone', 'characterType', 'setting'].includes(k))) {
    params = { ...pickSurpriseParams(), ...params };
  }

  const stories = await getList(KEYS.stories);
  const historySummary = buildHistorySummary(stories);

  const prompt = buildStoryPrompt(params, historySummary);
  let result;
  try {
    result = await generateJson({ prompt, maxOutputTokens: 4096, temperature: 0.95 });
  } catch (err) {
    await addAudit('story_generation_failed', 'admin', { error: err.message });
    notifyOwner('generation-failed', { message: `Story generation: ${err.message}` }).catch(() => {});
    return sendJson(res, { error: `Generation failed: ${err.message}` }, 500);
  }

  const parsed = parseStoryResponse(result);
  if (!parsed) return sendJson(res, { error: 'Invalid story response from AI.' }, 500);

  const meta = normalizeStoryMeta({
    ...parsed,
    id: 'st-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10),
    text: parsed.text,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });

  const flags = similarityFlags(meta, stories);
  const hasOverlap = Object.values(flags).some(v => v > 2);
  if (hasOverlap) meta.similarityWarning = flags;

  stories.unshift(meta);
  await setList(KEYS.stories, stories.slice(0, LIMITS.stories));
  await addAudit('story_generated', 'admin', { storyId: meta.id, title: meta.title, wordCount: meta.wordCount });
  notifyOwner('story-generated', { title: meta.title, reason: `Word count: ${meta.wordCount}. Theme: ${meta.theme}` }).catch(() => {});
  return sendJson(res, { story: meta }, 201);
}

async function handleContentGenerateIdeas(req, res) {
  if (!aiConfigured()) return sendJson(res, { error: 'AI not configured. Set GEMINI_API_KEY.' }, 422);

  const existingEvents = await getList(KEYS.events);
  const prompt = buildIdeasPrompt(existingEvents);

  let result;
  try {
    result = await generateJson({ prompt, maxOutputTokens: 4096, temperature: 0.8 });
  } catch (err) {
    await addAudit('ideas_generation_failed', 'admin', { error: err.message });
    notifyOwner('generation-failed', { message: `Ideas generation: ${err.message}` }).catch(() => {});
    return sendJson(res, { error: `Generation failed: ${err.message}` }, 500);
  }

  const parsed = parseIdeasResponse(result);
  if (!parsed || !parsed.length) return sendJson(res, { error: 'No ideas generated.' }, 500);

  const ideas = await getList(KEYS.eventIdeas);
  const created = [];
  for (const raw of parsed) {
    const idea = normalizeIdeaPayload({
      ...raw,
      source: 'ai-generated',
      sourceUrl: raw.sourceUrl || '',
    });
    const err = validateIdea(idea);
    if (err) continue;
    idea.id = 'ei-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10) + '-' + Math.random().toString(36).slice(2, 6);
    idea.status = 'pending';
    idea.generatedAt = new Date().toISOString();
    ideas.unshift(idea);
    created.push(idea);
  }

  await setList(KEYS.eventIdeas, ideas.slice(0, LIMITS.eventIdeas));
  for (const idea of created) {
    await addAudit('idea_generated', 'system', { ideaId: idea.id, title: idea.title });
  }
  notifyOwner('event-generated', {
    title: `${created.length} event idea${created.length > 1 ? 's' : ''} generated`,
    reason: created.map(i => i.title).join(', '),
  }).catch(() => {});

  return sendJson(res, { ideas: created, total: created.length }, 201);
}

async function handleContentUpdateStory(req, res) {
  const payload = await readBody(req);
  const id = String(payload.id ?? '');
  if (!id) return sendJson(res, { error: 'Story ID required.' }, 422);

  const stories = await getList(KEYS.stories);
  const idx = stories.findIndex(s => s.id === id);
  if (idx === -1) return sendJson(res, { error: 'Story not found.' }, 404);

  const story = stories[idx];
  if (payload.title !== undefined) story.title = String(payload.title).slice(0, 200);
  if (payload.text !== undefined) {
    story.text = String(payload.text).slice(0, 20000);
    story.wordCount = wordCount(story.text);
  }
  if (payload.status !== undefined) {
    const valid = ['pending', 'approved', 'rejected', 'archived', 'used'];
    if (!valid.includes(payload.status)) return sendJson(res, { error: 'Invalid status.' }, 422);
    story.status = payload.status;
    if (payload.status === 'approved') {
      story.approvedAt = new Date().toISOString();
      notifyOwner('story-approved', { title: story.title }).catch(() => {});
    }
    if (payload.status === 'rejected') {
      story.rejectedAt = new Date().toISOString();
      notifyOwner('story-rejected', { title: story.title, reason: payload.reason || '' }).catch(() => {});
    }
  }
  if (payload.newsletterIssue !== undefined) story.newsletterIssue = String(payload.newsletterIssue || '').slice(0, 100);
  if (payload.character) story.character = { ...story.character, ...payload.character };
  if (payload.setting !== undefined) story.setting = String(payload.setting).slice(0, 200);
  if (payload.primaryConflict !== undefined) story.primaryConflict = String(payload.primaryConflict).slice(0, 500);
  if (payload.theme !== undefined) story.theme = String(payload.theme).slice(0, 100);
  story.updatedAt = new Date().toISOString();

  stories[idx] = story;
  await setList(KEYS.stories, stories);
  await addAudit('story_updated', 'admin', { storyId: id, title: story.title, status: story.status });
  return sendJson(res, { story });
}

function defaultContentSettings() {
  return {
    autoStories: true,
    autoIdeas: true,
    storyFrequencyDays: 7,
    ideaFrequencyDays: 14,
    notificationsEnabled: true,
    notifyEvents: true,
    notifyStories: true,
    notifySystem: true,
    requireApproval: true,
    lastStoryRun: null,
    lastIdeaRun: null,
  };
}
