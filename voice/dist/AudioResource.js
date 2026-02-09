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
        let ytdlp;
        if (isWindows) {
            // Windows: use shell with quoted command
            const cmd = `${ytdlpBin} --no-playlist --no-warnings -j "${searchQuery}"`;
            ytdlp = (0, child_process_1.spawn)(cmd, [], { shell: true });
        }
        else {
            // Unix: use bash -c with quoted string
            ytdlp = (0, child_process_1.spawn)('bash', [
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
            }
            catch (e) {
                reject(new Error(`Failed to parse audio info: ${e.message}`));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQXVkaW9SZXNvdXJjZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9BdWRpb1Jlc291cmNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQStFQSxrREFLQztBQU1ELGdFQU9DO0FBa0NELHdDQXVFQztBQXpNRCxpREFBc0M7QUFDdEMsbUNBQXFDO0FBR3JDOztHQUVHO0FBQ0gsTUFBYSxhQUFhO0lBQ3hCLHlDQUF5QztJQUN6QixRQUFRLENBQUk7SUFFNUIsbUNBQW1DO0lBQzVCLE9BQU8sR0FBRyxLQUFLLENBQUM7SUFFdkIsaUNBQWlDO0lBQzFCLEtBQUssR0FBRyxLQUFLLENBQUM7SUFFckIsMENBQTBDO0lBQ2xDLFdBQVcsQ0FBUztJQUU1QixrQkFBa0I7SUFDVixVQUFVLENBQWE7SUFFL0IsbUJBQW1CO0lBQ1gsTUFBTSxHQUFHLENBQUMsQ0FBQztJQUVuQixZQUNFLEtBQXlCLEVBQ3pCLFVBQXlDLEVBQUU7UUFFM0MsSUFBSSxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsUUFBYSxDQUFDO1FBQ3RDLElBQUksQ0FBQyxVQUFVLEdBQUcsT0FBTyxDQUFDLFNBQVMsSUFBSSxrQkFBVSxDQUFDLFNBQVMsQ0FBQztRQUU1RCxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQzlCLElBQUksQ0FBQyxXQUFXLEdBQUcsS0FBSyxDQUFDO1FBQzNCLENBQUM7YUFBTSxDQUFDO1lBQ04sK0NBQStDO1lBQy9DLDBCQUEwQjtZQUMxQixNQUFNLElBQUksS0FBSyxDQUFDLHVEQUF1RCxDQUFDLENBQUM7UUFDM0UsQ0FBQztJQUNILENBQUM7SUFFRDs7O09BR0c7SUFDSCxjQUFjO1FBQ1osT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDO0lBQzFCLENBQUM7SUFFRDs7T0FFRztJQUNILFNBQVMsQ0FBQyxNQUFjO1FBQ3RCLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxD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LDJCQUEyQjtRQUMzQixVQUFVLENBQUMsR0FBRyxFQUFFO1lBQ2QsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ2IsTUFBTSxDQUFDLElBQUksS0FBSyxDQUFDLGdDQUFnQyxDQUFDLENBQUMsQ0FBQztRQUN0RCxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDWixDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBSZWFkYWJsZSB9IGZyb20gJ3N0cmVhbSc7XHJcbmltcG9ydCB7IHNwYXduIH0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XHJcbmltcG9ydCB7IFN0cmVhbVR5cGUgfSBmcm9tICcuL2VudW1zJztcclxuaW1wb3J0IHsgQ3JlYXRlQXVkaW9SZXNvdXJjZU9wdGlvbnMsIEF1ZGlvUmVzb3VyY2VJbnB1dCB9IGZyb20gJy4vdHlwZXMnO1xyXG5cclxuLyoqXHJcbiAqIFJlcHJlc2VudHMgYW4gYXVkaW8gcmVzb3VyY2UgdGhhdCBjYW4gYmUgcGxheWVkXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgQXVkaW9SZXNvdXJjZTxUID0gdW5rbm93bj4ge1xyXG4gIC8qKiBNZXRhZGF0YSBhdHRhY2hlZCB0byB0aGlzIHJlc291cmNlICovXHJcbiAgcHVibGljIHJlYWRvbmx5IG1ldGFkYXRhOiBUO1xyXG4gIFxyXG4gIC8qKiBXaGV0aGVyIHBsYXliYWNrIGhhcyBzdGFydGVkICovXHJcbiAgcHVibGljIHN0YXJ0ZWQgPSBmYWxzZTtcclxuICBcclxuICAvKiogV2hldGhlciBwbGF5YmFjayBoYXMgZW5kZWQgKi9cclxuICBwdWJsaWMgZW5kZWQgPSBmYWxzZTtcclxuICBcclxuICAvKiogVGhlIGlucHV0IHNvdXJjZSAoVVJMIG9yIGZpbGUgcGF0aCkgKi9cclxuICBwcml2YXRlIGlucHV0U291cmNlOiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIFN0cmVhbSB0eXBlICovXHJcbiAgcHJpdmF0ZSBzdHJlYW1UeXBlOiBTdHJlYW1UeXBlO1xyXG4gIFxyXG4gIC8qKiBWb2x1bWUgKDAtMSkgKi9cclxuICBwcml2YXRlIHZvbHVtZSA9IDE7XHJcblxyXG4gIGNvbnN0cnVjdG9yKFxyXG4gICAgaW5wdXQ6IEF1ZGlvUmVzb3VyY2VJbnB1dCxcclxuICAgIG9wdGlvbnM6IENyZWF0ZUF1ZGlvUmVzb3VyY2VPcHRpb25zPFQ+ID0ge31cclxuICApIHtcclxuICAgIHRoaXMubWV0YWRhdGEgPSBvcHRpb25zLm1ldGFkYXRhIGFzIFQ7XHJcbiAgICB0aGlzLnN0cmVhbVR5cGUgPSBvcHRpb25zLmlucHV0VHlwZSB8fCBTdHJlYW1UeXBlLkFyYml0cmFyeTtcclxuICAgIFxyXG4gICAgaWYgKHR5cGVvZiBpbnB1dCA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgdGhpcy5pbnB1dFNvdXJjZSA9IGlucHV0O1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgLy8gRm9yIHN0cmVhbXMsIHdlJ2QgbmVlZCB0byBoYW5kbGUgZGlmZmVyZW50bHlcclxuICAgICAgLy8gRm9yIG5vdywgdGhyb3cgYW4gZXJyb3JcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdTdHJlYW0gaW5wdXQgbm90IHlldCBzdXBwb3J0ZWQuIFVzZSBVUkwgb3IgZmlsZSBwYXRoLicpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IHRoZSBpbnB1dCBzb3VyY2UgZm9yIEZGbXBlZ1xyXG4gICAqIEBpbnRlcm5hbFxyXG4gICAqL1xyXG4gIGdldElucHV0U291cmNlKCk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gdGhpcy5pbnB1dFNvdXJjZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldCB0aGUgdm9sdW1lICgwLTEpXHJcbiAgICovXHJcbiAgc2V0Vm9sdW1lKHZvbHVtZTogbnVtYmVyKTogdm9pZCB7XHJcbiAgICB0aGlzLnZvbHVtZSA9IE1hdGgubWF4KDAsIE1hdGgubWluKDEsIHZvbHVtZSkpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IHRoZSBjdXJyZW50IHZvbHVtZVxyXG4gICAqL1xyXG4gIGdldFZvbHVtZSgpOiBudW1iZXIge1xyXG4gICAgcmV0dXJuIHRoaXMudm9sdW1lO1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIE9wdGlvbnMgZm9yIGNyZWF0aW5nIGF1ZGlvIHJlc291cmNlIGZyb20gVVJMXHJcbiAqL1xyXG5leHBvcnQgaW50ZXJmYWNlIENyZWF0ZUF1ZGlvUmVzb3VyY2VGcm9tVXJsT3B0aW9uczxUID0gdW5rbm93bj4gZXh0ZW5kcyBDcmVhdGVBdWRpb1Jlc291cmNlT3B0aW9uczxUPiB7XHJcbiAgLyoqIFVzZSB5dC1kbHAgdG8gZXh0cmFjdCBhdWRpbyBVUkwgKi9cclxuICB1c2VZdERscD86IGJvb2xlYW47XHJcbiAgLyoqIFBhdGggdG8geXQtZGxwIGJpbmFyeSAqL1xyXG4gIHl0RGxwUGF0aD86IHN0cmluZztcclxufVxyXG5cclxuLyoqXHJcbiAqIENyZWF0ZSBhbiBhdWRpbyByZXNvdXJjZSBmcm9tIHZhcmlvdXMgaW5wdXRzXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQXVkaW9SZXNvdXJjZTxUID0gdW5rbm93bj4oXHJcbiAgaW5wdXQ6IEF1ZGlvUmVzb3VyY2VJbnB1dCxcclxuICBvcHRpb25zPzogQ3JlYXRlQXVkaW9SZXNvdXJjZU9wdGlvbnM8VD5cclxuKTogQXVkaW9SZXNvdXJjZTxUPiB7XHJcbiAgcmV0dXJuIG5ldyBBdWRpb1Jlc291cmNlKGlucHV0LCBvcHRpb25zKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENyZWF0ZSBhbiBhdWRpbyByZXNvdXJjZSBmcm9tIGEgWW91VHViZS9zdHJlYW1pbmcgVVJMXHJcbiAqIFN0b3JlcyB0aGUgb3JpZ2luYWwgVVJMIC0gZXh0cmFjdGlvbiBoYXBwZW5zIGF0IHBsYXliYWNrIHRpbWVcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVBdWRpb1Jlc291cmNlRnJvbVVybDxUID0gdW5rbm93bj4oXHJcbiAgdXJsOiBzdHJpbmcsXHJcbiAgb3B0aW9uczogQ3JlYXRlQXVkaW9SZXNvdXJjZUZyb21VcmxPcHRpb25zPFQ+ID0ge31cclxuKTogQXVkaW9SZXNvdXJjZTxUPiB7XHJcbiAgLy8gRG9uJ3QgZXh0cmFjdCBzdHJlYW0gVVJMIGhlcmUgLSBqdXN0IHN0b3JlIHRoZSBvcmlnaW5hbCBVUkxcclxuICAvLyBUaGUgQXVkaW9QbGF5ZXIgd2lsbCB1c2UgeXQtZGxwIGF0IHBsYXliYWNrIHRpbWVcclxuICByZXR1cm4gbmV3IEF1ZGlvUmVzb3VyY2UodXJsLCBvcHRpb25zKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENoZWNrIGlmIFVSTCBpcyBhIHN0cmVhbWluZyBzZXJ2aWNlIFVSTFxyXG4gKi9cclxuZnVuY3Rpb24gaXNTdHJlYW1pbmdVcmwodXJsOiBzdHJpbmcpOiBib29sZWFuIHtcclxuICBjb25zdCBzdHJlYW1pbmdEb21haW5zID0gW1xyXG4gICAgJ3lvdXR1YmUuY29tJyxcclxuICAgICd5b3V0dS5iZScsXHJcbiAgICAnc291bmRjbG91ZC5jb20nLFxyXG4gICAgJ3Nwb3RpZnkuY29tJyxcclxuICAgICd0d2l0Y2gudHYnLFxyXG4gICAgJ3ZpbWVvLmNvbSdcclxuICBdO1xyXG4gIFxyXG4gIHJldHVybiBzdHJlYW1pbmdEb21haW5zLnNvbWUoZG9tYWluID0+IHVybC5pbmNsdWRlcyhkb21haW4pKTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENoZWNrIGlmIGlucHV0IGlzIGEgdmFsaWQgVVJMXHJcbiAqL1xyXG5mdW5jdGlvbiBpc1ZhbGlkVXJsKGlucHV0OiBzdHJpbmcpOiBib29sZWFuIHtcclxuICB0cnkge1xyXG4gICAgbmV3IFVSTChpbnB1dCk7XHJcbiAgICByZXR1cm4gdHJ1ZTtcclxuICB9IGNhdGNoIHtcclxuICAgIHJldHVybiBpbnB1dC5zdGFydHNXaXRoKCdodHRwOi8vJykgfHwgaW5wdXQuc3RhcnRzV2l0aCgnaHR0cHM6Ly8nKTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBQcm9iZSBhdWRpbyBpbmZvIGZyb20gYSBVUkwgb3Igc2VhcmNoIHF1ZXJ5XHJcbiAqIElmIGlucHV0IGlzIG5vdCBhIFVSTCwgaXQgd2lsbCBzZWFyY2ggWW91VHViZVxyXG4gKi9cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHByb2JlQXVkaW9JbmZvKGlucHV0OiBzdHJpbmcsIHl0RGxwUGF0aD86IHN0cmluZyk6IFByb21pc2U8e1xyXG4gIHRpdGxlOiBzdHJpbmc7XHJcbiAgZHVyYXRpb246IG51bWJlcjtcclxuICB0aHVtYm5haWw/OiBzdHJpbmc7XHJcbiAgdXJsOiBzdHJpbmc7XHJcbn0+IHtcclxuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgY29uc3QgaXNXaW5kb3dzID0gcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ3dpbjMyJztcclxuICAgIGNvbnN0IGRlZmF1bHRZdERscFBhdGggPSBpc1dpbmRvd3MgPyAneXQtZGxwJyA6ICd+Ly5sb2NhbC9iaW4veXQtZGxwJztcclxuICAgIGNvbnN0IHl0ZGxwQmluID0geXREbHBQYXRoIHx8IGRlZmF1bHRZdERscFBhdGg7XHJcbiAgICBcclxuICAgIC8vIElmIG5vdCBhIHZhbGlkIFVSTCwgdHJlYXQgYXMgWW91VHViZSBzZWFyY2hcclxuICAgIGxldCBzZWFyY2hRdWVyeSA9IGlucHV0O1xyXG4gICAgaWYgKCFpc1ZhbGlkVXJsKGlucHV0KSkge1xyXG4gICAgICBzZWFyY2hRdWVyeSA9IGB5dHNlYXJjaDE6JHtpbnB1dH1gO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBsZXQgeXRkbHA6IFJldHVyblR5cGU8dHlwZW9mIHNwYXduPjtcclxuICAgIFxyXG4gICAgaWYgKGlzV2luZG93cykge1xyXG4gICAgICAvLyBXaW5kb3dzOiB1c2Ugc2hlbGwgd2l0aCBxdW90ZWQgY29tbWFuZFxyXG4gICAgICBjb25zdCBjbWQgPSBgJHt5dGRscEJpbn0gLS1uby1wbGF5bGlzdCAtLW5vLXdhcm5pbmdzIC1qIFwiJHtzZWFyY2hRdWVyeX1cImA7XHJcbiAgICAgIHl0ZGxwID0gc3Bhd24oY21kLCBbXSwgeyBzaGVsbDogdHJ1ZSB9KTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIC8vIFVuaXg6IHVzZSBiYXNoIC1jIHdpdGggcXVvdGVkIHN0cmluZ1xyXG4gICAgICB5dGRscCA9IHNwYXduKCdiYXNoJywgW1xyXG4gICAgICAgICctYycsXHJcbiAgICAgICAgYCR7eXRkbHBCaW59IC0tbm8tcGxheWxpc3QgLS1uby13YXJuaW5ncyAtaiBcIiR7c2VhcmNoUXVlcnl9XCJgXHJcbiAgICAgIF0pO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBsZXQgc3Rkb3V0ID0gJyc7XHJcbiAgICBsZXQgc3RkZXJyID0gJyc7XHJcbiAgICBcclxuICAgIHl0ZGxwLnN0ZG91dD8ub24oJ2RhdGEnLCAoZGF0YSkgPT4ge1xyXG4gICAgICBzdGRvdXQgKz0gZGF0YS50b1N0cmluZygpO1xyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIHl0ZGxwLnN0ZGVycj8ub24oJ2RhdGEnLCAoZGF0YSkgPT4ge1xyXG4gICAgICBzdGRlcnIgKz0gZGF0YS50b1N0cmluZygpO1xyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIHl0ZGxwLm9uKCdjbG9zZScsIChjb2RlKSA9PiB7XHJcbiAgICAgIGlmIChjb2RlICE9PSAwKSB7XHJcbiAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihgRmFpbGVkIHRvIHByb2JlIGF1ZGlvIGluZm86ICR7c3RkZXJyIHx8ICdVbmtub3duIGVycm9yJ31gKSk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcbiAgICAgIFxyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGNvbnN0IGluZm8gPSBKU09OLnBhcnNlKHN0ZG91dCk7XHJcbiAgICAgICAgcmVzb2x2ZSh7XHJcbiAgICAgICAgICB0aXRsZTogaW5mby50aXRsZSB8fCAnVW5rbm93bicsXHJcbiAgICAgICAgICBkdXJhdGlvbjogaW5mby5kdXJhdGlvbiB8fCAwLFxyXG4gICAgICAgICAgdGh1bWJuYWlsOiBpbmZvLnRodW1ibmFpbCxcclxuICAgICAgICAgIHVybDogaW5mby53ZWJwYWdlX3VybCB8fCBpbmZvLnVybCB8fCBpbnB1dFxyXG4gICAgICAgIH0pO1xyXG4gICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihgRmFpbGVkIHRvIHBhcnNlIGF1ZGlvIGluZm86ICR7KGUgYXMgRXJyb3IpLm1lc3NhZ2V9YCkpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgeXRkbHAub24oJ2Vycm9yJywgKGVycikgPT4ge1xyXG4gICAgICByZWplY3QobmV3IEVycm9yKGBGYWlsZWQgdG8gcHJvYmUgYXVkaW8gaW5mbzogJHtlcnIubWVzc2FnZX1gKSk7XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgLy8gVGltZW91dCBhZnRlciAzMCBzZWNvbmRzXHJcbiAgICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgeXRkbHAua2lsbCgpO1xyXG4gICAgICByZWplY3QobmV3IEVycm9yKCdUaW1lb3V0IHdhaXRpbmcgZm9yIGF1ZGlvIGluZm8nKSk7XHJcbiAgICB9LCAzMDAwMCk7XHJcbiAgfSk7XHJcbn1cclxuIl19