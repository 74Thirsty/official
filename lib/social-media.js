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

function validHttpsUrl(value) {
  if (!value) return true;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

const PLATFORM_FIELDS = new Set([
  'displayName', 'name', 'handle', 'url', 'pageId', 'channelId', 'configuredPageUrl',
  'description', 'bio', 'website', 'publicContactEmail', 'tagline', 'organizationInfo',
  'profileImage', 'coverImage', 'bannerImage', 'watermarkImage', 'actionButton',
  'inviteUrl', 'serverName', 'rss', 'directories', 'links',
]);

function mergeObject(existing, patch) {
  const next = isPlainObject(existing) ? clone(existing) : {};
  for (const [key, value] of Object.entries(patch)) next[key] = clone(value);
  return next;
}

export function patchSocialMediaConfig(config, payload) {
  const base = clone(config);
  if (!isPlainObject(payload)) return { ok: false, error: 'Configuration update is missing.' };

  if (payload.scope === 'organization') {
    if (!isPlainObject(payload.changes)) return { ok: false, error: 'Organization changes are missing.' };
    const allowed = new Set(['name', 'website', 'publicEmail', 'phone', 'address', 'foundingDate', 'description', 'founderCEO', 'board']);
    for (const key of Object.keys(payload.changes)) {
      if (!allowed.has(key)) return { ok: false, error: `Organization field “${key}” cannot be changed here.` };
    }
    const changes = payload.changes;
    if (changes.website !== undefined && !validHttpsUrl(changes.website)) return { ok: false, error: 'Organization website must be a valid HTTPS URL.' };
    if (changes.publicEmail && !/^\S+@\S+\.\S+$/.test(changes.publicEmail)) return { ok: false, error: 'Public email must be a valid email address.' };
    if (changes.name !== undefined) base.organization.name = changes.name;
    if (changes.website !== undefined) base.organization.website = mergeObject(base.organization.website, { value: changes.website || null });
    if (changes.publicEmail !== undefined) {
      const emails = base.organization.contact.emails || [];
      const publicIndex = emails.findIndex((entry) => String(entry.purpose || '').toLowerCase().includes('public'));
      const entry = mergeObject(publicIndex >= 0 ? emails[publicIndex] : {}, { value: changes.publicEmail || null, purpose: 'General/public organizational inbox' });
      if (publicIndex >= 0) emails[publicIndex] = entry; else emails.push(entry);
      base.organization.contact.emails = emails;
    }
    if (changes.phone !== undefined) base.organization.contact.phone = mergeObject(base.organization.contact.phone, { value: changes.phone || null });
    if (changes.address !== undefined) base.organization.contact.address = mergeObject(base.organization.contact.address, { value: changes.address || null });
    if (changes.foundingDate !== undefined) base.organization.foundingDate = mergeObject(base.organization.foundingDate, { value: changes.foundingDate || null });
    if (changes.description !== undefined) base.organization.description = changes.description || null;
    if (changes.founderCEO !== undefined) base.governance.founderCEO = mergeObject(base.governance.founderCEO, { value: changes.founderCEO || null });
    if (changes.board !== undefined) base.governance.board = mergeObject(base.governance.board, { value: changes.board || null });
  } else if (payload.scope === 'platform') {
    const platform = String(payload.platform || '');
    const index = base.accounts.findIndex((account) => account.platform === platform);
    if (index < 0) return { ok: false, error: 'The selected social-media platform was not found.' };
    if (!isPlainObject(payload.changes)) return { ok: false, error: 'Platform changes are missing.' };
    for (const key of Object.keys(payload.changes)) {
      if (!PLATFORM_FIELDS.has(key)) return { ok: false, error: `The field “${key}” cannot be changed for this platform.` };
    }
    const changes = clone(payload.changes);
    for (const key of ['url', 'website', 'configuredPageUrl', 'inviteUrl', 'profileImage', 'coverImage', 'bannerImage', 'watermarkImage']) {
      if (changes[key] && !validHttpsUrl(changes[key])) return { ok: false, error: `${key === 'url' ? 'Profile URL' : key.replace(/([A-Z])/g, ' $1')} must be a valid HTTPS URL.` };
    }
    if (changes.publicContactEmail && !/^\S+@\S+\.\S+$/.test(changes.publicContactEmail)) return { ok: false, error: 'Public contact email must be a valid email address.' };
    if (changes.description && changes.description.length > 5000) return { ok: false, error: 'Description must be 5,000 characters or fewer.' };
    if (changes.links !== undefined) {
      if (!Array.isArray(changes.links)) return { ok: false, error: 'Channel links must be a list.' };
      for (let i = 0; i < changes.links.length; i++) {
        const link = changes.links[i];
        if (!link || !String(link.title || '').trim()) return { ok: false, error: `Website Link #${i + 1} is missing a display title.` };
        if (!link.url || !validHttpsUrl(String(link.url))) return { ok: false, error: `Website Link #${i + 1} must have a valid HTTPS URL.` };
      }
    }
    base.accounts[index] = { ...base.accounts[index], ...changes };
  } else {
    return { ok: false, error: 'Choose an organization or platform configuration to save.' };
  }
  return validateSocialMediaConfig(base);
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
