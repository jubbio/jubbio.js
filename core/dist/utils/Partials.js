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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUGFydGlhbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdXRpbHMvUGFydGlhbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOztHQUVHOzs7QUFpQkgsOEJBRUM7QUFLRCw4Q0FpQkM7QUFLRCxvREFlQztBQUtELG9EQWtCQztBQUtELDREQWtCQztBQUtELHNEQWdCQztBQThERCw0Q0FjQztBQUtELGdDQUVDO0FBak5EOztHQUVHO0FBQ0gsSUFBWSxRQU9YO0FBUEQsV0FBWSxRQUFRO0lBQ2xCLHVDQUFRLENBQUE7SUFDUiw2Q0FBVyxDQUFBO0lBQ1gscURBQWUsQ0FBQTtJQUNmLDZDQUFXLENBQUE7SUFDWCwrQ0FBWSxDQUFBO0lBQ1oscUVBQXVCLENBQUE7QUFDekIsQ0FBQyxFQVBXLFFBQVEsd0JBQVIsUUFBUSxRQU9uQjtBQUVEOztHQUVHO0FBQ0gsU0FBZ0IsU0FBUyxDQUFDLEdBQVE7SUFDaEMsT0FBTyxHQUFHLEVBQUUsT0FBTyxLQUFLLElBQUksQ0FBQztBQUMvQixDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFnQixpQkFBaUIsQ0FBQyxFQUFVO0lBQzFDLE9BQU87UUFDTCxFQUFFO1FBQ0YsT0FBTyxFQUFFLElBQUk7UUFDYixRQUFRLEVBQUUsSUFBSTtRQUNkLGFBQWEsRUFBRSxJQUFJO1FBQ25CLE1BQU0sRUFBRSxJQUFJO1FBQ1osR0FBRyxFQUFFLElBQUk7UUFFVCxLQUFLLENBQUMsS0FBSztZQUNULE1BQU0sSUFBSSxLQUFLLENBQUMsa0RBQWtELENBQUMsQ0FBQztRQUN0RSxDQUFDO1FBRUQsUUFBUTtZQUNOLE9BQU8sS0FBSyxFQUFFLEdBQUcsQ0FBQztRQUNwQixDQUFDO0tBQ0YsQ0FBQztBQUNKLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQWdCLG9CQUFvQixDQUFDLEVBQVU7SUFDN0MsT0FBTztRQUNMLEVBQUU7UUFDRixPQUFPLEVBQUUsSUFBSTtRQUNiLElBQUksRUFBRSxJQUFJO1FBQ1YsSUFBSSxFQUFFLElBQUk7UUFFVixLQUFLLENBQUMsS0FBSztZQUNULE1BQU0sSUFBSSxLQUFLLENBQUMscURBQXFELENBQUMsQ0FBQztRQUN6RSxDQUFDO1FBRUQsUUFBUTtZQUNOLE9BQU8sS0FBSyxFQUFFLEdBQUcsQ0FBQztRQUNwQixDQUFDO0tBQ0YsQ0FBQztBQUNKLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQWdCLG9CQUFvQixDQUFDLEVBQVUsRUFBRSxTQUFpQjtJQUNoRSxPQUFPO1FBQ0wsRUFBRTtRQUNGLFNBQVM7UUFDVCxPQUFPLEVBQUUsSUFBSTtRQUNiLE9BQU8sRUFBRSxJQUFJO1FBQ2IsTUFBTSxFQUFFLElBQUk7UUFDWixNQUFNLEVBQUUsSUFBSTtRQUNaLFdBQVcsRUFBRSxJQUFJO1FBRWpCLEtBQUssQ0FBQyxLQUFLO1lBQ1QsTUFBTSxJQUFJLEtBQUssQ0FBQyxxREFBcUQsQ0FBQyxDQUFDO1FBQ3pFLENBQUM7UUFFRCxRQUFRO1lBQ04sT0FBTyxXQUFXLEVBQUUsR0FBRyxDQUFDO1FBQzFCLENBQUM7S0FDRixDQUFDO0FBQ0osQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBZ0Isd0JBQXdCLENBQUMsTUFBYyxFQUFFLE9BQWU7SUFDdEUsT0FBTztRQUNMLEVBQUUsRUFBRSxNQUFNO1FBQ1YsT0FBTztRQUNQLE9BQU8sRUFBRSxJQUFJO1FBQ2IsSUFBSSxFQUFFLElBQUk7UUFDVixJQUFJLEVBQUUsSUFBSTtRQUNWLEtBQUssRUFBRSxJQUFJO1FBQ1gsUUFBUSxFQUFFLElBQUk7UUFFZCxLQUFLLENBQUMsS0FBSztZQUNULE1BQU0sSUFBSSxLQUFLLENBQUMsb0RBQW9ELENBQUMsQ0FBQztRQUN4RSxDQUFDO1FBRUQsUUFBUTtZQUNOLE9BQU8sS0FBSyxNQUFNLEdBQUcsQ0FBQztRQUN4QixDQUFDO0tBQ0YsQ0FBQztBQUNKLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQWdCLHFCQUFxQixDQUFDLFNBQWlCLEVBQUUsS0FBYTtJQUNwRSxPQUFPO1FBQ0wsU0FBUztRQUNULEtBQUs7UUFDTCxPQUFPLEVBQUUsSUFBSTtRQUNiLEtBQUssRUFBRSxJQUFJO1FBQ1gsRUFBRSxFQUFFLElBQUk7UUFFUixLQUFLLENBQUMsS0FBSztZQUNULE1BQU0sSUFBSSxLQUFLLENBQUMsc0RBQXNELENBQUMsQ0FBQztRQUMxRSxDQUFDO1FBRUQsUUFBUTtZQUNOLE9BQU8sS0FBSyxDQUFDO1FBQ2YsQ0FBQztLQUNGLENBQUM7QUFDSixDQUFDO0FBMkREOztHQUVHO0FBQ0gsU0FBZ0IsZ0JBQWdCLENBQzlCLFNBQVksRUFDWixNQUFXLEVBQ1gsT0FBbUM7SUFFbkMsT0FBTztRQUNMLEdBQUcsU0FBUztRQUNaLE9BQU8sRUFBRSxLQUFLO1FBQ2QsS0FBSyxDQUFDLEtBQUs7WUFDVCxNQUFNLE9BQU8sR0FBRyxNQUFNLE9BQU8sQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDNUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7WUFDakQsT0FBTyxJQUFTLENBQUM7UUFDbkIsQ0FBQztLQUNGLENBQUM7QUFDSixDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFnQixVQUFVLENBQUMsTUFBVyxFQUFFLE9BQWlCO0lBQ3ZELE9BQU8sTUFBTSxDQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUUsUUFBUSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEtBQUssQ0FBQztBQUM5RCxDQUFDO0FBRUQsa0JBQWUsUUFBUSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIFBhcnRpYWxzIC0gSGFuZGxlIHVuY2FjaGVkL3BhcnRpYWwgZGF0YSBzdHJ1Y3R1cmVzXHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIFBhcnRpYWwgdHlwZXMgdGhhdCBjYW4gYmUgZW5hYmxlZFxyXG4gKi9cclxuZXhwb3J0IGVudW0gUGFydGlhbHMge1xyXG4gIFVzZXIgPSAwLFxyXG4gIENoYW5uZWwgPSAxLFxyXG4gIEd1aWxkTWVtYmVyID0gMixcclxuICBNZXNzYWdlID0gMyxcclxuICBSZWFjdGlvbiA9IDQsXHJcbiAgR3VpbGRTY2hlZHVsZWRFdmVudCA9IDUsXHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDaGVjayBpZiBhIHN0cnVjdHVyZSBpcyBwYXJ0aWFsIChtaXNzaW5nIGRhdGEpXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gaXNQYXJ0aWFsKG9iajogYW55KTogYm9vbGVhbiB7XHJcbiAgcmV0dXJuIG9iaj8ucGFydGlhbCA9PT0gdHJ1ZTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENyZWF0ZSBhIHBhcnRpYWwgdXNlciBzdHJ1Y3R1cmVcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVQYXJ0aWFsVXNlcihpZDogc3RyaW5nKTogUGFydGlhbFVzZXIge1xyXG4gIHJldHVybiB7XHJcbiAgICBpZCxcclxuICAgIHBhcnRpYWw6IHRydWUsXHJcbiAgICB1c2VybmFtZTogbnVsbCxcclxuICAgIGRpc2NyaW1pbmF0b3I6IG51bGwsXHJcbiAgICBhdmF0YXI6IG51bGwsXHJcbiAgICBib3Q6IG51bGwsXHJcbiAgICBcclxuICAgIGFzeW5jIGZldGNoKCkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBmZXRjaCBwYXJ0aWFsIHVzZXIgd2l0aG91dCBjbGllbnQgY29udGV4dCcpO1xyXG4gICAgfSxcclxuICAgIFxyXG4gICAgdG9TdHJpbmcoKSB7XHJcbiAgICAgIHJldHVybiBgPEAke2lkfT5gO1xyXG4gICAgfSxcclxuICB9O1xyXG59XHJcblxyXG4vKipcclxuICogQ3JlYXRlIGEgcGFydGlhbCBjaGFubmVsIHN0cnVjdHVyZVxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVBhcnRpYWxDaGFubmVsKGlkOiBzdHJpbmcpOiBQYXJ0aWFsQ2hhbm5lbCB7XHJcbiAgcmV0dXJuIHtcclxuICAgIGlkLFxyXG4gICAgcGFydGlhbDogdHJ1ZSxcclxuICAgIHR5cGU6IG51bGwsXHJcbiAgICBuYW1lOiBudWxsLFxyXG4gICAgXHJcbiAgICBhc3luYyBmZXRjaCgpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgZmV0Y2ggcGFydGlhbCBjaGFubmVsIHdpdGhvdXQgY2xpZW50IGNvbnRleHQnKTtcclxuICAgIH0sXHJcbiAgICBcclxuICAgIHRvU3RyaW5nKCkge1xyXG4gICAgICByZXR1cm4gYDwjJHtpZH0+YDtcclxuICAgIH0sXHJcbiAgfTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENyZWF0ZSBhIHBhcnRpYWwgbWVzc2FnZSBzdHJ1Y3R1cmVcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVQYXJ0aWFsTWVzc2FnZShpZDogc3RyaW5nLCBjaGFubmVsSWQ6IHN0cmluZyk6IFBhcnRpYWxNZXNzYWdlIHtcclxuICByZXR1cm4ge1xyXG4gICAgaWQsXHJcbiAgICBjaGFubmVsSWQsXHJcbiAgICBwYXJ0aWFsOiB0cnVlLFxyXG4gICAgY29udGVudDogbnVsbCxcclxuICAgIGF1dGhvcjogbnVsbCxcclxuICAgIGVtYmVkczogbnVsbCxcclxuICAgIGF0dGFjaG1lbnRzOiBudWxsLFxyXG4gICAgXHJcbiAgICBhc3luYyBmZXRjaCgpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgZmV0Y2ggcGFydGlhbCBtZXNzYWdlIHdpdGhvdXQgY2xpZW50IGNvbnRleHQnKTtcclxuICAgIH0sXHJcbiAgICBcclxuICAgIHRvU3RyaW5nKCkge1xyXG4gICAgICByZXR1cm4gYE1lc3NhZ2UoJHtpZH0pYDtcclxuICAgIH0sXHJcbiAgfTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENyZWF0ZSBhIHBhcnRpYWwgZ3VpbGQgbWVtYmVyIHN0cnVjdHVyZVxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVBhcnRpYWxHdWlsZE1lbWJlcih1c2VySWQ6IHN0cmluZywgZ3VpbGRJZDogc3RyaW5nKTogUGFydGlhbEd1aWxkTWVtYmVyIHtcclxuICByZXR1cm4ge1xyXG4gICAgaWQ6IHVzZXJJZCxcclxuICAgIGd1aWxkSWQsXHJcbiAgICBwYXJ0aWFsOiB0cnVlLFxyXG4gICAgdXNlcjogbnVsbCxcclxuICAgIG5pY2s6IG51bGwsXHJcbiAgICByb2xlczogbnVsbCxcclxuICAgIGpvaW5lZEF0OiBudWxsLFxyXG4gICAgXHJcbiAgICBhc3luYyBmZXRjaCgpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgZmV0Y2ggcGFydGlhbCBtZW1iZXIgd2l0aG91dCBjbGllbnQgY29udGV4dCcpO1xyXG4gICAgfSxcclxuICAgIFxyXG4gICAgdG9TdHJpbmcoKSB7XHJcbiAgICAgIHJldHVybiBgPEAke3VzZXJJZH0+YDtcclxuICAgIH0sXHJcbiAgfTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENyZWF0ZSBhIHBhcnRpYWwgcmVhY3Rpb24gc3RydWN0dXJlXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlUGFydGlhbFJlYWN0aW9uKG1lc3NhZ2VJZDogc3RyaW5nLCBlbW9qaTogc3RyaW5nKTogUGFydGlhbFJlYWN0aW9uIHtcclxuICByZXR1cm4ge1xyXG4gICAgbWVzc2FnZUlkLFxyXG4gICAgZW1vamksXHJcbiAgICBwYXJ0aWFsOiB0cnVlLFxyXG4gICAgY291bnQ6IG51bGwsXHJcbiAgICBtZTogbnVsbCxcclxuICAgIFxyXG4gICAgYXN5bmMgZmV0Y2goKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IGZldGNoIHBhcnRpYWwgcmVhY3Rpb24gd2l0aG91dCBjbGllbnQgY29udGV4dCcpO1xyXG4gICAgfSxcclxuICAgIFxyXG4gICAgdG9TdHJpbmcoKSB7XHJcbiAgICAgIHJldHVybiBlbW9qaTtcclxuICAgIH0sXHJcbiAgfTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFBhcnRpYWwgc3RydWN0dXJlIHR5cGVzXHJcbiAqL1xyXG5leHBvcnQgaW50ZXJmYWNlIFBhcnRpYWxVc2VyIHtcclxuICBpZDogc3RyaW5nO1xyXG4gIHBhcnRpYWw6IHRydWU7XHJcbiAgdXNlcm5hbWU6IHN0cmluZyB8IG51bGw7XHJcbiAgZGlzY3JpbWluYXRvcjogc3RyaW5nIHwgbnVsbDtcclxuICBhdmF0YXI6IHN0cmluZyB8IG51bGw7XHJcbiAgYm90OiBib29sZWFuIHwgbnVsbDtcclxuICBmZXRjaCgpOiBQcm9taXNlPGFueT47XHJcbiAgdG9TdHJpbmcoKTogc3RyaW5nO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIFBhcnRpYWxDaGFubmVsIHtcclxuICBpZDogc3RyaW5nO1xyXG4gIHBhcnRpYWw6IHRydWU7XHJcbiAgdHlwZTogbnVtYmVyIHwgbnVsbDtcclxuICBuYW1lOiBzdHJpbmcgfCBudWxsO1xyXG4gIGZldGNoKCk6IFByb21pc2U8YW55PjtcclxuICB0b1N0cmluZygpOiBzdHJpbmc7XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgUGFydGlhbE1lc3NhZ2Uge1xyXG4gIGlkOiBzdHJpbmc7XHJcbiAgY2hhbm5lbElkOiBzdHJpbmc7XHJcbiAgcGFydGlhbDogdHJ1ZTtcclxuICBjb250ZW50OiBzdHJpbmcgfCBudWxsO1xyXG4gIGF1dGhvcjogYW55IHwgbnVsbDtcclxuICBlbWJlZHM6IGFueVtdIHwgbnVsbDtcclxuICBhdHRhY2htZW50czogYW55W10gfCBudWxsO1xyXG4gIGZldGNoKCk6IFByb21pc2U8YW55PjtcclxuICB0b1N0cmluZygpOiBzdHJpbmc7XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgUGFydGlhbEd1aWxkTWVtYmVyIHtcclxuICBpZDogc3RyaW5nO1xyXG4gIGd1aWxkSWQ6IHN0cmluZztcclxuICBwYXJ0aWFsOiB0cnVlO1xyXG4gIHVzZXI6IGFueSB8IG51bGw7XHJcbiAgbmljazogc3RyaW5nIHwgbnVsbDtcclxuICByb2xlczogc3RyaW5nW10gfCBudWxsO1xyXG4gIGpvaW5lZEF0OiBEYXRlIHwgbnVsbDtcclxuICBmZXRjaCgpOiBQcm9taXNlPGFueT47XHJcbiAgdG9TdHJpbmcoKTogc3RyaW5nO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIFBhcnRpYWxSZWFjdGlvbiB7XHJcbiAgbWVzc2FnZUlkOiBzdHJpbmc7XHJcbiAgZW1vamk6IHN0cmluZztcclxuICBwYXJ0aWFsOiB0cnVlO1xyXG4gIGNvdW50OiBudW1iZXIgfCBudWxsO1xyXG4gIG1lOiBib29sZWFuIHwgbnVsbDtcclxuICBmZXRjaCgpOiBQcm9taXNlPGFueT47XHJcbiAgdG9TdHJpbmcoKTogc3RyaW5nO1xyXG59XHJcblxyXG4vKipcclxuICogTWFrZSBhIHN0cnVjdHVyZSBwYXJ0aWFsLWF3YXJlIHdpdGggZmV0Y2ggY2FwYWJpbGl0eVxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIG1ha2VQYXJ0aWFsQXdhcmU8VCBleHRlbmRzIHsgaWQ6IHN0cmluZyB9PihcclxuICBzdHJ1Y3R1cmU6IFQsXHJcbiAgY2xpZW50OiBhbnksXHJcbiAgZmV0Y2hGbjogKGlkOiBzdHJpbmcpID0+IFByb21pc2U8VD5cclxuKTogVCAmIHsgcGFydGlhbDogYm9vbGVhbjsgZmV0Y2g6ICgpID0+IFByb21pc2U8VD4gfSB7XHJcbiAgcmV0dXJuIHtcclxuICAgIC4uLnN0cnVjdHVyZSxcclxuICAgIHBhcnRpYWw6IGZhbHNlLFxyXG4gICAgYXN5bmMgZmV0Y2goKSB7XHJcbiAgICAgIGNvbnN0IGZldGNoZWQgPSBhd2FpdCBmZXRjaEZuKHN0cnVjdHVyZS5pZCk7XHJcbiAgICAgIE9iamVjdC5hc3NpZ24odGhpcywgZmV0Y2hlZCwgeyBwYXJ0aWFsOiBmYWxzZSB9KTtcclxuICAgICAgcmV0dXJuIHRoaXMgYXMgVDtcclxuICAgIH0sXHJcbiAgfTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENoZWNrIGlmIHBhcnRpYWxzIGFyZSBlbmFibGVkIGZvciBhIHR5cGVcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBoYXNQYXJ0aWFsKGNsaWVudDogYW55LCBwYXJ0aWFsOiBQYXJ0aWFscyk6IGJvb2xlYW4ge1xyXG4gIHJldHVybiBjbGllbnQub3B0aW9ucz8ucGFydGlhbHM/LmluY2x1ZGVzKHBhcnRpYWwpID8/IGZhbHNlO1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBQYXJ0aWFscztcclxuIl19