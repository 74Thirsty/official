/**
 * @file        unsubscribe.js
 * @description Newsletter unsubscribe endpoint — tokenized opt-out
 * @project     Lost Limb Riders (lostlimbriders.org)
 * @author      C. Hirschauer
 * @copyright   Copyright (c) 2026 C. Hirschauer. All rights reserved.
 * @license     Proprietary. No unauthorized reproduction or distribution.
 */
import { getList, setList, KEYS } from '../lib/storage.js';
import { sendEmpty, sendHtml, getParam } from '../lib/http.js';
import { addAudit } from '../lib/audit.js';

const PAGE = (title, body) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin:0; padding:40px 20px; background:#050505; color:#fff; font-family:Arial,Helvetica,sans-serif; text-align:center; }
    .card { max-width:520px; margin:0 auto; background:#101010; border:1px solid rgba(255,255,255,.12); border-radius:16px; padding:36px 28px; }
    h1 { margin:0 0 12px; color:#ff6a00; font-size:24px; text-transform:uppercase; letter-spacing:.05em; }
    p { margin:10px 0; color:#d6d6d6; font-size:15px; line-height:1.6; }
    a { color:#ff6a00; font-weight:700; text-decoration:none; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    ${body}
  </div>
</body>
</html>`;

export default function handler(req, res) {
  if (req.method === 'OPTIONS') return sendEmpty(res);
  if (req.method !== 'GET') {
    return sendHtml(res, PAGE('Not Allowed', '<p>This page only accepts direct link clicks.</p>'), 405);
  }

  const token = getParam(req, 'token') || '';
  if (!token) {
    return sendHtml(res, PAGE('Unsubscribe Link Missing', '<p>This unsubscribe link is missing its token. Please use the link from your email.</p>'), 404);
  }

  getList(KEYS.subscribers).then(async (subs) => {
    const sub = subs.find((s) => s.unsubToken === token);
    if (!sub) {
      return sendHtml(res, PAGE('Link Not Found', '<p>This unsubscribe link is not valid. It may have been replaced by a newer link.</p>'), 404);
    }

    if ((sub.status ?? 'active') !== 'unsubscribed') {
      sub.status = 'unsubscribed';
      sub.unsubscribedAt = new Date().toISOString();
      await setList(KEYS.subscribers, subs);
      await addAudit('unsubscribe', sub.email, {});
    }

    return sendHtml(res, PAGE('You Are Unsubscribed', '<p>You have been removed from the Lost Limb Riders newsletter list. You will no longer receive newsletter emails.</p><p>You can re-subscribe any time at <a href="https://lostlimbriders.org">lostlimbriders.org</a>.</p>'));
  }).catch(() => sendHtml(res, PAGE('Something Went Wrong', '<p>Please try again.</p>'), 500));
}
