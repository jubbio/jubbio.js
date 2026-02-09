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
     * // mention.text = "@ilkay"
     * // mention.data = { users: [{ id: 1, username: "ilkay" }] }
     */
    formatMention(user) {
        const userId = typeof user.id === 'string' ? parseInt(user.id, 10) : user.id;
        return {
            text: `@${user.username}`,
            data: {
                users: [{ id: userId, username: user.username }]
            }
        };
    }
    /**
     * Parse mentions (<@ID>) and convert to our format (@username)
     * Also builds the mentions data structure
     *
     * @param content - Message content with mentions
     * @param existingMentions - Existing mentions data to merge with
     * @returns Processed content and mentions data
     */
    processMentions(content, existingMentions) {
        const mentions = {
            users: [...(existingMentions?.users || [])],
            roles: [...(existingMentions?.roles || [])],
            everyone: existingMentions?.everyone
        };
        // Track already added user IDs to avoid duplicates
        const addedUserIds = new Set(mentions.users?.map(u => u.id) || []);
        // Parse <@ID> format (user mentions)
        const userMentionRegex = /<@!?(\d+)>/g;
        let processedContent = content;
        let match;
        while ((match = userMentionRegex.exec(content)) !== null) {
            const userId = parseInt(match[1], 10);
            const fullMatch = match[0];
            // Try to get username from cache
            const cachedUser = this.getCachedUser(userId);
            if (cachedUser) {
                // Replace <@ID> with @username
                processedContent = processedContent.replace(fullMatch, `@${cachedUser.username}`);
                // Add to mentions if not already added
                if (!addedUserIds.has(userId)) {
                    mentions.users.push({ id: userId, username: cachedUser.username });
                    addedUserIds.add(userId);
                }
            }
            else {
                // User not in cache - keep as @User_ID format (backend will resolve)
                processedContent = processedContent.replace(fullMatch, `@User_${userId}`);
                // Still add to mentions with placeholder username
                if (!addedUserIds.has(userId)) {
                    mentions.users.push({ id: userId, username: `User_${userId}` });
                    addedUserIds.add(userId);
                }
            }
        }
        // Parse <@&ID> format (role mentions)
        const roleMentionRegex = /<@&(\d+)>/g;
        const addedRoleIds = new Set(mentions.roles?.map(r => r.id) || []);
        while ((match = roleMentionRegex.exec(content)) !== null) {
            const roleId = match[1];
            const fullMatch = match[0];
            // Replace with @role format (backend handles role resolution)
            processedContent = processedContent.replace(fullMatch, `@role_${roleId}`);
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
        return { content: processedContent, mentions };
    }
    /**
     * Prepare message data with processed mentions
     * Automatically converts mentions to our format
     */
    prepareMessageData(data) {
        const result = { ...data };
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
                const processedEmbed = { ...embed };
                // Process description
                if (embed.description) {
                    const { content, mentions } = this.processMentions(embed.description, allMentions);
                    processedEmbed.description = content;
                    allMentions = mentions;
                }
                // Process title
                if (embed.title) {
                    const { content, mentions } = this.processMentions(embed.title, allMentions);
                    processedEmbed.title = content;
                    allMentions = mentions;
                }
                // Process footer text
                if (embed.footer?.text) {
                    const { content, mentions } = this.processMentions(embed.footer.text, allMentions);
                    processedEmbed.footer = { ...embed.footer, text: content };
                    allMentions = mentions;
                }
                // Process fields
                if (embed.fields && embed.fields.length > 0) {
                    processedEmbed.fields = embed.fields.map((field) => {
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
     * Automatically processes mentions (<@ID>) to our format (@username)
     *
     * @example
     * // Mention style (auto-converted):
     * await rest.createMessage(guildId, channelId, {
     *   content: 'Hello <@123>!',  // Becomes "Hello @username!"
     * });
     *
     * // Our native format:
     * await rest.createMessage(guildId, channelId, {
     *   content: 'Hello @ilkay!',
     *   mentions: { users: [{ id: 123, username: 'ilkay' }] }
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
     * Add a reaction to a message
     */
    async addReaction(guildId, channelId, messageId, emoji) {
        const path = `/bot/guilds/${guildId}/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`;
        await this.request('PUT', path);
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
        await this.request('PATCH', `/webhooks/${appId}/${token}/messages/@original`, payload);
    }
    /**
     * Delete the original interaction response
     */
    async deleteInteractionResponse(token) {
        const appId = this.getApplicationId();
        await this.request('DELETE', `/webhooks/${appId}/${token}/messages/@original`);
    }
    /**
     * Create a followup message
     * Automatically processes mentions
     */
    async createFollowup(token, data) {
        const appId = this.getApplicationId();
        const processedData = this.prepareMessageData(data);
        await this.request('POST', `/webhooks/${appId}/${token}`, processedData);
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
    // ==================== Threads ====================
    /**
     * Create a thread from a message
     */
    async createThreadFromMessage(guildId, channelId, messageId, data) {
        return this.request('POST', `/bot/guilds/${guildId}/channels/${channelId}/messages/${messageId}/threads`, data);
    }
    /**
     * Create a thread without a message
     */
    async createThread(guildId, channelId, data) {
        return this.request('POST', `/bot/guilds/${guildId}/channels/${channelId}/threads`, data);
    }
    /**
     * Join a thread
     */
    async joinThread(channelId) {
        await this.request('PUT', `/bot/channels/${channelId}/thread-members/@me`);
    }
    /**
     * Leave a thread
     */
    async leaveThread(channelId) {
        await this.request('DELETE', `/bot/channels/${channelId}/thread-members/@me`);
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
     * Create a webhook
     */
    async createWebhook(guildId, channelId, data) {
        return this.request('POST', `/bot/guilds/${guildId}/channels/${channelId}/webhooks`, data);
    }
}
exports.REST = REST;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUkVTVC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9yZXN0L1JFU1QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBK0JBOztHQUVHO0FBQ0gsTUFBYSxJQUFJO0lBQ1AsT0FBTyxDQUFTO0lBQ2hCLEtBQUssR0FBVyxFQUFFLENBQUM7SUFFM0IscURBQXFEO0lBQzdDLFNBQVMsR0FBNEIsSUFBSSxHQUFHLEVBQUUsQ0FBQztJQUN0QyxjQUFjLEdBQUcsQ0FBQyxHQUFHLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQyxXQUFXO0lBRTVELFlBQVksVUFBa0IsbUNBQW1DO1FBQy9ELElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO0lBQ3pCLENBQUM7SUFFRCw0REFBNEQ7SUFFNUQ7OztPQUdHO0lBQ0gsU0FBUyxDQUFDLElBQTRGO1FBQ3BHLE1BQU0sTUFBTSxHQUFHLE9BQU8sSUFBSSxDQUFDLEVBQUUsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1FBQzdFLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRTtZQUN6QixFQUFFLEVBQUUsTUFBTTtZQUNWLFFBQVEsRUFBRSxJQUFJLENBQUMsUUFBUTtZQUN2QixXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVcsSUFBSSxJQUFJLENBQUMsWUFBWTtZQUNsRCxRQUFRLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTtTQUNyQixDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxVQUFVLENBQUMsS0FBb0c7UUFDN0csS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUM5QyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxhQUFhLENBQUMsTUFBYztRQUMxQixNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUMxQyxJQUFJLE1BQU0sSUFBSSxJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsTUFBTSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7WUFDakUsT0FBTyxNQUFNLENBQUM7UUFDaEIsQ0FBQztRQUNELDZCQUE2QjtRQUM3QixJQUFJLE1BQU0sRUFBRSxDQUFDO1lBQ1gsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDaEMsQ0FBQztRQUNELE9BQU8sU0FBUyxDQUFDO0lBQ25CLENBQUM7SUFFRDs7Ozs7Ozs7T0FRRztJQUNILGFBQWEsQ0FBQyxJQUErQztRQUMzRCxNQUFNLE1BQU0sR0FBRyxPQUFPLElBQUksQ0FBQyxFQUFFLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztRQUM3RSxPQUFPO1lBQ0wsSUFBSSxFQUFFLElBQUksSUFBSSxDQUFDLFFBQVEsRUFBRTtZQUN6QixJQUFJLEVBQUU7Z0JBQ0osS0FBSyxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsTUFBTSxFQUFFLFFBQVEsRUFBRSxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7YUFDakQ7U0FDRixDQUFDO0lBQ0osQ0FBQztJQUVEOzs7Ozs7O09BT0c7SUFDSyxlQUFlLENBQUMsT0FBZSxFQUFFLGdCQUErQjtRQUN0RSxNQUFNLFFBQVEsR0FBaUI7WUFDN0IsS0FBSyxFQUFFLENBQUMsR0FBRyxDQUFDLGdCQUFnQixFQUFFLEtBQUssSUFBSSxFQUFFLENBQUMsQ0FBQztZQUMzQyxLQUFLLEVBQUUsQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLEVBQUUsS0FBSyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1lBQzNDLFFBQVEsRUFBRSxnQkFBZ0IsRUFBRSxRQUFRO1NBQ3JDLENBQUM7UUFFRixtREFBbUQ7UUFDbkQsTUFBTSxZQUFZLEdBQUcsSUFBSSxHQUFHLENBQUMsUUFBUSxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7UUFFbkUscUNBQXFDO1FBQ3JDLE1BQU0sZ0JBQWdCLEdBQUcsYUFBYSxDQUFDO1FBQ3ZDLElBQUksZ0JBQWdCLEdBQUcsT0FBTyxDQUFDO1FBQy9CLElBQUksS0FBSyxDQUFDO1FBRVYsT0FBTyxDQUFDLEtBQUssR0FBRyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxJQUFJLEVBQUUsQ0FBQztZQUN6RCxNQUFNLE1BQU0sR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQ3RDLE1BQU0sU0FBUyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUUzQixpQ0FBaUM7WUFDakMsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUU5QyxJQUFJLFVBQVUsRUFBRSxDQUFDO2dCQUNmLCtCQUErQjtnQkFDL0IsZ0JBQWdCLEdBQUcsZ0JBQWdCLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxJQUFJLFVBQVUsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO2dCQUVsRix1Q0FBdUM7Z0JBQ3ZDLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7b0JBQzlCLFFBQVEsQ0FBQyxLQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRSxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsVUFBVSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7b0JBQ3BFLFlBQVksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQzNCLENBQUM7WUFDSCxDQUFDO2lCQUFNLENBQUM7Z0JBQ04scUVBQXFFO2dCQUNyRSxnQkFBZ0IsR0FBRyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLFNBQVMsTUFBTSxFQUFFLENBQUMsQ0FBQztnQkFFMUUsa0RBQWtEO2dCQUNsRCxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO29CQUM5QixRQUFRLENBQUMsS0FBTSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFLFFBQVEsTUFBTSxFQUFFLEVBQUUsQ0FBQyxDQUFDO29CQUNqRSxZQUFZLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUMzQixDQUFDO1lBQ0gsQ0FBQztRQUNILENBQUM7UUFFRCxzQ0FBc0M7UUFDdEMsTUFBTSxnQkFBZ0IsR0FBRyxZQUFZLENBQUM7UUFDdEMsTUFBTSxZQUFZLEdBQUcsSUFBSSxHQUFHLENBQUMsUUFBUSxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7UUFFbkUsT0FBTyxDQUFDLEtBQUssR0FBRyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxJQUFJLEVBQUUsQ0FBQztZQUN6RCxNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDeEIsTUFBTSxTQUFTLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBRTNCLDhEQUE4RDtZQUM5RCxnQkFBZ0IsR0FBRyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLFNBQVMsTUFBTSxFQUFFLENBQUMsQ0FBQztZQUUxRSxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO2dCQUM5QixRQUFRLENBQUMsS0FBTSxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDO2dCQUNyQyxZQUFZLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQzNCLENBQUM7UUFDSCxDQUFDO1FBRUQsNEJBQTRCO1FBQzVCLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsRUFBRSxDQUFDO1lBQ2xDLFFBQVEsQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDO1FBQzNCLENBQUM7UUFFRCx3QkFBd0I7UUFDeEIsSUFBSSxRQUFRLENBQUMsS0FBSyxFQUFFLE1BQU0sS0FBSyxDQUFDO1lBQUUsT0FBTyxRQUFRLENBQUMsS0FBSyxDQUFDO1FBQ3hELElBQUksUUFBUSxDQUFDLEtBQUssRUFBRSxNQUFNLEtBQUssQ0FBQztZQUFFLE9BQU8sUUFBUSxDQUFDLEtBQUssQ0FBQztRQUV4RCxPQUFPLEVBQUUsT0FBTyxFQUFFLGdCQUFnQixFQUFFLFFBQVEsRUFBRSxDQUFDO0lBQ2pELENBQUM7SUFFRDs7O09BR0c7SUFDSyxrQkFBa0IsQ0FBQyxJQU0xQjtRQUNDLE1BQU0sTUFBTSxHQUFRLEVBQUUsR0FBRyxJQUFJLEVBQUUsQ0FBQztRQUNoQyxJQUFJLFdBQVcsR0FBaUIsRUFBRSxHQUFHLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUVyRCx5Q0FBeUM7UUFDekMsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDakIsTUFBTSxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsV0FBVyxDQUFDLENBQUM7WUFDOUUsTUFBTSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7WUFDekIsV0FBVyxHQUFHLFFBQVEsQ0FBQztRQUN6QixDQUFDO1FBRUQsa0VBQWtFO1FBQ2xFLElBQUksSUFBSSxDQUFDLE1BQU0sSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUMxQyxNQUFNLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFO2dCQUN0QyxNQUFNLGNBQWMsR0FBUSxFQUFFLEdBQUcsS0FBSyxFQUFFLENBQUM7Z0JBRXpDLHNCQUFzQjtnQkFDdEIsSUFBSSxLQUFLLENBQUMsV0FBVyxFQUFFLENBQUM7b0JBQ3RCLE1BQU0sRUFBRSxPQUFPLEVBQUUsUUFBUSxFQUFFLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsV0FBVyxFQUFFLFdBQVcsQ0FBQyxDQUFDO29CQUNuRixjQUFjLENBQUMsV0FBVyxHQUFHLE9BQU8sQ0FBQztvQkFDckMsV0FBVyxHQUFHLFFBQVEsQ0FBQztnQkFDekIsQ0FBQztnQkFFRCxnQkFBZ0I7Z0JBQ2hCLElBQUksS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDO29CQUNoQixNQUFNLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxXQUFXLENBQUMsQ0FBQztvQkFDN0UsY0FBYyxDQUFDLEtBQUssR0FBRyxPQUFPLENBQUM7b0JBQy9CLFdBQVcsR0FBRyxRQUFRLENBQUM7Z0JBQ3pCLENBQUM7Z0JBRUQsc0JBQXNCO2dCQUN0QixJQUFJLEtBQUssQ0FBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLENBQUM7b0JBQ3ZCLE1BQU0sRUFBRSxPQUFPLEVBQUUsUUFBUSxFQUFFLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxXQUFXLENBQUMsQ0FBQztvQkFDbkYsY0FBYyxDQUFDLE1BQU0sR0FBRyxFQUFFLEdBQUcsS0FBSyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLENBQUM7b0JBQzNELFdBQVcsR0FBRyxRQUFRLENBQUM7Z0JBQ3pCLENBQUM7Z0JBRUQsaUJBQWlCO2dCQUNqQixJQUFJLEtBQUssQ0FBQyxNQUFNLElBQUksS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7b0JBQzVDLGNBQWMsQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFVLEVBQUUsRUFBRTt3QkFDdEQsTUFBTSxjQUFjLEdBQVEsRUFBRSxHQUFHLEtBQUssRUFBRSxDQUFDO3dCQUN6QyxJQUFJLEtBQUssQ0FBQyxLQUFLLEVBQUUsQ0FBQzs0QkFDaEIsTUFBTSxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsV0FBVyxDQUFDLENBQUM7NEJBQzdFLGNBQWMsQ0FBQyxLQUFLLEdBQUcsT0FBTyxDQUFDOzRCQUMvQixXQUFXLEdBQUcsUUFBUSxDQUFDO3dCQUN6QixDQUFDO3dCQUNELElBQUksS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDOzRCQUNmLE1BQU0sRUFBRSxPQUFPLEVBQUUsUUFBUSxFQUFFLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLFdBQVcsQ0FBQyxDQUFDOzRCQUM1RSxjQUFjLENBQUMsSUFBSSxHQUFHLE9BQU8sQ0FBQzs0QkFDOUIsV0FBVyxHQUFHLFFBQVEsQ0FBQzt3QkFDekIsQ0FBQzt3QkFDRCxPQUFPLGNBQWMsQ0FBQztvQkFDeEIsQ0FBQyxDQUFDLENBQUM7Z0JBQ0wsQ0FBQztnQkFFRCxPQUFPLGNBQWMsQ0FBQztZQUN4QixDQUFDLENBQUMsQ0FBQztRQUNMLENBQUM7UUFFRCxnQ0FBZ0M7UUFDaEMsSUFBSSxXQUFXLENBQUMsS0FBSyxFQUFFLE1BQU0sSUFBSSxXQUFXLENBQUMsS0FBSyxFQUFFLE1BQU0sSUFBSSxXQUFXLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDbkYsTUFBTSxDQUFDLFFBQVEsR0FBRyxXQUFXLENBQUM7UUFDaEMsQ0FBQztRQUVELE9BQU8sTUFBTSxDQUFDO0lBQ2hCLENBQUM7SUFFRDs7T0FFRztJQUNILFFBQVEsQ0FBQyxLQUFhO1FBQ3BCLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO1FBQ25CLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEOztPQUVHO0lBQ0ssS0FBSyxDQUFDLE9BQU8sQ0FBSSxNQUFjLEVBQUUsSUFBWSxFQUFFLElBQVU7UUFDL0QsTUFBTSxHQUFHLEdBQUcsR0FBRyxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksRUFBRSxDQUFDO1FBRXJDLFlBQVk7UUFDWixPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVUsTUFBTSxJQUFJLEdBQUcsRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7UUFFekUsTUFBTSxRQUFRLEdBQUcsTUFBTSxLQUFLLENBQUMsR0FBRyxFQUFFO1lBQ2hDLE1BQU07WUFDTixPQUFPLEVBQUU7Z0JBQ1AsZUFBZSxFQUFFLE9BQU8sSUFBSSxDQUFDLEtBQUssRUFBRTtnQkFDcEMsY0FBYyxFQUFFLGtCQUFrQjthQUNuQztZQUNELElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVM7U0FDOUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUNqQixNQUFNLEtBQUssR0FBRyxNQUFNLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUNwQyxNQUFNLElBQUksS0FBSyxDQUFDLGFBQWEsUUFBUSxDQUFDLE1BQU0sS0FBSyxLQUFLLEVBQUUsQ0FBQyxDQUFDO1FBQzVELENBQUM7UUFFRCx5QkFBeUI7UUFDekIsTUFBTSxJQUFJLEdBQUcsTUFBTSxRQUFRLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDbkMsSUFBSSxDQUFDLElBQUk7WUFBRSxPQUFPLEVBQU8sQ0FBQztRQUUxQixPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDMUIsQ0FBQztJQUVELHFEQUFxRDtJQUVyRDs7Ozs7Ozs7Ozs7Ozs7O09BZUc7SUFDSCxLQUFLLENBQUMsYUFBYSxDQUFDLGtCQUEwQixFQUFFLGVBUS9DLEVBQUUsSUFRRjtRQUNDLHNCQUFzQjtRQUN0QiwyRUFBMkU7UUFDM0UsZ0ZBQWdGO1FBRWhGLElBQUksT0FBZSxDQUFDO1FBQ3BCLElBQUksU0FBaUIsQ0FBQztRQUN0QixJQUFJLFdBQWdCLENBQUM7UUFFckIsSUFBSSxPQUFPLGVBQWUsS0FBSyxRQUFRLElBQUksSUFBSSxFQUFFLENBQUM7WUFDaEQsdURBQXVEO1lBQ3ZELE9BQU8sR0FBRyxrQkFBa0IsQ0FBQztZQUM3QixTQUFTLEdBQUcsZUFBZSxDQUFDO1lBQzVCLFdBQVcsR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLENBQUM7WUFFNUMsaUNBQWlDO1lBQ2pDLElBQUksSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO2dCQUN2QixXQUFXLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUM7WUFDbEQsQ0FBQztRQUNILENBQUM7YUFBTSxJQUFJLE9BQU8sZUFBZSxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQy9DLDREQUE0RDtZQUM1RCw4Q0FBOEM7WUFDOUMsTUFBTSxJQUFJLEtBQUssQ0FBQyx5RUFBeUUsQ0FBQyxDQUFDO1FBQzdGLENBQUM7YUFBTSxDQUFDO1lBQ04sTUFBTSxJQUFJLEtBQUssQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDO1FBQ3JELENBQUM7UUFFRCxPQUFPLElBQUksQ0FBQyxPQUFPLENBQWEsTUFBTSxFQUFFLGVBQWUsT0FBTyxhQUFhLFNBQVMsV0FBVyxFQUFFLFdBQVcsQ0FBQyxDQUFDO0lBQ2hILENBQUM7SUFFRDs7Ozs7Ozs7O09BU0c7SUFDSCxLQUFLLENBQUMsc0JBQXNCLENBQUMsT0FBZSxFQUFFLFNBQWlCLEVBQUUsWUFBNkIsRUFBRSxJQUcvRjtRQUNDLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUVsRCxPQUFPLElBQUksQ0FBQyxPQUFPLENBQW9ELE1BQU0sRUFBRSxlQUFlLE9BQU8sYUFBYSxTQUFTLFdBQVcsRUFBRTtZQUN0SSxHQUFHLFdBQVc7WUFDZCxLQUFLLEVBQUUsRUFBRSxFQUFFLGlCQUFpQjtZQUM1QixjQUFjLEVBQUUsT0FBTyxZQUFZLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsWUFBWSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZO1NBQzdGLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxlQUFlLENBQUMsU0FBaUIsRUFBRSxJQUd4QztRQUNDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBYSxNQUFNLEVBQUUsV0FBVyxTQUFTLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUN4RSxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsS0FBSyxDQUFDLFdBQVcsQ0FBQyxPQUFlLEVBQUUsU0FBaUIsRUFBRSxTQUFpQixFQUFFLElBSXhFO1FBQ0MsTUFBTSxJQUFJLEdBQUcsZUFBZSxPQUFPLGFBQWEsU0FBUyxhQUFhLFNBQVMsRUFBRSxDQUFDO1FBQ2xGLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNwRCxPQUFPLElBQUksQ0FBQyxPQUFPLENBQWEsT0FBTyxFQUFFLElBQUksRUFBRSxhQUFhLENBQUMsQ0FBQztJQUNoRSxDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsYUFBYSxDQUFDLE9BQWUsRUFBRSxTQUFpQixFQUFFLFNBQWlCO1FBQ3ZFLE1BQU0sSUFBSSxHQUFHLGVBQWUsT0FBTyxhQUFhLFNBQVMsYUFBYSxTQUFTLEVBQUUsQ0FBQztRQUNsRixNQUFNLElBQUksQ0FBQyxPQUFPLENBQU8sUUFBUSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQzNDLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxXQUFXLENBQUMsT0FBZSxFQUFFLFNBQWlCLEVBQUUsU0FBaUIsRUFBRSxLQUFhO1FBQ3BGLE1BQU0sSUFBSSxHQUFHLGVBQWUsT0FBTyxhQUFhLFNBQVMsYUFBYSxTQUFTLGNBQWMsa0JBQWtCLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQztRQUM3SCxNQUFNLElBQUksQ0FBQyxPQUFPLENBQU8sS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ3hDLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFlLEVBQUUsU0FBaUIsRUFBRSxJQUEwRDtRQUNuSCxNQUFNLFFBQVEsR0FBRyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDdEMsTUFBTSxJQUFJLEdBQUcsSUFBSSxRQUFRLEVBQUUsQ0FBQztRQUU1QixxREFBcUQ7UUFDckQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRTtZQUM3QixRQUFRLEVBQUUsSUFBSSxDQUFDLElBQUk7WUFDbkIsV0FBVyxFQUFFLElBQUksQ0FBQyxXQUFXLElBQUksWUFBWTtTQUM5QyxDQUFDLENBQUM7UUFFSCxNQUFNLEdBQUcsR0FBRyxHQUFHLElBQUksQ0FBQyxPQUFPLGVBQWUsT0FBTyxhQUFhLFNBQVMsY0FBYyxDQUFDO1FBRXRGLE9BQU8sQ0FBQyxHQUFHLENBQUMsZ0NBQWdDLElBQUksQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLFNBQVMsQ0FBQyxDQUFDO1FBRXJGLE1BQU0sUUFBUSxHQUFHLE1BQU0sS0FBSyxDQUFDLEdBQUcsRUFBRTtZQUNoQyxNQUFNLEVBQUUsTUFBTTtZQUNkLE9BQU8sRUFBRTtnQkFDUCxlQUFlLEVBQUUsT0FBTyxJQUFJLENBQUMsS0FBSyxFQUFFO2dCQUNwQyxHQUFHLElBQUksQ0FBQyxVQUFVLEVBQUU7YUFDckI7WUFDRCxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsRUFBRTtTQUN2QixDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsRUFBRSxDQUFDO1lBQ2pCLE1BQU0sS0FBSyxHQUFHLE1BQU0sUUFBUSxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ3BDLE1BQU0sSUFBSSxLQUFLLENBQUMsYUFBYSxRQUFRLENBQUMsTUFBTSxLQUFLLEtBQUssRUFBRSxDQUFDLENBQUM7UUFDNUQsQ0FBQztRQUVELE9BQU8sUUFBUSxDQUFDLElBQUksRUFBNEQsQ0FBQztJQUNuRixDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMscUJBQXFCLENBQUMsT0FBZSxFQUFFLFNBQWlCLEVBQUUsSUFJL0Q7UUFDQyxNQUFNLFFBQVEsR0FBRyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDdEMsTUFBTSxJQUFJLEdBQUcsSUFBSSxRQUFRLEVBQUUsQ0FBQztRQUU1QiwwQkFBMEI7UUFDMUIsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDakIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3ZDLENBQUM7UUFFRCxrRUFBa0U7UUFDbEUsSUFBSSxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDdkIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxnQkFBZ0IsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDcEQsQ0FBQztRQUVELFdBQVc7UUFDWCxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRTtZQUNuQyxRQUFRLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJO1lBQ3hCLFdBQVcsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsSUFBSSxZQUFZO1NBQ25ELENBQUMsQ0FBQztRQUVILE1BQU0sR0FBRyxHQUFHLEdBQUcsSUFBSSxDQUFDLE9BQU8sZUFBZSxPQUFPLGFBQWEsU0FBUyxXQUFXLENBQUM7UUFFbkYsT0FBTyxDQUFDLEdBQUcsQ0FBQyxzQ0FBc0MsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxVQUFVLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLGtCQUFrQixJQUFJLENBQUMsYUFBYSxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFekssTUFBTSxRQUFRLEdBQUcsTUFBTSxLQUFLLENBQUMsR0FBRyxFQUFFO1lBQ2hDLE1BQU0sRUFBRSxNQUFNO1lBQ2QsT0FBTyxFQUFFO2dCQUNQLGVBQWUsRUFBRSxPQUFPLElBQUksQ0FBQyxLQUFLLEVBQUU7Z0JBQ3BDLEdBQUcsSUFBSSxDQUFDLFVBQVUsRUFBRTthQUNyQjtZQUNELElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxFQUFFO1NBQ3ZCLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDakIsTUFBTSxLQUFLLEdBQUcsTUFBTSxRQUFRLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDcEMsTUFBTSxJQUFJLEtBQUssQ0FBQyxhQUFhLFFBQVEsQ0FBQyxNQUFNLEtBQUssS0FBSyxFQUFFLENBQUMsQ0FBQztRQUM1RCxDQUFDO1FBRUQsT0FBTyxRQUFRLENBQUMsSUFBSSxFQUF5QixDQUFDO0lBQ2hELENBQUM7SUFFRCx5REFBeUQ7SUFFekQ7OztPQUdHO0lBQ0gsS0FBSyxDQUFDLHlCQUF5QixDQUFDLGFBQXFCLEVBQUUsS0FBYSxFQUFFLElBR3JFO1FBQ0MsT0FBTyxDQUFDLEdBQUcsQ0FBQyw0QkFBNEIsYUFBYSxZQUFZLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQzlFLElBQUksQ0FBQztZQUNILCtDQUErQztZQUMvQyxJQUFJLGFBQWEsR0FBRyxJQUFJLENBQUM7WUFDekIsSUFBSSxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO2dCQUN6RCxhQUFhLEdBQUc7b0JBQ2QsR0FBRyxJQUFJO29CQUNQLElBQUksRUFBRSxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztpQkFDekMsQ0FBQztZQUNKLENBQUM7WUFFRCxNQUFNLElBQUksQ0FBQyxPQUFPLENBQU8sTUFBTSxFQUFFLGlCQUFpQixhQUFhLElBQUksS0FBSyxXQUFXLEVBQUUsYUFBYSxDQUFDLENBQUM7WUFDcEcsT0FBTyxDQUFDLEdBQUcsQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDO1FBQzdDLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2YsT0FBTyxDQUFDLEtBQUssQ0FBQywrQkFBK0IsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUN0RCxNQUFNLEtBQUssQ0FBQztRQUNkLENBQUM7SUFDSCxDQUFDO0lBRUQ7Ozs7T0FJRztJQUNILEtBQUssQ0FBQyx1QkFBdUIsQ0FBQyxLQUFhLEVBQUUsSUFNNUMsRUFBRSxPQUFnQixFQUFFLFNBQWtCLEVBQUUsYUFBc0I7UUFDN0QsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7UUFFdEMsOEJBQThCO1FBQzlCLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUVwRCx3RkFBd0Y7UUFDeEYsSUFBSSxJQUFJLENBQUMsS0FBSyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxPQUFPLElBQUksU0FBUyxFQUFFLENBQUM7WUFDaEUsT0FBTyxDQUFDLEdBQUcsQ0FBQyx1Q0FBdUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLHNDQUFzQyxDQUFDLENBQUM7WUFFNUcsMkJBQTJCO1lBQzNCLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQywrQkFBK0I7WUFDM0QsTUFBTSxJQUFJLENBQUMscUJBQXFCLENBQUMsT0FBTyxFQUFFLFNBQVMsRUFBRTtnQkFDbkQsT0FBTyxFQUFFLGFBQWEsQ0FBQyxPQUFPO2dCQUM5QixJQUFJLEVBQUUsSUFBSTtnQkFDVixhQUFhLEVBQUUsYUFBYTthQUM3QixDQUFDLENBQUM7WUFDSCxPQUFPO1FBQ1QsQ0FBQztRQUVELDRGQUE0RjtRQUM1Rix3RUFBd0U7UUFDeEUsSUFBSSxPQUFPLElBQUksU0FBUyxJQUFJLGFBQWEsRUFBRSxDQUFDO1lBQzFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsMEVBQTBFLGFBQWEsRUFBRSxDQUFDLENBQUM7WUFFdkcsTUFBTSxPQUFPLEdBQVE7Z0JBQ25CLGNBQWMsRUFBRSxhQUFhO2FBQzlCLENBQUM7WUFDRixJQUFJLGFBQWEsQ0FBQyxPQUFPLEtBQUssU0FBUztnQkFBRSxPQUFPLENBQUMsT0FBTyxHQUFHLGFBQWEsQ0FBQyxPQUFPLENBQUM7WUFDakYsSUFBSSxhQUFhLENBQUMsTUFBTTtnQkFBRSxPQUFPLENBQUMsTUFBTSxHQUFHLGFBQWEsQ0FBQyxNQUFNLENBQUM7WUFDaEUsSUFBSSxhQUFhLENBQUMsVUFBVTtnQkFBRSxPQUFPLENBQUMsVUFBVSxHQUFHLGFBQWEsQ0FBQyxVQUFVLENBQUM7WUFDNUUsSUFBSSxhQUFhLENBQUMsUUFBUTtnQkFBRSxPQUFPLENBQUMsUUFBUSxHQUFHLGFBQWEsQ0FBQyxRQUFRLENBQUM7WUFFdEUsTUFBTSxJQUFJLENBQUMsT0FBTyxDQUFPLE1BQU0sRUFBRSxlQUFlLE9BQU8sYUFBYSxTQUFTLFdBQVcsRUFBRSxPQUFPLENBQUMsQ0FBQztZQUNuRyxPQUFPO1FBQ1QsQ0FBQztRQUVELHVEQUF1RDtRQUN2RCxNQUFNLE9BQU8sR0FBUSxFQUFFLENBQUM7UUFDeEIsSUFBSSxhQUFhLENBQUMsT0FBTyxLQUFLLFNBQVM7WUFBRSxPQUFPLENBQUMsT0FBTyxHQUFHLGFBQWEsQ0FBQyxPQUFPLENBQUM7UUFDakYsSUFBSSxhQUFhLENBQUMsTUFBTTtZQUFFLE9BQU8sQ0FBQyxNQUFNLEdBQUcsYUFBYSxDQUFDLE1BQU0sQ0FBQztRQUNoRSxJQUFJLGFBQWEsQ0FBQyxVQUFVO1lBQUUsT0FBTyxDQUFDLFVBQVUsR0FBRyxhQUFhLENBQUMsVUFBVSxDQUFDO1FBQzVFLElBQUksYUFBYSxDQUFDLFFBQVE7WUFBRSxPQUFPLENBQUMsUUFBUSxHQUFHLGFBQWEsQ0FBQyxRQUFRLENBQUM7UUFFdEUsTUFBTSxJQUFJLENBQUMsT0FBTyxDQUFPLE9BQU8sRUFBRSxhQUFhLEtBQUssSUFBSSxLQUFLLHFCQUFxQixFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQy9GLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxLQUFhO1FBQzNDLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBQ3RDLE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBTyxRQUFRLEVBQUUsYUFBYSxLQUFLLElBQUksS0FBSyxxQkFBcUIsQ0FBQyxDQUFDO0lBQ3ZGLENBQUM7SUFFRDs7O09BR0c7SUFDSCxLQUFLLENBQUMsY0FBYyxDQUFDLEtBQWEsRUFBRSxJQUtuQztRQUNDLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBQ3RDLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNwRCxNQUFNLElBQUksQ0FBQyxPQUFPLENBQU8sTUFBTSxFQUFFLGFBQWEsS0FBSyxJQUFJLEtBQUssRUFBRSxFQUFFLGFBQWEsQ0FBQyxDQUFDO0lBQ2pGLENBQUM7SUFFRCxxREFBcUQ7SUFFckQ7O09BRUc7SUFDSCxLQUFLLENBQUMsc0JBQXNCLENBQUMsUUFBaUM7UUFDNUQsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7UUFFdEMsS0FBSyxNQUFNLE9BQU8sSUFBSSxRQUFRLEVBQUUsQ0FBQztZQUMvQixNQUFNLElBQUksQ0FBQyxPQUFPLENBQU8sTUFBTSxFQUFFLGlCQUFpQixLQUFLLFdBQVcsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUMvRSxDQUFDO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLHFCQUFxQixDQUFDLE9BQWUsRUFBRSxRQUFpQztRQUM1RSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztRQUV0QyxLQUFLLE1BQU0sT0FBTyxJQUFJLFFBQVEsRUFBRSxDQUFDO1lBQy9CLE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBTyxNQUFNLEVBQUUsaUJBQWlCLEtBQUssV0FBVyxPQUFPLFdBQVcsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUNqRyxDQUFDO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLG1CQUFtQixDQUFDLFNBQWlCO1FBQ3pDLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBQ3RDLE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBTyxRQUFRLEVBQUUsaUJBQWlCLEtBQUssYUFBYSxTQUFTLEVBQUUsQ0FBQyxDQUFDO0lBQ3JGLENBQUM7SUFFRCxvREFBb0Q7SUFFNUMsYUFBYSxHQUFXLEVBQUUsQ0FBQztJQUVuQzs7T0FFRztJQUNILGdCQUFnQixDQUFDLEVBQVU7UUFDekIsSUFBSSxDQUFDLGFBQWEsR0FBRyxFQUFFLENBQUM7SUFDMUIsQ0FBQztJQUVEOztPQUVHO0lBQ0ssZ0JBQWdCO1FBQ3RCLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDeEIsTUFBTSxJQUFJLEtBQUssQ0FBQyx3REFBd0QsQ0FBQyxDQUFDO1FBQzVFLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQyxhQUFhLENBQUM7SUFDNUIsQ0FBQztJQUVELHFEQUFxRDtJQUVyRDs7T0FFRztJQUNILEtBQUssQ0FBQyxhQUFhLENBQUMsT0FBZSxFQUFFLElBV3BDO1FBQ0MseURBQXlEO1FBQ3pELE1BQU0sV0FBVyxHQUFRO1lBQ3ZCLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSTtZQUNmLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsRUFBRSwwQkFBMEI7U0FDakQsQ0FBQztRQUVGLDZDQUE2QztRQUM3QyxJQUFJLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUNyQixXQUFXLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUM7UUFDN0MsQ0FBQzthQUFNLElBQUksSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQzFCLFdBQVcsQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQztRQUMzQyxDQUFDO1FBRUQsd0NBQXdDO1FBQ3hDLElBQUksSUFBSSxDQUFDLHFCQUFxQixJQUFJLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDeEUsV0FBVyxDQUFDLHFCQUFxQixHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQztRQUNqRSxDQUFDO1FBRUQsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxlQUFlLE9BQU8sV0FBVyxFQUFFLFdBQVcsQ0FBQyxDQUFDO0lBQzlFLENBQUM7SUFFRDs7T0FFRztJQUNIOztPQUVHO0lBQ0gsS0FBSyxDQUFDLGFBQWEsQ0FBQyxPQUFlLEVBQUUsU0FBaUI7UUFDcEQsTUFBTSxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRSxlQUFlLE9BQU8sYUFBYSxTQUFTLEVBQUUsQ0FBQyxDQUFDO0lBQy9FLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxzQkFBc0IsQ0FBQyxTQUFpQixFQUFFLFdBQW1CLEVBQUUsSUFJcEU7UUFDQyxNQUFNLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLGlCQUFpQixTQUFTLGdCQUFnQixXQUFXLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUMzRixDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsdUJBQXVCLENBQUMsU0FBaUIsRUFBRSxXQUFtQjtRQUNsRSxNQUFNLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFFLGlCQUFpQixTQUFTLGdCQUFnQixXQUFXLEVBQUUsQ0FBQyxDQUFDO0lBQ3hGLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxXQUFXLENBQUMsT0FBZSxFQUFFLFNBQWlCLEVBQUUsT0FJckQ7UUFDQyxNQUFNLE1BQU0sR0FBRyxJQUFJLGVBQWUsRUFBRSxDQUFDO1FBQ3JDLElBQUksT0FBTyxFQUFFLEtBQUs7WUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDLE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7UUFDbEUsSUFBSSxPQUFPLEVBQUUsTUFBTTtZQUFFLE1BQU0sQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUM3RCxJQUFJLE9BQU8sRUFBRSxLQUFLO1lBQUUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRTFELE1BQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxNQUFNLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO1FBQy9ELE1BQU0sUUFBUSxHQUFHLE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBNkMsS0FBSyxFQUFFLGVBQWUsT0FBTyxhQUFhLFNBQVMsWUFBWSxLQUFLLEVBQUUsQ0FBQyxDQUFDO1FBQ3hKLE9BQU8sUUFBUSxDQUFDLFFBQVEsSUFBSSxFQUFFLENBQUM7SUFDakMsQ0FBQztJQUVELG9EQUFvRDtJQUVwRDs7T0FFRztJQUNILEtBQUssQ0FBQyxTQUFTLENBQUMsT0FBZSxFQUFFLE1BQWM7UUFDN0MsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxlQUFlLE9BQU8sWUFBWSxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBQ3pFLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxhQUFhLENBQUMsT0FBZSxFQUFFLE1BQWMsRUFBRSxRQUF1QixFQUFFLE1BQWU7UUFDM0YsSUFBSSxRQUFRLEtBQUssSUFBSSxFQUFFLENBQUM7WUFDdEIsZ0JBQWdCO1lBQ2hCLE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsZUFBZSxPQUFPLFlBQVksTUFBTSxnQkFBZ0IsRUFBRTtnQkFDbkYsTUFBTTthQUNQLENBQUMsQ0FBQztRQUNMLENBQUM7YUFBTSxDQUFDO1lBQ04sY0FBYztZQUNkLE1BQU0sS0FBSyxHQUFHLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsR0FBRyxRQUFRLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUM1RCxNQUFNLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLGVBQWUsT0FBTyxZQUFZLE1BQU0sVUFBVSxFQUFFO2dCQUM3RSxLQUFLO2dCQUNMLE1BQU07YUFDUCxDQUFDLENBQUM7UUFDTCxDQUFDO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLFVBQVUsQ0FBQyxPQUFlLEVBQUUsTUFBYyxFQUFFLE1BQWU7UUFDL0QsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxXQUFXLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUNwRSxNQUFNLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFFLGVBQWUsT0FBTyxZQUFZLE1BQU0sR0FBRyxLQUFLLEVBQUUsQ0FBQyxDQUFDO0lBQ25GLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxTQUFTLENBQUMsT0FBZSxFQUFFLE1BQWMsRUFBRSxPQUloRDtRQUNDLE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsZUFBZSxPQUFPLFNBQVMsTUFBTSxFQUFFLEVBQUU7WUFDakUsbUJBQW1CLEVBQUUsT0FBTyxFQUFFLGlCQUFpQjtZQUMvQyxzQkFBc0IsRUFBRSxPQUFPLEVBQUUsb0JBQW9CO1lBQ3JELE1BQU0sRUFBRSxPQUFPLEVBQUUsTUFBTTtTQUN4QixDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsV0FBVyxDQUFDLE9BQWUsRUFBRSxNQUFjLEVBQUUsTUFBZTtRQUNoRSxNQUFNLEtBQUssR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLFdBQVcsa0JBQWtCLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO1FBQ3BFLE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsZUFBZSxPQUFPLFNBQVMsTUFBTSxHQUFHLEtBQUssRUFBRSxDQUFDLENBQUM7SUFDaEYsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLFVBQVUsQ0FBQyxPQUFlLEVBQUUsTUFBYyxFQUFFLElBUWpEO1FBQ0MsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxlQUFlLE9BQU8sWUFBWSxNQUFNLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNqRixDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsYUFBYSxDQUFDLE9BQWUsRUFBRSxNQUFjLEVBQUUsTUFBYyxFQUFFLE1BQWU7UUFDbEYsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxXQUFXLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUNwRSxNQUFNLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLGVBQWUsT0FBTyxZQUFZLE1BQU0sVUFBVSxNQUFNLEdBQUcsS0FBSyxFQUFFLENBQUMsQ0FBQztJQUNoRyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsZ0JBQWdCLENBQUMsT0FBZSxFQUFFLE1BQWMsRUFBRSxNQUFjLEVBQUUsTUFBZTtRQUNyRixNQUFNLEtBQUssR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLFdBQVcsa0JBQWtCLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO1FBQ3BFLE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsZUFBZSxPQUFPLFlBQVksTUFBTSxVQUFVLE1BQU0sR0FBRyxLQUFLLEVBQUUsQ0FBQyxDQUFDO0lBQ25HLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxPQUFlLEVBQUUsU0FBaUIsRUFBRSxVQUFvQjtRQUMvRSxNQUFNLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLGVBQWUsT0FBTyxhQUFhLFNBQVMsdUJBQXVCLEVBQUU7WUFDOUYsUUFBUSxFQUFFLFVBQVU7U0FDckIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVELG1EQUFtRDtJQUVuRDs7T0FFRztJQUNILEtBQUssQ0FBQyxRQUFRLENBQUMsT0FBZTtRQUM1QixPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLGVBQWUsT0FBTyxFQUFFLENBQUMsQ0FBQztJQUN2RCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsZ0JBQWdCLENBQUMsT0FBZTtRQUNwQyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLGVBQWUsT0FBTyxXQUFXLENBQUMsQ0FBQztJQUNoRSxDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsUUFBUSxDQUFDLE9BQWU7UUFDNUIsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxlQUFlLE9BQU8sUUFBUSxDQUFDLENBQUM7SUFDN0QsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLFVBQVUsQ0FBQyxPQUFlLEVBQUUsSUFNakM7UUFDQyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLGVBQWUsT0FBTyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDcEUsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLFFBQVEsQ0FBQyxPQUFlLEVBQUUsTUFBYyxFQUFFLElBTS9DO1FBQ0MsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxlQUFlLE9BQU8sVUFBVSxNQUFNLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUMvRSxDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsVUFBVSxDQUFDLE9BQWUsRUFBRSxNQUFjO1FBQzlDLE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsZUFBZSxPQUFPLFVBQVUsTUFBTSxFQUFFLENBQUMsQ0FBQztJQUN6RSxDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsU0FBUyxDQUFDLE9BQWU7UUFDN0IsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxlQUFlLE9BQU8sU0FBUyxDQUFDLENBQUM7SUFDOUQsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLE9BQU8sQ0FBQyxPQUFlO1FBQzNCLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsZUFBZSxPQUFPLE9BQU8sQ0FBQyxDQUFDO0lBQzVELENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxNQUFNLENBQUMsT0FBZSxFQUFFLE1BQWM7UUFDMUMsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxlQUFlLE9BQU8sU0FBUyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBQ3RFLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxlQUFlLENBQUMsT0FBZTtRQUNuQyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLGVBQWUsT0FBTyxVQUFVLENBQUMsQ0FBQztJQUMvRCxDQUFDO0lBRUQsb0RBQW9EO0lBRXBEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLHVCQUF1QixDQUFDLE9BQWUsRUFBRSxTQUFpQixFQUFFLFNBQWlCLEVBQUUsSUFHcEY7UUFDQyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLGVBQWUsT0FBTyxhQUFhLFNBQVMsYUFBYSxTQUFTLFVBQVUsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNsSCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsWUFBWSxDQUFDLE9BQWUsRUFBRSxTQUFpQixFQUFFLElBS3REO1FBQ0MsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxlQUFlLE9BQU8sYUFBYSxTQUFTLFVBQVUsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUM1RixDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsVUFBVSxDQUFDLFNBQWlCO1FBQ2hDLE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsaUJBQWlCLFNBQVMscUJBQXFCLENBQUMsQ0FBQztJQUM3RSxDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsV0FBVyxDQUFDLFNBQWlCO1FBQ2pDLE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsaUJBQWlCLFNBQVMscUJBQXFCLENBQUMsQ0FBQztJQUNoRixDQUFDO0lBRUQsaURBQWlEO0lBRWpEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLFVBQVUsQ0FBQyxPQUFlLEVBQUUsU0FBaUIsRUFBRSxTQUFpQjtRQUNwRSxNQUFNLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLGVBQWUsT0FBTyxhQUFhLFNBQVMsU0FBUyxTQUFTLEVBQUUsQ0FBQyxDQUFDO0lBQzlGLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxZQUFZLENBQUMsT0FBZSxFQUFFLFNBQWlCLEVBQUUsU0FBaUI7UUFDdEUsTUFBTSxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRSxlQUFlLE9BQU8sYUFBYSxTQUFTLFNBQVMsU0FBUyxFQUFFLENBQUMsQ0FBQztJQUNqRyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsaUJBQWlCLENBQUMsT0FBZSxFQUFFLFNBQWlCO1FBQ3hELE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsZUFBZSxPQUFPLGFBQWEsU0FBUyxPQUFPLENBQUMsQ0FBQztJQUNsRixDQUFDO0lBRUQsa0RBQWtEO0lBRWxEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFjO1FBQzFCLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsY0FBYyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBQ3JELENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxjQUFjO1FBQ2xCLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztJQUMvQyxDQUFDO0lBRUQsb0RBQW9EO0lBRXBEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLFlBQVksQ0FBQyxPQUFlLEVBQUUsU0FBaUIsRUFBRSxJQUt0RDtRQUNDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsZUFBZSxPQUFPLGFBQWEsU0FBUyxVQUFVLEVBQUUsSUFBSSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQ2xHLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxZQUFZLENBQUMsVUFBa0I7UUFDbkMsTUFBTSxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRSxnQkFBZ0IsVUFBVSxFQUFFLENBQUMsQ0FBQztJQUM3RCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsU0FBUyxDQUFDLFVBQWtCO1FBQ2hDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsZ0JBQWdCLFVBQVUsRUFBRSxDQUFDLENBQUM7SUFDM0QsQ0FBQztJQUVELHFEQUFxRDtJQUVyRDs7T0FFRztJQUNILEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxPQUFlLEVBQUUsU0FBaUI7UUFDekQsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxlQUFlLE9BQU8sYUFBYSxTQUFTLFdBQVcsQ0FBQyxDQUFDO0lBQ3RGLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxhQUFhLENBQUMsT0FBZSxFQUFFLFNBQWlCLEVBQUUsSUFHdkQ7UUFDQyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLGVBQWUsT0FBTyxhQUFhLFNBQVMsV0FBVyxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQzdGLENBQUM7Q0FDRjtBQWxnQ0Qsb0JBa2dDQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFQSU1lc3NhZ2UsIEFQSUFwcGxpY2F0aW9uQ29tbWFuZCwgQVBJRW1iZWQgfSBmcm9tICcuLi90eXBlcyc7XHJcblxyXG4vKipcclxuICogTWVudGlvbiBkYXRhIHN0cnVjdHVyZSBmb3Igb3VyIHN5c3RlbVxyXG4gKi9cclxuZXhwb3J0IGludGVyZmFjZSBNZW50aW9uVXNlciB7XHJcbiAgaWQ6IG51bWJlcjtcclxuICB1c2VybmFtZTogc3RyaW5nO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIE1lbnRpb25Sb2xlIHtcclxuICBpZDogc3RyaW5nO1xyXG4gIG5hbWU/OiBzdHJpbmc7XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgTWVudGlvbnNEYXRhIHtcclxuICB1c2Vycz86IE1lbnRpb25Vc2VyW107XHJcbiAgcm9sZXM/OiBNZW50aW9uUm9sZVtdO1xyXG4gIGV2ZXJ5b25lPzogYm9vbGVhbjtcclxufVxyXG5cclxuLyoqXHJcbiAqIFVzZXIgY2FjaGUgZW50cnlcclxuICovXHJcbmludGVyZmFjZSBDYWNoZWRVc2VyIHtcclxuICBpZDogbnVtYmVyO1xyXG4gIHVzZXJuYW1lOiBzdHJpbmc7XHJcbiAgZGlzcGxheU5hbWU/OiBzdHJpbmc7XHJcbiAgY2FjaGVkQXQ6IG51bWJlcjtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJFU1QgQVBJIGNsaWVudCBmb3IgSnViYmlvXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgUkVTVCB7XHJcbiAgcHJpdmF0ZSBiYXNlVXJsOiBzdHJpbmc7XHJcbiAgcHJpdmF0ZSB0b2tlbjogc3RyaW5nID0gJyc7XHJcbiAgXHJcbiAgLy8gVXNlciBjYWNoZSBmb3IgbWVudGlvbiByZXNvbHV0aW9uIChJRCAtPiB1c2VybmFtZSlcclxuICBwcml2YXRlIHVzZXJDYWNoZTogTWFwPG51bWJlciwgQ2FjaGVkVXNlcj4gPSBuZXcgTWFwKCk7XHJcbiAgcHJpdmF0ZSByZWFkb25seSBVU0VSX0NBQ0hFX1RUTCA9IDUgKiA2MCAqIDEwMDA7IC8vIDUgZGFraWthXHJcblxyXG4gIGNvbnN0cnVjdG9yKGJhc2VVcmw6IHN0cmluZyA9ICdodHRwczovL2dhdGV3YXkuanViYmlvLmNvbS9hcGkvdjEnKSB7XHJcbiAgICB0aGlzLmJhc2VVcmwgPSBiYXNlVXJsO1xyXG4gIH1cclxuXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT0gTWVudGlvbiBIZWxwZXJzID09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIC8qKlxyXG4gICAqIENhY2hlIGEgdXNlciBmb3IgbWVudGlvbiByZXNvbHV0aW9uXHJcbiAgICogQm90J2xhciBpbnRlcmFjdGlvbidkYW4gZ2VsZW4gdXNlciBiaWxnaXNpbmkgY2FjaGUnbGV5ZWJpbGlyXHJcbiAgICovXHJcbiAgY2FjaGVVc2VyKHVzZXI6IHsgaWQ6IHN0cmluZyB8IG51bWJlcjsgdXNlcm5hbWU6IHN0cmluZzsgZGlzcGxheU5hbWU/OiBzdHJpbmc7IGRpc3BsYXlfbmFtZT86IHN0cmluZyB9KTogdm9pZCB7XHJcbiAgICBjb25zdCB1c2VySWQgPSB0eXBlb2YgdXNlci5pZCA9PT0gJ3N0cmluZycgPyBwYXJzZUludCh1c2VyLmlkLCAxMCkgOiB1c2VyLmlkO1xyXG4gICAgdGhpcy51c2VyQ2FjaGUuc2V0KHVzZXJJZCwge1xyXG4gICAgICBpZDogdXNlcklkLFxyXG4gICAgICB1c2VybmFtZTogdXNlci51c2VybmFtZSxcclxuICAgICAgZGlzcGxheU5hbWU6IHVzZXIuZGlzcGxheU5hbWUgfHwgdXNlci5kaXNwbGF5X25hbWUsXHJcbiAgICAgIGNhY2hlZEF0OiBEYXRlLm5vdygpXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENhY2hlIG11bHRpcGxlIHVzZXJzXHJcbiAgICovXHJcbiAgY2FjaGVVc2Vycyh1c2VyczogQXJyYXk8eyBpZDogc3RyaW5nIHwgbnVtYmVyOyB1c2VybmFtZTogc3RyaW5nOyBkaXNwbGF5TmFtZT86IHN0cmluZzsgZGlzcGxheV9uYW1lPzogc3RyaW5nIH0+KTogdm9pZCB7XHJcbiAgICB1c2Vycy5mb3JFYWNoKHVzZXIgPT4gdGhpcy5jYWNoZVVzZXIodXNlcikpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGNhY2hlZCB1c2VyIGJ5IElEXHJcbiAgICovXHJcbiAgZ2V0Q2FjaGVkVXNlcih1c2VySWQ6IG51bWJlcik6IENhY2hlZFVzZXIgfCB1bmRlZmluZWQge1xyXG4gICAgY29uc3QgY2FjaGVkID0gdGhpcy51c2VyQ2FjaGUuZ2V0KHVzZXJJZCk7XHJcbiAgICBpZiAoY2FjaGVkICYmIERhdGUubm93KCkgLSBjYWNoZWQuY2FjaGVkQXQgPCB0aGlzLlVTRVJfQ0FDSEVfVFRMKSB7XHJcbiAgICAgIHJldHVybiBjYWNoZWQ7XHJcbiAgICB9XHJcbiAgICAvLyBFeHBpcmVkLCByZW1vdmUgZnJvbSBjYWNoZVxyXG4gICAgaWYgKGNhY2hlZCkge1xyXG4gICAgICB0aGlzLnVzZXJDYWNoZS5kZWxldGUodXNlcklkKTtcclxuICAgIH1cclxuICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBGb3JtYXQgYSB1c2VyIG1lbnRpb25cclxuICAgKiBSZXR1cm5zIGJvdGggdGhlIHRleHQgZm9ybWF0IGFuZCBtZW50aW9ucyBkYXRhXHJcbiAgICogXHJcbiAgICogQGV4YW1wbGVcclxuICAgKiBjb25zdCBtZW50aW9uID0gcmVzdC5mb3JtYXRNZW50aW9uKHVzZXIpO1xyXG4gICAqIC8vIG1lbnRpb24udGV4dCA9IFwiQGlsa2F5XCJcclxuICAgKiAvLyBtZW50aW9uLmRhdGEgPSB7IHVzZXJzOiBbeyBpZDogMSwgdXNlcm5hbWU6IFwiaWxrYXlcIiB9XSB9XHJcbiAgICovXHJcbiAgZm9ybWF0TWVudGlvbih1c2VyOiB7IGlkOiBzdHJpbmcgfCBudW1iZXI7IHVzZXJuYW1lOiBzdHJpbmcgfSk6IHsgdGV4dDogc3RyaW5nOyBkYXRhOiBNZW50aW9uc0RhdGEgfSB7XHJcbiAgICBjb25zdCB1c2VySWQgPSB0eXBlb2YgdXNlci5pZCA9PT0gJ3N0cmluZycgPyBwYXJzZUludCh1c2VyLmlkLCAxMCkgOiB1c2VyLmlkO1xyXG4gICAgcmV0dXJuIHtcclxuICAgICAgdGV4dDogYEAke3VzZXIudXNlcm5hbWV9YCxcclxuICAgICAgZGF0YToge1xyXG4gICAgICAgIHVzZXJzOiBbeyBpZDogdXNlcklkLCB1c2VybmFtZTogdXNlci51c2VybmFtZSB9XVxyXG4gICAgICB9XHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUGFyc2UgbWVudGlvbnMgKDxASUQ+KSBhbmQgY29udmVydCB0byBvdXIgZm9ybWF0IChAdXNlcm5hbWUpXHJcbiAgICogQWxzbyBidWlsZHMgdGhlIG1lbnRpb25zIGRhdGEgc3RydWN0dXJlXHJcbiAgICogXHJcbiAgICogQHBhcmFtIGNvbnRlbnQgLSBNZXNzYWdlIGNvbnRlbnQgd2l0aCBtZW50aW9uc1xyXG4gICAqIEBwYXJhbSBleGlzdGluZ01lbnRpb25zIC0gRXhpc3RpbmcgbWVudGlvbnMgZGF0YSB0byBtZXJnZSB3aXRoXHJcbiAgICogQHJldHVybnMgUHJvY2Vzc2VkIGNvbnRlbnQgYW5kIG1lbnRpb25zIGRhdGFcclxuICAgKi9cclxuICBwcml2YXRlIHByb2Nlc3NNZW50aW9ucyhjb250ZW50OiBzdHJpbmcsIGV4aXN0aW5nTWVudGlvbnM/OiBNZW50aW9uc0RhdGEpOiB7IGNvbnRlbnQ6IHN0cmluZzsgbWVudGlvbnM6IE1lbnRpb25zRGF0YSB9IHtcclxuICAgIGNvbnN0IG1lbnRpb25zOiBNZW50aW9uc0RhdGEgPSB7XHJcbiAgICAgIHVzZXJzOiBbLi4uKGV4aXN0aW5nTWVudGlvbnM/LnVzZXJzIHx8IFtdKV0sXHJcbiAgICAgIHJvbGVzOiBbLi4uKGV4aXN0aW5nTWVudGlvbnM/LnJvbGVzIHx8IFtdKV0sXHJcbiAgICAgIGV2ZXJ5b25lOiBleGlzdGluZ01lbnRpb25zPy5ldmVyeW9uZVxyXG4gICAgfTtcclxuXHJcbiAgICAvLyBUcmFjayBhbHJlYWR5IGFkZGVkIHVzZXIgSURzIHRvIGF2b2lkIGR1cGxpY2F0ZXNcclxuICAgIGNvbnN0IGFkZGVkVXNlcklkcyA9IG5ldyBTZXQobWVudGlvbnMudXNlcnM/Lm1hcCh1ID0+IHUuaWQpIHx8IFtdKTtcclxuXHJcbiAgICAvLyBQYXJzZSA8QElEPiBmb3JtYXQgKHVzZXIgbWVudGlvbnMpXHJcbiAgICBjb25zdCB1c2VyTWVudGlvblJlZ2V4ID0gLzxAIT8oXFxkKyk+L2c7XHJcbiAgICBsZXQgcHJvY2Vzc2VkQ29udGVudCA9IGNvbnRlbnQ7XHJcbiAgICBsZXQgbWF0Y2g7XHJcblxyXG4gICAgd2hpbGUgKChtYXRjaCA9IHVzZXJNZW50aW9uUmVnZXguZXhlYyhjb250ZW50KSkgIT09IG51bGwpIHtcclxuICAgICAgY29uc3QgdXNlcklkID0gcGFyc2VJbnQobWF0Y2hbMV0sIDEwKTtcclxuICAgICAgY29uc3QgZnVsbE1hdGNoID0gbWF0Y2hbMF07XHJcblxyXG4gICAgICAvLyBUcnkgdG8gZ2V0IHVzZXJuYW1lIGZyb20gY2FjaGVcclxuICAgICAgY29uc3QgY2FjaGVkVXNlciA9IHRoaXMuZ2V0Q2FjaGVkVXNlcih1c2VySWQpO1xyXG4gICAgICBcclxuICAgICAgaWYgKGNhY2hlZFVzZXIpIHtcclxuICAgICAgICAvLyBSZXBsYWNlIDxASUQ+IHdpdGggQHVzZXJuYW1lXHJcbiAgICAgICAgcHJvY2Vzc2VkQ29udGVudCA9IHByb2Nlc3NlZENvbnRlbnQucmVwbGFjZShmdWxsTWF0Y2gsIGBAJHtjYWNoZWRVc2VyLnVzZXJuYW1lfWApO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIEFkZCB0byBtZW50aW9ucyBpZiBub3QgYWxyZWFkeSBhZGRlZFxyXG4gICAgICAgIGlmICghYWRkZWRVc2VySWRzLmhhcyh1c2VySWQpKSB7XHJcbiAgICAgICAgICBtZW50aW9ucy51c2VycyEucHVzaCh7IGlkOiB1c2VySWQsIHVzZXJuYW1lOiBjYWNoZWRVc2VyLnVzZXJuYW1lIH0pO1xyXG4gICAgICAgICAgYWRkZWRVc2VySWRzLmFkZCh1c2VySWQpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICAvLyBVc2VyIG5vdCBpbiBjYWNoZSAtIGtlZXAgYXMgQFVzZXJfSUQgZm9ybWF0IChiYWNrZW5kIHdpbGwgcmVzb2x2ZSlcclxuICAgICAgICBwcm9jZXNzZWRDb250ZW50ID0gcHJvY2Vzc2VkQ29udGVudC5yZXBsYWNlKGZ1bGxNYXRjaCwgYEBVc2VyXyR7dXNlcklkfWApO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIFN0aWxsIGFkZCB0byBtZW50aW9ucyB3aXRoIHBsYWNlaG9sZGVyIHVzZXJuYW1lXHJcbiAgICAgICAgaWYgKCFhZGRlZFVzZXJJZHMuaGFzKHVzZXJJZCkpIHtcclxuICAgICAgICAgIG1lbnRpb25zLnVzZXJzIS5wdXNoKHsgaWQ6IHVzZXJJZCwgdXNlcm5hbWU6IGBVc2VyXyR7dXNlcklkfWAgfSk7XHJcbiAgICAgICAgICBhZGRlZFVzZXJJZHMuYWRkKHVzZXJJZCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8gUGFyc2UgPEAmSUQ+IGZvcm1hdCAocm9sZSBtZW50aW9ucylcclxuICAgIGNvbnN0IHJvbGVNZW50aW9uUmVnZXggPSAvPEAmKFxcZCspPi9nO1xyXG4gICAgY29uc3QgYWRkZWRSb2xlSWRzID0gbmV3IFNldChtZW50aW9ucy5yb2xlcz8ubWFwKHIgPT4gci5pZCkgfHwgW10pO1xyXG5cclxuICAgIHdoaWxlICgobWF0Y2ggPSByb2xlTWVudGlvblJlZ2V4LmV4ZWMoY29udGVudCkpICE9PSBudWxsKSB7XHJcbiAgICAgIGNvbnN0IHJvbGVJZCA9IG1hdGNoWzFdO1xyXG4gICAgICBjb25zdCBmdWxsTWF0Y2ggPSBtYXRjaFswXTtcclxuXHJcbiAgICAgIC8vIFJlcGxhY2Ugd2l0aCBAcm9sZSBmb3JtYXQgKGJhY2tlbmQgaGFuZGxlcyByb2xlIHJlc29sdXRpb24pXHJcbiAgICAgIHByb2Nlc3NlZENvbnRlbnQgPSBwcm9jZXNzZWRDb250ZW50LnJlcGxhY2UoZnVsbE1hdGNoLCBgQHJvbGVfJHtyb2xlSWR9YCk7XHJcbiAgICAgIFxyXG4gICAgICBpZiAoIWFkZGVkUm9sZUlkcy5oYXMocm9sZUlkKSkge1xyXG4gICAgICAgIG1lbnRpb25zLnJvbGVzIS5wdXNoKHsgaWQ6IHJvbGVJZCB9KTtcclxuICAgICAgICBhZGRlZFJvbGVJZHMuYWRkKHJvbGVJZCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvLyBQYXJzZSBAZXZlcnlvbmUgYW5kIEBoZXJlXHJcbiAgICBpZiAoY29udGVudC5pbmNsdWRlcygnQGV2ZXJ5b25lJykpIHtcclxuICAgICAgbWVudGlvbnMuZXZlcnlvbmUgPSB0cnVlO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIENsZWFuIHVwIGVtcHR5IGFycmF5c1xyXG4gICAgaWYgKG1lbnRpb25zLnVzZXJzPy5sZW5ndGggPT09IDApIGRlbGV0ZSBtZW50aW9ucy51c2VycztcclxuICAgIGlmIChtZW50aW9ucy5yb2xlcz8ubGVuZ3RoID09PSAwKSBkZWxldGUgbWVudGlvbnMucm9sZXM7XHJcblxyXG4gICAgcmV0dXJuIHsgY29udGVudDogcHJvY2Vzc2VkQ29udGVudCwgbWVudGlvbnMgfTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFByZXBhcmUgbWVzc2FnZSBkYXRhIHdpdGggcHJvY2Vzc2VkIG1lbnRpb25zXHJcbiAgICogQXV0b21hdGljYWxseSBjb252ZXJ0cyBtZW50aW9ucyB0byBvdXIgZm9ybWF0XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBwcmVwYXJlTWVzc2FnZURhdGEoZGF0YToge1xyXG4gICAgY29udGVudD86IHN0cmluZztcclxuICAgIGVtYmVkcz86IEFQSUVtYmVkW107XHJcbiAgICBjb21wb25lbnRzPzogYW55W107XHJcbiAgICBtZW50aW9ucz86IE1lbnRpb25zRGF0YTtcclxuICAgIG1lc3NhZ2VfcmVmZXJlbmNlPzogeyBtZXNzYWdlX2lkOiBzdHJpbmcgfTtcclxuICB9KTogYW55IHtcclxuICAgIGNvbnN0IHJlc3VsdDogYW55ID0geyAuLi5kYXRhIH07XHJcbiAgICBsZXQgYWxsTWVudGlvbnM6IE1lbnRpb25zRGF0YSA9IHsgLi4uZGF0YS5tZW50aW9ucyB9O1xyXG5cclxuICAgIC8vIFByb2Nlc3MgbWVudGlvbnMgaW4gY29udGVudCBpZiBwcmVzZW50XHJcbiAgICBpZiAoZGF0YS5jb250ZW50KSB7XHJcbiAgICAgIGNvbnN0IHsgY29udGVudCwgbWVudGlvbnMgfSA9IHRoaXMucHJvY2Vzc01lbnRpb25zKGRhdGEuY29udGVudCwgYWxsTWVudGlvbnMpO1xyXG4gICAgICByZXN1bHQuY29udGVudCA9IGNvbnRlbnQ7XHJcbiAgICAgIGFsbE1lbnRpb25zID0gbWVudGlvbnM7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gUHJvY2VzcyBtZW50aW9ucyBpbiBlbWJlZHMgKGRlc2NyaXB0aW9uLCB0aXRsZSwgZm9vdGVyLCBmaWVsZHMpXHJcbiAgICBpZiAoZGF0YS5lbWJlZHMgJiYgZGF0YS5lbWJlZHMubGVuZ3RoID4gMCkge1xyXG4gICAgICByZXN1bHQuZW1iZWRzID0gZGF0YS5lbWJlZHMubWFwKGVtYmVkID0+IHtcclxuICAgICAgICBjb25zdCBwcm9jZXNzZWRFbWJlZDogYW55ID0geyAuLi5lbWJlZCB9O1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIFByb2Nlc3MgZGVzY3JpcHRpb25cclxuICAgICAgICBpZiAoZW1iZWQuZGVzY3JpcHRpb24pIHtcclxuICAgICAgICAgIGNvbnN0IHsgY29udGVudCwgbWVudGlvbnMgfSA9IHRoaXMucHJvY2Vzc01lbnRpb25zKGVtYmVkLmRlc2NyaXB0aW9uLCBhbGxNZW50aW9ucyk7XHJcbiAgICAgICAgICBwcm9jZXNzZWRFbWJlZC5kZXNjcmlwdGlvbiA9IGNvbnRlbnQ7XHJcbiAgICAgICAgICBhbGxNZW50aW9ucyA9IG1lbnRpb25zO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICAvLyBQcm9jZXNzIHRpdGxlXHJcbiAgICAgICAgaWYgKGVtYmVkLnRpdGxlKSB7XHJcbiAgICAgICAgICBjb25zdCB7IGNvbnRlbnQsIG1lbnRpb25zIH0gPSB0aGlzLnByb2Nlc3NNZW50aW9ucyhlbWJlZC50aXRsZSwgYWxsTWVudGlvbnMpO1xyXG4gICAgICAgICAgcHJvY2Vzc2VkRW1iZWQudGl0bGUgPSBjb250ZW50O1xyXG4gICAgICAgICAgYWxsTWVudGlvbnMgPSBtZW50aW9ucztcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gUHJvY2VzcyBmb290ZXIgdGV4dFxyXG4gICAgICAgIGlmIChlbWJlZC5mb290ZXI/LnRleHQpIHtcclxuICAgICAgICAgIGNvbnN0IHsgY29udGVudCwgbWVudGlvbnMgfSA9IHRoaXMucHJvY2Vzc01lbnRpb25zKGVtYmVkLmZvb3Rlci50ZXh0LCBhbGxNZW50aW9ucyk7XHJcbiAgICAgICAgICBwcm9jZXNzZWRFbWJlZC5mb290ZXIgPSB7IC4uLmVtYmVkLmZvb3RlciwgdGV4dDogY29udGVudCB9O1xyXG4gICAgICAgICAgYWxsTWVudGlvbnMgPSBtZW50aW9ucztcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gUHJvY2VzcyBmaWVsZHNcclxuICAgICAgICBpZiAoZW1iZWQuZmllbGRzICYmIGVtYmVkLmZpZWxkcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICBwcm9jZXNzZWRFbWJlZC5maWVsZHMgPSBlbWJlZC5maWVsZHMubWFwKChmaWVsZDogYW55KSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IHByb2Nlc3NlZEZpZWxkOiBhbnkgPSB7IC4uLmZpZWxkIH07XHJcbiAgICAgICAgICAgIGlmIChmaWVsZC52YWx1ZSkge1xyXG4gICAgICAgICAgICAgIGNvbnN0IHsgY29udGVudCwgbWVudGlvbnMgfSA9IHRoaXMucHJvY2Vzc01lbnRpb25zKGZpZWxkLnZhbHVlLCBhbGxNZW50aW9ucyk7XHJcbiAgICAgICAgICAgICAgcHJvY2Vzc2VkRmllbGQudmFsdWUgPSBjb250ZW50O1xyXG4gICAgICAgICAgICAgIGFsbE1lbnRpb25zID0gbWVudGlvbnM7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKGZpZWxkLm5hbWUpIHtcclxuICAgICAgICAgICAgICBjb25zdCB7IGNvbnRlbnQsIG1lbnRpb25zIH0gPSB0aGlzLnByb2Nlc3NNZW50aW9ucyhmaWVsZC5uYW1lLCBhbGxNZW50aW9ucyk7XHJcbiAgICAgICAgICAgICAgcHJvY2Vzc2VkRmllbGQubmFtZSA9IGNvbnRlbnQ7XHJcbiAgICAgICAgICAgICAgYWxsTWVudGlvbnMgPSBtZW50aW9ucztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gcHJvY2Vzc2VkRmllbGQ7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHByb2Nlc3NlZEVtYmVkO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBBZGQgbWVyZ2VkIG1lbnRpb25zIHRvIHJlc3VsdFxyXG4gICAgaWYgKGFsbE1lbnRpb25zLnVzZXJzPy5sZW5ndGggfHwgYWxsTWVudGlvbnMucm9sZXM/Lmxlbmd0aCB8fCBhbGxNZW50aW9ucy5ldmVyeW9uZSkge1xyXG4gICAgICByZXN1bHQubWVudGlvbnMgPSBhbGxNZW50aW9ucztcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2V0IHRoZSBib3QgdG9rZW5cclxuICAgKi9cclxuICBzZXRUb2tlbih0b2tlbjogc3RyaW5nKTogdGhpcyB7XHJcbiAgICB0aGlzLnRva2VuID0gdG9rZW47XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIE1ha2UgYW4gYXV0aGVudGljYXRlZCByZXF1ZXN0XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBhc3luYyByZXF1ZXN0PFQ+KG1ldGhvZDogc3RyaW5nLCBwYXRoOiBzdHJpbmcsIGJvZHk/OiBhbnkpOiBQcm9taXNlPFQ+IHtcclxuICAgIGNvbnN0IHVybCA9IGAke3RoaXMuYmFzZVVybH0ke3BhdGh9YDtcclxuICAgIFxyXG4gICAgLy8gRGVidWcgbG9nXHJcbiAgICBjb25zb2xlLmxvZyhgW1JFU1RdICR7bWV0aG9kfSAke3VybH1gLCBib2R5ID8gSlNPTi5zdHJpbmdpZnkoYm9keSkgOiAnJyk7XHJcbiAgICBcclxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godXJsLCB7XHJcbiAgICAgIG1ldGhvZCxcclxuICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgICdBdXRob3JpemF0aW9uJzogYEJvdCAke3RoaXMudG9rZW59YCxcclxuICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nXHJcbiAgICAgIH0sXHJcbiAgICAgIGJvZHk6IGJvZHkgPyBKU09OLnN0cmluZ2lmeShib2R5KSA6IHVuZGVmaW5lZFxyXG4gICAgfSk7XHJcblxyXG4gICAgaWYgKCFyZXNwb25zZS5vaykge1xyXG4gICAgICBjb25zdCBlcnJvciA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKTtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBBUEkgRXJyb3IgJHtyZXNwb25zZS5zdGF0dXN9OiAke2Vycm9yfWApO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIEhhbmRsZSBlbXB0eSByZXNwb25zZXNcclxuICAgIGNvbnN0IHRleHQgPSBhd2FpdCByZXNwb25zZS50ZXh0KCk7XHJcbiAgICBpZiAoIXRleHQpIHJldHVybiB7fSBhcyBUO1xyXG4gICAgXHJcbiAgICByZXR1cm4gSlNPTi5wYXJzZSh0ZXh0KTtcclxuICB9XHJcblxyXG4gIC8vID09PT09PT09PT09PT09PT09PT09IE1lc3NhZ2VzID09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIG1lc3NhZ2UgaW4gYSBjaGFubmVsXHJcbiAgICogQXV0b21hdGljYWxseSBwcm9jZXNzZXMgbWVudGlvbnMgKDxASUQ+KSB0byBvdXIgZm9ybWF0IChAdXNlcm5hbWUpXHJcbiAgICogXHJcbiAgICogQGV4YW1wbGVcclxuICAgKiAvLyBNZW50aW9uIHN0eWxlIChhdXRvLWNvbnZlcnRlZCk6XHJcbiAgICogYXdhaXQgcmVzdC5jcmVhdGVNZXNzYWdlKGd1aWxkSWQsIGNoYW5uZWxJZCwge1xyXG4gICAqICAgY29udGVudDogJ0hlbGxvIDxAMTIzPiEnLCAgLy8gQmVjb21lcyBcIkhlbGxvIEB1c2VybmFtZSFcIlxyXG4gICAqIH0pO1xyXG4gICAqIFxyXG4gICAqIC8vIE91ciBuYXRpdmUgZm9ybWF0OlxyXG4gICAqIGF3YWl0IHJlc3QuY3JlYXRlTWVzc2FnZShndWlsZElkLCBjaGFubmVsSWQsIHtcclxuICAgKiAgIGNvbnRlbnQ6ICdIZWxsbyBAaWxrYXkhJyxcclxuICAgKiAgIG1lbnRpb25zOiB7IHVzZXJzOiBbeyBpZDogMTIzLCB1c2VybmFtZTogJ2lsa2F5JyB9XSB9XHJcbiAgICogfSk7XHJcbiAgICovXHJcbiAgYXN5bmMgY3JlYXRlTWVzc2FnZShndWlsZElkT3JDaGFubmVsSWQ6IHN0cmluZywgY2hhbm5lbElkT3JEYXRhOiBzdHJpbmcgfCB7XHJcbiAgICBjb250ZW50Pzogc3RyaW5nO1xyXG4gICAgZW1iZWRzPzogQVBJRW1iZWRbXTtcclxuICAgIGNvbXBvbmVudHM/OiBhbnlbXTtcclxuICAgIG1lbnRpb25zPzogTWVudGlvbnNEYXRhO1xyXG4gICAgZmlsZXM/OiBBcnJheTx7IG5hbWU6IHN0cmluZzsgZGF0YTogQnVmZmVyIH0+O1xyXG4gICAgbWVzc2FnZV9yZWZlcmVuY2U/OiB7IG1lc3NhZ2VfaWQ6IHN0cmluZyB9O1xyXG4gICAgaW50ZXJhY3Rpb25JZD86IHN0cmluZztcclxuICB9LCBkYXRhPzoge1xyXG4gICAgY29udGVudD86IHN0cmluZztcclxuICAgIGVtYmVkcz86IEFQSUVtYmVkW107XHJcbiAgICBjb21wb25lbnRzPzogYW55W107XHJcbiAgICBtZW50aW9ucz86IE1lbnRpb25zRGF0YTtcclxuICAgIGZpbGVzPzogQXJyYXk8eyBuYW1lOiBzdHJpbmc7IGRhdGE6IEJ1ZmZlciB9PjtcclxuICAgIG1lc3NhZ2VfcmVmZXJlbmNlPzogeyBtZXNzYWdlX2lkOiBzdHJpbmcgfTtcclxuICAgIGludGVyYWN0aW9uSWQ/OiBzdHJpbmc7XHJcbiAgfSk6IFByb21pc2U8QVBJTWVzc2FnZT4ge1xyXG4gICAgLy8gxLBraSBrdWxsYW7EsW0gxZ9la2xpOlxyXG4gICAgLy8gMS4gY3JlYXRlTWVzc2FnZShndWlsZElkLCBjaGFubmVsSWQsIGRhdGEpIC0gZ3VpbGRJZCBpbGUgKHRlcmNpaCBlZGlsZW4pXHJcbiAgICAvLyAyLiBjcmVhdGVNZXNzYWdlKGNoYW5uZWxJZCwgZGF0YSkgLSBndWlsZElkIG9sbWFkYW4gKGVza2kgZm9ybWF0LCBoYXRhIHZlcmlyKVxyXG4gICAgXHJcbiAgICBsZXQgZ3VpbGRJZDogc3RyaW5nO1xyXG4gICAgbGV0IGNoYW5uZWxJZDogc3RyaW5nO1xyXG4gICAgbGV0IG1lc3NhZ2VEYXRhOiBhbnk7XHJcbiAgICBcclxuICAgIGlmICh0eXBlb2YgY2hhbm5lbElkT3JEYXRhID09PSAnc3RyaW5nJyAmJiBkYXRhKSB7XHJcbiAgICAgIC8vIFllbmkgZm9ybWF0OiBjcmVhdGVNZXNzYWdlKGd1aWxkSWQsIGNoYW5uZWxJZCwgZGF0YSlcclxuICAgICAgZ3VpbGRJZCA9IGd1aWxkSWRPckNoYW5uZWxJZDtcclxuICAgICAgY2hhbm5lbElkID0gY2hhbm5lbElkT3JEYXRhO1xyXG4gICAgICBtZXNzYWdlRGF0YSA9IHRoaXMucHJlcGFyZU1lc3NhZ2VEYXRhKGRhdGEpO1xyXG4gICAgICBcclxuICAgICAgLy8gQWRkIGludGVyYWN0aW9uX2lkIGlmIHByb3ZpZGVkXHJcbiAgICAgIGlmIChkYXRhLmludGVyYWN0aW9uSWQpIHtcclxuICAgICAgICBtZXNzYWdlRGF0YS5pbnRlcmFjdGlvbl9pZCA9IGRhdGEuaW50ZXJhY3Rpb25JZDtcclxuICAgICAgfVxyXG4gICAgfSBlbHNlIGlmICh0eXBlb2YgY2hhbm5lbElkT3JEYXRhID09PSAnb2JqZWN0Jykge1xyXG4gICAgICAvLyBFc2tpIGZvcm1hdDogY3JlYXRlTWVzc2FnZShjaGFubmVsSWQsIGRhdGEpIC0gZ3VpbGRJZCB5b2tcclxuICAgICAgLy8gQnUgZm9ybWF0IGFydMSxayBkZXN0ZWtsZW5taXlvciwgaGF0YSBmxLFybGF0XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcignY3JlYXRlTWVzc2FnZSByZXF1aXJlcyBndWlsZElkOiBjcmVhdGVNZXNzYWdlKGd1aWxkSWQsIGNoYW5uZWxJZCwgZGF0YSknKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBjcmVhdGVNZXNzYWdlIGFyZ3VtZW50cycpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PEFQSU1lc3NhZ2U+KCdQT1NUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vY2hhbm5lbHMvJHtjaGFubmVsSWR9L21lc3NhZ2VzYCwgbWVzc2FnZURhdGEpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGFuIGVwaGVtZXJhbCBtZXNzYWdlIHRoYXQgaXMgb25seSB2aXNpYmxlIHRvIGEgc3BlY2lmaWMgdXNlclxyXG4gICAqIEVwaGVtZXJhbCBtZXNzYWdlcyBhcmUgTk9UIHNhdmVkIHRvIGRhdGFiYXNlIC0gdGhleSBhcmUgb25seSBzZW50IHZpYSBXZWJTb2NrZXRcclxuICAgKiBcclxuICAgKiBAZXhhbXBsZVxyXG4gICAqIC8vIFNlbmQgYSB3YXJuaW5nIG9ubHkgdmlzaWJsZSB0byB0aGUgdXNlclxyXG4gICAqIGF3YWl0IHJlc3QuY3JlYXRlRXBoZW1lcmFsTWVzc2FnZShndWlsZElkLCBjaGFubmVsSWQsIHRhcmdldFVzZXJJZCwge1xyXG4gICAqICAgZW1iZWRzOiBbd2FybmluZ0VtYmVkXVxyXG4gICAqIH0pO1xyXG4gICAqL1xyXG4gIGFzeW5jIGNyZWF0ZUVwaGVtZXJhbE1lc3NhZ2UoZ3VpbGRJZDogc3RyaW5nLCBjaGFubmVsSWQ6IHN0cmluZywgdGFyZ2V0VXNlcklkOiBzdHJpbmcgfCBudW1iZXIsIGRhdGE6IHtcclxuICAgIGNvbnRlbnQ/OiBzdHJpbmc7XHJcbiAgICBlbWJlZHM/OiBBUElFbWJlZFtdO1xyXG4gIH0pOiBQcm9taXNlPHsgaWQ6IHN0cmluZzsgZXBoZW1lcmFsOiBib29sZWFuOyBmbGFnczogbnVtYmVyIH0+IHtcclxuICAgIGNvbnN0IG1lc3NhZ2VEYXRhID0gdGhpcy5wcmVwYXJlTWVzc2FnZURhdGEoZGF0YSk7XHJcbiAgICBcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8eyBpZDogc3RyaW5nOyBlcGhlbWVyYWw6IGJvb2xlYW47IGZsYWdzOiBudW1iZXIgfT4oJ1BPU1QnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH0vbWVzc2FnZXNgLCB7XHJcbiAgICAgIC4uLm1lc3NhZ2VEYXRhLFxyXG4gICAgICBmbGFnczogNjQsIC8vIEVQSEVNRVJBTCBmbGFnXHJcbiAgICAgIHRhcmdldF91c2VyX2lkOiB0eXBlb2YgdGFyZ2V0VXNlcklkID09PSAnc3RyaW5nJyA/IHBhcnNlSW50KHRhcmdldFVzZXJJZCwgMTApIDogdGFyZ2V0VXNlcklkXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIERNIG1lc3NhZ2VcclxuICAgKi9cclxuICBhc3luYyBjcmVhdGVETU1lc3NhZ2UoY2hhbm5lbElkOiBzdHJpbmcsIGRhdGE6IHtcclxuICAgIGNvbnRlbnQ/OiBzdHJpbmc7XHJcbiAgICBlbWJlZHM/OiBBUElFbWJlZFtdO1xyXG4gIH0pOiBQcm9taXNlPEFQSU1lc3NhZ2U+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Q8QVBJTWVzc2FnZT4oJ1BPU1QnLCBgL2JvdC9kbS8ke2NoYW5uZWxJZH1gLCBkYXRhKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEVkaXQgYSBtZXNzYWdlXHJcbiAgICogQXV0b21hdGljYWxseSBwcm9jZXNzZXMgbWVudGlvbnNcclxuICAgKi9cclxuICBhc3luYyBlZGl0TWVzc2FnZShndWlsZElkOiBzdHJpbmcsIGNoYW5uZWxJZDogc3RyaW5nLCBtZXNzYWdlSWQ6IHN0cmluZywgZGF0YToge1xyXG4gICAgY29udGVudD86IHN0cmluZztcclxuICAgIGVtYmVkcz86IEFQSUVtYmVkW107XHJcbiAgICBtZW50aW9ucz86IE1lbnRpb25zRGF0YTtcclxuICB9KTogUHJvbWlzZTxBUElNZXNzYWdlPiB7XHJcbiAgICBjb25zdCBwYXRoID0gYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vY2hhbm5lbHMvJHtjaGFubmVsSWR9L21lc3NhZ2VzLyR7bWVzc2FnZUlkfWA7XHJcbiAgICBjb25zdCBwcm9jZXNzZWREYXRhID0gdGhpcy5wcmVwYXJlTWVzc2FnZURhdGEoZGF0YSk7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PEFQSU1lc3NhZ2U+KCdQQVRDSCcsIHBhdGgsIHByb2Nlc3NlZERhdGEpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVsZXRlIGEgbWVzc2FnZVxyXG4gICAqL1xyXG4gIGFzeW5jIGRlbGV0ZU1lc3NhZ2UoZ3VpbGRJZDogc3RyaW5nLCBjaGFubmVsSWQ6IHN0cmluZywgbWVzc2FnZUlkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IHBhdGggPSBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH0vbWVzc2FnZXMvJHttZXNzYWdlSWR9YDtcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdDx2b2lkPignREVMRVRFJywgcGF0aCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBZGQgYSByZWFjdGlvbiB0byBhIG1lc3NhZ2VcclxuICAgKi9cclxuICBhc3luYyBhZGRSZWFjdGlvbihndWlsZElkOiBzdHJpbmcsIGNoYW5uZWxJZDogc3RyaW5nLCBtZXNzYWdlSWQ6IHN0cmluZywgZW1vamk6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgcGF0aCA9IGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS9tZXNzYWdlcy8ke21lc3NhZ2VJZH0vcmVhY3Rpb25zLyR7ZW5jb2RlVVJJQ29tcG9uZW50KGVtb2ppKX0vQG1lYDtcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdDx2b2lkPignUFVUJywgcGF0aCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBVcGxvYWQgYW4gYXR0YWNobWVudCB0byBhIGNoYW5uZWxcclxuICAgKi9cclxuICBhc3luYyB1cGxvYWRBdHRhY2htZW50KGd1aWxkSWQ6IHN0cmluZywgY2hhbm5lbElkOiBzdHJpbmcsIGZpbGU6IHsgbmFtZTogc3RyaW5nOyBkYXRhOiBCdWZmZXI7IGNvbnRlbnRUeXBlPzogc3RyaW5nIH0pOiBQcm9taXNlPHsgaWQ6IHN0cmluZzsgdXJsOiBzdHJpbmc7IGZpbGVuYW1lOiBzdHJpbmcgfT4ge1xyXG4gICAgY29uc3QgRm9ybURhdGEgPSByZXF1aXJlKCdmb3JtLWRhdGEnKTtcclxuICAgIGNvbnN0IGZvcm0gPSBuZXcgRm9ybURhdGEoKTtcclxuICAgIFxyXG4gICAgLy8gZm9ybS1kYXRhIGV4cGVjdHMgdGhlIGJ1ZmZlciBkaXJlY3RseSB3aXRoIG9wdGlvbnNcclxuICAgIGZvcm0uYXBwZW5kKCdmaWxlJywgZmlsZS5kYXRhLCB7XHJcbiAgICAgIGZpbGVuYW1lOiBmaWxlLm5hbWUsXHJcbiAgICAgIGNvbnRlbnRUeXBlOiBmaWxlLmNvbnRlbnRUeXBlIHx8ICd0ZXh0L3BsYWluJ1xyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIGNvbnN0IHVybCA9IGAke3RoaXMuYmFzZVVybH0vYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS9hdHRhY2htZW50c2A7XHJcbiAgICBcclxuICAgIGNvbnNvbGUubG9nKGBbUkVTVF0gVXBsb2FkaW5nIGF0dGFjaG1lbnQ6ICR7ZmlsZS5uYW1lfSAoJHtmaWxlLmRhdGEubGVuZ3RofSBieXRlcylgKTtcclxuICAgIFxyXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCh1cmwsIHtcclxuICAgICAgbWV0aG9kOiAnUE9TVCcsXHJcbiAgICAgIGhlYWRlcnM6IHtcclxuICAgICAgICAnQXV0aG9yaXphdGlvbic6IGBCb3QgJHt0aGlzLnRva2VufWAsXHJcbiAgICAgICAgLi4uZm9ybS5nZXRIZWFkZXJzKClcclxuICAgICAgfSxcclxuICAgICAgYm9keTogZm9ybS5nZXRCdWZmZXIoKVxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIGlmICghcmVzcG9uc2Uub2spIHtcclxuICAgICAgY29uc3QgZXJyb3IgPSBhd2FpdCByZXNwb25zZS50ZXh0KCk7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQVBJIEVycm9yICR7cmVzcG9uc2Uuc3RhdHVzfTogJHtlcnJvcn1gKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgcmV0dXJuIHJlc3BvbnNlLmpzb24oKSBhcyBQcm9taXNlPHsgaWQ6IHN0cmluZzsgdXJsOiBzdHJpbmc7IGZpbGVuYW1lOiBzdHJpbmcgfT47XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgYSBtZXNzYWdlIHdpdGggYSBmaWxlIGF0dGFjaG1lbnRcclxuICAgKi9cclxuICBhc3luYyBjcmVhdGVNZXNzYWdlV2l0aEZpbGUoZ3VpbGRJZDogc3RyaW5nLCBjaGFubmVsSWQ6IHN0cmluZywgZGF0YToge1xyXG4gICAgY29udGVudD86IHN0cmluZztcclxuICAgIGZpbGU6IHsgbmFtZTogc3RyaW5nOyBkYXRhOiBCdWZmZXI7IGNvbnRlbnRUeXBlPzogc3RyaW5nIH07XHJcbiAgICBpbnRlcmFjdGlvbklkPzogc3RyaW5nO1xyXG4gIH0pOiBQcm9taXNlPEFQSU1lc3NhZ2U+IHtcclxuICAgIGNvbnN0IEZvcm1EYXRhID0gcmVxdWlyZSgnZm9ybS1kYXRhJyk7XHJcbiAgICBjb25zdCBmb3JtID0gbmV3IEZvcm1EYXRhKCk7XHJcbiAgICBcclxuICAgIC8vIEFkZCBjb250ZW50IGlmIHByb3ZpZGVkXHJcbiAgICBpZiAoZGF0YS5jb250ZW50KSB7XHJcbiAgICAgIGZvcm0uYXBwZW5kKCdjb250ZW50JywgZGF0YS5jb250ZW50KTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgLy8gQWRkIGludGVyYWN0aW9uX2lkIGlmIHByb3ZpZGVkIChmb3IgZGVmZXJyZWQgcmVzcG9uc2UgbWF0Y2hpbmcpXHJcbiAgICBpZiAoZGF0YS5pbnRlcmFjdGlvbklkKSB7XHJcbiAgICAgIGZvcm0uYXBwZW5kKCdpbnRlcmFjdGlvbl9pZCcsIGRhdGEuaW50ZXJhY3Rpb25JZCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIEFkZCBmaWxlXHJcbiAgICBmb3JtLmFwcGVuZCgnZmlsZXMnLCBkYXRhLmZpbGUuZGF0YSwge1xyXG4gICAgICBmaWxlbmFtZTogZGF0YS5maWxlLm5hbWUsXHJcbiAgICAgIGNvbnRlbnRUeXBlOiBkYXRhLmZpbGUuY29udGVudFR5cGUgfHwgJ3RleHQvcGxhaW4nXHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgY29uc3QgdXJsID0gYCR7dGhpcy5iYXNlVXJsfS9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vY2hhbm5lbHMvJHtjaGFubmVsSWR9L21lc3NhZ2VzYDtcclxuICAgIFxyXG4gICAgY29uc29sZS5sb2coYFtSRVNUXSBDcmVhdGluZyBtZXNzYWdlIHdpdGggZmlsZTogJHtkYXRhLmZpbGUubmFtZX0gKCR7ZGF0YS5maWxlLmRhdGEubGVuZ3RofSBieXRlcykke2RhdGEuaW50ZXJhY3Rpb25JZCA/IGAgW2ludGVyYWN0aW9uOiAke2RhdGEuaW50ZXJhY3Rpb25JZH1dYCA6ICcnfWApO1xyXG4gICAgXHJcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybCwge1xyXG4gICAgICBtZXRob2Q6ICdQT1NUJyxcclxuICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgICdBdXRob3JpemF0aW9uJzogYEJvdCAke3RoaXMudG9rZW59YCxcclxuICAgICAgICAuLi5mb3JtLmdldEhlYWRlcnMoKVxyXG4gICAgICB9LFxyXG4gICAgICBib2R5OiBmb3JtLmdldEJ1ZmZlcigpXHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgaWYgKCFyZXNwb25zZS5vaykge1xyXG4gICAgICBjb25zdCBlcnJvciA9IGF3YWl0IHJlc3BvbnNlLnRleHQoKTtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBBUEkgRXJyb3IgJHtyZXNwb25zZS5zdGF0dXN9OiAke2Vycm9yfWApO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICByZXR1cm4gcmVzcG9uc2UuanNvbigpIGFzIFByb21pc2U8QVBJTWVzc2FnZT47XHJcbiAgfVxyXG5cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PSBJbnRlcmFjdGlvbnMgPT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGFuIGludGVyYWN0aW9uIHJlc3BvbnNlXHJcbiAgICogQXV0b21hdGljYWxseSBwcm9jZXNzZXMgbWVudGlvbnMgaW4gY29udGVudCBhbmQgZW1iZWRzXHJcbiAgICovXHJcbiAgYXN5bmMgY3JlYXRlSW50ZXJhY3Rpb25SZXNwb25zZShpbnRlcmFjdGlvbklkOiBzdHJpbmcsIHRva2VuOiBzdHJpbmcsIGRhdGE6IHtcclxuICAgIHR5cGU6IG51bWJlcjtcclxuICAgIGRhdGE/OiBhbnk7XHJcbiAgfSk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc29sZS5sb2coYPCfk6QgSW50ZXJhY3Rpb24gcmVzcG9uc2U6ICR7aW50ZXJhY3Rpb25JZH0gLT4gdHlwZSAke2RhdGEudHlwZX1gKTtcclxuICAgIHRyeSB7XHJcbiAgICAgIC8vIFByb2Nlc3MgbWVudGlvbnMgaW4gcmVzcG9uc2UgZGF0YSBpZiBwcmVzZW50XHJcbiAgICAgIGxldCBwcm9jZXNzZWREYXRhID0gZGF0YTtcclxuICAgICAgaWYgKGRhdGEuZGF0YSAmJiAoZGF0YS5kYXRhLmNvbnRlbnQgfHwgZGF0YS5kYXRhLmVtYmVkcykpIHtcclxuICAgICAgICBwcm9jZXNzZWREYXRhID0ge1xyXG4gICAgICAgICAgLi4uZGF0YSxcclxuICAgICAgICAgIGRhdGE6IHRoaXMucHJlcGFyZU1lc3NhZ2VEYXRhKGRhdGEuZGF0YSlcclxuICAgICAgICB9O1xyXG4gICAgICB9XHJcbiAgICAgIFxyXG4gICAgICBhd2FpdCB0aGlzLnJlcXVlc3Q8dm9pZD4oJ1BPU1QnLCBgL2ludGVyYWN0aW9ucy8ke2ludGVyYWN0aW9uSWR9LyR7dG9rZW59L2NhbGxiYWNrYCwgcHJvY2Vzc2VkRGF0YSk7XHJcbiAgICAgIGNvbnNvbGUubG9nKGDinIUgSW50ZXJhY3Rpb24gcmVzcG9uc2Ugc2VudGApO1xyXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgY29uc29sZS5lcnJvcihg4p2MIEludGVyYWN0aW9uIHJlc3BvbnNlIGVycm9yOmAsIGVycm9yKTtcclxuICAgICAgdGhyb3cgZXJyb3I7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBFZGl0IHRoZSBvcmlnaW5hbCBpbnRlcmFjdGlvbiByZXNwb25zZVxyXG4gICAqIElmIGZpbGVzIGFyZSBwcm92aWRlZCwgY3JlYXRlcyBhIG5ldyBtZXNzYWdlIHdpdGggZmlsZXMgKHNpbmNlIHdlYmhvb2sgZWRpdCBkb2Vzbid0IHN1cHBvcnQgZmlsZSB1cGxvYWQpXHJcbiAgICogQXV0b21hdGljYWxseSBwcm9jZXNzZXMgbWVudGlvbnNcclxuICAgKi9cclxuICBhc3luYyBlZGl0SW50ZXJhY3Rpb25SZXNwb25zZSh0b2tlbjogc3RyaW5nLCBkYXRhOiB7XHJcbiAgICBjb250ZW50Pzogc3RyaW5nO1xyXG4gICAgZW1iZWRzPzogQVBJRW1iZWRbXTtcclxuICAgIGNvbXBvbmVudHM/OiBhbnlbXTtcclxuICAgIG1lbnRpb25zPzogTWVudGlvbnNEYXRhO1xyXG4gICAgZmlsZXM/OiBBcnJheTx7IG5hbWU6IHN0cmluZzsgZGF0YTogQnVmZmVyOyBjb250ZW50VHlwZT86IHN0cmluZyB9PjtcclxuICB9LCBndWlsZElkPzogc3RyaW5nLCBjaGFubmVsSWQ/OiBzdHJpbmcsIGludGVyYWN0aW9uSWQ/OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IGFwcElkID0gdGhpcy5nZXRBcHBsaWNhdGlvbklkKCk7XHJcbiAgICBcclxuICAgIC8vIFByb2Nlc3MgbWVudGlvbnMgaW4gY29udGVudFxyXG4gICAgY29uc3QgcHJvY2Vzc2VkRGF0YSA9IHRoaXMucHJlcGFyZU1lc3NhZ2VEYXRhKGRhdGEpO1xyXG4gICAgXHJcbiAgICAvLyBJZiBmaWxlcyBhcmUgcHJlc2VudCBhbmQgd2UgaGF2ZSBndWlsZC9jaGFubmVsIGluZm8sIGNyZWF0ZSBtZXNzYWdlIHdpdGggZmlsZSBpbnN0ZWFkXHJcbiAgICBpZiAoZGF0YS5maWxlcyAmJiBkYXRhLmZpbGVzLmxlbmd0aCA+IDAgJiYgZ3VpbGRJZCAmJiBjaGFubmVsSWQpIHtcclxuICAgICAgY29uc29sZS5sb2coYFtSRVNUXSBlZGl0SW50ZXJhY3Rpb25SZXNwb25zZSB3aXRoICR7ZGF0YS5maWxlcy5sZW5ndGh9IGZpbGVzIC0gdXNpbmcgY3JlYXRlTWVzc2FnZVdpdGhGaWxlYCk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBDcmVhdGUgbWVzc2FnZSB3aXRoIGZpbGVcclxuICAgICAgY29uc3QgZmlsZSA9IGRhdGEuZmlsZXNbMF07IC8vIEZvciBub3csIHN1cHBvcnQgc2luZ2xlIGZpbGVcclxuICAgICAgYXdhaXQgdGhpcy5jcmVhdGVNZXNzYWdlV2l0aEZpbGUoZ3VpbGRJZCwgY2hhbm5lbElkLCB7XHJcbiAgICAgICAgY29udGVudDogcHJvY2Vzc2VkRGF0YS5jb250ZW50LFxyXG4gICAgICAgIGZpbGU6IGZpbGUsXHJcbiAgICAgICAgaW50ZXJhY3Rpb25JZDogaW50ZXJhY3Rpb25JZFxyXG4gICAgICB9KTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvLyBJZiB3ZSBoYXZlIGd1aWxkSWQsIGNoYW5uZWxJZCBhbmQgaW50ZXJhY3Rpb25JZCwgY3JlYXRlIGEgbmV3IG1lc3NhZ2Ugd2l0aCBpbnRlcmFjdGlvbl9pZFxyXG4gICAgLy8gVGhpcyBpcyBuZWVkZWQgYmVjYXVzZSBvdXIgZGVmZXJyZWQgcmVzcG9uc2UgZG9lc24ndCBjcmVhdGUgYSBtZXNzYWdlXHJcbiAgICBpZiAoZ3VpbGRJZCAmJiBjaGFubmVsSWQgJiYgaW50ZXJhY3Rpb25JZCkge1xyXG4gICAgICBjb25zb2xlLmxvZyhgW1JFU1RdIGVkaXRJbnRlcmFjdGlvblJlc3BvbnNlIC0gY3JlYXRpbmcgbWVzc2FnZSB3aXRoIGludGVyYWN0aW9uX2lkOiAke2ludGVyYWN0aW9uSWR9YCk7XHJcbiAgICAgIFxyXG4gICAgICBjb25zdCBwYXlsb2FkOiBhbnkgPSB7XHJcbiAgICAgICAgaW50ZXJhY3Rpb25faWQ6IGludGVyYWN0aW9uSWRcclxuICAgICAgfTtcclxuICAgICAgaWYgKHByb2Nlc3NlZERhdGEuY29udGVudCAhPT0gdW5kZWZpbmVkKSBwYXlsb2FkLmNvbnRlbnQgPSBwcm9jZXNzZWREYXRhLmNvbnRlbnQ7XHJcbiAgICAgIGlmIChwcm9jZXNzZWREYXRhLmVtYmVkcykgcGF5bG9hZC5lbWJlZHMgPSBwcm9jZXNzZWREYXRhLmVtYmVkcztcclxuICAgICAgaWYgKHByb2Nlc3NlZERhdGEuY29tcG9uZW50cykgcGF5bG9hZC5jb21wb25lbnRzID0gcHJvY2Vzc2VkRGF0YS5jb21wb25lbnRzO1xyXG4gICAgICBpZiAocHJvY2Vzc2VkRGF0YS5tZW50aW9ucykgcGF5bG9hZC5tZW50aW9ucyA9IHByb2Nlc3NlZERhdGEubWVudGlvbnM7XHJcbiAgICAgIFxyXG4gICAgICBhd2FpdCB0aGlzLnJlcXVlc3Q8dm9pZD4oJ1BPU1QnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH0vbWVzc2FnZXNgLCBwYXlsb2FkKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvLyBGYWxsYmFjazogUmVndWxhciBlZGl0IHdpdGhvdXQgZmlsZXMgKHdlYmhvb2sgUEFUQ0gpXHJcbiAgICBjb25zdCBwYXlsb2FkOiBhbnkgPSB7fTtcclxuICAgIGlmIChwcm9jZXNzZWREYXRhLmNvbnRlbnQgIT09IHVuZGVmaW5lZCkgcGF5bG9hZC5jb250ZW50ID0gcHJvY2Vzc2VkRGF0YS5jb250ZW50O1xyXG4gICAgaWYgKHByb2Nlc3NlZERhdGEuZW1iZWRzKSBwYXlsb2FkLmVtYmVkcyA9IHByb2Nlc3NlZERhdGEuZW1iZWRzO1xyXG4gICAgaWYgKHByb2Nlc3NlZERhdGEuY29tcG9uZW50cykgcGF5bG9hZC5jb21wb25lbnRzID0gcHJvY2Vzc2VkRGF0YS5jb21wb25lbnRzO1xyXG4gICAgaWYgKHByb2Nlc3NlZERhdGEubWVudGlvbnMpIHBheWxvYWQubWVudGlvbnMgPSBwcm9jZXNzZWREYXRhLm1lbnRpb25zO1xyXG4gICAgXHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3Q8dm9pZD4oJ1BBVENIJywgYC93ZWJob29rcy8ke2FwcElkfS8ke3Rva2VufS9tZXNzYWdlcy9Ab3JpZ2luYWxgLCBwYXlsb2FkKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlbGV0ZSB0aGUgb3JpZ2luYWwgaW50ZXJhY3Rpb24gcmVzcG9uc2VcclxuICAgKi9cclxuICBhc3luYyBkZWxldGVJbnRlcmFjdGlvblJlc3BvbnNlKHRva2VuOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IGFwcElkID0gdGhpcy5nZXRBcHBsaWNhdGlvbklkKCk7XHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3Q8dm9pZD4oJ0RFTEVURScsIGAvd2ViaG9va3MvJHthcHBJZH0vJHt0b2tlbn0vbWVzc2FnZXMvQG9yaWdpbmFsYCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgYSBmb2xsb3d1cCBtZXNzYWdlXHJcbiAgICogQXV0b21hdGljYWxseSBwcm9jZXNzZXMgbWVudGlvbnNcclxuICAgKi9cclxuICBhc3luYyBjcmVhdGVGb2xsb3d1cCh0b2tlbjogc3RyaW5nLCBkYXRhOiB7XHJcbiAgICBjb250ZW50Pzogc3RyaW5nO1xyXG4gICAgZW1iZWRzPzogQVBJRW1iZWRbXTtcclxuICAgIG1lbnRpb25zPzogTWVudGlvbnNEYXRhO1xyXG4gICAgZmxhZ3M/OiBudW1iZXI7XHJcbiAgfSk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgYXBwSWQgPSB0aGlzLmdldEFwcGxpY2F0aW9uSWQoKTtcclxuICAgIGNvbnN0IHByb2Nlc3NlZERhdGEgPSB0aGlzLnByZXBhcmVNZXNzYWdlRGF0YShkYXRhKTtcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdDx2b2lkPignUE9TVCcsIGAvd2ViaG9va3MvJHthcHBJZH0vJHt0b2tlbn1gLCBwcm9jZXNzZWREYXRhKTtcclxuICB9XHJcblxyXG4gIC8vID09PT09PT09PT09PT09PT09PT09IENvbW1hbmRzID09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlZ2lzdGVyIGdsb2JhbCBhcHBsaWNhdGlvbiBjb21tYW5kc1xyXG4gICAqL1xyXG4gIGFzeW5jIHJlZ2lzdGVyR2xvYmFsQ29tbWFuZHMoY29tbWFuZHM6IEFQSUFwcGxpY2F0aW9uQ29tbWFuZFtdKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBhcHBJZCA9IHRoaXMuZ2V0QXBwbGljYXRpb25JZCgpO1xyXG4gICAgXHJcbiAgICBmb3IgKGNvbnN0IGNvbW1hbmQgb2YgY29tbWFuZHMpIHtcclxuICAgICAgYXdhaXQgdGhpcy5yZXF1ZXN0PHZvaWQ+KCdQT1NUJywgYC9hcHBsaWNhdGlvbnMvJHthcHBJZH0vY29tbWFuZHNgLCBjb21tYW5kKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlZ2lzdGVyIGd1aWxkLXNwZWNpZmljIGNvbW1hbmRzXHJcbiAgICovXHJcbiAgYXN5bmMgcmVnaXN0ZXJHdWlsZENvbW1hbmRzKGd1aWxkSWQ6IHN0cmluZywgY29tbWFuZHM6IEFQSUFwcGxpY2F0aW9uQ29tbWFuZFtdKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBhcHBJZCA9IHRoaXMuZ2V0QXBwbGljYXRpb25JZCgpO1xyXG4gICAgXHJcbiAgICBmb3IgKGNvbnN0IGNvbW1hbmQgb2YgY29tbWFuZHMpIHtcclxuICAgICAgYXdhaXQgdGhpcy5yZXF1ZXN0PHZvaWQ+KCdQT1NUJywgYC9hcHBsaWNhdGlvbnMvJHthcHBJZH0vZ3VpbGRzLyR7Z3VpbGRJZH0vY29tbWFuZHNgLCBjb21tYW5kKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlbGV0ZSBhIGdsb2JhbCBjb21tYW5kXHJcbiAgICovXHJcbiAgYXN5bmMgZGVsZXRlR2xvYmFsQ29tbWFuZChjb21tYW5kSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgYXBwSWQgPSB0aGlzLmdldEFwcGxpY2F0aW9uSWQoKTtcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdDx2b2lkPignREVMRVRFJywgYC9hcHBsaWNhdGlvbnMvJHthcHBJZH0vY29tbWFuZHMvJHtjb21tYW5kSWR9YCk7XHJcbiAgfVxyXG5cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PSBIZWxwZXJzID09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIHByaXZhdGUgYXBwbGljYXRpb25JZDogc3RyaW5nID0gJyc7XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldCB0aGUgYXBwbGljYXRpb24gSURcclxuICAgKi9cclxuICBzZXRBcHBsaWNhdGlvbklkKGlkOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIHRoaXMuYXBwbGljYXRpb25JZCA9IGlkO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IHRoZSBhcHBsaWNhdGlvbiBJRFxyXG4gICAqL1xyXG4gIHByaXZhdGUgZ2V0QXBwbGljYXRpb25JZCgpOiBzdHJpbmcge1xyXG4gICAgaWYgKCF0aGlzLmFwcGxpY2F0aW9uSWQpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdBcHBsaWNhdGlvbiBJRCBub3Qgc2V0LiBDYWxsIHNldEFwcGxpY2F0aW9uSWQoKSBmaXJzdC4nKTtcclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzLmFwcGxpY2F0aW9uSWQ7XHJcbiAgfVxyXG5cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PSBDaGFubmVscyA9PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgYSBjaGFubmVsIGluIGEgZ3VpbGRcclxuICAgKi9cclxuICBhc3luYyBjcmVhdGVDaGFubmVsKGd1aWxkSWQ6IHN0cmluZywgZGF0YToge1xyXG4gICAgbmFtZTogc3RyaW5nO1xyXG4gICAgdHlwZT86IG51bWJlcjtcclxuICAgIHBhcmVudF9pZD86IHN0cmluZyB8IG51bGw7XHJcbiAgICBjYXRlZ29yeV9pZD86IHN0cmluZyB8IG51bGw7XHJcbiAgICBwZXJtaXNzaW9uX292ZXJ3cml0ZXM/OiBBcnJheTx7XHJcbiAgICAgIGlkOiBzdHJpbmc7XHJcbiAgICAgIHR5cGU6IG51bWJlcjtcclxuICAgICAgYWxsb3c/OiBzdHJpbmc7XHJcbiAgICAgIGRlbnk/OiBzdHJpbmc7XHJcbiAgICB9PjtcclxuICB9KTogUHJvbWlzZTx7IGlkOiBzdHJpbmc7IG5hbWU6IHN0cmluZyB9PiB7XHJcbiAgICAvLyBNYXAgcGFyZW50X2lkIHRvIGNhdGVnb3J5X2lkIGZvciBiYWNrZW5kIGNvbXBhdGliaWxpdHlcclxuICAgIGNvbnN0IHJlcXVlc3REYXRhOiBhbnkgPSB7XHJcbiAgICAgIG5hbWU6IGRhdGEubmFtZSxcclxuICAgICAgdHlwZTogZGF0YS50eXBlID8/IDAsIC8vIERlZmF1bHQgdG8gdGV4dCBjaGFubmVsXHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICAvLyBCYWNrZW5kIGV4cGVjdHMgY2F0ZWdvcnlfaWQsIG5vdCBwYXJlbnRfaWRcclxuICAgIGlmIChkYXRhLmNhdGVnb3J5X2lkKSB7XHJcbiAgICAgIHJlcXVlc3REYXRhLmNhdGVnb3J5X2lkID0gZGF0YS5jYXRlZ29yeV9pZDtcclxuICAgIH0gZWxzZSBpZiAoZGF0YS5wYXJlbnRfaWQpIHtcclxuICAgICAgcmVxdWVzdERhdGEuY2F0ZWdvcnlfaWQgPSBkYXRhLnBhcmVudF9pZDtcclxuICAgIH1cclxuICAgIFxyXG4gICAgLy8gQWRkIHBlcm1pc3Npb25fb3ZlcndyaXRlcyBpZiBwcm92aWRlZFxyXG4gICAgaWYgKGRhdGEucGVybWlzc2lvbl9vdmVyd3JpdGVzICYmIGRhdGEucGVybWlzc2lvbl9vdmVyd3JpdGVzLmxlbmd0aCA+IDApIHtcclxuICAgICAgcmVxdWVzdERhdGEucGVybWlzc2lvbl9vdmVyd3JpdGVzID0gZGF0YS5wZXJtaXNzaW9uX292ZXJ3cml0ZXM7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoJ1BPU1QnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVsc2AsIHJlcXVlc3REYXRhKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlbGV0ZSBhIGNoYW5uZWxcclxuICAgKi9cclxuICAvKipcclxuICAgKiBEZWxldGUgYSBjaGFubmVsXHJcbiAgICovXHJcbiAgYXN5bmMgZGVsZXRlQ2hhbm5lbChndWlsZElkOiBzdHJpbmcsIGNoYW5uZWxJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3QoJ0RFTEVURScsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzLyR7Y2hhbm5lbElkfWApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRWRpdCBjaGFubmVsIHBlcm1pc3Npb24gb3ZlcndyaXRlc1xyXG4gICAqL1xyXG4gIGFzeW5jIGVkaXRDaGFubmVsUGVybWlzc2lvbnMoY2hhbm5lbElkOiBzdHJpbmcsIG92ZXJ3cml0ZUlkOiBzdHJpbmcsIGRhdGE6IHtcclxuICAgIHR5cGU6IG51bWJlcjtcclxuICAgIGFsbG93Pzogc3RyaW5nO1xyXG4gICAgZGVueT86IHN0cmluZztcclxuICB9KTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3QoJ1BVVCcsIGAvYm90L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS9wZXJtaXNzaW9ucy8ke292ZXJ3cml0ZUlkfWAsIGRhdGEpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVsZXRlIGNoYW5uZWwgcGVybWlzc2lvbiBvdmVyd3JpdGVcclxuICAgKi9cclxuICBhc3luYyBkZWxldGVDaGFubmVsUGVybWlzc2lvbihjaGFubmVsSWQ6IHN0cmluZywgb3ZlcndyaXRlSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0KCdERUxFVEUnLCBgL2JvdC9jaGFubmVscy8ke2NoYW5uZWxJZH0vcGVybWlzc2lvbnMvJHtvdmVyd3JpdGVJZH1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBtZXNzYWdlcyBmcm9tIGEgY2hhbm5lbFxyXG4gICAqL1xyXG4gIGFzeW5jIGdldE1lc3NhZ2VzKGd1aWxkSWQ6IHN0cmluZywgY2hhbm5lbElkOiBzdHJpbmcsIG9wdGlvbnM/OiB7XHJcbiAgICBsaW1pdD86IG51bWJlcjtcclxuICAgIGJlZm9yZT86IHN0cmluZztcclxuICAgIGFmdGVyPzogc3RyaW5nO1xyXG4gIH0pOiBQcm9taXNlPEFQSU1lc3NhZ2VbXT4ge1xyXG4gICAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcygpO1xyXG4gICAgaWYgKG9wdGlvbnM/LmxpbWl0KSBwYXJhbXMuYXBwZW5kKCdsaW1pdCcsIFN0cmluZyhvcHRpb25zLmxpbWl0KSk7XHJcbiAgICBpZiAob3B0aW9ucz8uYmVmb3JlKSBwYXJhbXMuYXBwZW5kKCdiZWZvcmUnLCBvcHRpb25zLmJlZm9yZSk7XHJcbiAgICBpZiAob3B0aW9ucz8uYWZ0ZXIpIHBhcmFtcy5hcHBlbmQoJ2FmdGVyJywgb3B0aW9ucy5hZnRlcik7XHJcbiAgICBcclxuICAgIGNvbnN0IHF1ZXJ5ID0gcGFyYW1zLnRvU3RyaW5nKCkgPyBgPyR7cGFyYW1zLnRvU3RyaW5nKCl9YCA6ICcnO1xyXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLnJlcXVlc3Q8eyBtZXNzYWdlczogQVBJTWVzc2FnZVtdOyBwYWdlX2luZm86IGFueSB9PignR0VUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vY2hhbm5lbHMvJHtjaGFubmVsSWR9L21lc3NhZ2VzJHtxdWVyeX1gKTtcclxuICAgIHJldHVybiByZXNwb25zZS5tZXNzYWdlcyB8fCBbXTtcclxuICB9XHJcblxyXG4gIC8vID09PT09PT09PT09PT09PT09PT09IE1lbWJlcnMgPT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGEgZ3VpbGQgbWVtYmVyXHJcbiAgICovXHJcbiAgYXN5bmMgZ2V0TWVtYmVyKGd1aWxkSWQ6IHN0cmluZywgdXNlcklkOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCgnR0VUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vbWVtYmVycy8ke3VzZXJJZH1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFRpbWVvdXQgYSBndWlsZCBtZW1iZXJcclxuICAgKi9cclxuICBhc3luYyB0aW1lb3V0TWVtYmVyKGd1aWxkSWQ6IHN0cmluZywgdXNlcklkOiBzdHJpbmcsIGR1cmF0aW9uOiBudW1iZXIgfCBudWxsLCByZWFzb24/OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGlmIChkdXJhdGlvbiA9PT0gbnVsbCkge1xyXG4gICAgICAvLyBDbGVhciB0aW1lb3V0XHJcbiAgICAgIGF3YWl0IHRoaXMucmVxdWVzdCgnUE9TVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L21lbWJlcnMvJHt1c2VySWR9L3RpbWVvdXQvY2xlYXJgLCB7XHJcbiAgICAgICAgcmVhc29uXHJcbiAgICAgIH0pO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgLy8gU2V0IHRpbWVvdXRcclxuICAgICAgY29uc3QgdW50aWwgPSBuZXcgRGF0ZShEYXRlLm5vdygpICsgZHVyYXRpb24pLnRvSVNPU3RyaW5nKCk7XHJcbiAgICAgIGF3YWl0IHRoaXMucmVxdWVzdCgnUE9TVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L21lbWJlcnMvJHt1c2VySWR9L3RpbWVvdXRgLCB7XHJcbiAgICAgICAgdW50aWwsXHJcbiAgICAgICAgcmVhc29uXHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogS2ljayBhIGd1aWxkIG1lbWJlclxyXG4gICAqL1xyXG4gIGFzeW5jIGtpY2tNZW1iZXIoZ3VpbGRJZDogc3RyaW5nLCB1c2VySWQ6IHN0cmluZywgcmVhc29uPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBxdWVyeSA9IHJlYXNvbiA/IGA/cmVhc29uPSR7ZW5jb2RlVVJJQ29tcG9uZW50KHJlYXNvbil9YCA6ICcnO1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0KCdERUxFVEUnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9tZW1iZXJzLyR7dXNlcklkfSR7cXVlcnl9YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBCYW4gYSBndWlsZCBtZW1iZXJcclxuICAgKi9cclxuICBhc3luYyBiYW5NZW1iZXIoZ3VpbGRJZDogc3RyaW5nLCB1c2VySWQ6IHN0cmluZywgb3B0aW9ucz86IHtcclxuICAgIGRlbGV0ZU1lc3NhZ2VEYXlzPzogbnVtYmVyO1xyXG4gICAgZGVsZXRlTWVzc2FnZVNlY29uZHM/OiBudW1iZXI7XHJcbiAgICByZWFzb24/OiBzdHJpbmc7XHJcbiAgfSk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0KCdQVVQnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9iYW5zLyR7dXNlcklkfWAsIHtcclxuICAgICAgZGVsZXRlX21lc3NhZ2VfZGF5czogb3B0aW9ucz8uZGVsZXRlTWVzc2FnZURheXMsXHJcbiAgICAgIGRlbGV0ZV9tZXNzYWdlX3NlY29uZHM6IG9wdGlvbnM/LmRlbGV0ZU1lc3NhZ2VTZWNvbmRzLFxyXG4gICAgICByZWFzb246IG9wdGlvbnM/LnJlYXNvblxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBVbmJhbiBhIHVzZXJcclxuICAgKi9cclxuICBhc3luYyB1bmJhbk1lbWJlcihndWlsZElkOiBzdHJpbmcsIHVzZXJJZDogc3RyaW5nLCByZWFzb24/OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IHF1ZXJ5ID0gcmVhc29uID8gYD9yZWFzb249JHtlbmNvZGVVUklDb21wb25lbnQocmVhc29uKX1gIDogJyc7XHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3QoJ0RFTEVURScsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2JhbnMvJHt1c2VySWR9JHtxdWVyeX1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEVkaXQgYSBndWlsZCBtZW1iZXJcclxuICAgKi9cclxuICBhc3luYyBlZGl0TWVtYmVyKGd1aWxkSWQ6IHN0cmluZywgdXNlcklkOiBzdHJpbmcsIGRhdGE6IHtcclxuICAgIG5pY2s/OiBzdHJpbmcgfCBudWxsO1xyXG4gICAgcm9sZXM/OiBzdHJpbmdbXTtcclxuICAgIG11dGU/OiBib29sZWFuO1xyXG4gICAgZGVhZj86IGJvb2xlYW47XHJcbiAgICBjaGFubmVsX2lkPzogc3RyaW5nIHwgbnVsbDtcclxuICAgIGNvbW11bmljYXRpb25fZGlzYWJsZWRfdW50aWw/OiBzdHJpbmcgfCBudWxsO1xyXG4gICAgcmVhc29uPzogc3RyaW5nO1xyXG4gIH0pOiBQcm9taXNlPGFueT4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCgnUEFUQ0gnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9tZW1iZXJzLyR7dXNlcklkfWAsIGRhdGEpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRkIGEgcm9sZSB0byBhIG1lbWJlclxyXG4gICAqL1xyXG4gIGFzeW5jIGFkZE1lbWJlclJvbGUoZ3VpbGRJZDogc3RyaW5nLCB1c2VySWQ6IHN0cmluZywgcm9sZUlkOiBzdHJpbmcsIHJlYXNvbj86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgcXVlcnkgPSByZWFzb24gPyBgP3JlYXNvbj0ke2VuY29kZVVSSUNvbXBvbmVudChyZWFzb24pfWAgOiAnJztcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdCgnUFVUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vbWVtYmVycy8ke3VzZXJJZH0vcm9sZXMvJHtyb2xlSWR9JHtxdWVyeX1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlbW92ZSBhIHJvbGUgZnJvbSBhIG1lbWJlclxyXG4gICAqL1xyXG4gIGFzeW5jIHJlbW92ZU1lbWJlclJvbGUoZ3VpbGRJZDogc3RyaW5nLCB1c2VySWQ6IHN0cmluZywgcm9sZUlkOiBzdHJpbmcsIHJlYXNvbj86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgcXVlcnkgPSByZWFzb24gPyBgP3JlYXNvbj0ke2VuY29kZVVSSUNvbXBvbmVudChyZWFzb24pfWAgOiAnJztcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdCgnREVMRVRFJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vbWVtYmVycy8ke3VzZXJJZH0vcm9sZXMvJHtyb2xlSWR9JHtxdWVyeX1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEJ1bGsgZGVsZXRlIG1lc3NhZ2VzXHJcbiAgICovXHJcbiAgYXN5bmMgYnVsa0RlbGV0ZU1lc3NhZ2VzKGd1aWxkSWQ6IHN0cmluZywgY2hhbm5lbElkOiBzdHJpbmcsIG1lc3NhZ2VJZHM6IHN0cmluZ1tdKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3QoJ1BPU1QnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH0vbWVzc2FnZXMvYnVsay1kZWxldGVgLCB7XHJcbiAgICAgIG1lc3NhZ2VzOiBtZXNzYWdlSWRzXHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8vID09PT09PT09PT09PT09PT09PT09IEd1aWxkcyA9PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSBndWlsZFxyXG4gICAqL1xyXG4gIGFzeW5jIGdldEd1aWxkKGd1aWxkSWQ6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KCdHRVQnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfWApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGd1aWxkIGNoYW5uZWxzXHJcbiAgICovXHJcbiAgYXN5bmMgZ2V0R3VpbGRDaGFubmVscyhndWlsZElkOiBzdHJpbmcpOiBQcm9taXNlPGFueVtdPiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KCdHRVQnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVsc2ApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGd1aWxkIHJvbGVzXHJcbiAgICovXHJcbiAgYXN5bmMgZ2V0Um9sZXMoZ3VpbGRJZDogc3RyaW5nKTogUHJvbWlzZTxhbnlbXT4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCgnR0VUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vcm9sZXNgKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIHJvbGVcclxuICAgKi9cclxuICBhc3luYyBjcmVhdGVSb2xlKGd1aWxkSWQ6IHN0cmluZywgZGF0YToge1xyXG4gICAgbmFtZT86IHN0cmluZztcclxuICAgIGNvbG9yPzogbnVtYmVyO1xyXG4gICAgaG9pc3Q/OiBib29sZWFuO1xyXG4gICAgbWVudGlvbmFibGU/OiBib29sZWFuO1xyXG4gICAgcGVybWlzc2lvbnM/OiBzdHJpbmc7XHJcbiAgfSk6IFByb21pc2U8YW55PiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KCdQT1NUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vcm9sZXNgLCBkYXRhKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEVkaXQgYSByb2xlXHJcbiAgICovXHJcbiAgYXN5bmMgZWRpdFJvbGUoZ3VpbGRJZDogc3RyaW5nLCByb2xlSWQ6IHN0cmluZywgZGF0YToge1xyXG4gICAgbmFtZT86IHN0cmluZztcclxuICAgIGNvbG9yPzogbnVtYmVyO1xyXG4gICAgaG9pc3Q/OiBib29sZWFuO1xyXG4gICAgbWVudGlvbmFibGU/OiBib29sZWFuO1xyXG4gICAgcGVybWlzc2lvbnM/OiBzdHJpbmc7XHJcbiAgfSk6IFByb21pc2U8YW55PiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KCdQQVRDSCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L3JvbGVzLyR7cm9sZUlkfWAsIGRhdGEpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVsZXRlIGEgcm9sZVxyXG4gICAqL1xyXG4gIGFzeW5jIGRlbGV0ZVJvbGUoZ3VpbGRJZDogc3RyaW5nLCByb2xlSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0KCdERUxFVEUnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9yb2xlcy8ke3JvbGVJZH1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBndWlsZCBlbW9qaXNcclxuICAgKi9cclxuICBhc3luYyBnZXRFbW9qaXMoZ3VpbGRJZDogc3RyaW5nKTogUHJvbWlzZTxhbnlbXT4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCgnR0VUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vZW1vamlzYCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgZ3VpbGQgYmFuc1xyXG4gICAqL1xyXG4gIGFzeW5jIGdldEJhbnMoZ3VpbGRJZDogc3RyaW5nKTogUHJvbWlzZTxhbnlbXT4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCgnR0VUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vYmFuc2ApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGEgc3BlY2lmaWMgYmFuXHJcbiAgICovXHJcbiAgYXN5bmMgZ2V0QmFuKGd1aWxkSWQ6IHN0cmluZywgdXNlcklkOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCgnR0VUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vYmFucy8ke3VzZXJJZH1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBndWlsZCBpbnZpdGVzXHJcbiAgICovXHJcbiAgYXN5bmMgZ2V0R3VpbGRJbnZpdGVzKGd1aWxkSWQ6IHN0cmluZyk6IFByb21pc2U8YW55W10+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoJ0dFVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2ludml0ZXNgKTtcclxuICB9XHJcblxyXG4gIC8vID09PT09PT09PT09PT09PT09PT09IFRocmVhZHMgPT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgdGhyZWFkIGZyb20gYSBtZXNzYWdlXHJcbiAgICovXHJcbiAgYXN5bmMgY3JlYXRlVGhyZWFkRnJvbU1lc3NhZ2UoZ3VpbGRJZDogc3RyaW5nLCBjaGFubmVsSWQ6IHN0cmluZywgbWVzc2FnZUlkOiBzdHJpbmcsIGRhdGE6IHtcclxuICAgIG5hbWU6IHN0cmluZztcclxuICAgIGF1dG9fYXJjaGl2ZV9kdXJhdGlvbj86IG51bWJlcjtcclxuICB9KTogUHJvbWlzZTxhbnk+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoJ1BPU1QnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH0vbWVzc2FnZXMvJHttZXNzYWdlSWR9L3RocmVhZHNgLCBkYXRhKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIHRocmVhZCB3aXRob3V0IGEgbWVzc2FnZVxyXG4gICAqL1xyXG4gIGFzeW5jIGNyZWF0ZVRocmVhZChndWlsZElkOiBzdHJpbmcsIGNoYW5uZWxJZDogc3RyaW5nLCBkYXRhOiB7XHJcbiAgICBuYW1lOiBzdHJpbmc7XHJcbiAgICB0eXBlPzogbnVtYmVyO1xyXG4gICAgYXV0b19hcmNoaXZlX2R1cmF0aW9uPzogbnVtYmVyO1xyXG4gICAgaW52aXRhYmxlPzogYm9vbGVhbjtcclxuICB9KTogUHJvbWlzZTxhbnk+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoJ1BPU1QnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH0vdGhyZWFkc2AsIGRhdGEpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSm9pbiBhIHRocmVhZFxyXG4gICAqL1xyXG4gIGFzeW5jIGpvaW5UaHJlYWQoY2hhbm5lbElkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdCgnUFVUJywgYC9ib3QvY2hhbm5lbHMvJHtjaGFubmVsSWR9L3RocmVhZC1tZW1iZXJzL0BtZWApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogTGVhdmUgYSB0aHJlYWRcclxuICAgKi9cclxuICBhc3luYyBsZWF2ZVRocmVhZChjaGFubmVsSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0KCdERUxFVEUnLCBgL2JvdC9jaGFubmVscy8ke2NoYW5uZWxJZH0vdGhyZWFkLW1lbWJlcnMvQG1lYCk7XHJcbiAgfVxyXG5cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PSBQaW5zID09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIC8qKlxyXG4gICAqIFBpbiBhIG1lc3NhZ2VcclxuICAgKi9cclxuICBhc3luYyBwaW5NZXNzYWdlKGd1aWxkSWQ6IHN0cmluZywgY2hhbm5lbElkOiBzdHJpbmcsIG1lc3NhZ2VJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3QoJ1BVVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS9waW5zLyR7bWVzc2FnZUlkfWApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVW5waW4gYSBtZXNzYWdlXHJcbiAgICovXHJcbiAgYXN5bmMgdW5waW5NZXNzYWdlKGd1aWxkSWQ6IHN0cmluZywgY2hhbm5lbElkOiBzdHJpbmcsIG1lc3NhZ2VJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3QoJ0RFTEVURScsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS9waW5zLyR7bWVzc2FnZUlkfWApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IHBpbm5lZCBtZXNzYWdlc1xyXG4gICAqL1xyXG4gIGFzeW5jIGdldFBpbm5lZE1lc3NhZ2VzKGd1aWxkSWQ6IHN0cmluZywgY2hhbm5lbElkOiBzdHJpbmcpOiBQcm9taXNlPEFQSU1lc3NhZ2VbXT4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCgnR0VUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vY2hhbm5lbHMvJHtjaGFubmVsSWR9L3BpbnNgKTtcclxuICB9XHJcblxyXG4gIC8vID09PT09PT09PT09PT09PT09PT09IFVzZXJzID09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhIHVzZXJcclxuICAgKi9cclxuICBhc3luYyBnZXRVc2VyKHVzZXJJZDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoJ0dFVCcsIGAvYm90L3VzZXJzLyR7dXNlcklkfWApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGN1cnJlbnQgYm90IHVzZXJcclxuICAgKi9cclxuICBhc3luYyBnZXRDdXJyZW50VXNlcigpOiBQcm9taXNlPGFueT4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCgnR0VUJywgYC9ib3QvdXNlcnMvQG1lYCk7XHJcbiAgfVxyXG5cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PSBJbnZpdGVzID09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhbiBpbnZpdGVcclxuICAgKi9cclxuICBhc3luYyBjcmVhdGVJbnZpdGUoZ3VpbGRJZDogc3RyaW5nLCBjaGFubmVsSWQ6IHN0cmluZywgZGF0YT86IHtcclxuICAgIG1heF9hZ2U/OiBudW1iZXI7XHJcbiAgICBtYXhfdXNlcz86IG51bWJlcjtcclxuICAgIHRlbXBvcmFyeT86IGJvb2xlYW47XHJcbiAgICB1bmlxdWU/OiBib29sZWFuO1xyXG4gIH0pOiBQcm9taXNlPGFueT4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCgnUE9TVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS9pbnZpdGVzYCwgZGF0YSB8fCB7fSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZWxldGUgYW4gaW52aXRlXHJcbiAgICovXHJcbiAgYXN5bmMgZGVsZXRlSW52aXRlKGludml0ZUNvZGU6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0KCdERUxFVEUnLCBgL2JvdC9pbnZpdGVzLyR7aW52aXRlQ29kZX1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhbiBpbnZpdGVcclxuICAgKi9cclxuICBhc3luYyBnZXRJbnZpdGUoaW52aXRlQ29kZTogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoJ0dFVCcsIGAvYm90L2ludml0ZXMvJHtpbnZpdGVDb2RlfWApO1xyXG4gIH1cclxuXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT0gV2ViaG9va3MgPT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGNoYW5uZWwgd2ViaG9va3NcclxuICAgKi9cclxuICBhc3luYyBnZXRDaGFubmVsV2ViaG9va3MoZ3VpbGRJZDogc3RyaW5nLCBjaGFubmVsSWQ6IHN0cmluZyk6IFByb21pc2U8YW55W10+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoJ0dFVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS93ZWJob29rc2ApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgd2ViaG9va1xyXG4gICAqL1xyXG4gIGFzeW5jIGNyZWF0ZVdlYmhvb2soZ3VpbGRJZDogc3RyaW5nLCBjaGFubmVsSWQ6IHN0cmluZywgZGF0YToge1xyXG4gICAgbmFtZTogc3RyaW5nO1xyXG4gICAgYXZhdGFyPzogc3RyaW5nO1xyXG4gIH0pOiBQcm9taXNlPGFueT4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCgnUE9TVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS93ZWJob29rc2AsIGRhdGEpO1xyXG4gIH1cclxufVxyXG4iXX0=