"use strict";
/**
 * Emoji utilities for converting between unicode and shortcode formats
 * Backend only accepts :shortcode: format, not unicode characters
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.unicodeToShortcode = unicodeToShortcode;
exports.isUnicodeEmoji = isUnicodeEmoji;
exports.isShortcode = isShortcode;
exports.isCustomEmoji = isCustomEmoji;
exports.normalizeEmoji = normalizeEmoji;
const emojiShortcodes_json_1 = __importDefault(require("./emojiShortcodes.json"));
// Type the imported JSON as a record
const emojiToShortcode = emojiShortcodes_json_1.default;
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
function unicodeToShortcode(emoji) {
    const shortcode = emojiToShortcode[emoji];
    if (shortcode) {
        return `:${shortcode}:`;
    }
    return null;
}
/**
 * Check if a string is a unicode emoji (not ASCII)
 */
function isUnicodeEmoji(str) {
    // If it contains only non-ASCII characters and is short, it's likely an emoji
    return str.length > 0 && str.length <= 8 && !/^[\x00-\x7F]+$/.test(str);
}
/**
 * Check if a string is already in shortcode format
 */
function isShortcode(str) {
    return /^:\w+:$/.test(str);
}
/**
 * Check if a string is a custom emoji format
 */
function isCustomEmoji(str) {
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
function normalizeEmoji(emoji) {
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
        throw new Error(`Tanınmayan emoji: "${emoji}". Lütfen :emoji_adi: formatında kullanın (örn: :thumbsup:, :heart:)`);
    }
    throw new Error(`Geçersiz emoji formatı: "${emoji}". Kabul edilen formatlar: :emoji_adi:, <:name:id>, <a:name:id>`);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW1vamlVdGlscy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91dGlscy9lbW9qaVV0aWxzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7O0dBR0c7Ozs7O0FBaUJILGdEQU1DO0FBS0Qsd0NBR0M7QUFLRCxrQ0FFQztBQUtELHNDQUVDO0FBZUQsd0NBMkJDO0FBckZELGtGQUFnRDtBQUVoRCxxQ0FBcUM7QUFDckMsTUFBTSxnQkFBZ0IsR0FBMkIsOEJBQW9DLENBQUM7QUFFdEY7Ozs7Ozs7OztHQVNHO0FBQ0gsU0FBZ0Isa0JBQWtCLENBQUMsS0FBYTtJQUM5QyxNQUFNLFNBQVMsR0FBRyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUMxQyxJQUFJLFNBQVMsRUFBRSxDQUFDO1FBQ2QsT0FBTyxJQUFJLFNBQVMsR0FBRyxDQUFDO0lBQzFCLENBQUM7SUFDRCxPQUFPLElBQUksQ0FBQztBQUNkLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQWdCLGNBQWMsQ0FBQyxHQUFXO0lBQ3hDLDhFQUE4RTtJQUM5RSxPQUFPLEdBQUcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQzFFLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQWdCLFdBQVcsQ0FBQyxHQUFXO0lBQ3JDLE9BQU8sU0FBUyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUM3QixDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFnQixhQUFhLENBQUMsR0FBVztJQUN2QyxPQUFPLGdCQUFnQixDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUNwQyxDQUFDO0FBRUQ7Ozs7Ozs7Ozs7OztHQVlHO0FBQ0gsU0FBZ0IsY0FBYyxDQUFDLEtBQWE7SUFDMUMsTUFBTSxPQUFPLEdBQUcsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDO0lBRTdCLDJCQUEyQjtJQUMzQixJQUFJLFdBQVcsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1FBQ3pCLE9BQU8sT0FBTyxDQUFDO0lBQ2pCLENBQUM7SUFFRCxxQ0FBcUM7SUFDckMsSUFBSSxhQUFhLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztRQUMzQixPQUFPLE9BQU8sQ0FBQztJQUNqQixDQUFDO0lBRUQsc0NBQXNDO0lBQ3RDLElBQUksY0FBYyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7UUFDNUIsTUFBTSxTQUFTLEdBQUcsa0JBQWtCLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDOUMsSUFBSSxTQUFTLEVBQUUsQ0FBQztZQUNkLE9BQU8sU0FBUyxDQUFDO1FBQ25CLENBQUM7UUFDRCxNQUFNLElBQUksS0FBSyxDQUNiLHNCQUFzQixLQUFLLHNFQUFzRSxDQUNsRyxDQUFDO0lBQ0osQ0FBQztJQUVELE1BQU0sSUFBSSxLQUFLLENBQ2IsNEJBQTRCLEtBQUssaUVBQWlFLENBQ25HLENBQUM7QUFDSixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIEVtb2ppIHV0aWxpdGllcyBmb3IgY29udmVydGluZyBiZXR3ZWVuIHVuaWNvZGUgYW5kIHNob3J0Y29kZSBmb3JtYXRzXHJcbiAqIEJhY2tlbmQgb25seSBhY2NlcHRzIDpzaG9ydGNvZGU6IGZvcm1hdCwgbm90IHVuaWNvZGUgY2hhcmFjdGVyc1xyXG4gKi9cclxuXHJcbmltcG9ydCBzaG9ydGNvZGVzIGZyb20gJy4vZW1vamlTaG9ydGNvZGVzLmpzb24nO1xyXG5cclxuLy8gVHlwZSB0aGUgaW1wb3J0ZWQgSlNPTiBhcyBhIHJlY29yZFxyXG5jb25zdCBlbW9qaVRvU2hvcnRjb2RlOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0gc2hvcnRjb2RlcyBhcyBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xyXG5cclxuLyoqXHJcbiAqIENvbnZlcnQgYSB1bmljb2RlIGVtb2ppIHRvIHNob3J0Y29kZSBmb3JtYXRcclxuICogQHBhcmFtIGVtb2ppIC0gVW5pY29kZSBlbW9qaSBjaGFyYWN0ZXIgKGUuZy4sIFwi8J+RjVwiKVxyXG4gKiBAcmV0dXJucyBTaG9ydGNvZGUgZm9ybWF0IChlLmcuLCBcIjp0aHVtYnN1cDpcIikgb3IgbnVsbCBpZiBub3QgZm91bmRcclxuICogXHJcbiAqIEBleGFtcGxlXHJcbiAqIHVuaWNvZGVUb1Nob3J0Y29kZSgn8J+RjScpIC8vICc6KzE6J1xyXG4gKiB1bmljb2RlVG9TaG9ydGNvZGUoJ+KdpO+4jycpIC8vICc6aGVhcnQ6J1xyXG4gKiB1bmljb2RlVG9TaG9ydGNvZGUoJ/CfjoknKSAvLyAnOnRhZGE6J1xyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHVuaWNvZGVUb1Nob3J0Y29kZShlbW9qaTogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XHJcbiAgY29uc3Qgc2hvcnRjb2RlID0gZW1vamlUb1Nob3J0Y29kZVtlbW9qaV07XHJcbiAgaWYgKHNob3J0Y29kZSkge1xyXG4gICAgcmV0dXJuIGA6JHtzaG9ydGNvZGV9OmA7XHJcbiAgfVxyXG4gIHJldHVybiBudWxsO1xyXG59XHJcblxyXG4vKipcclxuICogQ2hlY2sgaWYgYSBzdHJpbmcgaXMgYSB1bmljb2RlIGVtb2ppIChub3QgQVNDSUkpXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gaXNVbmljb2RlRW1vamkoc3RyOiBzdHJpbmcpOiBib29sZWFuIHtcclxuICAvLyBJZiBpdCBjb250YWlucyBvbmx5IG5vbi1BU0NJSSBjaGFyYWN0ZXJzIGFuZCBpcyBzaG9ydCwgaXQncyBsaWtlbHkgYW4gZW1vamlcclxuICByZXR1cm4gc3RyLmxlbmd0aCA+IDAgJiYgc3RyLmxlbmd0aCA8PSA4ICYmICEvXltcXHgwMC1cXHg3Rl0rJC8udGVzdChzdHIpO1xyXG59XHJcblxyXG4vKipcclxuICogQ2hlY2sgaWYgYSBzdHJpbmcgaXMgYWxyZWFkeSBpbiBzaG9ydGNvZGUgZm9ybWF0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gaXNTaG9ydGNvZGUoc3RyOiBzdHJpbmcpOiBib29sZWFuIHtcclxuICByZXR1cm4gL146XFx3KzokLy50ZXN0KHN0cik7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDaGVjayBpZiBhIHN0cmluZyBpcyBhIGN1c3RvbSBlbW9qaSBmb3JtYXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBpc0N1c3RvbUVtb2ppKHN0cjogc3RyaW5nKTogYm9vbGVhbiB7XHJcbiAgcmV0dXJuIC9ePGE/Olxcdys6XFxkKz4kLy50ZXN0KHN0cik7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBOb3JtYWxpemUgZW1vamkgdG8gYmFja2VuZC1jb21wYXRpYmxlIGZvcm1hdFxyXG4gKiBDb252ZXJ0cyB1bmljb2RlIGVtb2ppIHRvIHNob3J0Y29kZSwgcGFzc2VzIHRocm91Z2ggc2hvcnRjb2RlIGFuZCBjdXN0b20gZW1vamkgYXMtaXNcclxuICogXHJcbiAqIEBwYXJhbSBlbW9qaSAtIEVtb2ppIGluIGFueSBmb3JtYXRcclxuICogQHJldHVybnMgRW1vamkgaW4gYmFja2VuZC1jb21wYXRpYmxlIGZvcm1hdCAoOnNob3J0Y29kZTogb3IgPDpuYW1lOmlkPilcclxuICogQHRocm93cyBFcnJvciBpZiB1bmljb2RlIGVtb2ppIGlzIG5vdCByZWNvZ25pemVkXHJcbiAqIFxyXG4gKiBAZXhhbXBsZVxyXG4gKiBub3JtYWxpemVFbW9qaSgn8J+RjScpICAgICAgICAgICAvLyAnOisxOidcclxuICogbm9ybWFsaXplRW1vamkoJzp0aHVtYnN1cDonKSAgIC8vICc6dGh1bWJzdXA6J1xyXG4gKiBub3JtYWxpemVFbW9qaSgnPDpjdXN0b206MTIzPicpIC8vICc8OmN1c3RvbToxMjM+J1xyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIG5vcm1hbGl6ZUVtb2ppKGVtb2ppOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gIGNvbnN0IHRyaW1tZWQgPSBlbW9qaS50cmltKCk7XHJcbiAgXHJcbiAgLy8gQWxyZWFkeSBzaG9ydGNvZGUgZm9ybWF0XHJcbiAgaWYgKGlzU2hvcnRjb2RlKHRyaW1tZWQpKSB7XHJcbiAgICByZXR1cm4gdHJpbW1lZDtcclxuICB9XHJcbiAgXHJcbiAgLy8gQ3VzdG9tIGVtb2ppIGZvcm1hdCAtIHBhc3MgdGhyb3VnaFxyXG4gIGlmIChpc0N1c3RvbUVtb2ppKHRyaW1tZWQpKSB7XHJcbiAgICByZXR1cm4gdHJpbW1lZDtcclxuICB9XHJcbiAgXHJcbiAgLy8gVHJ5IHRvIGNvbnZlcnQgdW5pY29kZSB0byBzaG9ydGNvZGVcclxuICBpZiAoaXNVbmljb2RlRW1vamkodHJpbW1lZCkpIHtcclxuICAgIGNvbnN0IHNob3J0Y29kZSA9IHVuaWNvZGVUb1Nob3J0Y29kZSh0cmltbWVkKTtcclxuICAgIGlmIChzaG9ydGNvZGUpIHtcclxuICAgICAgcmV0dXJuIHNob3J0Y29kZTtcclxuICAgIH1cclxuICAgIHRocm93IG5ldyBFcnJvcihcclxuICAgICAgYFRhbsSxbm1heWFuIGVtb2ppOiBcIiR7ZW1vaml9XCIuIEzDvHRmZW4gOmVtb2ppX2FkaTogZm9ybWF0xLFuZGEga3VsbGFuxLFuICjDtnJuOiA6dGh1bWJzdXA6LCA6aGVhcnQ6KWBcclxuICAgICk7XHJcbiAgfVxyXG4gIFxyXG4gIHRocm93IG5ldyBFcnJvcihcclxuICAgIGBHZcOnZXJzaXogZW1vamkgZm9ybWF0xLE6IFwiJHtlbW9qaX1cIi4gS2FidWwgZWRpbGVuIGZvcm1hdGxhcjogOmVtb2ppX2FkaTosIDw6bmFtZTppZD4sIDxhOm5hbWU6aWQ+YFxyXG4gICk7XHJcbn1cclxuIl19