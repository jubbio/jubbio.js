"use strict";
/**
 * Sweepers - Automatic cache cleanup utilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultSweeperOptions = exports.SweeperManager = exports.Sweepers = void 0;
/**
 * Sweeper filters - predefined filter functions
 */
exports.Sweepers = {
    /**
     * Filter that sweeps items older than a certain lifetime
     */
    filterByLifetime(options = {}) {
        const lifetime = options.lifetime ?? 14400; // 4 hours default
        const getTimestamp = options.getComparisonTimestamp ??
            ((v) => v.createdTimestamp ?? v.createdAt?.getTime() ?? 0);
        const exclude = options.excludeFromSweep ?? (() => false);
        return () => {
            const now = Date.now();
            const cutoff = now - (lifetime * 1000);
            return (value) => {
                if (exclude(value))
                    return false;
                const timestamp = getTimestamp(value);
                return timestamp < cutoff;
            };
        };
    },
    /**
     * Filter that sweeps expired invites
     */
    expiredInviteSweepFilter() {
        return () => {
            const now = Date.now();
            return (invite) => {
                if (!invite.expiresAt && !invite.expiresTimestamp)
                    return false;
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
            return (presence) => {
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
class SweeperManager {
    client;
    intervals = new Map();
    options;
    constructor(client, options = {}) {
        this.client = client;
        this.options = options;
    }
    /**
     * Start all configured sweepers
     */
    start() {
        for (const [key, config] of Object.entries(this.options)) {
            if (config && config.interval > 0) {
                this.startSweeper(key, config);
            }
        }
    }
    /**
     * Start a specific sweeper
     */
    startSweeper(name, config) {
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
    stopSweeper(name) {
        const interval = this.intervals.get(name);
        if (interval) {
            clearInterval(interval);
            this.intervals.delete(name);
        }
    }
    /**
     * Stop all sweepers
     */
    stop() {
        for (const name of this.intervals.keys()) {
            this.stopSweeper(name);
        }
    }
    /**
     * Manually trigger a sweep
     */
    sweep(name, filter) {
        const cache = this.getCache(name);
        if (!cache)
            return 0;
        const filterFn = filter ?? this.options[name]?.filter;
        if (!filterFn)
            return 0;
        return cache.sweep(filterFn());
    }
    /**
     * Get the cache for a sweeper type
     */
    getCache(name) {
        switch (name) {
            case 'users':
                return this.client.users?.cache ?? null;
            case 'guildMembers':
                // Sweep across all guilds
                let memberCount = 0;
                this.client.guilds?.cache.forEach((guild) => {
                    if (guild.members?.cache) {
                        const filter = this.options.guildMembers?.filter;
                        if (filter)
                            memberCount += guild.members.cache.sweep(filter());
                    }
                });
                return null; // Already handled
            case 'messages':
                // Sweep across all channels
                this.client.channels?.cache.forEach((channel) => {
                    if (channel.messages?.cache) {
                        const filter = this.options.messages?.filter;
                        if (filter)
                            channel.messages.cache.sweep(filter());
                    }
                });
                return null;
            case 'presences':
                // Sweep across all guilds
                this.client.guilds?.cache.forEach((guild) => {
                    if (guild.presences?.cache) {
                        const filter = this.options.presences?.filter;
                        if (filter)
                            guild.presences.cache.sweep(filter());
                    }
                });
                return null;
            case 'voiceStates':
                this.client.guilds?.cache.forEach((guild) => {
                    if (guild.voiceStates?.cache) {
                        const filter = this.options.voiceStates?.filter;
                        if (filter)
                            guild.voiceStates.cache.sweep(filter());
                    }
                });
                return null;
            case 'reactions':
                // Sweep reactions from all messages
                this.client.channels?.cache.forEach((channel) => {
                    channel.messages?.cache.forEach((message) => {
                        if (message.reactions?.cache) {
                            const filter = this.options.reactions?.filter;
                            if (filter)
                                message.reactions.cache.sweep(filter());
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
                this.client.guilds?.cache.forEach((guild) => {
                    if (guild.invites?.cache) {
                        const filter = this.options.invites?.filter;
                        if (filter)
                            guild.invites.cache.sweep(filter());
                    }
                });
                return null;
            case 'bans':
                this.client.guilds?.cache.forEach((guild) => {
                    if (guild.bans?.cache) {
                        const filter = this.options.bans?.filter;
                        if (filter)
                            guild.bans.cache.sweep(filter());
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
    getStats() {
        const stats = {};
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
exports.SweeperManager = SweeperManager;
/**
 * Default sweeper options for common use cases
 */
exports.DefaultSweeperOptions = {
    messages: {
        interval: 3600, // 1 hour
        filter: exports.Sweepers.filterByLifetime({ lifetime: 1800 }), // 30 minutes
    },
    invites: {
        interval: 3600,
        filter: exports.Sweepers.expiredInviteSweepFilter(),
    },
};
exports.default = SweeperManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU3dlZXBlcnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdXRpbHMvU3dlZXBlcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOztHQUVHOzs7QUE0Q0g7O0dBRUc7QUFDVSxRQUFBLFFBQVEsR0FBRztJQUN0Qjs7T0FFRztJQUNILGdCQUFnQixDQUE0RCxVQUl4RSxFQUFFO1FBQ0osTUFBTSxRQUFRLEdBQUcsT0FBTyxDQUFDLFFBQVEsSUFBSSxLQUFLLENBQUMsQ0FBQyxrQkFBa0I7UUFDOUQsTUFBTSxZQUFZLEdBQUcsT0FBTyxDQUFDLHNCQUFzQjtZQUNqRCxDQUFDLENBQUMsQ0FBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsZ0JBQWdCLElBQUksQ0FBQyxDQUFDLFNBQVMsRUFBRSxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUNoRSxNQUFNLE9BQU8sR0FBRyxPQUFPLENBQUMsZ0JBQWdCLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUUxRCxPQUFPLEdBQUcsRUFBRTtZQUNWLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUN2QixNQUFNLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLENBQUM7WUFFdkMsT0FBTyxDQUFDLEtBQVEsRUFBRSxFQUFFO2dCQUNsQixJQUFJLE9BQU8sQ0FBQyxLQUFLLENBQUM7b0JBQUUsT0FBTyxLQUFLLENBQUM7Z0JBQ2pDLE1BQU0sU0FBUyxHQUFHLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDdEMsT0FBTyxTQUFTLEdBQUcsTUFBTSxDQUFDO1lBQzVCLENBQUMsQ0FBQztRQUNKLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRDs7T0FFRztJQUNILHdCQUF3QjtRQUN0QixPQUFPLEdBQUcsRUFBRTtZQUNWLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLEVB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QUksQ0FBQyxHQUFHO29CQUNaLFFBQVEsRUFBRSxNQUFNLENBQUMsUUFBUTtvQkFDekIsT0FBTyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQztpQkFDbEMsQ0FBQztZQUNKLENBQUM7UUFDSCxDQUFDO1FBRUQsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0NBQ0Y7QUFyS0Qsd0NBcUtDO0FBRUQ7O0dBRUc7QUFDVSxRQUFBLHFCQUFxQixHQUF1QjtJQUN2RCxRQUFRLEVBQUU7UUFDUixRQUFRLEVBQUUsSUFBSSxFQUFFLFNBQVM7UUFDekIsTUFBTSxFQUFFLGdCQUFRLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxhQUFhO0tBQ3JFO0lBQ0QsT0FBTyxFQUFFO1FBQ1AsUUFBUSxFQUFFLElBQUk7UUFDZCxNQUFNLEVBQUUsZ0JBQVEsQ0FBQyx3QkFBd0IsRUFBRTtLQUM1QztDQUNGLENBQUM7QUFFRixrQkFBZSxjQUFjLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogU3dlZXBlcnMgLSBBdXRvbWF0aWMgY2FjaGUgY2xlYW51cCB1dGlsaXRpZXNcclxuICovXHJcblxyXG5pbXBvcnQgeyBDb2xsZWN0aW9uIH0gZnJvbSAnLi9Db2xsZWN0aW9uJztcclxuXHJcbi8qKlxyXG4gKiBTd2VlcGVyIG9wdGlvbnMgZm9yIGEgc3BlY2lmaWMgY2FjaGVcclxuICovXHJcbmV4cG9ydCBpbnRlcmZhY2UgU3dlZXBlck9wdGlvbnMge1xyXG4gIC8qKiBJbnRlcnZhbCBpbiBzZWNvbmRzIGJldHdlZW4gc3dlZXBzICovXHJcbiAgaW50ZXJ2YWw6IG51bWJlcjtcclxuICAvKiogRmlsdGVyIGZ1bmN0aW9uIHRvIGRldGVybWluZSB3aGF0IHRvIHN3ZWVwICovXHJcbiAgZmlsdGVyOiAoKSA9PiAodmFsdWU6IGFueSwga2V5OiBzdHJpbmcsIGNvbGxlY3Rpb246IENvbGxlY3Rpb248c3RyaW5nLCBhbnk+KSA9PiBib29sZWFuO1xyXG59XHJcblxyXG4vKipcclxuICogR2xvYmFsIHN3ZWVwZXIgY29uZmlndXJhdGlvblxyXG4gKi9cclxuZXhwb3J0IGludGVyZmFjZSBTd2VlcGVyRGVmaW5pdGlvbnMge1xyXG4gIC8qKiBTd2VlcCBhcHBsaWNhdGlvbiBjb21tYW5kcyAqL1xyXG4gIGFwcGxpY2F0aW9uQ29tbWFuZHM/OiBTd2VlcGVyT3B0aW9ucztcclxuICAvKiogU3dlZXAgYmFucyAqL1xyXG4gIGJhbnM/OiBTd2VlcGVyT3B0aW9ucztcclxuICAvKiogU3dlZXAgZW1vamlzICovXHJcbiAgZW1vamlzPzogU3dlZXBlck9wdGlvbnM7XHJcbiAgLyoqIFN3ZWVwIGludml0ZXMgKi9cclxuICBpbnZpdGVzPzogU3dlZXBlck9wdGlvbnM7XHJcbiAgLyoqIFN3ZWVwIGd1aWxkIG1lbWJlcnMgKi9cclxuICBndWlsZE1lbWJlcnM/OiBTd2VlcGVyT3B0aW9ucztcclxuICAvKiogU3dlZXAgbWVzc2FnZXMgKi9cclxuICBtZXNzYWdlcz86IFN3ZWVwZXJPcHRpb25zO1xyXG4gIC8qKiBTd2VlcCBwcmVzZW5jZXMgKi9cclxuICBwcmVzZW5jZXM/OiBTd2VlcGVyT3B0aW9ucztcclxuICAvKiogU3dlZXAgcmVhY3Rpb25zICovXHJcbiAgcmVhY3Rpb25zPzogU3dlZXBlck9wdGlvbnM7XHJcbiAgLyoqIFN3ZWVwIHN0YWdlIGluc3RhbmNlcyAqL1xyXG4gIHN0YWdlSW5zdGFuY2VzPzogU3dlZXBlck9wdGlvbnM7XHJcbiAgLyoqIFN3ZWVwIHN0aWNrZXJzICovXHJcbiAgc3RpY2tlcnM/OiBTd2VlcGVyT3B0aW9ucztcclxuICAvKiogU3dlZXAgdXNlcnMgKi9cclxuICB1c2Vycz86IFN3ZWVwZXJPcHRpb25zO1xyXG4gIC8qKiBTd2VlcCB2b2ljZSBzdGF0ZXMgKi9cclxuICB2b2ljZVN0YXRlcz86IFN3ZWVwZXJPcHRpb25zO1xyXG59XHJcblxyXG4vKipcclxuICogU3dlZXBlciBmaWx0ZXJzIC0gcHJlZGVmaW5lZCBmaWx0ZXIgZnVuY3Rpb25zXHJcbiAqL1xyXG5leHBvcnQgY29uc3QgU3dlZXBlcnMgPSB7XHJcbiAgLyoqXHJcbiAgICogRmlsdGVyIHRoYXQgc3dlZXBzIGl0ZW1zIG9sZGVyIHRoYW4gYSBjZXJ0YWluIGxpZmV0aW1lXHJcbiAgICovXHJcbiAgZmlsdGVyQnlMaWZldGltZTxUIGV4dGVuZHMgeyBjcmVhdGVkVGltZXN0YW1wPzogbnVtYmVyOyBjcmVhdGVkQXQ/OiBEYXRlIH0+KG9wdGlvbnM6IHtcclxuICAgIGxpZmV0aW1lPzogbnVtYmVyO1xyXG4gICAgZ2V0Q29tcGFyaXNvblRpbWVzdGFtcD86ICh2YWx1ZTogVCkgPT4gbnVtYmVyO1xyXG4gICAgZXhjbHVkZUZyb21Td2VlcD86ICh2YWx1ZTogVCkgPT4gYm9vbGVhbjtcclxuICB9ID0ge30pIHtcclxuICAgIGNvbnN0IGxpZmV0aW1lID0gb3B0aW9ucy5saWZldGltZSA/PyAxNDQwMDsgLy8gNCBob3VycyBkZWZhdWx0XHJcbiAgICBjb25zdCBnZXRUaW1lc3RhbXAgPSBvcHRpb25zLmdldENvbXBhcmlzb25UaW1lc3RhbXAgPz8gXHJcbiAgICAgICgodjogVCkgPT4gdi5jcmVhdGVkVGltZXN0YW1wID8/IHYuY3JlYXRlZEF0Py5nZXRUaW1lKCkgPz8gMCk7XHJcbiAgICBjb25zdCBleGNsdWRlID0gb3B0aW9ucy5leGNsdWRlRnJvbVN3ZWVwID8/ICgoKSA9PiBmYWxzZSk7XHJcbiAgICBcclxuICAgIHJldHVybiAoKSA9PiB7XHJcbiAgICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XHJcbiAgICAgIGNvbnN0IGN1dG9mZiA9IG5vdyAtIChsaWZldGltZSAqIDEwMDApO1xyXG4gICAgICBcclxuICAgICAgcmV0dXJuICh2YWx1ZTogVCkgPT4ge1xyXG4gICAgICAgIGlmIChleGNsdWRlKHZhbHVlKSkgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIGNvbnN0IHRpbWVzdGFtcCA9IGdldFRpbWVzdGFtcCh2YWx1ZSk7XHJcbiAgICAgICAgcmV0dXJuIHRpbWVzdGFtcCA8IGN1dG9mZjtcclxuICAgICAgfTtcclxuICAgIH07XHJcbiAgfSxcclxuXHJcbiAgLyoqXHJcbiAgICogRmlsdGVyIHRoYXQgc3dlZXBzIGV4cGlyZWQgaW52aXRlc1xyXG4gICAqL1xyXG4gIGV4cGlyZWRJbnZpdGVTd2VlcEZpbHRlcigpIHtcclxuICAgIHJldHVybiAoKSA9PiB7XHJcbiAgICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XHJcbiAgICAgIHJldHVybiAoaW52aXRlOiBhbnkpID0+IHtcclxuICAgICAgICBpZiAoIWludml0ZS5leHBpcmVzQXQgJiYgIWludml0ZS5leHBpcmVzVGltZXN0YW1wKSByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgY29uc3QgZXhwaXJlc0F0ID0gaW52aXRlLmV4cGlyZXNBdD8uZ2V0VGltZSgpID8/IGludml0ZS5leHBpcmVzVGltZXN0YW1wID8/IEluZmluaXR5O1xyXG4gICAgICAgIHJldHVybiBleHBpcmVzQXQgPCBub3c7XHJcbiAgICAgIH07XHJcbiAgICB9O1xyXG4gIH0sXHJcblxyXG4gIC8qKlxyXG4gICAqIEZpbHRlciB0aGF0IHN3ZWVwcyBvdXRkYXRlZCBwcmVzZW5jZXNcclxuICAgKi9cclxuICBvdXRkYXRlZFByZXNlbmNlU3dlZXBGaWx0ZXIobGlmZXRpbWUgPSAyMTYwMCkge1xyXG4gICAgcmV0dXJuICgpID0+IHtcclxuICAgICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcclxuICAgICAgY29uc3QgY3V0b2ZmID0gbm93IC0gKGxpZmV0aW1lICogMTAwMCk7XHJcbiAgICAgIFxyXG4gICAgICByZXR1cm4gKHByZXNlbmNlOiBhbnkpID0+IHtcclxuICAgICAgICBjb25zdCBsYXN0VXBkYXRlID0gcHJlc2VuY2UubGFzdE1vZGlmaWVkID8/IHByZXNlbmNlLnVwZGF0ZWRBdD8uZ2V0VGltZSgpID8/IDA7XHJcbiAgICAgICAgcmV0dXJuIGxhc3RVcGRhdGUgPCBjdXRvZmY7XHJcbiAgICAgIH07XHJcbiAgICB9O1xyXG4gIH0sXHJcblxyXG4gIC8qKlxyXG4gICAqIEZpbHRlciB0aGF0IHN3ZWVwcyBhbGwgaXRlbXMgKHVzZSB3aXRoIGNhdXRpb24pXHJcbiAgICovXHJcbiAgc3dlZXBBbGwoKSB7XHJcbiAgICByZXR1cm4gKCkgPT4gKCkgPT4gdHJ1ZTtcclxuICB9LFxyXG5cclxuICAvKipcclxuICAgKiBGaWx0ZXIgdGhhdCBzd2VlcHMgbm90aGluZ1xyXG4gICAqL1xyXG4gIHN3ZWVwTm9uZSgpIHtcclxuICAgIHJldHVybiAoKSA9PiAoKSA9PiBmYWxzZTtcclxuICB9LFxyXG59O1xyXG5cclxuLyoqXHJcbiAqIFN3ZWVwZXIgbWFuYWdlciBjbGFzc1xyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFN3ZWVwZXJNYW5hZ2VyIHtcclxuICBwcml2YXRlIGNsaWVudDogYW55O1xyXG4gIHByaXZhdGUgaW50ZXJ2YWxzOiBNYXA8c3RyaW5nLCBOb2RlSlMuVGltZW91dD4gPSBuZXcgTWFwKCk7XHJcbiAgcHJpdmF0ZSBvcHRpb25zOiBTd2VlcGVyRGVmaW5pdGlvbnM7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGNsaWVudDogYW55LCBvcHRpb25zOiBTd2VlcGVyRGVmaW5pdGlvbnMgPSB7fSkge1xyXG4gICAgdGhpcy5jbGllbnQgPSBjbGllbnQ7XHJcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU3RhcnQgYWxsIGNvbmZpZ3VyZWQgc3dlZXBlcnNcclxuICAgKi9cclxuICBzdGFydCgpOiB2b2lkIHtcclxuICAgIGZvciAoY29uc3QgW2tleSwgY29uZmlnXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLm9wdGlvbnMpKSB7XHJcbiAgICAgIGlmIChjb25maWcgJiYgY29uZmlnLmludGVydmFsID4gMCkge1xyXG4gICAgICAgIHRoaXMuc3RhcnRTd2VlcGVyKGtleSBhcyBrZXlvZiBTd2VlcGVyRGVmaW5pdGlvbnMsIGNvbmZpZyk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFN0YXJ0IGEgc3BlY2lmaWMgc3dlZXBlclxyXG4gICAqL1xyXG4gIHByaXZhdGUgc3RhcnRTd2VlcGVyKG5hbWU6IGtleW9mIFN3ZWVwZXJEZWZpbml0aW9ucywgY29uZmlnOiBTd2VlcGVyT3B0aW9ucyk6IHZvaWQge1xyXG4gICAgLy8gQ2xlYXIgZXhpc3RpbmcgaW50ZXJ2YWwgaWYgYW55XHJcbiAgICB0aGlzLnN0b3BTd2VlcGVyKG5hbWUpO1xyXG4gICAgXHJcbiAgICBjb25zdCBpbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHtcclxuICAgICAgdGhpcy5zd2VlcChuYW1lLCBjb25maWcuZmlsdGVyKTtcclxuICAgIH0sIGNvbmZpZy5pbnRlcnZhbCAqIDEwMDApO1xyXG4gICAgXHJcbiAgICB0aGlzLmludGVydmFscy5zZXQobmFtZSwgaW50ZXJ2YWwpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU3RvcCBhIHNwZWNpZmljIHN3ZWVwZXJcclxuICAgKi9cclxuICBzdG9wU3dlZXBlcihuYW1lOiBrZXlvZiBTd2VlcGVyRGVmaW5pdGlvbnMpOiB2b2lkIHtcclxuICAgIGNvbnN0IGludGVydmFsID0gdGhpcy5pbnRlcnZhbHMuZ2V0KG5hbWUpO1xyXG4gICAgaWYgKGludGVydmFsKSB7XHJcbiAgICAgIGNsZWFySW50ZXJ2YWwoaW50ZXJ2YWwpO1xyXG4gICAgICB0aGlzLmludGVydmFscy5kZWxldGUobmFtZSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTdG9wIGFsbCBzd2VlcGVyc1xyXG4gICAqL1xyXG4gIHN0b3AoKTogdm9pZCB7XHJcbiAgICBmb3IgKGNvbnN0IG5hbWUgb2YgdGhpcy5pbnRlcnZhbHMua2V5cygpKSB7XHJcbiAgICAgIHRoaXMuc3RvcFN3ZWVwZXIobmFtZSBhcyBrZXlvZiBTd2VlcGVyRGVmaW5pdGlvbnMpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogTWFudWFsbHkgdHJpZ2dlciBhIHN3ZWVwXHJcbiAgICovXHJcbiAgc3dlZXAobmFtZToga2V5b2YgU3dlZXBlckRlZmluaXRpb25zLCBmaWx0ZXI/OiAoKSA9PiAodmFsdWU6IGFueSwga2V5OiBzdHJpbmcsIGNvbGxlY3Rpb246IENvbGxlY3Rpb248c3RyaW5nLCBhbnk+KSA9PiBib29sZWFuKTogbnVtYmVyIHtcclxuICAgIGNvbnN0IGNhY2hlID0gdGhpcy5nZXRDYWNoZShuYW1lKTtcclxuICAgIGlmICghY2FjaGUpIHJldHVybiAwO1xyXG4gICAgXHJcbiAgICBjb25zdCBmaWx0ZXJGbiA9IGZpbHRlciA/PyB0aGlzLm9wdGlvbnNbbmFtZV0/LmZpbHRlcjtcclxuICAgIGlmICghZmlsdGVyRm4pIHJldHVybiAwO1xyXG4gICAgXHJcbiAgICByZXR1cm4gY2FjaGUuc3dlZXAoZmlsdGVyRm4oKSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgdGhlIGNhY2hlIGZvciBhIHN3ZWVwZXIgdHlwZVxyXG4gICAqL1xyXG4gIHByaXZhdGUgZ2V0Q2FjaGUobmFtZToga2V5b2YgU3dlZXBlckRlZmluaXRpb25zKTogQ29sbGVjdGlvbjxzdHJpbmcsIGFueT4gfCBudWxsIHtcclxuICAgIHN3aXRjaCAobmFtZSkge1xyXG4gICAgICBjYXNlICd1c2Vycyc6XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuY2xpZW50LnVzZXJzPy5jYWNoZSA/PyBudWxsO1xyXG4gICAgICBjYXNlICdndWlsZE1lbWJlcnMnOlxyXG4gICAgICAgIC8vIFN3ZWVwIGFjcm9zcyBhbGwgZ3VpbGRzXHJcbiAgICAgICAgbGV0IG1lbWJlckNvdW50ID0gMDtcclxuICAgICAgICB0aGlzLmNsaWVudC5ndWlsZHM/LmNhY2hlLmZvckVhY2goKGd1aWxkOiBhbnkpID0+IHtcclxuICAgICAgICAgIGlmIChndWlsZC5tZW1iZXJzPy5jYWNoZSkge1xyXG4gICAgICAgICAgICBjb25zdCBmaWx0ZXIgPSB0aGlzLm9wdGlvbnMuZ3VpbGRNZW1iZXJzPy5maWx0ZXI7XHJcbiAgICAgICAgICAgIGlmIChmaWx0ZXIpIG1lbWJlckNvdW50ICs9IGd1aWxkLm1lbWJlcnMuY2FjaGUuc3dlZXAoZmlsdGVyKCkpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHJldHVybiBudWxsOyAvLyBBbHJlYWR5IGhhbmRsZWRcclxuICAgICAgY2FzZSAnbWVzc2FnZXMnOlxyXG4gICAgICAgIC8vIFN3ZWVwIGFjcm9zcyBhbGwgY2hhbm5lbHNcclxuICAgICAgICB0aGlzLmNsaWVudC5jaGFubmVscz8uY2FjaGUuZm9yRWFjaCgoY2hhbm5lbDogYW55KSA9PiB7XHJcbiAgICAgICAgICBpZiAoY2hhbm5lbC5tZXNzYWdlcz8uY2FjaGUpIHtcclxuICAgICAgICAgICAgY29uc3QgZmlsdGVyID0gdGhpcy5vcHRpb25zLm1lc3NhZ2VzPy5maWx0ZXI7XHJcbiAgICAgICAgICAgIGlmIChmaWx0ZXIpIGNoYW5uZWwubWVzc2FnZXMuY2FjaGUuc3dlZXAoZmlsdGVyKCkpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICBjYXNlICdwcmVzZW5jZXMnOlxyXG4gICAgICAgIC8vIFN3ZWVwIGFjcm9zcyBhbGwgZ3VpbGRzXHJcbiAgICAgICAgdGhpcy5jbGllbnQuZ3VpbGRzPy5jYWNoZS5mb3JFYWNoKChndWlsZDogYW55KSA9PiB7XHJcbiAgICAgICAgICBpZiAoZ3VpbGQucHJlc2VuY2VzPy5jYWNoZSkge1xyXG4gICAgICAgICAgICBjb25zdCBmaWx0ZXIgPSB0aGlzLm9wdGlvbnMucHJlc2VuY2VzPy5maWx0ZXI7XHJcbiAgICAgICAgICAgIGlmIChmaWx0ZXIpIGd1aWxkLnByZXNlbmNlcy5jYWNoZS5zd2VlcChmaWx0ZXIoKSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgIGNhc2UgJ3ZvaWNlU3RhdGVzJzpcclxuICAgICAgICB0aGlzLmNsaWVudC5ndWlsZHM/LmNhY2hlLmZvckVhY2goKGd1aWxkOiBhbnkpID0+IHtcclxuICAgICAgICAgIGlmIChndWlsZC52b2ljZVN0YXRlcz8uY2FjaGUpIHtcclxuICAgICAgICAgICAgY29uc3QgZmlsdGVyID0gdGhpcy5vcHRpb25zLnZvaWNlU3RhdGVzPy5maWx0ZXI7XHJcbiAgICAgICAgICAgIGlmIChmaWx0ZXIpIGd1aWxkLnZvaWNlU3RhdGVzLmNhY2hlLnN3ZWVwKGZpbHRlcigpKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgY2FzZSAncmVhY3Rpb25zJzpcclxuICAgICAgICAvLyBTd2VlcCByZWFjdGlvbnMgZnJvbSBhbGwgbWVzc2FnZXNcclxuICAgICAgICB0aGlzLmNsaWVudC5jaGFubmVscz8uY2FjaGUuZm9yRWFjaCgoY2hhbm5lbDogYW55KSA9PiB7XHJcbiAgICAgICAgICBjaGFubmVsLm1lc3NhZ2VzPy5jYWNoZS5mb3JFYWNoKChtZXNzYWdlOiBhbnkpID0+IHtcclxuICAgICAgICAgICAgaWYgKG1lc3NhZ2UucmVhY3Rpb25zPy5jYWNoZSkge1xyXG4gICAgICAgICAgICAgIGNvbnN0IGZpbHRlciA9IHRoaXMub3B0aW9ucy5yZWFjdGlvbnM/LmZpbHRlcjtcclxuICAgICAgICAgICAgICBpZiAoZmlsdGVyKSBtZXNzYWdlLnJlYWN0aW9ucy5jYWNoZS5zd2VlcChmaWx0ZXIoKSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICBjYXNlICdlbW9qaXMnOlxyXG4gICAgICAgIHJldHVybiB0aGlzLmNsaWVudC5lbW9qaXM/LmNhY2hlID8/IG51bGw7XHJcbiAgICAgIGNhc2UgJ3N0aWNrZXJzJzpcclxuICAgICAgICByZXR1cm4gdGhpcy5jbGllbnQuc3RpY2tlcnM/LmNhY2hlID8/IG51bGw7XHJcbiAgICAgIGNhc2UgJ2ludml0ZXMnOlxyXG4gICAgICAgIC8vIFN3ZWVwIGFjcm9zcyBhbGwgZ3VpbGRzXHJcbiAgICAgICAgdGhpcy5jbGllbnQuZ3VpbGRzPy5jYWNoZS5mb3JFYWNoKChndWlsZDogYW55KSA9PiB7XHJcbiAgICAgICAgICBpZiAoZ3VpbGQuaW52aXRlcz8uY2FjaGUpIHtcclxuICAgICAgICAgICAgY29uc3QgZmlsdGVyID0gdGhpcy5vcHRpb25zLmludml0ZXM/LmZpbHRlcjtcclxuICAgICAgICAgICAgaWYgKGZpbHRlcikgZ3VpbGQuaW52aXRlcy5jYWNoZS5zd2VlcChmaWx0ZXIoKSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgIGNhc2UgJ2JhbnMnOlxyXG4gICAgICAgIHRoaXMuY2xpZW50Lmd1aWxkcz8uY2FjaGUuZm9yRWFjaCgoZ3VpbGQ6IGFueSkgPT4ge1xyXG4gICAgICAgICAgaWYgKGd1aWxkLmJhbnM/LmNhY2hlKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGZpbHRlciA9IHRoaXMub3B0aW9ucy5iYW5zPy5maWx0ZXI7XHJcbiAgICAgICAgICAgIGlmIChmaWx0ZXIpIGd1aWxkLmJhbnMuY2FjaGUuc3dlZXAoZmlsdGVyKCkpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICBkZWZhdWx0OlxyXG4gICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IHN3ZWVwZXIgc3RhdGlzdGljc1xyXG4gICAqL1xyXG4gIGdldFN0YXRzKCk6IFJlY29yZDxzdHJpbmcsIHsgaW50ZXJ2YWw6IG51bWJlcjsgcnVubmluZzogYm9vbGVhbiB9PiB7XHJcbiAgICBjb25zdCBzdGF0czogUmVjb3JkPHN0cmluZywgeyBpbnRlcnZhbDogbnVtYmVyOyBydW5uaW5nOiBib29sZWFuIH0+ID0ge307XHJcbiAgICBcclxuICAgIGZvciAoY29uc3QgW25hbWUsIGNvbmZpZ10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5vcHRpb25zKSkge1xyXG4gICAgICBpZiAoY29uZmlnKSB7XHJcbiAgICAgICAgc3RhdHNbbmFtZV0gPSB7XHJcbiAgICAgICAgICBpbnRlcnZhbDogY29uZmlnLmludGVydmFsLFxyXG4gICAgICAgICAgcnVubmluZzogdGhpcy5pbnRlcnZhbHMuaGFzKG5hbWUpLFxyXG4gICAgICAgIH07XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgcmV0dXJuIHN0YXRzO1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIERlZmF1bHQgc3dlZXBlciBvcHRpb25zIGZvciBjb21tb24gdXNlIGNhc2VzXHJcbiAqL1xyXG5leHBvcnQgY29uc3QgRGVmYXVsdFN3ZWVwZXJPcHRpb25zOiBTd2VlcGVyRGVmaW5pdGlvbnMgPSB7XHJcbiAgbWVzc2FnZXM6IHtcclxuICAgIGludGVydmFsOiAzNjAwLCAvLyAxIGhvdXJcclxuICAgIGZpbHRlcjogU3dlZXBlcnMuZmlsdGVyQnlMaWZldGltZSh7IGxpZmV0aW1lOiAxODAwIH0pLCAvLyAzMCBtaW51dGVzXHJcbiAgfSxcclxuICBpbnZpdGVzOiB7XHJcbiAgICBpbnRlcnZhbDogMzYwMCxcclxuICAgIGZpbHRlcjogU3dlZXBlcnMuZXhwaXJlZEludml0ZVN3ZWVwRmlsdGVyKCksXHJcbiAgfSxcclxufTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IFN3ZWVwZXJNYW5hZ2VyO1xyXG4iXX0=