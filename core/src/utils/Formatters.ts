/**
 * Formatters for markdown and mentions
 */

/**
 * Formats a user mention
 * @param userId The user ID to mention
 */
export function userMention(userId: string | number): string {
  return `<@${userId}>`;
}

/**
 * Formats a channel mention
 * @param channelId The channel ID to mention
 */
export function channelMention(channelId: string | number): string {
  return `<#${channelId}>`;
}

/**
 * Formats a role mention
 * @param roleId The role ID to mention
 */
export function roleMention(roleId: string | number): string {
  return `<@&${roleId}>`;
}

/**
 * Formats a custom emoji
 * @param emojiId The emoji ID
 * @param name The emoji name
 * @param animated Whether the emoji is animated
 */
export function formatEmoji(emojiId: string | number, name: string, animated = false): string {
  return `<${animated ? 'a' : ''}:${name}:${emojiId}>`;
}

/**
 * Formats text as bold
 * @param text The text to format
 */
export function bold(text: string): string {
  return `**${text}**`;
}

/**
 * Formats text as italic
 * @param text The text to format
 */
export function italic(text: string): string {
  return `*${text}*`;
}

/**
 * Formats text as underline
 * @param text The text to format
 */
export function underline(text: string): string {
  return `__${text}__`;
}

/**
 * Formats text as strikethrough
 * @param text The text to format
 */
export function strikethrough(text: string): string {
  return `~~${text}~~`;
}

/**
 * Formats text as spoiler
 * @param text The text to format
 */
export function spoiler(text: string): string {
  return `||${text}||`;
}

/**
 * Formats text as inline code
 * @param text The text to format
 */
export function inlineCode(text: string): string {
  return `\`${text}\``;
}

/**
 * Formats text as a code block
 * @param text The text to format
 * @param language The language for syntax highlighting
 */
export function codeBlock(text: string, language?: string): string {
  return `\`\`\`${language ?? ''}\n${text}\n\`\`\``;
}

/**
 * Formats text as a block quote
 * @param text The text to format
 */
export function blockQuote(text: string): string {
  return `>>> ${text}`;
}

/**
 * Formats text as a single-line quote
 * @param text The text to format
 */
export function quote(text: string): string {
  return `> ${text}`;
}

/**
 * Formats a URL as a hyperlink
 * @param text The text to display
 * @param url The URL to link to
 * @param title Optional title for the link
 */
export function hyperlink(text: string, url: string, title?: string): string {
  return title ? `[${text}](${url} "${title}")` : `[${text}](${url})`;
}

/**
 * Formats a URL to hide the embed
 * @param url The URL to format
 */
export function hideLinkEmbed(url: string): string {
  return `<${url}>`;
}

/**
 * Time format styles
 */
export enum TimestampStyles {
  /** Short time format (e.g., 16:20) */
  ShortTime = 't',
  /** Long time format (e.g., 16:20:30) */
  LongTime = 'T',
  /** Short date format (e.g., 20/04/2021) */
  ShortDate = 'd',
  /** Long date format (e.g., 20 April 2021) */
  LongDate = 'D',
  /** Short date/time format (e.g., 20 April 2021 16:20) */
  ShortDateTime = 'f',
  /** Long date/time format (e.g., Tuesday, 20 April 2021 16:20) */
  LongDateTime = 'F',
  /** Relative time format (e.g., 2 months ago) */
  RelativeTime = 'R',
}

/**
 * Formats a timestamp
 * @param timestamp The timestamp (Date, number in ms, or seconds)
 * @param style The style to use
 */
export function time(timestamp: Date | number, style?: TimestampStyles): string {
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
export function heading(text: string, level: 1 | 2 | 3 = 1): string {
  return `${'#'.repeat(level)} ${text}`;
}

/**
 * Formats an unordered list
 * @param items The items to list
 */
export function unorderedList(items: string[]): string {
  return items.map(item => `- ${item}`).join('\n');
}

/**
 * Formats an ordered list
 * @param items The items to list
 */
export function orderedList(items: string[]): string {
  return items.map((item, i) => `${i + 1}. ${item}`).join('\n');
}

// Export all formatters as a namespace too (DJS compatibility)
export const Formatters = {
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
