"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Message = void 0;
const User_1 = require("./User");
const Collector_1 = require("../utils/Collector");
const EmbedBuilder_1 = require("../builders/EmbedBuilder");
/** Backend flat embed format (for normalization) */
/** Resolve EmbedBuilder instances to plain API objects */
function resolveEmbeds(embeds) {
    if (!embeds)
        return undefined;
    return embeds.map(e => e instanceof EmbedBuilder_1.EmbedBuilder ? e.toJSON() : e);
}
/**
 * Serialize components array (ActionRowBuilder/ButtonBuilder instances) to plain JSON.
 * Handles nested structures: ActionRow → components[] → Button/SelectMenu
 */
function serializeComponents(components) {
    if (!components)
        return undefined;
    return components.map(row => {
        const rowData = typeof row?.toJSON === 'function' ? row.toJSON() : row;
        if (rowData?.components && Array.isArray(rowData.components)) {
            rowData.components = rowData.components.map((comp) => typeof comp?.toJSON === 'function' ? comp.toJSON() : comp);
        }
        return rowData;
    });
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
        // Components (ActionRows with buttons, select menus, etc.)
        this.components = data.components || [];
        this.mentions = data.mentions || {};
        this.user_id = data.user_id;
    }
    /**
     * The channel this message was sent in (resolved from guild cache)
     * Returns null if guild or channel is not cached
     */
    get channel() {
        if (this.guildId) {
            const guild = this.client.guilds.get(this.guildId);
            const channelData = guild?.channels.get(this.channelId);
            if (channelData) {
                return {
                    ...channelData,
                    id: this.channelId,
                    guildId: this.guildId,
                    name: channelData.name ?? null,
                    send: async (options) => {
                        const content = typeof options === 'string' ? options : options.content;
                        const embeds = typeof options === 'string' ? undefined : resolveEmbeds(options.embeds);
                        const components = typeof options === 'string' ? undefined : serializeComponents(options.components);
                        const data = await this.client.rest.createMessage(this.guildId, this.channelId, { content, embeds, components });
                        return new Message(this.client, data);
                    },
                    toString: () => `<#${this.channelId}>`,
                };
            }
        }
        // Fallback: minimal channel object with just ID
        return {
            id: this.channelId,
            guildId: this.guildId ?? null,
            name: null,
            send: async (options) => {
                const content = typeof options === 'string' ? options : options.content;
                const embeds = typeof options === 'string' ? undefined : resolveEmbeds(options.embeds);
                const components = typeof options === 'string' ? undefined : serializeComponents(options.components);
                const data = await this.client.rest.createMessage(this.guildId || '', this.channelId, { content, embeds, components });
                return new Message(this.client, data);
            },
            toString: () => `<#${this.channelId}>`,
        };
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
     */
    async reply(options) {
        const content = typeof options === 'string' ? options : options.content;
        const embeds = typeof options === 'string' ? undefined : resolveEmbeds(options.embeds);
        const components = typeof options === 'string' ? undefined : serializeComponents(options.components);
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
        const components = typeof options === 'string' ? undefined : serializeComponents(options.components);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTWVzc2FnZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zdHJ1Y3R1cmVzL01lc3NhZ2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQ0EsaUNBQThCO0FBSzlCLGtEQUF1RjtBQUN2RiwyREFBd0Q7QUFFeEQsb0RBQW9EO0FBQ3BELDBEQUEwRDtBQUMxRCxTQUFTLGFBQWEsQ0FBQyxNQUFvQztJQUN6RCxJQUFJLENBQUMsTUFBTTtRQUFFLE9BQU8sU0FBUyxDQUFDO0lBQzlCLE9BQU8sTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsWUFBWSwyQkFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3JFLENBQUM7QUFFRDs7O0dBR0c7QUFDSCxTQUFTLG1CQUFtQixDQUFDLFVBQTZCO0lBQ3hELElBQUksQ0FBQyxVQUFVO1FBQUUsT0FBTyxTQUFTLENBQUM7SUFDbEMsT0FBTyxVQUFVLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFO1FBQzFCLE1BQU0sT0FBTyxHQUFHLE9BQU8sR0FBRyxFQUFFLE1BQU0sS0FBSyxVQUFVLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDO1FBQ3ZFLElBQUksT0FBTyxFQUFFLFVBQVUsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDO1lBQzdELE9BQU8sQ0FBQyxVQUFVLEdBQUcsT0FBTyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFTLEVBQUUsRUFBRSxDQUN4RCxPQUFPLElBQUksRUFBRSxNQUFNLEtBQUssVUFBVSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FDMUQsQ0FBQztRQUNKLENB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QUMsQ0FBQztnQkFDakIsQ0FBQztxQkFBTSxDQUFDO29CQUNOLE1BQU0sQ0FBQyxJQUFJLEtBQUssQ0FBQyxNQUFNLElBQUkseUJBQXlCLENBQUMsQ0FBQyxDQUFDO2dCQUN6RCxDQUFDO1lBQ0gsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRDs7T0FFRztJQUNILFFBQVE7UUFDTixPQUFPLElBQUksQ0FBQyxPQUFPLENBQUM7SUFDdEIsQ0FBQztDQUNGO0FBek9ELDBCQXlPQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFQSU1lc3NhZ2UsIEFQSUVtYmVkLCBBUElBdHRhY2htZW50IH0gZnJvbSAnLi4vdHlwZXMnO1xyXG5pbXBvcnQgeyBVc2VyIH0gZnJvbSAnLi9Vc2VyJztcclxuaW1wb3J0IHsgR3VpbGRNZW1iZXIgfSBmcm9tICcuL0d1aWxkTWVtYmVyJztcclxuaW1wb3J0IHR5cGUgeyBDbGllbnQgfSBmcm9tICcuLi9DbGllbnQnO1xyXG5pbXBvcnQgdHlwZSB7IE1lc3NhZ2VDcmVhdGVPcHRpb25zIH0gZnJvbSAnLi9DaGFubmVsJztcclxuaW1wb3J0IHsgQ29sbGVjdGlvbiB9IGZyb20gJy4vQ29sbGVjdGlvbic7XHJcbmltcG9ydCB7IEludGVyYWN0aW9uQ29sbGVjdG9yLCBJbnRlcmFjdGlvbkNvbGxlY3Rvck9wdGlvbnMgfSBmcm9tICcuLi91dGlscy9Db2xsZWN0b3InO1xyXG5pbXBvcnQgeyBFbWJlZEJ1aWxkZXIgfSBmcm9tICcuLi9idWlsZGVycy9FbWJlZEJ1aWxkZXInO1xyXG5cclxuLyoqIEJhY2tlbmQgZmxhdCBlbWJlZCBmb3JtYXQgKGZvciBub3JtYWxpemF0aW9uKSAqL1xyXG4vKiogUmVzb2x2ZSBFbWJlZEJ1aWxkZXIgaW5zdGFuY2VzIHRvIHBsYWluIEFQSSBvYmplY3RzICovXHJcbmZ1bmN0aW9uIHJlc29sdmVFbWJlZHMoZW1iZWRzPzogKEFQSUVtYmVkIHwgRW1iZWRCdWlsZGVyKVtdKTogQVBJRW1iZWRbXSB8IHVuZGVmaW5lZCB7XHJcbiAgaWYgKCFlbWJlZHMpIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgcmV0dXJuIGVtYmVkcy5tYXAoZSA9PiBlIGluc3RhbmNlb2YgRW1iZWRCdWlsZGVyID8gZS50b0pTT04oKSA6IGUpO1xyXG59XHJcblxyXG4vKipcclxuICogU2VyaWFsaXplIGNvbXBvbmVudHMgYXJyYXkgKEFjdGlvblJvd0J1aWxkZXIvQnV0dG9uQnVpbGRlciBpbnN0YW5jZXMpIHRvIHBsYWluIEpTT04uXHJcbiAqIEhhbmRsZXMgbmVzdGVkIHN0cnVjdHVyZXM6IEFjdGlvblJvdyDihpIgY29tcG9uZW50c1tdIOKGkiBCdXR0b24vU2VsZWN0TWVudVxyXG4gKi9cclxuZnVuY3Rpb24gc2VyaWFsaXplQ29tcG9uZW50cyhjb21wb25lbnRzOiBhbnlbXSB8IHVuZGVmaW5lZCk6IGFueVtdIHwgdW5kZWZpbmVkIHtcclxuICBpZiAoIWNvbXBvbmVudHMpIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgcmV0dXJuIGNvbXBvbmVudHMubWFwKHJvdyA9PiB7XHJcbiAgICBjb25zdCByb3dEYXRhID0gdHlwZW9mIHJvdz8udG9KU09OID09PSAnZnVuY3Rpb24nID8gcm93LnRvSlNPTigpIDogcm93O1xyXG4gICAgaWYgKHJvd0RhdGE/LmNvbXBvbmVudHMgJiYgQXJyYXkuaXNBcnJheShyb3dEYXRhLmNvbXBvbmVudHMpKSB7XHJcbiAgICAgIHJvd0RhdGEuY29tcG9uZW50cyA9IHJvd0RhdGEuY29tcG9uZW50cy5tYXAoKGNvbXA6IGFueSkgPT5cclxuICAgICAgICB0eXBlb2YgY29tcD8udG9KU09OID09PSAnZnVuY3Rpb24nID8gY29tcC50b0pTT04oKSA6IGNvbXBcclxuICAgICAgKTtcclxuICAgIH1cclxuICAgIHJldHVybiByb3dEYXRhO1xyXG4gIH0pO1xyXG59XHJcblxyXG4vKiogTm9ybWFsaXplIGVtYmVkIGZyb20gYmFja2VuZCB0byBBUElFbWJlZCBmb3JtYXQgKi9cclxuZnVuY3Rpb24gbm9ybWFsaXplRW1iZWQoZW1iZWQ6IEFQSUVtYmVkICYgeyBpbWFnZT86IHsgdXJsOiBzdHJpbmcgfSB8IHN0cmluZzsgdGh1bWJuYWlsPzogeyB1cmw6IHN0cmluZyB9IHwgc3RyaW5nIH0pOiBBUElFbWJlZCB7XHJcbiAgY29uc3Qgbm9ybWFsaXplZDogQVBJRW1iZWQgPSB7XHJcbiAgICB0aXRsZTogZW1iZWQudGl0bGUsXHJcbiAgICBkZXNjcmlwdGlvbjogZW1iZWQuZGVzY3JpcHRpb24sXHJcbiAgICB1cmw6IGVtYmVkLnVybCxcclxuICAgIHRpbWVzdGFtcDogZW1iZWQudGltZXN0YW1wLFxyXG4gICAgY29sb3I6IGVtYmVkLmNvbG9yLFxyXG4gICAgZmllbGRzOiBlbWJlZC5maWVsZHMsXHJcbiAgICBhdXRob3I6IGVtYmVkLmF1dGhvcixcclxuICAgIGZvb3RlcjogZW1iZWQuZm9vdGVyLFxyXG4gIH07XHJcblxyXG4gIC8vIE5vcm1hbGl6ZSB0aHVtYm5haWw6IHN0cmluZyDihpIgbmVzdGVkIG9iamVjdFxyXG4gIGlmICh0eXBlb2YgZW1iZWQudGh1bWJuYWlsID09PSAnc3RyaW5nJykge1xyXG4gICAgbm9ybWFsaXplZC50aHVtYm5haWwgPSB7IHVybDogZW1iZWQudGh1bWJuYWlsIH07XHJcbiAgfSBlbHNlIGlmIChlbWJlZC50aHVtYm5haWwgJiYgdHlwZW9mIGVtYmVkLnRodW1ibmFpbCA9PT0gJ29iamVjdCcpIHtcclxuICAgIG5vcm1hbGl6ZWQudGh1bWJuYWlsID0gZW1iZWQudGh1bWJuYWlsO1xyXG4gIH1cclxuXHJcbiAgLy8gTm9ybWFsaXplIGltYWdlOiBzdHJpbmcg4oaSIG5lc3RlZCBvYmplY3RcclxuICBpZiAodHlwZW9mIGVtYmVkLmltYWdlID09PSAnc3RyaW5nJykge1xyXG4gICAgbm9ybWFsaXplZC5pbWFnZSA9IHsgdXJsOiBlbWJlZC5pbWFnZSB9O1xyXG4gIH0gZWxzZSBpZiAoZW1iZWQuaW1hZ2UgJiYgdHlwZW9mIGVtYmVkLmltYWdlID09PSAnb2JqZWN0Jykge1xyXG4gICAgbm9ybWFsaXplZC5pbWFnZSA9IGVtYmVkLmltYWdlO1xyXG4gIH1cclxuXHJcbiAgcmV0dXJuIG5vcm1hbGl6ZWQ7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBNZW50aW9uIGRhdGEgZnJvbSBiYWNrZW5kXHJcbiAqL1xyXG5leHBvcnQgaW50ZXJmYWNlIE1lc3NhZ2VNZW50aW9ucyB7XHJcbiAgdXNlcnM/OiBBcnJheTx7IGlkOiBudW1iZXIgfCBzdHJpbmc7IHVzZXJuYW1lOiBzdHJpbmcgfT47XHJcbiAgcm9sZXM/OiBBcnJheTx7IGlkOiBzdHJpbmc7IG5hbWU/OiBzdHJpbmcgfT47XHJcbiAgZXZlcnlvbmU/OiBib29sZWFuO1xyXG59XHJcblxyXG4vKipcclxuICogUmVwcmVzZW50cyBhIG1lc3NhZ2VcclxuICovXHJcbmV4cG9ydCBjbGFzcyBNZXNzYWdlIHtcclxuICAvKiogUmVmZXJlbmNlIHRvIHRoZSBjbGllbnQgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgY2xpZW50OiBDbGllbnQ7XHJcbiAgXHJcbiAgLyoqIE1lc3NhZ2UgSUQgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgaWQ6IHN0cmluZztcclxuICBcclxuICAvKiogQ2hhbm5lbCBJRCAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBjaGFubmVsSWQ6IHN0cmluZztcclxuICBcclxuICAvKiogR3VpbGQgSUQgKGlmIGluIGEgZ3VpbGQpICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGd1aWxkSWQ/OiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIE1lc3NhZ2UgYXV0aG9yICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGF1dGhvcjogVXNlcjtcclxuICBcclxuICAvKiogTWVzc2FnZSBjb250ZW50ICovXHJcbiAgcHVibGljIGNvbnRlbnQ6IHN0cmluZztcclxuICBcclxuICAvKiogTWVzc2FnZSB0aW1lc3RhbXAgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgY3JlYXRlZFRpbWVzdGFtcDogbnVtYmVyO1xyXG4gIFxyXG4gIC8qKiBFZGl0IHRpbWVzdGFtcCAqL1xyXG4gIHB1YmxpYyBlZGl0ZWRUaW1lc3RhbXA/OiBudW1iZXI7XHJcbiAgXHJcbiAgLyoqIEF0dGFjaG1lbnRzICovXHJcbiAgcHVibGljIGF0dGFjaG1lbnRzOiBBUElBdHRhY2htZW50W107XHJcbiAgXHJcbiAgLyoqIEVtYmVkcyAqL1xyXG4gIHB1YmxpYyBlbWJlZHM6IEFQSUVtYmVkW107XHJcblxyXG4gIC8qKiBDb21wb25lbnRzIChidXR0b25zLCBzZWxlY3QgbWVudXMsIGV0Yy4pICovXHJcbiAgcHVibGljIGNvbXBvbmVudHM6IGFueVtdO1xyXG5cclxuICAvKiogTWVudGlvbnMgaW4gdGhlIG1lc3NhZ2UgKi9cclxuICBwdWJsaWMgbWVudGlvbnM6IE1lc3NhZ2VNZW50aW9ucztcclxuXHJcbiAgLyoqIFVzZXIgSUQgKGZyb20gYmFja2VuZCkgKi9cclxuICBwdWJsaWMgdXNlcl9pZD86IG51bWJlcjtcclxuXHJcbiAgLyoqIEd1aWxkIG1lbWJlciAoaWYgaW4gYSBndWlsZCkgKi9cclxuICBwdWJsaWMgbWVtYmVyPzogR3VpbGRNZW1iZXI7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGNsaWVudDogQ2xpZW50LCBkYXRhOiBBUElNZXNzYWdlKSB7XHJcbiAgICB0aGlzLmNsaWVudCA9IGNsaWVudDtcclxuICAgIHRoaXMuaWQgPSBkYXRhLmlkO1xyXG4gICAgdGhpcy5jaGFubmVsSWQgPSBkYXRhLmNoYW5uZWxfaWQ7XHJcbiAgICB0aGlzLmd1aWxkSWQgPSBkYXRhLmd1aWxkX2lkO1xyXG4gICAgdGhpcy5hdXRob3IgPSBuZXcgVXNlcihkYXRhLmF1dGhvcik7XHJcbiAgICB0aGlzLmNvbnRlbnQgPSBkYXRhLmNvbnRlbnQgPz8gJyc7XHJcbiAgICBcclxuICAgIC8vIEhhbmRsZSBkaWZmZXJlbnQgdGltZXN0YW1wIGZvcm1hdHMgZnJvbSBiYWNrZW5kXHJcbiAgICBjb25zdCB0aW1lc3RhbXAgPSBkYXRhLnRpbWVzdGFtcCB8fCAoZGF0YSBhcyBhbnkpLmNyZWF0ZWRfYXQ7XHJcbiAgICB0aGlzLmNyZWF0ZWRUaW1lc3RhbXAgPSB0aW1lc3RhbXAgPyBuZXcgRGF0ZSh0aW1lc3RhbXApLmdldFRpbWUoKSA6IERhdGUubm93KCk7XHJcbiAgICBcclxuICAgIGNvbnN0IGVkaXRlZFRpbWVzdGFtcCA9IGRhdGEuZWRpdGVkX3RpbWVzdGFtcCB8fCAoZGF0YSBhcyBhbnkpLnVwZGF0ZWRfYXQ7XHJcbiAgICB0aGlzLmVkaXRlZFRpbWVzdGFtcCA9IGVkaXRlZFRpbWVzdGFtcCA/IG5ldyBEYXRlKGVkaXRlZFRpbWVzdGFtcCkuZ2V0VGltZSgpIDogdW5kZWZpbmVkO1xyXG4gICAgXHJcbiAgICB0aGlzLmF0dGFjaG1lbnRzID0gZGF0YS5hdHRhY2htZW50cyB8fCBbXTtcclxuICAgIFxyXG4gICAgLy8gTm9ybWFsaXplIGVtYmVkcyBmcm9tIGJhY2tlbmQgKGZsYXQgZm9ybWF0IOKGkiBuZXN0ZWQgZm9ybWF0KVxyXG4gICAgdGhpcy5lbWJlZHMgPSBkYXRhLmVtYmVkcyA/IGRhdGEuZW1iZWRzLm1hcChub3JtYWxpemVFbWJlZCkgOiBbXTtcclxuICAgIFxyXG4gICAgLy8gQ29tcG9uZW50cyAoQWN0aW9uUm93cyB3aXRoIGJ1dHRvbnMsIHNlbGVjdCBtZW51cywgZXRjLilcclxuICAgIHRoaXMuY29tcG9uZW50cyA9IChkYXRhIGFzIGFueSkuY29tcG9uZW50cyB8fCBbXTtcclxuICAgIFxyXG4gICAgdGhpcy5tZW50aW9ucyA9IChkYXRhIGFzIGFueSkubWVudGlvbnMgfHwge307XHJcbiAgICB0aGlzLnVzZXJfaWQgPSAoZGF0YSBhcyBhbnkpLnVzZXJfaWQ7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBUaGUgY2hhbm5lbCB0aGlzIG1lc3NhZ2Ugd2FzIHNlbnQgaW4gKHJlc29sdmVkIGZyb20gZ3VpbGQgY2FjaGUpXHJcbiAgICogUmV0dXJucyBudWxsIGlmIGd1aWxkIG9yIGNoYW5uZWwgaXMgbm90IGNhY2hlZFxyXG4gICAqL1xyXG4gIGdldCBjaGFubmVsKCkge1xyXG4gICAgaWYgKHRoaXMuZ3VpbGRJZCkge1xyXG4gICAgICBjb25zdCBndWlsZCA9IHRoaXMuY2xpZW50Lmd1aWxkcy5nZXQodGhpcy5ndWlsZElkKTtcclxuICAgICAgY29uc3QgY2hhbm5lbERhdGEgPSBndWlsZD8uY2hhbm5lbHMuZ2V0KHRoaXMuY2hhbm5lbElkKTtcclxuICAgICAgaWYgKGNoYW5uZWxEYXRhKSB7XHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgIC4uLmNoYW5uZWxEYXRhLFxyXG4gICAgICAgICAgaWQ6IHRoaXMuY2hhbm5lbElkLFxyXG4gICAgICAgICAgZ3VpbGRJZDogdGhpcy5ndWlsZElkLFxyXG4gICAgICAgICAgbmFtZTogKGNoYW5uZWxEYXRhIGFzIGFueSkubmFtZSA/PyBudWxsLFxyXG4gICAgICAgICAgc2VuZDogYXN5bmMgKG9wdGlvbnM6IHN0cmluZyB8IE1lc3NhZ2VDcmVhdGVPcHRpb25zKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyBvcHRpb25zIDogb3B0aW9ucy5jb250ZW50O1xyXG4gICAgICAgICAgICBjb25zdCBlbWJlZHMgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyB1bmRlZmluZWQgOiByZXNvbHZlRW1iZWRzKG9wdGlvbnMuZW1iZWRzKTtcclxuICAgICAgICAgICAgY29uc3QgY29tcG9uZW50cyA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IHVuZGVmaW5lZCA6IHNlcmlhbGl6ZUNvbXBvbmVudHMob3B0aW9ucy5jb21wb25lbnRzKTtcclxuICAgICAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHRoaXMuY2xpZW50LnJlc3QuY3JlYXRlTWVzc2FnZSh0aGlzLmd1aWxkSWQhLCB0aGlzLmNoYW5uZWxJZCwgeyBjb250ZW50LCBlbWJlZHMsIGNvbXBvbmVudHMgfSk7XHJcbiAgICAgICAgICAgIHJldHVybiBuZXcgTWVzc2FnZSh0aGlzLmNsaWVudCwgZGF0YSk7XHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgdG9TdHJpbmc6ICgpID0+IGA8IyR7dGhpcy5jaGFubmVsSWR9PmAsXHJcbiAgICAgICAgfTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgLy8gRmFsbGJhY2s6IG1pbmltYWwgY2hhbm5lbCBvYmplY3Qgd2l0aCBqdXN0IElEXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBpZDogdGhpcy5jaGFubmVsSWQsXHJcbiAgICAgIGd1aWxkSWQ6IHRoaXMuZ3VpbGRJZCA/PyBudWxsLFxyXG4gICAgICBuYW1lOiBudWxsLFxyXG4gICAgICBzZW5kOiBhc3luYyAob3B0aW9uczogc3RyaW5nIHwgTWVzc2FnZUNyZWF0ZU9wdGlvbnMpID0+IHtcclxuICAgICAgICBjb25zdCBjb250ZW50ID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gb3B0aW9ucyA6IG9wdGlvbnMuY29udGVudDtcclxuICAgICAgICBjb25zdCBlbWJlZHMgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyB1bmRlZmluZWQgOiByZXNvbHZlRW1iZWRzKG9wdGlvbnMuZW1iZWRzKTtcclxuICAgICAgICBjb25zdCBjb21wb25lbnRzID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gdW5kZWZpbmVkIDogc2VyaWFsaXplQ29tcG9uZW50cyhvcHRpb25zLmNvbXBvbmVudHMpO1xyXG4gICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LmNyZWF0ZU1lc3NhZ2UodGhpcy5ndWlsZElkIHx8ICcnLCB0aGlzLmNoYW5uZWxJZCwgeyBjb250ZW50LCBlbWJlZHMsIGNvbXBvbmVudHMgfSk7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBNZXNzYWdlKHRoaXMuY2xpZW50LCBkYXRhKTtcclxuICAgICAgfSxcclxuICAgICAgdG9TdHJpbmc6ICgpID0+IGA8IyR7dGhpcy5jaGFubmVsSWR9PmAsXHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IHRoZSBjcmVhdGlvbiBkYXRlXHJcbiAgICovXHJcbiAgZ2V0IGNyZWF0ZWRBdCgpOiBEYXRlIHtcclxuICAgIHJldHVybiBuZXcgRGF0ZSh0aGlzLmNyZWF0ZWRUaW1lc3RhbXApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVGhlIGd1aWxkIHRoaXMgbWVzc2FnZSB3YXMgc2VudCBpbiAoaWYgaW4gYSBndWlsZClcclxuICAgKiBEaXNjb3JkLmpzIGNvbXBhdGlibGU6IG1lc3NhZ2UuZ3VpbGRcclxuICAgKi9cclxuICBnZXQgZ3VpbGQoKSB7XHJcbiAgICBpZiAoIXRoaXMuZ3VpbGRJZCkgcmV0dXJuIG51bGw7XHJcbiAgICByZXR1cm4gdGhpcy5jbGllbnQuZ3VpbGRzLmdldCh0aGlzLmd1aWxkSWQpID8/IG51bGw7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgdGhlIGVkaXQgZGF0ZVxyXG4gICAqL1xyXG4gIGdldCBlZGl0ZWRBdCgpOiBEYXRlIHwgbnVsbCB7XHJcbiAgICByZXR1cm4gdGhpcy5lZGl0ZWRUaW1lc3RhbXAgPyBuZXcgRGF0ZSh0aGlzLmVkaXRlZFRpbWVzdGFtcCkgOiBudWxsO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVwbHkgdG8gdGhpcyBtZXNzYWdlXHJcbiAgICovXHJcbiAgYXN5bmMgcmVwbHkob3B0aW9uczogc3RyaW5nIHwgTWVzc2FnZUNyZWF0ZU9wdGlvbnMpOiBQcm9taXNlPE1lc3NhZ2U+IHtcclxuICAgIGNvbnN0IGNvbnRlbnQgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyBvcHRpb25zIDogb3B0aW9ucy5jb250ZW50O1xyXG4gICAgY29uc3QgZW1iZWRzID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gdW5kZWZpbmVkIDogcmVzb2x2ZUVtYmVkcyhvcHRpb25zLmVtYmVkcyk7XHJcbiAgICBjb25zdCBjb21wb25lbnRzID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gdW5kZWZpbmVkIDogc2VyaWFsaXplQ29tcG9uZW50cyhvcHRpb25zLmNvbXBvbmVudHMpO1xyXG4gICAgXHJcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5jbGllbnQucmVzdC5jcmVhdGVNZXNzYWdlKHRoaXMuZ3VpbGRJZCB8fCAnJywgdGhpcy5jaGFubmVsSWQsIHtcclxuICAgICAgY29udGVudCxcclxuICAgICAgZW1iZWRzLFxyXG4gICAgICBjb21wb25lbnRzLFxyXG4gICAgICBtZXNzYWdlX3JlZmVyZW5jZTogeyBtZXNzYWdlX2lkOiB0aGlzLmlkIH1cclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICByZXR1cm4gbmV3IE1lc3NhZ2UodGhpcy5jbGllbnQsIGRhdGEpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRWRpdCB0aGlzIG1lc3NhZ2UgKG9ubHkgaWYgYXV0aG9yIGlzIHRoZSBib3QpXHJcbiAgICovXHJcbiAgYXN5bmMgZWRpdChvcHRpb25zOiBzdHJpbmcgfCBNZXNzYWdlQ3JlYXRlT3B0aW9ucyk6IFByb21pc2U8TWVzc2FnZT4ge1xyXG4gICAgY29uc3QgY29udGVudCA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IG9wdGlvbnMgOiBvcHRpb25zLmNvbnRlbnQ7XHJcbiAgICBjb25zdCBlbWJlZHMgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyB1bmRlZmluZWQgOiByZXNvbHZlRW1iZWRzKG9wdGlvbnMuZW1iZWRzKTtcclxuICAgIGNvbnN0IGNvbXBvbmVudHMgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyB1bmRlZmluZWQgOiBzZXJpYWxpemVDb21wb25lbnRzKG9wdGlvbnMuY29tcG9uZW50cyk7XHJcbiAgICBcclxuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LmVkaXRNZXNzYWdlKHRoaXMuZ3VpbGRJZCB8fCAnJywgdGhpcy5jaGFubmVsSWQsIHRoaXMuaWQsIHtcclxuICAgICAgY29udGVudCxcclxuICAgICAgZW1iZWRzLFxyXG4gICAgICBjb21wb25lbnRzLFxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIHJldHVybiBuZXcgTWVzc2FnZSh0aGlzLmNsaWVudCwgZGF0YSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZWxldGUgdGhpcyBtZXNzYWdlXHJcbiAgICovXHJcbiAgYXN5bmMgZGVsZXRlKCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5kZWxldGVNZXNzYWdlKHRoaXMuZ3VpbGRJZCB8fCAnJywgdGhpcy5jaGFubmVsSWQsIHRoaXMuaWQpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVhY3QgdG8gdGhpcyBtZXNzYWdlXHJcbiAgICovXHJcbiAgYXN5bmMgcmVhY3QoZW1vamk6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5hZGRSZWFjdGlvbih0aGlzLmd1aWxkSWQgfHwgJycsIHRoaXMuY2hhbm5lbElkLCB0aGlzLmlkLCBlbW9qaSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBQaW4gdGhpcyBtZXNzYWdlXHJcbiAgICovXHJcbiAgYXN5bmMgcGluKCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5waW5NZXNzYWdlKHRoaXMuZ3VpbGRJZCB8fCAnJywgdGhpcy5jaGFubmVsSWQsIHRoaXMuaWQpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVW5waW4gdGhpcyBtZXNzYWdlXHJcbiAgICovXHJcbiAgYXN5bmMgdW5waW4oKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LnVucGluTWVzc2FnZSh0aGlzLmd1aWxkSWQgfHwgJycsIHRoaXMuY2hhbm5lbElkLCB0aGlzLmlkKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIGNvbXBvbmVudCBpbnRlcmFjdGlvbiBjb2xsZWN0b3Igb24gdGhpcyBtZXNzYWdlXHJcbiAgICovXHJcbiAgY3JlYXRlTWVzc2FnZUNvbXBvbmVudENvbGxlY3RvcihvcHRpb25zPzogT21pdDxJbnRlcmFjdGlvbkNvbGxlY3Rvck9wdGlvbnMsICdtZXNzYWdlSWQnPik6IEludGVyYWN0aW9uQ29sbGVjdG9yIHtcclxuICAgIHJldHVybiBuZXcgSW50ZXJhY3Rpb25Db2xsZWN0b3IodGhpcy5jbGllbnQsIHtcclxuICAgICAgLi4ub3B0aW9ucyxcclxuICAgICAgbWVzc2FnZUlkOiB0aGlzLmlkLFxyXG4gICAgICBjaGFubmVsSWQ6IHRoaXMuY2hhbm5lbElkLFxyXG4gICAgICBndWlsZElkOiB0aGlzLmd1aWxkSWQsXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEF3YWl0IGNvbXBvbmVudCBpbnRlcmFjdGlvbnMgb24gdGhpcyBtZXNzYWdlXHJcbiAgICovXHJcbiAgYXdhaXRNZXNzYWdlQ29tcG9uZW50KG9wdGlvbnM/OiBPbWl0PEludGVyYWN0aW9uQ29sbGVjdG9yT3B0aW9ucywgJ21lc3NhZ2VJZCcgfCAnbWF4Jz4pOiBQcm9taXNlPGFueT4ge1xyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgY29uc3QgY29sbGVjdG9yID0gdGhpcy5jcmVhdGVNZXNzYWdlQ29tcG9uZW50Q29sbGVjdG9yKHsgLi4ub3B0aW9ucywgbWF4OiAxIH0pO1xyXG4gICAgICBcclxuICAgICAgY29sbGVjdG9yLm9uY2UoJ2VuZCcsIChjb2xsZWN0ZWQsIHJlYXNvbikgPT4ge1xyXG4gICAgICAgIGNvbnN0IGZpcnN0ID0gY29sbGVjdGVkLmZpcnN0KCk7XHJcbiAgICAgICAgaWYgKGZpcnN0KSB7XHJcbiAgICAgICAgICByZXNvbHZlKGZpcnN0KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihyZWFzb24gfHwgJ05vIGludGVyYWN0aW9uIHJlY2VpdmVkJykpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENvbnZlcnQgdG8gc3RyaW5nXHJcbiAgICovXHJcbiAgdG9TdHJpbmcoKTogc3RyaW5nIHtcclxuICAgIHJldHVybiB0aGlzLmNvbnRlbnQ7XHJcbiAgfVxyXG59XHJcbiJdfQ==