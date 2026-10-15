"use strict";
/**
 * Snowflake utilities
 * API compatible with Discord.js SnowflakeUtil
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SnowflakeUtil = void 0;
// Jubbio epoch (2022-01-01T00:00:00.000Z)
const EPOCH = 1640995200000n;
/**
 * A container for useful snowflake-related methods
 */
class SnowflakeUtil {
    /**
     * Jubbio's epoch value
     */
    static EPOCH = EPOCH;
    /**
     * Generates a snowflake ID
     * @param timestamp Timestamp or date to generate from
     */
    static generate(timestamp = Date.now()) {
        const time = timestamp instanceof Date ? timestamp.getTime() : timestamp;
        return ((BigInt(time) - EPOCH) << 22n).toString();
    }
    /**
     * Deconstructs a snowflake ID
     * @param snowflake Snowflake to deconstruct
     */
    static deconstruct(snowflake) {
        const bigIntSnowflake = BigInt(snowflake);
        return {
            timestamp: Number((bigIntSnowflake >> 22n) + EPOCH),
            get date() {
                return new Date(this.timestamp);
            },
            workerId: Number((bigIntSnowflake & 0x3e0000n) >> 17n),
            processId: Number((bigIntSnowflake & 0x1f000n) >> 12n),
            increment: Number(bigIntSnowflake & 0xfffn),
            binary: bigIntSnowflake.toString(2).padStart(64, '0'),
        };
    }
    /**
     * Retrieves the timestamp from a snowflake
     * @param snowflake Snowflake to get the timestamp from
     */
    static timestampFrom(snowflake) {
        return Number((BigInt(snowflake) >> 22n) + EPOCH);
    }
    /**
     * Retrieves the date from a snowflake
     * @param snowflake Snowflake to get the date from
     */
    static dateFrom(snowflake) {
        return new Date(SnowflakeUtil.timestampFrom(snowflake));
    }
    /**
     * Compares two snowflakes
     * @param a First snowflake
     * @param b Second snowflake
     * @returns -1 if a < b, 0 if a === b, 1 if a > b
     */
    static compare(a, b) {
        const bigA = BigInt(a);
        const bigB = BigInt(b);
        if (bigA < bigB)
            return -1;
        if (bigA > bigB)
            return 1;
        return 0;
    }
    /**
     * Checks if a value is a valid snowflake
     * @param value Value to check
     */
    static isValid(value) {
        if (typeof value !== 'string')
            return false;
        if (!/^\d{17,20}$/.test(value))
            return false;
        try {
            const timestamp = SnowflakeUtil.timestampFrom(value);
            return timestamp > Number(EPOCH) && timestamp < Date.now() + 1000 * 60 * 60 * 24 * 365; // Within reasonable range
        }
        catch {
            return false;
        }
    }
}
exports.SnowflakeUtil = SnowflakeUtil;
// Export as default too for convenience
exports.default = SnowflakeUtil;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU25vd2ZsYWtlVXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91dGlscy9Tbm93Zmxha2VVdGlsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7O0dBR0c7OztBQUVILDBDQUEwQztBQUMxQyxNQUFNLEtBQUssR0FBRyxjQUFjLENBQUM7QUFFN0I7O0dBRUc7QUFDSCxNQUFhLGFBQWE7SUFDeEI7O09BRUc7SUFDSCxNQUFNLENBQVUsS0FBSyxHQUFHLEtBQUssQ0FBQztJQUU5Qjs7O09BR0c7SUFDSCxNQUFNLENBQUMsUUFBUSxDQUFDLFlBQTJCLElBQUksQ0FBQyxHQUFHLEVBQUU7UUFDbkQsTUFBTSxJQUFJLEdBQUcsU0FBUyxZQUFZLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7UUFDekUsT0FBTyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLEtBQUssQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBQ3BELENBQUM7SUFFRDs7O09BR0c7SUFDSCxNQUFNLENBQUMsV0FBVyxDQUFDLFNBQWlCO1FBQ2xDLE1BQU0sZUFBZSxHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUMxQyxPQUFPO1lBQ0wsU0FBUyxFQUFFLE1BQU0sQ0FBQyxDQUFDLGVBQWUsSUFBSSxHQUFHLENBQUMsR0FBRyxLQUFLLENBQUM7WUFDbkQsSUFBSSxJQUFJO2dCQUNOLE9BQU8sSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ2xDLENBQUM7WUFDRCxRQUFRLEVBQUUsTUFBTSxDQUFDLENBQUMsZUFBZSxHQUFHLFNBQVMsQ0FBQyxJQUFJLEdBQUcsQ0FBQztZQUN0RCxTQUFTLEVBQUUsTUFBTSxDQUFDLENBQUMsZUFBZSxHQUFHLFFBQVEsQ0FBQyxJQUFJLEdBQUcsQ0FBQztZQUN0RCxTQUFTLEVBQUUsTUFBTSxDQUFDLGVBQWUsR0FBRyxNQUFNLENBQUM7WUFDM0MsTUFBTSxFQUFFLGVBQWUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLEVBQUUsRUFBRSxHQUFHLENBQUM7U0FDdEQsQ0FBQztJQUNKLENBQUM7SUFFRDs7O09BR0c7SUFDSCxNQUFNLENBQUMsYUFBYSxDQUFDLFNBQWlCO1FBQ3BDLE9BQU8sTUFBTSxDQUFDLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDO0lBQ3BELENBQUM7SUFFRDs7O09BR0c7SUFDSCxNQUFNLENBQUMsUUFBUSxDQUFDLFNBQWlCO1FBQy9CLE9BQU8sSUFBSSxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO0lBQzFELENBQUM7SUFFRDs7Ozs7T0FLRztJQUNILE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBUyxFQUFFLENBQVM7UUFDakMsTUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3ZCLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN2QixJQUFJLElBQUksR0FBRyxJQUFJO1lBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUMzQixJQUFJLElBQUksR0FBRyxJQUFJO1lBQUUsT0FBTyxDQUFDLENBQUM7UUFDMUIsT0FBTyxDQUFDLENBQUM7SUFDWCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFjO1FBQzNCLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUTtZQUFFLE9BQU8sS0FBSyxDQUFDO1FBQzVDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQztZQUFFLE9BQU8sS0FBSyxDQUFDO1FBQzdDLElBQUksQ0FBQztZQUNILE1BQU0sU0FBUyxHQUFHLGFBQWEsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDckQsT0FBTyxTQUFTLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLFNBQVMsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsSUFBSSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEdBQUcsQ0FBQyxDQUFDLDBCQUEwQjtRQUNwSCxDQUFDO1FBQUMsTUFBTSxDQUFDO1lBQ1AsT0FBTyxLQUFLLENBQUM7UUFDZixDQUFDO0lBQ0gsQ0FBQzs7QUE1RUgsc0NBNkVDO0FBb0JELHdDQUF3QztBQUN4QyxrQkFBZSxhQUFhLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogU25vd2ZsYWtlIHV0aWxpdGllc1xyXG4gKiBBUEkgY29tcGF0aWJsZSB3aXRoIERpc2NvcmQuanMgU25vd2ZsYWtlVXRpbFxyXG4gKi9cclxuXHJcbi8vIEp1YmJpbyBlcG9jaCAoMjAyMi0wMS0wMVQwMDowMDowMC4wMDBaKVxyXG5jb25zdCBFUE9DSCA9IDE2NDA5OTUyMDAwMDBuO1xyXG5cclxuLyoqXHJcbiAqIEEgY29udGFpbmVyIGZvciB1c2VmdWwgc25vd2ZsYWtlLXJlbGF0ZWQgbWV0aG9kc1xyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFNub3dmbGFrZVV0aWwge1xyXG4gIC8qKlxyXG4gICAqIEp1YmJpbydzIGVwb2NoIHZhbHVlXHJcbiAgICovXHJcbiAgc3RhdGljIHJlYWRvbmx5IEVQT0NIID0gRVBPQ0g7XHJcblxyXG4gIC8qKlxyXG4gICAqIEdlbmVyYXRlcyBhIHNub3dmbGFrZSBJRFxyXG4gICAqIEBwYXJhbSB0aW1lc3RhbXAgVGltZXN0YW1wIG9yIGRhdGUgdG8gZ2VuZXJhdGUgZnJvbVxyXG4gICAqL1xyXG4gIHN0YXRpYyBnZW5lcmF0ZSh0aW1lc3RhbXA6IG51bWJlciB8IERhdGUgPSBEYXRlLm5vdygpKTogc3RyaW5nIHtcclxuICAgIGNvbnN0IHRpbWUgPSB0aW1lc3RhbXAgaW5zdGFuY2VvZiBEYXRlID8gdGltZXN0YW1wLmdldFRpbWUoKSA6IHRpbWVzdGFtcDtcclxuICAgIHJldHVybiAoKEJpZ0ludCh0aW1lKSAtIEVQT0NIKSA8PCAyMm4pLnRvU3RyaW5nKCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZWNvbnN0cnVjdHMgYSBzbm93Zmxha2UgSURcclxuICAgKiBAcGFyYW0gc25vd2ZsYWtlIFNub3dmbGFrZSB0byBkZWNvbnN0cnVjdFxyXG4gICAqL1xyXG4gIHN0YXRpYyBkZWNvbnN0cnVjdChzbm93Zmxha2U6IHN0cmluZyk6IERlY29uc3RydWN0ZWRTbm93Zmxha2Uge1xyXG4gICAgY29uc3QgYmlnSW50U25vd2ZsYWtlID0gQmlnSW50KHNub3dmbGFrZSk7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICB0aW1lc3RhbXA6IE51bWJlcigoYmlnSW50U25vd2ZsYWtlID4+IDIybikgKyBFUE9DSCksXHJcbiAgICAgIGdldCBkYXRlKCkge1xyXG4gICAgICAgIHJldHVybiBuZXcgRGF0ZSh0aGlzLnRpbWVzdGFtcCk7XHJcbiAgICAgIH0sXHJcbiAgICAgIHdvcmtlcklkOiBOdW1iZXIoKGJpZ0ludFNub3dmbGFrZSAmIDB4M0UwMDAwbikgPj4gMTduKSxcclxuICAgICAgcHJvY2Vzc0lkOiBOdW1iZXIoKGJpZ0ludFNub3dmbGFrZSAmIDB4MUYwMDBuKSA+PiAxMm4pLFxyXG4gICAgICBpbmNyZW1lbnQ6IE51bWJlcihiaWdJbnRTbm93Zmxha2UgJiAweEZGRm4pLFxyXG4gICAgICBiaW5hcnk6IGJpZ0ludFNub3dmbGFrZS50b1N0cmluZygyKS5wYWRTdGFydCg2NCwgJzAnKSxcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZXRyaWV2ZXMgdGhlIHRpbWVzdGFtcCBmcm9tIGEgc25vd2ZsYWtlXHJcbiAgICogQHBhcmFtIHNub3dmbGFrZSBTbm93Zmxha2UgdG8gZ2V0IHRoZSB0aW1lc3RhbXAgZnJvbVxyXG4gICAqL1xyXG4gIHN0YXRpYyB0aW1lc3RhbXBGcm9tKHNub3dmbGFrZTogc3RyaW5nKTogbnVtYmVyIHtcclxuICAgIHJldHVybiBOdW1iZXIoKEJpZ0ludChzbm93Zmxha2UpID4+IDIybikgKyBFUE9DSCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZXRyaWV2ZXMgdGhlIGRhdGUgZnJvbSBhIHNub3dmbGFrZVxyXG4gICAqIEBwYXJhbSBzbm93Zmxha2UgU25vd2ZsYWtlIHRvIGdldCB0aGUgZGF0ZSBmcm9tXHJcbiAgICovXHJcbiAgc3RhdGljIGRhdGVGcm9tKHNub3dmbGFrZTogc3RyaW5nKTogRGF0ZSB7XHJcbiAgICByZXR1cm4gbmV3IERhdGUoU25vd2ZsYWtlVXRpbC50aW1lc3RhbXBGcm9tKHNub3dmbGFrZSkpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ29tcGFyZXMgdHdvIHNub3dmbGFrZXNcclxuICAgKiBAcGFyYW0gYSBGaXJzdCBzbm93Zmxha2VcclxuICAgKiBAcGFyYW0gYiBTZWNvbmQgc25vd2ZsYWtlXHJcbiAgICogQHJldHVybnMgLTEgaWYgYSA8IGIsIDAgaWYgYSA9PT0gYiwgMSBpZiBhID4gYlxyXG4gICAqL1xyXG4gIHN0YXRpYyBjb21wYXJlKGE6IHN0cmluZywgYjogc3RyaW5nKTogLTEgfCAwIHwgMSB7XHJcbiAgICBjb25zdCBiaWdBID0gQmlnSW50KGEpO1xyXG4gICAgY29uc3QgYmlnQiA9IEJpZ0ludChiKTtcclxuICAgIGlmIChiaWdBIDwgYmlnQikgcmV0dXJuIC0xO1xyXG4gICAgaWYgKGJpZ0EgPiBiaWdCKSByZXR1cm4gMTtcclxuICAgIHJldHVybiAwO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2hlY2tzIGlmIGEgdmFsdWUgaXMgYSB2YWxpZCBzbm93Zmxha2VcclxuICAgKiBAcGFyYW0gdmFsdWUgVmFsdWUgdG8gY2hlY2tcclxuICAgKi9cclxuICBzdGF0aWMgaXNWYWxpZCh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIHN0cmluZyB7XHJcbiAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykgcmV0dXJuIGZhbHNlO1xyXG4gICAgaWYgKCEvXlxcZHsxNywyMH0kLy50ZXN0KHZhbHVlKSkgcmV0dXJuIGZhbHNlO1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgdGltZXN0YW1wID0gU25vd2ZsYWtlVXRpbC50aW1lc3RhbXBGcm9tKHZhbHVlKTtcclxuICAgICAgcmV0dXJuIHRpbWVzdGFtcCA+IE51bWJlcihFUE9DSCkgJiYgdGltZXN0YW1wIDwgRGF0ZS5ub3coKSArIDEwMDAgKiA2MCAqIDYwICogMjQgKiAzNjU7IC8vIFdpdGhpbiByZWFzb25hYmxlIHJhbmdlXHJcbiAgICB9IGNhdGNoIHtcclxuICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIERlY29uc3RydWN0ZWQgc25vd2ZsYWtlIGRhdGFcclxuICovXHJcbmV4cG9ydCBpbnRlcmZhY2UgRGVjb25zdHJ1Y3RlZFNub3dmbGFrZSB7XHJcbiAgLyoqIFRpbWVzdGFtcCB0aGUgc25vd2ZsYWtlIHdhcyBjcmVhdGVkICovXHJcbiAgdGltZXN0YW1wOiBudW1iZXI7XHJcbiAgLyoqIERhdGUgdGhlIHNub3dmbGFrZSB3YXMgY3JlYXRlZCAqL1xyXG4gIGRhdGU6IERhdGU7XHJcbiAgLyoqIFdvcmtlciBJRCBpbiB0aGUgc25vd2ZsYWtlICovXHJcbiAgd29ya2VySWQ6IG51bWJlcjtcclxuICAvKiogUHJvY2VzcyBJRCBpbiB0aGUgc25vd2ZsYWtlICovXHJcbiAgcHJvY2Vzc0lkOiBudW1iZXI7XHJcbiAgLyoqIEluY3JlbWVudCBpbiB0aGUgc25vd2ZsYWtlICovXHJcbiAgaW5jcmVtZW50OiBudW1iZXI7XHJcbiAgLyoqIEJpbmFyeSByZXByZXNlbnRhdGlvbiBvZiB0aGUgc25vd2ZsYWtlICovXHJcbiAgYmluYXJ5OiBzdHJpbmc7XHJcbn1cclxuXHJcbi8vIEV4cG9ydCBhcyBkZWZhdWx0IHRvbyBmb3IgY29udmVuaWVuY2VcclxuZXhwb3J0IGRlZmF1bHQgU25vd2ZsYWtlVXRpbDtcclxuIl19