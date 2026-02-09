/**
 * Extended Map with utility methods
 */
export declare class Collection<K, V> extends Map<K, V> {
    /**
     * Get the first value in the collection
     */
    first(): V | undefined;
    /**
     * Get the last value in the collection
     */
    last(): V | undefined;
    /**
     * Get a random value from the collection
     */
    random(): V | undefined;
    /**
     * Find a value matching a predicate
     */
    find(fn: (value: V, key: K, collection: this) => boolean): V | undefined;
    /**
     * Filter values matching a predicate
     */
    filter(fn: (value: V, key: K, collection: this) => boolean): Collection<K, V>;
    /**
     * Map values to a new array
     */
    map<T>(fn: (value: V, key: K, collection: this) => T): T[];
    /**
     * Check if some values match a predicate
     */
    some(fn: (value: V, key: K, collection: this) => boolean): boolean;
    /**
     * Check if every value matches a predicate
     */
    every(fn: (value: V, key: K, collection: this) => boolean): boolean;
    /**
     * Reduce the collection to a single value
     */
    reduce<T>(fn: (accumulator: T, value: V, key: K, collection: this) => T, initialValue: T): T;
    /**
     * Convert to array
     */
    toArray(): V[];
    /**
     * Clone the collection
     */
    clone(): Collection<K, V>;
    /**
     * Concat with another collection
     */
    concat(...collections: Collection<K, V>[]): Collection<K, V>;
}
