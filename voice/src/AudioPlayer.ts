import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { hrtime } from 'process';
import { 
  Room, 
  LocalAudioTrack, 
  AudioSource, 
  TrackPublishOptions, 
  TrackSource,
  AudioFrame 
} from '@livekit/rtc-node';
import os from 'os';
import { AudioPlayerStatus } from './enums';
import { CreateAudioPlayerOptions, AudioPlayerState } from './types';
import { AudioResource } from './AudioResource';
import { VoiceConnection } from './VoiceConnection';
import path from 'path';

// Audio settings for LiveKit (48kHz stereo)
const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const FRAME_DURATION_MS = 20;
const SAMPLES_PER_FRAME = (SAMPLE_RATE * FRAME_DURATION_MS) / 1000; // 960

// Jitter buffer settings
const FRAME_INTERVAL_NS = BigInt(20_000_000); // 20ms in nanoseconds
const TARGET_BUFFER_FRAMES = 150; // ~3 seconds - target buffer size
const MIN_BUFFER_FRAMES = 75;    // ~1.5 seconds - minimum before we start
const MAX_BUFFER_FRAMES = 500;   // ~10 seconds - max buffer to prevent memory issues
const LOW_BUFFER_THRESHOLD = 50; // ~1 second - when to slow down playback

/**
 * Allowed URL hosts for direct audio playback.
 * Only these domains are permitted to prevent SSRF attacks.
 */
const ALLOWED_AUDIO_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'youtu.be',
  'soundcloud.com',
  'www.soundcloud.com',
  'twitch.tv',
  'www.twitch.tv',
  'clips.twitch.tv',
  // Add more allowed hosts as needed
]);

/**
 * Private/internal IP ranges that should be blocked to prevent SSRF.
 */
function isPrivateIP(hostname: string): boolean {
  // Check for localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return true;
  }
  
  // Check for common private IP patterns
  // IPv4 private ranges: 10.x.x.x, 172.16-31.x.x, 192.168.x.x
  const ipv4PrivatePatterns = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^127\./,
    /^0\./,
    /^169\.254\./, // Link-local
  ];
  
  for (const pattern of ipv4PrivatePatterns) {
    if (pattern.test(hostname)) {
      return true;
    }
  }
  
  // IPv6 private patterns
  if (hostname.startsWith('fe80:') || hostname.startsWith('fc') || hostname.startsWith('fd')) {
    return true;
  }
  
  return false;
}

/**
 * Validate URL for audio playback security.
 * Returns null if URL is invalid or blocked, otherwise returns the validated URL.
 */
function validateAudioUrl(url: string): { valid: boolean; reason?: string; hostname?: string } {
  try {
    const parsed = new URL(url);
    
    // Only allow http/https protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, reason: `Protocol not allowed: ${parsed.protocol}` };
    }
    
    const hostname = parsed.hostname.toLowerCase();
    
    // Block private/internal IPs
    if (isPrivateIP(hostname)) {
      return { valid: false, reason: `Private/internal IP blocked: ${hostname}` };
    }
    
    return { valid: true, hostname };
  } catch (e) {
    return { valid: false, reason: `Invalid URL: ${(e as Error).message}` };
  }
}

/**
 * Check if a URL host is in the allowed list for direct yt-dlp/ffmpeg processing.
 */
function isAllowedAudioHost(hostname: string): boolean {
  const normalizedHost = hostname.toLowerCase();
  
  // Check exact match or subdomain match
  for (const allowed of ALLOWED_AUDIO_HOSTS) {
    if (normalizedHost === allowed || normalizedHost.endsWith('.' + allowed)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Audio player for playing audio resources
 */
export class AudioPlayer extends EventEmitter {
  /** Current player state */
  public state: AudioPlayerState = { status: AudioPlayerStatus.Idle };
  
  /** Player options */
  private options: CreateAudioPlayerOptions;
  
  /** Subscribed voice connections */
  private subscriptions: Set<VoiceConnection> = new Set();
  
  /** Current audio resource */
  private currentResource: AudioResource | null = null;
  
  /** FFmpeg process */
  private ffmpegProcess: ChildProcess | null = null;
  
  /** yt-dlp process - kept for proper cleanup */
  private ytdlpProcess: ChildProcess | null = null;
  
  /** LiveKit audio source and track */
  private audioSource: AudioSource | null = null;
  private audioTrack: LocalAudioTrack | null = null;
  
  /** Frame queue and playback state */
  private frameQueue: Int16Array[] = [];
  private playbackTimeout: NodeJS.Timeout | null = null;
  private leftoverBuffer: Buffer | null = null;
  private isPublished = false;
  
  /** High-resolution timing */
  private nextFrameTime: bigint = BigInt(0);
  private isPlaybackLoopRunning = false;
  private ffmpegDone = false;
  
  /** Buffer statistics */
  private bufferUnderruns = 0;
  private framesPlayed = 0;

  constructor(options: CreateAudioPlayerOptions = {}) {
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
  play(resource: AudioResource): void {
    // Stop current playback
    this.stop();
    
    this.currentResource = resource;
    this.setState({ status: AudioPlayerStatus.Buffering, resource });
    
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
  pause(): boolean {
    if (this.state.status !== AudioPlayerStatus.Playing) {
      return false;
    }
    this.setState({ status: AudioPlayerStatus.Paused, resource: this.currentResource });
    return true;
  }

  /**
   * Unpause playback
   */
  unpause(): boolean {
    if (this.state.status !== AudioPlayerStatus.Paused) {
      return false;
    }
    this.setState({ status: AudioPlayerStatus.Playing, resource: this.currentResource });
    return true;
  }

  /**
   * Stop playback
   */
  stop(force = false): boolean {
    if (this.state.status === AudioPlayerStatus.Idle && !force) {
      return false;
    }
    this.cleanup();
    this.currentResource = null;
    this.setState({ status: AudioPlayerStatus.Idle });
    return true;
  }

  /**
   * Subscribe a voice connection to this player
   * @internal
   */
  subscribe(connection: VoiceConnection): void {
    this.subscriptions.add(connection);
  }

  /**
   * Unsubscribe a voice connection from this player
   * @internal
   */
  unsubscribe(connection: VoiceConnection): void {
    this.subscriptions.delete(connection);
    
    // Auto-pause if no subscribers
    if (this.subscriptions.size === 0 && this.options.behaviors?.noSubscriber === 'pause') {
      if (this.state.status === AudioPlayerStatus.Playing) {
        this.setState({ status: AudioPlayerStatus.AutoPaused, resource: this.currentResource });
      }
    }
  }

  /**
   * Called when a connection becomes ready
   * @internal
   */
  onConnectionReady(connection: VoiceConnection): void {
    // If we have a resource waiting, start playback
    if (this.currentResource && this.state.status === AudioPlayerStatus.Buffering) {
      this.startPlayback(connection);
    }
  }

  private async startPlayback(connection: VoiceConnection): Promise<void> {
    const room = connection.getRoom();
    if (!room || !this.currentResource) return;

    try {
      // Create audio source and track
      await this.setupAudioTrack(room);
      
      // Start FFmpeg to decode audio - this will set state to Playing when ready
      await this.startFFmpeg();
    } catch (error) {
      // Emit error but don't stop - let user decide what to do
      this.emit('error', { message: (error as Error).message, resource: this.currentResource });
      // Reset to idle state without full cleanup
      this.setState({ status: AudioPlayerStatus.Idle });
    }
  }

  private async setupAudioTrack(room: Room): Promise<void> {
    if (this.isPublished) return;
    
    this.audioSource = new AudioSource(SAMPLE_RATE, CHANNELS);
    this.audioTrack = LocalAudioTrack.createAudioTrack('music', this.audioSource);
    
    const options = new TrackPublishOptions();
    options.source = TrackSource.SOURCE_MICROPHONE;
    
    if (room.localParticipant) {
      await room.localParticipant.publishTrack(this.audioTrack, options);
    }
    this.isPublished = true;
  }

  private async startFFmpeg(): Promise<void> {
    if (!this.currentResource) return;
    
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
    
    // SECURITY: Validate URL to prevent SSRF attacks
    let useYtDlp = false;
    
    if (inputSource.startsWith('http://') || inputSource.startsWith('https://')) {
      const validation = validateAudioUrl(inputSource);
      if (!validation.valid) {
        throw new Error(`URL validation failed: ${validation.reason}`);
      }
      
      // Check if host is in allowed list for yt-dlp processing
      if (validation.hostname && isAllowedAudioHost(validation.hostname)) {
        useYtDlp = true;
      } else {
        // For non-allowed hosts, we block the request entirely for security
        // Direct ffmpeg access to arbitrary URLs is a security risk (SSRF)
        throw new Error(`Audio host not allowed: ${validation.hostname}. Only YouTube, SoundCloud, and Twitch are supported.`);
      }
    } else if (inputSource.startsWith('ytsearch')) {
      // Search queries always go through yt-dlp
      useYtDlp = true;
    }
    
    if (useYtDlp) {
      // Use yt-dlp to pipe audio directly to FFmpeg
      console.log('Using yt-dlp pipe mode');
      
      // SECURITY: Properly resolve yt-dlp path using os.homedir()
      // On Windows, yt-dlp is typically in PATH
      // On Linux/macOS, it may be in ~/.local/bin
      let ytDlpPath: string;
      if (process.platform === 'win32') {
        ytDlpPath = 'yt-dlp';
      } else {
        // Use os.homedir() to properly expand ~
        ytDlpPath = path.join(os.homedir(), '.local', 'bin', 'yt-dlp');
      }
      
      // SECURITY: Use args array (no shell) to prevent command injection
      // The '--' separator ensures inputSource is treated as a positional arg, not an option
      const ytdlpArgs = [
        '-f', 'bestaudio/best',
        '-o', '-',
        '--no-playlist',
        '--no-warnings',
        '--default-search', 'ytsearch',
        '--', // SECURITY: Separator to prevent option injection
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
      this.ytdlpProcess = spawn(ytDlpPath, ytdlpArgs, { 
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false
      });
      
      // Spawn ffmpeg without shell, with protocol whitelist
      this.ffmpegProcess = spawn('ffmpeg', ffmpegArgs, { 
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false
      });
      
      // Track data flow
      let ytdlpDataReceived = 0;
      
      this.ytdlpProcess.stdout?.on('data', (chunk: Buffer) => {
        ytdlpDataReceived += chunk.length;
        if (ytdlpDataReceived < 10000 || ytdlpDataReceived % 100000 < 10000) {
          console.log(`[yt-dlp] stdout data: ${chunk.length} bytes (total: ${ytdlpDataReceived})`);
        }
      });
      
      // Pipe yt-dlp stdout to ffmpeg stdin
      this.ytdlpProcess.stdout?.pipe(this.ffmpegProcess.stdin!);
      
      // Handle yt-dlp stderr - log everything for debugging
      this.ytdlpProcess.stderr?.on('data', (data: Buffer) => {
        const msg = data.toString().trim();
        if (msg) {
          console.log('[yt-dlp]', msg);
        }
      });
      
      this.ytdlpProcess.on('error', (err) => {
        console.error('[yt-dlp] process error:', err.message);
      });
      
      this.ytdlpProcess.on('close', (code) => {
        console.log(`[yt-dlp] closed with code ${code}, total data: ${ytdlpDataReceived} bytes`);
        this.ytdlpProcess = null;
      });
    } else {
      // This branch should not be reached due to security checks above
      // But kept for safety - direct FFmpeg mode with protocol whitelist
      console.log('Using direct FFmpeg mode');
      this.ffmpegProcess = spawn('ffmpeg', [
        '-reconnect', '1',
        '-reconnect_streamed', '1',
        '-reconnect_delay_max', '5',
        // SECURITY: Restrict allowed protocols to prevent SSRF
        '-protocol_whitelist', 'http,https,tcp,tls,crypto,pipe',
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

    this.ffmpegProcess.stdout?.on('data', (chunk: Buffer) => {
      if (this.state.status !== AudioPlayerStatus.Playing && 
          this.state.status !== AudioPlayerStatus.Buffering) return;
      
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
    this.ffmpegProcess.stderr?.on('data', (data: Buffer) => {
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
    this.nextFrameTime = hrtime.bigint();
    console.log(`[AudioPlayer] Playback ready, audioSource exists: ${!!this.audioSource}`);
    
    // Set state to playing - this will trigger scheduleNextFrame via setState
    this.setState({ status: AudioPlayerStatus.Playing, resource: this.currentResource });
  }

  /**
   * High-resolution frame scheduling using hrtime
   * This provides much more accurate timing than setInterval
   */
  private scheduleNextFrame(): void {
    if (!this.isPlaybackLoopRunning || this.state.status !== AudioPlayerStatus.Playing) {
      console.log(`[AudioPlayer] scheduleNextFrame skipped: loopRunning=${this.isPlaybackLoopRunning}, status=${this.state.status}`);
      return;
    }

    const now = hrtime.bigint();
    const delayNs = this.nextFrameTime - now;
    const delayMs = Number(delayNs) / 1_000_000;

    if (this.framesPlayed === 0) {
      console.log(`[AudioPlayer] First frame scheduling: delayMs=${delayMs.toFixed(2)}`);
    }

    // Schedule next frame
    if (delayMs > 1) {
      this.playbackTimeout = setTimeout(() => this.processFrame(), Math.max(1, delayMs - 1));
    } else {
      // We're behind, process immediately
      setImmediate(() => this.processFrame());
    }
  }

  /**
   * Process and send a single audio frame
   */
  private async processFrame(): Promise<void> {
    if (!this.isPlaybackLoopRunning || this.state.status !== AudioPlayerStatus.Playing) {
      if (this.framesPlayed === 0) {
        console.log(`[AudioPlayer] processFrame skipped: loopRunning=${this.isPlaybackLoopRunning}, status=${this.state.status}`);
      }
      return;
    }

    // Check buffer status
    const bufferSize = this.frameQueue.length;
    
    if (bufferSize > 0 && this.audioSource) {
      const int16Array = this.frameQueue.shift()!;
      const audioFrame = new AudioFrame(int16Array, SAMPLE_RATE, CHANNELS, SAMPLES_PER_FRAME);
      
      try {
        await this.audioSource.captureFrame(audioFrame);
        this.framesPlayed++;
        
        // Log progress every 500 frames (~10 seconds)
        if (this.framesPlayed % 500 === 0) {
          console.log(`[AudioPlayer] Progress: ${this.framesPlayed} frames played, buffer: ${bufferSize}`);
        }
      } catch (e) {
        console.error(`[AudioPlayer] Frame error:`, (e as Error).message);
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
      
    } else if (this.ffmpegDone && bufferSize === 0) {
      // Playback finished
      console.log('[AudioPlayer] Playback finished - queue empty and FFmpeg done');
      this.stop();
    } else if (bufferSize === 0) {
      // Buffer underrun - wait for more data
      this.bufferUnderruns++;
      console.log(`[AudioPlayer] Buffer underrun #${this.bufferUnderruns}, waiting for data...`);
      
      // Wait a bit and try again
      this.nextFrameTime = hrtime.bigint() + BigInt(50_000_000); // 50ms
      this.scheduleNextFrame();
    }
  }

  private cleanup(): void {
    // Stop playback loop
    this.isPlaybackLoopRunning = false;
    if (this.playbackTimeout) {
      clearTimeout(this.playbackTimeout);
      this.playbackTimeout = null;
    }
    
    // Kill yt-dlp process if running
    if (this.ytdlpProcess) {
      try {
        this.ytdlpProcess.kill('SIGKILL');
      } catch (e) {
        // Process may have already exited
      }
      this.ytdlpProcess = null;
    }
    
    // Kill FFmpeg
    if (this.ffmpegProcess) {
      try {
        this.ffmpegProcess.kill('SIGKILL');
      } catch (e) {
        // Process may have already exited
      }
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

  private setState(newState: AudioPlayerState): void {
    const oldState = this.state;
    this.state = newState;
    this.emit('stateChange', oldState, newState);
    
    // Start playback loop when transitioning to Playing
    if (newState.status === AudioPlayerStatus.Playing && oldState.status !== AudioPlayerStatus.Playing) {
      console.log(`[AudioPlayer] State changed to Playing, starting playback loop`);
      this.scheduleNextFrame();
    }
  }
}

/**
 * Create an audio player
 */
export function createAudioPlayer(options?: CreateAudioPlayerOptions): AudioPlayer {
  return new AudioPlayer(options);
}
