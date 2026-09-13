import { readFileSync } from 'node:fs';

const sourceUrl = new URL('../SOCIAL_MEDIA.json', import.meta.url);
const sourceConfig = JSON.parse(readFileSync(sourceUrl, 'utf8'));
const REQUIRED_SECTIONS = ['sourceProvenance', 'organization', 'accounts', 'organizationProfile', 'governance', 'metadata'];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function initialSocialMediaConfig() {
  return clone(sourceConfig);
}

export function validateSocialMediaConfig(config) {
  if (!isPlainObject(config)) return { ok: false, error: 'Social-media configuration must be a JSON object.' };
  if (!Number.isInteger(config.schema_version) || config.schema_version < 1) {
    return { ok: false, error: 'schema_version must be a positive integer.' };
  }
  for (const section of REQUIRED_SECTIONS) {
    const valid = section === 'accounts' ? Array.isArray(config[section]) : isPlainObject(config[section]);
    if (!valid) return { ok: false, error: `${section} has an invalid type.` };
  }
  if (!config.accounts.length) return { ok: false, error: 'At least one social-media account is required.' };

  const allowedStatuses = config.metadata.allowedStatuses;
  if (!Array.isArray(allowedStatuses) || !allowedStatuses.length || allowedStatuses.some((status) => typeof status !== 'string' || !status.trim())) {
    return { ok: false, error: 'metadata.allowedStatuses must be a non-empty string array.' };
  }

  const platforms = new Set();
  for (const account of config.accounts) {
    if (!isPlainObject(account)) return { ok: false, error: 'Every account must be an object.' };
    const platform = typeof account.platform === 'string' ? account.platform.trim() : '';
    if (!platform) return { ok: false, error: 'Every account requires a platform.' };
    if (platforms.has(platform)) return { ok: false, error: `Duplicate platform: ${platform}.` };
    platforms.add(platform);
    if (typeof account.status !== 'string' || !allowedStatuses.includes(account.status)) {
      return { ok: false, error: `Invalid status for ${platform}.` };
    }
  }

  let serialized;
  try {
    serialized = JSON.stringify(config);
  } catch {
    return { ok: false, error: 'Configuration must contain JSON-compatible values only.' };
  }
  if (Buffer.byteLength(serialized, 'utf8') > 100_000) {
    return { ok: false, error: 'Social-media configuration exceeds 100 KB.' };
  }
  return { ok: true, config: clone(config) };
}
