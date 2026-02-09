import { PermissionFlagsBits } from '../enums';
/**
 * Permission names type
 */
export type PermissionString = keyof typeof PermissionFlagsBits;
/**
 * Resolvable permission type
 */
export type PermissionResolvable = bigint | bigint[] | PermissionString | PermissionString[] | PermissionsBitField;
/**
 * Bit field for permissions
 * API compatible with Discord.js PermissionsBitField
 */
export declare class PermissionsBitField {
    /** The raw bits */
    bitfield: bigint;
    /** All permission flags */
    static Flags: {
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
    /** All permissions combined */
    static All: bigint;
    /** Default permissions */
    static Default: bigint;
    constructor(bits?: PermissionResolvable);
    /**
     * Check if this bitfield has a permission
     */
    has(permission: PermissionResolvable, checkAdmin?: boolean): boolean;
    /**
     * Check if this bitfield has any of the permissions
     */
    any(permissions: PermissionResolvable, checkAdmin?: boolean): boolean;
    /**
     * Check if this bitfield is missing any permissions
     */
    missing(permissions: PermissionResolvable, checkAdmin?: boolean): PermissionString[];
    /**
     * Add permissions to this bitfield
     */
    add(...permissions: PermissionResolvable[]): this;
    /**
     * Remove permissions from this bitfield
     */
    remove(...permissions: PermissionResolvable[]): this;
    /**
     * Serialize this bitfield to an array of permission names
     */
    toArray(): PermissionString[];
    /**
     * Serialize this bitfield to a JSON-compatible value
     */
    toJSON(): string;
    /**
     * Get the string representation
     */
    toString(): string;
    /**
     * Freeze this bitfield
     */
    freeze(): Readonly<this>;
    /**
     * Check equality with another bitfield
     */
    equals(other: PermissionResolvable): boolean;
    /**
     * Create a new bitfield with the same bits
     */
    clone(): PermissionsBitField;
    /**
     * Resolve a permission to a bigint
     */
    static resolve(permission: PermissionResolvable): bigint;
}
export default PermissionsBitField;
