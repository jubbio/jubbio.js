"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioPlayer = void 0;
exports.createAudioPlayer = createAudioPlayer;
const events_1 = require("events");
const child_process_1 = require("child_process");
const rtc_node_1 = require("@livekit/rtc-node");
const enums_1 = require("./enums");
const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const SAMPLES_PER_FRAME = 960;
const FRAME_BYTES = SAMPLES_PER_FRAME * CHANNELS * 2;
const MAX_STDERR_BYTES = 8192;
class AudioPlayer extends events_1.EventEmitter {
    state = { status: enums_1.AudioPlayerStatus.Idle };
    options;
    subscriptions = new Set();
    bindings = new Map();
    waiters = new Set();
    session = null;
    constructor(options = {}) {
        super();
        this.options = { ...options, behaviors: { noSubscriber: 'pause', maxMissedFrames: 5, ...options.behaviors } };
        this.on('error', error => {
            if (this.listenerCount('error') === 1)
                console.error('[AudioPlayer]', error.message);
        });
    }
    play(resource) {
        // Replacing a song is not an Idle transition: queue handlers must not start a third song.
        this.cancelSession();
        const session = { resource, cancelled: false, running: false, abort: new AbortController() };
        this.session = session;
        this.setState({ status: enums_1.AudioPlayerStatus.Buffering, resource });
        this.startIfReady();
    }
    pause() {
        if (this.state.status !== enums_1.AudioPlayerStatus.Playing)
            return false;
        this.setState({ status: enums_1.AudioPlayerStatus.Paused, resource: this.session?.resource });
        return true;
    }
    unpause() {
        if (this.state.status !== enums_1.AudioPlayerStatus.Paused)
            return false;
        const status = this.readyBindings().length || this.options.behaviors?.noSubscriber === 'play'
            ? enums_1.AudioPlayerStatus.Playing : enums_1.AudioPlayerStatus.AutoPaused;
        this.setState({ status, resource: this.session?.resource });
        return true;
    }
    stop(force = false) {
        if (!this.session && this.state.status === enums_1.AudioPlayerStatus.Idle && !force)
            return false;
        this.cancelSession();
        this.setState({ status: enums_1.AudioPlayerStatus.Idle });
        return true;
    }
    subscribe(connection) {
        this.subscriptions.add(connection);
        if (connection.getRoom())
            this.onConnectionReady(connection);
    }
    unsubscribe(connection) {
        this.subscriptions.delete(connection);
        this.onConnectionDisconnected(connection);
    }
    onConnectionReady(connection) {
        if (!this.subscriptions.has(connection))
            return;
        const room = connection.getRoom();
        if (!room || this.bindings.get(connection)?.room === room)
            return;
        if (this.bindings.has(connection))
            this.onConnectionDisconnected(connection);
        const source = new rtc_node_1.AudioSource(SAMPLE_RATE, CHANNELS, 200);
        const track = rtc_node_1.LocalAudioTrack.createAudioTrack('music', source);
        const binding = { room, source, track, ready: false };
        this.bindings.set(connection, binding);
        const options = new rtc_node_1.TrackPublishOptions();
        options.source = rtc_node_1.TrackSource.SOURCE_MICROPHONE;
        void (async () => {
            try {
                if (!room.localParticipant)
                    throw new Error('LiveKit local participant is unavailable');
                binding.publishing = room.localParticipant.publishTrack(track, options);
                binding.publication = await binding.publishing;
                if (this.bindings.get(connection) !== binding) {
                    await this.closeBinding(binding);
                    return;
                }
                binding.ready = true;
                if (this.state.status === enums_1.AudioPlayerStatus.AutoPaused) {
                    this.setState({ status: this.session?.resource.started ? enums_1.AudioPlayerStatus.Playing : enums_1.AudioPlayerStatus.Buffering, resource: this.session?.resource });
                }
                this.wake();
                this.startIfReady();
            }
            catch (error) {
                if (this.bindings.get(connection) !== binding)
                    return;
                this.bindings.delete(connection);
                void this.closeBinding(binding);
                this.handleNoConnection();
                this.emit('error', { message: error.message, resource: this.session?.resource });
            }
        })();
    }
    onConnectionDisconnected(connection) {
        const binding = this.bindings.get(connection);
        this.bindings.delete(connection);
        if (binding)
            void this.closeBinding(binding);
        this.handleNoConnection();
        this.wake();
    }
    readyBindings() {
        return [...this.bindings.values()].filter(binding => binding.ready);
    }
    closeBinding(binding) {
        if (binding.closing)
            return binding.closing;
        binding.source.clearQueue();
        binding.closing = (async () => {
            try {
                await binding.publishing?.catch(() => { });
                const sid = binding.publication?.sid ?? binding.track.sid;
                if (sid)
                    await binding.room.localParticipant?.unpublishTrack(sid).catch(() => { });
                await binding.capture?.catch(() => { });
            }
            finally {
                try {
                    await binding.track.close(false);
                }
                finally {
                    await binding.source.close();
                }
            }
        })().catch(() => { });
        return binding.closing;
    }
    handleNoConnection() {
        if (!this.session || this.readyBindings().length)
            return;
        if (this.options.behaviors?.noSubscriber === 'stop')
            this.stop();
        else if (this.options.behaviors?.noSubscriber === 'pause' && this.state.status !== enums_1.AudioPlayerStatus.Paused) {
            this.setState({ status: enums_1.AudioPlayerStatus.AutoPaused, resource: this.session.resource });
        }
    }
    startIfReady() {
        const session = this.session;
        if (!session || session.running || !this.readyBindings().length)
            return;
        session.running = true;
        void this.run(session);
    }
    isCurrent(session) {
        return this.session === session && !session.cancelled;
    }
    async run(session) {
        try {
            session.startupTimeout = setTimeout(() => this.fail(session, new Error('Timeout waiting for audio data')), 10000);
            await this.startDecoder(session);
            if (!this.isCurrent(session))
                return;
            let pending = Buffer.alloc(0);
            // Reading only as fast as frames are captured bounds both Node's stream and the OS pipes.
            for await (const data of session.pcm) {
                if (!this.isCurrent(session))
                    return;
                const chunk = pending.length ? Buffer.concat([pending, data]) : data;
                if (chunk.length >= FRAME_BYTES)
                    clearTimeout(session.startupTimeout);
                let offset = 0;
                while (offset + FRAME_BYTES <= chunk.length) {
                    if (!await this.sendFrame(session, chunk.subarray(offset, offset + FRAME_BYTES)))
                        return;
                    offset += FRAME_BYTES;
                }
                pending = Buffer.from(chunk.subarray(offset));
            }
            if (!this.isCurrent(session))
                return;
            if (pending.length) {
                clearTimeout(session.startupTimeout);
                const lastFrame = Buffer.alloc(FRAME_BYTES);
                pending.copy(lastFrame);
                if (!await this.sendFrame(session, lastFrame))
                    return;
            }
            if (!session.resource.started)
                throw new Error('FFmpeg failed to produce audio data');
            await Promise.all(this.readyBindings().map(binding => binding.source.waitForPlayout()));
            if (this.isCurrent(session))
                this.stop();
        }
        catch (error) {
            if (this.isCurrent(session))
                this.fail(session, error);
        }
    }
    async sendFrame(session, pcm) {
        while (this.isCurrent(session)) {
            if (this.state.status === enums_1.AudioPlayerStatus.Paused ||
                (!this.readyBindings().length && this.options.behaviors?.noSubscriber !== 'play')) {
                await new Promise(resolve => this.waiters.add(resolve));
                continue;
            }
            const samples = new Int16Array(SAMPLES_PER_FRAME * CHANNELS);
            const volume = session.resource.getVolume();
            for (let i = 0; i < samples.length; i++)
                samples[i] = Math.round(pcm.readInt16LE(i * 2) * volume);
            const frame = new rtc_node_1.AudioFrame(samples, SAMPLE_RATE, CHANNELS, SAMPLES_PER_FRAME);
            const bindings = this.readyBindings();
            if (bindings.length) {
                // AudioSource applies native queue backpressure; a second JS scheduler causes drift.
                const delivered = await Promise.all(bindings.map(async (binding) => {
                    // Cancellation clears the queue but an earlier native capture can still
                    // be completing. AudioSource permits only one in-flight capture.
                    await binding.capture?.catch(() => { });
                    if (!this.isCurrent(session) || ![...this.bindings.values()].includes(binding))
                        return false;
                    const capture = binding.capture = binding.source.captureFrame(frame);
                    try {
                        await capture;
                    }
                    catch (error) {
                        if (this.isCurrent(session) && [...this.bindings.values()].includes(binding))
                            throw error;
                    }
                    finally {
                        if (binding.capture === capture)
                            binding.capture = undefined;
                    }
                    return [...this.bindings.values()].includes(binding);
                }));
                // Retain an in-flight frame if all its rooms disappeared during capture.
                if (!delivered.some(Boolean) && this.options.behaviors?.noSubscriber !== 'play')
                    continue;
            }
            else {
                await new Promise(resolve => setTimeout(resolve, 20));
            }
            if (!this.isCurrent(session))
                return false;
            if (!session.resource.started) {
                session.resource.started = true;
                if (this.state.status === enums_1.AudioPlayerStatus.Buffering) {
                    this.setState({ status: enums_1.AudioPlayerStatus.Playing, resource: session.resource });
                }
            }
            return true;
        }
        return false;
    }
    async startDecoder(session) {
        const resource = session.resource;
        const input = resource.getInputSource();
        const directPcm = resource.inputType === enums_1.StreamType.Raw && resource.sampleRate === SAMPLE_RATE && resource.numChannels === CHANNELS;
        if (directPcm || typeof input !== 'string') {
            const stream = await resource.openStream(session.abort.signal);
            if (!this.isCurrent(session)) {
                stream.destroy();
                return;
            }
            session.input = stream;
            stream.on('error', error => this.fail(session, error));
            if (directPcm) {
                session.pcm = stream;
                return;
            }
        }
        if (!this.isCurrent(session))
            return;
        const isUrl = typeof input === 'string' && /^https?:\/\//.test(input);
        const inputArgs = [];
        if (resource.inputType === enums_1.StreamType.Raw) {
            inputArgs.push('-f', 's16le', '-ar', String(resource.sampleRate), '-ac', String(resource.numChannels));
        }
        else if (resource.inputType === enums_1.StreamType.Opus || resource.inputType === enums_1.StreamType.OggOpus)
            inputArgs.push('-f', 'ogg');
        else if (resource.inputType === enums_1.StreamType.WebmOpus)
            inputArgs.push('-f', 'matroska');
        if (isUrl) {
            inputArgs.push('-rw_timeout', '10000000');
            const headers = Object.entries(resource.headers).map(([key, value]) => key + ': ' + value + '\r\n').join('');
            if (headers)
                inputArgs.push('-headers', headers);
        }
        const protocols = isUrl ? 'http,https,tcp,tls,crypto,pipe' : session.input ? 'pipe' : 'file,pipe';
        const ffmpeg = session.ffmpeg = (0, child_process_1.spawn)(this.options.ffmpegPath ?? 'ffmpeg', [
            '-hide_banner', '-loglevel', 'error', '-protocol_whitelist', protocols, ...inputArgs,
            '-i', session.input ? 'pipe:0' : input,
            '-vn', '-f', 's16le', '-ar', String(SAMPLE_RATE), '-ac', String(CHANNELS), '-acodec', 'pcm_s16le', 'pipe:1',
        ], { stdio: ['pipe', 'pipe', 'pipe'], shell: false, windowsHide: true });
        session.pcm = ffmpeg.stdout;
        let stderr = '';
        ffmpeg.stderr?.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-MAX_STDERR_BYTES); });
        ffmpeg.on('error', error => this.fail(session, error));
        ffmpeg.stdin?.on('error', error => this.fail(session, error));
        ffmpeg.on('exit', code => {
            if (code !== 0 && this.isCurrent(session))
                this.fail(session, new Error('FFmpeg exited with code ' + code + ': ' + stderr));
        });
        if (session.input)
            session.input.pipe(ffmpeg.stdin);
        else
            ffmpeg.stdin?.end();
    }
    fail(session, error) {
        if (!this.isCurrent(session))
            return;
        const resource = session.resource;
        this.cancelSession();
        // Error listeners may synchronously play the next song. Never overwrite that new state.
        this.emit('error', { message: error.message, resource });
        if (!this.session)
            this.setState({ status: enums_1.AudioPlayerStatus.Idle });
    }
    cancelSession() {
        const session = this.session;
        this.session = null;
        if (session) {
            session.cancelled = true;
            session.resource.ended = true;
            clearTimeout(session.startupTimeout);
            session.abort.abort();
            session.input?.unpipe();
            session.input?.destroy();
            for (const child of [session.ffmpeg]) {
                child?.stdin?.destroy();
                child?.stdout?.destroy();
                child?.kill('SIGKILL');
            }
        }
        for (const binding of this.bindings.values())
            binding.source.clearQueue();
        this.wake();
    }
    wake() {
        for (const resolve of this.waiters)
            resolve();
        this.waiters.clear();
    }
    setState(state) {
        const previous = this.state;
        this.state = state;
        this.wake();
        this.emit('stateChange', previous, state);
    }
}
exports.AudioPlayer = AudioPlayer;
function createAudioPlayer(options) {
    return new AudioPlayer(options);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQXVkaW9QbGF5ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvQXVkaW9QbGF5ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBa1ZBLDhDQUVDO0FBcFZELG1DQUFzQztBQUN0QyxpREFBb0Q7QUFFcEQsZ0RBQXFIO0FBRXJILG1DQUF3RDtBQUt4RCxNQUFNLFdBQVcsR0FBRyxLQUFLLENBQUM7QUFDMUIsTUFBTSxRQUFRLEdBQUcsQ0FBQyxDQUFDO0FBQ25CLE1BQU0saUJBQWlCLEdBQUcsR0FBRyxDQUFDO0FBQzlCLE1BQU0sV0FBVyxHQUFHLGlCQUFpQixHQUFHLFFBQVEsR0FBRyxDQUFDLENBQUM7QUFDckQsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUM7QUF3QjlCLE1BQWEsV0FBWSxTQUFRLHFCQUFZO0lBQ3BDLEtBQUssR0FBcUIsRUFBRSxNQUFNLEVBQUUseUJBQWlCLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDbkQsT0FBTyxDQUEyQjtJQUNsQyxhQUFhLEdBQUcsSUFBSSxHQUFHLEVBQW1CLENBQUM7SUFDM0MsUUFBUSxHQUFHLElBQUksR0FBRyxFQUFpQyxDQUFDO0lBQ3BELE9BQU8sR0FBRyxJQUFJLEdBQUcsRUFBYyxDQUFDO0lBQ3pDLE9BQU8sR0FBMkIsSUFBSSxDQUFDO0lBRS9DLFlBQVksVUFBb0MsRUFBRTtRQUNoRCxLQUFLLEVBQUUsQ0FBQztRQUNSLElBQUksQ0FBQyxPQUFPLEdBQUcsRUFBRSxHQUFHLE9BQU8sRUFBRSxTQUFTLEVBQUUsRUFBRSxZQUFZLEVBQUUsT0FBTyxFQUFFLGVBQWUsRUFBRSxDQUFDLEVBQUUsR0FBRyxPQUFPLENBQUMsU0FBUyxFQUFFLEVBQUUsQ0FBQztRQUM5RyxJQUFJLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsRUFBRTtZQUN2QixJQUFJLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQztnQkFBRSxPQUFPLENBQUMsS0FB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T0FBTyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7Z0JBQ3JDLEtBQUssRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLENBQUM7Z0JBQ3hCLEtBQUssRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLENBQUM7Z0JBQ3pCLEtBQUssRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDekIsQ0FBQztRQUNILENBQUM7UUFDRCxLQUFLLE1BQU0sT0FBTyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFO1lBQUUsT0FBTyxDQUFDLE1BQU0sQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUMxRSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDZCxDQUFDO0lBRU8sSUFBSTtRQUNWLEtBQUssTUFBTSxPQUFPLElBQUksSUFBSSxDQUFDLE9BQU87WUFBRSxPQUFPLEVBQUUsQ0FBQztRQUM5QyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxDQUFDO0lBQ3ZCLENBQUM7SUFFTyxRQUFRLENBQUMsS0FBdUI7UUFDdEMsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQztRQUM1QixJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUNuQixJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDWixJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxRQUFRLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDNUMsQ0FBQztDQUNGO0FBMVNELGtDQTBTQztBQUVELFNBQWdCLGlCQUFpQixDQUFDLE9BQWtDO0lBQ2xFLE9BQU8sSUFBSSxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDbEMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gJ2V2ZW50cyc7XHJcbmltcG9ydCB7IHNwYXduLCBDaGlsZFByb2Nlc3MgfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcclxuaW1wb3J0IHsgUmVhZGFibGUgfSBmcm9tICdzdHJlYW0nO1xyXG5pbXBvcnQgeyBSb29tLCBMb2NhbEF1ZGlvVHJhY2ssIEF1ZGlvU291cmNlLCBUcmFja1B1Ymxpc2hPcHRpb25zLCBUcmFja1NvdXJjZSwgQXVkaW9GcmFtZSB9IGZyb20gJ0BsaXZla2l0L3J0Yy1ub2RlJztcclxuaW1wb3J0IHR5cGUgeyBMb2NhbFRyYWNrUHVibGljYXRpb24gfSBmcm9tICdAbGl2ZWtpdC9ydGMtbm9kZSc7XHJcbmltcG9ydCB7IEF1ZGlvUGxheWVyU3RhdHVzLCBTdHJlYW1UeXBlIH0gZnJvbSAnLi9lbnVtcyc7XHJcbmltcG9ydCB7IENyZWF0ZUF1ZGlvUGxheWVyT3B0aW9ucywgQXVkaW9QbGF5ZXJTdGF0ZSB9IGZyb20gJy4vdHlwZXMnO1xyXG5pbXBvcnQgeyBBdWRpb1Jlc291cmNlIH0gZnJvbSAnLi9BdWRpb1Jlc291cmNlJztcclxuaW1wb3J0IHR5cGUgeyBWb2ljZUNvbm5lY3Rpb24gfSBmcm9tICcuL1ZvaWNlQ29ubmVjdGlvbic7XHJcblxyXG5jb25zdCBTQU1QTEVfUkFURSA9IDQ4MDAwO1xyXG5jb25zdCBDSEFOTkVMUyA9IDI7XHJcbmNvbnN0IFNBTVBMRVNfUEVSX0ZSQU1FID0gOTYwO1xyXG5jb25zdCBGUkFNRV9CWVRFUyA9IFNBTVBMRVNfUEVSX0ZSQU1FICogQ0hBTk5FTFMgKiAyO1xyXG5jb25zdCBNQVhfU1RERVJSX0JZVEVTID0gODE5MjtcclxuXHJcbmludGVyZmFjZSBQbGF5YmFja1Nlc3Npb24ge1xyXG4gIHJlc291cmNlOiBBdWRpb1Jlc291cmNlO1xyXG4gIGNhbmNlbGxlZDogYm9vbGVhbjtcclxuICBydW5uaW5nOiBib29sZWFuO1xyXG4gIGZmbXBlZz86IENoaWxkUHJvY2VzcztcclxuICBpbnB1dD86IFJlYWRhYmxlO1xyXG4gIHBjbT86IFJlYWRhYmxlO1xyXG4gIGFib3J0OiBBYm9ydENvbnRyb2xsZXI7XHJcbiAgc3RhcnR1cFRpbWVvdXQ/OiBOb2RlSlMuVGltZW91dDtcclxufVxyXG5cclxuaW50ZXJmYWNlIEF1ZGlvQmluZGluZyB7XHJcbiAgcm9vbTogUm9vbTtcclxuICBzb3VyY2U6IEF1ZGlvU291cmNlO1xyXG4gIHRyYWNrOiBMb2NhbEF1ZGlvVHJhY2s7XHJcbiAgcmVhZHk6IGJvb2xlYW47XHJcbiAgcHVibGljYXRpb24/OiBMb2NhbFRyYWNrUHVibGljYXRpb247XHJcbiAgcHVibGlzaGluZz86IFByb21pc2U8TG9jYWxUcmFja1B1YmxpY2F0aW9uPjtcclxuICBjYXB0dXJlPzogUHJvbWlzZTx2b2lkPjtcclxuICBjbG9zaW5nPzogUHJvbWlzZTx2b2lkPjtcclxufVxyXG5cclxuZXhwb3J0IGNsYXNzIEF1ZGlvUGxheWVyIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcclxuICBwdWJsaWMgc3RhdGU6IEF1ZGlvUGxheWVyU3RhdGUgPSB7IHN0YXR1czogQXVkaW9QbGF5ZXJTdGF0dXMuSWRsZSB9O1xyXG4gIHByaXZhdGUgcmVhZG9ubHkgb3B0aW9uczogQ3JlYXRlQXVkaW9QbGF5ZXJPcHRpb25zO1xyXG4gIHByaXZhdGUgcmVhZG9ubHkgc3Vic2NyaXB0aW9ucyA9IG5ldyBTZXQ8Vm9pY2VDb25uZWN0aW9uPigpO1xyXG4gIHByaXZhdGUgcmVhZG9ubHkgYmluZGluZ3MgPSBuZXcgTWFwPFZvaWNlQ29ubmVjdGlvbiwgQXVkaW9CaW5kaW5nPigpO1xyXG4gIHByaXZhdGUgcmVhZG9ubHkgd2FpdGVycyA9IG5ldyBTZXQ8KCkgPT4gdm9pZD4oKTtcclxuICBwcml2YXRlIHNlc3Npb246IFBsYXliYWNrU2Vzc2lvbiB8IG51bGwgPSBudWxsO1xyXG5cclxuICBjb25zdHJ1Y3RvcihvcHRpb25zOiBDcmVhdGVBdWRpb1BsYXllck9wdGlvbnMgPSB7fSkge1xyXG4gICAgc3VwZXIoKTtcclxuICAgIHRoaXMub3B0aW9ucyA9IHsgLi4ub3B0aW9ucywgYmVoYXZpb3JzOiB7IG5vU3Vic2NyaWJlcjogJ3BhdXNlJywgbWF4TWlzc2VkRnJhbWVzOiA1LCAuLi5vcHRpb25zLmJlaGF2aW9ycyB9IH07XHJcbiAgICB0aGlzLm9uKCdlcnJvcicsIGVycm9yID0+IHtcclxuICAgICAgaWYgKHRoaXMubGlzdGVuZXJDb3VudCgnZXJyb3InKSA9PT0gMSkgY29uc29sZS5lcnJvcignW0F1ZGlvUGxheWVyXScsIGVycm9yLm1lc3NhZ2UpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwbGF5KHJlc291cmNlOiBBdWRpb1Jlc291cmNlKTogdm9pZCB7XHJcbiAgICAvLyBSZXBsYWNpbmcgYSBzb25nIGlzIG5vdCBhbiBJZGxlIHRyYW5zaXRpb246IHF1ZXVlIGhhbmRsZXJzIG11c3Qgbm90IHN0YXJ0IGEgdGhpcmQgc29uZy5cclxuICAgIHRoaXMuY2FuY2VsU2Vzc2lvbigpO1xyXG4gICAgY29uc3Qgc2Vzc2lvbjogUGxheWJhY2tTZXNzaW9uID0geyByZXNvdXJjZSwgY2FuY2VsbGVkOiBmYWxzZSwgcnVubmluZzogZmFsc2UsIGFib3J0OiBuZXcgQWJvcnRDb250cm9sbGVyKCkgfTtcclxuICAgIHRoaXMuc2Vzc2lvbiA9IHNlc3Npb247XHJcbiAgICB0aGlzLnNldFN0YXRlKHsgc3RhdHVzOiBBdWRpb1BsYXllclN0YXR1cy5CdWZmZXJpbmcsIHJlc291cmNlIH0pO1xyXG4gICAgdGhpcy5zdGFydElmUmVhZHkoKTtcclxuICB9XHJcblxyXG4gIHBhdXNlKCk6IGJvb2xlYW4ge1xyXG4gICAgaWYgKHRoaXMuc3RhdGUuc3RhdHVzICE9PSBBdWRpb1BsYXllclN0YXR1cy5QbGF5aW5nKSByZXR1cm4gZmFsc2U7XHJcbiAgICB0aGlzLnNldFN0YXRlKHsgc3RhdHVzOiBBdWRpb1BsYXllclN0YXR1cy5QYXVzZWQsIHJlc291cmNlOiB0aGlzLnNlc3Npb24/LnJlc291cmNlIH0pO1xyXG4gICAgcmV0dXJuIHRydWU7XHJcbiAgfVxyXG5cclxuICB1bnBhdXNlKCk6IGJvb2xlYW4ge1xyXG4gICAgaWYgKHRoaXMuc3RhdGUuc3RhdHVzICE9PSBBdWRpb1BsYXllclN0YXR1cy5QYXVzZWQpIHJldHVybiBmYWxzZTtcclxuICAgIGNvbnN0IHN0YXR1cyA9IHRoaXMucmVhZHlCaW5kaW5ncygpLmxlbmd0aCB8fCB0aGlzLm9wdGlvbnMuYmVoYXZpb3JzPy5ub1N1YnNjcmliZXIgPT09ICdwbGF5J1xyXG4gICAgICA/IEF1ZGlvUGxheWVyU3RhdHVzLlBsYXlpbmcgOiBBdWRpb1BsYXllclN0YXR1cy5BdXRvUGF1c2VkO1xyXG4gICAgdGhpcy5zZXRTdGF0ZSh7IHN0YXR1cywgcmVzb3VyY2U6IHRoaXMuc2Vzc2lvbj8ucmVzb3VyY2UgfSk7XHJcbiAgICByZXR1cm4gdHJ1ZTtcclxuICB9XHJcblxyXG4gIHN0b3AoZm9yY2UgPSBmYWxzZSk6IGJvb2xlYW4ge1xyXG4gICAgaWYgKCF0aGlzLnNlc3Npb24gJiYgdGhpcy5zdGF0ZS5zdGF0dXMgPT09IEF1ZGlvUGxheWVyU3RhdHVzLklkbGUgJiYgIWZvcmNlKSByZXR1cm4gZmFsc2U7XHJcbiAgICB0aGlzLmNhbmNlbFNlc3Npb24oKTtcclxuICAgIHRoaXMuc2V0U3RhdGUoeyBzdGF0dXM6IEF1ZGlvUGxheWVyU3RhdHVzLklkbGUgfSk7XHJcbiAgICByZXR1cm4gdHJ1ZTtcclxuICB9XHJcblxyXG4gIHN1YnNjcmliZShjb25uZWN0aW9uOiBWb2ljZUNvbm5lY3Rpb24pOiB2b2lkIHtcclxuICAgIHRoaXMuc3Vic2NyaXB0aW9ucy5hZGQoY29ubmVjdGlvbik7XHJcbiAgICBpZiAoY29ubmVjdGlvbi5nZXRSb29tKCkpIHRoaXMub25Db25uZWN0aW9uUmVhZHkoY29ubmVjdGlvbik7XHJcbiAgfVxyXG5cclxuICB1bnN1YnNjcmliZShjb25uZWN0aW9uOiBWb2ljZUNvbm5lY3Rpb24pOiB2b2lkIHtcclxuICAgIHRoaXMuc3Vic2NyaXB0aW9ucy5kZWxldGUoY29ubmVjdGlvbik7XHJcbiAgICB0aGlzLm9uQ29ubmVjdGlvbkRpc2Nvbm5lY3RlZChjb25uZWN0aW9uKTtcclxuICB9XHJcblxyXG4gIG9uQ29ubmVjdGlvblJlYWR5KGNvbm5lY3Rpb246IFZvaWNlQ29ubmVjdGlvbik6IHZvaWQge1xyXG4gICAgaWYgKCF0aGlzLnN1YnNjcmlwdGlvbnMuaGFzKGNvbm5lY3Rpb24pKSByZXR1cm47XHJcbiAgICBjb25zdCByb29tID0gY29ubmVjdGlvbi5nZXRSb29tKCk7XHJcbiAgICBpZiAoIXJvb20gfHwgdGhpcy5iaW5kaW5ncy5nZXQoY29ubmVjdGlvbik/LnJvb20gPT09IHJvb20pIHJldHVybjtcclxuICAgIGlmICh0aGlzLmJpbmRpbmdzLmhhcyhjb25uZWN0aW9uKSkgdGhpcy5vbkNvbm5lY3Rpb25EaXNjb25uZWN0ZWQoY29ubmVjdGlvbik7XHJcbiAgICBjb25zdCBzb3VyY2UgPSBuZXcgQXVkaW9Tb3VyY2UoU0FNUExFX1JBVEUsIENIQU5ORUxTLCAyMDApO1xyXG4gICAgY29uc3QgdHJhY2sgPSBMb2NhbEF1ZGlvVHJhY2suY3JlYXRlQXVkaW9UcmFjaygnbXVzaWMnLCBzb3VyY2UpO1xyXG4gICAgY29uc3QgYmluZGluZzogQXVkaW9CaW5kaW5nID0geyByb29tLCBzb3VyY2UsIHRyYWNrLCByZWFkeTogZmFsc2UgfTtcclxuICAgIHRoaXMuYmluZGluZ3Muc2V0KGNvbm5lY3Rpb24sIGJpbmRpbmcpO1xyXG4gICAgY29uc3Qgb3B0aW9ucyA9IG5ldyBUcmFja1B1Ymxpc2hPcHRpb25zKCk7XHJcbiAgICBvcHRpb25zLnNvdXJjZSA9IFRyYWNrU291cmNlLlNPVVJDRV9NSUNST1BIT05FO1xyXG4gICAgdm9pZCAoYXN5bmMgKCkgPT4ge1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGlmICghcm9vbS5sb2NhbFBhcnRpY2lwYW50KSB0aHJvdyBuZXcgRXJyb3IoJ0xpdmVLaXQgbG9jYWwgcGFydGljaXBhbnQgaXMgdW5hdmFpbGFibGUnKTtcclxuICAgICAgICBiaW5kaW5nLnB1Ymxpc2hpbmcgPSByb29tLmxvY2FsUGFydGljaXBhbnQucHVibGlzaFRyYWNrKHRyYWNrLCBvcHRpb25zKTtcclxuICAgICAgICBiaW5kaW5nLnB1YmxpY2F0aW9uID0gYXdhaXQgYmluZGluZy5wdWJsaXNoaW5nO1xyXG4gICAgICAgIGlmICh0aGlzLmJpbmRpbmdzLmdldChjb25uZWN0aW9uKSAhPT0gYmluZGluZykge1xyXG4gICAgICAgICAgYXdhaXQgdGhpcy5jbG9zZUJpbmRpbmcoYmluZGluZyk7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGJpbmRpbmcucmVhZHkgPSB0cnVlO1xyXG4gICAgICAgIGlmICh0aGlzLnN0YXRlLnN0YXR1cyA9PT0gQXVkaW9QbGF5ZXJTdGF0dXMuQXV0b1BhdXNlZCkge1xyXG4gICAgICAgICAgdGhpcy5zZXRTdGF0ZSh7IHN0YXR1czogdGhpcy5zZXNzaW9uPy5yZXNvdXJjZS5zdGFydGVkID8gQXVkaW9QbGF5ZXJTdGF0dXMuUGxheWluZyA6IEF1ZGlvUGxheWVyU3RhdHVzLkJ1ZmZlcmluZywgcmVzb3VyY2U6IHRoaXMuc2Vzc2lvbj8ucmVzb3VyY2UgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMud2FrZSgpO1xyXG4gICAgICAgIHRoaXMuc3RhcnRJZlJlYWR5KCk7XHJcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuYmluZGluZ3MuZ2V0KGNvbm5lY3Rpb24pICE9PSBiaW5kaW5nKSByZXR1cm47XHJcbiAgICAgICAgdGhpcy5iaW5kaW5ncy5kZWxldGUoY29ubmVjdGlvbik7XHJcbiAgICAgICAgdm9pZCB0aGlzLmNsb3NlQmluZGluZyhiaW5kaW5nKTtcclxuICAgICAgICB0aGlzLmhhbmRsZU5vQ29ubmVjdGlvbigpO1xyXG4gICAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCB7IG1lc3NhZ2U6IChlcnJvciBhcyBFcnJvcikubWVzc2FnZSwgcmVzb3VyY2U6IHRoaXMuc2Vzc2lvbj8ucmVzb3VyY2UgfSk7XHJcbiAgICAgIH1cclxuICAgIH0pKCk7XHJcbiAgfVxyXG5cclxuICBvbkNvbm5lY3Rpb25EaXNjb25uZWN0ZWQoY29ubmVjdGlvbjogVm9pY2VDb25uZWN0aW9uKTogdm9pZCB7XHJcbiAgICBjb25zdCBiaW5kaW5nID0gdGhpcy5iaW5kaW5ncy5nZXQoY29ubmVjdGlvbik7XHJcbiAgICB0aGlzLmJpbmRpbmdzLmRlbGV0ZShjb25uZWN0aW9uKTtcclxuICAgIGlmIChiaW5kaW5nKSB2b2lkIHRoaXMuY2xvc2VCaW5kaW5nKGJpbmRpbmcpO1xyXG4gICAgdGhpcy5oYW5kbGVOb0Nvbm5lY3Rpb24oKTtcclxuICAgIHRoaXMud2FrZSgpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZWFkeUJpbmRpbmdzKCk6IEF1ZGlvQmluZGluZ1tdIHtcclxuICAgIHJldHVybiBbLi4udGhpcy5iaW5kaW5ncy52YWx1ZXMoKV0uZmlsdGVyKGJpbmRpbmcgPT4gYmluZGluZy5yZWFkeSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGNsb3NlQmluZGluZyhiaW5kaW5nOiBBdWRpb0JpbmRpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGlmIChiaW5kaW5nLmNsb3NpbmcpIHJldHVybiBiaW5kaW5nLmNsb3Npbmc7XHJcbiAgICBiaW5kaW5nLnNvdXJjZS5jbGVhclF1ZXVlKCk7XHJcbiAgICBiaW5kaW5nLmNsb3NpbmcgPSAoYXN5bmMgKCkgPT4ge1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGF3YWl0IGJpbmRpbmcucHVibGlzaGluZz8uY2F0Y2goKCkgPT4ge30pO1xyXG4gICAgICAgIGNvbnN0IHNpZCA9IGJpbmRpbmcucHVibGljYXRpb24/LnNpZCA/PyBiaW5kaW5nLnRyYWNrLnNpZDtcclxuICAgICAgICBpZiAoc2lkKSBhd2FpdCBiaW5kaW5nLnJvb20ubG9jYWxQYXJ0aWNpcGFudD8udW5wdWJsaXNoVHJhY2soc2lkKS5jYXRjaCgoKSA9PiB7fSk7XHJcbiAgICAgICAgYXdhaXQgYmluZGluZy5jYXB0dXJlPy5jYXRjaCgoKSA9PiB7fSk7XHJcbiAgICAgIH0gZmluYWxseSB7XHJcbiAgICAgICAgdHJ5IHsgYXdhaXQgYmluZGluZy50cmFjay5jbG9zZShmYWxzZSk7IH1cclxuICAgICAgICBmaW5hbGx5IHsgYXdhaXQgYmluZGluZy5zb3VyY2UuY2xvc2UoKTsgfVxyXG4gICAgICB9XHJcbiAgICB9KSgpLmNhdGNoKCgpID0+IHt9KTtcclxuICAgIHJldHVybiBiaW5kaW5nLmNsb3Npbmc7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGhhbmRsZU5vQ29ubmVjdGlvbigpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5zZXNzaW9uIHx8IHRoaXMucmVhZHlCaW5kaW5ncygpLmxlbmd0aCkgcmV0dXJuO1xyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5iZWhhdmlvcnM/Lm5vU3Vic2NyaWJlciA9PT0gJ3N0b3AnKSB0aGlzLnN0b3AoKTtcclxuICAgIGVsc2UgaWYgKHRoaXMub3B0aW9ucy5iZWhhdmlvcnM/Lm5vU3Vic2NyaWJlciA9PT0gJ3BhdXNlJyAmJiB0aGlzLnN0YXRlLnN0YXR1cyAhPT0gQXVkaW9QbGF5ZXJTdGF0dXMuUGF1c2VkKSB7XHJcbiAgICAgIHRoaXMuc2V0U3RhdGUoeyBzdGF0dXM6IEF1ZGlvUGxheWVyU3RhdHVzLkF1dG9QYXVzZWQsIHJlc291cmNlOiB0aGlzLnNlc3Npb24ucmVzb3VyY2UgfSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHN0YXJ0SWZSZWFkeSgpOiB2b2lkIHtcclxuICAgIGNvbnN0IHNlc3Npb24gPSB0aGlzLnNlc3Npb247XHJcbiAgICBpZiAoIXNlc3Npb24gfHwgc2Vzc2lvbi5ydW5uaW5nIHx8ICF0aGlzLnJlYWR5QmluZGluZ3MoKS5sZW5ndGgpIHJldHVybjtcclxuICAgIHNlc3Npb24ucnVubmluZyA9IHRydWU7XHJcbiAgICB2b2lkIHRoaXMucnVuKHNlc3Npb24pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBpc0N1cnJlbnQoc2Vzc2lvbjogUGxheWJhY2tTZXNzaW9uKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gdGhpcy5zZXNzaW9uID09PSBzZXNzaW9uICYmICFzZXNzaW9uLmNhbmNlbGxlZDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYXN5bmMgcnVuKHNlc3Npb246IFBsYXliYWNrU2Vzc2lvbik6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgdHJ5IHtcclxuICAgICAgc2Vzc2lvbi5zdGFydHVwVGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4gdGhpcy5mYWlsKHNlc3Npb24sIG5ldyBFcnJvcignVGltZW91dCB3YWl0aW5nIGZvciBhdWRpbyBkYXRhJykpLCAxMDAwMCk7XHJcbiAgICAgIGF3YWl0IHRoaXMuc3RhcnREZWNvZGVyKHNlc3Npb24pO1xyXG4gICAgICBpZiAoIXRoaXMuaXNDdXJyZW50KHNlc3Npb24pKSByZXR1cm47XHJcbiAgICAgIGxldCBwZW5kaW5nID0gQnVmZmVyLmFsbG9jKDApO1xyXG4gICAgICAvLyBSZWFkaW5nIG9ubHkgYXMgZmFzdCBhcyBmcmFtZXMgYXJlIGNhcHR1cmVkIGJvdW5kcyBib3RoIE5vZGUncyBzdHJlYW0gYW5kIHRoZSBPUyBwaXBlcy5cclxuICAgICAgZm9yIGF3YWl0IChjb25zdCBkYXRhIG9mIHNlc3Npb24ucGNtISkge1xyXG4gICAgICAgIGlmICghdGhpcy5pc0N1cnJlbnQoc2Vzc2lvbikpIHJldHVybjtcclxuICAgICAgICBjb25zdCBjaHVuayA9IHBlbmRpbmcubGVuZ3RoID8gQnVmZmVyLmNvbmNhdChbcGVuZGluZywgZGF0YSBhcyBCdWZmZXJdKSA6IGRhdGEgYXMgQnVmZmVyO1xyXG4gICAgICAgIGlmIChjaHVuay5sZW5ndGggPj0gRlJBTUVfQllURVMpIGNsZWFyVGltZW91dChzZXNzaW9uLnN0YXJ0dXBUaW1lb3V0KTtcclxuICAgICAgICBsZXQgb2Zmc2V0ID0gMDtcclxuICAgICAgICB3aGlsZSAob2Zmc2V0ICsgRlJBTUVfQllURVMgPD0gY2h1bmsubGVuZ3RoKSB7XHJcbiAgICAgICAgICBpZiAoIWF3YWl0IHRoaXMuc2VuZEZyYW1lKHNlc3Npb24sIGNodW5rLnN1YmFycmF5KG9mZnNldCwgb2Zmc2V0ICsgRlJBTUVfQllURVMpKSkgcmV0dXJuO1xyXG4gICAgICAgICAgb2Zmc2V0ICs9IEZSQU1FX0JZVEVTO1xyXG4gICAgICAgIH1cclxuICAgICAgICBwZW5kaW5nID0gQnVmZmVyLmZyb20oY2h1bmsuc3ViYXJyYXkob2Zmc2V0KSk7XHJcbiAgICAgIH1cclxuICAgICAgaWYgKCF0aGlzLmlzQ3VycmVudChzZXNzaW9uKSkgcmV0dXJuO1xyXG4gICAgICBpZiAocGVuZGluZy5sZW5ndGgpIHtcclxuICAgICAgICBjbGVhclRpbWVvdXQoc2Vzc2lvbi5zdGFydHVwVGltZW91dCk7XHJcbiAgICAgICAgY29uc3QgbGFzdEZyYW1lID0gQnVmZmVyLmFsbG9jKEZSQU1FX0JZVEVTKTtcclxuICAgICAgICBwZW5kaW5nLmNvcHkobGFzdEZyYW1lKTtcclxuICAgICAgICBpZiAoIWF3YWl0IHRoaXMuc2VuZEZyYW1lKHNlc3Npb24sIGxhc3RGcmFtZSkpIHJldHVybjtcclxuICAgICAgfVxyXG4gICAgICBpZiAoIXNlc3Npb24ucmVzb3VyY2Uuc3RhcnRlZCkgdGhyb3cgbmV3IEVycm9yKCdGRm1wZWcgZmFpbGVkIHRvIHByb2R1Y2UgYXVkaW8gZGF0YScpO1xyXG4gICAgICBhd2FpdCBQcm9taXNlLmFsbCh0aGlzLnJlYWR5QmluZGluZ3MoKS5tYXAoYmluZGluZyA9PiBiaW5kaW5nLnNvdXJjZS53YWl0Rm9yUGxheW91dCgpKSk7XHJcbiAgICAgIGlmICh0aGlzLmlzQ3VycmVudChzZXNzaW9uKSkgdGhpcy5zdG9wKCk7XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICBpZiAodGhpcy5pc0N1cnJlbnQoc2Vzc2lvbikpIHRoaXMuZmFpbChzZXNzaW9uLCBlcnJvciBhcyBFcnJvcik7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFzeW5jIHNlbmRGcmFtZShzZXNzaW9uOiBQbGF5YmFja1Nlc3Npb24sIHBjbTogQnVmZmVyKTogUHJvbWlzZTxib29sZWFuPiB7XHJcbiAgICB3aGlsZSAodGhpcy5pc0N1cnJlbnQoc2Vzc2lvbikpIHtcclxuICAgICAgaWYgKHRoaXMuc3RhdGUuc3RhdHVzID09PSBBdWRpb1BsYXllclN0YXR1cy5QYXVzZWQgfHxcclxuICAgICAgICAgICghdGhpcy5yZWFkeUJpbmRpbmdzKCkubGVuZ3RoICYmIHRoaXMub3B0aW9ucy5iZWhhdmlvcnM/Lm5vU3Vic2NyaWJlciAhPT0gJ3BsYXknKSkge1xyXG4gICAgICAgIGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4gdGhpcy53YWl0ZXJzLmFkZChyZXNvbHZlKSk7XHJcbiAgICAgICAgY29udGludWU7XHJcbiAgICAgIH1cclxuICAgICAgY29uc3Qgc2FtcGxlcyA9IG5ldyBJbnQxNkFycmF5KFNBTVBMRVNfUEVSX0ZSQU1FICogQ0hBTk5FTFMpO1xyXG4gICAgICBjb25zdCB2b2x1bWUgPSBzZXNzaW9uLnJlc291cmNlLmdldFZvbHVtZSgpO1xyXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNhbXBsZXMubGVuZ3RoOyBpKyspIHNhbXBsZXNbaV0gPSBNYXRoLnJvdW5kKHBjbS5yZWFkSW50MTZMRShpICogMikgKiB2b2x1bWUpO1xyXG4gICAgICBjb25zdCBmcmFtZSA9IG5ldyBBdWRpb0ZyYW1lKHNhbXBsZXMsIFNBTVBMRV9SQVRFLCBDSEFOTkVMUywgU0FNUExFU19QRVJfRlJBTUUpO1xyXG4gICAgICBjb25zdCBiaW5kaW5ncyA9IHRoaXMucmVhZHlCaW5kaW5ncygpO1xyXG4gICAgICBpZiAoYmluZGluZ3MubGVuZ3RoKSB7XHJcbiAgICAgICAgLy8gQXVkaW9Tb3VyY2UgYXBwbGllcyBuYXRpdmUgcXVldWUgYmFja3ByZXNzdXJlOyBhIHNlY29uZCBKUyBzY2hlZHVsZXIgY2F1c2VzIGRyaWZ0LlxyXG4gICAgICAgIGNvbnN0IGRlbGl2ZXJlZCA9IGF3YWl0IFByb21pc2UuYWxsKGJpbmRpbmdzLm1hcChhc3luYyBiaW5kaW5nID0+IHtcclxuICAgICAgICAgIC8vIENhbmNlbGxhdGlvbiBjbGVhcnMgdGhlIHF1ZXVlIGJ1dCBhbiBlYXJsaWVyIG5hdGl2ZSBjYXB0dXJlIGNhbiBzdGlsbFxyXG4gICAgICAgICAgLy8gYmUgY29tcGxldGluZy4gQXVkaW9Tb3VyY2UgcGVybWl0cyBvbmx5IG9uZSBpbi1mbGlnaHQgY2FwdHVyZS5cclxuICAgICAgICAgIGF3YWl0IGJpbmRpbmcuY2FwdHVyZT8uY2F0Y2goKCkgPT4ge30pO1xyXG4gICAgICAgICAgaWYgKCF0aGlzLmlzQ3VycmVudChzZXNzaW9uKSB8fCAhWy4uLnRoaXMuYmluZGluZ3MudmFsdWVzKCldLmluY2x1ZGVzKGJpbmRpbmcpKSByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICBjb25zdCBjYXB0dXJlID0gYmluZGluZy5jYXB0dXJlID0gYmluZGluZy5zb3VyY2UuY2FwdHVyZUZyYW1lKGZyYW1lKTtcclxuICAgICAgICAgIHRyeSB7IGF3YWl0IGNhcHR1cmU7IH1cclxuICAgICAgICAgIGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICBpZiAodGhpcy5pc0N1cnJlbnQoc2Vzc2lvbikgJiYgWy4uLnRoaXMuYmluZGluZ3MudmFsdWVzKCldLmluY2x1ZGVzKGJpbmRpbmcpKSB0aHJvdyBlcnJvcjtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGZpbmFsbHkgeyBpZiAoYmluZGluZy5jYXB0dXJlID09PSBjYXB0dXJlKSBiaW5kaW5nLmNhcHR1cmUgPSB1bmRlZmluZWQ7IH1cclxuICAgICAgICAgIHJldHVybiBbLi4udGhpcy5iaW5kaW5ncy52YWx1ZXMoKV0uaW5jbHVkZXMoYmluZGluZyk7XHJcbiAgICAgICAgfSkpO1xyXG4gICAgICAgIC8vIFJldGFpbiBhbiBpbi1mbGlnaHQgZnJhbWUgaWYgYWxsIGl0cyByb29tcyBkaXNhcHBlYXJlZCBkdXJpbmcgY2FwdHVyZS5cclxuICAgICAgICBpZiAoIWRlbGl2ZXJlZC5zb21lKEJvb2xlYW4pICYmIHRoaXMub3B0aW9ucy5iZWhhdmlvcnM/Lm5vU3Vic2NyaWJlciAhPT0gJ3BsYXknKSBjb250aW51ZTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgMjApKTtcclxuICAgICAgfVxyXG4gICAgICBpZiAoIXRoaXMuaXNDdXJyZW50KHNlc3Npb24pKSByZXR1cm4gZmFsc2U7XHJcbiAgICAgIGlmICghc2Vzc2lvbi5yZXNvdXJjZS5zdGFydGVkKSB7XHJcbiAgICAgICAgc2Vzc2lvbi5yZXNvdXJjZS5zdGFydGVkID0gdHJ1ZTtcclxuICAgICAgICBpZiAodGhpcy5zdGF0ZS5zdGF0dXMgPT09IEF1ZGlvUGxheWVyU3RhdHVzLkJ1ZmZlcmluZykge1xyXG4gICAgICAgICAgdGhpcy5zZXRTdGF0ZSh7IHN0YXR1czogQXVkaW9QbGF5ZXJTdGF0dXMuUGxheWluZywgcmVzb3VyY2U6IHNlc3Npb24ucmVzb3VyY2UgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhc3luYyBzdGFydERlY29kZXIoc2Vzc2lvbjogUGxheWJhY2tTZXNzaW9uKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCByZXNvdXJjZSA9IHNlc3Npb24ucmVzb3VyY2U7XHJcbiAgICBjb25zdCBpbnB1dCA9IHJlc291cmNlLmdldElucHV0U291cmNlKCk7XHJcbiAgICBjb25zdCBkaXJlY3RQY20gPSByZXNvdXJjZS5pbnB1dFR5cGUgPT09IFN0cmVhbVR5cGUuUmF3ICYmIHJlc291cmNlLnNhbXBsZVJhdGUgPT09IFNBTVBMRV9SQVRFICYmIHJlc291cmNlLm51bUNoYW5uZWxzID09PSBDSEFOTkVMUztcclxuICAgIGlmIChkaXJlY3RQY20gfHwgdHlwZW9mIGlucHV0ICE9PSAnc3RyaW5nJykge1xyXG4gICAgICBjb25zdCBzdHJlYW0gPSBhd2FpdCByZXNvdXJjZS5vcGVuU3RyZWFtKHNlc3Npb24uYWJvcnQuc2lnbmFsKTtcclxuICAgICAgaWYgKCF0aGlzLmlzQ3VycmVudChzZXNzaW9uKSkgeyBzdHJlYW0uZGVzdHJveSgpOyByZXR1cm47IH1cclxuICAgICAgc2Vzc2lvbi5pbnB1dCA9IHN0cmVhbTtcclxuICAgICAgc3RyZWFtLm9uKCdlcnJvcicsIGVycm9yID0+IHRoaXMuZmFpbChzZXNzaW9uLCBlcnJvcikpO1xyXG4gICAgICBpZiAoZGlyZWN0UGNtKSB7IHNlc3Npb24ucGNtID0gc3RyZWFtOyByZXR1cm47IH1cclxuICAgIH1cclxuICAgIGlmICghdGhpcy5pc0N1cnJlbnQoc2Vzc2lvbikpIHJldHVybjtcclxuICAgIGNvbnN0IGlzVXJsID0gdHlwZW9mIGlucHV0ID09PSAnc3RyaW5nJyAmJiAvXmh0dHBzPzpcXC9cXC8vLnRlc3QoaW5wdXQpO1xyXG4gICAgY29uc3QgaW5wdXRBcmdzOiBzdHJpbmdbXSA9IFtdO1xyXG4gICAgaWYgKHJlc291cmNlLmlucHV0VHlwZSA9PT0gU3RyZWFtVHlwZS5SYXcpIHtcclxuICAgICAgaW5wdXRBcmdzLnB1c2goJy1mJywgJ3MxNmxlJywgJy1hcicsIFN0cmluZyhyZXNvdXJjZS5zYW1wbGVSYXRlKSwgJy1hYycsIFN0cmluZyhyZXNvdXJjZS5udW1DaGFubmVscykpO1xyXG4gICAgfSBlbHNlIGlmIChyZXNvdXJjZS5pbnB1dFR5cGUgPT09IFN0cmVhbVR5cGUuT3B1cyB8fCByZXNvdXJjZS5pbnB1dFR5cGUgPT09IFN0cmVhbVR5cGUuT2dnT3B1cykgaW5wdXRBcmdzLnB1c2goJy1mJywgJ29nZycpO1xyXG4gICAgZWxzZSBpZiAocmVzb3VyY2UuaW5wdXRUeXBlID09PSBTdHJlYW1UeXBlLldlYm1PcHVzKSBpbnB1dEFyZ3MucHVzaCgnLWYnLCAnbWF0cm9za2EnKTtcclxuICAgIGlmIChpc1VybCkge1xyXG4gICAgICBpbnB1dEFyZ3MucHVzaCgnLXJ3X3RpbWVvdXQnLCAnMTAwMDAwMDAnKTtcclxuICAgICAgY29uc3QgaGVhZGVycyA9IE9iamVjdC5lbnRyaWVzKHJlc291cmNlLmhlYWRlcnMpLm1hcCgoW2tleSwgdmFsdWVdKSA9PiBrZXkgKyAnOiAnICsgdmFsdWUgKyAnXFxyXFxuJykuam9pbignJyk7XHJcbiAgICAgIGlmIChoZWFkZXJzKSBpbnB1dEFyZ3MucHVzaCgnLWhlYWRlcnMnLCBoZWFkZXJzKTtcclxuICAgIH1cclxuICAgIGNvbnN0IHByb3RvY29scyA9IGlzVXJsID8gJ2h0dHAsaHR0cHMsdGNwLHRscyxjcnlwdG8scGlwZScgOiBzZXNzaW9uLmlucHV0ID8gJ3BpcGUnIDogJ2ZpbGUscGlwZSc7XHJcbiAgICBjb25zdCBmZm1wZWcgPSBzZXNzaW9uLmZmbXBlZyA9IHNwYXduKHRoaXMub3B0aW9ucy5mZm1wZWdQYXRoID8/ICdmZm1wZWcnLCBbXHJcbiAgICAgICctaGlkZV9iYW5uZXInLCAnLWxvZ2xldmVsJywgJ2Vycm9yJywgJy1wcm90b2NvbF93aGl0ZWxpc3QnLCBwcm90b2NvbHMsIC4uLmlucHV0QXJncyxcclxuICAgICAgJy1pJywgc2Vzc2lvbi5pbnB1dCA/ICdwaXBlOjAnIDogaW5wdXQgYXMgc3RyaW5nLFxyXG4gICAgICAnLXZuJywgJy1mJywgJ3MxNmxlJywgJy1hcicsIFN0cmluZyhTQU1QTEVfUkFURSksICctYWMnLCBTdHJpbmcoQ0hBTk5FTFMpLCAnLWFjb2RlYycsICdwY21fczE2bGUnLCAncGlwZToxJyxcclxuICAgIF0sIHsgc3RkaW86IFsncGlwZScsICdwaXBlJywgJ3BpcGUnXSwgc2hlbGw6IGZhbHNlLCB3aW5kb3dzSGlkZTogdHJ1ZSB9KTtcclxuICAgIHNlc3Npb24ucGNtID0gZmZtcGVnLnN0ZG91dCE7XHJcbiAgICBsZXQgc3RkZXJyID0gJyc7XHJcbiAgICBmZm1wZWcuc3RkZXJyPy5vbignZGF0YScsIChjaHVuazogQnVmZmVyKSA9PiB7IHN0ZGVyciA9IChzdGRlcnIgKyBjaHVuay50b1N0cmluZygpKS5zbGljZSgtTUFYX1NUREVSUl9CWVRFUyk7IH0pO1xyXG4gICAgZmZtcGVnLm9uKCdlcnJvcicsIGVycm9yID0+IHRoaXMuZmFpbChzZXNzaW9uLCBlcnJvcikpO1xyXG4gICAgZmZtcGVnLnN0ZGluPy5vbignZXJyb3InLCBlcnJvciA9PiB0aGlzLmZhaWwoc2Vzc2lvbiwgZXJyb3IpKTtcclxuICAgIGZmbXBlZy5vbignZXhpdCcsIGNvZGUgPT4ge1xyXG4gICAgICBpZiAoY29kZSAhPT0gMCAmJiB0aGlzLmlzQ3VycmVudChzZXNzaW9uKSkgdGhpcy5mYWlsKHNlc3Npb24sIG5ldyBFcnJvcignRkZtcGVnIGV4aXRlZCB3aXRoIGNvZGUgJyArIGNvZGUgKyAnOiAnICsgc3RkZXJyKSk7XHJcbiAgICB9KTtcclxuICAgIGlmIChzZXNzaW9uLmlucHV0KSBzZXNzaW9uLmlucHV0LnBpcGUoZmZtcGVnLnN0ZGluISk7XHJcbiAgICBlbHNlIGZmbXBlZy5zdGRpbj8uZW5kKCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGZhaWwoc2Vzc2lvbjogUGxheWJhY2tTZXNzaW9uLCBlcnJvcjogRXJyb3IpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5pc0N1cnJlbnQoc2Vzc2lvbikpIHJldHVybjtcclxuICAgIGNvbnN0IHJlc291cmNlID0gc2Vzc2lvbi5yZXNvdXJjZTtcclxuICAgIHRoaXMuY2FuY2VsU2Vzc2lvbigpO1xyXG4gICAgLy8gRXJyb3IgbGlzdGVuZXJzIG1heSBzeW5jaHJvbm91c2x5IHBsYXkgdGhlIG5leHQgc29uZy4gTmV2ZXIgb3ZlcndyaXRlIHRoYXQgbmV3IHN0YXRlLlxyXG4gICAgdGhpcy5lbWl0KCdlcnJvcicsIHsgbWVzc2FnZTogZXJyb3IubWVzc2FnZSwgcmVzb3VyY2UgfSk7XHJcbiAgICBpZiAoIXRoaXMuc2Vzc2lvbikgdGhpcy5zZXRTdGF0ZSh7IHN0YXR1czogQXVkaW9QbGF5ZXJTdGF0dXMuSWRsZSB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgY2FuY2VsU2Vzc2lvbigpOiB2b2lkIHtcclxuICAgIGNvbnN0IHNlc3Npb24gPSB0aGlzLnNlc3Npb247XHJcbiAgICB0aGlzLnNlc3Npb24gPSBudWxsO1xyXG4gICAgaWYgKHNlc3Npb24pIHtcclxuICAgICAgc2Vzc2lvbi5jYW5jZWxsZWQgPSB0cnVlO1xyXG4gICAgICBzZXNzaW9uLnJlc291cmNlLmVuZGVkID0gdHJ1ZTtcclxuICAgICAgY2xlYXJUaW1lb3V0KHNlc3Npb24uc3RhcnR1cFRpbWVvdXQpO1xyXG4gICAgICBzZXNzaW9uLmFib3J0LmFib3J0KCk7XHJcbiAgICAgIHNlc3Npb24uaW5wdXQ/LnVucGlwZSgpO1xyXG4gICAgICBzZXNzaW9uLmlucHV0Py5kZXN0cm95KCk7XHJcbiAgICAgIGZvciAoY29uc3QgY2hpbGQgb2YgW3Nlc3Npb24uZmZtcGVnXSkge1xyXG4gICAgICAgIGNoaWxkPy5zdGRpbj8uZGVzdHJveSgpO1xyXG4gICAgICAgIGNoaWxkPy5zdGRvdXQ/LmRlc3Ryb3koKTtcclxuICAgICAgICBjaGlsZD8ua2lsbCgnU0lHS0lMTCcpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICBmb3IgKGNvbnN0IGJpbmRpbmcgb2YgdGhpcy5iaW5kaW5ncy52YWx1ZXMoKSkgYmluZGluZy5zb3VyY2UuY2xlYXJRdWV1ZSgpO1xyXG4gICAgdGhpcy53YWtlKCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHdha2UoKTogdm9pZCB7XHJcbiAgICBmb3IgKGNvbnN0IHJlc29sdmUgb2YgdGhpcy53YWl0ZXJzKSByZXNvbHZlKCk7XHJcbiAgICB0aGlzLndhaXRlcnMuY2xlYXIoKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc2V0U3RhdGUoc3RhdGU6IEF1ZGlvUGxheWVyU3RhdGUpOiB2b2lkIHtcclxuICAgIGNvbnN0IHByZXZpb3VzID0gdGhpcy5zdGF0ZTtcclxuICAgIHRoaXMuc3RhdGUgPSBzdGF0ZTtcclxuICAgIHRoaXMud2FrZSgpO1xyXG4gICAgdGhpcy5lbWl0KCdzdGF0ZUNoYW5nZScsIHByZXZpb3VzLCBzdGF0ZSk7XHJcbiAgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQXVkaW9QbGF5ZXIob3B0aW9ucz86IENyZWF0ZUF1ZGlvUGxheWVyT3B0aW9ucyk6IEF1ZGlvUGxheWVyIHtcclxuICByZXR1cm4gbmV3IEF1ZGlvUGxheWVyKG9wdGlvbnMpO1xyXG59XHJcbiJdfQ==