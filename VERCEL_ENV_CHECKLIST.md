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

## OPTIONAL — Live Streaming Platform Credentials (stream keys)

These control which platforms appear as available in the admin Live Stream panel.
Set only the platforms you use. `lib/streamconfig.js:20-24`.

| Variable | Required | Value | Notes |
|---|---|---|---|
| `FB_STREAM_KEY` | Optional | Facebook stream key | Facebook Live — min 20 chars |
| `YOUTUBE_STREAM_KEY` | Optional | YouTube stream key | YouTube Live — min 20 chars |
| `TWITCH_STREAM_KEY` | Optional | Twitch stream key | Twitch — min 10 chars |
| `OWNCAST_STREAM_KEY` | Optional | Owncast stream key | Owncast — min 10 chars |

---

## OPTIONAL — Live Streaming Platform Status Checks

These let the admin panel verify whether a broadcast is actually live on the
platform. `lib/platform.js` + `lib/stream.js`.

| Variable | Required | Value | Notes |
|---|---|---|---|
| `YOUTUBE_API_KEY` | Optional | YouTube Data API v3 key | `lib/platform.js:13` |
| `YOUTUBE_VIDEO_ID` | Optional | YouTube video/live ID | `lib/platform.js:14`. Also reads `STREAM_VIDEO_ID`. |
| `STREAM_VIDEO_ID` | Optional | Legacy alias for `YOUTUBE_VIDEO_ID` | `lib/platform.js:14`, `lib/stream.js:83` |
| `FACEBOOK_ACCESS_TOKEN` | Optional | Facebook Graph API token | `lib/platform.js:38` |
| `FACEBOOK_PAGE_ID` | Optional | Facebook page ID | `lib/platform.js:39` |
| `TWITCH_CLIENT_ID` | Optional | Twitch app client ID | `lib/platform.js:61` |
| `TWITCH_ACCESS_TOKEN` | Optional | Twitch OAuth token | `lib/platform.js:62` |
| `TWITCH_USER_LOGIN` | Optional | Twitch channel login | `lib/platform.js:63` |
| `OWNCAST_URL` | Optional | Owncast server URL | `lib/platform.js:83` |
| `STREAM_PLATFORM` | Optional | Default platform name | `lib/platform.js:99` |

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
- Streaming platform credentials are optional — the admin panel shows a helpful
  message when none are configured.
- E-book variables are optional — the welcome email honestly offers a free digital
  copy until `EBOOK_SIGNED=1` is set with valid storage config.
