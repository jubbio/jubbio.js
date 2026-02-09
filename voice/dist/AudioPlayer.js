"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioPlayer = void 0;
exports.createAudioPlayer = createAudioPlayer;
const events_1 = require("events");
const child_process_1 = require("child_process");
const process_1 = require("process");
const rtc_node_1 = require("@livekit/rtc-node");
const enums_1 = require("./enums");
// Audio settings for LiveKit (48kHz stereo)
const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const FRAME_DURATION_MS = 20;
const SAMPLES_PER_FRAME = (SAMPLE_RATE * FRAME_DURATION_MS) / 1000; // 960
// Jitter buffer settings
const FRAME_INTERVAL_NS = BigInt(20_000_000); // 20ms in nanoseconds
const TARGET_BUFFER_FRAMES = 150; // ~3 seconds - target buffer size
const MIN_BUFFER_FRAMES = 75; // ~1.5 seconds - minimum before we start
const MAX_BUFFER_FRAMES = 500; // ~10 seconds - max buffer to prevent memory issues
const LOW_BUFFER_THRESHOLD = 50; // ~1 second - when to slow down playback
/**
 * Audio player for playing audio resources
 */
class AudioPlayer extends events_1.EventEmitter {
    /** Current player state */
    state = { status: enums_1.AudioPlayerStatus.Idle };
    /** Player options */
    options;
    /** Subscribed voice connections */
    subscriptions = new Set();
    /** Current audio resource */
    currentResource = null;
    /** FFmpeg process */
    ffmpegProcess = null;
    /** LiveKit audio source and track */
    audioSource = null;
    audioTrack = null;
    /** Frame queue and playback state */
    frameQueue = [];
    playbackTimeout = null;
    leftoverBuffer = null;
    isPublished = false;
    /** High-resolution timing */
    nextFrameTime = BigInt(0);
    isPlaybackLoopRunning = false;
    ffmpegDone = false;
    /** Buffer statistics */
    bufferUnderruns = 0;
    framesPlayed = 0;
    constructor(options = {}) {
        super();
        this.options = {
            behaviors: {
                noSubscriber: 'pause',
                maxMissedFrames: 5,
                ...options.behaviors
            }
        };
    }
    /**
     * Play an audio resource
     */
    play(resource) {
        // Stop current playback
        this.stop();
        this.currentResource = resource;
        this.setState({ status: enums_1.AudioPlayerStatus.Buffering, resource });
        // Start playback if we have a ready connection
        for (const connection of this.subscriptions) {
            if (connection.getRoom()) {
                this.startPlayback(connection);
                break;
            }
        }
    }
    /**
     * Pause playback
     */
    pause() {
        if (this.state.status !== enums_1.AudioPlayerStatus.Playing) {
            return false;
        }
        this.setState({ status: enums_1.AudioPlayerStatus.Paused, resource: this.currentResource });
        return true;
    }
    /**
     * Unpause playback
     */
    unpause() {
        if (this.state.status !== enums_1.AudioPlayerStatus.Paused) {
            return false;
        }
        this.setState({ status: enums_1.AudioPlayerStatus.Playing, resource: this.currentResource });
        return true;
    }
    /**
     * Stop playback
     */
    stop(force = false) {
        if (this.state.status === enums_1.AudioPlayerStatus.Idle && !force) {
            return false;
        }
        this.cleanup();
        this.currentResource = null;
        this.setState({ status: enums_1.AudioPlayerStatus.Idle });
        return true;
    }
    /**
     * Subscribe a voice connection to this player
     * @internal
     */
    subscribe(connection) {
        this.subscriptions.add(connection);
    }
    /**
     * Unsubscribe a voice connection from this player
     * @internal
     */
    unsubscribe(connection) {
        this.subscriptions.delete(connection);
        // Auto-pause if no subscribers
        if (this.subscriptions.size === 0 && this.options.behaviors?.noSubscriber === 'pause') {
            if (this.state.status === enums_1.AudioPlayerStatus.Playing) {
                this.setState({ status: enums_1.AudioPlayerStatus.AutoPaused, resource: this.currentResource });
            }
        }
    }
    /**
     * Called when a connection becomes ready
     * @internal
     */
    onConnectionReady(connection) {
        // If we have a resource waiting, start playback
        if (this.currentResource && this.state.status === enums_1.AudioPlayerStatus.Buffering) {
            this.startPlayback(connection);
        }
    }
    async startPlayback(connection) {
        const room = connection.getRoom();
        if (!room || !this.currentResource)
            return;
        try {
            // Create audio source and track
            await this.setupAudioTrack(room);
            // Start FFmpeg to decode audio - this will set state to Playing when ready
            await this.startFFmpeg();
        }
        catch (error) {
            this.emit('error', { message: error.message, resource: this.currentResource });
            this.stop();
        }
    }
    async setupAudioTrack(room) {
        if (this.isPublished)
            return;
        this.audioSource = new rtc_node_1.AudioSource(SAMPLE_RATE, CHANNELS);
        this.audioTrack = rtc_node_1.LocalAudioTrack.createAudioTrack('music', this.audioSource);
        const options = new rtc_node_1.TrackPublishOptions();
        options.source = rtc_node_1.TrackSource.SOURCE_MICROPHONE;
        if (room.localParticipant) {
            await room.localParticipant.publishTrack(this.audioTrack, options);
        }
        this.isPublished = true;
    }
    async startFFmpeg() {
        if (!this.currentResource)
            return;
        const inputSource = this.currentResource.getInputSource();
        console.log(`FFmpeg input source: ${inputSource.substring(0, 100)}...`);
        // Check if this is a streaming URL that needs yt-dlp
        const needsYtDlp = inputSource.includes('youtube.com') ||
            inputSource.includes('youtu.be') ||
            inputSource.includes('soundcloud.com') ||
            inputSource.includes('twitch.tv') ||
            inputSource.startsWith('ytsearch:');
        if (needsYtDlp) {
            // Use yt-dlp to pipe audio directly to FFmpeg
            console.log('Using yt-dlp pipe mode');
            // Detect platform and use appropriate shell
            const isWindows = process.platform === 'win32';
            const ytDlpPath = isWindows ? 'yt-dlp' : '~/.local/bin/yt-dlp';
            const command = `${ytDlpPath} -f "bestaudio/best" -o - --no-playlist --no-warnings "${inputSource}" | ffmpeg -i pipe:0 -f s16le -ar ${SAMPLE_RATE} -ac ${CHANNELS} -acodec pcm_s16le -`;
            if (isWindows) {
                this.ffmpegProcess = (0, child_process_1.spawn)('cmd', ['/c', command], { stdio: ['pipe', 'pipe', 'pipe'] });
            }
            else {
                this.ffmpegProcess = (0, child_process_1.spawn)('bash', ['-c', command], { stdio: ['pipe', 'pipe', 'pipe'] });
            }
        }
        else {
            console.log('Using direct FFmpeg mode');
            this.ffmpegProcess = (0, child_process_1.spawn)('ffmpeg', [
                '-reconnect', '1',
                '-reconnect_streamed', '1',
                '-reconnect_delay_max', '5',
                '-i', inputSource,
                '-f', 's16le',
                '-ar', String(SAMPLE_RATE),
                '-ac', String(CHANNELS),
                '-acodec', 'pcm_s16le',
                '-'
            ], { stdio: ['pipe', 'pipe', 'pipe'] });
        }
        const frameSize = SAMPLES_PER_FRAME * CHANNELS * 2;
        this.ffmpegDone = false;
        let hasReceivedData = false;
        this.ffmpegProcess.stdout?.on('data', (chunk) => {
            if (this.state.status !== enums_1.AudioPlayerStatus.Playing &&
                this.state.status !== enums_1.AudioPlayerStatus.Buffering)
                return;
            hasReceivedData = true;
            // Handle leftover from previous chunk
            if (this.leftoverBuffer && this.leftoverBuffer.length > 0) {
                chunk = Buffer.concat([this.leftoverBuffer, chunk]);
                this.leftoverBuffer = null;
            }
            let offset = 0;
            while (offset + frameSize <= chunk.length) {
                const frame = chunk.slice(offset, offset + frameSize);
                const int16Array = new Int16Array(SAMPLES_PER_FRAME * CHANNELS);
                for (let i = 0; i < int16Array.length; i++) {
                    int16Array[i] = frame.readInt16LE(i * 2);
                }
                this.frameQueue.push(int16Array);
                offset += frameSize;
            }
            // Save leftover
            if (offset < chunk.length) {
                this.leftoverBuffer = chunk.slice(offset);
            }
        });
        let stderrOutput = '';
        this.ffmpegProcess.stderr?.on('data', (data) => {
            stderrOutput += data.toString();
        });
        this.ffmpegProcess.on('close', (code) => {
            this.ffmpegDone = true;
            this.ffmpegProcess = null;
            if (code !== 0) {
                console.error(`FFmpeg stderr:\n${stderrOutput}`);
            }
            console.log(`[AudioPlayer] FFmpeg closed with code ${code}, hasReceivedData: ${hasReceivedData}, queue: ${this.frameQueue.length}`);
        });
        this.ffmpegProcess.on('error', (err) => {
            console.error('FFmpeg process error:', err.message);
            this.emit('error', { message: err.message, resource: this.currentResource });
        });
        // Wait for initial buffer with timeout
        const bufferTimeout = 10000; // 10 seconds for initial buffer
        const startTime = Date.now();
        while (this.frameQueue.length < MIN_BUFFER_FRAMES && Date.now() - startTime < bufferTimeout) {
            await new Promise(r => setTimeout(r, 100));
            // Check if FFmpeg failed early
            if (this.ffmpegDone && this.frameQueue.length === 0) {
                throw new Error('FFmpeg failed to produce audio data');
            }
        }
        if (this.frameQueue.length === 0) {
            throw new Error('Timeout waiting for audio data');
        }
        console.log(`[AudioPlayer] Starting playback with ${this.frameQueue.length} frames buffered (target: ${TARGET_BUFFER_FRAMES})`);
        // Mark ready for playback - setState will trigger the loop
        this.isPlaybackLoopRunning = true;
        this.nextFrameTime = process_1.hrtime.bigint();
        console.log(`[AudioPlayer] Playback ready, audioSource exists: ${!!this.audioSource}`);
        // Set state to playing - this will trigger scheduleNextFrame via setState
        this.setState({ status: enums_1.AudioPlayerStatus.Playing, resource: this.currentResource });
    }
    /**
     * High-resolution frame scheduling using hrtime
     * This provides much more accurate timing than setInterval
     */
    scheduleNextFrame() {
        if (!this.isPlaybackLoopRunning || this.state.status !== enums_1.AudioPlayerStatus.Playing) {
            console.log(`[AudioPlayer] scheduleNextFrame skipped: loopRunning=${this.isPlaybackLoopRunning}, status=${this.state.status}`);
            return;
        }
        const now = process_1.hrtime.bigint();
        const delayNs = this.nextFrameTime - now;
        const delayMs = Number(delayNs) / 1_000_000;
        if (this.framesPlayed === 0) {
            console.log(`[AudioPlayer] First frame scheduling: delayMs=${delayMs.toFixed(2)}`);
        }
        // Schedule next frame
        if (delayMs > 1) {
            this.playbackTimeout = setTimeout(() => this.processFrame(), Math.max(1, delayMs - 1));
        }
        else {
            // We're behind, process immediately
            setImmediate(() => this.processFrame());
        }
    }
    /**
     * Process and send a single audio frame
     */
    async processFrame() {
        if (!this.isPlaybackLoopRunning || this.state.status !== enums_1.AudioPlayerStatus.Playing) {
            if (this.framesPlayed === 0) {
                console.log(`[AudioPlayer] processFrame skipped: loopRunning=${this.isPlaybackLoopRunning}, status=${this.state.status}`);
            }
            return;
        }
        // Check buffer status
        const bufferSize = this.frameQueue.length;
        if (bufferSize > 0 && this.audioSource) {
            const int16Array = this.frameQueue.shift();
            const audioFrame = new rtc_node_1.AudioFrame(int16Array, SAMPLE_RATE, CHANNELS, SAMPLES_PER_FRAME);
            try {
                await this.audioSource.captureFrame(audioFrame);
                this.framesPlayed++;
                // Log progress every 500 frames (~10 seconds)
                if (this.framesPlayed % 500 === 0) {
                    console.log(`[AudioPlayer] Progress: ${this.framesPlayed} frames played, buffer: ${bufferSize}`);
                }
            }
            catch (e) {
                console.error(`[AudioPlayer] Frame error:`, e.message);
            }
            // Update timing for next frame
            this.nextFrameTime += FRAME_INTERVAL_NS;
            // Adaptive timing: if buffer is low, slow down slightly to let it recover
            if (bufferSize < LOW_BUFFER_THRESHOLD && !this.ffmpegDone) {
                // Add 1ms delay to let buffer recover
                this.nextFrameTime += BigInt(1_000_000);
                this.bufferUnderruns++;
                if (this.bufferUnderruns % 50 === 0) {
                    console.log(`[AudioPlayer] Buffer low: ${bufferSize} frames, ${this.bufferUnderruns} underruns`);
                }
            }
            // Schedule next frame
            this.scheduleNextFrame();
        }
        else if (this.ffmpegDone && bufferSize === 0) {
            // Playback finished
            console.log('[AudioPlayer] Playback finished - queue empty and FFmpeg done');
            this.stop();
        }
        else if (bufferSize === 0) {
            // Buffer underrun - wait for more data
            this.bufferUnderruns++;
            console.log(`[AudioPlayer] Buffer underrun #${this.bufferUnderruns}, waiting for data...`);
            // Wait a bit and try again
            this.nextFrameTime = process_1.hrtime.bigint() + BigInt(50_000_000); // 50ms
            this.scheduleNextFrame();
        }
    }
    cleanup() {
        // Stop playback loop
        this.isPlaybackLoopRunning = false;
        if (this.playbackTimeout) {
            clearTimeout(this.playbackTimeout);
            this.playbackTimeout = null;
        }
        // Kill FFmpeg
        if (this.ffmpegProcess) {
            this.ffmpegProcess.kill('SIGKILL');
            this.ffmpegProcess = null;
        }
        // Clear frame queue
        this.frameQueue = [];
        this.leftoverBuffer = null;
        // Reset timing and state
        this.nextFrameTime = BigInt(0);
        this.ffmpegDone = false;
        // Log stats
        if (this.framesPlayed > 0) {
            console.log(`[AudioPlayer] Playback stats: ${this.framesPlayed} frames, ${this.bufferUnderruns} underruns`);
        }
        this.bufferUnderruns = 0;
        this.framesPlayed = 0;
        // Note: We don't unpublish the track - it stays published for next play
    }
    setState(newState) {
        const oldState = this.state;
        this.state = newState;
        this.emit('stateChange', oldState, newState);
        // Start playback loop when transitioning to Playing
        if (newState.status === enums_1.AudioPlayerStatus.Playing && oldState.status !== enums_1.AudioPlayerStatus.Playing) {
            console.log(`[AudioPlayer] State changed to Playing, starting playback loop`);
            this.scheduleNextFrame();
        }
    }
}
exports.AudioPlayer = AudioPlayer;
/**
 * Create an audio player
 */
function createAudioPlayer(options) {
    return new AudioPlayer(options);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQXVkaW9QbGF5ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvQXVkaW9QbGF5ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBMGNBLDhDQUVDO0FBNWNELG1DQUFzQztBQUN0QyxpREFBb0Q7QUFDcEQscUNBQWlDO0FBQ2pDLGdEQU8yQjtBQUMzQixtQ0FBNEM7QUFLNUMsNENBQTRDO0FBQzVDLE1BQU0sV0FBVyxHQUFHLEtBQUssQ0FBQztBQUMxQixNQUFNLFFBQVEsR0FBRyxDQUFDLENBQUM7QUFDbkIsTUFBTSxpQkFBaUIsR0FBRyxFQUFFLENBQUM7QUFDN0IsTUFBTSxpQkFBaUIsR0FBRyxDQUFDLFdBQVcsR0FBRyxpQkFBaUIsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLE1BQU07QUFFMUUseUJBQXlCO0FBQ3pCLE1BQU0saUJBQWlCLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsc0JBQXNCO0FBQ3BFLE1BQU0sb0JBQW9CLEdBQUcsR0FBRyxDQUFDLENBQUMsa0NBQWtDO0FBQ3BFLE1BQU0saUJBQWlCLEdBQUcsRUFBRSxDQUFDLENBQUkseUNBQXlDO0FBQzFFLE1BQU0saUJBQWlCLEdBQUcsR0FBRyxDQUFDLENBQUcsb0RBQW9EO0FBQ3JGLE1BQU0sb0JBQW9CLEdBQUcsRUFBRSxDQUFDLENBQUMseUNBQXlDO0FBRTFFOztHQUVHO0FBQ0gsTUFBYSxXQUFZLFNBQVEscUJBQVk7SUFDM0MsMkJBQTJCO0lBQ3BCLEtBQUssR0FBcUIsRUFBRSxNQUFNLEVBQUUseUJBQWlCLENBQUMsSUFBSSxFQUFFLENBQUM7SUFFcEUscUJBQXFCO0lBQ2IsT0FBTyxDQUEyQjtJQUUxQyxtQ0FBbUM7SUFDM0IsYUFBYSxHQUF5QixJQUFJLEdBQUcsRUFBRSxDQUFDO0lBRXhELDZCQUE2QjtJQUNyQixlQUFlLEdBQXlCLElBQUksQ0FBQztJQUVyRCxxQkFBcUI7SUFDYixhQUFhLEdBQXdCLElBQUksQ0FBQztJQUVs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RW1pdHRlciB9IGZyb20gJ2V2ZW50cyc7XHJcbmltcG9ydCB7IHNwYXduLCBDaGlsZFByb2Nlc3MgfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcclxuaW1wb3J0IHsgaHJ0aW1lIH0gZnJvbSAncHJvY2Vzcyc7XHJcbmltcG9ydCB7IFxyXG4gIFJvb20sIFxyXG4gIExvY2FsQXVkaW9UcmFjaywgXHJcbiAgQXVkaW9Tb3VyY2UsIFxyXG4gIFRyYWNrUHVibGlzaE9wdGlvbnMsIFxyXG4gIFRyYWNrU291cmNlLFxyXG4gIEF1ZGlvRnJhbWUgXHJcbn0gZnJvbSAnQGxpdmVraXQvcnRjLW5vZGUnO1xyXG5pbXBvcnQgeyBBdWRpb1BsYXllclN0YXR1cyB9IGZyb20gJy4vZW51bXMnO1xyXG5pbXBvcnQgeyBDcmVhdGVBdWRpb1BsYXllck9wdGlvbnMsIEF1ZGlvUGxheWVyU3RhdGUgfSBmcm9tICcuL3R5cGVzJztcclxuaW1wb3J0IHsgQXVkaW9SZXNvdXJjZSB9IGZyb20gJy4vQXVkaW9SZXNvdXJjZSc7XHJcbmltcG9ydCB7IFZvaWNlQ29ubmVjdGlvbiB9IGZyb20gJy4vVm9pY2VDb25uZWN0aW9uJztcclxuXHJcbi8vIEF1ZGlvIHNldHRpbmdzIGZvciBMaXZlS2l0ICg0OGtIeiBzdGVyZW8pXHJcbmNvbnN0IFNBTVBMRV9SQVRFID0gNDgwMDA7XHJcbmNvbnN0IENIQU5ORUxTID0gMjtcclxuY29uc3QgRlJBTUVfRFVSQVRJT05fTVMgPSAyMDtcclxuY29uc3QgU0FNUExFU19QRVJfRlJBTUUgPSAoU0FNUExFX1JBVEUgKiBGUkFNRV9EVVJBVElPTl9NUykgLyAxMDAwOyAvLyA5NjBcclxuXHJcbi8vIEppdHRlciBidWZmZXIgc2V0dGluZ3NcclxuY29uc3QgRlJBTUVfSU5URVJWQUxfTlMgPSBCaWdJbnQoMjBfMDAwXzAwMCk7IC8vIDIwbXMgaW4gbmFub3NlY29uZHNcclxuY29uc3QgVEFSR0VUX0JVRkZFUl9GUkFNRVMgPSAxNTA7IC8vIH4zIHNlY29uZHMgLSB0YXJnZXQgYnVmZmVyIHNpemVcclxuY29uc3QgTUlOX0JVRkZFUl9GUkFNRVMgPSA3NTsgICAgLy8gfjEuNSBzZWNvbmRzIC0gbWluaW11bSBiZWZvcmUgd2Ugc3RhcnRcclxuY29uc3QgTUFYX0JVRkZFUl9GUkFNRVMgPSA1MDA7ICAgLy8gfjEwIHNlY29uZHMgLSBtYXggYnVmZmVyIHRvIHByZXZlbnQgbWVtb3J5IGlzc3Vlc1xyXG5jb25zdCBMT1dfQlVGRkVSX1RIUkVTSE9MRCA9IDUwOyAvLyB+MSBzZWNvbmQgLSB3aGVuIHRvIHNsb3cgZG93biBwbGF5YmFja1xyXG5cclxuLyoqXHJcbiAqIEF1ZGlvIHBsYXllciBmb3IgcGxheWluZyBhdWRpbyByZXNvdXJjZXNcclxuICovXHJcbmV4cG9ydCBjbGFzcyBBdWRpb1BsYXllciBleHRlbmRzIEV2ZW50RW1pdHRlciB7XHJcbiAgLyoqIEN1cnJlbnQgcGxheWVyIHN0YXRlICovXHJcbiAgcHVibGljIHN0YXRlOiBBdWRpb1BsYXllclN0YXRlID0geyBzdGF0dXM6IEF1ZGlvUGxheWVyU3RhdHVzLklkbGUgfTtcclxuICBcclxuICAvKiogUGxheWVyIG9wdGlvbnMgKi9cclxuICBwcml2YXRlIG9wdGlvbnM6IENyZWF0ZUF1ZGlvUGxheWVyT3B0aW9ucztcclxuICBcclxuICAvKiogU3Vic2NyaWJlZCB2b2ljZSBjb25uZWN0aW9ucyAqL1xyXG4gIHByaXZhdGUgc3Vic2NyaXB0aW9uczogU2V0PFZvaWNlQ29ubmVjdGlvbj4gPSBuZXcgU2V0KCk7XHJcbiAgXHJcbiAgLyoqIEN1cnJlbnQgYXVkaW8gcmVzb3VyY2UgKi9cclxuICBwcml2YXRlIGN1cnJlbnRSZXNvdXJjZTogQXVkaW9SZXNvdXJjZSB8IG51bGwgPSBudWxsO1xyXG4gIFxyXG4gIC8qKiBGRm1wZWcgcHJvY2VzcyAqL1xyXG4gIHByaXZhdGUgZmZtcGVnUHJvY2VzczogQ2hpbGRQcm9jZXNzIHwgbnVsbCA9IG51bGw7XHJcbiAgXHJcbiAgLyoqIExpdmVLaXQgYXVkaW8gc291cmNlIGFuZCB0cmFjayAqL1xyXG4gIHByaXZhdGUgYXVkaW9Tb3VyY2U6IEF1ZGlvU291cmNlIHwgbnVsbCA9IG51bGw7XHJcbiAgcHJpdmF0ZSBhdWRpb1RyYWNrOiBMb2NhbEF1ZGlvVHJhY2sgfCBudWxsID0gbnVsbDtcclxuICBcclxuICAvKiogRnJhbWUgcXVldWUgYW5kIHBsYXliYWNrIHN0YXRlICovXHJcbiAgcHJpdmF0ZSBmcmFtZVF1ZXVlOiBJbnQxNkFycmF5W10gPSBbXTtcclxuICBwcml2YXRlIHBsYXliYWNrVGltZW91dDogTm9kZUpTLlRpbWVvdXQgfCBudWxsID0gbnVsbDtcclxuICBwcml2YXRlIGxlZnRvdmVyQnVmZmVyOiBCdWZmZXIgfCBudWxsID0gbnVsbDtcclxuICBwcml2YXRlIGlzUHVibGlzaGVkID0gZmFsc2U7XHJcbiAgXHJcbiAgLyoqIEhpZ2gtcmVzb2x1dGlvbiB0aW1pbmcgKi9cclxuICBwcml2YXRlIG5leHRGcmFtZVRpbWU6IGJpZ2ludCA9IEJpZ0ludCgwKTtcclxuICBwcml2YXRlIGlzUGxheWJhY2tMb29wUnVubmluZyA9IGZhbHNlO1xyXG4gIHByaXZhdGUgZmZtcGVnRG9uZSA9IGZhbHNlO1xyXG4gIFxyXG4gIC8qKiBCdWZmZXIgc3RhdGlzdGljcyAqL1xyXG4gIHByaXZhdGUgYnVmZmVyVW5kZXJydW5zID0gMDtcclxuICBwcml2YXRlIGZyYW1lc1BsYXllZCA9IDA7XHJcblxyXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnM6IENyZWF0ZUF1ZGlvUGxheWVyT3B0aW9ucyA9IHt9KSB7XHJcbiAgICBzdXBlcigpO1xyXG4gICAgdGhpcy5vcHRpb25zID0ge1xyXG4gICAgICBiZWhhdmlvcnM6IHtcclxuICAgICAgICBub1N1YnNjcmliZXI6ICdwYXVzZScsXHJcbiAgICAgICAgbWF4TWlzc2VkRnJhbWVzOiA1LFxyXG4gICAgICAgIC4uLm9wdGlvbnMuYmVoYXZpb3JzXHJcbiAgICAgIH1cclxuICAgIH07XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBQbGF5IGFuIGF1ZGlvIHJlc291cmNlXHJcbiAgICovXHJcbiAgcGxheShyZXNvdXJjZTogQXVkaW9SZXNvdXJjZSk6IHZvaWQge1xyXG4gICAgLy8gU3RvcCBjdXJyZW50IHBsYXliYWNrXHJcbiAgICB0aGlzLnN0b3AoKTtcclxuICAgIFxyXG4gICAgdGhpcy5jdXJyZW50UmVzb3VyY2UgPSByZXNvdXJjZTtcclxuICAgIHRoaXMuc2V0U3RhdGUoeyBzdGF0dXM6IEF1ZGlvUGxheWVyU3RhdHVzLkJ1ZmZlcmluZywgcmVzb3VyY2UgfSk7XHJcbiAgICBcclxuICAgIC8vIFN0YXJ0IHBsYXliYWNrIGlmIHdlIGhhdmUgYSByZWFkeSBjb25uZWN0aW9uXHJcbiAgICBmb3IgKGNvbnN0IGNvbm5lY3Rpb24gb2YgdGhpcy5zdWJzY3JpcHRpb25zKSB7XHJcbiAgICAgIGlmIChjb25uZWN0aW9uLmdldFJvb20oKSkge1xyXG4gICAgICAgIHRoaXMuc3RhcnRQbGF5YmFjayhjb25uZWN0aW9uKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUGF1c2UgcGxheWJhY2tcclxuICAgKi9cclxuICBwYXVzZSgpOiBib29sZWFuIHtcclxuICAgIGlmICh0aGlzLnN0YXRlLnN0YXR1cyAhPT0gQXVkaW9QbGF5ZXJTdGF0dXMuUGxheWluZykge1xyXG4gICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcbiAgICB0aGlzLnNldFN0YXRlKHsgc3RhdHVzOiBBdWRpb1BsYXllclN0YXR1cy5QYXVzZWQsIHJlc291cmNlOiB0aGlzLmN1cnJlbnRSZXNvdXJjZSB9KTtcclxuICAgIHJldHVybiB0cnVlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVW5wYXVzZSBwbGF5YmFja1xyXG4gICAqL1xyXG4gIHVucGF1c2UoKTogYm9vbGVhbiB7XHJcbiAgICBpZiAodGhpcy5zdGF0ZS5zdGF0dXMgIT09IEF1ZGlvUGxheWVyU3RhdHVzLlBhdXNlZCkge1xyXG4gICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcbiAgICB0aGlzLnNldFN0YXRlKHsgc3RhdHVzOiBBdWRpb1BsYXllclN0YXR1cy5QbGF5aW5nLCByZXNvdXJjZTogdGhpcy5jdXJyZW50UmVzb3VyY2UgfSk7XHJcbiAgICByZXR1cm4gdHJ1ZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFN0b3AgcGxheWJhY2tcclxuICAgKi9cclxuICBzdG9wKGZvcmNlID0gZmFsc2UpOiBib29sZWFuIHtcclxuICAgIGlmICh0aGlzLnN0YXRlLnN0YXR1cyA9PT0gQXVkaW9QbGF5ZXJTdGF0dXMuSWRsZSAmJiAhZm9yY2UpIHtcclxuICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG4gICAgdGhpcy5jbGVhbnVwKCk7XHJcbiAgICB0aGlzLmN1cnJlbnRSZXNvdXJjZSA9IG51bGw7XHJcbiAgICB0aGlzLnNldFN0YXRlKHsgc3RhdHVzOiBBdWRpb1BsYXllclN0YXR1cy5JZGxlIH0pO1xyXG4gICAgcmV0dXJuIHRydWU7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTdWJzY3JpYmUgYSB2b2ljZSBjb25uZWN0aW9uIHRvIHRoaXMgcGxheWVyXHJcbiAgICogQGludGVybmFsXHJcbiAgICovXHJcbiAgc3Vic2NyaWJlKGNvbm5lY3Rpb246IFZvaWNlQ29ubmVjdGlvbik6IHZvaWQge1xyXG4gICAgdGhpcy5zdWJzY3JpcHRpb25zLmFkZChjb25uZWN0aW9uKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFVuc3Vic2NyaWJlIGEgdm9pY2UgY29ubmVjdGlvbiBmcm9tIHRoaXMgcGxheWVyXHJcbiAgICogQGludGVybmFsXHJcbiAgICovXHJcbiAgdW5zdWJzY3JpYmUoY29ubmVjdGlvbjogVm9pY2VDb25uZWN0aW9uKTogdm9pZCB7XHJcbiAgICB0aGlzLnN1YnNjcmlwdGlvbnMuZGVsZXRlKGNvbm5lY3Rpb24pO1xyXG4gICAgXHJcbiAgICAvLyBBdXRvLXBhdXNlIGlmIG5vIHN1YnNjcmliZXJzXHJcbiAgICBpZiAodGhpcy5zdWJzY3JpcHRpb25zLnNpemUgPT09IDAgJiYgdGhpcy5vcHRpb25zLmJlaGF2aW9ycz8ubm9TdWJzY3JpYmVyID09PSAncGF1c2UnKSB7XHJcbiAgICAgIGlmICh0aGlzLnN0YXRlLnN0YXR1cyA9PT0gQXVkaW9QbGF5ZXJTdGF0dXMuUGxheWluZykge1xyXG4gICAgICAgIHRoaXMuc2V0U3RhdGUoeyBzdGF0dXM6IEF1ZGlvUGxheWVyU3RhdHVzLkF1dG9QYXVzZWQsIHJlc291cmNlOiB0aGlzLmN1cnJlbnRSZXNvdXJjZSB9KTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2FsbGVkIHdoZW4gYSBjb25uZWN0aW9uIGJlY29tZXMgcmVhZHlcclxuICAgKiBAaW50ZXJuYWxcclxuICAgKi9cclxuICBvbkNvbm5lY3Rpb25SZWFkeShjb25uZWN0aW9uOiBWb2ljZUNvbm5lY3Rpb24pOiB2b2lkIHtcclxuICAgIC8vIElmIHdlIGhhdmUgYSByZXNvdXJjZSB3YWl0aW5nLCBzdGFydCBwbGF5YmFja1xyXG4gICAgaWYgKHRoaXMuY3VycmVudFJlc291cmNlICYmIHRoaXMuc3RhdGUuc3RhdHVzID09PSBBdWRpb1BsYXllclN0YXR1cy5CdWZmZXJpbmcpIHtcclxuICAgICAgdGhpcy5zdGFydFBsYXliYWNrKGNvbm5lY3Rpb24pO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhc3luYyBzdGFydFBsYXliYWNrKGNvbm5lY3Rpb246IFZvaWNlQ29ubmVjdGlvbik6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3Qgcm9vbSA9IGNvbm5lY3Rpb24uZ2V0Um9vbSgpO1xyXG4gICAgaWYgKCFyb29tIHx8ICF0aGlzLmN1cnJlbnRSZXNvdXJjZSkgcmV0dXJuO1xyXG5cclxuICAgIHRyeSB7XHJcbiAgICAgIC8vIENyZWF0ZSBhdWRpbyBzb3VyY2UgYW5kIHRyYWNrXHJcbiAgICAgIGF3YWl0IHRoaXMuc2V0dXBBdWRpb1RyYWNrKHJvb20pO1xyXG4gICAgICBcclxuICAgICAgLy8gU3RhcnQgRkZtcGVnIHRvIGRlY29kZSBhdWRpbyAtIHRoaXMgd2lsbCBzZXQgc3RhdGUgdG8gUGxheWluZyB3aGVuIHJlYWR5XHJcbiAgICAgIGF3YWl0IHRoaXMuc3RhcnRGRm1wZWcoKTtcclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCB7IG1lc3NhZ2U6IChlcnJvciBhcyBFcnJvcikubWVzc2FnZSwgcmVzb3VyY2U6IHRoaXMuY3VycmVudFJlc291cmNlIH0pO1xyXG4gICAgICB0aGlzLnN0b3AoKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgYXN5bmMgc2V0dXBBdWRpb1RyYWNrKHJvb206IFJvb20pOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGlmICh0aGlzLmlzUHVibGlzaGVkKSByZXR1cm47XHJcbiAgICBcclxuICAgIHRoaXMuYXVkaW9Tb3VyY2UgPSBuZXcgQXVkaW9Tb3VyY2UoU0FNUExFX1JBVEUsIENIQU5ORUxTKTtcclxuICAgIHRoaXMuYXVkaW9UcmFjayA9IExvY2FsQXVkaW9UcmFjay5jcmVhdGVBdWRpb1RyYWNrKCdtdXNpYycsIHRoaXMuYXVkaW9Tb3VyY2UpO1xyXG4gICAgXHJcbiAgICBjb25zdCBvcHRpb25zID0gbmV3IFRyYWNrUHVibGlzaE9wdGlvbnMoKTtcclxuICAgIG9wdGlvbnMuc291cmNlID0gVHJhY2tTb3VyY2UuU09VUkNFX01JQ1JPUEhPTkU7XHJcbiAgICBcclxuICAgIGlmIChyb29tLmxvY2FsUGFydGljaXBhbnQpIHtcclxuICAgICAgYXdhaXQgcm9vbS5sb2NhbFBhcnRpY2lwYW50LnB1Ymxpc2hUcmFjayh0aGlzLmF1ZGlvVHJhY2ssIG9wdGlvbnMpO1xyXG4gICAgfVxyXG4gICAgdGhpcy5pc1B1Ymxpc2hlZCA9IHRydWU7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFzeW5jIHN0YXJ0RkZtcGVnKCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgaWYgKCF0aGlzLmN1cnJlbnRSZXNvdXJjZSkgcmV0dXJuO1xyXG4gICAgXHJcbiAgICBjb25zdCBpbnB1dFNvdXJjZSA9IHRoaXMuY3VycmVudFJlc291cmNlLmdldElucHV0U291cmNlKCk7XHJcbiAgICBjb25zb2xlLmxvZyhgRkZtcGVnIGlucHV0IHNvdXJjZTogJHtpbnB1dFNvdXJjZS5zdWJzdHJpbmcoMCwgMTAwKX0uLi5gKTtcclxuICAgIFxyXG4gICAgLy8gQ2hlY2sgaWYgdGhpcyBpcyBhIHN0cmVhbWluZyBVUkwgdGhhdCBuZWVkcyB5dC1kbHBcclxuICAgIGNvbnN0IG5lZWRzWXREbHAgPSBpbnB1dFNvdXJjZS5pbmNsdWRlcygneW91dHViZS5jb20nKSB8fCBcclxuICAgICAgICAgICAgICAgICAgICAgICBpbnB1dFNvdXJjZS5pbmNsdWRlcygneW91dHUuYmUnKSB8fFxyXG4gICAgICAgICAgICAgICAgICAgICAgIGlucHV0U291cmNlLmluY2x1ZGVzKCdzb3VuZGNsb3VkLmNvbScpIHx8XHJcbiAgICAgICAgICAgICAgICAgICAgICAgaW5wdXRTb3VyY2UuaW5jbHVkZXMoJ3R3aXRjaC50dicpIHx8XHJcbiAgICAgICAgICAgICAgICAgICAgICAgaW5wdXRTb3VyY2Uuc3RhcnRzV2l0aCgneXRzZWFyY2g6Jyk7XHJcbiAgICBcclxuICAgIGlmIChuZWVkc1l0RGxwKSB7XHJcbiAgICAgIC8vIFVzZSB5dC1kbHAgdG8gcGlwZSBhdWRpbyBkaXJlY3RseSB0byBGRm1wZWdcclxuICAgICAgY29uc29sZS5sb2coJ1VzaW5nIHl0LWRscCBwaXBlIG1vZGUnKTtcclxuICAgICAgXHJcbiAgICAgIC8vIERldGVjdCBwbGF0Zm9ybSBhbmQgdXNlIGFwcHJvcHJpYXRlIHNoZWxsXHJcbiAgICAgIGNvbnN0IGlzV2luZG93cyA9IHByb2Nlc3MucGxhdGZvcm0gPT09ICd3aW4zMic7XHJcbiAgICAgIGNvbnN0IHl0RGxwUGF0aCA9IGlzV2luZG93cyA/ICd5dC1kbHAnIDogJ34vLmxvY2FsL2Jpbi95dC1kbHAnO1xyXG4gICAgICBjb25zdCBjb21tYW5kID0gYCR7eXREbHBQYXRofSAtZiBcImJlc3RhdWRpby9iZXN0XCIgLW8gLSAtLW5vLXBsYXlsaXN0IC0tbm8td2FybmluZ3MgXCIke2lucHV0U291cmNlfVwiIHwgZmZtcGVnIC1pIHBpcGU6MCAtZiBzMTZsZSAtYXIgJHtTQU1QTEVfUkFURX0gLWFjICR7Q0hBTk5FTFN9IC1hY29kZWMgcGNtX3MxNmxlIC1gO1xyXG4gICAgICBcclxuICAgICAgaWYgKGlzV2luZG93cykge1xyXG4gICAgICAgIHRoaXMuZmZtcGVnUHJvY2VzcyA9IHNwYXduKCdjbWQnLCBbJy9jJywgY29tbWFuZF0sIHsgc3RkaW86IFsncGlwZScsICdwaXBlJywgJ3BpcGUnXSB9KTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICB0aGlzLmZmbXBlZ1Byb2Nlc3MgPSBzcGF3bignYmFzaCcsIFsnLWMnLCBjb21tYW5kXSwgeyBzdGRpbzogWydwaXBlJywgJ3BpcGUnLCAncGlwZSddIH0pO1xyXG4gICAgICB9XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBjb25zb2xlLmxvZygnVXNpbmcgZGlyZWN0IEZGbXBlZyBtb2RlJyk7XHJcbiAgICAgIHRoaXMuZmZtcGVnUHJvY2VzcyA9IHNwYXduKCdmZm1wZWcnLCBbXHJcbiAgICAgICAgJy1yZWNvbm5lY3QnLCAnMScsXHJcbiAgICAgICAgJy1yZWNvbm5lY3Rfc3RyZWFtZWQnLCAnMScsXHJcbiAgICAgICAgJy1yZWNvbm5lY3RfZGVsYXlfbWF4JywgJzUnLFxyXG4gICAgICAgICctaScsIGlucHV0U291cmNlLFxyXG4gICAgICAgICctZicsICdzMTZsZScsXHJcbiAgICAgICAgJy1hcicsIFN0cmluZyhTQU1QTEVfUkFURSksXHJcbiAgICAgICAgJy1hYycsIFN0cmluZyhDSEFOTkVMUyksXHJcbiAgICAgICAgJy1hY29kZWMnLCAncGNtX3MxNmxlJyxcclxuICAgICAgICAnLSdcclxuICAgICAgXSwgeyBzdGRpbzogWydwaXBlJywgJ3BpcGUnLCAncGlwZSddIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGZyYW1lU2l6ZSA9IFNBTVBMRVNfUEVSX0ZSQU1FICogQ0hBTk5FTFMgKiAyO1xyXG4gICAgdGhpcy5mZm1wZWdEb25lID0gZmFsc2U7XHJcbiAgICBsZXQgaGFzUmVjZWl2ZWREYXRhID0gZmFsc2U7XHJcblxyXG4gICAgdGhpcy5mZm1wZWdQcm9jZXNzLnN0ZG91dD8ub24oJ2RhdGEnLCAoY2h1bms6IEJ1ZmZlcikgPT4ge1xyXG4gICAgICBpZiAodGhpcy5zdGF0ZS5zdGF0dXMgIT09IEF1ZGlvUGxheWVyU3RhdHVzLlBsYXlpbmcgJiYgXHJcbiAgICAgICAgICB0aGlzLnN0YXRlLnN0YXR1cyAhPT0gQXVkaW9QbGF5ZXJTdGF0dXMuQnVmZmVyaW5nKSByZXR1cm47XHJcbiAgICAgIFxyXG4gICAgICBoYXNSZWNlaXZlZERhdGEgPSB0cnVlO1xyXG4gICAgICBcclxuICAgICAgLy8gSGFuZGxlIGxlZnRvdmVyIGZyb20gcHJldmlvdXMgY2h1bmtcclxuICAgICAgaWYgKHRoaXMubGVmdG92ZXJCdWZmZXIgJiYgdGhpcy5sZWZ0b3ZlckJ1ZmZlci5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgY2h1bmsgPSBCdWZmZXIuY29uY2F0KFt0aGlzLmxlZnRvdmVyQnVmZmVyLCBjaHVua10pO1xyXG4gICAgICAgIHRoaXMubGVmdG92ZXJCdWZmZXIgPSBudWxsO1xyXG4gICAgICB9XHJcbiAgICAgIFxyXG4gICAgICBsZXQgb2Zmc2V0ID0gMDtcclxuICAgICAgd2hpbGUgKG9mZnNldCArIGZyYW1lU2l6ZSA8PSBjaHVuay5sZW5ndGgpIHtcclxuICAgICAgICBjb25zdCBmcmFtZSA9IGNodW5rLnNsaWNlKG9mZnNldCwgb2Zmc2V0ICsgZnJhbWVTaXplKTtcclxuICAgICAgICBjb25zdCBpbnQxNkFycmF5ID0gbmV3IEludDE2QXJyYXkoU0FNUExFU19QRVJfRlJBTUUgKiBDSEFOTkVMUyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpbnQxNkFycmF5Lmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICBpbnQxNkFycmF5W2ldID0gZnJhbWUucmVhZEludDE2TEUoaSAqIDIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB0aGlzLmZyYW1lUXVldWUucHVzaChpbnQxNkFycmF5KTtcclxuICAgICAgICBvZmZzZXQgKz0gZnJhbWVTaXplO1xyXG4gICAgICB9XHJcbiAgICAgIFxyXG4gICAgICAvLyBTYXZlIGxlZnRvdmVyXHJcbiAgICAgIGlmIChvZmZzZXQgPCBjaHVuay5sZW5ndGgpIHtcclxuICAgICAgICB0aGlzLmxlZnRvdmVyQnVmZmVyID0gY2h1bmsuc2xpY2Uob2Zmc2V0KTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgbGV0IHN0ZGVyck91dHB1dCA9ICcnO1xyXG4gICAgdGhpcy5mZm1wZWdQcm9jZXNzLnN0ZGVycj8ub24oJ2RhdGEnLCAoZGF0YTogQnVmZmVyKSA9PiB7XHJcbiAgICAgIHN0ZGVyck91dHB1dCArPSBkYXRhLnRvU3RyaW5nKCk7XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLmZmbXBlZ1Byb2Nlc3Mub24oJ2Nsb3NlJywgKGNvZGUpID0+IHtcclxuICAgICAgdGhpcy5mZm1wZWdEb25lID0gdHJ1ZTtcclxuICAgICAgdGhpcy5mZm1wZWdQcm9jZXNzID0gbnVsbDtcclxuICAgICAgaWYgKGNvZGUgIT09IDApIHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKGBGRm1wZWcgc3RkZXJyOlxcbiR7c3RkZXJyT3V0cHV0fWApO1xyXG4gICAgICB9XHJcbiAgICAgIGNvbnNvbGUubG9nKGBbQXVkaW9QbGF5ZXJdIEZGbXBlZyBjbG9zZWQgd2l0aCBjb2RlICR7Y29kZX0sIGhhc1JlY2VpdmVkRGF0YTogJHtoYXNSZWNlaXZlZERhdGF9LCBxdWV1ZTogJHt0aGlzLmZyYW1lUXVldWUubGVuZ3RofWApO1xyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5mZm1wZWdQcm9jZXNzLm9uKCdlcnJvcicsIChlcnIpID0+IHtcclxuICAgICAgY29uc29sZS5lcnJvcignRkZtcGVnIHByb2Nlc3MgZXJyb3I6JywgZXJyLm1lc3NhZ2UpO1xyXG4gICAgICB0aGlzLmVtaXQoJ2Vycm9yJywgeyBtZXNzYWdlOiBlcnIubWVzc2FnZSwgcmVzb3VyY2U6IHRoaXMuY3VycmVudFJlc291cmNlIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gV2FpdCBmb3IgaW5pdGlhbCBidWZmZXIgd2l0aCB0aW1lb3V0XHJcbiAgICBjb25zdCBidWZmZXJUaW1lb3V0ID0gMTAwMDA7IC8vIDEwIHNlY29uZHMgZm9yIGluaXRpYWwgYnVmZmVyXHJcbiAgICBjb25zdCBzdGFydFRpbWUgPSBEYXRlLm5vdygpO1xyXG4gICAgXHJcbiAgICB3aGlsZSAodGhpcy5mcmFtZVF1ZXVlLmxlbmd0aCA8IE1JTl9CVUZGRVJfRlJBTUVTICYmIERhdGUubm93KCkgLSBzdGFydFRpbWUgPCBidWZmZXJUaW1lb3V0KSB7XHJcbiAgICAgIGF3YWl0IG5ldyBQcm9taXNlKHIgPT4gc2V0VGltZW91dChyLCAxMDApKTtcclxuICAgICAgXHJcbiAgICAgIC8vIENoZWNrIGlmIEZGbXBlZyBmYWlsZWQgZWFybHlcclxuICAgICAgaWYgKHRoaXMuZmZtcGVnRG9uZSAmJiB0aGlzLmZyYW1lUXVldWUubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdGRm1wZWcgZmFpbGVkIHRvIHByb2R1Y2UgYXVkaW8gZGF0YScpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGlmICh0aGlzLmZyYW1lUXVldWUubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcignVGltZW91dCB3YWl0aW5nIGZvciBhdWRpbyBkYXRhJyk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGNvbnNvbGUubG9nKGBbQXVkaW9QbGF5ZXJdIFN0YXJ0aW5nIHBsYXliYWNrIHdpdGggJHt0aGlzLmZyYW1lUXVldWUubGVuZ3RofSBmcmFtZXMgYnVmZmVyZWQgKHRhcmdldDogJHtUQVJHRVRfQlVGRkVSX0ZSQU1FU30pYCk7XHJcblxyXG4gICAgLy8gTWFyayByZWFkeSBmb3IgcGxheWJhY2sgLSBzZXRTdGF0ZSB3aWxsIHRyaWdnZXIgdGhlIGxvb3BcclxuICAgIHRoaXMuaXNQbGF5YmFja0xvb3BSdW5uaW5nID0gdHJ1ZTtcclxuICAgIHRoaXMubmV4dEZyYW1lVGltZSA9IGhydGltZS5iaWdpbnQoKTtcclxuICAgIGNvbnNvbGUubG9nKGBbQXVkaW9QbGF5ZXJdIFBsYXliYWNrIHJlYWR5LCBhdWRpb1NvdXJjZSBleGlzdHM6ICR7ISF0aGlzLmF1ZGlvU291cmNlfWApO1xyXG4gICAgXHJcbiAgICAvLyBTZXQgc3RhdGUgdG8gcGxheWluZyAtIHRoaXMgd2lsbCB0cmlnZ2VyIHNjaGVkdWxlTmV4dEZyYW1lIHZpYSBzZXRTdGF0ZVxyXG4gICAgdGhpcy5zZXRTdGF0ZSh7IHN0YXR1czogQXVkaW9QbGF5ZXJTdGF0dXMuUGxheWluZywgcmVzb3VyY2U6IHRoaXMuY3VycmVudFJlc291cmNlIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSGlnaC1yZXNvbHV0aW9uIGZyYW1lIHNjaGVkdWxpbmcgdXNpbmcgaHJ0aW1lXHJcbiAgICogVGhpcyBwcm92aWRlcyBtdWNoIG1vcmUgYWNjdXJhdGUgdGltaW5nIHRoYW4gc2V0SW50ZXJ2YWxcclxuICAgKi9cclxuICBwcml2YXRlIHNjaGVkdWxlTmV4dEZyYW1lKCk6IHZvaWQge1xyXG4gICAgaWYgKCF0aGlzLmlzUGxheWJhY2tMb29wUnVubmluZyB8fCB0aGlzLnN0YXRlLnN0YXR1cyAhPT0gQXVkaW9QbGF5ZXJTdGF0dXMuUGxheWluZykge1xyXG4gICAgICBjb25zb2xlLmxvZyhgW0F1ZGlvUGxheWVyXSBzY2hlZHVsZU5leHRGcmFtZSBza2lwcGVkOiBsb29wUnVubmluZz0ke3RoaXMuaXNQbGF5YmFja0xvb3BSdW5uaW5nfSwgc3RhdHVzPSR7dGhpcy5zdGF0ZS5zdGF0dXN9YCk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBub3cgPSBocnRpbWUuYmlnaW50KCk7XHJcbiAgICBjb25zdCBkZWxheU5zID0gdGhpcy5uZXh0RnJhbWVUaW1lIC0gbm93O1xyXG4gICAgY29uc3QgZGVsYXlNcyA9IE51bWJlcihkZWxheU5zKSAvIDFfMDAwXzAwMDtcclxuXHJcbiAgICBpZiAodGhpcy5mcmFtZXNQbGF5ZWQgPT09IDApIHtcclxuICAgICAgY29uc29sZS5sb2coYFtBdWRpb1BsYXllcl0gRmlyc3QgZnJhbWUgc2NoZWR1bGluZzogZGVsYXlNcz0ke2RlbGF5TXMudG9GaXhlZCgyKX1gKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBTY2hlZHVsZSBuZXh0IGZyYW1lXHJcbiAgICBpZiAoZGVsYXlNcyA+IDEpIHtcclxuICAgICAgdGhpcy5wbGF5YmFja1RpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHRoaXMucHJvY2Vzc0ZyYW1lKCksIE1hdGgubWF4KDEsIGRlbGF5TXMgLSAxKSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAvLyBXZSdyZSBiZWhpbmQsIHByb2Nlc3MgaW1tZWRpYXRlbHlcclxuICAgICAgc2V0SW1tZWRpYXRlKCgpID0+IHRoaXMucHJvY2Vzc0ZyYW1lKCkpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUHJvY2VzcyBhbmQgc2VuZCBhIHNpbmdsZSBhdWRpbyBmcmFtZVxyXG4gICAqL1xyXG4gIHByaXZhdGUgYXN5bmMgcHJvY2Vzc0ZyYW1lKCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgaWYgKCF0aGlzLmlzUGxheWJhY2tMb29wUnVubmluZyB8fCB0aGlzLnN0YXRlLnN0YXR1cyAhPT0gQXVkaW9QbGF5ZXJTdGF0dXMuUGxheWluZykge1xyXG4gICAgICBpZiAodGhpcy5mcmFtZXNQbGF5ZWQgPT09IDApIHtcclxuICAgICAgICBjb25zb2xlLmxvZyhgW0F1ZGlvUGxheWVyXSBwcm9jZXNzRnJhbWUgc2tpcHBlZDogbG9vcFJ1bm5pbmc9JHt0aGlzLmlzUGxheWJhY2tMb29wUnVubmluZ30sIHN0YXR1cz0ke3RoaXMuc3RhdGUuc3RhdHVzfWApO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICAvLyBDaGVjayBidWZmZXIgc3RhdHVzXHJcbiAgICBjb25zdCBidWZmZXJTaXplID0gdGhpcy5mcmFtZVF1ZXVlLmxlbmd0aDtcclxuICAgIFxyXG4gICAgaWYgKGJ1ZmZlclNpemUgPiAwICYmIHRoaXMuYXVkaW9Tb3VyY2UpIHtcclxuICAgICAgY29uc3QgaW50MTZBcnJheSA9IHRoaXMuZnJhbWVRdWV1ZS5zaGlmdCgpITtcclxuICAgICAgY29uc3QgYXVkaW9GcmFtZSA9IG5ldyBBdWRpb0ZyYW1lKGludDE2QXJyYXksIFNBTVBMRV9SQVRFLCBDSEFOTkVMUywgU0FNUExFU19QRVJfRlJBTUUpO1xyXG4gICAgICBcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBhd2FpdCB0aGlzLmF1ZGlvU291cmNlLmNhcHR1cmVGcmFtZShhdWRpb0ZyYW1lKTtcclxuICAgICAgICB0aGlzLmZyYW1lc1BsYXllZCsrO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIExvZyBwcm9ncmVzcyBldmVyeSA1MDAgZnJhbWVzICh+MTAgc2Vjb25kcylcclxuICAgICAgICBpZiAodGhpcy5mcmFtZXNQbGF5ZWQgJSA1MDAgPT09IDApIHtcclxuICAgICAgICAgIGNvbnNvbGUubG9nKGBbQXVkaW9QbGF5ZXJdIFByb2dyZXNzOiAke3RoaXMuZnJhbWVzUGxheWVkfSBmcmFtZXMgcGxheWVkLCBidWZmZXI6ICR7YnVmZmVyU2l6ZX1gKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKGBbQXVkaW9QbGF5ZXJdIEZyYW1lIGVycm9yOmAsIChlIGFzIEVycm9yKS5tZXNzYWdlKTtcclxuICAgICAgfVxyXG4gICAgICBcclxuICAgICAgLy8gVXBkYXRlIHRpbWluZyBmb3IgbmV4dCBmcmFtZVxyXG4gICAgICB0aGlzLm5leHRGcmFtZVRpbWUgKz0gRlJBTUVfSU5URVJWQUxfTlM7XHJcbiAgICAgIFxyXG4gICAgICAvLyBBZGFwdGl2ZSB0aW1pbmc6IGlmIGJ1ZmZlciBpcyBsb3csIHNsb3cgZG93biBzbGlnaHRseSB0byBsZXQgaXQgcmVjb3ZlclxyXG4gICAgICBpZiAoYnVmZmVyU2l6ZSA8IExPV19CVUZGRVJfVEhSRVNIT0xEICYmICF0aGlzLmZmbXBlZ0RvbmUpIHtcclxuICAgICAgICAvLyBBZGQgMW1zIGRlbGF5IHRvIGxldCBidWZmZXIgcmVjb3ZlclxyXG4gICAgICAgIHRoaXMubmV4dEZyYW1lVGltZSArPSBCaWdJbnQoMV8wMDBfMDAwKTtcclxuICAgICAgICB0aGlzLmJ1ZmZlclVuZGVycnVucysrO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmICh0aGlzLmJ1ZmZlclVuZGVycnVucyAlIDUwID09PSAwKSB7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW0F1ZGlvUGxheWVyXSBCdWZmZXIgbG93OiAke2J1ZmZlclNpemV9IGZyYW1lcywgJHt0aGlzLmJ1ZmZlclVuZGVycnVuc30gdW5kZXJydW5zYCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIFxyXG4gICAgICAvLyBTY2hlZHVsZSBuZXh0IGZyYW1lXHJcbiAgICAgIHRoaXMuc2NoZWR1bGVOZXh0RnJhbWUoKTtcclxuICAgICAgXHJcbiAgICB9IGVsc2UgaWYgKHRoaXMuZmZtcGVnRG9uZSAmJiBidWZmZXJTaXplID09PSAwKSB7XHJcbiAgICAgIC8vIFBsYXliYWNrIGZpbmlzaGVkXHJcbiAgICAgIGNvbnNvbGUubG9nKCdbQXVkaW9QbGF5ZXJdIFBsYXliYWNrIGZpbmlzaGVkIC0gcXVldWUgZW1wdHkgYW5kIEZGbXBlZyBkb25lJyk7XHJcbiAgICAgIHRoaXMuc3RvcCgpO1xyXG4gICAgfSBlbHNlIGlmIChidWZmZXJTaXplID09PSAwKSB7XHJcbiAgICAgIC8vIEJ1ZmZlciB1bmRlcnJ1biAtIHdhaXQgZm9yIG1vcmUgZGF0YVxyXG4gICAgICB0aGlzLmJ1ZmZlclVuZGVycnVucysrO1xyXG4gICAgICBjb25zb2xlLmxvZyhgW0F1ZGlvUGxheWVyXSBCdWZmZXIgdW5kZXJydW4gIyR7dGhpcy5idWZmZXJVbmRlcnJ1bnN9LCB3YWl0aW5nIGZvciBkYXRhLi4uYCk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBXYWl0IGEgYml0IGFuZCB0cnkgYWdhaW5cclxuICAgICAgdGhpcy5uZXh0RnJhbWVUaW1lID0gaHJ0aW1lLmJpZ2ludCgpICsgQmlnSW50KDUwXzAwMF8wMDApOyAvLyA1MG1zXHJcbiAgICAgIHRoaXMuc2NoZWR1bGVOZXh0RnJhbWUoKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgY2xlYW51cCgpOiB2b2lkIHtcclxuICAgIC8vIFN0b3AgcGxheWJhY2sgbG9vcFxyXG4gICAgdGhpcy5pc1BsYXliYWNrTG9vcFJ1bm5pbmcgPSBmYWxzZTtcclxuICAgIGlmICh0aGlzLnBsYXliYWNrVGltZW91dCkge1xyXG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5wbGF5YmFja1RpbWVvdXQpO1xyXG4gICAgICB0aGlzLnBsYXliYWNrVGltZW91dCA9IG51bGw7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIEtpbGwgRkZtcGVnXHJcbiAgICBpZiAodGhpcy5mZm1wZWdQcm9jZXNzKSB7XHJcbiAgICAgIHRoaXMuZmZtcGVnUHJvY2Vzcy5raWxsKCdTSUdLSUxMJyk7XHJcbiAgICAgIHRoaXMuZmZtcGVnUHJvY2VzcyA9IG51bGw7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIENsZWFyIGZyYW1lIHF1ZXVlXHJcbiAgICB0aGlzLmZyYW1lUXVldWUgPSBbXTtcclxuICAgIHRoaXMubGVmdG92ZXJCdWZmZXIgPSBudWxsO1xyXG4gICAgXHJcbiAgICAvLyBSZXNldCB0aW1pbmcgYW5kIHN0YXRlXHJcbiAgICB0aGlzLm5leHRGcmFtZVRpbWUgPSBCaWdJbnQoMCk7XHJcbiAgICB0aGlzLmZmbXBlZ0RvbmUgPSBmYWxzZTtcclxuICAgIFxyXG4gICAgLy8gTG9nIHN0YXRzXHJcbiAgICBpZiAodGhpcy5mcmFtZXNQbGF5ZWQgPiAwKSB7XHJcbiAgICAgIGNvbnNvbGUubG9nKGBbQXVkaW9QbGF5ZXJdIFBsYXliYWNrIHN0YXRzOiAke3RoaXMuZnJhbWVzUGxheWVkfSBmcmFtZXMsICR7dGhpcy5idWZmZXJVbmRlcnJ1bnN9IHVuZGVycnVuc2ApO1xyXG4gICAgfVxyXG4gICAgdGhpcy5idWZmZXJVbmRlcnJ1bnMgPSAwO1xyXG4gICAgdGhpcy5mcmFtZXNQbGF5ZWQgPSAwO1xyXG4gICAgXHJcbiAgICAvLyBOb3RlOiBXZSBkb24ndCB1bnB1Ymxpc2ggdGhlIHRyYWNrIC0gaXQgc3RheXMgcHVibGlzaGVkIGZvciBuZXh0IHBsYXlcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc2V0U3RhdGUobmV3U3RhdGU6IEF1ZGlvUGxheWVyU3RhdGUpOiB2b2lkIHtcclxuICAgIGNvbnN0IG9sZFN0YXRlID0gdGhpcy5zdGF0ZTtcclxuICAgIHRoaXMuc3RhdGUgPSBuZXdTdGF0ZTtcclxuICAgIHRoaXMuZW1pdCgnc3RhdGVDaGFuZ2UnLCBvbGRTdGF0ZSwgbmV3U3RhdGUpO1xyXG4gICAgXHJcbiAgICAvLyBTdGFydCBwbGF5YmFjayBsb29wIHdoZW4gdHJhbnNpdGlvbmluZyB0byBQbGF5aW5nXHJcbiAgICBpZiAobmV3U3RhdGUuc3RhdHVzID09PSBBdWRpb1BsYXllclN0YXR1cy5QbGF5aW5nICYmIG9sZFN0YXRlLnN0YXR1cyAhPT0gQXVkaW9QbGF5ZXJTdGF0dXMuUGxheWluZykge1xyXG4gICAgICBjb25zb2xlLmxvZyhgW0F1ZGlvUGxheWVyXSBTdGF0ZSBjaGFuZ2VkIHRvIFBsYXlpbmcsIHN0YXJ0aW5nIHBsYXliYWNrIGxvb3BgKTtcclxuICAgICAgdGhpcy5zY2hlZHVsZU5leHRGcmFtZSgpO1xyXG4gICAgfVxyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIENyZWF0ZSBhbiBhdWRpbyBwbGF5ZXJcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVBdWRpb1BsYXllcihvcHRpb25zPzogQ3JlYXRlQXVkaW9QbGF5ZXJPcHRpb25zKTogQXVkaW9QbGF5ZXIge1xyXG4gIHJldHVybiBuZXcgQXVkaW9QbGF5ZXIob3B0aW9ucyk7XHJcbn1cclxuIl19