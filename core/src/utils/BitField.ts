/**
 * Generic BitField class
 * API compatible with Discord.js BitField
 */

export type BitFieldResolvable<S extends string, N extends bigint | number> = 
  | N 
  | N[] 
  | S 
  | S[] 
  | BitField<S, N>;

/**
 * Data structure for bit fields
 */
export class BitField<S extends string = string, N extends bigint | number = bigint> {
  /** The raw bits */
  public bitfield: N;

  /** Cached array result */
  private _cachedArray: S[] | null = null;
  
  /** Bitfield value at the time of caching */
  private _bitfieldAtCache: N | null = null;

  /** Flags for this bitfield (override in subclass) */
  static Flags: Record<string, bigint | number> = {};

  /** Default bit value */
  static DefaultBit: bigint | number = 0n;

  constructor(bits: BitFieldResolvable<S, N> = BitField.DefaultBit as N) {
    this.bitfield = (this.constructor as typeof BitField).resolve<S, N>(bits);
  }

  /**
   * Check if this bitfield has a bit
   */
  has(bit: BitFieldResolvable<S, N>): boolean {
    const resolved = (this.constructor as typeof BitField).resolve<S, N>(bit);
    return ((this.bitfield as bigint) & (resolved as bigint)) === (resolved as bigint);
  }

  /**
   * Check if this bitfield has any of the bits
   */
  any(bits: BitFieldResolvable<S, N>): boolean {
    const resolved = (this.constructor as typeof BitField).resolve<S, N>(bits);
    return ((this.bitfield as bigint) & (resolved as bigint)) !== 0n;
  }

  /**
   * Add bits to this bitfield
   */
  add(...bits: BitFieldResolvable<S, N>[]): this {
    let total = 0n;
    for (const bit of bits) {
      total |= (this.constructor as typeof BitField).resolve<S, N>(bit) as bigint;
    }
    (this.bitfield as bigint) |= total;
    // Invalidate cache
    this._cachedArray = null;
    this._bitfieldAtCache = null;
    return this;
  }

  /**
   * Remove bits from this bitfield
   */
  remove(...bits: BitFieldResolvable<S, N>[]): this {
    let total = 0n;
    for (const bit of bits) {
      total |= (this.constructor as typeof BitField).resolve<S, N>(bit) as bigint;
    }
    (this.bitfield as bigint) &= ~total;
    // Invalidate cache
    this._cachedArray = null;
    this._bitfieldAtCache = null;
    return this;
  }

  /**
   * Serialize to array of flag names
   */
  toArray(): S[] {
    // Return cached result if bitfield hasn't changed
    if (this._cachedArray !== null && this._bitfieldAtCache === this.bitfield) {
      return [...this._cachedArray];
    }
    
    const flags = (this.constructor as typeof BitField).Flags;
    const result: S[] = [];
    
    for (const [name, bit] of Object.entries(flags)) {
      if ((this.bitfield as bigint) & (bit as bigint)) {
        result.push(name as S);
      }
    }
    
    // Cache the result
    this._cachedArray = result;
    this._bitfieldAtCache = this.bitfield;
    
    return [...result];
  }

  /**
   * Serialize to JSON
   */
  toJSON(): string | number {
    return typeof this.bitfield === 'bigint' 
      ? this.bitfield.toString() 
      : this.bitfield;
  }

  /**
   * Get string representation
   */
  toString(): string {
    return this.bitfield.toString();
  }

  /**
   * Get iterator
   */
  *[Symbol.iterator](): IterableIterator<S> {
    yield* this.toArray();
  }

  /**
   * Freeze this bitfield
   */
  freeze(): Readonly<this> {
    return Object.freeze(this);
  }

  /**
   * Check equality
   */
  equals(other: BitFieldResolvable<S, N>): boolean {
    return this.bitfield === (this.constructor as typeof BitField).resolve<S, N>(other);
  }

  /**
   * Clone this bitfield
   */
  clone(): BitField<S, N> {
    return new (this.constructor as new (bits: N) => BitField<S, N>)(this.bitfield);
  }

  /**
   * Resolve a bit to the numeric type
   */
  static resolve<S extends string, N extends bigint | number>(bit: BitFieldResolvable<S, N>): N {
    if (typeof bit === 'bigint' || typeof bit === 'number') {
      return bit as N;
    }

    if (bit instanceof BitField) {
      return bit.bitfield as N;
    }

    if (typeof bit === 'string') {
      const resolved = this.Flags[bit];
      if (resolved === undefined) {
        throw new Error(`Unknown bit: ${bit}`);
      }
      return resolved as N;
    }

    if (Array.isArray(bit)) {
      let result = this.DefaultBit as bigint;
      for (const b of bit) {
        const resolved = this.resolve<S, N>(b);
        result |= resolved as bigint;
      }
      return result as N;
    }

    throw new Error(`Invalid bit: ${bit}`);
  }
}

export default BitField;
