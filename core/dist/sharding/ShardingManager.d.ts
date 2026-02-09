/**
 * ShardingManager - Multi-process bot support
 */
import { EventEmitter } from 'events';
import { ChildProcess } from 'child_process';
/**
 * Shard status
 */
export declare enum ShardStatus {
    Ready = 0,
    Connecting = 1,
    Reconnecting = 2,
    Idle = 3,
    Nearly = 4,
    Disconnected = 5,
    WaitingForGuilds = 6,
    Identifying = 7,
    Resuming = 8
}
/**
 * Options for ShardingManager
 */
export interface ShardingManagerOptions {
    /** Total number of shards (auto if not specified) */
    totalShards?: number | 'auto';
    /** Specific shard IDs to spawn */
    shardList?: number[] | 'auto';
    /** Sharding mode */
    mode?: 'process' | 'worker';
    /** Respawn shards on exit */
    respawn?: boolean;
    /** Arguments to pass to shards */
    shardArgs?: string[];
    /** Arguments to pass to node */
    execArgv?: string[];
    /** Bot token */
    token?: string;
}
/**
 * Represents a single shard
 */
export declare class Shard extends EventEmitter {
    /** The manager that spawned this shard */
    manager: ShardingManager;
    /** The shard ID */
    id: number;
    /** The child process */
    process: ChildProcess | null;
    /** Whether the shard is ready */
    ready: boolean;
    /** Shard status */
    status: ShardStatus;
    /** Environment variables for the shard */
    private env;
    constructor(manager: ShardingManager, id: number);
    /**
     * Spawn the shard process
     */
    spawn(timeout?: number): Promise<ChildProcess>;
    /**
     * Kill the shard process
     */
    kill(): void;
    /**
     * Respawn the shard
     */
    respawn(options?: {
        delay?: number;
        timeout?: number;
    }): Promise<ChildProcess>;
    /**
     * Send a message to the shard
     */
    send(message: any): Promise<void>;
    /**
     * Evaluate code on the shard
     */
    eval<T>(script: string | ((client: any) => T)): Promise<T>;
    /**
     * Fetch a client property
     */
    fetchClientValue(prop: string): Promise<any>;
    private _handleMessage;
    private _handleExit;
    private _handleError;
}
/**
 * Manages multiple shards for large bots
 */
export declare class ShardingManager extends EventEmitter {
    /** Path to the bot file */
    file: string;
    /** Total number of shards */
    totalShards: number | 'auto';
    /** List of shard IDs to spawn */
    shardList: number[];
    /** Sharding mode */
    mode: 'process' | 'worker';
    /** Whether to respawn shards */
    respawn: boolean;
    /** Arguments to pass to shards */
    shardArgs: string[];
    /** Arguments to pass to node */
    execArgv: string[];
    /** Bot token */
    token?: string;
    /** Collection of shards */
    shards: Map<number, Shard>;
    constructor(file: string, options?: ShardingManagerOptions);
    /**
     * Spawn all shards
     */
    spawn(options?: {
        amount?: number | 'auto';
        delay?: number;
        timeout?: number;
    }): Promise<Map<number, Shard>>;
    /**
     * Create a shard
     */
    createShard(id: number): Shard;
    /**
     * Fetch recommended shard count from API
     */
    fetchRecommendedShards(): Promise<number>;
    /**
     * Broadcast a message to all shards
     */
    broadcast(message: any): Promise<void[]>;
    /**
     * Broadcast an eval to all shards
     */
    broadcastEval<T>(script: string | ((client: any) => T)): Promise<T[]>;
    /**
     * Fetch a client value from all shards
     */
    fetchClientValues(prop: string): Promise<any[]>;
    /**
     * Respawn all shards
     */
    respawnAll(options?: {
        shardDelay?: number;
        respawnDelay?: number;
        timeout?: number;
    }): Promise<Map<number, Shard>>;
}
/**
 * Shard client utilities - use in bot file
 */
export declare class ShardClientUtil {
    /** The client */
    client: any;
    /** The shard ID */
    id: number;
    /** Total shard count */
    count: number;
    constructor(client: any);
    /**
     * Send a message to the parent process
     */
    send(message: any): Promise<void>;
    /**
     * Fetch a client value from all shards
     */
    fetchClientValues(prop: string): Promise<any[]>;
    /**
     * Broadcast an eval to all shards
     */
    broadcastEval<T>(script: string | ((client: any) => T)): Promise<T[]>;
    /**
     * Signal ready to the parent process
     */
    ready(): void;
    /**
     * Get the shard ID for a guild
     */
    static shardIdForGuildId(guildId: string, shardCount: number): number;
}
export default ShardingManager;
