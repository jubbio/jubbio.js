"use strict";
/**
 * ShardingManager - Multi-process bot support
 *
 * SECURITY WARNING: This module contains eval() functionality for cross-shard communication.
 * The eval() method executes arbitrary code and should NEVER be exposed to external users.
 *
 * Safe usage:
 * - Only call eval() with code you wrote yourself
 * - Never pass user input to eval()
 * - Never expose eval() through commands or APIs
 *
 * Example of UNSAFE code (DO NOT DO THIS):
 * ```js
 * // DANGEROUS - user can execute arbitrary code!
 * client.on('messageCreate', (msg) => {
 *   if (msg.content.startsWith('!eval')) {
 *     shard.eval(msg.content.slice(6)); // RCE VULNERABILITY!
 *   }
 * });
 * ```
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShardClientUtil = exports.ShardingManager = exports.Shard = exports.ShardStatus = void 0;
const events_1 = require("events");
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
/**
 * Shard status
 */
var ShardStatus;
(function (ShardStatus) {
    ShardStatus[ShardStatus["Ready"] = 0] = "Ready";
    ShardStatus[ShardStatus["Connecting"] = 1] = "Connecting";
    ShardStatus[ShardStatus["Reconnecting"] = 2] = "Reconnecting";
    ShardStatus[ShardStatus["Idle"] = 3] = "Idle";
    ShardStatus[ShardStatus["Nearly"] = 4] = "Nearly";
    ShardStatus[ShardStatus["Disconnected"] = 5] = "Disconnected";
    ShardStatus[ShardStatus["WaitingForGuilds"] = 6] = "WaitingForGuilds";
    ShardStatus[ShardStatus["Identifying"] = 7] = "Identifying";
    ShardStatus[ShardStatus["Resuming"] = 8] = "Resuming";
})(ShardStatus || (exports.ShardStatus = ShardStatus = {}));
/**
 * Represents a single shard
 */
class Shard extends events_1.EventEmitter {
    /** The manager that spawned this shard */
    manager;
    /** The shard ID */
    id;
    /** The child process */
    process = null;
    /** Whether the shard is ready */
    ready = false;
    /** Shard status */
    status = ShardStatus.Idle;
    /** Environment variables for the shard */
    env;
    constructor(manager, id) {
        super();
        this.manager = manager;
        this.id = id;
        this.env = {
            SHARD_ID: String(id),
            SHARD_COUNT: String(manager.totalShards),
            JUBBIO_TOKEN: manager.token ?? '',
        };
    }
    /**
     * Spawn the shard process
     */
    async spawn(timeout = 30000) {
        if (this.process) {
            throw new Error(`Shard ${this.id} already has a process`);
        }
        this.status = ShardStatus.Connecting;
        this.process = (0, child_process_1.fork)(this.manager.file, this.manager.shardArgs, {
            env: { ...process.env, ...this.env },
            execArgv: this.manager.execArgv,
        });
        this.process.on('message', this._handleMessage.bind(this));
        this.process.on('exit', this._handleExit.bind(this));
        this.process.on('error', this._handleError.bind(this));
        // Wait for ready
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Shard ${this.id} took too long to become ready`));
            }, timeout);
            this.once('ready', () => {
                clearTimeout(timer);
                resolve(this.process);
            });
            this.once('disconnect', () => {
                clearTimeout(timer);
                reject(new Error(`Shard ${this.id} disconnected before becoming ready`));
            });
        });
    }
    /**
     * Kill the shard process
     */
    kill() {
        if (this.process) {
            this.process.removeAllListeners();
            this.process.kill();
            this.process = null;
        }
        this.status = ShardStatus.Disconnected;
        this.ready = false;
    }
    /**
     * Respawn the shard
     */
    async respawn(options) {
        this.kill();
        if (options?.delay) {
            await new Promise(r => setTimeout(r, options.delay));
        }
        return this.spawn(options?.timeout);
    }
    /**
     * Send a message to the shard
     */
    send(message) {
        return new Promise((resolve, reject) => {
            if (!this.process) {
                reject(new Error(`Shard ${this.id} has no process`));
                return;
            }
            this.process.send(message, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    /**
     * Evaluate code on the shard
     *
     * ⚠️ SECURITY WARNING: This method executes arbitrary code on the shard process.
     * NEVER pass user input to this method - it will result in Remote Code Execution (RCE).
     *
     * @param script - Code to evaluate (string or function)
     * @returns Promise resolving to the evaluation result
     *
     * @example
     * // Safe: hardcoded code
     * const guildCount = await shard.eval(client => client.guilds.cache.size);
     *
     * // UNSAFE: user input - DO NOT DO THIS!
     * // await shard.eval(userMessage); // RCE vulnerability!
     */
    async eval(script) {
        // Security: Log eval usage for audit purposes
        if (process.env.NODE_ENV === 'development') {
            console.warn(`[Shard ${this.id}] eval() called - ensure this is not from user input`);
        }
        const _eval = typeof script === 'function' ? `(${script})(this)` : script;
        return new Promise((resolve, reject) => {
            const id = Date.now().toString(36) + Math.random().toString(36);
            const handler = (message) => {
                if (message._evalId !== id)
                    return;
                this.process?.off('message', handler);
                if (message._error) {
                    // Preserve stack trace from the shard process if available
                    const error = new Error(message._error);
                    if (message._errorStack) {
                        error.stack = message._errorStack;
                    }
                    reject(error);
                }
                else {
                    resolve(message._result);
                }
            };
            this.process?.on('message', handler);
            this.send({ _eval, _evalId: id }).catch(reject);
        });
    }
    /**
     * Fetch a client property
     */
    async fetchClientValue(prop) {
        return this.eval(`this.${prop}`);
    }
    _handleMessage(message) {
        if (message._ready) {
            this.ready = true;
            this.status = ShardStatus.Ready;
            this.emit('ready');
            this.manager.emit('shardReady', this.id);
            return;
        }
        if (message._disconnect) {
            this.ready = false;
            this.status = ShardStatus.Disconnected;
            this.emit('disconnect');
            this.manager.emit('shardDisconnect', this.id);
            return;
        }
        if (message._reconnecting) {
            this.ready = false;
            this.status = ShardStatus.Reconnecting;
            this.emit('reconnecting');
            this.manager.emit('shardReconnecting', this.id);
            return;
        }
        this.emit('message', message);
        this.manager.emit('message', this.id, message);
    }
    _handleExit(code, signal) {
        this.ready = false;
        this.status = ShardStatus.Disconnected;
        this.process = null;
        this.emit('death', { code, signal });
        this.manager.emit('shardDeath', this.id, { code, signal });
        if (this.manager.respawn) {
            this.spawn().catch(err => {
                this.manager.emit('shardError', this.id, err);
            });
        }
    }
    _handleError(error) {
        this.emit('error', error);
        this.manager.emit('shardError', this.id, error);
    }
}
exports.Shard = Shard;
/**
 * Manages multiple shards for large bots
 */
class ShardingManager extends events_1.EventEmitter {
    /** Path to the bot file */
    file;
    /** Total number of shards */
    totalShards;
    /** List of shard IDs to spawn */
    shardList;
    /** Sharding mode */
    mode;
    /** Whether to respawn shards */
    respawn;
    /** Arguments to pass to shards */
    shardArgs;
    /** Arguments to pass to node */
    execArgv;
    /** Bot token */
    token;
    /** Collection of shards */
    shards = new Map();
    constructor(file, options = {}) {
        super();
        this.file = path_1.default.resolve(file);
        this.totalShards = options.totalShards ?? 'auto';
        this.shardList = options.shardList === 'auto' ? [] : (options.shardList ?? []);
        this.mode = options.mode ?? 'process';
        this.respawn = options.respawn ?? true;
        this.shardArgs = options.shardArgs ?? [];
        this.execArgv = options.execArgv ?? [];
        this.token = options.token;
    }
    /**
     * Spawn all shards
     */
    async spawn(options) {
        // Determine shard count
        if (this.totalShards === 'auto' || options?.amount === 'auto') {
            this.totalShards = await this.fetchRecommendedShards();
        }
        else if (options?.amount) {
            this.totalShards = options.amount;
        }
        // Build shard list if not specified
        if (this.shardList.length === 0) {
            this.shardList = Array.from({ length: this.totalShards }, (_, i) => i);
        }
        // Spawn shards sequentially with delay
        const delay = options?.delay ?? 5500;
        for (const id of this.shardList) {
            const shard = this.createShard(id);
            await shard.spawn(options?.timeout);
            if (id !== this.shardList[this.shardList.length - 1]) {
                await new Promise(r => setTimeout(r, delay));
            }
        }
        return this.shards;
    }
    /**
     * Create a shard
     */
    createShard(id) {
        const shard = new Shard(this, id);
        this.shards.set(id, shard);
        return shard;
    }
    /**
     * Fetch recommended shard count from API
     * Calls the /gateway/bot endpoint to get the recommended shard count
     */
    async fetchRecommendedShards() {
        if (!this.token) {
            console.warn('[ShardingManager] No token set, returning default shard count of 1');
            return 1;
        }
        try {
            // Call the gateway/bot endpoint to get recommended shards
            const response = await fetch('https://gateway.jubbio.com/api/v1/gateway/bot', {
                method: 'GET',
                headers: {
                    'Authorization': `Bot ${this.token}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'JubbioBot/1.0 (+https://jubbio.com)'
                }
            });
            if (!response.ok) {
                console.warn(`[ShardingManager] Failed to fetch recommended shards: ${response.status}, using default of 1`);
                return 1;
            }
            const data = await response.json();
            return data.shards ?? 1;
        }
        catch (error) {
            console.warn('[ShardingManager] Error fetching recommended shards, using default of 1:', error);
            return 1;
        }
    }
    /**
     * Broadcast a message to all shards
     */
    async broadcast(message) {
        const promises = [...this.shards.values()].map(shard => shard.send(message));
        return Promise.all(promises);
    }
    /**
     * Broadcast an eval to all shards
     */
    async broadcastEval(script) {
        const promises = [...this.shards.values()].map(shard => shard.eval(script));
        return Promise.all(promises);
    }
    /**
     * Fetch a client value from all shards
     */
    async fetchClientValues(prop) {
        return this.broadcastEval(`this.${prop}`);
    }
    /**
     * Respawn all shards
     */
    async respawnAll(options) {
        for (const shard of this.shards.values()) {
            await shard.respawn({ delay: options?.respawnDelay, timeout: options?.timeout });
            if (options?.shardDelay) {
                await new Promise(r => setTimeout(r, options.shardDelay));
            }
        }
        return this.shards;
    }
}
exports.ShardingManager = ShardingManager;
/**
 * Shard client utilities - use in bot file
 */
class ShardClientUtil {
    /** The client */
    client;
    /** The shard ID */
    id;
    /** Total shard count */
    count;
    constructor(client) {
        this.client = client;
        this.id = parseInt(process.env.SHARD_ID ?? '0', 10);
        this.count = parseInt(process.env.SHARD_COUNT ?? '1', 10);
    }
    /**
     * Send a message to the parent process
     */
    send(message) {
        return new Promise((resolve, reject) => {
            process.send?.(message, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    /**
     * Fetch a client value from all shards
     */
    async fetchClientValues(prop) {
        return this.broadcastEval(`this.${prop}`);
    }
    /**
     * Broadcast an eval to all shards
     */
    async broadcastEval(script) {
        const _eval = typeof script === 'function' ? `(${script})(this)` : script;
        return new Promise((resolve, reject) => {
            const id = Date.now().toString(36) + Math.random().toString(36);
            const handler = (message) => {
                if (message._broadcastEvalId !== id)
                    return;
                process.off('message', handler);
                if (message._error) {
                    // Preserve stack trace from the shard process if available
                    const error = new Error(message._error);
                    if (message._errorStack) {
                        error.stack = message._errorStack;
                    }
                    reject(error);
                }
                else {
                    resolve(message._results);
                }
            };
            process.on('message', handler);
            this.send({ _broadcastEval: _eval, _broadcastEvalId: id }).catch(reject);
        });
    }
    /**
     * Signal ready to the parent process
     */
    ready() {
        process.send?.({ _ready: true });
    }
    /**
     * Get the shard ID for a guild
     */
    static shardIdForGuildId(guildId, shardCount) {
        const id = BigInt(guildId);
        return Number(id >> 22n) % shardCount;
    }
}
exports.ShardClientUtil = ShardClientUtil;
exports.default = ShardingManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU2hhcmRpbmdNYW5hZ2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3NoYXJkaW5nL1NoYXJkaW5nTWFuYWdlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBb0JHOzs7Ozs7QUFFSCxtQ0FBc0M7QUFDdEMsaURBQW1EO0FBQ25ELGdEQUF3QjtBQUV4Qjs7R0FFRztBQUNILElBQVksV0FVWDtBQVZELFdBQVksV0FBVztJQUNyQiwrQ0FBUyxDQUFBO0lBQ1QseURBQWMsQ0FBQTtJQUNkLDZEQUFnQixDQUFBO0lBQ2hCLDZDQUFRLENBQUE7SUFDUixpREFBVSxDQUFBO0lBQ1YsNkRBQWdCLENBQUE7SUFDaEIscUVBQW9CLENBQUE7SUFDcEIsMkRBQWUsQ0FBQTtJQUNmLHFEQUFZLENBQUE7QUFDZCxDQUFDLEVBVlcsV0FBVywyQkFBWCxXQUFXLFFBVXRCO0FBc0JEOztHQUVHO0FBQ0gsTUFBYSxLQUFNLFNBQVEscUJBQVk7SUFDckMsMENBQTBDO0lBQ25DLE9BQU8sQ0FBa0I7SUFDaEMsbUJBQW1CO0lBQ1osRUFBRSxDQUFTO0lBQ2xCLHdCQUF3QjtJQUNqQixPQUFPLEdBQXdCLElBQUksQ0FBQztJQUMzQyxpQ0FBaUM7SUFDMUIsS0FBSyxHQUFZLEtBQUssQ0FBQztJQUM5QixtQkFBbUI7SUFDWixNQUFNLEdBQWdCLFdBQVcsQ0FBQyxJQUFJLENBQUM7SUFDOUMsMENBQTBDO0lBQ2xDLEdBQUcsQ0FBeUI7SUFFcEMsWUFBWSxPQUF3QixFQUFFLEVBQVU7UUFDOUMsS0FBSyxFQUFFLENBQUM7UUFDUixJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztRQUN2QixJQUFJLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQztRQUNiLElBQUksQ0FBQyxHQUFHLEdBQUc7WUFDVCxRQUFRLEVBQUUsTUFBTSxDQUFDLEVBQUUsQ0FBQztZQUNwQixXQUFXLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUM7WUFDeEMsWUFBWSxFQUFFLE9BQU8sQ0FBQyxLQUFLLElBQUksRUFBRTtTQUNsQyxDQUFDO0lBQ0osQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsS0FBSztRQUN6QixJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNqQixNQUFNLElBQUksS0FBSyxDQUFDLFNBQVMsSUFBSSxDQUFDLEVBQUUsd0JBQXdCLENBQUMsQ0FBQztRQUM1RCxDQUFDO1FBRUQsSUFBSSxDQUFDLE1BQU0sR0FBRyxXQUFXLENBQUMsVUFBVSxDQUFDO1FBRXJDLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBQSxvQkFBSSxFQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFO1lBQzdELEdBQUcsRUFBRSxFQUFFLEdBQUcsT0FBTyxDQUFDLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUU7WUFDcEMsUUFBUSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUTtTQUNoQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUMzRCxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUNyRCxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUV2RCxpQkFBaUI7UUFDakIsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRTtZQUNyQyxNQUFNLEtBQUssR0FBRyxVQUFVLENBQUMsR0FBRyxFQUFFO2dCQUM1QixNQUFNLENBQUMsSUFBSSxLQUFLLENBQUMsU0FBUyxJQUFJLENBQUMsRUFBRSxnQ0FBZ0MsQ0FBQyxDQUFDLENBQUM7WUFDdEUsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBRVosSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsR0FBRyxFQUFFO2dCQUN0QixZQUFZLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQ3BCLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBUSxDQUFDLENBQUM7WUFDekIsQ0FBQyxDQUFDLENBQUM7WUFFSCxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxHQUFHLEVBQUU7Z0JBQzNCLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDcEIsTUFBTSxDQUFDLElBQUksS0FBSyxDQUFDLFNBQVMsSUFBSSxDQUFDLEVBQUUscUNBQXFDLENBQUMsQ0FBQyxDQUFDO1lBQzNFLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxJQUFJO1FBQ0YsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDakIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1lBQ2xDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDcEIsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7UUFDdEIsQ0FBQztRQUNELElBQUksQ0FBQyxNQUFNLEdBQUcsV0FBVyxDQUFDLFlBQVksQ0FBQztRQUN2QyxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztJQUNyQixDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsT0FBTyxDQUFDLE9BQThDO1FBQzFELElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNaLElBQUksT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDO1lBQ25CLE1BQU0sSUFBSSxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBQ3ZELENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ3RDLENBQUM7SUFFRDs7T0FFRztJQUNILElBQUksQ0FBQyxPQUFZO1FBQ2YsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRTtZQUNyQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUNsQixNQUFNLENBQUMsSUFBSSxLQUFLLENBQUMsU0FBUyxJQUFJLENBQUMsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDLENBQUM7Z0JBQ3JELE9BQU87WUFDVCxDQUFDO1lBQ0QsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMsR0FBRyxFQUFFLEVBQUU7Z0JBQ2pDLElBQUksR0FBRztvQkFBRSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7O29CQUNoQixPQUFPLEVBQUUsQ0FBQztZQUNqQixDQUFDLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOzs7Ozs7Ozs7Ozs7Ozs7T0FlRztJQUNILEtBQUssQ0FBQyxJQUFJLENBQUksTUFBcUM7UUFDakQsOENBQThDO1FBQzlDLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEtBQUssYUFBYSxFQUFFLENBQUM7WUFDM0MsT0FBTyxDQUFDLElBQUksQ0FBQyxVQUFVLElBQUksQ0FBQyxFQUFFLHNEQUFzRCxDQUFDLENBQUM7UUFDeEYsQ0FBQztRQUVELE1BQU0sS0FBSyxHQUFHLE9BQU8sTUFBTSxLQUFLLFVBQVUsQ0FBQyxDQUFDLENBQUMsSUFBSSxNQUFNLFNBQVMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDO1FBRTFFLE9BQU8sSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUU7WUFDckMsTUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBRWhFLE1BQU0sT0FBTyxHQUFHLENBQUMsT0FBWSxFQUFFLEVBQUU7Z0JBQy9CLElBQUksT0FBTyxDQUFDLE9BQU8sS0FBSyxFQUFFO29CQUFFLE9BQU87Z0JBQ25DLElBQUksQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLFNBQVMsRUFBRSxPQUFPLENBQUMsQ0FBQztnQkFFdEMsSUFBSSxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUM7b0JBQ25CLDJEQUEyRDtvQkFDM0QsTUFBTSxLQUFLLEdBQUcsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO29CQUN4QyxJQUFJLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQzt3QkFDeEIsS0FBSyxDQUFDLEtBQUssR0FBRyxPQUFPLENBQUMsV0FBVyxDQUFDO29CQUNwQyxDQUFDO29CQUNELE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDaEIsQ0FBQztxQkFBTSxDQUFDO29CQUNOLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQzNCLENBQUM7WUFDSCxDQUFDLENBQUM7WUFFRixJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDckMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDbEQsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsZ0JBQWdCLENBQUMsSUFBWTtRQUNqQyxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQ25DLENBQUM7SUFFTyxjQUFjLENBQUMsT0FBWTtRQUNqQyxJQUFJLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNuQixJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQztZQUNsQixJQUFJLENBQUMsTUFBTSxHQUFHLFdBQVcsQ0FBQyxLQUFLLENBQUM7WUFDaEMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUNuQixJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQ3pDLE9BQU87UUFDVCxDQUFDO1FBRUQsSUFBSSxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDeEIsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7WUFDbkIsSUFBSSxDQUFDLE1BQU0sR0FBRyxXQUFXLENBQUMsWUFBWSxDQUFDO1lBQ3ZDLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7WUFDeEIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQzlDLE9BQU87UUFDVCxDQUFDO1FBRUQsSUFBSSxPQUFPLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDMUIsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7WUFDbkIsSUFBSSxDQUFDLE1BQU0sR0FBRyxXQUFXLENBQUMsWUFBWSxDQUFDO1lBQ3ZDLElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7WUFDMUIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsbUJBQW1CLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQ2hELE9BQU87UUFDVCxDQUFDO1FBRUQsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDOUIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxFQUFFLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDakQsQ0FBQztJQUVPLFdBQVcsQ0FBQyxJQUFZLEVBQUUsTUFBYztRQUM5QyxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUNuQixJQUFJLENBQUMsTUFBTSxHQUFHLFdBQVcsQ0FBQyxZQUFZLENBQUM7UUFDdkMsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7UUFFcEIsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQztRQUNyQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDO1FBRTNELElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUN6QixJQUFJLENBQUMsS0FBSyxFQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFO2dCQUN2QixJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLEVBQUUsRUFBRSxHQUFHLENBQUMsQ0FBQztZQUNoRCxDQUFDLENBQUMsQ0FBQztRQUNMLENBQUM7SUFDSCxDQUFDO0lBRU8sWUFBWSxDQUFDLEtBQVk7UUFDL0IsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDMUIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLElBQUksQ0FBQyxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDbEQsQ0FBQztDQUNGO0FBN01ELHNCQTZNQztBQUVEOztHQUVHO0FBQ0gsTUFBYSxlQUFnQixTQUFRLHFCQUFZO0lBQy9DLDJCQUEyQjtJQUNwQixJQUFJLENBQVM7SUFDcEIsNkJBQTZCO0lBQ3RCLFdBQVcsQ0FBa0I7SUFDcEMsaUNBQWlDO0lBQzFCLFNBQVMsQ0FBVztJQUMzQixvQkFBb0I7SUFDYixJQUFJLENBQXVCO0lBQ2xDLGdDQUFnQztJQUN6QixPQUFPLENBQVU7SUFDeEIsa0NBQWtDO0lBQzNCLFNBQVMsQ0FBVztJQUMzQixnQ0FBZ0M7SUFDekIsUUFBUSxDQUFXO0lBQzFCLGdCQUFnQjtJQUNULEtBQUssQ0FBVTtJQUN0QiwyQkFBMkI7SUFDcEIsTUFBTSxHQUF1QixJQUFJLEdBQUcsRUFBRSxDQUFDO0lBRTlDLFlBQVksSUFBWSxFQUFFLFVBQWtDLEVBQUU7UUFDNUQsS0FBSyxFQUFFLENBQUM7UUFFUixJQUFJLENBQUMsSUFBSSxHQUFHLGNBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDL0IsSUFBSSxDQUFDLFdBQVcsR0FBRyxPQUFPLENBQUMsV0FBVyxJQUFJLE1BQU0sQ0FBQztRQUNqRCxJQUFJLENBQUMsU0FBUyxHQUFHLE9BQU8sQ0FBQyxTQUFTLEtBQUssTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUMvRSxJQUFJLENBQUMsSUFBSSxHQUFHLE9BQU8sQ0FBQyxJQUFJLElBQUksU0FBUyxDQUFDO1FBQ3RDLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUM7UUFDdkMsSUFBSSxDQUFDLFNBQVMsR0FBRyxPQUFPLENBQUMsU0FBUyxJQUFJLEVBQUUsQ0FBQztRQUN6QyxJQUFJLENBQUMsUUFBUSxHQUFHLE9BQU8sQ0FBQyxRQUFRLElBQUksRUFBRSxDQUFDO1FBQ3ZDLElBQUksQ0FBQyxLQUFLLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQztJQUM3QixDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsS0FBSyxDQUFDLE9BSVg7UUFDQyx3QkFBd0I7UUFDeEIsSUFBSSxJQUFJLENBQUMsV0FBVyxLQUFLLE1BQU0sSUFBSSxPQUFPLEVBQUUsTUFBTSxLQUFLLE1BQU0sRUFBRSxDQUFDO1lBQzlELElBQUksQ0FBQyxXQUFXLEdBQUcsTUFBTSxJQUFJLENBQUMsc0JBQXNCLEVBQUUsQ0FBQztRQUN6RCxDQUFDO2FBQU0sSUFBSSxPQUFPLEVBQUUsTUFBTSxFQUFFLENBQUM7WUFDM0IsSUFBSSxDQUFDLFdBQVcsR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDO1FBQ3BDLENBQUM7UUFFRCxvQ0FBb0M7UUFDcEMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUNoQyxJQUFJLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLFdBQXFCLEVBQUUsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ25GLENBQUM7UUFFRCx1Q0FBdUM7UUFDdkMsTUFBTSxLQUFLLEdBQUcsT0FBTyxFQUFFLEtBQUssSUFBSSxJQUFJLENBQUM7UUFFckMsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDaEMsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUNuQyxNQUFNLEtBQUssQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBRXBDLElBQUksRUFBRSxLQUFLLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQztnQkFDckQsTUFBTSxJQUFJLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQztZQUMvQyxDQUFDO1FBQ0gsQ0FBQztRQUVELE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQztJQUNyQixDQUFDO0lBRUQ7O09BRUc7SUFDSCxXQUFXLENBQUMsRUFBVTtRQUNwQixNQUFNLEtBQUssR0FBRyxJQUFJLEtBQUssQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDbEMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzNCLE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUVEOzs7T0FHRztJQUNILEtBQUssQ0FBQyxzQkFBc0I7UUFDMUIsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNoQixPQUFPLENBQUMsSUFBSSxDQUFDLG9FQUFvRSxDQUFDLENBQUM7WUFDbkYsT0FBTyxDQUFDLENBQUM7UUFDWCxDQUFDO1FBRUQsSUFBSSxDQUFDO1lBQ0gsMERBQTBEO1lBQzFELE1BQU0sUUFBUSxHQUFHLE1BQU0sS0FBSyxDQUFDLCtDQUErQyxFQUFFO2dCQUM1RSxNQUFNLEVBQUUsS0FBSztnQkFDYixPQUFPLEVBQUU7b0JBQ1AsZUFBZSxFQUFFLE9BQU8sSUFBSSxDQUFDLEtBQUssRUFBRTtvQkFDcEMsY0FBYyxFQUFFLGtCQUFrQjtvQkFDbEMsWUFBWSxFQUFFLHFDQUFxQztpQkFDcEQ7YUFDRixDQUFDLENBQUM7WUFFSCxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsRUFBRSxDQUFDO2dCQUNqQixPQUFPLENBQUMsSUFBSSxDQUFDLHlEQUF5RCxRQUFRLENBQUMsTUFBTSxzQkFBc0IsQ0FBQyxDQUFDO2dCQUM3RyxPQUFPLENBQUMsQ0FBQztZQUNYLENBQUM7WUFFRCxNQUFNLElBQUksR0FBRyxNQUFNLFFBQVEsQ0FBQyxJQUFJLEVBQXlCLENBQUM7WUFDMUQsT0FBTyxJQUFJLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQztRQUMxQixDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNmLE9BQU8sQ0FBQyxJQUFJLENBQUMsMEVBQTBFLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDaEcsT0FBTyxDQUFDLENBQUM7UUFDWCxDQUFDO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLFNBQVMsQ0FBQyxPQUFZO1FBQzFCLE1BQU0sUUFBUSxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1FBQzdFLE9BQU8sT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUMvQixDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsYUFBYSxDQUFJLE1BQXFDO1FBQzFELE1BQU0sUUFBUSxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBQzVFLE9BQU8sT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUMvQixDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsaUJBQWlCLENBQUMsSUFBWTtRQUNsQyxPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBUSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxVQUFVLENBQUMsT0FJaEI7UUFDQyxLQUFLLE1BQU0sS0FBSyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQztZQUN6QyxNQUFNLEtBQUssQ0FBQyxPQUFPLENBQUMsRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLFlBQVksRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUM7WUFDakYsSUFBSSxPQUFPLEVBQUUsVUFBVSxFQUFFLENBQUM7Z0JBQ3hCLE1BQU0sSUFBSSxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO1lBQzVELENBQUM7UUFDSCxDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDO0lBQ3JCLENBQUM7Q0FDRjtBQXRKRCwwQ0FzSkM7QUFFRDs7R0FFRztBQUNILE1BQWEsZUFBZTtJQUMxQixpQkFBaUI7SUFDVixNQUFNLENBQU07SUFDbkIsbUJBQW1CO0lBQ1osRUFBRSxDQUFTO0lBQ2xCLHdCQUF3QjtJQUNqQixLQUFLLENBQVM7SUFFckIsWUFBWSxNQUFXO1FBQ3JCLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1FBQ3JCLElBQUksQ0FBQyxFQUFFLEdBQUcsUUFBUSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxJQUFJLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUNwRCxJQUFJLENBQUMsS0FBSyxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFdBQVcsSUFBSSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDNUQsQ0FBQztJQUVEOztPQUVHO0lBQ0gsSUFBSSxDQUFDLE9BQVk7UUFDZixPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO1lBQ3JDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxHQUFpQixFQUFFLEVBQUU7Z0JBQzVDLElBQUksR0FBRztvQkFBRSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7O29CQUNoQixPQUFPLEVBQUUsQ0FBQztZQUNqQixDQUFDLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLGlCQUFpQixDQUFDLElBQVk7UUFDbEMsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVEsSUFBSSxFQUFFLENBQUMsQ0FBQztJQUM1QyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsYUFBYSxDQUFJLE1BQXFDO1FBQzFELE1BQU0sS0FBSyxHQUFHLE9BQU8sTUFBTSxLQUFLLFVBQVUsQ0FBQyxDQUFDLENBQUMsSUFBSSxNQUFNLFNBQVMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDO1FBRTFFLE9BQU8sSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUU7WUFDckMsTUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBRWhFLE1BQU0sT0FBTyxHQUFHLENBQUMsT0FBWSxFQUFFLEVBQUU7Z0JBQy9CLElBQUksT0FBTyxDQUFDLGdCQUFnQixLQUFLLEVBQUU7b0JBQUUsT0FBTztnQkFDNUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUM7Z0JBRWhDLElBQUksT0FBTyxDQUFDLE1BQU0sRUFBRSxDQUFDO29CQUNuQiwyREFBMkQ7b0JBQzNELE1BQU0sS0FBSyxHQUFHLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztvQkFDeEMsSUFBSSxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUM7d0JBQ3hCLEtBQUssQ0FBQyxLQUFLLEdBQUcsT0FBTyxDQUFDLFdBQVcsQ0FBQztvQkFDcEMsQ0FBQztvQkFDRCxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQ2hCLENBQUM7cUJBQU0sQ0FBQztvQkFDTixPQUFPLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUM1QixDQUFDO1lBQ0gsQ0FBQyxDQUFDO1lBRUYsT0FBTyxDQUFDLEVBQUUsQ0FBQyxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDL0IsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLGNBQWMsRUFBRSxLQUFLLEVBQUUsZ0JBQWdCLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDM0UsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLO1FBQ0gsT0FBTyxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7SUFDbkMsQ0FBQztJQUVEOztPQUVHO0lBQ0gsTUFBTSxDQUFDLGlCQUFpQixDQUFDLE9BQWUsRUFBRSxVQUFrQjtRQUMxRCxNQUFNLEVBQUUsR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDM0IsT0FBTyxNQUFNLENBQUMsRUFBRSxJQUFJLEdBQUcsQ0FBQyxHQUFHLFVBQVUsQ0FBQztJQUN4QyxDQUFDO0NBQ0Y7QUE3RUQsMENBNkVDO0FBRUQsa0JBQWUsZUFBZSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIFNoYXJkaW5nTWFuYWdlciAtIE11bHRpLXByb2Nlc3MgYm90IHN1cHBvcnRcclxuICogXHJcbiAqIFNFQ1VSSVRZIFdBUk5JTkc6IFRoaXMgbW9kdWxlIGNvbnRhaW5zIGV2YWwoKSBmdW5jdGlvbmFsaXR5IGZvciBjcm9zcy1zaGFyZCBjb21tdW5pY2F0aW9uLlxyXG4gKiBUaGUgZXZhbCgpIG1ldGhvZCBleGVjdXRlcyBhcmJpdHJhcnkgY29kZSBhbmQgc2hvdWxkIE5FVkVSIGJlIGV4cG9zZWQgdG8gZXh0ZXJuYWwgdXNlcnMuXHJcbiAqIFxyXG4gKiBTYWZlIHVzYWdlOlxyXG4gKiAtIE9ubHkgY2FsbCBldmFsKCkgd2l0aCBjb2RlIHlvdSB3cm90ZSB5b3Vyc2VsZlxyXG4gKiAtIE5ldmVyIHBhc3MgdXNlciBpbnB1dCB0byBldmFsKClcclxuICogLSBOZXZlciBleHBvc2UgZXZhbCgpIHRocm91Z2ggY29tbWFuZHMgb3IgQVBJc1xyXG4gKiBcclxuICogRXhhbXBsZSBvZiBVTlNBRkUgY29kZSAoRE8gTk9UIERPIFRISVMpOlxyXG4gKiBgYGBqc1xyXG4gKiAvLyBEQU5HRVJPVVMgLSB1c2VyIGNhbiBleGVjdXRlIGFyYml0cmFyeSBjb2RlIVxyXG4gKiBjbGllbnQub24oJ21lc3NhZ2VDcmVhdGUnLCAobXNnKSA9PiB7XHJcbiAqICAgaWYgKG1zZy5jb250ZW50LnN0YXJ0c1dpdGgoJyFldmFsJykpIHtcclxuICogICAgIHNoYXJkLmV2YWwobXNnLmNvbnRlbnQuc2xpY2UoNikpOyAvLyBSQ0UgVlVMTkVSQUJJTElUWSFcclxuICogICB9XHJcbiAqIH0pO1xyXG4gKiBgYGBcclxuICovXHJcblxyXG5pbXBvcnQgeyBFdmVudEVtaXR0ZXIgfSBmcm9tICdldmVudHMnO1xyXG5pbXBvcnQgeyBmb3JrLCBDaGlsZFByb2Nlc3MgfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcclxuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XHJcblxyXG4vKipcclxuICogU2hhcmQgc3RhdHVzXHJcbiAqL1xyXG5leHBvcnQgZW51bSBTaGFyZFN0YXR1cyB7XHJcbiAgUmVhZHkgPSAwLFxyXG4gIENvbm5lY3RpbmcgPSAxLFxyXG4gIFJlY29ubmVjdGluZyA9IDIsXHJcbiAgSWRsZSA9IDMsXHJcbiAgTmVhcmx5ID0gNCxcclxuICBEaXNjb25uZWN0ZWQgPSA1LFxyXG4gIFdhaXRpbmdGb3JHdWlsZHMgPSA2LFxyXG4gIElkZW50aWZ5aW5nID0gNyxcclxuICBSZXN1bWluZyA9IDgsXHJcbn1cclxuXHJcbi8qKlxyXG4gKiBPcHRpb25zIGZvciBTaGFyZGluZ01hbmFnZXJcclxuICovXHJcbmV4cG9ydCBpbnRlcmZhY2UgU2hhcmRpbmdNYW5hZ2VyT3B0aW9ucyB7XHJcbiAgLyoqIFRvdGFsIG51bWJlciBvZiBzaGFyZHMgKGF1dG8gaWYgbm90IHNwZWNpZmllZCkgKi9cclxuICB0b3RhbFNoYXJkcz86IG51bWJlciB8ICdhdXRvJztcclxuICAvKiogU3BlY2lmaWMgc2hhcmQgSURzIHRvIHNwYXduICovXHJcbiAgc2hhcmRMaXN0PzogbnVtYmVyW10gfCAnYXV0byc7XHJcbiAgLyoqIFNoYXJkaW5nIG1vZGUgKi9cclxuICBtb2RlPzogJ3Byb2Nlc3MnIHwgJ3dvcmtlcic7XHJcbiAgLyoqIFJlc3Bhd24gc2hhcmRzIG9uIGV4aXQgKi9cclxuICByZXNwYXduPzogYm9vbGVhbjtcclxuICAvKiogQXJndW1lbnRzIHRvIHBhc3MgdG8gc2hhcmRzICovXHJcbiAgc2hhcmRBcmdzPzogc3RyaW5nW107XHJcbiAgLyoqIEFyZ3VtZW50cyB0byBwYXNzIHRvIG5vZGUgKi9cclxuICBleGVjQXJndj86IHN0cmluZ1tdO1xyXG4gIC8qKiBCb3QgdG9rZW4gKi9cclxuICB0b2tlbj86IHN0cmluZztcclxufVxyXG5cclxuLyoqXHJcbiAqIFJlcHJlc2VudHMgYSBzaW5nbGUgc2hhcmRcclxuICovXHJcbmV4cG9ydCBjbGFzcyBTaGFyZCBleHRlbmRzIEV2ZW50RW1pdHRlciB7XHJcbiAgLyoqIFRoZSBtYW5hZ2VyIHRoYXQgc3Bhd25lZCB0aGlzIHNoYXJkICovXHJcbiAgcHVibGljIG1hbmFnZXI6IFNoYXJkaW5nTWFuYWdlcjtcclxuICAvKiogVGhlIHNoYXJkIElEICovXHJcbiAgcHVibGljIGlkOiBudW1iZXI7XHJcbiAgLyoqIFRoZSBjaGlsZCBwcm9jZXNzICovXHJcbiAgcHVibGljIHByb2Nlc3M6IENoaWxkUHJvY2VzcyB8IG51bGwgPSBudWxsO1xyXG4gIC8qKiBXaGV0aGVyIHRoZSBzaGFyZCBpcyByZWFkeSAqL1xyXG4gIHB1YmxpYyByZWFkeTogYm9vbGVhbiA9IGZhbHNlO1xyXG4gIC8qKiBTaGFyZCBzdGF0dXMgKi9cclxuICBwdWJsaWMgc3RhdHVzOiBTaGFyZFN0YXR1cyA9IFNoYXJkU3RhdHVzLklkbGU7XHJcbiAgLyoqIEVudmlyb25tZW50IHZhcmlhYmxlcyBmb3IgdGhlIHNoYXJkICovXHJcbiAgcHJpdmF0ZSBlbnY6IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XHJcblxyXG4gIGNvbnN0cnVjdG9yKG1hbmFnZXI6IFNoYXJkaW5nTWFuYWdlciwgaWQ6IG51bWJlcikge1xyXG4gICAgc3VwZXIoKTtcclxuICAgIHRoaXMubWFuYWdlciA9IG1hbmFnZXI7XHJcbiAgICB0aGlzLmlkID0gaWQ7XHJcbiAgICB0aGlzLmVudiA9IHtcclxuICAgICAgU0hBUkRfSUQ6IFN0cmluZyhpZCksXHJcbiAgICAgIFNIQVJEX0NPVU5UOiBTdHJpbmcobWFuYWdlci50b3RhbFNoYXJkcyksXHJcbiAgICAgIEpVQkJJT19UT0tFTjogbWFuYWdlci50b2tlbiA/PyAnJyxcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTcGF3biB0aGUgc2hhcmQgcHJvY2Vzc1xyXG4gICAqL1xyXG4gIGFzeW5jIHNwYXduKHRpbWVvdXQgPSAzMDAwMCk6IFByb21pc2U8Q2hpbGRQcm9jZXNzPiB7XHJcbiAgICBpZiAodGhpcy5wcm9jZXNzKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihgU2hhcmQgJHt0aGlzLmlkfSBhbHJlYWR5IGhhcyBhIHByb2Nlc3NgKTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLnN0YXR1cyA9IFNoYXJkU3RhdHVzLkNvbm5lY3Rpbmc7XHJcblxyXG4gICAgdGhpcy5wcm9jZXNzID0gZm9yayh0aGlzLm1hbmFnZXIuZmlsZSwgdGhpcy5tYW5hZ2VyLnNoYXJkQXJncywge1xyXG4gICAgICBlbnY6IHsgLi4ucHJvY2Vzcy5lbnYsIC4uLnRoaXMuZW52IH0sXHJcbiAgICAgIGV4ZWNBcmd2OiB0aGlzLm1hbmFnZXIuZXhlY0FyZ3YsXHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLnByb2Nlc3Mub24oJ21lc3NhZ2UnLCB0aGlzLl9oYW5kbGVNZXNzYWdlLmJpbmQodGhpcykpO1xyXG4gICAgdGhpcy5wcm9jZXNzLm9uKCdleGl0JywgdGhpcy5faGFuZGxlRXhpdC5iaW5kKHRoaXMpKTtcclxuICAgIHRoaXMucHJvY2Vzcy5vbignZXJyb3InLCB0aGlzLl9oYW5kbGVFcnJvci5iaW5kKHRoaXMpKTtcclxuXHJcbiAgICAvLyBXYWl0IGZvciByZWFkeVxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgY29uc3QgdGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICByZWplY3QobmV3IEVycm9yKGBTaGFyZCAke3RoaXMuaWR9IHRvb2sgdG9vIGxvbmcgdG8gYmVjb21lIHJlYWR5YCkpO1xyXG4gICAgICB9LCB0aW1lb3V0KTtcclxuXHJcbiAgICAgIHRoaXMub25jZSgncmVhZHknLCAoKSA9PiB7XHJcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVyKTtcclxuICAgICAgICByZXNvbHZlKHRoaXMucHJvY2VzcyEpO1xyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIHRoaXMub25jZSgnZGlzY29ubmVjdCcsICgpID0+IHtcclxuICAgICAgICBjbGVhclRpbWVvdXQodGltZXIpO1xyXG4gICAgICAgIHJlamVjdChuZXcgRXJyb3IoYFNoYXJkICR7dGhpcy5pZH0gZGlzY29ubmVjdGVkIGJlZm9yZSBiZWNvbWluZyByZWFkeWApKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEtpbGwgdGhlIHNoYXJkIHByb2Nlc3NcclxuICAgKi9cclxuICBraWxsKCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMucHJvY2Vzcykge1xyXG4gICAgICB0aGlzLnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzKCk7XHJcbiAgICAgIHRoaXMucHJvY2Vzcy5raWxsKCk7XHJcbiAgICAgIHRoaXMucHJvY2VzcyA9IG51bGw7XHJcbiAgICB9XHJcbiAgICB0aGlzLnN0YXR1cyA9IFNoYXJkU3RhdHVzLkRpc2Nvbm5lY3RlZDtcclxuICAgIHRoaXMucmVhZHkgPSBmYWxzZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlc3Bhd24gdGhlIHNoYXJkXHJcbiAgICovXHJcbiAgYXN5bmMgcmVzcGF3bihvcHRpb25zPzogeyBkZWxheT86IG51bWJlcjsgdGltZW91dD86IG51bWJlciB9KTogUHJvbWlzZTxDaGlsZFByb2Nlc3M+IHtcclxuICAgIHRoaXMua2lsbCgpO1xyXG4gICAgaWYgKG9wdGlvbnM/LmRlbGF5KSB7XHJcbiAgICAgIGF3YWl0IG5ldyBQcm9taXNlKHIgPT4gc2V0VGltZW91dChyLCBvcHRpb25zLmRlbGF5KSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGhpcy5zcGF3bihvcHRpb25zPy50aW1lb3V0KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNlbmQgYSBtZXNzYWdlIHRvIHRoZSBzaGFyZFxyXG4gICAqL1xyXG4gIHNlbmQobWVzc2FnZTogYW55KTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICBpZiAoIXRoaXMucHJvY2Vzcykge1xyXG4gICAgICAgIHJlamVjdChuZXcgRXJyb3IoYFNoYXJkICR7dGhpcy5pZH0gaGFzIG5vIHByb2Nlc3NgKSk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcbiAgICAgIHRoaXMucHJvY2Vzcy5zZW5kKG1lc3NhZ2UsIChlcnIpID0+IHtcclxuICAgICAgICBpZiAoZXJyKSByZWplY3QoZXJyKTtcclxuICAgICAgICBlbHNlIHJlc29sdmUoKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEV2YWx1YXRlIGNvZGUgb24gdGhlIHNoYXJkXHJcbiAgICogXHJcbiAgICog4pqg77iPIFNFQ1VSSVRZIFdBUk5JTkc6IFRoaXMgbWV0aG9kIGV4ZWN1dGVzIGFyYml0cmFyeSBjb2RlIG9uIHRoZSBzaGFyZCBwcm9jZXNzLlxyXG4gICAqIE5FVkVSIHBhc3MgdXNlciBpbnB1dCB0byB0aGlzIG1ldGhvZCAtIGl0IHdpbGwgcmVzdWx0IGluIFJlbW90ZSBDb2RlIEV4ZWN1dGlvbiAoUkNFKS5cclxuICAgKiBcclxuICAgKiBAcGFyYW0gc2NyaXB0IC0gQ29kZSB0byBldmFsdWF0ZSAoc3RyaW5nIG9yIGZ1bmN0aW9uKVxyXG4gICAqIEByZXR1cm5zIFByb21pc2UgcmVzb2x2aW5nIHRvIHRoZSBldmFsdWF0aW9uIHJlc3VsdFxyXG4gICAqIFxyXG4gICAqIEBleGFtcGxlXHJcbiAgICogLy8gU2FmZTogaGFyZGNvZGVkIGNvZGVcclxuICAgKiBjb25zdCBndWlsZENvdW50ID0gYXdhaXQgc2hhcmQuZXZhbChjbGllbnQgPT4gY2xpZW50Lmd1aWxkcy5jYWNoZS5zaXplKTtcclxuICAgKiBcclxuICAgKiAvLyBVTlNBRkU6IHVzZXIgaW5wdXQgLSBETyBOT1QgRE8gVEhJUyFcclxuICAgKiAvLyBhd2FpdCBzaGFyZC5ldmFsKHVzZXJNZXNzYWdlKTsgLy8gUkNFIHZ1bG5lcmFiaWxpdHkhXHJcbiAgICovXHJcbiAgYXN5bmMgZXZhbDxUPihzY3JpcHQ6IHN0cmluZyB8ICgoY2xpZW50OiBhbnkpID0+IFQpKTogUHJvbWlzZTxUPiB7XHJcbiAgICAvLyBTZWN1cml0eTogTG9nIGV2YWwgdXNhZ2UgZm9yIGF1ZGl0IHB1cnBvc2VzXHJcbiAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICdkZXZlbG9wbWVudCcpIHtcclxuICAgICAgY29uc29sZS53YXJuKGBbU2hhcmQgJHt0aGlzLmlkfV0gZXZhbCgpIGNhbGxlZCAtIGVuc3VyZSB0aGlzIGlzIG5vdCBmcm9tIHVzZXIgaW5wdXRgKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgY29uc3QgX2V2YWwgPSB0eXBlb2Ygc2NyaXB0ID09PSAnZnVuY3Rpb24nID8gYCgke3NjcmlwdH0pKHRoaXMpYCA6IHNjcmlwdDtcclxuICAgIFxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgY29uc3QgaWQgPSBEYXRlLm5vdygpLnRvU3RyaW5nKDM2KSArIE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpO1xyXG4gICAgICBcclxuICAgICAgY29uc3QgaGFuZGxlciA9IChtZXNzYWdlOiBhbnkpID0+IHtcclxuICAgICAgICBpZiAobWVzc2FnZS5fZXZhbElkICE9PSBpZCkgcmV0dXJuO1xyXG4gICAgICAgIHRoaXMucHJvY2Vzcz8ub2ZmKCdtZXNzYWdlJywgaGFuZGxlcik7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKG1lc3NhZ2UuX2Vycm9yKSB7XHJcbiAgICAgICAgICAvLyBQcmVzZXJ2ZSBzdGFjayB0cmFjZSBmcm9tIHRoZSBzaGFyZCBwcm9jZXNzIGlmIGF2YWlsYWJsZVxyXG4gICAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IobWVzc2FnZS5fZXJyb3IpO1xyXG4gICAgICAgICAgaWYgKG1lc3NhZ2UuX2Vycm9yU3RhY2spIHtcclxuICAgICAgICAgICAgZXJyb3Iuc3RhY2sgPSBtZXNzYWdlLl9lcnJvclN0YWNrO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgcmVqZWN0KGVycm9yKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgcmVzb2x2ZShtZXNzYWdlLl9yZXN1bHQpO1xyXG4gICAgICAgIH1cclxuICAgICAgfTtcclxuICAgICAgXHJcbiAgICAgIHRoaXMucHJvY2Vzcz8ub24oJ21lc3NhZ2UnLCBoYW5kbGVyKTtcclxuICAgICAgdGhpcy5zZW5kKHsgX2V2YWwsIF9ldmFsSWQ6IGlkIH0pLmNhdGNoKHJlamVjdCk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEZldGNoIGEgY2xpZW50IHByb3BlcnR5XHJcbiAgICovXHJcbiAgYXN5bmMgZmV0Y2hDbGllbnRWYWx1ZShwcm9wOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xyXG4gICAgcmV0dXJuIHRoaXMuZXZhbChgdGhpcy4ke3Byb3B9YCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIF9oYW5kbGVNZXNzYWdlKG1lc3NhZ2U6IGFueSk6IHZvaWQge1xyXG4gICAgaWYgKG1lc3NhZ2UuX3JlYWR5KSB7XHJcbiAgICAgIHRoaXMucmVhZHkgPSB0cnVlO1xyXG4gICAgICB0aGlzLnN0YXR1cyA9IFNoYXJkU3RhdHVzLlJlYWR5O1xyXG4gICAgICB0aGlzLmVtaXQoJ3JlYWR5Jyk7XHJcbiAgICAgIHRoaXMubWFuYWdlci5lbWl0KCdzaGFyZFJlYWR5JywgdGhpcy5pZCk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBpZiAobWVzc2FnZS5fZGlzY29ubmVjdCkge1xyXG4gICAgICB0aGlzLnJlYWR5ID0gZmFsc2U7XHJcbiAgICAgIHRoaXMuc3RhdHVzID0gU2hhcmRTdGF0dXMuRGlzY29ubmVjdGVkO1xyXG4gICAgICB0aGlzLmVtaXQoJ2Rpc2Nvbm5lY3QnKTtcclxuICAgICAgdGhpcy5tYW5hZ2VyLmVtaXQoJ3NoYXJkRGlzY29ubmVjdCcsIHRoaXMuaWQpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKG1lc3NhZ2UuX3JlY29ubmVjdGluZykge1xyXG4gICAgICB0aGlzLnJlYWR5ID0gZmFsc2U7XHJcbiAgICAgIHRoaXMuc3RhdHVzID0gU2hhcmRTdGF0dXMuUmVjb25uZWN0aW5nO1xyXG4gICAgICB0aGlzLmVtaXQoJ3JlY29ubmVjdGluZycpO1xyXG4gICAgICB0aGlzLm1hbmFnZXIuZW1pdCgnc2hhcmRSZWNvbm5lY3RpbmcnLCB0aGlzLmlkKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuZW1pdCgnbWVzc2FnZScsIG1lc3NhZ2UpO1xyXG4gICAgdGhpcy5tYW5hZ2VyLmVtaXQoJ21lc3NhZ2UnLCB0aGlzLmlkLCBtZXNzYWdlKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgX2hhbmRsZUV4aXQoY29kZTogbnVtYmVyLCBzaWduYWw6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgdGhpcy5yZWFkeSA9IGZhbHNlO1xyXG4gICAgdGhpcy5zdGF0dXMgPSBTaGFyZFN0YXR1cy5EaXNjb25uZWN0ZWQ7XHJcbiAgICB0aGlzLnByb2Nlc3MgPSBudWxsO1xyXG4gICAgXHJcbiAgICB0aGlzLmVtaXQoJ2RlYXRoJywgeyBjb2RlLCBzaWduYWwgfSk7XHJcbiAgICB0aGlzLm1hbmFnZXIuZW1pdCgnc2hhcmREZWF0aCcsIHRoaXMuaWQsIHsgY29kZSwgc2lnbmFsIH0pO1xyXG5cclxuICAgIGlmICh0aGlzLm1hbmFnZXIucmVzcGF3bikge1xyXG4gICAgICB0aGlzLnNwYXduKCkuY2F0Y2goZXJyID0+IHtcclxuICAgICAgICB0aGlzLm1hbmFnZXIuZW1pdCgnc2hhcmRFcnJvcicsIHRoaXMuaWQsIGVycik7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBfaGFuZGxlRXJyb3IoZXJyb3I6IEVycm9yKTogdm9pZCB7XHJcbiAgICB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyb3IpO1xyXG4gICAgdGhpcy5tYW5hZ2VyLmVtaXQoJ3NoYXJkRXJyb3InLCB0aGlzLmlkLCBlcnJvcik7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogTWFuYWdlcyBtdWx0aXBsZSBzaGFyZHMgZm9yIGxhcmdlIGJvdHNcclxuICovXHJcbmV4cG9ydCBjbGFzcyBTaGFyZGluZ01hbmFnZXIgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xyXG4gIC8qKiBQYXRoIHRvIHRoZSBib3QgZmlsZSAqL1xyXG4gIHB1YmxpYyBmaWxlOiBzdHJpbmc7XHJcbiAgLyoqIFRvdGFsIG51bWJlciBvZiBzaGFyZHMgKi9cclxuICBwdWJsaWMgdG90YWxTaGFyZHM6IG51bWJlciB8ICdhdXRvJztcclxuICAvKiogTGlzdCBvZiBzaGFyZCBJRHMgdG8gc3Bhd24gKi9cclxuICBwdWJsaWMgc2hhcmRMaXN0OiBudW1iZXJbXTtcclxuICAvKiogU2hhcmRpbmcgbW9kZSAqL1xyXG4gIHB1YmxpYyBtb2RlOiAncHJvY2VzcycgfCAnd29ya2VyJztcclxuICAvKiogV2hldGhlciB0byByZXNwYXduIHNoYXJkcyAqL1xyXG4gIHB1YmxpYyByZXNwYXduOiBib29sZWFuO1xyXG4gIC8qKiBBcmd1bWVudHMgdG8gcGFzcyB0byBzaGFyZHMgKi9cclxuICBwdWJsaWMgc2hhcmRBcmdzOiBzdHJpbmdbXTtcclxuICAvKiogQXJndW1lbnRzIHRvIHBhc3MgdG8gbm9kZSAqL1xyXG4gIHB1YmxpYyBleGVjQXJndjogc3RyaW5nW107XHJcbiAgLyoqIEJvdCB0b2tlbiAqL1xyXG4gIHB1YmxpYyB0b2tlbj86IHN0cmluZztcclxuICAvKiogQ29sbGVjdGlvbiBvZiBzaGFyZHMgKi9cclxuICBwdWJsaWMgc2hhcmRzOiBNYXA8bnVtYmVyLCBTaGFyZD4gPSBuZXcgTWFwKCk7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGZpbGU6IHN0cmluZywgb3B0aW9uczogU2hhcmRpbmdNYW5hZ2VyT3B0aW9ucyA9IHt9KSB7XHJcbiAgICBzdXBlcigpO1xyXG4gICAgXHJcbiAgICB0aGlzLmZpbGUgPSBwYXRoLnJlc29sdmUoZmlsZSk7XHJcbiAgICB0aGlzLnRvdGFsU2hhcmRzID0gb3B0aW9ucy50b3RhbFNoYXJkcyA/PyAnYXV0byc7XHJcbiAgICB0aGlzLnNoYXJkTGlzdCA9IG9wdGlvbnMuc2hhcmRMaXN0ID09PSAnYXV0bycgPyBbXSA6IChvcHRpb25zLnNoYXJkTGlzdCA/PyBbXSk7XHJcbiAgICB0aGlzLm1vZGUgPSBvcHRpb25zLm1vZGUgPz8gJ3Byb2Nlc3MnO1xyXG4gICAgdGhpcy5yZXNwYXduID0gb3B0aW9ucy5yZXNwYXduID8/IHRydWU7XHJcbiAgICB0aGlzLnNoYXJkQXJncyA9IG9wdGlvbnMuc2hhcmRBcmdzID8/IFtdO1xyXG4gICAgdGhpcy5leGVjQXJndiA9IG9wdGlvbnMuZXhlY0FyZ3YgPz8gW107XHJcbiAgICB0aGlzLnRva2VuID0gb3B0aW9ucy50b2tlbjtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNwYXduIGFsbCBzaGFyZHNcclxuICAgKi9cclxuICBhc3luYyBzcGF3bihvcHRpb25zPzoge1xyXG4gICAgYW1vdW50PzogbnVtYmVyIHwgJ2F1dG8nO1xyXG4gICAgZGVsYXk/OiBudW1iZXI7XHJcbiAgICB0aW1lb3V0PzogbnVtYmVyO1xyXG4gIH0pOiBQcm9taXNlPE1hcDxudW1iZXIsIFNoYXJkPj4ge1xyXG4gICAgLy8gRGV0ZXJtaW5lIHNoYXJkIGNvdW50XHJcbiAgICBpZiAodGhpcy50b3RhbFNoYXJkcyA9PT0gJ2F1dG8nIHx8IG9wdGlvbnM/LmFtb3VudCA9PT0gJ2F1dG8nKSB7XHJcbiAgICAgIHRoaXMudG90YWxTaGFyZHMgPSBhd2FpdCB0aGlzLmZldGNoUmVjb21tZW5kZWRTaGFyZHMoKTtcclxuICAgIH0gZWxzZSBpZiAob3B0aW9ucz8uYW1vdW50KSB7XHJcbiAgICAgIHRoaXMudG90YWxTaGFyZHMgPSBvcHRpb25zLmFtb3VudDtcclxuICAgIH1cclxuXHJcbiAgICAvLyBCdWlsZCBzaGFyZCBsaXN0IGlmIG5vdCBzcGVjaWZpZWRcclxuICAgIGlmICh0aGlzLnNoYXJkTGlzdC5sZW5ndGggPT09IDApIHtcclxuICAgICAgdGhpcy5zaGFyZExpc3QgPSBBcnJheS5mcm9tKHsgbGVuZ3RoOiB0aGlzLnRvdGFsU2hhcmRzIGFzIG51bWJlciB9LCAoXywgaSkgPT4gaSk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gU3Bhd24gc2hhcmRzIHNlcXVlbnRpYWxseSB3aXRoIGRlbGF5XHJcbiAgICBjb25zdCBkZWxheSA9IG9wdGlvbnM/LmRlbGF5ID8/IDU1MDA7XHJcbiAgICBcclxuICAgIGZvciAoY29uc3QgaWQgb2YgdGhpcy5zaGFyZExpc3QpIHtcclxuICAgICAgY29uc3Qgc2hhcmQgPSB0aGlzLmNyZWF0ZVNoYXJkKGlkKTtcclxuICAgICAgYXdhaXQgc2hhcmQuc3Bhd24ob3B0aW9ucz8udGltZW91dCk7XHJcbiAgICAgIFxyXG4gICAgICBpZiAoaWQgIT09IHRoaXMuc2hhcmRMaXN0W3RoaXMuc2hhcmRMaXN0Lmxlbmd0aCAtIDFdKSB7XHJcbiAgICAgICAgYXdhaXQgbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIGRlbGF5KSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gdGhpcy5zaGFyZHM7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgYSBzaGFyZFxyXG4gICAqL1xyXG4gIGNyZWF0ZVNoYXJkKGlkOiBudW1iZXIpOiBTaGFyZCB7XHJcbiAgICBjb25zdCBzaGFyZCA9IG5ldyBTaGFyZCh0aGlzLCBpZCk7XHJcbiAgICB0aGlzLnNoYXJkcy5zZXQoaWQsIHNoYXJkKTtcclxuICAgIHJldHVybiBzaGFyZDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEZldGNoIHJlY29tbWVuZGVkIHNoYXJkIGNvdW50IGZyb20gQVBJXHJcbiAgICogQ2FsbHMgdGhlIC9nYXRld2F5L2JvdCBlbmRwb2ludCB0byBnZXQgdGhlIHJlY29tbWVuZGVkIHNoYXJkIGNvdW50XHJcbiAgICovXHJcbiAgYXN5bmMgZmV0Y2hSZWNvbW1lbmRlZFNoYXJkcygpOiBQcm9taXNlPG51bWJlcj4ge1xyXG4gICAgaWYgKCF0aGlzLnRva2VuKSB7XHJcbiAgICAgIGNvbnNvbGUud2FybignW1NoYXJkaW5nTWFuYWdlcl0gTm8gdG9rZW4gc2V0LCByZXR1cm5pbmcgZGVmYXVsdCBzaGFyZCBjb3VudCBvZiAxJyk7XHJcbiAgICAgIHJldHVybiAxO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICB0cnkge1xyXG4gICAgICAvLyBDYWxsIHRoZSBnYXRld2F5L2JvdCBlbmRwb2ludCB0byBnZXQgcmVjb21tZW5kZWQgc2hhcmRzXHJcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goJ2h0dHBzOi8vZ2F0ZXdheS5qdWJiaW8uY29tL2FwaS92MS9nYXRld2F5L2JvdCcsIHtcclxuICAgICAgICBtZXRob2Q6ICdHRVQnLFxyXG4gICAgICAgIGhlYWRlcnM6IHtcclxuICAgICAgICAgICdBdXRob3JpemF0aW9uJzogYEJvdCAke3RoaXMudG9rZW59YCxcclxuICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXHJcbiAgICAgICAgICAnVXNlci1BZ2VudCc6ICdKdWJiaW9Cb3QvMS4wICgraHR0cHM6Ly9qdWJiaW8uY29tKSdcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgICBcclxuICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xyXG4gICAgICAgIGNvbnNvbGUud2FybihgW1NoYXJkaW5nTWFuYWdlcl0gRmFpbGVkIHRvIGZldGNoIHJlY29tbWVuZGVkIHNoYXJkczogJHtyZXNwb25zZS5zdGF0dXN9LCB1c2luZyBkZWZhdWx0IG9mIDFgKTtcclxuICAgICAgICByZXR1cm4gMTtcclxuICAgICAgfVxyXG4gICAgICBcclxuICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKSBhcyB7IHNoYXJkcz86IG51bWJlciB9O1xyXG4gICAgICByZXR1cm4gZGF0YS5zaGFyZHMgPz8gMTtcclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIGNvbnNvbGUud2FybignW1NoYXJkaW5nTWFuYWdlcl0gRXJyb3IgZmV0Y2hpbmcgcmVjb21tZW5kZWQgc2hhcmRzLCB1c2luZyBkZWZhdWx0IG9mIDE6JywgZXJyb3IpO1xyXG4gICAgICByZXR1cm4gMTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEJyb2FkY2FzdCBhIG1lc3NhZ2UgdG8gYWxsIHNoYXJkc1xyXG4gICAqL1xyXG4gIGFzeW5jIGJyb2FkY2FzdChtZXNzYWdlOiBhbnkpOiBQcm9taXNlPHZvaWRbXT4ge1xyXG4gICAgY29uc3QgcHJvbWlzZXMgPSBbLi4udGhpcy5zaGFyZHMudmFsdWVzKCldLm1hcChzaGFyZCA9PiBzaGFyZC5zZW5kKG1lc3NhZ2UpKTtcclxuICAgIHJldHVybiBQcm9taXNlLmFsbChwcm9taXNlcyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBCcm9hZGNhc3QgYW4gZXZhbCB0byBhbGwgc2hhcmRzXHJcbiAgICovXHJcbiAgYXN5bmMgYnJvYWRjYXN0RXZhbDxUPihzY3JpcHQ6IHN0cmluZyB8ICgoY2xpZW50OiBhbnkpID0+IFQpKTogUHJvbWlzZTxUW10+IHtcclxuICAgIGNvbnN0IHByb21pc2VzID0gWy4uLnRoaXMuc2hhcmRzLnZhbHVlcygpXS5tYXAoc2hhcmQgPT4gc2hhcmQuZXZhbChzY3JpcHQpKTtcclxuICAgIHJldHVybiBQcm9taXNlLmFsbChwcm9taXNlcyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBGZXRjaCBhIGNsaWVudCB2YWx1ZSBmcm9tIGFsbCBzaGFyZHNcclxuICAgKi9cclxuICBhc3luYyBmZXRjaENsaWVudFZhbHVlcyhwcm9wOiBzdHJpbmcpOiBQcm9taXNlPGFueVtdPiB7XHJcbiAgICByZXR1cm4gdGhpcy5icm9hZGNhc3RFdmFsKGB0aGlzLiR7cHJvcH1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlc3Bhd24gYWxsIHNoYXJkc1xyXG4gICAqL1xyXG4gIGFzeW5jIHJlc3Bhd25BbGwob3B0aW9ucz86IHtcclxuICAgIHNoYXJkRGVsYXk/OiBudW1iZXI7XHJcbiAgICByZXNwYXduRGVsYXk/OiBudW1iZXI7XHJcbiAgICB0aW1lb3V0PzogbnVtYmVyO1xyXG4gIH0pOiBQcm9taXNlPE1hcDxudW1iZXIsIFNoYXJkPj4ge1xyXG4gICAgZm9yIChjb25zdCBzaGFyZCBvZiB0aGlzLnNoYXJkcy52YWx1ZXMoKSkge1xyXG4gICAgICBhd2FpdCBzaGFyZC5yZXNwYXduKHsgZGVsYXk6IG9wdGlvbnM/LnJlc3Bhd25EZWxheSwgdGltZW91dDogb3B0aW9ucz8udGltZW91dCB9KTtcclxuICAgICAgaWYgKG9wdGlvbnM/LnNoYXJkRGVsYXkpIHtcclxuICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZShyID0+IHNldFRpbWVvdXQociwgb3B0aW9ucy5zaGFyZERlbGF5KSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzLnNoYXJkcztcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTaGFyZCBjbGllbnQgdXRpbGl0aWVzIC0gdXNlIGluIGJvdCBmaWxlXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgU2hhcmRDbGllbnRVdGlsIHtcclxuICAvKiogVGhlIGNsaWVudCAqL1xyXG4gIHB1YmxpYyBjbGllbnQ6IGFueTtcclxuICAvKiogVGhlIHNoYXJkIElEICovXHJcbiAgcHVibGljIGlkOiBudW1iZXI7XHJcbiAgLyoqIFRvdGFsIHNoYXJkIGNvdW50ICovXHJcbiAgcHVibGljIGNvdW50OiBudW1iZXI7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGNsaWVudDogYW55KSB7XHJcbiAgICB0aGlzLmNsaWVudCA9IGNsaWVudDtcclxuICAgIHRoaXMuaWQgPSBwYXJzZUludChwcm9jZXNzLmVudi5TSEFSRF9JRCA/PyAnMCcsIDEwKTtcclxuICAgIHRoaXMuY291bnQgPSBwYXJzZUludChwcm9jZXNzLmVudi5TSEFSRF9DT1VOVCA/PyAnMScsIDEwKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNlbmQgYSBtZXNzYWdlIHRvIHRoZSBwYXJlbnQgcHJvY2Vzc1xyXG4gICAqL1xyXG4gIHNlbmQobWVzc2FnZTogYW55KTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICBwcm9jZXNzLnNlbmQ/LihtZXNzYWdlLCAoZXJyOiBFcnJvciB8IG51bGwpID0+IHtcclxuICAgICAgICBpZiAoZXJyKSByZWplY3QoZXJyKTtcclxuICAgICAgICBlbHNlIHJlc29sdmUoKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEZldGNoIGEgY2xpZW50IHZhbHVlIGZyb20gYWxsIHNoYXJkc1xyXG4gICAqL1xyXG4gIGFzeW5jIGZldGNoQ2xpZW50VmFsdWVzKHByb3A6IHN0cmluZyk6IFByb21pc2U8YW55W10+IHtcclxuICAgIHJldHVybiB0aGlzLmJyb2FkY2FzdEV2YWwoYHRoaXMuJHtwcm9wfWApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQnJvYWRjYXN0IGFuIGV2YWwgdG8gYWxsIHNoYXJkc1xyXG4gICAqL1xyXG4gIGFzeW5jIGJyb2FkY2FzdEV2YWw8VD4oc2NyaXB0OiBzdHJpbmcgfCAoKGNsaWVudDogYW55KSA9PiBUKSk6IFByb21pc2U8VFtdPiB7XHJcbiAgICBjb25zdCBfZXZhbCA9IHR5cGVvZiBzY3JpcHQgPT09ICdmdW5jdGlvbicgPyBgKCR7c2NyaXB0fSkodGhpcylgIDogc2NyaXB0O1xyXG4gICAgXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICBjb25zdCBpZCA9IERhdGUubm93KCkudG9TdHJpbmcoMzYpICsgTWF0aC5yYW5kb20oKS50b1N0cmluZygzNik7XHJcbiAgICAgIFxyXG4gICAgICBjb25zdCBoYW5kbGVyID0gKG1lc3NhZ2U6IGFueSkgPT4ge1xyXG4gICAgICAgIGlmIChtZXNzYWdlLl9icm9hZGNhc3RFdmFsSWQgIT09IGlkKSByZXR1cm47XHJcbiAgICAgICAgcHJvY2Vzcy5vZmYoJ21lc3NhZ2UnLCBoYW5kbGVyKTtcclxuICAgICAgICBcclxuICAgICAgICBpZiAobWVzc2FnZS5fZXJyb3IpIHtcclxuICAgICAgICAgIC8vIFByZXNlcnZlIHN0YWNrIHRyYWNlIGZyb20gdGhlIHNoYXJkIHByb2Nlc3MgaWYgYXZhaWxhYmxlXHJcbiAgICAgICAgICBjb25zdCBlcnJvciA9IG5ldyBFcnJvcihtZXNzYWdlLl9lcnJvcik7XHJcbiAgICAgICAgICBpZiAobWVzc2FnZS5fZXJyb3JTdGFjaykge1xyXG4gICAgICAgICAgICBlcnJvci5zdGFjayA9IG1lc3NhZ2UuX2Vycm9yU3RhY2s7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICByZWplY3QoZXJyb3IpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICByZXNvbHZlKG1lc3NhZ2UuX3Jlc3VsdHMpO1xyXG4gICAgICAgIH1cclxuICAgICAgfTtcclxuICAgICAgXHJcbiAgICAgIHByb2Nlc3Mub24oJ21lc3NhZ2UnLCBoYW5kbGVyKTtcclxuICAgICAgdGhpcy5zZW5kKHsgX2Jyb2FkY2FzdEV2YWw6IF9ldmFsLCBfYnJvYWRjYXN0RXZhbElkOiBpZCB9KS5jYXRjaChyZWplY3QpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTaWduYWwgcmVhZHkgdG8gdGhlIHBhcmVudCBwcm9jZXNzXHJcbiAgICovXHJcbiAgcmVhZHkoKTogdm9pZCB7XHJcbiAgICBwcm9jZXNzLnNlbmQ/Lih7IF9yZWFkeTogdHJ1ZSB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCB0aGUgc2hhcmQgSUQgZm9yIGEgZ3VpbGRcclxuICAgKi9cclxuICBzdGF0aWMgc2hhcmRJZEZvckd1aWxkSWQoZ3VpbGRJZDogc3RyaW5nLCBzaGFyZENvdW50OiBudW1iZXIpOiBudW1iZXIge1xyXG4gICAgY29uc3QgaWQgPSBCaWdJbnQoZ3VpbGRJZCk7XHJcbiAgICByZXR1cm4gTnVtYmVyKGlkID4+IDIybikgJSBzaGFyZENvdW50O1xyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgU2hhcmRpbmdNYW5hZ2VyO1xyXG4iXX0=