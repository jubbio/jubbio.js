"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Collection = void 0;
/**
 * Extended Map with utility methods
 */
class Collection extends Map {
    /**
     * Get the first value in the collection
     */
    first() {
        return this.values().next().value;
    }
    /**
     * Get the last value in the collection
     */
    last() {
        const arr = [...this.values()];
        return arr[arr.length - 1];
    }
    /**
     * Get a random value from the collection
     */
    random() {
        const arr = [...this.values()];
        return arr[Math.floor(Math.random() * arr.length)];
    }
    /**
     * Find a value matching a predicate
     */
    find(fn) {
        for (const [key, val] of this) {
            if (fn(val, key, this))
                return val;
        }
        return undefined;
    }
    /**
     * Filter values matching a predicate
     */
    filter(fn) {
        const results = new Collection();
        for (const [key, val] of this) {
            if (fn(val, key, this))
                results.set(key, val);
        }
        return results;
    }
    /**
     * Map values to a new array
     */
    map(fn) {
        const results = [];
        for (const [key, val] of this) {
            results.push(fn(val, key, this));
        }
        return results;
    }
    /**
     * Check if some values match a predicate
     */
    some(fn) {
        for (const [key, val] of this) {
            if (fn(val, key, this))
                return true;
        }
        return false;
    }
    /**
     * Check if every value matches a predicate
     */
    every(fn) {
        for (const [key, val] of this) {
            if (!fn(val, key, this))
                return false;
        }
        return true;
    }
    /**
     * Reduce the collection to a single value
     */
    reduce(fn, initialValue) {
        let accumulator = initialValue;
        for (const [key, val] of this) {
            accumulator = fn(accumulator, val, key, this);
        }
        return accumulator;
    }
    /**
     * Convert to array
     */
    toArray() {
        return [...this.values()];
    }
    /**
     * Clone the collection
     */
    clone() {
        return new Collection(this);
    }
    /**
     * Concat with another collection
     */
    concat(...collections) {
        const newColl = this.clone();
        for (const coll of collections) {
            for (const [key, val] of coll) {
                newColl.set(key, val);
            }
        }
        return newColl;
    }
}
exports.Collection = Collection;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ29sbGVjdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zdHJ1Y3R1cmVzL0NvbGxlY3Rpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUE7O0dBRUc7QUFDSCxNQUFhLFVBQWlCLFNBQVEsR0FBUztJQUM3Qzs7T0FFRztJQUNILEtBQUs7UUFDSCxPQUFPLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxLQUFLLENBQUM7SUFDcEMsQ0FBQztJQUVEOztPQUVHO0lBQ0gsSUFBSTtRQUNGLE1BQU0sR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztRQUMvQixPQUFPLEdBQUcsQ0FBQyxHQUFHLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQzdCLENBQUM7SUFFRDs7T0FFRztJQUNILE1BQU07UUFDSixNQUFNLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7UUFDL0IsT0FBTyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7SUFDckQsQ0FBQztJQUVEOztPQUVHO0lBQ0gsSUFBSSxDQUFDLEVBQW1EO1FBQ3RELEtBQUssTUFBTSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsSUFBSSxJQUFJLEVBQUUsQ0FBQztZQUM5QixJQUFJLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLElBQUksQ0FBQztnQkFBRSxPQUFPLEdBQUcsQ0FBQztRQUNyQyxDQUFDO1FBQ0QsT0FBTyxTQUFTLENBQUM7SUFDbkIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsTUFBTSxDQUFDLEVBQW1EO1FBQ3hELE1BQU0sT0FBTyxHQUFHLElBQUksVUFBVSxFQUFRLENBQUM7UUFDdkMsS0FBSyxNQUFNLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxJQUFJLElBQUksRUFBRSxDQUFDO1lBQzlCLElBQUksRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDO2dCQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ2hELENBQUM7UUFDRCxPQUFPLE9BQU8sQ0FBQztJQUNqQixDQUFDO0lBRUQ7O09BRUc7SUFDSCxHQUFHLENBQUksRUFBNkM7UUFDbEQsTUFBTSxPQUFPLEdBQVEsRUFBRSxDQUFDO1FBQ3hCLEtBQUssTUFBTSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsSUFBSSxJQUFJLEVBQUUsQ0FBQztZQUM5QixPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDbkMsQ0FBQztRQUNELE9BQU8sT0FBTyxDQUFDO0lBQ2pCLENBQUM7SUFFRDs7T0FFRztJQUNILElBQUksQ0FBQyxFQUFtRDtRQUN0RCxLQUFLLE1BQU0sQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLElBQUksSUFBSSxFQUFFLENBQUM7WUFDOUIsSUFBSSxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxJQUFJLENBQUM7Z0JBQUUsT0FBTyxJQUFJLENBQUM7UUFDdEMsQ0FBQztRQUNELE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLEVBQW1EO1FBQ3ZELEtBQUssTUFBTSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsSUFBSSxJQUFJLEVBQUUsQ0FBQztZQUM5QixJQUFJLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDO2dCQUFFLE9BQU8sS0FBSyxDQUFDO1FBQ3hDLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRDs7T0FFRztJQUNILE1BQU0sQ0FBSSxFQUE2RCxFQUFFLFlBQWU7UUFDdEYsSUFBSSxXQUFXLEdBQUcsWUFBWSxDQUFDO1FBQy9CLEtBQUssTUFBTSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsSUFBSSxJQUFJLEVBQUUsQ0FBQztZQUM5QixXQUFXLEdBQUcsRUFBRSxDQUFDLFdBQVcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ2hELENBQUM7UUFDRCxPQUFPLFdBQVcsQ0FBQztJQUNyQixDQUFDO0lBRUQ7O09BRUc7SUFDSCxPQUFPO1FBQ0wsT0FBTyxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7SUFDNUIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSztRQUNILE9BQU8sSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDOUIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsTUFBTSxDQUFDLEdBQUcsV0FBK0I7UUFDdkMsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQzdCLEtBQUssTUFBTSxJQUFJLElBQUksV0FBVyxFQUFFLENBQUM7WUFDL0IsS0FBSyxNQUFNLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxJQUFJLElBQUksRUFBRSxDQUFDO2dCQUM5QixPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQztZQUN4QixDQUFDO1FBQ0gsQ0FBQztRQUNELE9BQU8sT0FBTyxDQUFDO0lBQ2pCLENBQUM7Q0FDRjtBQWpIRCxnQ0FpSEMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogRXh0ZW5kZWQgTWFwIHdpdGggdXRpbGl0eSBtZXRob2RzXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgQ29sbGVjdGlvbjxLLCBWPiBleHRlbmRzIE1hcDxLLCBWPiB7XHJcbiAgLyoqXHJcbiAgICogR2V0IHRoZSBmaXJzdCB2YWx1ZSBpbiB0aGUgY29sbGVjdGlvblxyXG4gICAqL1xyXG4gIGZpcnN0KCk6IFYgfCB1bmRlZmluZWQge1xyXG4gICAgcmV0dXJuIHRoaXMudmFsdWVzKCkubmV4dCgpLnZhbHVlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IHRoZSBsYXN0IHZhbHVlIGluIHRoZSBjb2xsZWN0aW9uXHJcbiAgICovXHJcbiAgbGFzdCgpOiBWIHwgdW5kZWZpbmVkIHtcclxuICAgIGNvbnN0IGFyciA9IFsuLi50aGlzLnZhbHVlcygpXTtcclxuICAgIHJldHVybiBhcnJbYXJyLmxlbmd0aCAtIDFdO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGEgcmFuZG9tIHZhbHVlIGZyb20gdGhlIGNvbGxlY3Rpb25cclxuICAgKi9cclxuICByYW5kb20oKTogViB8IHVuZGVmaW5lZCB7XHJcbiAgICBjb25zdCBhcnIgPSBbLi4udGhpcy52YWx1ZXMoKV07XHJcbiAgICByZXR1cm4gYXJyW01hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIGFyci5sZW5ndGgpXTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEZpbmQgYSB2YWx1ZSBtYXRjaGluZyBhIHByZWRpY2F0ZVxyXG4gICAqL1xyXG4gIGZpbmQoZm46ICh2YWx1ZTogViwga2V5OiBLLCBjb2xsZWN0aW9uOiB0aGlzKSA9PiBib29sZWFuKTogViB8IHVuZGVmaW5lZCB7XHJcbiAgICBmb3IgKGNvbnN0IFtrZXksIHZhbF0gb2YgdGhpcykge1xyXG4gICAgICBpZiAoZm4odmFsLCBrZXksIHRoaXMpKSByZXR1cm4gdmFsO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEZpbHRlciB2YWx1ZXMgbWF0Y2hpbmcgYSBwcmVkaWNhdGVcclxuICAgKi9cclxuICBmaWx0ZXIoZm46ICh2YWx1ZTogViwga2V5OiBLLCBjb2xsZWN0aW9uOiB0aGlzKSA9PiBib29sZWFuKTogQ29sbGVjdGlvbjxLLCBWPiB7XHJcbiAgICBjb25zdCByZXN1bHRzID0gbmV3IENvbGxlY3Rpb248SywgVj4oKTtcclxuICAgIGZvciAoY29uc3QgW2tleSwgdmFsXSBvZiB0aGlzKSB7XHJcbiAgICAgIGlmIChmbih2YWwsIGtleSwgdGhpcykpIHJlc3VsdHMuc2V0KGtleSwgdmFsKTtcclxuICAgIH1cclxuICAgIHJldHVybiByZXN1bHRzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogTWFwIHZhbHVlcyB0byBhIG5ldyBhcnJheVxyXG4gICAqL1xyXG4gIG1hcDxUPihmbjogKHZhbHVlOiBWLCBrZXk6IEssIGNvbGxlY3Rpb246IHRoaXMpID0+IFQpOiBUW10ge1xyXG4gICAgY29uc3QgcmVzdWx0czogVFtdID0gW107XHJcbiAgICBmb3IgKGNvbnN0IFtrZXksIHZhbF0gb2YgdGhpcykge1xyXG4gICAgICByZXN1bHRzLnB1c2goZm4odmFsLCBrZXksIHRoaXMpKTtcclxuICAgIH1cclxuICAgIHJldHVybiByZXN1bHRzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2hlY2sgaWYgc29tZSB2YWx1ZXMgbWF0Y2ggYSBwcmVkaWNhdGVcclxuICAgKi9cclxuICBzb21lKGZuOiAodmFsdWU6IFYsIGtleTogSywgY29sbGVjdGlvbjogdGhpcykgPT4gYm9vbGVhbik6IGJvb2xlYW4ge1xyXG4gICAgZm9yIChjb25zdCBba2V5LCB2YWxdIG9mIHRoaXMpIHtcclxuICAgICAgaWYgKGZuKHZhbCwga2V5LCB0aGlzKSkgcmV0dXJuIHRydWU7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gZmFsc2U7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDaGVjayBpZiBldmVyeSB2YWx1ZSBtYXRjaGVzIGEgcHJlZGljYXRlXHJcbiAgICovXHJcbiAgZXZlcnkoZm46ICh2YWx1ZTogViwga2V5OiBLLCBjb2xsZWN0aW9uOiB0aGlzKSA9PiBib29sZWFuKTogYm9vbGVhbiB7XHJcbiAgICBmb3IgKGNvbnN0IFtrZXksIHZhbF0gb2YgdGhpcykge1xyXG4gICAgICBpZiAoIWZuKHZhbCwga2V5LCB0aGlzKSkgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRydWU7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZWR1Y2UgdGhlIGNvbGxlY3Rpb24gdG8gYSBzaW5nbGUgdmFsdWVcclxuICAgKi9cclxuICByZWR1Y2U8VD4oZm46IChhY2N1bXVsYXRvcjogVCwgdmFsdWU6IFYsIGtleTogSywgY29sbGVjdGlvbjogdGhpcykgPT4gVCwgaW5pdGlhbFZhbHVlOiBUKTogVCB7XHJcbiAgICBsZXQgYWNjdW11bGF0b3IgPSBpbml0aWFsVmFsdWU7XHJcbiAgICBmb3IgKGNvbnN0IFtrZXksIHZhbF0gb2YgdGhpcykge1xyXG4gICAgICBhY2N1bXVsYXRvciA9IGZuKGFjY3VtdWxhdG9yLCB2YWwsIGtleSwgdGhpcyk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gYWNjdW11bGF0b3I7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDb252ZXJ0IHRvIGFycmF5XHJcbiAgICovXHJcbiAgdG9BcnJheSgpOiBWW10ge1xyXG4gICAgcmV0dXJuIFsuLi50aGlzLnZhbHVlcygpXTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENsb25lIHRoZSBjb2xsZWN0aW9uXHJcbiAgICovXHJcbiAgY2xvbmUoKTogQ29sbGVjdGlvbjxLLCBWPiB7XHJcbiAgICByZXR1cm4gbmV3IENvbGxlY3Rpb24odGhpcyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDb25jYXQgd2l0aCBhbm90aGVyIGNvbGxlY3Rpb25cclxuICAgKi9cclxuICBjb25jYXQoLi4uY29sbGVjdGlvbnM6IENvbGxlY3Rpb248SywgVj5bXSk6IENvbGxlY3Rpb248SywgVj4ge1xyXG4gICAgY29uc3QgbmV3Q29sbCA9IHRoaXMuY2xvbmUoKTtcclxuICAgIGZvciAoY29uc3QgY29sbCBvZiBjb2xsZWN0aW9ucykge1xyXG4gICAgICBmb3IgKGNvbnN0IFtrZXksIHZhbF0gb2YgY29sbCkge1xyXG4gICAgICAgIG5ld0NvbGwuc2V0KGtleSwgdmFsKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIG5ld0NvbGw7XHJcbiAgfVxyXG59XHJcbiJdfQ==