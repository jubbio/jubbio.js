/**
 * Manager for roles with caching and lazy loading
 */
import { CachedManager } from './BaseManager';
import { Collection } from '../utils/Collection';
/**
 * Manages roles for a guild
 */
export declare class RoleManager extends CachedManager<string, any> {
    /** The guild this manager belongs to */
    readonly guild: any;
    constructor(guild: any, iterable?: Iterable<any>);
    /**
     * Get the @everyone role
     */
    get everyone(): any;
    /**
     * Get the highest role
     */
    get highest(): any;
    /**
     * Get the bot's highest role
     */
    get botRoleFor(): (userId: string) => any | null;
    /**
     * Add a role to the cache
     */
    _add(data: any, cache?: boolean): any;
    /**
     * Fetch a role from the API
     */
    fetch(id: string, options?: {
        cache?: boolean;
        force?: boolean;
    }): Promise<any>;
    /**
     * Fetch all roles for the guild
     */
    fetchAll(): Promise<Collection<string, any>>;
    /**
     * Create a new role
     */
    create(options?: {
        name?: string;
        color?: number | string;
        hoist?: boolean;
        position?: number;
        permissions?: string | bigint;
        mentionable?: boolean;
        icon?: string;
        unicodeEmoji?: string;
        reason?: string;
    }): Promise<any>;
    /**
     * Delete a role
     */
    delete(id: string, reason?: string): Promise<void>;
    /**
     * Edit a role
     */
    edit(id: string, data: {
        name?: string;
        color?: number | string;
        hoist?: boolean;
        position?: number;
        permissions?: string | bigint;
        mentionable?: boolean;
        icon?: string | null;
        unicodeEmoji?: string | null;
        reason?: string;
    }): Promise<any>;
    /**
     * Set role positions
     */
    setPositions(positions: Array<{
        role: string;
        position: number;
    }>): Promise<Collection<string, any>>;
    /**
     * Compare two roles by position
     */
    comparePositions(role1: string | any, role2: string | any): number;
}
export default RoleManager;
