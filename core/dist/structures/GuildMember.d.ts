import { APIGuildMember } from '../types';
import { User } from './User';
import { Guild } from './Guild';
import type { Client } from '../Client';
/**
 * Permission flags - permission bits
 * Must match community-service/internal/guild/models/permissions.go (truth of source)
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
    readonly ViewGuildInsights: bigint;
    readonly Stream: bigint;
    readonly ViewChannel: bigint;
    readonly SendMessages: bigint;
    readonly SendTTSMessages: bigint;
    readonly ManageMessages: bigint;
    readonly EmbedLinks: bigint;
    readonly AttachFiles: bigint;
    readonly ReadMessageHistory: bigint;
    readonly UseExternalEmojis: bigint;
    readonly UseSlashCommands: bigint;
    readonly MentionEveryone: bigint;
    readonly Connect: bigint;
    readonly Speak: bigint;
    readonly MuteMembers: bigint;
    readonly DeafenMembers: bigint;
    readonly MoveMembers: bigint;
    readonly UseVAD: bigint;
    readonly ChangeCodec: bigint;
    readonly AudioQualityAdmin: bigint;
    readonly VideoCall: bigint;
    readonly ShareScreen: bigint;
    readonly ShareCamera: bigint;
    readonly ControlQuality: bigint;
    readonly RequestToSpeak: bigint;
    readonly ManageEvents: bigint;
    readonly AddMembers: bigint;
    readonly RemoveMembers: bigint;
    readonly ChangeGroupIcon: bigint;
    readonly ChangeDMSettings: bigint;
    readonly ManageGroup: bigint;
    readonly UseActivities: bigint;
    readonly ModerateMembers: bigint;
    readonly ManageRoles: bigint;
    readonly ManageEmojis: bigint;
    readonly PrioritySpeaker: bigint;
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
