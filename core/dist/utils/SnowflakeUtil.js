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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU25vd2ZsYWtlVXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91dGlscy9Tbm93Zmxha2VVdGlsLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7O0dBR0c7OztBQUVILDJEQUEyRDtBQUMzRCxNQUFNLEtBQUssR0FBRyxjQUFjLENBQUM7QUFFN0I7O0dBRUc7QUFDSCxNQUFhLGFBQWE7SUFDeEI7O09BRUc7SUFDSCxNQUFNLENBQVUsS0FBSyxHQUFHLEtBQUssQ0FBQztJQUU5Qjs7O09BR0c7SUFDSCxNQUFNLENBQUMsUUFBUSxDQUFDLFlBQTJCLElBQUksQ0FBQyxHQUFHLEVBQUU7UUFDbkQsTUFBTSxJQUFJLEdBQUcsU0FBUyxZQUFZLElBQUksQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7UUFDekUsT0FBTyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLEtBQUssQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBQ3BELENBQUM7SUFFRDs7O09BR0c7SUFDSCxNQUFNLENBQUMsV0FBVyxDQUFDLFNBQWlCO1FBQ2xDLE1BQU0sZUFBZSxHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUMxQyxPQUFPO1lBQ0wsU0FBUyxFQUFFLE1BQU0sQ0FBQyxDQUFDLGVBQWUsSUFBSSxHQUFHLENBQUMsR0FBRyxLQUFLLENBQUM7WUFDbkQsSUFBSSxJQUFJO2dCQUNOLE9BQU8sSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ2xDLENBQUM7WUFDRCxRQUFRLEVBQUUsTUFBTSxDQUFDLENBQUMsZUFBZSxHQUFHLFNBQVMsQ0FBQyxJQUFJLEdBQUcsQ0FBQztZQUN0RCxTQUFTLEVBQUUsTUFBTSxDQUFDLENBQUMsZUFBZSxHQUFHLFFBQVEsQ0FBQyxJQUFJLEdBQUcsQ0FBQztZQUN0RCxTQUFTLEVBQUUsTUFBTSxDQUFDLGVBQWUsR0FBRyxNQUFNLENBQUM7WUFDM0MsTUFBTSxFQUFFLGVBQWUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLEVBQUUsRUFBRSxHQUFHLENBQUM7U0FDdEQsQ0FBQztJQUNKLENBQUM7SUFFRDs7O09BR0c7SUFDSCxNQUFNLENBQUMsYUFBYSxDQUFDLFNBQWlCO1FBQ3BDLE9BQU8sTUFBTSxDQUFDLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDO0lBQ3BELENBQUM7SUFFRDs7O09BR0c7SUFDSCxNQUFNLENBQUMsUUFBUSxDQUFDLFNBQWlCO1FBQy9CLE9BQU8sSUFBSSxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO0lBQzFELENBQUM7SUFFRDs7Ozs7T0FLRztJQUNILE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBUyxFQUFFLENBQVM7UUFDakMsTUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3ZCLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN2QixJQUFJLElBQUksR0FBRyxJQUFJO1lBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUMzQixJQUFJLElBQUksR0FBRyxJQUFJO1lBQUUsT0FBTyxDQUFDLENBQUM7UUFDMUIsT0FBTyxDQUFDLENBQUM7SUFDWCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFjO1FBQzNCLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUTtZQUFFLE9BQU8sS0FBSyxDQUFDO1FBQzVDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQztZQUFFLE9BQU8sS0FBSyxDQUFDO1FBQzdDLElBQUksQ0FBQztZQUNILE1BQU0sU0FBUyxHQUFHLGFBQWEsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDckQsT0FBTyxTQUFTLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLFNBQVMsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsSUFBSSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEdBQUcsQ0FBQyxDQUFDLDBCQUEwQjtRQUNwSCxDQUFDO1FBQUMsTUFBTSxDQUFDO1lBQ1AsT0FBTyxLQUFLLENBQUM7UUFDZixDQUFDO0lBQ0gsQ0FBQzs7QUE1RUgsc0NBNkVDO0FBb0JELHdDQUF3QztBQUN4QyxrQkFBZSxhQUFhLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogU25vd2ZsYWtlIHV0aWxpdGllc1xyXG4gKiBBUEkgY29tcGF0aWJsZSB3aXRoIERpc2NvcmQuanMgU25vd2ZsYWtlVXRpbFxyXG4gKi9cclxuXHJcbi8vIEp1YmJpbyBlcG9jaCAoc2FtZSBhcyBEaXNjb3JkOiAyMDE1LTAxLTAxVDAwOjAwOjAwLjAwMFopXHJcbmNvbnN0IEVQT0NIID0gMTQyMDA3MDQwMDAwMG47XHJcblxyXG4vKipcclxuICogQSBjb250YWluZXIgZm9yIHVzZWZ1bCBzbm93Zmxha2UtcmVsYXRlZCBtZXRob2RzXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgU25vd2ZsYWtlVXRpbCB7XHJcbiAgLyoqXHJcbiAgICogSnViYmlvJ3MgZXBvY2ggdmFsdWVcclxuICAgKi9cclxuICBzdGF0aWMgcmVhZG9ubHkgRVBPQ0ggPSBFUE9DSDtcclxuXHJcbiAgLyoqXHJcbiAgICogR2VuZXJhdGVzIGEgc25vd2ZsYWtlIElEXHJcbiAgICogQHBhcmFtIHRpbWVzdGFtcCBUaW1lc3RhbXAgb3IgZGF0ZSB0byBnZW5lcmF0ZSBmcm9tXHJcbiAgICovXHJcbiAgc3RhdGljIGdlbmVyYXRlKHRpbWVzdGFtcDogbnVtYmVyIHwgRGF0ZSA9IERhdGUubm93KCkpOiBzdHJpbmcge1xyXG4gICAgY29uc3QgdGltZSA9IHRpbWVzdGFtcCBpbnN0YW5jZW9mIERhdGUgPyB0aW1lc3RhbXAuZ2V0VGltZSgpIDogdGltZXN0YW1wO1xyXG4gICAgcmV0dXJuICgoQmlnSW50KHRpbWUpIC0gRVBPQ0gpIDw8IDIybikudG9TdHJpbmcoKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlY29uc3RydWN0cyBhIHNub3dmbGFrZSBJRFxyXG4gICAqIEBwYXJhbSBzbm93Zmxha2UgU25vd2ZsYWtlIHRvIGRlY29uc3RydWN0XHJcbiAgICovXHJcbiAgc3RhdGljIGRlY29uc3RydWN0KHNub3dmbGFrZTogc3RyaW5nKTogRGVjb25zdHJ1Y3RlZFNub3dmbGFrZSB7XHJcbiAgICBjb25zdCBiaWdJbnRTbm93Zmxha2UgPSBCaWdJbnQoc25vd2ZsYWtlKTtcclxuICAgIHJldHVybiB7XHJcbiAgICAgIHRpbWVzdGFtcDogTnVtYmVyKChiaWdJbnRTbm93Zmxha2UgPj4gMjJuKSArIEVQT0NIKSxcclxuICAgICAgZ2V0IGRhdGUoKSB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBEYXRlKHRoaXMudGltZXN0YW1wKTtcclxuICAgICAgfSxcclxuICAgICAgd29ya2VySWQ6IE51bWJlcigoYmlnSW50U25vd2ZsYWtlICYgMHgzRTAwMDBuKSA+PiAxN24pLFxyXG4gICAgICBwcm9jZXNzSWQ6IE51bWJlcigoYmlnSW50U25vd2ZsYWtlICYgMHgxRjAwMG4pID4+IDEybiksXHJcbiAgICAgIGluY3JlbWVudDogTnVtYmVyKGJpZ0ludFNub3dmbGFrZSAmIDB4RkZGbiksXHJcbiAgICAgIGJpbmFyeTogYmlnSW50U25vd2ZsYWtlLnRvU3RyaW5nKDIpLnBhZFN0YXJ0KDY0LCAnMCcpLFxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJldHJpZXZlcyB0aGUgdGltZXN0YW1wIGZyb20gYSBzbm93Zmxha2VcclxuICAgKiBAcGFyYW0gc25vd2ZsYWtlIFNub3dmbGFrZSB0byBnZXQgdGhlIHRpbWVzdGFtcCBmcm9tXHJcbiAgICovXHJcbiAgc3RhdGljIHRpbWVzdGFtcEZyb20oc25vd2ZsYWtlOiBzdHJpbmcpOiBudW1iZXIge1xyXG4gICAgcmV0dXJuIE51bWJlcigoQmlnSW50KHNub3dmbGFrZSkgPj4gMjJuKSArIEVQT0NIKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJldHJpZXZlcyB0aGUgZGF0ZSBmcm9tIGEgc25vd2ZsYWtlXHJcbiAgICogQHBhcmFtIHNub3dmbGFrZSBTbm93Zmxha2UgdG8gZ2V0IHRoZSBkYXRlIGZyb21cclxuICAgKi9cclxuICBzdGF0aWMgZGF0ZUZyb20oc25vd2ZsYWtlOiBzdHJpbmcpOiBEYXRlIHtcclxuICAgIHJldHVybiBuZXcgRGF0ZShTbm93Zmxha2VVdGlsLnRpbWVzdGFtcEZyb20oc25vd2ZsYWtlKSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDb21wYXJlcyB0d28gc25vd2ZsYWtlc1xyXG4gICAqIEBwYXJhbSBhIEZpcnN0IHNub3dmbGFrZVxyXG4gICAqIEBwYXJhbSBiIFNlY29uZCBzbm93Zmxha2VcclxuICAgKiBAcmV0dXJucyAtMSBpZiBhIDwgYiwgMCBpZiBhID09PSBiLCAxIGlmIGEgPiBiXHJcbiAgICovXHJcbiAgc3RhdGljIGNvbXBhcmUoYTogc3RyaW5nLCBiOiBzdHJpbmcpOiAtMSB8IDAgfCAxIHtcclxuICAgIGNvbnN0IGJpZ0EgPSBCaWdJbnQoYSk7XHJcbiAgICBjb25zdCBiaWdCID0gQmlnSW50KGIpO1xyXG4gICAgaWYgKGJpZ0EgPCBiaWdCKSByZXR1cm4gLTE7XHJcbiAgICBpZiAoYmlnQSA+IGJpZ0IpIHJldHVybiAxO1xyXG4gICAgcmV0dXJuIDA7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDaGVja3MgaWYgYSB2YWx1ZSBpcyBhIHZhbGlkIHNub3dmbGFrZVxyXG4gICAqIEBwYXJhbSB2YWx1ZSBWYWx1ZSB0byBjaGVja1xyXG4gICAqL1xyXG4gIHN0YXRpYyBpc1ZhbGlkKHZhbHVlOiB1bmtub3duKTogdmFsdWUgaXMgc3RyaW5nIHtcclxuICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnKSByZXR1cm4gZmFsc2U7XHJcbiAgICBpZiAoIS9eXFxkezE3LDIwfSQvLnRlc3QodmFsdWUpKSByZXR1cm4gZmFsc2U7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCB0aW1lc3RhbXAgPSBTbm93Zmxha2VVdGlsLnRpbWVzdGFtcEZyb20odmFsdWUpO1xyXG4gICAgICByZXR1cm4gdGltZXN0YW1wID4gTnVtYmVyKEVQT0NIKSAmJiB0aW1lc3RhbXAgPCBEYXRlLm5vdygpICsgMTAwMCAqIDYwICogNjAgKiAyNCAqIDM2NTsgLy8gV2l0aGluIHJlYXNvbmFibGUgcmFuZ2VcclxuICAgIH0gY2F0Y2gge1xyXG4gICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogRGVjb25zdHJ1Y3RlZCBzbm93Zmxha2UgZGF0YVxyXG4gKi9cclxuZXhwb3J0IGludGVyZmFjZSBEZWNvbnN0cnVjdGVkU25vd2ZsYWtlIHtcclxuICAvKiogVGltZXN0YW1wIHRoZSBzbm93Zmxha2Ugd2FzIGNyZWF0ZWQgKi9cclxuICB0aW1lc3RhbXA6IG51bWJlcjtcclxuICAvKiogRGF0ZSB0aGUgc25vd2ZsYWtlIHdhcyBjcmVhdGVkICovXHJcbiAgZGF0ZTogRGF0ZTtcclxuICAvKiogV29ya2VyIElEIGluIHRoZSBzbm93Zmxha2UgKi9cclxuICB3b3JrZXJJZDogbnVtYmVyO1xyXG4gIC8qKiBQcm9jZXNzIElEIGluIHRoZSBzbm93Zmxha2UgKi9cclxuICBwcm9jZXNzSWQ6IG51bWJlcjtcclxuICAvKiogSW5jcmVtZW50IGluIHRoZSBzbm93Zmxha2UgKi9cclxuICBpbmNyZW1lbnQ6IG51bWJlcjtcclxuICAvKiogQmluYXJ5IHJlcHJlc2VudGF0aW9uIG9mIHRoZSBzbm93Zmxha2UgKi9cclxuICBiaW5hcnk6IHN0cmluZztcclxufVxyXG5cclxuLy8gRXhwb3J0IGFzIGRlZmF1bHQgdG9vIGZvciBjb252ZW5pZW5jZVxyXG5leHBvcnQgZGVmYXVsdCBTbm93Zmxha2VVdGlsO1xyXG4iXX0=