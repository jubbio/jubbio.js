import { APIMessage, APIAttachment } from '../types';
import { User } from './User';
import { GuildMember } from './GuildMember';
import type { Client } from '../Client';
import type { MessageCreateOptions } from './Channel';
import { TextChannel } from './Channel';
import { InteractionCollector, InteractionCollectorOptions } from '../utils/Collector';
import { Embed } from './Embed';
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
 * Represents a reaction to a message
 * Discord.js compatible
 */
export declare class MessageReaction {
    /** The message this reaction belongs to */
    readonly message: Message;
    /** The emoji identifier (unicode or custom format) */
    readonly emoji: ReactionEmoji;
    /** Whether the bot reacted with this emoji */
    me: boolean;
    /** Reaction count (if known) */
    count: number;
    constructor(message: Message, emoji: string, me?: boolean, count?: number);
    /**
     * Remove the bot's reaction
     * Discord.js compatible: reaction.remove()
     */
    remove(): Promise<void>;
    /**
     * Convert to string
     */
    toString(): string;
}
/**
 * Represents a reaction emoji
 * Discord.js compatible
 */
export declare class ReactionEmoji {
    /** Emoji name (for unicode: the character itself, for custom: the name) */
    readonly name: string;
    /** Emoji ID (only for custom emojis) */
    readonly id: string | null;
    /** Whether the emoji is animated (only for custom emojis) */
    readonly animated: boolean;
    /** Raw identifier string */
    readonly identifier: string;
    constructor(emoji: string);
    /**
     * Convert to string representation
     */
    toString(): string;
}
/**
 * Represents a message
 */
export declare class Message {
    /** Reference to the client */
    readonly client: Client;
    /** Cached channel instance */
    private _channel?;
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
    /** Message creation timestamp (milliseconds since epoch) */
    readonly createdTimestamp: number;
    /** Edit timestamp */
    editedTimestamp?: number;
    /** Attachments */
    attachments: APIAttachment[];
    /** Embeds */
    embeds: Embed[];
    /** Components (buttons, select menus, etc.) */
    components: any[];
    /** Mentions in the message */
    mentions: MessageMentions;
    /** User ID (from backend) */
    user_id?: number;
    /** Guild member (if in a guild) */
    member?: GuildMember;
    constructor(client: Client, data: APIMessage);
    /**
     * The channel this message was sent in
     * ponytail: refactored - artık TextChannel instance döndürüyor, DRY
     * Caches the TextChannel instance for performance
     */
    get channel(): TextChannel;
    /**
     * Get the creation date
     */
    get createdAt(): Date;
    /**
     * The guild this message was sent in (if in a guild)
     * Discord.js compatible: message.guild
     */
    get guild(): import("./Guild").Guild | null;
    /**
     * Get the edit date
     */
    get editedAt(): Date | null;
    /**
     * Reply to this message
     * ponytail: Bug #8 fix - embed tekil, Bug #10 fix - flags desteği
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
    react(emoji: string): Promise<MessageReaction>;
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
