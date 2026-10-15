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
export declare abstract class Collector<K extends string, V> extends EventEmitter {
    /** The client that instantiated this collector */
    readonly client: any;
    /** The items collected */
    readonly collected: Collection<K, V>;
    /** Whether the collector has ended */
    ended: boolean;
    /** The reason the collector ended */
    endReason: string | null;
    /**
     * Filter function.
     * WARNING: Async filters may cause items to queue up if slow.
     * For best performance, keep filters synchronous.
     */
    filter: (item: V, collected: Collection<K, V>) => boolean | Promise<boolean>;
    /** Collector options */
    options: CollectorOptions<V>;
    /** Number of items processed */
    private _processedCount;
    /** Timeout for time limit */
    private _timeout;
    /** Timeout for idle limit */
    private _idleTimeout;
    constructor(client: any, options?: CollectorOptions<V>);
    /**
     * Handle an item being collected
     */
    handleCollect(item: V): Promise<void>;
    /**
     * Handle an item being disposed
     */
    handleDispose(item: V): void;
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
    stop(reason?: string): void;
    /**
     * Reset the collector's timer
     */
    resetTimer(options?: CollectorResetTimerOptions): void;
    /**
     * Check the end conditions
     */
    checkEnd(): boolean;
    /**
     * Get the next item
     */
    get next(): Promise<V>;
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
export declare class MessageCollector extends Collector<string, Message> {
    readonly channelId: string;
    private readonly messageHandler;
    constructor(client: unknown, channelId: string, options?: MessageCollectorOptions);
    collect(message: Message): string | null;
    dispose(message: Message): string | null;
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
export declare class InteractionCollector extends Collector<string, Interaction> {
    readonly channelId?: string;
    readonly guildId?: string;
    readonly messageId?: string;
    readonly interactionType?: number[];
    readonly componentType?: number[];
    private readonly interactionHandler;
    constructor(client: unknown, options?: InteractionCollectorOptions);
    collect(interaction: Interaction): string | null;
    dispose(interaction: Interaction): string | null;
}
/**
 * Reaction data structure
 */
export interface ReactionData {
    message_id?: string;
    messageId?: string;
    emoji?: {
        id?: string;
        name?: string;
    };
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
export declare class ReactionCollector extends Collector<string, ReactionData> {
    readonly messageId: string;
    private readonly reactionHandler;
    constructor(client: unknown, messageId: string, options: ReactionCollectorOptions);
    collect(reaction: ReactionData): string | null;
    dispose(reaction: ReactionData): string | null;
}
/**
 * Await messages helper
 */
export declare function awaitMessages(client: unknown, channelId: string, options?: MessageCollectorOptions): Promise<Collection<string, Message>>;
/**
 * Await reactions helper
 */
export declare function awaitReactions(client: unknown, messageId: string, options: ReactionCollectorOptions): Promise<Collection<string, ReactionData>>;
export default Collector;
