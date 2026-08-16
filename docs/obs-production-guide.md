# Lost Limb Riders — OBS Studio Production Configuration

> **OBS Studio is the primary livestream production and broadcast method.**
> The website (`lostlimbriders.org`) is the public-facing distribution and information layer — it never replaces OBS's production capabilities.

## Architecture

```
Lost Limb Riders Admin  ──▶  Livestream/Event Data (Vercel KV, llr:stream)
                                      │
[ REAL-TIME SOURCES ]  or  [ VIDEO FILE ]      (in OBS Studio)
               │                 │
               └──────▶  OBS STUDIO  ──▶  STREAMING PLATFORM  ──▶  Website  ──▶  Audience
                          (producer)       (Facebook/YouTube/
                                           Twitch/Owncast)
```

- **OBS handles:** cameras, microphones, scenes, transitions, overlays, lower thirds, branding, screen sharing, video playback, audio mixing, and live production controls.
- **OBS handles file playback** for prerecorded broadcasts (Media Source set to loop off, play on show).
- **The website handles:** scheduling, metadata, live-status reflection, calendar + newsletter data, archive display. It never produces video.

## Two broadcast modes

| Mode | Field value | Meaning |
| --- | --- | --- |
| **A — Actual Live** | `mode: realtime` | OBS broadcasts live cameras/mics/guests/screens. Operator produces in real time. Website shows **LIVE NOW — REAL-TIME**. |
| **B — File-Based Live** | `mode: prerecorded` | OBS plays a prerecorded episode file at the scheduled time as a real broadcast. Website shows **LIVE NOW — PRERECORDED BROADCAST**. |

The website **never** represents a prerecorded broadcast as real-time, and never shows "LIVE" purely from a calendar timestamp — live state is confirmed from the streaming platform (or the operator's explicit Go Live).

## Live-state values

`Scheduled` → `Starting Soon` (30 min window) → `LIVE NOW — REAL-TIME` or `LIVE NOW — PRERECORDED BROADCAST` → `Offline` / `Replay`.

Determination order:
1. If a platform check is configured (see below), the platform API is authoritative.
2. Otherwise the operator's manual `Go Live` / status field is used.
3. Schedule windows only drive `Scheduled` / `Starting Soon` / `Ended` — never "LIVE".

## Scenes (reuse these names in OBS)

Create these scenes once in OBS Studio (Tools → Scene Collection → Import, then add sources). Names match the `scene` field on scheduled episodes.

| Scene name | Sources | Notes |
| --- | --- | --- |
| `LLR — Starting Soon` | Browser Source (webcam + logo + countdown), Logo image | Used before kickoff. Optional live countdown to episode start. |
| `LLR — Live Show` | Webcam, Mic/Audio, Logo overlay, Lower-third text source | Main real-time production scene. |
| `LLR — Guest` | Webcam + guest feed, Mic, lower third with guest name | For remote guests. |
| `LLR — Screen Share` | Display Capture / Window Capture, Logo overlay | For presentations. |
| `LLR — Prerecorded Episode` | Media Source → prerecorded file, Mic (commentary optional) | **Mode B.** Media Source: *Unbuffered off, Loop off, Restart when active on*. Verify with the admin OBS panel (`GetMediaInputStatus` → `playing`). |
| `LLR — Break` | Logo, music source, "We'll be right back" | Mid-show break. |
| `LLR — Announcements` | Graphics, Lower third | Event/news announcements. |
| `LLR — Ending` | Logo, credits, "See you on the next ride" | Show wrap. |
| `LLR — Offline` | Logo + "Offline" graphic | Used between shows. |

Branding: orange `#ff6a00`, black/charcoal backgrounds (`#050505`/`#141414`), white text — matching the website's tokens.

## Streaming settings (secrets)

Set in OBS: **Settings → Stream**. Service = platform; server + stream key come from your platform dashboard.

- **Never** hard-code stream keys into the scene collection, this repo, or any committed config.
- The scheduled episode stores a `streamKeyRef` — the **name** of the environment variable that holds the key (e.g. `FACEBOOK_STREAM_KEY`, `YOUTUBE_STREAM_KEY`). It is derived automatically from the broadcast's destination platform by the server; the admin UI has no field for it. The key itself lives only in secrets:
  - **Local development:** store in **KWallet** (`kwalletmanager`) or your OS keyring; paste into OBS at stream time.
  - **Production:** set as Vercel environment variables only.
- Stream keys must never appear in GitHub, frontend JS, public API responses, HTML, browser storage, or public config files.

### Platform live-status checks (optional, env-configured)

`/api/stream?action=check` (admin) and the admin panel's **Check Live Status** poll the platform API when configured:

| Platform | Env vars | Notes |
| --- | --- | --- |
| YouTube | `YOUTUBE_API_KEY`, `YOUTUBE_VIDEO_ID` (or use the stream `streamId`) | Uses `liveStreamingDetails.actualStartTime/actualEndTime`. |
| Facebook | `FACEBOOK_ACCESS_TOKEN`, `FACEBOOK_PAGE_ID` | Uses `/{page_id}/live_videos`. |
| Twitch | `TWITCH_CLIENT_ID`, `TWITCH_ACCESS_TOKEN`, `TWITCH_USER_LOGIN` | Uses Helix `/streams`. |
| Owncast | `OWNCAST_URL` | Uses `/api/status`. |

When none are configured, the site falls back to the operator's manual live status and the admin panel shows "Platform check not configured — using manual status." No external calls are made on public page loads.

## Prerecorded broadcast safeguards

- `mode: prerecorded` **requires** a `mediaFile` name (safe filename, media extension, no path traversal) and a `mediaVerified` confirmation. The API rejects scheduling a prerecorded broadcast without them.
- The file itself stays on the OBS machine (or your secure media storage) — **never** in GitHub. The website stores only the filename metadata and does not upload or stream the file.
- OBS must be running and the media source loaded. The **OBS Studio Status** panel in `admin.html` connects to OBS WebSocket (`ws://localhost:4455`, password in memory only) and shows: connection state, current scene, streaming state, and media-source playback status — making it obvious if OBS is off or the media source is missing.
- Large media files: keep out of git. Use a local folder (e.g. `~/LLR-Media/`) or a secure media bucket.

## OBS WebSocket (obs-websocket v5)

1. OBS → **Tools → WebSocket Server Settings** → *Enable WebSocket server*, port `4455`, set a password.
2. `admin.html` → Live Stream tab → **OBS Studio Status** → enter URL + password + (for prerecorded) the media source name → **Connect**.
3. The password stays in page memory only; it is never sent to the server or persisted.

## Website → calendar → newsletter flow

Scheduled episodes live in **one place**: `llr:stream.schedule`. From there:
- `media.html` renders the schedule (with Real-Time vs Prerecorded chips).
- One-time dated episodes auto-create a linked **calendar event** (`category: livestream`) in `llr:events`; deleting the episode removes the event.
- The biweekly newsletter (`/api/cron-newsletter`) pulls the same schedule and labels each item **Live · Real-Time** or **Scheduled · Prerecorded Broadcast**.

## Acceptance testing

### Test A — Actual live
1. Admin schedules a real-time episode → appears on `media.html`, in the calendar, and in the newsletter preview.
2. OBS runs the `LLR — Live Show` scene and starts streaming.
3. Admin hits **Check Live Status** (or platform check confirms) → site shows **LIVE NOW — REAL-TIME** with the embedded player.
4. OBS stops → platform check reports ended → site returns to offline/replay; the broadcast is archived.

### Test B — Prerecorded
1. Admin schedules a prerecorded episode, supplies the file name and confirms verification (rejected without them).
2. OBS loads the file in `LLR — Prerecorded Episode`; admin panel confirms the media source is playing.
3. When broadcast starts, the site shows **LIVE NOW — PRERECORDED BROADCAST** (never real-time).
4. File plays to completion; broadcast ends → offline/replay; archive remains available.

## Env vars summary (Vercel)

- Existing: `ADMIN_KEY`, `CRON_SECRET`, `RESEND_API_KEY`, `RESEND_FROM`, `KV_*`.
- Optional live-status: `YOUTUBE_API_KEY`, `YOUTUBE_VIDEO_ID`, `FACEBOOK_ACCESS_TOKEN`, `FACEBOOK_PAGE_ID`, `TWITCH_CLIENT_ID`, `TWITCH_ACCESS_TOKEN`, `TWITCH_USER_LOGIN`, `OWNCAST_URL`.
- Stream keys (referenced by env var name only, never exposed): `YOUTUBE_STREAM_KEY`, `FACEBOOK_STREAM_KEY`, `TWITCH_STREAM_KEY`, `OWNCAST_STREAM_KEY`.
  The admin platform dropdown lists only platforms whose stream-key env var is present and structurally valid; a platform with missing, empty, or malformed credentials is omitted entirely.
