/**
 * Sweepers - Automatic cache cleanup utilities
 */
import { Collection } from './Collection';
/**
 * Sweeper options for a specific cache
 */
export interface SweeperOptions {
    /** Interval in seconds between sweeps */
    interval: number;
    /** Filter function to determine what to sweep */
    filter: () => (value: any, key: string, collection: Collection<string, any>) => boolean;
}
/**
 * Global sweeper configuration
 */
export interface SweeperDefinitions {
    /** Sweep application commands */
    applicationCommands?: SweeperOptions;
    /** Sweep bans */
    bans?: SweeperOptions;
    /** Sweep emojis */
    emojis?: SweeperOptions;
    /** Sweep invites */
    invites?: SweeperOptions;
    /** Sweep guild members */
    guildMembers?: SweeperOptions;
    /** Sweep messages */
    messages?: SweeperOptions;
    /** Sweep presences */
    presences?: SweeperOptions;
    /** Sweep reactions */
    reactions?: SweeperOptions;
    /** Sweep stage instances */
    stageInstances?: SweeperOptions;
    /** Sweep stickers */
    stickers?: SweeperOptions;
    /** Sweep thread members */
    threadMembers?: SweeperOptions;
    /** Sweep threads */
    threads?: SweeperOptions;
    /** Sweep users */
    users?: SweeperOptions;
    /** Sweep voice states */
    voiceStates?: SweeperOptions;
}
/**
 * Sweeper filters - predefined filter functions
 */
export declare const Sweepers: {
    /**
     * Filter that sweeps items older than a certain lifetime
     */
    filterByLifetime<T extends {
        createdTimestamp?: number;
        createdAt?: Date;
    }>(options?: {
        lifetime?: number;
        getComparisonTimestamp?: (value: T) => number;
        excludeFromSweep?: (value: T) => boolean;
    }): () => (value: T) => boolean;
    /**
     * Filter that sweeps archived threads
     */
    archivedThreadSweepFilter(lifetime?: number): () => (thread: any) => boolean;
    /**
     * Filter that sweeps expired invites
     */
    expiredInviteSweepFilter(): () => (invite: any) => boolean;
    /**
     * Filter that sweeps outdated presences
     */
    outdatedPresenceSweepFilter(lifetime?: number): () => (presence: any) => boolean;
    /**
     * Filter that sweeps all items (use with caution)
     */
    sweepAll(): () => () => boolean;
    /**
     * Filter that sweeps nothing
     */
    sweepNone(): () => () => boolean;
};
/**
 * Sweeper manager class
 */
export declare class SweeperManager {
    private client;
    private intervals;
    private options;
    constructor(client: any, options?: SweeperDefinitions);
    /**
     * Start all configured sweepers
     */
    start(): void;
    /**
     * Start a specific sweeper
     */
    private startSweeper;
    /**
     * Stop a specific sweeper
     */
    stopSweeper(name: keyof SweeperDefinitions): void;
    /**
     * Stop all sweepers
     */
    stop(): void;
    /**
     * Manually trigger a sweep
     */
    sweep(name: keyof SweeperDefinitions, filter?: () => (value: any, key: string, collection: Collection<string, any>) => boolean): number;
    /**
     * Get the cache for a sweeper type
     */
    private getCache;
    /**
     * Get sweeper statistics
     */
    getStats(): Record<string, {
        interval: number;
        running: boolean;
    }>;
}
/**
 * Default sweeper options for common use cases
 */
export declare const DefaultSweeperOptions: SweeperDefinitions;
export default SweeperManager;
