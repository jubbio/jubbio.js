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
     * Filter that sweeps archived threads
     */
    archivedThreadSweepFilter(lifetime = 14400) {
        return () => {
            const now = Date.now();
            const cutoff = now - (lifetime * 1000);
            return (thread) => {
                if (!thread.archived)
                    return false;
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
            case 'threads':
                return this.client.channels?.cache.filter((c) => c.isThread?.()) ?? null;
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
    threads: {
        interval: 3600,
        filter: exports.Sweepers.archivedThreadSweepFilter(14400), // 4 hours
    },
    invites: {
        interval: 3600,
        filter: exports.Sweepers.expiredInviteSweepFilter(),
    },
};
exports.default = SweeperManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU3dlZXBlcnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdXRpbHMvU3dlZXBlcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOztHQUVHOzs7QUFnREg7O0dBRUc7QUFDVSxRQUFBLFFBQVEsR0FBRztJQUN0Qjs7T0FFRztJQUNILGdCQUFnQixDQUE0RCxVQUl4RSxFQUFFO1FBQ0osTUFBTSxRQUFRLEdBQUcsT0FBTyxDQUFDLFFBQVEsSUFBSSxLQUFLLENBQUMsQ0FBQyxrQkFBa0I7UUFDOUQsTUFBTSxZQUFZLEdBQUcsT0FBTyxDQUFDLHNCQUFzQjtZQUNqRCxDQUFDLENBQUMsQ0FBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsZ0JBQWdCLElBQUksQ0FBQyxDQUFDLFNBQVMsRUFBRSxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUNoRSxNQUFNLE9BQU8sR0FBRyxPQUFPLENBQUMsZ0JBQWdCLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUUxRCxPQUFPLEdBQUcsRUFBRTtZQUNWLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUN2QixNQUFNLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLENBQUM7WUFFdkMsT0FBTyxDQUFDLEtBQVEsRUFBRSxFQUFFO2dCQUNsQixJQUFJLE9BQU8sQ0FBQyxLQUFLLENBQUM7b0JBQUUsT0FBTyxLQUFLLENBQUM7Z0JBQ2pDLE1BQU0sU0FBUyxHQUFHLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDdEMsT0FBTyxTQUFTLEdBQUcsTUFBTSxDQUFDO1lBQzVCLENBQUMsQ0FBQztRQUNKLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRDs7T0FFRztJQUNILHlCQUF5QixDQUFDLFFBQVEsR0FBRyxLQUFLO1FBQ3hDLE9BQU8sR0FBRyxFQUFFO1lBQ1YsTUFBTSxHQUFHLEdB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QWE7S0FDckU7SUFDRCxPQUFPLEVBQUU7UUFDUCxRQUFRLEVBQUUsSUFBSTtRQUNkLE1BQU0sRUFBRSxnQkFBUSxDQUFDLHlCQUF5QixDQUFDLEtBQUssQ0FBQyxFQUFFLFVBQVU7S0FDOUQ7SUFDRCxPQUFPLEVBQUU7UUFDUCxRQUFRLEVBQUUsSUFBSTtRQUNkLE1BQU0sRUFBRSxnQkFBUSxDQUFDLHdCQUF3QixFQUFFO0tBQzVDO0NBQ0YsQ0FBQztBQUVGLGtCQUFlLGNBQWMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBTd2VlcGVycyAtIEF1dG9tYXRpYyBjYWNoZSBjbGVhbnVwIHV0aWxpdGllc1xyXG4gKi9cclxuXHJcbmltcG9ydCB7IENvbGxlY3Rpb24gfSBmcm9tICcuL0NvbGxlY3Rpb24nO1xyXG5cclxuLyoqXHJcbiAqIFN3ZWVwZXIgb3B0aW9ucyBmb3IgYSBzcGVjaWZpYyBjYWNoZVxyXG4gKi9cclxuZXhwb3J0IGludGVyZmFjZSBTd2VlcGVyT3B0aW9ucyB7XHJcbiAgLyoqIEludGVydmFsIGluIHNlY29uZHMgYmV0d2VlbiBzd2VlcHMgKi9cclxuICBpbnRlcnZhbDogbnVtYmVyO1xyXG4gIC8qKiBGaWx0ZXIgZnVuY3Rpb24gdG8gZGV0ZXJtaW5lIHdoYXQgdG8gc3dlZXAgKi9cclxuICBmaWx0ZXI6ICgpID0+ICh2YWx1ZTogYW55LCBrZXk6IHN0cmluZywgY29sbGVjdGlvbjogQ29sbGVjdGlvbjxzdHJpbmcsIGFueT4pID0+IGJvb2xlYW47XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBHbG9iYWwgc3dlZXBlciBjb25maWd1cmF0aW9uXHJcbiAqL1xyXG5leHBvcnQgaW50ZXJmYWNlIFN3ZWVwZXJEZWZpbml0aW9ucyB7XHJcbiAgLyoqIFN3ZWVwIGFwcGxpY2F0aW9uIGNvbW1hbmRzICovXHJcbiAgYXBwbGljYXRpb25Db21tYW5kcz86IFN3ZWVwZXJPcHRpb25zO1xyXG4gIC8qKiBTd2VlcCBiYW5zICovXHJcbiAgYmFucz86IFN3ZWVwZXJPcHRpb25zO1xyXG4gIC8qKiBTd2VlcCBlbW9qaXMgKi9cclxuICBlbW9qaXM/OiBTd2VlcGVyT3B0aW9ucztcclxuICAvKiogU3dlZXAgaW52aXRlcyAqL1xyXG4gIGludml0ZXM/OiBTd2VlcGVyT3B0aW9ucztcclxuICAvKiogU3dlZXAgZ3VpbGQgbWVtYmVycyAqL1xyXG4gIGd1aWxkTWVtYmVycz86IFN3ZWVwZXJPcHRpb25zO1xyXG4gIC8qKiBTd2VlcCBtZXNzYWdlcyAqL1xyXG4gIG1lc3NhZ2VzPzogU3dlZXBlck9wdGlvbnM7XHJcbiAgLyoqIFN3ZWVwIHByZXNlbmNlcyAqL1xyXG4gIHByZXNlbmNlcz86IFN3ZWVwZXJPcHRpb25zO1xyXG4gIC8qKiBTd2VlcCByZWFjdGlvbnMgKi9cclxuICByZWFjdGlvbnM/OiBTd2VlcGVyT3B0aW9ucztcclxuICAvKiogU3dlZXAgc3RhZ2UgaW5zdGFuY2VzICovXHJcbiAgc3RhZ2VJbnN0YW5jZXM/OiBTd2VlcGVyT3B0aW9ucztcclxuICAvKiogU3dlZXAgc3RpY2tlcnMgKi9cclxuICBzdGlja2Vycz86IFN3ZWVwZXJPcHRpb25zO1xyXG4gIC8qKiBTd2VlcCB0aHJlYWQgbWVtYmVycyAqL1xyXG4gIHRocmVhZE1lbWJlcnM/OiBTd2VlcGVyT3B0aW9ucztcclxuICAvKiogU3dlZXAgdGhyZWFkcyAqL1xyXG4gIHRocmVhZHM/OiBTd2VlcGVyT3B0aW9ucztcclxuICAvKiogU3dlZXAgdXNlcnMgKi9cclxuICB1c2Vycz86IFN3ZWVwZXJPcHRpb25zO1xyXG4gIC8qKiBTd2VlcCB2b2ljZSBzdGF0ZXMgKi9cclxuICB2b2ljZVN0YXRlcz86IFN3ZWVwZXJPcHRpb25zO1xyXG59XHJcblxyXG4vKipcclxuICogU3dlZXBlciBmaWx0ZXJzIC0gcHJlZGVmaW5lZCBmaWx0ZXIgZnVuY3Rpb25zXHJcbiAqL1xyXG5leHBvcnQgY29uc3QgU3dlZXBlcnMgPSB7XHJcbiAgLyoqXHJcbiAgICogRmlsdGVyIHRoYXQgc3dlZXBzIGl0ZW1zIG9sZGVyIHRoYW4gYSBjZXJ0YWluIGxpZmV0aW1lXHJcbiAgICovXHJcbiAgZmlsdGVyQnlMaWZldGltZTxUIGV4dGVuZHMgeyBjcmVhdGVkVGltZXN0YW1wPzogbnVtYmVyOyBjcmVhdGVkQXQ/OiBEYXRlIH0+KG9wdGlvbnM6IHtcclxuICAgIGxpZmV0aW1lPzogbnVtYmVyO1xyXG4gICAgZ2V0Q29tcGFyaXNvblRpbWVzdGFtcD86ICh2YWx1ZTogVCkgPT4gbnVtYmVyO1xyXG4gICAgZXhjbHVkZUZyb21Td2VlcD86ICh2YWx1ZTogVCkgPT4gYm9vbGVhbjtcclxuICB9ID0ge30pIHtcclxuICAgIGNvbnN0IGxpZmV0aW1lID0gb3B0aW9ucy5saWZldGltZSA/PyAxNDQwMDsgLy8gNCBob3VycyBkZWZhdWx0XHJcbiAgICBjb25zdCBnZXRUaW1lc3RhbXAgPSBvcHRpb25zLmdldENvbXBhcmlzb25UaW1lc3RhbXAgPz8gXHJcbiAgICAgICgodjogVCkgPT4gdi5jcmVhdGVkVGltZXN0YW1wID8/IHYuY3JlYXRlZEF0Py5nZXRUaW1lKCkgPz8gMCk7XHJcbiAgICBjb25zdCBleGNsdWRlID0gb3B0aW9ucy5leGNsdWRlRnJvbVN3ZWVwID8/ICgoKSA9PiBmYWxzZSk7XHJcbiAgICBcclxuICAgIHJldHVybiAoKSA9PiB7XHJcbiAgICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XHJcbiAgICAgIGNvbnN0IGN1dG9mZiA9IG5vdyAtIChsaWZldGltZSAqIDEwMDApO1xyXG4gICAgICBcclxuICAgICAgcmV0dXJuICh2YWx1ZTogVCkgPT4ge1xyXG4gICAgICAgIGlmIChleGNsdWRlKHZhbHVlKSkgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIGNvbnN0IHRpbWVzdGFtcCA9IGdldFRpbWVzdGFtcCh2YWx1ZSk7XHJcbiAgICAgICAgcmV0dXJuIHRpbWVzdGFtcCA8IGN1dG9mZjtcclxuICAgICAgfTtcclxuICAgIH07XHJcbiAgfSxcclxuXHJcbiAgLyoqXHJcbiAgICogRmlsdGVyIHRoYXQgc3dlZXBzIGFyY2hpdmVkIHRocmVhZHNcclxuICAgKi9cclxuICBhcmNoaXZlZFRocmVhZFN3ZWVwRmlsdGVyKGxpZmV0aW1lID0gMTQ0MDApIHtcclxuICAgIHJldHVybiAoKSA9PiB7XHJcbiAgICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XHJcbiAgICAgIGNvbnN0IGN1dG9mZiA9IG5vdyAtIChsaWZldGltZSAqIDEwMDApO1xyXG4gICAgICBcclxuICAgICAgcmV0dXJuICh0aHJlYWQ6IGFueSkgPT4ge1xyXG4gICAgICAgIGlmICghdGhyZWFkLmFyY2hpdmVkKSByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgY29uc3QgYXJjaGl2ZWRBdCA9IHRocmVhZC5hcmNoaXZlZEF0Py5nZXRUaW1lKCkgPz8gdGhyZWFkLmFyY2hpdmVUaW1lc3RhbXAgPz8gMDtcclxuICAgICAgICByZXR1cm4gYXJjaGl2ZWRBdCA8IGN1dG9mZjtcclxuICAgICAgfTtcclxuICAgIH07XHJcbiAgfSxcclxuXHJcbiAgLyoqXHJcbiAgICogRmlsdGVyIHRoYXQgc3dlZXBzIGV4cGlyZWQgaW52aXRlc1xyXG4gICAqL1xyXG4gIGV4cGlyZWRJbnZpdGVTd2VlcEZpbHRlcigpIHtcclxuICAgIHJldHVybiAoKSA9PiB7XHJcbiAgICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XHJcbiAgICAgIHJldHVybiAoaW52aXRlOiBhbnkpID0+IHtcclxuICAgICAgICBpZiAoIWludml0ZS5leHBpcmVzQXQgJiYgIWludml0ZS5leHBpcmVzVGltZXN0YW1wKSByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgY29uc3QgZXhwaXJlc0F0ID0gaW52aXRlLmV4cGlyZXNBdD8uZ2V0VGltZSgpID8/IGludml0ZS5leHBpcmVzVGltZXN0YW1wID8/IEluZmluaXR5O1xyXG4gICAgICAgIHJldHVybiBleHBpcmVzQXQgPCBub3c7XHJcbiAgICAgIH07XHJcbiAgICB9O1xyXG4gIH0sXHJcblxyXG4gIC8qKlxyXG4gICAqIEZpbHRlciB0aGF0IHN3ZWVwcyBvdXRkYXRlZCBwcmVzZW5jZXNcclxuICAgKi9cclxuICBvdXRkYXRlZFByZXNlbmNlU3dlZXBGaWx0ZXIobGlmZXRpbWUgPSAyMTYwMCkge1xyXG4gICAgcmV0dXJuICgpID0+IHtcclxuICAgICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcclxuICAgICAgY29uc3QgY3V0b2ZmID0gbm93IC0gKGxpZmV0aW1lICogMTAwMCk7XHJcbiAgICAgIFxyXG4gICAgICByZXR1cm4gKHByZXNlbmNlOiBhbnkpID0+IHtcclxuICAgICAgICBjb25zdCBsYXN0VXBkYXRlID0gcHJlc2VuY2UubGFzdE1vZGlmaWVkID8/IHByZXNlbmNlLnVwZGF0ZWRBdD8uZ2V0VGltZSgpID8/IDA7XHJcbiAgICAgICAgcmV0dXJuIGxhc3RVcGRhdGUgPCBjdXRvZmY7XHJcbiAgICAgIH07XHJcbiAgICB9O1xyXG4gIH0sXHJcblxyXG4gIC8qKlxyXG4gICAqIEZpbHRlciB0aGF0IHN3ZWVwcyBhbGwgaXRlbXMgKHVzZSB3aXRoIGNhdXRpb24pXHJcbiAgICovXHJcbiAgc3dlZXBBbGwoKSB7XHJcbiAgICByZXR1cm4gKCkgPT4gKCkgPT4gdHJ1ZTtcclxuICB9LFxyXG5cclxuICAvKipcclxuICAgKiBGaWx0ZXIgdGhhdCBzd2VlcHMgbm90aGluZ1xyXG4gICAqL1xyXG4gIHN3ZWVwTm9uZSgpIHtcclxuICAgIHJldHVybiAoKSA9PiAoKSA9PiBmYWxzZTtcclxuICB9LFxyXG59O1xyXG5cclxuLyoqXHJcbiAqIFN3ZWVwZXIgbWFuYWdlciBjbGFzc1xyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFN3ZWVwZXJNYW5hZ2VyIHtcclxuICBwcml2YXRlIGNsaWVudDogYW55O1xyXG4gIHByaXZhdGUgaW50ZXJ2YWxzOiBNYXA8c3RyaW5nLCBOb2RlSlMuVGltZW91dD4gPSBuZXcgTWFwKCk7XHJcbiAgcHJpdmF0ZSBvcHRpb25zOiBTd2VlcGVyRGVmaW5pdGlvbnM7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGNsaWVudDogYW55LCBvcHRpb25zOiBTd2VlcGVyRGVmaW5pdGlvbnMgPSB7fSkge1xyXG4gICAgdGhpcy5jbGllbnQgPSBjbGllbnQ7XHJcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU3RhcnQgYWxsIGNvbmZpZ3VyZWQgc3dlZXBlcnNcclxuICAgKi9cclxuICBzdGFydCgpOiB2b2lkIHtcclxuICAgIGZvciAoY29uc3QgW2tleSwgY29uZmlnXSBvZiBPYmplY3QuZW50cmllcyh0aGlzLm9wdGlvbnMpKSB7XHJcbiAgICAgIGlmIChjb25maWcgJiYgY29uZmlnLmludGVydmFsID4gMCkge1xyXG4gICAgICAgIHRoaXMuc3RhcnRTd2VlcGVyKGtleSBhcyBrZXlvZiBTd2VlcGVyRGVmaW5pdGlvbnMsIGNvbmZpZyk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFN0YXJ0IGEgc3BlY2lmaWMgc3dlZXBlclxyXG4gICAqL1xyXG4gIHByaXZhdGUgc3RhcnRTd2VlcGVyKG5hbWU6IGtleW9mIFN3ZWVwZXJEZWZpbml0aW9ucywgY29uZmlnOiBTd2VlcGVyT3B0aW9ucyk6IHZvaWQge1xyXG4gICAgLy8gQ2xlYXIgZXhpc3RpbmcgaW50ZXJ2YWwgaWYgYW55XHJcbiAgICB0aGlzLnN0b3BTd2VlcGVyKG5hbWUpO1xyXG4gICAgXHJcbiAgICBjb25zdCBpbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHtcclxuICAgICAgdGhpcy5zd2VlcChuYW1lLCBjb25maWcuZmlsdGVyKTtcclxuICAgIH0sIGNvbmZpZy5pbnRlcnZhbCAqIDEwMDApO1xyXG4gICAgXHJcbiAgICB0aGlzLmludGVydmFscy5zZXQobmFtZSwgaW50ZXJ2YWwpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU3RvcCBhIHNwZWNpZmljIHN3ZWVwZXJcclxuICAgKi9cclxuICBzdG9wU3dlZXBlcihuYW1lOiBrZXlvZiBTd2VlcGVyRGVmaW5pdGlvbnMpOiB2b2lkIHtcclxuICAgIGNvbnN0IGludGVydmFsID0gdGhpcy5pbnRlcnZhbHMuZ2V0KG5hbWUpO1xyXG4gICAgaWYgKGludGVydmFsKSB7XHJcbiAgICAgIGNsZWFySW50ZXJ2YWwoaW50ZXJ2YWwpO1xyXG4gICAgICB0aGlzLmludGVydmFscy5kZWxldGUobmFtZSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTdG9wIGFsbCBzd2VlcGVyc1xyXG4gICAqL1xyXG4gIHN0b3AoKTogdm9pZCB7XHJcbiAgICBmb3IgKGNvbnN0IG5hbWUgb2YgdGhpcy5pbnRlcnZhbHMua2V5cygpKSB7XHJcbiAgICAgIHRoaXMuc3RvcFN3ZWVwZXIobmFtZSBhcyBrZXlvZiBTd2VlcGVyRGVmaW5pdGlvbnMpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogTWFudWFsbHkgdHJpZ2dlciBhIHN3ZWVwXHJcbiAgICovXHJcbiAgc3dlZXAobmFtZToga2V5b2YgU3dlZXBlckRlZmluaXRpb25zLCBmaWx0ZXI/OiAoKSA9PiAodmFsdWU6IGFueSwga2V5OiBzdHJpbmcsIGNvbGxlY3Rpb246IENvbGxlY3Rpb248c3RyaW5nLCBhbnk+KSA9PiBib29sZWFuKTogbnVtYmVyIHtcclxuICAgIGNvbnN0IGNhY2hlID0gdGhpcy5nZXRDYWNoZShuYW1lKTtcclxuICAgIGlmICghY2FjaGUpIHJldHVybiAwO1xyXG4gICAgXHJcbiAgICBjb25zdCBmaWx0ZXJGbiA9IGZpbHRlciA/PyB0aGlzLm9wdGlvbnNbbmFtZV0/LmZpbHRlcjtcclxuICAgIGlmICghZmlsdGVyRm4pIHJldHVybiAwO1xyXG4gICAgXHJcbiAgICByZXR1cm4gY2FjaGUuc3dlZXAoZmlsdGVyRm4oKSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgdGhlIGNhY2hlIGZvciBhIHN3ZWVwZXIgdHlwZVxyXG4gICAqL1xyXG4gIHByaXZhdGUgZ2V0Q2FjaGUobmFtZToga2V5b2YgU3dlZXBlckRlZmluaXRpb25zKTogQ29sbGVjdGlvbjxzdHJpbmcsIGFueT4gfCBudWxsIHtcclxuICAgIHN3aXRjaCAobmFtZSkge1xyXG4gICAgICBjYXNlICd1c2Vycyc6XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuY2xpZW50LnVzZXJzPy5jYWNoZSA/PyBudWxsO1xyXG4gICAgICBjYXNlICdndWlsZE1lbWJlcnMnOlxyXG4gICAgICAgIC8vIFN3ZWVwIGFjcm9zcyBhbGwgZ3VpbGRzXHJcbiAgICAgICAgbGV0IG1lbWJlckNvdW50ID0gMDtcclxuICAgICAgICB0aGlzLmNsaWVudC5ndWlsZHM/LmNhY2hlLmZvckVhY2goKGd1aWxkOiBhbnkpID0+IHtcclxuICAgICAgICAgIGlmIChndWlsZC5tZW1iZXJzPy5jYWNoZSkge1xyXG4gICAgICAgICAgICBjb25zdCBmaWx0ZXIgPSB0aGlzLm9wdGlvbnMuZ3VpbGRNZW1iZXJzPy5maWx0ZXI7XHJcbiAgICAgICAgICAgIGlmIChmaWx0ZXIpIG1lbWJlckNvdW50ICs9IGd1aWxkLm1lbWJlcnMuY2FjaGUuc3dlZXAoZmlsdGVyKCkpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHJldHVybiBudWxsOyAvLyBBbHJlYWR5IGhhbmRsZWRcclxuICAgICAgY2FzZSAnbWVzc2FnZXMnOlxyXG4gICAgICAgIC8vIFN3ZWVwIGFjcm9zcyBhbGwgY2hhbm5lbHNcclxuICAgICAgICB0aGlzLmNsaWVudC5jaGFubmVscz8uY2FjaGUuZm9yRWFjaCgoY2hhbm5lbDogYW55KSA9PiB7XHJcbiAgICAgICAgICBpZiAoY2hhbm5lbC5tZXNzYWdlcz8uY2FjaGUpIHtcclxuICAgICAgICAgICAgY29uc3QgZmlsdGVyID0gdGhpcy5vcHRpb25zLm1lc3NhZ2VzPy5maWx0ZXI7XHJcbiAgICAgICAgICAgIGlmIChmaWx0ZXIpIGNoYW5uZWwubWVzc2FnZXMuY2FjaGUuc3dlZXAoZmlsdGVyKCkpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICBjYXNlICd0aHJlYWRzJzpcclxuICAgICAgICByZXR1cm4gdGhpcy5jbGllbnQuY2hhbm5lbHM/LmNhY2hlLmZpbHRlcigoYzogYW55KSA9PiBjLmlzVGhyZWFkPy4oKSkgPz8gbnVsbDtcclxuICAgICAgY2FzZSAncHJlc2VuY2VzJzpcclxuICAgICAgICAvLyBTd2VlcCBhY3Jvc3MgYWxsIGd1aWxkc1xyXG4gICAgICAgIHRoaXMuY2xpZW50Lmd1aWxkcz8uY2FjaGUuZm9yRWFjaCgoZ3VpbGQ6IGFueSkgPT4ge1xyXG4gICAgICAgICAgaWYgKGd1aWxkLnByZXNlbmNlcz8uY2FjaGUpIHtcclxuICAgICAgICAgICAgY29uc3QgZmlsdGVyID0gdGhpcy5vcHRpb25zLnByZXNlbmNlcz8uZmlsdGVyO1xyXG4gICAgICAgICAgICBpZiAoZmlsdGVyKSBndWlsZC5wcmVzZW5jZXMuY2FjaGUuc3dlZXAoZmlsdGVyKCkpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICBjYXNlICd2b2ljZVN0YXRlcyc6XHJcbiAgICAgICAgdGhpcy5jbGllbnQuZ3VpbGRzPy5jYWNoZS5mb3JFYWNoKChndWlsZDogYW55KSA9PiB7XHJcbiAgICAgICAgICBpZiAoZ3VpbGQudm9pY2VTdGF0ZXM/LmNhY2hlKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGZpbHRlciA9IHRoaXMub3B0aW9ucy52b2ljZVN0YXRlcz8uZmlsdGVyO1xyXG4gICAgICAgICAgICBpZiAoZmlsdGVyKSBndWlsZC52b2ljZVN0YXRlcy5jYWNoZS5zd2VlcChmaWx0ZXIoKSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgIGNhc2UgJ3JlYWN0aW9ucyc6XHJcbiAgICAgICAgLy8gU3dlZXAgcmVhY3Rpb25zIGZyb20gYWxsIG1lc3NhZ2VzXHJcbiAgICAgICAgdGhpcy5jbGllbnQuY2hhbm5lbHM/LmNhY2hlLmZvckVhY2goKGNoYW5uZWw6IGFueSkgPT4ge1xyXG4gICAgICAgICAgY2hhbm5lbC5tZXNzYWdlcz8uY2FjaGUuZm9yRWFjaCgobWVzc2FnZTogYW55KSA9PiB7XHJcbiAgICAgICAgICAgIGlmIChtZXNzYWdlLnJlYWN0aW9ucz8uY2FjaGUpIHtcclxuICAgICAgICAgICAgICBjb25zdCBmaWx0ZXIgPSB0aGlzLm9wdGlvbnMucmVhY3Rpb25zPy5maWx0ZXI7XHJcbiAgICAgICAgICAgICAgaWYgKGZpbHRlcikgbWVzc2FnZS5yZWFjdGlvbnMuY2FjaGUuc3dlZXAoZmlsdGVyKCkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgY2FzZSAnZW1vamlzJzpcclxuICAgICAgICByZXR1cm4gdGhpcy5jbGllbnQuZW1vamlzPy5jYWNoZSA/PyBudWxsO1xyXG4gICAgICBjYXNlICdzdGlja2Vycyc6XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuY2xpZW50LnN0aWNrZXJzPy5jYWNoZSA/PyBudWxsO1xyXG4gICAgICBjYXNlICdpbnZpdGVzJzpcclxuICAgICAgICAvLyBTd2VlcCBhY3Jvc3MgYWxsIGd1aWxkc1xyXG4gICAgICAgIHRoaXMuY2xpZW50Lmd1aWxkcz8uY2FjaGUuZm9yRWFjaCgoZ3VpbGQ6IGFueSkgPT4ge1xyXG4gICAgICAgICAgaWYgKGd1aWxkLmludml0ZXM/LmNhY2hlKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGZpbHRlciA9IHRoaXMub3B0aW9ucy5pbnZpdGVzPy5maWx0ZXI7XHJcbiAgICAgICAgICAgIGlmIChmaWx0ZXIpIGd1aWxkLmludml0ZXMuY2FjaGUuc3dlZXAoZmlsdGVyKCkpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICBjYXNlICdiYW5zJzpcclxuICAgICAgICB0aGlzLmNsaWVudC5ndWlsZHM/LmNhY2hlLmZvckVhY2goKGd1aWxkOiBhbnkpID0+IHtcclxuICAgICAgICAgIGlmIChndWlsZC5iYW5zPy5jYWNoZSkge1xyXG4gICAgICAgICAgICBjb25zdCBmaWx0ZXIgPSB0aGlzLm9wdGlvbnMuYmFucz8uZmlsdGVyO1xyXG4gICAgICAgICAgICBpZiAoZmlsdGVyKSBndWlsZC5iYW5zLmNhY2hlLnN3ZWVwKGZpbHRlcigpKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgZGVmYXVsdDpcclxuICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBzd2VlcGVyIHN0YXRpc3RpY3NcclxuICAgKi9cclxuICBnZXRTdGF0cygpOiBSZWNvcmQ8c3RyaW5nLCB7IGludGVydmFsOiBudW1iZXI7IHJ1bm5pbmc6IGJvb2xlYW4gfT4ge1xyXG4gICAgY29uc3Qgc3RhdHM6IFJlY29yZDxzdHJpbmcsIHsgaW50ZXJ2YWw6IG51bWJlcjsgcnVubmluZzogYm9vbGVhbiB9PiA9IHt9O1xyXG4gICAgXHJcbiAgICBmb3IgKGNvbnN0IFtuYW1lLCBjb25maWddIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMub3B0aW9ucykpIHtcclxuICAgICAgaWYgKGNvbmZpZykge1xyXG4gICAgICAgIHN0YXRzW25hbWVdID0ge1xyXG4gICAgICAgICAgaW50ZXJ2YWw6IGNvbmZpZy5pbnRlcnZhbCxcclxuICAgICAgICAgIHJ1bm5pbmc6IHRoaXMuaW50ZXJ2YWxzLmhhcyhuYW1lKSxcclxuICAgICAgICB9O1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHJldHVybiBzdGF0cztcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBEZWZhdWx0IHN3ZWVwZXIgb3B0aW9ucyBmb3IgY29tbW9uIHVzZSBjYXNlc1xyXG4gKi9cclxuZXhwb3J0IGNvbnN0IERlZmF1bHRTd2VlcGVyT3B0aW9uczogU3dlZXBlckRlZmluaXRpb25zID0ge1xyXG4gIG1lc3NhZ2VzOiB7XHJcbiAgICBpbnRlcnZhbDogMzYwMCwgLy8gMSBob3VyXHJcbiAgICBmaWx0ZXI6IFN3ZWVwZXJzLmZpbHRlckJ5TGlmZXRpbWUoeyBsaWZldGltZTogMTgwMCB9KSwgLy8gMzAgbWludXRlc1xyXG4gIH0sXHJcbiAgdGhyZWFkczoge1xyXG4gICAgaW50ZXJ2YWw6IDM2MDAsXHJcbiAgICBmaWx0ZXI6IFN3ZWVwZXJzLmFyY2hpdmVkVGhyZWFkU3dlZXBGaWx0ZXIoMTQ0MDApLCAvLyA0IGhvdXJzXHJcbiAgfSxcclxuICBpbnZpdGVzOiB7XHJcbiAgICBpbnRlcnZhbDogMzYwMCxcclxuICAgIGZpbHRlcjogU3dlZXBlcnMuZXhwaXJlZEludml0ZVN3ZWVwRmlsdGVyKCksXHJcbiAgfSxcclxufTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IFN3ZWVwZXJNYW5hZ2VyO1xyXG4iXX0=