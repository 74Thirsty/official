import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePageUrl,
  absoluteFacebookUrl,
  parseLiveVideosResponse,
  facebookDetectionConfigured,
} from '../lib/stream.js';
import { validateEpisode, publicEpisode, computeLiveState } from '../lib/episodes.js';

function withEnv(pairs, fn) {
  const saved = new Map();
  for (const [k, v] of Object.entries(pairs)) {
    saved.set(k, process.env[k]);
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of saved) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test('normalizePageUrl accepts only facebook URLs and normalizes them', () => {
  assert.equal(normalizePageUrl('https://www.facebook.com/LostLimbRiders'), 'https://www.facebook.com/LostLimbRiders');
  assert.equal(normalizePageUrl('facebook.com/LostLimbRiders/'), 'https://www.facebook.com/LostLimbRiders');
  assert.equal(normalizePageUrl('https://facebook.com/LostLimbRiders/videos/123/'), 'https://www.facebook.com/LostLimbRiders/videos/123');
  assert.equal(normalizePageUrl('https://evil.example.com/LostLimbRiders'), '');
  assert.equal(normalizePageUrl('javascript:alert(1)'), '');
  assert.equal(normalizePageUrl(''), '');
});

test('absoluteFacebookUrl builds viewer-facing permalinks without leaking anything', () => {
  assert.equal(
    absoluteFacebookUrl('/LostLimbRiders/videos/123/', '999'),
    'https://www.facebook.com/LostLimbRiders/videos/123'
  );
  assert.equal(
    absoluteFacebookUrl('/LostLimbRiders/videos/123/', ''),
    'https://www.facebook.com/LostLimbRiders/videos/123'
  );
  assert.equal(absoluteFacebookUrl('', '999'), '');
});

test('parseLiveVideosResponse finds the LIVE broadcast and latest replay', () => {
  const data = {
    data: [
      { status: 'LIVE_ENDED', permalink_url: '/LLR/videos/111/', created_time: '2026-08-01T12:00:00+0000', title: 'Old ride' },
      { status: 'LIVE_ENDED', permalink_url: '/LLR/videos/222/', created_time: '2026-08-20T12:00:00+0000', title: 'Recent ride' },
      { status: 'LIVE', permalink_url: '/LLR/videos/333/', created_time: '2026-08-21T12:00:00+0000', title: 'Friday Coffee Talk', live_views: 42 },
    ],
  };
  const parsed = parseLiveVideosResponse(data);
  assert.equal(parsed.live, true);
  assert.equal(parsed.videoUrl, '/LLR/videos/333/');
  assert.equal(parsed.title, 'Friday Coffee Talk');
  assert.equal(parsed.viewers, 42);
  assert.equal(parsed.lastReplayUrl, '/LLR/videos/222/');
});

test('parseLiveVideosResponse handles offline pages and malformed payloads', () => {
  const offline = parseLiveVideosResponse({ data: [{ status: 'LIVE_ENDED', permalink_url: '/LLR/videos/111/' }] });
  assert.equal(offline.live, false);
  assert.equal(offline.videoUrl, '');
  assert.equal(offline.lastReplayUrl, '/LLR/videos/111/');
  const empty = parseLiveVideosResponse(null);
  assert.equal(empty.live, false);
  assert.deepEqual(empty.viewers, 0);
});

test('facebookDetectionConfigured reflects the two env vars only', () => {
  withEnv({ FACEBOOK_PAGE_ID: undefined, FACEBOOK_ACCESS_TOKEN: undefined }, () => {
    assert.equal(facebookDetectionConfigured(), false);
  });
  withEnv({ FACEBOOK_PAGE_ID: '999', FACEBOOK_ACCESS_TOKEN: undefined }, () => {
    assert.equal(facebookDetectionConfigured(), false);
  });
  withEnv({ FACEBOOK_PAGE_ID: '999', FACEBOOK_ACCESS_TOKEN: 'token' }, () => {
    assert.equal(facebookDetectionConfigured(), true);
  });
});

test('episodes validate to a simple facebook-only schedule shape (no OBS fields)', () => {
  const { episode, errors } = validateEpisode({
    title: 'Test Broadcast',
    day: 'Wednesday',
    time: '09:00',
    recurring: true,
    description: 'Test',
  });
  assert.equal(errors.length, 0);
  for (const gone of ['mode', 'mediaFile', 'mediaVerified', 'destination', 'scene']) {
    assert.ok(!(gone in episode), gone + ' should be gone');
  }
  assert.ok(!('streamKeyRef' in publicEpisode(episode)));
});

test('computeLiveState is driven by the Facebook check alone', () => {
  const stream = { schedule: [] };
  assert.equal(computeLiveState(stream, { live: true }).liveState, 'live');
  assert.equal(computeLiveState(stream, { live: false }).liveState, 'offline');
});
