"use strict";
/**
 * Manager for channels with caching and lazy loading
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelManager = exports.GuildChannelManager = exports.ChannelType = void 0;
const BaseManager_1 = require("./BaseManager");
const Collection_1 = require("../utils/Collection");
/** Channel types */
var ChannelType;
(function (ChannelType) {
    ChannelType[ChannelType["GuildText"] = 0] = "GuildText";
    ChannelType[ChannelType["DM"] = 1] = "DM";
    ChannelType[ChannelType["GuildVoice"] = 2] = "GuildVoice";
    ChannelType[ChannelType["GroupDM"] = 3] = "GroupDM";
    ChannelType[ChannelType["GuildCategory"] = 4] = "GuildCategory";
    ChannelType[ChannelType["GuildAnnouncement"] = 5] = "GuildAnnouncement";
    ChannelType[ChannelType["GuildStageVoice"] = 13] = "GuildStageVoice";
    ChannelType[ChannelType["GuildDirectory"] = 14] = "GuildDirectory";
    ChannelType[ChannelType["GuildForum"] = 15] = "GuildForum";
})(ChannelType || (exports.ChannelType = ChannelType = {}));
/**
 * Manages channels for a guild
 */
class GuildChannelManager extends BaseManager_1.CachedManager {
    /** The guild this manager belongs to */
    guild;
    constructor(guild, iterable) {
        super(guild.client, Object, iterable);
        this.guild = guild;
    }
    /**
     * Add a channel to the cache
     */
    _add(data, cache = true) {
        const id = data.id;
        const existing = this.cache.get(id);
        if (existing) {
            if (cache)
                Object.assign(existing, data);
            return existing;
        }
        const channel = {
            id,
            guildId: this.guild.id,
            name: data.name,
            type: data.type,
            position: data.position ?? 0,
            parentId: data.parent_id ?? null,
            permissionOverwrites: data.permission_overwrites ?? [],
            topic: data.topic ?? null,
            nsfw: data.nsfw ?? false,
            rateLimitPerUser: data.rate_limit_per_user ?? 0,
            bitrate: data.bitrate,
            userLimit: data.user_limit,
            get isText() { return [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(this.type); },
            get isVoice() { return [ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(this.type); },
            get isCategory() { return this.type === ChannelType.GuildCategory; },
            toString() { return `<#${this.id}>`; },
            async send(content) {
                return this.guild.client.rest.request('POST', `/channels/${this.id}/messages`, typeof content === 'string' ? { content } : content);
            },
            async delete(reason) {
                return this.guild.client.rest.request('DELETE', `/channels/${this.id}`, reason ? { reason } : undefined);
            },
            async edit(data) {
                return this.guild.client.rest.request('PATCH', `/channels/${this.id}`, data);
            },
        };
        if (cache)
            this.cache.set(id, channel);
        return channel;
    }
    /**
     * Fetch a channel from the API
     */
    async fetch(id, options) {
        if (!options?.force) {
            const existing = this.cache.get(id);
            if (existing)
                return existing;
        }
        const data = await this.client.rest.request('GET', `/channels/${id}`);
        return this._add(data, options?.cache ?? true);
    }
    /**
     * Fetch all channels for the guild
     */
    async fetchAll() {
        const data = await this.client.rest.request('GET', `/guilds/${this.guild.id}/channels`);
        const channels = new Collection_1.Collection();
        for (const channelData of data) {
            const channel = this._add(channelData);
            channels.set(channel.id, channel);
        }
        return channels;
    }
    /**
     * Create a new channel
     */
    async create(options) {
        const body = {
            name: options.name,
            type: options.type ?? ChannelType.GuildText,
        };
        if (options.topic)
            body.topic = options.topic;
        if (options.bitrate)
            body.bitrate = options.bitrate;
        if (options.userLimit)
            body.user_limit = options.userLimit;
        if (options.rateLimitPerUser)
            body.rate_limit_per_user = options.rateLimitPerUser;
        if (options.position !== undefined)
            body.position = options.position;
        if (options.permissionOverwrites)
            body.permission_overwrites = options.permissionOverwrites;
        if (options.parent)
            body.parent_id = options.parent;
        if (options.nsfw !== undefined)
            body.nsfw = options.nsfw;
        const data = await this.client.rest.request('POST', `/guilds/${this.guild.id}/channels`, body);
        return this._add(data);
    }
    /**
     * Delete a channel
     */
    async delete(id, reason) {
        await this.client.rest.request('DELETE', `/channels/${id}`, reason ? { reason } : undefined);
        this.cache.delete(id);
    }
    /**
     * Edit a channel
     */
    async edit(id, data) {
        const body = {};
        if (data.name)
            body.name = data.name;
        if (data.type !== undefined)
            body.type = data.type;
        if (data.position !== undefined)
            body.position = data.position;
        if (data.topic !== undefined)
            body.topic = data.topic;
        if (data.nsfw !== undefined)
            body.nsfw = data.nsfw;
        if (data.rateLimitPerUser !== undefined)
            body.rate_limit_per_user = data.rateLimitPerUser;
        if (data.bitrate !== undefined)
            body.bitrate = data.bitrate;
        if (data.userLimit !== undefined)
            body.user_limit = data.userLimit;
        if (data.permissionOverwrites)
            body.permission_overwrites = data.permissionOverwrites;
        if (data.parent !== undefined)
            body.parent_id = data.parent;
        const result = await this.client.rest.request('PATCH', `/channels/${id}`, body);
        return this._add(result);
    }
    /**
     * Set channel positions
     */
    async setPositions(positions) {
        const body = positions.map(p => ({
            id: p.channel,
            position: p.position,
            parent_id: p.parent,
        }));
        await this.client.rest.request('PATCH', `/guilds/${this.guild.id}/channels`, body);
    }
}
exports.GuildChannelManager = GuildChannelManager;
/**
 * Global channel manager for the client
 */
class ChannelManager extends BaseManager_1.CachedManager {
    constructor(client, iterable) {
        super(client, Object, iterable);
    }
    _add(data, cache = true) {
        const id = data.id;
        const existing = this.cache.get(id);
        if (existing) {
            if (cache)
                Object.assign(existing, data);
            return existing;
        }
        const channel = { ...data, id };
        if (cache)
            this.cache.set(id, channel);
        return channel;
    }
    async fetch(id, options) {
        if (!options?.force) {
            const existing = this.cache.get(id);
            if (existing)
                return existing;
        }
        const data = await this.client.rest.request('GET', `/channels/${id}`);
        return this._add(data, options?.cache ?? true);
    }
}
exports.ChannelManager = ChannelManager;
exports.default = GuildChannelManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ2hhbm5lbE1hbmFnZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvbWFuYWdlcnMvQ2hhbm5lbE1hbmFnZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOztHQUVHOzs7QUFFSCwrQ0FBOEM7QUFDOUMsb0RBQWlEO0FBRWpELG9CQUFvQjtBQUNwQixJQUFZLFdBVVg7QUFWRCxXQUFZLFdBQVc7SUFDckIsdURBQWEsQ0FBQTtJQUNiLHlDQUFNLENBQUE7SUFDTix5REFBYyxDQUFBO0lBQ2QsbURBQVcsQ0FBQTtJQUNYLCtEQUFpQixDQUFBO0lBQ2pCLHVFQUFxQixDQUFBO0lBQ3JCLG9FQUFvQixDQUFBO0lBQ3BCLGtFQUFtQixDQUFBO0lBQ25CLDBEQUFlLENBQUE7QUFDakIsQ0FBQyxFQVZXLFdBQVcsMkJBQVgsV0FBVyxRQVV0QjtBQUVEOztHQUVHO0FBQ0gsTUFBYSxtQkFBb0IsU0FBUSwyQkFBMEI7SUFDakUsd0NBQXdDO0lBQ3hCLEtBQUssQ0FBTTtJQUUzQixZQUFZLEtBQVUsRUFBRSxRQUF3QjtRQUM5QyxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxNQUFhLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDN0MsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7SUFDckIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsSUFBSSxDQUFDLElBQVMsRUFBRSxLQUFLLEdBQUcsSUFBSTtRQUMxQixNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDO1FBQ25CLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBRXBDLElBQUksUUFBUSxFQUFFLENBQUM7WUFDYixJQUFJLEtBQUs7Z0JBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDekMsT0FBTyxRQUFRLENBQUM7UUFDbEIsQ0FBQztRQUVELE1BQU0s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QUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ3ZDLE9BQU8sT0FBTyxDQUFDO0lBQ2pCLENBQUM7SUFFRCxLQUFLLENBQUMsS0FBSyxDQUFDLEVBQVUsRUFBRSxPQUE4QztRQUNwRSxJQUFJLENBQUMsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDO1lBQ3BCLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQ3BDLElBQUksUUFBUTtnQkFBRSxPQUFPLFFBQVEsQ0FBQztRQUNoQyxDQUFDO1FBQ0QsTUFBTSxJQUFJLEdBQUcsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLGFBQWEsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUN0RSxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLE9BQU8sRUFBRSxLQUFLLElBQUksSUFBSSxDQUFDLENBQUM7SUFDakQsQ0FBQztDQUNGO0FBMUJELHdDQTBCQztBQUVELGtCQUFlLG1CQUFtQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBNYW5hZ2VyIGZvciBjaGFubmVscyB3aXRoIGNhY2hpbmcgYW5kIGxhenkgbG9hZGluZ1xuICovXG5cbmltcG9ydCB7IENhY2hlZE1hbmFnZXIgfSBmcm9tICcuL0Jhc2VNYW5hZ2VyJztcbmltcG9ydCB7IENvbGxlY3Rpb24gfSBmcm9tICcuLi91dGlscy9Db2xsZWN0aW9uJztcblxuLyoqIENoYW5uZWwgdHlwZXMgKi9cbmV4cG9ydCBlbnVtIENoYW5uZWxUeXBlIHtcbiAgR3VpbGRUZXh0ID0gMCxcbiAgRE0gPSAxLFxuICBHdWlsZFZvaWNlID0gMixcbiAgR3JvdXBETSA9IDMsXG4gIEd1aWxkQ2F0ZWdvcnkgPSA0LFxuICBHdWlsZEFubm91bmNlbWVudCA9IDUsXG4gIEd1aWxkU3RhZ2VWb2ljZSA9IDEzLFxuICBHdWlsZERpcmVjdG9yeSA9IDE0LFxuICBHdWlsZEZvcnVtID0gMTUsXG59XG5cbi8qKlxuICogTWFuYWdlcyBjaGFubmVscyBmb3IgYSBndWlsZFxuICovXG5leHBvcnQgY2xhc3MgR3VpbGRDaGFubmVsTWFuYWdlciBleHRlbmRzIENhY2hlZE1hbmFnZXI8c3RyaW5nLCBhbnk+IHtcbiAgLyoqIFRoZSBndWlsZCB0aGlzIG1hbmFnZXIgYmVsb25ncyB0byAqL1xuICBwdWJsaWMgcmVhZG9ubHkgZ3VpbGQ6IGFueTtcblxuICBjb25zdHJ1Y3RvcihndWlsZDogYW55LCBpdGVyYWJsZT86IEl0ZXJhYmxlPGFueT4pIHtcbiAgICBzdXBlcihndWlsZC5jbGllbnQsIE9iamVjdCBhcyBhbnksIGl0ZXJhYmxlKTtcbiAgICB0aGlzLmd1aWxkID0gZ3VpbGQ7XG4gIH1cblxuICAvKipcbiAgICogQWRkIGEgY2hhbm5lbCB0byB0aGUgY2FjaGVcbiAgICovXG4gIF9hZGQoZGF0YTogYW55LCBjYWNoZSA9IHRydWUpOiBhbnkge1xuICAgIGNvbnN0IGlkID0gZGF0YS5pZDtcbiAgICBjb25zdCBleGlzdGluZyA9IHRoaXMuY2FjaGUuZ2V0KGlkKTtcbiAgICBcbiAgICBpZiAoZXhpc3RpbmcpIHtcbiAgICAgIGlmIChjYWNoZSkgT2JqZWN0LmFzc2lnbihleGlzdGluZywgZGF0YSk7XG4gICAgICByZXR1cm4gZXhpc3Rpbmc7XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IGNoYW5uZWwgPSB7XG4gICAgICBpZCxcbiAgICAgIGd1aWxkSWQ6IHRoaXMuZ3VpbGQuaWQsXG4gICAgICBuYW1lOiBkYXRhLm5hbWUsXG4gICAgICB0eXBlOiBkYXRhLnR5cGUsXG4gICAgICBwb3NpdGlvbjogZGF0YS5wb3NpdGlvbiA/PyAwLFxuICAgICAgcGFyZW50SWQ6IGRhdGEucGFyZW50X2lkID8/IG51bGwsXG4gICAgICBwZXJtaXNzaW9uT3ZlcndyaXRlczogZGF0YS5wZXJtaXNzaW9uX292ZXJ3cml0ZXMgPz8gW10sXG4gICAgICB0b3BpYzogZGF0YS50b3BpYyA/PyBudWxsLFxuICAgICAgbnNmdzogZGF0YS5uc2Z3ID8/IGZhbHNlLFxuICAgICAgcmF0ZUxpbWl0UGVyVXNlcjogZGF0YS5yYXRlX2xpbWl0X3Blcl91c2VyID8/IDAsXG4gICAgICBiaXRyYXRlOiBkYXRhLmJpdHJhdGUsXG4gICAgICB1c2VyTGltaXQ6IGRhdGEudXNlcl9saW1pdCxcbiAgICAgIFxuICAgICAgZ2V0IGlzVGV4dCgpIHsgcmV0dXJuIFtDaGFubmVsVHlwZS5HdWlsZFRleHQsIENoYW5uZWxUeXBlLkd1aWxkQW5ub3VuY2VtZW50XS5pbmNsdWRlcyh0aGlzLnR5cGUpOyB9LFxuICAgICAgZ2V0IGlzVm9pY2UoKSB7IHJldHVybiBbQ2hhbm5lbFR5cGUuR3VpbGRWb2ljZSwgQ2hhbm5lbFR5cGUuR3VpbGRTdGFnZVZvaWNlXS5pbmNsdWRlcyh0aGlzLnR5cGUpOyB9LFxuICAgICAgZ2V0IGlzQ2F0ZWdvcnkoKSB7IHJldHVybiB0aGlzLnR5cGUgPT09IENoYW5uZWxUeXBlLkd1aWxkQ2F0ZWdvcnk7IH0sXG4gICAgICBcbiAgICAgIHRvU3RyaW5nKCkgeyByZXR1cm4gYDwjJHt0aGlzLmlkfT5gOyB9LFxuICAgICAgXG4gICAgICBhc3luYyBzZW5kKGNvbnRlbnQ6IGFueSkge1xuICAgICAgICByZXR1cm4gdGhpcy5ndWlsZC5jbGllbnQucmVzdC5yZXF1ZXN0KCdQT1NUJywgYC9jaGFubmVscy8ke3RoaXMuaWR9L21lc3NhZ2VzYCwgXG4gICAgICAgICAgdHlwZW9mIGNvbnRlbnQgPT09ICdzdHJpbmcnID8geyBjb250ZW50IH0gOiBjb250ZW50XG4gICAgICAgICk7XG4gICAgICB9LFxuICAgICAgXG4gICAgICBhc3luYyBkZWxldGUocmVhc29uPzogc3RyaW5nKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmd1aWxkLmNsaWVudC5yZXN0LnJlcXVlc3QoJ0RFTEVURScsIGAvY2hhbm5lbHMvJHt0aGlzLmlkfWAsIHJlYXNvbiA/IHsgcmVhc29uIH0gOiB1bmRlZmluZWQpO1xuICAgICAgfSxcbiAgICAgIFxuICAgICAgYXN5bmMgZWRpdChkYXRhOiBhbnkpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ3VpbGQuY2xpZW50LnJlc3QucmVxdWVzdCgnUEFUQ0gnLCBgL2NoYW5uZWxzLyR7dGhpcy5pZH1gLCBkYXRhKTtcbiAgICAgIH0sXG4gICAgfTtcbiAgICBcbiAgICBpZiAoY2FjaGUpIHRoaXMuY2FjaGUuc2V0KGlkLCBjaGFubmVsKTtcbiAgICByZXR1cm4gY2hhbm5lbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBGZXRjaCBhIGNoYW5uZWwgZnJvbSB0aGUgQVBJXG4gICAqL1xuICBhc3luYyBmZXRjaChpZDogc3RyaW5nLCBvcHRpb25zPzogeyBjYWNoZT86IGJvb2xlYW47IGZvcmNlPzogYm9vbGVhbiB9KTogUHJvbWlzZTxhbnk+IHtcbiAgICBpZiAoIW9wdGlvbnM/LmZvcmNlKSB7XG4gICAgICBjb25zdCBleGlzdGluZyA9IHRoaXMuY2FjaGUuZ2V0KGlkKTtcbiAgICAgIGlmIChleGlzdGluZykgcmV0dXJuIGV4aXN0aW5nO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5jbGllbnQucmVzdC5yZXF1ZXN0KCdHRVQnLCBgL2NoYW5uZWxzLyR7aWR9YCk7XG4gICAgcmV0dXJuIHRoaXMuX2FkZChkYXRhLCBvcHRpb25zPy5jYWNoZSA/PyB0cnVlKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGZXRjaCBhbGwgY2hhbm5lbHMgZm9yIHRoZSBndWlsZFxuICAgKi9cbiAgYXN5bmMgZmV0Y2hBbGwoKTogUHJvbWlzZTxDb2xsZWN0aW9uPHN0cmluZywgYW55Pj4ge1xuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LnJlcXVlc3QoJ0dFVCcsIGAvZ3VpbGRzLyR7dGhpcy5ndWlsZC5pZH0vY2hhbm5lbHNgKTtcbiAgICBjb25zdCBjaGFubmVscyA9IG5ldyBDb2xsZWN0aW9uPHN0cmluZywgYW55PigpO1xuICAgIGZvciAoY29uc3QgY2hhbm5lbERhdGEgb2YgZGF0YSkge1xuICAgICAgY29uc3QgY2hhbm5lbCA9IHRoaXMuX2FkZChjaGFubmVsRGF0YSk7XG4gICAgICBjaGFubmVscy5zZXQoY2hhbm5lbC5pZCwgY2hhbm5lbCk7XG4gICAgfVxuICAgIHJldHVybiBjaGFubmVscztcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgY2hhbm5lbFxuICAgKi9cbiAgYXN5bmMgY3JlYXRlKG9wdGlvbnM6IHtcbiAgICBuYW1lOiBzdHJpbmc7XG4gICAgdHlwZT86IENoYW5uZWxUeXBlO1xuICAgIHRvcGljPzogc3RyaW5nO1xuICAgIGJpdHJhdGU/OiBudW1iZXI7XG4gICAgdXNlckxpbWl0PzogbnVtYmVyO1xuICAgIHJhdGVMaW1pdFBlclVzZXI/OiBudW1iZXI7XG4gICAgcG9zaXRpb24/OiBudW1iZXI7XG4gICAgcGVybWlzc2lvbk92ZXJ3cml0ZXM/OiBhbnlbXTtcbiAgICBwYXJlbnQ/OiBzdHJpbmc7XG4gICAgbnNmdz86IGJvb2xlYW47XG4gICAgcmVhc29uPzogc3RyaW5nO1xuICB9KTogUHJvbWlzZTxhbnk+IHtcbiAgICBjb25zdCBib2R5OiBhbnkgPSB7XG4gICAgICBuYW1lOiBvcHRpb25zLm5hbWUsXG4gICAgICB0eXBlOiBvcHRpb25zLnR5cGUgPz8gQ2hhbm5lbFR5cGUuR3VpbGRUZXh0LFxuICAgIH07XG4gICAgaWYgKG9wdGlvbnMudG9waWMpIGJvZHkudG9waWMgPSBvcHRpb25zLnRvcGljO1xuICAgIGlmIChvcHRpb25zLmJpdHJhdGUpIGJvZHkuYml0cmF0ZSA9IG9wdGlvbnMuYml0cmF0ZTtcbiAgICBpZiAob3B0aW9ucy51c2VyTGltaXQpIGJvZHkudXNlcl9saW1pdCA9IG9wdGlvbnMudXNlckxpbWl0O1xuICAgIGlmIChvcHRpb25zLnJhdGVMaW1pdFBlclVzZXIpIGJvZHkucmF0ZV9saW1pdF9wZXJfdXNlciA9IG9wdGlvbnMucmF0ZUxpbWl0UGVyVXNlcjtcbiAgICBpZiAob3B0aW9ucy5wb3NpdGlvbiAhPT0gdW5kZWZpbmVkKSBib2R5LnBvc2l0aW9uID0gb3B0aW9ucy5wb3NpdGlvbjtcbiAgICBpZiAob3B0aW9ucy5wZXJtaXNzaW9uT3ZlcndyaXRlcykgYm9keS5wZXJtaXNzaW9uX292ZXJ3cml0ZXMgPSBvcHRpb25zLnBlcm1pc3Npb25PdmVyd3JpdGVzO1xuICAgIGlmIChvcHRpb25zLnBhcmVudCkgYm9keS5wYXJlbnRfaWQgPSBvcHRpb25zLnBhcmVudDtcbiAgICBpZiAob3B0aW9ucy5uc2Z3ICE9PSB1bmRlZmluZWQpIGJvZHkubnNmdyA9IG9wdGlvbnMubnNmdztcbiAgICBcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5jbGllbnQucmVzdC5yZXF1ZXN0KCdQT1NUJywgYC9ndWlsZHMvJHt0aGlzLmd1aWxkLmlkfS9jaGFubmVsc2AsIGJvZHkpO1xuICAgIHJldHVybiB0aGlzLl9hZGQoZGF0YSk7XG4gIH1cblxuICAvKipcbiAgICogRGVsZXRlIGEgY2hhbm5lbFxuICAgKi9cbiAgYXN5bmMgZGVsZXRlKGlkOiBzdHJpbmcsIHJlYXNvbj86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGF3YWl0IHRoaXMuY2xpZW50LnJlc3QucmVxdWVzdCgnREVMRVRFJywgYC9jaGFubmVscy8ke2lkfWAsIHJlYXNvbiA/IHsgcmVhc29uIH0gOiB1bmRlZmluZWQpO1xuICAgIHRoaXMuY2FjaGUuZGVsZXRlKGlkKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBFZGl0IGEgY2hhbm5lbFxuICAgKi9cbiAgYXN5bmMgZWRpdChpZDogc3RyaW5nLCBkYXRhOiB7XG4gICAgbmFtZT86IHN0cmluZztcbiAgICB0eXBlPzogQ2hhbm5lbFR5cGU7XG4gICAgcG9zaXRpb24/OiBudW1iZXI7XG4gICAgdG9waWM/OiBzdHJpbmc7XG4gICAgbnNmdz86IGJvb2xlYW47XG4gICAgcmF0ZUxpbWl0UGVyVXNlcj86IG51bWJlcjtcbiAgICBiaXRyYXRlPzogbnVtYmVyO1xuICAgIHVzZXJMaW1pdD86IG51bWJlcjtcbiAgICBwZXJtaXNzaW9uT3ZlcndyaXRlcz86IGFueVtdO1xuICAgIHBhcmVudD86IHN0cmluZyB8IG51bGw7XG4gIH0pOiBQcm9taXNlPGFueT4ge1xuICAgIGNvbnN0IGJvZHk6IGFueSA9IHt9O1xuICAgIGlmIChkYXRhLm5hbWUpIGJvZHkubmFtZSA9IGRhdGEubmFtZTtcbiAgICBpZiAoZGF0YS50eXBlICE9PSB1bmRlZmluZWQpIGJvZHkudHlwZSA9IGRhdGEudHlwZTtcbiAgICBpZiAoZGF0YS5wb3NpdGlvbiAhPT0gdW5kZWZpbmVkKSBib2R5LnBvc2l0aW9uID0gZGF0YS5wb3NpdGlvbjtcbiAgICBpZiAoZGF0YS50b3BpYyAhPT0gdW5kZWZpbmVkKSBib2R5LnRvcGljID0gZGF0YS50b3BpYztcbiAgICBpZiAoZGF0YS5uc2Z3ICE9PSB1bmRlZmluZWQpIGJvZHkubnNmdyA9IGRhdGEubnNmdztcbiAgICBpZiAoZGF0YS5yYXRlTGltaXRQZXJVc2VyICE9PSB1bmRlZmluZWQpIGJvZHkucmF0ZV9saW1pdF9wZXJfdXNlciA9IGRhdGEucmF0ZUxpbWl0UGVyVXNlcjtcbiAgICBpZiAoZGF0YS5iaXRyYXRlICE9PSB1bmRlZmluZWQpIGJvZHkuYml0cmF0ZSA9IGRhdGEuYml0cmF0ZTtcbiAgICBpZiAoZGF0YS51c2VyTGltaXQgIT09IHVuZGVmaW5lZCkgYm9keS51c2VyX2xpbWl0ID0gZGF0YS51c2VyTGltaXQ7XG4gICAgaWYgKGRhdGEucGVybWlzc2lvbk92ZXJ3cml0ZXMpIGJvZHkucGVybWlzc2lvbl9vdmVyd3JpdGVzID0gZGF0YS5wZXJtaXNzaW9uT3ZlcndyaXRlcztcbiAgICBpZiAoZGF0YS5wYXJlbnQgIT09IHVuZGVmaW5lZCkgYm9keS5wYXJlbnRfaWQgPSBkYXRhLnBhcmVudDtcbiAgICBcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LnJlcXVlc3QoJ1BBVENIJywgYC9jaGFubmVscy8ke2lkfWAsIGJvZHkpO1xuICAgIHJldHVybiB0aGlzLl9hZGQocmVzdWx0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXQgY2hhbm5lbCBwb3NpdGlvbnNcbiAgICovXG4gIGFzeW5jIHNldFBvc2l0aW9ucyhwb3NpdGlvbnM6IEFycmF5PHsgY2hhbm5lbDogc3RyaW5nOyBwb3NpdGlvbjogbnVtYmVyOyBwYXJlbnQ/OiBzdHJpbmcgfCBudWxsIH0+KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgYm9keSA9IHBvc2l0aW9ucy5tYXAocCA9PiAoe1xuICAgICAgaWQ6IHAuY2hhbm5lbCxcbiAgICAgIHBvc2l0aW9uOiBwLnBvc2l0aW9uLFxuICAgICAgcGFyZW50X2lkOiBwLnBhcmVudCxcbiAgICB9KSk7XG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5yZXF1ZXN0KCdQQVRDSCcsIGAvZ3VpbGRzLyR7dGhpcy5ndWlsZC5pZH0vY2hhbm5lbHNgLCBib2R5KTtcbiAgfVxufVxuXG4vKipcbiAqIEdsb2JhbCBjaGFubmVsIG1hbmFnZXIgZm9yIHRoZSBjbGllbnRcbiAqL1xuZXhwb3J0IGNsYXNzIENoYW5uZWxNYW5hZ2VyIGV4dGVuZHMgQ2FjaGVkTWFuYWdlcjxzdHJpbmcsIGFueT4ge1xuICBjb25zdHJ1Y3RvcihjbGllbnQ6IGFueSwgaXRlcmFibGU/OiBJdGVyYWJsZTxhbnk+KSB7XG4gICAgc3VwZXIoY2xpZW50LCBPYmplY3QgYXMgYW55LCBpdGVyYWJsZSk7XG4gIH1cblxuICBfYWRkKGRhdGE6IGFueSwgY2FjaGUgPSB0cnVlKTogYW55IHtcbiAgICBjb25zdCBpZCA9IGRhdGEuaWQ7XG4gICAgY29uc3QgZXhpc3RpbmcgPSB0aGlzLmNhY2hlLmdldChpZCk7XG4gICAgaWYgKGV4aXN0aW5nKSB7XG4gICAgICBpZiAoY2FjaGUpIE9iamVjdC5hc3NpZ24oZXhpc3RpbmcsIGRhdGEpO1xuICAgICAgcmV0dXJuIGV4aXN0aW5nO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCBjaGFubmVsID0geyAuLi5kYXRhLCBpZCB9O1xuICAgIGlmIChjYWNoZSkgdGhpcy5jYWNoZS5zZXQoaWQsIGNoYW5uZWwpO1xuICAgIHJldHVybiBjaGFubmVsO1xuICB9XG5cbiAgYXN5bmMgZmV0Y2goaWQ6IHN0cmluZywgb3B0aW9ucz86IHsgY2FjaGU/OiBib29sZWFuOyBmb3JjZT86IGJvb2xlYW4gfSk6IFByb21pc2U8YW55PiB7XG4gICAgaWYgKCFvcHRpb25zPy5mb3JjZSkge1xuICAgICAgY29uc3QgZXhpc3RpbmcgPSB0aGlzLmNhY2hlLmdldChpZCk7XG4gICAgICBpZiAoZXhpc3RpbmcpIHJldHVybiBleGlzdGluZztcbiAgICB9XG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHRoaXMuY2xpZW50LnJlc3QucmVxdWVzdCgnR0VUJywgYC9jaGFubmVscy8ke2lkfWApO1xuICAgIHJldHVybiB0aGlzLl9hZGQoZGF0YSwgb3B0aW9ucz8uY2FjaGUgPz8gdHJ1ZSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgR3VpbGRDaGFubmVsTWFuYWdlcjtcbiJdfQ==