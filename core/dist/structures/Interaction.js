"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModalFields = exports.ModalSubmitInteraction = exports.SelectMenuInteraction = exports.ButtonInteraction = exports.AutocompleteInteraction = exports.CommandInteractionOptions = exports.CommandInteraction = exports.Interaction = void 0;
exports.createInteraction = createInteraction;
const enums_1 = require("../enums");
const User_1 = require("./User");
const GuildMember_1 = require("./GuildMember");
const Collection_1 = require("./Collection");
const EmbedBuilder_1 = require("../builders/EmbedBuilder");
const Message_1 = require("./Message");
const serialize_1 = require("../utils/serialize");
/**
 * Base interaction class
 */
class Interaction {
    /** Reference to the client */
    client;
    /** Interaction ID */
    id;
    /** Application ID */
    applicationId;
    /** Interaction type */
    type;
    /** Guild ID */
    guildId;
    /** Channel ID */
    channelId;
    /** Interaction token */
    token;
    /** User who triggered the interaction */
    user;
    /** Guild member (if in a guild) */
    member;
    /** Whether the interaction has been replied to */
    replied = false;
    /** Whether the interaction has been deferred */
    deferred = false;
    constructor(client, data) {
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
        this.user = userData ? new User_1.User(userData, client) : new User_1.User({ id: '0', username: 'Unknown' }, client);
        // Create member if in guild
        if (data.member && this.guildId) {
            const guild = client.guilds.get(this.guildId);
            if (guild) {
                this.member = new GuildMember_1.GuildMember(client, guild, data.member);
                // If backend didn't send voice state, try to fill from cache
                if (!data.member.voice?.channel_id) {
                    const cachedMember = guild.members.get(this.member.id);
                    if (cachedMember?.voice?.channelId) {
                        this.member.voice = { ...cachedMember.voice };
                    }
                }
            }
            else {
                // Guild not in cache — create member with a minimal guild stub
                const stubGuild = { id: this.guildId, ownerId: null, members: new Collection_1.Collection(), channels: new Collection_1.Collection() };
                this.member = new GuildMember_1.GuildMember(client, stubGuild, data.member);
            }
        }
    }
    /**
     * The guild this interaction was sent in (if in a guild)
     * Discord.js compatible: interaction.guild
     */
    get guild() {
        if (!this.guildId)
            return null;
        return this.client.guilds.get(this.guildId) ?? null;
    }
    /**
     * Check if this is a command interaction
     */
    isCommand() {
        return this.type === enums_1.InteractionType.ApplicationCommand;
    }
    /**
     * Check if this is an autocomplete interaction
     */
    isAutocomplete() {
        return this.type === enums_1.InteractionType.ApplicationCommandAutocomplete;
    }
    /**
     * Check if this is a modal submit interaction
     */
    isModalSubmit() {
        return this.type === enums_1.InteractionType.ModalSubmit;
    }
    /**
     * Check if this is a button interaction
     */
    isButton() {
        return this.type === enums_1.InteractionType.MessageComponent && this.componentType === 2;
    }
    /**
     * Check if this is a select menu interaction
     */
    isSelectMenu() {
        return this.type === enums_1.InteractionType.MessageComponent && this.componentType === 3;
    }
    /**
     * Alias for isSelectMenu (Discord.js compatibility)
     */
    isStringSelectMenu() {
        return this.isSelectMenu();
    }
    /**
     * Reply to the interaction
     */
    async reply(options) {
        if (this.replied || this.deferred) {
            throw new Error('Interaction has already been replied to or deferred');
        }
        const content = typeof options === 'string' ? options : options.content;
        const rawEmbeds = typeof options === 'string' ? undefined : options.embeds;
        const rawComponents = typeof options === 'string' ? undefined : options.components;
        const ephemeral = typeof options === 'string' ? false : options.ephemeral;
        // Convert EmbedBuilder instances to plain objects
        const embeds = rawEmbeds?.map(e => e instanceof EmbedBuilder_1.EmbedBuilder ? e.toJSON() : e);
        // Convert ActionRowBuilder/ButtonBuilder instances to plain objects
        const components = (0, serialize_1.serializeComponents)(rawComponents);
        await this.client.rest.createInteractionResponse(this.id, this.token, {
            type: enums_1.InteractionResponseType.ChannelMessageWithSource,
            data: {
                content,
                embeds,
                components,
                flags: ephemeral ? enums_1.MessageFlags.Ephemeral : 0
            }
        });
        this.replied = true;
    }
    /**
     * Defer the reply (shows "thinking...")
     */
    async deferReply(options) {
        if (this.replied || this.deferred) {
            throw new Error('Interaction has already been replied to or deferred');
        }
        await this.client.rest.createInteractionResponse(this.id, this.token, {
            type: enums_1.InteractionResponseType.DeferredChannelMessageWithSource,
            data: options?.ephemeral ? { flags: enums_1.MessageFlags.Ephemeral } : undefined
        });
        this.deferred = true;
    }
    /**
     * Edit the reply
     */
    async editReply(options) {
        const content = typeof options === 'string' ? options : options.content;
        const rawEmbeds = typeof options === 'string' ? undefined : options.embeds;
        const rawComponents = typeof options === 'string' ? undefined : options.components;
        const files = typeof options === 'string' ? undefined : options.files;
        // Convert EmbedBuilder instances to plain objects
        const embeds = rawEmbeds?.map(e => e instanceof EmbedBuilder_1.EmbedBuilder ? e.toJSON() : e);
        // Convert ActionRowBuilder/ButtonBuilder instances to plain objects
        const components = (0, serialize_1.serializeComponents)(rawComponents);
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
    async deleteReply() {
        await this.client.rest.deleteInteractionResponse(this.token);
    }
    /**
     * Send a followup message
     */
    async followUp(options) {
        const content = typeof options === 'string' ? options : options.content;
        const rawEmbeds = typeof options === 'string' ? undefined : options.embeds;
        const rawComponents = typeof options === 'string' ? undefined : options.components;
        const ephemeral = typeof options === 'string' ? false : options.ephemeral;
        const files = typeof options === 'string' ? undefined : options.files;
        // Convert EmbedBuilder instances to plain objects
        const embeds = rawEmbeds?.map(e => e instanceof EmbedBuilder_1.EmbedBuilder ? e.toJSON() : e);
        // Convert component builder instances to plain objects
        const components = rawComponents?.map((c) => typeof c.toJSON === 'function' ? c.toJSON() : c);
        await this.client.rest.createFollowup(this.token, {
            content,
            embeds,
            components,
            flags: ephemeral ? enums_1.MessageFlags.Ephemeral : 0,
            files
        });
    }
}
exports.Interaction = Interaction;
/**
 * Command interaction
 */
class CommandInteraction extends Interaction {
    /** Command name */
    commandName;
    /** Command options */
    options;
    constructor(client, data) {
        super(client, data);
        this.commandName = data.data?.name || '';
        this.options = new CommandInteractionOptions(client, data.data?.options || [], data.data?.resolved);
    }
    /**
     * Show a modal
     */
    async showModal(modal) {
        const modalData = 'toJSON' in modal && typeof modal.toJSON === 'function' ? modal.toJSON() : modal;
        await this.client.rest.createInteractionResponse(this.id, this.token, {
            type: enums_1.InteractionResponseType.Modal,
            data: modalData
        });
    }
}
exports.CommandInteraction = CommandInteraction;
/**
 * Command interaction options helper
 */
class CommandInteractionOptions {
    client;
    options;
    resolved;
    constructor(client, options, resolved) {
        this.client = client;
        this.options = options;
        this.resolved = resolved;
    }
    /**
     * Get a string option value.
     *
     * **Warning:** Returns raw user input without any sanitization.
     * The caller is responsible for validating and safely handling this value
     * before using it in database queries, shell commands, or other sensitive contexts.
     *
     * @param name - The name of the option to retrieve
     * @param required - If true, throws an error when the option is not found
     * @returns The raw string value, or null if not found (and not required)
     */
    getString(name, required) {
        const option = this.options.find(o => o.name === name);
        if (!option && required)
            throw new Error(`Required option "${name}" not found`);
        return option?.value ?? null;
    }
    /**
     * Get an integer option
     */
    getInteger(name, required) {
        const option = this.options.find(o => o.name === name);
        if (!option && required)
            throw new Error(`Required option "${name}" not found`);
        return option?.value || null;
    }
    /**
     * Get a number option
     */
    getNumber(name, required) {
        return this.getInteger(name, required);
    }
    /**
     * Get a boolean option
     */
    getBoolean(name, required) {
        const option = this.options.find(o => o.name === name);
        if (!option && required)
            throw new Error(`Required option "${name}" not found`);
        return option?.value ?? null;
    }
    /**
     * Get a user option — returns resolved User object if available
     * Falls back to parsing mention format (<@ID>) and resolving from resolved data
     */
    getUser(name, required) {
        const option = this.options.find(o => o.name === name);
        if (!option && required)
            throw new Error(`Required option "${name}" not found`);
        if (!option)
            return null;
        const rawValue = String(option.value || '');
        // Extract user ID — could be "123", "<@123>", or "<@!123>"
        const match = rawValue.match(/^<?@?!?(\d+)>?$/);
        const userId = match ? match[1] : rawValue;
        // Try to resolve from resolved data
        if (this.resolved?.users && this.resolved.users[userId]) {
            return new User_1.User(this.resolved.users[userId], this.client);
        }
        // Fallback: return a minimal User with just the ID
        if (userId && /^\d+$/.test(userId)) {
            return new User_1.User({ id: userId, username: `User_${userId}` }, this.client);
        }
        return null;
    }
    /**
     * Get raw user ID from a user option (for cases where only the ID is needed)
     */
    getUserId(name, required) {
        const option = this.options.find(o => o.name === name);
        if (!option && required)
            throw new Error(`Required option "${name}" not found`);
        if (!option)
            return null;
        const rawValue = String(option.value || '');
        const match = rawValue.match(/^<?@?!?(\d+)>?$/);
        return match ? match[1] : rawValue;
    }
    /**
     * Get a channel option
     */
    getChannel(name, required) {
        const option = this.options.find(o => o.name === name);
        if (!option && required)
            throw new Error(`Required option "${name}" not found`);
        return option?.value || null;
    }
    /**
     * Get a subcommand name
     */
    getSubcommand(required) {
        const option = this.options.find(o => o.type === 1);
        if (!option && required)
            throw new Error('Required subcommand not found');
        return option?.name || null;
    }
    /**
     * Get the focused option (for autocomplete)
     */
    getFocused() {
        const option = this.options.find(o => o.focused);
        if (!option)
            return null;
        return { name: option.name, value: option.value };
    }
}
exports.CommandInteractionOptions = CommandInteractionOptions;
/**
 * Autocomplete interaction
 */
class AutocompleteInteraction extends Interaction {
    /** Command name */
    commandName;
    /** Command options */
    options;
    constructor(client, data) {
        super(client, data);
        this.commandName = data.data?.name || '';
        this.options = new CommandInteractionOptions(client, data.data?.options || [], data.data?.resolved);
    }
    /**
     * Respond with autocomplete choices
     */
    async respond(choices) {
        await this.client.rest.createInteractionResponse(this.id, this.token, {
            type: enums_1.InteractionResponseType.ApplicationCommandAutocompleteResult,
            data: { choices }
        });
    }
}
exports.AutocompleteInteraction = AutocompleteInteraction;
/**
 * Button interaction
 */
class ButtonInteraction extends Interaction {
    /** Button custom ID */
    customId;
    /** Component type (always 2 for buttons) */
    componentType = 2;
    /** Message the button is attached to */
    message;
    constructor(client, data) {
        super(client, data);
        this.customId = data.data?.custom_id || '';
        // ponytail: wrap in Message structure so .delete()/.edit() work
        // Inject guild_id from interaction since backend sends minimal message payload
        if (data.message) {
            const messageData = { ...data.message, guild_id: data.guild_id };
            this.message = new Message_1.Message(client, messageData);
        }
    }
    /**
     * Update the message the button is attached to
     */
    async update(options) {
        // ponytail: Bug #13 fix - string parametre desteği
        const content = typeof options === 'string' ? options : options.content;
        const rawEmbeds = typeof options === 'string' ? undefined : options.embeds;
        const rawComponents = typeof options === 'string' ? undefined : options.components;
        // Convert EmbedBuilder instances to plain objects
        const embeds = rawEmbeds?.map(e => e instanceof EmbedBuilder_1.EmbedBuilder ? e.toJSON() : e);
        // Convert ActionRowBuilder/ButtonBuilder instances to plain objects
        const components = (0, serialize_1.serializeComponents)(rawComponents);
        await this.client.rest.createInteractionResponse(this.id, this.token, {
            type: enums_1.InteractionResponseType.UpdateMessage,
            data: {
                content,
                embeds,
                components
            }
        });
        this.replied = true;
    }
    /**
     * Show a modal in response to this button interaction
     */
    async showModal(modal) {
        const modalData = 'toJSON' in modal && typeof modal.toJSON === 'function' ? modal.toJSON() : modal;
        await this.client.rest.createInteractionResponse(this.id, this.token, {
            type: enums_1.InteractionResponseType.Modal,
            data: modalData
        });
    }
}
exports.ButtonInteraction = ButtonInteraction;
/**
 * Select menu interaction
 */
class SelectMenuInteraction extends Interaction {
    /** Select menu custom ID */
    customId;
    /** Component type (always 3 for select menus) */
    componentType = 3;
    /** Selected values */
    values;
    /** Message the select menu is attached to */
    message;
    constructor(client, data) {
        super(client, data);
        this.customId = data.data?.custom_id || '';
        this.values = data.data?.values || [];
        // ponytail: wrap in Message structure so .delete()/.edit() work
        // Inject guild_id from interaction since backend sends minimal message payload
        if (data.message) {
            const messageData = { ...data.message, guild_id: data.guild_id };
            this.message = new Message_1.Message(client, messageData);
        }
    }
    /**
     * Update the message the select menu is attached to
     */
    async update(options) {
        // ponytail: Bug #13 fix - string parametre desteği
        const content = typeof options === 'string' ? options : options.content;
        const rawEmbeds = typeof options === 'string' ? undefined : options.embeds;
        const rawComponents = typeof options === 'string' ? undefined : options.components;
        // Convert EmbedBuilder instances to plain objects
        const embeds = rawEmbeds?.map(e => e instanceof EmbedBuilder_1.EmbedBuilder ? e.toJSON() : e);
        // Convert ActionRowBuilder/ButtonBuilder instances to plain objects
        const components = (0, serialize_1.serializeComponents)(rawComponents);
        await this.client.rest.createInteractionResponse(this.id, this.token, {
            type: enums_1.InteractionResponseType.UpdateMessage,
            data: {
                content,
                embeds,
                components
            }
        });
        this.replied = true;
    }
    /**
     * Show a modal in response to this select menu interaction
     */
    async showModal(modal) {
        const modalData = 'toJSON' in modal && typeof modal.toJSON === 'function' ? modal.toJSON() : modal;
        await this.client.rest.createInteractionResponse(this.id, this.token, {
            type: enums_1.InteractionResponseType.Modal,
            data: modalData
        });
    }
}
exports.SelectMenuInteraction = SelectMenuInteraction;
/**
 * Modal submit interaction
 */
class ModalSubmitInteraction extends Interaction {
    /** Modal custom ID */
    customId;
    /** Modal fields */
    fields;
    constructor(client, data) {
        super(client, data);
        this.customId = data.data?.custom_id || '';
        // Modal values come from components array, or as JSON string in values[0] (backend compat)
        let components = data.data?.components || [];
        if (components.length === 0 && data.data?.values?.length > 0) {
            try {
                const parsed = JSON.parse(data.data.values[0]);
                if (Array.isArray(parsed))
                    components = parsed;
            }
            catch { }
        }
        this.fields = new ModalFields(components);
    }
}
exports.ModalSubmitInteraction = ModalSubmitInteraction;
/**
 * Modal fields helper
 */
class ModalFields {
    fieldMap;
    constructor(components) {
        this.fieldMap = new Map();
        // Parse action rows → text inputs
        for (const row of components) {
            const innerComponents = row?.components || [];
            for (const comp of innerComponents) {
                if (comp.custom_id && comp.value !== undefined) {
                    this.fieldMap.set(comp.custom_id, comp.value);
                }
            }
        }
    }
    /**
     * Get a text input value by custom_id
     */
    getTextInputValue(customId) {
        return this.fieldMap.get(customId) ?? null;
    }
    /**
     * Get a field (alias for getTextInputValue)
     */
    getField(customId) {
        const value = this.fieldMap.get(customId);
        return value !== undefined ? { value } : null;
    }
}
exports.ModalFields = ModalFields;
/**
 * Create appropriate interaction class based on type
 */
function createInteraction(client, data) {
    switch (data.type) {
        case enums_1.InteractionType.ApplicationCommand:
            return new CommandInteraction(client, data);
        case enums_1.InteractionType.ApplicationCommandAutocomplete:
            return new AutocompleteInteraction(client, data);
        case enums_1.InteractionType.ModalSubmit:
            return new ModalSubmitInteraction(client, data);
        case enums_1.InteractionType.MessageComponent:
            // component_type: 2 = Button, 3 = Select Menu
            if (data.data?.component_type === 2) {
                return new ButtonInteraction(client, data);
            }
            else if (data.data?.component_type === 3) {
                return new SelectMenuInteraction(client, data);
            }
            return new Interaction(client, data);
        default:
            return new Interaction(client, data);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSW50ZXJhY3Rpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvc3RydWN0dXJlcy9JbnRlcmFjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFrbkJBLDhDQW1CQztBQXBvQkQsb0NBQWtGO0FBQ2xGLGlDQUE4QjtBQUM5QiwrQ0FBNEM7QUFDNUMsNkNBQTBDO0FBQzFDLDJEQUF3RDtBQUN4RCx1Q0FBb0M7QUFFcEMsa0RBQXlEO0FBRXpEOztHQUVHO0FBQ0gsTUFBYSxXQUFXO0lBQ3RCLDhCQUE4QjtJQUNkLE1BQU0sQ0FBUztJQUUvQixxQkFBcUI7SUFDTCxFQUFFLENBQVM7SUFFM0IscUJBQXFCO0lBQ0wsYUFBYSxDQUFTO0lBRXRDLHVCQUF1QjtJQUNQLElBQUksQ0FBa0I7SUFFdEMsZUFBZTtJQUNDLE9BQU8sQ0FBVTtJQUVqQyxpQkFBaUI7SUFDRCxTQUFTLENBQVU7SUFFbkMsd0JBQXdCO0lBQ1IsS0FBSyxDQUFTO0lBRTlCLHlDQUF5QztJQUN6QixJQUFJLENBQU87SUFFM0IsbUNBQW1DO0lBQ25CLE1BQU0sQ0FBZTtJQUVyQyxrREFBa0Q7SUFDM0MsT0FBTyxHQUFHLEtBQUssQ0FBQztJQUV2QixnREFBZ0Q7SUFDekMsUUFBUSxHQUFHLEtBQUssQ0FBQztJQUV4QixZQUFZLE1BQWMsRUFBRSxJQUFvQjtRQUM5QyxJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztRQUNyQixvQ0FBb0M7UUFDcEMsSUFBSSxDQUFDLEVBQUUsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQzFCLElBQUksQ0FBQyxhQUFhLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUNqRCxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7UUFDdEIsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxNQUFNLENB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R0FFRztBQUNILFNBQWdCLGlCQUFpQixDQUFDLE1BQWMsRUFBRSxJQUFvQjtJQUNwRSxRQUFRLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNsQixLQUFLLHVCQUFlLENBQUMsa0JBQWtCO1lBQ3JDLE9BQU8sSUFBSSxrQkFBa0IsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDOUMsS0FBSyx1QkFBZSxDQUFDLDhCQUE4QjtZQUNqRCxPQUFPLElBQUksdUJBQXVCLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ25ELEtBQUssdUJBQWUsQ0FBQyxXQUFXO1lBQzlCLE9BQU8sSUFBSSxzQkFBc0IsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDbEQsS0FBSyx1QkFBZSxDQUFDLGdCQUFnQjtZQUNuQyw4Q0FBOEM7WUFDOUMsSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFLGNBQWMsS0FBSyxDQUFDLEVBQUUsQ0FBQztnQkFDcEMsT0FBTyxJQUFJLGlCQUFpQixDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztZQUM3QyxDQUFDO2lCQUFNLElBQUksSUFBSSxDQUFDLElBQUksRUFBRSxjQUFjLEtBQUssQ0FBQyxFQUFFLENBQUM7Z0JBQzNDLE9BQU8sSUFBSSxxQkFBcUIsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDakQsQ0FBQztZQUNELE9BQU8sSUFBSSxXQUFXLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ3ZDO1lBQ0UsT0FBTyxJQUFJLFdBQVcsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDekMsQ0FBQztBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBUElJbnRlcmFjdGlvbiwgQVBJSW50ZXJhY3Rpb25PcHRpb24sIEFQSUludGVyYWN0aW9uUmVzb2x2ZWQsIEFQSUVtYmVkIH0gZnJvbSAnLi4vdHlwZXMnO1xyXG5pbXBvcnQgeyBJbnRlcmFjdGlvblR5cGUsIEludGVyYWN0aW9uUmVzcG9uc2VUeXBlLCBNZXNzYWdlRmxhZ3MgfSBmcm9tICcuLi9lbnVtcyc7XHJcbmltcG9ydCB7IFVzZXIgfSBmcm9tICcuL1VzZXInO1xyXG5pbXBvcnQgeyBHdWlsZE1lbWJlciB9IGZyb20gJy4vR3VpbGRNZW1iZXInO1xyXG5pbXBvcnQgeyBDb2xsZWN0aW9uIH0gZnJvbSAnLi9Db2xsZWN0aW9uJztcclxuaW1wb3J0IHsgRW1iZWRCdWlsZGVyIH0gZnJvbSAnLi4vYnVpbGRlcnMvRW1iZWRCdWlsZGVyJztcclxuaW1wb3J0IHsgTWVzc2FnZSB9IGZyb20gJy4vTWVzc2FnZSc7XHJcbmltcG9ydCB0eXBlIHsgQ2xpZW50IH0gZnJvbSAnLi4vQ2xpZW50JztcclxuaW1wb3J0IHsgc2VyaWFsaXplQ29tcG9uZW50cyB9IGZyb20gJy4uL3V0aWxzL3NlcmlhbGl6ZSc7XHJcblxyXG4vKipcclxuICogQmFzZSBpbnRlcmFjdGlvbiBjbGFzc1xyXG4gKi9cclxuZXhwb3J0IGNsYXNzIEludGVyYWN0aW9uIHtcclxuICAvKiogUmVmZXJlbmNlIHRvIHRoZSBjbGllbnQgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgY2xpZW50OiBDbGllbnQ7XHJcbiAgXHJcbiAgLyoqIEludGVyYWN0aW9uIElEICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGlkOiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIEFwcGxpY2F0aW9uIElEICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGFwcGxpY2F0aW9uSWQ6IHN0cmluZztcclxuICBcclxuICAvKiogSW50ZXJhY3Rpb24gdHlwZSAqL1xyXG4gIHB1YmxpYyByZWFkb25seSB0eXBlOiBJbnRlcmFjdGlvblR5cGU7XHJcbiAgXHJcbiAgLyoqIEd1aWxkIElEICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGd1aWxkSWQ/OiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIENoYW5uZWwgSUQgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgY2hhbm5lbElkPzogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBJbnRlcmFjdGlvbiB0b2tlbiAqL1xyXG4gIHB1YmxpYyByZWFkb25seSB0b2tlbjogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBVc2VyIHdobyB0cmlnZ2VyZWQgdGhlIGludGVyYWN0aW9uICovXHJcbiAgcHVibGljIHJlYWRvbmx5IHVzZXI6IFVzZXI7XHJcbiAgXHJcbiAgLyoqIEd1aWxkIG1lbWJlciAoaWYgaW4gYSBndWlsZCkgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgbWVtYmVyPzogR3VpbGRNZW1iZXI7XHJcbiAgXHJcbiAgLyoqIFdoZXRoZXIgdGhlIGludGVyYWN0aW9uIGhhcyBiZWVuIHJlcGxpZWQgdG8gKi9cclxuICBwdWJsaWMgcmVwbGllZCA9IGZhbHNlO1xyXG4gIFxyXG4gIC8qKiBXaGV0aGVyIHRoZSBpbnRlcmFjdGlvbiBoYXMgYmVlbiBkZWZlcnJlZCAqL1xyXG4gIHB1YmxpYyBkZWZlcnJlZCA9IGZhbHNlO1xyXG5cclxuICBjb25zdHJ1Y3RvcihjbGllbnQ6IENsaWVudCwgZGF0YTogQVBJSW50ZXJhY3Rpb24pIHtcclxuICAgIHRoaXMuY2xpZW50ID0gY2xpZW50O1xyXG4gICAgLy8gSGFuZGxlIGJvdGggc3RyaW5nIGFuZCBudW1iZXIgSURzXHJcbiAgICB0aGlzLmlkID0gU3RyaW5nKGRhdGEuaWQpO1xyXG4gICAgdGhpcy5hcHBsaWNhdGlvbklkID0gU3RyaW5nKGRhdGEuYXBwbGljYXRpb25faWQpO1xyXG4gICAgdGhpcy50eXBlID0gZGF0YS50eXBlO1xyXG4gICAgdGhpcy5ndWlsZElkID0gZGF0YS5ndWlsZF9pZCA/IFN0cmluZyhkYXRhLmd1aWxkX2lkKSA6IHVuZGVmaW5lZDtcclxuICAgIHRoaXMuY2hhbm5lbElkID0gZGF0YS5jaGFubmVsX2lkID8gU3RyaW5nKGRhdGEuY2hhbm5lbF9pZCkgOiB1bmRlZmluZWQ7XHJcbiAgICB0aGlzLnRva2VuID0gZGF0YS50b2tlbjtcclxuICAgIFxyXG4gICAgLy8gVXNlciBjYW4gY29tZSBmcm9tIG1lbWJlci51c2VyIG9yIGRpcmVjdGx5IGZyb20gdXNlclxyXG4gICAgY29uc3QgdXNlckRhdGEgPSBkYXRhLm1lbWJlcj8udXNlciB8fCBkYXRhLnVzZXI7XHJcbiAgICB0aGlzLnVzZXIgPSB1c2VyRGF0YSA/IG5ldyBVc2VyKHVzZXJEYXRhLCBjbGllbnQpIDogbmV3IFVzZXIoeyBpZDogJzAnLCB1c2VybmFtZTogJ1Vua25vd24nIH0sIGNsaWVudCk7XHJcbiAgICBcclxuICAgIC8vIENyZWF0ZSBtZW1iZXIgaWYgaW4gZ3VpbGRcclxuICAgIGlmIChkYXRhLm1lbWJlciAmJiB0aGlzLmd1aWxkSWQpIHtcclxuICAgICAgY29uc3QgZ3VpbGQgPSBjbGllbnQuZ3VpbGRzLmdldCh0aGlzLmd1aWxkSWQpO1xyXG4gICAgICBpZiAoZ3VpbGQpIHtcclxuICAgICAgICB0aGlzLm1lbWJlciA9IG5ldyBHdWlsZE1lbWJlcihjbGllbnQsIGd1aWxkLCBkYXRhLm1lbWJlcik7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gSWYgYmFja2VuZCBkaWRuJ3Qgc2VuZCB2b2ljZSBzdGF0ZSwgdHJ5IHRvIGZpbGwgZnJvbSBjYWNoZVxyXG4gICAgICAgIGlmICghZGF0YS5tZW1iZXIudm9pY2U/LmNoYW5uZWxfaWQpIHtcclxuICAgICAgICAgIGNvbnN0IGNhY2hlZE1lbWJlciA9IGd1aWxkLm1lbWJlcnMuZ2V0KHRoaXMubWVtYmVyLmlkKTtcclxuICAgICAgICAgIGlmIChjYWNoZWRNZW1iZXI/LnZvaWNlPy5jaGFubmVsSWQpIHtcclxuICAgICAgICAgICAgdGhpcy5tZW1iZXIudm9pY2UgPSB7IC4uLmNhY2hlZE1lbWJlci52b2ljZSB9O1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICAvLyBHdWlsZCBub3QgaW4gY2FjaGUg4oCUIGNyZWF0ZSBtZW1iZXIgd2l0aCBhIG1pbmltYWwgZ3VpbGQgc3R1YlxyXG4gICAgICAgIGNvbnN0IHN0dWJHdWlsZCA9IHsgaWQ6IHRoaXMuZ3VpbGRJZCwgb3duZXJJZDogbnVsbCwgbWVtYmVyczogbmV3IENvbGxlY3Rpb24oKSwgY2hhbm5lbHM6IG5ldyBDb2xsZWN0aW9uKCkgfSBhcyBhbnk7XHJcbiAgICAgICAgdGhpcy5tZW1iZXIgPSBuZXcgR3VpbGRNZW1iZXIoY2xpZW50LCBzdHViR3VpbGQsIGRhdGEubWVtYmVyKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVGhlIGd1aWxkIHRoaXMgaW50ZXJhY3Rpb24gd2FzIHNlbnQgaW4gKGlmIGluIGEgZ3VpbGQpXHJcbiAgICogRGlzY29yZC5qcyBjb21wYXRpYmxlOiBpbnRlcmFjdGlvbi5ndWlsZFxyXG4gICAqL1xyXG4gIGdldCBndWlsZCgpIHtcclxuICAgIGlmICghdGhpcy5ndWlsZElkKSByZXR1cm4gbnVsbDtcclxuICAgIHJldHVybiB0aGlzLmNsaWVudC5ndWlsZHMuZ2V0KHRoaXMuZ3VpbGRJZCkgPz8gbnVsbDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENoZWNrIGlmIHRoaXMgaXMgYSBjb21tYW5kIGludGVyYWN0aW9uXHJcbiAgICovXHJcbiAgaXNDb21tYW5kKCk6IHRoaXMgaXMgQ29tbWFuZEludGVyYWN0aW9uIHtcclxuICAgIHJldHVybiB0aGlzLnR5cGUgPT09IEludGVyYWN0aW9uVHlwZS5BcHBsaWNhdGlvbkNvbW1hbmQ7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDaGVjayBpZiB0aGlzIGlzIGFuIGF1dG9jb21wbGV0ZSBpbnRlcmFjdGlvblxyXG4gICAqL1xyXG4gIGlzQXV0b2NvbXBsZXRlKCk6IHRoaXMgaXMgQXV0b2NvbXBsZXRlSW50ZXJhY3Rpb24ge1xyXG4gICAgcmV0dXJuIHRoaXMudHlwZSA9PT0gSW50ZXJhY3Rpb25UeXBlLkFwcGxpY2F0aW9uQ29tbWFuZEF1dG9jb21wbGV0ZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENoZWNrIGlmIHRoaXMgaXMgYSBtb2RhbCBzdWJtaXQgaW50ZXJhY3Rpb25cclxuICAgKi9cclxuICBpc01vZGFsU3VibWl0KCk6IHRoaXMgaXMgTW9kYWxTdWJtaXRJbnRlcmFjdGlvbiB7XHJcbiAgICByZXR1cm4gdGhpcy50eXBlID09PSBJbnRlcmFjdGlvblR5cGUuTW9kYWxTdWJtaXQ7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDaGVjayBpZiB0aGlzIGlzIGEgYnV0dG9uIGludGVyYWN0aW9uXHJcbiAgICovXHJcbiAgaXNCdXR0b24oKTogdGhpcyBpcyBCdXR0b25JbnRlcmFjdGlvbiB7XHJcbiAgICByZXR1cm4gdGhpcy50eXBlID09PSBJbnRlcmFjdGlvblR5cGUuTWVzc2FnZUNvbXBvbmVudCAmJiAodGhpcyBhcyBhbnkpLmNvbXBvbmVudFR5cGUgPT09IDI7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDaGVjayBpZiB0aGlzIGlzIGEgc2VsZWN0IG1lbnUgaW50ZXJhY3Rpb25cclxuICAgKi9cclxuICBpc1NlbGVjdE1lbnUoKTogdGhpcyBpcyBTZWxlY3RNZW51SW50ZXJhY3Rpb24ge1xyXG4gICAgcmV0dXJuIHRoaXMudHlwZSA9PT0gSW50ZXJhY3Rpb25UeXBlLk1lc3NhZ2VDb21wb25lbnQgJiYgKHRoaXMgYXMgYW55KS5jb21wb25lbnRUeXBlID09PSAzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWxpYXMgZm9yIGlzU2VsZWN0TWVudSAoRGlzY29yZC5qcyBjb21wYXRpYmlsaXR5KVxyXG4gICAqL1xyXG4gIGlzU3RyaW5nU2VsZWN0TWVudSgpOiB0aGlzIGlzIFNlbGVjdE1lbnVJbnRlcmFjdGlvbiB7XHJcbiAgICByZXR1cm4gdGhpcy5pc1NlbGVjdE1lbnUoKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlcGx5IHRvIHRoZSBpbnRlcmFjdGlvblxyXG4gICAqL1xyXG4gIGFzeW5jIHJlcGx5KG9wdGlvbnM6IHN0cmluZyB8IEludGVyYWN0aW9uUmVwbHlPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBpZiAodGhpcy5yZXBsaWVkIHx8IHRoaXMuZGVmZXJyZWQpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnRlcmFjdGlvbiBoYXMgYWxyZWFkeSBiZWVuIHJlcGxpZWQgdG8gb3IgZGVmZXJyZWQnKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgY29uc3QgY29udGVudCA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IG9wdGlvbnMgOiBvcHRpb25zLmNvbnRlbnQ7XHJcbiAgICBjb25zdCByYXdFbWJlZHMgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyB1bmRlZmluZWQgOiBvcHRpb25zLmVtYmVkcztcclxuICAgIGNvbnN0IHJhd0NvbXBvbmVudHMgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyB1bmRlZmluZWQgOiBvcHRpb25zLmNvbXBvbmVudHM7XHJcbiAgICBjb25zdCBlcGhlbWVyYWwgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyBmYWxzZSA6IG9wdGlvbnMuZXBoZW1lcmFsO1xyXG4gICAgXHJcbiAgICAvLyBDb252ZXJ0IEVtYmVkQnVpbGRlciBpbnN0YW5jZXMgdG8gcGxhaW4gb2JqZWN0c1xyXG4gICAgY29uc3QgZW1iZWRzID0gcmF3RW1iZWRzPy5tYXAoZSA9PiBlIGluc3RhbmNlb2YgRW1iZWRCdWlsZGVyID8gZS50b0pTT04oKSA6IGUpO1xyXG4gICAgLy8gQ29udmVydCBBY3Rpb25Sb3dCdWlsZGVyL0J1dHRvbkJ1aWxkZXIgaW5zdGFuY2VzIHRvIHBsYWluIG9iamVjdHNcclxuICAgIGNvbnN0IGNvbXBvbmVudHMgPSBzZXJpYWxpemVDb21wb25lbnRzKHJhd0NvbXBvbmVudHMpO1xyXG4gICAgXHJcbiAgICBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LmNyZWF0ZUludGVyYWN0aW9uUmVzcG9uc2UodGhpcy5pZCwgdGhpcy50b2tlbiwge1xyXG4gICAgICB0eXBlOiBJbnRlcmFjdGlvblJlc3BvbnNlVHlwZS5DaGFubmVsTWVzc2FnZVdpdGhTb3VyY2UsXHJcbiAgICAgIGRhdGE6IHtcclxuICAgICAgICBjb250ZW50LFxyXG4gICAgICAgIGVtYmVkcyxcclxuICAgICAgICBjb21wb25lbnRzLFxyXG4gICAgICAgIGZsYWdzOiBlcGhlbWVyYWwgPyBNZXNzYWdlRmxhZ3MuRXBoZW1lcmFsIDogMFxyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgdGhpcy5yZXBsaWVkID0gdHJ1ZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlZmVyIHRoZSByZXBseSAoc2hvd3MgXCJ0aGlua2luZy4uLlwiKVxyXG4gICAqL1xyXG4gIGFzeW5jIGRlZmVyUmVwbHkob3B0aW9ucz86IHsgZXBoZW1lcmFsPzogYm9vbGVhbiB9KTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBpZiAodGhpcy5yZXBsaWVkIHx8IHRoaXMuZGVmZXJyZWQpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnRlcmFjdGlvbiBoYXMgYWxyZWFkeSBiZWVuIHJlcGxpZWQgdG8gb3IgZGVmZXJyZWQnKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5jcmVhdGVJbnRlcmFjdGlvblJlc3BvbnNlKHRoaXMuaWQsIHRoaXMudG9rZW4sIHtcclxuICAgICAgdHlwZTogSW50ZXJhY3Rpb25SZXNwb25zZVR5cGUuRGVmZXJyZWRDaGFubmVsTWVzc2FnZVdpdGhTb3VyY2UsXHJcbiAgICAgIGRhdGE6IG9wdGlvbnM/LmVwaGVtZXJhbCA/IHsgZmxhZ3M6IE1lc3NhZ2VGbGFncy5FcGhlbWVyYWwgfSA6IHVuZGVmaW5lZFxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIHRoaXMuZGVmZXJyZWQgPSB0cnVlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRWRpdCB0aGUgcmVwbHlcclxuICAgKi9cclxuICBhc3luYyBlZGl0UmVwbHkob3B0aW9uczogc3RyaW5nIHwgSW50ZXJhY3Rpb25SZXBseU9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IGNvbnRlbnQgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyBvcHRpb25zIDogb3B0aW9ucy5jb250ZW50O1xyXG4gICAgY29uc3QgcmF3RW1iZWRzID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gdW5kZWZpbmVkIDogb3B0aW9ucy5lbWJlZHM7XHJcbiAgICBjb25zdCByYXdDb21wb25lbnRzID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gdW5kZWZpbmVkIDogb3B0aW9ucy5jb21wb25lbnRzO1xyXG4gICAgY29uc3QgZmlsZXMgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyB1bmRlZmluZWQgOiBvcHRpb25zLmZpbGVzO1xyXG4gICAgXHJcbiAgICAvLyBDb252ZXJ0IEVtYmVkQnVpbGRlciBpbnN0YW5jZXMgdG8gcGxhaW4gb2JqZWN0c1xyXG4gICAgY29uc3QgZW1iZWRzID0gcmF3RW1iZWRzPy5tYXAoZSA9PiBlIGluc3RhbmNlb2YgRW1iZWRCdWlsZGVyID8gZS50b0pTT04oKSA6IGUpO1xyXG4gICAgLy8gQ29udmVydCBBY3Rpb25Sb3dCdWlsZGVyL0J1dHRvbkJ1aWxkZXIgaW5zdGFuY2VzIHRvIHBsYWluIG9iamVjdHNcclxuICAgIGNvbnN0IGNvbXBvbmVudHMgPSBzZXJpYWxpemVDb21wb25lbnRzKHJhd0NvbXBvbmVudHMpO1xyXG4gICAgXHJcbiAgICBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LmVkaXRJbnRlcmFjdGlvblJlc3BvbnNlKHRoaXMudG9rZW4sIHtcclxuICAgICAgY29udGVudCxcclxuICAgICAgZW1iZWRzLFxyXG4gICAgICBjb21wb25lbnRzLFxyXG4gICAgICBmaWxlc1xyXG4gICAgfSwgdGhpcy5ndWlsZElkLCB0aGlzLmNoYW5uZWxJZCwgdGhpcy5pZCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZWxldGUgdGhlIHJlcGx5XHJcbiAgICovXHJcbiAgYXN5bmMgZGVsZXRlUmVwbHkoKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LmRlbGV0ZUludGVyYWN0aW9uUmVzcG9uc2UodGhpcy50b2tlbik7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZW5kIGEgZm9sbG93dXAgbWVzc2FnZVxyXG4gICAqL1xyXG4gIGFzeW5jIGZvbGxvd1VwKG9wdGlvbnM6IHN0cmluZyB8IEludGVyYWN0aW9uUmVwbHlPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBjb250ZW50ID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gb3B0aW9ucyA6IG9wdGlvbnMuY29udGVudDtcclxuICAgIGNvbnN0IHJhd0VtYmVkcyA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IHVuZGVmaW5lZCA6IG9wdGlvbnMuZW1iZWRzO1xyXG4gICAgY29uc3QgcmF3Q29tcG9uZW50cyA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IHVuZGVmaW5lZCA6IG9wdGlvbnMuY29tcG9uZW50cztcclxuICAgIGNvbnN0IGVwaGVtZXJhbCA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IGZhbHNlIDogb3B0aW9ucy5lcGhlbWVyYWw7XHJcbiAgICBjb25zdCBmaWxlcyA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IHVuZGVmaW5lZCA6IG9wdGlvbnMuZmlsZXM7XHJcbiAgICBcclxuICAgIC8vIENvbnZlcnQgRW1iZWRCdWlsZGVyIGluc3RhbmNlcyB0byBwbGFpbiBvYmplY3RzXHJcbiAgICBjb25zdCBlbWJlZHMgPSByYXdFbWJlZHM/Lm1hcChlID0+IGUgaW5zdGFuY2VvZiBFbWJlZEJ1aWxkZXIgPyBlLnRvSlNPTigpIDogZSk7XHJcbiAgICBcclxuICAgIC8vIENvbnZlcnQgY29tcG9uZW50IGJ1aWxkZXIgaW5zdGFuY2VzIHRvIHBsYWluIG9iamVjdHNcclxuICAgIGNvbnN0IGNvbXBvbmVudHMgPSByYXdDb21wb25lbnRzPy5tYXAoKGM6IGFueSkgPT5cclxuICAgICAgdHlwZW9mIGMudG9KU09OID09PSAnZnVuY3Rpb24nID8gYy50b0pTT04oKSA6IGNcclxuICAgICk7XHJcbiAgICBcclxuICAgIGF3YWl0IHRoaXMuY2xpZW50LnJlc3QuY3JlYXRlRm9sbG93dXAodGhpcy50b2tlbiwge1xyXG4gICAgICBjb250ZW50LFxyXG4gICAgICBlbWJlZHMsXHJcbiAgICAgIGNvbXBvbmVudHMsXHJcbiAgICAgIGZsYWdzOiBlcGhlbWVyYWwgPyBNZXNzYWdlRmxhZ3MuRXBoZW1lcmFsIDogMCxcclxuICAgICAgZmlsZXNcclxuICAgIH0pO1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIENvbW1hbmQgaW50ZXJhY3Rpb25cclxuICovXHJcbmV4cG9ydCBjbGFzcyBDb21tYW5kSW50ZXJhY3Rpb24gZXh0ZW5kcyBJbnRlcmFjdGlvbiB7XHJcbiAgLyoqIENvbW1hbmQgbmFtZSAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBjb21tYW5kTmFtZTogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBDb21tYW5kIG9wdGlvbnMgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgb3B0aW9uczogQ29tbWFuZEludGVyYWN0aW9uT3B0aW9ucztcclxuXHJcbiAgY29uc3RydWN0b3IoY2xpZW50OiBDbGllbnQsIGRhdGE6IEFQSUludGVyYWN0aW9uKSB7XHJcbiAgICBzdXBlcihjbGllbnQsIGRhdGEpO1xyXG4gICAgdGhpcy5jb21tYW5kTmFtZSA9IGRhdGEuZGF0YT8ubmFtZSB8fCAnJztcclxuICAgIHRoaXMub3B0aW9ucyA9IG5ldyBDb21tYW5kSW50ZXJhY3Rpb25PcHRpb25zKGNsaWVudCwgZGF0YS5kYXRhPy5vcHRpb25zIHx8IFtdLCBkYXRhLmRhdGE/LnJlc29sdmVkKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNob3cgYSBtb2RhbFxyXG4gICAqL1xyXG4gIGFzeW5jIHNob3dNb2RhbChtb2RhbDogTW9kYWxEYXRhIHwgeyB0b0pTT04oKTogTW9kYWxEYXRhIH0pOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IG1vZGFsRGF0YSA9ICd0b0pTT04nIGluIG1vZGFsICYmIHR5cGVvZiBtb2RhbC50b0pTT04gPT09ICdmdW5jdGlvbicgPyBtb2RhbC50b0pTT04oKSA6IG1vZGFsO1xyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5jcmVhdGVJbnRlcmFjdGlvblJlc3BvbnNlKHRoaXMuaWQsIHRoaXMudG9rZW4sIHtcclxuICAgICAgdHlwZTogSW50ZXJhY3Rpb25SZXNwb25zZVR5cGUuTW9kYWwsXHJcbiAgICAgIGRhdGE6IG1vZGFsRGF0YVxyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogQ29tbWFuZCBpbnRlcmFjdGlvbiBvcHRpb25zIGhlbHBlclxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIENvbW1hbmRJbnRlcmFjdGlvbk9wdGlvbnMge1xyXG4gIHByaXZhdGUgY2xpZW50OiBDbGllbnQ7XHJcbiAgcHJpdmF0ZSBvcHRpb25zOiBBUElJbnRlcmFjdGlvbk9wdGlvbltdO1xyXG4gIHByaXZhdGUgcmVzb2x2ZWQ/OiBBUElJbnRlcmFjdGlvblJlc29sdmVkO1xyXG5cclxuICBjb25zdHJ1Y3RvcihjbGllbnQ6IENsaWVudCwgb3B0aW9uczogQVBJSW50ZXJhY3Rpb25PcHRpb25bXSwgcmVzb2x2ZWQ/OiBBUElJbnRlcmFjdGlvblJlc29sdmVkKSB7XHJcbiAgICB0aGlzLmNsaWVudCA9IGNsaWVudDtcclxuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XHJcbiAgICB0aGlzLnJlc29sdmVkID0gcmVzb2x2ZWQ7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSBzdHJpbmcgb3B0aW9uIHZhbHVlLlxyXG4gICAqIFxyXG4gICAqICoqV2FybmluZzoqKiBSZXR1cm5zIHJhdyB1c2VyIGlucHV0IHdpdGhvdXQgYW55IHNhbml0aXphdGlvbi5cclxuICAgKiBUaGUgY2FsbGVyIGlzIHJlc3BvbnNpYmxlIGZvciB2YWxpZGF0aW5nIGFuZCBzYWZlbHkgaGFuZGxpbmcgdGhpcyB2YWx1ZVxyXG4gICAqIGJlZm9yZSB1c2luZyBpdCBpbiBkYXRhYmFzZSBxdWVyaWVzLCBzaGVsbCBjb21tYW5kcywgb3Igb3RoZXIgc2Vuc2l0aXZlIGNvbnRleHRzLlxyXG4gICAqIFxyXG4gICAqIEBwYXJhbSBuYW1lIC0gVGhlIG5hbWUgb2YgdGhlIG9wdGlvbiB0byByZXRyaWV2ZVxyXG4gICAqIEBwYXJhbSByZXF1aXJlZCAtIElmIHRydWUsIHRocm93cyBhbiBlcnJvciB3aGVuIHRoZSBvcHRpb24gaXMgbm90IGZvdW5kXHJcbiAgICogQHJldHVybnMgVGhlIHJhdyBzdHJpbmcgdmFsdWUsIG9yIG51bGwgaWYgbm90IGZvdW5kIChhbmQgbm90IHJlcXVpcmVkKVxyXG4gICAqL1xyXG4gIGdldFN0cmluZyhuYW1lOiBzdHJpbmcsIHJlcXVpcmVkPzogYm9vbGVhbik6IHN0cmluZyB8IG51bGwge1xyXG4gICAgY29uc3Qgb3B0aW9uID0gdGhpcy5vcHRpb25zLmZpbmQobyA9PiBvLm5hbWUgPT09IG5hbWUpO1xyXG4gICAgaWYgKCFvcHRpb24gJiYgcmVxdWlyZWQpIHRocm93IG5ldyBFcnJvcihgUmVxdWlyZWQgb3B0aW9uIFwiJHtuYW1lfVwiIG5vdCBmb3VuZGApO1xyXG4gICAgcmV0dXJuIChvcHRpb24/LnZhbHVlIGFzIHN0cmluZykgPz8gbnVsbDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhbiBpbnRlZ2VyIG9wdGlvblxyXG4gICAqL1xyXG4gIGdldEludGVnZXIobmFtZTogc3RyaW5nLCByZXF1aXJlZD86IGJvb2xlYW4pOiBudW1iZXIgfCBudWxsIHtcclxuICAgIGNvbnN0IG9wdGlvbiA9IHRoaXMub3B0aW9ucy5maW5kKG8gPT4gby5uYW1lID09PSBuYW1lKTtcclxuICAgIGlmICghb3B0aW9uICYmIHJlcXVpcmVkKSB0aHJvdyBuZXcgRXJyb3IoYFJlcXVpcmVkIG9wdGlvbiBcIiR7bmFtZX1cIiBub3QgZm91bmRgKTtcclxuICAgIHJldHVybiBvcHRpb24/LnZhbHVlIGFzIG51bWJlciB8fCBudWxsO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGEgbnVtYmVyIG9wdGlvblxyXG4gICAqL1xyXG4gIGdldE51bWJlcihuYW1lOiBzdHJpbmcsIHJlcXVpcmVkPzogYm9vbGVhbik6IG51bWJlciB8IG51bGwge1xyXG4gICAgcmV0dXJuIHRoaXMuZ2V0SW50ZWdlcihuYW1lLCByZXF1aXJlZCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSBib29sZWFuIG9wdGlvblxyXG4gICAqL1xyXG4gIGdldEJvb2xlYW4obmFtZTogc3RyaW5nLCByZXF1aXJlZD86IGJvb2xlYW4pOiBib29sZWFuIHwgbnVsbCB7XHJcbiAgICBjb25zdCBvcHRpb24gPSB0aGlzLm9wdGlvbnMuZmluZChvID0+IG8ubmFtZSA9PT0gbmFtZSk7XHJcbiAgICBpZiAoIW9wdGlvbiAmJiByZXF1aXJlZCkgdGhyb3cgbmV3IEVycm9yKGBSZXF1aXJlZCBvcHRpb24gXCIke25hbWV9XCIgbm90IGZvdW5kYCk7XHJcbiAgICByZXR1cm4gb3B0aW9uPy52YWx1ZSBhcyBib29sZWFuID8/IG51bGw7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSB1c2VyIG9wdGlvbiDigJQgcmV0dXJucyByZXNvbHZlZCBVc2VyIG9iamVjdCBpZiBhdmFpbGFibGVcclxuICAgKiBGYWxscyBiYWNrIHRvIHBhcnNpbmcgbWVudGlvbiBmb3JtYXQgKDxASUQ+KSBhbmQgcmVzb2x2aW5nIGZyb20gcmVzb2x2ZWQgZGF0YVxyXG4gICAqL1xyXG4gIGdldFVzZXIobmFtZTogc3RyaW5nLCByZXF1aXJlZD86IGJvb2xlYW4pOiBVc2VyIHwgbnVsbCB7XHJcbiAgICBjb25zdCBvcHRpb24gPSB0aGlzLm9wdGlvbnMuZmluZChvID0+IG8ubmFtZSA9PT0gbmFtZSk7XHJcbiAgICBpZiAoIW9wdGlvbiAmJiByZXF1aXJlZCkgdGhyb3cgbmV3IEVycm9yKGBSZXF1aXJlZCBvcHRpb24gXCIke25hbWV9XCIgbm90IGZvdW5kYCk7XHJcbiAgICBpZiAoIW9wdGlvbikgcmV0dXJuIG51bGw7XHJcblxyXG4gICAgY29uc3QgcmF3VmFsdWUgPSBTdHJpbmcob3B0aW9uLnZhbHVlIHx8ICcnKTtcclxuXHJcbiAgICAvLyBFeHRyYWN0IHVzZXIgSUQg4oCUIGNvdWxkIGJlIFwiMTIzXCIsIFwiPEAxMjM+XCIsIG9yIFwiPEAhMTIzPlwiXHJcbiAgICBjb25zdCBtYXRjaCA9IHJhd1ZhbHVlLm1hdGNoKC9ePD9APyE/KFxcZCspPj8kLyk7XHJcbiAgICBjb25zdCB1c2VySWQgPSBtYXRjaCA/IG1hdGNoWzFdIDogcmF3VmFsdWU7XHJcblxyXG4gICAgLy8gVHJ5IHRvIHJlc29sdmUgZnJvbSByZXNvbHZlZCBkYXRhXHJcbiAgICBpZiAodGhpcy5yZXNvbHZlZD8udXNlcnMgJiYgdGhpcy5yZXNvbHZlZC51c2Vyc1t1c2VySWRdKSB7XHJcbiAgICAgIHJldHVybiBuZXcgVXNlcih0aGlzLnJlc29sdmVkLnVzZXJzW3VzZXJJZF0sIHRoaXMuY2xpZW50KTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBGYWxsYmFjazogcmV0dXJuIGEgbWluaW1hbCBVc2VyIHdpdGgganVzdCB0aGUgSURcclxuICAgIGlmICh1c2VySWQgJiYgL15cXGQrJC8udGVzdCh1c2VySWQpKSB7XHJcbiAgICAgIHJldHVybiBuZXcgVXNlcih7IGlkOiB1c2VySWQsIHVzZXJuYW1lOiBgVXNlcl8ke3VzZXJJZH1gIH0sIHRoaXMuY2xpZW50KTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gbnVsbDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCByYXcgdXNlciBJRCBmcm9tIGEgdXNlciBvcHRpb24gKGZvciBjYXNlcyB3aGVyZSBvbmx5IHRoZSBJRCBpcyBuZWVkZWQpXHJcbiAgICovXHJcbiAgZ2V0VXNlcklkKG5hbWU6IHN0cmluZywgcmVxdWlyZWQ/OiBib29sZWFuKTogc3RyaW5nIHwgbnVsbCB7XHJcbiAgICBjb25zdCBvcHRpb24gPSB0aGlzLm9wdGlvbnMuZmluZChvID0+IG8ubmFtZSA9PT0gbmFtZSk7XHJcbiAgICBpZiAoIW9wdGlvbiAmJiByZXF1aXJlZCkgdGhyb3cgbmV3IEVycm9yKGBSZXF1aXJlZCBvcHRpb24gXCIke25hbWV9XCIgbm90IGZvdW5kYCk7XHJcbiAgICBpZiAoIW9wdGlvbikgcmV0dXJuIG51bGw7XHJcblxyXG4gICAgY29uc3QgcmF3VmFsdWUgPSBTdHJpbmcob3B0aW9uLnZhbHVlIHx8ICcnKTtcclxuICAgIGNvbnN0IG1hdGNoID0gcmF3VmFsdWUubWF0Y2goL148P0A/IT8oXFxkKyk+PyQvKTtcclxuICAgIHJldHVybiBtYXRjaCA/IG1hdGNoWzFdIDogcmF3VmFsdWU7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSBjaGFubmVsIG9wdGlvblxyXG4gICAqL1xyXG4gIGdldENoYW5uZWwobmFtZTogc3RyaW5nLCByZXF1aXJlZD86IGJvb2xlYW4pOiBzdHJpbmcgfCBudWxsIHtcclxuICAgIGNvbnN0IG9wdGlvbiA9IHRoaXMub3B0aW9ucy5maW5kKG8gPT4gby5uYW1lID09PSBuYW1lKTtcclxuICAgIGlmICghb3B0aW9uICYmIHJlcXVpcmVkKSB0aHJvdyBuZXcgRXJyb3IoYFJlcXVpcmVkIG9wdGlvbiBcIiR7bmFtZX1cIiBub3QgZm91bmRgKTtcclxuICAgIHJldHVybiBvcHRpb24/LnZhbHVlIGFzIHN0cmluZyB8fCBudWxsO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGEgc3ViY29tbWFuZCBuYW1lXHJcbiAgICovXHJcbiAgZ2V0U3ViY29tbWFuZChyZXF1aXJlZD86IGJvb2xlYW4pOiBzdHJpbmcgfCBudWxsIHtcclxuICAgIGNvbnN0IG9wdGlvbiA9IHRoaXMub3B0aW9ucy5maW5kKG8gPT4gby50eXBlID09PSAxKTtcclxuICAgIGlmICghb3B0aW9uICYmIHJlcXVpcmVkKSB0aHJvdyBuZXcgRXJyb3IoJ1JlcXVpcmVkIHN1YmNvbW1hbmQgbm90IGZvdW5kJyk7XHJcbiAgICByZXR1cm4gb3B0aW9uPy5uYW1lIHx8IG51bGw7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgdGhlIGZvY3VzZWQgb3B0aW9uIChmb3IgYXV0b2NvbXBsZXRlKVxyXG4gICAqL1xyXG4gIGdldEZvY3VzZWQoKTogeyBuYW1lOiBzdHJpbmc7IHZhbHVlOiBzdHJpbmcgfSB8IG51bGwge1xyXG4gICAgY29uc3Qgb3B0aW9uID0gdGhpcy5vcHRpb25zLmZpbmQobyA9PiBvLmZvY3VzZWQpO1xyXG4gICAgaWYgKCFvcHRpb24pIHJldHVybiBudWxsO1xyXG4gICAgcmV0dXJuIHsgbmFtZTogb3B0aW9uLm5hbWUsIHZhbHVlOiBvcHRpb24udmFsdWUgYXMgc3RyaW5nIH07XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogQXV0b2NvbXBsZXRlIGludGVyYWN0aW9uXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgQXV0b2NvbXBsZXRlSW50ZXJhY3Rpb24gZXh0ZW5kcyBJbnRlcmFjdGlvbiB7XHJcbiAgLyoqIENvbW1hbmQgbmFtZSAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBjb21tYW5kTmFtZTogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBDb21tYW5kIG9wdGlvbnMgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgb3B0aW9uczogQ29tbWFuZEludGVyYWN0aW9uT3B0aW9ucztcclxuXHJcbiAgY29uc3RydWN0b3IoY2xpZW50OiBDbGllbnQsIGRhdGE6IEFQSUludGVyYWN0aW9uKSB7XHJcbiAgICBzdXBlcihjbGllbnQsIGRhdGEpO1xyXG4gICAgdGhpcy5jb21tYW5kTmFtZSA9IGRhdGEuZGF0YT8ubmFtZSB8fCAnJztcclxuICAgIHRoaXMub3B0aW9ucyA9IG5ldyBDb21tYW5kSW50ZXJhY3Rpb25PcHRpb25zKGNsaWVudCwgZGF0YS5kYXRhPy5vcHRpb25zIHx8IFtdLCBkYXRhLmRhdGE/LnJlc29sdmVkKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlc3BvbmQgd2l0aCBhdXRvY29tcGxldGUgY2hvaWNlc1xyXG4gICAqL1xyXG4gIGFzeW5jIHJlc3BvbmQoY2hvaWNlczogQXV0b2NvbXBsZXRlQ2hvaWNlW10pOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGF3YWl0IHRoaXMuY2xpZW50LnJlc3QuY3JlYXRlSW50ZXJhY3Rpb25SZXNwb25zZSh0aGlzLmlkLCB0aGlzLnRva2VuLCB7XHJcbiAgICAgIHR5cGU6IEludGVyYWN0aW9uUmVzcG9uc2VUeXBlLkFwcGxpY2F0aW9uQ29tbWFuZEF1dG9jb21wbGV0ZVJlc3VsdCxcclxuICAgICAgZGF0YTogeyBjaG9pY2VzIH1cclxuICAgIH0pO1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIEJ1dHRvbiBpbnRlcmFjdGlvblxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIEJ1dHRvbkludGVyYWN0aW9uIGV4dGVuZHMgSW50ZXJhY3Rpb24ge1xyXG4gIC8qKiBCdXR0b24gY3VzdG9tIElEICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGN1c3RvbUlkOiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIENvbXBvbmVudCB0eXBlIChhbHdheXMgMiBmb3IgYnV0dG9ucykgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgY29tcG9uZW50VHlwZTogbnVtYmVyID0gMjtcclxuICBcclxuICAvKiogTWVzc2FnZSB0aGUgYnV0dG9uIGlzIGF0dGFjaGVkIHRvICovXHJcbiAgcHVibGljIHJlYWRvbmx5IG1lc3NhZ2U/OiBNZXNzYWdlO1xyXG5cclxuICBjb25zdHJ1Y3RvcihjbGllbnQ6IENsaWVudCwgZGF0YTogQVBJSW50ZXJhY3Rpb24pIHtcclxuICAgIHN1cGVyKGNsaWVudCwgZGF0YSk7XHJcbiAgICB0aGlzLmN1c3RvbUlkID0gZGF0YS5kYXRhPy5jdXN0b21faWQgfHwgJyc7XHJcbiAgICAvLyBwb255dGFpbDogd3JhcCBpbiBNZXNzYWdlIHN0cnVjdHVyZSBzbyAuZGVsZXRlKCkvLmVkaXQoKSB3b3JrXHJcbiAgICAvLyBJbmplY3QgZ3VpbGRfaWQgZnJvbSBpbnRlcmFjdGlvbiBzaW5jZSBiYWNrZW5kIHNlbmRzIG1pbmltYWwgbWVzc2FnZSBwYXlsb2FkXHJcbiAgICBpZiAoZGF0YS5tZXNzYWdlKSB7XHJcbiAgICAgIGNvbnN0IG1lc3NhZ2VEYXRhID0geyAuLi5kYXRhLm1lc3NhZ2UsIGd1aWxkX2lkOiBkYXRhLmd1aWxkX2lkIH07XHJcbiAgICAgIHRoaXMubWVzc2FnZSA9IG5ldyBNZXNzYWdlKGNsaWVudCwgbWVzc2FnZURhdGEgYXMgYW55KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFVwZGF0ZSB0aGUgbWVzc2FnZSB0aGUgYnV0dG9uIGlzIGF0dGFjaGVkIHRvXHJcbiAgICovXHJcbiAgYXN5bmMgdXBkYXRlKG9wdGlvbnM6IHN0cmluZyB8IEludGVyYWN0aW9uUmVwbHlPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICAvLyBwb255dGFpbDogQnVnICMxMyBmaXggLSBzdHJpbmcgcGFyYW1ldHJlIGRlc3RlxJ9pXHJcbiAgICBjb25zdCBjb250ZW50ID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gb3B0aW9ucyA6IG9wdGlvbnMuY29udGVudDtcclxuICAgIGNvbnN0IHJhd0VtYmVkcyA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IHVuZGVmaW5lZCA6IG9wdGlvbnMuZW1iZWRzO1xyXG4gICAgY29uc3QgcmF3Q29tcG9uZW50cyA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IHVuZGVmaW5lZCA6IG9wdGlvbnMuY29tcG9uZW50cztcclxuICAgIFxyXG4gICAgLy8gQ29udmVydCBFbWJlZEJ1aWxkZXIgaW5zdGFuY2VzIHRvIHBsYWluIG9iamVjdHNcclxuICAgIGNvbnN0IGVtYmVkcyA9IHJhd0VtYmVkcz8ubWFwKGUgPT4gZSBpbnN0YW5jZW9mIEVtYmVkQnVpbGRlciA/IGUudG9KU09OKCkgOiBlKTtcclxuICAgIC8vIENvbnZlcnQgQWN0aW9uUm93QnVpbGRlci9CdXR0b25CdWlsZGVyIGluc3RhbmNlcyB0byBwbGFpbiBvYmplY3RzXHJcbiAgICBjb25zdCBjb21wb25lbnRzID0gc2VyaWFsaXplQ29tcG9uZW50cyhyYXdDb21wb25lbnRzKTtcclxuICAgIFxyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5jcmVhdGVJbnRlcmFjdGlvblJlc3BvbnNlKHRoaXMuaWQsIHRoaXMudG9rZW4sIHtcclxuICAgICAgdHlwZTogSW50ZXJhY3Rpb25SZXNwb25zZVR5cGUuVXBkYXRlTWVzc2FnZSxcclxuICAgICAgZGF0YToge1xyXG4gICAgICAgIGNvbnRlbnQsXHJcbiAgICAgICAgZW1iZWRzLFxyXG4gICAgICAgIGNvbXBvbmVudHNcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICB0aGlzLnJlcGxpZWQgPSB0cnVlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2hvdyBhIG1vZGFsIGluIHJlc3BvbnNlIHRvIHRoaXMgYnV0dG9uIGludGVyYWN0aW9uXHJcbiAgICovXHJcbiAgYXN5bmMgc2hvd01vZGFsKG1vZGFsOiBNb2RhbERhdGEgfCB7IHRvSlNPTigpOiBNb2RhbERhdGEgfSk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgbW9kYWxEYXRhID0gJ3RvSlNPTicgaW4gbW9kYWwgJiYgdHlwZW9mIG1vZGFsLnRvSlNPTiA9PT0gJ2Z1bmN0aW9uJyA/IG1vZGFsLnRvSlNPTigpIDogbW9kYWw7XHJcbiAgICBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LmNyZWF0ZUludGVyYWN0aW9uUmVzcG9uc2UodGhpcy5pZCwgdGhpcy50b2tlbiwge1xyXG4gICAgICB0eXBlOiBJbnRlcmFjdGlvblJlc3BvbnNlVHlwZS5Nb2RhbCxcclxuICAgICAgZGF0YTogbW9kYWxEYXRhXHJcbiAgICB9KTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTZWxlY3QgbWVudSBpbnRlcmFjdGlvblxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFNlbGVjdE1lbnVJbnRlcmFjdGlvbiBleHRlbmRzIEludGVyYWN0aW9uIHtcclxuICAvKiogU2VsZWN0IG1lbnUgY3VzdG9tIElEICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGN1c3RvbUlkOiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIENvbXBvbmVudCB0eXBlIChhbHdheXMgMyBmb3Igc2VsZWN0IG1lbnVzKSAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBjb21wb25lbnRUeXBlOiBudW1iZXIgPSAzO1xyXG4gIFxyXG4gIC8qKiBTZWxlY3RlZCB2YWx1ZXMgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgdmFsdWVzOiBzdHJpbmdbXTtcclxuICBcclxuICAvKiogTWVzc2FnZSB0aGUgc2VsZWN0IG1lbnUgaXMgYXR0YWNoZWQgdG8gKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgbWVzc2FnZT86IE1lc3NhZ2U7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGNsaWVudDogQ2xpZW50LCBkYXRhOiBBUElJbnRlcmFjdGlvbikge1xyXG4gICAgc3VwZXIoY2xpZW50LCBkYXRhKTtcclxuICAgIHRoaXMuY3VzdG9tSWQgPSBkYXRhLmRhdGE/LmN1c3RvbV9pZCB8fCAnJztcclxuICAgIHRoaXMudmFsdWVzID0gZGF0YS5kYXRhPy52YWx1ZXMgfHwgW107XHJcbiAgICAvLyBwb255dGFpbDogd3JhcCBpbiBNZXNzYWdlIHN0cnVjdHVyZSBzbyAuZGVsZXRlKCkvLmVkaXQoKSB3b3JrXHJcbiAgICAvLyBJbmplY3QgZ3VpbGRfaWQgZnJvbSBpbnRlcmFjdGlvbiBzaW5jZSBiYWNrZW5kIHNlbmRzIG1pbmltYWwgbWVzc2FnZSBwYXlsb2FkXHJcbiAgICBpZiAoZGF0YS5tZXNzYWdlKSB7XHJcbiAgICAgIGNvbnN0IG1lc3NhZ2VEYXRhID0geyAuLi5kYXRhLm1lc3NhZ2UsIGd1aWxkX2lkOiBkYXRhLmd1aWxkX2lkIH07XHJcbiAgICAgIHRoaXMubWVzc2FnZSA9IG5ldyBNZXNzYWdlKGNsaWVudCwgbWVzc2FnZURhdGEgYXMgYW55KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFVwZGF0ZSB0aGUgbWVzc2FnZSB0aGUgc2VsZWN0IG1lbnUgaXMgYXR0YWNoZWQgdG9cclxuICAgKi9cclxuICBhc3luYyB1cGRhdGUob3B0aW9uczogc3RyaW5nIHwgSW50ZXJhY3Rpb25SZXBseU9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIC8vIHBvbnl0YWlsOiBCdWcgIzEzIGZpeCAtIHN0cmluZyBwYXJhbWV0cmUgZGVzdGXEn2lcclxuICAgIGNvbnN0IGNvbnRlbnQgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyBvcHRpb25zIDogb3B0aW9ucy5jb250ZW50O1xyXG4gICAgY29uc3QgcmF3RW1iZWRzID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gdW5kZWZpbmVkIDogb3B0aW9ucy5lbWJlZHM7XHJcbiAgICBjb25zdCByYXdDb21wb25lbnRzID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gdW5kZWZpbmVkIDogb3B0aW9ucy5jb21wb25lbnRzO1xyXG4gICAgXHJcbiAgICAvLyBDb252ZXJ0IEVtYmVkQnVpbGRlciBpbnN0YW5jZXMgdG8gcGxhaW4gb2JqZWN0c1xyXG4gICAgY29uc3QgZW1iZWRzID0gcmF3RW1iZWRzPy5tYXAoZSA9PiBlIGluc3RhbmNlb2YgRW1iZWRCdWlsZGVyID8gZS50b0pTT04oKSA6IGUpO1xyXG4gICAgLy8gQ29udmVydCBBY3Rpb25Sb3dCdWlsZGVyL0J1dHRvbkJ1aWxkZXIgaW5zdGFuY2VzIHRvIHBsYWluIG9iamVjdHNcclxuICAgIGNvbnN0IGNvbXBvbmVudHMgPSBzZXJpYWxpemVDb21wb25lbnRzKHJhd0NvbXBvbmVudHMpO1xyXG4gICAgXHJcbiAgICBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LmNyZWF0ZUludGVyYWN0aW9uUmVzcG9uc2UodGhpcy5pZCwgdGhpcy50b2tlbiwge1xyXG4gICAgICB0eXBlOiBJbnRlcmFjdGlvblJlc3BvbnNlVHlwZS5VcGRhdGVNZXNzYWdlLFxyXG4gICAgICBkYXRhOiB7XHJcbiAgICAgICAgY29udGVudCxcclxuICAgICAgICBlbWJlZHMsXHJcbiAgICAgICAgY29tcG9uZW50c1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICAgIHRoaXMucmVwbGllZCA9IHRydWU7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTaG93IGEgbW9kYWwgaW4gcmVzcG9uc2UgdG8gdGhpcyBzZWxlY3QgbWVudSBpbnRlcmFjdGlvblxyXG4gICAqL1xyXG4gIGFzeW5jIHNob3dNb2RhbChtb2RhbDogTW9kYWxEYXRhIHwgeyB0b0pTT04oKTogTW9kYWxEYXRhIH0pOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IG1vZGFsRGF0YSA9ICd0b0pTT04nIGluIG1vZGFsICYmIHR5cGVvZiBtb2RhbC50b0pTT04gPT09ICdmdW5jdGlvbicgPyBtb2RhbC50b0pTT04oKSA6IG1vZGFsO1xyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5jcmVhdGVJbnRlcmFjdGlvblJlc3BvbnNlKHRoaXMuaWQsIHRoaXMudG9rZW4sIHtcclxuICAgICAgdHlwZTogSW50ZXJhY3Rpb25SZXNwb25zZVR5cGUuTW9kYWwsXHJcbiAgICAgIGRhdGE6IG1vZGFsRGF0YVxyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogTW9kYWwgc3VibWl0IGludGVyYWN0aW9uXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgTW9kYWxTdWJtaXRJbnRlcmFjdGlvbiBleHRlbmRzIEludGVyYWN0aW9uIHtcclxuICAvKiogTW9kYWwgY3VzdG9tIElEICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGN1c3RvbUlkOiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIE1vZGFsIGZpZWxkcyAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBmaWVsZHM6IE1vZGFsRmllbGRzO1xyXG5cclxuICBjb25zdHJ1Y3RvcihjbGllbnQ6IENsaWVudCwgZGF0YTogQVBJSW50ZXJhY3Rpb24pIHtcclxuICAgIHN1cGVyKGNsaWVudCwgZGF0YSk7XHJcbiAgICB0aGlzLmN1c3RvbUlkID0gZGF0YS5kYXRhPy5jdXN0b21faWQgfHwgJyc7XHJcbiAgICAvLyBNb2RhbCB2YWx1ZXMgY29tZSBmcm9tIGNvbXBvbmVudHMgYXJyYXksIG9yIGFzIEpTT04gc3RyaW5nIGluIHZhbHVlc1swXSAoYmFja2VuZCBjb21wYXQpXHJcbiAgICBsZXQgY29tcG9uZW50cyA9IChkYXRhLmRhdGEgYXMgYW55KT8uY29tcG9uZW50cyB8fCBbXTtcclxuICAgIGlmIChjb21wb25lbnRzLmxlbmd0aCA9PT0gMCAmJiAoZGF0YS5kYXRhIGFzIGFueSk/LnZhbHVlcz8ubGVuZ3RoID4gMCkge1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGNvbnN0IHBhcnNlZCA9IEpTT04ucGFyc2UoKGRhdGEuZGF0YSBhcyBhbnkpLnZhbHVlc1swXSk7XHJcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkocGFyc2VkKSkgY29tcG9uZW50cyA9IHBhcnNlZDtcclxuICAgICAgfSBjYXRjaCB7fVxyXG4gICAgfVxyXG4gICAgdGhpcy5maWVsZHMgPSBuZXcgTW9kYWxGaWVsZHMoY29tcG9uZW50cyk7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogTW9kYWwgZmllbGRzIGhlbHBlclxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIE1vZGFsRmllbGRzIHtcclxuICBwcml2YXRlIGZpZWxkTWFwOiBNYXA8c3RyaW5nLCBzdHJpbmc+O1xyXG5cclxuICBjb25zdHJ1Y3Rvcihjb21wb25lbnRzOiBhbnlbXSkge1xyXG4gICAgdGhpcy5maWVsZE1hcCA9IG5ldyBNYXAoKTtcclxuICAgIC8vIFBhcnNlIGFjdGlvbiByb3dzIOKGkiB0ZXh0IGlucHV0c1xyXG4gICAgZm9yIChjb25zdCByb3cgb2YgY29tcG9uZW50cykge1xyXG4gICAgICBjb25zdCBpbm5lckNvbXBvbmVudHMgPSByb3c/LmNvbXBvbmVudHMgfHwgW107XHJcbiAgICAgIGZvciAoY29uc3QgY29tcCBvZiBpbm5lckNvbXBvbmVudHMpIHtcclxuICAgICAgICBpZiAoY29tcC5jdXN0b21faWQgJiYgY29tcC52YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICB0aGlzLmZpZWxkTWFwLnNldChjb21wLmN1c3RvbV9pZCwgY29tcC52YWx1ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSB0ZXh0IGlucHV0IHZhbHVlIGJ5IGN1c3RvbV9pZFxyXG4gICAqL1xyXG4gIGdldFRleHRJbnB1dFZhbHVlKGN1c3RvbUlkOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcclxuICAgIHJldHVybiB0aGlzLmZpZWxkTWFwLmdldChjdXN0b21JZCkgPz8gbnVsbDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhIGZpZWxkIChhbGlhcyBmb3IgZ2V0VGV4dElucHV0VmFsdWUpXHJcbiAgICovXHJcbiAgZ2V0RmllbGQoY3VzdG9tSWQ6IHN0cmluZyk6IHsgdmFsdWU6IHN0cmluZyB9IHwgbnVsbCB7XHJcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMuZmllbGRNYXAuZ2V0KGN1c3RvbUlkKTtcclxuICAgIHJldHVybiB2YWx1ZSAhPT0gdW5kZWZpbmVkID8geyB2YWx1ZSB9IDogbnVsbDtcclxuICB9XHJcbn1cclxuXHJcbi8vIFR5cGVzXHJcbmV4cG9ydCBpbnRlcmZhY2UgSW50ZXJhY3Rpb25SZXBseU9wdGlvbnMge1xyXG4gIGNvbnRlbnQ/OiBzdHJpbmc7XHJcbiAgZW1iZWRzPzogKEFQSUVtYmVkIHwgRW1iZWRCdWlsZGVyKVtdO1xyXG4gIGNvbXBvbmVudHM/OiBhbnlbXTtcclxuICBlcGhlbWVyYWw/OiBib29sZWFuO1xyXG4gIGZpbGVzPzogQXJyYXk8eyBuYW1lOiBzdHJpbmc7IGRhdGE6IEJ1ZmZlcjsgY29udGVudFR5cGU/OiBzdHJpbmcgfT47XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgQXV0b2NvbXBsZXRlQ2hvaWNlIHtcclxuICBuYW1lOiBzdHJpbmc7XHJcbiAgdmFsdWU6IHN0cmluZyB8IG51bWJlcjtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBNb2RhbERhdGEge1xyXG4gIGN1c3RvbV9pZDogc3RyaW5nO1xyXG4gIHRpdGxlOiBzdHJpbmc7XHJcbiAgY29tcG9uZW50czogYW55W107XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDcmVhdGUgYXBwcm9wcmlhdGUgaW50ZXJhY3Rpb24gY2xhc3MgYmFzZWQgb24gdHlwZVxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUludGVyYWN0aW9uKGNsaWVudDogQ2xpZW50LCBkYXRhOiBBUElJbnRlcmFjdGlvbik6IEludGVyYWN0aW9uIHtcclxuICBzd2l0Y2ggKGRhdGEudHlwZSkge1xyXG4gICAgY2FzZSBJbnRlcmFjdGlvblR5cGUuQXBwbGljYXRpb25Db21tYW5kOlxyXG4gICAgICByZXR1cm4gbmV3IENvbW1hbmRJbnRlcmFjdGlvbihjbGllbnQsIGRhdGEpO1xyXG4gICAgY2FzZSBJbnRlcmFjdGlvblR5cGUuQXBwbGljYXRpb25Db21tYW5kQXV0b2NvbXBsZXRlOlxyXG4gICAgICByZXR1cm4gbmV3IEF1dG9jb21wbGV0ZUludGVyYWN0aW9uKGNsaWVudCwgZGF0YSk7XHJcbiAgICBjYXNlIEludGVyYWN0aW9uVHlwZS5Nb2RhbFN1Ym1pdDpcclxuICAgICAgcmV0dXJuIG5ldyBNb2RhbFN1Ym1pdEludGVyYWN0aW9uKGNsaWVudCwgZGF0YSk7XHJcbiAgICBjYXNlIEludGVyYWN0aW9uVHlwZS5NZXNzYWdlQ29tcG9uZW50OlxyXG4gICAgICAvLyBjb21wb25lbnRfdHlwZTogMiA9IEJ1dHRvbiwgMyA9IFNlbGVjdCBNZW51XHJcbiAgICAgIGlmIChkYXRhLmRhdGE/LmNvbXBvbmVudF90eXBlID09PSAyKSB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBCdXR0b25JbnRlcmFjdGlvbihjbGllbnQsIGRhdGEpO1xyXG4gICAgICB9IGVsc2UgaWYgKGRhdGEuZGF0YT8uY29tcG9uZW50X3R5cGUgPT09IDMpIHtcclxuICAgICAgICByZXR1cm4gbmV3IFNlbGVjdE1lbnVJbnRlcmFjdGlvbihjbGllbnQsIGRhdGEpO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBuZXcgSW50ZXJhY3Rpb24oY2xpZW50LCBkYXRhKTtcclxuICAgIGRlZmF1bHQ6XHJcbiAgICAgIHJldHVybiBuZXcgSW50ZXJhY3Rpb24oY2xpZW50LCBkYXRhKTtcclxuICB9XHJcbn1cclxuIl19