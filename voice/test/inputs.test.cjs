const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { Readable, PassThrough } = require('node:stream');
const { fixture, tick, deferred } = require('./helpers.cjs');

async function playerFor(f, t) {
  const player = new f.AudioPlayer(); player.on('error', () => {});
  player.subscribe(f.connection()); await tick();
  t.after(() => player.stop(true)); return player;
}

test('48 kHz stereo PCM Readable plays without FFmpeg or an extractor and preserves split samples', async t => {
  const f = fixture(), player = await playerFor(f, t), bytes = f.pcm(2, 222);
  player.play(new f.AudioResource(Readable.from([bytes.subarray(0, 1), bytes.subarray(1, 1901), bytes.subarray(1901)]), { inputType: 'raw' }));
  await tick(); await tick();
  assert.equal(f.children.length, 0);
  assert.equal(f.sources[0].frames.length, 2);
  assert.ok(f.sources[0].frames.every(frame => frame.every(sample => sample === 222)));
});

test('async byte iterables support natural EOF and close their iterator', async t => {
  const f = fixture(), player = await playerFor(f, t); let closed = false;
  async function* source() { try { yield f.pcm(1); yield f.pcm(1); } finally { closed = true; } }
  const resource = new f.AudioResource(source(), { inputType: 'raw' });
  player.play(resource); await tick(); await tick();
  assert.equal(f.sources[0].frames.length, 2); assert.equal(closed, true);
  assert.equal(resource.ended, true); assert.equal(player.state.status, 'idle');
});

test('encoded Readable uses FFmpeg pipe input and never starts yt-dlp', async t => {
  const f = fixture(), player = await playerFor(f, t), input = new PassThrough();
  player.play(new f.AudioResource(input, { inputType: 'webm/opus' })); await tick();
  assert.equal(f.children.length, 1);
  assert.equal(f.children[0].command, 'ffmpeg');
  assert.equal(f.children[0].args[f.children[0].args.indexOf('-i') + 1], 'pipe:0');
  player.stop(); await tick(); assert.equal(input.destroyed, true);
});

test('direct URLs from arbitrary hosts preserve request headers without platform extraction', async t => {
  const f = fixture(), player = await playerFor(f, t);
  player.play(new f.AudioResource(new URL('https://cdn.provider.example/audio?signature=fixture'), { headers: { Authorization: 'Bearer fixture' } }));
  assert.equal(f.children.length, 1); const child = f.children[0];
  assert.equal(child.command, 'ffmpeg');
  assert.equal(child.args[child.args.indexOf('-i') + 1], 'https://cdn.provider.example/audio?signature=fixture');
  assert.equal(child.args[child.args.indexOf('-headers') + 1], 'Authorization: Bearer fixture\r\n');
});

test('plain strings are file paths, never an implicit platform search', async t => {
  const f = fixture(), player = await playerFor(f, t);
  player.play(new f.AudioResource('search terms'));
  assert.equal(f.children.length, 1);
  assert.equal(f.children[0].args[f.children[0].args.indexOf('-i') + 1], path.resolve('search terms'));
});

test('stopping raw PCM pauses consumption and destroys the owned upstream stream', async t => {
  const f = fixture(), gate = deferred(), player = await playerFor(f, t), source = new PassThrough();
  f.setCaptureGate(gate.promise); t.after(() => gate.resolve());
  player.play(new f.AudioResource(source, { inputType: 'raw' })); source.write(f.pcm(2)); await tick();
  player.stop(); gate.resolve(); await tick();
  assert.equal(source.destroyed, true); assert.equal(player.state.status, 'idle');
  assert.equal(f.sources[0].frames.length, 1);
});

test('invalid stream chunks fail through the player error event without crashing', async t => {
  const f = fixture(), player = await playerFor(f, t), errors = [];
  player.on('error', error => errors.push(error.message));
  player.play(new f.AudioResource(Readable.from([{ not: 'audio' }]), { inputType: 'raw' }));
  await tick(); await tick();
  assert.equal(player.state.status, 'idle'); assert.match(errors[0], /Uint8Array/);
});

test('raw Opus requires packet boundaries and invalid request headers are rejected', () => {
  const f = fixture();
  assert.throws(() => new f.AudioResource(new PassThrough(), { inputType: 'opus' }), /one packet per item/);
  assert.throws(() => new f.AudioResource('https://example.com/x', { headers: { Authorization: 'x\r\nInjected: yes' } }), /header/);
});

test('raw Opus packet input is framed as Ogg and sent through the decoder', async t => {
  const f = fixture(), player = await playerFor(f, t);
  player.play(new f.AudioResource(Readable.from([Buffer.from([0xf8, 0xff, 0xfe])]), { inputType: 'opus' }));
  await tick();
  assert.equal(f.children.length, 1);
  assert.ok(f.children[0].args.includes('ogg'));
  const input = f.children[0].stdin.read();
  assert.equal(input.subarray(0, 4).toString(), 'OggS');
  assert.ok(input.includes(Buffer.from('OpusHead')));
});

test('optional extraction is lazy and is killed when playback is cancelled', async t => {
  const f = fixture(), player = await playerFor(f, t);
  const { createAudioResourceFromUrl } = f.load(path.resolve(__dirname, '../src/AudioResource.ts'));
  const resource = createAudioResourceFromUrl('https://provider.example/track', { useYtDlp: true });
  assert.equal(f.children.length, 0);
  player.play(resource); await tick();
  const extractor = f.children.find(child => child.command !== 'ffmpeg');
  assert.ok(extractor);
  player.stop(); await tick(); assert.equal(extractor.killed, true);
});
