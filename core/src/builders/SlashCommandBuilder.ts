/**
 * SlashCommandBuilder for creating slash commands
 */

/**
 * Application command option types
 */
export enum ApplicationCommandOptionType {
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
  Attachment = 11,
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
class SlashCommandOptionBuilder {
  protected data: Partial<APIApplicationCommandOption>;

  constructor(type: ApplicationCommandOptionType) {
    this.data = { type };
  }

  setName(name: string): this {
    this.data.name = name;
    return this;
  }

  setDescription(description: string): this {
    this.data.description = description;
    return this;
  }

  setRequired(required = true): this {
    this.data.required = required;
    return this;
  }

  toJSON(): APIApplicationCommandOption {
    return { ...this.data } as APIApplicationCommandOption;
  }
}

/**
 * String option builder
 */
export class SlashCommandStringOption extends SlashCommandOptionBuilder {
  constructor() {
    super(ApplicationCommandOptionType.String);
  }

  addChoices(...choices: APIApplicationCommandOptionChoice[]): this {
    if (!this.data.choices) this.data.choices = [];
    this.data.choices.push(...choices);
    return this;
  }

  setChoices(...choices: APIApplicationCommandOptionChoice[]): this {
    this.data.choices = choices;
    return this;
  }

  setMinLength(minLength: number): this {
    this.data.min_length = minLength;
    return this;
  }

  setMaxLength(maxLength: number): this {
    this.data.max_length = maxLength;
    return this;
  }

  setAutocomplete(autocomplete = true): this {
    this.data.autocomplete = autocomplete;
    return this;
  }
}

/**
 * Integer option builder
 */
export class SlashCommandIntegerOption extends SlashCommandOptionBuilder {
  constructor() {
    super(ApplicationCommandOptionType.Integer);
  }

  addChoices(...choices: APIApplicationCommandOptionChoice[]): this {
    if (!this.data.choices) this.data.choices = [];
    this.data.choices.push(...choices);
    return this;
  }

  setMinValue(minValue: number): this {
    this.data.min_value = minValue;
    return this;
  }

  setMaxValue(maxValue: number): this {
    this.data.max_value = maxValue;
    return this;
  }

  setAutocomplete(autocomplete = true): this {
    this.data.autocomplete = autocomplete;
    return this;
  }
}

/**
 * Number option builder
 */
export class SlashCommandNumberOption extends SlashCommandOptionBuilder {
  constructor() {
    super(ApplicationCommandOptionType.Number);
  }

  addChoices(...choices: APIApplicationCommandOptionChoice[]): this {
    if (!this.data.choices) this.data.choices = [];
    this.data.choices.push(...choices);
    return this;
  }

  setMinValue(minValue: number): this {
    this.data.min_value = minValue;
    return this;
  }

  setMaxValue(maxValue: number): this {
    this.data.max_value = maxValue;
    return this;
  }

  setAutocomplete(autocomplete = true): this {
    this.data.autocomplete = autocomplete;
    return this;
  }
}

/**
 * Boolean option builder
 */
export class SlashCommandBooleanOption extends SlashCommandOptionBuilder {
  constructor() {
    super(ApplicationCommandOptionType.Boolean);
  }
}

/**
 * User option builder
 */
export class SlashCommandUserOption extends SlashCommandOptionBuilder {
  constructor() {
    super(ApplicationCommandOptionType.User);
  }
}

/**
 * Channel option builder
 */
export class SlashCommandChannelOption extends SlashCommandOptionBuilder {
  constructor() {
    super(ApplicationCommandOptionType.Channel);
  }

  addChannelTypes(...types: number[]): this {
    if (!this.data.channel_types) this.data.channel_types = [];
    this.data.channel_types.push(...types);
    return this;
  }
}

/**
 * Role option builder
 */
export class SlashCommandRoleOption extends SlashCommandOptionBuilder {
  constructor() {
    super(ApplicationCommandOptionType.Role);
  }
}

/**
 * Mentionable option builder
 */
export class SlashCommandMentionableOption extends SlashCommandOptionBuilder {
  constructor() {
    super(ApplicationCommandOptionType.Mentionable);
  }
}

/**
 * Attachment option builder
 */
export class SlashCommandAttachmentOption extends SlashCommandOptionBuilder {
  constructor() {
    super(ApplicationCommandOptionType.Attachment);
  }
}

/**
 * A builder for creating slash commands
 */
export class SlashCommandBuilder {
  public readonly data: Partial<APIApplicationCommand>;

  constructor() {
    this.data = { options: [] };
  }

  /**
   * Sets the name of this command
   * @param name The name
   */
  setName(name: string): this {
    this.data.name = name;
    return this;
  }

  /**
   * Sets the description of this command
   * @param description The description
   */
  setDescription(description: string): this {
    this.data.description = description;
    return this;
  }

  /**
   * Sets the default member permissions required to use this command
   * @param permissions The permissions
   */
  setDefaultMemberPermissions(permissions: bigint | string | null): this {
    this.data.default_member_permissions = permissions === null 
      ? undefined 
      : String(permissions);
    return this;
  }

  /**
   * Sets whether this command is available in DMs
   * @param enabled Whether the command is available in DMs
   */
  setDMPermission(enabled: boolean): this {
    this.data.dm_permission = enabled;
    return this;
  }

  /**
   * Sets whether this command is NSFW
   * @param nsfw Whether the command is NSFW
   */
  setNSFW(nsfw = true): this {
    this.data.nsfw = nsfw;
    return this;
  }

  /**
   * Adds a string option
   */
  addStringOption(fn: (option: SlashCommandStringOption) => SlashCommandStringOption): this {
    const option = fn(new SlashCommandStringOption());
    this.data.options!.push(option.toJSON());
    return this;
  }

  /**
   * Adds an integer option
   */
  addIntegerOption(fn: (option: SlashCommandIntegerOption) => SlashCommandIntegerOption): this {
    const option = fn(new SlashCommandIntegerOption());
    this.data.options!.push(option.toJSON());
    return this;
  }

  /**
   * Adds a number option
   */
  addNumberOption(fn: (option: SlashCommandNumberOption) => SlashCommandNumberOption): this {
    const option = fn(new SlashCommandNumberOption());
    this.data.options!.push(option.toJSON());
    return this;
  }

  /**
   * Adds a boolean option
   */
  addBooleanOption(fn: (option: SlashCommandBooleanOption) => SlashCommandBooleanOption): this {
    const option = fn(new SlashCommandBooleanOption());
    this.data.options!.push(option.toJSON());
    return this;
  }

  /**
   * Adds a user option
   */
  addUserOption(fn: (option: SlashCommandUserOption) => SlashCommandUserOption): this {
    const option = fn(new SlashCommandUserOption());
    this.data.options!.push(option.toJSON());
    return this;
  }

  /**
   * Adds a channel option
   */
  addChannelOption(fn: (option: SlashCommandChannelOption) => SlashCommandChannelOption): this {
    const option = fn(new SlashCommandChannelOption());
    this.data.options!.push(option.toJSON());
    return this;
  }

  /**
   * Adds a role option
   */
  addRoleOption(fn: (option: SlashCommandRoleOption) => SlashCommandRoleOption): this {
    const option = fn(new SlashCommandRoleOption());
    this.data.options!.push(option.toJSON());
    return this;
  }

  /**
   * Adds a mentionable option
   */
  addMentionableOption(fn: (option: SlashCommandMentionableOption) => SlashCommandMentionableOption): this {
    const option = fn(new SlashCommandMentionableOption());
    this.data.options!.push(option.toJSON());
    return this;
  }

  /**
   * Adds an attachment option
   */
  addAttachmentOption(fn: (option: SlashCommandAttachmentOption) => SlashCommandAttachmentOption): this {
    const option = fn(new SlashCommandAttachmentOption());
    this.data.options!.push(option.toJSON());
    return this;
  }

  /**
   * Returns the JSON representation of this command
   */
  toJSON(): APIApplicationCommand {
    return { ...this.data } as APIApplicationCommand;
  }
}

export default SlashCommandBuilder;
