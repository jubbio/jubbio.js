/**
 * SelectMenuBuilder for creating select menus
 */

export interface APISelectMenuOption {
  label: string;
  value: string;
  description?: string;
  emoji?: { id?: string; name?: string; animated?: boolean };
  default?: boolean;
}

export interface APISelectMenuComponent {
  type: 3;
  custom_id: string;
  options?: APISelectMenuOption[];
  placeholder?: string;
  min_values?: number;
  max_values?: number;
  disabled?: boolean;
}

/**
 * A builder for creating string select menus
 */
export class StringSelectMenuBuilder {
  public readonly data: Partial<APISelectMenuComponent>;

  constructor(data: Partial<APISelectMenuComponent> = {}) {
    this.data = { type: 3, ...data };
    if (!this.data.options) this.data.options = [];
  }

  /**
   * Sets the custom ID of this select menu
   * @param customId The custom ID
   */
  setCustomId(customId: string): this {
    this.data.custom_id = customId;
    return this;
  }

  /**
   * Sets the placeholder of this select menu
   * @param placeholder The placeholder
   */
  setPlaceholder(placeholder: string): this {
    this.data.placeholder = placeholder;
    return this;
  }

  /**
   * Sets the minimum values of this select menu
   * @param minValues The minimum values
   */
  setMinValues(minValues: number): this {
    this.data.min_values = minValues;
    return this;
  }

  /**
   * Sets the maximum values of this select menu
   * @param maxValues The maximum values
   */
  setMaxValues(maxValues: number): this {
    this.data.max_values = maxValues;
    return this;
  }

  /**
   * Sets whether this select menu is disabled
   * @param disabled Whether the select menu is disabled
   */
  setDisabled(disabled = true): this {
    this.data.disabled = disabled;
    return this;
  }

  /**
   * Adds options to this select menu
   * @param options The options to add
   */
  addOptions(...options: APISelectMenuOption[]): this {
    if (!this.data.options) this.data.options = [];
    this.data.options.push(...options);
    return this;
  }

  /**
   * Sets the options of this select menu
   * @param options The options to set
   */
  setOptions(...options: APISelectMenuOption[]): this {
    this.data.options = options;
    return this;
  }

  /**
   * Removes, replaces, or inserts options
   * @param index The index to start at
   * @param deleteCount The number of options to remove
   * @param options The options to insert
   */
  spliceOptions(index: number, deleteCount: number, ...options: APISelectMenuOption[]): this {
    if (!this.data.options) this.data.options = [];
    this.data.options.splice(index, deleteCount, ...options);
    return this;
  }

  /**
   * Returns the JSON representation of this select menu
   */
  toJSON(): APISelectMenuComponent {
    return { ...this.data } as APISelectMenuComponent;
  }

  /**
   * Creates a new select menu builder from existing data
   * @param other The select menu data to copy
   */
  static from(other: Partial<APISelectMenuComponent> | StringSelectMenuBuilder): StringSelectMenuBuilder {
    return new StringSelectMenuBuilder(other instanceof StringSelectMenuBuilder ? other.data : other);
  }
}

/**
 * A builder for creating select menu options
 */
export class StringSelectMenuOptionBuilder {
  public readonly data: Partial<APISelectMenuOption>;

  constructor(data: Partial<APISelectMenuOption> = {}) {
    this.data = { ...data };
  }

  /**
   * Sets the label of this option
   * @param label The label
   */
  setLabel(label: string): this {
    this.data.label = label;
    return this;
  }

  /**
   * Sets the value of this option
   * @param value The value
   */
  setValue(value: string): this {
    this.data.value = value;
    return this;
  }

  /**
   * Sets the description of this option
   * @param description The description
   */
  setDescription(description: string): this {
    this.data.description = description;
    return this;
  }

  /**
   * Sets the emoji of this option
   * @param emoji The emoji
   */
  setEmoji(emoji: { id?: string; name?: string; animated?: boolean } | string): this {
    if (typeof emoji === 'string') {
      this.data.emoji = { name: emoji };
    } else {
      this.data.emoji = emoji;
    }
    return this;
  }

  /**
   * Sets whether this option is the default
   * @param isDefault Whether this option is the default
   */
  setDefault(isDefault = true): this {
    this.data.default = isDefault;
    return this;
  }

  /**
   * Returns the JSON representation of this option
   */
  toJSON(): APISelectMenuOption {
    return { ...this.data } as APISelectMenuOption;
  }
}

// Alias for DJS compatibility
export { StringSelectMenuBuilder as SelectMenuBuilder };

export default StringSelectMenuBuilder;
