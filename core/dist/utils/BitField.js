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
    /** Cached array result */
    _cachedArray = null;
    /** Bitfield value at the time of caching */
    _bitfieldAtCache = null;
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
        // Invalidate cache
        this._cachedArray = null;
        this._bitfieldAtCache = null;
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
        // Invalidate cache
        this._cachedArray = null;
        this._bitfieldAtCache = null;
        return this;
    }
    /**
     * Serialize to array of flag names
     */
    toArray() {
        // Return cached result if bitfield hasn't changed
        if (this._cachedArray !== null && this._bitfieldAtCache === this.bitfield) {
            return [...this._cachedArray];
        }
        const flags = this.constructor.Flags;
        const result = [];
        for (const [name, bit] of Object.entries(flags)) {
            if (this.bitfield & bit) {
                result.push(name);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQml0RmllbGQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvdXRpbHMvQml0RmllbGQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7R0FHRzs7O0FBU0g7O0dBRUc7QUFDSCxNQUFhLFFBQVE7SUFDbkIsbUJBQW1CO0lBQ1osUUFBUSxDQUFJO0lBRW5CLDBCQUEwQjtJQUNsQixZQUFZLEdBQWUsSUFBSSxDQUFDO0lBRXhDLDRDQUE0QztJQUNwQyxnQkFBZ0IsR0FBYSxJQUFJLENBQUM7SUFFMUMscURBQXFEO0lBQ3JELE1BQU0sQ0FBQyxLQUFLLEdBQW9DLEVBQUUsQ0FBQztJQUVuRCx3QkFBd0I7SUFDeEIsTUFBTSxDQUFDLFVBQVUsR0FBb0IsRUFBRSxDQUFDO0lBRXhDLFlBQVksT0FBaUMsUUFBUSxDQUFDLFVBQWU7UUFDbkUsSUFBSSxDQUFDLFFBQVEsR0FBSSxJQUFJLENBQUMsV0FBK0IsQ0FBQyxPQUFPLENBQU8sSUFBSSxDQUFDLENBQUM7SUFDNUUsQ0FBQztJQUVEOztPQUVHO0lBQ0gsR0FBRyxDQUFDLEdBQTZCO1FBQy9CLE1BQU0sUUFBUSxHQUFJLElBQUksQ0FBQyxXQUErQixDQUFDLE9BQU8sQ0FBTyxHQUFHLENBQUMsQ0FBQztRQUMxRSxPQUFPLENBQUUsSUFBSSxDQUFDLFFBQW1CLEdBQUksUUFBbUIsQ0FBQyxLQUFNLFFBQW1CLENBQUM7SUFDckYsQ0FBQztJQUVEOztPQUVHO0lBQ0gsR0FBRyxDQUFDLElBQThCO1FBQ2hDLE1BQU0sUUFBUSxHQUFJLElBQUksQ0FBQyxXQUErQixDQUFDLE9BQU8sQ0FBTyxJQUFJLENBQUMsQ0FBQztRQUMzRSxPQUFPLENBQUUsSUFBSSxDQUFDLFFBQW1CLEdBQUksUUFBbUIsQ0FBQyxLQUFLLEVBQUUsQ0FBQztJQUNuRSxDQUFDO0lBRUQ7O09BRUc7SUFDSCxHQUFHLENBQUMsR0FBRyxJQUFnQztRQUNyQyxJQUFJLEtBQUssR0FBRyxFQUFFLENBQUM7UUFDZixL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QVEsQ0FBQyxDQUFDO0lBQ2xGLENBQUM7SUFFRDs7T0FFRztJQUNILE1BQU0sQ0FBQyxPQUFPLENBQThDLEdBQTZCO1FBQ3ZGLElBQUksT0FBTyxHQUFHLEtBQUssUUFBUSxJQUFJLE9BQU8sR0FBRyxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQ3ZELE9BQU8sR0FBUSxDQUFDO1FBQ2xCLENBQUM7UUFFRCxJQUFJLEdBQUcsWUFBWSxRQUFRLEVBQUUsQ0FBQztZQUM1QixPQUFPLEdBQUcsQ0FBQyxRQUFhLENBQUM7UUFDM0IsQ0FBQztRQUVELElBQUksT0FBTyxHQUFHLEtBQUssUUFBUSxFQUFFLENBQUM7WUFDNUIsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUNqQyxJQUFJLFFBQVEsS0FBSyxTQUFTLEVBQUUsQ0FBQztnQkFDM0IsTUFBTSxJQUFJLEtBQUssQ0FBQyxnQkFBZ0IsR0FBRyxFQUFFLENBQUMsQ0FBQztZQUN6QyxDQUFDO1lBQ0QsT0FBTyxRQUFhLENBQUM7UUFDdkIsQ0FBQztRQUVELElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQ3ZCLElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxVQUFvQixDQUFDO1lBQ3ZDLEtBQUssTUFBTSxDQUFDLElBQUksR0FBRyxFQUFFLENBQUM7Z0JBQ3BCLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQU8sQ0FBQyxDQUFDLENBQUM7Z0JBQ3ZDLE1BQU0sSUFBSSxRQUFrQixDQUFDO1lBQy9CLENBQUM7WUFDRCxPQUFPLE1BQVcsQ0FBQztRQUNyQixDQUFDO1FBRUQsTUFBTSxJQUFJLEtBQUssQ0FBQyxnQkFBZ0IsR0FBRyxFQUFFLENBQUMsQ0FBQztJQUN6QyxDQUFDOztBQXJLSCw0QkFzS0M7QUFFRCxrQkFBZSxRQUFRLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogR2VuZXJpYyBCaXRGaWVsZCBjbGFzc1xyXG4gKiBBUEkgY29tcGF0aWJsZSB3aXRoIERpc2NvcmQuanMgQml0RmllbGRcclxuICovXHJcblxyXG5leHBvcnQgdHlwZSBCaXRGaWVsZFJlc29sdmFibGU8UyBleHRlbmRzIHN0cmluZywgTiBleHRlbmRzIGJpZ2ludCB8IG51bWJlcj4gPSBcclxuICB8IE4gXHJcbiAgfCBOW10gXHJcbiAgfCBTIFxyXG4gIHwgU1tdIFxyXG4gIHwgQml0RmllbGQ8UywgTj47XHJcblxyXG4vKipcclxuICogRGF0YSBzdHJ1Y3R1cmUgZm9yIGJpdCBmaWVsZHNcclxuICovXHJcbmV4cG9ydCBjbGFzcyBCaXRGaWVsZDxTIGV4dGVuZHMgc3RyaW5nID0gc3RyaW5nLCBOIGV4dGVuZHMgYmlnaW50IHwgbnVtYmVyID0gYmlnaW50PiB7XHJcbiAgLyoqIFRoZSByYXcgYml0cyAqL1xyXG4gIHB1YmxpYyBiaXRmaWVsZDogTjtcclxuXHJcbiAgLyoqIENhY2hlZCBhcnJheSByZXN1bHQgKi9cclxuICBwcml2YXRlIF9jYWNoZWRBcnJheTogU1tdIHwgbnVsbCA9IG51bGw7XHJcbiAgXHJcbiAgLyoqIEJpdGZpZWxkIHZhbHVlIGF0IHRoZSB0aW1lIG9mIGNhY2hpbmcgKi9cclxuICBwcml2YXRlIF9iaXRmaWVsZEF0Q2FjaGU6IE4gfCBudWxsID0gbnVsbDtcclxuXHJcbiAgLyoqIEZsYWdzIGZvciB0aGlzIGJpdGZpZWxkIChvdmVycmlkZSBpbiBzdWJjbGFzcykgKi9cclxuICBzdGF0aWMgRmxhZ3M6IFJlY29yZDxzdHJpbmcsIGJpZ2ludCB8IG51bWJlcj4gPSB7fTtcclxuXHJcbiAgLyoqIERlZmF1bHQgYml0IHZhbHVlICovXHJcbiAgc3RhdGljIERlZmF1bHRCaXQ6IGJpZ2ludCB8IG51bWJlciA9IDBuO1xyXG5cclxuICBjb25zdHJ1Y3RvcihiaXRzOiBCaXRGaWVsZFJlc29sdmFibGU8UywgTj4gPSBCaXRGaWVsZC5EZWZhdWx0Qml0IGFzIE4pIHtcclxuICAgIHRoaXMuYml0ZmllbGQgPSAodGhpcy5jb25zdHJ1Y3RvciBhcyB0eXBlb2YgQml0RmllbGQpLnJlc29sdmU8UywgTj4oYml0cyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDaGVjayBpZiB0aGlzIGJpdGZpZWxkIGhhcyBhIGJpdFxyXG4gICAqL1xyXG4gIGhhcyhiaXQ6IEJpdEZpZWxkUmVzb2x2YWJsZTxTLCBOPik6IGJvb2xlYW4ge1xyXG4gICAgY29uc3QgcmVzb2x2ZWQgPSAodGhpcy5jb25zdHJ1Y3RvciBhcyB0eXBlb2YgQml0RmllbGQpLnJlc29sdmU8UywgTj4oYml0KTtcclxuICAgIHJldHVybiAoKHRoaXMuYml0ZmllbGQgYXMgYmlnaW50KSAmIChyZXNvbHZlZCBhcyBiaWdpbnQpKSA9PT0gKHJlc29sdmVkIGFzIGJpZ2ludCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDaGVjayBpZiB0aGlzIGJpdGZpZWxkIGhhcyBhbnkgb2YgdGhlIGJpdHNcclxuICAgKi9cclxuICBhbnkoYml0czogQml0RmllbGRSZXNvbHZhYmxlPFMsIE4+KTogYm9vbGVhbiB7XHJcbiAgICBjb25zdCByZXNvbHZlZCA9ICh0aGlzLmNvbnN0cnVjdG9yIGFzIHR5cGVvZiBCaXRGaWVsZCkucmVzb2x2ZTxTLCBOPihiaXRzKTtcclxuICAgIHJldHVybiAoKHRoaXMuYml0ZmllbGQgYXMgYmlnaW50KSAmIChyZXNvbHZlZCBhcyBiaWdpbnQpKSAhPT0gMG47XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBZGQgYml0cyB0byB0aGlzIGJpdGZpZWxkXHJcbiAgICovXHJcbiAgYWRkKC4uLmJpdHM6IEJpdEZpZWxkUmVzb2x2YWJsZTxTLCBOPltdKTogdGhpcyB7XHJcbiAgICBsZXQgdG90YWwgPSAwbjtcclxuICAgIGZvciAoY29uc3QgYml0IG9mIGJpdHMpIHtcclxuICAgICAgdG90YWwgfD0gKHRoaXMuY29uc3RydWN0b3IgYXMgdHlwZW9mIEJpdEZpZWxkKS5yZXNvbHZlPFMsIE4+KGJpdCkgYXMgYmlnaW50O1xyXG4gICAgfVxyXG4gICAgKHRoaXMuYml0ZmllbGQgYXMgYmlnaW50KSB8PSB0b3RhbDtcclxuICAgIC8vIEludmFsaWRhdGUgY2FjaGVcclxuICAgIHRoaXMuX2NhY2hlZEFycmF5ID0gbnVsbDtcclxuICAgIHRoaXMuX2JpdGZpZWxkQXRDYWNoZSA9IG51bGw7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlbW92ZSBiaXRzIGZyb20gdGhpcyBiaXRmaWVsZFxyXG4gICAqL1xyXG4gIHJlbW92ZSguLi5iaXRzOiBCaXRGaWVsZFJlc29sdmFibGU8UywgTj5bXSk6IHRoaXMge1xyXG4gICAgbGV0IHRvdGFsID0gMG47XHJcbiAgICBmb3IgKGNvbnN0IGJpdCBvZiBiaXRzKSB7XHJcbiAgICAgIHRvdGFsIHw9ICh0aGlzLmNvbnN0cnVjdG9yIGFzIHR5cGVvZiBCaXRGaWVsZCkucmVzb2x2ZTxTLCBOPihiaXQpIGFzIGJpZ2ludDtcclxuICAgIH1cclxuICAgICh0aGlzLmJpdGZpZWxkIGFzIGJpZ2ludCkgJj0gfnRvdGFsO1xyXG4gICAgLy8gSW52YWxpZGF0ZSBjYWNoZVxyXG4gICAgdGhpcy5fY2FjaGVkQXJyYXkgPSBudWxsO1xyXG4gICAgdGhpcy5fYml0ZmllbGRBdENhY2hlID0gbnVsbDtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2VyaWFsaXplIHRvIGFycmF5IG9mIGZsYWcgbmFtZXNcclxuICAgKi9cclxuICB0b0FycmF5KCk6IFNbXSB7XHJcbiAgICAvLyBSZXR1cm4gY2FjaGVkIHJlc3VsdCBpZiBiaXRmaWVsZCBoYXNuJ3QgY2hhbmdlZFxyXG4gICAgaWYgKHRoaXMuX2NhY2hlZEFycmF5ICE9PSBudWxsICYmIHRoaXMuX2JpdGZpZWxkQXRDYWNoZSA9PT0gdGhpcy5iaXRmaWVsZCkge1xyXG4gICAgICByZXR1cm4gWy4uLnRoaXMuX2NhY2hlZEFycmF5XTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgY29uc3QgZmxhZ3MgPSAodGhpcy5jb25zdHJ1Y3RvciBhcyB0eXBlb2YgQml0RmllbGQpLkZsYWdzO1xyXG4gICAgY29uc3QgcmVzdWx0OiBTW10gPSBbXTtcclxuICAgIFxyXG4gICAgZm9yIChjb25zdCBbbmFtZSwgYml0XSBvZiBPYmplY3QuZW50cmllcyhmbGFncykpIHtcclxuICAgICAgaWYgKCh0aGlzLmJpdGZpZWxkIGFzIGJpZ2ludCkgJiAoYml0IGFzIGJpZ2ludCkpIHtcclxuICAgICAgICByZXN1bHQucHVzaChuYW1lIGFzIFMpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIENhY2hlIHRoZSByZXN1bHRcclxuICAgIHRoaXMuX2NhY2hlZEFycmF5ID0gcmVzdWx0O1xyXG4gICAgdGhpcy5fYml0ZmllbGRBdENhY2hlID0gdGhpcy5iaXRmaWVsZDtcclxuICAgIFxyXG4gICAgcmV0dXJuIFsuLi5yZXN1bHRdO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2VyaWFsaXplIHRvIEpTT05cclxuICAgKi9cclxuICB0b0pTT04oKTogc3RyaW5nIHwgbnVtYmVyIHtcclxuICAgIHJldHVybiB0eXBlb2YgdGhpcy5iaXRmaWVsZCA9PT0gJ2JpZ2ludCcgXHJcbiAgICAgID8gdGhpcy5iaXRmaWVsZC50b1N0cmluZygpIFxyXG4gICAgICA6IHRoaXMuYml0ZmllbGQ7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgc3RyaW5nIHJlcHJlc2VudGF0aW9uXHJcbiAgICovXHJcbiAgdG9TdHJpbmcoKTogc3RyaW5nIHtcclxuICAgIHJldHVybiB0aGlzLmJpdGZpZWxkLnRvU3RyaW5nKCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgaXRlcmF0b3JcclxuICAgKi9cclxuICAqW1N5bWJvbC5pdGVyYXRvcl0oKTogSXRlcmFibGVJdGVyYXRvcjxTPiB7XHJcbiAgICB5aWVsZCogdGhpcy50b0FycmF5KCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBGcmVlemUgdGhpcyBiaXRmaWVsZFxyXG4gICAqL1xyXG4gIGZyZWV6ZSgpOiBSZWFkb25seTx0aGlzPiB7XHJcbiAgICByZXR1cm4gT2JqZWN0LmZyZWV6ZSh0aGlzKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENoZWNrIGVxdWFsaXR5XHJcbiAgICovXHJcbiAgZXF1YWxzKG90aGVyOiBCaXRGaWVsZFJlc29sdmFibGU8UywgTj4pOiBib29sZWFuIHtcclxuICAgIHJldHVybiB0aGlzLmJpdGZpZWxkID09PSAodGhpcy5jb25zdHJ1Y3RvciBhcyB0eXBlb2YgQml0RmllbGQpLnJlc29sdmU8UywgTj4ob3RoZXIpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2xvbmUgdGhpcyBiaXRmaWVsZFxyXG4gICAqL1xyXG4gIGNsb25lKCk6IEJpdEZpZWxkPFMsIE4+IHtcclxuICAgIHJldHVybiBuZXcgKHRoaXMuY29uc3RydWN0b3IgYXMgbmV3IChiaXRzOiBOKSA9PiBCaXRGaWVsZDxTLCBOPikodGhpcy5iaXRmaWVsZCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZXNvbHZlIGEgYml0IHRvIHRoZSBudW1lcmljIHR5cGVcclxuICAgKi9cclxuICBzdGF0aWMgcmVzb2x2ZTxTIGV4dGVuZHMgc3RyaW5nLCBOIGV4dGVuZHMgYmlnaW50IHwgbnVtYmVyPihiaXQ6IEJpdEZpZWxkUmVzb2x2YWJsZTxTLCBOPik6IE4ge1xyXG4gICAgaWYgKHR5cGVvZiBiaXQgPT09ICdiaWdpbnQnIHx8IHR5cGVvZiBiaXQgPT09ICdudW1iZXInKSB7XHJcbiAgICAgIHJldHVybiBiaXQgYXMgTjtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoYml0IGluc3RhbmNlb2YgQml0RmllbGQpIHtcclxuICAgICAgcmV0dXJuIGJpdC5iaXRmaWVsZCBhcyBOO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICh0eXBlb2YgYml0ID09PSAnc3RyaW5nJykge1xyXG4gICAgICBjb25zdCByZXNvbHZlZCA9IHRoaXMuRmxhZ3NbYml0XTtcclxuICAgICAgaWYgKHJlc29sdmVkID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gYml0OiAke2JpdH1gKTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gcmVzb2x2ZWQgYXMgTjtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoQXJyYXkuaXNBcnJheShiaXQpKSB7XHJcbiAgICAgIGxldCByZXN1bHQgPSB0aGlzLkRlZmF1bHRCaXQgYXMgYmlnaW50O1xyXG4gICAgICBmb3IgKGNvbnN0IGIgb2YgYml0KSB7XHJcbiAgICAgICAgY29uc3QgcmVzb2x2ZWQgPSB0aGlzLnJlc29sdmU8UywgTj4oYik7XHJcbiAgICAgICAgcmVzdWx0IHw9IHJlc29sdmVkIGFzIGJpZ2ludDtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gcmVzdWx0IGFzIE47XHJcbiAgICB9XHJcblxyXG4gICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGJpdDogJHtiaXR9YCk7XHJcbiAgfVxyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBCaXRGaWVsZDtcclxuIl19