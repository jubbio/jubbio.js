import { APIMessage, APIEmbed, APIAttachment } from '../types';
import { User } from './User';
import type { Client } from '../Client';
import type { MessageCreateOptions } from './Channel';
import { InteractionCollector, InteractionCollectorOptions } from '../utils/Collector';
/**
 * Mention data from backend
 */
export interface MessageMentions {
    users?: Array<{
        id: number | string;
        username: string;
    }>;
    roles?: Array<{
        id: string;
        name?: string;
    }>;
    everyone?: boolean;
}
/**
 * Represents a message
 */
export declare class Message {
    /** Reference to the client */
    readonly client: Client;
    /** Message ID */
    readonly id: string;
    /** Channel ID */
    readonly channelId: string;
    /** Guild ID (if in a guild) */
    readonly guildId?: string;
    /** Message author */
    readonly author: User;
    /** Message content */
    content: string;
    /** Message timestamp */
    readonly createdTimestamp: number;
    /** Edit timestamp */
    editedTimestamp?: number;
    /** Attachments */
    attachments: APIAttachment[];
    /** Embeds */
    embeds: APIEmbed[];
    /** Mentions in the message */
    mentions: MessageMentions;
    /** User ID (from backend) */
    user_id?: number;
    constructor(client: Client, data: APIMessage);
    /**
     * Get the creation date
     */
    get createdAt(): Date;
    /**
     * Get the edit date
     */
    get editedAt(): Date | null;
    /**
     * Reply to this message
     */
    reply(options: string | MessageCreateOptions): Promise<Message>;
    /**
     * Edit this message (only if author is the bot)
     */
    edit(options: string | MessageCreateOptions): Promise<Message>;
    /**
     * Delete this message
     */
    delete(): Promise<void>;
    /**
     * React to this message
     */
    react(emoji: string): Promise<void>;
    /**
     * Pin this message
     */
    pin(): Promise<void>;
    /**
     * Unpin this message
     */
    unpin(): Promise<void>;
    /**
     * Create a component interaction collector on this message
     */
    createMessageComponentCollector(options?: Omit<InteractionCollectorOptions, 'messageId'>): InteractionCollector;
    /**
     * Await component interactions on this message
     */
    awaitMessageComponent(options?: Omit<InteractionCollectorOptions, 'messageId' | 'max'>): Promise<any>;
    /**
     * Convert to string
     */
    toString(): string;
}
