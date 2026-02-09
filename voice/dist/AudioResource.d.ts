import { CreateAudioResourceOptions, AudioResourceInput } from './types';
/**
 * Represents an audio resource that can be played
 */
export declare class AudioResource<T = unknown> {
    /** Metadata attached to this resource */
    readonly metadata: T;
    /** Whether playback has started */
    started: boolean;
    /** Whether playback has ended */
    ended: boolean;
    /** The input source (URL or file path) */
    private inputSource;
    /** Stream type */
    private streamType;
    /** Volume (0-1) */
    private volume;
    constructor(input: AudioResourceInput, options?: CreateAudioResourceOptions<T>);
    /**
     * Get the input source for FFmpeg
     * @internal
     */
    getInputSource(): string;
    /**
     * Set the volume (0-1)
     */
    setVolume(volume: number): void;
    /**
     * Get the current volume
     */
    getVolume(): number;
}
/**
 * Options for creating audio resource from URL
 */
export interface CreateAudioResourceFromUrlOptions<T = unknown> extends CreateAudioResourceOptions<T> {
    /** Use yt-dlp to extract audio URL */
    useYtDlp?: boolean;
    /** Path to yt-dlp binary */
    ytDlpPath?: string;
}
/**
 * Create an audio resource from various inputs
 */
export declare function createAudioResource<T = unknown>(input: AudioResourceInput, options?: CreateAudioResourceOptions<T>): AudioResource<T>;
/**
 * Create an audio resource from a YouTube/streaming URL
 * Stores the original URL - extraction happens at playback time
 */
export declare function createAudioResourceFromUrl<T = unknown>(url: string, options?: CreateAudioResourceFromUrlOptions<T>): AudioResource<T>;
/**
 * Probe audio info from a URL or search query
 * If input is not a URL, it will search YouTube
 */
export declare function probeAudioInfo(input: string, ytDlpPath?: string): Promise<{
    title: string;
    duration: number;
    thumbnail?: string;
    url: string;
}>;
