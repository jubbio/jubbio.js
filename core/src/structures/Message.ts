import { APIMessage, APIEmbed, APIAttachment } from '../types';
import { User } from './User';
import { GuildMember } from './GuildMember';
import type { Client } from '../Client';
import type { MessageCreateOptions } from './Channel';
import { Collection } from './Collection';
import { InteractionCollector, InteractionCollectorOptions } from '../utils/Collector';
import { EmbedBuilder } from '../builders/EmbedBuilder';

/** Backend flat embed format (for normalization) */
interface BackendFlatEmbed {
  title?: string;
  description?: string;
  url?: string;
  timestamp?: string;
  color?: number;
  // Flat author fields
  author_name?: string;
  author_url?: string;
  author_icon_url?: string;
  // Flat footer fields
  footer_text?: string;
  footer_icon_url?: string;
  // Flat thumbnail/image fields
  thumbnail_url?: string;
  image_url?: string;
  // Or nested format
  author?: { name: string; url?: string; icon_url?: string };
  footer?: { text: string; icon_url?: string };
  image?: { url: string } | string;
  thumbnail?: { url: string } | string;
  fields?: { name: string; value: string; inline?: boolean }[];
}

/** Resolve EmbedBuilder instances to plain API objects */
function resolveEmbeds(embeds?: (APIEmbed | EmbedBuilder)[]): APIEmbed[] | undefined {
  if (!embeds) return undefined;
  return embeds.map(e => e instanceof EmbedBuilder ? e.toJSON() : e);
}

/** Normalize flat embed format from backend to nested format */
function normalizeEmbed(embed: BackendFlatEmbed): APIEmbed {
  const normalized: APIEmbed = {
    title: embed.title,
    description: embed.description,
    url: embed.url,
    timestamp: embed.timestamp,
    color: embed.color,
    fields: embed.fields,
  };

  // Normalize author: flat format → nested object
  if (embed.author_name || embed.author_icon_url || embed.author_url) {
    normalized.author = {
      name: embed.author_name || '',
      icon_url: embed.author_icon_url,
      url: embed.author_url,
    };
  } else if (embed.author) {
    normalized.author = embed.author;
  }

  // Normalize footer: flat format → nested object
  if (embed.footer_text || embed.footer_icon_url) {
    normalized.footer = {
      text: embed.footer_text || '',
      icon_url: embed.footer_icon_url,
    };
  } else if (embed.footer) {
    normalized.footer = embed.footer;
  }

  // Normalize thumbnail: flat format or string → nested object
  if (embed.thumbnail_url) {
    normalized.thumbnail = { url: embed.thumbnail_url };
  } else if (typeof embed.thumbnail === 'string') {
    normalized.thumbnail = { url: embed.thumbnail };
  } else if (embed.thumbnail && typeof embed.thumbnail === 'object') {
    normalized.thumbnail = embed.thumbnail;
  }

  // Normalize image: flat format or string → nested object
  if (embed.image_url) {
    normalized.image = { url: embed.image_url };
  } else if (typeof embed.image === 'string') {
    normalized.image = { url: embed.image };
  } else if (embed.image && typeof embed.image === 'object') {
    normalized.image = embed.image;
  }

  return normalized;
}

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

  /** Guild member (if in a guild) */
  public member?: GuildMember;

  constructor(client: Client, data: APIMessage) {
    this.client = client;
    this.id = data.id;
    this.channelId = data.channel_id;
    this.guildId = data.guild_id;
    this.author = new User(data.author);
    this.content = data.content ?? '';
    
    // Handle different timestamp formats from backend
    const timestamp = data.timestamp || (data as any).created_at;
    this.createdTimestamp = timestamp ? new Date(timestamp).getTime() : Date.now();
    
    const editedTimestamp = data.edited_timestamp || (data as any).updated_at;
    this.editedTimestamp = editedTimestamp ? new Date(editedTimestamp).getTime() : undefined;
    
    this.attachments = data.attachments || [];
    
    // Normalize embeds from backend (flat format → nested format)
    this.embeds = data.embeds ? data.embeds.map(normalizeEmbed) : [];
    
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
    const embeds = typeof options === 'string' ? undefined : resolveEmbeds(options.embeds);
    const components = typeof options === 'string' ? undefined : options.components;
    
    const data = await this.client.rest.createMessage(this.guildId || '', this.channelId, {
      content,
      embeds,
      components,
      message_reference: { message_id: this.id }
    });
    
    return new Message(this.client, data);
  }

  /**
   * Edit this message (only if author is the bot)
   */
  async edit(options: string | MessageCreateOptions): Promise<Message> {
    const content = typeof options === 'string' ? options : options.content;
    const embeds = typeof options === 'string' ? undefined : resolveEmbeds(options.embeds);
    const components = typeof options === 'string' ? undefined : options.components;
    
    const data = await this.client.rest.editMessage(this.guildId || '', this.channelId, this.id, {
      content,
      embeds,
      components,
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
