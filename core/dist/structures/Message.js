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
        // ponytail: author may be missing in minimal message payloads (e.g., interaction.message)
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
     * ponytail: refactored - artık TextChannel instance döndürüyor, DRY
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
     * ponytail: Bug #8 fix - embed tekil, Bug #10 fix - flags desteği
     */
    async reply(options) {
        const content = typeof options === 'string' ? options : options.content;
        // ponytail: Bug #8 fix - embed tekil kullanımı
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWVzc2FnZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zdHJ1Y3R1cmVzL01lc3NhZ2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQ0EsaUNBQThCO0FBSTlCLHVDQUF3QztBQUV4QyxrREFBdUY7QUFDdkYsMkRBQXdEO0FBQ3hELG1DQUFnQztBQUNoQyxrREFBMEU7QUFFMUUsMERBQTBEO0FBQzFELFNBQVMsYUFBYSxDQUFDLE1BQW9DO0lBQ3pELElBQUksQ0FBQyxNQUFNO1FBQUUsT0FBTyxTQUFTLENBQUM7SUFDOUIsT0FBTyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxZQUFZLDJCQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDckUsQ0FBQztBQUVELHNEQUFzRDtBQUN0RCxTQUFTLGNBQWMsQ0FBQyxLQUE0RjtJQUNsSCxNQUFNLFVBQVUsR0FBYTtRQUMzQixLQUFLLEVBQUUsS0FBSyxDQUFDLEtBQUs7UUFDbEIsV0FBVyxFQUFFLEtBQUssQ0FBQyxXQUFXO1FBQzlCLEdBQUcsRUFBRSxLQUFLLENBQUMsR0FBRztRQUNkLFNBQVMsRUFBRSxLQUFLLENBQUMsU0FBUztRQUMxQixLQUFLLEVBQUUsS0FBSyxDQUFDLEtBQUs7UUFDbEIsTUFBTSxFQUFFLEtBQUssQ0FBQyxNQUFNO1FBQ3BCLE1BQU0sRUFBRSxLQUFLLENBQUMsTUFBTTtRQUNwQixNQUFNLEVBQUUsS0FBSyxDQUFDLE1BQU07S0FDckIsQ0FBQztJQUVGLDhDQUE4QztJQUM5QyxJQUFJLE9BQU8sS0FBSyxDQUFDLFNBQVMsS0FBSyxRQUFRLEVBQUUsQ0FBQztRQUN4QyxVQUFVLENBQUMsU0FBUyxHQUFHLEVBQUUsR0FBRyxFQUFFLEtBQUssQ0FBQyxTQUFTLEVBQUUsQ0FBQztJQUNsRCxDQUFDO1NBQU0sSUFBSSxLQUFLLENBQUMs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TCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxRQUFRO1FBQ04sT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDO0lBQ3RCLENBQUM7Q0FDRjtBQXZQRCwwQkF1UEMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBUElNZXNzYWdlLCBBUElFbWJlZCwgQVBJQXR0YWNobWVudCB9IGZyb20gJy4uL3R5cGVzJztcclxuaW1wb3J0IHsgVXNlciB9IGZyb20gJy4vVXNlcic7XHJcbmltcG9ydCB7IEd1aWxkTWVtYmVyIH0gZnJvbSAnLi9HdWlsZE1lbWJlcic7XHJcbmltcG9ydCB0eXBlIHsgQ2xpZW50IH0gZnJvbSAnLi4vQ2xpZW50JztcclxuaW1wb3J0IHR5cGUgeyBNZXNzYWdlQ3JlYXRlT3B0aW9ucyB9IGZyb20gJy4vQ2hhbm5lbCc7XHJcbmltcG9ydCB7IFRleHRDaGFubmVsIH0gZnJvbSAnLi9DaGFubmVsJztcclxuaW1wb3J0IHsgQ29sbGVjdGlvbiB9IGZyb20gJy4vQ29sbGVjdGlvbic7XHJcbmltcG9ydCB7IEludGVyYWN0aW9uQ29sbGVjdG9yLCBJbnRlcmFjdGlvbkNvbGxlY3Rvck9wdGlvbnMgfSBmcm9tICcuLi91dGlscy9Db2xsZWN0b3InO1xyXG5pbXBvcnQgeyBFbWJlZEJ1aWxkZXIgfSBmcm9tICcuLi9idWlsZGVycy9FbWJlZEJ1aWxkZXInO1xyXG5pbXBvcnQgeyBFbWJlZCB9IGZyb20gJy4vRW1iZWQnO1xyXG5pbXBvcnQgeyBzZXJpYWxpemVDb21wb25lbnRzLCBub3JtYWxpemVFbWJlZHMgfSBmcm9tICcuLi91dGlscy9zZXJpYWxpemUnO1xyXG5cclxuLyoqIFJlc29sdmUgRW1iZWRCdWlsZGVyIGluc3RhbmNlcyB0byBwbGFpbiBBUEkgb2JqZWN0cyAqL1xyXG5mdW5jdGlvbiByZXNvbHZlRW1iZWRzKGVtYmVkcz86IChBUElFbWJlZCB8IEVtYmVkQnVpbGRlcilbXSk6IEFQSUVtYmVkW10gfCB1bmRlZmluZWQge1xyXG4gIGlmICghZW1iZWRzKSByZXR1cm4gdW5kZWZpbmVkO1xyXG4gIHJldHVybiBlbWJlZHMubWFwKGUgPT4gZSBpbnN0YW5jZW9mIEVtYmVkQnVpbGRlciA/IGUudG9KU09OKCkgOiBlKTtcclxufVxyXG5cclxuLyoqIE5vcm1hbGl6ZSBlbWJlZCBmcm9tIGJhY2tlbmQgdG8gQVBJRW1iZWQgZm9ybWF0ICovXHJcbmZ1bmN0aW9uIG5vcm1hbGl6ZUVtYmVkKGVtYmVkOiBBUElFbWJlZCAmIHsgaW1hZ2U/OiB7IHVybDogc3RyaW5nIH0gfCBzdHJpbmc7IHRodW1ibmFpbD86IHsgdXJsOiBzdHJpbmcgfSB8IHN0cmluZyB9KTogQVBJRW1iZWQge1xyXG4gIGNvbnN0IG5vcm1hbGl6ZWQ6IEFQSUVtYmVkID0ge1xyXG4gICAgdGl0bGU6IGVtYmVkLnRpdGxlLFxyXG4gICAgZGVzY3JpcHRpb246IGVtYmVkLmRlc2NyaXB0aW9uLFxyXG4gICAgdXJsOiBlbWJlZC51cmwsXHJcbiAgICB0aW1lc3RhbXA6IGVtYmVkLnRpbWVzdGFtcCxcclxuICAgIGNvbG9yOiBlbWJlZC5jb2xvcixcclxuICAgIGZpZWxkczogZW1iZWQuZmllbGRzLFxyXG4gICAgYXV0aG9yOiBlbWJlZC5hdXRob3IsXHJcbiAgICBmb290ZXI6IGVtYmVkLmZvb3RlcixcclxuICB9O1xyXG5cclxuICAvLyBOb3JtYWxpemUgdGh1bWJuYWlsOiBzdHJpbmcg4oaSIG5lc3RlZCBvYmplY3RcclxuICBpZiAodHlwZW9mIGVtYmVkLnRodW1ibmFpbCA9PT0gJ3N0cmluZycpIHtcclxuICAgIG5vcm1hbGl6ZWQudGh1bWJuYWlsID0geyB1cmw6IGVtYmVkLnRodW1ibmFpbCB9O1xyXG4gIH0gZWxzZSBpZiAoZW1iZWQudGh1bWJuYWlsICYmIHR5cGVvZiBlbWJlZC50aHVtYm5haWwgPT09ICdvYmplY3QnKSB7XHJcbiAgICBub3JtYWxpemVkLnRodW1ibmFpbCA9IGVtYmVkLnRodW1ibmFpbDtcclxuICB9XHJcblxyXG4gIC8vIE5vcm1hbGl6ZSBpbWFnZTogc3RyaW5nIOKGkiBuZXN0ZWQgb2JqZWN0XHJcbiAgaWYgKHR5cGVvZiBlbWJlZC5pbWFnZSA9PT0gJ3N0cmluZycpIHtcclxuICAgIG5vcm1hbGl6ZWQuaW1hZ2UgPSB7IHVybDogZW1iZWQuaW1hZ2UgfTtcclxuICB9IGVsc2UgaWYgKGVtYmVkLmltYWdlICYmIHR5cGVvZiBlbWJlZC5pbWFnZSA9PT0gJ29iamVjdCcpIHtcclxuICAgIG5vcm1hbGl6ZWQuaW1hZ2UgPSBlbWJlZC5pbWFnZTtcclxuICB9XHJcblxyXG4gIHJldHVybiBub3JtYWxpemVkO1xyXG59XHJcblxyXG4vKipcclxuICogTWVudGlvbiBkYXRhIGZyb20gYmFja2VuZFxyXG4gKi9cclxuZXhwb3J0IGludGVyZmFjZSBNZXNzYWdlTWVudGlvbnMge1xyXG4gIHVzZXJzPzogQXJyYXk8eyBpZDogbnVtYmVyIHwgc3RyaW5nOyB1c2VybmFtZTogc3RyaW5nIH0+O1xyXG4gIHJvbGVzPzogQXJyYXk8eyBpZDogc3RyaW5nOyBuYW1lPzogc3RyaW5nIH0+O1xyXG4gIGV2ZXJ5b25lPzogYm9vbGVhbjtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJlcHJlc2VudHMgYSByZWFjdGlvbiB0byBhIG1lc3NhZ2VcclxuICogRGlzY29yZC5qcyBjb21wYXRpYmxlXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgTWVzc2FnZVJlYWN0aW9uIHtcclxuICAvKiogVGhlIG1lc3NhZ2UgdGhpcyByZWFjdGlvbiBiZWxvbmdzIHRvICovXHJcbiAgcHVibGljIHJlYWRvbmx5IG1lc3NhZ2U6IE1lc3NhZ2U7XHJcblxyXG4gIC8qKiBUaGUgZW1vamkgaWRlbnRpZmllciAodW5pY29kZSBvciBjdXN0b20gZm9ybWF0KSAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBlbW9qaTogUmVhY3Rpb25FbW9qaTtcclxuXHJcbiAgLyoqIFdoZXRoZXIgdGhlIGJvdCByZWFjdGVkIHdpdGggdGhpcyBlbW9qaSAqL1xyXG4gIHB1YmxpYyBtZTogYm9vbGVhbjtcclxuXHJcbiAgLyoqIFJlYWN0aW9uIGNvdW50IChpZiBrbm93bikgKi9cclxuICBwdWJsaWMgY291bnQ6IG51bWJlcjtcclxuXHJcbiAgY29uc3RydWN0b3IobWVzc2FnZTogTWVzc2FnZSwgZW1vamk6IHN0cmluZywgbWU6IGJvb2xlYW4gPSBmYWxzZSwgY291bnQ6IG51bWJlciA9IDEpIHtcclxuICAgIHRoaXMubWVzc2FnZSA9IG1lc3NhZ2U7XHJcbiAgICB0aGlzLmVtb2ppID0gbmV3IFJlYWN0aW9uRW1vamkoZW1vamkpO1xyXG4gICAgdGhpcy5tZSA9IG1lO1xyXG4gICAgdGhpcy5jb3VudCA9IGNvdW50O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVtb3ZlIHRoZSBib3QncyByZWFjdGlvblxyXG4gICAqIERpc2NvcmQuanMgY29tcGF0aWJsZTogcmVhY3Rpb24ucmVtb3ZlKClcclxuICAgKi9cclxuICBhc3luYyByZW1vdmUoKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBndWlsZElkID0gdGhpcy5tZXNzYWdlLmd1aWxkSWQgfHwgJyc7XHJcbiAgICBhd2FpdCB0aGlzLm1lc3NhZ2UuY2xpZW50LnJlc3QucmVtb3ZlUmVhY3Rpb24oZ3VpbGRJZCwgdGhpcy5tZXNzYWdlLmNoYW5uZWxJZCwgdGhpcy5tZXNzYWdlLmlkLCB0aGlzLmVtb2ppLmlkZW50aWZpZXIpO1xyXG4gICAgdGhpcy5tZSA9IGZhbHNlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ29udmVydCB0byBzdHJpbmdcclxuICAgKi9cclxuICB0b1N0cmluZygpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIHRoaXMuZW1vamkudG9TdHJpbmcoKTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBSZXByZXNlbnRzIGEgcmVhY3Rpb24gZW1vamlcclxuICogRGlzY29yZC5qcyBjb21wYXRpYmxlXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgUmVhY3Rpb25FbW9qaSB7XHJcbiAgLyoqIEVtb2ppIG5hbWUgKGZvciB1bmljb2RlOiB0aGUgY2hhcmFjdGVyIGl0c2VsZiwgZm9yIGN1c3RvbTogdGhlIG5hbWUpICovXHJcbiAgcHVibGljIHJlYWRvbmx5IG5hbWU6IHN0cmluZztcclxuXHJcbiAgLyoqIEVtb2ppIElEIChvbmx5IGZvciBjdXN0b20gZW1vamlzKSAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBpZDogc3RyaW5nIHwgbnVsbDtcclxuXHJcbiAgLyoqIFdoZXRoZXIgdGhlIGVtb2ppIGlzIGFuaW1hdGVkIChvbmx5IGZvciBjdXN0b20gZW1vamlzKSAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBhbmltYXRlZDogYm9vbGVhbjtcclxuXHJcbiAgLyoqIFJhdyBpZGVudGlmaWVyIHN0cmluZyAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBpZGVudGlmaWVyOiBzdHJpbmc7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGVtb2ppOiBzdHJpbmcpIHtcclxuICAgIHRoaXMuaWRlbnRpZmllciA9IGVtb2ppO1xyXG5cclxuICAgIC8vIFBhcnNlIGN1c3RvbSBlbW9qaTogPGE6bmFtZTppZD4gb3IgPDpuYW1lOmlkPlxyXG4gICAgY29uc3QgY3VzdG9tTWF0Y2ggPSBlbW9qaS5tYXRjaCgvXjwoYSk/OihcXHcrKTooXFxkKyk+JC8pO1xyXG4gICAgaWYgKGN1c3RvbU1hdGNoKSB7XHJcbiAgICAgIHRoaXMuYW5pbWF0ZWQgPSAhIWN1c3RvbU1hdGNoWzFdO1xyXG4gICAgICB0aGlzLm5hbWUgPSBjdXN0b21NYXRjaFsyXTtcclxuICAgICAgdGhpcy5pZCA9IGN1c3RvbU1hdGNoWzNdO1xyXG4gICAgfSBlbHNlIGlmIChlbW9qaS5zdGFydHNXaXRoKCc6JykgJiYgZW1vamkuZW5kc1dpdGgoJzonKSkge1xyXG4gICAgICAvLyA6bmFtZTogZm9ybWF0XHJcbiAgICAgIHRoaXMuYW5pbWF0ZWQgPSBmYWxzZTtcclxuICAgICAgdGhpcy5uYW1lID0gZW1vamkuc2xpY2UoMSwgLTEpO1xyXG4gICAgICB0aGlzLmlkID0gbnVsbDtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIC8vIFVuaWNvZGUgZW1vamlcclxuICAgICAgdGhpcy5hbmltYXRlZCA9IGZhbHNlO1xyXG4gICAgICB0aGlzLm5hbWUgPSBlbW9qaTtcclxuICAgICAgdGhpcy5pZCA9IG51bGw7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDb252ZXJ0IHRvIHN0cmluZyByZXByZXNlbnRhdGlvblxyXG4gICAqL1xyXG4gIHRvU3RyaW5nKCk6IHN0cmluZyB7XHJcbiAgICBpZiAodGhpcy5pZCkge1xyXG4gICAgICByZXR1cm4gdGhpcy5hbmltYXRlZCA/IGA8YToke3RoaXMubmFtZX06JHt0aGlzLmlkfT5gIDogYDw6JHt0aGlzLm5hbWV9OiR7dGhpcy5pZH0+YDtcclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzLm5hbWU7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogUmVwcmVzZW50cyBhIG1lc3NhZ2VcclxuICovXHJcbmV4cG9ydCBjbGFzcyBNZXNzYWdlIHtcclxuICAvKiogUmVmZXJlbmNlIHRvIHRoZSBjbGllbnQgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgY2xpZW50OiBDbGllbnQ7XHJcbiAgXHJcbiAgLyoqIENhY2hlZCBjaGFubmVsIGluc3RhbmNlICovXHJcbiAgcHJpdmF0ZSBfY2hhbm5lbD86IFRleHRDaGFubmVsO1xyXG4gIFxyXG4gIC8qKiBNZXNzYWdlIElEICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGlkOiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIENoYW5uZWwgSUQgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgY2hhbm5lbElkOiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIEd1aWxkIElEIChpZiBpbiBhIGd1aWxkKSAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBndWlsZElkPzogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBNZXNzYWdlIGF1dGhvciAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBhdXRob3I6IFVzZXI7XHJcbiAgXHJcbiAgLyoqIE1lc3NhZ2UgY29udGVudCAqL1xyXG4gIHB1YmxpYyBjb250ZW50OiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIE1lc3NhZ2UgY3JlYXRpb24gdGltZXN0YW1wIChtaWxsaXNlY29uZHMgc2luY2UgZXBvY2gpICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGNyZWF0ZWRUaW1lc3RhbXA6IG51bWJlcjtcclxuICBcclxuICAvKiogRWRpdCB0aW1lc3RhbXAgKi9cclxuICBwdWJsaWMgZWRpdGVkVGltZXN0YW1wPzogbnVtYmVyO1xyXG4gIFxyXG4gIC8qKiBBdHRhY2htZW50cyAqL1xyXG4gIHB1YmxpYyBhdHRhY2htZW50czogQVBJQXR0YWNobWVudFtdO1xyXG4gIFxyXG4gIC8qKiBFbWJlZHMgKi9cclxuICBwdWJsaWMgZW1iZWRzOiBFbWJlZFtdO1xyXG5cclxuICAvKiogQ29tcG9uZW50cyAoYnV0dG9ucywgc2VsZWN0IG1lbnVzLCBldGMuKSAqL1xyXG4gIHB1YmxpYyBjb21wb25lbnRzOiBhbnlbXTtcclxuXHJcbiAgLyoqIE1lbnRpb25zIGluIHRoZSBtZXNzYWdlICovXHJcbiAgcHVibGljIG1lbnRpb25zOiBNZXNzYWdlTWVudGlvbnM7XHJcblxyXG4gIC8qKiBVc2VyIElEIChmcm9tIGJhY2tlbmQpICovXHJcbiAgcHVibGljIHVzZXJfaWQ/OiBudW1iZXI7XHJcblxyXG4gIC8qKiBHdWlsZCBtZW1iZXIgKGlmIGluIGEgZ3VpbGQpICovXHJcbiAgcHVibGljIG1lbWJlcj86IEd1aWxkTWVtYmVyO1xyXG5cclxuICBjb25zdHJ1Y3RvcihjbGllbnQ6IENsaWVudCwgZGF0YTogQVBJTWVzc2FnZSkge1xyXG4gICAgdGhpcy5jbGllbnQgPSBjbGllbnQ7XHJcbiAgICB0aGlzLmlkID0gZGF0YS5pZDtcclxuICAgIHRoaXMuY2hhbm5lbElkID0gZGF0YS5jaGFubmVsX2lkO1xyXG4gICAgdGhpcy5ndWlsZElkID0gZGF0YS5ndWlsZF9pZDtcclxuICAgIC8vIHBvbnl0YWlsOiBhdXRob3IgbWF5IGJlIG1pc3NpbmcgaW4gbWluaW1hbCBtZXNzYWdlIHBheWxvYWRzIChlLmcuLCBpbnRlcmFjdGlvbi5tZXNzYWdlKVxyXG4gICAgdGhpcy5hdXRob3IgPSBkYXRhLmF1dGhvciA/IG5ldyBVc2VyKGRhdGEuYXV0aG9yLCBjbGllbnQpIDogbmV3IFVzZXIoeyBpZDogJzAnLCB1c2VybmFtZTogJ1Vua25vd24nIH0sIGNsaWVudCk7XHJcbiAgICB0aGlzLmNvbnRlbnQgPSBkYXRhLmNvbnRlbnQgPz8gJyc7XHJcbiAgICBcclxuICAgIC8vIEhhbmRsZSBkaWZmZXJlbnQgdGltZXN0YW1wIGZvcm1hdHMgZnJvbSBiYWNrZW5kXHJcbiAgICBjb25zdCB0aW1lc3RhbXAgPSBkYXRhLnRpbWVzdGFtcCB8fCAoZGF0YSBhcyBhbnkpLmNyZWF0ZWRfYXQ7XHJcbiAgICB0aGlzLmNyZWF0ZWRUaW1lc3RhbXAgPSB0aW1lc3RhbXAgPyBuZXcgRGF0ZSh0aW1lc3RhbXApLmdldFRpbWUoKSA6IERhdGUubm93KCk7XHJcbiAgICBcclxuICAgIGNvbnN0IGVkaXRlZFRpbWVzdGFtcCA9IGRhdGEuZWRpdGVkX3RpbWVzdGFtcCB8fCAoZGF0YSBhcyBhbnkpLnVwZGF0ZWRfYXQ7XHJcbiAgICB0aGlzLmVkaXRlZFRpbWVzdGFtcCA9IGVkaXRlZFRpbWVzdGFtcCA/IG5ldyBEYXRlKGVkaXRlZFRpbWVzdGFtcCkuZ2V0VGltZSgpIDogdW5kZWZpbmVkO1xyXG4gICAgXHJcbiAgICB0aGlzLmF0dGFjaG1lbnRzID0gZGF0YS5hdHRhY2htZW50cyB8fCBbXTtcclxuICAgIFxyXG4gICAgLy8gTm9ybWFsaXplIGVtYmVkcyBmcm9tIGJhY2tlbmQgKGZsYXQgZm9ybWF0IOKGkiBuZXN0ZWQgZm9ybWF0KSBhbmQgd3JhcCBpbiBFbWJlZCBjbGFzc1xyXG4gICAgdGhpcy5lbWJlZHMgPSBkYXRhLmVtYmVkcyA/IGRhdGEuZW1iZWRzLm1hcChlID0+IG5ldyBFbWJlZChub3JtYWxpemVFbWJlZChlKSkpIDogW107XHJcbiAgICBcclxuICAgIC8vIENvbXBvbmVudHMgKEFjdGlvblJvd3Mgd2l0aCBidXR0b25zLCBzZWxlY3QgbWVudXMsIGV0Yy4pXHJcbiAgICB0aGlzLmNvbXBvbmVudHMgPSAoZGF0YSBhcyBhbnkpLmNvbXBvbmVudHMgfHwgW107XHJcbiAgICBcclxuICAgIHRoaXMubWVudGlvbnMgPSAoZGF0YSBhcyBhbnkpLm1lbnRpb25zIHx8IHt9O1xyXG4gICAgdGhpcy51c2VyX2lkID0gKGRhdGEgYXMgYW55KS51c2VyX2lkO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVGhlIGNoYW5uZWwgdGhpcyBtZXNzYWdlIHdhcyBzZW50IGluXHJcbiAgICogcG9ueXRhaWw6IHJlZmFjdG9yZWQgLSBhcnTEsWsgVGV4dENoYW5uZWwgaW5zdGFuY2UgZMO2bmTDvHLDvHlvciwgRFJZXHJcbiAgICogQ2FjaGVzIHRoZSBUZXh0Q2hhbm5lbCBpbnN0YW5jZSBmb3IgcGVyZm9ybWFuY2VcclxuICAgKi9cclxuICBnZXQgY2hhbm5lbCgpOiBUZXh0Q2hhbm5lbCB7XHJcbiAgICAvLyBSZXR1cm4gY2FjaGVkIGNoYW5uZWwgaWYgYXZhaWxhYmxlXHJcbiAgICBpZiAodGhpcy5fY2hhbm5lbCkgcmV0dXJuIHRoaXMuX2NoYW5uZWw7XHJcbiAgICBcclxuICAgIC8vIEd1aWxkIGNhY2hlJ2RlbiBjaGFubmVsIGRhdGEgYWxcclxuICAgIGNvbnN0IGNoYW5uZWxEYXRhID0gdGhpcy5ndWlsZElkIFxyXG4gICAgICA/IHRoaXMuY2xpZW50Lmd1aWxkcy5nZXQodGhpcy5ndWlsZElkKT8uY2hhbm5lbHMuZ2V0KHRoaXMuY2hhbm5lbElkKVxyXG4gICAgICA6IHVuZGVmaW5lZDtcclxuICAgIFxyXG4gICAgLy8gVGV4dENoYW5uZWwgb2x1xZ90dXIgLSBjYWNoZSdkZWtpIGRhdGEgdmV5YSBtaW5pbWFsIGRhdGEgaWxlXHJcbiAgICB0aGlzLl9jaGFubmVsID0gbmV3IFRleHRDaGFubmVsKHRoaXMuY2xpZW50LCB7XHJcbiAgICAgIGlkOiB0aGlzLmNoYW5uZWxJZCxcclxuICAgICAgZ3VpbGRfaWQ6IHRoaXMuZ3VpbGRJZCxcclxuICAgICAgdHlwZTogMCwgLy8gR3VpbGRUZXh0XHJcbiAgICAgIG5hbWU6IChjaGFubmVsRGF0YSBhcyBhbnkpPy5uYW1lLFxyXG4gICAgICB0b3BpYzogKGNoYW5uZWxEYXRhIGFzIGFueSk/LnRvcGljLFxyXG4gICAgICBwb3NpdGlvbjogKGNoYW5uZWxEYXRhIGFzIGFueSk/LnBvc2l0aW9uLFxyXG4gICAgICBwYXJlbnRfaWQ6IChjaGFubmVsRGF0YSBhcyBhbnkpPy5wYXJlbnRfaWQsXHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgcmV0dXJuIHRoaXMuX2NoYW5uZWw7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgdGhlIGNyZWF0aW9uIGRhdGVcclxuICAgKi9cclxuICBnZXQgY3JlYXRlZEF0KCk6IERhdGUge1xyXG4gICAgcmV0dXJuIG5ldyBEYXRlKHRoaXMuY3JlYXRlZFRpbWVzdGFtcCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBUaGUgZ3VpbGQgdGhpcyBtZXNzYWdlIHdhcyBzZW50IGluIChpZiBpbiBhIGd1aWxkKVxyXG4gICAqIERpc2NvcmQuanMgY29tcGF0aWJsZTogbWVzc2FnZS5ndWlsZFxyXG4gICAqL1xyXG4gIGdldCBndWlsZCgpIHtcclxuICAgIGlmICghdGhpcy5ndWlsZElkKSByZXR1cm4gbnVsbDtcclxuICAgIHJldHVybiB0aGlzLmNsaWVudC5ndWlsZHMuZ2V0KHRoaXMuZ3VpbGRJZCkgPz8gbnVsbDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCB0aGUgZWRpdCBkYXRlXHJcbiAgICovXHJcbiAgZ2V0IGVkaXRlZEF0KCk6IERhdGUgfCBudWxsIHtcclxuICAgIHJldHVybiB0aGlzLmVkaXRlZFRpbWVzdGFtcCA/IG5ldyBEYXRlKHRoaXMuZWRpdGVkVGltZXN0YW1wKSA6IG51bGw7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZXBseSB0byB0aGlzIG1lc3NhZ2VcclxuICAgKiBwb255dGFpbDogQnVnICM4IGZpeCAtIGVtYmVkIHRla2lsLCBCdWcgIzEwIGZpeCAtIGZsYWdzIGRlc3RlxJ9pXHJcbiAgICovXHJcbiAgYXN5bmMgcmVwbHkob3B0aW9uczogc3RyaW5nIHwgTWVzc2FnZUNyZWF0ZU9wdGlvbnMpOiBQcm9taXNlPE1lc3NhZ2U+IHtcclxuICAgIGNvbnN0IGNvbnRlbnQgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyBvcHRpb25zIDogb3B0aW9ucy5jb250ZW50O1xyXG4gICAgLy8gcG9ueXRhaWw6IEJ1ZyAjOCBmaXggLSBlbWJlZCB0ZWtpbCBrdWxsYW7EsW3EsVxyXG4gICAgY29uc3QgcmF3RW1iZWRzID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnIFxyXG4gICAgICA/IHVuZGVmaW5lZCBcclxuICAgICAgOiAob3B0aW9ucy5lbWJlZHMgfHwgKG9wdGlvbnMuZW1iZWQgPyBbb3B0aW9ucy5lbWJlZF0gOiB1bmRlZmluZWQpKTtcclxuICAgIGNvbnN0IGVtYmVkcyA9IHJlc29sdmVFbWJlZHMocmF3RW1iZWRzKTtcclxuICAgIGNvbnN0IGNvbXBvbmVudHMgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyB1bmRlZmluZWQgOiBzZXJpYWxpemVDb21wb25lbnRzKG9wdGlvbnMuY29tcG9uZW50cyk7XHJcbiAgICBjb25zdCBmbGFncyA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IHVuZGVmaW5lZCA6IG9wdGlvbnMuZmxhZ3M7XHJcbiAgICBcclxuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LmNyZWF0ZU1lc3NhZ2UodGhpcy5ndWlsZElkIHx8ICcnLCB0aGlzLmNoYW5uZWxJZCwge1xyXG4gICAgICBjb250ZW50LFxyXG4gICAgICBlbWJlZHMsXHJcbiAgICAgIGNvbXBvbmVudHMsXHJcbiAgICAgIGZsYWdzLFxyXG4gICAgICBtZXNzYWdlX3JlZmVyZW5jZTogeyBtZXNzYWdlX2lkOiB0aGlzLmlkIH1cclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICByZXR1cm4gbmV3IE1lc3NhZ2UodGhpcy5jbGllbnQsIGRhdGEpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRWRpdCB0aGlzIG1lc3NhZ2UgKG9ubHkgaWYgYXV0aG9yIGlzIHRoZSBib3QpXHJcbiAgICovXHJcbiAgYXN5bmMgZWRpdChvcHRpb25zOiBzdHJpbmcgfCBNZXNzYWdlQ3JlYXRlT3B0aW9ucyk6IFByb21pc2U8TWVzc2FnZT4ge1xyXG4gICAgY29uc3QgY29udGVudCA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IG9wdGlvbnMgOiBvcHRpb25zLmNvbnRlbnQ7XHJcbiAgICBjb25zdCBlbWJlZHMgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyB1bmRlZmluZWQgOiByZXNvbHZlRW1iZWRzKG9wdGlvbnMuZW1iZWRzKTtcclxuICAgIGNvbnN0IGNvbXBvbmVudHMgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyB1bmRlZmluZWQgOiBzZXJpYWxpemVDb21wb25lbnRzKG9wdGlvbnMuY29tcG9uZW50cyk7XHJcbiAgICBcclxuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LmVkaXRNZXNzYWdlKHRoaXMuZ3VpbGRJZCB8fCAnJywgdGhpcy5jaGFubmVsSWQsIHRoaXMuaWQsIHtcclxuICAgICAgY29udGVudCxcclxuICAgICAgZW1iZWRzLFxyXG4gICAgICBjb21wb25lbnRzLFxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIHJldHVybiBuZXcgTWVzc2FnZSh0aGlzLmNsaWVudCwgZGF0YSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZWxldGUgdGhpcyBtZXNzYWdlXHJcbiAgICovXHJcbiAgYXN5bmMgZGVsZXRlKCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5kZWxldGVNZXNzYWdlKHRoaXMuZ3VpbGRJZCB8fCAnJywgdGhpcy5jaGFubmVsSWQsIHRoaXMuaWQpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVhY3QgdG8gdGhpcyBtZXNzYWdlIHdpdGggYW4gZW1vamlcclxuICAgKiBEaXNjb3JkLmpzIGNvbXBhdGlibGU6IG1lc3NhZ2UucmVhY3QoJ/CfkY0nKVxyXG4gICAqIFxyXG4gICAqIEBwYXJhbSBlbW9qaSAtIFVuaWNvZGUgZW1vamkgKPCfkY0pLCA6bmFtZTosIDw6bmFtZTppZD4sIG9yIDxhOm5hbWU6aWQ+IGZvcm1hdFxyXG4gICAqIEByZXR1cm5zIE1lc3NhZ2VSZWFjdGlvbiBvYmplY3QgZm9yIGNoYWluaW5nXHJcbiAgICogXHJcbiAgICogQGV4YW1wbGVcclxuICAgKiAvLyBSZWFjdCB3aXRoIHVuaWNvZGUgZW1vamlcclxuICAgKiBhd2FpdCBtZXNzYWdlLnJlYWN0KCfwn5GNJyk7XHJcbiAgICogXHJcbiAgICogLy8gUmVhY3Qgd2l0aCBjdXN0b20gZW1vamlcclxuICAgKiBhd2FpdCBtZXNzYWdlLnJlYWN0KCc8OmN1c3RvbToxMjM0NTY3ODk+Jyk7XHJcbiAgICogXHJcbiAgICogLy8gQ2hhaW4gbXVsdGlwbGUgcmVhY3Rpb25zXHJcbiAgICogYXdhaXQgbWVzc2FnZS5yZWFjdCgn8J+RjScpO1xyXG4gICAqIGF3YWl0IG1lc3NhZ2UucmVhY3QoJ+KdpO+4jycpO1xyXG4gICAqL1xyXG4gIGFzeW5jIHJlYWN0KGVtb2ppOiBzdHJpbmcpOiBQcm9taXNlPE1lc3NhZ2VSZWFjdGlvbj4ge1xyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5hZGRSZWFjdGlvbih0aGlzLmd1aWxkSWQgfHwgJycsIHRoaXMuY2hhbm5lbElkLCB0aGlzLmlkLCBlbW9qaSk7XHJcbiAgICByZXR1cm4gbmV3IE1lc3NhZ2VSZWFjdGlvbih0aGlzLCBlbW9qaSwgdHJ1ZSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBQaW4gdGhpcyBtZXNzYWdlXHJcbiAgICovXHJcbiAgYXN5bmMgcGluKCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5waW5NZXNzYWdlKHRoaXMuZ3VpbGRJZCB8fCAnJywgdGhpcy5jaGFubmVsSWQsIHRoaXMuaWQpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVW5waW4gdGhpcyBtZXNzYWdlXHJcbiAgICovXHJcbiAgYXN5bmMgdW5waW4oKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LnVucGluTWVzc2FnZSh0aGlzLmd1aWxkSWQgfHwgJycsIHRoaXMuY2hhbm5lbElkLCB0aGlzLmlkKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIGNvbXBvbmVudCBpbnRlcmFjdGlvbiBjb2xsZWN0b3Igb24gdGhpcyBtZXNzYWdlXHJcbiAgICovXHJcbiAgY3JlYXRlTWVzc2FnZUNvbXBvbmVudENvbGxlY3RvcihvcHRpb25zPzogT21pdDxJbnRlcmFjdGlvbkNvbGxlY3Rvck9wdGlvbnMsICdtZXNzYWdlSWQnPik6IEludGVyYWN0aW9uQ29sbGVjdG9yIHtcclxuICAgIHJldHVybiBuZXcgSW50ZXJhY3Rpb25Db2xsZWN0b3IodGhpcy5jbGllbnQsIHtcclxuICAgICAgLi4ub3B0aW9ucyxcclxuICAgICAgbWVzc2FnZUlkOiB0aGlzLmlkLFxyXG4gICAgICBjaGFubmVsSWQ6IHRoaXMuY2hhbm5lbElkLFxyXG4gICAgICBndWlsZElkOiB0aGlzLmd1aWxkSWQsXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEF3YWl0IGNvbXBvbmVudCBpbnRlcmFjdGlvbnMgb24gdGhpcyBtZXNzYWdlXHJcbiAgICovXHJcbiAgYXdhaXRNZXNzYWdlQ29tcG9uZW50KG9wdGlvbnM/OiBPbWl0PEludGVyYWN0aW9uQ29sbGVjdG9yT3B0aW9ucywgJ21lc3NhZ2VJZCcgfCAnbWF4Jz4pOiBQcm9taXNlPGFueT4ge1xyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgY29uc3QgY29sbGVjdG9yID0gdGhpcy5jcmVhdGVNZXNzYWdlQ29tcG9uZW50Q29sbGVjdG9yKHsgLi4ub3B0aW9ucywgbWF4OiAxIH0pO1xyXG4gICAgICBcclxuICAgICAgY29sbGVjdG9yLm9uY2UoJ2VuZCcsIChjb2xsZWN0ZWQsIHJlYXNvbikgPT4ge1xyXG4gICAgICAgIGNvbnN0IGZpcnN0ID0gY29sbGVjdGVkLmZpcnN0KCk7XHJcbiAgICAgICAgaWYgKGZpcnN0KSB7XHJcbiAgICAgICAgICByZXNvbHZlKGZpcnN0KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihyZWFzb24gfHwgJ05vIGludGVyYWN0aW9uIHJlY2VpdmVkJykpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENvbnZlcnQgdG8gc3RyaW5nXHJcbiAgICovXHJcbiAgdG9TdHJpbmcoKTogc3RyaW5nIHtcclxuICAgIHJldHVybiB0aGlzLmNvbnRlbnQ7XHJcbiAgfVxyXG59XHJcbiJdfQ==