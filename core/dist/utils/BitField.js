"use strict";
/**
 * Generic BitField class
 * API compatible with Discord.js BitField
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BitField = void 0;
/**
 * Data structure for bit fields
 */
class BitField {
    /** The raw bits */
    bitfield;
    /** Flags for this bitfield (override in subclass) */
    static Flags = {};
    /** Default bit value */
    static DefaultBit = 0n;
    constructor(bits = BitField.DefaultBit) {
        this.bitfield = this.constructor.resolve(bits);
    }
    /**
     * Check if this bitfield has a bit
     */
    has(bit) {
        const resolved = this.constructor.resolve(bit);
        return (this.bitfield & resolved) === resolved;
    }
    /**
     * Check if this bitfield has any of the bits
     */
    any(bits) {
        const resolved = this.constructor.resolve(bits);
        return (this.bitfield & resolved) !== 0n;
    }
    /**
     * Add bits to this bitfield
     */
    add(...bits) {
        let total = 0n;
        for (const bit of bits) {
            total |= this.constructor.resolve(bit);
        }
        this.bitfield |= total;
        return this;
    }
    /**
     * Remove bits from this bitfield
     */
    remove(...bits) {
        let total = 0n;
        for (const bit of bits) {
            total |= this.constructor.resolve(bit);
        }
        this.bitfield &= ~total;
        return this;
    }
    /**
     * Serialize to array of flag names
     */
    toArray() {
        const flags = this.constructor.Flags;
        const result = [];
        for (const [name, bit] of Object.entries(flags)) {
            if (this.bitfield & bit) {
                result.push(name);
            }
        }
        return result;
    }
    /**
     * Serialize to JSON
     */
    toJSON() {
        return typeof this.bitfield === 'bigint'
            ? this.bitfield.toString()
            : this.bitfield;
    }
    /**
     * Get string representation
     */
    toString() {
        return this.bitfield.toString();
    }
    /**
     * Get iterator
     */
    *[Symbol.iterator]() {
        yield* this.toArray();
    }
    /**
     * Freeze this bitfield
     */
    freeze() {
        return Object.freeze(this);
    }
    /**
     * Check equality
     */
    equals(other) {
        return this.bitfield === this.constructor.resolve(other);
    }
    /**
     * Clone this bitfield
     */
    clone() {
        return new this.constructor(this.bitfield);
    }
    /**
     * Resolve a bit to the numeric type
     */
    static resolve(bit) {
        if (typeof bit === 'bigint' || typeof bit === 'number') {
            return bit;
        }
        if (bit instanceof BitField) {
            return bit.bitfield;
        }
        if (typeof bit === 'string') {
            const resolved = this.Flags[bit];
            if (resolved === undefined) {
                throw new Error(`Unknown bit: ${bit}`);
            }
            return resolved;
        }
        if (Array.isArray(bit)) {
            let result = this.DefaultBit;
            for (const b of bit) {
                const resolved = this.resolve(b);
                result |= resolved;
            }
            return result;
        }
        throw new Error(`Invalid bit: ${bit}`);
    }
}
exports.BitField = BitField;
exports.default = BitField;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQml0RmllbGQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdXRpbHMvQml0RmllbGQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7R0FHRzs7O0FBU0g7O0dBRUc7QUFDSCxNQUFhLFFBQVE7SUFDbkIsbUJBQW1CO0lBQ1osUUFBUSxDQUFJO0lBRW5CLHFEQUFxRDtJQUNyRCxNQUFNLENBQUMsS0FBSyxHQUFvQyxFQUFFLENBQUM7SUFFbkQsd0JBQXdCO0lBQ3hCLE1BQU0sQ0FBQyxVQUFVLEdBQW9CLEVBQUUsQ0FBQztJQUV4QyxZQUFZLE9BQWlDLFFBQVEsQ0FBQyxVQUFlO1FBQ25FLElBQUksQ0FBQyxRQUFRLEdBQUksSUFBSSxDQUFDLFdBQStCLENBQUMsT0FBTyxDQUFPLElBQUksQ0FBQyxDQUFDO0lBQzVFLENBQUM7SUFFRDs7T0FFRztJQUNILEdBQUcsQ0FBQyxHQUE2QjtRQUMvQixNQUFNLFFBQVEsR0FBSSxJQUFJLENBQUMsV0FBK0IsQ0FBQyxPQUFPLENBQU8sR0FBRyxDQUFDLENBQUM7UUFDMUUsT0FBTyxDQUFFLElBQUksQ0FBQyxRQUFtQixHQUFJLFFBQW1CLENBQUMsS0FBTSxRQUFtQixDQUFDO0lBQ3JGLENBQUM7SUFFRDs7T0FFRztJQUNILEdBQUcsQ0FBQyxJQUE4QjtRQUNoQyxNQUFNLFFBQVEsR0FBSSxJQUFJLENBQUMsV0FBK0IsQ0FBQyxPQUFPLENBQU8sSUFBSSxDQUFDLENBQUM7UUFDM0UsT0FBTyxDQUFFLElBQUksQ0FBQyxRQUFtQixHQUFJLFFBQW1CLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDbkUsQ0FBQztJQUVEOztPQUVHO0lBQ0gsR0FBRyxDQUFDLEdBQUcsSUFBZ0M7UUFDckMsSUFBSSxLQUFLLEdBQUcsRUFBRSxDQUFDO1FBQ2YsS0FBSyxNQUFNLEdBQUcsSUFBSSxJQUFJLEVBQUUsQ0FBQztZQUN2QixLQUFLLElBQUssSUFBSSxDQUFDLFdBQStCLENBQUMsT0FBTyxDQUFP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dkIsSUFBSSxNQUFNLEdBQUcsSUFBSSxDQUFDLFVBQW9CLENBQUM7WUFDdkMsS0FBSyxNQUFNLENBQUMsSUFBSSxHQUFHLEVBQUUsQ0FBQztnQkFDcEIsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBTyxDQUFDLENBQUMsQ0FBQztnQkFDdkMsTUFBTSxJQUFJLFFBQWtCLENBQUM7WUFDL0IsQ0FBQztZQUNELE9BQU8sTUFBVyxDQUFDO1FBQ3JCLENBQUM7UUFFRCxNQUFNLElBQUksS0FBSyxDQUFDLGdCQUFnQixHQUFHLEVBQUUsQ0FBQyxDQUFDO0lBQ3pDLENBQUM7O0FBaEpILDRCQWlKQztBQUVELGtCQUFlLFFBQVEsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogR2VuZXJpYyBCaXRGaWVsZCBjbGFzc1xuICogQVBJIGNvbXBhdGlibGUgd2l0aCBEaXNjb3JkLmpzIEJpdEZpZWxkXG4gKi9cblxuZXhwb3J0IHR5cGUgQml0RmllbGRSZXNvbHZhYmxlPFMgZXh0ZW5kcyBzdHJpbmcsIE4gZXh0ZW5kcyBiaWdpbnQgfCBudW1iZXI+ID0gXG4gIHwgTiBcbiAgfCBOW10gXG4gIHwgUyBcbiAgfCBTW10gXG4gIHwgQml0RmllbGQ8UywgTj47XG5cbi8qKlxuICogRGF0YSBzdHJ1Y3R1cmUgZm9yIGJpdCBmaWVsZHNcbiAqL1xuZXhwb3J0IGNsYXNzIEJpdEZpZWxkPFMgZXh0ZW5kcyBzdHJpbmcgPSBzdHJpbmcsIE4gZXh0ZW5kcyBiaWdpbnQgfCBudW1iZXIgPSBiaWdpbnQ+IHtcbiAgLyoqIFRoZSByYXcgYml0cyAqL1xuICBwdWJsaWMgYml0ZmllbGQ6IE47XG5cbiAgLyoqIEZsYWdzIGZvciB0aGlzIGJpdGZpZWxkIChvdmVycmlkZSBpbiBzdWJjbGFzcykgKi9cbiAgc3RhdGljIEZsYWdzOiBSZWNvcmQ8c3RyaW5nLCBiaWdpbnQgfCBudW1iZXI+ID0ge307XG5cbiAgLyoqIERlZmF1bHQgYml0IHZhbHVlICovXG4gIHN0YXRpYyBEZWZhdWx0Qml0OiBiaWdpbnQgfCBudW1iZXIgPSAwbjtcblxuICBjb25zdHJ1Y3RvcihiaXRzOiBCaXRGaWVsZFJlc29sdmFibGU8UywgTj4gPSBCaXRGaWVsZC5EZWZhdWx0Qml0IGFzIE4pIHtcbiAgICB0aGlzLmJpdGZpZWxkID0gKHRoaXMuY29uc3RydWN0b3IgYXMgdHlwZW9mIEJpdEZpZWxkKS5yZXNvbHZlPFMsIE4+KGJpdHMpO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrIGlmIHRoaXMgYml0ZmllbGQgaGFzIGEgYml0XG4gICAqL1xuICBoYXMoYml0OiBCaXRGaWVsZFJlc29sdmFibGU8UywgTj4pOiBib29sZWFuIHtcbiAgICBjb25zdCByZXNvbHZlZCA9ICh0aGlzLmNvbnN0cnVjdG9yIGFzIHR5cGVvZiBCaXRGaWVsZCkucmVzb2x2ZTxTLCBOPihiaXQpO1xuICAgIHJldHVybiAoKHRoaXMuYml0ZmllbGQgYXMgYmlnaW50KSAmIChyZXNvbHZlZCBhcyBiaWdpbnQpKSA9PT0gKHJlc29sdmVkIGFzIGJpZ2ludCk7XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2sgaWYgdGhpcyBiaXRmaWVsZCBoYXMgYW55IG9mIHRoZSBiaXRzXG4gICAqL1xuICBhbnkoYml0czogQml0RmllbGRSZXNvbHZhYmxlPFMsIE4+KTogYm9vbGVhbiB7XG4gICAgY29uc3QgcmVzb2x2ZWQgPSAodGhpcy5jb25zdHJ1Y3RvciBhcyB0eXBlb2YgQml0RmllbGQpLnJlc29sdmU8UywgTj4oYml0cyk7XG4gICAgcmV0dXJuICgodGhpcy5iaXRmaWVsZCBhcyBiaWdpbnQpICYgKHJlc29sdmVkIGFzIGJpZ2ludCkpICE9PSAwbjtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgYml0cyB0byB0aGlzIGJpdGZpZWxkXG4gICAqL1xuICBhZGQoLi4uYml0czogQml0RmllbGRSZXNvbHZhYmxlPFMsIE4+W10pOiB0aGlzIHtcbiAgICBsZXQgdG90YWwgPSAwbjtcbiAgICBmb3IgKGNvbnN0IGJpdCBvZiBiaXRzKSB7XG4gICAgICB0b3RhbCB8PSAodGhpcy5jb25zdHJ1Y3RvciBhcyB0eXBlb2YgQml0RmllbGQpLnJlc29sdmU8UywgTj4oYml0KSBhcyBiaWdpbnQ7XG4gICAgfVxuICAgICh0aGlzLmJpdGZpZWxkIGFzIGJpZ2ludCkgfD0gdG90YWw7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIGJpdHMgZnJvbSB0aGlzIGJpdGZpZWxkXG4gICAqL1xuICByZW1vdmUoLi4uYml0czogQml0RmllbGRSZXNvbHZhYmxlPFMsIE4+W10pOiB0aGlzIHtcbiAgICBsZXQgdG90YWwgPSAwbjtcbiAgICBmb3IgKGNvbnN0IGJpdCBvZiBiaXRzKSB7XG4gICAgICB0b3RhbCB8PSAodGhpcy5jb25zdHJ1Y3RvciBhcyB0eXBlb2YgQml0RmllbGQpLnJlc29sdmU8UywgTj4oYml0KSBhcyBiaWdpbnQ7XG4gICAgfVxuICAgICh0aGlzLmJpdGZpZWxkIGFzIGJpZ2ludCkgJj0gfnRvdGFsO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFNlcmlhbGl6ZSB0byBhcnJheSBvZiBmbGFnIG5hbWVzXG4gICAqL1xuICB0b0FycmF5KCk6IFNbXSB7XG4gICAgY29uc3QgZmxhZ3MgPSAodGhpcy5jb25zdHJ1Y3RvciBhcyB0eXBlb2YgQml0RmllbGQpLkZsYWdzO1xuICAgIGNvbnN0IHJlc3VsdDogU1tdID0gW107XG4gICAgXG4gICAgZm9yIChjb25zdCBbbmFtZSwgYml0XSBvZiBPYmplY3QuZW50cmllcyhmbGFncykpIHtcbiAgICAgIGlmICgodGhpcy5iaXRmaWVsZCBhcyBiaWdpbnQpICYgKGJpdCBhcyBiaWdpbnQpKSB7XG4gICAgICAgIHJlc3VsdC5wdXNoKG5hbWUgYXMgUyk7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvKipcbiAgICogU2VyaWFsaXplIHRvIEpTT05cbiAgICovXG4gIHRvSlNPTigpOiBzdHJpbmcgfCBudW1iZXIge1xuICAgIHJldHVybiB0eXBlb2YgdGhpcy5iaXRmaWVsZCA9PT0gJ2JpZ2ludCcgXG4gICAgICA/IHRoaXMuYml0ZmllbGQudG9TdHJpbmcoKSBcbiAgICAgIDogdGhpcy5iaXRmaWVsZDtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgc3RyaW5nIHJlcHJlc2VudGF0aW9uXG4gICAqL1xuICB0b1N0cmluZygpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLmJpdGZpZWxkLnRvU3RyaW5nKCk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGl0ZXJhdG9yXG4gICAqL1xuICAqW1N5bWJvbC5pdGVyYXRvcl0oKTogSXRlcmFibGVJdGVyYXRvcjxTPiB7XG4gICAgeWllbGQqIHRoaXMudG9BcnJheSgpO1xuICB9XG5cbiAgLyoqXG4gICAqIEZyZWV6ZSB0aGlzIGJpdGZpZWxkXG4gICAqL1xuICBmcmVlemUoKTogUmVhZG9ubHk8dGhpcz4ge1xuICAgIHJldHVybiBPYmplY3QuZnJlZXplKHRoaXMpO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrIGVxdWFsaXR5XG4gICAqL1xuICBlcXVhbHMob3RoZXI6IEJpdEZpZWxkUmVzb2x2YWJsZTxTLCBOPik6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLmJpdGZpZWxkID09PSAodGhpcy5jb25zdHJ1Y3RvciBhcyB0eXBlb2YgQml0RmllbGQpLnJlc29sdmU8UywgTj4ob3RoZXIpO1xuICB9XG5cbiAgLyoqXG4gICAqIENsb25lIHRoaXMgYml0ZmllbGRcbiAgICovXG4gIGNsb25lKCk6IEJpdEZpZWxkPFMsIE4+IHtcbiAgICByZXR1cm4gbmV3ICh0aGlzLmNvbnN0cnVjdG9yIGFzIG5ldyAoYml0czogTikgPT4gQml0RmllbGQ8UywgTj4pKHRoaXMuYml0ZmllbGQpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlc29sdmUgYSBiaXQgdG8gdGhlIG51bWVyaWMgdHlwZVxuICAgKi9cbiAgc3RhdGljIHJlc29sdmU8UyBleHRlbmRzIHN0cmluZywgTiBleHRlbmRzIGJpZ2ludCB8IG51bWJlcj4oYml0OiBCaXRGaWVsZFJlc29sdmFibGU8UywgTj4pOiBOIHtcbiAgICBpZiAodHlwZW9mIGJpdCA9PT0gJ2JpZ2ludCcgfHwgdHlwZW9mIGJpdCA9PT0gJ251bWJlcicpIHtcbiAgICAgIHJldHVybiBiaXQgYXMgTjtcbiAgICB9XG5cbiAgICBpZiAoYml0IGluc3RhbmNlb2YgQml0RmllbGQpIHtcbiAgICAgIHJldHVybiBiaXQuYml0ZmllbGQgYXMgTjtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIGJpdCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGNvbnN0IHJlc29sdmVkID0gdGhpcy5GbGFnc1tiaXRdO1xuICAgICAgaWYgKHJlc29sdmVkID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIGJpdDogJHtiaXR9YCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzb2x2ZWQgYXMgTjtcbiAgICB9XG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheShiaXQpKSB7XG4gICAgICBsZXQgcmVzdWx0ID0gdGhpcy5EZWZhdWx0Qml0IGFzIGJpZ2ludDtcbiAgICAgIGZvciAoY29uc3QgYiBvZiBiaXQpIHtcbiAgICAgICAgY29uc3QgcmVzb2x2ZWQgPSB0aGlzLnJlc29sdmU8UywgTj4oYik7XG4gICAgICAgIHJlc3VsdCB8PSByZXNvbHZlZCBhcyBiaWdpbnQ7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0IGFzIE47XG4gICAgfVxuXG4gICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGJpdDogJHtiaXR9YCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQml0RmllbGQ7XG4iXX0=