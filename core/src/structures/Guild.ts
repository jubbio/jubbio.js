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
  async fetchMember(userId: string): Promise<GuildMember | null> {
    // Check cache first
    const cached = this.members.get(userId);
    if (cached) return cached;
    
    // TODO: Fetch from API
    return null;
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
