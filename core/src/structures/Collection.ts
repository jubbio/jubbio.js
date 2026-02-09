/**
 * Extended Map with utility methods
 */
export class Collection<K, V> extends Map<K, V> {
  /**
   * Get the first value in the collection
   */
  first(): V | undefined {
    return this.values().next().value;
  }

  /**
   * Get the last value in the collection
   */
  last(): V | undefined {
    const arr = [...this.values()];
    return arr[arr.length - 1];
  }

  /**
   * Get a random value from the collection
   */
  random(): V | undefined {
    const arr = [...this.values()];
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /**
   * Find a value matching a predicate
   */
  find(fn: (value: V, key: K, collection: this) => boolean): V | undefined {
    for (const [key, val] of this) {
      if (fn(val, key, this)) return val;
    }
    return undefined;
  }

  /**
   * Filter values matching a predicate
   */
  filter(fn: (value: V, key: K, collection: this) => boolean): Collection<K, V> {
    const results = new Collection<K, V>();
    for (const [key, val] of this) {
      if (fn(val, key, this)) results.set(key, val);
    }
    return results;
  }

  /**
   * Map values to a new array
   */
  map<T>(fn: (value: V, key: K, collection: this) => T): T[] {
    const results: T[] = [];
    for (const [key, val] of this) {
      results.push(fn(val, key, this));
    }
    return results;
  }

  /**
   * Check if some values match a predicate
   */
  some(fn: (value: V, key: K, collection: this) => boolean): boolean {
    for (const [key, val] of this) {
      if (fn(val, key, this)) return true;
    }
    return false;
  }

  /**
   * Check if every value matches a predicate
   */
  every(fn: (value: V, key: K, collection: this) => boolean): boolean {
    for (const [key, val] of this) {
      if (!fn(val, key, this)) return false;
    }
    return true;
  }

  /**
   * Reduce the collection to a single value
   */
  reduce<T>(fn: (accumulator: T, value: V, key: K, collection: this) => T, initialValue: T): T {
    let accumulator = initialValue;
    for (const [key, val] of this) {
      accumulator = fn(accumulator, val, key, this);
    }
    return accumulator;
  }

  /**
   * Convert to array
   */
  toArray(): V[] {
    return [...this.values()];
  }

  /**
   * Clone the collection
   */
  clone(): Collection<K, V> {
    return new Collection(this);
  }

  /**
   * Concat with another collection
   */
  concat(...collections: Collection<K, V>[]): Collection<K, V> {
    const newColl = this.clone();
    for (const coll of collections) {
      for (const [key, val] of coll) {
        newColl.set(key, val);
      }
    }
    return newColl;
  }
}
