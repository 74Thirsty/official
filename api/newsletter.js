import { randomBytes } from 'crypto';
import { getList, setList, KEYS, LIMITS } from '../lib/storage.js';
import { sendJson, sendEmpty, readBody, clean, getClientIp, parseCookies } from '../lib/http.js';
import { geolocateIp } from '../lib/geo.js';
import { sendEmail } from '../lib/email.js';
import { buildWelcomeEmail } from '../lib/newsletter.js';
import { addAudit } from '../lib/audit.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function makeToken() {
  return randomBytes(24).toString('hex');
}

function buildProfile(req, payload, ip, geo) {
  const ua = String(req.headers['user-agent'] || 'unknown');
  const referer = String(req.headers['referer'] || 'direct');
  const lang = String(req.headers['accept-language'] || 'unknown');

  return {
    ip,
    geolocation: {
      country: geo.country ?? 'N/A',
      countryCode: geo.countryCode ?? 'N/A',
      region: geo.regionName ?? 'N/A',
      city: geo.city ?? 'N/A',
      latitude: geo.lat ?? 'N/A',
      longitude: geo.lon ?? 'N/A',
      timezone: geo.timezone ?? (clean(payload.timezone, 80) || 'N/A'),
      isp: geo.isp ?? 'N/A',
      organization: geo.org ?? 'N/A',
      as: geo.as ?? 'N/A',
      proxy: geo.proxy ?? false,
      hosting: geo.hosting ?? false,
    },
    network: {
      isp: geo.isp ?? 'N/A',
      organization: geo.org ?? 'N/A',
      as: geo.as ?? 'N/A',
      proxy: geo.proxy ?? false,
      hosting: geo.hosting ?? false,
    },
    browser: {
      userAgent: ua,
      language: lang,
      jsLang: clean(payload.lang, 80) || 'N/A',
      platform: clean(payload.platform, 120) || 'N/A',
      screen: clean(payload.screen, 80) || 'N/A',
      viewport: clean(payload.viewport, 80) || 'N/A',
      cookies: clean(payload.cookies, 20) || 'N/A',
      doNotTrack: clean(payload.dnt, 20) || 'N/A',
    },
    context: {
      landingPage: clean(payload.page, 300) || 'N/A',
      referrer: referer,
      sourceUrl: 'N/A',
    },
  };
}

function newSubscriber(payload, profile, visitorId) {
  const now = new Date().toISOString();
  const name = clean(payload.name, 120);
  const email = String(payload.email ?? '').trim().toLowerCase();
  return {
    name,
    email,
    visitorId: visitorId || null,
    signedAt: now,
    ...profile,
    status: 'active',
    signupSource: profile.context.landingPage,
    welcomeStatus: null,
    welcomeSentAt: null,
    welcomeError: null,
    welcomeResendCount: 0,
    ebookToken: makeToken(),
    ebookTokenIssuedAt: null,
    ebookLinkIssued: false,
    ebookTokenUsed: false,
    ebookAccessedAt: null,
    ebookDownloadCount: 0,
    unsubToken: makeToken(),
    unsubscribedAt: null,
    resubscribedAt: null,
  };
}

async function sendWelcome(sub, auditLog) {
  const { html, subject } = await buildWelcomeEmail(sub);
  const result = await sendEmail(sub.email, subject, html);
  if (result.ok) {
    sub.welcomeStatus = 'sent';
    sub.welcomeSentAt = new Date().toISOString();
    sub.welcomeError = null;
    sub.ebookLinkIssued = true;
    sub.ebookTokenIssuedAt = new Date().toISOString();
    auditLog('welcome_sent');
    return true;
  }
  sub.welcomeStatus = 'failed';
  sub.welcomeError = String(result.reason || `status_${result.status}`);
  sub.ebookLinkIssued = false;
  auditLog('welcome_failed');
  return false;
}

async function linkVisitor(sub) {
  if (!sub.visitorId) return 0;
  const visitors = await getList(KEYS.visitors);
  let matched = 0;
  const now = new Date().toISOString();
  for (const v of visitors) {
    if (v.visitorId && v.visitorId === sub.visitorId) {
      if (!v.email) v.email = sub.email;
      v.subscriberId = sub.email;
      v.signupName = sub.name || '';
      v.newsletterStatus = sub.status;
      v.signupTimestamp = sub.signedAt;
      if (!v.linkedAt) v.linkedAt = now;
      matched++;
    }
  }
  if (matched) {
    await setList(KEYS.visitors, visitors.slice(0, LIMITS.visitors));
  }
  return matched;
}

export default function handler(req, res) {
  if (req.method === 'OPTIONS') return sendEmpty(res);
  if (req.method !== 'POST') {
    return sendJson(res, { error: 'POST required.' }, 405);
  }

  readBody(req).then(async (payload) => {
    const name = clean(payload.name, 120);
    const email = String(payload.email ?? '').trim().toLowerCase();

    if (!name || !email || !EMAIL_RE.test(email)) {
      return sendJson(res, { error: 'Valid name and email are required.' }, 422);
    }

    const ip = getClientIp(req);
    const geo = await geolocateIp(ip);
    const visitorId = parseCookies(req).llr_vid || null;
    const profile = buildProfile(req, payload, ip, geo);

    const entries = await getList(KEYS.subscribers);
    const existing = entries.find((e) => e.email === email);

    if (existing && (existing.status ?? 'active') === 'active') {
      await addAudit('duplicate_signup', email, { source: profile.context.landingPage });
      return sendJson(res, { ok: true, message: 'You are already subscribed.' });
    }

    let sub;
    if (existing) {
      sub = { ...existing, ...profile, status: 'active', unsubscribedAt: null };
      sub.visitorId = visitorId || sub.visitorId || null;
      sub.signedAt = sub.signedAt || new Date().toISOString();
      sub.resubscribedAt = new Date().toISOString();
      sub.signupSource = profile.context.landingPage;
      sub.ebookToken = makeToken();
      sub.ebookTokenIssuedAt = null;
      sub.ebookLinkIssued = false;
      sub.ebookTokenUsed = false;
      sub.unsubToken = makeToken();
      sub.welcomeError = null;
    } else {
      sub = newSubscriber(payload, profile, visitorId);
    }

    const index = existing ? entries.indexOf(existing) : -1;
    if (index >= 0) entries[index] = sub;
    else entries.unshift(sub);
    await setList(KEYS.subscribers, entries.slice(0, LIMITS.subscribers));

    await addAudit(existing ? 'resubscribe' : 'signup', email, {
      source: sub.signupSource,
    });

    const welcomeOk = await sendWelcome(sub, (event) => addAudit(event, email));
    const savedIndex = entries.indexOf(sub);
    if (savedIndex >= 0) {
      entries[savedIndex] = sub;
      await setList(KEYS.subscribers, entries.slice(0, LIMITS.subscribers));
    }

    const linked = await linkVisitor(sub);
    if (linked) {
      await addAudit('visitor_linked', email, { visitorId: sub.visitorId, linkedRecords: linked });
    }

    return sendJson(res, {
      ok: true,
      message: welcomeOk
        ? 'Welcome to the ride. Check your email for the welcome letter and your free e-book.'
        : 'Welcome to the ride. You are subscribed.',
    }, 201);
  }).catch(() => sendJson(res, { error: 'Storage error.' }, 500));
}
