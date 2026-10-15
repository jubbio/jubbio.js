import { APIMessage, APIEmbed, APIAttachment } from '../types';
import { User } from './User';
import { GuildMember } from './GuildMember';
import type { Client } from '../Client';
import type { MessageCreateOptions } from './Channel';
import { TextChannel } from './Channel';
import { Collection } from './Collection';
import { InteractionCollector, InteractionCollectorOptions } from '../utils/Collector';
import { EmbedBuilder } from '../builders/EmbedBuilder';
import { Embed } from './Embed';
import { serializeComponents, normalizeEmbeds } from '../utils/serialize';

/** Resolve EmbedBuilder instances to plain API objects */
function resolveEmbeds(embeds?: (APIEmbed | EmbedBuilder)[]): APIEmbed[] | undefined {
  if (!embeds) return undefined;
  return embeds.map(e => e instanceof EmbedBuilder ? e.toJSON() : e);
}

/** Normalize embed from backend to APIEmbed format */
function normalizeEmbed(embed: APIEmbed & { image?: { url: string } | string; thumbnail?: { url: string } | string }): APIEmbed {
  const normalized: APIEmbed = {
    title: embed.title,
    description: embed.description,
    url: embed.url,
    timestamp: embed.timestamp,
    color: embed.color,
    fields: embed.fields,
    author: embed.author,
    footer: embed.footer,
  };

  // Normalize thumbnail: string → nested object
  if (typeof embed.thumbnail === 'string') {
    normalized.thumbnail = { url: embed.thumbnail };
  } else if (embed.thumbnail && typeof embed.thumbnail === 'object') {
    normalized.thumbnail = embed.thumbnail;
  }

  // Normalize image: string → nested object
  if (typeof embed.image === 'string') {
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
 * Represents a reaction to a message
 * Discord.js compatible
 */
export class MessageReaction {
  /** The message this reaction belongs to */
  public readonly message: Message;

  /** The emoji identifier (unicode or custom format) */
  public readonly emoji: ReactionEmoji;

  /** Whether the bot reacted with this emoji */
  public me: boolean;

  /** Reaction count (if known) */
  public count: number;

  constructor(message: Message, emoji: string, me: boolean = false, count: number = 1) {
    this.message = message;
    this.emoji = new ReactionEmoji(emoji);
    this.me = me;
    this.count = count;
  }

  /**
   * Remove the bot's reaction
   * Discord.js compatible: reaction.remove()
   */
  async remove(): Promise<void> {
    const guildId = this.message.guildId || '';
    await this.message.client.rest.removeReaction(guildId, this.message.channelId, this.message.id, this.emoji.identifier);
    this.me = false;
  }

  /**
   * Convert to string
   */
  toString(): string {
    return this.emoji.toString();
  }
}

/**
 * Represents a reaction emoji
 * Discord.js compatible
 */
export class ReactionEmoji {
  /** Emoji name (for unicode: the character itself, for custom: the name) */
  public readonly name: string;

  /** Emoji ID (only for custom emojis) */
  public readonly id: string | null;

  /** Whether the emoji is animated (only for custom emojis) */
  public readonly animated: boolean;

  /** Raw identifier string */
  public readonly identifier: string;

  constructor(emoji: string) {
    this.identifier = emoji;

    // Parse custom emoji: <a:name:id> or <:name:id>
    const customMatch = emoji.match(/^<(a)?:(\w+):(\d+)>$/);
    if (customMatch) {
      this.animated = !!customMatch[1];
      this.name = customMatch[2];
      this.id = customMatch[3];
    } else if (emoji.startsWith(':') && emoji.endsWith(':')) {
      // :name: format
      this.animated = false;
      this.name = emoji.slice(1, -1);
      this.id = null;
    } else {
      // Unicode emoji
      this.animated = false;
      this.name = emoji;
      this.id = null;
    }
  }

  /**
   * Convert to string representation
   */
  toString(): string {
    if (this.id) {
      return this.animated ? `<a:${this.name}:${this.id}>` : `<:${this.name}:${this.id}>`;
    }
    return this.name;
  }
}

/**
 * Represents a message
 */
export class Message {
  /** Reference to the client */
  public readonly client: Client;
  
  /** Cached channel instance */
  private _channel?: TextChannel;
  
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
  
  /** Message creation timestamp (milliseconds since epoch) */
  public readonly createdTimestamp: number;
  
  /** Edit timestamp */
  public editedTimestamp?: number;
  
  /** Attachments */
  public attachments: APIAttachment[];
  
  /** Embeds */
  public embeds: Embed[];

  /** Components (buttons, select menus, etc.) */
  public components: any[];

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
    // ponytail: author may be missing in minimal message payloads (e.g., interaction.message)
    this.author = data.author ? new User(data.author, client) : new User({ id: '0', username: 'Unknown' }, client);
    this.content = data.content ?? '';
    
    // Handle different timestamp formats from backend
    const timestamp = data.timestamp || (data as any).created_at;
    this.createdTimestamp = timestamp ? new Date(timestamp).getTime() : Date.now();
    
    const editedTimestamp = data.edited_timestamp || (data as any).updated_at;
    this.editedTimestamp = editedTimestamp ? new Date(editedTimestamp).getTime() : undefined;
    
    this.attachments = data.attachments || [];
    
    // Normalize embeds from backend (flat format → nested format) and wrap in Embed class
    this.embeds = data.embeds ? data.embeds.map(e => new Embed(normalizeEmbed(e))) : [];
    
    // Components (ActionRows with buttons, select menus, etc.)
    this.components = (data as any).components || [];
    
    this.mentions = (data as any).mentions || {};
    this.user_id = (data as any).user_id;
  }

  /**
   * The channel this message was sent in
   * ponytail: refactored - artık TextChannel instance döndürüyor, DRY
   * Caches the TextChannel instance for performance
   */
  get channel(): TextChannel {
    // Return cached channel if available
    if (this._channel) return this._channel;
    
    // Guild cache'den channel data al
    const channelData = this.guildId 
      ? this.client.guilds.get(this.guildId)?.channels.get(this.channelId)
      : undefined;
    
    // TextChannel oluştur - cache'deki data veya minimal data ile
    this._channel = new TextChannel(this.client, {
      id: this.channelId,
      guild_id: this.guildId,
      type: 0, // GuildText
      name: (channelData as any)?.name,
      topic: (channelData as any)?.topic,
      position: (channelData as any)?.position,
      parent_id: (channelData as any)?.parent_id,
    });
    
    return this._channel;
  }

  /**
   * Get the creation date
   */
  get createdAt(): Date {
    return new Date(this.createdTimestamp);
  }

  /**
   * The guild this message was sent in (if in a guild)
   * Discord.js compatible: message.guild
   */
  get guild() {
    if (!this.guildId) return null;
    return this.client.guilds.get(this.guildId) ?? null;
  }

  /**
   * Get the edit date
   */
  get editedAt(): Date | null {
    return this.editedTimestamp ? new Date(this.editedTimestamp) : null;
  }

  /**
   * Reply to this message
   * ponytail: Bug #8 fix - embed tekil, Bug #10 fix - flags desteği
   */
  async reply(options: string | MessageCreateOptions): Promise<Message> {
    const content = typeof options === 'string' ? options : options.content;
    // ponytail: Bug #8 fix - embed tekil kullanımı
    const rawEmbeds = typeof options === 'string' 
      ? undefined 
      : (options.embeds || (options.embed ? [options.embed] : undefined));
    const embeds = resolveEmbeds(rawEmbeds);
    const components = typeof options === 'string' ? undefined : serializeComponents(options.components);
    const flags = typeof options === 'string' ? undefined : options.flags;
    
    const data = await this.client.rest.createMessage(this.guildId || '', this.channelId, {
      content,
      embeds,
      components,
      flags,
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
    const components = typeof options === 'string' ? undefined : serializeComponents(options.components);
    
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
   * React to this message with an emoji
   * Discord.js compatible: message.react('👍')
   * 
   * @param emoji - Unicode emoji (👍), :name:, <:name:id>, or <a:name:id> format
   * @returns MessageReaction object for chaining
   * 
   * @example
   * // React with unicode emoji
   * await message.react('👍');
   * 
   * // React with custom emoji
   * await message.react('<:custom:123456789>');
   * 
   * // Chain multiple reactions
   * await message.react('👍');
   * await message.react('❤️');
   */
  async react(emoji: string): Promise<MessageReaction> {
    await this.client.rest.addReaction(this.guildId || '', this.channelId, this.id, emoji);
    return new MessageReaction(this, emoji, true);
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
