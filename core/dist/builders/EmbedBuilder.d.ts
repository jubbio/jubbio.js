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
/**
 * A builder for creating embeds
 */
export declare class EmbedBuilder {
    readonly data: APIEmbed;
    constructor(data?: APIEmbed);
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
     * @param color The color (number, hex string, or RGB array)
     */
    setColor(color: number | `#${string}` | [number, number, number] | null): this;
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
     * @param url The image URL
     */
    setImage(url: string | null): this;
    /**
     * Sets the thumbnail of this embed
     * @param url The thumbnail URL
     */
    setThumbnail(url: string | null): this;
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
     * Adds fields to this embed
     * @param fields The fields to add
     */
    addFields(...fields: APIEmbedField[]): this;
    /**
     * Sets the fields of this embed
     * @param fields The fields to set
     */
    setFields(...fields: APIEmbedField[]): this;
    /**
     * Removes, replaces, or inserts fields
     * @param index The index to start at
     * @param deleteCount The number of fields to remove
     * @param fields The fields to insert
     */
    spliceFields(index: number, deleteCount: number, ...fields: APIEmbedField[]): this;
    /**
     * Returns the JSON representation of this embed
     */
    toJSON(): APIEmbed;
    /**
     * Creates a new embed builder from existing data
     * @param other The embed data to copy
     */
    static from(other: APIEmbed | EmbedBuilder): EmbedBuilder;
}
export declare const Colors: {
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
};
export default EmbedBuilder;
