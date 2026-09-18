/**
 * @file        media.js
 * @description Media CRUD API — podcast, vlog, and Coffee Talk episode management
 * @project     Lost Limb Riders (lostlimbriders.org)
 * @author      C. Hirschauer
 * @copyright   Copyright (c) 2026 C. Hirschauer. All rights reserved.
 * @license     Proprietary. No unauthorized reproduction or distribution.
 */
import { getList, setList, getDate, setDate, KEYS } from '../lib/storage.js';
import { sendJson, sendEmpty, readBody, isAdmin, clean, getParam } from '../lib/http.js';
import { seedMedia } from '../lib/seed.js';

const TYPES = ['podcast', 'vlog', 'coffeetalk'];
const MEDIA_SEED_REVISION = '2026-09-12-video-2ZGgAKdnOXo';
const REQUIRED_SEED_IDS = ['md-v-07'];

const FIELDS = [
  ['type', 20],
  ['num', 10],
  ['season', 10],
  ['title', 300],
  ['date', 30],
  ['duration', 12],
  ['durationSec', 12],
  ['desc', 4000],
  ['audioUrl', 1000],
  ['videoId', 200],
  ['featured', 10],
];

export default function handler(req, res) {
  if (req.method === 'OPTIONS') return sendEmpty(res);

  const action = getParam(req, 'action') || 'list';

  if (action === 'podcast-rss') {
    return handlePodcastRss(req, res);
  }

  if (action === 'list') {
    getList(KEYS.media)
      .then(async (media) => {
        if (!media.length) {
          media = seedMedia;
          await setList(KEYS.media, media);
        }
        const appliedRevision = await getDate(KEYS.mediaSeedRevision);
        if (appliedRevision !== MEDIA_SEED_REVISION) {
          const existingIds = new Set(media.map((item) => item.id));
          const additions = seedMedia.filter((item) => REQUIRED_SEED_IDS.includes(item.id) && !existingIds.has(item.id));
          if (additions.length) {
            media = additions.concat(media);
            await setList(KEYS.media, media);
          }
          await setDate(KEYS.mediaSeedRevision, MEDIA_SEED_REVISION);
        }
        sendJson(res, { media });
      })
      .catch(() => sendJson(res, { error: 'Storage error.' }, 500));
    return;
  }

  if (!isAdmin(req)) {
    return sendJson(res, { error: 'Admin access required.' }, 403);
  }

  readBody(req).then(async (payload) => {
    if (action === 'add' && req.method === 'POST') {
      const type = clean(payload.type, 20);
      if (!TYPES.includes(type)) {
        return sendJson(res, { error: 'Type must be podcast, vlog, or coffeetalk.' }, 422);
      }
      const item = { id: 'md-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10) };
      for (const [field, limit] of FIELDS) {
        if (payload[field] !== undefined) {
          item[field] = clean(payload[field], limit);
        }
      }
      if (item.featured !== 'false' && item.featured !== '0') {
        item.featured = true;
      } else {
        item.featured = false;
      }
      if (!item.title) {
        return sendJson(res, { error: 'Title is required.' }, 422);
      }
      item.hasVideo = Boolean(item.videoId);
      item.createdAt = new Date().toISOString();
      const media = await getList(KEYS.media);
      media.unshift(item);
      await setList(KEYS.media, media);
      return sendJson(res, { item }, 201);
    }

    if (action === 'update' && req.method === 'POST') {
      const id = String(payload.id ?? '');
      if (!id) return sendJson(res, { error: 'Item ID required.' }, 422);

      const media = await getList(KEYS.media);
      const idx = media.findIndex((m) => m.id === id);
      if (idx === -1) return sendJson(res, { error: 'Item not found.' }, 404);

      for (const [field, limit] of FIELDS) {
        if (payload[field] !== undefined) {
          media[idx][field] = clean(payload[field], limit);
        }
      }
      if (payload.type !== undefined && !TYPES.includes(media[idx].type)) {
        return sendJson(res, { error: 'Type must be podcast, vlog, or coffeetalk.' }, 422);
      }
      media[idx].featured = !(media[idx].featured === 'false' || media[idx].featured === '0' || media[idx].featured === false);
      media[idx].hasVideo = Boolean(media[idx].videoId);
      media[idx].updatedAt = new Date().toISOString();
      await setList(KEYS.media, media);
      return sendJson(res, { item: media[idx] });
    }

    if (action === 'delete' && req.method === 'POST') {
      const id = String(payload.id ?? '');
      if (!id) return sendJson(res, { error: 'Item ID required.' }, 422);

      const media = await getList(KEYS.media);
      const filtered = media.filter((m) => m.id !== id);
      if (filtered.length === media.length) {
        return sendJson(res, { error: 'Item not found.' }, 404);
      }
      await setList(KEYS.media, filtered);
      return sendJson(res, { ok: true });
    }

    sendJson(res, { error: 'Unsupported action.' }, 404);
  }).catch(() => sendJson(res, { error: 'Storage error.' }, 500));
}

const PODCAST_TITLE = 'Lost Limb Riders Podcast';
const PODCAST_DESC = 'Real conversations about limb loss, recovery, purpose, and the open road. Hosted by John Thompson.';
const PODCAST_URL = 'https://lostlimbriders.org';
const ARTWORK_URL = PODCAST_URL + '/assets/LLR-COVER-PODCAST.png';
const PODCAST_AUTHOR = 'John Thompson';

function escapeXml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function handlePodcastRss(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');

  try {
    const list = await getList(KEYS.media);
    const podcasts = (Array.isArray(list) && list.length ? list : seedMedia)
      .filter((m) => m.type === 'podcast')
      .sort((a, b) => {
        const da = new Date(b.date || b.createdAt || 0);
        const db = new Date(a.date || a.createdAt || 0);
        return da - db;
      });

    const items = podcasts.map((ep, i) => {
      const pubDate = new Date(ep.createdAt || new Date()).toUTCString();
      const id = ep.id || `episode-${i + 1}`;
      const guid = `${PODCAST_URL}/media.html#${id}`;
      const duration = ep.durationSec || 0;
      const url = ep.audioUrl || `${PODCAST_URL}/api/media?action=podcast-rss#${id}`;
      const title = escapeXml(ep.title || `Episode ${ep.num || i + 1}`);
      const desc = escapeXml(ep.desc || PODCAST_DESC);
      const epNum = escapeXml(ep.num || String(i + 1));
      const season = escapeXml(ep.season || '1');

      return `    <item>
      <title>${title}</title>
      <guid>${guid}</guid>
      <link>${guid}</link>
      <pubDate>${pubDate}</pubDate>
      <itunes:episode>${epNum}</itunes:episode>
      <itunes:season>${season}</itunes:season>
      <description>${desc}</description>
      <enclosure url="${escapeXml(url)}" type="audio/mpeg" length="0" />
      <itunes:duration>${duration}</itunes:duration>
    </item>`;
    });

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://punkwood.com/2019/itunes-redirect.xml" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${PODCAST_TITLE}</title>
    <link>${PODCAST_URL}/media.html</link>
    <description>${PODCAST_DESC}</description>
    <language>en-us</language>
    <copyright>© 2026 ${PODCAST_AUTHOR}. All rights reserved.</copyright>
    <itunes:author>${PODCAST_AUTHOR}</itunes:author>
    <itunes:summary>${PODCAST_DESC}</itunes:summary>
    <itunes:image href="${ARTWORK_URL}" />
    <itunes:category text="Society & Culture" />
    <itunes:type>episodic</itunes:type>
    <image>
      <url>${ARTWORK_URL}</url>
      <title>${PODCAST_TITLE}</title>
      <link>${PODCAST_URL}/media.html</link>
    </image>
${items.length ? items.join('\n') : '    <!-- No episodes yet -->'}
  </channel>
</rss>`;

    res.status(200).send(rss);
  } catch (e) {
    res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Error</title><description>Failed to generate podcast feed.</description></channel></rss>');
  }
}
