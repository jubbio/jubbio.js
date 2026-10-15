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
    /** Online member count */
    onlineCount;
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
        this.onlineCount = data.online_count ?? 0;
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
     * Fetch fresh guild data from API (updates cache)
     * Returns real-time memberCount and onlineCount from live data
     * @param options Optional fetch options
     * @param options.withMembers Whether to also fetch and cache members (not yet implemented)
     * @param options.withRoles Whether to also fetch roles (not yet implemented, structure placeholder)
     */
    async fetch(options) {
        const data = await this.client.rest.getGuild(this.id);
        this._patch(data);
        // Note: withRoles and withMembers are placeholders for future implementation
        // Role caching and member bulk fetching would be implemented here
        // Currently, roles would need a separate API endpoint: this.client.rest.getRoles(this.id)
        return this;
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
        if (data.online_count !== undefined)
            this.onlineCount = data.online_count;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiR3VpbGQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvc3RydWN0dXJlcy9HdWlsZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSw2Q0FBMEM7QUFDMUMsK0NBQTRDO0FBQzVDLHFGQUFrRjtBQUdsRjs7R0FFRztBQUNILE1BQWEsS0FBSztJQUNoQiw4QkFBOEI7SUFDZCxNQUFNLENBQVM7SUFFL0IsZUFBZTtJQUNDLEVBQUUsQ0FBUztJQUUzQixpQkFBaUI7SUFDVixJQUFJLENBQVM7SUFFcEIscUJBQXFCO0lBQ2QsSUFBSSxDQUFVO0lBRXJCLGVBQWU7SUFDUixPQUFPLENBQVM7SUFFdkIsbUJBQW1CO0lBQ1osV0FBVyxDQUFTO0lBRTNCLDBCQUEwQjtJQUNuQixXQUFXLENBQVM7SUFFM0IsdUNBQXVDO0lBQ2hDLFdBQVcsQ0FBVTtJQUU1QixxQkFBcUI7SUFDZCxPQUFPLENBQWtDO0lBRWhELHNCQUFzQjtJQUNmLFFBQVEsQ0FBaUM7SUFFaEQsNENBQTRDO0lBQzVCLFFBQVEsQ0FBNEI7SUFFcEQsWUFBWSxNQUFjLEVBQUUsSUFBYztRQUN4QyxJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztRQUNyQixJQUFJLENBQUMsRUFBRSxHQUFHLElBQUksQ0FBQyxFQUFFLENBQUM7UUFDbEIsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO1FBQ3RCLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQztRQUN0QixJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUM7UUFDN0IsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsWUFBWSxJQUFJLENBQUMsQ0FBQztRQUMxQyxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxZQUFZLElBQUksQ0FBQyxDQUFDO1FBQzFDLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLFdBQVcsSUFBSSxLQUFL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LFFBQVEsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDN0MsSUFBSSxRQUFRLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBRSxDQUFDO2dCQUMvQixNQUFNLENBQUMsS0FBSyxHQUFHLEVBQUUsR0FBRyxRQUFRLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDdkMsQ0FBQztRQUNILENBQUM7UUFFRCxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ3BDLE9BQU8sTUFBTSxDQUFDO0lBQ2hCLENBQUM7Q0FDRjtBQXJLRCxzQkFxS0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBUElHdWlsZCwgQVBJQ2hhbm5lbCwgQVBJR3VpbGRNZW1iZXIgfSBmcm9tICcuLi90eXBlcyc7XHJcbmltcG9ydCB7IENvbGxlY3Rpb24gfSBmcm9tICcuL0NvbGxlY3Rpb24nO1xyXG5pbXBvcnQgeyBHdWlsZE1lbWJlciB9IGZyb20gJy4vR3VpbGRNZW1iZXInO1xyXG5pbXBvcnQgeyBBcHBsaWNhdGlvbkNvbW1hbmRNYW5hZ2VyIH0gZnJvbSAnLi4vbWFuYWdlcnMvQXBwbGljYXRpb25Db21tYW5kTWFuYWdlcic7XHJcbmltcG9ydCB0eXBlIHsgQ2xpZW50IH0gZnJvbSAnLi4vQ2xpZW50JztcclxuXHJcbi8qKlxyXG4gKiBSZXByZXNlbnRzIGEgZ3VpbGRcclxuICovXHJcbmV4cG9ydCBjbGFzcyBHdWlsZCB7XHJcbiAgLyoqIFJlZmVyZW5jZSB0byB0aGUgY2xpZW50ICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGNsaWVudDogQ2xpZW50O1xyXG4gIFxyXG4gIC8qKiBHdWlsZCBJRCAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBpZDogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBHdWlsZCBuYW1lICovXHJcbiAgcHVibGljIG5hbWU6IHN0cmluZztcclxuICBcclxuICAvKiogR3VpbGQgaWNvbiBVUkwgKi9cclxuICBwdWJsaWMgaWNvbj86IHN0cmluZztcclxuICBcclxuICAvKiogT3duZXIgSUQgKi9cclxuICBwdWJsaWMgb3duZXJJZDogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBNZW1iZXIgY291bnQgKi9cclxuICBwdWJsaWMgbWVtYmVyQ291bnQ6IG51bWJlcjtcclxuICBcclxuICAvKiogT25saW5lIG1lbWJlciBjb3VudCAqL1xyXG4gIHB1YmxpYyBvbmxpbmVDb3VudDogbnVtYmVyO1xyXG4gIFxyXG4gIC8qKiBXaGV0aGVyIHRoZSBndWlsZCBpcyB1bmF2YWlsYWJsZSAqL1xyXG4gIHB1YmxpYyB1bmF2YWlsYWJsZTogYm9vbGVhbjtcclxuICBcclxuICAvKiogQ2FjaGVkIG1lbWJlcnMgKi9cclxuICBwdWJsaWMgbWVtYmVyczogQ29sbGVjdGlvbjxzdHJpbmcsIEd1aWxkTWVtYmVyPjtcclxuICBcclxuICAvKiogQ2FjaGVkIGNoYW5uZWxzICovXHJcbiAgcHVibGljIGNoYW5uZWxzOiBDb2xsZWN0aW9uPHN0cmluZywgQVBJQ2hhbm5lbD47XHJcblxyXG4gIC8qKiBHdWlsZC1zcGVjaWZpYyBzbGFzaCBjb21tYW5kcyBtYW5hZ2VyICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGNvbW1hbmRzOiBBcHBsaWNhdGlvbkNvbW1hbmRNYW5hZ2VyO1xyXG5cclxuICBjb25zdHJ1Y3RvcihjbGllbnQ6IENsaWVudCwgZGF0YTogQVBJR3VpbGQpIHtcclxuICAgIHRoaXMuY2xpZW50ID0gY2xpZW50O1xyXG4gICAgdGhpcy5pZCA9IGRhdGEuaWQ7XHJcbiAgICB0aGlzLm5hbWUgPSBkYXRhLm5hbWU7XHJcbiAgICB0aGlzLmljb24gPSBkYXRhLmljb247XHJcbiAgICB0aGlzLm93bmVySWQgPSBkYXRhLm93bmVyX2lkO1xyXG4gICAgdGhpcy5tZW1iZXJDb3VudCA9IGRhdGEubWVtYmVyX2NvdW50ID8/IDA7XHJcbiAgICB0aGlzLm9ubGluZUNvdW50ID0gZGF0YS5vbmxpbmVfY291bnQgPz8gMDtcclxuICAgIHRoaXMudW5hdmFpbGFibGUgPSBkYXRhLnVuYXZhaWxhYmxlID8/IGZhbHNlO1xyXG4gICAgdGhpcy5tZW1iZXJzID0gbmV3IENvbGxlY3Rpb24oKTtcclxuICAgIHRoaXMuY2hhbm5lbHMgPSBuZXcgQ29sbGVjdGlvbigpO1xyXG4gICAgdGhpcy5jb21tYW5kcyA9IG5ldyBBcHBsaWNhdGlvbkNvbW1hbmRNYW5hZ2VyKGNsaWVudC5yZXN0LCB0aGlzLmlkKTtcclxuICAgIFxyXG4gICAgLy8gQ2FjaGUgY2hhbm5lbHMgZnJvbSBpbml0aWFsIGRhdGEgKFJFQURZIG9yIEdVSUxEX0NSRUFURSlcclxuICAgIGlmIChkYXRhLmNoYW5uZWxzKSB7XHJcbiAgICAgIGZvciAoY29uc3QgY2hhbm5lbCBvZiBkYXRhLmNoYW5uZWxzKSB7XHJcbiAgICAgICAgY29uc3QgY2hhbm5lbElkID0gU3RyaW5nKGNoYW5uZWwuaWQpO1xyXG4gICAgICAgIHRoaXMuY2hhbm5lbHMuc2V0KGNoYW5uZWxJZCwgY2hhbm5lbCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCB0aGUgZ3VpbGQgaWNvbiBVUkxcclxuICAgKi9cclxuICBpY29uVVJMKG9wdGlvbnM/OiB7IHNpemU/OiBudW1iZXIgfSk6IHN0cmluZyB8IG51bGwge1xyXG4gICAgaWYgKCF0aGlzLmljb24pIHJldHVybiBudWxsO1xyXG4gICAgcmV0dXJuIHRoaXMuaWNvbjtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCB0aGUgdm9pY2UgYWRhcHRlciBjcmVhdG9yIGZvciBAanViYmlvL3ZvaWNlXHJcbiAgICovXHJcbiAgZ2V0IHZvaWNlQWRhcHRlckNyZWF0b3IoKSB7XHJcbiAgICByZXR1cm4gdGhpcy5jbGllbnQudm9pY2UuYWRhcHRlcnMuZ2V0KHRoaXMuaWQpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRmV0Y2ggYSBtZW1iZXIgYnkgSURcclxuICAgKi9cclxuICBhc3luYyBmZXRjaE1lbWJlcih1c2VySWQ6IHN0cmluZyk6IFByb21pc2U8R3VpbGRNZW1iZXI+IHtcclxuICAgIC8vIENoZWNrIGNhY2hlIGZpcnN0XHJcbiAgICBjb25zdCBjYWNoZWQgPSB0aGlzLm1lbWJlcnMuZ2V0KHVzZXJJZCk7XHJcbiAgICBpZiAoY2FjaGVkKSByZXR1cm4gY2FjaGVkO1xyXG4gICAgXHJcbiAgICAvLyBGZXRjaCBmcm9tIEFQSVxyXG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHRoaXMuY2xpZW50LnJlc3QuZ2V0TWVtYmVyKHRoaXMuaWQsIHVzZXJJZCk7XHJcbiAgICBpZiAoIWRhdGEpIHRocm93IG5ldyBFcnJvcihgTWVtYmVyICR7dXNlcklkfSBub3QgZm91bmQgaW4gZ3VpbGQgJHt0aGlzLmlkfWApO1xyXG4gICAgY29uc3QgbWVtYmVyID0gdGhpcy5fYWRkTWVtYmVyKGRhdGEpO1xyXG4gICAgcmV0dXJuIG1lbWJlcjtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEZldGNoIGd1aWxkIG1lbWJlcnMgbGlzdCAocGFnaW5hdGVkKVxyXG4gICAqIEBwYXJhbSBvcHRpb25zLmxpbWl0IE1heCBtZW1iZXJzIHRvIHJldHVybiAoZGVmYXVsdCA1MClcclxuICAgKiBAcGFyYW0gb3B0aW9ucy5jdXJzb3IgUGFnaW5hdGlvbiBjdXJzb3IgZnJvbSBwcmV2aW91cyByZXNwb25zZVxyXG4gICAqIEByZXR1cm5zIE9iamVjdCB3aXRoIG1lbWJlcnMgYXJyYXkgYW5kIHBhZ2luYXRpb24gaW5mb1xyXG4gICAqL1xyXG4gIGFzeW5jIGZldGNoTWVtYmVycyhvcHRpb25zPzogeyBsaW1pdD86IG51bWJlcjsgY3Vyc29yPzogc3RyaW5nIH0pOiBQcm9taXNlPGFueT4ge1xyXG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHRoaXMuY2xpZW50LnJlc3QuZ2V0TWVtYmVycyh0aGlzLmlkLCBvcHRpb25zKTtcclxuXHJcbiAgICAvLyBDYWNoZSBmZXRjaGVkIG1lbWJlcnNcclxuICAgIGlmIChkYXRhPy5tZW1iZXJzKSB7XHJcbiAgICAgIGZvciAoY29uc3QgbWVtYmVyRGF0YSBvZiBkYXRhLm1lbWJlcnMpIHtcclxuICAgICAgICB0aGlzLl9hZGRNZW1iZXIobWVtYmVyRGF0YSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gZGF0YTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENvbnZlcnQgdG8gc3RyaW5nXHJcbiAgICovXHJcbiAgdG9TdHJpbmcoKTogc3RyaW5nIHtcclxuICAgIHJldHVybiB0aGlzLm5hbWU7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBGZXRjaCBmcmVzaCBndWlsZCBkYXRhIGZyb20gQVBJICh1cGRhdGVzIGNhY2hlKVxyXG4gICAqIFJldHVybnMgcmVhbC10aW1lIG1lbWJlckNvdW50IGFuZCBvbmxpbmVDb3VudCBmcm9tIGxpdmUgZGF0YVxyXG4gICAqIEBwYXJhbSBvcHRpb25zIE9wdGlvbmFsIGZldGNoIG9wdGlvbnNcclxuICAgKiBAcGFyYW0gb3B0aW9ucy53aXRoTWVtYmVycyBXaGV0aGVyIHRvIGFsc28gZmV0Y2ggYW5kIGNhY2hlIG1lbWJlcnMgKG5vdCB5ZXQgaW1wbGVtZW50ZWQpXHJcbiAgICogQHBhcmFtIG9wdGlvbnMud2l0aFJvbGVzIFdoZXRoZXIgdG8gYWxzbyBmZXRjaCByb2xlcyAobm90IHlldCBpbXBsZW1lbnRlZCwgc3RydWN0dXJlIHBsYWNlaG9sZGVyKVxyXG4gICAqL1xyXG4gIGFzeW5jIGZldGNoKG9wdGlvbnM/OiB7IHdpdGhNZW1iZXJzPzogYm9vbGVhbjsgd2l0aFJvbGVzPzogYm9vbGVhbiB9KTogUHJvbWlzZTx0aGlzPiB7XHJcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5jbGllbnQucmVzdC5nZXRHdWlsZCh0aGlzLmlkKTtcclxuICAgIHRoaXMuX3BhdGNoKGRhdGEpO1xyXG4gICAgXHJcbiAgICAvLyBOb3RlOiB3aXRoUm9sZXMgYW5kIHdpdGhNZW1iZXJzIGFyZSBwbGFjZWhvbGRlcnMgZm9yIGZ1dHVyZSBpbXBsZW1lbnRhdGlvblxyXG4gICAgLy8gUm9sZSBjYWNoaW5nIGFuZCBtZW1iZXIgYnVsayBmZXRjaGluZyB3b3VsZCBiZSBpbXBsZW1lbnRlZCBoZXJlXHJcbiAgICAvLyBDdXJyZW50bHksIHJvbGVzIHdvdWxkIG5lZWQgYSBzZXBhcmF0ZSBBUEkgZW5kcG9pbnQ6IHRoaXMuY2xpZW50LnJlc3QuZ2V0Um9sZXModGhpcy5pZClcclxuICAgIFxyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBVcGRhdGUgZ3VpbGQgZGF0YVxyXG4gICAqL1xyXG4gIF9wYXRjaChkYXRhOiBQYXJ0aWFsPEFQSUd1aWxkPik6IHZvaWQge1xyXG4gICAgaWYgKGRhdGEubmFtZSAhPT0gdW5kZWZpbmVkKSB0aGlzLm5hbWUgPSBkYXRhLm5hbWU7XHJcbiAgICBpZiAoZGF0YS5pY29uICE9PSB1bmRlZmluZWQpIHRoaXMuaWNvbiA9IGRhdGEuaWNvbjtcclxuICAgIGlmIChkYXRhLm93bmVyX2lkICE9PSB1bmRlZmluZWQpIHRoaXMub3duZXJJZCA9IGRhdGEub3duZXJfaWQ7XHJcbiAgICBpZiAoZGF0YS5tZW1iZXJfY291bnQgIT09IHVuZGVmaW5lZCkgdGhpcy5tZW1iZXJDb3VudCA9IGRhdGEubWVtYmVyX2NvdW50O1xyXG4gICAgaWYgKGRhdGEub25saW5lX2NvdW50ICE9PSB1bmRlZmluZWQpIHRoaXMub25saW5lQ291bnQgPSBkYXRhLm9ubGluZV9jb3VudDtcclxuICAgIGlmIChkYXRhLnVuYXZhaWxhYmxlICE9PSB1bmRlZmluZWQpIHRoaXMudW5hdmFpbGFibGUgPSBkYXRhLnVuYXZhaWxhYmxlO1xyXG4gICAgaWYgKGRhdGEuY2hhbm5lbHMpIHtcclxuICAgICAgZm9yIChjb25zdCBjaGFubmVsIG9mIGRhdGEuY2hhbm5lbHMpIHtcclxuICAgICAgICB0aGlzLmNoYW5uZWxzLnNldChTdHJpbmcoY2hhbm5lbC5pZCksIGNoYW5uZWwpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBZGQgYSBtZW1iZXIgdG8gY2FjaGVcclxuICAgKiBQcmVzZXJ2ZXMgdm9pY2Ugc3RhdGUgZnJvbSBleGlzdGluZyBjYWNoZWQgbWVtYmVyIGlmIG5ldyBkYXRhIGRvZXNuJ3QgaW5jbHVkZSBpdFxyXG4gICAqL1xyXG4gIF9hZGRNZW1iZXIoZGF0YTogQVBJR3VpbGRNZW1iZXIpOiBHdWlsZE1lbWJlciB7XHJcbiAgICBjb25zdCBtZW1iZXIgPSBuZXcgR3VpbGRNZW1iZXIodGhpcy5jbGllbnQsIHRoaXMsIGRhdGEpO1xyXG4gICAgXHJcbiAgICAvLyBQcmVzZXJ2ZSB2b2ljZSBzdGF0ZSBmcm9tIGNhY2hlIGlmIHRoZSBuZXcgZGF0YSBkb2Vzbid0IGhhdmUgaXRcclxuICAgIGlmICghZGF0YS52b2ljZT8uY2hhbm5lbF9pZCkge1xyXG4gICAgICBjb25zdCBleGlzdGluZyA9IHRoaXMubWVtYmVycy5nZXQobWVtYmVyLmlkKTtcclxuICAgICAgaWYgKGV4aXN0aW5nPy52b2ljZT8uY2hhbm5lbElkKSB7XHJcbiAgICAgICAgbWVtYmVyLnZvaWNlID0geyAuLi5leGlzdGluZy52b2ljZSB9O1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHRoaXMubWVtYmVycy5zZXQobWVtYmVyLmlkLCBtZW1iZXIpO1xyXG4gICAgcmV0dXJuIG1lbWJlcjtcclxuICB9XHJcbn1cclxuIl19