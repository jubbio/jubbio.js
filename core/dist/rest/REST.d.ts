import { APIMessage, APIApplicationCommand, APIEmbed } from '../types';
/**
 * Mention data structure for our system
 */
export interface MentionUser {
    id: number;
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
    id: number;
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
    getCachedUser(userId: number): CachedUser | undefined;
    /**
     * Format a user mention
     * Returns both the text format and mentions data
     *
     * @example
     * const mention = rest.formatMention(user);
     * // mention.text = "@ilkay"
     * // mention.data = { users: [{ id: 1, username: "ilkay" }] }
     */
    formatMention(user: {
        id: string | number;
        username: string;
    }): {
        text: string;
        data: MentionsData;
    };
    /**
     * Parse mentions (<@ID>) and convert to our format (@username)
     * Also builds the mentions data structure
     *
     * @param content - Message content with mentions
     * @param existingMentions - Existing mentions data to merge with
     * @returns Processed content and mentions data
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
     * Make an authenticated request
     */
    private request;
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
    }): Promise<{
        id: string;
        ephemeral: boolean;
        flags: number;
    }>;
    /**
     * Create a DM message
     */
    createDMMessage(channelId: string, data: {
        content?: string;
        embeds?: APIEmbed[];
    }): Promise<APIMessage>;
    /**
     * Edit a message
     * Automatically processes mentions
     */
    editMessage(guildId: string, channelId: string, messageId: string, data: {
        content?: string;
        embeds?: APIEmbed[];
        mentions?: MentionsData;
    }): Promise<APIMessage>;
    /**
     * Delete a message
     */
    deleteMessage(guildId: string, channelId: string, messageId: string): Promise<void>;
    /**
     * Add a reaction to a message
     */
    addReaction(guildId: string, channelId: string, messageId: string, emoji: string): Promise<void>;
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
     */
    createMessageWithFile(guildId: string, channelId: string, data: {
        content?: string;
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
     */
    createFollowup(token: string, data: {
        content?: string;
        embeds?: APIEmbed[];
        mentions?: MentionsData;
        flags?: number;
    }): Promise<void>;
    /**
     * Register global application commands
     */
    registerGlobalCommands(commands: APIApplicationCommand[]): Promise<void>;
    /**
     * Register guild-specific commands
     */
    registerGuildCommands(guildId: string, commands: APIApplicationCommand[]): Promise<void>;
    /**
     * Delete a global command
     */
    deleteGlobalCommand(commandId: string): Promise<void>;
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
     * Create a channel in a guild
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
    }): Promise<{
        id: string;
        name: string;
    }>;
    /**
     * Delete a channel
     */
    /**
     * Delete a channel
     */
    deleteChannel(guildId: string, channelId: string): Promise<void>;
    /**
     * Edit channel permission overwrites
     */
    editChannelPermissions(channelId: string, overwriteId: string, data: {
        type: number;
        allow?: string;
        deny?: string;
    }): Promise<void>;
    /**
     * Delete channel permission overwrite
     */
    deleteChannelPermission(channelId: string, overwriteId: string): Promise<void>;
    /**
     * Get messages from a channel
     */
    getMessages(guildId: string, channelId: string, options?: {
        limit?: number;
        before?: string;
        after?: string;
    }): Promise<APIMessage[]>;
    /**
     * Get a guild member
     */
    getMember(guildId: string, userId: string): Promise<any>;
    /**
     * Timeout a guild member
     */
    timeoutMember(guildId: string, userId: string, duration: number | null, reason?: string): Promise<void>;
    /**
     * Kick a guild member
     */
    kickMember(guildId: string, userId: string, reason?: string): Promise<void>;
    /**
     * Ban a guild member
     */
    banMember(guildId: string, userId: string, options?: {
        deleteMessageDays?: number;
        deleteMessageSeconds?: number;
        reason?: string;
    }): Promise<void>;
    /**
     * Unban a user
     */
    unbanMember(guildId: string, userId: string, reason?: string): Promise<void>;
    /**
     * Edit a guild member
     */
    editMember(guildId: string, userId: string, data: {
        nick?: string | null;
        roles?: string[];
        mute?: boolean;
        deaf?: boolean;
        channel_id?: string | null;
        communication_disabled_until?: string | null;
        reason?: string;
    }): Promise<any>;
    /**
     * Add a role to a member
     */
    addMemberRole(guildId: string, userId: string, roleId: string, reason?: string): Promise<void>;
    /**
     * Remove a role from a member
     */
    removeMemberRole(guildId: string, userId: string, roleId: string, reason?: string): Promise<void>;
    /**
     * Bulk delete messages
     */
    bulkDeleteMessages(guildId: string, channelId: string, messageIds: string[]): Promise<void>;
    /**
     * Get a guild
     */
    getGuild(guildId: string): Promise<any>;
    /**
     * Get guild channels
     */
    getGuildChannels(guildId: string): Promise<any[]>;
    /**
     * Get guild roles
     */
    getRoles(guildId: string): Promise<any[]>;
    /**
     * Create a role
     */
    createRole(guildId: string, data: {
        name?: string;
        color?: number;
        hoist?: boolean;
        mentionable?: boolean;
        permissions?: string;
    }): Promise<any>;
    /**
     * Edit a role
     */
    editRole(guildId: string, roleId: string, data: {
        name?: string;
        color?: number;
        hoist?: boolean;
        mentionable?: boolean;
        permissions?: string;
    }): Promise<any>;
    /**
     * Delete a role
     */
    deleteRole(guildId: string, roleId: string): Promise<void>;
    /**
     * Get guild emojis
     */
    getEmojis(guildId: string): Promise<any[]>;
    /**
     * Get guild bans
     */
    getBans(guildId: string): Promise<any[]>;
    /**
     * Get a specific ban
     */
    getBan(guildId: string, userId: string): Promise<any>;
    /**
     * Get guild invites
     */
    getGuildInvites(guildId: string): Promise<any[]>;
    /**
     * Create a thread from a message
     */
    createThreadFromMessage(guildId: string, channelId: string, messageId: string, data: {
        name: string;
        auto_archive_duration?: number;
    }): Promise<any>;
    /**
     * Create a thread without a message
     */
    createThread(guildId: string, channelId: string, data: {
        name: string;
        type?: number;
        auto_archive_duration?: number;
        invitable?: boolean;
    }): Promise<any>;
    /**
     * Join a thread
     */
    joinThread(channelId: string): Promise<void>;
    /**
     * Leave a thread
     */
    leaveThread(channelId: string): Promise<void>;
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
     * Get a user
     */
    getUser(userId: string): Promise<any>;
    /**
     * Get current bot user
     */
    getCurrentUser(): Promise<any>;
    /**
     * Create an invite
     */
    createInvite(guildId: string, channelId: string, data?: {
        max_age?: number;
        max_uses?: number;
        temporary?: boolean;
        unique?: boolean;
    }): Promise<any>;
    /**
     * Delete an invite
     */
    deleteInvite(inviteCode: string): Promise<void>;
    /**
     * Get an invite
     */
    getInvite(inviteCode: string): Promise<any>;
    /**
     * Get channel webhooks
     */
    getChannelWebhooks(guildId: string, channelId: string): Promise<any[]>;
    /**
     * Create a webhook
     */
    createWebhook(guildId: string, channelId: string, data: {
        name: string;
        avatar?: string;
    }): Promise<any>;
}
export {};
