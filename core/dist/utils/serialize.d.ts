import { APIEmbed } from '../types';
export declare function hasComponentsV2(components: any[] | undefined): boolean;
export declare function visitComponentText(components: any[] | undefined, visit: (content: string) => void): void;
/**
 * Serialize components array (ActionRowBuilder/ButtonBuilder instances) to plain JSON.
 * Handles nested structures: ActionRow → components[] → Button/SelectMenu
 *
 * @param components - Array of components (may include builder instances)
 * @returns Serialized components as plain JSON objects
 */
export declare function serializeComponentNode(value: any): any;
export declare function serializeComponents(components: any[] | undefined): any[] | undefined;
/**
 * Normalize an embed for outgoing API requests.
 * Handles:
 * - EmbedBuilder instances (calls toJSON())
 * - color: hex string → number
 * - timestamp: Date/number → ISO string
 * - footer.iconURL → footer.icon_url
 * - author.iconURL → author.icon_url
 * - thumbnail: string → { url: string }
 * - image: string → { url: string }
 *
 * @param embed - Raw embed (may be EmbedBuilder or plain object)
 * @returns Normalized APIEmbed ready for the API
 */
export declare function normalizeEmbed(embed: any): APIEmbed;
/**
 * Normalize an array of embeds for outgoing API requests.
 *
 * @param embeds - Array of embeds (may include EmbedBuilder instances)
 * @returns Array of normalized APIEmbed objects
 */
export declare function normalizeEmbeds(embeds: any[] | undefined): APIEmbed[] | undefined;
