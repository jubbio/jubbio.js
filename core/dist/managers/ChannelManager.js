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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ2hhbm5lbE1hbmFnZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvbWFuYWdlcnMvQ2hhbm5lbE1hbmFnZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOztHQUVHOzs7QUFFSCwrQ0FBOEM7QUFDOUMsb0RBQWlEO0FBRWpELG9CQUFvQjtBQUNwQixJQUFZLFdBVVg7QUFWRCxXQUFZLFdBQVc7SUFDckIsdURBQWEsQ0FBQTtJQUNiLHlDQUFNLENBQUE7SUFDTix5REFBYyxDQUFBO0lBQ2QsbURBQVcsQ0FBQTtJQUNYLCtEQUFpQixDQUFBO0lBQ2pCLHVFQUFxQixDQUFBO0lBQ3JCLG9FQUFvQixDQUFBO0lBQ3BCLGtFQUFtQixDQUFBO0lBQ25CLDBEQUFlLENBQUE7QUFDakIsQ0FBQyxFQVZXLFdBQVcsMkJBQVgsV0FBVyxRQVV0QjtBQUVEOztHQUVHO0FBQ0gsTUFBYSxtQkFBb0IsU0FBUSwyQkFBMEI7SUFDakUsd0NBQXdDO0lBQ3hCLEtBQUssQ0FBTTtJQUUzQixZQUFZLEtBQVUsRUFBRSxRQUF3QjtRQUM5QyxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxNQUFhLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDN0MsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7SUFDckIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsSUFBSSxDQUFDLElBQVMsRUFBRSxLQUFLLEdBQUcsSUFBSTtRQUMxQixNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDO1FBQ25CLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBRXBDLElBQUksUUFBUSxFQUFFLENBQUM7WUFDYixJQUFJLEtBQUs7Z0JBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDekMsT0FBTyxRQUFRLENBQUM7UUFDbEIsQ0FBQztRQUVELE1BQU0s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QUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ3ZDLE9BQU8sT0FBTyxDQUFDO0lBQ2pCLENBQUM7SUFFRCxLQUFLLENBQUMsS0FBSyxDQUFDLEVBQVUsRUFBRSxPQUE4QztRQUNwRSxJQUFJLENBQUMsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDO1lBQ3BCLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQ3BDLElBQUksUUFBUTtnQkFBRSxPQUFPLFFBQVEsQ0FBQztRQUNoQyxDQUFDO1FBQ0QsTUFBTSxJQUFJLEdBQUcsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLGFBQWEsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUN0RSxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLE9BQU8sRUFBRSxLQUFLLElBQUksSUFBSSxDQUFDLENBQUM7SUFDakQsQ0FBQztDQUNGO0FBMUJELHdDQTBCQztBQUVELGtCQUFlLG1CQUFtQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIE1hbmFnZXIgZm9yIGNoYW5uZWxzIHdpdGggY2FjaGluZyBhbmQgbGF6eSBsb2FkaW5nXHJcbiAqL1xyXG5cclxuaW1wb3J0IHsgQ2FjaGVkTWFuYWdlciB9IGZyb20gJy4vQmFzZU1hbmFnZXInO1xyXG5pbXBvcnQgeyBDb2xsZWN0aW9uIH0gZnJvbSAnLi4vdXRpbHMvQ29sbGVjdGlvbic7XHJcblxyXG4vKiogQ2hhbm5lbCB0eXBlcyAqL1xyXG5leHBvcnQgZW51bSBDaGFubmVsVHlwZSB7XHJcbiAgR3VpbGRUZXh0ID0gMCxcclxuICBETSA9IDEsXHJcbiAgR3VpbGRWb2ljZSA9IDIsXHJcbiAgR3JvdXBETSA9IDMsXHJcbiAgR3VpbGRDYXRlZ29yeSA9IDQsXHJcbiAgR3VpbGRBbm5vdW5jZW1lbnQgPSA1LFxyXG4gIEd1aWxkU3RhZ2VWb2ljZSA9IDEzLFxyXG4gIEd1aWxkRGlyZWN0b3J5ID0gMTQsXHJcbiAgR3VpbGRGb3J1bSA9IDE1LFxyXG59XHJcblxyXG4vKipcclxuICogTWFuYWdlcyBjaGFubmVscyBmb3IgYSBndWlsZFxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIEd1aWxkQ2hhbm5lbE1hbmFnZXIgZXh0ZW5kcyBDYWNoZWRNYW5hZ2VyPHN0cmluZywgYW55PiB7XHJcbiAgLyoqIFRoZSBndWlsZCB0aGlzIG1hbmFnZXIgYmVsb25ncyB0byAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBndWlsZDogYW55O1xyXG5cclxuICBjb25zdHJ1Y3RvcihndWlsZDogYW55LCBpdGVyYWJsZT86IEl0ZXJhYmxlPGFueT4pIHtcclxuICAgIHN1cGVyKGd1aWxkLmNsaWVudCwgT2JqZWN0IGFzIGFueSwgaXRlcmFibGUpO1xyXG4gICAgdGhpcy5ndWlsZCA9IGd1aWxkO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRkIGEgY2hhbm5lbCB0byB0aGUgY2FjaGVcclxuICAgKi9cclxuICBfYWRkKGRhdGE6IGFueSwgY2FjaGUgPSB0cnVlKTogYW55IHtcclxuICAgIGNvbnN0IGlkID0gZGF0YS5pZDtcclxuICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5jYWNoZS5nZXQoaWQpO1xyXG4gICAgXHJcbiAgICBpZiAoZXhpc3RpbmcpIHtcclxuICAgICAgaWYgKGNhY2hlKSBPYmplY3QuYXNzaWduKGV4aXN0aW5nLCBkYXRhKTtcclxuICAgICAgcmV0dXJuIGV4aXN0aW5nO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBjb25zdCBjaGFubmVsID0ge1xyXG4gICAgICBpZCxcclxuICAgICAgZ3VpbGRJZDogdGhpcy5ndWlsZC5pZCxcclxuICAgICAgbmFtZTogZGF0YS5uYW1lLFxyXG4gICAgICB0eXBlOiBkYXRhLnR5cGUsXHJcbiAgICAgIHBvc2l0aW9uOiBkYXRhLnBvc2l0aW9uID8/IDAsXHJcbiAgICAgIHBhcmVudElkOiBkYXRhLnBhcmVudF9pZCA/PyBudWxsLFxyXG4gICAgICBwZXJtaXNzaW9uT3ZlcndyaXRlczogZGF0YS5wZXJtaXNzaW9uX292ZXJ3cml0ZXMgPz8gW10sXHJcbiAgICAgIHRvcGljOiBkYXRhLnRvcGljID8/IG51bGwsXHJcbiAgICAgIG5zZnc6IGRhdGEubnNmdyA/PyBmYWxzZSxcclxuICAgICAgcmF0ZUxpbWl0UGVyVXNlcjogZGF0YS5yYXRlX2xpbWl0X3Blcl91c2VyID8/IDAsXHJcbiAgICAgIGJpdHJhdGU6IGRhdGEuYml0cmF0ZSxcclxuICAgICAgdXNlckxpbWl0OiBkYXRhLnVzZXJfbGltaXQsXHJcbiAgICAgIFxyXG4gICAgICBnZXQgaXNUZXh0KCkgeyByZXR1cm4gW0NoYW5uZWxUeXBlLkd1aWxkVGV4dCwgQ2hhbm5lbFR5cGUuR3VpbGRBbm5vdW5jZW1lbnRdLmluY2x1ZGVzKHRoaXMudHlwZSk7IH0sXHJcbiAgICAgIGdldCBpc1ZvaWNlKCkgeyByZXR1cm4gW0NoYW5uZWxUeXBlLkd1aWxkVm9pY2UsIENoYW5uZWxUeXBlLkd1aWxkU3RhZ2VWb2ljZV0uaW5jbHVkZXModGhpcy50eXBlKTsgfSxcclxuICAgICAgZ2V0IGlzQ2F0ZWdvcnkoKSB7IHJldHVybiB0aGlzLnR5cGUgPT09IENoYW5uZWxUeXBlLkd1aWxkQ2F0ZWdvcnk7IH0sXHJcbiAgICAgIFxyXG4gICAgICB0b1N0cmluZygpIHsgcmV0dXJuIGA8IyR7dGhpcy5pZH0+YDsgfSxcclxuICAgICAgXHJcbiAgICAgIGFzeW5jIHNlbmQoY29udGVudDogYW55KSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuZ3VpbGQuY2xpZW50LnJlc3QucmVxdWVzdCgnUE9TVCcsIGAvY2hhbm5lbHMvJHt0aGlzLmlkfS9tZXNzYWdlc2AsIFxyXG4gICAgICAgICAgdHlwZW9mIGNvbnRlbnQgPT09ICdzdHJpbmcnID8geyBjb250ZW50IH0gOiBjb250ZW50XHJcbiAgICAgICAgKTtcclxuICAgICAgfSxcclxuICAgICAgXHJcbiAgICAgIGFzeW5jIGRlbGV0ZShyZWFzb24/OiBzdHJpbmcpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5ndWlsZC5jbGllbnQucmVzdC5yZXF1ZXN0KCdERUxFVEUnLCBgL2NoYW5uZWxzLyR7dGhpcy5pZH1gLCByZWFzb24gPyB7IHJlYXNvbiB9IDogdW5kZWZpbmVkKTtcclxuICAgICAgfSxcclxuICAgICAgXHJcbiAgICAgIGFzeW5jIGVkaXQoZGF0YTogYW55KSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuZ3VpbGQuY2xpZW50LnJlc3QucmVxdWVzdCgnUEFUQ0gnLCBgL2NoYW5uZWxzLyR7dGhpcy5pZH1gLCBkYXRhKTtcclxuICAgICAgfSxcclxuICAgIH07XHJcbiAgICBcclxuICAgIGlmIChjYWNoZSkgdGhpcy5jYWNoZS5zZXQoaWQsIGNoYW5uZWwpO1xyXG4gICAgcmV0dXJuIGNoYW5uZWw7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBGZXRjaCBhIGNoYW5uZWwgZnJvbSB0aGUgQVBJXHJcbiAgICovXHJcbiAgYXN5bmMgZmV0Y2goaWQ6IHN0cmluZywgb3B0aW9ucz86IHsgY2FjaGU/OiBib29sZWFuOyBmb3JjZT86IGJvb2xlYW4gfSk6IFByb21pc2U8YW55PiB7XHJcbiAgICBpZiAoIW9wdGlvbnM/LmZvcmNlKSB7XHJcbiAgICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5jYWNoZS5nZXQoaWQpO1xyXG4gICAgICBpZiAoZXhpc3RpbmcpIHJldHVybiBleGlzdGluZztcclxuICAgIH1cclxuICAgIFxyXG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHRoaXMuY2xpZW50LnJlc3QucmVxdWVzdCgnR0VUJywgYC9jaGFubmVscy8ke2lkfWApO1xyXG4gICAgcmV0dXJuIHRoaXMuX2FkZChkYXRhLCBvcHRpb25zPy5jYWNoZSA/PyB0cnVlKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEZldGNoIGFsbCBjaGFubmVscyBmb3IgdGhlIGd1aWxkXHJcbiAgICovXHJcbiAgYXN5bmMgZmV0Y2hBbGwoKTogUHJvbWlzZTxDb2xsZWN0aW9uPHN0cmluZywgYW55Pj4ge1xyXG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IHRoaXMuY2xpZW50LnJlc3QucmVxdWVzdCgnR0VUJywgYC9ndWlsZHMvJHt0aGlzLmd1aWxkLmlkfS9jaGFubmVsc2ApO1xyXG4gICAgY29uc3QgY2hhbm5lbHMgPSBuZXcgQ29sbGVjdGlvbjxzdHJpbmcsIGFueT4oKTtcclxuICAgIGZvciAoY29uc3QgY2hhbm5lbERhdGEgb2YgZGF0YSkge1xyXG4gICAgICBjb25zdCBjaGFubmVsID0gdGhpcy5fYWRkKGNoYW5uZWxEYXRhKTtcclxuICAgICAgY2hhbm5lbHMuc2V0KGNoYW5uZWwuaWQsIGNoYW5uZWwpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGNoYW5uZWxzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgbmV3IGNoYW5uZWxcclxuICAgKi9cclxuICBhc3luYyBjcmVhdGUob3B0aW9uczoge1xyXG4gICAgbmFtZTogc3RyaW5nO1xyXG4gICAgdHlwZT86IENoYW5uZWxUeXBlO1xyXG4gICAgdG9waWM/OiBzdHJpbmc7XHJcbiAgICBiaXRyYXRlPzogbnVtYmVyO1xyXG4gICAgdXNlckxpbWl0PzogbnVtYmVyO1xyXG4gICAgcmF0ZUxpbWl0UGVyVXNlcj86IG51bWJlcjtcclxuICAgIHBvc2l0aW9uPzogbnVtYmVyO1xyXG4gICAgcGVybWlzc2lvbk92ZXJ3cml0ZXM/OiBhbnlbXTtcclxuICAgIHBhcmVudD86IHN0cmluZztcclxuICAgIG5zZnc/OiBib29sZWFuO1xyXG4gICAgcmVhc29uPzogc3RyaW5nO1xyXG4gIH0pOiBQcm9taXNlPGFueT4ge1xyXG4gICAgY29uc3QgYm9keTogYW55ID0ge1xyXG4gICAgICBuYW1lOiBvcHRpb25zLm5hbWUsXHJcbiAgICAgIHR5cGU6IG9wdGlvbnMudHlwZSA/PyBDaGFubmVsVHlwZS5HdWlsZFRleHQsXHJcbiAgICB9O1xyXG4gICAgaWYgKG9wdGlvbnMudG9waWMpIGJvZHkudG9waWMgPSBvcHRpb25zLnRvcGljO1xyXG4gICAgaWYgKG9wdGlvbnMuYml0cmF0ZSkgYm9keS5iaXRyYXRlID0gb3B0aW9ucy5iaXRyYXRlO1xyXG4gICAgaWYgKG9wdGlvbnMudXNlckxpbWl0KSBib2R5LnVzZXJfbGltaXQgPSBvcHRpb25zLnVzZXJMaW1pdDtcclxuICAgIGlmIChvcHRpb25zLnJhdGVMaW1pdFBlclVzZXIpIGJvZHkucmF0ZV9saW1pdF9wZXJfdXNlciA9IG9wdGlvbnMucmF0ZUxpbWl0UGVyVXNlcjtcclxuICAgIGlmIChvcHRpb25zLnBvc2l0aW9uICE9PSB1bmRlZmluZWQpIGJvZHkucG9zaXRpb24gPSBvcHRpb25zLnBvc2l0aW9uO1xyXG4gICAgaWYgKG9wdGlvbnMucGVybWlzc2lvbk92ZXJ3cml0ZXMpIGJvZHkucGVybWlzc2lvbl9vdmVyd3JpdGVzID0gb3B0aW9ucy5wZXJtaXNzaW9uT3ZlcndyaXRlcztcclxuICAgIGlmIChvcHRpb25zLnBhcmVudCkgYm9keS5wYXJlbnRfaWQgPSBvcHRpb25zLnBhcmVudDtcclxuICAgIGlmIChvcHRpb25zLm5zZncgIT09IHVuZGVmaW5lZCkgYm9keS5uc2Z3ID0gb3B0aW9ucy5uc2Z3O1xyXG4gICAgXHJcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5jbGllbnQucmVzdC5yZXF1ZXN0KCdQT1NUJywgYC9ndWlsZHMvJHt0aGlzLmd1aWxkLmlkfS9jaGFubmVsc2AsIGJvZHkpO1xyXG4gICAgcmV0dXJuIHRoaXMuX2FkZChkYXRhKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlbGV0ZSBhIGNoYW5uZWxcclxuICAgKi9cclxuICBhc3luYyBkZWxldGUoaWQ6IHN0cmluZywgcmVhc29uPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LnJlcXVlc3QoJ0RFTEVURScsIGAvY2hhbm5lbHMvJHtpZH1gLCByZWFzb24gPyB7IHJlYXNvbiB9IDogdW5kZWZpbmVkKTtcclxuICAgIHRoaXMuY2FjaGUuZGVsZXRlKGlkKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEVkaXQgYSBjaGFubmVsXHJcbiAgICovXHJcbiAgYXN5bmMgZWRpdChpZDogc3RyaW5nLCBkYXRhOiB7XHJcbiAgICBuYW1lPzogc3RyaW5nO1xyXG4gICAgdHlwZT86IENoYW5uZWxUeXBlO1xyXG4gICAgcG9zaXRpb24/OiBudW1iZXI7XHJcbiAgICB0b3BpYz86IHN0cmluZztcclxuICAgIG5zZnc/OiBib29sZWFuO1xyXG4gICAgcmF0ZUxpbWl0UGVyVXNlcj86IG51bWJlcjtcclxuICAgIGJpdHJhdGU/OiBudW1iZXI7XHJcbiAgICB1c2VyTGltaXQ/OiBudW1iZXI7XHJcbiAgICBwZXJtaXNzaW9uT3ZlcndyaXRlcz86IGFueVtdO1xyXG4gICAgcGFyZW50Pzogc3RyaW5nIHwgbnVsbDtcclxuICB9KTogUHJvbWlzZTxhbnk+IHtcclxuICAgIGNvbnN0IGJvZHk6IGFueSA9IHt9O1xyXG4gICAgaWYgKGRhdGEubmFtZSkgYm9keS5uYW1lID0gZGF0YS5uYW1lO1xyXG4gICAgaWYgKGRhdGEudHlwZSAhPT0gdW5kZWZpbmVkKSBib2R5LnR5cGUgPSBkYXRhLnR5cGU7XHJcbiAgICBpZiAoZGF0YS5wb3NpdGlvbiAhPT0gdW5kZWZpbmVkKSBib2R5LnBvc2l0aW9uID0gZGF0YS5wb3NpdGlvbjtcclxuICAgIGlmIChkYXRhLnRvcGljICE9PSB1bmRlZmluZWQpIGJvZHkudG9waWMgPSBkYXRhLnRvcGljO1xyXG4gICAgaWYgKGRhdGEubnNmdyAhPT0gdW5kZWZpbmVkKSBib2R5Lm5zZncgPSBkYXRhLm5zZnc7XHJcbiAgICBpZiAoZGF0YS5yYXRlTGltaXRQZXJVc2VyICE9PSB1bmRlZmluZWQpIGJvZHkucmF0ZV9saW1pdF9wZXJfdXNlciA9IGRhdGEucmF0ZUxpbWl0UGVyVXNlcjtcclxuICAgIGlmIChkYXRhLmJpdHJhdGUgIT09IHVuZGVmaW5lZCkgYm9keS5iaXRyYXRlID0gZGF0YS5iaXRyYXRlO1xyXG4gICAgaWYgKGRhdGEudXNlckxpbWl0ICE9PSB1bmRlZmluZWQpIGJvZHkudXNlcl9saW1pdCA9IGRhdGEudXNlckxpbWl0O1xyXG4gICAgaWYgKGRhdGEucGVybWlzc2lvbk92ZXJ3cml0ZXMpIGJvZHkucGVybWlzc2lvbl9vdmVyd3JpdGVzID0gZGF0YS5wZXJtaXNzaW9uT3ZlcndyaXRlcztcclxuICAgIGlmIChkYXRhLnBhcmVudCAhPT0gdW5kZWZpbmVkKSBib2R5LnBhcmVudF9pZCA9IGRhdGEucGFyZW50O1xyXG4gICAgXHJcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LnJlcXVlc3QoJ1BBVENIJywgYC9jaGFubmVscy8ke2lkfWAsIGJvZHkpO1xyXG4gICAgcmV0dXJuIHRoaXMuX2FkZChyZXN1bHQpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2V0IGNoYW5uZWwgcG9zaXRpb25zXHJcbiAgICovXHJcbiAgYXN5bmMgc2V0UG9zaXRpb25zKHBvc2l0aW9uczogQXJyYXk8eyBjaGFubmVsOiBzdHJpbmc7IHBvc2l0aW9uOiBudW1iZXI7IHBhcmVudD86IHN0cmluZyB8IG51bGwgfT4pOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IGJvZHkgPSBwb3NpdGlvbnMubWFwKHAgPT4gKHtcclxuICAgICAgaWQ6IHAuY2hhbm5lbCxcclxuICAgICAgcG9zaXRpb246IHAucG9zaXRpb24sXHJcbiAgICAgIHBhcmVudF9pZDogcC5wYXJlbnQsXHJcbiAgICB9KSk7XHJcbiAgICBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LnJlcXVlc3QoJ1BBVENIJywgYC9ndWlsZHMvJHt0aGlzLmd1aWxkLmlkfS9jaGFubmVsc2AsIGJvZHkpO1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIEdsb2JhbCBjaGFubmVsIG1hbmFnZXIgZm9yIHRoZSBjbGllbnRcclxuICovXHJcbmV4cG9ydCBjbGFzcyBDaGFubmVsTWFuYWdlciBleHRlbmRzIENhY2hlZE1hbmFnZXI8c3RyaW5nLCBhbnk+IHtcclxuICBjb25zdHJ1Y3RvcihjbGllbnQ6IGFueSwgaXRlcmFibGU/OiBJdGVyYWJsZTxhbnk+KSB7XHJcbiAgICBzdXBlcihjbGllbnQsIE9iamVjdCBhcyBhbnksIGl0ZXJhYmxlKTtcclxuICB9XHJcblxyXG4gIF9hZGQoZGF0YTogYW55LCBjYWNoZSA9IHRydWUpOiBhbnkge1xyXG4gICAgY29uc3QgaWQgPSBkYXRhLmlkO1xyXG4gICAgY29uc3QgZXhpc3RpbmcgPSB0aGlzLmNhY2hlLmdldChpZCk7XHJcbiAgICBpZiAoZXhpc3RpbmcpIHtcclxuICAgICAgaWYgKGNhY2hlKSBPYmplY3QuYXNzaWduKGV4aXN0aW5nLCBkYXRhKTtcclxuICAgICAgcmV0dXJuIGV4aXN0aW5nO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBjb25zdCBjaGFubmVsID0geyAuLi5kYXRhLCBpZCB9O1xyXG4gICAgaWYgKGNhY2hlKSB0aGlzLmNhY2hlLnNldChpZCwgY2hhbm5lbCk7XHJcbiAgICByZXR1cm4gY2hhbm5lbDtcclxuICB9XHJcblxyXG4gIGFzeW5jIGZldGNoKGlkOiBzdHJpbmcsIG9wdGlvbnM/OiB7IGNhY2hlPzogYm9vbGVhbjsgZm9yY2U/OiBib29sZWFuIH0pOiBQcm9taXNlPGFueT4ge1xyXG4gICAgaWYgKCFvcHRpb25zPy5mb3JjZSkge1xyXG4gICAgICBjb25zdCBleGlzdGluZyA9IHRoaXMuY2FjaGUuZ2V0KGlkKTtcclxuICAgICAgaWYgKGV4aXN0aW5nKSByZXR1cm4gZXhpc3Rpbmc7XHJcbiAgICB9XHJcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5jbGllbnQucmVzdC5yZXF1ZXN0KCdHRVQnLCBgL2NoYW5uZWxzLyR7aWR9YCk7XHJcbiAgICByZXR1cm4gdGhpcy5fYWRkKGRhdGEsIG9wdGlvbnM/LmNhY2hlID8/IHRydWUpO1xyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgR3VpbGRDaGFubmVsTWFuYWdlcjtcclxuIl19