/**
 * Snowflake utilities
 * API compatible with Discord.js SnowflakeUtil
 */

// Jubbio epoch (same as Discord: 2015-01-01T00:00:00.000Z)
const EPOCH = 1420070400000n;

/**
 * A container for useful snowflake-related methods
 */
export class SnowflakeUtil {
  /**
   * Jubbio's epoch value
   */
  static readonly EPOCH = EPOCH;

  /**
   * Generates a snowflake ID
   * @param timestamp Timestamp or date to generate from
   */
  static generate(timestamp: number | Date = Date.now()): string {
    const time = timestamp instanceof Date ? timestamp.getTime() : timestamp;
    return ((BigInt(time) - EPOCH) << 22n).toString();
  }

  /**
   * Deconstructs a snowflake ID
   * @param snowflake Snowflake to deconstruct
   */
  static deconstruct(snowflake: string): DeconstructedSnowflake {
    const bigIntSnowflake = BigInt(snowflake);
    return {
      timestamp: Number((bigIntSnowflake >> 22n) + EPOCH),
      get date() {
        return new Date(this.timestamp);
      },
      workerId: Number((bigIntSnowflake & 0x3E0000n) >> 17n),
      processId: Number((bigIntSnowflake & 0x1F000n) >> 12n),
      increment: Number(bigIntSnowflake & 0xFFFn),
      binary: bigIntSnowflake.toString(2).padStart(64, '0'),
    };
  }

  /**
   * Retrieves the timestamp from a snowflake
   * @param snowflake Snowflake to get the timestamp from
   */
  static timestampFrom(snowflake: string): number {
    return Number((BigInt(snowflake) >> 22n) + EPOCH);
  }

  /**
   * Retrieves the date from a snowflake
   * @param snowflake Snowflake to get the date from
   */
  static dateFrom(snowflake: string): Date {
    return new Date(SnowflakeUtil.timestampFrom(snowflake));
  }

  /**
   * Compares two snowflakes
   * @param a First snowflake
   * @param b Second snowflake
   * @returns -1 if a < b, 0 if a === b, 1 if a > b
   */
  static compare(a: string, b: string): -1 | 0 | 1 {
    const bigA = BigInt(a);
    const bigB = BigInt(b);
    if (bigA < bigB) return -1;
    if (bigA > bigB) return 1;
    return 0;
  }

  /**
   * Checks if a value is a valid snowflake
   * @param value Value to check
   */
  static isValid(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    if (!/^\d{17,20}$/.test(value)) return false;
    try {
      const timestamp = SnowflakeUtil.timestampFrom(value);
      return timestamp > Number(EPOCH) && timestamp < Date.now() + 1000 * 60 * 60 * 24 * 365; // Within reasonable range
    } catch {
      return false;
    }
  }
}

/**
 * Deconstructed snowflake data
 */
export interface DeconstructedSnowflake {
  /** Timestamp the snowflake was created */
  timestamp: number;
  /** Date the snowflake was created */
  date: Date;
  /** Worker ID in the snowflake */
  workerId: number;
  /** Process ID in the snowflake */
  processId: number;
  /** Increment in the snowflake */
  increment: number;
  /** Binary representation of the snowflake */
  binary: string;
}

// Export as default too for convenience
export default SnowflakeUtil;
