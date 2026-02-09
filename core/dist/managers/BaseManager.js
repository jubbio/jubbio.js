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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQmFzZU1hbmFnZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvbWFuYWdlcnMvQmFzZU1hbmFnZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOztHQUVHOzs7QUFFSCxvREFBaUQ7QUFFakQ7O0dBRUc7QUFDSCxNQUFzQixXQUFXO0lBQy9CLGdEQUFnRDtJQUNoQyxNQUFNLENBQU07SUFFNUIseUJBQXlCO0lBQ1QsS0FBSyxDQUFtQjtJQUV4Qyx5Q0FBeUM7SUFDdEIsS0FBSyxDQUE0QjtJQUVwRCxZQUFZLE1BQVcsRUFBRSxLQUFnQyxFQUFFLFFBQXNCO1FBQy9FLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1FBQ3JCLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO1FBQ25CLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSx1QkFBVSxFQUFRLENBQUM7UUFFcEMsSUFBSSxRQUFRLEVBQUUsQ0FBQztZQUNiLEtBQUssTUFBTSxJQUFJLElBQUksUUFBUSxFQUFFLENBQUM7Z0JBQzVCLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBVyxDQUFDLENBQUM7WUFDekIsQ0FBQztRQUNILENBQUM7SUFDSCxDQUFDO0lBT0Q7O09BRUc7SUFDSCxPQUFPLENBQUMsWUFBbUI7UUFDekIsSUFBSSxZQUFZLFlBQVksSUFBSSxDQUFDLEtBQUs7WUFBRSxPQUFPLFlBQVksQ0FBQztRQUM1RCxJQUFJLE9BQU8sWUFBWSxLQUFLLFFBQVE7WUFBRSxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLFlBQWlCLENBQUMsSUFBSSxJQUFJLENBQUM7UUFDdkYsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxTQUFTLENBQUMsWUFBK0I7UUFDdkMsSUFBSSxZQUFZLFlBQVksSUFBSSxDQUFDLEtBQUs7WUFBRSxPQUFRLFlBQW9CLENBQUMsRUFBRSxDQUFDO1FBQ3hFLElBQUksT0FBTyxZQUFZLEtBQUssUUFBUTtZQUFFLE9BQU8sWUFBaUIsQ0FBQztRQUMvRCxJQUFJLE9BQU8sWUFBWSxLQUFLLFFBQVEsSUFBSSxZQUFZLEtBQUssSUFBSSxJQUFJLElBQUksSUFBSSxZQUFZLEVBQUUsQ0FBQztZQUN0RixPQUFPLFlBQVksQ0FBQyxFQUFFLENBQUM7UUFDekIsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEOztPQUVHO0lBQ0gsT0FBTztRQUNMLE9BQU8sQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztJQUNsQyxDQUFDO0NBQ0Y7QUF0REQsa0NBc0RDO0FBRUQ7O0dBRUc7QUFDSCxNQUFzQixhQUEwQyxTQUFRLFdBQW9CO0lBTTFGOztPQUVHO0lBQ0gsS0FBSyxDQUFDLFlBQVksQ0FBQyxZQUFtQixFQUFFLE9BQThDO1FBQ3BGLE1BQU0sUUFBUSxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDN0MsSUFBSSxRQUFRLElBQUksQ0FBQyxPQUFPLEVBQUUsS0FBSztZQUFFLE9BQU8sUUFBUSxDQUFDO1FBRWpELE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDeEMsSUFBSSxDQUFDLEVBQUU7WUFBRSxPQUFPLElBQUksQ0FBQztRQUVyQixJQUFJLENBQUM7WUFDSCxPQUFPLE1BQU0sSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDdkMsQ0FBQztRQUFDLE1BQU0sQ0FBQztZQUNQLE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQztJQUNILENBQUM7Q0FDRjtBQXRCRCxzQ0FzQkM7QUFFRDs7R0FFRztBQUNILE1BQXNCLFdBQXdDLFNBQVEsV0FBb0I7SUFDeEY7O09BRUc7SUFDSCxJQUFJLENBQUMsSUFBUyxFQUFFLEtBQUssR0FBRyxJQUFJLEVBQUUsT0FBb0M7UUFDaEUsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLEVBQUUsSUFBSSxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDeEQsSUFBSSxRQUFRLEVBQUUsQ0FBQztZQUNiLElBQUksS0FBSyxFQUFFLENBQUM7Z0JBQ1QsUUFBZ0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNuQyxDQUFDO1lBQ0QsT0FBTyxRQUFRLENBQUM7UUFDbEIsQ0FBQztRQUVELE1BQU0sS0FBSyxHQUFHLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxHQUFHLENBQUMsT0FBTyxFQUFFLE1BQU0sSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQzVFLElBQUksS0FBSyxFQUFFLENBQUM7WUFDVixJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsRUFBRSxJQUFJLElBQUksQ0FBQyxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDaEQsQ0FBQztRQUNELE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztDQUNGO0FBbkJELGtDQW1CQztBQUVELGtCQUFlLFdBQVcsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBCYXNlIG1hbmFnZXIgY2xhc3MgZm9yIGNhY2hpbmcgYW5kIG1hbmFnaW5nIHN0cnVjdHVyZXNcclxuICovXHJcblxyXG5pbXBvcnQgeyBDb2xsZWN0aW9uIH0gZnJvbSAnLi4vdXRpbHMvQ29sbGVjdGlvbic7XHJcblxyXG4vKipcclxuICogQmFzZSBtYW5hZ2VyIGZvciBjYWNoaW5nIHN0cnVjdHVyZXNcclxuICovXHJcbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBCYXNlTWFuYWdlcjxLIGV4dGVuZHMgc3RyaW5nLCBWLCBSID0gVj4ge1xyXG4gIC8qKiBUaGUgY2xpZW50IHRoYXQgaW5zdGFudGlhdGVkIHRoaXMgbWFuYWdlciAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBjbGllbnQ6IGFueTtcclxuICBcclxuICAvKiogVGhlIGNhY2hlIG9mIGl0ZW1zICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGNhY2hlOiBDb2xsZWN0aW9uPEssIFY+O1xyXG4gIFxyXG4gIC8qKiBUaGUgY2xhc3MgdG8gaW5zdGFudGlhdGUgZm9yIGl0ZW1zICovXHJcbiAgcHJvdGVjdGVkIHJlYWRvbmx5IGhvbGRzOiBuZXcgKC4uLmFyZ3M6IGFueVtdKSA9PiBWO1xyXG5cclxuICBjb25zdHJ1Y3RvcihjbGllbnQ6IGFueSwgaG9sZHM6IG5ldyAoLi4uYXJnczogYW55W10pID0+IFYsIGl0ZXJhYmxlPzogSXRlcmFibGU8Uj4pIHtcclxuICAgIHRoaXMuY2xpZW50ID0gY2xpZW50O1xyXG4gICAgdGhpcy5ob2xkcyA9IGhvbGRzO1xyXG4gICAgdGhpcy5jYWNoZSA9IG5ldyBDb2xsZWN0aW9uPEssIFY+KCk7XHJcbiAgICBcclxuICAgIGlmIChpdGVyYWJsZSkge1xyXG4gICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgaXRlcmFibGUpIHtcclxuICAgICAgICB0aGlzLl9hZGQoaXRlbSBhcyBhbnkpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBZGQgYW4gaXRlbSB0byB0aGUgY2FjaGVcclxuICAgKi9cclxuICBhYnN0cmFjdCBfYWRkKGRhdGE6IGFueSwgY2FjaGU/OiBib29sZWFuLCBvcHRpb25zPzogeyBpZD86IEs7IGV4dHJhcz86IGFueVtdIH0pOiBWO1xyXG5cclxuICAvKipcclxuICAgKiBSZXNvbHZlIGFuIGl0ZW0gZnJvbSB0aGUgY2FjaGUgb3IgSURcclxuICAgKi9cclxuICByZXNvbHZlKGlkT3JJbnN0YW5jZTogSyB8IFYpOiBWIHwgbnVsbCB7XHJcbiAgICBpZiAoaWRPckluc3RhbmNlIGluc3RhbmNlb2YgdGhpcy5ob2xkcykgcmV0dXJuIGlkT3JJbnN0YW5jZTtcclxuICAgIGlmICh0eXBlb2YgaWRPckluc3RhbmNlID09PSAnc3RyaW5nJykgcmV0dXJuIHRoaXMuY2FjaGUuZ2V0KGlkT3JJbnN0YW5jZSBhcyBLKSA/PyBudWxsO1xyXG4gICAgcmV0dXJuIG51bGw7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZXNvbHZlIGFuIElEIGZyb20gYW4gaXRlbSBvciBJRFxyXG4gICAqL1xyXG4gIHJlc29sdmVJZChpZE9ySW5zdGFuY2U6IEsgfCBWIHwgeyBpZDogSyB9KTogSyB8IG51bGwge1xyXG4gICAgaWYgKGlkT3JJbnN0YW5jZSBpbnN0YW5jZW9mIHRoaXMuaG9sZHMpIHJldHVybiAoaWRPckluc3RhbmNlIGFzIGFueSkuaWQ7XHJcbiAgICBpZiAodHlwZW9mIGlkT3JJbnN0YW5jZSA9PT0gJ3N0cmluZycpIHJldHVybiBpZE9ySW5zdGFuY2UgYXMgSztcclxuICAgIGlmICh0eXBlb2YgaWRPckluc3RhbmNlID09PSAnb2JqZWN0JyAmJiBpZE9ySW5zdGFuY2UgIT09IG51bGwgJiYgJ2lkJyBpbiBpZE9ySW5zdGFuY2UpIHtcclxuICAgICAgcmV0dXJuIGlkT3JJbnN0YW5jZS5pZDtcclxuICAgIH1cclxuICAgIHJldHVybiBudWxsO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IHRoZSBjYWNoZSBhcyBhIEpTT04gYXJyYXlcclxuICAgKi9cclxuICB2YWx1ZU9mKCk6IFZbXSB7XHJcbiAgICByZXR1cm4gWy4uLnRoaXMuY2FjaGUudmFsdWVzKCldO1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIENhY2hpbmcgbWFuYWdlciB0aGF0IGZldGNoZXMgZGF0YSBmcm9tIHRoZSBBUElcclxuICovXHJcbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBDYWNoZWRNYW5hZ2VyPEsgZXh0ZW5kcyBzdHJpbmcsIFYsIFIgPSBWPiBleHRlbmRzIEJhc2VNYW5hZ2VyPEssIFYsIFI+IHtcclxuICAvKipcclxuICAgKiBGZXRjaCBhbiBpdGVtIGZyb20gdGhlIEFQSVxyXG4gICAqL1xyXG4gIGFic3RyYWN0IGZldGNoKGlkOiBLLCBvcHRpb25zPzogeyBjYWNoZT86IGJvb2xlYW47IGZvcmNlPzogYm9vbGVhbiB9KTogUHJvbWlzZTxWPjtcclxuXHJcbiAgLyoqXHJcbiAgICogRmV0Y2ggYW4gaXRlbSwgdXNpbmcgY2FjaGUgaWYgYXZhaWxhYmxlIChhc3luYyB2ZXJzaW9uKVxyXG4gICAqL1xyXG4gIGFzeW5jIHJlc29sdmVBc3luYyhpZE9ySW5zdGFuY2U6IEsgfCBWLCBvcHRpb25zPzogeyBjYWNoZT86IGJvb2xlYW47IGZvcmNlPzogYm9vbGVhbiB9KTogUHJvbWlzZTxWIHwgbnVsbD4ge1xyXG4gICAgY29uc3QgZXhpc3RpbmcgPSBzdXBlci5yZXNvbHZlKGlkT3JJbnN0YW5jZSk7XHJcbiAgICBpZiAoZXhpc3RpbmcgJiYgIW9wdGlvbnM/LmZvcmNlKSByZXR1cm4gZXhpc3Rpbmc7XHJcbiAgICBcclxuICAgIGNvbnN0IGlkID0gdGhpcy5yZXNvbHZlSWQoaWRPckluc3RhbmNlKTtcclxuICAgIGlmICghaWQpIHJldHVybiBudWxsO1xyXG4gICAgXHJcbiAgICB0cnkge1xyXG4gICAgICByZXR1cm4gYXdhaXQgdGhpcy5mZXRjaChpZCwgb3B0aW9ucyk7XHJcbiAgICB9IGNhdGNoIHtcclxuICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogRGF0YSBtYW5hZ2VyIHRoYXQgZG9lc24ndCBjYWNoZVxyXG4gKi9cclxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIERhdGFNYW5hZ2VyPEsgZXh0ZW5kcyBzdHJpbmcsIFYsIFIgPSBWPiBleHRlbmRzIEJhc2VNYW5hZ2VyPEssIFYsIFI+IHtcclxuICAvKipcclxuICAgKiBBZGQgYW4gaXRlbSB0byB0aGUgY2FjaGVcclxuICAgKi9cclxuICBfYWRkKGRhdGE6IGFueSwgY2FjaGUgPSB0cnVlLCBvcHRpb25zPzogeyBpZD86IEs7IGV4dHJhcz86IGFueVtdIH0pOiBWIHtcclxuICAgIGNvbnN0IGV4aXN0aW5nID0gdGhpcy5jYWNoZS5nZXQob3B0aW9ucz8uaWQgPz8gZGF0YS5pZCk7XHJcbiAgICBpZiAoZXhpc3RpbmcpIHtcclxuICAgICAgaWYgKGNhY2hlKSB7XHJcbiAgICAgICAgKGV4aXN0aW5nIGFzIGFueSkuX3BhdGNoPy4oZGF0YSk7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIGV4aXN0aW5nO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBjb25zdCBlbnRyeSA9IG5ldyB0aGlzLmhvbGRzKHRoaXMuY2xpZW50LCBkYXRhLCAuLi4ob3B0aW9ucz8uZXh0cmFzID8/IFtdKSk7XHJcbiAgICBpZiAoY2FjaGUpIHtcclxuICAgICAgdGhpcy5jYWNoZS5zZXQob3B0aW9ucz8uaWQgPz8gZGF0YS5pZCwgZW50cnkpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGVudHJ5O1xyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgQmFzZU1hbmFnZXI7XHJcbiJdfQ==