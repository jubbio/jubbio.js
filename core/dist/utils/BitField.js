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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQml0RmllbGQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdXRpbHMvQml0RmllbGQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7R0FHRzs7O0FBU0g7O0dBRUc7QUFDSCxNQUFhLFFBQVE7SUFDbkIsbUJBQW1CO0lBQ1osUUFBUSxDQUFJO0lBRW5CLHFEQUFxRDtJQUNyRCxNQUFNLENBQUMsS0FBSyxHQUFvQyxFQUFFLENBQUM7SUFFbkQsd0JBQXdCO0lBQ3hCLE1BQU0sQ0FBQyxVQUFVLEdBQW9CLEVBQUUsQ0FBQztJQUV4QyxZQUFZLE9BQWlDLFFBQVEsQ0FBQyxVQUFlO1FBQ25FLElBQUksQ0FBQyxRQUFRLEdBQUksSUFBSSxDQUFDLFdBQStCLENBQUMsT0FBTyxDQUFPLElBQUksQ0FBQyxDQUFDO0lBQzVFLENBQUM7SUFFRDs7T0FFRztJQUNILEdBQUcsQ0FBQyxHQUE2QjtRQUMvQixNQUFNLFFBQVEsR0FBSSxJQUFJLENBQUMsV0FBK0IsQ0FBQyxPQUFPLENBQU8sR0FBRyxDQUFDLENBQUM7UUFDMUUsT0FBTyxDQUFFLElBQUksQ0FBQyxRQUFtQixHQUFJLFFBQW1CLENBQUMsS0FBTSxRQUFtQixDQUFDO0lBQ3JGLENBQUM7SUFFRDs7T0FFRztJQUNILEdBQUcsQ0FBQyxJQUE4QjtRQUNoQyxNQUFNLFFBQVEsR0FBSSxJQUFJLENBQUMsV0FBK0IsQ0FBQyxPQUFPLENBQU8sSUFBSSxDQUFDLENBQUM7UUFDM0UsT0FBTyxDQUFFLElBQUksQ0FBQyxRQUFtQixHQUFJLFFBQW1CLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDbkUsQ0FBQztJQUVEOztPQUVHO0lBQ0gsR0FBRyxDQUFDLEdBQUcsSUFBZ0M7UUFDckMsSUFBSSxLQUFLLEdBQUcsRUFBRSxDQUFDO1FBQ2YsS0FBSyxNQUFNLEdBQUcsSUFBSSxJQUFJLEVBQUUsQ0FBQztZQUN2QixLQUFLLElBQUssSUFBSSxDQUFDLFdBQStCLENBQUMsT0FBTyxDQUFP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dkIsSUFBSSxNQUFNLEdBQUcsSUFBSSxDQUFDLFVBQW9CLENBQUM7WUFDdkMsS0FBSyxNQUFNLENBQUMsSUFBSSxHQUFHLEVBQUUsQ0FBQztnQkFDcEIsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBTyxDQUFDLENBQUMsQ0FBQztnQkFDdkMsTUFBTSxJQUFJLFFBQWtCLENBQUM7WUFDL0IsQ0FBQztZQUNELE9BQU8sTUFBVyxDQUFDO1FBQ3JCLENBQUM7UUFFRCxNQUFNLElBQUksS0FBSyxDQUFDLGdCQUFnQixHQUFHLEVBQUUsQ0FBQyxDQUFDO0lBQ3pDLENBQUM7O0FBaEpILDRCQWlKQztBQUVELGtCQUFlLFFBQVEsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBHZW5lcmljIEJpdEZpZWxkIGNsYXNzXHJcbiAqIEFQSSBjb21wYXRpYmxlIHdpdGggRGlzY29yZC5qcyBCaXRGaWVsZFxyXG4gKi9cclxuXHJcbmV4cG9ydCB0eXBlIEJpdEZpZWxkUmVzb2x2YWJsZTxTIGV4dGVuZHMgc3RyaW5nLCBOIGV4dGVuZHMgYmlnaW50IHwgbnVtYmVyPiA9IFxyXG4gIHwgTiBcclxuICB8IE5bXSBcclxuICB8IFMgXHJcbiAgfCBTW10gXHJcbiAgfCBCaXRGaWVsZDxTLCBOPjtcclxuXHJcbi8qKlxyXG4gKiBEYXRhIHN0cnVjdHVyZSBmb3IgYml0IGZpZWxkc1xyXG4gKi9cclxuZXhwb3J0IGNsYXNzIEJpdEZpZWxkPFMgZXh0ZW5kcyBzdHJpbmcgPSBzdHJpbmcsIE4gZXh0ZW5kcyBiaWdpbnQgfCBudW1iZXIgPSBiaWdpbnQ+IHtcclxuICAvKiogVGhlIHJhdyBiaXRzICovXHJcbiAgcHVibGljIGJpdGZpZWxkOiBOO1xyXG5cclxuICAvKiogRmxhZ3MgZm9yIHRoaXMgYml0ZmllbGQgKG92ZXJyaWRlIGluIHN1YmNsYXNzKSAqL1xyXG4gIHN0YXRpYyBGbGFnczogUmVjb3JkPHN0cmluZywgYmlnaW50IHwgbnVtYmVyPiA9IHt9O1xyXG5cclxuICAvKiogRGVmYXVsdCBiaXQgdmFsdWUgKi9cclxuICBzdGF0aWMgRGVmYXVsdEJpdDogYmlnaW50IHwgbnVtYmVyID0gMG47XHJcblxyXG4gIGNvbnN0cnVjdG9yKGJpdHM6IEJpdEZpZWxkUmVzb2x2YWJsZTxTLCBOPiA9IEJpdEZpZWxkLkRlZmF1bHRCaXQgYXMgTikge1xyXG4gICAgdGhpcy5iaXRmaWVsZCA9ICh0aGlzLmNvbnN0cnVjdG9yIGFzIHR5cGVvZiBCaXRGaWVsZCkucmVzb2x2ZTxTLCBOPihiaXRzKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENoZWNrIGlmIHRoaXMgYml0ZmllbGQgaGFzIGEgYml0XHJcbiAgICovXHJcbiAgaGFzKGJpdDogQml0RmllbGRSZXNvbHZhYmxlPFMsIE4+KTogYm9vbGVhbiB7XHJcbiAgICBjb25zdCByZXNvbHZlZCA9ICh0aGlzLmNvbnN0cnVjdG9yIGFzIHR5cGVvZiBCaXRGaWVsZCkucmVzb2x2ZTxTLCBOPihiaXQpO1xyXG4gICAgcmV0dXJuICgodGhpcy5iaXRmaWVsZCBhcyBiaWdpbnQpICYgKHJlc29sdmVkIGFzIGJpZ2ludCkpID09PSAocmVzb2x2ZWQgYXMgYmlnaW50KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENoZWNrIGlmIHRoaXMgYml0ZmllbGQgaGFzIGFueSBvZiB0aGUgYml0c1xyXG4gICAqL1xyXG4gIGFueShiaXRzOiBCaXRGaWVsZFJlc29sdmFibGU8UywgTj4pOiBib29sZWFuIHtcclxuICAgIGNvbnN0IHJlc29sdmVkID0gKHRoaXMuY29uc3RydWN0b3IgYXMgdHlwZW9mIEJpdEZpZWxkKS5yZXNvbHZlPFMsIE4+KGJpdHMpO1xyXG4gICAgcmV0dXJuICgodGhpcy5iaXRmaWVsZCBhcyBiaWdpbnQpICYgKHJlc29sdmVkIGFzIGJpZ2ludCkpICE9PSAwbjtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEFkZCBiaXRzIHRvIHRoaXMgYml0ZmllbGRcclxuICAgKi9cclxuICBhZGQoLi4uYml0czogQml0RmllbGRSZXNvbHZhYmxlPFMsIE4+W10pOiB0aGlzIHtcclxuICAgIGxldCB0b3RhbCA9IDBuO1xyXG4gICAgZm9yIChjb25zdCBiaXQgb2YgYml0cykge1xyXG4gICAgICB0b3RhbCB8PSAodGhpcy5jb25zdHJ1Y3RvciBhcyB0eXBlb2YgQml0RmllbGQpLnJlc29sdmU8UywgTj4oYml0KSBhcyBiaWdpbnQ7XHJcbiAgICB9XHJcbiAgICAodGhpcy5iaXRmaWVsZCBhcyBiaWdpbnQpIHw9IHRvdGFsO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZW1vdmUgYml0cyBmcm9tIHRoaXMgYml0ZmllbGRcclxuICAgKi9cclxuICByZW1vdmUoLi4uYml0czogQml0RmllbGRSZXNvbHZhYmxlPFMsIE4+W10pOiB0aGlzIHtcclxuICAgIGxldCB0b3RhbCA9IDBuO1xyXG4gICAgZm9yIChjb25zdCBiaXQgb2YgYml0cykge1xyXG4gICAgICB0b3RhbCB8PSAodGhpcy5jb25zdHJ1Y3RvciBhcyB0eXBlb2YgQml0RmllbGQpLnJlc29sdmU8UywgTj4oYml0KSBhcyBiaWdpbnQ7XHJcbiAgICB9XHJcbiAgICAodGhpcy5iaXRmaWVsZCBhcyBiaWdpbnQpICY9IH50b3RhbDtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2VyaWFsaXplIHRvIGFycmF5IG9mIGZsYWcgbmFtZXNcclxuICAgKi9cclxuICB0b0FycmF5KCk6IFNbXSB7XHJcbiAgICBjb25zdCBmbGFncyA9ICh0aGlzLmNvbnN0cnVjdG9yIGFzIHR5cGVvZiBCaXRGaWVsZCkuRmxhZ3M7XHJcbiAgICBjb25zdCByZXN1bHQ6IFNbXSA9IFtdO1xyXG4gICAgXHJcbiAgICBmb3IgKGNvbnN0IFtuYW1lLCBiaXRdIG9mIE9iamVjdC5lbnRyaWVzKGZsYWdzKSkge1xyXG4gICAgICBpZiAoKHRoaXMuYml0ZmllbGQgYXMgYmlnaW50KSAmIChiaXQgYXMgYmlnaW50KSkge1xyXG4gICAgICAgIHJlc3VsdC5wdXNoKG5hbWUgYXMgUyk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNlcmlhbGl6ZSB0byBKU09OXHJcbiAgICovXHJcbiAgdG9KU09OKCk6IHN0cmluZyB8IG51bWJlciB7XHJcbiAgICByZXR1cm4gdHlwZW9mIHRoaXMuYml0ZmllbGQgPT09ICdiaWdpbnQnIFxyXG4gICAgICA/IHRoaXMuYml0ZmllbGQudG9TdHJpbmcoKSBcclxuICAgICAgOiB0aGlzLmJpdGZpZWxkO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IHN0cmluZyByZXByZXNlbnRhdGlvblxyXG4gICAqL1xyXG4gIHRvU3RyaW5nKCk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gdGhpcy5iaXRmaWVsZC50b1N0cmluZygpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGl0ZXJhdG9yXHJcbiAgICovXHJcbiAgKltTeW1ib2wuaXRlcmF0b3JdKCk6IEl0ZXJhYmxlSXRlcmF0b3I8Uz4ge1xyXG4gICAgeWllbGQqIHRoaXMudG9BcnJheSgpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRnJlZXplIHRoaXMgYml0ZmllbGRcclxuICAgKi9cclxuICBmcmVlemUoKTogUmVhZG9ubHk8dGhpcz4ge1xyXG4gICAgcmV0dXJuIE9iamVjdC5mcmVlemUodGhpcyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDaGVjayBlcXVhbGl0eVxyXG4gICAqL1xyXG4gIGVxdWFscyhvdGhlcjogQml0RmllbGRSZXNvbHZhYmxlPFMsIE4+KTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gdGhpcy5iaXRmaWVsZCA9PT0gKHRoaXMuY29uc3RydWN0b3IgYXMgdHlwZW9mIEJpdEZpZWxkKS5yZXNvbHZlPFMsIE4+KG90aGVyKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENsb25lIHRoaXMgYml0ZmllbGRcclxuICAgKi9cclxuICBjbG9uZSgpOiBCaXRGaWVsZDxTLCBOPiB7XHJcbiAgICByZXR1cm4gbmV3ICh0aGlzLmNvbnN0cnVjdG9yIGFzIG5ldyAoYml0czogTikgPT4gQml0RmllbGQ8UywgTj4pKHRoaXMuYml0ZmllbGQpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVzb2x2ZSBhIGJpdCB0byB0aGUgbnVtZXJpYyB0eXBlXHJcbiAgICovXHJcbiAgc3RhdGljIHJlc29sdmU8UyBleHRlbmRzIHN0cmluZywgTiBleHRlbmRzIGJpZ2ludCB8IG51bWJlcj4oYml0OiBCaXRGaWVsZFJlc29sdmFibGU8UywgTj4pOiBOIHtcclxuICAgIGlmICh0eXBlb2YgYml0ID09PSAnYmlnaW50JyB8fCB0eXBlb2YgYml0ID09PSAnbnVtYmVyJykge1xyXG4gICAgICByZXR1cm4gYml0IGFzIE47XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGJpdCBpbnN0YW5jZW9mIEJpdEZpZWxkKSB7XHJcbiAgICAgIHJldHVybiBiaXQuYml0ZmllbGQgYXMgTjtcclxuICAgIH1cclxuXHJcbiAgICBpZiAodHlwZW9mIGJpdCA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgY29uc3QgcmVzb2x2ZWQgPSB0aGlzLkZsYWdzW2JpdF07XHJcbiAgICAgIGlmIChyZXNvbHZlZCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIGJpdDogJHtiaXR9YCk7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIHJlc29sdmVkIGFzIE47XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKEFycmF5LmlzQXJyYXkoYml0KSkge1xyXG4gICAgICBsZXQgcmVzdWx0ID0gdGhpcy5EZWZhdWx0Qml0IGFzIGJpZ2ludDtcclxuICAgICAgZm9yIChjb25zdCBiIG9mIGJpdCkge1xyXG4gICAgICAgIGNvbnN0IHJlc29sdmVkID0gdGhpcy5yZXNvbHZlPFMsIE4+KGIpO1xyXG4gICAgICAgIHJlc3VsdCB8PSByZXNvbHZlZCBhcyBiaWdpbnQ7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIHJlc3VsdCBhcyBOO1xyXG4gICAgfVxyXG5cclxuICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBiaXQ6ICR7Yml0fWApO1xyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgQml0RmllbGQ7XHJcbiJdfQ==