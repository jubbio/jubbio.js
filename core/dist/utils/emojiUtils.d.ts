/**
 * Emoji utilities for converting between unicode and shortcode formats
 * Backend only accepts :shortcode: format, not unicode characters
 */
/**
 * Convert a unicode emoji to shortcode format
 * @param emoji - Unicode emoji character (e.g., "👍")
 * @returns Shortcode format (e.g., ":thumbsup:") or null if not found
 *
 * @example
 * unicodeToShortcode('👍') // ':+1:'
 * unicodeToShortcode('❤️') // ':heart:'
 * unicodeToShortcode('🎉') // ':tada:'
 */
export declare function unicodeToShortcode(emoji: string): string | null;
/**
 * Check if a string is a unicode emoji (not ASCII)
 */
export declare function isUnicodeEmoji(str: string): boolean;
/**
 * Check if a string is already in shortcode format
 */
export declare function isShortcode(str: string): boolean;
/**
 * Check if a string is a custom emoji format
 */
export declare function isCustomEmoji(str: string): boolean;
/**
 * Normalize emoji to backend-compatible format
 * Converts unicode emoji to shortcode, passes through shortcode and custom emoji as-is
 *
 * @param emoji - Emoji in any format
 * @returns Emoji in backend-compatible format (:shortcode: or <:name:id>)
 * @throws Error if unicode emoji is not recognized
 *
 * @example
 * normalizeEmoji('👍')           // ':+1:'
 * normalizeEmoji(':thumbsup:')   // ':thumbsup:'
 * normalizeEmoji('<:custom:123>') // '<:custom:123>'
 */
export declare function normalizeEmoji(emoji: string): string;
