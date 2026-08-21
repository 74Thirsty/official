import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  streamKeyEnv,
  readStreamKey,
  validateStreamKey,
  validatePlatform,
  availablePlatforms,
  platformStatuses,
  stripStreamKeyRefs,
} from '../lib/streamconfig.js';
import { validateEpisode, publicEpisode } from '../lib/episodes.js';

const FB_SECRET = 'FB-fake-secret-940466509062891-Ab6thjft6xlrqtWjiu4C6SBU';
const YT_SECRET = 'yyyy-1111-2222-3333-4444-5555';
const TW_SECRET = 'live_1234567890_abcdefghijklmnop';
const OC_SECRET = 'abcdef1234567890abcdef1234567890';

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

test('streamKeyEnv maps platforms to established env var names', () => {
  assert.equal(streamKeyEnv('facebook'), 'FB_STREAM_KEY');
  assert.equal(streamKeyEnv('youtube'), 'YOUTUBE_STREAM_KEY');
  assert.equal(streamKeyEnv('twitch'), 'TWITCH_STREAM_KEY');
  assert.equal(streamKeyEnv('owncast'), 'OWNCAST_STREAM_KEY');
  assert.equal(streamKeyEnv('unsupported'), '');
});

test('validateStreamKey distinguishes missing/empty/malformed/valid/unsupported', () => {
  assert.deepEqual(validateStreamKey('facebook', undefined), { platform: 'facebook', status: 'missing', available: false });
  assert.deepEqual(validateStreamKey('youtube', '   '), { platform: 'youtube', status: 'empty', available: false });
  assert.deepEqual(validateStreamKey('youtube', 'contains spaces in key'), { platform: 'youtube', status: 'malformed', available: false });
  assert.deepEqual(validateStreamKey('youtube', 'short'), { platform: 'youtube', status: 'malformed', available: false });
  assert.deepEqual(validateStreamKey('facebook', FB_SECRET), { platform: 'facebook', status: 'valid', available: true });
  assert.deepEqual(validateStreamKey('unsupported', 'x'), { platform: 'unsupported', status: 'unsupported', available: false });
});

test('readStreamKey returns the secret only for the platform env var (internal accessor)', () => {
  withEnv({ FB_STREAM_KEY: FB_SECRET }, () => {
    assert.equal(readStreamKey('facebook'), FB_SECRET);
    assert.equal(readStreamKey('youtube'), undefined);
  });
});

test('ZERO platforms configured -> empty availability, no error', () => {
  withEnv({ FB_STREAM_KEY: undefined, YOUTUBE_STREAM_KEY: undefined, TWITCH_STREAM_KEY: undefined, OWNCAST_STREAM_KEY: undefined }, () => {
    assert.deepEqual(availablePlatforms(), []);
  });
});

test('ONE platform configured (facebook) -> only facebook appears', () => {
  withEnv({ FB_STREAM_KEY: FB_SECRET, YOUTUBE_STREAM_KEY: undefined, TWITCH_STREAM_KEY: undefined, OWNCAST_STREAM_KEY: undefined }, () => {
    assert.deepEqual(availablePlatforms(), [{ platform: 'facebook', label: 'Facebook Live', available: true }]);
  });
});

test('MULTIPLE platforms configured -> all configured platforms appear in defined order', () => {
  withEnv(
    { FB_STREAM_KEY: FB_SECRET, YOUTUBE_STREAM_KEY: YT_SECRET, TWITCH_STREAM_KEY: TW_SECRET, OWNCAST_STREAM_KEY: OC_SECRET },
    () => {
      assert.deepEqual(availablePlatforms().map((p) => p.platform), ['youtube', 'facebook', 'twitch', 'owncast']);
    }
  );
});

test('empty and malformed credentials cause the platform to be omitted', () => {
  withEnv(
    { FB_STREAM_KEY: '   ', YOUTUBE_STREAM_KEY: 'has whitespace', TWITCH_STREAM_KEY: undefined, OWNCAST_STREAM_KEY: undefined },
    () => {
      assert.deepEqual(availablePlatforms(), []);
    }
  );
});

test('availability responses never contain the secret or any credential field', () => {
  withEnv({ FB_STREAM_KEY: FB_SECRET, YOUTUBE_STREAM_KEY: YT_SECRET }, () => {
    const json = JSON.stringify(availablePlatforms());
    assert.ok(!json.includes(FB_SECRET));
    assert.ok(!json.includes(YT_SECRET));
    assert.ok(!json.includes('streamKey'));
    assert.ok(!json.includes('streamKeyRef'));
    for (const p of availablePlatforms()) {
      const keys = Object.keys(p).sort();
      assert.deepEqual(keys, ['available', 'label', 'platform']);
    }
  });
});

test('stripStreamKeyRefs removes the field recursively (defense for legacy data)', () => {
  const input = { a: 1, streamKeyRef: 'FB_STREAM_KEY', schedule: [{ id: 'x', streamKeyRef: 'FB_STREAM_KEY' }] };
  assert.deepEqual(stripStreamKeyRefs(input), { a: 1, schedule: [{ id: 'x' }] });
});

test('platformStatuses lists every platform as missing when no keys exist anywhere', () => {
  withEnv({ FB_STREAM_KEY: undefined, YOUTUBE_STREAM_KEY: undefined, TWITCH_STREAM_KEY: undefined, OWNCAST_STREAM_KEY: undefined }, () => {
    assert.deepEqual(platformStatuses({}), [
      { platform: 'youtube', label: 'YouTube Live', available: false, source: 'missing' },
      { platform: 'facebook', label: 'Facebook Live', available: false, source: 'missing' },
      { platform: 'twitch', label: 'Twitch', available: false, source: 'missing' },
      { platform: 'owncast', label: 'Owncast', available: false, source: 'missing' },
    ]);
  });
});

test('platformStatuses marks env-configured platforms available with source env', () => {
  withEnv({ FB_STREAM_KEY: FB_SECRET, YOUTUBE_STREAM_KEY: undefined, TWITCH_STREAM_KEY: undefined, OWNCAST_STREAM_KEY: undefined }, () => {
    const statuses = platformStatuses({});
    const fb = statuses.find((p) => p.platform === 'facebook');
    assert.equal(fb.available, true);
    assert.equal(fb.source, 'env');
    assert.equal(statuses.find((p) => p.platform === 'youtube').source, 'missing');
    assert.equal(statuses.find((p) => p.platform === 'youtube').available, false);
  });
});

test('platformStatuses treats a panel-saved key as available (source stored) without env', () => {
  withEnv({ FB_STREAM_KEY: undefined, YOUTUBE_STREAM_KEY: undefined, TWITCH_STREAM_KEY: undefined, OWNCAST_STREAM_KEY: undefined }, () => {
    const statuses = platformStatuses({ facebook: FB_SECRET + '-stored' });
    const fb = statuses.find((p) => p.platform === 'facebook');
    assert.equal(fb.available, true);
    assert.equal(fb.source, 'stored');
  });
});

test('platformStatuses prefers the panel-saved key over the environment variable', () => {
  withEnv({ FB_STREAM_KEY: FB_SECRET, YOUTUBE_STREAM_KEY: undefined, TWITCH_STREAM_KEY: undefined, OWNCAST_STREAM_KEY: undefined }, () => {
    const fb = platformStatuses({ facebook: YT_SECRET }).find((p) => p.platform === 'facebook');
    assert.equal(fb.source, 'stored');
  });
});

test('platformStatuses falls back to env when the panel-saved key is malformed', () => {
  withEnv({ FB_STREAM_KEY: FB_SECRET, YOUTUBE_STREAM_KEY: undefined, TWITCH_STREAM_KEY: undefined, OWNCAST_STREAM_KEY: undefined }, () => {
    const fb = platformStatuses({ facebook: 'short' }).find((p) => p.platform === 'facebook');
    assert.equal(fb.available, true);
    assert.equal(fb.source, 'env');
  });
});

test('platformStatuses handles null/undefined stored maps and never leaks secrets', () => {
  withEnv({ FB_STREAM_KEY: FB_SECRET, YOUTUBE_STREAM_KEY: undefined, TWITCH_STREAM_KEY: undefined, OWNCAST_STREAM_KEY: undefined }, () => {
    for (const stored of [undefined, null]) {
      const json = JSON.stringify(platformStatuses(stored));
      assert.ok(!json.includes(FB_SECRET));
      assert.ok(!json.includes('key'));
      assert.ok(!json.includes('streamKey'));
    }
  });
});

test('episodes no longer persist or expose streamKeyRef', () => {
  const { episode, errors } = validateEpisode({
    title: 'Test Broadcast',
    day: 'Wednesday',
    time: '09:00',
    recurring: true,
    destination: 'facebook',
  }, { stream: {} });
  assert.equal(errors.length, 0);
  assert.ok(!('streamKeyRef' in episode));
  assert.ok(!('streamKeyRef' in publicEpisode(episode, new Date(), false)));
});
