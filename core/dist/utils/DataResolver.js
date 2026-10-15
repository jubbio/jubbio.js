"use strict";
/**
 * Data resolver utilities for handling various data types
 *
 * SECURITY NOTE: This module handles file operations. Path traversal protection
 * is implemented to prevent reading files outside allowed directories.
 * Bot developers should set allowed directories via DataResolver.setAllowedPaths()
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataResolver = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
/**
 * Validates that a path doesn't escape allowed directories (path traversal protection)
 * @param filePath The path to validate
 * @param allowedPaths Array of allowed base directories (if empty, all paths are allowed for backwards compatibility)
 * @throws Error if path traversal is detected
 */
function validatePath(filePath, allowedPaths) {
    // Normalize and resolve the path to prevent ../ attacks
    const normalizedPath = (0, path_1.normalize)((0, path_1.resolve)(filePath));
    // If no allowed paths configured, allow all (backwards compatibility)
    // Bot developers should configure allowed paths for security
    if (allowedPaths.length === 0) {
        return normalizedPath;
    }
    // Check if the normalized path starts with any allowed directory
    const isAllowed = allowedPaths.some(allowedDir => {
        const normalizedAllowed = (0, path_1.normalize)((0, path_1.resolve)(allowedDir));
        return normalizedPath.startsWith(normalizedAllowed);
    });
    if (!isAllowed) {
        throw new Error(`Path traversal detected: "${filePath}" is outside allowed directories`);
    }
    return normalizedPath;
}
/**
 * Resolves various data types to usable formats
 */
class DataResolver {
    /** Allowed directories for file operations (empty = allow all for backwards compatibility) */
    static allowedPaths = [];
    /**
     * Set allowed directories for file operations (security hardening)
     * @param paths Array of allowed base directories
     * @example
     * // Only allow files from assets and uploads directories
     * DataResolver.setAllowedPaths(['./assets', './uploads']);
     */
    static setAllowedPaths(paths) {
        this.allowedPaths = paths.map(p => (0, path_1.normalize)((0, path_1.resolve)(p)));
    }
    /**
     * Get currently allowed paths
     */
    static getAllowedPaths() {
        return [...this.allowedPaths];
    }
    /**
     * Resolves a BufferResolvable to a Buffer
     * @param resource The resource to resolve
     * @throws Error if path traversal is detected (when allowedPaths is configured)
     */
    static async resolveBuffer(resource) {
        if (Buffer.isBuffer(resource))
            return resource;
        if (typeof resource === 'string') {
            // Check if it's a URL first (URLs don't need path validation)
            if (resource.startsWith('http://') || resource.startsWith('https://')) {
                const response = await fetch(resource);
                const arrayBuffer = await response.arrayBuffer();
                return Buffer.from(arrayBuffer);
            }
            // Check if it's base64 data URI
            if (resource.startsWith('data:')) {
                const base64Data = resource.split(',')[1];
                return Buffer.from(base64Data, 'base64');
            }
            // File path - validate for path traversal
            if (resource.startsWith('/') || resource.startsWith('./') || resource.startsWith('../') || /^[a-zA-Z]:/.test(resource)) {
                const safePath = validatePath(resource, this.allowedPaths);
                return (0, promises_1.readFile)(safePath);
            }
            // Assume it's a relative file path
            const safePath = validatePath(resource, this.allowedPaths);
            return (0, promises_1.readFile)(safePath);
        }
        throw new TypeError('Invalid resource type');
    }
    /**
     * Resolves a Base64Resolvable to a base64 string
     * @param resource The resource to resolve
     * @param mimeType The MIME type for the data URI
     */
    static async resolveBase64(resource, mimeType = 'image/png') {
        const buffer = await this.resolveBuffer(resource);
        return `data:${mimeType};base64,${buffer.toString('base64')}`;
    }
    /**
     * Resolves a file to a name and buffer
     * @param resource The file resource
     */
    static async resolveFile(resource) {
        if (typeof resource === 'object' && 'attachment' in resource) {
            const buffer = await this.resolveBuffer(resource.attachment);
            const name = resource.name ?? 'file';
            return { name, data: buffer };
        }
        const buffer = await this.resolveBuffer(resource);
        const name = typeof resource === 'string' ? (0, path_1.basename)(resource) : 'file';
        return { name, data: buffer };
    }
    /**
     * Resolves multiple files
     * @param resources The file resources
     */
    static async resolveFiles(resources) {
        return Promise.all(resources.map(r => this.resolveFile(r)));
    }
    /**
     * Resolves a color to a number
     * @param color The color to resolve
     */
    static resolveColor(color) {
        if (color === null)
            return null;
        if (typeof color === 'number') {
            if (color < 0 || color > 0xFFFFFF)
                throw new RangeError('Color must be between 0 and 16777215');
            return color;
        }
        if (typeof color === 'string') {
            if (color.startsWith('#')) {
                return parseInt(color.slice(1), 16);
            }
            // Named colors
            const namedColors = {
                default: 0x000000,
                white: 0xFFFFFF,
                aqua: 0x1ABC9C,
                green: 0x57F287,
                blue: 0x3498DB,
                yellow: 0xFEE75C,
                purple: 0x9B59B6,
                fuchsia: 0xEB459E,
                gold: 0xF1C40F,
                orange: 0xE67E22,
                red: 0xED4245,
                grey: 0x95A5A6,
                navy: 0x34495E,
                blurple: 0x5865F2,
            };
            const lower = color.toLowerCase();
            if (lower in namedColors)
                return namedColors[lower];
            return parseInt(color, 16);
        }
        if (Array.isArray(color)) {
            return (color[0] << 16) + (color[1] << 8) + color[2];
        }
        throw new TypeError('Invalid color type');
    }
    /**
     * Resolves a string to a snowflake ID
     * @param value The value to resolve
     */
    static resolveSnowflake(value) {
        if (typeof value === 'object' && 'id' in value) {
            return String(value.id);
        }
        return String(value);
    }
    /**
     * Resolves an image to a base64 data URI
     * @param image The image to resolve
     */
    static async resolveImage(image) {
        const buffer = await this.resolveBuffer(image);
        // Detect MIME type from magic bytes
        let mimeType = 'image/png';
        if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
            mimeType = 'image/jpeg';
        }
        else if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
            mimeType = 'image/gif';
        }
        else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
            mimeType = 'image/webp';
        }
        return `data:${mimeType};base64,${buffer.toString('base64')}`;
    }
}
exports.DataResolver = DataResolver;
exports.default = DataResolver;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRGF0YVJlc29sdmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3V0aWxzL0RhdGFSZXNvbHZlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOzs7QUFFSCwwQ0FBdUM7QUFDdkMsK0JBQWdFO0FBS2hFOzs7OztHQUtHO0FBQ0gsU0FBUyxZQUFZLENBQUMsUUFBZ0IsRUFBRSxZQUFzQjtJQUM1RCx3REFBd0Q7SUFDeEQsTUFBTSxjQUFjLEdBQUcsSUFBQSxnQkFBUyxFQUFDLElBQUEsY0FBTyxFQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7SUFFcEQsc0VBQXNFO0lBQ3RFLDZEQUE2RDtJQUM3RCxJQUFJLFlBQVksQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7UUFDOUIsT0FBTyxjQUFjLENBQUM7SUFDeEIsQ0FBQztJQUVELGlFQUFpRTtJQUNqRSxNQUFNLFNBQVMsR0FBRyxZQUFZLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxFQUFFO1FBQy9DLE1BQU0saUJBQWlCLEdBQUcsSUFBQSxnQkFBUyxFQUFDLElBQUEsY0FBTyxFQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7UUFDekQsT0FBTyxjQUFjLENBQUMsVUFBVSxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDdEQsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7UUFDZixNQUFNLElBQUksS0FBSyxDQUFDLDZCQUE2QixRQUFRLGtDQUFrQyxDQUFDLENBQUM7SUFDM0YsQ0FBQztJQUVELE9BQU8sY0FBYyxDQUFDO0FBQ3hCLENBQUM7QUFFRDs7R0FFRztBQUNILE1BQWEsWUFBWTtJQUN2Qiw4RkFBOEY7SUFDdEYsTUFBTSxDQUFDLFlBQVksR0FBYSxFQUFFLENBQUM7SUFFM0M7Ozs7OztPQU1HO0lBQ0gsTUFBTSxDQUFDLGVBQWUsQ0FBQyxLQUFlO1FBQ3BDLElBQUksQ0FBQyxZQUFZLEdBQUcsS0FBSyxDQUFD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QUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxLQUF1QjtRQUMvQyxNQUFNLE1BQU0sR0FBRyxNQUFNLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFL0Msb0NBQW9DO1FBQ3BDLElBQUksUUFBUSxHQUFHLFdBQVcsQ0FBQztRQUMzQixJQUFJLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxJQUFJLElBQUksTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLElBQUksRUFBRSxDQUFDO1lBQzdDLFFBQVEsR0FBRyxZQUFZLENBQUM7UUFDMUIsQ0FBQzthQUFNLElBQUksTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLElBQUksSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssSUFBSSxJQUFJLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxJQUFJLEVBQUUsQ0FBQztZQUMxRSxRQUFRLEdBQUcsV0FBVyxDQUFDO1FBQ3pCLENBQUM7YUFBTSxJQUFJLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxJQUFJLElBQUksTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLElBQUksSUFBSSxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssSUFBSSxJQUFJLE1BQU0sQ0FBQyxDQUFDLENBQUMsS0FBSyxJQUFJLEVBQUUsQ0FBQztZQUNoRyxRQUFRLEdBQUcsWUFBWSxDQUFDO1FBQzFCLENBQUM7UUFFRCxPQUFPLFFBQVEsUUFBUSxXQUFXLE1BQU0sQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQztJQUNoRSxDQUFDOztBQXRLSCxvQ0F1S0M7QUFFRCxrQkFBZSxZQUFZLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogRGF0YSByZXNvbHZlciB1dGlsaXRpZXMgZm9yIGhhbmRsaW5nIHZhcmlvdXMgZGF0YSB0eXBlc1xyXG4gKiBcclxuICogU0VDVVJJVFkgTk9URTogVGhpcyBtb2R1bGUgaGFuZGxlcyBmaWxlIG9wZXJhdGlvbnMuIFBhdGggdHJhdmVyc2FsIHByb3RlY3Rpb25cclxuICogaXMgaW1wbGVtZW50ZWQgdG8gcHJldmVudCByZWFkaW5nIGZpbGVzIG91dHNpZGUgYWxsb3dlZCBkaXJlY3Rvcmllcy5cclxuICogQm90IGRldmVsb3BlcnMgc2hvdWxkIHNldCBhbGxvd2VkIGRpcmVjdG9yaWVzIHZpYSBEYXRhUmVzb2x2ZXIuc2V0QWxsb3dlZFBhdGhzKClcclxuICovXHJcblxyXG5pbXBvcnQgeyByZWFkRmlsZSB9IGZyb20gJ2ZzL3Byb21pc2VzJztcclxuaW1wb3J0IHsgYmFzZW5hbWUsIHJlc29sdmUsIG5vcm1hbGl6ZSwgaXNBYnNvbHV0ZSB9IGZyb20gJ3BhdGgnO1xyXG5cclxuZXhwb3J0IHR5cGUgQnVmZmVyUmVzb2x2YWJsZSA9IEJ1ZmZlciB8IHN0cmluZztcclxuZXhwb3J0IHR5cGUgQmFzZTY0UmVzb2x2YWJsZSA9IEJ1ZmZlciB8IHN0cmluZztcclxuXHJcbi8qKlxyXG4gKiBWYWxpZGF0ZXMgdGhhdCBhIHBhdGggZG9lc24ndCBlc2NhcGUgYWxsb3dlZCBkaXJlY3RvcmllcyAocGF0aCB0cmF2ZXJzYWwgcHJvdGVjdGlvbilcclxuICogQHBhcmFtIGZpbGVQYXRoIFRoZSBwYXRoIHRvIHZhbGlkYXRlXHJcbiAqIEBwYXJhbSBhbGxvd2VkUGF0aHMgQXJyYXkgb2YgYWxsb3dlZCBiYXNlIGRpcmVjdG9yaWVzIChpZiBlbXB0eSwgYWxsIHBhdGhzIGFyZSBhbGxvd2VkIGZvciBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eSlcclxuICogQHRocm93cyBFcnJvciBpZiBwYXRoIHRyYXZlcnNhbCBpcyBkZXRlY3RlZFxyXG4gKi9cclxuZnVuY3Rpb24gdmFsaWRhdGVQYXRoKGZpbGVQYXRoOiBzdHJpbmcsIGFsbG93ZWRQYXRoczogc3RyaW5nW10pOiBzdHJpbmcge1xyXG4gIC8vIE5vcm1hbGl6ZSBhbmQgcmVzb2x2ZSB0aGUgcGF0aCB0byBwcmV2ZW50IC4uLyBhdHRhY2tzXHJcbiAgY29uc3Qgbm9ybWFsaXplZFBhdGggPSBub3JtYWxpemUocmVzb2x2ZShmaWxlUGF0aCkpO1xyXG4gIFxyXG4gIC8vIElmIG5vIGFsbG93ZWQgcGF0aHMgY29uZmlndXJlZCwgYWxsb3cgYWxsIChiYWNrd2FyZHMgY29tcGF0aWJpbGl0eSlcclxuICAvLyBCb3QgZGV2ZWxvcGVycyBzaG91bGQgY29uZmlndXJlIGFsbG93ZWQgcGF0aHMgZm9yIHNlY3VyaXR5XHJcbiAgaWYgKGFsbG93ZWRQYXRocy5sZW5ndGggPT09IDApIHtcclxuICAgIHJldHVybiBub3JtYWxpemVkUGF0aDtcclxuICB9XHJcbiAgXHJcbiAgLy8gQ2hlY2sgaWYgdGhlIG5vcm1hbGl6ZWQgcGF0aCBzdGFydHMgd2l0aCBhbnkgYWxsb3dlZCBkaXJlY3RvcnlcclxuICBjb25zdCBpc0FsbG93ZWQgPSBhbGxvd2VkUGF0aHMuc29tZShhbGxvd2VkRGlyID0+IHtcclxuICAgIGNvbnN0IG5vcm1hbGl6ZWRBbGxvd2VkID0gbm9ybWFsaXplKHJlc29sdmUoYWxsb3dlZERpcikpO1xyXG4gICAgcmV0dXJuIG5vcm1hbGl6ZWRQYXRoLnN0YXJ0c1dpdGgobm9ybWFsaXplZEFsbG93ZWQpO1xyXG4gIH0pO1xyXG4gIFxyXG4gIGlmICghaXNBbGxvd2VkKSB7XHJcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFBhdGggdHJhdmVyc2FsIGRldGVjdGVkOiBcIiR7ZmlsZVBhdGh9XCIgaXMgb3V0c2lkZSBhbGxvd2VkIGRpcmVjdG9yaWVzYCk7XHJcbiAgfVxyXG4gIFxyXG4gIHJldHVybiBub3JtYWxpemVkUGF0aDtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJlc29sdmVzIHZhcmlvdXMgZGF0YSB0eXBlcyB0byB1c2FibGUgZm9ybWF0c1xyXG4gKi9cclxuZXhwb3J0IGNsYXNzIERhdGFSZXNvbHZlciB7XHJcbiAgLyoqIEFsbG93ZWQgZGlyZWN0b3JpZXMgZm9yIGZpbGUgb3BlcmF0aW9ucyAoZW1wdHkgPSBhbGxvdyBhbGwgZm9yIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5KSAqL1xyXG4gIHByaXZhdGUgc3RhdGljIGFsbG93ZWRQYXRoczogc3RyaW5nW10gPSBbXTtcclxuICBcclxuICAvKipcclxuICAgKiBTZXQgYWxsb3dlZCBkaXJlY3RvcmllcyBmb3IgZmlsZSBvcGVyYXRpb25zIChzZWN1cml0eSBoYXJkZW5pbmcpXHJcbiAgICogQHBhcmFtIHBhdGhzIEFycmF5IG9mIGFsbG93ZWQgYmFzZSBkaXJlY3Rvcmllc1xyXG4gICAqIEBleGFtcGxlXHJcbiAgICogLy8gT25seSBhbGxvdyBmaWxlcyBmcm9tIGFzc2V0cyBhbmQgdXBsb2FkcyBkaXJlY3Rvcmllc1xyXG4gICAqIERhdGFSZXNvbHZlci5zZXRBbGxvd2VkUGF0aHMoWycuL2Fzc2V0cycsICcuL3VwbG9hZHMnXSk7XHJcbiAgICovXHJcbiAgc3RhdGljIHNldEFsbG93ZWRQYXRocyhwYXRoczogc3RyaW5nW10pOiB2b2lkIHtcclxuICAgIHRoaXMuYWxsb3dlZFBhdGhzID0gcGF0aHMubWFwKHAgPT4gbm9ybWFsaXplKHJlc29sdmUocCkpKTtcclxuICB9XHJcbiAgXHJcbiAgLyoqXHJcbiAgICogR2V0IGN1cnJlbnRseSBhbGxvd2VkIHBhdGhzXHJcbiAgICovXHJcbiAgc3RhdGljIGdldEFsbG93ZWRQYXRocygpOiBzdHJpbmdbXSB7XHJcbiAgICByZXR1cm4gWy4uLnRoaXMuYWxsb3dlZFBhdGhzXTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlc29sdmVzIGEgQnVmZmVyUmVzb2x2YWJsZSB0byBhIEJ1ZmZlclxyXG4gICAqIEBwYXJhbSByZXNvdXJjZSBUaGUgcmVzb3VyY2UgdG8gcmVzb2x2ZVxyXG4gICAqIEB0aHJvd3MgRXJyb3IgaWYgcGF0aCB0cmF2ZXJzYWwgaXMgZGV0ZWN0ZWQgKHdoZW4gYWxsb3dlZFBhdGhzIGlzIGNvbmZpZ3VyZWQpXHJcbiAgICovXHJcbiAgc3RhdGljIGFzeW5jIHJlc29sdmVCdWZmZXIocmVzb3VyY2U6IEJ1ZmZlclJlc29sdmFibGUpOiBQcm9taXNlPEJ1ZmZlcj4ge1xyXG4gICAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihyZXNvdXJjZSkpIHJldHVybiByZXNvdXJjZTtcclxuICAgIFxyXG4gICAgaWYgKHR5cGVvZiByZXNvdXJjZSA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgLy8gQ2hlY2sgaWYgaXQncyBhIFVSTCBmaXJzdCAoVVJMcyBkb24ndCBuZWVkIHBhdGggdmFsaWRhdGlvbilcclxuICAgICAgaWYgKHJlc291cmNlLnN0YXJ0c1dpdGgoJ2h0dHA6Ly8nKSB8fCByZXNvdXJjZS5zdGFydHNXaXRoKCdodHRwczovLycpKSB7XHJcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChyZXNvdXJjZSk7XHJcbiAgICAgICAgY29uc3QgYXJyYXlCdWZmZXIgPSBhd2FpdCByZXNwb25zZS5hcnJheUJ1ZmZlcigpO1xyXG4gICAgICAgIHJldHVybiBCdWZmZXIuZnJvbShhcnJheUJ1ZmZlcik7XHJcbiAgICAgIH1cclxuICAgICAgXHJcbiAgICAgIC8vIENoZWNrIGlmIGl0J3MgYmFzZTY0IGRhdGEgVVJJXHJcbiAgICAgIGlmIChyZXNvdXJjZS5zdGFydHNXaXRoKCdkYXRhOicpKSB7XHJcbiAgICAgICAgY29uc3QgYmFzZTY0RGF0YSA9IHJlc291cmNlLnNwbGl0KCcsJylbMV07XHJcbiAgICAgICAgcmV0dXJuIEJ1ZmZlci5mcm9tKGJhc2U2NERhdGEsICdiYXNlNjQnKTtcclxuICAgICAgfVxyXG4gICAgICBcclxuICAgICAgLy8gRmlsZSBwYXRoIC0gdmFsaWRhdGUgZm9yIHBhdGggdHJhdmVyc2FsXHJcbiAgICAgIGlmIChyZXNvdXJjZS5zdGFydHNXaXRoKCcvJykgfHwgcmVzb3VyY2Uuc3RhcnRzV2l0aCgnLi8nKSB8fCByZXNvdXJjZS5zdGFydHNXaXRoKCcuLi8nKSB8fCAvXlthLXpBLVpdOi8udGVzdChyZXNvdXJjZSkpIHtcclxuICAgICAgICBjb25zdCBzYWZlUGF0aCA9IHZhbGlkYXRlUGF0aChyZXNvdXJjZSwgdGhpcy5hbGxvd2VkUGF0aHMpO1xyXG4gICAgICAgIHJldHVybiByZWFkRmlsZShzYWZlUGF0aCk7XHJcbiAgICAgIH1cclxuICAgICAgXHJcbiAgICAgIC8vIEFzc3VtZSBpdCdzIGEgcmVsYXRpdmUgZmlsZSBwYXRoXHJcbiAgICAgIGNvbnN0IHNhZmVQYXRoID0gdmFsaWRhdGVQYXRoKHJlc291cmNlLCB0aGlzLmFsbG93ZWRQYXRocyk7XHJcbiAgICAgIHJldHVybiByZWFkRmlsZShzYWZlUGF0aCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0ludmFsaWQgcmVzb3VyY2UgdHlwZScpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVzb2x2ZXMgYSBCYXNlNjRSZXNvbHZhYmxlIHRvIGEgYmFzZTY0IHN0cmluZ1xyXG4gICAqIEBwYXJhbSByZXNvdXJjZSBUaGUgcmVzb3VyY2UgdG8gcmVzb2x2ZVxyXG4gICAqIEBwYXJhbSBtaW1lVHlwZSBUaGUgTUlNRSB0eXBlIGZvciB0aGUgZGF0YSBVUklcclxuICAgKi9cclxuICBzdGF0aWMgYXN5bmMgcmVzb2x2ZUJhc2U2NChyZXNvdXJjZTogQmFzZTY0UmVzb2x2YWJsZSwgbWltZVR5cGUgPSAnaW1hZ2UvcG5nJyk6IFByb21pc2U8c3RyaW5nPiB7XHJcbiAgICBjb25zdCBidWZmZXIgPSBhd2FpdCB0aGlzLnJlc29sdmVCdWZmZXIocmVzb3VyY2UpO1xyXG4gICAgcmV0dXJuIGBkYXRhOiR7bWltZVR5cGV9O2Jhc2U2NCwke2J1ZmZlci50b1N0cmluZygnYmFzZTY0Jyl9YDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlc29sdmVzIGEgZmlsZSB0byBhIG5hbWUgYW5kIGJ1ZmZlclxyXG4gICAqIEBwYXJhbSByZXNvdXJjZSBUaGUgZmlsZSByZXNvdXJjZVxyXG4gICAqL1xyXG4gIHN0YXRpYyBhc3luYyByZXNvbHZlRmlsZShyZXNvdXJjZTogQnVmZmVyUmVzb2x2YWJsZSB8IHsgbmFtZT86IHN0cmluZzsgYXR0YWNobWVudDogQnVmZmVyUmVzb2x2YWJsZSB9KTogUHJvbWlzZTx7IG5hbWU6IHN0cmluZzsgZGF0YTogQnVmZmVyIH0+IHtcclxuICAgIGlmICh0eXBlb2YgcmVzb3VyY2UgPT09ICdvYmplY3QnICYmICdhdHRhY2htZW50JyBpbiByZXNvdXJjZSkge1xyXG4gICAgICBjb25zdCBidWZmZXIgPSBhd2FpdCB0aGlzLnJlc29sdmVCdWZmZXIocmVzb3VyY2UuYXR0YWNobWVudCk7XHJcbiAgICAgIGNvbnN0IG5hbWUgPSByZXNvdXJjZS5uYW1lID8/ICdmaWxlJztcclxuICAgICAgcmV0dXJuIHsgbmFtZSwgZGF0YTogYnVmZmVyIH07XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGNvbnN0IGJ1ZmZlciA9IGF3YWl0IHRoaXMucmVzb2x2ZUJ1ZmZlcihyZXNvdXJjZSk7XHJcbiAgICBjb25zdCBuYW1lID0gdHlwZW9mIHJlc291cmNlID09PSAnc3RyaW5nJyA/IGJhc2VuYW1lKHJlc291cmNlKSA6ICdmaWxlJztcclxuICAgIHJldHVybiB7IG5hbWUsIGRhdGE6IGJ1ZmZlciB9O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVzb2x2ZXMgbXVsdGlwbGUgZmlsZXNcclxuICAgKiBAcGFyYW0gcmVzb3VyY2VzIFRoZSBmaWxlIHJlc291cmNlc1xyXG4gICAqL1xyXG4gIHN0YXRpYyBhc3luYyByZXNvbHZlRmlsZXMocmVzb3VyY2VzOiAoQnVmZmVyUmVzb2x2YWJsZSB8IHsgbmFtZT86IHN0cmluZzsgYXR0YWNobWVudDogQnVmZmVyUmVzb2x2YWJsZSB9KVtdKTogUHJvbWlzZTx7IG5hbWU6IHN0cmluZzsgZGF0YTogQnVmZmVyIH1bXT4ge1xyXG4gICAgcmV0dXJuIFByb21pc2UuYWxsKHJlc291cmNlcy5tYXAociA9PiB0aGlzLnJlc29sdmVGaWxlKHIpKSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZXNvbHZlcyBhIGNvbG9yIHRvIGEgbnVtYmVyXHJcbiAgICogQHBhcmFtIGNvbG9yIFRoZSBjb2xvciB0byByZXNvbHZlXHJcbiAgICovXHJcbiAgc3RhdGljIHJlc29sdmVDb2xvcihjb2xvcjogbnVtYmVyIHwgc3RyaW5nIHwgW251bWJlciwgbnVtYmVyLCBudW1iZXJdIHwgbnVsbCk6IG51bWJlciB8IG51bGwge1xyXG4gICAgaWYgKGNvbG9yID09PSBudWxsKSByZXR1cm4gbnVsbDtcclxuICAgIFxyXG4gICAgaWYgKHR5cGVvZiBjb2xvciA9PT0gJ251bWJlcicpIHtcclxuICAgICAgaWYgKGNvbG9yIDwgMCB8fCBjb2xvciA+IDB4RkZGRkZGKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignQ29sb3IgbXVzdCBiZSBiZXR3ZWVuIDAgYW5kIDE2Nzc3MjE1Jyk7XHJcbiAgICAgIHJldHVybiBjb2xvcjtcclxuICAgIH1cclxuICAgIFxyXG4gICAgaWYgKHR5cGVvZiBjb2xvciA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgaWYgKGNvbG9yLnN0YXJ0c1dpdGgoJyMnKSkge1xyXG4gICAgICAgIHJldHVybiBwYXJzZUludChjb2xvci5zbGljZSgxKSwgMTYpO1xyXG4gICAgICB9XHJcbiAgICAgIC8vIE5hbWVkIGNvbG9yc1xyXG4gICAgICBjb25zdCBuYW1lZENvbG9yczogUmVjb3JkPHN0cmluZywgbnVtYmVyPiA9IHtcclxuICAgICAgICBkZWZhdWx0OiAweDAwMDAwMCxcclxuICAgICAgICB3aGl0ZTogMHhGRkZGRkYsXHJcbiAgICAgICAgYXF1YTogMHgxQUJDOUMsXHJcbiAgICAgICAgZ3JlZW46IDB4NTdGMjg3LFxyXG4gICAgICAgIGJsdWU6IDB4MzQ5OERCLFxyXG4gICAgICAgIHllbGxvdzogMHhGRUU3NUMsXHJcbiAgICAgICAgcHVycGxlOiAweDlCNTlCNixcclxuICAgICAgICBmdWNoc2lhOiAweEVCNDU5RSxcclxuICAgICAgICBnb2xkOiAweEYxQzQwRixcclxuICAgICAgICBvcmFuZ2U6IDB4RTY3RTIyLFxyXG4gICAgICAgIHJlZDogMHhFRDQyNDUsXHJcbiAgICAgICAgZ3JleTogMHg5NUE1QTYsXHJcbiAgICAgICAgbmF2eTogMHgzNDQ5NUUsXHJcbiAgICAgICAgYmx1cnBsZTogMHg1ODY1RjIsXHJcbiAgICAgIH07XHJcbiAgICAgIGNvbnN0IGxvd2VyID0gY29sb3IudG9Mb3dlckNhc2UoKTtcclxuICAgICAgaWYgKGxvd2VyIGluIG5hbWVkQ29sb3JzKSByZXR1cm4gbmFtZWRDb2xvcnNbbG93ZXJdO1xyXG4gICAgICByZXR1cm4gcGFyc2VJbnQoY29sb3IsIDE2KTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgaWYgKEFycmF5LmlzQXJyYXkoY29sb3IpKSB7XHJcbiAgICAgIHJldHVybiAoY29sb3JbMF0gPDwgMTYpICsgKGNvbG9yWzFdIDw8IDgpICsgY29sb3JbMl07XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0ludmFsaWQgY29sb3IgdHlwZScpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVzb2x2ZXMgYSBzdHJpbmcgdG8gYSBzbm93Zmxha2UgSURcclxuICAgKiBAcGFyYW0gdmFsdWUgVGhlIHZhbHVlIHRvIHJlc29sdmVcclxuICAgKi9cclxuICBzdGF0aWMgcmVzb2x2ZVNub3dmbGFrZSh2YWx1ZTogc3RyaW5nIHwgbnVtYmVyIHwgeyBpZDogc3RyaW5nIHwgbnVtYmVyIH0pOiBzdHJpbmcge1xyXG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgJ2lkJyBpbiB2YWx1ZSkge1xyXG4gICAgICByZXR1cm4gU3RyaW5nKHZhbHVlLmlkKTtcclxuICAgIH1cclxuICAgIHJldHVybiBTdHJpbmcodmFsdWUpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVzb2x2ZXMgYW4gaW1hZ2UgdG8gYSBiYXNlNjQgZGF0YSBVUklcclxuICAgKiBAcGFyYW0gaW1hZ2UgVGhlIGltYWdlIHRvIHJlc29sdmVcclxuICAgKi9cclxuICBzdGF0aWMgYXN5bmMgcmVzb2x2ZUltYWdlKGltYWdlOiBCdWZmZXJSZXNvbHZhYmxlKTogUHJvbWlzZTxzdHJpbmc+IHtcclxuICAgIGNvbnN0IGJ1ZmZlciA9IGF3YWl0IHRoaXMucmVzb2x2ZUJ1ZmZlcihpbWFnZSk7XHJcbiAgICBcclxuICAgIC8vIERldGVjdCBNSU1FIHR5cGUgZnJvbSBtYWdpYyBieXRlc1xyXG4gICAgbGV0IG1pbWVUeXBlID0gJ2ltYWdlL3BuZyc7XHJcbiAgICBpZiAoYnVmZmVyWzBdID09PSAweEZGICYmIGJ1ZmZlclsxXSA9PT0gMHhEOCkge1xyXG4gICAgICBtaW1lVHlwZSA9ICdpbWFnZS9qcGVnJztcclxuICAgIH0gZWxzZSBpZiAoYnVmZmVyWzBdID09PSAweDQ3ICYmIGJ1ZmZlclsxXSA9PT0gMHg0OSAmJiBidWZmZXJbMl0gPT09IDB4NDYpIHtcclxuICAgICAgbWltZVR5cGUgPSAnaW1hZ2UvZ2lmJztcclxuICAgIH0gZWxzZSBpZiAoYnVmZmVyWzBdID09PSAweDUyICYmIGJ1ZmZlclsxXSA9PT0gMHg0OSAmJiBidWZmZXJbMl0gPT09IDB4NDYgJiYgYnVmZmVyWzNdID09PSAweDQ2KSB7XHJcbiAgICAgIG1pbWVUeXBlID0gJ2ltYWdlL3dlYnAnO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICByZXR1cm4gYGRhdGE6JHttaW1lVHlwZX07YmFzZTY0LCR7YnVmZmVyLnRvU3RyaW5nKCdiYXNlNjQnKX1gO1xyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgRGF0YVJlc29sdmVyO1xyXG4iXX0=