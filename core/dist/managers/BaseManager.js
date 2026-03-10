"use strict";
/**
 * Base manager class for caching and managing structures
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataManager = exports.CachedManager = exports.BaseManager = void 0;
const Collection_1 = require("../utils/Collection");
/**
 * Base manager for caching structures
 */
class BaseManager {
    /** The client that instantiated this manager */
    client;
    /** The cache of items */
    cache;
    /** The class to instantiate for items */
    holds;
    constructor(client, holds, iterable) {
        this.client = client;
        this.holds = holds;
        this.cache = new Collection_1.Collection();
        if (iterable) {
            for (const item of iterable) {
                this._add(item);
            }
        }
    }
    /**
     * Resolve an item from the cache or ID
     */
    resolve(idOrInstance) {
        if (idOrInstance instanceof this.holds)
            return idOrInstance;
        if (typeof idOrInstance === 'string')
            return this.cache.get(idOrInstance) ?? null;
        return null;
    }
    /**
     * Resolve an ID from an item or ID
     */
    resolveId(idOrInstance) {
        if (idOrInstance instanceof this.holds)
            return idOrInstance.id;
        if (typeof idOrInstance === 'string')
            return idOrInstance;
        if (typeof idOrInstance === 'object' && idOrInstance !== null && 'id' in idOrInstance) {
            return idOrInstance.id;
        }
        return null;
    }
    /**
     * Get the cache as a JSON array
     */
    valueOf() {
        return [...this.cache.values()];
    }
}
exports.BaseManager = BaseManager;
/**
 * Caching manager that fetches data from the API
 */
class CachedManager extends BaseManager {
    /**
     * Fetch an item, using cache if available (async version)
     */
    async resolveAsync(idOrInstance, options) {
        const existing = super.resolve(idOrInstance);
        if (existing && !options?.force)
            return existing;
        const id = this.resolveId(idOrInstance);
        if (!id)
            return null;
        try {
            return await this.fetch(id, options);
        }
        catch {
            return null;
        }
    }
}
exports.CachedManager = CachedManager;
/**
 * Data manager that doesn't cache
 */
class DataManager extends BaseManager {
    /**
     * Add an item to the cache
     */
    _add(data, cache = true, options) {
        const existing = this.cache.get(options?.id ?? data.id);
        if (existing) {
            if (cache) {
                existing._patch?.(data);
            }
            return existing;
        }
        const entry = new this.holds(this.client, data, ...(options?.extras ?? []));
        if (cache) {
            this.cache.set(options?.id ?? data.id, entry);
        }
        return entry;
    }
}
exports.DataManager = DataManager;
exports.default = BaseManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQmFzZU1hbmFnZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvbWFuYWdlcnMvQmFzZU1hbmFnZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOztHQUVHOzs7QUFFSCxvREFBaUQ7QUFFakQ7O0dBRUc7QUFDSCxNQUFzQixXQUFXO0lBQy9CLGdEQUFnRDtJQUNoQyxNQUFNLENBQU07SUFFNUIseUJBQXlCO0lBQ1QsS0FBSyxDQUFtQjtJQUV4Qyx5Q0FBeUM7SUFDdEIsS0FBSyxDQUE0QjtJQUVwRCxZQUFZLE1BQVcsRUFBRSxLQUFnQyxFQUFFLFFBQXNCO1FBQy9FLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1FBQ3JCLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO1FBQ25CLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSx1QkFBVSxFQUFRLENBQUM7UUFFcEMsSUFBSSxRQUFRLEVBQUUsQ0FBQztZQUNiLEtBQUssTUFBTSxJQUFJLElBQUksUUFBUSxFQUFFLENBQUM7Z0JBQzVCLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBVyxDQUFDLENBQUM7WUFDekIsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0lBT0Q7O09BRUc7SUFDSCxPQUFPLENBQUMsWUFBbUI7UUFDekIsSUFBSSxZQUFZLFlBQVksSUFBSSxDQUFDLEtBQUs7WUFBRSxPQUFPLFlBQVksQ0FBQztRQUM1RCxJQUFJLE9BQU8sWUFBWSxLQUFLLFFBQVE7WUFBRSxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLFlBQWlCLENBQUMsSUFBSSxJQUFJLENBQUM7UUFDdkYsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxTQUFTLENBQUMsWUFBK0I7UUFDdkMsSUFBSSxZQUFZLFlBQVksSUFBSSxDQUFDLEtBQUs7WUFBRSxPQUFRLFlBQW9CLENBQUMsRUFBRSxDQUFDO1FBQ3hFLElBQUksT0FBTyxZQUFZLEtBQUssUUFBUTtZQUFFLE9BQU8sWUFBaUIsQ0FBQztRQUMvRCxJQUFJLE9BQU8sWUFBWSxLQUFLLFFBQVEsSUFBSSxZQUFZLEtBQUssSUFBSSxJQUFJLElBQUksSUFBSSxZQUFZLEVBQUUsQ0FBQztZQUN0RixPQUFPLFlBQVksQ0FBQyxFQUFFLENBQUM7UUFDekIsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEOztPQUVHO0lBQ0gsT0FBTztRQUNMLE9BQU8sQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztJQUNsQyxDQUFDO0NBQ0Y7QUF0REQsa0NBc0RDO0FBRUQ7O0dBRUc7QUFDSCxNQUFzQixhQUEwQyxTQUFRLFdBQW9CO0lBTTFGOztPQUVHO0lBQ0gsS0FBSyxDQUFDLFlBQVksQ0FBQyxZQUFtQixFQUFFLE9BQThDO1FBQ3BGLE1BQU0sUUFBUSxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDN0MsSUFBSSxRQUFRLElBQUksQ0FBQyxPQUFPLEVBQUUsS0FBSztZQUFFLE9BQU8sUUFBUSxDQUFDO1FBRWpELE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDeEMsSUFBSSxDQUFDLEVBQUU7WUFBRSxPQUFPLElBQUksQ0FBQztRQUVyQixJQUFJLENBQUM7WUFDSCxPQUFPLE1BQU0sSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDdkMsQ0FBQztRQUFDLE1BQU0sQ0FBQztZQUNQLE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQztJQUNILENBQUM7Q0FDRjtBQXRCRCxzQ0FzQkM7QUFFRDs7R0FFRztBQUNILE1BQXNCLFdBQXdDLFNBQVEsV0FBb0I7SUFDeEY7O09BRUc7SUFDSCxJQUFJLENBQUMsSUFBUyxFQUFFLEtBQUssR0FBRyxJQUFJLEVBQUUsT0FBb0M7UUFDaEUsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLEVBQUUsSUFBSSxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDeEQsSUFBSSxRQUFRLEVBQUUsQ0FBQztZQUNiLElBQUksS0FBSyxFQUFFLENBQUM7Z0JBQ1QsUUFBZ0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNuQyxDQUFDO1lBQ0QsT0FBTyxRQUFRLENBQUM7UUFDbEIsQ0FBQztRQUVELE1BQU0sS0FBSyxHQUFHLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxHQUFHLENBQUMsT0FBTyxFQUFFLE1BQU0sSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQzVFLElBQUksS0FBSyxFQUFFLENBQUM7WUFDVixJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsRUFBRSxJQUFJLElBQUksQ0FBQyxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDaEQsQ0FBQztRQUNELE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztDQUNGO0FBbkJELGtDQW1CQztBQUVELGtCQUFlLFdBQVcsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQmFzZSBtYW5hZ2VyIGNsYXNzIGZvciBjYWNoaW5nIGFuZCBtYW5hZ2luZyBzdHJ1Y3R1cmVzXG4gKi9cblxuaW1wb3J0IHsgQ29sbGVjdGlvbiB9IGZyb20gJy4uL3V0aWxzL0NvbGxlY3Rpb24nO1xuXG4vKipcbiAqIEJhc2UgbWFuYWdlciBmb3IgY2FjaGluZyBzdHJ1Y3R1cmVzXG4gKi9cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBCYXNlTWFuYWdlcjxLIGV4dGVuZHMgc3RyaW5nLCBWLCBSID0gVj4ge1xuICAvKiogVGhlIGNsaWVudCB0aGF0IGluc3RhbnRpYXRlZCB0aGlzIG1hbmFnZXIgKi9cbiAgcHVibGljIHJlYWRvbmx5IGNsaWVudDogYW55O1xuICBcbiAgLyoqIFRoZSBjYWNoZSBvZiBpdGVtcyAqL1xuICBwdWJsaWMgcmVhZG9ubHkgY2FjaGU6IENvbGxlY3Rpb248SywgVj47XG4gIFxuICAvKiogVGhlIGNsYXNzIHRvIGluc3RhbnRpYXRlIGZvciBpdGVtcyAqL1xuICBwcm90ZWN0ZWQgcmVhZG9ubHkgaG9sZHM6IG5ldyAoLi4uYXJnczogYW55W10pID0+IFY7XG5cbiAgY29uc3RydWN0b3IoY2xpZW50OiBhbnksIGhvbGRzOiBuZXcgKC4uLmFyZ3M6IGFueVtdKSA9PiBWLCBpdGVyYWJsZT86IEl0ZXJhYmxlPFI+KSB7XG4gICAgdGhpcy5jbGllbnQgPSBjbGllbnQ7XG4gICAgdGhpcy5ob2xkcyA9IGhvbGRzO1xuICAgIHRoaXMuY2FjaGUgPSBuZXcgQ29sbGVjdGlvbjxLLCBWPigpO1xuICAgIFxuICAgIGlmIChpdGVyYWJsZSkge1xuICAgICAgZm9yIChjb25zdCBpdGVtIG9mIGl0ZXJhYmxlKSB7XG4gICAgICAgIHRoaXMuX2FkZChpdGVtIGFzIGFueSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEFkZCBhbiBpdGVtIHRvIHRoZSBjYWNoZVxuICAgKi9cbiAgYWJzdHJhY3QgX2FkZChkYXRhOiBhbnksIGNhY2hlPzogYm9vbGVhbiwgb3B0aW9ucz86IHsgaWQ/OiBLOyBleHRyYXM/OiBhbnlbXSB9KTogVjtcblxuICAvKipcbiAgICogUmVzb2x2ZSBhbiBpdGVtIGZyb20gdGhlIGNhY2hlIG9yIElEXG4gICAqL1xuICByZXNvbHZlKGlkT3JJbnN0YW5jZTogSyB8IFYpOiBWIHwgbnVsbCB7XG4gICAgaWYgKGlkT3JJbnN0YW5jZSBpbnN0YW5jZW9mIHRoaXMuaG9sZHMpIHJldHVybiBpZE9ySW5zdGFuY2U7XG4gICAgaWYgKHR5cGVvZiBpZE9ySW5zdGFuY2UgPT09ICdzdHJpbmcnKSByZXR1cm4gdGhpcy5jYWNoZS5nZXQoaWRPckluc3RhbmNlIGFzIEspID8/IG51bGw7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvKipcbiAgICogUmVzb2x2ZSBhbiBJRCBmcm9tIGFuIGl0ZW0gb3IgSURcbiAgICovXG4gIHJlc29sdmVJZChpZE9ySW5zdGFuY2U6IEsgfCBWIHwgeyBpZDogSyB9KTogSyB8IG51bGwge1xuICAgIGlmIChpZE9ySW5zdGFuY2UgaW5zdGFuY2VvZiB0aGlzLmhvbGRzKSByZXR1cm4gKGlkT3JJbnN0YW5jZSBhcyBhbnkpLmlkO1xuICAgIGlmICh0eXBlb2YgaWRPckluc3RhbmNlID09PSAnc3RyaW5nJykgcmV0dXJuIGlkT3JJbnN0YW5jZSBhcyBLO1xuICAgIGlmICh0eXBlb2YgaWRPckluc3RhbmNlID09PSAnb2JqZWN0JyAmJiBpZE9ySW5zdGFuY2UgIT09IG51bGwgJiYgJ2lkJyBpbiBpZE9ySW5zdGFuY2UpIHtcbiAgICAgIHJldHVybiBpZE9ySW5zdGFuY2UuaWQ7XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCB0aGUgY2FjaGUgYXMgYSBKU09OIGFycmF5XG4gICAqL1xuICB2YWx1ZU9mKCk6IFZbXSB7XG4gICAgcmV0dXJuIFsuLi50aGlzLmNhY2hlLnZhbHVlcygpXTtcbiAgfVxufVxuXG4vKipcbiAqIENhY2hpbmcgbWFuYWdlciB0aGF0IGZldGNoZXMgZGF0YSBmcm9tIHRoZSBBUElcbiAqL1xuZXhwb3J0IGFic3RyYWN0IGNsYXNzIENhY2hlZE1hbmFnZXI8SyBleHRlbmRzIHN0cmluZywgViwgUiA9IFY+IGV4dGVuZHMgQmFzZU1hbmFnZXI8SywgViwgUj4ge1xuICAvKipcbiAgICogRmV0Y2ggYW4gaXRlbSBmcm9tIHRoZSBBUElcbiAgICovXG4gIGFic3RyYWN0IGZldGNoKGlkOiBLLCBvcHRpb25zPzogeyBjYWNoZT86IGJvb2xlYW47IGZvcmNlPzogYm9vbGVhbiB9KTogUHJvbWlzZTxWPjtcblxuICAvKipcbiAgICogRmV0Y2ggYW4gaXRlbSwgdXNpbmcgY2FjaGUgaWYgYXZhaWxhYmxlIChhc3luYyB2ZXJzaW9uKVxuICAgKi9cbiAgYXN5bmMgcmVzb2x2ZUFzeW5jKGlkT3JJbnN0YW5jZTogSyB8IFYsIG9wdGlvbnM/OiB7IGNhY2hlPzogYm9vbGVhbjsgZm9yY2U/OiBib29sZWFuIH0pOiBQcm9taXNlPFYgfCBudWxsPiB7XG4gICAgY29uc3QgZXhpc3RpbmcgPSBzdXBlci5yZXNvbHZlKGlkT3JJbnN0YW5jZSk7XG4gICAgaWYgKGV4aXN0aW5nICYmICFvcHRpb25zPy5mb3JjZSkgcmV0dXJuIGV4aXN0aW5nO1xuICAgIFxuICAgIGNvbnN0IGlkID0gdGhpcy5yZXNvbHZlSWQoaWRPckluc3RhbmNlKTtcbiAgICBpZiAoIWlkKSByZXR1cm4gbnVsbDtcbiAgICBcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuZmV0Y2goaWQsIG9wdGlvbnMpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogRGF0YSBtYW5hZ2VyIHRoYXQgZG9lc24ndCBjYWNoZVxuICovXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgRGF0YU1hbmFnZXI8SyBleHRlbmRzIHN0cmluZywgViwgUiA9IFY+IGV4dGVuZHMgQmFzZU1hbmFnZXI8SywgViwgUj4ge1xuICAvKipcbiAgICogQWRkIGFuIGl0ZW0gdG8gdGhlIGNhY2hlXG4gICAqL1xuICBfYWRkKGRhdGE6IGFueSwgY2FjaGUgPSB0cnVlLCBvcHRpb25zPzogeyBpZD86IEs7IGV4dHJhcz86IGFueVtdIH0pOiBWIHtcbiAgICBjb25zdCBleGlzdGluZyA9IHRoaXMuY2FjaGUuZ2V0KG9wdGlvbnM/LmlkID8/IGRhdGEuaWQpO1xuICAgIGlmIChleGlzdGluZykge1xuICAgICAgaWYgKGNhY2hlKSB7XG4gICAgICAgIChleGlzdGluZyBhcyBhbnkpLl9wYXRjaD8uKGRhdGEpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGV4aXN0aW5nO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCBlbnRyeSA9IG5ldyB0aGlzLmhvbGRzKHRoaXMuY2xpZW50LCBkYXRhLCAuLi4ob3B0aW9ucz8uZXh0cmFzID8/IFtdKSk7XG4gICAgaWYgKGNhY2hlKSB7XG4gICAgICB0aGlzLmNhY2hlLnNldChvcHRpb25zPy5pZCA/PyBkYXRhLmlkLCBlbnRyeSk7XG4gICAgfVxuICAgIHJldHVybiBlbnRyeTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBCYXNlTWFuYWdlcjtcbiJdfQ==