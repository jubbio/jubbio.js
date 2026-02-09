"use strict";
/**
 * Formatters for markdown and mentions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Formatters = exports.TimestampStyles = void 0;
exports.userMention = userMention;
exports.channelMention = channelMention;
exports.roleMention = roleMention;
exports.formatEmoji = formatEmoji;
exports.bold = bold;
exports.italic = italic;
exports.underline = underline;
exports.strikethrough = strikethrough;
exports.spoiler = spoiler;
exports.inlineCode = inlineCode;
exports.codeBlock = codeBlock;
exports.blockQuote = blockQuote;
exports.quote = quote;
exports.hyperlink = hyperlink;
exports.hideLinkEmbed = hideLinkEmbed;
exports.time = time;
exports.heading = heading;
exports.unorderedList = unorderedList;
exports.orderedList = orderedList;
/**
 * Formats a user mention
 * @param userId The user ID to mention
 */
function userMention(userId) {
    return `<@${userId}>`;
}
/**
 * Formats a channel mention
 * @param channelId The channel ID to mention
 */
function channelMention(channelId) {
    return `<#${channelId}>`;
}
/**
 * Formats a role mention
 * @param roleId The role ID to mention
 */
function roleMention(roleId) {
    return `<@&${roleId}>`;
}
/**
 * Formats a custom emoji
 * @param emojiId The emoji ID
 * @param name The emoji name
 * @param animated Whether the emoji is animated
 */
function formatEmoji(emojiId, name, animated = false) {
    return `<${animated ? 'a' : ''}:${name}:${emojiId}>`;
}
/**
 * Formats text as bold
 * @param text The text to format
 */
function bold(text) {
    return `**${text}**`;
}
/**
 * Formats text as italic
 * @param text The text to format
 */
function italic(text) {
    return `*${text}*`;
}
/**
 * Formats text as underline
 * @param text The text to format
 */
function underline(text) {
    return `__${text}__`;
}
/**
 * Formats text as strikethrough
 * @param text The text to format
 */
function strikethrough(text) {
    return `~~${text}~~`;
}
/**
 * Formats text as spoiler
 * @param text The text to format
 */
function spoiler(text) {
    return `||${text}||`;
}
/**
 * Formats text as inline code
 * @param text The text to format
 */
function inlineCode(text) {
    return `\`${text}\``;
}
/**
 * Formats text as a code block
 * @param text The text to format
 * @param language The language for syntax highlighting
 */
function codeBlock(text, language) {
    return `\`\`\`${language ?? ''}\n${text}\n\`\`\``;
}
/**
 * Formats text as a block quote
 * @param text The text to format
 */
function blockQuote(text) {
    return `>>> ${text}`;
}
/**
 * Formats text as a single-line quote
 * @param text The text to format
 */
function quote(text) {
    return `> ${text}`;
}
/**
 * Formats a URL as a hyperlink
 * @param text The text to display
 * @param url The URL to link to
 * @param title Optional title for the link
 */
function hyperlink(text, url, title) {
    return title ? `[${text}](${url} "${title}")` : `[${text}](${url})`;
}
/**
 * Formats a URL to hide the embed
 * @param url The URL to format
 */
function hideLinkEmbed(url) {
    return `<${url}>`;
}
/**
 * Time format styles
 */
var TimestampStyles;
(function (TimestampStyles) {
    /** Short time format (e.g., 16:20) */
    TimestampStyles["ShortTime"] = "t";
    /** Long time format (e.g., 16:20:30) */
    TimestampStyles["LongTime"] = "T";
    /** Short date format (e.g., 20/04/2021) */
    TimestampStyles["ShortDate"] = "d";
    /** Long date format (e.g., 20 April 2021) */
    TimestampStyles["LongDate"] = "D";
    /** Short date/time format (e.g., 20 April 2021 16:20) */
    TimestampStyles["ShortDateTime"] = "f";
    /** Long date/time format (e.g., Tuesday, 20 April 2021 16:20) */
    TimestampStyles["LongDateTime"] = "F";
    /** Relative time format (e.g., 2 months ago) */
    TimestampStyles["RelativeTime"] = "R";
})(TimestampStyles || (exports.TimestampStyles = TimestampStyles = {}));
/**
 * Formats a timestamp
 * @param timestamp The timestamp (Date, number in ms, or seconds)
 * @param style The style to use
 */
function time(timestamp, style) {
    const seconds = timestamp instanceof Date
        ? Math.floor(timestamp.getTime() / 1000)
        : typeof timestamp === 'number' && timestamp > 1e12
            ? Math.floor(timestamp / 1000)
            : timestamp;
    return style ? `<t:${seconds}:${style}>` : `<t:${seconds}>`;
}
/**
 * Formats a heading (H1)
 * @param text The text to format
 */
function heading(text, level = 1) {
    return `${'#'.repeat(level)} ${text}`;
}
/**
 * Formats an unordered list
 * @param items The items to list
 */
function unorderedList(items) {
    return items.map(item => `- ${item}`).join('\n');
}
/**
 * Formats an ordered list
 * @param items The items to list
 */
function orderedList(items) {
    return items.map((item, i) => `${i + 1}. ${item}`).join('\n');
}
// Export all formatters as a namespace too (DJS compatibility)
exports.Formatters = {
    userMention,
    channelMention,
    roleMention,
    formatEmoji,
    bold,
    italic,
    underline,
    strikethrough,
    spoiler,
    inlineCode,
    codeBlock,
    blockQuote,
    quote,
    hyperlink,
    hideLinkEmbed,
    time,
    heading,
    unorderedList,
    orderedList,
    TimestampStyles,
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRm9ybWF0dGVycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91dGlscy9Gb3JtYXR0ZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7R0FFRzs7O0FBTUgsa0NBRUM7QUFNRCx3Q0FFQztBQU1ELGtDQUVDO0FBUUQsa0NBRUM7QUFNRCxvQkFFQztBQU1ELHdCQUVDO0FBTUQsOEJBRUM7QUFNRCxzQ0FFQztBQU1ELDBCQUVDO0FBTUQsZ0NBRUM7QUFPRCw4QkFFQztBQU1ELGdDQUVDO0FBTUQsc0JBRUM7QUFRRCw4QkFFQztBQU1ELHNDQUVDO0FBMkJELG9CQVFDO0FBTUQsMEJBRUM7QUFNRCxzQ0FFQztBQU1ELGtDQUVDO0FBdExEOzs7R0FHRztBQUNILFNBQWdCLFdBQVcsQ0FBQyxNQUF1QjtJQUNqRCxPQUFPLEtBQUssTUFBTSxHQUFHLENBQUM7QUFDeEIsQ0FBQztBQUVEOzs7R0FHRztBQUNILFNBQWdCLGNBQWMsQ0FBQyxTQUEwQjtJQUN2RCxPQUFPLEtBQUssU0FBUyxHQUFHLENBQUM7QUFDM0IsQ0FBQztBQUVEOzs7R0FHRztBQUNILFNBQWdCLFdBQVcsQ0FBQyxNQUF1QjtJQUNqRCxPQUFPLE1BQU0sTUFBTSxHQUFHLENBQUM7QUFDekIsQ0FBQztBQUVEOzs7OztHQUtHO0FBQ0gsU0FBZ0IsV0FBVyxDQUFDLE9BQXdCLEVBQUUsSUFBWSxFQUFFLFFBQVEsR0FBRyxLQUFLO0lBQ2xGLE9BQU8sSUFBSSxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLElBQUksSUFBSSxPQUFPLEdBQUcsQ0FBQztBQUN2RCxDQUFDO0FBRUQ7OztHQUdHO0FBQ0gsU0FBZ0IsSUFBSSxDQUFDLElBQVk7SUFDL0IsT0FBTyxLQUFLLElBQUksSUFBSSxDQUFDO0FBQ3ZCLENBQUM7QUFFRDs7O0dBR0c7QUFDSCxTQUFnQixNQUFNLENBQUMsSUFBWTtJQUNqQyxPQUFPLElBQUksSUFBSSxH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Q0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDbkQsQ0FBQztBQUVEOzs7R0FHRztBQUNILFNBQWdCLFdBQVcsQ0FBQyxLQUFlO0lBQ3pDLE9BQU8sS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxJQUFJLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNoRSxDQUFDO0FBRUQsK0RBQStEO0FBQ2xELFFBQUEsVUFBVSxHQUFHO0lBQ3hCLFdBQVc7SUFDWCxjQUFjO0lBQ2QsV0FBVztJQUNYLFdBQVc7SUFDWCxJQUFJO0lBQ0osTUFBTTtJQUNOLFNBQVM7SUFDVCxhQUFhO0lBQ2IsT0FBTztJQUNQLFVBQVU7SUFDVixTQUFTO0lBQ1QsVUFBVTtJQUNWLEtBQUs7SUFDTCxTQUFTO0lBQ1QsYUFBYTtJQUNiLElBQUk7SUFDSixPQUFPO0lBQ1AsYUFBYTtJQUNiLFdBQVc7SUFDWCxlQUFlO0NBQ2hCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogRm9ybWF0dGVycyBmb3IgbWFya2Rvd24gYW5kIG1lbnRpb25zXHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIEZvcm1hdHMgYSB1c2VyIG1lbnRpb25cclxuICogQHBhcmFtIHVzZXJJZCBUaGUgdXNlciBJRCB0byBtZW50aW9uXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gdXNlck1lbnRpb24odXNlcklkOiBzdHJpbmcgfCBudW1iZXIpOiBzdHJpbmcge1xyXG4gIHJldHVybiBgPEAke3VzZXJJZH0+YDtcclxufVxyXG5cclxuLyoqXHJcbiAqIEZvcm1hdHMgYSBjaGFubmVsIG1lbnRpb25cclxuICogQHBhcmFtIGNoYW5uZWxJZCBUaGUgY2hhbm5lbCBJRCB0byBtZW50aW9uXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gY2hhbm5lbE1lbnRpb24oY2hhbm5lbElkOiBzdHJpbmcgfCBudW1iZXIpOiBzdHJpbmcge1xyXG4gIHJldHVybiBgPCMke2NoYW5uZWxJZH0+YDtcclxufVxyXG5cclxuLyoqXHJcbiAqIEZvcm1hdHMgYSByb2xlIG1lbnRpb25cclxuICogQHBhcmFtIHJvbGVJZCBUaGUgcm9sZSBJRCB0byBtZW50aW9uXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gcm9sZU1lbnRpb24ocm9sZUlkOiBzdHJpbmcgfCBudW1iZXIpOiBzdHJpbmcge1xyXG4gIHJldHVybiBgPEAmJHtyb2xlSWR9PmA7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBGb3JtYXRzIGEgY3VzdG9tIGVtb2ppXHJcbiAqIEBwYXJhbSBlbW9qaUlkIFRoZSBlbW9qaSBJRFxyXG4gKiBAcGFyYW0gbmFtZSBUaGUgZW1vamkgbmFtZVxyXG4gKiBAcGFyYW0gYW5pbWF0ZWQgV2hldGhlciB0aGUgZW1vamkgaXMgYW5pbWF0ZWRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBmb3JtYXRFbW9qaShlbW9qaUlkOiBzdHJpbmcgfCBudW1iZXIsIG5hbWU6IHN0cmluZywgYW5pbWF0ZWQgPSBmYWxzZSk6IHN0cmluZyB7XHJcbiAgcmV0dXJuIGA8JHthbmltYXRlZCA/ICdhJyA6ICcnfToke25hbWV9OiR7ZW1vamlJZH0+YDtcclxufVxyXG5cclxuLyoqXHJcbiAqIEZvcm1hdHMgdGV4dCBhcyBib2xkXHJcbiAqIEBwYXJhbSB0ZXh0IFRoZSB0ZXh0IHRvIGZvcm1hdFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGJvbGQodGV4dDogc3RyaW5nKTogc3RyaW5nIHtcclxuICByZXR1cm4gYCoqJHt0ZXh0fSoqYDtcclxufVxyXG5cclxuLyoqXHJcbiAqIEZvcm1hdHMgdGV4dCBhcyBpdGFsaWNcclxuICogQHBhcmFtIHRleHQgVGhlIHRleHQgdG8gZm9ybWF0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gaXRhbGljKHRleHQ6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgcmV0dXJuIGAqJHt0ZXh0fSpgO1xyXG59XHJcblxyXG4vKipcclxuICogRm9ybWF0cyB0ZXh0IGFzIHVuZGVybGluZVxyXG4gKiBAcGFyYW0gdGV4dCBUaGUgdGV4dCB0byBmb3JtYXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiB1bmRlcmxpbmUodGV4dDogc3RyaW5nKTogc3RyaW5nIHtcclxuICByZXR1cm4gYF9fJHt0ZXh0fV9fYDtcclxufVxyXG5cclxuLyoqXHJcbiAqIEZvcm1hdHMgdGV4dCBhcyBzdHJpa2V0aHJvdWdoXHJcbiAqIEBwYXJhbSB0ZXh0IFRoZSB0ZXh0IHRvIGZvcm1hdFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHN0cmlrZXRocm91Z2godGV4dDogc3RyaW5nKTogc3RyaW5nIHtcclxuICByZXR1cm4gYH5+JHt0ZXh0fX5+YDtcclxufVxyXG5cclxuLyoqXHJcbiAqIEZvcm1hdHMgdGV4dCBhcyBzcG9pbGVyXHJcbiAqIEBwYXJhbSB0ZXh0IFRoZSB0ZXh0IHRvIGZvcm1hdFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHNwb2lsZXIodGV4dDogc3RyaW5nKTogc3RyaW5nIHtcclxuICByZXR1cm4gYHx8JHt0ZXh0fXx8YDtcclxufVxyXG5cclxuLyoqXHJcbiAqIEZvcm1hdHMgdGV4dCBhcyBpbmxpbmUgY29kZVxyXG4gKiBAcGFyYW0gdGV4dCBUaGUgdGV4dCB0byBmb3JtYXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBpbmxpbmVDb2RlKHRleHQ6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgcmV0dXJuIGBcXGAke3RleHR9XFxgYDtcclxufVxyXG5cclxuLyoqXHJcbiAqIEZvcm1hdHMgdGV4dCBhcyBhIGNvZGUgYmxvY2tcclxuICogQHBhcmFtIHRleHQgVGhlIHRleHQgdG8gZm9ybWF0XHJcbiAqIEBwYXJhbSBsYW5ndWFnZSBUaGUgbGFuZ3VhZ2UgZm9yIHN5bnRheCBoaWdobGlnaHRpbmdcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBjb2RlQmxvY2sodGV4dDogc3RyaW5nLCBsYW5ndWFnZT86IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgcmV0dXJuIGBcXGBcXGBcXGAke2xhbmd1YWdlID8/ICcnfVxcbiR7dGV4dH1cXG5cXGBcXGBcXGBgO1xyXG59XHJcblxyXG4vKipcclxuICogRm9ybWF0cyB0ZXh0IGFzIGEgYmxvY2sgcXVvdGVcclxuICogQHBhcmFtIHRleHQgVGhlIHRleHQgdG8gZm9ybWF0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gYmxvY2tRdW90ZSh0ZXh0OiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gIHJldHVybiBgPj4+ICR7dGV4dH1gO1xyXG59XHJcblxyXG4vKipcclxuICogRm9ybWF0cyB0ZXh0IGFzIGEgc2luZ2xlLWxpbmUgcXVvdGVcclxuICogQHBhcmFtIHRleHQgVGhlIHRleHQgdG8gZm9ybWF0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gcXVvdGUodGV4dDogc3RyaW5nKTogc3RyaW5nIHtcclxuICByZXR1cm4gYD4gJHt0ZXh0fWA7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBGb3JtYXRzIGEgVVJMIGFzIGEgaHlwZXJsaW5rXHJcbiAqIEBwYXJhbSB0ZXh0IFRoZSB0ZXh0IHRvIGRpc3BsYXlcclxuICogQHBhcmFtIHVybCBUaGUgVVJMIHRvIGxpbmsgdG9cclxuICogQHBhcmFtIHRpdGxlIE9wdGlvbmFsIHRpdGxlIGZvciB0aGUgbGlua1xyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGh5cGVybGluayh0ZXh0OiBzdHJpbmcsIHVybDogc3RyaW5nLCB0aXRsZT86IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgcmV0dXJuIHRpdGxlID8gYFske3RleHR9XSgke3VybH0gXCIke3RpdGxlfVwiKWAgOiBgWyR7dGV4dH1dKCR7dXJsfSlgO1xyXG59XHJcblxyXG4vKipcclxuICogRm9ybWF0cyBhIFVSTCB0byBoaWRlIHRoZSBlbWJlZFxyXG4gKiBAcGFyYW0gdXJsIFRoZSBVUkwgdG8gZm9ybWF0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gaGlkZUxpbmtFbWJlZCh1cmw6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgcmV0dXJuIGA8JHt1cmx9PmA7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBUaW1lIGZvcm1hdCBzdHlsZXNcclxuICovXHJcbmV4cG9ydCBlbnVtIFRpbWVzdGFtcFN0eWxlcyB7XHJcbiAgLyoqIFNob3J0IHRpbWUgZm9ybWF0IChlLmcuLCAxNjoyMCkgKi9cclxuICBTaG9ydFRpbWUgPSAndCcsXHJcbiAgLyoqIExvbmcgdGltZSBmb3JtYXQgKGUuZy4sIDE2OjIwOjMwKSAqL1xyXG4gIExvbmdUaW1lID0gJ1QnLFxyXG4gIC8qKiBTaG9ydCBkYXRlIGZvcm1hdCAoZS5nLiwgMjAvMDQvMjAyMSkgKi9cclxuICBTaG9ydERhdGUgPSAnZCcsXHJcbiAgLyoqIExvbmcgZGF0ZSBmb3JtYXQgKGUuZy4sIDIwIEFwcmlsIDIwMjEpICovXHJcbiAgTG9uZ0RhdGUgPSAnRCcsXHJcbiAgLyoqIFNob3J0IGRhdGUvdGltZSBmb3JtYXQgKGUuZy4sIDIwIEFwcmlsIDIwMjEgMTY6MjApICovXHJcbiAgU2hvcnREYXRlVGltZSA9ICdmJyxcclxuICAvKiogTG9uZyBkYXRlL3RpbWUgZm9ybWF0IChlLmcuLCBUdWVzZGF5LCAyMCBBcHJpbCAyMDIxIDE2OjIwKSAqL1xyXG4gIExvbmdEYXRlVGltZSA9ICdGJyxcclxuICAvKiogUmVsYXRpdmUgdGltZSBmb3JtYXQgKGUuZy4sIDIgbW9udGhzIGFnbykgKi9cclxuICBSZWxhdGl2ZVRpbWUgPSAnUicsXHJcbn1cclxuXHJcbi8qKlxyXG4gKiBGb3JtYXRzIGEgdGltZXN0YW1wXHJcbiAqIEBwYXJhbSB0aW1lc3RhbXAgVGhlIHRpbWVzdGFtcCAoRGF0ZSwgbnVtYmVyIGluIG1zLCBvciBzZWNvbmRzKVxyXG4gKiBAcGFyYW0gc3R5bGUgVGhlIHN0eWxlIHRvIHVzZVxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHRpbWUodGltZXN0YW1wOiBEYXRlIHwgbnVtYmVyLCBzdHlsZT86IFRpbWVzdGFtcFN0eWxlcyk6IHN0cmluZyB7XHJcbiAgY29uc3Qgc2Vjb25kcyA9IHRpbWVzdGFtcCBpbnN0YW5jZW9mIERhdGUgXHJcbiAgICA/IE1hdGguZmxvb3IodGltZXN0YW1wLmdldFRpbWUoKSAvIDEwMDApIFxyXG4gICAgOiB0eXBlb2YgdGltZXN0YW1wID09PSAnbnVtYmVyJyAmJiB0aW1lc3RhbXAgPiAxZTEyIFxyXG4gICAgICA/IE1hdGguZmxvb3IodGltZXN0YW1wIC8gMTAwMCkgXHJcbiAgICAgIDogdGltZXN0YW1wO1xyXG4gIFxyXG4gIHJldHVybiBzdHlsZSA/IGA8dDoke3NlY29uZHN9OiR7c3R5bGV9PmAgOiBgPHQ6JHtzZWNvbmRzfT5gO1xyXG59XHJcblxyXG4vKipcclxuICogRm9ybWF0cyBhIGhlYWRpbmcgKEgxKVxyXG4gKiBAcGFyYW0gdGV4dCBUaGUgdGV4dCB0byBmb3JtYXRcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBoZWFkaW5nKHRleHQ6IHN0cmluZywgbGV2ZWw6IDEgfCAyIHwgMyA9IDEpOiBzdHJpbmcge1xyXG4gIHJldHVybiBgJHsnIycucmVwZWF0KGxldmVsKX0gJHt0ZXh0fWA7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBGb3JtYXRzIGFuIHVub3JkZXJlZCBsaXN0XHJcbiAqIEBwYXJhbSBpdGVtcyBUaGUgaXRlbXMgdG8gbGlzdFxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHVub3JkZXJlZExpc3QoaXRlbXM6IHN0cmluZ1tdKTogc3RyaW5nIHtcclxuICByZXR1cm4gaXRlbXMubWFwKGl0ZW0gPT4gYC0gJHtpdGVtfWApLmpvaW4oJ1xcbicpO1xyXG59XHJcblxyXG4vKipcclxuICogRm9ybWF0cyBhbiBvcmRlcmVkIGxpc3RcclxuICogQHBhcmFtIGl0ZW1zIFRoZSBpdGVtcyB0byBsaXN0XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gb3JkZXJlZExpc3QoaXRlbXM6IHN0cmluZ1tdKTogc3RyaW5nIHtcclxuICByZXR1cm4gaXRlbXMubWFwKChpdGVtLCBpKSA9PiBgJHtpICsgMX0uICR7aXRlbX1gKS5qb2luKCdcXG4nKTtcclxufVxyXG5cclxuLy8gRXhwb3J0IGFsbCBmb3JtYXR0ZXJzIGFzIGEgbmFtZXNwYWNlIHRvbyAoREpTIGNvbXBhdGliaWxpdHkpXHJcbmV4cG9ydCBjb25zdCBGb3JtYXR0ZXJzID0ge1xyXG4gIHVzZXJNZW50aW9uLFxyXG4gIGNoYW5uZWxNZW50aW9uLFxyXG4gIHJvbGVNZW50aW9uLFxyXG4gIGZvcm1hdEVtb2ppLFxyXG4gIGJvbGQsXHJcbiAgaXRhbGljLFxyXG4gIHVuZGVybGluZSxcclxuICBzdHJpa2V0aHJvdWdoLFxyXG4gIHNwb2lsZXIsXHJcbiAgaW5saW5lQ29kZSxcclxuICBjb2RlQmxvY2ssXHJcbiAgYmxvY2tRdW90ZSxcclxuICBxdW90ZSxcclxuICBoeXBlcmxpbmssXHJcbiAgaGlkZUxpbmtFbWJlZCxcclxuICB0aW1lLFxyXG4gIGhlYWRpbmcsXHJcbiAgdW5vcmRlcmVkTGlzdCxcclxuICBvcmRlcmVkTGlzdCxcclxuICBUaW1lc3RhbXBTdHlsZXMsXHJcbn07XHJcbiJdfQ==