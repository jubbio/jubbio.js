import { APIGuild, APIChannel, APIGuildMember } from '../types';
import { Collection } from './Collection';
import { GuildMember } from './GuildMember';
import type { Client } from '../Client';
/**
 * Represents a guild
 */
export declare class Guild {
    /** Reference to the client */
    readonly client: Client;
    /** Guild ID */
    readonly id: string;
    /** Guild name */
    name: string;
    /** Guild icon URL */
    icon?: string;
    /** Owner ID */
    ownerId: string;
    /** Whether the guild is unavailable */
    unavailable: boolean;
    /** Cached members */
    members: Collection<string, GuildMember>;
    /** Cached channels */
    channels: Collection<string, APIChannel>;
    constructor(client: Client, data: APIGuild);
    /**
     * Get the guild icon URL
     */
    iconURL(options?: {
        size?: number;
    }): string | null;
    /**
     * Get the voice adapter creator for @jubbio/voice
     */
    get voiceAdapterCreator(): ((methods: {
        onVoiceServerUpdate(data: any): void;
        onVoiceStateUpdate(data: any): void;
        destroy(): void;
    }) => {
        sendPayload(payload: any): boolean;
        destroy(): void;
    }) | undefined;
    /**
     * Fetch a member by ID
     */
    fetchMember(userId: string): Promise<GuildMember | null>;
    /**
     * Convert to string
     */
    toString(): string;
    /**
     * Update guild data
     */
    _patch(data: Partial<APIGuild>): void;
    /**
     * Add a member to cache
     */
    _addMember(data: APIGuildMember): GuildMember;
}
