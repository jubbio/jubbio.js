/**
 * Emoji utilities for converting between unicode and shortcode formats
 * ponytail: Backend only accepts :shortcode: format, not unicode characters
 */

import shortcodes from './emojiShortcodes.json';

// Type the imported JSON as a record
const emojiToShortcode: Record<string, string> = shortcodes as Record<string, string>;

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
export function unicodeToShortcode(emoji: string): string | null {
  const shortcode = emojiToShortcode[emoji];
  if (shortcode) {
    return `:${shortcode}:`;
  }
  return null;
}

/**
 * Check if a string is a unicode emoji (not ASCII)
 */
export function isUnicodeEmoji(str: string): boolean {
  // If it contains only non-ASCII characters and is short, it's likely an emoji
  return str.length > 0 && str.length <= 8 && !/^[\x00-\x7F]+$/.test(str);
}

/**
 * Check if a string is already in shortcode format
 */
export function isShortcode(str: string): boolean {
  return /^:\w+:$/.test(str);
}

/**
 * Check if a string is a custom emoji format
 */
export function isCustomEmoji(str: string): boolean {
  return /^<a?:\w+:\d+>$/.test(str);
}

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
export function normalizeEmoji(emoji: string): string {
  const trimmed = emoji.trim();
  
  // Already shortcode format
  if (isShortcode(trimmed)) {
    return trimmed;
  }
  
  // Custom emoji format - pass through
  if (isCustomEmoji(trimmed)) {
    return trimmed;
  }
  
  // Try to convert unicode to shortcode
  if (isUnicodeEmoji(trimmed)) {
    const shortcode = unicodeToShortcode(trimmed);
    if (shortcode) {
      return shortcode;
    }
    throw new Error(
      `Tanınmayan emoji: "${emoji}". Lütfen :emoji_adi: formatında kullanın (örn: :thumbsup:, :heart:)`
    );
  }
  
  throw new Error(
    `Geçersiz emoji formatı: "${emoji}". Kabul edilen formatlar: :emoji_adi:, <:name:id>, <a:name:id>`
  );
}
