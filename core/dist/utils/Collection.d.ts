/**
 * A Map with additional utility methods
 */
export declare class Collection<K, V> extends Map<K, V> {
    /**
     * Identical to Map.get()
     * Ensures the value exists
     */
    ensure(key: K, defaultValueGenerator: (key: K, collection: this) => V): V;
    /**
     * Checks if all items pass a test
     */
    every(fn: (value: V, key: K, collection: this) => boolean): boolean;
    /**
     * Checks if any item passes a test
     */
    some(fn: (value: V, key: K, collection: this) => boolean): boolean;
    /**
     * Identical to Array.filter(), but returns a Collection
     */
    filter(fn: (value: V, key: K, collection: this) => boolean): Collection<K, V>;
    /**
     * Partitions the collection into two collections
     */
    partition(fn: (value: V, key: K, collection: this) => boolean): [Collection<K, V>, Collection<K, V>];
    /**
     * Maps each item to another value
     */
    map<T>(fn: (value: V, key: K, collection: this) => T): T[];
    /**
     * Maps each item to another value into a Collection
     */
    mapValues<T>(fn: (value: V, key: K, collection: this) => T): Collection<K, T>;
    /**
     * Searches for a single item
     */
    find(fn: (value: V, key: K, collection: this) => boolean): V | undefined;
    /**
     * Searches for the key of a single item
     */
    findKey(fn: (value: V, key: K, collection: this) => boolean): K | undefined;
    /**
     * Removes items that satisfy the provided filter function
     */
    sweep(fn: (value: V, key: K, collection: this) => boolean): number;
    /**
     * Reduces the collection to a single value
     */
    reduce<T>(fn: (accumulator: T, value: V, key: K, collection: this) => T, initialValue: T): T;
    /**
     * Identical to Array.forEach()
     */
    each(fn: (value: V, key: K, collection: this) => void): this;
    /**
     * Returns the first item(s) in the collection
     */
    first(): V | undefined;
    first(amount: number): V[];
    /**
     * Returns the first key(s) in the collection
     */
    firstKey(): K | undefined;
    firstKey(amount: number): K[];
    /**
     * Returns the last item(s) in the collection
     */
    last(): V | undefined;
    last(amount: number): V[];
    /**
     * Returns the last key(s) in the collection
     */
    lastKey(): K | undefined;
    lastKey(amount: number): K[];
    /**
     * Returns a random item from the collection
     */
    random(): V | undefined;
    random(amount: number): V[];
    /**
     * Returns a random key from the collection
     */
    randomKey(): K | undefined;
    randomKey(amount: number): K[];
    /**
     * Combines this collection with others
     */
    concat(...collections: Collection<K, V>[]): Collection<K, V>;
    /**
     * Checks if this collection shares identical items with another
     */
    equals(collection: Collection<K, V>): boolean;
    /**
     * Creates an identical shallow copy of this collection
     */
    clone(): Collection<K, V>;
    /**
     * Sorts the collection and returns it
     */
    sort(compareFunction?: (firstValue: V, secondValue: V, firstKey: K, secondKey: K) => number): this;
    /**
     * Sorts the collection by keys and returns it
     */
    sortByKey(compareFunction?: (firstKey: K, secondKey: K, firstValue: V, secondValue: V) => number): this;
    /**
     * Returns an array of items
     */
    toJSON(): V[];
    /**
     * Default sort function
     */
    private static defaultSort;
    /**
     * Creates a Collection from an array
     */
    static from<K, V>(entries: Iterable<readonly [K, V]>): Collection<K, V>;
}
