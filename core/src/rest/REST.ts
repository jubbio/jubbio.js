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
export class REST {
  private baseUrl: string;
  private token: string = '';
  
  // User cache for mention resolution (ID -> username)
  private userCache: Map<number, CachedUser> = new Map();
  private readonly USER_CACHE_TTL = 5 * 60 * 1000; // 5 dakika

  constructor(baseUrl: string = 'https://gateway.jubbio.com/api/v1') {
    this.baseUrl = baseUrl;
  }

  // ==================== Mention Helpers ====================

  /**
   * Cache a user for mention resolution
   * Bot'lar interaction'dan gelen user bilgisini cache'leyebilir
   */
  cacheUser(user: { id: string | number; username: string; displayName?: string; display_name?: string }): void {
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
  cacheUsers(users: Array<{ id: string | number; username: string; displayName?: string; display_name?: string }>): void {
    users.forEach(user => this.cacheUser(user));
  }

  /**
   * Get cached user by ID
   */
  getCachedUser(userId: number): CachedUser | undefined {
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
  formatMention(user: { id: string | number; username: string }): { text: string; data: MentionsData } {
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
  private processMentions(content: string, existingMentions?: MentionsData): { content: string; mentions: MentionsData } {
    const mentions: MentionsData = {
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
          mentions.users!.push({ id: userId, username: cachedUser.username });
          addedUserIds.add(userId);
        }
      } else {
        // User not in cache - keep as @User_ID format (backend will resolve)
        processedContent = processedContent.replace(fullMatch, `@User_${userId}`);
        
        // Still add to mentions with placeholder username
        if (!addedUserIds.has(userId)) {
          mentions.users!.push({ id: userId, username: `User_${userId}` });
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
        mentions.roles!.push({ id: roleId });
        addedRoleIds.add(roleId);
      }
    }

    // Parse @everyone and @here
    if (content.includes('@everyone')) {
      mentions.everyone = true;
    }

    // Clean up empty arrays
    if (mentions.users?.length === 0) delete mentions.users;
    if (mentions.roles?.length === 0) delete mentions.roles;

    return { content: processedContent, mentions };
  }

  /**
   * Prepare message data with processed mentions
   * Automatically converts mentions to our format
   */
  private prepareMessageData(data: {
    content?: string;
    embeds?: APIEmbed[];
    components?: any[];
    mentions?: MentionsData;
    message_reference?: { message_id: string };
  }): any {
    const result: any = { ...data };
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
        const processedEmbed: any = { ...embed };
        
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
          processedEmbed.fields = embed.fields.map((field: any) => {
            const processedField: any = { ...field };
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
   * Make an authenticated request
   */
  private async request<T>(method: string, path: string, body?: any): Promise<T> {
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
    if (!text) return {} as T;
    
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
  async createMessage(guildIdOrChannelId: string, channelIdOrData: string | {
    content?: string;
    embeds?: APIEmbed[];
    components?: any[];
    mentions?: MentionsData;
    files?: Array<{ name: string; data: Buffer }>;
    message_reference?: { message_id: string };
    interactionId?: string;
  }, data?: {
    content?: string;
    embeds?: APIEmbed[];
    components?: any[];
    mentions?: MentionsData;
    files?: Array<{ name: string; data: Buffer }>;
    message_reference?: { message_id: string };
    interactionId?: string;
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
      messageData = this.prepareMessageData(data);
      
      // Add interaction_id if provided
      if (data.interactionId) {
        messageData.interaction_id = data.interactionId;
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
  }): Promise<{ id: string; ephemeral: boolean; flags: number }> {
    const messageData = this.prepareMessageData(data);
    
    return this.request<{ id: string; ephemeral: boolean; flags: number }>('POST', `/bot/guilds/${guildId}/channels/${channelId}/messages`, {
      ...messageData,
      flags: 64, // EPHEMERAL flag
      target_user_id: typeof targetUserId === 'string' ? parseInt(targetUserId, 10) : targetUserId
    });
  }

  /**
   * Create a DM message
   */
  async createDMMessage(channelId: string, data: {
    content?: string;
    embeds?: APIEmbed[];
  }): Promise<APIMessage> {
    return this.request<APIMessage>('POST', `/bot/dm/${channelId}`, data);
  }

  /**
   * Edit a message
   * Automatically processes mentions
   */
  async editMessage(guildId: string, channelId: string, messageId: string, data: {
    content?: string;
    embeds?: APIEmbed[];
    mentions?: MentionsData;
  }): Promise<APIMessage> {
    const path = `/bot/guilds/${guildId}/channels/${channelId}/messages/${messageId}`;
    const processedData = this.prepareMessageData(data);
    return this.request<APIMessage>('PATCH', path, processedData);
  }

  /**
   * Delete a message
   */
  async deleteMessage(guildId: string, channelId: string, messageId: string): Promise<void> {
    const path = `/bot/guilds/${guildId}/channels/${channelId}/messages/${messageId}`;
    await this.request<void>('DELETE', path);
  }

  /**
   * Add a reaction to a message
   */
  async addReaction(guildId: string, channelId: string, messageId: string, emoji: string): Promise<void> {
    const path = `/bot/guilds/${guildId}/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`;
    await this.request<void>('PUT', path);
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
    
    return response.json() as Promise<{ id: string; url: string; filename: string }>;
  }

  /**
   * Create a message with a file attachment
   */
  async createMessageWithFile(guildId: string, channelId: string, data: {
    content?: string;
    file: { name: string; data: Buffer; contentType?: string };
    interactionId?: string;
  }): Promise<APIMessage> {
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
      
      await this.request<void>('POST', `/interactions/${interactionId}/${token}/callback`, processedData);
      console.log(`✅ Interaction response sent`);
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
    
    await this.request<void>('PATCH', `/webhooks/${appId}/${token}/messages/@original`, payload);
  }

  /**
   * Delete the original interaction response
   */
  async deleteInteractionResponse(token: string): Promise<void> {
    const appId = this.getApplicationId();
    await this.request<void>('DELETE', `/webhooks/${appId}/${token}/messages/@original`);
  }

  /**
   * Create a followup message
   * Automatically processes mentions
   */
  async createFollowup(token: string, data: {
    content?: string;
    embeds?: APIEmbed[];
    mentions?: MentionsData;
    flags?: number;
  }): Promise<void> {
    const appId = this.getApplicationId();
    const processedData = this.prepareMessageData(data);
    await this.request<void>('POST', `/webhooks/${appId}/${token}`, processedData);
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
   * Register guild-specific commands
   */
  async registerGuildCommands(guildId: string, commands: APIApplicationCommand[]): Promise<void> {
    const appId = this.getApplicationId();
    
    for (const command of commands) {
      await this.request<void>('POST', `/applications/${appId}/guilds/${guildId}/commands`, command);
    }
  }

  /**
   * Delete a global command
   */
  async deleteGlobalCommand(commandId: string): Promise<void> {
    const appId = this.getApplicationId();
    await this.request<void>('DELETE', `/applications/${appId}/commands/${commandId}`);
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
   * Create a channel in a guild
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
  }): Promise<{ id: string; name: string }> {
    // Map parent_id to category_id for backend compatibility
    const requestData: any = {
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
    
    return this.request('POST', `/bot/guilds/${guildId}/channels`, requestData);
  }

  /**
   * Delete a channel
   */
  /**
   * Delete a channel
   */
  async deleteChannel(guildId: string, channelId: string): Promise<void> {
    await this.request('DELETE', `/bot/guilds/${guildId}/channels/${channelId}`);
  }

  /**
   * Edit channel permission overwrites
   */
  async editChannelPermissions(channelId: string, overwriteId: string, data: {
    type: number;
    allow?: string;
    deny?: string;
  }): Promise<void> {
    await this.request('PUT', `/bot/channels/${channelId}/permissions/${overwriteId}`, data);
  }

  /**
   * Delete channel permission overwrite
   */
  async deleteChannelPermission(channelId: string, overwriteId: string): Promise<void> {
    await this.request('DELETE', `/bot/channels/${channelId}/permissions/${overwriteId}`);
  }

  /**
   * Get messages from a channel
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

  // ==================== Members ====================

  /**
   * Get a guild member
   */
  async getMember(guildId: string, userId: string): Promise<any> {
    return this.request('GET', `/bot/guilds/${guildId}/members/${userId}`);
  }

  /**
   * Timeout a guild member
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
   * Kick a guild member
   */
  async kickMember(guildId: string, userId: string, reason?: string): Promise<void> {
    const query = reason ? `?reason=${encodeURIComponent(reason)}` : '';
    await this.request('DELETE', `/bot/guilds/${guildId}/members/${userId}${query}`);
  }

  /**
   * Ban a guild member
   */
  async banMember(guildId: string, userId: string, options?: {
    deleteMessageDays?: number;
    deleteMessageSeconds?: number;
    reason?: string;
  }): Promise<void> {
    await this.request('PUT', `/bot/guilds/${guildId}/bans/${userId}`, {
      delete_message_days: options?.deleteMessageDays,
      delete_message_seconds: options?.deleteMessageSeconds,
      reason: options?.reason
    });
  }

  /**
   * Unban a user
   */
  async unbanMember(guildId: string, userId: string, reason?: string): Promise<void> {
    const query = reason ? `?reason=${encodeURIComponent(reason)}` : '';
    await this.request('DELETE', `/bot/guilds/${guildId}/bans/${userId}${query}`);
  }

  /**
   * Edit a guild member
   */
  async editMember(guildId: string, userId: string, data: {
    nick?: string | null;
    roles?: string[];
    mute?: boolean;
    deaf?: boolean;
    channel_id?: string | null;
    communication_disabled_until?: string | null;
    reason?: string;
  }): Promise<any> {
    return this.request('PATCH', `/bot/guilds/${guildId}/members/${userId}`, data);
  }

  /**
   * Add a role to a member
   */
  async addMemberRole(guildId: string, userId: string, roleId: string, reason?: string): Promise<void> {
    const query = reason ? `?reason=${encodeURIComponent(reason)}` : '';
    await this.request('PUT', `/bot/guilds/${guildId}/members/${userId}/roles/${roleId}${query}`);
  }

  /**
   * Remove a role from a member
   */
  async removeMemberRole(guildId: string, userId: string, roleId: string, reason?: string): Promise<void> {
    const query = reason ? `?reason=${encodeURIComponent(reason)}` : '';
    await this.request('DELETE', `/bot/guilds/${guildId}/members/${userId}/roles/${roleId}${query}`);
  }

  /**
   * Bulk delete messages
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
  async getGuild(guildId: string): Promise<any> {
    return this.request('GET', `/bot/guilds/${guildId}`);
  }

  /**
   * Get guild channels
   */
  async getGuildChannels(guildId: string): Promise<any[]> {
    return this.request('GET', `/bot/guilds/${guildId}/channels`);
  }

  /**
   * Get guild roles
   */
  async getRoles(guildId: string): Promise<any[]> {
    return this.request('GET', `/bot/guilds/${guildId}/roles`);
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
  }): Promise<any> {
    return this.request('POST', `/bot/guilds/${guildId}/roles`, data);
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
  }): Promise<any> {
    return this.request('PATCH', `/bot/guilds/${guildId}/roles/${roleId}`, data);
  }

  /**
   * Delete a role
   */
  async deleteRole(guildId: string, roleId: string): Promise<void> {
    await this.request('DELETE', `/bot/guilds/${guildId}/roles/${roleId}`);
  }

  /**
   * Get guild emojis
   */
  async getEmojis(guildId: string): Promise<any[]> {
    return this.request('GET', `/bot/guilds/${guildId}/emojis`);
  }

  /**
   * Get guild bans
   */
  async getBans(guildId: string): Promise<any[]> {
    return this.request('GET', `/bot/guilds/${guildId}/bans`);
  }

  /**
   * Get a specific ban
   */
  async getBan(guildId: string, userId: string): Promise<any> {
    return this.request('GET', `/bot/guilds/${guildId}/bans/${userId}`);
  }

  /**
   * Get guild invites
   */
  async getGuildInvites(guildId: string): Promise<any[]> {
    return this.request('GET', `/bot/guilds/${guildId}/invites`);
  }

  // ==================== Threads ====================

  /**
   * Create a thread from a message
   */
  async createThreadFromMessage(guildId: string, channelId: string, messageId: string, data: {
    name: string;
    auto_archive_duration?: number;
  }): Promise<any> {
    return this.request('POST', `/bot/guilds/${guildId}/channels/${channelId}/messages/${messageId}/threads`, data);
  }

  /**
   * Create a thread without a message
   */
  async createThread(guildId: string, channelId: string, data: {
    name: string;
    type?: number;
    auto_archive_duration?: number;
    invitable?: boolean;
  }): Promise<any> {
    return this.request('POST', `/bot/guilds/${guildId}/channels/${channelId}/threads`, data);
  }

  /**
   * Join a thread
   */
  async joinThread(channelId: string): Promise<void> {
    await this.request('PUT', `/bot/channels/${channelId}/thread-members/@me`);
  }

  /**
   * Leave a thread
   */
  async leaveThread(channelId: string): Promise<void> {
    await this.request('DELETE', `/bot/channels/${channelId}/thread-members/@me`);
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

  // ==================== Users ====================

  /**
   * Get a user
   */
  async getUser(userId: string): Promise<any> {
    return this.request('GET', `/bot/users/${userId}`);
  }

  /**
   * Get current bot user
   */
  async getCurrentUser(): Promise<any> {
    return this.request('GET', `/bot/users/@me`);
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
  }): Promise<any> {
    return this.request('POST', `/bot/guilds/${guildId}/channels/${channelId}/invites`, data || {});
  }

  /**
   * Delete an invite
   */
  async deleteInvite(inviteCode: string): Promise<void> {
    await this.request('DELETE', `/bot/invites/${inviteCode}`);
  }

  /**
   * Get an invite
   */
  async getInvite(inviteCode: string): Promise<any> {
    return this.request('GET', `/bot/invites/${inviteCode}`);
  }

  // ==================== Webhooks ====================

  /**
   * Get channel webhooks
   */
  async getChannelWebhooks(guildId: string, channelId: string): Promise<any[]> {
    return this.request('GET', `/bot/guilds/${guildId}/channels/${channelId}/webhooks`);
  }

  /**
   * Create a webhook
   */
  async createWebhook(guildId: string, channelId: string, data: {
    name: string;
    avatar?: string;
  }): Promise<any> {
    return this.request('POST', `/bot/guilds/${guildId}/channels/${channelId}/webhooks`, data);
  }
}
