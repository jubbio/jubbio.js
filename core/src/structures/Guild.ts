import { APIGuild, APIChannel, APIGuildMember } from '../types';
import { Collection } from './Collection';
import { GuildMember } from './GuildMember';
import { ApplicationCommandManager } from '../managers/ApplicationCommandManager';
import type { Client } from '../Client';

/**
 * Represents a guild
 */
export class Guild {
  /** Reference to the client */
  public readonly client: Client;
  
  /** Guild ID */
  public readonly id: string;
  
  /** Guild name */
  public name: string;
  
  /** Guild icon URL */
  public icon?: string;
  
  /** Owner ID */
  public ownerId: string;
  
  /** Member count */
  public memberCount: number;
  
  /** Online member count */
  public onlineCount: number;
  
  /** Whether the guild is unavailable */
  public unavailable: boolean;
  
  /** Cached members */
  public members: Collection<string, GuildMember>;
  
  /** Cached channels */
  public channels: Collection<string, APIChannel>;

  /** Guild-specific slash commands manager */
  public readonly commands: ApplicationCommandManager;

  constructor(client: Client, data: APIGuild) {
    this.client = client;
    this.id = data.id;
    this.name = data.name;
    this.icon = data.icon;
    this.ownerId = data.owner_id;
    this.memberCount = data.member_count ?? 0;
    this.onlineCount = data.online_count ?? 0;
    this.unavailable = data.unavailable ?? false;
    this.members = new Collection();
    this.channels = new Collection();
    this.commands = new ApplicationCommandManager(client.rest, this.id);
    
    // Cache channels from initial data (READY or GUILD_CREATE)
    if (data.channels) {
      for (const channel of data.channels) {
        const channelId = String(channel.id);
        this.channels.set(channelId, channel);
      }
    }
  }

  /**
   * Get the guild icon URL
   */
  iconURL(options?: { size?: number }): string | null {
    if (!this.icon) return null;
    return this.icon;
  }

  /**
   * Get the voice adapter creator for @jubbio/voice
   */
  get voiceAdapterCreator() {
    return this.client.voice.adapters.get(this.id);
  }

  /**
   * Fetch a member by ID
   */
  async fetchMember(userId: string): Promise<GuildMember> {
    // Check cache first
    const cached = this.members.get(userId);
    if (cached) return cached;
    
    // Fetch from API
    const data = await this.client.rest.getMember(this.id, userId);
    if (!data) throw new Error(`Member ${userId} not found in guild ${this.id}`);
    const member = this._addMember(data);
    return member;
  }

  /**
   * Fetch guild members list (paginated)
   * @param options.limit Max members to return (default 50)
   * @param options.cursor Pagination cursor from previous response
   * @returns Object with members array and pagination info
   */
  async fetchMembers(options?: { limit?: number; cursor?: string }): Promise<any> {
    const data = await this.client.rest.getMembers(this.id, options);

    // Cache fetched members
    if (data?.members) {
      for (const memberData of data.members) {
        this._addMember(memberData);
      }
    }

    return data;
  }

  /**
   * Convert to string
   */
  toString(): string {
    return this.name;
  }

  /**
   * Fetch fresh guild data from API (updates cache)
   * Returns real-time memberCount and onlineCount from live data
   * @param options Optional fetch options
   * @param options.withMembers Whether to also fetch and cache members (not yet implemented)
   * @param options.withRoles Whether to also fetch roles (not yet implemented, structure placeholder)
   */
  async fetch(options?: { withMembers?: boolean; withRoles?: boolean }): Promise<this> {
    const data = await this.client.rest.getGuild(this.id);
    this._patch(data);
    
    // Note: withRoles and withMembers are placeholders for future implementation
    // Role caching and member bulk fetching would be implemented here
    // Currently, roles would need a separate API endpoint: this.client.rest.getRoles(this.id)
    
    return this;
  }

  /**
   * Update guild data
   */
  _patch(data: Partial<APIGuild>): void {
    if (data.name !== undefined) this.name = data.name;
    if (data.icon !== undefined) this.icon = data.icon;
    if (data.owner_id !== undefined) this.ownerId = data.owner_id;
    if (data.member_count !== undefined) this.memberCount = data.member_count;
    if (data.online_count !== undefined) this.onlineCount = data.online_count;
    if (data.unavailable !== undefined) this.unavailable = data.unavailable;
    if (data.channels) {
      for (const channel of data.channels) {
        this.channels.set(String(channel.id), channel);
      }
    }
  }

  /**
   * Add a member to cache
   * Preserves voice state from existing cached member if new data doesn't include it
   */
  _addMember(data: APIGuildMember): GuildMember {
    const member = new GuildMember(this.client, this, data);
    
    // Preserve voice state from cache if the new data doesn't have it
    if (!data.voice?.channel_id) {
      const existing = this.members.get(member.id);
      if (existing?.voice?.channelId) {
        member.voice = { ...existing.voice };
      }
    }
    
    this.members.set(member.id, member);
    return member;
  }
}
