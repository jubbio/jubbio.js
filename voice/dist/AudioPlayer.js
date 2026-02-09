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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQXVkaW9QbGF5ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvQXVkaW9QbGF5ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBMmlCQSw4Q0FFQztBQTdpQkQsbUNBQXNDO0FBQ3RDLGlEQUFvRDtBQUNwRCxxQ0FBaUM7QUFDakMsZ0RBTzJCO0FBQzNCLG1DQUE0QztBQUs1Qyw0Q0FBNEM7QUFDNUMsTUFBTSxXQUFXLEdBQUcsS0FBSyxDQUFDO0FBQzFCLE1BQU0sUUFBUSxHQUFHLENBQUMsQ0FBQztBQUNuQixNQUFNLGlCQUFpQixHQUFHLEVBQUUsQ0FBQztBQUM3QixNQUFNLGlCQUFpQixHQUFHLENBQUMsV0FBVyxHQUFHLGlCQUFpQixDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsTUFBTTtBQUUxRSx5QkFBeUI7QUFDekIsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxzQkFBc0I7QUFDcEUsTUFBTSxvQkFBb0IsR0FBRyxHQUFHLENBQUMsQ0FBQyxrQ0FBa0M7QUFDcEUsTUFBTSxpQkFBaUIsR0FBRyxFQUFFLENBQUMsQ0FBSSx5Q0FBeUM7QUFDMUUsTUFBTSxpQkFBaUIsR0FBRyxHQUFHLENBQUMsQ0FBRyxvREFBb0Q7QUFDckYsTUFBTSxvQkFBb0IsR0FBRyxFQUFFLENBQUMsQ0FBQyx5Q0FBeUM7QUFFMUU7O0dBRUc7QUFDSCxNQUFhLFdBQVksU0FBUSxxQkFBWTtJQUMzQywyQkFBMkI7SUFDcEIsS0FBSyxHQUFxQixFQUFFLE1BQU0sRUFBRSx5QkFBaUIsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUVwRSxxQkFBcUI7SUFDYixPQUFPLENBQTJCO0lBRTFDLG1DQUFtQztJQUMzQixhQUFhLEdBQXlCLElBQUksR0FBRyxFQUFFLENBQUM7SUFFeEQsNkJBQTZCO0lBQ3JCLGVBQWUsR0FBeUIsSUFBSSxDQUFDO0lBRXJELHFCQUFxQjtJQUNiLGFBQWEsR0FBd0IsSUFBSSxDQUFDO0lB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Q0FBQyxDQUFDO1FBQ3pCLElBQUksQ0FBQyxZQUFZLEdBQUcsQ0FBQyxDQUFDO1FBRXRCLHdFQUF3RTtJQUMxRSxDQUFDO0lBRU8sUUFBUSxDQUFDLFFBQTBCO1FBQ3pDLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7UUFDNUIsSUFBSSxDQUFDLEtBQUssR0FBRyxRQUFRLENBQUM7UUFDdEIsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsUUFBUSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBRTdDLG9EQUFvRDtRQUNwRCxJQUFJLFFBQVEsQ0FBQyxNQUFNLEtBQUsseUJBQWlCLENBQUMsT0FBTyxJQUFJLFFBQVEsQ0FBQyxNQUFNLEtBQUsseUJBQWlCLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDbkcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxnRUFBZ0UsQ0FBQyxDQUFDO1lBQzlFLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1FBQzNCLENBQUM7SUFDSCxDQUFDO0NBQ0Y7QUF0Z0JELGtDQXNnQkM7QUFFRDs7R0FFRztBQUNILFNBQWdCLGlCQUFpQixDQUFDLE9BQWtDO0lBQ2xFLE9BQU8sSUFBSSxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDbEMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gJ2V2ZW50cyc7XHJcbmltcG9ydCB7IHNwYXduLCBDaGlsZFByb2Nlc3MgfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcclxuaW1wb3J0IHsgaHJ0aW1lIH0gZnJvbSAncHJvY2Vzcyc7XHJcbmltcG9ydCB7IFxyXG4gIFJvb20sIFxyXG4gIExvY2FsQXVkaW9UcmFjaywgXHJcbiAgQXVkaW9Tb3VyY2UsIFxyXG4gIFRyYWNrUHVibGlzaE9wdGlvbnMsIFxyXG4gIFRyYWNrU291cmNlLFxyXG4gIEF1ZGlvRnJhbWUgXHJcbn0gZnJvbSAnQGxpdmVraXQvcnRjLW5vZGUnO1xyXG5pbXBvcnQgeyBBdWRpb1BsYXllclN0YXR1cyB9IGZyb20gJy4vZW51bXMnO1xyXG5pbXBvcnQgeyBDcmVhdGVBdWRpb1BsYXllck9wdGlvbnMsIEF1ZGlvUGxheWVyU3RhdGUgfSBmcm9tICcuL3R5cGVzJztcclxuaW1wb3J0IHsgQXVkaW9SZXNvdXJjZSB9IGZyb20gJy4vQXVkaW9SZXNvdXJjZSc7XHJcbmltcG9ydCB7IFZvaWNlQ29ubmVjdGlvbiB9IGZyb20gJy4vVm9pY2VDb25uZWN0aW9uJztcclxuXHJcbi8vIEF1ZGlvIHNldHRpbmdzIGZvciBMaXZlS2l0ICg0OGtIeiBzdGVyZW8pXHJcbmNvbnN0IFNBTVBMRV9SQVRFID0gNDgwMDA7XHJcbmNvbnN0IENIQU5ORUxTID0gMjtcclxuY29uc3QgRlJBTUVfRFVSQVRJT05fTVMgPSAyMDtcclxuY29uc3QgU0FNUExFU19QRVJfRlJBTUUgPSAoU0FNUExFX1JBVEUgKiBGUkFNRV9EVVJBVElPTl9NUykgLyAxMDAwOyAvLyA5NjBcclxuXHJcbi8vIEppdHRlciBidWZmZXIgc2V0dGluZ3NcclxuY29uc3QgRlJBTUVfSU5URVJWQUxfTlMgPSBCaWdJbnQoMjBfMDAwXzAwMCk7IC8vIDIwbXMgaW4gbmFub3NlY29uZHNcclxuY29uc3QgVEFSR0VUX0JVRkZFUl9GUkFNRVMgPSAxNTA7IC8vIH4zIHNlY29uZHMgLSB0YXJnZXQgYnVmZmVyIHNpemVcclxuY29uc3QgTUlOX0JVRkZFUl9GUkFNRVMgPSA3NTsgICAgLy8gfjEuNSBzZWNvbmRzIC0gbWluaW11bSBiZWZvcmUgd2Ugc3RhcnRcclxuY29uc3QgTUFYX0JVRkZFUl9GUkFNRVMgPSA1MDA7ICAgLy8gfjEwIHNlY29uZHMgLSBtYXggYnVmZmVyIHRvIHByZXZlbnQgbWVtb3J5IGlzc3Vlc1xyXG5jb25zdCBMT1dfQlVGRkVSX1RIUkVTSE9MRCA9IDUwOyAvLyB+MSBzZWNvbmQgLSB3aGVuIHRvIHNsb3cgZG93biBwbGF5YmFja1xyXG5cclxuLyoqXHJcbiAqIEF1ZGlvIHBsYXllciBmb3IgcGxheWluZyBhdWRpbyByZXNvdXJjZXNcclxuICovXHJcbmV4cG9ydCBjbGFzcyBBdWRpb1BsYXllciBleHRlbmRzIEV2ZW50RW1pdHRlciB7XHJcbiAgLyoqIEN1cnJlbnQgcGxheWVyIHN0YXRlICovXHJcbiAgcHVibGljIHN0YXRlOiBBdWRpb1BsYXllclN0YXRlID0geyBzdGF0dXM6IEF1ZGlvUGxheWVyU3RhdHVzLklkbGUgfTtcclxuICBcclxuICAvKiogUGxheWVyIG9wdGlvbnMgKi9cclxuICBwcml2YXRlIG9wdGlvbnM6IENyZWF0ZUF1ZGlvUGxheWVyT3B0aW9ucztcclxuICBcclxuICAvKiogU3Vic2NyaWJlZCB2b2ljZSBjb25uZWN0aW9ucyAqL1xyXG4gIHByaXZhdGUgc3Vic2NyaXB0aW9uczogU2V0PFZvaWNlQ29ubmVjdGlvbj4gPSBuZXcgU2V0KCk7XHJcbiAgXHJcbiAgLyoqIEN1cnJlbnQgYXVkaW8gcmVzb3VyY2UgKi9cclxuICBwcml2YXRlIGN1cnJlbnRSZXNvdXJjZTogQXVkaW9SZXNvdXJjZSB8IG51bGwgPSBudWxsO1xyXG4gIFxyXG4gIC8qKiBGRm1wZWcgcHJvY2VzcyAqL1xyXG4gIHByaXZhdGUgZmZtcGVnUHJvY2VzczogQ2hpbGRQcm9jZXNzIHwgbnVsbCA9IG51bGw7XHJcbiAgXHJcbiAgLyoqIExpdmVLaXQgYXVkaW8gc291cmNlIGFuZCB0cmFjayAqL1xyXG4gIHByaXZhdGUgYXVkaW9Tb3VyY2U6IEF1ZGlvU291cmNlIHwgbnVsbCA9IG51bGw7XHJcbiAgcHJpdmF0ZSBhdWRpb1RyYWNrOiBMb2NhbEF1ZGlvVHJhY2sgfCBudWxsID0gbnVsbDtcclxuICBcclxuICAvKiogRnJhbWUgcXVldWUgYW5kIHBsYXliYWNrIHN0YXRlICovXHJcbiAgcHJpdmF0ZSBmcmFtZVF1ZXVlOiBJbnQxNkFycmF5W10gPSBbXTtcclxuICBwcml2YXRlIHBsYXliYWNrVGltZW91dDogTm9kZUpTLlRpbWVvdXQgfCBudWxsID0gbnVsbDtcclxuICBwcml2YXRlIGxlZnRvdmVyQnVmZmVyOiBCdWZmZXIgfCBudWxsID0gbnVsbDtcclxuICBwcml2YXRlIGlzUHVibGlzaGVkID0gZmFsc2U7XHJcbiAgXHJcbiAgLyoqIEhpZ2gtcmVzb2x1dGlvbiB0aW1pbmcgKi9cclxuICBwcml2YXRlIG5leHRGcmFtZVRpbWU6IGJpZ2ludCA9IEJpZ0ludCgwKTtcclxuICBwcml2YXRlIGlzUGxheWJhY2tMb29wUnVubmluZyA9IGZhbHNlO1xyXG4gIHByaXZhdGUgZmZtcGVnRG9uZSA9IGZhbHNlO1xyXG4gIFxyXG4gIC8qKiBCdWZmZXIgc3RhdGlzdGljcyAqL1xyXG4gIHByaXZhdGUgYnVmZmVyVW5kZXJydW5zID0gMDtcclxuICBwcml2YXRlIGZyYW1lc1BsYXllZCA9IDA7XHJcblxyXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnM6IENyZWF0ZUF1ZGlvUGxheWVyT3B0aW9ucyA9IHt9KSB7XHJcbiAgICBzdXBlcigpO1xyXG4gICAgdGhpcy5vcHRpb25zID0ge1xyXG4gICAgICBiZWhhdmlvcnM6IHtcclxuICAgICAgICBub1N1YnNjcmliZXI6ICdwYXVzZScsXHJcbiAgICAgICAgbWF4TWlzc2VkRnJhbWVzOiA1LFxyXG4gICAgICAgIC4uLm9wdGlvbnMuYmVoYXZpb3JzXHJcbiAgICAgIH1cclxuICAgIH07XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBQbGF5IGFuIGF1ZGlvIHJlc291cmNlXHJcbiAgICovXHJcbiAgcGxheShyZXNvdXJjZTogQXVkaW9SZXNvdXJjZSk6IHZvaWQge1xyXG4gICAgLy8gU3RvcCBjdXJyZW50IHBsYXliYWNrXHJcbiAgICB0aGlzLnN0b3AoKTtcclxuICAgIFxyXG4gICAgdGhpcy5jdXJyZW50UmVzb3VyY2UgPSByZXNvdXJjZTtcclxuICAgIHRoaXMuc2V0U3RhdGUoeyBzdGF0dXM6IEF1ZGlvUGxheWVyU3RhdHVzLkJ1ZmZlcmluZywgcmVzb3VyY2UgfSk7XHJcbiAgICBcclxuICAgIC8vIFN0YXJ0IHBsYXliYWNrIGlmIHdlIGhhdmUgYSByZWFkeSBjb25uZWN0aW9uXHJcbiAgICBmb3IgKGNvbnN0IGNvbm5lY3Rpb24gb2YgdGhpcy5zdWJzY3JpcHRpb25zKSB7XHJcbiAgICAgIGlmIChjb25uZWN0aW9uLmdldFJvb20oKSkge1xyXG4gICAgICAgIHRoaXMuc3RhcnRQbGF5YmFjayhjb25uZWN0aW9uKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUGF1c2UgcGxheWJhY2tcclxuICAgKi9cclxuICBwYXVzZSgpOiBib29sZWFuIHtcclxuICAgIGlmICh0aGlzLnN0YXRlLnN0YXR1cyAhPT0gQXVkaW9QbGF5ZXJTdGF0dXMuUGxheWluZykge1xyXG4gICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcbiAgICB0aGlzLnNldFN0YXRlKHsgc3RhdHVzOiBBdWRpb1BsYXllclN0YXR1cy5QYXVzZWQsIHJlc291cmNlOiB0aGlzLmN1cnJlbnRSZXNvdXJjZSB9KTtcclxuICAgIHJldHVybiB0cnVlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVW5wYXVzZSBwbGF5YmFja1xyXG4gICAqL1xyXG4gIHVucGF1c2UoKTogYm9vbGVhbiB7XHJcbiAgICBpZiAodGhpcy5zdGF0ZS5zdGF0dXMgIT09IEF1ZGlvUGxheWVyU3RhdHVzLlBhdXNlZCkge1xyXG4gICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcbiAgICB0aGlzLnNldFN0YXRlKHsgc3RhdHVzOiBBdWRpb1BsYXllclN0YXR1cy5QbGF5aW5nLCByZXNvdXJjZTogdGhpcy5jdXJyZW50UmVzb3VyY2UgfSk7XHJcbiAgICByZXR1cm4gdHJ1ZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFN0b3AgcGxheWJhY2tcclxuICAgKi9cclxuICBzdG9wKGZvcmNlID0gZmFsc2UpOiBib29sZWFuIHtcclxuICAgIGlmICh0aGlzLnN0YXRlLnN0YXR1cyA9PT0gQXVkaW9QbGF5ZXJTdGF0dXMuSWRsZSAmJiAhZm9yY2UpIHtcclxuICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG4gICAgdGhpcy5jbGVhbnVwKCk7XHJcbiAgICB0aGlzLmN1cnJlbnRSZXNvdXJjZSA9IG51bGw7XHJcbiAgICB0aGlzLnNldFN0YXRlKHsgc3RhdHVzOiBBdWRpb1BsYXllclN0YXR1cy5JZGxlIH0pO1xyXG4gICAgcmV0dXJuIHRydWU7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTdWJzY3JpYmUgYSB2b2ljZSBjb25uZWN0aW9uIHRvIHRoaXMgcGxheWVyXHJcbiAgICogQGludGVybmFsXHJcbiAgICovXHJcbiAgc3Vic2NyaWJlKGNvbm5lY3Rpb246IFZvaWNlQ29ubmVjdGlvbik6IHZvaWQge1xyXG4gICAgdGhpcy5zdWJzY3JpcHRpb25zLmFkZChjb25uZWN0aW9uKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFVuc3Vic2NyaWJlIGEgdm9pY2UgY29ubmVjdGlvbiBmcm9tIHRoaXMgcGxheWVyXHJcbiAgICogQGludGVybmFsXHJcbiAgICovXHJcbiAgdW5zdWJzY3JpYmUoY29ubmVjdGlvbjogVm9pY2VDb25uZWN0aW9uKTogdm9pZCB7XHJcbiAgICB0aGlzLnN1YnNjcmlwdGlvbnMuZGVsZXRlKGNvbm5lY3Rpb24pO1xyXG4gICAgXHJcbiAgICAvLyBBdXRvLXBhdXNlIGlmIG5vIHN1YnNjcmliZXJzXHJcbiAgICBpZiAodGhpcy5zdWJzY3JpcHRpb25zLnNpemUgPT09IDAgJiYgdGhpcy5vcHRpb25zLmJlaGF2aW9ycz8ubm9TdWJzY3JpYmVyID09PSAncGF1c2UnKSB7XHJcbiAgICAgIGlmICh0aGlzLnN0YXRlLnN0YXR1cyA9PT0gQXVkaW9QbGF5ZXJTdGF0dXMuUGxheWluZykge1xyXG4gICAgICAgIHRoaXMuc2V0U3RhdGUoeyBzdGF0dXM6IEF1ZGlvUGxheWVyU3RhdHVzLkF1dG9QYXVzZWQsIHJlc291cmNlOiB0aGlzLmN1cnJlbnRSZXNvdXJjZSB9KTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2FsbGVkIHdoZW4gYSBjb25uZWN0aW9uIGJlY29tZXMgcmVhZHlcclxuICAgKiBAaW50ZXJuYWxcclxuICAgKi9cclxuICBvbkNvbm5lY3Rpb25SZWFkeShjb25uZWN0aW9uOiBWb2ljZUNvbm5lY3Rpb24pOiB2b2lkIHtcclxuICAgIC8vIElmIHdlIGhhdmUgYSByZXNvdXJjZSB3YWl0aW5nLCBzdGFydCBwbGF5YmFja1xyXG4gICAgaWYgKHRoaXMuY3VycmVudFJlc291cmNlICYmIHRoaXMuc3RhdGUuc3RhdHVzID09PSBBdWRpb1BsYXllclN0YXR1cy5CdWZmZXJpbmcpIHtcclxuICAgICAgdGhpcy5zdGFydFBsYXliYWNrKGNvbm5lY3Rpb24pO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhc3luYyBzdGFydFBsYXliYWNrKGNvbm5lY3Rpb246IFZvaWNlQ29ubmVjdGlvbik6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3Qgcm9vbSA9IGNvbm5lY3Rpb24uZ2V0Um9vbSgpO1xyXG4gICAgaWYgKCFyb29tIHx8ICF0aGlzLmN1cnJlbnRSZXNvdXJjZSkgcmV0dXJuO1xyXG5cclxuICAgIHRyeSB7XHJcbiAgICAgIC8vIENyZWF0ZSBhdWRpbyBzb3VyY2UgYW5kIHRyYWNrXHJcbiAgICAgIGF3YWl0IHRoaXMuc2V0dXBBdWRpb1RyYWNrKHJvb20pO1xyXG4gICAgICBcclxuICAgICAgLy8gU3RhcnQgRkZtcGVnIHRvIGRlY29kZSBhdWRpbyAtIHRoaXMgd2lsbCBzZXQgc3RhdGUgdG8gUGxheWluZyB3aGVuIHJlYWR5XHJcbiAgICAgIGF3YWl0IHRoaXMuc3RhcnRGRm1wZWcoKTtcclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCB7IG1lc3NhZ2U6IChlcnJvciBhcyBFcnJvcikubWVzc2FnZSwgcmVzb3VyY2U6IHRoaXMuY3VycmVudFJlc291cmNlIH0pO1xyXG4gICAgICB0aGlzLnN0b3AoKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgYXN5bmMgc2V0dXBBdWRpb1RyYWNrKHJvb206IFJvb20pOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGlmICh0aGlzLmlzUHVibGlzaGVkKSByZXR1cm47XHJcbiAgICBcclxuICAgIHRoaXMuYXVkaW9Tb3VyY2UgPSBuZXcgQXVkaW9Tb3VyY2UoU0FNUExFX1JBVEUsIENIQU5ORUxTKTtcclxuICAgIHRoaXMuYXVkaW9UcmFjayA9IExvY2FsQXVkaW9UcmFjay5jcmVhdGVBdWRpb1RyYWNrKCdtdXNpYycsIHRoaXMuYXVkaW9Tb3VyY2UpO1xyXG4gICAgXHJcbiAgICBjb25zdCBvcHRpb25zID0gbmV3IFRyYWNrUHVibGlzaE9wdGlvbnMoKTtcclxuICAgIG9wdGlvbnMuc291cmNlID0gVHJhY2tTb3VyY2UuU09VUkNFX01JQ1JPUEhPTkU7XHJcbiAgICBcclxuICAgIGlmIChyb29tLmxvY2FsUGFydGljaXBhbnQpIHtcclxuICAgICAgYXdhaXQgcm9vbS5sb2NhbFBhcnRpY2lwYW50LnB1Ymxpc2hUcmFjayh0aGlzLmF1ZGlvVHJhY2ssIG9wdGlvbnMpO1xyXG4gICAgfVxyXG4gICAgdGhpcy5pc1B1Ymxpc2hlZCA9IHRydWU7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFzeW5jIHN0YXJ0RkZtcGVnKCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgaWYgKCF0aGlzLmN1cnJlbnRSZXNvdXJjZSkgcmV0dXJuO1xyXG4gICAgXHJcbiAgICBsZXQgaW5wdXRTb3VyY2UgPSB0aGlzLmN1cnJlbnRSZXNvdXJjZS5nZXRJbnB1dFNvdXJjZSgpO1xyXG4gICAgY29uc29sZS5sb2coYEZGbXBlZyBpbnB1dCBzb3VyY2U6ICR7aW5wdXRTb3VyY2Uuc3Vic3RyaW5nKDAsIDEwMCl9Li4uYCk7XHJcbiAgICBcclxuICAgIC8vIENoZWNrIGlmIGlucHV0IGlzIGEgVVJMIG9yIHNlYXJjaCBxdWVyeVxyXG4gICAgY29uc3QgaXNVcmwgPSBpbnB1dFNvdXJjZS5zdGFydHNXaXRoKCdodHRwOi8vJykgfHwgXHJcbiAgICAgICAgICAgICAgICAgIGlucHV0U291cmNlLnN0YXJ0c1dpdGgoJ2h0dHBzOi8vJykgfHwgXHJcbiAgICAgICAgICAgICAgICAgIGlucHV0U291cmNlLnN0YXJ0c1dpdGgoJ3l0c2VhcmNoOicpO1xyXG4gICAgXHJcbiAgICAvLyBJZiBub3QgYSBVUkwsIHRyZWF0IGFzIFlvdVR1YmUgc2VhcmNoXHJcbiAgICBpZiAoIWlzVXJsKSB7XHJcbiAgICAgIGlucHV0U291cmNlID0gYHl0c2VhcmNoMToke2lucHV0U291cmNlfWA7XHJcbiAgICAgIGNvbnNvbGUubG9nKGBDb252ZXJ0ZWQgdG8gWW91VHViZSBzZWFyY2g6ICR7aW5wdXRTb3VyY2V9YCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIENoZWNrIGlmIHRoaXMgaXMgYSBzdHJlYW1pbmcgVVJMIHRoYXQgbmVlZHMgeXQtZGxwXHJcbiAgICBjb25zdCBuZWVkc1l0RGxwID0gaW5wdXRTb3VyY2UuaW5jbHVkZXMoJ3lvdXR1YmUuY29tJykgfHwgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgaW5wdXRTb3VyY2UuaW5jbHVkZXMoJ3lvdXR1LmJlJykgfHxcclxuICAgICAgICAgICAgICAgICAgICAgICBpbnB1dFNvdXJjZS5pbmNsdWRlcygnc291bmRjbG91ZC5jb20nKSB8fFxyXG4gICAgICAgICAgICAgICAgICAgICAgIGlucHV0U291cmNlLmluY2x1ZGVzKCd0d2l0Y2gudHYnKSB8fFxyXG4gICAgICAgICAgICAgICAgICAgICAgIGlucHV0U291cmNlLnN0YXJ0c1dpdGgoJ3l0c2VhcmNoJyk7XHJcbiAgICBcclxuICAgIGlmIChuZWVkc1l0RGxwKSB7XHJcbiAgICAgIC8vIFVzZSB5dC1kbHAgdG8gcGlwZSBhdWRpbyBkaXJlY3RseSB0byBGRm1wZWdcclxuICAgICAgY29uc29sZS5sb2coJ1VzaW5nIHl0LWRscCBwaXBlIG1vZGUnKTtcclxuICAgICAgXHJcbiAgICAgIC8vIERldGVjdCBwbGF0Zm9ybVxyXG4gICAgICBjb25zdCBpc1dpbmRvd3MgPSBwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInO1xyXG4gICAgICBjb25zdCB5dERscFBhdGggPSBpc1dpbmRvd3MgPyAneXQtZGxwJyA6ICd+Ly5sb2NhbC9iaW4veXQtZGxwJztcclxuICAgICAgXHJcbiAgICAgIC8vIE9uIFdpbmRvd3Mgd2l0aCBzaGVsbCBtb2RlLCB3ZSBuZWVkIHRvIHVzZSBhIHNpbmdsZSBjb21tYW5kIHN0cmluZ1xyXG4gICAgICAvLyB0byBwcmVzZXJ2ZSBzcGFjZXMgaW4gdGhlIHNlYXJjaCBxdWVyeVxyXG4gICAgICBpZiAoaXNXaW5kb3dzKSB7XHJcbiAgICAgICAgLy8gQnVpbGQgY29tbWFuZCBhcyBzaW5nbGUgc3RyaW5nIHdpdGggcHJvcGVyIHF1b3RpbmdcclxuICAgICAgICBjb25zdCB5dGRscENtZCA9IGAke3l0RGxwUGF0aH0gLWYgYmVzdGF1ZGlvL2Jlc3QgLW8gLSAtLW5vLXBsYXlsaXN0IC0tbm8td2FybmluZ3MgLS1kZWZhdWx0LXNlYXJjaCB5dHNlYXJjaCBcIiR7aW5wdXRTb3VyY2V9XCJgO1xyXG4gICAgICAgIGNvbnN0IGZmbXBlZ0NtZCA9IGBmZm1wZWcgLWkgcGlwZTowIC1mIHMxNmxlIC1hciAke1NBTVBMRV9SQVRFfSAtYWMgJHtDSEFOTkVMU30gLWFjb2RlYyBwY21fczE2bGUgLWA7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gU3Bhd24geXQtZGxwIHdpdGggc2hlbGwgY29tbWFuZFxyXG4gICAgICAgIGNvbnN0IHl0ZGxwUHJvY2VzcyA9IHNwYXduKHl0ZGxwQ21kLCBbXSwgeyBcclxuICAgICAgICAgIHN0ZGlvOiBbJ3BpcGUnLCAncGlwZScsICdwaXBlJ10sXHJcbiAgICAgICAgICBzaGVsbDogdHJ1ZVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIFNwYXduIGZmbXBlZyB3aXRoIHNoZWxsIGNvbW1hbmRcclxuICAgICAgICB0aGlzLmZmbXBlZ1Byb2Nlc3MgPSBzcGF3bihmZm1wZWdDbWQsIFtdLCB7IFxyXG4gICAgICAgICAgc3RkaW86IFsncGlwZScsICdwaXBlJywgJ3BpcGUnXSxcclxuICAgICAgICAgIHNoZWxsOiB0cnVlXHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gUGlwZSB5dC1kbHAgc3Rkb3V0IHRvIGZmbXBlZyBzdGRpblxyXG4gICAgICAgIHl0ZGxwUHJvY2Vzcy5zdGRvdXQ/LnBpcGUodGhpcy5mZm1wZWdQcm9jZXNzLnN0ZGluISk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gSGFuZGxlIHl0LWRscCBlcnJvcnNcclxuICAgICAgICB5dGRscFByb2Nlc3Muc3RkZXJyPy5vbignZGF0YScsIChkYXRhOiBCdWZmZXIpID0+IHtcclxuICAgICAgICAgIGNvbnN0IG1zZyA9IGRhdGEudG9TdHJpbmcoKTtcclxuICAgICAgICAgIGlmIChtc2cuaW5jbHVkZXMoJ0VSUk9SJykpIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcigneXQtZGxwIGVycm9yOicsIG1zZyk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgeXRkbHBQcm9jZXNzLm9uKCdlcnJvcicsIChlcnIpID0+IHtcclxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ3l0LWRscCBwcm9jZXNzIGVycm9yOicsIGVyci5tZXNzYWdlKTtcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICB5dGRscFByb2Nlc3Mub24oJ2Nsb3NlJywgKGNvZGUpID0+IHtcclxuICAgICAgICAgIGlmIChjb2RlICE9PSAwKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYHl0LWRscCBleGl0ZWQgd2l0aCBjb2RlICR7Y29kZX1gKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICAvLyBVbml4OiB1c2UgYXJncyBhcnJheSAobm8gc2hlbGwgbmVlZGVkKVxyXG4gICAgICAgIGNvbnN0IHl0ZGxwQXJncyA9IFtcclxuICAgICAgICAgICctZicsICdiZXN0YXVkaW8vYmVzdCcsXHJcbiAgICAgICAgICAnLW8nLCAnLScsXHJcbiAgICAgICAgICAnLS1uby1wbGF5bGlzdCcsXHJcbiAgICAgICAgICAnLS1uby13YXJuaW5ncycsXHJcbiAgICAgICAgICAnLS1kZWZhdWx0LXNlYXJjaCcsICd5dHNlYXJjaCcsXHJcbiAgICAgICAgICBpbnB1dFNvdXJjZVxyXG4gICAgICAgIF07XHJcbiAgICAgICAgXHJcbiAgICAgICAgY29uc3QgZmZtcGVnQXJncyA9IFtcclxuICAgICAgICAgICctaScsICdwaXBlOjAnLFxyXG4gICAgICAgICAgJy1mJywgJ3MxNmxlJyxcclxuICAgICAgICAgICctYXInLCBTdHJpbmcoU0FNUExFX1JBVEUpLFxyXG4gICAgICAgICAgJy1hYycsIFN0cmluZyhDSEFOTkVMUyksXHJcbiAgICAgICAgICAnLWFjb2RlYycsICdwY21fczE2bGUnLFxyXG4gICAgICAgICAgJy0nXHJcbiAgICAgICAgXTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBTcGF3biB5dC1kbHBcclxuICAgICAgICBjb25zdCB5dGRscFByb2Nlc3MgPSBzcGF3bih5dERscFBhdGgsIHl0ZGxwQXJncywgeyBcclxuICAgICAgICAgIHN0ZGlvOiBbJ3BpcGUnLCAncGlwZScsICdwaXBlJ10sXHJcbiAgICAgICAgICBzaGVsbDogZmFsc2VcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBTcGF3biBmZm1wZWdcclxuICAgICAgICB0aGlzLmZmbXBlZ1Byb2Nlc3MgPSBzcGF3bignZmZtcGVnJywgZmZtcGVnQXJncywgeyBcclxuICAgICAgICAgIHN0ZGlvOiBbJ3BpcGUnLCAncGlwZScsICdwaXBlJ10sXHJcbiAgICAgICAgICBzaGVsbDogZmFsc2VcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBQaXBlIHl0LWRscCBzdGRvdXQgdG8gZmZtcGVnIHN0ZGluXHJcbiAgICAgICAgeXRkbHBQcm9jZXNzLnN0ZG91dD8ucGlwZSh0aGlzLmZmbXBlZ1Byb2Nlc3Muc3RkaW4hKTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBIYW5kbGUgeXQtZGxwIGVycm9yc1xyXG4gICAgICAgIHl0ZGxwUHJvY2Vzcy5zdGRlcnI/Lm9uKCdkYXRhJywgKGRhdGE6IEJ1ZmZlcikgPT4ge1xyXG4gICAgICAgICAgY29uc3QgbXNnID0gZGF0YS50b1N0cmluZygpO1xyXG4gICAgICAgICAgaWYgKG1zZy5pbmNsdWRlcygnRVJST1InKSkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCd5dC1kbHAgZXJyb3I6JywgbXNnKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICB5dGRscFByb2Nlc3Mub24oJ2Vycm9yJywgKGVycikgPT4ge1xyXG4gICAgICAgICAgY29uc29sZS5lcnJvcigneXQtZGxwIHByb2Nlc3MgZXJyb3I6JywgZXJyLm1lc3NhZ2UpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHl0ZGxwUHJvY2Vzcy5vbignY2xvc2UnLCAoY29kZSkgPT4ge1xyXG4gICAgICAgICAgaWYgKGNvZGUgIT09IDApIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcihgeXQtZGxwIGV4aXRlZCB3aXRoIGNvZGUgJHtjb2RlfWApO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICB9XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBjb25zb2xlLmxvZygnVXNpbmcgZGlyZWN0IEZGbXBlZyBtb2RlJyk7XHJcbiAgICAgIHRoaXMuZmZtcGVnUHJvY2VzcyA9IHNwYXduKCdmZm1wZWcnLCBbXHJcbiAgICAgICAgJy1yZWNvbm5lY3QnLCAnMScsXHJcbiAgICAgICAgJy1yZWNvbm5lY3Rfc3RyZWFtZWQnLCAnMScsXHJcbiAgICAgICAgJy1yZWNvbm5lY3RfZGVsYXlfbWF4JywgJzUnLFxyXG4gICAgICAgICctaScsIGlucHV0U291cmNlLFxyXG4gICAgICAgICctZicsICdzMTZsZScsXHJcbiAgICAgICAgJy1hcicsIFN0cmluZyhTQU1QTEVfUkFURSksXHJcbiAgICAgICAgJy1hYycsIFN0cmluZyhDSEFOTkVMUyksXHJcbiAgICAgICAgJy1hY29kZWMnLCAncGNtX3MxNmxlJyxcclxuICAgICAgICAnLSdcclxuICAgICAgXSwgeyBzdGRpbzogWydwaXBlJywgJ3BpcGUnLCAncGlwZSddIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGZyYW1lU2l6ZSA9IFNBTVBMRVNfUEVSX0ZSQU1FICogQ0hBTk5FTFMgKiAyO1xyXG4gICAgdGhpcy5mZm1wZWdEb25lID0gZmFsc2U7XHJcbiAgICBsZXQgaGFzUmVjZWl2ZWREYXRhID0gZmFsc2U7XHJcblxyXG4gICAgdGhpcy5mZm1wZWdQcm9jZXNzLnN0ZG91dD8ub24oJ2RhdGEnLCAoY2h1bms6IEJ1ZmZlcikgPT4ge1xyXG4gICAgICBpZiAodGhpcy5zdGF0ZS5zdGF0dXMgIT09IEF1ZGlvUGxheWVyU3RhdHVzLlBsYXlpbmcgJiYgXHJcbiAgICAgICAgICB0aGlzLnN0YXRlLnN0YXR1cyAhPT0gQXVkaW9QbGF5ZXJTdGF0dXMuQnVmZmVyaW5nKSByZXR1cm47XHJcbiAgICAgIFxyXG4gICAgICBoYXNSZWNlaXZlZERhdGEgPSB0cnVlO1xyXG4gICAgICBcclxuICAgICAgLy8gSGFuZGxlIGxlZnRvdmVyIGZyb20gcHJldmlvdXMgY2h1bmtcclxuICAgICAgaWYgKHRoaXMubGVmdG92ZXJCdWZmZXIgJiYgdGhpcy5sZWZ0b3ZlckJ1ZmZlci5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgY2h1bmsgPSBCdWZmZXIuY29uY2F0KFt0aGlzLmxlZnRvdmVyQnVmZmVyLCBjaHVua10pO1xyXG4gICAgICAgIHRoaXMubGVmdG92ZXJCdWZmZXIgPSBudWxsO1xyXG4gICAgICB9XHJcbiAgICAgIFxyXG4gICAgICBsZXQgb2Zmc2V0ID0gMDtcclxuICAgICAgd2hpbGUgKG9mZnNldCArIGZyYW1lU2l6ZSA8PSBjaHVuay5sZW5ndGgpIHtcclxuICAgICAgICBjb25zdCBmcmFtZSA9IGNodW5rLnNsaWNlKG9mZnNldCwgb2Zmc2V0ICsgZnJhbWVTaXplKTtcclxuICAgICAgICBjb25zdCBpbnQxNkFycmF5ID0gbmV3IEludDE2QXJyYXkoU0FNUExFU19QRVJfRlJBTUUgKiBDSEFOTkVMUyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBpbnQxNkFycmF5Lmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICBpbnQxNkFycmF5W2ldID0gZnJhbWUucmVhZEludDE2TEUoaSAqIDIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICB0aGlzLmZyYW1lUXVldWUucHVzaChpbnQxNkFycmF5KTtcclxuICAgICAgICBvZmZzZXQgKz0gZnJhbWVTaXplO1xyXG4gICAgICB9XHJcbiAgICAgIFxyXG4gICAgICAvLyBTYXZlIGxlZnRvdmVyXHJcbiAgICAgIGlmIChvZmZzZXQgPCBjaHVuay5sZW5ndGgpIHtcclxuICAgICAgICB0aGlzLmxlZnRvdmVyQnVmZmVyID0gY2h1bmsuc2xpY2Uob2Zmc2V0KTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgbGV0IHN0ZGVyck91dHB1dCA9ICcnO1xyXG4gICAgdGhpcy5mZm1wZWdQcm9jZXNzLnN0ZGVycj8ub24oJ2RhdGEnLCAoZGF0YTogQnVmZmVyKSA9PiB7XHJcbiAgICAgIHN0ZGVyck91dHB1dCArPSBkYXRhLnRvU3RyaW5nKCk7XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLmZmbXBlZ1Byb2Nlc3Mub24oJ2Nsb3NlJywgKGNvZGUpID0+IHtcclxuICAgICAgdGhpcy5mZm1wZWdEb25lID0gdHJ1ZTtcclxuICAgICAgdGhpcy5mZm1wZWdQcm9jZXNzID0gbnVsbDtcclxuICAgICAgaWYgKGNvZGUgIT09IDApIHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKGBGRm1wZWcgc3RkZXJyOlxcbiR7c3RkZXJyT3V0cHV0fWApO1xyXG4gICAgICB9XHJcbiAgICAgIGNvbnNvbGUubG9nKGBbQXVkaW9QbGF5ZXJdIEZGbXBlZyBjbG9zZWQgd2l0aCBjb2RlICR7Y29kZX0sIGhhc1JlY2VpdmVkRGF0YTogJHtoYXNSZWNlaXZlZERhdGF9LCBxdWV1ZTogJHt0aGlzLmZyYW1lUXVldWUubGVuZ3RofWApO1xyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5mZm1wZWdQcm9jZXNzLm9uKCdlcnJvcicsIChlcnIpID0+IHtcclxuICAgICAgY29uc29sZS5lcnJvcignRkZtcGVnIHByb2Nlc3MgZXJyb3I6JywgZXJyLm1lc3NhZ2UpO1xyXG4gICAgICB0aGlzLmVtaXQoJ2Vycm9yJywgeyBtZXNzYWdlOiBlcnIubWVzc2FnZSwgcmVzb3VyY2U6IHRoaXMuY3VycmVudFJlc291cmNlIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gV2FpdCBmb3IgaW5pdGlhbCBidWZmZXIgd2l0aCB0aW1lb3V0XHJcbiAgICBjb25zdCBidWZmZXJUaW1lb3V0ID0gMTAwMDA7IC8vIDEwIHNlY29uZHMgZm9yIGluaXRpYWwgYnVmZmVyXHJcbiAgICBjb25zdCBzdGFydFRpbWUgPSBEYXRlLm5vdygpO1xyXG4gICAgXHJcbiAgICB3aGlsZSAodGhpcy5mcmFtZVF1ZXVlLmxlbmd0aCA8IE1JTl9CVUZGRVJfRlJBTUVTICYmIERhdGUubm93KCkgLSBzdGFydFRpbWUgPCBidWZmZXJUaW1lb3V0KSB7XHJcbiAgICAgIGF3YWl0IG5ldyBQcm9taXNlKHIgPT4gc2V0VGltZW91dChyLCAxMDApKTtcclxuICAgICAgXHJcbiAgICAgIC8vIENoZWNrIGlmIEZGbXBlZyBmYWlsZWQgZWFybHlcclxuICAgICAgaWYgKHRoaXMuZmZtcGVnRG9uZSAmJiB0aGlzLmZyYW1lUXVldWUubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdGRm1wZWcgZmFpbGVkIHRvIHByb2R1Y2UgYXVkaW8gZGF0YScpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGlmICh0aGlzLmZyYW1lUXVldWUubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcignVGltZW91dCB3YWl0aW5nIGZvciBhdWRpbyBkYXRhJyk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGNvbnNvbGUubG9nKGBbQXVkaW9QbGF5ZXJdIFN0YXJ0aW5nIHBsYXliYWNrIHdpdGggJHt0aGlzLmZyYW1lUXVldWUubGVuZ3RofSBmcmFtZXMgYnVmZmVyZWQgKHRhcmdldDogJHtUQVJHRVRfQlVGRkVSX0ZSQU1FU30pYCk7XHJcblxyXG4gICAgLy8gTWFyayByZWFkeSBmb3IgcGxheWJhY2sgLSBzZXRTdGF0ZSB3aWxsIHRyaWdnZXIgdGhlIGxvb3BcclxuICAgIHRoaXMuaXNQbGF5YmFja0xvb3BSdW5uaW5nID0gdHJ1ZTtcclxuICAgIHRoaXMubmV4dEZyYW1lVGltZSA9IGhydGltZS5iaWdpbnQoKTtcclxuICAgIGNvbnNvbGUubG9nKGBbQXVkaW9QbGF5ZXJdIFBsYXliYWNrIHJlYWR5LCBhdWRpb1NvdXJjZSBleGlzdHM6ICR7ISF0aGlzLmF1ZGlvU291cmNlfWApO1xyXG4gICAgXHJcbiAgICAvLyBTZXQgc3RhdGUgdG8gcGxheWluZyAtIHRoaXMgd2lsbCB0cmlnZ2VyIHNjaGVkdWxlTmV4dEZyYW1lIHZpYSBzZXRTdGF0ZVxyXG4gICAgdGhpcy5zZXRTdGF0ZSh7IHN0YXR1czogQXVkaW9QbGF5ZXJTdGF0dXMuUGxheWluZywgcmVzb3VyY2U6IHRoaXMuY3VycmVudFJlc291cmNlIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSGlnaC1yZXNvbHV0aW9uIGZyYW1lIHNjaGVkdWxpbmcgdXNpbmcgaHJ0aW1lXHJcbiAgICogVGhpcyBwcm92aWRlcyBtdWNoIG1vcmUgYWNjdXJhdGUgdGltaW5nIHRoYW4gc2V0SW50ZXJ2YWxcclxuICAgKi9cclxuICBwcml2YXRlIHNjaGVkdWxlTmV4dEZyYW1lKCk6IHZvaWQge1xyXG4gICAgaWYgKCF0aGlzLmlzUGxheWJhY2tMb29wUnVubmluZyB8fCB0aGlzLnN0YXRlLnN0YXR1cyAhPT0gQXVkaW9QbGF5ZXJTdGF0dXMuUGxheWluZykge1xyXG4gICAgICBjb25zb2xlLmxvZyhgW0F1ZGlvUGxheWVyXSBzY2hlZHVsZU5leHRGcmFtZSBza2lwcGVkOiBsb29wUnVubmluZz0ke3RoaXMuaXNQbGF5YmFja0xvb3BSdW5uaW5nfSwgc3RhdHVzPSR7dGhpcy5zdGF0ZS5zdGF0dXN9YCk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBub3cgPSBocnRpbWUuYmlnaW50KCk7XHJcbiAgICBjb25zdCBkZWxheU5zID0gdGhpcy5uZXh0RnJhbWVUaW1lIC0gbm93O1xyXG4gICAgY29uc3QgZGVsYXlNcyA9IE51bWJlcihkZWxheU5zKSAvIDFfMDAwXzAwMDtcclxuXHJcbiAgICBpZiAodGhpcy5mcmFtZXNQbGF5ZWQgPT09IDApIHtcclxuICAgICAgY29uc29sZS5sb2coYFtBdWRpb1BsYXllcl0gRmlyc3QgZnJhbWUgc2NoZWR1bGluZzogZGVsYXlNcz0ke2RlbGF5TXMudG9GaXhlZCgyKX1gKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBTY2hlZHVsZSBuZXh0IGZyYW1lXHJcbiAgICBpZiAoZGVsYXlNcyA+IDEpIHtcclxuICAgICAgdGhpcy5wbGF5YmFja1RpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHRoaXMucHJvY2Vzc0ZyYW1lKCksIE1hdGgubWF4KDEsIGRlbGF5TXMgLSAxKSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAvLyBXZSdyZSBiZWhpbmQsIHByb2Nlc3MgaW1tZWRpYXRlbHlcclxuICAgICAgc2V0SW1tZWRpYXRlKCgpID0+IHRoaXMucHJvY2Vzc0ZyYW1lKCkpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUHJvY2VzcyBhbmQgc2VuZCBhIHNpbmdsZSBhdWRpbyBmcmFtZVxyXG4gICAqL1xyXG4gIHByaXZhdGUgYXN5bmMgcHJvY2Vzc0ZyYW1lKCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgaWYgKCF0aGlzLmlzUGxheWJhY2tMb29wUnVubmluZyB8fCB0aGlzLnN0YXRlLnN0YXR1cyAhPT0gQXVkaW9QbGF5ZXJTdGF0dXMuUGxheWluZykge1xyXG4gICAgICBpZiAodGhpcy5mcmFtZXNQbGF5ZWQgPT09IDApIHtcclxuICAgICAgICBjb25zb2xlLmxvZyhgW0F1ZGlvUGxheWVyXSBwcm9jZXNzRnJhbWUgc2tpcHBlZDogbG9vcFJ1bm5pbmc9JHt0aGlzLmlzUGxheWJhY2tMb29wUnVubmluZ30sIHN0YXR1cz0ke3RoaXMuc3RhdGUuc3RhdHVzfWApO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICAvLyBDaGVjayBidWZmZXIgc3RhdHVzXHJcbiAgICBjb25zdCBidWZmZXJTaXplID0gdGhpcy5mcmFtZVF1ZXVlLmxlbmd0aDtcclxuICAgIFxyXG4gICAgaWYgKGJ1ZmZlclNpemUgPiAwICYmIHRoaXMuYXVkaW9Tb3VyY2UpIHtcclxuICAgICAgY29uc3QgaW50MTZBcnJheSA9IHRoaXMuZnJhbWVRdWV1ZS5zaGlmdCgpITtcclxuICAgICAgY29uc3QgYXVkaW9GcmFtZSA9IG5ldyBBdWRpb0ZyYW1lKGludDE2QXJyYXksIFNBTVBMRV9SQVRFLCBDSEFOTkVMUywgU0FNUExFU19QRVJfRlJBTUUpO1xyXG4gICAgICBcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBhd2FpdCB0aGlzLmF1ZGlvU291cmNlLmNhcHR1cmVGcmFtZShhdWRpb0ZyYW1lKTtcclxuICAgICAgICB0aGlzLmZyYW1lc1BsYXllZCsrO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIExvZyBwcm9ncmVzcyBldmVyeSA1MDAgZnJhbWVzICh+MTAgc2Vjb25kcylcclxuICAgICAgICBpZiAodGhpcy5mcmFtZXNQbGF5ZWQgJSA1MDAgPT09IDApIHtcclxuICAgICAgICAgIGNvbnNvbGUubG9nKGBbQXVkaW9QbGF5ZXJdIFByb2dyZXNzOiAke3RoaXMuZnJhbWVzUGxheWVkfSBmcmFtZXMgcGxheWVkLCBidWZmZXI6ICR7YnVmZmVyU2l6ZX1gKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKGBbQXVkaW9QbGF5ZXJdIEZyYW1lIGVycm9yOmAsIChlIGFzIEVycm9yKS5tZXNzYWdlKTtcclxuICAgICAgfVxyXG4gICAgICBcclxuICAgICAgLy8gVXBkYXRlIHRpbWluZyBmb3IgbmV4dCBmcmFtZVxyXG4gICAgICB0aGlzLm5leHRGcmFtZVRpbWUgKz0gRlJBTUVfSU5URVJWQUxfTlM7XHJcbiAgICAgIFxyXG4gICAgICAvLyBBZGFwdGl2ZSB0aW1pbmc6IGlmIGJ1ZmZlciBpcyBsb3csIHNsb3cgZG93biBzbGlnaHRseSB0byBsZXQgaXQgcmVjb3ZlclxyXG4gICAgICBpZiAoYnVmZmVyU2l6ZSA8IExPV19CVUZGRVJfVEhSRVNIT0xEICYmICF0aGlzLmZmbXBlZ0RvbmUpIHtcclxuICAgICAgICAvLyBBZGQgMW1zIGRlbGF5IHRvIGxldCBidWZmZXIgcmVjb3ZlclxyXG4gICAgICAgIHRoaXMubmV4dEZyYW1lVGltZSArPSBCaWdJbnQoMV8wMDBfMDAwKTtcclxuICAgICAgICB0aGlzLmJ1ZmZlclVuZGVycnVucysrO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmICh0aGlzLmJ1ZmZlclVuZGVycnVucyAlIDUwID09PSAwKSB7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW0F1ZGlvUGxheWVyXSBCdWZmZXIgbG93OiAke2J1ZmZlclNpemV9IGZyYW1lcywgJHt0aGlzLmJ1ZmZlclVuZGVycnVuc30gdW5kZXJydW5zYCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIFxyXG4gICAgICAvLyBTY2hlZHVsZSBuZXh0IGZyYW1lXHJcbiAgICAgIHRoaXMuc2NoZWR1bGVOZXh0RnJhbWUoKTtcclxuICAgICAgXHJcbiAgICB9IGVsc2UgaWYgKHRoaXMuZmZtcGVnRG9uZSAmJiBidWZmZXJTaXplID09PSAwKSB7XHJcbiAgICAgIC8vIFBsYXliYWNrIGZpbmlzaGVkXHJcbiAgICAgIGNvbnNvbGUubG9nKCdbQXVkaW9QbGF5ZXJdIFBsYXliYWNrIGZpbmlzaGVkIC0gcXVldWUgZW1wdHkgYW5kIEZGbXBlZyBkb25lJyk7XHJcbiAgICAgIHRoaXMuc3RvcCgpO1xyXG4gICAgfSBlbHNlIGlmIChidWZmZXJTaXplID09PSAwKSB7XHJcbiAgICAgIC8vIEJ1ZmZlciB1bmRlcnJ1biAtIHdhaXQgZm9yIG1vcmUgZGF0YVxyXG4gICAgICB0aGlzLmJ1ZmZlclVuZGVycnVucysrO1xyXG4gICAgICBjb25zb2xlLmxvZyhgW0F1ZGlvUGxheWVyXSBCdWZmZXIgdW5kZXJydW4gIyR7dGhpcy5idWZmZXJVbmRlcnJ1bnN9LCB3YWl0aW5nIGZvciBkYXRhLi4uYCk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBXYWl0IGEgYml0IGFuZCB0cnkgYWdhaW5cclxuICAgICAgdGhpcy5uZXh0RnJhbWVUaW1lID0gaHJ0aW1lLmJpZ2ludCgpICsgQmlnSW50KDUwXzAwMF8wMDApOyAvLyA1MG1zXHJcbiAgICAgIHRoaXMuc2NoZWR1bGVOZXh0RnJhbWUoKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgY2xlYW51cCgpOiB2b2lkIHtcclxuICAgIC8vIFN0b3AgcGxheWJhY2sgbG9vcFxyXG4gICAgdGhpcy5pc1BsYXliYWNrTG9vcFJ1bm5pbmcgPSBmYWxzZTtcclxuICAgIGlmICh0aGlzLnBsYXliYWNrVGltZW91dCkge1xyXG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5wbGF5YmFja1RpbWVvdXQpO1xyXG4gICAgICB0aGlzLnBsYXliYWNrVGltZW91dCA9IG51bGw7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIEtpbGwgRkZtcGVnXHJcbiAgICBpZiAodGhpcy5mZm1wZWdQcm9jZXNzKSB7XHJcbiAgICAgIHRoaXMuZmZtcGVnUHJvY2Vzcy5raWxsKCdTSUdLSUxMJyk7XHJcbiAgICAgIHRoaXMuZmZtcGVnUHJvY2VzcyA9IG51bGw7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIENsZWFyIGZyYW1lIHF1ZXVlXHJcbiAgICB0aGlzLmZyYW1lUXVldWUgPSBbXTtcclxuICAgIHRoaXMubGVmdG92ZXJCdWZmZXIgPSBudWxsO1xyXG4gICAgXHJcbiAgICAvLyBSZXNldCB0aW1pbmcgYW5kIHN0YXRlXHJcbiAgICB0aGlzLm5leHRGcmFtZVRpbWUgPSBCaWdJbnQoMCk7XHJcbiAgICB0aGlzLmZmbXBlZ0RvbmUgPSBmYWxzZTtcclxuICAgIFxyXG4gICAgLy8gTG9nIHN0YXRzXHJcbiAgICBpZiAodGhpcy5mcmFtZXNQbGF5ZWQgPiAwKSB7XHJcbiAgICAgIGNvbnNvbGUubG9nKGBbQXVkaW9QbGF5ZXJdIFBsYXliYWNrIHN0YXRzOiAke3RoaXMuZnJhbWVzUGxheWVkfSBmcmFtZXMsICR7dGhpcy5idWZmZXJVbmRlcnJ1bnN9IHVuZGVycnVuc2ApO1xyXG4gICAgfVxyXG4gICAgdGhpcy5idWZmZXJVbmRlcnJ1bnMgPSAwO1xyXG4gICAgdGhpcy5mcmFtZXNQbGF5ZWQgPSAwO1xyXG4gICAgXHJcbiAgICAvLyBOb3RlOiBXZSBkb24ndCB1bnB1Ymxpc2ggdGhlIHRyYWNrIC0gaXQgc3RheXMgcHVibGlzaGVkIGZvciBuZXh0IHBsYXlcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc2V0U3RhdGUobmV3U3RhdGU6IEF1ZGlvUGxheWVyU3RhdGUpOiB2b2lkIHtcclxuICAgIGNvbnN0IG9sZFN0YXRlID0gdGhpcy5zdGF0ZTtcclxuICAgIHRoaXMuc3RhdGUgPSBuZXdTdGF0ZTtcclxuICAgIHRoaXMuZW1pdCgnc3RhdGVDaGFuZ2UnLCBvbGRTdGF0ZSwgbmV3U3RhdGUpO1xyXG4gICAgXHJcbiAgICAvLyBTdGFydCBwbGF5YmFjayBsb29wIHdoZW4gdHJhbnNpdGlvbmluZyB0byBQbGF5aW5nXHJcbiAgICBpZiAobmV3U3RhdGUuc3RhdHVzID09PSBBdWRpb1BsYXllclN0YXR1cy5QbGF5aW5nICYmIG9sZFN0YXRlLnN0YXR1cyAhPT0gQXVkaW9QbGF5ZXJTdGF0dXMuUGxheWluZykge1xyXG4gICAgICBjb25zb2xlLmxvZyhgW0F1ZGlvUGxheWVyXSBTdGF0ZSBjaGFuZ2VkIHRvIFBsYXlpbmcsIHN0YXJ0aW5nIHBsYXliYWNrIGxvb3BgKTtcclxuICAgICAgdGhpcy5zY2hlZHVsZU5leHRGcmFtZSgpO1xyXG4gICAgfVxyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIENyZWF0ZSBhbiBhdWRpbyBwbGF5ZXJcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVBdWRpb1BsYXllcihvcHRpb25zPzogQ3JlYXRlQXVkaW9QbGF5ZXJPcHRpb25zKTogQXVkaW9QbGF5ZXIge1xyXG4gIHJldHVybiBuZXcgQXVkaW9QbGF5ZXIob3B0aW9ucyk7XHJcbn1cclxuIl19