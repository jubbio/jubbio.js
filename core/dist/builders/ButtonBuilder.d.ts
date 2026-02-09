/**
 * ButtonBuilder for creating interactive buttons
 */
/**
 * Button styles
 */
export declare enum ButtonStyle {
    Primary = 1,
    Secondary = 2,
    Success = 3,
    Danger = 4,
    Link = 5
}
export interface APIButtonComponent {
    type: 2;
    style: ButtonStyle;
    label?: string;
    emoji?: {
        id?: string;
        name?: string;
        animated?: boolean;
    };
    custom_id?: string;
    url?: string;
    disabled?: boolean;
}
/**
 * A builder for creating buttons
 */
export declare class ButtonBuilder {
    readonly data: Partial<APIButtonComponent>;
    constructor(data?: Partial<APIButtonComponent>);
    /**
     * Sets the custom ID of this button
     * @param customId The custom ID
     */
    setCustomId(customId: string): this;
    /**
     * Sets the label of this button
     * @param label The label
     */
    setLabel(label: string): this;
    /**
     * Sets the style of this button
     * @param style The style
     */
    setStyle(style: ButtonStyle): this;
    /**
     * Sets the emoji of this button
     * @param emoji The emoji
     */
    setEmoji(emoji: {
        id?: string;
        name?: string;
        animated?: boolean;
    } | string): this;
    /**
     * Sets the URL of this button (only for Link style)
     * @param url The URL
     */
    setURL(url: string): this;
    /**
     * Sets whether this button is disabled
     * @param disabled Whether the button is disabled
     */
    setDisabled(disabled?: boolean): this;
    /**
     * Returns the JSON representation of this button
     */
    toJSON(): APIButtonComponent;
    /**
     * Creates a new button builder from existing data
     * @param other The button data to copy
     */
    static from(other: Partial<APIButtonComponent> | ButtonBuilder): ButtonBuilder;
}
export default ButtonBuilder;
