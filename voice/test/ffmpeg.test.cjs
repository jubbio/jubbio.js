const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fixture, tick } = require('./helpers.cjs');

const available = spawnSync('ffmpeg', ['-version'], { windowsHide: true }).status === 0;

test('real FFmpeg decodes a local WAV without extraction and delivers every sample', { skip: !available, timeout: 5000 }, async t => {
  const children = [];
  const f = fixture({ spawn: (...args) => { const child = spawn(...args); children.push(child); return child; } });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jubbio-voice-'));
  const file = path.join(dir, 'fixture.wav');
  const pcm = f.pcm(25, 1000);
  const header = Buffer.alloc(44);
  header.write('RIFF'); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(2, 22);
  header.writeUInt32LE(48000, 24); header.writeUInt32LE(192000, 28);
  header.writeUInt16LE(4, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(file, Buffer.concat([header, pcm]));
  const player = new f.AudioPlayer();
  t.after(() => { player.stop(true); fs.unlinkSync(file); fs.rmdirSync(dir); });
  player.subscribe(f.connection()); await tick();
  await new Promise((resolve, reject) => {
    player.once('error', error => reject(new Error(error.message)));
    player.on('stateChange', (_old, state) => { if (state.status === 'idle') resolve(); });
    player.play(new f.AudioResource(file));
  });
  assert.equal(children.length, 1);
  assert.equal(f.sources[0].frames.length, 25);
  assert.ok(f.sources[0].frames.every(frame => frame.every(sample => sample === 1000)));
});
