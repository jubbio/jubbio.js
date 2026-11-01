"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REST = void 0;
const serialize_1 = require("../utils/serialize");
const errors_1 = require("./errors");
/**
 * Regex to validate IDs in URL paths.
 * IDs should only contain digits to prevent path traversal attacks.
 */
const VALID_ID_PATTERN = /^\d+$/;
/**
 * Validate that an ID is safe to use in URL paths.
 * Prevents path traversal attacks like '../' in IDs.
 * @throws Error if ID is invalid
 */
function validateId(id, fieldName) {
    if (!id || typeof id !== 'string') {
        throw new Error(`Invalid ${fieldName}: must be a non-empty string`);
    }
    if (!VALID_ID_PATTERN.test(id)) {
        throw new Error(`Invalid ${fieldName}: must contain only digits, got "${id.substring(0, 20)}${id.length > 20 ? '...' : ''}"`);
    }
}
/**
 * REST API client for Jubbio
 */
class REST {
    baseUrl;
    token = '';
    // User cache for mention resolution (ID -> username)
    userCache = new Map();
    USER_CACHE_TTL = 5 * 60 * 1000; // 5 dakika
    constructor(baseUrl = 'https://gateway.jubbio.com/api/v1') {
        this.baseUrl = baseUrl;
    }
    // ==================== Mention Helpers ====================
    /**
     * Cache a user for mention resolution
     * Bot'lar interaction'dan gelen user bilgisini cache'leyebilir
     */
    cacheUser(user) {
        const userId = String(user.id);
        this.userCache.set(userId, {
            id: userId,
            username: user.username,
            displayName: user.displayName || user.display_name,
            cachedAt: Date.now()
        });
    }
    /**
     * Cache multiple users
     */
    cacheUsers(users) {
        users.forEach(user => this.cacheUser(user));
    }
    /**
     * Get cached user by ID
     */
    getCachedUser(userId) {
        const cached = this.userCache.get(userId);
        if (cached && Date.now() - cached.cachedAt < this.USER_CACHE_TTL) {
            return cached;
        }
        // Expired, remove from cache
        if (cached) {
            this.userCache.delete(userId);
        }
        return undefined;
    }
    /**
     * Format a user mention
     * Returns both the text format and mentions data
     *
     * @example
     * const mention = rest.formatMention(user);
     * // mention.text = "<@1>"
     * // mention.data = { users: [{ id: "1", username: "ilkay" }] }
     */
    formatMention(user) {
        const userId = String(user.id);
        return {
            text: `<@${userId}>`,
            data: {
                users: [{ id: userId, username: user.username }]
            }
        };
    }
    /**
     * Parse mentions (<@ID>) in content and build mentions data structure
     * Content is kept as-is with <@ID> format (client renders them)
     *
     * @param content - Message content with mentions
     * @param existingMentions - Existing mentions data to merge with
     * @returns Original content and mentions data
     */
    processMentions(content, existingMentions) {
        // Bug #5 fix - number veya diğer tipler string'e çevrilir
        const contentStr = String(content ?? '');
        const mentions = {
            users: [...(existingMentions?.users || [])],
            roles: [...(existingMentions?.roles || [])],
            everyone: existingMentions?.everyone
        };
        // Track already added user IDs to avoid duplicates
        const addedUserIds = new Set(mentions.users?.map(u => u.id) || []);
        // Parse <@ID> format (user mentions) — keep content as-is, only build mentions data
        const userMentionRegex = /<@!?(\d+)>/g;
        let match;
        while ((match = userMentionRegex.exec(contentStr)) !== null) {
            const userId = String(match[1]);
            if (!addedUserIds.has(userId)) {
                // Try to get username from cache for mentions data
                const cachedUser = this.getCachedUser(userId);
                mentions.users.push({ id: userId, username: cachedUser?.username || `User_${userId}` });
                addedUserIds.add(userId);
            }
        }
        // Parse <@&ID> format (role mentions) — keep content as-is
        const roleMentionRegex = /<@&(\d+)>/g;
        const addedRoleIds = new Set(mentions.roles?.map(r => r.id) || []);
        while ((match = roleMentionRegex.exec(contentStr)) !== null) {
            const roleId = match[1];
            if (!addedRoleIds.has(roleId)) {
                mentions.roles.push({ id: roleId });
                addedRoleIds.add(roleId);
            }
        }
        // Parse @everyone and @here
        if (contentStr.includes('@everyone')) {
            mentions.everyone = true;
        }
        // Clean up empty arrays
        if (mentions.users?.length === 0)
            delete mentions.users;
        if (mentions.roles?.length === 0)
            delete mentions.roles;
        return { content: contentStr, mentions };
    }
    /**
     * Prepare message data with processed mentions
     * Automatically converts mentions to our format
     */
    prepareMessageData(data) {
        const result = { ...data };
        // Resolve components (ActionRowBuilder / ButtonBuilder instances)
        if (data.components && data.components.length > 0) {
            result.components = (0, serialize_1.serializeComponents)(data.components);
        }
        let allMentions = { ...data.mentions };
        if ((0, serialize_1.hasComponentsV2)(result.components))
            result.flags = (data.flags ?? 0) | 32768;
        (0, serialize_1.visitComponentText)(result.components, content => { allMentions = this.processMentions(content, allMentions).mentions; });
        // Process mentions in content if present
        if (data.content) {
            const { content, mentions } = this.processMentions(data.content, allMentions);
            result.content = content;
            allMentions = mentions;
        }
        // Process mentions in embeds (description, title, footer, fields)
        if (data.embeds && data.embeds.length > 0) {
            result.embeds = data.embeds.map(embed => {
                // Normalize embed (handles EmbedBuilder, colors, timestamps, iconURL → icon_url, etc.)
                const processedEmbed = (0, serialize_1.normalizeEmbed)(embed);
                // Get the raw embed for mention processing
                const rawEmbed = typeof embed.toJSON === 'function'
                    ? embed.toJSON()
                    : embed;
                // Process description
                if (rawEmbed.description) {
                    const { content, mentions } = this.processMentions(rawEmbed.description, allMentions);
                    processedEmbed.description = content;
                    allMentions = mentions;
                }
                // Process title
                if (rawEmbed.title) {
                    const { content, mentions } = this.processMentions(rawEmbed.title, allMentions);
                    processedEmbed.title = content;
                    allMentions = mentions;
                }
                // Process footer text
                if (rawEmbed.footer?.text) {
                    const { content, mentions } = this.processMentions(rawEmbed.footer.text, allMentions);
                    processedEmbed.footer = { ...(processedEmbed.footer ?? {}), text: content };
                    allMentions = mentions;
                }
                // Process fields
                if (rawEmbed.fields && rawEmbed.fields.length > 0) {
                    processedEmbed.fields = rawEmbed.fields.map((field) => {
                        const processedField = { ...field };
                        if (field.value) {
                            const { content, mentions } = this.processMentions(field.value, allMentions);
                            processedField.value = content;
                            allMentions = mentions;
                        }
                        if (field.name) {
                            const { content, mentions } = this.processMentions(field.name, allMentions);
                            processedField.name = content;
                            allMentions = mentions;
                        }
                        return processedField;
                    });
                }
                return processedEmbed;
            });
        }
        // Add merged mentions to result
        if (allMentions.users?.length || allMentions.roles?.length || allMentions.everyone) {
            result.mentions = allMentions;
        }
        return result;
    }
    /**
     * Set the bot token
     */
    setToken(token) {
        this.token = token;
        return this;
    }
    /**
     * Make an authenticated request with rate limit retry
     */
    globalResetAt = 0;
    routeResetAt = new Map();
    async request(method, path, body) {
        return this.requestBody(method, path, body === undefined ? undefined : JSON.stringify(body), {
            'Content-Type': 'application/json'
        });
    }
    /** Shared transport; JSON and buffered multipart bodies are replayable on HTTP 429. */
    async requestBody(method, path, body, headers = {}) {
        const route = method + ' ' + path.replace(/\/\d+(?=\/|$)/g, '/:id');
        for (let attempt = 0;; attempt++) {
            let delay;
            while ((delay = Math.max(this.globalResetAt, this.routeResetAt.get(route) ?? 0) - Date.now()) > 0) {
                await new Promise(resolve => setTimeout(resolve, Math.min(delay, 2_147_483_647)));
            }
            this.routeResetAt.delete(route);
            if (process.env.DEBUG_REST)
                console.log('[REST]', method, path.replace(/(\/interactions\/(?:webhooks\/)?[^/]+\/)[^/]+/, '$1[REDACTED]'));
            const response = await fetch(this.baseUrl + path, {
                method,
                headers: { Authorization: 'Bot ' + this.token, 'User-Agent': 'JubbioBot/1.0 (+https://jubbio.com)', ...headers },
                body
            });
            if (response.status === 429) {
                const data = await response.json().catch(() => ({}));
                const header = response.headers.get('Retry-After');
                const seconds = data.retry_after ?? (header === null ? undefined : Number(header));
                const retryAfter = Math.max(10, Number.isFinite(seconds) && Number(seconds) >= 0
                    ? Math.ceil(Number(seconds) * 1000)
                    : header && Number.isFinite(Date.parse(header)) ? Math.max(0, Date.parse(header) - Date.now()) : 1000);
                const resetAt = Date.now() + retryAfter;
                if (data.global === true || response.headers.get('X-RateLimit-Global') === 'true') {
                    this.globalResetAt = Math.max(this.globalResetAt, resetAt);
                }
                else {
                    this.routeResetAt.set(route, Math.max(this.routeResetAt.get(route) ?? 0, resetAt));
                }
                if (attempt >= 3)
                    throw new errors_1.RateLimitError(retryAfter, method, path);
                continue;
            }
            if (!response.ok)
                throw new errors_1.RESTError(response.status, method, path, await response.text());
            const text = await response.text();
            return text ? JSON.parse(text) : {};
        }
    }
    // ==================== Messages ====================
    /**
     * Create a message in a channel
     * Mentions use <@ID> format and are kept as-is (client renders them)
     *
     * @example
     * await rest.createMessage(guildId, channelId, {
     *   content: 'Hello <@123>!',
     * });
     */
    async createMessage(guildIdOrChannelId, channelIdOrData, data) {
        // İki kullanım şekli:
        // 1. createMessage(guildId, channelId, data) - guildId ile (tercih edilen)
        // 2. createMessage(channelId, data) - guildId olmadan (eski format, hata verir)
        let guildId;
        let channelId;
        let messageData;
        if (typeof channelIdOrData === 'string' && data) {
            // Yeni format: createMessage(guildId, channelId, data)
            guildId = guildIdOrChannelId;
            channelId = channelIdOrData;
            // SECURITY: Validate IDs to prevent path traversal
            validateId(guildId, 'guildId');
            validateId(channelId, 'channelId');
            messageData = this.prepareMessageData(data);
            // Add interaction_id if provided
            if (data.interactionId) {
                messageData.interaction_id = data.interactionId;
            }
            // Bug #10 - Add flags if provided
            if (data.flags !== undefined) {
                messageData.flags = (messageData.flags ?? 0) | data.flags;
            }
        }
        else if (typeof channelIdOrData === 'object') {
            // Eski format: createMessage(channelId, data) - guildId yok
            // Bu format artık desteklenmiyor, hata fırlat
            throw new Error('createMessage requires guildId: createMessage(guildId, channelId, data)');
        }
        else {
            throw new Error('Invalid createMessage arguments');
        }
        return this.request('POST', `/bot/guilds/${guildId}/channels/${channelId}/messages`, messageData);
    }
    /**
     * Create an ephemeral message that is only visible to a specific user
     * Ephemeral messages are NOT saved to database - they are only sent via WebSocket
     *
     * @example
     * // Send a warning only visible to the user
     * await rest.createEphemeralMessage(guildId, channelId, targetUserId, {
     *   embeds: [warningEmbed]
     * });
     */
    async createEphemeralMessage(guildId, channelId, targetUserId, data) {
        // SECURITY: Validate IDs to prevent path traversal
        validateId(guildId, 'guildId');
        validateId(channelId, 'channelId');
        validateId(String(targetUserId), 'targetUserId');
        const messageData = this.prepareMessageData(data);
        return this.request('POST', `/bot/guilds/${guildId}/channels/${channelId}/messages`, {
            ...messageData,
            flags: 64, // EPHEMERAL flag
            target_user_id: typeof targetUserId === 'string' ? parseInt(targetUserId, 10) : targetUserId
        });
    }
    /**
     * Create a DM message to a user
     * Automatically processes embeds (converts EmbedBuilder to JSON, normalizes colors, timestamps, etc.)
     *
     * @param userId - The user ID to send the DM to
     * @param data - Message data (content and/or embeds and/or components)
     */
    async createDMMessage(userId, data) {
        const processedData = this.prepareMessageData(data);
        // Send to /bot/dm with recipient_user_id in body
        return this.request('POST', `/bot/dm`, {
            ...processedData,
            recipient_user_id: userId
        });
    }
    /**
     * Create a DM message to an existing DM channel
     * Use this when you already have a channel ID
     */
    async createDMMessageToChannel(channelId, data) {
        const processedData = this.prepareMessageData(data);
        return this.request('POST', `/bot/dm/${channelId}`, processedData);
    }
    /**
     * Create a DM message with file attachment
     * DM için file + embed desteği
     */
    async createDMMessageWithFile(userId, data, files) {
        return this.sendDMFiles('/bot/dm', data, files, userId);
    }
    /** Send attachments to an existing DM channel without requiring a recipient ID. */
    async createDMMessageToChannelWithFile(channelId, data, files) {
        validateId(channelId, 'channelId');
        return this.sendDMFiles('/bot/dm/' + channelId, data, files);
    }
    async sendDMFiles(path, data, files, userId) {
        const FormData = require('form-data');
        const form = new FormData();
        data = { ...data, ...this.prepareMessageData(data) };
        if (data.flags !== undefined)
            form.append('flags', String(data.flags));
        // Add recipient_user_id
        if (userId !== undefined)
            form.append('recipient_user_id', userId);
        // Add content if provided
        if (data.content) {
            form.append('content', data.content);
        }
        // Add embeds if provided (JSON stringified)
        if (data.embeds && data.embeds.length > 0) {
            const processedEmbeds = data.embeds.map(embed => (0, serialize_1.normalizeEmbed)(embed));
            form.append('embeds', JSON.stringify(processedEmbeds));
        }
        // Add components if provided (JSON stringified)
        if (data.components && data.components.length > 0) {
            const processedComponents = (0, serialize_1.serializeComponents)(data.components);
            form.append('components', JSON.stringify(processedComponents));
        }
        // Add files
        for (const file of files) {
            const fileData = typeof file.data === 'string' ? Buffer.from(file.data) : file.data;
            form.append('files', fileData, {
                filename: file.name,
                contentType: file.contentType || 'application/octet-stream'
            });
        }
        return this.requestBody('POST', path, form.getBuffer(), form.getHeaders());
    }
    /**
     * Edit a message
     * Automatically processes mentions
     */
    async editMessage(guildId, channelId, messageId, data) {
        // SECURITY: Validate IDs to prevent path traversal
        validateId(guildId, 'guildId');
        validateId(channelId, 'channelId');
        validateId(messageId, 'messageId');
        const path = `/bot/guilds/${guildId}/channels/${channelId}/messages/${messageId}`;
        const processedData = this.prepareMessageData(data);
        return this.request('PATCH', path, processedData);
    }
    /**
     * Delete a message
     */
    async deleteMessage(guildId, channelId, messageId) {
        // SECURITY: Validate IDs to prevent path traversal
        validateId(guildId, 'guildId');
        validateId(channelId, 'channelId');
        validateId(messageId, 'messageId');
        const path = `/bot/guilds/${guildId}/channels/${channelId}/messages/${messageId}`;
        await this.request('DELETE', path);
    }
    /**
     * Validate and normalize emoji format for the API.
     * Converts unicode emoji to shortcode format.
     * Accepted formats:
     * - Unicode emoji characters (👍, ❤️, etc.) → converted to :shortcode:
     * - :name: format (shortcode)
     * - <:name:id> or <a:name:id> for custom emoji
     */
    validateEmoji(emoji) {
        // Import lazily to avoid circular dependencies
        const { normalizeEmoji } = require('../utils/emojiUtils');
        return normalizeEmoji(emoji);
    }
    /**
     * Add a reaction to a message
     * @param emoji - Unicode emoji (👍), :name:, <:name:id>, or <a:name:id> format
     *
     * @example
     * // Unicode emoji (automatically converted to shortcode)
     * await rest.addReaction(guildId, channelId, messageId, '👍');
     *
     * // Shortcode format
     * await rest.addReaction(guildId, channelId, messageId, ':thumbsup:');
     *
     * // Custom emoji
     * await rest.addReaction(guildId, channelId, messageId, '<:custom:123456>');
     */
    async addReaction(guildId, channelId, messageId, emoji) {
        // SECURITY: Validate IDs to prevent path traversal
        validateId(guildId, 'guildId');
        validateId(channelId, 'channelId');
        validateId(messageId, 'messageId');
        const validated = this.validateEmoji(emoji);
        const path = `/bot/guilds/${guildId}/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(validated)}/@me`;
        await this.request('PUT', path);
    }
    /**
     * Remove a reaction from a message
     * @param emoji - Unicode emoji (👍), :name:, <:name:id>, or <a:name:id> format
     */
    async removeReaction(guildId, channelId, messageId, emoji) {
        // SECURITY: Validate IDs to prevent path traversal
        validateId(guildId, 'guildId');
        validateId(channelId, 'channelId');
        validateId(messageId, 'messageId');
        const validated = this.validateEmoji(emoji);
        const path = `/bot/guilds/${guildId}/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(validated)}/@me`;
        await this.request('DELETE', path);
    }
    /**
     * Upload an attachment to a channel
     */
    async uploadAttachment(guildId, channelId, file) {
        const FormData = require('form-data');
        const form = new FormData();
        // form-data expects the buffer directly with options
        form.append('file', file.data, {
            filename: file.name,
            contentType: file.contentType || 'text/plain'
        });
        return this.requestBody('POST', `/bot/guilds/${guildId}/channels/${channelId}/attachments`, form.getBuffer(), form.getHeaders());
    }
    /**
     * Create a message with a file attachment
     * embeds ve components desteği eklendi
     */
    async createMessageWithFile(guildId, channelId, data) {
        const FormData = require('form-data');
        const form = new FormData();
        data = { ...data, ...this.prepareMessageData(data) };
        if (data.flags !== undefined)
            form.append('flags', String(data.flags));
        // Add content if provided
        if (data.content) {
            form.append('content', data.content);
        }
        // Add embeds if provided (JSON stringified)
        if (data.embeds && data.embeds.length > 0) {
            // Process embeds using shared normalizeEmbed
            const processedEmbeds = data.embeds.map(embed => (0, serialize_1.normalizeEmbed)(embed));
            if (process.env.DEBUG_REST) {
                console.log(`[REST] createMessageWithFile: appending ${processedEmbeds.length} embeds`);
            }
            form.append('embeds', JSON.stringify(processedEmbeds));
        }
        else {
            if (process.env.DEBUG_REST) {
                console.log(`[REST] createMessageWithFile: no embeds provided (embeds=${data.embeds})`);
            }
        }
        // Add components if provided (JSON stringified)
        if (data.components && data.components.length > 0) {
            const processedComponents = (0, serialize_1.serializeComponents)(data.components);
            form.append('components', JSON.stringify(processedComponents));
        }
        // Add interaction_id if provided (for deferred response matching)
        if (data.interactionId) {
            form.append('interaction_id', data.interactionId);
        }
        // Add file
        form.append('files', data.file.data, {
            filename: data.file.name,
            contentType: data.file.contentType || 'text/plain'
        });
        return this.requestBody('POST', `/bot/guilds/${guildId}/channels/${channelId}/messages`, form.getBuffer(), form.getHeaders());
    }
    // ==================== Interactions ====================
    /**
     * Create an interaction response
     * Automatically processes mentions in content and embeds
     */
    async createInteractionResponse(interactionId, token, data) {
        if (process.env.DEBUG_REST) {
            console.log(`📤 Interaction response: ${interactionId} -> type ${data.type}`);
        }
        try {
            // Process mentions in response data if present
            let processedData = data;
            if (data.data && (data.data.content !== undefined || data.data.embeds || data.data.components)) {
                processedData = {
                    ...data,
                    data: this.prepareMessageData(data.data)
                };
            }
            await this.request('POST', `/interactions/${interactionId}/${token}/callback`, processedData);
            if (process.env.DEBUG_REST) {
                console.log(`✅ Interaction response sent`);
            }
        }
        catch (error) {
            if (process.env.DEBUG_REST)
                console.error('Interaction response failed');
            throw error;
        }
    }
    /**
     * Edit the original interaction response
     * If files are provided, creates a new message with files (since webhook edit doesn't support file upload)
     * Automatically processes mentions
     */
    async editInteractionResponse(token, data, guildId, channelId, interactionId) {
        const appId = this.getApplicationId();
        // Process mentions in content
        const processedData = this.prepareMessageData(data);
        // If files are present and we have guild/channel info, create message with file instead
        if (data.files && data.files.length > 0 && guildId && channelId) {
            if (process.env.DEBUG_REST) {
                console.log(`[REST] editInteractionResponse with ${data.files.length} files - using createMessageWithFile`);
            }
            // Create message with file - embeds ve components da geçiriliyor
            const file = data.files[0]; // For now, support single file
            await this.createMessageWithFile(guildId, channelId, {
                content: processedData.content,
                embeds: processedData.embeds,
                components: processedData.components,
                file: file,
                interactionId: interactionId
            });
            return;
        }
        // If we have guildId, channelId and interactionId, create a new message with interaction_id
        // This is needed because our deferred response doesn't create a message
        if (guildId && channelId && interactionId) {
            if (process.env.DEBUG_REST) {
                console.log(`[REST] editInteractionResponse - creating message with interaction_id: ${interactionId}`);
            }
            const payload = {
                interaction_id: interactionId
            };
            if (processedData.flags !== undefined)
                payload.flags = processedData.flags;
            if (processedData.content !== undefined)
                payload.content = processedData.content;
            if (processedData.embeds)
                payload.embeds = processedData.embeds;
            if (processedData.components)
                payload.components = processedData.components;
            if (processedData.mentions)
                payload.mentions = processedData.mentions;
            await this.request('POST', `/bot/guilds/${guildId}/channels/${channelId}/messages`, payload);
            return;
        }
        // Fallback: Regular edit without files (webhook PATCH)
        const payload = {};
        if (processedData.flags !== undefined)
            payload.flags = processedData.flags;
        if (processedData.content !== undefined)
            payload.content = processedData.content;
        if (processedData.embeds)
            payload.embeds = processedData.embeds;
        if (processedData.components)
            payload.components = processedData.components;
        if (processedData.mentions)
            payload.mentions = processedData.mentions;
        await this.request('PATCH', `/interactions/webhooks/${appId}/${token}/messages/@original`, payload);
    }
    /**
     * Delete the original interaction response
     */
    async deleteInteractionResponse(token) {
        const appId = this.getApplicationId();
        await this.request('DELETE', `/interactions/webhooks/${appId}/${token}/messages/@original`);
    }
    /**
     * Create a followup message
     * Automatically processes mentions
     * Supports file attachments via multipart/form-data
     */
    async createFollowup(token, data) {
        const appId = this.getApplicationId();
        const endpoint = `/interactions/webhooks/${appId}/${token}`;
        // If files provided, use multipart/form-data
        if (data.files && data.files.length > 0) {
            const FormData = require('form-data');
            const form = new FormData();
            data = { ...data, ...this.prepareMessageData(data) };
            // Add content
            if (data.content) {
                form.append('content', data.content);
            }
            // Add embeds (processed using shared normalizeEmbed)
            if (data.embeds && data.embeds.length > 0) {
                const processedEmbeds = data.embeds.map(embed => (0, serialize_1.normalizeEmbed)(embed));
                form.append('embeds', JSON.stringify(processedEmbeds));
            }
            // Add components using shared serializeComponents
            if (data.components && data.components.length > 0) {
                const processedComponents = (0, serialize_1.serializeComponents)(data.components);
                form.append('components', JSON.stringify(processedComponents));
            }
            // Add flags
            if (data.flags) {
                form.append('flags', String(data.flags));
            }
            // Add files
            data.files.forEach((file, index) => {
                form.append(`files[${index}]`, file.data, {
                    filename: file.name,
                    contentType: file.contentType || 'application/octet-stream'
                });
            });
            await this.requestBody('POST', endpoint, form.getBuffer(), form.getHeaders());
        }
        else {
            // No files, use JSON
            const processedData = this.prepareMessageData(data);
            await this.request('POST', endpoint, processedData);
        }
    }
    // ==================== Commands ====================
    /**
     * Register global application commands
     */
    async registerGlobalCommands(commands) {
        const appId = this.getApplicationId();
        for (const command of commands) {
            await this.request('POST', `/applications/${appId}/commands`, command);
        }
    }
    /**
     * Bulk overwrite all global application commands (replaces all existing)
     */
    async bulkOverwriteGlobalCommands(commands) {
        const appId = this.getApplicationId();
        return this.request('PUT', `/applications/${appId}/commands`, commands);
    }
    /**
     * Register guild-specific commands
     */
    async registerGuildCommands(guildId, commands) {
        const appId = this.getApplicationId();
        for (const command of commands) {
            await this.request('POST', `/applications/${appId}/guilds/${guildId}/commands`, command);
        }
    }
    /**
     * Bulk overwrite all guild-specific commands (replaces all existing)
     */
    async bulkOverwriteGuildCommands(guildId, commands) {
        const appId = this.getApplicationId();
        return this.request('PUT', `/applications/${appId}/guilds/${guildId}/commands`, commands);
    }
    /**
     * Delete a global command
     */
    async deleteGlobalCommand(commandId) {
        const appId = this.getApplicationId();
        await this.request('DELETE', `/applications/${appId}/commands/${commandId}`);
    }
    /**
     * Delete a guild-specific command
     */
    async deleteGuildCommand(guildId, commandId) {
        const appId = this.getApplicationId();
        await this.request('DELETE', `/applications/${appId}/guilds/${guildId}/commands/${commandId}`);
    }
    /**
     * List all global commands for this application
     */
    async listGlobalCommands() {
        const appId = this.getApplicationId();
        return this.request('GET', `/applications/${appId}/commands`);
    }
    /**
     * List all guild-specific commands for this application
     */
    async listGuildCommands(guildId) {
        const appId = this.getApplicationId();
        return this.request('GET', `/applications/${appId}/guilds/${guildId}/commands`);
    }
    /**
     * Get a specific global command
     */
    async getGlobalCommand(commandId) {
        const appId = this.getApplicationId();
        return this.request('GET', `/applications/${appId}/commands/${commandId}`);
    }
    /**
     * Get a specific guild command
     */
    async getGuildCommand(guildId, commandId) {
        const appId = this.getApplicationId();
        return this.request('GET', `/applications/${appId}/guilds/${guildId}/commands/${commandId}`);
    }
    /**
     * Update a global command
     */
    async updateGlobalCommand(commandId, data) {
        const appId = this.getApplicationId();
        return this.request('PATCH', `/applications/${appId}/commands/${commandId}`, data);
    }
    /**
     * Update a guild-specific command
     */
    async updateGuildCommand(guildId, commandId, data) {
        const appId = this.getApplicationId();
        return this.request('PATCH', `/applications/${appId}/guilds/${guildId}/commands/${commandId}`, data);
    }
    // ==================== Helpers ====================
    applicationId = '';
    /**
     * Set the application ID
     */
    setApplicationId(id) {
        this.applicationId = id;
    }
    /**
     * Get the application ID
     */
    getApplicationId() {
        if (!this.applicationId) {
            throw new Error('Application ID not set. Call setApplicationId() first.');
        }
        return this.applicationId;
    }
    // ==================== Channels ====================
    /**
     * Create a channel in a guild.
     *
     * @param guildId - The ID of the guild
     * @param data - Channel creation options
     * @param data.name - Channel name (1-100 characters)
     * @param data.type - Channel type (0 = text, 2 = voice, 4 = category, 13 = stage)
     * @param data.parent_id - Category ID to place the channel under (alias for category_id)
     * @param data.category_id - Category ID to place the channel under
     * @param data.permission_overwrites - Array of permission overwrites for the channel
     * @returns The created channel object
     * @throws {RESTError} If the bot lacks MANAGE_CHANNELS permission
     *
     * @example
     * ```ts
     * // Create a text channel in a category
     * const channel = await rest.createChannel('123456789', {
     *   name: 'general-chat',
     *   type: 0,
     *   category_id: '987654321'
     * });
     * ```
     */
    async createChannel(guildId, data) {
        // Map parent_id to category_id for backend compatibility
        const requestData = {
            name: data.name,
            type: data.type ?? 0, // Default to text channel
        };
        // Backend expects category_id, not parent_id
        if (data.category_id) {
            requestData.category_id = data.category_id;
        }
        else if (data.parent_id) {
            requestData.category_id = data.parent_id;
        }
        // Add permission_overwrites if provided
        if (data.permission_overwrites && data.permission_overwrites.length > 0) {
            requestData.permission_overwrites = data.permission_overwrites;
        }
        return this.request('POST', `/bot/guilds/${guildId}/channels`, requestData);
    }
    /**
     * Delete a channel from a guild.
     * This action is irreversible. All messages in the channel will be lost.
     *
     * @param guildId - The ID of the guild
     * @param channelId - The ID of the channel to delete
     * @returns void
     * @throws {RESTError} If the bot lacks MANAGE_CHANNELS permission
     *
     * @example
     * ```ts
     * await rest.deleteChannel('123456789', '987654321');
     * ```
     */
    async deleteChannel(guildId, channelId) {
        await this.request('DELETE', `/bot/guilds/${guildId}/channels/${channelId}`);
    }
    /**
     * Edit a channel's settings.
     *
     * @param guildId - The ID of the guild
     * @param channelId - The ID of the channel to edit
     * @param data - The channel data to update
     * @returns The updated channel
     * @throws {RESTError} If the bot lacks MANAGE_CHANNELS permission
     *
     * @example
     * ```ts
     * await rest.editChannel('123', '456', {
     *   name: 'new-name',
     *   topic: 'New topic',
     *   slowmode_seconds: 5
     * });
     * ```
     */
    async editChannel(guildId, channelId, data) {
        return this.request('PATCH', `/bot/guilds/${guildId}/channels/${channelId}`, data);
    }
    /**
     * Delete a category and optionally its child channels.
     *
     * @param guildId - The ID of the guild
     * @param categoryId - The ID of the category to delete
     * @returns void
     * @throws {RESTError} If the bot lacks MANAGE_CHANNELS permission
     *
     * @example
     * ```ts
     * await rest.deleteCategory('123456789', '987654321');
     * ```
     */
    async deleteCategory(guildId, categoryId) {
        await this.request('DELETE', `/bot/guilds/${guildId}/categories/${categoryId}`);
    }
    /**
     * Edit channel permission overwrites for a role or member.
     *
     * @param channelId - The ID of the channel
     * @param overwriteId - The ID of the role or member
     * @param data - Permission overwrite data
     * @param data.type - 0 for role, 1 for member
     * @param data.allow - Bitfield of allowed permissions
     * @param data.deny - Bitfield of denied permissions
     * @returns void
     * @throws {RESTError} If the bot lacks MANAGE_ROLES permission
     *
     * @example
     * ```ts
     * // Allow a role to send messages but deny file uploads
     * await rest.editChannelPermissions('456', 'roleId', {
     *   type: 0,
     *   allow: '2048',  // SEND_MESSAGES
     *   deny: '32768'   // ATTACH_FILES
     * });
     * ```
     */
    async editChannelPermissions(channelId, overwriteId, data) {
        await this.request('PUT', `/bot/channels/${channelId}/permissions/${overwriteId}`, data);
    }
    /**
     * Delete a channel permission overwrite.
     *
     * @param channelId - The ID of the channel
     * @param overwriteId - The ID of the role or member overwrite to delete
     * @returns void
     * @throws {RESTError} If the bot lacks MANAGE_ROLES permission
     *
     * @example
     * ```ts
     * await rest.deleteChannelPermission('456', 'roleId');
     * ```
     */
    async deleteChannelPermission(channelId, overwriteId) {
        await this.request('DELETE', `/bot/channels/${channelId}/permissions/${overwriteId}`);
    }
    /**
     * Get messages from a channel with optional pagination.
     *
     * @param guildId - The ID of the guild
     * @param channelId - The ID of the channel
     * @param options - Pagination options
     * @param options.limit - Maximum number of messages to return (1-100, default: 50)
     * @param options.before - Get messages before this message ID
     * @param options.after - Get messages after this message ID
     * @returns Array of messages, newest first when using `before`
     * @throws {RESTError} If the bot lacks READ_MESSAGE_HISTORY permission
     *
     * @example
     * ```ts
     * // Get last 50 messages
     * const messages = await rest.getMessages('123', '456', { limit: 50 });
     *
     * // Get messages before a specific message (for pagination)
     * const older = await rest.getMessages('123', '456', {
     *   limit: 50,
     *   before: messages[messages.length - 1].id
     * });
     * ```
     */
    async getMessages(guildId, channelId, options) {
        const params = new URLSearchParams();
        if (options?.limit)
            params.append('limit', String(options.limit));
        if (options?.before)
            params.append('before', options.before);
        if (options?.after)
            params.append('after', options.after);
        const query = params.toString() ? `?${params.toString()}` : '';
        const response = await this.request('GET', `/bot/guilds/${guildId}/channels/${channelId}/messages${query}`);
        return response.messages || [];
    }
    /**
     * Async generator that yields batches of messages, automatically handling pagination.
     * Messages are fetched in reverse chronological order (newest to oldest).
     *
     * @param guildId - The ID of the guild
     * @param channelId - The ID of the channel
     * @param options - Iterator options
     * @param options.limit - Total maximum number of messages to fetch (default: unlimited)
     * @param options.batchSize - Number of messages per API request (1-100, default: 100)
     * @yields Arrays of messages (batches)
     * @throws {RESTError} If the bot lacks READ_MESSAGE_HISTORY permission
     *
     * @example
     * ```ts
     * // Iterate through all messages in a channel
     * for await (const batch of rest.getMessagesIterator('123', '456')) {
     *   for (const message of batch) {
     *     console.log(message.content);
     *   }
     * }
     *
     * // Get up to 500 messages
     * for await (const batch of rest.getMessagesIterator('123', '456', { limit: 500 })) {
     *   processBatch(batch);
     * }
     * ```
     */
    async *getMessagesIterator(guildId, channelId, options) {
        const batchSize = Math.min(options?.batchSize ?? 100, 100);
        const maxMessages = options?.limit;
        let fetched = 0;
        let before;
        while (true) {
            // Calculate how many to fetch in this batch
            const toFetch = maxMessages !== undefined
                ? Math.min(batchSize, maxMessages - fetched)
                : batchSize;
            if (toFetch <= 0)
                break;
            const messages = await this.getMessages(guildId, channelId, {
                limit: toFetch,
                before
            });
            if (messages.length === 0)
                break;
            yield messages;
            fetched += messages.length;
            // Use the oldest message ID as the 'before' cursor for next batch
            before = messages[messages.length - 1].id;
            // Stop if we got fewer than requested (no more messages)
            if (messages.length < toFetch)
                break;
            // Stop if we've reached the limit
            if (maxMessages !== undefined && fetched >= maxMessages)
                break;
        }
    }
    // ==================== Members ====================
    /**
     * Get a guild member by their user ID.
     *
     * @param guildId - The ID of the guild
     * @param userId - The ID of the user to fetch
     * @returns The member data including roles, nickname, and join date
     * @throws {RESTError} If the member is not found (404) or the bot lacks permissions
     *
     * @example
     * ```ts
     * const member = await rest.getMember('123456789', '987654321');
     * console.log(`${member.user.username} joined at ${member.joined_at}`);
     * ```
     */
    async getMember(guildId, userId) {
        // SECURITY: Validate IDs to prevent path traversal
        validateId(guildId, 'guildId');
        validateId(userId, 'userId');
        return this.request('GET', `/bot/guilds/${guildId}/members/${userId}`);
    }
    /**
     * Get a paginated list of guild members.
     * Uses cursor-based pagination for efficient traversal of large member lists.
     *
     * @param guildId - The ID of the guild
     * @param options - Pagination options
     * @param options.limit - Maximum number of members to return (default: 100, max: 1000)
     * @param options.cursor - Cursor for pagination (from previous response's next_cursor)
     * @returns Paginated response with members array and cursor info
     *
     * @example
     * ```ts
     * // Get first page
     * const page1 = await rest.getMembers('123456789', { limit: 50 });
     *
     * // Get next page using cursor
     * if (page1.next_cursor) {
     *   const page2 = await rest.getMembers('123456789', { cursor: page1.next_cursor });
     * }
     * ```
     */
    async getMembers(guildId, options) {
        const params = new URLSearchParams();
        params.set('flat', 'true'); // Bot API always uses flat response (no presence grouping)
        if (options?.limit)
            params.set('limit', String(options.limit));
        if (options?.cursor)
            params.set('cursor', options.cursor);
        return this.request('GET', `/bot/guilds/${guildId}/members?${params.toString()}`);
    }
    /**
     * Async generator that yields batches of guild members, automatically handling cursor-based pagination.
     *
     * @param guildId - The ID of the guild
     * @param options - Iterator options
     * @param options.limit - Total maximum number of members to fetch (default: unlimited)
     * @param options.batchSize - Number of members per API request (default: 100, max: 1000)
     * @yields Arrays of member data (batches)
     * @throws {RESTError} If the bot lacks permissions
     *
     * @example
     * ```ts
     * // Iterate through all members in a guild
     * for await (const batch of rest.getMembersIterator('123456789')) {
     *   for (const member of batch) {
     *     console.log(member.user?.username);
     *   }
     * }
     *
     * // Get up to 500 members
     * for await (const batch of rest.getMembersIterator('123456789', { limit: 500 })) {
     *   processBatch(batch);
     * }
     * ```
     */
    async *getMembersIterator(guildId, options) {
        const batchSize = Math.min(options?.batchSize ?? 100, 1000);
        const maxMembers = options?.limit;
        let fetched = 0;
        let cursor;
        while (true) {
            // Calculate how many to fetch in this batch
            const toFetch = maxMembers !== undefined
                ? Math.min(batchSize, maxMembers - fetched)
                : batchSize;
            if (toFetch <= 0)
                break;
            const response = await this.getMembers(guildId, {
                limit: toFetch,
                cursor
            });
            const members = response.members || [];
            if (members.length === 0)
                break;
            yield members;
            fetched += members.length;
            // Use the cursor from page_info for next batch
            cursor = response.page_info?.cursor;
            // Stop if no more pages
            if (!response.page_info?.has_more)
                break;
            // Stop if we've reached the limit
            if (maxMembers !== undefined && fetched >= maxMembers)
                break;
        }
    }
    /**
     * Timeout (mute) a guild member for a specified duration.
     * Pass null for duration to clear an existing timeout.
     *
     * @param guildId - The ID of the guild
     * @param userId - The ID of the member to timeout
     * @param duration - Timeout duration in milliseconds, or null to clear
     * @param reason - Optional audit log reason
     * @returns void
     * @throws {RESTError} If the bot lacks MODERATE_MEMBERS permission
     *
     * @example
     * ```ts
     * // Timeout for 5 minutes
     * await rest.timeoutMember('123', '456', 5 * 60 * 1000, 'Spamming');
     *
     * // Clear timeout
     * await rest.timeoutMember('123', '456', null, 'Appealed');
     * ```
     */
    async timeoutMember(guildId, userId, duration, reason) {
        if (duration === null) {
            // Clear timeout
            await this.request('POST', `/bot/guilds/${guildId}/members/${userId}/timeout/clear`, {
                reason
            });
        }
        else {
            // Set timeout
            const until = new Date(Date.now() + duration).toISOString();
            await this.request('POST', `/bot/guilds/${guildId}/members/${userId}/timeout`, {
                until,
                reason
            });
        }
    }
    /**
     * Kick a member from the guild.
     * The member can rejoin if they have an invite.
     *
     * @param guildId - The ID of the guild
     * @param userId - The ID of the member to kick
     * @param reason - Optional audit log reason
     * @returns void
     * @throws {RESTError} If the bot lacks KICK_MEMBERS permission or cannot kick the target
     *
     * @example
     * ```ts
     * await rest.kickMember('123456789', '987654321', 'Rule violation');
     * ```
     */
    async kickMember(guildId, userId, reason) {
        // SECURITY: Validate IDs to prevent path traversal
        validateId(guildId, 'guildId');
        validateId(userId, 'userId');
        const query = reason ? `?reason=${encodeURIComponent(reason)}` : '';
        await this.request('DELETE', `/bot/guilds/${guildId}/members/${userId}${query}`);
    }
    /**
     * Ban a user from the guild.
     * Banned users cannot rejoin until unbanned.
     *
     * @param guildId - The ID of the guild
     * @param userId - The ID of the user to ban
     * @param options - Ban options
     * @param options.deleteMessageDays - Number of days of messages to delete (0-7, deprecated)
     * @param options.deleteMessageSeconds - Seconds of messages to delete (0-604800)
     * @param options.reason - Audit log reason
     * @returns void
     * @throws {RESTError} If the bot lacks BAN_MEMBERS permission or cannot ban the target
     *
     * @example
     * ```ts
     * // Ban and delete last 24 hours of messages
     * await rest.banMember('123', '456', {
     *   deleteMessageSeconds: 86400,
     *   reason: 'Harassment'
     * });
     * ```
     */
    async banMember(guildId, userId, options) {
        // SECURITY: Validate IDs to prevent path traversal
        validateId(guildId, 'guildId');
        validateId(userId, 'userId');
        await this.request('PUT', `/bot/guilds/${guildId}/bans/${userId}`, {
            delete_message_days: options?.deleteMessageDays,
            delete_message_seconds: options?.deleteMessageSeconds,
            reason: options?.reason
        });
    }
    /**
     * Remove a ban from a user, allowing them to rejoin.
     *
     * @param guildId - The ID of the guild
     * @param userId - The ID of the user to unban
     * @param reason - Optional audit log reason
     * @returns void
     * @throws {RESTError} If the bot lacks BAN_MEMBERS permission or user is not banned
     *
     * @example
     * ```ts
     * await rest.unbanMember('123456789', '987654321', 'Ban appeal accepted');
     * ```
     */
    async unbanMember(guildId, userId, reason) {
        const query = reason ? `?reason=${encodeURIComponent(reason)}` : '';
        await this.request('DELETE', `/bot/guilds/${guildId}/bans/${userId}${query}`);
    }
    /**
     * Edit a guild member's attributes (nickname, roles, voice state, etc.).
     *
     * @param guildId - The ID of the guild
     * @param userId - The ID of the member to edit
     * @param data - The member attributes to modify
     * @param data.nick - New nickname (null to reset)
     * @param data.roles - Array of role IDs to set (replaces all roles)
     * @param data.mute - Whether to server-mute the member in voice
     * @param data.deaf - Whether to server-deafen the member in voice
     * @param data.channel_id - Voice channel to move member to (null to disconnect)
     * @param data.communication_disabled_until - ISO8601 timestamp for timeout end
     * @param data.reason - Audit log reason
     * @returns The updated member data
     * @throws {RESTError} If the bot lacks required permissions
     *
     * @example
     * ```ts
     * // Change nickname and add a role
     * const updated = await rest.editMember('123', '456', {
     *   nick: 'New Nickname',
     *   roles: ['role1', 'role2', 'newRole'],
     *   reason: 'Nickname update request'
     * });
     * ```
     */
    async editMember(guildId, userId, data) {
        return this.request('PATCH', `/bot/guilds/${guildId}/members/${userId}`, data);
    }
    // ==================== Guilds ====================
    /**
     * Get guild info with fresh data (not cached).
     * Returns member_count and online_count from live Redis data.
     *
     * @param guildId - The ID of the guild to fetch
     * @returns Full guild data including channels, roles, and member counts
     * @throws {RESTError} If the guild is not found or bot is not a member
     *
     * @example
     * ```ts
     * const guild = await rest.getGuild('123456789');
     * console.log(`${guild.name} has ${guild.member_count} members`);
     * ```
     */
    async getGuild(guildId) {
        // SECURITY: Validate ID to prevent path traversal
        validateId(guildId, 'guildId');
        return this.request('GET', `/bot/guilds/${guildId}`);
    }
    /**
     * Add a role to a guild member.
     *
     * @param guildId - The ID of the guild
     * @param userId - The ID of the member
     * @param roleId - The ID of the role to add
     * @param reason - Optional audit log reason
     * @returns void
     * @throws {RESTError} If the bot lacks MANAGE_ROLES permission or role is higher than bot's highest role
     *
     * @example
     * ```ts
     * await rest.addMemberRole('123', '456', '789', 'Verified user');
     * ```
     */
    async addMemberRole(guildId, userId, roleId, reason) {
        const query = reason ? `?reason=${encodeURIComponent(reason)}` : '';
        await this.request('PUT', `/bot/guilds/${guildId}/members/${userId}/roles/${roleId}${query}`);
    }
    /**
     * Remove a role from a guild member.
     *
     * @param guildId - The ID of the guild
     * @param userId - The ID of the member
     * @param roleId - The ID of the role to remove
     * @param reason - Optional audit log reason
     * @returns void
     * @throws {RESTError} If the bot lacks MANAGE_ROLES permission or role is higher than bot's highest role
     *
     * @example
     * ```ts
     * await rest.removeMemberRole('123', '456', '789', 'Role expired');
     * ```
     */
    async removeMemberRole(guildId, userId, roleId, reason) {
        const query = reason ? `?reason=${encodeURIComponent(reason)}` : '';
        await this.request('DELETE', `/bot/guilds/${guildId}/members/${userId}/roles/${roleId}${query}`);
    }
    /**
     * Bulk assign roles to multiple members in a single request.
     * More efficient than individual addMemberRole calls.
     *
     * @param guildId - The ID of the guild
     * @param assignments - Array of user/roles assignments
     * @returns API response with assignment results
     * @throws {RESTError} If the bot lacks MANAGE_ROLES permission
     *
     * @example
     * ```ts
     * await rest.bulkAssignRoles('123456789', [
     *   { user_id: '111', role_ids: ['role1', 'role2'] },
     *   { user_id: '222', role_ids: ['role1'] }
     * ]);
     * ```
     */
    async bulkAssignRoles(guildId, assignments) {
        return this.request('PUT', `/bot/guilds/${guildId}/members/roles/assign`, { assignments });
    }
    /**
     * Bulk remove roles from multiple members in a single request.
     * More efficient than individual removeMemberRole calls.
     *
     * @param guildId - The ID of the guild
     * @param removals - Array of user/roles to remove
     * @returns API response with removal results
     * @throws {RESTError} If the bot lacks MANAGE_ROLES permission
     *
     * @example
     * ```ts
     * await rest.bulkRemoveRoles('123456789', [
     *   { user_id: '111', role_ids: ['expiredRole'] },
     *   { user_id: '222', role_ids: ['expiredRole'] }
     * ]);
     * ```
     */
    async bulkRemoveRoles(guildId, removals) {
        return this.request('DELETE', `/bot/guilds/${guildId}/members/roles/remove`, { removals });
    }
    /**
     * Bulk delete multiple messages from a channel.
     * More efficient than individual deleteMessage calls.
     * Messages older than 14 days cannot be bulk deleted.
     *
     * @param guildId - The ID of the guild
     * @param channelId - The ID of the channel
     * @param messageIds - Array of message IDs to delete (2-100 messages)
     * @returns void
     * @throws {RESTError} If the bot lacks MANAGE_MESSAGES permission
     *
     * @example
     * ```ts
     * await rest.bulkDeleteMessages('123', '456', ['msg1', 'msg2', 'msg3']);
     * ```
     */
    async bulkDeleteMessages(guildId, channelId, messageIds) {
        await this.request('POST', `/bot/guilds/${guildId}/channels/${channelId}/messages/bulk-delete`, {
            messages: messageIds
        });
    }
    // ==================== Guilds ====================
    /**
     * Get a guild
     */
    async getGuildChannels(guildId) {
        return this.request('GET', `/bot/guilds/${guildId}/channels`);
    }
    /**
     * Get guild roles
     */
    async getRoles(guildId) {
        return this.request('GET', `/bot/guilds/${guildId}/roles`);
    }
    /**
     * Create a role
     */
    async createRole(guildId, data) {
        return this.request('POST', `/bot/guilds/${guildId}/roles`, data);
    }
    /**
     * Edit a role
     */
    async editRole(guildId, roleId, data) {
        return this.request('PATCH', `/bot/guilds/${guildId}/roles/${roleId}`, data);
    }
    /**
     * Delete a role
     */
    async deleteRole(guildId, roleId) {
        await this.request('DELETE', `/bot/guilds/${guildId}/roles/${roleId}`);
    }
    /**
     * Get guild emojis
     *
     * @param guildId - The ID of the guild
     * @returns Array of emoji objects
     */
    async getEmojis(guildId) {
        return this.request('GET', `/bot/guilds/${guildId}/emojis`);
    }
    /**
     * Get all bans for a guild.
     *
     * @param guildId - The ID of the guild
     * @returns Array of ban objects containing user info and ban reason
     * @throws {RESTError} If the bot lacks BAN_MEMBERS permission
     *
     * @example
     * ```ts
     * const bans = await rest.getBans('123456789');
     * for (const ban of bans) {
     *   console.log(`${ban.user.username} banned for: ${ban.reason || 'No reason'}`);
     * }
     * ```
     */
    async getBans(guildId) {
        return this.request('GET', `/bot/guilds/${guildId}/bans`);
    }
    /**
     * Get a specific ban by user ID.
     *
     * @param guildId - The ID of the guild
     * @param userId - The ID of the banned user
     * @returns The ban object if found
     * @throws {RESTError} 404 if the user is not banned
     *
     * @example
     * ```ts
     * try {
     *   const ban = await rest.getBan('123456789', '987654321');
     *   console.log(`Banned for: ${ban.reason}`);
     * } catch (e) {
     *   console.log('User is not banned');
     * }
     * ```
     */
    async getBan(guildId, userId) {
        return this.request('GET', `/bot/guilds/${guildId}/bans/${userId}`);
    }
    /**
     * Get guild invites
     *
     * @param guildId - The ID of the guild
     * @returns Array of invite objects
     */
    async getGuildInvites(guildId) {
        return this.request('GET', `/bot/guilds/${guildId}/invites`);
    }
    // ==================== Pins ====================
    /**
     * Pin a message
     */
    async pinMessage(guildId, channelId, messageId) {
        await this.request('PUT', `/bot/guilds/${guildId}/channels/${channelId}/pins/${messageId}`);
    }
    /**
     * Unpin a message
     */
    async unpinMessage(guildId, channelId, messageId) {
        await this.request('DELETE', `/bot/guilds/${guildId}/channels/${channelId}/pins/${messageId}`);
    }
    /**
     * Get pinned messages
     */
    async getPinnedMessages(guildId, channelId) {
        return this.request('GET', `/bot/guilds/${guildId}/channels/${channelId}/pins`);
    }
    // ==================== Audit Log ====================
    /**
     * Get the audit log for a guild.
     * Requires VIEW_AUDIT_LOG permission.
     *
     * @param guildId - The ID of the guild
     * @param options - Query options
     * @returns Audit log entries
     * @throws {RESTError} If the bot lacks VIEW_AUDIT_LOG permission
     *
     * @example
     * ```ts
     * const logs = await rest.getAuditLog('123', { limit: 50 });
     * ```
     */
    async getAuditLog(guildId, options) {
        const params = new URLSearchParams();
        if (options?.user_id)
            params.append('user_id', options.user_id);
        if (options?.action_type !== undefined)
            params.append('action_type', String(options.action_type));
        if (options?.before)
            params.append('before', options.before);
        if (options?.limit !== undefined)
            params.append('limit', String(options.limit));
        const query = params.toString();
        return this.request('GET', `/bot/guilds/${guildId}/audit-logs${query ? `?${query}` : ''}`);
    }
    // ==================== Users ====================
    /**
     * Get a user
     */
    async getUser(userId) {
        return this.request('GET', `/bot/users/${userId}`);
    }
    /**
     * Get current bot user
     */
    async getCurrentUser() {
        return this.request('GET', `/bot/users/@me`);
    }
    // ==================== Invites ====================
    /**
     * Create an invite
     */
    async createInvite(guildId, channelId, data) {
        return this.request('POST', `/bot/guilds/${guildId}/channels/${channelId}/invites`, data || {});
    }
    /**
     * Delete an invite
     */
    async deleteInvite(inviteCode) {
        await this.request('DELETE', `/bot/invites/${inviteCode}`);
    }
    /**
     * Get an invite
     */
    async getInvite(inviteCode) {
        return this.request('GET', `/bot/invites/${inviteCode}`);
    }
    // ==================== Webhooks ====================
    /**
     * Get channel webhooks
     */
    async getChannelWebhooks(guildId, channelId) {
        return this.request('GET', `/bot/guilds/${guildId}/channels/${channelId}/webhooks`);
    }
    /**
     * Get guild webhooks
     */
    async getGuildWebhooks(guildId) {
        return this.request('GET', `/bot/guilds/${guildId}/webhooks`);
    }
    /**
     * Create a webhook
     */
    async createWebhook(guildId, channelId, data) {
        return this.request('POST', `/bot/guilds/${guildId}/channels/${channelId}/webhooks`, data);
    }
    /**
     * Update a webhook
     */
    async updateWebhook(guildId, webhookId, data) {
        return this.request('PATCH', `/bot/guilds/${guildId}/webhooks/${webhookId}`, data);
    }
    /**
     * Delete a webhook
     */
    async deleteWebhook(guildId, webhookId) {
        return this.request('DELETE', `/bot/guilds/${guildId}/webhooks/${webhookId}`);
    }
    // ==================== Generic HTTP Methods ====================
    /**
     * Make a GET request to any API path
     * @example await client.rest.get('/bot/guilds/123/channels');
     */
    async get(path) {
        return this.request('GET', path);
    }
    /**
     * Make a POST request to any API path
     * @example await client.rest.post('/bot/guilds/123/channels', { name: 'new-channel', type: 2 });
     */
    async post(path, body) {
        return this.request('POST', path, body);
    }
    /**
     * Make a PATCH request to any API path
     * @example await client.rest.patch('/bot/guilds/123/channels/456', { name: 'renamed' });
     */
    async patch(path, body) {
        return this.request('PATCH', path, body);
    }
    /**
     * Make a PUT request to any API path
     * @example await client.rest.put('/bot/channels/456/permissions/789', { type: 0, allow: '1024' });
     */
    async put(path, body) {
        return this.request('PUT', path, body);
    }
    /**
     * Make a DELETE request to any API path
     * @example await client.rest.delete('/bot/guilds/123/channels/456');
     */
    async delete(path) {
        return this.request('DELETE', path);
    }
}
exports.REST = REST;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUkVTVC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9yZXN0L1JFU1QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBaUJBLGtEQUE4RztBQUM5RyxxQ0FBcUQ7QUErQnJEOzs7R0FHRztBQUNILE1BQU0sZ0JBQWdCLEdBQUcsT0FBTyxDQUFDO0FBRWpDOzs7O0dBSUc7QUFDSCxTQUFTLFVBQVUsQ0FBQyxFQUFVLEVBQUUsU0FBaUI7SUFDL0MsSUFBSSxDQUFDLEVBQUUsSUFBSSxPQUFPLEVBQUUsS0FBSyxRQUFRLEVBQUUsQ0FBQztRQUNsQyxNQUFNLElBQUksS0FBSyxDQUFDLFdBQVcsU0FBUyw4QkFBOEIsQ0FBQyxDQUFDO0lBQ3RFLENBQUM7SUFDRCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUM7UUFDL0IsTUFBTSxJQUFJLEtBQUssQ0FBQyxXQUFXLFNBQVMsb0NBQW9DLEVBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxNQUFNLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDaEksQ0FBQztBQUNILENBQUM7QUFFRDs7R0FFRztBQUNILE1BQWEsSUFBSTtJQUNQLE9BQU8sQ0FBUztJQUNoQixLQUFLLEdBQVcsRUFBRSxDQUFDO0lBRTNCLHFEQUFxRDtJQUM3QyxTQUFTLEdBQTRCLElBQUksR0FBRyxFQUFFLENBQUM7SUFDdEMsY0FBYyxHQUFHLENBQUMsR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDLENBQUMsV0FBVztJQUU1RCxZQUFZLFVBQWtCLG1DQUFtQztRQUMvRCxJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztJQUN6QixDQUFDO0lBRUQsNERBQTREO0lBRTVEOzs7T0FHRztJQUNILFNBQVMsQ0FBQyxJQUE0RjtRQUNwRyxNQUFNLE1B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Q0gsS0FBSyxDQUFDLGFBQWEsQ0FBQyxPQUFlLEVBQUUsU0FBaUI7UUFDcEQsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFPLFFBQVEsRUFBRSxlQUFlLE9BQU8sYUFBYSxTQUFTLEVBQUUsQ0FBQyxDQUFDO0lBQ3RGLENBQUM7SUFFRCxpRUFBaUU7SUFFakU7OztPQUdHO0lBQ0gsS0FBSyxDQUFDLEdBQUcsQ0FBVSxJQUFZO1FBQzdCLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBSSxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDdEMsQ0FBQztJQUVEOzs7T0FHRztJQUNILEtBQUssQ0FBQyxJQUFJLENBQVUsSUFBWSxFQUFFLElBQVU7UUFDMUMsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFJLE1BQU0sRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDN0MsQ0FBQztJQUVEOzs7T0FHRztJQUNILEtBQUssQ0FBQyxLQUFLLENBQVUsSUFBWSxFQUFFLElBQVU7UUFDM0MsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFJLE9BQU8sRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDOUMsQ0FBQztJQUVEOzs7T0FHRztJQUNILEtBQUssQ0FBQyxHQUFHLENBQVUsSUFBWSxFQUFFLElBQVU7UUFDekMsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFJLEtBQUssRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDNUMsQ0FBQztJQUVEOzs7T0FHRztJQUNILEtBQUssQ0FBQyxNQUFNLENBQVUsSUFBWTtRQUNoQyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUksUUFBUSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ3pDLENBQUM7Q0FDRjtBQXYzREQsb0JBdTNEQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFxyXG4gIEFQSU1lc3NhZ2UsIFxyXG4gIEFQSUFwcGxpY2F0aW9uQ29tbWFuZCwgXHJcbiAgQVBJRW1iZWQsXHJcbiAgQVBJR3VpbGREYXRhLFxyXG4gIEFQSU1lbWJlckRhdGEsXHJcbiAgQVBJTWVtYmVyc1Jlc3BvbnNlLFxyXG4gIEFQSVJvbGVEYXRhLFxyXG4gIEFQSUJhbixcclxuICBBUElJbnZpdGUsXHJcbiAgQVBJRW1vamksXHJcbiAgQVBJV2ViaG9vayxcclxuICBBUElVc2VyLFxyXG4gIEFQSUNoYW5uZWwsXHJcbiAgQW55QWN0aW9uUm93LFxyXG4gIEFQSUF1ZGl0TG9nXHJcbn0gZnJvbSAnLi4vdHlwZXMnO1xyXG5pbXBvcnQgeyBzZXJpYWxpemVDb21wb25lbnRzLCBub3JtYWxpemVFbWJlZCwgaGFzQ29tcG9uZW50c1YyLCB2aXNpdENvbXBvbmVudFRleHQgfSBmcm9tICcuLi91dGlscy9zZXJpYWxpemUnO1xyXG5pbXBvcnQgeyBSRVNURXJyb3IsIFJhdGVMaW1pdEVycm9yIH0gZnJvbSAnLi9lcnJvcnMnO1xyXG5cclxuLyoqXHJcbiAqIE1lbnRpb24gZGF0YSBzdHJ1Y3R1cmUgZm9yIG91ciBzeXN0ZW1cclxuICovXHJcbmV4cG9ydCBpbnRlcmZhY2UgTWVudGlvblVzZXIge1xyXG4gIGlkOiBzdHJpbmc7XHJcbiAgdXNlcm5hbWU6IHN0cmluZztcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBNZW50aW9uUm9sZSB7XHJcbiAgaWQ6IHN0cmluZztcclxuICBuYW1lPzogc3RyaW5nO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIE1lbnRpb25zRGF0YSB7XHJcbiAgdXNlcnM/OiBNZW50aW9uVXNlcltdO1xyXG4gIHJvbGVzPzogTWVudGlvblJvbGVbXTtcclxuICBldmVyeW9uZT86IGJvb2xlYW47XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBVc2VyIGNhY2hlIGVudHJ5XHJcbiAqL1xyXG5pbnRlcmZhY2UgQ2FjaGVkVXNlciB7XHJcbiAgaWQ6IHN0cmluZztcclxuICB1c2VybmFtZTogc3RyaW5nO1xyXG4gIGRpc3BsYXlOYW1lPzogc3RyaW5nO1xyXG4gIGNhY2hlZEF0OiBudW1iZXI7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBSZWdleCB0byB2YWxpZGF0ZSBJRHMgaW4gVVJMIHBhdGhzLlxyXG4gKiBJRHMgc2hvdWxkIG9ubHkgY29udGFpbiBkaWdpdHMgdG8gcHJldmVudCBwYXRoIHRyYXZlcnNhbCBhdHRhY2tzLlxyXG4gKi9cclxuY29uc3QgVkFMSURfSURfUEFUVEVSTiA9IC9eXFxkKyQvO1xyXG5cclxuLyoqXHJcbiAqIFZhbGlkYXRlIHRoYXQgYW4gSUQgaXMgc2FmZSB0byB1c2UgaW4gVVJMIHBhdGhzLlxyXG4gKiBQcmV2ZW50cyBwYXRoIHRyYXZlcnNhbCBhdHRhY2tzIGxpa2UgJy4uLycgaW4gSURzLlxyXG4gKiBAdGhyb3dzIEVycm9yIGlmIElEIGlzIGludmFsaWRcclxuICovXHJcbmZ1bmN0aW9uIHZhbGlkYXRlSWQoaWQ6IHN0cmluZywgZmllbGROYW1lOiBzdHJpbmcpOiB2b2lkIHtcclxuICBpZiAoIWlkIHx8IHR5cGVvZiBpZCAhPT0gJ3N0cmluZycpIHtcclxuICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCAke2ZpZWxkTmFtZX06IG11c3QgYmUgYSBub24tZW1wdHkgc3RyaW5nYCk7XHJcbiAgfVxyXG4gIGlmICghVkFMSURfSURfUEFUVEVSTi50ZXN0KGlkKSkge1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkICR7ZmllbGROYW1lfTogbXVzdCBjb250YWluIG9ubHkgZGlnaXRzLCBnb3QgXCIke2lkLnN1YnN0cmluZygwLCAyMCl9JHtpZC5sZW5ndGggPiAyMCA/ICcuLi4nIDogJyd9XCJgKTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBSRVNUIEFQSSBjbGllbnQgZm9yIEp1YmJpb1xyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFJFU1Qge1xyXG4gIHByaXZhdGUgYmFzZVVybDogc3RyaW5nO1xyXG4gIHByaXZhdGUgdG9rZW46IHN0cmluZyA9ICcnO1xyXG4gIFxyXG4gIC8vIFVzZXIgY2FjaGUgZm9yIG1lbnRpb24gcmVzb2x1dGlvbiAoSUQgLT4gdXNlcm5hbWUpXHJcbiAgcHJpdmF0ZSB1c2VyQ2FjaGU6IE1hcDxzdHJpbmcsIENhY2hlZFVzZXI+ID0gbmV3IE1hcCgpO1xyXG4gIHByaXZhdGUgcmVhZG9ubHkgVVNFUl9DQUNIRV9UVEwgPSA1ICogNjAgKiAxMDAwOyAvLyA1IGRha2lrYVxyXG5cclxuICBjb25zdHJ1Y3RvcihiYXNlVXJsOiBzdHJpbmcgPSAnaHR0cHM6Ly9nYXRld2F5Lmp1YmJpby5jb20vYXBpL3YxJykge1xyXG4gICAgdGhpcy5iYXNlVXJsID0gYmFzZVVybDtcclxuICB9XHJcblxyXG4gIC8vID09PT09PT09PT09PT09PT09PT09IE1lbnRpb24gSGVscGVycyA9PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAvKipcclxuICAgKiBDYWNoZSBhIHVzZXIgZm9yIG1lbnRpb24gcmVzb2x1dGlvblxyXG4gICAqIEJvdCdsYXIgaW50ZXJhY3Rpb24nZGFuIGdlbGVuIHVzZXIgYmlsZ2lzaW5pIGNhY2hlJ2xleWViaWxpclxyXG4gICAqL1xyXG4gIGNhY2hlVXNlcih1c2VyOiB7IGlkOiBzdHJpbmcgfCBudW1iZXI7IHVzZXJuYW1lOiBzdHJpbmc7IGRpc3BsYXlOYW1lPzogc3RyaW5nOyBkaXNwbGF5X25hbWU/OiBzdHJpbmcgfSk6IHZvaWQge1xyXG4gICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHVzZXIuaWQpO1xyXG4gICAgdGhpcy51c2VyQ2FjaGUuc2V0KHVzZXJJZCwge1xyXG4gICAgICBpZDogdXNlcklkLFxyXG4gICAgICB1c2VybmFtZTogdXNlci51c2VybmFtZSxcclxuICAgICAgZGlzcGxheU5hbWU6IHVzZXIuZGlzcGxheU5hbWUgfHwgdXNlci5kaXNwbGF5X25hbWUsXHJcbiAgICAgIGNhY2hlZEF0OiBEYXRlLm5vdygpXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENhY2hlIG11bHRpcGxlIHVzZXJzXHJcbiAgICovXHJcbiAgY2FjaGVVc2Vycyh1c2VyczogQXJyYXk8eyBpZDogc3RyaW5nIHwgbnVtYmVyOyB1c2VybmFtZTogc3RyaW5nOyBkaXNwbGF5TmFtZT86IHN0cmluZzsgZGlzcGxheV9uYW1lPzogc3RyaW5nIH0+KTogdm9pZCB7XHJcbiAgICB1c2Vycy5mb3JFYWNoKHVzZXIgPT4gdGhpcy5jYWNoZVVzZXIodXNlcikpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGNhY2hlZCB1c2VyIGJ5IElEXHJcbiAgICovXHJcbiAgZ2V0Q2FjaGVkVXNlcih1c2VySWQ6IHN0cmluZyk6IENhY2hlZFVzZXIgfCB1bmRlZmluZWQge1xyXG4gICAgY29uc3QgY2FjaGVkID0gdGhpcy51c2VyQ2FjaGUuZ2V0KHVzZXJJZCk7XHJcbiAgICBpZiAoY2FjaGVkICYmIERhdGUubm93KCkgLSBjYWNoZWQuY2FjaGVkQXQgPCB0aGlzLlVTRVJfQ0FDSEVfVFRMKSB7XHJcbiAgICAgIHJldHVybiBjYWNoZWQ7XHJcbiAgICB9XHJcbiAgICAvLyBFeHBpcmVkLCByZW1vdmUgZnJvbSBjYWNoZVxyXG4gICAgaWYgKGNhY2hlZCkge1xyXG4gICAgICB0aGlzLnVzZXJDYWNoZS5kZWxldGUodXNlcklkKTtcclxuICAgIH1cclxuICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBGb3JtYXQgYSB1c2VyIG1lbnRpb25cclxuICAgKiBSZXR1cm5zIGJvdGggdGhlIHRleHQgZm9ybWF0IGFuZCBtZW50aW9ucyBkYXRhXHJcbiAgICogXHJcbiAgICogQGV4YW1wbGVcclxuICAgKiBjb25zdCBtZW50aW9uID0gcmVzdC5mb3JtYXRNZW50aW9uKHVzZXIpO1xyXG4gICAqIC8vIG1lbnRpb24udGV4dCA9IFwiPEAxPlwiXHJcbiAgICogLy8gbWVudGlvbi5kYXRhID0geyB1c2VyczogW3sgaWQ6IFwiMVwiLCB1c2VybmFtZTogXCJpbGtheVwiIH1dIH1cclxuICAgKi9cclxuICBmb3JtYXRNZW50aW9uKHVzZXI6IHsgaWQ6IHN0cmluZyB8IG51bWJlcjsgdXNlcm5hbWU6IHN0cmluZyB9KTogeyB0ZXh0OiBzdHJpbmc7IGRhdGE6IE1lbnRpb25zRGF0YSB9IHtcclxuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyh1c2VyLmlkKTtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIHRleHQ6IGA8QCR7dXNlcklkfT5gLFxyXG4gICAgICBkYXRhOiB7XHJcbiAgICAgICAgdXNlcnM6IFt7IGlkOiB1c2VySWQsIHVzZXJuYW1lOiB1c2VyLnVzZXJuYW1lIH1dXHJcbiAgICAgIH1cclxuICAgIH07XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBQYXJzZSBtZW50aW9ucyAoPEBJRD4pIGluIGNvbnRlbnQgYW5kIGJ1aWxkIG1lbnRpb25zIGRhdGEgc3RydWN0dXJlXHJcbiAgICogQ29udGVudCBpcyBrZXB0IGFzLWlzIHdpdGggPEBJRD4gZm9ybWF0IChjbGllbnQgcmVuZGVycyB0aGVtKVxyXG4gICAqIFxyXG4gICAqIEBwYXJhbSBjb250ZW50IC0gTWVzc2FnZSBjb250ZW50IHdpdGggbWVudGlvbnNcclxuICAgKiBAcGFyYW0gZXhpc3RpbmdNZW50aW9ucyAtIEV4aXN0aW5nIG1lbnRpb25zIGRhdGEgdG8gbWVyZ2Ugd2l0aFxyXG4gICAqIEByZXR1cm5zIE9yaWdpbmFsIGNvbnRlbnQgYW5kIG1lbnRpb25zIGRhdGFcclxuICAgKi9cclxuICBwcml2YXRlIHByb2Nlc3NNZW50aW9ucyhjb250ZW50OiBzdHJpbmcgfCBudW1iZXIgfCB1bmtub3duLCBleGlzdGluZ01lbnRpb25zPzogTWVudGlvbnNEYXRhKTogeyBjb250ZW50OiBzdHJpbmc7IG1lbnRpb25zOiBNZW50aW9uc0RhdGEgfSB7XHJcbiAgICAvLyBCdWcgIzUgZml4IC0gbnVtYmVyIHZleWEgZGnEn2VyIHRpcGxlciBzdHJpbmcnZSDDp2V2cmlsaXJcclxuICAgIGNvbnN0IGNvbnRlbnRTdHIgPSBTdHJpbmcoY29udGVudCA/PyAnJyk7XHJcbiAgICBcclxuICAgIGNvbnN0IG1lbnRpb25zOiBNZW50aW9uc0RhdGEgPSB7XHJcbiAgICAgIHVzZXJzOiBbLi4uKGV4aXN0aW5nTWVudGlvbnM/LnVzZXJzIHx8IFtdKV0sXHJcbiAgICAgIHJvbGVzOiBbLi4uKGV4aXN0aW5nTWVudGlvbnM/LnJvbGVzIHx8IFtdKV0sXHJcbiAgICAgIGV2ZXJ5b25lOiBleGlzdGluZ01lbnRpb25zPy5ldmVyeW9uZVxyXG4gICAgfTtcclxuXHJcbiAgICAvLyBUcmFjayBhbHJlYWR5IGFkZGVkIHVzZXIgSURzIHRvIGF2b2lkIGR1cGxpY2F0ZXNcclxuICAgIGNvbnN0IGFkZGVkVXNlcklkcyA9IG5ldyBTZXQobWVudGlvbnMudXNlcnM/Lm1hcCh1ID0+IHUuaWQpIHx8IFtdKTtcclxuXHJcbiAgICAvLyBQYXJzZSA8QElEPiBmb3JtYXQgKHVzZXIgbWVudGlvbnMpIOKAlCBrZWVwIGNvbnRlbnQgYXMtaXMsIG9ubHkgYnVpbGQgbWVudGlvbnMgZGF0YVxyXG4gICAgY29uc3QgdXNlck1lbnRpb25SZWdleCA9IC88QCE/KFxcZCspPi9nO1xyXG4gICAgbGV0IG1hdGNoO1xyXG5cclxuICAgIHdoaWxlICgobWF0Y2ggPSB1c2VyTWVudGlvblJlZ2V4LmV4ZWMoY29udGVudFN0cikpICE9PSBudWxsKSB7XHJcbiAgICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhtYXRjaFsxXSk7XHJcblxyXG4gICAgICBpZiAoIWFkZGVkVXNlcklkcy5oYXModXNlcklkKSkge1xyXG4gICAgICAgIC8vIFRyeSB0byBnZXQgdXNlcm5hbWUgZnJvbSBjYWNoZSBmb3IgbWVudGlvbnMgZGF0YVxyXG4gICAgICAgIGNvbnN0IGNhY2hlZFVzZXIgPSB0aGlzLmdldENhY2hlZFVzZXIodXNlcklkKTtcclxuICAgICAgICBtZW50aW9ucy51c2VycyEucHVzaCh7IGlkOiB1c2VySWQsIHVzZXJuYW1lOiBjYWNoZWRVc2VyPy51c2VybmFtZSB8fCBgVXNlcl8ke3VzZXJJZH1gIH0pO1xyXG4gICAgICAgIGFkZGVkVXNlcklkcy5hZGQodXNlcklkKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIFBhcnNlIDxAJklEPiBmb3JtYXQgKHJvbGUgbWVudGlvbnMpIOKAlCBrZWVwIGNvbnRlbnQgYXMtaXNcclxuICAgIGNvbnN0IHJvbGVNZW50aW9uUmVnZXggPSAvPEAmKFxcZCspPi9nO1xyXG4gICAgY29uc3QgYWRkZWRSb2xlSWRzID0gbmV3IFNldChtZW50aW9ucy5yb2xlcz8ubWFwKHIgPT4gci5pZCkgfHwgW10pO1xyXG5cclxuICAgIHdoaWxlICgobWF0Y2ggPSByb2xlTWVudGlvblJlZ2V4LmV4ZWMoY29udGVudFN0cikpICE9PSBudWxsKSB7XHJcbiAgICAgIGNvbnN0IHJvbGVJZCA9IG1hdGNoWzFdO1xyXG4gICAgICBpZiAoIWFkZGVkUm9sZUlkcy5oYXMocm9sZUlkKSkge1xyXG4gICAgICAgIG1lbnRpb25zLnJvbGVzIS5wdXNoKHsgaWQ6IHJvbGVJZCB9KTtcclxuICAgICAgICBhZGRlZFJvbGVJZHMuYWRkKHJvbGVJZCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyBQYXJzZSBAZXZlcnlvbmUgYW5kIEBoZXJlXHJcbiAgICBpZiAoY29udGVudFN0ci5pbmNsdWRlcygnQGV2ZXJ5b25lJykpIHtcclxuICAgICAgbWVudGlvbnMuZXZlcnlvbmUgPSB0cnVlO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIENsZWFuIHVwIGVtcHR5IGFycmF5c1xyXG4gICAgaWYgKG1lbnRpb25zLnVzZXJzPy5sZW5ndGggPT09IDApIGRlbGV0ZSBtZW50aW9ucy51c2VycztcclxuICAgIGlmIChtZW50aW9ucy5yb2xlcz8ubGVuZ3RoID09PSAwKSBkZWxldGUgbWVudGlvbnMucm9sZXM7XHJcblxyXG4gICAgcmV0dXJuIHsgY29udGVudDogY29udGVudFN0ciwgbWVudGlvbnMgfTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFByZXBhcmUgbWVzc2FnZSBkYXRhIHdpdGggcHJvY2Vzc2VkIG1lbnRpb25zXHJcbiAgICogQXV0b21hdGljYWxseSBjb252ZXJ0cyBtZW50aW9ucyB0byBvdXIgZm9ybWF0XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBwcmVwYXJlTWVzc2FnZURhdGEoZGF0YToge1xyXG4gICAgZmxhZ3M/OiBudW1iZXI7XHJcbiAgICBjb250ZW50Pzogc3RyaW5nO1xyXG4gICAgZW1iZWRzPzogQVBJRW1iZWRbXTtcclxuICAgIGNvbXBvbmVudHM/OiBBbnlBY3Rpb25Sb3dbXSB8IHVua25vd25bXTtcclxuICAgIG1lbnRpb25zPzogTWVudGlvbnNEYXRhO1xyXG4gICAgbWVzc2FnZV9yZWZlcmVuY2U/OiB7IG1lc3NhZ2VfaWQ6IHN0cmluZyB9O1xyXG4gIH0pOiB7IFxyXG4gICAgZmxhZ3M/OiBudW1iZXI7XHJcbiAgICBjb250ZW50Pzogc3RyaW5nO1xyXG4gICAgZW1iZWRzPzogQVBJRW1iZWRbXTsgXHJcbiAgICBjb21wb25lbnRzPzogdW5rbm93bltdOyBcclxuICAgIG1lbnRpb25zPzogTWVudGlvbnNEYXRhO1xyXG4gICAgbWVzc2FnZV9yZWZlcmVuY2U/OiB7IG1lc3NhZ2VfaWQ6IHN0cmluZyB9O1xyXG4gIH0ge1xyXG4gICAgY29uc3QgcmVzdWx0OiB7IFxyXG4gICAgICBmbGFncz86IG51bWJlcjtcclxuICAgIGNvbnRlbnQ/OiBzdHJpbmc7XHJcbiAgICAgIGVtYmVkcz86IEFQSUVtYmVkW107IFxyXG4gICAgICBjb21wb25lbnRzPzogdW5rbm93bltdOyBcclxuICAgICAgbWVudGlvbnM/OiBNZW50aW9uc0RhdGE7XHJcbiAgICAgIG1lc3NhZ2VfcmVmZXJlbmNlPzogeyBtZXNzYWdlX2lkOiBzdHJpbmcgfTtcclxuICAgIH0gPSB7IC4uLmRhdGEgfTtcclxuXHJcbiAgICAvLyBSZXNvbHZlIGNvbXBvbmVudHMgKEFjdGlvblJvd0J1aWxkZXIgLyBCdXR0b25CdWlsZGVyIGluc3RhbmNlcylcclxuICAgIGlmIChkYXRhLmNvbXBvbmVudHMgJiYgZGF0YS5jb21wb25lbnRzLmxlbmd0aCA+IDApIHtcclxuICAgICAgcmVzdWx0LmNvbXBvbmVudHMgPSBzZXJpYWxpemVDb21wb25lbnRzKGRhdGEuY29tcG9uZW50cyBhcyB1bmtub3duW10pO1xyXG4gICAgfVxyXG5cclxuICAgIGxldCBhbGxNZW50aW9uczogTWVudGlvbnNEYXRhID0geyAuLi5kYXRhLm1lbnRpb25zIH07XHJcbiAgICBpZiAoaGFzQ29tcG9uZW50c1YyKHJlc3VsdC5jb21wb25lbnRzKSkgcmVzdWx0LmZsYWdzID0gKGRhdGEuZmxhZ3MgPz8gMCkgfCAzMjc2ODtcclxuICAgIHZpc2l0Q29tcG9uZW50VGV4dChyZXN1bHQuY29tcG9uZW50cywgY29udGVudCA9PiB7IGFsbE1lbnRpb25zID0gdGhpcy5wcm9jZXNzTWVudGlvbnMoY29udGVudCwgYWxsTWVudGlvbnMpLm1lbnRpb25zOyB9KTtcclxuXHJcbiAgICAvLyBQcm9jZXNzIG1lbnRpb25zIGluIGNvbnRlbnQgaWYgcHJlc2VudFxyXG4gICAgaWYgKGRhdGEuY29udGVudCkge1xyXG4gICAgICBjb25zdCB7IGNvbnRlbnQsIG1lbnRpb25zIH0gPSB0aGlzLnByb2Nlc3NNZW50aW9ucyhkYXRhLmNvbnRlbnQsIGFsbE1lbnRpb25zKTtcclxuICAgICAgcmVzdWx0LmNvbnRlbnQgPSBjb250ZW50O1xyXG4gICAgICBhbGxNZW50aW9ucyA9IG1lbnRpb25zO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIFByb2Nlc3MgbWVudGlvbnMgaW4gZW1iZWRzIChkZXNjcmlwdGlvbiwgdGl0bGUsIGZvb3RlciwgZmllbGRzKVxyXG4gICAgaWYgKGRhdGEuZW1iZWRzICYmIGRhdGEuZW1iZWRzLmxlbmd0aCA+IDApIHtcclxuICAgICAgcmVzdWx0LmVtYmVkcyA9IGRhdGEuZW1iZWRzLm1hcChlbWJlZCA9PiB7XHJcbiAgICAgICAgLy8gTm9ybWFsaXplIGVtYmVkIChoYW5kbGVzIEVtYmVkQnVpbGRlciwgY29sb3JzLCB0aW1lc3RhbXBzLCBpY29uVVJMIOKGkiBpY29uX3VybCwgZXRjLilcclxuICAgICAgICBjb25zdCBwcm9jZXNzZWRFbWJlZCA9IG5vcm1hbGl6ZUVtYmVkKGVtYmVkKSBhcyBBUElFbWJlZCAmIFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xyXG5cclxuICAgICAgICAvLyBHZXQgdGhlIHJhdyBlbWJlZCBmb3IgbWVudGlvbiBwcm9jZXNzaW5nXHJcbiAgICAgICAgY29uc3QgcmF3RW1iZWQgPSB0eXBlb2YgKGVtYmVkIGFzIHsgdG9KU09OPzogKCkgPT4gQVBJRW1iZWQgfSkudG9KU09OID09PSAnZnVuY3Rpb24nIFxyXG4gICAgICAgICAgPyAoZW1iZWQgYXMgeyB0b0pTT046ICgpID0+IEFQSUVtYmVkIH0pLnRvSlNPTigpIFxyXG4gICAgICAgICAgOiBlbWJlZDtcclxuICAgICAgICBcclxuICAgICAgICAvLyBQcm9jZXNzIGRlc2NyaXB0aW9uXHJcbiAgICAgICAgaWYgKHJhd0VtYmVkLmRlc2NyaXB0aW9uKSB7XHJcbiAgICAgICAgICBjb25zdCB7IGNvbnRlbnQsIG1lbnRpb25zIH0gPSB0aGlzLnByb2Nlc3NNZW50aW9ucyhyYXdFbWJlZC5kZXNjcmlwdGlvbiwgYWxsTWVudGlvbnMpO1xyXG4gICAgICAgICAgcHJvY2Vzc2VkRW1iZWQuZGVzY3JpcHRpb24gPSBjb250ZW50O1xyXG4gICAgICAgICAgYWxsTWVudGlvbnMgPSBtZW50aW9ucztcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gUHJvY2VzcyB0aXRsZVxyXG4gICAgICAgIGlmIChyYXdFbWJlZC50aXRsZSkge1xyXG4gICAgICAgICAgY29uc3QgeyBjb250ZW50LCBtZW50aW9ucyB9ID0gdGhpcy5wcm9jZXNzTWVudGlvbnMocmF3RW1iZWQudGl0bGUsIGFsbE1lbnRpb25zKTtcclxuICAgICAgICAgIHByb2Nlc3NlZEVtYmVkLnRpdGxlID0gY29udGVudDtcclxuICAgICAgICAgIGFsbE1lbnRpb25zID0gbWVudGlvbnM7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIFByb2Nlc3MgZm9vdGVyIHRleHRcclxuICAgICAgICBpZiAocmF3RW1iZWQuZm9vdGVyPy50ZXh0KSB7XHJcbiAgICAgICAgICBjb25zdCB7IGNvbnRlbnQsIG1lbnRpb25zIH0gPSB0aGlzLnByb2Nlc3NNZW50aW9ucyhyYXdFbWJlZC5mb290ZXIudGV4dCwgYWxsTWVudGlvbnMpO1xyXG4gICAgICAgICAgcHJvY2Vzc2VkRW1iZWQuZm9vdGVyID0geyAuLi4ocHJvY2Vzc2VkRW1iZWQuZm9vdGVyID8/IHt9KSwgdGV4dDogY29udGVudCB9O1xyXG4gICAgICAgICAgYWxsTWVudGlvbnMgPSBtZW50aW9ucztcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gUHJvY2VzcyBmaWVsZHNcclxuICAgICAgICBpZiAocmF3RW1iZWQuZmllbGRzICYmIHJhd0VtYmVkLmZpZWxkcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICBwcm9jZXNzZWRFbWJlZC5maWVsZHMgPSByYXdFbWJlZC5maWVsZHMubWFwKChmaWVsZDogeyBuYW1lOiBzdHJpbmc7IHZhbHVlOiBzdHJpbmc7IGlubGluZT86IGJvb2xlYW4gfSkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCBwcm9jZXNzZWRGaWVsZDogeyBuYW1lOiBzdHJpbmc7IHZhbHVlOiBzdHJpbmc7IGlubGluZT86IGJvb2xlYW4gfSA9IHsgLi4uZmllbGQgfTtcclxuICAgICAgICAgICAgaWYgKGZpZWxkLnZhbHVlKSB7XHJcbiAgICAgICAgICAgICAgY29uc3QgeyBjb250ZW50LCBtZW50aW9ucyB9ID0gdGhpcy5wcm9jZXNzTWVudGlvbnMoZmllbGQudmFsdWUsIGFsbE1lbnRpb25zKTtcclxuICAgICAgICAgICAgICBwcm9jZXNzZWRGaWVsZC52YWx1ZSA9IGNvbnRlbnQ7XHJcbiAgICAgICAgICAgICAgYWxsTWVudGlvbnMgPSBtZW50aW9ucztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoZmllbGQubmFtZSkge1xyXG4gICAgICAgICAgICAgIGNvbnN0IHsgY29udGVudCwgbWVudGlvbnMgfSA9IHRoaXMucHJvY2Vzc01lbnRpb25zKGZpZWxkLm5hbWUsIGFsbE1lbnRpb25zKTtcclxuICAgICAgICAgICAgICBwcm9jZXNzZWRGaWVsZC5uYW1lID0gY29udGVudDtcclxuICAgICAgICAgICAgICBhbGxNZW50aW9ucyA9IG1lbnRpb25zO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBwcm9jZXNzZWRGaWVsZDtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gcHJvY2Vzc2VkRW1iZWQ7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIEFkZCBtZXJnZWQgbWVudGlvbnMgdG8gcmVzdWx0XHJcbiAgICBpZiAoYWxsTWVudGlvbnMudXNlcnM/Lmxlbmd0aCB8fCBhbGxNZW50aW9ucy5yb2xlcz8ubGVuZ3RoIHx8IGFsbE1lbnRpb25zLmV2ZXJ5b25lKSB7XHJcbiAgICAgIHJlc3VsdC5tZW50aW9ucyA9IGFsbE1lbnRpb25zO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiByZXN1bHQ7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZXQgdGhlIGJvdCB0b2tlblxyXG4gICAqL1xyXG4gIHNldFRva2VuKHRva2VuOiBzdHJpbmcpOiB0aGlzIHtcclxuICAgIHRoaXMudG9rZW4gPSB0b2tlbjtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogTWFrZSBhbiBhdXRoZW50aWNhdGVkIHJlcXVlc3Qgd2l0aCByYXRlIGxpbWl0IHJldHJ5XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBnbG9iYWxSZXNldEF0ID0gMDtcclxuICBwcml2YXRlIHJlYWRvbmx5IHJvdXRlUmVzZXRBdCA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XHJcblxyXG4gIHByaXZhdGUgYXN5bmMgcmVxdWVzdDxUPihtZXRob2Q6IHN0cmluZywgcGF0aDogc3RyaW5nLCBib2R5PzogYW55KTogUHJvbWlzZTxUPiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0Qm9keTxUPihtZXRob2QsIHBhdGgsIGJvZHkgPT09IHVuZGVmaW5lZCA/IHVuZGVmaW5lZCA6IEpTT04uc3RyaW5naWZ5KGJvZHkpLCB7XHJcbiAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbidcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqIFNoYXJlZCB0cmFuc3BvcnQ7IEpTT04gYW5kIGJ1ZmZlcmVkIG11bHRpcGFydCBib2RpZXMgYXJlIHJlcGxheWFibGUgb24gSFRUUCA0MjkuICovXHJcbiAgcHJpdmF0ZSBhc3luYyByZXF1ZXN0Qm9keTxUPihtZXRob2Q6IHN0cmluZywgcGF0aDogc3RyaW5nLCBib2R5Pzogc3RyaW5nIHwgQnVmZmVyLCBoZWFkZXJzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge30pOiBQcm9taXNlPFQ+IHtcclxuICAgIGNvbnN0IHJvdXRlID0gbWV0aG9kICsgJyAnICsgcGF0aC5yZXBsYWNlKC9cXC9cXGQrKD89XFwvfCQpL2csICcvOmlkJyk7XHJcbiAgICBmb3IgKGxldCBhdHRlbXB0ID0gMDsgOyBhdHRlbXB0KyspIHtcclxuICAgICAgbGV0IGRlbGF5OiBudW1iZXI7XHJcbiAgICAgIHdoaWxlICgoZGVsYXkgPSBNYXRoLm1heCh0aGlzLmdsb2JhbFJlc2V0QXQsIHRoaXMucm91dGVSZXNldEF0LmdldChyb3V0ZSkgPz8gMCkgLSBEYXRlLm5vdygpKSA+IDApIHtcclxuICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgTWF0aC5taW4oZGVsYXksIDJfMTQ3XzQ4M182NDcpKSk7XHJcbiAgICAgIH1cclxuICAgICAgdGhpcy5yb3V0ZVJlc2V0QXQuZGVsZXRlKHJvdXRlKTtcclxuICAgICAgaWYgKHByb2Nlc3MuZW52LkRFQlVHX1JFU1QpIGNvbnNvbGUubG9nKCdbUkVTVF0nLCBtZXRob2QsIHBhdGgucmVwbGFjZSgvKFxcL2ludGVyYWN0aW9uc1xcLyg/OndlYmhvb2tzXFwvKT9bXi9dK1xcLylbXi9dKy8sICckMVtSRURBQ1RFRF0nKSk7XHJcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godGhpcy5iYXNlVXJsICsgcGF0aCwge1xyXG4gICAgICAgIG1ldGhvZCxcclxuICAgICAgICBoZWFkZXJzOiB7IEF1dGhvcml6YXRpb246ICdCb3QgJyArIHRoaXMudG9rZW4sICdVc2VyLUFnZW50JzogJ0p1YmJpb0JvdC8xLjAgKCtodHRwczovL2p1YmJpby5jb20pJywgLi4uaGVhZGVycyB9LFxyXG4gICAgICAgIGJvZHlcclxuICAgICAgfSk7XHJcbiAgICAgIGlmIChyZXNwb25zZS5zdGF0dXMgPT09IDQyOSkge1xyXG4gICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCkuY2F0Y2goKCkgPT4gKHt9KSkgYXMgeyByZXRyeV9hZnRlcj86IG51bWJlcjsgZ2xvYmFsPzogYm9vbGVhbiB9O1xyXG4gICAgICAgIGNvbnN0IGhlYWRlciA9IHJlc3BvbnNlLmhlYWRlcnMuZ2V0KCdSZXRyeS1BZnRlcicpO1xyXG4gICAgICAgIGNvbnN0IHNlY29uZHMgPSBkYXRhLnJldHJ5X2FmdGVyID8/IChoZWFkZXIgPT09IG51bGwgPyB1bmRlZmluZWQgOiBOdW1iZXIoaGVhZGVyKSk7XHJcbiAgICAgICAgY29uc3QgcmV0cnlBZnRlciA9IE1hdGgubWF4KDEwLCBOdW1iZXIuaXNGaW5pdGUoc2Vjb25kcykgJiYgTnVtYmVyKHNlY29uZHMpID49IDBcclxuICAgICAgICAgID8gTWF0aC5jZWlsKE51bWJlcihzZWNvbmRzKSAqIDEwMDApXHJcbiAgICAgICAgICA6IGhlYWRlciAmJiBOdW1iZXIuaXNGaW5pdGUoRGF0ZS5wYXJzZShoZWFkZXIpKSA/IE1hdGgubWF4KDAsIERhdGUucGFyc2UoaGVhZGVyKSAtIERhdGUubm93KCkpIDogMTAwMCk7XHJcbiAgICAgICAgY29uc3QgcmVzZXRBdCA9IERhdGUubm93KCkgKyByZXRyeUFmdGVyO1xyXG4gICAgICAgIGlmIChkYXRhLmdsb2JhbCA9PT0gdHJ1ZSB8fCByZXNwb25zZS5oZWFkZXJzLmdldCgnWC1SYXRlTGltaXQtR2xvYmFsJykgPT09ICd0cnVlJykge1xyXG4gICAgICAgICAgdGhpcy5nbG9iYWxSZXNldEF0ID0gTWF0aC5tYXgodGhpcy5nbG9iYWxSZXNldEF0LCByZXNldEF0KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgdGhpcy5yb3V0ZVJlc2V0QXQuc2V0KHJvdXRlLCBNYXRoLm1heCh0aGlzLnJvdXRlUmVzZXRBdC5nZXQocm91dGUpID8/IDAsIHJlc2V0QXQpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGF0dGVtcHQgPj0gMykgdGhyb3cgbmV3IFJhdGVMaW1pdEVycm9yKHJldHJ5QWZ0ZXIsIG1ldGhvZCwgcGF0aCk7XHJcbiAgICAgICAgY29udGludWU7XHJcbiAgICAgIH1cclxuICAgICAgaWYgKCFyZXNwb25zZS5vaykgdGhyb3cgbmV3IFJFU1RFcnJvcihyZXNwb25zZS5zdGF0dXMsIG1ldGhvZCwgcGF0aCwgYXdhaXQgcmVzcG9uc2UudGV4dCgpKTtcclxuICAgICAgY29uc3QgdGV4dCA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKTtcclxuICAgICAgcmV0dXJuIHRleHQgPyBKU09OLnBhcnNlKHRleHQpIDoge30gYXMgVDtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8vID09PT09PT09PT09PT09PT09PT09IE1lc3NhZ2VzID09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIG1lc3NhZ2UgaW4gYSBjaGFubmVsXHJcbiAgICogTWVudGlvbnMgdXNlIDxASUQ+IGZvcm1hdCBhbmQgYXJlIGtlcHQgYXMtaXMgKGNsaWVudCByZW5kZXJzIHRoZW0pXHJcbiAgICogXHJcbiAgICogQGV4YW1wbGVcclxuICAgKiBhd2FpdCByZXN0LmNyZWF0ZU1lc3NhZ2UoZ3VpbGRJZCwgY2hhbm5lbElkLCB7XHJcbiAgICogICBjb250ZW50OiAnSGVsbG8gPEAxMjM+IScsXHJcbiAgICogfSk7XHJcbiAgICovXHJcbiAgYXN5bmMgY3JlYXRlTWVzc2FnZShndWlsZElkT3JDaGFubmVsSWQ6IHN0cmluZywgY2hhbm5lbElkT3JEYXRhOiBzdHJpbmcgfCB7XHJcbiAgICBjb250ZW50Pzogc3RyaW5nO1xyXG4gICAgZW1iZWRzPzogQVBJRW1iZWRbXTtcclxuICAgIGNvbXBvbmVudHM/OiBhbnlbXTtcclxuICAgIGZsYWdzPzogbnVtYmVyO1xyXG4gICAgbWVudGlvbnM/OiBNZW50aW9uc0RhdGE7XHJcbiAgICBmaWxlcz86IEFycmF5PHsgbmFtZTogc3RyaW5nOyBkYXRhOiBCdWZmZXIgfT47XHJcbiAgICBtZXNzYWdlX3JlZmVyZW5jZT86IHsgbWVzc2FnZV9pZDogc3RyaW5nIH07XHJcbiAgICBpbnRlcmFjdGlvbklkPzogc3RyaW5nO1xyXG4gIH0sIGRhdGE/OiB7XHJcbiAgICBjb250ZW50Pzogc3RyaW5nO1xyXG4gICAgZW1iZWRzPzogQVBJRW1iZWRbXTtcclxuICAgIGNvbXBvbmVudHM/OiBhbnlbXTtcclxuICAgIGZsYWdzPzogbnVtYmVyO1xyXG4gICAgbWVudGlvbnM/OiBNZW50aW9uc0RhdGE7XHJcbiAgICBmaWxlcz86IEFycmF5PHsgbmFtZTogc3RyaW5nOyBkYXRhOiBCdWZmZXIgfT47XHJcbiAgICBtZXNzYWdlX3JlZmVyZW5jZT86IHsgbWVzc2FnZV9pZDogc3RyaW5nIH07XHJcbiAgICBpbnRlcmFjdGlvbklkPzogc3RyaW5nO1xyXG4gIH0pOiBQcm9taXNlPEFQSU1lc3NhZ2U+IHtcclxuICAgIC8vIMSwa2kga3VsbGFuxLFtIMWfZWtsaTpcclxuICAgIC8vIDEuIGNyZWF0ZU1lc3NhZ2UoZ3VpbGRJZCwgY2hhbm5lbElkLCBkYXRhKSAtIGd1aWxkSWQgaWxlICh0ZXJjaWggZWRpbGVuKVxyXG4gICAgLy8gMi4gY3JlYXRlTWVzc2FnZShjaGFubmVsSWQsIGRhdGEpIC0gZ3VpbGRJZCBvbG1hZGFuIChlc2tpIGZvcm1hdCwgaGF0YSB2ZXJpcilcclxuICAgIFxyXG4gICAgbGV0IGd1aWxkSWQ6IHN0cmluZztcclxuICAgIGxldCBjaGFubmVsSWQ6IHN0cmluZztcclxuICAgIGxldCBtZXNzYWdlRGF0YTogYW55O1xyXG4gICAgXHJcbiAgICBpZiAodHlwZW9mIGNoYW5uZWxJZE9yRGF0YSA9PT0gJ3N0cmluZycgJiYgZGF0YSkge1xyXG4gICAgICAvLyBZZW5pIGZvcm1hdDogY3JlYXRlTWVzc2FnZShndWlsZElkLCBjaGFubmVsSWQsIGRhdGEpXHJcbiAgICAgIGd1aWxkSWQgPSBndWlsZElkT3JDaGFubmVsSWQ7XHJcbiAgICAgIGNoYW5uZWxJZCA9IGNoYW5uZWxJZE9yRGF0YTtcclxuICAgICAgXHJcbiAgICAgIC8vIFNFQ1VSSVRZOiBWYWxpZGF0ZSBJRHMgdG8gcHJldmVudCBwYXRoIHRyYXZlcnNhbFxyXG4gICAgICB2YWxpZGF0ZUlkKGd1aWxkSWQsICdndWlsZElkJyk7XHJcbiAgICAgIHZhbGlkYXRlSWQoY2hhbm5lbElkLCAnY2hhbm5lbElkJyk7XHJcbiAgICAgIFxyXG4gICAgICBtZXNzYWdlRGF0YSA9IHRoaXMucHJlcGFyZU1lc3NhZ2VEYXRhKGRhdGEpO1xyXG4gICAgICBcclxuICAgICAgLy8gQWRkIGludGVyYWN0aW9uX2lkIGlmIHByb3ZpZGVkXHJcbiAgICAgIGlmIChkYXRhLmludGVyYWN0aW9uSWQpIHtcclxuICAgICAgICBtZXNzYWdlRGF0YS5pbnRlcmFjdGlvbl9pZCA9IGRhdGEuaW50ZXJhY3Rpb25JZDtcclxuICAgICAgfVxyXG4gICAgICBcclxuICAgICAgLy8gQnVnICMxMCAtIEFkZCBmbGFncyBpZiBwcm92aWRlZFxyXG4gICAgICBpZiAoZGF0YS5mbGFncyAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgbWVzc2FnZURhdGEuZmxhZ3MgPSAobWVzc2FnZURhdGEuZmxhZ3MgPz8gMCkgfCBkYXRhLmZsYWdzO1xyXG4gICAgICB9XHJcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBjaGFubmVsSWRPckRhdGEgPT09ICdvYmplY3QnKSB7XHJcbiAgICAgIC8vIEVza2kgZm9ybWF0OiBjcmVhdGVNZXNzYWdlKGNoYW5uZWxJZCwgZGF0YSkgLSBndWlsZElkIHlva1xyXG4gICAgICAvLyBCdSBmb3JtYXQgYXJ0xLFrIGRlc3Rla2xlbm1peW9yLCBoYXRhIGbEsXJsYXRcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdjcmVhdGVNZXNzYWdlIHJlcXVpcmVzIGd1aWxkSWQ6IGNyZWF0ZU1lc3NhZ2UoZ3VpbGRJZCwgY2hhbm5lbElkLCBkYXRhKScpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGNyZWF0ZU1lc3NhZ2UgYXJndW1lbnRzJyk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QVBJTWVzc2FnZT4oJ1BPU1QnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH0vbWVzc2FnZXNgLCBtZXNzYWdlRGF0YSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgYW4gZXBoZW1lcmFsIG1lc3NhZ2UgdGhhdCBpcyBvbmx5IHZpc2libGUgdG8gYSBzcGVjaWZpYyB1c2VyXHJcbiAgICogRXBoZW1lcmFsIG1lc3NhZ2VzIGFyZSBOT1Qgc2F2ZWQgdG8gZGF0YWJhc2UgLSB0aGV5IGFyZSBvbmx5IHNlbnQgdmlhIFdlYlNvY2tldFxyXG4gICAqIFxyXG4gICAqIEBleGFtcGxlXHJcbiAgICogLy8gU2VuZCBhIHdhcm5pbmcgb25seSB2aXNpYmxlIHRvIHRoZSB1c2VyXHJcbiAgICogYXdhaXQgcmVzdC5jcmVhdGVFcGhlbWVyYWxNZXNzYWdlKGd1aWxkSWQsIGNoYW5uZWxJZCwgdGFyZ2V0VXNlcklkLCB7XHJcbiAgICogICBlbWJlZHM6IFt3YXJuaW5nRW1iZWRdXHJcbiAgICogfSk7XHJcbiAgICovXHJcbiAgYXN5bmMgY3JlYXRlRXBoZW1lcmFsTWVzc2FnZShndWlsZElkOiBzdHJpbmcsIGNoYW5uZWxJZDogc3RyaW5nLCB0YXJnZXRVc2VySWQ6IHN0cmluZyB8IG51bWJlciwgZGF0YToge1xyXG4gICAgY29udGVudD86IHN0cmluZztcclxuICAgIGVtYmVkcz86IEFQSUVtYmVkW107XHJcbiAgICBjb21wb25lbnRzPzogYW55W107XHJcbiAgICBmbGFncz86IG51bWJlcjtcclxuICB9KTogUHJvbWlzZTx7IGlkOiBzdHJpbmc7IGVwaGVtZXJhbDogYm9vbGVhbjsgZmxhZ3M6IG51bWJlciB9PiB7XHJcbiAgICAvLyBTRUNVUklUWTogVmFsaWRhdGUgSURzIHRvIHByZXZlbnQgcGF0aCB0cmF2ZXJzYWxcclxuICAgIHZhbGlkYXRlSWQoZ3VpbGRJZCwgJ2d1aWxkSWQnKTtcclxuICAgIHZhbGlkYXRlSWQoY2hhbm5lbElkLCAnY2hhbm5lbElkJyk7XHJcbiAgICB2YWxpZGF0ZUlkKFN0cmluZyh0YXJnZXRVc2VySWQpLCAndGFyZ2V0VXNlcklkJyk7XHJcbiAgICBcclxuICAgIGNvbnN0IG1lc3NhZ2VEYXRhID0gdGhpcy5wcmVwYXJlTWVzc2FnZURhdGEoZGF0YSk7XHJcbiAgICBcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8eyBpZDogc3RyaW5nOyBlcGhlbWVyYWw6IGJvb2xlYW47IGZsYWdzOiBudW1iZXIgfT4oJ1BPU1QnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH0vbWVzc2FnZXNgLCB7XHJcbiAgICAgIC4uLm1lc3NhZ2VEYXRhLFxyXG4gICAgICBmbGFnczogNjQsIC8vIEVQSEVNRVJBTCBmbGFnXHJcbiAgICAgIHRhcmdldF91c2VyX2lkOiB0eXBlb2YgdGFyZ2V0VXNlcklkID09PSAnc3RyaW5nJyA/IHBhcnNlSW50KHRhcmdldFVzZXJJZCwgMTApIDogdGFyZ2V0VXNlcklkXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIERNIG1lc3NhZ2UgdG8gYSB1c2VyXHJcbiAgICogQXV0b21hdGljYWxseSBwcm9jZXNzZXMgZW1iZWRzIChjb252ZXJ0cyBFbWJlZEJ1aWxkZXIgdG8gSlNPTiwgbm9ybWFsaXplcyBjb2xvcnMsIHRpbWVzdGFtcHMsIGV0Yy4pXHJcbiAgICogXHJcbiAgICogQHBhcmFtIHVzZXJJZCAtIFRoZSB1c2VyIElEIHRvIHNlbmQgdGhlIERNIHRvXHJcbiAgICogQHBhcmFtIGRhdGEgLSBNZXNzYWdlIGRhdGEgKGNvbnRlbnQgYW5kL29yIGVtYmVkcyBhbmQvb3IgY29tcG9uZW50cylcclxuICAgKi9cclxuICBhc3luYyBjcmVhdGVETU1lc3NhZ2UodXNlcklkOiBzdHJpbmcsIGRhdGE6IHtcclxuICAgIGNvbnRlbnQ/OiBzdHJpbmc7XHJcbiAgICBlbWJlZHM/OiBBUElFbWJlZFtdO1xyXG4gICAgY29tcG9uZW50cz86IGFueVtdO1xyXG4gICAgZmxhZ3M/OiBudW1iZXI7XHJcbiAgfSk6IFByb21pc2U8QVBJTWVzc2FnZT4ge1xyXG4gICAgY29uc3QgcHJvY2Vzc2VkRGF0YSA9IHRoaXMucHJlcGFyZU1lc3NhZ2VEYXRhKGRhdGEpO1xyXG4gICAgLy8gU2VuZCB0byAvYm90L2RtIHdpdGggcmVjaXBpZW50X3VzZXJfaWQgaW4gYm9keVxyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBUElNZXNzYWdlPignUE9TVCcsIGAvYm90L2RtYCwge1xyXG4gICAgICAuLi5wcm9jZXNzZWREYXRhLFxyXG4gICAgICByZWNpcGllbnRfdXNlcl9pZDogdXNlcklkXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIERNIG1lc3NhZ2UgdG8gYW4gZXhpc3RpbmcgRE0gY2hhbm5lbFxyXG4gICAqIFVzZSB0aGlzIHdoZW4geW91IGFscmVhZHkgaGF2ZSBhIGNoYW5uZWwgSURcclxuICAgKi9cclxuICBhc3luYyBjcmVhdGVETU1lc3NhZ2VUb0NoYW5uZWwoY2hhbm5lbElkOiBzdHJpbmcsIGRhdGE6IHtcclxuICAgIGNvbnRlbnQ/OiBzdHJpbmc7XHJcbiAgICBlbWJlZHM/OiBBUElFbWJlZFtdO1xyXG4gICAgY29tcG9uZW50cz86IGFueVtdO1xyXG4gICAgZmxhZ3M/OiBudW1iZXI7XHJcbiAgfSk6IFByb21pc2U8QVBJTWVzc2FnZT4ge1xyXG4gICAgY29uc3QgcHJvY2Vzc2VkRGF0YSA9IHRoaXMucHJlcGFyZU1lc3NhZ2VEYXRhKGRhdGEpO1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBUElNZXNzYWdlPignUE9TVCcsIGAvYm90L2RtLyR7Y2hhbm5lbElkfWAsIHByb2Nlc3NlZERhdGEpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgRE0gbWVzc2FnZSB3aXRoIGZpbGUgYXR0YWNobWVudFxyXG4gICAqIERNIGnDp2luIGZpbGUgKyBlbWJlZCBkZXN0ZcSfaVxyXG4gICAqL1xyXG4gIGFzeW5jIGNyZWF0ZURNTWVzc2FnZVdpdGhGaWxlKHVzZXJJZDogc3RyaW5nLCBkYXRhOiB7XHJcbiAgICBjb250ZW50Pzogc3RyaW5nO1xyXG4gICAgZW1iZWRzPzogQVBJRW1iZWRbXTtcclxuICAgIGNvbXBvbmVudHM/OiBhbnlbXTtcclxuICAgIGZsYWdzPzogbnVtYmVyO1xyXG4gIH0sIGZpbGVzOiBBcnJheTx7IG5hbWU6IHN0cmluZzsgZGF0YTogQnVmZmVyIHwgc3RyaW5nOyBjb250ZW50VHlwZT86IHN0cmluZyB9Pik6IFByb21pc2U8QVBJTWVzc2FnZT4ge1xyXG4gICAgcmV0dXJuIHRoaXMuc2VuZERNRmlsZXMoJy9ib3QvZG0nLCBkYXRhLCBmaWxlcywgdXNlcklkKTtcclxuICB9XHJcblxyXG4gIC8qKiBTZW5kIGF0dGFjaG1lbnRzIHRvIGFuIGV4aXN0aW5nIERNIGNoYW5uZWwgd2l0aG91dCByZXF1aXJpbmcgYSByZWNpcGllbnQgSUQuICovXHJcbiAgYXN5bmMgY3JlYXRlRE1NZXNzYWdlVG9DaGFubmVsV2l0aEZpbGUoY2hhbm5lbElkOiBzdHJpbmcsIGRhdGE6IHtcclxuICAgIGNvbnRlbnQ/OiBzdHJpbmc7IGVtYmVkcz86IEFQSUVtYmVkW107IGZsYWdzPzogbnVtYmVyOyBjb21wb25lbnRzPzogYW55W107XHJcbiAgfSwgZmlsZXM6IEFycmF5PHsgbmFtZTogc3RyaW5nOyBkYXRhOiBCdWZmZXIgfCBzdHJpbmc7IGNvbnRlbnRUeXBlPzogc3RyaW5nIH0+KTogUHJvbWlzZTxBUElNZXNzYWdlPiB7XHJcbiAgICB2YWxpZGF0ZUlkKGNoYW5uZWxJZCwgJ2NoYW5uZWxJZCcpO1xyXG4gICAgcmV0dXJuIHRoaXMuc2VuZERNRmlsZXMoJy9ib3QvZG0vJyArIGNoYW5uZWxJZCwgZGF0YSwgZmlsZXMpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhc3luYyBzZW5kRE1GaWxlcyhwYXRoOiBzdHJpbmcsIGRhdGE6IHsgY29udGVudD86IHN0cmluZzsgZW1iZWRzPzogQVBJRW1iZWRbXTsgZmxhZ3M/OiBudW1iZXI7IGNvbXBvbmVudHM/OiBhbnlbXSB9LFxyXG4gICAgZmlsZXM6IEFycmF5PHsgbmFtZTogc3RyaW5nOyBkYXRhOiBCdWZmZXIgfCBzdHJpbmc7IGNvbnRlbnRUeXBlPzogc3RyaW5nIH0+LCB1c2VySWQ/OiBzdHJpbmcpOiBQcm9taXNlPEFQSU1lc3NhZ2U+IHtcclxuICAgIGNvbnN0IEZvcm1EYXRhID0gcmVxdWlyZSgnZm9ybS1kYXRhJyk7XHJcbiAgICBjb25zdCBmb3JtID0gbmV3IEZvcm1EYXRhKCk7XHJcbiAgICBkYXRhID0geyAuLi5kYXRhLCAuLi50aGlzLnByZXBhcmVNZXNzYWdlRGF0YShkYXRhKSB9O1xyXG4gICAgaWYgKGRhdGEuZmxhZ3MgIT09IHVuZGVmaW5lZCkgZm9ybS5hcHBlbmQoJ2ZsYWdzJywgU3RyaW5nKGRhdGEuZmxhZ3MpKTtcclxuXHJcbiAgICAvLyBBZGQgcmVjaXBpZW50X3VzZXJfaWRcclxuICAgIGlmICh1c2VySWQgIT09IHVuZGVmaW5lZCkgZm9ybS5hcHBlbmQoJ3JlY2lwaWVudF91c2VyX2lkJywgdXNlcklkKTtcclxuXHJcbiAgICAvLyBBZGQgY29udGVudCBpZiBwcm92aWRlZFxyXG4gICAgaWYgKGRhdGEuY29udGVudCkge1xyXG4gICAgICBmb3JtLmFwcGVuZCgnY29udGVudCcsIGRhdGEuY29udGVudCk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gQWRkIGVtYmVkcyBpZiBwcm92aWRlZCAoSlNPTiBzdHJpbmdpZmllZClcclxuICAgIGlmIChkYXRhLmVtYmVkcyAmJiBkYXRhLmVtYmVkcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgIGNvbnN0IHByb2Nlc3NlZEVtYmVkcyA9IGRhdGEuZW1iZWRzLm1hcChlbWJlZCA9PiBub3JtYWxpemVFbWJlZChlbWJlZCkpO1xyXG4gICAgICBmb3JtLmFwcGVuZCgnZW1iZWRzJywgSlNPTi5zdHJpbmdpZnkocHJvY2Vzc2VkRW1iZWRzKSk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gQWRkIGNvbXBvbmVudHMgaWYgcHJvdmlkZWQgKEpTT04gc3RyaW5naWZpZWQpXHJcbiAgICBpZiAoZGF0YS5jb21wb25lbnRzICYmIGRhdGEuY29tcG9uZW50cy5sZW5ndGggPiAwKSB7XHJcbiAgICAgIGNvbnN0IHByb2Nlc3NlZENvbXBvbmVudHMgPSBzZXJpYWxpemVDb21wb25lbnRzKGRhdGEuY29tcG9uZW50cyk7XHJcbiAgICAgIGZvcm0uYXBwZW5kKCdjb21wb25lbnRzJywgSlNPTi5zdHJpbmdpZnkocHJvY2Vzc2VkQ29tcG9uZW50cykpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIEFkZCBmaWxlc1xyXG4gICAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XHJcbiAgICAgIGNvbnN0IGZpbGVEYXRhID0gdHlwZW9mIGZpbGUuZGF0YSA9PT0gJ3N0cmluZycgPyBCdWZmZXIuZnJvbShmaWxlLmRhdGEpIDogZmlsZS5kYXRhO1xyXG4gICAgICBmb3JtLmFwcGVuZCgnZmlsZXMnLCBmaWxlRGF0YSwge1xyXG4gICAgICAgIGZpbGVuYW1lOiBmaWxlLm5hbWUsXHJcbiAgICAgICAgY29udGVudFR5cGU6IGZpbGUuY29udGVudFR5cGUgfHwgJ2FwcGxpY2F0aW9uL29jdGV0LXN0cmVhbSdcclxuICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdEJvZHk8QVBJTWVzc2FnZT4oJ1BPU1QnLCBwYXRoLCBmb3JtLmdldEJ1ZmZlcigpLCBmb3JtLmdldEhlYWRlcnMoKSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBFZGl0IGEgbWVzc2FnZVxyXG4gICAqIEF1dG9tYXRpY2FsbHkgcHJvY2Vzc2VzIG1lbnRpb25zXHJcbiAgICovXHJcbiAgYXN5bmMgZWRpdE1lc3NhZ2UoZ3VpbGRJZDogc3RyaW5nLCBjaGFubmVsSWQ6IHN0cmluZywgbWVzc2FnZUlkOiBzdHJpbmcsIGRhdGE6IHtcclxuICAgIGNvbnRlbnQ/OiBzdHJpbmc7XHJcbiAgICBlbWJlZHM/OiBBUElFbWJlZFtdO1xyXG4gICAgY29tcG9uZW50cz86IGFueVtdO1xyXG4gICAgZmxhZ3M/OiBudW1iZXI7XHJcbiAgICBtZW50aW9ucz86IE1lbnRpb25zRGF0YTtcclxuICB9KTogUHJvbWlzZTxBUElNZXNzYWdlPiB7XHJcbiAgICAvLyBTRUNVUklUWTogVmFsaWRhdGUgSURzIHRvIHByZXZlbnQgcGF0aCB0cmF2ZXJzYWxcclxuICAgIHZhbGlkYXRlSWQoZ3VpbGRJZCwgJ2d1aWxkSWQnKTtcclxuICAgIHZhbGlkYXRlSWQoY2hhbm5lbElkLCAnY2hhbm5lbElkJyk7XHJcbiAgICB2YWxpZGF0ZUlkKG1lc3NhZ2VJZCwgJ21lc3NhZ2VJZCcpO1xyXG4gICAgXHJcbiAgICBjb25zdCBwYXRoID0gYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vY2hhbm5lbHMvJHtjaGFubmVsSWR9L21lc3NhZ2VzLyR7bWVzc2FnZUlkfWA7XHJcbiAgICBjb25zdCBwcm9jZXNzZWREYXRhID0gdGhpcy5wcmVwYXJlTWVzc2FnZURhdGEoZGF0YSk7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PEFQSU1lc3NhZ2U+KCdQQVRDSCcsIHBhdGgsIHByb2Nlc3NlZERhdGEpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVsZXRlIGEgbWVzc2FnZVxyXG4gICAqL1xyXG4gIGFzeW5jIGRlbGV0ZU1lc3NhZ2UoZ3VpbGRJZDogc3RyaW5nLCBjaGFubmVsSWQ6IHN0cmluZywgbWVzc2FnZUlkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIC8vIFNFQ1VSSVRZOiBWYWxpZGF0ZSBJRHMgdG8gcHJldmVudCBwYXRoIHRyYXZlcnNhbFxyXG4gICAgdmFsaWRhdGVJZChndWlsZElkLCAnZ3VpbGRJZCcpO1xyXG4gICAgdmFsaWRhdGVJZChjaGFubmVsSWQsICdjaGFubmVsSWQnKTtcclxuICAgIHZhbGlkYXRlSWQobWVzc2FnZUlkLCAnbWVzc2FnZUlkJyk7XHJcbiAgICBcclxuICAgIGNvbnN0IHBhdGggPSBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH0vbWVzc2FnZXMvJHttZXNzYWdlSWR9YDtcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdDx2b2lkPignREVMRVRFJywgcGF0aCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBWYWxpZGF0ZSBhbmQgbm9ybWFsaXplIGVtb2ppIGZvcm1hdCBmb3IgdGhlIEFQSS5cclxuICAgKiBDb252ZXJ0cyB1bmljb2RlIGVtb2ppIHRvIHNob3J0Y29kZSBmb3JtYXQuXHJcbiAgICogQWNjZXB0ZWQgZm9ybWF0czogXHJcbiAgICogLSBVbmljb2RlIGVtb2ppIGNoYXJhY3RlcnMgKPCfkY0sIOKdpO+4jywgZXRjLikg4oaSIGNvbnZlcnRlZCB0byA6c2hvcnRjb2RlOlxyXG4gICAqIC0gOm5hbWU6IGZvcm1hdCAoc2hvcnRjb2RlKVxyXG4gICAqIC0gPDpuYW1lOmlkPiBvciA8YTpuYW1lOmlkPiBmb3IgY3VzdG9tIGVtb2ppXHJcbiAgICovXHJcbiAgcHJpdmF0ZSB2YWxpZGF0ZUVtb2ppKGVtb2ppOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgLy8gSW1wb3J0IGxhemlseSB0byBhdm9pZCBjaXJjdWxhciBkZXBlbmRlbmNpZXNcclxuICAgIGNvbnN0IHsgbm9ybWFsaXplRW1vamkgfSA9IHJlcXVpcmUoJy4uL3V0aWxzL2Vtb2ppVXRpbHMnKTtcclxuICAgIHJldHVybiBub3JtYWxpemVFbW9qaShlbW9qaSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBZGQgYSByZWFjdGlvbiB0byBhIG1lc3NhZ2VcclxuICAgKiBAcGFyYW0gZW1vamkgLSBVbmljb2RlIGVtb2ppICjwn5GNKSwgOm5hbWU6LCA8Om5hbWU6aWQ+LCBvciA8YTpuYW1lOmlkPiBmb3JtYXRcclxuICAgKiBcclxuICAgKiBAZXhhbXBsZVxyXG4gICAqIC8vIFVuaWNvZGUgZW1vamkgKGF1dG9tYXRpY2FsbHkgY29udmVydGVkIHRvIHNob3J0Y29kZSlcclxuICAgKiBhd2FpdCByZXN0LmFkZFJlYWN0aW9uKGd1aWxkSWQsIGNoYW5uZWxJZCwgbWVzc2FnZUlkLCAn8J+RjScpO1xyXG4gICAqIFxyXG4gICAqIC8vIFNob3J0Y29kZSBmb3JtYXRcclxuICAgKiBhd2FpdCByZXN0LmFkZFJlYWN0aW9uKGd1aWxkSWQsIGNoYW5uZWxJZCwgbWVzc2FnZUlkLCAnOnRodW1ic3VwOicpO1xyXG4gICAqIFxyXG4gICAqIC8vIEN1c3RvbSBlbW9qaVxyXG4gICAqIGF3YWl0IHJlc3QuYWRkUmVhY3Rpb24oZ3VpbGRJZCwgY2hhbm5lbElkLCBtZXNzYWdlSWQsICc8OmN1c3RvbToxMjM0NTY+Jyk7XHJcbiAgICovXHJcbiAgYXN5bmMgYWRkUmVhY3Rpb24oZ3VpbGRJZDogc3RyaW5nLCBjaGFubmVsSWQ6IHN0cmluZywgbWVzc2FnZUlkOiBzdHJpbmcsIGVtb2ppOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIC8vIFNFQ1VSSVRZOiBWYWxpZGF0ZSBJRHMgdG8gcHJldmVudCBwYXRoIHRyYXZlcnNhbFxyXG4gICAgdmFsaWRhdGVJZChndWlsZElkLCAnZ3VpbGRJZCcpO1xyXG4gICAgdmFsaWRhdGVJZChjaGFubmVsSWQsICdjaGFubmVsSWQnKTtcclxuICAgIHZhbGlkYXRlSWQobWVzc2FnZUlkLCAnbWVzc2FnZUlkJyk7XHJcbiAgICBcclxuICAgIGNvbnN0IHZhbGlkYXRlZCA9IHRoaXMudmFsaWRhdGVFbW9qaShlbW9qaSk7XHJcbiAgICBjb25zdCBwYXRoID0gYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vY2hhbm5lbHMvJHtjaGFubmVsSWR9L21lc3NhZ2VzLyR7bWVzc2FnZUlkfS9yZWFjdGlvbnMvJHtlbmNvZGVVUklDb21wb25lbnQodmFsaWRhdGVkKX0vQG1lYDtcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdDx2b2lkPignUFVUJywgcGF0aCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZW1vdmUgYSByZWFjdGlvbiBmcm9tIGEgbWVzc2FnZVxyXG4gICAqIEBwYXJhbSBlbW9qaSAtIFVuaWNvZGUgZW1vamkgKPCfkY0pLCA6bmFtZTosIDw6bmFtZTppZD4sIG9yIDxhOm5hbWU6aWQ+IGZvcm1hdFxyXG4gICAqL1xyXG4gIGFzeW5jIHJlbW92ZVJlYWN0aW9uKGd1aWxkSWQ6IHN0cmluZywgY2hhbm5lbElkOiBzdHJpbmcsIG1lc3NhZ2VJZDogc3RyaW5nLCBlbW9qaTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICAvLyBTRUNVUklUWTogVmFsaWRhdGUgSURzIHRvIHByZXZlbnQgcGF0aCB0cmF2ZXJzYWxcclxuICAgIHZhbGlkYXRlSWQoZ3VpbGRJZCwgJ2d1aWxkSWQnKTtcclxuICAgIHZhbGlkYXRlSWQoY2hhbm5lbElkLCAnY2hhbm5lbElkJyk7XHJcbiAgICB2YWxpZGF0ZUlkKG1lc3NhZ2VJZCwgJ21lc3NhZ2VJZCcpO1xyXG4gICAgXHJcbiAgICBjb25zdCB2YWxpZGF0ZWQgPSB0aGlzLnZhbGlkYXRlRW1vamkoZW1vamkpO1xyXG4gICAgY29uc3QgcGF0aCA9IGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS9tZXNzYWdlcy8ke21lc3NhZ2VJZH0vcmVhY3Rpb25zLyR7ZW5jb2RlVVJJQ29tcG9uZW50KHZhbGlkYXRlZCl9L0BtZWA7XHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3Q8dm9pZD4oJ0RFTEVURScsIHBhdGgpO1xyXG4gIH1cclxuXHJcblxyXG4gIC8qKlxyXG4gICAqIFVwbG9hZCBhbiBhdHRhY2htZW50IHRvIGEgY2hhbm5lbFxyXG4gICAqL1xyXG4gIGFzeW5jIHVwbG9hZEF0dGFjaG1lbnQoZ3VpbGRJZDogc3RyaW5nLCBjaGFubmVsSWQ6IHN0cmluZywgZmlsZTogeyBuYW1lOiBzdHJpbmc7IGRhdGE6IEJ1ZmZlcjsgY29udGVudFR5cGU/OiBzdHJpbmcgfSk6IFByb21pc2U8eyBpZDogc3RyaW5nOyB1cmw6IHN0cmluZzsgZmlsZW5hbWU6IHN0cmluZyB9PiB7XHJcbiAgICBjb25zdCBGb3JtRGF0YSA9IHJlcXVpcmUoJ2Zvcm0tZGF0YScpO1xyXG4gICAgY29uc3QgZm9ybSA9IG5ldyBGb3JtRGF0YSgpO1xyXG4gICAgXHJcbiAgICAvLyBmb3JtLWRhdGEgZXhwZWN0cyB0aGUgYnVmZmVyIGRpcmVjdGx5IHdpdGggb3B0aW9uc1xyXG4gICAgZm9ybS5hcHBlbmQoJ2ZpbGUnLCBmaWxlLmRhdGEsIHtcclxuICAgICAgZmlsZW5hbWU6IGZpbGUubmFtZSxcclxuICAgICAgY29udGVudFR5cGU6IGZpbGUuY29udGVudFR5cGUgfHwgJ3RleHQvcGxhaW4nXHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdEJvZHk8eyBpZDogc3RyaW5nOyB1cmw6IHN0cmluZzsgZmlsZW5hbWU6IHN0cmluZyB9PignUE9TVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS9hdHRhY2htZW50c2AsIGZvcm0uZ2V0QnVmZmVyKCksIGZvcm0uZ2V0SGVhZGVycygpKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIG1lc3NhZ2Ugd2l0aCBhIGZpbGUgYXR0YWNobWVudFxyXG4gICAqIGVtYmVkcyB2ZSBjb21wb25lbnRzIGRlc3RlxJ9pIGVrbGVuZGlcclxuICAgKi9cclxuICBhc3luYyBjcmVhdGVNZXNzYWdlV2l0aEZpbGUoZ3VpbGRJZDogc3RyaW5nLCBjaGFubmVsSWQ6IHN0cmluZywgZGF0YToge1xyXG4gICAgY29udGVudD86IHN0cmluZztcclxuICAgIGVtYmVkcz86IEFQSUVtYmVkW107XHJcbiAgICBjb21wb25lbnRzPzogYW55W107XHJcbiAgICBmbGFncz86IG51bWJlcjtcclxuICAgIGZpbGU6IHsgbmFtZTogc3RyaW5nOyBkYXRhOiBCdWZmZXI7IGNvbnRlbnRUeXBlPzogc3RyaW5nIH07XHJcbiAgICBpbnRlcmFjdGlvbklkPzogc3RyaW5nO1xyXG4gIH0pOiBQcm9taXNlPEFQSU1lc3NhZ2U+IHtcclxuICAgIGNvbnN0IEZvcm1EYXRhID0gcmVxdWlyZSgnZm9ybS1kYXRhJyk7XHJcbiAgICBjb25zdCBmb3JtID0gbmV3IEZvcm1EYXRhKCk7XHJcbiAgICBkYXRhID0geyAuLi5kYXRhLCAuLi50aGlzLnByZXBhcmVNZXNzYWdlRGF0YShkYXRhKSB9O1xyXG4gICAgaWYgKGRhdGEuZmxhZ3MgIT09IHVuZGVmaW5lZCkgZm9ybS5hcHBlbmQoJ2ZsYWdzJywgU3RyaW5nKGRhdGEuZmxhZ3MpKTtcclxuICAgIFxyXG4gICAgLy8gQWRkIGNvbnRlbnQgaWYgcHJvdmlkZWRcclxuICAgIGlmIChkYXRhLmNvbnRlbnQpIHtcclxuICAgICAgZm9ybS5hcHBlbmQoJ2NvbnRlbnQnLCBkYXRhLmNvbnRlbnQpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvLyBBZGQgZW1iZWRzIGlmIHByb3ZpZGVkIChKU09OIHN0cmluZ2lmaWVkKVxyXG4gICAgaWYgKGRhdGEuZW1iZWRzICYmIGRhdGEuZW1iZWRzLmxlbmd0aCA+IDApIHtcclxuICAgICAgLy8gUHJvY2VzcyBlbWJlZHMgdXNpbmcgc2hhcmVkIG5vcm1hbGl6ZUVtYmVkXHJcbiAgICAgIGNvbnN0IHByb2Nlc3NlZEVtYmVkcyA9IGRhdGEuZW1iZWRzLm1hcChlbWJlZCA9PiBub3JtYWxpemVFbWJlZChlbWJlZCkpO1xyXG4gICAgICBpZiAocHJvY2Vzcy5lbnYuREVCVUdfUkVTVCkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGBbUkVTVF0gY3JlYXRlTWVzc2FnZVdpdGhGaWxlOiBhcHBlbmRpbmcgJHtwcm9jZXNzZWRFbWJlZHMubGVuZ3RofSBlbWJlZHNgKTtcclxuICAgICAgfVxyXG4gICAgICBmb3JtLmFwcGVuZCgnZW1iZWRzJywgSlNPTi5zdHJpbmdpZnkocHJvY2Vzc2VkRW1iZWRzKSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBpZiAocHJvY2Vzcy5lbnYuREVCVUdfUkVTVCkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGBbUkVTVF0gY3JlYXRlTWVzc2FnZVdpdGhGaWxlOiBubyBlbWJlZHMgcHJvdmlkZWQgKGVtYmVkcz0ke2RhdGEuZW1iZWRzfSlgKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvLyBBZGQgY29tcG9uZW50cyBpZiBwcm92aWRlZCAoSlNPTiBzdHJpbmdpZmllZClcclxuICAgIGlmIChkYXRhLmNvbXBvbmVudHMgJiYgZGF0YS5jb21wb25lbnRzLmxlbmd0aCA+IDApIHtcclxuICAgICAgY29uc3QgcHJvY2Vzc2VkQ29tcG9uZW50cyA9IHNlcmlhbGl6ZUNvbXBvbmVudHMoZGF0YS5jb21wb25lbnRzKTtcclxuICAgICAgZm9ybS5hcHBlbmQoJ2NvbXBvbmVudHMnLCBKU09OLnN0cmluZ2lmeShwcm9jZXNzZWRDb21wb25lbnRzKSk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIEFkZCBpbnRlcmFjdGlvbl9pZCBpZiBwcm92aWRlZCAoZm9yIGRlZmVycmVkIHJlc3BvbnNlIG1hdGNoaW5nKVxyXG4gICAgaWYgKGRhdGEuaW50ZXJhY3Rpb25JZCkge1xyXG4gICAgICBmb3JtLmFwcGVuZCgnaW50ZXJhY3Rpb25faWQnLCBkYXRhLmludGVyYWN0aW9uSWQpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvLyBBZGQgZmlsZVxyXG4gICAgZm9ybS5hcHBlbmQoJ2ZpbGVzJywgZGF0YS5maWxlLmRhdGEsIHtcclxuICAgICAgZmlsZW5hbWU6IGRhdGEuZmlsZS5uYW1lLFxyXG4gICAgICBjb250ZW50VHlwZTogZGF0YS5maWxlLmNvbnRlbnRUeXBlIHx8ICd0ZXh0L3BsYWluJ1xyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3RCb2R5PEFQSU1lc3NhZ2U+KCdQT1NUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vY2hhbm5lbHMvJHtjaGFubmVsSWR9L21lc3NhZ2VzYCwgZm9ybS5nZXRCdWZmZXIoKSwgZm9ybS5nZXRIZWFkZXJzKCkpO1xyXG4gIH1cclxuXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT0gSW50ZXJhY3Rpb25zID09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhbiBpbnRlcmFjdGlvbiByZXNwb25zZVxyXG4gICAqIEF1dG9tYXRpY2FsbHkgcHJvY2Vzc2VzIG1lbnRpb25zIGluIGNvbnRlbnQgYW5kIGVtYmVkc1xyXG4gICAqL1xyXG4gIGFzeW5jIGNyZWF0ZUludGVyYWN0aW9uUmVzcG9uc2UoaW50ZXJhY3Rpb25JZDogc3RyaW5nLCB0b2tlbjogc3RyaW5nLCBkYXRhOiB7XHJcbiAgICB0eXBlOiBudW1iZXI7XHJcbiAgICBkYXRhPzogYW55O1xyXG4gIH0pOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGlmIChwcm9jZXNzLmVudi5ERUJVR19SRVNUKSB7XHJcbiAgICAgIGNvbnNvbGUubG9nKGDwn5OkIEludGVyYWN0aW9uIHJlc3BvbnNlOiAke2ludGVyYWN0aW9uSWR9IC0+IHR5cGUgJHtkYXRhLnR5cGV9YCk7XHJcbiAgICB9XHJcbiAgICB0cnkge1xyXG4gICAgICAvLyBQcm9jZXNzIG1lbnRpb25zIGluIHJlc3BvbnNlIGRhdGEgaWYgcHJlc2VudFxyXG4gICAgICBsZXQgcHJvY2Vzc2VkRGF0YSA9IGRhdGE7XHJcbiAgICAgIGlmIChkYXRhLmRhdGEgJiYgKGRhdGEuZGF0YS5jb250ZW50ICE9PSB1bmRlZmluZWQgfHwgZGF0YS5kYXRhLmVtYmVkcyB8fCBkYXRhLmRhdGEuY29tcG9uZW50cykpIHtcclxuICAgICAgICBwcm9jZXNzZWREYXRhID0ge1xyXG4gICAgICAgICAgLi4uZGF0YSxcclxuICAgICAgICAgIGRhdGE6IHRoaXMucHJlcGFyZU1lc3NhZ2VEYXRhKGRhdGEuZGF0YSlcclxuICAgICAgICB9O1xyXG4gICAgICB9XHJcbiAgICAgIFxyXG4gICAgICBhd2FpdCB0aGlzLnJlcXVlc3Q8dm9pZD4oJ1BPU1QnLCBgL2ludGVyYWN0aW9ucy8ke2ludGVyYWN0aW9uSWR9LyR7dG9rZW59L2NhbGxiYWNrYCwgcHJvY2Vzc2VkRGF0YSk7XHJcbiAgICAgIGlmIChwcm9jZXNzLmVudi5ERUJVR19SRVNUKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coYOKchSBJbnRlcmFjdGlvbiByZXNwb25zZSBzZW50YCk7XHJcbiAgICAgIH1cclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIGlmIChwcm9jZXNzLmVudi5ERUJVR19SRVNUKSBjb25zb2xlLmVycm9yKCdJbnRlcmFjdGlvbiByZXNwb25zZSBmYWlsZWQnKTtcclxuICAgICAgdGhyb3cgZXJyb3I7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBFZGl0IHRoZSBvcmlnaW5hbCBpbnRlcmFjdGlvbiByZXNwb25zZVxyXG4gICAqIElmIGZpbGVzIGFyZSBwcm92aWRlZCwgY3JlYXRlcyBhIG5ldyBtZXNzYWdlIHdpdGggZmlsZXMgKHNpbmNlIHdlYmhvb2sgZWRpdCBkb2Vzbid0IHN1cHBvcnQgZmlsZSB1cGxvYWQpXHJcbiAgICogQXV0b21hdGljYWxseSBwcm9jZXNzZXMgbWVudGlvbnNcclxuICAgKi9cclxuICBhc3luYyBlZGl0SW50ZXJhY3Rpb25SZXNwb25zZSh0b2tlbjogc3RyaW5nLCBkYXRhOiB7XHJcbiAgICBjb250ZW50Pzogc3RyaW5nO1xyXG4gICAgZW1iZWRzPzogQVBJRW1iZWRbXTtcclxuICAgIGNvbXBvbmVudHM/OiBhbnlbXTtcclxuICAgIGZsYWdzPzogbnVtYmVyO1xyXG4gICAgbWVudGlvbnM/OiBNZW50aW9uc0RhdGE7XHJcbiAgICBmaWxlcz86IEFycmF5PHsgbmFtZTogc3RyaW5nOyBkYXRhOiBCdWZmZXI7IGNvbnRlbnRUeXBlPzogc3RyaW5nIH0+O1xyXG4gIH0sIGd1aWxkSWQ/OiBzdHJpbmcsIGNoYW5uZWxJZD86IHN0cmluZywgaW50ZXJhY3Rpb25JZD86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgYXBwSWQgPSB0aGlzLmdldEFwcGxpY2F0aW9uSWQoKTtcclxuICAgIFxyXG4gICAgLy8gUHJvY2VzcyBtZW50aW9ucyBpbiBjb250ZW50XHJcbiAgICBjb25zdCBwcm9jZXNzZWREYXRhID0gdGhpcy5wcmVwYXJlTWVzc2FnZURhdGEoZGF0YSk7XHJcbiAgICBcclxuICAgIC8vIElmIGZpbGVzIGFyZSBwcmVzZW50IGFuZCB3ZSBoYXZlIGd1aWxkL2NoYW5uZWwgaW5mbywgY3JlYXRlIG1lc3NhZ2Ugd2l0aCBmaWxlIGluc3RlYWRcclxuICAgIGlmIChkYXRhLmZpbGVzICYmIGRhdGEuZmlsZXMubGVuZ3RoID4gMCAmJiBndWlsZElkICYmIGNoYW5uZWxJZCkge1xyXG4gICAgICBpZiAocHJvY2Vzcy5lbnYuREVCVUdfUkVTVCkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGBbUkVTVF0gZWRpdEludGVyYWN0aW9uUmVzcG9uc2Ugd2l0aCAke2RhdGEuZmlsZXMubGVuZ3RofSBmaWxlcyAtIHVzaW5nIGNyZWF0ZU1lc3NhZ2VXaXRoRmlsZWApO1xyXG4gICAgICB9XHJcbiAgICAgIFxyXG4gICAgICAvLyBDcmVhdGUgbWVzc2FnZSB3aXRoIGZpbGUgLSBlbWJlZHMgdmUgY29tcG9uZW50cyBkYSBnZcOnaXJpbGl5b3JcclxuICAgICAgY29uc3QgZmlsZSA9IGRhdGEuZmlsZXNbMF07IC8vIEZvciBub3csIHN1cHBvcnQgc2luZ2xlIGZpbGVcclxuICAgICAgYXdhaXQgdGhpcy5jcmVhdGVNZXNzYWdlV2l0aEZpbGUoZ3VpbGRJZCwgY2hhbm5lbElkLCB7XHJcbiAgICAgICAgY29udGVudDogcHJvY2Vzc2VkRGF0YS5jb250ZW50LFxyXG4gICAgICAgIGVtYmVkczogcHJvY2Vzc2VkRGF0YS5lbWJlZHMsXHJcbiAgICAgICAgY29tcG9uZW50czogcHJvY2Vzc2VkRGF0YS5jb21wb25lbnRzLFxyXG4gICAgICAgIGZpbGU6IGZpbGUsXHJcbiAgICAgICAgaW50ZXJhY3Rpb25JZDogaW50ZXJhY3Rpb25JZFxyXG4gICAgICB9KTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvLyBJZiB3ZSBoYXZlIGd1aWxkSWQsIGNoYW5uZWxJZCBhbmQgaW50ZXJhY3Rpb25JZCwgY3JlYXRlIGEgbmV3IG1lc3NhZ2Ugd2l0aCBpbnRlcmFjdGlvbl9pZFxyXG4gICAgLy8gVGhpcyBpcyBuZWVkZWQgYmVjYXVzZSBvdXIgZGVmZXJyZWQgcmVzcG9uc2UgZG9lc24ndCBjcmVhdGUgYSBtZXNzYWdlXHJcbiAgICBpZiAoZ3VpbGRJZCAmJiBjaGFubmVsSWQgJiYgaW50ZXJhY3Rpb25JZCkge1xyXG4gICAgICBpZiAocHJvY2Vzcy5lbnYuREVCVUdfUkVTVCkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGBbUkVTVF0gZWRpdEludGVyYWN0aW9uUmVzcG9uc2UgLSBjcmVhdGluZyBtZXNzYWdlIHdpdGggaW50ZXJhY3Rpb25faWQ6ICR7aW50ZXJhY3Rpb25JZH1gKTtcclxuICAgICAgfVxyXG4gICAgICBcclxuICAgICAgY29uc3QgcGF5bG9hZDogYW55ID0ge1xyXG4gICAgICAgIGludGVyYWN0aW9uX2lkOiBpbnRlcmFjdGlvbklkXHJcbiAgICAgIH07XHJcbiAgICAgIGlmIChwcm9jZXNzZWREYXRhLmZsYWdzICE9PSB1bmRlZmluZWQpIHBheWxvYWQuZmxhZ3MgPSBwcm9jZXNzZWREYXRhLmZsYWdzO1xyXG4gICAgaWYgKHByb2Nlc3NlZERhdGEuY29udGVudCAhPT0gdW5kZWZpbmVkKSBwYXlsb2FkLmNvbnRlbnQgPSBwcm9jZXNzZWREYXRhLmNvbnRlbnQ7XHJcbiAgICAgIGlmIChwcm9jZXNzZWREYXRhLmVtYmVkcykgcGF5bG9hZC5lbWJlZHMgPSBwcm9jZXNzZWREYXRhLmVtYmVkcztcclxuICAgICAgaWYgKHByb2Nlc3NlZERhdGEuY29tcG9uZW50cykgcGF5bG9hZC5jb21wb25lbnRzID0gcHJvY2Vzc2VkRGF0YS5jb21wb25lbnRzO1xyXG4gICAgICBpZiAocHJvY2Vzc2VkRGF0YS5tZW50aW9ucykgcGF5bG9hZC5tZW50aW9ucyA9IHByb2Nlc3NlZERhdGEubWVudGlvbnM7XHJcbiAgICAgIFxyXG4gICAgICBhd2FpdCB0aGlzLnJlcXVlc3Q8dm9pZD4oJ1BPU1QnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH0vbWVzc2FnZXNgLCBwYXlsb2FkKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvLyBGYWxsYmFjazogUmVndWxhciBlZGl0IHdpdGhvdXQgZmlsZXMgKHdlYmhvb2sgUEFUQ0gpXHJcbiAgICBjb25zdCBwYXlsb2FkOiBhbnkgPSB7fTtcclxuICAgIGlmIChwcm9jZXNzZWREYXRhLmZsYWdzICE9PSB1bmRlZmluZWQpIHBheWxvYWQuZmxhZ3MgPSBwcm9jZXNzZWREYXRhLmZsYWdzO1xyXG4gICAgaWYgKHByb2Nlc3NlZERhdGEuY29udGVudCAhPT0gdW5kZWZpbmVkKSBwYXlsb2FkLmNvbnRlbnQgPSBwcm9jZXNzZWREYXRhLmNvbnRlbnQ7XHJcbiAgICBpZiAocHJvY2Vzc2VkRGF0YS5lbWJlZHMpIHBheWxvYWQuZW1iZWRzID0gcHJvY2Vzc2VkRGF0YS5lbWJlZHM7XHJcbiAgICBpZiAocHJvY2Vzc2VkRGF0YS5jb21wb25lbnRzKSBwYXlsb2FkLmNvbXBvbmVudHMgPSBwcm9jZXNzZWREYXRhLmNvbXBvbmVudHM7XHJcbiAgICBpZiAocHJvY2Vzc2VkRGF0YS5tZW50aW9ucykgcGF5bG9hZC5tZW50aW9ucyA9IHByb2Nlc3NlZERhdGEubWVudGlvbnM7XHJcbiAgICBcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdDx2b2lkPignUEFUQ0gnLCBgL2ludGVyYWN0aW9ucy93ZWJob29rcy8ke2FwcElkfS8ke3Rva2VufS9tZXNzYWdlcy9Ab3JpZ2luYWxgLCBwYXlsb2FkKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlbGV0ZSB0aGUgb3JpZ2luYWwgaW50ZXJhY3Rpb24gcmVzcG9uc2VcclxuICAgKi9cclxuICBhc3luYyBkZWxldGVJbnRlcmFjdGlvblJlc3BvbnNlKHRva2VuOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IGFwcElkID0gdGhpcy5nZXRBcHBsaWNhdGlvbklkKCk7XHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3Q8dm9pZD4oJ0RFTEVURScsIGAvaW50ZXJhY3Rpb25zL3dlYmhvb2tzLyR7YXBwSWR9LyR7dG9rZW59L21lc3NhZ2VzL0BvcmlnaW5hbGApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgZm9sbG93dXAgbWVzc2FnZVxyXG4gICAqIEF1dG9tYXRpY2FsbHkgcHJvY2Vzc2VzIG1lbnRpb25zXHJcbiAgICogU3VwcG9ydHMgZmlsZSBhdHRhY2htZW50cyB2aWEgbXVsdGlwYXJ0L2Zvcm0tZGF0YVxyXG4gICAqL1xyXG4gIGFzeW5jIGNyZWF0ZUZvbGxvd3VwKHRva2VuOiBzdHJpbmcsIGRhdGE6IHtcclxuICAgIGNvbnRlbnQ/OiBzdHJpbmc7XHJcbiAgICBlbWJlZHM/OiBBUElFbWJlZFtdO1xyXG4gICAgY29tcG9uZW50cz86IGFueVtdO1xyXG4gICAgZmxhZ3M/OiBudW1iZXI7XHJcbiAgICBtZW50aW9ucz86IE1lbnRpb25zRGF0YTtcclxuICAgIGZpbGVzPzogQXJyYXk8eyBuYW1lOiBzdHJpbmc7IGRhdGE6IEJ1ZmZlcjsgY29udGVudFR5cGU/OiBzdHJpbmcgfT47XHJcbiAgfSk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgYXBwSWQgPSB0aGlzLmdldEFwcGxpY2F0aW9uSWQoKTtcclxuICAgIGNvbnN0IGVuZHBvaW50ID0gYC9pbnRlcmFjdGlvbnMvd2ViaG9va3MvJHthcHBJZH0vJHt0b2tlbn1gO1xyXG5cclxuICAgIC8vIElmIGZpbGVzIHByb3ZpZGVkLCB1c2UgbXVsdGlwYXJ0L2Zvcm0tZGF0YVxyXG4gICAgaWYgKGRhdGEuZmlsZXMgJiYgZGF0YS5maWxlcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgIGNvbnN0IEZvcm1EYXRhID0gcmVxdWlyZSgnZm9ybS1kYXRhJyk7XHJcbiAgICAgIGNvbnN0IGZvcm0gPSBuZXcgRm9ybURhdGEoKTtcclxuICAgIGRhdGEgPSB7IC4uLmRhdGEsIC4uLnRoaXMucHJlcGFyZU1lc3NhZ2VEYXRhKGRhdGEpIH07XHJcblxyXG4gICAgICAvLyBBZGQgY29udGVudFxyXG4gICAgICBpZiAoZGF0YS5jb250ZW50KSB7XHJcbiAgICAgICAgZm9ybS5hcHBlbmQoJ2NvbnRlbnQnLCBkYXRhLmNvbnRlbnQpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyBBZGQgZW1iZWRzIChwcm9jZXNzZWQgdXNpbmcgc2hhcmVkIG5vcm1hbGl6ZUVtYmVkKVxyXG4gICAgICBpZiAoZGF0YS5lbWJlZHMgJiYgZGF0YS5lbWJlZHMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIGNvbnN0IHByb2Nlc3NlZEVtYmVkcyA9IGRhdGEuZW1iZWRzLm1hcChlbWJlZCA9PiBub3JtYWxpemVFbWJlZChlbWJlZCkpO1xyXG4gICAgICAgIGZvcm0uYXBwZW5kKCdlbWJlZHMnLCBKU09OLnN0cmluZ2lmeShwcm9jZXNzZWRFbWJlZHMpKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gQWRkIGNvbXBvbmVudHMgdXNpbmcgc2hhcmVkIHNlcmlhbGl6ZUNvbXBvbmVudHNcclxuICAgICAgaWYgKGRhdGEuY29tcG9uZW50cyAmJiBkYXRhLmNvbXBvbmVudHMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIGNvbnN0IHByb2Nlc3NlZENvbXBvbmVudHMgPSBzZXJpYWxpemVDb21wb25lbnRzKGRhdGEuY29tcG9uZW50cyk7XHJcbiAgICAgICAgZm9ybS5hcHBlbmQoJ2NvbXBvbmVudHMnLCBKU09OLnN0cmluZ2lmeShwcm9jZXNzZWRDb21wb25lbnRzKSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIEFkZCBmbGFnc1xyXG4gICAgICBpZiAoZGF0YS5mbGFncykge1xyXG4gICAgICAgIGZvcm0uYXBwZW5kKCdmbGFncycsIFN0cmluZyhkYXRhLmZsYWdzKSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIEFkZCBmaWxlc1xyXG4gICAgICBkYXRhLmZpbGVzIS5mb3JFYWNoKChmaWxlLCBpbmRleCkgPT4ge1xyXG4gICAgICAgIGZvcm0uYXBwZW5kKGBmaWxlc1ske2luZGV4fV1gLCBmaWxlLmRhdGEsIHtcclxuICAgICAgICAgIGZpbGVuYW1lOiBmaWxlLm5hbWUsXHJcbiAgICAgICAgICBjb250ZW50VHlwZTogZmlsZS5jb250ZW50VHlwZSB8fCAnYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtJ1xyXG4gICAgICAgIH0pO1xyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGF3YWl0IHRoaXMucmVxdWVzdEJvZHk8dm9pZD4oJ1BPU1QnLCBlbmRwb2ludCwgZm9ybS5nZXRCdWZmZXIoKSwgZm9ybS5nZXRIZWFkZXJzKCkpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgLy8gTm8gZmlsZXMsIHVzZSBKU09OXHJcbiAgICAgIGNvbnN0IHByb2Nlc3NlZERhdGEgPSB0aGlzLnByZXBhcmVNZXNzYWdlRGF0YShkYXRhKTtcclxuICAgICAgYXdhaXQgdGhpcy5yZXF1ZXN0PHZvaWQ+KCdQT1NUJywgZW5kcG9pbnQsIHByb2Nlc3NlZERhdGEpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT0gQ29tbWFuZHMgPT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVnaXN0ZXIgZ2xvYmFsIGFwcGxpY2F0aW9uIGNvbW1hbmRzXHJcbiAgICovXHJcbiAgYXN5bmMgcmVnaXN0ZXJHbG9iYWxDb21tYW5kcyhjb21tYW5kczogQVBJQXBwbGljYXRpb25Db21tYW5kW10pOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IGFwcElkID0gdGhpcy5nZXRBcHBsaWNhdGlvbklkKCk7XHJcbiAgICBcclxuICAgIGZvciAoY29uc3QgY29tbWFuZCBvZiBjb21tYW5kcykge1xyXG4gICAgICBhd2FpdCB0aGlzLnJlcXVlc3Q8dm9pZD4oJ1BPU1QnLCBgL2FwcGxpY2F0aW9ucy8ke2FwcElkfS9jb21tYW5kc2AsIGNvbW1hbmQpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQnVsayBvdmVyd3JpdGUgYWxsIGdsb2JhbCBhcHBsaWNhdGlvbiBjb21tYW5kcyAocmVwbGFjZXMgYWxsIGV4aXN0aW5nKVxyXG4gICAqL1xyXG4gIGFzeW5jIGJ1bGtPdmVyd3JpdGVHbG9iYWxDb21tYW5kcyhjb21tYW5kczogQVBJQXBwbGljYXRpb25Db21tYW5kW10pOiBQcm9taXNlPEFQSUFwcGxpY2F0aW9uQ29tbWFuZFtdPiB7XHJcbiAgICBjb25zdCBhcHBJZCA9IHRoaXMuZ2V0QXBwbGljYXRpb25JZCgpO1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBUElBcHBsaWNhdGlvbkNvbW1hbmRbXT4oJ1BVVCcsIGAvYXBwbGljYXRpb25zLyR7YXBwSWR9L2NvbW1hbmRzYCwgY29tbWFuZHMpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVnaXN0ZXIgZ3VpbGQtc3BlY2lmaWMgY29tbWFuZHNcclxuICAgKi9cclxuICBhc3luYyByZWdpc3Rlckd1aWxkQ29tbWFuZHMoZ3VpbGRJZDogc3RyaW5nLCBjb21tYW5kczogQVBJQXBwbGljYXRpb25Db21tYW5kW10pOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IGFwcElkID0gdGhpcy5nZXRBcHBsaWNhdGlvbklkKCk7XHJcbiAgICBcclxuICAgIGZvciAoY29uc3QgY29tbWFuZCBvZiBjb21tYW5kcykge1xyXG4gICAgICBhd2FpdCB0aGlzLnJlcXVlc3Q8dm9pZD4oJ1BPU1QnLCBgL2FwcGxpY2F0aW9ucy8ke2FwcElkfS9ndWlsZHMvJHtndWlsZElkfS9jb21tYW5kc2AsIGNvbW1hbmQpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQnVsayBvdmVyd3JpdGUgYWxsIGd1aWxkLXNwZWNpZmljIGNvbW1hbmRzIChyZXBsYWNlcyBhbGwgZXhpc3RpbmcpXHJcbiAgICovXHJcbiAgYXN5bmMgYnVsa092ZXJ3cml0ZUd1aWxkQ29tbWFuZHMoZ3VpbGRJZDogc3RyaW5nLCBjb21tYW5kczogQVBJQXBwbGljYXRpb25Db21tYW5kW10pOiBQcm9taXNlPEFQSUFwcGxpY2F0aW9uQ29tbWFuZFtdPiB7XHJcbiAgICBjb25zdCBhcHBJZCA9IHRoaXMuZ2V0QXBwbGljYXRpb25JZCgpO1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBUElBcHBsaWNhdGlvbkNvbW1hbmRbXT4oJ1BVVCcsIGAvYXBwbGljYXRpb25zLyR7YXBwSWR9L2d1aWxkcy8ke2d1aWxkSWR9L2NvbW1hbmRzYCwgY29tbWFuZHMpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVsZXRlIGEgZ2xvYmFsIGNvbW1hbmRcclxuICAgKi9cclxuICBhc3luYyBkZWxldGVHbG9iYWxDb21tYW5kKGNvbW1hbmRJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBhcHBJZCA9IHRoaXMuZ2V0QXBwbGljYXRpb25JZCgpO1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0PHZvaWQ+KCdERUxFVEUnLCBgL2FwcGxpY2F0aW9ucy8ke2FwcElkfS9jb21tYW5kcy8ke2NvbW1hbmRJZH1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlbGV0ZSBhIGd1aWxkLXNwZWNpZmljIGNvbW1hbmRcclxuICAgKi9cclxuICBhc3luYyBkZWxldGVHdWlsZENvbW1hbmQoZ3VpbGRJZDogc3RyaW5nLCBjb21tYW5kSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgYXBwSWQgPSB0aGlzLmdldEFwcGxpY2F0aW9uSWQoKTtcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdDx2b2lkPignREVMRVRFJywgYC9hcHBsaWNhdGlvbnMvJHthcHBJZH0vZ3VpbGRzLyR7Z3VpbGRJZH0vY29tbWFuZHMvJHtjb21tYW5kSWR9YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBMaXN0IGFsbCBnbG9iYWwgY29tbWFuZHMgZm9yIHRoaXMgYXBwbGljYXRpb25cclxuICAgKi9cclxuICBhc3luYyBsaXN0R2xvYmFsQ29tbWFuZHMoKTogUHJvbWlzZTxBUElBcHBsaWNhdGlvbkNvbW1hbmRbXT4ge1xyXG4gICAgY29uc3QgYXBwSWQgPSB0aGlzLmdldEFwcGxpY2F0aW9uSWQoKTtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QVBJQXBwbGljYXRpb25Db21tYW5kW10+KCdHRVQnLCBgL2FwcGxpY2F0aW9ucy8ke2FwcElkfS9jb21tYW5kc2ApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogTGlzdCBhbGwgZ3VpbGQtc3BlY2lmaWMgY29tbWFuZHMgZm9yIHRoaXMgYXBwbGljYXRpb25cclxuICAgKi9cclxuICBhc3luYyBsaXN0R3VpbGRDb21tYW5kcyhndWlsZElkOiBzdHJpbmcpOiBQcm9taXNlPEFQSUFwcGxpY2F0aW9uQ29tbWFuZFtdPiB7XHJcbiAgICBjb25zdCBhcHBJZCA9IHRoaXMuZ2V0QXBwbGljYXRpb25JZCgpO1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBUElBcHBsaWNhdGlvbkNvbW1hbmRbXT4oJ0dFVCcsIGAvYXBwbGljYXRpb25zLyR7YXBwSWR9L2d1aWxkcy8ke2d1aWxkSWR9L2NvbW1hbmRzYCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSBzcGVjaWZpYyBnbG9iYWwgY29tbWFuZFxyXG4gICAqL1xyXG4gIGFzeW5jIGdldEdsb2JhbENvbW1hbmQoY29tbWFuZElkOiBzdHJpbmcpOiBQcm9taXNlPEFQSUFwcGxpY2F0aW9uQ29tbWFuZD4ge1xyXG4gICAgY29uc3QgYXBwSWQgPSB0aGlzLmdldEFwcGxpY2F0aW9uSWQoKTtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QVBJQXBwbGljYXRpb25Db21tYW5kPignR0VUJywgYC9hcHBsaWNhdGlvbnMvJHthcHBJZH0vY29tbWFuZHMvJHtjb21tYW5kSWR9YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSBzcGVjaWZpYyBndWlsZCBjb21tYW5kXHJcbiAgICovXHJcbiAgYXN5bmMgZ2V0R3VpbGRDb21tYW5kKGd1aWxkSWQ6IHN0cmluZywgY29tbWFuZElkOiBzdHJpbmcpOiBQcm9taXNlPEFQSUFwcGxpY2F0aW9uQ29tbWFuZD4ge1xyXG4gICAgY29uc3QgYXBwSWQgPSB0aGlzLmdldEFwcGxpY2F0aW9uSWQoKTtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QVBJQXBwbGljYXRpb25Db21tYW5kPignR0VUJywgYC9hcHBsaWNhdGlvbnMvJHthcHBJZH0vZ3VpbGRzLyR7Z3VpbGRJZH0vY29tbWFuZHMvJHtjb21tYW5kSWR9YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBVcGRhdGUgYSBnbG9iYWwgY29tbWFuZFxyXG4gICAqL1xyXG4gIGFzeW5jIHVwZGF0ZUdsb2JhbENvbW1hbmQoY29tbWFuZElkOiBzdHJpbmcsIGRhdGE6IFBhcnRpYWw8QVBJQXBwbGljYXRpb25Db21tYW5kPik6IFByb21pc2U8QVBJQXBwbGljYXRpb25Db21tYW5kPiB7XHJcbiAgICBjb25zdCBhcHBJZCA9IHRoaXMuZ2V0QXBwbGljYXRpb25JZCgpO1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBUElBcHBsaWNhdGlvbkNvbW1hbmQ+KCdQQVRDSCcsIGAvYXBwbGljYXRpb25zLyR7YXBwSWR9L2NvbW1hbmRzLyR7Y29tbWFuZElkfWAsIGRhdGEpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVXBkYXRlIGEgZ3VpbGQtc3BlY2lmaWMgY29tbWFuZFxyXG4gICAqL1xyXG4gIGFzeW5jIHVwZGF0ZUd1aWxkQ29tbWFuZChndWlsZElkOiBzdHJpbmcsIGNvbW1hbmRJZDogc3RyaW5nLCBkYXRhOiBQYXJ0aWFsPEFQSUFwcGxpY2F0aW9uQ29tbWFuZD4pOiBQcm9taXNlPEFQSUFwcGxpY2F0aW9uQ29tbWFuZD4ge1xyXG4gICAgY29uc3QgYXBwSWQgPSB0aGlzLmdldEFwcGxpY2F0aW9uSWQoKTtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QVBJQXBwbGljYXRpb25Db21tYW5kPignUEFUQ0gnLCBgL2FwcGxpY2F0aW9ucy8ke2FwcElkfS9ndWlsZHMvJHtndWlsZElkfS9jb21tYW5kcy8ke2NvbW1hbmRJZH1gLCBkYXRhKTtcclxuICB9XHJcblxyXG4gIC8vID09PT09PT09PT09PT09PT09PT09IEhlbHBlcnMgPT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgcHJpdmF0ZSBhcHBsaWNhdGlvbklkOiBzdHJpbmcgPSAnJztcclxuXHJcbiAgLyoqXHJcbiAgICogU2V0IHRoZSBhcHBsaWNhdGlvbiBJRFxyXG4gICAqL1xyXG4gIHNldEFwcGxpY2F0aW9uSWQoaWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgdGhpcy5hcHBsaWNhdGlvbklkID0gaWQ7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgdGhlIGFwcGxpY2F0aW9uIElEXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBnZXRBcHBsaWNhdGlvbklkKCk6IHN0cmluZyB7XHJcbiAgICBpZiAoIXRoaXMuYXBwbGljYXRpb25JZCkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0FwcGxpY2F0aW9uIElEIG5vdCBzZXQuIENhbGwgc2V0QXBwbGljYXRpb25JZCgpIGZpcnN0LicpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRoaXMuYXBwbGljYXRpb25JZDtcclxuICB9XHJcblxyXG4gIC8vID09PT09PT09PT09PT09PT09PT09IENoYW5uZWxzID09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIGNoYW5uZWwgaW4gYSBndWlsZC5cclxuICAgKiBcclxuICAgKiBAcGFyYW0gZ3VpbGRJZCAtIFRoZSBJRCBvZiB0aGUgZ3VpbGRcclxuICAgKiBAcGFyYW0gZGF0YSAtIENoYW5uZWwgY3JlYXRpb24gb3B0aW9uc1xyXG4gICAqIEBwYXJhbSBkYXRhLm5hbWUgLSBDaGFubmVsIG5hbWUgKDEtMTAwIGNoYXJhY3RlcnMpXHJcbiAgICogQHBhcmFtIGRhdGEudHlwZSAtIENoYW5uZWwgdHlwZSAoMCA9IHRleHQsIDIgPSB2b2ljZSwgNCA9IGNhdGVnb3J5LCAxMyA9IHN0YWdlKVxyXG4gICAqIEBwYXJhbSBkYXRhLnBhcmVudF9pZCAtIENhdGVnb3J5IElEIHRvIHBsYWNlIHRoZSBjaGFubmVsIHVuZGVyIChhbGlhcyBmb3IgY2F0ZWdvcnlfaWQpXHJcbiAgICogQHBhcmFtIGRhdGEuY2F0ZWdvcnlfaWQgLSBDYXRlZ29yeSBJRCB0byBwbGFjZSB0aGUgY2hhbm5lbCB1bmRlclxyXG4gICAqIEBwYXJhbSBkYXRhLnBlcm1pc3Npb25fb3ZlcndyaXRlcyAtIEFycmF5IG9mIHBlcm1pc3Npb24gb3ZlcndyaXRlcyBmb3IgdGhlIGNoYW5uZWxcclxuICAgKiBAcmV0dXJucyBUaGUgY3JlYXRlZCBjaGFubmVsIG9iamVjdFxyXG4gICAqIEB0aHJvd3Mge1JFU1RFcnJvcn0gSWYgdGhlIGJvdCBsYWNrcyBNQU5BR0VfQ0hBTk5FTFMgcGVybWlzc2lvblxyXG4gICAqIFxyXG4gICAqIEBleGFtcGxlXHJcbiAgICogYGBgdHNcclxuICAgKiAvLyBDcmVhdGUgYSB0ZXh0IGNoYW5uZWwgaW4gYSBjYXRlZ29yeVxyXG4gICAqIGNvbnN0IGNoYW5uZWwgPSBhd2FpdCByZXN0LmNyZWF0ZUNoYW5uZWwoJzEyMzQ1Njc4OScsIHtcclxuICAgKiAgIG5hbWU6ICdnZW5lcmFsLWNoYXQnLFxyXG4gICAqICAgdHlwZTogMCxcclxuICAgKiAgIGNhdGVnb3J5X2lkOiAnOTg3NjU0MzIxJ1xyXG4gICAqIH0pO1xyXG4gICAqIGBgYFxyXG4gICAqL1xyXG4gIGFzeW5jIGNyZWF0ZUNoYW5uZWwoZ3VpbGRJZDogc3RyaW5nLCBkYXRhOiB7XHJcbiAgICBuYW1lOiBzdHJpbmc7XHJcbiAgICB0eXBlPzogbnVtYmVyO1xyXG4gICAgcGFyZW50X2lkPzogc3RyaW5nIHwgbnVsbDtcclxuICAgIGNhdGVnb3J5X2lkPzogc3RyaW5nIHwgbnVsbDtcclxuICAgIHBlcm1pc3Npb25fb3ZlcndyaXRlcz86IEFycmF5PHtcclxuICAgICAgaWQ6IHN0cmluZztcclxuICAgICAgdHlwZTogbnVtYmVyO1xyXG4gICAgICBhbGxvdz86IHN0cmluZztcclxuICAgICAgZGVueT86IHN0cmluZztcclxuICAgIH0+O1xyXG4gIH0pOiBQcm9taXNlPEFQSUNoYW5uZWw+IHtcclxuICAgIC8vIE1hcCBwYXJlbnRfaWQgdG8gY2F0ZWdvcnlfaWQgZm9yIGJhY2tlbmQgY29tcGF0aWJpbGl0eVxyXG4gICAgY29uc3QgcmVxdWVzdERhdGE6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge1xyXG4gICAgICBuYW1lOiBkYXRhLm5hbWUsXHJcbiAgICAgIHR5cGU6IGRhdGEudHlwZSA/PyAwLCAvLyBEZWZhdWx0IHRvIHRleHQgY2hhbm5lbFxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgLy8gQmFja2VuZCBleHBlY3RzIGNhdGVnb3J5X2lkLCBub3QgcGFyZW50X2lkXHJcbiAgICBpZiAoZGF0YS5jYXRlZ29yeV9pZCkge1xyXG4gICAgICByZXF1ZXN0RGF0YS5jYXRlZ29yeV9pZCA9IGRhdGEuY2F0ZWdvcnlfaWQ7XHJcbiAgICB9IGVsc2UgaWYgKGRhdGEucGFyZW50X2lkKSB7XHJcbiAgICAgIHJlcXVlc3REYXRhLmNhdGVnb3J5X2lkID0gZGF0YS5wYXJlbnRfaWQ7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIEFkZCBwZXJtaXNzaW9uX292ZXJ3cml0ZXMgaWYgcHJvdmlkZWRcclxuICAgIGlmIChkYXRhLnBlcm1pc3Npb25fb3ZlcndyaXRlcyAmJiBkYXRhLnBlcm1pc3Npb25fb3ZlcndyaXRlcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgIHJlcXVlc3REYXRhLnBlcm1pc3Npb25fb3ZlcndyaXRlcyA9IGRhdGEucGVybWlzc2lvbl9vdmVyd3JpdGVzO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PEFQSUNoYW5uZWw+KCdQT1NUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vY2hhbm5lbHNgLCByZXF1ZXN0RGF0YSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZWxldGUgYSBjaGFubmVsIGZyb20gYSBndWlsZC5cclxuICAgKiBUaGlzIGFjdGlvbiBpcyBpcnJldmVyc2libGUuIEFsbCBtZXNzYWdlcyBpbiB0aGUgY2hhbm5lbCB3aWxsIGJlIGxvc3QuXHJcbiAgICogXHJcbiAgICogQHBhcmFtIGd1aWxkSWQgLSBUaGUgSUQgb2YgdGhlIGd1aWxkXHJcbiAgICogQHBhcmFtIGNoYW5uZWxJZCAtIFRoZSBJRCBvZiB0aGUgY2hhbm5lbCB0byBkZWxldGVcclxuICAgKiBAcmV0dXJucyB2b2lkXHJcbiAgICogQHRocm93cyB7UkVTVEVycm9yfSBJZiB0aGUgYm90IGxhY2tzIE1BTkFHRV9DSEFOTkVMUyBwZXJtaXNzaW9uXHJcbiAgICogXHJcbiAgICogQGV4YW1wbGVcclxuICAgKiBgYGB0c1xyXG4gICAqIGF3YWl0IHJlc3QuZGVsZXRlQ2hhbm5lbCgnMTIzNDU2Nzg5JywgJzk4NzY1NDMyMScpO1xyXG4gICAqIGBgYFxyXG4gICAqL1xyXG4gIGFzeW5jIGRlbGV0ZUNoYW5uZWwoZ3VpbGRJZDogc3RyaW5nLCBjaGFubmVsSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0KCdERUxFVEUnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEVkaXQgYSBjaGFubmVsJ3Mgc2V0dGluZ3MuXHJcbiAgICogXHJcbiAgICogQHBhcmFtIGd1aWxkSWQgLSBUaGUgSUQgb2YgdGhlIGd1aWxkXHJcbiAgICogQHBhcmFtIGNoYW5uZWxJZCAtIFRoZSBJRCBvZiB0aGUgY2hhbm5lbCB0byBlZGl0XHJcbiAgICogQHBhcmFtIGRhdGEgLSBUaGUgY2hhbm5lbCBkYXRhIHRvIHVwZGF0ZVxyXG4gICAqIEByZXR1cm5zIFRoZSB1cGRhdGVkIGNoYW5uZWxcclxuICAgKiBAdGhyb3dzIHtSRVNURXJyb3J9IElmIHRoZSBib3QgbGFja3MgTUFOQUdFX0NIQU5ORUxTIHBlcm1pc3Npb25cclxuICAgKiBcclxuICAgKiBAZXhhbXBsZVxyXG4gICAqIGBgYHRzXHJcbiAgICogYXdhaXQgcmVzdC5lZGl0Q2hhbm5lbCgnMTIzJywgJzQ1NicsIHtcclxuICAgKiAgIG5hbWU6ICduZXctbmFtZScsXHJcbiAgICogICB0b3BpYzogJ05ldyB0b3BpYycsXHJcbiAgICogICBzbG93bW9kZV9zZWNvbmRzOiA1XHJcbiAgICogfSk7XHJcbiAgICogYGBgXHJcbiAgICovXHJcbiAgYXN5bmMgZWRpdENoYW5uZWwoZ3VpbGRJZDogc3RyaW5nLCBjaGFubmVsSWQ6IHN0cmluZywgZGF0YToge1xyXG4gICAgbmFtZT86IHN0cmluZztcclxuICAgIHRvcGljPzogc3RyaW5nO1xyXG4gICAgcG9zaXRpb24/OiBudW1iZXI7XHJcbiAgICBzbG93bW9kZV9zZWNvbmRzPzogbnVtYmVyO1xyXG4gICAgbnNmdz86IGJvb2xlYW47XHJcbiAgICBwYXJlbnRfaWQ/OiBzdHJpbmcgfCBudWxsO1xyXG4gICAgcGVybWlzc2lvbl9vdmVyd3JpdGVzPzogQXJyYXk8e1xyXG4gICAgICBpZDogc3RyaW5nO1xyXG4gICAgICB0eXBlOiBudW1iZXI7XHJcbiAgICAgIGFsbG93Pzogc3RyaW5nO1xyXG4gICAgICBkZW55Pzogc3RyaW5nO1xyXG4gICAgfT47XHJcbiAgfSk6IFByb21pc2U8QVBJQ2hhbm5lbD4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBUElDaGFubmVsPignUEFUQ0gnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH1gLCBkYXRhKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlbGV0ZSBhIGNhdGVnb3J5IGFuZCBvcHRpb25hbGx5IGl0cyBjaGlsZCBjaGFubmVscy5cclxuICAgKiBcclxuICAgKiBAcGFyYW0gZ3VpbGRJZCAtIFRoZSBJRCBvZiB0aGUgZ3VpbGRcclxuICAgKiBAcGFyYW0gY2F0ZWdvcnlJZCAtIFRoZSBJRCBvZiB0aGUgY2F0ZWdvcnkgdG8gZGVsZXRlXHJcbiAgICogQHJldHVybnMgdm9pZFxyXG4gICAqIEB0aHJvd3Mge1JFU1RFcnJvcn0gSWYgdGhlIGJvdCBsYWNrcyBNQU5BR0VfQ0hBTk5FTFMgcGVybWlzc2lvblxyXG4gICAqIFxyXG4gICAqIEBleGFtcGxlXHJcbiAgICogYGBgdHNcclxuICAgKiBhd2FpdCByZXN0LmRlbGV0ZUNhdGVnb3J5KCcxMjM0NTY3ODknLCAnOTg3NjU0MzIxJyk7XHJcbiAgICogYGBgXHJcbiAgICovXHJcbiAgYXN5bmMgZGVsZXRlQ2F0ZWdvcnkoZ3VpbGRJZDogc3RyaW5nLCBjYXRlZ29yeUlkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdCgnREVMRVRFJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vY2F0ZWdvcmllcy8ke2NhdGVnb3J5SWR9YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBFZGl0IGNoYW5uZWwgcGVybWlzc2lvbiBvdmVyd3JpdGVzIGZvciBhIHJvbGUgb3IgbWVtYmVyLlxyXG4gICAqIFxyXG4gICAqIEBwYXJhbSBjaGFubmVsSWQgLSBUaGUgSUQgb2YgdGhlIGNoYW5uZWxcclxuICAgKiBAcGFyYW0gb3ZlcndyaXRlSWQgLSBUaGUgSUQgb2YgdGhlIHJvbGUgb3IgbWVtYmVyXHJcbiAgICogQHBhcmFtIGRhdGEgLSBQZXJtaXNzaW9uIG92ZXJ3cml0ZSBkYXRhXHJcbiAgICogQHBhcmFtIGRhdGEudHlwZSAtIDAgZm9yIHJvbGUsIDEgZm9yIG1lbWJlclxyXG4gICAqIEBwYXJhbSBkYXRhLmFsbG93IC0gQml0ZmllbGQgb2YgYWxsb3dlZCBwZXJtaXNzaW9uc1xyXG4gICAqIEBwYXJhbSBkYXRhLmRlbnkgLSBCaXRmaWVsZCBvZiBkZW5pZWQgcGVybWlzc2lvbnNcclxuICAgKiBAcmV0dXJucyB2b2lkXHJcbiAgICogQHRocm93cyB7UkVTVEVycm9yfSBJZiB0aGUgYm90IGxhY2tzIE1BTkFHRV9ST0xFUyBwZXJtaXNzaW9uXHJcbiAgICogXHJcbiAgICogQGV4YW1wbGVcclxuICAgKiBgYGB0c1xyXG4gICAqIC8vIEFsbG93IGEgcm9sZSB0byBzZW5kIG1lc3NhZ2VzIGJ1dCBkZW55IGZpbGUgdXBsb2Fkc1xyXG4gICAqIGF3YWl0IHJlc3QuZWRpdENoYW5uZWxQZXJtaXNzaW9ucygnNDU2JywgJ3JvbGVJZCcsIHtcclxuICAgKiAgIHR5cGU6IDAsXHJcbiAgICogICBhbGxvdzogJzIwNDgnLCAgLy8gU0VORF9NRVNTQUdFU1xyXG4gICAqICAgZGVueTogJzMyNzY4JyAgIC8vIEFUVEFDSF9GSUxFU1xyXG4gICAqIH0pO1xyXG4gICAqIGBgYFxyXG4gICAqL1xyXG4gIGFzeW5jIGVkaXRDaGFubmVsUGVybWlzc2lvbnMoY2hhbm5lbElkOiBzdHJpbmcsIG92ZXJ3cml0ZUlkOiBzdHJpbmcsIGRhdGE6IHtcclxuICAgIHR5cGU6IG51bWJlcjtcclxuICAgIGFsbG93Pzogc3RyaW5nO1xyXG4gICAgZGVueT86IHN0cmluZztcclxuICB9KTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3QoJ1BVVCcsIGAvYm90L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS9wZXJtaXNzaW9ucy8ke292ZXJ3cml0ZUlkfWAsIGRhdGEpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVsZXRlIGEgY2hhbm5lbCBwZXJtaXNzaW9uIG92ZXJ3cml0ZS5cclxuICAgKiBcclxuICAgKiBAcGFyYW0gY2hhbm5lbElkIC0gVGhlIElEIG9mIHRoZSBjaGFubmVsXHJcbiAgICogQHBhcmFtIG92ZXJ3cml0ZUlkIC0gVGhlIElEIG9mIHRoZSByb2xlIG9yIG1lbWJlciBvdmVyd3JpdGUgdG8gZGVsZXRlXHJcbiAgICogQHJldHVybnMgdm9pZFxyXG4gICAqIEB0aHJvd3Mge1JFU1RFcnJvcn0gSWYgdGhlIGJvdCBsYWNrcyBNQU5BR0VfUk9MRVMgcGVybWlzc2lvblxyXG4gICAqIFxyXG4gICAqIEBleGFtcGxlXHJcbiAgICogYGBgdHNcclxuICAgKiBhd2FpdCByZXN0LmRlbGV0ZUNoYW5uZWxQZXJtaXNzaW9uKCc0NTYnLCAncm9sZUlkJyk7XHJcbiAgICogYGBgXHJcbiAgICovXHJcbiAgYXN5bmMgZGVsZXRlQ2hhbm5lbFBlcm1pc3Npb24oY2hhbm5lbElkOiBzdHJpbmcsIG92ZXJ3cml0ZUlkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdCgnREVMRVRFJywgYC9ib3QvY2hhbm5lbHMvJHtjaGFubmVsSWR9L3Blcm1pc3Npb25zLyR7b3ZlcndyaXRlSWR9YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgbWVzc2FnZXMgZnJvbSBhIGNoYW5uZWwgd2l0aCBvcHRpb25hbCBwYWdpbmF0aW9uLlxyXG4gICAqIFxyXG4gICAqIEBwYXJhbSBndWlsZElkIC0gVGhlIElEIG9mIHRoZSBndWlsZFxyXG4gICAqIEBwYXJhbSBjaGFubmVsSWQgLSBUaGUgSUQgb2YgdGhlIGNoYW5uZWxcclxuICAgKiBAcGFyYW0gb3B0aW9ucyAtIFBhZ2luYXRpb24gb3B0aW9uc1xyXG4gICAqIEBwYXJhbSBvcHRpb25zLmxpbWl0IC0gTWF4aW11bSBudW1iZXIgb2YgbWVzc2FnZXMgdG8gcmV0dXJuICgxLTEwMCwgZGVmYXVsdDogNTApXHJcbiAgICogQHBhcmFtIG9wdGlvbnMuYmVmb3JlIC0gR2V0IG1lc3NhZ2VzIGJlZm9yZSB0aGlzIG1lc3NhZ2UgSURcclxuICAgKiBAcGFyYW0gb3B0aW9ucy5hZnRlciAtIEdldCBtZXNzYWdlcyBhZnRlciB0aGlzIG1lc3NhZ2UgSURcclxuICAgKiBAcmV0dXJucyBBcnJheSBvZiBtZXNzYWdlcywgbmV3ZXN0IGZpcnN0IHdoZW4gdXNpbmcgYGJlZm9yZWBcclxuICAgKiBAdGhyb3dzIHtSRVNURXJyb3J9IElmIHRoZSBib3QgbGFja3MgUkVBRF9NRVNTQUdFX0hJU1RPUlkgcGVybWlzc2lvblxyXG4gICAqIFxyXG4gICAqIEBleGFtcGxlXHJcbiAgICogYGBgdHNcclxuICAgKiAvLyBHZXQgbGFzdCA1MCBtZXNzYWdlc1xyXG4gICAqIGNvbnN0IG1lc3NhZ2VzID0gYXdhaXQgcmVzdC5nZXRNZXNzYWdlcygnMTIzJywgJzQ1NicsIHsgbGltaXQ6IDUwIH0pO1xyXG4gICAqIFxyXG4gICAqIC8vIEdldCBtZXNzYWdlcyBiZWZvcmUgYSBzcGVjaWZpYyBtZXNzYWdlIChmb3IgcGFnaW5hdGlvbilcclxuICAgKiBjb25zdCBvbGRlciA9IGF3YWl0IHJlc3QuZ2V0TWVzc2FnZXMoJzEyMycsICc0NTYnLCB7IFxyXG4gICAqICAgbGltaXQ6IDUwLCBcclxuICAgKiAgIGJlZm9yZTogbWVzc2FnZXNbbWVzc2FnZXMubGVuZ3RoIC0gMV0uaWQgXHJcbiAgICogfSk7XHJcbiAgICogYGBgXHJcbiAgICovXHJcbiAgYXN5bmMgZ2V0TWVzc2FnZXMoZ3VpbGRJZDogc3RyaW5nLCBjaGFubmVsSWQ6IHN0cmluZywgb3B0aW9ucz86IHtcclxuICAgIGxpbWl0PzogbnVtYmVyO1xyXG4gICAgYmVmb3JlPzogc3RyaW5nO1xyXG4gICAgYWZ0ZXI/OiBzdHJpbmc7XHJcbiAgfSk6IFByb21pc2U8QVBJTWVzc2FnZVtdPiB7XHJcbiAgICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKCk7XHJcbiAgICBpZiAob3B0aW9ucz8ubGltaXQpIHBhcmFtcy5hcHBlbmQoJ2xpbWl0JywgU3RyaW5nKG9wdGlvbnMubGltaXQpKTtcclxuICAgIGlmIChvcHRpb25zPy5iZWZvcmUpIHBhcmFtcy5hcHBlbmQoJ2JlZm9yZScsIG9wdGlvbnMuYmVmb3JlKTtcclxuICAgIGlmIChvcHRpb25zPy5hZnRlcikgcGFyYW1zLmFwcGVuZCgnYWZ0ZXInLCBvcHRpb25zLmFmdGVyKTtcclxuICAgIFxyXG4gICAgY29uc3QgcXVlcnkgPSBwYXJhbXMudG9TdHJpbmcoKSA/IGA/JHtwYXJhbXMudG9TdHJpbmcoKX1gIDogJyc7XHJcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMucmVxdWVzdDx7IG1lc3NhZ2VzOiBBUElNZXNzYWdlW107IHBhZ2VfaW5mbzogYW55IH0+KCdHRVQnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH0vbWVzc2FnZXMke3F1ZXJ5fWApO1xyXG4gICAgcmV0dXJuIHJlc3BvbnNlLm1lc3NhZ2VzIHx8IFtdO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQXN5bmMgZ2VuZXJhdG9yIHRoYXQgeWllbGRzIGJhdGNoZXMgb2YgbWVzc2FnZXMsIGF1dG9tYXRpY2FsbHkgaGFuZGxpbmcgcGFnaW5hdGlvbi5cclxuICAgKiBNZXNzYWdlcyBhcmUgZmV0Y2hlZCBpbiByZXZlcnNlIGNocm9ub2xvZ2ljYWwgb3JkZXIgKG5ld2VzdCB0byBvbGRlc3QpLlxyXG4gICAqIFxyXG4gICAqIEBwYXJhbSBndWlsZElkIC0gVGhlIElEIG9mIHRoZSBndWlsZFxyXG4gICAqIEBwYXJhbSBjaGFubmVsSWQgLSBUaGUgSUQgb2YgdGhlIGNoYW5uZWxcclxuICAgKiBAcGFyYW0gb3B0aW9ucyAtIEl0ZXJhdG9yIG9wdGlvbnNcclxuICAgKiBAcGFyYW0gb3B0aW9ucy5saW1pdCAtIFRvdGFsIG1heGltdW0gbnVtYmVyIG9mIG1lc3NhZ2VzIHRvIGZldGNoIChkZWZhdWx0OiB1bmxpbWl0ZWQpXHJcbiAgICogQHBhcmFtIG9wdGlvbnMuYmF0Y2hTaXplIC0gTnVtYmVyIG9mIG1lc3NhZ2VzIHBlciBBUEkgcmVxdWVzdCAoMS0xMDAsIGRlZmF1bHQ6IDEwMClcclxuICAgKiBAeWllbGRzIEFycmF5cyBvZiBtZXNzYWdlcyAoYmF0Y2hlcylcclxuICAgKiBAdGhyb3dzIHtSRVNURXJyb3J9IElmIHRoZSBib3QgbGFja3MgUkVBRF9NRVNTQUdFX0hJU1RPUlkgcGVybWlzc2lvblxyXG4gICAqIFxyXG4gICAqIEBleGFtcGxlXHJcbiAgICogYGBgdHNcclxuICAgKiAvLyBJdGVyYXRlIHRocm91Z2ggYWxsIG1lc3NhZ2VzIGluIGEgY2hhbm5lbFxyXG4gICAqIGZvciBhd2FpdCAoY29uc3QgYmF0Y2ggb2YgcmVzdC5nZXRNZXNzYWdlc0l0ZXJhdG9yKCcxMjMnLCAnNDU2JykpIHtcclxuICAgKiAgIGZvciAoY29uc3QgbWVzc2FnZSBvZiBiYXRjaCkge1xyXG4gICAqICAgICBjb25zb2xlLmxvZyhtZXNzYWdlLmNvbnRlbnQpO1xyXG4gICAqICAgfVxyXG4gICAqIH1cclxuICAgKiBcclxuICAgKiAvLyBHZXQgdXAgdG8gNTAwIG1lc3NhZ2VzXHJcbiAgICogZm9yIGF3YWl0IChjb25zdCBiYXRjaCBvZiByZXN0LmdldE1lc3NhZ2VzSXRlcmF0b3IoJzEyMycsICc0NTYnLCB7IGxpbWl0OiA1MDAgfSkpIHtcclxuICAgKiAgIHByb2Nlc3NCYXRjaChiYXRjaCk7XHJcbiAgICogfVxyXG4gICAqIGBgYFxyXG4gICAqL1xyXG4gIGFzeW5jICpnZXRNZXNzYWdlc0l0ZXJhdG9yKGd1aWxkSWQ6IHN0cmluZywgY2hhbm5lbElkOiBzdHJpbmcsIG9wdGlvbnM/OiB7XHJcbiAgICBsaW1pdD86IG51bWJlcjtcclxuICAgIGJhdGNoU2l6ZT86IG51bWJlcjtcclxuICB9KTogQXN5bmNHZW5lcmF0b3I8QVBJTWVzc2FnZVtdLCB2b2lkLCB1bmtub3duPiB7XHJcbiAgICBjb25zdCBiYXRjaFNpemUgPSBNYXRoLm1pbihvcHRpb25zPy5iYXRjaFNpemUgPz8gMTAwLCAxMDApO1xyXG4gICAgY29uc3QgbWF4TWVzc2FnZXMgPSBvcHRpb25zPy5saW1pdDtcclxuICAgIGxldCBmZXRjaGVkID0gMDtcclxuICAgIGxldCBiZWZvcmU6IHN0cmluZyB8IHVuZGVmaW5lZDtcclxuXHJcbiAgICB3aGlsZSAodHJ1ZSkge1xyXG4gICAgICAvLyBDYWxjdWxhdGUgaG93IG1hbnkgdG8gZmV0Y2ggaW4gdGhpcyBiYXRjaFxyXG4gICAgICBjb25zdCB0b0ZldGNoID0gbWF4TWVzc2FnZXMgIT09IHVuZGVmaW5lZCBcclxuICAgICAgICA/IE1hdGgubWluKGJhdGNoU2l6ZSwgbWF4TWVzc2FnZXMgLSBmZXRjaGVkKSBcclxuICAgICAgICA6IGJhdGNoU2l6ZTtcclxuXHJcbiAgICAgIGlmICh0b0ZldGNoIDw9IDApIGJyZWFrO1xyXG5cclxuICAgICAgY29uc3QgbWVzc2FnZXMgPSBhd2FpdCB0aGlzLmdldE1lc3NhZ2VzKGd1aWxkSWQsIGNoYW5uZWxJZCwge1xyXG4gICAgICAgIGxpbWl0OiB0b0ZldGNoLFxyXG4gICAgICAgIGJlZm9yZVxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGlmIChtZXNzYWdlcy5sZW5ndGggPT09IDApIGJyZWFrO1xyXG5cclxuICAgICAgeWllbGQgbWVzc2FnZXM7XHJcbiAgICAgIGZldGNoZWQgKz0gbWVzc2FnZXMubGVuZ3RoO1xyXG5cclxuICAgICAgLy8gVXNlIHRoZSBvbGRlc3QgbWVzc2FnZSBJRCBhcyB0aGUgJ2JlZm9yZScgY3Vyc29yIGZvciBuZXh0IGJhdGNoXHJcbiAgICAgIGJlZm9yZSA9IG1lc3NhZ2VzW21lc3NhZ2VzLmxlbmd0aCAtIDFdLmlkO1xyXG5cclxuICAgICAgLy8gU3RvcCBpZiB3ZSBnb3QgZmV3ZXIgdGhhbiByZXF1ZXN0ZWQgKG5vIG1vcmUgbWVzc2FnZXMpXHJcbiAgICAgIGlmIChtZXNzYWdlcy5sZW5ndGggPCB0b0ZldGNoKSBicmVhaztcclxuXHJcbiAgICAgIC8vIFN0b3AgaWYgd2UndmUgcmVhY2hlZCB0aGUgbGltaXRcclxuICAgICAgaWYgKG1heE1lc3NhZ2VzICE9PSB1bmRlZmluZWQgJiYgZmV0Y2hlZCA+PSBtYXhNZXNzYWdlcykgYnJlYWs7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PSBNZW1iZXJzID09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhIGd1aWxkIG1lbWJlciBieSB0aGVpciB1c2VyIElELlxyXG4gICAqIFxyXG4gICAqIEBwYXJhbSBndWlsZElkIC0gVGhlIElEIG9mIHRoZSBndWlsZFxyXG4gICAqIEBwYXJhbSB1c2VySWQgLSBUaGUgSUQgb2YgdGhlIHVzZXIgdG8gZmV0Y2hcclxuICAgKiBAcmV0dXJucyBUaGUgbWVtYmVyIGRhdGEgaW5jbHVkaW5nIHJvbGVzLCBuaWNrbmFtZSwgYW5kIGpvaW4gZGF0ZVxyXG4gICAqIEB0aHJvd3Mge1JFU1RFcnJvcn0gSWYgdGhlIG1lbWJlciBpcyBub3QgZm91bmQgKDQwNCkgb3IgdGhlIGJvdCBsYWNrcyBwZXJtaXNzaW9uc1xyXG4gICAqIFxyXG4gICAqIEBleGFtcGxlXHJcbiAgICogYGBgdHNcclxuICAgKiBjb25zdCBtZW1iZXIgPSBhd2FpdCByZXN0LmdldE1lbWJlcignMTIzNDU2Nzg5JywgJzk4NzY1NDMyMScpO1xyXG4gICAqIGNvbnNvbGUubG9nKGAke21lbWJlci51c2VyLnVzZXJuYW1lfSBqb2luZWQgYXQgJHttZW1iZXIuam9pbmVkX2F0fWApO1xyXG4gICAqIGBgYFxyXG4gICAqL1xyXG4gIGFzeW5jIGdldE1lbWJlcihndWlsZElkOiBzdHJpbmcsIHVzZXJJZDogc3RyaW5nKTogUHJvbWlzZTxBUElNZW1iZXJEYXRhPiB7XHJcbiAgICAvLyBTRUNVUklUWTogVmFsaWRhdGUgSURzIHRvIHByZXZlbnQgcGF0aCB0cmF2ZXJzYWxcclxuICAgIHZhbGlkYXRlSWQoZ3VpbGRJZCwgJ2d1aWxkSWQnKTtcclxuICAgIHZhbGlkYXRlSWQodXNlcklkLCAndXNlcklkJyk7XHJcbiAgICBcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QVBJTWVtYmVyRGF0YT4oJ0dFVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L21lbWJlcnMvJHt1c2VySWR9YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSBwYWdpbmF0ZWQgbGlzdCBvZiBndWlsZCBtZW1iZXJzLlxyXG4gICAqIFVzZXMgY3Vyc29yLWJhc2VkIHBhZ2luYXRpb24gZm9yIGVmZmljaWVudCB0cmF2ZXJzYWwgb2YgbGFyZ2UgbWVtYmVyIGxpc3RzLlxyXG4gICAqIFxyXG4gICAqIEBwYXJhbSBndWlsZElkIC0gVGhlIElEIG9mIHRoZSBndWlsZFxyXG4gICAqIEBwYXJhbSBvcHRpb25zIC0gUGFnaW5hdGlvbiBvcHRpb25zXHJcbiAgICogQHBhcmFtIG9wdGlvbnMubGltaXQgLSBNYXhpbXVtIG51bWJlciBvZiBtZW1iZXJzIHRvIHJldHVybiAoZGVmYXVsdDogMTAwLCBtYXg6IDEwMDApXHJcbiAgICogQHBhcmFtIG9wdGlvbnMuY3Vyc29yIC0gQ3Vyc29yIGZvciBwYWdpbmF0aW9uIChmcm9tIHByZXZpb3VzIHJlc3BvbnNlJ3MgbmV4dF9jdXJzb3IpXHJcbiAgICogQHJldHVybnMgUGFnaW5hdGVkIHJlc3BvbnNlIHdpdGggbWVtYmVycyBhcnJheSBhbmQgY3Vyc29yIGluZm9cclxuICAgKiBcclxuICAgKiBAZXhhbXBsZVxyXG4gICAqIGBgYHRzXHJcbiAgICogLy8gR2V0IGZpcnN0IHBhZ2VcclxuICAgKiBjb25zdCBwYWdlMSA9IGF3YWl0IHJlc3QuZ2V0TWVtYmVycygnMTIzNDU2Nzg5JywgeyBsaW1pdDogNTAgfSk7XHJcbiAgICogXHJcbiAgICogLy8gR2V0IG5leHQgcGFnZSB1c2luZyBjdXJzb3JcclxuICAgKiBpZiAocGFnZTEubmV4dF9jdXJzb3IpIHtcclxuICAgKiAgIGNvbnN0IHBhZ2UyID0gYXdhaXQgcmVzdC5nZXRNZW1iZXJzKCcxMjM0NTY3ODknLCB7IGN1cnNvcjogcGFnZTEubmV4dF9jdXJzb3IgfSk7XHJcbiAgICogfVxyXG4gICAqIGBgYFxyXG4gICAqL1xyXG4gIGFzeW5jIGdldE1lbWJlcnMoZ3VpbGRJZDogc3RyaW5nLCBvcHRpb25zPzogeyBsaW1pdD86IG51bWJlcjsgY3Vyc29yPzogc3RyaW5nIH0pOiBQcm9taXNlPEFQSU1lbWJlcnNSZXNwb25zZT4ge1xyXG4gICAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcygpO1xyXG4gICAgcGFyYW1zLnNldCgnZmxhdCcsICd0cnVlJyk7IC8vIEJvdCBBUEkgYWx3YXlzIHVzZXMgZmxhdCByZXNwb25zZSAobm8gcHJlc2VuY2UgZ3JvdXBpbmcpXHJcbiAgICBpZiAob3B0aW9ucz8ubGltaXQpIHBhcmFtcy5zZXQoJ2xpbWl0JywgU3RyaW5nKG9wdGlvbnMubGltaXQpKTtcclxuICAgIGlmIChvcHRpb25zPy5jdXJzb3IpIHBhcmFtcy5zZXQoJ2N1cnNvcicsIG9wdGlvbnMuY3Vyc29yKTtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QVBJTWVtYmVyc1Jlc3BvbnNlPignR0VUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vbWVtYmVycz8ke3BhcmFtcy50b1N0cmluZygpfWApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQXN5bmMgZ2VuZXJhdG9yIHRoYXQgeWllbGRzIGJhdGNoZXMgb2YgZ3VpbGQgbWVtYmVycywgYXV0b21hdGljYWxseSBoYW5kbGluZyBjdXJzb3ItYmFzZWQgcGFnaW5hdGlvbi5cclxuICAgKiBcclxuICAgKiBAcGFyYW0gZ3VpbGRJZCAtIFRoZSBJRCBvZiB0aGUgZ3VpbGRcclxuICAgKiBAcGFyYW0gb3B0aW9ucyAtIEl0ZXJhdG9yIG9wdGlvbnNcclxuICAgKiBAcGFyYW0gb3B0aW9ucy5saW1pdCAtIFRvdGFsIG1heGltdW0gbnVtYmVyIG9mIG1lbWJlcnMgdG8gZmV0Y2ggKGRlZmF1bHQ6IHVubGltaXRlZClcclxuICAgKiBAcGFyYW0gb3B0aW9ucy5iYXRjaFNpemUgLSBOdW1iZXIgb2YgbWVtYmVycyBwZXIgQVBJIHJlcXVlc3QgKGRlZmF1bHQ6IDEwMCwgbWF4OiAxMDAwKVxyXG4gICAqIEB5aWVsZHMgQXJyYXlzIG9mIG1lbWJlciBkYXRhIChiYXRjaGVzKVxyXG4gICAqIEB0aHJvd3Mge1JFU1RFcnJvcn0gSWYgdGhlIGJvdCBsYWNrcyBwZXJtaXNzaW9uc1xyXG4gICAqIFxyXG4gICAqIEBleGFtcGxlXHJcbiAgICogYGBgdHNcclxuICAgKiAvLyBJdGVyYXRlIHRocm91Z2ggYWxsIG1lbWJlcnMgaW4gYSBndWlsZFxyXG4gICAqIGZvciBhd2FpdCAoY29uc3QgYmF0Y2ggb2YgcmVzdC5nZXRNZW1iZXJzSXRlcmF0b3IoJzEyMzQ1Njc4OScpKSB7XHJcbiAgICogICBmb3IgKGNvbnN0IG1lbWJlciBvZiBiYXRjaCkge1xyXG4gICAqICAgICBjb25zb2xlLmxvZyhtZW1iZXIudXNlcj8udXNlcm5hbWUpO1xyXG4gICAqICAgfVxyXG4gICAqIH1cclxuICAgKiBcclxuICAgKiAvLyBHZXQgdXAgdG8gNTAwIG1lbWJlcnNcclxuICAgKiBmb3IgYXdhaXQgKGNvbnN0IGJhdGNoIG9mIHJlc3QuZ2V0TWVtYmVyc0l0ZXJhdG9yKCcxMjM0NTY3ODknLCB7IGxpbWl0OiA1MDAgfSkpIHtcclxuICAgKiAgIHByb2Nlc3NCYXRjaChiYXRjaCk7XHJcbiAgICogfVxyXG4gICAqIGBgYFxyXG4gICAqL1xyXG4gIGFzeW5jICpnZXRNZW1iZXJzSXRlcmF0b3IoZ3VpbGRJZDogc3RyaW5nLCBvcHRpb25zPzoge1xyXG4gICAgbGltaXQ/OiBudW1iZXI7XHJcbiAgICBiYXRjaFNpemU/OiBudW1iZXI7XHJcbiAgfSk6IEFzeW5jR2VuZXJhdG9yPEFQSU1lbWJlckRhdGFbXSwgdm9pZCwgdW5rbm93bj4ge1xyXG4gICAgY29uc3QgYmF0Y2hTaXplID0gTWF0aC5taW4ob3B0aW9ucz8uYmF0Y2hTaXplID8/IDEwMCwgMTAwMCk7XHJcbiAgICBjb25zdCBtYXhNZW1iZXJzID0gb3B0aW9ucz8ubGltaXQ7XHJcbiAgICBsZXQgZmV0Y2hlZCA9IDA7XHJcbiAgICBsZXQgY3Vyc29yOiBzdHJpbmcgfCB1bmRlZmluZWQ7XHJcblxyXG4gICAgd2hpbGUgKHRydWUpIHtcclxuICAgICAgLy8gQ2FsY3VsYXRlIGhvdyBtYW55IHRvIGZldGNoIGluIHRoaXMgYmF0Y2hcclxuICAgICAgY29uc3QgdG9GZXRjaCA9IG1heE1lbWJlcnMgIT09IHVuZGVmaW5lZCBcclxuICAgICAgICA/IE1hdGgubWluKGJhdGNoU2l6ZSwgbWF4TWVtYmVycyAtIGZldGNoZWQpIFxyXG4gICAgICAgIDogYmF0Y2hTaXplO1xyXG5cclxuICAgICAgaWYgKHRvRmV0Y2ggPD0gMCkgYnJlYWs7XHJcblxyXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMuZ2V0TWVtYmVycyhndWlsZElkLCB7XHJcbiAgICAgICAgbGltaXQ6IHRvRmV0Y2gsXHJcbiAgICAgICAgY3Vyc29yXHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgY29uc3QgbWVtYmVycyA9IHJlc3BvbnNlLm1lbWJlcnMgfHwgW107XHJcbiAgICAgIGlmIChtZW1iZXJzLmxlbmd0aCA9PT0gMCkgYnJlYWs7XHJcblxyXG4gICAgICB5aWVsZCBtZW1iZXJzO1xyXG4gICAgICBmZXRjaGVkICs9IG1lbWJlcnMubGVuZ3RoO1xyXG5cclxuICAgICAgLy8gVXNlIHRoZSBjdXJzb3IgZnJvbSBwYWdlX2luZm8gZm9yIG5leHQgYmF0Y2hcclxuICAgICAgY3Vyc29yID0gcmVzcG9uc2UucGFnZV9pbmZvPy5jdXJzb3I7XHJcblxyXG4gICAgICAvLyBTdG9wIGlmIG5vIG1vcmUgcGFnZXNcclxuICAgICAgaWYgKCFyZXNwb25zZS5wYWdlX2luZm8/Lmhhc19tb3JlKSBicmVhaztcclxuXHJcbiAgICAgIC8vIFN0b3AgaWYgd2UndmUgcmVhY2hlZCB0aGUgbGltaXRcclxuICAgICAgaWYgKG1heE1lbWJlcnMgIT09IHVuZGVmaW5lZCAmJiBmZXRjaGVkID49IG1heE1lbWJlcnMpIGJyZWFrO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVGltZW91dCAobXV0ZSkgYSBndWlsZCBtZW1iZXIgZm9yIGEgc3BlY2lmaWVkIGR1cmF0aW9uLlxyXG4gICAqIFBhc3MgbnVsbCBmb3IgZHVyYXRpb24gdG8gY2xlYXIgYW4gZXhpc3RpbmcgdGltZW91dC5cclxuICAgKiBcclxuICAgKiBAcGFyYW0gZ3VpbGRJZCAtIFRoZSBJRCBvZiB0aGUgZ3VpbGRcclxuICAgKiBAcGFyYW0gdXNlcklkIC0gVGhlIElEIG9mIHRoZSBtZW1iZXIgdG8gdGltZW91dFxyXG4gICAqIEBwYXJhbSBkdXJhdGlvbiAtIFRpbWVvdXQgZHVyYXRpb24gaW4gbWlsbGlzZWNvbmRzLCBvciBudWxsIHRvIGNsZWFyXHJcbiAgICogQHBhcmFtIHJlYXNvbiAtIE9wdGlvbmFsIGF1ZGl0IGxvZyByZWFzb25cclxuICAgKiBAcmV0dXJucyB2b2lkXHJcbiAgICogQHRocm93cyB7UkVTVEVycm9yfSBJZiB0aGUgYm90IGxhY2tzIE1PREVSQVRFX01FTUJFUlMgcGVybWlzc2lvblxyXG4gICAqIFxyXG4gICAqIEBleGFtcGxlXHJcbiAgICogYGBgdHNcclxuICAgKiAvLyBUaW1lb3V0IGZvciA1IG1pbnV0ZXNcclxuICAgKiBhd2FpdCByZXN0LnRpbWVvdXRNZW1iZXIoJzEyMycsICc0NTYnLCA1ICogNjAgKiAxMDAwLCAnU3BhbW1pbmcnKTtcclxuICAgKiBcclxuICAgKiAvLyBDbGVhciB0aW1lb3V0XHJcbiAgICogYXdhaXQgcmVzdC50aW1lb3V0TWVtYmVyKCcxMjMnLCAnNDU2JywgbnVsbCwgJ0FwcGVhbGVkJyk7XHJcbiAgICogYGBgXHJcbiAgICovXHJcbiAgYXN5bmMgdGltZW91dE1lbWJlcihndWlsZElkOiBzdHJpbmcsIHVzZXJJZDogc3RyaW5nLCBkdXJhdGlvbjogbnVtYmVyIHwgbnVsbCwgcmVhc29uPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBpZiAoZHVyYXRpb24gPT09IG51bGwpIHtcclxuICAgICAgLy8gQ2xlYXIgdGltZW91dFxyXG4gICAgICBhd2FpdCB0aGlzLnJlcXVlc3QoJ1BPU1QnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9tZW1iZXJzLyR7dXNlcklkfS90aW1lb3V0L2NsZWFyYCwge1xyXG4gICAgICAgIHJlYXNvblxyXG4gICAgICB9KTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIC8vIFNldCB0aW1lb3V0XHJcbiAgICAgIGNvbnN0IHVudGlsID0gbmV3IERhdGUoRGF0ZS5ub3coKSArIGR1cmF0aW9uKS50b0lTT1N0cmluZygpO1xyXG4gICAgICBhd2FpdCB0aGlzLnJlcXVlc3QoJ1BPU1QnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9tZW1iZXJzLyR7dXNlcklkfS90aW1lb3V0YCwge1xyXG4gICAgICAgIHVudGlsLFxyXG4gICAgICAgIHJlYXNvblxyXG4gICAgICB9KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEtpY2sgYSBtZW1iZXIgZnJvbSB0aGUgZ3VpbGQuXHJcbiAgICogVGhlIG1lbWJlciBjYW4gcmVqb2luIGlmIHRoZXkgaGF2ZSBhbiBpbnZpdGUuXHJcbiAgICogXHJcbiAgICogQHBhcmFtIGd1aWxkSWQgLSBUaGUgSUQgb2YgdGhlIGd1aWxkXHJcbiAgICogQHBhcmFtIHVzZXJJZCAtIFRoZSBJRCBvZiB0aGUgbWVtYmVyIHRvIGtpY2tcclxuICAgKiBAcGFyYW0gcmVhc29uIC0gT3B0aW9uYWwgYXVkaXQgbG9nIHJlYXNvblxyXG4gICAqIEByZXR1cm5zIHZvaWRcclxuICAgKiBAdGhyb3dzIHtSRVNURXJyb3J9IElmIHRoZSBib3QgbGFja3MgS0lDS19NRU1CRVJTIHBlcm1pc3Npb24gb3IgY2Fubm90IGtpY2sgdGhlIHRhcmdldFxyXG4gICAqIFxyXG4gICAqIEBleGFtcGxlXHJcbiAgICogYGBgdHNcclxuICAgKiBhd2FpdCByZXN0LmtpY2tNZW1iZXIoJzEyMzQ1Njc4OScsICc5ODc2NTQzMjEnLCAnUnVsZSB2aW9sYXRpb24nKTtcclxuICAgKiBgYGBcclxuICAgKi9cclxuICBhc3luYyBraWNrTWVtYmVyKGd1aWxkSWQ6IHN0cmluZywgdXNlcklkOiBzdHJpbmcsIHJlYXNvbj86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgLy8gU0VDVVJJVFk6IFZhbGlkYXRlIElEcyB0byBwcmV2ZW50IHBhdGggdHJhdmVyc2FsXHJcbiAgICB2YWxpZGF0ZUlkKGd1aWxkSWQsICdndWlsZElkJyk7XHJcbiAgICB2YWxpZGF0ZUlkKHVzZXJJZCwgJ3VzZXJJZCcpO1xyXG4gICAgXHJcbiAgICBjb25zdCBxdWVyeSA9IHJlYXNvbiA/IGA/cmVhc29uPSR7ZW5jb2RlVVJJQ29tcG9uZW50KHJlYXNvbil9YCA6ICcnO1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0KCdERUxFVEUnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9tZW1iZXJzLyR7dXNlcklkfSR7cXVlcnl9YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBCYW4gYSB1c2VyIGZyb20gdGhlIGd1aWxkLlxyXG4gICAqIEJhbm5lZCB1c2VycyBjYW5ub3QgcmVqb2luIHVudGlsIHVuYmFubmVkLlxyXG4gICAqIFxyXG4gICAqIEBwYXJhbSBndWlsZElkIC0gVGhlIElEIG9mIHRoZSBndWlsZFxyXG4gICAqIEBwYXJhbSB1c2VySWQgLSBUaGUgSUQgb2YgdGhlIHVzZXIgdG8gYmFuXHJcbiAgICogQHBhcmFtIG9wdGlvbnMgLSBCYW4gb3B0aW9uc1xyXG4gICAqIEBwYXJhbSBvcHRpb25zLmRlbGV0ZU1lc3NhZ2VEYXlzIC0gTnVtYmVyIG9mIGRheXMgb2YgbWVzc2FnZXMgdG8gZGVsZXRlICgwLTcsIGRlcHJlY2F0ZWQpXHJcbiAgICogQHBhcmFtIG9wdGlvbnMuZGVsZXRlTWVzc2FnZVNlY29uZHMgLSBTZWNvbmRzIG9mIG1lc3NhZ2VzIHRvIGRlbGV0ZSAoMC02MDQ4MDApXHJcbiAgICogQHBhcmFtIG9wdGlvbnMucmVhc29uIC0gQXVkaXQgbG9nIHJlYXNvblxyXG4gICAqIEByZXR1cm5zIHZvaWRcclxuICAgKiBAdGhyb3dzIHtSRVNURXJyb3J9IElmIHRoZSBib3QgbGFja3MgQkFOX01FTUJFUlMgcGVybWlzc2lvbiBvciBjYW5ub3QgYmFuIHRoZSB0YXJnZXRcclxuICAgKiBcclxuICAgKiBAZXhhbXBsZVxyXG4gICAqIGBgYHRzXHJcbiAgICogLy8gQmFuIGFuZCBkZWxldGUgbGFzdCAyNCBob3VycyBvZiBtZXNzYWdlc1xyXG4gICAqIGF3YWl0IHJlc3QuYmFuTWVtYmVyKCcxMjMnLCAnNDU2Jywge1xyXG4gICAqICAgZGVsZXRlTWVzc2FnZVNlY29uZHM6IDg2NDAwLFxyXG4gICAqICAgcmVhc29uOiAnSGFyYXNzbWVudCdcclxuICAgKiB9KTtcclxuICAgKiBgYGBcclxuICAgKi9cclxuICBhc3luYyBiYW5NZW1iZXIoZ3VpbGRJZDogc3RyaW5nLCB1c2VySWQ6IHN0cmluZywgb3B0aW9ucz86IHtcclxuICAgIGRlbGV0ZU1lc3NhZ2VEYXlzPzogbnVtYmVyO1xyXG4gICAgZGVsZXRlTWVzc2FnZVNlY29uZHM/OiBudW1iZXI7XHJcbiAgICByZWFzb24/OiBzdHJpbmc7XHJcbiAgfSk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgLy8gU0VDVVJJVFk6IFZhbGlkYXRlIElEcyB0byBwcmV2ZW50IHBhdGggdHJhdmVyc2FsXHJcbiAgICB2YWxpZGF0ZUlkKGd1aWxkSWQsICdndWlsZElkJyk7XHJcbiAgICB2YWxpZGF0ZUlkKHVzZXJJZCwgJ3VzZXJJZCcpO1xyXG4gICAgXHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3QoJ1BVVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2JhbnMvJHt1c2VySWR9YCwge1xyXG4gICAgICBkZWxldGVfbWVzc2FnZV9kYXlzOiBvcHRpb25zPy5kZWxldGVNZXNzYWdlRGF5cyxcclxuICAgICAgZGVsZXRlX21lc3NhZ2Vfc2Vjb25kczogb3B0aW9ucz8uZGVsZXRlTWVzc2FnZVNlY29uZHMsXHJcbiAgICAgIHJlYXNvbjogb3B0aW9ucz8ucmVhc29uXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlbW92ZSBhIGJhbiBmcm9tIGEgdXNlciwgYWxsb3dpbmcgdGhlbSB0byByZWpvaW4uXHJcbiAgICogXHJcbiAgICogQHBhcmFtIGd1aWxkSWQgLSBUaGUgSUQgb2YgdGhlIGd1aWxkXHJcbiAgICogQHBhcmFtIHVzZXJJZCAtIFRoZSBJRCBvZiB0aGUgdXNlciB0byB1bmJhblxyXG4gICAqIEBwYXJhbSByZWFzb24gLSBPcHRpb25hbCBhdWRpdCBsb2cgcmVhc29uXHJcbiAgICogQHJldHVybnMgdm9pZFxyXG4gICAqIEB0aHJvd3Mge1JFU1RFcnJvcn0gSWYgdGhlIGJvdCBsYWNrcyBCQU5fTUVNQkVSUyBwZXJtaXNzaW9uIG9yIHVzZXIgaXMgbm90IGJhbm5lZFxyXG4gICAqIFxyXG4gICAqIEBleGFtcGxlXHJcbiAgICogYGBgdHNcclxuICAgKiBhd2FpdCByZXN0LnVuYmFuTWVtYmVyKCcxMjM0NTY3ODknLCAnOTg3NjU0MzIxJywgJ0JhbiBhcHBlYWwgYWNjZXB0ZWQnKTtcclxuICAgKiBgYGBcclxuICAgKi9cclxuICBhc3luYyB1bmJhbk1lbWJlcihndWlsZElkOiBzdHJpbmcsIHVzZXJJZDogc3RyaW5nLCByZWFzb24/OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IHF1ZXJ5ID0gcmVhc29uID8gYD9yZWFzb249JHtlbmNvZGVVUklDb21wb25lbnQocmVhc29uKX1gIDogJyc7XHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3QoJ0RFTEVURScsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2JhbnMvJHt1c2VySWR9JHtxdWVyeX1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEVkaXQgYSBndWlsZCBtZW1iZXIncyBhdHRyaWJ1dGVzIChuaWNrbmFtZSwgcm9sZXMsIHZvaWNlIHN0YXRlLCBldGMuKS5cclxuICAgKiBcclxuICAgKiBAcGFyYW0gZ3VpbGRJZCAtIFRoZSBJRCBvZiB0aGUgZ3VpbGRcclxuICAgKiBAcGFyYW0gdXNlcklkIC0gVGhlIElEIG9mIHRoZSBtZW1iZXIgdG8gZWRpdFxyXG4gICAqIEBwYXJhbSBkYXRhIC0gVGhlIG1lbWJlciBhdHRyaWJ1dGVzIHRvIG1vZGlmeVxyXG4gICAqIEBwYXJhbSBkYXRhLm5pY2sgLSBOZXcgbmlja25hbWUgKG51bGwgdG8gcmVzZXQpXHJcbiAgICogQHBhcmFtIGRhdGEucm9sZXMgLSBBcnJheSBvZiByb2xlIElEcyB0byBzZXQgKHJlcGxhY2VzIGFsbCByb2xlcylcclxuICAgKiBAcGFyYW0gZGF0YS5tdXRlIC0gV2hldGhlciB0byBzZXJ2ZXItbXV0ZSB0aGUgbWVtYmVyIGluIHZvaWNlXHJcbiAgICogQHBhcmFtIGRhdGEuZGVhZiAtIFdoZXRoZXIgdG8gc2VydmVyLWRlYWZlbiB0aGUgbWVtYmVyIGluIHZvaWNlXHJcbiAgICogQHBhcmFtIGRhdGEuY2hhbm5lbF9pZCAtIFZvaWNlIGNoYW5uZWwgdG8gbW92ZSBtZW1iZXIgdG8gKG51bGwgdG8gZGlzY29ubmVjdClcclxuICAgKiBAcGFyYW0gZGF0YS5jb21tdW5pY2F0aW9uX2Rpc2FibGVkX3VudGlsIC0gSVNPODYwMSB0aW1lc3RhbXAgZm9yIHRpbWVvdXQgZW5kXHJcbiAgICogQHBhcmFtIGRhdGEucmVhc29uIC0gQXVkaXQgbG9nIHJlYXNvblxyXG4gICAqIEByZXR1cm5zIFRoZSB1cGRhdGVkIG1lbWJlciBkYXRhXHJcbiAgICogQHRocm93cyB7UkVTVEVycm9yfSBJZiB0aGUgYm90IGxhY2tzIHJlcXVpcmVkIHBlcm1pc3Npb25zXHJcbiAgICogXHJcbiAgICogQGV4YW1wbGVcclxuICAgKiBgYGB0c1xyXG4gICAqIC8vIENoYW5nZSBuaWNrbmFtZSBhbmQgYWRkIGEgcm9sZVxyXG4gICAqIGNvbnN0IHVwZGF0ZWQgPSBhd2FpdCByZXN0LmVkaXRNZW1iZXIoJzEyMycsICc0NTYnLCB7XHJcbiAgICogICBuaWNrOiAnTmV3IE5pY2tuYW1lJyxcclxuICAgKiAgIHJvbGVzOiBbJ3JvbGUxJywgJ3JvbGUyJywgJ25ld1JvbGUnXSxcclxuICAgKiAgIHJlYXNvbjogJ05pY2tuYW1lIHVwZGF0ZSByZXF1ZXN0J1xyXG4gICAqIH0pO1xyXG4gICAqIGBgYFxyXG4gICAqL1xyXG4gIGFzeW5jIGVkaXRNZW1iZXIoZ3VpbGRJZDogc3RyaW5nLCB1c2VySWQ6IHN0cmluZywgZGF0YToge1xyXG4gICAgbmljaz86IHN0cmluZyB8IG51bGw7XHJcbiAgICByb2xlcz86IHN0cmluZ1tdO1xyXG4gICAgbXV0ZT86IGJvb2xlYW47XHJcbiAgICBkZWFmPzogYm9vbGVhbjtcclxuICAgIGNoYW5uZWxfaWQ/OiBzdHJpbmcgfCBudWxsO1xyXG4gICAgY29tbXVuaWNhdGlvbl9kaXNhYmxlZF91bnRpbD86IHN0cmluZyB8IG51bGw7XHJcbiAgICByZWFzb24/OiBzdHJpbmc7XHJcbiAgfSk6IFByb21pc2U8QVBJTWVtYmVyRGF0YT4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBUElNZW1iZXJEYXRhPignUEFUQ0gnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9tZW1iZXJzLyR7dXNlcklkfWAsIGRhdGEpO1xyXG4gIH1cclxuXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT0gR3VpbGRzID09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBndWlsZCBpbmZvIHdpdGggZnJlc2ggZGF0YSAobm90IGNhY2hlZCkuXHJcbiAgICogUmV0dXJucyBtZW1iZXJfY291bnQgYW5kIG9ubGluZV9jb3VudCBmcm9tIGxpdmUgUmVkaXMgZGF0YS5cclxuICAgKiBcclxuICAgKiBAcGFyYW0gZ3VpbGRJZCAtIFRoZSBJRCBvZiB0aGUgZ3VpbGQgdG8gZmV0Y2hcclxuICAgKiBAcmV0dXJucyBGdWxsIGd1aWxkIGRhdGEgaW5jbHVkaW5nIGNoYW5uZWxzLCByb2xlcywgYW5kIG1lbWJlciBjb3VudHNcclxuICAgKiBAdGhyb3dzIHtSRVNURXJyb3J9IElmIHRoZSBndWlsZCBpcyBub3QgZm91bmQgb3IgYm90IGlzIG5vdCBhIG1lbWJlclxyXG4gICAqIFxyXG4gICAqIEBleGFtcGxlXHJcbiAgICogYGBgdHNcclxuICAgKiBjb25zdCBndWlsZCA9IGF3YWl0IHJlc3QuZ2V0R3VpbGQoJzEyMzQ1Njc4OScpO1xyXG4gICAqIGNvbnNvbGUubG9nKGAke2d1aWxkLm5hbWV9IGhhcyAke2d1aWxkLm1lbWJlcl9jb3VudH0gbWVtYmVyc2ApO1xyXG4gICAqIGBgYFxyXG4gICAqL1xyXG4gIGFzeW5jIGdldEd1aWxkKGd1aWxkSWQ6IHN0cmluZyk6IFByb21pc2U8QVBJR3VpbGREYXRhPiB7XHJcbiAgICAvLyBTRUNVUklUWTogVmFsaWRhdGUgSUQgdG8gcHJldmVudCBwYXRoIHRyYXZlcnNhbFxyXG4gICAgdmFsaWRhdGVJZChndWlsZElkLCAnZ3VpbGRJZCcpO1xyXG4gICAgXHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PEFQSUd1aWxkRGF0YT4oJ0dFVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBZGQgYSByb2xlIHRvIGEgZ3VpbGQgbWVtYmVyLlxyXG4gICAqIFxyXG4gICAqIEBwYXJhbSBndWlsZElkIC0gVGhlIElEIG9mIHRoZSBndWlsZFxyXG4gICAqIEBwYXJhbSB1c2VySWQgLSBUaGUgSUQgb2YgdGhlIG1lbWJlclxyXG4gICAqIEBwYXJhbSByb2xlSWQgLSBUaGUgSUQgb2YgdGhlIHJvbGUgdG8gYWRkXHJcbiAgICogQHBhcmFtIHJlYXNvbiAtIE9wdGlvbmFsIGF1ZGl0IGxvZyByZWFzb25cclxuICAgKiBAcmV0dXJucyB2b2lkXHJcbiAgICogQHRocm93cyB7UkVTVEVycm9yfSBJZiB0aGUgYm90IGxhY2tzIE1BTkFHRV9ST0xFUyBwZXJtaXNzaW9uIG9yIHJvbGUgaXMgaGlnaGVyIHRoYW4gYm90J3MgaGlnaGVzdCByb2xlXHJcbiAgICogXHJcbiAgICogQGV4YW1wbGVcclxuICAgKiBgYGB0c1xyXG4gICAqIGF3YWl0IHJlc3QuYWRkTWVtYmVyUm9sZSgnMTIzJywgJzQ1NicsICc3ODknLCAnVmVyaWZpZWQgdXNlcicpO1xyXG4gICAqIGBgYFxyXG4gICAqL1xyXG4gIGFzeW5jIGFkZE1lbWJlclJvbGUoZ3VpbGRJZDogc3RyaW5nLCB1c2VySWQ6IHN0cmluZywgcm9sZUlkOiBzdHJpbmcsIHJlYXNvbj86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgcXVlcnkgPSByZWFzb24gPyBgP3JlYXNvbj0ke2VuY29kZVVSSUNvbXBvbmVudChyZWFzb24pfWAgOiAnJztcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdCgnUFVUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vbWVtYmVycy8ke3VzZXJJZH0vcm9sZXMvJHtyb2xlSWR9JHtxdWVyeX1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlbW92ZSBhIHJvbGUgZnJvbSBhIGd1aWxkIG1lbWJlci5cclxuICAgKiBcclxuICAgKiBAcGFyYW0gZ3VpbGRJZCAtIFRoZSBJRCBvZiB0aGUgZ3VpbGRcclxuICAgKiBAcGFyYW0gdXNlcklkIC0gVGhlIElEIG9mIHRoZSBtZW1iZXJcclxuICAgKiBAcGFyYW0gcm9sZUlkIC0gVGhlIElEIG9mIHRoZSByb2xlIHRvIHJlbW92ZVxyXG4gICAqIEBwYXJhbSByZWFzb24gLSBPcHRpb25hbCBhdWRpdCBsb2cgcmVhc29uXHJcbiAgICogQHJldHVybnMgdm9pZFxyXG4gICAqIEB0aHJvd3Mge1JFU1RFcnJvcn0gSWYgdGhlIGJvdCBsYWNrcyBNQU5BR0VfUk9MRVMgcGVybWlzc2lvbiBvciByb2xlIGlzIGhpZ2hlciB0aGFuIGJvdCdzIGhpZ2hlc3Qgcm9sZVxyXG4gICAqIFxyXG4gICAqIEBleGFtcGxlXHJcbiAgICogYGBgdHNcclxuICAgKiBhd2FpdCByZXN0LnJlbW92ZU1lbWJlclJvbGUoJzEyMycsICc0NTYnLCAnNzg5JywgJ1JvbGUgZXhwaXJlZCcpO1xyXG4gICAqIGBgYFxyXG4gICAqL1xyXG4gIGFzeW5jIHJlbW92ZU1lbWJlclJvbGUoZ3VpbGRJZDogc3RyaW5nLCB1c2VySWQ6IHN0cmluZywgcm9sZUlkOiBzdHJpbmcsIHJlYXNvbj86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgcXVlcnkgPSByZWFzb24gPyBgP3JlYXNvbj0ke2VuY29kZVVSSUNvbXBvbmVudChyZWFzb24pfWAgOiAnJztcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdCgnREVMRVRFJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vbWVtYmVycy8ke3VzZXJJZH0vcm9sZXMvJHtyb2xlSWR9JHtxdWVyeX1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEJ1bGsgYXNzaWduIHJvbGVzIHRvIG11bHRpcGxlIG1lbWJlcnMgaW4gYSBzaW5nbGUgcmVxdWVzdC5cclxuICAgKiBNb3JlIGVmZmljaWVudCB0aGFuIGluZGl2aWR1YWwgYWRkTWVtYmVyUm9sZSBjYWxscy5cclxuICAgKiBcclxuICAgKiBAcGFyYW0gZ3VpbGRJZCAtIFRoZSBJRCBvZiB0aGUgZ3VpbGRcclxuICAgKiBAcGFyYW0gYXNzaWdubWVudHMgLSBBcnJheSBvZiB1c2VyL3JvbGVzIGFzc2lnbm1lbnRzXHJcbiAgICogQHJldHVybnMgQVBJIHJlc3BvbnNlIHdpdGggYXNzaWdubWVudCByZXN1bHRzXHJcbiAgICogQHRocm93cyB7UkVTVEVycm9yfSBJZiB0aGUgYm90IGxhY2tzIE1BTkFHRV9ST0xFUyBwZXJtaXNzaW9uXHJcbiAgICogXHJcbiAgICogQGV4YW1wbGVcclxuICAgKiBgYGB0c1xyXG4gICAqIGF3YWl0IHJlc3QuYnVsa0Fzc2lnblJvbGVzKCcxMjM0NTY3ODknLCBbXHJcbiAgICogICB7IHVzZXJfaWQ6ICcxMTEnLCByb2xlX2lkczogWydyb2xlMScsICdyb2xlMiddIH0sXHJcbiAgICogICB7IHVzZXJfaWQ6ICcyMjInLCByb2xlX2lkczogWydyb2xlMSddIH1cclxuICAgKiBdKTtcclxuICAgKiBgYGBcclxuICAgKi9cclxuICBhc3luYyBidWxrQXNzaWduUm9sZXMoZ3VpbGRJZDogc3RyaW5nLCBhc3NpZ25tZW50czogeyB1c2VyX2lkOiBzdHJpbmc7IHJvbGVfaWRzOiBzdHJpbmdbXSB9W10pOiBQcm9taXNlPGFueT4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCgnUFVUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vbWVtYmVycy9yb2xlcy9hc3NpZ25gLCB7IGFzc2lnbm1lbnRzIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQnVsayByZW1vdmUgcm9sZXMgZnJvbSBtdWx0aXBsZSBtZW1iZXJzIGluIGEgc2luZ2xlIHJlcXVlc3QuXHJcbiAgICogTW9yZSBlZmZpY2llbnQgdGhhbiBpbmRpdmlkdWFsIHJlbW92ZU1lbWJlclJvbGUgY2FsbHMuXHJcbiAgICogXHJcbiAgICogQHBhcmFtIGd1aWxkSWQgLSBUaGUgSUQgb2YgdGhlIGd1aWxkXHJcbiAgICogQHBhcmFtIHJlbW92YWxzIC0gQXJyYXkgb2YgdXNlci9yb2xlcyB0byByZW1vdmVcclxuICAgKiBAcmV0dXJucyBBUEkgcmVzcG9uc2Ugd2l0aCByZW1vdmFsIHJlc3VsdHNcclxuICAgKiBAdGhyb3dzIHtSRVNURXJyb3J9IElmIHRoZSBib3QgbGFja3MgTUFOQUdFX1JPTEVTIHBlcm1pc3Npb25cclxuICAgKiBcclxuICAgKiBAZXhhbXBsZVxyXG4gICAqIGBgYHRzXHJcbiAgICogYXdhaXQgcmVzdC5idWxrUmVtb3ZlUm9sZXMoJzEyMzQ1Njc4OScsIFtcclxuICAgKiAgIHsgdXNlcl9pZDogJzExMScsIHJvbGVfaWRzOiBbJ2V4cGlyZWRSb2xlJ10gfSxcclxuICAgKiAgIHsgdXNlcl9pZDogJzIyMicsIHJvbGVfaWRzOiBbJ2V4cGlyZWRSb2xlJ10gfVxyXG4gICAqIF0pO1xyXG4gICAqIGBgYFxyXG4gICAqL1xyXG4gIGFzeW5jIGJ1bGtSZW1vdmVSb2xlcyhndWlsZElkOiBzdHJpbmcsIHJlbW92YWxzOiB7IHVzZXJfaWQ6IHN0cmluZzsgcm9sZV9pZHM6IHN0cmluZ1tdIH1bXSk6IFByb21pc2U8YW55PiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KCdERUxFVEUnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9tZW1iZXJzL3JvbGVzL3JlbW92ZWAsIHsgcmVtb3ZhbHMgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBCdWxrIGRlbGV0ZSBtdWx0aXBsZSBtZXNzYWdlcyBmcm9tIGEgY2hhbm5lbC5cclxuICAgKiBNb3JlIGVmZmljaWVudCB0aGFuIGluZGl2aWR1YWwgZGVsZXRlTWVzc2FnZSBjYWxscy5cclxuICAgKiBNZXNzYWdlcyBvbGRlciB0aGFuIDE0IGRheXMgY2Fubm90IGJlIGJ1bGsgZGVsZXRlZC5cclxuICAgKiBcclxuICAgKiBAcGFyYW0gZ3VpbGRJZCAtIFRoZSBJRCBvZiB0aGUgZ3VpbGRcclxuICAgKiBAcGFyYW0gY2hhbm5lbElkIC0gVGhlIElEIG9mIHRoZSBjaGFubmVsXHJcbiAgICogQHBhcmFtIG1lc3NhZ2VJZHMgLSBBcnJheSBvZiBtZXNzYWdlIElEcyB0byBkZWxldGUgKDItMTAwIG1lc3NhZ2VzKVxyXG4gICAqIEByZXR1cm5zIHZvaWRcclxuICAgKiBAdGhyb3dzIHtSRVNURXJyb3J9IElmIHRoZSBib3QgbGFja3MgTUFOQUdFX01FU1NBR0VTIHBlcm1pc3Npb25cclxuICAgKiBcclxuICAgKiBAZXhhbXBsZVxyXG4gICAqIGBgYHRzXHJcbiAgICogYXdhaXQgcmVzdC5idWxrRGVsZXRlTWVzc2FnZXMoJzEyMycsICc0NTYnLCBbJ21zZzEnLCAnbXNnMicsICdtc2czJ10pO1xyXG4gICAqIGBgYFxyXG4gICAqL1xyXG4gIGFzeW5jIGJ1bGtEZWxldGVNZXNzYWdlcyhndWlsZElkOiBzdHJpbmcsIGNoYW5uZWxJZDogc3RyaW5nLCBtZXNzYWdlSWRzOiBzdHJpbmdbXSk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0KCdQT1NUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vY2hhbm5lbHMvJHtjaGFubmVsSWR9L21lc3NhZ2VzL2J1bGstZGVsZXRlYCwge1xyXG4gICAgICBtZXNzYWdlczogbWVzc2FnZUlkc1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PSBHdWlsZHMgPT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGEgZ3VpbGRcclxuICAgKi9cclxuICBhc3luYyBnZXRHdWlsZENoYW5uZWxzKGd1aWxkSWQ6IHN0cmluZyk6IFByb21pc2U8QVBJQ2hhbm5lbFtdPiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PEFQSUNoYW5uZWxbXT4oJ0dFVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzYCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgZ3VpbGQgcm9sZXNcclxuICAgKi9cclxuICBhc3luYyBnZXRSb2xlcyhndWlsZElkOiBzdHJpbmcpOiBQcm9taXNlPEFQSVJvbGVEYXRhW10+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QVBJUm9sZURhdGFbXT4oJ0dFVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L3JvbGVzYCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgYSByb2xlXHJcbiAgICovXHJcbiAgYXN5bmMgY3JlYXRlUm9sZShndWlsZElkOiBzdHJpbmcsIGRhdGE6IHtcclxuICAgIG5hbWU/OiBzdHJpbmc7XHJcbiAgICBjb2xvcj86IG51bWJlcjtcclxuICAgIGhvaXN0PzogYm9vbGVhbjtcclxuICAgIG1lbnRpb25hYmxlPzogYm9vbGVhbjtcclxuICAgIHBlcm1pc3Npb25zPzogc3RyaW5nO1xyXG4gIH0pOiBQcm9taXNlPEFQSVJvbGVEYXRhPiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PEFQSVJvbGVEYXRhPignUE9TVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L3JvbGVzYCwgZGF0YSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBFZGl0IGEgcm9sZVxyXG4gICAqL1xyXG4gIGFzeW5jIGVkaXRSb2xlKGd1aWxkSWQ6IHN0cmluZywgcm9sZUlkOiBzdHJpbmcsIGRhdGE6IHtcclxuICAgIG5hbWU/OiBzdHJpbmc7XHJcbiAgICBjb2xvcj86IG51bWJlcjtcclxuICAgIGhvaXN0PzogYm9vbGVhbjtcclxuICAgIG1lbnRpb25hYmxlPzogYm9vbGVhbjtcclxuICAgIHBlcm1pc3Npb25zPzogc3RyaW5nO1xyXG4gIH0pOiBQcm9taXNlPEFQSVJvbGVEYXRhPiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PEFQSVJvbGVEYXRhPignUEFUQ0gnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9yb2xlcy8ke3JvbGVJZH1gLCBkYXRhKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlbGV0ZSBhIHJvbGVcclxuICAgKi9cclxuICBhc3luYyBkZWxldGVSb2xlKGd1aWxkSWQ6IHN0cmluZywgcm9sZUlkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdCgnREVMRVRFJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vcm9sZXMvJHtyb2xlSWR9YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgZ3VpbGQgZW1vamlzXHJcbiAgICogXHJcbiAgICogQHBhcmFtIGd1aWxkSWQgLSBUaGUgSUQgb2YgdGhlIGd1aWxkXHJcbiAgICogQHJldHVybnMgQXJyYXkgb2YgZW1vamkgb2JqZWN0c1xyXG4gICAqL1xyXG4gIGFzeW5jIGdldEVtb2ppcyhndWlsZElkOiBzdHJpbmcpOiBQcm9taXNlPEFQSUVtb2ppW10+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QVBJRW1vamlbXT4oJ0dFVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2Vtb2ppc2ApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGFsbCBiYW5zIGZvciBhIGd1aWxkLlxyXG4gICAqIFxyXG4gICAqIEBwYXJhbSBndWlsZElkIC0gVGhlIElEIG9mIHRoZSBndWlsZFxyXG4gICAqIEByZXR1cm5zIEFycmF5IG9mIGJhbiBvYmplY3RzIGNvbnRhaW5pbmcgdXNlciBpbmZvIGFuZCBiYW4gcmVhc29uXHJcbiAgICogQHRocm93cyB7UkVTVEVycm9yfSBJZiB0aGUgYm90IGxhY2tzIEJBTl9NRU1CRVJTIHBlcm1pc3Npb25cclxuICAgKiBcclxuICAgKiBAZXhhbXBsZVxyXG4gICAqIGBgYHRzXHJcbiAgICogY29uc3QgYmFucyA9IGF3YWl0IHJlc3QuZ2V0QmFucygnMTIzNDU2Nzg5Jyk7XHJcbiAgICogZm9yIChjb25zdCBiYW4gb2YgYmFucykge1xyXG4gICAqICAgY29uc29sZS5sb2coYCR7YmFuLnVzZXIudXNlcm5hbWV9IGJhbm5lZCBmb3I6ICR7YmFuLnJlYXNvbiB8fCAnTm8gcmVhc29uJ31gKTtcclxuICAgKiB9XHJcbiAgICogYGBgXHJcbiAgICovXHJcbiAgYXN5bmMgZ2V0QmFucyhndWlsZElkOiBzdHJpbmcpOiBQcm9taXNlPEFQSUJhbltdPiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PEFQSUJhbltdPignR0VUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vYmFuc2ApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGEgc3BlY2lmaWMgYmFuIGJ5IHVzZXIgSUQuXHJcbiAgICogXHJcbiAgICogQHBhcmFtIGd1aWxkSWQgLSBUaGUgSUQgb2YgdGhlIGd1aWxkXHJcbiAgICogQHBhcmFtIHVzZXJJZCAtIFRoZSBJRCBvZiB0aGUgYmFubmVkIHVzZXJcclxuICAgKiBAcmV0dXJucyBUaGUgYmFuIG9iamVjdCBpZiBmb3VuZFxyXG4gICAqIEB0aHJvd3Mge1JFU1RFcnJvcn0gNDA0IGlmIHRoZSB1c2VyIGlzIG5vdCBiYW5uZWRcclxuICAgKiBcclxuICAgKiBAZXhhbXBsZVxyXG4gICAqIGBgYHRzXHJcbiAgICogdHJ5IHtcclxuICAgKiAgIGNvbnN0IGJhbiA9IGF3YWl0IHJlc3QuZ2V0QmFuKCcxMjM0NTY3ODknLCAnOTg3NjU0MzIxJyk7XHJcbiAgICogICBjb25zb2xlLmxvZyhgQmFubmVkIGZvcjogJHtiYW4ucmVhc29ufWApO1xyXG4gICAqIH0gY2F0Y2ggKGUpIHtcclxuICAgKiAgIGNvbnNvbGUubG9nKCdVc2VyIGlzIG5vdCBiYW5uZWQnKTtcclxuICAgKiB9XHJcbiAgICogYGBgXHJcbiAgICovXHJcbiAgYXN5bmMgZ2V0QmFuKGd1aWxkSWQ6IHN0cmluZywgdXNlcklkOiBzdHJpbmcpOiBQcm9taXNlPEFQSUJhbj4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBUElCYW4+KCdHRVQnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9iYW5zLyR7dXNlcklkfWApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGd1aWxkIGludml0ZXNcclxuICAgKiBcclxuICAgKiBAcGFyYW0gZ3VpbGRJZCAtIFRoZSBJRCBvZiB0aGUgZ3VpbGRcclxuICAgKiBAcmV0dXJucyBBcnJheSBvZiBpbnZpdGUgb2JqZWN0c1xyXG4gICAqL1xyXG4gIGFzeW5jIGdldEd1aWxkSW52aXRlcyhndWlsZElkOiBzdHJpbmcpOiBQcm9taXNlPEFQSUludml0ZVtdPiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PEFQSUludml0ZVtdPignR0VUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vaW52aXRlc2ApO1xyXG4gIH1cclxuXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT0gUGlucyA9PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAvKipcclxuICAgKiBQaW4gYSBtZXNzYWdlXHJcbiAgICovXHJcbiAgYXN5bmMgcGluTWVzc2FnZShndWlsZElkOiBzdHJpbmcsIGNoYW5uZWxJZDogc3RyaW5nLCBtZXNzYWdlSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0KCdQVVQnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH0vcGlucy8ke21lc3NhZ2VJZH1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFVucGluIGEgbWVzc2FnZVxyXG4gICAqL1xyXG4gIGFzeW5jIHVucGluTWVzc2FnZShndWlsZElkOiBzdHJpbmcsIGNoYW5uZWxJZDogc3RyaW5nLCBtZXNzYWdlSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0KCdERUxFVEUnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH0vcGlucy8ke21lc3NhZ2VJZH1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBwaW5uZWQgbWVzc2FnZXNcclxuICAgKi9cclxuICBhc3luYyBnZXRQaW5uZWRNZXNzYWdlcyhndWlsZElkOiBzdHJpbmcsIGNoYW5uZWxJZDogc3RyaW5nKTogUHJvbWlzZTxBUElNZXNzYWdlW10+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoJ0dFVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS9waW5zYCk7XHJcbiAgfVxyXG5cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PSBBdWRpdCBMb2cgPT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IHRoZSBhdWRpdCBsb2cgZm9yIGEgZ3VpbGQuXHJcbiAgICogUmVxdWlyZXMgVklFV19BVURJVF9MT0cgcGVybWlzc2lvbi5cclxuICAgKiBcclxuICAgKiBAcGFyYW0gZ3VpbGRJZCAtIFRoZSBJRCBvZiB0aGUgZ3VpbGRcclxuICAgKiBAcGFyYW0gb3B0aW9ucyAtIFF1ZXJ5IG9wdGlvbnNcclxuICAgKiBAcmV0dXJucyBBdWRpdCBsb2cgZW50cmllc1xyXG4gICAqIEB0aHJvd3Mge1JFU1RFcnJvcn0gSWYgdGhlIGJvdCBsYWNrcyBWSUVXX0FVRElUX0xPRyBwZXJtaXNzaW9uXHJcbiAgICogXHJcbiAgICogQGV4YW1wbGVcclxuICAgKiBgYGB0c1xyXG4gICAqIGNvbnN0IGxvZ3MgPSBhd2FpdCByZXN0LmdldEF1ZGl0TG9nKCcxMjMnLCB7IGxpbWl0OiA1MCB9KTtcclxuICAgKiBgYGBcclxuICAgKi9cclxuICBhc3luYyBnZXRBdWRpdExvZyhndWlsZElkOiBzdHJpbmcsIG9wdGlvbnM/OiB7XHJcbiAgICB1c2VyX2lkPzogc3RyaW5nO1xyXG4gICAgYWN0aW9uX3R5cGU/OiBudW1iZXI7XHJcbiAgICBiZWZvcmU/OiBzdHJpbmc7XHJcbiAgICBsaW1pdD86IG51bWJlcjtcclxuICB9KTogUHJvbWlzZTxBUElBdWRpdExvZz4ge1xyXG4gICAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcygpO1xyXG4gICAgaWYgKG9wdGlvbnM/LnVzZXJfaWQpIHBhcmFtcy5hcHBlbmQoJ3VzZXJfaWQnLCBvcHRpb25zLnVzZXJfaWQpO1xyXG4gICAgaWYgKG9wdGlvbnM/LmFjdGlvbl90eXBlICE9PSB1bmRlZmluZWQpIHBhcmFtcy5hcHBlbmQoJ2FjdGlvbl90eXBlJywgU3RyaW5nKG9wdGlvbnMuYWN0aW9uX3R5cGUpKTtcclxuICAgIGlmIChvcHRpb25zPy5iZWZvcmUpIHBhcmFtcy5hcHBlbmQoJ2JlZm9yZScsIG9wdGlvbnMuYmVmb3JlKTtcclxuICAgIGlmIChvcHRpb25zPy5saW1pdCAhPT0gdW5kZWZpbmVkKSBwYXJhbXMuYXBwZW5kKCdsaW1pdCcsIFN0cmluZyhvcHRpb25zLmxpbWl0KSk7XHJcbiAgICBcclxuICAgIGNvbnN0IHF1ZXJ5ID0gcGFyYW1zLnRvU3RyaW5nKCk7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PEFQSUF1ZGl0TG9nPignR0VUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vYXVkaXQtbG9ncyR7cXVlcnkgPyBgPyR7cXVlcnl9YCA6ICcnfWApO1xyXG4gIH1cclxuXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT0gVXNlcnMgPT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGEgdXNlclxyXG4gICAqL1xyXG4gIGFzeW5jIGdldFVzZXIodXNlcklkOiBzdHJpbmcpOiBQcm9taXNlPEFQSVVzZXI+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QVBJVXNlcj4oJ0dFVCcsIGAvYm90L3VzZXJzLyR7dXNlcklkfWApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGN1cnJlbnQgYm90IHVzZXJcclxuICAgKi9cclxuICBhc3luYyBnZXRDdXJyZW50VXNlcigpOiBQcm9taXNlPEFQSVVzZXI+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QVBJVXNlcj4oJ0dFVCcsIGAvYm90L3VzZXJzL0BtZWApO1xyXG4gIH1cclxuXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT0gSW52aXRlcyA9PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgYW4gaW52aXRlXHJcbiAgICovXHJcbiAgYXN5bmMgY3JlYXRlSW52aXRlKGd1aWxkSWQ6IHN0cmluZywgY2hhbm5lbElkOiBzdHJpbmcsIGRhdGE/OiB7XHJcbiAgICBtYXhfYWdlPzogbnVtYmVyO1xyXG4gICAgbWF4X3VzZXM/OiBudW1iZXI7XHJcbiAgICB0ZW1wb3Jhcnk/OiBib29sZWFuO1xyXG4gICAgdW5pcXVlPzogYm9vbGVhbjtcclxuICB9KTogUHJvbWlzZTxBUElJbnZpdGU+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QVBJSW52aXRlPignUE9TVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS9pbnZpdGVzYCwgZGF0YSB8fCB7fSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZWxldGUgYW4gaW52aXRlXHJcbiAgICovXHJcbiAgYXN5bmMgZGVsZXRlSW52aXRlKGludml0ZUNvZGU6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0PHZvaWQ+KCdERUxFVEUnLCBgL2JvdC9pbnZpdGVzLyR7aW52aXRlQ29kZX1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhbiBpbnZpdGVcclxuICAgKi9cclxuICBhc3luYyBnZXRJbnZpdGUoaW52aXRlQ29kZTogc3RyaW5nKTogUHJvbWlzZTxBUElJbnZpdGU+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QVBJSW52aXRlPignR0VUJywgYC9ib3QvaW52aXRlcy8ke2ludml0ZUNvZGV9YCk7XHJcbiAgfVxyXG5cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PSBXZWJob29rcyA9PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgY2hhbm5lbCB3ZWJob29rc1xyXG4gICAqL1xyXG4gIGFzeW5jIGdldENoYW5uZWxXZWJob29rcyhndWlsZElkOiBzdHJpbmcsIGNoYW5uZWxJZDogc3RyaW5nKTogUHJvbWlzZTxBUElXZWJob29rW10+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QVBJV2ViaG9va1tdPignR0VUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vY2hhbm5lbHMvJHtjaGFubmVsSWR9L3dlYmhvb2tzYCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgZ3VpbGQgd2ViaG9va3NcclxuICAgKi9cclxuICBhc3luYyBnZXRHdWlsZFdlYmhvb2tzKGd1aWxkSWQ6IHN0cmluZyk6IFByb21pc2U8QVBJV2ViaG9va1tdPiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PEFQSVdlYmhvb2tbXT4oJ0dFVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L3dlYmhvb2tzYCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgYSB3ZWJob29rXHJcbiAgICovXHJcbiAgYXN5bmMgY3JlYXRlV2ViaG9vayhndWlsZElkOiBzdHJpbmcsIGNoYW5uZWxJZDogc3RyaW5nLCBkYXRhOiB7XHJcbiAgICBuYW1lOiBzdHJpbmc7XHJcbiAgICBhdmF0YXI/OiBzdHJpbmc7XHJcbiAgfSk6IFByb21pc2U8QVBJV2ViaG9vaz4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBUElXZWJob29rPignUE9TVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS93ZWJob29rc2AsIGRhdGEpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVXBkYXRlIGEgd2ViaG9va1xyXG4gICAqL1xyXG4gIGFzeW5jIHVwZGF0ZVdlYmhvb2soZ3VpbGRJZDogc3RyaW5nLCB3ZWJob29rSWQ6IHN0cmluZywgZGF0YToge1xyXG4gICAgbmFtZT86IHN0cmluZztcclxuICAgIGF2YXRhcl91cmw/OiBzdHJpbmc7XHJcbiAgfSk6IFByb21pc2U8QVBJV2ViaG9vaz4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBUElXZWJob29rPignUEFUQ0gnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS93ZWJob29rcy8ke3dlYmhvb2tJZH1gLCBkYXRhKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlbGV0ZSBhIHdlYmhvb2tcclxuICAgKi9cclxuICBhc3luYyBkZWxldGVXZWJob29rKGd1aWxkSWQ6IHN0cmluZywgd2ViaG9va0lkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8dm9pZD4oJ0RFTEVURScsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L3dlYmhvb2tzLyR7d2ViaG9va0lkfWApO1xyXG4gIH1cclxuXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT0gR2VuZXJpYyBIVFRQIE1ldGhvZHMgPT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgLyoqXHJcbiAgICogTWFrZSBhIEdFVCByZXF1ZXN0IHRvIGFueSBBUEkgcGF0aFxyXG4gICAqIEBleGFtcGxlIGF3YWl0IGNsaWVudC5yZXN0LmdldCgnL2JvdC9ndWlsZHMvMTIzL2NoYW5uZWxzJyk7XHJcbiAgICovXHJcbiAgYXN5bmMgZ2V0PFQgPSBhbnk+KHBhdGg6IHN0cmluZyk6IFByb21pc2U8VD4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxUPignR0VUJywgcGF0aCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBNYWtlIGEgUE9TVCByZXF1ZXN0IHRvIGFueSBBUEkgcGF0aFxyXG4gICAqIEBleGFtcGxlIGF3YWl0IGNsaWVudC5yZXN0LnBvc3QoJy9ib3QvZ3VpbGRzLzEyMy9jaGFubmVscycsIHsgbmFtZTogJ25ldy1jaGFubmVsJywgdHlwZTogMiB9KTtcclxuICAgKi9cclxuICBhc3luYyBwb3N0PFQgPSBhbnk+KHBhdGg6IHN0cmluZywgYm9keT86IGFueSk6IFByb21pc2U8VD4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxUPignUE9TVCcsIHBhdGgsIGJvZHkpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogTWFrZSBhIFBBVENIIHJlcXVlc3QgdG8gYW55IEFQSSBwYXRoXHJcbiAgICogQGV4YW1wbGUgYXdhaXQgY2xpZW50LnJlc3QucGF0Y2goJy9ib3QvZ3VpbGRzLzEyMy9jaGFubmVscy80NTYnLCB7IG5hbWU6ICdyZW5hbWVkJyB9KTtcclxuICAgKi9cclxuICBhc3luYyBwYXRjaDxUID0gYW55PihwYXRoOiBzdHJpbmcsIGJvZHk/OiBhbnkpOiBQcm9taXNlPFQ+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8VD4oJ1BBVENIJywgcGF0aCwgYm9keSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBNYWtlIGEgUFVUIHJlcXVlc3QgdG8gYW55IEFQSSBwYXRoXHJcbiAgICogQGV4YW1wbGUgYXdhaXQgY2xpZW50LnJlc3QucHV0KCcvYm90L2NoYW5uZWxzLzQ1Ni9wZXJtaXNzaW9ucy83ODknLCB7IHR5cGU6IDAsIGFsbG93OiAnMTAyNCcgfSk7XHJcbiAgICovXHJcbiAgYXN5bmMgcHV0PFQgPSBhbnk+KHBhdGg6IHN0cmluZywgYm9keT86IGFueSk6IFByb21pc2U8VD4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxUPignUFVUJywgcGF0aCwgYm9keSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBNYWtlIGEgREVMRVRFIHJlcXVlc3QgdG8gYW55IEFQSSBwYXRoXHJcbiAgICogQGV4YW1wbGUgYXdhaXQgY2xpZW50LnJlc3QuZGVsZXRlKCcvYm90L2d1aWxkcy8xMjMvY2hhbm5lbHMvNDU2Jyk7XHJcbiAgICovXHJcbiAgYXN5bmMgZGVsZXRlPFQgPSBhbnk+KHBhdGg6IHN0cmluZyk6IFByb21pc2U8VD4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxUPignREVMRVRFJywgcGF0aCk7XHJcbiAgfVxyXG59XHJcbiJdfQ==