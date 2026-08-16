// Centralized streaming configuration/service layer.
//
// Stream keys are secrets. They are read only from the server environment
// (process.env) in this module and are never returned to the browser, written
// to storage, or logged. The browser only ever receives sanitized platform
// availability: { platform, label, available, status }.

const PLATFORM_ORDER = ['youtube', 'facebook', 'twitch', 'owncast'];

const PLATFORM_CREDENTIALS = {
  youtube: { label: 'YouTube Live', env: 'YOUTUBE_STREAM_KEY', min: 20, charset: /^[A-Za-z0-9_-]+$/ },
  facebook: { label: 'Facebook Live', env: 'FACEBOOK_STREAM_KEY', min: 20, charset: /^[A-Za-z0-9_-]+$/ },
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
