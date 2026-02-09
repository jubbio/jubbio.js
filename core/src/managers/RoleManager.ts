/**
 * Manager for roles with caching and lazy loading
 */

import { CachedManager } from './BaseManager';
import { Collection } from '../utils/Collection';

/**
 * Manages roles for a guild
 */
export class RoleManager extends CachedManager<string, any> {
  /** The guild this manager belongs to */
  public readonly guild: any;

  constructor(guild: any, iterable?: Iterable<any>) {
    super(guild.client, Object as any, iterable);
    this.guild = guild;
  }

  /**
   * Get the @everyone role
   */
  get everyone(): any {
    return this.cache.get(this.guild.id) ?? null;
  }

  /**
   * Get the highest role
   */
  get highest(): any {
    return this.cache.reduce((prev, role) => 
      (role.position > (prev?.position ?? -1)) ? role : prev
    , null as any);
  }

  /**
   * Get the bot's highest role
   */
  get botRoleFor(): (userId: string) => any | null {
    return (userId: string) => {
      const member = this.guild.members?.cache.get(userId);
      if (!member) return null;
      return this.cache
        .filter((role: any) => member.roles?.includes(role.id))
        .sort((a: any, b: any) => b.position - a.position)
        .first() ?? null;
    };
  }

  /**
   * Add a role to the cache
   */
  _add(data: any, cache = true): any {
    const id = data.id;
    const existing = this.cache.get(id);
    
    if (existing) {
      if (cache) Object.assign(existing, data);
      return existing;
    }
    
    const role = {
      id,
      guildId: this.guild.id,
      name: data.name,
      color: data.color ?? 0,
      hoist: data.hoist ?? false,
      position: data.position ?? 0,
      permissions: data.permissions ?? '0',
      managed: data.managed ?? false,
      mentionable: data.mentionable ?? false,
      icon: data.icon ?? null,
      unicodeEmoji: data.unicode_emoji ?? null,
      tags: data.tags ?? null,
      
      get hexColor() {
        return `#${this.color.toString(16).padStart(6, '0')}`;
      },
      
      get createdAt() {
        const timestamp = BigInt(this.id) >> 22n;
        return new Date(Number(timestamp) + 1640995200000); // Jubbio epoch
      },
      
      toString() {
        return this.id === this.guildId ? '@everyone' : `<@&${this.id}>`;
      },
      
      comparePositionTo(role: any) {
        return this.position - (role?.position ?? 0);
      },
      
      async edit(data: any) {
        return this.guild.roles.edit(this.id, data);
      },
      
      async delete(reason?: string) {
        return this.guild.roles.delete(this.id, reason);
      },
      
      async setPosition(position: number) {
        return this.guild.roles.setPositions([{ role: this.id, position }]);
      },
    };
    
    if (cache) this.cache.set(id, role);
    return role;
  }

  /**
   * Fetch a role from the API
   */
  async fetch(id: string, options?: { cache?: boolean; force?: boolean }): Promise<any> {
    if (!options?.force) {
      const existing = this.cache.get(id);
      if (existing) return existing;
    }
    
    // Roles are fetched as part of guild, so fetch all
    const roles = await this.fetchAll();
    return roles.get(id) ?? null;
  }

  /**
   * Fetch all roles for the guild
   */
  async fetchAll(): Promise<Collection<string, any>> {
    const data = await this.client.rest.request('GET', `/guilds/${this.guild.id}/roles`);
    const roles = new Collection<string, any>();
    for (const roleData of data) {
      const role = this._add(roleData);
      roles.set(role.id, role);
    }
    return roles;
  }

  /**
   * Create a new role
   */
  async create(options?: {
    name?: string;
    color?: number | string;
    hoist?: boolean;
    position?: number;
    permissions?: string | bigint;
    mentionable?: boolean;
    icon?: string;
    unicodeEmoji?: string;
    reason?: string;
  }): Promise<any> {
    const body: any = {};
    if (options?.name) body.name = options.name;
    if (options?.color !== undefined) {
      body.color = typeof options.color === 'string' 
        ? parseInt(options.color.replace('#', ''), 16) 
        : options.color;
    }
    if (options?.hoist !== undefined) body.hoist = options.hoist;
    if (options?.permissions !== undefined) body.permissions = String(options.permissions);
    if (options?.mentionable !== undefined) body.mentionable = options.mentionable;
    if (options?.icon) body.icon = options.icon;
    if (options?.unicodeEmoji) body.unicode_emoji = options.unicodeEmoji;
    
    const data = await this.client.rest.request('POST', `/guilds/${this.guild.id}/roles`, body);
    const role = this._add(data);
    
    // Set position if specified
    if (options?.position !== undefined) {
      await this.setPositions([{ role: role.id, position: options.position }]);
    }
    
    return role;
  }

  /**
   * Delete a role
   */
  async delete(id: string, reason?: string): Promise<void> {
    await this.client.rest.request('DELETE', `/guilds/${this.guild.id}/roles/${id}`, 
      reason ? { reason } : undefined
    );
    this.cache.delete(id);
  }

  /**
   * Edit a role
   */
  async edit(id: string, data: {
    name?: string;
    color?: number | string;
    hoist?: boolean;
    position?: number;
    permissions?: string | bigint;
    mentionable?: boolean;
    icon?: string | null;
    unicodeEmoji?: string | null;
    reason?: string;
  }): Promise<any> {
    const body: any = {};
    if (data.name !== undefined) body.name = data.name;
    if (data.color !== undefined) {
      body.color = typeof data.color === 'string' 
        ? parseInt(data.color.replace('#', ''), 16) 
        : data.color;
    }
    if (data.hoist !== undefined) body.hoist = data.hoist;
    if (data.permissions !== undefined) body.permissions = String(data.permissions);
    if (data.mentionable !== undefined) body.mentionable = data.mentionable;
    if (data.icon !== undefined) body.icon = data.icon;
    if (data.unicodeEmoji !== undefined) body.unicode_emoji = data.unicodeEmoji;
    
    const result = await this.client.rest.request('PATCH', `/guilds/${this.guild.id}/roles/${id}`, body);
    return this._add(result);
  }

  /**
   * Set role positions
   */
  async setPositions(positions: Array<{ role: string; position: number }>): Promise<Collection<string, any>> {
    const body = positions.map(p => ({ id: p.role, position: p.position }));
    const data = await this.client.rest.request('PATCH', `/guilds/${this.guild.id}/roles`, body);
    
    const roles = new Collection<string, any>();
    for (const roleData of data) {
      const role = this._add(roleData);
      roles.set(role.id, role);
    }
    return roles;
  }

  /**
   * Compare two roles by position
   */
  comparePositions(role1: string | any, role2: string | any): number {
    const r1 = typeof role1 === 'string' ? this.cache.get(role1) : role1;
    const r2 = typeof role2 === 'string' ? this.cache.get(role2) : role2;
    return (r1?.position ?? 0) - (r2?.position ?? 0);
  }
}

export default RoleManager;
