import { Redis } from '@upstash/redis';

const kv = Redis.fromEnv();

export const KEYS = {
  events: 'llr:events',
  media: 'llr:media',
  subscribers: 'llr:subscribers',
  visitors: 'llr:visitors',
  guestbook: 'llr:guestbook',
  stream: 'llr:stream',
  streamArchive: 'llr:stream-archive',
  lastNewsletterSent: 'llr:last-newsletter-sent',
  audit: 'llr:audit',
};

export const LIMITS = {
  subscribers: 5000,
  guestbook: 500,
  visitors: 5000,
  streamArchive: 500,
  audit: 5000,
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
