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
     * ponytail: Bug #8 fix - embed tekil kullanımı, Bug #10 fix - flags desteği
     */
    async send(options) {
        const content = typeof options === 'string' ? options : options.content;
        // ponytail: Bug #8 fix - embed tekil kullanımı desteklenir
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
                file
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
        const content = typeof options === 'string' ? options : options.content;
        const embeds = typeof options === 'string' ? undefined : resolveEmbeds(options.embeds);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ2hhbm5lbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zdHJ1Y3R1cmVzL0NoYW5uZWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBK1VBLHNDQWFDO0FBM1ZELG9DQUF1QztBQUV2Qyx1Q0FBb0M7QUFDcEMsNkNBQTBDO0FBQzFDLGtEQUErRTtBQUMvRSwyREFBcUY7QUFFckYsMERBQTBEO0FBQzFELFNBQVMsYUFBYSxDQUFDLE1BQTJDO0lBQ2hFLElBQUksQ0FBQyxNQUFNO1FBQUUsT0FBTyxTQUFTLENBQUM7SUFDOUIsT0FBTyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxZQUFZLDJCQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDckUsQ0FBQztBQVVEOztHQUVHO0FBQ0gsTUFBYSxXQUFXO0lBQ3RCLDhCQUE4QjtJQUNkLE1BQU0sQ0FBUztJQUUvQixpQkFBaUI7SUFDRCxFQUFFLENBQVM7SUFFM0IsbUJBQW1CO0lBQ0gsSUFBSSxDQUFjO0lBRWxDLFlBQVksTUFBYyxFQUFFLElBQWdCO1FBQzFDLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1FBQ3JCLElBQUksQ0FBQyxFQUFFLEdBQUcsSUFBSSxDQUFDLEVBQUUsQ0FBQztRQUNsQixJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7SUFDeEIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsV0FBVztRQUNULE9BQU87WUFDTCxtQkFBVyxDQUFDLFNBQVM7WUFDckIsbUJBQVcsQ0FBQyxFQUFFO1lBQ2QsbUJBQVcsQ0FBQyxPQUFPO1lBQ25CLG1CQUFXLENBQUMsaUJBQWlCO1NBQzlCLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN4QixDQUFDO0lBRUQ7O09BRUc7SUFDSCxZQUFZO1FBQ1YsT0FBTztZQUNMLG1CQUFXLENBQUMsVUFBVTtZQUN0QixtQkFBVyxDQUFDLGVBQWU7U0FDNUIsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3hCLENBQUM7SUFFRDs7T0FFRztJQUNILFVBQVU7UUFDUixPQUFPLElBQUksQ0FBQyxJQUFJLEtBQUssbUJBQVcsQ0FBQyxhQUFhLENBQUM7SUFDakQsQ0FBQztJQUVEOztPQUVHO0lBQ0gsT0FBTztRQUNMLE9BQU8sSUFBSSxDQUFDLElBQUksS0FBSyxtQkFBVyxDQUFDLFVBQVUsQ0FBQztJQUM5QyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxRQUFRO1FBQ04sT0FBTztZQUNMLG1CQUFXLENBQUMsWUFBWTtZQUN4QixtQkFBVyxDQUFDLGFBQWE7WUFDekIsbUJBQVcsQ0FBQyxrQkFBa0I7U0FDL0IsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3hCLENBQUM7SUFFRDs7T0FFRztJQUNILGNBQWM7UUFDWixPQUFPLElBQUksQ0FBQyxJQUFJLEtBQUssbUJBQVcsQ0FBQyxpQkFBaUIsQ0FBQztJQUNyRCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxRQUFRO1FBQ04sT0FBTyxLQUFLLElBQUksQ0FBQyxFQUFFLEdBQUcsQ0FBQztJQUN6QixDQUFDO0NBQ0Y7QUE1RUQsa0NBNEVDO0FBRUQ7O0dBRUc7QUFDSCxNQUFhLFdBQVksU0FBUSxXQUFXO0lBQzFDLGVBQWU7SUFDUixPQUFPLENBQVU7SUFFeEIsbUJBQW1CO0lBQ1osSUFBSSxDQUFVO0lBRXJCLG9CQUFvQjtJQUNiLEtBQUssQ0FBVTtJQUV0Qix1QkFBdUI7SUFDaEIsUUFBUSxDQUFVO0lBRXpCLHlCQUF5QjtJQUNsQixRQUFRLENBQVU7SUFFekIsWUFBWSxNQUFjLEVBQUUsSUFBZ0I7UUFDMUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNwQixJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUM7UUFDN0IsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO1FBQ3RCLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQztRQUN4QixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUM7UUFDOUIsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO0lBQ2pDLENBQUM7SUFFRDs7O09BR0c7SUFDSCxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQXNDO1FBQy9DLE1BQU0sT0FBTyxHQUFHLE9BQU8sT0FBTyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDO1FBQ3hFLDJEQUEyRDtRQUMzRCxNQUFNLFNBQVMsR0FBRyxPQUFPLE9BQU8sS0FBSyxRQUFRO1lBQzNDLENBQUMsQ0FBQyxTQUFTO1lBQ1gsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1FBQ3RFLE1BQU0sTUFBTSxHQUFHLGFBQWEsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUN4QyxNQUFNLFVBQVUsR0FBRyxPQUFPLE9BQU8sS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQztRQUNoRixNQUFNLEtBQUssR0FBRyxPQUFPLE9BQU8sS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQztRQUN0RSxNQUFNLEtBQUssR0FBRyxPQUFPLE9BQU8sS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQztRQUV0RSwyQ0FBMkM7UUFDM0MsSUFBSSxLQUFLLElBQUksS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQzlDLE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLDZCQUE2QjtZQUNwRCxNQUFNLElBQUksR0FBRyxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLEVBQUUsRUFBRTtnQkFDL0UsT0FBTztnQkFDUCxNQUFNO2dCQUNOLFVBQVU7Z0JBQ1YsSUFBSTthQUNMLENBQUMsQ0FBQztZQUNILE9BQU8sSUFBSSxpQkFBTyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDeEMsQ0FBQztRQUVELE1BQU0sSUFBSSxHQUFHLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxPQUFPLElBQUksRUFBRSxFQUFFLElBQUksQ0FBQyxFQUFFLEVBQUU7WUFDN0UsT0FBTztZQUNQLE1BQU07WUFDTixVQUFVO1lBQ1YsS0FBSztTQUNOLENBQUMsQ0FBQztRQUVILE9BQU8sSUFBSSxpQkFBTyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDeEMsQ0FBQztJQUVEOztPQUVHO0lBQ0gsc0JBQXNCLENBQUMsT0FBaUM7UUFDdEQsT0FBTyxJQUFJLDRCQUFnQixDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLEVBQUUsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUM3RCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxhQUFhLENBQUMsT0FBOEI7UUFDMUMsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRTtZQUNyQyxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsc0JBQXNCLENBQUMsT0FBTyxDQUFDLENBQUM7WUFFdkQsU0FBUyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQyxTQUFTLEVBQUUsTUFBTSxFQUFFLEVBQUU7Z0JBQzFDLElBQUksT0FBTyxFQUFFLE1BQU0sRUFBRSxRQUFRLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQztvQkFDdEMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUNwQixDQUFDO3FCQUFNLENBQUM7b0JBQ04sT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUNyQixDQUFDO1lBQ0gsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxVQUFVLENBQUMsUUFBeUQsRUFBRSxTQUFTLEdBQUcsSUFBSTtRQUMxRixJQUFJLFVBQW9CLENBQUM7UUFFekIsSUFBSSxPQUFPLFFBQVEsS0FBSyxRQUFRLEVBQUUsQ0FBQztZQUNqQyx1QkFBdUI7WUFDdkIsTUFBTSxPQUFPLEdBQUcsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE9BQU8sSUFBSSxFQUFFLEVBQUUsSUFBSSxDQUFDLEVBQUUsRUFBRSxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDO1lBQ3JHLFVBQVUsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQ3RDLENBQUM7YUFBTSxJQUFJLFFBQVEsWUFBWSx1QkFBVSxFQUFFLENBQUM7WUFDMUMsVUFBVSxHQUFHLENBQUMsR0FBRyxRQUFRLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUNwQyxDQUFDO2FBQU0sQ0FBQztZQUNOLFVBQVUsR0FBRyxRQUFRLENBQUM7UUFDeEIsQ0FBQztRQUVELDJDQUEyQztRQUMzQyxJQUFJLFNBQVMsRUFBRSxDQUFDO1lBQ2QsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxJQUFJLENBQUM7WUFDMUQsVUFBVSxHQUFHLFVBQVUsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLEVBQUU7Z0JBQ2xDLG1DQUFtQztnQkFDbkMsTUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsSUFBSSxHQUFHLENBQUMsR0FBRyxhQUFhLENBQUM7Z0JBQzVELE9BQU8sU0FBUyxHQUFHLFdBQVcsQ0FBQztZQUNqQyxDQUFDLENBQUMsQ0FBQztRQUNMLENBQUM7UUFFRCxJQUFJLFVBQVUsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDNUIsT0FBTyxJQUFJLHVCQUFVLEVBQUUsQ0FBQztRQUMxQixDQUFDO1FBRUQsSUFBSSxVQUFVLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQzVCLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxPQUFPLElBQUksRUFBRSxFQUFFLElBQUksQ0FBQyxFQUFFLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDbkYsQ0FBQzthQUFNLENBQUM7WUFDTixNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxPQUFPLElBQUksRUFBRSxFQUFFLElBQUksQ0FBQyxFQUFFLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFDckYsQ0FBQztRQUVELHdDQUF3QztRQUN4QyxNQUFNLE9BQU8sR0FBRyxJQUFJLHVCQUFVLEVBQW1CLENBQUM7UUFDbEQsc0RBQXNEO1FBQ3RELE9BQU8sT0FBTyxDQUFDO0lBQ2pCLENBQUM7Q0FDRjtBQS9IRCxrQ0ErSEM7QUFFRDs7R0FFRztBQUNILE1BQWEsWUFBYSxTQUFRLFdBQVc7SUFDM0MsZUFBZTtJQUNSLE9BQU8sQ0FBVTtJQUV4QixtQkFBbUI7SUFDWixJQUFJLENBQVU7SUFFckIsdUJBQXVCO0lBQ2hCLFFBQVEsQ0FBVTtJQUV6Qix5QkFBeUI7SUFDbEIsUUFBUSxDQUFVO0lBRXpCLGlCQUFpQjtJQUNWLFNBQVMsQ0FBVTtJQUUxQixjQUFjO0lBQ1AsT0FBTyxDQUFVO0lBRXhCLFlBQVksTUFBYyxFQUFFLElBQTREO1FBQ3RGLEtBQUssQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDcEIsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDO1FBQzdCLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQztRQUN0QixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUM7UUFDOUIsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO1FBQy9CLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQztRQUNqQyxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUM7SUFDOUIsQ0FBQztJQUVEOzs7Ozs7T0FNRztJQUNILElBQUksUUFBUTtRQUNWLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJO1lBQUUsT0FBTyxLQUFLLENBQUM7UUFDckQsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNuRCxJQUFJLENBQUMsS0FBSztZQUFFLE9BQU8sS0FBSyxDQUFDO1FBQ3pCLE1BQU0sRUFBRSxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQzFELElBQUksQ0FBQyxFQUFFO1lBQUUsT0FBTyxJQUFJLENBQUMsQ0FBQyxtRUFBbUU7UUFDekYsSUFBSSxDQUFDLEVBQUUsQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQztZQUFFLE9BQU8sS0FBSyxDQUFDO1FBRWpELG1DQUFtQztRQUNuQyxJQUFJLElBQUksQ0FBQyxTQUFTLElBQUksSUFBSSxDQUFDLFNBQVMsR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUN6QyxNQUFNLGdCQUFnQixHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxTQUFTLEtBQUssSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQztZQUN4RixJQUFJLGdCQUFnQixJQUFJLElBQUksQ0FBQyxTQUFTO2dCQUFFLE9BQU8sS0FBSyxDQUFDO1FBQ3ZELENBQUM7UUFFRCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7Q0FDRjtBQXBERCxvQ0FvREM7QUFFRDs7R0FFRztBQUNILE1BQWEsU0FBVSxTQUFRLFdBQVc7SUFDeEMsd0JBQXdCO0lBQ2pCLFdBQVcsQ0FBVTtJQUU1QixZQUFZLE1BQWMsRUFBRSxJQUE0QztRQUN0RSxLQUFLLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ3BCLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQztJQUN2QyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQXNDO1FBQy9DLE1BQU0sT0FBTyxHQUFHLE9BQU8sT0FBTyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDO1FBQ3hFLE1BQU0sTUFBTSxHQUFHLE9BQU8sT0FBTyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBRXZGLE1BQU0sSUFBSSxHQUFHLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUU7WUFDM0QsT0FBTztZQUNQLE1BQU07U0FDUCxDQUFDLENBQUM7UUFFSCxPQUFPLElBQUksaUJBQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ3hDLENBQUM7Q0FDRjtBQXZCRCw4QkF1QkM7QUFjRDs7R0FFRztBQUNILFNBQWdCLGFBQWEsQ0FBQyxNQUFjLEVBQUUsSUFBZ0I7SUFDNUQsUUFBUSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDbEIsS0FBSyxtQkFBVyxDQUFDLFNBQVMsQ0FBQztRQUMzQixLQUFLLG1CQUFXLENBQUMsaUJBQWlCO1lBQ2hDLE9BQU8sSUFBSSxXQUFXLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ3ZDLEtBQUssbUJBQVcsQ0FBQyxVQUFVLENBQUM7UUFDNUIsS0FBSyxtQkFBVyxDQUFDLGVBQWU7WUFDOUIsT0FBTyxJQUFJLFlBQVksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDeEMsS0FBSyxtQkFBVyxDQUFDLEVBQUU7WUFDakIsT0FBTyxJQUFJLFNBQVMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDckM7WUFDRSxPQUFPLElBQUksV0FBVyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztJQUN6QyxDQUFDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFQSUNoYW5uZWwsIEFQSU1lc3NhZ2UsIEFQSUVtYmVkIH0gZnJvbSAnLi4vdHlwZXMnO1xyXG5pbXBvcnQgeyBDaGFubmVsVHlwZSB9IGZyb20gJy4uL2VudW1zJztcclxuaW1wb3J0IHR5cGUgeyBDbGllbnQgfSBmcm9tICcuLi9DbGllbnQnO1xyXG5pbXBvcnQgeyBNZXNzYWdlIH0gZnJvbSAnLi9NZXNzYWdlJztcclxuaW1wb3J0IHsgQ29sbGVjdGlvbiB9IGZyb20gJy4vQ29sbGVjdGlvbic7XHJcbmltcG9ydCB7IE1lc3NhZ2VDb2xsZWN0b3IsIE1lc3NhZ2VDb2xsZWN0b3JPcHRpb25zIH0gZnJvbSAnLi4vdXRpbHMvQ29sbGVjdG9yJztcclxuaW1wb3J0IHsgRW1iZWRCdWlsZGVyLCBBUElFbWJlZCBhcyBCdWlsZGVyQVBJRW1iZWQgfSBmcm9tICcuLi9idWlsZGVycy9FbWJlZEJ1aWxkZXInO1xyXG5cclxuLyoqIFJlc29sdmUgRW1iZWRCdWlsZGVyIGluc3RhbmNlcyB0byBwbGFpbiBBUEkgb2JqZWN0cyAqL1xyXG5mdW5jdGlvbiByZXNvbHZlRW1iZWRzKGVtYmVkcz86IChCdWlsZGVyQVBJRW1iZWQgfCBFbWJlZEJ1aWxkZXIpW10pOiBCdWlsZGVyQVBJRW1iZWRbXSB8IHVuZGVmaW5lZCB7XHJcbiAgaWYgKCFlbWJlZHMpIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgcmV0dXJuIGVtYmVkcy5tYXAoZSA9PiBlIGluc3RhbmNlb2YgRW1iZWRCdWlsZGVyID8gZS50b0pTT04oKSA6IGUpO1xyXG59XHJcblxyXG4vKipcclxuICogQXdhaXQgbWVzc2FnZXMgb3B0aW9uc1xyXG4gKi9cclxuZXhwb3J0IGludGVyZmFjZSBBd2FpdE1lc3NhZ2VzT3B0aW9ucyBleHRlbmRzIE1lc3NhZ2VDb2xsZWN0b3JPcHRpb25zIHtcclxuICAvKiogRXJyb3JzIHRvIHJlamVjdCBvbiAqL1xyXG4gIGVycm9ycz86IHN0cmluZ1tdO1xyXG59XHJcblxyXG4vKipcclxuICogQmFzZSBjaGFubmVsIGNsYXNzXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgQmFzZUNoYW5uZWwge1xyXG4gIC8qKiBSZWZlcmVuY2UgdG8gdGhlIGNsaWVudCAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBjbGllbnQ6IENsaWVudDtcclxuICBcclxuICAvKiogQ2hhbm5lbCBJRCAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBpZDogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBDaGFubmVsIHR5cGUgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgdHlwZTogQ2hhbm5lbFR5cGU7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGNsaWVudDogQ2xpZW50LCBkYXRhOiBBUElDaGFubmVsKSB7XHJcbiAgICB0aGlzLmNsaWVudCA9IGNsaWVudDtcclxuICAgIHRoaXMuaWQgPSBkYXRhLmlkO1xyXG4gICAgdGhpcy50eXBlID0gZGF0YS50eXBlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2hlY2sgaWYgdGhpcyBpcyBhIHRleHQtYmFzZWQgY2hhbm5lbFxyXG4gICAqL1xyXG4gIGlzVGV4dEJhc2VkKCk6IHRoaXMgaXMgVGV4dENoYW5uZWwge1xyXG4gICAgcmV0dXJuIFtcclxuICAgICAgQ2hhbm5lbFR5cGUuR3VpbGRUZXh0LFxyXG4gICAgICBDaGFubmVsVHlwZS5ETSxcclxuICAgICAgQ2hhbm5lbFR5cGUuR3JvdXBETSxcclxuICAgICAgQ2hhbm5lbFR5cGUuR3VpbGRBbm5vdW5jZW1lbnRcclxuICAgIF0uaW5jbHVkZXModGhpcy50eXBlKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENoZWNrIGlmIHRoaXMgaXMgYSB2b2ljZS1iYXNlZCBjaGFubmVsXHJcbiAgICovXHJcbiAgaXNWb2ljZUJhc2VkKCk6IHRoaXMgaXMgVm9pY2VDaGFubmVsIHtcclxuICAgIHJldHVybiBbXHJcbiAgICAgIENoYW5uZWxUeXBlLkd1aWxkVm9pY2UsXHJcbiAgICAgIENoYW5uZWxUeXBlLkd1aWxkU3RhZ2VWb2ljZVxyXG4gICAgXS5pbmNsdWRlcyh0aGlzLnR5cGUpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2hlY2sgaWYgdGhpcyBpcyBhIGNhdGVnb3J5IGNoYW5uZWxcclxuICAgKi9cclxuICBpc0NhdGVnb3J5KCk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIHRoaXMudHlwZSA9PT0gQ2hhbm5lbFR5cGUuR3VpbGRDYXRlZ29yeTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENoZWNrIGlmIHRoaXMgaXMgYSBmb3J1bSBjaGFubmVsXHJcbiAgICovXHJcbiAgaXNGb3J1bSgpOiBib29sZWFuIHtcclxuICAgIHJldHVybiB0aGlzLnR5cGUgPT09IENoYW5uZWxUeXBlLkd1aWxkRm9ydW07XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDaGVjayBpZiB0aGlzIGlzIGEgdGhyZWFkIGNoYW5uZWxcclxuICAgKi9cclxuICBpc1RocmVhZCgpOiBib29sZWFuIHtcclxuICAgIHJldHVybiBbXHJcbiAgICAgIENoYW5uZWxUeXBlLlB1YmxpY1RocmVhZCxcclxuICAgICAgQ2hhbm5lbFR5cGUuUHJpdmF0ZVRocmVhZCxcclxuICAgICAgQ2hhbm5lbFR5cGUuQW5ub3VuY2VtZW50VGhyZWFkXHJcbiAgICBdLmluY2x1ZGVzKHRoaXMudHlwZSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDaGVjayBpZiB0aGlzIGlzIGFuIGFubm91bmNlbWVudCBjaGFubmVsXHJcbiAgICovXHJcbiAgaXNBbm5vdW5jZW1lbnQoKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gdGhpcy50eXBlID09PSBDaGFubmVsVHlwZS5HdWlsZEFubm91bmNlbWVudDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENvbnZlcnQgdG8gc3RyaW5nIChtZW50aW9uIGZvcm1hdClcclxuICAgKi9cclxuICB0b1N0cmluZygpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIGA8IyR7dGhpcy5pZH0+YDtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBUZXh0IGNoYW5uZWxcclxuICovXHJcbmV4cG9ydCBjbGFzcyBUZXh0Q2hhbm5lbCBleHRlbmRzIEJhc2VDaGFubmVsIHtcclxuICAvKiogR3VpbGQgSUQgKi9cclxuICBwdWJsaWMgZ3VpbGRJZD86IHN0cmluZztcclxuICBcclxuICAvKiogQ2hhbm5lbCBuYW1lICovXHJcbiAgcHVibGljIG5hbWU/OiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIENoYW5uZWwgdG9waWMgKi9cclxuICBwdWJsaWMgdG9waWM/OiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIENoYW5uZWwgcG9zaXRpb24gKi9cclxuICBwdWJsaWMgcG9zaXRpb24/OiBudW1iZXI7XHJcbiAgXHJcbiAgLyoqIFBhcmVudCBjYXRlZ29yeSBJRCAqL1xyXG4gIHB1YmxpYyBwYXJlbnRJZD86IHN0cmluZztcclxuXHJcbiAgY29uc3RydWN0b3IoY2xpZW50OiBDbGllbnQsIGRhdGE6IEFQSUNoYW5uZWwpIHtcclxuICAgIHN1cGVyKGNsaWVudCwgZGF0YSk7XHJcbiAgICB0aGlzLmd1aWxkSWQgPSBkYXRhLmd1aWxkX2lkO1xyXG4gICAgdGhpcy5uYW1lID0gZGF0YS5uYW1lO1xyXG4gICAgdGhpcy50b3BpYyA9IGRhdGEudG9waWM7XHJcbiAgICB0aGlzLnBvc2l0aW9uID0gZGF0YS5wb3NpdGlvbjtcclxuICAgIHRoaXMucGFyZW50SWQgPSBkYXRhLnBhcmVudF9pZDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNlbmQgYSBtZXNzYWdlIHRvIHRoaXMgY2hhbm5lbFxyXG4gICAqIHBvbnl0YWlsOiBCdWcgIzggZml4IC0gZW1iZWQgdGVraWwga3VsbGFuxLFtxLEsIEJ1ZyAjMTAgZml4IC0gZmxhZ3MgZGVzdGXEn2lcclxuICAgKi9cclxuICBhc3luYyBzZW5kKG9wdGlvbnM6IHN0cmluZyB8IE1lc3NhZ2VDcmVhdGVPcHRpb25zKTogUHJvbWlzZTxNZXNzYWdlPiB7XHJcbiAgICBjb25zdCBjb250ZW50ID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gb3B0aW9ucyA6IG9wdGlvbnMuY29udGVudDtcclxuICAgIC8vIHBvbnl0YWlsOiBCdWcgIzggZml4IC0gZW1iZWQgdGVraWwga3VsbGFuxLFtxLEgZGVzdGVrbGVuaXJcclxuICAgIGNvbnN0IHJhd0VtYmVkcyA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyBcclxuICAgICAgPyB1bmRlZmluZWQgXHJcbiAgICAgIDogKG9wdGlvbnMuZW1iZWRzIHx8IChvcHRpb25zLmVtYmVkID8gW29wdGlvbnMuZW1iZWRdIDogdW5kZWZpbmVkKSk7XHJcbiAgICBjb25zdCBlbWJlZHMgPSByZXNvbHZlRW1iZWRzKHJhd0VtYmVkcyk7XHJcbiAgICBjb25zdCBjb21wb25lbnRzID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gdW5kZWZpbmVkIDogb3B0aW9ucy5jb21wb25lbnRzO1xyXG4gICAgY29uc3QgZmlsZXMgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyB1bmRlZmluZWQgOiBvcHRpb25zLmZpbGVzO1xyXG4gICAgY29uc3QgZmxhZ3MgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyB1bmRlZmluZWQgOiBvcHRpb25zLmZsYWdzO1xyXG4gICAgXHJcbiAgICAvLyBEb3N5YSB2YXJzYSBjcmVhdGVNZXNzYWdlV2l0aEZpbGUga3VsbGFuXHJcbiAgICBpZiAoZmlsZXMgJiYgZmlsZXMubGVuZ3RoID4gMCAmJiB0aGlzLmd1aWxkSWQpIHtcclxuICAgICAgY29uc3QgZmlsZSA9IGZpbGVzWzBdOyAvLyDFnmltZGlsaWsgdGVrIGRvc3lhIGRlc3RlxJ9pXHJcbiAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LmNyZWF0ZU1lc3NhZ2VXaXRoRmlsZSh0aGlzLmd1aWxkSWQsIHRoaXMuaWQsIHtcclxuICAgICAgICBjb250ZW50LFxyXG4gICAgICAgIGVtYmVkcyxcclxuICAgICAgICBjb21wb25lbnRzLFxyXG4gICAgICAgIGZpbGVcclxuICAgICAgfSk7XHJcbiAgICAgIHJldHVybiBuZXcgTWVzc2FnZSh0aGlzLmNsaWVudCwgZGF0YSk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LmNyZWF0ZU1lc3NhZ2UodGhpcy5ndWlsZElkIHx8ICcnLCB0aGlzLmlkLCB7XHJcbiAgICAgIGNvbnRlbnQsXHJcbiAgICAgIGVtYmVkcyxcclxuICAgICAgY29tcG9uZW50cyxcclxuICAgICAgZmxhZ3MsXHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgcmV0dXJuIG5ldyBNZXNzYWdlKHRoaXMuY2xpZW50LCBkYXRhKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIG1lc3NhZ2UgY29sbGVjdG9yXHJcbiAgICovXHJcbiAgY3JlYXRlTWVzc2FnZUNvbGxlY3RvcihvcHRpb25zPzogTWVzc2FnZUNvbGxlY3Rvck9wdGlvbnMpOiBNZXNzYWdlQ29sbGVjdG9yIHtcclxuICAgIHJldHVybiBuZXcgTWVzc2FnZUNvbGxlY3Rvcih0aGlzLmNsaWVudCwgdGhpcy5pZCwgb3B0aW9ucyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBd2FpdCBtZXNzYWdlcyBpbiB0aGlzIGNoYW5uZWxcclxuICAgKi9cclxuICBhd2FpdE1lc3NhZ2VzKG9wdGlvbnM/OiBBd2FpdE1lc3NhZ2VzT3B0aW9ucyk6IFByb21pc2U8Q29sbGVjdGlvbjxzdHJpbmcsIE1lc3NhZ2U+PiB7XHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICBjb25zdCBjb2xsZWN0b3IgPSB0aGlzLmNyZWF0ZU1lc3NhZ2VDb2xsZWN0b3Iob3B0aW9ucyk7XHJcbiAgICAgIFxyXG4gICAgICBjb2xsZWN0b3Iub25jZSgnZW5kJywgKGNvbGxlY3RlZCwgcmVhc29uKSA9PiB7XHJcbiAgICAgICAgaWYgKG9wdGlvbnM/LmVycm9ycz8uaW5jbHVkZXMocmVhc29uKSkge1xyXG4gICAgICAgICAgcmVqZWN0KGNvbGxlY3RlZCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIHJlc29sdmUoY29sbGVjdGVkKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBCdWxrIGRlbGV0ZSBtZXNzYWdlc1xyXG4gICAqL1xyXG4gIGFzeW5jIGJ1bGtEZWxldGUobWVzc2FnZXM6IG51bWJlciB8IHN0cmluZ1tdIHwgQ29sbGVjdGlvbjxzdHJpbmcsIE1lc3NhZ2U+LCBmaWx0ZXJPbGQgPSB0cnVlKTogUHJvbWlzZTxDb2xsZWN0aW9uPHN0cmluZywgTWVzc2FnZT4+IHtcclxuICAgIGxldCBtZXNzYWdlSWRzOiBzdHJpbmdbXTtcclxuICAgIFxyXG4gICAgaWYgKHR5cGVvZiBtZXNzYWdlcyA9PT0gJ251bWJlcicpIHtcclxuICAgICAgLy8gRmV0Y2ggbWVzc2FnZXMgZmlyc3RcclxuICAgICAgY29uc3QgZmV0Y2hlZCA9IGF3YWl0IHRoaXMuY2xpZW50LnJlc3QuZ2V0TWVzc2FnZXModGhpcy5ndWlsZElkIHx8ICcnLCB0aGlzLmlkLCB7IGxpbWl0OiBtZXNzYWdlcyB9KTtcclxuICAgICAgbWVzc2FnZUlkcyA9IGZldGNoZWQubWFwKG0gPT4gbS5pZCk7XHJcbiAgICB9IGVsc2UgaWYgKG1lc3NhZ2VzIGluc3RhbmNlb2YgQ29sbGVjdGlvbikge1xyXG4gICAgICBtZXNzYWdlSWRzID0gWy4uLm1lc3NhZ2VzLmtleXMoKV07XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBtZXNzYWdlSWRzID0gbWVzc2FnZXM7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gRmlsdGVyIG9sZCBtZXNzYWdlcyAob2xkZXIgdGhhbiAxNCBkYXlzKVxyXG4gICAgaWYgKGZpbHRlck9sZCkge1xyXG4gICAgICBjb25zdCB0d29XZWVrc0FnbyA9IERhdGUubm93KCkgLSAxNCAqIDI0ICogNjAgKiA2MCAqIDEwMDA7XHJcbiAgICAgIG1lc3NhZ2VJZHMgPSBtZXNzYWdlSWRzLmZpbHRlcihpZCA9PiB7XHJcbiAgICAgICAgLy8gRXh0cmFjdCB0aW1lc3RhbXAgZnJvbSBzbm93Zmxha2VcclxuICAgICAgICBjb25zdCB0aW1lc3RhbXAgPSBOdW1iZXIoQmlnSW50KGlkKSA+PiAyMm4pICsgMTQyMDA3MDQwMDAwMDtcclxuICAgICAgICByZXR1cm4gdGltZXN0YW1wID4gdHdvV2Vla3NBZ287XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChtZXNzYWdlSWRzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICByZXR1cm4gbmV3IENvbGxlY3Rpb24oKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAobWVzc2FnZUlkcy5sZW5ndGggPT09IDEpIHtcclxuICAgICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5kZWxldGVNZXNzYWdlKHRoaXMuZ3VpbGRJZCB8fCAnJywgdGhpcy5pZCwgbWVzc2FnZUlkc1swXSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LmJ1bGtEZWxldGVNZXNzYWdlcyh0aGlzLmd1aWxkSWQgfHwgJycsIHRoaXMuaWQsIG1lc3NhZ2VJZHMpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIFJldHVybiBkZWxldGVkIG1lc3NhZ2VzIGFzIGNvbGxlY3Rpb25cclxuICAgIGNvbnN0IGRlbGV0ZWQgPSBuZXcgQ29sbGVjdGlvbjxzdHJpbmcsIE1lc3NhZ2U+KCk7XHJcbiAgICAvLyBOb3RlOiBXZSBkb24ndCBoYXZlIHRoZSBhY3R1YWwgbWVzc2FnZSBvYmplY3RzIGhlcmVcclxuICAgIHJldHVybiBkZWxldGVkO1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIFZvaWNlIGNoYW5uZWxcclxuICovXHJcbmV4cG9ydCBjbGFzcyBWb2ljZUNoYW5uZWwgZXh0ZW5kcyBCYXNlQ2hhbm5lbCB7XHJcbiAgLyoqIEd1aWxkIElEICovXHJcbiAgcHVibGljIGd1aWxkSWQ/OiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIENoYW5uZWwgbmFtZSAqL1xyXG4gIHB1YmxpYyBuYW1lPzogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBDaGFubmVsIHBvc2l0aW9uICovXHJcbiAgcHVibGljIHBvc2l0aW9uPzogbnVtYmVyO1xyXG4gIFxyXG4gIC8qKiBQYXJlbnQgY2F0ZWdvcnkgSUQgKi9cclxuICBwdWJsaWMgcGFyZW50SWQ/OiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIFVzZXIgbGltaXQgKi9cclxuICBwdWJsaWMgdXNlckxpbWl0PzogbnVtYmVyO1xyXG4gIFxyXG4gIC8qKiBCaXRyYXRlICovXHJcbiAgcHVibGljIGJpdHJhdGU/OiBudW1iZXI7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGNsaWVudDogQ2xpZW50LCBkYXRhOiBBUElDaGFubmVsICYgeyB1c2VyX2xpbWl0PzogbnVtYmVyOyBiaXRyYXRlPzogbnVtYmVyIH0pIHtcclxuICAgIHN1cGVyKGNsaWVudCwgZGF0YSk7XHJcbiAgICB0aGlzLmd1aWxkSWQgPSBkYXRhLmd1aWxkX2lkO1xyXG4gICAgdGhpcy5uYW1lID0gZGF0YS5uYW1lO1xyXG4gICAgdGhpcy5wb3NpdGlvbiA9IGRhdGEucG9zaXRpb247XHJcbiAgICB0aGlzLnBhcmVudElkID0gZGF0YS5wYXJlbnRfaWQ7XHJcbiAgICB0aGlzLnVzZXJMaW1pdCA9IGRhdGEudXNlcl9saW1pdDtcclxuICAgIHRoaXMuYml0cmF0ZSA9IGRhdGEuYml0cmF0ZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENoZWNrIGlmIHRoZSBib3QgY2FuIGpvaW4gdGhpcyB2b2ljZSBjaGFubmVsXHJcbiAgICogUmV0dXJucyBmYWxzZSBpZjpcclxuICAgKiAtIE1pc3NpbmcgZ3VpbGQgb3IgdXNlciByZWZlcmVuY2VcclxuICAgKiAtIEJvdCBsYWNrcyBDb25uZWN0IHBlcm1pc3Npb25cclxuICAgKiAtIENoYW5uZWwgaXMgYXQgdXNlciBsaW1pdCBjYXBhY2l0eVxyXG4gICAqL1xyXG4gIGdldCBqb2luYWJsZSgpOiBib29sZWFuIHtcclxuICAgIGlmICghdGhpcy5ndWlsZElkIHx8ICF0aGlzLmNsaWVudC51c2VyKSByZXR1cm4gZmFsc2U7XHJcbiAgICBjb25zdCBndWlsZCA9IHRoaXMuY2xpZW50Lmd1aWxkcy5nZXQodGhpcy5ndWlsZElkKTtcclxuICAgIGlmICghZ3VpbGQpIHJldHVybiBmYWxzZTtcclxuICAgIGNvbnN0IG1lID0gZ3VpbGQubWVtYmVycy5nZXQoU3RyaW5nKHRoaXMuY2xpZW50LnVzZXIuaWQpKTtcclxuICAgIGlmICghbWUpIHJldHVybiB0cnVlOyAvLyBObyBjYWNoZWQgbWVtYmVyIOKAlCBvcHRpbWlzdGljLCBzZXJ2ZXIgd2lsbCByZWplY3QgaWYgbm90IGFsbG93ZWRcclxuICAgIGlmICghbWUucGVybWlzc2lvbnMuaGFzKCdDb25uZWN0JykpIHJldHVybiBmYWxzZTtcclxuICAgIFxyXG4gICAgLy8gQ2hlY2sgdXNlciBsaW1pdCAoMCA9IHVubGltaXRlZClcclxuICAgIGlmICh0aGlzLnVzZXJMaW1pdCAmJiB0aGlzLnVzZXJMaW1pdCA+IDApIHtcclxuICAgICAgY29uc3QgbWVtYmVyc0luQ2hhbm5lbCA9IGd1aWxkLm1lbWJlcnMuZmlsdGVyKG0gPT4gbS52b2ljZT8uY2hhbm5lbElkID09PSB0aGlzLmlkKS5zaXplO1xyXG4gICAgICBpZiAobWVtYmVyc0luQ2hhbm5lbCA+PSB0aGlzLnVzZXJMaW1pdCkgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICByZXR1cm4gdHJ1ZTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBETSBjaGFubmVsXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgRE1DaGFubmVsIGV4dGVuZHMgQmFzZUNoYW5uZWwge1xyXG4gIC8qKiBSZWNpcGllbnQgdXNlciBJRCAqL1xyXG4gIHB1YmxpYyByZWNpcGllbnRJZD86IHN0cmluZztcclxuXHJcbiAgY29uc3RydWN0b3IoY2xpZW50OiBDbGllbnQsIGRhdGE6IEFQSUNoYW5uZWwgJiB7IHJlY2lwaWVudF9pZD86IHN0cmluZyB9KSB7XHJcbiAgICBzdXBlcihjbGllbnQsIGRhdGEpO1xyXG4gICAgdGhpcy5yZWNpcGllbnRJZCA9IGRhdGEucmVjaXBpZW50X2lkO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2VuZCBhIG1lc3NhZ2UgdG8gdGhpcyBETVxyXG4gICAqL1xyXG4gIGFzeW5jIHNlbmQob3B0aW9uczogc3RyaW5nIHwgTWVzc2FnZUNyZWF0ZU9wdGlvbnMpOiBQcm9taXNlPE1lc3NhZ2U+IHtcclxuICAgIGNvbnN0IGNvbnRlbnQgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyBvcHRpb25zIDogb3B0aW9ucy5jb250ZW50O1xyXG4gICAgY29uc3QgZW1iZWRzID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gdW5kZWZpbmVkIDogcmVzb2x2ZUVtYmVkcyhvcHRpb25zLmVtYmVkcyk7XHJcbiAgICBcclxuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LmNyZWF0ZURNTWVzc2FnZSh0aGlzLmlkLCB7XHJcbiAgICAgIGNvbnRlbnQsXHJcbiAgICAgIGVtYmVkc1xyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIHJldHVybiBuZXcgTWVzc2FnZSh0aGlzLmNsaWVudCwgZGF0YSk7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogTWVzc2FnZSBjcmVhdGUgb3B0aW9uc1xyXG4gKi9cclxuZXhwb3J0IGludGVyZmFjZSBNZXNzYWdlQ3JlYXRlT3B0aW9ucyB7XHJcbiAgY29udGVudD86IHN0cmluZztcclxuICBlbWJlZHM/OiAoQVBJRW1iZWQgfCBFbWJlZEJ1aWxkZXIpW107XHJcbiAgZW1iZWQ/OiBBUElFbWJlZCB8IEVtYmVkQnVpbGRlcjsgIC8vIHBvbnl0YWlsOiBCdWcgIzggLSB0ZWtpbCBlbWJlZCBkZXN0ZcSfaVxyXG4gIGNvbXBvbmVudHM/OiBhbnlbXTtcclxuICBmaWxlcz86IGFueVtdO1xyXG4gIGZsYWdzPzogbnVtYmVyOyAgLy8gcG9ueXRhaWw6IEJ1ZyAjMTAgLSBmbGFncyBkZXN0ZcSfaSAoTWVzc2FnZUZsYWdzLlN1cHByZXNzRW1iZWRzIHZiLilcclxufVxyXG5cclxuLyoqXHJcbiAqIENyZWF0ZSBhcHByb3ByaWF0ZSBjaGFubmVsIGNsYXNzIGJhc2VkIG9uIHR5cGVcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVDaGFubmVsKGNsaWVudDogQ2xpZW50LCBkYXRhOiBBUElDaGFubmVsKTogQmFzZUNoYW5uZWwge1xyXG4gIHN3aXRjaCAoZGF0YS50eXBlKSB7XHJcbiAgICBjYXNlIENoYW5uZWxUeXBlLkd1aWxkVGV4dDpcclxuICAgIGNhc2UgQ2hhbm5lbFR5cGUuR3VpbGRBbm5vdW5jZW1lbnQ6XHJcbiAgICAgIHJldHVybiBuZXcgVGV4dENoYW5uZWwoY2xpZW50LCBkYXRhKTtcclxuICAgIGNhc2UgQ2hhbm5lbFR5cGUuR3VpbGRWb2ljZTpcclxuICAgIGNhc2UgQ2hhbm5lbFR5cGUuR3VpbGRTdGFnZVZvaWNlOlxyXG4gICAgICByZXR1cm4gbmV3IFZvaWNlQ2hhbm5lbChjbGllbnQsIGRhdGEpO1xyXG4gICAgY2FzZSBDaGFubmVsVHlwZS5ETTpcclxuICAgICAgcmV0dXJuIG5ldyBETUNoYW5uZWwoY2xpZW50LCBkYXRhKTtcclxuICAgIGRlZmF1bHQ6XHJcbiAgICAgIHJldHVybiBuZXcgQmFzZUNoYW5uZWwoY2xpZW50LCBkYXRhKTtcclxuICB9XHJcbn1cclxuIl19