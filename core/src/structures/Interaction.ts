import { APIInteraction, APIInteractionOption, APIEmbed } from '../types';
import { InteractionType, InteractionResponseType, MessageFlags } from '../enums';
import { User } from './User';
import { GuildMember } from './GuildMember';
import type { Client } from '../Client';

/**
 * Base interaction class
 */
export class Interaction {
  /** Reference to the client */
  public readonly client: Client;
  
  /** Interaction ID */
  public readonly id: string;
  
  /** Application ID */
  public readonly applicationId: string;
  
  /** Interaction type */
  public readonly type: InteractionType;
  
  /** Guild ID */
  public readonly guildId?: string;
  
  /** Channel ID */
  public readonly channelId?: string;
  
  /** Interaction token */
  public readonly token: string;
  
  /** User who triggered the interaction */
  public readonly user: User;
  
  /** Guild member (if in a guild) */
  public readonly member?: GuildMember;
  
  /** Whether the interaction has been replied to */
  public replied = false;
  
  /** Whether the interaction has been deferred */
  public deferred = false;

  constructor(client: Client, data: APIInteraction) {
    this.client = client;
    // Handle both string and number IDs
    this.id = String(data.id);
    this.applicationId = String(data.application_id);
    this.type = data.type;
    this.guildId = data.guild_id ? String(data.guild_id) : undefined;
    this.channelId = data.channel_id ? String(data.channel_id) : undefined;
    this.token = data.token;
    
    // User can come from member.user or directly from user
    const userData = data.member?.user || data.user;
    this.user = userData ? new User(userData) : new User({ id: '0', username: 'Unknown' });
    
    // Create member if in guild
    if (data.member && this.guildId) {
      const guild = client.guilds.get(this.guildId);
      if (guild) {
        this.member = new GuildMember(client, guild, data.member);
      }
    }
  }

  /**
   * Check if this is a command interaction
   */
  isCommand(): this is CommandInteraction {
    return this.type === InteractionType.ApplicationCommand;
  }

  /**
   * Check if this is an autocomplete interaction
   */
  isAutocomplete(): this is AutocompleteInteraction {
    return this.type === InteractionType.ApplicationCommandAutocomplete;
  }

  /**
   * Check if this is a modal submit interaction
   */
  isModalSubmit(): this is ModalSubmitInteraction {
    return this.type === InteractionType.ModalSubmit;
  }

  /**
   * Check if this is a button interaction
   */
  isButton(): this is ButtonInteraction {
    return this.type === InteractionType.MessageComponent && (this as any).componentType === 2;
  }

  /**
   * Check if this is a select menu interaction
   */
  isSelectMenu(): this is SelectMenuInteraction {
    return this.type === InteractionType.MessageComponent && (this as any).componentType === 3;
  }

  /**
   * Reply to the interaction
   */
  async reply(options: string | InteractionReplyOptions): Promise<void> {
    if (this.replied || this.deferred) {
      throw new Error('Interaction has already been replied to or deferred');
    }
    
    const content = typeof options === 'string' ? options : options.content;
    const embeds = typeof options === 'string' ? undefined : options.embeds;
    const components = typeof options === 'string' ? undefined : options.components;
    const ephemeral = typeof options === 'string' ? false : options.ephemeral;
    
    await this.client.rest.createInteractionResponse(this.id, this.token, {
      type: InteractionResponseType.ChannelMessageWithSource,
      data: {
        content,
        embeds,
        components,
        flags: ephemeral ? MessageFlags.Ephemeral : 0
      }
    });
    
    this.replied = true;
  }

  /**
   * Defer the reply (shows "thinking...")
   */
  async deferReply(options?: { ephemeral?: boolean }): Promise<void> {
    if (this.replied || this.deferred) {
      throw new Error('Interaction has already been replied to or deferred');
    }
    
    await this.client.rest.createInteractionResponse(this.id, this.token, {
      type: InteractionResponseType.DeferredChannelMessageWithSource,
      data: options?.ephemeral ? { flags: MessageFlags.Ephemeral } : undefined
    });
    
    this.deferred = true;
  }

  /**
   * Edit the reply
   */
  async editReply(options: string | InteractionReplyOptions): Promise<void> {
    const content = typeof options === 'string' ? options : options.content;
    const embeds = typeof options === 'string' ? undefined : options.embeds;
    const components = typeof options === 'string' ? undefined : options.components;
    const files = typeof options === 'string' ? undefined : options.files;
    
    await this.client.rest.editInteractionResponse(this.token, {
      content,
      embeds,
      components,
      files
    }, this.guildId, this.channelId, this.id);
  }

  /**
   * Delete the reply
   */
  async deleteReply(): Promise<void> {
    await this.client.rest.deleteInteractionResponse(this.token);
  }

  /**
   * Send a followup message
   */
  async followUp(options: string | InteractionReplyOptions): Promise<void> {
    const content = typeof options === 'string' ? options : options.content;
    const embeds = typeof options === 'string' ? undefined : options.embeds;
    const ephemeral = typeof options === 'string' ? false : options.ephemeral;
    
    await this.client.rest.createFollowup(this.token, {
      content,
      embeds,
      flags: ephemeral ? MessageFlags.Ephemeral : 0
    });
  }
}

/**
 * Command interaction
 */
export class CommandInteraction extends Interaction {
  /** Command name */
  public readonly commandName: string;
  
  /** Command options */
  public readonly options: CommandInteractionOptions;

  constructor(client: Client, data: APIInteraction) {
    super(client, data);
    this.commandName = data.data?.name || '';
    this.options = new CommandInteractionOptions(data.data?.options || []);
  }

  /**
   * Show a modal
   */
  async showModal(modal: ModalData): Promise<void> {
    await this.client.rest.createInteractionResponse(this.id, this.token, {
      type: InteractionResponseType.Modal,
      data: modal
    });
  }
}

/**
 * Command interaction options helper
 */
export class CommandInteractionOptions {
  private options: APIInteractionOption[];

  constructor(options: APIInteractionOption[]) {
    this.options = options;
  }

  /**
   * Get a string option
   */
  getString(name: string, required?: boolean): string | null {
    const option = this.options.find(o => o.name === name);
    if (!option && required) throw new Error(`Required option "${name}" not found`);
    return option?.value as string || null;
  }

  /**
   * Get an integer option
   */
  getInteger(name: string, required?: boolean): number | null {
    const option = this.options.find(o => o.name === name);
    if (!option && required) throw new Error(`Required option "${name}" not found`);
    return option?.value as number || null;
  }

  /**
   * Get a number option
   */
  getNumber(name: string, required?: boolean): number | null {
    return this.getInteger(name, required);
  }

  /**
   * Get a boolean option
   */
  getBoolean(name: string, required?: boolean): boolean | null {
    const option = this.options.find(o => o.name === name);
    if (!option && required) throw new Error(`Required option "${name}" not found`);
    return option?.value as boolean ?? null;
  }

  /**
   * Get a user option
   */
  getUser(name: string, required?: boolean): string | null {
    const option = this.options.find(o => o.name === name);
    if (!option && required) throw new Error(`Required option "${name}" not found`);
    return option?.value as string || null;
  }

  /**
   * Get a channel option
   */
  getChannel(name: string, required?: boolean): string | null {
    const option = this.options.find(o => o.name === name);
    if (!option && required) throw new Error(`Required option "${name}" not found`);
    return option?.value as string || null;
  }

  /**
   * Get a subcommand name
   */
  getSubcommand(required?: boolean): string | null {
    const option = this.options.find(o => o.type === 1);
    if (!option && required) throw new Error('Required subcommand not found');
    return option?.name || null;
  }

  /**
   * Get the focused option (for autocomplete)
   */
  getFocused(): { name: string; value: string } | null {
    const option = this.options.find(o => o.focused);
    if (!option) return null;
    return { name: option.name, value: option.value as string };
  }
}

/**
 * Autocomplete interaction
 */
export class AutocompleteInteraction extends Interaction {
  /** Command name */
  public readonly commandName: string;
  
  /** Command options */
  public readonly options: CommandInteractionOptions;

  constructor(client: Client, data: APIInteraction) {
    super(client, data);
    this.commandName = data.data?.name || '';
    this.options = new CommandInteractionOptions(data.data?.options || []);
  }

  /**
   * Respond with autocomplete choices
   */
  async respond(choices: AutocompleteChoice[]): Promise<void> {
    await this.client.rest.createInteractionResponse(this.id, this.token, {
      type: InteractionResponseType.ApplicationCommandAutocompleteResult,
      data: { choices }
    });
  }
}

/**
 * Button interaction
 */
export class ButtonInteraction extends Interaction {
  /** Button custom ID */
  public readonly customId: string;
  
  /** Component type (always 2 for buttons) */
  public readonly componentType: number = 2;
  
  /** Message the button is attached to */
  public readonly message?: any;

  constructor(client: Client, data: APIInteraction) {
    super(client, data);
    this.customId = data.data?.custom_id || '';
    this.message = data.message;
  }

  /**
   * Update the message the button is attached to
   */
  async update(options: InteractionReplyOptions): Promise<void> {
    await this.client.rest.createInteractionResponse(this.id, this.token, {
      type: InteractionResponseType.UpdateMessage,
      data: {
        content: options.content,
        embeds: options.embeds,
        components: options.components
      }
    });
    this.replied = true;
  }
}

/**
 * Select menu interaction
 */
export class SelectMenuInteraction extends Interaction {
  /** Select menu custom ID */
  public readonly customId: string;
  
  /** Component type (always 3 for select menus) */
  public readonly componentType: number = 3;
  
  /** Selected values */
  public readonly values: string[];
  
  /** Message the select menu is attached to */
  public readonly message?: any;

  constructor(client: Client, data: APIInteraction) {
    super(client, data);
    this.customId = data.data?.custom_id || '';
    this.values = data.data?.values || [];
    this.message = data.message;
  }

  /**
   * Update the message the select menu is attached to
   */
  async update(options: InteractionReplyOptions): Promise<void> {
    await this.client.rest.createInteractionResponse(this.id, this.token, {
      type: InteractionResponseType.UpdateMessage,
      data: {
        content: options.content,
        embeds: options.embeds,
        components: options.components
      }
    });
    this.replied = true;
  }
}

/**
 * Modal submit interaction
 */
export class ModalSubmitInteraction extends Interaction {
  /** Modal custom ID */
  public readonly customId: string;
  
  /** Modal fields */
  public readonly fields: ModalFields;

  constructor(client: Client, data: APIInteraction) {
    super(client, data);
    this.customId = data.data?.custom_id || '';
    this.fields = new ModalFields(data.data?.values || []);
  }
}

/**
 * Modal fields helper
 */
export class ModalFields {
  private values: string[];

  constructor(values: string[]) {
    this.values = values;
  }

  /**
   * Get a text input value
   */
  getTextInputValue(customId: string): string | null {
    // Modal values are typically parsed from components
    // This is a simplified implementation
    return null;
  }
}

// Types
export interface InteractionReplyOptions {
  content?: string;
  embeds?: APIEmbed[];
  components?: any[];
  ephemeral?: boolean;
  files?: Array<{ name: string; data: Buffer; contentType?: string }>;
}

export interface AutocompleteChoice {
  name: string;
  value: string | number;
}

export interface ModalData {
  custom_id: string;
  title: string;
  components: any[];
}

/**
 * Create appropriate interaction class based on type
 */
export function createInteraction(client: Client, data: APIInteraction): Interaction {
  switch (data.type) {
    case InteractionType.ApplicationCommand:
      return new CommandInteraction(client, data);
    case InteractionType.ApplicationCommandAutocomplete:
      return new AutocompleteInteraction(client, data);
    case InteractionType.ModalSubmit:
      return new ModalSubmitInteraction(client, data);
    case InteractionType.MessageComponent:
      // component_type: 2 = Button, 3 = Select Menu
      if (data.data?.component_type === 2) {
        return new ButtonInteraction(client, data);
      } else if (data.data?.component_type === 3) {
        return new SelectMenuInteraction(client, data);
      }
      return new Interaction(client, data);
    default:
      return new Interaction(client, data);
  }
}
