/**
 * Embed - Read-only embed wrapper with toBuilder() support
 * ponytail: message.embeds[0].toBuilder() ergonomisi için
 */

import { EmbedBuilder, APIEmbed, APIEmbedField, APIEmbedAuthor, APIEmbedFooter, APIEmbedImage, APIEmbedThumbnail } from '../builders/EmbedBuilder';

/**
 * Represents an embed received from the API
 * Provides read-only access to embed properties and toBuilder() for editing
 */
export class Embed {
  private readonly data: APIEmbed;

  constructor(data: APIEmbed) {
    this.data = data;
  }

  /** Embed title */
  get title(): string | undefined {
    return this.data.title;
  }

  /** Embed description */
  get description(): string | undefined {
    return this.data.description;
  }

  /** Embed URL */
  get url(): string | undefined {
    return this.data.url;
  }

  /** Embed timestamp */
  get timestamp(): string | undefined {
    return this.data.timestamp;
  }

  /** Embed color */
  get color(): number | undefined {
    return this.data.color;
  }

  /** Embed footer */
  get footer(): APIEmbedFooter | undefined {
    return this.data.footer;
  }

  /** Embed image */
  get image(): APIEmbedImage | undefined {
    return this.data.image;
  }

  /** Embed thumbnail */
  get thumbnail(): APIEmbedThumbnail | undefined {
    return this.data.thumbnail;
  }

  /** Embed author */
  get author(): APIEmbedAuthor | undefined {
    return this.data.author;
  }

  /** Embed fields */
  get fields(): APIEmbedField[] {
    return this.data.fields ?? [];
  }

  /**
   * Total character count of this embed
   */
  get length(): number {
    let total = 0;
    if (this.data.title) total += this.data.title.length;
    if (this.data.description) total += this.data.description.length;
    if (this.data.footer?.text) total += this.data.footer.text.length;
    if (this.data.author?.name) total += this.data.author.name.length;
    if (this.data.fields) {
      for (const field of this.data.fields) {
        total += (field.name?.length || 0) + (field.value?.length || 0);
      }
    }
    return total;
  }

  /**
   * Convert this embed to an EmbedBuilder for editing
   * @example
   * const newEmbed = message.embeds[0].toBuilder()
   *   .setDescription('Updated description');
   * await message.edit({ embeds: [newEmbed] });
   */
  toBuilder(): EmbedBuilder {
    return EmbedBuilder.from(this.data);
  }

  /**
   * Get the raw API embed data
   */
  toJSON(): APIEmbed {
    return { ...this.data };
  }
}
