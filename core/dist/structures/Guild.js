"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Guild = void 0;
const Collection_1 = require("./Collection");
const GuildMember_1 = require("./GuildMember");
const ApplicationCommandManager_1 = require("../managers/ApplicationCommandManager");
/**
 * Represents a guild
 */
class Guild {
    /** Reference to the client */
    client;
    /** Guild ID */
    id;
    /** Guild name */
    name;
    /** Guild icon URL */
    icon;
    /** Owner ID */
    ownerId;
    /** Member count */
    memberCount;
    /** Whether the guild is unavailable */
    unavailable;
    /** Cached members */
    members;
    /** Cached channels */
    channels;
    /** Guild-specific slash commands manager */
    commands;
    constructor(client, data) {
        this.client = client;
        this.id = data.id;
        this.name = data.name;
        this.icon = data.icon;
        this.ownerId = data.owner_id;
        this.memberCount = data.member_count ?? 0;
        this.unavailable = data.unavailable ?? false;
        this.members = new Collection_1.Collection();
        this.channels = new Collection_1.Collection();
        this.commands = new ApplicationCommandManager_1.ApplicationCommandManager(client.rest, this.id);
        // Cache channels from initial data (READY or GUILD_CREATE)
        if (data.channels) {
            for (const channel of data.channels) {
                const channelId = String(channel.id);
                this.channels.set(channelId, channel);
            }
        }
    }
    /**
     * Get the guild icon URL
     */
    iconURL(options) {
        if (!this.icon)
            return null;
        return this.icon;
    }
    /**
     * Get the voice adapter creator for @jubbio/voice
     */
    get voiceAdapterCreator() {
        return this.client.voice.adapters.get(this.id);
    }
    /**
     * Fetch a member by ID
     */
    async fetchMember(userId) {
        // Check cache first
        const cached = this.members.get(userId);
        if (cached)
            return cached;
        // Fetch from API
        const data = await this.client.rest.getMember(this.id, userId);
        if (!data)
            throw new Error(`Member ${userId} not found in guild ${this.id}`);
        const member = this._addMember(data);
        return member;
    }
    /**
     * Fetch guild members list (paginated)
     * @param options.limit Max members to return (default 50)
     * @param options.cursor Pagination cursor from previous response
     * @returns Object with members array and pagination info
     */
    async fetchMembers(options) {
        const data = await this.client.rest.getMembers(this.id, options);
        // Cache fetched members
        if (data?.members) {
            for (const memberData of data.members) {
                this._addMember(memberData);
            }
        }
        return data;
    }
    /**
     * Convert to string
     */
    toString() {
        return this.name;
    }
    /**
     * Update guild data
     */
    _patch(data) {
        if (data.name !== undefined)
            this.name = data.name;
        if (data.icon !== undefined)
            this.icon = data.icon;
        if (data.owner_id !== undefined)
            this.ownerId = data.owner_id;
        if (data.member_count !== undefined)
            this.memberCount = data.member_count;
        if (data.unavailable !== undefined)
            this.unavailable = data.unavailable;
        if (data.channels) {
            for (const channel of data.channels) {
                this.channels.set(String(channel.id), channel);
            }
        }
    }
    /**
     * Add a member to cache
     * Preserves voice state from existing cached member if new data doesn't include it
     */
    _addMember(data) {
        const member = new GuildMember_1.GuildMember(this.client, this, data);
        // Preserve voice state from cache if the new data doesn't have it
        if (!data.voice?.channel_id) {
            const existing = this.members.get(member.id);
            if (existing?.voice?.channelId) {
                member.voice = { ...existing.voice };
            }
        }
        this.members.set(member.id, member);
        return member;
    }
}
exports.Guild = Guild;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiR3VpbGQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvc3RydWN0dXJlcy9HdWlsZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSw2Q0FBMEM7QUFDMUMsK0NBQTRDO0FBQzVDLHFGQUFrRjtBQUdsRjs7R0FFRztBQUNILE1BQWEsS0FBSztJQUNoQiw4QkFBOEI7SUFDZCxNQUFNLENBQVM7SUFFL0IsZUFBZTtJQUNDLEVBQUUsQ0FBUztJQUUzQixpQkFBaUI7SUFDVixJQUFJLENBQVM7SUFFcEIscUJBQXFCO0lBQ2QsSUFBSSxDQUFVO0lBRXJCLGVBQWU7SUFDUixPQUFPLENBQVM7SUFFdkIsbUJBQW1CO0lBQ1osV0FBVyxDQUFTO0lBRTNCLHVDQUF1QztJQUNoQyxXQUFXLENBQVU7SUFFNUIscUJBQXFCO0lBQ2QsT0FBTyxDQUFrQztJQUVoRCxzQkFBc0I7SUFDZixRQUFRLENBQWlDO0lBRWhELDRDQUE0QztJQUM1QixRQUFRLENBQTRCO0lBRXBELFlBQVksTUFBYyxFQUFFLElBQWM7UUFDeEMsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7UUFDckIsSUFBSSxDQUFDLEVBQUUsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDO1FBQ2xCLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQztRQUN0QixJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7UUFDdEIsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDO1FBQzdCLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLFlBQVksSUFBSSxDQUFDLENBQUM7UUFDMUMsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsV0FBVyxJQUFJLEtBQUssQ0FBQztRQUM3QyxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksdUJBQVUsRUFBRSxDQUFDO1FBQ2hDLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSx1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LFlBQVksQ0FBQztRQUMxRSxJQUFJLElBQUksQ0FBQyxXQUFXLEtBQUssU0FBUztZQUFFLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQztRQUN4RSxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUNsQixLQUFLLE1BQU0sT0FBTyxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztnQkFDcEMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQztZQUNqRCxDQUFDO1FBQ0gsQ0FBQztJQUNILENBQUM7SUFFRDs7O09BR0c7SUFDSCxVQUFVLENBQUMsSUFBb0I7UUFDN0IsTUFBTSxNQUFNLEdBQUcsSUFBSSx5QkFBVyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBRXhELGtFQUFrRTtRQUNsRSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxVQUFVLEVBQUUsQ0FBQztZQUM1QixNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDN0MsSUFBSSxRQUFRLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxDQUFDO2dCQUMvQixNQUFNLENBQUMsS0FBSyxHQUFHLEVBQUUsR0FBRyxRQUFRLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDdkMsQ0FBQztRQUNILENBQUM7UUFFRCxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ3BDLE9BQU8sTUFBTSxDQUFDO0lBQ2hCLENBQUM7Q0FDRjtBQTlJRCxzQkE4SUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBUElHdWlsZCwgQVBJQ2hhbm5lbCwgQVBJR3VpbGRNZW1iZXIgfSBmcm9tICcuLi90eXBlcyc7XHJcbmltcG9ydCB7IENvbGxlY3Rpb24gfSBmcm9tICcuL0NvbGxlY3Rpb24nO1xyXG5pbXBvcnQgeyBHdWlsZE1lbWJlciB9IGZyb20gJy4vR3VpbGRNZW1iZXInO1xyXG5pbXBvcnQgeyBBcHBsaWNhdGlvbkNvbW1hbmRNYW5hZ2VyIH0gZnJvbSAnLi4vbWFuYWdlcnMvQXBwbGljYXRpb25Db21tYW5kTWFuYWdlcic7XHJcbmltcG9ydCB0eXBlIHsgQ2xpZW50IH0gZnJvbSAnLi4vQ2xpZW50JztcclxuXHJcbi8qKlxyXG4gKiBSZXByZXNlbnRzIGEgZ3VpbGRcclxuICovXHJcbmV4cG9ydCBjbGFzcyBHdWlsZCB7XHJcbiAgLyoqIFJlZmVyZW5jZSB0byB0aGUgY2xpZW50ICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGNsaWVudDogQ2xpZW50O1xyXG4gIFxyXG4gIC8qKiBHdWlsZCBJRCAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBpZDogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBHdWlsZCBuYW1lICovXHJcbiAgcHVibGljIG5hbWU6IHN0cmluZztcclxuICBcclxuICAvKiogR3VpbGQgaWNvbiBVUkwgKi9cclxuICBwdWJsaWMgaWNvbj86IHN0cmluZztcclxuICBcclxuICAvKiogT3duZXIgSUQgKi9cclxuICBwdWJsaWMgb3duZXJJZDogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBNZW1iZXIgY291bnQgKi9cclxuICBwdWJsaWMgbWVtYmVyQ291bnQ6IG51bWJlcjtcclxuICBcclxuICAvKiogV2hldGhlciB0aGUgZ3VpbGQgaXMgdW5hdmFpbGFibGUgKi9cclxuICBwdWJsaWMgdW5hdmFpbGFibGU6IGJvb2xlYW47XHJcbiAgXHJcbiAgLyoqIENhY2hlZCBtZW1iZXJzICovXHJcbiAgcHVibGljIG1lbWJlcnM6IENvbGxlY3Rpb248c3RyaW5nLCBHdWlsZE1lbWJlcj47XHJcbiAgXHJcbiAgLyoqIENhY2hlZCBjaGFubmVscyAqL1xyXG4gIHB1YmxpYyBjaGFubmVsczogQ29sbGVjdGlvbjxzdHJpbmcsIEFQSUNoYW5uZWw+O1xyXG5cclxuICAvKiogR3VpbGQtc3BlY2lmaWMgc2xhc2ggY29tbWFuZHMgbWFuYWdlciAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBjb21tYW5kczogQXBwbGljYXRpb25Db21tYW5kTWFuYWdlcjtcclxuXHJcbiAgY29uc3RydWN0b3IoY2xpZW50OiBDbGllbnQsIGRhdGE6IEFQSUd1aWxkKSB7XHJcbiAgICB0aGlzLmNsaWVudCA9IGNsaWVudDtcclxuICAgIHRoaXMuaWQgPSBkYXRhLmlkO1xyXG4gICAgdGhpcy5uYW1lID0gZGF0YS5uYW1lO1xyXG4gICAgdGhpcy5pY29uID0gZGF0YS5pY29uO1xyXG4gICAgdGhpcy5vd25lcklkID0gZGF0YS5vd25lcl9pZDtcclxuICAgIHRoaXMubWVtYmVyQ291bnQgPSBkYXRhLm1lbWJlcl9jb3VudCA/PyAwO1xyXG4gICAgdGhpcy51bmF2YWlsYWJsZSA9IGRhdGEudW5hdmFpbGFibGUgPz8gZmFsc2U7XHJcbiAgICB0aGlzLm1lbWJlcnMgPSBuZXcgQ29sbGVjdGlvbigpO1xyXG4gICAgdGhpcy5jaGFubmVscyA9IG5ldyBDb2xsZWN0aW9uKCk7XHJcbiAgICB0aGlzLmNvbW1hbmRzID0gbmV3IEFwcGxpY2F0aW9uQ29tbWFuZE1hbmFnZXIoY2xpZW50LnJlc3QsIHRoaXMuaWQpO1xyXG4gICAgXHJcbiAgICAvLyBDYWNoZSBjaGFubmVscyBmcm9tIGluaXRpYWwgZGF0YSAoUkVBRFkgb3IgR1VJTERfQ1JFQVRFKVxyXG4gICAgaWYgKGRhdGEuY2hhbm5lbHMpIHtcclxuICAgICAgZm9yIChjb25zdCBjaGFubmVsIG9mIGRhdGEuY2hhbm5lbHMpIHtcclxuICAgICAgICBjb25zdCBjaGFubmVsSWQgPSBTdHJpbmcoY2hhbm5lbC5pZCk7XHJcbiAgICAgICAgdGhpcy5jaGFubmVscy5zZXQoY2hhbm5lbElkLCBjaGFubmVsKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IHRoZSBndWlsZCBpY29uIFVSTFxyXG4gICAqL1xyXG4gIGljb25VUkwob3B0aW9ucz86IHsgc2l6ZT86IG51bWJlciB9KTogc3RyaW5nIHwgbnVsbCB7XHJcbiAgICBpZiAoIXRoaXMuaWNvbikgcmV0dXJuIG51bGw7XHJcbiAgICByZXR1cm4gdGhpcy5pY29uO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IHRoZSB2b2ljZSBhZGFwdGVyIGNyZWF0b3IgZm9yIEBqdWJiaW8vdm9pY2VcclxuICAgKi9cclxuICBnZXQgdm9pY2VBZGFwdGVyQ3JlYXRvcigpIHtcclxuICAgIHJldHVybiB0aGlzLmNsaWVudC52b2ljZS5hZGFwdGVycy5nZXQodGhpcy5pZCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBGZXRjaCBhIG1lbWJlciBieSBJRFxyXG4gICAqL1xyXG4gIGFzeW5jIGZldGNoTWVtYmVyKHVzZXJJZDogc3RyaW5nKTogUHJvbWlzZTxHdWlsZE1lbWJlcj4ge1xyXG4gICAgLy8gQ2hlY2sgY2FjaGUgZmlyc3RcclxuICAgIGNvbnN0IGNhY2hlZCA9IHRoaXMubWVtYmVycy5nZXQodXNlcklkKTtcclxuICAgIGlmIChjYWNoZWQpIHJldHVybiBjYWNoZWQ7XHJcbiAgICBcclxuICAgIC8vIEZldGNoIGZyb20gQVBJXHJcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5jbGllbnQucmVzdC5nZXRNZW1iZXIodGhpcy5pZCwgdXNlcklkKTtcclxuICAgIGlmICghZGF0YSkgdGhyb3cgbmV3IEVycm9yKGBNZW1iZXIgJHt1c2VySWR9IG5vdCBmb3VuZCBpbiBndWlsZCAke3RoaXMuaWR9YCk7XHJcbiAgICBjb25zdCBtZW1iZXIgPSB0aGlzLl9hZGRNZW1iZXIoZGF0YSk7XHJcbiAgICByZXR1cm4gbWVtYmVyO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRmV0Y2ggZ3VpbGQgbWVtYmVycyBsaXN0IChwYWdpbmF0ZWQpXHJcbiAgICogQHBhcmFtIG9wdGlvbnMubGltaXQgTWF4IG1lbWJlcnMgdG8gcmV0dXJuIChkZWZhdWx0IDUwKVxyXG4gICAqIEBwYXJhbSBvcHRpb25zLmN1cnNvciBQYWdpbmF0aW9uIGN1cnNvciBmcm9tIHByZXZpb3VzIHJlc3BvbnNlXHJcbiAgICogQHJldHVybnMgT2JqZWN0IHdpdGggbWVtYmVycyBhcnJheSBhbmQgcGFnaW5hdGlvbiBpbmZvXHJcbiAgICovXHJcbiAgYXN5bmMgZmV0Y2hNZW1iZXJzKG9wdGlvbnM/OiB7IGxpbWl0PzogbnVtYmVyOyBjdXJzb3I/OiBzdHJpbmcgfSk6IFByb21pc2U8YW55PiB7XHJcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5jbGllbnQucmVzdC5nZXRNZW1iZXJzKHRoaXMuaWQsIG9wdGlvbnMpO1xyXG5cclxuICAgIC8vIENhY2hlIGZldGNoZWQgbWVtYmVyc1xyXG4gICAgaWYgKGRhdGE/Lm1lbWJlcnMpIHtcclxuICAgICAgZm9yIChjb25zdCBtZW1iZXJEYXRhIG9mIGRhdGEubWVtYmVycykge1xyXG4gICAgICAgIHRoaXMuX2FkZE1lbWJlcihtZW1iZXJEYXRhKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBkYXRhO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ29udmVydCB0byBzdHJpbmdcclxuICAgKi9cclxuICB0b1N0cmluZygpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIHRoaXMubmFtZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFVwZGF0ZSBndWlsZCBkYXRhXHJcbiAgICovXHJcbiAgX3BhdGNoKGRhdGE6IFBhcnRpYWw8QVBJR3VpbGQ+KTogdm9pZCB7XHJcbiAgICBpZiAoZGF0YS5uYW1lICE9PSB1bmRlZmluZWQpIHRoaXMubmFtZSA9IGRhdGEubmFtZTtcclxuICAgIGlmIChkYXRhLmljb24gIT09IHVuZGVmaW5lZCkgdGhpcy5pY29uID0gZGF0YS5pY29uO1xyXG4gICAgaWYgKGRhdGEub3duZXJfaWQgIT09IHVuZGVmaW5lZCkgdGhpcy5vd25lcklkID0gZGF0YS5vd25lcl9pZDtcclxuICAgIGlmIChkYXRhLm1lbWJlcl9jb3VudCAhPT0gdW5kZWZpbmVkKSB0aGlzLm1lbWJlckNvdW50ID0gZGF0YS5tZW1iZXJfY291bnQ7XHJcbiAgICBpZiAoZGF0YS51bmF2YWlsYWJsZSAhPT0gdW5kZWZpbmVkKSB0aGlzLnVuYXZhaWxhYmxlID0gZGF0YS51bmF2YWlsYWJsZTtcclxuICAgIGlmIChkYXRhLmNoYW5uZWxzKSB7XHJcbiAgICAgIGZvciAoY29uc3QgY2hhbm5lbCBvZiBkYXRhLmNoYW5uZWxzKSB7XHJcbiAgICAgICAgdGhpcy5jaGFubmVscy5zZXQoU3RyaW5nKGNoYW5uZWwuaWQpLCBjaGFubmVsKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRkIGEgbWVtYmVyIHRvIGNhY2hlXHJcbiAgICogUHJlc2VydmVzIHZvaWNlIHN0YXRlIGZyb20gZXhpc3RpbmcgY2FjaGVkIG1lbWJlciBpZiBuZXcgZGF0YSBkb2Vzbid0IGluY2x1ZGUgaXRcclxuICAgKi9cclxuICBfYWRkTWVtYmVyKGRhdGE6IEFQSUd1aWxkTWVtYmVyKTogR3VpbGRNZW1iZXIge1xyXG4gICAgY29uc3QgbWVtYmVyID0gbmV3IEd1aWxkTWVtYmVyKHRoaXMuY2xpZW50LCB0aGlzLCBkYXRhKTtcclxuICAgIFxyXG4gICAgLy8gUHJlc2VydmUgdm9pY2Ugc3RhdGUgZnJvbSBjYWNoZSBpZiB0aGUgbmV3IGRhdGEgZG9lc24ndCBoYXZlIGl0XHJcbiAgICBpZiAoIWRhdGEudm9pY2U/LmNoYW5uZWxfaWQpIHtcclxuICAgICAgY29uc3QgZXhpc3RpbmcgPSB0aGlzLm1lbWJlcnMuZ2V0KG1lbWJlci5pZCk7XHJcbiAgICAgIGlmIChleGlzdGluZz8udm9pY2U/LmNoYW5uZWxJZCkge1xyXG4gICAgICAgIG1lbWJlci52b2ljZSA9IHsgLi4uZXhpc3Rpbmcudm9pY2UgfTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICB0aGlzLm1lbWJlcnMuc2V0KG1lbWJlci5pZCwgbWVtYmVyKTtcclxuICAgIHJldHVybiBtZW1iZXI7XHJcbiAgfVxyXG59XHJcbiJdfQ==