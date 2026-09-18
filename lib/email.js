/**
 * @file        email.js
 * @description Resend email sender wrapper
 * @project     Lost Limb Riders (lostlimbriders.org)
 * @author      C. Hirschauer
 * @copyright   Copyright (c) 2026 C. Hirschauer. All rights reserved.
 * @license     Proprietary. No unauthorized reproduction or distribution.
 */
export async function sendEmail(to, subject, html) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    return { ok: false, reason: 'missing_resend_config' };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    if (!res.ok) {
      let body = '';
      try { body = await res.text(); } catch {}
      let msg = `status_${res.status}`;
      try { const parsed = JSON.parse(body); msg = parsed.message || parsed.name || msg; } catch {}
      console.error('Resend send failed:', res.status, msg);
      return { ok: false, status: res.status, message: msg };
    }
    return { ok: true };
  } catch (err) {
    console.error('Resend fetch error:', err);
    return { ok: false, reason: 'network_error' };
  }
}
