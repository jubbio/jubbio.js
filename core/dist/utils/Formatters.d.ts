/**
 * Formatters for markdown and mentions
 */
/**
 * Formats a user mention
 * @param userId The user ID to mention
 */
export declare function userMention(userId: string | number): string;
/**
 * Formats a channel mention
 * @param channelId The channel ID to mention
 */
export declare function channelMention(channelId: string | number): string;
/**
 * Formats a role mention
 * @param roleId The role ID to mention
 */
export declare function roleMention(roleId: string | number): string;
/**
 * Formats a custom emoji
 * @param emojiId The emoji ID
 * @param name The emoji name
 * @param animated Whether the emoji is animated
 */
export declare function formatEmoji(emojiId: string | number, name: string, animated?: boolean): string;
/**
 * Formats text as bold
 * @param text The text to format
 */
export declare function bold(text: string): string;
/**
 * Formats text as italic
 * @param text The text to format
 */
export declare function italic(text: string): string;
/**
 * Formats text as underline
 * @param text The text to format
 */
export declare function underline(text: string): string;
/**
 * Formats text as strikethrough
 * @param text The text to format
 */
export declare function strikethrough(text: string): string;
/**
 * Formats text as spoiler
 * @param text The text to format
 */
export declare function spoiler(text: string): string;
/**
 * Formats text as inline code
 * @param text The text to format
 */
export declare function inlineCode(text: string): string;
/**
 * Formats text as a code block
 * @param text The text to format
 * @param language The language for syntax highlighting
 */
export declare function codeBlock(text: string, language?: string): string;
/**
 * Formats text as a block quote
 * @param text The text to format
 */
export declare function blockQuote(text: string): string;
/**
 * Formats text as a single-line quote
 * @param text The text to format
 */
export declare function quote(text: string): string;
/**
 * Formats a URL as a hyperlink
 * @param text The text to display
 * @param url The URL to link to
 * @param title Optional title for the link
 */
export declare function hyperlink(text: string, url: string, title?: string): string;
/**
 * Formats a URL to hide the embed
 * @param url The URL to format
 */
export declare function hideLinkEmbed(url: string): string;
/**
 * Time format styles
 */
export declare enum TimestampStyles {
    /** Short time format (e.g., 16:20) */
    ShortTime = "t",
    /** Long time format (e.g., 16:20:30) */
    LongTime = "T",
    /** Short date format (e.g., 20/04/2021) */
    ShortDate = "d",
    /** Long date format (e.g., 20 April 2021) */
    LongDate = "D",
    /** Short date/time format (e.g., 20 April 2021 16:20) */
    ShortDateTime = "f",
    /** Long date/time format (e.g., Tuesday, 20 April 2021 16:20) */
    LongDateTime = "F",
    /** Relative time format (e.g., 2 months ago) */
    RelativeTime = "R"
}
/**
 * Formats a timestamp
 * @param timestamp The timestamp (Date, number in ms, or seconds)
 * @param style The style to use
 */
export declare function time(timestamp: Date | number, style?: TimestampStyles): string;
/**
 * Formats a heading (H1)
 * @param text The text to format
 */
export declare function heading(text: string, level?: 1 | 2 | 3): string;
/**
 * Formats an unordered list
 * @param items The items to list
 */
export declare function unorderedList(items: string[]): string;
/**
 * Formats an ordered list
 * @param items The items to list
 */
export declare function orderedList(items: string[]): string;
export declare const Formatters: {
    userMention: typeof userMention;
    channelMention: typeof channelMention;
    roleMention: typeof roleMention;
    formatEmoji: typeof formatEmoji;
    bold: typeof bold;
    italic: typeof italic;
    underline: typeof underline;
    strikethrough: typeof strikethrough;
    spoiler: typeof spoiler;
    inlineCode: typeof inlineCode;
    codeBlock: typeof codeBlock;
    blockQuote: typeof blockQuote;
    quote: typeof quote;
    hyperlink: typeof hyperlink;
    hideLinkEmbed: typeof hideLinkEmbed;
    time: typeof time;
    heading: typeof heading;
    unorderedList: typeof unorderedList;
    orderedList: typeof orderedList;
    TimestampStyles: typeof TimestampStyles;
};
