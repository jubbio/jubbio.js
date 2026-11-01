"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.probeAudioInfo = exports.AudioResource = void 0;
exports.createAudioResource = createAudioResource;
exports.createAudioResourceFromUrl = createAudioResourceFromUrl;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const stream_1 = require("stream");
const url_1 = require("url");
const enums_1 = require("./enums");
const opusStream_1 = require("./opusStream");
const ytDlp_1 = require("./ytDlp");
class AudioResource {
    metadata;
    started = false;
    ended = false;
    inputType;
    sampleRate;
    numChannels;
    headers;
    input;
    volume = 1;
    constructor(input, options = {}) {
        this.metadata = options.metadata;
        this.inputType = options.inputType ?? enums_1.StreamType.Arbitrary;
        this.sampleRate = options.sampleRate ?? 48000;
        this.numChannels = options.numChannels ?? 2;
        this.headers = { ...options.headers };
        if (!Number.isInteger(this.sampleRate) || this.sampleRate < 8000 || this.sampleRate > 192000)
            throw new RangeError('Invalid input sample rate');
        if (!Number.isInteger(this.numChannels) || this.numChannels < 1 || this.numChannels > 8)
            throw new RangeError('Invalid input channel count');
        for (const [key, value] of Object.entries(this.headers)) {
            if (!key || /[\r\n:]/.test(key) || /[\r\n]/.test(value))
                throw new Error('Invalid media request header');
        }
        if (input instanceof URL || typeof input === 'string') {
            const value = String(input);
            if (!value.trim())
                throw new TypeError('Audio input must not be empty');
            if (input instanceof URL || /^[a-z][a-z\d+.-]*:\/\//i.test(value)) {
                const url = new URL(value);
                if (url.protocol === 'file:')
                    this.input = (0, url_1.fileURLToPath)(url);
                else if (url.protocol === 'http:' || url.protocol === 'https:')
                    this.input = url.href;
                else
                    throw new Error('Only file paths and HTTP(S) media URLs are supported');
            }
            else
                this.input = path_1.default.resolve(value);
        }
        else {
            if (!input || typeof input[Symbol.asyncIterator] !== 'function')
                throw new TypeError('Audio input must be a file, URL, Readable or async byte iterable');
            if (this.inputType === enums_1.StreamType.Opus && input instanceof stream_1.Readable && !input.readableObjectMode) {
                throw new Error('Raw Opus requires an async iterable or object-mode Readable with one packet per item; use OggOpus/WebmOpus for byte streams');
            }
            this.input = input;
        }
        if (this.inputType === enums_1.StreamType.Opus && (typeof this.input === 'string' || this.numChannels > 2)) {
            throw new Error('Raw Opus requires mono/stereo packet input; use OggOpus/WebmOpus for files and URLs');
        }
    }
    /** @internal */
    getInputSource() { return this.input; }
    /** @internal: opens lazily, and playback cancellation owns/destroys the returned stream. */
    async openStream(signal) {
        let stream;
        if (typeof this.input === 'string') {
            if (/^https?:\/\//.test(this.input)) {
                const response = await fetch(this.input, { headers: this.headers, signal });
                if (!response.ok || !response.body) {
                    await response.body?.cancel();
                    throw new Error(`Media request failed: HTTP ${response.status}`);
                }
                stream = stream_1.Readable.fromWeb(response.body);
            }
            else
                stream = (0, fs_1.createReadStream)(this.input);
        }
        else {
            const input = this.input;
            if (input instanceof stream_1.Readable) {
                input.on('error', () => { });
                (0, stream_1.addAbortSignal)(signal, input);
            }
            const bytes = (async function* () {
                for await (const chunk of input) {
                    if (!(chunk instanceof Uint8Array))
                        throw new TypeError('Audio streams must yield Uint8Array or Buffer chunks');
                    yield chunk;
                }
            })();
            stream = stream_1.Readable.from(this.inputType === enums_1.StreamType.Opus ? (0, opusStream_1.opusPacketsToOgg)(bytes, this.numChannels) : bytes, { objectMode: false });
        }
        // Cancellation can occur before the player's reader attaches on the next microtask.
        stream.on('error', () => { });
        return (0, stream_1.addAbortSignal)(signal, stream);
    }
    setVolume(volume) {
        if (!Number.isFinite(volume))
            throw new RangeError('Volume must be a finite number');
        this.volume = Math.max(0, Math.min(1, volume));
    }
    getVolume() { return this.volume; }
}
exports.AudioResource = AudioResource;
function createAudioResource(input, options) {
    return new AudioResource(input, options);
}
function createAudioResourceFromUrl(url, options = {}) {
    return new AudioResource(options.useYtDlp ? (0, ytDlp_1.extractAudioWithYtDlp)(url, options.ytDlpPath) : new URL(url), options);
}
// Backward-compatible explicit helper; source/platform resolution remains opt-in.
var ytDlp_2 = require("./ytDlp");
Object.defineProperty(exports, "probeAudioInfo", { enumerable: true, get: function () { return ytDlp_2.probeAudioInfo; } });
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQXVkaW9SZXNvdXJjZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9BdWRpb1Jlc291cmNlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQW1HQSxrREFFQztBQUVELGdFQUVDO0FBekdELDJCQUFzQztBQUN0QyxnREFBd0I7QUFDeEIsbUNBQWtEO0FBQ2xELDZCQUFvQztBQUNwQyxtQ0FBcUM7QUFFckMsNkNBQWdEO0FBQ2hELG1DQUFnRDtBQUVoRCxNQUFhLGFBQWE7SUFDUixRQUFRLENBQUk7SUFDckIsT0FBTyxHQUFHLEtBQUssQ0FBQztJQUNoQixLQUFLLEdBQUcsS0FBSyxDQUFDO0lBQ0wsU0FBUyxDQUFhO0lBQ3RCLFVBQVUsQ0FBUztJQUNuQixXQUFXLENBQVM7SUFDcEIsT0FBTyxDQUF5QjtJQUMvQixLQUFLLENBQW1DO0lBQ2pELE1BQU0sR0FBRyxDQUFDLENBQUM7SUFFbkIsWUFBWSxLQUF5QixFQUFFLFVBQXlDLEVBQUU7UUFDaEYsSUFBSSxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsUUFBYSxDQUFDO1FBQ3RDLElBQUksQ0FBQyxTQUFTLEdBQUcsT0FBTyxDQUFDLFNBQVMsSUFBSSxrQkFBVSxDQUFDLFNBQVMsQ0FBQztRQUMzRCxJQUFJLENBQUMsVUFBVSxHQUFHLE9BQU8sQ0FBQyxVQUFVLElBQUksS0FBSyxDQUFDO1FBQzlDLElBQUksQ0FBQyxXQUFXLEdBQUcsT0FBTyxDQUFDLFdBQVcsSUFBSSxDQUFDLENBQUM7UUFDNUMsSUFBSSxDQUFDLE9BQU8sR0FBRyxFQUFFLEdBQUcsT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ3RDLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksSUFBSSxJQUFJLENBQUMsVUFBVSxHQUFHLE1BQU07WUFBRSxNQUFNLElBQUksVUFBVSxDQUFDLDJCQUEyQixDQUFDLENBQUM7UUFDaEosSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLElBQUksQ0FBQyxXQUFXLEdBQUcsQ0FBQyxJQUFJLElBQUksQ0FBQyxXQUFXLEdBQUcsQ0FBQztZQUFFLE1BQU0sSUFBSSxVQUFVLENBQUMsNkJBQTZCLENBQUMsQ0FBQztRQUM3SSxLQUFLLE1BQU0sQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUN4RCxJQUFJLENBQUMsR0FBRyxJQUFJLFNBQVMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUM7Z0JBQUUsTUFBTSxJQUFJLEtBQUssQ0FBQyw4QkFBOEIsQ0FBQyxDQUFDO1FBQzNHLENBQUM7UUFDRCxJQUFJLEtBQUssWUFBWSxHQUFHLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxFQUFFLENBQUM7WUFDdEQsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQzVCLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFO2dCQUFFLE1BQU0sSUFBSSxTQUFTLENBQUMsK0JBQStCLENBQUMsQ0FBQztZQUN4RSxJQUFJLEtBQUssWUFBWSxHQUFHLElBQUkseUJBQXlCLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7Z0JBQ2xFLE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUMzQixJQUFJLEdBQUcsQ0FBQyxRQUFRLEtBQUssT0FBTztvQkFBRSxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUEsbUJBQWEsRUFBQyxHQUFHLENBQUMsQ0FBQztxQkFDekQsSUFBSSxHQUFHLENBQUMsUUFBUSxLQUFLLE9BQU8sSUFBSSxHQUFHLENBQUMsUUFBUSxLQUFLLFFBQVE7b0JBQUUsSUFBSSxDQUFDLEtBQUssR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDOztvQkFDakYsTUFBTSxJQUFJLEtBQUssQ0FBQyxzREFBc0QsQ0FBQyxDQUFDO1lBQy9FLENBQUM7O2dCQUFNLElBQUksQ0FBQyxLQUFLLEdBQUcsY0FBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUMxQyxDQUFDO2FBQU0sQ0FBQztZQUNOLElBQUksQ0FBQyxLQUFLLElBQUksT0FBTyxLQUFLLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxLQUFLLFVBQVU7Z0JBQUUsTUFBTSxJQUFJLFNBQVMsQ0FBQyxrRUFBa0UsQ0FBQyxDQUFDO1lBQ3pKLElBQUksSUFBSSxDQUFDLFNBQVMsS0FBSyxrQkFBVSxDQUFDLElBQUksSUFBSSxLQUFLLFlBQVksaUJBQVEsSUFBSSxDQUFDLEtBQUssQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO2dCQUNqRyxNQUFNLElBQUksS0FBSyxDQUFDLDZIQUE2SCxDQUFDLENBQUM7WUFDakosQ0FBQztZQUNELElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO1FBQ3JCLENBQUM7UUFDRCxJQUFJLElBQUksQ0FBQyxTQUFTLEtBQUssa0JBQVUsQ0FBQyxJQUFJLElBQUksQ0FBQyxPQUFPLElBQUksQ0FBQyxLQUFLLEtBQUssUUFBUSxJQUFJLElBQUksQ0FBQyxXQUFXLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQztZQUNuRyxNQUFNLElBQUksS0FBSyxDQUFDLHFGQUFxRixDQUFDLENBQUM7UUFDekcsQ0FBQztJQUNILENBQUM7SUFFRCxnQkFBZ0I7SUFDaEIsY0FBYyxLQUF1QyxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBRXpFLDRGQUE0RjtJQUM1RixLQUFLLENBQUMsVUFBVSxDQUFDLE1BQW1CO1FBQ2xDLElBQUksTUFBZ0IsQ0FBQztRQUNyQixJQUFJLE9BQU8sSUFBSSxDQUFDLEtBQUssS0FBSyxRQUFRLEVBQUUsQ0FBQztZQUNuQyxJQUFJLGNBQWMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7Z0JBQ3BDLE1BQU0sUUFBUSxHQUFHLE1BQU0sS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsRUFBRSxPQUFPLEVBQUUsSUFBSSxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDO2dCQUM1RSxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQztvQkFDbkMsTUFBTSxRQUFRLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxDQUFDO29CQUM5QixNQUFNLElBQUksS0FBSyxDQUFDLDhCQUE4QixRQUFRLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztnQkFDbkUsQ0FBQztnQkFDRCxNQUFNLEdBQUcsaUJBQVEsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQzNDLENBQUM7O2dCQUFNLE1BQU0sR0FBRyxJQUFBLHFCQUFnQixFQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUMvQyxDQUFDO2FBQU0sQ0FBQztZQUNOLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7WUFDekIsSUFBSSxLQUFLLFlBQVksaUJBQVEsRUFBRSxDQUFDO2dCQUM5QixLQUFLLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxHQUFHLEVBQUUsR0FBRSxDQUFDLENBQUMsQ0FBQztnQkFDNUIsSUFBQSx1QkFBYyxFQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsQ0FBQztZQUNoQyxDQUFDO1lBQ0QsTUFBTSxLQUFLLEdBQUcsQ0FBQyxLQUFLLFNBQVMsQ0FBQztnQkFDNUIsSUFBSSxLQUFLLEVBQUUsTUFBTSxLQUFLLElBQUksS0FBSyxFQUFFLENBQUM7b0JBQ2hDLElBQUksQ0FBQyxDQUFDLEtBQUssWUFBWSxVQUFVLENBQUM7d0JBQUUsTUFBTSxJQUFJLFNBQVMsQ0FBQyxzREFBc0QsQ0FBQyxDQUFDO29CQUNoSCxNQUFNLEtBQUssQ0FBQztnQkFDZCxDQUFDO1lBQ0gsQ0FBQyxDQUFDLEVBQUUsQ0FBQztZQUNMLE1BQU0sR0FBRyxpQkFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxLQUFLLGtCQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFBLDZCQUFnQixFQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFLFVBQVUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO1FBQ3hJLENBQUM7UUFDRCxvRkFBb0Y7UUFDcEYsTUFBTSxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsR0FBRyxFQUFFLEdBQUUsQ0FBQyxDQUFDLENBQUM7UUFDN0IsT0FBTyxJQUFBLHVCQUFjLEVBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBQ3hDLENBQUM7SUFFRCxTQUFTLENBQUMsTUFBYztRQUN0QixJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUM7WUFBRSxNQUFNLElBQUksVUFBVSxDQUFDLGdDQUFnQyxDQUFDLENBQUM7UUFDckYsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDO0lBQ2pELENBQUM7SUFDRCxTQUFTLEtBQWEsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztDQUM1QztBQWxGRCxzQ0FrRkM7QUFRRCxTQUFnQixtQkFBbUIsQ0FBYyxLQUF5QixFQUFFLE9BQXVDO0lBQ2pILE9BQU8sSUFBSSxhQUFhLENBQUMsS0FBSyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0FBQzNDLENBQUM7QUFFRCxTQUFnQiwwQkFBMEIsQ0FBYyxHQUFXLEVBQUUsVUFBZ0QsRUFBRTtJQUNySCxPQUFPLElBQUksYUFBYSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLElBQUEsNkJBQXFCLEVBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFDckgsQ0FBQztBQUVELGtGQUFrRjtBQUNsRixpQ0FBeUM7QUFBaEMsdUdBQUEsY0FBYyxPQUFBIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgY3JlYXRlUmVhZFN0cmVhbSB9IGZyb20gJ2ZzJztcclxuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XHJcbmltcG9ydCB7IFJlYWRhYmxlLCBhZGRBYm9ydFNpZ25hbCB9IGZyb20gJ3N0cmVhbSc7XHJcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGggfSBmcm9tICd1cmwnO1xyXG5pbXBvcnQgeyBTdHJlYW1UeXBlIH0gZnJvbSAnLi9lbnVtcyc7XHJcbmltcG9ydCB7IENyZWF0ZUF1ZGlvUmVzb3VyY2VPcHRpb25zLCBBdWRpb1Jlc291cmNlSW5wdXQgfSBmcm9tICcuL3R5cGVzJztcclxuaW1wb3J0IHsgb3B1c1BhY2tldHNUb09nZyB9IGZyb20gJy4vb3B1c1N0cmVhbSc7XHJcbmltcG9ydCB7IGV4dHJhY3RBdWRpb1dpdGhZdERscCB9IGZyb20gJy4veXREbHAnO1xyXG5cclxuZXhwb3J0IGNsYXNzIEF1ZGlvUmVzb3VyY2U8VCA9IHVua25vd24+IHtcclxuICBwdWJsaWMgcmVhZG9ubHkgbWV0YWRhdGE6IFQ7XHJcbiAgcHVibGljIHN0YXJ0ZWQgPSBmYWxzZTtcclxuICBwdWJsaWMgZW5kZWQgPSBmYWxzZTtcclxuICBwdWJsaWMgcmVhZG9ubHkgaW5wdXRUeXBlOiBTdHJlYW1UeXBlO1xyXG4gIHB1YmxpYyByZWFkb25seSBzYW1wbGVSYXRlOiBudW1iZXI7XHJcbiAgcHVibGljIHJlYWRvbmx5IG51bUNoYW5uZWxzOiBudW1iZXI7XHJcbiAgcHVibGljIHJlYWRvbmx5IGhlYWRlcnM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XHJcbiAgcHJpdmF0ZSByZWFkb25seSBpbnB1dDogRXhjbHVkZTxBdWRpb1Jlc291cmNlSW5wdXQsIFVSTD47XHJcbiAgcHJpdmF0ZSB2b2x1bWUgPSAxO1xyXG5cclxuICBjb25zdHJ1Y3RvcihpbnB1dDogQXVkaW9SZXNvdXJjZUlucHV0LCBvcHRpb25zOiBDcmVhdGVBdWRpb1Jlc291cmNlT3B0aW9uczxUPiA9IHt9KSB7XHJcbiAgICB0aGlzLm1ldGFkYXRhID0gb3B0aW9ucy5tZXRhZGF0YSBhcyBUO1xyXG4gICAgdGhpcy5pbnB1dFR5cGUgPSBvcHRpb25zLmlucHV0VHlwZSA/PyBTdHJlYW1UeXBlLkFyYml0cmFyeTtcclxuICAgIHRoaXMuc2FtcGxlUmF0ZSA9IG9wdGlvbnMuc2FtcGxlUmF0ZSA/PyA0ODAwMDtcclxuICAgIHRoaXMubnVtQ2hhbm5lbHMgPSBvcHRpb25zLm51bUNoYW5uZWxzID8/IDI7XHJcbiAgICB0aGlzLmhlYWRlcnMgPSB7IC4uLm9wdGlvbnMuaGVhZGVycyB9O1xyXG4gICAgaWYgKCFOdW1iZXIuaXNJbnRlZ2VyKHRoaXMuc2FtcGxlUmF0ZSkgfHwgdGhpcy5zYW1wbGVSYXRlIDwgODAwMCB8fCB0aGlzLnNhbXBsZVJhdGUgPiAxOTIwMDApIHRocm93IG5ldyBSYW5nZUVycm9yKCdJbnZhbGlkIGlucHV0IHNhbXBsZSByYXRlJyk7XHJcbiAgICBpZiAoIU51bWJlci5pc0ludGVnZXIodGhpcy5udW1DaGFubmVscykgfHwgdGhpcy5udW1DaGFubmVscyA8IDEgfHwgdGhpcy5udW1DaGFubmVscyA+IDgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdJbnZhbGlkIGlucHV0IGNoYW5uZWwgY291bnQnKTtcclxuICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMuaGVhZGVycykpIHtcclxuICAgICAgaWYgKCFrZXkgfHwgL1tcXHJcXG46XS8udGVzdChrZXkpIHx8IC9bXFxyXFxuXS8udGVzdCh2YWx1ZSkpIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBtZWRpYSByZXF1ZXN0IGhlYWRlcicpO1xyXG4gICAgfVxyXG4gICAgaWYgKGlucHV0IGluc3RhbmNlb2YgVVJMIHx8IHR5cGVvZiBpbnB1dCA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgY29uc3QgdmFsdWUgPSBTdHJpbmcoaW5wdXQpO1xyXG4gICAgICBpZiAoIXZhbHVlLnRyaW0oKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignQXVkaW8gaW5wdXQgbXVzdCBub3QgYmUgZW1wdHknKTtcclxuICAgICAgaWYgKGlucHV0IGluc3RhbmNlb2YgVVJMIHx8IC9eW2Etel1bYS16XFxkKy4tXSo6XFwvXFwvL2kudGVzdCh2YWx1ZSkpIHtcclxuICAgICAgICBjb25zdCB1cmwgPSBuZXcgVVJMKHZhbHVlKTtcclxuICAgICAgICBpZiAodXJsLnByb3RvY29sID09PSAnZmlsZTonKSB0aGlzLmlucHV0ID0gZmlsZVVSTFRvUGF0aCh1cmwpO1xyXG4gICAgICAgIGVsc2UgaWYgKHVybC5wcm90b2NvbCA9PT0gJ2h0dHA6JyB8fCB1cmwucHJvdG9jb2wgPT09ICdodHRwczonKSB0aGlzLmlucHV0ID0gdXJsLmhyZWY7XHJcbiAgICAgICAgZWxzZSB0aHJvdyBuZXcgRXJyb3IoJ09ubHkgZmlsZSBwYXRocyBhbmQgSFRUUChTKSBtZWRpYSBVUkxzIGFyZSBzdXBwb3J0ZWQnKTtcclxuICAgICAgfSBlbHNlIHRoaXMuaW5wdXQgPSBwYXRoLnJlc29sdmUodmFsdWUpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgaWYgKCFpbnB1dCB8fCB0eXBlb2YgaW5wdXRbU3ltYm9sLmFzeW5jSXRlcmF0b3JdICE9PSAnZnVuY3Rpb24nKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdBdWRpbyBpbnB1dCBtdXN0IGJlIGEgZmlsZSwgVVJMLCBSZWFkYWJsZSBvciBhc3luYyBieXRlIGl0ZXJhYmxlJyk7XHJcbiAgICAgIGlmICh0aGlzLmlucHV0VHlwZSA9PT0gU3RyZWFtVHlwZS5PcHVzICYmIGlucHV0IGluc3RhbmNlb2YgUmVhZGFibGUgJiYgIWlucHV0LnJlYWRhYmxlT2JqZWN0TW9kZSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignUmF3IE9wdXMgcmVxdWlyZXMgYW4gYXN5bmMgaXRlcmFibGUgb3Igb2JqZWN0LW1vZGUgUmVhZGFibGUgd2l0aCBvbmUgcGFja2V0IHBlciBpdGVtOyB1c2UgT2dnT3B1cy9XZWJtT3B1cyBmb3IgYnl0ZSBzdHJlYW1zJyk7XHJcbiAgICAgIH1cclxuICAgICAgdGhpcy5pbnB1dCA9IGlucHV0O1xyXG4gICAgfVxyXG4gICAgaWYgKHRoaXMuaW5wdXRUeXBlID09PSBTdHJlYW1UeXBlLk9wdXMgJiYgKHR5cGVvZiB0aGlzLmlucHV0ID09PSAnc3RyaW5nJyB8fCB0aGlzLm51bUNoYW5uZWxzID4gMikpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdSYXcgT3B1cyByZXF1aXJlcyBtb25vL3N0ZXJlbyBwYWNrZXQgaW5wdXQ7IHVzZSBPZ2dPcHVzL1dlYm1PcHVzIGZvciBmaWxlcyBhbmQgVVJMcycpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqIEBpbnRlcm5hbCAqL1xyXG4gIGdldElucHV0U291cmNlKCk6IEV4Y2x1ZGU8QXVkaW9SZXNvdXJjZUlucHV0LCBVUkw+IHsgcmV0dXJuIHRoaXMuaW5wdXQ7IH1cclxuXHJcbiAgLyoqIEBpbnRlcm5hbDogb3BlbnMgbGF6aWx5LCBhbmQgcGxheWJhY2sgY2FuY2VsbGF0aW9uIG93bnMvZGVzdHJveXMgdGhlIHJldHVybmVkIHN0cmVhbS4gKi9cclxuICBhc3luYyBvcGVuU3RyZWFtKHNpZ25hbDogQWJvcnRTaWduYWwpOiBQcm9taXNlPFJlYWRhYmxlPiB7XHJcbiAgICBsZXQgc3RyZWFtOiBSZWFkYWJsZTtcclxuICAgIGlmICh0eXBlb2YgdGhpcy5pbnB1dCA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgaWYgKC9eaHR0cHM/OlxcL1xcLy8udGVzdCh0aGlzLmlucHV0KSkge1xyXG4gICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godGhpcy5pbnB1dCwgeyBoZWFkZXJzOiB0aGlzLmhlYWRlcnMsIHNpZ25hbCB9KTtcclxuICAgICAgICBpZiAoIXJlc3BvbnNlLm9rIHx8ICFyZXNwb25zZS5ib2R5KSB7XHJcbiAgICAgICAgICBhd2FpdCByZXNwb25zZS5ib2R5Py5jYW5jZWwoKTtcclxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgTWVkaWEgcmVxdWVzdCBmYWlsZWQ6IEhUVFAgJHtyZXNwb25zZS5zdGF0dXN9YCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHN0cmVhbSA9IFJlYWRhYmxlLmZyb21XZWIocmVzcG9uc2UuYm9keSk7XHJcbiAgICAgIH0gZWxzZSBzdHJlYW0gPSBjcmVhdGVSZWFkU3RyZWFtKHRoaXMuaW5wdXQpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgY29uc3QgaW5wdXQgPSB0aGlzLmlucHV0O1xyXG4gICAgICBpZiAoaW5wdXQgaW5zdGFuY2VvZiBSZWFkYWJsZSkge1xyXG4gICAgICAgIGlucHV0Lm9uKCdlcnJvcicsICgpID0+IHt9KTtcclxuICAgICAgICBhZGRBYm9ydFNpZ25hbChzaWduYWwsIGlucHV0KTtcclxuICAgICAgfVxyXG4gICAgICBjb25zdCBieXRlcyA9IChhc3luYyBmdW5jdGlvbiogKCkge1xyXG4gICAgICAgIGZvciBhd2FpdCAoY29uc3QgY2h1bmsgb2YgaW5wdXQpIHtcclxuICAgICAgICAgIGlmICghKGNodW5rIGluc3RhbmNlb2YgVWludDhBcnJheSkpIHRocm93IG5ldyBUeXBlRXJyb3IoJ0F1ZGlvIHN0cmVhbXMgbXVzdCB5aWVsZCBVaW50OEFycmF5IG9yIEJ1ZmZlciBjaHVua3MnKTtcclxuICAgICAgICAgIHlpZWxkIGNodW5rO1xyXG4gICAgICAgIH1cclxuICAgICAgfSkoKTtcclxuICAgICAgc3RyZWFtID0gUmVhZGFibGUuZnJvbSh0aGlzLmlucHV0VHlwZSA9PT0gU3RyZWFtVHlwZS5PcHVzID8gb3B1c1BhY2tldHNUb09nZyhieXRlcywgdGhpcy5udW1DaGFubmVscykgOiBieXRlcywgeyBvYmplY3RNb2RlOiBmYWxzZSB9KTtcclxuICAgIH1cclxuICAgIC8vIENhbmNlbGxhdGlvbiBjYW4gb2NjdXIgYmVmb3JlIHRoZSBwbGF5ZXIncyByZWFkZXIgYXR0YWNoZXMgb24gdGhlIG5leHQgbWljcm90YXNrLlxyXG4gICAgc3RyZWFtLm9uKCdlcnJvcicsICgpID0+IHt9KTtcclxuICAgIHJldHVybiBhZGRBYm9ydFNpZ25hbChzaWduYWwsIHN0cmVhbSk7XHJcbiAgfVxyXG5cclxuICBzZXRWb2x1bWUodm9sdW1lOiBudW1iZXIpOiB2b2lkIHtcclxuICAgIGlmICghTnVtYmVyLmlzRmluaXRlKHZvbHVtZSkpIHRocm93IG5ldyBSYW5nZUVycm9yKCdWb2x1bWUgbXVzdCBiZSBhIGZpbml0ZSBudW1iZXInKTtcclxuICAgIHRoaXMudm9sdW1lID0gTWF0aC5tYXgoMCwgTWF0aC5taW4oMSwgdm9sdW1lKSk7XHJcbiAgfVxyXG4gIGdldFZvbHVtZSgpOiBudW1iZXIgeyByZXR1cm4gdGhpcy52b2x1bWU7IH1cclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBDcmVhdGVBdWRpb1Jlc291cmNlRnJvbVVybE9wdGlvbnM8VCA9IHVua25vd24+IGV4dGVuZHMgQ3JlYXRlQXVkaW9SZXNvdXJjZU9wdGlvbnM8VD4ge1xyXG4gIC8qKiBFeHBsaWNpdCwgb3B0aW9uYWwgZXh0cmFjdGlvbiBoZWxwZXIuIFRoZSBnZW5lcmljIHBsYXllciBuZXZlciBzdGFydHMgeXQtZGxwLiAqL1xyXG4gIHVzZVl0RGxwPzogYm9vbGVhbjtcclxuICB5dERscFBhdGg/OiBzdHJpbmc7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVBdWRpb1Jlc291cmNlPFQgPSB1bmtub3duPihpbnB1dDogQXVkaW9SZXNvdXJjZUlucHV0LCBvcHRpb25zPzogQ3JlYXRlQXVkaW9SZXNvdXJjZU9wdGlvbnM8VD4pOiBBdWRpb1Jlc291cmNlPFQ+IHtcclxuICByZXR1cm4gbmV3IEF1ZGlvUmVzb3VyY2UoaW5wdXQsIG9wdGlvbnMpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQXVkaW9SZXNvdXJjZUZyb21Vcmw8VCA9IHVua25vd24+KHVybDogc3RyaW5nLCBvcHRpb25zOiBDcmVhdGVBdWRpb1Jlc291cmNlRnJvbVVybE9wdGlvbnM8VD4gPSB7fSk6IEF1ZGlvUmVzb3VyY2U8VD4ge1xyXG4gIHJldHVybiBuZXcgQXVkaW9SZXNvdXJjZShvcHRpb25zLnVzZVl0RGxwID8gZXh0cmFjdEF1ZGlvV2l0aFl0RGxwKHVybCwgb3B0aW9ucy55dERscFBhdGgpIDogbmV3IFVSTCh1cmwpLCBvcHRpb25zKTtcclxufVxyXG5cclxuLy8gQmFja3dhcmQtY29tcGF0aWJsZSBleHBsaWNpdCBoZWxwZXI7IHNvdXJjZS9wbGF0Zm9ybSByZXNvbHV0aW9uIHJlbWFpbnMgb3B0LWluLlxyXG5leHBvcnQgeyBwcm9iZUF1ZGlvSW5mbyB9IGZyb20gJy4veXREbHAnO1xyXG4iXX0=