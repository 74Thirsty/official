import { getList, setList, getDate, setDate, KEYS, LIMITS } from '../lib/storage.js';
import { sendJson, sendEmpty, readBody, isAdmin, getParam } from '../lib/http.js';
import { addAudit } from '../lib/audit.js';
import { aiConfigured, generateJson } from '../lib/ai.js';
import { notifyOwner } from '../lib/notify.js';
import { normalizeIdeaPayload, validateIdea } from '../lib/event-model.js';
import { normalizeStoryMeta, wordCount, buildHistorySummary, similarityFlags } from '../lib/story-model.js';
import { buildStoryPrompt, buildIdeasPrompt, parseStoryResponse, parseIdeasResponse, pickSurpriseParams } from '../lib/generation.js';

export const maxDuration = 60;

export default function handler(req, res) {
  if (req.method === 'OPTIONS') return sendEmpty(res);
  if (!isAdmin(req)) return sendJson(res, { error: 'Admin access required.' }, 403);

  const action = getParam(req, 'action') || 'settings';

  if (action === 'settings') {
    handleSettings(req, res);
    return;
  }

  if (action === 'stories') {
    handleStories(req, res);
    return;
  }

  if (action === 'generate-story' && req.method === 'POST') {
    handleGenerateStory(req, res);
    return;
  }

  if (action === 'generate-ideas' && req.method === 'POST') {
    handleGenerateIdeas(req, res);
    return;
  }

  if (action === 'update-story' && req.method === 'POST') {
    handleUpdateStory(req, res);
    return;
  }

  sendJson(res, { error: 'Unsupported action.' }, 404);
}

async function handleSettings(req, res) {
  if (req.method === 'POST') {
    const payload = await readBody(req);
    const current = await getList(KEYS.contentSettings);
    const settings = (Array.isArray(current) ? current[0] : current) || defaultSettings();
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
  const settings = (Array.isArray(current) ? current[0] : current) || defaultSettings();
  settings.discordConfigured = Boolean(process.env.DISCORD_OWNER_WEBHOOK_URL);
  settings.aiConfigured = aiConfigured();
  sendJson(res, { settings });
}

async function handleStories(req, res) {
  const stories = await getList(KEYS.stories);
  const statusFilter = getParam(req, 'status');
  const filtered = statusFilter ? stories.filter(s => s.status === statusFilter) : stories;
  sendJson(res, { stories: filtered, total: stories.length });
}

async function handleGenerateStory(req, res) {
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

async function handleGenerateIdeas(req, res) {
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

async function handleUpdateStory(req, res) {
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

function defaultSettings() {
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
