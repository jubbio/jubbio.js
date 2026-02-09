/**
 * ModalBuilder for creating modals
 */

/**
 * Text input styles
 */
export enum TextInputStyle {
  Short = 1,
  Paragraph = 2,
}

export interface APITextInputComponent {
  type: 4;
  custom_id: string;
  style: TextInputStyle;
  label: string;
  min_length?: number;
  max_length?: number;
  required?: boolean;
  value?: string;
  placeholder?: string;
}

export interface APIModalActionRow {
  type: 1;
  components: APITextInputComponent[];
}

export interface APIModal {
  custom_id: string;
  title: string;
  components: APIModalActionRow[];
}

/**
 * A builder for creating text inputs
 */
export class TextInputBuilder {
  public readonly data: Partial<APITextInputComponent>;

  constructor(data: Partial<APITextInputComponent> = {}) {
    this.data = { type: 4, ...data };
  }

  /**
   * Sets the custom ID of this text input
   * @param customId The custom ID
   */
  setCustomId(customId: string): this {
    this.data.custom_id = customId;
    return this;
  }

  /**
   * Sets the label of this text input
   * @param label The label
   */
  setLabel(label: string): this {
    this.data.label = label;
    return this;
  }

  /**
   * Sets the style of this text input
   * @param style The style
   */
  setStyle(style: TextInputStyle): this {
    this.data.style = style;
    return this;
  }

  /**
   * Sets the minimum length of this text input
   * @param minLength The minimum length
   */
  setMinLength(minLength: number): this {
    this.data.min_length = minLength;
    return this;
  }

  /**
   * Sets the maximum length of this text input
   * @param maxLength The maximum length
   */
  setMaxLength(maxLength: number): this {
    this.data.max_length = maxLength;
    return this;
  }

  /**
   * Sets whether this text input is required
   * @param required Whether the text input is required
   */
  setRequired(required = true): this {
    this.data.required = required;
    return this;
  }

  /**
   * Sets the value of this text input
   * @param value The value
   */
  setValue(value: string): this {
    this.data.value = value;
    return this;
  }

  /**
   * Sets the placeholder of this text input
   * @param placeholder The placeholder
   */
  setPlaceholder(placeholder: string): this {
    this.data.placeholder = placeholder;
    return this;
  }

  /**
   * Returns the JSON representation of this text input
   */
  toJSON(): APITextInputComponent {
    return { ...this.data } as APITextInputComponent;
  }
}

/**
 * A builder for creating modals
 */
export class ModalBuilder {
  public readonly data: Partial<APIModal>;

  constructor(data: Partial<APIModal> = {}) {
    this.data = { ...data };
    if (!this.data.components) this.data.components = [];
  }

  /**
   * Sets the custom ID of this modal
   * @param customId The custom ID
   */
  setCustomId(customId: string): this {
    this.data.custom_id = customId;
    return this;
  }

  /**
   * Sets the title of this modal
   * @param title The title
   */
  setTitle(title: string): this {
    this.data.title = title;
    return this;
  }

  /**
   * Adds components (action rows with text inputs) to this modal
   * @param components The components to add
   */
  addComponents(...components: (APIModalActionRow | { toJSON(): APIModalActionRow })[]): this {
    if (!this.data.components) this.data.components = [];
    for (const component of components) {
      if ('toJSON' in component && typeof component.toJSON === 'function') {
        this.data.components.push(component.toJSON());
      } else {
        this.data.components.push(component as APIModalActionRow);
      }
    }
    return this;
  }

  /**
   * Sets the components of this modal
   * @param components The components to set
   */
  setComponents(...components: (APIModalActionRow | { toJSON(): APIModalActionRow })[]): this {
    this.data.components = [];
    return this.addComponents(...components);
  }

  /**
   * Returns the JSON representation of this modal
   */
  toJSON(): APIModal {
    return { ...this.data } as APIModal;
  }

  /**
   * Creates a new modal builder from existing data
   * @param other The modal data to copy
   */
  static from(other: Partial<APIModal> | ModalBuilder): ModalBuilder {
    return new ModalBuilder(other instanceof ModalBuilder ? other.data : other);
  }
}

export default ModalBuilder;
