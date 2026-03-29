"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Message = void 0;
const User_1 = require("./User");
const Collector_1 = require("../utils/Collector");
const EmbedBuilder_1 = require("../builders/EmbedBuilder");
/** Resolve EmbedBuilder instances to plain API objects */
function resolveEmbeds(embeds) {
    if (!embeds)
        return undefined;
    return embeds.map(e => e instanceof EmbedBuilder_1.EmbedBuilder ? e.toJSON() : e);
}
/** Normalize flat embed format from backend to nested format */
function normalizeEmbed(embed) {
    const normalized = {
        title: embed.title,
        description: embed.description,
        url: embed.url,
        timestamp: embed.timestamp,
        color: embed.color,
        fields: embed.fields,
    };
    // Normalize author: flat format → nested object
    if (embed.author_name || embed.author_icon_url || embed.author_url) {
        normalized.author = {
            name: embed.author_name || '',
            icon_url: embed.author_icon_url,
            url: embed.author_url,
        };
    }
    else if (embed.author) {
        normalized.author = embed.author;
    }
    // Normalize footer: flat format → nested object
    if (embed.footer_text || embed.footer_icon_url) {
        normalized.footer = {
            text: embed.footer_text || '',
            icon_url: embed.footer_icon_url,
        };
    }
    else if (embed.footer) {
        normalized.footer = embed.footer;
    }
    // Normalize thumbnail: flat format or string → nested object
    if (embed.thumbnail_url) {
        normalized.thumbnail = { url: embed.thumbnail_url };
    }
    else if (typeof embed.thumbnail === 'string') {
        normalized.thumbnail = { url: embed.thumbnail };
    }
    else if (embed.thumbnail && typeof embed.thumbnail === 'object') {
        normalized.thumbnail = embed.thumbnail;
    }
    // Normalize image: flat format or string → nested object
    if (embed.image_url) {
        normalized.image = { url: embed.image_url };
    }
    else if (typeof embed.image === 'string') {
        normalized.image = { url: embed.image };
    }
    else if (embed.image && typeof embed.image === 'object') {
        normalized.image = embed.image;
    }
    return normalized;
}
/**
 * Represents a message
 */
class Message {
    /** Reference to the client */
    client;
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
    /** Message timestamp */
    createdTimestamp;
    /** Edit timestamp */
    editedTimestamp;
    /** Attachments */
    attachments;
    /** Embeds */
    embeds;
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
        this.author = new User_1.User(data.author);
        this.content = data.content ?? '';
        // Handle different timestamp formats from backend
        const timestamp = data.timestamp || data.created_at;
        this.createdTimestamp = timestamp ? new Date(timestamp).getTime() : Date.now();
        const editedTimestamp = data.edited_timestamp || data.updated_at;
        this.editedTimestamp = editedTimestamp ? new Date(editedTimestamp).getTime() : undefined;
        this.attachments = data.attachments || [];
        // Normalize embeds from backend (flat format → nested format)
        this.embeds = data.embeds ? data.embeds.map(normalizeEmbed) : [];
        this.mentions = data.mentions || {};
        this.user_id = data.user_id;
    }
    /**
     * Get the creation date
     */
    get createdAt() {
        return new Date(this.createdTimestamp);
    }
    /**
     * Get the edit date
     */
    get editedAt() {
        return this.editedTimestamp ? new Date(this.editedTimestamp) : null;
    }
    /**
     * Reply to this message
     */
    async reply(options) {
        const content = typeof options === 'string' ? options : options.content;
        const embeds = typeof options === 'string' ? undefined : resolveEmbeds(options.embeds);
        const components = typeof options === 'string' ? undefined : options.components;
        const data = await this.client.rest.createMessage(this.guildId || '', this.channelId, {
            content,
            embeds,
            components,
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
        const components = typeof options === 'string' ? undefined : options.components;
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
     * React to this message
     */
    async react(emoji) {
        await this.client.rest.addReaction(this.guildId || '', this.channelId, this.id, emoji);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWVzc2FnZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zdHJ1Y3R1cmVzL01lc3NhZ2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQ0EsaUNBQThCO0FBSzlCLGtEQUF1RjtBQUN2RiwyREFBd0Q7QUEyQnhELDBEQUEwRDtBQUMxRCxTQUFTLGFBQWEsQ0FBQyxNQUFvQztJQUN6RCxJQUFJLENBQUMsTUFBTTtRQUFFLE9BQU8sU0FBUyxDQUFDO0lBQzlCLE9BQU8sTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsWUFBWSwyQkFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3JFLENBQUM7QUFFRCxnRUFBZ0U7QUFDaEUsU0FBUyxjQUFjLENBQUMsS0FBdUI7SUFDN0MsTUFBTSxVQUFVLEdBQWE7UUFDM0IsS0FBSyxFQUFFLEtBQUssQ0FBQyxLQUFLO1FBQ2xCLFdBQVcsRUFBRSxLQUFLLENBQUMsV0FBVztRQUM5QixHQUFHLEVBQUUsS0FBSyxDQUFDLEdBQUc7UUFDZCxTQUFTLEVBQUUsS0FBSyxDQUFDLFNBQVM7UUFDMUIsS0FBSyxFQUFFLEtBQUssQ0FBQyxLQUFLO1FBQ2xCLE1BQU0sRUFBRSxLQUFLLENBQUMsTUFBTTtLQUNyQixDQUFDO0lBRUYsZ0RBQWdEO0lBQ2hELElBQUksS0FBSyxDQUFDLFdBQVcsSUFBSSxLQUFLLENBQUMsZUFBZSxJQUFJLEtBQUssQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUNuRSxVQUFVLENBQUMsTUFBTSxHQUFHO1lBQ2xCLElBQUksRUFBRSxLQUFLLENBQUMsV0FBVyxJQUFJLEVBQUU7WUFDN0IsUUFBUSxFQUFFLEtBQUssQ0FBQyxlQUFlO1lBQy9CLEdBQUcsRUFBRSxLQUFLLENBQUMsVUFBVTtTQUN0QixDQUFDO0lBQ0osQ0FBQztTQUFNLElBQUksS0FBSyxDQUFDLE1B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RDs7T0FFRztJQUNILFFBQVE7UUFDTixPQUFPLElBQUksQ0FBQyxPQUFPLENBQUM7SUFDdEIsQ0FBQztDQUNGO0FBakxELDBCQWlMQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFQSU1lc3NhZ2UsIEFQSUVtYmVkLCBBUElBdHRhY2htZW50IH0gZnJvbSAnLi4vdHlwZXMnO1xyXG5pbXBvcnQgeyBVc2VyIH0gZnJvbSAnLi9Vc2VyJztcclxuaW1wb3J0IHsgR3VpbGRNZW1iZXIgfSBmcm9tICcuL0d1aWxkTWVtYmVyJztcclxuaW1wb3J0IHR5cGUgeyBDbGllbnQgfSBmcm9tICcuLi9DbGllbnQnO1xyXG5pbXBvcnQgdHlwZSB7IE1lc3NhZ2VDcmVhdGVPcHRpb25zIH0gZnJvbSAnLi9DaGFubmVsJztcclxuaW1wb3J0IHsgQ29sbGVjdGlvbiB9IGZyb20gJy4vQ29sbGVjdGlvbic7XHJcbmltcG9ydCB7IEludGVyYWN0aW9uQ29sbGVjdG9yLCBJbnRlcmFjdGlvbkNvbGxlY3Rvck9wdGlvbnMgfSBmcm9tICcuLi91dGlscy9Db2xsZWN0b3InO1xyXG5pbXBvcnQgeyBFbWJlZEJ1aWxkZXIgfSBmcm9tICcuLi9idWlsZGVycy9FbWJlZEJ1aWxkZXInO1xyXG5cclxuLyoqIEJhY2tlbmQgZmxhdCBlbWJlZCBmb3JtYXQgKGZvciBub3JtYWxpemF0aW9uKSAqL1xyXG5pbnRlcmZhY2UgQmFja2VuZEZsYXRFbWJlZCB7XHJcbiAgdGl0bGU/OiBzdHJpbmc7XHJcbiAgZGVzY3JpcHRpb24/OiBzdHJpbmc7XHJcbiAgdXJsPzogc3RyaW5nO1xyXG4gIHRpbWVzdGFtcD86IHN0cmluZztcclxuICBjb2xvcj86IG51bWJlcjtcclxuICAvLyBGbGF0IGF1dGhvciBmaWVsZHNcclxuICBhdXRob3JfbmFtZT86IHN0cmluZztcclxuICBhdXRob3JfdXJsPzogc3RyaW5nO1xyXG4gIGF1dGhvcl9pY29uX3VybD86IHN0cmluZztcclxuICAvLyBGbGF0IGZvb3RlciBmaWVsZHNcclxuICBmb290ZXJfdGV4dD86IHN0cmluZztcclxuICBmb290ZXJfaWNvbl91cmw/OiBzdHJpbmc7XHJcbiAgLy8gRmxhdCB0aHVtYm5haWwvaW1hZ2UgZmllbGRzXHJcbiAgdGh1bWJuYWlsX3VybD86IHN0cmluZztcclxuICBpbWFnZV91cmw/OiBzdHJpbmc7XHJcbiAgLy8gT3IgbmVzdGVkIGZvcm1hdFxyXG4gIGF1dGhvcj86IHsgbmFtZTogc3RyaW5nOyB1cmw/OiBzdHJpbmc7IGljb25fdXJsPzogc3RyaW5nIH07XHJcbiAgZm9vdGVyPzogeyB0ZXh0OiBzdHJpbmc7IGljb25fdXJsPzogc3RyaW5nIH07XHJcbiAgaW1hZ2U/OiB7IHVybDogc3RyaW5nIH0gfCBzdHJpbmc7XHJcbiAgdGh1bWJuYWlsPzogeyB1cmw6IHN0cmluZyB9IHwgc3RyaW5nO1xyXG4gIGZpZWxkcz86IHsgbmFtZTogc3RyaW5nOyB2YWx1ZTogc3RyaW5nOyBpbmxpbmU/OiBib29sZWFuIH1bXTtcclxufVxyXG5cclxuLyoqIFJlc29sdmUgRW1iZWRCdWlsZGVyIGluc3RhbmNlcyB0byBwbGFpbiBBUEkgb2JqZWN0cyAqL1xyXG5mdW5jdGlvbiByZXNvbHZlRW1iZWRzKGVtYmVkcz86IChBUElFbWJlZCB8IEVtYmVkQnVpbGRlcilbXSk6IEFQSUVtYmVkW10gfCB1bmRlZmluZWQge1xyXG4gIGlmICghZW1iZWRzKSByZXR1cm4gdW5kZWZpbmVkO1xyXG4gIHJldHVybiBlbWJlZHMubWFwKGUgPT4gZSBpbnN0YW5jZW9mIEVtYmVkQnVpbGRlciA/IGUudG9KU09OKCkgOiBlKTtcclxufVxyXG5cclxuLyoqIE5vcm1hbGl6ZSBmbGF0IGVtYmVkIGZvcm1hdCBmcm9tIGJhY2tlbmQgdG8gbmVzdGVkIGZvcm1hdCAqL1xyXG5mdW5jdGlvbiBub3JtYWxpemVFbWJlZChlbWJlZDogQmFja2VuZEZsYXRFbWJlZCk6IEFQSUVtYmVkIHtcclxuICBjb25zdCBub3JtYWxpemVkOiBBUElFbWJlZCA9IHtcclxuICAgIHRpdGxlOiBlbWJlZC50aXRsZSxcclxuICAgIGRlc2NyaXB0aW9uOiBlbWJlZC5kZXNjcmlwdGlvbixcclxuICAgIHVybDogZW1iZWQudXJsLFxyXG4gICAgdGltZXN0YW1wOiBlbWJlZC50aW1lc3RhbXAsXHJcbiAgICBjb2xvcjogZW1iZWQuY29sb3IsXHJcbiAgICBmaWVsZHM6IGVtYmVkLmZpZWxkcyxcclxuICB9O1xyXG5cclxuICAvLyBOb3JtYWxpemUgYXV0aG9yOiBmbGF0IGZvcm1hdCDihpIgbmVzdGVkIG9iamVjdFxyXG4gIGlmIChlbWJlZC5hdXRob3JfbmFtZSB8fCBlbWJlZC5hdXRob3JfaWNvbl91cmwgfHwgZW1iZWQuYXV0aG9yX3VybCkge1xyXG4gICAgbm9ybWFsaXplZC5hdXRob3IgPSB7XHJcbiAgICAgIG5hbWU6IGVtYmVkLmF1dGhvcl9uYW1lIHx8ICcnLFxyXG4gICAgICBpY29uX3VybDogZW1iZWQuYXV0aG9yX2ljb25fdXJsLFxyXG4gICAgICB1cmw6IGVtYmVkLmF1dGhvcl91cmwsXHJcbiAgICB9O1xyXG4gIH0gZWxzZSBpZiAoZW1iZWQuYXV0aG9yKSB7XHJcbiAgICBub3JtYWxpemVkLmF1dGhvciA9IGVtYmVkLmF1dGhvcjtcclxuICB9XHJcblxyXG4gIC8vIE5vcm1hbGl6ZSBmb290ZXI6IGZsYXQgZm9ybWF0IOKGkiBuZXN0ZWQgb2JqZWN0XHJcbiAgaWYgKGVtYmVkLmZvb3Rlcl90ZXh0IHx8IGVtYmVkLmZvb3Rlcl9pY29uX3VybCkge1xyXG4gICAgbm9ybWFsaXplZC5mb290ZXIgPSB7XHJcbiAgICAgIHRleHQ6IGVtYmVkLmZvb3Rlcl90ZXh0IHx8ICcnLFxyXG4gICAgICBpY29uX3VybDogZW1iZWQuZm9vdGVyX2ljb25fdXJsLFxyXG4gICAgfTtcclxuICB9IGVsc2UgaWYgKGVtYmVkLmZvb3Rlcikge1xyXG4gICAgbm9ybWFsaXplZC5mb290ZXIgPSBlbWJlZC5mb290ZXI7XHJcbiAgfVxyXG5cclxuICAvLyBOb3JtYWxpemUgdGh1bWJuYWlsOiBmbGF0IGZvcm1hdCBvciBzdHJpbmcg4oaSIG5lc3RlZCBvYmplY3RcclxuICBpZiAoZW1iZWQudGh1bWJuYWlsX3VybCkge1xyXG4gICAgbm9ybWFsaXplZC50aHVtYm5haWwgPSB7IHVybDogZW1iZWQudGh1bWJuYWlsX3VybCB9O1xyXG4gIH0gZWxzZSBpZiAodHlwZW9mIGVtYmVkLnRodW1ibmFpbCA9PT0gJ3N0cmluZycpIHtcclxuICAgIG5vcm1hbGl6ZWQudGh1bWJuYWlsID0geyB1cmw6IGVtYmVkLnRodW1ibmFpbCB9O1xyXG4gIH0gZWxzZSBpZiAoZW1iZWQudGh1bWJuYWlsICYmIHR5cGVvZiBlbWJlZC50aHVtYm5haWwgPT09ICdvYmplY3QnKSB7XHJcbiAgICBub3JtYWxpemVkLnRodW1ibmFpbCA9IGVtYmVkLnRodW1ibmFpbDtcclxuICB9XHJcblxyXG4gIC8vIE5vcm1hbGl6ZSBpbWFnZTogZmxhdCBmb3JtYXQgb3Igc3RyaW5nIOKGkiBuZXN0ZWQgb2JqZWN0XHJcbiAgaWYgKGVtYmVkLmltYWdlX3VybCkge1xyXG4gICAgbm9ybWFsaXplZC5pbWFnZSA9IHsgdXJsOiBlbWJlZC5pbWFnZV91cmwgfTtcclxuICB9IGVsc2UgaWYgKHR5cGVvZiBlbWJlZC5pbWFnZSA9PT0gJ3N0cmluZycpIHtcclxuICAgIG5vcm1hbGl6ZWQuaW1hZ2UgPSB7IHVybDogZW1iZWQuaW1hZ2UgfTtcclxuICB9IGVsc2UgaWYgKGVtYmVkLmltYWdlICYmIHR5cGVvZiBlbWJlZC5pbWFnZSA9PT0gJ29iamVjdCcpIHtcclxuICAgIG5vcm1hbGl6ZWQuaW1hZ2UgPSBlbWJlZC5pbWFnZTtcclxuICB9XHJcblxyXG4gIHJldHVybiBub3JtYWxpemVkO1xyXG59XHJcblxyXG4vKipcclxuICogTWVudGlvbiBkYXRhIGZyb20gYmFja2VuZFxyXG4gKi9cclxuZXhwb3J0IGludGVyZmFjZSBNZXNzYWdlTWVudGlvbnMge1xyXG4gIHVzZXJzPzogQXJyYXk8eyBpZDogbnVtYmVyIHwgc3RyaW5nOyB1c2VybmFtZTogc3RyaW5nIH0+O1xyXG4gIHJvbGVzPzogQXJyYXk8eyBpZDogc3RyaW5nOyBuYW1lPzogc3RyaW5nIH0+O1xyXG4gIGV2ZXJ5b25lPzogYm9vbGVhbjtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJlcHJlc2VudHMgYSBtZXNzYWdlXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgTWVzc2FnZSB7XHJcbiAgLyoqIFJlZmVyZW5jZSB0byB0aGUgY2xpZW50ICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGNsaWVudDogQ2xpZW50O1xyXG4gIFxyXG4gIC8qKiBNZXNzYWdlIElEICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGlkOiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIENoYW5uZWwgSUQgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgY2hhbm5lbElkOiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIEd1aWxkIElEIChpZiBpbiBhIGd1aWxkKSAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBndWlsZElkPzogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBNZXNzYWdlIGF1dGhvciAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBhdXRob3I6IFVzZXI7XHJcbiAgXHJcbiAgLyoqIE1lc3NhZ2UgY29udGVudCAqL1xyXG4gIHB1YmxpYyBjb250ZW50OiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIE1lc3NhZ2UgdGltZXN0YW1wICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGNyZWF0ZWRUaW1lc3RhbXA6IG51bWJlcjtcclxuICBcclxuICAvKiogRWRpdCB0aW1lc3RhbXAgKi9cclxuICBwdWJsaWMgZWRpdGVkVGltZXN0YW1wPzogbnVtYmVyO1xyXG4gIFxyXG4gIC8qKiBBdHRhY2htZW50cyAqL1xyXG4gIHB1YmxpYyBhdHRhY2htZW50czogQVBJQXR0YWNobWVudFtdO1xyXG4gIFxyXG4gIC8qKiBFbWJlZHMgKi9cclxuICBwdWJsaWMgZW1iZWRzOiBBUElFbWJlZFtdO1xyXG5cclxuICAvKiogTWVudGlvbnMgaW4gdGhlIG1lc3NhZ2UgKi9cclxuICBwdWJsaWMgbWVudGlvbnM6IE1lc3NhZ2VNZW50aW9ucztcclxuXHJcbiAgLyoqIFVzZXIgSUQgKGZyb20gYmFja2VuZCkgKi9cclxuICBwdWJsaWMgdXNlcl9pZD86IG51bWJlcjtcclxuXHJcbiAgLyoqIEd1aWxkIG1lbWJlciAoaWYgaW4gYSBndWlsZCkgKi9cclxuICBwdWJsaWMgbWVtYmVyPzogR3VpbGRNZW1iZXI7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGNsaWVudDogQ2xpZW50LCBkYXRhOiBBUElNZXNzYWdlKSB7XHJcbiAgICB0aGlzLmNsaWVudCA9IGNsaWVudDtcclxuICAgIHRoaXMuaWQgPSBkYXRhLmlkO1xyXG4gICAgdGhpcy5jaGFubmVsSWQgPSBkYXRhLmNoYW5uZWxfaWQ7XHJcbiAgICB0aGlzLmd1aWxkSWQgPSBkYXRhLmd1aWxkX2lkO1xyXG4gICAgdGhpcy5hdXRob3IgPSBuZXcgVXNlcihkYXRhLmF1dGhvcik7XHJcbiAgICB0aGlzLmNvbnRlbnQgPSBkYXRhLmNvbnRlbnQgPz8gJyc7XHJcbiAgICBcclxuICAgIC8vIEhhbmRsZSBkaWZmZXJlbnQgdGltZXN0YW1wIGZvcm1hdHMgZnJvbSBiYWNrZW5kXHJcbiAgICBjb25zdCB0aW1lc3RhbXAgPSBkYXRhLnRpbWVzdGFtcCB8fCAoZGF0YSBhcyBhbnkpLmNyZWF0ZWRfYXQ7XHJcbiAgICB0aGlzLmNyZWF0ZWRUaW1lc3RhbXAgPSB0aW1lc3RhbXAgPyBuZXcgRGF0ZSh0aW1lc3RhbXApLmdldFRpbWUoKSA6IERhdGUubm93KCk7XHJcbiAgICBcclxuICAgIGNvbnN0IGVkaXRlZFRpbWVzdGFtcCA9IGRhdGEuZWRpdGVkX3RpbWVzdGFtcCB8fCAoZGF0YSBhcyBhbnkpLnVwZGF0ZWRfYXQ7XHJcbiAgICB0aGlzLmVkaXRlZFRpbWVzdGFtcCA9IGVkaXRlZFRpbWVzdGFtcCA/IG5ldyBEYXRlKGVkaXRlZFRpbWVzdGFtcCkuZ2V0VGltZSgpIDogdW5kZWZpbmVkO1xyXG4gICAgXHJcbiAgICB0aGlzLmF0dGFjaG1lbnRzID0gZGF0YS5hdHRhY2htZW50cyB8fCBbXTtcclxuICAgIFxyXG4gICAgLy8gTm9ybWFsaXplIGVtYmVkcyBmcm9tIGJhY2tlbmQgKGZsYXQgZm9ybWF0IOKGkiBuZXN0ZWQgZm9ybWF0KVxyXG4gICAgdGhpcy5lbWJlZHMgPSBkYXRhLmVtYmVkcyA/IGRhdGEuZW1iZWRzLm1hcChub3JtYWxpemVFbWJlZCkgOiBbXTtcclxuICAgIFxyXG4gICAgdGhpcy5tZW50aW9ucyA9IChkYXRhIGFzIGFueSkubWVudGlvbnMgfHwge307XHJcbiAgICB0aGlzLnVzZXJfaWQgPSAoZGF0YSBhcyBhbnkpLnVzZXJfaWQ7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgdGhlIGNyZWF0aW9uIGRhdGVcclxuICAgKi9cclxuICBnZXQgY3JlYXRlZEF0KCk6IERhdGUge1xyXG4gICAgcmV0dXJuIG5ldyBEYXRlKHRoaXMuY3JlYXRlZFRpbWVzdGFtcCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgdGhlIGVkaXQgZGF0ZVxyXG4gICAqL1xyXG4gIGdldCBlZGl0ZWRBdCgpOiBEYXRlIHwgbnVsbCB7XHJcbiAgICByZXR1cm4gdGhpcy5lZGl0ZWRUaW1lc3RhbXAgPyBuZXcgRGF0ZSh0aGlzLmVkaXRlZFRpbWVzdGFtcCkgOiBudWxsO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVwbHkgdG8gdGhpcyBtZXNzYWdlXHJcbiAgICovXHJcbiAgYXN5bmMgcmVwbHkob3B0aW9uczogc3RyaW5nIHwgTWVzc2FnZUNyZWF0ZU9wdGlvbnMpOiBQcm9taXNlPE1lc3NhZ2U+IHtcclxuICAgIGNvbnN0IGNvbnRlbnQgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyBvcHRpb25zIDogb3B0aW9ucy5jb250ZW50O1xyXG4gICAgY29uc3QgZW1iZWRzID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gdW5kZWZpbmVkIDogcmVzb2x2ZUVtYmVkcyhvcHRpb25zLmVtYmVkcyk7XHJcbiAgICBjb25zdCBjb21wb25lbnRzID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gdW5kZWZpbmVkIDogb3B0aW9ucy5jb21wb25lbnRzO1xyXG4gICAgXHJcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5jbGllbnQucmVzdC5jcmVhdGVNZXNzYWdlKHRoaXMuZ3VpbGRJZCB8fCAnJywgdGhpcy5jaGFubmVsSWQsIHtcclxuICAgICAgY29udGVudCxcclxuICAgICAgZW1iZWRzLFxyXG4gICAgICBjb21wb25lbnRzLFxyXG4gICAgICBtZXNzYWdlX3JlZmVyZW5jZTogeyBtZXNzYWdlX2lkOiB0aGlzLmlkIH1cclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICByZXR1cm4gbmV3IE1lc3NhZ2UodGhpcy5jbGllbnQsIGRhdGEpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRWRpdCB0aGlzIG1lc3NhZ2UgKG9ubHkgaWYgYXV0aG9yIGlzIHRoZSBib3QpXHJcbiAgICovXHJcbiAgYXN5bmMgZWRpdChvcHRpb25zOiBzdHJpbmcgfCBNZXNzYWdlQ3JlYXRlT3B0aW9ucyk6IFByb21pc2U8TWVzc2FnZT4ge1xyXG4gICAgY29uc3QgY29udGVudCA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IG9wdGlvbnMgOiBvcHRpb25zLmNvbnRlbnQ7XHJcbiAgICBjb25zdCBlbWJlZHMgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyB1bmRlZmluZWQgOiByZXNvbHZlRW1iZWRzKG9wdGlvbnMuZW1iZWRzKTtcclxuICAgIGNvbnN0IGNvbXBvbmVudHMgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyB1bmRlZmluZWQgOiBvcHRpb25zLmNvbXBvbmVudHM7XHJcbiAgICBcclxuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LmVkaXRNZXNzYWdlKHRoaXMuZ3VpbGRJZCB8fCAnJywgdGhpcy5jaGFubmVsSWQsIHRoaXMuaWQsIHtcclxuICAgICAgY29udGVudCxcclxuICAgICAgZW1iZWRzLFxyXG4gICAgICBjb21wb25lbnRzLFxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIHJldHVybiBuZXcgTWVzc2FnZSh0aGlzLmNsaWVudCwgZGF0YSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZWxldGUgdGhpcyBtZXNzYWdlXHJcbiAgICovXHJcbiAgYXN5bmMgZGVsZXRlKCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5kZWxldGVNZXNzYWdlKHRoaXMuZ3VpbGRJZCB8fCAnJywgdGhpcy5jaGFubmVsSWQsIHRoaXMuaWQpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVhY3QgdG8gdGhpcyBtZXNzYWdlXHJcbiAgICovXHJcbiAgYXN5bmMgcmVhY3QoZW1vamk6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5hZGRSZWFjdGlvbih0aGlzLmd1aWxkSWQgfHwgJycsIHRoaXMuY2hhbm5lbElkLCB0aGlzLmlkLCBlbW9qaSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBQaW4gdGhpcyBtZXNzYWdlXHJcbiAgICovXHJcbiAgYXN5bmMgcGluKCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5waW5NZXNzYWdlKHRoaXMuZ3VpbGRJZCB8fCAnJywgdGhpcy5jaGFubmVsSWQsIHRoaXMuaWQpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVW5waW4gdGhpcyBtZXNzYWdlXHJcbiAgICovXHJcbiAgYXN5bmMgdW5waW4oKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LnVucGluTWVzc2FnZSh0aGlzLmd1aWxkSWQgfHwgJycsIHRoaXMuY2hhbm5lbElkLCB0aGlzLmlkKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIGNvbXBvbmVudCBpbnRlcmFjdGlvbiBjb2xsZWN0b3Igb24gdGhpcyBtZXNzYWdlXHJcbiAgICovXHJcbiAgY3JlYXRlTWVzc2FnZUNvbXBvbmVudENvbGxlY3RvcihvcHRpb25zPzogT21pdDxJbnRlcmFjdGlvbkNvbGxlY3Rvck9wdGlvbnMsICdtZXNzYWdlSWQnPik6IEludGVyYWN0aW9uQ29sbGVjdG9yIHtcclxuICAgIHJldHVybiBuZXcgSW50ZXJhY3Rpb25Db2xsZWN0b3IodGhpcy5jbGllbnQsIHtcclxuICAgICAgLi4ub3B0aW9ucyxcclxuICAgICAgbWVzc2FnZUlkOiB0aGlzLmlkLFxyXG4gICAgICBjaGFubmVsSWQ6IHRoaXMuY2hhbm5lbElkLFxyXG4gICAgICBndWlsZElkOiB0aGlzLmd1aWxkSWQsXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEF3YWl0IGNvbXBvbmVudCBpbnRlcmFjdGlvbnMgb24gdGhpcyBtZXNzYWdlXHJcbiAgICovXHJcbiAgYXdhaXRNZXNzYWdlQ29tcG9uZW50KG9wdGlvbnM/OiBPbWl0PEludGVyYWN0aW9uQ29sbGVjdG9yT3B0aW9ucywgJ21lc3NhZ2VJZCcgfCAnbWF4Jz4pOiBQcm9taXNlPGFueT4ge1xyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgY29uc3QgY29sbGVjdG9yID0gdGhpcy5jcmVhdGVNZXNzYWdlQ29tcG9uZW50Q29sbGVjdG9yKHsgLi4ub3B0aW9ucywgbWF4OiAxIH0pO1xyXG4gICAgICBcclxuICAgICAgY29sbGVjdG9yLm9uY2UoJ2VuZCcsIChjb2xsZWN0ZWQsIHJlYXNvbikgPT4ge1xyXG4gICAgICAgIGNvbnN0IGZpcnN0ID0gY29sbGVjdGVkLmZpcnN0KCk7XHJcbiAgICAgICAgaWYgKGZpcnN0KSB7XHJcbiAgICAgICAgICByZXNvbHZlKGZpcnN0KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihyZWFzb24gfHwgJ05vIGludGVyYWN0aW9uIHJlY2VpdmVkJykpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENvbnZlcnQgdG8gc3RyaW5nXHJcbiAgICovXHJcbiAgdG9TdHJpbmcoKTogc3RyaW5nIHtcclxuICAgIHJldHVybiB0aGlzLmNvbnRlbnQ7XHJcbiAgfVxyXG59XHJcbiJdfQ==