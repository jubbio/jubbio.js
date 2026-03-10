"use strict";
/**
 * Partials - Handle uncached/partial data structures
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Partials = void 0;
exports.isPartial = isPartial;
exports.createPartialUser = createPartialUser;
exports.createPartialChannel = createPartialChannel;
exports.createPartialMessage = createPartialMessage;
exports.createPartialGuildMember = createPartialGuildMember;
exports.createPartialReaction = createPartialReaction;
exports.makePartialAware = makePartialAware;
exports.hasPartial = hasPartial;
/**
 * Partial types that can be enabled
 */
var Partials;
(function (Partials) {
    Partials[Partials["User"] = 0] = "User";
    Partials[Partials["Channel"] = 1] = "Channel";
    Partials[Partials["GuildMember"] = 2] = "GuildMember";
    Partials[Partials["Message"] = 3] = "Message";
    Partials[Partials["Reaction"] = 4] = "Reaction";
    Partials[Partials["GuildScheduledEvent"] = 5] = "GuildScheduledEvent";
})(Partials || (exports.Partials = Partials = {}));
/**
 * Check if a structure is partial (missing data)
 */
function isPartial(obj) {
    return obj?.partial === true;
}
/**
 * Create a partial user structure
 */
function createPartialUser(id) {
    return {
        id,
        partial: true,
        username: null,
        discriminator: null,
        avatar: null,
        bot: null,
        async fetch() {
            throw new Error('Cannot fetch partial user without client context');
        },
        toString() {
            return `<@${id}>`;
        },
    };
}
/**
 * Create a partial channel structure
 */
function createPartialChannel(id) {
    return {
        id,
        partial: true,
        type: null,
        name: null,
        async fetch() {
            throw new Error('Cannot fetch partial channel without client context');
        },
        toString() {
            return `<#${id}>`;
        },
    };
}
/**
 * Create a partial message structure
 */
function createPartialMessage(id, channelId) {
    return {
        id,
        channelId,
        partial: true,
        content: null,
        author: null,
        embeds: null,
        attachments: null,
        async fetch() {
            throw new Error('Cannot fetch partial message without client context');
        },
        toString() {
            return `Message(${id})`;
        },
    };
}
/**
 * Create a partial guild member structure
 */
function createPartialGuildMember(userId, guildId) {
    return {
        id: userId,
        guildId,
        partial: true,
        user: null,
        nick: null,
        roles: null,
        joinedAt: null,
        async fetch() {
            throw new Error('Cannot fetch partial member without client context');
        },
        toString() {
            return `<@${userId}>`;
        },
    };
}
/**
 * Create a partial reaction structure
 */
function createPartialReaction(messageId, emoji) {
    return {
        messageId,
        emoji,
        partial: true,
        count: null,
        me: null,
        async fetch() {
            throw new Error('Cannot fetch partial reaction without client context');
        },
        toString() {
            return emoji;
        },
    };
}
/**
 * Make a structure partial-aware with fetch capability
 */
function makePartialAware(structure, client, fetchFn) {
    return {
        ...structure,
        partial: false,
        async fetch() {
            const fetched = await fetchFn(structure.id);
            Object.assign(this, fetched, { partial: false });
            return this;
        },
    };
}
/**
 * Check if partials are enabled for a type
 */
function hasPartial(client, partial) {
    return client.options?.partials?.includes(partial) ?? false;
}
exports.default = Partials;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUGFydGlhbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdXRpbHMvUGFydGlhbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOztHQUVHOzs7QUFpQkgsOEJBRUM7QUFLRCw4Q0FpQkM7QUFLRCxvREFlQztBQUtELG9EQWtCQztBQUtELDREQWtCQztBQUtELHNEQWdCQztBQThERCw0Q0FjQztBQUtELGdDQUVDO0FBak5EOztHQUVHO0FBQ0gsSUFBWSxRQU9YO0FBUEQsV0FBWSxRQUFRO0lBQ2xCLHVDQUFRLENBQUE7SUFDUiw2Q0FBVyxDQUFBO0lBQ1gscURBQWUsQ0FBQTtJQUNmLDZDQUFXLENBQUE7SUFDWCwrQ0FBWSxDQUFBO0lBQ1oscUVBQXVCLENBQUE7QUFDekIsQ0FBQyxFQVBXLFFBQVEsd0JBQVIsUUFBUSxRQU9uQjtBQUVEOztHQUVHO0FBQ0gsU0FBZ0IsU0FBUyxDQUFDLEdBQVE7SUFDaEMsT0FBTyxHQUFHLEVBQUUsT0FBTyxLQUFLLElBQUksQ0FBQztBQUMvQixDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFnQixpQkFBaUIsQ0FBQyxFQUFVO0lBQzFDLE9BQU87UUFDTCxFQUFFO1FBQ0YsT0FBTyxFQUFFLElBQUk7UUFDYixRQUFRLEVBQUUsSUFBSTtRQUNkLGFBQWEsRUFBRSxJQUFJO1FBQ25CLE1BQU0sRUFBRSxJQUFJO1FBQ1osR0FBRyxFQUFFLElBQUk7UUFFVCxLQUFLLENBQUMsS0FBSztZQUNULE1BQU0sSUFBSSxLQUFLLENBQUMsa0RBQWtELENBQUMsQ0FBQztRQUN0RSxDQUFDO1FBRUQsUUFBUTtZQUNOLE9BQU8sS0FBSyxFQUFFLEdBQUcsQ0FBQztRQUNwQixDQUFDO0tBQ0YsQ0FBQztBQUNKLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQWdCLG9CQUFvQixDQUFDLEVBQVU7SUFDN0MsT0FBTztRQUNMLEVBQUU7UUFDRixPQUFPLEVBQUUsSUFBSTtRQUNiLElBQUksRUFBRSxJQUFJO1FBQ1YsSUFBSSxFQUFFLElBQUk7UUFFVixLQUFLLENBQUMsS0FBSztZQUNULE1BQU0sSUFBSSxLQUFLLENBQUMscURBQXFELENBQUMsQ0FBQztRQUN6RSxDQUFDO1FBRUQsUUFBUTtZQUNOLE9BQU8sS0FBSyxFQUFFLEdBQUcsQ0FBQztRQUNwQixDQUFDO0tBQ0YsQ0FBQztBQUNKLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQWdCLG9CQUFvQixDQUFDLEVBQVUsRUFBRSxTQUFpQjtJQUNoRSxPQUFPO1FBQ0wsRUFBRTtRQUNGLFNBQVM7UUFDVCxPQUFPLEVBQUUsSUFBSTtRQUNiLE9BQU8sRUFBRSxJQUFJO1FBQ2IsTUFBTSxFQUFFLElBQUk7UUFDWixNQUFNLEVBQUUsSUFBSTtRQUNaLFdBQVcsRUFBRSxJQUFJO1FBRWpCLEtBQUssQ0FBQyxLQUFLO1lBQ1QsTUFBTSxJQUFJLEtBQUssQ0FBQyxxREFBcUQsQ0FBQyxDQUFDO1FBQ3pFLENBQUM7UUFFRCxRQUFRO1lBQ04sT0FBTyxXQUFXLEVBQUUsR0FBRyxDQUFDO1FBQzFCLENBQUM7S0FDRixDQUFDO0FBQ0osQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBZ0Isd0JBQXdCLENBQUMsTUFBYyxFQUFFLE9BQWU7SUFDdEUsT0FBTztRQUNMLEVBQUUsRUFBRSxNQUFNO1FBQ1YsT0FBTztRQUNQLE9BQU8sRUFBRSxJQUFJO1FBQ2IsSUFBSSxFQUFFLElBQUk7UUFDVixJQUFJLEVBQUUsSUFBSTtRQUNWLEtBQUssRUFBRSxJQUFJO1FBQ1gsUUFBUSxFQUFFLElBQUk7UUFFZCxLQUFLLENBQUMsS0FBSztZQUNULE1BQU0sSUFBSSxLQUFLLENBQUMsb0RBQW9ELENBQUMsQ0FBQztRQUN4RSxDQUFDO1FBRUQsUUFBUTtZQUNOLE9BQU8sS0FBSyxNQUFNLEdBQUcsQ0FBQztRQUN4QixDQUFDO0tBQ0YsQ0FBQztBQUNKLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQWdCLHFCQUFxQixDQUFDLFNBQWlCLEVBQUUsS0FBYTtJQUNwRSxPQUFPO1FBQ0wsU0FBUztRQUNULEtBQUs7UUFDTCxPQUFPLEVBQUUsSUFBSTtRQUNiLEtBQUssRUFBRSxJQUFJO1FBQ1gsRUFBRSxFQUFFLElBQUk7UUFFUixLQUFLLENBQUMsS0FBSztZQUNULE1BQU0sSUFBSSxLQUFLLENBQUMsc0RBQXNELENBQUMsQ0FBQztRQUMxRSxDQUFDO1FBRUQsUUFBUTtZQUNOLE9BQU8sS0FBSyxDQUFDO1FBQ2YsQ0FBQztLQUNGLENBQUM7QUFDSixDQUFDO0FBMkREOztHQUVHO0FBQ0gsU0FBZ0IsZ0JBQWdCLENBQzlCLFNBQVksRUFDWixNQUFXLEVBQ1gsT0FBbUM7SUFFbkMsT0FBTztRQUNMLEdBQUcsU0FBUztRQUNaLE9BQU8sRUFBRSxLQUFLO1FBQ2QsS0FBSyxDQUFDLEtBQUs7WUFDVCxNQUFNLE9BQU8sR0FBRyxNQUFNLE9BQU8sQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDNUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7WUFDakQsT0FBTyxJQUFTLENBQUM7UUFDbkIsQ0FBQztLQUNGLENBQUM7QUFDSixDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFnQixVQUFVLENBQUMsTUFBVyxFQUFFLE9BQWlCO0lBQ3ZELE9BQU8sTUFBTSxDQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUUsUUFBUSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEtBQUssQ0FBQztBQUM5RCxDQUFDO0FBRUQsa0JBQWUsUUFBUSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBQYXJ0aWFscyAtIEhhbmRsZSB1bmNhY2hlZC9wYXJ0aWFsIGRhdGEgc3RydWN0dXJlc1xuICovXG5cbi8qKlxuICogUGFydGlhbCB0eXBlcyB0aGF0IGNhbiBiZSBlbmFibGVkXG4gKi9cbmV4cG9ydCBlbnVtIFBhcnRpYWxzIHtcbiAgVXNlciA9IDAsXG4gIENoYW5uZWwgPSAxLFxuICBHdWlsZE1lbWJlciA9IDIsXG4gIE1lc3NhZ2UgPSAzLFxuICBSZWFjdGlvbiA9IDQsXG4gIEd1aWxkU2NoZWR1bGVkRXZlbnQgPSA1LFxufVxuXG4vKipcbiAqIENoZWNrIGlmIGEgc3RydWN0dXJlIGlzIHBhcnRpYWwgKG1pc3NpbmcgZGF0YSlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzUGFydGlhbChvYmo6IGFueSk6IGJvb2xlYW4ge1xuICByZXR1cm4gb2JqPy5wYXJ0aWFsID09PSB0cnVlO1xufVxuXG4vKipcbiAqIENyZWF0ZSBhIHBhcnRpYWwgdXNlciBzdHJ1Y3R1cmVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVBhcnRpYWxVc2VyKGlkOiBzdHJpbmcpOiBQYXJ0aWFsVXNlciB7XG4gIHJldHVybiB7XG4gICAgaWQsXG4gICAgcGFydGlhbDogdHJ1ZSxcbiAgICB1c2VybmFtZTogbnVsbCxcbiAgICBkaXNjcmltaW5hdG9yOiBudWxsLFxuICAgIGF2YXRhcjogbnVsbCxcbiAgICBib3Q6IG51bGwsXG4gICAgXG4gICAgYXN5bmMgZmV0Y2goKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBmZXRjaCBwYXJ0aWFsIHVzZXIgd2l0aG91dCBjbGllbnQgY29udGV4dCcpO1xuICAgIH0sXG4gICAgXG4gICAgdG9TdHJpbmcoKSB7XG4gICAgICByZXR1cm4gYDxAJHtpZH0+YDtcbiAgICB9LFxuICB9O1xufVxuXG4vKipcbiAqIENyZWF0ZSBhIHBhcnRpYWwgY2hhbm5lbCBzdHJ1Y3R1cmVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVBhcnRpYWxDaGFubmVsKGlkOiBzdHJpbmcpOiBQYXJ0aWFsQ2hhbm5lbCB7XG4gIHJldHVybiB7XG4gICAgaWQsXG4gICAgcGFydGlhbDogdHJ1ZSxcbiAgICB0eXBlOiBudWxsLFxuICAgIG5hbWU6IG51bGwsXG4gICAgXG4gICAgYXN5bmMgZmV0Y2goKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBmZXRjaCBwYXJ0aWFsIGNoYW5uZWwgd2l0aG91dCBjbGllbnQgY29udGV4dCcpO1xuICAgIH0sXG4gICAgXG4gICAgdG9TdHJpbmcoKSB7XG4gICAgICByZXR1cm4gYDwjJHtpZH0+YDtcbiAgICB9LFxuICB9O1xufVxuXG4vKipcbiAqIENyZWF0ZSBhIHBhcnRpYWwgbWVzc2FnZSBzdHJ1Y3R1cmVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVBhcnRpYWxNZXNzYWdlKGlkOiBzdHJpbmcsIGNoYW5uZWxJZDogc3RyaW5nKTogUGFydGlhbE1lc3NhZ2Uge1xuICByZXR1cm4ge1xuICAgIGlkLFxuICAgIGNoYW5uZWxJZCxcbiAgICBwYXJ0aWFsOiB0cnVlLFxuICAgIGNvbnRlbnQ6IG51bGwsXG4gICAgYXV0aG9yOiBudWxsLFxuICAgIGVtYmVkczogbnVsbCxcbiAgICBhdHRhY2htZW50czogbnVsbCxcbiAgICBcbiAgICBhc3luYyBmZXRjaCgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IGZldGNoIHBhcnRpYWwgbWVzc2FnZSB3aXRob3V0IGNsaWVudCBjb250ZXh0Jyk7XG4gICAgfSxcbiAgICBcbiAgICB0b1N0cmluZygpIHtcbiAgICAgIHJldHVybiBgTWVzc2FnZSgke2lkfSlgO1xuICAgIH0sXG4gIH07XG59XG5cbi8qKlxuICogQ3JlYXRlIGEgcGFydGlhbCBndWlsZCBtZW1iZXIgc3RydWN0dXJlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVQYXJ0aWFsR3VpbGRNZW1iZXIodXNlcklkOiBzdHJpbmcsIGd1aWxkSWQ6IHN0cmluZyk6IFBhcnRpYWxHdWlsZE1lbWJlciB7XG4gIHJldHVybiB7XG4gICAgaWQ6IHVzZXJJZCxcbiAgICBndWlsZElkLFxuICAgIHBhcnRpYWw6IHRydWUsXG4gICAgdXNlcjogbnVsbCxcbiAgICBuaWNrOiBudWxsLFxuICAgIHJvbGVzOiBudWxsLFxuICAgIGpvaW5lZEF0OiBudWxsLFxuICAgIFxuICAgIGFzeW5jIGZldGNoKCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgZmV0Y2ggcGFydGlhbCBtZW1iZXIgd2l0aG91dCBjbGllbnQgY29udGV4dCcpO1xuICAgIH0sXG4gICAgXG4gICAgdG9TdHJpbmcoKSB7XG4gICAgICByZXR1cm4gYDxAJHt1c2VySWR9PmA7XG4gICAgfSxcbiAgfTtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBwYXJ0aWFsIHJlYWN0aW9uIHN0cnVjdHVyZVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlUGFydGlhbFJlYWN0aW9uKG1lc3NhZ2VJZDogc3RyaW5nLCBlbW9qaTogc3RyaW5nKTogUGFydGlhbFJlYWN0aW9uIHtcbiAgcmV0dXJuIHtcbiAgICBtZXNzYWdlSWQsXG4gICAgZW1vamksXG4gICAgcGFydGlhbDogdHJ1ZSxcbiAgICBjb3VudDogbnVsbCxcbiAgICBtZTogbnVsbCxcbiAgICBcbiAgICBhc3luYyBmZXRjaCgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IGZldGNoIHBhcnRpYWwgcmVhY3Rpb24gd2l0aG91dCBjbGllbnQgY29udGV4dCcpO1xuICAgIH0sXG4gICAgXG4gICAgdG9TdHJpbmcoKSB7XG4gICAgICByZXR1cm4gZW1vamk7XG4gICAgfSxcbiAgfTtcbn1cblxuLyoqXG4gKiBQYXJ0aWFsIHN0cnVjdHVyZSB0eXBlc1xuICovXG5leHBvcnQgaW50ZXJmYWNlIFBhcnRpYWxVc2VyIHtcbiAgaWQ6IHN0cmluZztcbiAgcGFydGlhbDogdHJ1ZTtcbiAgdXNlcm5hbWU6IHN0cmluZyB8IG51bGw7XG4gIGRpc2NyaW1pbmF0b3I6IHN0cmluZyB8IG51bGw7XG4gIGF2YXRhcjogc3RyaW5nIHwgbnVsbDtcbiAgYm90OiBib29sZWFuIHwgbnVsbDtcbiAgZmV0Y2goKTogUHJvbWlzZTxhbnk+O1xuICB0b1N0cmluZygpOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGFydGlhbENoYW5uZWwge1xuICBpZDogc3RyaW5nO1xuICBwYXJ0aWFsOiB0cnVlO1xuICB0eXBlOiBudW1iZXIgfCBudWxsO1xuICBuYW1lOiBzdHJpbmcgfCBudWxsO1xuICBmZXRjaCgpOiBQcm9taXNlPGFueT47XG4gIHRvU3RyaW5nKCk6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBQYXJ0aWFsTWVzc2FnZSB7XG4gIGlkOiBzdHJpbmc7XG4gIGNoYW5uZWxJZDogc3RyaW5nO1xuICBwYXJ0aWFsOiB0cnVlO1xuICBjb250ZW50OiBzdHJpbmcgfCBudWxsO1xuICBhdXRob3I6IGFueSB8IG51bGw7XG4gIGVtYmVkczogYW55W10gfCBudWxsO1xuICBhdHRhY2htZW50czogYW55W10gfCBudWxsO1xuICBmZXRjaCgpOiBQcm9taXNlPGFueT47XG4gIHRvU3RyaW5nKCk6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBQYXJ0aWFsR3VpbGRNZW1iZXIge1xuICBpZDogc3RyaW5nO1xuICBndWlsZElkOiBzdHJpbmc7XG4gIHBhcnRpYWw6IHRydWU7XG4gIHVzZXI6IGFueSB8IG51bGw7XG4gIG5pY2s6IHN0cmluZyB8IG51bGw7XG4gIHJvbGVzOiBzdHJpbmdbXSB8IG51bGw7XG4gIGpvaW5lZEF0OiBEYXRlIHwgbnVsbDtcbiAgZmV0Y2goKTogUHJvbWlzZTxhbnk+O1xuICB0b1N0cmluZygpOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGFydGlhbFJlYWN0aW9uIHtcbiAgbWVzc2FnZUlkOiBzdHJpbmc7XG4gIGVtb2ppOiBzdHJpbmc7XG4gIHBhcnRpYWw6IHRydWU7XG4gIGNvdW50OiBudW1iZXIgfCBudWxsO1xuICBtZTogYm9vbGVhbiB8IG51bGw7XG4gIGZldGNoKCk6IFByb21pc2U8YW55PjtcbiAgdG9TdHJpbmcoKTogc3RyaW5nO1xufVxuXG4vKipcbiAqIE1ha2UgYSBzdHJ1Y3R1cmUgcGFydGlhbC1hd2FyZSB3aXRoIGZldGNoIGNhcGFiaWxpdHlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1ha2VQYXJ0aWFsQXdhcmU8VCBleHRlbmRzIHsgaWQ6IHN0cmluZyB9PihcbiAgc3RydWN0dXJlOiBULFxuICBjbGllbnQ6IGFueSxcbiAgZmV0Y2hGbjogKGlkOiBzdHJpbmcpID0+IFByb21pc2U8VD5cbik6IFQgJiB7IHBhcnRpYWw6IGJvb2xlYW47IGZldGNoOiAoKSA9PiBQcm9taXNlPFQ+IH0ge1xuICByZXR1cm4ge1xuICAgIC4uLnN0cnVjdHVyZSxcbiAgICBwYXJ0aWFsOiBmYWxzZSxcbiAgICBhc3luYyBmZXRjaCgpIHtcbiAgICAgIGNvbnN0IGZldGNoZWQgPSBhd2FpdCBmZXRjaEZuKHN0cnVjdHVyZS5pZCk7XG4gICAgICBPYmplY3QuYXNzaWduKHRoaXMsIGZldGNoZWQsIHsgcGFydGlhbDogZmFsc2UgfSk7XG4gICAgICByZXR1cm4gdGhpcyBhcyBUO1xuICAgIH0sXG4gIH07XG59XG5cbi8qKlxuICogQ2hlY2sgaWYgcGFydGlhbHMgYXJlIGVuYWJsZWQgZm9yIGEgdHlwZVxuICovXG5leHBvcnQgZnVuY3Rpb24gaGFzUGFydGlhbChjbGllbnQ6IGFueSwgcGFydGlhbDogUGFydGlhbHMpOiBib29sZWFuIHtcbiAgcmV0dXJuIGNsaWVudC5vcHRpb25zPy5wYXJ0aWFscz8uaW5jbHVkZXMocGFydGlhbCkgPz8gZmFsc2U7XG59XG5cbmV4cG9ydCBkZWZhdWx0IFBhcnRpYWxzO1xuIl19