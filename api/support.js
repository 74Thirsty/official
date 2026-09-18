/**
 * @file        support.js
 * @description Support/donations endpoint
 * @project     Lost Limb Riders (lostlimbriders.org)
 * @author      C. Hirschauer
 * @copyright   Copyright (c) 2026 C. Hirschauer. All rights reserved.
 * @license     Proprietary. No unauthorized reproduction or distribution.
 */
import { sendJson, sendEmpty, readBody, clean, escapeHtml, getParam } from '../lib/http.js';

const RECIPIENT = 'john.thompson@lostlimbriders.org';
const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function paypalDonationUrl() {
  const value = String(process.env.PAYPAL_DONATION_URL || '').trim();
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || !(host === 'paypal.com' || host.endsWith('.paypal.com') || host === 'paypal.me' || host.endsWith('.paypal.me'))) return '';
    return url.href;
  } catch {
    return '';
  }
}

async function handleContact(res, payload) {
  if (String(payload.website ?? '').trim()) return sendJson(res, { ok: true });
  const name = clean(payload.name, 120);
  const email = String(payload.email ?? '').trim().toLowerCase();
  const phone = clean(payload.phone, 40);
  const subject = clean(payload.subject, 150);
  const message = String(payload.message ?? '').trim();
  if (!name || !EMAIL_RE.test(email)) return sendJson(res, { error: 'A valid name and email are required.' }, 422);
  if (!subject) return sendJson(res, { error: 'A subject is required.' }, 422);
  if (!message) return sendJson(res, { error: 'A message is required.' }, 422);

  let attachment = null;
  if (payload.attachment) {
    const content = String(payload.attachment.content ?? '');
    if (!content) return sendJson(res, { error: 'Attachment is missing file data.' }, 422);
    if (Math.ceil((content.length * 3) / 4) > MAX_ATTACHMENT_BYTES) return sendJson(res, { error: 'Attachments must be under 3 MB.' }, 422);
    attachment = {
      filename: String(payload.attachment.filename || 'attachment'),
      content,
      content_type: String(payload.attachment.contentType || 'application/octet-stream'),
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) return sendJson(res, { error: 'Contact form is not configured on the server.' }, 500);
  const html = [
    `<p><strong>Name:</strong> ${escapeHtml(name)}</p>`, `<p><strong>Email:</strong> ${escapeHtml(email)}</p>`,
    phone ? `<p><strong>Phone:</strong> ${escapeHtml(phone)}</p>` : '', `<p><strong>Subject:</strong> ${escapeHtml(subject)}</p>`,
    '<hr>', `<p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>`,
  ].join('\n');
  const emailPayload = {
    from, to: [RECIPIENT], reply_to: email, subject: `[Lost Limb Riders Contact] ${subject}`,
    text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone || 'not provided'}\nSubject: ${subject}\n\n${message}`, html,
  };
  if (attachment) emailPayload.attachments = [attachment];
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(emailPayload),
    });
    if (response.ok) return sendJson(res, { ok: true, message: 'Message sent. Thank you for reaching out.' }, 201);
    console.error('Resend send failed:', response.status, await response.text());
  } catch (error) {
    console.error('Resend fetch error:', error instanceof Error ? error.message : 'unknown_error');
  }
  return sendJson(res, { error: 'The message could not be sent. Please try again.' }, 502);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendEmpty(res);
  const action = getParam(req, 'action') || 'contact';
  if (action === 'paypal-config') {
    if (req.method !== 'GET') return sendJson(res, { error: 'GET required.' }, 405);
    const donationUrl = paypalDonationUrl();
    return sendJson(res, { configured: Boolean(donationUrl), donationUrl });
  }
  if (req.method !== 'POST') return sendJson(res, { error: 'POST required.' }, 405);
  const payload = await readBody(req);
  try {
    if (action === 'contact') return await handleContact(res, payload);
    return sendJson(res, { error: 'Unsupported support action.' }, 404);
  } catch (error) {
    console.error('Support API error:', error instanceof Error ? error.message : 'unknown_error');
    return sendJson(res, { error: 'The request could not be completed. Please try again.' }, 502);
  }
}
