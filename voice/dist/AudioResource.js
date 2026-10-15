"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioResource = void 0;
exports.createAudioResource = createAudioResource;
exports.createAudioResourceFromUrl = createAudioResourceFromUrl;
exports.probeAudioInfo = probeAudioInfo;
const child_process_1 = require("child_process");
const enums_1 = require("./enums");
/**
 * Represents an audio resource that can be played
 */
class AudioResource {
    /** Metadata attached to this resource */
    metadata;
    /** Whether playback has started */
    started = false;
    /** Whether playback has ended */
    ended = false;
    /** The input source (URL or file path) */
    inputSource;
    /** Stream type */
    streamType;
    /** Volume (0-1) */
    volume = 1;
    constructor(input, options = {}) {
        this.metadata = options.metadata;
        this.streamType = options.inputType || enums_1.StreamType.Arbitrary;
        if (typeof input === 'string') {
            this.inputSource = input;
        }
        else {
            // For streams, we'd need to handle differently
            // For now, throw an error
            throw new Error('Stream input not yet supported. Use URL or file path.');
        }
    }
    /**
     * Get the input source for FFmpeg
     * @internal
     */
    getInputSource() {
        return this.inputSource;
    }
    /**
     * Set the volume (0-1)
     */
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
    }
    /**
     * Get the current volume
     */
    getVolume() {
        return this.volume;
    }
}
exports.AudioResource = AudioResource;
/**
 * Create an audio resource from various inputs
 */
function createAudioResource(input, options) {
    return new AudioResource(input, options);
}
/**
 * Create an audio resource from a YouTube/streaming URL
 * Stores the original URL - extraction happens at playback time
 */
function createAudioResourceFromUrl(url, options = {}) {
    // Don't extract stream URL here - just store the original URL
    // The AudioPlayer will use yt-dlp at playback time
    return new AudioResource(url, options);
}
/**
 * Check if URL is a streaming service URL
 */
function isStreamingUrl(url) {
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
function isValidUrl(input) {
    try {
        new URL(input);
        return true;
    }
    catch {
        return input.startsWith('http://') || input.startsWith('https://');
    }
}
/**
 * Probe audio info from a URL or search query
 * If input is not a URL, it will search YouTube
 */
async function probeAudioInfo(input, ytDlpPath) {
    return new Promise((resolve, reject) => {
        const isWindows = process.platform === 'win32';
        const defaultYtDlpPath = isWindows ? 'yt-dlp' : '~/.local/bin/yt-dlp';
        const ytdlpBin = ytDlpPath || defaultYtDlpPath;
        // If not a valid URL, treat as YouTube search
        let searchQuery = input;
        if (!isValidUrl(input)) {
            searchQuery = `ytsearch1:${input}`;
        }
        // SECURITY: Use spawn with arguments array instead of shell to prevent command injection
        // Never pass user input through shell interpolation
        const args = ['--no-playlist', '--no-warnings', '-j', searchQuery];
        console.log('[probeAudioInfo] Running:', ytdlpBin, args.join(' '));
        // Spawn without shell - arguments are passed safely as array
        const ytdlp = (0, child_process_1.spawn)(ytdlpBin, args, {
            shell: false,
            // On Unix, if ytdlpBin contains ~, expand it
            env: process.env
        });
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
                reject(new Error(`yt-dlp failed (code ${code}): ${stderr || 'Unknown error'}`));
                return;
            }
            if (!stdout.trim()) {
                reject(new Error(`yt-dlp returned empty response. stderr: ${stderr}`));
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
            }
            catch (e) {
                reject(new Error(`Failed to parse yt-dlp output: ${stdout.substring(0, 200)}`));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQXVkaW9SZXNvdXJjZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9BdWRpb1Jlc291cmNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQStFQSxrREFLQztBQU1ELGdFQU9DO0FBa0NELHdDQTJFQztBQTdNRCxpREFBc0M7QUFDdEMsbUNBQXFDO0FBR3JDOztHQUVHO0FBQ0gsTUFBYSxhQUFhO0lBQ3hCLHlDQUF5QztJQUN6QixRQUFRLENBQUk7SUFFNUIsbUNBQW1DO0lBQzVCLE9BQU8sR0FBRyxLQUFLLENBQUM7SUFFdkIsaUNBQWlDO0lBQzFCLEtBQUssR0FBRyxLQUFLLENBQUM7SUFFckIsMENBQTBDO0lBQ2xDLFdBQVcsQ0FBUztJQUU1QixrQkFBa0I7SUFDVixVQUFVLENBQWE7SUFFL0IsbUJBQW1CO0lBQ1gsTUFBTSxHQUFHLENBQUMsQ0FBQztJQUVuQixZQUNFLEtBQXlCLEVBQ3pCLFVBQXlDLEVBQUU7UUFFM0MsSUFBSSxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsUUFBYSxDQUFDO1FBQ3RDLElBQUksQ0FBQyxVQUFVLEdBQUcsT0FBTyxDQUFDLFNBQVMsSUFBSSxrQkFBVSxDQUFDLFNBQVMsQ0FBQztRQUU1RCxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQzlCLElBQUksQ0FBQyxXQUFXLEdBQUcsS0FBSyxDQUFDO1FBQzNCLENBQUM7YUFBTSxDQUFDO1lBQ04sK0NBQStDO1lBQy9DLDBCQUEwQjtZQUMxQixNQUFNLElBQUksS0FBSyxDQUFDLHVEQUF1RCxDQUFDLENBQUM7UUFDM0UsQ0FBQztJQUNILENBQUM7SUFFRDs7O09BR0c7SUFDSCxjQUFjO1FBQ1osT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDO0lBQzFCLENBQUM7SUFFRDs7T0FFRztJQUNILFNBQVMsQ0FBQyxNQUFjO1FBQ3RCLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQztJQUNqRCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxTQUFTO1FBQ1AsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDO0lBQ3JCLENBQUM7Q0FDRjtBQXhERCxzQ0F3REM7QUFZRDs7R0FFRztBQUNILFNBQWdCLG1CQUFtQixDQUNqQyxLQUF5QixFQUN6QixPQUF1QztJQUV2QyxPQUFPLElBQUksYUFBYSxDQUFDLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQztBQUMzQyxDQUFDO0FBRUQ7OztHQUdHO0FBQ0gsU0FBZ0IsMEJBQTBCLENBQ3hDLEdBQVcsRUFDWCxVQUFnRCxFQUFFO0lBRWxELDhEQUE4RDtJQUM5RCxtREFBbUQ7SUFDbkQsT0FBTyxJQUFJLGFBQWEsQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDekMsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBUyxjQUFjLENBQUMsR0FBVztJQUNqQyxNQUFNLGdCQUFnQixHQUFHO1FBQ3ZCLGFBQWE7UUFDYixVQUFVO1FBQ1YsZ0JBQWdCO1FBQ2hCLGFBQWE7UUFDYixXQUFXO1FBQ1gsV0FBVztLQUNaLENBQUM7SUFFRixPQUFPLGdCQUFnQixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztBQUMvRCxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLFVBQVUsQ0FBQyxLQUFhO0lBQy9CLElBQUksQ0FBQztRQUNILElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ2YsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBQUMsTUFBTSxDQUFDO1FBQ1AsT0FBTyxLQUFLLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDckUsQ0FBQztBQUNILENBQUM7QUFFRDs7O0dBR0c7QUFDSSxLQUFLLFVBQVUsY0FBYyxDQUFDLEtBQWEsRUFBRSxTQUFrQjtJQU1wRSxPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO1FBQ3JDLE1BQU0sU0FBUyxHQUFHLE9BQU8sQ0FBQyxRQUFRLEtBQUssT0FBTyxDQUFDO1FBQy9DLE1BQU0sZ0JBQWdCLEdBQUcsU0FBUyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLHFCQUFxQixDQUFDO1FBQ3RFLE1BQU0sUUFBUSxHQUFHLFNBQVMsSUFBSSxnQkFBZ0IsQ0FBQztRQUUvQyw4Q0FBOEM7UUFDOUMsSUFBSSxXQUFXLEdBQUcsS0FBSyxDQUFDO1FBQ3hCLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUN2QixXQUFXLEdBQUcsYUFBYSxLQUFLLEVBQUUsQ0FBQztRQUNyQyxDQUFDO1FBRUQseUZBQXlGO1FBQ3pGLG9EQUFvRDtRQUNwRCxNQUFNLElBQUksR0FBRyxDQUFDLGVBQWUsRUFBRSxlQUFlLEVBQUUsSUFBSSxFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBRW5FLE9BQU8sQ0FBQyxHQUFHLENBQUMsMkJBQTJCLEVBQUUsUUFBUSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUVuRSw2REFBNkQ7UUFDN0QsTUFBTSxLQUFLLEdBQUcsSUFBQSxxQkFBSyxFQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUU7WUFDbEMsS0FBSyxFQUFFLEtBQUs7WUFDWiw2Q0FBNkM7WUFDN0MsR0FBRyxFQUFFLE9BQU8sQ0FBQyxHQUFHO1NBQ2pCLENBQUMsQ0FBQztRQUVILElBQUksTUFBTSxHQUFHLEVBQUUsQ0FBQztRQUNoQixJQUFJLE1BQU0sR0FBRyxFQUFFLENBQUM7UUFFaEIsS0FBSyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsTUFBTSxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUU7WUFDaEMsTUFBTSxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUM1QixDQUFDLENBQUMsQ0FBQztRQUVILEtBQUssQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLE1BQU0sRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFO1lBQ2hDLE1BQU0sSUFBSSxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDNUIsQ0FBQyxDQUFDLENBQUM7UUFFSCxLQUFLLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFO1lBQ3pCLElBQUksSUFBSSxLQUFLLENBQUMsRUFBRSxDQUFDO2dCQUNmLE1BQU0sQ0FBQyxJQUFJLEtBQUssQ0FBQyx1QkFBdUIsSUFBSSxNQUFNLE1BQU0sSUFBSSxlQUFlLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQ2hGLE9BQU87WUFDVCxDQUFDO1lBRUQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDO2dCQUNuQixNQUFNLENBQUMsSUFBSSxLQUFLLENBQUMsMkNBQTJDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDdkUsT0FBTztZQUNULENBQUM7WUFFRCxJQUFJLENBQUM7Z0JBQ0gsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFDaEMsT0FBTyxDQUFDO29CQUNOLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSyxJQUFJLFNBQVM7b0JBQzlCLFFBQVEsRUFBRSxJQUFJLENBQUMsUUFBUSxJQUFJLENBQUM7b0JBQzVCLFNBQVMsRUFBRSxJQUFJLENBQUMsU0FBUztvQkFDekIsR0FBRyxFQUFFLElBQUksQ0FBQyxXQUFXLElBQUksSUFBSSxDQUFDLEdBQUcsSUFBSSxLQUFLO2lCQUMzQyxDQUFDLENBQUM7WUFDTCxDQUFDO1lBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztnQkFDWCxNQUFNLENBQUMsSUFBSSxLQUFLLENBQUMsa0NBQWtDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ2xGLENBQUM7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUVILEtBQUssQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFLENBQUMsR0FBRyxFQUFFLEVBQUU7WUFDeEIsTUFBTSxDQUFDLElBQUksS0FBSyxDQUFDLCtCQUErQixHQUFHLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ2xFLENBQUMsQ0FBQyxDQUFDO1FBRUgsMkJBQTJCO1FBQzNCLFVBQVUsQ0FBQyxHQUFHLEVBQUU7WUFDZCxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDYixNQUFNLENBQUMsSUFBSSxLQUFLLENBQUMsZ0NBQWdDLENBQUMsQ0FBQyxDQUFDO1FBQ3RELENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUNaLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFJlYWRhYmxlIH0gZnJvbSAnc3RyZWFtJztcclxuaW1wb3J0IHsgc3Bhd24gfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcclxuaW1wb3J0IHsgU3RyZWFtVHlwZSB9IGZyb20gJy4vZW51bXMnO1xyXG5pbXBvcnQgeyBDcmVhdGVBdWRpb1Jlc291cmNlT3B0aW9ucywgQXVkaW9SZXNvdXJjZUlucHV0IH0gZnJvbSAnLi90eXBlcyc7XHJcblxyXG4vKipcclxuICogUmVwcmVzZW50cyBhbiBhdWRpbyByZXNvdXJjZSB0aGF0IGNhbiBiZSBwbGF5ZWRcclxuICovXHJcbmV4cG9ydCBjbGFzcyBBdWRpb1Jlc291cmNlPFQgPSB1bmtub3duPiB7XHJcbiAgLyoqIE1ldGFkYXRhIGF0dGFjaGVkIHRvIHRoaXMgcmVzb3VyY2UgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgbWV0YWRhdGE6IFQ7XHJcbiAgXHJcbiAgLyoqIFdoZXRoZXIgcGxheWJhY2sgaGFzIHN0YXJ0ZWQgKi9cclxuICBwdWJsaWMgc3RhcnRlZCA9IGZhbHNlO1xyXG4gIFxyXG4gIC8qKiBXaGV0aGVyIHBsYXliYWNrIGhhcyBlbmRlZCAqL1xyXG4gIHB1YmxpYyBlbmRlZCA9IGZhbHNlO1xyXG4gIFxyXG4gIC8qKiBUaGUgaW5wdXQgc291cmNlIChVUkwgb3IgZmlsZSBwYXRoKSAqL1xyXG4gIHByaXZhdGUgaW5wdXRTb3VyY2U6IHN0cmluZztcclxuICBcclxuICAvKiogU3RyZWFtIHR5cGUgKi9cclxuICBwcml2YXRlIHN0cmVhbVR5cGU6IFN0cmVhbVR5cGU7XHJcbiAgXHJcbiAgLyoqIFZvbHVtZSAoMC0xKSAqL1xyXG4gIHByaXZhdGUgdm9sdW1lID0gMTtcclxuXHJcbiAgY29uc3RydWN0b3IoXHJcbiAgICBpbnB1dDogQXVkaW9SZXNvdXJjZUlucHV0LFxyXG4gICAgb3B0aW9uczogQ3JlYXRlQXVkaW9SZXNvdXJjZU9wdGlvbnM8VD4gPSB7fVxyXG4gICkge1xyXG4gICAgdGhpcy5tZXRhZGF0YSA9IG9wdGlvbnMubWV0YWRhdGEgYXMgVDtcclxuICAgIHRoaXMuc3RyZWFtVHlwZSA9IG9wdGlvbnMuaW5wdXRUeXBlIHx8IFN0cmVhbVR5cGUuQXJiaXRyYXJ5O1xyXG4gICAgXHJcbiAgICBpZiAodHlwZW9mIGlucHV0ID09PSAnc3RyaW5nJykge1xyXG4gICAgICB0aGlzLmlucHV0U291cmNlID0gaW5wdXQ7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAvLyBGb3Igc3RyZWFtcywgd2UnZCBuZWVkIHRvIGhhbmRsZSBkaWZmZXJlbnRseVxyXG4gICAgICAvLyBGb3Igbm93LCB0aHJvdyBhbiBlcnJvclxyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1N0cmVhbSBpbnB1dCBub3QgeWV0IHN1cHBvcnRlZC4gVXNlIFVSTCBvciBmaWxlIHBhdGguJyk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgdGhlIGlucHV0IHNvdXJjZSBmb3IgRkZtcGVnXHJcbiAgICogQGludGVybmFsXHJcbiAgICovXHJcbiAgZ2V0SW5wdXRTb3VyY2UoKTogc3RyaW5nIHtcclxuICAgIHJldHVybiB0aGlzLmlucHV0U291cmNlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2V0IHRoZSB2b2x1bWUgKDAtMSlcclxuICAgKi9cclxuICBzZXRWb2x1bWUodm9sdW1lOiBudW1iZXIpOiB2b2lkIHtcclxuICAgIHRoaXMudm9sdW1lID0gTWF0aC5tYXgoMCwgTWF0aC5taW4oMSwgdm9sdW1lKSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgdGhlIGN1cnJlbnQgdm9sdW1lXHJcbiAgICovXHJcbiAgZ2V0Vm9sdW1lKCk6IG51bWJlciB7XHJcbiAgICByZXR1cm4gdGhpcy52b2x1bWU7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogT3B0aW9ucyBmb3IgY3JlYXRpbmcgYXVkaW8gcmVzb3VyY2UgZnJvbSBVUkxcclxuICovXHJcbmV4cG9ydCBpbnRlcmZhY2UgQ3JlYXRlQXVkaW9SZXNvdXJjZUZyb21VcmxPcHRpb25zPFQgPSB1bmtub3duPiBleHRlbmRzIENyZWF0ZUF1ZGlvUmVzb3VyY2VPcHRpb25zPFQ+IHtcclxuICAvKiogVXNlIHl0LWRscCB0byBleHRyYWN0IGF1ZGlvIFVSTCAqL1xyXG4gIHVzZVl0RGxwPzogYm9vbGVhbjtcclxuICAvKiogUGF0aCB0byB5dC1kbHAgYmluYXJ5ICovXHJcbiAgeXREbHBQYXRoPzogc3RyaW5nO1xyXG59XHJcblxyXG4vKipcclxuICogQ3JlYXRlIGFuIGF1ZGlvIHJlc291cmNlIGZyb20gdmFyaW91cyBpbnB1dHNcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVBdWRpb1Jlc291cmNlPFQgPSB1bmtub3duPihcclxuICBpbnB1dDogQXVkaW9SZXNvdXJjZUlucHV0LFxyXG4gIG9wdGlvbnM/OiBDcmVhdGVBdWRpb1Jlc291cmNlT3B0aW9uczxUPlxyXG4pOiBBdWRpb1Jlc291cmNlPFQ+IHtcclxuICByZXR1cm4gbmV3IEF1ZGlvUmVzb3VyY2UoaW5wdXQsIG9wdGlvbnMpO1xyXG59XHJcblxyXG4vKipcclxuICogQ3JlYXRlIGFuIGF1ZGlvIHJlc291cmNlIGZyb20gYSBZb3VUdWJlL3N0cmVhbWluZyBVUkxcclxuICogU3RvcmVzIHRoZSBvcmlnaW5hbCBVUkwgLSBleHRyYWN0aW9uIGhhcHBlbnMgYXQgcGxheWJhY2sgdGltZVxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUF1ZGlvUmVzb3VyY2VGcm9tVXJsPFQgPSB1bmtub3duPihcclxuICB1cmw6IHN0cmluZyxcclxuICBvcHRpb25zOiBDcmVhdGVBdWRpb1Jlc291cmNlRnJvbVVybE9wdGlvbnM8VD4gPSB7fVxyXG4pOiBBdWRpb1Jlc291cmNlPFQ+IHtcclxuICAvLyBEb24ndCBleHRyYWN0IHN0cmVhbSBVUkwgaGVyZSAtIGp1c3Qgc3RvcmUgdGhlIG9yaWdpbmFsIFVSTFxyXG4gIC8vIFRoZSBBdWRpb1BsYXllciB3aWxsIHVzZSB5dC1kbHAgYXQgcGxheWJhY2sgdGltZVxyXG4gIHJldHVybiBuZXcgQXVkaW9SZXNvdXJjZSh1cmwsIG9wdGlvbnMpO1xyXG59XHJcblxyXG4vKipcclxuICogQ2hlY2sgaWYgVVJMIGlzIGEgc3RyZWFtaW5nIHNlcnZpY2UgVVJMXHJcbiAqL1xyXG5mdW5jdGlvbiBpc1N0cmVhbWluZ1VybCh1cmw6IHN0cmluZyk6IGJvb2xlYW4ge1xyXG4gIGNvbnN0IHN0cmVhbWluZ0RvbWFpbnMgPSBbXHJcbiAgICAneW91dHViZS5jb20nLFxyXG4gICAgJ3lvdXR1LmJlJyxcclxuICAgICdzb3VuZGNsb3VkLmNvbScsXHJcbiAgICAnc3BvdGlmeS5jb20nLFxyXG4gICAgJ3R3aXRjaC50dicsXHJcbiAgICAndmltZW8uY29tJ1xyXG4gIF07XHJcbiAgXHJcbiAgcmV0dXJuIHN0cmVhbWluZ0RvbWFpbnMuc29tZShkb21haW4gPT4gdXJsLmluY2x1ZGVzKGRvbWFpbikpO1xyXG59XHJcblxyXG4vKipcclxuICogQ2hlY2sgaWYgaW5wdXQgaXMgYSB2YWxpZCBVUkxcclxuICovXHJcbmZ1bmN0aW9uIGlzVmFsaWRVcmwoaW5wdXQ6IHN0cmluZyk6IGJvb2xlYW4ge1xyXG4gIHRyeSB7XHJcbiAgICBuZXcgVVJMKGlucHV0KTtcclxuICAgIHJldHVybiB0cnVlO1xyXG4gIH0gY2F0Y2gge1xyXG4gICAgcmV0dXJuIGlucHV0LnN0YXJ0c1dpdGgoJ2h0dHA6Ly8nKSB8fCBpbnB1dC5zdGFydHNXaXRoKCdodHRwczovLycpO1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIFByb2JlIGF1ZGlvIGluZm8gZnJvbSBhIFVSTCBvciBzZWFyY2ggcXVlcnlcclxuICogSWYgaW5wdXQgaXMgbm90IGEgVVJMLCBpdCB3aWxsIHNlYXJjaCBZb3VUdWJlXHJcbiAqL1xyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcHJvYmVBdWRpb0luZm8oaW5wdXQ6IHN0cmluZywgeXREbHBQYXRoPzogc3RyaW5nKTogUHJvbWlzZTx7XHJcbiAgdGl0bGU6IHN0cmluZztcclxuICBkdXJhdGlvbjogbnVtYmVyO1xyXG4gIHRodW1ibmFpbD86IHN0cmluZztcclxuICB1cmw6IHN0cmluZztcclxufT4ge1xyXG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICBjb25zdCBpc1dpbmRvd3MgPSBwcm9jZXNzLnBsYXRmb3JtID09PSAnd2luMzInO1xyXG4gICAgY29uc3QgZGVmYXVsdFl0RGxwUGF0aCA9IGlzV2luZG93cyA/ICd5dC1kbHAnIDogJ34vLmxvY2FsL2Jpbi95dC1kbHAnO1xyXG4gICAgY29uc3QgeXRkbHBCaW4gPSB5dERscFBhdGggfHwgZGVmYXVsdFl0RGxwUGF0aDtcclxuICAgIFxyXG4gICAgLy8gSWYgbm90IGEgdmFsaWQgVVJMLCB0cmVhdCBhcyBZb3VUdWJlIHNlYXJjaFxyXG4gICAgbGV0IHNlYXJjaFF1ZXJ5ID0gaW5wdXQ7XHJcbiAgICBpZiAoIWlzVmFsaWRVcmwoaW5wdXQpKSB7XHJcbiAgICAgIHNlYXJjaFF1ZXJ5ID0gYHl0c2VhcmNoMToke2lucHV0fWA7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIFNFQ1VSSVRZOiBVc2Ugc3Bhd24gd2l0aCBhcmd1bWVudHMgYXJyYXkgaW5zdGVhZCBvZiBzaGVsbCB0byBwcmV2ZW50IGNvbW1hbmQgaW5qZWN0aW9uXHJcbiAgICAvLyBOZXZlciBwYXNzIHVzZXIgaW5wdXQgdGhyb3VnaCBzaGVsbCBpbnRlcnBvbGF0aW9uXHJcbiAgICBjb25zdCBhcmdzID0gWyctLW5vLXBsYXlsaXN0JywgJy0tbm8td2FybmluZ3MnLCAnLWonLCBzZWFyY2hRdWVyeV07XHJcbiAgICBcclxuICAgIGNvbnNvbGUubG9nKCdbcHJvYmVBdWRpb0luZm9dIFJ1bm5pbmc6JywgeXRkbHBCaW4sIGFyZ3Muam9pbignICcpKTtcclxuICAgIFxyXG4gICAgLy8gU3Bhd24gd2l0aG91dCBzaGVsbCAtIGFyZ3VtZW50cyBhcmUgcGFzc2VkIHNhZmVseSBhcyBhcnJheVxyXG4gICAgY29uc3QgeXRkbHAgPSBzcGF3bih5dGRscEJpbiwgYXJncywgeyBcclxuICAgICAgc2hlbGw6IGZhbHNlLFxyXG4gICAgICAvLyBPbiBVbml4LCBpZiB5dGRscEJpbiBjb250YWlucyB+LCBleHBhbmQgaXRcclxuICAgICAgZW52OiBwcm9jZXNzLmVudlxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIGxldCBzdGRvdXQgPSAnJztcclxuICAgIGxldCBzdGRlcnIgPSAnJztcclxuICAgIFxyXG4gICAgeXRkbHAuc3Rkb3V0Py5vbignZGF0YScsIChkYXRhKSA9PiB7XHJcbiAgICAgIHN0ZG91dCArPSBkYXRhLnRvU3RyaW5nKCk7XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgeXRkbHAuc3RkZXJyPy5vbignZGF0YScsIChkYXRhKSA9PiB7XHJcbiAgICAgIHN0ZGVyciArPSBkYXRhLnRvU3RyaW5nKCk7XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgeXRkbHAub24oJ2Nsb3NlJywgKGNvZGUpID0+IHtcclxuICAgICAgaWYgKGNvZGUgIT09IDApIHtcclxuICAgICAgICByZWplY3QobmV3IEVycm9yKGB5dC1kbHAgZmFpbGVkIChjb2RlICR7Y29kZX0pOiAke3N0ZGVyciB8fCAnVW5rbm93biBlcnJvcid9YCkpO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG4gICAgICBcclxuICAgICAgaWYgKCFzdGRvdXQudHJpbSgpKSB7XHJcbiAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihgeXQtZGxwIHJldHVybmVkIGVtcHR5IHJlc3BvbnNlLiBzdGRlcnI6ICR7c3RkZXJyfWApKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuICAgICAgXHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgaW5mbyA9IEpTT04ucGFyc2Uoc3Rkb3V0KTtcclxuICAgICAgICByZXNvbHZlKHtcclxuICAgICAgICAgIHRpdGxlOiBpbmZvLnRpdGxlIHx8ICdVbmtub3duJyxcclxuICAgICAgICAgIGR1cmF0aW9uOiBpbmZvLmR1cmF0aW9uIHx8IDAsXHJcbiAgICAgICAgICB0aHVtYm5haWw6IGluZm8udGh1bWJuYWlsLFxyXG4gICAgICAgICAgdXJsOiBpbmZvLndlYnBhZ2VfdXJsIHx8IGluZm8udXJsIHx8IGlucHV0XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICByZWplY3QobmV3IEVycm9yKGBGYWlsZWQgdG8gcGFyc2UgeXQtZGxwIG91dHB1dDogJHtzdGRvdXQuc3Vic3RyaW5nKDAsIDIwMCl9YCkpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgeXRkbHAub24oJ2Vycm9yJywgKGVycikgPT4ge1xyXG4gICAgICByZWplY3QobmV3IEVycm9yKGBGYWlsZWQgdG8gcHJvYmUgYXVkaW8gaW5mbzogJHtlcnIubWVzc2FnZX1gKSk7XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgLy8gVGltZW91dCBhZnRlciAzMCBzZWNvbmRzXHJcbiAgICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgeXRkbHAua2lsbCgpO1xyXG4gICAgICByZWplY3QobmV3IEVycm9yKCdUaW1lb3V0IHdhaXRpbmcgZm9yIGF1ZGlvIGluZm8nKSk7XHJcbiAgICB9LCAzMDAwMCk7XHJcbiAgfSk7XHJcbn1cclxuIl19