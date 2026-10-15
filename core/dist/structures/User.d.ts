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
    files?: Array<{
        name: string;
        data: Buffer | string;
    }>;
}
/**
 * Represents a user
 */
export declare class User {
    /** Reference to the client (optional for backward compatibility) */
    readonly client?: Client;
    /** User ID */
    readonly id: string;
    /** Username */
    readonly username: string;
    /** Display name */
    readonly displayName?: string;
    /** Avatar URL */
    readonly avatarURL?: string;
    /** Whether this is a bot */
    readonly bot: boolean;
    constructor(data: APIUser, client?: Client);
    /**
     * Get the user's tag (username)
     */
    get tag(): string;
    /**
     * Get the default avatar URL
     */
    get defaultAvatarURL(): string;
    /**
     * Get the display avatar URL
     */
    displayAvatarURL(): string;
    /**
     * Convert to string (mention format)
     */
    toString(): string;
    /**
     * Update user data
     * Uses type assertion to allow updates to readonly properties
     */
    _patch(data: Partial<APIUser>): void;
    /**
     * Send a direct message to this user
     * Requires client reference to be set
     *
     * @example
     * await user.send({ content: 'Hello!' });
     * await user.send({ embeds: [embed] });
     * await user.send({ files: [{ name: 'test.txt', data: Buffer.from('hello') }] });
     */
    send(options: string | DMMessageOptions): Promise<any>;
}
