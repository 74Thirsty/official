import { timingSafeEqual } from 'crypto';

const enc = new TextEncoder();

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

export function sendJson(res, payload, status = 200) {
  setCors(res);
  res.status(status).json(payload);
}

export function sendDownload(res, body, filename) {
  setCors(res);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(body);
}

export function sendEmpty(res, status = 204) {
  setCors(res);
  res.status(status).end();
}

export function sendRedirect(res, url, status = 302) {
  setCors(res);
  res.setHeader('Location', url);
  res.status(status).end();
}

export function sendHtml(res, html, status = 200) {
  setCors(res);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(status).send(html);
}

export async function readBody(req) {
  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length) {
    return req.body;
  }
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString('utf8');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getParam(req, name) {
  if (req.query && req.query[name] !== undefined) {
    return String(req.query[name]);
  }
  return new URL(req.url, 'http://localhost').searchParams.get(name);
}

export function getClientIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '');
  if (fwd) return fwd.split(',')[0].trim();
  return String(req.headers['x-real-ip'] || 'unknown');
}

export function timingSafeStrEqual(a, b) {
  const ba = enc.encode(String(a));
  const bb = enc.encode(String(b));
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function isAdmin(req) {
  const key = getParam(req, 'key') || String(req.headers['x-admin-key'] || '');
  const adminKey = process.env.ADMIN_KEY || '';
  return adminKey !== '' && timingSafeStrEqual(adminKey, key);
}

export function clean(value, limit) {
  let out = String(value ?? '')
    .replace(/<[^>]*>/g, '')
    .trim()
    .replace(/\s+/g, ' ');
  if (out.length > limit) out = out.slice(0, limit);
  return out;
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c]);
}
