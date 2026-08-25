import { getList, getDate, setDate, KEYS } from './storage.js';
import { addAudit } from './audit.js';

const DISCORD_MAX_LENGTH = 2000;

export function notifyConfigured() {
  return Boolean(process.env.DISCORD_OWNER_WEBHOOK_URL);
}

function truncate(str, len) {
  const s = String(str || '');
  return s.length > len ? s.slice(0, len - 1) + '…' : s;
}

export function buildDiscordPayload(kind, data) {
  const EMBED_TITLES = {
    'event-generated': '📋 Event Recommendation — Awaiting Approval',
    'event-approved': '✅ Event Approved & Published',
    'event-rejected': '❌ Event Rejected',
    'event-edited': '✏️ Event Idea Modified',
    'event-deleted': '🗑️ Event Idea Deleted',
    'story-generated': '📖 New Story — Awaiting Review',
    'story-approved': '✅ Story Approved',
    'story-rejected': '❌ Story Rejected',
    'story-used': '📰 Story Added to Newsletter Queue',
    'generation-failed': '⚠️ Content Generation Failed',
    'notify-failed': '⚠️ Notification Delivery Failed',
  };

  const TITLE = EMBED_TITLES[kind] || `🔔 ${kind}`;
  const color = kind.includes('failed') || kind.includes('rejected') ? 0xf59e0b
    : kind.includes('approved') || kind.includes('published') ? 0x22c55e
    : kind.includes('deleted') || kind.includes('rejected') ? 0xef4444
    : 0xff6a00;

  let description = '';
  if (data.title) description += `**${truncate(data.title, 100)}**\n`;
  if (data.date) description += `Date: ${data.date}\n`;
  if (data.location) description += `Location: ${truncate(data.location, 100)}\n`;
  if (data.reason) description += `${truncate(data.reason, 200)}\n`;
  if (data.message) description += `${truncate(data.message, 300)}\n`;

  const fields = [];
  if (data.type) fields.push({ name: 'Type', value: truncate(data.type, 100), inline: true });
  if (data.source) fields.push({ name: 'Source', value: truncate(data.source, 100), inline: true });
  if (data.score) fields.push({ name: 'Score', value: String(data.score).slice(0, 50), inline: true });

  return {
    username: 'Lost Limb Riders',
    content: '',
    embeds: [{
      title: TITLE,
      description: description || 'No details provided.',
      color,
      fields,
      footer: { text: 'Lost Limb Riders — Admin Notification' },
      timestamp: new Date().toISOString(),
    }],
  };
}

export async function sendDiscord(webhookUrl, payload) {
  if (!webhookUrl) return { ok: false, reason: 'not_configured' };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, content: (payload.content || '').slice(0, DISCORD_MAX_LENGTH) }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok && res.status !== 204) {
      return { ok: false, reason: `status_${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message || 'network_error' };
  }
}

export async function notifyOwner(kind, data = {}) {
  try {
    const settings = await getList(KEYS.contentSettings);
    const s = Array.isArray(settings) ? settings[0] : settings;
    if (!s || s.notificationsEnabled === false) return { ok: false, reason: 'disabled' };

    const webhookUrl = process.env.DISCORD_OWNER_WEBHOOK_URL || '';
    if (!webhookUrl) return { ok: false, reason: 'not_configured' };

    const category = data.category || '';
    if (kind.startsWith('event-') && s.notifyEvents === false) return { ok: false, reason: 'category_disabled' };
    if (kind.startsWith('story-') && s.notifyStories === false) return { ok: false, reason: 'category_disabled' };
    if (kind.includes('failed') && s.notifySystem === false) return { ok: false, reason: 'category_disabled' };

    const payload = buildDiscordPayload(kind, data);
    const result = await sendDiscord(webhookUrl, payload);
    if (!result.ok) {
      await addAudit('notify_failed', 'system', { kind, reason: result.reason });
    }
    return result;
  } catch (err) {
    await addAudit('notify_failed', 'system', { kind, reason: err.message }).catch(() => {});
    return { ok: false, reason: err.message };
  }
}
