/**
 * Snowflake utilities
 * API compatible with Discord.js SnowflakeUtil
 */
/**
 * A container for useful snowflake-related methods
 */
export declare class SnowflakeUtil {
    /**
     * Jubbio's epoch value
     */
    static readonly EPOCH = 1420070400000n;
    /**
     * Generates a snowflake ID
     * @param timestamp Timestamp or date to generate from
     */
    static generate(timestamp?: number | Date): string;
    /**
     * Deconstructs a snowflake ID
     * @param snowflake Snowflake to deconstruct
     */
    static deconstruct(snowflake: string): DeconstructedSnowflake;
    /**
     * Retrieves the timestamp from a snowflake
     * @param snowflake Snowflake to get the timestamp from
     */
    static timestampFrom(snowflake: string): number;
    /**
     * Retrieves the date from a snowflake
     * @param snowflake Snowflake to get the date from
     */
    static dateFrom(snowflake: string): Date;
    /**
     * Compares two snowflakes
     * @param a First snowflake
     * @param b Second snowflake
     * @returns -1 if a < b, 0 if a === b, 1 if a > b
     */
    static compare(a: string, b: string): -1 | 0 | 1;
    /**
     * Checks if a value is a valid snowflake
     * @param value Value to check
     */
    static isValid(value: unknown): value is string;
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
export default SnowflakeUtil;
