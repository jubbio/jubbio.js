"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Guild = void 0;
const Collection_1 = require("./Collection");
const GuildMember_1 = require("./GuildMember");
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
    /** Whether the guild is unavailable */
    unavailable;
    /** Cached members */
    members;
    /** Cached channels */
    channels;
    constructor(client, data) {
        this.client = client;
        this.id = data.id;
        this.name = data.name;
        this.icon = data.icon;
        this.ownerId = data.owner_id;
        this.unavailable = data.unavailable ?? false;
        this.members = new Collection_1.Collection();
        this.channels = new Collection_1.Collection();
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
        if (data.unavailable !== undefined)
            this.unavailable = data.unavailable;
    }
    /**
     * Add a member to cache
     */
    _addMember(data) {
        const member = new GuildMember_1.GuildMember(this.client, this, data);
        this.members.set(member.id, member);
        return member;
    }
}
exports.Guild = Guild;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiR3VpbGQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvc3RydWN0dXJlcy9HdWlsZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSw2Q0FBMEM7QUFDMUMsK0NBQTRDO0FBRzVDOztHQUVHO0FBQ0gsTUFBYSxLQUFLO0lBQ2hCLDhCQUE4QjtJQUNkLE1BQU0sQ0FBUztJQUUvQixlQUFlO0lBQ0MsRUFBRSxDQUFTO0lBRTNCLGlCQUFpQjtJQUNWLElBQUksQ0FBUztJQUVwQixxQkFBcUI7SUFDZCxJQUFJLENBQVU7SUFFckIsZUFBZTtJQUNSLE9BQU8sQ0FBUztJQUV2Qix1Q0FBdUM7SUFDaEMsV0FBVyxDQUFVO0lBRTVCLHFCQUFxQjtJQUNkLE9BQU8sQ0FBa0M7SUFFaEQsc0JBQXNCO0lBQ2YsUUFBUSxDQUFpQztJQUVoRCxZQUFZLE1BQWMsRUFBRSxJQUFjO1FBQ3hDLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1FBQ3JCLElBQUksQ0FBQyxFQUFFLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQztRQUNsQixJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7UUFDdEIsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO1FBQ3RCLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQztRQUM3QixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxXQUFXLElBQUksS0FBSyxDQUFDO1FBQzdDLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSx1QkFBVSxFQUFFLENBQUM7UUFDaEMsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLHVCQUFVLEVBQUUsQ0FBQztJQUNuQyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxPQUFPLENBQUMsT0FBMkI7UUFDakMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJO1lBQUUsT0FBTyxJQUFJLENBQUM7UUFDNUIsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDO0lBQ25CLENBQUM7SUFFRDs7T0FFRztJQUNILElBQUksbUJBQW1CO1FBQ3JCLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDakQsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLFdBQVcsQ0FBQyxNQUFjO1FBQzlCLG9CQUFvQjtRQUNwQixNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN4QyxJQUFJLE1BQU07WUFBRSxPQUFPLE1BQU0sQ0FBQztRQUUxQixpQkFBaUI7UUFDakIsTUFBTSxJQUFJLEdBQUcsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUMvRCxJQUFJLENBQUMsSUFBSTtZQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMsVUFBVSxNQUFNLHVCQUF1QixJQUFJLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUM3RSxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3JDLE9BQU8sTUFBTSxDQUFDO0lBQ2hCLENBQUM7SUFFRDs7Ozs7T0FLRztJQUNILEtBQUssQ0FBQyxZQUFZLENBQUMsT0FBNkM7UUFDOUQsTUFBTSxJQUFJLEdBQUcsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUVqRSx3QkFBd0I7UUFDeEIsSUFBSSxJQUFJLEVBQUUsT0FBTyxFQUFFLENBQUM7WUFDbEIsS0FBSyxNQUFNLFVBQVUsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQ3RDLElBQUksQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDOUIsQ0FBQztRQUNILENBQUM7UUFFRCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRDs7T0FFRztJQUNILFFBQVE7UUFDTixPQUFPLElBQUksQ0FBQyxJQUFJLENBQUM7SUFDbkIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsTUFBTSxDQUFDLElBQXVCO1FBQzVCLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxTQUFTO1lBQUUsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO1FBQ25ELElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxTQUFTO1lBQUUsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO1FBQ25ELElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxTQUFTO1lBQUUsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDO1FBQzlELElBQUksSUFBSSxDQUFDLFdBQVcsS0FBSyxTQUFTO1lBQUUsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDO0lBQzFFLENBQUM7SUFFRDs7T0FFRztJQUNILFVBQVUsQ0FBQyxJQUFvQjtRQUM3QixNQUFNLE1BQU0sR0FBRyxJQUFJLHlCQUFXLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDeEQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUNwQyxPQUFPLE1BQU0sQ0FBQztJQUNoQixDQUFDO0NBQ0Y7QUE5R0Qsc0JBOEdDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQVBJR3VpbGQsIEFQSUNoYW5uZWwsIEFQSUd1aWxkTWVtYmVyIH0gZnJvbSAnLi4vdHlwZXMnO1xyXG5pbXBvcnQgeyBDb2xsZWN0aW9uIH0gZnJvbSAnLi9Db2xsZWN0aW9uJztcclxuaW1wb3J0IHsgR3VpbGRNZW1iZXIgfSBmcm9tICcuL0d1aWxkTWVtYmVyJztcclxuaW1wb3J0IHR5cGUgeyBDbGllbnQgfSBmcm9tICcuLi9DbGllbnQnO1xyXG5cclxuLyoqXHJcbiAqIFJlcHJlc2VudHMgYSBndWlsZFxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIEd1aWxkIHtcclxuICAvKiogUmVmZXJlbmNlIHRvIHRoZSBjbGllbnQgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgY2xpZW50OiBDbGllbnQ7XHJcbiAgXHJcbiAgLyoqIEd1aWxkIElEICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGlkOiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIEd1aWxkIG5hbWUgKi9cclxuICBwdWJsaWMgbmFtZTogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBHdWlsZCBpY29uIFVSTCAqL1xyXG4gIHB1YmxpYyBpY29uPzogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBPd25lciBJRCAqL1xyXG4gIHB1YmxpYyBvd25lcklkOiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIFdoZXRoZXIgdGhlIGd1aWxkIGlzIHVuYXZhaWxhYmxlICovXHJcbiAgcHVibGljIHVuYXZhaWxhYmxlOiBib29sZWFuO1xyXG4gIFxyXG4gIC8qKiBDYWNoZWQgbWVtYmVycyAqL1xyXG4gIHB1YmxpYyBtZW1iZXJzOiBDb2xsZWN0aW9uPHN0cmluZywgR3VpbGRNZW1iZXI+O1xyXG4gIFxyXG4gIC8qKiBDYWNoZWQgY2hhbm5lbHMgKi9cclxuICBwdWJsaWMgY2hhbm5lbHM6IENvbGxlY3Rpb248c3RyaW5nLCBBUElDaGFubmVsPjtcclxuXHJcbiAgY29uc3RydWN0b3IoY2xpZW50OiBDbGllbnQsIGRhdGE6IEFQSUd1aWxkKSB7XHJcbiAgICB0aGlzLmNsaWVudCA9IGNsaWVudDtcclxuICAgIHRoaXMuaWQgPSBkYXRhLmlkO1xyXG4gICAgdGhpcy5uYW1lID0gZGF0YS5uYW1lO1xyXG4gICAgdGhpcy5pY29uID0gZGF0YS5pY29uO1xyXG4gICAgdGhpcy5vd25lcklkID0gZGF0YS5vd25lcl9pZDtcclxuICAgIHRoaXMudW5hdmFpbGFibGUgPSBkYXRhLnVuYXZhaWxhYmxlID8/IGZhbHNlO1xyXG4gICAgdGhpcy5tZW1iZXJzID0gbmV3IENvbGxlY3Rpb24oKTtcclxuICAgIHRoaXMuY2hhbm5lbHMgPSBuZXcgQ29sbGVjdGlvbigpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IHRoZSBndWlsZCBpY29uIFVSTFxyXG4gICAqL1xyXG4gIGljb25VUkwob3B0aW9ucz86IHsgc2l6ZT86IG51bWJlciB9KTogc3RyaW5nIHwgbnVsbCB7XHJcbiAgICBpZiAoIXRoaXMuaWNvbikgcmV0dXJuIG51bGw7XHJcbiAgICByZXR1cm4gdGhpcy5pY29uO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IHRoZSB2b2ljZSBhZGFwdGVyIGNyZWF0b3IgZm9yIEBqdWJiaW8vdm9pY2VcclxuICAgKi9cclxuICBnZXQgdm9pY2VBZGFwdGVyQ3JlYXRvcigpIHtcclxuICAgIHJldHVybiB0aGlzLmNsaWVudC52b2ljZS5hZGFwdGVycy5nZXQodGhpcy5pZCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBGZXRjaCBhIG1lbWJlciBieSBJRFxyXG4gICAqL1xyXG4gIGFzeW5jIGZldGNoTWVtYmVyKHVzZXJJZDogc3RyaW5nKTogUHJvbWlzZTxHdWlsZE1lbWJlcj4ge1xyXG4gICAgLy8gQ2hlY2sgY2FjaGUgZmlyc3RcclxuICAgIGNvbnN0IGNhY2hlZCA9IHRoaXMubWVtYmVycy5nZXQodXNlcklkKTtcclxuICAgIGlmIChjYWNoZWQpIHJldHVybiBjYWNoZWQ7XHJcbiAgICBcclxuICAgIC8vIEZldGNoIGZyb20gQVBJXHJcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5jbGllbnQucmVzdC5nZXRNZW1iZXIodGhpcy5pZCwgdXNlcklkKTtcclxuICAgIGlmICghZGF0YSkgdGhyb3cgbmV3IEVycm9yKGBNZW1iZXIgJHt1c2VySWR9IG5vdCBmb3VuZCBpbiBndWlsZCAke3RoaXMuaWR9YCk7XHJcbiAgICBjb25zdCBtZW1iZXIgPSB0aGlzLl9hZGRNZW1iZXIoZGF0YSk7XHJcbiAgICByZXR1cm4gbWVtYmVyO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRmV0Y2ggZ3VpbGQgbWVtYmVycyBsaXN0IChwYWdpbmF0ZWQpXHJcbiAgICogQHBhcmFtIG9wdGlvbnMubGltaXQgTWF4IG1lbWJlcnMgdG8gcmV0dXJuIChkZWZhdWx0IDUwKVxyXG4gICAqIEBwYXJhbSBvcHRpb25zLmN1cnNvciBQYWdpbmF0aW9uIGN1cnNvciBmcm9tIHByZXZpb3VzIHJlc3BvbnNlXHJcbiAgICogQHJldHVybnMgT2JqZWN0IHdpdGggbWVtYmVycyBhcnJheSBhbmQgcGFnaW5hdGlvbiBpbmZvXHJcbiAgICovXHJcbiAgYXN5bmMgZmV0Y2hNZW1iZXJzKG9wdGlvbnM/OiB7IGxpbWl0PzogbnVtYmVyOyBjdXJzb3I/OiBzdHJpbmcgfSk6IFByb21pc2U8YW55PiB7XHJcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5jbGllbnQucmVzdC5nZXRNZW1iZXJzKHRoaXMuaWQsIG9wdGlvbnMpO1xyXG5cclxuICAgIC8vIENhY2hlIGZldGNoZWQgbWVtYmVyc1xyXG4gICAgaWYgKGRhdGE/Lm1lbWJlcnMpIHtcclxuICAgICAgZm9yIChjb25zdCBtZW1iZXJEYXRhIG9mIGRhdGEubWVtYmVycykge1xyXG4gICAgICAgIHRoaXMuX2FkZE1lbWJlcihtZW1iZXJEYXRhKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBkYXRhO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ29udmVydCB0byBzdHJpbmdcclxuICAgKi9cclxuICB0b1N0cmluZygpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIHRoaXMubmFtZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFVwZGF0ZSBndWlsZCBkYXRhXHJcbiAgICovXHJcbiAgX3BhdGNoKGRhdGE6IFBhcnRpYWw8QVBJR3VpbGQ+KTogdm9pZCB7XHJcbiAgICBpZiAoZGF0YS5uYW1lICE9PSB1bmRlZmluZWQpIHRoaXMubmFtZSA9IGRhdGEubmFtZTtcclxuICAgIGlmIChkYXRhLmljb24gIT09IHVuZGVmaW5lZCkgdGhpcy5pY29uID0gZGF0YS5pY29uO1xyXG4gICAgaWYgKGRhdGEub3duZXJfaWQgIT09IHVuZGVmaW5lZCkgdGhpcy5vd25lcklkID0gZGF0YS5vd25lcl9pZDtcclxuICAgIGlmIChkYXRhLnVuYXZhaWxhYmxlICE9PSB1bmRlZmluZWQpIHRoaXMudW5hdmFpbGFibGUgPSBkYXRhLnVuYXZhaWxhYmxlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRkIGEgbWVtYmVyIHRvIGNhY2hlXHJcbiAgICovXHJcbiAgX2FkZE1lbWJlcihkYXRhOiBBUElHdWlsZE1lbWJlcik6IEd1aWxkTWVtYmVyIHtcclxuICAgIGNvbnN0IG1lbWJlciA9IG5ldyBHdWlsZE1lbWJlcih0aGlzLmNsaWVudCwgdGhpcywgZGF0YSk7XHJcbiAgICB0aGlzLm1lbWJlcnMuc2V0KG1lbWJlci5pZCwgbWVtYmVyKTtcclxuICAgIHJldHVybiBtZW1iZXI7XHJcbiAgfVxyXG59XHJcbiJdfQ==