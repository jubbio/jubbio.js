"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DMChannel = exports.VoiceChannel = exports.TextChannel = exports.BaseChannel = void 0;
exports.createChannel = createChannel;
const enums_1 = require("../enums");
const Message_1 = require("./Message");
const Collection_1 = require("./Collection");
const Collector_1 = require("../utils/Collector");
const EmbedBuilder_1 = require("../builders/EmbedBuilder");
/** Resolve EmbedBuilder instances to plain API objects */
function resolveEmbeds(embeds) {
    if (!embeds)
        return undefined;
    return embeds.map(e => e instanceof EmbedBuilder_1.EmbedBuilder ? e.toJSON() : e);
}
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
     * Check if this is a category channel
     */
    isCategory() {
        return this.type === enums_1.ChannelType.GuildCategory;
    }
    /**
     * Check if this is a forum channel
     */
    isForum() {
        return this.type === enums_1.ChannelType.GuildForum;
    }
    /**
     * Check if this is a thread channel
     */
    isThread() {
        return [
            enums_1.ChannelType.PublicThread,
            enums_1.ChannelType.PrivateThread,
            enums_1.ChannelType.AnnouncementThread
        ].includes(this.type);
    }
    /**
     * Check if this is an announcement channel
     */
    isAnnouncement() {
        return this.type === enums_1.ChannelType.GuildAnnouncement;
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
     * Bug #8 fix - embed tekil kullanımı, Bug #10 fix - flags desteği
     */
    async send(options) {
        const content = typeof options === 'string' ? options : options.content;
        // Bug #8 fix - embed tekil kullanımı desteklenir
        const rawEmbeds = typeof options === 'string'
            ? undefined
            : (options.embeds || (options.embed ? [options.embed] : undefined));
        const embeds = resolveEmbeds(rawEmbeds);
        const components = typeof options === 'string' ? undefined : options.components;
        const files = typeof options === 'string' ? undefined : options.files;
        const flags = typeof options === 'string' ? undefined : options.flags;
        // Dosya varsa createMessageWithFile kullan
        if (files && files.length > 0 && this.guildId) {
            const file = files[0]; // Şimdilik tek dosya desteği
            const data = await this.client.rest.createMessageWithFile(this.guildId, this.id, {
                content,
                embeds,
                components,
                file,
                flags
            });
            return new Message_1.Message(this.client, data);
        }
        const data = await this.client.rest.createMessage(this.guildId || '', this.id, {
            content,
            embeds,
            components,
            flags,
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
     * Check if the bot can join this voice channel
     * Returns false if:
     * - Missing guild or user reference
     * - Bot lacks Connect permission
     * - Channel is at user limit capacity
     */
    get joinable() {
        if (!this.guildId || !this.client.user)
            return false;
        const guild = this.client.guilds.get(this.guildId);
        if (!guild)
            return false;
        const me = guild.members.get(String(this.client.user.id));
        if (!me)
            return true; // No cached member — optimistic, server will reject if not allowed
        if (!me.permissions.has('Connect'))
            return false;
        // Check user limit (0 = unlimited)
        if (this.userLimit && this.userLimit > 0) {
            const membersInChannel = guild.members.filter(m => m.voice?.channelId === this.id).size;
            if (membersInChannel >= this.userLimit)
                return false;
        }
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
        const data = typeof options === 'string' ? { content: options } : {
            content: options.content,
            embeds: resolveEmbeds(options.embeds ?? (options.embed ? [options.embed] : undefined)),
            flags: options.flags,
            components: options.components
        };
        const files = typeof options === 'string' ? undefined : options.files;
        const message = files?.length
            ? await this.client.rest.createDMMessageToChannelWithFile(this.id, data, files)
            : await this.client.rest.createDMMessageToChannel(this.id, data);
        return new Message_1.Message(this.client, message);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ2hhbm5lbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zdHJ1Y3R1cmVzL0NoYW5uZWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBbVZBLHNDQWFDO0FBL1ZELG9DQUF1QztBQUV2Qyx1Q0FBb0M7QUFDcEMsNkNBQTBDO0FBQzFDLGtEQUErRTtBQUMvRSwyREFBcUY7QUFFckYsMERBQTBEO0FBQzFELFNBQVMsYUFBYSxDQUFDLE1BQTJDO0lBQ2hFLElBQUksQ0FBQyxNQUFNO1FBQUUsT0FBTyxTQUFTLENBQUM7SUFDOUIsT0FBTyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxZQUFZLDJCQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDckUsQ0FBQztBQVVEOztHQUVHO0FBQ0gsTUFBYSxXQUFXO0lBQ3RCLDhCQUE4QjtJQUNkLE1BQU0sQ0FBUztJQUUvQixpQkFBaUI7SUFDRCxFQUFFLENBQVM7SUFFM0IsbUJBQW1CO0lBQ0gsSUFBSSxDQUFjO0lBRWxDLFlBQVksTUFBYyxFQUFFLElBQWdCO1FBQzFDLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1FBQ3JCLElBQUksQ0FBQyxFQUFFLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQztRQUNsQixJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7SUFDeEIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsV0FBVztRQUNULE9BQU87WUFDTCxtQkFBVyxDQUFDLFNBQVM7WUFDckIsbUJBQVcsQ0FBQyxFQUFFO1lBQ2QsbUJBQVcsQ0FBQyxPQUFPO1lBQ25CLG1CQUFXLENBQUMsaUJBQWlCO1NBQzlCLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN4QixDQUFDO0lBRUQ7O09BRUc7SUFDSCxZQUFZO1FBQ1YsT0FBTztZQUNMLG1CQUFXLENBQUMsVUFBVTtZQUN0QixtQkFBVyxDQUFDLGVBQWU7U0FDNUIsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3hCLENBQUM7SUFFRDs7T0FFRztJQUNILFVBQVU7UUFDUixPQUFPLElBQUksQ0FBQyxJQUFJLEtBQUssbUJBQVcsQ0FBQyxhQUFhLENBQUM7SUFDakQsQ0FBQztJQUVEOztPQUVHO0lBQ0gsT0FBTztRQUNMLE9BQU8sSUFBSSxDQUFDLElBQUksS0FBSyxtQkFBVyxDQUFDLFVBQVUsQ0FBQztJQUM5QyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxRQUFRO1FBQ04sT0FBTztZQUNMLG1CQUFXLENBQUMsWUFBWTtZQUN4QixtQkFBVyxDQUFDLGFBQWE7WUFDekIsbUJBQVcsQ0FBQyxrQkFBa0I7U0FDL0IsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3hCLENBQUM7SUFFRDs7T0FFRztJQUNILGNBQWM7UUFDWixPQUFPLElBQUksQ0FBQyxJQUFJLEtBQUssbUJBQVcsQ0FBQyxpQkFBaUIsQ0FBQztJQUNyRCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxRQUFRO1FBQ04sT0FBTyxLQUFLLElBQUksQ0FBQyxFQUFFLEdBQUcsQ0FBQztJQUN6QixDQUFDO0NBQ0Y7QUE1RUQsa0NBNEVDO0FBRUQ7O0dBRUc7QUFDSCxNQUFhLFdBQVksU0FBUSxXQUFXO0lBQzFDLGVBQWU7SUFDUixPQUFPLENBQVU7SUFFeEIsbUJBQW1CO0lBQ1osSUFBSSxDQUFVO0lBRXJCLG9CQUFvQjtJQUNiLEtBQUssQ0FBVTtJQUV0Qix1QkFBdUI7SUFDaEIsUUFBUSxDQUFVO0lBRXpCLHlCQUF5QjtJQUNsQixRQUFRLENBQVU7SUFFekIsWUFBWSxNQUFjLEVBQUUsSUFBZ0I7UUFDMUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNwQixJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUM7UUFDN0IsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO1FBQ3RCLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQztRQUN4QixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUM7UUFDOUIsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO0lBQ2pDLENBQUM7SUFFRDs7O09BR0c7SUFDSCxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQXNDO1FBQy9DLE1BQU0sT0FBTyxHQUFHLE9BQU8sT0FBTyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDO1FBQ3hFLGlEQUFpRDtRQUNqRCxNQUFNLFNBQVMsR0FBRyxPQUFPLE9BQU8sS0FBSyxRQUFRO1lBQzNDLENBQUMsQ0FBQyxTQUFTO1lBQ1gsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1FBQ3RFLE1BQU0sTUFBTSxHQUFHLGFBQWEsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUN4QyxNQUFNLFVBQVUsR0FBRyxPQUFPLE9BQU8sS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQztRQUNoRixNQUFNLEtBQUssR0FBRyxPQUFPLE9BQU8sS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQztRQUN0RSxNQUFNLEtBQUssR0FBRyxPQUFPLE9BQU8sS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQztRQUV0RSwyQ0FBMkM7UUFDM0MsSUFBSSxLQUFLLElBQUksS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQzlDLE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLDZCQUE2QjtZQUNwRCxNQUFNLElBQUksR0FBRyxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLEVBQUUsRUFBRTtnQkFDL0UsT0FBTztnQkFDUCxNQUFNO2dCQUNOLFVBQVU7Z0JBQ1YsSUFBSTtnQkFDSixLQUFLO2FBQ04sQ0FBQyxDQUFDO1lBQ0gsT0FBTyxJQUFJLGlCQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztRQUN4QyxDQUFDO1FBRUQsTUFBTSxJQUFJLEdBQUcsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLE9BQU8sSUFBSSxFQUFFLEVBQUUsSUFBSSxDQUFDLEVBQUUsRUFBRTtZQUM3RSxPQUFPO1lBQ1AsTUFBTTtZQUNOLFVBQVU7WUFDVixLQUFLO1NBQ04sQ0FBQyxDQUFDO1FBRUgsT0FBTyxJQUFJLGlCQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztJQUN4QyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxzQkFBc0IsQ0FBQyxPQUFpQztRQUN0RCxPQUFPLElBQUksNEJBQWdCLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsRUFBRSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQzdELENBQUM7SUFFRDs7T0FFRztJQUNILGFBQWEsQ0FBQyxPQUE4QjtRQUMxQyxPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO1lBQ3JDLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUV2RCxTQUFTLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDLFNBQVMsRUFBRSxNQUFNLEVBQUUsRUFBRTtnQkFDMUMsSUFBSSxPQUFPLEVBQUUsTUFBTSxFQUFFLFFBQVEsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO29CQUN0QyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7Z0JBQ3BCLENBQUM7cUJBQU0sQ0FBQztvQkFDTixPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7Z0JBQ3JCLENBQUM7WUFDSCxDQUFDLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLFVBQVUsQ0FBQyxRQUF5RCxFQUFFLFNBQVMsR0FBRyxJQUFJO1FBQzFGLElBQUksVUFBb0IsQ0FBQztRQUV6QixJQUFJLE9BQU8sUUFBUSxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQ2pDLHVCQUF1QjtZQUN2QixNQUFNLE9BQU8sR0FBRyxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsT0FBTyxJQUFJLEVBQUUsRUFBRSxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxDQUFDLENBQUM7WUFDckcsVUFBVSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDdEMsQ0FBQzthQUFNLElBQUksUUFBUSxZQUFZLHVCQUFVLEVBQUUsQ0FBQztZQUMxQyxVQUFVLEdBQUcsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ3BDLENBQUM7YUFBTSxDQUFDO1lBQ04sVUFBVSxHQUFHLFFBQVEsQ0FBQztRQUN4QixDQUFDO1FBRUQsMkNBQTJDO1FBQzNDLElBQUksU0FBUyxFQUFFLENBQUM7WUFDZCxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQztZQUMxRCxVQUFVLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsRUFBRTtnQkFDbEMsbUNBQW1DO2dCQUNuQyxNQUFNLFNBQVMsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxHQUFHLGFBQWEsQ0FBQztnQkFDNUQsT0FBTyxTQUFTLEdBQUcsV0FBVyxDQUFDO1lBQ2pDLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUVELElBQUksVUFBVSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUM1QixPQUFPLElBQUksdUJBQVUsRUFBRSxDQUFDO1FBQzFCLENBQUM7UUFFRCxJQUFJLFVBQVUsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDNUIsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLE9BQU8sSUFBSSxFQUFFLEVBQUUsSUFBSSxDQUFDLEVBQUUsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNuRixDQUFDO2FBQU0sQ0FBQztZQUNOLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLE9BQU8sSUFBSSxFQUFFLEVBQUUsSUFBSSxDQUFDLEVBQUUsRUFBRSxVQUFVLENBQUMsQ0FBQztRQUNyRixDQUFDO1FBRUQsd0NBQXdDO1FBQ3hDLE1BQU0sT0FBTyxHQUFHLElBQUksdUJBQVUsRUFBbUIsQ0FBQztRQUNsRCxzREFBc0Q7UUFDdEQsT0FBTyxPQUFPLENBQUM7SUFDakIsQ0FBQztDQUNGO0FBaElELGtDQWdJQztBQUVEOztHQUVHO0FBQ0gsTUFBYSxZQUFhLFNBQVEsV0FBVztJQUMzQyxlQUFlO0lBQ1IsT0FBTyxDQUFVO0lBRXhCLG1CQUFtQjtJQUNaLElBQUksQ0FBVTtJQUVyQix1QkFBdUI7SUFDaEIsUUFBUSxDQUFVO0lBRXpCLHlCQUF5QjtJQUNsQixRQUFRLENBQVU7SUFFekIsaUJBQWlCO0lBQ1YsU0FBUyxDQUFVO0lBRTFCLGNBQWM7SUFDUCxPQUFPLENBQVU7SUFFeEIsWUFBWSxNQUFjLEVBQUUsSUFBNEQ7UUFDdEYsS0FBSyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNwQixJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUM7UUFDN0IsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO1FBQ3RCLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQztRQUM5QixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7UUFDL0IsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDO1FBQ2pDLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQztJQUM5QixDQUFDO0lBRUQ7Ozs7OztPQU1HO0lBQ0gsSUFBSSxRQUFRO1FBQ1YsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUk7WUFBRSxPQUFPLEtBQUssQ0FBQztRQUNyRCxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ25ELElBQUksQ0FBQyxLQUFLO1lBQUUsT0FBTyxLQUFLLENBQUM7UUFDekIsTUFBTSxFQUFFLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDMUQsSUFBSSxDQUFDLEVBQUU7WUFBRSxPQUFPLElBQUksQ0FBQyxDQUFDLG1FQUFtRTtRQUN6RixJQUFJLENBQUMsRUFBRSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDO1lBQUUsT0FBTyxLQUFLLENBQUM7UUFFakQsbUNBQW1DO1FBQ25DLElBQUksSUFBSSxDQUFDLFNBQVMsSUFBSSxJQUFJLENBQUMsU0FBUyxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQ3pDLE1BQU0sZ0JBQWdCLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxFQUFFLFNBQVMsS0FBSyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDO1lBQ3hGLElBQUksZ0JBQWdCLElBQUksSUFBSSxDQUFDLFNBQVM7Z0JBQUUsT0FBTyxLQUFLLENBQUM7UUFDdkQsQ0FBQztRQUVELE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztDQUNGO0FBcERELG9DQW9EQztBQUVEOztHQUVHO0FBQ0gsTUFBYSxTQUFVLFNBQVEsV0FBVztJQUN4Qyx3QkFBd0I7SUFDakIsV0FBVyxDQUFVO0lBRTVCLFlBQVksTUFBYyxFQUFFLElBQTRDO1FBQ3RFLEtBQUssQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDcEIsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDO0lBQ3ZDLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBc0M7UUFDL0MsTUFBTSxJQUFJLEdBQUcsT0FBTyxPQUFPLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDaEUsT0FBTyxFQUFFLE9BQU8sQ0FBQyxPQUFPO1lBQ3hCLE1BQU0sRUFBRSxhQUFhLENBQUMsT0FBTyxDQUFDLE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUN0RixLQUFLLEVBQUUsT0FBTyxDQUFDLEtBQUs7WUFDcEIsVUFBVSxFQUFFLE9BQU8sQ0FBQyxVQUFVO1NBQy9CLENBQUM7UUFDRixNQUFNLEtBQUssR0FBRyxPQUFPLE9BQU8sS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQztRQUN0RSxNQUFNLE9BQU8sR0FBRyxLQUFLLEVBQUUsTUFBTTtZQUMzQixDQUFDLENBQUMsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxnQ0FBZ0MsQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxLQUFLLENBQUM7WUFDL0UsQ0FBQyxDQUFDLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsd0JBQXdCLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUVuRSxPQUFPLElBQUksaUJBQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQzNDLENBQUM7Q0FDRjtBQTFCRCw4QkEwQkM7QUFjRDs7R0FFRztBQUNILFNBQWdCLGFBQWEsQ0FBQyxNQUFjLEVBQUUsSUFBZ0I7SUFDNUQsUUFBUSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDbEIsS0FBSyxtQkFBVyxDQUFDLFNBQVMsQ0FBQztRQUMzQixLQUFLLG1CQUFXLENBQUMsaUJBQWlCO1lBQ2hDLE9BQU8sSUFBSSxXQUFXLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ3ZDLEtBQUssbUJBQVcsQ0FBQyxVQUFVLENBQUM7UUFDNUIsS0FBSyxtQkFBVyxDQUFDLGVBQWU7WUFDOUIsT0FBTyxJQUFJLFlBQVksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDeEMsS0FBSyxtQkFBVyxDQUFDLEVBQUU7WUFDakIsT0FBTyxJQUFJLFNBQVMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDckM7WUFDRSxPQUFPLElBQUksV0FBVyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztJQUN6QyxDQUFDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFQSUNoYW5uZWwsIEFQSU1lc3NhZ2UsIEFQSUVtYmVkIH0gZnJvbSAnLi4vdHlwZXMnO1xyXG5pbXBvcnQgeyBDaGFubmVsVHlwZSB9IGZyb20gJy4uL2VudW1zJztcclxuaW1wb3J0IHR5cGUgeyBDbGllbnQgfSBmcm9tICcuLi9DbGllbnQnO1xyXG5pbXBvcnQgeyBNZXNzYWdlIH0gZnJvbSAnLi9NZXNzYWdlJztcclxuaW1wb3J0IHsgQ29sbGVjdGlvbiB9IGZyb20gJy4vQ29sbGVjdGlvbic7XHJcbmltcG9ydCB7IE1lc3NhZ2VDb2xsZWN0b3IsIE1lc3NhZ2VDb2xsZWN0b3JPcHRpb25zIH0gZnJvbSAnLi4vdXRpbHMvQ29sbGVjdG9yJztcclxuaW1wb3J0IHsgRW1iZWRCdWlsZGVyLCBBUElFbWJlZCBhcyBCdWlsZGVyQVBJRW1iZWQgfSBmcm9tICcuLi9idWlsZGVycy9FbWJlZEJ1aWxkZXInO1xyXG5cclxuLyoqIFJlc29sdmUgRW1iZWRCdWlsZGVyIGluc3RhbmNlcyB0byBwbGFpbiBBUEkgb2JqZWN0cyAqL1xyXG5mdW5jdGlvbiByZXNvbHZlRW1iZWRzKGVtYmVkcz86IChCdWlsZGVyQVBJRW1iZWQgfCBFbWJlZEJ1aWxkZXIpW10pOiBCdWlsZGVyQVBJRW1iZWRbXSB8IHVuZGVmaW5lZCB7XHJcbiAgaWYgKCFlbWJlZHMpIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgcmV0dXJuIGVtYmVkcy5tYXAoZSA9PiBlIGluc3RhbmNlb2YgRW1iZWRCdWlsZGVyID8gZS50b0pTT04oKSA6IGUpO1xyXG59XHJcblxyXG4vKipcclxuICogQXdhaXQgbWVzc2FnZXMgb3B0aW9uc1xyXG4gKi9cclxuZXhwb3J0IGludGVyZmFjZSBBd2FpdE1lc3NhZ2VzT3B0aW9ucyBleHRlbmRzIE1lc3NhZ2VDb2xsZWN0b3JPcHRpb25zIHtcclxuICAvKiogRXJyb3JzIHRvIHJlamVjdCBvbiAqL1xyXG4gIGVycm9ycz86IHN0cmluZ1tdO1xyXG59XHJcblxyXG4vKipcclxuICogQmFzZSBjaGFubmVsIGNsYXNzXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgQmFzZUNoYW5uZWwge1xyXG4gIC8qKiBSZWZlcmVuY2UgdG8gdGhlIGNsaWVudCAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBjbGllbnQ6IENsaWVudDtcclxuICBcclxuICAvKiogQ2hhbm5lbCBJRCAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBpZDogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBDaGFubmVsIHR5cGUgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgdHlwZTogQ2hhbm5lbFR5cGU7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGNsaWVudDogQ2xpZW50LCBkYXRhOiBBUElDaGFubmVsKSB7XHJcbiAgICB0aGlzLmNsaWVudCA9IGNsaWVudDtcclxuICAgIHRoaXMuaWQgPSBkYXRhLmlkO1xyXG4gICAgdGhpcy50eXBlID0gZGF0YS50eXBlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2hlY2sgaWYgdGhpcyBpcyBhIHRleHQtYmFzZWQgY2hhbm5lbFxyXG4gICAqL1xyXG4gIGlzVGV4dEJhc2VkKCk6IHRoaXMgaXMgVGV4dENoYW5uZWwge1xyXG4gICAgcmV0dXJuIFtcclxuICAgICAgQ2hhbm5lbFR5cGUuR3VpbGRUZXh0LFxyXG4gICAgICBDaGFubmVsVHlwZS5ETSxcclxuICAgICAgQ2hhbm5lbFR5cGUuR3JvdXBETSxcclxuICAgICAgQ2hhbm5lbFR5cGUuR3VpbGRBbm5vdW5jZW1lbnRcclxuICAgIF0uaW5jbHVkZXModGhpcy50eXBlKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENoZWNrIGlmIHRoaXMgaXMgYSB2b2ljZS1iYXNlZCBjaGFubmVsXHJcbiAgICovXHJcbiAgaXNWb2ljZUJhc2VkKCk6IHRoaXMgaXMgVm9pY2VDaGFubmVsIHtcclxuICAgIHJldHVybiBbXHJcbiAgICAgIENoYW5uZWxUeXBlLkd1aWxkVm9pY2UsXHJcbiAgICAgIENoYW5uZWxUeXBlLkd1aWxkU3RhZ2VWb2ljZVxyXG4gICAgXS5pbmNsdWRlcyh0aGlzLnR5cGUpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2hlY2sgaWYgdGhpcyBpcyBhIGNhdGVnb3J5IGNoYW5uZWxcclxuICAgKi9cclxuICBpc0NhdGVnb3J5KCk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIHRoaXMudHlwZSA9PT0gQ2hhbm5lbFR5cGUuR3VpbGRDYXRlZ29yeTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENoZWNrIGlmIHRoaXMgaXMgYSBmb3J1bSBjaGFubmVsXHJcbiAgICovXHJcbiAgaXNGb3J1bSgpOiBib29sZWFuIHtcclxuICAgIHJldHVybiB0aGlzLnR5cGUgPT09IENoYW5uZWxUeXBlLkd1aWxkRm9ydW07XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDaGVjayBpZiB0aGlzIGlzIGEgdGhyZWFkIGNoYW5uZWxcclxuICAgKi9cclxuICBpc1RocmVhZCgpOiBib29sZWFuIHtcclxuICAgIHJldHVybiBbXHJcbiAgICAgIENoYW5uZWxUeXBlLlB1YmxpY1RocmVhZCxcclxuICAgICAgQ2hhbm5lbFR5cGUuUHJpdmF0ZVRocmVhZCxcclxuICAgICAgQ2hhbm5lbFR5cGUuQW5ub3VuY2VtZW50VGhyZWFkXHJcbiAgICBdLmluY2x1ZGVzKHRoaXMudHlwZSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDaGVjayBpZiB0aGlzIGlzIGFuIGFubm91bmNlbWVudCBjaGFubmVsXHJcbiAgICovXHJcbiAgaXNBbm5vdW5jZW1lbnQoKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gdGhpcy50eXBlID09PSBDaGFubmVsVHlwZS5HdWlsZEFubm91bmNlbWVudDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENvbnZlcnQgdG8gc3RyaW5nIChtZW50aW9uIGZvcm1hdClcclxuICAgKi9cclxuICB0b1N0cmluZygpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIGA8IyR7dGhpcy5pZH0+YDtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBUZXh0IGNoYW5uZWxcclxuICovXHJcbmV4cG9ydCBjbGFzcyBUZXh0Q2hhbm5lbCBleHRlbmRzIEJhc2VDaGFubmVsIHtcclxuICAvKiogR3VpbGQgSUQgKi9cclxuICBwdWJsaWMgZ3VpbGRJZD86IHN0cmluZztcclxuICBcclxuICAvKiogQ2hhbm5lbCBuYW1lICovXHJcbiAgcHVibGljIG5hbWU/OiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIENoYW5uZWwgdG9waWMgKi9cclxuICBwdWJsaWMgdG9waWM/OiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIENoYW5uZWwgcG9zaXRpb24gKi9cclxuICBwdWJsaWMgcG9zaXRpb24/OiBudW1iZXI7XHJcbiAgXHJcbiAgLyoqIFBhcmVudCBjYXRlZ29yeSBJRCAqL1xyXG4gIHB1YmxpYyBwYXJlbnRJZD86IHN0cmluZztcclxuXHJcbiAgY29uc3RydWN0b3IoY2xpZW50OiBDbGllbnQsIGRhdGE6IEFQSUNoYW5uZWwpIHtcclxuICAgIHN1cGVyKGNsaWVudCwgZGF0YSk7XHJcbiAgICB0aGlzLmd1aWxkSWQgPSBkYXRhLmd1aWxkX2lkO1xyXG4gICAgdGhpcy5uYW1lID0gZGF0YS5uYW1lO1xyXG4gICAgdGhpcy50b3BpYyA9IGRhdGEudG9waWM7XHJcbiAgICB0aGlzLnBvc2l0aW9uID0gZGF0YS5wb3NpdGlvbjtcclxuICAgIHRoaXMucGFyZW50SWQgPSBkYXRhLnBhcmVudF9pZDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNlbmQgYSBtZXNzYWdlIHRvIHRoaXMgY2hhbm5lbFxyXG4gICAqIEJ1ZyAjOCBmaXggLSBlbWJlZCB0ZWtpbCBrdWxsYW7EsW3EsSwgQnVnICMxMCBmaXggLSBmbGFncyBkZXN0ZcSfaVxyXG4gICAqL1xyXG4gIGFzeW5jIHNlbmQob3B0aW9uczogc3RyaW5nIHwgTWVzc2FnZUNyZWF0ZU9wdGlvbnMpOiBQcm9taXNlPE1lc3NhZ2U+IHtcclxuICAgIGNvbnN0IGNvbnRlbnQgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyBvcHRpb25zIDogb3B0aW9ucy5jb250ZW50O1xyXG4gICAgLy8gQnVnICM4IGZpeCAtIGVtYmVkIHRla2lsIGt1bGxhbsSxbcSxIGRlc3Rla2xlbmlyXHJcbiAgICBjb25zdCByYXdFbWJlZHMgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgXHJcbiAgICAgID8gdW5kZWZpbmVkIFxyXG4gICAgICA6IChvcHRpb25zLmVtYmVkcyB8fCAob3B0aW9ucy5lbWJlZCA/IFtvcHRpb25zLmVtYmVkXSA6IHVuZGVmaW5lZCkpO1xyXG4gICAgY29uc3QgZW1iZWRzID0gcmVzb2x2ZUVtYmVkcyhyYXdFbWJlZHMpO1xyXG4gICAgY29uc3QgY29tcG9uZW50cyA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IHVuZGVmaW5lZCA6IG9wdGlvbnMuY29tcG9uZW50cztcclxuICAgIGNvbnN0IGZpbGVzID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gdW5kZWZpbmVkIDogb3B0aW9ucy5maWxlcztcclxuICAgIGNvbnN0IGZsYWdzID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gdW5kZWZpbmVkIDogb3B0aW9ucy5mbGFncztcclxuICAgIFxyXG4gICAgLy8gRG9zeWEgdmFyc2EgY3JlYXRlTWVzc2FnZVdpdGhGaWxlIGt1bGxhblxyXG4gICAgaWYgKGZpbGVzICYmIGZpbGVzLmxlbmd0aCA+IDAgJiYgdGhpcy5ndWlsZElkKSB7XHJcbiAgICAgIGNvbnN0IGZpbGUgPSBmaWxlc1swXTsgLy8gxZ5pbWRpbGlrIHRlayBkb3N5YSBkZXN0ZcSfaVxyXG4gICAgICBjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5jbGllbnQucmVzdC5jcmVhdGVNZXNzYWdlV2l0aEZpbGUodGhpcy5ndWlsZElkLCB0aGlzLmlkLCB7XHJcbiAgICAgICAgY29udGVudCxcclxuICAgICAgICBlbWJlZHMsXHJcbiAgICAgICAgY29tcG9uZW50cyxcclxuICAgICAgICBmaWxlLFxyXG4gICAgICAgIGZsYWdzXHJcbiAgICAgIH0pO1xyXG4gICAgICByZXR1cm4gbmV3IE1lc3NhZ2UodGhpcy5jbGllbnQsIGRhdGEpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5jbGllbnQucmVzdC5jcmVhdGVNZXNzYWdlKHRoaXMuZ3VpbGRJZCB8fCAnJywgdGhpcy5pZCwge1xyXG4gICAgICBjb250ZW50LFxyXG4gICAgICBlbWJlZHMsXHJcbiAgICAgIGNvbXBvbmVudHMsXHJcbiAgICAgIGZsYWdzLFxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIHJldHVybiBuZXcgTWVzc2FnZSh0aGlzLmNsaWVudCwgZGF0YSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgYSBtZXNzYWdlIGNvbGxlY3RvclxyXG4gICAqL1xyXG4gIGNyZWF0ZU1lc3NhZ2VDb2xsZWN0b3Iob3B0aW9ucz86IE1lc3NhZ2VDb2xsZWN0b3JPcHRpb25zKTogTWVzc2FnZUNvbGxlY3RvciB7XHJcbiAgICByZXR1cm4gbmV3IE1lc3NhZ2VDb2xsZWN0b3IodGhpcy5jbGllbnQsIHRoaXMuaWQsIG9wdGlvbnMpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQXdhaXQgbWVzc2FnZXMgaW4gdGhpcyBjaGFubmVsXHJcbiAgICovXHJcbiAgYXdhaXRNZXNzYWdlcyhvcHRpb25zPzogQXdhaXRNZXNzYWdlc09wdGlvbnMpOiBQcm9taXNlPENvbGxlY3Rpb248c3RyaW5nLCBNZXNzYWdlPj4ge1xyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgY29uc3QgY29sbGVjdG9yID0gdGhpcy5jcmVhdGVNZXNzYWdlQ29sbGVjdG9yKG9wdGlvbnMpO1xyXG4gICAgICBcclxuICAgICAgY29sbGVjdG9yLm9uY2UoJ2VuZCcsIChjb2xsZWN0ZWQsIHJlYXNvbikgPT4ge1xyXG4gICAgICAgIGlmIChvcHRpb25zPy5lcnJvcnM/LmluY2x1ZGVzKHJlYXNvbikpIHtcclxuICAgICAgICAgIHJlamVjdChjb2xsZWN0ZWQpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICByZXNvbHZlKGNvbGxlY3RlZCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQnVsayBkZWxldGUgbWVzc2FnZXNcclxuICAgKi9cclxuICBhc3luYyBidWxrRGVsZXRlKG1lc3NhZ2VzOiBudW1iZXIgfCBzdHJpbmdbXSB8IENvbGxlY3Rpb248c3RyaW5nLCBNZXNzYWdlPiwgZmlsdGVyT2xkID0gdHJ1ZSk6IFByb21pc2U8Q29sbGVjdGlvbjxzdHJpbmcsIE1lc3NhZ2U+PiB7XHJcbiAgICBsZXQgbWVzc2FnZUlkczogc3RyaW5nW107XHJcbiAgICBcclxuICAgIGlmICh0eXBlb2YgbWVzc2FnZXMgPT09ICdudW1iZXInKSB7XHJcbiAgICAgIC8vIEZldGNoIG1lc3NhZ2VzIGZpcnN0XHJcbiAgICAgIGNvbnN0IGZldGNoZWQgPSBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LmdldE1lc3NhZ2VzKHRoaXMuZ3VpbGRJZCB8fCAnJywgdGhpcy5pZCwgeyBsaW1pdDogbWVzc2FnZXMgfSk7XHJcbiAgICAgIG1lc3NhZ2VJZHMgPSBmZXRjaGVkLm1hcChtID0+IG0uaWQpO1xyXG4gICAgfSBlbHNlIGlmIChtZXNzYWdlcyBpbnN0YW5jZW9mIENvbGxlY3Rpb24pIHtcclxuICAgICAgbWVzc2FnZUlkcyA9IFsuLi5tZXNzYWdlcy5rZXlzKCldO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgbWVzc2FnZUlkcyA9IG1lc3NhZ2VzO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIEZpbHRlciBvbGQgbWVzc2FnZXMgKG9sZGVyIHRoYW4gMTQgZGF5cylcclxuICAgIGlmIChmaWx0ZXJPbGQpIHtcclxuICAgICAgY29uc3QgdHdvV2Vla3NBZ28gPSBEYXRlLm5vdygpIC0gMTQgKiAyNCAqIDYwICogNjAgKiAxMDAwO1xyXG4gICAgICBtZXNzYWdlSWRzID0gbWVzc2FnZUlkcy5maWx0ZXIoaWQgPT4ge1xyXG4gICAgICAgIC8vIEV4dHJhY3QgdGltZXN0YW1wIGZyb20gc25vd2ZsYWtlXHJcbiAgICAgICAgY29uc3QgdGltZXN0YW1wID0gTnVtYmVyKEJpZ0ludChpZCkgPj4gMjJuKSArIDE0MjAwNzA0MDAwMDA7XHJcbiAgICAgICAgcmV0dXJuIHRpbWVzdGFtcCA+IHR3b1dlZWtzQWdvO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAobWVzc2FnZUlkcy5sZW5ndGggPT09IDApIHtcclxuICAgICAgcmV0dXJuIG5ldyBDb2xsZWN0aW9uKCk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKG1lc3NhZ2VJZHMubGVuZ3RoID09PSAxKSB7XHJcbiAgICAgIGF3YWl0IHRoaXMuY2xpZW50LnJlc3QuZGVsZXRlTWVzc2FnZSh0aGlzLmd1aWxkSWQgfHwgJycsIHRoaXMuaWQsIG1lc3NhZ2VJZHNbMF0pO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5idWxrRGVsZXRlTWVzc2FnZXModGhpcy5ndWlsZElkIHx8ICcnLCB0aGlzLmlkLCBtZXNzYWdlSWRzKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBSZXR1cm4gZGVsZXRlZCBtZXNzYWdlcyBhcyBjb2xsZWN0aW9uXHJcbiAgICBjb25zdCBkZWxldGVkID0gbmV3IENvbGxlY3Rpb248c3RyaW5nLCBNZXNzYWdlPigpO1xyXG4gICAgLy8gTm90ZTogV2UgZG9uJ3QgaGF2ZSB0aGUgYWN0dWFsIG1lc3NhZ2Ugb2JqZWN0cyBoZXJlXHJcbiAgICByZXR1cm4gZGVsZXRlZDtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBWb2ljZSBjaGFubmVsXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgVm9pY2VDaGFubmVsIGV4dGVuZHMgQmFzZUNoYW5uZWwge1xyXG4gIC8qKiBHdWlsZCBJRCAqL1xyXG4gIHB1YmxpYyBndWlsZElkPzogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBDaGFubmVsIG5hbWUgKi9cclxuICBwdWJsaWMgbmFtZT86IHN0cmluZztcclxuICBcclxuICAvKiogQ2hhbm5lbCBwb3NpdGlvbiAqL1xyXG4gIHB1YmxpYyBwb3NpdGlvbj86IG51bWJlcjtcclxuICBcclxuICAvKiogUGFyZW50IGNhdGVnb3J5IElEICovXHJcbiAgcHVibGljIHBhcmVudElkPzogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBVc2VyIGxpbWl0ICovXHJcbiAgcHVibGljIHVzZXJMaW1pdD86IG51bWJlcjtcclxuICBcclxuICAvKiogQml0cmF0ZSAqL1xyXG4gIHB1YmxpYyBiaXRyYXRlPzogbnVtYmVyO1xyXG5cclxuICBjb25zdHJ1Y3RvcihjbGllbnQ6IENsaWVudCwgZGF0YTogQVBJQ2hhbm5lbCAmIHsgdXNlcl9saW1pdD86IG51bWJlcjsgYml0cmF0ZT86IG51bWJlciB9KSB7XHJcbiAgICBzdXBlcihjbGllbnQsIGRhdGEpO1xyXG4gICAgdGhpcy5ndWlsZElkID0gZGF0YS5ndWlsZF9pZDtcclxuICAgIHRoaXMubmFtZSA9IGRhdGEubmFtZTtcclxuICAgIHRoaXMucG9zaXRpb24gPSBkYXRhLnBvc2l0aW9uO1xyXG4gICAgdGhpcy5wYXJlbnRJZCA9IGRhdGEucGFyZW50X2lkO1xyXG4gICAgdGhpcy51c2VyTGltaXQgPSBkYXRhLnVzZXJfbGltaXQ7XHJcbiAgICB0aGlzLmJpdHJhdGUgPSBkYXRhLmJpdHJhdGU7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDaGVjayBpZiB0aGUgYm90IGNhbiBqb2luIHRoaXMgdm9pY2UgY2hhbm5lbFxyXG4gICAqIFJldHVybnMgZmFsc2UgaWY6XHJcbiAgICogLSBNaXNzaW5nIGd1aWxkIG9yIHVzZXIgcmVmZXJlbmNlXHJcbiAgICogLSBCb3QgbGFja3MgQ29ubmVjdCBwZXJtaXNzaW9uXHJcbiAgICogLSBDaGFubmVsIGlzIGF0IHVzZXIgbGltaXQgY2FwYWNpdHlcclxuICAgKi9cclxuICBnZXQgam9pbmFibGUoKTogYm9vbGVhbiB7XHJcbiAgICBpZiAoIXRoaXMuZ3VpbGRJZCB8fCAhdGhpcy5jbGllbnQudXNlcikgcmV0dXJuIGZhbHNlO1xyXG4gICAgY29uc3QgZ3VpbGQgPSB0aGlzLmNsaWVudC5ndWlsZHMuZ2V0KHRoaXMuZ3VpbGRJZCk7XHJcbiAgICBpZiAoIWd1aWxkKSByZXR1cm4gZmFsc2U7XHJcbiAgICBjb25zdCBtZSA9IGd1aWxkLm1lbWJlcnMuZ2V0KFN0cmluZyh0aGlzLmNsaWVudC51c2VyLmlkKSk7XHJcbiAgICBpZiAoIW1lKSByZXR1cm4gdHJ1ZTsgLy8gTm8gY2FjaGVkIG1lbWJlciDigJQgb3B0aW1pc3RpYywgc2VydmVyIHdpbGwgcmVqZWN0IGlmIG5vdCBhbGxvd2VkXHJcbiAgICBpZiAoIW1lLnBlcm1pc3Npb25zLmhhcygnQ29ubmVjdCcpKSByZXR1cm4gZmFsc2U7XHJcbiAgICBcclxuICAgIC8vIENoZWNrIHVzZXIgbGltaXQgKDAgPSB1bmxpbWl0ZWQpXHJcbiAgICBpZiAodGhpcy51c2VyTGltaXQgJiYgdGhpcy51c2VyTGltaXQgPiAwKSB7XHJcbiAgICAgIGNvbnN0IG1lbWJlcnNJbkNoYW5uZWwgPSBndWlsZC5tZW1iZXJzLmZpbHRlcihtID0+IG0udm9pY2U/LmNoYW5uZWxJZCA9PT0gdGhpcy5pZCkuc2l6ZTtcclxuICAgICAgaWYgKG1lbWJlcnNJbkNoYW5uZWwgPj0gdGhpcy51c2VyTGltaXQpIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgcmV0dXJuIHRydWU7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogRE0gY2hhbm5lbFxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIERNQ2hhbm5lbCBleHRlbmRzIEJhc2VDaGFubmVsIHtcclxuICAvKiogUmVjaXBpZW50IHVzZXIgSUQgKi9cclxuICBwdWJsaWMgcmVjaXBpZW50SWQ/OiBzdHJpbmc7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGNsaWVudDogQ2xpZW50LCBkYXRhOiBBUElDaGFubmVsICYgeyByZWNpcGllbnRfaWQ/OiBzdHJpbmcgfSkge1xyXG4gICAgc3VwZXIoY2xpZW50LCBkYXRhKTtcclxuICAgIHRoaXMucmVjaXBpZW50SWQgPSBkYXRhLnJlY2lwaWVudF9pZDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNlbmQgYSBtZXNzYWdlIHRvIHRoaXMgRE1cclxuICAgKi9cclxuICBhc3luYyBzZW5kKG9wdGlvbnM6IHN0cmluZyB8IE1lc3NhZ2VDcmVhdGVPcHRpb25zKTogUHJvbWlzZTxNZXNzYWdlPiB7XHJcbiAgICBjb25zdCBkYXRhID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8geyBjb250ZW50OiBvcHRpb25zIH0gOiB7XHJcbiAgICAgIGNvbnRlbnQ6IG9wdGlvbnMuY29udGVudCxcclxuICAgICAgZW1iZWRzOiByZXNvbHZlRW1iZWRzKG9wdGlvbnMuZW1iZWRzID8/IChvcHRpb25zLmVtYmVkID8gW29wdGlvbnMuZW1iZWRdIDogdW5kZWZpbmVkKSksXHJcbiAgICAgIGZsYWdzOiBvcHRpb25zLmZsYWdzLFxyXG4gICAgICBjb21wb25lbnRzOiBvcHRpb25zLmNvbXBvbmVudHNcclxuICAgIH07XHJcbiAgICBjb25zdCBmaWxlcyA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IHVuZGVmaW5lZCA6IG9wdGlvbnMuZmlsZXM7XHJcbiAgICBjb25zdCBtZXNzYWdlID0gZmlsZXM/Lmxlbmd0aFxyXG4gICAgICA/IGF3YWl0IHRoaXMuY2xpZW50LnJlc3QuY3JlYXRlRE1NZXNzYWdlVG9DaGFubmVsV2l0aEZpbGUodGhpcy5pZCwgZGF0YSwgZmlsZXMpXHJcbiAgICAgIDogYXdhaXQgdGhpcy5jbGllbnQucmVzdC5jcmVhdGVETU1lc3NhZ2VUb0NoYW5uZWwodGhpcy5pZCwgZGF0YSk7XHJcblxyXG4gICAgcmV0dXJuIG5ldyBNZXNzYWdlKHRoaXMuY2xpZW50LCBtZXNzYWdlKTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBNZXNzYWdlIGNyZWF0ZSBvcHRpb25zXHJcbiAqL1xyXG5leHBvcnQgaW50ZXJmYWNlIE1lc3NhZ2VDcmVhdGVPcHRpb25zIHtcclxuICBjb250ZW50Pzogc3RyaW5nO1xyXG4gIGVtYmVkcz86IChBUElFbWJlZCB8IEVtYmVkQnVpbGRlcilbXTtcclxuICBlbWJlZD86IEFQSUVtYmVkIHwgRW1iZWRCdWlsZGVyOyAgLy8gQnVnICM4IC0gdGVraWwgZW1iZWQgZGVzdGXEn2lcclxuICBjb21wb25lbnRzPzogYW55W107XHJcbiAgZmlsZXM/OiBhbnlbXTtcclxuICBmbGFncz86IG51bWJlcjsgIC8vIEJ1ZyAjMTAgLSBmbGFncyBkZXN0ZcSfaSAoTWVzc2FnZUZsYWdzLlN1cHByZXNzRW1iZWRzIHZiLilcclxufVxyXG5cclxuLyoqXHJcbiAqIENyZWF0ZSBhcHByb3ByaWF0ZSBjaGFubmVsIGNsYXNzIGJhc2VkIG9uIHR5cGVcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVDaGFubmVsKGNsaWVudDogQ2xpZW50LCBkYXRhOiBBUElDaGFubmVsKTogQmFzZUNoYW5uZWwge1xyXG4gIHN3aXRjaCAoZGF0YS50eXBlKSB7XHJcbiAgICBjYXNlIENoYW5uZWxUeXBlLkd1aWxkVGV4dDpcclxuICAgIGNhc2UgQ2hhbm5lbFR5cGUuR3VpbGRBbm5vdW5jZW1lbnQ6XHJcbiAgICAgIHJldHVybiBuZXcgVGV4dENoYW5uZWwoY2xpZW50LCBkYXRhKTtcclxuICAgIGNhc2UgQ2hhbm5lbFR5cGUuR3VpbGRWb2ljZTpcclxuICAgIGNhc2UgQ2hhbm5lbFR5cGUuR3VpbGRTdGFnZVZvaWNlOlxyXG4gICAgICByZXR1cm4gbmV3IFZvaWNlQ2hhbm5lbChjbGllbnQsIGRhdGEpO1xyXG4gICAgY2FzZSBDaGFubmVsVHlwZS5ETTpcclxuICAgICAgcmV0dXJuIG5ldyBETUNoYW5uZWwoY2xpZW50LCBkYXRhKTtcclxuICAgIGRlZmF1bHQ6XHJcbiAgICAgIHJldHVybiBuZXcgQmFzZUNoYW5uZWwoY2xpZW50LCBkYXRhKTtcclxuICB9XHJcbn1cclxuIl19