import { APIMessage, APIApplicationCommand, APIEmbed, APIGuildData, APIMemberData, APIMembersResponse, APIRoleData, APIBan, APIInvite, APIEmoji, APIWebhook, APIUser, APIChannel, APIAuditLog } from '../types';
/**
 * Mention data structure for our system
 */
export interface MentionUser {
    id: string;
    username: string;
}
export interface MentionRole {
    id: string;
    name?: string;
}
export interface MentionsData {
    users?: MentionUser[];
    roles?: MentionRole[];
    everyone?: boolean;
}
/**
 * User cache entry
 */
interface CachedUser {
    id: string;
    username: string;
    displayName?: string;
    cachedAt: number;
}
/**
 * REST API client for Jubbio
 */
export declare class REST {
    private baseUrl;
    private token;
    private userCache;
    private readonly USER_CACHE_TTL;
    constructor(baseUrl?: string);
    /**
     * Redact sensitive data from objects/strings for safe logging.
     * Masks fields named 'token', 'authorization', 'password', 'secret', 'api_key' with '[REDACTED]'
     */
    private redactSensitiveData;
    /**
     * Cache a user for mention resolution
     * Bot'lar interaction'dan gelen user bilgisini cache'leyebilir
     */
    cacheUser(user: {
        id: string | number;
        username: string;
        displayName?: string;
        display_name?: string;
    }): void;
    /**
     * Cache multiple users
     */
    cacheUsers(users: Array<{
        id: string | number;
        username: string;
        displayName?: string;
        display_name?: string;
    }>): void;
    /**
     * Get cached user by ID
     */
    getCachedUser(userId: string): CachedUser | undefined;
    /**
     * Format a user mention
     * Returns both the text format and mentions data
     *
     * @example
     * const mention = rest.formatMention(user);
     * // mention.text = "<@1>"
     * // mention.data = { users: [{ id: "1", username: "ilkay" }] }
     */
    formatMention(user: {
        id: string | number;
        username: string;
    }): {
        text: string;
        data: MentionsData;
    };
    /**
     * Parse mentions (<@ID>) in content and build mentions data structure
     * Content is kept as-is with <@ID> format (client renders them)
     *
     * @param content - Message content with mentions
     * @param existingMentions - Existing mentions data to merge with
     * @returns Original content and mentions data
     */
    private processMentions;
    /**
     * Prepare message data with processed mentions
     * Automatically converts mentions to our format
     */
    private prepareMessageData;
    /**
     * Set the bot token
     */
    setToken(token: string): this;
    /**
     * Make an authenticated request with rate limit retry
     */
    private request;
    /**
     * Create a message in a channel
     * Mentions use <@ID> format and are kept as-is (client renders them)
     *
     * @example
     * await rest.createMessage(guildId, channelId, {
     *   content: 'Hello <@123>!',
     * });
     */
    createMessage(guildIdOrChannelId: string, channelIdOrData: string | {
        content?: string;
        embeds?: APIEmbed[];
        components?: any[];
        mentions?: MentionsData;
        files?: Array<{
            name: string;
            data: Buffer;
        }>;
        message_reference?: {
            message_id: string;
        };
        interactionId?: string;
        flags?: number;
    }, data?: {
        content?: string;
        embeds?: APIEmbed[];
        components?: any[];
        mentions?: MentionsData;
        files?: Array<{
            name: string;
            data: Buffer;
        }>;
        message_reference?: {
            message_id: string;
        };
        interactionId?: string;
        flags?: number;
    }): Promise<APIMessage>;
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
    createEphemeralMessage(guildId: string, channelId: string, targetUserId: string | number, data: {
        content?: string;
        embeds?: APIEmbed[];
        components?: any[];
    }): Promise<{
        id: string;
        ephemeral: boolean;
        flags: number;
    }>;
    /**
     * Create a DM message to a user
     * Automatically processes embeds (converts EmbedBuilder to JSON, normalizes colors, timestamps, etc.)
     *
     * @param userId - The user ID to send the DM to
     * @param data - Message data (content and/or embeds and/or components)
     */
    createDMMessage(userId: string, data: {
        content?: string;
        embeds?: APIEmbed[];
        components?: any[];
    }): Promise<APIMessage>;
    /**
     * Create a DM message to an existing DM channel
     * Use this when you already have a channel ID
     */
    createDMMessageToChannel(channelId: string, data: {
        content?: string;
        embeds?: APIEmbed[];
        components?: any[];
    }): Promise<APIMessage>;
    /**
     * Create a DM message with file attachment
     * ponytail: DM için file + embed desteği
     */
    createDMMessageWithFile(userId: string, data: {
        content?: string;
        embeds?: APIEmbed[];
        components?: any[];
    }, files: Array<{
        name: string;
        data: Buffer | string;
        contentType?: string;
    }>): Promise<APIMessage>;
    /**
     * Edit a message
     * Automatically processes mentions
     */
    editMessage(guildId: string, channelId: string, messageId: string, data: {
        content?: string;
        embeds?: APIEmbed[];
        components?: any[];
        mentions?: MentionsData;
    }): Promise<APIMessage>;
    /**
     * Delete a message
     */
    deleteMessage(guildId: string, channelId: string, messageId: string): Promise<void>;
    /**
     * Validate and normalize emoji format for the API.
     * Converts unicode emoji to shortcode format.
     * Accepted formats:
     * - Unicode emoji characters (👍, ❤️, etc.) → converted to :shortcode:
     * - :name: format (shortcode)
     * - <:name:id> or <a:name:id> for custom emoji
     */
    private validateEmoji;
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
    addReaction(guildId: string, channelId: string, messageId: string, emoji: string): Promise<void>;
    /**
     * Remove a reaction from a message
     * @param emoji - Unicode emoji (👍), :name:, <:name:id>, or <a:name:id> format
     */
    removeReaction(guildId: string, channelId: string, messageId: string, emoji: string): Promise<void>;
    /**
     * Upload an attachment to a channel
     */
    uploadAttachment(guildId: string, channelId: string, file: {
        name: string;
        data: Buffer;
        contentType?: string;
    }): Promise<{
        id: string;
        url: string;
        filename: string;
    }>;
    /**
     * Create a message with a file attachment
     * ponytail: embeds ve components desteği eklendi
     */
    createMessageWithFile(guildId: string, channelId: string, data: {
        content?: string;
        embeds?: APIEmbed[];
        components?: any[];
        file: {
            name: string;
            data: Buffer;
            contentType?: string;
        };
        interactionId?: string;
    }): Promise<APIMessage>;
    /**
     * Create an interaction response
     * Automatically processes mentions in content and embeds
     */
    createInteractionResponse(interactionId: string, token: string, data: {
        type: number;
        data?: any;
    }): Promise<void>;
    /**
     * Edit the original interaction response
     * If files are provided, creates a new message with files (since webhook edit doesn't support file upload)
     * Automatically processes mentions
     */
    editInteractionResponse(token: string, data: {
        content?: string;
        embeds?: APIEmbed[];
        components?: any[];
        mentions?: MentionsData;
        files?: Array<{
            name: string;
            data: Buffer;
            contentType?: string;
        }>;
    }, guildId?: string, channelId?: string, interactionId?: string): Promise<void>;
    /**
     * Delete the original interaction response
     */
    deleteInteractionResponse(token: string): Promise<void>;
    /**
     * Create a followup message
     * Automatically processes mentions
     * Supports file attachments via multipart/form-data
     */
    createFollowup(token: string, data: {
        content?: string;
        embeds?: APIEmbed[];
        components?: any[];
        mentions?: MentionsData;
        flags?: number;
        files?: Array<{
            name: string;
            data: Buffer;
            contentType?: string;
        }>;
    }): Promise<void>;
    /**
     * Register global application commands
     */
    registerGlobalCommands(commands: APIApplicationCommand[]): Promise<void>;
    /**
     * Bulk overwrite all global application commands (replaces all existing)
     */
    bulkOverwriteGlobalCommands(commands: APIApplicationCommand[]): Promise<APIApplicationCommand[]>;
    /**
     * Register guild-specific commands
     */
    registerGuildCommands(guildId: string, commands: APIApplicationCommand[]): Promise<void>;
    /**
     * Bulk overwrite all guild-specific commands (replaces all existing)
     */
    bulkOverwriteGuildCommands(guildId: string, commands: APIApplicationCommand[]): Promise<APIApplicationCommand[]>;
    /**
     * Delete a global command
     */
    deleteGlobalCommand(commandId: string): Promise<void>;
    /**
     * Delete a guild-specific command
     */
    deleteGuildCommand(guildId: string, commandId: string): Promise<void>;
    /**
     * List all global commands for this application
     */
    listGlobalCommands(): Promise<APIApplicationCommand[]>;
    /**
     * List all guild-specific commands for this application
     */
    listGuildCommands(guildId: string): Promise<APIApplicationCommand[]>;
    /**
     * Get a specific global command
     */
    getGlobalCommand(commandId: string): Promise<APIApplicationCommand>;
    /**
     * Get a specific guild command
     */
    getGuildCommand(guildId: string, commandId: string): Promise<APIApplicationCommand>;
    /**
     * Update a global command
     */
    updateGlobalCommand(commandId: string, data: Partial<APIApplicationCommand>): Promise<APIApplicationCommand>;
    /**
     * Update a guild-specific command
     */
    updateGuildCommand(guildId: string, commandId: string, data: Partial<APIApplicationCommand>): Promise<APIApplicationCommand>;
    private applicationId;
    /**
     * Set the application ID
     */
    setApplicationId(id: string): void;
    /**
     * Get the application ID
     */
    private getApplicationId;
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
    createChannel(guildId: string, data: {
        name: string;
        type?: number;
        parent_id?: string | null;
        category_id?: string | null;
        permission_overwrites?: Array<{
            id: string;
            type: number;
            allow?: string;
            deny?: string;
        }>;
    }): Promise<APIChannel>;
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
    deleteChannel(guildId: string, channelId: string): Promise<void>;
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
    editChannel(guildId: string, channelId: string, data: {
        name?: string;
        topic?: string;
        position?: number;
        slowmode_seconds?: number;
        nsfw?: boolean;
        parent_id?: string | null;
        permission_overwrites?: Array<{
            id: string;
            type: number;
            allow?: string;
            deny?: string;
        }>;
    }): Promise<APIChannel>;
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
    deleteCategory(guildId: string, categoryId: string): Promise<void>;
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
    editChannelPermissions(channelId: string, overwriteId: string, data: {
        type: number;
        allow?: string;
        deny?: string;
    }): Promise<void>;
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
    deleteChannelPermission(channelId: string, overwriteId: string): Promise<void>;
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
    getMessages(guildId: string, channelId: string, options?: {
        limit?: number;
        before?: string;
        after?: string;
    }): Promise<APIMessage[]>;
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
    getMessagesIterator(guildId: string, channelId: string, options?: {
        limit?: number;
        batchSize?: number;
    }): AsyncGenerator<APIMessage[], void, unknown>;
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
    getMember(guildId: string, userId: string): Promise<APIMemberData>;
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
    getMembers(guildId: string, options?: {
        limit?: number;
        cursor?: string;
    }): Promise<APIMembersResponse>;
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
    getMembersIterator(guildId: string, options?: {
        limit?: number;
        batchSize?: number;
    }): AsyncGenerator<APIMemberData[], void, unknown>;
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
    timeoutMember(guildId: string, userId: string, duration: number | null, reason?: string): Promise<void>;
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
    kickMember(guildId: string, userId: string, reason?: string): Promise<void>;
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
    banMember(guildId: string, userId: string, options?: {
        deleteMessageDays?: number;
        deleteMessageSeconds?: number;
        reason?: string;
    }): Promise<void>;
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
    unbanMember(guildId: string, userId: string, reason?: string): Promise<void>;
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
    editMember(guildId: string, userId: string, data: {
        nick?: string | null;
        roles?: string[];
        mute?: boolean;
        deaf?: boolean;
        channel_id?: string | null;
        communication_disabled_until?: string | null;
        reason?: string;
    }): Promise<APIMemberData>;
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
    getGuild(guildId: string): Promise<APIGuildData>;
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
    addMemberRole(guildId: string, userId: string, roleId: string, reason?: string): Promise<void>;
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
    removeMemberRole(guildId: string, userId: string, roleId: string, reason?: string): Promise<void>;
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
    bulkAssignRoles(guildId: string, assignments: {
        user_id: string;
        role_ids: string[];
    }[]): Promise<any>;
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
    bulkRemoveRoles(guildId: string, removals: {
        user_id: string;
        role_ids: string[];
    }[]): Promise<any>;
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
    bulkDeleteMessages(guildId: string, channelId: string, messageIds: string[]): Promise<void>;
    /**
     * Get a guild
     */
    getGuildChannels(guildId: string): Promise<APIChannel[]>;
    /**
     * Get guild roles
     */
    getRoles(guildId: string): Promise<APIRoleData[]>;
    /**
     * Create a role
     */
    createRole(guildId: string, data: {
        name?: string;
        color?: number;
        hoist?: boolean;
        mentionable?: boolean;
        permissions?: string;
    }): Promise<APIRoleData>;
    /**
     * Edit a role
     */
    editRole(guildId: string, roleId: string, data: {
        name?: string;
        color?: number;
        hoist?: boolean;
        mentionable?: boolean;
        permissions?: string;
    }): Promise<APIRoleData>;
    /**
     * Delete a role
     */
    deleteRole(guildId: string, roleId: string): Promise<void>;
    /**
     * Get guild emojis
     *
     * @param guildId - The ID of the guild
     * @returns Array of emoji objects
     */
    getEmojis(guildId: string): Promise<APIEmoji[]>;
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
    getBans(guildId: string): Promise<APIBan[]>;
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
    getBan(guildId: string, userId: string): Promise<APIBan>;
    /**
     * Get guild invites
     *
     * @param guildId - The ID of the guild
     * @returns Array of invite objects
     */
    getGuildInvites(guildId: string): Promise<APIInvite[]>;
    /**
     * Pin a message
     */
    pinMessage(guildId: string, channelId: string, messageId: string): Promise<void>;
    /**
     * Unpin a message
     */
    unpinMessage(guildId: string, channelId: string, messageId: string): Promise<void>;
    /**
     * Get pinned messages
     */
    getPinnedMessages(guildId: string, channelId: string): Promise<APIMessage[]>;
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
    getAuditLog(guildId: string, options?: {
        user_id?: string;
        action_type?: number;
        before?: string;
        limit?: number;
    }): Promise<APIAuditLog>;
    /**
     * Get a user
     */
    getUser(userId: string): Promise<APIUser>;
    /**
     * Get current bot user
     */
    getCurrentUser(): Promise<APIUser>;
    /**
     * Create an invite
     */
    createInvite(guildId: string, channelId: string, data?: {
        max_age?: number;
        max_uses?: number;
        temporary?: boolean;
        unique?: boolean;
    }): Promise<APIInvite>;
    /**
     * Delete an invite
     */
    deleteInvite(inviteCode: string): Promise<void>;
    /**
     * Get an invite
     */
    getInvite(inviteCode: string): Promise<APIInvite>;
    /**
     * Get channel webhooks
     */
    getChannelWebhooks(guildId: string, channelId: string): Promise<APIWebhook[]>;
    /**
     * Get guild webhooks
     */
    getGuildWebhooks(guildId: string): Promise<APIWebhook[]>;
    /**
     * Create a webhook
     */
    createWebhook(guildId: string, channelId: string, data: {
        name: string;
        avatar?: string;
    }): Promise<APIWebhook>;
    /**
     * Update a webhook
     */
    updateWebhook(guildId: string, webhookId: string, data: {
        name?: string;
        avatar_url?: string;
    }): Promise<APIWebhook>;
    /**
     * Delete a webhook
     */
    deleteWebhook(guildId: string, webhookId: string): Promise<void>;
    /**
     * Make a GET request to any API path
     * @example await client.rest.get('/bot/guilds/123/channels');
     */
    get<T = any>(path: string): Promise<T>;
    /**
     * Make a POST request to any API path
     * @example await client.rest.post('/bot/guilds/123/channels', { name: 'new-channel', type: 2 });
     */
    post<T = any>(path: string, body?: any): Promise<T>;
    /**
     * Make a PATCH request to any API path
     * @example await client.rest.patch('/bot/guilds/123/channels/456', { name: 'renamed' });
     */
    patch<T = any>(path: string, body?: any): Promise<T>;
    /**
     * Make a PUT request to any API path
     * @example await client.rest.put('/bot/channels/456/permissions/789', { type: 0, allow: '1024' });
     */
    put<T = any>(path: string, body?: any): Promise<T>;
    /**
     * Make a DELETE request to any API path
     * @example await client.rest.delete('/bot/guilds/123/channels/456');
     */
    delete<T = any>(path: string): Promise<T>;
}
export {};
