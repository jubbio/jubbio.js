const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { fixture, tick, deferred } = require('./helpers.cjs');

function adapter() {
  const sent = []; let methods, destroyed = 0;
  const creator = callbacks => { methods = callbacks; return {
    sendPayload: payload => { sent.push(payload); return true; },
    destroy: () => { destroyed++; },
  }; };
  return { creator, sent, get methods() { return methods; }, get destroyed() { return destroyed; } };
}
const server = { endpoint: 'wss://voice.example', token: 'fixture', room: 'room' };

test('late native connect cannot revive a destroyed connection or leave it in the registry', async () => {
  const f = fixture(), a = adapter(), gate = deferred(); f.setConnectGate(gate.promise);
  const connection = f.joinVoiceChannel({ guildId: '1', channelId: '2', adapterCreator: a.creator });
  a.methods.onVoiceServerUpdate(server); await tick();
  assert.equal(connection.getRoom(), null);
  connection.destroy(); connection.destroy();
  assert.equal(a.destroyed, 1);
  assert.equal(f.getVoiceConnection('1'), undefined);
  gate.resolve(); await tick();
  assert.equal(connection.state.status, 'destroyed');
  assert.equal(f.rooms[0].disconnectCount, 2);
  assert.equal(a.sent.at(-1).d.channel_id, null);
  assert.equal(connection.rejoin(), false);
});

test('changing channels replaces the guild connection and keeps different clients isolated', () => {
  const f = fixture(), a = adapter(), b = adapter();
  const first = f.joinVoiceChannel({ guildId: '1', channelId: '2', adapterCreator: a.creator });
  const otherBot = f.joinVoiceChannel({ guildId: '1', channelId: '2', adapterCreator: b.creator });
  const next = f.joinVoiceChannel({ guildId: '1', channelId: '3', adapterCreator: a.creator });
  assert.equal(first.state.status, 'destroyed');
  assert.deepEqual(a.sent.map(payload => payload.d.channel_id), ['2', '3']);
  assert.equal(f.getVoiceConnection('1', a.creator), next);
  assert.equal(f.getVoiceConnection('1', b.creator), otherBot);
  next.destroy(); otherBot.destroy();
  assert.equal(f.getVoiceConnection('1'), undefined);
});

test('old room disconnect events do not disconnect a replacement room', async () => {
  const f = fixture(), a = adapter();
  const connection = f.joinVoiceChannel({ guildId: '1', channelId: '2', adapterCreator: a.creator });
  a.methods.onVoiceServerUpdate(server); await tick();
  const old = f.rooms[0];
  a.methods.onVoiceServerUpdate({ ...server, token: 'replacement' }); await tick();
  old.emit('disconnected');
  assert.equal(connection.state.status, 'ready'); assert.equal(connection.getRoom(), f.rooms[1]);
  connection.destroy();
});

test('a pending old native connect cannot block replacement credentials', async () => {
  const f = fixture(), a = adapter(), gate = deferred(); f.setConnectGate(gate.promise);
  const connection = f.joinVoiceChannel({ guildId: '1', channelId: '2', adapterCreator: a.creator });
  a.methods.onVoiceServerUpdate(server); await tick();
  f.setConnectGate(null);
  a.methods.onVoiceServerUpdate({ ...server, token: 'new' }); await tick();
  assert.equal(connection.state.status, 'ready'); assert.equal(connection.getRoom(), f.rooms[1]);
  gate.resolve(); await tick();
  assert.equal(connection.getRoom(), f.rooms[1]);
  connection.destroy();
});

test('disconnect is immediate and rejoin retains mute/deaf preferences', async () => {
  const f = fixture(), a = adapter();
  const connection = f.joinVoiceChannel({ guildId: '1', channelId: '2', adapterCreator: a.creator, selfMute: true, selfDeaf: true });
  a.methods.onVoiceServerUpdate(server); await tick();
  assert.equal(connection.disconnect(), true);
  assert.equal(connection.getRoom(), null); assert.equal(connection.state.status, 'disconnected');
  assert.equal(connection.rejoin(), true);
  assert.equal(a.sent.at(-1).d.self_mute, true); assert.equal(a.sent.at(-1).d.self_deaf, true);
  connection.destroy();
});

test('native reconnect events notify the subscribed player and return to ready', async () => {
  const f = fixture(), a = adapter(); let ready = 0, disconnected = 0;
  const connection = f.joinVoiceChannel({ guildId: '1', channelId: '2', adapterCreator: a.creator });
  connection.subscribe({ subscribe() {}, unsubscribe() {}, onConnectionReady() { ready++; }, onConnectionDisconnected() { disconnected++; } });
  a.methods.onVoiceServerUpdate(server); await tick();
  f.rooms[0].emit('reconnecting');
  assert.equal(connection.getRoom(), null);
  f.rooms[0].emit('reconnected');
  assert.equal(connection.state.status, 'ready'); assert.equal(ready, 2); assert.equal(disconnected, 1);
  connection.destroy();
});

test('core forwards only the bot voice state to its adapter and still emits all member events', () => {
  const f = fixture();
  const { Client } = f.load(path.resolve(__dirname, '../../core/src/Client.ts'));
  const client = new Client({ intents: [] }); client.user = { id: '7' };
  client.createVoiceAdapter('1');
  let forwarded = 0, emitted = 0, destroyed = 0;
  client.voice.adapters.get('1')({ onVoiceStateUpdate: () => forwarded++, onVoiceServerUpdate() {}, destroy: () => destroyed++ });
  client.on('voiceStateUpdate', () => emitted++);
  client.handleVoiceStateUpdate({ guild_id: 1, user_id: '8', channel_id: null });
  assert.equal(forwarded, 0); assert.equal(emitted, 1);
  client.handleVoiceStateUpdate({ guild_id: 1, user_id: 7, channel_id: null });
  assert.equal(forwarded, 1); assert.equal(emitted, 2);
  client.destroy(); assert.equal(destroyed, 1);
});

test('core preserves adapter identity and an old adapter cannot delete replacement handlers', () => {
  const f = fixture();
  const { Client } = f.load(path.resolve(__dirname, '../../core/src/Client.ts'));
  const client = new Client({ intents: [] }); client.user = { id: '7' };
  client.createVoiceAdapter('1'); const creator = client.voice.adapters.get('1');
  client.createVoiceAdapter('1'); assert.equal(client.voice.adapters.get('1'), creator);
  let destroyed = 0, forwarded = 0;
  const old = creator({ onVoiceStateUpdate() {}, onVoiceServerUpdate() {}, destroy: () => destroyed++ });
  creator({ onVoiceStateUpdate: () => forwarded++, onVoiceServerUpdate() {}, destroy() {} });
  old.destroy();
  client.handleVoiceStateUpdate({ guild_id: '1', user_id: '7', channel_id: null });
  assert.equal(destroyed, 1); assert.equal(forwarded, 1);
  client.destroy();
});
