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
async function probeAudioInfo(input, ytDlpPath = '~/.local/bin/yt-dlp') {
    return new Promise((resolve, reject) => {
        // If not a valid URL, treat as YouTube search
        let searchQuery = input;
        if (!isValidUrl(input)) {
            searchQuery = `ytsearch1:${input}`;
        }
        const ytdlp = (0, child_process_1.spawn)('bash', [
            '-c',
            `${ytDlpPath} --no-playlist --no-warnings -j "${searchQuery}"`
        ]);
        let stdout = '';
        let stderr = '';
        ytdlp.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        ytdlp.stderr.on('data', (data) => {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQXVkaW9SZXNvdXJjZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9BdWRpb1Jlc291cmNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQStFQSxrREFLQztBQU1ELGdFQU9DO0FBa0NELHdDQTBEQztBQTVMRCxpREFBc0M7QUFDdEMsbUNBQXFDO0FBR3JDOztHQUVHO0FBQ0gsTUFBYSxhQUFhO0lBQ3hCLHlDQUF5QztJQUN6QixRQUFRLENBQUk7SUFFNUIsbUNBQW1DO0lBQzVCLE9BQU8sR0FBRyxLQUFLLENBQUM7SUFFdkIsaUNBQWlDO0lBQzFCLEtBQUssR0FBRyxLQUFLLENBQUM7SUFFckIsMENBQTBDO0lBQ2xDLFdBQVcsQ0FBUztJQUU1QixrQkFBa0I7SUFDVixVQUFVLENBQWE7SUFFL0IsbUJBQW1CO0lBQ1gsTUFBTSxHQUFHLENBQUMsQ0FBQztJQUVuQixZQUNFLEtBQXlCLEVBQ3pCLFVBQXlDLEVBQUU7UUFFM0MsSUFBSSxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsUUFBYSxDQUFDO1FBQ3RDLElBQUksQ0FBQyxVQUFVLEdBQUcsT0FBTyxDQUFDLFNBQVMsSUFBSSxrQkFBVSxDQUFDLFNBQVMsQ0FBQztRQUU1RCxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQzlCLElBQUksQ0FBQyxXQUFXLEdBQUcsS0FBSyxDQUFDO1FBQzNCLENBQUM7YUFBTSxDQUFDO1lBQ04sK0NBQStDO1lBQy9DLDBCQUEwQjtZQUMxQixNQUFNLElBQUksS0FBSyxDQUFDLHVEQUF1RCxDQUFDLENBQUM7UUFDM0UsQ0FBQztJQUNILENBQUM7SUFFRDs7O09BR0c7SUFDSCxjQUFjO1FBQ1osT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDO0lBQzFCLENBQUM7SUFFRDs7T0FFRztJQUNILFNBQVMsQ0FBQyxNQUFjO1FBQ3RCLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxD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QkFDaEMsT0FBTyxDQUFDO29CQUNOLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSyxJQUFJLFNBQVM7b0JBQzlCLFFBQVEsRUFBRSxJQUFJLENBQUMsUUFBUSxJQUFJLENBQUM7b0JBQzVCLFNBQVMsRUFBRSxJQUFJLENBQUMsU0FBUztvQkFDekIsR0FBRyxFQUFFLElBQUksQ0FBQyxXQUFXLElBQUksSUFBSSxDQUFDLEdBQUcsSUFBSSxLQUFLO2lCQUMzQyxDQUFDLENBQUM7WUFDTCxDQUFDO1lBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztnQkFDWCxNQUFNLENBQUMsSUFBSSxLQUFLLENBQUMsK0JBQWdDLENBQVcsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDM0UsQ0FBQztRQUNILENBQUMsQ0FBQyxDQUFDO1FBRUgsS0FBSyxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxHQUFHLEVBQUUsRUFBRTtZQUN4QixNQUFNLENBQUMsSUFBSSxLQUFLLENBQUMsK0JBQStCLEdBQUcsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDbEUsQ0FBQyxDQUFDLENBQUM7UUFFSCwyQkFBMkI7UUFDM0IsVUFBVSxDQUFDLEdBQUcsRUFBRTtZQUNkLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNiLE1BQU0sQ0FBQyxJQUFJLEtBQUssQ0FBQyxnQ0FBZ0MsQ0FBQyxDQUFDLENBQUM7UUFDdEQsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ1osQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgUmVhZGFibGUgfSBmcm9tICdzdHJlYW0nO1xyXG5pbXBvcnQgeyBzcGF3biB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xyXG5pbXBvcnQgeyBTdHJlYW1UeXBlIH0gZnJvbSAnLi9lbnVtcyc7XHJcbmltcG9ydCB7IENyZWF0ZUF1ZGlvUmVzb3VyY2VPcHRpb25zLCBBdWRpb1Jlc291cmNlSW5wdXQgfSBmcm9tICcuL3R5cGVzJztcclxuXHJcbi8qKlxyXG4gKiBSZXByZXNlbnRzIGFuIGF1ZGlvIHJlc291cmNlIHRoYXQgY2FuIGJlIHBsYXllZFxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIEF1ZGlvUmVzb3VyY2U8VCA9IHVua25vd24+IHtcclxuICAvKiogTWV0YWRhdGEgYXR0YWNoZWQgdG8gdGhpcyByZXNvdXJjZSAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBtZXRhZGF0YTogVDtcclxuICBcclxuICAvKiogV2hldGhlciBwbGF5YmFjayBoYXMgc3RhcnRlZCAqL1xyXG4gIHB1YmxpYyBzdGFydGVkID0gZmFsc2U7XHJcbiAgXHJcbiAgLyoqIFdoZXRoZXIgcGxheWJhY2sgaGFzIGVuZGVkICovXHJcbiAgcHVibGljIGVuZGVkID0gZmFsc2U7XHJcbiAgXHJcbiAgLyoqIFRoZSBpbnB1dCBzb3VyY2UgKFVSTCBvciBmaWxlIHBhdGgpICovXHJcbiAgcHJpdmF0ZSBpbnB1dFNvdXJjZTogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBTdHJlYW0gdHlwZSAqL1xyXG4gIHByaXZhdGUgc3RyZWFtVHlwZTogU3RyZWFtVHlwZTtcclxuICBcclxuICAvKiogVm9sdW1lICgwLTEpICovXHJcbiAgcHJpdmF0ZSB2b2x1bWUgPSAxO1xyXG5cclxuICBjb25zdHJ1Y3RvcihcclxuICAgIGlucHV0OiBBdWRpb1Jlc291cmNlSW5wdXQsXHJcbiAgICBvcHRpb25zOiBDcmVhdGVBdWRpb1Jlc291cmNlT3B0aW9uczxUPiA9IHt9XHJcbiAgKSB7XHJcbiAgICB0aGlzLm1ldGFkYXRhID0gb3B0aW9ucy5tZXRhZGF0YSBhcyBUO1xyXG4gICAgdGhpcy5zdHJlYW1UeXBlID0gb3B0aW9ucy5pbnB1dFR5cGUgfHwgU3RyZWFtVHlwZS5BcmJpdHJhcnk7XHJcbiAgICBcclxuICAgIGlmICh0eXBlb2YgaW5wdXQgPT09ICdzdHJpbmcnKSB7XHJcbiAgICAgIHRoaXMuaW5wdXRTb3VyY2UgPSBpbnB1dDtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIC8vIEZvciBzdHJlYW1zLCB3ZSdkIG5lZWQgdG8gaGFuZGxlIGRpZmZlcmVudGx5XHJcbiAgICAgIC8vIEZvciBub3csIHRocm93IGFuIGVycm9yXHJcbiAgICAgIHRocm93IG5ldyBFcnJvcignU3RyZWFtIGlucHV0IG5vdCB5ZXQgc3VwcG9ydGVkLiBVc2UgVVJMIG9yIGZpbGUgcGF0aC4nKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCB0aGUgaW5wdXQgc291cmNlIGZvciBGRm1wZWdcclxuICAgKiBAaW50ZXJuYWxcclxuICAgKi9cclxuICBnZXRJbnB1dFNvdXJjZSgpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIHRoaXMuaW5wdXRTb3VyY2U7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZXQgdGhlIHZvbHVtZSAoMC0xKVxyXG4gICAqL1xyXG4gIHNldFZvbHVtZSh2b2x1bWU6IG51bWJlcik6IHZvaWQge1xyXG4gICAgdGhpcy52b2x1bWUgPSBNYXRoLm1heCgwLCBNYXRoLm1pbigxLCB2b2x1bWUpKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCB0aGUgY3VycmVudCB2b2x1bWVcclxuICAgKi9cclxuICBnZXRWb2x1bWUoKTogbnVtYmVyIHtcclxuICAgIHJldHVybiB0aGlzLnZvbHVtZTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBPcHRpb25zIGZvciBjcmVhdGluZyBhdWRpbyByZXNvdXJjZSBmcm9tIFVSTFxyXG4gKi9cclxuZXhwb3J0IGludGVyZmFjZSBDcmVhdGVBdWRpb1Jlc291cmNlRnJvbVVybE9wdGlvbnM8VCA9IHVua25vd24+IGV4dGVuZHMgQ3JlYXRlQXVkaW9SZXNvdXJjZU9wdGlvbnM8VD4ge1xyXG4gIC8qKiBVc2UgeXQtZGxwIHRvIGV4dHJhY3QgYXVkaW8gVVJMICovXHJcbiAgdXNlWXREbHA/OiBib29sZWFuO1xyXG4gIC8qKiBQYXRoIHRvIHl0LWRscCBiaW5hcnkgKi9cclxuICB5dERscFBhdGg/OiBzdHJpbmc7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDcmVhdGUgYW4gYXVkaW8gcmVzb3VyY2UgZnJvbSB2YXJpb3VzIGlucHV0c1xyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUF1ZGlvUmVzb3VyY2U8VCA9IHVua25vd24+KFxyXG4gIGlucHV0OiBBdWRpb1Jlc291cmNlSW5wdXQsXHJcbiAgb3B0aW9ucz86IENyZWF0ZUF1ZGlvUmVzb3VyY2VPcHRpb25zPFQ+XHJcbik6IEF1ZGlvUmVzb3VyY2U8VD4ge1xyXG4gIHJldHVybiBuZXcgQXVkaW9SZXNvdXJjZShpbnB1dCwgb3B0aW9ucyk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDcmVhdGUgYW4gYXVkaW8gcmVzb3VyY2UgZnJvbSBhIFlvdVR1YmUvc3RyZWFtaW5nIFVSTFxyXG4gKiBTdG9yZXMgdGhlIG9yaWdpbmFsIFVSTCAtIGV4dHJhY3Rpb24gaGFwcGVucyBhdCBwbGF5YmFjayB0aW1lXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQXVkaW9SZXNvdXJjZUZyb21Vcmw8VCA9IHVua25vd24+KFxyXG4gIHVybDogc3RyaW5nLFxyXG4gIG9wdGlvbnM6IENyZWF0ZUF1ZGlvUmVzb3VyY2VGcm9tVXJsT3B0aW9uczxUPiA9IHt9XHJcbik6IEF1ZGlvUmVzb3VyY2U8VD4ge1xyXG4gIC8vIERvbid0IGV4dHJhY3Qgc3RyZWFtIFVSTCBoZXJlIC0ganVzdCBzdG9yZSB0aGUgb3JpZ2luYWwgVVJMXHJcbiAgLy8gVGhlIEF1ZGlvUGxheWVyIHdpbGwgdXNlIHl0LWRscCBhdCBwbGF5YmFjayB0aW1lXHJcbiAgcmV0dXJuIG5ldyBBdWRpb1Jlc291cmNlKHVybCwgb3B0aW9ucyk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDaGVjayBpZiBVUkwgaXMgYSBzdHJlYW1pbmcgc2VydmljZSBVUkxcclxuICovXHJcbmZ1bmN0aW9uIGlzU3RyZWFtaW5nVXJsKHVybDogc3RyaW5nKTogYm9vbGVhbiB7XHJcbiAgY29uc3Qgc3RyZWFtaW5nRG9tYWlucyA9IFtcclxuICAgICd5b3V0dWJlLmNvbScsXHJcbiAgICAneW91dHUuYmUnLFxyXG4gICAgJ3NvdW5kY2xvdWQuY29tJyxcclxuICAgICdzcG90aWZ5LmNvbScsXHJcbiAgICAndHdpdGNoLnR2JyxcclxuICAgICd2aW1lby5jb20nXHJcbiAgXTtcclxuICBcclxuICByZXR1cm4gc3RyZWFtaW5nRG9tYWlucy5zb21lKGRvbWFpbiA9PiB1cmwuaW5jbHVkZXMoZG9tYWluKSk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDaGVjayBpZiBpbnB1dCBpcyBhIHZhbGlkIFVSTFxyXG4gKi9cclxuZnVuY3Rpb24gaXNWYWxpZFVybChpbnB1dDogc3RyaW5nKTogYm9vbGVhbiB7XHJcbiAgdHJ5IHtcclxuICAgIG5ldyBVUkwoaW5wdXQpO1xyXG4gICAgcmV0dXJuIHRydWU7XHJcbiAgfSBjYXRjaCB7XHJcbiAgICByZXR1cm4gaW5wdXQuc3RhcnRzV2l0aCgnaHR0cDovLycpIHx8IGlucHV0LnN0YXJ0c1dpdGgoJ2h0dHBzOi8vJyk7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogUHJvYmUgYXVkaW8gaW5mbyBmcm9tIGEgVVJMIG9yIHNlYXJjaCBxdWVyeVxyXG4gKiBJZiBpbnB1dCBpcyBub3QgYSBVUkwsIGl0IHdpbGwgc2VhcmNoIFlvdVR1YmVcclxuICovXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBwcm9iZUF1ZGlvSW5mbyhpbnB1dDogc3RyaW5nLCB5dERscFBhdGggPSAnfi8ubG9jYWwvYmluL3l0LWRscCcpOiBQcm9taXNlPHtcclxuICB0aXRsZTogc3RyaW5nO1xyXG4gIGR1cmF0aW9uOiBudW1iZXI7XHJcbiAgdGh1bWJuYWlsPzogc3RyaW5nO1xyXG4gIHVybDogc3RyaW5nO1xyXG59PiB7XHJcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgIC8vIElmIG5vdCBhIHZhbGlkIFVSTCwgdHJlYXQgYXMgWW91VHViZSBzZWFyY2hcclxuICAgIGxldCBzZWFyY2hRdWVyeSA9IGlucHV0O1xyXG4gICAgaWYgKCFpc1ZhbGlkVXJsKGlucHV0KSkge1xyXG4gICAgICBzZWFyY2hRdWVyeSA9IGB5dHNlYXJjaDE6JHtpbnB1dH1gO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBjb25zdCB5dGRscCA9IHNwYXduKCdiYXNoJywgW1xyXG4gICAgICAnLWMnLFxyXG4gICAgICBgJHt5dERscFBhdGh9IC0tbm8tcGxheWxpc3QgLS1uby13YXJuaW5ncyAtaiBcIiR7c2VhcmNoUXVlcnl9XCJgXHJcbiAgICBdKTtcclxuICAgIFxyXG4gICAgbGV0IHN0ZG91dCA9ICcnO1xyXG4gICAgbGV0IHN0ZGVyciA9ICcnO1xyXG4gICAgXHJcbiAgICB5dGRscC5zdGRvdXQub24oJ2RhdGEnLCAoZGF0YSkgPT4ge1xyXG4gICAgICBzdGRvdXQgKz0gZGF0YS50b1N0cmluZygpO1xyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIHl0ZGxwLnN0ZGVyci5vbignZGF0YScsIChkYXRhKSA9PiB7XHJcbiAgICAgIHN0ZGVyciArPSBkYXRhLnRvU3RyaW5nKCk7XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgeXRkbHAub24oJ2Nsb3NlJywgKGNvZGUpID0+IHtcclxuICAgICAgaWYgKGNvZGUgIT09IDApIHtcclxuICAgICAgICByZWplY3QobmV3IEVycm9yKGBGYWlsZWQgdG8gcHJvYmUgYXVkaW8gaW5mbzogJHtzdGRlcnIgfHwgJ1Vua25vd24gZXJyb3InfWApKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuICAgICAgXHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgaW5mbyA9IEpTT04ucGFyc2Uoc3Rkb3V0KTtcclxuICAgICAgICByZXNvbHZlKHtcclxuICAgICAgICAgIHRpdGxlOiBpbmZvLnRpdGxlIHx8ICdVbmtub3duJyxcclxuICAgICAgICAgIGR1cmF0aW9uOiBpbmZvLmR1cmF0aW9uIHx8IDAsXHJcbiAgICAgICAgICB0aHVtYm5haWw6IGluZm8udGh1bWJuYWlsLFxyXG4gICAgICAgICAgdXJsOiBpbmZvLndlYnBhZ2VfdXJsIHx8IGluZm8udXJsIHx8IGlucHV0XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICByZWplY3QobmV3IEVycm9yKGBGYWlsZWQgdG8gcGFyc2UgYXVkaW8gaW5mbzogJHsoZSBhcyBFcnJvcikubWVzc2FnZX1gKSk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICB5dGRscC5vbignZXJyb3InLCAoZXJyKSA9PiB7XHJcbiAgICAgIHJlamVjdChuZXcgRXJyb3IoYEZhaWxlZCB0byBwcm9iZSBhdWRpbyBpbmZvOiAke2Vyci5tZXNzYWdlfWApKTtcclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICAvLyBUaW1lb3V0IGFmdGVyIDMwIHNlY29uZHNcclxuICAgIHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICB5dGRscC5raWxsKCk7XHJcbiAgICAgIHJlamVjdChuZXcgRXJyb3IoJ1RpbWVvdXQgd2FpdGluZyBmb3IgYXVkaW8gaW5mbycpKTtcclxuICAgIH0sIDMwMDAwKTtcclxuICB9KTtcclxufVxyXG4iXX0=