/**
 * Embed - Read-only embed wrapper with toBuilder() support
 * message.embeds[0].toBuilder() ergonomisi için
 */
import { EmbedBuilder, APIEmbed, APIEmbedField, APIEmbedAuthor, APIEmbedFooter, APIEmbedImage, APIEmbedThumbnail } from '../builders/EmbedBuilder';
/**
 * Represents an embed received from the API
 * Provides read-only access to embed properties and toBuilder() for editing
 */
export declare class Embed {
    private readonly data;
    constructor(data: APIEmbed);
    /** Embed title */
    get title(): string | undefined;
    /** Embed description */
    get description(): string | undefined;
    /** Embed URL */
    get url(): string | undefined;
    /** Embed timestamp */
    get timestamp(): string | undefined;
    /** Embed color */
    get color(): number | undefined;
    /** Embed footer */
    get footer(): APIEmbedFooter | undefined;
    /** Embed image */
    get image(): APIEmbedImage | undefined;
    /** Embed thumbnail */
    get thumbnail(): APIEmbedThumbnail | undefined;
    /** Embed author */
    get author(): APIEmbedAuthor | undefined;
    /** Embed fields */
    get fields(): APIEmbedField[];
    /**
     * Total character count of this embed
     */
    get length(): number;
    /**
     * Convert this embed to an EmbedBuilder for editing
     * @example
     * const newEmbed = message.embeds[0].toBuilder()
     *   .setDescription('Updated description');
     * await message.edit({ embeds: [newEmbed] });
     */
    toBuilder(): EmbedBuilder;
    /**
     * Get the raw API embed data
     */
    toJSON(): APIEmbed;
}
