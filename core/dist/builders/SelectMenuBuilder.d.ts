/**
 * SelectMenuBuilder for creating select menus
 */
export interface APISelectMenuOption {
    label: string;
    value: string;
    description?: string;
    emoji?: {
        id?: string;
        name?: string;
        animated?: boolean;
    };
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
export declare class StringSelectMenuBuilder {
    readonly data: Partial<APISelectMenuComponent>;
    constructor(data?: Partial<APISelectMenuComponent>);
    /**
     * Sets the custom ID of this select menu
     * @param customId The custom ID
     */
    setCustomId(customId: string): this;
    /**
     * Sets the placeholder of this select menu
     * @param placeholder The placeholder
     */
    setPlaceholder(placeholder: string): this;
    /**
     * Sets the minimum values of this select menu
     * @param minValues The minimum values
     */
    setMinValues(minValues: number): this;
    /**
     * Sets the maximum values of this select menu
     * @param maxValues The maximum values
     */
    setMaxValues(maxValues: number): this;
    /**
     * Sets whether this select menu is disabled
     * @param disabled Whether the select menu is disabled
     */
    setDisabled(disabled?: boolean): this;
    /**
     * Adds options to this select menu
     * Accepts individual options or an array of options
     */
    addOptions(...options: (APISelectMenuOption | APISelectMenuOption[])[]): this;
    /**
     * Sets the options of this select menu
     * Accepts individual options or an array of options
     */
    setOptions(...options: (APISelectMenuOption | APISelectMenuOption[])[]): this;
    /**
     * Removes, replaces, or inserts options
     * @param index The index to start at
     * @param deleteCount The number of options to remove
     * @param options The options to insert
     */
    spliceOptions(index: number, deleteCount: number, ...options: APISelectMenuOption[]): this;
    /**
     * Returns the JSON representation of this select menu
     */
    toJSON(): APISelectMenuComponent;
    /**
     * Creates a new select menu builder from existing data
     * @param other The select menu data to copy
     */
    static from(other: Partial<APISelectMenuComponent> | StringSelectMenuBuilder): StringSelectMenuBuilder;
}
/**
 * A builder for creating select menu options
 */
export declare class StringSelectMenuOptionBuilder {
    readonly data: Partial<APISelectMenuOption>;
    constructor(data?: Partial<APISelectMenuOption>);
    /**
     * Sets the label of this option
     * @param label The label
     */
    setLabel(label: string): this;
    /**
     * Sets the value of this option
     * @param value The value
     */
    setValue(value: string): this;
    /**
     * Sets the description of this option
     * @param description The description
     */
    setDescription(description: string): this;
    /**
     * Sets the emoji of this option
     * @param emoji The emoji
     */
    setEmoji(emoji: {
        id?: string;
        name?: string;
        animated?: boolean;
    } | string): this;
    /**
     * Sets whether this option is the default
     * @param isDefault Whether this option is the default
     */
    setDefault(isDefault?: boolean): this;
    /**
     * Returns the JSON representation of this option
     */
    toJSON(): APISelectMenuOption;
}
export { StringSelectMenuBuilder as SelectMenuBuilder };
/**
 * Component types for select menus
 */
export declare enum SelectMenuType {
    String = 3,
    User = 5,
    Role = 6,
    Mentionable = 7,
    Channel = 8
}
/**
 * Base interface for auto-populated select menus (User, Role, Mentionable, Channel)
 */
interface APIAutoSelectMenuComponent {
    type: number;
    custom_id: string;
    placeholder?: string;
    min_values?: number;
    max_values?: number;
    disabled?: boolean;
    /** Channel types to include (only for ChannelSelectMenu) */
    channel_types?: number[];
}
/**
 * A builder for creating user select menus
 * Users are auto-populated from the guild
 */
export declare class UserSelectMenuBuilder {
    readonly data: Partial<APIAutoSelectMenuComponent>;
    constructor(data?: Partial<APIAutoSelectMenuComponent>);
    setCustomId(customId: string): this;
    setPlaceholder(placeholder: string): this;
    setMinValues(minValues: number): this;
    setMaxValues(maxValues: number): this;
    setDisabled(disabled?: boolean): this;
    toJSON(): APIAutoSelectMenuComponent;
}
/**
 * A builder for creating role select menus
 * Roles are auto-populated from the guild
 */
export declare class RoleSelectMenuBuilder {
    readonly data: Partial<APIAutoSelectMenuComponent>;
    constructor(data?: Partial<APIAutoSelectMenuComponent>);
    setCustomId(customId: string): this;
    setPlaceholder(placeholder: string): this;
    setMinValues(minValues: number): this;
    setMaxValues(maxValues: number): this;
    setDisabled(disabled?: boolean): this;
    toJSON(): APIAutoSelectMenuComponent;
}
/**
 * A builder for creating mentionable select menus (users + roles)
 */
export declare class MentionableSelectMenuBuilder {
    readonly data: Partial<APIAutoSelectMenuComponent>;
    constructor(data?: Partial<APIAutoSelectMenuComponent>);
    setCustomId(customId: string): this;
    setPlaceholder(placeholder: string): this;
    setMinValues(minValues: number): this;
    setMaxValues(maxValues: number): this;
    setDisabled(disabled?: boolean): this;
    toJSON(): APIAutoSelectMenuComponent;
}
/**
 * A builder for creating channel select menus
 * Channels are auto-populated from the guild
 */
export declare class ChannelSelectMenuBuilder {
    readonly data: Partial<APIAutoSelectMenuComponent>;
    constructor(data?: Partial<APIAutoSelectMenuComponent>);
    setCustomId(customId: string): this;
    setPlaceholder(placeholder: string): this;
    setMinValues(minValues: number): this;
    setMaxValues(maxValues: number): this;
    setDisabled(disabled?: boolean): this;
    /**
     * Sets the channel types that can be selected
     * @param types Array of ChannelType values
     */
    setChannelTypes(types: number[]): this;
    toJSON(): APIAutoSelectMenuComponent;
}
export default StringSelectMenuBuilder;
