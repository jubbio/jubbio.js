const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { Readable } = require('node:stream');
const { spawn, spawnSync } = require('node:child_process');
const { fixture, tick } = require('./helpers.cjs');
const { performance } = require('node:perf_hooks');
const available = spawnSync('ffmpeg', ['-version'], { windowsHide: true }).status === 0;
let dir, server, base;
const requests = [];

before(async () => {
  if (!available) return;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jubbio-media-inputs-'));
  for (const [name, extra] of [
    ['tone.wav', ['-c:a', 'pcm_s16le']], ['tone.mp3', ['-c:a', 'libmp3lame']],
    ['tone.ogg', ['-c:a', 'libopus']], ['tone.webm', ['-c:a', 'libopus']],
    ['tone.raw', ['-c:a', 'pcm_s16le', '-f', 's16le']],
    ['mono.raw', ['-ar', '44100', '-ac', '1', '-c:a', 'pcm_s16le', '-f', 's16le']],
    ['tone.m3u8', ['-c:a', 'aac', '-f', 'hls', '-hls_time', '0.1', '-hls_list_size', '0']],
  ]) {
    const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi',
      '-i', 'sine=frequency=440:sample_rate=48000:duration=0.4', '-ac', '2', ...extra, path.join(dir, name)], { windowsHide: true });
    assert.equal(result.status, 0, String(result.stderr));
  }
  server = http.createServer((req, res) => {
    const name = new URL(req.url, 'http://localhost').pathname.slice(1);
    requests.push({ name, authorization: req.headers.authorization });
    if (req.headers.authorization !== 'Bearer fixture') { res.writeHead(401); res.end(); return; }
    if (name === 'redirect') { res.writeHead(302, { Location: '/tone.wav' }); res.end(); return; }
    const file = path.join(dir, path.basename(name));
    if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Length', fs.statSync(file).size);
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  if (dir) { for (const name of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, name)); fs.rmdirSync(dir); }
});

async function decode(t, input, options) {
  const children = [];
  const f = fixture({ spawn: (...args) => { const child = spawn(...args); children.push(child); return child; } });
  const player = new f.AudioPlayer(); t.after(() => player.stop(true));
  player.subscribe(f.connection()); await tick();
  await new Promise((resolve, reject) => {
    player.once('error', error => reject(new Error(error.message)));
    player.on('stateChange', (_old, state) => { if (state.status === 'idle') resolve(); });
    player.play(new f.AudioResource(input, options));
  });
  const frames = f.sources[0].frames;
  assert.ok(frames.length >= 18, `decoded only ${frames.length} frames`);
  assert.ok(frames.some(frame => frame.some(sample => Math.abs(sample) > 50)), 'decoded audio must not be silent');
  assert.ok(children.every(child => child.spawnargs[0] === 'ffmpeg'));
  return { frames, children };
}

test('real encoded Readable is decoded from stdin', { skip: !available, timeout: 5000 }, async t => {
  await decode(t, fs.createReadStream(path.join(dir, 'tone.mp3')));
});
test('real encoded async iterable preserves media across odd chunk boundaries', { skip: !available, timeout: 5000 }, async t => {
  const bytes = fs.readFileSync(path.join(dir, 'tone.wav'));
  async function* source() { for (let offset = 0; offset < bytes.length; offset += 117) yield bytes.subarray(offset, offset + 117); }
  await decode(t, source());
});
test('raw mono 44.1 kHz is resampled to 48 kHz stereo', { skip: !available, timeout: 5000 }, async t => {
  const { frames } = await decode(t, fs.createReadStream(path.join(dir, 'mono.raw')), { inputType: 'raw', sampleRate: 44100, numChannels: 1 });
  assert.ok(frames.every(frame => frame.length === 1920));
});
test('Ogg/Opus byte streams decode with the declared input format', { skip: !available, timeout: 5000 }, async t => {
  await decode(t, fs.createReadStream(path.join(dir, 'tone.ogg')), { inputType: 'ogg/opus' });
});
test('WebM/Opus byte streams decode with the declared input format', { skip: !available, timeout: 5000 }, async t => {
  await decode(t, fs.createReadStream(path.join(dir, 'tone.webm')), { inputType: 'webm/opus' });
});
test('raw Opus packets are wrapped into valid Ogg and decoded by real FFmpeg', { skip: !available, timeout: 5000 }, async t => {
  const bytes = fs.readFileSync(path.join(dir, 'tone.ogg')), packets = []; let partial = [];
  for (let pos = 0; pos < bytes.length;) {
    assert.equal(bytes.subarray(pos, pos + 4).toString(), 'OggS');
    const segments = bytes[pos + 26]; let offset = pos + 27 + segments;
    for (let i = 0; i < segments; i++) {
      const length = bytes[pos + 27 + i]; partial.push(bytes.subarray(offset, offset + length)); offset += length;
      if (length < 255) { packets.push(Buffer.concat(partial)); partial = []; }
    }
    pos = offset;
  }
  await decode(t, Readable.from(packets.slice(2)), { inputType: 'opus' });
});
test('HTTP media from an arbitrary host follows redirects with custom headers', { skip: !available, timeout: 5000 }, async t => {
  await decode(t, new URL(base + '/redirect'), { headers: { Authorization: 'Bearer fixture' } });
  assert.ok(requests.some(req => req.name === 'tone.wav' && req.authorization === 'Bearer fixture'));
});
test('raw PCM HTTP response bypasses FFmpeg, with authenticated streaming', { skip: !available, timeout: 5000 }, async t => {
  const { children } = await decode(t, base + '/tone.raw', { inputType: 'raw', headers: { Authorization: 'Bearer fixture' } });
  assert.equal(children.length, 0);
});
test('HLS media URL resolves relative segments and forwards authentication', { skip: !available, timeout: 5000 }, async t => {
  await decode(t, base + '/tone.m3u8', { headers: { Authorization: 'Bearer fixture' } });
  assert.ok(requests.some(req => req.name.endsWith('.ts') && req.authorization === 'Bearer fixture'));
});

test('live Opus packets start decoding before the producer finishes', { skip: !available, timeout: 5000 }, async t => {
  const bytes = fs.readFileSync(path.join(dir, 'tone.ogg')), packets = []; let partial = [];
  for (let pos = 0; pos < bytes.length;) {
    const segments = bytes[pos + 26]; let offset = pos + 27 + segments;
    for (let i = 0; i < segments; i++) {
      const length = bytes[pos + 27 + i]; partial.push(bytes.subarray(offset, offset + length)); offset += length;
      if (length < 255) { packets.push(Buffer.concat(partial)); partial = []; }
    }
    pos = offset;
  }
  let ended = false;
  async function* livePackets() {
    try { for (let i = 0; i < 200; i++) { yield packets[2 + i % (packets.length - 2)]; await new Promise(resolve => setTimeout(resolve, 20)); } }
    finally { ended = true; }
  }
  const f = fixture({ spawn }), player = new f.AudioPlayer();
  player.on('error', () => {}); t.after(() => player.stop(true));
  player.subscribe(f.connection()); await tick();
  const started = performance.now();
  player.play(new f.AudioResource(livePackets(), { inputType: 'opus' }));
  while (!f.sources[0].frames.length && performance.now() - started < 1500) await new Promise(resolve => setTimeout(resolve, 20));
  assert.ok(f.sources[0].frames.length > 0, 'live audio must not wait for EOF or several seconds of probing');
  assert.equal(ended, false);
});
