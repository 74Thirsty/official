/**
 * @file        ua.js
 * @description User-agent parser — extracts browser name from request headers
 * @project     Lost Limb Riders (lostlimbriders.org)
 * @author      C. Hirschauer
 * @copyright   Copyright (c) 2026 C. Hirschauer. All rights reserved.
 * @license     Proprietary. No unauthorized reproduction or distribution.
 */
export function parseBrowser(ua) {
  const u = String(ua || '').toLowerCase();
  if (u.includes('edg')) return 'Edge';
  if (u.includes('opr') || u.includes('opera')) return 'Opera';
  if (u.includes('trident') || u.includes('msie')) return 'IE';
  if (u.includes('firefox')) return 'Firefox';
  if (u.includes('chrome')) return 'Chrome';
  if (u.includes('safari')) return 'Safari';
  return 'Other';
}
