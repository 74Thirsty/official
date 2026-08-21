// KV-backed storage for platform stream keys saved from the admin panel.
//
// Stream keys remain secrets: they are write-only from the browser's point of
// view. This module stores them under llr:stream-keys and never returns them
// to an API response; consumers pass the map into lib/streamconfig.js
// platformStatuses(), which emits only sanitized availability.
//
// Precedence: a key saved here overrides the platform's environment variable
// (FB_STREAM_KEY etc.) until it is removed from KV.

import { getList, setList, KEYS, LIMITS } from './storage.js';
import { validateStreamKey } from './streamconfig.js';

function sanitizeEntries(entries) {
  return entries
    .filter((e) => e && typeof e === 'object' && typeof e.platform === 'string' && typeof e.key === 'string')
    .slice(0, LIMITS.streamKeys);
}

// Internal only: returns { [platform]: key } for panel-saved keys.
export async function getStoredStreamKeys() {
  const entries = await getList(KEYS.streamKeys);
  const map = {};
  for (const entry of entries) {
    if (entry && typeof entry.platform === 'string' && typeof entry.key === 'string') {
      map[entry.platform] = entry.key;
    }
  }
  return map;
}

// Internal only: upserts one platform key. Returns { ok } plus a validation
// status on failure; never echoes the key back.
export async function setStoredStreamKey(platform, key) {
  const validation = validateStreamKey(platform, key);
  if (!validation.available) return { ok: false, status: validation.status };
  const entries = sanitizeEntries(await getList(KEYS.streamKeys));
  const filtered = entries.filter((e) => e.platform !== platform);
  filtered.unshift({ platform, key: String(key).trim(), updatedAt: new Date().toISOString() });
  await setList(KEYS.streamKeys, filtered.slice(0, LIMITS.streamKeys));
  return { ok: true };
}
