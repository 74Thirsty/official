/**
 * @file        geo.js
 * @description IP geolocation — ip-api.com lookup with timeout and fallback
 * @project     Lost Limb Riders (lostlimbriders.org)
 * @author      C. Hirschauer
 * @copyright   Copyright (c) 2026 C. Hirschauer. All rights reserved.
 * @license     Proprietary. No unauthorized reproduction or distribution.
 */
const GEO_FIELDS = 'status,country,countryCode,regionName,city,lat,lon,timezone,isp,org,as,proxy,hosting';

export async function geolocateIp(ip) {
  const empty = { status: 'unavailable' };
  if (!ip || ip === 'unknown' || ip === '::1' || ip === '127.0.0.1') {
    return { ...empty, proxy: false, hosting: false };
  }
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=${GEO_FIELDS}`, {
      signal: AbortSignal.timeout(3000),
    });
    const data = await res.json();
    if (data && data.status === 'success') return data;
    return empty;
  } catch {
    return empty;
  }
}
