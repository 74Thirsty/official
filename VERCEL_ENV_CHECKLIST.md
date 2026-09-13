# Vercel Environment Variables — Complete Checklist

Every environment variable the application expects, organized by priority.
The Vercel dashboard path is: **Project → Settings → Environment Variables**.

---

## CRITICAL — Authentication (login is broken without this)

| Variable | Required | Value | Notes |
|---|---|---|---|
| `ADMIN_KEY` | **YES** | `openssl rand -base64 32` | Admin API secret. `lib/http.js:76`. **Must exist.** If only `GUESTBOOK_ADMIN_KEY` is set, rename it to `ADMIN_KEY` — the code no longer reads the old name. |

---

## CRITICAL — Database (entire site fails without these)

| Variable | Required | Value | Notes |
|---|---|---|---|
| `KV_REST_API_URL` | **YES** | Auto-created by `vercel link` | Upstash Redis REST URL |
| `KV_REST_API_TOKEN` | **YES** | Auto-created by `vercel link` | Upstash Redis REST token |
| `KV_REST_API_READ_ONLY_TOKEN` | Optional | Auto-created by `vercel link` | Read-only replica token |

---

## CRITICAL — Cron (newsletter won't send without this)

| Variable | Required | Value | Notes |
|---|---|---|---|
| `CRON_SECRET` | **YES** | `openssl rand -base64 32` | `api/cron-newsletter.js:10`. Vercel Cron sends `Authorization: Bearer` with this value. |

---

## REQUIRED — Email Sending

| Variable | Required | Value | Notes |
|---|---|---|---|
| `RESEND_API_KEY` | **YES** | Resend dashboard key | `lib/email.js:2`, `api/contact.js:54`. Contact form + welcome emails. Free tier: 100/day. |
| `RESEND_FROM` | **YES** | e.g. `Lost Limb Riders <john.thompson@lostlimbriders.org>` | `lib/email.js:3`, `api/contact.js:55`. Must be a verified sender in Resend. |

---

## OPTIONAL — Newsletter Defaults

## OPTIONAL — PayPal Donations

| Variable | Required | Value | Notes |
|---|---|---|---|
| `PAYPAL_DONATION_URL` | For online donations | Official Lost Limb Riders PayPal donation/payment URL | Public, HTTPS URL. PayPal handles the complete donation after the visitor follows this link. |

---

| Variable | Required | Value | Notes |
|---|---|---|---|
| `NEWSLETTER_MESSAGE` | Optional | Any text | `api/cron-newsletter.js:37`. Default intro for cron newsletter. Falls back to built-in message. |

---

## OPTIONAL — E-Book Download System

| Variable | Required | Value | Notes |
|---|---|---|---|
| `EBOOK_SIGNED` | Optional | `1` to enable | `lib/newsletter.js:10`. Enables signed-copy language in emails. |
| `EBOOK_LINK_TTL_DAYS` | Optional | Number (default `7`) | `api/ebook.js:7`. Token expiry for e-book download links. |
| `EBOOK_DOWNLOAD_URL` | Optional | Private URL to PDF | `lib/download.js:99`. Static fallback if presigned URLs aren't configured. |

### E-Book Presigned URLs (S3/R2) — optional, advanced

| Variable | Required | Value | Notes |
|---|---|---|---|
| `EBOOK_STORAGE_ENDPOINT` | Optional | e.g. `https://s3.amazonaws.com` | `lib/download.js:49` |
| `EBOOK_STORAGE_REGION` | Optional | e.g. `us-east-1` (default `auto`) | `lib/download.js:50` |
| `EBOOK_STORAGE_BUCKET` | Optional | Bucket name | `lib/download.js:51` |
| `EBOOK_STORAGE_KEY` | Optional | Object key path | `lib/download.js:52` |
| `EBOOK_STORAGE_ACCESS_KEY` | Optional | Access key ID | `lib/download.js:53` |
| `EBOOK_STORAGE_SECRET_KEY` | Optional | Secret access key | `lib/download.js:54` |
| `EBOOK_PRESIGN_TTL` | Optional | Seconds (default `120`) | `lib/download.js:55` |

---

## OPTIONAL — Facebook and YouTube Live (automatic live detection)

The website can detect Facebook Live, Chris's personal YouTube channel, and the
Lost Limb Riders business YouTube channel. Going live does not require stream
keys in this application. Detection credentials remain server-side.

| Variable | Required | Value | Notes |
|---|---|---|---|
| `FACEBOOK_PAGE_ID` | Optional (needed for auto-detection) | Numeric page ID | `lib/stream.js`. Graph API `/{page}/live_videos` read. |
| `FACEBOOK_ACCESS_TOKEN` | Optional (needed for auto-detection) | Page access token | `lib/stream.js`. Server-side only; never sent to browsers. |
| `FACEBOOK_PAGE_URL` | Optional | `https://www.facebook.com/YourPage` | Offline-state "Follow on Facebook" link. The admin panel field overrides this. |
| `YOUTUBE_API_KEY` | Optional (needed for YouTube auto-detection) | YouTube Data API v3 key | Server-side only. Checks the two approved channel IDs; never returned to browsers. |

### Content Engine (Story + Event-Idea Generation)

| Variable | Required | Value | Notes |
|---|---|---|---|
| `GEMINI_API_KEY` | Optional (needed for AI generation) | Google AI Studio key | `lib/ai.js`. Powers story generation and event-idea recommendations. Get one at [aistudio.google.com](https://aistudio.google.com/apikey). |
| `GEMINI_MODEL` | Optional | Default: `gemini-2.5-flash` | Override the Gemini model used for generation. |
| `DISCORD_OWNER_WEBHOOK_URL` | Optional | Discord channel webhook URL | `lib/notify.js`. Admin notifications for approvals, generation events, failures. Channel → Integrations → Webhooks → New Webhook. Without it, all content features work but no Discord alerts fire. |

Without the first two, all content-engine UI is visible in admin but generation buttons return "AI not configured." Notifications silently skip (logged to audit).

Without the first two, the site still works but always shows its offline state.

---

## REMOVED — old streaming variables

`FB_STREAM_KEY`, `YOUTUBE_STREAM_KEY`, `TWITCH_STREAM_KEY`, `OWNCAST_STREAM_KEY`,
`YOUTUBE_VIDEO_ID`, `STREAM_VIDEO_ID`, `TWITCH_*`, `OWNCAST_URL`
and `STREAM_PLATFORM` are no longer read by any code and can be deleted from
the Vercel dashboard. OBS/RTMP streaming was replaced by Facebook Live.

---

## MINIMUM VIABLE DEPLOYMENT

For the site + admin login + newsletter + contact to function:

```
ADMIN_KEY=<your-secret>
KV_REST_API_URL=<from vercel link>
KV_REST_API_TOKEN=<from vercel link>
CRON_SECRET=<your-secret>
RESEND_API_KEY=<from resend.com>
RESEND_FROM=<your-verified-sender>
```

## NOTES

- **Do NOT** commit `.env` or `.env.local` to git.
- **Do NOT** set `GUESTBOOK_ADMIN_KEY` — it is obsolete. Only `ADMIN_KEY` is read.
- `KV_*` variables are created automatically by `vercel link` when attaching a KV store.
- Streaming: Facebook Live only. Stream keys/OBS are gone; `FACEBOOK_PAGE_ID` +
  `FACEBOOK_ACCESS_TOKEN` enable automatic live detection (optional).
- E-book variables are optional — the welcome email honestly offers a free digital
  copy until `EBOOK_SIGNED=1` is set with valid storage config.
