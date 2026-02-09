import { EventEmitter } from 'events';
import { Room } from '@livekit/rtc-node';
import { JoinVoiceChannelOptions, VoiceConnectionState } from './types';
import { AudioPlayer } from './AudioPlayer';
/**
 * Represents a voice connection to a channel
 */
export declare class VoiceConnection extends EventEmitter {
    /** Current connection state */
    state: VoiceConnectionState;
    /** The channel ID this connection is for */
    readonly channelId: string;
    /** The guild ID this connection is for */
    readonly guildId: string;
    /** LiveKit room instance */
    private room;
    /** LiveKit connection info */
    private livekitEndpoint;
    private livekitToken;
    private livekitRoomName;
    /** Subscribed audio player */
    private subscribedPlayer;
    /** Gateway adapter methods */
    private adapterMethods;
    /** Adapter implementer (for sending payloads) */
    private adapter;
    constructor(options: JoinVoiceChannelOptions);
    /**
     * Subscribe an audio player to this connection
     */
    subscribe(player: AudioPlayer): void;
    /**
     * Unsubscribe the current audio player
     */
    unsubscribe(): void;
    /**
     * Get the LiveKit room (for audio player to publish tracks)
     */
    getRoom(): Room | null;
    /**
     * Disconnect from the voice channel
     */
    disconnect(): boolean;
    /**
     * Destroy the connection completely
     */
    destroy(): void;
    /**
     * Rejoin the voice channel (after disconnect)
     */
    rejoin(): boolean;
    private sendVoiceStateUpdate;
    private handleVoiceServerUpdate;
    private handleVoiceStateUpdate;
    private connectToLiveKit;
    private disconnectFromLiveKit;
    private setState;
}
/**
 * Join a voice channel - main entry point
 */
export declare function joinVoiceChannel(options: JoinVoiceChannelOptions): VoiceConnection;
/**
 * Get an existing voice connection
 */
export declare function getVoiceConnection(guildId: string): VoiceConnection | undefined;
