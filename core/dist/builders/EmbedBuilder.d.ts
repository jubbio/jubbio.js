/**
 * EmbedBuilder for creating rich embeds
 */
export interface APIEmbedField {
    name: string;
    value: string;
    inline?: boolean;
}
export interface APIEmbedAuthor {
    name: string;
    url?: string;
    icon_url?: string;
}
export interface APIEmbedFooter {
    text: string;
    icon_url?: string;
}
export interface APIEmbedImage {
    url: string;
    height?: number;
    width?: number;
}
export interface APIEmbedThumbnail {
    url: string;
    height?: number;
    width?: number;
}
export interface APIEmbed {
    title?: string;
    description?: string;
    url?: string;
    timestamp?: string;
    color?: number;
    footer?: APIEmbedFooter;
    image?: APIEmbedImage;
    thumbnail?: APIEmbedThumbnail;
    author?: APIEmbedAuthor;
    fields?: APIEmbedField[];
}
/** Global defaults for all embeds */
interface EmbedDefaults {
    footer?: {
        text: string;
        iconURL?: string;
    };
    color?: number;
    autoTimestamp?: boolean;
}
/**
 * A builder for creating embeds
 */
export declare class EmbedBuilder {
    readonly data: APIEmbed;
    constructor(data?: APIEmbed);
    /**
     * Set global defaults for all new embeds
     * @example
     * EmbedBuilder.setDefaults({
     *   footer: { text: 'Powered by MyBot' },
     *   color: 0x5865f2,
     *   autoTimestamp: true
     * });
     */
    static setDefaults(defaults: EmbedDefaults): void;
    /**
     * Clear all global defaults
     */
    static clearDefaults(): void;
    /**
     * Get current global defaults
     */
    static getDefaults(): Readonly<EmbedDefaults>;
    /**
     * Get the total character count of this embed
     * Useful for checking against the 6000 char limit before sending
     */
    get length(): number;
    /**
     * Get all validation errors for this embed
     * Useful for checking validity without throwing
     * @returns Array of error messages (empty if valid)
     */
    getValidationErrors(): string[];
    /**
     * Validate this embed against Discord/Jubbio limits
     * @throws {RangeError} if any limit is exceeded
     * @returns this (for chaining)
     */
    validate(): this;
    /**
     * Check if this embed is valid (non-throwing version)
     * @returns true if valid, false otherwise
     */
    isValid(): boolean;
    /**
     * Sets the title of this embed
     * @param title The title
     */
    setTitle(title: string | null): this;
    /**
     * Sets the description of this embed
     * @param description The description
     */
    setDescription(description: string | null): this;
    /**
     * Sets the URL of this embed
     * @param url The URL
     */
    setURL(url: string | null): this;
    /**
     * Sets the timestamp of this embed
     * @param timestamp The timestamp or date
     */
    setTimestamp(timestamp?: Date | number | null): this;
    /**
     * Sets the color of this embed
     * @param color The color (number, hex string, color name, 'Random', or RGB array)
     */
    setColor(color: number | string | [number, number, number] | null): this;
    /**
     * Sets the footer of this embed
     * @param options The footer options
     */
    setFooter(options: {
        text: string;
        iconURL?: string;
    } | null): this;
    /**
     * Sets the image of this embed
     * @param options The image URL string or options object with url, height, width
     */
    setImage(options: string | {
        url: string;
        height?: number;
        width?: number;
    } | null): this;
    /**
     * Sets the thumbnail of this embed
     * @param options The thumbnail URL string or options object with url, height, width
     */
    setThumbnail(options: string | {
        url: string;
        height?: number;
        width?: number;
    } | null): this;
    /**
     * Sets the author of this embed
     * @param options The author options
     */
    setAuthor(options: {
        name: string;
        iconURL?: string;
        url?: string;
    } | null): this;
    /**
     * Adds fields to this embed (max 25 fields per embed)
     * Accepts individual fields or an array of fields
     */
    addFields(...fields: (APIEmbedField | APIEmbedField[])[]): this;
    /**
     * Sets the fields of this embed (max 25 fields per embed)
     * Accepts individual fields or an array of fields
     */
    setFields(...fields: (APIEmbedField | APIEmbedField[])[]): this;
    /**
     * Removes, replaces, or inserts fields (max 25 fields per embed)
     * @param index The index to start at
     * @param deleteCount The number of fields to remove
     * @param fields The fields to insert
     */
    spliceFields(index: number, deleteCount: number, ...fields: APIEmbedField[]): this;
    /**
     * Clears all fields from this embed
     */
    clearFields(): this;
    /**
     * Returns the JSON representation of this embed
     * ponytail: Bug #7 fix - fields deep copy yapılır
     */
    toJSON(): APIEmbed;
    /**
     * Creates a new embed builder from existing data
     * @param other The embed data to copy
     */
    static from(other: APIEmbed | EmbedBuilder): EmbedBuilder;
}
export declare const Colors: Readonly<{
    readonly Default: 0;
    readonly White: 16777215;
    readonly Aqua: 1752220;
    readonly Green: 5763719;
    readonly Blue: 3447003;
    readonly Yellow: 16705372;
    readonly Purple: 10181046;
    readonly LuminousVividPink: 15277667;
    readonly Fuchsia: 15418782;
    readonly Gold: 15844367;
    readonly Orange: 15105570;
    readonly Red: 15548997;
    readonly Grey: 9807270;
    readonly Navy: 3426654;
    readonly DarkAqua: 1146986;
    readonly DarkGreen: 2067276;
    readonly DarkBlue: 2123412;
    readonly DarkPurple: 7419530;
    readonly DarkVividPink: 11342935;
    readonly DarkGold: 12745742;
    readonly DarkOrange: 11027200;
    readonly DarkRed: 10038562;
    readonly DarkGrey: 9936031;
    readonly DarkerGrey: 8359053;
    readonly LightGrey: 12370112;
    readonly DarkNavy: 2899536;
    readonly Blurple: 5793266;
    readonly Greyple: 10070709;
    readonly DarkButNotBlack: 2895667;
    readonly NotQuiteBlack: 2303786;
}>;
export default EmbedBuilder;
