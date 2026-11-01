"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Message = exports.ReactionEmoji = exports.MessageReaction = void 0;
const User_1 = require("./User");
const Channel_1 = require("./Channel");
const Collector_1 = require("../utils/Collector");
const EmbedBuilder_1 = require("../builders/EmbedBuilder");
const Embed_1 = require("./Embed");
const serialize_1 = require("../utils/serialize");
/** Resolve EmbedBuilder instances to plain API objects */
function resolveEmbeds(embeds) {
    if (!embeds)
        return undefined;
    return embeds.map(e => e instanceof EmbedBuilder_1.EmbedBuilder ? e.toJSON() : e);
}
/** Normalize embed from backend to APIEmbed format */
function normalizeEmbed(embed) {
    const normalized = {
        title: embed.title,
        description: embed.description,
        url: embed.url,
        timestamp: embed.timestamp,
        color: embed.color,
        fields: embed.fields,
        author: embed.author,
        footer: embed.footer,
    };
    // Normalize thumbnail: string → nested object
    if (typeof embed.thumbnail === 'string') {
        normalized.thumbnail = { url: embed.thumbnail };
    }
    else if (embed.thumbnail && typeof embed.thumbnail === 'object') {
        normalized.thumbnail = embed.thumbnail;
    }
    // Normalize image: string → nested object
    if (typeof embed.image === 'string') {
        normalized.image = { url: embed.image };
    }
    else if (embed.image && typeof embed.image === 'object') {
        normalized.image = embed.image;
    }
    return normalized;
}
/**
 * Represents a reaction to a message
 * Discord.js compatible
 */
class MessageReaction {
    /** The message this reaction belongs to */
    message;
    /** The emoji identifier (unicode or custom format) */
    emoji;
    /** Whether the bot reacted with this emoji */
    me;
    /** Reaction count (if known) */
    count;
    constructor(message, emoji, me = false, count = 1) {
        this.message = message;
        this.emoji = new ReactionEmoji(emoji);
        this.me = me;
        this.count = count;
    }
    /**
     * Remove the bot's reaction
     * Discord.js compatible: reaction.remove()
     */
    async remove() {
        const guildId = this.message.guildId || '';
        await this.message.client.rest.removeReaction(guildId, this.message.channelId, this.message.id, this.emoji.identifier);
        this.me = false;
    }
    /**
     * Convert to string
     */
    toString() {
        return this.emoji.toString();
    }
}
exports.MessageReaction = MessageReaction;
/**
 * Represents a reaction emoji
 * Discord.js compatible
 */
class ReactionEmoji {
    /** Emoji name (for unicode: the character itself, for custom: the name) */
    name;
    /** Emoji ID (only for custom emojis) */
    id;
    /** Whether the emoji is animated (only for custom emojis) */
    animated;
    /** Raw identifier string */
    identifier;
    constructor(emoji) {
        this.identifier = emoji;
        // Parse custom emoji: <a:name:id> or <:name:id>
        const customMatch = emoji.match(/^<(a)?:(\w+):(\d+)>$/);
        if (customMatch) {
            this.animated = !!customMatch[1];
            this.name = customMatch[2];
            this.id = customMatch[3];
        }
        else if (emoji.startsWith(':') && emoji.endsWith(':')) {
            // :name: format
            this.animated = false;
            this.name = emoji.slice(1, -1);
            this.id = null;
        }
        else {
            // Unicode emoji
            this.animated = false;
            this.name = emoji;
            this.id = null;
        }
    }
    /**
     * Convert to string representation
     */
    toString() {
        if (this.id) {
            return this.animated ? `<a:${this.name}:${this.id}>` : `<:${this.name}:${this.id}>`;
        }
        return this.name;
    }
}
exports.ReactionEmoji = ReactionEmoji;
/**
 * Represents a message
 */
class Message {
    /** Reference to the client */
    client;
    /** Cached channel instance */
    _channel;
    /** Message ID */
    id;
    /** Channel ID */
    channelId;
    /** Guild ID (if in a guild) */
    guildId;
    /** Message author */
    author;
    /** Message content */
    content;
    /** Message creation timestamp (milliseconds since epoch) */
    createdTimestamp;
    /** Edit timestamp */
    editedTimestamp;
    /** Attachments */
    attachments;
    /** Embeds */
    embeds;
    /** Components (buttons, select menus, etc.) */
    components;
    /** Mentions in the message */
    mentions;
    /** User ID (from backend) */
    user_id;
    /** Guild member (if in a guild) */
    member;
    constructor(client, data) {
        this.client = client;
        this.id = data.id;
        this.channelId = data.channel_id;
        this.guildId = data.guild_id;
        // author may be missing in minimal message payloads (e.g., interaction.message)
        this.author = data.author ? new User_1.User(data.author, client) : new User_1.User({ id: '0', username: 'Unknown' }, client);
        this.content = data.content ?? '';
        // Handle different timestamp formats from backend
        const timestamp = data.timestamp || data.created_at;
        this.createdTimestamp = timestamp ? new Date(timestamp).getTime() : Date.now();
        const editedTimestamp = data.edited_timestamp || data.updated_at;
        this.editedTimestamp = editedTimestamp ? new Date(editedTimestamp).getTime() : undefined;
        this.attachments = data.attachments || [];
        // Normalize embeds from backend (flat format → nested format) and wrap in Embed class
        this.embeds = data.embeds ? data.embeds.map(e => new Embed_1.Embed(normalizeEmbed(e))) : [];
        // Components (ActionRows with buttons, select menus, etc.)
        this.components = data.components || [];
        this.mentions = data.mentions || {};
        this.user_id = data.user_id;
    }
    /**
     * The channel this message was sent in
     * refactored - artık TextChannel instance döndürüyor, DRY
     * Caches the TextChannel instance for performance
     */
    get channel() {
        // Return cached channel if available
        if (this._channel)
            return this._channel;
        // Guild cache'den channel data al
        const channelData = this.guildId
            ? this.client.guilds.get(this.guildId)?.channels.get(this.channelId)
            : undefined;
        // TextChannel oluştur - cache'deki data veya minimal data ile
        this._channel = new Channel_1.TextChannel(this.client, {
            id: this.channelId,
            guild_id: this.guildId,
            type: 0, // GuildText
            name: channelData?.name,
            topic: channelData?.topic,
            position: channelData?.position,
            parent_id: channelData?.parent_id,
        });
        return this._channel;
    }
    /**
     * Get the creation date
     */
    get createdAt() {
        return new Date(this.createdTimestamp);
    }
    /**
     * The guild this message was sent in (if in a guild)
     * Discord.js compatible: message.guild
     */
    get guild() {
        if (!this.guildId)
            return null;
        return this.client.guilds.get(this.guildId) ?? null;
    }
    /**
     * Get the edit date
     */
    get editedAt() {
        return this.editedTimestamp ? new Date(this.editedTimestamp) : null;
    }
    /**
     * Reply to this message
     * Bug #8 fix - embed tekil, Bug #10 fix - flags desteği
     */
    async reply(options) {
        const content = typeof options === 'string' ? options : options.content;
        // Bug #8 fix - embed tekil kullanımı
        const rawEmbeds = typeof options === 'string'
            ? undefined
            : (options.embeds || (options.embed ? [options.embed] : undefined));
        const embeds = resolveEmbeds(rawEmbeds);
        const components = typeof options === 'string' ? undefined : (0, serialize_1.serializeComponents)(options.components);
        const flags = typeof options === 'string' ? undefined : options.flags;
        const data = await this.client.rest.createMessage(this.guildId || '', this.channelId, {
            content,
            embeds,
            components,
            flags,
            message_reference: { message_id: this.id }
        });
        return new Message(this.client, data);
    }
    /**
     * Edit this message (only if author is the bot)
     */
    async edit(options) {
        const content = typeof options === 'string' ? options : options.content;
        const embeds = typeof options === 'string' ? undefined : resolveEmbeds(options.embeds);
        const components = typeof options === 'string' ? undefined : (0, serialize_1.serializeComponents)(options.components);
        const data = await this.client.rest.editMessage(this.guildId || '', this.channelId, this.id, {
            flags: typeof options === 'string' ? undefined : options.flags,
            content,
            embeds,
            components,
        });
        return new Message(this.client, data);
    }
    /**
     * Delete this message
     */
    async delete() {
        await this.client.rest.deleteMessage(this.guildId || '', this.channelId, this.id);
    }
    /**
     * React to this message with an emoji
     * Discord.js compatible: message.react('👍')
     *
     * @param emoji - Unicode emoji (👍), :name:, <:name:id>, or <a:name:id> format
     * @returns MessageReaction object for chaining
     *
     * @example
     * // React with unicode emoji
     * await message.react('👍');
     *
     * // React with custom emoji
     * await message.react('<:custom:123456789>');
     *
     * // Chain multiple reactions
     * await message.react('👍');
     * await message.react('❤️');
     */
    async react(emoji) {
        await this.client.rest.addReaction(this.guildId || '', this.channelId, this.id, emoji);
        return new MessageReaction(this, emoji, true);
    }
    /**
     * Pin this message
     */
    async pin() {
        await this.client.rest.pinMessage(this.guildId || '', this.channelId, this.id);
    }
    /**
     * Unpin this message
     */
    async unpin() {
        await this.client.rest.unpinMessage(this.guildId || '', this.channelId, this.id);
    }
    /**
     * Create a component interaction collector on this message
     */
    createMessageComponentCollector(options) {
        return new Collector_1.InteractionCollector(this.client, {
            ...options,
            messageId: this.id,
            channelId: this.channelId,
            guildId: this.guildId,
        });
    }
    /**
     * Await component interactions on this message
     */
    awaitMessageComponent(options) {
        return new Promise((resolve, reject) => {
            const collector = this.createMessageComponentCollector({ ...options, max: 1 });
            collector.once('end', (collected, reason) => {
                const first = collected.first();
                if (first) {
                    resolve(first);
                }
                else {
                    reject(new Error(reason || 'No interaction received'));
                }
            });
        });
    }
    /**
     * Convert to string
     */
    toString() {
        return this.content;
    }
}
exports.Message = Message;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWVzc2FnZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zdHJ1Y3R1cmVzL01lc3NhZ2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQ0EsaUNBQThCO0FBSTlCLHVDQUF3QztBQUV4QyxrREFBdUY7QUFDdkYsMkRBQXdEO0FBQ3hELG1DQUFnQztBQUNoQyxrREFBMEU7QUFFMUUsMERBQTBEO0FBQzFELFNBQVMsYUFBYSxDQUFDLE1BQW9DO0lBQ3pELElBQUksQ0FBQyxNQUFNO1FBQUUsT0FBTyxTQUFTLENBQUM7SUFDOUIsT0FBTyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxZQUFZLDJCQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDckUsQ0FBQztBQUVELHNEQUFzRDtBQUN0RCxTQUFTLGNBQWMsQ0FBQyxLQUE0RjtJQUNsSCxNQUFNLFVBQVUsR0FBYTtRQUMzQixLQUFLLEVBQUUsS0FBSyxDQUFDLEtBQUs7UUFDbEIsV0FBVyxFQUFFLEtBQUssQ0FBQyxXQUFXO1FBQzlCLEdBQUcsRUFBRSxLQUFLLENBQUMsR0FBRztRQUNkLFNBQVMsRUFBRSxLQUFLLENBQUMsU0FBUztRQUMxQixLQUFLLEVBQUUsS0FBSyxDQUFDLEtBQUs7UUFDbEIsTUFBTSxFQUFFLEtBQUssQ0FBQyxNQUFNO1FBQ3BCLE1BQU0sRUFBRSxLQUFLLENBQUMsTUFBTTtRQUNwQixNQUFNLEVBQUUsS0FBSyxDQUFDLE1BQU07S0FDckIsQ0FBQztJQUVGLDhDQUE4QztJQUM5QyxJQUFJLE9BQU8sS0FBSyxDQUFDLFNBQVMsS0FBSyxRQUFRLEVBQUUsQ0FBQztRQUN4QyxVQUFVLENBQUMsU0FBUyxHQUFHLEVBQUUsR0FBRyxFQUFFLEtBQUssQ0FBQyxTQUFTLEVBQUUsQ0FBQztJQUNsRCxDQUFDO1NBQU0sSUFBSSxLQUFLLENBQUMs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QUFNLElBQUkseUJBQXlCLENBQUMsQ0FBQyxDQUFDO2dCQUN6RCxDQUFDO1lBQ0gsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRDs7T0FFRztJQUNILFFBQVE7UUFDTixPQUFPLElBQUksQ0FBQyxPQUFPLENBQUM7SUFDdEIsQ0FBQztDQUNGO0FBeFBELDBCQXdQQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFQSU1lc3NhZ2UsIEFQSUVtYmVkLCBBUElBdHRhY2htZW50IH0gZnJvbSAnLi4vdHlwZXMnO1xyXG5pbXBvcnQgeyBVc2VyIH0gZnJvbSAnLi9Vc2VyJztcclxuaW1wb3J0IHsgR3VpbGRNZW1iZXIgfSBmcm9tICcuL0d1aWxkTWVtYmVyJztcclxuaW1wb3J0IHR5cGUgeyBDbGllbnQgfSBmcm9tICcuLi9DbGllbnQnO1xyXG5pbXBvcnQgdHlwZSB7IE1lc3NhZ2VDcmVhdGVPcHRpb25zIH0gZnJvbSAnLi9DaGFubmVsJztcclxuaW1wb3J0IHsgVGV4dENoYW5uZWwgfSBmcm9tICcuL0NoYW5uZWwnO1xyXG5pbXBvcnQgeyBDb2xsZWN0aW9uIH0gZnJvbSAnLi9Db2xsZWN0aW9uJztcclxuaW1wb3J0IHsgSW50ZXJhY3Rpb25Db2xsZWN0b3IsIEludGVyYWN0aW9uQ29sbGVjdG9yT3B0aW9ucyB9IGZyb20gJy4uL3V0aWxzL0NvbGxlY3Rvcic7XHJcbmltcG9ydCB7IEVtYmVkQnVpbGRlciB9IGZyb20gJy4uL2J1aWxkZXJzL0VtYmVkQnVpbGRlcic7XHJcbmltcG9ydCB7IEVtYmVkIH0gZnJvbSAnLi9FbWJlZCc7XHJcbmltcG9ydCB7IHNlcmlhbGl6ZUNvbXBvbmVudHMsIG5vcm1hbGl6ZUVtYmVkcyB9IGZyb20gJy4uL3V0aWxzL3NlcmlhbGl6ZSc7XHJcblxyXG4vKiogUmVzb2x2ZSBFbWJlZEJ1aWxkZXIgaW5zdGFuY2VzIHRvIHBsYWluIEFQSSBvYmplY3RzICovXHJcbmZ1bmN0aW9uIHJlc29sdmVFbWJlZHMoZW1iZWRzPzogKEFQSUVtYmVkIHwgRW1iZWRCdWlsZGVyKVtdKTogQVBJRW1iZWRbXSB8IHVuZGVmaW5lZCB7XHJcbiAgaWYgKCFlbWJlZHMpIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgcmV0dXJuIGVtYmVkcy5tYXAoZSA9PiBlIGluc3RhbmNlb2YgRW1iZWRCdWlsZGVyID8gZS50b0pTT04oKSA6IGUpO1xyXG59XHJcblxyXG4vKiogTm9ybWFsaXplIGVtYmVkIGZyb20gYmFja2VuZCB0byBBUElFbWJlZCBmb3JtYXQgKi9cclxuZnVuY3Rpb24gbm9ybWFsaXplRW1iZWQoZW1iZWQ6IEFQSUVtYmVkICYgeyBpbWFnZT86IHsgdXJsOiBzdHJpbmcgfSB8IHN0cmluZzsgdGh1bWJuYWlsPzogeyB1cmw6IHN0cmluZyB9IHwgc3RyaW5nIH0pOiBBUElFbWJlZCB7XHJcbiAgY29uc3Qgbm9ybWFsaXplZDogQVBJRW1iZWQgPSB7XHJcbiAgICB0aXRsZTogZW1iZWQudGl0bGUsXHJcbiAgICBkZXNjcmlwdGlvbjogZW1iZWQuZGVzY3JpcHRpb24sXHJcbiAgICB1cmw6IGVtYmVkLnVybCxcclxuICAgIHRpbWVzdGFtcDogZW1iZWQudGltZXN0YW1wLFxyXG4gICAgY29sb3I6IGVtYmVkLmNvbG9yLFxyXG4gICAgZmllbGRzOiBlbWJlZC5maWVsZHMsXHJcbiAgICBhdXRob3I6IGVtYmVkLmF1dGhvcixcclxuICAgIGZvb3RlcjogZW1iZWQuZm9vdGVyLFxyXG4gIH07XHJcblxyXG4gIC8vIE5vcm1hbGl6ZSB0aHVtYm5haWw6IHN0cmluZyDihpIgbmVzdGVkIG9iamVjdFxyXG4gIGlmICh0eXBlb2YgZW1iZWQudGh1bWJuYWlsID09PSAnc3RyaW5nJykge1xyXG4gICAgbm9ybWFsaXplZC50aHVtYm5haWwgPSB7IHVybDogZW1iZWQudGh1bWJuYWlsIH07XHJcbiAgfSBlbHNlIGlmIChlbWJlZC50aHVtYm5haWwgJiYgdHlwZW9mIGVtYmVkLnRodW1ibmFpbCA9PT0gJ29iamVjdCcpIHtcclxuICAgIG5vcm1hbGl6ZWQudGh1bWJuYWlsID0gZW1iZWQudGh1bWJuYWlsO1xyXG4gIH1cclxuXHJcbiAgLy8gTm9ybWFsaXplIGltYWdlOiBzdHJpbmcg4oaSIG5lc3RlZCBvYmplY3RcclxuICBpZiAodHlwZW9mIGVtYmVkLmltYWdlID09PSAnc3RyaW5nJykge1xyXG4gICAgbm9ybWFsaXplZC5pbWFnZSA9IHsgdXJsOiBlbWJlZC5pbWFnZSB9O1xyXG4gIH0gZWxzZSBpZiAoZW1iZWQuaW1hZ2UgJiYgdHlwZW9mIGVtYmVkLmltYWdlID09PSAnb2JqZWN0Jykge1xyXG4gICAgbm9ybWFsaXplZC5pbWFnZSA9IGVtYmVkLmltYWdlO1xyXG4gIH1cclxuXHJcbiAgcmV0dXJuIG5vcm1hbGl6ZWQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBNZW50aW9uIGRhdGEgZnJvbSBiYWNrZW5kXHJcbiAqL1xyXG5leHBvcnQgaW50ZXJmYWNlIE1lc3NhZ2VNZW50aW9ucyB7XHJcbiAgdXNlcnM/OiBBcnJheTx7IGlkOiBudW1iZXIgfCBzdHJpbmc7IHVzZXJuYW1lOiBzdHJpbmcgfT47XHJcbiAgcm9sZXM/OiBBcnJheTx7IGlkOiBzdHJpbmc7IG5hbWU/OiBzdHJpbmcgfT47XHJcbiAgZXZlcnlvbmU/OiBib29sZWFuO1xyXG59XHJcblxyXG4vKipcclxuICogUmVwcmVzZW50cyBhIHJlYWN0aW9uIHRvIGEgbWVzc2FnZVxyXG4gKiBEaXNjb3JkLmpzIGNvbXBhdGlibGVcclxuICovXHJcbmV4cG9ydCBjbGFzcyBNZXNzYWdlUmVhY3Rpb24ge1xyXG4gIC8qKiBUaGUgbWVzc2FnZSB0aGlzIHJlYWN0aW9uIGJlbG9uZ3MgdG8gKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgbWVzc2FnZTogTWVzc2FnZTtcclxuXHJcbiAgLyoqIFRoZSBlbW9qaSBpZGVudGlmaWVyICh1bmljb2RlIG9yIGN1c3RvbSBmb3JtYXQpICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGVtb2ppOiBSZWFjdGlvbkVtb2ppO1xyXG5cclxuICAvKiogV2hldGhlciB0aGUgYm90IHJlYWN0ZWQgd2l0aCB0aGlzIGVtb2ppICovXHJcbiAgcHVibGljIG1lOiBib29sZWFuO1xyXG5cclxuICAvKiogUmVhY3Rpb24gY291bnQgKGlmIGtub3duKSAqL1xyXG4gIHB1YmxpYyBjb3VudDogbnVtYmVyO1xyXG5cclxuICBjb25zdHJ1Y3RvcihtZXNzYWdlOiBNZXNzYWdlLCBlbW9qaTogc3RyaW5nLCBtZTogYm9vbGVhbiA9IGZhbHNlLCBjb3VudDogbnVtYmVyID0gMSkge1xyXG4gICAgdGhpcy5tZXNzYWdlID0gbWVzc2FnZTtcclxuICAgIHRoaXMuZW1vamkgPSBuZXcgUmVhY3Rpb25FbW9qaShlbW9qaSk7XHJcbiAgICB0aGlzLm1lID0gbWU7XHJcbiAgICB0aGlzLmNvdW50ID0gY291bnQ7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZW1vdmUgdGhlIGJvdCdzIHJlYWN0aW9uXHJcbiAgICogRGlzY29yZC5qcyBjb21wYXRpYmxlOiByZWFjdGlvbi5yZW1vdmUoKVxyXG4gICAqL1xyXG4gIGFzeW5jIHJlbW92ZSgpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IGd1aWxkSWQgPSB0aGlzLm1lc3NhZ2UuZ3VpbGRJZCB8fCAnJztcclxuICAgIGF3YWl0IHRoaXMubWVzc2FnZS5jbGllbnQucmVzdC5yZW1vdmVSZWFjdGlvbihndWlsZElkLCB0aGlzLm1lc3NhZ2UuY2hhbm5lbElkLCB0aGlzLm1lc3NhZ2UuaWQsIHRoaXMuZW1vamkuaWRlbnRpZmllcik7XHJcbiAgICB0aGlzLm1lID0gZmFsc2U7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDb252ZXJ0IHRvIHN0cmluZ1xyXG4gICAqL1xyXG4gIHRvU3RyaW5nKCk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gdGhpcy5lbW9qaS50b1N0cmluZygpO1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIFJlcHJlc2VudHMgYSByZWFjdGlvbiBlbW9qaVxyXG4gKiBEaXNjb3JkLmpzIGNvbXBhdGlibGVcclxuICovXHJcbmV4cG9ydCBjbGFzcyBSZWFjdGlvbkVtb2ppIHtcclxuICAvKiogRW1vamkgbmFtZSAoZm9yIHVuaWNvZGU6IHRoZSBjaGFyYWN0ZXIgaXRzZWxmLCBmb3IgY3VzdG9tOiB0aGUgbmFtZSkgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgbmFtZTogc3RyaW5nO1xyXG5cclxuICAvKiogRW1vamkgSUQgKG9ubHkgZm9yIGN1c3RvbSBlbW9qaXMpICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGlkOiBzdHJpbmcgfCBudWxsO1xyXG5cclxuICAvKiogV2hldGhlciB0aGUgZW1vamkgaXMgYW5pbWF0ZWQgKG9ubHkgZm9yIGN1c3RvbSBlbW9qaXMpICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGFuaW1hdGVkOiBib29sZWFuO1xyXG5cclxuICAvKiogUmF3IGlkZW50aWZpZXIgc3RyaW5nICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGlkZW50aWZpZXI6IHN0cmluZztcclxuXHJcbiAgY29uc3RydWN0b3IoZW1vamk6IHN0cmluZykge1xyXG4gICAgdGhpcy5pZGVudGlmaWVyID0gZW1vamk7XHJcblxyXG4gICAgLy8gUGFyc2UgY3VzdG9tIGVtb2ppOiA8YTpuYW1lOmlkPiBvciA8Om5hbWU6aWQ+XHJcbiAgICBjb25zdCBjdXN0b21NYXRjaCA9IGVtb2ppLm1hdGNoKC9ePChhKT86KFxcdyspOihcXGQrKT4kLyk7XHJcbiAgICBpZiAoY3VzdG9tTWF0Y2gpIHtcclxuICAgICAgdGhpcy5hbmltYXRlZCA9ICEhY3VzdG9tTWF0Y2hbMV07XHJcbiAgICAgIHRoaXMubmFtZSA9IGN1c3RvbU1hdGNoWzJdO1xyXG4gICAgICB0aGlzLmlkID0gY3VzdG9tTWF0Y2hbM107XHJcbiAgICB9IGVsc2UgaWYgKGVtb2ppLnN0YXJ0c1dpdGgoJzonKSAmJiBlbW9qaS5lbmRzV2l0aCgnOicpKSB7XHJcbiAgICAgIC8vIDpuYW1lOiBmb3JtYXRcclxuICAgICAgdGhpcy5hbmltYXRlZCA9IGZhbHNlO1xyXG4gICAgICB0aGlzLm5hbWUgPSBlbW9qaS5zbGljZSgxLCAtMSk7XHJcbiAgICAgIHRoaXMuaWQgPSBudWxsO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgLy8gVW5pY29kZSBlbW9qaVxyXG4gICAgICB0aGlzLmFuaW1hdGVkID0gZmFsc2U7XHJcbiAgICAgIHRoaXMubmFtZSA9IGVtb2ppO1xyXG4gICAgICB0aGlzLmlkID0gbnVsbDtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENvbnZlcnQgdG8gc3RyaW5nIHJlcHJlc2VudGF0aW9uXHJcbiAgICovXHJcbiAgdG9TdHJpbmcoKTogc3RyaW5nIHtcclxuICAgIGlmICh0aGlzLmlkKSB7XHJcbiAgICAgIHJldHVybiB0aGlzLmFuaW1hdGVkID8gYDxhOiR7dGhpcy5uYW1lfToke3RoaXMuaWR9PmAgOiBgPDoke3RoaXMubmFtZX06JHt0aGlzLmlkfT5gO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRoaXMubmFtZTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBSZXByZXNlbnRzIGEgbWVzc2FnZVxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIE1lc3NhZ2Uge1xyXG4gIC8qKiBSZWZlcmVuY2UgdG8gdGhlIGNsaWVudCAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBjbGllbnQ6IENsaWVudDtcclxuICBcclxuICAvKiogQ2FjaGVkIGNoYW5uZWwgaW5zdGFuY2UgKi9cclxuICBwcml2YXRlIF9jaGFubmVsPzogVGV4dENoYW5uZWw7XHJcbiAgXHJcbiAgLyoqIE1lc3NhZ2UgSUQgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgaWQ6IHN0cmluZztcclxuICBcclxuICAvKiogQ2hhbm5lbCBJRCAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBjaGFubmVsSWQ6IHN0cmluZztcclxuICBcclxuICAvKiogR3VpbGQgSUQgKGlmIGluIGEgZ3VpbGQpICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGd1aWxkSWQ/OiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIE1lc3NhZ2UgYXV0aG9yICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGF1dGhvcjogVXNlcjtcclxuICBcclxuICAvKiogTWVzc2FnZSBjb250ZW50ICovXHJcbiAgcHVibGljIGNvbnRlbnQ6IHN0cmluZztcclxuICBcclxuICAvKiogTWVzc2FnZSBjcmVhdGlvbiB0aW1lc3RhbXAgKG1pbGxpc2Vjb25kcyBzaW5jZSBlcG9jaCkgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgY3JlYXRlZFRpbWVzdGFtcDogbnVtYmVyO1xyXG4gIFxyXG4gIC8qKiBFZGl0IHRpbWVzdGFtcCAqL1xyXG4gIHB1YmxpYyBlZGl0ZWRUaW1lc3RhbXA/OiBudW1iZXI7XHJcbiAgXHJcbiAgLyoqIEF0dGFjaG1lbnRzICovXHJcbiAgcHVibGljIGF0dGFjaG1lbnRzOiBBUElBdHRhY2htZW50W107XHJcbiAgXHJcbiAgLyoqIEVtYmVkcyAqL1xyXG4gIHB1YmxpYyBlbWJlZHM6IEVtYmVkW107XHJcblxyXG4gIC8qKiBDb21wb25lbnRzIChidXR0b25zLCBzZWxlY3QgbWVudXMsIGV0Yy4pICovXHJcbiAgcHVibGljIGNvbXBvbmVudHM6IGFueVtdO1xyXG5cclxuICAvKiogTWVudGlvbnMgaW4gdGhlIG1lc3NhZ2UgKi9cclxuICBwdWJsaWMgbWVudGlvbnM6IE1lc3NhZ2VNZW50aW9ucztcclxuXHJcbiAgLyoqIFVzZXIgSUQgKGZyb20gYmFja2VuZCkgKi9cclxuICBwdWJsaWMgdXNlcl9pZD86IG51bWJlcjtcclxuXHJcbiAgLyoqIEd1aWxkIG1lbWJlciAoaWYgaW4gYSBndWlsZCkgKi9cclxuICBwdWJsaWMgbWVtYmVyPzogR3VpbGRNZW1iZXI7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGNsaWVudDogQ2xpZW50LCBkYXRhOiBBUElNZXNzYWdlKSB7XHJcbiAgICB0aGlzLmNsaWVudCA9IGNsaWVudDtcclxuICAgIHRoaXMuaWQgPSBkYXRhLmlkO1xyXG4gICAgdGhpcy5jaGFubmVsSWQgPSBkYXRhLmNoYW5uZWxfaWQ7XHJcbiAgICB0aGlzLmd1aWxkSWQgPSBkYXRhLmd1aWxkX2lkO1xyXG4gICAgLy8gYXV0aG9yIG1heSBiZSBtaXNzaW5nIGluIG1pbmltYWwgbWVzc2FnZSBwYXlsb2FkcyAoZS5nLiwgaW50ZXJhY3Rpb24ubWVzc2FnZSlcclxuICAgIHRoaXMuYXV0aG9yID0gZGF0YS5hdXRob3IgPyBuZXcgVXNlcihkYXRhLmF1dGhvciwgY2xpZW50KSA6IG5ldyBVc2VyKHsgaWQ6ICcwJywgdXNlcm5hbWU6ICdVbmtub3duJyB9LCBjbGllbnQpO1xyXG4gICAgdGhpcy5jb250ZW50ID0gZGF0YS5jb250ZW50ID8/ICcnO1xyXG4gICAgXHJcbiAgICAvLyBIYW5kbGUgZGlmZmVyZW50IHRpbWVzdGFtcCBmb3JtYXRzIGZyb20gYmFja2VuZFxyXG4gICAgY29uc3QgdGltZXN0YW1wID0gZGF0YS50aW1lc3RhbXAgfHwgKGRhdGEgYXMgYW55KS5jcmVhdGVkX2F0O1xyXG4gICAgdGhpcy5jcmVhdGVkVGltZXN0YW1wID0gdGltZXN0YW1wID8gbmV3IERhdGUodGltZXN0YW1wKS5nZXRUaW1lKCkgOiBEYXRlLm5vdygpO1xyXG4gICAgXHJcbiAgICBjb25zdCBlZGl0ZWRUaW1lc3RhbXAgPSBkYXRhLmVkaXRlZF90aW1lc3RhbXAgfHwgKGRhdGEgYXMgYW55KS51cGRhdGVkX2F0O1xyXG4gICAgdGhpcy5lZGl0ZWRUaW1lc3RhbXAgPSBlZGl0ZWRUaW1lc3RhbXAgPyBuZXcgRGF0ZShlZGl0ZWRUaW1lc3RhbXApLmdldFRpbWUoKSA6IHVuZGVmaW5lZDtcclxuICAgIFxyXG4gICAgdGhpcy5hdHRhY2htZW50cyA9IGRhdGEuYXR0YWNobWVudHMgfHwgW107XHJcbiAgICBcclxuICAgIC8vIE5vcm1hbGl6ZSBlbWJlZHMgZnJvbSBiYWNrZW5kIChmbGF0IGZvcm1hdCDihpIgbmVzdGVkIGZvcm1hdCkgYW5kIHdyYXAgaW4gRW1iZWQgY2xhc3NcclxuICAgIHRoaXMuZW1iZWRzID0gZGF0YS5lbWJlZHMgPyBkYXRhLmVtYmVkcy5tYXAoZSA9PiBuZXcgRW1iZWQobm9ybWFsaXplRW1iZWQoZSkpKSA6IFtdO1xyXG4gICAgXHJcbiAgICAvLyBDb21wb25lbnRzIChBY3Rpb25Sb3dzIHdpdGggYnV0dG9ucywgc2VsZWN0IG1lbnVzLCBldGMuKVxyXG4gICAgdGhpcy5jb21wb25lbnRzID0gKGRhdGEgYXMgYW55KS5jb21wb25lbnRzIHx8IFtdO1xyXG4gICAgXHJcbiAgICB0aGlzLm1lbnRpb25zID0gKGRhdGEgYXMgYW55KS5tZW50aW9ucyB8fCB7fTtcclxuICAgIHRoaXMudXNlcl9pZCA9IChkYXRhIGFzIGFueSkudXNlcl9pZDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFRoZSBjaGFubmVsIHRoaXMgbWVzc2FnZSB3YXMgc2VudCBpblxyXG4gICAqIHJlZmFjdG9yZWQgLSBhcnTEsWsgVGV4dENoYW5uZWwgaW5zdGFuY2UgZMO2bmTDvHLDvHlvciwgRFJZXHJcbiAgICogQ2FjaGVzIHRoZSBUZXh0Q2hhbm5lbCBpbnN0YW5jZSBmb3IgcGVyZm9ybWFuY2VcclxuICAgKi9cclxuICBnZXQgY2hhbm5lbCgpOiBUZXh0Q2hhbm5lbCB7XHJcbiAgICAvLyBSZXR1cm4gY2FjaGVkIGNoYW5uZWwgaWYgYXZhaWxhYmxlXHJcbiAgICBpZiAodGhpcy5fY2hhbm5lbCkgcmV0dXJuIHRoaXMuX2NoYW5uZWw7XHJcbiAgICBcclxuICAgIC8vIEd1aWxkIGNhY2hlJ2RlbiBjaGFubmVsIGRhdGEgYWxcclxuICAgIGNvbnN0IGNoYW5uZWxEYXRhID0gdGhpcy5ndWlsZElkIFxyXG4gICAgICA/IHRoaXMuY2xpZW50Lmd1aWxkcy5nZXQodGhpcy5ndWlsZElkKT8uY2hhbm5lbHMuZ2V0KHRoaXMuY2hhbm5lbElkKVxyXG4gICAgICA6IHVuZGVmaW5lZDtcclxuICAgIFxyXG4gICAgLy8gVGV4dENoYW5uZWwgb2x1xZ90dXIgLSBjYWNoZSdkZWtpIGRhdGEgdmV5YSBtaW5pbWFsIGRhdGEgaWxlXHJcbiAgICB0aGlzLl9jaGFubmVsID0gbmV3IFRleHRDaGFubmVsKHRoaXMuY2xpZW50LCB7XHJcbiAgICAgIGlkOiB0aGlzLmNoYW5uZWxJZCxcclxuICAgICAgZ3VpbGRfaWQ6IHRoaXMuZ3VpbGRJZCxcclxuICAgICAgdHlwZTogMCwgLy8gR3VpbGRUZXh0XHJcbiAgICAgIG5hbWU6IChjaGFubmVsRGF0YSBhcyBhbnkpPy5uYW1lLFxyXG4gICAgICB0b3BpYzogKGNoYW5uZWxEYXRhIGFzIGFueSk/LnRvcGljLFxyXG4gICAgICBwb3NpdGlvbjogKGNoYW5uZWxEYXRhIGFzIGFueSk/LnBvc2l0aW9uLFxyXG4gICAgICBwYXJlbnRfaWQ6IChjaGFubmVsRGF0YSBhcyBhbnkpPy5wYXJlbnRfaWQsXHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgcmV0dXJuIHRoaXMuX2NoYW5uZWw7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgdGhlIGNyZWF0aW9uIGRhdGVcclxuICAgKi9cclxuICBnZXQgY3JlYXRlZEF0KCk6IERhdGUge1xyXG4gICAgcmV0dXJuIG5ldyBEYXRlKHRoaXMuY3JlYXRlZFRpbWVzdGFtcCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBUaGUgZ3VpbGQgdGhpcyBtZXNzYWdlIHdhcyBzZW50IGluIChpZiBpbiBhIGd1aWxkKVxyXG4gICAqIERpc2NvcmQuanMgY29tcGF0aWJsZTogbWVzc2FnZS5ndWlsZFxyXG4gICAqL1xyXG4gIGdldCBndWlsZCgpIHtcclxuICAgIGlmICghdGhpcy5ndWlsZElkKSByZXR1cm4gbnVsbDtcclxuICAgIHJldHVybiB0aGlzLmNsaWVudC5ndWlsZHMuZ2V0KHRoaXMuZ3VpbGRJZCkgPz8gbnVsbDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCB0aGUgZWRpdCBkYXRlXHJcbiAgICovXHJcbiAgZ2V0IGVkaXRlZEF0KCk6IERhdGUgfCBudWxsIHtcclxuICAgIHJldHVybiB0aGlzLmVkaXRlZFRpbWVzdGFtcCA/IG5ldyBEYXRlKHRoaXMuZWRpdGVkVGltZXN0YW1wKSA6IG51bGw7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZXBseSB0byB0aGlzIG1lc3NhZ2VcclxuICAgKiBCdWcgIzggZml4IC0gZW1iZWQgdGVraWwsIEJ1ZyAjMTAgZml4IC0gZmxhZ3MgZGVzdGXEn2lcclxuICAgKi9cclxuICBhc3luYyByZXBseShvcHRpb25zOiBzdHJpbmcgfCBNZXNzYWdlQ3JlYXRlT3B0aW9ucyk6IFByb21pc2U8TWVzc2FnZT4ge1xyXG4gICAgY29uc3QgY29udGVudCA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IG9wdGlvbnMgOiBvcHRpb25zLmNvbnRlbnQ7XHJcbiAgICAvLyBCdWcgIzggZml4IC0gZW1iZWQgdGVraWwga3VsbGFuxLFtxLFcclxuICAgIGNvbnN0IHJhd0VtYmVkcyA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyBcclxuICAgICAgPyB1bmRlZmluZWQgXHJcbiAgICAgIDogKG9wdGlvbnMuZW1iZWRzIHx8IChvcHRpb25zLmVtYmVkID8gW29wdGlvbnMuZW1iZWRdIDogdW5kZWZpbmVkKSk7XHJcbiAgICBjb25zdCBlbWJlZHMgPSByZXNvbHZlRW1iZWRzKHJhd0VtYmVkcyk7XHJcbiAgICBjb25zdCBjb21wb25lbnRzID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gdW5kZWZpbmVkIDogc2VyaWFsaXplQ29tcG9uZW50cyhvcHRpb25zLmNvbXBvbmVudHMpO1xyXG4gICAgY29uc3QgZmxhZ3MgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyB1bmRlZmluZWQgOiBvcHRpb25zLmZsYWdzO1xyXG4gICAgXHJcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5jbGllbnQucmVzdC5jcmVhdGVNZXNzYWdlKHRoaXMuZ3VpbGRJZCB8fCAnJywgdGhpcy5jaGFubmVsSWQsIHtcclxuICAgICAgY29udGVudCxcclxuICAgICAgZW1iZWRzLFxyXG4gICAgICBjb21wb25lbnRzLFxyXG4gICAgICBmbGFncyxcclxuICAgICAgbWVzc2FnZV9yZWZlcmVuY2U6IHsgbWVzc2FnZV9pZDogdGhpcy5pZCB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgcmV0dXJuIG5ldyBNZXNzYWdlKHRoaXMuY2xpZW50LCBkYXRhKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEVkaXQgdGhpcyBtZXNzYWdlIChvbmx5IGlmIGF1dGhvciBpcyB0aGUgYm90KVxyXG4gICAqL1xyXG4gIGFzeW5jIGVkaXQob3B0aW9uczogc3RyaW5nIHwgTWVzc2FnZUNyZWF0ZU9wdGlvbnMpOiBQcm9taXNlPE1lc3NhZ2U+IHtcclxuICAgIGNvbnN0IGNvbnRlbnQgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyBvcHRpb25zIDogb3B0aW9ucy5jb250ZW50O1xyXG4gICAgY29uc3QgZW1iZWRzID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gdW5kZWZpbmVkIDogcmVzb2x2ZUVtYmVkcyhvcHRpb25zLmVtYmVkcyk7XHJcbiAgICBjb25zdCBjb21wb25lbnRzID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gdW5kZWZpbmVkIDogc2VyaWFsaXplQ29tcG9uZW50cyhvcHRpb25zLmNvbXBvbmVudHMpO1xyXG4gICAgXHJcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5jbGllbnQucmVzdC5lZGl0TWVzc2FnZSh0aGlzLmd1aWxkSWQgfHwgJycsIHRoaXMuY2hhbm5lbElkLCB0aGlzLmlkLCB7XHJcbiAgICAgIGZsYWdzOiB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyB1bmRlZmluZWQgOiBvcHRpb25zLmZsYWdzLFxyXG4gICAgICBjb250ZW50LFxyXG4gICAgICBlbWJlZHMsXHJcbiAgICAgIGNvbXBvbmVudHMsXHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgcmV0dXJuIG5ldyBNZXNzYWdlKHRoaXMuY2xpZW50LCBkYXRhKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlbGV0ZSB0aGlzIG1lc3NhZ2VcclxuICAgKi9cclxuICBhc3luYyBkZWxldGUoKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LmRlbGV0ZU1lc3NhZ2UodGhpcy5ndWlsZElkIHx8ICcnLCB0aGlzLmNoYW5uZWxJZCwgdGhpcy5pZCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZWFjdCB0byB0aGlzIG1lc3NhZ2Ugd2l0aCBhbiBlbW9qaVxyXG4gICAqIERpc2NvcmQuanMgY29tcGF0aWJsZTogbWVzc2FnZS5yZWFjdCgn8J+RjScpXHJcbiAgICogXHJcbiAgICogQHBhcmFtIGVtb2ppIC0gVW5pY29kZSBlbW9qaSAo8J+RjSksIDpuYW1lOiwgPDpuYW1lOmlkPiwgb3IgPGE6bmFtZTppZD4gZm9ybWF0XHJcbiAgICogQHJldHVybnMgTWVzc2FnZVJlYWN0aW9uIG9iamVjdCBmb3IgY2hhaW5pbmdcclxuICAgKiBcclxuICAgKiBAZXhhbXBsZVxyXG4gICAqIC8vIFJlYWN0IHdpdGggdW5pY29kZSBlbW9qaVxyXG4gICAqIGF3YWl0IG1lc3NhZ2UucmVhY3QoJ/CfkY0nKTtcclxuICAgKiBcclxuICAgKiAvLyBSZWFjdCB3aXRoIGN1c3RvbSBlbW9qaVxyXG4gICAqIGF3YWl0IG1lc3NhZ2UucmVhY3QoJzw6Y3VzdG9tOjEyMzQ1Njc4OT4nKTtcclxuICAgKiBcclxuICAgKiAvLyBDaGFpbiBtdWx0aXBsZSByZWFjdGlvbnNcclxuICAgKiBhd2FpdCBtZXNzYWdlLnJlYWN0KCfwn5GNJyk7XHJcbiAgICogYXdhaXQgbWVzc2FnZS5yZWFjdCgn4p2k77iPJyk7XHJcbiAgICovXHJcbiAgYXN5bmMgcmVhY3QoZW1vamk6IHN0cmluZyk6IFByb21pc2U8TWVzc2FnZVJlYWN0aW9uPiB7XHJcbiAgICBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LmFkZFJlYWN0aW9uKHRoaXMuZ3VpbGRJZCB8fCAnJywgdGhpcy5jaGFubmVsSWQsIHRoaXMuaWQsIGVtb2ppKTtcclxuICAgIHJldHVybiBuZXcgTWVzc2FnZVJlYWN0aW9uKHRoaXMsIGVtb2ppLCB0cnVlKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFBpbiB0aGlzIG1lc3NhZ2VcclxuICAgKi9cclxuICBhc3luYyBwaW4oKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LnBpbk1lc3NhZ2UodGhpcy5ndWlsZElkIHx8ICcnLCB0aGlzLmNoYW5uZWxJZCwgdGhpcy5pZCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBVbnBpbiB0aGlzIG1lc3NhZ2VcclxuICAgKi9cclxuICBhc3luYyB1bnBpbigpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGF3YWl0IHRoaXMuY2xpZW50LnJlc3QudW5waW5NZXNzYWdlKHRoaXMuZ3VpbGRJZCB8fCAnJywgdGhpcy5jaGFubmVsSWQsIHRoaXMuaWQpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgY29tcG9uZW50IGludGVyYWN0aW9uIGNvbGxlY3RvciBvbiB0aGlzIG1lc3NhZ2VcclxuICAgKi9cclxuICBjcmVhdGVNZXNzYWdlQ29tcG9uZW50Q29sbGVjdG9yKG9wdGlvbnM/OiBPbWl0PEludGVyYWN0aW9uQ29sbGVjdG9yT3B0aW9ucywgJ21lc3NhZ2VJZCc+KTogSW50ZXJhY3Rpb25Db2xsZWN0b3Ige1xyXG4gICAgcmV0dXJuIG5ldyBJbnRlcmFjdGlvbkNvbGxlY3Rvcih0aGlzLmNsaWVudCwge1xyXG4gICAgICAuLi5vcHRpb25zLFxyXG4gICAgICBtZXNzYWdlSWQ6IHRoaXMuaWQsXHJcbiAgICAgIGNoYW5uZWxJZDogdGhpcy5jaGFubmVsSWQsXHJcbiAgICAgIGd1aWxkSWQ6IHRoaXMuZ3VpbGRJZCxcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQXdhaXQgY29tcG9uZW50IGludGVyYWN0aW9ucyBvbiB0aGlzIG1lc3NhZ2VcclxuICAgKi9cclxuICBhd2FpdE1lc3NhZ2VDb21wb25lbnQob3B0aW9ucz86IE9taXQ8SW50ZXJhY3Rpb25Db2xsZWN0b3JPcHRpb25zLCAnbWVzc2FnZUlkJyB8ICdtYXgnPik6IFByb21pc2U8YW55PiB7XHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICBjb25zdCBjb2xsZWN0b3IgPSB0aGlzLmNyZWF0ZU1lc3NhZ2VDb21wb25lbnRDb2xsZWN0b3IoeyAuLi5vcHRpb25zLCBtYXg6IDEgfSk7XHJcbiAgICAgIFxyXG4gICAgICBjb2xsZWN0b3Iub25jZSgnZW5kJywgKGNvbGxlY3RlZCwgcmVhc29uKSA9PiB7XHJcbiAgICAgICAgY29uc3QgZmlyc3QgPSBjb2xsZWN0ZWQuZmlyc3QoKTtcclxuICAgICAgICBpZiAoZmlyc3QpIHtcclxuICAgICAgICAgIHJlc29sdmUoZmlyc3QpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICByZWplY3QobmV3IEVycm9yKHJlYXNvbiB8fCAnTm8gaW50ZXJhY3Rpb24gcmVjZWl2ZWQnKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ29udmVydCB0byBzdHJpbmdcclxuICAgKi9cclxuICB0b1N0cmluZygpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIHRoaXMuY29udGVudDtcclxuICB9XHJcbn1cclxuIl19