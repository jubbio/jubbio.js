/**
 * ModalBuilder for creating modals
 */
/**
 * Text input styles
 */
export declare enum TextInputStyle {
    Short = 1,
    Paragraph = 2
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
export declare class TextInputBuilder {
    readonly data: Partial<APITextInputComponent>;
    constructor(data?: Partial<APITextInputComponent>);
    /**
     * Sets the custom ID of this text input
     * @param customId The custom ID
     */
    setCustomId(customId: string): this;
    /**
     * Sets the label of this text input
     * @param label The label
     */
    setLabel(label: string): this;
    /**
     * Sets the style of this text input
     * @param style The style
     */
    setStyle(style: TextInputStyle): this;
    /**
     * Sets the minimum length of this text input
     * @param minLength The minimum length
     */
    setMinLength(minLength: number): this;
    /**
     * Sets the maximum length of this text input
     * @param maxLength The maximum length
     */
    setMaxLength(maxLength: number): this;
    /**
     * Sets whether this text input is required
     * @param required Whether the text input is required
     */
    setRequired(required?: boolean): this;
    /**
     * Sets the value of this text input
     * @param value The value
     */
    setValue(value: string): this;
    /**
     * Sets the placeholder of this text input
     * @param placeholder The placeholder
     */
    setPlaceholder(placeholder: string): this;
    /**
     * Returns the JSON representation of this text input
     */
    toJSON(): APITextInputComponent;
}
/**
 * A builder for creating modals
 */
export declare class ModalBuilder {
    readonly data: Partial<APIModal>;
    constructor(data?: Partial<APIModal>);
    /**
     * Sets the custom ID of this modal
     * @param customId The custom ID
     */
    setCustomId(customId: string): this;
    /**
     * Sets the title of this modal
     * @param title The title
     */
    setTitle(title: string): this;
    /**
     * Adds components (action rows with text inputs) to this modal
     * @param components The components to add
     */
    addComponents(...components: (APIModalActionRow | {
        toJSON(): APIModalActionRow;
    })[]): this;
    /**
     * Sets the components of this modal
     * @param components The components to set
     */
    setComponents(...components: (APIModalActionRow | {
        toJSON(): APIModalActionRow;
    })[]): this;
    /**
     * Returns the JSON representation of this modal
     */
    toJSON(): APIModal;
    /**
     * Creates a new modal builder from existing data
     * @param other The modal data to copy
     */
    static from(other: Partial<APIModal> | ModalBuilder): ModalBuilder;
}
export default ModalBuilder;
