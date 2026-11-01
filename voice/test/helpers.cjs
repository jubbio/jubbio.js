const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const ts = require('../node_modules/typescript');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');

// Load the actual TS implementation with fake native/process boundaries, without building dist.
function loader(mocks) {
  const cache = new Map();
  return function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const require = createRequire(file);
    const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    }).outputText;
    const compiled = vm.runInThisContext(`(function(require, module, exports) { ${js}\n})`, { filename: file });
    compiled(name => {
      if (name in mocks) return mocks[name];
      const relative = path.resolve(path.dirname(file), name + '.ts');
      return name.startsWith('.') && fs.existsSync(relative) ? load(relative) : require(name);
    }, module, module.exports);
    return module.exports;
  };
}

const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

function fixture({ spawn: spawnOverride } = {}) {
  const children = [], sources = [], rooms = [], tracks = [];
  let blockCapture = null;
  let connectGate = null;
  class Room extends EventEmitter {
    constructor() {
      super();
      rooms.push(this);
      this.connectGate = connectGate;
      this.disconnectCount = 0;
      this.published = [];
      this.unpublished = [];
      this.localParticipant = {
        publishTrack: async track => {
          this.published.push(track);
          if (this.publishGate) await this.publishGate;
          return { sid: `published-${track.sid}` };
        },
        unpublishTrack: async sid => { this.unpublished.push(sid); },
      };
    }
    async connect() { if (this.connectGate) await this.connectGate; }
    async disconnect() { this.disconnectCount++; this.emit('disconnected'); }
  }
  class AudioSource {
    constructor(rate, channels, queueSize) {
      this.frames = []; this.cleared = 0; this.queueSize = queueSize; this.queuedDuration = 0; this.closed = 0;
      sources.push(this);
    }
    async captureFrame(frame) {
      this.frames.push([...frame.data]);
      if (blockCapture) await blockCapture;
    }
    clearQueue() { this.cleared++; }
    async waitForPlayout() { if (this.playoutGate) await this.playoutGate; }
    async close() { this.closed++; }
  }
  function spawn(command, args) {
    const child = new EventEmitter();
    Object.assign(child, { command, args, stdin: new PassThrough(), stdout: new PassThrough({ highWaterMark: 16384 }), stderr: new PassThrough(), killed: false });
    child.kill = () => { child.killed = true; child.emit('exit', null); return true; };
    children.push(child);
    return child;
  }
  const load = loader({
    '@livekit/rtc-node': {
      Room, RoomEvent: { Disconnected: 'disconnected', Reconnecting: 'reconnecting', Reconnected: 'reconnected' },
      AudioSource, AudioFrame: class { constructor(data) { this.data = data; } },
      LocalAudioTrack: { createAudioTrack: (_name, source) => {
        const track = { sid: String(sources.length), closed: 0,
          async close(closeSource = true) { this.closed++; if (closeSource) await source.close(); } };
        tracks.push(track);
        return track;
      } },
      TrackPublishOptions: class {}, TrackSource: { SOURCE_MICROPHONE: 1 },
    },
    child_process: { spawn: spawnOverride ?? spawn },
  });
  const base = path.resolve(__dirname, '../src');
  const { AudioPlayer } = load(path.join(base, 'AudioPlayer.ts'));
  const { AudioResource, probeAudioInfo } = load(path.join(base, 'AudioResource.ts'));
  const { joinVoiceChannel, getVoiceConnection } = load(path.join(base, 'VoiceConnection.ts'));
  const connection = (room = new Room()) => ({ getRoom: () => room });
  const pcm = (count, value = 123) => { const bytes = Buffer.alloc(3840 * count); for (let i = 0; i < bytes.length; i += 2) bytes.writeInt16LE(value, i); return bytes; };
  return { AudioPlayer, AudioResource, probeAudioInfo, joinVoiceChannel, getVoiceConnection,
    children, sources, rooms, tracks, Room, connection, pcm, load,
    setConnectGate: promise => { connectGate = promise; },
    setCaptureGate: promise => { blockCapture = promise; } };
}

module.exports = { fixture, loader, tick, deferred };
