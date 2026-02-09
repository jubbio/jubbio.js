import { APIChannel, APIEmbed } from '../types';
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
export declare class BaseChannel {
    /** Reference to the client */
    readonly client: Client;
    /** Channel ID */
    readonly id: string;
    /** Channel type */
    readonly type: ChannelType;
    constructor(client: Client, data: APIChannel);
    /**
     * Check if this is a text-based channel
     */
    isTextBased(): this is TextChannel;
    /**
     * Check if this is a voice-based channel
     */
    isVoiceBased(): this is VoiceChannel;
    /**
     * Convert to string (mention format)
     */
    toString(): string;
}
/**
 * Text channel
 */
export declare class TextChannel extends BaseChannel {
    /** Guild ID */
    guildId?: string;
    /** Channel name */
    name?: string;
    /** Channel topic */
    topic?: string;
    /** Channel position */
    position?: number;
    /** Parent category ID */
    parentId?: string;
    constructor(client: Client, data: APIChannel);
    /**
     * Send a message to this channel
     */
    send(options: string | MessageCreateOptions): Promise<Message>;
    /**
     * Create a message collector
     */
    createMessageCollector(options?: MessageCollectorOptions): MessageCollector;
    /**
     * Await messages in this channel
     */
    awaitMessages(options?: AwaitMessagesOptions): Promise<Collection<string, Message>>;
    /**
     * Bulk delete messages
     */
    bulkDelete(messages: number | string[] | Collection<string, Message>, filterOld?: boolean): Promise<Collection<string, Message>>;
}
/**
 * Voice channel
 */
export declare class VoiceChannel extends BaseChannel {
    /** Guild ID */
    guildId?: string;
    /** Channel name */
    name?: string;
    /** Channel position */
    position?: number;
    /** Parent category ID */
    parentId?: string;
    /** User limit */
    userLimit?: number;
    /** Bitrate */
    bitrate?: number;
    constructor(client: Client, data: APIChannel & {
        user_limit?: number;
        bitrate?: number;
    });
    /**
     * Check if the channel is joinable
     */
    get joinable(): boolean;
}
/**
 * DM channel
 */
export declare class DMChannel extends BaseChannel {
    /** Recipient user ID */
    recipientId?: string;
    constructor(client: Client, data: APIChannel & {
        recipient_id?: string;
    });
    /**
     * Send a message to this DM
     */
    send(options: string | MessageCreateOptions): Promise<Message>;
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
export declare function createChannel(client: Client, data: APIChannel): BaseChannel;
