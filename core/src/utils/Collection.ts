/**
 * A Map with additional utility methods
 */
export class Collection<K, V> extends Map<K, V> {
  /**
   * Identical to Map.get()
   * Ensures the value exists
   */
  ensure(key: K, defaultValueGenerator: (key: K, collection: this) => V): V {
    if (this.has(key)) return this.get(key)!;
    const defaultValue = defaultValueGenerator(key, this);
    this.set(key, defaultValue);
    return defaultValue;
  }

  /**
   * Checks if all items pass a test
   */
  every(fn: (value: V, key: K, collection: this) => boolean): boolean {
    for (const [key, val] of this) {
      if (!fn(val, key, this)) return false;
    }
    return true;
  }

  /**
   * Checks if any item passes a test
   */
  some(fn: (value: V, key: K, collection: this) => boolean): boolean {
    for (const [key, val] of this) {
      if (fn(val, key, this)) return true;
    }
    return false;
  }

  /**
   * Identical to Array.filter(), but returns a Collection
   */
  filter(fn: (value: V, key: K, collection: this) => boolean): Collection<K, V> {
    const results = new Collection<K, V>();
    for (const [key, val] of this) {
      if (fn(val, key, this)) results.set(key, val);
    }
    return results;
  }

  /**
   * Partitions the collection into two collections
   */
  partition(fn: (value: V, key: K, collection: this) => boolean): [Collection<K, V>, Collection<K, V>] {
    const results: [Collection<K, V>, Collection<K, V>] = [new Collection<K, V>(), new Collection<K, V>()];
    for (const [key, val] of this) {
      if (fn(val, key, this)) {
        results[0].set(key, val);
      } else {
        results[1].set(key, val);
      }
    }
    return results;
  }

  /**
   * Maps each item to another value
   */
  map<T>(fn: (value: V, key: K, collection: this) => T): T[] {
    const results: T[] = [];
    for (const [key, val] of this) {
      results.push(fn(val, key, this));
    }
    return results;
  }

  /**
   * Maps each item to another value into a Collection
   */
  mapValues<T>(fn: (value: V, key: K, collection: this) => T): Collection<K, T> {
    const results = new Collection<K, T>();
    for (const [key, val] of this) {
      results.set(key, fn(val, key, this));
    }
    return results;
  }

  /**
   * Searches for a single item
   */
  find(fn: (value: V, key: K, collection: this) => boolean): V | undefined {
    for (const [key, val] of this) {
      if (fn(val, key, this)) return val;
    }
    return undefined;
  }

  /**
   * Searches for the key of a single item
   */
  findKey(fn: (value: V, key: K, collection: this) => boolean): K | undefined {
    for (const [key, val] of this) {
      if (fn(val, key, this)) return key;
    }
    return undefined;
  }

  /**
   * Removes items that satisfy the provided filter function
   */
  sweep(fn: (value: V, key: K, collection: this) => boolean): number {
    const previousSize = this.size;
    for (const [key, val] of this) {
      if (fn(val, key, this)) this.delete(key);
    }
    return previousSize - this.size;
  }

  /**
   * Reduces the collection to a single value
   */
  reduce<T>(fn: (accumulator: T, value: V, key: K, collection: this) => T, initialValue: T): T {
    let accumulator = initialValue;
    for (const [key, val] of this) {
      accumulator = fn(accumulator, val, key, this);
    }
    return accumulator;
  }

  /**
   * Identical to Array.forEach()
   */
  each(fn: (value: V, key: K, collection: this) => void): this {
    for (const [key, val] of this) {
      fn(val, key, this);
    }
    return this;
  }

  /**
   * Returns the first item(s) in the collection
   */
  first(): V | undefined;
  first(amount: number): V[];
  first(amount?: number): V | V[] | undefined {
    if (amount === undefined) return this.values().next().value;
    if (amount < 0) return this.last(amount * -1);
    amount = Math.min(this.size, amount);
    const iter = this.values();
    return Array.from({ length: amount }, () => iter.next().value);
  }

  /**
   * Returns the first key(s) in the collection
   */
  firstKey(): K | undefined;
  firstKey(amount: number): K[];
  firstKey(amount?: number): K | K[] | undefined {
    if (amount === undefined) return this.keys().next().value;
    if (amount < 0) return this.lastKey(amount * -1);
    amount = Math.min(this.size, amount);
    const iter = this.keys();
    return Array.from({ length: amount }, () => iter.next().value);
  }

  /**
   * Returns the last item(s) in the collection
   */
  last(): V | undefined;
  last(amount: number): V[];
  last(amount?: number): V | V[] | undefined {
    const arr = [...this.values()];
    if (amount === undefined) return arr[arr.length - 1];
    if (amount < 0) return this.first(amount * -1);
    if (!amount) return [];
    return arr.slice(-amount);
  }

  /**
   * Returns the last key(s) in the collection
   */
  lastKey(): K | undefined;
  lastKey(amount: number): K[];
  lastKey(amount?: number): K | K[] | undefined {
    const arr = [...this.keys()];
    if (amount === undefined) return arr[arr.length - 1];
    if (amount < 0) return this.firstKey(amount * -1);
    if (!amount) return [];
    return arr.slice(-amount);
  }

  /**
   * Returns a random item from the collection
   */
  random(): V | undefined;
  random(amount: number): V[];
  random(amount?: number): V | V[] | undefined {
    const arr = [...this.values()];
    if (amount === undefined) return arr[Math.floor(Math.random() * arr.length)];
    if (!arr.length || !amount) return [];
    return Array.from({ length: Math.min(amount, arr.length) }, () => arr.splice(Math.floor(Math.random() * arr.length), 1)[0]);
  }

  /**
   * Returns a random key from the collection
   */
  randomKey(): K | undefined;
  randomKey(amount: number): K[];
  randomKey(amount?: number): K | K[] | undefined {
    const arr = [...this.keys()];
    if (amount === undefined) return arr[Math.floor(Math.random() * arr.length)];
    if (!arr.length || !amount) return [];
    return Array.from({ length: Math.min(amount, arr.length) }, () => arr.splice(Math.floor(Math.random() * arr.length), 1)[0]);
  }

  /**
   * Combines this collection with others
   */
  concat(...collections: Collection<K, V>[]): Collection<K, V> {
    const newColl = this.clone();
    for (const coll of collections) {
      for (const [key, val] of coll) newColl.set(key, val);
    }
    return newColl;
  }

  /**
   * Checks if this collection shares identical items with another
   */
  equals(collection: Collection<K, V>): boolean {
    if (this === collection) return true;
    if (this.size !== collection.size) return false;
    for (const [key, value] of this) {
      if (!collection.has(key) || value !== collection.get(key)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Creates an identical shallow copy of this collection
   */
  clone(): Collection<K, V> {
    return new Collection(this);
  }

  /**
   * Sorts the collection and returns it
   */
  sort(compareFunction: (firstValue: V, secondValue: V, firstKey: K, secondKey: K) => number = Collection.defaultSort): this {
    const entries = [...this.entries()];
    entries.sort((a, b) => compareFunction(a[1], b[1], a[0], b[0]));
    this.clear();
    for (const [k, v] of entries) {
      this.set(k, v);
    }
    return this;
  }

  /**
   * Sorts the collection by keys and returns it
   */
  sortByKey(compareFunction: (firstKey: K, secondKey: K, firstValue: V, secondValue: V) => number = Collection.defaultSort): this {
    const entries = [...this.entries()];
    entries.sort((a, b) => compareFunction(a[0], b[0], a[1], b[1]));
    this.clear();
    for (const [k, v] of entries) {
      this.set(k, v);
    }
    return this;
  }

  /**
   * Returns an array of items
   */
  toJSON(): V[] {
    return [...this.values()];
  }

  /**
   * Default sort function
   */
  private static defaultSort<V>(firstValue: V, secondValue: V): number {
    return Number(firstValue > secondValue) || Number(firstValue === secondValue) - 1;
  }

  /**
   * Creates a Collection from an array
   */
  static from<K, V>(entries: Iterable<readonly [K, V]>): Collection<K, V> {
    return new Collection(entries);
  }
}
