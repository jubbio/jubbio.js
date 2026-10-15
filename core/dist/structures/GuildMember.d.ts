import { APIGuildMember } from '../types';
import { User } from './User';
import { Guild } from './Guild';
import type { Client } from '../Client';
import { PermissionsBitField } from '../utils/PermissionsBitField';
/**
 * Represents a guild member
 */
export declare class GuildMember {
    /** Reference to the client */
    readonly client: Client;
    /** Reference to the guild */
    readonly guild: Guild;
    /** The user this member represents */
    readonly user: User;
    /** Member's nickname */
    nickname?: string;
    /** Member's guild avatar */
    avatar?: string;
    /** Role IDs */
    roles: string[];
    /** Join timestamp */
    readonly joinedTimestamp: number;
    /** Voice state */
    voice: {
        channelId?: string;
        selfMute: boolean;
        selfDeaf: boolean;
    };
    /** Member permissions */
    permissions: PermissionsBitField;
    constructor(client: Client, guild: Guild, data: APIGuildMember);
    /**
     * Get the member's ID
     */
    get id(): string;
    /**
     * Get the display name (nickname or username)
     */
    get displayName(): string;
    /**
     * Get the join date
     */
    get joinedAt(): Date;
    /**
     * Check if member is in a voice channel
     */
    get inVoiceChannel(): boolean;
    /**
     * Get the member's avatar URL
     */
    avatarURL(): string | null;
    /**
     * Get the display avatar URL (member avatar or user avatar)
     */
    displayAvatarURL(): string;
    /**
     * Convert to string (mention format)
     */
    toString(): string;
    /**
     * Update member data
     */
    _patch(data: Partial<APIGuildMember>): void;
}
