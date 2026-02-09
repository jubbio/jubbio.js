/**
 * Manager for channels with caching and lazy loading
 */

import { CachedManager } from './BaseManager';
import { Collection } from '../utils/Collection';

/** Channel types */
export enum ChannelType {
  GuildText = 0,
  DM = 1,
  GuildVoice = 2,
  GroupDM = 3,
  GuildCategory = 4,
  GuildAnnouncement = 5,
  AnnouncementThread = 10,
  PublicThread = 11,
  PrivateThread = 12,
  GuildStageVoice = 13,
  GuildDirectory = 14,
  GuildForum = 15,
}

/**
 * Manages channels for a guild
 */
export class GuildChannelManager extends CachedManager<string, any> {
  /** The guild this manager belongs to */
  public readonly guild: any;

  constructor(guild: any, iterable?: Iterable<any>) {
    super(guild.client, Object as any, iterable);
    this.guild = guild;
  }

  /**
   * Add a channel to the cache
   */
  _add(data: any, cache = true): any {
    const id = data.id;
    const existing = this.cache.get(id);
    
    if (existing) {
      if (cache) Object.assign(existing, data);
      return existing;
    }
    
    const channel = {
      id,
      guildId: this.guild.id,
      name: data.name,
      type: data.type,
      position: data.position ?? 0,
      parentId: data.parent_id ?? null,
      permissionOverwrites: data.permission_overwrites ?? [],
      topic: data.topic ?? null,
      nsfw: data.nsfw ?? false,
      rateLimitPerUser: data.rate_limit_per_user ?? 0,
      bitrate: data.bitrate,
      userLimit: data.user_limit,
      
      get isText() { return [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(this.type); },
      get isVoice() { return [ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(this.type); },
      get isCategory() { return this.type === ChannelType.GuildCategory; },
      get isThread() { return [ChannelType.PublicThread, ChannelType.PrivateThread, ChannelType.AnnouncementThread].includes(this.type); },
      
      toString() { return `<#${this.id}>`; },
      
      async send(content: any) {
        return this.guild.client.rest.request('POST', `/channels/${this.id}/messages`, 
          typeof content === 'string' ? { content } : content
        );
      },
      
      async delete(reason?: string) {
        return this.guild.client.rest.request('DELETE', `/channels/${this.id}`, reason ? { reason } : undefined);
      },
      
      async edit(data: any) {
        return this.guild.client.rest.request('PATCH', `/channels/${this.id}`, data);
      },
    };
    
    if (cache) this.cache.set(id, channel);
    return channel;
  }

  /**
   * Fetch a channel from the API
   */
  async fetch(id: string, options?: { cache?: boolean; force?: boolean }): Promise<any> {
    if (!options?.force) {
      const existing = this.cache.get(id);
      if (existing) return existing;
    }
    
    const data = await this.client.rest.request('GET', `/channels/${id}`);
    return this._add(data, options?.cache ?? true);
  }

  /**
   * Fetch all channels for the guild
   */
  async fetchAll(): Promise<Collection<string, any>> {
    const data = await this.client.rest.request('GET', `/guilds/${this.guild.id}/channels`);
    const channels = new Collection<string, any>();
    for (const channelData of data) {
      const channel = this._add(channelData);
      channels.set(channel.id, channel);
    }
    return channels;
  }

  /**
   * Create a new channel
   */
  async create(options: {
    name: string;
    type?: ChannelType;
    topic?: string;
    bitrate?: number;
    userLimit?: number;
    rateLimitPerUser?: number;
    position?: number;
    permissionOverwrites?: any[];
    parent?: string;
    nsfw?: boolean;
    reason?: string;
  }): Promise<any> {
    const body: any = {
      name: options.name,
      type: options.type ?? ChannelType.GuildText,
    };
    if (options.topic) body.topic = options.topic;
    if (options.bitrate) body.bitrate = options.bitrate;
    if (options.userLimit) body.user_limit = options.userLimit;
    if (options.rateLimitPerUser) body.rate_limit_per_user = options.rateLimitPerUser;
    if (options.position !== undefined) body.position = options.position;
    if (options.permissionOverwrites) body.permission_overwrites = options.permissionOverwrites;
    if (options.parent) body.parent_id = options.parent;
    if (options.nsfw !== undefined) body.nsfw = options.nsfw;
    
    const data = await this.client.rest.request('POST', `/guilds/${this.guild.id}/channels`, body);
    return this._add(data);
  }

  /**
   * Delete a channel
   */
  async delete(id: string, reason?: string): Promise<void> {
    await this.client.rest.request('DELETE', `/channels/${id}`, reason ? { reason } : undefined);
    this.cache.delete(id);
  }

  /**
   * Edit a channel
   */
  async edit(id: string, data: {
    name?: string;
    type?: ChannelType;
    position?: number;
    topic?: string;
    nsfw?: boolean;
    rateLimitPerUser?: number;
    bitrate?: number;
    userLimit?: number;
    permissionOverwrites?: any[];
    parent?: string | null;
  }): Promise<any> {
    const body: any = {};
    if (data.name) body.name = data.name;
    if (data.type !== undefined) body.type = data.type;
    if (data.position !== undefined) body.position = data.position;
    if (data.topic !== undefined) body.topic = data.topic;
    if (data.nsfw !== undefined) body.nsfw = data.nsfw;
    if (data.rateLimitPerUser !== undefined) body.rate_limit_per_user = data.rateLimitPerUser;
    if (data.bitrate !== undefined) body.bitrate = data.bitrate;
    if (data.userLimit !== undefined) body.user_limit = data.userLimit;
    if (data.permissionOverwrites) body.permission_overwrites = data.permissionOverwrites;
    if (data.parent !== undefined) body.parent_id = data.parent;
    
    const result = await this.client.rest.request('PATCH', `/channels/${id}`, body);
    return this._add(result);
  }

  /**
   * Set channel positions
   */
  async setPositions(positions: Array<{ channel: string; position: number; parent?: string | null }>): Promise<void> {
    const body = positions.map(p => ({
      id: p.channel,
      position: p.position,
      parent_id: p.parent,
    }));
    await this.client.rest.request('PATCH', `/guilds/${this.guild.id}/channels`, body);
  }
}

/**
 * Global channel manager for the client
 */
export class ChannelManager extends CachedManager<string, any> {
  constructor(client: any, iterable?: Iterable<any>) {
    super(client, Object as any, iterable);
  }

  _add(data: any, cache = true): any {
    const id = data.id;
    const existing = this.cache.get(id);
    if (existing) {
      if (cache) Object.assign(existing, data);
      return existing;
    }
    
    const channel = { ...data, id };
    if (cache) this.cache.set(id, channel);
    return channel;
  }

  async fetch(id: string, options?: { cache?: boolean; force?: boolean }): Promise<any> {
    if (!options?.force) {
      const existing = this.cache.get(id);
      if (existing) return existing;
    }
    const data = await this.client.rest.request('GET', `/channels/${id}`);
    return this._add(data, options?.cache ?? true);
  }
}

export default GuildChannelManager;
