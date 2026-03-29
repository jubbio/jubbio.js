"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModalFields = exports.ModalSubmitInteraction = exports.SelectMenuInteraction = exports.ButtonInteraction = exports.AutocompleteInteraction = exports.CommandInteractionOptions = exports.CommandInteraction = exports.Interaction = void 0;
exports.createInteraction = createInteraction;
const enums_1 = require("../enums");
const User_1 = require("./User");
const GuildMember_1 = require("./GuildMember");
const EmbedBuilder_1 = require("../builders/EmbedBuilder");
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
            const guild = client.guilds.get(this.guildId) || { id: this.guildId, ownerId: null };
            this.member = new GuildMember_1.GuildMember(client, guild, data.member);
        }
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
        const components = typeof options === 'string' ? undefined : options.components;
        const ephemeral = typeof options === 'string' ? false : options.ephemeral;
        // Convert EmbedBuilder instances to plain objects
        const embeds = rawEmbeds?.map(e => e instanceof EmbedBuilder_1.EmbedBuilder ? e.toJSON() : e);
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
        const components = typeof options === 'string' ? undefined : options.components;
        const files = typeof options === 'string' ? undefined : options.files;
        // Convert EmbedBuilder instances to plain objects
        const embeds = rawEmbeds?.map(e => e instanceof EmbedBuilder_1.EmbedBuilder ? e.toJSON() : e);
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
        this.options = new CommandInteractionOptions(data.data?.options || []);
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
    constructor(options) {
        this.options = options;
    }
    /**
     * Get a string option
     */
    getString(name, required) {
        const option = this.options.find(o => o.name === name);
        if (!option && required)
            throw new Error(`Required option "${name}" not found`);
        return option?.value || null;
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
     * Get a user option
     */
    getUser(name, required) {
        const option = this.options.find(o => o.name === name);
        if (!option && required)
            throw new Error(`Required option "${name}" not found`);
        return option?.value || null;
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
        this.options = new CommandInteractionOptions(data.data?.options || []);
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
        await this.client.rest.createInteractionResponse(this.id, this.token, {
            type: enums_1.InteractionResponseType.UpdateMessage,
            data: {
                content: options.content,
                embeds,
                components: options.components
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
        await this.client.rest.createInteractionResponse(this.id, this.token, {
            type: enums_1.InteractionResponseType.UpdateMessage,
            data: {
                content: options.content,
                embeds,
                components: options.components
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSW50ZXJhY3Rpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvc3RydWN0dXJlcy9JbnRlcmFjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUF1Z0JBLDhDQW1CQztBQXpoQkQsb0NBQWtGO0FBQ2xGLGlDQUE4QjtBQUM5QiwrQ0FBNEM7QUFDNUMsMkRBQXdEO0FBR3hEOztHQUVHO0FBQ0gsTUFBYSxXQUFXO0lBQ3RCLDhCQUE4QjtJQUNkLE1BQU0sQ0FBUztJQUUvQixxQkFBcUI7SUFDTCxFQUFFLENBQVM7SUFFM0IscUJBQXFCO0lBQ0wsYUFBYSxDQUFTO0lBRXRDLHVCQUF1QjtJQUNQLElBQUksQ0FBa0I7SUFFdEMsZUFBZTtJQUNDLE9BQU8sQ0FBVTtJQUVqQyxpQkFBaUI7SUFDRCxTQUFTLENBQVU7SUFFbkMsd0JBQXdCO0lBQ1IsS0FBSyxDQUFTO0lBRTlCLHlDQUF5QztJQUN6QixJQUFJLENBQU87SUFFM0IsbUNBQW1DO0lBQ25CLE1BQU0sQ0FBZTtJQUVyQyxrREFBa0Q7SUFDM0MsT0FBTyxHQUFHLEtBQUssQ0FBQztJQUV2QixnREFBZ0Q7SUFDekMsUUFBUSxHQUFHLEtBQUssQ0FBQztJQUV4QixZQUFZLE1BQWMsRUFBRSxJQUFvQjtRQUM5QyxJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztRQUNyQixvQ0FBb0M7UUFDcEMsSUFBSSxDQUFDLEVBQUUsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQzFCLElBQUksQ0FBQyxhQUFhLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUNqRCxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7UUFDdEIsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxT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QUUsSUFBb0I7SUFDcEUsUUFBUSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDbEIsS0FBSyx1QkFBZSxDQUFDLGtCQUFrQjtZQUNyQyxPQUFPLElBQUksa0JBQWtCLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQzlDLEtBQUssdUJBQWUsQ0FBQyw4QkFBOEI7WUFDakQsT0FBTyxJQUFJLHVCQUF1QixDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNuRCxLQUFLLHVCQUFlLENBQUMsV0FBVztZQUM5QixPQUFPLElBQUksc0JBQXNCLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ2xELEtBQUssdUJBQWUsQ0FBQyxnQkFBZ0I7WUFDbkMsOENBQThDO1lBQzlDLElBQUksSUFBSSxDQUFDLElBQUksRUFBRSxjQUFjLEtBQUssQ0FBQyxFQUFFLENBQUM7Z0JBQ3BDLE9BQU8sSUFBSSxpQkFBaUIsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDN0MsQ0FBQztpQkFBTSxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUUsY0FBYyxLQUFLLENBQUMsRUFBRSxDQUFDO2dCQUMzQyxPQUFPLElBQUkscUJBQXFCLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ2pELENBQUM7WUFDRCxPQUFPLElBQUksV0FBVyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztRQUN2QztZQUNFLE9BQU8sSUFBSSxXQUFXLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ3pDLENBQUM7QUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQVBJSW50ZXJhY3Rpb24sIEFQSUludGVyYWN0aW9uT3B0aW9uLCBBUElFbWJlZCB9IGZyb20gJy4uL3R5cGVzJztcclxuaW1wb3J0IHsgSW50ZXJhY3Rpb25UeXBlLCBJbnRlcmFjdGlvblJlc3BvbnNlVHlwZSwgTWVzc2FnZUZsYWdzIH0gZnJvbSAnLi4vZW51bXMnO1xyXG5pbXBvcnQgeyBVc2VyIH0gZnJvbSAnLi9Vc2VyJztcclxuaW1wb3J0IHsgR3VpbGRNZW1iZXIgfSBmcm9tICcuL0d1aWxkTWVtYmVyJztcclxuaW1wb3J0IHsgRW1iZWRCdWlsZGVyIH0gZnJvbSAnLi4vYnVpbGRlcnMvRW1iZWRCdWlsZGVyJztcclxuaW1wb3J0IHR5cGUgeyBDbGllbnQgfSBmcm9tICcuLi9DbGllbnQnO1xyXG5cclxuLyoqXHJcbiAqIEJhc2UgaW50ZXJhY3Rpb24gY2xhc3NcclxuICovXHJcbmV4cG9ydCBjbGFzcyBJbnRlcmFjdGlvbiB7XHJcbiAgLyoqIFJlZmVyZW5jZSB0byB0aGUgY2xpZW50ICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGNsaWVudDogQ2xpZW50O1xyXG4gIFxyXG4gIC8qKiBJbnRlcmFjdGlvbiBJRCAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBpZDogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBBcHBsaWNhdGlvbiBJRCAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBhcHBsaWNhdGlvbklkOiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIEludGVyYWN0aW9uIHR5cGUgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgdHlwZTogSW50ZXJhY3Rpb25UeXBlO1xyXG4gIFxyXG4gIC8qKiBHdWlsZCBJRCAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBndWlsZElkPzogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBDaGFubmVsIElEICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGNoYW5uZWxJZD86IHN0cmluZztcclxuICBcclxuICAvKiogSW50ZXJhY3Rpb24gdG9rZW4gKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgdG9rZW46IHN0cmluZztcclxuICBcclxuICAvKiogVXNlciB3aG8gdHJpZ2dlcmVkIHRoZSBpbnRlcmFjdGlvbiAqL1xyXG4gIHB1YmxpYyByZWFkb25seSB1c2VyOiBVc2VyO1xyXG4gIFxyXG4gIC8qKiBHdWlsZCBtZW1iZXIgKGlmIGluIGEgZ3VpbGQpICovXHJcbiAgcHVibGljIHJlYWRvbmx5IG1lbWJlcj86IEd1aWxkTWVtYmVyO1xyXG4gIFxyXG4gIC8qKiBXaGV0aGVyIHRoZSBpbnRlcmFjdGlvbiBoYXMgYmVlbiByZXBsaWVkIHRvICovXHJcbiAgcHVibGljIHJlcGxpZWQgPSBmYWxzZTtcclxuICBcclxuICAvKiogV2hldGhlciB0aGUgaW50ZXJhY3Rpb24gaGFzIGJlZW4gZGVmZXJyZWQgKi9cclxuICBwdWJsaWMgZGVmZXJyZWQgPSBmYWxzZTtcclxuXHJcbiAgY29uc3RydWN0b3IoY2xpZW50OiBDbGllbnQsIGRhdGE6IEFQSUludGVyYWN0aW9uKSB7XHJcbiAgICB0aGlzLmNsaWVudCA9IGNsaWVudDtcclxuICAgIC8vIEhhbmRsZSBib3RoIHN0cmluZyBhbmQgbnVtYmVyIElEc1xyXG4gICAgdGhpcy5pZCA9IFN0cmluZyhkYXRhLmlkKTtcclxuICAgIHRoaXMuYXBwbGljYXRpb25JZCA9IFN0cmluZyhkYXRhLmFwcGxpY2F0aW9uX2lkKTtcclxuICAgIHRoaXMudHlwZSA9IGRhdGEudHlwZTtcclxuICAgIHRoaXMuZ3VpbGRJZCA9IGRhdGEuZ3VpbGRfaWQgPyBTdHJpbmcoZGF0YS5ndWlsZF9pZCkgOiB1bmRlZmluZWQ7XHJcbiAgICB0aGlzLmNoYW5uZWxJZCA9IGRhdGEuY2hhbm5lbF9pZCA/IFN0cmluZyhkYXRhLmNoYW5uZWxfaWQpIDogdW5kZWZpbmVkO1xyXG4gICAgdGhpcy50b2tlbiA9IGRhdGEudG9rZW47XHJcbiAgICBcclxuICAgIC8vIFVzZXIgY2FuIGNvbWUgZnJvbSBtZW1iZXIudXNlciBvciBkaXJlY3RseSBmcm9tIHVzZXJcclxuICAgIGNvbnN0IHVzZXJEYXRhID0gZGF0YS5tZW1iZXI/LnVzZXIgfHwgZGF0YS51c2VyO1xyXG4gICAgdGhpcy51c2VyID0gdXNlckRhdGEgPyBuZXcgVXNlcih1c2VyRGF0YSkgOiBuZXcgVXNlcih7IGlkOiAnMCcsIHVzZXJuYW1lOiAnVW5rbm93bicgfSk7XHJcbiAgICBcclxuICAgIC8vIENyZWF0ZSBtZW1iZXIgaWYgaW4gZ3VpbGRcclxuICAgIGlmIChkYXRhLm1lbWJlciAmJiB0aGlzLmd1aWxkSWQpIHtcclxuICAgICAgY29uc3QgZ3VpbGQgPSBjbGllbnQuZ3VpbGRzLmdldCh0aGlzLmd1aWxkSWQpIHx8IHsgaWQ6IHRoaXMuZ3VpbGRJZCwgb3duZXJJZDogbnVsbCB9IGFzIGFueTtcclxuICAgICAgdGhpcy5tZW1iZXIgPSBuZXcgR3VpbGRNZW1iZXIoY2xpZW50LCBndWlsZCwgZGF0YS5tZW1iZXIpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2hlY2sgaWYgdGhpcyBpcyBhIGNvbW1hbmQgaW50ZXJhY3Rpb25cclxuICAgKi9cclxuICBpc0NvbW1hbmQoKTogdGhpcyBpcyBDb21tYW5kSW50ZXJhY3Rpb24ge1xyXG4gICAgcmV0dXJuIHRoaXMudHlwZSA9PT0gSW50ZXJhY3Rpb25UeXBlLkFwcGxpY2F0aW9uQ29tbWFuZDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENoZWNrIGlmIHRoaXMgaXMgYW4gYXV0b2NvbXBsZXRlIGludGVyYWN0aW9uXHJcbiAgICovXHJcbiAgaXNBdXRvY29tcGxldGUoKTogdGhpcyBpcyBBdXRvY29tcGxldGVJbnRlcmFjdGlvbiB7XHJcbiAgICByZXR1cm4gdGhpcy50eXBlID09PSBJbnRlcmFjdGlvblR5cGUuQXBwbGljYXRpb25Db21tYW5kQXV0b2NvbXBsZXRlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2hlY2sgaWYgdGhpcyBpcyBhIG1vZGFsIHN1Ym1pdCBpbnRlcmFjdGlvblxyXG4gICAqL1xyXG4gIGlzTW9kYWxTdWJtaXQoKTogdGhpcyBpcyBNb2RhbFN1Ym1pdEludGVyYWN0aW9uIHtcclxuICAgIHJldHVybiB0aGlzLnR5cGUgPT09IEludGVyYWN0aW9uVHlwZS5Nb2RhbFN1Ym1pdDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENoZWNrIGlmIHRoaXMgaXMgYSBidXR0b24gaW50ZXJhY3Rpb25cclxuICAgKi9cclxuICBpc0J1dHRvbigpOiB0aGlzIGlzIEJ1dHRvbkludGVyYWN0aW9uIHtcclxuICAgIHJldHVybiB0aGlzLnR5cGUgPT09IEludGVyYWN0aW9uVHlwZS5NZXNzYWdlQ29tcG9uZW50ICYmICh0aGlzIGFzIGFueSkuY29tcG9uZW50VHlwZSA9PT0gMjtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENoZWNrIGlmIHRoaXMgaXMgYSBzZWxlY3QgbWVudSBpbnRlcmFjdGlvblxyXG4gICAqL1xyXG4gIGlzU2VsZWN0TWVudSgpOiB0aGlzIGlzIFNlbGVjdE1lbnVJbnRlcmFjdGlvbiB7XHJcbiAgICByZXR1cm4gdGhpcy50eXBlID09PSBJbnRlcmFjdGlvblR5cGUuTWVzc2FnZUNvbXBvbmVudCAmJiAodGhpcyBhcyBhbnkpLmNvbXBvbmVudFR5cGUgPT09IDM7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBbGlhcyBmb3IgaXNTZWxlY3RNZW51IChEaXNjb3JkLmpzIGNvbXBhdGliaWxpdHkpXHJcbiAgICovXHJcbiAgaXNTdHJpbmdTZWxlY3RNZW51KCk6IHRoaXMgaXMgU2VsZWN0TWVudUludGVyYWN0aW9uIHtcclxuICAgIHJldHVybiB0aGlzLmlzU2VsZWN0TWVudSgpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVwbHkgdG8gdGhlIGludGVyYWN0aW9uXHJcbiAgICovXHJcbiAgYXN5bmMgcmVwbHkob3B0aW9uczogc3RyaW5nIHwgSW50ZXJhY3Rpb25SZXBseU9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGlmICh0aGlzLnJlcGxpZWQgfHwgdGhpcy5kZWZlcnJlZCkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludGVyYWN0aW9uIGhhcyBhbHJlYWR5IGJlZW4gcmVwbGllZCB0byBvciBkZWZlcnJlZCcpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBjb25zdCBjb250ZW50ID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gb3B0aW9ucyA6IG9wdGlvbnMuY29udGVudDtcclxuICAgIGNvbnN0IHJhd0VtYmVkcyA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IHVuZGVmaW5lZCA6IG9wdGlvbnMuZW1iZWRzO1xyXG4gICAgY29uc3QgY29tcG9uZW50cyA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IHVuZGVmaW5lZCA6IG9wdGlvbnMuY29tcG9uZW50cztcclxuICAgIGNvbnN0IGVwaGVtZXJhbCA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IGZhbHNlIDogb3B0aW9ucy5lcGhlbWVyYWw7XHJcbiAgICBcclxuICAgIC8vIENvbnZlcnQgRW1iZWRCdWlsZGVyIGluc3RhbmNlcyB0byBwbGFpbiBvYmplY3RzXHJcbiAgICBjb25zdCBlbWJlZHMgPSByYXdFbWJlZHM/Lm1hcChlID0+IGUgaW5zdGFuY2VvZiBFbWJlZEJ1aWxkZXIgPyBlLnRvSlNPTigpIDogZSk7XHJcbiAgICBcclxuICAgIGF3YWl0IHRoaXMuY2xpZW50LnJlc3QuY3JlYXRlSW50ZXJhY3Rpb25SZXNwb25zZSh0aGlzLmlkLCB0aGlzLnRva2VuLCB7XHJcbiAgICAgIHR5cGU6IEludGVyYWN0aW9uUmVzcG9uc2VUeXBlLkNoYW5uZWxNZXNzYWdlV2l0aFNvdXJjZSxcclxuICAgICAgZGF0YToge1xyXG4gICAgICAgIGNvbnRlbnQsXHJcbiAgICAgICAgZW1iZWRzLFxyXG4gICAgICAgIGNvbXBvbmVudHMsXHJcbiAgICAgICAgZmxhZ3M6IGVwaGVtZXJhbCA/IE1lc3NhZ2VGbGFncy5FcGhlbWVyYWwgOiAwXHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICB0aGlzLnJlcGxpZWQgPSB0cnVlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVmZXIgdGhlIHJlcGx5IChzaG93cyBcInRoaW5raW5nLi4uXCIpXHJcbiAgICovXHJcbiAgYXN5bmMgZGVmZXJSZXBseShvcHRpb25zPzogeyBlcGhlbWVyYWw/OiBib29sZWFuIH0pOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGlmICh0aGlzLnJlcGxpZWQgfHwgdGhpcy5kZWZlcnJlZCkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludGVyYWN0aW9uIGhhcyBhbHJlYWR5IGJlZW4gcmVwbGllZCB0byBvciBkZWZlcnJlZCcpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LmNyZWF0ZUludGVyYWN0aW9uUmVzcG9uc2UodGhpcy5pZCwgdGhpcy50b2tlbiwge1xyXG4gICAgICB0eXBlOiBJbnRlcmFjdGlvblJlc3BvbnNlVHlwZS5EZWZlcnJlZENoYW5uZWxNZXNzYWdlV2l0aFNvdXJjZSxcclxuICAgICAgZGF0YTogb3B0aW9ucz8uZXBoZW1lcmFsID8geyBmbGFnczogTWVzc2FnZUZsYWdzLkVwaGVtZXJhbCB9IDogdW5kZWZpbmVkXHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgdGhpcy5kZWZlcnJlZCA9IHRydWU7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBFZGl0IHRoZSByZXBseVxyXG4gICAqL1xyXG4gIGFzeW5jIGVkaXRSZXBseShvcHRpb25zOiBzdHJpbmcgfCBJbnRlcmFjdGlvblJlcGx5T3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgY29udGVudCA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IG9wdGlvbnMgOiBvcHRpb25zLmNvbnRlbnQ7XHJcbiAgICBjb25zdCByYXdFbWJlZHMgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyB1bmRlZmluZWQgOiBvcHRpb25zLmVtYmVkcztcclxuICAgIGNvbnN0IGNvbXBvbmVudHMgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyB1bmRlZmluZWQgOiBvcHRpb25zLmNvbXBvbmVudHM7XHJcbiAgICBjb25zdCBmaWxlcyA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IHVuZGVmaW5lZCA6IG9wdGlvbnMuZmlsZXM7XHJcbiAgICBcclxuICAgIC8vIENvbnZlcnQgRW1iZWRCdWlsZGVyIGluc3RhbmNlcyB0byBwbGFpbiBvYmplY3RzXHJcbiAgICBjb25zdCBlbWJlZHMgPSByYXdFbWJlZHM/Lm1hcChlID0+IGUgaW5zdGFuY2VvZiBFbWJlZEJ1aWxkZXIgPyBlLnRvSlNPTigpIDogZSk7XHJcbiAgICBcclxuICAgIGF3YWl0IHRoaXMuY2xpZW50LnJlc3QuZWRpdEludGVyYWN0aW9uUmVzcG9uc2UodGhpcy50b2tlbiwge1xyXG4gICAgICBjb250ZW50LFxyXG4gICAgICBlbWJlZHMsXHJcbiAgICAgIGNvbXBvbmVudHMsXHJcbiAgICAgIGZpbGVzXHJcbiAgICB9LCB0aGlzLmd1aWxkSWQsIHRoaXMuY2hhbm5lbElkLCB0aGlzLmlkKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlbGV0ZSB0aGUgcmVwbHlcclxuICAgKi9cclxuICBhc3luYyBkZWxldGVSZXBseSgpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGF3YWl0IHRoaXMuY2xpZW50LnJlc3QuZGVsZXRlSW50ZXJhY3Rpb25SZXNwb25zZSh0aGlzLnRva2VuKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNlbmQgYSBmb2xsb3d1cCBtZXNzYWdlXHJcbiAgICovXHJcbiAgYXN5bmMgZm9sbG93VXAob3B0aW9uczogc3RyaW5nIHwgSW50ZXJhY3Rpb25SZXBseU9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IGNvbnRlbnQgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyBvcHRpb25zIDogb3B0aW9ucy5jb250ZW50O1xyXG4gICAgY29uc3QgcmF3RW1iZWRzID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gdW5kZWZpbmVkIDogb3B0aW9ucy5lbWJlZHM7XHJcbiAgICBjb25zdCBlcGhlbWVyYWwgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyBmYWxzZSA6IG9wdGlvbnMuZXBoZW1lcmFsO1xyXG4gICAgXHJcbiAgICAvLyBDb252ZXJ0IEVtYmVkQnVpbGRlciBpbnN0YW5jZXMgdG8gcGxhaW4gb2JqZWN0c1xyXG4gICAgY29uc3QgZW1iZWRzID0gcmF3RW1iZWRzPy5tYXAoZSA9PiBlIGluc3RhbmNlb2YgRW1iZWRCdWlsZGVyID8gZS50b0pTT04oKSA6IGUpO1xyXG4gICAgXHJcbiAgICBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LmNyZWF0ZUZvbGxvd3VwKHRoaXMudG9rZW4sIHtcclxuICAgICAgY29udGVudCxcclxuICAgICAgZW1iZWRzLFxyXG4gICAgICBmbGFnczogZXBoZW1lcmFsID8gTWVzc2FnZUZsYWdzLkVwaGVtZXJhbCA6IDBcclxuICAgIH0pO1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIENvbW1hbmQgaW50ZXJhY3Rpb25cclxuICovXHJcbmV4cG9ydCBjbGFzcyBDb21tYW5kSW50ZXJhY3Rpb24gZXh0ZW5kcyBJbnRlcmFjdGlvbiB7XHJcbiAgLyoqIENvbW1hbmQgbmFtZSAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBjb21tYW5kTmFtZTogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBDb21tYW5kIG9wdGlvbnMgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgb3B0aW9uczogQ29tbWFuZEludGVyYWN0aW9uT3B0aW9ucztcclxuXHJcbiAgY29uc3RydWN0b3IoY2xpZW50OiBDbGllbnQsIGRhdGE6IEFQSUludGVyYWN0aW9uKSB7XHJcbiAgICBzdXBlcihjbGllbnQsIGRhdGEpO1xyXG4gICAgdGhpcy5jb21tYW5kTmFtZSA9IGRhdGEuZGF0YT8ubmFtZSB8fCAnJztcclxuICAgIHRoaXMub3B0aW9ucyA9IG5ldyBDb21tYW5kSW50ZXJhY3Rpb25PcHRpb25zKGRhdGEuZGF0YT8ub3B0aW9ucyB8fCBbXSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTaG93IGEgbW9kYWxcclxuICAgKi9cclxuICBhc3luYyBzaG93TW9kYWwobW9kYWw6IE1vZGFsRGF0YSB8IHsgdG9KU09OKCk6IE1vZGFsRGF0YSB9KTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBtb2RhbERhdGEgPSAndG9KU09OJyBpbiBtb2RhbCAmJiB0eXBlb2YgbW9kYWwudG9KU09OID09PSAnZnVuY3Rpb24nID8gbW9kYWwudG9KU09OKCkgOiBtb2RhbDtcclxuICAgIGF3YWl0IHRoaXMuY2xpZW50LnJlc3QuY3JlYXRlSW50ZXJhY3Rpb25SZXNwb25zZSh0aGlzLmlkLCB0aGlzLnRva2VuLCB7XHJcbiAgICAgIHR5cGU6IEludGVyYWN0aW9uUmVzcG9uc2VUeXBlLk1vZGFsLFxyXG4gICAgICBkYXRhOiBtb2RhbERhdGFcclxuICAgIH0pO1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIENvbW1hbmQgaW50ZXJhY3Rpb24gb3B0aW9ucyBoZWxwZXJcclxuICovXHJcbmV4cG9ydCBjbGFzcyBDb21tYW5kSW50ZXJhY3Rpb25PcHRpb25zIHtcclxuICBwcml2YXRlIG9wdGlvbnM6IEFQSUludGVyYWN0aW9uT3B0aW9uW107XHJcblxyXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnM6IEFQSUludGVyYWN0aW9uT3B0aW9uW10pIHtcclxuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSBzdHJpbmcgb3B0aW9uXHJcbiAgICovXHJcbiAgZ2V0U3RyaW5nKG5hbWU6IHN0cmluZywgcmVxdWlyZWQ/OiBib29sZWFuKTogc3RyaW5nIHwgbnVsbCB7XHJcbiAgICBjb25zdCBvcHRpb24gPSB0aGlzLm9wdGlvbnMuZmluZChvID0+IG8ubmFtZSA9PT0gbmFtZSk7XHJcbiAgICBpZiAoIW9wdGlvbiAmJiByZXF1aXJlZCkgdGhyb3cgbmV3IEVycm9yKGBSZXF1aXJlZCBvcHRpb24gXCIke25hbWV9XCIgbm90IGZvdW5kYCk7XHJcbiAgICByZXR1cm4gb3B0aW9uPy52YWx1ZSBhcyBzdHJpbmcgfHwgbnVsbDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhbiBpbnRlZ2VyIG9wdGlvblxyXG4gICAqL1xyXG4gIGdldEludGVnZXIobmFtZTogc3RyaW5nLCByZXF1aXJlZD86IGJvb2xlYW4pOiBudW1iZXIgfCBudWxsIHtcclxuICAgIGNvbnN0IG9wdGlvbiA9IHRoaXMub3B0aW9ucy5maW5kKG8gPT4gby5uYW1lID09PSBuYW1lKTtcclxuICAgIGlmICghb3B0aW9uICYmIHJlcXVpcmVkKSB0aHJvdyBuZXcgRXJyb3IoYFJlcXVpcmVkIG9wdGlvbiBcIiR7bmFtZX1cIiBub3QgZm91bmRgKTtcclxuICAgIHJldHVybiBvcHRpb24/LnZhbHVlIGFzIG51bWJlciB8fCBudWxsO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGEgbnVtYmVyIG9wdGlvblxyXG4gICAqL1xyXG4gIGdldE51bWJlcihuYW1lOiBzdHJpbmcsIHJlcXVpcmVkPzogYm9vbGVhbik6IG51bWJlciB8IG51bGwge1xyXG4gICAgcmV0dXJuIHRoaXMuZ2V0SW50ZWdlcihuYW1lLCByZXF1aXJlZCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSBib29sZWFuIG9wdGlvblxyXG4gICAqL1xyXG4gIGdldEJvb2xlYW4obmFtZTogc3RyaW5nLCByZXF1aXJlZD86IGJvb2xlYW4pOiBib29sZWFuIHwgbnVsbCB7XHJcbiAgICBjb25zdCBvcHRpb24gPSB0aGlzLm9wdGlvbnMuZmluZChvID0+IG8ubmFtZSA9PT0gbmFtZSk7XHJcbiAgICBpZiAoIW9wdGlvbiAmJiByZXF1aXJlZCkgdGhyb3cgbmV3IEVycm9yKGBSZXF1aXJlZCBvcHRpb24gXCIke25hbWV9XCIgbm90IGZvdW5kYCk7XHJcbiAgICByZXR1cm4gb3B0aW9uPy52YWx1ZSBhcyBib29sZWFuID8/IG51bGw7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSB1c2VyIG9wdGlvblxyXG4gICAqL1xyXG4gIGdldFVzZXIobmFtZTogc3RyaW5nLCByZXF1aXJlZD86IGJvb2xlYW4pOiBzdHJpbmcgfCBudWxsIHtcclxuICAgIGNvbnN0IG9wdGlvbiA9IHRoaXMub3B0aW9ucy5maW5kKG8gPT4gby5uYW1lID09PSBuYW1lKTtcclxuICAgIGlmICghb3B0aW9uICYmIHJlcXVpcmVkKSB0aHJvdyBuZXcgRXJyb3IoYFJlcXVpcmVkIG9wdGlvbiBcIiR7bmFtZX1cIiBub3QgZm91bmRgKTtcclxuICAgIHJldHVybiBvcHRpb24/LnZhbHVlIGFzIHN0cmluZyB8fCBudWxsO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGEgY2hhbm5lbCBvcHRpb25cclxuICAgKi9cclxuICBnZXRDaGFubmVsKG5hbWU6IHN0cmluZywgcmVxdWlyZWQ/OiBib29sZWFuKTogc3RyaW5nIHwgbnVsbCB7XHJcbiAgICBjb25zdCBvcHRpb24gPSB0aGlzLm9wdGlvbnMuZmluZChvID0+IG8ubmFtZSA9PT0gbmFtZSk7XHJcbiAgICBpZiAoIW9wdGlvbiAmJiByZXF1aXJlZCkgdGhyb3cgbmV3IEVycm9yKGBSZXF1aXJlZCBvcHRpb24gXCIke25hbWV9XCIgbm90IGZvdW5kYCk7XHJcbiAgICByZXR1cm4gb3B0aW9uPy52YWx1ZSBhcyBzdHJpbmcgfHwgbnVsbDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhIHN1YmNvbW1hbmQgbmFtZVxyXG4gICAqL1xyXG4gIGdldFN1YmNvbW1hbmQocmVxdWlyZWQ/OiBib29sZWFuKTogc3RyaW5nIHwgbnVsbCB7XHJcbiAgICBjb25zdCBvcHRpb24gPSB0aGlzLm9wdGlvbnMuZmluZChvID0+IG8udHlwZSA9PT0gMSk7XHJcbiAgICBpZiAoIW9wdGlvbiAmJiByZXF1aXJlZCkgdGhyb3cgbmV3IEVycm9yKCdSZXF1aXJlZCBzdWJjb21tYW5kIG5vdCBmb3VuZCcpO1xyXG4gICAgcmV0dXJuIG9wdGlvbj8ubmFtZSB8fCBudWxsO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IHRoZSBmb2N1c2VkIG9wdGlvbiAoZm9yIGF1dG9jb21wbGV0ZSlcclxuICAgKi9cclxuICBnZXRGb2N1c2VkKCk6IHsgbmFtZTogc3RyaW5nOyB2YWx1ZTogc3RyaW5nIH0gfCBudWxsIHtcclxuICAgIGNvbnN0IG9wdGlvbiA9IHRoaXMub3B0aW9ucy5maW5kKG8gPT4gby5mb2N1c2VkKTtcclxuICAgIGlmICghb3B0aW9uKSByZXR1cm4gbnVsbDtcclxuICAgIHJldHVybiB7IG5hbWU6IG9wdGlvbi5uYW1lLCB2YWx1ZTogb3B0aW9uLnZhbHVlIGFzIHN0cmluZyB9O1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIEF1dG9jb21wbGV0ZSBpbnRlcmFjdGlvblxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIEF1dG9jb21wbGV0ZUludGVyYWN0aW9uIGV4dGVuZHMgSW50ZXJhY3Rpb24ge1xyXG4gIC8qKiBDb21tYW5kIG5hbWUgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgY29tbWFuZE5hbWU6IHN0cmluZztcclxuICBcclxuICAvKiogQ29tbWFuZCBvcHRpb25zICovXHJcbiAgcHVibGljIHJlYWRvbmx5IG9wdGlvbnM6IENvbW1hbmRJbnRlcmFjdGlvbk9wdGlvbnM7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGNsaWVudDogQ2xpZW50LCBkYXRhOiBBUElJbnRlcmFjdGlvbikge1xyXG4gICAgc3VwZXIoY2xpZW50LCBkYXRhKTtcclxuICAgIHRoaXMuY29tbWFuZE5hbWUgPSBkYXRhLmRhdGE/Lm5hbWUgfHwgJyc7XHJcbiAgICB0aGlzLm9wdGlvbnMgPSBuZXcgQ29tbWFuZEludGVyYWN0aW9uT3B0aW9ucyhkYXRhLmRhdGE/Lm9wdGlvbnMgfHwgW10pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVzcG9uZCB3aXRoIGF1dG9jb21wbGV0ZSBjaG9pY2VzXHJcbiAgICovXHJcbiAgYXN5bmMgcmVzcG9uZChjaG9pY2VzOiBBdXRvY29tcGxldGVDaG9pY2VbXSk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5jcmVhdGVJbnRlcmFjdGlvblJlc3BvbnNlKHRoaXMuaWQsIHRoaXMudG9rZW4sIHtcclxuICAgICAgdHlwZTogSW50ZXJhY3Rpb25SZXNwb25zZVR5cGUuQXBwbGljYXRpb25Db21tYW5kQXV0b2NvbXBsZXRlUmVzdWx0LFxyXG4gICAgICBkYXRhOiB7IGNob2ljZXMgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogQnV0dG9uIGludGVyYWN0aW9uXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgQnV0dG9uSW50ZXJhY3Rpb24gZXh0ZW5kcyBJbnRlcmFjdGlvbiB7XHJcbiAgLyoqIEJ1dHRvbiBjdXN0b20gSUQgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgY3VzdG9tSWQ6IHN0cmluZztcclxuICBcclxuICAvKiogQ29tcG9uZW50IHR5cGUgKGFsd2F5cyAyIGZvciBidXR0b25zKSAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBjb21wb25lbnRUeXBlOiBudW1iZXIgPSAyO1xyXG4gIFxyXG4gIC8qKiBNZXNzYWdlIHRoZSBidXR0b24gaXMgYXR0YWNoZWQgdG8gKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgbWVzc2FnZT86IGFueTtcclxuXHJcbiAgY29uc3RydWN0b3IoY2xpZW50OiBDbGllbnQsIGRhdGE6IEFQSUludGVyYWN0aW9uKSB7XHJcbiAgICBzdXBlcihjbGllbnQsIGRhdGEpO1xyXG4gICAgdGhpcy5jdXN0b21JZCA9IGRhdGEuZGF0YT8uY3VzdG9tX2lkIHx8ICcnO1xyXG4gICAgdGhpcy5tZXNzYWdlID0gZGF0YS5tZXNzYWdlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVXBkYXRlIHRoZSBtZXNzYWdlIHRoZSBidXR0b24gaXMgYXR0YWNoZWQgdG9cclxuICAgKi9cclxuICBhc3luYyB1cGRhdGUob3B0aW9uczogSW50ZXJhY3Rpb25SZXBseU9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIC8vIENvbnZlcnQgRW1iZWRCdWlsZGVyIGluc3RhbmNlcyB0byBwbGFpbiBvYmplY3RzXHJcbiAgICBjb25zdCBlbWJlZHMgPSBvcHRpb25zLmVtYmVkcz8ubWFwKGUgPT4gZSBpbnN0YW5jZW9mIEVtYmVkQnVpbGRlciA/IGUudG9KU09OKCkgOiBlKTtcclxuICAgIFxyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5jcmVhdGVJbnRlcmFjdGlvblJlc3BvbnNlKHRoaXMuaWQsIHRoaXMudG9rZW4sIHtcclxuICAgICAgdHlwZTogSW50ZXJhY3Rpb25SZXNwb25zZVR5cGUuVXBkYXRlTWVzc2FnZSxcclxuICAgICAgZGF0YToge1xyXG4gICAgICAgIGNvbnRlbnQ6IG9wdGlvbnMuY29udGVudCxcclxuICAgICAgICBlbWJlZHMsXHJcbiAgICAgICAgY29tcG9uZW50czogb3B0aW9ucy5jb21wb25lbnRzXHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgdGhpcy5yZXBsaWVkID0gdHJ1ZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNob3cgYSBtb2RhbCBpbiByZXNwb25zZSB0byB0aGlzIGJ1dHRvbiBpbnRlcmFjdGlvblxyXG4gICAqL1xyXG4gIGFzeW5jIHNob3dNb2RhbChtb2RhbDogTW9kYWxEYXRhIHwgeyB0b0pTT04oKTogTW9kYWxEYXRhIH0pOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IG1vZGFsRGF0YSA9ICd0b0pTT04nIGluIG1vZGFsICYmIHR5cGVvZiBtb2RhbC50b0pTT04gPT09ICdmdW5jdGlvbicgPyBtb2RhbC50b0pTT04oKSA6IG1vZGFsO1xyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5jcmVhdGVJbnRlcmFjdGlvblJlc3BvbnNlKHRoaXMuaWQsIHRoaXMudG9rZW4sIHtcclxuICAgICAgdHlwZTogSW50ZXJhY3Rpb25SZXNwb25zZVR5cGUuTW9kYWwsXHJcbiAgICAgIGRhdGE6IG1vZGFsRGF0YVxyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogU2VsZWN0IG1lbnUgaW50ZXJhY3Rpb25cclxuICovXHJcbmV4cG9ydCBjbGFzcyBTZWxlY3RNZW51SW50ZXJhY3Rpb24gZXh0ZW5kcyBJbnRlcmFjdGlvbiB7XHJcbiAgLyoqIFNlbGVjdCBtZW51IGN1c3RvbSBJRCAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBjdXN0b21JZDogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBDb21wb25lbnQgdHlwZSAoYWx3YXlzIDMgZm9yIHNlbGVjdCBtZW51cykgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgY29tcG9uZW50VHlwZTogbnVtYmVyID0gMztcclxuICBcclxuICAvKiogU2VsZWN0ZWQgdmFsdWVzICovXHJcbiAgcHVibGljIHJlYWRvbmx5IHZhbHVlczogc3RyaW5nW107XHJcbiAgXHJcbiAgLyoqIE1lc3NhZ2UgdGhlIHNlbGVjdCBtZW51IGlzIGF0dGFjaGVkIHRvICovXHJcbiAgcHVibGljIHJlYWRvbmx5IG1lc3NhZ2U/OiBhbnk7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGNsaWVudDogQ2xpZW50LCBkYXRhOiBBUElJbnRlcmFjdGlvbikge1xyXG4gICAgc3VwZXIoY2xpZW50LCBkYXRhKTtcclxuICAgIHRoaXMuY3VzdG9tSWQgPSBkYXRhLmRhdGE/LmN1c3RvbV9pZCB8fCAnJztcclxuICAgIHRoaXMudmFsdWVzID0gZGF0YS5kYXRhPy52YWx1ZXMgfHwgW107XHJcbiAgICB0aGlzLm1lc3NhZ2UgPSBkYXRhLm1lc3NhZ2U7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBVcGRhdGUgdGhlIG1lc3NhZ2UgdGhlIHNlbGVjdCBtZW51IGlzIGF0dGFjaGVkIHRvXHJcbiAgICovXHJcbiAgYXN5bmMgdXBkYXRlKG9wdGlvbnM6IEludGVyYWN0aW9uUmVwbHlPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICAvLyBDb252ZXJ0IEVtYmVkQnVpbGRlciBpbnN0YW5jZXMgdG8gcGxhaW4gb2JqZWN0c1xyXG4gICAgY29uc3QgZW1iZWRzID0gb3B0aW9ucy5lbWJlZHM/Lm1hcChlID0+IGUgaW5zdGFuY2VvZiBFbWJlZEJ1aWxkZXIgPyBlLnRvSlNPTigpIDogZSk7XHJcbiAgICBcclxuICAgIGF3YWl0IHRoaXMuY2xpZW50LnJlc3QuY3JlYXRlSW50ZXJhY3Rpb25SZXNwb25zZSh0aGlzLmlkLCB0aGlzLnRva2VuLCB7XHJcbiAgICAgIHR5cGU6IEludGVyYWN0aW9uUmVzcG9uc2VUeXBlLlVwZGF0ZU1lc3NhZ2UsXHJcbiAgICAgIGRhdGE6IHtcclxuICAgICAgICBjb250ZW50OiBvcHRpb25zLmNvbnRlbnQsXHJcbiAgICAgICAgZW1iZWRzLFxyXG4gICAgICAgIGNvbXBvbmVudHM6IG9wdGlvbnMuY29tcG9uZW50c1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICAgIHRoaXMucmVwbGllZCA9IHRydWU7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTaG93IGEgbW9kYWwgaW4gcmVzcG9uc2UgdG8gdGhpcyBzZWxlY3QgbWVudSBpbnRlcmFjdGlvblxyXG4gICAqL1xyXG4gIGFzeW5jIHNob3dNb2RhbChtb2RhbDogTW9kYWxEYXRhIHwgeyB0b0pTT04oKTogTW9kYWxEYXRhIH0pOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IG1vZGFsRGF0YSA9ICd0b0pTT04nIGluIG1vZGFsICYmIHR5cGVvZiBtb2RhbC50b0pTT04gPT09ICdmdW5jdGlvbicgPyBtb2RhbC50b0pTT04oKSA6IG1vZGFsO1xyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5jcmVhdGVJbnRlcmFjdGlvblJlc3BvbnNlKHRoaXMuaWQsIHRoaXMudG9rZW4sIHtcclxuICAgICAgdHlwZTogSW50ZXJhY3Rpb25SZXNwb25zZVR5cGUuTW9kYWwsXHJcbiAgICAgIGRhdGE6IG1vZGFsRGF0YVxyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogTW9kYWwgc3VibWl0IGludGVyYWN0aW9uXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgTW9kYWxTdWJtaXRJbnRlcmFjdGlvbiBleHRlbmRzIEludGVyYWN0aW9uIHtcclxuICAvKiogTW9kYWwgY3VzdG9tIElEICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGN1c3RvbUlkOiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIE1vZGFsIGZpZWxkcyAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBmaWVsZHM6IE1vZGFsRmllbGRzO1xyXG5cclxuICBjb25zdHJ1Y3RvcihjbGllbnQ6IENsaWVudCwgZGF0YTogQVBJSW50ZXJhY3Rpb24pIHtcclxuICAgIHN1cGVyKGNsaWVudCwgZGF0YSk7XHJcbiAgICB0aGlzLmN1c3RvbUlkID0gZGF0YS5kYXRhPy5jdXN0b21faWQgfHwgJyc7XHJcbiAgICAvLyBNb2RhbCB2YWx1ZXMgY29tZSBmcm9tIGNvbXBvbmVudHMgYXJyYXksIG9yIGFzIEpTT04gc3RyaW5nIGluIHZhbHVlc1swXSAoYmFja2VuZCBjb21wYXQpXHJcbiAgICBsZXQgY29tcG9uZW50cyA9IChkYXRhLmRhdGEgYXMgYW55KT8uY29tcG9uZW50cyB8fCBbXTtcclxuICAgIGlmIChjb21wb25lbnRzLmxlbmd0aCA9PT0gMCAmJiAoZGF0YS5kYXRhIGFzIGFueSk/LnZhbHVlcz8ubGVuZ3RoID4gMCkge1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGNvbnN0IHBhcnNlZCA9IEpTT04ucGFyc2UoKGRhdGEuZGF0YSBhcyBhbnkpLnZhbHVlc1swXSk7XHJcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkocGFyc2VkKSkgY29tcG9uZW50cyA9IHBhcnNlZDtcclxuICAgICAgfSBjYXRjaCB7fVxyXG4gICAgfVxyXG4gICAgdGhpcy5maWVsZHMgPSBuZXcgTW9kYWxGaWVsZHMoY29tcG9uZW50cyk7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogTW9kYWwgZmllbGRzIGhlbHBlclxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIE1vZGFsRmllbGRzIHtcclxuICBwcml2YXRlIGZpZWxkTWFwOiBNYXA8c3RyaW5nLCBzdHJpbmc+O1xyXG5cclxuICBjb25zdHJ1Y3Rvcihjb21wb25lbnRzOiBhbnlbXSkge1xyXG4gICAgdGhpcy5maWVsZE1hcCA9IG5ldyBNYXAoKTtcclxuICAgIC8vIFBhcnNlIGFjdGlvbiByb3dzIOKGkiB0ZXh0IGlucHV0c1xyXG4gICAgZm9yIChjb25zdCByb3cgb2YgY29tcG9uZW50cykge1xyXG4gICAgICBjb25zdCBpbm5lckNvbXBvbmVudHMgPSByb3c/LmNvbXBvbmVudHMgfHwgW107XHJcbiAgICAgIGZvciAoY29uc3QgY29tcCBvZiBpbm5lckNvbXBvbmVudHMpIHtcclxuICAgICAgICBpZiAoY29tcC5jdXN0b21faWQgJiYgY29tcC52YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICB0aGlzLmZpZWxkTWFwLnNldChjb21wLmN1c3RvbV9pZCwgY29tcC52YWx1ZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSB0ZXh0IGlucHV0IHZhbHVlIGJ5IGN1c3RvbV9pZFxyXG4gICAqL1xyXG4gIGdldFRleHRJbnB1dFZhbHVlKGN1c3RvbUlkOiBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcclxuICAgIHJldHVybiB0aGlzLmZpZWxkTWFwLmdldChjdXN0b21JZCkgPz8gbnVsbDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhIGZpZWxkIChhbGlhcyBmb3IgZ2V0VGV4dElucHV0VmFsdWUpXHJcbiAgICovXHJcbiAgZ2V0RmllbGQoY3VzdG9tSWQ6IHN0cmluZyk6IHsgdmFsdWU6IHN0cmluZyB9IHwgbnVsbCB7XHJcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMuZmllbGRNYXAuZ2V0KGN1c3RvbUlkKTtcclxuICAgIHJldHVybiB2YWx1ZSAhPT0gdW5kZWZpbmVkID8geyB2YWx1ZSB9IDogbnVsbDtcclxuICB9XHJcbn1cclxuXHJcbi8vIFR5cGVzXHJcbmV4cG9ydCBpbnRlcmZhY2UgSW50ZXJhY3Rpb25SZXBseU9wdGlvbnMge1xyXG4gIGNvbnRlbnQ/OiBzdHJpbmc7XHJcbiAgZW1iZWRzPzogKEFQSUVtYmVkIHwgRW1iZWRCdWlsZGVyKVtdO1xyXG4gIGNvbXBvbmVudHM/OiBhbnlbXTtcclxuICBlcGhlbWVyYWw/OiBib29sZWFuO1xyXG4gIGZpbGVzPzogQXJyYXk8eyBuYW1lOiBzdHJpbmc7IGRhdGE6IEJ1ZmZlcjsgY29udGVudFR5cGU/OiBzdHJpbmcgfT47XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgQXV0b2NvbXBsZXRlQ2hvaWNlIHtcclxuICBuYW1lOiBzdHJpbmc7XHJcbiAgdmFsdWU6IHN0cmluZyB8IG51bWJlcjtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBNb2RhbERhdGEge1xyXG4gIGN1c3RvbV9pZDogc3RyaW5nO1xyXG4gIHRpdGxlOiBzdHJpbmc7XHJcbiAgY29tcG9uZW50czogYW55W107XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDcmVhdGUgYXBwcm9wcmlhdGUgaW50ZXJhY3Rpb24gY2xhc3MgYmFzZWQgb24gdHlwZVxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUludGVyYWN0aW9uKGNsaWVudDogQ2xpZW50LCBkYXRhOiBBUElJbnRlcmFjdGlvbik6IEludGVyYWN0aW9uIHtcclxuICBzd2l0Y2ggKGRhdGEudHlwZSkge1xyXG4gICAgY2FzZSBJbnRlcmFjdGlvblR5cGUuQXBwbGljYXRpb25Db21tYW5kOlxyXG4gICAgICByZXR1cm4gbmV3IENvbW1hbmRJbnRlcmFjdGlvbihjbGllbnQsIGRhdGEpO1xyXG4gICAgY2FzZSBJbnRlcmFjdGlvblR5cGUuQXBwbGljYXRpb25Db21tYW5kQXV0b2NvbXBsZXRlOlxyXG4gICAgICByZXR1cm4gbmV3IEF1dG9jb21wbGV0ZUludGVyYWN0aW9uKGNsaWVudCwgZGF0YSk7XHJcbiAgICBjYXNlIEludGVyYWN0aW9uVHlwZS5Nb2RhbFN1Ym1pdDpcclxuICAgICAgcmV0dXJuIG5ldyBNb2RhbFN1Ym1pdEludGVyYWN0aW9uKGNsaWVudCwgZGF0YSk7XHJcbiAgICBjYXNlIEludGVyYWN0aW9uVHlwZS5NZXNzYWdlQ29tcG9uZW50OlxyXG4gICAgICAvLyBjb21wb25lbnRfdHlwZTogMiA9IEJ1dHRvbiwgMyA9IFNlbGVjdCBNZW51XHJcbiAgICAgIGlmIChkYXRhLmRhdGE/LmNvbXBvbmVudF90eXBlID09PSAyKSB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBCdXR0b25JbnRlcmFjdGlvbihjbGllbnQsIGRhdGEpO1xyXG4gICAgICB9IGVsc2UgaWYgKGRhdGEuZGF0YT8uY29tcG9uZW50X3R5cGUgPT09IDMpIHtcclxuICAgICAgICByZXR1cm4gbmV3IFNlbGVjdE1lbnVJbnRlcmFjdGlvbihjbGllbnQsIGRhdGEpO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBuZXcgSW50ZXJhY3Rpb24oY2xpZW50LCBkYXRhKTtcclxuICAgIGRlZmF1bHQ6XHJcbiAgICAgIHJldHVybiBuZXcgSW50ZXJhY3Rpb24oY2xpZW50LCBkYXRhKTtcclxuICB9XHJcbn1cclxuIl19