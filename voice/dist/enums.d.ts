/**
 * Voice connection status
 */
export declare enum VoiceConnectionStatus {
    /** Connection is being established */
    Connecting = "connecting",
    /** Connection is ready to use */
    Ready = "ready",
    /** Connection is disconnected */
    Disconnected = "disconnected",
    /** Connection is destroyed */
    Destroyed = "destroyed",
    /** Connection is signalling (exchanging info with server) */
    Signalling = "signalling"
}
/**
 * Audio player status
 */
export declare enum AudioPlayerStatus {
    /** Player is idle (not playing anything) */
    Idle = "idle",
    /** Player is buffering audio */
    Buffering = "buffering",
    /** Player is playing audio */
    Playing = "playing",
    /** Player is paused */
    Paused = "paused",
    /** Player is auto-paused (no subscribers) */
    AutoPaused = "autopaused"
}
/**
 * Audio resource type
 */
export declare enum StreamType {
    /** Arbitrary audio stream */
    Arbitrary = "arbitrary",
    /** Raw PCM audio */
    Raw = "raw",
    /** Opus encoded audio */
    Opus = "opus",
    /** OGG/Opus container */
    OggOpus = "ogg/opus",
    /** WebM/Opus container */
    WebmOpus = "webm/opus"
}
