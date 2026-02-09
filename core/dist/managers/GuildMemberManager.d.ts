/**
 * Manager for guild members with caching and lazy loading
 */
import { CachedManager } from './BaseManager';
import { Collection } from '../utils/Collection';
/**
 * Manages guild members
 */
export declare class GuildMemberManager extends CachedManager<string, any> {
    /** The guild this manager belongs to */
    readonly guild: any;
    constructor(guild: any, iterable?: Iterable<any>);
    /**
     * Add a member to the cache
     */
    _add(data: any, cache?: boolean): any;
    /**
     * Fetch a member from the API
     */
    fetch(id: string, options?: {
        cache?: boolean;
        force?: boolean;
    }): Promise<any>;
    /**
     * Fetch multiple members
     */
    fetchMany(options?: {
        limit?: number;
        after?: string;
        query?: string;
    }): Promise<Collection<string, any>>;
    /**
     * Search for members by query
     */
    search(options: {
        query: string;
        limit?: number;
    }): Promise<Collection<string, any>>;
    /**
     * Kick a member
     */
    kick(id: string, reason?: string): Promise<void>;
    /**
     * Ban a member
     */
    ban(id: string, options?: {
        deleteMessageDays?: number;
        reason?: string;
    }): Promise<void>;
    /**
     * Unban a user
     */
    unban(id: string, reason?: string): Promise<void>;
    /**
     * Edit a member
     */
    edit(id: string, data: {
        nick?: string | null;
        roles?: string[];
        mute?: boolean;
        deaf?: boolean;
        channel_id?: string | null;
        communication_disabled_until?: Date | null;
    }): Promise<any>;
    /**
     * Add a role to a member
     */
    addRole(memberId: string, roleId: string, reason?: string): Promise<void>;
    /**
     * Remove a role from a member
     */
    removeRole(memberId: string, roleId: string, reason?: string): Promise<void>;
}
export default GuildMemberManager;
