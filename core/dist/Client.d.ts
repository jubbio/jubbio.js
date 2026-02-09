import { EventEmitter } from 'events';
import { ClientOptions } from './types';
import { GatewayIntentBits } from './enums';
import { Collection } from './structures/Collection';
import { User } from './structures/User';
import { Guild } from './structures/Guild';
import { BaseChannel } from './structures/Channel';
import { REST } from './rest/REST';
/**
 * Voice adapter creator type for @jubbio/voice compatibility
 */
type VoiceAdapterCreator = (methods: {
    onVoiceServerUpdate(data: any): void;
    onVoiceStateUpdate(data: any): void;
    destroy(): void;
}) => {
    sendPayload(payload: any): boolean;
    destroy(): void;
};
/**
 * Main client class
 */
export declare class Client extends EventEmitter {
    /** Client options */
    readonly options: ClientOptions;
    /** REST API client */
    readonly rest: REST;
    /** The bot user */
    user: User | null;
    /** Application ID */
    applicationId: string | null;
    /** Cached guilds */
    guilds: Collection<string, Guild>;
    /** Cached channels */
    channels: Collection<string, BaseChannel>;
    /** Cached users */
    users: Collection<string, User>;
    /** Voice adapter management */
    voice: {
        adapters: Map<string, VoiceAdapterCreator>;
    };
    /** WebSocket connection */
    private ws;
    /** Bot token */
    private token;
    /** Session ID */
    private sessionId;
    /** Sequence number */
    private sequence;
    /** Heartbeat interval */
    private heartbeatInterval;
    /** Gateway URL */
    private gatewayUrl;
    /** Voice state update handlers (for voice adapters) */
    private voiceStateHandlers;
    private voiceServerHandlers;
    constructor(options: ClientOptions);
    /**
     * Calculate intents value
     */
    private getIntentsValue;
    /**
     * Login to the gateway
     */
    login(token: string): Promise<string>;
    /**
     * Connect to the gateway
     */
    private connect;
    /**
     * Handle incoming gateway message
     */
    private handleMessage;
    /**
     * Handle gateway payload
     */
    private handlePayload;
    /**
     * Handle Hello payload
     */
    private handleHello;
    /**
     * Handle Dispatch events
     */
    private handleDispatch;
    /**
     * Handle Ready event
     */
    private handleReady;
    /**
     * Setup voice adapters for all guilds
     */
    private setupVoiceAdapters;
    /**
     * Create a voice adapter for a guild
     */
    private createVoiceAdapter;
    /**
     * Handle Guild Create event
     */
    private handleGuildCreate;
    /**
     * Handle Guild Update event
     */
    private handleGuildUpdate;
    /**
     * Handle Guild Delete event
     */
    private handleGuildDelete;
    /**
     * Handle Message Create event
     */
    private handleMessageCreate;
    /**
     * Handle Interaction Create event
     */
    private handleInteractionCreate;
    /**
     * Handle Voice State Update event
     */
    private handleVoiceStateUpdate;
    /**
     * Handle Voice Server Update event
     */
    private handleVoiceServerUpdate;
    /**
     * Send Identify payload
     */
    private identify;
    /**
     * Start heartbeat
     */
    private startHeartbeat;
    /**
     * Send payload to gateway
     */
    private send;
    /**
     * Cleanup on disconnect
     */
    private cleanup;
    /**
     * Destroy the client
     */
    destroy(): void;
}
export { GatewayIntentBits };
