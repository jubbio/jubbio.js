import { APIGuildMember } from '../types';
import { User } from './User';
import { Guild } from './Guild';
import type { Client } from '../Client';
/**
 * Permission flags - permission bits
 */
export declare const PermissionFlags: {
    readonly CreateInstantInvite: bigint;
    readonly KickMembers: bigint;
    readonly BanMembers: bigint;
    readonly Administrator: bigint;
    readonly ManageChannels: bigint;
    readonly ManageGuild: bigint;
    readonly AddReactions: bigint;
    readonly ViewAuditLog: bigint;
    readonly PrioritySpeaker: bigint;
    readonly Stream: bigint;
    readonly ViewChannel: bigint;
    readonly SendMessages: bigint;
    readonly SendTTSMessages: bigint;
    readonly ManageMessages: bigint;
    readonly EmbedLinks: bigint;
    readonly AttachFiles: bigint;
    readonly ReadMessageHistory: bigint;
    readonly MentionEveryone: bigint;
    readonly UseExternalEmojis: bigint;
    readonly ViewGuildInsights: bigint;
    readonly Connect: bigint;
    readonly Speak: bigint;
    readonly MuteMembers: bigint;
    readonly DeafenMembers: bigint;
    readonly MoveMembers: bigint;
    readonly UseVAD: bigint;
    readonly ChangeNickname: bigint;
    readonly ManageNicknames: bigint;
    readonly ManageRoles: bigint;
    readonly ManageWebhooks: bigint;
    readonly ManageEmojisAndStickers: bigint;
    readonly UseApplicationCommands: bigint;
    readonly RequestToSpeak: bigint;
    readonly ManageEvents: bigint;
    readonly ManageThreads: bigint;
    readonly CreatePublicThreads: bigint;
    readonly CreatePrivateThreads: bigint;
    readonly UseExternalStickers: bigint;
    readonly SendMessagesInThreads: bigint;
    readonly UseEmbeddedActivities: bigint;
    readonly ModerateMembers: bigint;
};
/**
 * Permissions helper class
 */
export declare class Permissions {
    private bitfield;
    private isOwner;
    constructor(bits?: string | bigint | number, isOwner?: boolean);
    /**
     * Check if has a permission
     */
    has(permission: string | bigint): boolean;
    /**
     * Get the raw bitfield
     */
    get bits(): bigint;
    /**
     * Convert to array of permission names
     */
    toArray(): string[];
}
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
    permissions: Permissions;
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
