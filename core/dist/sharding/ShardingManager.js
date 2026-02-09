"use strict";
/**
 * ShardingManager - Multi-process bot support
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
     */
    async eval(script) {
        const _eval = typeof script === 'function' ? `(${script})(this)` : script;
        return new Promise((resolve, reject) => {
            const id = Date.now().toString(36) + Math.random().toString(36);
            const handler = (message) => {
                if (message._evalId !== id)
                    return;
                this.process?.off('message', handler);
                if (message._error) {
                    reject(new Error(message._error));
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
     */
    async fetchRecommendedShards() {
        // In a real implementation, this would call the API
        // For now, return a default
        return 1;
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
                    reject(new Error(message._error));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU2hhcmRpbmdNYW5hZ2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3NoYXJkaW5nL1NoYXJkaW5nTWFuYWdlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7O0dBRUc7Ozs7OztBQUVILG1DQUFzQztBQUN0QyxpREFBbUQ7QUFDbkQsZ0RBQXdCO0FBRXhCOztHQUVHO0FBQ0gsSUFBWSxXQVVYO0FBVkQsV0FBWSxXQUFXO0lBQ3JCLCtDQUFTLENBQUE7SUFDVCx5REFBYyxDQUFBO0lBQ2QsNkRBQWdCLENBQUE7SUFDaEIsNkNBQVEsQ0FBQTtJQUNSLGlEQUFVLENBQUE7SUFDViw2REFBZ0IsQ0FBQTtJQUNoQixxRUFBb0IsQ0FBQTtJQUNwQiwyREFBZSxDQUFBO0lBQ2YscURBQVksQ0FBQTtBQUNkLENBQUMsRUFWVyxXQUFXLDJCQUFYLFdBQVcsUUFVdEI7QUFzQkQ7O0dBRUc7QUFDSCxNQUFhLEtBQU0sU0FBUSxxQkFBWTtJQUNyQywwQ0FBMEM7SUFDbkMsT0FBTyxDQUFrQjtJQUNoQyxtQkFBbUI7SUFDWixFQUFFLENBQVM7SUFDbEIsd0JBQXdCO0lBQ2pCLE9BQU8sR0FBd0IsSUFBSSxDQUFDO0lBQzNDLGlDQUFpQztJQUMxQixLQUFLLEdBQVksS0FBSyxDQUFDO0lBQzlCLG1CQUFtQjtJQUNaLE1BQU0sR0FBZ0IsV0FBVyxDQUFDLElBQUksQ0FBQztJQUM5QywwQ0FBMEM7SUFDbEMsR0FBRyxDQUF5QjtJQUVwQyxZQUFZLE9BQXdCLEVBQUUsRUFBVTtRQUM5QyxLQUFLLEVBQUUsQ0FBQztRQUNSLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDO1FBQ2IsSUFBSSxDQUFDLEdBQUcsR0FBRztZQUNULFFBQVEsRUFBRSxNQUFNLENBQUMsRUFBRSxDQUFDO1lBQ3BCLFdBQVcsRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQztZQUN4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Q0Y7QUF4RUQsMENBd0VDO0FBRUQsa0JBQWUsZUFBZSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIFNoYXJkaW5nTWFuYWdlciAtIE11bHRpLXByb2Nlc3MgYm90IHN1cHBvcnRcclxuICovXHJcblxyXG5pbXBvcnQgeyBFdmVudEVtaXR0ZXIgfSBmcm9tICdldmVudHMnO1xyXG5pbXBvcnQgeyBmb3JrLCBDaGlsZFByb2Nlc3MgfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcclxuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XHJcblxyXG4vKipcclxuICogU2hhcmQgc3RhdHVzXHJcbiAqL1xyXG5leHBvcnQgZW51bSBTaGFyZFN0YXR1cyB7XHJcbiAgUmVhZHkgPSAwLFxyXG4gIENvbm5lY3RpbmcgPSAxLFxyXG4gIFJlY29ubmVjdGluZyA9IDIsXHJcbiAgSWRsZSA9IDMsXHJcbiAgTmVhcmx5ID0gNCxcclxuICBEaXNjb25uZWN0ZWQgPSA1LFxyXG4gIFdhaXRpbmdGb3JHdWlsZHMgPSA2LFxyXG4gIElkZW50aWZ5aW5nID0gNyxcclxuICBSZXN1bWluZyA9IDgsXHJcbn1cclxuXHJcbi8qKlxyXG4gKiBPcHRpb25zIGZvciBTaGFyZGluZ01hbmFnZXJcclxuICovXHJcbmV4cG9ydCBpbnRlcmZhY2UgU2hhcmRpbmdNYW5hZ2VyT3B0aW9ucyB7XHJcbiAgLyoqIFRvdGFsIG51bWJlciBvZiBzaGFyZHMgKGF1dG8gaWYgbm90IHNwZWNpZmllZCkgKi9cclxuICB0b3RhbFNoYXJkcz86IG51bWJlciB8ICdhdXRvJztcclxuICAvKiogU3BlY2lmaWMgc2hhcmQgSURzIHRvIHNwYXduICovXHJcbiAgc2hhcmRMaXN0PzogbnVtYmVyW10gfCAnYXV0byc7XHJcbiAgLyoqIFNoYXJkaW5nIG1vZGUgKi9cclxuICBtb2RlPzogJ3Byb2Nlc3MnIHwgJ3dvcmtlcic7XHJcbiAgLyoqIFJlc3Bhd24gc2hhcmRzIG9uIGV4aXQgKi9cclxuICByZXNwYXduPzogYm9vbGVhbjtcclxuICAvKiogQXJndW1lbnRzIHRvIHBhc3MgdG8gc2hhcmRzICovXHJcbiAgc2hhcmRBcmdzPzogc3RyaW5nW107XHJcbiAgLyoqIEFyZ3VtZW50cyB0byBwYXNzIHRvIG5vZGUgKi9cclxuICBleGVjQXJndj86IHN0cmluZ1tdO1xyXG4gIC8qKiBCb3QgdG9rZW4gKi9cclxuICB0b2tlbj86IHN0cmluZztcclxufVxyXG5cclxuLyoqXHJcbiAqIFJlcHJlc2VudHMgYSBzaW5nbGUgc2hhcmRcclxuICovXHJcbmV4cG9ydCBjbGFzcyBTaGFyZCBleHRlbmRzIEV2ZW50RW1pdHRlciB7XHJcbiAgLyoqIFRoZSBtYW5hZ2VyIHRoYXQgc3Bhd25lZCB0aGlzIHNoYXJkICovXHJcbiAgcHVibGljIG1hbmFnZXI6IFNoYXJkaW5nTWFuYWdlcjtcclxuICAvKiogVGhlIHNoYXJkIElEICovXHJcbiAgcHVibGljIGlkOiBudW1iZXI7XHJcbiAgLyoqIFRoZSBjaGlsZCBwcm9jZXNzICovXHJcbiAgcHVibGljIHByb2Nlc3M6IENoaWxkUHJvY2VzcyB8IG51bGwgPSBudWxsO1xyXG4gIC8qKiBXaGV0aGVyIHRoZSBzaGFyZCBpcyByZWFkeSAqL1xyXG4gIHB1YmxpYyByZWFkeTogYm9vbGVhbiA9IGZhbHNlO1xyXG4gIC8qKiBTaGFyZCBzdGF0dXMgKi9cclxuICBwdWJsaWMgc3RhdHVzOiBTaGFyZFN0YXR1cyA9IFNoYXJkU3RhdHVzLklkbGU7XHJcbiAgLyoqIEVudmlyb25tZW50IHZhcmlhYmxlcyBmb3IgdGhlIHNoYXJkICovXHJcbiAgcHJpdmF0ZSBlbnY6IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XHJcblxyXG4gIGNvbnN0cnVjdG9yKG1hbmFnZXI6IFNoYXJkaW5nTWFuYWdlciwgaWQ6IG51bWJlcikge1xyXG4gICAgc3VwZXIoKTtcclxuICAgIHRoaXMubWFuYWdlciA9IG1hbmFnZXI7XHJcbiAgICB0aGlzLmlkID0gaWQ7XHJcbiAgICB0aGlzLmVudiA9IHtcclxuICAgICAgU0hBUkRfSUQ6IFN0cmluZyhpZCksXHJcbiAgICAgIFNIQVJEX0NPVU5UOiBTdHJpbmcobWFuYWdlci50b3RhbFNoYXJkcyksXHJcbiAgICAgIEpVQkJJT19UT0tFTjogbWFuYWdlci50b2tlbiA/PyAnJyxcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTcGF3biB0aGUgc2hhcmQgcHJvY2Vzc1xyXG4gICAqL1xyXG4gIGFzeW5jIHNwYXduKHRpbWVvdXQgPSAzMDAwMCk6IFByb21pc2U8Q2hpbGRQcm9jZXNzPiB7XHJcbiAgICBpZiAodGhpcy5wcm9jZXNzKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihgU2hhcmQgJHt0aGlzLmlkfSBhbHJlYWR5IGhhcyBhIHByb2Nlc3NgKTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLnN0YXR1cyA9IFNoYXJkU3RhdHVzLkNvbm5lY3Rpbmc7XHJcblxyXG4gICAgdGhpcy5wcm9jZXNzID0gZm9yayh0aGlzLm1hbmFnZXIuZmlsZSwgdGhpcy5tYW5hZ2VyLnNoYXJkQXJncywge1xyXG4gICAgICBlbnY6IHsgLi4ucHJvY2Vzcy5lbnYsIC4uLnRoaXMuZW52IH0sXHJcbiAgICAgIGV4ZWNBcmd2OiB0aGlzLm1hbmFnZXIuZXhlY0FyZ3YsXHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLnByb2Nlc3Mub24oJ21lc3NhZ2UnLCB0aGlzLl9oYW5kbGVNZXNzYWdlLmJpbmQodGhpcykpO1xyXG4gICAgdGhpcy5wcm9jZXNzLm9uKCdleGl0JywgdGhpcy5faGFuZGxlRXhpdC5iaW5kKHRoaXMpKTtcclxuICAgIHRoaXMucHJvY2Vzcy5vbignZXJyb3InLCB0aGlzLl9oYW5kbGVFcnJvci5iaW5kKHRoaXMpKTtcclxuXHJcbiAgICAvLyBXYWl0IGZvciByZWFkeVxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgY29uc3QgdGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICByZWplY3QobmV3IEVycm9yKGBTaGFyZCAke3RoaXMuaWR9IHRvb2sgdG9vIGxvbmcgdG8gYmVjb21lIHJlYWR5YCkpO1xyXG4gICAgICB9LCB0aW1lb3V0KTtcclxuXHJcbiAgICAgIHRoaXMub25jZSgncmVhZHknLCAoKSA9PiB7XHJcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVyKTtcclxuICAgICAgICByZXNvbHZlKHRoaXMucHJvY2VzcyEpO1xyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIHRoaXMub25jZSgnZGlzY29ubmVjdCcsICgpID0+IHtcclxuICAgICAgICBjbGVhclRpbWVvdXQodGltZXIpO1xyXG4gICAgICAgIHJlamVjdChuZXcgRXJyb3IoYFNoYXJkICR7dGhpcy5pZH0gZGlzY29ubmVjdGVkIGJlZm9yZSBiZWNvbWluZyByZWFkeWApKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEtpbGwgdGhlIHNoYXJkIHByb2Nlc3NcclxuICAgKi9cclxuICBraWxsKCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMucHJvY2Vzcykge1xyXG4gICAgICB0aGlzLnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzKCk7XHJcbiAgICAgIHRoaXMucHJvY2Vzcy5raWxsKCk7XHJcbiAgICAgIHRoaXMucHJvY2VzcyA9IG51bGw7XHJcbiAgICB9XHJcbiAgICB0aGlzLnN0YXR1cyA9IFNoYXJkU3RhdHVzLkRpc2Nvbm5lY3RlZDtcclxuICAgIHRoaXMucmVhZHkgPSBmYWxzZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlc3Bhd24gdGhlIHNoYXJkXHJcbiAgICovXHJcbiAgYXN5bmMgcmVzcGF3bihvcHRpb25zPzogeyBkZWxheT86IG51bWJlcjsgdGltZW91dD86IG51bWJlciB9KTogUHJvbWlzZTxDaGlsZFByb2Nlc3M+IHtcclxuICAgIHRoaXMua2lsbCgpO1xyXG4gICAgaWYgKG9wdGlvbnM/LmRlbGF5KSB7XHJcbiAgICAgIGF3YWl0IG5ldyBQcm9taXNlKHIgPT4gc2V0VGltZW91dChyLCBvcHRpb25zLmRlbGF5KSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGhpcy5zcGF3bihvcHRpb25zPy50aW1lb3V0KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNlbmQgYSBtZXNzYWdlIHRvIHRoZSBzaGFyZFxyXG4gICAqL1xyXG4gIHNlbmQobWVzc2FnZTogYW55KTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICBpZiAoIXRoaXMucHJvY2Vzcykge1xyXG4gICAgICAgIHJlamVjdChuZXcgRXJyb3IoYFNoYXJkICR7dGhpcy5pZH0gaGFzIG5vIHByb2Nlc3NgKSk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcbiAgICAgIHRoaXMucHJvY2Vzcy5zZW5kKG1lc3NhZ2UsIChlcnIpID0+IHtcclxuICAgICAgICBpZiAoZXJyKSByZWplY3QoZXJyKTtcclxuICAgICAgICBlbHNlIHJlc29sdmUoKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEV2YWx1YXRlIGNvZGUgb24gdGhlIHNoYXJkXHJcbiAgICovXHJcbiAgYXN5bmMgZXZhbDxUPihzY3JpcHQ6IHN0cmluZyB8ICgoY2xpZW50OiBhbnkpID0+IFQpKTogUHJvbWlzZTxUPiB7XHJcbiAgICBjb25zdCBfZXZhbCA9IHR5cGVvZiBzY3JpcHQgPT09ICdmdW5jdGlvbicgPyBgKCR7c2NyaXB0fSkodGhpcylgIDogc2NyaXB0O1xyXG4gICAgXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICBjb25zdCBpZCA9IERhdGUubm93KCkudG9TdHJpbmcoMzYpICsgTWF0aC5yYW5kb20oKS50b1N0cmluZygzNik7XHJcbiAgICAgIFxyXG4gICAgICBjb25zdCBoYW5kbGVyID0gKG1lc3NhZ2U6IGFueSkgPT4ge1xyXG4gICAgICAgIGlmIChtZXNzYWdlLl9ldmFsSWQgIT09IGlkKSByZXR1cm47XHJcbiAgICAgICAgdGhpcy5wcm9jZXNzPy5vZmYoJ21lc3NhZ2UnLCBoYW5kbGVyKTtcclxuICAgICAgICBcclxuICAgICAgICBpZiAobWVzc2FnZS5fZXJyb3IpIHtcclxuICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IobWVzc2FnZS5fZXJyb3IpKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgcmVzb2x2ZShtZXNzYWdlLl9yZXN1bHQpO1xyXG4gICAgICAgIH1cclxuICAgICAgfTtcclxuICAgICAgXHJcbiAgICAgIHRoaXMucHJvY2Vzcz8ub24oJ21lc3NhZ2UnLCBoYW5kbGVyKTtcclxuICAgICAgdGhpcy5zZW5kKHsgX2V2YWwsIF9ldmFsSWQ6IGlkIH0pLmNhdGNoKHJlamVjdCk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEZldGNoIGEgY2xpZW50IHByb3BlcnR5XHJcbiAgICovXHJcbiAgYXN5bmMgZmV0Y2hDbGllbnRWYWx1ZShwcm9wOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xyXG4gICAgcmV0dXJuIHRoaXMuZXZhbChgdGhpcy4ke3Byb3B9YCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIF9oYW5kbGVNZXNzYWdlKG1lc3NhZ2U6IGFueSk6IHZvaWQge1xyXG4gICAgaWYgKG1lc3NhZ2UuX3JlYWR5KSB7XHJcbiAgICAgIHRoaXMucmVhZHkgPSB0cnVlO1xyXG4gICAgICB0aGlzLnN0YXR1cyA9IFNoYXJkU3RhdHVzLlJlYWR5O1xyXG4gICAgICB0aGlzLmVtaXQoJ3JlYWR5Jyk7XHJcbiAgICAgIHRoaXMubWFuYWdlci5lbWl0KCdzaGFyZFJlYWR5JywgdGhpcy5pZCk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBpZiAobWVzc2FnZS5fZGlzY29ubmVjdCkge1xyXG4gICAgICB0aGlzLnJlYWR5ID0gZmFsc2U7XHJcbiAgICAgIHRoaXMuc3RhdHVzID0gU2hhcmRTdGF0dXMuRGlzY29ubmVjdGVkO1xyXG4gICAgICB0aGlzLmVtaXQoJ2Rpc2Nvbm5lY3QnKTtcclxuICAgICAgdGhpcy5tYW5hZ2VyLmVtaXQoJ3NoYXJkRGlzY29ubmVjdCcsIHRoaXMuaWQpO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKG1lc3NhZ2UuX3JlY29ubmVjdGluZykge1xyXG4gICAgICB0aGlzLnJlYWR5ID0gZmFsc2U7XHJcbiAgICAgIHRoaXMuc3RhdHVzID0gU2hhcmRTdGF0dXMuUmVjb25uZWN0aW5nO1xyXG4gICAgICB0aGlzLmVtaXQoJ3JlY29ubmVjdGluZycpO1xyXG4gICAgICB0aGlzLm1hbmFnZXIuZW1pdCgnc2hhcmRSZWNvbm5lY3RpbmcnLCB0aGlzLmlkKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuZW1pdCgnbWVzc2FnZScsIG1lc3NhZ2UpO1xyXG4gICAgdGhpcy5tYW5hZ2VyLmVtaXQoJ21lc3NhZ2UnLCB0aGlzLmlkLCBtZXNzYWdlKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgX2hhbmRsZUV4aXQoY29kZTogbnVtYmVyLCBzaWduYWw6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgdGhpcy5yZWFkeSA9IGZhbHNlO1xyXG4gICAgdGhpcy5zdGF0dXMgPSBTaGFyZFN0YXR1cy5EaXNjb25uZWN0ZWQ7XHJcbiAgICB0aGlzLnByb2Nlc3MgPSBudWxsO1xyXG4gICAgXHJcbiAgICB0aGlzLmVtaXQoJ2RlYXRoJywgeyBjb2RlLCBzaWduYWwgfSk7XHJcbiAgICB0aGlzLm1hbmFnZXIuZW1pdCgnc2hhcmREZWF0aCcsIHRoaXMuaWQsIHsgY29kZSwgc2lnbmFsIH0pO1xyXG5cclxuICAgIGlmICh0aGlzLm1hbmFnZXIucmVzcGF3bikge1xyXG4gICAgICB0aGlzLnNwYXduKCkuY2F0Y2goZXJyID0+IHtcclxuICAgICAgICB0aGlzLm1hbmFnZXIuZW1pdCgnc2hhcmRFcnJvcicsIHRoaXMuaWQsIGVycik7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBfaGFuZGxlRXJyb3IoZXJyb3I6IEVycm9yKTogdm9pZCB7XHJcbiAgICB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyb3IpO1xyXG4gICAgdGhpcy5tYW5hZ2VyLmVtaXQoJ3NoYXJkRXJyb3InLCB0aGlzLmlkLCBlcnJvcik7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogTWFuYWdlcyBtdWx0aXBsZSBzaGFyZHMgZm9yIGxhcmdlIGJvdHNcclxuICovXHJcbmV4cG9ydCBjbGFzcyBTaGFyZGluZ01hbmFnZXIgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xyXG4gIC8qKiBQYXRoIHRvIHRoZSBib3QgZmlsZSAqL1xyXG4gIHB1YmxpYyBmaWxlOiBzdHJpbmc7XHJcbiAgLyoqIFRvdGFsIG51bWJlciBvZiBzaGFyZHMgKi9cclxuICBwdWJsaWMgdG90YWxTaGFyZHM6IG51bWJlciB8ICdhdXRvJztcclxuICAvKiogTGlzdCBvZiBzaGFyZCBJRHMgdG8gc3Bhd24gKi9cclxuICBwdWJsaWMgc2hhcmRMaXN0OiBudW1iZXJbXTtcclxuICAvKiogU2hhcmRpbmcgbW9kZSAqL1xyXG4gIHB1YmxpYyBtb2RlOiAncHJvY2VzcycgfCAnd29ya2VyJztcclxuICAvKiogV2hldGhlciB0byByZXNwYXduIHNoYXJkcyAqL1xyXG4gIHB1YmxpYyByZXNwYXduOiBib29sZWFuO1xyXG4gIC8qKiBBcmd1bWVudHMgdG8gcGFzcyB0byBzaGFyZHMgKi9cclxuICBwdWJsaWMgc2hhcmRBcmdzOiBzdHJpbmdbXTtcclxuICAvKiogQXJndW1lbnRzIHRvIHBhc3MgdG8gbm9kZSAqL1xyXG4gIHB1YmxpYyBleGVjQXJndjogc3RyaW5nW107XHJcbiAgLyoqIEJvdCB0b2tlbiAqL1xyXG4gIHB1YmxpYyB0b2tlbj86IHN0cmluZztcclxuICAvKiogQ29sbGVjdGlvbiBvZiBzaGFyZHMgKi9cclxuICBwdWJsaWMgc2hhcmRzOiBNYXA8bnVtYmVyLCBTaGFyZD4gPSBuZXcgTWFwKCk7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGZpbGU6IHN0cmluZywgb3B0aW9uczogU2hhcmRpbmdNYW5hZ2VyT3B0aW9ucyA9IHt9KSB7XHJcbiAgICBzdXBlcigpO1xyXG4gICAgXHJcbiAgICB0aGlzLmZpbGUgPSBwYXRoLnJlc29sdmUoZmlsZSk7XHJcbiAgICB0aGlzLnRvdGFsU2hhcmRzID0gb3B0aW9ucy50b3RhbFNoYXJkcyA/PyAnYXV0byc7XHJcbiAgICB0aGlzLnNoYXJkTGlzdCA9IG9wdGlvbnMuc2hhcmRMaXN0ID09PSAnYXV0bycgPyBbXSA6IChvcHRpb25zLnNoYXJkTGlzdCA/PyBbXSk7XHJcbiAgICB0aGlzLm1vZGUgPSBvcHRpb25zLm1vZGUgPz8gJ3Byb2Nlc3MnO1xyXG4gICAgdGhpcy5yZXNwYXduID0gb3B0aW9ucy5yZXNwYXduID8/IHRydWU7XHJcbiAgICB0aGlzLnNoYXJkQXJncyA9IG9wdGlvbnMuc2hhcmRBcmdzID8/IFtdO1xyXG4gICAgdGhpcy5leGVjQXJndiA9IG9wdGlvbnMuZXhlY0FyZ3YgPz8gW107XHJcbiAgICB0aGlzLnRva2VuID0gb3B0aW9ucy50b2tlbjtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNwYXduIGFsbCBzaGFyZHNcclxuICAgKi9cclxuICBhc3luYyBzcGF3bihvcHRpb25zPzoge1xyXG4gICAgYW1vdW50PzogbnVtYmVyIHwgJ2F1dG8nO1xyXG4gICAgZGVsYXk/OiBudW1iZXI7XHJcbiAgICB0aW1lb3V0PzogbnVtYmVyO1xyXG4gIH0pOiBQcm9taXNlPE1hcDxudW1iZXIsIFNoYXJkPj4ge1xyXG4gICAgLy8gRGV0ZXJtaW5lIHNoYXJkIGNvdW50XHJcbiAgICBpZiAodGhpcy50b3RhbFNoYXJkcyA9PT0gJ2F1dG8nIHx8IG9wdGlvbnM/LmFtb3VudCA9PT0gJ2F1dG8nKSB7XHJcbiAgICAgIHRoaXMudG90YWxTaGFyZHMgPSBhd2FpdCB0aGlzLmZldGNoUmVjb21tZW5kZWRTaGFyZHMoKTtcclxuICAgIH0gZWxzZSBpZiAob3B0aW9ucz8uYW1vdW50KSB7XHJcbiAgICAgIHRoaXMudG90YWxTaGFyZHMgPSBvcHRpb25zLmFtb3VudDtcclxuICAgIH1cclxuXHJcbiAgICAvLyBCdWlsZCBzaGFyZCBsaXN0IGlmIG5vdCBzcGVjaWZpZWRcclxuICAgIGlmICh0aGlzLnNoYXJkTGlzdC5sZW5ndGggPT09IDApIHtcclxuICAgICAgdGhpcy5zaGFyZExpc3QgPSBBcnJheS5mcm9tKHsgbGVuZ3RoOiB0aGlzLnRvdGFsU2hhcmRzIGFzIG51bWJlciB9LCAoXywgaSkgPT4gaSk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gU3Bhd24gc2hhcmRzIHNlcXVlbnRpYWxseSB3aXRoIGRlbGF5XHJcbiAgICBjb25zdCBkZWxheSA9IG9wdGlvbnM/LmRlbGF5ID8/IDU1MDA7XHJcbiAgICBcclxuICAgIGZvciAoY29uc3QgaWQgb2YgdGhpcy5zaGFyZExpc3QpIHtcclxuICAgICAgY29uc3Qgc2hhcmQgPSB0aGlzLmNyZWF0ZVNoYXJkKGlkKTtcclxuICAgICAgYXdhaXQgc2hhcmQuc3Bhd24ob3B0aW9ucz8udGltZW91dCk7XHJcbiAgICAgIFxyXG4gICAgICBpZiAoaWQgIT09IHRoaXMuc2hhcmRMaXN0W3RoaXMuc2hhcmRMaXN0Lmxlbmd0aCAtIDFdKSB7XHJcbiAgICAgICAgYXdhaXQgbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIGRlbGF5KSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gdGhpcy5zaGFyZHM7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgYSBzaGFyZFxyXG4gICAqL1xyXG4gIGNyZWF0ZVNoYXJkKGlkOiBudW1iZXIpOiBTaGFyZCB7XHJcbiAgICBjb25zdCBzaGFyZCA9IG5ldyBTaGFyZCh0aGlzLCBpZCk7XHJcbiAgICB0aGlzLnNoYXJkcy5zZXQoaWQsIHNoYXJkKTtcclxuICAgIHJldHVybiBzaGFyZDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEZldGNoIHJlY29tbWVuZGVkIHNoYXJkIGNvdW50IGZyb20gQVBJXHJcbiAgICovXHJcbiAgYXN5bmMgZmV0Y2hSZWNvbW1lbmRlZFNoYXJkcygpOiBQcm9taXNlPG51bWJlcj4ge1xyXG4gICAgLy8gSW4gYSByZWFsIGltcGxlbWVudGF0aW9uLCB0aGlzIHdvdWxkIGNhbGwgdGhlIEFQSVxyXG4gICAgLy8gRm9yIG5vdywgcmV0dXJuIGEgZGVmYXVsdFxyXG4gICAgcmV0dXJuIDE7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBCcm9hZGNhc3QgYSBtZXNzYWdlIHRvIGFsbCBzaGFyZHNcclxuICAgKi9cclxuICBhc3luYyBicm9hZGNhc3QobWVzc2FnZTogYW55KTogUHJvbWlzZTx2b2lkW10+IHtcclxuICAgIGNvbnN0IHByb21pc2VzID0gWy4uLnRoaXMuc2hhcmRzLnZhbHVlcygpXS5tYXAoc2hhcmQgPT4gc2hhcmQuc2VuZChtZXNzYWdlKSk7XHJcbiAgICByZXR1cm4gUHJvbWlzZS5hbGwocHJvbWlzZXMpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQnJvYWRjYXN0IGFuIGV2YWwgdG8gYWxsIHNoYXJkc1xyXG4gICAqL1xyXG4gIGFzeW5jIGJyb2FkY2FzdEV2YWw8VD4oc2NyaXB0OiBzdHJpbmcgfCAoKGNsaWVudDogYW55KSA9PiBUKSk6IFByb21pc2U8VFtdPiB7XHJcbiAgICBjb25zdCBwcm9taXNlcyA9IFsuLi50aGlzLnNoYXJkcy52YWx1ZXMoKV0ubWFwKHNoYXJkID0+IHNoYXJkLmV2YWwoc2NyaXB0KSk7XHJcbiAgICByZXR1cm4gUHJvbWlzZS5hbGwocHJvbWlzZXMpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRmV0Y2ggYSBjbGllbnQgdmFsdWUgZnJvbSBhbGwgc2hhcmRzXHJcbiAgICovXHJcbiAgYXN5bmMgZmV0Y2hDbGllbnRWYWx1ZXMocHJvcDogc3RyaW5nKTogUHJvbWlzZTxhbnlbXT4ge1xyXG4gICAgcmV0dXJuIHRoaXMuYnJvYWRjYXN0RXZhbChgdGhpcy4ke3Byb3B9YCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZXNwYXduIGFsbCBzaGFyZHNcclxuICAgKi9cclxuICBhc3luYyByZXNwYXduQWxsKG9wdGlvbnM/OiB7XHJcbiAgICBzaGFyZERlbGF5PzogbnVtYmVyO1xyXG4gICAgcmVzcGF3bkRlbGF5PzogbnVtYmVyO1xyXG4gICAgdGltZW91dD86IG51bWJlcjtcclxuICB9KTogUHJvbWlzZTxNYXA8bnVtYmVyLCBTaGFyZD4+IHtcclxuICAgIGZvciAoY29uc3Qgc2hhcmQgb2YgdGhpcy5zaGFyZHMudmFsdWVzKCkpIHtcclxuICAgICAgYXdhaXQgc2hhcmQucmVzcGF3bih7IGRlbGF5OiBvcHRpb25zPy5yZXNwYXduRGVsYXksIHRpbWVvdXQ6IG9wdGlvbnM/LnRpbWVvdXQgfSk7XHJcbiAgICAgIGlmIChvcHRpb25zPy5zaGFyZERlbGF5KSB7XHJcbiAgICAgICAgYXdhaXQgbmV3IFByb21pc2UociA9PiBzZXRUaW1lb3V0KHIsIG9wdGlvbnMuc2hhcmREZWxheSkpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGhpcy5zaGFyZHM7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogU2hhcmQgY2xpZW50IHV0aWxpdGllcyAtIHVzZSBpbiBib3QgZmlsZVxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFNoYXJkQ2xpZW50VXRpbCB7XHJcbiAgLyoqIFRoZSBjbGllbnQgKi9cclxuICBwdWJsaWMgY2xpZW50OiBhbnk7XHJcbiAgLyoqIFRoZSBzaGFyZCBJRCAqL1xyXG4gIHB1YmxpYyBpZDogbnVtYmVyO1xyXG4gIC8qKiBUb3RhbCBzaGFyZCBjb3VudCAqL1xyXG4gIHB1YmxpYyBjb3VudDogbnVtYmVyO1xyXG5cclxuICBjb25zdHJ1Y3RvcihjbGllbnQ6IGFueSkge1xyXG4gICAgdGhpcy5jbGllbnQgPSBjbGllbnQ7XHJcbiAgICB0aGlzLmlkID0gcGFyc2VJbnQocHJvY2Vzcy5lbnYuU0hBUkRfSUQgPz8gJzAnLCAxMCk7XHJcbiAgICB0aGlzLmNvdW50ID0gcGFyc2VJbnQocHJvY2Vzcy5lbnYuU0hBUkRfQ09VTlQgPz8gJzEnLCAxMCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZW5kIGEgbWVzc2FnZSB0byB0aGUgcGFyZW50IHByb2Nlc3NcclxuICAgKi9cclxuICBzZW5kKG1lc3NhZ2U6IGFueSk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgcHJvY2Vzcy5zZW5kPy4obWVzc2FnZSwgKGVycjogRXJyb3IgfCBudWxsKSA9PiB7XHJcbiAgICAgICAgaWYgKGVycikgcmVqZWN0KGVycik7XHJcbiAgICAgICAgZWxzZSByZXNvbHZlKCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBGZXRjaCBhIGNsaWVudCB2YWx1ZSBmcm9tIGFsbCBzaGFyZHNcclxuICAgKi9cclxuICBhc3luYyBmZXRjaENsaWVudFZhbHVlcyhwcm9wOiBzdHJpbmcpOiBQcm9taXNlPGFueVtdPiB7XHJcbiAgICByZXR1cm4gdGhpcy5icm9hZGNhc3RFdmFsKGB0aGlzLiR7cHJvcH1gKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEJyb2FkY2FzdCBhbiBldmFsIHRvIGFsbCBzaGFyZHNcclxuICAgKi9cclxuICBhc3luYyBicm9hZGNhc3RFdmFsPFQ+KHNjcmlwdDogc3RyaW5nIHwgKChjbGllbnQ6IGFueSkgPT4gVCkpOiBQcm9taXNlPFRbXT4ge1xyXG4gICAgY29uc3QgX2V2YWwgPSB0eXBlb2Ygc2NyaXB0ID09PSAnZnVuY3Rpb24nID8gYCgke3NjcmlwdH0pKHRoaXMpYCA6IHNjcmlwdDtcclxuICAgIFxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgY29uc3QgaWQgPSBEYXRlLm5vdygpLnRvU3RyaW5nKDM2KSArIE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpO1xyXG4gICAgICBcclxuICAgICAgY29uc3QgaGFuZGxlciA9IChtZXNzYWdlOiBhbnkpID0+IHtcclxuICAgICAgICBpZiAobWVzc2FnZS5fYnJvYWRjYXN0RXZhbElkICE9PSBpZCkgcmV0dXJuO1xyXG4gICAgICAgIHByb2Nlc3Mub2ZmKCdtZXNzYWdlJywgaGFuZGxlcik7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKG1lc3NhZ2UuX2Vycm9yKSB7XHJcbiAgICAgICAgICByZWplY3QobmV3IEVycm9yKG1lc3NhZ2UuX2Vycm9yKSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIHJlc29sdmUobWVzc2FnZS5fcmVzdWx0cyk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9O1xyXG4gICAgICBcclxuICAgICAgcHJvY2Vzcy5vbignbWVzc2FnZScsIGhhbmRsZXIpO1xyXG4gICAgICB0aGlzLnNlbmQoeyBfYnJvYWRjYXN0RXZhbDogX2V2YWwsIF9icm9hZGNhc3RFdmFsSWQ6IGlkIH0pLmNhdGNoKHJlamVjdCk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNpZ25hbCByZWFkeSB0byB0aGUgcGFyZW50IHByb2Nlc3NcclxuICAgKi9cclxuICByZWFkeSgpOiB2b2lkIHtcclxuICAgIHByb2Nlc3Muc2VuZD8uKHsgX3JlYWR5OiB0cnVlIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IHRoZSBzaGFyZCBJRCBmb3IgYSBndWlsZFxyXG4gICAqL1xyXG4gIHN0YXRpYyBzaGFyZElkRm9yR3VpbGRJZChndWlsZElkOiBzdHJpbmcsIHNoYXJkQ291bnQ6IG51bWJlcik6IG51bWJlciB7XHJcbiAgICBjb25zdCBpZCA9IEJpZ0ludChndWlsZElkKTtcclxuICAgIHJldHVybiBOdW1iZXIoaWQgPj4gMjJuKSAlIHNoYXJkQ291bnQ7XHJcbiAgfVxyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBTaGFyZGluZ01hbmFnZXI7XHJcbiJdfQ==