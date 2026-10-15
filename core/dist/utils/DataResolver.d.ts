/**
 * Data resolver utilities for handling various data types
 *
 * SECURITY NOTE: This module handles file operations. Path traversal protection
 * is implemented to prevent reading files outside allowed directories.
 * Bot developers should set allowed directories via DataResolver.setAllowedPaths()
 */
export type BufferResolvable = Buffer | string;
export type Base64Resolvable = Buffer | string;
/**
 * Resolves various data types to usable formats
 */
export declare class DataResolver {
    /** Allowed directories for file operations (empty = allow all for backwards compatibility) */
    private static allowedPaths;
    /**
     * Set allowed directories for file operations (security hardening)
     * @param paths Array of allowed base directories
     * @example
     * // Only allow files from assets and uploads directories
     * DataResolver.setAllowedPaths(['./assets', './uploads']);
     */
    static setAllowedPaths(paths: string[]): void;
    /**
     * Get currently allowed paths
     */
    static getAllowedPaths(): string[];
    /**
     * Resolves a BufferResolvable to a Buffer
     * @param resource The resource to resolve
     * @throws Error if path traversal is detected (when allowedPaths is configured)
     */
    static resolveBuffer(resource: BufferResolvable): Promise<Buffer>;
    /**
     * Resolves a Base64Resolvable to a base64 string
     * @param resource The resource to resolve
     * @param mimeType The MIME type for the data URI
     */
    static resolveBase64(resource: Base64Resolvable, mimeType?: string): Promise<string>;
    /**
     * Resolves a file to a name and buffer
     * @param resource The file resource
     */
    static resolveFile(resource: BufferResolvable | {
        name?: string;
        attachment: BufferResolvable;
    }): Promise<{
        name: string;
        data: Buffer;
    }>;
    /**
     * Resolves multiple files
     * @param resources The file resources
     */
    static resolveFiles(resources: (BufferResolvable | {
        name?: string;
        attachment: BufferResolvable;
    })[]): Promise<{
        name: string;
        data: Buffer;
    }[]>;
    /**
     * Resolves a color to a number
     * @param color The color to resolve
     */
    static resolveColor(color: number | string | [number, number, number] | null): number | null;
    /**
     * Resolves a string to a snowflake ID
     * @param value The value to resolve
     */
    static resolveSnowflake(value: string | number | {
        id: string | number;
    }): string;
    /**
     * Resolves an image to a base64 data URI
     * @param image The image to resolve
     */
    static resolveImage(image: BufferResolvable): Promise<string>;
}
export default DataResolver;
