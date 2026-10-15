"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REST = void 0;
const serialize_1 = require("../utils/serialize");
const errors_1 = require("./errors");
/**
 * Sensitive field names that should be redacted in logs
 */
const SENSITIVE_FIELDS = ['token', 'authorization', 'password', 'secret', 'api_key', 'apikey', 'api-key'];
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
    /**
     * Redact sensitive data from objects/strings for safe logging.
     * Masks fields named 'token', 'authorization', 'password', 'secret', 'api_key' with '[REDACTED]'
     */
    redactSensitiveData(data) {
        if (data === null || data === undefined) {
            return data;
        }
        if (typeof data === 'string') {
            // Redact Bearer/Bot tokens in authorization headers
            return data.replace(/\b(Bearer|Bot)\s+[^\s"']+/gi, '$1 [REDACTED]');
        }
        if (Array.isArray(data)) {
            return data.map(item => this.redactSensitiveData(item));
        }
        if (typeof data === 'object') {
            const result = {};
            for (const [key, value] of Object.entries(data)) {
                const keyLower = key.toLowerCase();
                if (SENSITIVE_FIELDS.some(field => keyLower.includes(field))) {
                    result[key] = '[REDACTED]';
                }
                else {
                    result[key] = this.redactSensitiveData(value);
                }
            }
            return result;
        }
        return data;
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
        // ponytail: Bug #5 fix - number veya diğer tipler string'e çevrilir
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
    async request(method, path, body, retries = 3) {
        const url = `${this.baseUrl}${path}`;
        // Debug log - only when DEBUG_REST env is set, with sensitive data redacted
        if (process.env.DEBUG_REST) {
            const safeBody = body ? JSON.stringify(this.redactSensitiveData(body)) : '';
            console.log(`[REST] ${method} ${url}`, safeBody);
        }
        const response = await fetch(url, {
            method,
            headers: {
                'Authorization': `Bot ${this.token}`,
                'Content-Type': 'application/json',
                'User-Agent': 'JubbioBot/1.0 (+https://jubbio.com)'
            },
            body: body ? JSON.stringify(body) : undefined
        });
        // ponytail: Rate limit handling - retry after delay instead of crashing
        if (response.status === 429) {
            const errorData = await response.json().catch(() => ({}));
            const retryAfter = (errorData.retry_after || 1) * 1000; // Convert to ms
            if (retries > 0) {
                if (process.env.DEBUG_REST) {
                    console.log(`[REST] Rate limited, retrying in ${retryAfter}ms (${retries} retries left)`);
                }
                await new Promise(resolve => setTimeout(resolve, retryAfter));
                return this.request(method, path, body, retries - 1);
            }
            // No retries left, throw RateLimitError
            throw new errors_1.RateLimitError(retryAfter, method, path);
        }
        if (!response.ok) {
            const error = await response.text();
            throw new errors_1.RESTError(response.status, method, path, error);
        }
        // Handle empty responses
        const text = await response.text();
        if (!text)
            return {};
        return JSON.parse(text);
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
            messageData = this.prepareMessageData(data);
            // Add interaction_id if provided
            if (data.interactionId) {
                messageData.interaction_id = data.interactionId;
            }
            // ponytail: Bug #10 - Add flags if provided
            if (data.flags !== undefined) {
                messageData.flags = data.flags;
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
     * ponytail: DM için file + embed desteği
     */
    async createDMMessageWithFile(userId, data, files) {
        const FormData = require('form-data');
        const form = new FormData();
        // Add recipient_user_id
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
        const url = `${this.baseUrl}/bot/dm`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bot ${this.token}`,
                ...form.getHeaders()
            },
            body: form.getBuffer()
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`DM file upload failed: ${response.status} ${errorText}`);
        }
        return response.json();
    }
    /**
     * Edit a message
     * Automatically processes mentions
     */
    async editMessage(guildId, channelId, messageId, data) {
        const path = `/bot/guilds/${guildId}/channels/${channelId}/messages/${messageId}`;
        const processedData = this.prepareMessageData(data);
        return this.request('PATCH', path, processedData);
    }
    /**
     * Delete a message
     */
    async deleteMessage(guildId, channelId, messageId) {
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
        const validated = this.validateEmoji(emoji);
        const path = `/bot/guilds/${guildId}/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(validated)}/@me`;
        await this.request('PUT', path);
    }
    /**
     * Remove a reaction from a message
     * @param emoji - Unicode emoji (👍), :name:, <:name:id>, or <a:name:id> format
     */
    async removeReaction(guildId, channelId, messageId, emoji) {
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
        const url = `${this.baseUrl}/bot/guilds/${guildId}/channels/${channelId}/attachments`;
        if (process.env.DEBUG_REST) {
            console.log(`[REST] Uploading attachment: ${file.name} (${file.data.length} bytes)`);
        }
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bot ${this.token}`,
                ...form.getHeaders()
            },
            body: form.getBuffer()
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`API Error ${response.status}: ${error}`);
        }
        return response.json();
    }
    /**
     * Create a message with a file attachment
     * ponytail: embeds ve components desteği eklendi
     */
    async createMessageWithFile(guildId, channelId, data) {
        const FormData = require('form-data');
        const form = new FormData();
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
        const url = `${this.baseUrl}/bot/guilds/${guildId}/channels/${channelId}/messages`;
        if (process.env.DEBUG_REST) {
            console.log(`[REST] Creating message with file: ${data.file.name} (${data.file.data.length} bytes)${data.interactionId ? ` [interaction: ${data.interactionId}]` : ''}`);
        }
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bot ${this.token}`,
                ...form.getHeaders()
            },
            body: form.getBuffer()
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`API Error ${response.status}: ${error}`);
        }
        return response.json();
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
            if (data.data && (data.data.content || data.data.embeds)) {
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
            console.error(`❌ Interaction response error:`, error);
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
            // Create message with file - ponytail: embeds ve components da geçiriliyor
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
            const url = `${this.baseUrl}${endpoint}`;
            if (process.env.DEBUG_REST) {
                console.log(`[REST] createFollowup with ${data.files.length} file(s)`);
            }
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bot ${this.token}`,
                    ...form.getHeaders()
                },
                body: form.getBuffer()
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Followup with file failed: ${response.status} - ${errorText}`);
            }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUkVTVC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9yZXN0L1JFU1QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBaUJBLGtEQUF5RTtBQUN6RSxxQ0FBcUQ7QUErQnJEOztHQUVHO0FBQ0gsTUFBTSxnQkFBZ0IsR0FBRyxDQUFDLE9BQU8sRUFBRSxlQUFlLEVBQUUsVUFBVSxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsUUFBUSxFQUFFLFNBQVMsQ0FBQyxDQUFDO0FBRTFHOztHQUVHO0FBQ0gsTUFBYSxJQUFJO0lBQ1AsT0FBTyxDQUFTO0lBQ2hCLEtBQUssR0FBVyxFQUFFLENBQUM7SUFFM0IscURBQXFEO0lBQzdDLFNBQVMsR0FBNEIsSUFBSSxHQUFHLEVBQUUsQ0FBQztJQUN0QyxjQUFjLEdBQUcsQ0FBQyxHQUFHLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQyxXQUFXO0lBRTVELFlBQVksVUFBa0IsbUNBQW1DO1FBQy9ELElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO0lBQ3pCLENBQUM7SUFFRDs7O09BR0c7SUFDSyxtQkFBbUIsQ0FBQyxJQUFhO1FBQ3ZDLElBQUksSUFBSSxLQUFLLElBQUksSUFBSSxJQUFJLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDeEMsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDO1FBRUQsSUFBSSxPQUFPLElBQUksS0FBSyxRQUFRLEVBQUUsQ0FBQztZQUM3QixvREFBb0Q7WUFDcEQsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLDZCQUE2QixFQUFFLGVBQWUsQ0FBQyxDQUFDO1FBQ3RFLENBQUM7UUFFRCxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztZQUN4QixPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUMxRCxDQUFDO1FBRUQsSUFB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QUM3QixPQUFPLElBQUksQ0FBQyxPQUFPLENBQUksS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ3RDLENBQUM7SUFFRDs7O09BR0c7SUFDSCxLQUFLLENBQUMsSUFBSSxDQUFVLElBQVksRUFBRSxJQUFVO1FBQzFDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBSSxNQUFNLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQzdDLENBQUM7SUFFRDs7O09BR0c7SUFDSCxLQUFLLENBQUMsS0FBSyxDQUFVLElBQVksRUFBRSxJQUFVO1FBQzNDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBSSxPQUFPLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQzlDLENBQUM7SUFFRDs7O09BR0c7SUFDSCxLQUFLLENBQUMsR0FBRyxDQUFVLElBQVksRUFBRSxJQUFVO1FBQ3pDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBSSxLQUFLLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFFRDs7O09BR0c7SUFDSCxLQUFLLENBQUMsTUFBTSxDQUFVLElBQVk7UUFDaEMsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFJLFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUN6QyxDQUFDO0NBQ0Y7QUF2NURELG9CQXU1REMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBcclxuICBBUElNZXNzYWdlLCBcclxuICBBUElBcHBsaWNhdGlvbkNvbW1hbmQsIFxyXG4gIEFQSUVtYmVkLFxyXG4gIEFQSUd1aWxkRGF0YSxcclxuICBBUElNZW1iZXJEYXRhLFxyXG4gIEFQSU1lbWJlcnNSZXNwb25zZSxcclxuICBBUElSb2xlRGF0YSxcclxuICBBUElCYW4sXHJcbiAgQVBJSW52aXRlLFxyXG4gIEFQSUVtb2ppLFxyXG4gIEFQSVdlYmhvb2ssXHJcbiAgQVBJVXNlcixcclxuICBBUElDaGFubmVsLFxyXG4gIEFueUFjdGlvblJvdyxcclxuICBBUElBdWRpdExvZ1xyXG59IGZyb20gJy4uL3R5cGVzJztcclxuaW1wb3J0IHsgc2VyaWFsaXplQ29tcG9uZW50cywgbm9ybWFsaXplRW1iZWQgfSBmcm9tICcuLi91dGlscy9zZXJpYWxpemUnO1xyXG5pbXBvcnQgeyBSRVNURXJyb3IsIFJhdGVMaW1pdEVycm9yIH0gZnJvbSAnLi9lcnJvcnMnO1xyXG5cclxuLyoqXHJcbiAqIE1lbnRpb24gZGF0YSBzdHJ1Y3R1cmUgZm9yIG91ciBzeXN0ZW1cclxuICovXHJcbmV4cG9ydCBpbnRlcmZhY2UgTWVudGlvblVzZXIge1xyXG4gIGlkOiBzdHJpbmc7XHJcbiAgdXNlcm5hbWU6IHN0cmluZztcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBNZW50aW9uUm9sZSB7XHJcbiAgaWQ6IHN0cmluZztcclxuICBuYW1lPzogc3RyaW5nO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIE1lbnRpb25zRGF0YSB7XHJcbiAgdXNlcnM/OiBNZW50aW9uVXNlcltdO1xyXG4gIHJvbGVzPzogTWVudGlvblJvbGVbXTtcclxuICBldmVyeW9uZT86IGJvb2xlYW47XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBVc2VyIGNhY2hlIGVudHJ5XHJcbiAqL1xyXG5pbnRlcmZhY2UgQ2FjaGVkVXNlciB7XHJcbiAgaWQ6IHN0cmluZztcclxuICB1c2VybmFtZTogc3RyaW5nO1xyXG4gIGRpc3BsYXlOYW1lPzogc3RyaW5nO1xyXG4gIGNhY2hlZEF0OiBudW1iZXI7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTZW5zaXRpdmUgZmllbGQgbmFtZXMgdGhhdCBzaG91bGQgYmUgcmVkYWN0ZWQgaW4gbG9nc1xyXG4gKi9cclxuY29uc3QgU0VOU0lUSVZFX0ZJRUxEUyA9IFsndG9rZW4nLCAnYXV0aG9yaXphdGlvbicsICdwYXNzd29yZCcsICdzZWNyZXQnLCAnYXBpX2tleScsICdhcGlrZXknLCAnYXBpLWtleSddO1xyXG5cclxuLyoqXHJcbiAqIFJFU1QgQVBJIGNsaWVudCBmb3IgSnViYmlvXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgUkVTVCB7XHJcbiAgcHJpdmF0ZSBiYXNlVXJsOiBzdHJpbmc7XHJcbiAgcHJpdmF0ZSB0b2tlbjogc3RyaW5nID0gJyc7XHJcbiAgXHJcbiAgLy8gVXNlciBjYWNoZSBmb3IgbWVudGlvbiByZXNvbHV0aW9uIChJRCAtPiB1c2VybmFtZSlcclxuICBwcml2YXRlIHVzZXJDYWNoZTogTWFwPHN0cmluZywgQ2FjaGVkVXNlcj4gPSBuZXcgTWFwKCk7XHJcbiAgcHJpdmF0ZSByZWFkb25seSBVU0VSX0NBQ0hFX1RUTCA9IDUgKiA2MCAqIDEwMDA7IC8vIDUgZGFraWthXHJcblxyXG4gIGNvbnN0cnVjdG9yKGJhc2VVcmw6IHN0cmluZyA9ICdodHRwczovL2dhdGV3YXkuanViYmlvLmNvbS9hcGkvdjEnKSB7XHJcbiAgICB0aGlzLmJhc2VVcmwgPSBiYXNlVXJsO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVkYWN0IHNlbnNpdGl2ZSBkYXRhIGZyb20gb2JqZWN0cy9zdHJpbmdzIGZvciBzYWZlIGxvZ2dpbmcuXHJcbiAgICogTWFza3MgZmllbGRzIG5hbWVkICd0b2tlbicsICdhdXRob3JpemF0aW9uJywgJ3Bhc3N3b3JkJywgJ3NlY3JldCcsICdhcGlfa2V5JyB3aXRoICdbUkVEQUNURURdJ1xyXG4gICAqL1xyXG4gIHByaXZhdGUgcmVkYWN0U2Vuc2l0aXZlRGF0YShkYXRhOiB1bmtub3duKTogdW5rbm93biB7XHJcbiAgICBpZiAoZGF0YSA9PT0gbnVsbCB8fCBkYXRhID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgcmV0dXJuIGRhdGE7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHR5cGVvZiBkYXRhID09PSAnc3RyaW5nJykge1xyXG4gICAgICAvLyBSZWRhY3QgQmVhcmVyL0JvdCB0b2tlbnMgaW4gYXV0aG9yaXphdGlvbiBoZWFkZXJzXHJcbiAgICAgIHJldHVybiBkYXRhLnJlcGxhY2UoL1xcYihCZWFyZXJ8Qm90KVxccytbXlxcc1wiJ10rL2dpLCAnJDEgW1JFREFDVEVEXScpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChBcnJheS5pc0FycmF5KGRhdGEpKSB7XHJcbiAgICAgIHJldHVybiBkYXRhLm1hcChpdGVtID0+IHRoaXMucmVkYWN0U2Vuc2l0aXZlRGF0YShpdGVtKSk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHR5cGVvZiBkYXRhID09PSAnb2JqZWN0Jykge1xyXG4gICAgICBjb25zdCByZXN1bHQ6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge307XHJcbiAgICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKGRhdGEgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4pKSB7XHJcbiAgICAgICAgY29uc3Qga2V5TG93ZXIgPSBrZXkudG9Mb3dlckNhc2UoKTtcclxuICAgICAgICBpZiAoU0VOU0lUSVZFX0ZJRUxEUy5zb21lKGZpZWxkID0+IGtleUxvd2VyLmluY2x1ZGVzKGZpZWxkKSkpIHtcclxuICAgICAgICAgIHJlc3VsdFtrZXldID0gJ1tSRURBQ1RFRF0nO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICByZXN1bHRba2V5XSA9IHRoaXMucmVkYWN0U2Vuc2l0aXZlRGF0YSh2YWx1ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGRhdGE7XHJcbiAgfVxyXG5cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PSBNZW50aW9uIEhlbHBlcnMgPT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2FjaGUgYSB1c2VyIGZvciBtZW50aW9uIHJlc29sdXRpb25cclxuICAgKiBCb3QnbGFyIGludGVyYWN0aW9uJ2RhbiBnZWxlbiB1c2VyIGJpbGdpc2luaSBjYWNoZSdsZXllYmlsaXJcclxuICAgKi9cclxuICBjYWNoZVVzZXIodXNlcjogeyBpZDogc3RyaW5nIHwgbnVtYmVyOyB1c2VybmFtZTogc3RyaW5nOyBkaXNwbGF5TmFtZT86IHN0cmluZzsgZGlzcGxheV9uYW1lPzogc3RyaW5nIH0pOiB2b2lkIHtcclxuICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyh1c2VyLmlkKTtcclxuICAgIHRoaXMudXNlckNhY2hlLnNldCh1c2VySWQsIHtcclxuICAgICAgaWQ6IHVzZXJJZCxcclxuICAgICAgdXNlcm5hbWU6IHVzZXIudXNlcm5hbWUsXHJcbiAgICAgIGRpc3BsYXlOYW1lOiB1c2VyLmRpc3BsYXlOYW1lIHx8IHVzZXIuZGlzcGxheV9uYW1lLFxyXG4gICAgICBjYWNoZWRBdDogRGF0ZS5ub3coKVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDYWNoZSBtdWx0aXBsZSB1c2Vyc1xyXG4gICAqL1xyXG4gIGNhY2hlVXNlcnModXNlcnM6IEFycmF5PHsgaWQ6IHN0cmluZyB8IG51bWJlcjsgdXNlcm5hbWU6IHN0cmluZzsgZGlzcGxheU5hbWU/OiBzdHJpbmc7IGRpc3BsYXlfbmFtZT86IHN0cmluZyB9Pik6IHZvaWQge1xyXG4gICAgdXNlcnMuZm9yRWFjaCh1c2VyID0+IHRoaXMuY2FjaGVVc2VyKHVzZXIpKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBjYWNoZWQgdXNlciBieSBJRFxyXG4gICAqL1xyXG4gIGdldENhY2hlZFVzZXIodXNlcklkOiBzdHJpbmcpOiBDYWNoZWRVc2VyIHwgdW5kZWZpbmVkIHtcclxuICAgIGNvbnN0IGNhY2hlZCA9IHRoaXMudXNlckNhY2hlLmdldCh1c2VySWQpO1xyXG4gICAgaWYgKGNhY2hlZCAmJiBEYXRlLm5vdygpIC0gY2FjaGVkLmNhY2hlZEF0IDwgdGhpcy5VU0VSX0NBQ0hFX1RUTCkge1xyXG4gICAgICByZXR1cm4gY2FjaGVkO1xyXG4gICAgfVxyXG4gICAgLy8gRXhwaXJlZCwgcmVtb3ZlIGZyb20gY2FjaGVcclxuICAgIGlmIChjYWNoZWQpIHtcclxuICAgICAgdGhpcy51c2VyQ2FjaGUuZGVsZXRlKHVzZXJJZCk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRm9ybWF0IGEgdXNlciBtZW50aW9uXHJcbiAgICogUmV0dXJucyBib3RoIHRoZSB0ZXh0IGZvcm1hdCBhbmQgbWVudGlvbnMgZGF0YVxyXG4gICAqIFxyXG4gICAqIEBleGFtcGxlXHJcbiAgICogY29uc3QgbWVudGlvbiA9IHJlc3QuZm9ybWF0TWVudGlvbih1c2VyKTtcclxuICAgKiAvLyBtZW50aW9uLnRleHQgPSBcIjxAMT5cIlxyXG4gICAqIC8vIG1lbnRpb24uZGF0YSA9IHsgdXNlcnM6IFt7IGlkOiBcIjFcIiwgdXNlcm5hbWU6IFwiaWxrYXlcIiB9XSB9XHJcbiAgICovXHJcbiAgZm9ybWF0TWVudGlvbih1c2VyOiB7IGlkOiBzdHJpbmcgfCBudW1iZXI7IHVzZXJuYW1lOiBzdHJpbmcgfSk6IHsgdGV4dDogc3RyaW5nOyBkYXRhOiBNZW50aW9uc0RhdGEgfSB7XHJcbiAgICBjb25zdCB1c2VySWQgPSBTdHJpbmcodXNlci5pZCk7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICB0ZXh0OiBgPEAke3VzZXJJZH0+YCxcclxuICAgICAgZGF0YToge1xyXG4gICAgICAgIHVzZXJzOiBbeyBpZDogdXNlcklkLCB1c2VybmFtZTogdXNlci51c2VybmFtZSB9XVxyXG4gICAgICB9XHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUGFyc2UgbWVudGlvbnMgKDxASUQ+KSBpbiBjb250ZW50IGFuZCBidWlsZCBtZW50aW9ucyBkYXRhIHN0cnVjdHVyZVxyXG4gICAqIENvbnRlbnQgaXMga2VwdCBhcy1pcyB3aXRoIDxASUQ+IGZvcm1hdCAoY2xpZW50IHJlbmRlcnMgdGhlbSlcclxuICAgKiBcclxuICAgKiBAcGFyYW0gY29udGVudCAtIE1lc3NhZ2UgY29udGVudCB3aXRoIG1lbnRpb25zXHJcbiAgICogQHBhcmFtIGV4aXN0aW5nTWVudGlvbnMgLSBFeGlzdGluZyBtZW50aW9ucyBkYXRhIHRvIG1lcmdlIHdpdGhcclxuICAgKiBAcmV0dXJucyBPcmlnaW5hbCBjb250ZW50IGFuZCBtZW50aW9ucyBkYXRhXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBwcm9jZXNzTWVudGlvbnMoY29udGVudDogc3RyaW5nIHwgbnVtYmVyIHwgdW5rbm93biwgZXhpc3RpbmdNZW50aW9ucz86IE1lbnRpb25zRGF0YSk6IHsgY29udGVudDogc3RyaW5nOyBtZW50aW9uczogTWVudGlvbnNEYXRhIH0ge1xyXG4gICAgLy8gcG9ueXRhaWw6IEJ1ZyAjNSBmaXggLSBudW1iZXIgdmV5YSBkacSfZXIgdGlwbGVyIHN0cmluZydlIMOnZXZyaWxpclxyXG4gICAgY29uc3QgY29udGVudFN0ciA9IFN0cmluZyhjb250ZW50ID8/ICcnKTtcclxuICAgIFxyXG4gICAgY29uc3QgbWVudGlvbnM6IE1lbnRpb25zRGF0YSA9IHtcclxuICAgICAgdXNlcnM6IFsuLi4oZXhpc3RpbmdNZW50aW9ucz8udXNlcnMgfHwgW10pXSxcclxuICAgICAgcm9sZXM6IFsuLi4oZXhpc3RpbmdNZW50aW9ucz8ucm9sZXMgfHwgW10pXSxcclxuICAgICAgZXZlcnlvbmU6IGV4aXN0aW5nTWVudGlvbnM/LmV2ZXJ5b25lXHJcbiAgICB9O1xyXG5cclxuICAgIC8vIFRyYWNrIGFscmVhZHkgYWRkZWQgdXNlciBJRHMgdG8gYXZvaWQgZHVwbGljYXRlc1xyXG4gICAgY29uc3QgYWRkZWRVc2VySWRzID0gbmV3IFNldChtZW50aW9ucy51c2Vycz8ubWFwKHUgPT4gdS5pZCkgfHwgW10pO1xyXG5cclxuICAgIC8vIFBhcnNlIDxASUQ+IGZvcm1hdCAodXNlciBtZW50aW9ucykg4oCUIGtlZXAgY29udGVudCBhcy1pcywgb25seSBidWlsZCBtZW50aW9ucyBkYXRhXHJcbiAgICBjb25zdCB1c2VyTWVudGlvblJlZ2V4ID0gLzxAIT8oXFxkKyk+L2c7XHJcbiAgICBsZXQgbWF0Y2g7XHJcblxyXG4gICAgd2hpbGUgKChtYXRjaCA9IHVzZXJNZW50aW9uUmVnZXguZXhlYyhjb250ZW50U3RyKSkgIT09IG51bGwpIHtcclxuICAgICAgY29uc3QgdXNlcklkID0gU3RyaW5nKG1hdGNoWzFdKTtcclxuXHJcbiAgICAgIGlmICghYWRkZWRVc2VySWRzLmhhcyh1c2VySWQpKSB7XHJcbiAgICAgICAgLy8gVHJ5IHRvIGdldCB1c2VybmFtZSBmcm9tIGNhY2hlIGZvciBtZW50aW9ucyBkYXRhXHJcbiAgICAgICAgY29uc3QgY2FjaGVkVXNlciA9IHRoaXMuZ2V0Q2FjaGVkVXNlcih1c2VySWQpO1xyXG4gICAgICAgIG1lbnRpb25zLnVzZXJzIS5wdXNoKHsgaWQ6IHVzZXJJZCwgdXNlcm5hbWU6IGNhY2hlZFVzZXI/LnVzZXJuYW1lIHx8IGBVc2VyXyR7dXNlcklkfWAgfSk7XHJcbiAgICAgICAgYWRkZWRVc2VySWRzLmFkZCh1c2VySWQpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8gUGFyc2UgPEAmSUQ+IGZvcm1hdCAocm9sZSBtZW50aW9ucykg4oCUIGtlZXAgY29udGVudCBhcy1pc1xyXG4gICAgY29uc3Qgcm9sZU1lbnRpb25SZWdleCA9IC88QCYoXFxkKyk+L2c7XHJcbiAgICBjb25zdCBhZGRlZFJvbGVJZHMgPSBuZXcgU2V0KG1lbnRpb25zLnJvbGVzPy5tYXAociA9PiByLmlkKSB8fCBbXSk7XHJcblxyXG4gICAgd2hpbGUgKChtYXRjaCA9IHJvbGVNZW50aW9uUmVnZXguZXhlYyhjb250ZW50U3RyKSkgIT09IG51bGwpIHtcclxuICAgICAgY29uc3Qgcm9sZUlkID0gbWF0Y2hbMV07XHJcbiAgICAgIGlmICghYWRkZWRSb2xlSWRzLmhhcyhyb2xlSWQpKSB7XHJcbiAgICAgICAgbWVudGlvbnMucm9sZXMhLnB1c2goeyBpZDogcm9sZUlkIH0pO1xyXG4gICAgICAgIGFkZGVkUm9sZUlkcy5hZGQocm9sZUlkKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIFBhcnNlIEBldmVyeW9uZSBhbmQgQGhlcmVcclxuICAgIGlmIChjb250ZW50U3RyLmluY2x1ZGVzKCdAZXZlcnlvbmUnKSkge1xyXG4gICAgICBtZW50aW9ucy5ldmVyeW9uZSA9IHRydWU7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gQ2xlYW4gdXAgZW1wdHkgYXJyYXlzXHJcbiAgICBpZiAobWVudGlvbnMudXNlcnM/Lmxlbmd0aCA9PT0gMCkgZGVsZXRlIG1lbnRpb25zLnVzZXJzO1xyXG4gICAgaWYgKG1lbnRpb25zLnJvbGVzPy5sZW5ndGggPT09IDApIGRlbGV0ZSBtZW50aW9ucy5yb2xlcztcclxuXHJcbiAgICByZXR1cm4geyBjb250ZW50OiBjb250ZW50U3RyLCBtZW50aW9ucyB9O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUHJlcGFyZSBtZXNzYWdlIGRhdGEgd2l0aCBwcm9jZXNzZWQgbWVudGlvbnNcclxuICAgKiBBdXRvbWF0aWNhbGx5IGNvbnZlcnRzIG1lbnRpb25zIHRvIG91ciBmb3JtYXRcclxuICAgKi9cclxuICBwcml2YXRlIHByZXBhcmVNZXNzYWdlRGF0YShkYXRhOiB7XHJcbiAgICBjb250ZW50Pzogc3RyaW5nO1xyXG4gICAgZW1iZWRzPzogQVBJRW1iZWRbXTtcclxuICAgIGNvbXBvbmVudHM/OiBBbnlBY3Rpb25Sb3dbXSB8IHVua25vd25bXTtcclxuICAgIG1lbnRpb25zPzogTWVudGlvbnNEYXRhO1xyXG4gICAgbWVzc2FnZV9yZWZlcmVuY2U/OiB7IG1lc3NhZ2VfaWQ6IHN0cmluZyB9O1xyXG4gIH0pOiB7IFxyXG4gICAgY29udGVudD86IHN0cmluZzsgXHJcbiAgICBlbWJlZHM/OiBBUElFbWJlZFtdOyBcclxuICAgIGNvbXBvbmVudHM/OiB1bmtub3duW107IFxyXG4gICAgbWVudGlvbnM/OiBNZW50aW9uc0RhdGE7XHJcbiAgICBtZXNzYWdlX3JlZmVyZW5jZT86IHsgbWVzc2FnZV9pZDogc3RyaW5nIH07XHJcbiAgfSB7XHJcbiAgICBjb25zdCByZXN1bHQ6IHsgXHJcbiAgICAgIGNvbnRlbnQ/OiBzdHJpbmc7IFxyXG4gICAgICBlbWJlZHM/OiBBUElFbWJlZFtdOyBcclxuICAgICAgY29tcG9uZW50cz86IHVua25vd25bXTsgXHJcbiAgICAgIG1lbnRpb25zPzogTWVudGlvbnNEYXRhO1xyXG4gICAgICBtZXNzYWdlX3JlZmVyZW5jZT86IHsgbWVzc2FnZV9pZDogc3RyaW5nIH07XHJcbiAgICB9ID0geyAuLi5kYXRhIH07XHJcblxyXG4gICAgLy8gUmVzb2x2ZSBjb21wb25lbnRzIChBY3Rpb25Sb3dCdWlsZGVyIC8gQnV0dG9uQnVpbGRlciBpbnN0YW5jZXMpXHJcbiAgICBpZiAoZGF0YS5jb21wb25lbnRzICYmIGRhdGEuY29tcG9uZW50cy5sZW5ndGggPiAwKSB7XHJcbiAgICAgIHJlc3VsdC5jb21wb25lbnRzID0gc2VyaWFsaXplQ29tcG9uZW50cyhkYXRhLmNvbXBvbmVudHMgYXMgdW5rbm93bltdKTtcclxuICAgIH1cclxuXHJcbiAgICBsZXQgYWxsTWVudGlvbnM6IE1lbnRpb25zRGF0YSA9IHsgLi4uZGF0YS5tZW50aW9ucyB9O1xyXG5cclxuICAgIC8vIFByb2Nlc3MgbWVudGlvbnMgaW4gY29udGVudCBpZiBwcmVzZW50XHJcbiAgICBpZiAoZGF0YS5jb250ZW50KSB7XHJcbiAgICAgIGNvbnN0IHsgY29udGVudCwgbWVudGlvbnMgfSA9IHRoaXMucHJvY2Vzc01lbnRpb25zKGRhdGEuY29udGVudCwgYWxsTWVudGlvbnMpO1xyXG4gICAgICByZXN1bHQuY29udGVudCA9IGNvbnRlbnQ7XHJcbiAgICAgIGFsbE1lbnRpb25zID0gbWVudGlvbnM7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gUHJvY2VzcyBtZW50aW9ucyBpbiBlbWJlZHMgKGRlc2NyaXB0aW9uLCB0aXRsZSwgZm9vdGVyLCBmaWVsZHMpXHJcbiAgICBpZiAoZGF0YS5lbWJlZHMgJiYgZGF0YS5lbWJlZHMubGVuZ3RoID4gMCkge1xyXG4gICAgICByZXN1bHQuZW1iZWRzID0gZGF0YS5lbWJlZHMubWFwKGVtYmVkID0+IHtcclxuICAgICAgICAvLyBOb3JtYWxpemUgZW1iZWQgKGhhbmRsZXMgRW1iZWRCdWlsZGVyLCBjb2xvcnMsIHRpbWVzdGFtcHMsIGljb25VUkwg4oaSIGljb25fdXJsLCBldGMuKVxyXG4gICAgICAgIGNvbnN0IHByb2Nlc3NlZEVtYmVkID0gbm9ybWFsaXplRW1iZWQoZW1iZWQpIGFzIEFQSUVtYmVkICYgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XHJcblxyXG4gICAgICAgIC8vIEdldCB0aGUgcmF3IGVtYmVkIGZvciBtZW50aW9uIHByb2Nlc3NpbmdcclxuICAgICAgICBjb25zdCByYXdFbWJlZCA9IHR5cGVvZiAoZW1iZWQgYXMgeyB0b0pTT04/OiAoKSA9PiBBUElFbWJlZCB9KS50b0pTT04gPT09ICdmdW5jdGlvbicgXHJcbiAgICAgICAgICA/IChlbWJlZCBhcyB7IHRvSlNPTjogKCkgPT4gQVBJRW1iZWQgfSkudG9KU09OKCkgXHJcbiAgICAgICAgICA6IGVtYmVkO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIFByb2Nlc3MgZGVzY3JpcHRpb25cclxuICAgICAgICBpZiAocmF3RW1iZWQuZGVzY3JpcHRpb24pIHtcclxuICAgICAgICAgIGNvbnN0IHsgY29udGVudCwgbWVudGlvbnMgfSA9IHRoaXMucHJvY2Vzc01lbnRpb25zKHJhd0VtYmVkLmRlc2NyaXB0aW9uLCBhbGxNZW50aW9ucyk7XHJcbiAgICAgICAgICBwcm9jZXNzZWRFbWJlZC5kZXNjcmlwdGlvbiA9IGNvbnRlbnQ7XHJcbiAgICAgICAgICBhbGxNZW50aW9ucyA9IG1lbnRpb25zO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICAvLyBQcm9jZXNzIHRpdGxlXHJcbiAgICAgICAgaWYgKHJhd0VtYmVkLnRpdGxlKSB7XHJcbiAgICAgICAgICBjb25zdCB7IGNvbnRlbnQsIG1lbnRpb25zIH0gPSB0aGlzLnByb2Nlc3NNZW50aW9ucyhyYXdFbWJlZC50aXRsZSwgYWxsTWVudGlvbnMpO1xyXG4gICAgICAgICAgcHJvY2Vzc2VkRW1iZWQudGl0bGUgPSBjb250ZW50O1xyXG4gICAgICAgICAgYWxsTWVudGlvbnMgPSBtZW50aW9ucztcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gUHJvY2VzcyBmb290ZXIgdGV4dFxyXG4gICAgICAgIGlmIChyYXdFbWJlZC5mb290ZXI/LnRleHQpIHtcclxuICAgICAgICAgIGNvbnN0IHsgY29udGVudCwgbWVudGlvbnMgfSA9IHRoaXMucHJvY2Vzc01lbnRpb25zKHJhd0VtYmVkLmZvb3Rlci50ZXh0LCBhbGxNZW50aW9ucyk7XHJcbiAgICAgICAgICBwcm9jZXNzZWRFbWJlZC5mb290ZXIgPSB7IC4uLihwcm9jZXNzZWRFbWJlZC5mb290ZXIgPz8ge30pLCB0ZXh0OiBjb250ZW50IH07XHJcbiAgICAgICAgICBhbGxNZW50aW9ucyA9IG1lbnRpb25zO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICAvLyBQcm9jZXNzIGZpZWxkc1xyXG4gICAgICAgIGlmIChyYXdFbWJlZC5maWVsZHMgJiYgcmF3RW1iZWQuZmllbGRzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgIHByb2Nlc3NlZEVtYmVkLmZpZWxkcyA9IHJhd0VtYmVkLmZpZWxkcy5tYXAoKGZpZWxkOiB7IG5hbWU6IHN0cmluZzsgdmFsdWU6IHN0cmluZzsgaW5saW5lPzogYm9vbGVhbiB9KSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IHByb2Nlc3NlZEZpZWxkOiB7IG5hbWU6IHN0cmluZzsgdmFsdWU6IHN0cmluZzsgaW5saW5lPzogYm9vbGVhbiB9ID0geyAuLi5maWVsZCB9O1xyXG4gICAgICAgICAgICBpZiAoZmllbGQudmFsdWUpIHtcclxuICAgICAgICAgICAgICBjb25zdCB7IGNvbnRlbnQsIG1lbnRpb25zIH0gPSB0aGlzLnByb2Nlc3NNZW50aW9ucyhmaWVsZC52YWx1ZSwgYWxsTWVudGlvbnMpO1xyXG4gICAgICAgICAgICAgIHByb2Nlc3NlZEZpZWxkLnZhbHVlID0gY29udGVudDtcclxuICAgICAgICAgICAgICBhbGxNZW50aW9ucyA9IG1lbnRpb25zO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChmaWVsZC5uYW1lKSB7XHJcbiAgICAgICAgICAgICAgY29uc3QgeyBjb250ZW50LCBtZW50aW9ucyB9ID0gdGhpcy5wcm9jZXNzTWVudGlvbnMoZmllbGQubmFtZSwgYWxsTWVudGlvbnMpO1xyXG4gICAgICAgICAgICAgIHByb2Nlc3NlZEZpZWxkLm5hbWUgPSBjb250ZW50O1xyXG4gICAgICAgICAgICAgIGFsbE1lbnRpb25zID0gbWVudGlvbnM7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHByb2Nlc3NlZEZpZWxkO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBwcm9jZXNzZWRFbWJlZDtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gQWRkIG1lcmdlZCBtZW50aW9ucyB0byByZXN1bHRcclxuICAgIGlmIChhbGxNZW50aW9ucy51c2Vycz8ubGVuZ3RoIHx8IGFsbE1lbnRpb25zLnJvbGVzPy5sZW5ndGggfHwgYWxsTWVudGlvbnMuZXZlcnlvbmUpIHtcclxuICAgICAgcmVzdWx0Lm1lbnRpb25zID0gYWxsTWVudGlvbnM7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldCB0aGUgYm90IHRva2VuXHJcbiAgICovXHJcbiAgc2V0VG9rZW4odG9rZW46IHN0cmluZyk6IHRoaXMge1xyXG4gICAgdGhpcy50b2tlbiA9IHRva2VuO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBNYWtlIGFuIGF1dGhlbnRpY2F0ZWQgcmVxdWVzdCB3aXRoIHJhdGUgbGltaXQgcmV0cnlcclxuICAgKi9cclxuICBwcml2YXRlIGFzeW5jIHJlcXVlc3Q8VD4obWV0aG9kOiBzdHJpbmcsIHBhdGg6IHN0cmluZywgYm9keT86IGFueSwgcmV0cmllcyA9IDMpOiBQcm9taXNlPFQ+IHtcclxuICAgIGNvbnN0IHVybCA9IGAke3RoaXMuYmFzZVVybH0ke3BhdGh9YDtcclxuICAgIFxyXG4gICAgLy8gRGVidWcgbG9nIC0gb25seSB3aGVuIERFQlVHX1JFU1QgZW52IGlzIHNldCwgd2l0aCBzZW5zaXRpdmUgZGF0YSByZWRhY3RlZFxyXG4gICAgaWYgKHByb2Nlc3MuZW52LkRFQlVHX1JFU1QpIHtcclxuICAgICAgY29uc3Qgc2FmZUJvZHkgPSBib2R5ID8gSlNPTi5zdHJpbmdpZnkodGhpcy5yZWRhY3RTZW5zaXRpdmVEYXRhKGJvZHkpKSA6ICcnO1xyXG4gICAgICBjb25zb2xlLmxvZyhgW1JFU1RdICR7bWV0aG9kfSAke3VybH1gLCBzYWZlQm9keSk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godXJsLCB7XHJcbiAgICAgIG1ldGhvZCxcclxuICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgICdBdXRob3JpemF0aW9uJzogYEJvdCAke3RoaXMudG9rZW59YCxcclxuICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxyXG4gICAgICAgICdVc2VyLUFnZW50JzogJ0p1YmJpb0JvdC8xLjAgKCtodHRwczovL2p1YmJpby5jb20pJ1xyXG4gICAgICB9LFxyXG4gICAgICBib2R5OiBib2R5ID8gSlNPTi5zdHJpbmdpZnkoYm9keSkgOiB1bmRlZmluZWRcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIHBvbnl0YWlsOiBSYXRlIGxpbWl0IGhhbmRsaW5nIC0gcmV0cnkgYWZ0ZXIgZGVsYXkgaW5zdGVhZCBvZiBjcmFzaGluZ1xyXG4gICAgaWYgKHJlc3BvbnNlLnN0YXR1cyA9PT0gNDI5KSB7XHJcbiAgICAgIGNvbnN0IGVycm9yRGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKS5jYXRjaCgoKSA9PiAoe30pKSBhcyB7IHJldHJ5X2FmdGVyPzogbnVtYmVyIH07XHJcbiAgICAgIGNvbnN0IHJldHJ5QWZ0ZXIgPSAoZXJyb3JEYXRhLnJldHJ5X2FmdGVyIHx8IDEpICogMTAwMDsgLy8gQ29udmVydCB0byBtc1xyXG4gICAgICBcclxuICAgICAgaWYgKHJldHJpZXMgPiAwKSB7XHJcbiAgICAgICAgaWYgKHByb2Nlc3MuZW52LkRFQlVHX1JFU1QpIHtcclxuICAgICAgICAgIGNvbnNvbGUubG9nKGBbUkVTVF0gUmF0ZSBsaW1pdGVkLCByZXRyeWluZyBpbiAke3JldHJ5QWZ0ZXJ9bXMgKCR7cmV0cmllc30gcmV0cmllcyBsZWZ0KWApO1xyXG4gICAgICAgIH1cclxuICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgcmV0cnlBZnRlcikpO1xyXG4gICAgICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8VD4obWV0aG9kLCBwYXRoLCBib2R5LCByZXRyaWVzIC0gMSk7XHJcbiAgICAgIH1cclxuICAgICAgXHJcbiAgICAgIC8vIE5vIHJldHJpZXMgbGVmdCwgdGhyb3cgUmF0ZUxpbWl0RXJyb3JcclxuICAgICAgdGhyb3cgbmV3IFJhdGVMaW1pdEVycm9yKHJldHJ5QWZ0ZXIsIG1ldGhvZCwgcGF0aCk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCFyZXNwb25zZS5vaykge1xyXG4gICAgICBjb25zdCBlcnJvciA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKTtcclxuICAgICAgdGhyb3cgbmV3IFJFU1RFcnJvcihyZXNwb25zZS5zdGF0dXMsIG1ldGhvZCwgcGF0aCwgZXJyb3IpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIEhhbmRsZSBlbXB0eSByZXNwb25zZXNcclxuICAgIGNvbnN0IHRleHQgPSBhd2FpdCByZXNwb25zZS50ZXh0KCk7XHJcbiAgICBpZiAoIXRleHQpIHJldHVybiB7fSBhcyBUO1xyXG4gICAgXHJcbiAgICByZXR1cm4gSlNPTi5wYXJzZSh0ZXh0KTtcclxuICB9XHJcblxyXG4gIC8vID09PT09PT09PT09PT09PT09PT09IE1lc3NhZ2VzID09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIG1lc3NhZ2UgaW4gYSBjaGFubmVsXHJcbiAgICogTWVudGlvbnMgdXNlIDxASUQ+IGZvcm1hdCBhbmQgYXJlIGtlcHQgYXMtaXMgKGNsaWVudCByZW5kZXJzIHRoZW0pXHJcbiAgICogXHJcbiAgICogQGV4YW1wbGVcclxuICAgKiBhd2FpdCByZXN0LmNyZWF0ZU1lc3NhZ2UoZ3VpbGRJZCwgY2hhbm5lbElkLCB7XHJcbiAgICogICBjb250ZW50OiAnSGVsbG8gPEAxMjM+IScsXHJcbiAgICogfSk7XHJcbiAgICovXHJcbiAgYXN5bmMgY3JlYXRlTWVzc2FnZShndWlsZElkT3JDaGFubmVsSWQ6IHN0cmluZywgY2hhbm5lbElkT3JEYXRhOiBzdHJpbmcgfCB7XHJcbiAgICBjb250ZW50Pzogc3RyaW5nO1xyXG4gICAgZW1iZWRzPzogQVBJRW1iZWRbXTtcclxuICAgIGNvbXBvbmVudHM/OiBhbnlbXTtcclxuICAgIG1lbnRpb25zPzogTWVudGlvbnNEYXRhO1xyXG4gICAgZmlsZXM/OiBBcnJheTx7IG5hbWU6IHN0cmluZzsgZGF0YTogQnVmZmVyIH0+O1xyXG4gICAgbWVzc2FnZV9yZWZlcmVuY2U/OiB7IG1lc3NhZ2VfaWQ6IHN0cmluZyB9O1xyXG4gICAgaW50ZXJhY3Rpb25JZD86IHN0cmluZztcclxuICAgIGZsYWdzPzogbnVtYmVyOyAgLy8gcG9ueXRhaWw6IEJ1ZyAjMTAgLSBmbGFncyBkZXN0ZcSfaSAoTWVzc2FnZUZsYWdzLlN1cHByZXNzRW1iZWRzIHZiLilcclxuICB9LCBkYXRhPzoge1xyXG4gICAgY29udGVudD86IHN0cmluZztcclxuICAgIGVtYmVkcz86IEFQSUVtYmVkW107XHJcbiAgICBjb21wb25lbnRzPzogYW55W107XHJcbiAgICBtZW50aW9ucz86IE1lbnRpb25zRGF0YTtcclxuICAgIGZpbGVzPzogQXJyYXk8eyBuYW1lOiBzdHJpbmc7IGRhdGE6IEJ1ZmZlciB9PjtcclxuICAgIG1lc3NhZ2VfcmVmZXJlbmNlPzogeyBtZXNzYWdlX2lkOiBzdHJpbmcgfTtcclxuICAgIGludGVyYWN0aW9uSWQ/OiBzdHJpbmc7XHJcbiAgICBmbGFncz86IG51bWJlcjsgIC8vIHBvbnl0YWlsOiBCdWcgIzEwIC0gZmxhZ3MgZGVzdGXEn2lcclxuICB9KTogUHJvbWlzZTxBUElNZXNzYWdlPiB7XHJcbiAgICAvLyDEsGtpIGt1bGxhbsSxbSDFn2VrbGk6XHJcbiAgICAvLyAxLiBjcmVhdGVNZXNzYWdlKGd1aWxkSWQsIGNoYW5uZWxJZCwgZGF0YSkgLSBndWlsZElkIGlsZSAodGVyY2loIGVkaWxlbilcclxuICAgIC8vIDIuIGNyZWF0ZU1lc3NhZ2UoY2hhbm5lbElkLCBkYXRhKSAtIGd1aWxkSWQgb2xtYWRhbiAoZXNraSBmb3JtYXQsIGhhdGEgdmVyaXIpXHJcbiAgICBcclxuICAgIGxldCBndWlsZElkOiBzdHJpbmc7XHJcbiAgICBsZXQgY2hhbm5lbElkOiBzdHJpbmc7XHJcbiAgICBsZXQgbWVzc2FnZURhdGE6IGFueTtcclxuICAgIFxyXG4gICAgaWYgKHR5cGVvZiBjaGFubmVsSWRPckRhdGEgPT09ICdzdHJpbmcnICYmIGRhdGEpIHtcclxuICAgICAgLy8gWWVuaSBmb3JtYXQ6IGNyZWF0ZU1lc3NhZ2UoZ3VpbGRJZCwgY2hhbm5lbElkLCBkYXRhKVxyXG4gICAgICBndWlsZElkID0gZ3VpbGRJZE9yQ2hhbm5lbElkO1xyXG4gICAgICBjaGFubmVsSWQgPSBjaGFubmVsSWRPckRhdGE7XHJcbiAgICAgIG1lc3NhZ2VEYXRhID0gdGhpcy5wcmVwYXJlTWVzc2FnZURhdGEoZGF0YSk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBBZGQgaW50ZXJhY3Rpb25faWQgaWYgcHJvdmlkZWRcclxuICAgICAgaWYgKGRhdGEuaW50ZXJhY3Rpb25JZCkge1xyXG4gICAgICAgIG1lc3NhZ2VEYXRhLmludGVyYWN0aW9uX2lkID0gZGF0YS5pbnRlcmFjdGlvbklkO1xyXG4gICAgICB9XHJcbiAgICAgIFxyXG4gICAgICAvLyBwb255dGFpbDogQnVnICMxMCAtIEFkZCBmbGFncyBpZiBwcm92aWRlZFxyXG4gICAgICBpZiAoZGF0YS5mbGFncyAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgbWVzc2FnZURhdGEuZmxhZ3MgPSBkYXRhLmZsYWdzO1xyXG4gICAgICB9XHJcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBjaGFubmVsSWRPckRhdGEgPT09ICdvYmplY3QnKSB7XHJcbiAgICAgIC8vIEVza2kgZm9ybWF0OiBjcmVhdGVNZXNzYWdlKGNoYW5uZWxJZCwgZGF0YSkgLSBndWlsZElkIHlva1xyXG4gICAgICAvLyBCdSBmb3JtYXQgYXJ0xLFrIGRlc3Rla2xlbm1peW9yLCBoYXRhIGbEsXJsYXRcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdjcmVhdGVNZXNzYWdlIHJlcXVpcmVzIGd1aWxkSWQ6IGNyZWF0ZU1lc3NhZ2UoZ3VpbGRJZCwgY2hhbm5lbElkLCBkYXRhKScpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGNyZWF0ZU1lc3NhZ2UgYXJndW1lbnRzJyk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QVBJTWVzc2FnZT4oJ1BPU1QnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH0vbWVzc2FnZXNgLCBtZXNzYWdlRGF0YSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgYW4gZXBoZW1lcmFsIG1lc3NhZ2UgdGhhdCBpcyBvbmx5IHZpc2libGUgdG8gYSBzcGVjaWZpYyB1c2VyXHJcbiAgICogRXBoZW1lcmFsIG1lc3NhZ2VzIGFyZSBOT1Qgc2F2ZWQgdG8gZGF0YWJhc2UgLSB0aGV5IGFyZSBvbmx5IHNlbnQgdmlhIFdlYlNvY2tldFxyXG4gICAqIFxyXG4gICAqIEBleGFtcGxlXHJcbiAgICogLy8gU2VuZCBhIHdhcm5pbmcgb25seSB2aXNpYmxlIHRvIHRoZSB1c2VyXHJcbiAgICogYXdhaXQgcmVzdC5jcmVhdGVFcGhlbWVyYWxNZXNzYWdlKGd1aWxkSWQsIGNoYW5uZWxJZCwgdGFyZ2V0VXNlcklkLCB7XHJcbiAgICogICBlbWJlZHM6IFt3YXJuaW5nRW1iZWRdXHJcbiAgICogfSk7XHJcbiAgICovXHJcbiAgYXN5bmMgY3JlYXRlRXBoZW1lcmFsTWVzc2FnZShndWlsZElkOiBzdHJpbmcsIGNoYW5uZWxJZDogc3RyaW5nLCB0YXJnZXRVc2VySWQ6IHN0cmluZyB8IG51bWJlciwgZGF0YToge1xyXG4gICAgY29udGVudD86IHN0cmluZztcclxuICAgIGVtYmVkcz86IEFQSUVtYmVkW107XHJcbiAgICBjb21wb25lbnRzPzogYW55W107XHJcbiAgfSk6IFByb21pc2U8eyBpZDogc3RyaW5nOyBlcGhlbWVyYWw6IGJvb2xlYW47IGZsYWdzOiBudW1iZXIgfT4ge1xyXG4gICAgY29uc3QgbWVzc2FnZURhdGEgPSB0aGlzLnByZXBhcmVNZXNzYWdlRGF0YShkYXRhKTtcclxuICAgIFxyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDx7IGlkOiBzdHJpbmc7IGVwaGVtZXJhbDogYm9vbGVhbjsgZmxhZ3M6IG51bWJlciB9PignUE9TVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS9tZXNzYWdlc2AsIHtcclxuICAgICAgLi4ubWVzc2FnZURhdGEsXHJcbiAgICAgIGZsYWdzOiA2NCwgLy8gRVBIRU1FUkFMIGZsYWdcclxuICAgICAgdGFyZ2V0X3VzZXJfaWQ6IHR5cGVvZiB0YXJnZXRVc2VySWQgPT09ICdzdHJpbmcnID8gcGFyc2VJbnQodGFyZ2V0VXNlcklkLCAxMCkgOiB0YXJnZXRVc2VySWRcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgRE0gbWVzc2FnZSB0byBhIHVzZXJcclxuICAgKiBBdXRvbWF0aWNhbGx5IHByb2Nlc3NlcyBlbWJlZHMgKGNvbnZlcnRzIEVtYmVkQnVpbGRlciB0byBKU09OLCBub3JtYWxpemVzIGNvbG9ycywgdGltZXN0YW1wcywgZXRjLilcclxuICAgKiBcclxuICAgKiBAcGFyYW0gdXNlcklkIC0gVGhlIHVzZXIgSUQgdG8gc2VuZCB0aGUgRE0gdG9cclxuICAgKiBAcGFyYW0gZGF0YSAtIE1lc3NhZ2UgZGF0YSAoY29udGVudCBhbmQvb3IgZW1iZWRzIGFuZC9vciBjb21wb25lbnRzKVxyXG4gICAqL1xyXG4gIGFzeW5jIGNyZWF0ZURNTWVzc2FnZSh1c2VySWQ6IHN0cmluZywgZGF0YToge1xyXG4gICAgY29udGVudD86IHN0cmluZztcclxuICAgIGVtYmVkcz86IEFQSUVtYmVkW107XHJcbiAgICBjb21wb25lbnRzPzogYW55W107XHJcbiAgfSk6IFByb21pc2U8QVBJTWVzc2FnZT4ge1xyXG4gICAgY29uc3QgcHJvY2Vzc2VkRGF0YSA9IHRoaXMucHJlcGFyZU1lc3NhZ2VEYXRhKGRhdGEpO1xyXG4gICAgLy8gU2VuZCB0byAvYm90L2RtIHdpdGggcmVjaXBpZW50X3VzZXJfaWQgaW4gYm9keVxyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBUElNZXNzYWdlPignUE9TVCcsIGAvYm90L2RtYCwge1xyXG4gICAgICAuLi5wcm9jZXNzZWREYXRhLFxyXG4gICAgICByZWNpcGllbnRfdXNlcl9pZDogdXNlcklkXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIERNIG1lc3NhZ2UgdG8gYW4gZXhpc3RpbmcgRE0gY2hhbm5lbFxyXG4gICAqIFVzZSB0aGlzIHdoZW4geW91IGFscmVhZHkgaGF2ZSBhIGNoYW5uZWwgSURcclxuICAgKi9cclxuICBhc3luYyBjcmVhdGVETU1lc3NhZ2VUb0NoYW5uZWwoY2hhbm5lbElkOiBzdHJpbmcsIGRhdGE6IHtcclxuICAgIGNvbnRlbnQ/OiBzdHJpbmc7XHJcbiAgICBlbWJlZHM/OiBBUElFbWJlZFtdO1xyXG4gICAgY29tcG9uZW50cz86IGFueVtdO1xyXG4gIH0pOiBQcm9taXNlPEFQSU1lc3NhZ2U+IHtcclxuICAgIGNvbnN0IHByb2Nlc3NlZERhdGEgPSB0aGlzLnByZXBhcmVNZXNzYWdlRGF0YShkYXRhKTtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QVBJTWVzc2FnZT4oJ1BPU1QnLCBgL2JvdC9kbS8ke2NoYW5uZWxJZH1gLCBwcm9jZXNzZWREYXRhKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIERNIG1lc3NhZ2Ugd2l0aCBmaWxlIGF0dGFjaG1lbnRcclxuICAgKiBwb255dGFpbDogRE0gacOnaW4gZmlsZSArIGVtYmVkIGRlc3RlxJ9pXHJcbiAgICovXHJcbiAgYXN5bmMgY3JlYXRlRE1NZXNzYWdlV2l0aEZpbGUodXNlcklkOiBzdHJpbmcsIGRhdGE6IHtcclxuICAgIGNvbnRlbnQ/OiBzdHJpbmc7XHJcbiAgICBlbWJlZHM/OiBBUElFbWJlZFtdO1xyXG4gICAgY29tcG9uZW50cz86IGFueVtdO1xyXG4gIH0sIGZpbGVzOiBBcnJheTx7IG5hbWU6IHN0cmluZzsgZGF0YTogQnVmZmVyIHwgc3RyaW5nOyBjb250ZW50VHlwZT86IHN0cmluZyB9Pik6IFByb21pc2U8QVBJTWVzc2FnZT4ge1xyXG4gICAgY29uc3QgRm9ybURhdGEgPSByZXF1aXJlKCdmb3JtLWRhdGEnKTtcclxuICAgIGNvbnN0IGZvcm0gPSBuZXcgRm9ybURhdGEoKTtcclxuXHJcbiAgICAvLyBBZGQgcmVjaXBpZW50X3VzZXJfaWRcclxuICAgIGZvcm0uYXBwZW5kKCdyZWNpcGllbnRfdXNlcl9pZCcsIHVzZXJJZCk7XHJcblxyXG4gICAgLy8gQWRkIGNvbnRlbnQgaWYgcHJvdmlkZWRcclxuICAgIGlmIChkYXRhLmNvbnRlbnQpIHtcclxuICAgICAgZm9ybS5hcHBlbmQoJ2NvbnRlbnQnLCBkYXRhLmNvbnRlbnQpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIEFkZCBlbWJlZHMgaWYgcHJvdmlkZWQgKEpTT04gc3RyaW5naWZpZWQpXHJcbiAgICBpZiAoZGF0YS5lbWJlZHMgJiYgZGF0YS5lbWJlZHMubGVuZ3RoID4gMCkge1xyXG4gICAgICBjb25zdCBwcm9jZXNzZWRFbWJlZHMgPSBkYXRhLmVtYmVkcy5tYXAoZW1iZWQgPT4gbm9ybWFsaXplRW1iZWQoZW1iZWQpKTtcclxuICAgICAgZm9ybS5hcHBlbmQoJ2VtYmVkcycsIEpTT04uc3RyaW5naWZ5KHByb2Nlc3NlZEVtYmVkcykpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIEFkZCBjb21wb25lbnRzIGlmIHByb3ZpZGVkIChKU09OIHN0cmluZ2lmaWVkKVxyXG4gICAgaWYgKGRhdGEuY29tcG9uZW50cyAmJiBkYXRhLmNvbXBvbmVudHMubGVuZ3RoID4gMCkge1xyXG4gICAgICBjb25zdCBwcm9jZXNzZWRDb21wb25lbnRzID0gc2VyaWFsaXplQ29tcG9uZW50cyhkYXRhLmNvbXBvbmVudHMpO1xyXG4gICAgICBmb3JtLmFwcGVuZCgnY29tcG9uZW50cycsIEpTT04uc3RyaW5naWZ5KHByb2Nlc3NlZENvbXBvbmVudHMpKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBBZGQgZmlsZXNcclxuICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xyXG4gICAgICBjb25zdCBmaWxlRGF0YSA9IHR5cGVvZiBmaWxlLmRhdGEgPT09ICdzdHJpbmcnID8gQnVmZmVyLmZyb20oZmlsZS5kYXRhKSA6IGZpbGUuZGF0YTtcclxuICAgICAgZm9ybS5hcHBlbmQoJ2ZpbGVzJywgZmlsZURhdGEsIHtcclxuICAgICAgICBmaWxlbmFtZTogZmlsZS5uYW1lLFxyXG4gICAgICAgIGNvbnRlbnRUeXBlOiBmaWxlLmNvbnRlbnRUeXBlIHx8ICdhcHBsaWNhdGlvbi9vY3RldC1zdHJlYW0nXHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHVybCA9IGAke3RoaXMuYmFzZVVybH0vYm90L2RtYDtcclxuXHJcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybCwge1xyXG4gICAgICBtZXRob2Q6ICdQT1NUJyxcclxuICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgICdBdXRob3JpemF0aW9uJzogYEJvdCAke3RoaXMudG9rZW59YCxcclxuICAgICAgICAuLi5mb3JtLmdldEhlYWRlcnMoKVxyXG4gICAgICB9LFxyXG4gICAgICBib2R5OiBmb3JtLmdldEJ1ZmZlcigpXHJcbiAgICB9KTtcclxuXHJcbiAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XHJcbiAgICAgIGNvbnN0IGVycm9yVGV4dCA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKTtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBETSBmaWxlIHVwbG9hZCBmYWlsZWQ6ICR7cmVzcG9uc2Uuc3RhdHVzfSAke2Vycm9yVGV4dH1gKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gcmVzcG9uc2UuanNvbigpIGFzIFByb21pc2U8QVBJTWVzc2FnZT47XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBFZGl0IGEgbWVzc2FnZVxyXG4gICAqIEF1dG9tYXRpY2FsbHkgcHJvY2Vzc2VzIG1lbnRpb25zXHJcbiAgICovXHJcbiAgYXN5bmMgZWRpdE1lc3NhZ2UoZ3VpbGRJZDogc3RyaW5nLCBjaGFubmVsSWQ6IHN0cmluZywgbWVzc2FnZUlkOiBzdHJpbmcsIGRhdGE6IHtcclxuICAgIGNvbnRlbnQ/OiBzdHJpbmc7XHJcbiAgICBlbWJlZHM/OiBBUElFbWJlZFtdO1xyXG4gICAgY29tcG9uZW50cz86IGFueVtdO1xyXG4gICAgbWVudGlvbnM/OiBNZW50aW9uc0RhdGE7XHJcbiAgfSk6IFByb21pc2U8QVBJTWVzc2FnZT4ge1xyXG4gICAgY29uc3QgcGF0aCA9IGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS9tZXNzYWdlcy8ke21lc3NhZ2VJZH1gO1xyXG4gICAgY29uc3QgcHJvY2Vzc2VkRGF0YSA9IHRoaXMucHJlcGFyZU1lc3NhZ2VEYXRhKGRhdGEpO1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBUElNZXNzYWdlPignUEFUQ0gnLCBwYXRoLCBwcm9jZXNzZWREYXRhKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlbGV0ZSBhIG1lc3NhZ2VcclxuICAgKi9cclxuICBhc3luYyBkZWxldGVNZXNzYWdlKGd1aWxkSWQ6IHN0cmluZywgY2hhbm5lbElkOiBzdHJpbmcsIG1lc3NhZ2VJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBwYXRoID0gYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vY2hhbm5lbHMvJHtjaGFubmVsSWR9L21lc3NhZ2VzLyR7bWVzc2FnZUlkfWA7XHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3Q8dm9pZD4oJ0RFTEVURScsIHBhdGgpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVmFsaWRhdGUgYW5kIG5vcm1hbGl6ZSBlbW9qaSBmb3JtYXQgZm9yIHRoZSBBUEkuXHJcbiAgICogQ29udmVydHMgdW5pY29kZSBlbW9qaSB0byBzaG9ydGNvZGUgZm9ybWF0LlxyXG4gICAqIEFjY2VwdGVkIGZvcm1hdHM6IFxyXG4gICAqIC0gVW5pY29kZSBlbW9qaSBjaGFyYWN0ZXJzICjwn5GNLCDinaTvuI8sIGV0Yy4pIOKGkiBjb252ZXJ0ZWQgdG8gOnNob3J0Y29kZTpcclxuICAgKiAtIDpuYW1lOiBmb3JtYXQgKHNob3J0Y29kZSlcclxuICAgKiAtIDw6bmFtZTppZD4gb3IgPGE6bmFtZTppZD4gZm9yIGN1c3RvbSBlbW9qaVxyXG4gICAqL1xyXG4gIHByaXZhdGUgdmFsaWRhdGVFbW9qaShlbW9qaTogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgIC8vIEltcG9ydCBsYXppbHkgdG8gYXZvaWQgY2lyY3VsYXIgZGVwZW5kZW5jaWVzXHJcbiAgICBjb25zdCB7IG5vcm1hbGl6ZUVtb2ppIH0gPSByZXF1aXJlKCcuLi91dGlscy9lbW9qaVV0aWxzJyk7XHJcbiAgICByZXR1cm4gbm9ybWFsaXplRW1vamkoZW1vamkpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRkIGEgcmVhY3Rpb24gdG8gYSBtZXNzYWdlXHJcbiAgICogQHBhcmFtIGVtb2ppIC0gVW5pY29kZSBlbW9qaSAo8J+RjSksIDpuYW1lOiwgPDpuYW1lOmlkPiwgb3IgPGE6bmFtZTppZD4gZm9ybWF0XHJcbiAgICogXHJcbiAgICogQGV4YW1wbGVcclxuICAgKiAvLyBVbmljb2RlIGVtb2ppIChhdXRvbWF0aWNhbGx5IGNvbnZlcnRlZCB0byBzaG9ydGNvZGUpXHJcbiAgICogYXdhaXQgcmVzdC5hZGRSZWFjdGlvbihndWlsZElkLCBjaGFubmVsSWQsIG1lc3NhZ2VJZCwgJ/CfkY0nKTtcclxuICAgKiBcclxuICAgKiAvLyBTaG9ydGNvZGUgZm9ybWF0XHJcbiAgICogYXdhaXQgcmVzdC5hZGRSZWFjdGlvbihndWlsZElkLCBjaGFubmVsSWQsIG1lc3NhZ2VJZCwgJzp0aHVtYnN1cDonKTtcclxuICAgKiBcclxuICAgKiAvLyBDdXN0b20gZW1vamlcclxuICAgKiBhd2FpdCByZXN0LmFkZFJlYWN0aW9uKGd1aWxkSWQsIGNoYW5uZWxJZCwgbWVzc2FnZUlkLCAnPDpjdXN0b206MTIzNDU2PicpO1xyXG4gICAqL1xyXG4gIGFzeW5jIGFkZFJlYWN0aW9uKGd1aWxkSWQ6IHN0cmluZywgY2hhbm5lbElkOiBzdHJpbmcsIG1lc3NhZ2VJZDogc3RyaW5nLCBlbW9qaTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCB2YWxpZGF0ZWQgPSB0aGlzLnZhbGlkYXRlRW1vamkoZW1vamkpO1xyXG4gICAgY29uc3QgcGF0aCA9IGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS9tZXNzYWdlcy8ke21lc3NhZ2VJZH0vcmVhY3Rpb25zLyR7ZW5jb2RlVVJJQ29tcG9uZW50KHZhbGlkYXRlZCl9L0BtZWA7XHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3Q8dm9pZD4oJ1BVVCcsIHBhdGgpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVtb3ZlIGEgcmVhY3Rpb24gZnJvbSBhIG1lc3NhZ2VcclxuICAgKiBAcGFyYW0gZW1vamkgLSBVbmljb2RlIGVtb2ppICjwn5GNKSwgOm5hbWU6LCA8Om5hbWU6aWQ+LCBvciA8YTpuYW1lOmlkPiBmb3JtYXRcclxuICAgKi9cclxuICBhc3luYyByZW1vdmVSZWFjdGlvbihndWlsZElkOiBzdHJpbmcsIGNoYW5uZWxJZDogc3RyaW5nLCBtZXNzYWdlSWQ6IHN0cmluZywgZW1vamk6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgdmFsaWRhdGVkID0gdGhpcy52YWxpZGF0ZUVtb2ppKGVtb2ppKTtcclxuICAgIGNvbnN0IHBhdGggPSBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH0vbWVzc2FnZXMvJHttZXNzYWdlSWR9L3JlYWN0aW9ucy8ke2VuY29kZVVSSUNvbXBvbmVudCh2YWxpZGF0ZWQpfS9AbWVgO1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0PHZvaWQ+KCdERUxFVEUnLCBwYXRoKTtcclxuICB9XHJcblxyXG5cclxuICAvKipcclxuICAgKiBVcGxvYWQgYW4gYXR0YWNobWVudCB0byBhIGNoYW5uZWxcclxuICAgKi9cclxuICBhc3luYyB1cGxvYWRBdHRhY2htZW50KGd1aWxkSWQ6IHN0cmluZywgY2hhbm5lbElkOiBzdHJpbmcsIGZpbGU6IHsgbmFtZTogc3RyaW5nOyBkYXRhOiBCdWZmZXI7IGNvbnRlbnRUeXBlPzogc3RyaW5nIH0pOiBQcm9taXNlPHsgaWQ6IHN0cmluZzsgdXJsOiBzdHJpbmc7IGZpbGVuYW1lOiBzdHJpbmcgfT4ge1xyXG4gICAgY29uc3QgRm9ybURhdGEgPSByZXF1aXJlKCdmb3JtLWRhdGEnKTtcclxuICAgIGNvbnN0IGZvcm0gPSBuZXcgRm9ybURhdGEoKTtcclxuICAgIFxyXG4gICAgLy8gZm9ybS1kYXRhIGV4cGVjdHMgdGhlIGJ1ZmZlciBkaXJlY3RseSB3aXRoIG9wdGlvbnNcclxuICAgIGZvcm0uYXBwZW5kKCdmaWxlJywgZmlsZS5kYXRhLCB7XHJcbiAgICAgIGZpbGVuYW1lOiBmaWxlLm5hbWUsXHJcbiAgICAgIGNvbnRlbnRUeXBlOiBmaWxlLmNvbnRlbnRUeXBlIHx8ICd0ZXh0L3BsYWluJ1xyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIGNvbnN0IHVybCA9IGAke3RoaXMuYmFzZVVybH0vYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS9hdHRhY2htZW50c2A7XHJcbiAgICBcclxuICAgIGlmIChwcm9jZXNzLmVudi5ERUJVR19SRVNUKSB7XHJcbiAgICAgIGNvbnNvbGUubG9nKGBbUkVTVF0gVXBsb2FkaW5nIGF0dGFjaG1lbnQ6ICR7ZmlsZS5uYW1lfSAoJHtmaWxlLmRhdGEubGVuZ3RofSBieXRlcylgKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCh1cmwsIHtcclxuICAgICAgbWV0aG9kOiAnUE9TVCcsXHJcbiAgICAgIGhlYWRlcnM6IHtcclxuICAgICAgICAnQXV0aG9yaXphdGlvbic6IGBCb3QgJHt0aGlzLnRva2VufWAsXHJcbiAgICAgICAgLi4uZm9ybS5nZXRIZWFkZXJzKClcclxuICAgICAgfSxcclxuICAgICAgYm9keTogZm9ybS5nZXRCdWZmZXIoKVxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIGlmICghcmVzcG9uc2Uub2spIHtcclxuICAgICAgY29uc3QgZXJyb3IgPSBhd2FpdCByZXNwb25zZS50ZXh0KCk7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQVBJIEVycm9yICR7cmVzcG9uc2Uuc3RhdHVzfTogJHtlcnJvcn1gKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgcmV0dXJuIHJlc3BvbnNlLmpzb24oKSBhcyBQcm9taXNlPHsgaWQ6IHN0cmluZzsgdXJsOiBzdHJpbmc7IGZpbGVuYW1lOiBzdHJpbmcgfT47XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgYSBtZXNzYWdlIHdpdGggYSBmaWxlIGF0dGFjaG1lbnRcclxuICAgKiBwb255dGFpbDogZW1iZWRzIHZlIGNvbXBvbmVudHMgZGVzdGXEn2kgZWtsZW5kaVxyXG4gICAqL1xyXG4gIGFzeW5jIGNyZWF0ZU1lc3NhZ2VXaXRoRmlsZShndWlsZElkOiBzdHJpbmcsIGNoYW5uZWxJZDogc3RyaW5nLCBkYXRhOiB7XHJcbiAgICBjb250ZW50Pzogc3RyaW5nO1xyXG4gICAgZW1iZWRzPzogQVBJRW1iZWRbXTtcclxuICAgIGNvbXBvbmVudHM/OiBhbnlbXTtcclxuICAgIGZpbGU6IHsgbmFtZTogc3RyaW5nOyBkYXRhOiBCdWZmZXI7IGNvbnRlbnRUeXBlPzogc3RyaW5nIH07XHJcbiAgICBpbnRlcmFjdGlvbklkPzogc3RyaW5nO1xyXG4gIH0pOiBQcm9taXNlPEFQSU1lc3NhZ2U+IHtcclxuICAgIGNvbnN0IEZvcm1EYXRhID0gcmVxdWlyZSgnZm9ybS1kYXRhJyk7XHJcbiAgICBjb25zdCBmb3JtID0gbmV3IEZvcm1EYXRhKCk7XHJcbiAgICBcclxuICAgIC8vIEFkZCBjb250ZW50IGlmIHByb3ZpZGVkXHJcbiAgICBpZiAoZGF0YS5jb250ZW50KSB7XHJcbiAgICAgIGZvcm0uYXBwZW5kKCdjb250ZW50JywgZGF0YS5jb250ZW50KTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgLy8gQWRkIGVtYmVkcyBpZiBwcm92aWRlZCAoSlNPTiBzdHJpbmdpZmllZClcclxuICAgIGlmIChkYXRhLmVtYmVkcyAmJiBkYXRhLmVtYmVkcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgIC8vIFByb2Nlc3MgZW1iZWRzIHVzaW5nIHNoYXJlZCBub3JtYWxpemVFbWJlZFxyXG4gICAgICBjb25zdCBwcm9jZXNzZWRFbWJlZHMgPSBkYXRhLmVtYmVkcy5tYXAoZW1iZWQgPT4gbm9ybWFsaXplRW1iZWQoZW1iZWQpKTtcclxuICAgICAgaWYgKHByb2Nlc3MuZW52LkRFQlVHX1JFU1QpIHtcclxuICAgICAgICBjb25zb2xlLmxvZyhgW1JFU1RdIGNyZWF0ZU1lc3NhZ2VXaXRoRmlsZTogYXBwZW5kaW5nICR7cHJvY2Vzc2VkRW1iZWRzLmxlbmd0aH0gZW1iZWRzYCk7XHJcbiAgICAgIH1cclxuICAgICAgZm9ybS5hcHBlbmQoJ2VtYmVkcycsIEpTT04uc3RyaW5naWZ5KHByb2Nlc3NlZEVtYmVkcykpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgaWYgKHByb2Nlc3MuZW52LkRFQlVHX1JFU1QpIHtcclxuICAgICAgICBjb25zb2xlLmxvZyhgW1JFU1RdIGNyZWF0ZU1lc3NhZ2VXaXRoRmlsZTogbm8gZW1iZWRzIHByb3ZpZGVkIChlbWJlZHM9JHtkYXRhLmVtYmVkc30pYCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgLy8gQWRkIGNvbXBvbmVudHMgaWYgcHJvdmlkZWQgKEpTT04gc3RyaW5naWZpZWQpXHJcbiAgICBpZiAoZGF0YS5jb21wb25lbnRzICYmIGRhdGEuY29tcG9uZW50cy5sZW5ndGggPiAwKSB7XHJcbiAgICAgIGNvbnN0IHByb2Nlc3NlZENvbXBvbmVudHMgPSBzZXJpYWxpemVDb21wb25lbnRzKGRhdGEuY29tcG9uZW50cyk7XHJcbiAgICAgIGZvcm0uYXBwZW5kKCdjb21wb25lbnRzJywgSlNPTi5zdHJpbmdpZnkocHJvY2Vzc2VkQ29tcG9uZW50cykpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvLyBBZGQgaW50ZXJhY3Rpb25faWQgaWYgcHJvdmlkZWQgKGZvciBkZWZlcnJlZCByZXNwb25zZSBtYXRjaGluZylcclxuICAgIGlmIChkYXRhLmludGVyYWN0aW9uSWQpIHtcclxuICAgICAgZm9ybS5hcHBlbmQoJ2ludGVyYWN0aW9uX2lkJywgZGF0YS5pbnRlcmFjdGlvbklkKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgLy8gQWRkIGZpbGVcclxuICAgIGZvcm0uYXBwZW5kKCdmaWxlcycsIGRhdGEuZmlsZS5kYXRhLCB7XHJcbiAgICAgIGZpbGVuYW1lOiBkYXRhLmZpbGUubmFtZSxcclxuICAgICAgY29udGVudFR5cGU6IGRhdGEuZmlsZS5jb250ZW50VHlwZSB8fCAndGV4dC9wbGFpbidcclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBjb25zdCB1cmwgPSBgJHt0aGlzLmJhc2VVcmx9L2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH0vbWVzc2FnZXNgO1xyXG4gICAgXHJcbiAgICBpZiAocHJvY2Vzcy5lbnYuREVCVUdfUkVTVCkge1xyXG4gICAgICBjb25zb2xlLmxvZyhgW1JFU1RdIENyZWF0aW5nIG1lc3NhZ2Ugd2l0aCBmaWxlOiAke2RhdGEuZmlsZS5uYW1lfSAoJHtkYXRhLmZpbGUuZGF0YS5sZW5ndGh9IGJ5dGVzKSR7ZGF0YS5pbnRlcmFjdGlvbklkID8gYCBbaW50ZXJhY3Rpb246ICR7ZGF0YS5pbnRlcmFjdGlvbklkfV1gIDogJyd9YCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godXJsLCB7XHJcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxyXG4gICAgICBoZWFkZXJzOiB7XHJcbiAgICAgICAgJ0F1dGhvcml6YXRpb24nOiBgQm90ICR7dGhpcy50b2tlbn1gLFxyXG4gICAgICAgIC4uLmZvcm0uZ2V0SGVhZGVycygpXHJcbiAgICAgIH0sXHJcbiAgICAgIGJvZHk6IGZvcm0uZ2V0QnVmZmVyKClcclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XHJcbiAgICAgIGNvbnN0IGVycm9yID0gYXdhaXQgcmVzcG9uc2UudGV4dCgpO1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEFQSSBFcnJvciAke3Jlc3BvbnNlLnN0YXR1c306ICR7ZXJyb3J9YCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHJldHVybiByZXNwb25zZS5qc29uKCkgYXMgUHJvbWlzZTxBUElNZXNzYWdlPjtcclxuICB9XHJcblxyXG4gIC8vID09PT09PT09PT09PT09PT09PT09IEludGVyYWN0aW9ucyA9PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgYW4gaW50ZXJhY3Rpb24gcmVzcG9uc2VcclxuICAgKiBBdXRvbWF0aWNhbGx5IHByb2Nlc3NlcyBtZW50aW9ucyBpbiBjb250ZW50IGFuZCBlbWJlZHNcclxuICAgKi9cclxuICBhc3luYyBjcmVhdGVJbnRlcmFjdGlvblJlc3BvbnNlKGludGVyYWN0aW9uSWQ6IHN0cmluZywgdG9rZW46IHN0cmluZywgZGF0YToge1xyXG4gICAgdHlwZTogbnVtYmVyO1xyXG4gICAgZGF0YT86IGFueTtcclxuICB9KTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBpZiAocHJvY2Vzcy5lbnYuREVCVUdfUkVTVCkge1xyXG4gICAgICBjb25zb2xlLmxvZyhg8J+TpCBJbnRlcmFjdGlvbiByZXNwb25zZTogJHtpbnRlcmFjdGlvbklkfSAtPiB0eXBlICR7ZGF0YS50eXBlfWApO1xyXG4gICAgfVxyXG4gICAgdHJ5IHtcclxuICAgICAgLy8gUHJvY2VzcyBtZW50aW9ucyBpbiByZXNwb25zZSBkYXRhIGlmIHByZXNlbnRcclxuICAgICAgbGV0IHByb2Nlc3NlZERhdGEgPSBkYXRhO1xyXG4gICAgICBpZiAoZGF0YS5kYXRhICYmIChkYXRhLmRhdGEuY29udGVudCB8fCBkYXRhLmRhdGEuZW1iZWRzKSkge1xyXG4gICAgICAgIHByb2Nlc3NlZERhdGEgPSB7XHJcbiAgICAgICAgICAuLi5kYXRhLFxyXG4gICAgICAgICAgZGF0YTogdGhpcy5wcmVwYXJlTWVzc2FnZURhdGEoZGF0YS5kYXRhKVxyXG4gICAgICAgIH07XHJcbiAgICAgIH1cclxuICAgICAgXHJcbiAgICAgIGF3YWl0IHRoaXMucmVxdWVzdDx2b2lkPignUE9TVCcsIGAvaW50ZXJhY3Rpb25zLyR7aW50ZXJhY3Rpb25JZH0vJHt0b2tlbn0vY2FsbGJhY2tgLCBwcm9jZXNzZWREYXRhKTtcclxuICAgICAgaWYgKHByb2Nlc3MuZW52LkRFQlVHX1JFU1QpIHtcclxuICAgICAgICBjb25zb2xlLmxvZyhg4pyFIEludGVyYWN0aW9uIHJlc3BvbnNlIHNlbnRgKTtcclxuICAgICAgfVxyXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgY29uc29sZS5lcnJvcihg4p2MIEludGVyYWN0aW9uIHJlc3BvbnNlIGVycm9yOmAsIGVycm9yKTtcclxuICAgICAgdGhyb3cgZXJyb3I7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBFZGl0IHRoZSBvcmlnaW5hbCBpbnRlcmFjdGlvbiByZXNwb25zZVxyXG4gICAqIElmIGZpbGVzIGFyZSBwcm92aWRlZCwgY3JlYXRlcyBhIG5ldyBtZXNzYWdlIHdpdGggZmlsZXMgKHNpbmNlIHdlYmhvb2sgZWRpdCBkb2Vzbid0IHN1cHBvcnQgZmlsZSB1cGxvYWQpXHJcbiAgICogQXV0b21hdGljYWxseSBwcm9jZXNzZXMgbWVudGlvbnNcclxuICAgKi9cclxuICBhc3luYyBlZGl0SW50ZXJhY3Rpb25SZXNwb25zZSh0b2tlbjogc3RyaW5nLCBkYXRhOiB7XHJcbiAgICBjb250ZW50Pzogc3RyaW5nO1xyXG4gICAgZW1iZWRzPzogQVBJRW1iZWRbXTtcclxuICAgIGNvbXBvbmVudHM/OiBhbnlbXTtcclxuICAgIG1lbnRpb25zPzogTWVudGlvbnNEYXRhO1xyXG4gICAgZmlsZXM/OiBBcnJheTx7IG5hbWU6IHN0cmluZzsgZGF0YTogQnVmZmVyOyBjb250ZW50VHlwZT86IHN0cmluZyB9PjtcclxuICB9LCBndWlsZElkPzogc3RyaW5nLCBjaGFubmVsSWQ/OiBzdHJpbmcsIGludGVyYWN0aW9uSWQ/OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IGFwcElkID0gdGhpcy5nZXRBcHBsaWNhdGlvbklkKCk7XHJcbiAgICBcclxuICAgIC8vIFByb2Nlc3MgbWVudGlvbnMgaW4gY29udGVudFxyXG4gICAgY29uc3QgcHJvY2Vzc2VkRGF0YSA9IHRoaXMucHJlcGFyZU1lc3NhZ2VEYXRhKGRhdGEpO1xyXG4gICAgXHJcbiAgICAvLyBJZiBmaWxlcyBhcmUgcHJlc2VudCBhbmQgd2UgaGF2ZSBndWlsZC9jaGFubmVsIGluZm8sIGNyZWF0ZSBtZXNzYWdlIHdpdGggZmlsZSBpbnN0ZWFkXHJcbiAgICBpZiAoZGF0YS5maWxlcyAmJiBkYXRhLmZpbGVzLmxlbmd0aCA+IDAgJiYgZ3VpbGRJZCAmJiBjaGFubmVsSWQpIHtcclxuICAgICAgaWYgKHByb2Nlc3MuZW52LkRFQlVHX1JFU1QpIHtcclxuICAgICAgICBjb25zb2xlLmxvZyhgW1JFU1RdIGVkaXRJbnRlcmFjdGlvblJlc3BvbnNlIHdpdGggJHtkYXRhLmZpbGVzLmxlbmd0aH0gZmlsZXMgLSB1c2luZyBjcmVhdGVNZXNzYWdlV2l0aEZpbGVgKTtcclxuICAgICAgfVxyXG4gICAgICBcclxuICAgICAgLy8gQ3JlYXRlIG1lc3NhZ2Ugd2l0aCBmaWxlIC0gcG9ueXRhaWw6IGVtYmVkcyB2ZSBjb21wb25lbnRzIGRhIGdlw6dpcmlsaXlvclxyXG4gICAgICBjb25zdCBmaWxlID0gZGF0YS5maWxlc1swXTsgLy8gRm9yIG5vdywgc3VwcG9ydCBzaW5nbGUgZmlsZVxyXG4gICAgICBhd2FpdCB0aGlzLmNyZWF0ZU1lc3NhZ2VXaXRoRmlsZShndWlsZElkLCBjaGFubmVsSWQsIHtcclxuICAgICAgICBjb250ZW50OiBwcm9jZXNzZWREYXRhLmNvbnRlbnQsXHJcbiAgICAgICAgZW1iZWRzOiBwcm9jZXNzZWREYXRhLmVtYmVkcyxcclxuICAgICAgICBjb21wb25lbnRzOiBwcm9jZXNzZWREYXRhLmNvbXBvbmVudHMsXHJcbiAgICAgICAgZmlsZTogZmlsZSxcclxuICAgICAgICBpbnRlcmFjdGlvbklkOiBpbnRlcmFjdGlvbklkXHJcbiAgICAgIH0pO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIElmIHdlIGhhdmUgZ3VpbGRJZCwgY2hhbm5lbElkIGFuZCBpbnRlcmFjdGlvbklkLCBjcmVhdGUgYSBuZXcgbWVzc2FnZSB3aXRoIGludGVyYWN0aW9uX2lkXHJcbiAgICAvLyBUaGlzIGlzIG5lZWRlZCBiZWNhdXNlIG91ciBkZWZlcnJlZCByZXNwb25zZSBkb2Vzbid0IGNyZWF0ZSBhIG1lc3NhZ2VcclxuICAgIGlmIChndWlsZElkICYmIGNoYW5uZWxJZCAmJiBpbnRlcmFjdGlvbklkKSB7XHJcbiAgICAgIGlmIChwcm9jZXNzLmVudi5ERUJVR19SRVNUKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coYFtSRVNUXSBlZGl0SW50ZXJhY3Rpb25SZXNwb25zZSAtIGNyZWF0aW5nIG1lc3NhZ2Ugd2l0aCBpbnRlcmFjdGlvbl9pZDogJHtpbnRlcmFjdGlvbklkfWApO1xyXG4gICAgICB9XHJcbiAgICAgIFxyXG4gICAgICBjb25zdCBwYXlsb2FkOiBhbnkgPSB7XHJcbiAgICAgICAgaW50ZXJhY3Rpb25faWQ6IGludGVyYWN0aW9uSWRcclxuICAgICAgfTtcclxuICAgICAgaWYgKHByb2Nlc3NlZERhdGEuY29udGVudCAhPT0gdW5kZWZpbmVkKSBwYXlsb2FkLmNvbnRlbnQgPSBwcm9jZXNzZWREYXRhLmNvbnRlbnQ7XHJcbiAgICAgIGlmIChwcm9jZXNzZWREYXRhLmVtYmVkcykgcGF5bG9hZC5lbWJlZHMgPSBwcm9jZXNzZWREYXRhLmVtYmVkcztcclxuICAgICAgaWYgKHByb2Nlc3NlZERhdGEuY29tcG9uZW50cykgcGF5bG9hZC5jb21wb25lbnRzID0gcHJvY2Vzc2VkRGF0YS5jb21wb25lbnRzO1xyXG4gICAgICBpZiAocHJvY2Vzc2VkRGF0YS5tZW50aW9ucykgcGF5bG9hZC5tZW50aW9ucyA9IHByb2Nlc3NlZERhdGEubWVudGlvbnM7XHJcbiAgICAgIFxyXG4gICAgICBhd2FpdCB0aGlzLnJlcXVlc3Q8dm9pZD4oJ1BPU1QnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH0vbWVzc2FnZXNgLCBwYXlsb2FkKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvLyBGYWxsYmFjazogUmVndWxhciBlZGl0IHdpdGhvdXQgZmlsZXMgKHdlYmhvb2sgUEFUQ0gpXHJcbiAgICBjb25zdCBwYXlsb2FkOiBhbnkgPSB7fTtcclxuICAgIGlmIChwcm9jZXNzZWREYXRhLmNvbnRlbnQgIT09IHVuZGVmaW5lZCkgcGF5bG9hZC5jb250ZW50ID0gcHJvY2Vzc2VkRGF0YS5jb250ZW50O1xyXG4gICAgaWYgKHByb2Nlc3NlZERhdGEuZW1iZWRzKSBwYXlsb2FkLmVtYmVkcyA9IHByb2Nlc3NlZERhdGEuZW1iZWRzO1xyXG4gICAgaWYgKHByb2Nlc3NlZERhdGEuY29tcG9uZW50cykgcGF5bG9hZC5jb21wb25lbnRzID0gcHJvY2Vzc2VkRGF0YS5jb21wb25lbnRzO1xyXG4gICAgaWYgKHByb2Nlc3NlZERhdGEubWVudGlvbnMpIHBheWxvYWQubWVudGlvbnMgPSBwcm9jZXNzZWREYXRhLm1lbnRpb25zO1xyXG4gICAgXHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3Q8dm9pZD4oJ1BBVENIJywgYC9pbnRlcmFjdGlvbnMvd2ViaG9va3MvJHthcHBJZH0vJHt0b2tlbn0vbWVzc2FnZXMvQG9yaWdpbmFsYCwgcGF5bG9hZCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZWxldGUgdGhlIG9yaWdpbmFsIGludGVyYWN0aW9uIHJlc3BvbnNlXHJcbiAgICovXHJcbiAgYXN5bmMgZGVsZXRlSW50ZXJhY3Rpb25SZXNwb25zZSh0b2tlbjogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBhcHBJZCA9IHRoaXMuZ2V0QXBwbGljYXRpb25JZCgpO1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0PHZvaWQ+KCdERUxFVEUnLCBgL2ludGVyYWN0aW9ucy93ZWJob29rcy8ke2FwcElkfS8ke3Rva2VufS9tZXNzYWdlcy9Ab3JpZ2luYWxgKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIGZvbGxvd3VwIG1lc3NhZ2VcclxuICAgKiBBdXRvbWF0aWNhbGx5IHByb2Nlc3NlcyBtZW50aW9uc1xyXG4gICAqIFN1cHBvcnRzIGZpbGUgYXR0YWNobWVudHMgdmlhIG11bHRpcGFydC9mb3JtLWRhdGFcclxuICAgKi9cclxuICBhc3luYyBjcmVhdGVGb2xsb3d1cCh0b2tlbjogc3RyaW5nLCBkYXRhOiB7XHJcbiAgICBjb250ZW50Pzogc3RyaW5nO1xyXG4gICAgZW1iZWRzPzogQVBJRW1iZWRbXTtcclxuICAgIGNvbXBvbmVudHM/OiBhbnlbXTtcclxuICAgIG1lbnRpb25zPzogTWVudGlvbnNEYXRhO1xyXG4gICAgZmxhZ3M/OiBudW1iZXI7XHJcbiAgICBmaWxlcz86IEFycmF5PHsgbmFtZTogc3RyaW5nOyBkYXRhOiBCdWZmZXI7IGNvbnRlbnRUeXBlPzogc3RyaW5nIH0+O1xyXG4gIH0pOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IGFwcElkID0gdGhpcy5nZXRBcHBsaWNhdGlvbklkKCk7XHJcbiAgICBjb25zdCBlbmRwb2ludCA9IGAvaW50ZXJhY3Rpb25zL3dlYmhvb2tzLyR7YXBwSWR9LyR7dG9rZW59YDtcclxuXHJcbiAgICAvLyBJZiBmaWxlcyBwcm92aWRlZCwgdXNlIG11bHRpcGFydC9mb3JtLWRhdGFcclxuICAgIGlmIChkYXRhLmZpbGVzICYmIGRhdGEuZmlsZXMubGVuZ3RoID4gMCkge1xyXG4gICAgICBjb25zdCBGb3JtRGF0YSA9IHJlcXVpcmUoJ2Zvcm0tZGF0YScpO1xyXG4gICAgICBjb25zdCBmb3JtID0gbmV3IEZvcm1EYXRhKCk7XHJcblxyXG4gICAgICAvLyBBZGQgY29udGVudFxyXG4gICAgICBpZiAoZGF0YS5jb250ZW50KSB7XHJcbiAgICAgICAgZm9ybS5hcHBlbmQoJ2NvbnRlbnQnLCBkYXRhLmNvbnRlbnQpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyBBZGQgZW1iZWRzIChwcm9jZXNzZWQgdXNpbmcgc2hhcmVkIG5vcm1hbGl6ZUVtYmVkKVxyXG4gICAgICBpZiAoZGF0YS5lbWJlZHMgJiYgZGF0YS5lbWJlZHMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIGNvbnN0IHByb2Nlc3NlZEVtYmVkcyA9IGRhdGEuZW1iZWRzLm1hcChlbWJlZCA9PiBub3JtYWxpemVFbWJlZChlbWJlZCkpO1xyXG4gICAgICAgIGZvcm0uYXBwZW5kKCdlbWJlZHMnLCBKU09OLnN0cmluZ2lmeShwcm9jZXNzZWRFbWJlZHMpKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gQWRkIGNvbXBvbmVudHMgdXNpbmcgc2hhcmVkIHNlcmlhbGl6ZUNvbXBvbmVudHNcclxuICAgICAgaWYgKGRhdGEuY29tcG9uZW50cyAmJiBkYXRhLmNvbXBvbmVudHMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgIGNvbnN0IHByb2Nlc3NlZENvbXBvbmVudHMgPSBzZXJpYWxpemVDb21wb25lbnRzKGRhdGEuY29tcG9uZW50cyk7XHJcbiAgICAgICAgZm9ybS5hcHBlbmQoJ2NvbXBvbmVudHMnLCBKU09OLnN0cmluZ2lmeShwcm9jZXNzZWRDb21wb25lbnRzKSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIEFkZCBmbGFnc1xyXG4gICAgICBpZiAoZGF0YS5mbGFncykge1xyXG4gICAgICAgIGZvcm0uYXBwZW5kKCdmbGFncycsIFN0cmluZyhkYXRhLmZsYWdzKSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIEFkZCBmaWxlc1xyXG4gICAgICBkYXRhLmZpbGVzLmZvckVhY2goKGZpbGUsIGluZGV4KSA9PiB7XHJcbiAgICAgICAgZm9ybS5hcHBlbmQoYGZpbGVzWyR7aW5kZXh9XWAsIGZpbGUuZGF0YSwge1xyXG4gICAgICAgICAgZmlsZW5hbWU6IGZpbGUubmFtZSxcclxuICAgICAgICAgIGNvbnRlbnRUeXBlOiBmaWxlLmNvbnRlbnRUeXBlIHx8ICdhcHBsaWNhdGlvbi9vY3RldC1zdHJlYW0nXHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgY29uc3QgdXJsID0gYCR7dGhpcy5iYXNlVXJsfSR7ZW5kcG9pbnR9YDtcclxuICAgICAgaWYgKHByb2Nlc3MuZW52LkRFQlVHX1JFU1QpIHtcclxuICAgICAgICBjb25zb2xlLmxvZyhgW1JFU1RdIGNyZWF0ZUZvbGxvd3VwIHdpdGggJHtkYXRhLmZpbGVzLmxlbmd0aH0gZmlsZShzKWApO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybCwge1xyXG4gICAgICAgIG1ldGhvZDogJ1BPU1QnLFxyXG4gICAgICAgIGhlYWRlcnM6IHtcclxuICAgICAgICAgICdBdXRob3JpemF0aW9uJzogYEJvdCAke3RoaXMudG9rZW59YCxcclxuICAgICAgICAgIC4uLmZvcm0uZ2V0SGVhZGVycygpXHJcbiAgICAgICAgfSxcclxuICAgICAgICBib2R5OiBmb3JtLmdldEJ1ZmZlcigpXHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xyXG4gICAgICAgIGNvbnN0IGVycm9yVGV4dCA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKTtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEZvbGxvd3VwIHdpdGggZmlsZSBmYWlsZWQ6ICR7cmVzcG9uc2Uuc3RhdHVzfSAtICR7ZXJyb3JUZXh0fWApO1xyXG4gICAgICB9XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAvLyBObyBmaWxlcywgdXNlIEpTT05cclxuICAgICAgY29uc3QgcHJvY2Vzc2VkRGF0YSA9IHRoaXMucHJlcGFyZU1lc3NhZ2VEYXRhKGRhdGEpO1xyXG4gICAgICBhd2FpdCB0aGlzLnJlcXVlc3Q8dm9pZD4oJ1BPU1QnLCBlbmRwb2ludCwgcHJvY2Vzc2VkRGF0YSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PSBDb21tYW5kcyA9PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAvKipcclxuICAgKiBSZWdpc3RlciBnbG9iYWwgYXBwbGljYXRpb24gY29tbWFuZHNcclxuICAgKi9cclxuICBhc3luYyByZWdpc3Rlckdsb2JhbENvbW1hbmRzKGNvbW1hbmRzOiBBUElBcHBsaWNhdGlvbkNvbW1hbmRbXSk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgYXBwSWQgPSB0aGlzLmdldEFwcGxpY2F0aW9uSWQoKTtcclxuICAgIFxyXG4gICAgZm9yIChjb25zdCBjb21tYW5kIG9mIGNvbW1hbmRzKSB7XHJcbiAgICAgIGF3YWl0IHRoaXMucmVxdWVzdDx2b2lkPignUE9TVCcsIGAvYXBwbGljYXRpb25zLyR7YXBwSWR9L2NvbW1hbmRzYCwgY29tbWFuZCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBCdWxrIG92ZXJ3cml0ZSBhbGwgZ2xvYmFsIGFwcGxpY2F0aW9uIGNvbW1hbmRzIChyZXBsYWNlcyBhbGwgZXhpc3RpbmcpXHJcbiAgICovXHJcbiAgYXN5bmMgYnVsa092ZXJ3cml0ZUdsb2JhbENvbW1hbmRzKGNvbW1hbmRzOiBBUElBcHBsaWNhdGlvbkNvbW1hbmRbXSk6IFByb21pc2U8QVBJQXBwbGljYXRpb25Db21tYW5kW10+IHtcclxuICAgIGNvbnN0IGFwcElkID0gdGhpcy5nZXRBcHBsaWNhdGlvbklkKCk7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PEFQSUFwcGxpY2F0aW9uQ29tbWFuZFtdPignUFVUJywgYC9hcHBsaWNhdGlvbnMvJHthcHBJZH0vY29tbWFuZHNgLCBjb21tYW5kcyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZWdpc3RlciBndWlsZC1zcGVjaWZpYyBjb21tYW5kc1xyXG4gICAqL1xyXG4gIGFzeW5jIHJlZ2lzdGVyR3VpbGRDb21tYW5kcyhndWlsZElkOiBzdHJpbmcsIGNvbW1hbmRzOiBBUElBcHBsaWNhdGlvbkNvbW1hbmRbXSk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgYXBwSWQgPSB0aGlzLmdldEFwcGxpY2F0aW9uSWQoKTtcclxuICAgIFxyXG4gICAgZm9yIChjb25zdCBjb21tYW5kIG9mIGNvbW1hbmRzKSB7XHJcbiAgICAgIGF3YWl0IHRoaXMucmVxdWVzdDx2b2lkPignUE9TVCcsIGAvYXBwbGljYXRpb25zLyR7YXBwSWR9L2d1aWxkcy8ke2d1aWxkSWR9L2NvbW1hbmRzYCwgY29tbWFuZCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBCdWxrIG92ZXJ3cml0ZSBhbGwgZ3VpbGQtc3BlY2lmaWMgY29tbWFuZHMgKHJlcGxhY2VzIGFsbCBleGlzdGluZylcclxuICAgKi9cclxuICBhc3luYyBidWxrT3ZlcndyaXRlR3VpbGRDb21tYW5kcyhndWlsZElkOiBzdHJpbmcsIGNvbW1hbmRzOiBBUElBcHBsaWNhdGlvbkNvbW1hbmRbXSk6IFByb21pc2U8QVBJQXBwbGljYXRpb25Db21tYW5kW10+IHtcclxuICAgIGNvbnN0IGFwcElkID0gdGhpcy5nZXRBcHBsaWNhdGlvbklkKCk7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PEFQSUFwcGxpY2F0aW9uQ29tbWFuZFtdPignUFVUJywgYC9hcHBsaWNhdGlvbnMvJHthcHBJZH0vZ3VpbGRzLyR7Z3VpbGRJZH0vY29tbWFuZHNgLCBjb21tYW5kcyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZWxldGUgYSBnbG9iYWwgY29tbWFuZFxyXG4gICAqL1xyXG4gIGFzeW5jIGRlbGV0ZUdsb2JhbENvbW1hbmQoY29tbWFuZElkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IGFwcElkID0gdGhpcy5nZXRBcHBsaWNhdGlvbklkKCk7XHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3Q8dm9pZD4oJ0RFTEVURScsIGAvYXBwbGljYXRpb25zLyR7YXBwSWR9L2NvbW1hbmRzLyR7Y29tbWFuZElkfWApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVsZXRlIGEgZ3VpbGQtc3BlY2lmaWMgY29tbWFuZFxyXG4gICAqL1xyXG4gIGFzeW5jIGRlbGV0ZUd1aWxkQ29tbWFuZChndWlsZElkOiBzdHJpbmcsIGNvbW1hbmRJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBhcHBJZCA9IHRoaXMuZ2V0QXBwbGljYXRpb25JZCgpO1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0PHZvaWQ+KCdERUxFVEUnLCBgL2FwcGxpY2F0aW9ucy8ke2FwcElkfS9ndWlsZHMvJHtndWlsZElkfS9jb21tYW5kcy8ke2NvbW1hbmRJZH1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIExpc3QgYWxsIGdsb2JhbCBjb21tYW5kcyBmb3IgdGhpcyBhcHBsaWNhdGlvblxyXG4gICAqL1xyXG4gIGFzeW5jIGxpc3RHbG9iYWxDb21tYW5kcygpOiBQcm9taXNlPEFQSUFwcGxpY2F0aW9uQ29tbWFuZFtdPiB7XHJcbiAgICBjb25zdCBhcHBJZCA9IHRoaXMuZ2V0QXBwbGljYXRpb25JZCgpO1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBUElBcHBsaWNhdGlvbkNvbW1hbmRbXT4oJ0dFVCcsIGAvYXBwbGljYXRpb25zLyR7YXBwSWR9L2NvbW1hbmRzYCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBMaXN0IGFsbCBndWlsZC1zcGVjaWZpYyBjb21tYW5kcyBmb3IgdGhpcyBhcHBsaWNhdGlvblxyXG4gICAqL1xyXG4gIGFzeW5jIGxpc3RHdWlsZENvbW1hbmRzKGd1aWxkSWQ6IHN0cmluZyk6IFByb21pc2U8QVBJQXBwbGljYXRpb25Db21tYW5kW10+IHtcclxuICAgIGNvbnN0IGFwcElkID0gdGhpcy5nZXRBcHBsaWNhdGlvbklkKCk7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PEFQSUFwcGxpY2F0aW9uQ29tbWFuZFtdPignR0VUJywgYC9hcHBsaWNhdGlvbnMvJHthcHBJZH0vZ3VpbGRzLyR7Z3VpbGRJZH0vY29tbWFuZHNgKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhIHNwZWNpZmljIGdsb2JhbCBjb21tYW5kXHJcbiAgICovXHJcbiAgYXN5bmMgZ2V0R2xvYmFsQ29tbWFuZChjb21tYW5kSWQ6IHN0cmluZyk6IFByb21pc2U8QVBJQXBwbGljYXRpb25Db21tYW5kPiB7XHJcbiAgICBjb25zdCBhcHBJZCA9IHRoaXMuZ2V0QXBwbGljYXRpb25JZCgpO1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBUElBcHBsaWNhdGlvbkNvbW1hbmQ+KCdHRVQnLCBgL2FwcGxpY2F0aW9ucy8ke2FwcElkfS9jb21tYW5kcy8ke2NvbW1hbmRJZH1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhIHNwZWNpZmljIGd1aWxkIGNvbW1hbmRcclxuICAgKi9cclxuICBhc3luYyBnZXRHdWlsZENvbW1hbmQoZ3VpbGRJZDogc3RyaW5nLCBjb21tYW5kSWQ6IHN0cmluZyk6IFByb21pc2U8QVBJQXBwbGljYXRpb25Db21tYW5kPiB7XHJcbiAgICBjb25zdCBhcHBJZCA9IHRoaXMuZ2V0QXBwbGljYXRpb25JZCgpO1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBUElBcHBsaWNhdGlvbkNvbW1hbmQ+KCdHRVQnLCBgL2FwcGxpY2F0aW9ucy8ke2FwcElkfS9ndWlsZHMvJHtndWlsZElkfS9jb21tYW5kcy8ke2NvbW1hbmRJZH1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFVwZGF0ZSBhIGdsb2JhbCBjb21tYW5kXHJcbiAgICovXHJcbiAgYXN5bmMgdXBkYXRlR2xvYmFsQ29tbWFuZChjb21tYW5kSWQ6IHN0cmluZywgZGF0YTogUGFydGlhbDxBUElBcHBsaWNhdGlvbkNvbW1hbmQ+KTogUHJvbWlzZTxBUElBcHBsaWNhdGlvbkNvbW1hbmQ+IHtcclxuICAgIGNvbnN0IGFwcElkID0gdGhpcy5nZXRBcHBsaWNhdGlvbklkKCk7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PEFQSUFwcGxpY2F0aW9uQ29tbWFuZD4oJ1BBVENIJywgYC9hcHBsaWNhdGlvbnMvJHthcHBJZH0vY29tbWFuZHMvJHtjb21tYW5kSWR9YCwgZGF0YSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBVcGRhdGUgYSBndWlsZC1zcGVjaWZpYyBjb21tYW5kXHJcbiAgICovXHJcbiAgYXN5bmMgdXBkYXRlR3VpbGRDb21tYW5kKGd1aWxkSWQ6IHN0cmluZywgY29tbWFuZElkOiBzdHJpbmcsIGRhdGE6IFBhcnRpYWw8QVBJQXBwbGljYXRpb25Db21tYW5kPik6IFByb21pc2U8QVBJQXBwbGljYXRpb25Db21tYW5kPiB7XHJcbiAgICBjb25zdCBhcHBJZCA9IHRoaXMuZ2V0QXBwbGljYXRpb25JZCgpO1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBUElBcHBsaWNhdGlvbkNvbW1hbmQ+KCdQQVRDSCcsIGAvYXBwbGljYXRpb25zLyR7YXBwSWR9L2d1aWxkcy8ke2d1aWxkSWR9L2NvbW1hbmRzLyR7Y29tbWFuZElkfWAsIGRhdGEpO1xyXG4gIH1cclxuXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT0gSGVscGVycyA9PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICBwcml2YXRlIGFwcGxpY2F0aW9uSWQ6IHN0cmluZyA9ICcnO1xyXG5cclxuICAvKipcclxuICAgKiBTZXQgdGhlIGFwcGxpY2F0aW9uIElEXHJcbiAgICovXHJcbiAgc2V0QXBwbGljYXRpb25JZChpZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICB0aGlzLmFwcGxpY2F0aW9uSWQgPSBpZDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCB0aGUgYXBwbGljYXRpb24gSURcclxuICAgKi9cclxuICBwcml2YXRlIGdldEFwcGxpY2F0aW9uSWQoKTogc3RyaW5nIHtcclxuICAgIGlmICghdGhpcy5hcHBsaWNhdGlvbklkKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcignQXBwbGljYXRpb24gSUQgbm90IHNldC4gQ2FsbCBzZXRBcHBsaWNhdGlvbklkKCkgZmlyc3QuJyk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGhpcy5hcHBsaWNhdGlvbklkO1xyXG4gIH1cclxuXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT0gQ2hhbm5lbHMgPT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgY2hhbm5lbCBpbiBhIGd1aWxkLlxyXG4gICAqIFxyXG4gICAqIEBwYXJhbSBndWlsZElkIC0gVGhlIElEIG9mIHRoZSBndWlsZFxyXG4gICAqIEBwYXJhbSBkYXRhIC0gQ2hhbm5lbCBjcmVhdGlvbiBvcHRpb25zXHJcbiAgICogQHBhcmFtIGRhdGEubmFtZSAtIENoYW5uZWwgbmFtZSAoMS0xMDAgY2hhcmFjdGVycylcclxuICAgKiBAcGFyYW0gZGF0YS50eXBlIC0gQ2hhbm5lbCB0eXBlICgwID0gdGV4dCwgMiA9IHZvaWNlLCA0ID0gY2F0ZWdvcnksIDEzID0gc3RhZ2UpXHJcbiAgICogQHBhcmFtIGRhdGEucGFyZW50X2lkIC0gQ2F0ZWdvcnkgSUQgdG8gcGxhY2UgdGhlIGNoYW5uZWwgdW5kZXIgKGFsaWFzIGZvciBjYXRlZ29yeV9pZClcclxuICAgKiBAcGFyYW0gZGF0YS5jYXRlZ29yeV9pZCAtIENhdGVnb3J5IElEIHRvIHBsYWNlIHRoZSBjaGFubmVsIHVuZGVyXHJcbiAgICogQHBhcmFtIGRhdGEucGVybWlzc2lvbl9vdmVyd3JpdGVzIC0gQXJyYXkgb2YgcGVybWlzc2lvbiBvdmVyd3JpdGVzIGZvciB0aGUgY2hhbm5lbFxyXG4gICAqIEByZXR1cm5zIFRoZSBjcmVhdGVkIGNoYW5uZWwgb2JqZWN0XHJcbiAgICogQHRocm93cyB7UkVTVEVycm9yfSBJZiB0aGUgYm90IGxhY2tzIE1BTkFHRV9DSEFOTkVMUyBwZXJtaXNzaW9uXHJcbiAgICogXHJcbiAgICogQGV4YW1wbGVcclxuICAgKiBgYGB0c1xyXG4gICAqIC8vIENyZWF0ZSBhIHRleHQgY2hhbm5lbCBpbiBhIGNhdGVnb3J5XHJcbiAgICogY29uc3QgY2hhbm5lbCA9IGF3YWl0IHJlc3QuY3JlYXRlQ2hhbm5lbCgnMTIzNDU2Nzg5Jywge1xyXG4gICAqICAgbmFtZTogJ2dlbmVyYWwtY2hhdCcsXHJcbiAgICogICB0eXBlOiAwLFxyXG4gICAqICAgY2F0ZWdvcnlfaWQ6ICc5ODc2NTQzMjEnXHJcbiAgICogfSk7XHJcbiAgICogYGBgXHJcbiAgICovXHJcbiAgYXN5bmMgY3JlYXRlQ2hhbm5lbChndWlsZElkOiBzdHJpbmcsIGRhdGE6IHtcclxuICAgIG5hbWU6IHN0cmluZztcclxuICAgIHR5cGU/OiBudW1iZXI7XHJcbiAgICBwYXJlbnRfaWQ/OiBzdHJpbmcgfCBudWxsO1xyXG4gICAgY2F0ZWdvcnlfaWQ/OiBzdHJpbmcgfCBudWxsO1xyXG4gICAgcGVybWlzc2lvbl9vdmVyd3JpdGVzPzogQXJyYXk8e1xyXG4gICAgICBpZDogc3RyaW5nO1xyXG4gICAgICB0eXBlOiBudW1iZXI7XHJcbiAgICAgIGFsbG93Pzogc3RyaW5nO1xyXG4gICAgICBkZW55Pzogc3RyaW5nO1xyXG4gICAgfT47XHJcbiAgfSk6IFByb21pc2U8QVBJQ2hhbm5lbD4ge1xyXG4gICAgLy8gTWFwIHBhcmVudF9pZCB0byBjYXRlZ29yeV9pZCBmb3IgYmFja2VuZCBjb21wYXRpYmlsaXR5XHJcbiAgICBjb25zdCByZXF1ZXN0RGF0YTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gPSB7XHJcbiAgICAgIG5hbWU6IGRhdGEubmFtZSxcclxuICAgICAgdHlwZTogZGF0YS50eXBlID8/IDAsIC8vIERlZmF1bHQgdG8gdGV4dCBjaGFubmVsXHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICAvLyBCYWNrZW5kIGV4cGVjdHMgY2F0ZWdvcnlfaWQsIG5vdCBwYXJlbnRfaWRcclxuICAgIGlmIChkYXRhLmNhdGVnb3J5X2lkKSB7XHJcbiAgICAgIHJlcXVlc3REYXRhLmNhdGVnb3J5X2lkID0gZGF0YS5jYXRlZ29yeV9pZDtcclxuICAgIH0gZWxzZSBpZiAoZGF0YS5wYXJlbnRfaWQpIHtcclxuICAgICAgcmVxdWVzdERhdGEuY2F0ZWdvcnlfaWQgPSBkYXRhLnBhcmVudF9pZDtcclxuICAgIH1cclxuICAgIFxyXG4gICAgLy8gQWRkIHBlcm1pc3Npb25fb3ZlcndyaXRlcyBpZiBwcm92aWRlZFxyXG4gICAgaWYgKGRhdGEucGVybWlzc2lvbl9vdmVyd3JpdGVzICYmIGRhdGEucGVybWlzc2lvbl9vdmVyd3JpdGVzLmxlbmd0aCA+IDApIHtcclxuICAgICAgcmVxdWVzdERhdGEucGVybWlzc2lvbl9vdmVyd3JpdGVzID0gZGF0YS5wZXJtaXNzaW9uX292ZXJ3cml0ZXM7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QVBJQ2hhbm5lbD4oJ1BPU1QnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVsc2AsIHJlcXVlc3REYXRhKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlbGV0ZSBhIGNoYW5uZWwgZnJvbSBhIGd1aWxkLlxyXG4gICAqIFRoaXMgYWN0aW9uIGlzIGlycmV2ZXJzaWJsZS4gQWxsIG1lc3NhZ2VzIGluIHRoZSBjaGFubmVsIHdpbGwgYmUgbG9zdC5cclxuICAgKiBcclxuICAgKiBAcGFyYW0gZ3VpbGRJZCAtIFRoZSBJRCBvZiB0aGUgZ3VpbGRcclxuICAgKiBAcGFyYW0gY2hhbm5lbElkIC0gVGhlIElEIG9mIHRoZSBjaGFubmVsIHRvIGRlbGV0ZVxyXG4gICAqIEByZXR1cm5zIHZvaWRcclxuICAgKiBAdGhyb3dzIHtSRVNURXJyb3J9IElmIHRoZSBib3QgbGFja3MgTUFOQUdFX0NIQU5ORUxTIHBlcm1pc3Npb25cclxuICAgKiBcclxuICAgKiBAZXhhbXBsZVxyXG4gICAqIGBgYHRzXHJcbiAgICogYXdhaXQgcmVzdC5kZWxldGVDaGFubmVsKCcxMjM0NTY3ODknLCAnOTg3NjU0MzIxJyk7XHJcbiAgICogYGBgXHJcbiAgICovXHJcbiAgYXN5bmMgZGVsZXRlQ2hhbm5lbChndWlsZElkOiBzdHJpbmcsIGNoYW5uZWxJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3QoJ0RFTEVURScsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzLyR7Y2hhbm5lbElkfWApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRWRpdCBhIGNoYW5uZWwncyBzZXR0aW5ncy5cclxuICAgKiBcclxuICAgKiBAcGFyYW0gZ3VpbGRJZCAtIFRoZSBJRCBvZiB0aGUgZ3VpbGRcclxuICAgKiBAcGFyYW0gY2hhbm5lbElkIC0gVGhlIElEIG9mIHRoZSBjaGFubmVsIHRvIGVkaXRcclxuICAgKiBAcGFyYW0gZGF0YSAtIFRoZSBjaGFubmVsIGRhdGEgdG8gdXBkYXRlXHJcbiAgICogQHJldHVybnMgVGhlIHVwZGF0ZWQgY2hhbm5lbFxyXG4gICAqIEB0aHJvd3Mge1JFU1RFcnJvcn0gSWYgdGhlIGJvdCBsYWNrcyBNQU5BR0VfQ0hBTk5FTFMgcGVybWlzc2lvblxyXG4gICAqIFxyXG4gICAqIEBleGFtcGxlXHJcbiAgICogYGBgdHNcclxuICAgKiBhd2FpdCByZXN0LmVkaXRDaGFubmVsKCcxMjMnLCAnNDU2Jywge1xyXG4gICAqICAgbmFtZTogJ25ldy1uYW1lJyxcclxuICAgKiAgIHRvcGljOiAnTmV3IHRvcGljJyxcclxuICAgKiAgIHNsb3dtb2RlX3NlY29uZHM6IDVcclxuICAgKiB9KTtcclxuICAgKiBgYGBcclxuICAgKi9cclxuICBhc3luYyBlZGl0Q2hhbm5lbChndWlsZElkOiBzdHJpbmcsIGNoYW5uZWxJZDogc3RyaW5nLCBkYXRhOiB7XHJcbiAgICBuYW1lPzogc3RyaW5nO1xyXG4gICAgdG9waWM/OiBzdHJpbmc7XHJcbiAgICBwb3NpdGlvbj86IG51bWJlcjtcclxuICAgIHNsb3dtb2RlX3NlY29uZHM/OiBudW1iZXI7XHJcbiAgICBuc2Z3PzogYm9vbGVhbjtcclxuICAgIHBhcmVudF9pZD86IHN0cmluZyB8IG51bGw7XHJcbiAgICBwZXJtaXNzaW9uX292ZXJ3cml0ZXM/OiBBcnJheTx7XHJcbiAgICAgIGlkOiBzdHJpbmc7XHJcbiAgICAgIHR5cGU6IG51bWJlcjtcclxuICAgICAgYWxsb3c/OiBzdHJpbmc7XHJcbiAgICAgIGRlbnk/OiBzdHJpbmc7XHJcbiAgICB9PjtcclxuICB9KTogUHJvbWlzZTxBUElDaGFubmVsPiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PEFQSUNoYW5uZWw+KCdQQVRDSCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzLyR7Y2hhbm5lbElkfWAsIGRhdGEpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVsZXRlIGEgY2F0ZWdvcnkgYW5kIG9wdGlvbmFsbHkgaXRzIGNoaWxkIGNoYW5uZWxzLlxyXG4gICAqIFxyXG4gICAqIEBwYXJhbSBndWlsZElkIC0gVGhlIElEIG9mIHRoZSBndWlsZFxyXG4gICAqIEBwYXJhbSBjYXRlZ29yeUlkIC0gVGhlIElEIG9mIHRoZSBjYXRlZ29yeSB0byBkZWxldGVcclxuICAgKiBAcmV0dXJucyB2b2lkXHJcbiAgICogQHRocm93cyB7UkVTVEVycm9yfSBJZiB0aGUgYm90IGxhY2tzIE1BTkFHRV9DSEFOTkVMUyBwZXJtaXNzaW9uXHJcbiAgICogXHJcbiAgICogQGV4YW1wbGVcclxuICAgKiBgYGB0c1xyXG4gICAqIGF3YWl0IHJlc3QuZGVsZXRlQ2F0ZWdvcnkoJzEyMzQ1Njc4OScsICc5ODc2NTQzMjEnKTtcclxuICAgKiBgYGBcclxuICAgKi9cclxuICBhc3luYyBkZWxldGVDYXRlZ29yeShndWlsZElkOiBzdHJpbmcsIGNhdGVnb3J5SWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0KCdERUxFVEUnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jYXRlZ29yaWVzLyR7Y2F0ZWdvcnlJZH1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEVkaXQgY2hhbm5lbCBwZXJtaXNzaW9uIG92ZXJ3cml0ZXMgZm9yIGEgcm9sZSBvciBtZW1iZXIuXHJcbiAgICogXHJcbiAgICogQHBhcmFtIGNoYW5uZWxJZCAtIFRoZSBJRCBvZiB0aGUgY2hhbm5lbFxyXG4gICAqIEBwYXJhbSBvdmVyd3JpdGVJZCAtIFRoZSBJRCBvZiB0aGUgcm9sZSBvciBtZW1iZXJcclxuICAgKiBAcGFyYW0gZGF0YSAtIFBlcm1pc3Npb24gb3ZlcndyaXRlIGRhdGFcclxuICAgKiBAcGFyYW0gZGF0YS50eXBlIC0gMCBmb3Igcm9sZSwgMSBmb3IgbWVtYmVyXHJcbiAgICogQHBhcmFtIGRhdGEuYWxsb3cgLSBCaXRmaWVsZCBvZiBhbGxvd2VkIHBlcm1pc3Npb25zXHJcbiAgICogQHBhcmFtIGRhdGEuZGVueSAtIEJpdGZpZWxkIG9mIGRlbmllZCBwZXJtaXNzaW9uc1xyXG4gICAqIEByZXR1cm5zIHZvaWRcclxuICAgKiBAdGhyb3dzIHtSRVNURXJyb3J9IElmIHRoZSBib3QgbGFja3MgTUFOQUdFX1JPTEVTIHBlcm1pc3Npb25cclxuICAgKiBcclxuICAgKiBAZXhhbXBsZVxyXG4gICAqIGBgYHRzXHJcbiAgICogLy8gQWxsb3cgYSByb2xlIHRvIHNlbmQgbWVzc2FnZXMgYnV0IGRlbnkgZmlsZSB1cGxvYWRzXHJcbiAgICogYXdhaXQgcmVzdC5lZGl0Q2hhbm5lbFBlcm1pc3Npb25zKCc0NTYnLCAncm9sZUlkJywge1xyXG4gICAqICAgdHlwZTogMCxcclxuICAgKiAgIGFsbG93OiAnMjA0OCcsICAvLyBTRU5EX01FU1NBR0VTXHJcbiAgICogICBkZW55OiAnMzI3NjgnICAgLy8gQVRUQUNIX0ZJTEVTXHJcbiAgICogfSk7XHJcbiAgICogYGBgXHJcbiAgICovXHJcbiAgYXN5bmMgZWRpdENoYW5uZWxQZXJtaXNzaW9ucyhjaGFubmVsSWQ6IHN0cmluZywgb3ZlcndyaXRlSWQ6IHN0cmluZywgZGF0YToge1xyXG4gICAgdHlwZTogbnVtYmVyO1xyXG4gICAgYWxsb3c/OiBzdHJpbmc7XHJcbiAgICBkZW55Pzogc3RyaW5nO1xyXG4gIH0pOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdCgnUFVUJywgYC9ib3QvY2hhbm5lbHMvJHtjaGFubmVsSWR9L3Blcm1pc3Npb25zLyR7b3ZlcndyaXRlSWR9YCwgZGF0YSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZWxldGUgYSBjaGFubmVsIHBlcm1pc3Npb24gb3ZlcndyaXRlLlxyXG4gICAqIFxyXG4gICAqIEBwYXJhbSBjaGFubmVsSWQgLSBUaGUgSUQgb2YgdGhlIGNoYW5uZWxcclxuICAgKiBAcGFyYW0gb3ZlcndyaXRlSWQgLSBUaGUgSUQgb2YgdGhlIHJvbGUgb3IgbWVtYmVyIG92ZXJ3cml0ZSB0byBkZWxldGVcclxuICAgKiBAcmV0dXJucyB2b2lkXHJcbiAgICogQHRocm93cyB7UkVTVEVycm9yfSBJZiB0aGUgYm90IGxhY2tzIE1BTkFHRV9ST0xFUyBwZXJtaXNzaW9uXHJcbiAgICogXHJcbiAgICogQGV4YW1wbGVcclxuICAgKiBgYGB0c1xyXG4gICAqIGF3YWl0IHJlc3QuZGVsZXRlQ2hhbm5lbFBlcm1pc3Npb24oJzQ1NicsICdyb2xlSWQnKTtcclxuICAgKiBgYGBcclxuICAgKi9cclxuICBhc3luYyBkZWxldGVDaGFubmVsUGVybWlzc2lvbihjaGFubmVsSWQ6IHN0cmluZywgb3ZlcndyaXRlSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0KCdERUxFVEUnLCBgL2JvdC9jaGFubmVscy8ke2NoYW5uZWxJZH0vcGVybWlzc2lvbnMvJHtvdmVyd3JpdGVJZH1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBtZXNzYWdlcyBmcm9tIGEgY2hhbm5lbCB3aXRoIG9wdGlvbmFsIHBhZ2luYXRpb24uXHJcbiAgICogXHJcbiAgICogQHBhcmFtIGd1aWxkSWQgLSBUaGUgSUQgb2YgdGhlIGd1aWxkXHJcbiAgICogQHBhcmFtIGNoYW5uZWxJZCAtIFRoZSBJRCBvZiB0aGUgY2hhbm5lbFxyXG4gICAqIEBwYXJhbSBvcHRpb25zIC0gUGFnaW5hdGlvbiBvcHRpb25zXHJcbiAgICogQHBhcmFtIG9wdGlvbnMubGltaXQgLSBNYXhpbXVtIG51bWJlciBvZiBtZXNzYWdlcyB0byByZXR1cm4gKDEtMTAwLCBkZWZhdWx0OiA1MClcclxuICAgKiBAcGFyYW0gb3B0aW9ucy5iZWZvcmUgLSBHZXQgbWVzc2FnZXMgYmVmb3JlIHRoaXMgbWVzc2FnZSBJRFxyXG4gICAqIEBwYXJhbSBvcHRpb25zLmFmdGVyIC0gR2V0IG1lc3NhZ2VzIGFmdGVyIHRoaXMgbWVzc2FnZSBJRFxyXG4gICAqIEByZXR1cm5zIEFycmF5IG9mIG1lc3NhZ2VzLCBuZXdlc3QgZmlyc3Qgd2hlbiB1c2luZyBgYmVmb3JlYFxyXG4gICAqIEB0aHJvd3Mge1JFU1RFcnJvcn0gSWYgdGhlIGJvdCBsYWNrcyBSRUFEX01FU1NBR0VfSElTVE9SWSBwZXJtaXNzaW9uXHJcbiAgICogXHJcbiAgICogQGV4YW1wbGVcclxuICAgKiBgYGB0c1xyXG4gICAqIC8vIEdldCBsYXN0IDUwIG1lc3NhZ2VzXHJcbiAgICogY29uc3QgbWVzc2FnZXMgPSBhd2FpdCByZXN0LmdldE1lc3NhZ2VzKCcxMjMnLCAnNDU2JywgeyBsaW1pdDogNTAgfSk7XHJcbiAgICogXHJcbiAgICogLy8gR2V0IG1lc3NhZ2VzIGJlZm9yZSBhIHNwZWNpZmljIG1lc3NhZ2UgKGZvciBwYWdpbmF0aW9uKVxyXG4gICAqIGNvbnN0IG9sZGVyID0gYXdhaXQgcmVzdC5nZXRNZXNzYWdlcygnMTIzJywgJzQ1NicsIHsgXHJcbiAgICogICBsaW1pdDogNTAsIFxyXG4gICAqICAgYmVmb3JlOiBtZXNzYWdlc1ttZXNzYWdlcy5sZW5ndGggLSAxXS5pZCBcclxuICAgKiB9KTtcclxuICAgKiBgYGBcclxuICAgKi9cclxuICBhc3luYyBnZXRNZXNzYWdlcyhndWlsZElkOiBzdHJpbmcsIGNoYW5uZWxJZDogc3RyaW5nLCBvcHRpb25zPzoge1xyXG4gICAgbGltaXQ/OiBudW1iZXI7XHJcbiAgICBiZWZvcmU/OiBzdHJpbmc7XHJcbiAgICBhZnRlcj86IHN0cmluZztcclxuICB9KTogUHJvbWlzZTxBUElNZXNzYWdlW10+IHtcclxuICAgIGNvbnN0IHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoKTtcclxuICAgIGlmIChvcHRpb25zPy5saW1pdCkgcGFyYW1zLmFwcGVuZCgnbGltaXQnLCBTdHJpbmcob3B0aW9ucy5saW1pdCkpO1xyXG4gICAgaWYgKG9wdGlvbnM/LmJlZm9yZSkgcGFyYW1zLmFwcGVuZCgnYmVmb3JlJywgb3B0aW9ucy5iZWZvcmUpO1xyXG4gICAgaWYgKG9wdGlvbnM/LmFmdGVyKSBwYXJhbXMuYXBwZW5kKCdhZnRlcicsIG9wdGlvbnMuYWZ0ZXIpO1xyXG4gICAgXHJcbiAgICBjb25zdCBxdWVyeSA9IHBhcmFtcy50b1N0cmluZygpID8gYD8ke3BhcmFtcy50b1N0cmluZygpfWAgOiAnJztcclxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5yZXF1ZXN0PHsgbWVzc2FnZXM6IEFQSU1lc3NhZ2VbXTsgcGFnZV9pbmZvOiBhbnkgfT4oJ0dFVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS9tZXNzYWdlcyR7cXVlcnl9YCk7XHJcbiAgICByZXR1cm4gcmVzcG9uc2UubWVzc2FnZXMgfHwgW107XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBc3luYyBnZW5lcmF0b3IgdGhhdCB5aWVsZHMgYmF0Y2hlcyBvZiBtZXNzYWdlcywgYXV0b21hdGljYWxseSBoYW5kbGluZyBwYWdpbmF0aW9uLlxyXG4gICAqIE1lc3NhZ2VzIGFyZSBmZXRjaGVkIGluIHJldmVyc2UgY2hyb25vbG9naWNhbCBvcmRlciAobmV3ZXN0IHRvIG9sZGVzdCkuXHJcbiAgICogXHJcbiAgICogQHBhcmFtIGd1aWxkSWQgLSBUaGUgSUQgb2YgdGhlIGd1aWxkXHJcbiAgICogQHBhcmFtIGNoYW5uZWxJZCAtIFRoZSBJRCBvZiB0aGUgY2hhbm5lbFxyXG4gICAqIEBwYXJhbSBvcHRpb25zIC0gSXRlcmF0b3Igb3B0aW9uc1xyXG4gICAqIEBwYXJhbSBvcHRpb25zLmxpbWl0IC0gVG90YWwgbWF4aW11bSBudW1iZXIgb2YgbWVzc2FnZXMgdG8gZmV0Y2ggKGRlZmF1bHQ6IHVubGltaXRlZClcclxuICAgKiBAcGFyYW0gb3B0aW9ucy5iYXRjaFNpemUgLSBOdW1iZXIgb2YgbWVzc2FnZXMgcGVyIEFQSSByZXF1ZXN0ICgxLTEwMCwgZGVmYXVsdDogMTAwKVxyXG4gICAqIEB5aWVsZHMgQXJyYXlzIG9mIG1lc3NhZ2VzIChiYXRjaGVzKVxyXG4gICAqIEB0aHJvd3Mge1JFU1RFcnJvcn0gSWYgdGhlIGJvdCBsYWNrcyBSRUFEX01FU1NBR0VfSElTVE9SWSBwZXJtaXNzaW9uXHJcbiAgICogXHJcbiAgICogQGV4YW1wbGVcclxuICAgKiBgYGB0c1xyXG4gICAqIC8vIEl0ZXJhdGUgdGhyb3VnaCBhbGwgbWVzc2FnZXMgaW4gYSBjaGFubmVsXHJcbiAgICogZm9yIGF3YWl0IChjb25zdCBiYXRjaCBvZiByZXN0LmdldE1lc3NhZ2VzSXRlcmF0b3IoJzEyMycsICc0NTYnKSkge1xyXG4gICAqICAgZm9yIChjb25zdCBtZXNzYWdlIG9mIGJhdGNoKSB7XHJcbiAgICogICAgIGNvbnNvbGUubG9nKG1lc3NhZ2UuY29udGVudCk7XHJcbiAgICogICB9XHJcbiAgICogfVxyXG4gICAqIFxyXG4gICAqIC8vIEdldCB1cCB0byA1MDAgbWVzc2FnZXNcclxuICAgKiBmb3IgYXdhaXQgKGNvbnN0IGJhdGNoIG9mIHJlc3QuZ2V0TWVzc2FnZXNJdGVyYXRvcignMTIzJywgJzQ1NicsIHsgbGltaXQ6IDUwMCB9KSkge1xyXG4gICAqICAgcHJvY2Vzc0JhdGNoKGJhdGNoKTtcclxuICAgKiB9XHJcbiAgICogYGBgXHJcbiAgICovXHJcbiAgYXN5bmMgKmdldE1lc3NhZ2VzSXRlcmF0b3IoZ3VpbGRJZDogc3RyaW5nLCBjaGFubmVsSWQ6IHN0cmluZywgb3B0aW9ucz86IHtcclxuICAgIGxpbWl0PzogbnVtYmVyO1xyXG4gICAgYmF0Y2hTaXplPzogbnVtYmVyO1xyXG4gIH0pOiBBc3luY0dlbmVyYXRvcjxBUElNZXNzYWdlW10sIHZvaWQsIHVua25vd24+IHtcclxuICAgIGNvbnN0IGJhdGNoU2l6ZSA9IE1hdGgubWluKG9wdGlvbnM/LmJhdGNoU2l6ZSA/PyAxMDAsIDEwMCk7XHJcbiAgICBjb25zdCBtYXhNZXNzYWdlcyA9IG9wdGlvbnM/LmxpbWl0O1xyXG4gICAgbGV0IGZldGNoZWQgPSAwO1xyXG4gICAgbGV0IGJlZm9yZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xyXG5cclxuICAgIHdoaWxlICh0cnVlKSB7XHJcbiAgICAgIC8vIENhbGN1bGF0ZSBob3cgbWFueSB0byBmZXRjaCBpbiB0aGlzIGJhdGNoXHJcbiAgICAgIGNvbnN0IHRvRmV0Y2ggPSBtYXhNZXNzYWdlcyAhPT0gdW5kZWZpbmVkIFxyXG4gICAgICAgID8gTWF0aC5taW4oYmF0Y2hTaXplLCBtYXhNZXNzYWdlcyAtIGZldGNoZWQpIFxyXG4gICAgICAgIDogYmF0Y2hTaXplO1xyXG5cclxuICAgICAgaWYgKHRvRmV0Y2ggPD0gMCkgYnJlYWs7XHJcblxyXG4gICAgICBjb25zdCBtZXNzYWdlcyA9IGF3YWl0IHRoaXMuZ2V0TWVzc2FnZXMoZ3VpbGRJZCwgY2hhbm5lbElkLCB7XHJcbiAgICAgICAgbGltaXQ6IHRvRmV0Y2gsXHJcbiAgICAgICAgYmVmb3JlXHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgaWYgKG1lc3NhZ2VzLmxlbmd0aCA9PT0gMCkgYnJlYWs7XHJcblxyXG4gICAgICB5aWVsZCBtZXNzYWdlcztcclxuICAgICAgZmV0Y2hlZCArPSBtZXNzYWdlcy5sZW5ndGg7XHJcblxyXG4gICAgICAvLyBVc2UgdGhlIG9sZGVzdCBtZXNzYWdlIElEIGFzIHRoZSAnYmVmb3JlJyBjdXJzb3IgZm9yIG5leHQgYmF0Y2hcclxuICAgICAgYmVmb3JlID0gbWVzc2FnZXNbbWVzc2FnZXMubGVuZ3RoIC0gMV0uaWQ7XHJcblxyXG4gICAgICAvLyBTdG9wIGlmIHdlIGdvdCBmZXdlciB0aGFuIHJlcXVlc3RlZCAobm8gbW9yZSBtZXNzYWdlcylcclxuICAgICAgaWYgKG1lc3NhZ2VzLmxlbmd0aCA8IHRvRmV0Y2gpIGJyZWFrO1xyXG5cclxuICAgICAgLy8gU3RvcCBpZiB3ZSd2ZSByZWFjaGVkIHRoZSBsaW1pdFxyXG4gICAgICBpZiAobWF4TWVzc2FnZXMgIT09IHVuZGVmaW5lZCAmJiBmZXRjaGVkID49IG1heE1lc3NhZ2VzKSBicmVhaztcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8vID09PT09PT09PT09PT09PT09PT09IE1lbWJlcnMgPT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGEgZ3VpbGQgbWVtYmVyIGJ5IHRoZWlyIHVzZXIgSUQuXHJcbiAgICogXHJcbiAgICogQHBhcmFtIGd1aWxkSWQgLSBUaGUgSUQgb2YgdGhlIGd1aWxkXHJcbiAgICogQHBhcmFtIHVzZXJJZCAtIFRoZSBJRCBvZiB0aGUgdXNlciB0byBmZXRjaFxyXG4gICAqIEByZXR1cm5zIFRoZSBtZW1iZXIgZGF0YSBpbmNsdWRpbmcgcm9sZXMsIG5pY2tuYW1lLCBhbmQgam9pbiBkYXRlXHJcbiAgICogQHRocm93cyB7UkVTVEVycm9yfSBJZiB0aGUgbWVtYmVyIGlzIG5vdCBmb3VuZCAoNDA0KSBvciB0aGUgYm90IGxhY2tzIHBlcm1pc3Npb25zXHJcbiAgICogXHJcbiAgICogQGV4YW1wbGVcclxuICAgKiBgYGB0c1xyXG4gICAqIGNvbnN0IG1lbWJlciA9IGF3YWl0IHJlc3QuZ2V0TWVtYmVyKCcxMjM0NTY3ODknLCAnOTg3NjU0MzIxJyk7XHJcbiAgICogY29uc29sZS5sb2coYCR7bWVtYmVyLnVzZXIudXNlcm5hbWV9IGpvaW5lZCBhdCAke21lbWJlci5qb2luZWRfYXR9YCk7XHJcbiAgICogYGBgXHJcbiAgICovXHJcbiAgYXN5bmMgZ2V0TWVtYmVyKGd1aWxkSWQ6IHN0cmluZywgdXNlcklkOiBzdHJpbmcpOiBQcm9taXNlPEFQSU1lbWJlckRhdGE+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QVBJTWVtYmVyRGF0YT4oJ0dFVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L21lbWJlcnMvJHt1c2VySWR9YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSBwYWdpbmF0ZWQgbGlzdCBvZiBndWlsZCBtZW1iZXJzLlxyXG4gICAqIFVzZXMgY3Vyc29yLWJhc2VkIHBhZ2luYXRpb24gZm9yIGVmZmljaWVudCB0cmF2ZXJzYWwgb2YgbGFyZ2UgbWVtYmVyIGxpc3RzLlxyXG4gICAqIFxyXG4gICAqIEBwYXJhbSBndWlsZElkIC0gVGhlIElEIG9mIHRoZSBndWlsZFxyXG4gICAqIEBwYXJhbSBvcHRpb25zIC0gUGFnaW5hdGlvbiBvcHRpb25zXHJcbiAgICogQHBhcmFtIG9wdGlvbnMubGltaXQgLSBNYXhpbXVtIG51bWJlciBvZiBtZW1iZXJzIHRvIHJldHVybiAoZGVmYXVsdDogMTAwLCBtYXg6IDEwMDApXHJcbiAgICogQHBhcmFtIG9wdGlvbnMuY3Vyc29yIC0gQ3Vyc29yIGZvciBwYWdpbmF0aW9uIChmcm9tIHByZXZpb3VzIHJlc3BvbnNlJ3MgbmV4dF9jdXJzb3IpXHJcbiAgICogQHJldHVybnMgUGFnaW5hdGVkIHJlc3BvbnNlIHdpdGggbWVtYmVycyBhcnJheSBhbmQgY3Vyc29yIGluZm9cclxuICAgKiBcclxuICAgKiBAZXhhbXBsZVxyXG4gICAqIGBgYHRzXHJcbiAgICogLy8gR2V0IGZpcnN0IHBhZ2VcclxuICAgKiBjb25zdCBwYWdlMSA9IGF3YWl0IHJlc3QuZ2V0TWVtYmVycygnMTIzNDU2Nzg5JywgeyBsaW1pdDogNTAgfSk7XHJcbiAgICogXHJcbiAgICogLy8gR2V0IG5leHQgcGFnZSB1c2luZyBjdXJzb3JcclxuICAgKiBpZiAocGFnZTEubmV4dF9jdXJzb3IpIHtcclxuICAgKiAgIGNvbnN0IHBhZ2UyID0gYXdhaXQgcmVzdC5nZXRNZW1iZXJzKCcxMjM0NTY3ODknLCB7IGN1cnNvcjogcGFnZTEubmV4dF9jdXJzb3IgfSk7XHJcbiAgICogfVxyXG4gICAqIGBgYFxyXG4gICAqL1xyXG4gIGFzeW5jIGdldE1lbWJlcnMoZ3VpbGRJZDogc3RyaW5nLCBvcHRpb25zPzogeyBsaW1pdD86IG51bWJlcjsgY3Vyc29yPzogc3RyaW5nIH0pOiBQcm9taXNlPEFQSU1lbWJlcnNSZXNwb25zZT4ge1xyXG4gICAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcygpO1xyXG4gICAgcGFyYW1zLnNldCgnZmxhdCcsICd0cnVlJyk7IC8vIEJvdCBBUEkgYWx3YXlzIHVzZXMgZmxhdCByZXNwb25zZSAobm8gcHJlc2VuY2UgZ3JvdXBpbmcpXHJcbiAgICBpZiAob3B0aW9ucz8ubGltaXQpIHBhcmFtcy5zZXQoJ2xpbWl0JywgU3RyaW5nKG9wdGlvbnMubGltaXQpKTtcclxuICAgIGlmIChvcHRpb25zPy5jdXJzb3IpIHBhcmFtcy5zZXQoJ2N1cnNvcicsIG9wdGlvbnMuY3Vyc29yKTtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QVBJTWVtYmVyc1Jlc3BvbnNlPignR0VUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vbWVtYmVycz8ke3BhcmFtcy50b1N0cmluZygpfWApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQXN5bmMgZ2VuZXJhdG9yIHRoYXQgeWllbGRzIGJhdGNoZXMgb2YgZ3VpbGQgbWVtYmVycywgYXV0b21hdGljYWxseSBoYW5kbGluZyBjdXJzb3ItYmFzZWQgcGFnaW5hdGlvbi5cclxuICAgKiBcclxuICAgKiBAcGFyYW0gZ3VpbGRJZCAtIFRoZSBJRCBvZiB0aGUgZ3VpbGRcclxuICAgKiBAcGFyYW0gb3B0aW9ucyAtIEl0ZXJhdG9yIG9wdGlvbnNcclxuICAgKiBAcGFyYW0gb3B0aW9ucy5saW1pdCAtIFRvdGFsIG1heGltdW0gbnVtYmVyIG9mIG1lbWJlcnMgdG8gZmV0Y2ggKGRlZmF1bHQ6IHVubGltaXRlZClcclxuICAgKiBAcGFyYW0gb3B0aW9ucy5iYXRjaFNpemUgLSBOdW1iZXIgb2YgbWVtYmVycyBwZXIgQVBJIHJlcXVlc3QgKGRlZmF1bHQ6IDEwMCwgbWF4OiAxMDAwKVxyXG4gICAqIEB5aWVsZHMgQXJyYXlzIG9mIG1lbWJlciBkYXRhIChiYXRjaGVzKVxyXG4gICAqIEB0aHJvd3Mge1JFU1RFcnJvcn0gSWYgdGhlIGJvdCBsYWNrcyBwZXJtaXNzaW9uc1xyXG4gICAqIFxyXG4gICAqIEBleGFtcGxlXHJcbiAgICogYGBgdHNcclxuICAgKiAvLyBJdGVyYXRlIHRocm91Z2ggYWxsIG1lbWJlcnMgaW4gYSBndWlsZFxyXG4gICAqIGZvciBhd2FpdCAoY29uc3QgYmF0Y2ggb2YgcmVzdC5nZXRNZW1iZXJzSXRlcmF0b3IoJzEyMzQ1Njc4OScpKSB7XHJcbiAgICogICBmb3IgKGNvbnN0IG1lbWJlciBvZiBiYXRjaCkge1xyXG4gICAqICAgICBjb25zb2xlLmxvZyhtZW1iZXIudXNlcj8udXNlcm5hbWUpO1xyXG4gICAqICAgfVxyXG4gICAqIH1cclxuICAgKiBcclxuICAgKiAvLyBHZXQgdXAgdG8gNTAwIG1lbWJlcnNcclxuICAgKiBmb3IgYXdhaXQgKGNvbnN0IGJhdGNoIG9mIHJlc3QuZ2V0TWVtYmVyc0l0ZXJhdG9yKCcxMjM0NTY3ODknLCB7IGxpbWl0OiA1MDAgfSkpIHtcclxuICAgKiAgIHByb2Nlc3NCYXRjaChiYXRjaCk7XHJcbiAgICogfVxyXG4gICAqIGBgYFxyXG4gICAqL1xyXG4gIGFzeW5jICpnZXRNZW1iZXJzSXRlcmF0b3IoZ3VpbGRJZDogc3RyaW5nLCBvcHRpb25zPzoge1xyXG4gICAgbGltaXQ/OiBudW1iZXI7XHJcbiAgICBiYXRjaFNpemU/OiBudW1iZXI7XHJcbiAgfSk6IEFzeW5jR2VuZXJhdG9yPEFQSU1lbWJlckRhdGFbXSwgdm9pZCwgdW5rbm93bj4ge1xyXG4gICAgY29uc3QgYmF0Y2hTaXplID0gTWF0aC5taW4ob3B0aW9ucz8uYmF0Y2hTaXplID8/IDEwMCwgMTAwMCk7XHJcbiAgICBjb25zdCBtYXhNZW1iZXJzID0gb3B0aW9ucz8ubGltaXQ7XHJcbiAgICBsZXQgZmV0Y2hlZCA9IDA7XHJcbiAgICBsZXQgY3Vyc29yOiBzdHJpbmcgfCB1bmRlZmluZWQ7XHJcblxyXG4gICAgd2hpbGUgKHRydWUpIHtcclxuICAgICAgLy8gQ2FsY3VsYXRlIGhvdyBtYW55IHRvIGZldGNoIGluIHRoaXMgYmF0Y2hcclxuICAgICAgY29uc3QgdG9GZXRjaCA9IG1heE1lbWJlcnMgIT09IHVuZGVmaW5lZCBcclxuICAgICAgICA/IE1hdGgubWluKGJhdGNoU2l6ZSwgbWF4TWVtYmVycyAtIGZldGNoZWQpIFxyXG4gICAgICAgIDogYmF0Y2hTaXplO1xyXG5cclxuICAgICAgaWYgKHRvRmV0Y2ggPD0gMCkgYnJlYWs7XHJcblxyXG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMuZ2V0TWVtYmVycyhndWlsZElkLCB7XHJcbiAgICAgICAgbGltaXQ6IHRvRmV0Y2gsXHJcbiAgICAgICAgY3Vyc29yXHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgY29uc3QgbWVtYmVycyA9IHJlc3BvbnNlLm1lbWJlcnMgfHwgW107XHJcbiAgICAgIGlmIChtZW1iZXJzLmxlbmd0aCA9PT0gMCkgYnJlYWs7XHJcblxyXG4gICAgICB5aWVsZCBtZW1iZXJzO1xyXG4gICAgICBmZXRjaGVkICs9IG1lbWJlcnMubGVuZ3RoO1xyXG5cclxuICAgICAgLy8gVXNlIHRoZSBjdXJzb3IgZnJvbSBwYWdlX2luZm8gZm9yIG5leHQgYmF0Y2hcclxuICAgICAgY3Vyc29yID0gcmVzcG9uc2UucGFnZV9pbmZvPy5jdXJzb3I7XHJcblxyXG4gICAgICAvLyBTdG9wIGlmIG5vIG1vcmUgcGFnZXNcclxuICAgICAgaWYgKCFyZXNwb25zZS5wYWdlX2luZm8/Lmhhc19tb3JlKSBicmVhaztcclxuXHJcbiAgICAgIC8vIFN0b3AgaWYgd2UndmUgcmVhY2hlZCB0aGUgbGltaXRcclxuICAgICAgaWYgKG1heE1lbWJlcnMgIT09IHVuZGVmaW5lZCAmJiBmZXRjaGVkID49IG1heE1lbWJlcnMpIGJyZWFrO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVGltZW91dCAobXV0ZSkgYSBndWlsZCBtZW1iZXIgZm9yIGEgc3BlY2lmaWVkIGR1cmF0aW9uLlxyXG4gICAqIFBhc3MgbnVsbCBmb3IgZHVyYXRpb24gdG8gY2xlYXIgYW4gZXhpc3RpbmcgdGltZW91dC5cclxuICAgKiBcclxuICAgKiBAcGFyYW0gZ3VpbGRJZCAtIFRoZSBJRCBvZiB0aGUgZ3VpbGRcclxuICAgKiBAcGFyYW0gdXNlcklkIC0gVGhlIElEIG9mIHRoZSBtZW1iZXIgdG8gdGltZW91dFxyXG4gICAqIEBwYXJhbSBkdXJhdGlvbiAtIFRpbWVvdXQgZHVyYXRpb24gaW4gbWlsbGlzZWNvbmRzLCBvciBudWxsIHRvIGNsZWFyXHJcbiAgICogQHBhcmFtIHJlYXNvbiAtIE9wdGlvbmFsIGF1ZGl0IGxvZyByZWFzb25cclxuICAgKiBAcmV0dXJucyB2b2lkXHJcbiAgICogQHRocm93cyB7UkVTVEVycm9yfSBJZiB0aGUgYm90IGxhY2tzIE1PREVSQVRFX01FTUJFUlMgcGVybWlzc2lvblxyXG4gICAqIFxyXG4gICAqIEBleGFtcGxlXHJcbiAgICogYGBgdHNcclxuICAgKiAvLyBUaW1lb3V0IGZvciA1IG1pbnV0ZXNcclxuICAgKiBhd2FpdCByZXN0LnRpbWVvdXRNZW1iZXIoJzEyMycsICc0NTYnLCA1ICogNjAgKiAxMDAwLCAnU3BhbW1pbmcnKTtcclxuICAgKiBcclxuICAgKiAvLyBDbGVhciB0aW1lb3V0XHJcbiAgICogYXdhaXQgcmVzdC50aW1lb3V0TWVtYmVyKCcxMjMnLCAnNDU2JywgbnVsbCwgJ0FwcGVhbGVkJyk7XHJcbiAgICogYGBgXHJcbiAgICovXHJcbiAgYXN5bmMgdGltZW91dE1lbWJlcihndWlsZElkOiBzdHJpbmcsIHVzZXJJZDogc3RyaW5nLCBkdXJhdGlvbjogbnVtYmVyIHwgbnVsbCwgcmVhc29uPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBpZiAoZHVyYXRpb24gPT09IG51bGwpIHtcclxuICAgICAgLy8gQ2xlYXIgdGltZW91dFxyXG4gICAgICBhd2FpdCB0aGlzLnJlcXVlc3QoJ1BPU1QnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9tZW1iZXJzLyR7dXNlcklkfS90aW1lb3V0L2NsZWFyYCwge1xyXG4gICAgICAgIHJlYXNvblxyXG4gICAgICB9KTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIC8vIFNldCB0aW1lb3V0XHJcbiAgICAgIGNvbnN0IHVudGlsID0gbmV3IERhdGUoRGF0ZS5ub3coKSArIGR1cmF0aW9uKS50b0lTT1N0cmluZygpO1xyXG4gICAgICBhd2FpdCB0aGlzLnJlcXVlc3QoJ1BPU1QnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9tZW1iZXJzLyR7dXNlcklkfS90aW1lb3V0YCwge1xyXG4gICAgICAgIHVudGlsLFxyXG4gICAgICAgIHJlYXNvblxyXG4gICAgICB9KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEtpY2sgYSBtZW1iZXIgZnJvbSB0aGUgZ3VpbGQuXHJcbiAgICogVGhlIG1lbWJlciBjYW4gcmVqb2luIGlmIHRoZXkgaGF2ZSBhbiBpbnZpdGUuXHJcbiAgICogXHJcbiAgICogQHBhcmFtIGd1aWxkSWQgLSBUaGUgSUQgb2YgdGhlIGd1aWxkXHJcbiAgICogQHBhcmFtIHVzZXJJZCAtIFRoZSBJRCBvZiB0aGUgbWVtYmVyIHRvIGtpY2tcclxuICAgKiBAcGFyYW0gcmVhc29uIC0gT3B0aW9uYWwgYXVkaXQgbG9nIHJlYXNvblxyXG4gICAqIEByZXR1cm5zIHZvaWRcclxuICAgKiBAdGhyb3dzIHtSRVNURXJyb3J9IElmIHRoZSBib3QgbGFja3MgS0lDS19NRU1CRVJTIHBlcm1pc3Npb24gb3IgY2Fubm90IGtpY2sgdGhlIHRhcmdldFxyXG4gICAqIFxyXG4gICAqIEBleGFtcGxlXHJcbiAgICogYGBgdHNcclxuICAgKiBhd2FpdCByZXN0LmtpY2tNZW1iZXIoJzEyMzQ1Njc4OScsICc5ODc2NTQzMjEnLCAnUnVsZSB2aW9sYXRpb24nKTtcclxuICAgKiBgYGBcclxuICAgKi9cclxuICBhc3luYyBraWNrTWVtYmVyKGd1aWxkSWQ6IHN0cmluZywgdXNlcklkOiBzdHJpbmcsIHJlYXNvbj86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgcXVlcnkgPSByZWFzb24gPyBgP3JlYXNvbj0ke2VuY29kZVVSSUNvbXBvbmVudChyZWFzb24pfWAgOiAnJztcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdCgnREVMRVRFJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vbWVtYmVycy8ke3VzZXJJZH0ke3F1ZXJ5fWApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQmFuIGEgdXNlciBmcm9tIHRoZSBndWlsZC5cclxuICAgKiBCYW5uZWQgdXNlcnMgY2Fubm90IHJlam9pbiB1bnRpbCB1bmJhbm5lZC5cclxuICAgKiBcclxuICAgKiBAcGFyYW0gZ3VpbGRJZCAtIFRoZSBJRCBvZiB0aGUgZ3VpbGRcclxuICAgKiBAcGFyYW0gdXNlcklkIC0gVGhlIElEIG9mIHRoZSB1c2VyIHRvIGJhblxyXG4gICAqIEBwYXJhbSBvcHRpb25zIC0gQmFuIG9wdGlvbnNcclxuICAgKiBAcGFyYW0gb3B0aW9ucy5kZWxldGVNZXNzYWdlRGF5cyAtIE51bWJlciBvZiBkYXlzIG9mIG1lc3NhZ2VzIHRvIGRlbGV0ZSAoMC03LCBkZXByZWNhdGVkKVxyXG4gICAqIEBwYXJhbSBvcHRpb25zLmRlbGV0ZU1lc3NhZ2VTZWNvbmRzIC0gU2Vjb25kcyBvZiBtZXNzYWdlcyB0byBkZWxldGUgKDAtNjA0ODAwKVxyXG4gICAqIEBwYXJhbSBvcHRpb25zLnJlYXNvbiAtIEF1ZGl0IGxvZyByZWFzb25cclxuICAgKiBAcmV0dXJucyB2b2lkXHJcbiAgICogQHRocm93cyB7UkVTVEVycm9yfSBJZiB0aGUgYm90IGxhY2tzIEJBTl9NRU1CRVJTIHBlcm1pc3Npb24gb3IgY2Fubm90IGJhbiB0aGUgdGFyZ2V0XHJcbiAgICogXHJcbiAgICogQGV4YW1wbGVcclxuICAgKiBgYGB0c1xyXG4gICAqIC8vIEJhbiBhbmQgZGVsZXRlIGxhc3QgMjQgaG91cnMgb2YgbWVzc2FnZXNcclxuICAgKiBhd2FpdCByZXN0LmJhbk1lbWJlcignMTIzJywgJzQ1NicsIHtcclxuICAgKiAgIGRlbGV0ZU1lc3NhZ2VTZWNvbmRzOiA4NjQwMCxcclxuICAgKiAgIHJlYXNvbjogJ0hhcmFzc21lbnQnXHJcbiAgICogfSk7XHJcbiAgICogYGBgXHJcbiAgICovXHJcbiAgYXN5bmMgYmFuTWVtYmVyKGd1aWxkSWQ6IHN0cmluZywgdXNlcklkOiBzdHJpbmcsIG9wdGlvbnM/OiB7XHJcbiAgICBkZWxldGVNZXNzYWdlRGF5cz86IG51bWJlcjtcclxuICAgIGRlbGV0ZU1lc3NhZ2VTZWNvbmRzPzogbnVtYmVyO1xyXG4gICAgcmVhc29uPzogc3RyaW5nO1xyXG4gIH0pOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdCgnUFVUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vYmFucy8ke3VzZXJJZH1gLCB7XHJcbiAgICAgIGRlbGV0ZV9tZXNzYWdlX2RheXM6IG9wdGlvbnM/LmRlbGV0ZU1lc3NhZ2VEYXlzLFxyXG4gICAgICBkZWxldGVfbWVzc2FnZV9zZWNvbmRzOiBvcHRpb25zPy5kZWxldGVNZXNzYWdlU2Vjb25kcyxcclxuICAgICAgcmVhc29uOiBvcHRpb25zPy5yZWFzb25cclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVtb3ZlIGEgYmFuIGZyb20gYSB1c2VyLCBhbGxvd2luZyB0aGVtIHRvIHJlam9pbi5cclxuICAgKiBcclxuICAgKiBAcGFyYW0gZ3VpbGRJZCAtIFRoZSBJRCBvZiB0aGUgZ3VpbGRcclxuICAgKiBAcGFyYW0gdXNlcklkIC0gVGhlIElEIG9mIHRoZSB1c2VyIHRvIHVuYmFuXHJcbiAgICogQHBhcmFtIHJlYXNvbiAtIE9wdGlvbmFsIGF1ZGl0IGxvZyByZWFzb25cclxuICAgKiBAcmV0dXJucyB2b2lkXHJcbiAgICogQHRocm93cyB7UkVTVEVycm9yfSBJZiB0aGUgYm90IGxhY2tzIEJBTl9NRU1CRVJTIHBlcm1pc3Npb24gb3IgdXNlciBpcyBub3QgYmFubmVkXHJcbiAgICogXHJcbiAgICogQGV4YW1wbGVcclxuICAgKiBgYGB0c1xyXG4gICAqIGF3YWl0IHJlc3QudW5iYW5NZW1iZXIoJzEyMzQ1Njc4OScsICc5ODc2NTQzMjEnLCAnQmFuIGFwcGVhbCBhY2NlcHRlZCcpO1xyXG4gICAqIGBgYFxyXG4gICAqL1xyXG4gIGFzeW5jIHVuYmFuTWVtYmVyKGd1aWxkSWQ6IHN0cmluZywgdXNlcklkOiBzdHJpbmcsIHJlYXNvbj86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgcXVlcnkgPSByZWFzb24gPyBgP3JlYXNvbj0ke2VuY29kZVVSSUNvbXBvbmVudChyZWFzb24pfWAgOiAnJztcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdCgnREVMRVRFJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vYmFucy8ke3VzZXJJZH0ke3F1ZXJ5fWApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRWRpdCBhIGd1aWxkIG1lbWJlcidzIGF0dHJpYnV0ZXMgKG5pY2tuYW1lLCByb2xlcywgdm9pY2Ugc3RhdGUsIGV0Yy4pLlxyXG4gICAqIFxyXG4gICAqIEBwYXJhbSBndWlsZElkIC0gVGhlIElEIG9mIHRoZSBndWlsZFxyXG4gICAqIEBwYXJhbSB1c2VySWQgLSBUaGUgSUQgb2YgdGhlIG1lbWJlciB0byBlZGl0XHJcbiAgICogQHBhcmFtIGRhdGEgLSBUaGUgbWVtYmVyIGF0dHJpYnV0ZXMgdG8gbW9kaWZ5XHJcbiAgICogQHBhcmFtIGRhdGEubmljayAtIE5ldyBuaWNrbmFtZSAobnVsbCB0byByZXNldClcclxuICAgKiBAcGFyYW0gZGF0YS5yb2xlcyAtIEFycmF5IG9mIHJvbGUgSURzIHRvIHNldCAocmVwbGFjZXMgYWxsIHJvbGVzKVxyXG4gICAqIEBwYXJhbSBkYXRhLm11dGUgLSBXaGV0aGVyIHRvIHNlcnZlci1tdXRlIHRoZSBtZW1iZXIgaW4gdm9pY2VcclxuICAgKiBAcGFyYW0gZGF0YS5kZWFmIC0gV2hldGhlciB0byBzZXJ2ZXItZGVhZmVuIHRoZSBtZW1iZXIgaW4gdm9pY2VcclxuICAgKiBAcGFyYW0gZGF0YS5jaGFubmVsX2lkIC0gVm9pY2UgY2hhbm5lbCB0byBtb3ZlIG1lbWJlciB0byAobnVsbCB0byBkaXNjb25uZWN0KVxyXG4gICAqIEBwYXJhbSBkYXRhLmNvbW11bmljYXRpb25fZGlzYWJsZWRfdW50aWwgLSBJU084NjAxIHRpbWVzdGFtcCBmb3IgdGltZW91dCBlbmRcclxuICAgKiBAcGFyYW0gZGF0YS5yZWFzb24gLSBBdWRpdCBsb2cgcmVhc29uXHJcbiAgICogQHJldHVybnMgVGhlIHVwZGF0ZWQgbWVtYmVyIGRhdGFcclxuICAgKiBAdGhyb3dzIHtSRVNURXJyb3J9IElmIHRoZSBib3QgbGFja3MgcmVxdWlyZWQgcGVybWlzc2lvbnNcclxuICAgKiBcclxuICAgKiBAZXhhbXBsZVxyXG4gICAqIGBgYHRzXHJcbiAgICogLy8gQ2hhbmdlIG5pY2tuYW1lIGFuZCBhZGQgYSByb2xlXHJcbiAgICogY29uc3QgdXBkYXRlZCA9IGF3YWl0IHJlc3QuZWRpdE1lbWJlcignMTIzJywgJzQ1NicsIHtcclxuICAgKiAgIG5pY2s6ICdOZXcgTmlja25hbWUnLFxyXG4gICAqICAgcm9sZXM6IFsncm9sZTEnLCAncm9sZTInLCAnbmV3Um9sZSddLFxyXG4gICAqICAgcmVhc29uOiAnTmlja25hbWUgdXBkYXRlIHJlcXVlc3QnXHJcbiAgICogfSk7XHJcbiAgICogYGBgXHJcbiAgICovXHJcbiAgYXN5bmMgZWRpdE1lbWJlcihndWlsZElkOiBzdHJpbmcsIHVzZXJJZDogc3RyaW5nLCBkYXRhOiB7XHJcbiAgICBuaWNrPzogc3RyaW5nIHwgbnVsbDtcclxuICAgIHJvbGVzPzogc3RyaW5nW107XHJcbiAgICBtdXRlPzogYm9vbGVhbjtcclxuICAgIGRlYWY/OiBib29sZWFuO1xyXG4gICAgY2hhbm5lbF9pZD86IHN0cmluZyB8IG51bGw7XHJcbiAgICBjb21tdW5pY2F0aW9uX2Rpc2FibGVkX3VudGlsPzogc3RyaW5nIHwgbnVsbDtcclxuICAgIHJlYXNvbj86IHN0cmluZztcclxuICB9KTogUHJvbWlzZTxBUElNZW1iZXJEYXRhPiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PEFQSU1lbWJlckRhdGE+KCdQQVRDSCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L21lbWJlcnMvJHt1c2VySWR9YCwgZGF0YSk7XHJcbiAgfVxyXG5cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PSBHdWlsZHMgPT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGd1aWxkIGluZm8gd2l0aCBmcmVzaCBkYXRhIChub3QgY2FjaGVkKS5cclxuICAgKiBSZXR1cm5zIG1lbWJlcl9jb3VudCBhbmQgb25saW5lX2NvdW50IGZyb20gbGl2ZSBSZWRpcyBkYXRhLlxyXG4gICAqIFxyXG4gICAqIEBwYXJhbSBndWlsZElkIC0gVGhlIElEIG9mIHRoZSBndWlsZCB0byBmZXRjaFxyXG4gICAqIEByZXR1cm5zIEZ1bGwgZ3VpbGQgZGF0YSBpbmNsdWRpbmcgY2hhbm5lbHMsIHJvbGVzLCBhbmQgbWVtYmVyIGNvdW50c1xyXG4gICAqIEB0aHJvd3Mge1JFU1RFcnJvcn0gSWYgdGhlIGd1aWxkIGlzIG5vdCBmb3VuZCBvciBib3QgaXMgbm90IGEgbWVtYmVyXHJcbiAgICogXHJcbiAgICogQGV4YW1wbGVcclxuICAgKiBgYGB0c1xyXG4gICAqIGNvbnN0IGd1aWxkID0gYXdhaXQgcmVzdC5nZXRHdWlsZCgnMTIzNDU2Nzg5Jyk7XHJcbiAgICogY29uc29sZS5sb2coYCR7Z3VpbGQubmFtZX0gaGFzICR7Z3VpbGQubWVtYmVyX2NvdW50fSBtZW1iZXJzYCk7XHJcbiAgICogYGBgXHJcbiAgICovXHJcbiAgYXN5bmMgZ2V0R3VpbGQoZ3VpbGRJZDogc3RyaW5nKTogUHJvbWlzZTxBUElHdWlsZERhdGE+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QVBJR3VpbGREYXRhPignR0VUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEFkZCBhIHJvbGUgdG8gYSBndWlsZCBtZW1iZXIuXHJcbiAgICogXHJcbiAgICogQHBhcmFtIGd1aWxkSWQgLSBUaGUgSUQgb2YgdGhlIGd1aWxkXHJcbiAgICogQHBhcmFtIHVzZXJJZCAtIFRoZSBJRCBvZiB0aGUgbWVtYmVyXHJcbiAgICogQHBhcmFtIHJvbGVJZCAtIFRoZSBJRCBvZiB0aGUgcm9sZSB0byBhZGRcclxuICAgKiBAcGFyYW0gcmVhc29uIC0gT3B0aW9uYWwgYXVkaXQgbG9nIHJlYXNvblxyXG4gICAqIEByZXR1cm5zIHZvaWRcclxuICAgKiBAdGhyb3dzIHtSRVNURXJyb3J9IElmIHRoZSBib3QgbGFja3MgTUFOQUdFX1JPTEVTIHBlcm1pc3Npb24gb3Igcm9sZSBpcyBoaWdoZXIgdGhhbiBib3QncyBoaWdoZXN0IHJvbGVcclxuICAgKiBcclxuICAgKiBAZXhhbXBsZVxyXG4gICAqIGBgYHRzXHJcbiAgICogYXdhaXQgcmVzdC5hZGRNZW1iZXJSb2xlKCcxMjMnLCAnNDU2JywgJzc4OScsICdWZXJpZmllZCB1c2VyJyk7XHJcbiAgICogYGBgXHJcbiAgICovXHJcbiAgYXN5bmMgYWRkTWVtYmVyUm9sZShndWlsZElkOiBzdHJpbmcsIHVzZXJJZDogc3RyaW5nLCByb2xlSWQ6IHN0cmluZywgcmVhc29uPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBxdWVyeSA9IHJlYXNvbiA/IGA/cmVhc29uPSR7ZW5jb2RlVVJJQ29tcG9uZW50KHJlYXNvbil9YCA6ICcnO1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0KCdQVVQnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9tZW1iZXJzLyR7dXNlcklkfS9yb2xlcy8ke3JvbGVJZH0ke3F1ZXJ5fWApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVtb3ZlIGEgcm9sZSBmcm9tIGEgZ3VpbGQgbWVtYmVyLlxyXG4gICAqIFxyXG4gICAqIEBwYXJhbSBndWlsZElkIC0gVGhlIElEIG9mIHRoZSBndWlsZFxyXG4gICAqIEBwYXJhbSB1c2VySWQgLSBUaGUgSUQgb2YgdGhlIG1lbWJlclxyXG4gICAqIEBwYXJhbSByb2xlSWQgLSBUaGUgSUQgb2YgdGhlIHJvbGUgdG8gcmVtb3ZlXHJcbiAgICogQHBhcmFtIHJlYXNvbiAtIE9wdGlvbmFsIGF1ZGl0IGxvZyByZWFzb25cclxuICAgKiBAcmV0dXJucyB2b2lkXHJcbiAgICogQHRocm93cyB7UkVTVEVycm9yfSBJZiB0aGUgYm90IGxhY2tzIE1BTkFHRV9ST0xFUyBwZXJtaXNzaW9uIG9yIHJvbGUgaXMgaGlnaGVyIHRoYW4gYm90J3MgaGlnaGVzdCByb2xlXHJcbiAgICogXHJcbiAgICogQGV4YW1wbGVcclxuICAgKiBgYGB0c1xyXG4gICAqIGF3YWl0IHJlc3QucmVtb3ZlTWVtYmVyUm9sZSgnMTIzJywgJzQ1NicsICc3ODknLCAnUm9sZSBleHBpcmVkJyk7XHJcbiAgICogYGBgXHJcbiAgICovXHJcbiAgYXN5bmMgcmVtb3ZlTWVtYmVyUm9sZShndWlsZElkOiBzdHJpbmcsIHVzZXJJZDogc3RyaW5nLCByb2xlSWQ6IHN0cmluZywgcmVhc29uPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBxdWVyeSA9IHJlYXNvbiA/IGA/cmVhc29uPSR7ZW5jb2RlVVJJQ29tcG9uZW50KHJlYXNvbil9YCA6ICcnO1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0KCdERUxFVEUnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9tZW1iZXJzLyR7dXNlcklkfS9yb2xlcy8ke3JvbGVJZH0ke3F1ZXJ5fWApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQnVsayBhc3NpZ24gcm9sZXMgdG8gbXVsdGlwbGUgbWVtYmVycyBpbiBhIHNpbmdsZSByZXF1ZXN0LlxyXG4gICAqIE1vcmUgZWZmaWNpZW50IHRoYW4gaW5kaXZpZHVhbCBhZGRNZW1iZXJSb2xlIGNhbGxzLlxyXG4gICAqIFxyXG4gICAqIEBwYXJhbSBndWlsZElkIC0gVGhlIElEIG9mIHRoZSBndWlsZFxyXG4gICAqIEBwYXJhbSBhc3NpZ25tZW50cyAtIEFycmF5IG9mIHVzZXIvcm9sZXMgYXNzaWdubWVudHNcclxuICAgKiBAcmV0dXJucyBBUEkgcmVzcG9uc2Ugd2l0aCBhc3NpZ25tZW50IHJlc3VsdHNcclxuICAgKiBAdGhyb3dzIHtSRVNURXJyb3J9IElmIHRoZSBib3QgbGFja3MgTUFOQUdFX1JPTEVTIHBlcm1pc3Npb25cclxuICAgKiBcclxuICAgKiBAZXhhbXBsZVxyXG4gICAqIGBgYHRzXHJcbiAgICogYXdhaXQgcmVzdC5idWxrQXNzaWduUm9sZXMoJzEyMzQ1Njc4OScsIFtcclxuICAgKiAgIHsgdXNlcl9pZDogJzExMScsIHJvbGVfaWRzOiBbJ3JvbGUxJywgJ3JvbGUyJ10gfSxcclxuICAgKiAgIHsgdXNlcl9pZDogJzIyMicsIHJvbGVfaWRzOiBbJ3JvbGUxJ10gfVxyXG4gICAqIF0pO1xyXG4gICAqIGBgYFxyXG4gICAqL1xyXG4gIGFzeW5jIGJ1bGtBc3NpZ25Sb2xlcyhndWlsZElkOiBzdHJpbmcsIGFzc2lnbm1lbnRzOiB7IHVzZXJfaWQ6IHN0cmluZzsgcm9sZV9pZHM6IHN0cmluZ1tdIH1bXSk6IFByb21pc2U8YW55PiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KCdQVVQnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9tZW1iZXJzL3JvbGVzL2Fzc2lnbmAsIHsgYXNzaWdubWVudHMgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBCdWxrIHJlbW92ZSByb2xlcyBmcm9tIG11bHRpcGxlIG1lbWJlcnMgaW4gYSBzaW5nbGUgcmVxdWVzdC5cclxuICAgKiBNb3JlIGVmZmljaWVudCB0aGFuIGluZGl2aWR1YWwgcmVtb3ZlTWVtYmVyUm9sZSBjYWxscy5cclxuICAgKiBcclxuICAgKiBAcGFyYW0gZ3VpbGRJZCAtIFRoZSBJRCBvZiB0aGUgZ3VpbGRcclxuICAgKiBAcGFyYW0gcmVtb3ZhbHMgLSBBcnJheSBvZiB1c2VyL3JvbGVzIHRvIHJlbW92ZVxyXG4gICAqIEByZXR1cm5zIEFQSSByZXNwb25zZSB3aXRoIHJlbW92YWwgcmVzdWx0c1xyXG4gICAqIEB0aHJvd3Mge1JFU1RFcnJvcn0gSWYgdGhlIGJvdCBsYWNrcyBNQU5BR0VfUk9MRVMgcGVybWlzc2lvblxyXG4gICAqIFxyXG4gICAqIEBleGFtcGxlXHJcbiAgICogYGBgdHNcclxuICAgKiBhd2FpdCByZXN0LmJ1bGtSZW1vdmVSb2xlcygnMTIzNDU2Nzg5JywgW1xyXG4gICAqICAgeyB1c2VyX2lkOiAnMTExJywgcm9sZV9pZHM6IFsnZXhwaXJlZFJvbGUnXSB9LFxyXG4gICAqICAgeyB1c2VyX2lkOiAnMjIyJywgcm9sZV9pZHM6IFsnZXhwaXJlZFJvbGUnXSB9XHJcbiAgICogXSk7XHJcbiAgICogYGBgXHJcbiAgICovXHJcbiAgYXN5bmMgYnVsa1JlbW92ZVJvbGVzKGd1aWxkSWQ6IHN0cmluZywgcmVtb3ZhbHM6IHsgdXNlcl9pZDogc3RyaW5nOyByb2xlX2lkczogc3RyaW5nW10gfVtdKTogUHJvbWlzZTxhbnk+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoJ0RFTEVURScsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L21lbWJlcnMvcm9sZXMvcmVtb3ZlYCwgeyByZW1vdmFscyB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEJ1bGsgZGVsZXRlIG11bHRpcGxlIG1lc3NhZ2VzIGZyb20gYSBjaGFubmVsLlxyXG4gICAqIE1vcmUgZWZmaWNpZW50IHRoYW4gaW5kaXZpZHVhbCBkZWxldGVNZXNzYWdlIGNhbGxzLlxyXG4gICAqIE1lc3NhZ2VzIG9sZGVyIHRoYW4gMTQgZGF5cyBjYW5ub3QgYmUgYnVsayBkZWxldGVkLlxyXG4gICAqIFxyXG4gICAqIEBwYXJhbSBndWlsZElkIC0gVGhlIElEIG9mIHRoZSBndWlsZFxyXG4gICAqIEBwYXJhbSBjaGFubmVsSWQgLSBUaGUgSUQgb2YgdGhlIGNoYW5uZWxcclxuICAgKiBAcGFyYW0gbWVzc2FnZUlkcyAtIEFycmF5IG9mIG1lc3NhZ2UgSURzIHRvIGRlbGV0ZSAoMi0xMDAgbWVzc2FnZXMpXHJcbiAgICogQHJldHVybnMgdm9pZFxyXG4gICAqIEB0aHJvd3Mge1JFU1RFcnJvcn0gSWYgdGhlIGJvdCBsYWNrcyBNQU5BR0VfTUVTU0FHRVMgcGVybWlzc2lvblxyXG4gICAqIFxyXG4gICAqIEBleGFtcGxlXHJcbiAgICogYGBgdHNcclxuICAgKiBhd2FpdCByZXN0LmJ1bGtEZWxldGVNZXNzYWdlcygnMTIzJywgJzQ1NicsIFsnbXNnMScsICdtc2cyJywgJ21zZzMnXSk7XHJcbiAgICogYGBgXHJcbiAgICovXHJcbiAgYXN5bmMgYnVsa0RlbGV0ZU1lc3NhZ2VzKGd1aWxkSWQ6IHN0cmluZywgY2hhbm5lbElkOiBzdHJpbmcsIG1lc3NhZ2VJZHM6IHN0cmluZ1tdKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3QoJ1BPU1QnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH0vbWVzc2FnZXMvYnVsay1kZWxldGVgLCB7XHJcbiAgICAgIG1lc3NhZ2VzOiBtZXNzYWdlSWRzXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8vID09PT09PT09PT09PT09PT09PT09IEd1aWxkcyA9PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSBndWlsZFxyXG4gICAqL1xyXG4gIGFzeW5jIGdldEd1aWxkQ2hhbm5lbHMoZ3VpbGRJZDogc3RyaW5nKTogUHJvbWlzZTxBUElDaGFubmVsW10+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QVBJQ2hhbm5lbFtdPignR0VUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vY2hhbm5lbHNgKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBndWlsZCByb2xlc1xyXG4gICAqL1xyXG4gIGFzeW5jIGdldFJvbGVzKGd1aWxkSWQ6IHN0cmluZyk6IFByb21pc2U8QVBJUm9sZURhdGFbXT4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBUElSb2xlRGF0YVtdPignR0VUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vcm9sZXNgKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIHJvbGVcclxuICAgKi9cclxuICBhc3luYyBjcmVhdGVSb2xlKGd1aWxkSWQ6IHN0cmluZywgZGF0YToge1xyXG4gICAgbmFtZT86IHN0cmluZztcclxuICAgIGNvbG9yPzogbnVtYmVyO1xyXG4gICAgaG9pc3Q/OiBib29sZWFuO1xyXG4gICAgbWVudGlvbmFibGU/OiBib29sZWFuO1xyXG4gICAgcGVybWlzc2lvbnM/OiBzdHJpbmc7XHJcbiAgfSk6IFByb21pc2U8QVBJUm9sZURhdGE+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QVBJUm9sZURhdGE+KCdQT1NUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vcm9sZXNgLCBkYXRhKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEVkaXQgYSByb2xlXHJcbiAgICovXHJcbiAgYXN5bmMgZWRpdFJvbGUoZ3VpbGRJZDogc3RyaW5nLCByb2xlSWQ6IHN0cmluZywgZGF0YToge1xyXG4gICAgbmFtZT86IHN0cmluZztcclxuICAgIGNvbG9yPzogbnVtYmVyO1xyXG4gICAgaG9pc3Q/OiBib29sZWFuO1xyXG4gICAgbWVudGlvbmFibGU/OiBib29sZWFuO1xyXG4gICAgcGVybWlzc2lvbnM/OiBzdHJpbmc7XHJcbiAgfSk6IFByb21pc2U8QVBJUm9sZURhdGE+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QVBJUm9sZURhdGE+KCdQQVRDSCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L3JvbGVzLyR7cm9sZUlkfWAsIGRhdGEpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVsZXRlIGEgcm9sZVxyXG4gICAqL1xyXG4gIGFzeW5jIGRlbGV0ZVJvbGUoZ3VpbGRJZDogc3RyaW5nLCByb2xlSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0KCdERUxFVEUnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9yb2xlcy8ke3JvbGVJZH1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBndWlsZCBlbW9qaXNcclxuICAgKiBcclxuICAgKiBAcGFyYW0gZ3VpbGRJZCAtIFRoZSBJRCBvZiB0aGUgZ3VpbGRcclxuICAgKiBAcmV0dXJucyBBcnJheSBvZiBlbW9qaSBvYmplY3RzXHJcbiAgICovXHJcbiAgYXN5bmMgZ2V0RW1vamlzKGd1aWxkSWQ6IHN0cmluZyk6IFByb21pc2U8QVBJRW1vamlbXT4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBUElFbW9qaVtdPignR0VUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vZW1vamlzYCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYWxsIGJhbnMgZm9yIGEgZ3VpbGQuXHJcbiAgICogXHJcbiAgICogQHBhcmFtIGd1aWxkSWQgLSBUaGUgSUQgb2YgdGhlIGd1aWxkXHJcbiAgICogQHJldHVybnMgQXJyYXkgb2YgYmFuIG9iamVjdHMgY29udGFpbmluZyB1c2VyIGluZm8gYW5kIGJhbiByZWFzb25cclxuICAgKiBAdGhyb3dzIHtSRVNURXJyb3J9IElmIHRoZSBib3QgbGFja3MgQkFOX01FTUJFUlMgcGVybWlzc2lvblxyXG4gICAqIFxyXG4gICAqIEBleGFtcGxlXHJcbiAgICogYGBgdHNcclxuICAgKiBjb25zdCBiYW5zID0gYXdhaXQgcmVzdC5nZXRCYW5zKCcxMjM0NTY3ODknKTtcclxuICAgKiBmb3IgKGNvbnN0IGJhbiBvZiBiYW5zKSB7XHJcbiAgICogICBjb25zb2xlLmxvZyhgJHtiYW4udXNlci51c2VybmFtZX0gYmFubmVkIGZvcjogJHtiYW4ucmVhc29uIHx8ICdObyByZWFzb24nfWApO1xyXG4gICAqIH1cclxuICAgKiBgYGBcclxuICAgKi9cclxuICBhc3luYyBnZXRCYW5zKGd1aWxkSWQ6IHN0cmluZyk6IFByb21pc2U8QVBJQmFuW10+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QVBJQmFuW10+KCdHRVQnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9iYW5zYCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSBzcGVjaWZpYyBiYW4gYnkgdXNlciBJRC5cclxuICAgKiBcclxuICAgKiBAcGFyYW0gZ3VpbGRJZCAtIFRoZSBJRCBvZiB0aGUgZ3VpbGRcclxuICAgKiBAcGFyYW0gdXNlcklkIC0gVGhlIElEIG9mIHRoZSBiYW5uZWQgdXNlclxyXG4gICAqIEByZXR1cm5zIFRoZSBiYW4gb2JqZWN0IGlmIGZvdW5kXHJcbiAgICogQHRocm93cyB7UkVTVEVycm9yfSA0MDQgaWYgdGhlIHVzZXIgaXMgbm90IGJhbm5lZFxyXG4gICAqIFxyXG4gICAqIEBleGFtcGxlXHJcbiAgICogYGBgdHNcclxuICAgKiB0cnkge1xyXG4gICAqICAgY29uc3QgYmFuID0gYXdhaXQgcmVzdC5nZXRCYW4oJzEyMzQ1Njc4OScsICc5ODc2NTQzMjEnKTtcclxuICAgKiAgIGNvbnNvbGUubG9nKGBCYW5uZWQgZm9yOiAke2Jhbi5yZWFzb259YCk7XHJcbiAgICogfSBjYXRjaCAoZSkge1xyXG4gICAqICAgY29uc29sZS5sb2coJ1VzZXIgaXMgbm90IGJhbm5lZCcpO1xyXG4gICAqIH1cclxuICAgKiBgYGBcclxuICAgKi9cclxuICBhc3luYyBnZXRCYW4oZ3VpbGRJZDogc3RyaW5nLCB1c2VySWQ6IHN0cmluZyk6IFByb21pc2U8QVBJQmFuPiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PEFQSUJhbj4oJ0dFVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2JhbnMvJHt1c2VySWR9YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgZ3VpbGQgaW52aXRlc1xyXG4gICAqIFxyXG4gICAqIEBwYXJhbSBndWlsZElkIC0gVGhlIElEIG9mIHRoZSBndWlsZFxyXG4gICAqIEByZXR1cm5zIEFycmF5IG9mIGludml0ZSBvYmplY3RzXHJcbiAgICovXHJcbiAgYXN5bmMgZ2V0R3VpbGRJbnZpdGVzKGd1aWxkSWQ6IHN0cmluZyk6IFByb21pc2U8QVBJSW52aXRlW10+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QVBJSW52aXRlW10+KCdHRVQnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9pbnZpdGVzYCk7XHJcbiAgfVxyXG5cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PSBQaW5zID09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIC8qKlxyXG4gICAqIFBpbiBhIG1lc3NhZ2VcclxuICAgKi9cclxuICBhc3luYyBwaW5NZXNzYWdlKGd1aWxkSWQ6IHN0cmluZywgY2hhbm5lbElkOiBzdHJpbmcsIG1lc3NhZ2VJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3QoJ1BVVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS9waW5zLyR7bWVzc2FnZUlkfWApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVW5waW4gYSBtZXNzYWdlXHJcbiAgICovXHJcbiAgYXN5bmMgdW5waW5NZXNzYWdlKGd1aWxkSWQ6IHN0cmluZywgY2hhbm5lbElkOiBzdHJpbmcsIG1lc3NhZ2VJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3QoJ0RFTEVURScsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS9waW5zLyR7bWVzc2FnZUlkfWApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IHBpbm5lZCBtZXNzYWdlc1xyXG4gICAqL1xyXG4gIGFzeW5jIGdldFBpbm5lZE1lc3NhZ2VzKGd1aWxkSWQ6IHN0cmluZywgY2hhbm5lbElkOiBzdHJpbmcpOiBQcm9taXNlPEFQSU1lc3NhZ2VbXT4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCgnR0VUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vY2hhbm5lbHMvJHtjaGFubmVsSWR9L3BpbnNgKTtcclxuICB9XHJcblxyXG4gIC8vID09PT09PT09PT09PT09PT09PT09IEF1ZGl0IExvZyA9PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgdGhlIGF1ZGl0IGxvZyBmb3IgYSBndWlsZC5cclxuICAgKiBSZXF1aXJlcyBWSUVXX0FVRElUX0xPRyBwZXJtaXNzaW9uLlxyXG4gICAqIFxyXG4gICAqIEBwYXJhbSBndWlsZElkIC0gVGhlIElEIG9mIHRoZSBndWlsZFxyXG4gICAqIEBwYXJhbSBvcHRpb25zIC0gUXVlcnkgb3B0aW9uc1xyXG4gICAqIEByZXR1cm5zIEF1ZGl0IGxvZyBlbnRyaWVzXHJcbiAgICogQHRocm93cyB7UkVTVEVycm9yfSBJZiB0aGUgYm90IGxhY2tzIFZJRVdfQVVESVRfTE9HIHBlcm1pc3Npb25cclxuICAgKiBcclxuICAgKiBAZXhhbXBsZVxyXG4gICAqIGBgYHRzXHJcbiAgICogY29uc3QgbG9ncyA9IGF3YWl0IHJlc3QuZ2V0QXVkaXRMb2coJzEyMycsIHsgbGltaXQ6IDUwIH0pO1xyXG4gICAqIGBgYFxyXG4gICAqL1xyXG4gIGFzeW5jIGdldEF1ZGl0TG9nKGd1aWxkSWQ6IHN0cmluZywgb3B0aW9ucz86IHtcclxuICAgIHVzZXJfaWQ/OiBzdHJpbmc7XHJcbiAgICBhY3Rpb25fdHlwZT86IG51bWJlcjtcclxuICAgIGJlZm9yZT86IHN0cmluZztcclxuICAgIGxpbWl0PzogbnVtYmVyO1xyXG4gIH0pOiBQcm9taXNlPEFQSUF1ZGl0TG9nPiB7XHJcbiAgICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKCk7XHJcbiAgICBpZiAob3B0aW9ucz8udXNlcl9pZCkgcGFyYW1zLmFwcGVuZCgndXNlcl9pZCcsIG9wdGlvbnMudXNlcl9pZCk7XHJcbiAgICBpZiAob3B0aW9ucz8uYWN0aW9uX3R5cGUgIT09IHVuZGVmaW5lZCkgcGFyYW1zLmFwcGVuZCgnYWN0aW9uX3R5cGUnLCBTdHJpbmcob3B0aW9ucy5hY3Rpb25fdHlwZSkpO1xyXG4gICAgaWYgKG9wdGlvbnM/LmJlZm9yZSkgcGFyYW1zLmFwcGVuZCgnYmVmb3JlJywgb3B0aW9ucy5iZWZvcmUpO1xyXG4gICAgaWYgKG9wdGlvbnM/LmxpbWl0ICE9PSB1bmRlZmluZWQpIHBhcmFtcy5hcHBlbmQoJ2xpbWl0JywgU3RyaW5nKG9wdGlvbnMubGltaXQpKTtcclxuICAgIFxyXG4gICAgY29uc3QgcXVlcnkgPSBwYXJhbXMudG9TdHJpbmcoKTtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QVBJQXVkaXRMb2c+KCdHRVQnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9hdWRpdC1sb2dzJHtxdWVyeSA/IGA/JHtxdWVyeX1gIDogJyd9YCk7XHJcbiAgfVxyXG5cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PSBVc2VycyA9PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSB1c2VyXHJcbiAgICovXHJcbiAgYXN5bmMgZ2V0VXNlcih1c2VySWQ6IHN0cmluZyk6IFByb21pc2U8QVBJVXNlcj4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBUElVc2VyPignR0VUJywgYC9ib3QvdXNlcnMvJHt1c2VySWR9YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgY3VycmVudCBib3QgdXNlclxyXG4gICAqL1xyXG4gIGFzeW5jIGdldEN1cnJlbnRVc2VyKCk6IFByb21pc2U8QVBJVXNlcj4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBUElVc2VyPignR0VUJywgYC9ib3QvdXNlcnMvQG1lYCk7XHJcbiAgfVxyXG5cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PSBJbnZpdGVzID09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhbiBpbnZpdGVcclxuICAgKi9cclxuICBhc3luYyBjcmVhdGVJbnZpdGUoZ3VpbGRJZDogc3RyaW5nLCBjaGFubmVsSWQ6IHN0cmluZywgZGF0YT86IHtcclxuICAgIG1heF9hZ2U/OiBudW1iZXI7XHJcbiAgICBtYXhfdXNlcz86IG51bWJlcjtcclxuICAgIHRlbXBvcmFyeT86IGJvb2xlYW47XHJcbiAgICB1bmlxdWU/OiBib29sZWFuO1xyXG4gIH0pOiBQcm9taXNlPEFQSUludml0ZT4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBUElJbnZpdGU+KCdQT1NUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vY2hhbm5lbHMvJHtjaGFubmVsSWR9L2ludml0ZXNgLCBkYXRhIHx8IHt9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlbGV0ZSBhbiBpbnZpdGVcclxuICAgKi9cclxuICBhc3luYyBkZWxldGVJbnZpdGUoaW52aXRlQ29kZTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3Q8dm9pZD4oJ0RFTEVURScsIGAvYm90L2ludml0ZXMvJHtpbnZpdGVDb2RlfWApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGFuIGludml0ZVxyXG4gICAqL1xyXG4gIGFzeW5jIGdldEludml0ZShpbnZpdGVDb2RlOiBzdHJpbmcpOiBQcm9taXNlPEFQSUludml0ZT4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBUElJbnZpdGU+KCdHRVQnLCBgL2JvdC9pbnZpdGVzLyR7aW52aXRlQ29kZX1gKTtcclxuICB9XHJcblxyXG4gIC8vID09PT09PT09PT09PT09PT09PT09IFdlYmhvb2tzID09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBjaGFubmVsIHdlYmhvb2tzXHJcbiAgICovXHJcbiAgYXN5bmMgZ2V0Q2hhbm5lbFdlYmhvb2tzKGd1aWxkSWQ6IHN0cmluZywgY2hhbm5lbElkOiBzdHJpbmcpOiBQcm9taXNlPEFQSVdlYmhvb2tbXT4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBUElXZWJob29rW10+KCdHRVQnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH0vd2ViaG9va3NgKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBndWlsZCB3ZWJob29rc1xyXG4gICAqL1xyXG4gIGFzeW5jIGdldEd1aWxkV2ViaG9va3MoZ3VpbGRJZDogc3RyaW5nKTogUHJvbWlzZTxBUElXZWJob29rW10+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QVBJV2ViaG9va1tdPignR0VUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vd2ViaG9va3NgKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIHdlYmhvb2tcclxuICAgKi9cclxuICBhc3luYyBjcmVhdGVXZWJob29rKGd1aWxkSWQ6IHN0cmluZywgY2hhbm5lbElkOiBzdHJpbmcsIGRhdGE6IHtcclxuICAgIG5hbWU6IHN0cmluZztcclxuICAgIGF2YXRhcj86IHN0cmluZztcclxuICB9KTogUHJvbWlzZTxBUElXZWJob29rPiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PEFQSVdlYmhvb2s+KCdQT1NUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vY2hhbm5lbHMvJHtjaGFubmVsSWR9L3dlYmhvb2tzYCwgZGF0YSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBVcGRhdGUgYSB3ZWJob29rXHJcbiAgICovXHJcbiAgYXN5bmMgdXBkYXRlV2ViaG9vayhndWlsZElkOiBzdHJpbmcsIHdlYmhvb2tJZDogc3RyaW5nLCBkYXRhOiB7XHJcbiAgICBuYW1lPzogc3RyaW5nO1xyXG4gICAgYXZhdGFyX3VybD86IHN0cmluZztcclxuICB9KTogUHJvbWlzZTxBUElXZWJob29rPiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PEFQSVdlYmhvb2s+KCdQQVRDSCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L3dlYmhvb2tzLyR7d2ViaG9va0lkfWAsIGRhdGEpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVsZXRlIGEgd2ViaG9va1xyXG4gICAqL1xyXG4gIGFzeW5jIGRlbGV0ZVdlYmhvb2soZ3VpbGRJZDogc3RyaW5nLCB3ZWJob29rSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDx2b2lkPignREVMRVRFJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vd2ViaG9va3MvJHt3ZWJob29rSWR9YCk7XHJcbiAgfVxyXG5cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PSBHZW5lcmljIEhUVFAgTWV0aG9kcyA9PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAvKipcclxuICAgKiBNYWtlIGEgR0VUIHJlcXVlc3QgdG8gYW55IEFQSSBwYXRoXHJcbiAgICogQGV4YW1wbGUgYXdhaXQgY2xpZW50LnJlc3QuZ2V0KCcvYm90L2d1aWxkcy8xMjMvY2hhbm5lbHMnKTtcclxuICAgKi9cclxuICBhc3luYyBnZXQ8VCA9IGFueT4ocGF0aDogc3RyaW5nKTogUHJvbWlzZTxUPiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PFQ+KCdHRVQnLCBwYXRoKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIE1ha2UgYSBQT1NUIHJlcXVlc3QgdG8gYW55IEFQSSBwYXRoXHJcbiAgICogQGV4YW1wbGUgYXdhaXQgY2xpZW50LnJlc3QucG9zdCgnL2JvdC9ndWlsZHMvMTIzL2NoYW5uZWxzJywgeyBuYW1lOiAnbmV3LWNoYW5uZWwnLCB0eXBlOiAyIH0pO1xyXG4gICAqL1xyXG4gIGFzeW5jIHBvc3Q8VCA9IGFueT4ocGF0aDogc3RyaW5nLCBib2R5PzogYW55KTogUHJvbWlzZTxUPiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PFQ+KCdQT1NUJywgcGF0aCwgYm9keSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBNYWtlIGEgUEFUQ0ggcmVxdWVzdCB0byBhbnkgQVBJIHBhdGhcclxuICAgKiBAZXhhbXBsZSBhd2FpdCBjbGllbnQucmVzdC5wYXRjaCgnL2JvdC9ndWlsZHMvMTIzL2NoYW5uZWxzLzQ1NicsIHsgbmFtZTogJ3JlbmFtZWQnIH0pO1xyXG4gICAqL1xyXG4gIGFzeW5jIHBhdGNoPFQgPSBhbnk+KHBhdGg6IHN0cmluZywgYm9keT86IGFueSk6IFByb21pc2U8VD4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxUPignUEFUQ0gnLCBwYXRoLCBib2R5KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIE1ha2UgYSBQVVQgcmVxdWVzdCB0byBhbnkgQVBJIHBhdGhcclxuICAgKiBAZXhhbXBsZSBhd2FpdCBjbGllbnQucmVzdC5wdXQoJy9ib3QvY2hhbm5lbHMvNDU2L3Blcm1pc3Npb25zLzc4OScsIHsgdHlwZTogMCwgYWxsb3c6ICcxMDI0JyB9KTtcclxuICAgKi9cclxuICBhc3luYyBwdXQ8VCA9IGFueT4ocGF0aDogc3RyaW5nLCBib2R5PzogYW55KTogUHJvbWlzZTxUPiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PFQ+KCdQVVQnLCBwYXRoLCBib2R5KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIE1ha2UgYSBERUxFVEUgcmVxdWVzdCB0byBhbnkgQVBJIHBhdGhcclxuICAgKiBAZXhhbXBsZSBhd2FpdCBjbGllbnQucmVzdC5kZWxldGUoJy9ib3QvZ3VpbGRzLzEyMy9jaGFubmVscy80NTYnKTtcclxuICAgKi9cclxuICBhc3luYyBkZWxldGU8VCA9IGFueT4ocGF0aDogc3RyaW5nKTogUHJvbWlzZTxUPiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PFQ+KCdERUxFVEUnLCBwYXRoKTtcclxuICB9XHJcbn1cclxuIl19