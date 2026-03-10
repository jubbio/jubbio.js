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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU3dlZXBlcnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdXRpbHMvU3dlZXBlcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOztHQUVHOzs7QUE0Q0g7O0dBRUc7QUFDVSxRQUFBLFFBQVEsR0FBRztJQUN0Qjs7T0FFRztJQUNILGdCQUFnQixDQUE0RCxVQUl4RSxFQUFFO1FBQ0osTUFBTSxRQUFRLEdBQUcsT0FBTyxDQUFDLFFBQVEsSUFBSSxLQUFLLENBQUMsQ0FBQyxrQkFBa0I7UUFDOUQsTUFBTSxZQUFZLEdBQUcsT0FBTyxDQUFDLHNCQUFzQjtZQUNqRCxDQUFDLENBQUMsQ0FBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsZ0JBQWdCLElBQUksQ0FBQyxDQUFDLFNBQVMsRUFBRSxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUNoRSxNQUFNLE9BQU8sR0FBRyxPQUFPLENBQUMsZ0JBQWdCLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUUxRCxPQUFPLEdBQUcsRUFBRTtZQUNWLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUN2QixNQUFNLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLENBQUM7WUFFdkMsT0FBTyxDQUFDLEtBQVEsRUFBRSxFQUFFO2dCQUNsQixJQUFJLE9BQU8sQ0FBQyxLQUFLLENBQUM7b0JBQUUsT0FBTyxLQUFLLENBQUM7Z0JBQ2pDLE1BQU0sU0FBUyxHQUFHLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDdEMsT0FBTyxTQUFTLEdBQUcsTUFBTSxDQUFDO1lBQzVCLENBQUMsQ0FBQztRQUNKLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRDs7T0FFRztJQUNILHdCQUF3QjtRQUN0QixPQUFPLEdBQUcsRUFBRTtZQUNWLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLEVB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QUksQ0FBQyxHQUFHO29CQUNaLFFBQVEsRUFBRSxNQUFNLENBQUMsUUFBUTtvQkFDekIsT0FBTyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQztpQkFDbEMsQ0FBQztZQUNKLENBQUM7UUFDSCxDQUFDO1FBRUQsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0NBQ0Y7QUFyS0Qsd0NBcUtDO0FBRUQ7O0dBRUc7QUFDVSxRQUFBLHFCQUFxQixHQUF1QjtJQUN2RCxRQUFRLEVBQUU7UUFDUixRQUFRLEVBQUUsSUFBSSxFQUFFLFNBQVM7UUFDekIsTUFBTSxFQUFFLGdCQUFRLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxhQUFhO0tBQ3JFO0lBQ0QsT0FBTyxFQUFFO1FBQ1AsUUFBUSxFQUFFLElBQUk7UUFDZCxNQUFNLEVBQUUsZ0JBQVEsQ0FBQyx3QkFBd0IsRUFBRTtLQUM1QztDQUNGLENBQUM7QUFFRixrQkFBZSxjQUFjLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFN3ZWVwZXJzIC0gQXV0b21hdGljIGNhY2hlIGNsZWFudXAgdXRpbGl0aWVzXG4gKi9cblxuaW1wb3J0IHsgQ29sbGVjdGlvbiB9IGZyb20gJy4vQ29sbGVjdGlvbic7XG5cbi8qKlxuICogU3dlZXBlciBvcHRpb25zIGZvciBhIHNwZWNpZmljIGNhY2hlXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU3dlZXBlck9wdGlvbnMge1xuICAvKiogSW50ZXJ2YWwgaW4gc2Vjb25kcyBiZXR3ZWVuIHN3ZWVwcyAqL1xuICBpbnRlcnZhbDogbnVtYmVyO1xuICAvKiogRmlsdGVyIGZ1bmN0aW9uIHRvIGRldGVybWluZSB3aGF0IHRvIHN3ZWVwICovXG4gIGZpbHRlcjogKCkgPT4gKHZhbHVlOiBhbnksIGtleTogc3RyaW5nLCBjb2xsZWN0aW9uOiBDb2xsZWN0aW9uPHN0cmluZywgYW55PikgPT4gYm9vbGVhbjtcbn1cblxuLyoqXG4gKiBHbG9iYWwgc3dlZXBlciBjb25maWd1cmF0aW9uXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgU3dlZXBlckRlZmluaXRpb25zIHtcbiAgLyoqIFN3ZWVwIGFwcGxpY2F0aW9uIGNvbW1hbmRzICovXG4gIGFwcGxpY2F0aW9uQ29tbWFuZHM/OiBTd2VlcGVyT3B0aW9ucztcbiAgLyoqIFN3ZWVwIGJhbnMgKi9cbiAgYmFucz86IFN3ZWVwZXJPcHRpb25zO1xuICAvKiogU3dlZXAgZW1vamlzICovXG4gIGVtb2ppcz86IFN3ZWVwZXJPcHRpb25zO1xuICAvKiogU3dlZXAgaW52aXRlcyAqL1xuICBpbnZpdGVzPzogU3dlZXBlck9wdGlvbnM7XG4gIC8qKiBTd2VlcCBndWlsZCBtZW1iZXJzICovXG4gIGd1aWxkTWVtYmVycz86IFN3ZWVwZXJPcHRpb25zO1xuICAvKiogU3dlZXAgbWVzc2FnZXMgKi9cbiAgbWVzc2FnZXM/OiBTd2VlcGVyT3B0aW9ucztcbiAgLyoqIFN3ZWVwIHByZXNlbmNlcyAqL1xuICBwcmVzZW5jZXM/OiBTd2VlcGVyT3B0aW9ucztcbiAgLyoqIFN3ZWVwIHJlYWN0aW9ucyAqL1xuICByZWFjdGlvbnM/OiBTd2VlcGVyT3B0aW9ucztcbiAgLyoqIFN3ZWVwIHN0YWdlIGluc3RhbmNlcyAqL1xuICBzdGFnZUluc3RhbmNlcz86IFN3ZWVwZXJPcHRpb25zO1xuICAvKiogU3dlZXAgc3RpY2tlcnMgKi9cbiAgc3RpY2tlcnM/OiBTd2VlcGVyT3B0aW9ucztcbiAgLyoqIFN3ZWVwIHVzZXJzICovXG4gIHVzZXJzPzogU3dlZXBlck9wdGlvbnM7XG4gIC8qKiBTd2VlcCB2b2ljZSBzdGF0ZXMgKi9cbiAgdm9pY2VTdGF0ZXM/OiBTd2VlcGVyT3B0aW9ucztcbn1cblxuLyoqXG4gKiBTd2VlcGVyIGZpbHRlcnMgLSBwcmVkZWZpbmVkIGZpbHRlciBmdW5jdGlvbnNcbiAqL1xuZXhwb3J0IGNvbnN0IFN3ZWVwZXJzID0ge1xuICAvKipcbiAgICogRmlsdGVyIHRoYXQgc3dlZXBzIGl0ZW1zIG9sZGVyIHRoYW4gYSBjZXJ0YWluIGxpZmV0aW1lXG4gICAqL1xuICBmaWx0ZXJCeUxpZmV0aW1lPFQgZXh0ZW5kcyB7IGNyZWF0ZWRUaW1lc3RhbXA/OiBudW1iZXI7IGNyZWF0ZWRBdD86IERhdGUgfT4ob3B0aW9uczoge1xuICAgIGxpZmV0aW1lPzogbnVtYmVyO1xuICAgIGdldENvbXBhcmlzb25UaW1lc3RhbXA/OiAodmFsdWU6IFQpID0+IG51bWJlcjtcbiAgICBleGNsdWRlRnJvbVN3ZWVwPzogKHZhbHVlOiBUKSA9PiBib29sZWFuO1xuICB9ID0ge30pIHtcbiAgICBjb25zdCBsaWZldGltZSA9IG9wdGlvbnMubGlmZXRpbWUgPz8gMTQ0MDA7IC8vIDQgaG91cnMgZGVmYXVsdFxuICAgIGNvbnN0IGdldFRpbWVzdGFtcCA9IG9wdGlvbnMuZ2V0Q29tcGFyaXNvblRpbWVzdGFtcCA/PyBcbiAgICAgICgodjogVCkgPT4gdi5jcmVhdGVkVGltZXN0YW1wID8/IHYuY3JlYXRlZEF0Py5nZXRUaW1lKCkgPz8gMCk7XG4gICAgY29uc3QgZXhjbHVkZSA9IG9wdGlvbnMuZXhjbHVkZUZyb21Td2VlcCA/PyAoKCkgPT4gZmFsc2UpO1xuICAgIFxuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuICAgICAgY29uc3QgY3V0b2ZmID0gbm93IC0gKGxpZmV0aW1lICogMTAwMCk7XG4gICAgICBcbiAgICAgIHJldHVybiAodmFsdWU6IFQpID0+IHtcbiAgICAgICAgaWYgKGV4Y2x1ZGUodmFsdWUpKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIGNvbnN0IHRpbWVzdGFtcCA9IGdldFRpbWVzdGFtcCh2YWx1ZSk7XG4gICAgICAgIHJldHVybiB0aW1lc3RhbXAgPCBjdXRvZmY7XG4gICAgICB9O1xuICAgIH07XG4gIH0sXG5cbiAgLyoqXG4gICAqIEZpbHRlciB0aGF0IHN3ZWVwcyBleHBpcmVkIGludml0ZXNcbiAgICovXG4gIGV4cGlyZWRJbnZpdGVTd2VlcEZpbHRlcigpIHtcbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbiAgICAgIHJldHVybiAoaW52aXRlOiBhbnkpID0+IHtcbiAgICAgICAgaWYgKCFpbnZpdGUuZXhwaXJlc0F0ICYmICFpbnZpdGUuZXhwaXJlc1RpbWVzdGFtcCkgcmV0dXJuIGZhbHNlO1xuICAgICAgICBjb25zdCBleHBpcmVzQXQgPSBpbnZpdGUuZXhwaXJlc0F0Py5nZXRUaW1lKCkgPz8gaW52aXRlLmV4cGlyZXNUaW1lc3RhbXAgPz8gSW5maW5pdHk7XG4gICAgICAgIHJldHVybiBleHBpcmVzQXQgPCBub3c7XG4gICAgICB9O1xuICAgIH07XG4gIH0sXG5cbiAgLyoqXG4gICAqIEZpbHRlciB0aGF0IHN3ZWVwcyBvdXRkYXRlZCBwcmVzZW5jZXNcbiAgICovXG4gIG91dGRhdGVkUHJlc2VuY2VTd2VlcEZpbHRlcihsaWZldGltZSA9IDIxNjAwKSB7XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4gICAgICBjb25zdCBjdXRvZmYgPSBub3cgLSAobGlmZXRpbWUgKiAxMDAwKTtcbiAgICAgIFxuICAgICAgcmV0dXJuIChwcmVzZW5jZTogYW55KSA9PiB7XG4gICAgICAgIGNvbnN0IGxhc3RVcGRhdGUgPSBwcmVzZW5jZS5sYXN0TW9kaWZpZWQgPz8gcHJlc2VuY2UudXBkYXRlZEF0Py5nZXRUaW1lKCkgPz8gMDtcbiAgICAgICAgcmV0dXJuIGxhc3RVcGRhdGUgPCBjdXRvZmY7XG4gICAgICB9O1xuICAgIH07XG4gIH0sXG5cbiAgLyoqXG4gICAqIEZpbHRlciB0aGF0IHN3ZWVwcyBhbGwgaXRlbXMgKHVzZSB3aXRoIGNhdXRpb24pXG4gICAqL1xuICBzd2VlcEFsbCgpIHtcbiAgICByZXR1cm4gKCkgPT4gKCkgPT4gdHJ1ZTtcbiAgfSxcblxuICAvKipcbiAgICogRmlsdGVyIHRoYXQgc3dlZXBzIG5vdGhpbmdcbiAgICovXG4gIHN3ZWVwTm9uZSgpIHtcbiAgICByZXR1cm4gKCkgPT4gKCkgPT4gZmFsc2U7XG4gIH0sXG59O1xuXG4vKipcbiAqIFN3ZWVwZXIgbWFuYWdlciBjbGFzc1xuICovXG5leHBvcnQgY2xhc3MgU3dlZXBlck1hbmFnZXIge1xuICBwcml2YXRlIGNsaWVudDogYW55O1xuICBwcml2YXRlIGludGVydmFsczogTWFwPHN0cmluZywgTm9kZUpTLlRpbWVvdXQ+ID0gbmV3IE1hcCgpO1xuICBwcml2YXRlIG9wdGlvbnM6IFN3ZWVwZXJEZWZpbml0aW9ucztcblxuICBjb25zdHJ1Y3RvcihjbGllbnQ6IGFueSwgb3B0aW9uczogU3dlZXBlckRlZmluaXRpb25zID0ge30pIHtcbiAgICB0aGlzLmNsaWVudCA9IGNsaWVudDtcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICB9XG5cbiAgLyoqXG4gICAqIFN0YXJ0IGFsbCBjb25maWd1cmVkIHN3ZWVwZXJzXG4gICAqL1xuICBzdGFydCgpOiB2b2lkIHtcbiAgICBmb3IgKGNvbnN0IFtrZXksIGNvbmZpZ10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5vcHRpb25zKSkge1xuICAgICAgaWYgKGNvbmZpZyAmJiBjb25maWcuaW50ZXJ2YWwgPiAwKSB7XG4gICAgICAgIHRoaXMuc3RhcnRTd2VlcGVyKGtleSBhcyBrZXlvZiBTd2VlcGVyRGVmaW5pdGlvbnMsIGNvbmZpZyk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFN0YXJ0IGEgc3BlY2lmaWMgc3dlZXBlclxuICAgKi9cbiAgcHJpdmF0ZSBzdGFydFN3ZWVwZXIobmFtZToga2V5b2YgU3dlZXBlckRlZmluaXRpb25zLCBjb25maWc6IFN3ZWVwZXJPcHRpb25zKTogdm9pZCB7XG4gICAgLy8gQ2xlYXIgZXhpc3RpbmcgaW50ZXJ2YWwgaWYgYW55XG4gICAgdGhpcy5zdG9wU3dlZXBlcihuYW1lKTtcbiAgICBcbiAgICBjb25zdCBpbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgIHRoaXMuc3dlZXAobmFtZSwgY29uZmlnLmZpbHRlcik7XG4gICAgfSwgY29uZmlnLmludGVydmFsICogMTAwMCk7XG4gICAgXG4gICAgdGhpcy5pbnRlcnZhbHMuc2V0KG5hbWUsIGludGVydmFsKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTdG9wIGEgc3BlY2lmaWMgc3dlZXBlclxuICAgKi9cbiAgc3RvcFN3ZWVwZXIobmFtZToga2V5b2YgU3dlZXBlckRlZmluaXRpb25zKTogdm9pZCB7XG4gICAgY29uc3QgaW50ZXJ2YWwgPSB0aGlzLmludGVydmFscy5nZXQobmFtZSk7XG4gICAgaWYgKGludGVydmFsKSB7XG4gICAgICBjbGVhckludGVydmFsKGludGVydmFsKTtcbiAgICAgIHRoaXMuaW50ZXJ2YWxzLmRlbGV0ZShuYW1lKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogU3RvcCBhbGwgc3dlZXBlcnNcbiAgICovXG4gIHN0b3AoKTogdm9pZCB7XG4gICAgZm9yIChjb25zdCBuYW1lIG9mIHRoaXMuaW50ZXJ2YWxzLmtleXMoKSkge1xuICAgICAgdGhpcy5zdG9wU3dlZXBlcihuYW1lIGFzIGtleW9mIFN3ZWVwZXJEZWZpbml0aW9ucyk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIE1hbnVhbGx5IHRyaWdnZXIgYSBzd2VlcFxuICAgKi9cbiAgc3dlZXAobmFtZToga2V5b2YgU3dlZXBlckRlZmluaXRpb25zLCBmaWx0ZXI/OiAoKSA9PiAodmFsdWU6IGFueSwga2V5OiBzdHJpbmcsIGNvbGxlY3Rpb246IENvbGxlY3Rpb248c3RyaW5nLCBhbnk+KSA9PiBib29sZWFuKTogbnVtYmVyIHtcbiAgICBjb25zdCBjYWNoZSA9IHRoaXMuZ2V0Q2FjaGUobmFtZSk7XG4gICAgaWYgKCFjYWNoZSkgcmV0dXJuIDA7XG4gICAgXG4gICAgY29uc3QgZmlsdGVyRm4gPSBmaWx0ZXIgPz8gdGhpcy5vcHRpb25zW25hbWVdPy5maWx0ZXI7XG4gICAgaWYgKCFmaWx0ZXJGbikgcmV0dXJuIDA7XG4gICAgXG4gICAgcmV0dXJuIGNhY2hlLnN3ZWVwKGZpbHRlckZuKCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCB0aGUgY2FjaGUgZm9yIGEgc3dlZXBlciB0eXBlXG4gICAqL1xuICBwcml2YXRlIGdldENhY2hlKG5hbWU6IGtleW9mIFN3ZWVwZXJEZWZpbml0aW9ucyk6IENvbGxlY3Rpb248c3RyaW5nLCBhbnk+IHwgbnVsbCB7XG4gICAgc3dpdGNoIChuYW1lKSB7XG4gICAgICBjYXNlICd1c2Vycyc6XG4gICAgICAgIHJldHVybiB0aGlzLmNsaWVudC51c2Vycz8uY2FjaGUgPz8gbnVsbDtcbiAgICAgIGNhc2UgJ2d1aWxkTWVtYmVycyc6XG4gICAgICAgIC8vIFN3ZWVwIGFjcm9zcyBhbGwgZ3VpbGRzXG4gICAgICAgIGxldCBtZW1iZXJDb3VudCA9IDA7XG4gICAgICAgIHRoaXMuY2xpZW50Lmd1aWxkcz8uY2FjaGUuZm9yRWFjaCgoZ3VpbGQ6IGFueSkgPT4ge1xuICAgICAgICAgIGlmIChndWlsZC5tZW1iZXJzPy5jYWNoZSkge1xuICAgICAgICAgICAgY29uc3QgZmlsdGVyID0gdGhpcy5vcHRpb25zLmd1aWxkTWVtYmVycz8uZmlsdGVyO1xuICAgICAgICAgICAgaWYgKGZpbHRlcikgbWVtYmVyQ291bnQgKz0gZ3VpbGQubWVtYmVycy5jYWNoZS5zd2VlcChmaWx0ZXIoKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIG51bGw7IC8vIEFscmVhZHkgaGFuZGxlZFxuICAgICAgY2FzZSAnbWVzc2FnZXMnOlxuICAgICAgICAvLyBTd2VlcCBhY3Jvc3MgYWxsIGNoYW5uZWxzXG4gICAgICAgIHRoaXMuY2xpZW50LmNoYW5uZWxzPy5jYWNoZS5mb3JFYWNoKChjaGFubmVsOiBhbnkpID0+IHtcbiAgICAgICAgICBpZiAoY2hhbm5lbC5tZXNzYWdlcz8uY2FjaGUpIHtcbiAgICAgICAgICAgIGNvbnN0IGZpbHRlciA9IHRoaXMub3B0aW9ucy5tZXNzYWdlcz8uZmlsdGVyO1xuICAgICAgICAgICAgaWYgKGZpbHRlcikgY2hhbm5lbC5tZXNzYWdlcy5jYWNoZS5zd2VlcChmaWx0ZXIoKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICBjYXNlICdwcmVzZW5jZXMnOlxuICAgICAgICAvLyBTd2VlcCBhY3Jvc3MgYWxsIGd1aWxkc1xuICAgICAgICB0aGlzLmNsaWVudC5ndWlsZHM/LmNhY2hlLmZvckVhY2goKGd1aWxkOiBhbnkpID0+IHtcbiAgICAgICAgICBpZiAoZ3VpbGQucHJlc2VuY2VzPy5jYWNoZSkge1xuICAgICAgICAgICAgY29uc3QgZmlsdGVyID0gdGhpcy5vcHRpb25zLnByZXNlbmNlcz8uZmlsdGVyO1xuICAgICAgICAgICAgaWYgKGZpbHRlcikgZ3VpbGQucHJlc2VuY2VzLmNhY2hlLnN3ZWVwKGZpbHRlcigpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIGNhc2UgJ3ZvaWNlU3RhdGVzJzpcbiAgICAgICAgdGhpcy5jbGllbnQuZ3VpbGRzPy5jYWNoZS5mb3JFYWNoKChndWlsZDogYW55KSA9PiB7XG4gICAgICAgICAgaWYgKGd1aWxkLnZvaWNlU3RhdGVzPy5jYWNoZSkge1xuICAgICAgICAgICAgY29uc3QgZmlsdGVyID0gdGhpcy5vcHRpb25zLnZvaWNlU3RhdGVzPy5maWx0ZXI7XG4gICAgICAgICAgICBpZiAoZmlsdGVyKSBndWlsZC52b2ljZVN0YXRlcy5jYWNoZS5zd2VlcChmaWx0ZXIoKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICBjYXNlICdyZWFjdGlvbnMnOlxuICAgICAgICAvLyBTd2VlcCByZWFjdGlvbnMgZnJvbSBhbGwgbWVzc2FnZXNcbiAgICAgICAgdGhpcy5jbGllbnQuY2hhbm5lbHM/LmNhY2hlLmZvckVhY2goKGNoYW5uZWw6IGFueSkgPT4ge1xuICAgICAgICAgIGNoYW5uZWwubWVzc2FnZXM/LmNhY2hlLmZvckVhY2goKG1lc3NhZ2U6IGFueSkgPT4ge1xuICAgICAgICAgICAgaWYgKG1lc3NhZ2UucmVhY3Rpb25zPy5jYWNoZSkge1xuICAgICAgICAgICAgICBjb25zdCBmaWx0ZXIgPSB0aGlzLm9wdGlvbnMucmVhY3Rpb25zPy5maWx0ZXI7XG4gICAgICAgICAgICAgIGlmIChmaWx0ZXIpIG1lc3NhZ2UucmVhY3Rpb25zLmNhY2hlLnN3ZWVwKGZpbHRlcigpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgY2FzZSAnZW1vamlzJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuY2xpZW50LmVtb2ppcz8uY2FjaGUgPz8gbnVsbDtcbiAgICAgIGNhc2UgJ3N0aWNrZXJzJzpcbiAgICAgICAgcmV0dXJuIHRoaXMuY2xpZW50LnN0aWNrZXJzPy5jYWNoZSA/PyBudWxsO1xuICAgICAgY2FzZSAnaW52aXRlcyc6XG4gICAgICAgIC8vIFN3ZWVwIGFjcm9zcyBhbGwgZ3VpbGRzXG4gICAgICAgIHRoaXMuY2xpZW50Lmd1aWxkcz8uY2FjaGUuZm9yRWFjaCgoZ3VpbGQ6IGFueSkgPT4ge1xuICAgICAgICAgIGlmIChndWlsZC5pbnZpdGVzPy5jYWNoZSkge1xuICAgICAgICAgICAgY29uc3QgZmlsdGVyID0gdGhpcy5vcHRpb25zLmludml0ZXM/LmZpbHRlcjtcbiAgICAgICAgICAgIGlmIChmaWx0ZXIpIGd1aWxkLmludml0ZXMuY2FjaGUuc3dlZXAoZmlsdGVyKCkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgY2FzZSAnYmFucyc6XG4gICAgICAgIHRoaXMuY2xpZW50Lmd1aWxkcz8uY2FjaGUuZm9yRWFjaCgoZ3VpbGQ6IGFueSkgPT4ge1xuICAgICAgICAgIGlmIChndWlsZC5iYW5zPy5jYWNoZSkge1xuICAgICAgICAgICAgY29uc3QgZmlsdGVyID0gdGhpcy5vcHRpb25zLmJhbnM/LmZpbHRlcjtcbiAgICAgICAgICAgIGlmIChmaWx0ZXIpIGd1aWxkLmJhbnMuY2FjaGUuc3dlZXAoZmlsdGVyKCkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEdldCBzd2VlcGVyIHN0YXRpc3RpY3NcbiAgICovXG4gIGdldFN0YXRzKCk6IFJlY29yZDxzdHJpbmcsIHsgaW50ZXJ2YWw6IG51bWJlcjsgcnVubmluZzogYm9vbGVhbiB9PiB7XG4gICAgY29uc3Qgc3RhdHM6IFJlY29yZDxzdHJpbmcsIHsgaW50ZXJ2YWw6IG51bWJlcjsgcnVubmluZzogYm9vbGVhbiB9PiA9IHt9O1xuICAgIFxuICAgIGZvciAoY29uc3QgW25hbWUsIGNvbmZpZ10gb2YgT2JqZWN0LmVudHJpZXModGhpcy5vcHRpb25zKSkge1xuICAgICAgaWYgKGNvbmZpZykge1xuICAgICAgICBzdGF0c1tuYW1lXSA9IHtcbiAgICAgICAgICBpbnRlcnZhbDogY29uZmlnLmludGVydmFsLFxuICAgICAgICAgIHJ1bm5pbmc6IHRoaXMuaW50ZXJ2YWxzLmhhcyhuYW1lKSxcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHN0YXRzO1xuICB9XG59XG5cbi8qKlxuICogRGVmYXVsdCBzd2VlcGVyIG9wdGlvbnMgZm9yIGNvbW1vbiB1c2UgY2FzZXNcbiAqL1xuZXhwb3J0IGNvbnN0IERlZmF1bHRTd2VlcGVyT3B0aW9uczogU3dlZXBlckRlZmluaXRpb25zID0ge1xuICBtZXNzYWdlczoge1xuICAgIGludGVydmFsOiAzNjAwLCAvLyAxIGhvdXJcbiAgICBmaWx0ZXI6IFN3ZWVwZXJzLmZpbHRlckJ5TGlmZXRpbWUoeyBsaWZldGltZTogMTgwMCB9KSwgLy8gMzAgbWludXRlc1xuICB9LFxuICBpbnZpdGVzOiB7XG4gICAgaW50ZXJ2YWw6IDM2MDAsXG4gICAgZmlsdGVyOiBTd2VlcGVycy5leHBpcmVkSW52aXRlU3dlZXBGaWx0ZXIoKSxcbiAgfSxcbn07XG5cbmV4cG9ydCBkZWZhdWx0IFN3ZWVwZXJNYW5hZ2VyO1xuIl19