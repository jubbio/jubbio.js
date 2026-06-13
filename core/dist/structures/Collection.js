"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Collection = void 0;
/**
 * Extended Map with utility methods
 */
class Collection extends Map {
    /**
     * Discord.js compatibility — returns itself
     * Allows client.guilds.cache.get() to work
     */
    get cache() {
        return this;
    }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ29sbGVjdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zdHJ1Y3R1cmVzL0NvbGxlY3Rpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUE7O0dBRUc7QUFDSCxNQUFhLFVBQWlCLFNBQVEsR0FBUztJQUM3Qzs7O09BR0c7SUFDSCxJQUFJLEtBQUs7UUFDUCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUs7UUFDSCxPQUFPLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxLQUFLLENBQUM7SUFDcEMsQ0FBQztJQUVEOztPQUVHO0lBQ0gsSUFBSTtRQUNGLE1BQU0sR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztRQUMvQixPQUFPLEdBQUcsQ0FBQyxHQUFHLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQzdCLENBQUM7SUFFRDs7T0FFRztJQUNILE1BQU07UUFDSixNQUFNLEdBQUcsR0FBRyxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7UUFDL0IsT0FBTyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7SUFDckQsQ0FBQztJQUVEOztPQUVHO0lBQ0gsSUFBSSxDQUFDLEVBQW1EO1FBQ3RELEtBQUssTUFBTSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsSUFBSSxJQUFJLEVBQUUsQ0FBQztZQUM5QixJQUFJLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLElBQUksQ0FBQztnQkFBRSxPQUFPLEdBQUcsQ0FBQztRQUNyQyxDQUFDO1FBQ0QsT0FBTyxTQUFTLENBQUM7SUFDbkIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsTUFBTSxDQUFDLEVBQW1EO1FBQ3hELE1BQU0sT0FBTyxHQUFHLElBQUksVUFBVSxFQUFRLENBQUM7UUFDdkMsS0FBSyxNQUFNLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxJQUFJLElBQUksRUFBRSxDQUFDO1lBQzlCLElBQUksRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDO2dCQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ2hELENBQUM7UUFDRCxPQUFPLE9BQU8sQ0FBQztJQUNqQixDQUFDO0lBRUQ7O09BRUc7SUFDSCxHQUFHLENBQUksRUFBNkM7UUFDbEQsTUFBTSxPQUFPLEdBQVEsRUFBRSxDQUFDO1FBQ3hCLEtBQUssTUFBTSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsSUFBSSxJQUFJLEVBQUUsQ0FBQztZQUM5QixPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDbkMsQ0FBQztRQUNELE9BQU8sT0FBTyxDQUFDO0lBQ2pCLENBQUM7SUFFRDs7T0FFRztJQUNILElBQUksQ0FBQyxFQUFtRDtRQUN0RCxLQUFLLE1BQU0sQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLElBQUksSUFBSSxFQUFFLENBQUM7WUFDOUIsSUFBSSxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxJQUFJLENBQUM7Z0JBQUUsT0FBTyxJQUFJLENBQUM7UUFDdEMsQ0FBQztRQUNELE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLEVBQW1EO1FBQ3ZELEtBQUssTUFBTSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsSUFBSSxJQUFJLEVBQUUsQ0FBQztZQUM5QixJQUFJLENBQUMsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDO2dCQUFFLE9BQU8sS0FBSyxDQUFDO1FBQ3hDLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRDs7T0FFRztJQUNILE1BQU0sQ0FBSSxFQUE2RCxFQUFFLFlBQWU7UUFDdEYsSUFBSSxXQUFXLEdBQUcsWUFBWSxDQUFDO1FBQy9CLEtBQUssTUFBTSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsSUFBSSxJQUFJLEVBQUUsQ0FBQztZQUM5QixXQUFXLEdBQUcsRUFBRSxDQUFDLFdBQVcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ2hELENBQUM7UUFDRCxPQUFPLFdBQVcsQ0FBQztJQUNyQixDQUFDO0lBRUQ7O09BRUc7SUFDSCxPQUFPO1FBQ0wsT0FBTyxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7SUFDNUIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSztRQUNILE9BQU8sSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDOUIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsTUFBTSxDQUFDLEdBQUcsV0FBK0I7UUFDdkMsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQzdCLEtBQUssTUFBTSxJQUFJLElBQUksV0FBVyxFQUFFLENBQUM7WUFDL0IsS0FBSyxNQUFNLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxJQUFJLElBQUksRUFBRSxDQUFDO2dCQUM5QixPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQztZQUN4QixDQUFDO1FBQ0gsQ0FBQztRQUNELE9BQU8sT0FBTyxDQUFDO0lBQ2pCLENBQUM7Q0FDRjtBQXpIRCxnQ0F5SEMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogRXh0ZW5kZWQgTWFwIHdpdGggdXRpbGl0eSBtZXRob2RzXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgQ29sbGVjdGlvbjxLLCBWPiBleHRlbmRzIE1hcDxLLCBWPiB7XHJcbiAgLyoqXHJcbiAgICogRGlzY29yZC5qcyBjb21wYXRpYmlsaXR5IOKAlCByZXR1cm5zIGl0c2VsZlxyXG4gICAqIEFsbG93cyBjbGllbnQuZ3VpbGRzLmNhY2hlLmdldCgpIHRvIHdvcmtcclxuICAgKi9cclxuICBnZXQgY2FjaGUoKTogdGhpcyB7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCB0aGUgZmlyc3QgdmFsdWUgaW4gdGhlIGNvbGxlY3Rpb25cclxuICAgKi9cclxuICBmaXJzdCgpOiBWIHwgdW5kZWZpbmVkIHtcclxuICAgIHJldHVybiB0aGlzLnZhbHVlcygpLm5leHQoKS52YWx1ZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCB0aGUgbGFzdCB2YWx1ZSBpbiB0aGUgY29sbGVjdGlvblxyXG4gICAqL1xyXG4gIGxhc3QoKTogViB8IHVuZGVmaW5lZCB7XHJcbiAgICBjb25zdCBhcnIgPSBbLi4udGhpcy52YWx1ZXMoKV07XHJcbiAgICByZXR1cm4gYXJyW2Fyci5sZW5ndGggLSAxXTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhIHJhbmRvbSB2YWx1ZSBmcm9tIHRoZSBjb2xsZWN0aW9uXHJcbiAgICovXHJcbiAgcmFuZG9tKCk6IFYgfCB1bmRlZmluZWQge1xyXG4gICAgY29uc3QgYXJyID0gWy4uLnRoaXMudmFsdWVzKCldO1xyXG4gICAgcmV0dXJuIGFycltNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBhcnIubGVuZ3RoKV07XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBGaW5kIGEgdmFsdWUgbWF0Y2hpbmcgYSBwcmVkaWNhdGVcclxuICAgKi9cclxuICBmaW5kKGZuOiAodmFsdWU6IFYsIGtleTogSywgY29sbGVjdGlvbjogdGhpcykgPT4gYm9vbGVhbik6IFYgfCB1bmRlZmluZWQge1xyXG4gICAgZm9yIChjb25zdCBba2V5LCB2YWxdIG9mIHRoaXMpIHtcclxuICAgICAgaWYgKGZuKHZhbCwga2V5LCB0aGlzKSkgcmV0dXJuIHZhbDtcclxuICAgIH1cclxuICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBGaWx0ZXIgdmFsdWVzIG1hdGNoaW5nIGEgcHJlZGljYXRlXHJcbiAgICovXHJcbiAgZmlsdGVyKGZuOiAodmFsdWU6IFYsIGtleTogSywgY29sbGVjdGlvbjogdGhpcykgPT4gYm9vbGVhbik6IENvbGxlY3Rpb248SywgVj4ge1xyXG4gICAgY29uc3QgcmVzdWx0cyA9IG5ldyBDb2xsZWN0aW9uPEssIFY+KCk7XHJcbiAgICBmb3IgKGNvbnN0IFtrZXksIHZhbF0gb2YgdGhpcykge1xyXG4gICAgICBpZiAoZm4odmFsLCBrZXksIHRoaXMpKSByZXN1bHRzLnNldChrZXksIHZhbCk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gcmVzdWx0cztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIE1hcCB2YWx1ZXMgdG8gYSBuZXcgYXJyYXlcclxuICAgKi9cclxuICBtYXA8VD4oZm46ICh2YWx1ZTogViwga2V5OiBLLCBjb2xsZWN0aW9uOiB0aGlzKSA9PiBUKTogVFtdIHtcclxuICAgIGNvbnN0IHJlc3VsdHM6IFRbXSA9IFtdO1xyXG4gICAgZm9yIChjb25zdCBba2V5LCB2YWxdIG9mIHRoaXMpIHtcclxuICAgICAgcmVzdWx0cy5wdXNoKGZuKHZhbCwga2V5LCB0aGlzKSk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gcmVzdWx0cztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENoZWNrIGlmIHNvbWUgdmFsdWVzIG1hdGNoIGEgcHJlZGljYXRlXHJcbiAgICovXHJcbiAgc29tZShmbjogKHZhbHVlOiBWLCBrZXk6IEssIGNvbGxlY3Rpb246IHRoaXMpID0+IGJvb2xlYW4pOiBib29sZWFuIHtcclxuICAgIGZvciAoY29uc3QgW2tleSwgdmFsXSBvZiB0aGlzKSB7XHJcbiAgICAgIGlmIChmbih2YWwsIGtleSwgdGhpcykpIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2hlY2sgaWYgZXZlcnkgdmFsdWUgbWF0Y2hlcyBhIHByZWRpY2F0ZVxyXG4gICAqL1xyXG4gIGV2ZXJ5KGZuOiAodmFsdWU6IFYsIGtleTogSywgY29sbGVjdGlvbjogdGhpcykgPT4gYm9vbGVhbik6IGJvb2xlYW4ge1xyXG4gICAgZm9yIChjb25zdCBba2V5LCB2YWxdIG9mIHRoaXMpIHtcclxuICAgICAgaWYgKCFmbih2YWwsIGtleSwgdGhpcykpIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuICAgIHJldHVybiB0cnVlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVkdWNlIHRoZSBjb2xsZWN0aW9uIHRvIGEgc2luZ2xlIHZhbHVlXHJcbiAgICovXHJcbiAgcmVkdWNlPFQ+KGZuOiAoYWNjdW11bGF0b3I6IFQsIHZhbHVlOiBWLCBrZXk6IEssIGNvbGxlY3Rpb246IHRoaXMpID0+IFQsIGluaXRpYWxWYWx1ZTogVCk6IFQge1xyXG4gICAgbGV0IGFjY3VtdWxhdG9yID0gaW5pdGlhbFZhbHVlO1xyXG4gICAgZm9yIChjb25zdCBba2V5LCB2YWxdIG9mIHRoaXMpIHtcclxuICAgICAgYWNjdW11bGF0b3IgPSBmbihhY2N1bXVsYXRvciwgdmFsLCBrZXksIHRoaXMpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGFjY3VtdWxhdG9yO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ29udmVydCB0byBhcnJheVxyXG4gICAqL1xyXG4gIHRvQXJyYXkoKTogVltdIHtcclxuICAgIHJldHVybiBbLi4udGhpcy52YWx1ZXMoKV07XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDbG9uZSB0aGUgY29sbGVjdGlvblxyXG4gICAqL1xyXG4gIGNsb25lKCk6IENvbGxlY3Rpb248SywgVj4ge1xyXG4gICAgcmV0dXJuIG5ldyBDb2xsZWN0aW9uKHRoaXMpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ29uY2F0IHdpdGggYW5vdGhlciBjb2xsZWN0aW9uXHJcbiAgICovXHJcbiAgY29uY2F0KC4uLmNvbGxlY3Rpb25zOiBDb2xsZWN0aW9uPEssIFY+W10pOiBDb2xsZWN0aW9uPEssIFY+IHtcclxuICAgIGNvbnN0IG5ld0NvbGwgPSB0aGlzLmNsb25lKCk7XHJcbiAgICBmb3IgKGNvbnN0IGNvbGwgb2YgY29sbGVjdGlvbnMpIHtcclxuICAgICAgZm9yIChjb25zdCBba2V5LCB2YWxdIG9mIGNvbGwpIHtcclxuICAgICAgICBuZXdDb2xsLnNldChrZXksIHZhbCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiBuZXdDb2xsO1xyXG4gIH1cclxufVxyXG4iXX0=