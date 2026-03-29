"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GuildMember = exports.Permissions = exports.PermissionFlags = void 0;
const User_1 = require("./User");
/**
 * Permission flags - permission bits
 * Must match community-service/internal/guild/models/permissions.go (truth of source)
 */
exports.PermissionFlags = {
    // General (0-9)
    CreateInstantInvite: 1n << 0n,
    KickMembers: 1n << 1n,
    BanMembers: 1n << 2n,
    Administrator: 1n << 3n,
    ManageChannels: 1n << 4n,
    ManageGuild: 1n << 5n,
    AddReactions: 1n << 6n,
    ViewAuditLog: 1n << 7n,
    ViewGuildInsights: 1n << 8n,
    Stream: 1n << 9n,
    ViewChannel: 1n << 10n,
    // Messages (11-19)
    SendMessages: 1n << 11n,
    SendTTSMessages: 1n << 12n,
    ManageMessages: 1n << 13n,
    EmbedLinks: 1n << 14n,
    AttachFiles: 1n << 15n,
    ReadMessageHistory: 1n << 16n,
    UseExternalEmojis: 1n << 17n,
    UseSlashCommands: 1n << 18n,
    MentionEveryone: 1n << 19n,
    // Voice (20-27)
    Connect: 1n << 20n,
    Speak: 1n << 21n,
    MuteMembers: 1n << 22n,
    DeafenMembers: 1n << 23n,
    MoveMembers: 1n << 24n,
    UseVAD: 1n << 25n,
    ChangeCodec: 1n << 26n,
    AudioQualityAdmin: 1n << 27n,
    // Video and Screen Sharing (28-37)
    VideoCall: 1n << 28n,
    ShareScreen: 1n << 29n,
    ShareCamera: 1n << 30n,
    ControlQuality: 1n << 31n,
    RequestToSpeak: 1n << 32n,
    ManageEvents: 1n << 33n,
    AddMembers: 1n << 34n,
    RemoveMembers: 1n << 35n,
    ChangeGroupIcon: 1n << 36n,
    ChangeDMSettings: 1n << 37n,
    // Advanced (38-43)
    ManageGroup: 1n << 38n,
    UseActivities: 1n << 39n,
    ModerateMembers: 1n << 40n,
    ManageRoles: 1n << 41n,
    ManageEmojis: 1n << 42n,
    PrioritySpeaker: 1n << 43n,
};
/**
 * Permissions helper class
 */
class Permissions {
    bitfield;
    isOwner;
    constructor(bits = 0n, isOwner = false) {
        if (typeof bits === 'string') {
            this.bitfield = BigInt(bits);
        }
        else {
            this.bitfield = BigInt(bits);
        }
        this.isOwner = isOwner;
    }
    /**
     * Check if has a permission
     */
    has(permission, checkAdmin = true) {
        // Owner has all permissions
        if (this.isOwner)
            return true;
        // Administrator has all permissions
        if (checkAdmin && (this.bitfield & exports.PermissionFlags.Administrator) === exports.PermissionFlags.Administrator) {
            return true;
        }
        const bit = Permissions.resolve(permission);
        return (this.bitfield & bit) === bit;
    }
    /**
     * Check if has any of the given permissions
     */
    any(permissions, checkAdmin = true) {
        // Owner has all permissions
        if (this.isOwner)
            return true;
        // Administrator has all permissions
        if (checkAdmin && (this.bitfield & exports.PermissionFlags.Administrator) === exports.PermissionFlags.Administrator) {
            return true;
        }
        for (const permission of permissions) {
            const bit = Permissions.resolve(permission);
            if ((this.bitfield & bit) === bit)
                return true;
        }
        return false;
    }
    /**
     * Return array of permission names that are missing
     */
    missing(permissions, checkAdmin = true) {
        const missing = [];
        for (const permission of permissions) {
            if (!this.has(permission, checkAdmin)) {
                if (typeof permission === 'string') {
                    missing.push(permission);
                }
                else {
                    // Reverse lookup name from bigint
                    const name = Object.entries(exports.PermissionFlags).find(([, v]) => v === permission)?.[0];
                    missing.push(name || permission.toString());
                }
            }
        }
        return missing;
    }
    /**
     * Add permissions to this bitfield. Chainable.
     */
    add(...permissions) {
        for (const permission of permissions) {
            this.bitfield |= Permissions.resolve(permission);
        }
        return this;
    }
    /**
     * Remove permissions from this bitfield. Chainable.
     */
    remove(...permissions) {
        for (const permission of permissions) {
            this.bitfield &= ~Permissions.resolve(permission);
        }
        return this;
    }
    /**
     * Check equality with another Permissions or bigint
     */
    equals(other) {
        if (other instanceof Permissions) {
            return this.bitfield === other.bitfield;
        }
        return this.bitfield === BigInt(other);
    }
    /**
     * Create a new Permissions with the same bits
     */
    clone() {
        return new Permissions(this.bitfield, this.isOwner);
    }
    /**
     * Freeze this instance (immutable)
     */
    freeze() {
        return Object.freeze(this);
    }
    /**
     * Get the raw bitfield
     */
    get bits() {
        return this.bitfield;
    }
    /**
     * Convert to array of permission names
     */
    toArray() {
        const result = [];
        for (const [name, bit] of Object.entries(exports.PermissionFlags)) {
            if ((this.bitfield & bit) === bit) {
                result.push(name);
            }
        }
        return result;
    }
    /**
     * Serialize to JSON-compatible string
     */
    toJSON() {
        return this.bitfield.toString();
    }
    /**
     * String representation
     */
    toString() {
        return this.bitfield.toString();
    }
    /**
     * Resolve a permission name or bigint to bigint
     */
    static resolve(permission) {
        if (typeof permission === 'bigint')
            return permission;
        const bit = exports.PermissionFlags[permission];
        if (bit === undefined) {
            throw new Error(`Unknown permission: ${permission}`);
        }
        return bit;
    }
}
exports.Permissions = Permissions;
/**
 * Represents a guild member
 */
class GuildMember {
    /** Reference to the client */
    client;
    /** Reference to the guild */
    guild;
    /** The user this member represents */
    user;
    /** Member's nickname */
    nickname;
    /** Member's guild avatar */
    avatar;
    /** Role IDs */
    roles;
    /** Join timestamp */
    joinedTimestamp;
    /** Voice state */
    voice;
    /** Member permissions */
    permissions;
    constructor(client, guild, data) {
        this.client = client;
        this.guild = guild;
        this.user = data.user ? new User_1.User(data.user) : new User_1.User({ id: '0', username: 'Unknown' });
        this.nickname = data.nick;
        this.avatar = data.avatar;
        this.roles = data.roles;
        this.joinedTimestamp = new Date(data.joined_at).getTime();
        this.voice = {
            channelId: data.voice?.channel_id,
            selfMute: data.voice?.self_mute ?? false,
            selfDeaf: data.voice?.self_deaf ?? false
        };
        // Check if user is guild owner
        const isOwner = guild.ownerId === this.user.id;
        // Parse permissions from interaction data
        this.permissions = new Permissions(data.permissions || '0', isOwner);
    }
    /**
     * Get the member's ID
     */
    get id() {
        return this.user.id;
    }
    /**
     * Get the display name (nickname or username)
     */
    get displayName() {
        return this.nickname || this.user.displayName || this.user.username;
    }
    /**
     * Get the join date
     */
    get joinedAt() {
        return new Date(this.joinedTimestamp);
    }
    /**
     * Check if member is in a voice channel
     */
    get inVoiceChannel() {
        return !!this.voice.channelId;
    }
    /**
     * Get the member's avatar URL
     */
    avatarURL() {
        return this.avatar || null;
    }
    /**
     * Get the display avatar URL (member avatar or user avatar)
     */
    displayAvatarURL() {
        return this.avatar || this.user.displayAvatarURL();
    }
    /**
     * Convert to string (mention format)
     */
    toString() {
        return `<@${this.id}>`;
    }
    /**
     * Update member data
     */
    _patch(data) {
        if (data.nick !== undefined)
            this.nickname = data.nick;
        if (data.avatar !== undefined)
            this.avatar = data.avatar;
        if (data.roles !== undefined)
            this.roles = data.roles;
        if (data.voice !== undefined) {
            this.voice = {
                channelId: data.voice.channel_id,
                selfMute: data.voice.self_mute ?? false,
                selfDeaf: data.voice.self_deaf ?? false
            };
        }
    }
}
exports.GuildMember = GuildMember;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiR3VpbGRNZW1iZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvc3RydWN0dXJlcy9HdWlsZE1lbWJlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSxpQ0FBOEI7QUFJOUI7OztHQUdHO0FBQ1UsUUFBQSxlQUFlLEdBQUc7SUFDN0IsZ0JBQWdCO0lBQ2hCLG1CQUFtQixFQUFFLEVBQUUsSUFBSSxFQUFFO0lBQzdCLFdBQVcsRUFBRSxFQUFFLElBQUksRUFBRTtJQUNyQixVQUFVLEVBQUUsRUFBRSxJQUFJLEVBQUU7SUFDcEIsYUFBYSxFQUFFLEVBQUUsSUFBSSxFQUFFO0lBQ3ZCLGNBQWMsRUFBRSxFQUFFLElBQUksRUFBRTtJQUN4QixXQUFXLEVBQUUsRUFBRSxJQUFJLEVBQUU7SUFDckIsWUFBWSxFQUFFLEVBQUUsSUFBSSxFQUFFO0lBQ3RCLFlBQVksRUFBRSxFQUFFLElBQUksRUFBRTtJQUN0QixpQkFBaUIsRUFBRSxFQUFFLElBQUksRUFBRTtJQUMzQixNQUFNLEVBQUUsRUFBRSxJQUFJLEVBQUU7SUFDaEIsV0FBVyxFQUFFLEVBQUUsSUFBSSxHQUFHO0lBRXRCLG1CQUFtQjtJQUNuQixZQUFZLEVBQUUsRUFBRSxJQUFJLEdBQUc7SUFDdkIsZUFBZSxFQUFFLEVBQUUsSUFBSSxHQUFHO0lBQzFCLGNBQWMsRUFBRSxFQUFFLElBQUksR0FBRztJQUN6QixVQUFVLEVBQUUsRUFBRSxJQUFJLEdBQUc7SUFDckIsV0FBVyxFQUFFLEVBQUUsSUFBSSxHQUFHO0lBQ3RCLGtCQUFrQixFQUFFLEVBQUUsSUFBSSxHQUFHO0lBQzdCLGlCQUFpQixFQUFFLEVBQUUsSUFBSSxHQUFHO0lBQzVCLGdCQUFnQixFQUFFLEVBQUUsSUFBSSxHQUFHO0lBQzNCLGVBQWUsRUFBRSxFQUFFLElBQUksR0FBRztJQUUxQixnQkFBZ0I7SUFDaEIsT0FBTyxFQUFFLEVBQUUsSUFBSSxHQUFHO0lBQ2xCLEtBQUssRUFBRSxFQUFFLElBQUks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LEtBQUs7YUFDeEMsQ0FBQztRQUNKLENBQUM7SUFDSCxDQUFDO0NBQ0Y7QUFySEQsa0NBcUhDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQVBJR3VpbGRNZW1iZXIgfSBmcm9tICcuLi90eXBlcyc7XHJcbmltcG9ydCB7IFVzZXIgfSBmcm9tICcuL1VzZXInO1xyXG5pbXBvcnQgeyBHdWlsZCB9IGZyb20gJy4vR3VpbGQnO1xyXG5pbXBvcnQgdHlwZSB7IENsaWVudCB9IGZyb20gJy4uL0NsaWVudCc7XHJcblxyXG4vKipcclxuICogUGVybWlzc2lvbiBmbGFncyAtIHBlcm1pc3Npb24gYml0c1xyXG4gKiBNdXN0IG1hdGNoIGNvbW11bml0eS1zZXJ2aWNlL2ludGVybmFsL2d1aWxkL21vZGVscy9wZXJtaXNzaW9ucy5nbyAodHJ1dGggb2Ygc291cmNlKVxyXG4gKi9cclxuZXhwb3J0IGNvbnN0IFBlcm1pc3Npb25GbGFncyA9IHtcclxuICAvLyBHZW5lcmFsICgwLTkpXHJcbiAgQ3JlYXRlSW5zdGFudEludml0ZTogMW4gPDwgMG4sXHJcbiAgS2lja01lbWJlcnM6IDFuIDw8IDFuLFxyXG4gIEJhbk1lbWJlcnM6IDFuIDw8IDJuLFxyXG4gIEFkbWluaXN0cmF0b3I6IDFuIDw8IDNuLFxyXG4gIE1hbmFnZUNoYW5uZWxzOiAxbiA8PCA0bixcclxuICBNYW5hZ2VHdWlsZDogMW4gPDwgNW4sXHJcbiAgQWRkUmVhY3Rpb25zOiAxbiA8PCA2bixcclxuICBWaWV3QXVkaXRMb2c6IDFuIDw8IDduLFxyXG4gIFZpZXdHdWlsZEluc2lnaHRzOiAxbiA8PCA4bixcclxuICBTdHJlYW06IDFuIDw8IDluLFxyXG4gIFZpZXdDaGFubmVsOiAxbiA8PCAxMG4sXHJcblxyXG4gIC8vIE1lc3NhZ2VzICgxMS0xOSlcclxuICBTZW5kTWVzc2FnZXM6IDFuIDw8IDExbixcclxuICBTZW5kVFRTTWVzc2FnZXM6IDFuIDw8IDEybixcclxuICBNYW5hZ2VNZXNzYWdlczogMW4gPDwgMTNuLFxyXG4gIEVtYmVkTGlua3M6IDFuIDw8IDE0bixcclxuICBBdHRhY2hGaWxlczogMW4gPDwgMTVuLFxyXG4gIFJlYWRNZXNzYWdlSGlzdG9yeTogMW4gPDwgMTZuLFxyXG4gIFVzZUV4dGVybmFsRW1vamlzOiAxbiA8PCAxN24sXHJcbiAgVXNlU2xhc2hDb21tYW5kczogMW4gPDwgMThuLFxyXG4gIE1lbnRpb25FdmVyeW9uZTogMW4gPDwgMTluLFxyXG5cclxuICAvLyBWb2ljZSAoMjAtMjcpXHJcbiAgQ29ubmVjdDogMW4gPDwgMjBuLFxyXG4gIFNwZWFrOiAxbiA8PCAyMW4sXHJcbiAgTXV0ZU1lbWJlcnM6IDFuIDw8IDIybixcclxuICBEZWFmZW5NZW1iZXJzOiAxbiA8PCAyM24sXHJcbiAgTW92ZU1lbWJlcnM6IDFuIDw8IDI0bixcclxuICBVc2VWQUQ6IDFuIDw8IDI1bixcclxuICBDaGFuZ2VDb2RlYzogMW4gPDwgMjZuLFxyXG4gIEF1ZGlvUXVhbGl0eUFkbWluOiAxbiA8PCAyN24sXHJcblxyXG4gIC8vIFZpZGVvIGFuZCBTY3JlZW4gU2hhcmluZyAoMjgtMzcpXHJcbiAgVmlkZW9DYWxsOiAxbiA8PCAyOG4sXHJcbiAgU2hhcmVTY3JlZW46IDFuIDw8IDI5bixcclxuICBTaGFyZUNhbWVyYTogMW4gPDwgMzBuLFxyXG4gIENvbnRyb2xRdWFsaXR5OiAxbiA8PCAzMW4sXHJcbiAgUmVxdWVzdFRvU3BlYWs6IDFuIDw8IDMybixcclxuICBNYW5hZ2VFdmVudHM6IDFuIDw8IDMzbixcclxuICBBZGRNZW1iZXJzOiAxbiA8PCAzNG4sXHJcbiAgUmVtb3ZlTWVtYmVyczogMW4gPDwgMzVuLFxyXG4gIENoYW5nZUdyb3VwSWNvbjogMW4gPDwgMzZuLFxyXG4gIENoYW5nZURNU2V0dGluZ3M6IDFuIDw8IDM3bixcclxuXHJcbiAgLy8gQWR2YW5jZWQgKDM4LTQzKVxyXG4gIE1hbmFnZUdyb3VwOiAxbiA8PCAzOG4sXHJcbiAgVXNlQWN0aXZpdGllczogMW4gPDwgMzluLFxyXG4gIE1vZGVyYXRlTWVtYmVyczogMW4gPDwgNDBuLFxyXG4gIE1hbmFnZVJvbGVzOiAxbiA8PCA0MW4sXHJcbiAgTWFuYWdlRW1vamlzOiAxbiA8PCA0Mm4sXHJcbiAgUHJpb3JpdHlTcGVha2VyOiAxbiA8PCA0M24sXHJcbn0gYXMgY29uc3Q7XHJcblxyXG4vKipcclxuICogUGVybWlzc2lvbnMgaGVscGVyIGNsYXNzXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgUGVybWlzc2lvbnMge1xyXG4gIHByaXZhdGUgYml0ZmllbGQ6IGJpZ2ludDtcclxuICBwcml2YXRlIGlzT3duZXI6IGJvb2xlYW47XHJcblxyXG4gIGNvbnN0cnVjdG9yKGJpdHM6IHN0cmluZyB8IGJpZ2ludCB8IG51bWJlciA9IDBuLCBpc093bmVyID0gZmFsc2UpIHtcclxuICAgIGlmICh0eXBlb2YgYml0cyA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgdGhpcy5iaXRmaWVsZCA9IEJpZ0ludChiaXRzKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMuYml0ZmllbGQgPSBCaWdJbnQoYml0cyk7XHJcbiAgICB9XHJcbiAgICB0aGlzLmlzT3duZXIgPSBpc093bmVyO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2hlY2sgaWYgaGFzIGEgcGVybWlzc2lvblxyXG4gICAqL1xyXG4gIGhhcyhwZXJtaXNzaW9uOiBzdHJpbmcgfCBiaWdpbnQsIGNoZWNrQWRtaW4gPSB0cnVlKTogYm9vbGVhbiB7XHJcbiAgICAvLyBPd25lciBoYXMgYWxsIHBlcm1pc3Npb25zXHJcbiAgICBpZiAodGhpcy5pc093bmVyKSByZXR1cm4gdHJ1ZTtcclxuICAgIFxyXG4gICAgLy8gQWRtaW5pc3RyYXRvciBoYXMgYWxsIHBlcm1pc3Npb25zXHJcbiAgICBpZiAoY2hlY2tBZG1pbiAmJiAodGhpcy5iaXRmaWVsZCAmIFBlcm1pc3Npb25GbGFncy5BZG1pbmlzdHJhdG9yKSA9PT0gUGVybWlzc2lvbkZsYWdzLkFkbWluaXN0cmF0b3IpIHtcclxuICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGNvbnN0IGJpdCA9IFBlcm1pc3Npb25zLnJlc29sdmUocGVybWlzc2lvbik7XHJcbiAgICByZXR1cm4gKHRoaXMuYml0ZmllbGQgJiBiaXQpID09PSBiaXQ7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDaGVjayBpZiBoYXMgYW55IG9mIHRoZSBnaXZlbiBwZXJtaXNzaW9uc1xyXG4gICAqL1xyXG4gIGFueShwZXJtaXNzaW9uczogKHN0cmluZyB8IGJpZ2ludClbXSwgY2hlY2tBZG1pbiA9IHRydWUpOiBib29sZWFuIHtcclxuICAgIC8vIE93bmVyIGhhcyBhbGwgcGVybWlzc2lvbnNcclxuICAgIGlmICh0aGlzLmlzT3duZXIpIHJldHVybiB0cnVlO1xyXG4gICAgXHJcbiAgICAvLyBBZG1pbmlzdHJhdG9yIGhhcyBhbGwgcGVybWlzc2lvbnNcclxuICAgIGlmIChjaGVja0FkbWluICYmICh0aGlzLmJpdGZpZWxkICYgUGVybWlzc2lvbkZsYWdzLkFkbWluaXN0cmF0b3IpID09PSBQZXJtaXNzaW9uRmxhZ3MuQWRtaW5pc3RyYXRvcikge1xyXG4gICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgZm9yIChjb25zdCBwZXJtaXNzaW9uIG9mIHBlcm1pc3Npb25zKSB7XHJcbiAgICAgIGNvbnN0IGJpdCA9IFBlcm1pc3Npb25zLnJlc29sdmUocGVybWlzc2lvbik7XHJcbiAgICAgIGlmICgodGhpcy5iaXRmaWVsZCAmIGJpdCkgPT09IGJpdCkgcmV0dXJuIHRydWU7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHJldHVybiBmYWxzZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJldHVybiBhcnJheSBvZiBwZXJtaXNzaW9uIG5hbWVzIHRoYXQgYXJlIG1pc3NpbmdcclxuICAgKi9cclxuICBtaXNzaW5nKHBlcm1pc3Npb25zOiAoc3RyaW5nIHwgYmlnaW50KVtdLCBjaGVja0FkbWluID0gdHJ1ZSk6IHN0cmluZ1tdIHtcclxuICAgIGNvbnN0IG1pc3Npbmc6IHN0cmluZ1tdID0gW107XHJcbiAgICBmb3IgKGNvbnN0IHBlcm1pc3Npb24gb2YgcGVybWlzc2lvbnMpIHtcclxuICAgICAgaWYgKCF0aGlzLmhhcyhwZXJtaXNzaW9uLCBjaGVja0FkbWluKSkge1xyXG4gICAgICAgIGlmICh0eXBlb2YgcGVybWlzc2lvbiA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgICAgIG1pc3NpbmcucHVzaChwZXJtaXNzaW9uKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgLy8gUmV2ZXJzZSBsb29rdXAgbmFtZSBmcm9tIGJpZ2ludFxyXG4gICAgICAgICAgY29uc3QgbmFtZSA9IE9iamVjdC5lbnRyaWVzKFBlcm1pc3Npb25GbGFncykuZmluZCgoWywgdl0pID0+IHYgPT09IHBlcm1pc3Npb24pPy5bMF07XHJcbiAgICAgICAgICBtaXNzaW5nLnB1c2gobmFtZSB8fCBwZXJtaXNzaW9uLnRvU3RyaW5nKCkpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIG1pc3Npbmc7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBZGQgcGVybWlzc2lvbnMgdG8gdGhpcyBiaXRmaWVsZC4gQ2hhaW5hYmxlLlxyXG4gICAqL1xyXG4gIGFkZCguLi5wZXJtaXNzaW9uczogKHN0cmluZyB8IGJpZ2ludClbXSk6IHRoaXMge1xyXG4gICAgZm9yIChjb25zdCBwZXJtaXNzaW9uIG9mIHBlcm1pc3Npb25zKSB7XHJcbiAgICAgIHRoaXMuYml0ZmllbGQgfD0gUGVybWlzc2lvbnMucmVzb2x2ZShwZXJtaXNzaW9uKTtcclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVtb3ZlIHBlcm1pc3Npb25zIGZyb20gdGhpcyBiaXRmaWVsZC4gQ2hhaW5hYmxlLlxyXG4gICAqL1xyXG4gIHJlbW92ZSguLi5wZXJtaXNzaW9uczogKHN0cmluZyB8IGJpZ2ludClbXSk6IHRoaXMge1xyXG4gICAgZm9yIChjb25zdCBwZXJtaXNzaW9uIG9mIHBlcm1pc3Npb25zKSB7XHJcbiAgICAgIHRoaXMuYml0ZmllbGQgJj0gflBlcm1pc3Npb25zLnJlc29sdmUocGVybWlzc2lvbik7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENoZWNrIGVxdWFsaXR5IHdpdGggYW5vdGhlciBQZXJtaXNzaW9ucyBvciBiaWdpbnRcclxuICAgKi9cclxuICBlcXVhbHMob3RoZXI6IFBlcm1pc3Npb25zIHwgYmlnaW50IHwgc3RyaW5nIHwgbnVtYmVyKTogYm9vbGVhbiB7XHJcbiAgICBpZiAob3RoZXIgaW5zdGFuY2VvZiBQZXJtaXNzaW9ucykge1xyXG4gICAgICByZXR1cm4gdGhpcy5iaXRmaWVsZCA9PT0gb3RoZXIuYml0ZmllbGQ7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGhpcy5iaXRmaWVsZCA9PT0gQmlnSW50KG90aGVyKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIG5ldyBQZXJtaXNzaW9ucyB3aXRoIHRoZSBzYW1lIGJpdHNcclxuICAgKi9cclxuICBjbG9uZSgpOiBQZXJtaXNzaW9ucyB7XHJcbiAgICByZXR1cm4gbmV3IFBlcm1pc3Npb25zKHRoaXMuYml0ZmllbGQsIHRoaXMuaXNPd25lcik7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBGcmVlemUgdGhpcyBpbnN0YW5jZSAoaW1tdXRhYmxlKVxyXG4gICAqL1xyXG4gIGZyZWV6ZSgpOiBSZWFkb25seTx0aGlzPiB7XHJcbiAgICByZXR1cm4gT2JqZWN0LmZyZWV6ZSh0aGlzKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCB0aGUgcmF3IGJpdGZpZWxkXHJcbiAgICovXHJcbiAgZ2V0IGJpdHMoKTogYmlnaW50IHtcclxuICAgIHJldHVybiB0aGlzLmJpdGZpZWxkO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ29udmVydCB0byBhcnJheSBvZiBwZXJtaXNzaW9uIG5hbWVzXHJcbiAgICovXHJcbiAgdG9BcnJheSgpOiBzdHJpbmdbXSB7XHJcbiAgICBjb25zdCByZXN1bHQ6IHN0cmluZ1tdID0gW107XHJcbiAgICBmb3IgKGNvbnN0IFtuYW1lLCBiaXRdIG9mIE9iamVjdC5lbnRyaWVzKFBlcm1pc3Npb25GbGFncykpIHtcclxuICAgICAgaWYgKCh0aGlzLmJpdGZpZWxkICYgYml0KSA9PT0gYml0KSB7XHJcbiAgICAgICAgcmVzdWx0LnB1c2gobmFtZSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiByZXN1bHQ7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZXJpYWxpemUgdG8gSlNPTi1jb21wYXRpYmxlIHN0cmluZ1xyXG4gICAqL1xyXG4gIHRvSlNPTigpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIHRoaXMuYml0ZmllbGQudG9TdHJpbmcoKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFN0cmluZyByZXByZXNlbnRhdGlvblxyXG4gICAqL1xyXG4gIHRvU3RyaW5nKCk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gdGhpcy5iaXRmaWVsZC50b1N0cmluZygpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVzb2x2ZSBhIHBlcm1pc3Npb24gbmFtZSBvciBiaWdpbnQgdG8gYmlnaW50XHJcbiAgICovXHJcbiAgc3RhdGljIHJlc29sdmUocGVybWlzc2lvbjogc3RyaW5nIHwgYmlnaW50KTogYmlnaW50IHtcclxuICAgIGlmICh0eXBlb2YgcGVybWlzc2lvbiA9PT0gJ2JpZ2ludCcpIHJldHVybiBwZXJtaXNzaW9uO1xyXG4gICAgY29uc3QgYml0ID0gUGVybWlzc2lvbkZsYWdzW3Blcm1pc3Npb24gYXMga2V5b2YgdHlwZW9mIFBlcm1pc3Npb25GbGFnc107XHJcbiAgICBpZiAoYml0ID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIHBlcm1pc3Npb246ICR7cGVybWlzc2lvbn1gKTtcclxuICAgIH1cclxuICAgIHJldHVybiBiaXQ7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogUmVwcmVzZW50cyBhIGd1aWxkIG1lbWJlclxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIEd1aWxkTWVtYmVyIHtcclxuICAvKiogUmVmZXJlbmNlIHRvIHRoZSBjbGllbnQgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgY2xpZW50OiBDbGllbnQ7XHJcbiAgXHJcbiAgLyoqIFJlZmVyZW5jZSB0byB0aGUgZ3VpbGQgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgZ3VpbGQ6IEd1aWxkO1xyXG4gIFxyXG4gIC8qKiBUaGUgdXNlciB0aGlzIG1lbWJlciByZXByZXNlbnRzICovXHJcbiAgcHVibGljIHJlYWRvbmx5IHVzZXI6IFVzZXI7XHJcbiAgXHJcbiAgLyoqIE1lbWJlcidzIG5pY2tuYW1lICovXHJcbiAgcHVibGljIG5pY2tuYW1lPzogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBNZW1iZXIncyBndWlsZCBhdmF0YXIgKi9cclxuICBwdWJsaWMgYXZhdGFyPzogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBSb2xlIElEcyAqL1xyXG4gIHB1YmxpYyByb2xlczogc3RyaW5nW107XHJcbiAgXHJcbiAgLyoqIEpvaW4gdGltZXN0YW1wICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGpvaW5lZFRpbWVzdGFtcDogbnVtYmVyO1xyXG4gIFxyXG4gIC8qKiBWb2ljZSBzdGF0ZSAqL1xyXG4gIHB1YmxpYyB2b2ljZToge1xyXG4gICAgY2hhbm5lbElkPzogc3RyaW5nO1xyXG4gICAgc2VsZk11dGU6IGJvb2xlYW47XHJcbiAgICBzZWxmRGVhZjogYm9vbGVhbjtcclxuICB9O1xyXG4gIFxyXG4gIC8qKiBNZW1iZXIgcGVybWlzc2lvbnMgKi9cclxuICBwdWJsaWMgcGVybWlzc2lvbnM6IFBlcm1pc3Npb25zO1xyXG5cclxuICBjb25zdHJ1Y3RvcihjbGllbnQ6IENsaWVudCwgZ3VpbGQ6IEd1aWxkLCBkYXRhOiBBUElHdWlsZE1lbWJlcikge1xyXG4gICAgdGhpcy5jbGllbnQgPSBjbGllbnQ7XHJcbiAgICB0aGlzLmd1aWxkID0gZ3VpbGQ7XHJcbiAgICB0aGlzLnVzZXIgPSBkYXRhLnVzZXIgPyBuZXcgVXNlcihkYXRhLnVzZXIpIDogbmV3IFVzZXIoeyBpZDogJzAnLCB1c2VybmFtZTogJ1Vua25vd24nIH0pO1xyXG4gICAgdGhpcy5uaWNrbmFtZSA9IGRhdGEubmljaztcclxuICAgIHRoaXMuYXZhdGFyID0gZGF0YS5hdmF0YXI7XHJcbiAgICB0aGlzLnJvbGVzID0gZGF0YS5yb2xlcztcclxuICAgIHRoaXMuam9pbmVkVGltZXN0YW1wID0gbmV3IERhdGUoZGF0YS5qb2luZWRfYXQpLmdldFRpbWUoKTtcclxuICAgIHRoaXMudm9pY2UgPSB7XHJcbiAgICAgIGNoYW5uZWxJZDogZGF0YS52b2ljZT8uY2hhbm5lbF9pZCxcclxuICAgICAgc2VsZk11dGU6IGRhdGEudm9pY2U/LnNlbGZfbXV0ZSA/PyBmYWxzZSxcclxuICAgICAgc2VsZkRlYWY6IGRhdGEudm9pY2U/LnNlbGZfZGVhZiA/PyBmYWxzZVxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgLy8gQ2hlY2sgaWYgdXNlciBpcyBndWlsZCBvd25lclxyXG4gICAgY29uc3QgaXNPd25lciA9IGd1aWxkLm93bmVySWQgPT09IHRoaXMudXNlci5pZDtcclxuICAgIFxyXG4gICAgLy8gUGFyc2UgcGVybWlzc2lvbnMgZnJvbSBpbnRlcmFjdGlvbiBkYXRhXHJcbiAgICB0aGlzLnBlcm1pc3Npb25zID0gbmV3IFBlcm1pc3Npb25zKGRhdGEucGVybWlzc2lvbnMgfHwgJzAnLCBpc093bmVyKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCB0aGUgbWVtYmVyJ3MgSURcclxuICAgKi9cclxuICBnZXQgaWQoKTogc3RyaW5nIHtcclxuICAgIHJldHVybiB0aGlzLnVzZXIuaWQ7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgdGhlIGRpc3BsYXkgbmFtZSAobmlja25hbWUgb3IgdXNlcm5hbWUpXHJcbiAgICovXHJcbiAgZ2V0IGRpc3BsYXlOYW1lKCk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gdGhpcy5uaWNrbmFtZSB8fCB0aGlzLnVzZXIuZGlzcGxheU5hbWUgfHwgdGhpcy51c2VyLnVzZXJuYW1lO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IHRoZSBqb2luIGRhdGVcclxuICAgKi9cclxuICBnZXQgam9pbmVkQXQoKTogRGF0ZSB7XHJcbiAgICByZXR1cm4gbmV3IERhdGUodGhpcy5qb2luZWRUaW1lc3RhbXApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2hlY2sgaWYgbWVtYmVyIGlzIGluIGEgdm9pY2UgY2hhbm5lbFxyXG4gICAqL1xyXG4gIGdldCBpblZvaWNlQ2hhbm5lbCgpOiBib29sZWFuIHtcclxuICAgIHJldHVybiAhIXRoaXMudm9pY2UuY2hhbm5lbElkO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IHRoZSBtZW1iZXIncyBhdmF0YXIgVVJMXHJcbiAgICovXHJcbiAgYXZhdGFyVVJMKCk6IHN0cmluZyB8IG51bGwge1xyXG4gICAgcmV0dXJuIHRoaXMuYXZhdGFyIHx8IG51bGw7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgdGhlIGRpc3BsYXkgYXZhdGFyIFVSTCAobWVtYmVyIGF2YXRhciBvciB1c2VyIGF2YXRhcilcclxuICAgKi9cclxuICBkaXNwbGF5QXZhdGFyVVJMKCk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gdGhpcy5hdmF0YXIgfHwgdGhpcy51c2VyLmRpc3BsYXlBdmF0YXJVUkwoKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENvbnZlcnQgdG8gc3RyaW5nIChtZW50aW9uIGZvcm1hdClcclxuICAgKi9cclxuICB0b1N0cmluZygpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIGA8QCR7dGhpcy5pZH0+YDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFVwZGF0ZSBtZW1iZXIgZGF0YVxyXG4gICAqL1xyXG4gIF9wYXRjaChkYXRhOiBQYXJ0aWFsPEFQSUd1aWxkTWVtYmVyPik6IHZvaWQge1xyXG4gICAgaWYgKGRhdGEubmljayAhPT0gdW5kZWZpbmVkKSB0aGlzLm5pY2tuYW1lID0gZGF0YS5uaWNrO1xyXG4gICAgaWYgKGRhdGEuYXZhdGFyICE9PSB1bmRlZmluZWQpIHRoaXMuYXZhdGFyID0gZGF0YS5hdmF0YXI7XHJcbiAgICBpZiAoZGF0YS5yb2xlcyAhPT0gdW5kZWZpbmVkKSB0aGlzLnJvbGVzID0gZGF0YS5yb2xlcztcclxuICAgIGlmIChkYXRhLnZvaWNlICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgdGhpcy52b2ljZSA9IHtcclxuICAgICAgICBjaGFubmVsSWQ6IGRhdGEudm9pY2UuY2hhbm5lbF9pZCxcclxuICAgICAgICBzZWxmTXV0ZTogZGF0YS52b2ljZS5zZWxmX211dGUgPz8gZmFsc2UsXHJcbiAgICAgICAgc2VsZkRlYWY6IGRhdGEudm9pY2Uuc2VsZl9kZWFmID8/IGZhbHNlXHJcbiAgICAgIH07XHJcbiAgICB9XHJcbiAgfVxyXG59XHJcbiJdfQ==