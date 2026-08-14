import { escapeHtml } from './http.js';
import { newsletterTemplate, welcomeLetterHtml } from './seed.js';

const SITE_URL = 'https://lostlimbriders.org';

export function buildEbookUrl(token) {
  return SITE_URL + '/api/ebook?token=' + encodeURIComponent(token);
}

export function buildUnsubscribeUrl(token) {
  return SITE_URL + '/api/unsubscribe?token=' + encodeURIComponent(token);
}

const CAT_COLORS = {
  ride: '#22c55e',
  fundraiser: '#f59e0b',
  community: '#3b82f6',
  meeting: '#a855f7',
  rally: '#ef4444',
};

export function getUpcomingEvents(events, count = 8) {
  const today = new Date().toISOString().slice(0, 10);
  return events
    .filter((e) => (e.date || '') >= today)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .slice(0, count);
}

function buildEventsHtml(events) {
  if (!events.length) {
    return '<p style="color:#b7b7b7;font-style:italic;">No upcoming events right now. Stay tuned — something is always around the corner.</p>';
  }
  let html = '<div style="margin:20px 0;">';
  for (const ev of events) {
    const cat = ev.category || 'community';
    const color = CAT_COLORS[cat] || '#3b82f6';
    let dateStr = ev.date || '';
    if (ev.endDate && ev.endDate !== ev.date) {
      dateStr += ' — ' + ev.endDate;
    }
    html += '<div style="background:#171717;border-left:4px solid ' + color + ';padding:14px 18px;margin-bottom:12px;border-radius:6px;">';
    html += '<div style="font-weight:700;color:#fff;font-size:16px;">' + escapeHtml(ev.title || 'Untitled') + '</div>';
    html += '<div style="color:#b7b7b7;font-size:13px;margin-top:4px;">' + escapeHtml(dateStr);
    if (ev.time) html += ' · ' + escapeHtml(ev.time);
    if (ev.location) html += ' · ' + escapeHtml(ev.location);
    html += '</div>';
    if (ev.description) {
      const desc = escapeHtml(String(ev.description).slice(0, 150));
      html += '<div style="color:#999;font-size:13px;margin-top:6px;">' + desc + (String(ev.description).length > 150 ? '…' : '') + '</div>';
    }
    html += '</div>';
  }
  html += '</div>';
  return html;
}

export function buildNewsletter(userMessage, events, name = 'Rider', unsubUrl = SITE_URL + '/api/unsubscribe') {
  const now = new Date();
  const inTwoWeeks = new Date(now.getTime() + 14 * 86400000);
  const dateRange =
    now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' – ' +
    inTwoWeeks.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  let messageHtml =
    '<p>Here is your biweekly roundup from Lost Limb Riders. Grab your helmets and check out what is coming up.</p>';
  if (userMessage !== '') {
    messageHtml = '<p>' + escapeHtml(userMessage) + '</p>';
  }

  const safeName = escapeHtml(String(name || 'Rider').replace(/[<>]/g, '').trim() || 'Rider');

  const html = newsletterTemplate
    .replaceAll('{{DATE_RANGE}}', dateRange)
    .replaceAll('{{EVENTS_LIST}}', buildEventsHtml(events))
    .replaceAll('{{MESSAGE}}', messageHtml)
    .replaceAll('{{NAME}}', safeName)
    .replaceAll('{{UNSUBSCRIBE_LINK}}', escapeHtml(unsubUrl));

  return { html, dateRange, eventCount: events.length };
}

export function buildWelcomeEmail(subscriber) {
  const ebookUrl = buildEbookUrl(subscriber.ebookToken);
  const unsubUrl = buildUnsubscribeUrl(subscriber.unsubToken);

  const ebookLink =
    '<a href="' +
    escapeHtml(ebookUrl) +
    '" style="display:inline-block;background:#ff6a00;color:#fff;font-weight:800;font-size:14px;text-transform:uppercase;letter-spacing:.04em;text-decoration:none;padding:14px 36px;border-radius:8px;">' +
    'Download Your Free E-Book</a>';

  const html = welcomeLetterHtml
    .replaceAll('{{EBOOK_LINK}}', ebookLink)
    .replaceAll('{{UNSUBSCRIBE_LINK}}', escapeHtml(unsubUrl));

  return {
    html,
    subject: 'Welcome to the Lost Limb Riders Newsletter',
    ebookUrl,
    unsubUrl,
  };
}
