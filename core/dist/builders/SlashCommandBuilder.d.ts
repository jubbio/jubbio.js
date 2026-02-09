/**
 * SlashCommandBuilder for creating slash commands
 */
/**
 * Application command option types
 */
export declare enum ApplicationCommandOptionType {
    Subcommand = 1,
    SubcommandGroup = 2,
    String = 3,
    Integer = 4,
    Boolean = 5,
    User = 6,
    Channel = 7,
    Role = 8,
    Mentionable = 9,
    Number = 10,
    Attachment = 11
}
export interface APIApplicationCommandOptionChoice {
    name: string;
    value: string | number;
}
export interface APIApplicationCommandOption {
    type: ApplicationCommandOptionType;
    name: string;
    description: string;
    required?: boolean;
    choices?: APIApplicationCommandOptionChoice[];
    options?: APIApplicationCommandOption[];
    min_value?: number;
    max_value?: number;
    min_length?: number;
    max_length?: number;
    autocomplete?: boolean;
    channel_types?: number[];
}
export interface APIApplicationCommand {
    name: string;
    description: string;
    options?: APIApplicationCommandOption[];
    default_member_permissions?: string;
    dm_permission?: boolean;
    nsfw?: boolean;
}
/**
 * A builder for creating slash command options
 */
declare class SlashCommandOptionBuilder {
    protected data: Partial<APIApplicationCommandOption>;
    constructor(type: ApplicationCommandOptionType);
    setName(name: string): this;
    setDescription(description: string): this;
    setRequired(required?: boolean): this;
    toJSON(): APIApplicationCommandOption;
}
/**
 * String option builder
 */
export declare class SlashCommandStringOption extends SlashCommandOptionBuilder {
    constructor();
    addChoices(...choices: APIApplicationCommandOptionChoice[]): this;
    setChoices(...choices: APIApplicationCommandOptionChoice[]): this;
    setMinLength(minLength: number): this;
    setMaxLength(maxLength: number): this;
    setAutocomplete(autocomplete?: boolean): this;
}
/**
 * Integer option builder
 */
export declare class SlashCommandIntegerOption extends SlashCommandOptionBuilder {
    constructor();
    addChoices(...choices: APIApplicationCommandOptionChoice[]): this;
    setMinValue(minValue: number): this;
    setMaxValue(maxValue: number): this;
    setAutocomplete(autocomplete?: boolean): this;
}
/**
 * Number option builder
 */
export declare class SlashCommandNumberOption extends SlashCommandOptionBuilder {
    constructor();
    addChoices(...choices: APIApplicationCommandOptionChoice[]): this;
    setMinValue(minValue: number): this;
    setMaxValue(maxValue: number): this;
    setAutocomplete(autocomplete?: boolean): this;
}
/**
 * Boolean option builder
 */
export declare class SlashCommandBooleanOption extends SlashCommandOptionBuilder {
    constructor();
}
/**
 * User option builder
 */
export declare class SlashCommandUserOption extends SlashCommandOptionBuilder {
    constructor();
}
/**
 * Channel option builder
 */
export declare class SlashCommandChannelOption extends SlashCommandOptionBuilder {
    constructor();
    addChannelTypes(...types: number[]): this;
}
/**
 * Role option builder
 */
export declare class SlashCommandRoleOption extends SlashCommandOptionBuilder {
    constructor();
}
/**
 * Mentionable option builder
 */
export declare class SlashCommandMentionableOption extends SlashCommandOptionBuilder {
    constructor();
}
/**
 * Attachment option builder
 */
export declare class SlashCommandAttachmentOption extends SlashCommandOptionBuilder {
    constructor();
}
/**
 * A builder for creating slash commands
 */
export declare class SlashCommandBuilder {
    readonly data: Partial<APIApplicationCommand>;
    constructor();
    /**
     * Sets the name of this command
     * @param name The name
     */
    setName(name: string): this;
    /**
     * Sets the description of this command
     * @param description The description
     */
    setDescription(description: string): this;
    /**
     * Sets the default member permissions required to use this command
     * @param permissions The permissions
     */
    setDefaultMemberPermissions(permissions: bigint | string | null): this;
    /**
     * Sets whether this command is available in DMs
     * @param enabled Whether the command is available in DMs
     */
    setDMPermission(enabled: boolean): this;
    /**
     * Sets whether this command is NSFW
     * @param nsfw Whether the command is NSFW
     */
    setNSFW(nsfw?: boolean): this;
    /**
     * Adds a string option
     */
    addStringOption(fn: (option: SlashCommandStringOption) => SlashCommandStringOption): this;
    /**
     * Adds an integer option
     */
    addIntegerOption(fn: (option: SlashCommandIntegerOption) => SlashCommandIntegerOption): this;
    /**
     * Adds a number option
     */
    addNumberOption(fn: (option: SlashCommandNumberOption) => SlashCommandNumberOption): this;
    /**
     * Adds a boolean option
     */
    addBooleanOption(fn: (option: SlashCommandBooleanOption) => SlashCommandBooleanOption): this;
    /**
     * Adds a user option
     */
    addUserOption(fn: (option: SlashCommandUserOption) => SlashCommandUserOption): this;
    /**
     * Adds a channel option
     */
    addChannelOption(fn: (option: SlashCommandChannelOption) => SlashCommandChannelOption): this;
    /**
     * Adds a role option
     */
    addRoleOption(fn: (option: SlashCommandRoleOption) => SlashCommandRoleOption): this;
    /**
     * Adds a mentionable option
     */
    addMentionableOption(fn: (option: SlashCommandMentionableOption) => SlashCommandMentionableOption): this;
    /**
     * Adds an attachment option
     */
    addAttachmentOption(fn: (option: SlashCommandAttachmentOption) => SlashCommandAttachmentOption): this;
    /**
     * Returns the JSON representation of this command
     */
    toJSON(): APIApplicationCommand;
}
export default SlashCommandBuilder;
