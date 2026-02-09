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
export const Sweepers = {
  /**
   * Filter that sweeps items older than a certain lifetime
   */
  filterByLifetime<T extends { createdTimestamp?: number; createdAt?: Date }>(options: {
    lifetime?: number;
    getComparisonTimestamp?: (value: T) => number;
    excludeFromSweep?: (value: T) => boolean;
  } = {}) {
    const lifetime = options.lifetime ?? 14400; // 4 hours default
    const getTimestamp = options.getComparisonTimestamp ?? 
      ((v: T) => v.createdTimestamp ?? v.createdAt?.getTime() ?? 0);
    const exclude = options.excludeFromSweep ?? (() => false);
    
    return () => {
      const now = Date.now();
      const cutoff = now - (lifetime * 1000);
      
      return (value: T) => {
        if (exclude(value)) return false;
        const timestamp = getTimestamp(value);
        return timestamp < cutoff;
      };
    };
  },

  /**
   * Filter that sweeps archived threads
   */
  archivedThreadSweepFilter(lifetime = 14400) {
    return () => {
      const now = Date.now();
      const cutoff = now - (lifetime * 1000);
      
      return (thread: any) => {
        if (!thread.archived) return false;
        const archivedAt = thread.archivedAt?.getTime() ?? thread.archiveTimestamp ?? 0;
        return archivedAt < cutoff;
      };
    };
  },

  /**
   * Filter that sweeps expired invites
   */
  expiredInviteSweepFilter() {
    return () => {
      const now = Date.now();
      return (invite: any) => {
        if (!invite.expiresAt && !invite.expiresTimestamp) return false;
        const expiresAt = invite.expiresAt?.getTime() ?? invite.expiresTimestamp ?? Infinity;
        return expiresAt < now;
      };
    };
  },

  /**
   * Filter that sweeps outdated presences
   */
  outdatedPresenceSweepFilter(lifetime = 21600) {
    return () => {
      const now = Date.now();
      const cutoff = now - (lifetime * 1000);
      
      return (presence: any) => {
        const lastUpdate = presence.lastModified ?? presence.updatedAt?.getTime() ?? 0;
        return lastUpdate < cutoff;
      };
    };
  },

  /**
   * Filter that sweeps all items (use with caution)
   */
  sweepAll() {
    return () => () => true;
  },

  /**
   * Filter that sweeps nothing
   */
  sweepNone() {
    return () => () => false;
  },
};

/**
 * Sweeper manager class
 */
export class SweeperManager {
  private client: any;
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private options: SweeperDefinitions;

  constructor(client: any, options: SweeperDefinitions = {}) {
    this.client = client;
    this.options = options;
  }

  /**
   * Start all configured sweepers
   */
  start(): void {
    for (const [key, config] of Object.entries(this.options)) {
      if (config && config.interval > 0) {
        this.startSweeper(key as keyof SweeperDefinitions, config);
      }
    }
  }

  /**
   * Start a specific sweeper
   */
  private startSweeper(name: keyof SweeperDefinitions, config: SweeperOptions): void {
    // Clear existing interval if any
    this.stopSweeper(name);
    
    const interval = setInterval(() => {
      this.sweep(name, config.filter);
    }, config.interval * 1000);
    
    this.intervals.set(name, interval);
  }

  /**
   * Stop a specific sweeper
   */
  stopSweeper(name: keyof SweeperDefinitions): void {
    const interval = this.intervals.get(name);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(name);
    }
  }

  /**
   * Stop all sweepers
   */
  stop(): void {
    for (const name of this.intervals.keys()) {
      this.stopSweeper(name as keyof SweeperDefinitions);
    }
  }

  /**
   * Manually trigger a sweep
   */
  sweep(name: keyof SweeperDefinitions, filter?: () => (value: any, key: string, collection: Collection<string, any>) => boolean): number {
    const cache = this.getCache(name);
    if (!cache) return 0;
    
    const filterFn = filter ?? this.options[name]?.filter;
    if (!filterFn) return 0;
    
    return cache.sweep(filterFn());
  }

  /**
   * Get the cache for a sweeper type
   */
  private getCache(name: keyof SweeperDefinitions): Collection<string, any> | null {
    switch (name) {
      case 'users':
        return this.client.users?.cache ?? null;
      case 'guildMembers':
        // Sweep across all guilds
        let memberCount = 0;
        this.client.guilds?.cache.forEach((guild: any) => {
          if (guild.members?.cache) {
            const filter = this.options.guildMembers?.filter;
            if (filter) memberCount += guild.members.cache.sweep(filter());
          }
        });
        return null; // Already handled
      case 'messages':
        // Sweep across all channels
        this.client.channels?.cache.forEach((channel: any) => {
          if (channel.messages?.cache) {
            const filter = this.options.messages?.filter;
            if (filter) channel.messages.cache.sweep(filter());
          }
        });
        return null;
      case 'threads':
        return this.client.channels?.cache.filter((c: any) => c.isThread?.()) ?? null;
      case 'presences':
        // Sweep across all guilds
        this.client.guilds?.cache.forEach((guild: any) => {
          if (guild.presences?.cache) {
            const filter = this.options.presences?.filter;
            if (filter) guild.presences.cache.sweep(filter());
          }
        });
        return null;
      case 'voiceStates':
        this.client.guilds?.cache.forEach((guild: any) => {
          if (guild.voiceStates?.cache) {
            const filter = this.options.voiceStates?.filter;
            if (filter) guild.voiceStates.cache.sweep(filter());
          }
        });
        return null;
      case 'reactions':
        // Sweep reactions from all messages
        this.client.channels?.cache.forEach((channel: any) => {
          channel.messages?.cache.forEach((message: any) => {
            if (message.reactions?.cache) {
              const filter = this.options.reactions?.filter;
              if (filter) message.reactions.cache.sweep(filter());
            }
          });
        });
        return null;
      case 'emojis':
        return this.client.emojis?.cache ?? null;
      case 'stickers':
        return this.client.stickers?.cache ?? null;
      case 'invites':
        // Sweep across all guilds
        this.client.guilds?.cache.forEach((guild: any) => {
          if (guild.invites?.cache) {
            const filter = this.options.invites?.filter;
            if (filter) guild.invites.cache.sweep(filter());
          }
        });
        return null;
      case 'bans':
        this.client.guilds?.cache.forEach((guild: any) => {
          if (guild.bans?.cache) {
            const filter = this.options.bans?.filter;
            if (filter) guild.bans.cache.sweep(filter());
          }
        });
        return null;
      default:
        return null;
    }
  }

  /**
   * Get sweeper statistics
   */
  getStats(): Record<string, { interval: number; running: boolean }> {
    const stats: Record<string, { interval: number; running: boolean }> = {};
    
    for (const [name, config] of Object.entries(this.options)) {
      if (config) {
        stats[name] = {
          interval: config.interval,
          running: this.intervals.has(name),
        };
      }
    }
    
    return stats;
  }
}

/**
 * Default sweeper options for common use cases
 */
export const DefaultSweeperOptions: SweeperDefinitions = {
  messages: {
    interval: 3600, // 1 hour
    filter: Sweepers.filterByLifetime({ lifetime: 1800 }), // 30 minutes
  },
  threads: {
    interval: 3600,
    filter: Sweepers.archivedThreadSweepFilter(14400), // 4 hours
  },
  invites: {
    interval: 3600,
    filter: Sweepers.expiredInviteSweepFilter(),
  },
};

export default SweeperManager;
