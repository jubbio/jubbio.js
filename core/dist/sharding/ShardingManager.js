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
     *
     * ⚠️ SECURITY WARNING: This method internally uses eval().
     * While it looks safer than direct eval(), it carries the same risks.
     * NEVER pass user input to this method - it will result in Remote Code Execution (RCE).
     *
     * @param prop - Property path to fetch (e.g., 'guilds.cache.size')
     * @returns Promise resolving to the property value
     *
     * @example
     * // Safe: hardcoded property
     * const guildCount = await shard.fetchClientValue('guilds.cache.size');
     *
     * // UNSAFE: user input - DO NOT DO THIS!
     * // await shard.fetchClientValue(userMessage); // RCE vulnerability!
     */
    async fetchClientValue(prop) {
        // SECURITY: Validate prop to prevent code injection
        // Only allow alphanumeric characters, dots, underscores, and array brackets
        if (!/^[\w.[\]]+$/.test(prop)) {
            throw new Error(`Invalid property path: contains disallowed characters`);
        }
        // SECURITY: Block obvious code injection attempts
        const dangerousPatterns = [
            /\bprocess\b/,
            /\brequire\b/,
            /\bimport\b/,
            /\beval\b/,
            /\bFunction\b/,
            /\bconstructor\b/,
            /\b__proto__\b/,
            /\bprototype\b/,
        ];
        for (const pattern of dangerousPatterns) {
            if (pattern.test(prop)) {
                throw new Error(`Invalid property path: contains dangerous pattern`);
            }
        }
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
     *
     * ⚠️ SECURITY WARNING: This method executes arbitrary code on all shard processes.
     * NEVER pass user input to this method - it will result in Remote Code Execution (RCE).
     */
    async broadcastEval(script) {
        const promises = [...this.shards.values()].map(shard => shard.eval(script));
        return Promise.all(promises);
    }
    /**
     * Fetch a client value from all shards
     *
     * ⚠️ SECURITY WARNING: This method internally uses broadcastEval() which executes code.
     * While it looks safer than direct eval(), it carries the same risks.
     * NEVER pass user input to this method - it will result in Remote Code Execution (RCE).
     *
     * @param prop - Property path to fetch (e.g., 'guilds.cache.size')
     * @returns Promise resolving to array of property values from all shards
     *
     * @example
     * // Safe: hardcoded property
     * const guildCounts = await manager.fetchClientValues('guilds.cache.size');
     *
     * // UNSAFE: user input - DO NOT DO THIS!
     * // await manager.fetchClientValues(userMessage); // RCE vulnerability!
     */
    async fetchClientValues(prop) {
        // SECURITY: Validate prop to prevent code injection
        // Only allow alphanumeric characters, dots, underscores, and array brackets
        if (!/^[\w.[\]]+$/.test(prop)) {
            throw new Error(`Invalid property path: contains disallowed characters`);
        }
        // SECURITY: Block obvious code injection attempts
        const dangerousPatterns = [
            /\bprocess\b/,
            /\brequire\b/,
            /\bimport\b/,
            /\beval\b/,
            /\bFunction\b/,
            /\bconstructor\b/,
            /\b__proto__\b/,
            /\bprototype\b/,
        ];
        for (const pattern of dangerousPatterns) {
            if (pattern.test(prop)) {
                throw new Error(`Invalid property path: contains dangerous pattern`);
            }
        }
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
     *
     * ⚠️ SECURITY WARNING: This method internally uses broadcastEval() which executes code.
     * While it looks safer than direct eval(), it carries the same risks.
     * NEVER pass user input to this method - it will result in Remote Code Execution (RCE).
     *
     * @param prop - Property path to fetch (e.g., 'guilds.cache.size')
     * @returns Promise resolving to array of property values from all shards
     */
    async fetchClientValues(prop) {
        // SECURITY: Validate prop to prevent code injection
        if (!/^[\w.[\]]+$/.test(prop)) {
            throw new Error(`Invalid property path: contains disallowed characters`);
        }
        const dangerousPatterns = [
            /\bprocess\b/, /\brequire\b/, /\bimport\b/, /\beval\b/,
            /\bFunction\b/, /\bconstructor\b/, /\b__proto__\b/, /\bprototype\b/,
        ];
        for (const pattern of dangerousPatterns) {
            if (pattern.test(prop)) {
                throw new Error(`Invalid property path: contains dangerous pattern`);
            }
        }
        return this.broadcastEval(`this.${prop}`);
    }
    /**
     * Broadcast an eval to all shards
     *
     * ⚠️ SECURITY WARNING: This method executes arbitrary code on all shard processes.
     * NEVER pass user input to this method - it will result in Remote Code Execution (RCE).
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU2hhcmRpbmdNYW5hZ2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3NoYXJkaW5nL1NoYXJkaW5nTWFuYWdlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBb0JHOzs7Ozs7QUFFSCxtQ0FBc0M7QUFDdEMsaURBQW1EO0FBQ25ELGdEQUF3QjtBQUV4Qjs7R0FFRztBQUNILElBQVksV0FVWDtBQVZELFdBQVksV0FBVztJQUNyQiwrQ0FBUyxDQUFBO0lBQ1QseURBQWMsQ0FBQTtJQUNkLDZEQUFnQixDQUFBO0lBQ2hCLDZDQUFRLENBQUE7SUFDUixpREFBVSxDQUFBO0lBQ1YsNkRBQWdCLENBQUE7SUFDaEIscUVBQW9CLENBQUE7SUFDcEIsMkRBQWUsQ0FBQTtJQUNmLHFEQUFZLENBQUE7QUFDZCxDQUFDLEVBVlcsV0FBVywyQkFBWCxXQUFXLFFBVXRCO0FBc0JEOztHQUVHO0FBQ0gsTUFBYSxLQUFNLFNBQVEscUJBQVk7SUFDckMsMENBQTBDO0lBQ25DLE9BQU8sQ0FBa0I7SUFDaEMsbUJBQW1CO0lBQ1osRUFBRSxDQUFTO0lBQ2xCLHdCQUF3QjtJQUNqQixPQUFPLEdBQXdCLElBQUksQ0FBQztJQUMzQyxpQ0FBaUM7SUFDMUIsS0FBSyxHQUFZLEtBQUssQ0FBQztJQUM5QixtQkFBbUI7SUFDWixNQUFNLEdBQWdCLFdBQVcsQ0FBQyxJQUFJLENBQUM7SUFDOUMsMENBQTBDO0lBQ2xDLEdBQUcsQ0FBeUI7SUFFcEMsWUFBWSxPQUF3QixFQUFFLEVBQVU7UUFDOUMsS0FBSyxFQUFFLENBQUM7UUFDUixJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztRQUN2QixJQUFJLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQztRQUNiLElBQUksQ0FBQyxHQUFHLEdBQUc7WUFDVCxRQUFRLEVBQUUsTUFBTSxDQUFDLEVBQUUsQ0FBQztZQUNwQixXQUFXLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUM7WUFDeEMsWUFBWSxFQUFFLE9BQU8sQ0FBQyxLQUFLLElBQUksRUFBRTtTQUNsQyxDQUFDO0lBQ0osQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsS0FBSztRQUN6QixJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNqQixNQUFNLElBQUksS0FBSyxDQUFDLFNBQVMsSUFBSSxDQUFDLEVBQUUsd0JBQXdCLENBQUMsQ0FBQztRQUM1RCxDQUFDO1FBRUQsSUFBSSxDQUFDLE1BQU0sR0FBRyxXQUFXLENBQUMsVUFBVSxDQUFDO1FBRXJDLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBQSxvQkFBSSxFQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFO1lBQzdELEdBQUcsRUFBRSxFQUFFLEdBQUcsT0FBTyxDQUFDLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUU7WUFDcEMsUUFBUSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUTtTQUNoQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUMzRCxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUNyRCxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUV2RCxpQkFBaUI7UUFDakIsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRTtZQUNyQyxNQUFNLEtBQUssR0FBRyxVQUFVLENBQUMsR0FBRyxFQUFFO2dCQUM1QixNQUFNLENBQUMsSUFBSSxLQUFLLENBQUMsU0FBUyxJQUFJLENBQUMsRUFBRSxnQ0FBZ0MsQ0FBQyxDQUFDLENBQUM7WUFDdEUsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBRVosSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsR0FBRyxFQUFFO2dCQUN0QixZQUFZLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQ3BCLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBUSxDQUFDLENBQUM7WUFDekIsQ0FBQyxDQUFDLENBQUM7WUFFSCxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxHQUFHLEVBQUU7Z0JBQzNCLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDcEIsTUFBTSxDQUFDLElBQUksS0FBSyxDQUFDLFNBQVMsSUFBSSxDQUFDLEVBQUUscUNBQXFDLENBQUMsQ0FBQyxDQUFDO1lBQzNFLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxJQUFJO1FBQ0YsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDakIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1lBQ2xDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDcEIsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7UUFDdEIsQ0FBQztRQUNELElBQUksQ0FBQyxNQUFNLEdBQUcsV0FBVyxDQUFDLFlBQVksQ0FBQztRQUN2QyxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztJQUNyQixDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsT0FBTyxDQUFDLE9BQThDO1FBQzFELElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNaLElBQUksT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDO1lBQ25CLE1BQU0sSUFBSSxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBQ3ZELENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQ3RDLENBQUM7SUFFRDs7T0FFRztJQUNILElBQUksQ0FBQyxPQUFZO1FBQ2YsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRTtZQUNyQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUNsQixNQUFNLENBQUMsSUFBSSxLQUFLLENBQUMsU0FBUyxJQUFJLENBQUMsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDLENBQUM7Z0JBQ3JELE9BQU87WUFDVCxDQUFDO1lBQ0QsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMsR0FBRyxFQUFFLEVBQUU7Z0JBQ2pDLElBQUksR0FBRztvQkFBRSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7O29CQUNoQixPQUFPLEVBQUUsQ0FBQztZQUNqQixDQUFDLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOzs7Ozs7Ozs7Ozs7Ozs7T0FlRztJQUNILEtBQUssQ0FBQyxJQUFJLENBQUksTUFBcUM7UUFDakQsOENBQThDO1FBQzlDLElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEtBQUssYUFBYSxFQUFFLENBQUM7WUFDM0MsT0FBTyxDQUFDLElBQUksQ0FBQyxVQUFVLElBQUksQ0FBQyxFQUFFLHNEQUFzRCxDQUFDLENBQUM7UUFDeEYsQ0FBQztRQUVELE1BQU0sS0FBSyxHQUFHLE9BQU8sTUFBTSxLQUFLLFVBQVUsQ0FBQyxDQUFDLENBQUMsSUFBSSxNQUFNLFNBQVMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDO1FBRTFFLE9BQU8sSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUU7WUFDckMsTUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBRWhFLE1BQU0sT0FBTyxHQUFHLENBQUMsT0FBWSxFQUFFLEVBQUU7Z0JBQy9CLElBQUksT0FBTyxDQUFDLE9BQU8sS0FBSyxFQUFFO29CQUFFLE9BQU87Z0JBQ25DLElBQUksQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUFDLFNBQVMsRUFBRSxPQUFPLENBQUMsQ0FBQztnQkFFdEMsSUFBSSxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUM7b0JBQ25CLDJEQUEyRDtvQkFDM0QsTUFBTSxLQUFLLEdBQUcsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO29CQUN4QyxJQUFJLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQzt3QkFDeEIsS0FBSyxDQUFDLEtBQUssR0FBRyxPQUFPLENBQUMsV0FBVyxDQUFDO29CQUNwQyxDQUFDO29CQUNELE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDaEIsQ0FBQztxQkFBTSxDQUFDO29CQUNOLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQzNCLENBQUM7WUFDSCxDQUFDLENBQUM7WUFFRixJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQyxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDckMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDbEQsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7T0FnQkc7SUFDSCxLQUFLLENBQUMsZ0JBQWdCLENBQUMsSUFBWTtRQUNqQyxvREFBb0Q7UUFDcEQsNEVBQTRFO1FBQzVFLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDOUIsTUFBTSxJQUFJLEtBQUssQ0FBQyx1REFBdUQsQ0FBQyxDQUFDO1FBQzNFLENBQUM7UUFFRCxrREFBa0Q7UUFDbEQsTUFBTSxpQkFBaUIsR0FBRztZQUN4QixhQUFhO1lBQ2IsYUFBYTtZQUNiLFlBQVk7WUFDWixVQUFVO1lBQ1YsY0FBYztZQUNkLGlCQUFpQjtZQUNqQixlQUFlO1lBQ2YsZUFBZTtTQUNoQixDQUFDO1FBRUYsS0FBSyxNQUFNLE9BQU8sSUFBSSxpQkFBaUIsRUFBRSxDQUFDO1lBQ3hDLElBQUksT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO2dCQUN2QixNQUFNLElBQUksS0FBSyxDQUFDLG1EQUFtRCxDQUFDLENBQUM7WUFDdkUsQ0FBQztRQUNILENBQUM7UUFFRCxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQ25DLENBQUM7SUFFTyxjQUFjLENBQUMsT0FBWTtRQUNqQyxJQUFJLE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNuQixJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQztZQUNsQixJQUFJLENBQUMsTUFBTSxHQUFHLFdBQVcsQ0FBQyxLQUFLLENBQUM7WUFDaEMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUNuQixJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQ3pDLE9BQU87UUFDVCxDQUFDO1FBRUQsSUFBSSxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUM7WUFDeEIsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7WUFDbkIsSUFBSSxDQUFDLE1BQU0sR0FBRyxXQUFXLENBQUMsWUFBWSxDQUFDO1lBQ3ZDLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7WUFDeEIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQzlDLE9BQU87UUFDVCxDQUFDO1FBRUQsSUFBSSxPQUFPLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDMUIsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7WUFDbkIsSUFBSSxDQUFDLE1BQU0sR0FBRyxXQUFXLENBQUMsWUFBWSxDQUFDO1lBQ3ZDLElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7WUFDMUIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsbUJBQW1CLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQ2hELE9BQU87UUFDVCxDQUFDO1FBRUQsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDOUIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxFQUFFLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDakQsQ0FBQztJQUVPLFdBQVcsQ0FBQyxJQUFZLEVBQUUsTUFBYztRQUM5QyxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUNuQixJQUFJLENBQUMsTUFBTSxHQUFHLFdBQVcsQ0FBQyxZQUFZLENBQUM7UUFDdkMsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7UUFFcEIsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQztRQUNyQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLEVBQUUsRUFBRSxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDO1FBRTNELElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUN6QixJQUFJLENBQUMsS0FBSyxFQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFO2dCQUN2QixJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsSUFBSSxDQUFDLEVBQUUsRUFBRSxHQUFHLENBQUMsQ0FBQztZQUNoRCxDQUFDLENBQUMsQ0FBQztRQUNMLENBQUM7SUFDSCxDQUFDO0lBRU8sWUFBWSxDQUFDLEtBQVk7UUFDL0IsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDMUIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLElBQUksQ0FBQyxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDbEQsQ0FBQztDQUNGO0FBblBELHNCQW1QQztBQUVEOztHQUVHO0FBQ0gsTUFBYSxlQUFnQixTQUFRLHFCQUFZO0lBQy9DLDJCQUEyQjtJQUNwQixJQUFJLENBQVM7SUFDcEIsNkJBQTZCO0lBQ3RCLFdBQVcsQ0FBa0I7SUFDcEMsaUNBQWlDO0lBQzFCLFNBQVMsQ0FBVztJQUMzQixvQkFBb0I7SUFDYixJQUFJLENBQXVCO0lBQ2xDLGdDQUFnQztJQUN6QixPQUFPLENBQVU7SUFDeEIsa0NBQWtDO0lBQzNCLFNBQVMsQ0FBVztJQUMzQixnQ0FBZ0M7SUFDekIsUUFBUSxDQUFXO0lBQzFCLGdCQUFnQjtJQUNULEtBQUssQ0FBVTtJQUN0QiwyQkFBMkI7SUFDcEIsTUFBTSxHQUF1QixJQUFJLEdBQUcsRUFBRSxDQUFDO0lBRTlDLFlBQVksSUFBWSxFQUFFLFVBQWtDLEVBQUU7UUFDNUQsS0FBSyxFQUFFLENBQUM7UUFFUixJQUFJLENBQUMsSUFBSSxHQUFHLGNBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDL0IsSUFBSSxDQUFDLFdBQVcsR0FBRyxPQUFPLENBQUMsV0FBVyxJQUFJLE1BQU0sQ0FBQztRQUNqRCxJQUFJLENBQUMsU0FBUyxHQUFHLE9BQU8sQ0FBQyxTQUFTLEtBQUssTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUMvRSxJQUFJLENBQUMsSUFBSSxHQUFHLE9BQU8sQ0FBQyxJQUFJLElBQUksU0FBUyxDQUFDO1FBQ3RDLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUM7UUFDdkMsSUFBSSxDQUFDLFNBQVMsR0FBRyxPQUFPLENBQUMsU0FBUyxJQUFJLEVBQUUsQ0FBQztRQUN6QyxJQUFJLENBQUMsUUFBUSxHQUFHLE9BQU8sQ0FBQyxRQUFRLElBQUksRUFBRSxDQUFDO1FBQ3ZDLElBQUksQ0FBQyxLQUFLLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQztJQUM3QixDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsS0FBSyxDQUFDLE9BSVg7UUFDQyx3QkFBd0I7UUFDeEIsSUFBSSxJQUFJLENBQUMsV0FBVyxLQUFLLE1BQU0sSUFBSSxPQUFPLEVBQUUsTUFBTSxLQUFLLE1BQU0sRUFBRSxDQUFDO1lBQzlELElBQUksQ0FBQyxXQUFXLEdBQUcsTUFBTSxJQUFJLENBQUMsc0JBQXNCLEVBQUUsQ0FBQztRQUN6RCxDQUFDO2FBQU0sSUFBSSxPQUFPLEVBQUUsTUFBTSxFQUFFLENBQUM7WUFDM0IsSUFBSSxDQUFDLFdBQVcsR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDO1FBQ3BDLENBQUM7UUFFRCxvQ0FBb0M7UUFDcEMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUNoQyxJQUFJLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDLFdBQXFCLEVBQUUsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ25GLENBQUM7UUFFRCx1Q0FBdUM7UUFDdkMsTUFBTSxLQUFLLEdBQUcsT0FBTyxFQUFFLEtBQUssSUFBSSxJQUFJLENBQUM7UUFFckMsS0FBSyxNQUFNLEVBQUUsSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDaEMsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUNuQyxNQUFNLEtBQUssQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBRXBDLElBQUksRUFBRSxLQUFLLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQztnQkFDckQsTUFBTSxJQUFJLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQztZQUMvQyxDQUFDO1FBQ0gsQ0FBQztRQUVELE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQztJQUNyQixDQUFDO0lBRUQ7O09BRUc7SUFDSCxXQUFXLENBQUMsRUFBVTtRQUNwQixNQUFNLEtBQUssR0FBRyxJQUFJLEtBQUssQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDbEMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzNCLE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUVEOzs7T0FHRztJQUNILEtBQUssQ0FBQyxzQkFBc0I7UUFDMUIsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNoQixPQUFPLENBQUMsSUFBSSxDQUFDLG9FQUFvRSxDQUFDLENBQUM7WUFDbkYsT0FBTyxDQUFDLENBQUM7UUFDWCxDQUFDO1FBRUQsSUFBSSxDQUFDO1lBQ0gsMERBQTBEO1lBQzFELE1BQU0sUUFBUSxHQUFHLE1BQU0sS0FBSyxDQUFDLCtDQUErQyxFQUFFO2dCQUM1RSxNQUFNLEVBQUUsS0FBSztnQkFDYixPQUFPLEVBQUU7b0JBQ1AsZUFBZSxFQUFFLE9BQU8sSUFBSSxDQUFDLEtBQUssRUFBRTtvQkFDcEMsY0FBYyxFQUFFLGtCQUFrQjtvQkFDbEMsWUFBWSxFQUFFLHFDQUFxQztpQkFDcEQ7YUFDRixDQUFDLENBQUM7WUFFSCxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsRUFBRSxDQUFDO2dCQUNqQixPQUFPLENBQUMsSUFBSSxDQUFDLHlEQUF5RCxRQUFRLENBQUMsTUFBTSxzQkFBc0IsQ0FBQyxDQUFDO2dCQUM3RyxPQUFPLENBQUMsQ0FBQztZQUNYLENBQUM7WUFFRCxNQUFNLElBQUksR0FBRyxNQUFNLFFBQVEsQ0FBQyxJQUFJLEVBQXlCLENBQUM7WUFDMUQsT0FBTyxJQUFJLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQztRQUMxQixDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNmLE9BQU8sQ0FBQyxJQUFJLENBQUMsMEVBQTBFLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDaEcsT0FBTyxDQUFDLENBQUM7UUFDWCxDQUFDO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLFNBQVMsQ0FBQyxPQUFZO1FBQzFCLE1BQU0sUUFBUSxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1FBQzdFLE9BQU8sT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUMvQixDQUFDO0lBRUQ7Ozs7O09BS0c7SUFDSCxLQUFLLENBQUMsYUFBYSxDQUFJLE1BQXFDO1FBQzFELE1BQU0sUUFBUSxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBQzVFLE9BQU8sT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUMvQixDQUFDO0lBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7T0FnQkc7SUFDSCxLQUFLLENBQUMsaUJBQWlCLENBQUMsSUFBWTtRQUNsQyxvREFBb0Q7UUFDcEQsNEVBQTRFO1FBQzVFLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDOUIsTUFBTSxJQUFJLEtBQUssQ0FBQyx1REFBdUQsQ0FBQyxDQUFDO1FBQzNFLENBQUM7UUFFRCxrREFBa0Q7UUFDbEQsTUFBTSxpQkFBaUIsR0FBRztZQUN4QixhQUFhO1lBQ2IsYUFBYTtZQUNiLFlBQVk7WUFDWixVQUFVO1lBQ1YsY0FBYztZQUNkLGlCQUFpQjtZQUNqQixlQUFlO1lBQ2YsZUFBZTtTQUNoQixDQUFDO1FBRUYsS0FBSyxNQUFNLE9BQU8sSUFBSSxpQkFBaUIsRUFBRSxDQUFDO1lBQ3hDLElBQUksT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO2dCQUN2QixNQUFNLElBQUksS0FBSyxDQUFDLG1EQUFtRCxDQUFDLENBQUM7WUFDdkUsQ0FBQztRQUNILENBQUM7UUFFRCxPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBUSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxVQUFVLENBQUMsT0FJaEI7UUFDQyxLQUFLLE1BQU0sS0FBSyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQztZQUN6QyxNQUFNLEtBQUssQ0FBQyxPQUFPLENBQUMsRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLFlBQVksRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUM7WUFDakYsSUFBSSxPQUFPLEVBQUUsVUFBVSxFQUFFLENBQUM7Z0JBQ3hCLE1BQU0sSUFBSSxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO1lBQzVELENBQUM7UUFDSCxDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDO0lBQ3JCLENBQUM7Q0FDRjtBQS9MRCwwQ0ErTEM7QUFFRDs7R0FFRztBQUNILE1BQWEsZUFBZTtJQUMxQixpQkFBaUI7SUFDVixNQUFNLENBQU07SUFDbkIsbUJBQW1CO0lBQ1osRUFBRSxDQUFTO0lBQ2xCLHdCQUF3QjtJQUNqQixLQUFLLENBQVM7SUFFckIsWUFBWSxNQUFXO1FBQ3JCLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1FBQ3JCLElBQUksQ0FBQyxFQUFFLEdBQUcsUUFBUSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxJQUFJLEdBQUcsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUNwRCxJQUFJLENBQUMsS0FBSyxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFdBQVcsSUFBSSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDNUQsQ0FBQztJQUVEOztPQUVHO0lBQ0gsSUFBSSxDQUFDLE9BQVk7UUFDZixPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxFQUFFO1lBQ3JDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxHQUFpQixFQUFFLEVBQUU7Z0JBQzVDLElBQUksR0FBRztvQkFBRSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7O29CQUNoQixPQUFPLEVBQUUsQ0FBQztZQUNqQixDQUFDLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOzs7Ozs7Ozs7T0FTRztJQUNILEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxJQUFZO1FBQ2xDLG9EQUFvRDtRQUNwRCxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1lBQzlCLE1BQU0sSUFBSSxLQUFLLENBQUMsdURBQXVELENBQUMsQ0FBQztRQUMzRSxDQUFDO1FBRUQsTUFBTSxpQkFBaUIsR0FBRztZQUN4QixhQUFhLEVBQUUsYUFBYSxFQUFFLFlBQVksRUFBRSxVQUFVO1lBQ3RELGNBQWMsRUFBRSxpQkFBaUIsRUFBRSxlQUFlLEVBQUUsZUFBZTtTQUNwRSxDQUFDO1FBRUYsS0FBSyxNQUFNLE9BQU8sSUFBSSxpQkFBaUIsRUFBRSxDQUFDO1lBQ3hDLElBQUksT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO2dCQUN2QixNQUFNLElBQUksS0FBSyxDQUFDLG1EQUFtRCxDQUFDLENBQUM7WUFDdkUsQ0FBQztRQUNILENBQUM7UUFFRCxPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBUSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFFRDs7Ozs7T0FLRztJQUNILEtBQUssQ0FBQyxhQUFhLENBQUksTUFBcUM7UUFDMUQsTUFBTSxLQUFLLEdBQUcsT0FBTyxNQUFNLEtBQUssVUFBVSxDQUFDLENBQUMsQ0FBQyxJQUFJLE1BQU0sU0FBUyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUM7UUFFMUUsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUUsRUFBRTtZQUNyQyxNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLENBQUM7WUFFaEUsTUFBTSxPQUFPLEdBQUcsQ0FBQyxPQUFZLEVBQUUsRUFBRTtnQkFDL0IsSUFBSSxPQUFPLENBQUMsZ0JBQWdCLEtBQUssRUFBRTtvQkFBRSxPQUFPO2dCQUM1QyxPQUFPLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxPQUFPLENBQUMsQ0FBQztnQkFFaEMsSUFBSSxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUM7b0JBQ25CLDJEQUEyRDtvQkFDM0QsTUFBTSxLQUFLLEdBQUcsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO29CQUN4QyxJQUFJLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBQzt3QkFDeEIsS0FBSyxDQUFDLEtBQUssR0FBRyxPQUFPLENBQUMsV0FBVyxDQUFDO29CQUNwQyxDQUFDO29CQUNELE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDaEIsQ0FBQztxQkFBTSxDQUFDO29CQUNOLE9BQU8sQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQzVCLENBQUM7WUFDSCxDQUFDLENBQUM7WUFFRixPQUFPLENBQUMsRUFBRSxDQUFDLFNBQVMsRUFBRSxPQUFPLENBQUMsQ0FBQztZQUMvQixJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsY0FBYyxFQUFFLEtBQUssRUFBRSxnQkFBZ0IsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUMzRSxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUs7UUFDSCxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztJQUNuQyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxNQUFNLENBQUMsaUJBQWlCLENBQUMsT0FBZSxFQUFFLFVBQWtCO1FBQzFELE1BQU0sRUFBRSxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUMzQixPQUFPLE1BQU0sQ0FBQyxFQUFFLElBQUksR0FBRyxDQUFDLEdBQUcsVUFBVSxDQUFDO0lBQ3hDLENBQUM7Q0FDRjtBQXZHRCwwQ0F1R0M7QUFFRCxrQkFBZSxlQUFlLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogU2hhcmRpbmdNYW5hZ2VyIC0gTXVsdGktcHJvY2VzcyBib3Qgc3VwcG9ydFxyXG4gKiBcclxuICogU0VDVVJJVFkgV0FSTklORzogVGhpcyBtb2R1bGUgY29udGFpbnMgZXZhbCgpIGZ1bmN0aW9uYWxpdHkgZm9yIGNyb3NzLXNoYXJkIGNvbW11bmljYXRpb24uXHJcbiAqIFRoZSBldmFsKCkgbWV0aG9kIGV4ZWN1dGVzIGFyYml0cmFyeSBjb2RlIGFuZCBzaG91bGQgTkVWRVIgYmUgZXhwb3NlZCB0byBleHRlcm5hbCB1c2Vycy5cclxuICogXHJcbiAqIFNhZmUgdXNhZ2U6XHJcbiAqIC0gT25seSBjYWxsIGV2YWwoKSB3aXRoIGNvZGUgeW91IHdyb3RlIHlvdXJzZWxmXHJcbiAqIC0gTmV2ZXIgcGFzcyB1c2VyIGlucHV0IHRvIGV2YWwoKVxyXG4gKiAtIE5ldmVyIGV4cG9zZSBldmFsKCkgdGhyb3VnaCBjb21tYW5kcyBvciBBUElzXHJcbiAqIFxyXG4gKiBFeGFtcGxlIG9mIFVOU0FGRSBjb2RlIChETyBOT1QgRE8gVEhJUyk6XHJcbiAqIGBgYGpzXHJcbiAqIC8vIERBTkdFUk9VUyAtIHVzZXIgY2FuIGV4ZWN1dGUgYXJiaXRyYXJ5IGNvZGUhXHJcbiAqIGNsaWVudC5vbignbWVzc2FnZUNyZWF0ZScsIChtc2cpID0+IHtcclxuICogICBpZiAobXNnLmNvbnRlbnQuc3RhcnRzV2l0aCgnIWV2YWwnKSkge1xyXG4gKiAgICAgc2hhcmQuZXZhbChtc2cuY29udGVudC5zbGljZSg2KSk7IC8vIFJDRSBWVUxORVJBQklMSVRZIVxyXG4gKiAgIH1cclxuICogfSk7XHJcbiAqIGBgYFxyXG4gKi9cclxuXHJcbmltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gJ2V2ZW50cyc7XHJcbmltcG9ydCB7IGZvcmssIENoaWxkUHJvY2VzcyB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xyXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcclxuXHJcbi8qKlxyXG4gKiBTaGFyZCBzdGF0dXNcclxuICovXHJcbmV4cG9ydCBlbnVtIFNoYXJkU3RhdHVzIHtcclxuICBSZWFkeSA9IDAsXHJcbiAgQ29ubmVjdGluZyA9IDEsXHJcbiAgUmVjb25uZWN0aW5nID0gMixcclxuICBJZGxlID0gMyxcclxuICBOZWFybHkgPSA0LFxyXG4gIERpc2Nvbm5lY3RlZCA9IDUsXHJcbiAgV2FpdGluZ0Zvckd1aWxkcyA9IDYsXHJcbiAgSWRlbnRpZnlpbmcgPSA3LFxyXG4gIFJlc3VtaW5nID0gOCxcclxufVxyXG5cclxuLyoqXHJcbiAqIE9wdGlvbnMgZm9yIFNoYXJkaW5nTWFuYWdlclxyXG4gKi9cclxuZXhwb3J0IGludGVyZmFjZSBTaGFyZGluZ01hbmFnZXJPcHRpb25zIHtcclxuICAvKiogVG90YWwgbnVtYmVyIG9mIHNoYXJkcyAoYXV0byBpZiBub3Qgc3BlY2lmaWVkKSAqL1xyXG4gIHRvdGFsU2hhcmRzPzogbnVtYmVyIHwgJ2F1dG8nO1xyXG4gIC8qKiBTcGVjaWZpYyBzaGFyZCBJRHMgdG8gc3Bhd24gKi9cclxuICBzaGFyZExpc3Q/OiBudW1iZXJbXSB8ICdhdXRvJztcclxuICAvKiogU2hhcmRpbmcgbW9kZSAqL1xyXG4gIG1vZGU/OiAncHJvY2VzcycgfCAnd29ya2VyJztcclxuICAvKiogUmVzcGF3biBzaGFyZHMgb24gZXhpdCAqL1xyXG4gIHJlc3Bhd24/OiBib29sZWFuO1xyXG4gIC8qKiBBcmd1bWVudHMgdG8gcGFzcyB0byBzaGFyZHMgKi9cclxuICBzaGFyZEFyZ3M/OiBzdHJpbmdbXTtcclxuICAvKiogQXJndW1lbnRzIHRvIHBhc3MgdG8gbm9kZSAqL1xyXG4gIGV4ZWNBcmd2Pzogc3RyaW5nW107XHJcbiAgLyoqIEJvdCB0b2tlbiAqL1xyXG4gIHRva2VuPzogc3RyaW5nO1xyXG59XHJcblxyXG4vKipcclxuICogUmVwcmVzZW50cyBhIHNpbmdsZSBzaGFyZFxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFNoYXJkIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcclxuICAvKiogVGhlIG1hbmFnZXIgdGhhdCBzcGF3bmVkIHRoaXMgc2hhcmQgKi9cclxuICBwdWJsaWMgbWFuYWdlcjogU2hhcmRpbmdNYW5hZ2VyO1xyXG4gIC8qKiBUaGUgc2hhcmQgSUQgKi9cclxuICBwdWJsaWMgaWQ6IG51bWJlcjtcclxuICAvKiogVGhlIGNoaWxkIHByb2Nlc3MgKi9cclxuICBwdWJsaWMgcHJvY2VzczogQ2hpbGRQcm9jZXNzIHwgbnVsbCA9IG51bGw7XHJcbiAgLyoqIFdoZXRoZXIgdGhlIHNoYXJkIGlzIHJlYWR5ICovXHJcbiAgcHVibGljIHJlYWR5OiBib29sZWFuID0gZmFsc2U7XHJcbiAgLyoqIFNoYXJkIHN0YXR1cyAqL1xyXG4gIHB1YmxpYyBzdGF0dXM6IFNoYXJkU3RhdHVzID0gU2hhcmRTdGF0dXMuSWRsZTtcclxuICAvKiogRW52aXJvbm1lbnQgdmFyaWFibGVzIGZvciB0aGUgc2hhcmQgKi9cclxuICBwcml2YXRlIGVudjogUmVjb3JkPHN0cmluZywgc3RyaW5nPjtcclxuXHJcbiAgY29uc3RydWN0b3IobWFuYWdlcjogU2hhcmRpbmdNYW5hZ2VyLCBpZDogbnVtYmVyKSB7XHJcbiAgICBzdXBlcigpO1xyXG4gICAgdGhpcy5tYW5hZ2VyID0gbWFuYWdlcjtcclxuICAgIHRoaXMuaWQgPSBpZDtcclxuICAgIHRoaXMuZW52ID0ge1xyXG4gICAgICBTSEFSRF9JRDogU3RyaW5nKGlkKSxcclxuICAgICAgU0hBUkRfQ09VTlQ6IFN0cmluZyhtYW5hZ2VyLnRvdGFsU2hhcmRzKSxcclxuICAgICAgSlVCQklPX1RPS0VOOiBtYW5hZ2VyLnRva2VuID8/ICcnLFxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNwYXduIHRoZSBzaGFyZCBwcm9jZXNzXHJcbiAgICovXHJcbiAgYXN5bmMgc3Bhd24odGltZW91dCA9IDMwMDAwKTogUHJvbWlzZTxDaGlsZFByb2Nlc3M+IHtcclxuICAgIGlmICh0aGlzLnByb2Nlc3MpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBTaGFyZCAke3RoaXMuaWR9IGFscmVhZHkgaGFzIGEgcHJvY2Vzc2ApO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuc3RhdHVzID0gU2hhcmRTdGF0dXMuQ29ubmVjdGluZztcclxuXHJcbiAgICB0aGlzLnByb2Nlc3MgPSBmb3JrKHRoaXMubWFuYWdlci5maWxlLCB0aGlzLm1hbmFnZXIuc2hhcmRBcmdzLCB7XHJcbiAgICAgIGVudjogeyAuLi5wcm9jZXNzLmVudiwgLi4udGhpcy5lbnYgfSxcclxuICAgICAgZXhlY0FyZ3Y6IHRoaXMubWFuYWdlci5leGVjQXJndixcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMucHJvY2Vzcy5vbignbWVzc2FnZScsIHRoaXMuX2hhbmRsZU1lc3NhZ2UuYmluZCh0aGlzKSk7XHJcbiAgICB0aGlzLnByb2Nlc3Mub24oJ2V4aXQnLCB0aGlzLl9oYW5kbGVFeGl0LmJpbmQodGhpcykpO1xyXG4gICAgdGhpcy5wcm9jZXNzLm9uKCdlcnJvcicsIHRoaXMuX2hhbmRsZUVycm9yLmJpbmQodGhpcykpO1xyXG5cclxuICAgIC8vIFdhaXQgZm9yIHJlYWR5XHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICBjb25zdCB0aW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgIHJlamVjdChuZXcgRXJyb3IoYFNoYXJkICR7dGhpcy5pZH0gdG9vayB0b28gbG9uZyB0byBiZWNvbWUgcmVhZHlgKSk7XHJcbiAgICAgIH0sIHRpbWVvdXQpO1xyXG5cclxuICAgICAgdGhpcy5vbmNlKCdyZWFkeScsICgpID0+IHtcclxuICAgICAgICBjbGVhclRpbWVvdXQodGltZXIpO1xyXG4gICAgICAgIHJlc29sdmUodGhpcy5wcm9jZXNzISk7XHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgdGhpcy5vbmNlKCdkaXNjb25uZWN0JywgKCkgPT4ge1xyXG4gICAgICAgIGNsZWFyVGltZW91dCh0aW1lcik7XHJcbiAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihgU2hhcmQgJHt0aGlzLmlkfSBkaXNjb25uZWN0ZWQgYmVmb3JlIGJlY29taW5nIHJlYWR5YCkpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogS2lsbCB0aGUgc2hhcmQgcHJvY2Vzc1xyXG4gICAqL1xyXG4gIGtpbGwoKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy5wcm9jZXNzKSB7XHJcbiAgICAgIHRoaXMucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMoKTtcclxuICAgICAgdGhpcy5wcm9jZXNzLmtpbGwoKTtcclxuICAgICAgdGhpcy5wcm9jZXNzID0gbnVsbDtcclxuICAgIH1cclxuICAgIHRoaXMuc3RhdHVzID0gU2hhcmRTdGF0dXMuRGlzY29ubmVjdGVkO1xyXG4gICAgdGhpcy5yZWFkeSA9IGZhbHNlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVzcGF3biB0aGUgc2hhcmRcclxuICAgKi9cclxuICBhc3luYyByZXNwYXduKG9wdGlvbnM/OiB7IGRlbGF5PzogbnVtYmVyOyB0aW1lb3V0PzogbnVtYmVyIH0pOiBQcm9taXNlPENoaWxkUHJvY2Vzcz4ge1xyXG4gICAgdGhpcy5raWxsKCk7XHJcbiAgICBpZiAob3B0aW9ucz8uZGVsYXkpIHtcclxuICAgICAgYXdhaXQgbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIG9wdGlvbnMuZGVsYXkpKTtcclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzLnNwYXduKG9wdGlvbnM/LnRpbWVvdXQpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2VuZCBhIG1lc3NhZ2UgdG8gdGhlIHNoYXJkXHJcbiAgICovXHJcbiAgc2VuZChtZXNzYWdlOiBhbnkpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgIGlmICghdGhpcy5wcm9jZXNzKSB7XHJcbiAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihgU2hhcmQgJHt0aGlzLmlkfSBoYXMgbm8gcHJvY2Vzc2ApKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuICAgICAgdGhpcy5wcm9jZXNzLnNlbmQobWVzc2FnZSwgKGVycikgPT4ge1xyXG4gICAgICAgIGlmIChlcnIpIHJlamVjdChlcnIpO1xyXG4gICAgICAgIGVsc2UgcmVzb2x2ZSgpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRXZhbHVhdGUgY29kZSBvbiB0aGUgc2hhcmRcclxuICAgKiBcclxuICAgKiDimqDvuI8gU0VDVVJJVFkgV0FSTklORzogVGhpcyBtZXRob2QgZXhlY3V0ZXMgYXJiaXRyYXJ5IGNvZGUgb24gdGhlIHNoYXJkIHByb2Nlc3MuXHJcbiAgICogTkVWRVIgcGFzcyB1c2VyIGlucHV0IHRvIHRoaXMgbWV0aG9kIC0gaXQgd2lsbCByZXN1bHQgaW4gUmVtb3RlIENvZGUgRXhlY3V0aW9uIChSQ0UpLlxyXG4gICAqIFxyXG4gICAqIEBwYXJhbSBzY3JpcHQgLSBDb2RlIHRvIGV2YWx1YXRlIChzdHJpbmcgb3IgZnVuY3Rpb24pXHJcbiAgICogQHJldHVybnMgUHJvbWlzZSByZXNvbHZpbmcgdG8gdGhlIGV2YWx1YXRpb24gcmVzdWx0XHJcbiAgICogXHJcbiAgICogQGV4YW1wbGVcclxuICAgKiAvLyBTYWZlOiBoYXJkY29kZWQgY29kZVxyXG4gICAqIGNvbnN0IGd1aWxkQ291bnQgPSBhd2FpdCBzaGFyZC5ldmFsKGNsaWVudCA9PiBjbGllbnQuZ3VpbGRzLmNhY2hlLnNpemUpO1xyXG4gICAqIFxyXG4gICAqIC8vIFVOU0FGRTogdXNlciBpbnB1dCAtIERPIE5PVCBETyBUSElTIVxyXG4gICAqIC8vIGF3YWl0IHNoYXJkLmV2YWwodXNlck1lc3NhZ2UpOyAvLyBSQ0UgdnVsbmVyYWJpbGl0eSFcclxuICAgKi9cclxuICBhc3luYyBldmFsPFQ+KHNjcmlwdDogc3RyaW5nIHwgKChjbGllbnQ6IGFueSkgPT4gVCkpOiBQcm9taXNlPFQ+IHtcclxuICAgIC8vIFNlY3VyaXR5OiBMb2cgZXZhbCB1c2FnZSBmb3IgYXVkaXQgcHVycG9zZXNcclxuICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViA9PT0gJ2RldmVsb3BtZW50Jykge1xyXG4gICAgICBjb25zb2xlLndhcm4oYFtTaGFyZCAke3RoaXMuaWR9XSBldmFsKCkgY2FsbGVkIC0gZW5zdXJlIHRoaXMgaXMgbm90IGZyb20gdXNlciBpbnB1dGApO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBjb25zdCBfZXZhbCA9IHR5cGVvZiBzY3JpcHQgPT09ICdmdW5jdGlvbicgPyBgKCR7c2NyaXB0fSkodGhpcylgIDogc2NyaXB0O1xyXG4gICAgXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICBjb25zdCBpZCA9IERhdGUubm93KCkudG9TdHJpbmcoMzYpICsgTWF0aC5yYW5kb20oKS50b1N0cmluZygzNik7XHJcbiAgICAgIFxyXG4gICAgICBjb25zdCBoYW5kbGVyID0gKG1lc3NhZ2U6IGFueSkgPT4ge1xyXG4gICAgICAgIGlmIChtZXNzYWdlLl9ldmFsSWQgIT09IGlkKSByZXR1cm47XHJcbiAgICAgICAgdGhpcy5wcm9jZXNzPy5vZmYoJ21lc3NhZ2UnLCBoYW5kbGVyKTtcclxuICAgICAgICBcclxuICAgICAgICBpZiAobWVzc2FnZS5fZXJyb3IpIHtcclxuICAgICAgICAgIC8vIFByZXNlcnZlIHN0YWNrIHRyYWNlIGZyb20gdGhlIHNoYXJkIHByb2Nlc3MgaWYgYXZhaWxhYmxlXHJcbiAgICAgICAgICBjb25zdCBlcnJvciA9IG5ldyBFcnJvcihtZXNzYWdlLl9lcnJvcik7XHJcbiAgICAgICAgICBpZiAobWVzc2FnZS5fZXJyb3JTdGFjaykge1xyXG4gICAgICAgICAgICBlcnJvci5zdGFjayA9IG1lc3NhZ2UuX2Vycm9yU3RhY2s7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICByZWplY3QoZXJyb3IpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICByZXNvbHZlKG1lc3NhZ2UuX3Jlc3VsdCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9O1xyXG4gICAgICBcclxuICAgICAgdGhpcy5wcm9jZXNzPy5vbignbWVzc2FnZScsIGhhbmRsZXIpO1xyXG4gICAgICB0aGlzLnNlbmQoeyBfZXZhbCwgX2V2YWxJZDogaWQgfSkuY2F0Y2gocmVqZWN0KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRmV0Y2ggYSBjbGllbnQgcHJvcGVydHlcclxuICAgKiBcclxuICAgKiDimqDvuI8gU0VDVVJJVFkgV0FSTklORzogVGhpcyBtZXRob2QgaW50ZXJuYWxseSB1c2VzIGV2YWwoKS5cclxuICAgKiBXaGlsZSBpdCBsb29rcyBzYWZlciB0aGFuIGRpcmVjdCBldmFsKCksIGl0IGNhcnJpZXMgdGhlIHNhbWUgcmlza3MuXHJcbiAgICogTkVWRVIgcGFzcyB1c2VyIGlucHV0IHRvIHRoaXMgbWV0aG9kIC0gaXQgd2lsbCByZXN1bHQgaW4gUmVtb3RlIENvZGUgRXhlY3V0aW9uIChSQ0UpLlxyXG4gICAqIFxyXG4gICAqIEBwYXJhbSBwcm9wIC0gUHJvcGVydHkgcGF0aCB0byBmZXRjaCAoZS5nLiwgJ2d1aWxkcy5jYWNoZS5zaXplJylcclxuICAgKiBAcmV0dXJucyBQcm9taXNlIHJlc29sdmluZyB0byB0aGUgcHJvcGVydHkgdmFsdWVcclxuICAgKiBcclxuICAgKiBAZXhhbXBsZVxyXG4gICAqIC8vIFNhZmU6IGhhcmRjb2RlZCBwcm9wZXJ0eVxyXG4gICAqIGNvbnN0IGd1aWxkQ291bnQgPSBhd2FpdCBzaGFyZC5mZXRjaENsaWVudFZhbHVlKCdndWlsZHMuY2FjaGUuc2l6ZScpO1xyXG4gICAqIFxyXG4gICAqIC8vIFVOU0FGRTogdXNlciBpbnB1dCAtIERPIE5PVCBETyBUSElTIVxyXG4gICAqIC8vIGF3YWl0IHNoYXJkLmZldGNoQ2xpZW50VmFsdWUodXNlck1lc3NhZ2UpOyAvLyBSQ0UgdnVsbmVyYWJpbGl0eSFcclxuICAgKi9cclxuICBhc3luYyBmZXRjaENsaWVudFZhbHVlKHByb3A6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XHJcbiAgICAvLyBTRUNVUklUWTogVmFsaWRhdGUgcHJvcCB0byBwcmV2ZW50IGNvZGUgaW5qZWN0aW9uXHJcbiAgICAvLyBPbmx5IGFsbG93IGFscGhhbnVtZXJpYyBjaGFyYWN0ZXJzLCBkb3RzLCB1bmRlcnNjb3JlcywgYW5kIGFycmF5IGJyYWNrZXRzXHJcbiAgICBpZiAoIS9eW1xcdy5bXFxdXSskLy50ZXN0KHByb3ApKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBwcm9wZXJ0eSBwYXRoOiBjb250YWlucyBkaXNhbGxvd2VkIGNoYXJhY3RlcnNgKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgLy8gU0VDVVJJVFk6IEJsb2NrIG9idmlvdXMgY29kZSBpbmplY3Rpb24gYXR0ZW1wdHNcclxuICAgIGNvbnN0IGRhbmdlcm91c1BhdHRlcm5zID0gW1xyXG4gICAgICAvXFxicHJvY2Vzc1xcYi8sXHJcbiAgICAgIC9cXGJyZXF1aXJlXFxiLyxcclxuICAgICAgL1xcYmltcG9ydFxcYi8sXHJcbiAgICAgIC9cXGJldmFsXFxiLyxcclxuICAgICAgL1xcYkZ1bmN0aW9uXFxiLyxcclxuICAgICAgL1xcYmNvbnN0cnVjdG9yXFxiLyxcclxuICAgICAgL1xcYl9fcHJvdG9fX1xcYi8sXHJcbiAgICAgIC9cXGJwcm90b3R5cGVcXGIvLFxyXG4gICAgXTtcclxuICAgIFxyXG4gICAgZm9yIChjb25zdCBwYXR0ZXJuIG9mIGRhbmdlcm91c1BhdHRlcm5zKSB7XHJcbiAgICAgIGlmIChwYXR0ZXJuLnRlc3QocHJvcCkpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgcHJvcGVydHkgcGF0aDogY29udGFpbnMgZGFuZ2Vyb3VzIHBhdHRlcm5gKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICByZXR1cm4gdGhpcy5ldmFsKGB0aGlzLiR7cHJvcH1gKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgX2hhbmRsZU1lc3NhZ2UobWVzc2FnZTogYW55KTogdm9pZCB7XHJcbiAgICBpZiAobWVzc2FnZS5fcmVhZHkpIHtcclxuICAgICAgdGhpcy5yZWFkeSA9IHRydWU7XHJcbiAgICAgIHRoaXMuc3RhdHVzID0gU2hhcmRTdGF0dXMuUmVhZHk7XHJcbiAgICAgIHRoaXMuZW1pdCgncmVhZHknKTtcclxuICAgICAgdGhpcy5tYW5hZ2VyLmVtaXQoJ3NoYXJkUmVhZHknLCB0aGlzLmlkKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChtZXNzYWdlLl9kaXNjb25uZWN0KSB7XHJcbiAgICAgIHRoaXMucmVhZHkgPSBmYWxzZTtcclxuICAgICAgdGhpcy5zdGF0dXMgPSBTaGFyZFN0YXR1cy5EaXNjb25uZWN0ZWQ7XHJcbiAgICAgIHRoaXMuZW1pdCgnZGlzY29ubmVjdCcpO1xyXG4gICAgICB0aGlzLm1hbmFnZXIuZW1pdCgnc2hhcmREaXNjb25uZWN0JywgdGhpcy5pZCk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBpZiAobWVzc2FnZS5fcmVjb25uZWN0aW5nKSB7XHJcbiAgICAgIHRoaXMucmVhZHkgPSBmYWxzZTtcclxuICAgICAgdGhpcy5zdGF0dXMgPSBTaGFyZFN0YXR1cy5SZWNvbm5lY3Rpbmc7XHJcbiAgICAgIHRoaXMuZW1pdCgncmVjb25uZWN0aW5nJyk7XHJcbiAgICAgIHRoaXMubWFuYWdlci5lbWl0KCdzaGFyZFJlY29ubmVjdGluZycsIHRoaXMuaWQpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5lbWl0KCdtZXNzYWdlJywgbWVzc2FnZSk7XHJcbiAgICB0aGlzLm1hbmFnZXIuZW1pdCgnbWVzc2FnZScsIHRoaXMuaWQsIG1lc3NhZ2UpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBfaGFuZGxlRXhpdChjb2RlOiBudW1iZXIsIHNpZ25hbDogc3RyaW5nKTogdm9pZCB7XHJcbiAgICB0aGlzLnJlYWR5ID0gZmFsc2U7XHJcbiAgICB0aGlzLnN0YXR1cyA9IFNoYXJkU3RhdHVzLkRpc2Nvbm5lY3RlZDtcclxuICAgIHRoaXMucHJvY2VzcyA9IG51bGw7XHJcbiAgICBcclxuICAgIHRoaXMuZW1pdCgnZGVhdGgnLCB7IGNvZGUsIHNpZ25hbCB9KTtcclxuICAgIHRoaXMubWFuYWdlci5lbWl0KCdzaGFyZERlYXRoJywgdGhpcy5pZCwgeyBjb2RlLCBzaWduYWwgfSk7XHJcblxyXG4gICAgaWYgKHRoaXMubWFuYWdlci5yZXNwYXduKSB7XHJcbiAgICAgIHRoaXMuc3Bhd24oKS5jYXRjaChlcnIgPT4ge1xyXG4gICAgICAgIHRoaXMubWFuYWdlci5lbWl0KCdzaGFyZEVycm9yJywgdGhpcy5pZCwgZXJyKTtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIF9oYW5kbGVFcnJvcihlcnJvcjogRXJyb3IpOiB2b2lkIHtcclxuICAgIHRoaXMuZW1pdCgnZXJyb3InLCBlcnJvcik7XHJcbiAgICB0aGlzLm1hbmFnZXIuZW1pdCgnc2hhcmRFcnJvcicsIHRoaXMuaWQsIGVycm9yKTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBNYW5hZ2VzIG11bHRpcGxlIHNoYXJkcyBmb3IgbGFyZ2UgYm90c1xyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFNoYXJkaW5nTWFuYWdlciBleHRlbmRzIEV2ZW50RW1pdHRlciB7XHJcbiAgLyoqIFBhdGggdG8gdGhlIGJvdCBmaWxlICovXHJcbiAgcHVibGljIGZpbGU6IHN0cmluZztcclxuICAvKiogVG90YWwgbnVtYmVyIG9mIHNoYXJkcyAqL1xyXG4gIHB1YmxpYyB0b3RhbFNoYXJkczogbnVtYmVyIHwgJ2F1dG8nO1xyXG4gIC8qKiBMaXN0IG9mIHNoYXJkIElEcyB0byBzcGF3biAqL1xyXG4gIHB1YmxpYyBzaGFyZExpc3Q6IG51bWJlcltdO1xyXG4gIC8qKiBTaGFyZGluZyBtb2RlICovXHJcbiAgcHVibGljIG1vZGU6ICdwcm9jZXNzJyB8ICd3b3JrZXInO1xyXG4gIC8qKiBXaGV0aGVyIHRvIHJlc3Bhd24gc2hhcmRzICovXHJcbiAgcHVibGljIHJlc3Bhd246IGJvb2xlYW47XHJcbiAgLyoqIEFyZ3VtZW50cyB0byBwYXNzIHRvIHNoYXJkcyAqL1xyXG4gIHB1YmxpYyBzaGFyZEFyZ3M6IHN0cmluZ1tdO1xyXG4gIC8qKiBBcmd1bWVudHMgdG8gcGFzcyB0byBub2RlICovXHJcbiAgcHVibGljIGV4ZWNBcmd2OiBzdHJpbmdbXTtcclxuICAvKiogQm90IHRva2VuICovXHJcbiAgcHVibGljIHRva2VuPzogc3RyaW5nO1xyXG4gIC8qKiBDb2xsZWN0aW9uIG9mIHNoYXJkcyAqL1xyXG4gIHB1YmxpYyBzaGFyZHM6IE1hcDxudW1iZXIsIFNoYXJkPiA9IG5ldyBNYXAoKTtcclxuXHJcbiAgY29uc3RydWN0b3IoZmlsZTogc3RyaW5nLCBvcHRpb25zOiBTaGFyZGluZ01hbmFnZXJPcHRpb25zID0ge30pIHtcclxuICAgIHN1cGVyKCk7XHJcbiAgICBcclxuICAgIHRoaXMuZmlsZSA9IHBhdGgucmVzb2x2ZShmaWxlKTtcclxuICAgIHRoaXMudG90YWxTaGFyZHMgPSBvcHRpb25zLnRvdGFsU2hhcmRzID8/ICdhdXRvJztcclxuICAgIHRoaXMuc2hhcmRMaXN0ID0gb3B0aW9ucy5zaGFyZExpc3QgPT09ICdhdXRvJyA/IFtdIDogKG9wdGlvbnMuc2hhcmRMaXN0ID8/IFtdKTtcclxuICAgIHRoaXMubW9kZSA9IG9wdGlvbnMubW9kZSA/PyAncHJvY2Vzcyc7XHJcbiAgICB0aGlzLnJlc3Bhd24gPSBvcHRpb25zLnJlc3Bhd24gPz8gdHJ1ZTtcclxuICAgIHRoaXMuc2hhcmRBcmdzID0gb3B0aW9ucy5zaGFyZEFyZ3MgPz8gW107XHJcbiAgICB0aGlzLmV4ZWNBcmd2ID0gb3B0aW9ucy5leGVjQXJndiA/PyBbXTtcclxuICAgIHRoaXMudG9rZW4gPSBvcHRpb25zLnRva2VuO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU3Bhd24gYWxsIHNoYXJkc1xyXG4gICAqL1xyXG4gIGFzeW5jIHNwYXduKG9wdGlvbnM/OiB7XHJcbiAgICBhbW91bnQ/OiBudW1iZXIgfCAnYXV0byc7XHJcbiAgICBkZWxheT86IG51bWJlcjtcclxuICAgIHRpbWVvdXQ/OiBudW1iZXI7XHJcbiAgfSk6IFByb21pc2U8TWFwPG51bWJlciwgU2hhcmQ+PiB7XHJcbiAgICAvLyBEZXRlcm1pbmUgc2hhcmQgY291bnRcclxuICAgIGlmICh0aGlzLnRvdGFsU2hhcmRzID09PSAnYXV0bycgfHwgb3B0aW9ucz8uYW1vdW50ID09PSAnYXV0bycpIHtcclxuICAgICAgdGhpcy50b3RhbFNoYXJkcyA9IGF3YWl0IHRoaXMuZmV0Y2hSZWNvbW1lbmRlZFNoYXJkcygpO1xyXG4gICAgfSBlbHNlIGlmIChvcHRpb25zPy5hbW91bnQpIHtcclxuICAgICAgdGhpcy50b3RhbFNoYXJkcyA9IG9wdGlvbnMuYW1vdW50O1xyXG4gICAgfVxyXG5cclxuICAgIC8vIEJ1aWxkIHNoYXJkIGxpc3QgaWYgbm90IHNwZWNpZmllZFxyXG4gICAgaWYgKHRoaXMuc2hhcmRMaXN0Lmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICB0aGlzLnNoYXJkTGlzdCA9IEFycmF5LmZyb20oeyBsZW5ndGg6IHRoaXMudG90YWxTaGFyZHMgYXMgbnVtYmVyIH0sIChfLCBpKSA9PiBpKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBTcGF3biBzaGFyZHMgc2VxdWVudGlhbGx5IHdpdGggZGVsYXlcclxuICAgIGNvbnN0IGRlbGF5ID0gb3B0aW9ucz8uZGVsYXkgPz8gNTUwMDtcclxuICAgIFxyXG4gICAgZm9yIChjb25zdCBpZCBvZiB0aGlzLnNoYXJkTGlzdCkge1xyXG4gICAgICBjb25zdCBzaGFyZCA9IHRoaXMuY3JlYXRlU2hhcmQoaWQpO1xyXG4gICAgICBhd2FpdCBzaGFyZC5zcGF3bihvcHRpb25zPy50aW1lb3V0KTtcclxuICAgICAgXHJcbiAgICAgIGlmIChpZCAhPT0gdGhpcy5zaGFyZExpc3RbdGhpcy5zaGFyZExpc3QubGVuZ3RoIC0gMV0pIHtcclxuICAgICAgICBhd2FpdCBuZXcgUHJvbWlzZShyID0+IHNldFRpbWVvdXQociwgZGVsYXkpKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB0aGlzLnNoYXJkcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIHNoYXJkXHJcbiAgICovXHJcbiAgY3JlYXRlU2hhcmQoaWQ6IG51bWJlcik6IFNoYXJkIHtcclxuICAgIGNvbnN0IHNoYXJkID0gbmV3IFNoYXJkKHRoaXMsIGlkKTtcclxuICAgIHRoaXMuc2hhcmRzLnNldChpZCwgc2hhcmQpO1xyXG4gICAgcmV0dXJuIHNoYXJkO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRmV0Y2ggcmVjb21tZW5kZWQgc2hhcmQgY291bnQgZnJvbSBBUElcclxuICAgKiBDYWxscyB0aGUgL2dhdGV3YXkvYm90IGVuZHBvaW50IHRvIGdldCB0aGUgcmVjb21tZW5kZWQgc2hhcmQgY291bnRcclxuICAgKi9cclxuICBhc3luYyBmZXRjaFJlY29tbWVuZGVkU2hhcmRzKCk6IFByb21pc2U8bnVtYmVyPiB7XHJcbiAgICBpZiAoIXRoaXMudG9rZW4pIHtcclxuICAgICAgY29uc29sZS53YXJuKCdbU2hhcmRpbmdNYW5hZ2VyXSBObyB0b2tlbiBzZXQsIHJldHVybmluZyBkZWZhdWx0IHNoYXJkIGNvdW50IG9mIDEnKTtcclxuICAgICAgcmV0dXJuIDE7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHRyeSB7XHJcbiAgICAgIC8vIENhbGwgdGhlIGdhdGV3YXkvYm90IGVuZHBvaW50IHRvIGdldCByZWNvbW1lbmRlZCBzaGFyZHNcclxuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCgnaHR0cHM6Ly9nYXRld2F5Lmp1YmJpby5jb20vYXBpL3YxL2dhdGV3YXkvYm90Jywge1xyXG4gICAgICAgIG1ldGhvZDogJ0dFVCcsXHJcbiAgICAgICAgaGVhZGVyczoge1xyXG4gICAgICAgICAgJ0F1dGhvcml6YXRpb24nOiBgQm90ICR7dGhpcy50b2tlbn1gLFxyXG4gICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcclxuICAgICAgICAgICdVc2VyLUFnZW50JzogJ0p1YmJpb0JvdC8xLjAgKCtodHRwczovL2p1YmJpby5jb20pJ1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICAgIFxyXG4gICAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XHJcbiAgICAgICAgY29uc29sZS53YXJuKGBbU2hhcmRpbmdNYW5hZ2VyXSBGYWlsZWQgdG8gZmV0Y2ggcmVjb21tZW5kZWQgc2hhcmRzOiAke3Jlc3BvbnNlLnN0YXR1c30sIHVzaW5nIGRlZmF1bHQgb2YgMWApO1xyXG4gICAgICAgIHJldHVybiAxO1xyXG4gICAgICB9XHJcbiAgICAgIFxyXG4gICAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpIGFzIHsgc2hhcmRzPzogbnVtYmVyIH07XHJcbiAgICAgIHJldHVybiBkYXRhLnNoYXJkcyA/PyAxO1xyXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgY29uc29sZS53YXJuKCdbU2hhcmRpbmdNYW5hZ2VyXSBFcnJvciBmZXRjaGluZyByZWNvbW1lbmRlZCBzaGFyZHMsIHVzaW5nIGRlZmF1bHQgb2YgMTonLCBlcnJvcik7XHJcbiAgICAgIHJldHVybiAxO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQnJvYWRjYXN0IGEgbWVzc2FnZSB0byBhbGwgc2hhcmRzXHJcbiAgICovXHJcbiAgYXN5bmMgYnJvYWRjYXN0KG1lc3NhZ2U6IGFueSk6IFByb21pc2U8dm9pZFtdPiB7XHJcbiAgICBjb25zdCBwcm9taXNlcyA9IFsuLi50aGlzLnNoYXJkcy52YWx1ZXMoKV0ubWFwKHNoYXJkID0+IHNoYXJkLnNlbmQobWVzc2FnZSkpO1xyXG4gICAgcmV0dXJuIFByb21pc2UuYWxsKHByb21pc2VzKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEJyb2FkY2FzdCBhbiBldmFsIHRvIGFsbCBzaGFyZHNcclxuICAgKiBcclxuICAgKiDimqDvuI8gU0VDVVJJVFkgV0FSTklORzogVGhpcyBtZXRob2QgZXhlY3V0ZXMgYXJiaXRyYXJ5IGNvZGUgb24gYWxsIHNoYXJkIHByb2Nlc3Nlcy5cclxuICAgKiBORVZFUiBwYXNzIHVzZXIgaW5wdXQgdG8gdGhpcyBtZXRob2QgLSBpdCB3aWxsIHJlc3VsdCBpbiBSZW1vdGUgQ29kZSBFeGVjdXRpb24gKFJDRSkuXHJcbiAgICovXHJcbiAgYXN5bmMgYnJvYWRjYXN0RXZhbDxUPihzY3JpcHQ6IHN0cmluZyB8ICgoY2xpZW50OiBhbnkpID0+IFQpKTogUHJvbWlzZTxUW10+IHtcclxuICAgIGNvbnN0IHByb21pc2VzID0gWy4uLnRoaXMuc2hhcmRzLnZhbHVlcygpXS5tYXAoc2hhcmQgPT4gc2hhcmQuZXZhbChzY3JpcHQpKTtcclxuICAgIHJldHVybiBQcm9taXNlLmFsbChwcm9taXNlcyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBGZXRjaCBhIGNsaWVudCB2YWx1ZSBmcm9tIGFsbCBzaGFyZHNcclxuICAgKiBcclxuICAgKiDimqDvuI8gU0VDVVJJVFkgV0FSTklORzogVGhpcyBtZXRob2QgaW50ZXJuYWxseSB1c2VzIGJyb2FkY2FzdEV2YWwoKSB3aGljaCBleGVjdXRlcyBjb2RlLlxyXG4gICAqIFdoaWxlIGl0IGxvb2tzIHNhZmVyIHRoYW4gZGlyZWN0IGV2YWwoKSwgaXQgY2FycmllcyB0aGUgc2FtZSByaXNrcy5cclxuICAgKiBORVZFUiBwYXNzIHVzZXIgaW5wdXQgdG8gdGhpcyBtZXRob2QgLSBpdCB3aWxsIHJlc3VsdCBpbiBSZW1vdGUgQ29kZSBFeGVjdXRpb24gKFJDRSkuXHJcbiAgICogXHJcbiAgICogQHBhcmFtIHByb3AgLSBQcm9wZXJ0eSBwYXRoIHRvIGZldGNoIChlLmcuLCAnZ3VpbGRzLmNhY2hlLnNpemUnKVxyXG4gICAqIEByZXR1cm5zIFByb21pc2UgcmVzb2x2aW5nIHRvIGFycmF5IG9mIHByb3BlcnR5IHZhbHVlcyBmcm9tIGFsbCBzaGFyZHNcclxuICAgKiBcclxuICAgKiBAZXhhbXBsZVxyXG4gICAqIC8vIFNhZmU6IGhhcmRjb2RlZCBwcm9wZXJ0eVxyXG4gICAqIGNvbnN0IGd1aWxkQ291bnRzID0gYXdhaXQgbWFuYWdlci5mZXRjaENsaWVudFZhbHVlcygnZ3VpbGRzLmNhY2hlLnNpemUnKTtcclxuICAgKiBcclxuICAgKiAvLyBVTlNBRkU6IHVzZXIgaW5wdXQgLSBETyBOT1QgRE8gVEhJUyFcclxuICAgKiAvLyBhd2FpdCBtYW5hZ2VyLmZldGNoQ2xpZW50VmFsdWVzKHVzZXJNZXNzYWdlKTsgLy8gUkNFIHZ1bG5lcmFiaWxpdHkhXHJcbiAgICovXHJcbiAgYXN5bmMgZmV0Y2hDbGllbnRWYWx1ZXMocHJvcDogc3RyaW5nKTogUHJvbWlzZTxhbnlbXT4ge1xyXG4gICAgLy8gU0VDVVJJVFk6IFZhbGlkYXRlIHByb3AgdG8gcHJldmVudCBjb2RlIGluamVjdGlvblxyXG4gICAgLy8gT25seSBhbGxvdyBhbHBoYW51bWVyaWMgY2hhcmFjdGVycywgZG90cywgdW5kZXJzY29yZXMsIGFuZCBhcnJheSBicmFja2V0c1xyXG4gICAgaWYgKCEvXltcXHcuW1xcXV0rJC8udGVzdChwcm9wKSkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgcHJvcGVydHkgcGF0aDogY29udGFpbnMgZGlzYWxsb3dlZCBjaGFyYWN0ZXJzYCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIFNFQ1VSSVRZOiBCbG9jayBvYnZpb3VzIGNvZGUgaW5qZWN0aW9uIGF0dGVtcHRzXHJcbiAgICBjb25zdCBkYW5nZXJvdXNQYXR0ZXJucyA9IFtcclxuICAgICAgL1xcYnByb2Nlc3NcXGIvLFxyXG4gICAgICAvXFxicmVxdWlyZVxcYi8sXHJcbiAgICAgIC9cXGJpbXBvcnRcXGIvLFxyXG4gICAgICAvXFxiZXZhbFxcYi8sXHJcbiAgICAgIC9cXGJGdW5jdGlvblxcYi8sXHJcbiAgICAgIC9cXGJjb25zdHJ1Y3RvclxcYi8sXHJcbiAgICAgIC9cXGJfX3Byb3RvX19cXGIvLFxyXG4gICAgICAvXFxicHJvdG90eXBlXFxiLyxcclxuICAgIF07XHJcbiAgICBcclxuICAgIGZvciAoY29uc3QgcGF0dGVybiBvZiBkYW5nZXJvdXNQYXR0ZXJucykge1xyXG4gICAgICBpZiAocGF0dGVybi50ZXN0KHByb3ApKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHByb3BlcnR5IHBhdGg6IGNvbnRhaW5zIGRhbmdlcm91cyBwYXR0ZXJuYCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgcmV0dXJuIHRoaXMuYnJvYWRjYXN0RXZhbChgdGhpcy4ke3Byb3B9YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZXNwYXduIGFsbCBzaGFyZHNcclxuICAgKi9cclxuICBhc3luYyByZXNwYXduQWxsKG9wdGlvbnM/OiB7XHJcbiAgICBzaGFyZERlbGF5PzogbnVtYmVyO1xyXG4gICAgcmVzcGF3bkRlbGF5PzogbnVtYmVyO1xyXG4gICAgdGltZW91dD86IG51bWJlcjtcclxuICB9KTogUHJvbWlzZTxNYXA8bnVtYmVyLCBTaGFyZD4+IHtcclxuICAgIGZvciAoY29uc3Qgc2hhcmQgb2YgdGhpcy5zaGFyZHMudmFsdWVzKCkpIHtcclxuICAgICAgYXdhaXQgc2hhcmQucmVzcGF3bih7IGRlbGF5OiBvcHRpb25zPy5yZXNwYXduRGVsYXksIHRpbWVvdXQ6IG9wdGlvbnM/LnRpbWVvdXQgfSk7XHJcbiAgICAgIGlmIChvcHRpb25zPy5zaGFyZERlbGF5KSB7XHJcbiAgICAgICAgYXdhaXQgbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIG9wdGlvbnMuc2hhcmREZWxheSkpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGhpcy5zaGFyZHM7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogU2hhcmQgY2xpZW50IHV0aWxpdGllcyAtIHVzZSBpbiBib3QgZmlsZVxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFNoYXJkQ2xpZW50VXRpbCB7XHJcbiAgLyoqIFRoZSBjbGllbnQgKi9cclxuICBwdWJsaWMgY2xpZW50OiBhbnk7XHJcbiAgLyoqIFRoZSBzaGFyZCBJRCAqL1xyXG4gIHB1YmxpYyBpZDogbnVtYmVyO1xyXG4gIC8qKiBUb3RhbCBzaGFyZCBjb3VudCAqL1xyXG4gIHB1YmxpYyBjb3VudDogbnVtYmVyO1xyXG5cclxuICBjb25zdHJ1Y3RvcihjbGllbnQ6IGFueSkge1xyXG4gICAgdGhpcy5jbGllbnQgPSBjbGllbnQ7XHJcbiAgICB0aGlzLmlkID0gcGFyc2VJbnQocHJvY2Vzcy5lbnYuU0hBUkRfSUQgPz8gJzAnLCAxMCk7XHJcbiAgICB0aGlzLmNvdW50ID0gcGFyc2VJbnQocHJvY2Vzcy5lbnYuU0hBUkRfQ09VTlQgPz8gJzEnLCAxMCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZW5kIGEgbWVzc2FnZSB0byB0aGUgcGFyZW50IHByb2Nlc3NcclxuICAgKi9cclxuICBzZW5kKG1lc3NhZ2U6IGFueSk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgcHJvY2Vzcy5zZW5kPy4obWVzc2FnZSwgKGVycjogRXJyb3IgfCBudWxsKSA9PiB7XHJcbiAgICAgICAgaWYgKGVycikgcmVqZWN0KGVycik7XHJcbiAgICAgICAgZWxzZSByZXNvbHZlKCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBGZXRjaCBhIGNsaWVudCB2YWx1ZSBmcm9tIGFsbCBzaGFyZHNcclxuICAgKiBcclxuICAgKiDimqDvuI8gU0VDVVJJVFkgV0FSTklORzogVGhpcyBtZXRob2QgaW50ZXJuYWxseSB1c2VzIGJyb2FkY2FzdEV2YWwoKSB3aGljaCBleGVjdXRlcyBjb2RlLlxyXG4gICAqIFdoaWxlIGl0IGxvb2tzIHNhZmVyIHRoYW4gZGlyZWN0IGV2YWwoKSwgaXQgY2FycmllcyB0aGUgc2FtZSByaXNrcy5cclxuICAgKiBORVZFUiBwYXNzIHVzZXIgaW5wdXQgdG8gdGhpcyBtZXRob2QgLSBpdCB3aWxsIHJlc3VsdCBpbiBSZW1vdGUgQ29kZSBFeGVjdXRpb24gKFJDRSkuXHJcbiAgICogXHJcbiAgICogQHBhcmFtIHByb3AgLSBQcm9wZXJ0eSBwYXRoIHRvIGZldGNoIChlLmcuLCAnZ3VpbGRzLmNhY2hlLnNpemUnKVxyXG4gICAqIEByZXR1cm5zIFByb21pc2UgcmVzb2x2aW5nIHRvIGFycmF5IG9mIHByb3BlcnR5IHZhbHVlcyBmcm9tIGFsbCBzaGFyZHNcclxuICAgKi9cclxuICBhc3luYyBmZXRjaENsaWVudFZhbHVlcyhwcm9wOiBzdHJpbmcpOiBQcm9taXNlPGFueVtdPiB7XHJcbiAgICAvLyBTRUNVUklUWTogVmFsaWRhdGUgcHJvcCB0byBwcmV2ZW50IGNvZGUgaW5qZWN0aW9uXHJcbiAgICBpZiAoIS9eW1xcdy5bXFxdXSskLy50ZXN0KHByb3ApKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBwcm9wZXJ0eSBwYXRoOiBjb250YWlucyBkaXNhbGxvd2VkIGNoYXJhY3RlcnNgKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgY29uc3QgZGFuZ2Vyb3VzUGF0dGVybnMgPSBbXHJcbiAgICAgIC9cXGJwcm9jZXNzXFxiLywgL1xcYnJlcXVpcmVcXGIvLCAvXFxiaW1wb3J0XFxiLywgL1xcYmV2YWxcXGIvLFxyXG4gICAgICAvXFxiRnVuY3Rpb25cXGIvLCAvXFxiY29uc3RydWN0b3JcXGIvLCAvXFxiX19wcm90b19fXFxiLywgL1xcYnByb3RvdHlwZVxcYi8sXHJcbiAgICBdO1xyXG4gICAgXHJcbiAgICBmb3IgKGNvbnN0IHBhdHRlcm4gb2YgZGFuZ2Vyb3VzUGF0dGVybnMpIHtcclxuICAgICAgaWYgKHBhdHRlcm4udGVzdChwcm9wKSkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBwcm9wZXJ0eSBwYXRoOiBjb250YWlucyBkYW5nZXJvdXMgcGF0dGVybmApO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHJldHVybiB0aGlzLmJyb2FkY2FzdEV2YWwoYHRoaXMuJHtwcm9wfWApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQnJvYWRjYXN0IGFuIGV2YWwgdG8gYWxsIHNoYXJkc1xyXG4gICAqIFxyXG4gICAqIOKaoO+4jyBTRUNVUklUWSBXQVJOSU5HOiBUaGlzIG1ldGhvZCBleGVjdXRlcyBhcmJpdHJhcnkgY29kZSBvbiBhbGwgc2hhcmQgcHJvY2Vzc2VzLlxyXG4gICAqIE5FVkVSIHBhc3MgdXNlciBpbnB1dCB0byB0aGlzIG1ldGhvZCAtIGl0IHdpbGwgcmVzdWx0IGluIFJlbW90ZSBDb2RlIEV4ZWN1dGlvbiAoUkNFKS5cclxuICAgKi9cclxuICBhc3luYyBicm9hZGNhc3RFdmFsPFQ+KHNjcmlwdDogc3RyaW5nIHwgKChjbGllbnQ6IGFueSkgPT4gVCkpOiBQcm9taXNlPFRbXT4ge1xyXG4gICAgY29uc3QgX2V2YWwgPSB0eXBlb2Ygc2NyaXB0ID09PSAnZnVuY3Rpb24nID8gYCgke3NjcmlwdH0pKHRoaXMpYCA6IHNjcmlwdDtcclxuICAgIFxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgY29uc3QgaWQgPSBEYXRlLm5vdygpLnRvU3RyaW5nKDM2KSArIE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpO1xyXG4gICAgICBcclxuICAgICAgY29uc3QgaGFuZGxlciA9IChtZXNzYWdlOiBhbnkpID0+IHtcclxuICAgICAgICBpZiAobWVzc2FnZS5fYnJvYWRjYXN0RXZhbElkICE9PSBpZCkgcmV0dXJuO1xyXG4gICAgICAgIHByb2Nlc3Mub2ZmKCdtZXNzYWdlJywgaGFuZGxlcik7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKG1lc3NhZ2UuX2Vycm9yKSB7XHJcbiAgICAgICAgICAvLyBQcmVzZXJ2ZSBzdGFjayB0cmFjZSBmcm9tIHRoZSBzaGFyZCBwcm9jZXNzIGlmIGF2YWlsYWJsZVxyXG4gICAgICAgICAgY29uc3QgZXJyb3IgPSBuZXcgRXJyb3IobWVzc2FnZS5fZXJyb3IpO1xyXG4gICAgICAgICAgaWYgKG1lc3NhZ2UuX2Vycm9yU3RhY2spIHtcclxuICAgICAgICAgICAgZXJyb3Iuc3RhY2sgPSBtZXNzYWdlLl9lcnJvclN0YWNrO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgcmVqZWN0KGVycm9yKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgcmVzb2x2ZShtZXNzYWdlLl9yZXN1bHRzKTtcclxuICAgICAgICB9XHJcbiAgICAgIH07XHJcbiAgICAgIFxyXG4gICAgICBwcm9jZXNzLm9uKCdtZXNzYWdlJywgaGFuZGxlcik7XHJcbiAgICAgIHRoaXMuc2VuZCh7IF9icm9hZGNhc3RFdmFsOiBfZXZhbCwgX2Jyb2FkY2FzdEV2YWxJZDogaWQgfSkuY2F0Y2gocmVqZWN0KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2lnbmFsIHJlYWR5IHRvIHRoZSBwYXJlbnQgcHJvY2Vzc1xyXG4gICAqL1xyXG4gIHJlYWR5KCk6IHZvaWQge1xyXG4gICAgcHJvY2Vzcy5zZW5kPy4oeyBfcmVhZHk6IHRydWUgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgdGhlIHNoYXJkIElEIGZvciBhIGd1aWxkXHJcbiAgICovXHJcbiAgc3RhdGljIHNoYXJkSWRGb3JHdWlsZElkKGd1aWxkSWQ6IHN0cmluZywgc2hhcmRDb3VudDogbnVtYmVyKTogbnVtYmVyIHtcclxuICAgIGNvbnN0IGlkID0gQmlnSW50KGd1aWxkSWQpO1xyXG4gICAgcmV0dXJuIE51bWJlcihpZCA+PiAyMm4pICUgc2hhcmRDb3VudDtcclxuICB9XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IFNoYXJkaW5nTWFuYWdlcjtcclxuIl19