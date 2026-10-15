"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GuildMember = void 0;
const User_1 = require("./User");
const PermissionsBitField_1 = require("../utils/PermissionsBitField");
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
        this.user = data.user ? new User_1.User(data.user, client) : new User_1.User({ id: '0', username: 'Unknown' }, client);
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
        const permBits = data.permissions ? BigInt(data.permissions) : 0n;
        this.permissions = new PermissionsBitField_1.PermissionsBitField(permBits, isOwner);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiR3VpbGRNZW1iZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvc3RydWN0dXJlcy9HdWlsZE1lbWJlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSxpQ0FBOEI7QUFHOUIsc0VBQW1FO0FBRW5FOztHQUVHO0FBQ0gsTUFBYSxXQUFXO0lBQ3RCLDhCQUE4QjtJQUNkLE1BQU0sQ0FBUztJQUUvQiw2QkFBNkI7SUFDYixLQUFLLENBQVE7SUFFN0Isc0NBQXNDO0lBQ3RCLElBQUksQ0FBTztJQUUzQix3QkFBd0I7SUFDakIsUUFBUSxDQUFVO0lBRXpCLDRCQUE0QjtJQUNyQixNQUFNLENBQVU7SUFFdkIsZUFBZTtJQUNSLEtBQUssQ0FBVztJQUV2QixxQkFBcUI7SUFDTCxlQUFlLENBQVM7SUFFeEMsa0JBQWtCO0lBQ1gsS0FBSyxDQUlWO0lBRUYseUJBQXlCO0lBQ2xCLFdBQVcsQ0FBc0I7SUFFeEMsWUFBWSxNQUFjLEVBQUUsS0FBWSxFQUFFLElBQW9CO1FBQzVELElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1FBQ3JCLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO1FBQ25CLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxXQUFJLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxXQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUN6RyxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7UUFDMUIsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO1FBQzFCLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQztRQUN4QixJQUFJLENBQUMsZUFBZSxHQUFHLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUMxRCxJQUFJLENBQUMsS0FBSyxHQUFHO1lBQ1gsU0FBUyxFQUFFLElBQUksQ0FBQyxLQUFLLEVBQUUsVUFBVTtZQUNqQyxRQUFRLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRSxTQUFTLElBQUksS0FBSztZQUN4QyxRQUFRLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRSxTQUFTLElBQUksS0FBSztTQUN6QyxDQUFDO1FBRUYsK0JBQStCO1FBQy9CLE1BQU0sT0FBTyxHQUFHLEtBQUssQ0FBQyxPQUFPLEtBQUssSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7UUFFL0MsMENBQTBDO1FBQzFDLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUNsRSxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUkseUNBQW1CLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ2hFLENBQUM7SUFFRDs7T0FFRztJQUNILElBQUksRUFBRTtRQUNKLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7SUFDdEIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsSUFBSSxXQUFXO1FBQ2IsT0FBTyxJQUFJLENBQUMsUUFBUSxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDO0lBQ3RFLENBQUM7SUFFRDs7T0FFRztJQUNILElBQUksUUFBUTtRQUNWLE9BQU8sSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDO0lBQ3hDLENBQUM7SUFFRDs7T0FFRztJQUNILElBQUksY0FBYztRQUNoQixPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQztJQUNoQyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxTQUFTO1FBQ1AsT0FBTyxJQUFJLENBQUMsTUFBTSxJQUFJLElBQUksQ0FBQztJQUM3QixDQUFDO0lBRUQ7O09BRUc7SUFDSCxnQkFBZ0I7UUFDZCxPQUFPLElBQUksQ0FBQyxNQUFNLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO0lBQ3JELENBQUM7SUFFRDs7T0FFRztJQUNILFFBQVE7UUFDTixPQUFPLEtBQUssSUFBSSxDQUFDLEVBQUUsR0FBRyxDQUFDO0lBQ3pCLENBQUM7SUFFRDs7T0FFRztJQUNILE1BQU0sQ0FBQyxJQUE2QjtRQUNsQyxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssU0FBUztZQUFFLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQztRQUN2RCxJQUFJLElBQUksQ0FBQyxNQUFNLEtBQUssU0FBUztZQUFFLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQztRQUN6RCxJQUFJLElBQUksQ0FBQyxLQUFLLEtBQUssU0FBUztZQUFFLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQztRQUN0RCxJQUFJLElBQUksQ0FBQyxLQUFLLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDN0IsSUFBSSxDQUFDLEtBQUssR0FBRztnQkFDWCxTQUFTLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFVO2dCQUNoQyxRQUFRLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLElBQUksS0FBSztnQkFDdkMsUUFBUSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxJQUFJLEtBQUs7YUFDeEMsQ0FBQztRQUNKLENBQUM7SUFDSCxDQUFDO0NBQ0Y7QUF0SEQsa0NBc0hDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQVBJR3VpbGRNZW1iZXIgfSBmcm9tICcuLi90eXBlcyc7XHJcbmltcG9ydCB7IFVzZXIgfSBmcm9tICcuL1VzZXInO1xyXG5pbXBvcnQgeyBHdWlsZCB9IGZyb20gJy4vR3VpbGQnO1xyXG5pbXBvcnQgdHlwZSB7IENsaWVudCB9IGZyb20gJy4uL0NsaWVudCc7XHJcbmltcG9ydCB7IFBlcm1pc3Npb25zQml0RmllbGQgfSBmcm9tICcuLi91dGlscy9QZXJtaXNzaW9uc0JpdEZpZWxkJztcclxuXHJcbi8qKlxyXG4gKiBSZXByZXNlbnRzIGEgZ3VpbGQgbWVtYmVyXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgR3VpbGRNZW1iZXIge1xyXG4gIC8qKiBSZWZlcmVuY2UgdG8gdGhlIGNsaWVudCAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBjbGllbnQ6IENsaWVudDtcclxuICBcclxuICAvKiogUmVmZXJlbmNlIHRvIHRoZSBndWlsZCAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBndWlsZDogR3VpbGQ7XHJcbiAgXHJcbiAgLyoqIFRoZSB1c2VyIHRoaXMgbWVtYmVyIHJlcHJlc2VudHMgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgdXNlcjogVXNlcjtcclxuICBcclxuICAvKiogTWVtYmVyJ3Mgbmlja25hbWUgKi9cclxuICBwdWJsaWMgbmlja25hbWU/OiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIE1lbWJlcidzIGd1aWxkIGF2YXRhciAqL1xyXG4gIHB1YmxpYyBhdmF0YXI/OiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIFJvbGUgSURzICovXHJcbiAgcHVibGljIHJvbGVzOiBzdHJpbmdbXTtcclxuICBcclxuICAvKiogSm9pbiB0aW1lc3RhbXAgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgam9pbmVkVGltZXN0YW1wOiBudW1iZXI7XHJcbiAgXHJcbiAgLyoqIFZvaWNlIHN0YXRlICovXHJcbiAgcHVibGljIHZvaWNlOiB7XHJcbiAgICBjaGFubmVsSWQ/OiBzdHJpbmc7XHJcbiAgICBzZWxmTXV0ZTogYm9vbGVhbjtcclxuICAgIHNlbGZEZWFmOiBib29sZWFuO1xyXG4gIH07XHJcbiAgXHJcbiAgLyoqIE1lbWJlciBwZXJtaXNzaW9ucyAqL1xyXG4gIHB1YmxpYyBwZXJtaXNzaW9uczogUGVybWlzc2lvbnNCaXRGaWVsZDtcclxuXHJcbiAgY29uc3RydWN0b3IoY2xpZW50OiBDbGllbnQsIGd1aWxkOiBHdWlsZCwgZGF0YTogQVBJR3VpbGRNZW1iZXIpIHtcclxuICAgIHRoaXMuY2xpZW50ID0gY2xpZW50O1xyXG4gICAgdGhpcy5ndWlsZCA9IGd1aWxkO1xyXG4gICAgdGhpcy51c2VyID0gZGF0YS51c2VyID8gbmV3IFVzZXIoZGF0YS51c2VyLCBjbGllbnQpIDogbmV3IFVzZXIoeyBpZDogJzAnLCB1c2VybmFtZTogJ1Vua25vd24nIH0sIGNsaWVudCk7XHJcbiAgICB0aGlzLm5pY2tuYW1lID0gZGF0YS5uaWNrO1xyXG4gICAgdGhpcy5hdmF0YXIgPSBkYXRhLmF2YXRhcjtcclxuICAgIHRoaXMucm9sZXMgPSBkYXRhLnJvbGVzO1xyXG4gICAgdGhpcy5qb2luZWRUaW1lc3RhbXAgPSBuZXcgRGF0ZShkYXRhLmpvaW5lZF9hdCkuZ2V0VGltZSgpO1xyXG4gICAgdGhpcy52b2ljZSA9IHtcclxuICAgICAgY2hhbm5lbElkOiBkYXRhLnZvaWNlPy5jaGFubmVsX2lkLFxyXG4gICAgICBzZWxmTXV0ZTogZGF0YS52b2ljZT8uc2VsZl9tdXRlID8/IGZhbHNlLFxyXG4gICAgICBzZWxmRGVhZjogZGF0YS52b2ljZT8uc2VsZl9kZWFmID8/IGZhbHNlXHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICAvLyBDaGVjayBpZiB1c2VyIGlzIGd1aWxkIG93bmVyXHJcbiAgICBjb25zdCBpc093bmVyID0gZ3VpbGQub3duZXJJZCA9PT0gdGhpcy51c2VyLmlkO1xyXG4gICAgXHJcbiAgICAvLyBQYXJzZSBwZXJtaXNzaW9ucyBmcm9tIGludGVyYWN0aW9uIGRhdGFcclxuICAgIGNvbnN0IHBlcm1CaXRzID0gZGF0YS5wZXJtaXNzaW9ucyA/IEJpZ0ludChkYXRhLnBlcm1pc3Npb25zKSA6IDBuO1xyXG4gICAgdGhpcy5wZXJtaXNzaW9ucyA9IG5ldyBQZXJtaXNzaW9uc0JpdEZpZWxkKHBlcm1CaXRzLCBpc093bmVyKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCB0aGUgbWVtYmVyJ3MgSURcclxuICAgKi9cclxuICBnZXQgaWQoKTogc3RyaW5nIHtcclxuICAgIHJldHVybiB0aGlzLnVzZXIuaWQ7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgdGhlIGRpc3BsYXkgbmFtZSAobmlja25hbWUgb3IgdXNlcm5hbWUpXHJcbiAgICovXHJcbiAgZ2V0IGRpc3BsYXlOYW1lKCk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gdGhpcy5uaWNrbmFtZSB8fCB0aGlzLnVzZXIuZGlzcGxheU5hbWUgfHwgdGhpcy51c2VyLnVzZXJuYW1lO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IHRoZSBqb2luIGRhdGVcclxuICAgKi9cclxuICBnZXQgam9pbmVkQXQoKTogRGF0ZSB7XHJcbiAgICByZXR1cm4gbmV3IERhdGUodGhpcy5qb2luZWRUaW1lc3RhbXApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2hlY2sgaWYgbWVtYmVyIGlzIGluIGEgdm9pY2UgY2hhbm5lbFxyXG4gICAqL1xyXG4gIGdldCBpblZvaWNlQ2hhbm5lbCgpOiBib29sZWFuIHtcclxuICAgIHJldHVybiAhIXRoaXMudm9pY2UuY2hhbm5lbElkO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IHRoZSBtZW1iZXIncyBhdmF0YXIgVVJMXHJcbiAgICovXHJcbiAgYXZhdGFyVVJMKCk6IHN0cmluZyB8IG51bGwge1xyXG4gICAgcmV0dXJuIHRoaXMuYXZhdGFyIHx8IG51bGw7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgdGhlIGRpc3BsYXkgYXZhdGFyIFVSTCAobWVtYmVyIGF2YXRhciBvciB1c2VyIGF2YXRhcilcclxuICAgKi9cclxuICBkaXNwbGF5QXZhdGFyVVJMKCk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gdGhpcy5hdmF0YXIgfHwgdGhpcy51c2VyLmRpc3BsYXlBdmF0YXJVUkwoKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENvbnZlcnQgdG8gc3RyaW5nIChtZW50aW9uIGZvcm1hdClcclxuICAgKi9cclxuICB0b1N0cmluZygpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIGA8QCR7dGhpcy5pZH0+YDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFVwZGF0ZSBtZW1iZXIgZGF0YVxyXG4gICAqL1xyXG4gIF9wYXRjaChkYXRhOiBQYXJ0aWFsPEFQSUd1aWxkTWVtYmVyPik6IHZvaWQge1xyXG4gICAgaWYgKGRhdGEubmljayAhPT0gdW5kZWZpbmVkKSB0aGlzLm5pY2tuYW1lID0gZGF0YS5uaWNrO1xyXG4gICAgaWYgKGRhdGEuYXZhdGFyICE9PSB1bmRlZmluZWQpIHRoaXMuYXZhdGFyID0gZGF0YS5hdmF0YXI7XHJcbiAgICBpZiAoZGF0YS5yb2xlcyAhPT0gdW5kZWZpbmVkKSB0aGlzLnJvbGVzID0gZGF0YS5yb2xlcztcclxuICAgIGlmIChkYXRhLnZvaWNlICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgdGhpcy52b2ljZSA9IHtcclxuICAgICAgICBjaGFubmVsSWQ6IGRhdGEudm9pY2UuY2hhbm5lbF9pZCxcclxuICAgICAgICBzZWxmTXV0ZTogZGF0YS52b2ljZS5zZWxmX211dGUgPz8gZmFsc2UsXHJcbiAgICAgICAgc2VsZkRlYWY6IGRhdGEudm9pY2Uuc2VsZl9kZWFmID8/IGZhbHNlXHJcbiAgICAgIH07XHJcbiAgICB9XHJcbiAgfVxyXG59XHJcbiJdfQ==