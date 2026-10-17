import test from 'node:test';
import assert from 'node:assert/strict';
import { canCorrectPlayback, playPosition } from '../core/playback.mjs';
import { readFileSync } from 'node:fs';
import { catalog } from '../core/catalog.mjs';

test('buffering, a pending seek and scrubbing cannot be interrupted by drift correction', () => {
  const stable = { readyState: 3, seeking: false, scrubbing: false, now: 10000, lastSeekAt: 0 };
  assert.equal(canCorrectPlayback(stable), true);
  assert.equal(canCorrectPlayback({ ...stable, readyState: 1 }), false);
  assert.equal(canCorrectPlayback({ ...stable, seeking: true }), false);
  assert.equal(canCorrectPlayback({ ...stable, scrubbing: true }), false);
  assert.equal(canCorrectPlayback({ ...stable, lastSeekAt: 9500 }), false);
});

test('pressing play after the end restarts the shared film instead of remaining at its final frame', () => {
  assert.equal(playPosition({ currentTime: 52, duration: 52, ended: true, playing: false }), 0);
  assert.equal(playPosition({ currentTime: 51.95, duration: 52, ended: false, playing: false }), 0);
  assert.equal(playPosition({ currentTime: 12, duration: 52, ended: false, playing: false }), 12);
  assert.equal(playPosition({ currentTime: NaN, duration: NaN, ended: false, playing: false }), 0);
});

test('every bundled catalogue video is a fast-start MP4 with a browser-compatible H264 profile', () => {
  for (const film of catalog) {
    const data = readFileSync(new URL(`../public${film.src}`, import.meta.url));
    const moov = data.indexOf(Buffer.from('moov')), mdat = data.indexOf(Buffer.from('mdat'));
    assert.ok(moov > 0 && mdat > moov, `${film.id}: metadata must precede media for progressive playback`);
    const avc = data.indexOf(Buffer.from('avcC'));
    assert.ok(avc > 0, `${film.id}: H264 configuration missing`);
    assert.ok([66, 77, 100].includes(data[avc + 5]), `${film.id}: unsupported H264 profile ${data[avc + 5]}`);
  }
});
