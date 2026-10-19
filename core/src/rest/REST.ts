import { 
  APIMessage, 
  APIApplicationCommand, 
  APIEmbed,
  APIGuildData,
  APIMemberData,
  APIMembersResponse,
  APIRoleData,
  APIBan,
  APIInvite,
  APIEmoji,
  APIWebhook,
  APIUser,
  APIChannel,
  AnyActionRow,
  APIAuditLog
} from '../types';
import { serializeComponents, normalizeEmbed } from '../utils/serialize';
import { RESTError, RateLimitError } from './errors';

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
 * Sensitive field names that should be redacted in logs
 */
const SENSITIVE_FIELDS = ['token', 'authorization', 'password', 'secret', 'api_key', 'apikey', 'api-key'];

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
function validateId(id: string, fieldName: string): void {
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
export class REST {
  private baseUrl: string;
  private token: string = '';
  
  // User cache for mention resolution (ID -> username)
  private userCache: Map<string, CachedUser> = new Map();
  private readonly USER_CACHE_TTL = 5 * 60 * 1000; // 5 dakika

  constructor(baseUrl: string = 'https://gateway.jubbio.com/api/v1') {
    this.baseUrl = baseUrl;
  }

  /**
   * Redact sensitive data from objects/strings for safe logging.
   * Masks fields named 'token', 'authorization', 'password', 'secret', 'api_key' with '[REDACTED]'
   */
  private redactSensitiveData(data: unknown): unknown {
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
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        const keyLower = key.toLowerCase();
        if (SENSITIVE_FIELDS.some(field => keyLower.includes(field))) {
          result[key] = '[REDACTED]';
        } else {
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
  cacheUser(user: { id: string | number; username: string; displayName?: string; display_name?: string }): void {
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
  cacheUsers(users: Array<{ id: string | number; username: string; displayName?: string; display_name?: string }>): void {
    users.forEach(user => this.cacheUser(user));
  }

  /**
   * Get cached user by ID
   */
  getCachedUser(userId: string): CachedUser | undefined {
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
  formatMention(user: { id: string | number; username: string }): { text: string; data: MentionsData } {
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
  private processMentions(content: string | number | unknown, existingMentions?: MentionsData): { content: string; mentions: MentionsData } {
    // ponytail: Bug #5 fix - number veya diğer tipler string'e çevrilir
    const contentStr = String(content ?? '');
    
    const mentions: MentionsData = {
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
        mentions.users!.push({ id: userId, username: cachedUser?.username || `User_${userId}` });
        addedUserIds.add(userId);
      }
    }

    // Parse <@&ID> format (role mentions) — keep content as-is
    const roleMentionRegex = /<@&(\d+)>/g;
    const addedRoleIds = new Set(mentions.roles?.map(r => r.id) || []);

    while ((match = roleMentionRegex.exec(contentStr)) !== null) {
      const roleId = match[1];
      if (!addedRoleIds.has(roleId)) {
        mentions.roles!.push({ id: roleId });
        addedRoleIds.add(roleId);
      }
    }

    // Parse @everyone and @here
    if (contentStr.includes('@everyone')) {
      mentions.everyone = true;
    }

    // Clean up empty arrays
    if (mentions.users?.length === 0) delete mentions.users;
    if (mentions.roles?.length === 0) delete mentions.roles;

    return { content: contentStr, mentions };
  }

  /**
   * Prepare message data with processed mentions
   * Automatically converts mentions to our format
   */
  private prepareMessageData(data: {
    content?: string;
    embeds?: APIEmbed[];
    components?: AnyActionRow[] | unknown[];
    mentions?: MentionsData;
    message_reference?: { message_id: string };
  }): { 
    content?: string; 
    embeds?: APIEmbed[]; 
    components?: unknown[]; 
    mentions?: MentionsData;
    message_reference?: { message_id: string };
  } {
    const result: { 
      content?: string; 
      embeds?: APIEmbed[]; 
      components?: unknown[]; 
      mentions?: MentionsData;
      message_reference?: { message_id: string };
    } = { ...data };

    // Resolve components (ActionRowBuilder / ButtonBuilder instances)
    if (data.components && data.components.length > 0) {
      result.components = serializeComponents(data.components as unknown[]);
    }

    let allMentions: MentionsData = { ...data.mentions };

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
        const processedEmbed = normalizeEmbed(embed) as APIEmbed & Record<string, unknown>;

        // Get the raw embed for mention processing
        const rawEmbed = typeof (embed as { toJSON?: () => APIEmbed }).toJSON === 'function' 
          ? (embed as { toJSON: () => APIEmbed }).toJSON() 
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
          processedEmbed.fields = rawEmbed.fields.map((field: { name: string; value: string; inline?: boolean }) => {
            const processedField: { name: string; value: string; inline?: boolean } = { ...field };
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
  setToken(token: string): this {
    this.token = token;
    return this;
  }

  /**
   * Make an authenticated request with rate limit retry
   */
  private async request<T>(method: string, path: string, body?: any, retries = 3): Promise<T> {
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
      const errorData = await response.json().catch(() => ({})) as { retry_after?: number };
      const retryAfter = (errorData.retry_after || 1) * 1000; // Convert to ms
      
      if (retries > 0) {
        if (process.env.DEBUG_REST) {
          console.log(`[REST] Rate limited, retrying in ${retryAfter}ms (${retries} retries left)`);
        }
        await new Promise(resolve => setTimeout(resolve, retryAfter));
        return this.request<T>(method, path, body, retries - 1);
      }
      
      // No retries left, throw RateLimitError
      throw new RateLimitError(retryAfter, method, path);
    }

    if (!response.ok) {
      const error = await response.text();
      throw new RESTError(response.status, method, path, error);
    }

    // Handle empty responses
    const text = await response.text();
    if (!text) return {} as T;
    
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
  async createMessage(guildIdOrChannelId: string, channelIdOrData: string | {
    content?: string;
    embeds?: APIEmbed[];
    components?: any[];
    mentions?: MentionsData;
    files?: Array<{ name: string; data: Buffer }>;
    message_reference?: { message_id: string };
    interactionId?: string;
    flags?: number;  // ponytail: Bug #10 - flags desteği (MessageFlags.SuppressEmbeds vb.)
  }, data?: {
    content?: string;
    embeds?: APIEmbed[];
    components?: any[];
    mentions?: MentionsData;
    files?: Array<{ name: string; data: Buffer }>;
    message_reference?: { message_id: string };
    interactionId?: string;
    flags?: number;  // ponytail: Bug #10 - flags desteği
  }): Promise<APIMessage> {
    // İki kullanım şekli:
    // 1. createMessage(guildId, channelId, data) - guildId ile (tercih edilen)
    // 2. createMessage(channelId, data) - guildId olmadan (eski format, hata verir)
    
    let guildId: string;
    let channelId: string;
    let messageData: any;
    
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
      
      // ponytail: Bug #10 - Add flags if provided
      if (data.flags !== undefined) {
        messageData.flags = data.flags;
      }
    } else if (typeof channelIdOrData === 'object') {
      // Eski format: createMessage(channelId, data) - guildId yok
      // Bu format artık desteklenmiyor, hata fırlat
      throw new Error('createMessage requires guildId: createMessage(guildId, channelId, data)');
    } else {
      throw new Error('Invalid createMessage arguments');
    }
    
    return this.request<APIMessage>('POST', `/bot/guilds/${guildId}/channels/${channelId}/messages`, messageData);
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
  async createEphemeralMessage(guildId: string, channelId: string, targetUserId: string | number, data: {
    content?: string;
    embeds?: APIEmbed[];
    components?: any[];
  }): Promise<{ id: string; ephemeral: boolean; flags: number }> {
    // SECURITY: Validate IDs to prevent path traversal
    validateId(guildId, 'guildId');
    validateId(channelId, 'channelId');
    validateId(String(targetUserId), 'targetUserId');
    
    const messageData = this.prepareMessageData(data);
    
    return this.request<{ id: string; ephemeral: boolean; flags: number }>('POST', `/bot/guilds/${guildId}/channels/${channelId}/messages`, {
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
  async createDMMessage(userId: string, data: {
    content?: string;
    embeds?: APIEmbed[];
    components?: any[];
  }): Promise<APIMessage> {
    const processedData = this.prepareMessageData(data);
    // Send to /bot/dm with recipient_user_id in body
    return this.request<APIMessage>('POST', `/bot/dm`, {
      ...processedData,
      recipient_user_id: userId
    });
  }

  /**
   * Create a DM message to an existing DM channel
   * Use this when you already have a channel ID
   */
  async createDMMessageToChannel(channelId: string, data: {
    content?: string;
    embeds?: APIEmbed[];
    components?: any[];
  }): Promise<APIMessage> {
    const processedData = this.prepareMessageData(data);
    return this.request<APIMessage>('POST', `/bot/dm/${channelId}`, processedData);
  }

  /**
   * Create a DM message with file attachment
   * ponytail: DM için file + embed desteği
   */
  async createDMMessageWithFile(userId: string, data: {
    content?: string;
    embeds?: APIEmbed[];
    components?: any[];
  }, files: Array<{ name: string; data: Buffer | string; contentType?: string }>): Promise<APIMessage> {
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
      const processedEmbeds = data.embeds.map(embed => normalizeEmbed(embed));
      form.append('embeds', JSON.stringify(processedEmbeds));
    }

    // Add components if provided (JSON stringified)
    if (data.components && data.components.length > 0) {
      const processedComponents = serializeComponents(data.components);
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

    return response.json() as Promise<APIMessage>;
  }

  /**
   * Edit a message
   * Automatically processes mentions
   */
  async editMessage(guildId: string, channelId: string, messageId: string, data: {
    content?: string;
    embeds?: APIEmbed[];
    components?: any[];
    mentions?: MentionsData;
  }): Promise<APIMessage> {
    // SECURITY: Validate IDs to prevent path traversal
    validateId(guildId, 'guildId');
    validateId(channelId, 'channelId');
    validateId(messageId, 'messageId');
    
    const path = `/bot/guilds/${guildId}/channels/${channelId}/messages/${messageId}`;
    const processedData = this.prepareMessageData(data);
    return this.request<APIMessage>('PATCH', path, processedData);
  }

  /**
   * Delete a message
   */
  async deleteMessage(guildId: string, channelId: string, messageId: string): Promise<void> {
    // SECURITY: Validate IDs to prevent path traversal
    validateId(guildId, 'guildId');
    validateId(channelId, 'channelId');
    validateId(messageId, 'messageId');
    
    const path = `/bot/guilds/${guildId}/channels/${channelId}/messages/${messageId}`;
    await this.request<void>('DELETE', path);
  }

  /**
   * Validate and normalize emoji format for the API.
   * Converts unicode emoji to shortcode format.
   * Accepted formats: 
   * - Unicode emoji characters (👍, ❤️, etc.) → converted to :shortcode:
   * - :name: format (shortcode)
   * - <:name:id> or <a:name:id> for custom emoji
   */
  private validateEmoji(emoji: string): string {
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
  async addReaction(guildId: string, channelId: string, messageId: string, emoji: string): Promise<void> {
    // SECURITY: Validate IDs to prevent path traversal
    validateId(guildId, 'guildId');
    validateId(channelId, 'channelId');
    validateId(messageId, 'messageId');
    
    const validated = this.validateEmoji(emoji);
    const path = `/bot/guilds/${guildId}/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(validated)}/@me`;
    await this.request<void>('PUT', path);
  }

  /**
   * Remove a reaction from a message
   * @param emoji - Unicode emoji (👍), :name:, <:name:id>, or <a:name:id> format
   */
  async removeReaction(guildId: string, channelId: string, messageId: string, emoji: string): Promise<void> {
    // SECURITY: Validate IDs to prevent path traversal
    validateId(guildId, 'guildId');
    validateId(channelId, 'channelId');
    validateId(messageId, 'messageId');
    
    const validated = this.validateEmoji(emoji);
    const path = `/bot/guilds/${guildId}/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(validated)}/@me`;
    await this.request<void>('DELETE', path);
  }


  /**
   * Upload an attachment to a channel
   */
  async uploadAttachment(guildId: string, channelId: string, file: { name: string; data: Buffer; contentType?: string }): Promise<{ id: string; url: string; filename: string }> {
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
    
    return response.json() as Promise<{ id: string; url: string; filename: string }>;
  }

  /**
   * Create a message with a file attachment
   * ponytail: embeds ve components desteği eklendi
   */
  async createMessageWithFile(guildId: string, channelId: string, data: {
    content?: string;
    embeds?: APIEmbed[];
    components?: any[];
    file: { name: string; data: Buffer; contentType?: string };
    interactionId?: string;
  }): Promise<APIMessage> {
    const FormData = require('form-data');
    const form = new FormData();
    
    // Add content if provided
    if (data.content) {
      form.append('content', data.content);
    }
    
    // Add embeds if provided (JSON stringified)
    if (data.embeds && data.embeds.length > 0) {
      // Process embeds using shared normalizeEmbed
      const processedEmbeds = data.embeds.map(embed => normalizeEmbed(embed));
      if (process.env.DEBUG_REST) {
        console.log(`[REST] createMessageWithFile: appending ${processedEmbeds.length} embeds`);
      }
      form.append('embeds', JSON.stringify(processedEmbeds));
    } else {
      if (process.env.DEBUG_REST) {
        console.log(`[REST] createMessageWithFile: no embeds provided (embeds=${data.embeds})`);
      }
    }
    
    // Add components if provided (JSON stringified)
    if (data.components && data.components.length > 0) {
      const processedComponents = serializeComponents(data.components);
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
    
    return response.json() as Promise<APIMessage>;
  }

  // ==================== Interactions ====================

  /**
   * Create an interaction response
   * Automatically processes mentions in content and embeds
   */
  async createInteractionResponse(interactionId: string, token: string, data: {
    type: number;
    data?: any;
  }): Promise<void> {
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
      
      await this.request<void>('POST', `/interactions/${interactionId}/${token}/callback`, processedData);
      if (process.env.DEBUG_REST) {
        console.log(`✅ Interaction response sent`);
      }
    } catch (error) {
      console.error(`❌ Interaction response error:`, error);
      throw error;
    }
  }

  /**
   * Edit the original interaction response
   * If files are provided, creates a new message with files (since webhook edit doesn't support file upload)
   * Automatically processes mentions
   */
  async editInteractionResponse(token: string, data: {
    content?: string;
    embeds?: APIEmbed[];
    components?: any[];
    mentions?: MentionsData;
    files?: Array<{ name: string; data: Buffer; contentType?: string }>;
  }, guildId?: string, channelId?: string, interactionId?: string): Promise<void> {
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
      
      const payload: any = {
        interaction_id: interactionId
      };
      if (processedData.content !== undefined) payload.content = processedData.content;
      if (processedData.embeds) payload.embeds = processedData.embeds;
      if (processedData.components) payload.components = processedData.components;
      if (processedData.mentions) payload.mentions = processedData.mentions;
      
      await this.request<void>('POST', `/bot/guilds/${guildId}/channels/${channelId}/messages`, payload);
      return;
    }
    
    // Fallback: Regular edit without files (webhook PATCH)
    const payload: any = {};
    if (processedData.content !== undefined) payload.content = processedData.content;
    if (processedData.embeds) payload.embeds = processedData.embeds;
    if (processedData.components) payload.components = processedData.components;
    if (processedData.mentions) payload.mentions = processedData.mentions;
    
    await this.request<void>('PATCH', `/interactions/webhooks/${appId}/${token}/messages/@original`, payload);
  }

  /**
   * Delete the original interaction response
   */
  async deleteInteractionResponse(token: string): Promise<void> {
    const appId = this.getApplicationId();
    await this.request<void>('DELETE', `/interactions/webhooks/${appId}/${token}/messages/@original`);
  }

  /**
   * Create a followup message
   * Automatically processes mentions
   * Supports file attachments via multipart/form-data
   */
  async createFollowup(token: string, data: {
    content?: string;
    embeds?: APIEmbed[];
    components?: any[];
    mentions?: MentionsData;
    flags?: number;
    files?: Array<{ name: string; data: Buffer; contentType?: string }>;
  }): Promise<void> {
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
        const processedEmbeds = data.embeds.map(embed => normalizeEmbed(embed));
        form.append('embeds', JSON.stringify(processedEmbeds));
      }

      // Add components using shared serializeComponents
      if (data.components && data.components.length > 0) {
        const processedComponents = serializeComponents(data.components);
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
    } else {
      // No files, use JSON
      const processedData = this.prepareMessageData(data);
      await this.request<void>('POST', endpoint, processedData);
    }
  }

  // ==================== Commands ====================

  /**
   * Register global application commands
   */
  async registerGlobalCommands(commands: APIApplicationCommand[]): Promise<void> {
    const appId = this.getApplicationId();
    
    for (const command of commands) {
      await this.request<void>('POST', `/applications/${appId}/commands`, command);
    }
  }

  /**
   * Bulk overwrite all global application commands (replaces all existing)
   */
  async bulkOverwriteGlobalCommands(commands: APIApplicationCommand[]): Promise<APIApplicationCommand[]> {
    const appId = this.getApplicationId();
    return this.request<APIApplicationCommand[]>('PUT', `/applications/${appId}/commands`, commands);
  }

  /**
   * Register guild-specific commands
   */
  async registerGuildCommands(guildId: string, commands: APIApplicationCommand[]): Promise<void> {
    const appId = this.getApplicationId();
    
    for (const command of commands) {
      await this.request<void>('POST', `/applications/${appId}/guilds/${guildId}/commands`, command);
    }
  }

  /**
   * Bulk overwrite all guild-specific commands (replaces all existing)
   */
  async bulkOverwriteGuildCommands(guildId: string, commands: APIApplicationCommand[]): Promise<APIApplicationCommand[]> {
    const appId = this.getApplicationId();
    return this.request<APIApplicationCommand[]>('PUT', `/applications/${appId}/guilds/${guildId}/commands`, commands);
  }

  /**
   * Delete a global command
   */
  async deleteGlobalCommand(commandId: string): Promise<void> {
    const appId = this.getApplicationId();
    await this.request<void>('DELETE', `/applications/${appId}/commands/${commandId}`);
  }

  /**
   * Delete a guild-specific command
   */
  async deleteGuildCommand(guildId: string, commandId: string): Promise<void> {
    const appId = this.getApplicationId();
    await this.request<void>('DELETE', `/applications/${appId}/guilds/${guildId}/commands/${commandId}`);
  }

  /**
   * List all global commands for this application
   */
  async listGlobalCommands(): Promise<APIApplicationCommand[]> {
    const appId = this.getApplicationId();
    return this.request<APIApplicationCommand[]>('GET', `/applications/${appId}/commands`);
  }

  /**
   * List all guild-specific commands for this application
   */
  async listGuildCommands(guildId: string): Promise<APIApplicationCommand[]> {
    const appId = this.getApplicationId();
    return this.request<APIApplicationCommand[]>('GET', `/applications/${appId}/guilds/${guildId}/commands`);
  }

  /**
   * Get a specific global command
   */
  async getGlobalCommand(commandId: string): Promise<APIApplicationCommand> {
    const appId = this.getApplicationId();
    return this.request<APIApplicationCommand>('GET', `/applications/${appId}/commands/${commandId}`);
  }

  /**
   * Get a specific guild command
   */
  async getGuildCommand(guildId: string, commandId: string): Promise<APIApplicationCommand> {
    const appId = this.getApplicationId();
    return this.request<APIApplicationCommand>('GET', `/applications/${appId}/guilds/${guildId}/commands/${commandId}`);
  }

  /**
   * Update a global command
   */
  async updateGlobalCommand(commandId: string, data: Partial<APIApplicationCommand>): Promise<APIApplicationCommand> {
    const appId = this.getApplicationId();
    return this.request<APIApplicationCommand>('PATCH', `/applications/${appId}/commands/${commandId}`, data);
  }

  /**
   * Update a guild-specific command
   */
  async updateGuildCommand(guildId: string, commandId: string, data: Partial<APIApplicationCommand>): Promise<APIApplicationCommand> {
    const appId = this.getApplicationId();
    return this.request<APIApplicationCommand>('PATCH', `/applications/${appId}/guilds/${guildId}/commands/${commandId}`, data);
  }

  // ==================== Helpers ====================

  private applicationId: string = '';

  /**
   * Set the application ID
   */
  setApplicationId(id: string): void {
    this.applicationId = id;
  }

  /**
   * Get the application ID
   */
  private getApplicationId(): string {
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
  async createChannel(guildId: string, data: {
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
  }): Promise<APIChannel> {
    // Map parent_id to category_id for backend compatibility
    const requestData: Record<string, unknown> = {
      name: data.name,
      type: data.type ?? 0, // Default to text channel
    };
    
    // Backend expects category_id, not parent_id
    if (data.category_id) {
      requestData.category_id = data.category_id;
    } else if (data.parent_id) {
      requestData.category_id = data.parent_id;
    }
    
    // Add permission_overwrites if provided
    if (data.permission_overwrites && data.permission_overwrites.length > 0) {
      requestData.permission_overwrites = data.permission_overwrites;
    }
    
    return this.request<APIChannel>('POST', `/bot/guilds/${guildId}/channels`, requestData);
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
  async deleteChannel(guildId: string, channelId: string): Promise<void> {
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
  async editChannel(guildId: string, channelId: string, data: {
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
  }): Promise<APIChannel> {
    return this.request<APIChannel>('PATCH', `/bot/guilds/${guildId}/channels/${channelId}`, data);
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
  async deleteCategory(guildId: string, categoryId: string): Promise<void> {
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
  async editChannelPermissions(channelId: string, overwriteId: string, data: {
    type: number;
    allow?: string;
    deny?: string;
  }): Promise<void> {
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
  async deleteChannelPermission(channelId: string, overwriteId: string): Promise<void> {
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
  async getMessages(guildId: string, channelId: string, options?: {
    limit?: number;
    before?: string;
    after?: string;
  }): Promise<APIMessage[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', String(options.limit));
    if (options?.before) params.append('before', options.before);
    if (options?.after) params.append('after', options.after);
    
    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await this.request<{ messages: APIMessage[]; page_info: any }>('GET', `/bot/guilds/${guildId}/channels/${channelId}/messages${query}`);
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
  async *getMessagesIterator(guildId: string, channelId: string, options?: {
    limit?: number;
    batchSize?: number;
  }): AsyncGenerator<APIMessage[], void, unknown> {
    const batchSize = Math.min(options?.batchSize ?? 100, 100);
    const maxMessages = options?.limit;
    let fetched = 0;
    let before: string | undefined;

    while (true) {
      // Calculate how many to fetch in this batch
      const toFetch = maxMessages !== undefined 
        ? Math.min(batchSize, maxMessages - fetched) 
        : batchSize;

      if (toFetch <= 0) break;

      const messages = await this.getMessages(guildId, channelId, {
        limit: toFetch,
        before
      });

      if (messages.length === 0) break;

      yield messages;
      fetched += messages.length;

      // Use the oldest message ID as the 'before' cursor for next batch
      before = messages[messages.length - 1].id;

      // Stop if we got fewer than requested (no more messages)
      if (messages.length < toFetch) break;

      // Stop if we've reached the limit
      if (maxMessages !== undefined && fetched >= maxMessages) break;
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
  async getMember(guildId: string, userId: string): Promise<APIMemberData> {
    // SECURITY: Validate IDs to prevent path traversal
    validateId(guildId, 'guildId');
    validateId(userId, 'userId');
    
    return this.request<APIMemberData>('GET', `/bot/guilds/${guildId}/members/${userId}`);
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
  async getMembers(guildId: string, options?: { limit?: number; cursor?: string }): Promise<APIMembersResponse> {
    const params = new URLSearchParams();
    params.set('flat', 'true'); // Bot API always uses flat response (no presence grouping)
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.cursor) params.set('cursor', options.cursor);
    return this.request<APIMembersResponse>('GET', `/bot/guilds/${guildId}/members?${params.toString()}`);
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
  async *getMembersIterator(guildId: string, options?: {
    limit?: number;
    batchSize?: number;
  }): AsyncGenerator<APIMemberData[], void, unknown> {
    const batchSize = Math.min(options?.batchSize ?? 100, 1000);
    const maxMembers = options?.limit;
    let fetched = 0;
    let cursor: string | undefined;

    while (true) {
      // Calculate how many to fetch in this batch
      const toFetch = maxMembers !== undefined 
        ? Math.min(batchSize, maxMembers - fetched) 
        : batchSize;

      if (toFetch <= 0) break;

      const response = await this.getMembers(guildId, {
        limit: toFetch,
        cursor
      });

      const members = response.members || [];
      if (members.length === 0) break;

      yield members;
      fetched += members.length;

      // Use the cursor from page_info for next batch
      cursor = response.page_info?.cursor;

      // Stop if no more pages
      if (!response.page_info?.has_more) break;

      // Stop if we've reached the limit
      if (maxMembers !== undefined && fetched >= maxMembers) break;
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
  async timeoutMember(guildId: string, userId: string, duration: number | null, reason?: string): Promise<void> {
    if (duration === null) {
      // Clear timeout
      await this.request('POST', `/bot/guilds/${guildId}/members/${userId}/timeout/clear`, {
        reason
      });
    } else {
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
  async kickMember(guildId: string, userId: string, reason?: string): Promise<void> {
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
  async banMember(guildId: string, userId: string, options?: {
    deleteMessageDays?: number;
    deleteMessageSeconds?: number;
    reason?: string;
  }): Promise<void> {
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
  async unbanMember(guildId: string, userId: string, reason?: string): Promise<void> {
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
  async editMember(guildId: string, userId: string, data: {
    nick?: string | null;
    roles?: string[];
    mute?: boolean;
    deaf?: boolean;
    channel_id?: string | null;
    communication_disabled_until?: string | null;
    reason?: string;
  }): Promise<APIMemberData> {
    return this.request<APIMemberData>('PATCH', `/bot/guilds/${guildId}/members/${userId}`, data);
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
  async getGuild(guildId: string): Promise<APIGuildData> {
    // SECURITY: Validate ID to prevent path traversal
    validateId(guildId, 'guildId');
    
    return this.request<APIGuildData>('GET', `/bot/guilds/${guildId}`);
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
  async addMemberRole(guildId: string, userId: string, roleId: string, reason?: string): Promise<void> {
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
  async removeMemberRole(guildId: string, userId: string, roleId: string, reason?: string): Promise<void> {
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
  async bulkAssignRoles(guildId: string, assignments: { user_id: string; role_ids: string[] }[]): Promise<any> {
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
  async bulkRemoveRoles(guildId: string, removals: { user_id: string; role_ids: string[] }[]): Promise<any> {
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
  async bulkDeleteMessages(guildId: string, channelId: string, messageIds: string[]): Promise<void> {
    await this.request('POST', `/bot/guilds/${guildId}/channels/${channelId}/messages/bulk-delete`, {
      messages: messageIds
    });
  }

  // ==================== Guilds ====================

  /**
   * Get a guild
   */
  async getGuildChannels(guildId: string): Promise<APIChannel[]> {
    return this.request<APIChannel[]>('GET', `/bot/guilds/${guildId}/channels`);
  }

  /**
   * Get guild roles
   */
  async getRoles(guildId: string): Promise<APIRoleData[]> {
    return this.request<APIRoleData[]>('GET', `/bot/guilds/${guildId}/roles`);
  }

  /**
   * Create a role
   */
  async createRole(guildId: string, data: {
    name?: string;
    color?: number;
    hoist?: boolean;
    mentionable?: boolean;
    permissions?: string;
  }): Promise<APIRoleData> {
    return this.request<APIRoleData>('POST', `/bot/guilds/${guildId}/roles`, data);
  }

  /**
   * Edit a role
   */
  async editRole(guildId: string, roleId: string, data: {
    name?: string;
    color?: number;
    hoist?: boolean;
    mentionable?: boolean;
    permissions?: string;
  }): Promise<APIRoleData> {
    return this.request<APIRoleData>('PATCH', `/bot/guilds/${guildId}/roles/${roleId}`, data);
  }

  /**
   * Delete a role
   */
  async deleteRole(guildId: string, roleId: string): Promise<void> {
    await this.request('DELETE', `/bot/guilds/${guildId}/roles/${roleId}`);
  }

  /**
   * Get guild emojis
   * 
   * @param guildId - The ID of the guild
   * @returns Array of emoji objects
   */
  async getEmojis(guildId: string): Promise<APIEmoji[]> {
    return this.request<APIEmoji[]>('GET', `/bot/guilds/${guildId}/emojis`);
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
  async getBans(guildId: string): Promise<APIBan[]> {
    return this.request<APIBan[]>('GET', `/bot/guilds/${guildId}/bans`);
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
  async getBan(guildId: string, userId: string): Promise<APIBan> {
    return this.request<APIBan>('GET', `/bot/guilds/${guildId}/bans/${userId}`);
  }

  /**
   * Get guild invites
   * 
   * @param guildId - The ID of the guild
   * @returns Array of invite objects
   */
  async getGuildInvites(guildId: string): Promise<APIInvite[]> {
    return this.request<APIInvite[]>('GET', `/bot/guilds/${guildId}/invites`);
  }

  // ==================== Pins ====================

  /**
   * Pin a message
   */
  async pinMessage(guildId: string, channelId: string, messageId: string): Promise<void> {
    await this.request('PUT', `/bot/guilds/${guildId}/channels/${channelId}/pins/${messageId}`);
  }

  /**
   * Unpin a message
   */
  async unpinMessage(guildId: string, channelId: string, messageId: string): Promise<void> {
    await this.request('DELETE', `/bot/guilds/${guildId}/channels/${channelId}/pins/${messageId}`);
  }

  /**
   * Get pinned messages
   */
  async getPinnedMessages(guildId: string, channelId: string): Promise<APIMessage[]> {
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
  async getAuditLog(guildId: string, options?: {
    user_id?: string;
    action_type?: number;
    before?: string;
    limit?: number;
  }): Promise<APIAuditLog> {
    const params = new URLSearchParams();
    if (options?.user_id) params.append('user_id', options.user_id);
    if (options?.action_type !== undefined) params.append('action_type', String(options.action_type));
    if (options?.before) params.append('before', options.before);
    if (options?.limit !== undefined) params.append('limit', String(options.limit));
    
    const query = params.toString();
    return this.request<APIAuditLog>('GET', `/bot/guilds/${guildId}/audit-logs${query ? `?${query}` : ''}`);
  }

  // ==================== Users ====================

  /**
   * Get a user
   */
  async getUser(userId: string): Promise<APIUser> {
    return this.request<APIUser>('GET', `/bot/users/${userId}`);
  }

  /**
   * Get current bot user
   */
  async getCurrentUser(): Promise<APIUser> {
    return this.request<APIUser>('GET', `/bot/users/@me`);
  }

  // ==================== Invites ====================

  /**
   * Create an invite
   */
  async createInvite(guildId: string, channelId: string, data?: {
    max_age?: number;
    max_uses?: number;
    temporary?: boolean;
    unique?: boolean;
  }): Promise<APIInvite> {
    return this.request<APIInvite>('POST', `/bot/guilds/${guildId}/channels/${channelId}/invites`, data || {});
  }

  /**
   * Delete an invite
   */
  async deleteInvite(inviteCode: string): Promise<void> {
    await this.request<void>('DELETE', `/bot/invites/${inviteCode}`);
  }

  /**
   * Get an invite
   */
  async getInvite(inviteCode: string): Promise<APIInvite> {
    return this.request<APIInvite>('GET', `/bot/invites/${inviteCode}`);
  }

  // ==================== Webhooks ====================

  /**
   * Get channel webhooks
   */
  async getChannelWebhooks(guildId: string, channelId: string): Promise<APIWebhook[]> {
    return this.request<APIWebhook[]>('GET', `/bot/guilds/${guildId}/channels/${channelId}/webhooks`);
  }

  /**
   * Get guild webhooks
   */
  async getGuildWebhooks(guildId: string): Promise<APIWebhook[]> {
    return this.request<APIWebhook[]>('GET', `/bot/guilds/${guildId}/webhooks`);
  }

  /**
   * Create a webhook
   */
  async createWebhook(guildId: string, channelId: string, data: {
    name: string;
    avatar?: string;
  }): Promise<APIWebhook> {
    return this.request<APIWebhook>('POST', `/bot/guilds/${guildId}/channels/${channelId}/webhooks`, data);
  }

  /**
   * Update a webhook
   */
  async updateWebhook(guildId: string, webhookId: string, data: {
    name?: string;
    avatar_url?: string;
  }): Promise<APIWebhook> {
    return this.request<APIWebhook>('PATCH', `/bot/guilds/${guildId}/webhooks/${webhookId}`, data);
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(guildId: string, webhookId: string): Promise<void> {
    return this.request<void>('DELETE', `/bot/guilds/${guildId}/webhooks/${webhookId}`);
  }

  // ==================== Generic HTTP Methods ====================

  /**
   * Make a GET request to any API path
   * @example await client.rest.get('/bot/guilds/123/channels');
   */
  async get<T = any>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  /**
   * Make a POST request to any API path
   * @example await client.rest.post('/bot/guilds/123/channels', { name: 'new-channel', type: 2 });
   */
  async post<T = any>(path: string, body?: any): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  /**
   * Make a PATCH request to any API path
   * @example await client.rest.patch('/bot/guilds/123/channels/456', { name: 'renamed' });
   */
  async patch<T = any>(path: string, body?: any): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  /**
   * Make a PUT request to any API path
   * @example await client.rest.put('/bot/channels/456/permissions/789', { type: 0, allow: '1024' });
   */
  async put<T = any>(path: string, body?: any): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  /**
   * Make a DELETE request to any API path
   * @example await client.rest.delete('/bot/guilds/123/channels/456');
   */
  async delete<T = any>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }
}
