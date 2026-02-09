import { APIInteraction, APIInteractionOption, APIEmbed } from '../types';
import { InteractionType } from '../enums';
import { User } from './User';
import { GuildMember } from './GuildMember';
import { EmbedBuilder } from '../builders/EmbedBuilder';
import type { Client } from '../Client';
/**
 * Base interaction class
 */
export declare class Interaction {
    /** Reference to the client */
    readonly client: Client;
    /** Interaction ID */
    readonly id: string;
    /** Application ID */
    readonly applicationId: string;
    /** Interaction type */
    readonly type: InteractionType;
    /** Guild ID */
    readonly guildId?: string;
    /** Channel ID */
    readonly channelId?: string;
    /** Interaction token */
    readonly token: string;
    /** User who triggered the interaction */
    readonly user: User;
    /** Guild member (if in a guild) */
    readonly member?: GuildMember;
    /** Whether the interaction has been replied to */
    replied: boolean;
    /** Whether the interaction has been deferred */
    deferred: boolean;
    constructor(client: Client, data: APIInteraction);
    /**
     * Check if this is a command interaction
     */
    isCommand(): this is CommandInteraction;
    /**
     * Check if this is an autocomplete interaction
     */
    isAutocomplete(): this is AutocompleteInteraction;
    /**
     * Check if this is a modal submit interaction
     */
    isModalSubmit(): this is ModalSubmitInteraction;
    /**
     * Check if this is a button interaction
     */
    isButton(): this is ButtonInteraction;
    /**
     * Check if this is a select menu interaction
     */
    isSelectMenu(): this is SelectMenuInteraction;
    /**
     * Reply to the interaction
     */
    reply(options: string | InteractionReplyOptions): Promise<void>;
    /**
     * Defer the reply (shows "thinking...")
     */
    deferReply(options?: {
        ephemeral?: boolean;
    }): Promise<void>;
    /**
     * Edit the reply
     */
    editReply(options: string | InteractionReplyOptions): Promise<void>;
    /**
     * Delete the reply
     */
    deleteReply(): Promise<void>;
    /**
     * Send a followup message
     */
    followUp(options: string | InteractionReplyOptions): Promise<void>;
}
/**
 * Command interaction
 */
export declare class CommandInteraction extends Interaction {
    /** Command name */
    readonly commandName: string;
    /** Command options */
    readonly options: CommandInteractionOptions;
    constructor(client: Client, data: APIInteraction);
    /**
     * Show a modal
     */
    showModal(modal: ModalData): Promise<void>;
}
/**
 * Command interaction options helper
 */
export declare class CommandInteractionOptions {
    private options;
    constructor(options: APIInteractionOption[]);
    /**
     * Get a string option
     */
    getString(name: string, required?: boolean): string | null;
    /**
     * Get an integer option
     */
    getInteger(name: string, required?: boolean): number | null;
    /**
     * Get a number option
     */
    getNumber(name: string, required?: boolean): number | null;
    /**
     * Get a boolean option
     */
    getBoolean(name: string, required?: boolean): boolean | null;
    /**
     * Get a user option
     */
    getUser(name: string, required?: boolean): string | null;
    /**
     * Get a channel option
     */
    getChannel(name: string, required?: boolean): string | null;
    /**
     * Get a subcommand name
     */
    getSubcommand(required?: boolean): string | null;
    /**
     * Get the focused option (for autocomplete)
     */
    getFocused(): {
        name: string;
        value: string;
    } | null;
}
/**
 * Autocomplete interaction
 */
export declare class AutocompleteInteraction extends Interaction {
    /** Command name */
    readonly commandName: string;
    /** Command options */
    readonly options: CommandInteractionOptions;
    constructor(client: Client, data: APIInteraction);
    /**
     * Respond with autocomplete choices
     */
    respond(choices: AutocompleteChoice[]): Promise<void>;
}
/**
 * Button interaction
 */
export declare class ButtonInteraction extends Interaction {
    /** Button custom ID */
    readonly customId: string;
    /** Component type (always 2 for buttons) */
    readonly componentType: number;
    /** Message the button is attached to */
    readonly message?: any;
    constructor(client: Client, data: APIInteraction);
    /**
     * Update the message the button is attached to
     */
    update(options: InteractionReplyOptions): Promise<void>;
}
/**
 * Select menu interaction
 */
export declare class SelectMenuInteraction extends Interaction {
    /** Select menu custom ID */
    readonly customId: string;
    /** Component type (always 3 for select menus) */
    readonly componentType: number;
    /** Selected values */
    readonly values: string[];
    /** Message the select menu is attached to */
    readonly message?: any;
    constructor(client: Client, data: APIInteraction);
    /**
     * Update the message the select menu is attached to
     */
    update(options: InteractionReplyOptions): Promise<void>;
}
/**
 * Modal submit interaction
 */
export declare class ModalSubmitInteraction extends Interaction {
    /** Modal custom ID */
    readonly customId: string;
    /** Modal fields */
    readonly fields: ModalFields;
    constructor(client: Client, data: APIInteraction);
}
/**
 * Modal fields helper
 */
export declare class ModalFields {
    private values;
    constructor(values: string[]);
    /**
     * Get a text input value
     */
    getTextInputValue(customId: string): string | null;
}
export interface InteractionReplyOptions {
    content?: string;
    embeds?: (APIEmbed | EmbedBuilder)[];
    components?: any[];
    ephemeral?: boolean;
    files?: Array<{
        name: string;
        data: Buffer;
        contentType?: string;
    }>;
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
export declare function createInteraction(client: Client, data: APIInteraction): Interaction;
