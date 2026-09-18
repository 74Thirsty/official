/**
 * @file        newsletter.js
 * @description Newsletter builder — event list HTML, date ranges, template interpolation
 * @project     Lost Limb Riders (lostlimbriders.org)
 * @author      C. Hirschauer
 * @copyright   Copyright (c) 2026 C. Hirschauer. All rights reserved.
 * @license     Proprietary. No unauthorized reproduction or distribution.
 */
import { escapeHtml } from './http.js';
import { newsletterTemplate } from './seed.js';
import { generateDownloadUrl } from './download.js';
import { renderWelcomeEmail } from './welcome.js';
import { renderStoryWithDisclosure } from './story-model.js';

const SITE_URL = 'https://lostlimbriders.org';

const DAY_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function signedCopyAvailable() {
  if (process.env.EBOOK_SIGNED !== '1') return false;
  return generateDownloadUrl().ok === true;
}

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

export function getUpcomingStreams(schedule, count = 6) {
  if (!Array.isArray(schedule)) return [];
  const today = new Date().toISOString().slice(0, 10);

  const dated = schedule
    .filter((s) => !s.recurring && s.date && s.date >= today)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const recurring = schedule
    .filter((s) => s.recurring)
    .sort((a, b) => {
      const d = DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day);
      return d !== 0 ? d : String(a.time || '').localeCompare(String(b.time || ''));
    });

  return dated.concat(recurring).slice(0, count);
}

function formatTime(time) {
  if (!time) return '';
  const [h, m] = String(time).split(':').map((n) => parseInt(n, 10));
  if (Number.isNaN(h)) return String(time);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  const minute = m && !Number.isNaN(m) ? `:${String(m).padStart(2, '0')}` : '';
  return `${hour}${minute} ${period}`;
}

function buildStreamsHtml(streams) {
  if (!streams.length) {
    return '<p style="color:#b7b7b7;font-style:italic;">No live streams scheduled right now. Follow us on Facebook and YouTube so you never miss when the cameras roll.</p>';
  }
  let html = '<div style="margin:20px 0;">';
  for (const s of streams) {
    const modeLabel = s.mode === 'prerecorded' ? 'Scheduled · Prerecorded Broadcast' : 'Live · Real-Time';
    const modeColor = s.mode === 'prerecorded' ? '#fcd34d' : '#ff6a00';
    html += '<div style="background:#171717;border-left:4px solid ' + modeColor + ';padding:14px 18px;margin-bottom:12px;border-radius:6px;">';
    html += '<div style="font-weight:700;color:#fff;font-size:16px;">' + escapeHtml(s.title || 'Lost Limb Riders Live') + '</div>';
    html += '<div style="color:' + modeColor + ';font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;margin-top:4px;">' + modeLabel + '</div>';
    html += '<div style="color:#b7b7b7;font-size:13px;margin-top:4px;">';
    if (s.date) {
      const d = new Date(s.date + 'T00:00:00');
      html += escapeHtml(d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }));
    } else if (s.recurring && s.day) {
      html += escapeHtml('Every ' + s.day);
    }
    if (s.time) html += ' · ' + escapeHtml(formatTime(s.time));
    html += '</div>';
    if (s.featuredTopic) {
      html += '<div style="color:#999;font-size:13px;margin-top:4px;">Featured: ' + escapeHtml(String(s.featuredTopic).slice(0, 140)) + '</div>';
    }
    if (s.description) {
      html += '<div style="color:#999;font-size:13px;margin-top:6px;">' + escapeHtml(String(s.description).slice(0, 180)) + '</div>';
    }
    html += '</div>';
  }
  html += '</div>';
  return html;
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

function buildMerchHtml(merchItems) {
  if (!merchItems || !merchItems.length) {
    return '';
  }
  let html = '<div style="margin:20px 0;">';
  html += '<div style="background:linear-gradient(135deg,#1a110c,#171717);border:1px solid rgba(255,106,0,.3);border-radius:10px;padding:20px;text-align:center;">';
  html += '<div style="color:#ff6a00;font-size:11px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;margin-bottom:10px;">Official Apparel</div>';
  html += '<div style="color:#fff;font-size:18px;font-weight:800;margin-bottom:14px;">Wear the Mission</div>';
  for (const item of merchItems) {
    html += '<div style="background:#0d0d0d;border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:14px;margin-bottom:10px;text-align:left;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">';
    html += '<div>';
    html += '<div style="font-weight:700;color:#fff;font-size:15px;">' + escapeHtml(item.name) + '</div>';
    if (item.description) {
      html += '<div style="color:#999;font-size:13px;margin-top:2px;">' + escapeHtml(String(item.description).slice(0, 100)) + '</div>';
    }
    html += '</div>';
    html += '<div style="text-align:right;flex-shrink:0;">';
    if (item.price) {
      html += '<div style="color:#ff6a00;font-size:18px;font-weight:900;">$' + escapeHtml(String(item.price)) + '</div>';
    }
    if (item.paypalUrl) {
      html += '<a href="' + escapeHtml(item.paypalUrl) + '" target="_blank" rel="noopener" style="display:inline-block;margin-top:6px;background:#ff6a00;color:#111;font-weight:800;font-size:11px;text-transform:uppercase;letter-spacing:.04em;text-decoration:none;padding:7px 14px;border-radius:6px;">Shop Now</a>';
    }
    html += '</div>';
    html += '</div>';
    html += '</div>';
  }
  html += '<div style="text-align:center;margin-top:12px;"><a href="https://lostlimbriders.org/shop.html" style="color:#ff6a00;font-weight:700;font-size:13px;text-decoration:none;">View All Official Apparel &rarr;</a></div>';
  html += '</div>';
  html += '</div>';
  return html;
}

export function buildNewsletter(userMessage, events, streams = [], name = 'Rider', unsubUrl = SITE_URL + '/api/unsubscribe', story = null, merchItems = []) {
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

  let storyHtml = '';
  if (story && story.title && story.text) {
    storyHtml = renderStoryWithDisclosure(story);
  }

  const html = newsletterTemplate
    .replaceAll('{{DATE_RANGE}}', dateRange)
    .replaceAll('{{EVENTS_LIST}}', buildEventsHtml(events))
    .replaceAll('{{STREAMS_LIST}}', buildStreamsHtml(streams))
    .replaceAll('{{STORY_SECTION}}', storyHtml)
    .replaceAll('{{MERCH_SECTION}}', buildMerchHtml(merchItems))
    .replaceAll('{{MESSAGE}}', messageHtml)
    .replaceAll('{{NAME}}', safeName)
    .replaceAll('{{UNSUBSCRIBE_LINK}}', escapeHtml(unsubUrl));

  return { html, dateRange, eventCount: events.length, streamCount: streams.length };
}

export async function buildWelcomeEmail(subscriber) {
  const ebookUrl = buildEbookUrl(subscriber.ebookToken);
  const unsubUrl = buildUnsubscribeUrl(subscriber.unsubToken);
  const html = await renderWelcomeEmail(ebookUrl, unsubUrl);

  return {
    html,
    subject: 'Welcome to the Lost Limb Riders Newsletter',
    ebookUrl,
    unsubUrl,
  };
}
