import { Redis } from '@upstash/redis';

const kv = Redis.fromEnv();

export const KEYS = {
  events: 'llr:events',
  eventIdeas: 'llr:event-ideas',
  stories: 'llr:stories',
  contentSettings: 'llr:content-settings',
  media: 'llr:media',
  mediaSeedRevision: 'llr:media-seed-revision',
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
  // Documentation access — list of authorized users for internal docs.
  docsUsers: 'llr:docs-users',
  documentState: 'llr:document-state',
  complianceState: 'llr:compliance-state',
  complianceTransactions: 'llr:compliance-transactions',
  socialMediaConfig: 'llr:social-media-config',
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
  docsUsers: 100,
  documentState: 500,
  complianceState: 200,
  complianceTransactions: 500,
  socialMediaConfig: 1,
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

export async function acquireLock(key, token, ttlSeconds = 15) {
  const result = await kv.set(key, token, { nx: true, ex: ttlSeconds });
  return result === 'OK';
}

export async function releaseLock(key, token) {
  await kv.eval(
    'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',
    [key],
    [token],
  );
}
