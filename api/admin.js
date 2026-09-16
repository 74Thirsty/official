import { getList, setList, getDate, setDate, acquireLock, releaseLock, KEYS, LIMITS } from '../lib/storage.js';
import { sendJson, sendEmpty, readBody, isAdmin, clean, getParam } from '../lib/http.js';
import { buildNewsletter, getUpcomingEvents, getUpcomingStreams, buildWelcomeEmail, buildUnsubscribeUrl, signedCopyAvailable } from '../lib/newsletter.js';
import { sendEmail } from '../lib/email.js';
import { addAudit } from '../lib/audit.js';
import { randomBytes } from 'crypto';
import { createHmac, scryptSync, timingSafeEqual } from 'crypto';
import { parseBrowser } from '../lib/ua.js';
import { facebookDetectionConfigured } from '../lib/stream.js';
import { loadSocialMediaConfig, loadSocialMediaBackup, saveSocialMediaConfig, validateSocialMediaConfig, describeSocialMediaChange, socialMediaEnvValue } from '../lib/social-media.js';
import { computeVisitorStats } from '../lib/visitor-stats.js';
import { aiConfigured, generateJson } from '../lib/ai.js';
import { notifyOwner } from '../lib/notify.js';
import { normalizeIdeaPayload, validateIdea } from '../lib/event-model.js';
import { normalizeStoryMeta, wordCount, buildHistorySummary, similarityFlags } from '../lib/story-model.js';
import { buildStoryPrompt, buildIdeasPrompt, parseStoryResponse, parseIdeasResponse, pickSurpriseParams } from '../lib/generation.js';
import { getAccessibleDocuments, findDocumentByCode, getDocumentIntegrity, DOCUMENT_SOURCE_REVISION } from '../lib/document-registry.js';
import { expandDocument } from '../lib/document-references.js';
import { getWorkflow, getTemplate, publicWorkflow, publicTemplate, resolveCategoryGroups, workflowSourceRevision } from '../lib/compliance-engine.js';
import { createInstance, saveFieldValues, addEvidence, approveStage, advanceStage, createDocumentInstance, saveDocumentFieldValues, applySignature, finalizeDocument, cancelInstance, isAceInstance, summarizeInstance, detailInstance, buildInstanceExport } from '../lib/compliance-engine.js';
import { initialSocialMediaConfig, patchSocialMediaConfig } from '../lib/social-media.js';
import { searchGrants, fetchGrantDetails, mergeSearchAndDetail, runScreening, filterOpportunities, paginateResults, computeCounts, reviewOpportunity, promoteToAce } from '../lib/grants/intelligence.js';
import { buildExternalId } from '../lib/grants/dedup.js';
import { buildOrgProfile, evaluateMatch, summarizeOpportunity, normalizeRequirementModel, buildFallbackRequirementModel, analyzeRequirementsWithAi, autoFillRequirements, validateApplication, createApplication, saveAnswer, markSubmitted, allFields, countWords, mapFieldToOrgFact, getOrgFact, SOURCE_TYPES, ORG_CORE_FACTS } from '../lib/grant-intel.js';

export const maxDuration = 60;

export default function handler(req, res) {
  if (req.method === 'OPTIONS') return sendEmpty(res);
  const action = getParam(req, 'action') || 'stats';
  if (['docs-login', 'docs-list', 'docs-document', 'docs-validate', 'docs-integrity'].includes(action)) {
    handleDocs(req, res, action).catch(() => sendJson(res, { error: 'Document service unavailable.' }, 500));
    return;
  }
  if (action.startsWith('compliance-')) {
    handleCompliance(req, res, action).catch((error) => {
      console.error('compliance service failed:', error);
      sendJson(res, { error: 'Compliance service unavailable.' }, 500);
    });
    return;
  }
  if (action.startsWith('grant-intelligence-')) {
    handleGrantIntelligence(req, res, action).catch((error) => {
      console.error('grant intelligence service failed:', error);
      sendJson(res, { error: 'Grant intelligence service unavailable.' }, 500);
    });
    return;
  }
  if (!isAdmin(req)) {
    return sendJson(res, { error: 'Admin access required.' }, 403);
  }

  if (action.startsWith('social-media-')) {
    handleSocialMedia(req, res, action).catch((error) => {
      console.error('social media config service failed:', error);
      sendJson(res, { error: 'Social media configuration service is unavailable.' }, 500);
    });
    return;
  }

  const fail = () => sendJson(res, { error: 'Storage error.' }, 500);

  if (action === 'stats') {
    Promise.all([getList(KEYS.visitors), getList(KEYS.subscribers)]).then(([visitors, subscribers]) => {
      sendJson(res, {
        ...computeVisitorStats(visitors, new Date(), subscribers),
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

  if (action === 'social-media-config') {
    if (req.method === 'GET') {
      getList(KEYS.socialMediaConfig).then((entries) => {
        sendJson(res, { config: entries[0] || initialSocialMediaConfig(), source: entries.length ? 'stored' : 'repository-default' });
      }).catch(fail);
      return;
    }
    if (req.method === 'POST') {
      readBody(req).then(async (payload) => {
        const entries = await getList(KEYS.socialMediaConfig);
        const result = patchSocialMediaConfig(entries[0] || initialSocialMediaConfig(), payload);
        if (!result.ok) return sendJson(res, { error: result.error }, 422);
        await setList(KEYS.socialMediaConfig, [result.config]);
        await addAudit('social_media_config_updated', 'admin', {
          schemaVersion: result.config.schema_version,
          accountCount: result.config.accounts.length,
        });
        return sendJson(res, { ok: true, config: result.config });
      }).catch(fail);
      return;
    }
    sendJson(res, { error: 'Method not allowed.' }, 405);
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

  // --- Grant Intelligence ---
  if (action.startsWith('grant-')) {
    handleGrantIntel(req, res, action).catch(fail);
    return;
  }

  // --- Documentation access user management ---
  if (action === 'docs-users') {
    getList(KEYS.docsUsers).then((users) => {
      sendJson(res, { users: (users || []).map(u => ({ name: u.name, addedAt: u.addedAt })), total: (users || []).length });
    }).catch(fail);
    return;
  }

  if (action === 'docs-add-user' && req.method === 'POST') {
    readBody(req).then(async (payload) => {
      const name = clean(String(payload.name || ''), 60);
      const key = clean(String(payload.key || ''), 120);
      if (!name || !key) return sendJson(res, { error: 'Name and key are required.' }, 422);
      if (key.length < 12) return sendJson(res, { error: 'Access key must be at least 12 characters.' }, 422);
      const users = await getList(KEYS.docsUsers);
      if (users.some(u => u.name.toLowerCase() === name.toLowerCase())) {
        return sendJson(res, { error: 'User already exists.' }, 422);
      }
      users.push({ name, keyHash: hashDocsKey(key), addedAt: new Date().toISOString() });
      await setList(KEYS.docsUsers, users);
      await addAudit('docs_user_added', 'admin', { name });
      sendJson(res, { ok: true, users: users.map(u => ({ name: u.name, addedAt: u.addedAt })) });
    }).catch(fail);
    return;
  }

  if (action === 'docs-remove-user' && req.method === 'POST') {
    readBody(req).then(async (payload) => {
      const name = clean(String(payload.name || ''), 60);
      if (!name) return sendJson(res, { error: 'Name is required.' }, 422);
      let users = await getList(KEYS.docsUsers);
      const before = users.length;
      users = users.filter(u => u.name.toLowerCase() !== name.toLowerCase());
      if (users.length === before) return sendJson(res, { error: 'User not found.' }, 404);
      await setList(KEYS.docsUsers, users);
      await addAudit('docs_user_removed', 'admin', { name });
      sendJson(res, { ok: true, users: users.map(u => ({ name: u.name, addedAt: u.addedAt })) });
    }).catch(fail);
    return;
  }

  sendJson(res, { error: 'Unsupported action.' }, 404);
}

const DOC_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const RAW_DOCUMENT_BASE = `https://raw.githubusercontent.com/LostLimbRider/Autobiography/${DOCUMENT_SOURCE_REVISION}/`;

function docsSecret() {
  return process.env.ADMIN_KEY || '';
}

function issueDocsToken(name, role, version = '') {
  const secret = docsSecret();
  if (!secret) return '';
  const body = Buffer.from(JSON.stringify({ name, role, version, exp: Date.now() + DOC_SESSION_TTL_MS })).toString('base64url');
  const signature = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function readDocsSession(req) {
  const header = String(req.headers?.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const [body, signature] = token.split('.');
  const secret = docsSecret();
  if (!body || !signature || !secret) return null;
  const expected = createHmac('sha256', secret).update(body).digest();
  let supplied;
  try { supplied = Buffer.from(signature, 'base64url'); } catch { return null; }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  try {
    const session = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return session.exp > Date.now() && session.name && session.role ? session : null;
  } catch { return null; }
}

async function activeDocsSession(req) {
  const session = readDocsSession(req);
  if (!session || session.role !== 'user') return session;
  const users = await getList(KEYS.docsUsers);
  return users.some((user) => user?.name === session.name && (user.addedAt || '') === session.version) ? session : null;
}

export function hashDocsKey(key, salt = randomBytes(16).toString('hex')) {
  return `scrypt:${salt}:${scryptSync(key, salt, 32).toString('hex')}`;
}

export function verifyDocsKey(stored, supplied) {
  if (!stored || !supplied) return false;
  if (!stored.startsWith('scrypt:')) {
    const expected = createHmac('sha256', 'llr-docs-legacy').update(stored).digest();
    const actual = createHmac('sha256', 'llr-docs-legacy').update(supplied).digest();
    return timingSafeEqual(actual, expected);
  }
  const [, salt, expectedHex] = stored.split(':');
  if (!salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = scryptSync(supplied, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function publicDocument(doc) {
  return {
    document_code: doc.document_code,
    document_id: doc.document_id,
    title: doc.title,
    type: doc.type,
    domain: doc.domain,
    section: doc.section,
    access: doc.access,
    status: doc.status,
    version: doc.version,
    effective_date: doc.effective_date,
    responsible_area: doc.responsible_area,
    description: doc.description,
    canonical_path: doc.canonical_path,
    source_url: doc.source_url,
  };
}

async function handleDocs(req, res, action) {
  let session = readDocsSession(req);
  if (action === 'docs-login') {
    if (req.method !== 'POST') return sendJson(res, { error: 'Method not allowed.' }, 405);
    const payload = await readBody(req);
    const name = clean(String(payload.name || ''), 60);
    const key = clean(String(payload.key || ''), 120);
    if (!name || !key) return sendJson(res, { error: 'Name and key are required.' }, 422);
    const secret = docsSecret();
    if (!secret) return sendJson(res, { error: 'Document authentication is not configured.' }, 503);
    if (name.toLowerCase() === 'admin' && verifyDocsKey(hashDocsKey(secret, 'admin-fallback'), key)) {
      return sendJson(res, { ok: true, name: 'admin', role: 'admin', token: issueDocsToken('admin', 'admin') });
    }
    const users = await getList(KEYS.docsUsers);
    const index = users.findIndex((user) => user?.name?.toLowerCase() === name.toLowerCase());
    const storedKey = index < 0 ? '' : String(users[index].keyHash || users[index].key || '');
    if (index < 0 || !verifyDocsKey(storedKey, key)) {
      return sendJson(res, { error: 'Invalid credentials.' }, 403);
    }
    if (!users[index].keyHash) {
      users[index] = { ...users[index], keyHash: hashDocsKey(key) };
      delete users[index].key;
      await setList(KEYS.docsUsers, users);
    }
    return sendJson(res, { ok: true, name: users[index].name, role: 'user', token: issueDocsToken(users[index].name, 'user', users[index].addedAt || '') });
  }

  if (session?.role === 'user') {
    const users = await getList(KEYS.docsUsers);
    const activeUser = users.find((user) => user?.name === session.name && (user.addedAt || '') === session.version);
    if (!activeUser) session = null;
  }

  if (action === 'docs-list') {
    if (req.method !== 'GET') return sendJson(res, { error: 'Method not allowed.' }, 405);
    const state = await getList(KEYS.documentState);
    const allowed = getAccessibleDocuments(Boolean(session));
    const documents = allowed.map((doc) => ({
      ...publicDocument(doc),
      availability: state.find((item) => item.document_code === doc.document_code)?.availability || 'unknown',
    }));
    const response = { documents, authenticated: Boolean(session), role: session?.role || null, name: session?.name || null };
    return sendJson(res, response);
  }

  if (action === 'docs-document') {
    if (req.method !== 'GET') return sendJson(res, { error: 'Method not allowed.' }, 405);
    const code = clean(String(getParam(req, 'code') || ''), 40);
    const doc = findDocumentByCode(code);
    if (!doc || String(doc.status).toLowerCase() !== 'active') return sendJson(res, { error: 'Document not found.' }, 404);
    if (doc.access !== 'public' && !session) return sendJson(res, { error: 'Document access required.' }, 403);
    const sourcePath = doc.canonical_path;
    let content;
    try { content = await fetchDocumentSource(doc); } catch { return sendJson(res, { error: 'Source document is unavailable.' }, 502); }
    if (Buffer.byteLength(content, 'utf8') > 2 * 1024 * 1024) return sendJson(res, { error: 'Source document is too large.' }, 502);
    const expansion = await expandDocument(doc, content, {
      authenticated: Boolean(session),
      fetchMarkdown: fetchDocumentSource,
    });
    return sendJson(res, { document: publicDocument(doc), source_path: sourcePath, content, ...expansion });
  }

  if (!session || session.role !== 'admin') return sendJson(res, { error: 'Administrator access required.' }, 403);

  if (action === 'docs-integrity' && req.method === 'GET') {
    return sendJson(res, getDocumentIntegrity());
  }

  if (action === 'docs-validate' && req.method === 'POST') {
    const checkedAt = new Date().toISOString();
    const results = [];
    for (const doc of getAccessibleDocuments(true)) {
      const sourcePath = doc.canonical_path;
      try {
        const response = await fetch(`${RAW_DOCUMENT_BASE}${sourcePath}`, { method: 'HEAD' });
        results.push({ document_code: doc.document_code, availability: response.ok ? 'available' : 'missing', checked_at: checkedAt, error: response.ok ? null : `HTTP ${response.status}` });
      } catch {
        results.push({ document_code: doc.document_code, availability: 'unavailable', checked_at: checkedAt, error: 'Source check failed.' });
      }
    }
    await setList(KEYS.documentState, results);
    await addAudit('document_sources_validated', session.name, { checked: results.length, available: results.filter((item) => item.availability === 'available').length });
    return sendJson(res, { ok: true, results });
  }

  return sendJson(res, { error: 'Unsupported action.' }, 404);
}

async function handleSocialMedia(req, res, action) {
  if (action === 'social-media-load') {
    if (req.method !== 'GET') return sendJson(res, { error: 'Method not allowed.' }, 405);
    const result = await loadSocialMediaConfig();
    if (!result.ok) {
      return sendJson(res, { ok: false, code: result.code, message: result.message, errors: result.errors || [], warnings: result.warnings || [] });
    }
    return sendJson(res, { ok: true, config: result.data, relative: result.relative, warnings: result.warnings || [] });
  }

  if (action === 'social-media-load-backup') {
    if (req.method !== 'GET') return sendJson(res, { error: 'Method not allowed.' }, 405);
    const result = await loadSocialMediaBackup();
    if (!result.ok) {
      return sendJson(res, { ok: false, code: result.code, message: result.message, errors: result.errors || [] });
    }
    return sendJson(res, { ok: true, config: result.data, relative: result.relative });
  }

  if (action === 'social-media-validate') {
    if (req.method !== 'POST') return sendJson(res, { error: 'Method not allowed.' }, 405);
    const payload = await readBody(req);
    const validation = validateSocialMediaConfig(payload.config);
    if (validation.errors.length) {
      return sendJson(res, { ok: false, errors: validation.errors, warnings: validation.warnings }, 422);
    }
    return sendJson(res, { ok: true, warnings: validation.warnings });
  }

  if (action === 'social-media-save') {
    if (req.method !== 'POST') return sendJson(res, { error: 'Method not allowed.' }, 405);
    const payload = await readBody(req);
    if (payload.config === undefined || payload.config === null || typeof payload.config !== 'object' || Array.isArray(payload.config)) {
      return sendJson(res, { error: 'A configuration object is required.' }, 422);
    }
    const previousLoad = await loadSocialMediaConfig();
    const saved = await saveSocialMediaConfig(payload.config, { previous: previousLoad.ok ? previousLoad.data : null });
    if (!saved.ok) {
      const status = saved.code === 'VALIDATION' ? 422 : (saved.code === 'WRITE_ERROR' ? 500 : 400);
      return sendJson(res, { ok: false, code: saved.code, message: saved.message, errors: saved.errors || [], warnings: saved.warnings || [] }, status);
    }
    await addAudit('social_media_config_saved', 'admin', {
      summary: saved.summary.join(' · '),
      accounts: Array.isArray(saved.data.accounts) ? saved.data.accounts.length : 0,
      backupCreated: saved.backupCreated,
      configPath: socialMediaEnvValue() || '',
    });
    return sendJson(res, { ok: true, config: saved.data, relative: saved.relative, backupCreated: saved.backupCreated, summary: saved.summary });
  }

  return sendJson(res, { error: 'Unsupported action.' }, 404);
}

async function handleCompliance(req, res, action) {
  const session = await activeDocsSession(req);
  if (!session) return sendJson(res, { error: 'Document access required.' }, 403);

  if (action === 'compliance-workflows' && req.method === 'GET') {
    return sendJson(res, {
      categories: resolveCategoryGroups(),
      workflows: getCategoryWorkflowList(),
      source: workflowSourceRevision(),
    });
  }

  const transactions = await getList(KEYS.complianceTransactions);

  if (action === 'compliance-list' && req.method === 'GET') {
    return sendJson(res, {
      transactions: transactions.map((transaction) => {
        if (!isAceInstance(transaction)) {
          return { ...transaction, legacyRecord: true, workflow: null, currentStage: null };
        }
        const workflow = transaction.workflowDefinition || getWorkflow(transaction.workflowId);
        const template = transaction.templateDefinition || getTemplate(transaction.templateId);
        return workflow ? summarizeInstance(transaction, workflow, template) : { ...transaction, workflow: null };
      }),
    });
  }

  if (action === 'compliance-start' && req.method === 'GET') {
    const workflowId = clean(String(getParam(req, 'workflow_id') || ''), 100);
    const workflow = getWorkflow(workflowId);
    if (!workflow) return sendJson(res, { error: 'Controlled workflow not found.' }, 404);
    const template = getTemplate(workflow.templateId);
    if (!template) return sendJson(res, { error: 'Controlled template is unavailable.' }, 409);
    return sendJson(res, { workflow: publicWorkflow(workflow), template: publicTemplate(template) });
  }

  if (action === 'compliance-create' && req.method === 'POST') {
    const payload = await readBody(req);
    const workflow = getWorkflow(clean(String(payload.workflow_id || ''), 100));
    if (!workflow) return sendJson(res, { error: 'Controlled workflow not found.' }, 404);
    const idempotencyKey = clean(String(payload.idempotency_key || ''), 100);
    if (!/^[A-Za-z0-9_-]{16,100}$/.test(idempotencyKey)) return sendJson(res, { error: 'A valid workflow-start idempotency key is required.' }, 422);
    const existing = transactions.find((item) => item.idempotencyKey === idempotencyKey && item.createdBy === session.name);
    if (existing) {
      const existingWorkflow = existing.workflowDefinition || getWorkflow(existing.workflowId);
      const existingTemplate = existing.templateDefinition || getTemplate(existing.templateId);
      return sendJson(res, { transaction: summarizeInstance(existing, existingWorkflow, existingTemplate), idempotent_replay: true });
    }
    const lockToken = randomBytes(18).toString('base64url');
    const lockKey = 'llr:lock:compliance-create';
    if (!await acquireLock(lockKey, lockToken)) return sendJson(res, { error: 'Another workflow start is being saved. Retry this request.' }, 409);
    try {
      const current = await getList(KEYS.complianceTransactions);
      const replay = current.find((item) => item.idempotencyKey === idempotencyKey && item.createdBy === session.name);
      if (replay) {
        const replayWorkflow = replay.workflowDefinition || getWorkflow(replay.workflowId);
        const replayTemplate = replay.templateDefinition || getTemplate(replay.templateId);
        return sendJson(res, { transaction: summarizeInstance(replay, replayWorkflow, replayTemplate), idempotent_replay: true });
      }
      let instance;
      try {
        instance = createInstance(workflow, payload.values || {}, session.name, new Set(current.map((item) => item.id)));
      } catch (error) {
        return sendJson(res, { error: error.message }, 422);
      }
      instance.idempotencyKey = idempotencyKey;
      current.unshift(instance);
      await setList(KEYS.complianceTransactions, current.slice(0, LIMITS.complianceTransactions));
      await addAudit('compliance_instance_created', session.name, { instanceId: instance.id, workflowId: workflow.id });
      return sendJson(res, { transaction: summarizeInstance(instance, instance.workflowDefinition, instance.templateDefinition) }, 201);
    } finally {
      await releaseLock(lockKey, lockToken);
    }
  }

  if (action === 'compliance-export' && req.method === 'GET') {
    const id = clean(String(getParam(req, 'id') || ''), 80);
    const format = clean(String(getParam(req, 'format') || 'html'), 20);
    const transaction = transactions.find((item) => item.id === id);
    const workflow = transaction && (transaction.workflowDefinition || getWorkflow(transaction.workflowId));
    const template = transaction && (transaction.templateDefinition || getTemplate(transaction.templateId));
    if (!transaction || !workflow || !template) return sendJson(res, { error: 'Compliance record not found.' }, 404);
    try {
      const result = buildInstanceExport(transaction, workflow, template, format);
      return sendJson(res, result, 200);
    } catch (error) {
      return sendJson(res, { error: error.message }, 400);
    }
  }

  const payload = req.method === 'POST' ? await readBody(req) : {};
  const id = clean(String(payload.id || payload.instance_id || getParam(req, 'id') || ''), 80);
  const index = transactions.findIndex((transaction) => transaction.id === id);
  if (index < 0) return sendJson(res, { error: 'Compliance record not found.' }, 404);
  const transaction = transactions[index];
  if (!isAceInstance(transaction)) return sendJson(res, { error: 'Legacy records are read-only under ACE.' }, 409);
  const workflow = transaction.workflowDefinition || getWorkflow(transaction.workflowId);
  const template = transaction.templateDefinition || getTemplate(transaction.templateId);
  if (!workflow || !template) return sendJson(res, { error: 'Controlled workflow or template is unavailable.' }, 409);

  if (action === 'compliance-detail' && req.method === 'GET') {
    return sendJson(res, { transaction: detailInstance(transaction, workflow, template) });
  }

  try {
    if (action === 'compliance-save' && req.method === 'POST') {
      const sectionId = clean(String(payload.section_id || ''), 60);
      saveFieldValues(transaction, workflow, sectionId, payload.values || {}, session.name);
      await addAudit('compliance_section_saved', session.name, { instanceId: id, sectionId });
    } else if (action === 'compliance-evidence' && req.method === 'POST') {
      const description = clean(String(payload.description || ''), 4000);
      const url = clean(String(payload.url || ''), 500);
      if (url && !/^https:\/\//i.test(url)) return sendJson(res, { error: 'Evidence URL must use HTTPS.' }, 422);
      addEvidence(transaction, workflow, session.name, description, url);
      await addAudit('compliance_evidence_added', session.name, { instanceId: id, stageId: workflow.lifecycle[transaction.currentStageIndex]?.id });
    } else if (action === 'compliance-approve' && req.method === 'POST') {
      if (session.role !== 'admin') return sendJson(res, { error: 'Administrator approval required.' }, 403);
      const approvalRuleId = clean(String(payload.approval_rule_id || ''), 120);
      approveStage(transaction, workflow, session.name, approvalRuleId);
      await addAudit('compliance_stage_approved', session.name, { instanceId: id, stageId: workflow.lifecycle[transaction.currentStageIndex]?.id });
    } else if (action === 'compliance-advance' && req.method === 'POST') {
      advanceStage(transaction, workflow, session.name);
      await addAudit('compliance_stage_advanced', session.name, { instanceId: id, stageIndex: transaction.currentStageIndex, status: transaction.status });
    } else if (action === 'compliance-cancel' && req.method === 'POST') {
      cancelInstance(transaction, workflow, session.name, clean(String(payload.reason || ''), 500));
      await addAudit('compliance_instance_cancelled', session.name, { instanceId: id, reason: transaction.cancelReason });
    } else if (action === 'compliance-doc-create' && req.method === 'POST') {
      const documentId = clean(String(payload.document_id || ''), 60);
      createDocumentInstance(transaction, workflow, documentId, session.name);
      await addAudit('compliance_document_created', session.name, { instanceId: id, documentId });
    } else if (action === 'compliance-doc-save' && req.method === 'POST') {
      const documentInstanceId = clean(String(payload.document_instance_id || ''), 40);
      saveDocumentFieldValues(transaction, documentInstanceId, payload.values || {}, session.name);
      await addAudit('compliance_document_saved', session.name, { instanceId: id, documentInstanceId });
    } else if (action === 'compliance-doc-sign' && req.method === 'POST') {
      const documentInstanceId = clean(String(payload.document_instance_id || ''), 40);
      const signatureId = clean(String(payload.signature_id || ''), 80);
      const name = clean(String(payload.name || session.name), 120);
      applySignature(transaction, documentInstanceId, signatureId, session.name, name);
      await addAudit('compliance_document_signed', session.name, { instanceId: id, documentInstanceId, signatureId });
    } else if (action === 'compliance-doc-finalize' && req.method === 'POST') {
      const documentInstanceId = clean(String(payload.document_instance_id || ''), 40);
      finalizeDocument(transaction, documentInstanceId, session.name);
      await addAudit('compliance_document_finalized', session.name, { instanceId: id, documentInstanceId });
    } else {
      return sendJson(res, { error: 'Unsupported action.' }, 404);
    }
  } catch (error) {
    return sendJson(res, { error: error.message }, 409);
  }

  transactions[index] = transaction;
  await setList(KEYS.complianceTransactions, transactions);
  return sendJson(res, { transaction: detailInstance(transaction, workflow, template) });
}

function getCategoryWorkflowList() {
  const list = [];
  for (const category of Object.values(resolveCategoryGroups())) {
    for (const workflow of category.workflows) {
      list.push({ ...workflow, category: category.id, categoryName: category.name });
    }
  }
  return list;
}

async function handleGrantIntelligence(req, res, action) {
  if (!isAdmin(req)) {
    return sendJson(res, { error: 'Admin access required.' }, 403);
  }
  const fail = () => sendJson(res, { error: 'Storage error.' }, 500);

  if (action === 'grant-intelligence-list' && req.method === 'GET') {
    const opportunities = await getList(KEYS.grantOpportunities);
    const counts = computeCounts(opportunities);
    const filters = {
      status: clean(String(getParam(req, 'status') || ''), 40),
      provider: clean(String(getParam(req, 'provider') || ''), 40),
      agency: clean(String(getParam(req, 'agency') || ''), 80),
      search: clean(String(getParam(req, 'q') || ''), 120),
      deadlineBefore: clean(String(getParam(req, 'deadline_before') || ''), 20),
      deadlineAfter: clean(String(getParam(req, 'deadline_after') || ''), 20),
      deadlineSoon: clean(String(getParam(req, 'deadline_soon') || ''), 5),
      costShare: clean(String(getParam(req, 'cost_share') || ''), 20),
      fundingCategory: clean(String(getParam(req, 'funding_category') || ''), 60),
      fundingInstrument: clean(String(getParam(req, 'funding_instrument') || ''), 60),
      sort: clean(String(getParam(req, 'sort') || ''), 30),
    };
    const filtered = filterOpportunities(opportunities, filters);
    const page = Number(getParam(req, 'page')) || 1;
    const pageSize = Number(getParam(req, 'page_size')) || 25;
    const paginated = paginateResults(filtered, page, pageSize);
    const syncState = await getList(KEYS.grantSyncState);
    const lastSync = syncState[0] || null;
    return sendJson(res, {
      opportunities: paginated.items,
      counts,
      pagination: { page: paginated.page, pageSize: paginated.pageSize, total: paginated.total, totalPages: paginated.totalPages },
      lastSync: lastSync ? { lastRun: lastSync.lastRun, stats: lastSync.stats, state: lastSync.state } : null,
    });
  }

  if (action === 'grant-intelligence-detail' && req.method === 'GET') {
    const externalId = clean(String(getParam(req, 'id') || ''), 120);
    const opportunities = await getList(KEYS.grantOpportunities);
    const opp = opportunities.find((o) => o.externalId === externalId);
    if (!opp) return sendJson(res, { error: 'Opportunity not found.' }, 404);
    return sendJson(res, { opportunity: opp });
  }

  if (action === 'grant-intelligence-fetch-details' && req.method === 'GET') {
    const providerOppId = clean(String(getParam(req, 'provider_opportunity_id') || ''), 40);
    if (!providerOppId) return sendJson(res, { error: 'Provider opportunity ID required.' }, 422);
    try {
      const detail = await fetchGrantDetails(providerOppId);
      return sendJson(res, { detail });
    } catch (err) {
      return sendJson(res, { error: `Failed to fetch details: ${err.message}` }, 502);
    }
  }

  if (action === 'grant-intelligence-sync' && req.method === 'POST') {
    const payload = await readBody(req);
    const searchParams = {
      keyword: clean(String(payload.keyword || ''), 200),
      oppStatuses: clean(String(payload.oppStatuses || 'posted'), 60),
      rows: Math.min(Math.max(Number(payload.rows) || 25, 1), 100),
      startRecordNum: 0,
    };
    const syncState = await getList(KEYS.grantSyncState);
    const lockToken = randomBytes(18).toString('base64url');
    const lockKey = 'llr:lock:grant-sync';
    if (!await acquireLock(lockKey, lockToken, 30)) {
      return sendJson(res, { error: 'Synchronization already in progress. Retry shortly.' }, 409);
    }
    try {
      const existingList = await getList(KEYS.grantOpportunities);
      const searchResult = await searchGrants(searchParams);
      const { syncOpportunities } = await import('../lib/grants/intelligence.js');
      const syncStats = await syncOpportunities(searchResult.hits, existingList);
      const updatedList = runScreening(existingList);
      await setList(KEYS.grantOpportunities, updatedList.slice(0, LIMITS.grantOpportunities));
      const now = new Date().toISOString();
      await setList(KEYS.grantSyncState, [{
        lastRun: now,
        state: 'completed',
        searchParams,
        stats: {
          totalHits: searchResult.hitCount,
          processed: searchResult.hits.length,
          ...syncStats,
        },
      }]);
      await addAudit('grant_intelligence_sync', 'admin', {
        totalHits: searchResult.hitCount,
        new: syncStats.newCount,
        updated: syncStats.updatedCount,
      });
      return sendJson(res, {
        ok: true,
        lastSync: now,
        stats: {
          totalHits: searchResult.hitCount,
          processed: searchResult.hits.length,
          ...syncStats,
        },
      });
    } catch (err) {
      const now = new Date().toISOString();
      await setList(KEYS.grantSyncState, [{
        lastRun: now,
        state: 'failed',
        error: err.message,
        searchParams,
      }]).catch(() => {});
      return sendJson(res, { error: `Synchronization failed: ${err.message}. Existing grant records were not modified.` }, 502);
    } finally {
      await releaseLock(lockKey, lockToken);
    }
  }

  if (action === 'grant-intelligence-review' && req.method === 'POST') {
    const payload = await readBody(req);
    const externalId = clean(String(payload.external_id || ''), 120);
    const decision = clean(String(payload.decision || ''), 20);
    const notes = clean(String(payload.notes || ''), 2000);
    if (!externalId || !decision) return sendJson(res, { error: 'external_id and decision are required.' }, 422);
    if (!['reject', 'keep'].includes(decision)) return sendJson(res, { error: 'Decision must be "reject" or "keep".' }, 422);
    const opportunities = await getList(KEYS.grantOpportunities);
    const opp = reviewOpportunity(opportunities, externalId, decision, notes);
    if (!opp) return sendJson(res, { error: 'Opportunity not found.' }, 404);
    await setList(KEYS.grantOpportunities, opportunities);
    await addAudit('grant_intelligence_review', 'admin', { externalId, decision });
    return sendJson(res, { ok: true, opportunity: opp });
  }

  if (action === 'grant-intelligence-promote' && req.method === 'POST') {
    const payload = await readBody(req);
    const externalId = clean(String(payload.external_id || ''), 120);
    if (!externalId) return sendJson(res, { error: 'external_id is required.' }, 422);
    const opportunities = await getList(KEYS.grantOpportunities);
    const result = promoteToAce(opportunities, externalId);
    if (result.error) return sendJson(res, { error: result.error }, 422);

    const workflow = getWorkflow(result.workflowId);
    if (!workflow) return sendJson(res, { error: 'Grant workflow not found.' }, 500);
    const template = getTemplate(workflow.templateId);
    if (!template) return sendJson(res, { error: 'Grant template unavailable.' }, 500);

    const transactions = await getList(KEYS.complianceTransactions);
    const idempotencyKey = result.idempotencyKey;
    const existing = transactions.find((item) => item.idempotencyKey === idempotencyKey);
    if (existing) {
      return sendJson(res, { error: 'This opportunity has already been promoted.' }, 409);
    }

    const lockToken = randomBytes(18).toString('base64url');
    const lockKey = 'llr:lock:grant-promote';
    if (!await acquireLock(lockKey, lockToken, 15)) {
      return sendJson(res, { error: 'Another promotion is in progress. Retry.' }, 409);
    }
    try {
      let instance;
      try {
        instance = createInstance(workflow, result.creationValues, 'admin', new Set(transactions.map((item) => item.id)));
      } catch (err) {
        return sendJson(res, { error: `Failed to create ACE record: ${err.message}` }, 422);
      }
      instance.idempotencyKey = idempotencyKey;
      transactions.unshift(instance);
      await setList(KEYS.complianceTransactions, transactions.slice(0, LIMITS.complianceTransactions));

      const oppIndex = opportunities.findIndex((o) => o.externalId === externalId);
      if (oppIndex >= 0) {
        opportunities[oppIndex].aceInstanceId = instance.id;
        opportunities[oppIndex].aceStatus = 'promoted';
        opportunities[oppIndex].status = 'promoted';
        opportunities[oppIndex].updatedAt = new Date().toISOString();
        await setList(KEYS.grantOpportunities, opportunities);
      }

      await addAudit('grant_intelligence_promoted', 'admin', {
        externalId,
        instanceId: instance.id,
        workflowId: workflow.id,
      });
      return sendJson(res, {
        ok: true,
        instance: summarizeInstance(instance, instance.workflowDefinition, instance.templateDefinition),
        opportunity: opportunities[oppIndex],
      }, 201);
    } finally {
      await releaseLock(lockKey, lockToken);
    }
  }

  return sendJson(res, { error: 'Unsupported action.' }, 404);
}

async function fetchDocumentSource(document) {
  const response = await fetch(`${RAW_DOCUMENT_BASE}${document.canonical_path}`, { headers: { Accept: 'text/plain' } });
  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
  return response.text();
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

async function handleGrantIntel(req, res, action) {
  // Grant Intelligence uses the same admin auth as the rest of this handler.
  const fail = () => sendJson(res, { error: 'Grant intelligence service unavailable.' }, 500);

  // --- Org knowledge (§1) ---
  if (action === 'grant-org' && req.method === 'GET') {
    const orgRecords = await getList(KEYS.grantOrg);
    const record = Array.isArray(orgRecords) && orgRecords.length ? orgRecords[0] : null;
    const profile = buildOrgProfile(record);
    return sendJson(res, { profile, coreFacts: ORG_CORE_FACTS });
  }

  if (action === 'grant-org-save' && req.method === 'POST') {
    const payload = await readBody(req);
    const existing = await getList(KEYS.grantOrg);
    const record = (Array.isArray(existing) && existing.length ? existing[0] : { facts: {} });
    const allowed = ['financial_year_end', 'duns', 'uei', 'state_registration', 'annual_budget', 'operating_expenses', 'current_board_size', 'staff_count', 'volunteer_count', 'website'];
    for (const key of allowed) {
      if (payload[key] !== undefined) {
        record.facts[key] = {
          label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          value: String(payload[key]).trim(),
          source: 'Administrator-confirmed grant knowledge',
          confirmedBy: payload.confirmedBy || 'admin',
          confirmedAt: new Date().toISOString(),
        };
      }
    }
    record.updatedAt = new Date().toISOString();
    await setList(KEYS.grantOrg, [record]);
    await addAudit('grant_org_updated', 'admin', { keys: Object.keys(record.facts) });
    return sendJson(res, { ok: true, profile: buildOrgProfile(record) });
  }

  // --- Opportunity discovery (§13 flow: 50 potential matches → actual list) ---
  if (action === 'grant-opp-search' && req.method === 'GET') {
    const keywords = getParam(req, 'keywords') || '';
    const categories = getParam(req, 'categories') || '';
    const { searchGrantsGov } = await import('../lib/grant-intel.js');
    try {
      const result = await searchGrantsGov({
        keywords,
        categories: categories ? categories.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      });
      // Enrich with match scores against LLR profile.
      const orgRecords = await getList(KEYS.grantOrg);
      const profile = buildOrgProfile(Array.isArray(orgRecords) && orgRecords.length ? orgRecords[0] : null);
      const enriched = result.hits.map((hit) => {
        const match = evaluateMatch(hit, profile);
        return { ...hit, match };
      });
      // Sort by match score descending.
      enriched.sort((a, b) => (b.match?.score || 0) - (a.match?.score || 0));
      return sendJson(res, { hits: enriched, numFound: result.numFound, query: { keywords, categories } });
    } catch (error) {
      return sendJson(res, { error: `Grants.gov search failed: ${error.message}` }, 502);
    }
  }

  if (action === 'grant-opp-fetch' && req.method === 'GET') {
    const oppId = getParam(req, 'id');
    if (!oppId) return sendJson(res, { error: 'Opportunity ID is required.' }, 422);
    const { fetchGrantsGovDetail } = await import('../lib/grant-intel.js');
    try {
      const detail = await fetchGrantsGovDetail(oppId);
      return sendJson(res, { opportunity: detail });
    } catch (error) {
      return sendJson(res, { error: `Grants.gov detail failed: ${error.message}` }, 502);
    }
  }

  // --- Opportunity CRUD ---
  if (action === 'grant-opp-add' && req.method === 'POST') {
    const payload = await readBody(req);
    const title = clean(String(payload.title || ''), 300);
    if (!title) return sendJson(res, { error: 'Title is required.' }, 422);
    const opportunities = await getList(KEYS.grantOpportunities);
    const now = new Date().toISOString();
    const opportunity = {
      id: `gopp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      source: payload.source === 'grants-gov' ? 'grants-gov' : 'manual',
      sourceId: String(payload.sourceId || '').slice(0, 100),
      title,
      funder: clean(String(payload.funder || ''), 200),
      url: clean(String(payload.url || ''), 500),
      deadline: String(payload.deadline || '').slice(0, 10),
      openDate: String(payload.openDate || '').slice(0, 10),
      amountMin: payload.amountMin !== undefined ? Number(payload.amountMin) || null : null,
      amountMax: payload.amountMax !== undefined ? Number(payload.amountMax) || null : null,
      totalFunding: payload.totalFunding !== undefined ? Number(payload.totalFunding) || null : null,
      categories: Array.isArray(payload.categories) ? payload.categories.map((c) => String(c).slice(0, 60)) : [],
      description: clean(String(payload.description || ''), 6000),
      eligibility: clean(String(payload.eligibility || ''), 2000),
      applicantTypes: clean(String(payload.applicantTypes || ''), 600),
      instructionsText: clean(String(payload.instructionsText || ''), 20000),
      attachments: Array.isArray(payload.attachments) ? payload.attachments.map((a) => ({ label: clean(String(a.label || ''), 200), url: clean(String(a.url || ''), 500) })) : [],
      requirementModel: null,
      status: 'discovered',
      match: null,
      createdAt: now,
      updatedAt: now,
    };
    opportunities.unshift(opportunity);
    await setList(KEYS.grantOpportunities, opportunities.slice(0, LIMITS.grantOpportunities));
    await addAudit('grant_opp_added', 'admin', { id: opportunity.id, title, source: opportunity.source });
    return sendJson(res, { opportunity: summarizeOpportunity(opportunity) }, 201);
  }

  if (action === 'grant-opp-update' && req.method === 'POST') {
    const payload = await readBody(req);
    const id = clean(String(payload.id || ''), 80);
    if (!id) return sendJson(res, { error: 'Opportunity ID is required.' }, 422);
    const opportunities = await getList(KEYS.grantOpportunities);
    const index = opportunities.findIndex((o) => o.id === id);
    if (index < 0) return sendJson(res, { error: 'Opportunity not found.' }, 404);
    const opp = opportunities[index];
    const editable = ['title', 'funder', 'url', 'deadline', 'openDate', 'amountMin', 'amountMax', 'totalFunding', 'categories', 'description', 'eligibility', 'applicantTypes', 'instructionsText', 'status'];
    for (const key of editable) {
      if (payload[key] !== undefined) {
        if (key === 'amountMin' || key === 'amountMax' || key === 'totalFunding') {
          opp[key] = Number(payload[key]) || null;
        } else if (key === 'categories') {
          opp[key] = Array.isArray(payload[key]) ? payload[key].map((c) => String(c).slice(0, 60)) : opp[key];
        } else {
          opp[key] = clean(String(payload[key]), key === 'instructionsText' ? 20000 : key === 'description' ? 6000 : 500);
        }
      }
    }
    if (payload.attachments !== undefined) {
      opp.attachments = Array.isArray(payload.attachments) ? payload.attachments.map((a) => ({ label: clean(String(a.label || ''), 200), url: clean(String(a.url || ''), 500) })) : [];
    }
    opp.updatedAt = new Date().toISOString();
    opportunities[index] = opp;
    await setList(KEYS.grantOpportunities, opportunities);
    await addAudit('grant_opp_updated', 'admin', { id, fields: Object.keys(payload).filter((k) => k !== 'id') });
    return sendJson(res, { opportunity: summarizeOpportunity(opp) });
  }

  if (action === 'grant-opp-delete' && req.method === 'POST') {
    const payload = await readBody(req);
    const id = clean(String(payload.id || ''), 80);
    if (!id) return sendJson(res, { error: 'Opportunity ID is required.' }, 422);
    const opportunities = await getList(KEYS.grantOpportunities);
    const index = opportunities.findIndex((o) => o.id === id);
    if (index < 0) return sendJson(res, { error: 'Opportunity not found.' }, 404);
    const [removed] = opportunities.splice(index, 1);
    await setList(KEYS.grantOpportunities, opportunities);
    await addAudit('grant_opp_deleted', 'admin', { id, title: removed.title });
    return sendJson(res, { ok: true, id });
  }

  if (action === 'grant-opp-list' && req.method === 'GET') {
    const opportunities = await getList(KEYS.grantOpportunities);
    const orgRecords = await getList(KEYS.grantOrg);
    const profile = buildOrgProfile(Array.isArray(orgRecords) && orgRecords.length ? orgRecords[0] : null);
    // Re-compute match scores against current LLR profile on every list call.
    const enriched = opportunities.map((opp) => {
      const match = opp.match && opp.match.score !== undefined ? opp.match : evaluateMatch(opp, profile);
      return { ...summarizeOpportunity(opp), match };
    });
    // Sort by match score descending, then deadline ascending.
    enriched.sort((a, b) => {
      const scoreDiff = (b.match?.score || 0) - (a.match?.score || 0);
      if (scoreDiff !== 0) return scoreDiff;
      if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
      return 0;
    });
    return sendJson(res, { opportunities: enriched, total: enriched.length });
  }

  if (action === 'grant-opp-get' && req.method === 'GET') {
    const id = clean(String(getParam(req, 'id') || ''), 80);
    if (!id) return sendJson(res, { error: 'Opportunity ID is required.' }, 422);
    const opportunities = await getList(KEYS.grantOpportunities);
    const opp = opportunities.find((o) => o.id === id);
    if (!opp) return sendJson(res, { error: 'Opportunity not found.' }, 404);
    const orgRecords = await getList(KEYS.grantOrg);
    const profile = buildOrgProfile(Array.isArray(orgRecords) && orgRecords.length ? orgRecords[0] : null);
    const match = evaluateMatch(opp, profile);
    return sendJson(res, { opportunity: { ...opp, match } });
  }

  // --- Requirement analysis (§2 — actual grant requirements, not one generic form) ---
  if (action === 'grant-opp-analyze' && req.method === 'POST') {
    const payload = await readBody(req);
    const id = clean(String(payload.id || ''), 80);
    if (!id) return sendJson(res, { error: 'Opportunity ID is required.' }, 422);
    const opportunities = await getList(KEYS.grantOpportunities);
    const index = opportunities.findIndex((o) => o.id === id);
    if (index < 0) return sendJson(res, { error: 'Opportunity not found.' }, 404);
    const opp = opportunities[index];
    const instructions = String(payload.instructions || opp.instructionsText || '').slice(0, 20000);
    if (!instructions && opp.source !== 'grants-gov') {
      return sendJson(res, { error: 'Application instructions are required for analysis. Paste them or add them to the opportunity first.' }, 422);
    }
    let model = null;
    if (aiConfigured()) {
      model = await analyzeRequirementsWithAi({ instructions, opportunity: opp });
    }
    if (!model) {
      model = buildFallbackRequirementModel(opp);
    }
    opp.requirementModel = model;
    opp.updatedAt = new Date().toISOString();
    opportunities[index] = opp;
    await setList(KEYS.grantOpportunities, opportunities);
    await addAudit('grant_opp_analyzed', 'admin', { id, source: model.source, sections: model.sections.length });
    return sendJson(res, { requirementModel: model, source: model.source });
  }

  // --- Application lifecycle (§3, §5, §6, §11, §12) ---
  if (action === 'grant-app-create' && req.method === 'POST') {
    const payload = await readBody(req);
    const oppId = clean(String(payload.opportunityId || ''), 80);
    if (!oppId) return sendJson(res, { error: 'Opportunity ID is required.' }, 422);
    const opportunities = await getList(KEYS.grantOpportunities);
    const opp = opportunities.find((o) => o.id === oppId);
    if (!opp) return sendJson(res, { error: 'Opportunity not found.' }, 404);

    // Ensure we have a requirement model.
    let requirementModel = opp.requirementModel;
    if (!requirementModel) {
      if (opp.source === 'grants-gov' && opp.sourceId) {
        try {
          const { fetchGrantsGovDetail } = await import('../lib/grant-intel.js');
          const detail = await fetchGrantsGovDetail(opp.sourceId);
          opp.description = opp.description || detail.description;
          opp.eligibility = opp.eligibility || detail.eligibility;
          opp.applicantTypes = opp.applicantTypes || detail.applicantTypes;
          if (!opp.attachments?.length && detail.attachments?.length) opp.attachments = detail.attachments;
        } catch {}
      }
      requirementModel = buildFallbackRequirementModel(opp);
      opp.requirementModel = requirementModel;
      opp.updatedAt = new Date().toISOString();
      const oppIndex = opportunities.findIndex((o) => o.id === oppId);
      if (oppIndex >= 0) {
        opportunities[oppIndex] = opp;
        await setList(KEYS.grantOpportunities, opportunities);
      }
    }

    const orgRecords = await getList(KEYS.grantOrg);
    const profile = buildOrgProfile(Array.isArray(orgRecords) && orgRecords.length ? orgRecords[0] : null);
    const existingApps = await getList(KEYS.grantApplications);
    const existingIds = new Set(existingApps.map((a) => a.id));
    const application = createApplication({ opportunity: opp, requirementModel, profile, actor: 'admin', existingIds });

    // Create the ACE pursue-grant workflow instance linked to this opportunity.
    let aceInstanceId = null;
    try {
      const transactions = await getList(KEYS.complianceTransactions);
      const aceIds = new Set(transactions.map((t) => t.id));
      const workflow = getWorkflow('pursue-grant');
      const template = getTemplate('GRANT_MASTER_TEMPLATE');
      if (workflow && template) {
        const aceValues = {
          grant_name: opp.title,
          funder: opp.funder,
          funding_program: opp.funder,
          opportunity_url: opp.url,
          date_identified: opp.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10),
          application_deadline: opp.deadline || '',
        };
        const instance = createInstance(workflow, aceValues, 'admin', aceIds);
        instance._linkedOpportunityId = oppId;
        instance._linkedApplicationId = application.id;
        transactions.unshift(instance);
        await setList(KEYS.complianceTransactions, transactions.slice(0, LIMITS.complianceTransactions));
        aceInstanceId = instance.id;
        application.aceInstanceId = aceInstanceId;
        await addAudit('compliance_instance_created', 'admin', { instanceId: instance.id, workflowId: 'pursue-grant', linkedTo: oppId });
      }
    } catch {}

    existingApps.unshift(application);
    await setList(KEYS.grantApplications, existingApps.slice(0, LIMITS.grantApplications));

    // Update opportunity status.
    opp.status = 'application-in-preparation';
    opp.updatedAt = new Date().toISOString();
    const oppIdx = opportunities.findIndex((o) => o.id === oppId);
    if (oppIdx >= 0) {
      opportunities[oppIdx] = opp;
      await setList(KEYS.grantOpportunities, opportunities);
    }

    await addAudit('grant_app_created', 'admin', { id: application.id, oppId, aceInstanceId });
    return sendJson(res, { application: { ...application, id: application.id, status: application.status, aceInstanceId } }, 201);
  }

  if (action === 'grant-app-get' && req.method === 'GET') {
    const id = clean(String(getParam(req, 'id') || ''), 80);
    if (!id) return sendJson(res, { error: 'Application ID is required.' }, 422);
    const apps = await getList(KEYS.grantApplications);
    const app = apps.find((a) => a.id === id);
    if (!app) return sendJson(res, { error: 'Application not found.' }, 404);
    return sendJson(res, { application: app });
  }

  if (action === 'grant-app-answer' && req.method === 'POST') {
    const payload = await readBody(req);
    const appId = clean(String(payload.id || ''), 80);
    const questionId = clean(String(payload.questionId || ''), 80);
    if (!appId || !questionId) return sendJson(res, { error: 'Application ID and question ID are required.' }, 422);
    const apps = await getList(KEYS.grantApplications);
    const index = apps.findIndex((a) => a.id === appId);
    if (index < 0) return sendJson(res, { error: 'Application not found.' }, 404);
    const app = apps[index];
    if (app.locked) return sendJson(res, { error: 'This application is submitted and locked.' }, 409);
    const updated = saveAnswer(app, questionId, {
      value: payload.value,
      sourceType: 'administrator-entered',
      notes: payload.notes,
    }, 'admin');
    apps[index] = updated;
    await setList(KEYS.grantApplications, apps);
    await addAudit('grant_app_answer_saved', 'admin', { appId, questionId });
    return sendJson(res, { ok: true, answer: updated.answers[questionId] });
  }

  if (action === 'grant-app-autofill' && req.method === 'POST') {
    const payload = await readBody(req);
    const appId = clean(String(payload.id || ''), 80);
    if (!appId) return sendJson(res, { error: 'Application ID is required.' }, 422);
    const apps = await getList(KEYS.grantApplications);
    const index = apps.findIndex((a) => a.id === appId);
    if (index < 0) return sendJson(res, { error: 'Application not found.' }, 404);
    const app = apps[index];
    if (app.locked) return sendJson(res, { error: 'This application is submitted and locked.' }, 409);
    const orgRecords = await getList(KEYS.grantOrg);
    const profile = buildOrgProfile(Array.isArray(orgRecords) && orgRecords.length ? orgRecords[0] : null);
    const freshAnswers = autoFillRequirements(app.requirementSnapshot, profile);
    // Merge: preserve administrator-entered values, update only auto-populated and action-required.
    for (const [key, fresh] of Object.entries(freshAnswers)) {
      const existing = app.answers[key];
      if (existing && existing.sourceType === 'administrator-entered' && existing.value) {
        continue; // Don't overwrite human input.
      }
      app.answers[key] = { ...fresh, updatedAt: new Date().toISOString(), updatedBy: 'admin' };
    }
    app.updatedAt = new Date().toISOString();
    app.audit.push({ at: app.updatedAt, actor: 'admin', event: 'autofill_refreshed', detail: `Refreshed from org knowledge` });
    apps[index] = app;
    await setList(KEYS.grantApplications, apps);
    await addAudit('grant_app_autofill', 'admin', { appId });
    return sendJson(res, { ok: true, answers: app.answers });
  }

  if (action === 'grant-app-validate' && req.method === 'POST') {
    const payload = await readBody(req);
    const appId = clean(String(payload.id || ''), 80);
    if (!appId) return sendJson(res, { error: 'Application ID is required.' }, 422);
    const apps = await getList(KEYS.grantApplications);
    const index = apps.findIndex((a) => a.id === appId);
    if (index < 0) return sendJson(res, { error: 'Application not found.' }, 404);
    const app = apps[index];
    if (app.locked) return sendJson(res, { error: 'This application is submitted and locked.' }, 409);
    const orgRecords = await getList(KEYS.grantOrg);
    const profile = buildOrgProfile(Array.isArray(orgRecords) && orgRecords.length ? orgRecords[0] : null);
    validateApplication(app, profile);
    apps[index] = app;
    await setList(KEYS.grantApplications, apps);
    await addAudit('grant_app_validated', 'admin', { appId, status: app.validation?.status, errors: app.validation?.errors?.length || 0, warnings: app.validation?.warnings?.length || 0 });
    return sendJson(res, { validation: app.validation });
  }

  if (action === 'grant-app-submit' && req.method === 'POST') {
    const payload = await readBody(req);
    const appId = clean(String(payload.id || ''), 80);
    if (!appId) return sendJson(res, { error: 'Application ID is required.' }, 422);
    const apps = await getList(KEYS.grantApplications);
    const index = apps.findIndex((a) => a.id === appId);
    if (index < 0) return sendJson(res, { error: 'Application not found.' }, 404);
    const app = apps[index];
    if (app.locked) return sendJson(res, { error: 'This application is already submitted.' }, 409);
    try {
      const { application: submitted, snapshot } = markSubmitted(app, {
        date: payload.date,
        method: payload.method,
        reference: payload.reference,
        version: payload.version,
        portal: payload.portal,
        notes: payload.notes,
        followUpDate: payload.followUpDate,
        confirmHumanSubmission: payload.confirmHumanSubmission === true,
      }, 'admin');
      apps[index] = submitted;
      await setList(KEYS.grantApplications, apps);
      const subs = await getList(KEYS.grantSubmissions);
      subs.unshift(snapshot);
      await setList(KEYS.grantSubmissions, subs.slice(0, LIMITS.grantSubmissions));
      await addAudit('grant_app_submitted', 'admin', { appId, snapshotId: snapshot.id, date: snapshot.submission.date });
      return sendJson(res, { ok: true, application: { id: submitted.id, status: submitted.status, submissionSnapshotId: submitted.submissionSnapshotId } });
    } catch (error) {
      return sendJson(res, { error: error.message }, 422);
    }
  }

  // --- Submissions (§12 — immutable submitted-version records) ---
  if (action === 'grant-subs-list' && req.method === 'GET') {
    const subs = await getList(KEYS.grantSubmissions);
    const summary = subs.map((s) => ({
      id: s.id,
      applicationId: s.applicationId,
      opportunityId: s.opportunityId,
      title: s.title,
      submittedAt: s.submittedAt,
      submittedBy: s.submittedBy,
      submission: s.submission,
    }));
    return sendJson(res, { submissions: summary, total: summary.length });
  }

  if (action === 'grant-subs-get' && req.method === 'GET') {
    const id = clean(String(getParam(req, 'id') || ''), 80);
    if (!id) return sendJson(res, { error: 'Submission ID is required.' }, 422);
    const subs = await getList(KEYS.grantSubmissions);
    const sub = subs.find((s) => s.id === id);
    if (!sub) return sendJson(res, { error: 'Submission not found.' }, 404);
    return sendJson(res, { submission: sub });
  }

  return sendJson(res, { error: 'Unsupported action.' }, 404);
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
