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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU25vd2ZsYWtlVXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91dGlscy9Tbm93Zmxha2VVdGlsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7O0dBR0c7OztBQUVILDBDQUEwQztBQUMxQyxNQUFNLEtBQUssR0FBRyxjQUFjLENBQUM7QUFFN0I7O0dBRUc7QUFDSCxNQUFhLGFBQWE7SUFDeEI7O09BRUc7SUFDSCxNQUFNLENBQVUsS0FBSyxHQUFHLEtBQUssQ0FBQztJQUU5Qjs7O09BR0c7SUFDSCxNQUFNLENBQUMsUUFBUSxDQUFDLFlBQTJCLElBQUksQ0FBQyxHQUFHLEVBQUU7UUFDbkQsTUFBTSxJQUFJLEdBQUcsU0FBUyxZQUFZLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7UUFDekUsT0FBTyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLEtBQUssQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBQ3BELENBQUM7SUFFRDs7O09BR0c7SUFDSCxNQUFNLENBQUMsV0FBVyxDQUFDLFNBQWlCO1FBQ2xDLE1BQU0sZUFBZSxHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUMxQyxPQUFPO1lBQ0wsU0FBUyxFQUFFLE1BQU0sQ0FBQyxDQUFDLGVBQWUsSUFBSSxHQUFHLENBQUMsR0FBRyxLQUFLLENBQUM7WUFDbkQsSUFBSSxJQUFJO2dCQUNOLE9BQU8sSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ2xDLENBQUM7WUFDRCxRQUFRLEVBQUUsTUFBTSxDQUFDLENBQUMsZUFBZSxHQUFHLFNBQVMsQ0FBQyxJQUFJLEdBQUcsQ0FBQztZQUN0RCxTQUFTLEVBQUUsTUFBTSxDQUFDLENBQUMsZUFBZSxHQUFHLFFBQVEsQ0FBQyxJQUFJLEdBQUcsQ0FBQztZQUN0RCxTQUFTLEVBQUUsTUFBTSxDQUFDLGVBQWUsR0FBRyxNQUFNLENBQUM7WUFDM0MsTUFBTSxFQUFFLGVBQWUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLEVBQUUsRUFBRSxHQUFHLENBQUM7U0FDdEQsQ0FBQztJQUNKLENBQUM7SUFFRDs7O09BR0c7SUFDSCxNQUFNLENBQUMsYUFBYSxDQUFDLFNBQWlCO1FBQ3BDLE9BQU8sTUFBTSxDQUFDLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDO0lBQ3BELENBQUM7SUFFRDs7O09BR0c7SUFDSCxNQUFNLENBQUMsUUFBUSxDQUFDLFNBQWlCO1FBQy9CLE9BQU8sSUFBSSxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO0lBQzFELENBQUM7SUFFRDs7Ozs7T0FLRztJQUNILE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBUyxFQUFFLENBQVM7UUFDakMsTUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3ZCLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN2QixJQUFJLElBQUksR0FBRyxJQUFJO1lBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUMzQixJQUFJLElBQUksR0FBRyxJQUFJO1lBQUUsT0FBTyxDQUFDLENBQUM7UUFDMUIsT0FBTyxDQUFDLENBQUM7SUFDWCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFjO1FBQzNCLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUTtZQUFFLE9BQU8sS0FBSyxDQUFDO1FBQzVDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQztZQUFFLE9BQU8sS0FBSyxDQUFDO1FBQzdDLElBQUksQ0FBQztZQUNILE1BQU0sU0FBUyxHQUFHLGFBQWEsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDckQsT0FBTyxTQUFTLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLFNBQVMsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsSUFBSSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEdBQUcsQ0FBQyxDQUFDLDBCQUEwQjtRQUNwSCxDQUFDO1FBQUMsTUFBTSxDQUFDO1lBQ1AsT0FBTyxLQUFLLENBQUM7UUFDZixDQUFDO0lBQ0gsQ0FBQzs7QUE1RUgsc0NBNkVDO0FBb0JELHdDQUF3QztBQUN4QyxrQkFBZSxhQUFhLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFNub3dmbGFrZSB1dGlsaXRpZXNcbiAqIEFQSSBjb21wYXRpYmxlIHdpdGggRGlzY29yZC5qcyBTbm93Zmxha2VVdGlsXG4gKi9cblxuLy8gSnViYmlvIGVwb2NoICgyMDIyLTAxLTAxVDAwOjAwOjAwLjAwMFopXG5jb25zdCBFUE9DSCA9IDE2NDA5OTUyMDAwMDBuO1xuXG4vKipcbiAqIEEgY29udGFpbmVyIGZvciB1c2VmdWwgc25vd2ZsYWtlLXJlbGF0ZWQgbWV0aG9kc1xuICovXG5leHBvcnQgY2xhc3MgU25vd2ZsYWtlVXRpbCB7XG4gIC8qKlxuICAgKiBKdWJiaW8ncyBlcG9jaCB2YWx1ZVxuICAgKi9cbiAgc3RhdGljIHJlYWRvbmx5IEVQT0NIID0gRVBPQ0g7XG5cbiAgLyoqXG4gICAqIEdlbmVyYXRlcyBhIHNub3dmbGFrZSBJRFxuICAgKiBAcGFyYW0gdGltZXN0YW1wIFRpbWVzdGFtcCBvciBkYXRlIHRvIGdlbmVyYXRlIGZyb21cbiAgICovXG4gIHN0YXRpYyBnZW5lcmF0ZSh0aW1lc3RhbXA6IG51bWJlciB8IERhdGUgPSBEYXRlLm5vdygpKTogc3RyaW5nIHtcbiAgICBjb25zdCB0aW1lID0gdGltZXN0YW1wIGluc3RhbmNlb2YgRGF0ZSA/IHRpbWVzdGFtcC5nZXRUaW1lKCkgOiB0aW1lc3RhbXA7XG4gICAgcmV0dXJuICgoQmlnSW50KHRpbWUpIC0gRVBPQ0gpIDw8IDIybikudG9TdHJpbmcoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZWNvbnN0cnVjdHMgYSBzbm93Zmxha2UgSURcbiAgICogQHBhcmFtIHNub3dmbGFrZSBTbm93Zmxha2UgdG8gZGVjb25zdHJ1Y3RcbiAgICovXG4gIHN0YXRpYyBkZWNvbnN0cnVjdChzbm93Zmxha2U6IHN0cmluZyk6IERlY29uc3RydWN0ZWRTbm93Zmxha2Uge1xuICAgIGNvbnN0IGJpZ0ludFNub3dmbGFrZSA9IEJpZ0ludChzbm93Zmxha2UpO1xuICAgIHJldHVybiB7XG4gICAgICB0aW1lc3RhbXA6IE51bWJlcigoYmlnSW50U25vd2ZsYWtlID4+IDIybikgKyBFUE9DSCksXG4gICAgICBnZXQgZGF0ZSgpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBEYXRlKHRoaXMudGltZXN0YW1wKTtcbiAgICAgIH0sXG4gICAgICB3b3JrZXJJZDogTnVtYmVyKChiaWdJbnRTbm93Zmxha2UgJiAweDNFMDAwMG4pID4+IDE3biksXG4gICAgICBwcm9jZXNzSWQ6IE51bWJlcigoYmlnSW50U25vd2ZsYWtlICYgMHgxRjAwMG4pID4+IDEybiksXG4gICAgICBpbmNyZW1lbnQ6IE51bWJlcihiaWdJbnRTbm93Zmxha2UgJiAweEZGRm4pLFxuICAgICAgYmluYXJ5OiBiaWdJbnRTbm93Zmxha2UudG9TdHJpbmcoMikucGFkU3RhcnQoNjQsICcwJyksXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXRyaWV2ZXMgdGhlIHRpbWVzdGFtcCBmcm9tIGEgc25vd2ZsYWtlXG4gICAqIEBwYXJhbSBzbm93Zmxha2UgU25vd2ZsYWtlIHRvIGdldCB0aGUgdGltZXN0YW1wIGZyb21cbiAgICovXG4gIHN0YXRpYyB0aW1lc3RhbXBGcm9tKHNub3dmbGFrZTogc3RyaW5nKTogbnVtYmVyIHtcbiAgICByZXR1cm4gTnVtYmVyKChCaWdJbnQoc25vd2ZsYWtlKSA+PiAyMm4pICsgRVBPQ0gpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlcyB0aGUgZGF0ZSBmcm9tIGEgc25vd2ZsYWtlXG4gICAqIEBwYXJhbSBzbm93Zmxha2UgU25vd2ZsYWtlIHRvIGdldCB0aGUgZGF0ZSBmcm9tXG4gICAqL1xuICBzdGF0aWMgZGF0ZUZyb20oc25vd2ZsYWtlOiBzdHJpbmcpOiBEYXRlIHtcbiAgICByZXR1cm4gbmV3IERhdGUoU25vd2ZsYWtlVXRpbC50aW1lc3RhbXBGcm9tKHNub3dmbGFrZSkpO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbXBhcmVzIHR3byBzbm93Zmxha2VzXG4gICAqIEBwYXJhbSBhIEZpcnN0IHNub3dmbGFrZVxuICAgKiBAcGFyYW0gYiBTZWNvbmQgc25vd2ZsYWtlXG4gICAqIEByZXR1cm5zIC0xIGlmIGEgPCBiLCAwIGlmIGEgPT09IGIsIDEgaWYgYSA+IGJcbiAgICovXG4gIHN0YXRpYyBjb21wYXJlKGE6IHN0cmluZywgYjogc3RyaW5nKTogLTEgfCAwIHwgMSB7XG4gICAgY29uc3QgYmlnQSA9IEJpZ0ludChhKTtcbiAgICBjb25zdCBiaWdCID0gQmlnSW50KGIpO1xuICAgIGlmIChiaWdBIDwgYmlnQikgcmV0dXJuIC0xO1xuICAgIGlmIChiaWdBID4gYmlnQikgcmV0dXJuIDE7XG4gICAgcmV0dXJuIDA7XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2tzIGlmIGEgdmFsdWUgaXMgYSB2YWxpZCBzbm93Zmxha2VcbiAgICogQHBhcmFtIHZhbHVlIFZhbHVlIHRvIGNoZWNrXG4gICAqL1xuICBzdGF0aWMgaXNWYWxpZCh2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIHN0cmluZyB7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpIHJldHVybiBmYWxzZTtcbiAgICBpZiAoIS9eXFxkezE3LDIwfSQvLnRlc3QodmFsdWUpKSByZXR1cm4gZmFsc2U7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHRpbWVzdGFtcCA9IFNub3dmbGFrZVV0aWwudGltZXN0YW1wRnJvbSh2YWx1ZSk7XG4gICAgICByZXR1cm4gdGltZXN0YW1wID4gTnVtYmVyKEVQT0NIKSAmJiB0aW1lc3RhbXAgPCBEYXRlLm5vdygpICsgMTAwMCAqIDYwICogNjAgKiAyNCAqIDM2NTsgLy8gV2l0aGluIHJlYXNvbmFibGUgcmFuZ2VcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBEZWNvbnN0cnVjdGVkIHNub3dmbGFrZSBkYXRhXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRGVjb25zdHJ1Y3RlZFNub3dmbGFrZSB7XG4gIC8qKiBUaW1lc3RhbXAgdGhlIHNub3dmbGFrZSB3YXMgY3JlYXRlZCAqL1xuICB0aW1lc3RhbXA6IG51bWJlcjtcbiAgLyoqIERhdGUgdGhlIHNub3dmbGFrZSB3YXMgY3JlYXRlZCAqL1xuICBkYXRlOiBEYXRlO1xuICAvKiogV29ya2VyIElEIGluIHRoZSBzbm93Zmxha2UgKi9cbiAgd29ya2VySWQ6IG51bWJlcjtcbiAgLyoqIFByb2Nlc3MgSUQgaW4gdGhlIHNub3dmbGFrZSAqL1xuICBwcm9jZXNzSWQ6IG51bWJlcjtcbiAgLyoqIEluY3JlbWVudCBpbiB0aGUgc25vd2ZsYWtlICovXG4gIGluY3JlbWVudDogbnVtYmVyO1xuICAvKiogQmluYXJ5IHJlcHJlc2VudGF0aW9uIG9mIHRoZSBzbm93Zmxha2UgKi9cbiAgYmluYXJ5OiBzdHJpbmc7XG59XG5cbi8vIEV4cG9ydCBhcyBkZWZhdWx0IHRvbyBmb3IgY29udmVuaWVuY2VcbmV4cG9ydCBkZWZhdWx0IFNub3dmbGFrZVV0aWw7XG4iXX0=