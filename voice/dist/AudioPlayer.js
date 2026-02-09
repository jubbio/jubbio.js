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
            // On Windows with shell mode, we need to use a single command string
            // to preserve spaces in the search query
            if (isWindows) {
                // Build command as single string with proper quoting
                const ytdlpCmd = `${ytDlpPath} -f bestaudio/best -o - --no-playlist --no-warnings --default-search ytsearch "${inputSource}"`;
                const ffmpegCmd = `ffmpeg -i pipe:0 -f s16le -ar ${SAMPLE_RATE} -ac ${CHANNELS} -acodec pcm_s16le -`;
                console.log('[AudioPlayer] yt-dlp command:', ytdlpCmd);
                // Spawn yt-dlp with shell command
                const ytdlpProcess = (0, child_process_1.spawn)(ytdlpCmd, [], {
                    stdio: ['pipe', 'pipe', 'pipe'],
                    shell: true
                });
                // Spawn ffmpeg with shell command
                this.ffmpegProcess = (0, child_process_1.spawn)(ffmpegCmd, [], {
                    stdio: ['pipe', 'pipe', 'pipe'],
                    shell: true
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
                    if (code !== 0) {
                        console.error(`yt-dlp exited with code ${code}`);
                    }
                });
            }
            else {
                // Unix: use args array (no shell needed)
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
                // Spawn yt-dlp
                const ytdlpProcess = (0, child_process_1.spawn)(ytDlpPath, ytdlpArgs, {
                    stdio: ['pipe', 'pipe', 'pipe'],
                    shell: false
                });
                // Spawn ffmpeg
                this.ffmpegProcess = (0, child_process_1.spawn)('ffmpeg', ffmpegArgs, {
                    stdio: ['pipe', 'pipe', 'pipe'],
                    shell: false
                });
                // Pipe yt-dlp stdout to ffmpeg stdin
                ytdlpProcess.stdout?.pipe(this.ffmpegProcess.stdin);
                // Handle yt-dlp errors
                ytdlpProcess.stderr?.on('data', (data) => {
                    const msg = data.toString();
                    if (msg.includes('ERROR')) {
                        console.error('yt-dlp error:', msg);
                    }
                });
                ytdlpProcess.on('error', (err) => {
                    console.error('yt-dlp process error:', err.message);
                });
                ytdlpProcess.on('close', (code) => {
                    if (code !== 0) {
                        console.error(`yt-dlp exited with code ${code}`);
                    }
                });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQXVkaW9QbGF5ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvQXVkaW9QbGF5ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBdWpCQSw4Q0FFQztBQXpqQkQsbUNBQXNDO0FBQ3RDLGlEQUFvRDtBQUNwRCxxQ0FBaUM7QUFDakMsZ0RBTzJCO0FBQzNCLG1DQUE0QztBQUs1Qyw0Q0FBNEM7QUFDNUMsTUFBTSxXQUFXLEdBQUcsS0FBSyxDQUFDO0FBQzFCLE1BQU0sUUFBUSxHQUFHLENBQUMsQ0FBQztBQUNuQixNQUFNLGlCQUFpQixHQUFHLEVBQUUsQ0FBQztBQUM3QixNQUFNLGlCQUFpQixHQUFHLENBQUMsV0FBVyxHQUFHLGlCQUFpQixDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsTUFBTTtBQUUxRSx5QkFBeUI7QUFDekIsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxzQkFBc0I7QUFDcEUsTUFBTSxvQkFBb0IsR0FBRyxHQUFHLENBQUMsQ0FBQyxrQ0FBa0M7QUFDcEUsTUFBTSxpQkFBaUIsR0FBRyxFQUFFLENBQUMsQ0FBSSx5Q0FBeUM7QUFDMUUsTUFBTSxpQkFBaUIsR0FBRyxHQUFHLENBQUMsQ0FBRyxvREFBb0Q7QUFDckYsTUFBTSxvQkFBb0IsR0FBRyxFQUFFLENBQUMsQ0FBQyx5Q0FBeUM7QUFFMUU7O0dBRUc7QUFDSCxNQUFhLFdBQVksU0FBUSxxQkFBWTtJQUMzQywyQkFBMkI7SUFDcEIsS0FBSyxHQUFxQixFQUFFLE1BQU0sRUFBRSx5QkFBaUIsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUVwRSxxQkFBcUI7SUFDYixPQUFPLENBQTJCO0lBRTFDLG1DQUFtQztJQUMzQixhQUFhLEdBQXlCLElBQUksR0FBRyxFQUFFLENBQUM7SUFFeEQsNkJBQTZCO0lBQ3JCLGVBQWUsR0FBeUIsSUFBSSxDQUFDO0lBRXJELHFCQUFxQjtJQUNiLGFBQWEsR0FBd0IsSUFBSSxDQUFDO0lB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LCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBFdmVudEVtaXR0ZXIgfSBmcm9tICdldmVudHMnO1xyXG5pbXBvcnQgeyBzcGF3biwgQ2hpbGRQcm9jZXNzIH0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XHJcbmltcG9ydCB7IGhydGltZSB9IGZyb20gJ3Byb2Nlc3MnO1xyXG5pbXBvcnQgeyBcclxuICBSb29tLCBcclxuICBMb2NhbEF1ZGlvVHJhY2ssIFxyXG4gIEF1ZGlvU291cmNlLCBcclxuICBUcmFja1B1Ymxpc2hPcHRpb25zLCBcclxuICBUcmFja1NvdXJjZSxcclxuICBBdWRpb0ZyYW1lIFxyXG59IGZyb20gJ0BsaXZla2l0L3J0Yy1ub2RlJztcclxuaW1wb3J0IHsgQXVkaW9QbGF5ZXJTdGF0dXMgfSBmcm9tICcuL2VudW1zJztcclxuaW1wb3J0IHsgQ3JlYXRlQXVkaW9QbGF5ZXJPcHRpb25zLCBBdWRpb1BsYXllclN0YXRlIH0gZnJvbSAnLi90eXBlcyc7XHJcbmltcG9ydCB7IEF1ZGlvUmVzb3VyY2UgfSBmcm9tICcuL0F1ZGlvUmVzb3VyY2UnO1xyXG5pbXBvcnQgeyBWb2ljZUNvbm5lY3Rpb24gfSBmcm9tICcuL1ZvaWNlQ29ubmVjdGlvbic7XHJcblxyXG4vLyBBdWRpbyBzZXR0aW5ncyBmb3IgTGl2ZUtpdCAoNDhrSHogc3RlcmVvKVxyXG5jb25zdCBTQU1QTEVfUkFURSA9IDQ4MDAwO1xyXG5jb25zdCBDSEFOTkVMUyA9IDI7XHJcbmNvbnN0IEZSQU1FX0RVUkFUSU9OX01TID0gMjA7XHJcbmNvbnN0IFNBTVBMRVNfUEVSX0ZSQU1FID0gKFNBTVBMRV9SQVRFICogRlJBTUVfRFVSQVRJT05fTVMpIC8gMTAwMDsgLy8gOTYwXHJcblxyXG4vLyBKaXR0ZXIgYnVmZmVyIHNldHRpbmdzXHJcbmNvbnN0IEZSQU1FX0lOVEVSVkFMX05TID0gQmlnSW50KDIwXzAwMF8wMDApOyAvLyAyMG1zIGluIG5hbm9zZWNvbmRzXHJcbmNvbnN0IFRBUkdFVF9CVUZGRVJfRlJBTUVTID0gMTUwOyAvLyB+MyBzZWNvbmRzIC0gdGFyZ2V0IGJ1ZmZlciBzaXplXHJcbmNvbnN0IE1JTl9CVUZGRVJfRlJBTUVTID0gNzU7ICAgIC8vIH4xLjUgc2Vjb25kcyAtIG1pbmltdW0gYmVmb3JlIHdlIHN0YXJ0XHJcbmNvbnN0IE1BWF9CVUZGRVJfRlJBTUVTID0gNTAwOyAgIC8vIH4xMCBzZWNvbmRzIC0gbWF4IGJ1ZmZlciB0byBwcmV2ZW50IG1lbW9yeSBpc3N1ZXNcclxuY29uc3QgTE9XX0JVRkZFUl9USFJFU0hPTEQgPSA1MDsgLy8gfjEgc2Vjb25kIC0gd2hlbiB0byBzbG93IGRvd24gcGxheWJhY2tcclxuXHJcbi8qKlxyXG4gKiBBdWRpbyBwbGF5ZXIgZm9yIHBsYXlpbmcgYXVkaW8gcmVzb3VyY2VzXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgQXVkaW9QbGF5ZXIgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xyXG4gIC8qKiBDdXJyZW50IHBsYXllciBzdGF0ZSAqL1xyXG4gIHB1YmxpYyBzdGF0ZTogQXVkaW9QbGF5ZXJTdGF0ZSA9IHsgc3RhdHVzOiBBdWRpb1BsYXllclN0YXR1cy5JZGxlIH07XHJcbiAgXHJcbiAgLyoqIFBsYXllciBvcHRpb25zICovXHJcbiAgcHJpdmF0ZSBvcHRpb25zOiBDcmVhdGVBdWRpb1BsYXllck9wdGlvbnM7XHJcbiAgXHJcbiAgLyoqIFN1YnNjcmliZWQgdm9pY2UgY29ubmVjdGlvbnMgKi9cclxuICBwcml2YXRlIHN1YnNjcmlwdGlvbnM6IFNldDxWb2ljZUNvbm5lY3Rpb24+ID0gbmV3IFNldCgpO1xyXG4gIFxyXG4gIC8qKiBDdXJyZW50IGF1ZGlvIHJlc291cmNlICovXHJcbiAgcHJpdmF0ZSBjdXJyZW50UmVzb3VyY2U6IEF1ZGlvUmVzb3VyY2UgfCBudWxsID0gbnVsbDtcclxuICBcclxuICAvKiogRkZtcGVnIHByb2Nlc3MgKi9cclxuICBwcml2YXRlIGZmbXBlZ1Byb2Nlc3M6IENoaWxkUHJvY2VzcyB8IG51bGwgPSBudWxsO1xyXG4gIFxyXG4gIC8qKiBMaXZlS2l0IGF1ZGlvIHNvdXJjZSBhbmQgdHJhY2sgKi9cclxuICBwcml2YXRlIGF1ZGlvU291cmNlOiBBdWRpb1NvdXJjZSB8IG51bGwgPSBudWxsO1xyXG4gIHByaXZhdGUgYXVkaW9UcmFjazogTG9jYWxBdWRpb1RyYWNrIHwgbnVsbCA9IG51bGw7XHJcbiAgXHJcbiAgLyoqIEZyYW1lIHF1ZXVlIGFuZCBwbGF5YmFjayBzdGF0ZSAqL1xyXG4gIHByaXZhdGUgZnJhbWVRdWV1ZTogSW50MTZBcnJheVtdID0gW107XHJcbiAgcHJpdmF0ZSBwbGF5YmFja1RpbWVvdXQ6IE5vZGVKUy5UaW1lb3V0IHwgbnVsbCA9IG51bGw7XHJcbiAgcHJpdmF0ZSBsZWZ0b3ZlckJ1ZmZlcjogQnVmZmVyIHwgbnVsbCA9IG51bGw7XHJcbiAgcHJpdmF0ZSBpc1B1Ymxpc2hlZCA9IGZhbHNlO1xyXG4gIFxyXG4gIC8qKiBIaWdoLXJlc29sdXRpb24gdGltaW5nICovXHJcbiAgcHJpdmF0ZSBuZXh0RnJhbWVUaW1lOiBiaWdpbnQgPSBCaWdJbnQoMCk7XHJcbiAgcHJpdmF0ZSBpc1BsYXliYWNrTG9vcFJ1bm5pbmcgPSBmYWxzZTtcclxuICBwcml2YXRlIGZmbXBlZ0RvbmUgPSBmYWxzZTtcclxuICBcclxuICAvKiogQnVmZmVyIHN0YXRpc3RpY3MgKi9cclxuICBwcml2YXRlIGJ1ZmZlclVuZGVycnVucyA9IDA7XHJcbiAgcHJpdmF0ZSBmcmFtZXNQbGF5ZWQgPSAwO1xyXG5cclxuICBjb25zdHJ1Y3RvcihvcHRpb25zOiBDcmVhdGVBdWRpb1BsYXllck9wdGlvbnMgPSB7fSkge1xyXG4gICAgc3VwZXIoKTtcclxuICAgIHRoaXMub3B0aW9ucyA9IHtcclxuICAgICAgYmVoYXZpb3JzOiB7XHJcbiAgICAgICAgbm9TdWJzY3JpYmVyOiAncGF1c2UnLFxyXG4gICAgICAgIG1heE1pc3NlZEZyYW1lczogNSxcclxuICAgICAgICAuLi5vcHRpb25zLmJlaGF2aW9yc1xyXG4gICAgICB9XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICAvLyBBZGQgZGVmYXVsdCBlcnJvciBoYW5kbGVyIHRvIHByZXZlbnQgY3Jhc2hlc1xyXG4gICAgdGhpcy5vbignZXJyb3InLCAoZXJyb3IpID0+IHtcclxuICAgICAgLy8gRGVmYXVsdCBoYW5kbGVyIC0ganVzdCBsb2cgaWYgbm8gb3RoZXIgbGlzdGVuZXJzXHJcbiAgICAgIGlmICh0aGlzLmxpc3RlbmVyQ291bnQoJ2Vycm9yJykgPT09IDEpIHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKCdbQXVkaW9QbGF5ZXJdIEVycm9yOicsIGVycm9yLm1lc3NhZ2UpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFBsYXkgYW4gYXVkaW8gcmVzb3VyY2VcclxuICAgKi9cclxuICBwbGF5KHJlc291cmNlOiBBdWRpb1Jlc291cmNlKTogdm9pZCB7XHJcbiAgICAvLyBTdG9wIGN1cnJlbnQgcGxheWJhY2tcclxuICAgIHRoaXMuc3RvcCgpO1xyXG4gICAgXHJcbiAgICB0aGlzLmN1cnJlbnRSZXNvdXJjZSA9IHJlc291cmNlO1xyXG4gICAgdGhpcy5zZXRTdGF0ZSh7IHN0YXR1czogQXVkaW9QbGF5ZXJTdGF0dXMuQnVmZmVyaW5nLCByZXNvdXJjZSB9KTtcclxuICAgIFxyXG4gICAgLy8gU3RhcnQgcGxheWJhY2sgaWYgd2UgaGF2ZSBhIHJlYWR5IGNvbm5lY3Rpb25cclxuICAgIGZvciAoY29uc3QgY29ubmVjdGlvbiBvZiB0aGlzLnN1YnNjcmlwdGlvbnMpIHtcclxuICAgICAgaWYgKGNvbm5lY3Rpb24uZ2V0Um9vbSgpKSB7XHJcbiAgICAgICAgdGhpcy5zdGFydFBsYXliYWNrKGNvbm5lY3Rpb24pO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBQYXVzZSBwbGF5YmFja1xyXG4gICAqL1xyXG4gIHBhdXNlKCk6IGJvb2xlYW4ge1xyXG4gICAgaWYgKHRoaXMuc3RhdGUuc3RhdHVzICE9PSBBdWRpb1BsYXllclN0YXR1cy5QbGF5aW5nKSB7XHJcbiAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuICAgIHRoaXMuc2V0U3RhdGUoeyBzdGF0dXM6IEF1ZGlvUGxheWVyU3RhdHVzLlBhdXNlZCwgcmVzb3VyY2U6IHRoaXMuY3VycmVudFJlc291cmNlIH0pO1xyXG4gICAgcmV0dXJuIHRydWU7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBVbnBhdXNlIHBsYXliYWNrXHJcbiAgICovXHJcbiAgdW5wYXVzZSgpOiBib29sZWFuIHtcclxuICAgIGlmICh0aGlzLnN0YXRlLnN0YXR1cyAhPT0gQXVkaW9QbGF5ZXJTdGF0dXMuUGF1c2VkKSB7XHJcbiAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuICAgIHRoaXMuc2V0U3RhdGUoeyBzdGF0dXM6IEF1ZGlvUGxheWVyU3RhdHVzLlBsYXlpbmcsIHJlc291cmNlOiB0aGlzLmN1cnJlbnRSZXNvdXJjZSB9KTtcclxuICAgIHJldHVybiB0cnVlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU3RvcCBwbGF5YmFja1xyXG4gICAqL1xyXG4gIHN0b3AoZm9yY2UgPSBmYWxzZSk6IGJvb2xlYW4ge1xyXG4gICAgaWYgKHRoaXMuc3RhdGUuc3RhdHVzID09PSBBdWRpb1BsYXllclN0YXR1cy5JZGxlICYmICFmb3JjZSkge1xyXG4gICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcbiAgICB0aGlzLmNsZWFudXAoKTtcclxuICAgIHRoaXMuY3VycmVudFJlc291cmNlID0gbnVsbDtcclxuICAgIHRoaXMuc2V0U3RhdGUoeyBzdGF0dXM6IEF1ZGlvUGxheWVyU3RhdHVzLklkbGUgfSk7XHJcbiAgICByZXR1cm4gdHJ1ZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFN1YnNjcmliZSBhIHZvaWNlIGNvbm5lY3Rpb24gdG8gdGhpcyBwbGF5ZXJcclxuICAgKiBAaW50ZXJuYWxcclxuICAgKi9cclxuICBzdWJzY3JpYmUoY29ubmVjdGlvbjogVm9pY2VDb25uZWN0aW9uKTogdm9pZCB7XHJcbiAgICB0aGlzLnN1YnNjcmlwdGlvbnMuYWRkKGNvbm5lY3Rpb24pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVW5zdWJzY3JpYmUgYSB2b2ljZSBjb25uZWN0aW9uIGZyb20gdGhpcyBwbGF5ZXJcclxuICAgKiBAaW50ZXJuYWxcclxuICAgKi9cclxuICB1bnN1YnNjcmliZShjb25uZWN0aW9uOiBWb2ljZUNvbm5lY3Rpb24pOiB2b2lkIHtcclxuICAgIHRoaXMuc3Vic2NyaXB0aW9ucy5kZWxldGUoY29ubmVjdGlvbik7XHJcbiAgICBcclxuICAgIC8vIEF1dG8tcGF1c2UgaWYgbm8gc3Vic2NyaWJlcnNcclxuICAgIGlmICh0aGlzLnN1YnNjcmlwdGlvbnMuc2l6ZSA9PT0gMCAmJiB0aGlzLm9wdGlvbnMuYmVoYXZpb3JzPy5ub1N1YnNjcmliZXIgPT09ICdwYXVzZScpIHtcclxuICAgICAgaWYgKHRoaXMuc3RhdGUuc3RhdHVzID09PSBBdWRpb1BsYXllclN0YXR1cy5QbGF5aW5nKSB7XHJcbiAgICAgICAgdGhpcy5zZXRTdGF0ZSh7IHN0YXR1czogQXVkaW9QbGF5ZXJTdGF0dXMuQXV0b1BhdXNlZCwgcmVzb3VyY2U6IHRoaXMuY3VycmVudFJlc291cmNlIH0pO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDYWxsZWQgd2hlbiBhIGNvbm5lY3Rpb24gYmVjb21lcyByZWFkeVxyXG4gICAqIEBpbnRlcm5hbFxyXG4gICAqL1xyXG4gIG9uQ29ubmVjdGlvblJlYWR5KGNvbm5lY3Rpb246IFZvaWNlQ29ubmVjdGlvbik6IHZvaWQge1xyXG4gICAgLy8gSWYgd2UgaGF2ZSBhIHJlc291cmNlIHdhaXRpbmcsIHN0YXJ0IHBsYXliYWNrXHJcbiAgICBpZiAodGhpcy5jdXJyZW50UmVzb3VyY2UgJiYgdGhpcy5zdGF0ZS5zdGF0dXMgPT09IEF1ZGlvUGxheWVyU3RhdHVzLkJ1ZmZlcmluZykge1xyXG4gICAgICB0aGlzLnN0YXJ0UGxheWJhY2soY29ubmVjdGlvbik7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFzeW5jIHN0YXJ0UGxheWJhY2soY29ubmVjdGlvbjogVm9pY2VDb25uZWN0aW9uKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCByb29tID0gY29ubmVjdGlvbi5nZXRSb29tKCk7XHJcbiAgICBpZiAoIXJvb20gfHwgIXRoaXMuY3VycmVudFJlc291cmNlKSByZXR1cm47XHJcblxyXG4gICAgdHJ5IHtcclxuICAgICAgLy8gQ3JlYXRlIGF1ZGlvIHNvdXJjZSBhbmQgdHJhY2tcclxuICAgICAgYXdhaXQgdGhpcy5zZXR1cEF1ZGlvVHJhY2socm9vbSk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBTdGFydCBGRm1wZWcgdG8gZGVjb2RlIGF1ZGlvIC0gdGhpcyB3aWxsIHNldCBzdGF0ZSB0byBQbGF5aW5nIHdoZW4gcmVhZHlcclxuICAgICAgYXdhaXQgdGhpcy5zdGFydEZGbXBlZygpO1xyXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgLy8gRW1pdCBlcnJvciBidXQgZG9uJ3Qgc3RvcCAtIGxldCB1c2VyIGRlY2lkZSB3aGF0IHRvIGRvXHJcbiAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCB7IG1lc3NhZ2U6IChlcnJvciBhcyBFcnJvcikubWVzc2FnZSwgcmVzb3VyY2U6IHRoaXMuY3VycmVudFJlc291cmNlIH0pO1xyXG4gICAgICAvLyBSZXNldCB0byBpZGxlIHN0YXRlIHdpdGhvdXQgZnVsbCBjbGVhbnVwXHJcbiAgICAgIHRoaXMuc2V0U3RhdGUoeyBzdGF0dXM6IEF1ZGlvUGxheWVyU3RhdHVzLklkbGUgfSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFzeW5jIHNldHVwQXVkaW9UcmFjayhyb29tOiBSb29tKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBpZiAodGhpcy5pc1B1Ymxpc2hlZCkgcmV0dXJuO1xyXG4gICAgXHJcbiAgICB0aGlzLmF1ZGlvU291cmNlID0gbmV3IEF1ZGlvU291cmNlKFNBTVBMRV9SQVRFLCBDSEFOTkVMUyk7XHJcbiAgICB0aGlzLmF1ZGlvVHJhY2sgPSBMb2NhbEF1ZGlvVHJhY2suY3JlYXRlQXVkaW9UcmFjaygnbXVzaWMnLCB0aGlzLmF1ZGlvU291cmNlKTtcclxuICAgIFxyXG4gICAgY29uc3Qgb3B0aW9ucyA9IG5ldyBUcmFja1B1Ymxpc2hPcHRpb25zKCk7XHJcbiAgICBvcHRpb25zLnNvdXJjZSA9IFRyYWNrU291cmNlLlNPVVJDRV9NSUNST1BIT05FO1xyXG4gICAgXHJcbiAgICBpZiAocm9vbS5sb2NhbFBhcnRpY2lwYW50KSB7XHJcbiAgICAgIGF3YWl0IHJvb20ubG9jYWxQYXJ0aWNpcGFudC5wdWJsaXNoVHJhY2sodGhpcy5hdWRpb1RyYWNrLCBvcHRpb25zKTtcclxuICAgIH1cclxuICAgIHRoaXMuaXNQdWJsaXNoZWQgPSB0cnVlO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhc3luYyBzdGFydEZGbXBlZygpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGlmICghdGhpcy5jdXJyZW50UmVzb3VyY2UpIHJldHVybjtcclxuICAgIFxyXG4gICAgbGV0IGlucHV0U291cmNlID0gdGhpcy5jdXJyZW50UmVzb3VyY2UuZ2V0SW5wdXRTb3VyY2UoKTtcclxuICAgIGNvbnNvbGUubG9nKGBGRm1wZWcgaW5wdXQgc291cmNlOiAke2lucHV0U291cmNlLnN1YnN0cmluZygwLCAxMDApfS4uLmApO1xyXG4gICAgXHJcbiAgICAvLyBDaGVjayBpZiBpbnB1dCBpcyBhIFVSTCBvciBzZWFyY2ggcXVlcnlcclxuICAgIGNvbnN0IGlzVXJsID0gaW5wdXRTb3VyY2Uuc3RhcnRzV2l0aCgnaHR0cDovLycpIHx8IFxyXG4gICAgICAgICAgICAgICAgICBpbnB1dFNvdXJjZS5zdGFydHNXaXRoKCdodHRwczovLycpIHx8IFxyXG4gICAgICAgICAgICAgICAgICBpbnB1dFNvdXJjZS5zdGFydHNXaXRoKCd5dHNlYXJjaDonKTtcclxuICAgIFxyXG4gICAgLy8gSWYgbm90IGEgVVJMLCB0cmVhdCBhcyBZb3VUdWJlIHNlYXJjaFxyXG4gICAgaWYgKCFpc1VybCkge1xyXG4gICAgICBpbnB1dFNvdXJjZSA9IGB5dHNlYXJjaDE6JHtpbnB1dFNvdXJjZX1gO1xyXG4gICAgICBjb25zb2xlLmxvZyhgQ29udmVydGVkIHRvIFlvdVR1YmUgc2VhcmNoOiAke2lucHV0U291cmNlfWApO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvLyBDaGVjayBpZiB0aGlzIGlzIGEgc3RyZWFtaW5nIFVSTCB0aGF0IG5lZWRzIHl0LWRscFxyXG4gICAgY29uc3QgbmVlZHNZdERscCA9IGlucHV0U291cmNlLmluY2x1ZGVzKCd5b3V0dWJlLmNvbScpIHx8IFxyXG4gICAgICAgICAgICAgICAgICAgICAgIGlucHV0U291cmNlLmluY2x1ZGVzKCd5b3V0dS5iZScpIHx8XHJcbiAgICAgICAgICAgICAgICAgICAgICAgaW5wdXRTb3VyY2UuaW5jbHVkZXMoJ3NvdW5kY2xvdWQuY29tJykgfHxcclxuICAgICAgICAgICAgICAgICAgICAgICBpbnB1dFNvdXJjZS5pbmNsdWRlcygndHdpdGNoLnR2JykgfHxcclxuICAgICAgICAgICAgICAgICAgICAgICBpbnB1dFNvdXJjZS5zdGFydHNXaXRoKCd5dHNlYXJjaCcpO1xyXG4gICAgXHJcbiAgICBpZiAobmVlZHNZdERscCkge1xyXG4gICAgICAvLyBVc2UgeXQtZGxwIHRvIHBpcGUgYXVkaW8gZGlyZWN0bHkgdG8gRkZtcGVnXHJcbiAgICAgIGNvbnNvbGUubG9nKCdVc2luZyB5dC1kbHAgcGlwZSBtb2RlJyk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBEZXRlY3QgcGxhdGZvcm1cclxuICAgICAgY29uc3QgaXNXaW5kb3dzID0gcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJztcclxuICAgICAgY29uc3QgeXREbHBQYXRoID0gaXNXaW5kb3dzID8gJ3l0LWRscCcgOiAnfi8ubG9jYWwvYmluL3l0LWRscCc7XHJcbiAgICAgIFxyXG4gICAgICAvLyBPbiBXaW5kb3dzIHdpdGggc2hlbGwgbW9kZSwgd2UgbmVlZCB0byB1c2UgYSBzaW5nbGUgY29tbWFuZCBzdHJpbmdcclxuICAgICAgLy8gdG8gcHJlc2VydmUgc3BhY2VzIGluIHRoZSBzZWFyY2ggcXVlcnlcclxuICAgICAgaWYgKGlzV2luZG93cykge1xyXG4gICAgICAgIC8vIEJ1aWxkIGNvbW1hbmQgYXMgc2luZ2xlIHN0cmluZyB3aXRoIHByb3BlciBxdW90aW5nXHJcbiAgICAgICAgY29uc3QgeXRkbHBDbWQgPSBgJHt5dERscFBhdGh9IC1mIGJlc3RhdWRpby9iZXN0IC1vIC0gLS1uby1wbGF5bGlzdCAtLW5vLXdhcm5pbmdzIC0tZGVmYXVsdC1zZWFyY2ggeXRzZWFyY2ggXCIke2lucHV0U291cmNlfVwiYDtcclxuICAgICAgICBjb25zdCBmZm1wZWdDbWQgPSBgZmZtcGVnIC1pIHBpcGU6MCAtZiBzMTZsZSAtYXIgJHtTQU1QTEVfUkFURX0gLWFjICR7Q0hBTk5FTFN9IC1hY29kZWMgcGNtX3MxNmxlIC1gO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGNvbnNvbGUubG9nKCdbQXVkaW9QbGF5ZXJdIHl0LWRscCBjb21tYW5kOicsIHl0ZGxwQ21kKTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBTcGF3biB5dC1kbHAgd2l0aCBzaGVsbCBjb21tYW5kXHJcbiAgICAgICAgY29uc3QgeXRkbHBQcm9jZXNzID0gc3Bhd24oeXRkbHBDbWQsIFtdLCB7IFxyXG4gICAgICAgICAgc3RkaW86IFsncGlwZScsICdwaXBlJywgJ3BpcGUnXSxcclxuICAgICAgICAgIHNoZWxsOiB0cnVlXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gU3Bhd24gZmZtcGVnIHdpdGggc2hlbGwgY29tbWFuZFxyXG4gICAgICAgIHRoaXMuZmZtcGVnUHJvY2VzcyA9IHNwYXduKGZmbXBlZ0NtZCwgW10sIHsgXHJcbiAgICAgICAgICBzdGRpbzogWydwaXBlJywgJ3BpcGUnLCAncGlwZSddLFxyXG4gICAgICAgICAgc2hlbGw6IHRydWVcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBQaXBlIHl0LWRscCBzdGRvdXQgdG8gZmZtcGVnIHN0ZGluXHJcbiAgICAgICAgeXRkbHBQcm9jZXNzLnN0ZG91dD8ucGlwZSh0aGlzLmZmbXBlZ1Byb2Nlc3Muc3RkaW4hKTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBIYW5kbGUgeXQtZGxwIHN0ZGVyciAtIGxvZyBldmVyeXRoaW5nIGZvciBkZWJ1Z2dpbmdcclxuICAgICAgICB5dGRscFByb2Nlc3Muc3RkZXJyPy5vbignZGF0YScsIChkYXRhOiBCdWZmZXIpID0+IHtcclxuICAgICAgICAgIGNvbnN0IG1zZyA9IGRhdGEudG9TdHJpbmcoKS50cmltKCk7XHJcbiAgICAgICAgICBpZiAobXNnKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbeXQtZGxwXScsIG1zZyk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgeXRkbHBQcm9jZXNzLm9uKCdlcnJvcicsIChlcnIpID0+IHtcclxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1t5dC1kbHBdIHByb2Nlc3MgZXJyb3I6JywgZXJyLm1lc3NhZ2UpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHl0ZGxwUHJvY2Vzcy5vbignY2xvc2UnLCAoY29kZSkgPT4ge1xyXG4gICAgICAgICAgaWYgKGNvZGUgIT09IDApIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcihgeXQtZGxwIGV4aXRlZCB3aXRoIGNvZGUgJHtjb2RlfWApO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIC8vIFVuaXg6IHVzZSBhcmdzIGFycmF5IChubyBzaGVsbCBuZWVkZWQpXHJcbiAgICAgICAgY29uc3QgeXRkbHBBcmdzID0gW1xyXG4gICAgICAgICAgJy1mJywgJ2Jlc3RhdWRpby9iZXN0JyxcclxuICAgICAgICAgICctbycsICctJyxcclxuICAgICAgICAgICctLW5vLXBsYXlsaXN0JyxcclxuICAgICAgICAgICctLW5vLXdhcm5pbmdzJyxcclxuICAgICAgICAgICctLWRlZmF1bHQtc2VhcmNoJywgJ3l0c2VhcmNoJyxcclxuICAgICAgICAgIGlucHV0U291cmNlXHJcbiAgICAgICAgXTtcclxuICAgICAgICBcclxuICAgICAgICBjb25zdCBmZm1wZWdBcmdzID0gW1xyXG4gICAgICAgICAgJy1pJywgJ3BpcGU6MCcsXHJcbiAgICAgICAgICAnLWYnLCAnczE2bGUnLFxyXG4gICAgICAgICAgJy1hcicsIFN0cmluZyhTQU1QTEVfUkFURSksXHJcbiAgICAgICAgICAnLWFjJywgU3RyaW5nKENIQU5ORUxTKSxcclxuICAgICAgICAgICctYWNvZGVjJywgJ3BjbV9zMTZsZScsXHJcbiAgICAgICAgICAnLSdcclxuICAgICAgICBdO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIFNwYXduIHl0LWRscFxyXG4gICAgICAgIGNvbnN0IHl0ZGxwUHJvY2VzcyA9IHNwYXduKHl0RGxwUGF0aCwgeXRkbHBBcmdzLCB7IFxyXG4gICAgICAgICAgc3RkaW86IFsncGlwZScsICdwaXBlJywgJ3BpcGUnXSxcclxuICAgICAgICAgIHNoZWxsOiBmYWxzZVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIFNwYXduIGZmbXBlZ1xyXG4gICAgICAgIHRoaXMuZmZtcGVnUHJvY2VzcyA9IHNwYXduKCdmZm1wZWcnLCBmZm1wZWdBcmdzLCB7IFxyXG4gICAgICAgICAgc3RkaW86IFsncGlwZScsICdwaXBlJywgJ3BpcGUnXSxcclxuICAgICAgICAgIHNoZWxsOiBmYWxzZVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIFBpcGUgeXQtZGxwIHN0ZG91dCB0byBmZm1wZWcgc3RkaW5cclxuICAgICAgICB5dGRscFByb2Nlc3Muc3Rkb3V0Py5waXBlKHRoaXMuZmZtcGVnUHJvY2Vzcy5zdGRpbiEpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIEhhbmRsZSB5dC1kbHAgZXJyb3JzXHJcbiAgICAgICAgeXRkbHBQcm9jZXNzLnN0ZGVycj8ub24oJ2RhdGEnLCAoZGF0YTogQnVmZmVyKSA9PiB7XHJcbiAgICAgICAgICBjb25zdCBtc2cgPSBkYXRhLnRvU3RyaW5nKCk7XHJcbiAgICAgICAgICBpZiAobXNnLmluY2x1ZGVzKCdFUlJPUicpKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ3l0LWRscCBlcnJvcjonLCBtc2cpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHl0ZGxwUHJvY2Vzcy5vbignZXJyb3InLCAoZXJyKSA9PiB7XHJcbiAgICAgICAgICBjb25zb2xlLmVycm9yKCd5dC1kbHAgcHJvY2VzcyBlcnJvcjonLCBlcnIubWVzc2FnZSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgeXRkbHBQcm9jZXNzLm9uKCdjbG9zZScsIChjb2RlKSA9PiB7XHJcbiAgICAgICAgICBpZiAoY29kZSAhPT0gMCkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGB5dC1kbHAgZXhpdGVkIHdpdGggY29kZSAke2NvZGV9YCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGNvbnNvbGUubG9nKCdVc2luZyBkaXJlY3QgRkZtcGVnIG1vZGUnKTtcclxuICAgICAgdGhpcy5mZm1wZWdQcm9jZXNzID0gc3Bhd24oJ2ZmbXBlZycsIFtcclxuICAgICAgICAnLXJlY29ubmVjdCcsICcxJyxcclxuICAgICAgICAnLXJlY29ubmVjdF9zdHJlYW1lZCcsICcxJyxcclxuICAgICAgICAnLXJlY29ubmVjdF9kZWxheV9tYXgnLCAnNScsXHJcbiAgICAgICAgJy1pJywgaW5wdXRTb3VyY2UsXHJcbiAgICAgICAgJy1mJywgJ3MxNmxlJyxcclxuICAgICAgICAnLWFyJywgU3RyaW5nKFNBTVBMRV9SQVRFKSxcclxuICAgICAgICAnLWFjJywgU3RyaW5nKENIQU5ORUxTKSxcclxuICAgICAgICAnLWFjb2RlYycsICdwY21fczE2bGUnLFxyXG4gICAgICAgICctJ1xyXG4gICAgICBdLCB7IHN0ZGlvOiBbJ3BpcGUnLCAncGlwZScsICdwaXBlJ10gfSk7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgZnJhbWVTaXplID0gU0FNUExFU19QRVJfRlJBTUUgKiBDSEFOTkVMUyAqIDI7XHJcbiAgICB0aGlzLmZmbXBlZ0RvbmUgPSBmYWxzZTtcclxuICAgIGxldCBoYXNSZWNlaXZlZERhdGEgPSBmYWxzZTtcclxuXHJcbiAgICB0aGlzLmZmbXBlZ1Byb2Nlc3Muc3Rkb3V0Py5vbignZGF0YScsIChjaHVuazogQnVmZmVyKSA9PiB7XHJcbiAgICAgIGlmICh0aGlzLnN0YXRlLnN0YXR1cyAhPT0gQXVkaW9QbGF5ZXJTdGF0dXMuUGxheWluZyAmJiBcclxuICAgICAgICAgIHRoaXMuc3RhdGUuc3RhdHVzICE9PSBBdWRpb1BsYXllclN0YXR1cy5CdWZmZXJpbmcpIHJldHVybjtcclxuICAgICAgXHJcbiAgICAgIGhhc1JlY2VpdmVkRGF0YSA9IHRydWU7XHJcbiAgICAgIFxyXG4gICAgICAvLyBIYW5kbGUgbGVmdG92ZXIgZnJvbSBwcmV2aW91cyBjaHVua1xyXG4gICAgICBpZiAodGhpcy5sZWZ0b3ZlckJ1ZmZlciAmJiB0aGlzLmxlZnRvdmVyQnVmZmVyLmxlbmd0aCA+IDApIHtcclxuICAgICAgICBjaHVuayA9IEJ1ZmZlci5jb25jYXQoW3RoaXMubGVmdG92ZXJCdWZmZXIsIGNodW5rXSk7XHJcbiAgICAgICAgdGhpcy5sZWZ0b3ZlckJ1ZmZlciA9IG51bGw7XHJcbiAgICAgIH1cclxuICAgICAgXHJcbiAgICAgIGxldCBvZmZzZXQgPSAwO1xyXG4gICAgICB3aGlsZSAob2Zmc2V0ICsgZnJhbWVTaXplIDw9IGNodW5rLmxlbmd0aCkge1xyXG4gICAgICAgIGNvbnN0IGZyYW1lID0gY2h1bmsuc2xpY2Uob2Zmc2V0LCBvZmZzZXQgKyBmcmFtZVNpemUpO1xyXG4gICAgICAgIGNvbnN0IGludDE2QXJyYXkgPSBuZXcgSW50MTZBcnJheShTQU1QTEVTX1BFUl9GUkFNRSAqIENIQU5ORUxTKTtcclxuICAgICAgICBcclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGludDE2QXJyYXkubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgIGludDE2QXJyYXlbaV0gPSBmcmFtZS5yZWFkSW50MTZMRShpICogMik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHRoaXMuZnJhbWVRdWV1ZS5wdXNoKGludDE2QXJyYXkpO1xyXG4gICAgICAgIG9mZnNldCArPSBmcmFtZVNpemU7XHJcbiAgICAgIH1cclxuICAgICAgXHJcbiAgICAgIC8vIFNhdmUgbGVmdG92ZXJcclxuICAgICAgaWYgKG9mZnNldCA8IGNodW5rLmxlbmd0aCkge1xyXG4gICAgICAgIHRoaXMubGVmdG92ZXJCdWZmZXIgPSBjaHVuay5zbGljZShvZmZzZXQpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICBsZXQgc3RkZXJyT3V0cHV0ID0gJyc7XHJcbiAgICB0aGlzLmZmbXBlZ1Byb2Nlc3Muc3RkZXJyPy5vbignZGF0YScsIChkYXRhOiBCdWZmZXIpID0+IHtcclxuICAgICAgc3RkZXJyT3V0cHV0ICs9IGRhdGEudG9TdHJpbmcoKTtcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuZmZtcGVnUHJvY2Vzcy5vbignY2xvc2UnLCAoY29kZSkgPT4ge1xyXG4gICAgICB0aGlzLmZmbXBlZ0RvbmUgPSB0cnVlO1xyXG4gICAgICB0aGlzLmZmbXBlZ1Byb2Nlc3MgPSBudWxsO1xyXG4gICAgICBpZiAoY29kZSAhPT0gMCkge1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoYEZGbXBlZyBzdGRlcnI6XFxuJHtzdGRlcnJPdXRwdXR9YCk7XHJcbiAgICAgIH1cclxuICAgICAgY29uc29sZS5sb2coYFtBdWRpb1BsYXllcl0gRkZtcGVnIGNsb3NlZCB3aXRoIGNvZGUgJHtjb2RlfSwgaGFzUmVjZWl2ZWREYXRhOiAke2hhc1JlY2VpdmVkRGF0YX0sIHF1ZXVlOiAke3RoaXMuZnJhbWVRdWV1ZS5sZW5ndGh9YCk7XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLmZmbXBlZ1Byb2Nlc3Mub24oJ2Vycm9yJywgKGVycikgPT4ge1xyXG4gICAgICBjb25zb2xlLmVycm9yKCdGRm1wZWcgcHJvY2VzcyBlcnJvcjonLCBlcnIubWVzc2FnZSk7XHJcbiAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCB7IG1lc3NhZ2U6IGVyci5tZXNzYWdlLCByZXNvdXJjZTogdGhpcy5jdXJyZW50UmVzb3VyY2UgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBXYWl0IGZvciBpbml0aWFsIGJ1ZmZlciB3aXRoIHRpbWVvdXRcclxuICAgIGNvbnN0IGJ1ZmZlclRpbWVvdXQgPSAxMDAwMDsgLy8gMTAgc2Vjb25kcyBmb3IgaW5pdGlhbCBidWZmZXJcclxuICAgIGNvbnN0IHN0YXJ0VGltZSA9IERhdGUubm93KCk7XHJcbiAgICBcclxuICAgIHdoaWxlICh0aGlzLmZyYW1lUXVldWUubGVuZ3RoIDwgTUlOX0JVRkZFUl9GUkFNRVMgJiYgRGF0ZS5ub3coKSAtIHN0YXJ0VGltZSA8IGJ1ZmZlclRpbWVvdXQpIHtcclxuICAgICAgYXdhaXQgbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIDEwMCkpO1xyXG4gICAgICBcclxuICAgICAgLy8gQ2hlY2sgaWYgRkZtcGVnIGZhaWxlZCBlYXJseVxyXG4gICAgICBpZiAodGhpcy5mZm1wZWdEb25lICYmIHRoaXMuZnJhbWVRdWV1ZS5sZW5ndGggPT09IDApIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZGbXBlZyBmYWlsZWQgdG8gcHJvZHVjZSBhdWRpbyBkYXRhJyk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgaWYgKHRoaXMuZnJhbWVRdWV1ZS5sZW5ndGggPT09IDApIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdUaW1lb3V0IHdhaXRpbmcgZm9yIGF1ZGlvIGRhdGEnKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgY29uc29sZS5sb2coYFtBdWRpb1BsYXllcl0gU3RhcnRpbmcgcGxheWJhY2sgd2l0aCAke3RoaXMuZnJhbWVRdWV1ZS5sZW5ndGh9IGZyYW1lcyBidWZmZXJlZCAodGFyZ2V0OiAke1RBUkdFVF9CVUZGRVJfRlJBTUVTfSlgKTtcclxuXHJcbiAgICAvLyBNYXJrIHJlYWR5IGZvciBwbGF5YmFjayAtIHNldFN0YXRlIHdpbGwgdHJpZ2dlciB0aGUgbG9vcFxyXG4gICAgdGhpcy5pc1BsYXliYWNrTG9vcFJ1bm5pbmcgPSB0cnVlO1xyXG4gICAgdGhpcy5uZXh0RnJhbWVUaW1lID0gaHJ0aW1lLmJpZ2ludCgpO1xyXG4gICAgY29uc29sZS5sb2coYFtBdWRpb1BsYXllcl0gUGxheWJhY2sgcmVhZHksIGF1ZGlvU291cmNlIGV4aXN0czogJHshIXRoaXMuYXVkaW9Tb3VyY2V9YCk7XHJcbiAgICBcclxuICAgIC8vIFNldCBzdGF0ZSB0byBwbGF5aW5nIC0gdGhpcyB3aWxsIHRyaWdnZXIgc2NoZWR1bGVOZXh0RnJhbWUgdmlhIHNldFN0YXRlXHJcbiAgICB0aGlzLnNldFN0YXRlKHsgc3RhdHVzOiBBdWRpb1BsYXllclN0YXR1cy5QbGF5aW5nLCByZXNvdXJjZTogdGhpcy5jdXJyZW50UmVzb3VyY2UgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBIaWdoLXJlc29sdXRpb24gZnJhbWUgc2NoZWR1bGluZyB1c2luZyBocnRpbWVcclxuICAgKiBUaGlzIHByb3ZpZGVzIG11Y2ggbW9yZSBhY2N1cmF0ZSB0aW1pbmcgdGhhbiBzZXRJbnRlcnZhbFxyXG4gICAqL1xyXG4gIHByaXZhdGUgc2NoZWR1bGVOZXh0RnJhbWUoKTogdm9pZCB7XHJcbiAgICBpZiAoIXRoaXMuaXNQbGF5YmFja0xvb3BSdW5uaW5nIHx8IHRoaXMuc3RhdGUuc3RhdHVzICE9PSBBdWRpb1BsYXllclN0YXR1cy5QbGF5aW5nKSB7XHJcbiAgICAgIGNvbnNvbGUubG9nKGBbQXVkaW9QbGF5ZXJdIHNjaGVkdWxlTmV4dEZyYW1lIHNraXBwZWQ6IGxvb3BSdW5uaW5nPSR7dGhpcy5pc1BsYXliYWNrTG9vcFJ1bm5pbmd9LCBzdGF0dXM9JHt0aGlzLnN0YXRlLnN0YXR1c31gKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IG5vdyA9IGhydGltZS5iaWdpbnQoKTtcclxuICAgIGNvbnN0IGRlbGF5TnMgPSB0aGlzLm5leHRGcmFtZVRpbWUgLSBub3c7XHJcbiAgICBjb25zdCBkZWxheU1zID0gTnVtYmVyKGRlbGF5TnMpIC8gMV8wMDBfMDAwO1xyXG5cclxuICAgIGlmICh0aGlzLmZyYW1lc1BsYXllZCA9PT0gMCkge1xyXG4gICAgICBjb25zb2xlLmxvZyhgW0F1ZGlvUGxheWVyXSBGaXJzdCBmcmFtZSBzY2hlZHVsaW5nOiBkZWxheU1zPSR7ZGVsYXlNcy50b0ZpeGVkKDIpfWApO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIFNjaGVkdWxlIG5leHQgZnJhbWVcclxuICAgIGlmIChkZWxheU1zID4gMSkge1xyXG4gICAgICB0aGlzLnBsYXliYWNrVGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4gdGhpcy5wcm9jZXNzRnJhbWUoKSwgTWF0aC5tYXgoMSwgZGVsYXlNcyAtIDEpKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIC8vIFdlJ3JlIGJlaGluZCwgcHJvY2VzcyBpbW1lZGlhdGVseVxyXG4gICAgICBzZXRJbW1lZGlhdGUoKCkgPT4gdGhpcy5wcm9jZXNzRnJhbWUoKSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBQcm9jZXNzIGFuZCBzZW5kIGEgc2luZ2xlIGF1ZGlvIGZyYW1lXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBhc3luYyBwcm9jZXNzRnJhbWUoKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBpZiAoIXRoaXMuaXNQbGF5YmFja0xvb3BSdW5uaW5nIHx8IHRoaXMuc3RhdGUuc3RhdHVzICE9PSBBdWRpb1BsYXllclN0YXR1cy5QbGF5aW5nKSB7XHJcbiAgICAgIGlmICh0aGlzLmZyYW1lc1BsYXllZCA9PT0gMCkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGBbQXVkaW9QbGF5ZXJdIHByb2Nlc3NGcmFtZSBza2lwcGVkOiBsb29wUnVubmluZz0ke3RoaXMuaXNQbGF5YmFja0xvb3BSdW5uaW5nfSwgc3RhdHVzPSR7dGhpcy5zdGF0ZS5zdGF0dXN9YCk7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIENoZWNrIGJ1ZmZlciBzdGF0dXNcclxuICAgIGNvbnN0IGJ1ZmZlclNpemUgPSB0aGlzLmZyYW1lUXVldWUubGVuZ3RoO1xyXG4gICAgXHJcbiAgICBpZiAoYnVmZmVyU2l6ZSA+IDAgJiYgdGhpcy5hdWRpb1NvdXJjZSkge1xyXG4gICAgICBjb25zdCBpbnQxNkFycmF5ID0gdGhpcy5mcmFtZVF1ZXVlLnNoaWZ0KCkhO1xyXG4gICAgICBjb25zdCBhdWRpb0ZyYW1lID0gbmV3IEF1ZGlvRnJhbWUoaW50MTZBcnJheSwgU0FNUExFX1JBVEUsIENIQU5ORUxTLCBTQU1QTEVTX1BFUl9GUkFNRSk7XHJcbiAgICAgIFxyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGF3YWl0IHRoaXMuYXVkaW9Tb3VyY2UuY2FwdHVyZUZyYW1lKGF1ZGlvRnJhbWUpO1xyXG4gICAgICAgIHRoaXMuZnJhbWVzUGxheWVkKys7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gTG9nIHByb2dyZXNzIGV2ZXJ5IDUwMCBmcmFtZXMgKH4xMCBzZWNvbmRzKVxyXG4gICAgICAgIGlmICh0aGlzLmZyYW1lc1BsYXllZCAlIDUwMCA9PT0gMCkge1xyXG4gICAgICAgICAgY29uc29sZS5sb2coYFtBdWRpb1BsYXllcl0gUHJvZ3Jlc3M6ICR7dGhpcy5mcmFtZXNQbGF5ZWR9IGZyYW1lcyBwbGF5ZWQsIGJ1ZmZlcjogJHtidWZmZXJTaXplfWApO1xyXG4gICAgICAgIH1cclxuICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoYFtBdWRpb1BsYXllcl0gRnJhbWUgZXJyb3I6YCwgKGUgYXMgRXJyb3IpLm1lc3NhZ2UpO1xyXG4gICAgICB9XHJcbiAgICAgIFxyXG4gICAgICAvLyBVcGRhdGUgdGltaW5nIGZvciBuZXh0IGZyYW1lXHJcbiAgICAgIHRoaXMubmV4dEZyYW1lVGltZSArPSBGUkFNRV9JTlRFUlZBTF9OUztcclxuICAgICAgXHJcbiAgICAgIC8vIEFkYXB0aXZlIHRpbWluZzogaWYgYnVmZmVyIGlzIGxvdywgc2xvdyBkb3duIHNsaWdodGx5IHRvIGxldCBpdCByZWNvdmVyXHJcbiAgICAgIGlmIChidWZmZXJTaXplIDwgTE9XX0JVRkZFUl9USFJFU0hPTEQgJiYgIXRoaXMuZmZtcGVnRG9uZSkge1xyXG4gICAgICAgIC8vIEFkZCAxbXMgZGVsYXkgdG8gbGV0IGJ1ZmZlciByZWNvdmVyXHJcbiAgICAgICAgdGhpcy5uZXh0RnJhbWVUaW1lICs9IEJpZ0ludCgxXzAwMF8wMDApO1xyXG4gICAgICAgIHRoaXMuYnVmZmVyVW5kZXJydW5zKys7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKHRoaXMuYnVmZmVyVW5kZXJydW5zICUgNTAgPT09IDApIHtcclxuICAgICAgICAgIGNvbnNvbGUubG9nKGBbQXVkaW9QbGF5ZXJdIEJ1ZmZlciBsb3c6ICR7YnVmZmVyU2l6ZX0gZnJhbWVzLCAke3RoaXMuYnVmZmVyVW5kZXJydW5zfSB1bmRlcnJ1bnNgKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgXHJcbiAgICAgIC8vIFNjaGVkdWxlIG5leHQgZnJhbWVcclxuICAgICAgdGhpcy5zY2hlZHVsZU5leHRGcmFtZSgpO1xyXG4gICAgICBcclxuICAgIH0gZWxzZSBpZiAodGhpcy5mZm1wZWdEb25lICYmIGJ1ZmZlclNpemUgPT09IDApIHtcclxuICAgICAgLy8gUGxheWJhY2sgZmluaXNoZWRcclxuICAgICAgY29uc29sZS5sb2coJ1tBdWRpb1BsYXllcl0gUGxheWJhY2sgZmluaXNoZWQgLSBxdWV1ZSBlbXB0eSBhbmQgRkZtcGVnIGRvbmUnKTtcclxuICAgICAgdGhpcy5zdG9wKCk7XHJcbiAgICB9IGVsc2UgaWYgKGJ1ZmZlclNpemUgPT09IDApIHtcclxuICAgICAgLy8gQnVmZmVyIHVuZGVycnVuIC0gd2FpdCBmb3IgbW9yZSBkYXRhXHJcbiAgICAgIHRoaXMuYnVmZmVyVW5kZXJydW5zKys7XHJcbiAgICAgIGNvbnNvbGUubG9nKGBbQXVkaW9QbGF5ZXJdIEJ1ZmZlciB1bmRlcnJ1biAjJHt0aGlzLmJ1ZmZlclVuZGVycnVuc30sIHdhaXRpbmcgZm9yIGRhdGEuLi5gKTtcclxuICAgICAgXHJcbiAgICAgIC8vIFdhaXQgYSBiaXQgYW5kIHRyeSBhZ2FpblxyXG4gICAgICB0aGlzLm5leHRGcmFtZVRpbWUgPSBocnRpbWUuYmlnaW50KCkgKyBCaWdJbnQoNTBfMDAwXzAwMCk7IC8vIDUwbXNcclxuICAgICAgdGhpcy5zY2hlZHVsZU5leHRGcmFtZSgpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBjbGVhbnVwKCk6IHZvaWQge1xyXG4gICAgLy8gU3RvcCBwbGF5YmFjayBsb29wXHJcbiAgICB0aGlzLmlzUGxheWJhY2tMb29wUnVubmluZyA9IGZhbHNlO1xyXG4gICAgaWYgKHRoaXMucGxheWJhY2tUaW1lb3V0KSB7XHJcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLnBsYXliYWNrVGltZW91dCk7XHJcbiAgICAgIHRoaXMucGxheWJhY2tUaW1lb3V0ID0gbnVsbDtcclxuICAgIH1cclxuICAgIFxyXG4gICAgLy8gS2lsbCBGRm1wZWdcclxuICAgIGlmICh0aGlzLmZmbXBlZ1Byb2Nlc3MpIHtcclxuICAgICAgdGhpcy5mZm1wZWdQcm9jZXNzLmtpbGwoJ1NJR0tJTEwnKTtcclxuICAgICAgdGhpcy5mZm1wZWdQcm9jZXNzID0gbnVsbDtcclxuICAgIH1cclxuICAgIFxyXG4gICAgLy8gQ2xlYXIgZnJhbWUgcXVldWVcclxuICAgIHRoaXMuZnJhbWVRdWV1ZSA9IFtdO1xyXG4gICAgdGhpcy5sZWZ0b3ZlckJ1ZmZlciA9IG51bGw7XHJcbiAgICBcclxuICAgIC8vIFJlc2V0IHRpbWluZyBhbmQgc3RhdGVcclxuICAgIHRoaXMubmV4dEZyYW1lVGltZSA9IEJpZ0ludCgwKTtcclxuICAgIHRoaXMuZmZtcGVnRG9uZSA9IGZhbHNlO1xyXG4gICAgXHJcbiAgICAvLyBMb2cgc3RhdHNcclxuICAgIGlmICh0aGlzLmZyYW1lc1BsYXllZCA+IDApIHtcclxuICAgICAgY29uc29sZS5sb2coYFtBdWRpb1BsYXllcl0gUGxheWJhY2sgc3RhdHM6ICR7dGhpcy5mcmFtZXNQbGF5ZWR9IGZyYW1lcywgJHt0aGlzLmJ1ZmZlclVuZGVycnVuc30gdW5kZXJydW5zYCk7XHJcbiAgICB9XHJcbiAgICB0aGlzLmJ1ZmZlclVuZGVycnVucyA9IDA7XHJcbiAgICB0aGlzLmZyYW1lc1BsYXllZCA9IDA7XHJcbiAgICBcclxuICAgIC8vIE5vdGU6IFdlIGRvbid0IHVucHVibGlzaCB0aGUgdHJhY2sgLSBpdCBzdGF5cyBwdWJsaXNoZWQgZm9yIG5leHQgcGxheVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzZXRTdGF0ZShuZXdTdGF0ZTogQXVkaW9QbGF5ZXJTdGF0ZSk6IHZvaWQge1xyXG4gICAgY29uc3Qgb2xkU3RhdGUgPSB0aGlzLnN0YXRlO1xyXG4gICAgdGhpcy5zdGF0ZSA9IG5ld1N0YXRlO1xyXG4gICAgdGhpcy5lbWl0KCdzdGF0ZUNoYW5nZScsIG9sZFN0YXRlLCBuZXdTdGF0ZSk7XHJcbiAgICBcclxuICAgIC8vIFN0YXJ0IHBsYXliYWNrIGxvb3Agd2hlbiB0cmFuc2l0aW9uaW5nIHRvIFBsYXlpbmdcclxuICAgIGlmIChuZXdTdGF0ZS5zdGF0dXMgPT09IEF1ZGlvUGxheWVyU3RhdHVzLlBsYXlpbmcgJiYgb2xkU3RhdGUuc3RhdHVzICE9PSBBdWRpb1BsYXllclN0YXR1cy5QbGF5aW5nKSB7XHJcbiAgICAgIGNvbnNvbGUubG9nKGBbQXVkaW9QbGF5ZXJdIFN0YXRlIGNoYW5nZWQgdG8gUGxheWluZywgc3RhcnRpbmcgcGxheWJhY2sgbG9vcGApO1xyXG4gICAgICB0aGlzLnNjaGVkdWxlTmV4dEZyYW1lKCk7XHJcbiAgICB9XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogQ3JlYXRlIGFuIGF1ZGlvIHBsYXllclxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUF1ZGlvUGxheWVyKG9wdGlvbnM/OiBDcmVhdGVBdWRpb1BsYXllck9wdGlvbnMpOiBBdWRpb1BsYXllciB7XHJcbiAgcmV0dXJuIG5ldyBBdWRpb1BsYXllcihvcHRpb25zKTtcclxufVxyXG4iXX0=