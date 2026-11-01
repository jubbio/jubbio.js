const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const rtc = require('@livekit/rtc-node');
const path = require('node:path');
const { loader } = require('./helpers.cjs');
const load = loader({});
const { AudioPlayer } = load(path.join(__dirname, '../src/AudioPlayer.ts'));
const { createAudioResource } = load(path.join(__dirname, '../src/AudioResource.ts'));
const { StreamType } = load(path.join(__dirname, '../src/enums.ts'));

after(async () => rtc.dispose());

async function* pcm(fault = false) {
  for (let i = 0; i < 20; i++) {
    if (fault && i === 12) throw new Error('expected-source-failure');
    yield Buffer.alloc(960 * 4);
  }
}

test('native player recovers from source failure without overlapping captures', { timeout: 15000 }, async () => {
  const player = new AudioPlayer();
  const room = { localParticipant: { publishTrack: async () => ({ sid: 'local-test' }), unpublishTrack: async () => {} } };
  const connection = { getRoom: () => room };
  const errors = [];
  player.on('error', error => errors.push(error.message));
  player.subscribe(connection);
  try {
    await new Promise(resolve => setImmediate(resolve));
    for (let i = 0; i < 8; i++) {
      const recovery = createAudioResource(pcm(), { inputType: StreamType.Raw });
      await new Promise((resolve, reject) => {
        let recovering = false;
        const timer = setTimeout(() => { player.off('stateChange', changed); reject(new Error('recovery timeout')); }, 1200);
        const changed = (_, next) => {
          if (next.status !== 'idle') return;
          if (!recovering) {
            recovering = true;
            player.play(recovery);
          } else {
            clearTimeout(timer);
            player.off('stateChange', changed);
            resolve();
          }
        };
        player.on('stateChange', changed);
        player.play(createAudioResource(pcm(true), { inputType: StreamType.Raw }));
      });
      assert.equal(recovery.started, true, JSON.stringify(errors));
      assert.equal(recovery.ended, true);
    }
    assert.equal(errors.length, 8);
    assert.ok(errors.every(message => message === 'expected-source-failure'), JSON.stringify(errors));
  } finally {
    player.stop(true);
    player.unsubscribe(connection);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
});
