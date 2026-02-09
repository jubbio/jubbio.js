import { EventEmitter } from 'events';
import { CreateAudioPlayerOptions, AudioPlayerState } from './types';
import { AudioResource } from './AudioResource';
import { VoiceConnection } from './VoiceConnection';
/**
 * Audio player for playing audio resources
 */
export declare class AudioPlayer extends EventEmitter {
    /** Current player state */
    state: AudioPlayerState;
    /** Player options */
    private options;
    /** Subscribed voice connections */
    private subscriptions;
    /** Current audio resource */
    private currentResource;
    /** FFmpeg process */
    private ffmpegProcess;
    /** LiveKit audio source and track */
    private audioSource;
    private audioTrack;
    /** Frame queue and playback state */
    private frameQueue;
    private playbackTimeout;
    private leftoverBuffer;
    private isPublished;
    /** High-resolution timing */
    private nextFrameTime;
    private isPlaybackLoopRunning;
    private ffmpegDone;
    /** Buffer statistics */
    private bufferUnderruns;
    private framesPlayed;
    constructor(options?: CreateAudioPlayerOptions);
    /**
     * Play an audio resource
     */
    play(resource: AudioResource): void;
    /**
     * Pause playback
     */
    pause(): boolean;
    /**
     * Unpause playback
     */
    unpause(): boolean;
    /**
     * Stop playback
     */
    stop(force?: boolean): boolean;
    /**
     * Subscribe a voice connection to this player
     * @internal
     */
    subscribe(connection: VoiceConnection): void;
    /**
     * Unsubscribe a voice connection from this player
     * @internal
     */
    unsubscribe(connection: VoiceConnection): void;
    /**
     * Called when a connection becomes ready
     * @internal
     */
    onConnectionReady(connection: VoiceConnection): void;
    private startPlayback;
    private setupAudioTrack;
    private startFFmpeg;
    /**
     * High-resolution frame scheduling using hrtime
     * This provides much more accurate timing than setInterval
     */
    private scheduleNextFrame;
    /**
     * Process and send a single audio frame
     */
    private processFrame;
    private cleanup;
    private setState;
}
/**
 * Create an audio player
 */
export declare function createAudioPlayer(options?: CreateAudioPlayerOptions): AudioPlayer;
