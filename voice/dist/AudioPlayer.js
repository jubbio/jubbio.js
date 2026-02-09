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
            this.ffmpegProcess = (0, child_process_1.spawn)('bash', [
                '-c',
                `~/.local/bin/yt-dlp -f "bestaudio/best" -o - --no-playlist --no-warnings "${inputSource}" | ffmpeg -i pipe:0 -f s16le -ar ${SAMPLE_RATE} -ac ${CHANNELS} -acodec pcm_s16le -`
            ], { stdio: ['pipe', 'pipe', 'pipe'] });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQXVkaW9QbGF5ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvQXVkaW9QbGF5ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBbWNBLDhDQUVDO0FBcmNELG1DQUFzQztBQUN0QyxpREFBb0Q7QUFDcEQscUNBQWlDO0FBQ2pDLGdEQU8yQjtBQUMzQixtQ0FBNEM7QUFLNUMsNENBQTRDO0FBQzVDLE1BQU0sV0FBVyxHQUFHLEtBQUssQ0FBQztBQUMxQixNQUFNLFFBQVEsR0FBRyxDQUFDLENBQUM7QUFDbkIsTUFBTSxpQkFBaUIsR0FBRyxFQUFFLENBQUM7QUFDN0IsTUFBTSxpQkFBaUIsR0FBRyxDQUFDLFdBQVcsR0FBRyxpQkFBaUIsQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDLE1BQU07QUFFMUUseUJBQXlCO0FBQ3pCLE1BQU0saUJBQWlCLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsc0JBQXNCO0FBQ3BFLE1BQU0sb0JBQW9CLEdBQUcsR0FBRyxDQUFDLENBQUMsa0NBQWtDO0FBQ3BFLE1BQU0saUJBQWlCLEdBQUcsRUFBRSxDQUFDLENBQUkseUNBQXlDO0FBQzFFLE1BQU0saUJBQWlCLEdBQUcsR0FBRyxDQUFDLENBQUcsb0RBQW9EO0FBQ3JGLE1BQU0sb0JBQW9CLEdBQUcsRUFBRSxDQUFDLENBQUMseUNBQXlDO0FBRTFFOztHQUVHO0FBQ0gsTUFBYSxXQUFZLFNBQVEscUJBQVk7SUFDM0MsMkJBQTJCO0lBQ3BCLEtBQUssR0FBcUIsRUFBRSxNQUFNLEVBQUUseUJBQWlCLENBQUMsSUFBSSxFQUFFLENBQUM7SUFFcEUscUJBQXFCO0lBQ2IsT0FBTyxDQUEyQjtJQUUxQyxtQ0FBbUM7SUFDM0IsYUFBYSxHQUF5QixJQUFJLEdBQUcsRUFBRSxDQUFDO0lBRXhELDZCQUE2QjtJQUNyQixlQUFlLEdBQXlCLElBQUksQ0FBQztJQUVyRCxxQkFBcUI7SUFDYixhQUFhLEdBQXdCLElBQUksQ0FBQztJQUVs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MUUsQ0FBQztJQUVPLFFBQVEsQ0FBQyxRQUEwQjtRQUN6QyxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDO1FBQzVCLElBQUksQ0FBQyxLQUFLLEdBQUcsUUFBUSxDQUFDO1FBQ3RCLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLFFBQVEsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUU3QyxvREFBb0Q7UUFDcEQsSUFBSSxRQUFRLENBQUMsTUFBTSxLQUFLLHlCQUFpQixDQUFDLE9BQU8sSUFBSSxRQUFRLENBQUMsTUFBTSxLQUFLLHlCQUFpQixDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ25HLE9BQU8sQ0FBQyxHQUFHLENBQUMsZ0VBQWdFLENBQUMsQ0FBQztZQUM5RSxJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztRQUMzQixDQUFDO0lBQ0gsQ0FBQztDQUNGO0FBOVpELGtDQThaQztBQUVEOztHQUVHO0FBQ0gsU0FBZ0IsaUJBQWlCLENBQUMsT0FBa0M7SUFDbEUsT0FBTyxJQUFJLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUNsQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRXZlbnRFbWl0dGVyIH0gZnJvbSAnZXZlbnRzJztcclxuaW1wb3J0IHsgc3Bhd24sIENoaWxkUHJvY2VzcyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xyXG5pbXBvcnQgeyBocnRpbWUgfSBmcm9tICdwcm9jZXNzJztcclxuaW1wb3J0IHsgXHJcbiAgUm9vbSwgXHJcbiAgTG9jYWxBdWRpb1RyYWNrLCBcclxuICBBdWRpb1NvdXJjZSwgXHJcbiAgVHJhY2tQdWJsaXNoT3B0aW9ucywgXHJcbiAgVHJhY2tTb3VyY2UsXHJcbiAgQXVkaW9GcmFtZSBcclxufSBmcm9tICdAbGl2ZWtpdC9ydGMtbm9kZSc7XHJcbmltcG9ydCB7IEF1ZGlvUGxheWVyU3RhdHVzIH0gZnJvbSAnLi9lbnVtcyc7XHJcbmltcG9ydCB7IENyZWF0ZUF1ZGlvUGxheWVyT3B0aW9ucywgQXVkaW9QbGF5ZXJTdGF0ZSB9IGZyb20gJy4vdHlwZXMnO1xyXG5pbXBvcnQgeyBBdWRpb1Jlc291cmNlIH0gZnJvbSAnLi9BdWRpb1Jlc291cmNlJztcclxuaW1wb3J0IHsgVm9pY2VDb25uZWN0aW9uIH0gZnJvbSAnLi9Wb2ljZUNvbm5lY3Rpb24nO1xyXG5cclxuLy8gQXVkaW8gc2V0dGluZ3MgZm9yIExpdmVLaXQgKDQ4a0h6IHN0ZXJlbylcclxuY29uc3QgU0FNUExFX1JBVEUgPSA0ODAwMDtcclxuY29uc3QgQ0hBTk5FTFMgPSAyO1xyXG5jb25zdCBGUkFNRV9EVVJBVElPTl9NUyA9IDIwO1xyXG5jb25zdCBTQU1QTEVTX1BFUl9GUkFNRSA9IChTQU1QTEVfUkFURSAqIEZSQU1FX0RVUkFUSU9OX01TKSAvIDEwMDA7IC8vIDk2MFxyXG5cclxuLy8gSml0dGVyIGJ1ZmZlciBzZXR0aW5nc1xyXG5jb25zdCBGUkFNRV9JTlRFUlZBTF9OUyA9IEJpZ0ludCgyMF8wMDBfMDAwKTsgLy8gMjBtcyBpbiBuYW5vc2Vjb25kc1xyXG5jb25zdCBUQVJHRVRfQlVGRkVSX0ZSQU1FUyA9IDE1MDsgLy8gfjMgc2Vjb25kcyAtIHRhcmdldCBidWZmZXIgc2l6ZVxyXG5jb25zdCBNSU5fQlVGRkVSX0ZSQU1FUyA9IDc1OyAgICAvLyB+MS41IHNlY29uZHMgLSBtaW5pbXVtIGJlZm9yZSB3ZSBzdGFydFxyXG5jb25zdCBNQVhfQlVGRkVSX0ZSQU1FUyA9IDUwMDsgICAvLyB+MTAgc2Vjb25kcyAtIG1heCBidWZmZXIgdG8gcHJldmVudCBtZW1vcnkgaXNzdWVzXHJcbmNvbnN0IExPV19CVUZGRVJfVEhSRVNIT0xEID0gNTA7IC8vIH4xIHNlY29uZCAtIHdoZW4gdG8gc2xvdyBkb3duIHBsYXliYWNrXHJcblxyXG4vKipcclxuICogQXVkaW8gcGxheWVyIGZvciBwbGF5aW5nIGF1ZGlvIHJlc291cmNlc1xyXG4gKi9cclxuZXhwb3J0IGNsYXNzIEF1ZGlvUGxheWVyIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcclxuICAvKiogQ3VycmVudCBwbGF5ZXIgc3RhdGUgKi9cclxuICBwdWJsaWMgc3RhdGU6IEF1ZGlvUGxheWVyU3RhdGUgPSB7IHN0YXR1czogQXVkaW9QbGF5ZXJTdGF0dXMuSWRsZSB9O1xyXG4gIFxyXG4gIC8qKiBQbGF5ZXIgb3B0aW9ucyAqL1xyXG4gIHByaXZhdGUgb3B0aW9uczogQ3JlYXRlQXVkaW9QbGF5ZXJPcHRpb25zO1xyXG4gIFxyXG4gIC8qKiBTdWJzY3JpYmVkIHZvaWNlIGNvbm5lY3Rpb25zICovXHJcbiAgcHJpdmF0ZSBzdWJzY3JpcHRpb25zOiBTZXQ8Vm9pY2VDb25uZWN0aW9uPiA9IG5ldyBTZXQoKTtcclxuICBcclxuICAvKiogQ3VycmVudCBhdWRpbyByZXNvdXJjZSAqL1xyXG4gIHByaXZhdGUgY3VycmVudFJlc291cmNlOiBBdWRpb1Jlc291cmNlIHwgbnVsbCA9IG51bGw7XHJcbiAgXHJcbiAgLyoqIEZGbXBlZyBwcm9jZXNzICovXHJcbiAgcHJpdmF0ZSBmZm1wZWdQcm9jZXNzOiBDaGlsZFByb2Nlc3MgfCBudWxsID0gbnVsbDtcclxuICBcclxuICAvKiogTGl2ZUtpdCBhdWRpbyBzb3VyY2UgYW5kIHRyYWNrICovXHJcbiAgcHJpdmF0ZSBhdWRpb1NvdXJjZTogQXVkaW9Tb3VyY2UgfCBudWxsID0gbnVsbDtcclxuICBwcml2YXRlIGF1ZGlvVHJhY2s6IExvY2FsQXVkaW9UcmFjayB8IG51bGwgPSBudWxsO1xyXG4gIFxyXG4gIC8qKiBGcmFtZSBxdWV1ZSBhbmQgcGxheWJhY2sgc3RhdGUgKi9cclxuICBwcml2YXRlIGZyYW1lUXVldWU6IEludDE2QXJyYXlbXSA9IFtdO1xyXG4gIHByaXZhdGUgcGxheWJhY2tUaW1lb3V0OiBOb2RlSlMuVGltZW91dCB8IG51bGwgPSBudWxsO1xyXG4gIHByaXZhdGUgbGVmdG92ZXJCdWZmZXI6IEJ1ZmZlciB8IG51bGwgPSBudWxsO1xyXG4gIHByaXZhdGUgaXNQdWJsaXNoZWQgPSBmYWxzZTtcclxuICBcclxuICAvKiogSGlnaC1yZXNvbHV0aW9uIHRpbWluZyAqL1xyXG4gIHByaXZhdGUgbmV4dEZyYW1lVGltZTogYmlnaW50ID0gQmlnSW50KDApO1xyXG4gIHByaXZhdGUgaXNQbGF5YmFja0xvb3BSdW5uaW5nID0gZmFsc2U7XHJcbiAgcHJpdmF0ZSBmZm1wZWdEb25lID0gZmFsc2U7XHJcbiAgXHJcbiAgLyoqIEJ1ZmZlciBzdGF0aXN0aWNzICovXHJcbiAgcHJpdmF0ZSBidWZmZXJVbmRlcnJ1bnMgPSAwO1xyXG4gIHByaXZhdGUgZnJhbWVzUGxheWVkID0gMDtcclxuXHJcbiAgY29uc3RydWN0b3Iob3B0aW9uczogQ3JlYXRlQXVkaW9QbGF5ZXJPcHRpb25zID0ge30pIHtcclxuICAgIHN1cGVyKCk7XHJcbiAgICB0aGlzLm9wdGlvbnMgPSB7XHJcbiAgICAgIGJlaGF2aW9yczoge1xyXG4gICAgICAgIG5vU3Vic2NyaWJlcjogJ3BhdXNlJyxcclxuICAgICAgICBtYXhNaXNzZWRGcmFtZXM6IDUsXHJcbiAgICAgICAgLi4ub3B0aW9ucy5iZWhhdmlvcnNcclxuICAgICAgfVxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFBsYXkgYW4gYXVkaW8gcmVzb3VyY2VcclxuICAgKi9cclxuICBwbGF5KHJlc291cmNlOiBBdWRpb1Jlc291cmNlKTogdm9pZCB7XHJcbiAgICAvLyBTdG9wIGN1cnJlbnQgcGxheWJhY2tcclxuICAgIHRoaXMuc3RvcCgpO1xyXG4gICAgXHJcbiAgICB0aGlzLmN1cnJlbnRSZXNvdXJjZSA9IHJlc291cmNlO1xyXG4gICAgdGhpcy5zZXRTdGF0ZSh7IHN0YXR1czogQXVkaW9QbGF5ZXJTdGF0dXMuQnVmZmVyaW5nLCByZXNvdXJjZSB9KTtcclxuICAgIFxyXG4gICAgLy8gU3RhcnQgcGxheWJhY2sgaWYgd2UgaGF2ZSBhIHJlYWR5IGNvbm5lY3Rpb25cclxuICAgIGZvciAoY29uc3QgY29ubmVjdGlvbiBvZiB0aGlzLnN1YnNjcmlwdGlvbnMpIHtcclxuICAgICAgaWYgKGNvbm5lY3Rpb24uZ2V0Um9vbSgpKSB7XHJcbiAgICAgICAgdGhpcy5zdGFydFBsYXliYWNrKGNvbm5lY3Rpb24pO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBQYXVzZSBwbGF5YmFja1xyXG4gICAqL1xyXG4gIHBhdXNlKCk6IGJvb2xlYW4ge1xyXG4gICAgaWYgKHRoaXMuc3RhdGUuc3RhdHVzICE9PSBBdWRpb1BsYXllclN0YXR1cy5QbGF5aW5nKSB7XHJcbiAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuICAgIHRoaXMuc2V0U3RhdGUoeyBzdGF0dXM6IEF1ZGlvUGxheWVyU3RhdHVzLlBhdXNlZCwgcmVzb3VyY2U6IHRoaXMuY3VycmVudFJlc291cmNlIH0pO1xyXG4gICAgcmV0dXJuIHRydWU7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBVbnBhdXNlIHBsYXliYWNrXHJcbiAgICovXHJcbiAgdW5wYXVzZSgpOiBib29sZWFuIHtcclxuICAgIGlmICh0aGlzLnN0YXRlLnN0YXR1cyAhPT0gQXVkaW9QbGF5ZXJTdGF0dXMuUGF1c2VkKSB7XHJcbiAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuICAgIHRoaXMuc2V0U3RhdGUoeyBzdGF0dXM6IEF1ZGlvUGxheWVyU3RhdHVzLlBsYXlpbmcsIHJlc291cmNlOiB0aGlzLmN1cnJlbnRSZXNvdXJjZSB9KTtcclxuICAgIHJldHVybiB0cnVlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU3RvcCBwbGF5YmFja1xyXG4gICAqL1xyXG4gIHN0b3AoZm9yY2UgPSBmYWxzZSk6IGJvb2xlYW4ge1xyXG4gICAgaWYgKHRoaXMuc3RhdGUuc3RhdHVzID09PSBBdWRpb1BsYXllclN0YXR1cy5JZGxlICYmICFmb3JjZSkge1xyXG4gICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcbiAgICB0aGlzLmNsZWFudXAoKTtcclxuICAgIHRoaXMuY3VycmVudFJlc291cmNlID0gbnVsbDtcclxuICAgIHRoaXMuc2V0U3RhdGUoeyBzdGF0dXM6IEF1ZGlvUGxheWVyU3RhdHVzLklkbGUgfSk7XHJcbiAgICByZXR1cm4gdHJ1ZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFN1YnNjcmliZSBhIHZvaWNlIGNvbm5lY3Rpb24gdG8gdGhpcyBwbGF5ZXJcclxuICAgKiBAaW50ZXJuYWxcclxuICAgKi9cclxuICBzdWJzY3JpYmUoY29ubmVjdGlvbjogVm9pY2VDb25uZWN0aW9uKTogdm9pZCB7XHJcbiAgICB0aGlzLnN1YnNjcmlwdGlvbnMuYWRkKGNvbm5lY3Rpb24pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVW5zdWJzY3JpYmUgYSB2b2ljZSBjb25uZWN0aW9uIGZyb20gdGhpcyBwbGF5ZXJcclxuICAgKiBAaW50ZXJuYWxcclxuICAgKi9cclxuICB1bnN1YnNjcmliZShjb25uZWN0aW9uOiBWb2ljZUNvbm5lY3Rpb24pOiB2b2lkIHtcclxuICAgIHRoaXMuc3Vic2NyaXB0aW9ucy5kZWxldGUoY29ubmVjdGlvbik7XHJcbiAgICBcclxuICAgIC8vIEF1dG8tcGF1c2UgaWYgbm8gc3Vic2NyaWJlcnNcclxuICAgIGlmICh0aGlzLnN1YnNjcmlwdGlvbnMuc2l6ZSA9PT0gMCAmJiB0aGlzLm9wdGlvbnMuYmVoYXZpb3JzPy5ub1N1YnNjcmliZXIgPT09ICdwYXVzZScpIHtcclxuICAgICAgaWYgKHRoaXMuc3RhdGUuc3RhdHVzID09PSBBdWRpb1BsYXllclN0YXR1cy5QbGF5aW5nKSB7XHJcbiAgICAgICAgdGhpcy5zZXRTdGF0ZSh7IHN0YXR1czogQXVkaW9QbGF5ZXJTdGF0dXMuQXV0b1BhdXNlZCwgcmVzb3VyY2U6IHRoaXMuY3VycmVudFJlc291cmNlIH0pO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDYWxsZWQgd2hlbiBhIGNvbm5lY3Rpb24gYmVjb21lcyByZWFkeVxyXG4gICAqIEBpbnRlcm5hbFxyXG4gICAqL1xyXG4gIG9uQ29ubmVjdGlvblJlYWR5KGNvbm5lY3Rpb246IFZvaWNlQ29ubmVjdGlvbik6IHZvaWQge1xyXG4gICAgLy8gSWYgd2UgaGF2ZSBhIHJlc291cmNlIHdhaXRpbmcsIHN0YXJ0IHBsYXliYWNrXHJcbiAgICBpZiAodGhpcy5jdXJyZW50UmVzb3VyY2UgJiYgdGhpcy5zdGF0ZS5zdGF0dXMgPT09IEF1ZGlvUGxheWVyU3RhdHVzLkJ1ZmZlcmluZykge1xyXG4gICAgICB0aGlzLnN0YXJ0UGxheWJhY2soY29ubmVjdGlvbik7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFzeW5jIHN0YXJ0UGxheWJhY2soY29ubmVjdGlvbjogVm9pY2VDb25uZWN0aW9uKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCByb29tID0gY29ubmVjdGlvbi5nZXRSb29tKCk7XHJcbiAgICBpZiAoIXJvb20gfHwgIXRoaXMuY3VycmVudFJlc291cmNlKSByZXR1cm47XHJcblxyXG4gICAgdHJ5IHtcclxuICAgICAgLy8gQ3JlYXRlIGF1ZGlvIHNvdXJjZSBhbmQgdHJhY2tcclxuICAgICAgYXdhaXQgdGhpcy5zZXR1cEF1ZGlvVHJhY2socm9vbSk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBTdGFydCBGRm1wZWcgdG8gZGVjb2RlIGF1ZGlvIC0gdGhpcyB3aWxsIHNldCBzdGF0ZSB0byBQbGF5aW5nIHdoZW4gcmVhZHlcclxuICAgICAgYXdhaXQgdGhpcy5zdGFydEZGbXBlZygpO1xyXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgdGhpcy5lbWl0KCdlcnJvcicsIHsgbWVzc2FnZTogKGVycm9yIGFzIEVycm9yKS5tZXNzYWdlLCByZXNvdXJjZTogdGhpcy5jdXJyZW50UmVzb3VyY2UgfSk7XHJcbiAgICAgIHRoaXMuc3RvcCgpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhc3luYyBzZXR1cEF1ZGlvVHJhY2socm9vbTogUm9vbSk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgaWYgKHRoaXMuaXNQdWJsaXNoZWQpIHJldHVybjtcclxuICAgIFxyXG4gICAgdGhpcy5hdWRpb1NvdXJjZSA9IG5ldyBBdWRpb1NvdXJjZShTQU1QTEVfUkFURSwgQ0hBTk5FTFMpO1xyXG4gICAgdGhpcy5hdWRpb1RyYWNrID0gTG9jYWxBdWRpb1RyYWNrLmNyZWF0ZUF1ZGlvVHJhY2soJ211c2ljJywgdGhpcy5hdWRpb1NvdXJjZSk7XHJcbiAgICBcclxuICAgIGNvbnN0IG9wdGlvbnMgPSBuZXcgVHJhY2tQdWJsaXNoT3B0aW9ucygpO1xyXG4gICAgb3B0aW9ucy5zb3VyY2UgPSBUcmFja1NvdXJjZS5TT1VSQ0VfTUlDUk9QSE9ORTtcclxuICAgIFxyXG4gICAgaWYgKHJvb20ubG9jYWxQYXJ0aWNpcGFudCkge1xyXG4gICAgICBhd2FpdCByb29tLmxvY2FsUGFydGljaXBhbnQucHVibGlzaFRyYWNrKHRoaXMuYXVkaW9UcmFjaywgb3B0aW9ucyk7XHJcbiAgICB9XHJcbiAgICB0aGlzLmlzUHVibGlzaGVkID0gdHJ1ZTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYXN5bmMgc3RhcnRGRm1wZWcoKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBpZiAoIXRoaXMuY3VycmVudFJlc291cmNlKSByZXR1cm47XHJcbiAgICBcclxuICAgIGNvbnN0IGlucHV0U291cmNlID0gdGhpcy5jdXJyZW50UmVzb3VyY2UuZ2V0SW5wdXRTb3VyY2UoKTtcclxuICAgIGNvbnNvbGUubG9nKGBGRm1wZWcgaW5wdXQgc291cmNlOiAke2lucHV0U291cmNlLnN1YnN0cmluZygwLCAxMDApfS4uLmApO1xyXG4gICAgXHJcbiAgICAvLyBDaGVjayBpZiB0aGlzIGlzIGEgc3RyZWFtaW5nIFVSTCB0aGF0IG5lZWRzIHl0LWRscFxyXG4gICAgY29uc3QgbmVlZHNZdERscCA9IGlucHV0U291cmNlLmluY2x1ZGVzKCd5b3V0dWJlLmNvbScpIHx8IFxyXG4gICAgICAgICAgICAgICAgICAgICAgIGlucHV0U291cmNlLmluY2x1ZGVzKCd5b3V0dS5iZScpIHx8XHJcbiAgICAgICAgICAgICAgICAgICAgICAgaW5wdXRTb3VyY2UuaW5jbHVkZXMoJ3NvdW5kY2xvdWQuY29tJykgfHxcclxuICAgICAgICAgICAgICAgICAgICAgICBpbnB1dFNvdXJjZS5pbmNsdWRlcygndHdpdGNoLnR2JykgfHxcclxuICAgICAgICAgICAgICAgICAgICAgICBpbnB1dFNvdXJjZS5zdGFydHNXaXRoKCd5dHNlYXJjaDonKTtcclxuICAgIFxyXG4gICAgaWYgKG5lZWRzWXREbHApIHtcclxuICAgICAgLy8gVXNlIHl0LWRscCB0byBwaXBlIGF1ZGlvIGRpcmVjdGx5IHRvIEZGbXBlZ1xyXG4gICAgICBjb25zb2xlLmxvZygnVXNpbmcgeXQtZGxwIHBpcGUgbW9kZScpO1xyXG4gICAgICB0aGlzLmZmbXBlZ1Byb2Nlc3MgPSBzcGF3bignYmFzaCcsIFtcclxuICAgICAgICAnLWMnLFxyXG4gICAgICAgIGB+Ly5sb2NhbC9iaW4veXQtZGxwIC1mIFwiYmVzdGF1ZGlvL2Jlc3RcIiAtbyAtIC0tbm8tcGxheWxpc3QgLS1uby13YXJuaW5ncyBcIiR7aW5wdXRTb3VyY2V9XCIgfCBmZm1wZWcgLWkgcGlwZTowIC1mIHMxNmxlIC1hciAke1NBTVBMRV9SQVRFfSAtYWMgJHtDSEFOTkVMU30gLWFjb2RlYyBwY21fczE2bGUgLWBcclxuICAgICAgXSwgeyBzdGRpbzogWydwaXBlJywgJ3BpcGUnLCAncGlwZSddIH0pO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgY29uc29sZS5sb2coJ1VzaW5nIGRpcmVjdCBGRm1wZWcgbW9kZScpO1xyXG4gICAgICB0aGlzLmZmbXBlZ1Byb2Nlc3MgPSBzcGF3bignZmZtcGVnJywgW1xyXG4gICAgICAgICctcmVjb25uZWN0JywgJzEnLFxyXG4gICAgICAgICctcmVjb25uZWN0X3N0cmVhbWVkJywgJzEnLFxyXG4gICAgICAgICctcmVjb25uZWN0X2RlbGF5X21heCcsICc1JyxcclxuICAgICAgICAnLWknLCBpbnB1dFNvdXJjZSxcclxuICAgICAgICAnLWYnLCAnczE2bGUnLFxyXG4gICAgICAgICctYXInLCBTdHJpbmcoU0FNUExFX1JBVEUpLFxyXG4gICAgICAgICctYWMnLCBTdHJpbmcoQ0hBTk5FTFMpLFxyXG4gICAgICAgICctYWNvZGVjJywgJ3BjbV9zMTZsZScsXHJcbiAgICAgICAgJy0nXHJcbiAgICAgIF0sIHsgc3RkaW86IFsncGlwZScsICdwaXBlJywgJ3BpcGUnXSB9KTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBmcmFtZVNpemUgPSBTQU1QTEVTX1BFUl9GUkFNRSAqIENIQU5ORUxTICogMjtcclxuICAgIHRoaXMuZmZtcGVnRG9uZSA9IGZhbHNlO1xyXG4gICAgbGV0IGhhc1JlY2VpdmVkRGF0YSA9IGZhbHNlO1xyXG5cclxuICAgIHRoaXMuZmZtcGVnUHJvY2Vzcy5zdGRvdXQ/Lm9uKCdkYXRhJywgKGNodW5rOiBCdWZmZXIpID0+IHtcclxuICAgICAgaWYgKHRoaXMuc3RhdGUuc3RhdHVzICE9PSBBdWRpb1BsYXllclN0YXR1cy5QbGF5aW5nICYmIFxyXG4gICAgICAgICAgdGhpcy5zdGF0ZS5zdGF0dXMgIT09IEF1ZGlvUGxheWVyU3RhdHVzLkJ1ZmZlcmluZykgcmV0dXJuO1xyXG4gICAgICBcclxuICAgICAgaGFzUmVjZWl2ZWREYXRhID0gdHJ1ZTtcclxuICAgICAgXHJcbiAgICAgIC8vIEhhbmRsZSBsZWZ0b3ZlciBmcm9tIHByZXZpb3VzIGNodW5rXHJcbiAgICAgIGlmICh0aGlzLmxlZnRvdmVyQnVmZmVyICYmIHRoaXMubGVmdG92ZXJCdWZmZXIubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIGNodW5rID0gQnVmZmVyLmNvbmNhdChbdGhpcy5sZWZ0b3ZlckJ1ZmZlciwgY2h1bmtdKTtcclxuICAgICAgICB0aGlzLmxlZnRvdmVyQnVmZmVyID0gbnVsbDtcclxuICAgICAgfVxyXG4gICAgICBcclxuICAgICAgbGV0IG9mZnNldCA9IDA7XHJcbiAgICAgIHdoaWxlIChvZmZzZXQgKyBmcmFtZVNpemUgPD0gY2h1bmsubGVuZ3RoKSB7XHJcbiAgICAgICAgY29uc3QgZnJhbWUgPSBjaHVuay5zbGljZShvZmZzZXQsIG9mZnNldCArIGZyYW1lU2l6ZSk7XHJcbiAgICAgICAgY29uc3QgaW50MTZBcnJheSA9IG5ldyBJbnQxNkFycmF5KFNBTVBMRVNfUEVSX0ZSQU1FICogQ0hBTk5FTFMpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgaW50MTZBcnJheS5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgaW50MTZBcnJheVtpXSA9IGZyYW1lLnJlYWRJbnQxNkxFKGkgKiAyKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgdGhpcy5mcmFtZVF1ZXVlLnB1c2goaW50MTZBcnJheSk7XHJcbiAgICAgICAgb2Zmc2V0ICs9IGZyYW1lU2l6ZTtcclxuICAgICAgfVxyXG4gICAgICBcclxuICAgICAgLy8gU2F2ZSBsZWZ0b3ZlclxyXG4gICAgICBpZiAob2Zmc2V0IDwgY2h1bmsubGVuZ3RoKSB7XHJcbiAgICAgICAgdGhpcy5sZWZ0b3ZlckJ1ZmZlciA9IGNodW5rLnNsaWNlKG9mZnNldCk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIGxldCBzdGRlcnJPdXRwdXQgPSAnJztcclxuICAgIHRoaXMuZmZtcGVnUHJvY2Vzcy5zdGRlcnI/Lm9uKCdkYXRhJywgKGRhdGE6IEJ1ZmZlcikgPT4ge1xyXG4gICAgICBzdGRlcnJPdXRwdXQgKz0gZGF0YS50b1N0cmluZygpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5mZm1wZWdQcm9jZXNzLm9uKCdjbG9zZScsIChjb2RlKSA9PiB7XHJcbiAgICAgIHRoaXMuZmZtcGVnRG9uZSA9IHRydWU7XHJcbiAgICAgIHRoaXMuZmZtcGVnUHJvY2VzcyA9IG51bGw7XHJcbiAgICAgIGlmIChjb2RlICE9PSAwKSB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcihgRkZtcGVnIHN0ZGVycjpcXG4ke3N0ZGVyck91dHB1dH1gKTtcclxuICAgICAgfVxyXG4gICAgICBjb25zb2xlLmxvZyhgW0F1ZGlvUGxheWVyXSBGRm1wZWcgY2xvc2VkIHdpdGggY29kZSAke2NvZGV9LCBoYXNSZWNlaXZlZERhdGE6ICR7aGFzUmVjZWl2ZWREYXRhfSwgcXVldWU6ICR7dGhpcy5mcmFtZVF1ZXVlLmxlbmd0aH1gKTtcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuZmZtcGVnUHJvY2Vzcy5vbignZXJyb3InLCAoZXJyKSA9PiB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZGbXBlZyBwcm9jZXNzIGVycm9yOicsIGVyci5tZXNzYWdlKTtcclxuICAgICAgdGhpcy5lbWl0KCdlcnJvcicsIHsgbWVzc2FnZTogZXJyLm1lc3NhZ2UsIHJlc291cmNlOiB0aGlzLmN1cnJlbnRSZXNvdXJjZSB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFdhaXQgZm9yIGluaXRpYWwgYnVmZmVyIHdpdGggdGltZW91dFxyXG4gICAgY29uc3QgYnVmZmVyVGltZW91dCA9IDEwMDAwOyAvLyAxMCBzZWNvbmRzIGZvciBpbml0aWFsIGJ1ZmZlclxyXG4gICAgY29uc3Qgc3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcclxuICAgIFxyXG4gICAgd2hpbGUgKHRoaXMuZnJhbWVRdWV1ZS5sZW5ndGggPCBNSU5fQlVGRkVSX0ZSQU1FUyAmJiBEYXRlLm5vdygpIC0gc3RhcnRUaW1lIDwgYnVmZmVyVGltZW91dCkge1xyXG4gICAgICBhd2FpdCBuZXcgUHJvbWlzZShyID0+IHNldFRpbWVvdXQociwgMTAwKSk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBDaGVjayBpZiBGRm1wZWcgZmFpbGVkIGVhcmx5XHJcbiAgICAgIGlmICh0aGlzLmZmbXBlZ0RvbmUgJiYgdGhpcy5mcmFtZVF1ZXVlLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignRkZtcGVnIGZhaWxlZCB0byBwcm9kdWNlIGF1ZGlvIGRhdGEnKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICBpZiAodGhpcy5mcmFtZVF1ZXVlLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RpbWVvdXQgd2FpdGluZyBmb3IgYXVkaW8gZGF0YScpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBjb25zb2xlLmxvZyhgW0F1ZGlvUGxheWVyXSBTdGFydGluZyBwbGF5YmFjayB3aXRoICR7dGhpcy5mcmFtZVF1ZXVlLmxlbmd0aH0gZnJhbWVzIGJ1ZmZlcmVkICh0YXJnZXQ6ICR7VEFSR0VUX0JVRkZFUl9GUkFNRVN9KWApO1xyXG5cclxuICAgIC8vIE1hcmsgcmVhZHkgZm9yIHBsYXliYWNrIC0gc2V0U3RhdGUgd2lsbCB0cmlnZ2VyIHRoZSBsb29wXHJcbiAgICB0aGlzLmlzUGxheWJhY2tMb29wUnVubmluZyA9IHRydWU7XHJcbiAgICB0aGlzLm5leHRGcmFtZVRpbWUgPSBocnRpbWUuYmlnaW50KCk7XHJcbiAgICBjb25zb2xlLmxvZyhgW0F1ZGlvUGxheWVyXSBQbGF5YmFjayByZWFkeSwgYXVkaW9Tb3VyY2UgZXhpc3RzOiAkeyEhdGhpcy5hdWRpb1NvdXJjZX1gKTtcclxuICAgIFxyXG4gICAgLy8gU2V0IHN0YXRlIHRvIHBsYXlpbmcgLSB0aGlzIHdpbGwgdHJpZ2dlciBzY2hlZHVsZU5leHRGcmFtZSB2aWEgc2V0U3RhdGVcclxuICAgIHRoaXMuc2V0U3RhdGUoeyBzdGF0dXM6IEF1ZGlvUGxheWVyU3RhdHVzLlBsYXlpbmcsIHJlc291cmNlOiB0aGlzLmN1cnJlbnRSZXNvdXJjZSB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhpZ2gtcmVzb2x1dGlvbiBmcmFtZSBzY2hlZHVsaW5nIHVzaW5nIGhydGltZVxyXG4gICAqIFRoaXMgcHJvdmlkZXMgbXVjaCBtb3JlIGFjY3VyYXRlIHRpbWluZyB0aGFuIHNldEludGVydmFsXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBzY2hlZHVsZU5leHRGcmFtZSgpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5pc1BsYXliYWNrTG9vcFJ1bm5pbmcgfHwgdGhpcy5zdGF0ZS5zdGF0dXMgIT09IEF1ZGlvUGxheWVyU3RhdHVzLlBsYXlpbmcpIHtcclxuICAgICAgY29uc29sZS5sb2coYFtBdWRpb1BsYXllcl0gc2NoZWR1bGVOZXh0RnJhbWUgc2tpcHBlZDogbG9vcFJ1bm5pbmc9JHt0aGlzLmlzUGxheWJhY2tMb29wUnVubmluZ30sIHN0YXR1cz0ke3RoaXMuc3RhdGUuc3RhdHVzfWApO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3Qgbm93ID0gaHJ0aW1lLmJpZ2ludCgpO1xyXG4gICAgY29uc3QgZGVsYXlOcyA9IHRoaXMubmV4dEZyYW1lVGltZSAtIG5vdztcclxuICAgIGNvbnN0IGRlbGF5TXMgPSBOdW1iZXIoZGVsYXlOcykgLyAxXzAwMF8wMDA7XHJcblxyXG4gICAgaWYgKHRoaXMuZnJhbWVzUGxheWVkID09PSAwKSB7XHJcbiAgICAgIGNvbnNvbGUubG9nKGBbQXVkaW9QbGF5ZXJdIEZpcnN0IGZyYW1lIHNjaGVkdWxpbmc6IGRlbGF5TXM9JHtkZWxheU1zLnRvRml4ZWQoMil9YCk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gU2NoZWR1bGUgbmV4dCBmcmFtZVxyXG4gICAgaWYgKGRlbGF5TXMgPiAxKSB7XHJcbiAgICAgIHRoaXMucGxheWJhY2tUaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB0aGlzLnByb2Nlc3NGcmFtZSgpLCBNYXRoLm1heCgxLCBkZWxheU1zIC0gMSkpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgLy8gV2UncmUgYmVoaW5kLCBwcm9jZXNzIGltbWVkaWF0ZWx5XHJcbiAgICAgIHNldEltbWVkaWF0ZSgoKSA9PiB0aGlzLnByb2Nlc3NGcmFtZSgpKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFByb2Nlc3MgYW5kIHNlbmQgYSBzaW5nbGUgYXVkaW8gZnJhbWVcclxuICAgKi9cclxuICBwcml2YXRlIGFzeW5jIHByb2Nlc3NGcmFtZSgpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGlmICghdGhpcy5pc1BsYXliYWNrTG9vcFJ1bm5pbmcgfHwgdGhpcy5zdGF0ZS5zdGF0dXMgIT09IEF1ZGlvUGxheWVyU3RhdHVzLlBsYXlpbmcpIHtcclxuICAgICAgaWYgKHRoaXMuZnJhbWVzUGxheWVkID09PSAwKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coYFtBdWRpb1BsYXllcl0gcHJvY2Vzc0ZyYW1lIHNraXBwZWQ6IGxvb3BSdW5uaW5nPSR7dGhpcy5pc1BsYXliYWNrTG9vcFJ1bm5pbmd9LCBzdGF0dXM9JHt0aGlzLnN0YXRlLnN0YXR1c31gKTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgLy8gQ2hlY2sgYnVmZmVyIHN0YXR1c1xyXG4gICAgY29uc3QgYnVmZmVyU2l6ZSA9IHRoaXMuZnJhbWVRdWV1ZS5sZW5ndGg7XHJcbiAgICBcclxuICAgIGlmIChidWZmZXJTaXplID4gMCAmJiB0aGlzLmF1ZGlvU291cmNlKSB7XHJcbiAgICAgIGNvbnN0IGludDE2QXJyYXkgPSB0aGlzLmZyYW1lUXVldWUuc2hpZnQoKSE7XHJcbiAgICAgIGNvbnN0IGF1ZGlvRnJhbWUgPSBuZXcgQXVkaW9GcmFtZShpbnQxNkFycmF5LCBTQU1QTEVfUkFURSwgQ0hBTk5FTFMsIFNBTVBMRVNfUEVSX0ZSQU1FKTtcclxuICAgICAgXHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgYXdhaXQgdGhpcy5hdWRpb1NvdXJjZS5jYXB0dXJlRnJhbWUoYXVkaW9GcmFtZSk7XHJcbiAgICAgICAgdGhpcy5mcmFtZXNQbGF5ZWQrKztcclxuICAgICAgICBcclxuICAgICAgICAvLyBMb2cgcHJvZ3Jlc3MgZXZlcnkgNTAwIGZyYW1lcyAofjEwIHNlY29uZHMpXHJcbiAgICAgICAgaWYgKHRoaXMuZnJhbWVzUGxheWVkICUgNTAwID09PSAwKSB7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW0F1ZGlvUGxheWVyXSBQcm9ncmVzczogJHt0aGlzLmZyYW1lc1BsYXllZH0gZnJhbWVzIHBsYXllZCwgYnVmZmVyOiAke2J1ZmZlclNpemV9YCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcihgW0F1ZGlvUGxheWVyXSBGcmFtZSBlcnJvcjpgLCAoZSBhcyBFcnJvcikubWVzc2FnZSk7XHJcbiAgICAgIH1cclxuICAgICAgXHJcbiAgICAgIC8vIFVwZGF0ZSB0aW1pbmcgZm9yIG5leHQgZnJhbWVcclxuICAgICAgdGhpcy5uZXh0RnJhbWVUaW1lICs9IEZSQU1FX0lOVEVSVkFMX05TO1xyXG4gICAgICBcclxuICAgICAgLy8gQWRhcHRpdmUgdGltaW5nOiBpZiBidWZmZXIgaXMgbG93LCBzbG93IGRvd24gc2xpZ2h0bHkgdG8gbGV0IGl0IHJlY292ZXJcclxuICAgICAgaWYgKGJ1ZmZlclNpemUgPCBMT1dfQlVGRkVSX1RIUkVTSE9MRCAmJiAhdGhpcy5mZm1wZWdEb25lKSB7XHJcbiAgICAgICAgLy8gQWRkIDFtcyBkZWxheSB0byBsZXQgYnVmZmVyIHJlY292ZXJcclxuICAgICAgICB0aGlzLm5leHRGcmFtZVRpbWUgKz0gQmlnSW50KDFfMDAwXzAwMCk7XHJcbiAgICAgICAgdGhpcy5idWZmZXJVbmRlcnJ1bnMrKztcclxuICAgICAgICBcclxuICAgICAgICBpZiAodGhpcy5idWZmZXJVbmRlcnJ1bnMgJSA1MCA9PT0gMCkge1xyXG4gICAgICAgICAgY29uc29sZS5sb2coYFtBdWRpb1BsYXllcl0gQnVmZmVyIGxvdzogJHtidWZmZXJTaXplfSBmcmFtZXMsICR7dGhpcy5idWZmZXJVbmRlcnJ1bnN9IHVuZGVycnVuc2ApO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICBcclxuICAgICAgLy8gU2NoZWR1bGUgbmV4dCBmcmFtZVxyXG4gICAgICB0aGlzLnNjaGVkdWxlTmV4dEZyYW1lKCk7XHJcbiAgICAgIFxyXG4gICAgfSBlbHNlIGlmICh0aGlzLmZmbXBlZ0RvbmUgJiYgYnVmZmVyU2l6ZSA9PT0gMCkge1xyXG4gICAgICAvLyBQbGF5YmFjayBmaW5pc2hlZFxyXG4gICAgICBjb25zb2xlLmxvZygnW0F1ZGlvUGxheWVyXSBQbGF5YmFjayBmaW5pc2hlZCAtIHF1ZXVlIGVtcHR5IGFuZCBGRm1wZWcgZG9uZScpO1xyXG4gICAgICB0aGlzLnN0b3AoKTtcclxuICAgIH0gZWxzZSBpZiAoYnVmZmVyU2l6ZSA9PT0gMCkge1xyXG4gICAgICAvLyBCdWZmZXIgdW5kZXJydW4gLSB3YWl0IGZvciBtb3JlIGRhdGFcclxuICAgICAgdGhpcy5idWZmZXJVbmRlcnJ1bnMrKztcclxuICAgICAgY29uc29sZS5sb2coYFtBdWRpb1BsYXllcl0gQnVmZmVyIHVuZGVycnVuICMke3RoaXMuYnVmZmVyVW5kZXJydW5zfSwgd2FpdGluZyBmb3IgZGF0YS4uLmApO1xyXG4gICAgICBcclxuICAgICAgLy8gV2FpdCBhIGJpdCBhbmQgdHJ5IGFnYWluXHJcbiAgICAgIHRoaXMubmV4dEZyYW1lVGltZSA9IGhydGltZS5iaWdpbnQoKSArIEJpZ0ludCg1MF8wMDBfMDAwKTsgLy8gNTBtc1xyXG4gICAgICB0aGlzLnNjaGVkdWxlTmV4dEZyYW1lKCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGNsZWFudXAoKTogdm9pZCB7XHJcbiAgICAvLyBTdG9wIHBsYXliYWNrIGxvb3BcclxuICAgIHRoaXMuaXNQbGF5YmFja0xvb3BSdW5uaW5nID0gZmFsc2U7XHJcbiAgICBpZiAodGhpcy5wbGF5YmFja1RpbWVvdXQpIHtcclxuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMucGxheWJhY2tUaW1lb3V0KTtcclxuICAgICAgdGhpcy5wbGF5YmFja1RpbWVvdXQgPSBudWxsO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvLyBLaWxsIEZGbXBlZ1xyXG4gICAgaWYgKHRoaXMuZmZtcGVnUHJvY2Vzcykge1xyXG4gICAgICB0aGlzLmZmbXBlZ1Byb2Nlc3Mua2lsbCgnU0lHS0lMTCcpO1xyXG4gICAgICB0aGlzLmZmbXBlZ1Byb2Nlc3MgPSBudWxsO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvLyBDbGVhciBmcmFtZSBxdWV1ZVxyXG4gICAgdGhpcy5mcmFtZVF1ZXVlID0gW107XHJcbiAgICB0aGlzLmxlZnRvdmVyQnVmZmVyID0gbnVsbDtcclxuICAgIFxyXG4gICAgLy8gUmVzZXQgdGltaW5nIGFuZCBzdGF0ZVxyXG4gICAgdGhpcy5uZXh0RnJhbWVUaW1lID0gQmlnSW50KDApO1xyXG4gICAgdGhpcy5mZm1wZWdEb25lID0gZmFsc2U7XHJcbiAgICBcclxuICAgIC8vIExvZyBzdGF0c1xyXG4gICAgaWYgKHRoaXMuZnJhbWVzUGxheWVkID4gMCkge1xyXG4gICAgICBjb25zb2xlLmxvZyhgW0F1ZGlvUGxheWVyXSBQbGF5YmFjayBzdGF0czogJHt0aGlzLmZyYW1lc1BsYXllZH0gZnJhbWVzLCAke3RoaXMuYnVmZmVyVW5kZXJydW5zfSB1bmRlcnJ1bnNgKTtcclxuICAgIH1cclxuICAgIHRoaXMuYnVmZmVyVW5kZXJydW5zID0gMDtcclxuICAgIHRoaXMuZnJhbWVzUGxheWVkID0gMDtcclxuICAgIFxyXG4gICAgLy8gTm90ZTogV2UgZG9uJ3QgdW5wdWJsaXNoIHRoZSB0cmFjayAtIGl0IHN0YXlzIHB1Ymxpc2hlZCBmb3IgbmV4dCBwbGF5XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHNldFN0YXRlKG5ld1N0YXRlOiBBdWRpb1BsYXllclN0YXRlKTogdm9pZCB7XHJcbiAgICBjb25zdCBvbGRTdGF0ZSA9IHRoaXMuc3RhdGU7XHJcbiAgICB0aGlzLnN0YXRlID0gbmV3U3RhdGU7XHJcbiAgICB0aGlzLmVtaXQoJ3N0YXRlQ2hhbmdlJywgb2xkU3RhdGUsIG5ld1N0YXRlKTtcclxuICAgIFxyXG4gICAgLy8gU3RhcnQgcGxheWJhY2sgbG9vcCB3aGVuIHRyYW5zaXRpb25pbmcgdG8gUGxheWluZ1xyXG4gICAgaWYgKG5ld1N0YXRlLnN0YXR1cyA9PT0gQXVkaW9QbGF5ZXJTdGF0dXMuUGxheWluZyAmJiBvbGRTdGF0ZS5zdGF0dXMgIT09IEF1ZGlvUGxheWVyU3RhdHVzLlBsYXlpbmcpIHtcclxuICAgICAgY29uc29sZS5sb2coYFtBdWRpb1BsYXllcl0gU3RhdGUgY2hhbmdlZCB0byBQbGF5aW5nLCBzdGFydGluZyBwbGF5YmFjayBsb29wYCk7XHJcbiAgICAgIHRoaXMuc2NoZWR1bGVOZXh0RnJhbWUoKTtcclxuICAgIH1cclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDcmVhdGUgYW4gYXVkaW8gcGxheWVyXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQXVkaW9QbGF5ZXIob3B0aW9ucz86IENyZWF0ZUF1ZGlvUGxheWVyT3B0aW9ucyk6IEF1ZGlvUGxheWVyIHtcclxuICByZXR1cm4gbmV3IEF1ZGlvUGxheWVyKG9wdGlvbnMpO1xyXG59XHJcbiJdfQ==