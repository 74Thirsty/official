import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeNewsletterSignup, newsletterConsentRecord, NEWSLETTER_CONSENT_VERSION, PRIVACY_POLICY_VERSION } from '../lib/newsletter-signup.js';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const page = readFileSync(resolve(root, 'newsletter.html'), 'utf8');
const api = readFileSync(resolve(root, 'api/newsletter.js'), 'utf8');
const ebook = readFileSync(resolve(root, 'api/ebook.js'), 'utf8');

test('newsletter page presents the verified subscriber edition without unsupported claims', () => {
  assert.match(page, /Digitally Autographed Edition/);
  assert.match(page, /Verification\/certificate included/i);
  assert.match(page, /assets\/icaniwill\.png/);
  assert.doesNotMatch(page, /bestseller|limited time|exclusive ebook|subscriber count/i);
});

test('newsletter form is accessible and posts the existing API contract', () => {
  assert.match(page, /<form[^>]+id="newsletterForm"/);
  assert.match(page, /<label for="subscriberName">Name<\/label>/);
  assert.match(page, /<label for="subscriberEmail">Email<\/label>/);
  assert.match(page, /<label for="subscriberPhone">Phone Number<\/label>/);
  assert.match(page, /id="newsletterConsent"[\s\S]*?type="checkbox"[\s\S]*?required/);
  assert.match(page, /documentation-viewer\.html\?code=DOC-D5A18EA7A04D74B4/);
  assert.match(page, /does not consent to promotional text messages/);
  assert.match(page, /may be associated with information from your website activity/);
  assert.match(page, /id="formStatus"[\s\S]*?role="status"[\s\S]*?aria-live="polite"/);
  assert.match(page, /fetch\('\/api\/newsletter'/);
  assert.match(page, /name: name/);
  assert.match(page, /email: email/);
  assert.match(page, /phone: phone/);
  assert.match(page, /newsletterConsent: consentInput\.checked/);
  assert.match(api, /normalizeNewsletterSignup\(payload\)/);
});

test('newsletter form handles validation, duplicate, success, and request failure states', () => {
  assert.match(page, /Please enter your name\./);
  assert.match(page, /Please enter a valid email address\./);
  assert.match(page, /Please enter a valid phone number\./);
  assert.match(page, /Please confirm your newsletter consent\./);
  assert.match(page, /You're already subscribed/);
  assert.match(page, /You're in\. Check your email/);
  assert.match(page, /We couldn't complete your subscription right now/);
  assert.match(page, /submitButton\.disabled = true/);
});

test('server-side signup normalization requires phone and explicit boolean consent', () => {
  const valid = normalizeNewsletterSignup({ name: ' Rider ', email: 'RIDER@EXAMPLE.ORG ', phone: '(515) 555-0123', newsletterConsent: true });
  assert.deepEqual(valid, {
    name: 'Rider', email: 'rider@example.org', phone: '(515) 555-0123', phoneValid: true, consented: true,
  });
  assert.equal(normalizeNewsletterSignup({ phone: '123', newsletterConsent: true }).phoneValid, false);
  assert.equal(normalizeNewsletterSignup({ phone: '5155550123', newsletterConsent: 'true' }).consented, false);

  const recorded = newsletterConsentRecord('https://lostlimbriders.org/newsletter.html', new Date('2026-09-14T12:00:00Z'));
  assert.equal(recorded.newsletter, true);
  assert.equal(recorded.recordedAt, '2026-09-14T12:00:00.000Z');
  assert.equal(recorded.consentVersion, NEWSLETTER_CONSENT_VERSION);
  assert.equal(recorded.privacyPolicyVersion, PRIVACY_POLICY_VERSION);
});

test('newsletter endpoint enforces consent and preserves existing visitor association', () => {
  assert.match(api, /!phoneValid \|\| !consented/);
  assert.match(api, /parseCookies\(req\)\.llr_vid/);
  assert.match(api, /v\.visitorId === sub\.visitorId/);
  assert.match(api, /v\.subscriberId = sub\.email/);
  assert.match(api, /existing\.consent = newsletterConsentRecord/);
  assert.match(page, /fetch\('\/api\/visit'/);
});

test('existing subscriber admin table remains compatible and displays phone', () => {
  const admin = readFileSync(resolve(root, 'admin.html'), 'utf8');
  const adminApi = readFileSync(resolve(root, 'api/admin.js'), 'utf8');
  assert.match(admin, /<th>Phone<\/th>/);
  assert.match(admin, /escapeHtml\(s\.phone \|\| '—'\)/);
  assert.match(adminApi, /action === 'subscribers'/);
});

test('existing ebook endpoint delivers the certificate-bearing asset', () => {
  assert.match(ebook, /i-can-i-will-STANDARD-PRINT-READY and Certificate\.pdf/);
  const welcome = readFileSync(resolve(root, 'assets/WELCOME.md'), 'utf8');
  assert.match(welcome, /digitally autographed and verified subscriber edition/i);
  assert.match(welcome, /signature verification and certificate material/i);
});
