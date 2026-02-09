/**
 * Data resolver utilities for handling various data types
 */
export type BufferResolvable = Buffer | string;
export type Base64Resolvable = Buffer | string;
/**
 * Resolves various data types to usable formats
 */
export declare class DataResolver {
    /**
     * Resolves a BufferResolvable to a Buffer
     * @param resource The resource to resolve
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
