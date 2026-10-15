/**
 * Collectors for awaiting messages, reactions, and interactions
 * API compatible with Discord.js Collectors
 */

import { EventEmitter } from 'events';
import { Collection } from './Collection';
import type { Message } from '../structures/Message';
import type { Interaction } from '../structures/Interaction';

export interface CollectorOptions<T> {
  /** How long to run the collector for in milliseconds */
  time?: number;
  /** How long to wait for the next item in milliseconds */
  idle?: number;
  /** Maximum number of items to collect */
  max?: number;
  /** Maximum number of items to process */
  maxProcessed?: number;
  /** Filter function */
  filter?: (item: T, collected: Collection<string, T>) => boolean | Promise<boolean>;
  /** Whether to dispose of items when the collector ends */
  dispose?: boolean;
}

export interface CollectorResetTimerOptions {
  time?: number;
  idle?: number;
}

/**
 * Abstract base class for collectors
 */
export abstract class Collector<K extends string, V> extends EventEmitter {
  /** The client that instantiated this collector */
  public readonly client: any;
  
  /** The items collected */
  public readonly collected: Collection<K, V> = new Collection();
  
  /** Whether the collector has ended */
  public ended = false;
  
  /** The reason the collector ended */
  public endReason: string | null = null;
  
  /** 
   * Filter function.
   * WARNING: Async filters may cause items to queue up if slow. 
   * For best performance, keep filters synchronous.
   */
  public filter: (item: V, collected: Collection<K, V>) => boolean | Promise<boolean>;
  
  /** Collector options */
  public options: CollectorOptions<V>;
  
  /** Number of items processed */
  private _processedCount = 0;
  
  /** Timeout for time limit */
  private _timeout: NodeJS.Timeout | null = null;
  
  /** Timeout for idle limit */
  private _idleTimeout: NodeJS.Timeout | null = null;

  constructor(client: any, options: CollectorOptions<V> = {}) {
    super();
    this.client = client;
    this.options = options;
    this.filter = (options.filter as any) ?? (() => true);
    
    this.handleCollect = this.handleCollect.bind(this);
    this.handleDispose = this.handleDispose.bind(this);
    
    if (options.time) {
      this._timeout = setTimeout(() => this.stop('time'), options.time);
    }
    if (options.idle) {
      this._idleTimeout = setTimeout(() => this.stop('idle'), options.idle);
    }
  }

  /**
   * Handle an item being collected
   */
  async handleCollect(item: V): Promise<void> {
    if (this.ended) return;
    
    this._processedCount++;
    
    const filterResult = await this.filter(item, this.collected);
    if (!filterResult) return;
    
    const key = this.collect(item);
    if (key === null) return;
    
    this.collected.set(key, item);
    this.emit('collect', item);
    
    // Reset idle timer
    if (this._idleTimeout) {
      clearTimeout(this._idleTimeout);
      this._idleTimeout = setTimeout(() => this.stop('idle'), this.options.idle!);
    }
    
    // Check limits
    if (this.options.max && this.collected.size >= this.options.max) {
      this.stop('limit');
    }
    if (this.options.maxProcessed && this._processedCount >= this.options.maxProcessed) {
      this.stop('processedLimit');
    }
  }

  /**
   * Handle an item being disposed
   */
  handleDispose(item: V): void {
    if (!this.options.dispose) return;
    
    const key = this.dispose(item);
    if (key === null) return;
    
    if (this.collected.has(key)) {
      this.collected.delete(key);
      this.emit('dispose', item);
    }
  }

  /**
   * Get the key for an item
   */
  abstract collect(item: V): K | null;

  /**
   * Get the key for disposing an item
   */
  abstract dispose(item: V): K | null;

  /**
   * Stop the collector
   */
  stop(reason = 'user'): void {
    if (this.ended) return;
    
    this.ended = true;
    this.endReason = reason;
    
    if (this._timeout) {
      clearTimeout(this._timeout);
      this._timeout = null;
    }
    if (this._idleTimeout) {
      clearTimeout(this._idleTimeout);
      this._idleTimeout = null;
    }
    
    this.emit('end', this.collected, reason);
  }

  /**
   * Reset the collector's timer
   */
  resetTimer(options: CollectorResetTimerOptions = {}): void {
    if (this._timeout) {
      clearTimeout(this._timeout);
      this._timeout = null;
    }
    if (this._idleTimeout) {
      clearTimeout(this._idleTimeout);
      this._idleTimeout = null;
    }
    
    if (options.time ?? this.options.time) {
      this._timeout = setTimeout(() => this.stop('time'), options.time ?? this.options.time);
    }
    if (options.idle ?? this.options.idle) {
      this._idleTimeout = setTimeout(() => this.stop('idle'), options.idle ?? this.options.idle);
    }
  }

  /**
   * Check the end conditions
   */
  checkEnd(): boolean {
    const reason = this.endReason;
    if (reason) {
      this.stop(reason);
      return true;
    }
    return false;
  }

  /**
   * Get the next item
   */
  get next(): Promise<V> {
    return new Promise((resolve, reject) => {
      if (this.ended) {
        reject(new Error('Collector has ended'));
        return;
      }
      
      const cleanup = () => {
        this.removeListener('collect', onCollect);
        this.removeListener('end', onEnd);
      };
      
      const onCollect = (item: V) => {
        cleanup();
        resolve(item);
      };
      
      const onEnd = () => {
        cleanup();
        reject(new Error('Collector ended'));
      };
      
      this.on('collect', onCollect);
      this.on('end', onEnd);
    });
  }
}

/**
 * Message collector options
 */
export interface MessageCollectorOptions extends CollectorOptions<Message> {
  /** Channel to collect messages from */
  channelId?: string;
}

/**
 * Collector for messages
 */
export class MessageCollector extends Collector<string, Message> {
  public readonly channelId: string;
  private readonly messageHandler: (message: Message) => void;

  constructor(client: unknown, channelId: string, options: MessageCollectorOptions = {}) {
    super(client, options);
    this.channelId = channelId;
    
    // Get bot's user ID to filter out bot's own messages
    const botUserId = (client as { user?: { id: string } }).user?.id;
    
    this.messageHandler = (message: Message) => {
      const messageChannelId = (message as { channel_id?: string; channelId?: string }).channel_id ?? message.channelId;
      if (messageChannelId === this.channelId) {
        // Automatically filter out bot's own messages
        const authorId = message.author?.id;
        if (botUserId && authorId === botUserId) return;
        
        // Also filter by application_id (bot messages have this)
        if ((message as { application_id?: string; applicationId?: string }).application_id || 
            (message as { applicationId?: string }).applicationId) return;
        
        this.handleCollect(message);
      }
    };
    
    (client as EventEmitter).on('messageCreate', this.messageHandler);
    
    this.once('end', () => {
      (client as EventEmitter).removeListener('messageCreate', this.messageHandler);
    });
  }

  collect(message: Message): string | null {
    return message.id ?? null;
  }

  dispose(message: Message): string | null {
    return message.id ?? null;
  }
}

/**
 * Interaction collector options
 */
export interface InteractionCollectorOptions extends CollectorOptions<Interaction> {
  /** Channel to collect interactions from */
  channelId?: string;
  /** Guild to collect interactions from */
  guildId?: string;
  /** Message to collect interactions from */
  messageId?: string;
  /** Interaction types to collect */
  interactionType?: number | number[];
  /** Component types to collect */
  componentType?: number | number[];
}

/**
 * Collector for interactions (buttons, select menus, etc.)
 */
export class InteractionCollector extends Collector<string, Interaction> {
  public readonly channelId?: string;
  public readonly guildId?: string;
  public readonly messageId?: string;
  public readonly interactionType?: number[];
  public readonly componentType?: number[];
  private readonly interactionHandler: (interaction: Interaction) => void;

  constructor(client: unknown, options: InteractionCollectorOptions = {}) {
    super(client, options);
    this.channelId = options.channelId;
    this.guildId = options.guildId;
    this.messageId = options.messageId;
    this.interactionType = options.interactionType 
      ? Array.isArray(options.interactionType) ? options.interactionType : [options.interactionType]
      : undefined;
    this.componentType = options.componentType
      ? Array.isArray(options.componentType) ? options.componentType : [options.componentType]
      : undefined;
    
    this.interactionHandler = (interaction: Interaction) => {
      // Filter by channel
      if (this.channelId && interaction.channelId !== this.channelId) return;
      // Filter by guild
      if (this.guildId && interaction.guildId !== this.guildId) return;
      // Filter by message
      if (this.messageId && (interaction as { message?: { id: string } }).message?.id !== this.messageId) return;
      // Filter by interaction type
      if (this.interactionType && !this.interactionType.includes(interaction.type)) return;
      // Filter by component type
      const componentType = (interaction as { componentType?: number }).componentType;
      if (this.componentType && componentType && !this.componentType.includes(componentType)) return;
      
      this.handleCollect(interaction);
    };
    
    (client as EventEmitter).on('interactionCreate', this.interactionHandler);
    
    this.once('end', () => {
      (client as EventEmitter).removeListener('interactionCreate', this.interactionHandler);
    });
  }

  collect(interaction: Interaction): string | null {
    return interaction.id ?? null;
  }

  dispose(interaction: Interaction): string | null {
    return interaction.id ?? null;
  }
}

/**
 * Reaction data structure
 */
export interface ReactionData {
  message_id?: string;
  messageId?: string;
  emoji?: { id?: string; name?: string };
}

/**
 * Reaction collector options
 */
export interface ReactionCollectorOptions extends CollectorOptions<ReactionData> {
  /** Message to collect reactions from */
  messageId: string;
}

/**
 * Collector for reactions
 */
export class ReactionCollector extends Collector<string, ReactionData> {
  public readonly messageId: string;
  private readonly reactionHandler: (reaction: ReactionData) => void;

  constructor(client: unknown, messageId: string, options: ReactionCollectorOptions) {
    super(client, options);
    this.messageId = messageId;
    
    this.reactionHandler = (reaction: ReactionData) => {
      if (reaction.message_id === this.messageId || reaction.messageId === this.messageId) {
        this.handleCollect(reaction);
      }
    };
    
    (client as EventEmitter).on('messageReactionAdd', this.reactionHandler);
    
    this.once('end', () => {
      (client as EventEmitter).removeListener('messageReactionAdd', this.reactionHandler);
    });
  }

  collect(reaction: ReactionData): string | null {
    // Key is emoji identifier
    return reaction.emoji?.id ?? reaction.emoji?.name ?? null;
  }

  dispose(reaction: ReactionData): string | null {
    return reaction.emoji?.id ?? reaction.emoji?.name ?? null;
  }
}

/**
 * Await messages helper
 */
export function awaitMessages(
  client: unknown,
  channelId: string,
  options: MessageCollectorOptions = {}
): Promise<Collection<string, Message>> {
  return new Promise((resolve, reject) => {
    const collector = new MessageCollector(client, channelId, options);
    
    collector.once('end', (collected, reason) => {
      if (options.max && collected.size < options.max) {
        reject(new Error(`Collector ended with reason: ${reason}`));
      } else {
        resolve(collected);
      }
    });
  });
}

/**
 * Await reactions helper
 */
export function awaitReactions(
  client: unknown,
  messageId: string,
  options: ReactionCollectorOptions
): Promise<Collection<string, ReactionData>> {
  return new Promise((resolve, reject) => {
    const collector = new ReactionCollector(client, messageId, options);
    
    collector.once('end', (collected, reason) => {
      if (options.max && collected.size < options.max) {
        reject(new Error(`Collector ended with reason: ${reason}`));
      } else {
        resolve(collected);
      }
    });
  });
}

export default Collector;
