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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRm9ybWF0dGVycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91dGlscy9Gb3JtYXR0ZXJzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7R0FFRzs7O0FBTUgsa0NBRUM7QUFNRCx3Q0FFQztBQU1ELGtDQUVDO0FBUUQsa0NBRUM7QUFNRCxvQkFFQztBQU1ELHdCQUVDO0FBTUQsOEJBRUM7QUFNRCxzQ0FFQztBQU1ELDBCQUVDO0FBTUQsZ0NBRUM7QUFPRCw4QkFFQztBQU1ELGdDQUVDO0FBTUQsc0JBRUM7QUFRRCw4QkFFQztBQU1ELHNDQUVDO0FBMkJELG9CQVFDO0FBTUQsMEJBRUM7QUFNRCxzQ0FFQztBQU1ELGtDQUVDO0FBdExEOzs7R0FHRztBQUNILFNBQWdCLFdBQVcsQ0FBQyxNQUF1QjtJQUNqRCxPQUFPLEtBQUssTUFBTSxHQUFHLENBQUM7QUFDeEIsQ0FBQztBQUVEOzs7R0FHRztBQUNILFNBQWdCLGNBQWMsQ0FBQyxTQUEwQjtJQUN2RCxPQUFPLEtBQUssU0FBUyxHQUFHLENBQUM7QUFDM0IsQ0FBQztBQUVEOzs7R0FHRztBQUNILFNBQWdCLFdBQVcsQ0FBQyxNQUF1QjtJQUNqRCxPQUFPLE1BQU0sTUFBTSxHQUFHLENBQUM7QUFDekIsQ0FBQztBQUVEOzs7OztHQUtHO0FBQ0gsU0FBZ0IsV0FBVyxDQUFDLE9BQXdCLEVBQUUsSUFBWSxFQUFFLFFBQVEsR0FBRyxLQUFLO0lBQ2xGLE9BQU8sSUFBSSxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLElBQUksSUFBSSxPQUFPLEdBQUcsQ0FBQztBQUN2RCxDQUFDO0FBRUQ7OztHQUdHO0FBQ0gsU0FBZ0IsSUFBSSxDQUFDLElBQVk7SUFDL0IsT0FBTyxLQUFLLElBQUksSUFBSSxDQUFDO0FBQ3ZCLENBQUM7QUFFRDs7O0dBR0c7QUFDSCxTQUFnQixNQUFNLENBQUMsSUFBWTtJQUNqQyxPQUFPLElBQUksSUFBSSxH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Q0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDbkQsQ0FBQztBQUVEOzs7R0FHRztBQUNILFNBQWdCLFdBQVcsQ0FBQyxLQUFlO0lBQ3pDLE9BQU8sS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxJQUFJLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNoRSxDQUFDO0FBRUQsK0RBQStEO0FBQ2xELFFBQUEsVUFBVSxHQUFHO0lBQ3hCLFdBQVc7SUFDWCxjQUFjO0lBQ2QsV0FBVztJQUNYLFdBQVc7SUFDWCxJQUFJO0lBQ0osTUFBTTtJQUNOLFNBQVM7SUFDVCxhQUFhO0lBQ2IsT0FBTztJQUNQLFVBQVU7SUFDVixTQUFTO0lBQ1QsVUFBVTtJQUNWLEtBQUs7SUFDTCxTQUFTO0lBQ1QsYUFBYTtJQUNiLElBQUk7SUFDSixPQUFPO0lBQ1AsYUFBYTtJQUNiLFdBQVc7SUFDWCxlQUFlO0NBQ2hCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEZvcm1hdHRlcnMgZm9yIG1hcmtkb3duIGFuZCBtZW50aW9uc1xuICovXG5cbi8qKlxuICogRm9ybWF0cyBhIHVzZXIgbWVudGlvblxuICogQHBhcmFtIHVzZXJJZCBUaGUgdXNlciBJRCB0byBtZW50aW9uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB1c2VyTWVudGlvbih1c2VySWQ6IHN0cmluZyB8IG51bWJlcik6IHN0cmluZyB7XG4gIHJldHVybiBgPEAke3VzZXJJZH0+YDtcbn1cblxuLyoqXG4gKiBGb3JtYXRzIGEgY2hhbm5lbCBtZW50aW9uXG4gKiBAcGFyYW0gY2hhbm5lbElkIFRoZSBjaGFubmVsIElEIHRvIG1lbnRpb25cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNoYW5uZWxNZW50aW9uKGNoYW5uZWxJZDogc3RyaW5nIHwgbnVtYmVyKTogc3RyaW5nIHtcbiAgcmV0dXJuIGA8IyR7Y2hhbm5lbElkfT5gO1xufVxuXG4vKipcbiAqIEZvcm1hdHMgYSByb2xlIG1lbnRpb25cbiAqIEBwYXJhbSByb2xlSWQgVGhlIHJvbGUgSUQgdG8gbWVudGlvblxuICovXG5leHBvcnQgZnVuY3Rpb24gcm9sZU1lbnRpb24ocm9sZUlkOiBzdHJpbmcgfCBudW1iZXIpOiBzdHJpbmcge1xuICByZXR1cm4gYDxAJiR7cm9sZUlkfT5gO1xufVxuXG4vKipcbiAqIEZvcm1hdHMgYSBjdXN0b20gZW1vamlcbiAqIEBwYXJhbSBlbW9qaUlkIFRoZSBlbW9qaSBJRFxuICogQHBhcmFtIG5hbWUgVGhlIGVtb2ppIG5hbWVcbiAqIEBwYXJhbSBhbmltYXRlZCBXaGV0aGVyIHRoZSBlbW9qaSBpcyBhbmltYXRlZFxuICovXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0RW1vamkoZW1vamlJZDogc3RyaW5nIHwgbnVtYmVyLCBuYW1lOiBzdHJpbmcsIGFuaW1hdGVkID0gZmFsc2UpOiBzdHJpbmcge1xuICByZXR1cm4gYDwke2FuaW1hdGVkID8gJ2EnIDogJyd9OiR7bmFtZX06JHtlbW9qaUlkfT5gO1xufVxuXG4vKipcbiAqIEZvcm1hdHMgdGV4dCBhcyBib2xkXG4gKiBAcGFyYW0gdGV4dCBUaGUgdGV4dCB0byBmb3JtYXRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJvbGQodGV4dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGAqKiR7dGV4dH0qKmA7XG59XG5cbi8qKlxuICogRm9ybWF0cyB0ZXh0IGFzIGl0YWxpY1xuICogQHBhcmFtIHRleHQgVGhlIHRleHQgdG8gZm9ybWF0XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpdGFsaWModGV4dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGAqJHt0ZXh0fSpgO1xufVxuXG4vKipcbiAqIEZvcm1hdHMgdGV4dCBhcyB1bmRlcmxpbmVcbiAqIEBwYXJhbSB0ZXh0IFRoZSB0ZXh0IHRvIGZvcm1hdFxuICovXG5leHBvcnQgZnVuY3Rpb24gdW5kZXJsaW5lKHRleHQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBgX18ke3RleHR9X19gO1xufVxuXG4vKipcbiAqIEZvcm1hdHMgdGV4dCBhcyBzdHJpa2V0aHJvdWdoXG4gKiBAcGFyYW0gdGV4dCBUaGUgdGV4dCB0byBmb3JtYXRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHN0cmlrZXRocm91Z2godGV4dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGB+fiR7dGV4dH1+fmA7XG59XG5cbi8qKlxuICogRm9ybWF0cyB0ZXh0IGFzIHNwb2lsZXJcbiAqIEBwYXJhbSB0ZXh0IFRoZSB0ZXh0IHRvIGZvcm1hdFxuICovXG5leHBvcnQgZnVuY3Rpb24gc3BvaWxlcih0ZXh0OiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gYHx8JHt0ZXh0fXx8YDtcbn1cblxuLyoqXG4gKiBGb3JtYXRzIHRleHQgYXMgaW5saW5lIGNvZGVcbiAqIEBwYXJhbSB0ZXh0IFRoZSB0ZXh0IHRvIGZvcm1hdFxuICovXG5leHBvcnQgZnVuY3Rpb24gaW5saW5lQ29kZSh0ZXh0OiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gYFxcYCR7dGV4dH1cXGBgO1xufVxuXG4vKipcbiAqIEZvcm1hdHMgdGV4dCBhcyBhIGNvZGUgYmxvY2tcbiAqIEBwYXJhbSB0ZXh0IFRoZSB0ZXh0IHRvIGZvcm1hdFxuICogQHBhcmFtIGxhbmd1YWdlIFRoZSBsYW5ndWFnZSBmb3Igc3ludGF4IGhpZ2hsaWdodGluZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gY29kZUJsb2NrKHRleHQ6IHN0cmluZywgbGFuZ3VhZ2U/OiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gYFxcYFxcYFxcYCR7bGFuZ3VhZ2UgPz8gJyd9XFxuJHt0ZXh0fVxcblxcYFxcYFxcYGA7XG59XG5cbi8qKlxuICogRm9ybWF0cyB0ZXh0IGFzIGEgYmxvY2sgcXVvdGVcbiAqIEBwYXJhbSB0ZXh0IFRoZSB0ZXh0IHRvIGZvcm1hdFxuICovXG5leHBvcnQgZnVuY3Rpb24gYmxvY2tRdW90ZSh0ZXh0OiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gYD4+PiAke3RleHR9YDtcbn1cblxuLyoqXG4gKiBGb3JtYXRzIHRleHQgYXMgYSBzaW5nbGUtbGluZSBxdW90ZVxuICogQHBhcmFtIHRleHQgVGhlIHRleHQgdG8gZm9ybWF0XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBxdW90ZSh0ZXh0OiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gYD4gJHt0ZXh0fWA7XG59XG5cbi8qKlxuICogRm9ybWF0cyBhIFVSTCBhcyBhIGh5cGVybGlua1xuICogQHBhcmFtIHRleHQgVGhlIHRleHQgdG8gZGlzcGxheVxuICogQHBhcmFtIHVybCBUaGUgVVJMIHRvIGxpbmsgdG9cbiAqIEBwYXJhbSB0aXRsZSBPcHRpb25hbCB0aXRsZSBmb3IgdGhlIGxpbmtcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGh5cGVybGluayh0ZXh0OiBzdHJpbmcsIHVybDogc3RyaW5nLCB0aXRsZT86IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiB0aXRsZSA/IGBbJHt0ZXh0fV0oJHt1cmx9IFwiJHt0aXRsZX1cIilgIDogYFske3RleHR9XSgke3VybH0pYDtcbn1cblxuLyoqXG4gKiBGb3JtYXRzIGEgVVJMIHRvIGhpZGUgdGhlIGVtYmVkXG4gKiBAcGFyYW0gdXJsIFRoZSBVUkwgdG8gZm9ybWF0XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBoaWRlTGlua0VtYmVkKHVybDogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGA8JHt1cmx9PmA7XG59XG5cbi8qKlxuICogVGltZSBmb3JtYXQgc3R5bGVzXG4gKi9cbmV4cG9ydCBlbnVtIFRpbWVzdGFtcFN0eWxlcyB7XG4gIC8qKiBTaG9ydCB0aW1lIGZvcm1hdCAoZS5nLiwgMTY6MjApICovXG4gIFNob3J0VGltZSA9ICd0JyxcbiAgLyoqIExvbmcgdGltZSBmb3JtYXQgKGUuZy4sIDE2OjIwOjMwKSAqL1xuICBMb25nVGltZSA9ICdUJyxcbiAgLyoqIFNob3J0IGRhdGUgZm9ybWF0IChlLmcuLCAyMC8wNC8yMDIxKSAqL1xuICBTaG9ydERhdGUgPSAnZCcsXG4gIC8qKiBMb25nIGRhdGUgZm9ybWF0IChlLmcuLCAyMCBBcHJpbCAyMDIxKSAqL1xuICBMb25nRGF0ZSA9ICdEJyxcbiAgLyoqIFNob3J0IGRhdGUvdGltZSBmb3JtYXQgKGUuZy4sIDIwIEFwcmlsIDIwMjEgMTY6MjApICovXG4gIFNob3J0RGF0ZVRpbWUgPSAnZicsXG4gIC8qKiBMb25nIGRhdGUvdGltZSBmb3JtYXQgKGUuZy4sIFR1ZXNkYXksIDIwIEFwcmlsIDIwMjEgMTY6MjApICovXG4gIExvbmdEYXRlVGltZSA9ICdGJyxcbiAgLyoqIFJlbGF0aXZlIHRpbWUgZm9ybWF0IChlLmcuLCAyIG1vbnRocyBhZ28pICovXG4gIFJlbGF0aXZlVGltZSA9ICdSJyxcbn1cblxuLyoqXG4gKiBGb3JtYXRzIGEgdGltZXN0YW1wXG4gKiBAcGFyYW0gdGltZXN0YW1wIFRoZSB0aW1lc3RhbXAgKERhdGUsIG51bWJlciBpbiBtcywgb3Igc2Vjb25kcylcbiAqIEBwYXJhbSBzdHlsZSBUaGUgc3R5bGUgdG8gdXNlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0aW1lKHRpbWVzdGFtcDogRGF0ZSB8IG51bWJlciwgc3R5bGU/OiBUaW1lc3RhbXBTdHlsZXMpOiBzdHJpbmcge1xuICBjb25zdCBzZWNvbmRzID0gdGltZXN0YW1wIGluc3RhbmNlb2YgRGF0ZSBcbiAgICA/IE1hdGguZmxvb3IodGltZXN0YW1wLmdldFRpbWUoKSAvIDEwMDApIFxuICAgIDogdHlwZW9mIHRpbWVzdGFtcCA9PT0gJ251bWJlcicgJiYgdGltZXN0YW1wID4gMWUxMiBcbiAgICAgID8gTWF0aC5mbG9vcih0aW1lc3RhbXAgLyAxMDAwKSBcbiAgICAgIDogdGltZXN0YW1wO1xuICBcbiAgcmV0dXJuIHN0eWxlID8gYDx0OiR7c2Vjb25kc306JHtzdHlsZX0+YCA6IGA8dDoke3NlY29uZHN9PmA7XG59XG5cbi8qKlxuICogRm9ybWF0cyBhIGhlYWRpbmcgKEgxKVxuICogQHBhcmFtIHRleHQgVGhlIHRleHQgdG8gZm9ybWF0XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBoZWFkaW5nKHRleHQ6IHN0cmluZywgbGV2ZWw6IDEgfCAyIHwgMyA9IDEpOiBzdHJpbmcge1xuICByZXR1cm4gYCR7JyMnLnJlcGVhdChsZXZlbCl9ICR7dGV4dH1gO1xufVxuXG4vKipcbiAqIEZvcm1hdHMgYW4gdW5vcmRlcmVkIGxpc3RcbiAqIEBwYXJhbSBpdGVtcyBUaGUgaXRlbXMgdG8gbGlzdFxuICovXG5leHBvcnQgZnVuY3Rpb24gdW5vcmRlcmVkTGlzdChpdGVtczogc3RyaW5nW10pOiBzdHJpbmcge1xuICByZXR1cm4gaXRlbXMubWFwKGl0ZW0gPT4gYC0gJHtpdGVtfWApLmpvaW4oJ1xcbicpO1xufVxuXG4vKipcbiAqIEZvcm1hdHMgYW4gb3JkZXJlZCBsaXN0XG4gKiBAcGFyYW0gaXRlbXMgVGhlIGl0ZW1zIHRvIGxpc3RcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG9yZGVyZWRMaXN0KGl0ZW1zOiBzdHJpbmdbXSk6IHN0cmluZyB7XG4gIHJldHVybiBpdGVtcy5tYXAoKGl0ZW0sIGkpID0+IGAke2kgKyAxfS4gJHtpdGVtfWApLmpvaW4oJ1xcbicpO1xufVxuXG4vLyBFeHBvcnQgYWxsIGZvcm1hdHRlcnMgYXMgYSBuYW1lc3BhY2UgdG9vIChESlMgY29tcGF0aWJpbGl0eSlcbmV4cG9ydCBjb25zdCBGb3JtYXR0ZXJzID0ge1xuICB1c2VyTWVudGlvbixcbiAgY2hhbm5lbE1lbnRpb24sXG4gIHJvbGVNZW50aW9uLFxuICBmb3JtYXRFbW9qaSxcbiAgYm9sZCxcbiAgaXRhbGljLFxuICB1bmRlcmxpbmUsXG4gIHN0cmlrZXRocm91Z2gsXG4gIHNwb2lsZXIsXG4gIGlubGluZUNvZGUsXG4gIGNvZGVCbG9jayxcbiAgYmxvY2tRdW90ZSxcbiAgcXVvdGUsXG4gIGh5cGVybGluayxcbiAgaGlkZUxpbmtFbWJlZCxcbiAgdGltZSxcbiAgaGVhZGluZyxcbiAgdW5vcmRlcmVkTGlzdCxcbiAgb3JkZXJlZExpc3QsXG4gIFRpbWVzdGFtcFN0eWxlcyxcbn07XG4iXX0=