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
export class EmbedBuilder {
  public readonly data: APIEmbed;

  constructor(data: APIEmbed = {}) {
    this.data = { ...data };
    if (data.fields) {
      this.data.fields = [...data.fields];
    }
  }

  /**
   * Sets the title of this embed
   * @param title The title
   */
  setTitle(title: string | null): this {
    this.data.title = title ?? undefined;
    return this;
  }

  /**
   * Sets the description of this embed
   * @param description The description
   */
  setDescription(description: string | null): this {
    this.data.description = description ?? undefined;
    return this;
  }

  /**
   * Sets the URL of this embed
   * @param url The URL
   */
  setURL(url: string | null): this {
    this.data.url = url ?? undefined;
    return this;
  }

  /**
   * Sets the timestamp of this embed
   * @param timestamp The timestamp or date
   */
  setTimestamp(timestamp: Date | number | null = Date.now()): this {
    this.data.timestamp = timestamp === null 
      ? undefined 
      : new Date(timestamp).toISOString();
    return this;
  }

  /**
   * Sets the color of this embed
   * @param color The color (number, hex string, or RGB array)
   */
  setColor(color: number | `#${string}` | [number, number, number] | null): this {
    if (color === null) {
      this.data.color = undefined;
    } else if (typeof color === 'number') {
      this.data.color = color;
    } else if (typeof color === 'string') {
      this.data.color = parseInt(color.replace('#', ''), 16);
    } else if (Array.isArray(color)) {
      this.data.color = (color[0] << 16) + (color[1] << 8) + color[2];
    }
    return this;
  }

  /**
   * Sets the footer of this embed
   * @param options The footer options
   */
  setFooter(options: { text: string; iconURL?: string } | null): this {
    if (options === null) {
      this.data.footer = undefined;
    } else {
      this.data.footer = {
        text: options.text,
        icon_url: options.iconURL,
      };
    }
    return this;
  }

  /**
   * Sets the image of this embed
   * @param url The image URL
   */
  setImage(url: string | null): this {
    this.data.image = url === null ? undefined : { url };
    return this;
  }

  /**
   * Sets the thumbnail of this embed
   * @param url The thumbnail URL
   */
  setThumbnail(url: string | null): this {
    this.data.thumbnail = url === null ? undefined : { url };
    return this;
  }

  /**
   * Sets the author of this embed
   * @param options The author options
   */
  setAuthor(options: { name: string; iconURL?: string; url?: string } | null): this {
    if (options === null) {
      this.data.author = undefined;
    } else {
      this.data.author = {
        name: options.name,
        icon_url: options.iconURL,
        url: options.url,
      };
    }
    return this;
  }

  /**
   * Adds fields to this embed
   * @param fields The fields to add
   */
  addFields(...fields: APIEmbedField[]): this {
    if (!this.data.fields) this.data.fields = [];
    this.data.fields.push(...fields);
    return this;
  }

  /**
   * Sets the fields of this embed
   * @param fields The fields to set
   */
  setFields(...fields: APIEmbedField[]): this {
    this.data.fields = fields;
    return this;
  }

  /**
   * Removes, replaces, or inserts fields
   * @param index The index to start at
   * @param deleteCount The number of fields to remove
   * @param fields The fields to insert
   */
  spliceFields(index: number, deleteCount: number, ...fields: APIEmbedField[]): this {
    if (!this.data.fields) this.data.fields = [];
    this.data.fields.splice(index, deleteCount, ...fields);
    return this;
  }

  /**
   * Returns the JSON representation of this embed
   */
  toJSON(): APIEmbed {
    return { ...this.data };
  }

  /**
   * Creates a new embed builder from existing data
   * @param other The embed data to copy
   */
  static from(other: APIEmbed | EmbedBuilder): EmbedBuilder {
    return new EmbedBuilder(other instanceof EmbedBuilder ? other.data : other);
  }
}

// Color constants (DJS compatibility)
export const Colors = {
  Default: 0x000000,
  White: 0xffffff,
  Aqua: 0x1abc9c,
  Green: 0x57f287,
  Blue: 0x3498db,
  Yellow: 0xfee75c,
  Purple: 0x9b59b6,
  LuminousVividPink: 0xe91e63,
  Fuchsia: 0xeb459e,
  Gold: 0xf1c40f,
  Orange: 0xe67e22,
  Red: 0xed4245,
  Grey: 0x95a5a6,
  Navy: 0x34495e,
  DarkAqua: 0x11806a,
  DarkGreen: 0x1f8b4c,
  DarkBlue: 0x206694,
  DarkPurple: 0x71368a,
  DarkVividPink: 0xad1457,
  DarkGold: 0xc27c0e,
  DarkOrange: 0xa84300,
  DarkRed: 0x992d22,
  DarkGrey: 0x979c9f,
  DarkerGrey: 0x7f8c8d,
  LightGrey: 0xbcc0c0,
  DarkNavy: 0x2c3e50,
  Blurple: 0x5865f2,
  Greyple: 0x99aab5,
  DarkButNotBlack: 0x2c2f33,
  NotQuiteBlack: 0x23272a,
} as const;

export default EmbedBuilder;
