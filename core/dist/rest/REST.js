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
    constructor(baseUrl = 'http://localhost:5000/api/v1') {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUkVTVC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9yZXN0L1JFU1QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBK0JBOztHQUVHO0FBQ0gsTUFBYSxJQUFJO0lBQ1AsT0FBTyxDQUFTO0lBQ2hCLEtBQUssR0FBVyxFQUFFLENBQUM7SUFFM0IscURBQXFEO0lBQzdDLFNBQVMsR0FBNEIsSUFBSSxHQUFHLEVBQUUsQ0FBQztJQUN0QyxjQUFjLEdBQUcsQ0FBQyxHQUFHLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQyxXQUFXO0lBRTVELFlBQVksVUFBa0IsOEJBQThCO1FBQzFELElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO0lBQ3pCLENBQUM7SUFFRCw0REFBNEQ7SUFFNUQ7OztPQUdHO0lBQ0gsU0FBUyxDQUFDLElBQTRGO1FBQ3BHLE1BQU0sTUFBTSxHQUFHLE9BQU8sSUFBSSxDQUFDLEVBQUUsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1FBQzdFLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLE1BQU0sRUFBRTtZQUN6QixFQUFFLEVBQUUsTUFBTTtZQUNWLFFBQVEsRUFBRSxJQUFJLENBQUMsUUFBUTtZQUN2QixXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVcsSUFBSSxJQUFJLENBQUMsWUFBWTtZQUNsRCxRQUFRLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRTtTQUNyQixDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxVQUFVLENBQUMsS0FBb0c7UUFDN0csS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUM5QyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxhQUFh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ZCwgQVBJRW1iZWQgfSBmcm9tICcuLi90eXBlcyc7XHJcblxyXG4vKipcclxuICogTWVudGlvbiBkYXRhIHN0cnVjdHVyZSBmb3Igb3VyIHN5c3RlbVxyXG4gKi9cclxuZXhwb3J0IGludGVyZmFjZSBNZW50aW9uVXNlciB7XHJcbiAgaWQ6IG51bWJlcjtcclxuICB1c2VybmFtZTogc3RyaW5nO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIE1lbnRpb25Sb2xlIHtcclxuICBpZDogc3RyaW5nO1xyXG4gIG5hbWU/OiBzdHJpbmc7XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgTWVudGlvbnNEYXRhIHtcclxuICB1c2Vycz86IE1lbnRpb25Vc2VyW107XHJcbiAgcm9sZXM/OiBNZW50aW9uUm9sZVtdO1xyXG4gIGV2ZXJ5b25lPzogYm9vbGVhbjtcclxufVxyXG5cclxuLyoqXHJcbiAqIFVzZXIgY2FjaGUgZW50cnlcclxuICovXHJcbmludGVyZmFjZSBDYWNoZWRVc2VyIHtcclxuICBpZDogbnVtYmVyO1xyXG4gIHVzZXJuYW1lOiBzdHJpbmc7XHJcbiAgZGlzcGxheU5hbWU/OiBzdHJpbmc7XHJcbiAgY2FjaGVkQXQ6IG51bWJlcjtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJFU1QgQVBJIGNsaWVudCBmb3IgSnViYmlvXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgUkVTVCB7XHJcbiAgcHJpdmF0ZSBiYXNlVXJsOiBzdHJpbmc7XHJcbiAgcHJpdmF0ZSB0b2tlbjogc3RyaW5nID0gJyc7XHJcbiAgXHJcbiAgLy8gVXNlciBjYWNoZSBmb3IgbWVudGlvbiByZXNvbHV0aW9uIChJRCAtPiB1c2VybmFtZSlcclxuICBwcml2YXRlIHVzZXJDYWNoZTogTWFwPG51bWJlciwgQ2FjaGVkVXNlcj4gPSBuZXcgTWFwKCk7XHJcbiAgcHJpdmF0ZSByZWFkb25seSBVU0VSX0NBQ0hFX1RUTCA9IDUgKiA2MCAqIDEwMDA7IC8vIDUgZGFraWthXHJcblxyXG4gIGNvbnN0cnVjdG9yKGJhc2VVcmw6IHN0cmluZyA9ICdodHRwOi8vbG9jYWxob3N0OjUwMDAvYXBpL3YxJykge1xyXG4gICAgdGhpcy5iYXNlVXJsID0gYmFzZVVybDtcclxuICB9XHJcblxyXG4gIC8vID09PT09PT09PT09PT09PT09PT09IE1lbnRpb24gSGVscGVycyA9PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAvKipcclxuICAgKiBDYWNoZSBhIHVzZXIgZm9yIG1lbnRpb24gcmVzb2x1dGlvblxyXG4gICAqIEJvdCdsYXIgaW50ZXJhY3Rpb24nZGFuIGdlbGVuIHVzZXIgYmlsZ2lzaW5pIGNhY2hlJ2xleWViaWxpclxyXG4gICAqL1xyXG4gIGNhY2hlVXNlcih1c2VyOiB7IGlkOiBzdHJpbmcgfCBudW1iZXI7IHVzZXJuYW1lOiBzdHJpbmc7IGRpc3BsYXlOYW1lPzogc3RyaW5nOyBkaXNwbGF5X25hbWU/OiBzdHJpbmcgfSk6IHZvaWQge1xyXG4gICAgY29uc3QgdXNlcklkID0gdHlwZW9mIHVzZXIuaWQgPT09ICdzdHJpbmcnID8gcGFyc2VJbnQodXNlci5pZCwgMTApIDogdXNlci5pZDtcclxuICAgIHRoaXMudXNlckNhY2hlLnNldCh1c2VySWQsIHtcclxuICAgICAgaWQ6IHVzZXJJZCxcclxuICAgICAgdXNlcm5hbWU6IHVzZXIudXNlcm5hbWUsXHJcbiAgICAgIGRpc3BsYXlOYW1lOiB1c2VyLmRpc3BsYXlOYW1lIHx8IHVzZXIuZGlzcGxheV9uYW1lLFxyXG4gICAgICBjYWNoZWRBdDogRGF0ZS5ub3coKVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDYWNoZSBtdWx0aXBsZSB1c2Vyc1xyXG4gICAqL1xyXG4gIGNhY2hlVXNlcnModXNlcnM6IEFycmF5PHsgaWQ6IHN0cmluZyB8IG51bWJlcjsgdXNlcm5hbWU6IHN0cmluZzsgZGlzcGxheU5hbWU/OiBzdHJpbmc7IGRpc3BsYXlfbmFtZT86IHN0cmluZyB9Pik6IHZvaWQge1xyXG4gICAgdXNlcnMuZm9yRWFjaCh1c2VyID0+IHRoaXMuY2FjaGVVc2VyKHVzZXIpKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBjYWNoZWQgdXNlciBieSBJRFxyXG4gICAqL1xyXG4gIGdldENhY2hlZFVzZXIodXNlcklkOiBudW1iZXIpOiBDYWNoZWRVc2VyIHwgdW5kZWZpbmVkIHtcclxuICAgIGNvbnN0IGNhY2hlZCA9IHRoaXMudXNlckNhY2hlLmdldCh1c2VySWQpO1xyXG4gICAgaWYgKGNhY2hlZCAmJiBEYXRlLm5vdygpIC0gY2FjaGVkLmNhY2hlZEF0IDwgdGhpcy5VU0VSX0NBQ0hFX1RUTCkge1xyXG4gICAgICByZXR1cm4gY2FjaGVkO1xyXG4gICAgfVxyXG4gICAgLy8gRXhwaXJlZCwgcmVtb3ZlIGZyb20gY2FjaGVcclxuICAgIGlmIChjYWNoZWQpIHtcclxuICAgICAgdGhpcy51c2VyQ2FjaGUuZGVsZXRlKHVzZXJJZCk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRm9ybWF0IGEgdXNlciBtZW50aW9uXHJcbiAgICogUmV0dXJucyBib3RoIHRoZSB0ZXh0IGZvcm1hdCBhbmQgbWVudGlvbnMgZGF0YVxyXG4gICAqIFxyXG4gICAqIEBleGFtcGxlXHJcbiAgICogY29uc3QgbWVudGlvbiA9IHJlc3QuZm9ybWF0TWVudGlvbih1c2VyKTtcclxuICAgKiAvLyBtZW50aW9uLnRleHQgPSBcIkBpbGtheVwiXHJcbiAgICogLy8gbWVudGlvbi5kYXRhID0geyB1c2VyczogW3sgaWQ6IDEsIHVzZXJuYW1lOiBcImlsa2F5XCIgfV0gfVxyXG4gICAqL1xyXG4gIGZvcm1hdE1lbnRpb24odXNlcjogeyBpZDogc3RyaW5nIHwgbnVtYmVyOyB1c2VybmFtZTogc3RyaW5nIH0pOiB7IHRleHQ6IHN0cmluZzsgZGF0YTogTWVudGlvbnNEYXRhIH0ge1xyXG4gICAgY29uc3QgdXNlcklkID0gdHlwZW9mIHVzZXIuaWQgPT09ICdzdHJpbmcnID8gcGFyc2VJbnQodXNlci5pZCwgMTApIDogdXNlci5pZDtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIHRleHQ6IGBAJHt1c2VyLnVzZXJuYW1lfWAsXHJcbiAgICAgIGRhdGE6IHtcclxuICAgICAgICB1c2VyczogW3sgaWQ6IHVzZXJJZCwgdXNlcm5hbWU6IHVzZXIudXNlcm5hbWUgfV1cclxuICAgICAgfVxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFBhcnNlIG1lbnRpb25zICg8QElEPikgYW5kIGNvbnZlcnQgdG8gb3VyIGZvcm1hdCAoQHVzZXJuYW1lKVxyXG4gICAqIEFsc28gYnVpbGRzIHRoZSBtZW50aW9ucyBkYXRhIHN0cnVjdHVyZVxyXG4gICAqIFxyXG4gICAqIEBwYXJhbSBjb250ZW50IC0gTWVzc2FnZSBjb250ZW50IHdpdGggbWVudGlvbnNcclxuICAgKiBAcGFyYW0gZXhpc3RpbmdNZW50aW9ucyAtIEV4aXN0aW5nIG1lbnRpb25zIGRhdGEgdG8gbWVyZ2Ugd2l0aFxyXG4gICAqIEByZXR1cm5zIFByb2Nlc3NlZCBjb250ZW50IGFuZCBtZW50aW9ucyBkYXRhXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBwcm9jZXNzTWVudGlvbnMoY29udGVudDogc3RyaW5nLCBleGlzdGluZ01lbnRpb25zPzogTWVudGlvbnNEYXRhKTogeyBjb250ZW50OiBzdHJpbmc7IG1lbnRpb25zOiBNZW50aW9uc0RhdGEgfSB7XHJcbiAgICBjb25zdCBtZW50aW9uczogTWVudGlvbnNEYXRhID0ge1xyXG4gICAgICB1c2VyczogWy4uLihleGlzdGluZ01lbnRpb25zPy51c2VycyB8fCBbXSldLFxyXG4gICAgICByb2xlczogWy4uLihleGlzdGluZ01lbnRpb25zPy5yb2xlcyB8fCBbXSldLFxyXG4gICAgICBldmVyeW9uZTogZXhpc3RpbmdNZW50aW9ucz8uZXZlcnlvbmVcclxuICAgIH07XHJcblxyXG4gICAgLy8gVHJhY2sgYWxyZWFkeSBhZGRlZCB1c2VyIElEcyB0byBhdm9pZCBkdXBsaWNhdGVzXHJcbiAgICBjb25zdCBhZGRlZFVzZXJJZHMgPSBuZXcgU2V0KG1lbnRpb25zLnVzZXJzPy5tYXAodSA9PiB1LmlkKSB8fCBbXSk7XHJcblxyXG4gICAgLy8gUGFyc2UgPEBJRD4gZm9ybWF0ICh1c2VyIG1lbnRpb25zKVxyXG4gICAgY29uc3QgdXNlck1lbnRpb25SZWdleCA9IC88QCE/KFxcZCspPi9nO1xyXG4gICAgbGV0IHByb2Nlc3NlZENvbnRlbnQgPSBjb250ZW50O1xyXG4gICAgbGV0IG1hdGNoO1xyXG5cclxuICAgIHdoaWxlICgobWF0Y2ggPSB1c2VyTWVudGlvblJlZ2V4LmV4ZWMoY29udGVudCkpICE9PSBudWxsKSB7XHJcbiAgICAgIGNvbnN0IHVzZXJJZCA9IHBhcnNlSW50KG1hdGNoWzFdLCAxMCk7XHJcbiAgICAgIGNvbnN0IGZ1bGxNYXRjaCA9IG1hdGNoWzBdO1xyXG5cclxuICAgICAgLy8gVHJ5IHRvIGdldCB1c2VybmFtZSBmcm9tIGNhY2hlXHJcbiAgICAgIGNvbnN0IGNhY2hlZFVzZXIgPSB0aGlzLmdldENhY2hlZFVzZXIodXNlcklkKTtcclxuICAgICAgXHJcbiAgICAgIGlmIChjYWNoZWRVc2VyKSB7XHJcbiAgICAgICAgLy8gUmVwbGFjZSA8QElEPiB3aXRoIEB1c2VybmFtZVxyXG4gICAgICAgIHByb2Nlc3NlZENvbnRlbnQgPSBwcm9jZXNzZWRDb250ZW50LnJlcGxhY2UoZnVsbE1hdGNoLCBgQCR7Y2FjaGVkVXNlci51c2VybmFtZX1gKTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBBZGQgdG8gbWVudGlvbnMgaWYgbm90IGFscmVhZHkgYWRkZWRcclxuICAgICAgICBpZiAoIWFkZGVkVXNlcklkcy5oYXModXNlcklkKSkge1xyXG4gICAgICAgICAgbWVudGlvbnMudXNlcnMhLnB1c2goeyBpZDogdXNlcklkLCB1c2VybmFtZTogY2FjaGVkVXNlci51c2VybmFtZSB9KTtcclxuICAgICAgICAgIGFkZGVkVXNlcklkcy5hZGQodXNlcklkKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgLy8gVXNlciBub3QgaW4gY2FjaGUgLSBrZWVwIGFzIEBVc2VyX0lEIGZvcm1hdCAoYmFja2VuZCB3aWxsIHJlc29sdmUpXHJcbiAgICAgICAgcHJvY2Vzc2VkQ29udGVudCA9IHByb2Nlc3NlZENvbnRlbnQucmVwbGFjZShmdWxsTWF0Y2gsIGBAVXNlcl8ke3VzZXJJZH1gKTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBTdGlsbCBhZGQgdG8gbWVudGlvbnMgd2l0aCBwbGFjZWhvbGRlciB1c2VybmFtZVxyXG4gICAgICAgIGlmICghYWRkZWRVc2VySWRzLmhhcyh1c2VySWQpKSB7XHJcbiAgICAgICAgICBtZW50aW9ucy51c2VycyEucHVzaCh7IGlkOiB1c2VySWQsIHVzZXJuYW1lOiBgVXNlcl8ke3VzZXJJZH1gIH0pO1xyXG4gICAgICAgICAgYWRkZWRVc2VySWRzLmFkZCh1c2VySWQpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8vIFBhcnNlIDxAJklEPiBmb3JtYXQgKHJvbGUgbWVudGlvbnMpXHJcbiAgICBjb25zdCByb2xlTWVudGlvblJlZ2V4ID0gLzxAJihcXGQrKT4vZztcclxuICAgIGNvbnN0IGFkZGVkUm9sZUlkcyA9IG5ldyBTZXQobWVudGlvbnMucm9sZXM/Lm1hcChyID0+IHIuaWQpIHx8IFtdKTtcclxuXHJcbiAgICB3aGlsZSAoKG1hdGNoID0gcm9sZU1lbnRpb25SZWdleC5leGVjKGNvbnRlbnQpKSAhPT0gbnVsbCkge1xyXG4gICAgICBjb25zdCByb2xlSWQgPSBtYXRjaFsxXTtcclxuICAgICAgY29uc3QgZnVsbE1hdGNoID0gbWF0Y2hbMF07XHJcblxyXG4gICAgICAvLyBSZXBsYWNlIHdpdGggQHJvbGUgZm9ybWF0IChiYWNrZW5kIGhhbmRsZXMgcm9sZSByZXNvbHV0aW9uKVxyXG4gICAgICBwcm9jZXNzZWRDb250ZW50ID0gcHJvY2Vzc2VkQ29udGVudC5yZXBsYWNlKGZ1bGxNYXRjaCwgYEByb2xlXyR7cm9sZUlkfWApO1xyXG4gICAgICBcclxuICAgICAgaWYgKCFhZGRlZFJvbGVJZHMuaGFzKHJvbGVJZCkpIHtcclxuICAgICAgICBtZW50aW9ucy5yb2xlcyEucHVzaCh7IGlkOiByb2xlSWQgfSk7XHJcbiAgICAgICAgYWRkZWRSb2xlSWRzLmFkZChyb2xlSWQpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8gUGFyc2UgQGV2ZXJ5b25lIGFuZCBAaGVyZVxyXG4gICAgaWYgKGNvbnRlbnQuaW5jbHVkZXMoJ0BldmVyeW9uZScpKSB7XHJcbiAgICAgIG1lbnRpb25zLmV2ZXJ5b25lID0gdHJ1ZTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBDbGVhbiB1cCBlbXB0eSBhcnJheXNcclxuICAgIGlmIChtZW50aW9ucy51c2Vycz8ubGVuZ3RoID09PSAwKSBkZWxldGUgbWVudGlvbnMudXNlcnM7XHJcbiAgICBpZiAobWVudGlvbnMucm9sZXM/Lmxlbmd0aCA9PT0gMCkgZGVsZXRlIG1lbnRpb25zLnJvbGVzO1xyXG5cclxuICAgIHJldHVybiB7IGNvbnRlbnQ6IHByb2Nlc3NlZENvbnRlbnQsIG1lbnRpb25zIH07XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBQcmVwYXJlIG1lc3NhZ2UgZGF0YSB3aXRoIHByb2Nlc3NlZCBtZW50aW9uc1xyXG4gICAqIEF1dG9tYXRpY2FsbHkgY29udmVydHMgbWVudGlvbnMgdG8gb3VyIGZvcm1hdFxyXG4gICAqL1xyXG4gIHByaXZhdGUgcHJlcGFyZU1lc3NhZ2VEYXRhKGRhdGE6IHtcclxuICAgIGNvbnRlbnQ/OiBzdHJpbmc7XHJcbiAgICBlbWJlZHM/OiBBUElFbWJlZFtdO1xyXG4gICAgY29tcG9uZW50cz86IGFueVtdO1xyXG4gICAgbWVudGlvbnM/OiBNZW50aW9uc0RhdGE7XHJcbiAgICBtZXNzYWdlX3JlZmVyZW5jZT86IHsgbWVzc2FnZV9pZDogc3RyaW5nIH07XHJcbiAgfSk6IGFueSB7XHJcbiAgICBjb25zdCByZXN1bHQ6IGFueSA9IHsgLi4uZGF0YSB9O1xyXG4gICAgbGV0IGFsbE1lbnRpb25zOiBNZW50aW9uc0RhdGEgPSB7IC4uLmRhdGEubWVudGlvbnMgfTtcclxuXHJcbiAgICAvLyBQcm9jZXNzIG1lbnRpb25zIGluIGNvbnRlbnQgaWYgcHJlc2VudFxyXG4gICAgaWYgKGRhdGEuY29udGVudCkge1xyXG4gICAgICBjb25zdCB7IGNvbnRlbnQsIG1lbnRpb25zIH0gPSB0aGlzLnByb2Nlc3NNZW50aW9ucyhkYXRhLmNvbnRlbnQsIGFsbE1lbnRpb25zKTtcclxuICAgICAgcmVzdWx0LmNvbnRlbnQgPSBjb250ZW50O1xyXG4gICAgICBhbGxNZW50aW9ucyA9IG1lbnRpb25zO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIFByb2Nlc3MgbWVudGlvbnMgaW4gZW1iZWRzIChkZXNjcmlwdGlvbiwgdGl0bGUsIGZvb3RlciwgZmllbGRzKVxyXG4gICAgaWYgKGRhdGEuZW1iZWRzICYmIGRhdGEuZW1iZWRzLmxlbmd0aCA+IDApIHtcclxuICAgICAgcmVzdWx0LmVtYmVkcyA9IGRhdGEuZW1iZWRzLm1hcChlbWJlZCA9PiB7XHJcbiAgICAgICAgY29uc3QgcHJvY2Vzc2VkRW1iZWQ6IGFueSA9IHsgLi4uZW1iZWQgfTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBQcm9jZXNzIGRlc2NyaXB0aW9uXHJcbiAgICAgICAgaWYgKGVtYmVkLmRlc2NyaXB0aW9uKSB7XHJcbiAgICAgICAgICBjb25zdCB7IGNvbnRlbnQsIG1lbnRpb25zIH0gPSB0aGlzLnByb2Nlc3NNZW50aW9ucyhlbWJlZC5kZXNjcmlwdGlvbiwgYWxsTWVudGlvbnMpO1xyXG4gICAgICAgICAgcHJvY2Vzc2VkRW1iZWQuZGVzY3JpcHRpb24gPSBjb250ZW50O1xyXG4gICAgICAgICAgYWxsTWVudGlvbnMgPSBtZW50aW9ucztcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gUHJvY2VzcyB0aXRsZVxyXG4gICAgICAgIGlmIChlbWJlZC50aXRsZSkge1xyXG4gICAgICAgICAgY29uc3QgeyBjb250ZW50LCBtZW50aW9ucyB9ID0gdGhpcy5wcm9jZXNzTWVudGlvbnMoZW1iZWQudGl0bGUsIGFsbE1lbnRpb25zKTtcclxuICAgICAgICAgIHByb2Nlc3NlZEVtYmVkLnRpdGxlID0gY29udGVudDtcclxuICAgICAgICAgIGFsbE1lbnRpb25zID0gbWVudGlvbnM7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIFByb2Nlc3MgZm9vdGVyIHRleHRcclxuICAgICAgICBpZiAoZW1iZWQuZm9vdGVyPy50ZXh0KSB7XHJcbiAgICAgICAgICBjb25zdCB7IGNvbnRlbnQsIG1lbnRpb25zIH0gPSB0aGlzLnByb2Nlc3NNZW50aW9ucyhlbWJlZC5mb290ZXIudGV4dCwgYWxsTWVudGlvbnMpO1xyXG4gICAgICAgICAgcHJvY2Vzc2VkRW1iZWQuZm9vdGVyID0geyAuLi5lbWJlZC5mb290ZXIsIHRleHQ6IGNvbnRlbnQgfTtcclxuICAgICAgICAgIGFsbE1lbnRpb25zID0gbWVudGlvbnM7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIFByb2Nlc3MgZmllbGRzXHJcbiAgICAgICAgaWYgKGVtYmVkLmZpZWxkcyAmJiBlbWJlZC5maWVsZHMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgcHJvY2Vzc2VkRW1iZWQuZmllbGRzID0gZW1iZWQuZmllbGRzLm1hcCgoZmllbGQ6IGFueSkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCBwcm9jZXNzZWRGaWVsZDogYW55ID0geyAuLi5maWVsZCB9O1xyXG4gICAgICAgICAgICBpZiAoZmllbGQudmFsdWUpIHtcclxuICAgICAgICAgICAgICBjb25zdCB7IGNvbnRlbnQsIG1lbnRpb25zIH0gPSB0aGlzLnByb2Nlc3NNZW50aW9ucyhmaWVsZC52YWx1ZSwgYWxsTWVudGlvbnMpO1xyXG4gICAgICAgICAgICAgIHByb2Nlc3NlZEZpZWxkLnZhbHVlID0gY29udGVudDtcclxuICAgICAgICAgICAgICBhbGxNZW50aW9ucyA9IG1lbnRpb25zO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChmaWVsZC5uYW1lKSB7XHJcbiAgICAgICAgICAgICAgY29uc3QgeyBjb250ZW50LCBtZW50aW9ucyB9ID0gdGhpcy5wcm9jZXNzTWVudGlvbnMoZmllbGQubmFtZSwgYWxsTWVudGlvbnMpO1xyXG4gICAgICAgICAgICAgIHByb2Nlc3NlZEZpZWxkLm5hbWUgPSBjb250ZW50O1xyXG4gICAgICAgICAgICAgIGFsbE1lbnRpb25zID0gbWVudGlvbnM7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHByb2Nlc3NlZEZpZWxkO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIHJldHVybiBwcm9jZXNzZWRFbWJlZDtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gQWRkIG1lcmdlZCBtZW50aW9ucyB0byByZXN1bHRcclxuICAgIGlmIChhbGxNZW50aW9ucy51c2Vycz8ubGVuZ3RoIHx8IGFsbE1lbnRpb25zLnJvbGVzPy5sZW5ndGggfHwgYWxsTWVudGlvbnMuZXZlcnlvbmUpIHtcclxuICAgICAgcmVzdWx0Lm1lbnRpb25zID0gYWxsTWVudGlvbnM7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldCB0aGUgYm90IHRva2VuXHJcbiAgICovXHJcbiAgc2V0VG9rZW4odG9rZW46IHN0cmluZyk6IHRoaXMge1xyXG4gICAgdGhpcy50b2tlbiA9IHRva2VuO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBNYWtlIGFuIGF1dGhlbnRpY2F0ZWQgcmVxdWVzdFxyXG4gICAqL1xyXG4gIHByaXZhdGUgYXN5bmMgcmVxdWVzdDxUPihtZXRob2Q6IHN0cmluZywgcGF0aDogc3RyaW5nLCBib2R5PzogYW55KTogUHJvbWlzZTxUPiB7XHJcbiAgICBjb25zdCB1cmwgPSBgJHt0aGlzLmJhc2VVcmx9JHtwYXRofWA7XHJcbiAgICBcclxuICAgIC8vIERlYnVnIGxvZ1xyXG4gICAgY29uc29sZS5sb2coYFtSRVNUXSAke21ldGhvZH0gJHt1cmx9YCwgYm9keSA/IEpTT04uc3RyaW5naWZ5KGJvZHkpIDogJycpO1xyXG4gICAgXHJcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybCwge1xyXG4gICAgICBtZXRob2QsXHJcbiAgICAgIGhlYWRlcnM6IHtcclxuICAgICAgICAnQXV0aG9yaXphdGlvbic6IGBCb3QgJHt0aGlzLnRva2VufWAsXHJcbiAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJ1xyXG4gICAgICB9LFxyXG4gICAgICBib2R5OiBib2R5ID8gSlNPTi5zdHJpbmdpZnkoYm9keSkgOiB1bmRlZmluZWRcclxuICAgIH0pO1xyXG5cclxuICAgIGlmICghcmVzcG9uc2Uub2spIHtcclxuICAgICAgY29uc3QgZXJyb3IgPSBhd2FpdCByZXNwb25zZS50ZXh0KCk7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQVBJIEVycm9yICR7cmVzcG9uc2Uuc3RhdHVzfTogJHtlcnJvcn1gKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBIYW5kbGUgZW1wdHkgcmVzcG9uc2VzXHJcbiAgICBjb25zdCB0ZXh0ID0gYXdhaXQgcmVzcG9uc2UudGV4dCgpO1xyXG4gICAgaWYgKCF0ZXh0KSByZXR1cm4ge30gYXMgVDtcclxuICAgIFxyXG4gICAgcmV0dXJuIEpTT04ucGFyc2UodGV4dCk7XHJcbiAgfVxyXG5cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PSBNZXNzYWdlcyA9PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgYSBtZXNzYWdlIGluIGEgY2hhbm5lbFxyXG4gICAqIEF1dG9tYXRpY2FsbHkgcHJvY2Vzc2VzIG1lbnRpb25zICg8QElEPikgdG8gb3VyIGZvcm1hdCAoQHVzZXJuYW1lKVxyXG4gICAqIFxyXG4gICAqIEBleGFtcGxlXHJcbiAgICogLy8gTWVudGlvbiBzdHlsZSAoYXV0by1jb252ZXJ0ZWQpOlxyXG4gICAqIGF3YWl0IHJlc3QuY3JlYXRlTWVzc2FnZShndWlsZElkLCBjaGFubmVsSWQsIHtcclxuICAgKiAgIGNvbnRlbnQ6ICdIZWxsbyA8QDEyMz4hJywgIC8vIEJlY29tZXMgXCJIZWxsbyBAdXNlcm5hbWUhXCJcclxuICAgKiB9KTtcclxuICAgKiBcclxuICAgKiAvLyBPdXIgbmF0aXZlIGZvcm1hdDpcclxuICAgKiBhd2FpdCByZXN0LmNyZWF0ZU1lc3NhZ2UoZ3VpbGRJZCwgY2hhbm5lbElkLCB7XHJcbiAgICogICBjb250ZW50OiAnSGVsbG8gQGlsa2F5IScsXHJcbiAgICogICBtZW50aW9uczogeyB1c2VyczogW3sgaWQ6IDEyMywgdXNlcm5hbWU6ICdpbGtheScgfV0gfVxyXG4gICAqIH0pO1xyXG4gICAqL1xyXG4gIGFzeW5jIGNyZWF0ZU1lc3NhZ2UoZ3VpbGRJZE9yQ2hhbm5lbElkOiBzdHJpbmcsIGNoYW5uZWxJZE9yRGF0YTogc3RyaW5nIHwge1xyXG4gICAgY29udGVudD86IHN0cmluZztcclxuICAgIGVtYmVkcz86IEFQSUVtYmVkW107XHJcbiAgICBjb21wb25lbnRzPzogYW55W107XHJcbiAgICBtZW50aW9ucz86IE1lbnRpb25zRGF0YTtcclxuICAgIGZpbGVzPzogQXJyYXk8eyBuYW1lOiBzdHJpbmc7IGRhdGE6IEJ1ZmZlciB9PjtcclxuICAgIG1lc3NhZ2VfcmVmZXJlbmNlPzogeyBtZXNzYWdlX2lkOiBzdHJpbmcgfTtcclxuICAgIGludGVyYWN0aW9uSWQ/OiBzdHJpbmc7XHJcbiAgfSwgZGF0YT86IHtcclxuICAgIGNvbnRlbnQ/OiBzdHJpbmc7XHJcbiAgICBlbWJlZHM/OiBBUElFbWJlZFtdO1xyXG4gICAgY29tcG9uZW50cz86IGFueVtdO1xyXG4gICAgbWVudGlvbnM/OiBNZW50aW9uc0RhdGE7XHJcbiAgICBmaWxlcz86IEFycmF5PHsgbmFtZTogc3RyaW5nOyBkYXRhOiBCdWZmZXIgfT47XHJcbiAgICBtZXNzYWdlX3JlZmVyZW5jZT86IHsgbWVzc2FnZV9pZDogc3RyaW5nIH07XHJcbiAgICBpbnRlcmFjdGlvbklkPzogc3RyaW5nO1xyXG4gIH0pOiBQcm9taXNlPEFQSU1lc3NhZ2U+IHtcclxuICAgIC8vIMSwa2kga3VsbGFuxLFtIMWfZWtsaTpcclxuICAgIC8vIDEuIGNyZWF0ZU1lc3NhZ2UoZ3VpbGRJZCwgY2hhbm5lbElkLCBkYXRhKSAtIGd1aWxkSWQgaWxlICh0ZXJjaWggZWRpbGVuKVxyXG4gICAgLy8gMi4gY3JlYXRlTWVzc2FnZShjaGFubmVsSWQsIGRhdGEpIC0gZ3VpbGRJZCBvbG1hZGFuIChlc2tpIGZvcm1hdCwgaGF0YSB2ZXJpcilcclxuICAgIFxyXG4gICAgbGV0IGd1aWxkSWQ6IHN0cmluZztcclxuICAgIGxldCBjaGFubmVsSWQ6IHN0cmluZztcclxuICAgIGxldCBtZXNzYWdlRGF0YTogYW55O1xyXG4gICAgXHJcbiAgICBpZiAodHlwZW9mIGNoYW5uZWxJZE9yRGF0YSA9PT0gJ3N0cmluZycgJiYgZGF0YSkge1xyXG4gICAgICAvLyBZZW5pIGZvcm1hdDogY3JlYXRlTWVzc2FnZShndWlsZElkLCBjaGFubmVsSWQsIGRhdGEpXHJcbiAgICAgIGd1aWxkSWQgPSBndWlsZElkT3JDaGFubmVsSWQ7XHJcbiAgICAgIGNoYW5uZWxJZCA9IGNoYW5uZWxJZE9yRGF0YTtcclxuICAgICAgbWVzc2FnZURhdGEgPSB0aGlzLnByZXBhcmVNZXNzYWdlRGF0YShkYXRhKTtcclxuICAgICAgXHJcbiAgICAgIC8vIEFkZCBpbnRlcmFjdGlvbl9pZCBpZiBwcm92aWRlZFxyXG4gICAgICBpZiAoZGF0YS5pbnRlcmFjdGlvbklkKSB7XHJcbiAgICAgICAgbWVzc2FnZURhdGEuaW50ZXJhY3Rpb25faWQgPSBkYXRhLmludGVyYWN0aW9uSWQ7XHJcbiAgICAgIH1cclxuICAgIH0gZWxzZSBpZiAodHlwZW9mIGNoYW5uZWxJZE9yRGF0YSA9PT0gJ29iamVjdCcpIHtcclxuICAgICAgLy8gRXNraSBmb3JtYXQ6IGNyZWF0ZU1lc3NhZ2UoY2hhbm5lbElkLCBkYXRhKSAtIGd1aWxkSWQgeW9rXHJcbiAgICAgIC8vIEJ1IGZvcm1hdCBhcnTEsWsgZGVzdGVrbGVubWl5b3IsIGhhdGEgZsSxcmxhdFxyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ2NyZWF0ZU1lc3NhZ2UgcmVxdWlyZXMgZ3VpbGRJZDogY3JlYXRlTWVzc2FnZShndWlsZElkLCBjaGFubmVsSWQsIGRhdGEpJyk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgY3JlYXRlTWVzc2FnZSBhcmd1bWVudHMnKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBUElNZXNzYWdlPignUE9TVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS9tZXNzYWdlc2AsIG1lc3NhZ2VEYXRhKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhbiBlcGhlbWVyYWwgbWVzc2FnZSB0aGF0IGlzIG9ubHkgdmlzaWJsZSB0byBhIHNwZWNpZmljIHVzZXJcclxuICAgKiBFcGhlbWVyYWwgbWVzc2FnZXMgYXJlIE5PVCBzYXZlZCB0byBkYXRhYmFzZSAtIHRoZXkgYXJlIG9ubHkgc2VudCB2aWEgV2ViU29ja2V0XHJcbiAgICogXHJcbiAgICogQGV4YW1wbGVcclxuICAgKiAvLyBTZW5kIGEgd2FybmluZyBvbmx5IHZpc2libGUgdG8gdGhlIHVzZXJcclxuICAgKiBhd2FpdCByZXN0LmNyZWF0ZUVwaGVtZXJhbE1lc3NhZ2UoZ3VpbGRJZCwgY2hhbm5lbElkLCB0YXJnZXRVc2VySWQsIHtcclxuICAgKiAgIGVtYmVkczogW3dhcm5pbmdFbWJlZF1cclxuICAgKiB9KTtcclxuICAgKi9cclxuICBhc3luYyBjcmVhdGVFcGhlbWVyYWxNZXNzYWdlKGd1aWxkSWQ6IHN0cmluZywgY2hhbm5lbElkOiBzdHJpbmcsIHRhcmdldFVzZXJJZDogc3RyaW5nIHwgbnVtYmVyLCBkYXRhOiB7XHJcbiAgICBjb250ZW50Pzogc3RyaW5nO1xyXG4gICAgZW1iZWRzPzogQVBJRW1iZWRbXTtcclxuICB9KTogUHJvbWlzZTx7IGlkOiBzdHJpbmc7IGVwaGVtZXJhbDogYm9vbGVhbjsgZmxhZ3M6IG51bWJlciB9PiB7XHJcbiAgICBjb25zdCBtZXNzYWdlRGF0YSA9IHRoaXMucHJlcGFyZU1lc3NhZ2VEYXRhKGRhdGEpO1xyXG4gICAgXHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PHsgaWQ6IHN0cmluZzsgZXBoZW1lcmFsOiBib29sZWFuOyBmbGFnczogbnVtYmVyIH0+KCdQT1NUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vY2hhbm5lbHMvJHtjaGFubmVsSWR9L21lc3NhZ2VzYCwge1xyXG4gICAgICAuLi5tZXNzYWdlRGF0YSxcclxuICAgICAgZmxhZ3M6IDY0LCAvLyBFUEhFTUVSQUwgZmxhZ1xyXG4gICAgICB0YXJnZXRfdXNlcl9pZDogdHlwZW9mIHRhcmdldFVzZXJJZCA9PT0gJ3N0cmluZycgPyBwYXJzZUludCh0YXJnZXRVc2VySWQsIDEwKSA6IHRhcmdldFVzZXJJZFxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgYSBETSBtZXNzYWdlXHJcbiAgICovXHJcbiAgYXN5bmMgY3JlYXRlRE1NZXNzYWdlKGNoYW5uZWxJZDogc3RyaW5nLCBkYXRhOiB7XHJcbiAgICBjb250ZW50Pzogc3RyaW5nO1xyXG4gICAgZW1iZWRzPzogQVBJRW1iZWRbXTtcclxuICB9KTogUHJvbWlzZTxBUElNZXNzYWdlPiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0PEFQSU1lc3NhZ2U+KCdQT1NUJywgYC9ib3QvZG0vJHtjaGFubmVsSWR9YCwgZGF0YSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBFZGl0IGEgbWVzc2FnZVxyXG4gICAqIEF1dG9tYXRpY2FsbHkgcHJvY2Vzc2VzIG1lbnRpb25zXHJcbiAgICovXHJcbiAgYXN5bmMgZWRpdE1lc3NhZ2UoZ3VpbGRJZDogc3RyaW5nLCBjaGFubmVsSWQ6IHN0cmluZywgbWVzc2FnZUlkOiBzdHJpbmcsIGRhdGE6IHtcclxuICAgIGNvbnRlbnQ/OiBzdHJpbmc7XHJcbiAgICBlbWJlZHM/OiBBUElFbWJlZFtdO1xyXG4gICAgbWVudGlvbnM/OiBNZW50aW9uc0RhdGE7XHJcbiAgfSk6IFByb21pc2U8QVBJTWVzc2FnZT4ge1xyXG4gICAgY29uc3QgcGF0aCA9IGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS9tZXNzYWdlcy8ke21lc3NhZ2VJZH1gO1xyXG4gICAgY29uc3QgcHJvY2Vzc2VkRGF0YSA9IHRoaXMucHJlcGFyZU1lc3NhZ2VEYXRhKGRhdGEpO1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdDxBUElNZXNzYWdlPignUEFUQ0gnLCBwYXRoLCBwcm9jZXNzZWREYXRhKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlbGV0ZSBhIG1lc3NhZ2VcclxuICAgKi9cclxuICBhc3luYyBkZWxldGVNZXNzYWdlKGd1aWxkSWQ6IHN0cmluZywgY2hhbm5lbElkOiBzdHJpbmcsIG1lc3NhZ2VJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBwYXRoID0gYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vY2hhbm5lbHMvJHtjaGFubmVsSWR9L21lc3NhZ2VzLyR7bWVzc2FnZUlkfWA7XHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3Q8dm9pZD4oJ0RFTEVURScsIHBhdGgpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRkIGEgcmVhY3Rpb24gdG8gYSBtZXNzYWdlXHJcbiAgICovXHJcbiAgYXN5bmMgYWRkUmVhY3Rpb24oZ3VpbGRJZDogc3RyaW5nLCBjaGFubmVsSWQ6IHN0cmluZywgbWVzc2FnZUlkOiBzdHJpbmcsIGVtb2ppOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IHBhdGggPSBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH0vbWVzc2FnZXMvJHttZXNzYWdlSWR9L3JlYWN0aW9ucy8ke2VuY29kZVVSSUNvbXBvbmVudChlbW9qaSl9L0BtZWA7XHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3Q8dm9pZD4oJ1BVVCcsIHBhdGgpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVXBsb2FkIGFuIGF0dGFjaG1lbnQgdG8gYSBjaGFubmVsXHJcbiAgICovXHJcbiAgYXN5bmMgdXBsb2FkQXR0YWNobWVudChndWlsZElkOiBzdHJpbmcsIGNoYW5uZWxJZDogc3RyaW5nLCBmaWxlOiB7IG5hbWU6IHN0cmluZzsgZGF0YTogQnVmZmVyOyBjb250ZW50VHlwZT86IHN0cmluZyB9KTogUHJvbWlzZTx7IGlkOiBzdHJpbmc7IHVybDogc3RyaW5nOyBmaWxlbmFtZTogc3RyaW5nIH0+IHtcclxuICAgIGNvbnN0IEZvcm1EYXRhID0gcmVxdWlyZSgnZm9ybS1kYXRhJyk7XHJcbiAgICBjb25zdCBmb3JtID0gbmV3IEZvcm1EYXRhKCk7XHJcbiAgICBcclxuICAgIC8vIGZvcm0tZGF0YSBleHBlY3RzIHRoZSBidWZmZXIgZGlyZWN0bHkgd2l0aCBvcHRpb25zXHJcbiAgICBmb3JtLmFwcGVuZCgnZmlsZScsIGZpbGUuZGF0YSwge1xyXG4gICAgICBmaWxlbmFtZTogZmlsZS5uYW1lLFxyXG4gICAgICBjb250ZW50VHlwZTogZmlsZS5jb250ZW50VHlwZSB8fCAndGV4dC9wbGFpbidcclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBjb25zdCB1cmwgPSBgJHt0aGlzLmJhc2VVcmx9L2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH0vYXR0YWNobWVudHNgO1xyXG4gICAgXHJcbiAgICBjb25zb2xlLmxvZyhgW1JFU1RdIFVwbG9hZGluZyBhdHRhY2htZW50OiAke2ZpbGUubmFtZX0gKCR7ZmlsZS5kYXRhLmxlbmd0aH0gYnl0ZXMpYCk7XHJcbiAgICBcclxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2godXJsLCB7XHJcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxyXG4gICAgICBoZWFkZXJzOiB7XHJcbiAgICAgICAgJ0F1dGhvcml6YXRpb24nOiBgQm90ICR7dGhpcy50b2tlbn1gLFxyXG4gICAgICAgIC4uLmZvcm0uZ2V0SGVhZGVycygpXHJcbiAgICAgIH0sXHJcbiAgICAgIGJvZHk6IGZvcm0uZ2V0QnVmZmVyKClcclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XHJcbiAgICAgIGNvbnN0IGVycm9yID0gYXdhaXQgcmVzcG9uc2UudGV4dCgpO1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEFQSSBFcnJvciAke3Jlc3BvbnNlLnN0YXR1c306ICR7ZXJyb3J9YCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHJldHVybiByZXNwb25zZS5qc29uKCkgYXMgUHJvbWlzZTx7IGlkOiBzdHJpbmc7IHVybDogc3RyaW5nOyBmaWxlbmFtZTogc3RyaW5nIH0+O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgbWVzc2FnZSB3aXRoIGEgZmlsZSBhdHRhY2htZW50XHJcbiAgICovXHJcbiAgYXN5bmMgY3JlYXRlTWVzc2FnZVdpdGhGaWxlKGd1aWxkSWQ6IHN0cmluZywgY2hhbm5lbElkOiBzdHJpbmcsIGRhdGE6IHtcclxuICAgIGNvbnRlbnQ/OiBzdHJpbmc7XHJcbiAgICBmaWxlOiB7IG5hbWU6IHN0cmluZzsgZGF0YTogQnVmZmVyOyBjb250ZW50VHlwZT86IHN0cmluZyB9O1xyXG4gICAgaW50ZXJhY3Rpb25JZD86IHN0cmluZztcclxuICB9KTogUHJvbWlzZTxBUElNZXNzYWdlPiB7XHJcbiAgICBjb25zdCBGb3JtRGF0YSA9IHJlcXVpcmUoJ2Zvcm0tZGF0YScpO1xyXG4gICAgY29uc3QgZm9ybSA9IG5ldyBGb3JtRGF0YSgpO1xyXG4gICAgXHJcbiAgICAvLyBBZGQgY29udGVudCBpZiBwcm92aWRlZFxyXG4gICAgaWYgKGRhdGEuY29udGVudCkge1xyXG4gICAgICBmb3JtLmFwcGVuZCgnY29udGVudCcsIGRhdGEuY29udGVudCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIEFkZCBpbnRlcmFjdGlvbl9pZCBpZiBwcm92aWRlZCAoZm9yIGRlZmVycmVkIHJlc3BvbnNlIG1hdGNoaW5nKVxyXG4gICAgaWYgKGRhdGEuaW50ZXJhY3Rpb25JZCkge1xyXG4gICAgICBmb3JtLmFwcGVuZCgnaW50ZXJhY3Rpb25faWQnLCBkYXRhLmludGVyYWN0aW9uSWQpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvLyBBZGQgZmlsZVxyXG4gICAgZm9ybS5hcHBlbmQoJ2ZpbGVzJywgZGF0YS5maWxlLmRhdGEsIHtcclxuICAgICAgZmlsZW5hbWU6IGRhdGEuZmlsZS5uYW1lLFxyXG4gICAgICBjb250ZW50VHlwZTogZGF0YS5maWxlLmNvbnRlbnRUeXBlIHx8ICd0ZXh0L3BsYWluJ1xyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIGNvbnN0IHVybCA9IGAke3RoaXMuYmFzZVVybH0vYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS9tZXNzYWdlc2A7XHJcbiAgICBcclxuICAgIGNvbnNvbGUubG9nKGBbUkVTVF0gQ3JlYXRpbmcgbWVzc2FnZSB3aXRoIGZpbGU6ICR7ZGF0YS5maWxlLm5hbWV9ICgke2RhdGEuZmlsZS5kYXRhLmxlbmd0aH0gYnl0ZXMpJHtkYXRhLmludGVyYWN0aW9uSWQgPyBgIFtpbnRlcmFjdGlvbjogJHtkYXRhLmludGVyYWN0aW9uSWR9XWAgOiAnJ31gKTtcclxuICAgIFxyXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCh1cmwsIHtcclxuICAgICAgbWV0aG9kOiAnUE9TVCcsXHJcbiAgICAgIGhlYWRlcnM6IHtcclxuICAgICAgICAnQXV0aG9yaXphdGlvbic6IGBCb3QgJHt0aGlzLnRva2VufWAsXHJcbiAgICAgICAgLi4uZm9ybS5nZXRIZWFkZXJzKClcclxuICAgICAgfSxcclxuICAgICAgYm9keTogZm9ybS5nZXRCdWZmZXIoKVxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIGlmICghcmVzcG9uc2Uub2spIHtcclxuICAgICAgY29uc3QgZXJyb3IgPSBhd2FpdCByZXNwb25zZS50ZXh0KCk7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQVBJIEVycm9yICR7cmVzcG9uc2Uuc3RhdHVzfTogJHtlcnJvcn1gKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgcmV0dXJuIHJlc3BvbnNlLmpzb24oKSBhcyBQcm9taXNlPEFQSU1lc3NhZ2U+O1xyXG4gIH1cclxuXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT0gSW50ZXJhY3Rpb25zID09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhbiBpbnRlcmFjdGlvbiByZXNwb25zZVxyXG4gICAqIEF1dG9tYXRpY2FsbHkgcHJvY2Vzc2VzIG1lbnRpb25zIGluIGNvbnRlbnQgYW5kIGVtYmVkc1xyXG4gICAqL1xyXG4gIGFzeW5jIGNyZWF0ZUludGVyYWN0aW9uUmVzcG9uc2UoaW50ZXJhY3Rpb25JZDogc3RyaW5nLCB0b2tlbjogc3RyaW5nLCBkYXRhOiB7XHJcbiAgICB0eXBlOiBudW1iZXI7XHJcbiAgICBkYXRhPzogYW55O1xyXG4gIH0pOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnNvbGUubG9nKGDwn5OkIEludGVyYWN0aW9uIHJlc3BvbnNlOiAke2ludGVyYWN0aW9uSWR9IC0+IHR5cGUgJHtkYXRhLnR5cGV9YCk7XHJcbiAgICB0cnkge1xyXG4gICAgICAvLyBQcm9jZXNzIG1lbnRpb25zIGluIHJlc3BvbnNlIGRhdGEgaWYgcHJlc2VudFxyXG4gICAgICBsZXQgcHJvY2Vzc2VkRGF0YSA9IGRhdGE7XHJcbiAgICAgIGlmIChkYXRhLmRhdGEgJiYgKGRhdGEuZGF0YS5jb250ZW50IHx8IGRhdGEuZGF0YS5lbWJlZHMpKSB7XHJcbiAgICAgICAgcHJvY2Vzc2VkRGF0YSA9IHtcclxuICAgICAgICAgIC4uLmRhdGEsXHJcbiAgICAgICAgICBkYXRhOiB0aGlzLnByZXBhcmVNZXNzYWdlRGF0YShkYXRhLmRhdGEpXHJcbiAgICAgICAgfTtcclxuICAgICAgfVxyXG4gICAgICBcclxuICAgICAgYXdhaXQgdGhpcy5yZXF1ZXN0PHZvaWQ+KCdQT1NUJywgYC9pbnRlcmFjdGlvbnMvJHtpbnRlcmFjdGlvbklkfS8ke3Rva2VufS9jYWxsYmFja2AsIHByb2Nlc3NlZERhdGEpO1xyXG4gICAgICBjb25zb2xlLmxvZyhg4pyFIEludGVyYWN0aW9uIHJlc3BvbnNlIHNlbnRgKTtcclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIGNvbnNvbGUuZXJyb3IoYOKdjCBJbnRlcmFjdGlvbiByZXNwb25zZSBlcnJvcjpgLCBlcnJvcik7XHJcbiAgICAgIHRocm93IGVycm9yO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRWRpdCB0aGUgb3JpZ2luYWwgaW50ZXJhY3Rpb24gcmVzcG9uc2VcclxuICAgKiBJZiBmaWxlcyBhcmUgcHJvdmlkZWQsIGNyZWF0ZXMgYSBuZXcgbWVzc2FnZSB3aXRoIGZpbGVzIChzaW5jZSB3ZWJob29rIGVkaXQgZG9lc24ndCBzdXBwb3J0IGZpbGUgdXBsb2FkKVxyXG4gICAqIEF1dG9tYXRpY2FsbHkgcHJvY2Vzc2VzIG1lbnRpb25zXHJcbiAgICovXHJcbiAgYXN5bmMgZWRpdEludGVyYWN0aW9uUmVzcG9uc2UodG9rZW46IHN0cmluZywgZGF0YToge1xyXG4gICAgY29udGVudD86IHN0cmluZztcclxuICAgIGVtYmVkcz86IEFQSUVtYmVkW107XHJcbiAgICBjb21wb25lbnRzPzogYW55W107XHJcbiAgICBtZW50aW9ucz86IE1lbnRpb25zRGF0YTtcclxuICAgIGZpbGVzPzogQXJyYXk8eyBuYW1lOiBzdHJpbmc7IGRhdGE6IEJ1ZmZlcjsgY29udGVudFR5cGU/OiBzdHJpbmcgfT47XHJcbiAgfSwgZ3VpbGRJZD86IHN0cmluZywgY2hhbm5lbElkPzogc3RyaW5nLCBpbnRlcmFjdGlvbklkPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBhcHBJZCA9IHRoaXMuZ2V0QXBwbGljYXRpb25JZCgpO1xyXG4gICAgXHJcbiAgICAvLyBQcm9jZXNzIG1lbnRpb25zIGluIGNvbnRlbnRcclxuICAgIGNvbnN0IHByb2Nlc3NlZERhdGEgPSB0aGlzLnByZXBhcmVNZXNzYWdlRGF0YShkYXRhKTtcclxuICAgIFxyXG4gICAgLy8gSWYgZmlsZXMgYXJlIHByZXNlbnQgYW5kIHdlIGhhdmUgZ3VpbGQvY2hhbm5lbCBpbmZvLCBjcmVhdGUgbWVzc2FnZSB3aXRoIGZpbGUgaW5zdGVhZFxyXG4gICAgaWYgKGRhdGEuZmlsZXMgJiYgZGF0YS5maWxlcy5sZW5ndGggPiAwICYmIGd1aWxkSWQgJiYgY2hhbm5lbElkKSB7XHJcbiAgICAgIGNvbnNvbGUubG9nKGBbUkVTVF0gZWRpdEludGVyYWN0aW9uUmVzcG9uc2Ugd2l0aCAke2RhdGEuZmlsZXMubGVuZ3RofSBmaWxlcyAtIHVzaW5nIGNyZWF0ZU1lc3NhZ2VXaXRoRmlsZWApO1xyXG4gICAgICBcclxuICAgICAgLy8gQ3JlYXRlIG1lc3NhZ2Ugd2l0aCBmaWxlXHJcbiAgICAgIGNvbnN0IGZpbGUgPSBkYXRhLmZpbGVzWzBdOyAvLyBGb3Igbm93LCBzdXBwb3J0IHNpbmdsZSBmaWxlXHJcbiAgICAgIGF3YWl0IHRoaXMuY3JlYXRlTWVzc2FnZVdpdGhGaWxlKGd1aWxkSWQsIGNoYW5uZWxJZCwge1xyXG4gICAgICAgIGNvbnRlbnQ6IHByb2Nlc3NlZERhdGEuY29udGVudCxcclxuICAgICAgICBmaWxlOiBmaWxlLFxyXG4gICAgICAgIGludGVyYWN0aW9uSWQ6IGludGVyYWN0aW9uSWRcclxuICAgICAgfSk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIFxyXG4gICAgLy8gSWYgd2UgaGF2ZSBndWlsZElkLCBjaGFubmVsSWQgYW5kIGludGVyYWN0aW9uSWQsIGNyZWF0ZSBhIG5ldyBtZXNzYWdlIHdpdGggaW50ZXJhY3Rpb25faWRcclxuICAgIC8vIFRoaXMgaXMgbmVlZGVkIGJlY2F1c2Ugb3VyIGRlZmVycmVkIHJlc3BvbnNlIGRvZXNuJ3QgY3JlYXRlIGEgbWVzc2FnZVxyXG4gICAgaWYgKGd1aWxkSWQgJiYgY2hhbm5lbElkICYmIGludGVyYWN0aW9uSWQpIHtcclxuICAgICAgY29uc29sZS5sb2coYFtSRVNUXSBlZGl0SW50ZXJhY3Rpb25SZXNwb25zZSAtIGNyZWF0aW5nIG1lc3NhZ2Ugd2l0aCBpbnRlcmFjdGlvbl9pZDogJHtpbnRlcmFjdGlvbklkfWApO1xyXG4gICAgICBcclxuICAgICAgY29uc3QgcGF5bG9hZDogYW55ID0ge1xyXG4gICAgICAgIGludGVyYWN0aW9uX2lkOiBpbnRlcmFjdGlvbklkXHJcbiAgICAgIH07XHJcbiAgICAgIGlmIChwcm9jZXNzZWREYXRhLmNvbnRlbnQgIT09IHVuZGVmaW5lZCkgcGF5bG9hZC5jb250ZW50ID0gcHJvY2Vzc2VkRGF0YS5jb250ZW50O1xyXG4gICAgICBpZiAocHJvY2Vzc2VkRGF0YS5lbWJlZHMpIHBheWxvYWQuZW1iZWRzID0gcHJvY2Vzc2VkRGF0YS5lbWJlZHM7XHJcbiAgICAgIGlmIChwcm9jZXNzZWREYXRhLmNvbXBvbmVudHMpIHBheWxvYWQuY29tcG9uZW50cyA9IHByb2Nlc3NlZERhdGEuY29tcG9uZW50cztcclxuICAgICAgaWYgKHByb2Nlc3NlZERhdGEubWVudGlvbnMpIHBheWxvYWQubWVudGlvbnMgPSBwcm9jZXNzZWREYXRhLm1lbnRpb25zO1xyXG4gICAgICBcclxuICAgICAgYXdhaXQgdGhpcy5yZXF1ZXN0PHZvaWQ+KCdQT1NUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vY2hhbm5lbHMvJHtjaGFubmVsSWR9L21lc3NhZ2VzYCwgcGF5bG9hZCk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIFxyXG4gICAgLy8gRmFsbGJhY2s6IFJlZ3VsYXIgZWRpdCB3aXRob3V0IGZpbGVzICh3ZWJob29rIFBBVENIKVxyXG4gICAgY29uc3QgcGF5bG9hZDogYW55ID0ge307XHJcbiAgICBpZiAocHJvY2Vzc2VkRGF0YS5jb250ZW50ICE9PSB1bmRlZmluZWQpIHBheWxvYWQuY29udGVudCA9IHByb2Nlc3NlZERhdGEuY29udGVudDtcclxuICAgIGlmIChwcm9jZXNzZWREYXRhLmVtYmVkcykgcGF5bG9hZC5lbWJlZHMgPSBwcm9jZXNzZWREYXRhLmVtYmVkcztcclxuICAgIGlmIChwcm9jZXNzZWREYXRhLmNvbXBvbmVudHMpIHBheWxvYWQuY29tcG9uZW50cyA9IHByb2Nlc3NlZERhdGEuY29tcG9uZW50cztcclxuICAgIGlmIChwcm9jZXNzZWREYXRhLm1lbnRpb25zKSBwYXlsb2FkLm1lbnRpb25zID0gcHJvY2Vzc2VkRGF0YS5tZW50aW9ucztcclxuICAgIFxyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0PHZvaWQ+KCdQQVRDSCcsIGAvd2ViaG9va3MvJHthcHBJZH0vJHt0b2tlbn0vbWVzc2FnZXMvQG9yaWdpbmFsYCwgcGF5bG9hZCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZWxldGUgdGhlIG9yaWdpbmFsIGludGVyYWN0aW9uIHJlc3BvbnNlXHJcbiAgICovXHJcbiAgYXN5bmMgZGVsZXRlSW50ZXJhY3Rpb25SZXNwb25zZSh0b2tlbjogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBhcHBJZCA9IHRoaXMuZ2V0QXBwbGljYXRpb25JZCgpO1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0PHZvaWQ+KCdERUxFVEUnLCBgL3dlYmhvb2tzLyR7YXBwSWR9LyR7dG9rZW59L21lc3NhZ2VzL0BvcmlnaW5hbGApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgZm9sbG93dXAgbWVzc2FnZVxyXG4gICAqIEF1dG9tYXRpY2FsbHkgcHJvY2Vzc2VzIG1lbnRpb25zXHJcbiAgICovXHJcbiAgYXN5bmMgY3JlYXRlRm9sbG93dXAodG9rZW46IHN0cmluZywgZGF0YToge1xyXG4gICAgY29udGVudD86IHN0cmluZztcclxuICAgIGVtYmVkcz86IEFQSUVtYmVkW107XHJcbiAgICBtZW50aW9ucz86IE1lbnRpb25zRGF0YTtcclxuICAgIGZsYWdzPzogbnVtYmVyO1xyXG4gIH0pOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IGFwcElkID0gdGhpcy5nZXRBcHBsaWNhdGlvbklkKCk7XHJcbiAgICBjb25zdCBwcm9jZXNzZWREYXRhID0gdGhpcy5wcmVwYXJlTWVzc2FnZURhdGEoZGF0YSk7XHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3Q8dm9pZD4oJ1BPU1QnLCBgL3dlYmhvb2tzLyR7YXBwSWR9LyR7dG9rZW59YCwgcHJvY2Vzc2VkRGF0YSk7XHJcbiAgfVxyXG5cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PSBDb21tYW5kcyA9PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAvKipcclxuICAgKiBSZWdpc3RlciBnbG9iYWwgYXBwbGljYXRpb24gY29tbWFuZHNcclxuICAgKi9cclxuICBhc3luYyByZWdpc3Rlckdsb2JhbENvbW1hbmRzKGNvbW1hbmRzOiBBUElBcHBsaWNhdGlvbkNvbW1hbmRbXSk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgYXBwSWQgPSB0aGlzLmdldEFwcGxpY2F0aW9uSWQoKTtcclxuICAgIFxyXG4gICAgZm9yIChjb25zdCBjb21tYW5kIG9mIGNvbW1hbmRzKSB7XHJcbiAgICAgIGF3YWl0IHRoaXMucmVxdWVzdDx2b2lkPignUE9TVCcsIGAvYXBwbGljYXRpb25zLyR7YXBwSWR9L2NvbW1hbmRzYCwgY29tbWFuZCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZWdpc3RlciBndWlsZC1zcGVjaWZpYyBjb21tYW5kc1xyXG4gICAqL1xyXG4gIGFzeW5jIHJlZ2lzdGVyR3VpbGRDb21tYW5kcyhndWlsZElkOiBzdHJpbmcsIGNvbW1hbmRzOiBBUElBcHBsaWNhdGlvbkNvbW1hbmRbXSk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgYXBwSWQgPSB0aGlzLmdldEFwcGxpY2F0aW9uSWQoKTtcclxuICAgIFxyXG4gICAgZm9yIChjb25zdCBjb21tYW5kIG9mIGNvbW1hbmRzKSB7XHJcbiAgICAgIGF3YWl0IHRoaXMucmVxdWVzdDx2b2lkPignUE9TVCcsIGAvYXBwbGljYXRpb25zLyR7YXBwSWR9L2d1aWxkcy8ke2d1aWxkSWR9L2NvbW1hbmRzYCwgY29tbWFuZCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZWxldGUgYSBnbG9iYWwgY29tbWFuZFxyXG4gICAqL1xyXG4gIGFzeW5jIGRlbGV0ZUdsb2JhbENvbW1hbmQoY29tbWFuZElkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IGFwcElkID0gdGhpcy5nZXRBcHBsaWNhdGlvbklkKCk7XHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3Q8dm9pZD4oJ0RFTEVURScsIGAvYXBwbGljYXRpb25zLyR7YXBwSWR9L2NvbW1hbmRzLyR7Y29tbWFuZElkfWApO1xyXG4gIH1cclxuXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT0gSGVscGVycyA9PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICBwcml2YXRlIGFwcGxpY2F0aW9uSWQ6IHN0cmluZyA9ICcnO1xyXG5cclxuICAvKipcclxuICAgKiBTZXQgdGhlIGFwcGxpY2F0aW9uIElEXHJcbiAgICovXHJcbiAgc2V0QXBwbGljYXRpb25JZChpZDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICB0aGlzLmFwcGxpY2F0aW9uSWQgPSBpZDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCB0aGUgYXBwbGljYXRpb24gSURcclxuICAgKi9cclxuICBwcml2YXRlIGdldEFwcGxpY2F0aW9uSWQoKTogc3RyaW5nIHtcclxuICAgIGlmICghdGhpcy5hcHBsaWNhdGlvbklkKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcignQXBwbGljYXRpb24gSUQgbm90IHNldC4gQ2FsbCBzZXRBcHBsaWNhdGlvbklkKCkgZmlyc3QuJyk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGhpcy5hcHBsaWNhdGlvbklkO1xyXG4gIH1cclxuXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT0gQ2hhbm5lbHMgPT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgY2hhbm5lbCBpbiBhIGd1aWxkXHJcbiAgICovXHJcbiAgYXN5bmMgY3JlYXRlQ2hhbm5lbChndWlsZElkOiBzdHJpbmcsIGRhdGE6IHtcclxuICAgIG5hbWU6IHN0cmluZztcclxuICAgIHR5cGU/OiBudW1iZXI7XHJcbiAgICBwYXJlbnRfaWQ/OiBzdHJpbmcgfCBudWxsO1xyXG4gICAgY2F0ZWdvcnlfaWQ/OiBzdHJpbmcgfCBudWxsO1xyXG4gICAgcGVybWlzc2lvbl9vdmVyd3JpdGVzPzogQXJyYXk8e1xyXG4gICAgICBpZDogc3RyaW5nO1xyXG4gICAgICB0eXBlOiBudW1iZXI7XHJcbiAgICAgIGFsbG93Pzogc3RyaW5nO1xyXG4gICAgICBkZW55Pzogc3RyaW5nO1xyXG4gICAgfT47XHJcbiAgfSk6IFByb21pc2U8eyBpZDogc3RyaW5nOyBuYW1lOiBzdHJpbmcgfT4ge1xyXG4gICAgLy8gTWFwIHBhcmVudF9pZCB0byBjYXRlZ29yeV9pZCBmb3IgYmFja2VuZCBjb21wYXRpYmlsaXR5XHJcbiAgICBjb25zdCByZXF1ZXN0RGF0YTogYW55ID0ge1xyXG4gICAgICBuYW1lOiBkYXRhLm5hbWUsXHJcbiAgICAgIHR5cGU6IGRhdGEudHlwZSA/PyAwLCAvLyBEZWZhdWx0IHRvIHRleHQgY2hhbm5lbFxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgLy8gQmFja2VuZCBleHBlY3RzIGNhdGVnb3J5X2lkLCBub3QgcGFyZW50X2lkXHJcbiAgICBpZiAoZGF0YS5jYXRlZ29yeV9pZCkge1xyXG4gICAgICByZXF1ZXN0RGF0YS5jYXRlZ29yeV9pZCA9IGRhdGEuY2F0ZWdvcnlfaWQ7XHJcbiAgICB9IGVsc2UgaWYgKGRhdGEucGFyZW50X2lkKSB7XHJcbiAgICAgIHJlcXVlc3REYXRhLmNhdGVnb3J5X2lkID0gZGF0YS5wYXJlbnRfaWQ7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIEFkZCBwZXJtaXNzaW9uX292ZXJ3cml0ZXMgaWYgcHJvdmlkZWRcclxuICAgIGlmIChkYXRhLnBlcm1pc3Npb25fb3ZlcndyaXRlcyAmJiBkYXRhLnBlcm1pc3Npb25fb3ZlcndyaXRlcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgIHJlcXVlc3REYXRhLnBlcm1pc3Npb25fb3ZlcndyaXRlcyA9IGRhdGEucGVybWlzc2lvbl9vdmVyd3JpdGVzO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KCdQT1NUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vY2hhbm5lbHNgLCByZXF1ZXN0RGF0YSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZWxldGUgYSBjaGFubmVsXHJcbiAgICovXHJcbiAgLyoqXHJcbiAgICogRGVsZXRlIGEgY2hhbm5lbFxyXG4gICAqL1xyXG4gIGFzeW5jIGRlbGV0ZUNoYW5uZWwoZ3VpbGRJZDogc3RyaW5nLCBjaGFubmVsSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0KCdERUxFVEUnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEVkaXQgY2hhbm5lbCBwZXJtaXNzaW9uIG92ZXJ3cml0ZXNcclxuICAgKi9cclxuICBhc3luYyBlZGl0Q2hhbm5lbFBlcm1pc3Npb25zKGNoYW5uZWxJZDogc3RyaW5nLCBvdmVyd3JpdGVJZDogc3RyaW5nLCBkYXRhOiB7XHJcbiAgICB0eXBlOiBudW1iZXI7XHJcbiAgICBhbGxvdz86IHN0cmluZztcclxuICAgIGRlbnk/OiBzdHJpbmc7XHJcbiAgfSk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0KCdQVVQnLCBgL2JvdC9jaGFubmVscy8ke2NoYW5uZWxJZH0vcGVybWlzc2lvbnMvJHtvdmVyd3JpdGVJZH1gLCBkYXRhKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlbGV0ZSBjaGFubmVsIHBlcm1pc3Npb24gb3ZlcndyaXRlXHJcbiAgICovXHJcbiAgYXN5bmMgZGVsZXRlQ2hhbm5lbFBlcm1pc3Npb24oY2hhbm5lbElkOiBzdHJpbmcsIG92ZXJ3cml0ZUlkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdCgnREVMRVRFJywgYC9ib3QvY2hhbm5lbHMvJHtjaGFubmVsSWR9L3Blcm1pc3Npb25zLyR7b3ZlcndyaXRlSWR9YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgbWVzc2FnZXMgZnJvbSBhIGNoYW5uZWxcclxuICAgKi9cclxuICBhc3luYyBnZXRNZXNzYWdlcyhndWlsZElkOiBzdHJpbmcsIGNoYW5uZWxJZDogc3RyaW5nLCBvcHRpb25zPzoge1xyXG4gICAgbGltaXQ/OiBudW1iZXI7XHJcbiAgICBiZWZvcmU/OiBzdHJpbmc7XHJcbiAgICBhZnRlcj86IHN0cmluZztcclxuICB9KTogUHJvbWlzZTxBUElNZXNzYWdlW10+IHtcclxuICAgIGNvbnN0IHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoKTtcclxuICAgIGlmIChvcHRpb25zPy5saW1pdCkgcGFyYW1zLmFwcGVuZCgnbGltaXQnLCBTdHJpbmcob3B0aW9ucy5saW1pdCkpO1xyXG4gICAgaWYgKG9wdGlvbnM/LmJlZm9yZSkgcGFyYW1zLmFwcGVuZCgnYmVmb3JlJywgb3B0aW9ucy5iZWZvcmUpO1xyXG4gICAgaWYgKG9wdGlvbnM/LmFmdGVyKSBwYXJhbXMuYXBwZW5kKCdhZnRlcicsIG9wdGlvbnMuYWZ0ZXIpO1xyXG4gICAgXHJcbiAgICBjb25zdCBxdWVyeSA9IHBhcmFtcy50b1N0cmluZygpID8gYD8ke3BhcmFtcy50b1N0cmluZygpfWAgOiAnJztcclxuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5yZXF1ZXN0PHsgbWVzc2FnZXM6IEFQSU1lc3NhZ2VbXTsgcGFnZV9pbmZvOiBhbnkgfT4oJ0dFVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS9tZXNzYWdlcyR7cXVlcnl9YCk7XHJcbiAgICByZXR1cm4gcmVzcG9uc2UubWVzc2FnZXMgfHwgW107XHJcbiAgfVxyXG5cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PSBNZW1iZXJzID09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhIGd1aWxkIG1lbWJlclxyXG4gICAqL1xyXG4gIGFzeW5jIGdldE1lbWJlcihndWlsZElkOiBzdHJpbmcsIHVzZXJJZDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoJ0dFVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L21lbWJlcnMvJHt1c2VySWR9YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBUaW1lb3V0IGEgZ3VpbGQgbWVtYmVyXHJcbiAgICovXHJcbiAgYXN5bmMgdGltZW91dE1lbWJlcihndWlsZElkOiBzdHJpbmcsIHVzZXJJZDogc3RyaW5nLCBkdXJhdGlvbjogbnVtYmVyIHwgbnVsbCwgcmVhc29uPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBpZiAoZHVyYXRpb24gPT09IG51bGwpIHtcclxuICAgICAgLy8gQ2xlYXIgdGltZW91dFxyXG4gICAgICBhd2FpdCB0aGlzLnJlcXVlc3QoJ1BPU1QnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9tZW1iZXJzLyR7dXNlcklkfS90aW1lb3V0L2NsZWFyYCwge1xyXG4gICAgICAgIHJlYXNvblxyXG4gICAgICB9KTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIC8vIFNldCB0aW1lb3V0XHJcbiAgICAgIGNvbnN0IHVudGlsID0gbmV3IERhdGUoRGF0ZS5ub3coKSArIGR1cmF0aW9uKS50b0lTT1N0cmluZygpO1xyXG4gICAgICBhd2FpdCB0aGlzLnJlcXVlc3QoJ1BPU1QnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9tZW1iZXJzLyR7dXNlcklkfS90aW1lb3V0YCwge1xyXG4gICAgICAgIHVudGlsLFxyXG4gICAgICAgIHJlYXNvblxyXG4gICAgICB9KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEtpY2sgYSBndWlsZCBtZW1iZXJcclxuICAgKi9cclxuICBhc3luYyBraWNrTWVtYmVyKGd1aWxkSWQ6IHN0cmluZywgdXNlcklkOiBzdHJpbmcsIHJlYXNvbj86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgcXVlcnkgPSByZWFzb24gPyBgP3JlYXNvbj0ke2VuY29kZVVSSUNvbXBvbmVudChyZWFzb24pfWAgOiAnJztcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdCgnREVMRVRFJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vbWVtYmVycy8ke3VzZXJJZH0ke3F1ZXJ5fWApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQmFuIGEgZ3VpbGQgbWVtYmVyXHJcbiAgICovXHJcbiAgYXN5bmMgYmFuTWVtYmVyKGd1aWxkSWQ6IHN0cmluZywgdXNlcklkOiBzdHJpbmcsIG9wdGlvbnM/OiB7XHJcbiAgICBkZWxldGVNZXNzYWdlRGF5cz86IG51bWJlcjtcclxuICAgIGRlbGV0ZU1lc3NhZ2VTZWNvbmRzPzogbnVtYmVyO1xyXG4gICAgcmVhc29uPzogc3RyaW5nO1xyXG4gIH0pOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdCgnUFVUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vYmFucy8ke3VzZXJJZH1gLCB7XHJcbiAgICAgIGRlbGV0ZV9tZXNzYWdlX2RheXM6IG9wdGlvbnM/LmRlbGV0ZU1lc3NhZ2VEYXlzLFxyXG4gICAgICBkZWxldGVfbWVzc2FnZV9zZWNvbmRzOiBvcHRpb25zPy5kZWxldGVNZXNzYWdlU2Vjb25kcyxcclxuICAgICAgcmVhc29uOiBvcHRpb25zPy5yZWFzb25cclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVW5iYW4gYSB1c2VyXHJcbiAgICovXHJcbiAgYXN5bmMgdW5iYW5NZW1iZXIoZ3VpbGRJZDogc3RyaW5nLCB1c2VySWQ6IHN0cmluZywgcmVhc29uPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBxdWVyeSA9IHJlYXNvbiA/IGA/cmVhc29uPSR7ZW5jb2RlVVJJQ29tcG9uZW50KHJlYXNvbil9YCA6ICcnO1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0KCdERUxFVEUnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9iYW5zLyR7dXNlcklkfSR7cXVlcnl9YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBFZGl0IGEgZ3VpbGQgbWVtYmVyXHJcbiAgICovXHJcbiAgYXN5bmMgZWRpdE1lbWJlcihndWlsZElkOiBzdHJpbmcsIHVzZXJJZDogc3RyaW5nLCBkYXRhOiB7XHJcbiAgICBuaWNrPzogc3RyaW5nIHwgbnVsbDtcclxuICAgIHJvbGVzPzogc3RyaW5nW107XHJcbiAgICBtdXRlPzogYm9vbGVhbjtcclxuICAgIGRlYWY/OiBib29sZWFuO1xyXG4gICAgY2hhbm5lbF9pZD86IHN0cmluZyB8IG51bGw7XHJcbiAgICBjb21tdW5pY2F0aW9uX2Rpc2FibGVkX3VudGlsPzogc3RyaW5nIHwgbnVsbDtcclxuICAgIHJlYXNvbj86IHN0cmluZztcclxuICB9KTogUHJvbWlzZTxhbnk+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoJ1BBVENIJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vbWVtYmVycy8ke3VzZXJJZH1gLCBkYXRhKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEFkZCBhIHJvbGUgdG8gYSBtZW1iZXJcclxuICAgKi9cclxuICBhc3luYyBhZGRNZW1iZXJSb2xlKGd1aWxkSWQ6IHN0cmluZywgdXNlcklkOiBzdHJpbmcsIHJvbGVJZDogc3RyaW5nLCByZWFzb24/OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IHF1ZXJ5ID0gcmVhc29uID8gYD9yZWFzb249JHtlbmNvZGVVUklDb21wb25lbnQocmVhc29uKX1gIDogJyc7XHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3QoJ1BVVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L21lbWJlcnMvJHt1c2VySWR9L3JvbGVzLyR7cm9sZUlkfSR7cXVlcnl9YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZW1vdmUgYSByb2xlIGZyb20gYSBtZW1iZXJcclxuICAgKi9cclxuICBhc3luYyByZW1vdmVNZW1iZXJSb2xlKGd1aWxkSWQ6IHN0cmluZywgdXNlcklkOiBzdHJpbmcsIHJvbGVJZDogc3RyaW5nLCByZWFzb24/OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IHF1ZXJ5ID0gcmVhc29uID8gYD9yZWFzb249JHtlbmNvZGVVUklDb21wb25lbnQocmVhc29uKX1gIDogJyc7XHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3QoJ0RFTEVURScsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L21lbWJlcnMvJHt1c2VySWR9L3JvbGVzLyR7cm9sZUlkfSR7cXVlcnl9YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBCdWxrIGRlbGV0ZSBtZXNzYWdlc1xyXG4gICAqL1xyXG4gIGFzeW5jIGJ1bGtEZWxldGVNZXNzYWdlcyhndWlsZElkOiBzdHJpbmcsIGNoYW5uZWxJZDogc3RyaW5nLCBtZXNzYWdlSWRzOiBzdHJpbmdbXSk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0KCdQT1NUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vY2hhbm5lbHMvJHtjaGFubmVsSWR9L21lc3NhZ2VzL2J1bGstZGVsZXRlYCwge1xyXG4gICAgICBtZXNzYWdlczogbWVzc2FnZUlkc1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PSBHdWlsZHMgPT09PT09PT09PT09PT09PT09PT1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGEgZ3VpbGRcclxuICAgKi9cclxuICBhc3luYyBnZXRHdWlsZChndWlsZElkOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCgnR0VUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBndWlsZCBjaGFubmVsc1xyXG4gICAqL1xyXG4gIGFzeW5jIGdldEd1aWxkQ2hhbm5lbHMoZ3VpbGRJZDogc3RyaW5nKTogUHJvbWlzZTxhbnlbXT4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCgnR0VUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vY2hhbm5lbHNgKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBndWlsZCByb2xlc1xyXG4gICAqL1xyXG4gIGFzeW5jIGdldFJvbGVzKGd1aWxkSWQ6IHN0cmluZyk6IFByb21pc2U8YW55W10+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoJ0dFVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L3JvbGVzYCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgYSByb2xlXHJcbiAgICovXHJcbiAgYXN5bmMgY3JlYXRlUm9sZShndWlsZElkOiBzdHJpbmcsIGRhdGE6IHtcclxuICAgIG5hbWU/OiBzdHJpbmc7XHJcbiAgICBjb2xvcj86IG51bWJlcjtcclxuICAgIGhvaXN0PzogYm9vbGVhbjtcclxuICAgIG1lbnRpb25hYmxlPzogYm9vbGVhbjtcclxuICAgIHBlcm1pc3Npb25zPzogc3RyaW5nO1xyXG4gIH0pOiBQcm9taXNlPGFueT4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCgnUE9TVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L3JvbGVzYCwgZGF0YSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBFZGl0IGEgcm9sZVxyXG4gICAqL1xyXG4gIGFzeW5jIGVkaXRSb2xlKGd1aWxkSWQ6IHN0cmluZywgcm9sZUlkOiBzdHJpbmcsIGRhdGE6IHtcclxuICAgIG5hbWU/OiBzdHJpbmc7XHJcbiAgICBjb2xvcj86IG51bWJlcjtcclxuICAgIGhvaXN0PzogYm9vbGVhbjtcclxuICAgIG1lbnRpb25hYmxlPzogYm9vbGVhbjtcclxuICAgIHBlcm1pc3Npb25zPzogc3RyaW5nO1xyXG4gIH0pOiBQcm9taXNlPGFueT4ge1xyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCgnUEFUQ0gnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9yb2xlcy8ke3JvbGVJZH1gLCBkYXRhKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlbGV0ZSBhIHJvbGVcclxuICAgKi9cclxuICBhc3luYyBkZWxldGVSb2xlKGd1aWxkSWQ6IHN0cmluZywgcm9sZUlkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdCgnREVMRVRFJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vcm9sZXMvJHtyb2xlSWR9YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgZ3VpbGQgZW1vamlzXHJcbiAgICovXHJcbiAgYXN5bmMgZ2V0RW1vamlzKGd1aWxkSWQ6IHN0cmluZyk6IFByb21pc2U8YW55W10+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoJ0dFVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2Vtb2ppc2ApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGd1aWxkIGJhbnNcclxuICAgKi9cclxuICBhc3luYyBnZXRCYW5zKGd1aWxkSWQ6IHN0cmluZyk6IFByb21pc2U8YW55W10+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoJ0dFVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2JhbnNgKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhIHNwZWNpZmljIGJhblxyXG4gICAqL1xyXG4gIGFzeW5jIGdldEJhbihndWlsZElkOiBzdHJpbmcsIHVzZXJJZDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoJ0dFVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2JhbnMvJHt1c2VySWR9YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgZ3VpbGQgaW52aXRlc1xyXG4gICAqL1xyXG4gIGFzeW5jIGdldEd1aWxkSW52aXRlcyhndWlsZElkOiBzdHJpbmcpOiBQcm9taXNlPGFueVtdPiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KCdHRVQnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9pbnZpdGVzYCk7XHJcbiAgfVxyXG5cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PSBUaHJlYWRzID09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIHRocmVhZCBmcm9tIGEgbWVzc2FnZVxyXG4gICAqL1xyXG4gIGFzeW5jIGNyZWF0ZVRocmVhZEZyb21NZXNzYWdlKGd1aWxkSWQ6IHN0cmluZywgY2hhbm5lbElkOiBzdHJpbmcsIG1lc3NhZ2VJZDogc3RyaW5nLCBkYXRhOiB7XHJcbiAgICBuYW1lOiBzdHJpbmc7XHJcbiAgICBhdXRvX2FyY2hpdmVfZHVyYXRpb24/OiBudW1iZXI7XHJcbiAgfSk6IFByb21pc2U8YW55PiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KCdQT1NUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vY2hhbm5lbHMvJHtjaGFubmVsSWR9L21lc3NhZ2VzLyR7bWVzc2FnZUlkfS90aHJlYWRzYCwgZGF0YSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgYSB0aHJlYWQgd2l0aG91dCBhIG1lc3NhZ2VcclxuICAgKi9cclxuICBhc3luYyBjcmVhdGVUaHJlYWQoZ3VpbGRJZDogc3RyaW5nLCBjaGFubmVsSWQ6IHN0cmluZywgZGF0YToge1xyXG4gICAgbmFtZTogc3RyaW5nO1xyXG4gICAgdHlwZT86IG51bWJlcjtcclxuICAgIGF1dG9fYXJjaGl2ZV9kdXJhdGlvbj86IG51bWJlcjtcclxuICAgIGludml0YWJsZT86IGJvb2xlYW47XHJcbiAgfSk6IFByb21pc2U8YW55PiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KCdQT1NUJywgYC9ib3QvZ3VpbGRzLyR7Z3VpbGRJZH0vY2hhbm5lbHMvJHtjaGFubmVsSWR9L3RocmVhZHNgLCBkYXRhKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEpvaW4gYSB0aHJlYWRcclxuICAgKi9cclxuICBhc3luYyBqb2luVGhyZWFkKGNoYW5uZWxJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLnJlcXVlc3QoJ1BVVCcsIGAvYm90L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS90aHJlYWQtbWVtYmVycy9AbWVgKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIExlYXZlIGEgdGhyZWFkXHJcbiAgICovXHJcbiAgYXN5bmMgbGVhdmVUaHJlYWQoY2hhbm5lbElkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdCgnREVMRVRFJywgYC9ib3QvY2hhbm5lbHMvJHtjaGFubmVsSWR9L3RocmVhZC1tZW1iZXJzL0BtZWApO1xyXG4gIH1cclxuXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT0gUGlucyA9PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAvKipcclxuICAgKiBQaW4gYSBtZXNzYWdlXHJcbiAgICovXHJcbiAgYXN5bmMgcGluTWVzc2FnZShndWlsZElkOiBzdHJpbmcsIGNoYW5uZWxJZDogc3RyaW5nLCBtZXNzYWdlSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0KCdQVVQnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH0vcGlucy8ke21lc3NhZ2VJZH1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFVucGluIGEgbWVzc2FnZVxyXG4gICAqL1xyXG4gIGFzeW5jIHVucGluTWVzc2FnZShndWlsZElkOiBzdHJpbmcsIGNoYW5uZWxJZDogc3RyaW5nLCBtZXNzYWdlSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5yZXF1ZXN0KCdERUxFVEUnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH0vcGlucy8ke21lc3NhZ2VJZH1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBwaW5uZWQgbWVzc2FnZXNcclxuICAgKi9cclxuICBhc3luYyBnZXRQaW5uZWRNZXNzYWdlcyhndWlsZElkOiBzdHJpbmcsIGNoYW5uZWxJZDogc3RyaW5nKTogUHJvbWlzZTxBUElNZXNzYWdlW10+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoJ0dFVCcsIGAvYm90L2d1aWxkcy8ke2d1aWxkSWR9L2NoYW5uZWxzLyR7Y2hhbm5lbElkfS9waW5zYCk7XHJcbiAgfVxyXG5cclxuICAvLyA9PT09PT09PT09PT09PT09PT09PSBVc2VycyA9PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSB1c2VyXHJcbiAgICovXHJcbiAgYXN5bmMgZ2V0VXNlcih1c2VySWQ6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KCdHRVQnLCBgL2JvdC91c2Vycy8ke3VzZXJJZH1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBjdXJyZW50IGJvdCB1c2VyXHJcbiAgICovXHJcbiAgYXN5bmMgZ2V0Q3VycmVudFVzZXIoKTogUHJvbWlzZTxhbnk+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoJ0dFVCcsIGAvYm90L3VzZXJzL0BtZWApO1xyXG4gIH1cclxuXHJcbiAgLy8gPT09PT09PT09PT09PT09PT09PT0gSW52aXRlcyA9PT09PT09PT09PT09PT09PT09PVxyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgYW4gaW52aXRlXHJcbiAgICovXHJcbiAgYXN5bmMgY3JlYXRlSW52aXRlKGd1aWxkSWQ6IHN0cmluZywgY2hhbm5lbElkOiBzdHJpbmcsIGRhdGE/OiB7XHJcbiAgICBtYXhfYWdlPzogbnVtYmVyO1xyXG4gICAgbWF4X3VzZXM/OiBudW1iZXI7XHJcbiAgICB0ZW1wb3Jhcnk/OiBib29sZWFuO1xyXG4gICAgdW5pcXVlPzogYm9vbGVhbjtcclxuICB9KTogUHJvbWlzZTxhbnk+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoJ1BPU1QnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH0vaW52aXRlc2AsIGRhdGEgfHwge30pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVsZXRlIGFuIGludml0ZVxyXG4gICAqL1xyXG4gIGFzeW5jIGRlbGV0ZUludml0ZShpbnZpdGVDb2RlOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGF3YWl0IHRoaXMucmVxdWVzdCgnREVMRVRFJywgYC9ib3QvaW52aXRlcy8ke2ludml0ZUNvZGV9YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYW4gaW52aXRlXHJcbiAgICovXHJcbiAgYXN5bmMgZ2V0SW52aXRlKGludml0ZUNvZGU6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KCdHRVQnLCBgL2JvdC9pbnZpdGVzLyR7aW52aXRlQ29kZX1gKTtcclxuICB9XHJcblxyXG4gIC8vID09PT09PT09PT09PT09PT09PT09IFdlYmhvb2tzID09PT09PT09PT09PT09PT09PT09XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBjaGFubmVsIHdlYmhvb2tzXHJcbiAgICovXHJcbiAgYXN5bmMgZ2V0Q2hhbm5lbFdlYmhvb2tzKGd1aWxkSWQ6IHN0cmluZywgY2hhbm5lbElkOiBzdHJpbmcpOiBQcm9taXNlPGFueVtdPiB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KCdHRVQnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH0vd2ViaG9va3NgKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIHdlYmhvb2tcclxuICAgKi9cclxuICBhc3luYyBjcmVhdGVXZWJob29rKGd1aWxkSWQ6IHN0cmluZywgY2hhbm5lbElkOiBzdHJpbmcsIGRhdGE6IHtcclxuICAgIG5hbWU6IHN0cmluZztcclxuICAgIGF2YXRhcj86IHN0cmluZztcclxuICB9KTogUHJvbWlzZTxhbnk+IHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QoJ1BPU1QnLCBgL2JvdC9ndWlsZHMvJHtndWlsZElkfS9jaGFubmVscy8ke2NoYW5uZWxJZH0vd2ViaG9va3NgLCBkYXRhKTtcclxuICB9XHJcbn1cclxuIl19