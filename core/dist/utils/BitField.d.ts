/**
 * Generic BitField class
 * API compatible with Discord.js BitField
 */
export type BitFieldResolvable<S extends string, N extends bigint | number> = N | N[] | S | S[] | BitField<S, N>;
/**
 * Data structure for bit fields
 */
export declare class BitField<S extends string = string, N extends bigint | number = bigint> {
    /** The raw bits */
    bitfield: N;
    /** Flags for this bitfield (override in subclass) */
    static Flags: Record<string, bigint | number>;
    /** Default bit value */
    static DefaultBit: bigint | number;
    constructor(bits?: BitFieldResolvable<S, N>);
    /**
     * Check if this bitfield has a bit
     */
    has(bit: BitFieldResolvable<S, N>): boolean;
    /**
     * Check if this bitfield has any of the bits
     */
    any(bits: BitFieldResolvable<S, N>): boolean;
    /**
     * Add bits to this bitfield
     */
    add(...bits: BitFieldResolvable<S, N>[]): this;
    /**
     * Remove bits from this bitfield
     */
    remove(...bits: BitFieldResolvable<S, N>[]): this;
    /**
     * Serialize to array of flag names
     */
    toArray(): S[];
    /**
     * Serialize to JSON
     */
    toJSON(): string | number;
    /**
     * Get string representation
     */
    toString(): string;
    /**
     * Get iterator
     */
    [Symbol.iterator](): IterableIterator<S>;
    /**
     * Freeze this bitfield
     */
    freeze(): Readonly<this>;
    /**
     * Check equality
     */
    equals(other: BitFieldResolvable<S, N>): boolean;
    /**
     * Clone this bitfield
     */
    clone(): BitField<S, N>;
    /**
     * Resolve a bit to the numeric type
     */
    static resolve<S extends string, N extends bigint | number>(bit: BitFieldResolvable<S, N>): N;
}
export default BitField;
