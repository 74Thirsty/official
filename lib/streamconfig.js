// Centralized streaming configuration/service layer.
//
// Stream keys are secrets. They are read only from the server environment
// (process.env) in this module and are never returned to the browser, written
// to storage, or logged. The browser only ever receives sanitized platform
// availability: { platform, label, available, status }.
//
// Environment-variable contract (stream keys — server-side only):
//   facebook -> FB_STREAM_KEY          (established credential, see .env.local)
//   youtube  -> YOUTUBE_STREAM_KEY
//   twitch   -> TWITCH_STREAM_KEY
//   owncast  -> OWNCAST_STREAM_KEY
//
// The live-status check credentials (YOUTUBE_API_KEY, FACEBOOK_ACCESS_TOKEN,
// TWITCH_CLIENT_ID, OWNCAST_URL, ...) are a separate concern handled by
// lib/platform.js and do not determine platform availability.

const PLATFORM_ORDER = ['youtube', 'facebook', 'twitch', 'owncast'];

const PLATFORM_CREDENTIALS = {
  youtube: { label: 'YouTube Live', env: 'YOUTUBE_STREAM_KEY', min: 20, charset: /^[A-Za-z0-9_-]+$/ },
  facebook: { label: 'Facebook Live', env: 'FB_STREAM_KEY', min: 20, charset: /^[A-Za-z0-9_-]+$/ },
  twitch: { label: 'Twitch', env: 'TWITCH_STREAM_KEY', min: 10, charset: /^[A-Za-z0-9_]+$/ },
  owncast: { label: 'Owncast', env: 'OWNCAST_STREAM_KEY', min: 10, charset: /^[A-Za-z0-9_-]+$/ },
};

export function streamKeyEnv(platform) {
  const spec = PLATFORM_CREDENTIALS[String(platform || '').toLowerCase()];
  return spec ? spec.env : '';
}

// Internal only: returns the secret stream key for a platform. Never return
// the result of this function from an API endpoint.
export function readStreamKey(platform) {
  const env = streamKeyEnv(platform);
  return env ? process.env[env] : '';
}

export function validateStreamKey(platform, value) {
  const spec = PLATFORM_CREDENTIALS[String(platform || '').toLowerCase()];
  if (!spec) return { platform, status: 'unsupported', available: false };
  const raw = value === undefined ? process.env[spec.env] : value;
  if (raw === undefined || raw === null) return { platform, status: 'missing', available: false };
  const str = String(raw);
  if (str.trim() === '') return { platform, status: 'empty', available: false };
  if (str.length < spec.min || /\s/.test(str) || !spec.charset.test(str)) {
    return { platform, status: 'malformed', available: false };
  }
  return { platform, status: 'valid', available: true };
}

export function validatePlatform(platform) {
  const spec = PLATFORM_CREDENTIALS[String(platform || '').toLowerCase()];
  if (!spec) return { platform, label: platform, status: 'unsupported', available: false };
  const result = validateStreamKey(platform);
  return { platform, label: spec.label, status: result.status, available: result.available };
}

// Sanitized list of platforms whose stream-key credentials are present and
// structurally valid. Never includes the credential itself.
export function availablePlatforms() {
  return PLATFORM_ORDER
    .map(validatePlatform)
    .filter((p) => p.available)
    .map(({ platform, label }) => ({ platform, label, available: true }));
}

// Full sanitized status for every known platform so the admin UI can render
// unconfigured platforms as greyed-out entries. storedKeys is an injectable
// map of { [platform]: key } for keys saved from the admin panel (KV-backed);
// a panel-saved key takes precedence over the environment variable.
// Never includes the credential itself.
export function platformStatuses(storedKeys) {
  const stored = storedKeys && typeof storedKeys === 'object' ? storedKeys : {};
  return PLATFORM_ORDER.map((platform) => {
    const spec = PLATFORM_CREDENTIALS[platform];
    if (Object.prototype.hasOwnProperty.call(stored, platform)) {
      if (validateStreamKey(platform, stored[platform]).available) {
        return { platform, label: spec.label, available: true, source: 'stored' };
      }
    }
    if (validateStreamKey(platform).available) {
      return { platform, label: spec.label, available: true, source: 'env' };
    }
    return { platform, label: spec.label, available: false, source: 'missing' };
  });
}

// Deep-removes streamKeyRef (env var names) from objects such as stream
// config or schedule payloads before they leave an API endpoint.
export function stripStreamKeyRefs(value) {
  if (Array.isArray(value)) return value.map(stripStreamKeyRefs);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (key === 'streamKeyRef') continue;
      out[key] = stripStreamKeyRefs(val);
    }
    return out;
  }
  return value;
}
