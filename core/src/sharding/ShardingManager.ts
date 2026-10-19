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

import { EventEmitter } from 'events';
import { fork, ChildProcess } from 'child_process';
import path from 'path';

/**
 * Shard status
 */
export enum ShardStatus {
  Ready = 0,
  Connecting = 1,
  Reconnecting = 2,
  Idle = 3,
  Nearly = 4,
  Disconnected = 5,
  WaitingForGuilds = 6,
  Identifying = 7,
  Resuming = 8,
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
export class Shard extends EventEmitter {
  /** The manager that spawned this shard */
  public manager: ShardingManager;
  /** The shard ID */
  public id: number;
  /** The child process */
  public process: ChildProcess | null = null;
  /** Whether the shard is ready */
  public ready: boolean = false;
  /** Shard status */
  public status: ShardStatus = ShardStatus.Idle;
  /** Environment variables for the shard */
  private env: Record<string, string>;

  constructor(manager: ShardingManager, id: number) {
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
  async spawn(timeout = 30000): Promise<ChildProcess> {
    if (this.process) {
      throw new Error(`Shard ${this.id} already has a process`);
    }

    this.status = ShardStatus.Connecting;

    this.process = fork(this.manager.file, this.manager.shardArgs, {
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
        resolve(this.process!);
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
  kill(): void {
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
  async respawn(options?: { delay?: number; timeout?: number }): Promise<ChildProcess> {
    this.kill();
    if (options?.delay) {
      await new Promise(r => setTimeout(r, options.delay));
    }
    return this.spawn(options?.timeout);
  }

  /**
   * Send a message to the shard
   */
  send(message: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.process) {
        reject(new Error(`Shard ${this.id} has no process`));
        return;
      }
      this.process.send(message, (err) => {
        if (err) reject(err);
        else resolve();
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
  async eval<T>(script: string | ((client: any) => T)): Promise<T> {
    // Security: Log eval usage for audit purposes
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[Shard ${this.id}] eval() called - ensure this is not from user input`);
    }
    
    const _eval = typeof script === 'function' ? `(${script})(this)` : script;
    
    return new Promise((resolve, reject) => {
      const id = Date.now().toString(36) + Math.random().toString(36);
      
      const handler = (message: any) => {
        if (message._evalId !== id) return;
        this.process?.off('message', handler);
        
        if (message._error) {
          // Preserve stack trace from the shard process if available
          const error = new Error(message._error);
          if (message._errorStack) {
            error.stack = message._errorStack;
          }
          reject(error);
        } else {
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
  async fetchClientValue(prop: string): Promise<any> {
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

  private _handleMessage(message: any): void {
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

  private _handleExit(code: number, signal: string): void {
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

  private _handleError(error: Error): void {
    this.emit('error', error);
    this.manager.emit('shardError', this.id, error);
  }
}

/**
 * Manages multiple shards for large bots
 */
export class ShardingManager extends EventEmitter {
  /** Path to the bot file */
  public file: string;
  /** Total number of shards */
  public totalShards: number | 'auto';
  /** List of shard IDs to spawn */
  public shardList: number[];
  /** Sharding mode */
  public mode: 'process' | 'worker';
  /** Whether to respawn shards */
  public respawn: boolean;
  /** Arguments to pass to shards */
  public shardArgs: string[];
  /** Arguments to pass to node */
  public execArgv: string[];
  /** Bot token */
  public token?: string;
  /** Collection of shards */
  public shards: Map<number, Shard> = new Map();

  constructor(file: string, options: ShardingManagerOptions = {}) {
    super();
    
    this.file = path.resolve(file);
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
  async spawn(options?: {
    amount?: number | 'auto';
    delay?: number;
    timeout?: number;
  }): Promise<Map<number, Shard>> {
    // Determine shard count
    if (this.totalShards === 'auto' || options?.amount === 'auto') {
      this.totalShards = await this.fetchRecommendedShards();
    } else if (options?.amount) {
      this.totalShards = options.amount;
    }

    // Build shard list if not specified
    if (this.shardList.length === 0) {
      this.shardList = Array.from({ length: this.totalShards as number }, (_, i) => i);
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
  createShard(id: number): Shard {
    const shard = new Shard(this, id);
    this.shards.set(id, shard);
    return shard;
  }

  /**
   * Fetch recommended shard count from API
   * Calls the /gateway/bot endpoint to get the recommended shard count
   */
  async fetchRecommendedShards(): Promise<number> {
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
      
      const data = await response.json() as { shards?: number };
      return data.shards ?? 1;
    } catch (error) {
      console.warn('[ShardingManager] Error fetching recommended shards, using default of 1:', error);
      return 1;
    }
  }

  /**
   * Broadcast a message to all shards
   */
  async broadcast(message: any): Promise<void[]> {
    const promises = [...this.shards.values()].map(shard => shard.send(message));
    return Promise.all(promises);
  }

  /**
   * Broadcast an eval to all shards
   * 
   * ⚠️ SECURITY WARNING: This method executes arbitrary code on all shard processes.
   * NEVER pass user input to this method - it will result in Remote Code Execution (RCE).
   */
  async broadcastEval<T>(script: string | ((client: any) => T)): Promise<T[]> {
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
  async fetchClientValues(prop: string): Promise<any[]> {
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
  async respawnAll(options?: {
    shardDelay?: number;
    respawnDelay?: number;
    timeout?: number;
  }): Promise<Map<number, Shard>> {
    for (const shard of this.shards.values()) {
      await shard.respawn({ delay: options?.respawnDelay, timeout: options?.timeout });
      if (options?.shardDelay) {
        await new Promise(r => setTimeout(r, options.shardDelay));
      }
    }
    return this.shards;
  }
}

/**
 * Shard client utilities - use in bot file
 */
export class ShardClientUtil {
  /** The client */
  public client: any;
  /** The shard ID */
  public id: number;
  /** Total shard count */
  public count: number;

  constructor(client: any) {
    this.client = client;
    this.id = parseInt(process.env.SHARD_ID ?? '0', 10);
    this.count = parseInt(process.env.SHARD_COUNT ?? '1', 10);
  }

  /**
   * Send a message to the parent process
   */
  send(message: any): Promise<void> {
    return new Promise((resolve, reject) => {
      process.send?.(message, (err: Error | null) => {
        if (err) reject(err);
        else resolve();
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
  async fetchClientValues(prop: string): Promise<any[]> {
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
  async broadcastEval<T>(script: string | ((client: any) => T)): Promise<T[]> {
    const _eval = typeof script === 'function' ? `(${script})(this)` : script;
    
    return new Promise((resolve, reject) => {
      const id = Date.now().toString(36) + Math.random().toString(36);
      
      const handler = (message: any) => {
        if (message._broadcastEvalId !== id) return;
        process.off('message', handler);
        
        if (message._error) {
          // Preserve stack trace from the shard process if available
          const error = new Error(message._error);
          if (message._errorStack) {
            error.stack = message._errorStack;
          }
          reject(error);
        } else {
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
  ready(): void {
    process.send?.({ _ready: true });
  }

  /**
   * Get the shard ID for a guild
   */
  static shardIdForGuildId(guildId: string, shardCount: number): number {
    const id = BigInt(guildId);
    return Number(id >> 22n) % shardCount;
  }
}

export default ShardingManager;
