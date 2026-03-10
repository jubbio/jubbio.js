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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQXVkaW9QbGF5ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvQXVkaW9QbGF5ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBK2pCQSw4Q0FFQztBQWprQkQsbUNBQXNDO0FBQ3RDLGlEQUFvRDtBQUNwRCxxQ0FBaUM7QUFDakMsZ0RBTzJCO0FBQzNCLG1DQUE0QztBQUs1Qyw0Q0FBNEM7QUFDNUMsTUFBTSxXQUFXLEdBQUcsS0FBSyxDQUFDO0FBQzFCLE1BQU0sUUFBUSxHQUFHLENBQUMsQ0FBQztBQUNuQixNQUFNLGlCQUFpQixHQUFHLEVBQUUsQ0FBQztBQUM3QixNQUFNLGlCQUFpQixHQUFHLENBQUMsV0FBVyxHQUFHLGlCQUFpQixDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsTUFBTTtBQUUxRSx5QkFBeUI7QUFDekIsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxzQkFBc0I7QUFDcEUsTUFBTSxvQkFBb0IsR0FBRyxHQUFHLENBQUMsQ0FBQyxrQ0FBa0M7QUFDcEUsTUFBTSxpQkFBaUIsR0FBRyxFQUFFLENBQUMsQ0FBSSx5Q0FBeUM7QUFDMUUsTUFBTSxpQkFBaUIsR0FBRyxHQUFHLENBQUMsQ0FBRyxvREFBb0Q7QUFDckYsTUFBTSxvQkFBb0IsR0FBRyxFQUFFLENBQUMsQ0FBQyx5Q0FBeUM7QUFFMUU7O0dBRUc7QUFDSCxNQUFhLFdBQVksU0FBUSxxQkFBWTtJQUMzQywyQkFBMkI7SUFDcEIsS0FBSyxHQUFxQixFQUFFLE1BQU0sRUFBRSx5QkFBaUIsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUVwRSxxQkFBcUI7SUFDYixPQUFPLENBQTJCO0lBRTFDLG1DQUFtQztJQUMzQixhQUFhLEdBQXlCLElBQUksR0FBRyxFQUFFLENBQUM7SUFFeEQsNkJBQTZCO0lBQ3JCLGVBQWUsR0FBeUIsSUFBSSxDQUFDO0lBRXJELHFCQUFxQjtJQUNiLGFBQWEsR0FBd0IsSUFBSSxDQUFDO0lB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QUFJLFFBQVEsQ0FBQyxNQUFNLEtBQUsseUJBQWlCLENBQUMsT0FBTyxJQUFJLFFBQVEsQ0FBQyxNQUFNLEtBQUsseUJBQWlCLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDbkcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxnRUFBZ0UsQ0FBQyxDQUFDO1lBQzlFLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1FBQzNCLENBQUM7SUFDSCxDQUFDO0NBQ0Y7QUExaEJELGtDQTBoQkM7QUFFRDs7R0FFRztBQUNILFNBQWdCLGlCQUFpQixDQUFDLE9BQWtDO0lBQ2xFLE9BQU8sSUFBSSxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDbEMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gJ2V2ZW50cyc7XHJcbmltcG9ydCB7IHNwYXduLCBDaGlsZFByb2Nlc3MgfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcclxuaW1wb3J0IHsgaHJ0aW1lIH0gZnJvbSAncHJvY2Vzcyc7XHJcbmltcG9ydCB7IFxyXG4gIFJvb20sIFxyXG4gIExvY2FsQXVkaW9UcmFjaywgXHJcbiAgQXVkaW9Tb3VyY2UsIFxyXG4gIFRyYWNrUHVibGlzaE9wdGlvbnMsIFxyXG4gIFRyYWNrU291cmNlLFxyXG4gIEF1ZGlvRnJhbWUgXHJcbn0gZnJvbSAnQGxpdmVraXQvcnRjLW5vZGUnO1xyXG5pbXBvcnQgeyBBdWRpb1BsYXllclN0YXR1cyB9IGZyb20gJy4vZW51bXMnO1xyXG5pbXBvcnQgeyBDcmVhdGVBdWRpb1BsYXllck9wdGlvbnMsIEF1ZGlvUGxheWVyU3RhdGUgfSBmcm9tICcuL3R5cGVzJztcclxuaW1wb3J0IHsgQXVkaW9SZXNvdXJjZSB9IGZyb20gJy4vQXVkaW9SZXNvdXJjZSc7XHJcbmltcG9ydCB7IFZvaWNlQ29ubmVjdGlvbiB9IGZyb20gJy4vVm9pY2VDb25uZWN0aW9uJztcclxuXHJcbi8vIEF1ZGlvIHNldHRpbmdzIGZvciBMaXZlS2l0ICg0OGtIeiBzdGVyZW8pXHJcbmNvbnN0IFNBTVBMRV9SQVRFID0gNDgwMDA7XHJcbmNvbnN0IENIQU5ORUxTID0gMjtcclxuY29uc3QgRlJBTUVfRFVSQVRJT05fTVMgPSAyMDtcclxuY29uc3QgU0FNUExFU19QRVJfRlJBTUUgPSAoU0FNUExFX1JBVEUgKiBGUkFNRV9EVVJBVElPTl9NUykgLyAxMDAwOyAvLyA5NjBcclxuXHJcbi8vIEppdHRlciBidWZmZXIgc2V0dGluZ3NcclxuY29uc3QgRlJBTUVfSU5URVJWQUxfTlMgPSBCaWdJbnQoMjBfMDAwXzAwMCk7IC8vIDIwbXMgaW4gbmFub3NlY29uZHNcclxuY29uc3QgVEFSR0VUX0JVRkZFUl9GUkFNRVMgPSAxNTA7IC8vIH4zIHNlY29uZHMgLSB0YXJnZXQgYnVmZmVyIHNpemVcclxuY29uc3QgTUlOX0JVRkZFUl9GUkFNRVMgPSA3NTsgICAgLy8gfjEuNSBzZWNvbmRzIC0gbWluaW11bSBiZWZvcmUgd2Ugc3RhcnRcclxuY29uc3QgTUFYX0JVRkZFUl9GUkFNRVMgPSA1MDA7ICAgLy8gfjEwIHNlY29uZHMgLSBtYXggYnVmZmVyIHRvIHByZXZlbnQgbWVtb3J5IGlzc3Vlc1xyXG5jb25zdCBMT1dfQlVGRkVSX1RIUkVTSE9MRCA9IDUwOyAvLyB+MSBzZWNvbmQgLSB3aGVuIHRvIHNsb3cgZG93biBwbGF5YmFja1xyXG5cclxuLyoqXHJcbiAqIEF1ZGlvIHBsYXllciBmb3IgcGxheWluZyBhdWRpbyByZXNvdXJjZXNcclxuICovXHJcbmV4cG9ydCBjbGFzcyBBdWRpb1BsYXllciBleHRlbmRzIEV2ZW50RW1pdHRlciB7XHJcbiAgLyoqIEN1cnJlbnQgcGxheWVyIHN0YXRlICovXHJcbiAgcHVibGljIHN0YXRlOiBBdWRpb1BsYXllclN0YXRlID0geyBzdGF0dXM6IEF1ZGlvUGxheWVyU3RhdHVzLklkbGUgfTtcclxuICBcclxuICAvKiogUGxheWVyIG9wdGlvbnMgKi9cclxuICBwcml2YXRlIG9wdGlvbnM6IENyZWF0ZUF1ZGlvUGxheWVyT3B0aW9ucztcclxuICBcclxuICAvKiogU3Vic2NyaWJlZCB2b2ljZSBjb25uZWN0aW9ucyAqL1xyXG4gIHByaXZhdGUgc3Vic2NyaXB0aW9uczogU2V0PFZvaWNlQ29ubmVjdGlvbj4gPSBuZXcgU2V0KCk7XHJcbiAgXHJcbiAgLyoqIEN1cnJlbnQgYXVkaW8gcmVzb3VyY2UgKi9cclxuICBwcml2YXRlIGN1cnJlbnRSZXNvdXJjZTogQXVkaW9SZXNvdXJjZSB8IG51bGwgPSBudWxsO1xyXG4gIFxyXG4gIC8qKiBGRm1wZWcgcHJvY2VzcyAqL1xyXG4gIHByaXZhdGUgZmZtcGVnUHJvY2VzczogQ2hpbGRQcm9jZXNzIHwgbnVsbCA9IG51bGw7XHJcbiAgXHJcbiAgLyoqIExpdmVLaXQgYXVkaW8gc291cmNlIGFuZCB0cmFjayAqL1xyXG4gIHByaXZhdGUgYXVkaW9Tb3VyY2U6IEF1ZGlvU291cmNlIHwgbnVsbCA9IG51bGw7XHJcbiAgcHJpdmF0ZSBhdWRpb1RyYWNrOiBMb2NhbEF1ZGlvVHJhY2sgfCBudWxsID0gbnVsbDtcclxuICBcclxuICAvKiogRnJhbWUgcXVldWUgYW5kIHBsYXliYWNrIHN0YXRlICovXHJcbiAgcHJpdmF0ZSBmcmFtZVF1ZXVlOiBJbnQxNkFycmF5W10gPSBbXTtcclxuICBwcml2YXRlIHBsYXliYWNrVGltZW91dDogTm9kZUpTLlRpbWVvdXQgfCBudWxsID0gbnVsbDtcclxuICBwcml2YXRlIGxlZnRvdmVyQnVmZmVyOiBCdWZmZXIgfCBudWxsID0gbnVsbDtcclxuICBwcml2YXRlIGlzUHVibGlzaGVkID0gZmFsc2U7XHJcbiAgXHJcbiAgLyoqIEhpZ2gtcmVzb2x1dGlvbiB0aW1pbmcgKi9cclxuICBwcml2YXRlIG5leHRGcmFtZVRpbWU6IGJpZ2ludCA9IEJpZ0ludCgwKTtcclxuICBwcml2YXRlIGlzUGxheWJhY2tMb29wUnVubmluZyA9IGZhbHNlO1xyXG4gIHByaXZhdGUgZmZtcGVnRG9uZSA9IGZhbHNlO1xyXG4gIFxyXG4gIC8qKiBCdWZmZXIgc3RhdGlzdGljcyAqL1xyXG4gIHByaXZhdGUgYnVmZmVyVW5kZXJydW5zID0gMDtcclxuICBwcml2YXRlIGZyYW1lc1BsYXllZCA9IDA7XHJcblxyXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnM6IENyZWF0ZUF1ZGlvUGxheWVyT3B0aW9ucyA9IHt9KSB7XHJcbiAgICBzdXBlcigpO1xyXG4gICAgdGhpcy5vcHRpb25zID0ge1xyXG4gICAgICBiZWhhdmlvcnM6IHtcclxuICAgICAgICBub1N1YnNjcmliZXI6ICdwYXVzZScsXHJcbiAgICAgICAgbWF4TWlzc2VkRnJhbWVzOiA1LFxyXG4gICAgICAgIC4uLm9wdGlvbnMuYmVoYXZpb3JzXHJcbiAgICAgIH1cclxuICAgIH07XHJcbiAgICBcclxuICAgIC8vIEFkZCBkZWZhdWx0IGVycm9yIGhhbmRsZXIgdG8gcHJldmVudCBjcmFzaGVzXHJcbiAgICB0aGlzLm9uKCdlcnJvcicsIChlcnJvcikgPT4ge1xyXG4gICAgICAvLyBEZWZhdWx0IGhhbmRsZXIgLSBqdXN0IGxvZyBpZiBubyBvdGhlciBsaXN0ZW5lcnNcclxuICAgICAgaWYgKHRoaXMubGlzdGVuZXJDb3VudCgnZXJyb3InKSA9PT0gMSkge1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tBdWRpb1BsYXllcl0gRXJyb3I6JywgZXJyb3IubWVzc2FnZSk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUGxheSBhbiBhdWRpbyByZXNvdXJjZVxyXG4gICAqL1xyXG4gIHBsYXkocmVzb3VyY2U6IEF1ZGlvUmVzb3VyY2UpOiB2b2lkIHtcclxuICAgIC8vIFN0b3AgY3VycmVudCBwbGF5YmFja1xyXG4gICAgdGhpcy5zdG9wKCk7XHJcbiAgICBcclxuICAgIHRoaXMuY3VycmVudFJlc291cmNlID0gcmVzb3VyY2U7XHJcbiAgICB0aGlzLnNldFN0YXRlKHsgc3RhdHVzOiBBdWRpb1BsYXllclN0YXR1cy5CdWZmZXJpbmcsIHJlc291cmNlIH0pO1xyXG4gICAgXHJcbiAgICAvLyBTdGFydCBwbGF5YmFjayBpZiB3ZSBoYXZlIGEgcmVhZHkgY29ubmVjdGlvblxyXG4gICAgZm9yIChjb25zdCBjb25uZWN0aW9uIG9mIHRoaXMuc3Vic2NyaXB0aW9ucykge1xyXG4gICAgICBpZiAoY29ubmVjdGlvbi5nZXRSb29tKCkpIHtcclxuICAgICAgICB0aGlzLnN0YXJ0UGxheWJhY2soY29ubmVjdGlvbik7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFBhdXNlIHBsYXliYWNrXHJcbiAgICovXHJcbiAgcGF1c2UoKTogYm9vbGVhbiB7XHJcbiAgICBpZiAodGhpcy5zdGF0ZS5zdGF0dXMgIT09IEF1ZGlvUGxheWVyU3RhdHVzLlBsYXlpbmcpIHtcclxuICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG4gICAgdGhpcy5zZXRTdGF0ZSh7IHN0YXR1czogQXVkaW9QbGF5ZXJTdGF0dXMuUGF1c2VkLCByZXNvdXJjZTogdGhpcy5jdXJyZW50UmVzb3VyY2UgfSk7XHJcbiAgICByZXR1cm4gdHJ1ZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFVucGF1c2UgcGxheWJhY2tcclxuICAgKi9cclxuICB1bnBhdXNlKCk6IGJvb2xlYW4ge1xyXG4gICAgaWYgKHRoaXMuc3RhdGUuc3RhdHVzICE9PSBBdWRpb1BsYXllclN0YXR1cy5QYXVzZWQpIHtcclxuICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG4gICAgdGhpcy5zZXRTdGF0ZSh7IHN0YXR1czogQXVkaW9QbGF5ZXJTdGF0dXMuUGxheWluZywgcmVzb3VyY2U6IHRoaXMuY3VycmVudFJlc291cmNlIH0pO1xyXG4gICAgcmV0dXJuIHRydWU7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTdG9wIHBsYXliYWNrXHJcbiAgICovXHJcbiAgc3RvcChmb3JjZSA9IGZhbHNlKTogYm9vbGVhbiB7XHJcbiAgICBpZiAodGhpcy5zdGF0ZS5zdGF0dXMgPT09IEF1ZGlvUGxheWVyU3RhdHVzLklkbGUgJiYgIWZvcmNlKSB7XHJcbiAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuICAgIHRoaXMuY2xlYW51cCgpO1xyXG4gICAgdGhpcy5jdXJyZW50UmVzb3VyY2UgPSBudWxsO1xyXG4gICAgdGhpcy5zZXRTdGF0ZSh7IHN0YXR1czogQXVkaW9QbGF5ZXJTdGF0dXMuSWRsZSB9KTtcclxuICAgIHJldHVybiB0cnVlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU3Vic2NyaWJlIGEgdm9pY2UgY29ubmVjdGlvbiB0byB0aGlzIHBsYXllclxyXG4gICAqIEBpbnRlcm5hbFxyXG4gICAqL1xyXG4gIHN1YnNjcmliZShjb25uZWN0aW9uOiBWb2ljZUNvbm5lY3Rpb24pOiB2b2lkIHtcclxuICAgIHRoaXMuc3Vic2NyaXB0aW9ucy5hZGQoY29ubmVjdGlvbik7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBVbnN1YnNjcmliZSBhIHZvaWNlIGNvbm5lY3Rpb24gZnJvbSB0aGlzIHBsYXllclxyXG4gICAqIEBpbnRlcm5hbFxyXG4gICAqL1xyXG4gIHVuc3Vic2NyaWJlKGNvbm5lY3Rpb246IFZvaWNlQ29ubmVjdGlvbik6IHZvaWQge1xyXG4gICAgdGhpcy5zdWJzY3JpcHRpb25zLmRlbGV0ZShjb25uZWN0aW9uKTtcclxuICAgIFxyXG4gICAgLy8gQXV0by1wYXVzZSBpZiBubyBzdWJzY3JpYmVyc1xyXG4gICAgaWYgKHRoaXMuc3Vic2NyaXB0aW9ucy5zaXplID09PSAwICYmIHRoaXMub3B0aW9ucy5iZWhhdmlvcnM/Lm5vU3Vic2NyaWJlciA9PT0gJ3BhdXNlJykge1xyXG4gICAgICBpZiAodGhpcy5zdGF0ZS5zdGF0dXMgPT09IEF1ZGlvUGxheWVyU3RhdHVzLlBsYXlpbmcpIHtcclxuICAgICAgICB0aGlzLnNldFN0YXRlKHsgc3RhdHVzOiBBdWRpb1BsYXllclN0YXR1cy5BdXRvUGF1c2VkLCByZXNvdXJjZTogdGhpcy5jdXJyZW50UmVzb3VyY2UgfSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENhbGxlZCB3aGVuIGEgY29ubmVjdGlvbiBiZWNvbWVzIHJlYWR5XHJcbiAgICogQGludGVybmFsXHJcbiAgICovXHJcbiAgb25Db25uZWN0aW9uUmVhZHkoY29ubmVjdGlvbjogVm9pY2VDb25uZWN0aW9uKTogdm9pZCB7XHJcbiAgICAvLyBJZiB3ZSBoYXZlIGEgcmVzb3VyY2Ugd2FpdGluZywgc3RhcnQgcGxheWJhY2tcclxuICAgIGlmICh0aGlzLmN1cnJlbnRSZXNvdXJjZSAmJiB0aGlzLnN0YXRlLnN0YXR1cyA9PT0gQXVkaW9QbGF5ZXJTdGF0dXMuQnVmZmVyaW5nKSB7XHJcbiAgICAgIHRoaXMuc3RhcnRQbGF5YmFjayhjb25uZWN0aW9uKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgYXN5bmMgc3RhcnRQbGF5YmFjayhjb25uZWN0aW9uOiBWb2ljZUNvbm5lY3Rpb24pOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IHJvb20gPSBjb25uZWN0aW9uLmdldFJvb20oKTtcclxuICAgIGlmICghcm9vbSB8fCAhdGhpcy5jdXJyZW50UmVzb3VyY2UpIHJldHVybjtcclxuXHJcbiAgICB0cnkge1xyXG4gICAgICAvLyBDcmVhdGUgYXVkaW8gc291cmNlIGFuZCB0cmFja1xyXG4gICAgICBhd2FpdCB0aGlzLnNldHVwQXVkaW9UcmFjayhyb29tKTtcclxuICAgICAgXHJcbiAgICAgIC8vIFN0YXJ0IEZGbXBlZyB0byBkZWNvZGUgYXVkaW8gLSB0aGlzIHdpbGwgc2V0IHN0YXRlIHRvIFBsYXlpbmcgd2hlbiByZWFkeVxyXG4gICAgICBhd2FpdCB0aGlzLnN0YXJ0RkZtcGVnKCk7XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAvLyBFbWl0IGVycm9yIGJ1dCBkb24ndCBzdG9wIC0gbGV0IHVzZXIgZGVjaWRlIHdoYXQgdG8gZG9cclxuICAgICAgdGhpcy5lbWl0KCdlcnJvcicsIHsgbWVzc2FnZTogKGVycm9yIGFzIEVycm9yKS5tZXNzYWdlLCByZXNvdXJjZTogdGhpcy5jdXJyZW50UmVzb3VyY2UgfSk7XHJcbiAgICAgIC8vIFJlc2V0IHRvIGlkbGUgc3RhdGUgd2l0aG91dCBmdWxsIGNsZWFudXBcclxuICAgICAgdGhpcy5zZXRTdGF0ZSh7IHN0YXR1czogQXVkaW9QbGF5ZXJTdGF0dXMuSWRsZSB9KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgYXN5bmMgc2V0dXBBdWRpb1RyYWNrKHJvb206IFJvb20pOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGlmICh0aGlzLmlzUHVibGlzaGVkKSByZXR1cm47XHJcbiAgICBcclxuICAgIHRoaXMuYXVkaW9Tb3VyY2UgPSBuZXcgQXVkaW9Tb3VyY2UoU0FNUExFX1JBVEUsIENIQU5ORUxTKTtcclxuICAgIHRoaXMuYXVkaW9UcmFjayA9IExvY2FsQXVkaW9UcmFjay5jcmVhdGVBdWRpb1RyYWNrKCdtdXNpYycsIHRoaXMuYXVkaW9Tb3VyY2UpO1xyXG4gICAgXHJcbiAgICBjb25zdCBvcHRpb25zID0gbmV3IFRyYWNrUHVibGlzaE9wdGlvbnMoKTtcclxuICAgIG9wdGlvbnMuc291cmNlID0gVHJhY2tTb3VyY2UuU09VUkNFX01JQ1JPUEhPTkU7XHJcbiAgICBcclxuICAgIGlmIChyb29tLmxvY2FsUGFydGljaXBhbnQpIHtcclxuICAgICAgYXdhaXQgcm9vbS5sb2NhbFBhcnRpY2lwYW50LnB1Ymxpc2hUcmFjayh0aGlzLmF1ZGlvVHJhY2ssIG9wdGlvbnMpO1xyXG4gICAgfVxyXG4gICAgdGhpcy5pc1B1Ymxpc2hlZCA9IHRydWU7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFzeW5jIHN0YXJ0RkZtcGVnKCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgaWYgKCF0aGlzLmN1cnJlbnRSZXNvdXJjZSkgcmV0dXJuO1xyXG4gICAgXHJcbiAgICBsZXQgaW5wdXRTb3VyY2UgPSB0aGlzLmN1cnJlbnRSZXNvdXJjZS5nZXRJbnB1dFNvdXJjZSgpO1xyXG4gICAgY29uc29sZS5sb2coYEZGbXBlZyBpbnB1dCBzb3VyY2U6ICR7aW5wdXRTb3VyY2Uuc3Vic3RyaW5nKDAsIDEwMCl9Li4uYCk7XHJcbiAgICBcclxuICAgIC8vIENoZWNrIGlmIGlucHV0IGlzIGEgVVJMIG9yIHNlYXJjaCBxdWVyeVxyXG4gICAgY29uc3QgaXNVcmwgPSBpbnB1dFNvdXJjZS5zdGFydHNXaXRoKCdodHRwOi8vJykgfHwgXHJcbiAgICAgICAgICAgICAgICAgIGlucHV0U291cmNlLnN0YXJ0c1dpdGgoJ2h0dHBzOi8vJykgfHwgXHJcbiAgICAgICAgICAgICAgICAgIGlucHV0U291cmNlLnN0YXJ0c1dpdGgoJ3l0c2VhcmNoOicpO1xyXG4gICAgXHJcbiAgICAvLyBJZiBub3QgYSBVUkwsIHRyZWF0IGFzIFlvdVR1YmUgc2VhcmNoXHJcbiAgICBpZiAoIWlzVXJsKSB7XHJcbiAgICAgIGlucHV0U291cmNlID0gYHl0c2VhcmNoMToke2lucHV0U291cmNlfWA7XHJcbiAgICAgIGNvbnNvbGUubG9nKGBDb252ZXJ0ZWQgdG8gWW91VHViZSBzZWFyY2g6ICR7aW5wdXRTb3VyY2V9YCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIENoZWNrIGlmIHRoaXMgaXMgYSBzdHJlYW1pbmcgVVJMIHRoYXQgbmVlZHMgeXQtZGxwXHJcbiAgICBjb25zdCBuZWVkc1l0RGxwID0gaW5wdXRTb3VyY2UuaW5jbHVkZXMoJ3lvdXR1YmUuY29tJykgfHwgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgaW5wdXRTb3VyY2UuaW5jbHVkZXMoJ3lvdXR1LmJlJykgfHxcclxuICAgICAgICAgICAgICAgICAgICAgICBpbnB1dFNvdXJjZS5pbmNsdWRlcygnc291bmRjbG91ZC5jb20nKSB8fFxyXG4gICAgICAgICAgICAgICAgICAgICAgIGlucHV0U291cmNlLmluY2x1ZGVzKCd0d2l0Y2gudHYnKSB8fFxyXG4gICAgICAgICAgICAgICAgICAgICAgIGlucHV0U291cmNlLnN0YXJ0c1dpdGgoJ3l0c2VhcmNoJyk7XHJcbiAgICBcclxuICAgIGlmIChuZWVkc1l0RGxwKSB7XHJcbiAgICAgIC8vIFVzZSB5dC1kbHAgdG8gcGlwZSBhdWRpbyBkaXJlY3RseSB0byBGRm1wZWdcclxuICAgICAgY29uc29sZS5sb2coJ1VzaW5nIHl0LWRscCBwaXBlIG1vZGUnKTtcclxuICAgICAgXHJcbiAgICAgIC8vIERldGVjdCBwbGF0Zm9ybVxyXG4gICAgICBjb25zdCBpc1dpbmRvd3MgPSBwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInO1xyXG4gICAgICBjb25zdCB5dERscFBhdGggPSBpc1dpbmRvd3MgPyAneXQtZGxwJyA6ICd+Ly5sb2NhbC9iaW4veXQtZGxwJztcclxuICAgICAgXHJcbiAgICAgIC8vIE9uIFdpbmRvd3Mgd2l0aCBzaGVsbCBtb2RlLCB3ZSBuZWVkIHRvIHVzZSBhIHNpbmdsZSBjb21tYW5kIHN0cmluZ1xyXG4gICAgICAvLyB0byBwcmVzZXJ2ZSBzcGFjZXMgaW4gdGhlIHNlYXJjaCBxdWVyeVxyXG4gICAgICBpZiAoaXNXaW5kb3dzKSB7XHJcbiAgICAgICAgLy8gQnVpbGQgY29tbWFuZCBhcyBzaW5nbGUgc3RyaW5nIHdpdGggcHJvcGVyIHF1b3RpbmdcclxuICAgICAgICBjb25zdCB5dGRscENtZCA9IGAke3l0RGxwUGF0aH0gLWYgYmVzdGF1ZGlvL2Jlc3QgLW8gLSAtLW5vLXBsYXlsaXN0IC0tbm8td2FybmluZ3MgLS1kZWZhdWx0LXNlYXJjaCB5dHNlYXJjaCBcIiR7aW5wdXRTb3VyY2V9XCJgO1xyXG4gICAgICAgIGNvbnN0IGZmbXBlZ0NtZCA9IGBmZm1wZWcgLWkgcGlwZTowIC1mIHMxNmxlIC1hciAke1NBTVBMRV9SQVRFfSAtYWMgJHtDSEFOTkVMU30gLWFjb2RlYyBwY21fczE2bGUgLWA7XHJcbiAgICAgICAgXHJcbiAgICAgICAgY29uc29sZS5sb2coJ1tBdWRpb1BsYXllcl0geXQtZGxwIGNvbW1hbmQ6JywgeXRkbHBDbWQpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIFNwYXduIHl0LWRscCB3aXRoIHNoZWxsIGNvbW1hbmRcclxuICAgICAgICBjb25zdCB5dGRscFByb2Nlc3MgPSBzcGF3bih5dGRscENtZCwgW10sIHsgXHJcbiAgICAgICAgICBzdGRpbzogWydwaXBlJywgJ3BpcGUnLCAncGlwZSddLFxyXG4gICAgICAgICAgc2hlbGw6IHRydWVcclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBTcGF3biBmZm1wZWcgd2l0aCBzaGVsbCBjb21tYW5kXHJcbiAgICAgICAgdGhpcy5mZm1wZWdQcm9jZXNzID0gc3Bhd24oZmZtcGVnQ21kLCBbXSwgeyBcclxuICAgICAgICAgIHN0ZGlvOiBbJ3BpcGUnLCAncGlwZScsICdwaXBlJ10sXHJcbiAgICAgICAgICBzaGVsbDogdHJ1ZVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIFRyYWNrIGRhdGEgZmxvd1xyXG4gICAgICAgIGxldCB5dGRscERhdGFSZWNlaXZlZCA9IDA7XHJcbiAgICAgICAgXHJcbiAgICAgICAgeXRkbHBQcm9jZXNzLnN0ZG91dD8ub24oJ2RhdGEnLCAoY2h1bms6IEJ1ZmZlcikgPT4ge1xyXG4gICAgICAgICAgeXRkbHBEYXRhUmVjZWl2ZWQgKz0gY2h1bmsubGVuZ3RoO1xyXG4gICAgICAgICAgaWYgKHl0ZGxwRGF0YVJlY2VpdmVkIDwgMTAwMDAgfHwgeXRkbHBEYXRhUmVjZWl2ZWQgJSAxMDAwMDAgPCAxMDAwMCkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW3l0LWRscF0gc3Rkb3V0IGRhdGE6ICR7Y2h1bmsubGVuZ3RofSBieXRlcyAodG90YWw6ICR7eXRkbHBEYXRhUmVjZWl2ZWR9KWApO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIFBpcGUgeXQtZGxwIHN0ZG91dCB0byBmZm1wZWcgc3RkaW5cclxuICAgICAgICB5dGRscFByb2Nlc3Muc3Rkb3V0Py5waXBlKHRoaXMuZmZtcGVnUHJvY2Vzcy5zdGRpbiEpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIEhhbmRsZSB5dC1kbHAgc3RkZXJyIC0gbG9nIGV2ZXJ5dGhpbmcgZm9yIGRlYnVnZ2luZ1xyXG4gICAgICAgIHl0ZGxwUHJvY2Vzcy5zdGRlcnI/Lm9uKCdkYXRhJywgKGRhdGE6IEJ1ZmZlcikgPT4ge1xyXG4gICAgICAgICAgY29uc3QgbXNnID0gZGF0YS50b1N0cmluZygpLnRyaW0oKTtcclxuICAgICAgICAgIGlmIChtc2cpIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ1t5dC1kbHBdJywgbXNnKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgICBcclxuICAgICAgICB5dGRscFByb2Nlc3Mub24oJ2Vycm9yJywgKGVycikgPT4ge1xyXG4gICAgICAgICAgY29uc29sZS5lcnJvcignW3l0LWRscF0gcHJvY2VzcyBlcnJvcjonLCBlcnIubWVzc2FnZSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgeXRkbHBQcm9jZXNzLm9uKCdjbG9zZScsIChjb2RlKSA9PiB7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW3l0LWRscF0gY2xvc2VkIHdpdGggY29kZSAke2NvZGV9LCB0b3RhbCBkYXRhOiAke3l0ZGxwRGF0YVJlY2VpdmVkfSBieXRlc2ApO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIC8vIFVuaXg6IHVzZSBhcmdzIGFycmF5IChubyBzaGVsbCBuZWVkZWQpXHJcbiAgICAgICAgY29uc3QgeXRkbHBBcmdzID0gW1xyXG4gICAgICAgICAgJy1mJywgJ2Jlc3RhdWRpby9iZXN0JyxcclxuICAgICAgICAgICctbycsICctJyxcclxuICAgICAgICAgICctLW5vLXBsYXlsaXN0JyxcclxuICAgICAgICAgICctLW5vLXdhcm5pbmdzJyxcclxuICAgICAgICAgICctLWRlZmF1bHQtc2VhcmNoJywgJ3l0c2VhcmNoJyxcclxuICAgICAgICAgIGlucHV0U291cmNlXHJcbiAgICAgICAgXTtcclxuICAgICAgICBcclxuICAgICAgICBjb25zdCBmZm1wZWdBcmdzID0gW1xyXG4gICAgICAgICAgJy1pJywgJ3BpcGU6MCcsXHJcbiAgICAgICAgICAnLWYnLCAnczE2bGUnLFxyXG4gICAgICAgICAgJy1hcicsIFN0cmluZyhTQU1QTEVfUkFURSksXHJcbiAgICAgICAgICAnLWFjJywgU3RyaW5nKENIQU5ORUxTKSxcclxuICAgICAgICAgICctYWNvZGVjJywgJ3BjbV9zMTZsZScsXHJcbiAgICAgICAgICAnLSdcclxuICAgICAgICBdO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIFNwYXduIHl0LWRscFxyXG4gICAgICAgIGNvbnN0IHl0ZGxwUHJvY2VzcyA9IHNwYXduKHl0RGxwUGF0aCwgeXRkbHBBcmdzLCB7IFxyXG4gICAgICAgICAgc3RkaW86IFsncGlwZScsICdwaXBlJywgJ3BpcGUnXSxcclxuICAgICAgICAgIHNoZWxsOiBmYWxzZVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIFNwYXduIGZmbXBlZ1xyXG4gICAgICAgIHRoaXMuZmZtcGVnUHJvY2VzcyA9IHNwYXduKCdmZm1wZWcnLCBmZm1wZWdBcmdzLCB7IFxyXG4gICAgICAgICAgc3RkaW86IFsncGlwZScsICdwaXBlJywgJ3BpcGUnXSxcclxuICAgICAgICAgIHNoZWxsOiBmYWxzZVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIFBpcGUgeXQtZGxwIHN0ZG91dCB0byBmZm1wZWcgc3RkaW5cclxuICAgICAgICB5dGRscFByb2Nlc3Muc3Rkb3V0Py5waXBlKHRoaXMuZmZtcGVnUHJvY2Vzcy5zdGRpbiEpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIEhhbmRsZSB5dC1kbHAgZXJyb3JzXHJcbiAgICAgICAgeXRkbHBQcm9jZXNzLnN0ZGVycj8ub24oJ2RhdGEnLCAoZGF0YTogQnVmZmVyKSA9PiB7XHJcbiAgICAgICAgICBjb25zdCBtc2cgPSBkYXRhLnRvU3RyaW5nKCk7XHJcbiAgICAgICAgICBpZiAobXNnLmluY2x1ZGVzKCdFUlJPUicpKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ3l0LWRscCBlcnJvcjonLCBtc2cpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHl0ZGxwUHJvY2Vzcy5vbignZXJyb3InLCAoZXJyKSA9PiB7XHJcbiAgICAgICAgICBjb25zb2xlLmVycm9yKCd5dC1kbHAgcHJvY2VzcyBlcnJvcjonLCBlcnIubWVzc2FnZSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgeXRkbHBQcm9jZXNzLm9uKCdjbG9zZScsIChjb2RlKSA9PiB7XHJcbiAgICAgICAgICBpZiAoY29kZSAhPT0gMCkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGB5dC1kbHAgZXhpdGVkIHdpdGggY29kZSAke2NvZGV9YCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGNvbnNvbGUubG9nKCdVc2luZyBkaXJlY3QgRkZtcGVnIG1vZGUnKTtcclxuICAgICAgdGhpcy5mZm1wZWdQcm9jZXNzID0gc3Bhd24oJ2ZmbXBlZycsIFtcclxuICAgICAgICAnLXJlY29ubmVjdCcsICcxJyxcclxuICAgICAgICAnLXJlY29ubmVjdF9zdHJlYW1lZCcsICcxJyxcclxuICAgICAgICAnLXJlY29ubmVjdF9kZWxheV9tYXgnLCAnNScsXHJcbiAgICAgICAgJy1pJywgaW5wdXRTb3VyY2UsXHJcbiAgICAgICAgJy1mJywgJ3MxNmxlJyxcclxuICAgICAgICAnLWFyJywgU3RyaW5nKFNBTVBMRV9SQVRFKSxcclxuICAgICAgICAnLWFjJywgU3RyaW5nKENIQU5ORUxTKSxcclxuICAgICAgICAnLWFjb2RlYycsICdwY21fczE2bGUnLFxyXG4gICAgICAgICctJ1xyXG4gICAgICBdLCB7IHN0ZGlvOiBbJ3BpcGUnLCAncGlwZScsICdwaXBlJ10gfSk7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgZnJhbWVTaXplID0gU0FNUExFU19QRVJfRlJBTUUgKiBDSEFOTkVMUyAqIDI7XHJcbiAgICB0aGlzLmZmbXBlZ0RvbmUgPSBmYWxzZTtcclxuICAgIGxldCBoYXNSZWNlaXZlZERhdGEgPSBmYWxzZTtcclxuXHJcbiAgICB0aGlzLmZmbXBlZ1Byb2Nlc3Muc3Rkb3V0Py5vbignZGF0YScsIChjaHVuazogQnVmZmVyKSA9PiB7XHJcbiAgICAgIGlmICh0aGlzLnN0YXRlLnN0YXR1cyAhPT0gQXVkaW9QbGF5ZXJTdGF0dXMuUGxheWluZyAmJiBcclxuICAgICAgICAgIHRoaXMuc3RhdGUuc3RhdHVzICE9PSBBdWRpb1BsYXllclN0YXR1cy5CdWZmZXJpbmcpIHJldHVybjtcclxuICAgICAgXHJcbiAgICAgIGhhc1JlY2VpdmVkRGF0YSA9IHRydWU7XHJcbiAgICAgIFxyXG4gICAgICAvLyBIYW5kbGUgbGVmdG92ZXIgZnJvbSBwcmV2aW91cyBjaHVua1xyXG4gICAgICBpZiAodGhpcy5sZWZ0b3ZlckJ1ZmZlciAmJiB0aGlzLmxlZnRvdmVyQnVmZmVyLmxlbmd0aCA+IDApIHtcclxuICAgICAgICBjaHVuayA9IEJ1ZmZlci5jb25jYXQoW3RoaXMubGVmdG92ZXJCdWZmZXIsIGNodW5rXSk7XHJcbiAgICAgICAgdGhpcy5sZWZ0b3ZlckJ1ZmZlciA9IG51bGw7XHJcbiAgICAgIH1cclxuICAgICAgXHJcbiAgICAgIGxldCBvZmZzZXQgPSAwO1xyXG4gICAgICB3aGlsZSAob2Zmc2V0ICsgZnJhbWVTaXplIDw9IGNodW5rLmxlbmd0aCkge1xyXG4gICAgICAgIGNvbnN0IGZyYW1lID0gY2h1bmsuc2xpY2Uob2Zmc2V0LCBvZmZzZXQgKyBmcmFtZVNpemUpO1xyXG4gICAgICAgIGNvbnN0IGludDE2QXJyYXkgPSBuZXcgSW50MTZBcnJheShTQU1QTEVTX1BFUl9GUkFNRSAqIENIQU5ORUxTKTtcclxuICAgICAgICBcclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGludDE2QXJyYXkubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgIGludDE2QXJyYXlbaV0gPSBmcmFtZS5yZWFkSW50MTZMRShpICogMik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHRoaXMuZnJhbWVRdWV1ZS5wdXNoKGludDE2QXJyYXkpO1xyXG4gICAgICAgIG9mZnNldCArPSBmcmFtZVNpemU7XHJcbiAgICAgIH1cclxuICAgICAgXHJcbiAgICAgIC8vIFNhdmUgbGVmdG92ZXJcclxuICAgICAgaWYgKG9mZnNldCA8IGNodW5rLmxlbmd0aCkge1xyXG4gICAgICAgIHRoaXMubGVmdG92ZXJCdWZmZXIgPSBjaHVuay5zbGljZShvZmZzZXQpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICBsZXQgc3RkZXJyT3V0cHV0ID0gJyc7XHJcbiAgICB0aGlzLmZmbXBlZ1Byb2Nlc3Muc3RkZXJyPy5vbignZGF0YScsIChkYXRhOiBCdWZmZXIpID0+IHtcclxuICAgICAgc3RkZXJyT3V0cHV0ICs9IGRhdGEudG9TdHJpbmcoKTtcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuZmZtcGVnUHJvY2Vzcy5vbignY2xvc2UnLCAoY29kZSkgPT4ge1xyXG4gICAgICB0aGlzLmZmbXBlZ0RvbmUgPSB0cnVlO1xyXG4gICAgICB0aGlzLmZmbXBlZ1Byb2Nlc3MgPSBudWxsO1xyXG4gICAgICBpZiAoY29kZSAhPT0gMCkge1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoYEZGbXBlZyBzdGRlcnI6XFxuJHtzdGRlcnJPdXRwdXR9YCk7XHJcbiAgICAgIH1cclxuICAgICAgY29uc29sZS5sb2coYFtBdWRpb1BsYXllcl0gRkZtcGVnIGNsb3NlZCB3aXRoIGNvZGUgJHtjb2RlfSwgaGFzUmVjZWl2ZWREYXRhOiAke2hhc1JlY2VpdmVkRGF0YX0sIHF1ZXVlOiAke3RoaXMuZnJhbWVRdWV1ZS5sZW5ndGh9YCk7XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLmZmbXBlZ1Byb2Nlc3Mub24oJ2Vycm9yJywgKGVycikgPT4ge1xyXG4gICAgICBjb25zb2xlLmVycm9yKCdGRm1wZWcgcHJvY2VzcyBlcnJvcjonLCBlcnIubWVzc2FnZSk7XHJcbiAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCB7IG1lc3NhZ2U6IGVyci5tZXNzYWdlLCByZXNvdXJjZTogdGhpcy5jdXJyZW50UmVzb3VyY2UgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBXYWl0IGZvciBpbml0aWFsIGJ1ZmZlciB3aXRoIHRpbWVvdXRcclxuICAgIGNvbnN0IGJ1ZmZlclRpbWVvdXQgPSAxMDAwMDsgLy8gMTAgc2Vjb25kcyBmb3IgaW5pdGlhbCBidWZmZXJcclxuICAgIGNvbnN0IHN0YXJ0VGltZSA9IERhdGUubm93KCk7XHJcbiAgICBcclxuICAgIHdoaWxlICh0aGlzLmZyYW1lUXVldWUubGVuZ3RoIDwgTUlOX0JVRkZFUl9GUkFNRVMgJiYgRGF0ZS5ub3coKSAtIHN0YXJ0VGltZSA8IGJ1ZmZlclRpbWVvdXQpIHtcclxuICAgICAgYXdhaXQgbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIDEwMCkpO1xyXG4gICAgICBcclxuICAgICAgLy8gQ2hlY2sgaWYgRkZtcGVnIGZhaWxlZCBlYXJseVxyXG4gICAgICBpZiAodGhpcy5mZm1wZWdEb25lICYmIHRoaXMuZnJhbWVRdWV1ZS5sZW5ndGggPT09IDApIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZGbXBlZyBmYWlsZWQgdG8gcHJvZHVjZSBhdWRpbyBkYXRhJyk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgaWYgKHRoaXMuZnJhbWVRdWV1ZS5sZW5ndGggPT09IDApIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdUaW1lb3V0IHdhaXRpbmcgZm9yIGF1ZGlvIGRhdGEnKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgY29uc29sZS5sb2coYFtBdWRpb1BsYXllcl0gU3RhcnRpbmcgcGxheWJhY2sgd2l0aCAke3RoaXMuZnJhbWVRdWV1ZS5sZW5ndGh9IGZyYW1lcyBidWZmZXJlZCAodGFyZ2V0OiAke1RBUkdFVF9CVUZGRVJfRlJBTUVTfSlgKTtcclxuXHJcbiAgICAvLyBNYXJrIHJlYWR5IGZvciBwbGF5YmFjayAtIHNldFN0YXRlIHdpbGwgdHJpZ2dlciB0aGUgbG9vcFxyXG4gICAgdGhpcy5pc1BsYXliYWNrTG9vcFJ1bm5pbmcgPSB0cnVlO1xyXG4gICAgdGhpcy5uZXh0RnJhbWVUaW1lID0gaHJ0aW1lLmJpZ2ludCgpO1xyXG4gICAgY29uc29sZS5sb2coYFtBdWRpb1BsYXllcl0gUGxheWJhY2sgcmVhZHksIGF1ZGlvU291cmNlIGV4aXN0czogJHshIXRoaXMuYXVkaW9Tb3VyY2V9YCk7XHJcbiAgICBcclxuICAgIC8vIFNldCBzdGF0ZSB0byBwbGF5aW5nIC0gdGhpcyB3aWxsIHRyaWdnZXIgc2NoZWR1bGVOZXh0RnJhbWUgdmlhIHNldFN0YXRlXHJcbiAgICB0aGlzLnNldFN0YXRlKHsgc3RhdHVzOiBBdWRpb1BsYXllclN0YXR1cy5QbGF5aW5nLCByZXNvdXJjZTogdGhpcy5jdXJyZW50UmVzb3VyY2UgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBIaWdoLXJlc29sdXRpb24gZnJhbWUgc2NoZWR1bGluZyB1c2luZyBocnRpbWVcclxuICAgKiBUaGlzIHByb3ZpZGVzIG11Y2ggbW9yZSBhY2N1cmF0ZSB0aW1pbmcgdGhhbiBzZXRJbnRlcnZhbFxyXG4gICAqL1xyXG4gIHByaXZhdGUgc2NoZWR1bGVOZXh0RnJhbWUoKTogdm9pZCB7XHJcbiAgICBpZiAoIXRoaXMuaXNQbGF5YmFja0xvb3BSdW5uaW5nIHx8IHRoaXMuc3RhdGUuc3RhdHVzICE9PSBBdWRpb1BsYXllclN0YXR1cy5QbGF5aW5nKSB7XHJcbiAgICAgIGNvbnNvbGUubG9nKGBbQXVkaW9QbGF5ZXJdIHNjaGVkdWxlTmV4dEZyYW1lIHNraXBwZWQ6IGxvb3BSdW5uaW5nPSR7dGhpcy5pc1BsYXliYWNrTG9vcFJ1bm5pbmd9LCBzdGF0dXM9JHt0aGlzLnN0YXRlLnN0YXR1c31gKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IG5vdyA9IGhydGltZS5iaWdpbnQoKTtcclxuICAgIGNvbnN0IGRlbGF5TnMgPSB0aGlzLm5leHRGcmFtZVRpbWUgLSBub3c7XHJcbiAgICBjb25zdCBkZWxheU1zID0gTnVtYmVyKGRlbGF5TnMpIC8gMV8wMDBfMDAwO1xyXG5cclxuICAgIGlmICh0aGlzLmZyYW1lc1BsYXllZCA9PT0gMCkge1xyXG4gICAgICBjb25zb2xlLmxvZyhgW0F1ZGlvUGxheWVyXSBGaXJzdCBmcmFtZSBzY2hlZHVsaW5nOiBkZWxheU1zPSR7ZGVsYXlNcy50b0ZpeGVkKDIpfWApO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIFNjaGVkdWxlIG5leHQgZnJhbWVcclxuICAgIGlmIChkZWxheU1zID4gMSkge1xyXG4gICAgICB0aGlzLnBsYXliYWNrVGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4gdGhpcy5wcm9jZXNzRnJhbWUoKSwgTWF0aC5tYXgoMSwgZGVsYXlNcyAtIDEpKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIC8vIFdlJ3JlIGJlaGluZCwgcHJvY2VzcyBpbW1lZGlhdGVseVxyXG4gICAgICBzZXRJbW1lZGlhdGUoKCkgPT4gdGhpcy5wcm9jZXNzRnJhbWUoKSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBQcm9jZXNzIGFuZCBzZW5kIGEgc2luZ2xlIGF1ZGlvIGZyYW1lXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBhc3luYyBwcm9jZXNzRnJhbWUoKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBpZiAoIXRoaXMuaXNQbGF5YmFja0xvb3BSdW5uaW5nIHx8IHRoaXMuc3RhdGUuc3RhdHVzICE9PSBBdWRpb1BsYXllclN0YXR1cy5QbGF5aW5nKSB7XHJcbiAgICAgIGlmICh0aGlzLmZyYW1lc1BsYXllZCA9PT0gMCkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGBbQXVkaW9QbGF5ZXJdIHByb2Nlc3NGcmFtZSBza2lwcGVkOiBsb29wUnVubmluZz0ke3RoaXMuaXNQbGF5YmFja0xvb3BSdW5uaW5nfSwgc3RhdHVzPSR7dGhpcy5zdGF0ZS5zdGF0dXN9YCk7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIENoZWNrIGJ1ZmZlciBzdGF0dXNcclxuICAgIGNvbnN0IGJ1ZmZlclNpemUgPSB0aGlzLmZyYW1lUXVldWUubGVuZ3RoO1xyXG4gICAgXHJcbiAgICBpZiAoYnVmZmVyU2l6ZSA+IDAgJiYgdGhpcy5hdWRpb1NvdXJjZSkge1xyXG4gICAgICBjb25zdCBpbnQxNkFycmF5ID0gdGhpcy5mcmFtZVF1ZXVlLnNoaWZ0KCkhO1xyXG4gICAgICBjb25zdCBhdWRpb0ZyYW1lID0gbmV3IEF1ZGlvRnJhbWUoaW50MTZBcnJheSwgU0FNUExFX1JBVEUsIENIQU5ORUxTLCBTQU1QTEVTX1BFUl9GUkFNRSk7XHJcbiAgICAgIFxyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGF3YWl0IHRoaXMuYXVkaW9Tb3VyY2UuY2FwdHVyZUZyYW1lKGF1ZGlvRnJhbWUpO1xyXG4gICAgICAgIHRoaXMuZnJhbWVzUGxheWVkKys7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gTG9nIHByb2dyZXNzIGV2ZXJ5IDUwMCBmcmFtZXMgKH4xMCBzZWNvbmRzKVxyXG4gICAgICAgIGlmICh0aGlzLmZyYW1lc1BsYXllZCAlIDUwMCA9PT0gMCkge1xyXG4gICAgICAgICAgY29uc29sZS5sb2coYFtBdWRpb1BsYXllcl0gUHJvZ3Jlc3M6ICR7dGhpcy5mcmFtZXNQbGF5ZWR9IGZyYW1lcyBwbGF5ZWQsIGJ1ZmZlcjogJHtidWZmZXJTaXplfWApO1xyXG4gICAgICAgIH1cclxuICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoYFtBdWRpb1BsYXllcl0gRnJhbWUgZXJyb3I6YCwgKGUgYXMgRXJyb3IpLm1lc3NhZ2UpO1xyXG4gICAgICB9XHJcbiAgICAgIFxyXG4gICAgICAvLyBVcGRhdGUgdGltaW5nIGZvciBuZXh0IGZyYW1lXHJcbiAgICAgIHRoaXMubmV4dEZyYW1lVGltZSArPSBGUkFNRV9JTlRFUlZBTF9OUztcclxuICAgICAgXHJcbiAgICAgIC8vIEFkYXB0aXZlIHRpbWluZzogaWYgYnVmZmVyIGlzIGxvdywgc2xvdyBkb3duIHNsaWdodGx5IHRvIGxldCBpdCByZWNvdmVyXHJcbiAgICAgIGlmIChidWZmZXJTaXplIDwgTE9XX0JVRkZFUl9USFJFU0hPTEQgJiYgIXRoaXMuZmZtcGVnRG9uZSkge1xyXG4gICAgICAgIC8vIEFkZCAxbXMgZGVsYXkgdG8gbGV0IGJ1ZmZlciByZWNvdmVyXHJcbiAgICAgICAgdGhpcy5uZXh0RnJhbWVUaW1lICs9IEJpZ0ludCgxXzAwMF8wMDApO1xyXG4gICAgICAgIHRoaXMuYnVmZmVyVW5kZXJydW5zKys7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKHRoaXMuYnVmZmVyVW5kZXJydW5zICUgNTAgPT09IDApIHtcclxuICAgICAgICAgIGNvbnNvbGUubG9nKGBbQXVkaW9QbGF5ZXJdIEJ1ZmZlciBsb3c6ICR7YnVmZmVyU2l6ZX0gZnJhbWVzLCAke3RoaXMuYnVmZmVyVW5kZXJydW5zfSB1bmRlcnJ1bnNgKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgXHJcbiAgICAgIC8vIFNjaGVkdWxlIG5leHQgZnJhbWVcclxuICAgICAgdGhpcy5zY2hlZHVsZU5leHRGcmFtZSgpO1xyXG4gICAgICBcclxuICAgIH0gZWxzZSBpZiAodGhpcy5mZm1wZWdEb25lICYmIGJ1ZmZlclNpemUgPT09IDApIHtcclxuICAgICAgLy8gUGxheWJhY2sgZmluaXNoZWRcclxuICAgICAgY29uc29sZS5sb2coJ1tBdWRpb1BsYXllcl0gUGxheWJhY2sgZmluaXNoZWQgLSBxdWV1ZSBlbXB0eSBhbmQgRkZtcGVnIGRvbmUnKTtcclxuICAgICAgdGhpcy5zdG9wKCk7XHJcbiAgICB9IGVsc2UgaWYgKGJ1ZmZlclNpemUgPT09IDApIHtcclxuICAgICAgLy8gQnVmZmVyIHVuZGVycnVuIC0gd2FpdCBmb3IgbW9yZSBkYXRhXHJcbiAgICAgIHRoaXMuYnVmZmVyVW5kZXJydW5zKys7XHJcbiAgICAgIGNvbnNvbGUubG9nKGBbQXVkaW9QbGF5ZXJdIEJ1ZmZlciB1bmRlcnJ1biAjJHt0aGlzLmJ1ZmZlclVuZGVycnVuc30sIHdhaXRpbmcgZm9yIGRhdGEuLi5gKTtcclxuICAgICAgXHJcbiAgICAgIC8vIFdhaXQgYSBiaXQgYW5kIHRyeSBhZ2FpblxyXG4gICAgICB0aGlzLm5leHRGcmFtZVRpbWUgPSBocnRpbWUuYmlnaW50KCkgKyBCaWdJbnQoNTBfMDAwXzAwMCk7IC8vIDUwbXNcclxuICAgICAgdGhpcy5zY2hlZHVsZU5leHRGcmFtZSgpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBjbGVhbnVwKCk6IHZvaWQge1xyXG4gICAgLy8gU3RvcCBwbGF5YmFjayBsb29wXHJcbiAgICB0aGlzLmlzUGxheWJhY2tMb29wUnVubmluZyA9IGZhbHNlO1xyXG4gICAgaWYgKHRoaXMucGxheWJhY2tUaW1lb3V0KSB7XHJcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLnBsYXliYWNrVGltZW91dCk7XHJcbiAgICAgIHRoaXMucGxheWJhY2tUaW1lb3V0ID0gbnVsbDtcclxuICAgIH1cclxuICAgIFxyXG4gICAgLy8gS2lsbCBGRm1wZWdcclxuICAgIGlmICh0aGlzLmZmbXBlZ1Byb2Nlc3MpIHtcclxuICAgICAgdGhpcy5mZm1wZWdQcm9jZXNzLmtpbGwoJ1NJR0tJTEwnKTtcclxuICAgICAgdGhpcy5mZm1wZWdQcm9jZXNzID0gbnVsbDtcclxuICAgIH1cclxuICAgIFxyXG4gICAgLy8gQ2xlYXIgZnJhbWUgcXVldWVcclxuICAgIHRoaXMuZnJhbWVRdWV1ZSA9IFtdO1xyXG4gICAgdGhpcy5sZWZ0b3ZlckJ1ZmZlciA9IG51bGw7XHJcbiAgICBcclxuICAgIC8vIFJlc2V0IHRpbWluZyBhbmQgc3RhdGVcclxuICAgIHRoaXMubmV4dEZyYW1lVGltZSA9IEJpZ0ludCgwKTtcclxuICAgIHRoaXMuZmZtcGVnRG9uZSA9IGZhbHNlO1xyXG4gICAgXHJcbiAgICAvLyBMb2cgc3RhdHNcclxuICAgIGlmICh0aGlzLmZyYW1lc1BsYXllZCA+IDApIHtcclxuICAgICAgY29uc29sZS5sb2coYFtBdWRpb1BsYXllcl0gUGxheWJhY2sgc3RhdHM6ICR7dGhpcy5mcmFtZXNQbGF5ZWR9IGZyYW1lcywgJHt0aGlzLmJ1ZmZlclVuZGVycnVuc30gdW5kZXJydW5zYCk7XHJcbiAgICB9XHJcbiAgICB0aGlzLmJ1ZmZlclVuZGVycnVucyA9IDA7XHJcbiAgICB0aGlzLmZyYW1lc1BsYXllZCA9IDA7XHJcbiAgICBcclxuICAgIC8vIE5vdGU6IFdlIGRvbid0IHVucHVibGlzaCB0aGUgdHJhY2sgLSBpdCBzdGF5cyBwdWJsaXNoZWQgZm9yIG5leHQgcGxheVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzZXRTdGF0ZShuZXdTdGF0ZTogQXVkaW9QbGF5ZXJTdGF0ZSk6IHZvaWQge1xyXG4gICAgY29uc3Qgb2xkU3RhdGUgPSB0aGlzLnN0YXRlO1xyXG4gICAgdGhpcy5zdGF0ZSA9IG5ld1N0YXRlO1xyXG4gICAgdGhpcy5lbWl0KCdzdGF0ZUNoYW5nZScsIG9sZFN0YXRlLCBuZXdTdGF0ZSk7XHJcbiAgICBcclxuICAgIC8vIFN0YXJ0IHBsYXliYWNrIGxvb3Agd2hlbiB0cmFuc2l0aW9uaW5nIHRvIFBsYXlpbmdcclxuICAgIGlmIChuZXdTdGF0ZS5zdGF0dXMgPT09IEF1ZGlvUGxheWVyU3RhdHVzLlBsYXlpbmcgJiYgb2xkU3RhdGUuc3RhdHVzICE9PSBBdWRpb1BsYXllclN0YXR1cy5QbGF5aW5nKSB7XHJcbiAgICAgIGNvbnNvbGUubG9nKGBbQXVkaW9QbGF5ZXJdIFN0YXRlIGNoYW5nZWQgdG8gUGxheWluZywgc3RhcnRpbmcgcGxheWJhY2sgbG9vcGApO1xyXG4gICAgICB0aGlzLnNjaGVkdWxlTmV4dEZyYW1lKCk7XHJcbiAgICB9XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogQ3JlYXRlIGFuIGF1ZGlvIHBsYXllclxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUF1ZGlvUGxheWVyKG9wdGlvbnM/OiBDcmVhdGVBdWRpb1BsYXllck9wdGlvbnMpOiBBdWRpb1BsYXllciB7XHJcbiAgcmV0dXJuIG5ldyBBdWRpb1BsYXllcihvcHRpb25zKTtcclxufVxyXG4iXX0=