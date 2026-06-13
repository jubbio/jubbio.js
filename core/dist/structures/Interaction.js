"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModalFields = exports.ModalSubmitInteraction = exports.SelectMenuInteraction = exports.ButtonInteraction = exports.AutocompleteInteraction = exports.CommandInteractionOptions = exports.CommandInteraction = exports.Interaction = void 0;
exports.createInteraction = createInteraction;
const enums_1 = require("../enums");
const User_1 = require("./User");
const GuildMember_1 = require("./GuildMember");
const Collection_1 = require("./Collection");
const EmbedBuilder_1 = require("../builders/EmbedBuilder");
/**
 * Serialize components array (ActionRowBuilder/ButtonBuilder instances) to plain JSON.
 * Handles nested structures: ActionRow → components[] → Button/SelectMenu
 */
function serializeComponents(components) {
    if (!components)
        return undefined;
    return components.map(row => {
        // If it has a toJSON method (ActionRowBuilder), call it
        const rowData = typeof row?.toJSON === 'function' ? row.toJSON() : row;
        // Also serialize nested components (buttons, select menus inside action rows)
        if (rowData?.components && Array.isArray(rowData.components)) {
            rowData.components = rowData.components.map((comp) => typeof comp?.toJSON === 'function' ? comp.toJSON() : comp);
        }
        return rowData;
    });
}
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
        this.user = userData ? new User_1.User(userData) : new User_1.User({ id: '0', username: 'Unknown' });
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
        const components = serializeComponents(rawComponents);
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
        const components = serializeComponents(rawComponents);
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
        const ephemeral = typeof options === 'string' ? false : options.ephemeral;
        // Convert EmbedBuilder instances to plain objects
        const embeds = rawEmbeds?.map(e => e instanceof EmbedBuilder_1.EmbedBuilder ? e.toJSON() : e);
        await this.client.rest.createFollowup(this.token, {
            content,
            embeds,
            flags: ephemeral ? enums_1.MessageFlags.Ephemeral : 0
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
        this.options = new CommandInteractionOptions(data.data?.options || [], data.data?.resolved);
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
    options;
    resolved;
    /** Patterns that indicate code injection attempts */
    static DANGEROUS_PATTERNS = [
        'require(', 'import(', 'child_process', 'eval(', 'Function(',
        'exec(', 'spawn(', 'execSync(', 'spawnSync(', '__proto__',
        'constructor[', 'process.env', 'process.exit',
        'fs.read', 'fs.write', 'fs.unlink',
        'os.exec', 'os.system', 'subprocess', 'Runtime.getRuntime',
    ];
    /** Sanitize a string value by rejecting dangerous patterns */
    static sanitize(value) {
        const lower = value.toLowerCase();
        for (const pattern of CommandInteractionOptions.DANGEROUS_PATTERNS) {
            if (lower.includes(pattern.toLowerCase())) {
                return '';
            }
        }
        return value;
    }
    constructor(options, resolved) {
        this.options = options;
        this.resolved = resolved;
    }
    /**
     * Get a string option (sanitized against code injection)
     */
    getString(name, required) {
        const option = this.options.find(o => o.name === name);
        if (!option && required)
            throw new Error(`Required option "${name}" not found`);
        const raw = option?.value || null;
        return raw ? CommandInteractionOptions.sanitize(raw) : null;
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
            return new User_1.User(this.resolved.users[userId]);
        }
        // Fallback: return a minimal User with just the ID
        if (userId && /^\d+$/.test(userId)) {
            return new User_1.User({ id: userId, username: `User_${userId}` });
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
        this.options = new CommandInteractionOptions(data.data?.options || [], data.data?.resolved);
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
        this.message = data.message;
    }
    /**
     * Update the message the button is attached to
     */
    async update(options) {
        // Convert EmbedBuilder instances to plain objects
        const embeds = options.embeds?.map(e => e instanceof EmbedBuilder_1.EmbedBuilder ? e.toJSON() : e);
        // Convert ActionRowBuilder/ButtonBuilder instances to plain objects
        const components = serializeComponents(options.components);
        await this.client.rest.createInteractionResponse(this.id, this.token, {
            type: enums_1.InteractionResponseType.UpdateMessage,
            data: {
                content: options.content,
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
        this.message = data.message;
    }
    /**
     * Update the message the select menu is attached to
     */
    async update(options) {
        // Convert EmbedBuilder instances to plain objects
        const embeds = options.embeds?.map(e => e instanceof EmbedBuilder_1.EmbedBuilder ? e.toJSON() : e);
        // Convert ActionRowBuilder/ButtonBuilder instances to plain objects
        const components = serializeComponents(options.components);
        await this.client.rest.createInteractionResponse(this.id, this.token, {
            type: enums_1.InteractionResponseType.UpdateMessage,
            data: {
                content: options.content,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSW50ZXJhY3Rpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvc3RydWN0dXJlcy9JbnRlcmFjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFpbkJBLDhDQW1CQztBQW5vQkQsb0NBQWtGO0FBQ2xGLGlDQUE4QjtBQUM5QiwrQ0FBNEM7QUFDNUMsNkNBQTBDO0FBQzFDLDJEQUF3RDtBQUd4RDs7O0dBR0c7QUFDSCxTQUFTLG1CQUFtQixDQUFDLFVBQTZCO0lBQ3hELElBQUksQ0FBQyxVQUFVO1FBQUUsT0FBTyxTQUFTLENBQUM7SUFDbEMsT0FBTyxVQUFVLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFO1FBQzFCLHdEQUF3RDtRQUN4RCxNQUFNLE9BQU8sR0FBRyxPQUFPLEdBQUcsRUFBRSxNQUFNLEtBQUssVUFBVSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQztRQUN2RSw4RUFBOEU7UUFDOUUsSUFBSSxPQUFPLEVBQUUsVUFBVSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUM7WUFDN0QsT0FBTyxDQUFDLFVBQVUsR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQVMsRUFBRSxFQUFFLENBQ3hELE9BQU8sSUFBSSxFQUFFLE1BQU0sS0FBSyxVQUFVLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUMxRCxDQUFDO1FBQ0osQ0FBQztRQUNELE9BQU8sT0FBTyxDQUFDO0lBQ2pCLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUVEOztHQUVHO0FBQ0gsTUFBYSxXQUFXO0lBQ3RCLDhCQUE4QjtJQUNkLE1BQU0sQ0FBUztJQUUvQixxQkFBcUI7SUFDTCxFQUFFLENBQVM7SUFFM0IscUJBQXFCO0lBQ0wsYUFBYSxD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QUNuRCxLQUFLLHVCQUFlLENBQUMsV0FBVztZQUM5QixPQUFPLElBQUksc0JBQXNCLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ2xELEtBQUssdUJBQWUsQ0FBQyxnQkFBZ0I7WUFDbkMsOENBQThDO1lBQzlDLElBQUksSUFBSSxDQUFDLElBQUksRUFBRSxjQUFjLEtBQUssQ0FBQyxFQUFFLENBQUM7Z0JBQ3BDLE9BQU8sSUFBSSxpQkFBaUIsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDN0MsQ0FBQztpQkFBTSxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUUsY0FBYyxLQUFLLENBQUMsRUFBRSxDQUFDO2dCQUMzQyxPQUFPLElBQUkscUJBQXFCLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ2pELENBQUM7WUFDRCxPQUFPLElBQUksV0FBVyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztRQUN2QztZQUNFLE9BQU8sSUFBSSxXQUFXLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ3pDLENBQUM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQVBJSW50ZXJhY3Rpb24sIEFQSUludGVyYWN0aW9uT3B0aW9uLCBBUElJbnRlcmFjdGlvblJlc29sdmVkLCBBUElFbWJlZCB9IGZyb20gJy4uL3R5cGVzJztcclxuaW1wb3J0IHsgSW50ZXJhY3Rpb25UeXBlLCBJbnRlcmFjdGlvblJlc3BvbnNlVHlwZSwgTWVzc2FnZUZsYWdzIH0gZnJvbSAnLi4vZW51bXMnO1xyXG5pbXBvcnQgeyBVc2VyIH0gZnJvbSAnLi9Vc2VyJztcclxuaW1wb3J0IHsgR3VpbGRNZW1iZXIgfSBmcm9tICcuL0d1aWxkTWVtYmVyJztcclxuaW1wb3J0IHsgQ29sbGVjdGlvbiB9IGZyb20gJy4vQ29sbGVjdGlvbic7XHJcbmltcG9ydCB7IEVtYmVkQnVpbGRlciB9IGZyb20gJy4uL2J1aWxkZXJzL0VtYmVkQnVpbGRlcic7XHJcbmltcG9ydCB0eXBlIHsgQ2xpZW50IH0gZnJvbSAnLi4vQ2xpZW50JztcclxuXHJcbi8qKlxyXG4gKiBTZXJpYWxpemUgY29tcG9uZW50cyBhcnJheSAoQWN0aW9uUm93QnVpbGRlci9CdXR0b25CdWlsZGVyIGluc3RhbmNlcykgdG8gcGxhaW4gSlNPTi5cclxuICogSGFuZGxlcyBuZXN0ZWQgc3RydWN0dXJlczogQWN0aW9uUm93IOKGkiBjb21wb25lbnRzW10g4oaSIEJ1dHRvbi9TZWxlY3RNZW51XHJcbiAqL1xyXG5mdW5jdGlvbiBzZXJpYWxpemVDb21wb25lbnRzKGNvbXBvbmVudHM6IGFueVtdIHwgdW5kZWZpbmVkKTogYW55W10gfCB1bmRlZmluZWQge1xyXG4gIGlmICghY29tcG9uZW50cykgcmV0dXJuIHVuZGVmaW5lZDtcclxuICByZXR1cm4gY29tcG9uZW50cy5tYXAocm93ID0+IHtcclxuICAgIC8vIElmIGl0IGhhcyBhIHRvSlNPTiBtZXRob2QgKEFjdGlvblJvd0J1aWxkZXIpLCBjYWxsIGl0XHJcbiAgICBjb25zdCByb3dEYXRhID0gdHlwZW9mIHJvdz8udG9KU09OID09PSAnZnVuY3Rpb24nID8gcm93LnRvSlNPTigpIDogcm93O1xyXG4gICAgLy8gQWxzbyBzZXJpYWxpemUgbmVzdGVkIGNvbXBvbmVudHMgKGJ1dHRvbnMsIHNlbGVjdCBtZW51cyBpbnNpZGUgYWN0aW9uIHJvd3MpXHJcbiAgICBpZiAocm93RGF0YT8uY29tcG9uZW50cyAmJiBBcnJheS5pc0FycmF5KHJvd0RhdGEuY29tcG9uZW50cykpIHtcclxuICAgICAgcm93RGF0YS5jb21wb25lbnRzID0gcm93RGF0YS5jb21wb25lbnRzLm1hcCgoY29tcDogYW55KSA9PlxyXG4gICAgICAgIHR5cGVvZiBjb21wPy50b0pTT04gPT09ICdmdW5jdGlvbicgPyBjb21wLnRvSlNPTigpIDogY29tcFxyXG4gICAgICApO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHJvd0RhdGE7XHJcbiAgfSk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBCYXNlIGludGVyYWN0aW9uIGNsYXNzXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgSW50ZXJhY3Rpb24ge1xyXG4gIC8qKiBSZWZlcmVuY2UgdG8gdGhlIGNsaWVudCAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBjbGllbnQ6IENsaWVudDtcclxuICBcclxuICAvKiogSW50ZXJhY3Rpb24gSUQgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgaWQ6IHN0cmluZztcclxuICBcclxuICAvKiogQXBwbGljYXRpb24gSUQgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgYXBwbGljYXRpb25JZDogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBJbnRlcmFjdGlvbiB0eXBlICovXHJcbiAgcHVibGljIHJlYWRvbmx5IHR5cGU6IEludGVyYWN0aW9uVHlwZTtcclxuICBcclxuICAvKiogR3VpbGQgSUQgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgZ3VpbGRJZD86IHN0cmluZztcclxuICBcclxuICAvKiogQ2hhbm5lbCBJRCAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBjaGFubmVsSWQ/OiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIEludGVyYWN0aW9uIHRva2VuICovXHJcbiAgcHVibGljIHJlYWRvbmx5IHRva2VuOiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIFVzZXIgd2hvIHRyaWdnZXJlZCB0aGUgaW50ZXJhY3Rpb24gKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgdXNlcjogVXNlcjtcclxuICBcclxuICAvKiogR3VpbGQgbWVtYmVyIChpZiBpbiBhIGd1aWxkKSAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBtZW1iZXI/OiBHdWlsZE1lbWJlcjtcclxuICBcclxuICAvKiogV2hldGhlciB0aGUgaW50ZXJhY3Rpb24gaGFzIGJlZW4gcmVwbGllZCB0byAqL1xyXG4gIHB1YmxpYyByZXBsaWVkID0gZmFsc2U7XHJcbiAgXHJcbiAgLyoqIFdoZXRoZXIgdGhlIGludGVyYWN0aW9uIGhhcyBiZWVuIGRlZmVycmVkICovXHJcbiAgcHVibGljIGRlZmVycmVkID0gZmFsc2U7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGNsaWVudDogQ2xpZW50LCBkYXRhOiBBUElJbnRlcmFjdGlvbikge1xyXG4gICAgdGhpcy5jbGllbnQgPSBjbGllbnQ7XHJcbiAgICAvLyBIYW5kbGUgYm90aCBzdHJpbmcgYW5kIG51bWJlciBJRHNcclxuICAgIHRoaXMuaWQgPSBTdHJpbmcoZGF0YS5pZCk7XHJcbiAgICB0aGlzLmFwcGxpY2F0aW9uSWQgPSBTdHJpbmcoZGF0YS5hcHBsaWNhdGlvbl9pZCk7XHJcbiAgICB0aGlzLnR5cGUgPSBkYXRhLnR5cGU7XHJcbiAgICB0aGlzLmd1aWxkSWQgPSBkYXRhLmd1aWxkX2lkID8gU3RyaW5nKGRhdGEuZ3VpbGRfaWQpIDogdW5kZWZpbmVkO1xyXG4gICAgdGhpcy5jaGFubmVsSWQgPSBkYXRhLmNoYW5uZWxfaWQgPyBTdHJpbmcoZGF0YS5jaGFubmVsX2lkKSA6IHVuZGVmaW5lZDtcclxuICAgIHRoaXMudG9rZW4gPSBkYXRhLnRva2VuO1xyXG4gICAgXHJcbiAgICAvLyBVc2VyIGNhbiBjb21lIGZyb20gbWVtYmVyLnVzZXIgb3IgZGlyZWN0bHkgZnJvbSB1c2VyXHJcbiAgICBjb25zdCB1c2VyRGF0YSA9IGRhdGEubWVtYmVyPy51c2VyIHx8IGRhdGEudXNlcjtcclxuICAgIHRoaXMudXNlciA9IHVzZXJEYXRhID8gbmV3IFVzZXIodXNlckRhdGEpIDogbmV3IFVzZXIoeyBpZDogJzAnLCB1c2VybmFtZTogJ1Vua25vd24nIH0pO1xyXG4gICAgXHJcbiAgICAvLyBDcmVhdGUgbWVtYmVyIGlmIGluIGd1aWxkXHJcbiAgICBpZiAoZGF0YS5tZW1iZXIgJiYgdGhpcy5ndWlsZElkKSB7XHJcbiAgICAgIGNvbnN0IGd1aWxkID0gY2xpZW50Lmd1aWxkcy5nZXQodGhpcy5ndWlsZElkKTtcclxuICAgICAgaWYgKGd1aWxkKSB7XHJcbiAgICAgICAgdGhpcy5tZW1iZXIgPSBuZXcgR3VpbGRNZW1iZXIoY2xpZW50LCBndWlsZCwgZGF0YS5tZW1iZXIpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIElmIGJhY2tlbmQgZGlkbid0IHNlbmQgdm9pY2Ugc3RhdGUsIHRyeSB0byBmaWxsIGZyb20gY2FjaGVcclxuICAgICAgICBpZiAoIWRhdGEubWVtYmVyLnZvaWNlPy5jaGFubmVsX2lkKSB7XHJcbiAgICAgICAgICBjb25zdCBjYWNoZWRNZW1iZXIgPSBndWlsZC5tZW1iZXJzLmdldCh0aGlzLm1lbWJlci5pZCk7XHJcbiAgICAgICAgICBpZiAoY2FjaGVkTWVtYmVyPy52b2ljZT8uY2hhbm5lbElkKSB7XHJcbiAgICAgICAgICAgIHRoaXMubWVtYmVyLnZvaWNlID0geyAuLi5jYWNoZWRNZW1iZXIudm9pY2UgfTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgLy8gR3VpbGQgbm90IGluIGNhY2hlIOKAlCBjcmVhdGUgbWVtYmVyIHdpdGggYSBtaW5pbWFsIGd1aWxkIHN0dWJcclxuICAgICAgICBjb25zdCBzdHViR3VpbGQgPSB7IGlkOiB0aGlzLmd1aWxkSWQsIG93bmVySWQ6IG51bGwsIG1lbWJlcnM6IG5ldyBDb2xsZWN0aW9uKCksIGNoYW5uZWxzOiBuZXcgQ29sbGVjdGlvbigpIH0gYXMgYW55O1xyXG4gICAgICAgIHRoaXMubWVtYmVyID0gbmV3IEd1aWxkTWVtYmVyKGNsaWVudCwgc3R1Ykd1aWxkLCBkYXRhLm1lbWJlcik7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFRoZSBndWlsZCB0aGlzIGludGVyYWN0aW9uIHdhcyBzZW50IGluIChpZiBpbiBhIGd1aWxkKVxyXG4gICAqIERpc2NvcmQuanMgY29tcGF0aWJsZTogaW50ZXJhY3Rpb24uZ3VpbGRcclxuICAgKi9cclxuICBnZXQgZ3VpbGQoKSB7XHJcbiAgICBpZiAoIXRoaXMuZ3VpbGRJZCkgcmV0dXJuIG51bGw7XHJcbiAgICByZXR1cm4gdGhpcy5jbGllbnQuZ3VpbGRzLmdldCh0aGlzLmd1aWxkSWQpID8/IG51bGw7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDaGVjayBpZiB0aGlzIGlzIGEgY29tbWFuZCBpbnRlcmFjdGlvblxyXG4gICAqL1xyXG4gIGlzQ29tbWFuZCgpOiB0aGlzIGlzIENvbW1hbmRJbnRlcmFjdGlvbiB7XHJcbiAgICByZXR1cm4gdGhpcy50eXBlID09PSBJbnRlcmFjdGlvblR5cGUuQXBwbGljYXRpb25Db21tYW5kO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2hlY2sgaWYgdGhpcyBpcyBhbiBhdXRvY29tcGxldGUgaW50ZXJhY3Rpb25cclxuICAgKi9cclxuICBpc0F1dG9jb21wbGV0ZSgpOiB0aGlzIGlzIEF1dG9jb21wbGV0ZUludGVyYWN0aW9uIHtcclxuICAgIHJldHVybiB0aGlzLnR5cGUgPT09IEludGVyYWN0aW9uVHlwZS5BcHBsaWNhdGlvbkNvbW1hbmRBdXRvY29tcGxldGU7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDaGVjayBpZiB0aGlzIGlzIGEgbW9kYWwgc3VibWl0IGludGVyYWN0aW9uXHJcbiAgICovXHJcbiAgaXNNb2RhbFN1Ym1pdCgpOiB0aGlzIGlzIE1vZGFsU3VibWl0SW50ZXJhY3Rpb24ge1xyXG4gICAgcmV0dXJuIHRoaXMudHlwZSA9PT0gSW50ZXJhY3Rpb25UeXBlLk1vZGFsU3VibWl0O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2hlY2sgaWYgdGhpcyBpcyBhIGJ1dHRvbiBpbnRlcmFjdGlvblxyXG4gICAqL1xyXG4gIGlzQnV0dG9uKCk6IHRoaXMgaXMgQnV0dG9uSW50ZXJhY3Rpb24ge1xyXG4gICAgcmV0dXJuIHRoaXMudHlwZSA9PT0gSW50ZXJhY3Rpb25UeXBlLk1lc3NhZ2VDb21wb25lbnQgJiYgKHRoaXMgYXMgYW55KS5jb21wb25lbnRUeXBlID09PSAyO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2hlY2sgaWYgdGhpcyBpcyBhIHNlbGVjdCBtZW51IGludGVyYWN0aW9uXHJcbiAgICovXHJcbiAgaXNTZWxlY3RNZW51KCk6IHRoaXMgaXMgU2VsZWN0TWVudUludGVyYWN0aW9uIHtcclxuICAgIHJldHVybiB0aGlzLnR5cGUgPT09IEludGVyYWN0aW9uVHlwZS5NZXNzYWdlQ29tcG9uZW50ICYmICh0aGlzIGFzIGFueSkuY29tcG9uZW50VHlwZSA9PT0gMztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEFsaWFzIGZvciBpc1NlbGVjdE1lbnUgKERpc2NvcmQuanMgY29tcGF0aWJpbGl0eSlcclxuICAgKi9cclxuICBpc1N0cmluZ1NlbGVjdE1lbnUoKTogdGhpcyBpcyBTZWxlY3RNZW51SW50ZXJhY3Rpb24ge1xyXG4gICAgcmV0dXJuIHRoaXMuaXNTZWxlY3RNZW51KCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZXBseSB0byB0aGUgaW50ZXJhY3Rpb25cclxuICAgKi9cclxuICBhc3luYyByZXBseShvcHRpb25zOiBzdHJpbmcgfCBJbnRlcmFjdGlvblJlcGx5T3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgaWYgKHRoaXMucmVwbGllZCB8fCB0aGlzLmRlZmVycmVkKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW50ZXJhY3Rpb24gaGFzIGFscmVhZHkgYmVlbiByZXBsaWVkIHRvIG9yIGRlZmVycmVkJyk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGNvbnN0IGNvbnRlbnQgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyBvcHRpb25zIDogb3B0aW9ucy5jb250ZW50O1xyXG4gICAgY29uc3QgcmF3RW1iZWRzID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gdW5kZWZpbmVkIDogb3B0aW9ucy5lbWJlZHM7XHJcbiAgICBjb25zdCByYXdDb21wb25lbnRzID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gdW5kZWZpbmVkIDogb3B0aW9ucy5jb21wb25lbnRzO1xyXG4gICAgY29uc3QgZXBoZW1lcmFsID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gZmFsc2UgOiBvcHRpb25zLmVwaGVtZXJhbDtcclxuICAgIFxyXG4gICAgLy8gQ29udmVydCBFbWJlZEJ1aWxkZXIgaW5zdGFuY2VzIHRvIHBsYWluIG9iamVjdHNcclxuICAgIGNvbnN0IGVtYmVkcyA9IHJhd0VtYmVkcz8ubWFwKGUgPT4gZSBpbnN0YW5jZW9mIEVtYmVkQnVpbGRlciA/IGUudG9KU09OKCkgOiBlKTtcclxuICAgIC8vIENvbnZlcnQgQWN0aW9uUm93QnVpbGRlci9CdXR0b25CdWlsZGVyIGluc3RhbmNlcyB0byBwbGFpbiBvYmplY3RzXHJcbiAgICBjb25zdCBjb21wb25lbnRzID0gc2VyaWFsaXplQ29tcG9uZW50cyhyYXdDb21wb25lbnRzKTtcclxuICAgIFxyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5jcmVhdGVJbnRlcmFjdGlvblJlc3BvbnNlKHRoaXMuaWQsIHRoaXMudG9rZW4sIHtcclxuICAgICAgdHlwZTogSW50ZXJhY3Rpb25SZXNwb25zZVR5cGUuQ2hhbm5lbE1lc3NhZ2VXaXRoU291cmNlLFxyXG4gICAgICBkYXRhOiB7XHJcbiAgICAgICAgY29udGVudCxcclxuICAgICAgICBlbWJlZHMsXHJcbiAgICAgICAgY29tcG9uZW50cyxcclxuICAgICAgICBmbGFnczogZXBoZW1lcmFsID8gTWVzc2FnZUZsYWdzLkVwaGVtZXJhbCA6IDBcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIHRoaXMucmVwbGllZCA9IHRydWU7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZWZlciB0aGUgcmVwbHkgKHNob3dzIFwidGhpbmtpbmcuLi5cIilcclxuICAgKi9cclxuICBhc3luYyBkZWZlclJlcGx5KG9wdGlvbnM/OiB7IGVwaGVtZXJhbD86IGJvb2xlYW4gfSk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgaWYgKHRoaXMucmVwbGllZCB8fCB0aGlzLmRlZmVycmVkKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW50ZXJhY3Rpb24gaGFzIGFscmVhZHkgYmVlbiByZXBsaWVkIHRvIG9yIGRlZmVycmVkJyk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGF3YWl0IHRoaXMuY2xpZW50LnJlc3QuY3JlYXRlSW50ZXJhY3Rpb25SZXNwb25zZSh0aGlzLmlkLCB0aGlzLnRva2VuLCB7XHJcbiAgICAgIHR5cGU6IEludGVyYWN0aW9uUmVzcG9uc2VUeXBlLkRlZmVycmVkQ2hhbm5lbE1lc3NhZ2VXaXRoU291cmNlLFxyXG4gICAgICBkYXRhOiBvcHRpb25zPy5lcGhlbWVyYWwgPyB7IGZsYWdzOiBNZXNzYWdlRmxhZ3MuRXBoZW1lcmFsIH0gOiB1bmRlZmluZWRcclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICB0aGlzLmRlZmVycmVkID0gdHJ1ZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEVkaXQgdGhlIHJlcGx5XHJcbiAgICovXHJcbiAgYXN5bmMgZWRpdFJlcGx5KG9wdGlvbnM6IHN0cmluZyB8IEludGVyYWN0aW9uUmVwbHlPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBjb250ZW50ID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gb3B0aW9ucyA6IG9wdGlvbnMuY29udGVudDtcclxuICAgIGNvbnN0IHJhd0VtYmVkcyA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IHVuZGVmaW5lZCA6IG9wdGlvbnMuZW1iZWRzO1xyXG4gICAgY29uc3QgcmF3Q29tcG9uZW50cyA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IHVuZGVmaW5lZCA6IG9wdGlvbnMuY29tcG9uZW50cztcclxuICAgIGNvbnN0IGZpbGVzID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gdW5kZWZpbmVkIDogb3B0aW9ucy5maWxlcztcclxuICAgIFxyXG4gICAgLy8gQ29udmVydCBFbWJlZEJ1aWxkZXIgaW5zdGFuY2VzIHRvIHBsYWluIG9iamVjdHNcclxuICAgIGNvbnN0IGVtYmVkcyA9IHJhd0VtYmVkcz8ubWFwKGUgPT4gZSBpbnN0YW5jZW9mIEVtYmVkQnVpbGRlciA/IGUudG9KU09OKCkgOiBlKTtcclxuICAgIC8vIENvbnZlcnQgQWN0aW9uUm93QnVpbGRlci9CdXR0b25CdWlsZGVyIGluc3RhbmNlcyB0byBwbGFpbiBvYmplY3RzXHJcbiAgICBjb25zdCBjb21wb25lbnRzID0gc2VyaWFsaXplQ29tcG9uZW50cyhyYXdDb21wb25lbnRzKTtcclxuICAgIFxyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5lZGl0SW50ZXJhY3Rpb25SZXNwb25zZSh0aGlzLnRva2VuLCB7XHJcbiAgICAgIGNvbnRlbnQsXHJcbiAgICAgIGVtYmVkcyxcclxuICAgICAgY29tcG9uZW50cyxcclxuICAgICAgZmlsZXNcclxuICAgIH0sIHRoaXMuZ3VpbGRJZCwgdGhpcy5jaGFubmVsSWQsIHRoaXMuaWQpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVsZXRlIHRoZSByZXBseVxyXG4gICAqL1xyXG4gIGFzeW5jIGRlbGV0ZVJlcGx5KCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5kZWxldGVJbnRlcmFjdGlvblJlc3BvbnNlKHRoaXMudG9rZW4pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2VuZCBhIGZvbGxvd3VwIG1lc3NhZ2VcclxuICAgKi9cclxuICBhc3luYyBmb2xsb3dVcChvcHRpb25zOiBzdHJpbmcgfCBJbnRlcmFjdGlvblJlcGx5T3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgY29udGVudCA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IG9wdGlvbnMgOiBvcHRpb25zLmNvbnRlbnQ7XHJcbiAgICBjb25zdCByYXdFbWJlZHMgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyB1bmRlZmluZWQgOiBvcHRpb25zLmVtYmVkcztcclxuICAgIGNvbnN0IGVwaGVtZXJhbCA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IGZhbHNlIDogb3B0aW9ucy5lcGhlbWVyYWw7XHJcbiAgICBcclxuICAgIC8vIENvbnZlcnQgRW1iZWRCdWlsZGVyIGluc3RhbmNlcyB0byBwbGFpbiBvYmplY3RzXHJcbiAgICBjb25zdCBlbWJlZHMgPSByYXdFbWJlZHM/Lm1hcChlID0+IGUgaW5zdGFuY2VvZiBFbWJlZEJ1aWxkZXIgPyBlLnRvSlNPTigpIDogZSk7XHJcbiAgICBcclxuICAgIGF3YWl0IHRoaXMuY2xpZW50LnJlc3QuY3JlYXRlRm9sbG93dXAodGhpcy50b2tlbiwge1xyXG4gICAgICBjb250ZW50LFxyXG4gICAgICBlbWJlZHMsXHJcbiAgICAgIGZsYWdzOiBlcGhlbWVyYWwgPyBNZXNzYWdlRmxhZ3MuRXBoZW1lcmFsIDogMFxyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogQ29tbWFuZCBpbnRlcmFjdGlvblxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIENvbW1hbmRJbnRlcmFjdGlvbiBleHRlbmRzIEludGVyYWN0aW9uIHtcclxuICAvKiogQ29tbWFuZCBuYW1lICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGNvbW1hbmROYW1lOiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIENvbW1hbmQgb3B0aW9ucyAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBvcHRpb25zOiBDb21tYW5kSW50ZXJhY3Rpb25PcHRpb25zO1xyXG5cclxuICBjb25zdHJ1Y3RvcihjbGllbnQ6IENsaWVudCwgZGF0YTogQVBJSW50ZXJhY3Rpb24pIHtcclxuICAgIHN1cGVyKGNsaWVudCwgZGF0YSk7XHJcbiAgICB0aGlzLmNvbW1hbmROYW1lID0gZGF0YS5kYXRhPy5uYW1lIHx8ICcnO1xyXG4gICAgdGhpcy5vcHRpb25zID0gbmV3IENvbW1hbmRJbnRlcmFjdGlvbk9wdGlvbnMoZGF0YS5kYXRhPy5vcHRpb25zIHx8IFtdLCBkYXRhLmRhdGE/LnJlc29sdmVkKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNob3cgYSBtb2RhbFxyXG4gICAqL1xyXG4gIGFzeW5jIHNob3dNb2RhbChtb2RhbDogTW9kYWxEYXRhIHwgeyB0b0pTT04oKTogTW9kYWxEYXRhIH0pOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IG1vZGFsRGF0YSA9ICd0b0pTT04nIGluIG1vZGFsICYmIHR5cGVvZiBtb2RhbC50b0pTT04gPT09ICdmdW5jdGlvbicgPyBtb2RhbC50b0pTT04oKSA6IG1vZGFsO1xyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5jcmVhdGVJbnRlcmFjdGlvblJlc3BvbnNlKHRoaXMuaWQsIHRoaXMudG9rZW4sIHtcclxuICAgICAgdHlwZTogSW50ZXJhY3Rpb25SZXNwb25zZVR5cGUuTW9kYWwsXHJcbiAgICAgIGRhdGE6IG1vZGFsRGF0YVxyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogQ29tbWFuZCBpbnRlcmFjdGlvbiBvcHRpb25zIGhlbHBlclxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIENvbW1hbmRJbnRlcmFjdGlvbk9wdGlvbnMge1xyXG4gIHByaXZhdGUgb3B0aW9uczogQVBJSW50ZXJhY3Rpb25PcHRpb25bXTtcclxuICBwcml2YXRlIHJlc29sdmVkPzogQVBJSW50ZXJhY3Rpb25SZXNvbHZlZDtcclxuXHJcbiAgLyoqIFBhdHRlcm5zIHRoYXQgaW5kaWNhdGUgY29kZSBpbmplY3Rpb24gYXR0ZW1wdHMgKi9cclxuICBwcml2YXRlIHN0YXRpYyByZWFkb25seSBEQU5HRVJPVVNfUEFUVEVSTlMgPSBbXHJcbiAgICAncmVxdWlyZSgnLCAnaW1wb3J0KCcsICdjaGlsZF9wcm9jZXNzJywgJ2V2YWwoJywgJ0Z1bmN0aW9uKCcsXHJcbiAgICAnZXhlYygnLCAnc3Bhd24oJywgJ2V4ZWNTeW5jKCcsICdzcGF3blN5bmMoJywgJ19fcHJvdG9fXycsXHJcbiAgICAnY29uc3RydWN0b3JbJywgJ3Byb2Nlc3MuZW52JywgJ3Byb2Nlc3MuZXhpdCcsXHJcbiAgICAnZnMucmVhZCcsICdmcy53cml0ZScsICdmcy51bmxpbmsnLFxyXG4gICAgJ29zLmV4ZWMnLCAnb3Muc3lzdGVtJywgJ3N1YnByb2Nlc3MnLCAnUnVudGltZS5nZXRSdW50aW1lJyxcclxuICBdO1xyXG5cclxuICAvKiogU2FuaXRpemUgYSBzdHJpbmcgdmFsdWUgYnkgcmVqZWN0aW5nIGRhbmdlcm91cyBwYXR0ZXJucyAqL1xyXG4gIHByaXZhdGUgc3RhdGljIHNhbml0aXplKHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgY29uc3QgbG93ZXIgPSB2YWx1ZS50b0xvd2VyQ2FzZSgpO1xyXG4gICAgZm9yIChjb25zdCBwYXR0ZXJuIG9mIENvbW1hbmRJbnRlcmFjdGlvbk9wdGlvbnMuREFOR0VST1VTX1BBVFRFUk5TKSB7XHJcbiAgICAgIGlmIChsb3dlci5pbmNsdWRlcyhwYXR0ZXJuLnRvTG93ZXJDYXNlKCkpKSB7XHJcbiAgICAgICAgcmV0dXJuICcnO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdmFsdWU7XHJcbiAgfVxyXG5cclxuICBjb25zdHJ1Y3RvcihvcHRpb25zOiBBUElJbnRlcmFjdGlvbk9wdGlvbltdLCByZXNvbHZlZD86IEFQSUludGVyYWN0aW9uUmVzb2x2ZWQpIHtcclxuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XHJcbiAgICB0aGlzLnJlc29sdmVkID0gcmVzb2x2ZWQ7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSBzdHJpbmcgb3B0aW9uIChzYW5pdGl6ZWQgYWdhaW5zdCBjb2RlIGluamVjdGlvbilcclxuICAgKi9cclxuICBnZXRTdHJpbmcobmFtZTogc3RyaW5nLCByZXF1aXJlZD86IGJvb2xlYW4pOiBzdHJpbmcgfCBudWxsIHtcclxuICAgIGNvbnN0IG9wdGlvbiA9IHRoaXMub3B0aW9ucy5maW5kKG8gPT4gby5uYW1lID09PSBuYW1lKTtcclxuICAgIGlmICghb3B0aW9uICYmIHJlcXVpcmVkKSB0aHJvdyBuZXcgRXJyb3IoYFJlcXVpcmVkIG9wdGlvbiBcIiR7bmFtZX1cIiBub3QgZm91bmRgKTtcclxuICAgIGNvbnN0IHJhdyA9IG9wdGlvbj8udmFsdWUgYXMgc3RyaW5nIHx8IG51bGw7XHJcbiAgICByZXR1cm4gcmF3ID8gQ29tbWFuZEludGVyYWN0aW9uT3B0aW9ucy5zYW5pdGl6ZShyYXcpIDogbnVsbDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhbiBpbnRlZ2VyIG9wdGlvblxyXG4gICAqL1xyXG4gIGdldEludGVnZXIobmFtZTogc3RyaW5nLCByZXF1aXJlZD86IGJvb2xlYW4pOiBudW1iZXIgfCBudWxsIHtcclxuICAgIGNvbnN0IG9wdGlvbiA9IHRoaXMub3B0aW9ucy5maW5kKG8gPT4gby5uYW1lID09PSBuYW1lKTtcclxuICAgIGlmICghb3B0aW9uICYmIHJlcXVpcmVkKSB0aHJvdyBuZXcgRXJyb3IoYFJlcXVpcmVkIG9wdGlvbiBcIiR7bmFtZX1cIiBub3QgZm91bmRgKTtcclxuICAgIHJldHVybiBvcHRpb24/LnZhbHVlIGFzIG51bWJlciB8fCBudWxsO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGEgbnVtYmVyIG9wdGlvblxyXG4gICAqL1xyXG4gIGdldE51bWJlcihuYW1lOiBzdHJpbmcsIHJlcXVpcmVkPzogYm9vbGVhbik6IG51bWJlciB8IG51bGwge1xyXG4gICAgcmV0dXJuIHRoaXMuZ2V0SW50ZWdlcihuYW1lLCByZXF1aXJlZCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSBib29sZWFuIG9wdGlvblxyXG4gICAqL1xyXG4gIGdldEJvb2xlYW4obmFtZTogc3RyaW5nLCByZXF1aXJlZD86IGJvb2xlYW4pOiBib29sZWFuIHwgbnVsbCB7XHJcbiAgICBjb25zdCBvcHRpb24gPSB0aGlzLm9wdGlvbnMuZmluZChvID0+IG8ubmFtZSA9PT0gbmFtZSk7XHJcbiAgICBpZiAoIW9wdGlvbiAmJiByZXF1aXJlZCkgdGhyb3cgbmV3IEVycm9yKGBSZXF1aXJlZCBvcHRpb24gXCIke25hbWV9XCIgbm90IGZvdW5kYCk7XHJcbiAgICByZXR1cm4gb3B0aW9uPy52YWx1ZSBhcyBib29sZWFuID8/IG51bGw7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSB1c2VyIG9wdGlvbiDigJQgcmV0dXJucyByZXNvbHZlZCBVc2VyIG9iamVjdCBpZiBhdmFpbGFibGVcclxuICAgKiBGYWxscyBiYWNrIHRvIHBhcnNpbmcgbWVudGlvbiBmb3JtYXQgKDxASUQ+KSBhbmQgcmVzb2x2aW5nIGZyb20gcmVzb2x2ZWQgZGF0YVxyXG4gICAqL1xyXG4gIGdldFVzZXIobmFtZTogc3RyaW5nLCByZXF1aXJlZD86IGJvb2xlYW4pOiBVc2VyIHwgbnVsbCB7XHJcbiAgICBjb25zdCBvcHRpb24gPSB0aGlzLm9wdGlvbnMuZmluZChvID0+IG8ubmFtZSA9PT0gbmFtZSk7XHJcbiAgICBpZiAoIW9wdGlvbiAmJiByZXF1aXJlZCkgdGhyb3cgbmV3IEVycm9yKGBSZXF1aXJlZCBvcHRpb24gXCIke25hbWV9XCIgbm90IGZvdW5kYCk7XHJcbiAgICBpZiAoIW9wdGlvbikgcmV0dXJuIG51bGw7XHJcblxyXG4gICAgY29uc3QgcmF3VmFsdWUgPSBTdHJpbmcob3B0aW9uLnZhbHVlIHx8ICcnKTtcclxuXHJcbiAgICAvLyBFeHRyYWN0IHVzZXIgSUQg4oCUIGNvdWxkIGJlIFwiMTIzXCIsIFwiPEAxMjM+XCIsIG9yIFwiPEAhMTIzPlwiXHJcbiAgICBjb25zdCBtYXRjaCA9IHJhd1ZhbHVlLm1hdGNoKC9ePD9APyE/KFxcZCspPj8kLyk7XHJcbiAgICBjb25zdCB1c2VySWQgPSBtYXRjaCA/IG1hdGNoWzFdIDogcmF3VmFsdWU7XHJcblxyXG4gICAgLy8gVHJ5IHRvIHJlc29sdmUgZnJvbSByZXNvbHZlZCBkYXRhXHJcbiAgICBpZiAodGhpcy5yZXNvbHZlZD8udXNlcnMgJiYgdGhpcy5yZXNvbHZlZC51c2Vyc1t1c2VySWRdKSB7XHJcbiAgICAgIHJldHVybiBuZXcgVXNlcih0aGlzLnJlc29sdmVkLnVzZXJzW3VzZXJJZF0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIEZhbGxiYWNrOiByZXR1cm4gYSBtaW5pbWFsIFVzZXIgd2l0aCBqdXN0IHRoZSBJRFxyXG4gICAgaWYgKHVzZXJJZCAmJiAvXlxcZCskLy50ZXN0KHVzZXJJZCkpIHtcclxuICAgICAgcmV0dXJuIG5ldyBVc2VyKHsgaWQ6IHVzZXJJZCwgdXNlcm5hbWU6IGBVc2VyXyR7dXNlcklkfWAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIG51bGw7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgcmF3IHVzZXIgSUQgZnJvbSBhIHVzZXIgb3B0aW9uIChmb3IgY2FzZXMgd2hlcmUgb25seSB0aGUgSUQgaXMgbmVlZGVkKVxyXG4gICAqL1xyXG4gIGdldFVzZXJJZChuYW1lOiBzdHJpbmcsIHJlcXVpcmVkPzogYm9vbGVhbik6IHN0cmluZyB8IG51bGwge1xyXG4gICAgY29uc3Qgb3B0aW9uID0gdGhpcy5vcHRpb25zLmZpbmQobyA9PiBvLm5hbWUgPT09IG5hbWUpO1xyXG4gICAgaWYgKCFvcHRpb24gJiYgcmVxdWlyZWQpIHRocm93IG5ldyBFcnJvcihgUmVxdWlyZWQgb3B0aW9uIFwiJHtuYW1lfVwiIG5vdCBmb3VuZGApO1xyXG4gICAgaWYgKCFvcHRpb24pIHJldHVybiBudWxsO1xyXG5cclxuICAgIGNvbnN0IHJhd1ZhbHVlID0gU3RyaW5nKG9wdGlvbi52YWx1ZSB8fCAnJyk7XHJcbiAgICBjb25zdCBtYXRjaCA9IHJhd1ZhbHVlLm1hdGNoKC9ePD9APyE/KFxcZCspPj8kLyk7XHJcbiAgICByZXR1cm4gbWF0Y2ggPyBtYXRjaFsxXSA6IHJhd1ZhbHVlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGEgY2hhbm5lbCBvcHRpb25cclxuICAgKi9cclxuICBnZXRDaGFubmVsKG5hbWU6IHN0cmluZywgcmVxdWlyZWQ/OiBib29sZWFuKTogc3RyaW5nIHwgbnVsbCB7XHJcbiAgICBjb25zdCBvcHRpb24gPSB0aGlzLm9wdGlvbnMuZmluZChvID0+IG8ubmFtZSA9PT0gbmFtZSk7XHJcbiAgICBpZiAoIW9wdGlvbiAmJiByZXF1aXJlZCkgdGhyb3cgbmV3IEVycm9yKGBSZXF1aXJlZCBvcHRpb24gXCIke25hbWV9XCIgbm90IGZvdW5kYCk7XHJcbiAgICByZXR1cm4gb3B0aW9uPy52YWx1ZSBhcyBzdHJpbmcgfHwgbnVsbDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhIHN1YmNvbW1hbmQgbmFtZVxyXG4gICAqL1xyXG4gIGdldFN1YmNvbW1hbmQocmVxdWlyZWQ/OiBib29sZWFuKTogc3RyaW5nIHwgbnVsbCB7XHJcbiAgICBjb25zdCBvcHRpb24gPSB0aGlzLm9wdGlvbnMuZmluZChvID0+IG8udHlwZSA9PT0gMSk7XHJcbiAgICBpZiAoIW9wdGlvbiAmJiByZXF1aXJlZCkgdGhyb3cgbmV3IEVycm9yKCdSZXF1aXJlZCBzdWJjb21tYW5kIG5vdCBmb3VuZCcpO1xyXG4gICAgcmV0dXJuIG9wdGlvbj8ubmFtZSB8fCBudWxsO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IHRoZSBmb2N1c2VkIG9wdGlvbiAoZm9yIGF1dG9jb21wbGV0ZSlcclxuICAgKi9cclxuICBnZXRGb2N1c2VkKCk6IHsgbmFtZTogc3RyaW5nOyB2YWx1ZTogc3RyaW5nIH0gfCBudWxsIHtcclxuICAgIGNvbnN0IG9wdGlvbiA9IHRoaXMub3B0aW9ucy5maW5kKG8gPT4gby5mb2N1c2VkKTtcclxuICAgIGlmICghb3B0aW9uKSByZXR1cm4gbnVsbDtcclxuICAgIHJldHVybiB7IG5hbWU6IG9wdGlvbi5uYW1lLCB2YWx1ZTogb3B0aW9uLnZhbHVlIGFzIHN0cmluZyB9O1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIEF1dG9jb21wbGV0ZSBpbnRlcmFjdGlvblxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIEF1dG9jb21wbGV0ZUludGVyYWN0aW9uIGV4dGVuZHMgSW50ZXJhY3Rpb24ge1xyXG4gIC8qKiBDb21tYW5kIG5hbWUgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgY29tbWFuZE5hbWU6IHN0cmluZztcclxuICBcclxuICAvKiogQ29tbWFuZCBvcHRpb25zICovXHJcbiAgcHVibGljIHJlYWRvbmx5IG9wdGlvbnM6IENvbW1hbmRJbnRlcmFjdGlvbk9wdGlvbnM7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGNsaWVudDogQ2xpZW50LCBkYXRhOiBBUElJbnRlcmFjdGlvbikge1xyXG4gICAgc3VwZXIoY2xpZW50LCBkYXRhKTtcclxuICAgIHRoaXMuY29tbWFuZE5hbWUgPSBkYXRhLmRhdGE/Lm5hbWUgfHwgJyc7XHJcbiAgICB0aGlzLm9wdGlvbnMgPSBuZXcgQ29tbWFuZEludGVyYWN0aW9uT3B0aW9ucyhkYXRhLmRhdGE/Lm9wdGlvbnMgfHwgW10sIGRhdGEuZGF0YT8ucmVzb2x2ZWQpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVzcG9uZCB3aXRoIGF1dG9jb21wbGV0ZSBjaG9pY2VzXHJcbiAgICovXHJcbiAgYXN5bmMgcmVzcG9uZChjaG9pY2VzOiBBdXRvY29tcGxldGVDaG9pY2VbXSk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5jcmVhdGVJbnRlcmFjdGlvblJlc3BvbnNlKHRoaXMuaWQsIHRoaXMudG9rZW4sIHtcclxuICAgICAgdHlwZTogSW50ZXJhY3Rpb25SZXNwb25zZVR5cGUuQXBwbGljYXRpb25Db21tYW5kQXV0b2NvbXBsZXRlUmVzdWx0LFxyXG4gICAgICBkYXRhOiB7IGNob2ljZXMgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogQnV0dG9uIGludGVyYWN0aW9uXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgQnV0dG9uSW50ZXJhY3Rpb24gZXh0ZW5kcyBJbnRlcmFjdGlvbiB7XHJcbiAgLyoqIEJ1dHRvbiBjdXN0b20gSUQgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgY3VzdG9tSWQ6IHN0cmluZztcclxuICBcclxuICAvKiogQ29tcG9uZW50IHR5cGUgKGFsd2F5cyAyIGZvciBidXR0b25zKSAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBjb21wb25lbnRUeXBlOiBudW1iZXIgPSAyO1xyXG4gIFxyXG4gIC8qKiBNZXNzYWdlIHRoZSBidXR0b24gaXMgYXR0YWNoZWQgdG8gKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgbWVzc2FnZT86IGFueTtcclxuXHJcbiAgY29uc3RydWN0b3IoY2xpZW50OiBDbGllbnQsIGRhdGE6IEFQSUludGVyYWN0aW9uKSB7XHJcbiAgICBzdXBlcihjbGllbnQsIGRhdGEpO1xyXG4gICAgdGhpcy5jdXN0b21JZCA9IGRhdGEuZGF0YT8uY3VzdG9tX2lkIHx8ICcnO1xyXG4gICAgdGhpcy5tZXNzYWdlID0gZGF0YS5tZXNzYWdlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVXBkYXRlIHRoZSBtZXNzYWdlIHRoZSBidXR0b24gaXMgYXR0YWNoZWQgdG9cclxuICAgKi9cclxuICBhc3luYyB1cGRhdGUob3B0aW9uczogSW50ZXJhY3Rpb25SZXBseU9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIC8vIENvbnZlcnQgRW1iZWRCdWlsZGVyIGluc3RhbmNlcyB0byBwbGFpbiBvYmplY3RzXHJcbiAgICBjb25zdCBlbWJlZHMgPSBvcHRpb25zLmVtYmVkcz8ubWFwKGUgPT4gZSBpbnN0YW5jZW9mIEVtYmVkQnVpbGRlciA/IGUudG9KU09OKCkgOiBlKTtcclxuICAgIC8vIENvbnZlcnQgQWN0aW9uUm93QnVpbGRlci9CdXR0b25CdWlsZGVyIGluc3RhbmNlcyB0byBwbGFpbiBvYmplY3RzXHJcbiAgICBjb25zdCBjb21wb25lbnRzID0gc2VyaWFsaXplQ29tcG9uZW50cyhvcHRpb25zLmNvbXBvbmVudHMpO1xyXG4gICAgXHJcbiAgICBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LmNyZWF0ZUludGVyYWN0aW9uUmVzcG9uc2UodGhpcy5pZCwgdGhpcy50b2tlbiwge1xyXG4gICAgICB0eXBlOiBJbnRlcmFjdGlvblJlc3BvbnNlVHlwZS5VcGRhdGVNZXNzYWdlLFxyXG4gICAgICBkYXRhOiB7XHJcbiAgICAgICAgY29udGVudDogb3B0aW9ucy5jb250ZW50LFxyXG4gICAgICAgIGVtYmVkcyxcclxuICAgICAgICBjb21wb25lbnRzXHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgdGhpcy5yZXBsaWVkID0gdHJ1ZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNob3cgYSBtb2RhbCBpbiByZXNwb25zZSB0byB0aGlzIGJ1dHRvbiBpbnRlcmFjdGlvblxyXG4gICAqL1xyXG4gIGFzeW5jIHNob3dNb2RhbChtb2RhbDogTW9kYWxEYXRhIHwgeyB0b0pTT04oKTogTW9kYWxEYXRhIH0pOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IG1vZGFsRGF0YSA9ICd0b0pTT04nIGluIG1vZGFsICYmIHR5cGVvZiBtb2RhbC50b0pTT04gPT09ICdmdW5jdGlvbicgPyBtb2RhbC50b0pTT04oKSA6IG1vZGFsO1xyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5jcmVhdGVJbnRlcmFjdGlvblJlc3BvbnNlKHRoaXMuaWQsIHRoaXMudG9rZW4sIHtcclxuICAgICAgdHlwZTogSW50ZXJhY3Rpb25SZXNwb25zZVR5cGUuTW9kYWwsXHJcbiAgICAgIGRhdGE6IG1vZGFsRGF0YVxyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogU2VsZWN0IG1lbnUgaW50ZXJhY3Rpb25cclxuICovXHJcbmV4cG9ydCBjbGFzcyBTZWxlY3RNZW51SW50ZXJhY3Rpb24gZXh0ZW5kcyBJbnRlcmFjdGlvbiB7XHJcbiAgLyoqIFNlbGVjdCBtZW51IGN1c3RvbSBJRCAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBjdXN0b21JZDogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBDb21wb25lbnQgdHlwZSAoYWx3YXlzIDMgZm9yIHNlbGVjdCBtZW51cykgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgY29tcG9uZW50VHlwZTogbnVtYmVyID0gMztcclxuICBcclxuICAvKiogU2VsZWN0ZWQgdmFsdWVzICovXHJcbiAgcHVibGljIHJlYWRvbmx5IHZhbHVlczogc3RyaW5nW107XHJcbiAgXHJcbiAgLyoqIE1lc3NhZ2UgdGhlIHNlbGVjdCBtZW51IGlzIGF0dGFjaGVkIHRvICovXHJcbiAgcHVibGljIHJlYWRvbmx5IG1lc3NhZ2U/OiBhbnk7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGNsaWVudDogQ2xpZW50LCBkYXRhOiBBUElJbnRlcmFjdGlvbikge1xyXG4gICAgc3VwZXIoY2xpZW50LCBkYXRhKTtcclxuICAgIHRoaXMuY3VzdG9tSWQgPSBkYXRhLmRhdGE/LmN1c3RvbV9pZCB8fCAnJztcclxuICAgIHRoaXMudmFsdWVzID0gZGF0YS5kYXRhPy52YWx1ZXMgfHwgW107XHJcbiAgICB0aGlzLm1lc3NhZ2UgPSBkYXRhLm1lc3NhZ2U7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBVcGRhdGUgdGhlIG1lc3NhZ2UgdGhlIHNlbGVjdCBtZW51IGlzIGF0dGFjaGVkIHRvXHJcbiAgICovXHJcbiAgYXN5bmMgdXBkYXRlKG9wdGlvbnM6IEludGVyYWN0aW9uUmVwbHlPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICAvLyBDb252ZXJ0IEVtYmVkQnVpbGRlciBpbnN0YW5jZXMgdG8gcGxhaW4gb2JqZWN0c1xyXG4gICAgY29uc3QgZW1iZWRzID0gb3B0aW9ucy5lbWJlZHM/Lm1hcChlID0+IGUgaW5zdGFuY2VvZiBFbWJlZEJ1aWxkZXIgPyBlLnRvSlNPTigpIDogZSk7XHJcbiAgICAvLyBDb252ZXJ0IEFjdGlvblJvd0J1aWxkZXIvQnV0dG9uQnVpbGRlciBpbnN0YW5jZXMgdG8gcGxhaW4gb2JqZWN0c1xyXG4gICAgY29uc3QgY29tcG9uZW50cyA9IHNlcmlhbGl6ZUNvbXBvbmVudHMob3B0aW9ucy5jb21wb25lbnRzKTtcclxuICAgIFxyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5jcmVhdGVJbnRlcmFjdGlvblJlc3BvbnNlKHRoaXMuaWQsIHRoaXMudG9rZW4sIHtcclxuICAgICAgdHlwZTogSW50ZXJhY3Rpb25SZXNwb25zZVR5cGUuVXBkYXRlTWVzc2FnZSxcclxuICAgICAgZGF0YToge1xyXG4gICAgICAgIGNvbnRlbnQ6IG9wdGlvbnMuY29udGVudCxcclxuICAgICAgICBlbWJlZHMsXHJcbiAgICAgICAgY29tcG9uZW50c1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICAgIHRoaXMucmVwbGllZCA9IHRydWU7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTaG93IGEgbW9kYWwgaW4gcmVzcG9uc2UgdG8gdGhpcyBzZWxlY3QgbWVudSBpbnRlcmFjdGlvblxyXG4gICAqL1xyXG4gIGFzeW5jIHNob3dNb2RhbChtb2RhbDogTW9kYWxEYXRhIHwgeyB0b0pTT04oKTogTW9kYWxEYXRhIH0pOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IG1vZGFsRGF0YSA9ICd0b0pTT04nIGluIG1vZGFsICYmIHR5cGVvZiBtb2RhbC50b0pTT04gPT09ICdmdW5jdGlvbicgPyBtb2RhbC50b0pTT04oKSA6IG1vZGFsO1xyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5jcmVhdGVJbnRlcmFjdGlvblJlc3BvbnNlKHRoaXMuaWQsIHRoaXMudG9rZW4sIHtcclxuICAgICAgdHlwZTogSW50ZXJhY3Rpb25SZXNwb25zZVR5cGUuTW9kYWwsXHJcbiAgICAgIGRhdGE6IG1vZGFsRGF0YVxyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogTW9kYWwgc3VibWl0IGludGVyYWN0aW9uXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgTW9kYWxTdWJtaXRJbnRlcmFjdGlvbiBleHRlbmRzIEludGVyYWN0aW9uIHtcclxuICAvKiogTW9kYWwgY3VzdG9tIElEICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGN1c3RvbUlkOiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIE1vZGFsIGZpZWxkcyAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBmaWVsZHM6IE1vZGFsRmllbGRzO1xyXG5cclxuICBjb25zdHJ1Y3RvcihjbGllbnQ6IENsaWVudCwgZGF0YTogQVBJSW50ZXJhY3Rpb24pIHtcclxuICAgIHN1cGVyKGNsaWVudCwgZGF0YSk7XHJcbiAgICB0aGlzLmN1c3RvbUlkID0gZGF0YS5kYXRhPy5jdXN0b21faWQgfHwgJyc7XHJcbiAgICAvLyBNb2RhbCB2YWx1ZXMgY29tZSBmcm9tIGNvbXBvbmVudHMgYXJyYXksIG9yIGFzIEpTT04gc3RyaW5nIGluIHZhbHVlc1swXSAoYmFja2VuZCBjb21wYXQpXHJcbiAgICBsZXQgY29tcG9uZW50cyA9IChkYXRhLmRhdGEgYXMgYW55KT8uY29tcG9uZW50cyB8fCBbXTtcclxuICAgIGlmIChjb21wb25lbnRzLmxlbmd0aCA9PT0gMCAmJiAoZGF0YS5kYXRhIGFzIGFueSk/LnZhbHVlcz8ubGVuZ3RoID4gMCkge1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGNvbnN0IHBhcnNlZCA9IEpTT04ucGFyc2UoKGRhdGEuZGF0YSBhcyBhbnkpLnZhbHVlc1swXSk7XHJcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkocGFyc2VkKSkgY29tcG9uZW50cyA9IHBhcnNlZDtcclxuICAgICAgfSBjYXRjaCB7fVxyXG4gICAgfVxyXG4gICAgdGhpcy5maWVsZHMgPSBuZXcgTW9kYWxGaWVsZHMoY29tcG9uZW50cyk7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogTW9kYWwgZmllbGRzIGhlbHBlclxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIE1vZGFsRmllbGRzIHtcclxuICBwcml2YXRlIGZpZWxkTWFwOiBNYXA8c3RyaW5nLCBzdHJpbmc+O1xyXG5cclxuICBjb25zdHJ1Y3Rvcihjb21wb25lbnRzOiBhbnlbXSkge1xyXG4gICAgdGhpcy5maWVsZE1hcCA9IG5ldyBNYXAoKTtcclxuICAgIC8vIFBhcnNlIGFjdGlvbiByb3dzIOKGkiB0ZXh0IGlucHV0c1xyXG4gICAgZm9yIChjb25zdCByb3cgb2YgY29tcG9uZW50cykge1xyXG4gICAgICBjb25zdCBpbm5lckNvbXBvbmVudHMgPSByb3c/LmNvbXBvbmVudHMgfHwgW107XHJcbiAgICAgIGZvciAoY29uc3QgY29tcCBvZiBpbm5lckNvbXBvbmVudHMpIHtcclxuICAgICAgICBpZiAoY29tcC5jdXN0b21faWQgJiYgY29tcC52YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICB0aGlzLmZpZWxkTWFwLnNldChjb21wLmN1c3RvbV9pZCwgY29tcC52YWx1ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSB0ZXh0IGlucHV0IHZhbHVlIGJ5IGN1c3RvbV9pZFxyXG4gICAqL1xyXG4gIGdldFRleHRJbnB1dFZhbHVlKGN1c3RvbUlkOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcclxuICAgIHJldHVybiB0aGlzLmZpZWxkTWFwLmdldChjdXN0b21JZCkgPz8gbnVsbDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhIGZpZWxkIChhbGlhcyBmb3IgZ2V0VGV4dElucHV0VmFsdWUpXHJcbiAgICovXHJcbiAgZ2V0RmllbGQoY3VzdG9tSWQ6IHN0cmluZyk6IHsgdmFsdWU6IHN0cmluZyB9IHwgbnVsbCB7XHJcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMuZmllbGRNYXAuZ2V0KGN1c3RvbUlkKTtcclxuICAgIHJldHVybiB2YWx1ZSAhPT0gdW5kZWZpbmVkID8geyB2YWx1ZSB9IDogbnVsbDtcclxuICB9XHJcbn1cclxuXHJcbi8vIFR5cGVzXHJcbmV4cG9ydCBpbnRlcmZhY2UgSW50ZXJhY3Rpb25SZXBseU9wdGlvbnMge1xyXG4gIGNvbnRlbnQ/OiBzdHJpbmc7XHJcbiAgZW1iZWRzPzogKEFQSUVtYmVkIHwgRW1iZWRCdWlsZGVyKVtdO1xyXG4gIGNvbXBvbmVudHM/OiBhbnlbXTtcclxuICBlcGhlbWVyYWw/OiBib29sZWFuO1xyXG4gIGZpbGVzPzogQXJyYXk8eyBuYW1lOiBzdHJpbmc7IGRhdGE6IEJ1ZmZlcjsgY29udGVudFR5cGU/OiBzdHJpbmcgfT47XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgQXV0b2NvbXBsZXRlQ2hvaWNlIHtcclxuICBuYW1lOiBzdHJpbmc7XHJcbiAgdmFsdWU6IHN0cmluZyB8IG51bWJlcjtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBNb2RhbERhdGEge1xyXG4gIGN1c3RvbV9pZDogc3RyaW5nO1xyXG4gIHRpdGxlOiBzdHJpbmc7XHJcbiAgY29tcG9uZW50czogYW55W107XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDcmVhdGUgYXBwcm9wcmlhdGUgaW50ZXJhY3Rpb24gY2xhc3MgYmFzZWQgb24gdHlwZVxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUludGVyYWN0aW9uKGNsaWVudDogQ2xpZW50LCBkYXRhOiBBUElJbnRlcmFjdGlvbik6IEludGVyYWN0aW9uIHtcclxuICBzd2l0Y2ggKGRhdGEudHlwZSkge1xyXG4gICAgY2FzZSBJbnRlcmFjdGlvblR5cGUuQXBwbGljYXRpb25Db21tYW5kOlxyXG4gICAgICByZXR1cm4gbmV3IENvbW1hbmRJbnRlcmFjdGlvbihjbGllbnQsIGRhdGEpO1xyXG4gICAgY2FzZSBJbnRlcmFjdGlvblR5cGUuQXBwbGljYXRpb25Db21tYW5kQXV0b2NvbXBsZXRlOlxyXG4gICAgICByZXR1cm4gbmV3IEF1dG9jb21wbGV0ZUludGVyYWN0aW9uKGNsaWVudCwgZGF0YSk7XHJcbiAgICBjYXNlIEludGVyYWN0aW9uVHlwZS5Nb2RhbFN1Ym1pdDpcclxuICAgICAgcmV0dXJuIG5ldyBNb2RhbFN1Ym1pdEludGVyYWN0aW9uKGNsaWVudCwgZGF0YSk7XHJcbiAgICBjYXNlIEludGVyYWN0aW9uVHlwZS5NZXNzYWdlQ29tcG9uZW50OlxyXG4gICAgICAvLyBjb21wb25lbnRfdHlwZTogMiA9IEJ1dHRvbiwgMyA9IFNlbGVjdCBNZW51XHJcbiAgICAgIGlmIChkYXRhLmRhdGE/LmNvbXBvbmVudF90eXBlID09PSAyKSB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBCdXR0b25JbnRlcmFjdGlvbihjbGllbnQsIGRhdGEpO1xyXG4gICAgICB9IGVsc2UgaWYgKGRhdGEuZGF0YT8uY29tcG9uZW50X3R5cGUgPT09IDMpIHtcclxuICAgICAgICByZXR1cm4gbmV3IFNlbGVjdE1lbnVJbnRlcmFjdGlvbihjbGllbnQsIGRhdGEpO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBuZXcgSW50ZXJhY3Rpb24oY2xpZW50LCBkYXRhKTtcclxuICAgIGRlZmF1bHQ6XHJcbiAgICAgIHJldHVybiBuZXcgSW50ZXJhY3Rpb24oY2xpZW50LCBkYXRhKTtcclxuICB9XHJcbn1cclxuIl19