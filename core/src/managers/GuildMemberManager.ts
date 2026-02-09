/**
 * Manager for guild members with caching and lazy loading
 */

import { CachedManager } from './BaseManager';
import { Collection } from '../utils/Collection';

/**
 * Manages guild members
 */
export class GuildMemberManager extends CachedManager<string, any> {
  /** The guild this manager belongs to */
  public readonly guild: any;

  constructor(guild: any, iterable?: Iterable<any>) {
    // Use a simple object as placeholder since we don't have GuildMember class yet
    super(guild.client, Object as any, iterable);
    this.guild = guild;
  }

  /**
   * Add a member to the cache
   */
  _add(data: any, cache = true): any {
    const id = data.user?.id ?? data.id;
    const existing = this.cache.get(id);
    
    if (existing) {
      if (cache) {
        Object.assign(existing, data);
      }
      return existing;
    }
    
    const member = {
      id,
      guildId: this.guild.id,
      user: data.user,
      nick: data.nick,
      roles: data.roles ?? [],
      joinedAt: data.joined_at ? new Date(data.joined_at) : null,
      premiumSince: data.premium_since ? new Date(data.premium_since) : null,
      deaf: data.deaf ?? false,
      mute: data.mute ?? false,
      pending: data.pending ?? false,
      permissions: data.permissions,
      communicationDisabledUntil: data.communication_disabled_until 
        ? new Date(data.communication_disabled_until) 
        : null,
      
      // Helper methods
      get displayName() {
        return this.nick ?? this.user?.display_name ?? this.user?.username ?? 'Unknown';
      },
      
      toString() {
        return `<@${this.id}>`;
      },
    };
    
    if (cache) {
      this.cache.set(id, member);
    }
    
    return member;
  }

  /**
   * Fetch a member from the API
   */
  async fetch(id: string, options?: { cache?: boolean; force?: boolean }): Promise<any> {
    if (!options?.force) {
      const existing = this.cache.get(id);
      if (existing) return existing;
    }
    
    const data = await this.client.rest.request(
      'GET',
      `/guilds/${this.guild.id}/members/${id}`
    );
    
    return this._add(data, options?.cache ?? true);
  }

  /**
   * Fetch multiple members
   */
  async fetchMany(options?: { 
    limit?: number; 
    after?: string;
    query?: string;
  }): Promise<Collection<string, any>> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.after) params.set('after', options.after);
    if (options?.query) params.set('query', options.query);
    
    const data = await this.client.rest.request(
      'GET',
      `/guilds/${this.guild.id}/members?${params}`
    );
    
    const members = new Collection<string, any>();
    for (const memberData of data) {
      const member = this._add(memberData);
      members.set(member.id, member);
    }
    
    return members;
  }

  /**
   * Search for members by query
   */
  async search(options: { query: string; limit?: number }): Promise<Collection<string, any>> {
    return this.fetchMany({ query: options.query, limit: options.limit ?? 10 });
  }

  /**
   * Kick a member
   */
  async kick(id: string, reason?: string): Promise<void> {
    await this.client.rest.request(
      'DELETE',
      `/guilds/${this.guild.id}/members/${id}`,
      reason ? { reason } : undefined
    );
    this.cache.delete(id);
  }

  /**
   * Ban a member
   */
  async ban(id: string, options?: { deleteMessageDays?: number; reason?: string }): Promise<void> {
    await this.client.rest.request(
      'PUT',
      `/guilds/${this.guild.id}/bans/${id}`,
      {
        delete_message_days: options?.deleteMessageDays,
        reason: options?.reason,
      }
    );
    this.cache.delete(id);
  }

  /**
   * Unban a user
   */
  async unban(id: string, reason?: string): Promise<void> {
    await this.client.rest.request(
      'DELETE',
      `/guilds/${this.guild.id}/bans/${id}`,
      reason ? { reason } : undefined
    );
  }

  /**
   * Edit a member
   */
  async edit(id: string, data: {
    nick?: string | null;
    roles?: string[];
    mute?: boolean;
    deaf?: boolean;
    channel_id?: string | null;
    communication_disabled_until?: Date | null;
  }): Promise<any> {
    const body: any = {};
    if (data.nick !== undefined) body.nick = data.nick;
    if (data.roles !== undefined) body.roles = data.roles;
    if (data.mute !== undefined) body.mute = data.mute;
    if (data.deaf !== undefined) body.deaf = data.deaf;
    if (data.channel_id !== undefined) body.channel_id = data.channel_id;
    if (data.communication_disabled_until !== undefined) {
      body.communication_disabled_until = data.communication_disabled_until?.toISOString() ?? null;
    }
    
    const result = await this.client.rest.request(
      'PATCH',
      `/guilds/${this.guild.id}/members/${id}`,
      body
    );
    
    return this._add(result);
  }

  /**
   * Add a role to a member
   */
  async addRole(memberId: string, roleId: string, reason?: string): Promise<void> {
    await this.client.rest.request(
      'PUT',
      `/guilds/${this.guild.id}/members/${memberId}/roles/${roleId}`,
      reason ? { reason } : undefined
    );
  }

  /**
   * Remove a role from a member
   */
  async removeRole(memberId: string, roleId: string, reason?: string): Promise<void> {
    await this.client.rest.request(
      'DELETE',
      `/guilds/${this.guild.id}/members/${memberId}/roles/${roleId}`,
      reason ? { reason } : undefined
    );
  }
}

export default GuildMemberManager;
