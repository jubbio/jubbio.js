import { createReadStream } from 'fs';
import path from 'path';
import { Readable, addAbortSignal } from 'stream';
import { fileURLToPath } from 'url';
import { StreamType } from './enums';
import { CreateAudioResourceOptions, AudioResourceInput } from './types';
import { opusPacketsToOgg } from './opusStream';
import { extractAudioWithYtDlp } from './ytDlp';

export class AudioResource<T = unknown> {
  public readonly metadata: T;
  public started = false;
  public ended = false;
  public readonly inputType: StreamType;
  public readonly sampleRate: number;
  public readonly numChannels: number;
  public readonly headers: Record<string, string>;
  private readonly input: Exclude<AudioResourceInput, URL>;
  private volume = 1;

  constructor(input: AudioResourceInput, options: CreateAudioResourceOptions<T> = {}) {
    this.metadata = options.metadata as T;
    this.inputType = options.inputType ?? StreamType.Arbitrary;
    this.sampleRate = options.sampleRate ?? 48000;
    this.numChannels = options.numChannels ?? 2;
    this.headers = { ...options.headers };
    if (!Number.isInteger(this.sampleRate) || this.sampleRate < 8000 || this.sampleRate > 192000) throw new RangeError('Invalid input sample rate');
    if (!Number.isInteger(this.numChannels) || this.numChannels < 1 || this.numChannels > 8) throw new RangeError('Invalid input channel count');
    for (const [key, value] of Object.entries(this.headers)) {
      if (!key || /[\r\n:]/.test(key) || /[\r\n]/.test(value)) throw new Error('Invalid media request header');
    }
    if (input instanceof URL || typeof input === 'string') {
      const value = String(input);
      if (!value.trim()) throw new TypeError('Audio input must not be empty');
      if (input instanceof URL || /^[a-z][a-z\d+.-]*:\/\//i.test(value)) {
        const url = new URL(value);
        if (url.protocol === 'file:') this.input = fileURLToPath(url);
        else if (url.protocol === 'http:' || url.protocol === 'https:') this.input = url.href;
        else throw new Error('Only file paths and HTTP(S) media URLs are supported');
      } else this.input = path.resolve(value);
    } else {
      if (!input || typeof input[Symbol.asyncIterator] !== 'function') throw new TypeError('Audio input must be a file, URL, Readable or async byte iterable');
      if (this.inputType === StreamType.Opus && input instanceof Readable && !input.readableObjectMode) {
        throw new Error('Raw Opus requires an async iterable or object-mode Readable with one packet per item; use OggOpus/WebmOpus for byte streams');
      }
      this.input = input;
    }
    if (this.inputType === StreamType.Opus && (typeof this.input === 'string' || this.numChannels > 2)) {
      throw new Error('Raw Opus requires mono/stereo packet input; use OggOpus/WebmOpus for files and URLs');
    }
  }

  /** @internal */
  getInputSource(): Exclude<AudioResourceInput, URL> { return this.input; }

  /** @internal: opens lazily, and playback cancellation owns/destroys the returned stream. */
  async openStream(signal: AbortSignal): Promise<Readable> {
    let stream: Readable;
    if (typeof this.input === 'string') {
      if (/^https?:\/\//.test(this.input)) {
        const response = await fetch(this.input, { headers: this.headers, signal });
        if (!response.ok || !response.body) {
          await response.body?.cancel();
          throw new Error(`Media request failed: HTTP ${response.status}`);
        }
        stream = Readable.fromWeb(response.body);
      } else stream = createReadStream(this.input);
    } else {
      const input = this.input;
      if (input instanceof Readable) {
        input.on('error', () => {});
        addAbortSignal(signal, input);
      }
      const bytes = (async function* () {
        for await (const chunk of input) {
          if (!(chunk instanceof Uint8Array)) throw new TypeError('Audio streams must yield Uint8Array or Buffer chunks');
          yield chunk;
        }
      })();
      stream = Readable.from(this.inputType === StreamType.Opus ? opusPacketsToOgg(bytes, this.numChannels) : bytes, { objectMode: false });
    }
    // Cancellation can occur before the player's reader attaches on the next microtask.
    stream.on('error', () => {});
    return addAbortSignal(signal, stream);
  }

  setVolume(volume: number): void {
    if (!Number.isFinite(volume)) throw new RangeError('Volume must be a finite number');
    this.volume = Math.max(0, Math.min(1, volume));
  }
  getVolume(): number { return this.volume; }
}

export interface CreateAudioResourceFromUrlOptions<T = unknown> extends CreateAudioResourceOptions<T> {
  /** Explicit, optional extraction helper. The generic player never starts yt-dlp. */
  useYtDlp?: boolean;
  ytDlpPath?: string;
}

export function createAudioResource<T = unknown>(input: AudioResourceInput, options?: CreateAudioResourceOptions<T>): AudioResource<T> {
  return new AudioResource(input, options);
}

export function createAudioResourceFromUrl<T = unknown>(url: string, options: CreateAudioResourceFromUrlOptions<T> = {}): AudioResource<T> {
  return new AudioResource(options.useYtDlp ? extractAudioWithYtDlp(url, options.ytDlpPath) : new URL(url), options);
}

// Backward-compatible explicit helper; source/platform resolution remains opt-in.
export { probeAudioInfo } from './ytDlp';
