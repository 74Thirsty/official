/**
 * @file        newsletter-signup.js
 * @description Newsletter signup utilities
 * @project     Lost Limb Riders (lostlimbriders.org)
 * @author      C. Hirschauer
 * @copyright   Copyright (c) 2026 C. Hirschauer. All rights reserved.
 * @license     Proprietary. No unauthorized reproduction or distribution.
 */
import { clean } from './http.js';

export const NEWSLETTER_CONSENT_VERSION = 'newsletter-signup-v1';
export const PRIVACY_POLICY_VERSION = 'Organization Handbook v1.0, effective July 22, 2026';

export function normalizeNewsletterSignup(payload = {}) {
  const name = clean(payload.name, 120);
  const email = String(payload.email ?? '').trim().toLowerCase();
  const phone = clean(payload.phone, 40);
  const phoneDigits = phone.replace(/\D/g, '');
  return {
    name,
    email,
    phone,
    phoneValid: phoneDigits.length >= 7 && phoneDigits.length <= 15,
    consented: payload.newsletterConsent === true,
  };
}

export function newsletterConsentRecord(source, now = new Date()) {
  return {
    newsletter: true,
    recordedAt: now.toISOString(),
    consentVersion: NEWSLETTER_CONSENT_VERSION,
    privacyPolicyVersion: PRIVACY_POLICY_VERSION,
    source,
  };
}
