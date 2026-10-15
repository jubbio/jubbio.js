/**
 * Data resolver utilities for handling various data types
 * 
 * SECURITY NOTE: This module handles file operations. Path traversal protection
 * is implemented to prevent reading files outside allowed directories.
 * Bot developers should set allowed directories via DataResolver.setAllowedPaths()
 */

import { readFile } from 'fs/promises';
import { basename, resolve, normalize, isAbsolute } from 'path';

export type BufferResolvable = Buffer | string;
export type Base64Resolvable = Buffer | string;

/**
 * Validates that a path doesn't escape allowed directories (path traversal protection)
 * @param filePath The path to validate
 * @param allowedPaths Array of allowed base directories (if empty, all paths are allowed for backwards compatibility)
 * @throws Error if path traversal is detected
 */
function validatePath(filePath: string, allowedPaths: string[]): string {
  // Normalize and resolve the path to prevent ../ attacks
  const normalizedPath = normalize(resolve(filePath));
  
  // If no allowed paths configured, allow all (backwards compatibility)
  // Bot developers should configure allowed paths for security
  if (allowedPaths.length === 0) {
    return normalizedPath;
  }
  
  // Check if the normalized path starts with any allowed directory
  const isAllowed = allowedPaths.some(allowedDir => {
    const normalizedAllowed = normalize(resolve(allowedDir));
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
export class DataResolver {
  /** Allowed directories for file operations (empty = allow all for backwards compatibility) */
  private static allowedPaths: string[] = [];
  
  /**
   * Set allowed directories for file operations (security hardening)
   * @param paths Array of allowed base directories
   * @example
   * // Only allow files from assets and uploads directories
   * DataResolver.setAllowedPaths(['./assets', './uploads']);
   */
  static setAllowedPaths(paths: string[]): void {
    this.allowedPaths = paths.map(p => normalize(resolve(p)));
  }
  
  /**
   * Get currently allowed paths
   */
  static getAllowedPaths(): string[] {
    return [...this.allowedPaths];
  }

  /**
   * Resolves a BufferResolvable to a Buffer
   * @param resource The resource to resolve
   * @throws Error if path traversal is detected (when allowedPaths is configured)
   */
  static async resolveBuffer(resource: BufferResolvable): Promise<Buffer> {
    if (Buffer.isBuffer(resource)) return resource;
    
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
        return readFile(safePath);
      }
      
      // Assume it's a relative file path
      const safePath = validatePath(resource, this.allowedPaths);
      return readFile(safePath);
    }
    
    throw new TypeError('Invalid resource type');
  }

  /**
   * Resolves a Base64Resolvable to a base64 string
   * @param resource The resource to resolve
   * @param mimeType The MIME type for the data URI
   */
  static async resolveBase64(resource: Base64Resolvable, mimeType = 'image/png'): Promise<string> {
    const buffer = await this.resolveBuffer(resource);
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  }

  /**
   * Resolves a file to a name and buffer
   * @param resource The file resource
   */
  static async resolveFile(resource: BufferResolvable | { name?: string; attachment: BufferResolvable }): Promise<{ name: string; data: Buffer }> {
    if (typeof resource === 'object' && 'attachment' in resource) {
      const buffer = await this.resolveBuffer(resource.attachment);
      const name = resource.name ?? 'file';
      return { name, data: buffer };
    }
    
    const buffer = await this.resolveBuffer(resource);
    const name = typeof resource === 'string' ? basename(resource) : 'file';
    return { name, data: buffer };
  }

  /**
   * Resolves multiple files
   * @param resources The file resources
   */
  static async resolveFiles(resources: (BufferResolvable | { name?: string; attachment: BufferResolvable })[]): Promise<{ name: string; data: Buffer }[]> {
    return Promise.all(resources.map(r => this.resolveFile(r)));
  }

  /**
   * Resolves a color to a number
   * @param color The color to resolve
   */
  static resolveColor(color: number | string | [number, number, number] | null): number | null {
    if (color === null) return null;
    
    if (typeof color === 'number') {
      if (color < 0 || color > 0xFFFFFF) throw new RangeError('Color must be between 0 and 16777215');
      return color;
    }
    
    if (typeof color === 'string') {
      if (color.startsWith('#')) {
        return parseInt(color.slice(1), 16);
      }
      // Named colors
      const namedColors: Record<string, number> = {
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
      if (lower in namedColors) return namedColors[lower];
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
  static resolveSnowflake(value: string | number | { id: string | number }): string {
    if (typeof value === 'object' && 'id' in value) {
      return String(value.id);
    }
    return String(value);
  }

  /**
   * Resolves an image to a base64 data URI
   * @param image The image to resolve
   */
  static async resolveImage(image: BufferResolvable): Promise<string> {
    const buffer = await this.resolveBuffer(image);
    
    // Detect MIME type from magic bytes
    let mimeType = 'image/png';
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
      mimeType = 'image/jpeg';
    } else if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
      mimeType = 'image/gif';
    } else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
      mimeType = 'image/webp';
    }
    
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  }
}

export default DataResolver;
