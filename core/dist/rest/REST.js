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
                // Normalize author.iconURL → author.icon_url
                if (processedEmbed.author) {
                    if (processedEmbed.author.iconURL && !processedEmbed.author.icon_url) {
                        processedEmbed.author = { ...processedEmbed.author, icon_url: processedEmbed.author.iconURL };
                        delete processedEmbed.author.iconURL;
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
     * Get guild members list (paginated)
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUkVTVC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9yZXN0L1JFU1QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBK0JBOztHQUVHO0FBQ0gsTUFBYSxJQUFJO0lBQ1AsT0FBTyxDQUFTO0lBQ2hCLEtBQUssR0FBVyxFQUFFLENBQUM7SUFFM0IscURBQXFEO0lBQzdDLFNBQVMsR0FBNEIsSUFBSSxHQUFHLEVBQUUsQ0FBQztJQUN0QyxjQUFjLEdBQUcsQ0FBQyxHQUFHLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQyxXQUFXO0lBRTVELFlBQVksVUFBa0IsbUNBQW1DO1FBQy9ELElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO0lBQ3pCLENBQUM7SUFFRCw0REFBNEQ7SUFFNUQ7OztPQUdHO0lBQ0gsU0FBUyxDQUFDLElBQTRGO1FBQ3BHLE1BQU0sTUFBTSxHQUFHLE9BQU8sSUFBSSxDQUFDLEVBQUUsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1FBQzdFLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRTtZQUN6QixFQUFFLEVBQUUsTUFBTTtZQUNWLFFBQVEsRUFBRSxJQUFJLENBQUMsUUFBUTtZQUN2QixXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVcsSUFBSSxJQUFJLENBQUMsWUFBWTtZQUNsRCxRQUFRLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTtTQUNyQixDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxVQUFVLENBQUMsS0FBb0c7UUFDN0csS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUM5QyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxhQUFh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QUFDLFFBQVEsRUFBRSxlQUFlLE9BQU8sYUFBYSxTQUFTLEVBQUUsQ0FBQyxDQUFDO0lBQ2hGLENBQUM7Q0FDRjtBQTduQ0Qsb0JBNm5DQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFQSU1lc3NhZ2UsIEFQSUFwcGxpY2F0aW9uQ29tbWFuZCwgQVBJRW1iZWQgfSBmcm9tICcuLi90eXBlcyc7XHJcblxyXG4vKipcclxuICogTWVudGlvbiBkYXRhIHN0cnVjdHVyZSBmb3Igb3VyIHN5c3RlbVxyXG4gKi9cclxuZXhwb3J0IGludGVyZmFjZSBNZW50aW9uVXNlciB7XHJcbiAgaWQ6IG51bWJlcjtcclxuICB1c2VybmFtZTogc3RyaW5nO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIE1lbnRpb25Sb2xlIHtcclxuICBpZDogc3RyaW5nO1xyXG4gIG5hbWU/OiBzdHJpbmc7XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgTWVudGlvbnNEYXRhIHtcclxuICB1c2Vycz86IE1lbnRpb25Vc2VyW107XHJcbiAgcm9sZXM/OiBNZW50aW9uUm9sZVtdO1xyXG4gIGV2ZXJ5b25lPzogYm9vbGVhbjtcclxufVxyXG5cclxuLyoqXHJcbiAqIFVzZXIgY2FjaGUgZW50cnlcclxuICovXHJcbmludGVyZmFjZSBDYWNoZWRVc2VyIHtcclxuICBpZDogbnVtYmVyO1xyXG4gIHVzZXJuYW1lOiBzdHJpbmc7XHJcbiAgZGlzcGxheU5hbWU/OiBzdHJpbmc7XHJcbiAgY2FjaGVkQXQ6IG51bWJlcjtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJFU1QgQVBJIGNsaWVudCBmb3IgSnViYmlvXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgUkVTVCB7XHJcbiAgcHJpdmF0ZSBiYXNlVXJsOiBzdHJpbmc7XHJcbiAgcHJpdmF0ZSB0b2tlbjogc3RyaW5nID0gJyc7XHJcbiAgXHJcbiAgLy8gVXNlciBjYWNoZSBmb3IgbWVudGlvbiByZXNvbHV0aW9uIChJRCAtPiB1c2VybmFtZSlcclxuICBwcml2YXRlIHVzZXJDYWNoZTogTWFwPG51bWJlciwgQ2FjaGVkVXNlcj4gPSBuZXcgTWFwKCk7XHJcbiAgcHJpdmF0ZSByZWFkb25seSBVU0VSX0NBQ0hFX1RUTCA9IDUgKiA2MCAqIDEwMDA7IC8vIDUgZGFraWthXHJcblxyXG4gIGNvbnN0cnVjdG9yKGJhc2VVcmw6IHN0cmluZyA9ICdodHRwczovL2dhdGV3YXkuanViYmlvLmNvbS9hcGkvdjEnKSB7XHJcbiAgICB0aGlzLmJhc2VVcmwgPSBiYXNlVXJsO1xyXG4gIH1cclxuXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT0gTWVudGlvbiBIZWxwZXJzID09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIC8qKlxyXG4gICAqIENhY2hlIGEgdXNlciBmb3IgbWVudGlvbiByZXNvbHV0aW9uXHJcbiAgICogQm90J2xhciBpbnRlcmFjdGlvbidkYW4gZ2VsZW4gdXNlciBiaWxnaXNpbmkgY2FjaGUnbGV5ZWJpbGlyXHJcbiAgICovXHJcbiAgY2FjaGVVc2VyKHVzZXI6IHsgaWQ6IHN0cmluZyB8IG51bWJlcjsgdXNlcm5hbWU6IHN0cmluZzsgZGlzcGxheU5hbWU/OiBzdHJpbmc7IGRpc3BsYXlfbmFtZT86IHN0cmluZyB9KTogdm9pZCB7XHJcbiAgICBjb25zdCB1c2VySWQgPSB0eXBlb2YgdXNlci5pZCA9PT0gJ3N0cmluZycgPyBwYXJzZUludCh1c2VyLmlkLCAxMCkgOiB1c2VyLmlkO1xyXG4gICAgdGhpcy51c2VyQ2FjaGUuc2V0KHVzZXJJZCwge1xyXG4gICAgICBpZDogdXNlcklkLFxyXG4gICAgICB1c2VybmFtZTogdXNlci51c2VybmFtZSxcclxuICAgICAgZGlzcGxheU5hbWU6IHVzZXIuZGlzcGxheU5hbWUgfHwgdXNlci5kaXNwbGF5X25hbWUsXHJcbiAgICAgIGNhY2hlZEF0OiBEYXRlLm5vdygpXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENhY2hlIG11bHRpcGxlIHVzZXJzXHJcbiAgICovXHJcbiAgY2FjaGVVc2Vycyh1c2VyczogQXJyYXk8eyBpZDogc3RyaW5nIHwgbnVtYmVyOyB1c2VybmFtZTogc3RyaW5nOyBkaXNwbGF5TmFtZT86IHN0cmluZzsgZGlzcGxheV9uYW1lPzogc3RyaW5nIH0+KTogdm9pZCB7XHJcbiAgICB1c2Vycy5mb3JFYWNoKHVzZXIgPT4gdGhpcy5jYWNoZVVzZXIodXNlcikpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGNhY2hlZCB1c2VyIGJ5IElEXHJcbiAgICovXHJcbiAgZ2V0Q2FjaGVkVXNlcih1c2VySWQ6IG51bWJlcik6IENhY2hlZFVzZXIgfCB1bmRlZmluZWQge1xyXG4gICAgY29uc3QgY2FjaGVkID0gdGhpcy51c2VyQ2FjaGUuZ2V0KHVzZXJJZCk7XHJcbiAgICBpZiAoY2FjaGVkICYmIERhdGUubm93KCkgLSBjYWNoZWQuY2FjaGVkQXQgPCB0aGlzLlVTRVJfQ0FDSEVfVFRMKSB7XHJcbiAgICAgIHJldHVybiBjYWNoZWQ7XHJcbiAgICB9XHJcbiAgICAvLyBFeHBpcmVkLCByZW1vdmUgZnJvbSBjYWNoZVxyXG4gICAgaWYgKGNhY2hlZCkge1xyXG4gICAgICB0aGlzLnVzZXJDYWNoZS5kZWxldGUodXNlcklkKTtcclxuICAgIH1cclxuICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBGb3JtYXQgYSB1c2VyIG1lbnRpb25cclxuICAgKiBSZXR1cm5zIGJvdGggdGhlIHRleHQgZm9ybWF0IGFuZCBtZW50aW9ucyBkYXRhXHJcbiAgICogXHJcbiAgICogQGV4YW1wbGVcclxuICAgKiBjb25zdCBtZW50aW9uID0gcmVzdC5mb3JtYXRNZW50aW9uKHVzZXIpO1xyXG4gICAqIC8vIG1lbnRpb24udGV4dCA9IFwiPEAxPlwiXHJcbiAgICogLy8gbWVudGlvbi5kYXRhID0geyB1c2VyczogW3sgaWQ6IDEsIHVzZXJuYW1lOiBcImlsa2F5XCIgfV0gfVxyXG4gICAqL1xyXG4gIGZvcm1hdE1lbnRpb24odXNlcjogeyBpZDogc3RyaW5nIHwgbnVtYmVyOyB1c2VybmFtZTogc3RyaW5nIH0pOiB7IHRleHQ6IHN0cmluZzsgZGF0YTogTWVudGlvbnNEYXRhIH0ge1xyXG4gICAgY29uc3QgdXNlcklkID0gdHlwZW9mIHVzZXIuaWQgPT09ICdzdHJpbmcnID8gcGFyc2VJbnQodXNlci5pZCwgMTApIDogdXNlci5pZDtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIHRleHQ6IGA8QCR7dXNlcklkfT5gLFxyXG4gICAgICBkYXRhOiB7XHJcbiAgICAgICAgdXNlcnM6IFt7IGlkOiB1c2VySWQsIHVzZXJuYW1lOiB1c2VyLnVzZXJuYW1lIH1dXHJcbiAgICAgIH1cclxuICAgIH07XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBQYXJzZSBtZW50aW9ucyAoPEBJRD4pIGluIGNvbnRlbnQgYW5kIGJ1aWxkIG1lbnRpb25zIGRhdGEgc3RydWN0dXJlXHJcbiAgICogQ29udGVudCBpcyBrZXB0IGFzLWlzIHdpdGggPEBJRD4gZm9ybWF0IChjbGllbnQgcmVuZGVycyB0aGVtKVxyXG4gICAqIFxyXG4gICAqIEBwYXJhbSBjb250ZW50IC0gTWVzc2FnZSBjb250ZW50IHdpdGggbWVudGlvbnNcclxuICAgKiBAcGFyYW0gZXhpc3RpbmdNZW50aW9ucyAtIEV4aXN0aW5nIG1lbnRpb25zIGRhdGEgdG8gbWVyZ2Ugd2l0aFxyXG4gICAqIEByZXR1cm5zIE9yaWdpbmFsIGNvbnRlbnQgYW5kIG1lbnRpb25zIGRhdGFcclxuICAgKi9cclxuICBwcml2YXRlIHByb2Nlc3NNZW50aW9ucyhjb250ZW50OiBzdHJpbmcsIGV4aXN0aW5nTWVudGlvbnM/OiBNZW50aW9uc0RhdGEpOiB7IGNvbnRlbnQ6IHN0cmluZzsgbWVudGlvbnM6IE1lbnRpb25zRGF0YSB9IHtcclxuICAgIGNvbnN0IG1lbnRpb25zOiBNZW50aW9uc0RhdGEgPSB7XHJcbiAgICAgIHVzZXJzOiBbLi4uKGV4aXN0aW5nTWVudGlvbnM/LnVzZXJzIHx8IFtdKV0sXHJcbiAgICAgIHJvbGVzOiBbLi4uKGV4aXN0aW5nTWVudGlvbnM/LnJvbGVzIHx8IFtdKV0sXHJcbiAgICAgIGV2ZXJ5b25lOiBleGlzdGluZ01lbnRpb25zPy5ldmVyeW9uZVxyXG4gICAgfTtcclxuXHJcbiAgICAvLyBUcmFjayBhbHJlYWR5IGFkZGVkIHVzZXIgSURzIHRvIGF2b2lkIGR1cGxpY2F0ZXNcclxuICAgIGNvbnN0IGFkZGVkVXNlcklkcyA9IG5ldyBTZXQobWVudGlvbnMudXNlcnM/Lm1hcCh1ID0+IHUuaWQpIHx8IFtdKTtcclxuXHJcbiAgICAvLyBQYXJzZSA8QElEPiBmb3JtYXQgKHVzZXIgbWVudGlvbnMpIOKAlCBrZWVwIGNvbnRlbnQgYXMtaXMsIG9ubHkgYnVpbGQgbWVudGlvbnMgZGF0YVxyXG4gICAgY29uc3QgdXNlck1lbnRpb25SZWdleCA9IC88QCE/KFxcZCspPi9nO1xyXG4gICAgbGV0IG1hdGNoO1xyXG5cclxuICAgIHdoaWxlICgobWF0Y2ggPSB1c2VyTWVudGlvblJlZ2V4LmV4ZWMoY29udGVudCkpICE9PSBudWxsKSB7XHJcbiAgICAgIGNvbnN0IHVzZXJJZCA9IHBhcnNlSW50KG1hdGNoWzFdLCAxMCk7XHJcblxyXG4gICAgICBpZiAoIWFkZGVkVXNlcklkcy5oYXModXNlcklkKSkge1xyXG4gICAgICAgIC8vIFRyeSB0byBnZXQgdXNlcm5hbWUgZnJvbSBjYWNoZSBmb3IgbWVudGlvbnMgZGF0YVxyXG4gICAgICAgIGNvbnN0IGNhY2hlZFVzZXIgPSB0aGlzLmdldENhY2hlZFVzZXIodXNlcklkKTtcclxuICAgICAgICBtZW50aW9ucy51c2VycyEucHVzaCh7IGlkOiB1c2VySWQsIHVzZXJuYW1lOiBjYWNoZWRVc2VyPy51c2VybmFtZSB8fCBgVXNlcl8ke3VzZXJJZH1gIH0pO1xyXG4gICAgICAgIGFkZGVkVXNlcklkcy5hZGQodXNlcklkKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIFBhcnNlIDxAJklEPiBmb3JtYXQgKHJvbGUgbWVudGlvbnMpIOKAlCBrZWVwIGNvbnRlbnQgYXMtaXNcclxuICAgIGNvbnN0IHJvbGVNZW50aW9uUmVnZXggPSAvPEAmKFxcZCspPi9nO1xyXG4gICAgY29uc3QgYWRkZWRSb2xlSWRzID0gbmV3IFNldChtZW50aW9ucy5yb2xlcz8ubWFwKHIgPT4gci5pZCkgfHwgW10pO1xyXG5cclxuICAgIHdoaWxlICgobWF0Y2ggPSByb2xlTWVudGlvblJlZ2V4LmV4ZWMoY29udGVudCkpICE9PSBudWxsKSB7XHJcbiAgICAgIGNvbnN0IHJvbGVJZCA9IG1hdGNoWzFdO1xyXG4gICAgICBpZiAoIWFkZGVkUm9sZUlkcy5oYXMocm9sZUlkKSkge1xyXG4gICAgICAgIG1lbnRpb25zLnJvbGVzIS5wdXNoKHsgaWQ6IHJvbGVJZCB9KTtcclxuICAgICAgICBhZGRlZFJvbGVJZHMuYWRkKHJvbGVJZCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyBQYXJzZSBAZXZlcnlvbmUgYW5kIEBoZXJlXHJcbiAgICBpZiAoY29udGVudC5pbmNsdWRlcygnQGV2ZXJ5b25lJykpIHtcclxuICAgICAgbWVudGlvbnMuZXZlcnlvbmUgPSB0cnVlO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIENsZWFuIHVwIGVtcHR5IGFycmF5c1xyXG4gICAgaWYgKG1lbnRpb25zLnVzZXJzPy5sZW5ndGggPT09IDApIGRlbGV0ZSBtZW50aW9ucy51c2VycztcclxuICAgIGlmIChtZW50aW9ucy5yb2xlcz8ubGVuZ3RoID09PSAwKSBkZWxldGUgbWVudGlvbnMucm9sZXM7XHJcblxyXG4gICAgcmV0dXJuIHsgY29udGVudCwgbWVudGlvbnMgfTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFByZXBhcmUgbWVzc2FnZSBkYXRhIHdpdGggcHJvY2Vzc2VkIG1lbnRpb25zXHJcbiAgICogQXV0b21hdGljYWxseSBjb252ZXJ0cyBtZW50aW9ucyB0byBvdXIgZm9ybWF0XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBwcmVwYXJlTWVzc2FnZURhdGEoZGF0YToge1xyXG4gICAgY29udGVudD86IHN0cmluZztcclxuICAgIGVtYmVkcz86IEFQSUVtYmVkW107XHJcbiAgICBjb21wb25lbnRzPzogYW55W107XHJcbiAgICBtZW50aW9ucz86IE1lbnRpb25zRGF0YTtcclxuICAgIG1lc3NhZ2VfcmVmZXJlbmNlPzogeyBtZXNzYWdlX2lkOiBzdHJpbmcgfTtcclxuICB9KTogYW55IHtcclxuICAgIGNvbnN0IHJlc3VsdDogYW55ID0geyAuLi5kYXRhIH07XHJcblxyXG4gICAgLy8gUmVzb2x2ZSBjb21wb25lbnRzIChBY3Rpb25Sb3dCdWlsZGVyIC8gQnV0dG9uQnVpbGRlciBpbnN0YW5jZXMpXHJcbiAgICBpZiAoZGF0YS5jb21wb25lbnRzICYmIGRhdGEuY29tcG9uZW50cy5sZW5ndGggPiAwKSB7XHJcbiAgICAgIHJlc3VsdC5jb21wb25lbnRzID0gZGF0YS5jb21wb25lbnRzLm1hcCgoYzogYW55KSA9PlxyXG4gICAgICAgIHR5cGVvZiBjLnRvSlNPTiA9PT0gJ2Z1bmN0aW9uJyA/IGMudG9KU09OKCkgOiBjXHJcbiAgICAgICk7XHJcbiAgICB9XHJcblxyXG4gICAgbGV0IGFsbE1lbnRpb25zOiBNZW50aW9uc0RhdGEgPSB7IC4uLmRhdGEubWVudGlvbnMgfTtcclxuXHJcbiAgICAvLyBQcm9jZXNzIG1lbnRpb25zIGluIGNvbnRlbnQgaWYgcHJlc2VudFxyXG4gICAgaWYgKGRhdGEuY29udGVudCkge1xyXG4gICAgICBjb25zdCB7IGNvbnRlbnQsIG1lbnRpb25zIH0gPSB0aGlzLnByb2Nlc3NNZW50aW9ucyhkYXRhLmNvbnRlbnQsIGFsbE1lbnRpb25zKTtcclxuICAgICAgcmVzdWx0LmNvbnRlbnQgPSBjb250ZW50O1xyXG4gICAgICBhbGxNZW50aW9ucyA9IG1lbnRpb25zO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIFByb2Nlc3MgbWVudGlvbnMgaW4gZW1iZWRzIChkZXNjcmlwdGlvbiwgdGl0bGUsIGZvb3RlciwgZmllbGRzKVxyXG4gICAgaWYgKGRhdGEuZW1iZWRzICYmIGRhdGEuZW1iZWRzLmxlbmd0aCA+IDApIHtcclxuICAgICAgcmVzdWx0LmVtYmVkcyA9IGRhdGEuZW1iZWRzLm1hcChlbWJlZCA9PiB7XHJcbiAgICAgICAgLy8gU3VwcG9ydCBFbWJlZEJ1aWxkZXIgaW5zdGFuY2VzIC0gZXh0cmFjdCByYXcgZGF0YSB2aWEgdG9KU09OKClcclxuICAgICAgICBjb25zdCByYXdFbWJlZCA9IHR5cGVvZiAoZW1iZWQgYXMgYW55KS50b0pTT04gPT09ICdmdW5jdGlvbicgPyAoZW1iZWQgYXMgYW55KS50b0pTT04oKSA6IGVtYmVkO1xyXG4gICAgICAgIGNvbnN0IHByb2Nlc3NlZEVtYmVkOiBhbnkgPSB7IC4uLnJhd0VtYmVkIH07XHJcblxyXG4gICAgICAgIC8vIE5vcm1hbGl6ZSB0aHVtYm5haWw6IHN0cmluZyDihpIgeyB1cmw6IHN0cmluZyB9XHJcbiAgICAgICAgaWYgKHR5cGVvZiBwcm9jZXNzZWRFbWJlZC50aHVtYm5haWwgPT09ICdzdHJpbmcnKSB7XHJcbiAgICAgICAgICBwcm9jZXNzZWRFbWJlZC50aHVtYm5haWwgPSB7IHVybDogcHJvY2Vzc2VkRW1iZWQudGh1bWJuYWlsIH07XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBOb3JtYWxpemUgaW1hZ2U6IHN0cmluZyDihpIgeyB1cmw6IHN0cmluZyB9XHJcbiAgICAgICAgaWYgKHR5cGVvZiBwcm9jZXNzZWRFbWJlZC5pbWFnZSA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgICAgIHByb2Nlc3NlZEVtYmVkLmltYWdlID0geyB1cmw6IHByb2Nlc3NlZEVtYmVkLmltYWdlIH07XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBOb3JtYWxpemUgY29sb3I6IGhleCBzdHJpbmcg4oaSIG51bWJlclxyXG4gICAgICAgIGlmICh0eXBlb2YgcHJvY2Vzc2VkRW1iZWQuY29sb3IgPT09ICdzdHJpbmcnKSB7XHJcbiAgICAgICAgICBwcm9jZXNzZWRFbWJlZC5jb2xvciA9IHBhcnNlSW50KHByb2Nlc3NlZEVtYmVkLmNvbG9yLnJlcGxhY2UoJyMnLCAnJyksIDE2KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIE5vcm1hbGl6ZSB0aW1lc3RhbXA6IERhdGUg4oaSIElTTyBzdHJpbmdcclxuICAgICAgICBpZiAocHJvY2Vzc2VkRW1iZWQudGltZXN0YW1wIGluc3RhbmNlb2YgRGF0ZSkge1xyXG4gICAgICAgICAgcHJvY2Vzc2VkRW1iZWQudGltZXN0YW1wID0gcHJvY2Vzc2VkRW1iZWQudGltZXN0YW1wLnRvSVNPU3RyaW5nKCk7XHJcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgcHJvY2Vzc2VkRW1iZWQudGltZXN0YW1wID09PSAnbnVtYmVyJykge1xyXG4gICAgICAgICAgcHJvY2Vzc2VkRW1iZWQudGltZXN0YW1wID0gbmV3IERhdGUocHJvY2Vzc2VkRW1iZWQudGltZXN0YW1wKS50b0lTT1N0cmluZygpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gTm9ybWFsaXplIGZvb3Rlci5pY29uVVJMIOKGkiBmb290ZXIuaWNvbl91cmxcclxuICAgICAgICBpZiAocHJvY2Vzc2VkRW1iZWQuZm9vdGVyKSB7XHJcbiAgICAgICAgICBpZiAocHJvY2Vzc2VkRW1iZWQuZm9vdGVyLmljb25VUkwgJiYgIXByb2Nlc3NlZEVtYmVkLmZvb3Rlci5pY29uX3VybCkge1xyXG4gICAgICAgICAgICBwcm9jZXNzZWRFbWJlZC5mb290ZXIgPSB7IC4uLnByb2Nlc3NlZEVtYmVkLmZvb3RlciwgaWNvbl91cmw6IHByb2Nlc3NlZEVtYmVkLmZvb3Rlci5pY29uVVJMIH07XHJcbiAgICAgICAgICAgIGRlbGV0ZSBwcm9jZXNzZWRFbWJlZC5mb290ZXIuaWNvblVSTDtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIE5vcm1hbGl6ZSBhdXRob3IuaWNvblVSTCDihpIgYXV0aG9yLmljb25fdXJsXHJcbiAgICAgICAgaWYgKHByb2Nlc3NlZEVtYmVkLmF1dGhvcikge1xyXG4gICAgICAgICAgaWYgKHByb2Nlc3NlZEVtYmVkLmF1dGhvci5pY29uVVJMICYmICFwcm9jZXNzZWRFbWJlZC5hdXRob3IuaWNvbl91cmwpIHtcclxuICAgICAgICAgICAgcHJvY2Vzc2VkRW1iZWQuYXV0aG9yID0geyAuLi5wcm9jZXNzZWRFbWJlZC5hdXRob3IsIGljb25fdXJsOiBwcm9jZXNzZWRFbWJlZC5hdXRob3IuaWNvblVSTCB9O1xyXG4gICAgICAgICAgICBkZWxldGUgcHJvY2Vzc2VkRW1iZWQuYXV0aG9yLmljb25VUkw7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIFByb2Nlc3MgZGVzY3JpcHRpb25cclxuICAgICAgICBpZiAocmF3RW1iZWQuZGVzY3JpcHRpb24pIHtcclxuICAgICAgICAgIGNvbnN0IHsgY29udGVudCwgbWVudGlvbnMgfSA9IHRoaXMucHJvY2Vzc01lbnRpb25zKHJhd0VtYmVkLmRlc2NyaXB0aW9uLCBhbGxNZW50aW9ucyk7XHJcbiAgICAgICAgICBwcm9jZXNzZWRFbWJlZC5kZXNjcmlwdGlvbiA9IGNvbnRlbnQ7XHJcbiAgICAgICAgICBhbGxNZW50aW9ucyA9IG1lbnRpb25zO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICAvLyBQcm9jZXNzIHRpdGxlXHJcbiAgICAgICAgaWYgKHJhd0VtYmVkLnRpdGxlKSB7XHJcbiAgICAgICAgICBjb25zdCB7IGNvbnRlbnQsIG1lbnRpb25zIH0gPSB0aGlzLnByb2Nlc3NNZW50aW9ucyhyYXdFbWJlZC50aXRsZSwgYWxsTWVudGlvbnMpO1xyXG4gICAgICAgICAgcHJvY2Vzc2VkRW1iZWQudGl0bGUgPSBjb250ZW50O1xyXG4gICAgICAgICAgYWxsTWVudGlvbnMgPSBtZW50aW9ucztcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gUHJvY2VzcyBmb290ZXIgdGV4dFxyXG4gICAgICAgIGlmIChyYXdFbWJlZC5mb290ZXI/LnRleHQpIHtcclxuICAgICAgICAgIGNvbnN0IHsgY29udGVudCwgbWVudGlvbnMgfSA9IHRoaXMucHJvY2Vzc01lbnRpb25zKHJhd0VtYmVkLmZvb3Rlci50ZXh0LCBhbGxNZW50aW9ucyk7XHJcbiAgICAgICAgICBwcm9jZXNzZWRFbWJlZC5mb290ZXIgPSB7IC4uLnJhd0VtYmVkLmZvb3RlciwgdGV4dDogY29udGVudCB9O1xyXG4gICAgICAgICAgYWxsTWVudGlvbnMgPSBtZW50aW9ucztcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gUHJvY2VzcyBmaWVsZHNcclxuICAgICAgICBpZiAocmF3RW1iZWQuZmllbGRzICYmIHJhd0VtYmVkLmZpZWxkcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICBwcm9jZXNzZWRFbWJlZC5maWVsZHMgPSByYXdFbWJlZC5maWVsZHMubWFwKChmaWVsZDogYW55KSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IHByb2Nlc3NlZEZpZWxkOiBhbnkgPSB7IC4uLmZpZWxkIH07XHJcbiAgICAgICAgICAgIGlmIChmaWVsZC52YWx1ZSkge1xyXG4gICAgICAgICAgICAgIGNvbnN0IHsgY29udGVudCwgbWVudGlvbnMgfSA9IHRoaXMucHJvY2Vzc01lbnRpb25zKGZpZWxkLnZhbHVlLCBhbGxNZW50aW9ucyk7XHJcbiAgICAgICAgICAgICAgcHJvY2Vzc2VkRmllbGQudmFsdWUgPSBjb250ZW50O1xyXG4gICAgICAgICAgICAgIGFsbE1lbnRpb25zID0gbWVudGlvbnM7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKGZpZWxkLm5hbWUpIHtcclxuICAgICAgICAgICAgICBjb25zdCB7IGNvbnRlbnQsIG1lbnRpb25zIH0gPSB0aGlzLnByb2Nlc3NNZW50aW9ucyhmaWVsZC5uYW1lLCBhbGxNZW50aW9ucyk7XHJcbiAgICAgICAgICAgICAgcHJvY2Vzc2VkRmllbGQubmFtZSA9IGNvbnRlbnQ7XHJcbiAgICAgICAgICAgICAgYWxsTWVudGlvbnMgPSBtZW50aW9ucztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gcHJvY2Vzc2VkRmllbGQ7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHByb2Nlc3NlZEVtYmVkO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBBZGQgbWVyZ2VkIG1lbnRpb25zIHRvIHJlc3VsdFxyXG4gICAgaWYgKGFsbE1lbnRpb25zLnVzZXJzPy5sZW5ndGggfHwgYWxsTWVudGlvbnMucm9sZXM/Lmxlbmd0aCB8fCBhbGxNZW50aW9ucy5ldmVyeW9uZSkge1xyXG4gICAgICByZXN1bHQubWVudGlvbnMgPSBhbGxNZW50aW9ucztcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2V0IHRoZSBib3QgdG9rZW5cclxuICAgKi9cclxuICBzZXRUb2tlbih0b2tlbjogc3RyaW5nKTogdGhpcyB7XHJcbiAgICB0aGlzLnRva2VuID0gdG9rZW47XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIE1ha2UgYW4gYXV0aGVudGljYXRlZCByZXF1ZXN0XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBhc3luYyByZXF1ZXN0PFQ+KG1ldGhvZDogc3RyaW5nLCBwYXRoOiBzdHJpbmcsIGJvZHk/OiBhbnkpOiBQcm9taXNlPFQ+IHtcclxuICAgIGNvbnN0IHVybCA9IGAke3RoaXMuYmFzZVVybH0ke3BhdGh9YDtcclxuICAgIFxyXG4gICAgLy8gRGVidWcgbG9nXHJcbiAgICBjb25zb2xlLmxvZyhgW1JFU1RdICR7bWV0aG9kfSAke3VybH1gLCBib2R5ID8gSlNPTi5zdHJpbmdpZnkoYm9keSkgOiAnJyk7XHJcbiAgICBcclxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godXJsLCB7XHJcbiAgICAgIG1ldGhvZCxcclxuICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgICdBdXRob3JpemF0aW9uJzogYEJvdCAke3RoaXMudG9rZW59YCxcclxuICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nXHJcbiAgICAgIH0sXHJcbiAgICAgIGJvZHk6IGJvZHkgPyBKU09OLnN0cmluZ2lmeShib2R5KSA6IHVuZGVmaW5lZFxyXG4gICAgfSk7XHJcblxyXG4gICAgaWYgKCFyZXNwb25zZS5vaykge1xyXG4gICAgICBjb25zdCBlcnJvciA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKTtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBBUEkgRXJyb3IgJHtyZXNwb25zZS5zdGF0dXN9OiAke2Vycm9yfWApO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIEhhbmRsZSBlbXB0eSByZXNwb25zZXNcclxuICAgIGNvbnN0IHRleHQgPSBhd2FpdCByZXNwb25zZS50ZXh0KCk7XHJcbiAgICBpZiAoIXRleHQpIHJldHVybiB7fSBhcyBUO1xyXG4gICAgXHJcbiAgICByZXR1cm4gSlNPTi5wYXJzZSh0ZXh0KTtcclxuICB9XHJcblxyXG4gIC8vID09PT09PT09PT09PT09PT09PT09IE1lc3NhZ2VzID09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIG1lc3NhZ2UgaW4gYSBjaGFubmVsXHJcbiAgICogTWVudGlvbnMgdXNlIDxASUQ+IGZvcm1hdCBhbmQgYXJlIGtlcHQgYXMtaXMgKGNsaWVudCByZW5kZXJzIHRoZW0pXHJcbiAgICogXHJcbiAgICogQGV4YW1wbGVcclxuICAgKiBhd2FpdCByZXN0LmNyZWF0ZU1lc3NhZ2UoZ3VpbGRJZCwgY2hhbm5lbElkLCB7XHJcbiAgICogICBjb250ZW50OiAnSGVsbG8gPEAxMjM+IScsXHJcbiAgICogfSk7XHJcbiAgICovXHJcbiAgYXN5bmMgY3JlYXRlTWVzc2FnZShndWlsZElkT3JDaGFubmVsSWQ6IHN0cmluZywgY2hhbm5lbElkT3JEYXRhOiBzdHJpbmcgfCB7XHJcbiAgICBjb250ZW50Pzogc3RyaW5nO1xyXG4gICAgZW1iZWRzPzogQVBJRW1iZWRbXTtcclxuICAgIGNvbXBvbmVudHM/OiBhbnlbXTtcclxuICAgIG1lbnRpb25zPzogTWVudGlvbnNEYXRhO1xyXG4gICAgZmlsZXM/OiBBcnJheTx7IG5hbWU6IHN0cmluZzsgZGF0YTogQnVmZmVyIH0+O1xyXG4gICAgbWVzc2FnZV9yZWZlcmVuY2U/OiB7IG1lc3NhZ2VfaWQ6IHN0cmluZyB9O1xyXG4gICAgaW50ZXJhY3Rpb25JZD86IHN0cmluZztcclxuICB9LCBkYXRhPzoge1xyXG4gICAgY29udGVudD86IHN0cmluZztcclxuICAgIGVtYmVkcz86IEFQSUVtYmVkW107XHJcbiAgICBjb21wb25lbnRzPzogYW55W107XHJcbiAgICBtZW50aW9ucz86IE1lbnRpb25zRGF0YTtcclxuICAgIGZpbGVzPzogQXJyYXk8eyBuYW1lOiBzdHJpbmc7IGRhdGE6IEJ1ZmZlciB9PjtcclxuICAgIG1lc3NhZ2VfcmVmZXJlbmNlPzogeyBtZXNzYWdlX2lkOiBzdHJpbmcgfTtcclxuICAgIGludGVyYWN0aW9uSWQ/OiBzdHJpbmc7XHJcbiAgfSk6IFByb21pc2U8QVBJTWVzc2FnZT4ge1xyXG4gICAgLy8gxLBraSBrdWxsYW7EsW0gxZ9la2xpOlxyXG4gICAgLy8gMS4gY3JlYXRlTWVzc2FnZShndWlsZElkLCBjaGFubmVsSWQsIGRhdGEpIC0gZ3VpbGRJZCBpbGUgKHRlcmNpaCBlZGlsZW4pXHJcbiAgICAvLyAyLiBjcmVhdGVNZXNzYWdlKGNoYW5uZWxJZCwgZGF0YSkgLSBndWlsZElkIG9sbWFkYW4gKGVza2kgZm9ybWF0LCBoYXRhIHZlcmlyKVxyXG4gICAgXHJcbiAgICBsZXQgZ3VpbGRJZDogc3RyaW5nO1xyXG4gICAgbGV0IGNoYW5uZWxJZDogc3RyaW5nO1xyXG4gICAgbGV0IG1lc3NhZ2VEYXRhOiBhbnk7XHJcbiAgICBcclxuICAgIGlmICh0eXBlb2YgY2hhbm5lbElkT3JEYXRhID09PSAnc3RyaW5nJyAmJiBkYXRhKSB7XHJcbiAgICAgIC8vIFllbmkgZm9ybWF0OiBjcmVhdGVNZXNzYWdlKGd1aWxkSWQsIGNoYW5uZWxJZCwgZGF0YSlcclxuICAgICAgZ3VpbGRJZCA9IGd1aWxkSWRPckNoYW5uZWxJZDtcclxuICAgICAgY2hhbm5lbElkID0gY2hhbm5lbElkT3JEYXRhO1xyXG4gICAgICBtZXNzYWdlRGF0YSA9IHRoaXMucHJlcGFyZU1lc3NhZ2VEYXRhKGRhdGEpO1xyXG4gICAgICBcclxuICAgICAgLy8gQWRkIGludGVyYWN0aW9uX2lkIGlmIHByb3ZpZGVkXHJcbiAgICAgIGlmIChkYXRhLmludGVyYWN0aW9uSWQpIHtcclxuICAgICAgICBtZXNzYWdlRGF0YS5pbnRlcmFjdGlvbl9pZCA9IGRhdGEuaW50ZXJhY3Rpb25JZDtcclxuICAgICAgfVxyXG4gICAgfSBlbHNlIGlmICh0eXBlb2YgY2hhbm5lbElkT3JEYXRhID09PSAnb2JqZWN0Jykge1xyXG4gICAgICAvLyBFc2tpIGZvcm1hdDogY3JlYXRlTWVzc2FnZShjaGFubmVsSWQsIGRhdGEpIC0gZ3VpbGRJZCB5b2tcclxuICAgICAgLy8gQnUgZm9ybWF0IGFydMSxayBkZXN0ZWtsZW5taXlvciwgaGF0YSBmxLFybGF0XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcignY3JlYXRlTWVzc2FnZSByZXF1aXJlcyBndWlsZElkOiBjcmVhdGVNZXNzYWdlKGd1aWxkSWQsIGNoYW5uZWxJZCwgZGF0YSknKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBjcmVhdGVNZXNzYWdlIGFyZ3VtZW50cycpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PEFQSU1lc3NhZ2U+KCdQT1NUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vY2hhbm5lbHMvJHtjaGFubmVsSWR9L21lc3NhZ2VzYCwgbWVzc2FnZURhdGEpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGFuIGVwaGVtZXJhbCBtZXNzYWdlIHRoYXQgaXMgb25seSB2aXNpYmxlIHRvIGEgc3BlY2lmaWMgdXNlclxyXG4gICAqIEVwaGVtZXJhbCBtZXNzYWdlcyBhcmUgTk9UIHNhdmVkIHRvIGRhdGFiYXNlIC0gdGhleSBhcmUgb25seSBzZW50IHZpYSBXZWJTb2NrZXRcclxuICAgKiBcclxuICAgKiBAZXhhbXBsZVxyXG4gICAqIC8vIFNlbmQgYSB3YXJuaW5nIG9ubHkgdmlzaWJsZSB0byB0aGUgdXNlclxyXG4gICAqIGF3YWl0IHJlc3QuY3JlYXRlRXBoZW1lcmFsTWVzc2FnZShndWlsZElkLCBjaGFubmVsSWQsIHRhcmdldFVzZXJJZCwge1xyXG4gICAqICAgZW1iZWRzOiBbd2FybmluZ0VtYmVkXVxyXG4gICAqIH0pO1xyXG4gICAqL1xyXG4gIGFzeW5jIGNyZWF0ZUVwaGVtZXJhbE1lc3NhZ2UoZ3VpbGRJZDogc3RyaW5nLCBjaGFubmVsSWQ6IHN0cmluZywgdGFyZ2V0VXNlcklkOiBzdHJpbmcgfCBudW1iZXIsIGRhdGE6IHtcclxuICAgIGNvbnRlbnQ/OiBzdHJpbmc7XHJcbiAgICBlbWJlZHM/OiBBUElFbWJlZFtdO1xyXG4gICAgY29tcG9uZW50cz86IGFueVtdO1xyXG4gIH0pOiBQcm9taXNlPHsgaWQ6IHN0cmluZzsgZXBoZW1lcmFsOiBib29sZWFuOyBmbGFnczogbnVtYmVyIH0+IHtcclxuICAgIGNvbnN0IG1lc3NhZ2VEYXRhID0gdGhpcy5wcmVwYXJlTWVzc2FnZURhdGEoZGF0YSk7XHJcbiAgICBcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8eyBpZDogc3RyaW5nOyBlcGhlbWVyYWw6IGJvb2xlYW47IGZsYWdzOiBudW1iZXIgfT4oJ1BPU1QnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH0vbWVzc2FnZXNgLCB7XHJcbiAgICAgIC4uLm1lc3NhZ2VEYXRhLFxyXG4gICAgICBmbGFnczogNjQsIC8vIEVQSEVNRVJBTCBmbGFnXHJcbiAgICAgIHRhcmdldF91c2VyX2lkOiB0eXBlb2YgdGFyZ2V0VXNlcklkID09PSAnc3RyaW5nJyA/IHBhcnNlSW50KHRhcmdldFVzZXJJZCwgMTApIDogdGFyZ2V0VXNlcklkXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIERNIG1lc3NhZ2VcclxuICAgKi9cclxuICBhc3luYyBjcmVhdGVETU1lc3NhZ2UoY2hhbm5lbElkOiBzdHJpbmcsIGRhdGE6IHtcclxuICAgIGNvbnRlbnQ/OiBzdHJpbmc7XHJcbiAgICBlbWJlZHM/OiBBUElFbWJlZFtdO1xyXG4gIH0pOiBQcm9taXNlPEFQSU1lc3NhZ2U+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QVBJTWVzc2FnZT4oJ1BPU1QnLCBgL2JvdC9kbS8ke2NoYW5uZWxJZH1gLCBkYXRhKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEVkaXQgYSBtZXNzYWdlXHJcbiAgICogQXV0b21hdGljYWxseSBwcm9jZXNzZXMgbWVudGlvbnNcclxuICAgKi9cclxuICBhc3luYyBlZGl0TWVzc2FnZShndWlsZElkOiBzdHJpbmcsIGNoYW5uZWxJZDogc3RyaW5nLCBtZXNzYWdlSWQ6IHN0cmluZywgZGF0YToge1xyXG4gICAgY29udGVudD86IHN0cmluZztcclxuICAgIGVtYmVkcz86IEFQSUVtYmVkW107XHJcbiAgICBjb21wb25lbnRzPzogYW55W107XHJcbiAgICBtZW50aW9ucz86IE1lbnRpb25zRGF0YTtcclxuICB9KTogUHJvbWlzZTxBUElNZXNzYWdlPiB7XHJcbiAgICBjb25zdCBwYXRoID0gYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vY2hhbm5lbHMvJHtjaGFubmVsSWR9L21lc3NhZ2VzLyR7bWVzc2FnZUlkfWA7XHJcbiAgICBjb25zdCBwcm9jZXNzZWREYXRhID0gdGhpcy5wcmVwYXJlTWVzc2FnZURhdGEoZGF0YSk7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PEFQSU1lc3NhZ2U+KCdQQVRDSCcsIHBhdGgsIHByb2Nlc3NlZERhdGEpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVsZXRlIGEgbWVzc2FnZVxyXG4gICAqL1xyXG4gIGFzeW5jIGRlbGV0ZU1lc3NhZ2UoZ3VpbGRJZDogc3RyaW5nLCBjaGFubmVsSWQ6IHN0cmluZywgbWVzc2FnZUlkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IHBhdGggPSBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH0vbWVzc2FnZXMvJHttZXNzYWdlSWR9YDtcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdDx2b2lkPignREVMRVRFJywgcGF0aCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBWYWxpZGF0ZSBhbmQgbm9ybWFsaXplIGVtb2ppIGZvcm1hdCBmb3IgdGhlIEFQSS5cclxuICAgKiBBY2NlcHRlZCBmb3JtYXRzOiA6bmFtZTosIDw6bmFtZTppZD4sIDxhOm5hbWU6aWQ+XHJcbiAgICogVW5pY29kZSBlbW9qaSBjaGFyYWN0ZXJzICjwn5GNKSBhcmUgTk9UIHN1cHBvcnRlZC5cclxuICAgKi9cclxuICBwcml2YXRlIHZhbGlkYXRlRW1vamkoZW1vamk6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgICBjb25zdCB0cmltbWVkID0gZW1vamkudHJpbSgpO1xyXG4gICAgLy8gQ3VzdG9tIGVtb2ppOiA8Om5hbWU6aWQ+IG9yIDxhOm5hbWU6aWQ+XHJcbiAgICBpZiAoL148YT86XFx3KzpcXGQrPiQvLnRlc3QodHJpbW1lZCkpIHJldHVybiB0cmltbWVkO1xyXG4gICAgLy8gVW5pY29kZSBlbW9qaSBieSBuYW1lOiA6bmFtZTpcclxuICAgIGlmICgvXjpcXHcrOiQvLnRlc3QodHJpbW1lZCkpIHJldHVybiB0cmltbWVkO1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKFxyXG4gICAgICBgR2XDp2Vyc2l6IGVtb2ppIGZvcm1hdMSxOiBcIiR7ZW1vaml9XCIuIEthYnVsIGVkaWxlbiBmb3JtYXRsYXI6IDplbW9qaV9uYW1lOiwgPDpuYW1lOmlkPiwgPGE6bmFtZTppZD5gXHJcbiAgICApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRkIGEgcmVhY3Rpb24gdG8gYSBtZXNzYWdlXHJcbiAgICogQHBhcmFtIGVtb2ppIC0gRW1vamkgaW4gOm5hbWU6LCA8Om5hbWU6aWQ+LCBvciA8YTpuYW1lOmlkPiBmb3JtYXQuIFVuaWNvZGUgY2hhcmFjdGVycyAo8J+RjSkgYXJlIG5vdCBzdXBwb3J0ZWQuXHJcbiAgICovXHJcbiAgYXN5bmMgYWRkUmVhY3Rpb24oZ3VpbGRJZDogc3RyaW5nLCBjaGFubmVsSWQ6IHN0cmluZywgbWVzc2FnZUlkOiBzdHJpbmcsIGVtb2ppOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IHZhbGlkYXRlZCA9IHRoaXMudmFsaWRhdGVFbW9qaShlbW9qaSk7XHJcbiAgICBjb25zdCBwYXRoID0gYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vY2hhbm5lbHMvJHtjaGFubmVsSWR9L21lc3NhZ2VzLyR7bWVzc2FnZUlkfS9yZWFjdGlvbnMvJHtlbmNvZGVVUklDb21wb25lbnQodmFsaWRhdGVkKX0vQG1lYDtcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdDx2b2lkPignUFVUJywgcGF0aCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZW1vdmUgYSByZWFjdGlvbiBmcm9tIGEgbWVzc2FnZVxyXG4gICAqIEBwYXJhbSBlbW9qaSAtIEVtb2ppIGluIDpuYW1lOiwgPDpuYW1lOmlkPiwgb3IgPGE6bmFtZTppZD4gZm9ybWF0LiBVbmljb2RlIGNoYXJhY3RlcnMgKPCfkY0pIGFyZSBub3Qgc3VwcG9ydGVkLlxyXG4gICAqL1xyXG4gIGFzeW5jIHJlbW92ZVJlYWN0aW9uKGd1aWxkSWQ6IHN0cmluZywgY2hhbm5lbElkOiBzdHJpbmcsIG1lc3NhZ2VJZDogc3RyaW5nLCBlbW9qaTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCB2YWxpZGF0ZWQgPSB0aGlzLnZhbGlkYXRlRW1vamkoZW1vamkpO1xyXG4gICAgY29uc3QgcGF0aCA9IGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS9tZXNzYWdlcy8ke21lc3NhZ2VJZH0vcmVhY3Rpb25zLyR7ZW5jb2RlVVJJQ29tcG9uZW50KHZhbGlkYXRlZCl9L0BtZWA7XHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3Q8dm9pZD4oJ0RFTEVURScsIHBhdGgpO1xyXG4gIH1cclxuXHJcblxyXG4gIC8qKlxyXG4gICAqIFVwbG9hZCBhbiBhdHRhY2htZW50IHRvIGEgY2hhbm5lbFxyXG4gICAqL1xyXG4gIGFzeW5jIHVwbG9hZEF0dGFjaG1lbnQoZ3VpbGRJZDogc3RyaW5nLCBjaGFubmVsSWQ6IHN0cmluZywgZmlsZTogeyBuYW1lOiBzdHJpbmc7IGRhdGE6IEJ1ZmZlcjsgY29udGVudFR5cGU/OiBzdHJpbmcgfSk6IFByb21pc2U8eyBpZDogc3RyaW5nOyB1cmw6IHN0cmluZzsgZmlsZW5hbWU6IHN0cmluZyB9PiB7XHJcbiAgICBjb25zdCBGb3JtRGF0YSA9IHJlcXVpcmUoJ2Zvcm0tZGF0YScpO1xyXG4gICAgY29uc3QgZm9ybSA9IG5ldyBGb3JtRGF0YSgpO1xyXG4gICAgXHJcbiAgICAvLyBmb3JtLWRhdGEgZXhwZWN0cyB0aGUgYnVmZmVyIGRpcmVjdGx5IHdpdGggb3B0aW9uc1xyXG4gICAgZm9ybS5hcHBlbmQoJ2ZpbGUnLCBmaWxlLmRhdGEsIHtcclxuICAgICAgZmlsZW5hbWU6IGZpbGUubmFtZSxcclxuICAgICAgY29udGVudFR5cGU6IGZpbGUuY29udGVudFR5cGUgfHwgJ3RleHQvcGxhaW4nXHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgY29uc3QgdXJsID0gYCR7dGhpcy5iYXNlVXJsfS9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vY2hhbm5lbHMvJHtjaGFubmVsSWR9L2F0dGFjaG1lbnRzYDtcclxuICAgIFxyXG4gICAgY29uc29sZS5sb2coYFtSRVNUXSBVcGxvYWRpbmcgYXR0YWNobWVudDogJHtmaWxlLm5hbWV9ICgke2ZpbGUuZGF0YS5sZW5ndGh9IGJ5dGVzKWApO1xyXG4gICAgXHJcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybCwge1xyXG4gICAgICBtZXRob2Q6ICdQT1NUJyxcclxuICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgICdBdXRob3JpemF0aW9uJzogYEJvdCAke3RoaXMudG9rZW59YCxcclxuICAgICAgICAuLi5mb3JtLmdldEhlYWRlcnMoKVxyXG4gICAgICB9LFxyXG4gICAgICBib2R5OiBmb3JtLmdldEJ1ZmZlcigpXHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgaWYgKCFyZXNwb25zZS5vaykge1xyXG4gICAgICBjb25zdCBlcnJvciA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKTtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBBUEkgRXJyb3IgJHtyZXNwb25zZS5zdGF0dXN9OiAke2Vycm9yfWApO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICByZXR1cm4gcmVzcG9uc2UuanNvbigpIGFzIFByb21pc2U8eyBpZDogc3RyaW5nOyB1cmw6IHN0cmluZzsgZmlsZW5hbWU6IHN0cmluZyB9PjtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIG1lc3NhZ2Ugd2l0aCBhIGZpbGUgYXR0YWNobWVudFxyXG4gICAqL1xyXG4gIGFzeW5jIGNyZWF0ZU1lc3NhZ2VXaXRoRmlsZShndWlsZElkOiBzdHJpbmcsIGNoYW5uZWxJZDogc3RyaW5nLCBkYXRhOiB7XHJcbiAgICBjb250ZW50Pzogc3RyaW5nO1xyXG4gICAgZmlsZTogeyBuYW1lOiBzdHJpbmc7IGRhdGE6IEJ1ZmZlcjsgY29udGVudFR5cGU/OiBzdHJpbmcgfTtcclxuICAgIGludGVyYWN0aW9uSWQ/OiBzdHJpbmc7XHJcbiAgfSk6IFByb21pc2U8QVBJTWVzc2FnZT4ge1xyXG4gICAgY29uc3QgRm9ybURhdGEgPSByZXF1aXJlKCdmb3JtLWRhdGEnKTtcclxuICAgIGNvbnN0IGZvcm0gPSBuZXcgRm9ybURhdGEoKTtcclxuICAgIFxyXG4gICAgLy8gQWRkIGNvbnRlbnQgaWYgcHJvdmlkZWRcclxuICAgIGlmIChkYXRhLmNvbnRlbnQpIHtcclxuICAgICAgZm9ybS5hcHBlbmQoJ2NvbnRlbnQnLCBkYXRhLmNvbnRlbnQpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvLyBBZGQgaW50ZXJhY3Rpb25faWQgaWYgcHJvdmlkZWQgKGZvciBkZWZlcnJlZCByZXNwb25zZSBtYXRjaGluZylcclxuICAgIGlmIChkYXRhLmludGVyYWN0aW9uSWQpIHtcclxuICAgICAgZm9ybS5hcHBlbmQoJ2ludGVyYWN0aW9uX2lkJywgZGF0YS5pbnRlcmFjdGlvbklkKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgLy8gQWRkIGZpbGVcclxuICAgIGZvcm0uYXBwZW5kKCdmaWxlcycsIGRhdGEuZmlsZS5kYXRhLCB7XHJcbiAgICAgIGZpbGVuYW1lOiBkYXRhLmZpbGUubmFtZSxcclxuICAgICAgY29udGVudFR5cGU6IGRhdGEuZmlsZS5jb250ZW50VHlwZSB8fCAndGV4dC9wbGFpbidcclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBjb25zdCB1cmwgPSBgJHt0aGlzLmJhc2VVcmx9L2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH0vbWVzc2FnZXNgO1xyXG4gICAgXHJcbiAgICBjb25zb2xlLmxvZyhgW1JFU1RdIENyZWF0aW5nIG1lc3NhZ2Ugd2l0aCBmaWxlOiAke2RhdGEuZmlsZS5uYW1lfSAoJHtkYXRhLmZpbGUuZGF0YS5sZW5ndGh9IGJ5dGVzKSR7ZGF0YS5pbnRlcmFjdGlvbklkID8gYCBbaW50ZXJhY3Rpb246ICR7ZGF0YS5pbnRlcmFjdGlvbklkfV1gIDogJyd9YCk7XHJcbiAgICBcclxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godXJsLCB7XHJcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxyXG4gICAgICBoZWFkZXJzOiB7XHJcbiAgICAgICAgJ0F1dGhvcml6YXRpb24nOiBgQm90ICR7dGhpcy50b2tlbn1gLFxyXG4gICAgICAgIC4uLmZvcm0uZ2V0SGVhZGVycygpXHJcbiAgICAgIH0sXHJcbiAgICAgIGJvZHk6IGZvcm0uZ2V0QnVmZmVyKClcclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XHJcbiAgICAgIGNvbnN0IGVycm9yID0gYXdhaXQgcmVzcG9uc2UudGV4dCgpO1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEFQSSBFcnJvciAke3Jlc3BvbnNlLnN0YXR1c306ICR7ZXJyb3J9YCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHJldHVybiByZXNwb25zZS5qc29uKCkgYXMgUHJvbWlzZTxBUElNZXNzYWdlPjtcclxuICB9XHJcblxyXG4gIC8vID09PT09PT09PT09PT09PT09PT09IEludGVyYWN0aW9ucyA9PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgYW4gaW50ZXJhY3Rpb24gcmVzcG9uc2VcclxuICAgKiBBdXRvbWF0aWNhbGx5IHByb2Nlc3NlcyBtZW50aW9ucyBpbiBjb250ZW50IGFuZCBlbWJlZHNcclxuICAgKi9cclxuICBhc3luYyBjcmVhdGVJbnRlcmFjdGlvblJlc3BvbnNlKGludGVyYWN0aW9uSWQ6IHN0cmluZywgdG9rZW46IHN0cmluZywgZGF0YToge1xyXG4gICAgdHlwZTogbnVtYmVyO1xyXG4gICAgZGF0YT86IGFueTtcclxuICB9KTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zb2xlLmxvZyhg8J+TpCBJbnRlcmFjdGlvbiByZXNwb25zZTogJHtpbnRlcmFjdGlvbklkfSAtPiB0eXBlICR7ZGF0YS50eXBlfWApO1xyXG4gICAgdHJ5IHtcclxuICAgICAgLy8gUHJvY2VzcyBtZW50aW9ucyBpbiByZXNwb25zZSBkYXRhIGlmIHByZXNlbnRcclxuICAgICAgbGV0IHByb2Nlc3NlZERhdGEgPSBkYXRhO1xyXG4gICAgICBpZiAoZGF0YS5kYXRhICYmIChkYXRhLmRhdGEuY29udGVudCB8fCBkYXRhLmRhdGEuZW1iZWRzKSkge1xyXG4gICAgICAgIHByb2Nlc3NlZERhdGEgPSB7XHJcbiAgICAgICAgICAuLi5kYXRhLFxyXG4gICAgICAgICAgZGF0YTogdGhpcy5wcmVwYXJlTWVzc2FnZURhdGEoZGF0YS5kYXRhKVxyXG4gICAgICAgIH07XHJcbiAgICAgIH1cclxuICAgICAgXHJcbiAgICAgIGF3YWl0IHRoaXMucmVxdWVzdDx2b2lkPignUE9TVCcsIGAvaW50ZXJhY3Rpb25zLyR7aW50ZXJhY3Rpb25JZH0vJHt0b2tlbn0vY2FsbGJhY2tgLCBwcm9jZXNzZWREYXRhKTtcclxuICAgICAgY29uc29sZS5sb2coYOKchSBJbnRlcmFjdGlvbiByZXNwb25zZSBzZW50YCk7XHJcbiAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICBjb25zb2xlLmVycm9yKGDinYwgSW50ZXJhY3Rpb24gcmVzcG9uc2UgZXJyb3I6YCwgZXJyb3IpO1xyXG4gICAgICB0aHJvdyBlcnJvcjtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEVkaXQgdGhlIG9yaWdpbmFsIGludGVyYWN0aW9uIHJlc3BvbnNlXHJcbiAgICogSWYgZmlsZXMgYXJlIHByb3ZpZGVkLCBjcmVhdGVzIGEgbmV3IG1lc3NhZ2Ugd2l0aCBmaWxlcyAoc2luY2Ugd2ViaG9vayBlZGl0IGRvZXNuJ3Qgc3VwcG9ydCBmaWxlIHVwbG9hZClcclxuICAgKiBBdXRvbWF0aWNhbGx5IHByb2Nlc3NlcyBtZW50aW9uc1xyXG4gICAqL1xyXG4gIGFzeW5jIGVkaXRJbnRlcmFjdGlvblJlc3BvbnNlKHRva2VuOiBzdHJpbmcsIGRhdGE6IHtcclxuICAgIGNvbnRlbnQ/OiBzdHJpbmc7XHJcbiAgICBlbWJlZHM/OiBBUElFbWJlZFtdO1xyXG4gICAgY29tcG9uZW50cz86IGFueVtdO1xyXG4gICAgbWVudGlvbnM/OiBNZW50aW9uc0RhdGE7XHJcbiAgICBmaWxlcz86IEFycmF5PHsgbmFtZTogc3RyaW5nOyBkYXRhOiBCdWZmZXI7IGNvbnRlbnRUeXBlPzogc3RyaW5nIH0+O1xyXG4gIH0sIGd1aWxkSWQ/OiBzdHJpbmcsIGNoYW5uZWxJZD86IHN0cmluZywgaW50ZXJhY3Rpb25JZD86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgYXBwSWQgPSB0aGlzLmdldEFwcGxpY2F0aW9uSWQoKTtcclxuICAgIFxyXG4gICAgLy8gUHJvY2VzcyBtZW50aW9ucyBpbiBjb250ZW50XHJcbiAgICBjb25zdCBwcm9jZXNzZWREYXRhID0gdGhpcy5wcmVwYXJlTWVzc2FnZURhdGEoZGF0YSk7XHJcbiAgICBcclxuICAgIC8vIElmIGZpbGVzIGFyZSBwcmVzZW50IGFuZCB3ZSBoYXZlIGd1aWxkL2NoYW5uZWwgaW5mbywgY3JlYXRlIG1lc3NhZ2Ugd2l0aCBmaWxlIGluc3RlYWRcclxuICAgIGlmIChkYXRhLmZpbGVzICYmIGRhdGEuZmlsZXMubGVuZ3RoID4gMCAmJiBndWlsZElkICYmIGNoYW5uZWxJZCkge1xyXG4gICAgICBjb25zb2xlLmxvZyhgW1JFU1RdIGVkaXRJbnRlcmFjdGlvblJlc3BvbnNlIHdpdGggJHtkYXRhLmZpbGVzLmxlbmd0aH0gZmlsZXMgLSB1c2luZyBjcmVhdGVNZXNzYWdlV2l0aEZpbGVgKTtcclxuICAgICAgXHJcbiAgICAgIC8vIENyZWF0ZSBtZXNzYWdlIHdpdGggZmlsZVxyXG4gICAgICBjb25zdCBmaWxlID0gZGF0YS5maWxlc1swXTsgLy8gRm9yIG5vdywgc3VwcG9ydCBzaW5nbGUgZmlsZVxyXG4gICAgICBhd2FpdCB0aGlzLmNyZWF0ZU1lc3NhZ2VXaXRoRmlsZShndWlsZElkLCBjaGFubmVsSWQsIHtcclxuICAgICAgICBjb250ZW50OiBwcm9jZXNzZWREYXRhLmNvbnRlbnQsXHJcbiAgICAgICAgZmlsZTogZmlsZSxcclxuICAgICAgICBpbnRlcmFjdGlvbklkOiBpbnRlcmFjdGlvbklkXHJcbiAgICAgIH0pO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIElmIHdlIGhhdmUgZ3VpbGRJZCwgY2hhbm5lbElkIGFuZCBpbnRlcmFjdGlvbklkLCBjcmVhdGUgYSBuZXcgbWVzc2FnZSB3aXRoIGludGVyYWN0aW9uX2lkXHJcbiAgICAvLyBUaGlzIGlzIG5lZWRlZCBiZWNhdXNlIG91ciBkZWZlcnJlZCByZXNwb25zZSBkb2Vzbid0IGNyZWF0ZSBhIG1lc3NhZ2VcclxuICAgIGlmIChndWlsZElkICYmIGNoYW5uZWxJZCAmJiBpbnRlcmFjdGlvbklkKSB7XHJcbiAgICAgIGNvbnNvbGUubG9nKGBbUkVTVF0gZWRpdEludGVyYWN0aW9uUmVzcG9uc2UgLSBjcmVhdGluZyBtZXNzYWdlIHdpdGggaW50ZXJhY3Rpb25faWQ6ICR7aW50ZXJhY3Rpb25JZH1gKTtcclxuICAgICAgXHJcbiAgICAgIGNvbnN0IHBheWxvYWQ6IGFueSA9IHtcclxuICAgICAgICBpbnRlcmFjdGlvbl9pZDogaW50ZXJhY3Rpb25JZFxyXG4gICAgICB9O1xyXG4gICAgICBpZiAocHJvY2Vzc2VkRGF0YS5jb250ZW50ICE9PSB1bmRlZmluZWQpIHBheWxvYWQuY29udGVudCA9IHByb2Nlc3NlZERhdGEuY29udGVudDtcclxuICAgICAgaWYgKHByb2Nlc3NlZERhdGEuZW1iZWRzKSBwYXlsb2FkLmVtYmVkcyA9IHByb2Nlc3NlZERhdGEuZW1iZWRzO1xyXG4gICAgICBpZiAocHJvY2Vzc2VkRGF0YS5jb21wb25lbnRzKSBwYXlsb2FkLmNvbXBvbmVudHMgPSBwcm9jZXNzZWREYXRhLmNvbXBvbmVudHM7XHJcbiAgICAgIGlmIChwcm9jZXNzZWREYXRhLm1lbnRpb25zKSBwYXlsb2FkLm1lbnRpb25zID0gcHJvY2Vzc2VkRGF0YS5tZW50aW9ucztcclxuICAgICAgXHJcbiAgICAgIGF3YWl0IHRoaXMucmVxdWVzdDx2b2lkPignUE9TVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS9tZXNzYWdlc2AsIHBheWxvYWQpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIEZhbGxiYWNrOiBSZWd1bGFyIGVkaXQgd2l0aG91dCBmaWxlcyAod2ViaG9vayBQQVRDSClcclxuICAgIGNvbnN0IHBheWxvYWQ6IGFueSA9IHt9O1xyXG4gICAgaWYgKHByb2Nlc3NlZERhdGEuY29udGVudCAhPT0gdW5kZWZpbmVkKSBwYXlsb2FkLmNvbnRlbnQgPSBwcm9jZXNzZWREYXRhLmNvbnRlbnQ7XHJcbiAgICBpZiAocHJvY2Vzc2VkRGF0YS5lbWJlZHMpIHBheWxvYWQuZW1iZWRzID0gcHJvY2Vzc2VkRGF0YS5lbWJlZHM7XHJcbiAgICBpZiAocHJvY2Vzc2VkRGF0YS5jb21wb25lbnRzKSBwYXlsb2FkLmNvbXBvbmVudHMgPSBwcm9jZXNzZWREYXRhLmNvbXBvbmVudHM7XHJcbiAgICBpZiAocHJvY2Vzc2VkRGF0YS5tZW50aW9ucykgcGF5bG9hZC5tZW50aW9ucyA9IHByb2Nlc3NlZERhdGEubWVudGlvbnM7XHJcbiAgICBcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdDx2b2lkPignUEFUQ0gnLCBgL2ludGVyYWN0aW9ucy93ZWJob29rcy8ke2FwcElkfS8ke3Rva2VufS9tZXNzYWdlcy9Ab3JpZ2luYWxgLCBwYXlsb2FkKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlbGV0ZSB0aGUgb3JpZ2luYWwgaW50ZXJhY3Rpb24gcmVzcG9uc2VcclxuICAgKi9cclxuICBhc3luYyBkZWxldGVJbnRlcmFjdGlvblJlc3BvbnNlKHRva2VuOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IGFwcElkID0gdGhpcy5nZXRBcHBsaWNhdGlvbklkKCk7XHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3Q8dm9pZD4oJ0RFTEVURScsIGAvaW50ZXJhY3Rpb25zL3dlYmhvb2tzLyR7YXBwSWR9LyR7dG9rZW59L21lc3NhZ2VzL0BvcmlnaW5hbGApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgZm9sbG93dXAgbWVzc2FnZVxyXG4gICAqIEF1dG9tYXRpY2FsbHkgcHJvY2Vzc2VzIG1lbnRpb25zXHJcbiAgICovXHJcbiAgYXN5bmMgY3JlYXRlRm9sbG93dXAodG9rZW46IHN0cmluZywgZGF0YToge1xyXG4gICAgY29udGVudD86IHN0cmluZztcclxuICAgIGVtYmVkcz86IEFQSUVtYmVkW107XHJcbiAgICBtZW50aW9ucz86IE1lbnRpb25zRGF0YTtcclxuICAgIGZsYWdzPzogbnVtYmVyO1xyXG4gIH0pOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IGFwcElkID0gdGhpcy5nZXRBcHBsaWNhdGlvbklkKCk7XHJcbiAgICBjb25zdCBwcm9jZXNzZWREYXRhID0gdGhpcy5wcmVwYXJlTWVzc2FnZURhdGEoZGF0YSk7XHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3Q8dm9pZD4oJ1BPU1QnLCBgL2ludGVyYWN0aW9ucy93ZWJob29rcy8ke2FwcElkfS8ke3Rva2VufWAsIHByb2Nlc3NlZERhdGEpO1xyXG4gIH1cclxuXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT0gQ29tbWFuZHMgPT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVnaXN0ZXIgZ2xvYmFsIGFwcGxpY2F0aW9uIGNvbW1hbmRzXHJcbiAgICovXHJcbiAgYXN5bmMgcmVnaXN0ZXJHbG9iYWxDb21tYW5kcyhjb21tYW5kczogQVBJQXBwbGljYXRpb25Db21tYW5kW10pOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IGFwcElkID0gdGhpcy5nZXRBcHBsaWNhdGlvbklkKCk7XHJcbiAgICBcclxuICAgIGZvciAoY29uc3QgY29tbWFuZCBvZiBjb21tYW5kcykge1xyXG4gICAgICBhd2FpdCB0aGlzLnJlcXVlc3Q8dm9pZD4oJ1BPU1QnLCBgL2FwcGxpY2F0aW9ucy8ke2FwcElkfS9jb21tYW5kc2AsIGNvbW1hbmQpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVnaXN0ZXIgZ3VpbGQtc3BlY2lmaWMgY29tbWFuZHNcclxuICAgKi9cclxuICBhc3luYyByZWdpc3Rlckd1aWxkQ29tbWFuZHMoZ3VpbGRJZDogc3RyaW5nLCBjb21tYW5kczogQVBJQXBwbGljYXRpb25Db21tYW5kW10pOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IGFwcElkID0gdGhpcy5nZXRBcHBsaWNhdGlvbklkKCk7XHJcbiAgICBcclxuICAgIGZvciAoY29uc3QgY29tbWFuZCBvZiBjb21tYW5kcykge1xyXG4gICAgICBhd2FpdCB0aGlzLnJlcXVlc3Q8dm9pZD4oJ1BPU1QnLCBgL2FwcGxpY2F0aW9ucy8ke2FwcElkfS9ndWlsZHMvJHtndWlsZElkfS9jb21tYW5kc2AsIGNvbW1hbmQpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVsZXRlIGEgZ2xvYmFsIGNvbW1hbmRcclxuICAgKi9cclxuICBhc3luYyBkZWxldGVHbG9iYWxDb21tYW5kKGNvbW1hbmRJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBhcHBJZCA9IHRoaXMuZ2V0QXBwbGljYXRpb25JZCgpO1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0PHZvaWQ+KCdERUxFVEUnLCBgL2FwcGxpY2F0aW9ucy8ke2FwcElkfS9jb21tYW5kcy8ke2NvbW1hbmRJZH1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlbGV0ZSBhIGd1aWxkLXNwZWNpZmljIGNvbW1hbmRcclxuICAgKi9cclxuICBhc3luYyBkZWxldGVHdWlsZENvbW1hbmQoZ3VpbGRJZDogc3RyaW5nLCBjb21tYW5kSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgYXBwSWQgPSB0aGlzLmdldEFwcGxpY2F0aW9uSWQoKTtcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdDx2b2lkPignREVMRVRFJywgYC9hcHBsaWNhdGlvbnMvJHthcHBJZH0vZ3VpbGRzLyR7Z3VpbGRJZH0vY29tbWFuZHMvJHtjb21tYW5kSWR9YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBMaXN0IGFsbCBnbG9iYWwgY29tbWFuZHMgZm9yIHRoaXMgYXBwbGljYXRpb25cclxuICAgKi9cclxuICBhc3luYyBsaXN0R2xvYmFsQ29tbWFuZHMoKTogUHJvbWlzZTxBUElBcHBsaWNhdGlvbkNvbW1hbmRbXT4ge1xyXG4gICAgY29uc3QgYXBwSWQgPSB0aGlzLmdldEFwcGxpY2F0aW9uSWQoKTtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QVBJQXBwbGljYXRpb25Db21tYW5kW10+KCdHRVQnLCBgL2FwcGxpY2F0aW9ucy8ke2FwcElkfS9jb21tYW5kc2ApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogTGlzdCBhbGwgZ3VpbGQtc3BlY2lmaWMgY29tbWFuZHMgZm9yIHRoaXMgYXBwbGljYXRpb25cclxuICAgKi9cclxuICBhc3luYyBsaXN0R3VpbGRDb21tYW5kcyhndWlsZElkOiBzdHJpbmcpOiBQcm9taXNlPEFQSUFwcGxpY2F0aW9uQ29tbWFuZFtdPiB7XHJcbiAgICBjb25zdCBhcHBJZCA9IHRoaXMuZ2V0QXBwbGljYXRpb25JZCgpO1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBUElBcHBsaWNhdGlvbkNvbW1hbmRbXT4oJ0dFVCcsIGAvYXBwbGljYXRpb25zLyR7YXBwSWR9L2d1aWxkcy8ke2d1aWxkSWR9L2NvbW1hbmRzYCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSBzcGVjaWZpYyBnbG9iYWwgY29tbWFuZFxyXG4gICAqL1xyXG4gIGFzeW5jIGdldEdsb2JhbENvbW1hbmQoY29tbWFuZElkOiBzdHJpbmcpOiBQcm9taXNlPEFQSUFwcGxpY2F0aW9uQ29tbWFuZD4ge1xyXG4gICAgY29uc3QgYXBwSWQgPSB0aGlzLmdldEFwcGxpY2F0aW9uSWQoKTtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QVBJQXBwbGljYXRpb25Db21tYW5kPignR0VUJywgYC9hcHBsaWNhdGlvbnMvJHthcHBJZH0vY29tbWFuZHMvJHtjb21tYW5kSWR9YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSBzcGVjaWZpYyBndWlsZCBjb21tYW5kXHJcbiAgICovXHJcbiAgYXN5bmMgZ2V0R3VpbGRDb21tYW5kKGd1aWxkSWQ6IHN0cmluZywgY29tbWFuZElkOiBzdHJpbmcpOiBQcm9taXNlPEFQSUFwcGxpY2F0aW9uQ29tbWFuZD4ge1xyXG4gICAgY29uc3QgYXBwSWQgPSB0aGlzLmdldEFwcGxpY2F0aW9uSWQoKTtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QVBJQXBwbGljYXRpb25Db21tYW5kPignR0VUJywgYC9hcHBsaWNhdGlvbnMvJHthcHBJZH0vZ3VpbGRzLyR7Z3VpbGRJZH0vY29tbWFuZHMvJHtjb21tYW5kSWR9YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBVcGRhdGUgYSBnbG9iYWwgY29tbWFuZFxyXG4gICAqL1xyXG4gIGFzeW5jIHVwZGF0ZUdsb2JhbENvbW1hbmQoY29tbWFuZElkOiBzdHJpbmcsIGRhdGE6IFBhcnRpYWw8QVBJQXBwbGljYXRpb25Db21tYW5kPik6IFByb21pc2U8QVBJQXBwbGljYXRpb25Db21tYW5kPiB7XHJcbiAgICBjb25zdCBhcHBJZCA9IHRoaXMuZ2V0QXBwbGljYXRpb25JZCgpO1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBUElBcHBsaWNhdGlvbkNvbW1hbmQ+KCdQQVRDSCcsIGAvYXBwbGljYXRpb25zLyR7YXBwSWR9L2NvbW1hbmRzLyR7Y29tbWFuZElkfWAsIGRhdGEpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVXBkYXRlIGEgZ3VpbGQtc3BlY2lmaWMgY29tbWFuZFxyXG4gICAqL1xyXG4gIGFzeW5jIHVwZGF0ZUd1aWxkQ29tbWFuZChndWlsZElkOiBzdHJpbmcsIGNvbW1hbmRJZDogc3RyaW5nLCBkYXRhOiBQYXJ0aWFsPEFQSUFwcGxpY2F0aW9uQ29tbWFuZD4pOiBQcm9taXNlPEFQSUFwcGxpY2F0aW9uQ29tbWFuZD4ge1xyXG4gICAgY29uc3QgYXBwSWQgPSB0aGlzLmdldEFwcGxpY2F0aW9uSWQoKTtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QVBJQXBwbGljYXRpb25Db21tYW5kPignUEFUQ0gnLCBgL2FwcGxpY2F0aW9ucy8ke2FwcElkfS9ndWlsZHMvJHtndWlsZElkfS9jb21tYW5kcy8ke2NvbW1hbmRJZH1gLCBkYXRhKTtcclxuICB9XHJcblxyXG4gIC8vID09PT09PT09PT09PT09PT09PT09IEhlbHBlcnMgPT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgcHJpdmF0ZSBhcHBsaWNhdGlvbklkOiBzdHJpbmcgPSAnJztcclxuXHJcbiAgLyoqXHJcbiAgICogU2V0IHRoZSBhcHBsaWNhdGlvbiBJRFxyXG4gICAqL1xyXG4gIHNldEFwcGxpY2F0aW9uSWQoaWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgdGhpcy5hcHBsaWNhdGlvbklkID0gaWQ7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgdGhlIGFwcGxpY2F0aW9uIElEXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBnZXRBcHBsaWNhdGlvbklkKCk6IHN0cmluZyB7XHJcbiAgICBpZiAoIXRoaXMuYXBwbGljYXRpb25JZCkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0FwcGxpY2F0aW9uIElEIG5vdCBzZXQuIENhbGwgc2V0QXBwbGljYXRpb25JZCgpIGZpcnN0LicpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRoaXMuYXBwbGljYXRpb25JZDtcclxuICB9XHJcblxyXG4gIC8vID09PT09PT09PT09PT09PT09PT09IENoYW5uZWxzID09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIGNoYW5uZWwgaW4gYSBndWlsZFxyXG4gICAqL1xyXG4gIGFzeW5jIGNyZWF0ZUNoYW5uZWwoZ3VpbGRJZDogc3RyaW5nLCBkYXRhOiB7XHJcbiAgICBuYW1lOiBzdHJpbmc7XHJcbiAgICB0eXBlPzogbnVtYmVyO1xyXG4gICAgcGFyZW50X2lkPzogc3RyaW5nIHwgbnVsbDtcclxuICAgIGNhdGVnb3J5X2lkPzogc3RyaW5nIHwgbnVsbDtcclxuICAgIHBlcm1pc3Npb25fb3ZlcndyaXRlcz86IEFycmF5PHtcclxuICAgICAgaWQ6IHN0cmluZztcclxuICAgICAgdHlwZTogbnVtYmVyO1xyXG4gICAgICBhbGxvdz86IHN0cmluZztcclxuICAgICAgZGVueT86IHN0cmluZztcclxuICAgIH0+O1xyXG4gIH0pOiBQcm9taXNlPHsgaWQ6IHN0cmluZzsgbmFtZTogc3RyaW5nIH0+IHtcclxuICAgIC8vIE1hcCBwYXJlbnRfaWQgdG8gY2F0ZWdvcnlfaWQgZm9yIGJhY2tlbmQgY29tcGF0aWJpbGl0eVxyXG4gICAgY29uc3QgcmVxdWVzdERhdGE6IGFueSA9IHtcclxuICAgICAgbmFtZTogZGF0YS5uYW1lLFxyXG4gICAgICB0eXBlOiBkYXRhLnR5cGUgPz8gMCwgLy8gRGVmYXVsdCB0byB0ZXh0IGNoYW5uZWxcclxuICAgIH07XHJcbiAgICBcclxuICAgIC8vIEJhY2tlbmQgZXhwZWN0cyBjYXRlZ29yeV9pZCwgbm90IHBhcmVudF9pZFxyXG4gICAgaWYgKGRhdGEuY2F0ZWdvcnlfaWQpIHtcclxuICAgICAgcmVxdWVzdERhdGEuY2F0ZWdvcnlfaWQgPSBkYXRhLmNhdGVnb3J5X2lkO1xyXG4gICAgfSBlbHNlIGlmIChkYXRhLnBhcmVudF9pZCkge1xyXG4gICAgICByZXF1ZXN0RGF0YS5jYXRlZ29yeV9pZCA9IGRhdGEucGFyZW50X2lkO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvLyBBZGQgcGVybWlzc2lvbl9vdmVyd3JpdGVzIGlmIHByb3ZpZGVkXHJcbiAgICBpZiAoZGF0YS5wZXJtaXNzaW9uX292ZXJ3cml0ZXMgJiYgZGF0YS5wZXJtaXNzaW9uX292ZXJ3cml0ZXMubGVuZ3RoID4gMCkge1xyXG4gICAgICByZXF1ZXN0RGF0YS5wZXJtaXNzaW9uX292ZXJ3cml0ZXMgPSBkYXRhLnBlcm1pc3Npb25fb3ZlcndyaXRlcztcclxuICAgIH1cclxuICAgIFxyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCgnUE9TVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzYCwgcmVxdWVzdERhdGEpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVsZXRlIGEgY2hhbm5lbFxyXG4gICAqL1xyXG4gIC8qKlxyXG4gICAqIERlbGV0ZSBhIGNoYW5uZWxcclxuICAgKi9cclxuICBhc3luYyBkZWxldGVDaGFubmVsKGd1aWxkSWQ6IHN0cmluZywgY2hhbm5lbElkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdCgnREVMRVRFJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vY2hhbm5lbHMvJHtjaGFubmVsSWR9YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZWxldGUgYSBjYXRlZ29yeVxyXG4gICAqL1xyXG4gIGFzeW5jIGRlbGV0ZUNhdGVnb3J5KGd1aWxkSWQ6IHN0cmluZywgY2F0ZWdvcnlJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3QoJ0RFTEVURScsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NhdGVnb3JpZXMvJHtjYXRlZ29yeUlkfWApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRWRpdCBjaGFubmVsIHBlcm1pc3Npb24gb3ZlcndyaXRlc1xyXG4gICAqL1xyXG4gIGFzeW5jIGVkaXRDaGFubmVsUGVybWlzc2lvbnMoY2hhbm5lbElkOiBzdHJpbmcsIG92ZXJ3cml0ZUlkOiBzdHJpbmcsIGRhdGE6IHtcclxuICAgIHR5cGU6IG51bWJlcjtcclxuICAgIGFsbG93Pzogc3RyaW5nO1xyXG4gICAgZGVueT86IHN0cmluZztcclxuICB9KTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3QoJ1BVVCcsIGAvYm90L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS9wZXJtaXNzaW9ucy8ke292ZXJ3cml0ZUlkfWAsIGRhdGEpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVsZXRlIGNoYW5uZWwgcGVybWlzc2lvbiBvdmVyd3JpdGVcclxuICAgKi9cclxuICBhc3luYyBkZWxldGVDaGFubmVsUGVybWlzc2lvbihjaGFubmVsSWQ6IHN0cmluZywgb3ZlcndyaXRlSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0KCdERUxFVEUnLCBgL2JvdC9jaGFubmVscy8ke2NoYW5uZWxJZH0vcGVybWlzc2lvbnMvJHtvdmVyd3JpdGVJZH1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBtZXNzYWdlcyBmcm9tIGEgY2hhbm5lbFxyXG4gICAqL1xyXG4gIGFzeW5jIGdldE1lc3NhZ2VzKGd1aWxkSWQ6IHN0cmluZywgY2hhbm5lbElkOiBzdHJpbmcsIG9wdGlvbnM/OiB7XHJcbiAgICBsaW1pdD86IG51bWJlcjtcclxuICAgIGJlZm9yZT86IHN0cmluZztcclxuICAgIGFmdGVyPzogc3RyaW5nO1xyXG4gIH0pOiBQcm9taXNlPEFQSU1lc3NhZ2VbXT4ge1xyXG4gICAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcygpO1xyXG4gICAgaWYgKG9wdGlvbnM/LmxpbWl0KSBwYXJhbXMuYXBwZW5kKCdsaW1pdCcsIFN0cmluZyhvcHRpb25zLmxpbWl0KSk7XHJcbiAgICBpZiAob3B0aW9ucz8uYmVmb3JlKSBwYXJhbXMuYXBwZW5kKCdiZWZvcmUnLCBvcHRpb25zLmJlZm9yZSk7XHJcbiAgICBpZiAob3B0aW9ucz8uYWZ0ZXIpIHBhcmFtcy5hcHBlbmQoJ2FmdGVyJywgb3B0aW9ucy5hZnRlcik7XHJcbiAgICBcclxuICAgIGNvbnN0IHF1ZXJ5ID0gcGFyYW1zLnRvU3RyaW5nKCkgPyBgPyR7cGFyYW1zLnRvU3RyaW5nKCl9YCA6ICcnO1xyXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLnJlcXVlc3Q8eyBtZXNzYWdlczogQVBJTWVzc2FnZVtdOyBwYWdlX2luZm86IGFueSB9PignR0VUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vY2hhbm5lbHMvJHtjaGFubmVsSWR9L21lc3NhZ2VzJHtxdWVyeX1gKTtcclxuICAgIHJldHVybiByZXNwb25zZS5tZXNzYWdlcyB8fCBbXTtcclxuICB9XHJcblxyXG4gIC8vID09PT09PT09PT09PT09PT09PT09IE1lbWJlcnMgPT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGEgZ3VpbGQgbWVtYmVyXHJcbiAgICovXHJcbiAgYXN5bmMgZ2V0TWVtYmVyKGd1aWxkSWQ6IHN0cmluZywgdXNlcklkOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCgnR0VUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vbWVtYmVycy8ke3VzZXJJZH1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBndWlsZCBtZW1iZXJzIGxpc3QgKHBhZ2luYXRlZClcclxuICAgKi9cclxuICBhc3luYyBnZXRNZW1iZXJzKGd1aWxkSWQ6IHN0cmluZywgb3B0aW9ucz86IHsgbGltaXQ/OiBudW1iZXI7IGN1cnNvcj86IHN0cmluZyB9KTogUHJvbWlzZTxhbnk+IHtcclxuICAgIGNvbnN0IHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoKTtcclxuICAgIHBhcmFtcy5zZXQoJ2ZsYXQnLCAndHJ1ZScpOyAvLyBCb3QgQVBJIGFsd2F5cyB1c2VzIGZsYXQgcmVzcG9uc2UgKG5vIHByZXNlbmNlIGdyb3VwaW5nKVxyXG4gICAgaWYgKG9wdGlvbnM/LmxpbWl0KSBwYXJhbXMuc2V0KCdsaW1pdCcsIFN0cmluZyhvcHRpb25zLmxpbWl0KSk7XHJcbiAgICBpZiAob3B0aW9ucz8uY3Vyc29yKSBwYXJhbXMuc2V0KCdjdXJzb3InLCBvcHRpb25zLmN1cnNvcik7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KCdHRVQnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9tZW1iZXJzPyR7cGFyYW1zLnRvU3RyaW5nKCl9YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBUaW1lb3V0IGEgZ3VpbGQgbWVtYmVyXHJcbiAgICovXHJcbiAgYXN5bmMgdGltZW91dE1lbWJlcihndWlsZElkOiBzdHJpbmcsIHVzZXJJZDogc3RyaW5nLCBkdXJhdGlvbjogbnVtYmVyIHwgbnVsbCwgcmVhc29uPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBpZiAoZHVyYXRpb24gPT09IG51bGwpIHtcclxuICAgICAgLy8gQ2xlYXIgdGltZW91dFxyXG4gICAgICBhd2FpdCB0aGlzLnJlcXVlc3QoJ1BPU1QnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9tZW1iZXJzLyR7dXNlcklkfS90aW1lb3V0L2NsZWFyYCwge1xyXG4gICAgICAgIHJlYXNvblxyXG4gICAgICB9KTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIC8vIFNldCB0aW1lb3V0XHJcbiAgICAgIGNvbnN0IHVudGlsID0gbmV3IERhdGUoRGF0ZS5ub3coKSArIGR1cmF0aW9uKS50b0lTT1N0cmluZygpO1xyXG4gICAgICBhd2FpdCB0aGlzLnJlcXVlc3QoJ1BPU1QnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9tZW1iZXJzLyR7dXNlcklkfS90aW1lb3V0YCwge1xyXG4gICAgICAgIHVudGlsLFxyXG4gICAgICAgIHJlYXNvblxyXG4gICAgICB9KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEtpY2sgYSBndWlsZCBtZW1iZXJcclxuICAgKi9cclxuICBhc3luYyBraWNrTWVtYmVyKGd1aWxkSWQ6IHN0cmluZywgdXNlcklkOiBzdHJpbmcsIHJlYXNvbj86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgcXVlcnkgPSByZWFzb24gPyBgP3JlYXNvbj0ke2VuY29kZVVSSUNvbXBvbmVudChyZWFzb24pfWAgOiAnJztcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdCgnREVMRVRFJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vbWVtYmVycy8ke3VzZXJJZH0ke3F1ZXJ5fWApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQmFuIGEgZ3VpbGQgbWVtYmVyXHJcbiAgICovXHJcbiAgYXN5bmMgYmFuTWVtYmVyKGd1aWxkSWQ6IHN0cmluZywgdXNlcklkOiBzdHJpbmcsIG9wdGlvbnM/OiB7XHJcbiAgICBkZWxldGVNZXNzYWdlRGF5cz86IG51bWJlcjtcclxuICAgIGRlbGV0ZU1lc3NhZ2VTZWNvbmRzPzogbnVtYmVyO1xyXG4gICAgcmVhc29uPzogc3RyaW5nO1xyXG4gIH0pOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdCgnUFVUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vYmFucy8ke3VzZXJJZH1gLCB7XHJcbiAgICAgIGRlbGV0ZV9tZXNzYWdlX2RheXM6IG9wdGlvbnM/LmRlbGV0ZU1lc3NhZ2VEYXlzLFxyXG4gICAgICBkZWxldGVfbWVzc2FnZV9zZWNvbmRzOiBvcHRpb25zPy5kZWxldGVNZXNzYWdlU2Vjb25kcyxcclxuICAgICAgcmVhc29uOiBvcHRpb25zPy5yZWFzb25cclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVW5iYW4gYSB1c2VyXHJcbiAgICovXHJcbiAgYXN5bmMgdW5iYW5NZW1iZXIoZ3VpbGRJZDogc3RyaW5nLCB1c2VySWQ6IHN0cmluZywgcmVhc29uPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBxdWVyeSA9IHJlYXNvbiA/IGA/cmVhc29uPSR7ZW5jb2RlVVJJQ29tcG9uZW50KHJlYXNvbil9YCA6ICcnO1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0KCdERUxFVEUnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9iYW5zLyR7dXNlcklkfSR7cXVlcnl9YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBFZGl0IGEgZ3VpbGQgbWVtYmVyXHJcbiAgICovXHJcbiAgYXN5bmMgZWRpdE1lbWJlcihndWlsZElkOiBzdHJpbmcsIHVzZXJJZDogc3RyaW5nLCBkYXRhOiB7XHJcbiAgICBuaWNrPzogc3RyaW5nIHwgbnVsbDtcclxuICAgIHJvbGVzPzogc3RyaW5nW107XHJcbiAgICBtdXRlPzogYm9vbGVhbjtcclxuICAgIGRlYWY/OiBib29sZWFuO1xyXG4gICAgY2hhbm5lbF9pZD86IHN0cmluZyB8IG51bGw7XHJcbiAgICBjb21tdW5pY2F0aW9uX2Rpc2FibGVkX3VudGlsPzogc3RyaW5nIHwgbnVsbDtcclxuICAgIHJlYXNvbj86IHN0cmluZztcclxuICB9KTogUHJvbWlzZTxhbnk+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoJ1BBVENIJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vbWVtYmVycy8ke3VzZXJJZH1gLCBkYXRhKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEFkZCBhIHJvbGUgdG8gYSBtZW1iZXJcclxuICAgKi9cclxuICBhc3luYyBhZGRNZW1iZXJSb2xlKGd1aWxkSWQ6IHN0cmluZywgdXNlcklkOiBzdHJpbmcsIHJvbGVJZDogc3RyaW5nLCByZWFzb24/OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IHF1ZXJ5ID0gcmVhc29uID8gYD9yZWFzb249JHtlbmNvZGVVUklDb21wb25lbnQocmVhc29uKX1gIDogJyc7XHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3QoJ1BVVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L21lbWJlcnMvJHt1c2VySWR9L3JvbGVzLyR7cm9sZUlkfSR7cXVlcnl9YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZW1vdmUgYSByb2xlIGZyb20gYSBtZW1iZXJcclxuICAgKi9cclxuICBhc3luYyByZW1vdmVNZW1iZXJSb2xlKGd1aWxkSWQ6IHN0cmluZywgdXNlcklkOiBzdHJpbmcsIHJvbGVJZDogc3RyaW5nLCByZWFzb24/OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IHF1ZXJ5ID0gcmVhc29uID8gYD9yZWFzb249JHtlbmNvZGVVUklDb21wb25lbnQocmVhc29uKX1gIDogJyc7XHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3QoJ0RFTEVURScsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L21lbWJlcnMvJHt1c2VySWR9L3JvbGVzLyR7cm9sZUlkfSR7cXVlcnl9YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBCdWxrIGFzc2lnbiByb2xlcyB0byBtZW1iZXJzXHJcbiAgICovXHJcbiAgYXN5bmMgYnVsa0Fzc2lnblJvbGVzKGd1aWxkSWQ6IHN0cmluZywgYXNzaWdubWVudHM6IHsgdXNlcl9pZDogc3RyaW5nOyByb2xlX2lkczogc3RyaW5nW10gfVtdKTogUHJvbWlzZTxhbnk+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoJ1BVVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L21lbWJlcnMvcm9sZXMvYXNzaWduYCwgeyBhc3NpZ25tZW50cyB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEJ1bGsgcmVtb3ZlIHJvbGVzIGZyb20gbWVtYmVyc1xyXG4gICAqL1xyXG4gIGFzeW5jIGJ1bGtSZW1vdmVSb2xlcyhndWlsZElkOiBzdHJpbmcsIHJlbW92YWxzOiB7IHVzZXJfaWQ6IHN0cmluZzsgcm9sZV9pZHM6IHN0cmluZ1tdIH1bXSk6IFByb21pc2U8YW55PiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KCdERUxFVEUnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9tZW1iZXJzL3JvbGVzL3JlbW92ZWAsIHsgcmVtb3ZhbHMgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBCdWxrIGRlbGV0ZSBtZXNzYWdlc1xyXG4gICAqL1xyXG4gIGFzeW5jIGJ1bGtEZWxldGVNZXNzYWdlcyhndWlsZElkOiBzdHJpbmcsIGNoYW5uZWxJZDogc3RyaW5nLCBtZXNzYWdlSWRzOiBzdHJpbmdbXSk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0KCdQT1NUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vY2hhbm5lbHMvJHtjaGFubmVsSWR9L21lc3NhZ2VzL2J1bGstZGVsZXRlYCwge1xyXG4gICAgICBtZXNzYWdlczogbWVzc2FnZUlkc1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PSBHdWlsZHMgPT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGEgZ3VpbGRcclxuICAgKi9cclxuICBhc3luYyBnZXRHdWlsZChndWlsZElkOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCgnR0VUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBndWlsZCBjaGFubmVsc1xyXG4gICAqL1xyXG4gIGFzeW5jIGdldEd1aWxkQ2hhbm5lbHMoZ3VpbGRJZDogc3RyaW5nKTogUHJvbWlzZTxhbnlbXT4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCgnR0VUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vY2hhbm5lbHNgKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBndWlsZCByb2xlc1xyXG4gICAqL1xyXG4gIGFzeW5jIGdldFJvbGVzKGd1aWxkSWQ6IHN0cmluZyk6IFByb21pc2U8YW55W10+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoJ0dFVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L3JvbGVzYCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgYSByb2xlXHJcbiAgICovXHJcbiAgYXN5bmMgY3JlYXRlUm9sZShndWlsZElkOiBzdHJpbmcsIGRhdGE6IHtcclxuICAgIG5hbWU/OiBzdHJpbmc7XHJcbiAgICBjb2xvcj86IG51bWJlcjtcclxuICAgIGhvaXN0PzogYm9vbGVhbjtcclxuICAgIG1lbnRpb25hYmxlPzogYm9vbGVhbjtcclxuICAgIHBlcm1pc3Npb25zPzogc3RyaW5nO1xyXG4gIH0pOiBQcm9taXNlPGFueT4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCgnUE9TVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L3JvbGVzYCwgZGF0YSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBFZGl0IGEgcm9sZVxyXG4gICAqL1xyXG4gIGFzeW5jIGVkaXRSb2xlKGd1aWxkSWQ6IHN0cmluZywgcm9sZUlkOiBzdHJpbmcsIGRhdGE6IHtcclxuICAgIG5hbWU/OiBzdHJpbmc7XHJcbiAgICBjb2xvcj86IG51bWJlcjtcclxuICAgIGhvaXN0PzogYm9vbGVhbjtcclxuICAgIG1lbnRpb25hYmxlPzogYm9vbGVhbjtcclxuICAgIHBlcm1pc3Npb25zPzogc3RyaW5nO1xyXG4gIH0pOiBQcm9taXNlPGFueT4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCgnUEFUQ0gnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9yb2xlcy8ke3JvbGVJZH1gLCBkYXRhKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlbGV0ZSBhIHJvbGVcclxuICAgKi9cclxuICBhc3luYyBkZWxldGVSb2xlKGd1aWxkSWQ6IHN0cmluZywgcm9sZUlkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdCgnREVMRVRFJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vcm9sZXMvJHtyb2xlSWR9YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgZ3VpbGQgZW1vamlzXHJcbiAgICovXHJcbiAgYXN5bmMgZ2V0RW1vamlzKGd1aWxkSWQ6IHN0cmluZyk6IFByb21pc2U8YW55W10+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoJ0dFVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2Vtb2ppc2ApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGd1aWxkIGJhbnNcclxuICAgKi9cclxuICBhc3luYyBnZXRCYW5zKGd1aWxkSWQ6IHN0cmluZyk6IFByb21pc2U8YW55W10+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoJ0dFVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2JhbnNgKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhIHNwZWNpZmljIGJhblxyXG4gICAqL1xyXG4gIGFzeW5jIGdldEJhbihndWlsZElkOiBzdHJpbmcsIHVzZXJJZDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoJ0dFVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2JhbnMvJHt1c2VySWR9YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgZ3VpbGQgaW52aXRlc1xyXG4gICAqL1xyXG4gIGFzeW5jIGdldEd1aWxkSW52aXRlcyhndWlsZElkOiBzdHJpbmcpOiBQcm9taXNlPGFueVtdPiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KCdHRVQnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9pbnZpdGVzYCk7XHJcbiAgfVxyXG5cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PSBQaW5zID09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIC8qKlxyXG4gICAqIFBpbiBhIG1lc3NhZ2VcclxuICAgKi9cclxuICBhc3luYyBwaW5NZXNzYWdlKGd1aWxkSWQ6IHN0cmluZywgY2hhbm5lbElkOiBzdHJpbmcsIG1lc3NhZ2VJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3QoJ1BVVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS9waW5zLyR7bWVzc2FnZUlkfWApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVW5waW4gYSBtZXNzYWdlXHJcbiAgICovXHJcbiAgYXN5bmMgdW5waW5NZXNzYWdlKGd1aWxkSWQ6IHN0cmluZywgY2hhbm5lbElkOiBzdHJpbmcsIG1lc3NhZ2VJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3QoJ0RFTEVURScsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS9waW5zLyR7bWVzc2FnZUlkfWApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IHBpbm5lZCBtZXNzYWdlc1xyXG4gICAqL1xyXG4gIGFzeW5jIGdldFBpbm5lZE1lc3NhZ2VzKGd1aWxkSWQ6IHN0cmluZywgY2hhbm5lbElkOiBzdHJpbmcpOiBQcm9taXNlPEFQSU1lc3NhZ2VbXT4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCgnR0VUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vY2hhbm5lbHMvJHtjaGFubmVsSWR9L3BpbnNgKTtcclxuICB9XHJcblxyXG4gIC8vID09PT09PT09PT09PT09PT09PT09IFVzZXJzID09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhIHVzZXJcclxuICAgKi9cclxuICBhc3luYyBnZXRVc2VyKHVzZXJJZDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoJ0dFVCcsIGAvYm90L3VzZXJzLyR7dXNlcklkfWApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGN1cnJlbnQgYm90IHVzZXJcclxuICAgKi9cclxuICBhc3luYyBnZXRDdXJyZW50VXNlcigpOiBQcm9taXNlPGFueT4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCgnR0VUJywgYC9ib3QvdXNlcnMvQG1lYCk7XHJcbiAgfVxyXG5cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PSBJbnZpdGVzID09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhbiBpbnZpdGVcclxuICAgKi9cclxuICBhc3luYyBjcmVhdGVJbnZpdGUoZ3VpbGRJZDogc3RyaW5nLCBjaGFubmVsSWQ6IHN0cmluZywgZGF0YT86IHtcclxuICAgIG1heF9hZ2U/OiBudW1iZXI7XHJcbiAgICBtYXhfdXNlcz86IG51bWJlcjtcclxuICAgIHRlbXBvcmFyeT86IGJvb2xlYW47XHJcbiAgICB1bmlxdWU/OiBib29sZWFuO1xyXG4gIH0pOiBQcm9taXNlPGFueT4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCgnUE9TVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS9pbnZpdGVzYCwgZGF0YSB8fCB7fSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZWxldGUgYW4gaW52aXRlXHJcbiAgICovXHJcbiAgYXN5bmMgZGVsZXRlSW52aXRlKGludml0ZUNvZGU6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0KCdERUxFVEUnLCBgL2JvdC9pbnZpdGVzLyR7aW52aXRlQ29kZX1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhbiBpbnZpdGVcclxuICAgKi9cclxuICBhc3luYyBnZXRJbnZpdGUoaW52aXRlQ29kZTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoJ0dFVCcsIGAvYm90L2ludml0ZXMvJHtpbnZpdGVDb2RlfWApO1xyXG4gIH1cclxuXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT0gV2ViaG9va3MgPT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGNoYW5uZWwgd2ViaG9va3NcclxuICAgKi9cclxuICBhc3luYyBnZXRDaGFubmVsV2ViaG9va3MoZ3VpbGRJZDogc3RyaW5nLCBjaGFubmVsSWQ6IHN0cmluZyk6IFByb21pc2U8YW55W10+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoJ0dFVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS93ZWJob29rc2ApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGd1aWxkIHdlYmhvb2tzXHJcbiAgICovXHJcbiAgYXN5bmMgZ2V0R3VpbGRXZWJob29rcyhndWlsZElkOiBzdHJpbmcpOiBQcm9taXNlPGFueVtdPiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KCdHRVQnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS93ZWJob29rc2ApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgd2ViaG9va1xyXG4gICAqL1xyXG4gIGFzeW5jIGNyZWF0ZVdlYmhvb2soZ3VpbGRJZDogc3RyaW5nLCBjaGFubmVsSWQ6IHN0cmluZywgZGF0YToge1xyXG4gICAgbmFtZTogc3RyaW5nO1xyXG4gICAgYXZhdGFyPzogc3RyaW5nO1xyXG4gIH0pOiBQcm9taXNlPGFueT4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCgnUE9TVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS93ZWJob29rc2AsIGRhdGEpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVXBkYXRlIGEgd2ViaG9va1xyXG4gICAqL1xyXG4gIGFzeW5jIHVwZGF0ZVdlYmhvb2soZ3VpbGRJZDogc3RyaW5nLCB3ZWJob29rSWQ6IHN0cmluZywgZGF0YToge1xyXG4gICAgbmFtZT86IHN0cmluZztcclxuICAgIGF2YXRhcl91cmw/OiBzdHJpbmc7XHJcbiAgfSk6IFByb21pc2U8YW55PiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KCdQQVRDSCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L3dlYmhvb2tzLyR7d2ViaG9va0lkfWAsIGRhdGEpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVsZXRlIGEgd2ViaG9va1xyXG4gICAqL1xyXG4gIGFzeW5jIGRlbGV0ZVdlYmhvb2soZ3VpbGRJZDogc3RyaW5nLCB3ZWJob29rSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCgnREVMRVRFJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vd2ViaG9va3MvJHt3ZWJob29rSWR9YCk7XHJcbiAgfVxyXG59XHJcbiJdfQ==