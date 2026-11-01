const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixture, tick, deferred } = require('./helpers.cjs');

async function playing(f, options) {
  const player = new f.AudioPlayer(options);
  player.on('error', () => {});
  const connection = f.connection();
  player.subscribe(connection);
  await tick();
  const resource = new f.AudioResource('https://youtube.com/watch?v=test');
  player.play(resource);
  const ffmpeg = f.children.find(child => child.command === 'ffmpeg');
  return { player, connection, resource, ffmpeg };
}

test('playing after subscribing an already-ready connection starts decoding', async t => {
  const f = fixture();
  const { player, ffmpeg, resource } = await playing(f);
  t.after(() => player.stop(true));
  ffmpeg.stdout.write(f.pcm(1));
  await tick();
  assert.equal(player.state.status, 'playing');
  assert.equal(resource.started, true);
  assert.equal(f.sources[0].frames.length, 1);
});

test('pause preserves every PCM frame and resume keeps their order', async t => {
  const f = fixture();
  const { player, ffmpeg } = await playing(f);
  t.after(() => player.stop(true));
  ffmpeg.stdout.write(f.pcm(1, 1)); await tick();
  assert.equal(player.pause(), true);
  ffmpeg.stdout.write(f.pcm(2, 2)); await tick();
  assert.equal(f.sources[0].frames.length, 1);
  assert.equal(player.unpause(), true); await tick();
  assert.deepEqual(f.sources[0].frames.map(frame => frame[0]), [1, 2, 2]);
});

test('slow native capture applies stream backpressure instead of accumulating frames', async t => {
  const f = fixture(), gate = deferred(); f.setCaptureGate(gate.promise);
  const { player, ffmpeg } = await playing(f);
  t.after(() => { player.stop(true); gate.resolve(); });
  ffmpeg.stdout.write(f.pcm(8)); await tick();
  let writes = 0;
  while (ffmpeg.stdout.write(f.pcm(8)) && writes++ < 1000) {}
  assert.ok(writes < 1000, 'the producer must be backpressured');
  await tick();
  assert.equal(f.sources[0].frames.length, 1);
});

test('stopping during native capture never revives the old song', async () => {
  const f = fixture(), gate = deferred(); f.setCaptureGate(gate.promise);
  const { player, ffmpeg, resource } = await playing(f);
  ffmpeg.stdout.write(f.pcm(3)); await tick();
  player.stop(); gate.resolve(); await tick();
  assert.equal(player.state.status, 'idle');
  assert.equal(f.sources[0].frames.length, 1);
  assert.equal(resource.ended, true);
  assert.ok(f.children.every(child => child.killed));
});

test('skip does not emit Idle and late process errors cannot stop the next song', async t => {
  const f = fixture();
  const { player, ffmpeg } = await playing(f);
  t.after(() => player.stop(true));
  const states = []; player.on('stateChange', (_old, state) => states.push(state.status));
  const next = new f.AudioResource('next song'); player.play(next);
  ffmpeg.emit('exit', 1); ffmpeg.emit('error', new Error('old process'));
  await tick();
  assert.equal(player.state.resource, next);
  assert.equal(player.state.status, 'buffering');
  assert.ok(!states.includes('idle'));
});

test('error listeners can synchronously start the next song without an Idle overwrite', async t => {
  const f = fixture();
  const { player, ffmpeg } = await playing(f);
  t.after(() => player.stop(true));
  const next = new f.AudioResource('next song');
  player.once('error', () => player.play(next));
  ffmpeg.emit('error', new Error('decoder failed')); await tick();
  assert.equal(player.state.resource, next);
  assert.equal(player.state.status, 'buffering');
});

test('disconnect auto-pauses, reconnect republishes and continues without restarting the decoder', async t => {
  const f = fixture(); const room1 = new f.Room(); let room = room1;
  const connection = { getRoom: () => room };
  const player = new f.AudioPlayer(); player.subscribe(connection); await tick();
  t.after(() => player.stop(true));
  player.play(new f.AudioResource('song'));
  const ffmpeg = f.children[0]; ffmpeg.stdout.write(f.pcm(1, 1)); await tick();
  room = null; player.onConnectionDisconnected(connection);
  assert.equal(player.state.status, 'autopaused');
  ffmpeg.stdout.write(f.pcm(1, 2)); await tick();
  room = new f.Room(); player.onConnectionReady(connection); await tick();
  assert.equal(player.state.status, 'playing');
  assert.deepEqual(f.sources[1].frames.map(frame => frame[0]), [2]);
  assert.equal(f.children.filter(child => child.command === 'ffmpeg').length, 1);
});

test('subscribe during buffering starts once; duplicate ready events do not spawn more decoders', async t => {
  const f = fixture(); const player = new f.AudioPlayer();
  t.after(() => player.stop(true));
  player.play(new f.AudioResource('song'));
  const connection = f.connection(); player.subscribe(connection);
  player.onConnectionReady(connection); player.onConnectionReady(connection); await tick();
  assert.equal(f.children.filter(child => child.command === 'ffmpeg').length, 1);
});

test('natural completion waits for native playout, including a partial final frame', async t => {
  const f = fixture(); const { player, ffmpeg, resource } = await playing(f);
  t.after(() => player.stop(true));
  const gate = deferred(); f.sources[0].playoutGate = gate.promise;
  ffmpeg.stdout.end(f.pcm(1).subarray(0, 100)); await tick();
  assert.equal(f.sources[0].frames.length, 1);
  assert.equal(player.state.status, 'playing');
  gate.resolve(); await tick();
  assert.equal(player.state.status, 'idle'); assert.equal(resource.ended, true);
});

test('multiple subscriptions publish independently and receive the same frames', async t => {
  const f = fixture(); const { player, ffmpeg } = await playing(f);
  t.after(() => player.stop(true));
  player.subscribe(f.connection()); await tick();
  ffmpeg.stdout.write(f.pcm(1, 99)); await tick();
  assert.equal(f.sources.length, 2);
  assert.equal(f.sources[0].frames[0][0], 99); assert.equal(f.sources[1].frames[0][0], 99);
});

test('volume changes are applied to the PCM samples', async t => {
  const f = fixture(); const { player, ffmpeg, resource } = await playing(f);
  t.after(() => player.stop(true));
  resource.setVolume(0.5); ffmpeg.stdout.write(f.pcm(1, 1000)); await tick();
  assert.equal(f.sources[0].frames[0][0], 500);
});

test('stop behavior does not cancel a song merely because its first track is being published', async t => {
  const f = fixture(); const { player, ffmpeg } = await playing(f, { behaviors: { noSubscriber: 'stop' } });
  t.after(() => player.stop(true));
  ffmpeg.stdout.write(f.pcm(1)); await tick();
  assert.equal(player.state.status, 'playing');
});

test('unsubscribe uses the server publication SID and closes the native track and source once', async t => {
  const f = fixture(); const { player, connection } = await playing(f);
  t.after(() => player.stop(true));
  player.unsubscribe(connection); player.unsubscribe(connection); await tick();
  assert.deepEqual(f.rooms[0].unpublished, ['published-1']);
  assert.equal(f.tracks[0].closed, 1); assert.equal(f.sources[0].closed, 1);
});

test('a late publication is unpublished and disposed after the connection has gone away', async () => {
  const f = fixture(), gate = deferred(), room = new f.Room(); room.publishGate = gate.promise;
  const player = new f.AudioPlayer(), connection = f.connection(room);
  player.subscribe(connection); player.unsubscribe(connection);
  assert.equal(f.sources[0].closed, 0);
  gate.resolve(); await tick();
  assert.deepEqual(room.unpublished, ['published-1']);
  assert.equal(f.tracks[0].closed, 1); assert.equal(f.sources[0].closed, 1);
});

test('native handles stay alive until an in-flight capture completes', async t => {
  const f = fixture(), gate = deferred(); f.setCaptureGate(gate.promise);
  const { player, connection, ffmpeg } = await playing(f);
  t.after(() => { player.stop(true); gate.resolve(); });
  ffmpeg.stdout.write(f.pcm(1)); await tick();
  player.unsubscribe(connection); await tick();
  assert.equal(f.sources[0].closed, 0);
  gate.resolve(); await tick();
  assert.equal(f.sources[0].closed, 1); assert.equal(f.tracks[0].closed, 1);
});

test('a frame awaiting native capture survives a room replacement', async t => {
  const f = fixture(), gate = deferred(); f.setCaptureGate(gate.promise);
  const { player, connection, ffmpeg } = await playing(f);
  t.after(() => { player.stop(true); gate.resolve(); });
  ffmpeg.stdout.write(f.pcm(1, 77)); await tick();
  player.onConnectionDisconnected(connection);
  player.unsubscribe(connection);
  f.setCaptureGate(null); player.subscribe(f.connection()); await tick();
  gate.resolve(); await tick();
  assert.equal(f.sources[1].frames[0][0], 77);
  assert.equal(player.state.status, 'playing');
});
