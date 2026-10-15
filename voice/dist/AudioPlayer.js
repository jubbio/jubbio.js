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
        // Add default error handler to prevent crashes
        this.on('error', (error) => {
            // Default handler - just log if no other listeners
            if (this.listenerCount('error') === 1) {
                console.error('[AudioPlayer] Error:', error.message);
            }
        });
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
            // Emit error but don't stop - let user decide what to do
            this.emit('error', { message: error.message, resource: this.currentResource });
            // Reset to idle state without full cleanup
            this.setState({ status: enums_1.AudioPlayerStatus.Idle });
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
        let inputSource = this.currentResource.getInputSource();
        console.log(`FFmpeg input source: ${inputSource.substring(0, 100)}...`);
        // Check if input is a URL or search query
        const isUrl = inputSource.startsWith('http://') ||
            inputSource.startsWith('https://') ||
            inputSource.startsWith('ytsearch:');
        // If not a URL, treat as YouTube search
        if (!isUrl) {
            inputSource = `ytsearch1:${inputSource}`;
            console.log(`Converted to YouTube search: ${inputSource}`);
        }
        // Check if this is a streaming URL that needs yt-dlp
        const needsYtDlp = inputSource.includes('youtube.com') ||
            inputSource.includes('youtu.be') ||
            inputSource.includes('soundcloud.com') ||
            inputSource.includes('twitch.tv') ||
            inputSource.startsWith('ytsearch');
        if (needsYtDlp) {
            // Use yt-dlp to pipe audio directly to FFmpeg
            console.log('Using yt-dlp pipe mode');
            // Detect platform
            const isWindows = process.platform === 'win32';
            const ytDlpPath = isWindows ? 'yt-dlp' : '~/.local/bin/yt-dlp';
            // SECURITY: Use args array (no shell) to prevent command injection
            // User input should never be passed through shell interpolation
            const ytdlpArgs = [
                '-f', 'bestaudio/best',
                '-o', '-',
                '--no-playlist',
                '--no-warnings',
                '--default-search', 'ytsearch',
                inputSource
            ];
            const ffmpegArgs = [
                '-i', 'pipe:0',
                '-f', 's16le',
                '-ar', String(SAMPLE_RATE),
                '-ac', String(CHANNELS),
                '-acodec', 'pcm_s16le',
                '-'
            ];
            console.log('[AudioPlayer] yt-dlp args:', ytdlpArgs.join(' '));
            // Spawn yt-dlp without shell
            const ytdlpProcess = (0, child_process_1.spawn)(ytDlpPath, ytdlpArgs, {
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: false
            });
            // Spawn ffmpeg without shell
            this.ffmpegProcess = (0, child_process_1.spawn)('ffmpeg', ffmpegArgs, {
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: false
            });
            // Track data flow
            let ytdlpDataReceived = 0;
            ytdlpProcess.stdout?.on('data', (chunk) => {
                ytdlpDataReceived += chunk.length;
                if (ytdlpDataReceived < 10000 || ytdlpDataReceived % 100000 < 10000) {
                    console.log(`[yt-dlp] stdout data: ${chunk.length} bytes (total: ${ytdlpDataReceived})`);
                }
            });
            // Pipe yt-dlp stdout to ffmpeg stdin
            ytdlpProcess.stdout?.pipe(this.ffmpegProcess.stdin);
            // Handle yt-dlp stderr - log everything for debugging
            ytdlpProcess.stderr?.on('data', (data) => {
                const msg = data.toString().trim();
                if (msg) {
                    console.log('[yt-dlp]', msg);
                }
            });
            ytdlpProcess.on('error', (err) => {
                console.error('[yt-dlp] process error:', err.message);
            });
            ytdlpProcess.on('close', (code) => {
                console.log(`[yt-dlp] closed with code ${code}, total data: ${ytdlpDataReceived} bytes`);
            });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQXVkaW9QbGF5ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvQXVkaW9QbGF5ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBdWhCQSw4Q0FFQztBQXpoQkQsbUNBQXNDO0FBQ3RDLGlEQUFvRDtBQUNwRCxxQ0FBaUM7QUFDakMsZ0RBTzJCO0FBQzNCLG1DQUE0QztBQUs1Qyw0Q0FBNEM7QUFDNUMsTUFBTSxXQUFXLEdBQUcsS0FBSyxDQUFDO0FBQzFCLE1BQU0sUUFBUSxHQUFHLENBQUMsQ0FBQztBQUNuQixNQUFNLGlCQUFpQixHQUFHLEVBQUUsQ0FBQztBQUM3QixNQUFNLGlCQUFpQixHQUFHLENBQUMsV0FBVyxHQUFHLGlCQUFpQixDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsTUFBTTtBQUUxRSx5QkFBeUI7QUFDekIsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxzQkFBc0I7QUFDcEUsTUFBTSxvQkFBb0IsR0FBRyxHQUFHLENBQUMsQ0FBQyxrQ0FBa0M7QUFDcEUsTUFBTSxpQkFBaUIsR0FBRyxFQUFFLENBQUMsQ0FBSSx5Q0FBeUM7QUFDMUUsTUFBTSxpQkFBaUIsR0FBRyxHQUFHLENBQUMsQ0FBRyxvREFBb0Q7QUFDckYsTUFBTSxvQkFBb0IsR0FBRyxFQUFFLENBQUMsQ0FBQyx5Q0FBeUM7QUFFMUU7O0dBRUc7QUFDSCxNQUFhLFdBQVksU0FBUSxxQkFBWTtJQUMzQywyQkFBMkI7SUFDcEIsS0FBSyxHQUFxQixFQUFFLE1BQU0sRUFBRSx5QkFBaUIsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUVwRSxxQkFBcUI7SUFDYixPQUFPLENBQTJCO0lBRTFDLG1DQUFtQztJQUMzQixhQUFhLEdBQXlCLElBQUksR0FBRyxFQUFFLENBQUM7SUFFeEQsNkJBQTZCO0lBQ3JCLGVBQWUsR0FBeUIsSUFBSSxDQUFDO0lBRXJELHFCQUFxQjtJQUNiLGFBQWEsR0FBd0IsSUFBSSxDQUFDO0lB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QUFDO0FBQ2xDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBFdmVudEVtaXR0ZXIgfSBmcm9tICdldmVudHMnO1xyXG5pbXBvcnQgeyBzcGF3biwgQ2hpbGRQcm9jZXNzIH0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XHJcbmltcG9ydCB7IGhydGltZSB9IGZyb20gJ3Byb2Nlc3MnO1xyXG5pbXBvcnQgeyBcclxuICBSb29tLCBcclxuICBMb2NhbEF1ZGlvVHJhY2ssIFxyXG4gIEF1ZGlvU291cmNlLCBcclxuICBUcmFja1B1Ymxpc2hPcHRpb25zLCBcclxuICBUcmFja1NvdXJjZSxcclxuICBBdWRpb0ZyYW1lIFxyXG59IGZyb20gJ0BsaXZla2l0L3J0Yy1ub2RlJztcclxuaW1wb3J0IHsgQXVkaW9QbGF5ZXJTdGF0dXMgfSBmcm9tICcuL2VudW1zJztcclxuaW1wb3J0IHsgQ3JlYXRlQXVkaW9QbGF5ZXJPcHRpb25zLCBBdWRpb1BsYXllclN0YXRlIH0gZnJvbSAnLi90eXBlcyc7XHJcbmltcG9ydCB7IEF1ZGlvUmVzb3VyY2UgfSBmcm9tICcuL0F1ZGlvUmVzb3VyY2UnO1xyXG5pbXBvcnQgeyBWb2ljZUNvbm5lY3Rpb24gfSBmcm9tICcuL1ZvaWNlQ29ubmVjdGlvbic7XHJcblxyXG4vLyBBdWRpbyBzZXR0aW5ncyBmb3IgTGl2ZUtpdCAoNDhrSHogc3RlcmVvKVxyXG5jb25zdCBTQU1QTEVfUkFURSA9IDQ4MDAwO1xyXG5jb25zdCBDSEFOTkVMUyA9IDI7XHJcbmNvbnN0IEZSQU1FX0RVUkFUSU9OX01TID0gMjA7XHJcbmNvbnN0IFNBTVBMRVNfUEVSX0ZSQU1FID0gKFNBTVBMRV9SQVRFICogRlJBTUVfRFVSQVRJT05fTVMpIC8gMTAwMDsgLy8gOTYwXHJcblxyXG4vLyBKaXR0ZXIgYnVmZmVyIHNldHRpbmdzXHJcbmNvbnN0IEZSQU1FX0lOVEVSVkFMX05TID0gQmlnSW50KDIwXzAwMF8wMDApOyAvLyAyMG1zIGluIG5hbm9zZWNvbmRzXHJcbmNvbnN0IFRBUkdFVF9CVUZGRVJfRlJBTUVTID0gMTUwOyAvLyB+MyBzZWNvbmRzIC0gdGFyZ2V0IGJ1ZmZlciBzaXplXHJcbmNvbnN0IE1JTl9CVUZGRVJfRlJBTUVTID0gNzU7ICAgIC8vIH4xLjUgc2Vjb25kcyAtIG1pbmltdW0gYmVmb3JlIHdlIHN0YXJ0XHJcbmNvbnN0IE1BWF9CVUZGRVJfRlJBTUVTID0gNTAwOyAgIC8vIH4xMCBzZWNvbmRzIC0gbWF4IGJ1ZmZlciB0byBwcmV2ZW50IG1lbW9yeSBpc3N1ZXNcclxuY29uc3QgTE9XX0JVRkZFUl9USFJFU0hPTEQgPSA1MDsgLy8gfjEgc2Vjb25kIC0gd2hlbiB0byBzbG93IGRvd24gcGxheWJhY2tcclxuXHJcbi8qKlxyXG4gKiBBdWRpbyBwbGF5ZXIgZm9yIHBsYXlpbmcgYXVkaW8gcmVzb3VyY2VzXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgQXVkaW9QbGF5ZXIgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xyXG4gIC8qKiBDdXJyZW50IHBsYXllciBzdGF0ZSAqL1xyXG4gIHB1YmxpYyBzdGF0ZTogQXVkaW9QbGF5ZXJTdGF0ZSA9IHsgc3RhdHVzOiBBdWRpb1BsYXllclN0YXR1cy5JZGxlIH07XHJcbiAgXHJcbiAgLyoqIFBsYXllciBvcHRpb25zICovXHJcbiAgcHJpdmF0ZSBvcHRpb25zOiBDcmVhdGVBdWRpb1BsYXllck9wdGlvbnM7XHJcbiAgXHJcbiAgLyoqIFN1YnNjcmliZWQgdm9pY2UgY29ubmVjdGlvbnMgKi9cclxuICBwcml2YXRlIHN1YnNjcmlwdGlvbnM6IFNldDxWb2ljZUNvbm5lY3Rpb24+ID0gbmV3IFNldCgpO1xyXG4gIFxyXG4gIC8qKiBDdXJyZW50IGF1ZGlvIHJlc291cmNlICovXHJcbiAgcHJpdmF0ZSBjdXJyZW50UmVzb3VyY2U6IEF1ZGlvUmVzb3VyY2UgfCBudWxsID0gbnVsbDtcclxuICBcclxuICAvKiogRkZtcGVnIHByb2Nlc3MgKi9cclxuICBwcml2YXRlIGZmbXBlZ1Byb2Nlc3M6IENoaWxkUHJvY2VzcyB8IG51bGwgPSBudWxsO1xyXG4gIFxyXG4gIC8qKiBMaXZlS2l0IGF1ZGlvIHNvdXJjZSBhbmQgdHJhY2sgKi9cclxuICBwcml2YXRlIGF1ZGlvU291cmNlOiBBdWRpb1NvdXJjZSB8IG51bGwgPSBudWxsO1xyXG4gIHByaXZhdGUgYXVkaW9UcmFjazogTG9jYWxBdWRpb1RyYWNrIHwgbnVsbCA9IG51bGw7XHJcbiAgXHJcbiAgLyoqIEZyYW1lIHF1ZXVlIGFuZCBwbGF5YmFjayBzdGF0ZSAqL1xyXG4gIHByaXZhdGUgZnJhbWVRdWV1ZTogSW50MTZBcnJheVtdID0gW107XHJcbiAgcHJpdmF0ZSBwbGF5YmFja1RpbWVvdXQ6IE5vZGVKUy5UaW1lb3V0IHwgbnVsbCA9IG51bGw7XHJcbiAgcHJpdmF0ZSBsZWZ0b3ZlckJ1ZmZlcjogQnVmZmVyIHwgbnVsbCA9IG51bGw7XHJcbiAgcHJpdmF0ZSBpc1B1Ymxpc2hlZCA9IGZhbHNlO1xyXG4gIFxyXG4gIC8qKiBIaWdoLXJlc29sdXRpb24gdGltaW5nICovXHJcbiAgcHJpdmF0ZSBuZXh0RnJhbWVUaW1lOiBiaWdpbnQgPSBCaWdJbnQoMCk7XHJcbiAgcHJpdmF0ZSBpc1BsYXliYWNrTG9vcFJ1bm5pbmcgPSBmYWxzZTtcclxuICBwcml2YXRlIGZmbXBlZ0RvbmUgPSBmYWxzZTtcclxuICBcclxuICAvKiogQnVmZmVyIHN0YXRpc3RpY3MgKi9cclxuICBwcml2YXRlIGJ1ZmZlclVuZGVycnVucyA9IDA7XHJcbiAgcHJpdmF0ZSBmcmFtZXNQbGF5ZWQgPSAwO1xyXG5cclxuICBjb25zdHJ1Y3RvcihvcHRpb25zOiBDcmVhdGVBdWRpb1BsYXllck9wdGlvbnMgPSB7fSkge1xyXG4gICAgc3VwZXIoKTtcclxuICAgIHRoaXMub3B0aW9ucyA9IHtcclxuICAgICAgYmVoYXZpb3JzOiB7XHJcbiAgICAgICAgbm9TdWJzY3JpYmVyOiAncGF1c2UnLFxyXG4gICAgICAgIG1heE1pc3NlZEZyYW1lczogNSxcclxuICAgICAgICAuLi5vcHRpb25zLmJlaGF2aW9yc1xyXG4gICAgICB9XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICAvLyBBZGQgZGVmYXVsdCBlcnJvciBoYW5kbGVyIHRvIHByZXZlbnQgY3Jhc2hlc1xyXG4gICAgdGhpcy5vbignZXJyb3InLCAoZXJyb3IpID0+IHtcclxuICAgICAgLy8gRGVmYXVsdCBoYW5kbGVyIC0ganVzdCBsb2cgaWYgbm8gb3RoZXIgbGlzdGVuZXJzXHJcbiAgICAgIGlmICh0aGlzLmxpc3RlbmVyQ291bnQoJ2Vycm9yJykgPT09IDEpIHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKCdbQXVkaW9QbGF5ZXJdIEVycm9yOicsIGVycm9yLm1lc3NhZ2UpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFBsYXkgYW4gYXVkaW8gcmVzb3VyY2VcclxuICAgKi9cclxuICBwbGF5KHJlc291cmNlOiBBdWRpb1Jlc291cmNlKTogdm9pZCB7XHJcbiAgICAvLyBTdG9wIGN1cnJlbnQgcGxheWJhY2tcclxuICAgIHRoaXMuc3RvcCgpO1xyXG4gICAgXHJcbiAgICB0aGlzLmN1cnJlbnRSZXNvdXJjZSA9IHJlc291cmNlO1xyXG4gICAgdGhpcy5zZXRTdGF0ZSh7IHN0YXR1czogQXVkaW9QbGF5ZXJTdGF0dXMuQnVmZmVyaW5nLCByZXNvdXJjZSB9KTtcclxuICAgIFxyXG4gICAgLy8gU3RhcnQgcGxheWJhY2sgaWYgd2UgaGF2ZSBhIHJlYWR5IGNvbm5lY3Rpb25cclxuICAgIGZvciAoY29uc3QgY29ubmVjdGlvbiBvZiB0aGlzLnN1YnNjcmlwdGlvbnMpIHtcclxuICAgICAgaWYgKGNvbm5lY3Rpb24uZ2V0Um9vbSgpKSB7XHJcbiAgICAgICAgdGhpcy5zdGFydFBsYXliYWNrKGNvbm5lY3Rpb24pO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBQYXVzZSBwbGF5YmFja1xyXG4gICAqL1xyXG4gIHBhdXNlKCk6IGJvb2xlYW4ge1xyXG4gICAgaWYgKHRoaXMuc3RhdGUuc3RhdHVzICE9PSBBdWRpb1BsYXllclN0YXR1cy5QbGF5aW5nKSB7XHJcbiAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuICAgIHRoaXMuc2V0U3RhdGUoeyBzdGF0dXM6IEF1ZGlvUGxheWVyU3RhdHVzLlBhdXNlZCwgcmVzb3VyY2U6IHRoaXMuY3VycmVudFJlc291cmNlIH0pO1xyXG4gICAgcmV0dXJuIHRydWU7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBVbnBhdXNlIHBsYXliYWNrXHJcbiAgICovXHJcbiAgdW5wYXVzZSgpOiBib29sZWFuIHtcclxuICAgIGlmICh0aGlzLnN0YXRlLnN0YXR1cyAhPT0gQXVkaW9QbGF5ZXJTdGF0dXMuUGF1c2VkKSB7XHJcbiAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuICAgIHRoaXMuc2V0U3RhdGUoeyBzdGF0dXM6IEF1ZGlvUGxheWVyU3RhdHVzLlBsYXlpbmcsIHJlc291cmNlOiB0aGlzLmN1cnJlbnRSZXNvdXJjZSB9KTtcclxuICAgIHJldHVybiB0cnVlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU3RvcCBwbGF5YmFja1xyXG4gICAqL1xyXG4gIHN0b3AoZm9yY2UgPSBmYWxzZSk6IGJvb2xlYW4ge1xyXG4gICAgaWYgKHRoaXMuc3RhdGUuc3RhdHVzID09PSBBdWRpb1BsYXllclN0YXR1cy5JZGxlICYmICFmb3JjZSkge1xyXG4gICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcbiAgICB0aGlzLmNsZWFudXAoKTtcclxuICAgIHRoaXMuY3VycmVudFJlc291cmNlID0gbnVsbDtcclxuICAgIHRoaXMuc2V0U3RhdGUoeyBzdGF0dXM6IEF1ZGlvUGxheWVyU3RhdHVzLklkbGUgfSk7XHJcbiAgICByZXR1cm4gdHJ1ZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFN1YnNjcmliZSBhIHZvaWNlIGNvbm5lY3Rpb24gdG8gdGhpcyBwbGF5ZXJcclxuICAgKiBAaW50ZXJuYWxcclxuICAgKi9cclxuICBzdWJzY3JpYmUoY29ubmVjdGlvbjogVm9pY2VDb25uZWN0aW9uKTogdm9pZCB7XHJcbiAgICB0aGlzLnN1YnNjcmlwdGlvbnMuYWRkKGNvbm5lY3Rpb24pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVW5zdWJzY3JpYmUgYSB2b2ljZSBjb25uZWN0aW9uIGZyb20gdGhpcyBwbGF5ZXJcclxuICAgKiBAaW50ZXJuYWxcclxuICAgKi9cclxuICB1bnN1YnNjcmliZShjb25uZWN0aW9uOiBWb2ljZUNvbm5lY3Rpb24pOiB2b2lkIHtcclxuICAgIHRoaXMuc3Vic2NyaXB0aW9ucy5kZWxldGUoY29ubmVjdGlvbik7XHJcbiAgICBcclxuICAgIC8vIEF1dG8tcGF1c2UgaWYgbm8gc3Vic2NyaWJlcnNcclxuICAgIGlmICh0aGlzLnN1YnNjcmlwdGlvbnMuc2l6ZSA9PT0gMCAmJiB0aGlzLm9wdGlvbnMuYmVoYXZpb3JzPy5ub1N1YnNjcmliZXIgPT09ICdwYXVzZScpIHtcclxuICAgICAgaWYgKHRoaXMuc3RhdGUuc3RhdHVzID09PSBBdWRpb1BsYXllclN0YXR1cy5QbGF5aW5nKSB7XHJcbiAgICAgICAgdGhpcy5zZXRTdGF0ZSh7IHN0YXR1czogQXVkaW9QbGF5ZXJTdGF0dXMuQXV0b1BhdXNlZCwgcmVzb3VyY2U6IHRoaXMuY3VycmVudFJlc291cmNlIH0pO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDYWxsZWQgd2hlbiBhIGNvbm5lY3Rpb24gYmVjb21lcyByZWFkeVxyXG4gICAqIEBpbnRlcm5hbFxyXG4gICAqL1xyXG4gIG9uQ29ubmVjdGlvblJlYWR5KGNvbm5lY3Rpb246IFZvaWNlQ29ubmVjdGlvbik6IHZvaWQge1xyXG4gICAgLy8gSWYgd2UgaGF2ZSBhIHJlc291cmNlIHdhaXRpbmcsIHN0YXJ0IHBsYXliYWNrXHJcbiAgICBpZiAodGhpcy5jdXJyZW50UmVzb3VyY2UgJiYgdGhpcy5zdGF0ZS5zdGF0dXMgPT09IEF1ZGlvUGxheWVyU3RhdHVzLkJ1ZmZlcmluZykge1xyXG4gICAgICB0aGlzLnN0YXJ0UGxheWJhY2soY29ubmVjdGlvbik7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFzeW5jIHN0YXJ0UGxheWJhY2soY29ubmVjdGlvbjogVm9pY2VDb25uZWN0aW9uKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCByb29tID0gY29ubmVjdGlvbi5nZXRSb29tKCk7XHJcbiAgICBpZiAoIXJvb20gfHwgIXRoaXMuY3VycmVudFJlc291cmNlKSByZXR1cm47XHJcblxyXG4gICAgdHJ5IHtcclxuICAgICAgLy8gQ3JlYXRlIGF1ZGlvIHNvdXJjZSBhbmQgdHJhY2tcclxuICAgICAgYXdhaXQgdGhpcy5zZXR1cEF1ZGlvVHJhY2socm9vbSk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBTdGFydCBGRm1wZWcgdG8gZGVjb2RlIGF1ZGlvIC0gdGhpcyB3aWxsIHNldCBzdGF0ZSB0byBQbGF5aW5nIHdoZW4gcmVhZHlcclxuICAgICAgYXdhaXQgdGhpcy5zdGFydEZGbXBlZygpO1xyXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgLy8gRW1pdCBlcnJvciBidXQgZG9uJ3Qgc3RvcCAtIGxldCB1c2VyIGRlY2lkZSB3aGF0IHRvIGRvXHJcbiAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCB7IG1lc3NhZ2U6IChlcnJvciBhcyBFcnJvcikubWVzc2FnZSwgcmVzb3VyY2U6IHRoaXMuY3VycmVudFJlc291cmNlIH0pO1xyXG4gICAgICAvLyBSZXNldCB0byBpZGxlIHN0YXRlIHdpdGhvdXQgZnVsbCBjbGVhbnVwXHJcbiAgICAgIHRoaXMuc2V0U3RhdGUoeyBzdGF0dXM6IEF1ZGlvUGxheWVyU3RhdHVzLklkbGUgfSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFzeW5jIHNldHVwQXVkaW9UcmFjayhyb29tOiBSb29tKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBpZiAodGhpcy5pc1B1Ymxpc2hlZCkgcmV0dXJuO1xyXG4gICAgXHJcbiAgICB0aGlzLmF1ZGlvU291cmNlID0gbmV3IEF1ZGlvU291cmNlKFNBTVBMRV9SQVRFLCBDSEFOTkVMUyk7XHJcbiAgICB0aGlzLmF1ZGlvVHJhY2sgPSBMb2NhbEF1ZGlvVHJhY2suY3JlYXRlQXVkaW9UcmFjaygnbXVzaWMnLCB0aGlzLmF1ZGlvU291cmNlKTtcclxuICAgIFxyXG4gICAgY29uc3Qgb3B0aW9ucyA9IG5ldyBUcmFja1B1Ymxpc2hPcHRpb25zKCk7XHJcbiAgICBvcHRpb25zLnNvdXJjZSA9IFRyYWNrU291cmNlLlNPVVJDRV9NSUNST1BIT05FO1xyXG4gICAgXHJcbiAgICBpZiAocm9vbS5sb2NhbFBhcnRpY2lwYW50KSB7XHJcbiAgICAgIGF3YWl0IHJvb20ubG9jYWxQYXJ0aWNpcGFudC5wdWJsaXNoVHJhY2sodGhpcy5hdWRpb1RyYWNrLCBvcHRpb25zKTtcclxuICAgIH1cclxuICAgIHRoaXMuaXNQdWJsaXNoZWQgPSB0cnVlO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhc3luYyBzdGFydEZGbXBlZygpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGlmICghdGhpcy5jdXJyZW50UmVzb3VyY2UpIHJldHVybjtcclxuICAgIFxyXG4gICAgbGV0IGlucHV0U291cmNlID0gdGhpcy5jdXJyZW50UmVzb3VyY2UuZ2V0SW5wdXRTb3VyY2UoKTtcclxuICAgIGNvbnNvbGUubG9nKGBGRm1wZWcgaW5wdXQgc291cmNlOiAke2lucHV0U291cmNlLnN1YnN0cmluZygwLCAxMDApfS4uLmApO1xyXG4gICAgXHJcbiAgICAvLyBDaGVjayBpZiBpbnB1dCBpcyBhIFVSTCBvciBzZWFyY2ggcXVlcnlcclxuICAgIGNvbnN0IGlzVXJsID0gaW5wdXRTb3VyY2Uuc3RhcnRzV2l0aCgnaHR0cDovLycpIHx8IFxyXG4gICAgICAgICAgICAgICAgICBpbnB1dFNvdXJjZS5zdGFydHNXaXRoKCdodHRwczovLycpIHx8IFxyXG4gICAgICAgICAgICAgICAgICBpbnB1dFNvdXJjZS5zdGFydHNXaXRoKCd5dHNlYXJjaDonKTtcclxuICAgIFxyXG4gICAgLy8gSWYgbm90IGEgVVJMLCB0cmVhdCBhcyBZb3VUdWJlIHNlYXJjaFxyXG4gICAgaWYgKCFpc1VybCkge1xyXG4gICAgICBpbnB1dFNvdXJjZSA9IGB5dHNlYXJjaDE6JHtpbnB1dFNvdXJjZX1gO1xyXG4gICAgICBjb25zb2xlLmxvZyhgQ29udmVydGVkIHRvIFlvdVR1YmUgc2VhcmNoOiAke2lucHV0U291cmNlfWApO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvLyBDaGVjayBpZiB0aGlzIGlzIGEgc3RyZWFtaW5nIFVSTCB0aGF0IG5lZWRzIHl0LWRscFxyXG4gICAgY29uc3QgbmVlZHNZdERscCA9IGlucHV0U291cmNlLmluY2x1ZGVzKCd5b3V0dWJlLmNvbScpIHx8IFxyXG4gICAgICAgICAgICAgICAgICAgICAgIGlucHV0U291cmNlLmluY2x1ZGVzKCd5b3V0dS5iZScpIHx8XHJcbiAgICAgICAgICAgICAgICAgICAgICAgaW5wdXRTb3VyY2UuaW5jbHVkZXMoJ3NvdW5kY2xvdWQuY29tJykgfHxcclxuICAgICAgICAgICAgICAgICAgICAgICBpbnB1dFNvdXJjZS5pbmNsdWRlcygndHdpdGNoLnR2JykgfHxcclxuICAgICAgICAgICAgICAgICAgICAgICBpbnB1dFNvdXJjZS5zdGFydHNXaXRoKCd5dHNlYXJjaCcpO1xyXG4gICAgXHJcbiAgICBpZiAobmVlZHNZdERscCkge1xyXG4gICAgICAvLyBVc2UgeXQtZGxwIHRvIHBpcGUgYXVkaW8gZGlyZWN0bHkgdG8gRkZtcGVnXHJcbiAgICAgIGNvbnNvbGUubG9nKCdVc2luZyB5dC1kbHAgcGlwZSBtb2RlJyk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBEZXRlY3QgcGxhdGZvcm1cclxuICAgICAgY29uc3QgaXNXaW5kb3dzID0gcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJztcclxuICAgICAgY29uc3QgeXREbHBQYXRoID0gaXNXaW5kb3dzID8gJ3l0LWRscCcgOiAnfi8ubG9jYWwvYmluL3l0LWRscCc7XHJcbiAgICAgIFxyXG4gICAgICAvLyBTRUNVUklUWTogVXNlIGFyZ3MgYXJyYXkgKG5vIHNoZWxsKSB0byBwcmV2ZW50IGNvbW1hbmQgaW5qZWN0aW9uXHJcbiAgICAgIC8vIFVzZXIgaW5wdXQgc2hvdWxkIG5ldmVyIGJlIHBhc3NlZCB0aHJvdWdoIHNoZWxsIGludGVycG9sYXRpb25cclxuICAgICAgY29uc3QgeXRkbHBBcmdzID0gW1xyXG4gICAgICAgICctZicsICdiZXN0YXVkaW8vYmVzdCcsXHJcbiAgICAgICAgJy1vJywgJy0nLFxyXG4gICAgICAgICctLW5vLXBsYXlsaXN0JyxcclxuICAgICAgICAnLS1uby13YXJuaW5ncycsXHJcbiAgICAgICAgJy0tZGVmYXVsdC1zZWFyY2gnLCAneXRzZWFyY2gnLFxyXG4gICAgICAgIGlucHV0U291cmNlXHJcbiAgICAgIF07XHJcbiAgICAgIFxyXG4gICAgICBjb25zdCBmZm1wZWdBcmdzID0gW1xyXG4gICAgICAgICctaScsICdwaXBlOjAnLFxyXG4gICAgICAgICctZicsICdzMTZsZScsXHJcbiAgICAgICAgJy1hcicsIFN0cmluZyhTQU1QTEVfUkFURSksXHJcbiAgICAgICAgJy1hYycsIFN0cmluZyhDSEFOTkVMUyksXHJcbiAgICAgICAgJy1hY29kZWMnLCAncGNtX3MxNmxlJyxcclxuICAgICAgICAnLSdcclxuICAgICAgXTtcclxuICAgICAgXHJcbiAgICAgIGNvbnNvbGUubG9nKCdbQXVkaW9QbGF5ZXJdIHl0LWRscCBhcmdzOicsIHl0ZGxwQXJncy5qb2luKCcgJykpO1xyXG4gICAgICBcclxuICAgICAgLy8gU3Bhd24geXQtZGxwIHdpdGhvdXQgc2hlbGxcclxuICAgICAgY29uc3QgeXRkbHBQcm9jZXNzID0gc3Bhd24oeXREbHBQYXRoLCB5dGRscEFyZ3MsIHsgXHJcbiAgICAgICAgc3RkaW86IFsncGlwZScsICdwaXBlJywgJ3BpcGUnXSxcclxuICAgICAgICBzaGVsbDogZmFsc2VcclxuICAgICAgfSk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBTcGF3biBmZm1wZWcgd2l0aG91dCBzaGVsbFxyXG4gICAgICB0aGlzLmZmbXBlZ1Byb2Nlc3MgPSBzcGF3bignZmZtcGVnJywgZmZtcGVnQXJncywgeyBcclxuICAgICAgICBzdGRpbzogWydwaXBlJywgJ3BpcGUnLCAncGlwZSddLFxyXG4gICAgICAgIHNoZWxsOiBmYWxzZVxyXG4gICAgICB9KTtcclxuICAgICAgXHJcbiAgICAgIC8vIFRyYWNrIGRhdGEgZmxvd1xyXG4gICAgICBsZXQgeXRkbHBEYXRhUmVjZWl2ZWQgPSAwO1xyXG4gICAgICBcclxuICAgICAgeXRkbHBQcm9jZXNzLnN0ZG91dD8ub24oJ2RhdGEnLCAoY2h1bms6IEJ1ZmZlcikgPT4ge1xyXG4gICAgICAgIHl0ZGxwRGF0YVJlY2VpdmVkICs9IGNodW5rLmxlbmd0aDtcclxuICAgICAgICBpZiAoeXRkbHBEYXRhUmVjZWl2ZWQgPCAxMDAwMCB8fCB5dGRscERhdGFSZWNlaXZlZCAlIDEwMDAwMCA8IDEwMDAwKSB7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW3l0LWRscF0gc3Rkb3V0IGRhdGE6ICR7Y2h1bmsubGVuZ3RofSBieXRlcyAodG90YWw6ICR7eXRkbHBEYXRhUmVjZWl2ZWR9KWApO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBQaXBlIHl0LWRscCBzdGRvdXQgdG8gZmZtcGVnIHN0ZGluXHJcbiAgICAgIHl0ZGxwUHJvY2Vzcy5zdGRvdXQ/LnBpcGUodGhpcy5mZm1wZWdQcm9jZXNzLnN0ZGluISk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBIYW5kbGUgeXQtZGxwIHN0ZGVyciAtIGxvZyBldmVyeXRoaW5nIGZvciBkZWJ1Z2dpbmdcclxuICAgICAgeXRkbHBQcm9jZXNzLnN0ZGVycj8ub24oJ2RhdGEnLCAoZGF0YTogQnVmZmVyKSA9PiB7XHJcbiAgICAgICAgY29uc3QgbXNnID0gZGF0YS50b1N0cmluZygpLnRyaW0oKTtcclxuICAgICAgICBpZiAobXNnKSB7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZygnW3l0LWRscF0nLCBtc2cpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICAgIFxyXG4gICAgICB5dGRscFByb2Nlc3Mub24oJ2Vycm9yJywgKGVycikgPT4ge1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1t5dC1kbHBdIHByb2Nlc3MgZXJyb3I6JywgZXJyLm1lc3NhZ2UpO1xyXG4gICAgICB9KTtcclxuICAgICAgXHJcbiAgICAgIHl0ZGxwUHJvY2Vzcy5vbignY2xvc2UnLCAoY29kZSkgPT4ge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGBbeXQtZGxwXSBjbG9zZWQgd2l0aCBjb2RlICR7Y29kZX0sIHRvdGFsIGRhdGE6ICR7eXRkbHBEYXRhUmVjZWl2ZWR9IGJ5dGVzYCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgY29uc29sZS5sb2coJ1VzaW5nIGRpcmVjdCBGRm1wZWcgbW9kZScpO1xyXG4gICAgICB0aGlzLmZmbXBlZ1Byb2Nlc3MgPSBzcGF3bignZmZtcGVnJywgW1xyXG4gICAgICAgICctcmVjb25uZWN0JywgJzEnLFxyXG4gICAgICAgICctcmVjb25uZWN0X3N0cmVhbWVkJywgJzEnLFxyXG4gICAgICAgICctcmVjb25uZWN0X2RlbGF5X21heCcsICc1JyxcclxuICAgICAgICAnLWknLCBpbnB1dFNvdXJjZSxcclxuICAgICAgICAnLWYnLCAnczE2bGUnLFxyXG4gICAgICAgICctYXInLCBTdHJpbmcoU0FNUExFX1JBVEUpLFxyXG4gICAgICAgICctYWMnLCBTdHJpbmcoQ0hBTk5FTFMpLFxyXG4gICAgICAgICctYWNvZGVjJywgJ3BjbV9zMTZsZScsXHJcbiAgICAgICAgJy0nXHJcbiAgICAgIF0sIHsgc3RkaW86IFsncGlwZScsICdwaXBlJywgJ3BpcGUnXSB9KTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBmcmFtZVNpemUgPSBTQU1QTEVTX1BFUl9GUkFNRSAqIENIQU5ORUxTICogMjtcclxuICAgIHRoaXMuZmZtcGVnRG9uZSA9IGZhbHNlO1xyXG4gICAgbGV0IGhhc1JlY2VpdmVkRGF0YSA9IGZhbHNlO1xyXG5cclxuICAgIHRoaXMuZmZtcGVnUHJvY2Vzcy5zdGRvdXQ/Lm9uKCdkYXRhJywgKGNodW5rOiBCdWZmZXIpID0+IHtcclxuICAgICAgaWYgKHRoaXMuc3RhdGUuc3RhdHVzICE9PSBBdWRpb1BsYXllclN0YXR1cy5QbGF5aW5nICYmIFxyXG4gICAgICAgICAgdGhpcy5zdGF0ZS5zdGF0dXMgIT09IEF1ZGlvUGxheWVyU3RhdHVzLkJ1ZmZlcmluZykgcmV0dXJuO1xyXG4gICAgICBcclxuICAgICAgaGFzUmVjZWl2ZWREYXRhID0gdHJ1ZTtcclxuICAgICAgXHJcbiAgICAgIC8vIEhhbmRsZSBsZWZ0b3ZlciBmcm9tIHByZXZpb3VzIGNodW5rXHJcbiAgICAgIGlmICh0aGlzLmxlZnRvdmVyQnVmZmVyICYmIHRoaXMubGVmdG92ZXJCdWZmZXIubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIGNodW5rID0gQnVmZmVyLmNvbmNhdChbdGhpcy5sZWZ0b3ZlckJ1ZmZlciwgY2h1bmtdKTtcclxuICAgICAgICB0aGlzLmxlZnRvdmVyQnVmZmVyID0gbnVsbDtcclxuICAgICAgfVxyXG4gICAgICBcclxuICAgICAgbGV0IG9mZnNldCA9IDA7XHJcbiAgICAgIHdoaWxlIChvZmZzZXQgKyBmcmFtZVNpemUgPD0gY2h1bmsubGVuZ3RoKSB7XHJcbiAgICAgICAgY29uc3QgZnJhbWUgPSBjaHVuay5zbGljZShvZmZzZXQsIG9mZnNldCArIGZyYW1lU2l6ZSk7XHJcbiAgICAgICAgY29uc3QgaW50MTZBcnJheSA9IG5ldyBJbnQxNkFycmF5KFNBTVBMRVNfUEVSX0ZSQU1FICogQ0hBTk5FTFMpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgaW50MTZBcnJheS5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgaW50MTZBcnJheVtpXSA9IGZyYW1lLnJlYWRJbnQxNkxFKGkgKiAyKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgdGhpcy5mcmFtZVF1ZXVlLnB1c2goaW50MTZBcnJheSk7XHJcbiAgICAgICAgb2Zmc2V0ICs9IGZyYW1lU2l6ZTtcclxuICAgICAgfVxyXG4gICAgICBcclxuICAgICAgLy8gU2F2ZSBsZWZ0b3ZlclxyXG4gICAgICBpZiAob2Zmc2V0IDwgY2h1bmsubGVuZ3RoKSB7XHJcbiAgICAgICAgdGhpcy5sZWZ0b3ZlckJ1ZmZlciA9IGNodW5rLnNsaWNlKG9mZnNldCk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIGxldCBzdGRlcnJPdXRwdXQgPSAnJztcclxuICAgIHRoaXMuZmZtcGVnUHJvY2Vzcy5zdGRlcnI/Lm9uKCdkYXRhJywgKGRhdGE6IEJ1ZmZlcikgPT4ge1xyXG4gICAgICBzdGRlcnJPdXRwdXQgKz0gZGF0YS50b1N0cmluZygpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5mZm1wZWdQcm9jZXNzLm9uKCdjbG9zZScsIChjb2RlKSA9PiB7XHJcbiAgICAgIHRoaXMuZmZtcGVnRG9uZSA9IHRydWU7XHJcbiAgICAgIHRoaXMuZmZtcGVnUHJvY2VzcyA9IG51bGw7XHJcbiAgICAgIGlmIChjb2RlICE9PSAwKSB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcihgRkZtcGVnIHN0ZGVycjpcXG4ke3N0ZGVyck91dHB1dH1gKTtcclxuICAgICAgfVxyXG4gICAgICBjb25zb2xlLmxvZyhgW0F1ZGlvUGxheWVyXSBGRm1wZWcgY2xvc2VkIHdpdGggY29kZSAke2NvZGV9LCBoYXNSZWNlaXZlZERhdGE6ICR7aGFzUmVjZWl2ZWREYXRhfSwgcXVldWU6ICR7dGhpcy5mcmFtZVF1ZXVlLmxlbmd0aH1gKTtcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuZmZtcGVnUHJvY2Vzcy5vbignZXJyb3InLCAoZXJyKSA9PiB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZGbXBlZyBwcm9jZXNzIGVycm9yOicsIGVyci5tZXNzYWdlKTtcclxuICAgICAgdGhpcy5lbWl0KCdlcnJvcicsIHsgbWVzc2FnZTogZXJyLm1lc3NhZ2UsIHJlc291cmNlOiB0aGlzLmN1cnJlbnRSZXNvdXJjZSB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFdhaXQgZm9yIGluaXRpYWwgYnVmZmVyIHdpdGggdGltZW91dFxyXG4gICAgY29uc3QgYnVmZmVyVGltZW91dCA9IDEwMDAwOyAvLyAxMCBzZWNvbmRzIGZvciBpbml0aWFsIGJ1ZmZlclxyXG4gICAgY29uc3Qgc3RhcnRUaW1lID0gRGF0ZS5ub3coKTtcclxuICAgIFxyXG4gICAgd2hpbGUgKHRoaXMuZnJhbWVRdWV1ZS5sZW5ndGggPCBNSU5fQlVGRkVSX0ZSQU1FUyAmJiBEYXRlLm5vdygpIC0gc3RhcnRUaW1lIDwgYnVmZmVyVGltZW91dCkge1xyXG4gICAgICBhd2FpdCBuZXcgUHJvbWlzZShyID0+IHNldFRpbWVvdXQociwgMTAwKSk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBDaGVjayBpZiBGRm1wZWcgZmFpbGVkIGVhcmx5XHJcbiAgICAgIGlmICh0aGlzLmZmbXBlZ0RvbmUgJiYgdGhpcy5mcmFtZVF1ZXVlLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignRkZtcGVnIGZhaWxlZCB0byBwcm9kdWNlIGF1ZGlvIGRhdGEnKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICBpZiAodGhpcy5mcmFtZVF1ZXVlLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RpbWVvdXQgd2FpdGluZyBmb3IgYXVkaW8gZGF0YScpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBjb25zb2xlLmxvZyhgW0F1ZGlvUGxheWVyXSBTdGFydGluZyBwbGF5YmFjayB3aXRoICR7dGhpcy5mcmFtZVF1ZXVlLmxlbmd0aH0gZnJhbWVzIGJ1ZmZlcmVkICh0YXJnZXQ6ICR7VEFSR0VUX0JVRkZFUl9GUkFNRVN9KWApO1xyXG5cclxuICAgIC8vIE1hcmsgcmVhZHkgZm9yIHBsYXliYWNrIC0gc2V0U3RhdGUgd2lsbCB0cmlnZ2VyIHRoZSBsb29wXHJcbiAgICB0aGlzLmlzUGxheWJhY2tMb29wUnVubmluZyA9IHRydWU7XHJcbiAgICB0aGlzLm5leHRGcmFtZVRpbWUgPSBocnRpbWUuYmlnaW50KCk7XHJcbiAgICBjb25zb2xlLmxvZyhgW0F1ZGlvUGxheWVyXSBQbGF5YmFjayByZWFkeSwgYXVkaW9Tb3VyY2UgZXhpc3RzOiAkeyEhdGhpcy5hdWRpb1NvdXJjZX1gKTtcclxuICAgIFxyXG4gICAgLy8gU2V0IHN0YXRlIHRvIHBsYXlpbmcgLSB0aGlzIHdpbGwgdHJpZ2dlciBzY2hlZHVsZU5leHRGcmFtZSB2aWEgc2V0U3RhdGVcclxuICAgIHRoaXMuc2V0U3RhdGUoeyBzdGF0dXM6IEF1ZGlvUGxheWVyU3RhdHVzLlBsYXlpbmcsIHJlc291cmNlOiB0aGlzLmN1cnJlbnRSZXNvdXJjZSB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhpZ2gtcmVzb2x1dGlvbiBmcmFtZSBzY2hlZHVsaW5nIHVzaW5nIGhydGltZVxyXG4gICAqIFRoaXMgcHJvdmlkZXMgbXVjaCBtb3JlIGFjY3VyYXRlIHRpbWluZyB0aGFuIHNldEludGVydmFsXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBzY2hlZHVsZU5leHRGcmFtZSgpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5pc1BsYXliYWNrTG9vcFJ1bm5pbmcgfHwgdGhpcy5zdGF0ZS5zdGF0dXMgIT09IEF1ZGlvUGxheWVyU3RhdHVzLlBsYXlpbmcpIHtcclxuICAgICAgY29uc29sZS5sb2coYFtBdWRpb1BsYXllcl0gc2NoZWR1bGVOZXh0RnJhbWUgc2tpcHBlZDogbG9vcFJ1bm5pbmc9JHt0aGlzLmlzUGxheWJhY2tMb29wUnVubmluZ30sIHN0YXR1cz0ke3RoaXMuc3RhdGUuc3RhdHVzfWApO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3Qgbm93ID0gaHJ0aW1lLmJpZ2ludCgpO1xyXG4gICAgY29uc3QgZGVsYXlOcyA9IHRoaXMubmV4dEZyYW1lVGltZSAtIG5vdztcclxuICAgIGNvbnN0IGRlbGF5TXMgPSBOdW1iZXIoZGVsYXlOcykgLyAxXzAwMF8wMDA7XHJcblxyXG4gICAgaWYgKHRoaXMuZnJhbWVzUGxheWVkID09PSAwKSB7XHJcbiAgICAgIGNvbnNvbGUubG9nKGBbQXVkaW9QbGF5ZXJdIEZpcnN0IGZyYW1lIHNjaGVkdWxpbmc6IGRlbGF5TXM9JHtkZWxheU1zLnRvRml4ZWQoMil9YCk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gU2NoZWR1bGUgbmV4dCBmcmFtZVxyXG4gICAgaWYgKGRlbGF5TXMgPiAxKSB7XHJcbiAgICAgIHRoaXMucGxheWJhY2tUaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB0aGlzLnByb2Nlc3NGcmFtZSgpLCBNYXRoLm1heCgxLCBkZWxheU1zIC0gMSkpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgLy8gV2UncmUgYmVoaW5kLCBwcm9jZXNzIGltbWVkaWF0ZWx5XHJcbiAgICAgIHNldEltbWVkaWF0ZSgoKSA9PiB0aGlzLnByb2Nlc3NGcmFtZSgpKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFByb2Nlc3MgYW5kIHNlbmQgYSBzaW5nbGUgYXVkaW8gZnJhbWVcclxuICAgKi9cclxuICBwcml2YXRlIGFzeW5jIHByb2Nlc3NGcmFtZSgpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGlmICghdGhpcy5pc1BsYXliYWNrTG9vcFJ1bm5pbmcgfHwgdGhpcy5zdGF0ZS5zdGF0dXMgIT09IEF1ZGlvUGxheWVyU3RhdHVzLlBsYXlpbmcpIHtcclxuICAgICAgaWYgKHRoaXMuZnJhbWVzUGxheWVkID09PSAwKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coYFtBdWRpb1BsYXllcl0gcHJvY2Vzc0ZyYW1lIHNraXBwZWQ6IGxvb3BSdW5uaW5nPSR7dGhpcy5pc1BsYXliYWNrTG9vcFJ1bm5pbmd9LCBzdGF0dXM9JHt0aGlzLnN0YXRlLnN0YXR1c31gKTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgLy8gQ2hlY2sgYnVmZmVyIHN0YXR1c1xyXG4gICAgY29uc3QgYnVmZmVyU2l6ZSA9IHRoaXMuZnJhbWVRdWV1ZS5sZW5ndGg7XHJcbiAgICBcclxuICAgIGlmIChidWZmZXJTaXplID4gMCAmJiB0aGlzLmF1ZGlvU291cmNlKSB7XHJcbiAgICAgIGNvbnN0IGludDE2QXJyYXkgPSB0aGlzLmZyYW1lUXVldWUuc2hpZnQoKSE7XHJcbiAgICAgIGNvbnN0IGF1ZGlvRnJhbWUgPSBuZXcgQXVkaW9GcmFtZShpbnQxNkFycmF5LCBTQU1QTEVfUkFURSwgQ0hBTk5FTFMsIFNBTVBMRVNfUEVSX0ZSQU1FKTtcclxuICAgICAgXHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgYXdhaXQgdGhpcy5hdWRpb1NvdXJjZS5jYXB0dXJlRnJhbWUoYXVkaW9GcmFtZSk7XHJcbiAgICAgICAgdGhpcy5mcmFtZXNQbGF5ZWQrKztcclxuICAgICAgICBcclxuICAgICAgICAvLyBMb2cgcHJvZ3Jlc3MgZXZlcnkgNTAwIGZyYW1lcyAofjEwIHNlY29uZHMpXHJcbiAgICAgICAgaWYgKHRoaXMuZnJhbWVzUGxheWVkICUgNTAwID09PSAwKSB7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW0F1ZGlvUGxheWVyXSBQcm9ncmVzczogJHt0aGlzLmZyYW1lc1BsYXllZH0gZnJhbWVzIHBsYXllZCwgYnVmZmVyOiAke2J1ZmZlclNpemV9YCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcihgW0F1ZGlvUGxheWVyXSBGcmFtZSBlcnJvcjpgLCAoZSBhcyBFcnJvcikubWVzc2FnZSk7XHJcbiAgICAgIH1cclxuICAgICAgXHJcbiAgICAgIC8vIFVwZGF0ZSB0aW1pbmcgZm9yIG5leHQgZnJhbWVcclxuICAgICAgdGhpcy5uZXh0RnJhbWVUaW1lICs9IEZSQU1FX0lOVEVSVkFMX05TO1xyXG4gICAgICBcclxuICAgICAgLy8gQWRhcHRpdmUgdGltaW5nOiBpZiBidWZmZXIgaXMgbG93LCBzbG93IGRvd24gc2xpZ2h0bHkgdG8gbGV0IGl0IHJlY292ZXJcclxuICAgICAgaWYgKGJ1ZmZlclNpemUgPCBMT1dfQlVGRkVSX1RIUkVTSE9MRCAmJiAhdGhpcy5mZm1wZWdEb25lKSB7XHJcbiAgICAgICAgLy8gQWRkIDFtcyBkZWxheSB0byBsZXQgYnVmZmVyIHJlY292ZXJcclxuICAgICAgICB0aGlzLm5leHRGcmFtZVRpbWUgKz0gQmlnSW50KDFfMDAwXzAwMCk7XHJcbiAgICAgICAgdGhpcy5idWZmZXJVbmRlcnJ1bnMrKztcclxuICAgICAgICBcclxuICAgICAgICBpZiAodGhpcy5idWZmZXJVbmRlcnJ1bnMgJSA1MCA9PT0gMCkge1xyXG4gICAgICAgICAgY29uc29sZS5sb2coYFtBdWRpb1BsYXllcl0gQnVmZmVyIGxvdzogJHtidWZmZXJTaXplfSBmcmFtZXMsICR7dGhpcy5idWZmZXJVbmRlcnJ1bnN9IHVuZGVycnVuc2ApO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICBcclxuICAgICAgLy8gU2NoZWR1bGUgbmV4dCBmcmFtZVxyXG4gICAgICB0aGlzLnNjaGVkdWxlTmV4dEZyYW1lKCk7XHJcbiAgICAgIFxyXG4gICAgfSBlbHNlIGlmICh0aGlzLmZmbXBlZ0RvbmUgJiYgYnVmZmVyU2l6ZSA9PT0gMCkge1xyXG4gICAgICAvLyBQbGF5YmFjayBmaW5pc2hlZFxyXG4gICAgICBjb25zb2xlLmxvZygnW0F1ZGlvUGxheWVyXSBQbGF5YmFjayBmaW5pc2hlZCAtIHF1ZXVlIGVtcHR5IGFuZCBGRm1wZWcgZG9uZScpO1xyXG4gICAgICB0aGlzLnN0b3AoKTtcclxuICAgIH0gZWxzZSBpZiAoYnVmZmVyU2l6ZSA9PT0gMCkge1xyXG4gICAgICAvLyBCdWZmZXIgdW5kZXJydW4gLSB3YWl0IGZvciBtb3JlIGRhdGFcclxuICAgICAgdGhpcy5idWZmZXJVbmRlcnJ1bnMrKztcclxuICAgICAgY29uc29sZS5sb2coYFtBdWRpb1BsYXllcl0gQnVmZmVyIHVuZGVycnVuICMke3RoaXMuYnVmZmVyVW5kZXJydW5zfSwgd2FpdGluZyBmb3IgZGF0YS4uLmApO1xyXG4gICAgICBcclxuICAgICAgLy8gV2FpdCBhIGJpdCBhbmQgdHJ5IGFnYWluXHJcbiAgICAgIHRoaXMubmV4dEZyYW1lVGltZSA9IGhydGltZS5iaWdpbnQoKSArIEJpZ0ludCg1MF8wMDBfMDAwKTsgLy8gNTBtc1xyXG4gICAgICB0aGlzLnNjaGVkdWxlTmV4dEZyYW1lKCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGNsZWFudXAoKTogdm9pZCB7XHJcbiAgICAvLyBTdG9wIHBsYXliYWNrIGxvb3BcclxuICAgIHRoaXMuaXNQbGF5YmFja0xvb3BSdW5uaW5nID0gZmFsc2U7XHJcbiAgICBpZiAodGhpcy5wbGF5YmFja1RpbWVvdXQpIHtcclxuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMucGxheWJhY2tUaW1lb3V0KTtcclxuICAgICAgdGhpcy5wbGF5YmFja1RpbWVvdXQgPSBudWxsO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvLyBLaWxsIEZGbXBlZ1xyXG4gICAgaWYgKHRoaXMuZmZtcGVnUHJvY2Vzcykge1xyXG4gICAgICB0aGlzLmZmbXBlZ1Byb2Nlc3Mua2lsbCgnU0lHS0lMTCcpO1xyXG4gICAgICB0aGlzLmZmbXBlZ1Byb2Nlc3MgPSBudWxsO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvLyBDbGVhciBmcmFtZSBxdWV1ZVxyXG4gICAgdGhpcy5mcmFtZVF1ZXVlID0gW107XHJcbiAgICB0aGlzLmxlZnRvdmVyQnVmZmVyID0gbnVsbDtcclxuICAgIFxyXG4gICAgLy8gUmVzZXQgdGltaW5nIGFuZCBzdGF0ZVxyXG4gICAgdGhpcy5uZXh0RnJhbWVUaW1lID0gQmlnSW50KDApO1xyXG4gICAgdGhpcy5mZm1wZWdEb25lID0gZmFsc2U7XHJcbiAgICBcclxuICAgIC8vIExvZyBzdGF0c1xyXG4gICAgaWYgKHRoaXMuZnJhbWVzUGxheWVkID4gMCkge1xyXG4gICAgICBjb25zb2xlLmxvZyhgW0F1ZGlvUGxheWVyXSBQbGF5YmFjayBzdGF0czogJHt0aGlzLmZyYW1lc1BsYXllZH0gZnJhbWVzLCAke3RoaXMuYnVmZmVyVW5kZXJydW5zfSB1bmRlcnJ1bnNgKTtcclxuICAgIH1cclxuICAgIHRoaXMuYnVmZmVyVW5kZXJydW5zID0gMDtcclxuICAgIHRoaXMuZnJhbWVzUGxheWVkID0gMDtcclxuICAgIFxyXG4gICAgLy8gTm90ZTogV2UgZG9uJ3QgdW5wdWJsaXNoIHRoZSB0cmFjayAtIGl0IHN0YXlzIHB1Ymxpc2hlZCBmb3IgbmV4dCBwbGF5XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHNldFN0YXRlKG5ld1N0YXRlOiBBdWRpb1BsYXllclN0YXRlKTogdm9pZCB7XHJcbiAgICBjb25zdCBvbGRTdGF0ZSA9IHRoaXMuc3RhdGU7XHJcbiAgICB0aGlzLnN0YXRlID0gbmV3U3RhdGU7XHJcbiAgICB0aGlzLmVtaXQoJ3N0YXRlQ2hhbmdlJywgb2xkU3RhdGUsIG5ld1N0YXRlKTtcclxuICAgIFxyXG4gICAgLy8gU3RhcnQgcGxheWJhY2sgbG9vcCB3aGVuIHRyYW5zaXRpb25pbmcgdG8gUGxheWluZ1xyXG4gICAgaWYgKG5ld1N0YXRlLnN0YXR1cyA9PT0gQXVkaW9QbGF5ZXJTdGF0dXMuUGxheWluZyAmJiBvbGRTdGF0ZS5zdGF0dXMgIT09IEF1ZGlvUGxheWVyU3RhdHVzLlBsYXlpbmcpIHtcclxuICAgICAgY29uc29sZS5sb2coYFtBdWRpb1BsYXllcl0gU3RhdGUgY2hhbmdlZCB0byBQbGF5aW5nLCBzdGFydGluZyBwbGF5YmFjayBsb29wYCk7XHJcbiAgICAgIHRoaXMuc2NoZWR1bGVOZXh0RnJhbWUoKTtcclxuICAgIH1cclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDcmVhdGUgYW4gYXVkaW8gcGxheWVyXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQXVkaW9QbGF5ZXIob3B0aW9ucz86IENyZWF0ZUF1ZGlvUGxheWVyT3B0aW9ucyk6IEF1ZGlvUGxheWVyIHtcclxuICByZXR1cm4gbmV3IEF1ZGlvUGxheWVyKG9wdGlvbnMpO1xyXG59XHJcbiJdfQ==