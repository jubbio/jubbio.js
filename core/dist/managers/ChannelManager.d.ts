/**
 * Manager for channels with caching and lazy loading
 */
import { CachedManager } from './BaseManager';
import { Collection } from '../utils/Collection';
/** Channel types */
export declare enum ChannelType {
    GuildText = 0,
    DM = 1,
    GuildVoice = 2,
    GroupDM = 3,
    GuildCategory = 4,
    GuildAnnouncement = 5,
    AnnouncementThread = 10,
    PublicThread = 11,
    PrivateThread = 12,
    GuildStageVoice = 13,
    GuildDirectory = 14,
    GuildForum = 15
}
/**
 * Manages channels for a guild
 */
export declare class GuildChannelManager extends CachedManager<string, any> {
    /** The guild this manager belongs to */
    readonly guild: any;
    constructor(guild: any, iterable?: Iterable<any>);
    /**
     * Add a channel to the cache
     */
    _add(data: any, cache?: boolean): any;
    /**
     * Fetch a channel from the API
     */
    fetch(id: string, options?: {
        cache?: boolean;
        force?: boolean;
    }): Promise<any>;
    /**
     * Fetch all channels for the guild
     */
    fetchAll(): Promise<Collection<string, any>>;
    /**
     * Create a new channel
     */
    create(options: {
        name: string;
        type?: ChannelType;
        topic?: string;
        bitrate?: number;
        userLimit?: number;
        rateLimitPerUser?: number;
        position?: number;
        permissionOverwrites?: any[];
        parent?: string;
        nsfw?: boolean;
        reason?: string;
    }): Promise<any>;
    /**
     * Delete a channel
     */
    delete(id: string, reason?: string): Promise<void>;
    /**
     * Edit a channel
     */
    edit(id: string, data: {
        name?: string;
        type?: ChannelType;
        position?: number;
        topic?: string;
        nsfw?: boolean;
        rateLimitPerUser?: number;
        bitrate?: number;
        userLimit?: number;
        permissionOverwrites?: any[];
        parent?: string | null;
    }): Promise<any>;
    /**
     * Set channel positions
     */
    setPositions(positions: Array<{
        channel: string;
        position: number;
        parent?: string | null;
    }>): Promise<void>;
}
/**
 * Global channel manager for the client
 */
export declare class ChannelManager extends CachedManager<string, any> {
    constructor(client: any, iterable?: Iterable<any>);
    _add(data: any, cache?: boolean): any;
    fetch(id: string, options?: {
        cache?: boolean;
        force?: boolean;
    }): Promise<any>;
}
export default GuildChannelManager;
