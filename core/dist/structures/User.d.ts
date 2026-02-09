import { APIUser } from '../types';
/**
 * Represents a user
 */
export declare class User {
    /** User ID */
    readonly id: string;
    /** Username */
    username: string;
    /** Display name */
    displayName?: string;
    /** Avatar URL */
    avatarURL?: string;
    /** Whether this is a bot */
    bot: boolean;
    constructor(data: APIUser);
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
     */
    _patch(data: Partial<APIUser>): void;
}
