import { getList, setList, getDate, setDate, KEYS, LIMITS } from '../lib/storage.js';
import { sendJson, sendEmpty, readBody, isAdmin, clean, getParam } from '../lib/http.js';
import { buildNewsletter, getUpcomingEvents, getUpcomingStreams, buildWelcomeEmail, buildUnsubscribeUrl, signedCopyAvailable } from '../lib/newsletter.js';
import { sendEmail } from '../lib/email.js';
import { addAudit } from '../lib/audit.js';
import { randomBytes } from 'crypto';
import { createHmac, scryptSync, timingSafeEqual } from 'crypto';
import { parseBrowser } from '../lib/ua.js';
import { facebookDetectionConfigured } from '../lib/stream.js';
import { computeVisitorStats } from '../lib/visitor-stats.js';
import { aiConfigured, generateJson } from '../lib/ai.js';
import { notifyOwner } from '../lib/notify.js';
import { normalizeIdeaPayload, validateIdea } from '../lib/event-model.js';
import { normalizeStoryMeta, wordCount, buildHistorySummary, similarityFlags } from '../lib/story-model.js';
import { buildStoryPrompt, buildIdeasPrompt, parseStoryResponse, parseIdeasResponse, pickSurpriseParams } from '../lib/generation.js';
import { getAccessibleDocuments, findDocumentByCode, getDocumentIntegrity, DOCUMENT_SOURCE_REVISION } from '../lib/document-registry.js';
import { expandDocument } from '../lib/document-references.js';
import { COMPLIANCE_WORKFLOWS, getComplianceWorkflow, publicWorkflow, createComplianceTransaction, addComplianceEvidence, approveComplianceRequirement, advanceComplianceTransaction } from '../lib/compliance-engine.js';

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
  if (!isAdmin(req)) {
    return sendJson(res, { error: 'Admin access required.' }, 403);
  }

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

function complianceSummary(transaction, workflow) {
  const completed = transaction.requirements.filter((requirement) => requirement.status === 'complete').length;
  return {
    ...transaction,
    workflow: publicWorkflow(workflow),
    progress: { completed, total: transaction.requirements.length },
  };
}

async function handleCompliance(req, res, action) {
  const session = await activeDocsSession(req);
  if (!session) return sendJson(res, { error: 'Document access required.' }, 403);

  if (action === 'compliance-workflows' && req.method === 'GET') {
    return sendJson(res, {
      workflows: COMPLIANCE_WORKFLOWS.map(publicWorkflow),
      source: { document_id: 'ADM-REF-002', revision: DOCUMENT_SOURCE_REVISION },
    });
  }

  const transactions = await getList(KEYS.complianceTransactions);
  if (action === 'compliance-list' && req.method === 'GET') {
    return sendJson(res, {
      transactions: transactions.map((transaction) => {
        const workflow = getComplianceWorkflow(transaction.workflow_id);
        return workflow ? complianceSummary(transaction, workflow) : { ...transaction, workflow: null };
      }),
    });
  }

  if (action === 'compliance-create' && req.method === 'POST') {
    const payload = await readBody(req);
    const workflow = getComplianceWorkflow(clean(String(payload.workflow_id || ''), 100));
    const title = clean(String(payload.title || ''), 140);
    const responsiblePerson = clean(String(payload.responsible_person || ''), 80);
    const counterparty = clean(String(payload.counterparty || ''), 120);
    const amount = payload.amount === '' || payload.amount == null ? null : Number(payload.amount);
    if (!workflow) return sendJson(res, { error: 'Controlled workflow not found.' }, 404);
    if (!title || !responsiblePerson) return sendJson(res, { error: 'Title and responsible person are required.' }, 422);
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) return sendJson(res, { error: 'Amount must be a non-negative number.' }, 422);
    const transaction = createComplianceTransaction(workflow, { title, responsible_person: responsiblePerson, counterparty, amount }, session.name);
    transactions.unshift(transaction);
    await setList(KEYS.complianceTransactions, transactions.slice(0, LIMITS.complianceTransactions));
    await addAudit('compliance_transaction_created', session.name, { transactionId: transaction.id, workflowId: workflow.id });
    return sendJson(res, { transaction: complianceSummary(transaction, workflow) }, 201);
  }

  const payload = req.method === 'POST' ? await readBody(req) : {};
  const id = clean(String(payload.transaction_id || getParam(req, 'id') || ''), 80);
  const index = transactions.findIndex((transaction) => transaction.id === id);
  if (index < 0) return sendJson(res, { error: 'Compliance transaction not found.' }, 404);
  const transaction = transactions[index];
  const workflow = getComplianceWorkflow(transaction.workflow_id);
  if (!workflow) return sendJson(res, { error: 'Controlled workflow is unavailable.' }, 409);

  if (action === 'compliance-detail' && req.method === 'GET') {
    return sendJson(res, { transaction: complianceSummary(transaction, workflow) });
  }

  try {
    if (action === 'compliance-evidence' && req.method === 'POST') {
      const stageId = clean(String(payload.stage_id || ''), 120);
      const description = clean(String(payload.description || ''), 1000);
      const url = clean(String(payload.url || ''), 500);
      if (!description) return sendJson(res, { error: 'Evidence description is required.' }, 422);
      if (url && !/^https:\/\//i.test(url)) return sendJson(res, { error: 'Evidence URL must use HTTPS.' }, 422);
      addComplianceEvidence(transaction, workflow, stageId, { description, url }, session.name);
      await addAudit('compliance_evidence_added', session.name, { transactionId: id, stageId });
    } else if (action === 'compliance-approve' && req.method === 'POST') {
      if (session.role !== 'admin') return sendJson(res, { error: 'Administrator approval required.' }, 403);
      const stageId = clean(String(payload.stage_id || ''), 120);
      const approvalRuleId = clean(String(payload.approval_rule_id || ''), 120);
      approveComplianceRequirement(transaction, workflow, stageId, session.name, approvalRuleId);
      await addAudit('compliance_requirement_approved', session.name, { transactionId: id, stageId });
    } else if (action === 'compliance-advance' && req.method === 'POST') {
      advanceComplianceTransaction(transaction, workflow, session.name);
      await addAudit('compliance_transaction_advanced', session.name, { transactionId: id, stage: transaction.current_stage, status: transaction.status });
    } else {
      return sendJson(res, { error: 'Unsupported action.' }, 404);
    }
  } catch (error) {
    return sendJson(res, { error: error.message }, 409);
  }

  transactions[index] = transaction;
  await setList(KEYS.complianceTransactions, transactions);
  return sendJson(res, { transaction: complianceSummary(transaction, workflow) });
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
