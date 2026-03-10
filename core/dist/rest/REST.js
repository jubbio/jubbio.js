"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REST = void 0;
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
        const userId = typeof user.id === 'string' ? parseInt(user.id, 10) : user.id;
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
     * // mention.data = { users: [{ id: 1, username: "ilkay" }] }
     */
    formatMention(user) {
        const userId = typeof user.id === 'string' ? parseInt(user.id, 10) : user.id;
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
        while ((match = userMentionRegex.exec(content)) !== null) {
            const userId = parseInt(match[1], 10);
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
        while ((match = roleMentionRegex.exec(content)) !== null) {
            const roleId = match[1];
            if (!addedRoleIds.has(roleId)) {
                mentions.roles.push({ id: roleId });
                addedRoleIds.add(roleId);
            }
        }
        // Parse @everyone and @here
        if (content.includes('@everyone')) {
            mentions.everyone = true;
        }
        // Clean up empty arrays
        if (mentions.users?.length === 0)
            delete mentions.users;
        if (mentions.roles?.length === 0)
            delete mentions.roles;
        return { content, mentions };
    }
    /**
     * Prepare message data with processed mentions
     * Automatically converts mentions to our format
     */
    prepareMessageData(data) {
        const result = { ...data };
        // Resolve components (ActionRowBuilder / ButtonBuilder instances)
        if (data.components && data.components.length > 0) {
            result.components = data.components.map((c) => typeof c.toJSON === 'function' ? c.toJSON() : c);
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
                // Support EmbedBuilder instances - extract raw data via toJSON()
                const rawEmbed = typeof embed.toJSON === 'function' ? embed.toJSON() : embed;
                const processedEmbed = { ...rawEmbed };
                // Normalize thumbnail: string → { url: string }
                if (typeof processedEmbed.thumbnail === 'string') {
                    processedEmbed.thumbnail = { url: processedEmbed.thumbnail };
                }
                // Normalize image: string → { url: string }
                if (typeof processedEmbed.image === 'string') {
                    processedEmbed.image = { url: processedEmbed.image };
                }
                // Normalize color: hex string → number
                if (typeof processedEmbed.color === 'string') {
                    processedEmbed.color = parseInt(processedEmbed.color.replace('#', ''), 16);
                }
                // Normalize timestamp: Date → ISO string
                if (processedEmbed.timestamp instanceof Date) {
                    processedEmbed.timestamp = processedEmbed.timestamp.toISOString();
                }
                else if (typeof processedEmbed.timestamp === 'number') {
                    processedEmbed.timestamp = new Date(processedEmbed.timestamp).toISOString();
                }
                // Normalize footer.iconURL → footer.icon_url
                if (processedEmbed.footer) {
                    if (processedEmbed.footer.iconURL && !processedEmbed.footer.icon_url) {
                        processedEmbed.footer = { ...processedEmbed.footer, icon_url: processedEmbed.footer.iconURL };
                        delete processedEmbed.footer.iconURL;
                    }
                }
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
                    processedEmbed.footer = { ...rawEmbed.footer, text: content };
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
     * Make an authenticated request
     */
    async request(method, path, body) {
        const url = `${this.baseUrl}${path}`;
        // Debug log
        console.log(`[REST] ${method} ${url}`, body ? JSON.stringify(body) : '');
        const response = await fetch(url, {
            method,
            headers: {
                'Authorization': `Bot ${this.token}`,
                'Content-Type': 'application/json'
            },
            body: body ? JSON.stringify(body) : undefined
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`API Error ${response.status}: ${error}`);
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
     * Create a DM message
     */
    async createDMMessage(channelId, data) {
        return this.request('POST', `/bot/dm/${channelId}`, data);
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
     * Accepted formats: :name:, <:name:id>, <a:name:id>
     * Unicode emoji characters (👍) are NOT supported.
     */
    validateEmoji(emoji) {
        const trimmed = emoji.trim();
        // Custom emoji: <:name:id> or <a:name:id>
        if (/^<a?:\w+:\d+>$/.test(trimmed))
            return trimmed;
        // Unicode emoji by name: :name:
        if (/^:\w+:$/.test(trimmed))
            return trimmed;
        throw new Error(`Geçersiz emoji formatı: "${emoji}". Kabul edilen formatlar: :emoji_name:, <:name:id>, <a:name:id>`);
    }
    /**
     * Add a reaction to a message
     * @param emoji - Emoji in :name:, <:name:id>, or <a:name:id> format. Unicode characters (👍) are not supported.
     */
    async addReaction(guildId, channelId, messageId, emoji) {
        const validated = this.validateEmoji(emoji);
        const path = `/bot/guilds/${guildId}/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(validated)}/@me`;
        await this.request('PUT', path);
    }
    /**
     * Remove a reaction from a message
     * @param emoji - Emoji in :name:, <:name:id>, or <a:name:id> format. Unicode characters (👍) are not supported.
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
        console.log(`[REST] Uploading attachment: ${file.name} (${file.data.length} bytes)`);
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
     */
    async createMessageWithFile(guildId, channelId, data) {
        const FormData = require('form-data');
        const form = new FormData();
        // Add content if provided
        if (data.content) {
            form.append('content', data.content);
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
        console.log(`[REST] Creating message with file: ${data.file.name} (${data.file.data.length} bytes)${data.interactionId ? ` [interaction: ${data.interactionId}]` : ''}`);
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
        console.log(`📤 Interaction response: ${interactionId} -> type ${data.type}`);
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
            console.log(`✅ Interaction response sent`);
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
            console.log(`[REST] editInteractionResponse with ${data.files.length} files - using createMessageWithFile`);
            // Create message with file
            const file = data.files[0]; // For now, support single file
            await this.createMessageWithFile(guildId, channelId, {
                content: processedData.content,
                file: file,
                interactionId: interactionId
            });
            return;
        }
        // If we have guildId, channelId and interactionId, create a new message with interaction_id
        // This is needed because our deferred response doesn't create a message
        if (guildId && channelId && interactionId) {
            console.log(`[REST] editInteractionResponse - creating message with interaction_id: ${interactionId}`);
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
     */
    async createFollowup(token, data) {
        const appId = this.getApplicationId();
        const processedData = this.prepareMessageData(data);
        await this.request('POST', `/interactions/webhooks/${appId}/${token}`, processedData);
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
     * Register guild-specific commands
     */
    async registerGuildCommands(guildId, commands) {
        const appId = this.getApplicationId();
        for (const command of commands) {
            await this.request('POST', `/applications/${appId}/guilds/${guildId}/commands`, command);
        }
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
     * Create a channel in a guild
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
     * Delete a channel
     */
    /**
     * Delete a channel
     */
    async deleteChannel(guildId, channelId) {
        await this.request('DELETE', `/bot/guilds/${guildId}/channels/${channelId}`);
    }
    /**
     * Delete a category
     */
    async deleteCategory(guildId, categoryId) {
        await this.request('DELETE', `/bot/guilds/${guildId}/categories/${categoryId}`);
    }
    /**
     * Edit channel permission overwrites
     */
    async editChannelPermissions(channelId, overwriteId, data) {
        await this.request('PUT', `/bot/channels/${channelId}/permissions/${overwriteId}`, data);
    }
    /**
     * Delete channel permission overwrite
     */
    async deleteChannelPermission(channelId, overwriteId) {
        await this.request('DELETE', `/bot/channels/${channelId}/permissions/${overwriteId}`);
    }
    /**
     * Get messages from a channel
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
    // ==================== Members ====================
    /**
     * Get a guild member
     */
    async getMember(guildId, userId) {
        return this.request('GET', `/bot/guilds/${guildId}/members/${userId}`);
    }
    /**
     * Timeout a guild member
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
     * Kick a guild member
     */
    async kickMember(guildId, userId, reason) {
        const query = reason ? `?reason=${encodeURIComponent(reason)}` : '';
        await this.request('DELETE', `/bot/guilds/${guildId}/members/${userId}${query}`);
    }
    /**
     * Ban a guild member
     */
    async banMember(guildId, userId, options) {
        await this.request('PUT', `/bot/guilds/${guildId}/bans/${userId}`, {
            delete_message_days: options?.deleteMessageDays,
            delete_message_seconds: options?.deleteMessageSeconds,
            reason: options?.reason
        });
    }
    /**
     * Unban a user
     */
    async unbanMember(guildId, userId, reason) {
        const query = reason ? `?reason=${encodeURIComponent(reason)}` : '';
        await this.request('DELETE', `/bot/guilds/${guildId}/bans/${userId}${query}`);
    }
    /**
     * Edit a guild member
     */
    async editMember(guildId, userId, data) {
        return this.request('PATCH', `/bot/guilds/${guildId}/members/${userId}`, data);
    }
    /**
     * Add a role to a member
     */
    async addMemberRole(guildId, userId, roleId, reason) {
        const query = reason ? `?reason=${encodeURIComponent(reason)}` : '';
        await this.request('PUT', `/bot/guilds/${guildId}/members/${userId}/roles/${roleId}${query}`);
    }
    /**
     * Remove a role from a member
     */
    async removeMemberRole(guildId, userId, roleId, reason) {
        const query = reason ? `?reason=${encodeURIComponent(reason)}` : '';
        await this.request('DELETE', `/bot/guilds/${guildId}/members/${userId}/roles/${roleId}${query}`);
    }
    /**
     * Bulk assign roles to members
     */
    async bulkAssignRoles(guildId, assignments) {
        return this.request('PUT', `/bot/guilds/${guildId}/members/roles/assign`, { assignments });
    }
    /**
     * Bulk remove roles from members
     */
    async bulkRemoveRoles(guildId, removals) {
        return this.request('DELETE', `/bot/guilds/${guildId}/members/roles/remove`, { removals });
    }
    /**
     * Bulk delete messages
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
    async getGuild(guildId) {
        return this.request('GET', `/bot/guilds/${guildId}`);
    }
    /**
     * Get guild channels
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
     */
    async getEmojis(guildId) {
        return this.request('GET', `/bot/guilds/${guildId}/emojis`);
    }
    /**
     * Get guild bans
     */
    async getBans(guildId) {
        return this.request('GET', `/bot/guilds/${guildId}/bans`);
    }
    /**
     * Get a specific ban
     */
    async getBan(guildId, userId) {
        return this.request('GET', `/bot/guilds/${guildId}/bans/${userId}`);
    }
    /**
     * Get guild invites
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
}
exports.REST = REST;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUkVTVC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9yZXN0L1JFU1QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBK0JBOztHQUVHO0FBQ0gsTUFBYSxJQUFJO0lBQ1AsT0FBTyxDQUFTO0lBQ2hCLEtBQUssR0FBVyxFQUFFLENBQUM7SUFFM0IscURBQXFEO0lBQzdDLFNBQVMsR0FBNEIsSUFBSSxHQUFHLEVBQUUsQ0FBQztJQUN0QyxjQUFjLEdBQUcsQ0FBQyxHQUFHLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQyxXQUFXO0lBRTVELFlBQVksVUFBa0IsbUNBQW1DO1FBQy9ELElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO0lBQ3pCLENBQUM7SUFFRCw0REFBNEQ7SUFFNUQ7OztPQUdHO0lBQ0gsU0FBUyxDQUFDLElBQTRGO1FBQ3BHLE1BQU0sTUFBTSxHQUFHLE9BQU8sSUFBSSxDQUFDLEVBQUUsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1FBQzdFLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRTtZQUN6QixFQUFFLEVBQUUsTUFBTTtZQUNWLFFBQVEsRUFBRSxJQUFJLENBQUMsUUFBUTtZQUN2QixXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVcsSUFBSSxJQUFJLENBQUMsWUFBWTtZQUNsRCxRQUFRLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTtTQUNyQixDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxVQUFVLENBQUMsS0FBb0c7UUFDN0csS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUM5QyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxhQUFh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LE9BQU8sQ0FBQyxPQUFPLEVBQUUsZUFBZSxPQUFPLGFBQWEsU0FBUyxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDckYsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLGFBQWEsQ0FBQyxPQUFlLEVBQUUsU0FBaUI7UUFDcEQsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRSxlQUFlLE9BQU8sYUFBYSxTQUFTLEVBQUUsQ0FBQyxDQUFDO0lBQ2hGLENBQUM7Q0FDRjtBQXptQ0Qsb0JBeW1DQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFQSU1lc3NhZ2UsIEFQSUFwcGxpY2F0aW9uQ29tbWFuZCwgQVBJRW1iZWQgfSBmcm9tICcuLi90eXBlcyc7XHJcblxyXG4vKipcclxuICogTWVudGlvbiBkYXRhIHN0cnVjdHVyZSBmb3Igb3VyIHN5c3RlbVxyXG4gKi9cclxuZXhwb3J0IGludGVyZmFjZSBNZW50aW9uVXNlciB7XHJcbiAgaWQ6IG51bWJlcjtcclxuICB1c2VybmFtZTogc3RyaW5nO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIE1lbnRpb25Sb2xlIHtcclxuICBpZDogc3RyaW5nO1xyXG4gIG5hbWU/OiBzdHJpbmc7XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgTWVudGlvbnNEYXRhIHtcclxuICB1c2Vycz86IE1lbnRpb25Vc2VyW107XHJcbiAgcm9sZXM/OiBNZW50aW9uUm9sZVtdO1xyXG4gIGV2ZXJ5b25lPzogYm9vbGVhbjtcclxufVxyXG5cclxuLyoqXHJcbiAqIFVzZXIgY2FjaGUgZW50cnlcclxuICovXHJcbmludGVyZmFjZSBDYWNoZWRVc2VyIHtcclxuICBpZDogbnVtYmVyO1xyXG4gIHVzZXJuYW1lOiBzdHJpbmc7XHJcbiAgZGlzcGxheU5hbWU/OiBzdHJpbmc7XHJcbiAgY2FjaGVkQXQ6IG51bWJlcjtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJFU1QgQVBJIGNsaWVudCBmb3IgSnViYmlvXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgUkVTVCB7XHJcbiAgcHJpdmF0ZSBiYXNlVXJsOiBzdHJpbmc7XHJcbiAgcHJpdmF0ZSB0b2tlbjogc3RyaW5nID0gJyc7XHJcbiAgXHJcbiAgLy8gVXNlciBjYWNoZSBmb3IgbWVudGlvbiByZXNvbHV0aW9uIChJRCAtPiB1c2VybmFtZSlcclxuICBwcml2YXRlIHVzZXJDYWNoZTogTWFwPG51bWJlciwgQ2FjaGVkVXNlcj4gPSBuZXcgTWFwKCk7XHJcbiAgcHJpdmF0ZSByZWFkb25seSBVU0VSX0NBQ0hFX1RUTCA9IDUgKiA2MCAqIDEwMDA7IC8vIDUgZGFraWthXHJcblxyXG4gIGNvbnN0cnVjdG9yKGJhc2VVcmw6IHN0cmluZyA9ICdodHRwczovL2dhdGV3YXkuanViYmlvLmNvbS9hcGkvdjEnKSB7XHJcbiAgICB0aGlzLmJhc2VVcmwgPSBiYXNlVXJsO1xyXG4gIH1cclxuXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT0gTWVudGlvbiBIZWxwZXJzID09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIC8qKlxyXG4gICAqIENhY2hlIGEgdXNlciBmb3IgbWVudGlvbiByZXNvbHV0aW9uXHJcbiAgICogQm90J2xhciBpbnRlcmFjdGlvbidkYW4gZ2VsZW4gdXNlciBiaWxnaXNpbmkgY2FjaGUnbGV5ZWJpbGlyXHJcbiAgICovXHJcbiAgY2FjaGVVc2VyKHVzZXI6IHsgaWQ6IHN0cmluZyB8IG51bWJlcjsgdXNlcm5hbWU6IHN0cmluZzsgZGlzcGxheU5hbWU/OiBzdHJpbmc7IGRpc3BsYXlfbmFtZT86IHN0cmluZyB9KTogdm9pZCB7XHJcbiAgICBjb25zdCB1c2VySWQgPSB0eXBlb2YgdXNlci5pZCA9PT0gJ3N0cmluZycgPyBwYXJzZUludCh1c2VyLmlkLCAxMCkgOiB1c2VyLmlkO1xyXG4gICAgdGhpcy51c2VyQ2FjaGUuc2V0KHVzZXJJZCwge1xyXG4gICAgICBpZDogdXNlcklkLFxyXG4gICAgICB1c2VybmFtZTogdXNlci51c2VybmFtZSxcclxuICAgICAgZGlzcGxheU5hbWU6IHVzZXIuZGlzcGxheU5hbWUgfHwgdXNlci5kaXNwbGF5X25hbWUsXHJcbiAgICAgIGNhY2hlZEF0OiBEYXRlLm5vdygpXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENhY2hlIG11bHRpcGxlIHVzZXJzXHJcbiAgICovXHJcbiAgY2FjaGVVc2Vycyh1c2VyczogQXJyYXk8eyBpZDogc3RyaW5nIHwgbnVtYmVyOyB1c2VybmFtZTogc3RyaW5nOyBkaXNwbGF5TmFtZT86IHN0cmluZzsgZGlzcGxheV9uYW1lPzogc3RyaW5nIH0+KTogdm9pZCB7XHJcbiAgICB1c2Vycy5mb3JFYWNoKHVzZXIgPT4gdGhpcy5jYWNoZVVzZXIodXNlcikpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGNhY2hlZCB1c2VyIGJ5IElEXHJcbiAgICovXHJcbiAgZ2V0Q2FjaGVkVXNlcih1c2VySWQ6IG51bWJlcik6IENhY2hlZFVzZXIgfCB1bmRlZmluZWQge1xyXG4gICAgY29uc3QgY2FjaGVkID0gdGhpcy51c2VyQ2FjaGUuZ2V0KHVzZXJJZCk7XHJcbiAgICBpZiAoY2FjaGVkICYmIERhdGUubm93KCkgLSBjYWNoZWQuY2FjaGVkQXQgPCB0aGlzLlVTRVJfQ0FDSEVfVFRMKSB7XHJcbiAgICAgIHJldHVybiBjYWNoZWQ7XHJcbiAgICB9XHJcbiAgICAvLyBFeHBpcmVkLCByZW1vdmUgZnJvbSBjYWNoZVxyXG4gICAgaWYgKGNhY2hlZCkge1xyXG4gICAgICB0aGlzLnVzZXJDYWNoZS5kZWxldGUodXNlcklkKTtcclxuICAgIH1cclxuICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBGb3JtYXQgYSB1c2VyIG1lbnRpb25cclxuICAgKiBSZXR1cm5zIGJvdGggdGhlIHRleHQgZm9ybWF0IGFuZCBtZW50aW9ucyBkYXRhXHJcbiAgICogXHJcbiAgICogQGV4YW1wbGVcclxuICAgKiBjb25zdCBtZW50aW9uID0gcmVzdC5mb3JtYXRNZW50aW9uKHVzZXIpO1xyXG4gICAqIC8vIG1lbnRpb24udGV4dCA9IFwiPEAxPlwiXHJcbiAgICogLy8gbWVudGlvbi5kYXRhID0geyB1c2VyczogW3sgaWQ6IDEsIHVzZXJuYW1lOiBcImlsa2F5XCIgfV0gfVxyXG4gICAqL1xyXG4gIGZvcm1hdE1lbnRpb24odXNlcjogeyBpZDogc3RyaW5nIHwgbnVtYmVyOyB1c2VybmFtZTogc3RyaW5nIH0pOiB7IHRleHQ6IHN0cmluZzsgZGF0YTogTWVudGlvbnNEYXRhIH0ge1xyXG4gICAgY29uc3QgdXNlcklkID0gdHlwZW9mIHVzZXIuaWQgPT09ICdzdHJpbmcnID8gcGFyc2VJbnQodXNlci5pZCwgMTApIDogdXNlci5pZDtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIHRleHQ6IGA8QCR7dXNlcklkfT5gLFxyXG4gICAgICBkYXRhOiB7XHJcbiAgICAgICAgdXNlcnM6IFt7IGlkOiB1c2VySWQsIHVzZXJuYW1lOiB1c2VyLnVzZXJuYW1lIH1dXHJcbiAgICAgIH1cclxuICAgIH07XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBQYXJzZSBtZW50aW9ucyAoPEBJRD4pIGluIGNvbnRlbnQgYW5kIGJ1aWxkIG1lbnRpb25zIGRhdGEgc3RydWN0dXJlXHJcbiAgICogQ29udGVudCBpcyBrZXB0IGFzLWlzIHdpdGggPEBJRD4gZm9ybWF0IChjbGllbnQgcmVuZGVycyB0aGVtKVxyXG4gICAqIFxyXG4gICAqIEBwYXJhbSBjb250ZW50IC0gTWVzc2FnZSBjb250ZW50IHdpdGggbWVudGlvbnNcclxuICAgKiBAcGFyYW0gZXhpc3RpbmdNZW50aW9ucyAtIEV4aXN0aW5nIG1lbnRpb25zIGRhdGEgdG8gbWVyZ2Ugd2l0aFxyXG4gICAqIEByZXR1cm5zIE9yaWdpbmFsIGNvbnRlbnQgYW5kIG1lbnRpb25zIGRhdGFcclxuICAgKi9cclxuICBwcml2YXRlIHByb2Nlc3NNZW50aW9ucyhjb250ZW50OiBzdHJpbmcsIGV4aXN0aW5nTWVudGlvbnM/OiBNZW50aW9uc0RhdGEpOiB7IGNvbnRlbnQ6IHN0cmluZzsgbWVudGlvbnM6IE1lbnRpb25zRGF0YSB9IHtcclxuICAgIGNvbnN0IG1lbnRpb25zOiBNZW50aW9uc0RhdGEgPSB7XHJcbiAgICAgIHVzZXJzOiBbLi4uKGV4aXN0aW5nTWVudGlvbnM/LnVzZXJzIHx8IFtdKV0sXHJcbiAgICAgIHJvbGVzOiBbLi4uKGV4aXN0aW5nTWVudGlvbnM/LnJvbGVzIHx8IFtdKV0sXHJcbiAgICAgIGV2ZXJ5b25lOiBleGlzdGluZ01lbnRpb25zPy5ldmVyeW9uZVxyXG4gICAgfTtcclxuXHJcbiAgICAvLyBUcmFjayBhbHJlYWR5IGFkZGVkIHVzZXIgSURzIHRvIGF2b2lkIGR1cGxpY2F0ZXNcclxuICAgIGNvbnN0IGFkZGVkVXNlcklkcyA9IG5ldyBTZXQobWVudGlvbnMudXNlcnM/Lm1hcCh1ID0+IHUuaWQpIHx8IFtdKTtcclxuXHJcbiAgICAvLyBQYXJzZSA8QElEPiBmb3JtYXQgKHVzZXIgbWVudGlvbnMpIOKAlCBrZWVwIGNvbnRlbnQgYXMtaXMsIG9ubHkgYnVpbGQgbWVudGlvbnMgZGF0YVxyXG4gICAgY29uc3QgdXNlck1lbnRpb25SZWdleCA9IC88QCE/KFxcZCspPi9nO1xyXG4gICAgbGV0IG1hdGNoO1xyXG5cclxuICAgIHdoaWxlICgobWF0Y2ggPSB1c2VyTWVudGlvblJlZ2V4LmV4ZWMoY29udGVudCkpICE9PSBudWxsKSB7XHJcbiAgICAgIGNvbnN0IHVzZXJJZCA9IHBhcnNlSW50KG1hdGNoWzFdLCAxMCk7XHJcblxyXG4gICAgICBpZiAoIWFkZGVkVXNlcklkcy5oYXModXNlcklkKSkge1xyXG4gICAgICAgIC8vIFRyeSB0byBnZXQgdXNlcm5hbWUgZnJvbSBjYWNoZSBmb3IgbWVudGlvbnMgZGF0YVxyXG4gICAgICAgIGNvbnN0IGNhY2hlZFVzZXIgPSB0aGlzLmdldENhY2hlZFVzZXIodXNlcklkKTtcclxuICAgICAgICBtZW50aW9ucy51c2VycyEucHVzaCh7IGlkOiB1c2VySWQsIHVzZXJuYW1lOiBjYWNoZWRVc2VyPy51c2VybmFtZSB8fCBgVXNlcl8ke3VzZXJJZH1gIH0pO1xyXG4gICAgICAgIGFkZGVkVXNlcklkcy5hZGQodXNlcklkKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIFBhcnNlIDxAJklEPiBmb3JtYXQgKHJvbGUgbWVudGlvbnMpIOKAlCBrZWVwIGNvbnRlbnQgYXMtaXNcclxuICAgIGNvbnN0IHJvbGVNZW50aW9uUmVnZXggPSAvPEAmKFxcZCspPi9nO1xyXG4gICAgY29uc3QgYWRkZWRSb2xlSWRzID0gbmV3IFNldChtZW50aW9ucy5yb2xlcz8ubWFwKHIgPT4gci5pZCkgfHwgW10pO1xyXG5cclxuICAgIHdoaWxlICgobWF0Y2ggPSByb2xlTWVudGlvblJlZ2V4LmV4ZWMoY29udGVudCkpICE9PSBudWxsKSB7XHJcbiAgICAgIGNvbnN0IHJvbGVJZCA9IG1hdGNoWzFdO1xyXG4gICAgICBpZiAoIWFkZGVkUm9sZUlkcy5oYXMocm9sZUlkKSkge1xyXG4gICAgICAgIG1lbnRpb25zLnJvbGVzIS5wdXNoKHsgaWQ6IHJvbGVJZCB9KTtcclxuICAgICAgICBhZGRlZFJvbGVJZHMuYWRkKHJvbGVJZCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyBQYXJzZSBAZXZlcnlvbmUgYW5kIEBoZXJlXHJcbiAgICBpZiAoY29udGVudC5pbmNsdWRlcygnQGV2ZXJ5b25lJykpIHtcclxuICAgICAgbWVudGlvbnMuZXZlcnlvbmUgPSB0cnVlO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIENsZWFuIHVwIGVtcHR5IGFycmF5c1xyXG4gICAgaWYgKG1lbnRpb25zLnVzZXJzPy5sZW5ndGggPT09IDApIGRlbGV0ZSBtZW50aW9ucy51c2VycztcclxuICAgIGlmIChtZW50aW9ucy5yb2xlcz8ubGVuZ3RoID09PSAwKSBkZWxldGUgbWVudGlvbnMucm9sZXM7XHJcblxyXG4gICAgcmV0dXJuIHsgY29udGVudCwgbWVudGlvbnMgfTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFByZXBhcmUgbWVzc2FnZSBkYXRhIHdpdGggcHJvY2Vzc2VkIG1lbnRpb25zXHJcbiAgICogQXV0b21hdGljYWxseSBjb252ZXJ0cyBtZW50aW9ucyB0byBvdXIgZm9ybWF0XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBwcmVwYXJlTWVzc2FnZURhdGEoZGF0YToge1xyXG4gICAgY29udGVudD86IHN0cmluZztcclxuICAgIGVtYmVkcz86IEFQSUVtYmVkW107XHJcbiAgICBjb21wb25lbnRzPzogYW55W107XHJcbiAgICBtZW50aW9ucz86IE1lbnRpb25zRGF0YTtcclxuICAgIG1lc3NhZ2VfcmVmZXJlbmNlPzogeyBtZXNzYWdlX2lkOiBzdHJpbmcgfTtcclxuICB9KTogYW55IHtcclxuICAgIGNvbnN0IHJlc3VsdDogYW55ID0geyAuLi5kYXRhIH07XHJcblxyXG4gICAgLy8gUmVzb2x2ZSBjb21wb25lbnRzIChBY3Rpb25Sb3dCdWlsZGVyIC8gQnV0dG9uQnVpbGRlciBpbnN0YW5jZXMpXHJcbiAgICBpZiAoZGF0YS5jb21wb25lbnRzICYmIGRhdGEuY29tcG9uZW50cy5sZW5ndGggPiAwKSB7XHJcbiAgICAgIHJlc3VsdC5jb21wb25lbnRzID0gZGF0YS5jb21wb25lbnRzLm1hcCgoYzogYW55KSA9PlxyXG4gICAgICAgIHR5cGVvZiBjLnRvSlNPTiA9PT0gJ2Z1bmN0aW9uJyA/IGMudG9KU09OKCkgOiBjXHJcbiAgICAgICk7XHJcbiAgICB9XHJcblxyXG4gICAgbGV0IGFsbE1lbnRpb25zOiBNZW50aW9uc0RhdGEgPSB7IC4uLmRhdGEubWVudGlvbnMgfTtcclxuXHJcbiAgICAvLyBQcm9jZXNzIG1lbnRpb25zIGluIGNvbnRlbnQgaWYgcHJlc2VudFxyXG4gICAgaWYgKGRhdGEuY29udGVudCkge1xyXG4gICAgICBjb25zdCB7IGNvbnRlbnQsIG1lbnRpb25zIH0gPSB0aGlzLnByb2Nlc3NNZW50aW9ucyhkYXRhLmNvbnRlbnQsIGFsbE1lbnRpb25zKTtcclxuICAgICAgcmVzdWx0LmNvbnRlbnQgPSBjb250ZW50O1xyXG4gICAgICBhbGxNZW50aW9ucyA9IG1lbnRpb25zO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIFByb2Nlc3MgbWVudGlvbnMgaW4gZW1iZWRzIChkZXNjcmlwdGlvbiwgdGl0bGUsIGZvb3RlciwgZmllbGRzKVxyXG4gICAgaWYgKGRhdGEuZW1iZWRzICYmIGRhdGEuZW1iZWRzLmxlbmd0aCA+IDApIHtcclxuICAgICAgcmVzdWx0LmVtYmVkcyA9IGRhdGEuZW1iZWRzLm1hcChlbWJlZCA9PiB7XHJcbiAgICAgICAgLy8gU3VwcG9ydCBFbWJlZEJ1aWxkZXIgaW5zdGFuY2VzIC0gZXh0cmFjdCByYXcgZGF0YSB2aWEgdG9KU09OKClcclxuICAgICAgICBjb25zdCByYXdFbWJlZCA9IHR5cGVvZiAoZW1iZWQgYXMgYW55KS50b0pTT04gPT09ICdmdW5jdGlvbicgPyAoZW1iZWQgYXMgYW55KS50b0pTT04oKSA6IGVtYmVkO1xyXG4gICAgICAgIGNvbnN0IHByb2Nlc3NlZEVtYmVkOiBhbnkgPSB7IC4uLnJhd0VtYmVkIH07XHJcblxyXG4gICAgICAgIC8vIE5vcm1hbGl6ZSB0aHVtYm5haWw6IHN0cmluZyDihpIgeyB1cmw6IHN0cmluZyB9XHJcbiAgICAgICAgaWYgKHR5cGVvZiBwcm9jZXNzZWRFbWJlZC50aHVtYm5haWwgPT09ICdzdHJpbmcnKSB7XHJcbiAgICAgICAgICBwcm9jZXNzZWRFbWJlZC50aHVtYm5haWwgPSB7IHVybDogcHJvY2Vzc2VkRW1iZWQudGh1bWJuYWlsIH07XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBOb3JtYWxpemUgaW1hZ2U6IHN0cmluZyDihpIgeyB1cmw6IHN0cmluZyB9XHJcbiAgICAgICAgaWYgKHR5cGVvZiBwcm9jZXNzZWRFbWJlZC5pbWFnZSA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgICAgIHByb2Nlc3NlZEVtYmVkLmltYWdlID0geyB1cmw6IHByb2Nlc3NlZEVtYmVkLmltYWdlIH07XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBOb3JtYWxpemUgY29sb3I6IGhleCBzdHJpbmcg4oaSIG51bWJlclxyXG4gICAgICAgIGlmICh0eXBlb2YgcHJvY2Vzc2VkRW1iZWQuY29sb3IgPT09ICdzdHJpbmcnKSB7XHJcbiAgICAgICAgICBwcm9jZXNzZWRFbWJlZC5jb2xvciA9IHBhcnNlSW50KHByb2Nlc3NlZEVtYmVkLmNvbG9yLnJlcGxhY2UoJyMnLCAnJyksIDE2KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIE5vcm1hbGl6ZSB0aW1lc3RhbXA6IERhdGUg4oaSIElTTyBzdHJpbmdcclxuICAgICAgICBpZiAocHJvY2Vzc2VkRW1iZWQudGltZXN0YW1wIGluc3RhbmNlb2YgRGF0ZSkge1xyXG4gICAgICAgICAgcHJvY2Vzc2VkRW1iZWQudGltZXN0YW1wID0gcHJvY2Vzc2VkRW1iZWQudGltZXN0YW1wLnRvSVNPU3RyaW5nKCk7XHJcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgcHJvY2Vzc2VkRW1iZWQudGltZXN0YW1wID09PSAnbnVtYmVyJykge1xyXG4gICAgICAgICAgcHJvY2Vzc2VkRW1iZWQudGltZXN0YW1wID0gbmV3IERhdGUocHJvY2Vzc2VkRW1iZWQudGltZXN0YW1wKS50b0lTT1N0cmluZygpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gTm9ybWFsaXplIGZvb3Rlci5pY29uVVJMIOKGkiBmb290ZXIuaWNvbl91cmxcclxuICAgICAgICBpZiAocHJvY2Vzc2VkRW1iZWQuZm9vdGVyKSB7XHJcbiAgICAgICAgICBpZiAocHJvY2Vzc2VkRW1iZWQuZm9vdGVyLmljb25VUkwgJiYgIXByb2Nlc3NlZEVtYmVkLmZvb3Rlci5pY29uX3VybCkge1xyXG4gICAgICAgICAgICBwcm9jZXNzZWRFbWJlZC5mb290ZXIgPSB7IC4uLnByb2Nlc3NlZEVtYmVkLmZvb3RlciwgaWNvbl91cmw6IHByb2Nlc3NlZEVtYmVkLmZvb3Rlci5pY29uVVJMIH07XHJcbiAgICAgICAgICAgIGRlbGV0ZSBwcm9jZXNzZWRFbWJlZC5mb290ZXIuaWNvblVSTDtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gUHJvY2VzcyBkZXNjcmlwdGlvblxyXG4gICAgICAgIGlmIChyYXdFbWJlZC5kZXNjcmlwdGlvbikge1xyXG4gICAgICAgICAgY29uc3QgeyBjb250ZW50LCBtZW50aW9ucyB9ID0gdGhpcy5wcm9jZXNzTWVudGlvbnMocmF3RW1iZWQuZGVzY3JpcHRpb24sIGFsbE1lbnRpb25zKTtcclxuICAgICAgICAgIHByb2Nlc3NlZEVtYmVkLmRlc2NyaXB0aW9uID0gY29udGVudDtcclxuICAgICAgICAgIGFsbE1lbnRpb25zID0gbWVudGlvbnM7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIFByb2Nlc3MgdGl0bGVcclxuICAgICAgICBpZiAocmF3RW1iZWQudGl0bGUpIHtcclxuICAgICAgICAgIGNvbnN0IHsgY29udGVudCwgbWVudGlvbnMgfSA9IHRoaXMucHJvY2Vzc01lbnRpb25zKHJhd0VtYmVkLnRpdGxlLCBhbGxNZW50aW9ucyk7XHJcbiAgICAgICAgICBwcm9jZXNzZWRFbWJlZC50aXRsZSA9IGNvbnRlbnQ7XHJcbiAgICAgICAgICBhbGxNZW50aW9ucyA9IG1lbnRpb25zO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICAvLyBQcm9jZXNzIGZvb3RlciB0ZXh0XHJcbiAgICAgICAgaWYgKHJhd0VtYmVkLmZvb3Rlcj8udGV4dCkge1xyXG4gICAgICAgICAgY29uc3QgeyBjb250ZW50LCBtZW50aW9ucyB9ID0gdGhpcy5wcm9jZXNzTWVudGlvbnMocmF3RW1iZWQuZm9vdGVyLnRleHQsIGFsbE1lbnRpb25zKTtcclxuICAgICAgICAgIHByb2Nlc3NlZEVtYmVkLmZvb3RlciA9IHsgLi4ucmF3RW1iZWQuZm9vdGVyLCB0ZXh0OiBjb250ZW50IH07XHJcbiAgICAgICAgICBhbGxNZW50aW9ucyA9IG1lbnRpb25zO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICAvLyBQcm9jZXNzIGZpZWxkc1xyXG4gICAgICAgIGlmIChyYXdFbWJlZC5maWVsZHMgJiYgcmF3RW1iZWQuZmllbGRzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgIHByb2Nlc3NlZEVtYmVkLmZpZWxkcyA9IHJhd0VtYmVkLmZpZWxkcy5tYXAoKGZpZWxkOiBhbnkpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgcHJvY2Vzc2VkRmllbGQ6IGFueSA9IHsgLi4uZmllbGQgfTtcclxuICAgICAgICAgICAgaWYgKGZpZWxkLnZhbHVlKSB7XHJcbiAgICAgICAgICAgICAgY29uc3QgeyBjb250ZW50LCBtZW50aW9ucyB9ID0gdGhpcy5wcm9jZXNzTWVudGlvbnMoZmllbGQudmFsdWUsIGFsbE1lbnRpb25zKTtcclxuICAgICAgICAgICAgICBwcm9jZXNzZWRGaWVsZC52YWx1ZSA9IGNvbnRlbnQ7XHJcbiAgICAgICAgICAgICAgYWxsTWVudGlvbnMgPSBtZW50aW9ucztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoZmllbGQubmFtZSkge1xyXG4gICAgICAgICAgICAgIGNvbnN0IHsgY29udGVudCwgbWVudGlvbnMgfSA9IHRoaXMucHJvY2Vzc01lbnRpb25zKGZpZWxkLm5hbWUsIGFsbE1lbnRpb25zKTtcclxuICAgICAgICAgICAgICBwcm9jZXNzZWRGaWVsZC5uYW1lID0gY29udGVudDtcclxuICAgICAgICAgICAgICBhbGxNZW50aW9ucyA9IG1lbnRpb25zO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiBwcm9jZXNzZWRGaWVsZDtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4gcHJvY2Vzc2VkRW1iZWQ7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIEFkZCBtZXJnZWQgbWVudGlvbnMgdG8gcmVzdWx0XHJcbiAgICBpZiAoYWxsTWVudGlvbnMudXNlcnM/Lmxlbmd0aCB8fCBhbGxNZW50aW9ucy5yb2xlcz8ubGVuZ3RoIHx8IGFsbE1lbnRpb25zLmV2ZXJ5b25lKSB7XHJcbiAgICAgIHJlc3VsdC5tZW50aW9ucyA9IGFsbE1lbnRpb25zO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiByZXN1bHQ7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZXQgdGhlIGJvdCB0b2tlblxyXG4gICAqL1xyXG4gIHNldFRva2VuKHRva2VuOiBzdHJpbmcpOiB0aGlzIHtcclxuICAgIHRoaXMudG9rZW4gPSB0b2tlbjtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogTWFrZSBhbiBhdXRoZW50aWNhdGVkIHJlcXVlc3RcclxuICAgKi9cclxuICBwcml2YXRlIGFzeW5jIHJlcXVlc3Q8VD4obWV0aG9kOiBzdHJpbmcsIHBhdGg6IHN0cmluZywgYm9keT86IGFueSk6IFByb21pc2U8VD4ge1xyXG4gICAgY29uc3QgdXJsID0gYCR7dGhpcy5iYXNlVXJsfSR7cGF0aH1gO1xyXG4gICAgXHJcbiAgICAvLyBEZWJ1ZyBsb2dcclxuICAgIGNvbnNvbGUubG9nKGBbUkVTVF0gJHttZXRob2R9ICR7dXJsfWAsIGJvZHkgPyBKU09OLnN0cmluZ2lmeShib2R5KSA6ICcnKTtcclxuICAgIFxyXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCh1cmwsIHtcclxuICAgICAgbWV0aG9kLFxyXG4gICAgICBoZWFkZXJzOiB7XHJcbiAgICAgICAgJ0F1dGhvcml6YXRpb24nOiBgQm90ICR7dGhpcy50b2tlbn1gLFxyXG4gICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbidcclxuICAgICAgfSxcclxuICAgICAgYm9keTogYm9keSA/IEpTT04uc3RyaW5naWZ5KGJvZHkpIDogdW5kZWZpbmVkXHJcbiAgICB9KTtcclxuXHJcbiAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XHJcbiAgICAgIGNvbnN0IGVycm9yID0gYXdhaXQgcmVzcG9uc2UudGV4dCgpO1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEFQSSBFcnJvciAke3Jlc3BvbnNlLnN0YXR1c306ICR7ZXJyb3J9YCk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gSGFuZGxlIGVtcHR5IHJlc3BvbnNlc1xyXG4gICAgY29uc3QgdGV4dCA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKTtcclxuICAgIGlmICghdGV4dCkgcmV0dXJuIHt9IGFzIFQ7XHJcbiAgICBcclxuICAgIHJldHVybiBKU09OLnBhcnNlKHRleHQpO1xyXG4gIH1cclxuXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT0gTWVzc2FnZXMgPT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgbWVzc2FnZSBpbiBhIGNoYW5uZWxcclxuICAgKiBNZW50aW9ucyB1c2UgPEBJRD4gZm9ybWF0IGFuZCBhcmUga2VwdCBhcy1pcyAoY2xpZW50IHJlbmRlcnMgdGhlbSlcclxuICAgKiBcclxuICAgKiBAZXhhbXBsZVxyXG4gICAqIGF3YWl0IHJlc3QuY3JlYXRlTWVzc2FnZShndWlsZElkLCBjaGFubmVsSWQsIHtcclxuICAgKiAgIGNvbnRlbnQ6ICdIZWxsbyA8QDEyMz4hJyxcclxuICAgKiB9KTtcclxuICAgKi9cclxuICBhc3luYyBjcmVhdGVNZXNzYWdlKGd1aWxkSWRPckNoYW5uZWxJZDogc3RyaW5nLCBjaGFubmVsSWRPckRhdGE6IHN0cmluZyB8IHtcclxuICAgIGNvbnRlbnQ/OiBzdHJpbmc7XHJcbiAgICBlbWJlZHM/OiBBUElFbWJlZFtdO1xyXG4gICAgY29tcG9uZW50cz86IGFueVtdO1xyXG4gICAgbWVudGlvbnM/OiBNZW50aW9uc0RhdGE7XHJcbiAgICBmaWxlcz86IEFycmF5PHsgbmFtZTogc3RyaW5nOyBkYXRhOiBCdWZmZXIgfT47XHJcbiAgICBtZXNzYWdlX3JlZmVyZW5jZT86IHsgbWVzc2FnZV9pZDogc3RyaW5nIH07XHJcbiAgICBpbnRlcmFjdGlvbklkPzogc3RyaW5nO1xyXG4gIH0sIGRhdGE/OiB7XHJcbiAgICBjb250ZW50Pzogc3RyaW5nO1xyXG4gICAgZW1iZWRzPzogQVBJRW1iZWRbXTtcclxuICAgIGNvbXBvbmVudHM/OiBhbnlbXTtcclxuICAgIG1lbnRpb25zPzogTWVudGlvbnNEYXRhO1xyXG4gICAgZmlsZXM/OiBBcnJheTx7IG5hbWU6IHN0cmluZzsgZGF0YTogQnVmZmVyIH0+O1xyXG4gICAgbWVzc2FnZV9yZWZlcmVuY2U/OiB7IG1lc3NhZ2VfaWQ6IHN0cmluZyB9O1xyXG4gICAgaW50ZXJhY3Rpb25JZD86IHN0cmluZztcclxuICB9KTogUHJvbWlzZTxBUElNZXNzYWdlPiB7XHJcbiAgICAvLyDEsGtpIGt1bGxhbsSxbSDFn2VrbGk6XHJcbiAgICAvLyAxLiBjcmVhdGVNZXNzYWdlKGd1aWxkSWQsIGNoYW5uZWxJZCwgZGF0YSkgLSBndWlsZElkIGlsZSAodGVyY2loIGVkaWxlbilcclxuICAgIC8vIDIuIGNyZWF0ZU1lc3NhZ2UoY2hhbm5lbElkLCBkYXRhKSAtIGd1aWxkSWQgb2xtYWRhbiAoZXNraSBmb3JtYXQsIGhhdGEgdmVyaXIpXHJcbiAgICBcclxuICAgIGxldCBndWlsZElkOiBzdHJpbmc7XHJcbiAgICBsZXQgY2hhbm5lbElkOiBzdHJpbmc7XHJcbiAgICBsZXQgbWVzc2FnZURhdGE6IGFueTtcclxuICAgIFxyXG4gICAgaWYgKHR5cGVvZiBjaGFubmVsSWRPckRhdGEgPT09ICdzdHJpbmcnICYmIGRhdGEpIHtcclxuICAgICAgLy8gWWVuaSBmb3JtYXQ6IGNyZWF0ZU1lc3NhZ2UoZ3VpbGRJZCwgY2hhbm5lbElkLCBkYXRhKVxyXG4gICAgICBndWlsZElkID0gZ3VpbGRJZE9yQ2hhbm5lbElkO1xyXG4gICAgICBjaGFubmVsSWQgPSBjaGFubmVsSWRPckRhdGE7XHJcbiAgICAgIG1lc3NhZ2VEYXRhID0gdGhpcy5wcmVwYXJlTWVzc2FnZURhdGEoZGF0YSk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBBZGQgaW50ZXJhY3Rpb25faWQgaWYgcHJvdmlkZWRcclxuICAgICAgaWYgKGRhdGEuaW50ZXJhY3Rpb25JZCkge1xyXG4gICAgICAgIG1lc3NhZ2VEYXRhLmludGVyYWN0aW9uX2lkID0gZGF0YS5pbnRlcmFjdGlvbklkO1xyXG4gICAgICB9XHJcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBjaGFubmVsSWRPckRhdGEgPT09ICdvYmplY3QnKSB7XHJcbiAgICAgIC8vIEVza2kgZm9ybWF0OiBjcmVhdGVNZXNzYWdlKGNoYW5uZWxJZCwgZGF0YSkgLSBndWlsZElkIHlva1xyXG4gICAgICAvLyBCdSBmb3JtYXQgYXJ0xLFrIGRlc3Rla2xlbm1peW9yLCBoYXRhIGbEsXJsYXRcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdjcmVhdGVNZXNzYWdlIHJlcXVpcmVzIGd1aWxkSWQ6IGNyZWF0ZU1lc3NhZ2UoZ3VpbGRJZCwgY2hhbm5lbElkLCBkYXRhKScpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGNyZWF0ZU1lc3NhZ2UgYXJndW1lbnRzJyk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QVBJTWVzc2FnZT4oJ1BPU1QnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH0vbWVzc2FnZXNgLCBtZXNzYWdlRGF0YSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgYW4gZXBoZW1lcmFsIG1lc3NhZ2UgdGhhdCBpcyBvbmx5IHZpc2libGUgdG8gYSBzcGVjaWZpYyB1c2VyXHJcbiAgICogRXBoZW1lcmFsIG1lc3NhZ2VzIGFyZSBOT1Qgc2F2ZWQgdG8gZGF0YWJhc2UgLSB0aGV5IGFyZSBvbmx5IHNlbnQgdmlhIFdlYlNvY2tldFxyXG4gICAqIFxyXG4gICAqIEBleGFtcGxlXHJcbiAgICogLy8gU2VuZCBhIHdhcm5pbmcgb25seSB2aXNpYmxlIHRvIHRoZSB1c2VyXHJcbiAgICogYXdhaXQgcmVzdC5jcmVhdGVFcGhlbWVyYWxNZXNzYWdlKGd1aWxkSWQsIGNoYW5uZWxJZCwgdGFyZ2V0VXNlcklkLCB7XHJcbiAgICogICBlbWJlZHM6IFt3YXJuaW5nRW1iZWRdXHJcbiAgICogfSk7XHJcbiAgICovXHJcbiAgYXN5bmMgY3JlYXRlRXBoZW1lcmFsTWVzc2FnZShndWlsZElkOiBzdHJpbmcsIGNoYW5uZWxJZDogc3RyaW5nLCB0YXJnZXRVc2VySWQ6IHN0cmluZyB8IG51bWJlciwgZGF0YToge1xyXG4gICAgY29udGVudD86IHN0cmluZztcclxuICAgIGVtYmVkcz86IEFQSUVtYmVkW107XHJcbiAgfSk6IFByb21pc2U8eyBpZDogc3RyaW5nOyBlcGhlbWVyYWw6IGJvb2xlYW47IGZsYWdzOiBudW1iZXIgfT4ge1xyXG4gICAgY29uc3QgbWVzc2FnZURhdGEgPSB0aGlzLnByZXBhcmVNZXNzYWdlRGF0YShkYXRhKTtcclxuICAgIFxyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDx7IGlkOiBzdHJpbmc7IGVwaGVtZXJhbDogYm9vbGVhbjsgZmxhZ3M6IG51bWJlciB9PignUE9TVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS9tZXNzYWdlc2AsIHtcclxuICAgICAgLi4ubWVzc2FnZURhdGEsXHJcbiAgICAgIGZsYWdzOiA2NCwgLy8gRVBIRU1FUkFMIGZsYWdcclxuICAgICAgdGFyZ2V0X3VzZXJfaWQ6IHR5cGVvZiB0YXJnZXRVc2VySWQgPT09ICdzdHJpbmcnID8gcGFyc2VJbnQodGFyZ2V0VXNlcklkLCAxMCkgOiB0YXJnZXRVc2VySWRcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgRE0gbWVzc2FnZVxyXG4gICAqL1xyXG4gIGFzeW5jIGNyZWF0ZURNTWVzc2FnZShjaGFubmVsSWQ6IHN0cmluZywgZGF0YToge1xyXG4gICAgY29udGVudD86IHN0cmluZztcclxuICAgIGVtYmVkcz86IEFQSUVtYmVkW107XHJcbiAgfSk6IFByb21pc2U8QVBJTWVzc2FnZT4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBUElNZXNzYWdlPignUE9TVCcsIGAvYm90L2RtLyR7Y2hhbm5lbElkfWAsIGRhdGEpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRWRpdCBhIG1lc3NhZ2VcclxuICAgKiBBdXRvbWF0aWNhbGx5IHByb2Nlc3NlcyBtZW50aW9uc1xyXG4gICAqL1xyXG4gIGFzeW5jIGVkaXRNZXNzYWdlKGd1aWxkSWQ6IHN0cmluZywgY2hhbm5lbElkOiBzdHJpbmcsIG1lc3NhZ2VJZDogc3RyaW5nLCBkYXRhOiB7XHJcbiAgICBjb250ZW50Pzogc3RyaW5nO1xyXG4gICAgZW1iZWRzPzogQVBJRW1iZWRbXTtcclxuICAgIGNvbXBvbmVudHM/OiBhbnlbXTtcclxuICAgIG1lbnRpb25zPzogTWVudGlvbnNEYXRhO1xyXG4gIH0pOiBQcm9taXNlPEFQSU1lc3NhZ2U+IHtcclxuICAgIGNvbnN0IHBhdGggPSBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH0vbWVzc2FnZXMvJHttZXNzYWdlSWR9YDtcclxuICAgIGNvbnN0IHByb2Nlc3NlZERhdGEgPSB0aGlzLnByZXBhcmVNZXNzYWdlRGF0YShkYXRhKTtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QVBJTWVzc2FnZT4oJ1BBVENIJywgcGF0aCwgcHJvY2Vzc2VkRGF0YSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZWxldGUgYSBtZXNzYWdlXHJcbiAgICovXHJcbiAgYXN5bmMgZGVsZXRlTWVzc2FnZShndWlsZElkOiBzdHJpbmcsIGNoYW5uZWxJZDogc3RyaW5nLCBtZXNzYWdlSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgcGF0aCA9IGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS9tZXNzYWdlcy8ke21lc3NhZ2VJZH1gO1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0PHZvaWQ+KCdERUxFVEUnLCBwYXRoKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFZhbGlkYXRlIGFuZCBub3JtYWxpemUgZW1vamkgZm9ybWF0IGZvciB0aGUgQVBJLlxyXG4gICAqIEFjY2VwdGVkIGZvcm1hdHM6IDpuYW1lOiwgPDpuYW1lOmlkPiwgPGE6bmFtZTppZD5cclxuICAgKiBVbmljb2RlIGVtb2ppIGNoYXJhY3RlcnMgKPCfkY0pIGFyZSBOT1Qgc3VwcG9ydGVkLlxyXG4gICAqL1xyXG4gIHByaXZhdGUgdmFsaWRhdGVFbW9qaShlbW9qaTogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgIGNvbnN0IHRyaW1tZWQgPSBlbW9qaS50cmltKCk7XHJcbiAgICAvLyBDdXN0b20gZW1vamk6IDw6bmFtZTppZD4gb3IgPGE6bmFtZTppZD5cclxuICAgIGlmICgvXjxhPzpcXHcrOlxcZCs+JC8udGVzdCh0cmltbWVkKSkgcmV0dXJuIHRyaW1tZWQ7XHJcbiAgICAvLyBVbmljb2RlIGVtb2ppIGJ5IG5hbWU6IDpuYW1lOlxyXG4gICAgaWYgKC9eOlxcdys6JC8udGVzdCh0cmltbWVkKSkgcmV0dXJuIHRyaW1tZWQ7XHJcbiAgICB0aHJvdyBuZXcgRXJyb3IoXHJcbiAgICAgIGBHZcOnZXJzaXogZW1vamkgZm9ybWF0xLE6IFwiJHtlbW9qaX1cIi4gS2FidWwgZWRpbGVuIGZvcm1hdGxhcjogOmVtb2ppX25hbWU6LCA8Om5hbWU6aWQ+LCA8YTpuYW1lOmlkPmBcclxuICAgICk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBZGQgYSByZWFjdGlvbiB0byBhIG1lc3NhZ2VcclxuICAgKiBAcGFyYW0gZW1vamkgLSBFbW9qaSBpbiA6bmFtZTosIDw6bmFtZTppZD4sIG9yIDxhOm5hbWU6aWQ+IGZvcm1hdC4gVW5pY29kZSBjaGFyYWN0ZXJzICjwn5GNKSBhcmUgbm90IHN1cHBvcnRlZC5cclxuICAgKi9cclxuICBhc3luYyBhZGRSZWFjdGlvbihndWlsZElkOiBzdHJpbmcsIGNoYW5uZWxJZDogc3RyaW5nLCBtZXNzYWdlSWQ6IHN0cmluZywgZW1vamk6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgdmFsaWRhdGVkID0gdGhpcy52YWxpZGF0ZUVtb2ppKGVtb2ppKTtcclxuICAgIGNvbnN0IHBhdGggPSBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH0vbWVzc2FnZXMvJHttZXNzYWdlSWR9L3JlYWN0aW9ucy8ke2VuY29kZVVSSUNvbXBvbmVudCh2YWxpZGF0ZWQpfS9AbWVgO1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0PHZvaWQ+KCdQVVQnLCBwYXRoKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlbW92ZSBhIHJlYWN0aW9uIGZyb20gYSBtZXNzYWdlXHJcbiAgICogQHBhcmFtIGVtb2ppIC0gRW1vamkgaW4gOm5hbWU6LCA8Om5hbWU6aWQ+LCBvciA8YTpuYW1lOmlkPiBmb3JtYXQuIFVuaWNvZGUgY2hhcmFjdGVycyAo8J+RjSkgYXJlIG5vdCBzdXBwb3J0ZWQuXHJcbiAgICovXHJcbiAgYXN5bmMgcmVtb3ZlUmVhY3Rpb24oZ3VpbGRJZDogc3RyaW5nLCBjaGFubmVsSWQ6IHN0cmluZywgbWVzc2FnZUlkOiBzdHJpbmcsIGVtb2ppOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IHZhbGlkYXRlZCA9IHRoaXMudmFsaWRhdGVFbW9qaShlbW9qaSk7XHJcbiAgICBjb25zdCBwYXRoID0gYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vY2hhbm5lbHMvJHtjaGFubmVsSWR9L21lc3NhZ2VzLyR7bWVzc2FnZUlkfS9yZWFjdGlvbnMvJHtlbmNvZGVVUklDb21wb25lbnQodmFsaWRhdGVkKX0vQG1lYDtcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdDx2b2lkPignREVMRVRFJywgcGF0aCk7XHJcbiAgfVxyXG5cclxuXHJcbiAgLyoqXHJcbiAgICogVXBsb2FkIGFuIGF0dGFjaG1lbnQgdG8gYSBjaGFubmVsXHJcbiAgICovXHJcbiAgYXN5bmMgdXBsb2FkQXR0YWNobWVudChndWlsZElkOiBzdHJpbmcsIGNoYW5uZWxJZDogc3RyaW5nLCBmaWxlOiB7IG5hbWU6IHN0cmluZzsgZGF0YTogQnVmZmVyOyBjb250ZW50VHlwZT86IHN0cmluZyB9KTogUHJvbWlzZTx7IGlkOiBzdHJpbmc7IHVybDogc3RyaW5nOyBmaWxlbmFtZTogc3RyaW5nIH0+IHtcclxuICAgIGNvbnN0IEZvcm1EYXRhID0gcmVxdWlyZSgnZm9ybS1kYXRhJyk7XHJcbiAgICBjb25zdCBmb3JtID0gbmV3IEZvcm1EYXRhKCk7XHJcbiAgICBcclxuICAgIC8vIGZvcm0tZGF0YSBleHBlY3RzIHRoZSBidWZmZXIgZGlyZWN0bHkgd2l0aCBvcHRpb25zXHJcbiAgICBmb3JtLmFwcGVuZCgnZmlsZScsIGZpbGUuZGF0YSwge1xyXG4gICAgICBmaWxlbmFtZTogZmlsZS5uYW1lLFxyXG4gICAgICBjb250ZW50VHlwZTogZmlsZS5jb250ZW50VHlwZSB8fCAndGV4dC9wbGFpbidcclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBjb25zdCB1cmwgPSBgJHt0aGlzLmJhc2VVcmx9L2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH0vYXR0YWNobWVudHNgO1xyXG4gICAgXHJcbiAgICBjb25zb2xlLmxvZyhgW1JFU1RdIFVwbG9hZGluZyBhdHRhY2htZW50OiAke2ZpbGUubmFtZX0gKCR7ZmlsZS5kYXRhLmxlbmd0aH0gYnl0ZXMpYCk7XHJcbiAgICBcclxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godXJsLCB7XHJcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxyXG4gICAgICBoZWFkZXJzOiB7XHJcbiAgICAgICAgJ0F1dGhvcml6YXRpb24nOiBgQm90ICR7dGhpcy50b2tlbn1gLFxyXG4gICAgICAgIC4uLmZvcm0uZ2V0SGVhZGVycygpXHJcbiAgICAgIH0sXHJcbiAgICAgIGJvZHk6IGZvcm0uZ2V0QnVmZmVyKClcclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XHJcbiAgICAgIGNvbnN0IGVycm9yID0gYXdhaXQgcmVzcG9uc2UudGV4dCgpO1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEFQSSBFcnJvciAke3Jlc3BvbnNlLnN0YXR1c306ICR7ZXJyb3J9YCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHJldHVybiByZXNwb25zZS5qc29uKCkgYXMgUHJvbWlzZTx7IGlkOiBzdHJpbmc7IHVybDogc3RyaW5nOyBmaWxlbmFtZTogc3RyaW5nIH0+O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgbWVzc2FnZSB3aXRoIGEgZmlsZSBhdHRhY2htZW50XHJcbiAgICovXHJcbiAgYXN5bmMgY3JlYXRlTWVzc2FnZVdpdGhGaWxlKGd1aWxkSWQ6IHN0cmluZywgY2hhbm5lbElkOiBzdHJpbmcsIGRhdGE6IHtcclxuICAgIGNvbnRlbnQ/OiBzdHJpbmc7XHJcbiAgICBmaWxlOiB7IG5hbWU6IHN0cmluZzsgZGF0YTogQnVmZmVyOyBjb250ZW50VHlwZT86IHN0cmluZyB9O1xyXG4gICAgaW50ZXJhY3Rpb25JZD86IHN0cmluZztcclxuICB9KTogUHJvbWlzZTxBUElNZXNzYWdlPiB7XHJcbiAgICBjb25zdCBGb3JtRGF0YSA9IHJlcXVpcmUoJ2Zvcm0tZGF0YScpO1xyXG4gICAgY29uc3QgZm9ybSA9IG5ldyBGb3JtRGF0YSgpO1xyXG4gICAgXHJcbiAgICAvLyBBZGQgY29udGVudCBpZiBwcm92aWRlZFxyXG4gICAgaWYgKGRhdGEuY29udGVudCkge1xyXG4gICAgICBmb3JtLmFwcGVuZCgnY29udGVudCcsIGRhdGEuY29udGVudCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIEFkZCBpbnRlcmFjdGlvbl9pZCBpZiBwcm92aWRlZCAoZm9yIGRlZmVycmVkIHJlc3BvbnNlIG1hdGNoaW5nKVxyXG4gICAgaWYgKGRhdGEuaW50ZXJhY3Rpb25JZCkge1xyXG4gICAgICBmb3JtLmFwcGVuZCgnaW50ZXJhY3Rpb25faWQnLCBkYXRhLmludGVyYWN0aW9uSWQpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvLyBBZGQgZmlsZVxyXG4gICAgZm9ybS5hcHBlbmQoJ2ZpbGVzJywgZGF0YS5maWxlLmRhdGEsIHtcclxuICAgICAgZmlsZW5hbWU6IGRhdGEuZmlsZS5uYW1lLFxyXG4gICAgICBjb250ZW50VHlwZTogZGF0YS5maWxlLmNvbnRlbnRUeXBlIHx8ICd0ZXh0L3BsYWluJ1xyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIGNvbnN0IHVybCA9IGAke3RoaXMuYmFzZVVybH0vYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS9tZXNzYWdlc2A7XHJcbiAgICBcclxuICAgIGNvbnNvbGUubG9nKGBbUkVTVF0gQ3JlYXRpbmcgbWVzc2FnZSB3aXRoIGZpbGU6ICR7ZGF0YS5maWxlLm5hbWV9ICgke2RhdGEuZmlsZS5kYXRhLmxlbmd0aH0gYnl0ZXMpJHtkYXRhLmludGVyYWN0aW9uSWQgPyBgIFtpbnRlcmFjdGlvbjogJHtkYXRhLmludGVyYWN0aW9uSWR9XWAgOiAnJ31gKTtcclxuICAgIFxyXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCh1cmwsIHtcclxuICAgICAgbWV0aG9kOiAnUE9TVCcsXHJcbiAgICAgIGhlYWRlcnM6IHtcclxuICAgICAgICAnQXV0aG9yaXphdGlvbic6IGBCb3QgJHt0aGlzLnRva2VufWAsXHJcbiAgICAgICAgLi4uZm9ybS5nZXRIZWFkZXJzKClcclxuICAgICAgfSxcclxuICAgICAgYm9keTogZm9ybS5nZXRCdWZmZXIoKVxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIGlmICghcmVzcG9uc2Uub2spIHtcclxuICAgICAgY29uc3QgZXJyb3IgPSBhd2FpdCByZXNwb25zZS50ZXh0KCk7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQVBJIEVycm9yICR7cmVzcG9uc2Uuc3RhdHVzfTogJHtlcnJvcn1gKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgcmV0dXJuIHJlc3BvbnNlLmpzb24oKSBhcyBQcm9taXNlPEFQSU1lc3NhZ2U+O1xyXG4gIH1cclxuXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT0gSW50ZXJhY3Rpb25zID09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhbiBpbnRlcmFjdGlvbiByZXNwb25zZVxyXG4gICAqIEF1dG9tYXRpY2FsbHkgcHJvY2Vzc2VzIG1lbnRpb25zIGluIGNvbnRlbnQgYW5kIGVtYmVkc1xyXG4gICAqL1xyXG4gIGFzeW5jIGNyZWF0ZUludGVyYWN0aW9uUmVzcG9uc2UoaW50ZXJhY3Rpb25JZDogc3RyaW5nLCB0b2tlbjogc3RyaW5nLCBkYXRhOiB7XHJcbiAgICB0eXBlOiBudW1iZXI7XHJcbiAgICBkYXRhPzogYW55O1xyXG4gIH0pOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnNvbGUubG9nKGDwn5OkIEludGVyYWN0aW9uIHJlc3BvbnNlOiAke2ludGVyYWN0aW9uSWR9IC0+IHR5cGUgJHtkYXRhLnR5cGV9YCk7XHJcbiAgICB0cnkge1xyXG4gICAgICAvLyBQcm9jZXNzIG1lbnRpb25zIGluIHJlc3BvbnNlIGRhdGEgaWYgcHJlc2VudFxyXG4gICAgICBsZXQgcHJvY2Vzc2VkRGF0YSA9IGRhdGE7XHJcbiAgICAgIGlmIChkYXRhLmRhdGEgJiYgKGRhdGEuZGF0YS5jb250ZW50IHx8IGRhdGEuZGF0YS5lbWJlZHMpKSB7XHJcbiAgICAgICAgcHJvY2Vzc2VkRGF0YSA9IHtcclxuICAgICAgICAgIC4uLmRhdGEsXHJcbiAgICAgICAgICBkYXRhOiB0aGlzLnByZXBhcmVNZXNzYWdlRGF0YShkYXRhLmRhdGEpXHJcbiAgICAgICAgfTtcclxuICAgICAgfVxyXG4gICAgICBcclxuICAgICAgYXdhaXQgdGhpcy5yZXF1ZXN0PHZvaWQ+KCdQT1NUJywgYC9pbnRlcmFjdGlvbnMvJHtpbnRlcmFjdGlvbklkfS8ke3Rva2VufS9jYWxsYmFja2AsIHByb2Nlc3NlZERhdGEpO1xyXG4gICAgICBjb25zb2xlLmxvZyhg4pyFIEludGVyYWN0aW9uIHJlc3BvbnNlIHNlbnRgKTtcclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoYOKdjCBJbnRlcmFjdGlvbiByZXNwb25zZSBlcnJvcjpgLCBlcnJvcik7XHJcbiAgICAgIHRocm93IGVycm9yO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRWRpdCB0aGUgb3JpZ2luYWwgaW50ZXJhY3Rpb24gcmVzcG9uc2VcclxuICAgKiBJZiBmaWxlcyBhcmUgcHJvdmlkZWQsIGNyZWF0ZXMgYSBuZXcgbWVzc2FnZSB3aXRoIGZpbGVzIChzaW5jZSB3ZWJob29rIGVkaXQgZG9lc24ndCBzdXBwb3J0IGZpbGUgdXBsb2FkKVxyXG4gICAqIEF1dG9tYXRpY2FsbHkgcHJvY2Vzc2VzIG1lbnRpb25zXHJcbiAgICovXHJcbiAgYXN5bmMgZWRpdEludGVyYWN0aW9uUmVzcG9uc2UodG9rZW46IHN0cmluZywgZGF0YToge1xyXG4gICAgY29udGVudD86IHN0cmluZztcclxuICAgIGVtYmVkcz86IEFQSUVtYmVkW107XHJcbiAgICBjb21wb25lbnRzPzogYW55W107XHJcbiAgICBtZW50aW9ucz86IE1lbnRpb25zRGF0YTtcclxuICAgIGZpbGVzPzogQXJyYXk8eyBuYW1lOiBzdHJpbmc7IGRhdGE6IEJ1ZmZlcjsgY29udGVudFR5cGU/OiBzdHJpbmcgfT47XHJcbiAgfSwgZ3VpbGRJZD86IHN0cmluZywgY2hhbm5lbElkPzogc3RyaW5nLCBpbnRlcmFjdGlvbklkPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBhcHBJZCA9IHRoaXMuZ2V0QXBwbGljYXRpb25JZCgpO1xyXG4gICAgXHJcbiAgICAvLyBQcm9jZXNzIG1lbnRpb25zIGluIGNvbnRlbnRcclxuICAgIGNvbnN0IHByb2Nlc3NlZERhdGEgPSB0aGlzLnByZXBhcmVNZXNzYWdlRGF0YShkYXRhKTtcclxuICAgIFxyXG4gICAgLy8gSWYgZmlsZXMgYXJlIHByZXNlbnQgYW5kIHdlIGhhdmUgZ3VpbGQvY2hhbm5lbCBpbmZvLCBjcmVhdGUgbWVzc2FnZSB3aXRoIGZpbGUgaW5zdGVhZFxyXG4gICAgaWYgKGRhdGEuZmlsZXMgJiYgZGF0YS5maWxlcy5sZW5ndGggPiAwICYmIGd1aWxkSWQgJiYgY2hhbm5lbElkKSB7XHJcbiAgICAgIGNvbnNvbGUubG9nKGBbUkVTVF0gZWRpdEludGVyYWN0aW9uUmVzcG9uc2Ugd2l0aCAke2RhdGEuZmlsZXMubGVuZ3RofSBmaWxlcyAtIHVzaW5nIGNyZWF0ZU1lc3NhZ2VXaXRoRmlsZWApO1xyXG4gICAgICBcclxuICAgICAgLy8gQ3JlYXRlIG1lc3NhZ2Ugd2l0aCBmaWxlXHJcbiAgICAgIGNvbnN0IGZpbGUgPSBkYXRhLmZpbGVzWzBdOyAvLyBGb3Igbm93LCBzdXBwb3J0IHNpbmdsZSBmaWxlXHJcbiAgICAgIGF3YWl0IHRoaXMuY3JlYXRlTWVzc2FnZVdpdGhGaWxlKGd1aWxkSWQsIGNoYW5uZWxJZCwge1xyXG4gICAgICAgIGNvbnRlbnQ6IHByb2Nlc3NlZERhdGEuY29udGVudCxcclxuICAgICAgICBmaWxlOiBmaWxlLFxyXG4gICAgICAgIGludGVyYWN0aW9uSWQ6IGludGVyYWN0aW9uSWRcclxuICAgICAgfSk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIFxyXG4gICAgLy8gSWYgd2UgaGF2ZSBndWlsZElkLCBjaGFubmVsSWQgYW5kIGludGVyYWN0aW9uSWQsIGNyZWF0ZSBhIG5ldyBtZXNzYWdlIHdpdGggaW50ZXJhY3Rpb25faWRcclxuICAgIC8vIFRoaXMgaXMgbmVlZGVkIGJlY2F1c2Ugb3VyIGRlZmVycmVkIHJlc3BvbnNlIGRvZXNuJ3QgY3JlYXRlIGEgbWVzc2FnZVxyXG4gICAgaWYgKGd1aWxkSWQgJiYgY2hhbm5lbElkICYmIGludGVyYWN0aW9uSWQpIHtcclxuICAgICAgY29uc29sZS5sb2coYFtSRVNUXSBlZGl0SW50ZXJhY3Rpb25SZXNwb25zZSAtIGNyZWF0aW5nIG1lc3NhZ2Ugd2l0aCBpbnRlcmFjdGlvbl9pZDogJHtpbnRlcmFjdGlvbklkfWApO1xyXG4gICAgICBcclxuICAgICAgY29uc3QgcGF5bG9hZDogYW55ID0ge1xyXG4gICAgICAgIGludGVyYWN0aW9uX2lkOiBpbnRlcmFjdGlvbklkXHJcbiAgICAgIH07XHJcbiAgICAgIGlmIChwcm9jZXNzZWREYXRhLmNvbnRlbnQgIT09IHVuZGVmaW5lZCkgcGF5bG9hZC5jb250ZW50ID0gcHJvY2Vzc2VkRGF0YS5jb250ZW50O1xyXG4gICAgICBpZiAocHJvY2Vzc2VkRGF0YS5lbWJlZHMpIHBheWxvYWQuZW1iZWRzID0gcHJvY2Vzc2VkRGF0YS5lbWJlZHM7XHJcbiAgICAgIGlmIChwcm9jZXNzZWREYXRhLmNvbXBvbmVudHMpIHBheWxvYWQuY29tcG9uZW50cyA9IHByb2Nlc3NlZERhdGEuY29tcG9uZW50cztcclxuICAgICAgaWYgKHByb2Nlc3NlZERhdGEubWVudGlvbnMpIHBheWxvYWQubWVudGlvbnMgPSBwcm9jZXNzZWREYXRhLm1lbnRpb25zO1xyXG4gICAgICBcclxuICAgICAgYXdhaXQgdGhpcy5yZXF1ZXN0PHZvaWQ+KCdQT1NUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vY2hhbm5lbHMvJHtjaGFubmVsSWR9L21lc3NhZ2VzYCwgcGF5bG9hZCk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIFxyXG4gICAgLy8gRmFsbGJhY2s6IFJlZ3VsYXIgZWRpdCB3aXRob3V0IGZpbGVzICh3ZWJob29rIFBBVENIKVxyXG4gICAgY29uc3QgcGF5bG9hZDogYW55ID0ge307XHJcbiAgICBpZiAocHJvY2Vzc2VkRGF0YS5jb250ZW50ICE9PSB1bmRlZmluZWQpIHBheWxvYWQuY29udGVudCA9IHByb2Nlc3NlZERhdGEuY29udGVudDtcclxuICAgIGlmIChwcm9jZXNzZWREYXRhLmVtYmVkcykgcGF5bG9hZC5lbWJlZHMgPSBwcm9jZXNzZWREYXRhLmVtYmVkcztcclxuICAgIGlmIChwcm9jZXNzZWREYXRhLmNvbXBvbmVudHMpIHBheWxvYWQuY29tcG9uZW50cyA9IHByb2Nlc3NlZERhdGEuY29tcG9uZW50cztcclxuICAgIGlmIChwcm9jZXNzZWREYXRhLm1lbnRpb25zKSBwYXlsb2FkLm1lbnRpb25zID0gcHJvY2Vzc2VkRGF0YS5tZW50aW9ucztcclxuICAgIFxyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0PHZvaWQ+KCdQQVRDSCcsIGAvaW50ZXJhY3Rpb25zL3dlYmhvb2tzLyR7YXBwSWR9LyR7dG9rZW59L21lc3NhZ2VzL0BvcmlnaW5hbGAsIHBheWxvYWQpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVsZXRlIHRoZSBvcmlnaW5hbCBpbnRlcmFjdGlvbiByZXNwb25zZVxyXG4gICAqL1xyXG4gIGFzeW5jIGRlbGV0ZUludGVyYWN0aW9uUmVzcG9uc2UodG9rZW46IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgYXBwSWQgPSB0aGlzLmdldEFwcGxpY2F0aW9uSWQoKTtcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdDx2b2lkPignREVMRVRFJywgYC9pbnRlcmFjdGlvbnMvd2ViaG9va3MvJHthcHBJZH0vJHt0b2tlbn0vbWVzc2FnZXMvQG9yaWdpbmFsYCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgYSBmb2xsb3d1cCBtZXNzYWdlXHJcbiAgICogQXV0b21hdGljYWxseSBwcm9jZXNzZXMgbWVudGlvbnNcclxuICAgKi9cclxuICBhc3luYyBjcmVhdGVGb2xsb3d1cCh0b2tlbjogc3RyaW5nLCBkYXRhOiB7XHJcbiAgICBjb250ZW50Pzogc3RyaW5nO1xyXG4gICAgZW1iZWRzPzogQVBJRW1iZWRbXTtcclxuICAgIG1lbnRpb25zPzogTWVudGlvbnNEYXRhO1xyXG4gICAgZmxhZ3M/OiBudW1iZXI7XHJcbiAgfSk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgYXBwSWQgPSB0aGlzLmdldEFwcGxpY2F0aW9uSWQoKTtcclxuICAgIGNvbnN0IHByb2Nlc3NlZERhdGEgPSB0aGlzLnByZXBhcmVNZXNzYWdlRGF0YShkYXRhKTtcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdDx2b2lkPignUE9TVCcsIGAvaW50ZXJhY3Rpb25zL3dlYmhvb2tzLyR7YXBwSWR9LyR7dG9rZW59YCwgcHJvY2Vzc2VkRGF0YSk7XHJcbiAgfVxyXG5cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PSBDb21tYW5kcyA9PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAvKipcclxuICAgKiBSZWdpc3RlciBnbG9iYWwgYXBwbGljYXRpb24gY29tbWFuZHNcclxuICAgKi9cclxuICBhc3luYyByZWdpc3Rlckdsb2JhbENvbW1hbmRzKGNvbW1hbmRzOiBBUElBcHBsaWNhdGlvbkNvbW1hbmRbXSk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgYXBwSWQgPSB0aGlzLmdldEFwcGxpY2F0aW9uSWQoKTtcclxuICAgIFxyXG4gICAgZm9yIChjb25zdCBjb21tYW5kIG9mIGNvbW1hbmRzKSB7XHJcbiAgICAgIGF3YWl0IHRoaXMucmVxdWVzdDx2b2lkPignUE9TVCcsIGAvYXBwbGljYXRpb25zLyR7YXBwSWR9L2NvbW1hbmRzYCwgY29tbWFuZCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZWdpc3RlciBndWlsZC1zcGVjaWZpYyBjb21tYW5kc1xyXG4gICAqL1xyXG4gIGFzeW5jIHJlZ2lzdGVyR3VpbGRDb21tYW5kcyhndWlsZElkOiBzdHJpbmcsIGNvbW1hbmRzOiBBUElBcHBsaWNhdGlvbkNvbW1hbmRbXSk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgYXBwSWQgPSB0aGlzLmdldEFwcGxpY2F0aW9uSWQoKTtcclxuICAgIFxyXG4gICAgZm9yIChjb25zdCBjb21tYW5kIG9mIGNvbW1hbmRzKSB7XHJcbiAgICAgIGF3YWl0IHRoaXMucmVxdWVzdDx2b2lkPignUE9TVCcsIGAvYXBwbGljYXRpb25zLyR7YXBwSWR9L2d1aWxkcy8ke2d1aWxkSWR9L2NvbW1hbmRzYCwgY29tbWFuZCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZWxldGUgYSBnbG9iYWwgY29tbWFuZFxyXG4gICAqL1xyXG4gIGFzeW5jIGRlbGV0ZUdsb2JhbENvbW1hbmQoY29tbWFuZElkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IGFwcElkID0gdGhpcy5nZXRBcHBsaWNhdGlvbklkKCk7XHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3Q8dm9pZD4oJ0RFTEVURScsIGAvYXBwbGljYXRpb25zLyR7YXBwSWR9L2NvbW1hbmRzLyR7Y29tbWFuZElkfWApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVsZXRlIGEgZ3VpbGQtc3BlY2lmaWMgY29tbWFuZFxyXG4gICAqL1xyXG4gIGFzeW5jIGRlbGV0ZUd1aWxkQ29tbWFuZChndWlsZElkOiBzdHJpbmcsIGNvbW1hbmRJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBhcHBJZCA9IHRoaXMuZ2V0QXBwbGljYXRpb25JZCgpO1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0PHZvaWQ+KCdERUxFVEUnLCBgL2FwcGxpY2F0aW9ucy8ke2FwcElkfS9ndWlsZHMvJHtndWlsZElkfS9jb21tYW5kcy8ke2NvbW1hbmRJZH1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIExpc3QgYWxsIGdsb2JhbCBjb21tYW5kcyBmb3IgdGhpcyBhcHBsaWNhdGlvblxyXG4gICAqL1xyXG4gIGFzeW5jIGxpc3RHbG9iYWxDb21tYW5kcygpOiBQcm9taXNlPEFQSUFwcGxpY2F0aW9uQ29tbWFuZFtdPiB7XHJcbiAgICBjb25zdCBhcHBJZCA9IHRoaXMuZ2V0QXBwbGljYXRpb25JZCgpO1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBUElBcHBsaWNhdGlvbkNvbW1hbmRbXT4oJ0dFVCcsIGAvYXBwbGljYXRpb25zLyR7YXBwSWR9L2NvbW1hbmRzYCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBMaXN0IGFsbCBndWlsZC1zcGVjaWZpYyBjb21tYW5kcyBmb3IgdGhpcyBhcHBsaWNhdGlvblxyXG4gICAqL1xyXG4gIGFzeW5jIGxpc3RHdWlsZENvbW1hbmRzKGd1aWxkSWQ6IHN0cmluZyk6IFByb21pc2U8QVBJQXBwbGljYXRpb25Db21tYW5kW10+IHtcclxuICAgIGNvbnN0IGFwcElkID0gdGhpcy5nZXRBcHBsaWNhdGlvbklkKCk7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PEFQSUFwcGxpY2F0aW9uQ29tbWFuZFtdPignR0VUJywgYC9hcHBsaWNhdGlvbnMvJHthcHBJZH0vZ3VpbGRzLyR7Z3VpbGRJZH0vY29tbWFuZHNgKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhIHNwZWNpZmljIGdsb2JhbCBjb21tYW5kXHJcbiAgICovXHJcbiAgYXN5bmMgZ2V0R2xvYmFsQ29tbWFuZChjb21tYW5kSWQ6IHN0cmluZyk6IFByb21pc2U8QVBJQXBwbGljYXRpb25Db21tYW5kPiB7XHJcbiAgICBjb25zdCBhcHBJZCA9IHRoaXMuZ2V0QXBwbGljYXRpb25JZCgpO1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBUElBcHBsaWNhdGlvbkNvbW1hbmQ+KCdHRVQnLCBgL2FwcGxpY2F0aW9ucy8ke2FwcElkfS9jb21tYW5kcy8ke2NvbW1hbmRJZH1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhIHNwZWNpZmljIGd1aWxkIGNvbW1hbmRcclxuICAgKi9cclxuICBhc3luYyBnZXRHdWlsZENvbW1hbmQoZ3VpbGRJZDogc3RyaW5nLCBjb21tYW5kSWQ6IHN0cmluZyk6IFByb21pc2U8QVBJQXBwbGljYXRpb25Db21tYW5kPiB7XHJcbiAgICBjb25zdCBhcHBJZCA9IHRoaXMuZ2V0QXBwbGljYXRpb25JZCgpO1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBUElBcHBsaWNhdGlvbkNvbW1hbmQ+KCdHRVQnLCBgL2FwcGxpY2F0aW9ucy8ke2FwcElkfS9ndWlsZHMvJHtndWlsZElkfS9jb21tYW5kcy8ke2NvbW1hbmRJZH1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFVwZGF0ZSBhIGdsb2JhbCBjb21tYW5kXHJcbiAgICovXHJcbiAgYXN5bmMgdXBkYXRlR2xvYmFsQ29tbWFuZChjb21tYW5kSWQ6IHN0cmluZywgZGF0YTogUGFydGlhbDxBUElBcHBsaWNhdGlvbkNvbW1hbmQ+KTogUHJvbWlzZTxBUElBcHBsaWNhdGlvbkNvbW1hbmQ+IHtcclxuICAgIGNvbnN0IGFwcElkID0gdGhpcy5nZXRBcHBsaWNhdGlvbklkKCk7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PEFQSUFwcGxpY2F0aW9uQ29tbWFuZD4oJ1BBVENIJywgYC9hcHBsaWNhdGlvbnMvJHthcHBJZH0vY29tbWFuZHMvJHtjb21tYW5kSWR9YCwgZGF0YSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBVcGRhdGUgYSBndWlsZC1zcGVjaWZpYyBjb21tYW5kXHJcbiAgICovXHJcbiAgYXN5bmMgdXBkYXRlR3VpbGRDb21tYW5kKGd1aWxkSWQ6IHN0cmluZywgY29tbWFuZElkOiBzdHJpbmcsIGRhdGE6IFBhcnRpYWw8QVBJQXBwbGljYXRpb25Db21tYW5kPik6IFByb21pc2U8QVBJQXBwbGljYXRpb25Db21tYW5kPiB7XHJcbiAgICBjb25zdCBhcHBJZCA9IHRoaXMuZ2V0QXBwbGljYXRpb25JZCgpO1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBUElBcHBsaWNhdGlvbkNvbW1hbmQ+KCdQQVRDSCcsIGAvYXBwbGljYXRpb25zLyR7YXBwSWR9L2d1aWxkcy8ke2d1aWxkSWR9L2NvbW1hbmRzLyR7Y29tbWFuZElkfWAsIGRhdGEpO1xyXG4gIH1cclxuXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT0gSGVscGVycyA9PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICBwcml2YXRlIGFwcGxpY2F0aW9uSWQ6IHN0cmluZyA9ICcnO1xyXG5cclxuICAvKipcclxuICAgKiBTZXQgdGhlIGFwcGxpY2F0aW9uIElEXHJcbiAgICovXHJcbiAgc2V0QXBwbGljYXRpb25JZChpZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICB0aGlzLmFwcGxpY2F0aW9uSWQgPSBpZDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCB0aGUgYXBwbGljYXRpb24gSURcclxuICAgKi9cclxuICBwcml2YXRlIGdldEFwcGxpY2F0aW9uSWQoKTogc3RyaW5nIHtcclxuICAgIGlmICghdGhpcy5hcHBsaWNhdGlvbklkKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcignQXBwbGljYXRpb24gSUQgbm90IHNldC4gQ2FsbCBzZXRBcHBsaWNhdGlvbklkKCkgZmlyc3QuJyk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGhpcy5hcHBsaWNhdGlvbklkO1xyXG4gIH1cclxuXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT0gQ2hhbm5lbHMgPT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgY2hhbm5lbCBpbiBhIGd1aWxkXHJcbiAgICovXHJcbiAgYXN5bmMgY3JlYXRlQ2hhbm5lbChndWlsZElkOiBzdHJpbmcsIGRhdGE6IHtcclxuICAgIG5hbWU6IHN0cmluZztcclxuICAgIHR5cGU/OiBudW1iZXI7XHJcbiAgICBwYXJlbnRfaWQ/OiBzdHJpbmcgfCBudWxsO1xyXG4gICAgY2F0ZWdvcnlfaWQ/OiBzdHJpbmcgfCBudWxsO1xyXG4gICAgcGVybWlzc2lvbl9vdmVyd3JpdGVzPzogQXJyYXk8e1xyXG4gICAgICBpZDogc3RyaW5nO1xyXG4gICAgICB0eXBlOiBudW1iZXI7XHJcbiAgICAgIGFsbG93Pzogc3RyaW5nO1xyXG4gICAgICBkZW55Pzogc3RyaW5nO1xyXG4gICAgfT47XHJcbiAgfSk6IFByb21pc2U8eyBpZDogc3RyaW5nOyBuYW1lOiBzdHJpbmcgfT4ge1xyXG4gICAgLy8gTWFwIHBhcmVudF9pZCB0byBjYXRlZ29yeV9pZCBmb3IgYmFja2VuZCBjb21wYXRpYmlsaXR5XHJcbiAgICBjb25zdCByZXF1ZXN0RGF0YTogYW55ID0ge1xyXG4gICAgICBuYW1lOiBkYXRhLm5hbWUsXHJcbiAgICAgIHR5cGU6IGRhdGEudHlwZSA/PyAwLCAvLyBEZWZhdWx0IHRvIHRleHQgY2hhbm5lbFxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgLy8gQmFja2VuZCBleHBlY3RzIGNhdGVnb3J5X2lkLCBub3QgcGFyZW50X2lkXHJcbiAgICBpZiAoZGF0YS5jYXRlZ29yeV9pZCkge1xyXG4gICAgICByZXF1ZXN0RGF0YS5jYXRlZ29yeV9pZCA9IGRhdGEuY2F0ZWdvcnlfaWQ7XHJcbiAgICB9IGVsc2UgaWYgKGRhdGEucGFyZW50X2lkKSB7XHJcbiAgICAgIHJlcXVlc3REYXRhLmNhdGVnb3J5X2lkID0gZGF0YS5wYXJlbnRfaWQ7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIEFkZCBwZXJtaXNzaW9uX292ZXJ3cml0ZXMgaWYgcHJvdmlkZWRcclxuICAgIGlmIChkYXRhLnBlcm1pc3Npb25fb3ZlcndyaXRlcyAmJiBkYXRhLnBlcm1pc3Npb25fb3ZlcndyaXRlcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgIHJlcXVlc3REYXRhLnBlcm1pc3Npb25fb3ZlcndyaXRlcyA9IGRhdGEucGVybWlzc2lvbl9vdmVyd3JpdGVzO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KCdQT1NUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vY2hhbm5lbHNgLCByZXF1ZXN0RGF0YSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZWxldGUgYSBjaGFubmVsXHJcbiAgICovXHJcbiAgLyoqXHJcbiAgICogRGVsZXRlIGEgY2hhbm5lbFxyXG4gICAqL1xyXG4gIGFzeW5jIGRlbGV0ZUNoYW5uZWwoZ3VpbGRJZDogc3RyaW5nLCBjaGFubmVsSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0KCdERUxFVEUnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlbGV0ZSBhIGNhdGVnb3J5XHJcbiAgICovXHJcbiAgYXN5bmMgZGVsZXRlQ2F0ZWdvcnkoZ3VpbGRJZDogc3RyaW5nLCBjYXRlZ29yeUlkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdCgnREVMRVRFJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vY2F0ZWdvcmllcy8ke2NhdGVnb3J5SWR9YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBFZGl0IGNoYW5uZWwgcGVybWlzc2lvbiBvdmVyd3JpdGVzXHJcbiAgICovXHJcbiAgYXN5bmMgZWRpdENoYW5uZWxQZXJtaXNzaW9ucyhjaGFubmVsSWQ6IHN0cmluZywgb3ZlcndyaXRlSWQ6IHN0cmluZywgZGF0YToge1xyXG4gICAgdHlwZTogbnVtYmVyO1xyXG4gICAgYWxsb3c/OiBzdHJpbmc7XHJcbiAgICBkZW55Pzogc3RyaW5nO1xyXG4gIH0pOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdCgnUFVUJywgYC9ib3QvY2hhbm5lbHMvJHtjaGFubmVsSWR9L3Blcm1pc3Npb25zLyR7b3ZlcndyaXRlSWR9YCwgZGF0YSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZWxldGUgY2hhbm5lbCBwZXJtaXNzaW9uIG92ZXJ3cml0ZVxyXG4gICAqL1xyXG4gIGFzeW5jIGRlbGV0ZUNoYW5uZWxQZXJtaXNzaW9uKGNoYW5uZWxJZDogc3RyaW5nLCBvdmVyd3JpdGVJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3QoJ0RFTEVURScsIGAvYm90L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS9wZXJtaXNzaW9ucy8ke292ZXJ3cml0ZUlkfWApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IG1lc3NhZ2VzIGZyb20gYSBjaGFubmVsXHJcbiAgICovXHJcbiAgYXN5bmMgZ2V0TWVzc2FnZXMoZ3VpbGRJZDogc3RyaW5nLCBjaGFubmVsSWQ6IHN0cmluZywgb3B0aW9ucz86IHtcclxuICAgIGxpbWl0PzogbnVtYmVyO1xyXG4gICAgYmVmb3JlPzogc3RyaW5nO1xyXG4gICAgYWZ0ZXI/OiBzdHJpbmc7XHJcbiAgfSk6IFByb21pc2U8QVBJTWVzc2FnZVtdPiB7XHJcbiAgICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKCk7XHJcbiAgICBpZiAob3B0aW9ucz8ubGltaXQpIHBhcmFtcy5hcHBlbmQoJ2xpbWl0JywgU3RyaW5nKG9wdGlvbnMubGltaXQpKTtcclxuICAgIGlmIChvcHRpb25zPy5iZWZvcmUpIHBhcmFtcy5hcHBlbmQoJ2JlZm9yZScsIG9wdGlvbnMuYmVmb3JlKTtcclxuICAgIGlmIChvcHRpb25zPy5hZnRlcikgcGFyYW1zLmFwcGVuZCgnYWZ0ZXInLCBvcHRpb25zLmFmdGVyKTtcclxuICAgIFxyXG4gICAgY29uc3QgcXVlcnkgPSBwYXJhbXMudG9TdHJpbmcoKSA/IGA/JHtwYXJhbXMudG9TdHJpbmcoKX1gIDogJyc7XHJcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMucmVxdWVzdDx7IG1lc3NhZ2VzOiBBUElNZXNzYWdlW107IHBhZ2VfaW5mbzogYW55IH0+KCdHRVQnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH0vbWVzc2FnZXMke3F1ZXJ5fWApO1xyXG4gICAgcmV0dXJuIHJlc3BvbnNlLm1lc3NhZ2VzIHx8IFtdO1xyXG4gIH1cclxuXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT0gTWVtYmVycyA9PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSBndWlsZCBtZW1iZXJcclxuICAgKi9cclxuICBhc3luYyBnZXRNZW1iZXIoZ3VpbGRJZDogc3RyaW5nLCB1c2VySWQ6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KCdHRVQnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9tZW1iZXJzLyR7dXNlcklkfWApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVGltZW91dCBhIGd1aWxkIG1lbWJlclxyXG4gICAqL1xyXG4gIGFzeW5jIHRpbWVvdXRNZW1iZXIoZ3VpbGRJZDogc3RyaW5nLCB1c2VySWQ6IHN0cmluZywgZHVyYXRpb246IG51bWJlciB8IG51bGwsIHJlYXNvbj86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgaWYgKGR1cmF0aW9uID09PSBudWxsKSB7XHJcbiAgICAgIC8vIENsZWFyIHRpbWVvdXRcclxuICAgICAgYXdhaXQgdGhpcy5yZXF1ZXN0KCdQT1NUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vbWVtYmVycy8ke3VzZXJJZH0vdGltZW91dC9jbGVhcmAsIHtcclxuICAgICAgICByZWFzb25cclxuICAgICAgfSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAvLyBTZXQgdGltZW91dFxyXG4gICAgICBjb25zdCB1bnRpbCA9IG5ldyBEYXRlKERhdGUubm93KCkgKyBkdXJhdGlvbikudG9JU09TdHJpbmcoKTtcclxuICAgICAgYXdhaXQgdGhpcy5yZXF1ZXN0KCdQT1NUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vbWVtYmVycy8ke3VzZXJJZH0vdGltZW91dGAsIHtcclxuICAgICAgICB1bnRpbCxcclxuICAgICAgICByZWFzb25cclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBLaWNrIGEgZ3VpbGQgbWVtYmVyXHJcbiAgICovXHJcbiAgYXN5bmMga2lja01lbWJlcihndWlsZElkOiBzdHJpbmcsIHVzZXJJZDogc3RyaW5nLCByZWFzb24/OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IHF1ZXJ5ID0gcmVhc29uID8gYD9yZWFzb249JHtlbmNvZGVVUklDb21wb25lbnQocmVhc29uKX1gIDogJyc7XHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3QoJ0RFTEVURScsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L21lbWJlcnMvJHt1c2VySWR9JHtxdWVyeX1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEJhbiBhIGd1aWxkIG1lbWJlclxyXG4gICAqL1xyXG4gIGFzeW5jIGJhbk1lbWJlcihndWlsZElkOiBzdHJpbmcsIHVzZXJJZDogc3RyaW5nLCBvcHRpb25zPzoge1xyXG4gICAgZGVsZXRlTWVzc2FnZURheXM/OiBudW1iZXI7XHJcbiAgICBkZWxldGVNZXNzYWdlU2Vjb25kcz86IG51bWJlcjtcclxuICAgIHJlYXNvbj86IHN0cmluZztcclxuICB9KTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3QoJ1BVVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2JhbnMvJHt1c2VySWR9YCwge1xyXG4gICAgICBkZWxldGVfbWVzc2FnZV9kYXlzOiBvcHRpb25zPy5kZWxldGVNZXNzYWdlRGF5cyxcclxuICAgICAgZGVsZXRlX21lc3NhZ2Vfc2Vjb25kczogb3B0aW9ucz8uZGVsZXRlTWVzc2FnZVNlY29uZHMsXHJcbiAgICAgIHJlYXNvbjogb3B0aW9ucz8ucmVhc29uXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFVuYmFuIGEgdXNlclxyXG4gICAqL1xyXG4gIGFzeW5jIHVuYmFuTWVtYmVyKGd1aWxkSWQ6IHN0cmluZywgdXNlcklkOiBzdHJpbmcsIHJlYXNvbj86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgcXVlcnkgPSByZWFzb24gPyBgP3JlYXNvbj0ke2VuY29kZVVSSUNvbXBvbmVudChyZWFzb24pfWAgOiAnJztcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdCgnREVMRVRFJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vYmFucy8ke3VzZXJJZH0ke3F1ZXJ5fWApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRWRpdCBhIGd1aWxkIG1lbWJlclxyXG4gICAqL1xyXG4gIGFzeW5jIGVkaXRNZW1iZXIoZ3VpbGRJZDogc3RyaW5nLCB1c2VySWQ6IHN0cmluZywgZGF0YToge1xyXG4gICAgbmljaz86IHN0cmluZyB8IG51bGw7XHJcbiAgICByb2xlcz86IHN0cmluZ1tdO1xyXG4gICAgbXV0ZT86IGJvb2xlYW47XHJcbiAgICBkZWFmPzogYm9vbGVhbjtcclxuICAgIGNoYW5uZWxfaWQ/OiBzdHJpbmcgfCBudWxsO1xyXG4gICAgY29tbXVuaWNhdGlvbl9kaXNhYmxlZF91bnRpbD86IHN0cmluZyB8IG51bGw7XHJcbiAgICByZWFzb24/OiBzdHJpbmc7XHJcbiAgfSk6IFByb21pc2U8YW55PiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KCdQQVRDSCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L21lbWJlcnMvJHt1c2VySWR9YCwgZGF0YSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBZGQgYSByb2xlIHRvIGEgbWVtYmVyXHJcbiAgICovXHJcbiAgYXN5bmMgYWRkTWVtYmVyUm9sZShndWlsZElkOiBzdHJpbmcsIHVzZXJJZDogc3RyaW5nLCByb2xlSWQ6IHN0cmluZywgcmVhc29uPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBxdWVyeSA9IHJlYXNvbiA/IGA/cmVhc29uPSR7ZW5jb2RlVVJJQ29tcG9uZW50KHJlYXNvbil9YCA6ICcnO1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0KCdQVVQnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9tZW1iZXJzLyR7dXNlcklkfS9yb2xlcy8ke3JvbGVJZH0ke3F1ZXJ5fWApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVtb3ZlIGEgcm9sZSBmcm9tIGEgbWVtYmVyXHJcbiAgICovXHJcbiAgYXN5bmMgcmVtb3ZlTWVtYmVyUm9sZShndWlsZElkOiBzdHJpbmcsIHVzZXJJZDogc3RyaW5nLCByb2xlSWQ6IHN0cmluZywgcmVhc29uPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBxdWVyeSA9IHJlYXNvbiA/IGA/cmVhc29uPSR7ZW5jb2RlVVJJQ29tcG9uZW50KHJlYXNvbil9YCA6ICcnO1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0KCdERUxFVEUnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9tZW1iZXJzLyR7dXNlcklkfS9yb2xlcy8ke3JvbGVJZH0ke3F1ZXJ5fWApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQnVsayBhc3NpZ24gcm9sZXMgdG8gbWVtYmVyc1xyXG4gICAqL1xyXG4gIGFzeW5jIGJ1bGtBc3NpZ25Sb2xlcyhndWlsZElkOiBzdHJpbmcsIGFzc2lnbm1lbnRzOiB7IHVzZXJfaWQ6IHN0cmluZzsgcm9sZV9pZHM6IHN0cmluZ1tdIH1bXSk6IFByb21pc2U8YW55PiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KCdQVVQnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9tZW1iZXJzL3JvbGVzL2Fzc2lnbmAsIHsgYXNzaWdubWVudHMgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBCdWxrIHJlbW92ZSByb2xlcyBmcm9tIG1lbWJlcnNcclxuICAgKi9cclxuICBhc3luYyBidWxrUmVtb3ZlUm9sZXMoZ3VpbGRJZDogc3RyaW5nLCByZW1vdmFsczogeyB1c2VyX2lkOiBzdHJpbmc7IHJvbGVfaWRzOiBzdHJpbmdbXSB9W10pOiBQcm9taXNlPGFueT4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCgnREVMRVRFJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vbWVtYmVycy9yb2xlcy9yZW1vdmVgLCB7IHJlbW92YWxzIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQnVsayBkZWxldGUgbWVzc2FnZXNcclxuICAgKi9cclxuICBhc3luYyBidWxrRGVsZXRlTWVzc2FnZXMoZ3VpbGRJZDogc3RyaW5nLCBjaGFubmVsSWQ6IHN0cmluZywgbWVzc2FnZUlkczogc3RyaW5nW10pOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdCgnUE9TVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS9tZXNzYWdlcy9idWxrLWRlbGV0ZWAsIHtcclxuICAgICAgbWVzc2FnZXM6IG1lc3NhZ2VJZHNcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT0gR3VpbGRzID09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhIGd1aWxkXHJcbiAgICovXHJcbiAgYXN5bmMgZ2V0R3VpbGQoZ3VpbGRJZDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoJ0dFVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgZ3VpbGQgY2hhbm5lbHNcclxuICAgKi9cclxuICBhc3luYyBnZXRHdWlsZENoYW5uZWxzKGd1aWxkSWQ6IHN0cmluZyk6IFByb21pc2U8YW55W10+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoJ0dFVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzYCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgZ3VpbGQgcm9sZXNcclxuICAgKi9cclxuICBhc3luYyBnZXRSb2xlcyhndWlsZElkOiBzdHJpbmcpOiBQcm9taXNlPGFueVtdPiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KCdHRVQnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9yb2xlc2ApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgcm9sZVxyXG4gICAqL1xyXG4gIGFzeW5jIGNyZWF0ZVJvbGUoZ3VpbGRJZDogc3RyaW5nLCBkYXRhOiB7XHJcbiAgICBuYW1lPzogc3RyaW5nO1xyXG4gICAgY29sb3I/OiBudW1iZXI7XHJcbiAgICBob2lzdD86IGJvb2xlYW47XHJcbiAgICBtZW50aW9uYWJsZT86IGJvb2xlYW47XHJcbiAgICBwZXJtaXNzaW9ucz86IHN0cmluZztcclxuICB9KTogUHJvbWlzZTxhbnk+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoJ1BPU1QnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9yb2xlc2AsIGRhdGEpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRWRpdCBhIHJvbGVcclxuICAgKi9cclxuICBhc3luYyBlZGl0Um9sZShndWlsZElkOiBzdHJpbmcsIHJvbGVJZDogc3RyaW5nLCBkYXRhOiB7XHJcbiAgICBuYW1lPzogc3RyaW5nO1xyXG4gICAgY29sb3I/OiBudW1iZXI7XHJcbiAgICBob2lzdD86IGJvb2xlYW47XHJcbiAgICBtZW50aW9uYWJsZT86IGJvb2xlYW47XHJcbiAgICBwZXJtaXNzaW9ucz86IHN0cmluZztcclxuICB9KTogUHJvbWlzZTxhbnk+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoJ1BBVENIJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vcm9sZXMvJHtyb2xlSWR9YCwgZGF0YSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZWxldGUgYSByb2xlXHJcbiAgICovXHJcbiAgYXN5bmMgZGVsZXRlUm9sZShndWlsZElkOiBzdHJpbmcsIHJvbGVJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3QoJ0RFTEVURScsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L3JvbGVzLyR7cm9sZUlkfWApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGd1aWxkIGVtb2ppc1xyXG4gICAqL1xyXG4gIGFzeW5jIGdldEVtb2ppcyhndWlsZElkOiBzdHJpbmcpOiBQcm9taXNlPGFueVtdPiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KCdHRVQnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9lbW9qaXNgKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBndWlsZCBiYW5zXHJcbiAgICovXHJcbiAgYXN5bmMgZ2V0QmFucyhndWlsZElkOiBzdHJpbmcpOiBQcm9taXNlPGFueVtdPiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KCdHRVQnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9iYW5zYCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSBzcGVjaWZpYyBiYW5cclxuICAgKi9cclxuICBhc3luYyBnZXRCYW4oZ3VpbGRJZDogc3RyaW5nLCB1c2VySWQ6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KCdHRVQnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9iYW5zLyR7dXNlcklkfWApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGd1aWxkIGludml0ZXNcclxuICAgKi9cclxuICBhc3luYyBnZXRHdWlsZEludml0ZXMoZ3VpbGRJZDogc3RyaW5nKTogUHJvbWlzZTxhbnlbXT4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCgnR0VUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vaW52aXRlc2ApO1xyXG4gIH1cclxuXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT0gUGlucyA9PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAvKipcclxuICAgKiBQaW4gYSBtZXNzYWdlXHJcbiAgICovXHJcbiAgYXN5bmMgcGluTWVzc2FnZShndWlsZElkOiBzdHJpbmcsIGNoYW5uZWxJZDogc3RyaW5nLCBtZXNzYWdlSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0KCdQVVQnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH0vcGlucy8ke21lc3NhZ2VJZH1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFVucGluIGEgbWVzc2FnZVxyXG4gICAqL1xyXG4gIGFzeW5jIHVucGluTWVzc2FnZShndWlsZElkOiBzdHJpbmcsIGNoYW5uZWxJZDogc3RyaW5nLCBtZXNzYWdlSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0KCdERUxFVEUnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH0vcGlucy8ke21lc3NhZ2VJZH1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBwaW5uZWQgbWVzc2FnZXNcclxuICAgKi9cclxuICBhc3luYyBnZXRQaW5uZWRNZXNzYWdlcyhndWlsZElkOiBzdHJpbmcsIGNoYW5uZWxJZDogc3RyaW5nKTogUHJvbWlzZTxBUElNZXNzYWdlW10+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoJ0dFVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS9waW5zYCk7XHJcbiAgfVxyXG5cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PSBVc2VycyA9PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSB1c2VyXHJcbiAgICovXHJcbiAgYXN5bmMgZ2V0VXNlcih1c2VySWQ6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KCdHRVQnLCBgL2JvdC91c2Vycy8ke3VzZXJJZH1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBjdXJyZW50IGJvdCB1c2VyXHJcbiAgICovXHJcbiAgYXN5bmMgZ2V0Q3VycmVudFVzZXIoKTogUHJvbWlzZTxhbnk+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoJ0dFVCcsIGAvYm90L3VzZXJzL0BtZWApO1xyXG4gIH1cclxuXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT0gSW52aXRlcyA9PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgYW4gaW52aXRlXHJcbiAgICovXHJcbiAgYXN5bmMgY3JlYXRlSW52aXRlKGd1aWxkSWQ6IHN0cmluZywgY2hhbm5lbElkOiBzdHJpbmcsIGRhdGE/OiB7XHJcbiAgICBtYXhfYWdlPzogbnVtYmVyO1xyXG4gICAgbWF4X3VzZXM/OiBudW1iZXI7XHJcbiAgICB0ZW1wb3Jhcnk/OiBib29sZWFuO1xyXG4gICAgdW5pcXVlPzogYm9vbGVhbjtcclxuICB9KTogUHJvbWlzZTxhbnk+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoJ1BPU1QnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH0vaW52aXRlc2AsIGRhdGEgfHwge30pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVsZXRlIGFuIGludml0ZVxyXG4gICAqL1xyXG4gIGFzeW5jIGRlbGV0ZUludml0ZShpbnZpdGVDb2RlOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdCgnREVMRVRFJywgYC9ib3QvaW52aXRlcy8ke2ludml0ZUNvZGV9YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYW4gaW52aXRlXHJcbiAgICovXHJcbiAgYXN5bmMgZ2V0SW52aXRlKGludml0ZUNvZGU6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KCdHRVQnLCBgL2JvdC9pbnZpdGVzLyR7aW52aXRlQ29kZX1gKTtcclxuICB9XHJcblxyXG4gIC8vID09PT09PT09PT09PT09PT09PT09IFdlYmhvb2tzID09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBjaGFubmVsIHdlYmhvb2tzXHJcbiAgICovXHJcbiAgYXN5bmMgZ2V0Q2hhbm5lbFdlYmhvb2tzKGd1aWxkSWQ6IHN0cmluZywgY2hhbm5lbElkOiBzdHJpbmcpOiBQcm9taXNlPGFueVtdPiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KCdHRVQnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH0vd2ViaG9va3NgKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBndWlsZCB3ZWJob29rc1xyXG4gICAqL1xyXG4gIGFzeW5jIGdldEd1aWxkV2ViaG9va3MoZ3VpbGRJZDogc3RyaW5nKTogUHJvbWlzZTxhbnlbXT4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCgnR0VUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vd2ViaG9va3NgKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIHdlYmhvb2tcclxuICAgKi9cclxuICBhc3luYyBjcmVhdGVXZWJob29rKGd1aWxkSWQ6IHN0cmluZywgY2hhbm5lbElkOiBzdHJpbmcsIGRhdGE6IHtcclxuICAgIG5hbWU6IHN0cmluZztcclxuICAgIGF2YXRhcj86IHN0cmluZztcclxuICB9KTogUHJvbWlzZTxhbnk+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoJ1BPU1QnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH0vd2ViaG9va3NgLCBkYXRhKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFVwZGF0ZSBhIHdlYmhvb2tcclxuICAgKi9cclxuICBhc3luYyB1cGRhdGVXZWJob29rKGd1aWxkSWQ6IHN0cmluZywgd2ViaG9va0lkOiBzdHJpbmcsIGRhdGE6IHtcclxuICAgIG5hbWU/OiBzdHJpbmc7XHJcbiAgICBhdmF0YXJfdXJsPzogc3RyaW5nO1xyXG4gIH0pOiBQcm9taXNlPGFueT4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCgnUEFUQ0gnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS93ZWJob29rcy8ke3dlYmhvb2tJZH1gLCBkYXRhKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlbGV0ZSBhIHdlYmhvb2tcclxuICAgKi9cclxuICBhc3luYyBkZWxldGVXZWJob29rKGd1aWxkSWQ6IHN0cmluZywgd2ViaG9va0lkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoJ0RFTEVURScsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L3dlYmhvb2tzLyR7d2ViaG9va0lkfWApO1xyXG4gIH1cclxufVxyXG4iXX0=