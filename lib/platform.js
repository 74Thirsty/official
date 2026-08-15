export const PLATFORMS = {
  youtube: 'YouTube Live',
  facebook: 'Facebook Live',
  twitch: 'Twitch',
  owncast: 'Owncast',
};

function notConfigured(platform) {
  return { configured: false, live: false, platform, reason: 'not_configured' };
}

async function checkYouTube(opts) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const videoId = String(process.env.YOUTUBE_VIDEO_ID || process.env.STREAM_VIDEO_ID || '').trim() || String(opts.streamId || '').trim();
  if (!apiKey || !videoId) return notConfigured('youtube');
  const url =
    'https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=' +
    encodeURIComponent(videoId) +
    '&key=' + encodeURIComponent(apiKey);
  const res = await opts.fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return { configured: true, live: false, platform: 'youtube', reason: 'http_' + res.status };
  const data = await res.json();
  const item = Array.isArray(data.items) && data.items[0] ? data.items[0] : null;
  if (!item) return { configured: true, live: false, platform: 'youtube', reason: 'video_not_found' };
  const lsd = item.liveStreamingDetails || {};
  const live = Boolean(lsd.actualStartTime) && !lsd.actualEndTime;
  return {
    configured: true,
    live,
    platform: 'youtube',
    startedAt: lsd.actualStartTime || null,
    streamUrl: 'https://www.youtube.com/watch?v=' + encodeURIComponent(videoId),
    reason: live ? 'live' : lsd.actualStartTime ? 'ended' : 'upcoming',
  };
}

async function checkFacebook(opts) {
  const token = process.env.FACEBOOK_ACCESS_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID;
  if (!token || !pageId) return notConfigured('facebook');
  const url =
    'https://graph.facebook.com/v21.0/' +
    encodeURIComponent(pageId) +
    '/live_videos?fields=status,permalink_url,stream_url&access_token=' +
    encodeURIComponent(token);
  const res = await opts.fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return { configured: true, live: false, platform: 'facebook', reason: 'http_' + res.status };
  const data = await res.json();
  const items = Array.isArray(data.data) ? data.data : [];
  const liveVideo = items.find((v) => v.status === 'LIVE') || (items[0] && items[0].status === 'LIVE' ? items[0] : null);
  return {
    configured: true,
    live: Boolean(liveVideo),
    platform: 'facebook',
    streamUrl: liveVideo && liveVideo.permalink_url ? liveVideo.permalink_url : '',
    reason: liveVideo ? 'live' : items.length ? 'ended' : 'no_live_video',
  };
}

async function checkTwitch(opts) {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const token = process.env.TWITCH_ACCESS_TOKEN;
  const login = String(process.env.TWITCH_USER_LOGIN || '').trim() || String(opts.streamId || '').trim();
  if (!clientId || !token || !login) return notConfigured('twitch');
  const url = 'https://api.twitch.tv/helix/streams?user_login=' + encodeURIComponent(login);
  const res = await opts.fetch(url, {
    headers: { Accept: 'application/json', 'Client-Id': clientId, Authorization: 'Bearer ' + token },
  });
  if (!res.ok) return { configured: true, live: false, platform: 'twitch', reason: 'http_' + res.status };
  const data = await res.json();
  const stream = Array.isArray(data.data) && data.data[0] ? data.data[0] : null;
  return {
    configured: true,
    live: Boolean(stream),
    platform: 'twitch',
    startedAt: stream ? stream.started_at : null,
    streamUrl: stream ? 'https://www.twitch.tv/' + encodeURIComponent(login) : '',
    reason: stream ? 'live' : 'offline',
  };
}

async function checkOwncast(opts) {
  const base = String(process.env.OWNCAST_URL || '').trim().replace(/\/+$/, '');
  if (!base) return notConfigured('owncast');
  const res = await opts.fetch(base + '/api/status', { headers: { Accept: 'application/json' } });
  if (!res.ok) return { configured: true, live: false, platform: 'owncast', reason: 'http_' + res.status };
  const data = await res.json();
  const online = data.online === true;
  return {
    configured: true,
    live: online,
    platform: 'owncast',
    streamUrl: base,
    reason: online ? 'live' : 'offline',
  };
}

export async function checkPlatformLive(opts = {}) {
  const platform = String(opts.platform || process.env.STREAM_PLATFORM || '').toLowerCase();
  const fetchImpl = opts.fetch || globalThis.fetch;
  try {
    if (platform === 'youtube') return await checkYouTube({ ...opts, fetch: fetchImpl });
    if (platform === 'facebook') return await checkFacebook({ ...opts, fetch: fetchImpl });
    if (platform === 'twitch') return await checkTwitch({ ...opts, fetch: fetchImpl });
    if (platform === 'owncast') return await checkOwncast({ ...opts, fetch: fetchImpl });
    return { configured: false, live: false, platform, reason: 'unsupported_platform' };
  } catch (err) {
    return { configured: true, live: false, platform, reason: 'error:' + String(err && err.message || err) };
  }
}
