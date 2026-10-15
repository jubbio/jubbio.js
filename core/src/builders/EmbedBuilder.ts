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

/** Embed character limits */
const LIMITS = {
  TITLE: 256,
  DESCRIPTION: 4096,
  FIELDS: 25,
  FIELD_NAME: 256,
  FIELD_VALUE: 1024,
  FOOTER_TEXT: 2048,
  AUTHOR_NAME: 256,
  TOTAL: 6000,
} as const;

/** Global defaults for all embeds */
interface EmbedDefaults {
  footer?: { text: string; iconURL?: string };
  color?: number;
  autoTimestamp?: boolean;
}

let globalDefaults: EmbedDefaults = {};

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
    
    // ponytail: Apply global defaults on construction
    if (globalDefaults.color !== undefined && this.data.color === undefined) {
      this.data.color = globalDefaults.color;
    }
    if (globalDefaults.footer && !this.data.footer) {
      this.data.footer = {
        text: globalDefaults.footer.text,
        icon_url: globalDefaults.footer.iconURL,
      };
    }
    if (globalDefaults.autoTimestamp && !this.data.timestamp) {
      this.data.timestamp = new Date().toISOString();
    }
  }

  /**
   * Set global defaults for all new embeds
   * @example
   * EmbedBuilder.setDefaults({
   *   footer: { text: 'Powered by MyBot' },
   *   color: 0x5865f2,
   *   autoTimestamp: true
   * });
   */
  static setDefaults(defaults: EmbedDefaults): void {
    globalDefaults = { ...defaults };
  }

  /**
   * Clear all global defaults
   */
  static clearDefaults(): void {
    globalDefaults = {};
  }

  /**
   * Get current global defaults
   */
  static getDefaults(): Readonly<EmbedDefaults> {
    return { ...globalDefaults };
  }

  /**
   * Get the total character count of this embed
   * Useful for checking against the 6000 char limit before sending
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
   * Get all validation errors for this embed
   * Useful for checking validity without throwing
   * @returns Array of error messages (empty if valid)
   */
  getValidationErrors(): string[] {
    const errors: string[] = [];
    
    if (this.data.title && this.data.title.length > LIMITS.TITLE) {
      errors.push(`Title exceeds ${LIMITS.TITLE} chars (got ${this.data.title.length})`);
    }
    if (this.data.description && this.data.description.length > LIMITS.DESCRIPTION) {
      errors.push(`Description exceeds ${LIMITS.DESCRIPTION} chars (got ${this.data.description.length})`);
    }
    if (this.data.footer?.text && this.data.footer.text.length > LIMITS.FOOTER_TEXT) {
      errors.push(`Footer text exceeds ${LIMITS.FOOTER_TEXT} chars (got ${this.data.footer.text.length})`);
    }
    if (this.data.author?.name && this.data.author.name.length > LIMITS.AUTHOR_NAME) {
      errors.push(`Author name exceeds ${LIMITS.AUTHOR_NAME} chars (got ${this.data.author.name.length})`);
    }
    if (this.data.fields) {
      if (this.data.fields.length > LIMITS.FIELDS) {
        errors.push(`Fields exceed ${LIMITS.FIELDS} (got ${this.data.fields.length})`);
      }
      for (let i = 0; i < this.data.fields.length; i++) {
        const field = this.data.fields[i];
        if (!field.name || field.name.length === 0) {
          errors.push(`Field[${i}] name is empty`);
        } else if (field.name.length > LIMITS.FIELD_NAME) {
          errors.push(`Field[${i}] name exceeds ${LIMITS.FIELD_NAME} chars (got ${field.name.length})`);
        }
        if (!field.value || field.value.length === 0) {
          errors.push(`Field[${i}] value is empty`);
        } else if (field.value.length > LIMITS.FIELD_VALUE) {
          errors.push(`Field[${i}] value exceeds ${LIMITS.FIELD_VALUE} chars (got ${field.value.length})`);
        }
      }
    }
    if (this.length > LIMITS.TOTAL) {
      errors.push(`Total embed length exceeds ${LIMITS.TOTAL} chars (got ${this.length})`);
    }
    
    return errors;
  }

  /**
   * Validate this embed against Discord/Jubbio limits
   * @throws {RangeError} if any limit is exceeded
   * @returns this (for chaining)
   */
  validate(): this {
    const errors = this.getValidationErrors();
    
    if (errors.length > 0) {
      throw new RangeError(`Embed validation failed:\n- ${errors.join('\n- ')}`);
    }
    
    return this;
  }

  /**
   * Check if this embed is valid (non-throwing version)
   * @returns true if valid, false otherwise
   */
  isValid(): boolean {
    try {
      this.validate();
      return true;
    } catch {
      return false;
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
   * @param color The color (number, hex string, color name, 'Random', or RGB array)
   */
  setColor(color: number | string | [number, number, number] | null): this {
    if (color === null) {
      this.data.color = undefined;
    } else if (typeof color === 'number') {
      this.data.color = color;
    } else if (typeof color === 'string') {
      // ponytail: 'Random' support
      if (color === 'Random') {
        this.data.color = Math.floor(Math.random() * 0xffffff);
      } else {
        // ponytail: Bug #6 fix - Colors lookup for string names like 'Red', 'Green'
        const colorName = color as keyof typeof Colors;
        if (Colors[colorName] !== undefined) {
          this.data.color = Colors[colorName];
        } else {
          this.data.color = parseInt(color.replace('#', ''), 16);
        }
      }
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
   * @param options The image URL string or options object with url, height, width
   */
  setImage(options: string | { url: string; height?: number; width?: number } | null): this {
    if (options === null) {
      this.data.image = undefined;
    } else if (typeof options === 'string') {
      this.data.image = { url: options };
    } else {
      this.data.image = { url: options.url, height: options.height, width: options.width };
    }
    return this;
  }

  /**
   * Sets the thumbnail of this embed
   * @param options The thumbnail URL string or options object with url, height, width
   */
  setThumbnail(options: string | { url: string; height?: number; width?: number } | null): this {
    if (options === null) {
      this.data.thumbnail = undefined;
    } else if (typeof options === 'string') {
      this.data.thumbnail = { url: options };
    } else {
      this.data.thumbnail = { url: options.url, height: options.height, width: options.width };
    }
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
   * Adds fields to this embed (max 25 fields per embed)
   * Accepts individual fields or an array of fields
   */
  addFields(...fields: (APIEmbedField | APIEmbedField[])[]): this {
    if (!this.data.fields) this.data.fields = [];
    const flat: APIEmbedField[] = [];
    for (const f of fields) {
      if (Array.isArray(f)) flat.push(...f);
      else flat.push(f);
    }
    if (this.data.fields.length + flat.length > 25) {
      throw new RangeError(`Embed fields cannot exceed 25. Current: ${this.data.fields.length}, adding: ${flat.length}`);
    }
    this.data.fields.push(...flat);
    return this;
  }

  /**
   * Sets the fields of this embed (max 25 fields per embed)
   * Accepts individual fields or an array of fields
   */
  setFields(...fields: (APIEmbedField | APIEmbedField[])[]): this {
    const flat: APIEmbedField[] = [];
    for (const f of fields) {
      if (Array.isArray(f)) flat.push(...f);
      else flat.push(f);
    }
    if (flat.length > 25) {
      throw new RangeError(`Embed fields cannot exceed 25. Provided: ${flat.length}`);
    }
    this.data.fields = flat;
    return this;
  }

  /**
   * Removes, replaces, or inserts fields (max 25 fields per embed)
   * @param index The index to start at
   * @param deleteCount The number of fields to remove
   * @param fields The fields to insert
   */
  spliceFields(index: number, deleteCount: number, ...fields: APIEmbedField[]): this {
    if (!this.data.fields) this.data.fields = [];
    this.data.fields.splice(index, deleteCount, ...fields);
    if (this.data.fields.length > 25) {
      throw new RangeError(`Embed fields cannot exceed 25. Result would have: ${this.data.fields.length}`);
    }
    return this;
  }

  /**
   * Clears all fields from this embed
   */
  clearFields(): this {
    this.data.fields = [];
    return this;
  }


  /**
   * Returns the JSON representation of this embed
   * ponytail: Bug #7 fix - fields deep copy yapılır
   */
  toJSON(): APIEmbed {
    return {
      ...this.data,
      fields: this.data.fields?.map(f => ({ ...f })),
    };
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
export const Colors = Object.freeze({
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
} as const);

export default EmbedBuilder;
