/**
 * Base manager class for caching and managing structures
 */

import { Collection } from '../utils/Collection';

/**
 * Base manager for caching structures
 */
export abstract class BaseManager<K extends string, V, R = V> {
  /** The client that instantiated this manager */
  public readonly client: any;
  
  /** The cache of items */
  public readonly cache: Collection<K, V>;
  
  /** The class to instantiate for items */
  protected readonly holds: new (...args: any[]) => V;

  constructor(client: any, holds: new (...args: any[]) => V, iterable?: Iterable<R>) {
    this.client = client;
    this.holds = holds;
    this.cache = new Collection<K, V>();
    
    if (iterable) {
      for (const item of iterable) {
        this._add(item as any);
      }
    }
  }

  /**
   * Add an item to the cache
   */
  abstract _add(data: any, cache?: boolean, options?: { id?: K; extras?: any[] }): V;

  /**
   * Resolve an item from the cache or ID
   */
  resolve(idOrInstance: K | V): V | null {
    if (idOrInstance instanceof this.holds) return idOrInstance;
    if (typeof idOrInstance === 'string') return this.cache.get(idOrInstance as K) ?? null;
    return null;
  }

  /**
   * Resolve an ID from an item or ID
   */
  resolveId(idOrInstance: K | V | { id: K }): K | null {
    if (idOrInstance instanceof this.holds) return (idOrInstance as any).id;
    if (typeof idOrInstance === 'string') return idOrInstance as K;
    if (typeof idOrInstance === 'object' && idOrInstance !== null && 'id' in idOrInstance) {
      return idOrInstance.id;
    }
    return null;
  }

  /**
   * Get the cache as a JSON array
   */
  valueOf(): V[] {
    return [...this.cache.values()];
  }
}

/**
 * Caching manager that fetches data from the API
 */
export abstract class CachedManager<K extends string, V, R = V> extends BaseManager<K, V, R> {
  /**
   * Fetch an item from the API
   */
  abstract fetch(id: K, options?: { cache?: boolean; force?: boolean }): Promise<V>;

  /**
   * Fetch an item, using cache if available (async version)
   */
  async resolveAsync(idOrInstance: K | V, options?: { cache?: boolean; force?: boolean }): Promise<V | null> {
    const existing = super.resolve(idOrInstance);
    if (existing && !options?.force) return existing;
    
    const id = this.resolveId(idOrInstance);
    if (!id) return null;
    
    try {
      return await this.fetch(id, options);
    } catch {
      return null;
    }
  }
}

/**
 * Data manager that doesn't cache
 */
export abstract class DataManager<K extends string, V, R = V> extends BaseManager<K, V, R> {
  /**
   * Add an item to the cache
   */
  _add(data: any, cache = true, options?: { id?: K; extras?: any[] }): V {
    const existing = this.cache.get(options?.id ?? data.id);
    if (existing) {
      if (cache) {
        (existing as any)._patch?.(data);
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

export default BaseManager;
