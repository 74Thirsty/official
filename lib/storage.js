import { Redis } from '@upstash/redis';

const kv = Redis.fromEnv();

export const KEYS = {
  events: 'llr:events',
  eventIdeas: 'llr:event-ideas',
  stories: 'llr:stories',
  contentSettings: 'llr:content-settings',
  media: 'llr:media',
  subscribers: 'llr:subscribers',
  visitors: 'llr:visitors',
  guestbook: 'llr:guestbook',
  stream: 'llr:stream',
  fbLiveCache: 'llr:fb-live-cache',
  lastNewsletterSent: 'llr:last-newsletter-sent',
  audit: 'llr:audit',
  galleryPending: 'llr:gallery-pending',
  galleryApproved: 'llr:gallery-approved',
  testimonials: 'llr:testimonials',
  comments: 'llr:comments',
  broadcastAlerts: 'llr:broadcast-alerts',
  sponsors: 'llr:sponsors',
  sponsorLevels: 'llr:sponsor-levels',
  // Documentation database registry (source of truth remains the repo/submodule).
  docsRegistry: 'llr:docs:registry',       // list of document records
  docsById: 'llr:docs:by-id',              // map documentId -> record path
  docsByType: 'llr:docs:by-type',          // map type -> [documentId]
  docsByDept: 'llr:docs:by-dept',          // map dept -> [documentId]
  docsByStatus: 'llr:docs:by-status',      // map status -> [documentId]
  docsIntegrity: 'llr:docs:integrity',     // list of integrity findings
  docsSyncState: 'llr:docs:sync',          // last sync metadata (commit, indexedAt, hashes)
  docsAudit: 'llr:docs:audit',             // documentation admin action log
  docsIndex: 'llr:docs:index',             // search index (token -> [documentId])
};

export const LIMITS = {
  subscribers: 5000,
  guestbook: 500,
  visitors: 5000,
  audit: 5000,
  galleryPending: 200,
  galleryApproved: 500,
  testimonials: 500,
  comments: 2000,
  broadcastAlerts: 5000,
  sponsors: 200,
  sponsorLevels: 24,
  eventIdeas: 200,
  stories: 500,
  docsIntegrity: 5000,
  docsAudit: 5000,
};

export async function getList(key) {
  const value = await kv.get(key);
  return Array.isArray(value) ? value : [];
}

export async function setList(key, list) {
  await kv.set(key, list);
}

export async function getDate(key) {
  const value = await kv.get(key);
  return typeof value === 'string' ? value : '';
}

export async function setDate(key, iso) {
  await kv.set(key, iso);
}
