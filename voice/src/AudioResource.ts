import { Readable } from 'stream';
import { spawn } from 'child_process';
import { StreamType } from './enums';
import { CreateAudioResourceOptions, AudioResourceInput } from './types';

/**
 * Represents an audio resource that can be played
 */
export class AudioResource<T = unknown> {
  /** Metadata attached to this resource */
  public readonly metadata: T;
  
  /** Whether playback has started */
  public started = false;
  
  /** Whether playback has ended */
  public ended = false;
  
  /** The input source (URL or file path) */
  private inputSource: string;
  
  /** Stream type */
  private streamType: StreamType;
  
  /** Volume (0-1) */
  private volume = 1;

  constructor(
    input: AudioResourceInput,
    options: CreateAudioResourceOptions<T> = {}
  ) {
    this.metadata = options.metadata as T;
    this.streamType = options.inputType || StreamType.Arbitrary;
    
    if (typeof input === 'string') {
      this.inputSource = input;
    } else {
      // For streams, we'd need to handle differently
      // For now, throw an error
      throw new Error('Stream input not yet supported. Use URL or file path.');
    }
  }

  /**
   * Get the input source for FFmpeg
   * @internal
   */
  getInputSource(): string {
    return this.inputSource;
  }

  /**
   * Set the volume (0-1)
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  /**
   * Get the current volume
   */
  getVolume(): number {
    return this.volume;
  }
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
export function createAudioResource<T = unknown>(
  input: AudioResourceInput,
  options?: CreateAudioResourceOptions<T>
): AudioResource<T> {
  return new AudioResource(input, options);
}

/**
 * Create an audio resource from a YouTube/streaming URL
 * Stores the original URL - extraction happens at playback time
 */
export function createAudioResourceFromUrl<T = unknown>(
  url: string,
  options: CreateAudioResourceFromUrlOptions<T> = {}
): AudioResource<T> {
  // Don't extract stream URL here - just store the original URL
  // The AudioPlayer will use yt-dlp at playback time
  return new AudioResource(url, options);
}

/**
 * Check if URL is a streaming service URL
 */
function isStreamingUrl(url: string): boolean {
  const streamingDomains = [
    'youtube.com',
    'youtu.be',
    'soundcloud.com',
    'spotify.com',
    'twitch.tv',
    'vimeo.com'
  ];
  
  return streamingDomains.some(domain => url.includes(domain));
}

/**
 * Check if input is a valid URL
 */
function isValidUrl(input: string): boolean {
  try {
    new URL(input);
    return true;
  } catch {
    return input.startsWith('http://') || input.startsWith('https://');
  }
}

/**
 * Probe audio info from a URL or search query
 * If input is not a URL, it will search YouTube
 */
export async function probeAudioInfo(input: string, ytDlpPath?: string): Promise<{
  title: string;
  duration: number;
  thumbnail?: string;
  url: string;
}> {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32';
    const defaultYtDlpPath = isWindows ? 'yt-dlp' : '~/.local/bin/yt-dlp';
    const ytdlpBin = ytDlpPath || defaultYtDlpPath;
    
    // If not a valid URL, treat as YouTube search
    let searchQuery = input;
    if (!isValidUrl(input)) {
      searchQuery = `ytsearch1:${input}`;
    }
    
    let ytdlp: ReturnType<typeof spawn>;
    
    if (isWindows) {
      // Windows: use shell with quoted command
      const cmd = `${ytdlpBin} --no-playlist --no-warnings -j "${searchQuery}"`;
      ytdlp = spawn(cmd, [], { shell: true });
    } else {
      // Unix: use bash -c with quoted string
      ytdlp = spawn('bash', [
        '-c',
        `${ytdlpBin} --no-playlist --no-warnings -j "${searchQuery}"`
      ]);
    }
    
    let stdout = '';
    let stderr = '';
    
    ytdlp.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    
    ytdlp.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    
    ytdlp.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Failed to probe audio info: ${stderr || 'Unknown error'}`));
        return;
      }
      
      try {
        const info = JSON.parse(stdout);
        resolve({
          title: info.title || 'Unknown',
          duration: info.duration || 0,
          thumbnail: info.thumbnail,
          url: info.webpage_url || info.url || input
        });
      } catch (e) {
        reject(new Error(`Failed to parse audio info: ${(e as Error).message}`));
      }
    });
    
    ytdlp.on('error', (err) => {
      reject(new Error(`Failed to probe audio info: ${err.message}`));
    });
    
    // Timeout after 30 seconds
    setTimeout(() => {
      ytdlp.kill();
      reject(new Error('Timeout waiting for audio info'));
    }, 30000);
  });
}
