"use strict";
/**
 * Snowflake utilities
 * API compatible with Discord.js SnowflakeUtil
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SnowflakeUtil = void 0;
// Jubbio epoch (same as Discord: 2015-01-01T00:00:00.000Z)
const EPOCH = 1420070400000n;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU25vd2ZsYWtlVXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91dGlscy9Tbm93Zmxha2VVdGlsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7O0dBR0c7OztBQUVILDJEQUEyRDtBQUMzRCxNQUFNLEtBQUssR0FBRyxjQUFjLENBQUM7QUFFN0I7O0dBRUc7QUFDSCxNQUFhLGFBQWE7SUFDeEI7O09BRUc7SUFDSCxNQUFNLENBQVUsS0FBSyxHQUFHLEtBQUssQ0FBQztJQUU5Qjs7O09BR0c7SUFDSCxNQUFNLENBQUMsUUFBUSxDQUFDLFlBQTJCLElBQUksQ0FBQyxHQUFHLEVBQUU7UUFDbkQsTUFBTSxJQUFJLEdBQUcsU0FBUyxZQUFZLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7UUFDekUsT0FBTyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLEtBQUssQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBQ3BELENBQUM7SUFFRDs7O09BR0c7SUFDSCxNQUFNLENBQUMsV0FBVyxDQUFDLFNBQWlCO1FBQ2xDLE1BQU0sZUFBZSxHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUMxQyxPQUFPO1lBQ0wsU0FBUyxFQUFFLE1BQU0sQ0FBQyxDQUFDLGVBQWUsSUFBSSxHQUFHLENBQUMsR0FBRyxLQUFLLENBQUM7WUFDbkQsSUFBSSxJQUFJO2dCQUNOLE9BQU8sSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ2xDLENBQUM7WUFDRCxRQUFRLEVBQUUsTUFBTSxDQUFDLENBQUMsZUFBZSxHQUFHLFNBQVMsQ0FBQyxJQUFJLEdBQUcsQ0FBQztZQUN0RCxTQUFTLEVBQUUsTUFBTSxDQUFDLENBQUMsZUFBZSxHQUFHLFFBQVEsQ0FBQyxJQUFJLEdBQUcsQ0FBQztZQUN0RCxTQUFTLEVBQUUsTUFBTSxDQUFDLGVBQWUsR0FBRyxNQUFNLENBQUM7WUFDM0MsTUFBTSxFQUFFLGVBQWUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLEVBQUUsRUFBRSxHQUFHLENBQUM7U0FDdEQsQ0FBQztJQUNKLENBQUM7SUFFRDs7O09BR0c7SUFDSCxNQUFNLENBQUMsYUFBYSxDQUFDLFNBQWlCO1FBQ3BDLE9BQU8sTUFBTSxDQUFDLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDO0lBQ3BELENBQUM7SUFFRDs7O09BR0c7SUFDSCxNQUFNLENBQUMsUUFBUSxDQUFDLFNBQWlCO1FBQy9CLE9BQU8sSUFBSSxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO0lBQzFELENBQUM7SUFFRDs7Ozs7T0FLRztJQUNILE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBUyxFQUFFLENBQVM7UUFDakMsTUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3ZCLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN2QixJQUFJLElBQUksR0FBRyxJQUFJO1lBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUMzQixJQUFJLElBQUksR0FBRyxJQUFJO1lBQUUsT0FBTyxDQUFDLENBQUM7UUFDMUIsT0FBTyxDQUFDLENBQUM7SUFDWCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFjO1FBQzNCLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUTtZQUFFLE9BQU8sS0FBSyxDQUFDO1FBQzVDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQztZQUFFLE9BQU8sS0FBSyxDQUFDO1FBQzdDLElBQUksQ0FBQztZQUNILE1BQU0sU0FBUyxHQUFHLGFBQWEsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDckQsT0FBTyxTQUFTLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLFNBQVMsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsSUFBSSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEdBQUcsQ0FBQyxDQUFDLDBCQUEwQjtRQUNwSCxDQUFDO1FBQUMsTUFBTSxDQUFDO1lBQ1AsT0FBTyxLQUFLLENBQUM7UUFDZixDQUFDO0lBQ0gsQ0FBQzs7QUE1RUgsc0NBNkVDO0FBb0JELHdDQUF3QztBQUN4QyxrQkFBZSxhQUFhLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFNub3dmbGFrZSB1dGlsaXRpZXNcbiAqIEFQSSBjb21wYXRpYmxlIHdpdGggRGlzY29yZC5qcyBTbm93Zmxha2VVdGlsXG4gKi9cblxuLy8gSnViYmlvIGVwb2NoIChzYW1lIGFzIERpc2NvcmQ6IDIwMTUtMDEtMDFUMDA6MDA6MDAuMDAwWilcbmNvbnN0IEVQT0NIID0gMTQyMDA3MDQwMDAwMG47XG5cbi8qKlxuICogQSBjb250YWluZXIgZm9yIHVzZWZ1bCBzbm93Zmxha2UtcmVsYXRlZCBtZXRob2RzXG4gKi9cbmV4cG9ydCBjbGFzcyBTbm93Zmxha2VVdGlsIHtcbiAgLyoqXG4gICAqIEp1YmJpbydzIGVwb2NoIHZhbHVlXG4gICAqL1xuICBzdGF0aWMgcmVhZG9ubHkgRVBPQ0ggPSBFUE9DSDtcblxuICAvKipcbiAgICogR2VuZXJhdGVzIGEgc25vd2ZsYWtlIElEXG4gICAqIEBwYXJhbSB0aW1lc3RhbXAgVGltZXN0YW1wIG9yIGRhdGUgdG8gZ2VuZXJhdGUgZnJvbVxuICAgKi9cbiAgc3RhdGljIGdlbmVyYXRlKHRpbWVzdGFtcDogbnVtYmVyIHwgRGF0ZSA9IERhdGUubm93KCkpOiBzdHJpbmcge1xuICAgIGNvbnN0IHRpbWUgPSB0aW1lc3RhbXAgaW5zdGFuY2VvZiBEYXRlID8gdGltZXN0YW1wLmdldFRpbWUoKSA6IHRpbWVzdGFtcDtcbiAgICByZXR1cm4gKChCaWdJbnQodGltZSkgLSBFUE9DSCkgPDwgMjJuKS50b1N0cmluZygpO1xuICB9XG5cbiAgLyoqXG4gICAqIERlY29uc3RydWN0cyBhIHNub3dmbGFrZSBJRFxuICAgKiBAcGFyYW0gc25vd2ZsYWtlIFNub3dmbGFrZSB0byBkZWNvbnN0cnVjdFxuICAgKi9cbiAgc3RhdGljIGRlY29uc3RydWN0KHNub3dmbGFrZTogc3RyaW5nKTogRGVjb25zdHJ1Y3RlZFNub3dmbGFrZSB7XG4gICAgY29uc3QgYmlnSW50U25vd2ZsYWtlID0gQmlnSW50KHNub3dmbGFrZSk7XG4gICAgcmV0dXJuIHtcbiAgICAgIHRpbWVzdGFtcDogTnVtYmVyKChiaWdJbnRTbm93Zmxha2UgPj4gMjJuKSArIEVQT0NIKSxcbiAgICAgIGdldCBkYXRlKCkge1xuICAgICAgICByZXR1cm4gbmV3IERhdGUodGhpcy50aW1lc3RhbXApO1xuICAgICAgfSxcbiAgICAgIHdvcmtlcklkOiBOdW1iZXIoKGJpZ0ludFNub3dmbGFrZSAmIDB4M0UwMDAwbikgPj4gMTduKSxcbiAgICAgIHByb2Nlc3NJZDogTnVtYmVyKChiaWdJbnRTbm93Zmxha2UgJiAweDFGMDAwbikgPj4gMTJuKSxcbiAgICAgIGluY3JlbWVudDogTnVtYmVyKGJpZ0ludFNub3dmbGFrZSAmIDB4RkZGbiksXG4gICAgICBiaW5hcnk6IGJpZ0ludFNub3dmbGFrZS50b1N0cmluZygyKS5wYWRTdGFydCg2NCwgJzAnKSxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHJpZXZlcyB0aGUgdGltZXN0YW1wIGZyb20gYSBzbm93Zmxha2VcbiAgICogQHBhcmFtIHNub3dmbGFrZSBTbm93Zmxha2UgdG8gZ2V0IHRoZSB0aW1lc3RhbXAgZnJvbVxuICAgKi9cbiAgc3RhdGljIHRpbWVzdGFtcEZyb20oc25vd2ZsYWtlOiBzdHJpbmcpOiBudW1iZXIge1xuICAgIHJldHVybiBOdW1iZXIoKEJpZ0ludChzbm93Zmxha2UpID4+IDIybikgKyBFUE9DSCk7XG4gIH1cblxuICAvKipcbiAgICogUmV0cmlldmVzIHRoZSBkYXRlIGZyb20gYSBzbm93Zmxha2VcbiAgICogQHBhcmFtIHNub3dmbGFrZSBTbm93Zmxha2UgdG8gZ2V0IHRoZSBkYXRlIGZyb21cbiAgICovXG4gIHN0YXRpYyBkYXRlRnJvbShzbm93Zmxha2U6IHN0cmluZyk6IERhdGUge1xuICAgIHJldHVybiBuZXcgRGF0ZShTbm93Zmxha2VVdGlsLnRpbWVzdGFtcEZyb20oc25vd2ZsYWtlKSk7XG4gIH1cblxuICAvKipcbiAgICogQ29tcGFyZXMgdHdvIHNub3dmbGFrZXNcbiAgICogQHBhcmFtIGEgRmlyc3Qgc25vd2ZsYWtlXG4gICAqIEBwYXJhbSBiIFNlY29uZCBzbm93Zmxha2VcbiAgICogQHJldHVybnMgLTEgaWYgYSA8IGIsIDAgaWYgYSA9PT0gYiwgMSBpZiBhID4gYlxuICAgKi9cbiAgc3RhdGljIGNvbXBhcmUoYTogc3RyaW5nLCBiOiBzdHJpbmcpOiAtMSB8IDAgfCAxIHtcbiAgICBjb25zdCBiaWdBID0gQmlnSW50KGEpO1xuICAgIGNvbnN0IGJpZ0IgPSBCaWdJbnQoYik7XG4gICAgaWYgKGJpZ0EgPCBiaWdCKSByZXR1cm4gLTE7XG4gICAgaWYgKGJpZ0EgPiBiaWdCKSByZXR1cm4gMTtcbiAgICByZXR1cm4gMDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVja3MgaWYgYSB2YWx1ZSBpcyBhIHZhbGlkIHNub3dmbGFrZVxuICAgKiBAcGFyYW0gdmFsdWUgVmFsdWUgdG8gY2hlY2tcbiAgICovXG4gIHN0YXRpYyBpc1ZhbGlkKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgc3RyaW5nIHtcbiAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJykgcmV0dXJuIGZhbHNlO1xuICAgIGlmICghL15cXGR7MTcsMjB9JC8udGVzdCh2YWx1ZSkpIHJldHVybiBmYWxzZTtcbiAgICB0cnkge1xuICAgICAgY29uc3QgdGltZXN0YW1wID0gU25vd2ZsYWtlVXRpbC50aW1lc3RhbXBGcm9tKHZhbHVlKTtcbiAgICAgIHJldHVybiB0aW1lc3RhbXAgPiBOdW1iZXIoRVBPQ0gpICYmIHRpbWVzdGFtcCA8IERhdGUubm93KCkgKyAxMDAwICogNjAgKiA2MCAqIDI0ICogMzY1OyAvLyBXaXRoaW4gcmVhc29uYWJsZSByYW5nZVxuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIERlY29uc3RydWN0ZWQgc25vd2ZsYWtlIGRhdGFcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBEZWNvbnN0cnVjdGVkU25vd2ZsYWtlIHtcbiAgLyoqIFRpbWVzdGFtcCB0aGUgc25vd2ZsYWtlIHdhcyBjcmVhdGVkICovXG4gIHRpbWVzdGFtcDogbnVtYmVyO1xuICAvKiogRGF0ZSB0aGUgc25vd2ZsYWtlIHdhcyBjcmVhdGVkICovXG4gIGRhdGU6IERhdGU7XG4gIC8qKiBXb3JrZXIgSUQgaW4gdGhlIHNub3dmbGFrZSAqL1xuICB3b3JrZXJJZDogbnVtYmVyO1xuICAvKiogUHJvY2VzcyBJRCBpbiB0aGUgc25vd2ZsYWtlICovXG4gIHByb2Nlc3NJZDogbnVtYmVyO1xuICAvKiogSW5jcmVtZW50IGluIHRoZSBzbm93Zmxha2UgKi9cbiAgaW5jcmVtZW50OiBudW1iZXI7XG4gIC8qKiBCaW5hcnkgcmVwcmVzZW50YXRpb24gb2YgdGhlIHNub3dmbGFrZSAqL1xuICBiaW5hcnk6IHN0cmluZztcbn1cblxuLy8gRXhwb3J0IGFzIGRlZmF1bHQgdG9vIGZvciBjb252ZW5pZW5jZVxuZXhwb3J0IGRlZmF1bHQgU25vd2ZsYWtlVXRpbDtcbiJdfQ==