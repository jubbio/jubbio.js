import { APIGuild, APIChannel, APIGuildMember } from '../types';
import { Collection } from './Collection';
import { GuildMember } from './GuildMember';
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
  
  /** Whether the guild is unavailable */
  public unavailable: boolean;
  
  /** Cached members */
  public members: Collection<string, GuildMember>;
  
  /** Cached channels */
  public channels: Collection<string, APIChannel>;

  constructor(client: Client, data: APIGuild) {
    this.client = client;
    this.id = data.id;
    this.name = data.name;
    this.icon = data.icon;
    this.ownerId = data.owner_id;
    this.unavailable = data.unavailable ?? false;
    this.members = new Collection();
    this.channels = new Collection();
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
   * Update guild data
   */
  _patch(data: Partial<APIGuild>): void {
    if (data.name !== undefined) this.name = data.name;
    if (data.icon !== undefined) this.icon = data.icon;
    if (data.owner_id !== undefined) this.ownerId = data.owner_id;
    if (data.unavailable !== undefined) this.unavailable = data.unavailable;
  }

  /**
   * Add a member to cache
   */
  _addMember(data: APIGuildMember): GuildMember {
    const member = new GuildMember(this.client, this, data);
    this.members.set(member.id, member);
    return member;
  }
}
