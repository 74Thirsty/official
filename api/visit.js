import { getList, setList, KEYS, LIMITS } from '../lib/storage.js';
import { sendJson, sendEmpty, readBody, clean, getClientIp, parseCookies, setCors } from '../lib/http.js';
import { geolocateIp } from '../lib/geo.js';
import { randomBytes } from 'crypto';

function makeVisitorId() {
  return randomBytes(24).toString('hex');
}

function visitorCookie(visitorId) {
  return 'llr_vid=' + visitorId + '; Path=/; SameSite=Lax; Secure; HttpOnly; Max-Age=31536000';
}

export default function handler(req, res) {
  if (req.method === 'OPTIONS') return sendEmpty(res);
  if (req.method !== 'POST') {
    return sendJson(res, { error: 'POST required.' }, 405);
  }

  readBody(req).then(async (payload) => {
    const ip = getClientIp(req);
    const geo = await geolocateIp(ip);

    const cookies = parseCookies(req);
    let visitorId = cookies.llr_vid;
    const isNewVisitor = !visitorId;
    if (isNewVisitor) {
      visitorId = makeVisitorId();
    }

    const entry = {
      timestamp: new Date().toISOString(),
      visitorId,
      ip,
      country: geo.country ?? 'N/A',
      region: geo.regionName ?? 'N/A',
      city: geo.city ?? 'N/A',
      latitude: geo.lat ?? 'N/A',
      longitude: geo.lon ?? 'N/A',
      isp: geo.isp ?? 'N/A',
      organization: geo.org ?? 'N/A',
      as: geo.as ?? 'N/A',
      proxy: geo.proxy ?? false,
      hosting: geo.hosting ?? false,
      userAgent: String(req.headers['user-agent'] || 'unknown'),
      language: String(req.headers['accept-language'] || 'unknown'),
      referrer: String(req.headers['referer'] || 'direct'),
      page: clean(payload.page, 300) || 'N/A',
      timezone: clean(payload.timezone, 80) || 'unknown',
      platform: clean(payload.platform, 120) || 'unknown',
      screen: clean(payload.screen, 80) || 'unknown',
      lang: clean(payload.lang, 80) || 'unknown',
      cookies: clean(payload.cookies, 20) || 'unknown',
      dnt: clean(payload.dnt, 20) || 'unknown',
    };

    const visitors = await getList(KEYS.visitors);
    visitors.unshift(entry);
    const trimmed = visitors.slice(0, LIMITS.visitors);
    await setList(KEYS.visitors, trimmed);

    setCors(res);
    res.setHeader('Set-Cookie', visitorCookie(visitorId));
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(201).send(JSON.stringify({ ok: true }));
  }).catch(() => sendJson(res, { error: 'Storage error.' }, 500));
}
