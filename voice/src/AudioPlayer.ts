import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { Readable } from 'stream';
import { Room, LocalAudioTrack, AudioSource, TrackPublishOptions, TrackSource, AudioFrame } from '@livekit/rtc-node';
import type { LocalTrackPublication } from '@livekit/rtc-node';
import { AudioPlayerStatus, StreamType } from './enums';
import { CreateAudioPlayerOptions, AudioPlayerState } from './types';
import { AudioResource } from './AudioResource';
import type { VoiceConnection } from './VoiceConnection';

const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const SAMPLES_PER_FRAME = 960;
const FRAME_BYTES = SAMPLES_PER_FRAME * CHANNELS * 2;
const MAX_STDERR_BYTES = 8192;

interface PlaybackSession {
  resource: AudioResource;
  cancelled: boolean;
  running: boolean;
  ffmpeg?: ChildProcess;
  input?: Readable;
  pcm?: Readable;
  abort: AbortController;
  startupTimeout?: NodeJS.Timeout;
}

interface AudioBinding {
  room: Room;
  source: AudioSource;
  track: LocalAudioTrack;
  ready: boolean;
  publication?: LocalTrackPublication;
  publishing?: Promise<LocalTrackPublication>;
  capture?: Promise<void>;
  closing?: Promise<void>;
}

export class AudioPlayer extends EventEmitter {
  public state: AudioPlayerState = { status: AudioPlayerStatus.Idle };
  private readonly options: CreateAudioPlayerOptions;
  private readonly subscriptions = new Set<VoiceConnection>();
  private readonly bindings = new Map<VoiceConnection, AudioBinding>();
  private readonly waiters = new Set<() => void>();
  private session: PlaybackSession | null = null;

  constructor(options: CreateAudioPlayerOptions = {}) {
    super();
    this.options = { ...options, behaviors: { noSubscriber: 'pause', maxMissedFrames: 5, ...options.behaviors } };
    this.on('error', error => {
      if (this.listenerCount('error') === 1) console.error('[AudioPlayer]', error.message);
    });
  }

  play(resource: AudioResource): void {
    // Replacing a song is not an Idle transition: queue handlers must not start a third song.
    this.cancelSession();
    const session: PlaybackSession = { resource, cancelled: false, running: false, abort: new AbortController() };
    this.session = session;
    this.setState({ status: AudioPlayerStatus.Buffering, resource });
    this.startIfReady();
  }

  pause(): boolean {
    if (this.state.status !== AudioPlayerStatus.Playing) return false;
    this.setState({ status: AudioPlayerStatus.Paused, resource: this.session?.resource });
    return true;
  }

  unpause(): boolean {
    if (this.state.status !== AudioPlayerStatus.Paused) return false;
    const status = this.readyBindings().length || this.options.behaviors?.noSubscriber === 'play'
      ? AudioPlayerStatus.Playing : AudioPlayerStatus.AutoPaused;
    this.setState({ status, resource: this.session?.resource });
    return true;
  }

  stop(force = false): boolean {
    if (!this.session && this.state.status === AudioPlayerStatus.Idle && !force) return false;
    this.cancelSession();
    this.setState({ status: AudioPlayerStatus.Idle });
    return true;
  }

  subscribe(connection: VoiceConnection): void {
    this.subscriptions.add(connection);
    if (connection.getRoom()) this.onConnectionReady(connection);
  }

  unsubscribe(connection: VoiceConnection): void {
    this.subscriptions.delete(connection);
    this.onConnectionDisconnected(connection);
  }

  onConnectionReady(connection: VoiceConnection): void {
    if (!this.subscriptions.has(connection)) return;
    const room = connection.getRoom();
    if (!room || this.bindings.get(connection)?.room === room) return;
    if (this.bindings.has(connection)) this.onConnectionDisconnected(connection);
    const source = new AudioSource(SAMPLE_RATE, CHANNELS, 200);
    const track = LocalAudioTrack.createAudioTrack('music', source);
    const binding: AudioBinding = { room, source, track, ready: false };
    this.bindings.set(connection, binding);
    const options = new TrackPublishOptions();
    options.source = TrackSource.SOURCE_MICROPHONE;
    void (async () => {
      try {
        if (!room.localParticipant) throw new Error('LiveKit local participant is unavailable');
        binding.publishing = room.localParticipant.publishTrack(track, options);
        binding.publication = await binding.publishing;
        if (this.bindings.get(connection) !== binding) {
          await this.closeBinding(binding);
          return;
        }
        binding.ready = true;
        if (this.state.status === AudioPlayerStatus.AutoPaused) {
          this.setState({ status: this.session?.resource.started ? AudioPlayerStatus.Playing : AudioPlayerStatus.Buffering, resource: this.session?.resource });
        }
        this.wake();
        this.startIfReady();
      } catch (error) {
        if (this.bindings.get(connection) !== binding) return;
        this.bindings.delete(connection);
        void this.closeBinding(binding);
        this.handleNoConnection();
        this.emit('error', { message: (error as Error).message, resource: this.session?.resource });
      }
    })();
  }

  onConnectionDisconnected(connection: VoiceConnection): void {
    const binding = this.bindings.get(connection);
    this.bindings.delete(connection);
    if (binding) void this.closeBinding(binding);
    this.handleNoConnection();
    this.wake();
  }

  private readyBindings(): AudioBinding[] {
    return [...this.bindings.values()].filter(binding => binding.ready);
  }

  private closeBinding(binding: AudioBinding): Promise<void> {
    if (binding.closing) return binding.closing;
    binding.source.clearQueue();
    binding.closing = (async () => {
      try {
        await binding.publishing?.catch(() => {});
        const sid = binding.publication?.sid ?? binding.track.sid;
        if (sid) await binding.room.localParticipant?.unpublishTrack(sid).catch(() => {});
        await binding.capture?.catch(() => {});
      } finally {
        try { await binding.track.close(false); }
        finally { await binding.source.close(); }
      }
    })().catch(() => {});
    return binding.closing;
  }

  private handleNoConnection(): void {
    if (!this.session || this.readyBindings().length) return;
    if (this.options.behaviors?.noSubscriber === 'stop') this.stop();
    else if (this.options.behaviors?.noSubscriber === 'pause' && this.state.status !== AudioPlayerStatus.Paused) {
      this.setState({ status: AudioPlayerStatus.AutoPaused, resource: this.session.resource });
    }
  }

  private startIfReady(): void {
    const session = this.session;
    if (!session || session.running || !this.readyBindings().length) return;
    session.running = true;
    void this.run(session);
  }

  private isCurrent(session: PlaybackSession): boolean {
    return this.session === session && !session.cancelled;
  }

  private async run(session: PlaybackSession): Promise<void> {
    try {
      session.startupTimeout = setTimeout(() => this.fail(session, new Error('Timeout waiting for audio data')), 10000);
      await this.startDecoder(session);
      if (!this.isCurrent(session)) return;
      let pending = Buffer.alloc(0);
      // Reading only as fast as frames are captured bounds both Node's stream and the OS pipes.
      for await (const data of session.pcm!) {
        if (!this.isCurrent(session)) return;
        const chunk = pending.length ? Buffer.concat([pending, data as Buffer]) : data as Buffer;
        if (chunk.length >= FRAME_BYTES) clearTimeout(session.startupTimeout);
        let offset = 0;
        while (offset + FRAME_BYTES <= chunk.length) {
          if (!await this.sendFrame(session, chunk.subarray(offset, offset + FRAME_BYTES))) return;
          offset += FRAME_BYTES;
        }
        pending = Buffer.from(chunk.subarray(offset));
      }
      if (!this.isCurrent(session)) return;
      if (pending.length) {
        clearTimeout(session.startupTimeout);
        const lastFrame = Buffer.alloc(FRAME_BYTES);
        pending.copy(lastFrame);
        if (!await this.sendFrame(session, lastFrame)) return;
      }
      if (!session.resource.started) throw new Error('FFmpeg failed to produce audio data');
      await Promise.all(this.readyBindings().map(binding => binding.source.waitForPlayout()));
      if (this.isCurrent(session)) this.stop();
    } catch (error) {
      if (this.isCurrent(session)) this.fail(session, error as Error);
    }
  }

  private async sendFrame(session: PlaybackSession, pcm: Buffer): Promise<boolean> {
    while (this.isCurrent(session)) {
      if (this.state.status === AudioPlayerStatus.Paused ||
          (!this.readyBindings().length && this.options.behaviors?.noSubscriber !== 'play')) {
        await new Promise<void>(resolve => this.waiters.add(resolve));
        continue;
      }
      const samples = new Int16Array(SAMPLES_PER_FRAME * CHANNELS);
      const volume = session.resource.getVolume();
      for (let i = 0; i < samples.length; i++) samples[i] = Math.round(pcm.readInt16LE(i * 2) * volume);
      const frame = new AudioFrame(samples, SAMPLE_RATE, CHANNELS, SAMPLES_PER_FRAME);
      const bindings = this.readyBindings();
      if (bindings.length) {
        // AudioSource applies native queue backpressure; a second JS scheduler causes drift.
        const delivered = await Promise.all(bindings.map(async binding => {
          // Cancellation clears the queue but an earlier native capture can still
          // be completing. AudioSource permits only one in-flight capture.
          await binding.capture?.catch(() => {});
          if (!this.isCurrent(session) || ![...this.bindings.values()].includes(binding)) return false;
          const capture = binding.capture = binding.source.captureFrame(frame);
          try { await capture; }
          catch (error) {
            if (this.isCurrent(session) && [...this.bindings.values()].includes(binding)) throw error;
          }
          finally { if (binding.capture === capture) binding.capture = undefined; }
          return [...this.bindings.values()].includes(binding);
        }));
        // Retain an in-flight frame if all its rooms disappeared during capture.
        if (!delivered.some(Boolean) && this.options.behaviors?.noSubscriber !== 'play') continue;
      } else {
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      if (!this.isCurrent(session)) return false;
      if (!session.resource.started) {
        session.resource.started = true;
        if (this.state.status === AudioPlayerStatus.Buffering) {
          this.setState({ status: AudioPlayerStatus.Playing, resource: session.resource });
        }
      }
      return true;
    }
    return false;
  }

  private async startDecoder(session: PlaybackSession): Promise<void> {
    const resource = session.resource;
    const input = resource.getInputSource();
    const directPcm = resource.inputType === StreamType.Raw && resource.sampleRate === SAMPLE_RATE && resource.numChannels === CHANNELS;
    if (directPcm || typeof input !== 'string') {
      const stream = await resource.openStream(session.abort.signal);
      if (!this.isCurrent(session)) { stream.destroy(); return; }
      session.input = stream;
      stream.on('error', error => this.fail(session, error));
      if (directPcm) { session.pcm = stream; return; }
    }
    if (!this.isCurrent(session)) return;
    const isUrl = typeof input === 'string' && /^https?:\/\//.test(input);
    const inputArgs: string[] = [];
    if (resource.inputType === StreamType.Raw) {
      inputArgs.push('-f', 's16le', '-ar', String(resource.sampleRate), '-ac', String(resource.numChannels));
    } else if (resource.inputType === StreamType.Opus || resource.inputType === StreamType.OggOpus) inputArgs.push('-f', 'ogg');
    else if (resource.inputType === StreamType.WebmOpus) inputArgs.push('-f', 'matroska');
    if (isUrl) {
      inputArgs.push('-rw_timeout', '10000000');
      const headers = Object.entries(resource.headers).map(([key, value]) => key + ': ' + value + '\r\n').join('');
      if (headers) inputArgs.push('-headers', headers);
    }
    const protocols = isUrl ? 'http,https,tcp,tls,crypto,pipe' : session.input ? 'pipe' : 'file,pipe';
    const ffmpeg = session.ffmpeg = spawn(this.options.ffmpegPath ?? 'ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-protocol_whitelist', protocols, ...inputArgs,
      '-i', session.input ? 'pipe:0' : input as string,
      '-vn', '-f', 's16le', '-ar', String(SAMPLE_RATE), '-ac', String(CHANNELS), '-acodec', 'pcm_s16le', 'pipe:1',
    ], { stdio: ['pipe', 'pipe', 'pipe'], shell: false, windowsHide: true });
    session.pcm = ffmpeg.stdout!;
    let stderr = '';
    ffmpeg.stderr?.on('data', (chunk: Buffer) => { stderr = (stderr + chunk.toString()).slice(-MAX_STDERR_BYTES); });
    ffmpeg.on('error', error => this.fail(session, error));
    ffmpeg.stdin?.on('error', error => this.fail(session, error));
    ffmpeg.on('exit', code => {
      if (code !== 0 && this.isCurrent(session)) this.fail(session, new Error('FFmpeg exited with code ' + code + ': ' + stderr));
    });
    if (session.input) session.input.pipe(ffmpeg.stdin!);
    else ffmpeg.stdin?.end();
  }

  private fail(session: PlaybackSession, error: Error): void {
    if (!this.isCurrent(session)) return;
    const resource = session.resource;
    this.cancelSession();
    // Error listeners may synchronously play the next song. Never overwrite that new state.
    this.emit('error', { message: error.message, resource });
    if (!this.session) this.setState({ status: AudioPlayerStatus.Idle });
  }

  private cancelSession(): void {
    const session = this.session;
    this.session = null;
    if (session) {
      session.cancelled = true;
      session.resource.ended = true;
      clearTimeout(session.startupTimeout);
      session.abort.abort();
      session.input?.unpipe();
      session.input?.destroy();
      for (const child of [session.ffmpeg]) {
        child?.stdin?.destroy();
        child?.stdout?.destroy();
        child?.kill('SIGKILL');
      }
    }
    for (const binding of this.bindings.values()) binding.source.clearQueue();
    this.wake();
  }

  private wake(): void {
    for (const resolve of this.waiters) resolve();
    this.waiters.clear();
  }

  private setState(state: AudioPlayerState): void {
    const previous = this.state;
    this.state = state;
    this.wake();
    this.emit('stateChange', previous, state);
  }
}

export function createAudioPlayer(options?: CreateAudioPlayerOptions): AudioPlayer {
  return new AudioPlayer(options);
}
