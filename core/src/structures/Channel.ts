import { APIChannel, APIMessage, APIEmbed } from '../types';
import { ChannelType } from '../enums';
import type { Client } from '../Client';
import { Message } from './Message';
import { Collection } from './Collection';
import { MessageCollector, MessageCollectorOptions } from '../utils/Collector';

/**
 * Await messages options
 */
export interface AwaitMessagesOptions extends MessageCollectorOptions {
  /** Errors to reject on */
  errors?: string[];
}

/**
 * Base channel class
 */
export class BaseChannel {
  /** Reference to the client */
  public readonly client: Client;
  
  /** Channel ID */
  public readonly id: string;
  
  /** Channel type */
  public readonly type: ChannelType;

  constructor(client: Client, data: APIChannel) {
    this.client = client;
    this.id = data.id;
    this.type = data.type;
  }

  /**
   * Check if this is a text-based channel
   */
  isTextBased(): this is TextChannel {
    return [
      ChannelType.GuildText,
      ChannelType.DM,
      ChannelType.GroupDM,
      ChannelType.GuildAnnouncement
    ].includes(this.type);
  }

  /**
   * Check if this is a voice-based channel
   */
  isVoiceBased(): this is VoiceChannel {
    return [
      ChannelType.GuildVoice,
      ChannelType.GuildStageVoice
    ].includes(this.type);
  }

  /**
   * Convert to string (mention format)
   */
  toString(): string {
    return `<#${this.id}>`;
  }
}

/**
 * Text channel
 */
export class TextChannel extends BaseChannel {
  /** Guild ID */
  public guildId?: string;
  
  /** Channel name */
  public name?: string;
  
  /** Channel topic */
  public topic?: string;
  
  /** Channel position */
  public position?: number;
  
  /** Parent category ID */
  public parentId?: string;

  constructor(client: Client, data: APIChannel) {
    super(client, data);
    this.guildId = data.guild_id;
    this.name = data.name;
    this.topic = data.topic;
    this.position = data.position;
    this.parentId = data.parent_id;
  }

  /**
   * Send a message to this channel
   */
  async send(options: string | MessageCreateOptions): Promise<Message> {
    const content = typeof options === 'string' ? options : options.content;
    const embeds = typeof options === 'string' ? undefined : options.embeds;
    
    const data = await this.client.rest.createMessage(this.guildId || '', this.id, {
      content,
      embeds
    });
    
    return new Message(this.client, data);
  }

  /**
   * Create a message collector
   */
  createMessageCollector(options?: MessageCollectorOptions): MessageCollector {
    return new MessageCollector(this.client, this.id, options);
  }

  /**
   * Await messages in this channel
   */
  awaitMessages(options?: AwaitMessagesOptions): Promise<Collection<string, Message>> {
    return new Promise((resolve, reject) => {
      const collector = this.createMessageCollector(options);
      
      collector.once('end', (collected, reason) => {
        if (options?.errors?.includes(reason)) {
          reject(collected);
        } else {
          resolve(collected);
        }
      });
    });
  }

  /**
   * Bulk delete messages
   */
  async bulkDelete(messages: number | string[] | Collection<string, Message>, filterOld = true): Promise<Collection<string, Message>> {
    let messageIds: string[];
    
    if (typeof messages === 'number') {
      // Fetch messages first
      const fetched = await this.client.rest.getMessages(this.guildId || '', this.id, { limit: messages });
      messageIds = fetched.map(m => m.id);
    } else if (messages instanceof Collection) {
      messageIds = [...messages.keys()];
    } else {
      messageIds = messages;
    }

    // Filter old messages (older than 14 days)
    if (filterOld) {
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      messageIds = messageIds.filter(id => {
        // Extract timestamp from snowflake
        const timestamp = Number(BigInt(id) >> 22n) + 1420070400000;
        return timestamp > twoWeeksAgo;
      });
    }

    if (messageIds.length === 0) {
      return new Collection();
    }

    if (messageIds.length === 1) {
      await this.client.rest.deleteMessage(this.guildId || '', this.id, messageIds[0]);
    } else {
      await this.client.rest.bulkDeleteMessages(this.guildId || '', this.id, messageIds);
    }

    // Return deleted messages as collection
    const deleted = new Collection<string, Message>();
    // Note: We don't have the actual message objects here
    return deleted;
  }
}

/**
 * Voice channel
 */
export class VoiceChannel extends BaseChannel {
  /** Guild ID */
  public guildId?: string;
  
  /** Channel name */
  public name?: string;
  
  /** Channel position */
  public position?: number;
  
  /** Parent category ID */
  public parentId?: string;
  
  /** User limit */
  public userLimit?: number;
  
  /** Bitrate */
  public bitrate?: number;

  constructor(client: Client, data: APIChannel & { user_limit?: number; bitrate?: number }) {
    super(client, data);
    this.guildId = data.guild_id;
    this.name = data.name;
    this.position = data.position;
    this.parentId = data.parent_id;
    this.userLimit = data.user_limit;
    this.bitrate = data.bitrate;
  }

  /**
   * Check if the channel is joinable
   */
  get joinable(): boolean {
    // TODO: Check permissions
    return true;
  }
}

/**
 * DM channel
 */
export class DMChannel extends BaseChannel {
  /** Recipient user ID */
  public recipientId?: string;

  constructor(client: Client, data: APIChannel & { recipient_id?: string }) {
    super(client, data);
    this.recipientId = data.recipient_id;
  }

  /**
   * Send a message to this DM
   */
  async send(options: string | MessageCreateOptions): Promise<Message> {
    const content = typeof options === 'string' ? options : options.content;
    const embeds = typeof options === 'string' ? undefined : options.embeds;
    
    const data = await this.client.rest.createDMMessage(this.id, {
      content,
      embeds
    });
    
    return new Message(this.client, data);
  }
}

/**
 * Message create options
 */
export interface MessageCreateOptions {
  content?: string;
  embeds?: APIEmbed[];
  files?: any[];
}

/**
 * Create appropriate channel class based on type
 */
export function createChannel(client: Client, data: APIChannel): BaseChannel {
  switch (data.type) {
    case ChannelType.GuildText:
    case ChannelType.GuildAnnouncement:
      return new TextChannel(client, data);
    case ChannelType.GuildVoice:
    case ChannelType.GuildStageVoice:
      return new VoiceChannel(client, data);
    case ChannelType.DM:
      return new DMChannel(client, data);
    default:
      return new BaseChannel(client, data);
  }
}
