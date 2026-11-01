const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixture, tick } = require('./helpers.cjs');

test('successful probes cancel their timeout instead of killing a later process', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(); const promise = f.probeAudioInfo('song'); const child = f.children[0];
  assert.equal(child.args.at(-2), '--');
  child.stdout.write(JSON.stringify({ title: 'Song', duration: 10, webpage_url: 'https://youtube.com/watch?v=x' }));
  child.emit('close', 0);
  assert.equal((await promise).title, 'Song');
  t.mock.timers.tick(31000); assert.equal(child.killed, false);
});

test('failed probes terminate promptly and reject once', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(); const promise = f.probeAudioInfo('song');
  f.children[0].emit('error', new Error('not installed'));
  await assert.rejects(promise, /not installed/);
  t.mock.timers.tick(31000); assert.equal(f.children[0].killed, true);
});

test('stopping a player while initial audio is pending cancels the startup timeout', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(), player = new f.AudioPlayer(); let errors = 0;
  player.on('error', () => errors++); player.subscribe(f.connection()); await tick();
  player.play(new f.AudioResource('song')); player.stop();
  t.mock.timers.tick(11000); await tick();
  assert.equal(player.state.status, 'idle'); assert.equal(errors, 0);
});

test('missing decoder output fails and cleans up the decoder process', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture(), player = new f.AudioPlayer(); const errors = [];
  player.on('error', error => errors.push(error.message)); player.subscribe(f.connection()); await tick();
  player.play(new f.AudioResource('song')); t.mock.timers.tick(10001); await tick();
  assert.equal(player.state.status, 'idle'); assert.equal(errors.length, 1);
  assert.ok(f.children.every(child => child.killed));
});

test('explicit extraction helpers accept any provider host instead of a platform allowlist', async () => {
  const f = fixture();
  const promise = f.probeAudioInfo('https://media.example.org/track');
  f.children[0].stdout.write(JSON.stringify({ title: 'Track' })); f.children[0].emit('close', 0);
  assert.equal((await promise).title, 'Track');
  assert.equal(f.children[0].args.at(-1), 'https://media.example.org/track');
});
