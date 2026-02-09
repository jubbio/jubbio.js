"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DMChannel = exports.VoiceChannel = exports.TextChannel = exports.BaseChannel = void 0;
exports.createChannel = createChannel;
const enums_1 = require("../enums");
const Message_1 = require("./Message");
const Collection_1 = require("./Collection");
const Collector_1 = require("../utils/Collector");
/**
 * Base channel class
 */
class BaseChannel {
    /** Reference to the client */
    client;
    /** Channel ID */
    id;
    /** Channel type */
    type;
    constructor(client, data) {
        this.client = client;
        this.id = data.id;
        this.type = data.type;
    }
    /**
     * Check if this is a text-based channel
     */
    isTextBased() {
        return [
            enums_1.ChannelType.GuildText,
            enums_1.ChannelType.DM,
            enums_1.ChannelType.GroupDM,
            enums_1.ChannelType.GuildAnnouncement
        ].includes(this.type);
    }
    /**
     * Check if this is a voice-based channel
     */
    isVoiceBased() {
        return [
            enums_1.ChannelType.GuildVoice,
            enums_1.ChannelType.GuildStageVoice
        ].includes(this.type);
    }
    /**
     * Convert to string (mention format)
     */
    toString() {
        return `<#${this.id}>`;
    }
}
exports.BaseChannel = BaseChannel;
/**
 * Text channel
 */
class TextChannel extends BaseChannel {
    /** Guild ID */
    guildId;
    /** Channel name */
    name;
    /** Channel topic */
    topic;
    /** Channel position */
    position;
    /** Parent category ID */
    parentId;
    constructor(client, data) {
        super(client, data);
        this.guildId = data.guild_id;
        this.name = data.name;
        this.topic = data.topic;
        this.position = data.position;
        this.parentId = data.parent_id;
    }
    /**
     * Send a message to this channel
     */
    async send(options) {
        const content = typeof options === 'string' ? options : options.content;
        const embeds = typeof options === 'string' ? undefined : options.embeds;
        const data = await this.client.rest.createMessage(this.guildId || '', this.id, {
            content,
            embeds
        });
        return new Message_1.Message(this.client, data);
    }
    /**
     * Create a message collector
     */
    createMessageCollector(options) {
        return new Collector_1.MessageCollector(this.client, this.id, options);
    }
    /**
     * Await messages in this channel
     */
    awaitMessages(options) {
        return new Promise((resolve, reject) => {
            const collector = this.createMessageCollector(options);
            collector.once('end', (collected, reason) => {
                if (options?.errors?.includes(reason)) {
                    reject(collected);
                }
                else {
                    resolve(collected);
                }
            });
        });
    }
    /**
     * Bulk delete messages
     */
    async bulkDelete(messages, filterOld = true) {
        let messageIds;
        if (typeof messages === 'number') {
            // Fetch messages first
            const fetched = await this.client.rest.getMessages(this.guildId || '', this.id, { limit: messages });
            messageIds = fetched.map(m => m.id);
        }
        else if (messages instanceof Collection_1.Collection) {
            messageIds = [...messages.keys()];
        }
        else {
            messageIds = messages;
        }
        // Filter old messages (older than 14 days)
        if (filterOld) {
            const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
            messageIds = messageIds.filter(id => {
                // Extract timestamp from snowflake
                const timestamp = Number(BigInt(id) >> 22n) + 1420070400000;
                return timestamp > twoWeeksAgo;
            });
        }
        if (messageIds.length === 0) {
            return new Collection_1.Collection();
        }
        if (messageIds.length === 1) {
            await this.client.rest.deleteMessage(this.guildId || '', this.id, messageIds[0]);
        }
        else {
            await this.client.rest.bulkDeleteMessages(this.guildId || '', this.id, messageIds);
        }
        // Return deleted messages as collection
        const deleted = new Collection_1.Collection();
        // Note: We don't have the actual message objects here
        return deleted;
    }
}
exports.TextChannel = TextChannel;
/**
 * Voice channel
 */
class VoiceChannel extends BaseChannel {
    /** Guild ID */
    guildId;
    /** Channel name */
    name;
    /** Channel position */
    position;
    /** Parent category ID */
    parentId;
    /** User limit */
    userLimit;
    /** Bitrate */
    bitrate;
    constructor(client, data) {
        super(client, data);
        this.guildId = data.guild_id;
        this.name = data.name;
        this.position = data.position;
        this.parentId = data.parent_id;
        this.userLimit = data.user_limit;
        this.bitrate = data.bitrate;
    }
    /**
     * Check if the channel is joinable
     */
    get joinable() {
        // TODO: Check permissions
        return true;
    }
}
exports.VoiceChannel = VoiceChannel;
/**
 * DM channel
 */
class DMChannel extends BaseChannel {
    /** Recipient user ID */
    recipientId;
    constructor(client, data) {
        super(client, data);
        this.recipientId = data.recipient_id;
    }
    /**
     * Send a message to this DM
     */
    async send(options) {
        const content = typeof options === 'string' ? options : options.content;
        const embeds = typeof options === 'string' ? undefined : options.embeds;
        const data = await this.client.rest.createDMMessage(this.id, {
            content,
            embeds
        });
        return new Message_1.Message(this.client, data);
    }
}
exports.DMChannel = DMChannel;
/**
 * Create appropriate channel class based on type
 */
function createChannel(client, data) {
    switch (data.type) {
        case enums_1.ChannelType.GuildText:
        case enums_1.ChannelType.GuildAnnouncement:
            return new TextChannel(client, data);
        case enums_1.ChannelType.GuildVoice:
        case enums_1.ChannelType.GuildStageVoice:
            return new VoiceChannel(client, data);
        case enums_1.ChannelType.DM:
            return new DMChannel(client, data);
        default:
            return new BaseChannel(client, data);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ2hhbm5lbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zdHJ1Y3R1cmVzL0NoYW5uZWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBK1BBLHNDQWFDO0FBM1FELG9DQUF1QztBQUV2Qyx1Q0FBb0M7QUFDcEMsNkNBQTBDO0FBQzFDLGtEQUErRTtBQVUvRTs7R0FFRztBQUNILE1BQWEsV0FBVztJQUN0Qiw4QkFBOEI7SUFDZCxNQUFNLENBQVM7SUFFL0IsaUJBQWlCO0lBQ0QsRUFBRSxDQUFTO0lBRTNCLG1CQUFtQjtJQUNILElBQUksQ0FBYztJQUVsQyxZQUFZLE1BQWMsRUFBRSxJQUFnQjtRQUMxQyxJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztRQUNyQixJQUFJLENBQUMsRUFBRSxHQUFHLElBQUksQ0FBQyxFQUFFLENBQUM7UUFDbEIsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO0lBQ3hCLENBQUM7SUFFRDs7T0FFRztJQUNILFdBQVc7UUFDVCxPQUFPO1lBQ0wsbUJBQVcsQ0FBQyxTQUFTO1lBQ3JCLG1CQUFXLENBQUMsRUFBRTtZQUNkLG1CQUFXLENBQUMsT0FBTztZQUNuQixtQkFBVyxDQUFDLGlCQUFpQjtTQUM5QixDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDeEIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsWUFBWTtRQUNWLE9BQU87WUFDTCxtQkFBVyxDQUFDLFVBQVU7WUFDdEIsbUJBQVcsQ0FBQyxlQUFlO1NBQzVCLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN4QixDQUFDO0lBRUQ7O09BRUc7SUFDSCxRQUFRO1FBQ04sT0FBTyxLQUFLLElBQUksQ0FBQyxFQUFFLEdBQUcsQ0FBQztJQUN6QixDQUFDO0NBQ0Y7QUE1Q0Qsa0NBNENDO0FBRUQ7O0dBRUc7QUFDSCxNQUFhLFdBQVksU0FBUSxXQUFXO0lBQzFD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RUFBRSxJQUFJLENBQUMsQ0FBQztRQUNyQztZQUNFLE9BQU8sSUFBSSxXQUFXLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ3pDLENBQUM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQVBJQ2hhbm5lbCwgQVBJTWVzc2FnZSwgQVBJRW1iZWQgfSBmcm9tICcuLi90eXBlcyc7XHJcbmltcG9ydCB7IENoYW5uZWxUeXBlIH0gZnJvbSAnLi4vZW51bXMnO1xyXG5pbXBvcnQgdHlwZSB7IENsaWVudCB9IGZyb20gJy4uL0NsaWVudCc7XHJcbmltcG9ydCB7IE1lc3NhZ2UgfSBmcm9tICcuL01lc3NhZ2UnO1xyXG5pbXBvcnQgeyBDb2xsZWN0aW9uIH0gZnJvbSAnLi9Db2xsZWN0aW9uJztcclxuaW1wb3J0IHsgTWVzc2FnZUNvbGxlY3RvciwgTWVzc2FnZUNvbGxlY3Rvck9wdGlvbnMgfSBmcm9tICcuLi91dGlscy9Db2xsZWN0b3InO1xyXG5cclxuLyoqXHJcbiAqIEF3YWl0IG1lc3NhZ2VzIG9wdGlvbnNcclxuICovXHJcbmV4cG9ydCBpbnRlcmZhY2UgQXdhaXRNZXNzYWdlc09wdGlvbnMgZXh0ZW5kcyBNZXNzYWdlQ29sbGVjdG9yT3B0aW9ucyB7XHJcbiAgLyoqIEVycm9ycyB0byByZWplY3Qgb24gKi9cclxuICBlcnJvcnM/OiBzdHJpbmdbXTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEJhc2UgY2hhbm5lbCBjbGFzc1xyXG4gKi9cclxuZXhwb3J0IGNsYXNzIEJhc2VDaGFubmVsIHtcclxuICAvKiogUmVmZXJlbmNlIHRvIHRoZSBjbGllbnQgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgY2xpZW50OiBDbGllbnQ7XHJcbiAgXHJcbiAgLyoqIENoYW5uZWwgSUQgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgaWQ6IHN0cmluZztcclxuICBcclxuICAvKiogQ2hhbm5lbCB0eXBlICovXHJcbiAgcHVibGljIHJlYWRvbmx5IHR5cGU6IENoYW5uZWxUeXBlO1xyXG5cclxuICBjb25zdHJ1Y3RvcihjbGllbnQ6IENsaWVudCwgZGF0YTogQVBJQ2hhbm5lbCkge1xyXG4gICAgdGhpcy5jbGllbnQgPSBjbGllbnQ7XHJcbiAgICB0aGlzLmlkID0gZGF0YS5pZDtcclxuICAgIHRoaXMudHlwZSA9IGRhdGEudHlwZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENoZWNrIGlmIHRoaXMgaXMgYSB0ZXh0LWJhc2VkIGNoYW5uZWxcclxuICAgKi9cclxuICBpc1RleHRCYXNlZCgpOiB0aGlzIGlzIFRleHRDaGFubmVsIHtcclxuICAgIHJldHVybiBbXHJcbiAgICAgIENoYW5uZWxUeXBlLkd1aWxkVGV4dCxcclxuICAgICAgQ2hhbm5lbFR5cGUuRE0sXHJcbiAgICAgIENoYW5uZWxUeXBlLkdyb3VwRE0sXHJcbiAgICAgIENoYW5uZWxUeXBlLkd1aWxkQW5ub3VuY2VtZW50XHJcbiAgICBdLmluY2x1ZGVzKHRoaXMudHlwZSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDaGVjayBpZiB0aGlzIGlzIGEgdm9pY2UtYmFzZWQgY2hhbm5lbFxyXG4gICAqL1xyXG4gIGlzVm9pY2VCYXNlZCgpOiB0aGlzIGlzIFZvaWNlQ2hhbm5lbCB7XHJcbiAgICByZXR1cm4gW1xyXG4gICAgICBDaGFubmVsVHlwZS5HdWlsZFZvaWNlLFxyXG4gICAgICBDaGFubmVsVHlwZS5HdWlsZFN0YWdlVm9pY2VcclxuICAgIF0uaW5jbHVkZXModGhpcy50eXBlKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENvbnZlcnQgdG8gc3RyaW5nIChtZW50aW9uIGZvcm1hdClcclxuICAgKi9cclxuICB0b1N0cmluZygpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIGA8IyR7dGhpcy5pZH0+YDtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBUZXh0IGNoYW5uZWxcclxuICovXHJcbmV4cG9ydCBjbGFzcyBUZXh0Q2hhbm5lbCBleHRlbmRzIEJhc2VDaGFubmVsIHtcclxuICAvKiogR3VpbGQgSUQgKi9cclxuICBwdWJsaWMgZ3VpbGRJZD86IHN0cmluZztcclxuICBcclxuICAvKiogQ2hhbm5lbCBuYW1lICovXHJcbiAgcHVibGljIG5hbWU/OiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIENoYW5uZWwgdG9waWMgKi9cclxuICBwdWJsaWMgdG9waWM/OiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIENoYW5uZWwgcG9zaXRpb24gKi9cclxuICBwdWJsaWMgcG9zaXRpb24/OiBudW1iZXI7XHJcbiAgXHJcbiAgLyoqIFBhcmVudCBjYXRlZ29yeSBJRCAqL1xyXG4gIHB1YmxpYyBwYXJlbnRJZD86IHN0cmluZztcclxuXHJcbiAgY29uc3RydWN0b3IoY2xpZW50OiBDbGllbnQsIGRhdGE6IEFQSUNoYW5uZWwpIHtcclxuICAgIHN1cGVyKGNsaWVudCwgZGF0YSk7XHJcbiAgICB0aGlzLmd1aWxkSWQgPSBkYXRhLmd1aWxkX2lkO1xyXG4gICAgdGhpcy5uYW1lID0gZGF0YS5uYW1lO1xyXG4gICAgdGhpcy50b3BpYyA9IGRhdGEudG9waWM7XHJcbiAgICB0aGlzLnBvc2l0aW9uID0gZGF0YS5wb3NpdGlvbjtcclxuICAgIHRoaXMucGFyZW50SWQgPSBkYXRhLnBhcmVudF9pZDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNlbmQgYSBtZXNzYWdlIHRvIHRoaXMgY2hhbm5lbFxyXG4gICAqL1xyXG4gIGFzeW5jIHNlbmQob3B0aW9uczogc3RyaW5nIHwgTWVzc2FnZUNyZWF0ZU9wdGlvbnMpOiBQcm9taXNlPE1lc3NhZ2U+IHtcclxuICAgIGNvbnN0IGNvbnRlbnQgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyBvcHRpb25zIDogb3B0aW9ucy5jb250ZW50O1xyXG4gICAgY29uc3QgZW1iZWRzID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gdW5kZWZpbmVkIDogb3B0aW9ucy5lbWJlZHM7XHJcbiAgICBcclxuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LmNyZWF0ZU1lc3NhZ2UodGhpcy5ndWlsZElkIHx8ICcnLCB0aGlzLmlkLCB7XHJcbiAgICAgIGNvbnRlbnQsXHJcbiAgICAgIGVtYmVkc1xyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIHJldHVybiBuZXcgTWVzc2FnZSh0aGlzLmNsaWVudCwgZGF0YSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgYSBtZXNzYWdlIGNvbGxlY3RvclxyXG4gICAqL1xyXG4gIGNyZWF0ZU1lc3NhZ2VDb2xsZWN0b3Iob3B0aW9ucz86IE1lc3NhZ2VDb2xsZWN0b3JPcHRpb25zKTogTWVzc2FnZUNvbGxlY3RvciB7XHJcbiAgICByZXR1cm4gbmV3IE1lc3NhZ2VDb2xsZWN0b3IodGhpcy5jbGllbnQsIHRoaXMuaWQsIG9wdGlvbnMpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQXdhaXQgbWVzc2FnZXMgaW4gdGhpcyBjaGFubmVsXHJcbiAgICovXHJcbiAgYXdhaXRNZXNzYWdlcyhvcHRpb25zPzogQXdhaXRNZXNzYWdlc09wdGlvbnMpOiBQcm9taXNlPENvbGxlY3Rpb248c3RyaW5nLCBNZXNzYWdlPj4ge1xyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgY29uc3QgY29sbGVjdG9yID0gdGhpcy5jcmVhdGVNZXNzYWdlQ29sbGVjdG9yKG9wdGlvbnMpO1xyXG4gICAgICBcclxuICAgICAgY29sbGVjdG9yLm9uY2UoJ2VuZCcsIChjb2xsZWN0ZWQsIHJlYXNvbikgPT4ge1xyXG4gICAgICAgIGlmIChvcHRpb25zPy5lcnJvcnM/LmluY2x1ZGVzKHJlYXNvbikpIHtcclxuICAgICAgICAgIHJlamVjdChjb2xsZWN0ZWQpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICByZXNvbHZlKGNvbGxlY3RlZCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQnVsayBkZWxldGUgbWVzc2FnZXNcclxuICAgKi9cclxuICBhc3luYyBidWxrRGVsZXRlKG1lc3NhZ2VzOiBudW1iZXIgfCBzdHJpbmdbXSB8IENvbGxlY3Rpb248c3RyaW5nLCBNZXNzYWdlPiwgZmlsdGVyT2xkID0gdHJ1ZSk6IFByb21pc2U8Q29sbGVjdGlvbjxzdHJpbmcsIE1lc3NhZ2U+PiB7XHJcbiAgICBsZXQgbWVzc2FnZUlkczogc3RyaW5nW107XHJcbiAgICBcclxuICAgIGlmICh0eXBlb2YgbWVzc2FnZXMgPT09ICdudW1iZXInKSB7XHJcbiAgICAgIC8vIEZldGNoIG1lc3NhZ2VzIGZpcnN0XHJcbiAgICAgIGNvbnN0IGZldGNoZWQgPSBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LmdldE1lc3NhZ2VzKHRoaXMuZ3VpbGRJZCB8fCAnJywgdGhpcy5pZCwgeyBsaW1pdDogbWVzc2FnZXMgfSk7XHJcbiAgICAgIG1lc3NhZ2VJZHMgPSBmZXRjaGVkLm1hcChtID0+IG0uaWQpO1xyXG4gICAgfSBlbHNlIGlmIChtZXNzYWdlcyBpbnN0YW5jZW9mIENvbGxlY3Rpb24pIHtcclxuICAgICAgbWVzc2FnZUlkcyA9IFsuLi5tZXNzYWdlcy5rZXlzKCldO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgbWVzc2FnZUlkcyA9IG1lc3NhZ2VzO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIEZpbHRlciBvbGQgbWVzc2FnZXMgKG9sZGVyIHRoYW4gMTQgZGF5cylcclxuICAgIGlmIChmaWx0ZXJPbGQpIHtcclxuICAgICAgY29uc3QgdHdvV2Vla3NBZ28gPSBEYXRlLm5vdygpIC0gMTQgKiAyNCAqIDYwICogNjAgKiAxMDAwO1xyXG4gICAgICBtZXNzYWdlSWRzID0gbWVzc2FnZUlkcy5maWx0ZXIoaWQgPT4ge1xyXG4gICAgICAgIC8vIEV4dHJhY3QgdGltZXN0YW1wIGZyb20gc25vd2ZsYWtlXHJcbiAgICAgICAgY29uc3QgdGltZXN0YW1wID0gTnVtYmVyKEJpZ0ludChpZCkgPj4gMjJuKSArIDE0MjAwNzA0MDAwMDA7XHJcbiAgICAgICAgcmV0dXJuIHRpbWVzdGFtcCA+IHR3b1dlZWtzQWdvO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAobWVzc2FnZUlkcy5sZW5ndGggPT09IDApIHtcclxuICAgICAgcmV0dXJuIG5ldyBDb2xsZWN0aW9uKCk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKG1lc3NhZ2VJZHMubGVuZ3RoID09PSAxKSB7XHJcbiAgICAgIGF3YWl0IHRoaXMuY2xpZW50LnJlc3QuZGVsZXRlTWVzc2FnZSh0aGlzLmd1aWxkSWQgfHwgJycsIHRoaXMuaWQsIG1lc3NhZ2VJZHNbMF0pO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5idWxrRGVsZXRlTWVzc2FnZXModGhpcy5ndWlsZElkIHx8ICcnLCB0aGlzLmlkLCBtZXNzYWdlSWRzKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBSZXR1cm4gZGVsZXRlZCBtZXNzYWdlcyBhcyBjb2xsZWN0aW9uXHJcbiAgICBjb25zdCBkZWxldGVkID0gbmV3IENvbGxlY3Rpb248c3RyaW5nLCBNZXNzYWdlPigpO1xyXG4gICAgLy8gTm90ZTogV2UgZG9uJ3QgaGF2ZSB0aGUgYWN0dWFsIG1lc3NhZ2Ugb2JqZWN0cyBoZXJlXHJcbiAgICByZXR1cm4gZGVsZXRlZDtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBWb2ljZSBjaGFubmVsXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgVm9pY2VDaGFubmVsIGV4dGVuZHMgQmFzZUNoYW5uZWwge1xyXG4gIC8qKiBHdWlsZCBJRCAqL1xyXG4gIHB1YmxpYyBndWlsZElkPzogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBDaGFubmVsIG5hbWUgKi9cclxuICBwdWJsaWMgbmFtZT86IHN0cmluZztcclxuICBcclxuICAvKiogQ2hhbm5lbCBwb3NpdGlvbiAqL1xyXG4gIHB1YmxpYyBwb3NpdGlvbj86IG51bWJlcjtcclxuICBcclxuICAvKiogUGFyZW50IGNhdGVnb3J5IElEICovXHJcbiAgcHVibGljIHBhcmVudElkPzogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBVc2VyIGxpbWl0ICovXHJcbiAgcHVibGljIHVzZXJMaW1pdD86IG51bWJlcjtcclxuICBcclxuICAvKiogQml0cmF0ZSAqL1xyXG4gIHB1YmxpYyBiaXRyYXRlPzogbnVtYmVyO1xyXG5cclxuICBjb25zdHJ1Y3RvcihjbGllbnQ6IENsaWVudCwgZGF0YTogQVBJQ2hhbm5lbCAmIHsgdXNlcl9saW1pdD86IG51bWJlcjsgYml0cmF0ZT86IG51bWJlciB9KSB7XHJcbiAgICBzdXBlcihjbGllbnQsIGRhdGEpO1xyXG4gICAgdGhpcy5ndWlsZElkID0gZGF0YS5ndWlsZF9pZDtcclxuICAgIHRoaXMubmFtZSA9IGRhdGEubmFtZTtcclxuICAgIHRoaXMucG9zaXRpb24gPSBkYXRhLnBvc2l0aW9uO1xyXG4gICAgdGhpcy5wYXJlbnRJZCA9IGRhdGEucGFyZW50X2lkO1xyXG4gICAgdGhpcy51c2VyTGltaXQgPSBkYXRhLnVzZXJfbGltaXQ7XHJcbiAgICB0aGlzLmJpdHJhdGUgPSBkYXRhLmJpdHJhdGU7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDaGVjayBpZiB0aGUgY2hhbm5lbCBpcyBqb2luYWJsZVxyXG4gICAqL1xyXG4gIGdldCBqb2luYWJsZSgpOiBib29sZWFuIHtcclxuICAgIC8vIFRPRE86IENoZWNrIHBlcm1pc3Npb25zXHJcbiAgICByZXR1cm4gdHJ1ZTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBETSBjaGFubmVsXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgRE1DaGFubmVsIGV4dGVuZHMgQmFzZUNoYW5uZWwge1xyXG4gIC8qKiBSZWNpcGllbnQgdXNlciBJRCAqL1xyXG4gIHB1YmxpYyByZWNpcGllbnRJZD86IHN0cmluZztcclxuXHJcbiAgY29uc3RydWN0b3IoY2xpZW50OiBDbGllbnQsIGRhdGE6IEFQSUNoYW5uZWwgJiB7IHJlY2lwaWVudF9pZD86IHN0cmluZyB9KSB7XHJcbiAgICBzdXBlcihjbGllbnQsIGRhdGEpO1xyXG4gICAgdGhpcy5yZWNpcGllbnRJZCA9IGRhdGEucmVjaXBpZW50X2lkO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2VuZCBhIG1lc3NhZ2UgdG8gdGhpcyBETVxyXG4gICAqL1xyXG4gIGFzeW5jIHNlbmQob3B0aW9uczogc3RyaW5nIHwgTWVzc2FnZUNyZWF0ZU9wdGlvbnMpOiBQcm9taXNlPE1lc3NhZ2U+IHtcclxuICAgIGNvbnN0IGNvbnRlbnQgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyBvcHRpb25zIDogb3B0aW9ucy5jb250ZW50O1xyXG4gICAgY29uc3QgZW1iZWRzID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gdW5kZWZpbmVkIDogb3B0aW9ucy5lbWJlZHM7XHJcbiAgICBcclxuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LmNyZWF0ZURNTWVzc2FnZSh0aGlzLmlkLCB7XHJcbiAgICAgIGNvbnRlbnQsXHJcbiAgICAgIGVtYmVkc1xyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIHJldHVybiBuZXcgTWVzc2FnZSh0aGlzLmNsaWVudCwgZGF0YSk7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogTWVzc2FnZSBjcmVhdGUgb3B0aW9uc1xyXG4gKi9cclxuZXhwb3J0IGludGVyZmFjZSBNZXNzYWdlQ3JlYXRlT3B0aW9ucyB7XHJcbiAgY29udGVudD86IHN0cmluZztcclxuICBlbWJlZHM/OiBBUElFbWJlZFtdO1xyXG4gIGZpbGVzPzogYW55W107XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDcmVhdGUgYXBwcm9wcmlhdGUgY2hhbm5lbCBjbGFzcyBiYXNlZCBvbiB0eXBlXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ2hhbm5lbChjbGllbnQ6IENsaWVudCwgZGF0YTogQVBJQ2hhbm5lbCk6IEJhc2VDaGFubmVsIHtcclxuICBzd2l0Y2ggKGRhdGEudHlwZSkge1xyXG4gICAgY2FzZSBDaGFubmVsVHlwZS5HdWlsZFRleHQ6XHJcbiAgICBjYXNlIENoYW5uZWxUeXBlLkd1aWxkQW5ub3VuY2VtZW50OlxyXG4gICAgICByZXR1cm4gbmV3IFRleHRDaGFubmVsKGNsaWVudCwgZGF0YSk7XHJcbiAgICBjYXNlIENoYW5uZWxUeXBlLkd1aWxkVm9pY2U6XHJcbiAgICBjYXNlIENoYW5uZWxUeXBlLkd1aWxkU3RhZ2VWb2ljZTpcclxuICAgICAgcmV0dXJuIG5ldyBWb2ljZUNoYW5uZWwoY2xpZW50LCBkYXRhKTtcclxuICAgIGNhc2UgQ2hhbm5lbFR5cGUuRE06XHJcbiAgICAgIHJldHVybiBuZXcgRE1DaGFubmVsKGNsaWVudCwgZGF0YSk7XHJcbiAgICBkZWZhdWx0OlxyXG4gICAgICByZXR1cm4gbmV3IEJhc2VDaGFubmVsKGNsaWVudCwgZGF0YSk7XHJcbiAgfVxyXG59XHJcbiJdfQ==