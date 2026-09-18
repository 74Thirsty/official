/**
 * @file        docs-auth.js
 * @description Document library authentication
 * @project     Lost Limb Riders (lostlimbriders.org)
 * @author      C. Hirschauer
 * @copyright   Copyright (c) 2026 C. Hirschauer. All rights reserved.
 * @license     Proprietary. No unauthorized reproduction or distribution.
 */
import { getList, KEYS } from '../lib/storage.js';
import { sendJson, sendEmpty, readBody, clean, timingSafeStrEqual } from '../lib/http.js';

export default function handler(req, res) {
  if (req.method === 'OPTIONS') return sendEmpty(res);
  if (req.method !== 'POST') return sendJson(res, { error: 'Method not allowed.' }, 405);

  readBody(req).then(async (payload) => {
    const name = clean(String(payload.name || ''), 60);
    const key = clean(String(payload.key || ''), 120);
    if (!name || !key) return sendJson(res, { error: 'Name and key are required.' }, 422);

    const users = await getList(KEYS.docsUsers);
    const directUser = (users || []).find(u => u && u.name && u.name.toLowerCase() === name.toLowerCase());
    if (directUser && timingSafeStrEqual(String(directUser.key || ''), key)) {
      return sendJson(res, { ok: true, name: directUser.name });
    }

    const adminKey = process.env.ADMIN_KEY || '';
    const adminFallback = name.toLowerCase() === 'admin' && adminKey && timingSafeStrEqual(adminKey, key);
    if (adminFallback) {
      return sendJson(res, { ok: true, name: 'admin' });
    }

    return sendJson(res, { error: 'Invalid credentials.' }, 403);
  }).catch(() => sendJson(res, { error: 'Storage error.' }, 500));
}
