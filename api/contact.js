import { sendJson, sendEmpty, readBody, clean, escapeHtml } from '../lib/http.js';

const RECIPIENT = 'john.thompson@lostlimbriders.org';
const MAX_ATTACHMENT_MB = 3;
const MAX_ATTACHMENT_BYTES = MAX_ATTACHMENT_MB * 1024 * 1024;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function handler(req, res) {
  if (req.method === 'OPTIONS') return sendEmpty(res);
  if (req.method !== 'POST') {
    return sendJson(res, { error: 'POST required.' }, 405);
  }

  readBody(req).then(async (payload) => {
    const website = String(payload.website ?? '').trim();
    if (website) {
      return sendJson(res, { ok: true });
    }

    const name = clean(payload.name, 120);
    const email = String(payload.email ?? '').trim().toLowerCase();
    const phone = clean(payload.phone, 40);
    const subject = clean(payload.subject, 150);
    const message = String(payload.message ?? '').trim();

    if (!name || !EMAIL_RE.test(email)) {
      return sendJson(res, { error: 'A valid name and email are required.' }, 422);
    }
    if (!subject) {
      return sendJson(res, { error: 'A subject is required.' }, 422);
    }
    if (!message) {
      return sendJson(res, { error: 'A message is required.' }, 422);
    }

    let attachment = null;
    if (payload.attachment) {
      const content = String(payload.attachment.content ?? '');
      if (!content) {
        return sendJson(res, { error: 'Attachment is missing file data.' }, 422);
      }
      const bytes = Math.ceil((content.length * 3) / 4);
      if (bytes > MAX_ATTACHMENT_BYTES) {
        return sendJson(res, { error: `Attachments must be under ${MAX_ATTACHMENT_MB} MB.` }, 422);
      }
      attachment = {
        filename: String(payload.attachment.filename || 'attachment'),
        content,
        content_type: String(payload.attachment.contentType || 'application/octet-stream'),
      };
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM;
    if (!apiKey || !from) {
      return sendJson(res, { error: 'Contact form is not configured on the server.' }, 500);
    }

    const html = [
      `<p><strong>Name:</strong> ${escapeHtml(name)}</p>`,
      `<p><strong>Email:</strong> ${escapeHtml(email)}</p>`,
      phone ? `<p><strong>Phone:</strong> ${escapeHtml(phone)}</p>` : '',
      `<p><strong>Subject:</strong> ${escapeHtml(subject)}</p>`,
      `<hr>`,
      `<p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>`
    ].join('\n');

    const text = `Name: ${name}\nEmail: ${email}\nPhone: ${phone || 'not provided'}\nSubject: ${subject}\n\n${message}`;

    const emailPayload = {
      from,
      to: [RECIPIENT],
      reply_to: email,
      subject: `[Lost Limb Riders Contact] ${subject}`,
      text,
      html
    };
    if (attachment) emailPayload.attachments = [attachment];

    try {
      const apiRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(emailPayload)
      });
      if (apiRes.ok) {
        return sendJson(res, { ok: true, message: 'Message sent. Thank you for reaching out.' }, 201);
      }
      console.error('Resend send failed:', apiRes.status, await apiRes.text());
      return sendJson(res, { error: 'The message could not be sent. Please try again.' }, 502);
    } catch (err) {
      console.error('Resend fetch error:', err);
      return sendJson(res, { error: 'The message could not be sent. Please try again.' }, 502);
    }
  }).catch(() => sendJson(res, { error: 'Server error.' }, 500));
}
