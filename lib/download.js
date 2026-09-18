/**
 * @file        download.js
 * @description E-book delivery — presigned URLs or static fallback
 * @project     Lost Limb Riders (lostlimbriders.org)
 * @author      C. Hirschauer
 * @copyright   Copyright (c) 2026 C. Hirschauer. All rights reserved.
 * @license     Proprietary. No unauthorized reproduction or distribution.
 */
import { createHmac, createHash } from 'crypto';

function rfc3986(value) {
  return encodeURIComponent(String(value)).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function signKey(key, msg) {
  return createHmac('sha256', key).update(msg).digest();
}

function deriveSigningKey(secretKey, dateStamp, region, service) {
  const kDate = signKey(`AWS4${secretKey}`, dateStamp);
  const kRegion = signKey(kDate, region);
  const kService = signKey(kRegion, service);
  return signKey(kService, 'aws4_request');
}

export function presignUrl({ host, path, query = {}, region, service = 's3', accessKey, secretKey, expires = 120, amzDate = new Date() }) {
  const dateStr = amzDate.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const dateStamp = dateStr.slice(0, 8);

  const params = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKey}/${dateStamp}/${region}/${service}/aws4_request`,
    'X-Amz-Date': dateStr,
    'X-Amz-Expires': String(expires),
    'X-Amz-SignedHeaders': 'host',
    ...query,
  };

  const canonicalQuery = Object.keys(params)
    .sort()
    .map((k) => `${rfc3986(k)}=${rfc3986(params[k])}`)
    .join('&');

  const canonicalHeaders = `host:${host}\n`;
  const canonicalRequest = ['GET', path, canonicalQuery, canonicalHeaders, 'host', 'UNSIGNED-PAYLOAD'].join('\n');

  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', dateStr, scope, createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');

  const signingKey = deriveSigningKey(secretKey, dateStamp, region, service);
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  return `https://${host}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

export function presignConfig() {
  const endpoint = String(process.env.EBOOK_STORAGE_ENDPOINT || '').trim();
  const region = String(process.env.EBOOK_STORAGE_REGION || 'auto').trim();
  const bucket = String(process.env.EBOOK_STORAGE_BUCKET || '').trim();
  const key = String(process.env.EBOOK_STORAGE_KEY || '').trim();
  const accessKey = String(process.env.EBOOK_STORAGE_ACCESS_KEY || '').trim();
  const secretKey = String(process.env.EBOOK_STORAGE_SECRET_KEY || '').trim();
  const ttl = parseInt(process.env.EBOOK_PRESIGN_TTL || '120', 10) || 120;

  const missing = {};
  if (!endpoint) missing.endpoint = 'EBOOK_STORAGE_ENDPOINT';
  if (!bucket) missing.bucket = 'EBOOK_STORAGE_BUCKET';
  if (!key) missing.key = 'EBOOK_STORAGE_KEY';
  if (!accessKey) missing.accessKey = 'EBOOK_STORAGE_ACCESS_KEY';
  if (!secretKey) missing.secretKey = 'EBOOK_STORAGE_SECRET_KEY';

  return {
    configured: !Object.keys(missing).length,
    missing,
    endpoint,
    region,
    bucket,
    key,
    accessKey,
    secretKey,
    ttl,
  };
}

export function generateDownloadUrl() {
  const cfg = presignConfig();
  if (cfg.configured) {
    const hostBase = cfg.endpoint.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    const isAws = hostBase.includes('amazonaws.com');
    const host = isAws ? `${cfg.bucket}.${hostBase}` : hostBase;
    const keyPath = cfg.key.split('/').map((seg) => encodeURIComponent(seg)).join('/');
    const path = (isAws ? '' : `/${cfg.bucket}`) + `/${keyPath}`;
    return {
      ok: true,
      kind: 'presigned',
      url: presignUrl({
        host,
        path,
        region: cfg.region,
        accessKey: cfg.accessKey,
        secretKey: cfg.secretKey,
        expires: cfg.ttl,
      }),
    };
  }

  const staticUrl = process.env.EBOOK_DOWNLOAD_URL;
  if (staticUrl) {
    return { ok: true, kind: 'static', url: staticUrl };
  }

  const localStorage = process.env.EBOOK_STORAGE;
  if (localStorage) {
    return { ok: true, kind: 'local', url: 'https://lostlimbriders.org/api/ebook' };
  }

  return { ok: false, reason: 'no_download_target' };
}
