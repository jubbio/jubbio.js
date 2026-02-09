import { APIMessage, APIEmbed, APIAttachment } from '../types';
import { User } from './User';
import type { Client } from '../Client';
import type { MessageCreateOptions } from './Channel';
import { Collection } from './Collection';
import { InteractionCollector, InteractionCollectorOptions } from '../utils/Collector';

/**
 * Mention data from backend
 */
export interface MessageMentions {
  users?: Array<{ id: number | string; username: string }>;
  roles?: Array<{ id: string; name?: string }>;
  everyone?: boolean;
}

/**
 * Represents a message
 */
export class Message {
  /** Reference to the client */
  public readonly client: Client;
  
  /** Message ID */
  public readonly id: string;
  
  /** Channel ID */
  public readonly channelId: string;
  
  /** Guild ID (if in a guild) */
  public readonly guildId?: string;
  
  /** Message author */
  public readonly author: User;
  
  /** Message content */
  public content: string;
  
  /** Message timestamp */
  public readonly createdTimestamp: number;
  
  /** Edit timestamp */
  public editedTimestamp?: number;
  
  /** Attachments */
  public attachments: APIAttachment[];
  
  /** Embeds */
  public embeds: APIEmbed[];

  /** Mentions in the message */
  public mentions: MessageMentions;

  /** User ID (from backend) */
  public user_id?: number;

  constructor(client: Client, data: APIMessage) {
    this.client = client;
    this.id = data.id;
    this.channelId = data.channel_id;
    this.guildId = data.guild_id;
    this.author = new User(data.author);
    this.content = data.content;
    this.createdTimestamp = new Date(data.timestamp).getTime();
    this.editedTimestamp = data.edited_timestamp ? new Date(data.edited_timestamp).getTime() : undefined;
    this.attachments = data.attachments || [];
    this.embeds = data.embeds || [];
    this.mentions = (data as any).mentions || {};
    this.user_id = (data as any).user_id;
  }

  /**
   * Get the creation date
   */
  get createdAt(): Date {
    return new Date(this.createdTimestamp);
  }

  /**
   * Get the edit date
   */
  get editedAt(): Date | null {
    return this.editedTimestamp ? new Date(this.editedTimestamp) : null;
  }

  /**
   * Reply to this message
   */
  async reply(options: string | MessageCreateOptions): Promise<Message> {
    const content = typeof options === 'string' ? options : options.content;
    const embeds = typeof options === 'string' ? undefined : options.embeds;
    
    const data = await this.client.rest.createMessage(this.guildId || '', this.channelId, {
      content,
      embeds,
      message_reference: { message_id: this.id }
    });
    
    return new Message(this.client, data);
  }

  /**
   * Edit this message (only if author is the bot)
   */
  async edit(options: string | MessageCreateOptions): Promise<Message> {
    const content = typeof options === 'string' ? options : options.content;
    const embeds = typeof options === 'string' ? undefined : options.embeds;
    
    const data = await this.client.rest.editMessage(this.guildId || '', this.channelId, this.id, {
      content,
      embeds
    });
    
    return new Message(this.client, data);
  }

  /**
   * Delete this message
   */
  async delete(): Promise<void> {
    await this.client.rest.deleteMessage(this.guildId || '', this.channelId, this.id);
  }

  /**
   * React to this message
   */
  async react(emoji: string): Promise<void> {
    await this.client.rest.addReaction(this.guildId || '', this.channelId, this.id, emoji);
  }

  /**
   * Pin this message
   */
  async pin(): Promise<void> {
    await this.client.rest.pinMessage(this.guildId || '', this.channelId, this.id);
  }

  /**
   * Unpin this message
   */
  async unpin(): Promise<void> {
    await this.client.rest.unpinMessage(this.guildId || '', this.channelId, this.id);
  }

  /**
   * Create a component interaction collector on this message
   */
  createMessageComponentCollector(options?: Omit<InteractionCollectorOptions, 'messageId'>): InteractionCollector {
    return new InteractionCollector(this.client, {
      ...options,
      messageId: this.id,
      channelId: this.channelId,
      guildId: this.guildId,
    });
  }

  /**
   * Await component interactions on this message
   */
  awaitMessageComponent(options?: Omit<InteractionCollectorOptions, 'messageId' | 'max'>): Promise<any> {
    return new Promise((resolve, reject) => {
      const collector = this.createMessageComponentCollector({ ...options, max: 1 });
      
      collector.once('end', (collected, reason) => {
        const first = collected.first();
        if (first) {
          resolve(first);
        } else {
          reject(new Error(reason || 'No interaction received'));
        }
      });
    });
  }

  /**
   * Convert to string
   */
  toString(): string {
    return this.content;
  }
}
