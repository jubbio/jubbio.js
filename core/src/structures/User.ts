import { APIUser, APIEmbed } from '../types';
import type { Client } from '../Client';
import type { EmbedBuilder } from '../builders/EmbedBuilder';

/**
 * Options for sending a DM message
 */
export interface DMMessageOptions {
  content?: string;
  embeds?: (APIEmbed | EmbedBuilder)[];
  components?: any[];
  files?: Array<{ name: string; data: Buffer | string }>;
}

/**
 * Represents a user
 */
export class User {
  /** Reference to the client (optional for backward compatibility) */
  public readonly client?: Client;
  
  /** User ID */
  public readonly id: string;
  
  /** Username */
  public readonly username: string;
  
  /** Display name */
  public readonly displayName?: string;
  
  /** Avatar URL */
  public readonly avatarURL?: string;
  
  /** Whether this is a bot */
  public readonly bot: boolean;

  constructor(data: APIUser, client?: Client) {
    this.client = client;
    // Handle both string and number IDs (snowflake precision issue)
    this.id = String(data.id);
    this.username = data.username || `User_${this.id}`;
    this.displayName = data.display_name;
    this.avatarURL = data.avatar_url;
    this.bot = data.bot ?? false;
  }

  /**
   * Get the user's tag (username)
   */
  get tag(): string {
    return this.username;
  }

  /**
   * Get the default avatar URL
   */
  get defaultAvatarURL(): string {
    return `https://cdn.jubbio.com/embed/avatars/${parseInt(this.id) % 5}.png`;
  }

  /**
   * Get the display avatar URL
   */
  displayAvatarURL(): string {
    return this.avatarURL || this.defaultAvatarURL;
  }

  /**
   * Convert to string (mention format)
   */
  toString(): string {
    return `<@${this.id}>`;
  }

  /**
   * Update user data
   * Uses type assertion to allow updates to readonly properties
   */
  _patch(data: Partial<APIUser>): void {
    if (data.username !== undefined) (this as { username: string }).username = data.username;
    if (data.display_name !== undefined) (this as { displayName?: string }).displayName = data.display_name;
    if (data.avatar_url !== undefined) (this as { avatarURL?: string }).avatarURL = data.avatar_url;
    if (data.bot !== undefined) (this as { bot: boolean }).bot = data.bot;
  }

  /**
   * Send a direct message to this user
   * Requires client reference to be set
   * 
   * @example
   * await user.send({ content: 'Hello!' });
   * await user.send({ embeds: [embed] });
   * await user.send({ files: [{ name: 'test.txt', data: Buffer.from('hello') }] });
   */
  async send(options: string | DMMessageOptions): Promise<any> {
    if (!this.client) {
      throw new Error('Cannot send DM: User was created without client reference');
    }

    const content = typeof options === 'string' ? options : options.content;
    const rawEmbeds = typeof options === 'string' ? undefined : options.embeds;
    const rawComponents = typeof options === 'string' ? undefined : options.components;
    const files = typeof options === 'string' ? undefined : options.files;
    
    // Convert EmbedBuilder instances to plain objects
    const embeds = rawEmbeds?.map(e => 
      typeof (e as any).toJSON === 'function' ? (e as any).toJSON() : e
    );

    // Convert component builder instances to plain objects
    const components = rawComponents?.map(c =>
      typeof (c as any).toJSON === 'function' ? (c as any).toJSON() : c
    );

    // ponytail: use createDMMessageWithFile for file uploads, createDMMessage otherwise
    if (files && files.length > 0) {
      return this.client.rest.createDMMessageWithFile(this.id, { content, embeds, components }, files);
    }

    return this.client.rest.createDMMessage(this.id, { content, embeds, components });
  }
}
