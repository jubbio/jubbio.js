/**
 * Base manager class for caching and managing structures
 */
import { Collection } from '../utils/Collection';
/**
 * Base manager for caching structures
 */
export declare abstract class BaseManager<K extends string, V, R = V> {
    /** The client that instantiated this manager */
    readonly client: any;
    /** The cache of items */
    readonly cache: Collection<K, V>;
    /** The class to instantiate for items */
    protected readonly holds: new (...args: any[]) => V;
    constructor(client: any, holds: new (...args: any[]) => V, iterable?: Iterable<R>);
    /**
     * Add an item to the cache
     */
    abstract _add(data: any, cache?: boolean, options?: {
        id?: K;
        extras?: any[];
    }): V;
    /**
     * Resolve an item from the cache or ID
     */
    resolve(idOrInstance: K | V): V | null;
    /**
     * Resolve an ID from an item or ID
     */
    resolveId(idOrInstance: K | V | {
        id: K;
    }): K | null;
    /**
     * Get the cache as a JSON array
     */
    valueOf(): V[];
}
/**
 * Caching manager that fetches data from the API
 */
export declare abstract class CachedManager<K extends string, V, R = V> extends BaseManager<K, V, R> {
    /**
     * Fetch an item from the API
     */
    abstract fetch(id: K, options?: {
        cache?: boolean;
        force?: boolean;
    }): Promise<V>;
    /**
     * Fetch an item, using cache if available (async version)
     */
    resolveAsync(idOrInstance: K | V, options?: {
        cache?: boolean;
        force?: boolean;
    }): Promise<V | null>;
}
/**
 * Data manager that doesn't cache
 */
export declare abstract class DataManager<K extends string, V, R = V> extends BaseManager<K, V, R> {
    /**
     * Add an item to the cache
     */
    _add(data: any, cache?: boolean, options?: {
        id?: K;
        extras?: any[];
    }): V;
}
export default BaseManager;
