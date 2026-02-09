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
        // TODO: Fetch from API
        return null;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiR3VpbGQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvc3RydWN0dXJlcy9HdWlsZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSw2Q0FBMEM7QUFDMUMsK0NBQTRDO0FBRzVDOztHQUVHO0FBQ0gsTUFBYSxLQUFLO0lBQ2hCLDhCQUE4QjtJQUNkLE1BQU0sQ0FBUztJQUUvQixlQUFlO0lBQ0MsRUFBRSxDQUFTO0lBRTNCLGlCQUFpQjtJQUNWLElBQUksQ0FBUztJQUVwQixxQkFBcUI7SUFDZCxJQUFJLENBQVU7SUFFckIsZUFBZTtJQUNSLE9BQU8sQ0FBUztJQUV2Qix1Q0FBdUM7SUFDaEMsV0FBVyxDQUFVO0lBRTVCLHFCQUFxQjtJQUNkLE9BQU8sQ0FBa0M7SUFFaEQsc0JBQXNCO0lBQ2YsUUFBUSxDQUFpQztJQUVoRCxZQUFZLE1BQWMsRUFBRSxJQUFjO1FBQ3hDLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1FBQ3JCLElBQUksQ0FBQyxFQUFFLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQztRQUNsQixJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7UUFDdEIsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO1FBQ3RCLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQztRQUM3QixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxXQUFXLElBQUksS0FBSyxDQUFDO1FBQzdDLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSx1QkFBVSxFQUFFLENBQUM7UUFDaEMsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLHVCQUFVLEVBQUUsQ0FBQztJQUNuQyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxPQUFPLENBQUMsT0FBMkI7UUFDakMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJO1lBQUUsT0FBTyxJQUFJLENBQUM7UUFDNUIsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDO0lBQ25CLENBQUM7SUFFRDs7T0FFRztJQUNILElBQUksbUJBQW1CO1FBQ3JCLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDakQsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLFdBQVcsQ0FBQyxNQUFjO1FBQzlCLG9CQUFvQjtRQUNwQixNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN4QyxJQUFJLE1BQU07WUFBRSxPQUFPLE1BQU0sQ0FBQztRQUUxQix1QkFBdUI7UUFDdkIsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxRQUFRO1FBQ04sT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDO0lBQ25CLENBQUM7SUFFRDs7T0FFRztJQUNILE1BQU0sQ0FBQyxJQUF1QjtRQUM1QixJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssU0FBUztZQUFFLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQztRQUNuRCxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssU0FBUztZQUFFLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQztRQUNuRCxJQUFJLElBQUksQ0FBQyxRQUFRLEtBQUssU0FBUztZQUFFLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQztRQUM5RCxJQUFJLElBQUksQ0FBQyxXQUFXLEtBQUssU0FBUztZQUFFLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQztJQUMxRSxDQUFDO0lBRUQ7O09BRUc7SUFDSCxVQUFVLENBQUMsSUFBb0I7UUFDN0IsTUFBTSxNQUFNLEdBQUcsSUFBSSx5QkFBVyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ3hELElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDcEMsT0FBTyxNQUFNLENBQUM7SUFDaEIsQ0FBQztDQUNGO0FBeEZELHNCQXdGQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFQSUd1aWxkLCBBUElDaGFubmVsLCBBUElHdWlsZE1lbWJlciB9IGZyb20gJy4uL3R5cGVzJztcclxuaW1wb3J0IHsgQ29sbGVjdGlvbiB9IGZyb20gJy4vQ29sbGVjdGlvbic7XHJcbmltcG9ydCB7IEd1aWxkTWVtYmVyIH0gZnJvbSAnLi9HdWlsZE1lbWJlcic7XHJcbmltcG9ydCB0eXBlIHsgQ2xpZW50IH0gZnJvbSAnLi4vQ2xpZW50JztcclxuXHJcbi8qKlxyXG4gKiBSZXByZXNlbnRzIGEgZ3VpbGRcclxuICovXHJcbmV4cG9ydCBjbGFzcyBHdWlsZCB7XHJcbiAgLyoqIFJlZmVyZW5jZSB0byB0aGUgY2xpZW50ICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGNsaWVudDogQ2xpZW50O1xyXG4gIFxyXG4gIC8qKiBHdWlsZCBJRCAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBpZDogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBHdWlsZCBuYW1lICovXHJcbiAgcHVibGljIG5hbWU6IHN0cmluZztcclxuICBcclxuICAvKiogR3VpbGQgaWNvbiBVUkwgKi9cclxuICBwdWJsaWMgaWNvbj86IHN0cmluZztcclxuICBcclxuICAvKiogT3duZXIgSUQgKi9cclxuICBwdWJsaWMgb3duZXJJZDogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBXaGV0aGVyIHRoZSBndWlsZCBpcyB1bmF2YWlsYWJsZSAqL1xyXG4gIHB1YmxpYyB1bmF2YWlsYWJsZTogYm9vbGVhbjtcclxuICBcclxuICAvKiogQ2FjaGVkIG1lbWJlcnMgKi9cclxuICBwdWJsaWMgbWVtYmVyczogQ29sbGVjdGlvbjxzdHJpbmcsIEd1aWxkTWVtYmVyPjtcclxuICBcclxuICAvKiogQ2FjaGVkIGNoYW5uZWxzICovXHJcbiAgcHVibGljIGNoYW5uZWxzOiBDb2xsZWN0aW9uPHN0cmluZywgQVBJQ2hhbm5lbD47XHJcblxyXG4gIGNvbnN0cnVjdG9yKGNsaWVudDogQ2xpZW50LCBkYXRhOiBBUElHdWlsZCkge1xyXG4gICAgdGhpcy5jbGllbnQgPSBjbGllbnQ7XHJcbiAgICB0aGlzLmlkID0gZGF0YS5pZDtcclxuICAgIHRoaXMubmFtZSA9IGRhdGEubmFtZTtcclxuICAgIHRoaXMuaWNvbiA9IGRhdGEuaWNvbjtcclxuICAgIHRoaXMub3duZXJJZCA9IGRhdGEub3duZXJfaWQ7XHJcbiAgICB0aGlzLnVuYXZhaWxhYmxlID0gZGF0YS51bmF2YWlsYWJsZSA/PyBmYWxzZTtcclxuICAgIHRoaXMubWVtYmVycyA9IG5ldyBDb2xsZWN0aW9uKCk7XHJcbiAgICB0aGlzLmNoYW5uZWxzID0gbmV3IENvbGxlY3Rpb24oKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCB0aGUgZ3VpbGQgaWNvbiBVUkxcclxuICAgKi9cclxuICBpY29uVVJMKG9wdGlvbnM/OiB7IHNpemU/OiBudW1iZXIgfSk6IHN0cmluZyB8IG51bGwge1xyXG4gICAgaWYgKCF0aGlzLmljb24pIHJldHVybiBudWxsO1xyXG4gICAgcmV0dXJuIHRoaXMuaWNvbjtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCB0aGUgdm9pY2UgYWRhcHRlciBjcmVhdG9yIGZvciBAanViYmlvL3ZvaWNlXHJcbiAgICovXHJcbiAgZ2V0IHZvaWNlQWRhcHRlckNyZWF0b3IoKSB7XHJcbiAgICByZXR1cm4gdGhpcy5jbGllbnQudm9pY2UuYWRhcHRlcnMuZ2V0KHRoaXMuaWQpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRmV0Y2ggYSBtZW1iZXIgYnkgSURcclxuICAgKi9cclxuICBhc3luYyBmZXRjaE1lbWJlcih1c2VySWQ6IHN0cmluZyk6IFByb21pc2U8R3VpbGRNZW1iZXIgfCBudWxsPiB7XHJcbiAgICAvLyBDaGVjayBjYWNoZSBmaXJzdFxyXG4gICAgY29uc3QgY2FjaGVkID0gdGhpcy5tZW1iZXJzLmdldCh1c2VySWQpO1xyXG4gICAgaWYgKGNhY2hlZCkgcmV0dXJuIGNhY2hlZDtcclxuICAgIFxyXG4gICAgLy8gVE9ETzogRmV0Y2ggZnJvbSBBUElcclxuICAgIHJldHVybiBudWxsO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ29udmVydCB0byBzdHJpbmdcclxuICAgKi9cclxuICB0b1N0cmluZygpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIHRoaXMubmFtZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFVwZGF0ZSBndWlsZCBkYXRhXHJcbiAgICovXHJcbiAgX3BhdGNoKGRhdGE6IFBhcnRpYWw8QVBJR3VpbGQ+KTogdm9pZCB7XHJcbiAgICBpZiAoZGF0YS5uYW1lICE9PSB1bmRlZmluZWQpIHRoaXMubmFtZSA9IGRhdGEubmFtZTtcclxuICAgIGlmIChkYXRhLmljb24gIT09IHVuZGVmaW5lZCkgdGhpcy5pY29uID0gZGF0YS5pY29uO1xyXG4gICAgaWYgKGRhdGEub3duZXJfaWQgIT09IHVuZGVmaW5lZCkgdGhpcy5vd25lcklkID0gZGF0YS5vd25lcl9pZDtcclxuICAgIGlmIChkYXRhLnVuYXZhaWxhYmxlICE9PSB1bmRlZmluZWQpIHRoaXMudW5hdmFpbGFibGUgPSBkYXRhLnVuYXZhaWxhYmxlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRkIGEgbWVtYmVyIHRvIGNhY2hlXHJcbiAgICovXHJcbiAgX2FkZE1lbWJlcihkYXRhOiBBUElHdWlsZE1lbWJlcik6IEd1aWxkTWVtYmVyIHtcclxuICAgIGNvbnN0IG1lbWJlciA9IG5ldyBHdWlsZE1lbWJlcih0aGlzLmNsaWVudCwgdGhpcywgZGF0YSk7XHJcbiAgICB0aGlzLm1lbWJlcnMuc2V0KG1lbWJlci5pZCwgbWVtYmVyKTtcclxuICAgIHJldHVybiBtZW1iZXI7XHJcbiAgfVxyXG59XHJcbiJdfQ==