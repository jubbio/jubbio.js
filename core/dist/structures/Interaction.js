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
    /** Whether the initial reply is private. Follow-ups have independent visibility. */
    ephemeral = null;
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
        return this.type === enums_1.InteractionType.MessageComponent && [3, 5, 6, 7, 8].includes(this.componentType);
    }
    /**
     * Check specifically for a string select menu (component type 3)
     */
    isStringSelectMenu() {
        return this.type === enums_1.InteractionType.MessageComponent && this.componentType === 3;
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
                flags: (typeof options === 'string' ? 0 : options.flags ?? 0) | (ephemeral ? enums_1.MessageFlags.Ephemeral : 0)
            }
        });
        this.replied = true;
        this.ephemeral = !!((typeof options === 'string' ? 0 : options.flags ?? 0) & enums_1.MessageFlags.Ephemeral) || !!ephemeral;
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
        this.ephemeral = options?.ephemeral ?? false;
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
            files,
            flags: this.ephemeral ? ((typeof options === 'string' ? 0 : options.flags ?? 0) | enums_1.MessageFlags.Ephemeral) : (typeof options === 'string' ? undefined : options.flags)
        }, this.ephemeral ? undefined : this.guildId, this.ephemeral ? undefined : this.channelId, this.ephemeral ? undefined : this.id);
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
        const components = (0, serialize_1.serializeComponents)(rawComponents);
        await this.client.rest.createFollowup(this.token, {
            content,
            embeds,
            components,
            flags: (typeof options === 'string' ? 0 : options.flags ?? 0) | (ephemeral ? enums_1.MessageFlags.Ephemeral : 0),
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
/** Shared acknowledgement methods for interactions tied to a message. */
class MessageComponentInteraction extends Interaction {
    messageAcknowledged = false;
    message;
    constructor(client, data) {
        super(client, data);
        if (data.message) {
            this.message = new Message_1.Message(client, { ...data.message, guild_id: data.guild_id, channel_id: data.channel_id ?? data.message.channel_id });
        }
    }
    assertCanUpdate() {
        if (this.replied || this.deferred) {
            throw new Error('Interaction has already been replied to or deferred');
        }
        if (this.isModalSubmit() && !this.message) {
            throw new Error('Only a modal opened from a message can update that message');
        }
    }
    /** Update the message that triggered this interaction. */
    async update(options) {
        this.assertCanUpdate();
        const data = typeof options === 'string' ? { content: options } : options;
        await this.client.rest.createInteractionResponse(this.id, this.token, {
            type: enums_1.InteractionResponseType.UpdateMessage,
            data: {
                flags: data.flags,
                content: data.content,
                embeds: data.embeds?.map(e => e instanceof EmbedBuilder_1.EmbedBuilder ? e.toJSON() : e),
                components: (0, serialize_1.serializeComponents)(data.components)
            }
        });
        this.replied = true;
        this.messageAcknowledged = true;
    }
    /** Edit the source message after update/deferUpdate, or the reply after reply/deferReply. */
    async editReply(options) {
        if (!this.messageAcknowledged)
            return super.editReply(options);
        const data = typeof options === 'string' ? { content: options } : options;
        await this.client.rest.editInteractionResponse(this.token, {
            flags: data.flags,
            content: data.content,
            embeds: data.embeds?.map(e => e instanceof EmbedBuilder_1.EmbedBuilder ? e.toJSON() : e),
            components: (0, serialize_1.serializeComponents)(data.components),
            files: data.files
        });
    }
    /** Acknowledge without showing a thinking message; editReply can update later. */
    async deferUpdate() {
        this.assertCanUpdate();
        await this.client.rest.createInteractionResponse(this.id, this.token, {
            type: enums_1.InteractionResponseType.DeferredUpdateMessage
        });
        this.deferred = true;
        this.messageAcknowledged = true;
    }
}
/** Button interaction. */
class ButtonInteraction extends MessageComponentInteraction {
    /** Button custom ID */
    customId;
    /** Component type (always 2 for buttons) */
    componentType = 2;
    constructor(client, data) {
        super(client, data);
        this.customId = data.data?.custom_id || '';
    }
    /**
     * Show a modal in response to this button interaction
     */
    async showModal(modal) {
        if (this.replied || this.deferred)
            throw new Error('Interaction has already been replied to or deferred');
        const modalData = 'toJSON' in modal && typeof modal.toJSON === 'function' ? modal.toJSON() : modal;
        await this.client.rest.createInteractionResponse(this.id, this.token, {
            type: enums_1.InteractionResponseType.Modal,
            data: modalData
        });
        this.replied = true;
    }
}
exports.ButtonInteraction = ButtonInteraction;
/**
 * Select menu interaction
 */
class SelectMenuInteraction extends MessageComponentInteraction {
    /** Select menu custom ID */
    customId;
    /** Select component type (3, 5, 6, 7 or 8) */
    componentType;
    /** Selected values */
    values;
    constructor(client, data) {
        super(client, data);
        this.componentType = data.data?.component_type ?? 3;
        this.customId = data.data?.custom_id || '';
        this.values = data.data?.values || [];
    }
    /**
     * Show a modal in response to this select menu interaction
     */
    async showModal(modal) {
        if (this.replied || this.deferred)
            throw new Error('Interaction has already been replied to or deferred');
        const modalData = 'toJSON' in modal && typeof modal.toJSON === 'function' ? modal.toJSON() : modal;
        await this.client.rest.createInteractionResponse(this.id, this.token, {
            type: enums_1.InteractionResponseType.Modal,
            data: modalData
        });
        this.replied = true;
    }
}
exports.SelectMenuInteraction = SelectMenuInteraction;
/**
 * Modal submit interaction
 */
class ModalSubmitInteraction extends MessageComponentInteraction {
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
            // Buttons and all supported select menu variants
            if (data.data?.component_type === 2) {
                return new ButtonInteraction(client, data);
            }
            else if ([3, 5, 6, 7, 8].includes(data.data?.component_type ?? 0)) {
                return new SelectMenuInteraction(client, data);
            }
            return new Interaction(client, data);
        default:
            return new Interaction(client, data);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSW50ZXJhY3Rpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvc3RydWN0dXJlcy9JbnRlcmFjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFvbkJBLDhDQW1CQztBQXRvQkQsb0NBQWtGO0FBQ2xGLGlDQUE4QjtBQUM5QiwrQ0FBNEM7QUFDNUMsNkNBQTBDO0FBQzFDLDJEQUF3RDtBQUN4RCx1Q0FBb0M7QUFFcEMsa0RBQXlEO0FBRXpEOztHQUVHO0FBQ0gsTUFBYSxXQUFXO0lBQ3RCLDhCQUE4QjtJQUNkLE1BQU0sQ0FBUztJQUUvQixxQkFBcUI7SUFDTCxFQUFFLENBQVM7SUFFM0IscUJBQXFCO0lBQ0wsYUFBYSxDQUFTO0lBRXRDLHVCQUF1QjtJQUNQLElBQUksQ0FBa0I7SUFFdEMsZUFBZTtJQUNDLE9BQU8sQ0FBVTtJQUVqQyxpQkFBaUI7SUFDRCxTQUFTLENBQVU7SUFFbkMsd0JBQXdCO0lBQ1IsS0FBSyxDQUFTO0lBRTlCLHlDQUF5QztJQUN6QixJQUFJLENBQU87SUFFM0IsbUNBQW1DO0lBQ25CLE1BQU0sQ0FBZTtJQUVyQyxrREFBa0Q7SUFDM0MsT0FBTyxHQUFHLEtBQUssQ0FBQztJQUV2QixnREFBZ0Q7SUFDekMsUUFBUSxHQUFHLEtBQUssQ0FBQztJQUV4QixvRkFBb0Y7SUFDN0UsU0FBUyxHQUFtQixJQUFJLENBQUM7SUFFeEMsWUFBWSxNQUFjLEVBQUUsSUFBb0I7UUFDOUMsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7UUFDckIsb0NBQW9DO1FBQ3BDLElBQUksQ0FBQyxFQUFFLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUMxQixJQUFJLENBQUMsYUFBYSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDakQsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO1FBQ3RCLElBQUksQ0FBQyxPQUFPLEdB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LENBQUMsQ0FBQztZQUM3QyxDQUFDO2lCQUFNLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsY0FBYyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBQ3BFLE9BQU8sSUFBSSxxQkFBcUIsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDakQsQ0FBQztZQUNELE9BQU8sSUFBSSxXQUFXLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ3ZDO1lBQ0UsT0FBTyxJQUFJLFdBQVcsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDekMsQ0FBQztBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBUElJbnRlcmFjdGlvbiwgQVBJSW50ZXJhY3Rpb25PcHRpb24sIEFQSUludGVyYWN0aW9uUmVzb2x2ZWQsIEFQSUVtYmVkIH0gZnJvbSAnLi4vdHlwZXMnO1xyXG5pbXBvcnQgeyBJbnRlcmFjdGlvblR5cGUsIEludGVyYWN0aW9uUmVzcG9uc2VUeXBlLCBNZXNzYWdlRmxhZ3MgfSBmcm9tICcuLi9lbnVtcyc7XHJcbmltcG9ydCB7IFVzZXIgfSBmcm9tICcuL1VzZXInO1xyXG5pbXBvcnQgeyBHdWlsZE1lbWJlciB9IGZyb20gJy4vR3VpbGRNZW1iZXInO1xyXG5pbXBvcnQgeyBDb2xsZWN0aW9uIH0gZnJvbSAnLi9Db2xsZWN0aW9uJztcclxuaW1wb3J0IHsgRW1iZWRCdWlsZGVyIH0gZnJvbSAnLi4vYnVpbGRlcnMvRW1iZWRCdWlsZGVyJztcclxuaW1wb3J0IHsgTWVzc2FnZSB9IGZyb20gJy4vTWVzc2FnZSc7XHJcbmltcG9ydCB0eXBlIHsgQ2xpZW50IH0gZnJvbSAnLi4vQ2xpZW50JztcclxuaW1wb3J0IHsgc2VyaWFsaXplQ29tcG9uZW50cyB9IGZyb20gJy4uL3V0aWxzL3NlcmlhbGl6ZSc7XHJcblxyXG4vKipcclxuICogQmFzZSBpbnRlcmFjdGlvbiBjbGFzc1xyXG4gKi9cclxuZXhwb3J0IGNsYXNzIEludGVyYWN0aW9uIHtcclxuICAvKiogUmVmZXJlbmNlIHRvIHRoZSBjbGllbnQgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgY2xpZW50OiBDbGllbnQ7XHJcbiAgXHJcbiAgLyoqIEludGVyYWN0aW9uIElEICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGlkOiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIEFwcGxpY2F0aW9uIElEICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGFwcGxpY2F0aW9uSWQ6IHN0cmluZztcclxuICBcclxuICAvKiogSW50ZXJhY3Rpb24gdHlwZSAqL1xyXG4gIHB1YmxpYyByZWFkb25seSB0eXBlOiBJbnRlcmFjdGlvblR5cGU7XHJcbiAgXHJcbiAgLyoqIEd1aWxkIElEICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGd1aWxkSWQ/OiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIENoYW5uZWwgSUQgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgY2hhbm5lbElkPzogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBJbnRlcmFjdGlvbiB0b2tlbiAqL1xyXG4gIHB1YmxpYyByZWFkb25seSB0b2tlbjogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBVc2VyIHdobyB0cmlnZ2VyZWQgdGhlIGludGVyYWN0aW9uICovXHJcbiAgcHVibGljIHJlYWRvbmx5IHVzZXI6IFVzZXI7XHJcbiAgXHJcbiAgLyoqIEd1aWxkIG1lbWJlciAoaWYgaW4gYSBndWlsZCkgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgbWVtYmVyPzogR3VpbGRNZW1iZXI7XHJcbiAgXHJcbiAgLyoqIFdoZXRoZXIgdGhlIGludGVyYWN0aW9uIGhhcyBiZWVuIHJlcGxpZWQgdG8gKi9cclxuICBwdWJsaWMgcmVwbGllZCA9IGZhbHNlO1xyXG4gIFxyXG4gIC8qKiBXaGV0aGVyIHRoZSBpbnRlcmFjdGlvbiBoYXMgYmVlbiBkZWZlcnJlZCAqL1xyXG4gIHB1YmxpYyBkZWZlcnJlZCA9IGZhbHNlO1xyXG5cclxuICAvKiogV2hldGhlciB0aGUgaW5pdGlhbCByZXBseSBpcyBwcml2YXRlLiBGb2xsb3ctdXBzIGhhdmUgaW5kZXBlbmRlbnQgdmlzaWJpbGl0eS4gKi9cclxuICBwdWJsaWMgZXBoZW1lcmFsOiBib29sZWFuIHwgbnVsbCA9IG51bGw7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGNsaWVudDogQ2xpZW50LCBkYXRhOiBBUElJbnRlcmFjdGlvbikge1xyXG4gICAgdGhpcy5jbGllbnQgPSBjbGllbnQ7XHJcbiAgICAvLyBIYW5kbGUgYm90aCBzdHJpbmcgYW5kIG51bWJlciBJRHNcclxuICAgIHRoaXMuaWQgPSBTdHJpbmcoZGF0YS5pZCk7XHJcbiAgICB0aGlzLmFwcGxpY2F0aW9uSWQgPSBTdHJpbmcoZGF0YS5hcHBsaWNhdGlvbl9pZCk7XHJcbiAgICB0aGlzLnR5cGUgPSBkYXRhLnR5cGU7XHJcbiAgICB0aGlzLmd1aWxkSWQgPSBkYXRhLmd1aWxkX2lkID8gU3RyaW5nKGRhdGEuZ3VpbGRfaWQpIDogdW5kZWZpbmVkO1xyXG4gICAgdGhpcy5jaGFubmVsSWQgPSBkYXRhLmNoYW5uZWxfaWQgPyBTdHJpbmcoZGF0YS5jaGFubmVsX2lkKSA6IHVuZGVmaW5lZDtcclxuICAgIHRoaXMudG9rZW4gPSBkYXRhLnRva2VuO1xyXG4gICAgXHJcbiAgICAvLyBVc2VyIGNhbiBjb21lIGZyb20gbWVtYmVyLnVzZXIgb3IgZGlyZWN0bHkgZnJvbSB1c2VyXHJcbiAgICBjb25zdCB1c2VyRGF0YSA9IGRhdGEubWVtYmVyPy51c2VyIHx8IGRhdGEudXNlcjtcclxuICAgIHRoaXMudXNlciA9IHVzZXJEYXRhID8gbmV3IFVzZXIodXNlckRhdGEsIGNsaWVudCkgOiBuZXcgVXNlcih7IGlkOiAnMCcsIHVzZXJuYW1lOiAnVW5rbm93bicgfSwgY2xpZW50KTtcclxuICAgIFxyXG4gICAgLy8gQ3JlYXRlIG1lbWJlciBpZiBpbiBndWlsZFxyXG4gICAgaWYgKGRhdGEubWVtYmVyICYmIHRoaXMuZ3VpbGRJZCkge1xyXG4gICAgICBjb25zdCBndWlsZCA9IGNsaWVudC5ndWlsZHMuZ2V0KHRoaXMuZ3VpbGRJZCk7XHJcbiAgICAgIGlmIChndWlsZCkge1xyXG4gICAgICAgIHRoaXMubWVtYmVyID0gbmV3IEd1aWxkTWVtYmVyKGNsaWVudCwgZ3VpbGQsIGRhdGEubWVtYmVyKTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBJZiBiYWNrZW5kIGRpZG4ndCBzZW5kIHZvaWNlIHN0YXRlLCB0cnkgdG8gZmlsbCBmcm9tIGNhY2hlXHJcbiAgICAgICAgaWYgKCFkYXRhLm1lbWJlci52b2ljZT8uY2hhbm5lbF9pZCkge1xyXG4gICAgICAgICAgY29uc3QgY2FjaGVkTWVtYmVyID0gZ3VpbGQubWVtYmVycy5nZXQodGhpcy5tZW1iZXIuaWQpO1xyXG4gICAgICAgICAgaWYgKGNhY2hlZE1lbWJlcj8udm9pY2U/LmNoYW5uZWxJZCkge1xyXG4gICAgICAgICAgICB0aGlzLm1lbWJlci52b2ljZSA9IHsgLi4uY2FjaGVkTWVtYmVyLnZvaWNlIH07XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIC8vIEd1aWxkIG5vdCBpbiBjYWNoZSDigJQgY3JlYXRlIG1lbWJlciB3aXRoIGEgbWluaW1hbCBndWlsZCBzdHViXHJcbiAgICAgICAgY29uc3Qgc3R1Ykd1aWxkID0geyBpZDogdGhpcy5ndWlsZElkLCBvd25lcklkOiBudWxsLCBtZW1iZXJzOiBuZXcgQ29sbGVjdGlvbigpLCBjaGFubmVsczogbmV3IENvbGxlY3Rpb24oKSB9IGFzIGFueTtcclxuICAgICAgICB0aGlzLm1lbWJlciA9IG5ldyBHdWlsZE1lbWJlcihjbGllbnQsIHN0dWJHdWlsZCwgZGF0YS5tZW1iZXIpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBUaGUgZ3VpbGQgdGhpcyBpbnRlcmFjdGlvbiB3YXMgc2VudCBpbiAoaWYgaW4gYSBndWlsZClcclxuICAgKiBEaXNjb3JkLmpzIGNvbXBhdGlibGU6IGludGVyYWN0aW9uLmd1aWxkXHJcbiAgICovXHJcbiAgZ2V0IGd1aWxkKCkge1xyXG4gICAgaWYgKCF0aGlzLmd1aWxkSWQpIHJldHVybiBudWxsO1xyXG4gICAgcmV0dXJuIHRoaXMuY2xpZW50Lmd1aWxkcy5nZXQodGhpcy5ndWlsZElkKSA/PyBudWxsO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2hlY2sgaWYgdGhpcyBpcyBhIGNvbW1hbmQgaW50ZXJhY3Rpb25cclxuICAgKi9cclxuICBpc0NvbW1hbmQoKTogdGhpcyBpcyBDb21tYW5kSW50ZXJhY3Rpb24ge1xyXG4gICAgcmV0dXJuIHRoaXMudHlwZSA9PT0gSW50ZXJhY3Rpb25UeXBlLkFwcGxpY2F0aW9uQ29tbWFuZDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENoZWNrIGlmIHRoaXMgaXMgYW4gYXV0b2NvbXBsZXRlIGludGVyYWN0aW9uXHJcbiAgICovXHJcbiAgaXNBdXRvY29tcGxldGUoKTogdGhpcyBpcyBBdXRvY29tcGxldGVJbnRlcmFjdGlvbiB7XHJcbiAgICByZXR1cm4gdGhpcy50eXBlID09PSBJbnRlcmFjdGlvblR5cGUuQXBwbGljYXRpb25Db21tYW5kQXV0b2NvbXBsZXRlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2hlY2sgaWYgdGhpcyBpcyBhIG1vZGFsIHN1Ym1pdCBpbnRlcmFjdGlvblxyXG4gICAqL1xyXG4gIGlzTW9kYWxTdWJtaXQoKTogdGhpcyBpcyBNb2RhbFN1Ym1pdEludGVyYWN0aW9uIHtcclxuICAgIHJldHVybiB0aGlzLnR5cGUgPT09IEludGVyYWN0aW9uVHlwZS5Nb2RhbFN1Ym1pdDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENoZWNrIGlmIHRoaXMgaXMgYSBidXR0b24gaW50ZXJhY3Rpb25cclxuICAgKi9cclxuICBpc0J1dHRvbigpOiB0aGlzIGlzIEJ1dHRvbkludGVyYWN0aW9uIHtcclxuICAgIHJldHVybiB0aGlzLnR5cGUgPT09IEludGVyYWN0aW9uVHlwZS5NZXNzYWdlQ29tcG9uZW50ICYmICh0aGlzIGFzIGFueSkuY29tcG9uZW50VHlwZSA9PT0gMjtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENoZWNrIGlmIHRoaXMgaXMgYSBzZWxlY3QgbWVudSBpbnRlcmFjdGlvblxyXG4gICAqL1xyXG4gIGlzU2VsZWN0TWVudSgpOiB0aGlzIGlzIFNlbGVjdE1lbnVJbnRlcmFjdGlvbiB7XHJcbiAgICByZXR1cm4gdGhpcy50eXBlID09PSBJbnRlcmFjdGlvblR5cGUuTWVzc2FnZUNvbXBvbmVudCAmJiBbMywgNSwgNiwgNywgOF0uaW5jbHVkZXMoKHRoaXMgYXMgYW55KS5jb21wb25lbnRUeXBlKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENoZWNrIHNwZWNpZmljYWxseSBmb3IgYSBzdHJpbmcgc2VsZWN0IG1lbnUgKGNvbXBvbmVudCB0eXBlIDMpXHJcbiAgICovXHJcbiAgaXNTdHJpbmdTZWxlY3RNZW51KCk6IHRoaXMgaXMgU2VsZWN0TWVudUludGVyYWN0aW9uIHtcclxuICAgIHJldHVybiB0aGlzLnR5cGUgPT09IEludGVyYWN0aW9uVHlwZS5NZXNzYWdlQ29tcG9uZW50ICYmICh0aGlzIGFzIGFueSkuY29tcG9uZW50VHlwZSA9PT0gMztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlcGx5IHRvIHRoZSBpbnRlcmFjdGlvblxyXG4gICAqL1xyXG4gIGFzeW5jIHJlcGx5KG9wdGlvbnM6IHN0cmluZyB8IEludGVyYWN0aW9uUmVwbHlPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBpZiAodGhpcy5yZXBsaWVkIHx8IHRoaXMuZGVmZXJyZWQpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnRlcmFjdGlvbiBoYXMgYWxyZWFkeSBiZWVuIHJlcGxpZWQgdG8gb3IgZGVmZXJyZWQnKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgY29uc3QgY29udGVudCA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IG9wdGlvbnMgOiBvcHRpb25zLmNvbnRlbnQ7XHJcbiAgICBjb25zdCByYXdFbWJlZHMgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyB1bmRlZmluZWQgOiBvcHRpb25zLmVtYmVkcztcclxuICAgIGNvbnN0IHJhd0NvbXBvbmVudHMgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyB1bmRlZmluZWQgOiBvcHRpb25zLmNvbXBvbmVudHM7XHJcbiAgICBjb25zdCBlcGhlbWVyYWwgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyBmYWxzZSA6IG9wdGlvbnMuZXBoZW1lcmFsO1xyXG4gICAgXHJcbiAgICAvLyBDb252ZXJ0IEVtYmVkQnVpbGRlciBpbnN0YW5jZXMgdG8gcGxhaW4gb2JqZWN0c1xyXG4gICAgY29uc3QgZW1iZWRzID0gcmF3RW1iZWRzPy5tYXAoZSA9PiBlIGluc3RhbmNlb2YgRW1iZWRCdWlsZGVyID8gZS50b0pTT04oKSA6IGUpO1xyXG4gICAgLy8gQ29udmVydCBBY3Rpb25Sb3dCdWlsZGVyL0J1dHRvbkJ1aWxkZXIgaW5zdGFuY2VzIHRvIHBsYWluIG9iamVjdHNcclxuICAgIGNvbnN0IGNvbXBvbmVudHMgPSBzZXJpYWxpemVDb21wb25lbnRzKHJhd0NvbXBvbmVudHMpO1xyXG4gICAgXHJcbiAgICBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LmNyZWF0ZUludGVyYWN0aW9uUmVzcG9uc2UodGhpcy5pZCwgdGhpcy50b2tlbiwge1xyXG4gICAgICB0eXBlOiBJbnRlcmFjdGlvblJlc3BvbnNlVHlwZS5DaGFubmVsTWVzc2FnZVdpdGhTb3VyY2UsXHJcbiAgICAgIGRhdGE6IHtcclxuICAgICAgICBjb250ZW50LFxyXG4gICAgICAgIGVtYmVkcyxcclxuICAgICAgICBjb21wb25lbnRzLFxyXG4gICAgICAgIGZsYWdzOiAodHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gMCA6IG9wdGlvbnMuZmxhZ3MgPz8gMCkgfCAoZXBoZW1lcmFsID8gTWVzc2FnZUZsYWdzLkVwaGVtZXJhbCA6IDApXHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICB0aGlzLnJlcGxpZWQgPSB0cnVlO1xyXG4gICAgdGhpcy5lcGhlbWVyYWwgPSAhISgodHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gMCA6IG9wdGlvbnMuZmxhZ3MgPz8gMCkgJiBNZXNzYWdlRmxhZ3MuRXBoZW1lcmFsKSB8fCAhIWVwaGVtZXJhbDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlZmVyIHRoZSByZXBseSAoc2hvd3MgXCJ0aGlua2luZy4uLlwiKVxyXG4gICAqL1xyXG4gIGFzeW5jIGRlZmVyUmVwbHkob3B0aW9ucz86IHsgZXBoZW1lcmFsPzogYm9vbGVhbiB9KTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBpZiAodGhpcy5yZXBsaWVkIHx8IHRoaXMuZGVmZXJyZWQpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnRlcmFjdGlvbiBoYXMgYWxyZWFkeSBiZWVuIHJlcGxpZWQgdG8gb3IgZGVmZXJyZWQnKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5jcmVhdGVJbnRlcmFjdGlvblJlc3BvbnNlKHRoaXMuaWQsIHRoaXMudG9rZW4sIHtcclxuICAgICAgdHlwZTogSW50ZXJhY3Rpb25SZXNwb25zZVR5cGUuRGVmZXJyZWRDaGFubmVsTWVzc2FnZVdpdGhTb3VyY2UsXHJcbiAgICAgIGRhdGE6IG9wdGlvbnM/LmVwaGVtZXJhbCA/IHsgZmxhZ3M6IE1lc3NhZ2VGbGFncy5FcGhlbWVyYWwgfSA6IHVuZGVmaW5lZFxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIHRoaXMuZGVmZXJyZWQgPSB0cnVlO1xyXG4gICAgdGhpcy5lcGhlbWVyYWwgPSBvcHRpb25zPy5lcGhlbWVyYWwgPz8gZmFsc2U7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBFZGl0IHRoZSByZXBseVxyXG4gICAqL1xyXG4gIGFzeW5jIGVkaXRSZXBseShvcHRpb25zOiBzdHJpbmcgfCBJbnRlcmFjdGlvblJlcGx5T3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgY29udGVudCA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IG9wdGlvbnMgOiBvcHRpb25zLmNvbnRlbnQ7XHJcbiAgICBjb25zdCByYXdFbWJlZHMgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyB1bmRlZmluZWQgOiBvcHRpb25zLmVtYmVkcztcclxuICAgIGNvbnN0IHJhd0NvbXBvbmVudHMgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyB1bmRlZmluZWQgOiBvcHRpb25zLmNvbXBvbmVudHM7XHJcbiAgICBjb25zdCBmaWxlcyA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IHVuZGVmaW5lZCA6IG9wdGlvbnMuZmlsZXM7XHJcbiAgICBcclxuICAgIC8vIENvbnZlcnQgRW1iZWRCdWlsZGVyIGluc3RhbmNlcyB0byBwbGFpbiBvYmplY3RzXHJcbiAgICBjb25zdCBlbWJlZHMgPSByYXdFbWJlZHM/Lm1hcChlID0+IGUgaW5zdGFuY2VvZiBFbWJlZEJ1aWxkZXIgPyBlLnRvSlNPTigpIDogZSk7XHJcbiAgICAvLyBDb252ZXJ0IEFjdGlvblJvd0J1aWxkZXIvQnV0dG9uQnVpbGRlciBpbnN0YW5jZXMgdG8gcGxhaW4gb2JqZWN0c1xyXG4gICAgY29uc3QgY29tcG9uZW50cyA9IHNlcmlhbGl6ZUNvbXBvbmVudHMocmF3Q29tcG9uZW50cyk7XHJcbiAgICBcclxuICAgIGF3YWl0IHRoaXMuY2xpZW50LnJlc3QuZWRpdEludGVyYWN0aW9uUmVzcG9uc2UodGhpcy50b2tlbiwge1xyXG4gICAgICBjb250ZW50LFxyXG4gICAgICBlbWJlZHMsXHJcbiAgICAgIGNvbXBvbmVudHMsXHJcbiAgICAgIGZpbGVzLFxyXG4gICAgICBmbGFnczogdGhpcy5lcGhlbWVyYWwgPyAoKHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IDAgOiBvcHRpb25zLmZsYWdzID8/IDApIHwgTWVzc2FnZUZsYWdzLkVwaGVtZXJhbCkgOiAodHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gdW5kZWZpbmVkIDogb3B0aW9ucy5mbGFncylcclxuICAgIH0sIHRoaXMuZXBoZW1lcmFsID8gdW5kZWZpbmVkIDogdGhpcy5ndWlsZElkLCB0aGlzLmVwaGVtZXJhbCA/IHVuZGVmaW5lZCA6IHRoaXMuY2hhbm5lbElkLCB0aGlzLmVwaGVtZXJhbCA/IHVuZGVmaW5lZCA6IHRoaXMuaWQpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVsZXRlIHRoZSByZXBseVxyXG4gICAqL1xyXG4gIGFzeW5jIGRlbGV0ZVJlcGx5KCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5kZWxldGVJbnRlcmFjdGlvblJlc3BvbnNlKHRoaXMudG9rZW4pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2VuZCBhIGZvbGxvd3VwIG1lc3NhZ2VcclxuICAgKi9cclxuICBhc3luYyBmb2xsb3dVcChvcHRpb25zOiBzdHJpbmcgfCBJbnRlcmFjdGlvblJlcGx5T3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgY29udGVudCA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IG9wdGlvbnMgOiBvcHRpb25zLmNvbnRlbnQ7XHJcbiAgICBjb25zdCByYXdFbWJlZHMgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyB1bmRlZmluZWQgOiBvcHRpb25zLmVtYmVkcztcclxuICAgIGNvbnN0IHJhd0NvbXBvbmVudHMgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyB1bmRlZmluZWQgOiBvcHRpb25zLmNvbXBvbmVudHM7XHJcbiAgICBjb25zdCBlcGhlbWVyYWwgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyBmYWxzZSA6IG9wdGlvbnMuZXBoZW1lcmFsO1xyXG4gICAgY29uc3QgZmlsZXMgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyB1bmRlZmluZWQgOiBvcHRpb25zLmZpbGVzO1xyXG4gICAgXHJcbiAgICAvLyBDb252ZXJ0IEVtYmVkQnVpbGRlciBpbnN0YW5jZXMgdG8gcGxhaW4gb2JqZWN0c1xyXG4gICAgY29uc3QgZW1iZWRzID0gcmF3RW1iZWRzPy5tYXAoZSA9PiBlIGluc3RhbmNlb2YgRW1iZWRCdWlsZGVyID8gZS50b0pTT04oKSA6IGUpO1xyXG4gICAgXHJcbiAgICAvLyBDb252ZXJ0IGNvbXBvbmVudCBidWlsZGVyIGluc3RhbmNlcyB0byBwbGFpbiBvYmplY3RzXHJcbiAgICBjb25zdCBjb21wb25lbnRzID0gc2VyaWFsaXplQ29tcG9uZW50cyhyYXdDb21wb25lbnRzKTtcclxuICAgIFxyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5jcmVhdGVGb2xsb3d1cCh0aGlzLnRva2VuLCB7XHJcbiAgICAgIGNvbnRlbnQsXHJcbiAgICAgIGVtYmVkcyxcclxuICAgICAgY29tcG9uZW50cyxcclxuICAgICAgZmxhZ3M6ICh0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyAwIDogb3B0aW9ucy5mbGFncyA/PyAwKSB8IChlcGhlbWVyYWwgPyBNZXNzYWdlRmxhZ3MuRXBoZW1lcmFsIDogMCksXHJcbiAgICAgIGZpbGVzXHJcbiAgICB9KTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb21tYW5kIGludGVyYWN0aW9uXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgQ29tbWFuZEludGVyYWN0aW9uIGV4dGVuZHMgSW50ZXJhY3Rpb24ge1xyXG4gIC8qKiBDb21tYW5kIG5hbWUgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgY29tbWFuZE5hbWU6IHN0cmluZztcclxuICBcclxuICAvKiogQ29tbWFuZCBvcHRpb25zICovXHJcbiAgcHVibGljIHJlYWRvbmx5IG9wdGlvbnM6IENvbW1hbmRJbnRlcmFjdGlvbk9wdGlvbnM7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGNsaWVudDogQ2xpZW50LCBkYXRhOiBBUElJbnRlcmFjdGlvbikge1xyXG4gICAgc3VwZXIoY2xpZW50LCBkYXRhKTtcclxuICAgIHRoaXMuY29tbWFuZE5hbWUgPSBkYXRhLmRhdGE/Lm5hbWUgfHwgJyc7XHJcbiAgICB0aGlzLm9wdGlvbnMgPSBuZXcgQ29tbWFuZEludGVyYWN0aW9uT3B0aW9ucyhjbGllbnQsIGRhdGEuZGF0YT8ub3B0aW9ucyB8fCBbXSwgZGF0YS5kYXRhPy5yZXNvbHZlZCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTaG93IGEgbW9kYWxcclxuICAgKi9cclxuICBhc3luYyBzaG93TW9kYWwobW9kYWw6IE1vZGFsRGF0YSB8IHsgdG9KU09OKCk6IE1vZGFsRGF0YSB9KTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBtb2RhbERhdGEgPSAndG9KU09OJyBpbiBtb2RhbCAmJiB0eXBlb2YgbW9kYWwudG9KU09OID09PSAnZnVuY3Rpb24nID8gbW9kYWwudG9KU09OKCkgOiBtb2RhbDtcclxuICAgIGF3YWl0IHRoaXMuY2xpZW50LnJlc3QuY3JlYXRlSW50ZXJhY3Rpb25SZXNwb25zZSh0aGlzLmlkLCB0aGlzLnRva2VuLCB7XHJcbiAgICAgIHR5cGU6IEludGVyYWN0aW9uUmVzcG9uc2VUeXBlLk1vZGFsLFxyXG4gICAgICBkYXRhOiBtb2RhbERhdGFcclxuICAgIH0pO1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIENvbW1hbmQgaW50ZXJhY3Rpb24gb3B0aW9ucyBoZWxwZXJcclxuICovXHJcbmV4cG9ydCBjbGFzcyBDb21tYW5kSW50ZXJhY3Rpb25PcHRpb25zIHtcclxuICBwcml2YXRlIGNsaWVudDogQ2xpZW50O1xyXG4gIHByaXZhdGUgb3B0aW9uczogQVBJSW50ZXJhY3Rpb25PcHRpb25bXTtcclxuICBwcml2YXRlIHJlc29sdmVkPzogQVBJSW50ZXJhY3Rpb25SZXNvbHZlZDtcclxuXHJcbiAgY29uc3RydWN0b3IoY2xpZW50OiBDbGllbnQsIG9wdGlvbnM6IEFQSUludGVyYWN0aW9uT3B0aW9uW10sIHJlc29sdmVkPzogQVBJSW50ZXJhY3Rpb25SZXNvbHZlZCkge1xyXG4gICAgdGhpcy5jbGllbnQgPSBjbGllbnQ7XHJcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xyXG4gICAgdGhpcy5yZXNvbHZlZCA9IHJlc29sdmVkO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGEgc3RyaW5nIG9wdGlvbiB2YWx1ZS5cclxuICAgKiBcclxuICAgKiAqKldhcm5pbmc6KiogUmV0dXJucyByYXcgdXNlciBpbnB1dCB3aXRob3V0IGFueSBzYW5pdGl6YXRpb24uXHJcbiAgICogVGhlIGNhbGxlciBpcyByZXNwb25zaWJsZSBmb3IgdmFsaWRhdGluZyBhbmQgc2FmZWx5IGhhbmRsaW5nIHRoaXMgdmFsdWVcclxuICAgKiBiZWZvcmUgdXNpbmcgaXQgaW4gZGF0YWJhc2UgcXVlcmllcywgc2hlbGwgY29tbWFuZHMsIG9yIG90aGVyIHNlbnNpdGl2ZSBjb250ZXh0cy5cclxuICAgKiBcclxuICAgKiBAcGFyYW0gbmFtZSAtIFRoZSBuYW1lIG9mIHRoZSBvcHRpb24gdG8gcmV0cmlldmVcclxuICAgKiBAcGFyYW0gcmVxdWlyZWQgLSBJZiB0cnVlLCB0aHJvd3MgYW4gZXJyb3Igd2hlbiB0aGUgb3B0aW9uIGlzIG5vdCBmb3VuZFxyXG4gICAqIEByZXR1cm5zIFRoZSByYXcgc3RyaW5nIHZhbHVlLCBvciBudWxsIGlmIG5vdCBmb3VuZCAoYW5kIG5vdCByZXF1aXJlZClcclxuICAgKi9cclxuICBnZXRTdHJpbmcobmFtZTogc3RyaW5nLCByZXF1aXJlZD86IGJvb2xlYW4pOiBzdHJpbmcgfCBudWxsIHtcclxuICAgIGNvbnN0IG9wdGlvbiA9IHRoaXMub3B0aW9ucy5maW5kKG8gPT4gby5uYW1lID09PSBuYW1lKTtcclxuICAgIGlmICghb3B0aW9uICYmIHJlcXVpcmVkKSB0aHJvdyBuZXcgRXJyb3IoYFJlcXVpcmVkIG9wdGlvbiBcIiR7bmFtZX1cIiBub3QgZm91bmRgKTtcclxuICAgIHJldHVybiAob3B0aW9uPy52YWx1ZSBhcyBzdHJpbmcpID8/IG51bGw7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYW4gaW50ZWdlciBvcHRpb25cclxuICAgKi9cclxuICBnZXRJbnRlZ2VyKG5hbWU6IHN0cmluZywgcmVxdWlyZWQ/OiBib29sZWFuKTogbnVtYmVyIHwgbnVsbCB7XHJcbiAgICBjb25zdCBvcHRpb24gPSB0aGlzLm9wdGlvbnMuZmluZChvID0+IG8ubmFtZSA9PT0gbmFtZSk7XHJcbiAgICBpZiAoIW9wdGlvbiAmJiByZXF1aXJlZCkgdGhyb3cgbmV3IEVycm9yKGBSZXF1aXJlZCBvcHRpb24gXCIke25hbWV9XCIgbm90IGZvdW5kYCk7XHJcbiAgICByZXR1cm4gb3B0aW9uPy52YWx1ZSBhcyBudW1iZXIgfHwgbnVsbDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhIG51bWJlciBvcHRpb25cclxuICAgKi9cclxuICBnZXROdW1iZXIobmFtZTogc3RyaW5nLCByZXF1aXJlZD86IGJvb2xlYW4pOiBudW1iZXIgfCBudWxsIHtcclxuICAgIHJldHVybiB0aGlzLmdldEludGVnZXIobmFtZSwgcmVxdWlyZWQpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGEgYm9vbGVhbiBvcHRpb25cclxuICAgKi9cclxuICBnZXRCb29sZWFuKG5hbWU6IHN0cmluZywgcmVxdWlyZWQ/OiBib29sZWFuKTogYm9vbGVhbiB8IG51bGwge1xyXG4gICAgY29uc3Qgb3B0aW9uID0gdGhpcy5vcHRpb25zLmZpbmQobyA9PiBvLm5hbWUgPT09IG5hbWUpO1xyXG4gICAgaWYgKCFvcHRpb24gJiYgcmVxdWlyZWQpIHRocm93IG5ldyBFcnJvcihgUmVxdWlyZWQgb3B0aW9uIFwiJHtuYW1lfVwiIG5vdCBmb3VuZGApO1xyXG4gICAgcmV0dXJuIG9wdGlvbj8udmFsdWUgYXMgYm9vbGVhbiA/PyBudWxsO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGEgdXNlciBvcHRpb24g4oCUIHJldHVybnMgcmVzb2x2ZWQgVXNlciBvYmplY3QgaWYgYXZhaWxhYmxlXHJcbiAgICogRmFsbHMgYmFjayB0byBwYXJzaW5nIG1lbnRpb24gZm9ybWF0ICg8QElEPikgYW5kIHJlc29sdmluZyBmcm9tIHJlc29sdmVkIGRhdGFcclxuICAgKi9cclxuICBnZXRVc2VyKG5hbWU6IHN0cmluZywgcmVxdWlyZWQ/OiBib29sZWFuKTogVXNlciB8IG51bGwge1xyXG4gICAgY29uc3Qgb3B0aW9uID0gdGhpcy5vcHRpb25zLmZpbmQobyA9PiBvLm5hbWUgPT09IG5hbWUpO1xyXG4gICAgaWYgKCFvcHRpb24gJiYgcmVxdWlyZWQpIHRocm93IG5ldyBFcnJvcihgUmVxdWlyZWQgb3B0aW9uIFwiJHtuYW1lfVwiIG5vdCBmb3VuZGApO1xyXG4gICAgaWYgKCFvcHRpb24pIHJldHVybiBudWxsO1xyXG5cclxuICAgIGNvbnN0IHJhd1ZhbHVlID0gU3RyaW5nKG9wdGlvbi52YWx1ZSB8fCAnJyk7XHJcblxyXG4gICAgLy8gRXh0cmFjdCB1c2VyIElEIOKAlCBjb3VsZCBiZSBcIjEyM1wiLCBcIjxAMTIzPlwiLCBvciBcIjxAITEyMz5cIlxyXG4gICAgY29uc3QgbWF0Y2ggPSByYXdWYWx1ZS5tYXRjaCgvXjw/QD8hPyhcXGQrKT4/JC8pO1xyXG4gICAgY29uc3QgdXNlcklkID0gbWF0Y2ggPyBtYXRjaFsxXSA6IHJhd1ZhbHVlO1xyXG5cclxuICAgIC8vIFRyeSB0byByZXNvbHZlIGZyb20gcmVzb2x2ZWQgZGF0YVxyXG4gICAgaWYgKHRoaXMucmVzb2x2ZWQ/LnVzZXJzICYmIHRoaXMucmVzb2x2ZWQudXNlcnNbdXNlcklkXSkge1xyXG4gICAgICByZXR1cm4gbmV3IFVzZXIodGhpcy5yZXNvbHZlZC51c2Vyc1t1c2VySWRdLCB0aGlzLmNsaWVudCk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gRmFsbGJhY2s6IHJldHVybiBhIG1pbmltYWwgVXNlciB3aXRoIGp1c3QgdGhlIElEXHJcbiAgICBpZiAodXNlcklkICYmIC9eXFxkKyQvLnRlc3QodXNlcklkKSkge1xyXG4gICAgICByZXR1cm4gbmV3IFVzZXIoeyBpZDogdXNlcklkLCB1c2VybmFtZTogYFVzZXJfJHt1c2VySWR9YCB9LCB0aGlzLmNsaWVudCk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIG51bGw7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgcmF3IHVzZXIgSUQgZnJvbSBhIHVzZXIgb3B0aW9uIChmb3IgY2FzZXMgd2hlcmUgb25seSB0aGUgSUQgaXMgbmVlZGVkKVxyXG4gICAqL1xyXG4gIGdldFVzZXJJZChuYW1lOiBzdHJpbmcsIHJlcXVpcmVkPzogYm9vbGVhbik6IHN0cmluZyB8IG51bGwge1xyXG4gICAgY29uc3Qgb3B0aW9uID0gdGhpcy5vcHRpb25zLmZpbmQobyA9PiBvLm5hbWUgPT09IG5hbWUpO1xyXG4gICAgaWYgKCFvcHRpb24gJiYgcmVxdWlyZWQpIHRocm93IG5ldyBFcnJvcihgUmVxdWlyZWQgb3B0aW9uIFwiJHtuYW1lfVwiIG5vdCBmb3VuZGApO1xyXG4gICAgaWYgKCFvcHRpb24pIHJldHVybiBudWxsO1xyXG5cclxuICAgIGNvbnN0IHJhd1ZhbHVlID0gU3RyaW5nKG9wdGlvbi52YWx1ZSB8fCAnJyk7XHJcbiAgICBjb25zdCBtYXRjaCA9IHJhd1ZhbHVlLm1hdGNoKC9ePD9APyE/KFxcZCspPj8kLyk7XHJcbiAgICByZXR1cm4gbWF0Y2ggPyBtYXRjaFsxXSA6IHJhd1ZhbHVlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGEgY2hhbm5lbCBvcHRpb25cclxuICAgKi9cclxuICBnZXRDaGFubmVsKG5hbWU6IHN0cmluZywgcmVxdWlyZWQ/OiBib29sZWFuKTogc3RyaW5nIHwgbnVsbCB7XHJcbiAgICBjb25zdCBvcHRpb24gPSB0aGlzLm9wdGlvbnMuZmluZChvID0+IG8ubmFtZSA9PT0gbmFtZSk7XHJcbiAgICBpZiAoIW9wdGlvbiAmJiByZXF1aXJlZCkgdGhyb3cgbmV3IEVycm9yKGBSZXF1aXJlZCBvcHRpb24gXCIke25hbWV9XCIgbm90IGZvdW5kYCk7XHJcbiAgICByZXR1cm4gb3B0aW9uPy52YWx1ZSBhcyBzdHJpbmcgfHwgbnVsbDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhIHN1YmNvbW1hbmQgbmFtZVxyXG4gICAqL1xyXG4gIGdldFN1YmNvbW1hbmQocmVxdWlyZWQ/OiBib29sZWFuKTogc3RyaW5nIHwgbnVsbCB7XHJcbiAgICBjb25zdCBvcHRpb24gPSB0aGlzLm9wdGlvbnMuZmluZChvID0+IG8udHlwZSA9PT0gMSk7XHJcbiAgICBpZiAoIW9wdGlvbiAmJiByZXF1aXJlZCkgdGhyb3cgbmV3IEVycm9yKCdSZXF1aXJlZCBzdWJjb21tYW5kIG5vdCBmb3VuZCcpO1xyXG4gICAgcmV0dXJuIG9wdGlvbj8ubmFtZSB8fCBudWxsO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IHRoZSBmb2N1c2VkIG9wdGlvbiAoZm9yIGF1dG9jb21wbGV0ZSlcclxuICAgKi9cclxuICBnZXRGb2N1c2VkKCk6IHsgbmFtZTogc3RyaW5nOyB2YWx1ZTogc3RyaW5nIH0gfCBudWxsIHtcclxuICAgIGNvbnN0IG9wdGlvbiA9IHRoaXMub3B0aW9ucy5maW5kKG8gPT4gby5mb2N1c2VkKTtcclxuICAgIGlmICghb3B0aW9uKSByZXR1cm4gbnVsbDtcclxuICAgIHJldHVybiB7IG5hbWU6IG9wdGlvbi5uYW1lLCB2YWx1ZTogb3B0aW9uLnZhbHVlIGFzIHN0cmluZyB9O1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIEF1dG9jb21wbGV0ZSBpbnRlcmFjdGlvblxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIEF1dG9jb21wbGV0ZUludGVyYWN0aW9uIGV4dGVuZHMgSW50ZXJhY3Rpb24ge1xyXG4gIC8qKiBDb21tYW5kIG5hbWUgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgY29tbWFuZE5hbWU6IHN0cmluZztcclxuICBcclxuICAvKiogQ29tbWFuZCBvcHRpb25zICovXHJcbiAgcHVibGljIHJlYWRvbmx5IG9wdGlvbnM6IENvbW1hbmRJbnRlcmFjdGlvbk9wdGlvbnM7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGNsaWVudDogQ2xpZW50LCBkYXRhOiBBUElJbnRlcmFjdGlvbikge1xyXG4gICAgc3VwZXIoY2xpZW50LCBkYXRhKTtcclxuICAgIHRoaXMuY29tbWFuZE5hbWUgPSBkYXRhLmRhdGE/Lm5hbWUgfHwgJyc7XHJcbiAgICB0aGlzLm9wdGlvbnMgPSBuZXcgQ29tbWFuZEludGVyYWN0aW9uT3B0aW9ucyhjbGllbnQsIGRhdGEuZGF0YT8ub3B0aW9ucyB8fCBbXSwgZGF0YS5kYXRhPy5yZXNvbHZlZCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZXNwb25kIHdpdGggYXV0b2NvbXBsZXRlIGNob2ljZXNcclxuICAgKi9cclxuICBhc3luYyByZXNwb25kKGNob2ljZXM6IEF1dG9jb21wbGV0ZUNob2ljZVtdKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LmNyZWF0ZUludGVyYWN0aW9uUmVzcG9uc2UodGhpcy5pZCwgdGhpcy50b2tlbiwge1xyXG4gICAgICB0eXBlOiBJbnRlcmFjdGlvblJlc3BvbnNlVHlwZS5BcHBsaWNhdGlvbkNvbW1hbmRBdXRvY29tcGxldGVSZXN1bHQsXHJcbiAgICAgIGRhdGE6IHsgY2hvaWNlcyB9XHJcbiAgICB9KTtcclxuICB9XHJcbn1cclxuXHJcbi8qKiBTaGFyZWQgYWNrbm93bGVkZ2VtZW50IG1ldGhvZHMgZm9yIGludGVyYWN0aW9ucyB0aWVkIHRvIGEgbWVzc2FnZS4gKi9cclxuYWJzdHJhY3QgY2xhc3MgTWVzc2FnZUNvbXBvbmVudEludGVyYWN0aW9uIGV4dGVuZHMgSW50ZXJhY3Rpb24ge1xyXG4gIHByaXZhdGUgbWVzc2FnZUFja25vd2xlZGdlZCA9IGZhbHNlO1xyXG4gIHB1YmxpYyByZWFkb25seSBtZXNzYWdlPzogTWVzc2FnZTtcclxuXHJcbiAgY29uc3RydWN0b3IoY2xpZW50OiBDbGllbnQsIGRhdGE6IEFQSUludGVyYWN0aW9uKSB7XHJcbiAgICBzdXBlcihjbGllbnQsIGRhdGEpO1xyXG4gICAgaWYgKGRhdGEubWVzc2FnZSkge1xyXG4gICAgICB0aGlzLm1lc3NhZ2UgPSBuZXcgTWVzc2FnZShjbGllbnQsIHsgLi4uZGF0YS5tZXNzYWdlLCBndWlsZF9pZDogZGF0YS5ndWlsZF9pZCwgY2hhbm5lbF9pZDogZGF0YS5jaGFubmVsX2lkID8/IGRhdGEubWVzc2FnZS5jaGFubmVsX2lkIH0gYXMgYW55KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgYXNzZXJ0Q2FuVXBkYXRlKCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMucmVwbGllZCB8fCB0aGlzLmRlZmVycmVkKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW50ZXJhY3Rpb24gaGFzIGFscmVhZHkgYmVlbiByZXBsaWVkIHRvIG9yIGRlZmVycmVkJyk7XHJcbiAgICB9XHJcbiAgICBpZiAodGhpcy5pc01vZGFsU3VibWl0KCkgJiYgIXRoaXMubWVzc2FnZSkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ09ubHkgYSBtb2RhbCBvcGVuZWQgZnJvbSBhIG1lc3NhZ2UgY2FuIHVwZGF0ZSB0aGF0IG1lc3NhZ2UnKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKiBVcGRhdGUgdGhlIG1lc3NhZ2UgdGhhdCB0cmlnZ2VyZWQgdGhpcyBpbnRlcmFjdGlvbi4gKi9cclxuICBhc3luYyB1cGRhdGUob3B0aW9uczogc3RyaW5nIHwgSW50ZXJhY3Rpb25SZXBseU9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIHRoaXMuYXNzZXJ0Q2FuVXBkYXRlKCk7XHJcbiAgICBjb25zdCBkYXRhID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8geyBjb250ZW50OiBvcHRpb25zIH0gOiBvcHRpb25zO1xyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5jcmVhdGVJbnRlcmFjdGlvblJlc3BvbnNlKHRoaXMuaWQsIHRoaXMudG9rZW4sIHtcclxuICAgICAgdHlwZTogSW50ZXJhY3Rpb25SZXNwb25zZVR5cGUuVXBkYXRlTWVzc2FnZSxcclxuICAgICAgZGF0YToge1xyXG4gICAgICAgIGZsYWdzOiBkYXRhLmZsYWdzLFxyXG4gICAgICBjb250ZW50OiBkYXRhLmNvbnRlbnQsXHJcbiAgICAgICAgZW1iZWRzOiBkYXRhLmVtYmVkcz8ubWFwKGUgPT4gZSBpbnN0YW5jZW9mIEVtYmVkQnVpbGRlciA/IGUudG9KU09OKCkgOiBlKSxcclxuICAgICAgICBjb21wb25lbnRzOiBzZXJpYWxpemVDb21wb25lbnRzKGRhdGEuY29tcG9uZW50cylcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICB0aGlzLnJlcGxpZWQgPSB0cnVlO1xyXG4gICAgdGhpcy5tZXNzYWdlQWNrbm93bGVkZ2VkID0gdHJ1ZTtcclxuICB9XHJcblxyXG4gIC8qKiBFZGl0IHRoZSBzb3VyY2UgbWVzc2FnZSBhZnRlciB1cGRhdGUvZGVmZXJVcGRhdGUsIG9yIHRoZSByZXBseSBhZnRlciByZXBseS9kZWZlclJlcGx5LiAqL1xyXG4gIGFzeW5jIGVkaXRSZXBseShvcHRpb25zOiBzdHJpbmcgfCBJbnRlcmFjdGlvblJlcGx5T3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgaWYgKCF0aGlzLm1lc3NhZ2VBY2tub3dsZWRnZWQpIHJldHVybiBzdXBlci5lZGl0UmVwbHkob3B0aW9ucyk7XHJcbiAgICBjb25zdCBkYXRhID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8geyBjb250ZW50OiBvcHRpb25zIH0gOiBvcHRpb25zO1xyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5lZGl0SW50ZXJhY3Rpb25SZXNwb25zZSh0aGlzLnRva2VuLCB7XHJcbiAgICAgIGZsYWdzOiBkYXRhLmZsYWdzLFxyXG4gICAgICBjb250ZW50OiBkYXRhLmNvbnRlbnQsXHJcbiAgICAgIGVtYmVkczogZGF0YS5lbWJlZHM/Lm1hcChlID0+IGUgaW5zdGFuY2VvZiBFbWJlZEJ1aWxkZXIgPyBlLnRvSlNPTigpIDogZSksXHJcbiAgICAgIGNvbXBvbmVudHM6IHNlcmlhbGl6ZUNvbXBvbmVudHMoZGF0YS5jb21wb25lbnRzKSxcclxuICAgICAgZmlsZXM6IGRhdGEuZmlsZXNcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqIEFja25vd2xlZGdlIHdpdGhvdXQgc2hvd2luZyBhIHRoaW5raW5nIG1lc3NhZ2U7IGVkaXRSZXBseSBjYW4gdXBkYXRlIGxhdGVyLiAqL1xyXG4gIGFzeW5jIGRlZmVyVXBkYXRlKCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgdGhpcy5hc3NlcnRDYW5VcGRhdGUoKTtcclxuICAgIGF3YWl0IHRoaXMuY2xpZW50LnJlc3QuY3JlYXRlSW50ZXJhY3Rpb25SZXNwb25zZSh0aGlzLmlkLCB0aGlzLnRva2VuLCB7XHJcbiAgICAgIHR5cGU6IEludGVyYWN0aW9uUmVzcG9uc2VUeXBlLkRlZmVycmVkVXBkYXRlTWVzc2FnZVxyXG4gICAgfSk7XHJcbiAgICB0aGlzLmRlZmVycmVkID0gdHJ1ZTtcclxuICAgIHRoaXMubWVzc2FnZUFja25vd2xlZGdlZCA9IHRydWU7XHJcbiAgfVxyXG59XHJcblxyXG4vKiogQnV0dG9uIGludGVyYWN0aW9uLiAqL1xyXG5leHBvcnQgY2xhc3MgQnV0dG9uSW50ZXJhY3Rpb24gZXh0ZW5kcyBNZXNzYWdlQ29tcG9uZW50SW50ZXJhY3Rpb24ge1xyXG4gIC8qKiBCdXR0b24gY3VzdG9tIElEICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGN1c3RvbUlkOiBzdHJpbmc7XHJcblxyXG4gIC8qKiBDb21wb25lbnQgdHlwZSAoYWx3YXlzIDIgZm9yIGJ1dHRvbnMpICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGNvbXBvbmVudFR5cGU6IG51bWJlciA9IDI7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGNsaWVudDogQ2xpZW50LCBkYXRhOiBBUElJbnRlcmFjdGlvbikge1xyXG4gICAgc3VwZXIoY2xpZW50LCBkYXRhKTtcclxuICAgIHRoaXMuY3VzdG9tSWQgPSBkYXRhLmRhdGE/LmN1c3RvbV9pZCB8fCAnJztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNob3cgYSBtb2RhbCBpbiByZXNwb25zZSB0byB0aGlzIGJ1dHRvbiBpbnRlcmFjdGlvblxyXG4gICAqL1xyXG4gIGFzeW5jIHNob3dNb2RhbChtb2RhbDogTW9kYWxEYXRhIHwgeyB0b0pTT04oKTogTW9kYWxEYXRhIH0pOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGlmICh0aGlzLnJlcGxpZWQgfHwgdGhpcy5kZWZlcnJlZCkgdGhyb3cgbmV3IEVycm9yKCdJbnRlcmFjdGlvbiBoYXMgYWxyZWFkeSBiZWVuIHJlcGxpZWQgdG8gb3IgZGVmZXJyZWQnKTtcclxuICAgIGNvbnN0IG1vZGFsRGF0YSA9ICd0b0pTT04nIGluIG1vZGFsICYmIHR5cGVvZiBtb2RhbC50b0pTT04gPT09ICdmdW5jdGlvbicgPyBtb2RhbC50b0pTT04oKSA6IG1vZGFsO1xyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5jcmVhdGVJbnRlcmFjdGlvblJlc3BvbnNlKHRoaXMuaWQsIHRoaXMudG9rZW4sIHtcclxuICAgICAgdHlwZTogSW50ZXJhY3Rpb25SZXNwb25zZVR5cGUuTW9kYWwsXHJcbiAgICAgIGRhdGE6IG1vZGFsRGF0YVxyXG4gICAgfSk7XHJcbiAgICB0aGlzLnJlcGxpZWQgPSB0cnVlO1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIFNlbGVjdCBtZW51IGludGVyYWN0aW9uXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgU2VsZWN0TWVudUludGVyYWN0aW9uIGV4dGVuZHMgTWVzc2FnZUNvbXBvbmVudEludGVyYWN0aW9uIHtcclxuICAvKiogU2VsZWN0IG1lbnUgY3VzdG9tIElEICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGN1c3RvbUlkOiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIFNlbGVjdCBjb21wb25lbnQgdHlwZSAoMywgNSwgNiwgNyBvciA4KSAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBjb21wb25lbnRUeXBlOiBudW1iZXI7XHJcbiAgXHJcbiAgLyoqIFNlbGVjdGVkIHZhbHVlcyAqL1xyXG4gIHB1YmxpYyByZWFkb25seSB2YWx1ZXM6IHN0cmluZ1tdO1xyXG4gIFxyXG4gIGNvbnN0cnVjdG9yKGNsaWVudDogQ2xpZW50LCBkYXRhOiBBUElJbnRlcmFjdGlvbikge1xyXG4gICAgc3VwZXIoY2xpZW50LCBkYXRhKTtcclxuICAgIHRoaXMuY29tcG9uZW50VHlwZSA9IGRhdGEuZGF0YT8uY29tcG9uZW50X3R5cGUgPz8gMztcclxuICAgIHRoaXMuY3VzdG9tSWQgPSBkYXRhLmRhdGE/LmN1c3RvbV9pZCB8fCAnJztcclxuICAgIHRoaXMudmFsdWVzID0gZGF0YS5kYXRhPy52YWx1ZXMgfHwgW107XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTaG93IGEgbW9kYWwgaW4gcmVzcG9uc2UgdG8gdGhpcyBzZWxlY3QgbWVudSBpbnRlcmFjdGlvblxyXG4gICAqL1xyXG4gIGFzeW5jIHNob3dNb2RhbChtb2RhbDogTW9kYWxEYXRhIHwgeyB0b0pTT04oKTogTW9kYWxEYXRhIH0pOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGlmICh0aGlzLnJlcGxpZWQgfHwgdGhpcy5kZWZlcnJlZCkgdGhyb3cgbmV3IEVycm9yKCdJbnRlcmFjdGlvbiBoYXMgYWxyZWFkeSBiZWVuIHJlcGxpZWQgdG8gb3IgZGVmZXJyZWQnKTtcclxuICAgIGNvbnN0IG1vZGFsRGF0YSA9ICd0b0pTT04nIGluIG1vZGFsICYmIHR5cGVvZiBtb2RhbC50b0pTT04gPT09ICdmdW5jdGlvbicgPyBtb2RhbC50b0pTT04oKSA6IG1vZGFsO1xyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5jcmVhdGVJbnRlcmFjdGlvblJlc3BvbnNlKHRoaXMuaWQsIHRoaXMudG9rZW4sIHtcclxuICAgICAgdHlwZTogSW50ZXJhY3Rpb25SZXNwb25zZVR5cGUuTW9kYWwsXHJcbiAgICAgIGRhdGE6IG1vZGFsRGF0YVxyXG4gICAgfSk7XHJcbiAgICB0aGlzLnJlcGxpZWQgPSB0cnVlO1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIE1vZGFsIHN1Ym1pdCBpbnRlcmFjdGlvblxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIE1vZGFsU3VibWl0SW50ZXJhY3Rpb24gZXh0ZW5kcyBNZXNzYWdlQ29tcG9uZW50SW50ZXJhY3Rpb24ge1xyXG4gIC8qKiBNb2RhbCBjdXN0b20gSUQgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgY3VzdG9tSWQ6IHN0cmluZztcclxuICBcclxuICAvKiogTW9kYWwgZmllbGRzICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGZpZWxkczogTW9kYWxGaWVsZHM7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGNsaWVudDogQ2xpZW50LCBkYXRhOiBBUElJbnRlcmFjdGlvbikge1xyXG4gICAgc3VwZXIoY2xpZW50LCBkYXRhKTtcclxuICAgIHRoaXMuY3VzdG9tSWQgPSBkYXRhLmRhdGE/LmN1c3RvbV9pZCB8fCAnJztcclxuICAgIC8vIE1vZGFsIHZhbHVlcyBjb21lIGZyb20gY29tcG9uZW50cyBhcnJheSwgb3IgYXMgSlNPTiBzdHJpbmcgaW4gdmFsdWVzWzBdIChiYWNrZW5kIGNvbXBhdClcclxuICAgIGxldCBjb21wb25lbnRzID0gKGRhdGEuZGF0YSBhcyBhbnkpPy5jb21wb25lbnRzIHx8IFtdO1xyXG4gICAgaWYgKGNvbXBvbmVudHMubGVuZ3RoID09PSAwICYmIChkYXRhLmRhdGEgYXMgYW55KT8udmFsdWVzPy5sZW5ndGggPiAwKSB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZSgoZGF0YS5kYXRhIGFzIGFueSkudmFsdWVzWzBdKTtcclxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShwYXJzZWQpKSBjb21wb25lbnRzID0gcGFyc2VkO1xyXG4gICAgICB9IGNhdGNoIHt9XHJcbiAgICB9XHJcbiAgICB0aGlzLmZpZWxkcyA9IG5ldyBNb2RhbEZpZWxkcyhjb21wb25lbnRzKTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBNb2RhbCBmaWVsZHMgaGVscGVyXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgTW9kYWxGaWVsZHMge1xyXG4gIHByaXZhdGUgZmllbGRNYXA6IE1hcDxzdHJpbmcsIHN0cmluZz47XHJcblxyXG4gIGNvbnN0cnVjdG9yKGNvbXBvbmVudHM6IGFueVtdKSB7XHJcbiAgICB0aGlzLmZpZWxkTWFwID0gbmV3IE1hcCgpO1xyXG4gICAgLy8gUGFyc2UgYWN0aW9uIHJvd3Mg4oaSIHRleHQgaW5wdXRzXHJcbiAgICBmb3IgKGNvbnN0IHJvdyBvZiBjb21wb25lbnRzKSB7XHJcbiAgICAgIGNvbnN0IGlubmVyQ29tcG9uZW50cyA9IHJvdz8uY29tcG9uZW50cyB8fCBbXTtcclxuICAgICAgZm9yIChjb25zdCBjb21wIG9mIGlubmVyQ29tcG9uZW50cykge1xyXG4gICAgICAgIGlmIChjb21wLmN1c3RvbV9pZCAmJiBjb21wLnZhbHVlICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgIHRoaXMuZmllbGRNYXAuc2V0KGNvbXAuY3VzdG9tX2lkLCBjb21wLnZhbHVlKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhIHRleHQgaW5wdXQgdmFsdWUgYnkgY3VzdG9tX2lkXHJcbiAgICovXHJcbiAgZ2V0VGV4dElucHV0VmFsdWUoY3VzdG9tSWQ6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xyXG4gICAgcmV0dXJuIHRoaXMuZmllbGRNYXAuZ2V0KGN1c3RvbUlkKSA/PyBudWxsO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGEgZmllbGQgKGFsaWFzIGZvciBnZXRUZXh0SW5wdXRWYWx1ZSlcclxuICAgKi9cclxuICBnZXRGaWVsZChjdXN0b21JZDogc3RyaW5nKTogeyB2YWx1ZTogc3RyaW5nIH0gfCBudWxsIHtcclxuICAgIGNvbnN0IHZhbHVlID0gdGhpcy5maWVsZE1hcC5nZXQoY3VzdG9tSWQpO1xyXG4gICAgcmV0dXJuIHZhbHVlICE9PSB1bmRlZmluZWQgPyB7IHZhbHVlIH0gOiBudWxsO1xyXG4gIH1cclxufVxyXG5cclxuLy8gVHlwZXNcclxuZXhwb3J0IGludGVyZmFjZSBJbnRlcmFjdGlvblJlcGx5T3B0aW9ucyB7XHJcbiAgZmxhZ3M/OiBudW1iZXI7XHJcbiAgY29udGVudD86IHN0cmluZztcclxuICBlbWJlZHM/OiAoQVBJRW1iZWQgfCBFbWJlZEJ1aWxkZXIpW107XHJcbiAgY29tcG9uZW50cz86IGFueVtdO1xyXG4gIGVwaGVtZXJhbD86IGJvb2xlYW47XHJcbiAgZmlsZXM/OiBBcnJheTx7IG5hbWU6IHN0cmluZzsgZGF0YTogQnVmZmVyOyBjb250ZW50VHlwZT86IHN0cmluZyB9PjtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBBdXRvY29tcGxldGVDaG9pY2Uge1xyXG4gIG5hbWU6IHN0cmluZztcclxuICB2YWx1ZTogc3RyaW5nIHwgbnVtYmVyO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIE1vZGFsRGF0YSB7XHJcbiAgY3VzdG9tX2lkOiBzdHJpbmc7XHJcbiAgdGl0bGU6IHN0cmluZztcclxuICBjb21wb25lbnRzOiBhbnlbXTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENyZWF0ZSBhcHByb3ByaWF0ZSBpbnRlcmFjdGlvbiBjbGFzcyBiYXNlZCBvbiB0eXBlXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlSW50ZXJhY3Rpb24oY2xpZW50OiBDbGllbnQsIGRhdGE6IEFQSUludGVyYWN0aW9uKTogSW50ZXJhY3Rpb24ge1xyXG4gIHN3aXRjaCAoZGF0YS50eXBlKSB7XHJcbiAgICBjYXNlIEludGVyYWN0aW9uVHlwZS5BcHBsaWNhdGlvbkNvbW1hbmQ6XHJcbiAgICAgIHJldHVybiBuZXcgQ29tbWFuZEludGVyYWN0aW9uKGNsaWVudCwgZGF0YSk7XHJcbiAgICBjYXNlIEludGVyYWN0aW9uVHlwZS5BcHBsaWNhdGlvbkNvbW1hbmRBdXRvY29tcGxldGU6XHJcbiAgICAgIHJldHVybiBuZXcgQXV0b2NvbXBsZXRlSW50ZXJhY3Rpb24oY2xpZW50LCBkYXRhKTtcclxuICAgIGNhc2UgSW50ZXJhY3Rpb25UeXBlLk1vZGFsU3VibWl0OlxyXG4gICAgICByZXR1cm4gbmV3IE1vZGFsU3VibWl0SW50ZXJhY3Rpb24oY2xpZW50LCBkYXRhKTtcclxuICAgIGNhc2UgSW50ZXJhY3Rpb25UeXBlLk1lc3NhZ2VDb21wb25lbnQ6XHJcbiAgICAgIC8vIEJ1dHRvbnMgYW5kIGFsbCBzdXBwb3J0ZWQgc2VsZWN0IG1lbnUgdmFyaWFudHNcclxuICAgICAgaWYgKGRhdGEuZGF0YT8uY29tcG9uZW50X3R5cGUgPT09IDIpIHtcclxuICAgICAgICByZXR1cm4gbmV3IEJ1dHRvbkludGVyYWN0aW9uKGNsaWVudCwgZGF0YSk7XHJcbiAgICAgIH0gZWxzZSBpZiAoWzMsIDUsIDYsIDcsIDhdLmluY2x1ZGVzKGRhdGEuZGF0YT8uY29tcG9uZW50X3R5cGUgPz8gMCkpIHtcclxuICAgICAgICByZXR1cm4gbmV3IFNlbGVjdE1lbnVJbnRlcmFjdGlvbihjbGllbnQsIGRhdGEpO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBuZXcgSW50ZXJhY3Rpb24oY2xpZW50LCBkYXRhKTtcclxuICAgIGRlZmF1bHQ6XHJcbiAgICAgIHJldHVybiBuZXcgSW50ZXJhY3Rpb24oY2xpZW50LCBkYXRhKTtcclxuICB9XHJcbn1cclxuIl19