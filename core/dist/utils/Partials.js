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
    Partials[Partials["ThreadMember"] = 6] = "ThreadMember";
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUGFydGlhbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdXRpbHMvUGFydGlhbHMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOztHQUVHOzs7QUFrQkgsOEJBRUM7QUFLRCw4Q0FpQkM7QUFLRCxvREFlQztBQUtELG9EQWtCQztBQUtELDREQWtCQztBQUtELHNEQWdCQztBQThERCw0Q0FjQztBQUtELGdDQUVDO0FBbE5EOztHQUVHO0FBQ0gsSUFBWSxRQVFYO0FBUkQsV0FBWSxRQUFRO0lBQ2xCLHVDQUFRLENBQUE7SUFDUiw2Q0FBVyxDQUFBO0lBQ1gscURBQWUsQ0FBQTtJQUNmLDZDQUFXLENBQUE7SUFDWCwrQ0FBWSxDQUFBO0lBQ1oscUVBQXVCLENBQUE7SUFDdkIsdURBQWdCLENBQUE7QUFDbEIsQ0FBQyxFQVJXLFFBQVEsd0JBQVIsUUFBUSxRQVFuQjtBQUVEOztHQUVHO0FBQ0gsU0FBZ0IsU0FBUyxDQUFDLEdBQVE7SUFDaEMsT0FBTyxHQUFHLEVBQUUsT0FBTyxLQUFLLElBQUksQ0FBQztBQUMvQixDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFnQixpQkFBaUIsQ0FBQyxFQUFVO0lBQzFDLE9BQU87UUFDTCxFQUFFO1FBQ0YsT0FBTyxFQUFFLElBQUk7UUFDYixRQUFRLEVBQUUsSUFBSTtRQUNkLGFBQWEsRUFBRSxJQUFJO1FBQ25CLE1BQU0sRUFBRSxJQUFJO1FBQ1osR0FBRyxFQUFFLElBQUk7UUFFVCxLQUFLLENBQUMsS0FBSztZQUNULE1BQU0sSUFBSSxLQUFLLENBQUMsa0RBQWtELENBQUMsQ0FBQztRQUN0RSxDQUFDO1FBRUQsUUFBUTtZQUNOLE9BQU8sS0FBSyxFQUFFLEdBQUcsQ0FBQztRQUNwQixDQUFDO0tBQ0YsQ0FBQztBQUNKLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQWdCLG9CQUFvQixDQUFDLEVBQVU7SUFDN0MsT0FBTztRQUNMLEVBQUU7UUFDRixPQUFPLEVBQUUsSUFBSTtRQUNiLElBQUksRUFBRSxJQUFJO1FBQ1YsSUFBSSxFQUFFLElBQUk7UUFFVixLQUFLLENBQUMsS0FBSztZQUNULE1BQU0sSUFBSSxLQUFLLENBQUMscURBQXFELENBQUMsQ0FBQztRQUN6RSxDQUFDO1FBRUQsUUFBUTtZQUNOLE9BQU8sS0FBSyxFQUFFLEdBQUcsQ0FBQztRQUNwQixDQUFDO0tBQ0YsQ0FBQztBQUNKLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQWdCLG9CQUFvQixDQUFDLEVBQVUsRUFBRSxTQUFpQjtJQUNoRSxPQUFPO1FBQ0wsRUFBRTtRQUNGLFNBQVM7UUFDVCxPQUFPLEVBQUUsSUFBSTtRQUNiLE9BQU8sRUFBRSxJQUFJO1FBQ2IsTUFBTSxFQUFFLElBQUk7UUFDWixNQUFNLEVBQUUsSUFBSTtRQUNaLFdBQVcsRUFBRSxJQUFJO1FBRWpCLEtBQUssQ0FBQyxLQUFLO1lBQ1QsTUFBTSxJQUFJLEtBQUssQ0FBQyxxREFBcUQsQ0FBQyxDQUFDO1FBQ3pFLENBQUM7UUFFRCxRQUFRO1lBQ04sT0FBTyxXQUFXLEVBQUUsR0FBRyxDQUFDO1FBQzFCLENBQUM7S0FDRixDQUFDO0FBQ0osQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBZ0Isd0JBQXdCLENBQUMsTUFBYyxFQUFFLE9BQWU7SUFDdEUsT0FBTztRQUNMLEVBQUUsRUFBRSxNQUFNO1FBQ1YsT0FBTztRQUNQLE9BQU8sRUFBRSxJQUFJO1FBQ2IsSUFBSSxFQUFFLElBQUk7UUFDVixJQUFJLEVBQUUsSUFBSTtRQUNWLEtBQUssRUFBRSxJQUFJO1FBQ1gsUUFBUSxFQUFFLElBQUk7UUFFZCxLQUFLLENBQUMsS0FBSztZQUNULE1BQU0sSUFBSSxLQUFLLENBQUMsb0RBQW9ELENBQUMsQ0FBQztRQUN4RSxDQUFDO1FBRUQsUUFBUTtZQUNOLE9BQU8sS0FBSyxNQUFNLEdBQUcsQ0FBQztRQUN4QixDQUFDO0tBQ0YsQ0FBQztBQUNKLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQWdCLHFCQUFxQixDQUFDLFNBQWlCLEVBQUUsS0FBYTtJQUNwRSxPQUFPO1FBQ0wsU0FBUztRQUNULEtBQUs7UUFDTCxPQUFPLEVBQUUsSUFBSTtRQUNiLEtBQUssRUFBRSxJQUFJO1FBQ1gsRUFBRSxFQUFFLElBQUk7UUFFUixLQUFLLENBQUMsS0FBSztZQUNULE1BQU0sSUFBSSxLQUFLLENBQUMsc0RBQXNELENBQUMsQ0FBQztRQUMxRSxDQUFDO1FBRUQsUUFBUTtZQUNOLE9BQU8sS0FBSyxDQUFDO1FBQ2YsQ0FBQztLQUNGLENBQUM7QUFDSixDQUFDO0FBMkREOztHQUVHO0FBQ0gsU0FBZ0IsZ0JBQWdCLENBQzlCLFNBQVksRUFDWixNQUFXLEVBQ1gsT0FBbUM7SUFFbkMsT0FBTztRQUNMLEdBQUcsU0FBUztRQUNaLE9BQU8sRUFBRSxLQUFLO1FBQ2QsS0FBSyxDQUFDLEtBQUs7WUFDVCxNQUFNLE9BQU8sR0FBRyxNQUFNLE9BQU8sQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDNUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7WUFDakQsT0FBTyxJQUFTLENBQUM7UUFDbkIsQ0FBQztLQUNGLENBQUM7QUFDSixDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFnQixVQUFVLENBQUMsTUFBVyxFQUFFLE9BQWlCO0lBQ3ZELE9BQU8sTUFBTSxDQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUUsUUFBUSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEtBQUssQ0FBQztBQUM5RCxDQUFDO0FBRUQsa0JBQWUsUUFBUSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIFBhcnRpYWxzIC0gSGFuZGxlIHVuY2FjaGVkL3BhcnRpYWwgZGF0YSBzdHJ1Y3R1cmVzXHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIFBhcnRpYWwgdHlwZXMgdGhhdCBjYW4gYmUgZW5hYmxlZFxyXG4gKi9cclxuZXhwb3J0IGVudW0gUGFydGlhbHMge1xyXG4gIFVzZXIgPSAwLFxyXG4gIENoYW5uZWwgPSAxLFxyXG4gIEd1aWxkTWVtYmVyID0gMixcclxuICBNZXNzYWdlID0gMyxcclxuICBSZWFjdGlvbiA9IDQsXHJcbiAgR3VpbGRTY2hlZHVsZWRFdmVudCA9IDUsXHJcbiAgVGhyZWFkTWVtYmVyID0gNixcclxufVxyXG5cclxuLyoqXHJcbiAqIENoZWNrIGlmIGEgc3RydWN0dXJlIGlzIHBhcnRpYWwgKG1pc3NpbmcgZGF0YSlcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBpc1BhcnRpYWwob2JqOiBhbnkpOiBib29sZWFuIHtcclxuICByZXR1cm4gb2JqPy5wYXJ0aWFsID09PSB0cnVlO1xyXG59XHJcblxyXG4vKipcclxuICogQ3JlYXRlIGEgcGFydGlhbCB1c2VyIHN0cnVjdHVyZVxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVBhcnRpYWxVc2VyKGlkOiBzdHJpbmcpOiBQYXJ0aWFsVXNlciB7XHJcbiAgcmV0dXJuIHtcclxuICAgIGlkLFxyXG4gICAgcGFydGlhbDogdHJ1ZSxcclxuICAgIHVzZXJuYW1lOiBudWxsLFxyXG4gICAgZGlzY3JpbWluYXRvcjogbnVsbCxcclxuICAgIGF2YXRhcjogbnVsbCxcclxuICAgIGJvdDogbnVsbCxcclxuICAgIFxyXG4gICAgYXN5bmMgZmV0Y2goKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IGZldGNoIHBhcnRpYWwgdXNlciB3aXRob3V0IGNsaWVudCBjb250ZXh0Jyk7XHJcbiAgICB9LFxyXG4gICAgXHJcbiAgICB0b1N0cmluZygpIHtcclxuICAgICAgcmV0dXJuIGA8QCR7aWR9PmA7XHJcbiAgICB9LFxyXG4gIH07XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDcmVhdGUgYSBwYXJ0aWFsIGNoYW5uZWwgc3RydWN0dXJlXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlUGFydGlhbENoYW5uZWwoaWQ6IHN0cmluZyk6IFBhcnRpYWxDaGFubmVsIHtcclxuICByZXR1cm4ge1xyXG4gICAgaWQsXHJcbiAgICBwYXJ0aWFsOiB0cnVlLFxyXG4gICAgdHlwZTogbnVsbCxcclxuICAgIG5hbWU6IG51bGwsXHJcbiAgICBcclxuICAgIGFzeW5jIGZldGNoKCkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBmZXRjaCBwYXJ0aWFsIGNoYW5uZWwgd2l0aG91dCBjbGllbnQgY29udGV4dCcpO1xyXG4gICAgfSxcclxuICAgIFxyXG4gICAgdG9TdHJpbmcoKSB7XHJcbiAgICAgIHJldHVybiBgPCMke2lkfT5gO1xyXG4gICAgfSxcclxuICB9O1xyXG59XHJcblxyXG4vKipcclxuICogQ3JlYXRlIGEgcGFydGlhbCBtZXNzYWdlIHN0cnVjdHVyZVxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVBhcnRpYWxNZXNzYWdlKGlkOiBzdHJpbmcsIGNoYW5uZWxJZDogc3RyaW5nKTogUGFydGlhbE1lc3NhZ2Uge1xyXG4gIHJldHVybiB7XHJcbiAgICBpZCxcclxuICAgIGNoYW5uZWxJZCxcclxuICAgIHBhcnRpYWw6IHRydWUsXHJcbiAgICBjb250ZW50OiBudWxsLFxyXG4gICAgYXV0aG9yOiBudWxsLFxyXG4gICAgZW1iZWRzOiBudWxsLFxyXG4gICAgYXR0YWNobWVudHM6IG51bGwsXHJcbiAgICBcclxuICAgIGFzeW5jIGZldGNoKCkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBmZXRjaCBwYXJ0aWFsIG1lc3NhZ2Ugd2l0aG91dCBjbGllbnQgY29udGV4dCcpO1xyXG4gICAgfSxcclxuICAgIFxyXG4gICAgdG9TdHJpbmcoKSB7XHJcbiAgICAgIHJldHVybiBgTWVzc2FnZSgke2lkfSlgO1xyXG4gICAgfSxcclxuICB9O1xyXG59XHJcblxyXG4vKipcclxuICogQ3JlYXRlIGEgcGFydGlhbCBndWlsZCBtZW1iZXIgc3RydWN0dXJlXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlUGFydGlhbEd1aWxkTWVtYmVyKHVzZXJJZDogc3RyaW5nLCBndWlsZElkOiBzdHJpbmcpOiBQYXJ0aWFsR3VpbGRNZW1iZXIge1xyXG4gIHJldHVybiB7XHJcbiAgICBpZDogdXNlcklkLFxyXG4gICAgZ3VpbGRJZCxcclxuICAgIHBhcnRpYWw6IHRydWUsXHJcbiAgICB1c2VyOiBudWxsLFxyXG4gICAgbmljazogbnVsbCxcclxuICAgIHJvbGVzOiBudWxsLFxyXG4gICAgam9pbmVkQXQ6IG51bGwsXHJcbiAgICBcclxuICAgIGFzeW5jIGZldGNoKCkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBmZXRjaCBwYXJ0aWFsIG1lbWJlciB3aXRob3V0IGNsaWVudCBjb250ZXh0Jyk7XHJcbiAgICB9LFxyXG4gICAgXHJcbiAgICB0b1N0cmluZygpIHtcclxuICAgICAgcmV0dXJuIGA8QCR7dXNlcklkfT5gO1xyXG4gICAgfSxcclxuICB9O1xyXG59XHJcblxyXG4vKipcclxuICogQ3JlYXRlIGEgcGFydGlhbCByZWFjdGlvbiBzdHJ1Y3R1cmVcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVQYXJ0aWFsUmVhY3Rpb24obWVzc2FnZUlkOiBzdHJpbmcsIGVtb2ppOiBzdHJpbmcpOiBQYXJ0aWFsUmVhY3Rpb24ge1xyXG4gIHJldHVybiB7XHJcbiAgICBtZXNzYWdlSWQsXHJcbiAgICBlbW9qaSxcclxuICAgIHBhcnRpYWw6IHRydWUsXHJcbiAgICBjb3VudDogbnVsbCxcclxuICAgIG1lOiBudWxsLFxyXG4gICAgXHJcbiAgICBhc3luYyBmZXRjaCgpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgZmV0Y2ggcGFydGlhbCByZWFjdGlvbiB3aXRob3V0IGNsaWVudCBjb250ZXh0Jyk7XHJcbiAgICB9LFxyXG4gICAgXHJcbiAgICB0b1N0cmluZygpIHtcclxuICAgICAgcmV0dXJuIGVtb2ppO1xyXG4gICAgfSxcclxuICB9O1xyXG59XHJcblxyXG4vKipcclxuICogUGFydGlhbCBzdHJ1Y3R1cmUgdHlwZXNcclxuICovXHJcbmV4cG9ydCBpbnRlcmZhY2UgUGFydGlhbFVzZXIge1xyXG4gIGlkOiBzdHJpbmc7XHJcbiAgcGFydGlhbDogdHJ1ZTtcclxuICB1c2VybmFtZTogc3RyaW5nIHwgbnVsbDtcclxuICBkaXNjcmltaW5hdG9yOiBzdHJpbmcgfCBudWxsO1xyXG4gIGF2YXRhcjogc3RyaW5nIHwgbnVsbDtcclxuICBib3Q6IGJvb2xlYW4gfCBudWxsO1xyXG4gIGZldGNoKCk6IFByb21pc2U8YW55PjtcclxuICB0b1N0cmluZygpOiBzdHJpbmc7XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgUGFydGlhbENoYW5uZWwge1xyXG4gIGlkOiBzdHJpbmc7XHJcbiAgcGFydGlhbDogdHJ1ZTtcclxuICB0eXBlOiBudW1iZXIgfCBudWxsO1xyXG4gIG5hbWU6IHN0cmluZyB8IG51bGw7XHJcbiAgZmV0Y2goKTogUHJvbWlzZTxhbnk+O1xyXG4gIHRvU3RyaW5nKCk6IHN0cmluZztcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBQYXJ0aWFsTWVzc2FnZSB7XHJcbiAgaWQ6IHN0cmluZztcclxuICBjaGFubmVsSWQ6IHN0cmluZztcclxuICBwYXJ0aWFsOiB0cnVlO1xyXG4gIGNvbnRlbnQ6IHN0cmluZyB8IG51bGw7XHJcbiAgYXV0aG9yOiBhbnkgfCBudWxsO1xyXG4gIGVtYmVkczogYW55W10gfCBudWxsO1xyXG4gIGF0dGFjaG1lbnRzOiBhbnlbXSB8IG51bGw7XHJcbiAgZmV0Y2goKTogUHJvbWlzZTxhbnk+O1xyXG4gIHRvU3RyaW5nKCk6IHN0cmluZztcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBQYXJ0aWFsR3VpbGRNZW1iZXIge1xyXG4gIGlkOiBzdHJpbmc7XHJcbiAgZ3VpbGRJZDogc3RyaW5nO1xyXG4gIHBhcnRpYWw6IHRydWU7XHJcbiAgdXNlcjogYW55IHwgbnVsbDtcclxuICBuaWNrOiBzdHJpbmcgfCBudWxsO1xyXG4gIHJvbGVzOiBzdHJpbmdbXSB8IG51bGw7XHJcbiAgam9pbmVkQXQ6IERhdGUgfCBudWxsO1xyXG4gIGZldGNoKCk6IFByb21pc2U8YW55PjtcclxuICB0b1N0cmluZygpOiBzdHJpbmc7XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgUGFydGlhbFJlYWN0aW9uIHtcclxuICBtZXNzYWdlSWQ6IHN0cmluZztcclxuICBlbW9qaTogc3RyaW5nO1xyXG4gIHBhcnRpYWw6IHRydWU7XHJcbiAgY291bnQ6IG51bWJlciB8IG51bGw7XHJcbiAgbWU6IGJvb2xlYW4gfCBudWxsO1xyXG4gIGZldGNoKCk6IFByb21pc2U8YW55PjtcclxuICB0b1N0cmluZygpOiBzdHJpbmc7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBNYWtlIGEgc3RydWN0dXJlIHBhcnRpYWwtYXdhcmUgd2l0aCBmZXRjaCBjYXBhYmlsaXR5XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gbWFrZVBhcnRpYWxBd2FyZTxUIGV4dGVuZHMgeyBpZDogc3RyaW5nIH0+KFxyXG4gIHN0cnVjdHVyZTogVCxcclxuICBjbGllbnQ6IGFueSxcclxuICBmZXRjaEZuOiAoaWQ6IHN0cmluZykgPT4gUHJvbWlzZTxUPlxyXG4pOiBUICYgeyBwYXJ0aWFsOiBib29sZWFuOyBmZXRjaDogKCkgPT4gUHJvbWlzZTxUPiB9IHtcclxuICByZXR1cm4ge1xyXG4gICAgLi4uc3RydWN0dXJlLFxyXG4gICAgcGFydGlhbDogZmFsc2UsXHJcbiAgICBhc3luYyBmZXRjaCgpIHtcclxuICAgICAgY29uc3QgZmV0Y2hlZCA9IGF3YWl0IGZldGNoRm4oc3RydWN0dXJlLmlkKTtcclxuICAgICAgT2JqZWN0LmFzc2lnbih0aGlzLCBmZXRjaGVkLCB7IHBhcnRpYWw6IGZhbHNlIH0pO1xyXG4gICAgICByZXR1cm4gdGhpcyBhcyBUO1xyXG4gICAgfSxcclxuICB9O1xyXG59XHJcblxyXG4vKipcclxuICogQ2hlY2sgaWYgcGFydGlhbHMgYXJlIGVuYWJsZWQgZm9yIGEgdHlwZVxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGhhc1BhcnRpYWwoY2xpZW50OiBhbnksIHBhcnRpYWw6IFBhcnRpYWxzKTogYm9vbGVhbiB7XHJcbiAgcmV0dXJuIGNsaWVudC5vcHRpb25zPy5wYXJ0aWFscz8uaW5jbHVkZXMocGFydGlhbCkgPz8gZmFsc2U7XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IFBhcnRpYWxzO1xyXG4iXX0=