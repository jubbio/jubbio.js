import { Readable } from 'stream';
import { StreamType } from './enums';
import { CreateAudioResourceOptions, AudioResourceInput } from './types';
export declare class AudioResource<T = unknown> {
    readonly metadata: T;
    started: boolean;
    ended: boolean;
    readonly inputType: StreamType;
    readonly sampleRate: number;
    readonly numChannels: number;
    readonly headers: Record<string, string>;
    private readonly input;
    private volume;
    constructor(input: AudioResourceInput, options?: CreateAudioResourceOptions<T>);
    /** @internal */
    getInputSource(): Exclude<AudioResourceInput, URL>;
    /** @internal: opens lazily, and playback cancellation owns/destroys the returned stream. */
    openStream(signal: AbortSignal): Promise<Readable>;
    setVolume(volume: number): void;
    getVolume(): number;
}
export interface CreateAudioResourceFromUrlOptions<T = unknown> extends CreateAudioResourceOptions<T> {
    /** Explicit, optional extraction helper. The generic player never starts yt-dlp. */
    useYtDlp?: boolean;
    ytDlpPath?: string;
}
export declare function createAudioResource<T = unknown>(input: AudioResourceInput, options?: CreateAudioResourceOptions<T>): AudioResource<T>;
export declare function createAudioResourceFromUrl<T = unknown>(url: string, options?: CreateAudioResourceFromUrlOptions<T>): AudioResource<T>;
export { probeAudioInfo } from './ytDlp';
