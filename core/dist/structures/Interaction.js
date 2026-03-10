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
            const guild = client.guilds.get(this.guildId);
            if (guild) {
                this.member = new GuildMember_1.GuildMember(client, guild, data.member);
            }
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
        // Modal values come from components array (action rows containing text inputs)
        const components = data.data?.components || [];
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSW50ZXJhY3Rpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvc3RydWN0dXJlcy9JbnRlcmFjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUE0ZkEsOENBbUJDO0FBOWdCRCxvQ0FBa0Y7QUFDbEYsaUNBQThCO0FBQzlCLCtDQUE0QztBQUM1QywyREFBd0Q7QUFHeEQ7O0dBRUc7QUFDSCxNQUFhLFdBQVc7SUFDdEIsOEJBQThCO0lBQ2QsTUFBTSxDQUFTO0lBRS9CLHFCQUFxQjtJQUNMLEVBQUUsQ0FBUztJQUUzQixxQkFBcUI7SUFDTCxhQUFhLENBQVM7SUFFdEMsdUJBQXVCO0lBQ1AsSUFBSSxDQUFrQjtJQUV0QyxlQUFlO0lBQ0MsT0FBTyxDQUFVO0lBRWpDLGlCQUFpQjtJQUNELFNBQVMsQ0FBVTtJQUVuQyx3QkFBd0I7SUFDUixLQUFLLENBQVM7SUFFOUIseUNBQXlDO0lBQ3pCLElBQUksQ0FBTztJQUUzQixtQ0FBbUM7SUFDbkIsTUFBTSxDQUFlO0lBRXJDLGtEQUFrRDtJQUMzQyxPQUFPLEdBQUcsS0FBSyxDQUFDO0lBRXZCLGdEQUFnRDtJQUN6QyxRQUFRLEdBQUcsS0FBSyxDQUFDO0lBRXhCLFlBQVksTUFBYyxFQUFFLElBQW9CO1FBQzlDLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1FBQ3JCLG9DQUFvQztRQUNwQyxJQUFJLENBQUMsRUFBRSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDMUIsSUFBSSxDQUFDLGFBQWEsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQ2pELElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQztRQUN0QixJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLFNB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QUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQzdDLENBQUM7aUJBQU0sSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFLGNBQWMsS0FBSyxDQUFDLEVBQUUsQ0FBQztnQkFDM0MsT0FBTyxJQUFJLHFCQUFxQixDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztZQUNqRCxDQUFDO1lBQ0QsT0FBTyxJQUFJLFdBQVcsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDdkM7WUFDRSxPQUFPLElBQUksV0FBVyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztJQUN6QyxDQUFDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFQSUludGVyYWN0aW9uLCBBUElJbnRlcmFjdGlvbk9wdGlvbiwgQVBJRW1iZWQgfSBmcm9tICcuLi90eXBlcyc7XHJcbmltcG9ydCB7IEludGVyYWN0aW9uVHlwZSwgSW50ZXJhY3Rpb25SZXNwb25zZVR5cGUsIE1lc3NhZ2VGbGFncyB9IGZyb20gJy4uL2VudW1zJztcclxuaW1wb3J0IHsgVXNlciB9IGZyb20gJy4vVXNlcic7XHJcbmltcG9ydCB7IEd1aWxkTWVtYmVyIH0gZnJvbSAnLi9HdWlsZE1lbWJlcic7XHJcbmltcG9ydCB7IEVtYmVkQnVpbGRlciB9IGZyb20gJy4uL2J1aWxkZXJzL0VtYmVkQnVpbGRlcic7XHJcbmltcG9ydCB0eXBlIHsgQ2xpZW50IH0gZnJvbSAnLi4vQ2xpZW50JztcclxuXHJcbi8qKlxyXG4gKiBCYXNlIGludGVyYWN0aW9uIGNsYXNzXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgSW50ZXJhY3Rpb24ge1xyXG4gIC8qKiBSZWZlcmVuY2UgdG8gdGhlIGNsaWVudCAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBjbGllbnQ6IENsaWVudDtcclxuICBcclxuICAvKiogSW50ZXJhY3Rpb24gSUQgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgaWQ6IHN0cmluZztcclxuICBcclxuICAvKiogQXBwbGljYXRpb24gSUQgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgYXBwbGljYXRpb25JZDogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBJbnRlcmFjdGlvbiB0eXBlICovXHJcbiAgcHVibGljIHJlYWRvbmx5IHR5cGU6IEludGVyYWN0aW9uVHlwZTtcclxuICBcclxuICAvKiogR3VpbGQgSUQgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgZ3VpbGRJZD86IHN0cmluZztcclxuICBcclxuICAvKiogQ2hhbm5lbCBJRCAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBjaGFubmVsSWQ/OiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIEludGVyYWN0aW9uIHRva2VuICovXHJcbiAgcHVibGljIHJlYWRvbmx5IHRva2VuOiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIFVzZXIgd2hvIHRyaWdnZXJlZCB0aGUgaW50ZXJhY3Rpb24gKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgdXNlcjogVXNlcjtcclxuICBcclxuICAvKiogR3VpbGQgbWVtYmVyIChpZiBpbiBhIGd1aWxkKSAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBtZW1iZXI/OiBHdWlsZE1lbWJlcjtcclxuICBcclxuICAvKiogV2hldGhlciB0aGUgaW50ZXJhY3Rpb24gaGFzIGJlZW4gcmVwbGllZCB0byAqL1xyXG4gIHB1YmxpYyByZXBsaWVkID0gZmFsc2U7XHJcbiAgXHJcbiAgLyoqIFdoZXRoZXIgdGhlIGludGVyYWN0aW9uIGhhcyBiZWVuIGRlZmVycmVkICovXHJcbiAgcHVibGljIGRlZmVycmVkID0gZmFsc2U7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGNsaWVudDogQ2xpZW50LCBkYXRhOiBBUElJbnRlcmFjdGlvbikge1xyXG4gICAgdGhpcy5jbGllbnQgPSBjbGllbnQ7XHJcbiAgICAvLyBIYW5kbGUgYm90aCBzdHJpbmcgYW5kIG51bWJlciBJRHNcclxuICAgIHRoaXMuaWQgPSBTdHJpbmcoZGF0YS5pZCk7XHJcbiAgICB0aGlzLmFwcGxpY2F0aW9uSWQgPSBTdHJpbmcoZGF0YS5hcHBsaWNhdGlvbl9pZCk7XHJcbiAgICB0aGlzLnR5cGUgPSBkYXRhLnR5cGU7XHJcbiAgICB0aGlzLmd1aWxkSWQgPSBkYXRhLmd1aWxkX2lkID8gU3RyaW5nKGRhdGEuZ3VpbGRfaWQpIDogdW5kZWZpbmVkO1xyXG4gICAgdGhpcy5jaGFubmVsSWQgPSBkYXRhLmNoYW5uZWxfaWQgPyBTdHJpbmcoZGF0YS5jaGFubmVsX2lkKSA6IHVuZGVmaW5lZDtcclxuICAgIHRoaXMudG9rZW4gPSBkYXRhLnRva2VuO1xyXG4gICAgXHJcbiAgICAvLyBVc2VyIGNhbiBjb21lIGZyb20gbWVtYmVyLnVzZXIgb3IgZGlyZWN0bHkgZnJvbSB1c2VyXHJcbiAgICBjb25zdCB1c2VyRGF0YSA9IGRhdGEubWVtYmVyPy51c2VyIHx8IGRhdGEudXNlcjtcclxuICAgIHRoaXMudXNlciA9IHVzZXJEYXRhID8gbmV3IFVzZXIodXNlckRhdGEpIDogbmV3IFVzZXIoeyBpZDogJzAnLCB1c2VybmFtZTogJ1Vua25vd24nIH0pO1xyXG4gICAgXHJcbiAgICAvLyBDcmVhdGUgbWVtYmVyIGlmIGluIGd1aWxkXHJcbiAgICBpZiAoZGF0YS5tZW1iZXIgJiYgdGhpcy5ndWlsZElkKSB7XHJcbiAgICAgIGNvbnN0IGd1aWxkID0gY2xpZW50Lmd1aWxkcy5nZXQodGhpcy5ndWlsZElkKTtcclxuICAgICAgaWYgKGd1aWxkKSB7XHJcbiAgICAgICAgdGhpcy5tZW1iZXIgPSBuZXcgR3VpbGRNZW1iZXIoY2xpZW50LCBndWlsZCwgZGF0YS5tZW1iZXIpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDaGVjayBpZiB0aGlzIGlzIGEgY29tbWFuZCBpbnRlcmFjdGlvblxyXG4gICAqL1xyXG4gIGlzQ29tbWFuZCgpOiB0aGlzIGlzIENvbW1hbmRJbnRlcmFjdGlvbiB7XHJcbiAgICByZXR1cm4gdGhpcy50eXBlID09PSBJbnRlcmFjdGlvblR5cGUuQXBwbGljYXRpb25Db21tYW5kO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2hlY2sgaWYgdGhpcyBpcyBhbiBhdXRvY29tcGxldGUgaW50ZXJhY3Rpb25cclxuICAgKi9cclxuICBpc0F1dG9jb21wbGV0ZSgpOiB0aGlzIGlzIEF1dG9jb21wbGV0ZUludGVyYWN0aW9uIHtcclxuICAgIHJldHVybiB0aGlzLnR5cGUgPT09IEludGVyYWN0aW9uVHlwZS5BcHBsaWNhdGlvbkNvbW1hbmRBdXRvY29tcGxldGU7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDaGVjayBpZiB0aGlzIGlzIGEgbW9kYWwgc3VibWl0IGludGVyYWN0aW9uXHJcbiAgICovXHJcbiAgaXNNb2RhbFN1Ym1pdCgpOiB0aGlzIGlzIE1vZGFsU3VibWl0SW50ZXJhY3Rpb24ge1xyXG4gICAgcmV0dXJuIHRoaXMudHlwZSA9PT0gSW50ZXJhY3Rpb25UeXBlLk1vZGFsU3VibWl0O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2hlY2sgaWYgdGhpcyBpcyBhIGJ1dHRvbiBpbnRlcmFjdGlvblxyXG4gICAqL1xyXG4gIGlzQnV0dG9uKCk6IHRoaXMgaXMgQnV0dG9uSW50ZXJhY3Rpb24ge1xyXG4gICAgcmV0dXJuIHRoaXMudHlwZSA9PT0gSW50ZXJhY3Rpb25UeXBlLk1lc3NhZ2VDb21wb25lbnQgJiYgKHRoaXMgYXMgYW55KS5jb21wb25lbnRUeXBlID09PSAyO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2hlY2sgaWYgdGhpcyBpcyBhIHNlbGVjdCBtZW51IGludGVyYWN0aW9uXHJcbiAgICovXHJcbiAgaXNTZWxlY3RNZW51KCk6IHRoaXMgaXMgU2VsZWN0TWVudUludGVyYWN0aW9uIHtcclxuICAgIHJldHVybiB0aGlzLnR5cGUgPT09IEludGVyYWN0aW9uVHlwZS5NZXNzYWdlQ29tcG9uZW50ICYmICh0aGlzIGFzIGFueSkuY29tcG9uZW50VHlwZSA9PT0gMztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlcGx5IHRvIHRoZSBpbnRlcmFjdGlvblxyXG4gICAqL1xyXG4gIGFzeW5jIHJlcGx5KG9wdGlvbnM6IHN0cmluZyB8IEludGVyYWN0aW9uUmVwbHlPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBpZiAodGhpcy5yZXBsaWVkIHx8IHRoaXMuZGVmZXJyZWQpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnRlcmFjdGlvbiBoYXMgYWxyZWFkeSBiZWVuIHJlcGxpZWQgdG8gb3IgZGVmZXJyZWQnKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgY29uc3QgY29udGVudCA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IG9wdGlvbnMgOiBvcHRpb25zLmNvbnRlbnQ7XHJcbiAgICBjb25zdCByYXdFbWJlZHMgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyB1bmRlZmluZWQgOiBvcHRpb25zLmVtYmVkcztcclxuICAgIGNvbnN0IGNvbXBvbmVudHMgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyB1bmRlZmluZWQgOiBvcHRpb25zLmNvbXBvbmVudHM7XHJcbiAgICBjb25zdCBlcGhlbWVyYWwgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyBmYWxzZSA6IG9wdGlvbnMuZXBoZW1lcmFsO1xyXG4gICAgXHJcbiAgICAvLyBDb252ZXJ0IEVtYmVkQnVpbGRlciBpbnN0YW5jZXMgdG8gcGxhaW4gb2JqZWN0c1xyXG4gICAgY29uc3QgZW1iZWRzID0gcmF3RW1iZWRzPy5tYXAoZSA9PiBlIGluc3RhbmNlb2YgRW1iZWRCdWlsZGVyID8gZS50b0pTT04oKSA6IGUpO1xyXG4gICAgXHJcbiAgICBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LmNyZWF0ZUludGVyYWN0aW9uUmVzcG9uc2UodGhpcy5pZCwgdGhpcy50b2tlbiwge1xyXG4gICAgICB0eXBlOiBJbnRlcmFjdGlvblJlc3BvbnNlVHlwZS5DaGFubmVsTWVzc2FnZVdpdGhTb3VyY2UsXHJcbiAgICAgIGRhdGE6IHtcclxuICAgICAgICBjb250ZW50LFxyXG4gICAgICAgIGVtYmVkcyxcclxuICAgICAgICBjb21wb25lbnRzLFxyXG4gICAgICAgIGZsYWdzOiBlcGhlbWVyYWwgPyBNZXNzYWdlRmxhZ3MuRXBoZW1lcmFsIDogMFxyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgdGhpcy5yZXBsaWVkID0gdHJ1ZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlZmVyIHRoZSByZXBseSAoc2hvd3MgXCJ0aGlua2luZy4uLlwiKVxyXG4gICAqL1xyXG4gIGFzeW5jIGRlZmVyUmVwbHkob3B0aW9ucz86IHsgZXBoZW1lcmFsPzogYm9vbGVhbiB9KTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBpZiAodGhpcy5yZXBsaWVkIHx8IHRoaXMuZGVmZXJyZWQpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnRlcmFjdGlvbiBoYXMgYWxyZWFkeSBiZWVuIHJlcGxpZWQgdG8gb3IgZGVmZXJyZWQnKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5jcmVhdGVJbnRlcmFjdGlvblJlc3BvbnNlKHRoaXMuaWQsIHRoaXMudG9rZW4sIHtcclxuICAgICAgdHlwZTogSW50ZXJhY3Rpb25SZXNwb25zZVR5cGUuRGVmZXJyZWRDaGFubmVsTWVzc2FnZVdpdGhTb3VyY2UsXHJcbiAgICAgIGRhdGE6IG9wdGlvbnM/LmVwaGVtZXJhbCA/IHsgZmxhZ3M6IE1lc3NhZ2VGbGFncy5FcGhlbWVyYWwgfSA6IHVuZGVmaW5lZFxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIHRoaXMuZGVmZXJyZWQgPSB0cnVlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRWRpdCB0aGUgcmVwbHlcclxuICAgKi9cclxuICBhc3luYyBlZGl0UmVwbHkob3B0aW9uczogc3RyaW5nIHwgSW50ZXJhY3Rpb25SZXBseU9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IGNvbnRlbnQgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyBvcHRpb25zIDogb3B0aW9ucy5jb250ZW50O1xyXG4gICAgY29uc3QgcmF3RW1iZWRzID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gdW5kZWZpbmVkIDogb3B0aW9ucy5lbWJlZHM7XHJcbiAgICBjb25zdCBjb21wb25lbnRzID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gdW5kZWZpbmVkIDogb3B0aW9ucy5jb21wb25lbnRzO1xyXG4gICAgY29uc3QgZmlsZXMgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyB1bmRlZmluZWQgOiBvcHRpb25zLmZpbGVzO1xyXG4gICAgXHJcbiAgICAvLyBDb252ZXJ0IEVtYmVkQnVpbGRlciBpbnN0YW5jZXMgdG8gcGxhaW4gb2JqZWN0c1xyXG4gICAgY29uc3QgZW1iZWRzID0gcmF3RW1iZWRzPy5tYXAoZSA9PiBlIGluc3RhbmNlb2YgRW1iZWRCdWlsZGVyID8gZS50b0pTT04oKSA6IGUpO1xyXG4gICAgXHJcbiAgICBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LmVkaXRJbnRlcmFjdGlvblJlc3BvbnNlKHRoaXMudG9rZW4sIHtcclxuICAgICAgY29udGVudCxcclxuICAgICAgZW1iZWRzLFxyXG4gICAgICBjb21wb25lbnRzLFxyXG4gICAgICBmaWxlc1xyXG4gICAgfSwgdGhpcy5ndWlsZElkLCB0aGlzLmNoYW5uZWxJZCwgdGhpcy5pZCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZWxldGUgdGhlIHJlcGx5XHJcbiAgICovXHJcbiAgYXN5bmMgZGVsZXRlUmVwbHkoKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LmRlbGV0ZUludGVyYWN0aW9uUmVzcG9uc2UodGhpcy50b2tlbik7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZW5kIGEgZm9sbG93dXAgbWVzc2FnZVxyXG4gICAqL1xyXG4gIGFzeW5jIGZvbGxvd1VwKG9wdGlvbnM6IHN0cmluZyB8IEludGVyYWN0aW9uUmVwbHlPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBjb250ZW50ID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gb3B0aW9ucyA6IG9wdGlvbnMuY29udGVudDtcclxuICAgIGNvbnN0IHJhd0VtYmVkcyA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IHVuZGVmaW5lZCA6IG9wdGlvbnMuZW1iZWRzO1xyXG4gICAgY29uc3QgZXBoZW1lcmFsID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gZmFsc2UgOiBvcHRpb25zLmVwaGVtZXJhbDtcclxuICAgIFxyXG4gICAgLy8gQ29udmVydCBFbWJlZEJ1aWxkZXIgaW5zdGFuY2VzIHRvIHBsYWluIG9iamVjdHNcclxuICAgIGNvbnN0IGVtYmVkcyA9IHJhd0VtYmVkcz8ubWFwKGUgPT4gZSBpbnN0YW5jZW9mIEVtYmVkQnVpbGRlciA/IGUudG9KU09OKCkgOiBlKTtcclxuICAgIFxyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5jcmVhdGVGb2xsb3d1cCh0aGlzLnRva2VuLCB7XHJcbiAgICAgIGNvbnRlbnQsXHJcbiAgICAgIGVtYmVkcyxcclxuICAgICAgZmxhZ3M6IGVwaGVtZXJhbCA/IE1lc3NhZ2VGbGFncy5FcGhlbWVyYWwgOiAwXHJcbiAgICB9KTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb21tYW5kIGludGVyYWN0aW9uXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgQ29tbWFuZEludGVyYWN0aW9uIGV4dGVuZHMgSW50ZXJhY3Rpb24ge1xyXG4gIC8qKiBDb21tYW5kIG5hbWUgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgY29tbWFuZE5hbWU6IHN0cmluZztcclxuICBcclxuICAvKiogQ29tbWFuZCBvcHRpb25zICovXHJcbiAgcHVibGljIHJlYWRvbmx5IG9wdGlvbnM6IENvbW1hbmRJbnRlcmFjdGlvbk9wdGlvbnM7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGNsaWVudDogQ2xpZW50LCBkYXRhOiBBUElJbnRlcmFjdGlvbikge1xyXG4gICAgc3VwZXIoY2xpZW50LCBkYXRhKTtcclxuICAgIHRoaXMuY29tbWFuZE5hbWUgPSBkYXRhLmRhdGE/Lm5hbWUgfHwgJyc7XHJcbiAgICB0aGlzLm9wdGlvbnMgPSBuZXcgQ29tbWFuZEludGVyYWN0aW9uT3B0aW9ucyhkYXRhLmRhdGE/Lm9wdGlvbnMgfHwgW10pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2hvdyBhIG1vZGFsXHJcbiAgICovXHJcbiAgYXN5bmMgc2hvd01vZGFsKG1vZGFsOiBNb2RhbERhdGEgfCB7IHRvSlNPTigpOiBNb2RhbERhdGEgfSk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgbW9kYWxEYXRhID0gJ3RvSlNPTicgaW4gbW9kYWwgJiYgdHlwZW9mIG1vZGFsLnRvSlNPTiA9PT0gJ2Z1bmN0aW9uJyA/IG1vZGFsLnRvSlNPTigpIDogbW9kYWw7XHJcbiAgICBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LmNyZWF0ZUludGVyYWN0aW9uUmVzcG9uc2UodGhpcy5pZCwgdGhpcy50b2tlbiwge1xyXG4gICAgICB0eXBlOiBJbnRlcmFjdGlvblJlc3BvbnNlVHlwZS5Nb2RhbCxcclxuICAgICAgZGF0YTogbW9kYWxEYXRhXHJcbiAgICB9KTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb21tYW5kIGludGVyYWN0aW9uIG9wdGlvbnMgaGVscGVyXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgQ29tbWFuZEludGVyYWN0aW9uT3B0aW9ucyB7XHJcbiAgcHJpdmF0ZSBvcHRpb25zOiBBUElJbnRlcmFjdGlvbk9wdGlvbltdO1xyXG5cclxuICBjb25zdHJ1Y3RvcihvcHRpb25zOiBBUElJbnRlcmFjdGlvbk9wdGlvbltdKSB7XHJcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGEgc3RyaW5nIG9wdGlvblxyXG4gICAqL1xyXG4gIGdldFN0cmluZyhuYW1lOiBzdHJpbmcsIHJlcXVpcmVkPzogYm9vbGVhbik6IHN0cmluZyB8IG51bGwge1xyXG4gICAgY29uc3Qgb3B0aW9uID0gdGhpcy5vcHRpb25zLmZpbmQobyA9PiBvLm5hbWUgPT09IG5hbWUpO1xyXG4gICAgaWYgKCFvcHRpb24gJiYgcmVxdWlyZWQpIHRocm93IG5ldyBFcnJvcihgUmVxdWlyZWQgb3B0aW9uIFwiJHtuYW1lfVwiIG5vdCBmb3VuZGApO1xyXG4gICAgcmV0dXJuIG9wdGlvbj8udmFsdWUgYXMgc3RyaW5nIHx8IG51bGw7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYW4gaW50ZWdlciBvcHRpb25cclxuICAgKi9cclxuICBnZXRJbnRlZ2VyKG5hbWU6IHN0cmluZywgcmVxdWlyZWQ/OiBib29sZWFuKTogbnVtYmVyIHwgbnVsbCB7XHJcbiAgICBjb25zdCBvcHRpb24gPSB0aGlzLm9wdGlvbnMuZmluZChvID0+IG8ubmFtZSA9PT0gbmFtZSk7XHJcbiAgICBpZiAoIW9wdGlvbiAmJiByZXF1aXJlZCkgdGhyb3cgbmV3IEVycm9yKGBSZXF1aXJlZCBvcHRpb24gXCIke25hbWV9XCIgbm90IGZvdW5kYCk7XHJcbiAgICByZXR1cm4gb3B0aW9uPy52YWx1ZSBhcyBudW1iZXIgfHwgbnVsbDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhIG51bWJlciBvcHRpb25cclxuICAgKi9cclxuICBnZXROdW1iZXIobmFtZTogc3RyaW5nLCByZXF1aXJlZD86IGJvb2xlYW4pOiBudW1iZXIgfCBudWxsIHtcclxuICAgIHJldHVybiB0aGlzLmdldEludGVnZXIobmFtZSwgcmVxdWlyZWQpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGEgYm9vbGVhbiBvcHRpb25cclxuICAgKi9cclxuICBnZXRCb29sZWFuKG5hbWU6IHN0cmluZywgcmVxdWlyZWQ/OiBib29sZWFuKTogYm9vbGVhbiB8IG51bGwge1xyXG4gICAgY29uc3Qgb3B0aW9uID0gdGhpcy5vcHRpb25zLmZpbmQobyA9PiBvLm5hbWUgPT09IG5hbWUpO1xyXG4gICAgaWYgKCFvcHRpb24gJiYgcmVxdWlyZWQpIHRocm93IG5ldyBFcnJvcihgUmVxdWlyZWQgb3B0aW9uIFwiJHtuYW1lfVwiIG5vdCBmb3VuZGApO1xyXG4gICAgcmV0dXJuIG9wdGlvbj8udmFsdWUgYXMgYm9vbGVhbiA/PyBudWxsO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGEgdXNlciBvcHRpb25cclxuICAgKi9cclxuICBnZXRVc2VyKG5hbWU6IHN0cmluZywgcmVxdWlyZWQ/OiBib29sZWFuKTogc3RyaW5nIHwgbnVsbCB7XHJcbiAgICBjb25zdCBvcHRpb24gPSB0aGlzLm9wdGlvbnMuZmluZChvID0+IG8ubmFtZSA9PT0gbmFtZSk7XHJcbiAgICBpZiAoIW9wdGlvbiAmJiByZXF1aXJlZCkgdGhyb3cgbmV3IEVycm9yKGBSZXF1aXJlZCBvcHRpb24gXCIke25hbWV9XCIgbm90IGZvdW5kYCk7XHJcbiAgICByZXR1cm4gb3B0aW9uPy52YWx1ZSBhcyBzdHJpbmcgfHwgbnVsbDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhIGNoYW5uZWwgb3B0aW9uXHJcbiAgICovXHJcbiAgZ2V0Q2hhbm5lbChuYW1lOiBzdHJpbmcsIHJlcXVpcmVkPzogYm9vbGVhbik6IHN0cmluZyB8IG51bGwge1xyXG4gICAgY29uc3Qgb3B0aW9uID0gdGhpcy5vcHRpb25zLmZpbmQobyA9PiBvLm5hbWUgPT09IG5hbWUpO1xyXG4gICAgaWYgKCFvcHRpb24gJiYgcmVxdWlyZWQpIHRocm93IG5ldyBFcnJvcihgUmVxdWlyZWQgb3B0aW9uIFwiJHtuYW1lfVwiIG5vdCBmb3VuZGApO1xyXG4gICAgcmV0dXJuIG9wdGlvbj8udmFsdWUgYXMgc3RyaW5nIHx8IG51bGw7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSBzdWJjb21tYW5kIG5hbWVcclxuICAgKi9cclxuICBnZXRTdWJjb21tYW5kKHJlcXVpcmVkPzogYm9vbGVhbik6IHN0cmluZyB8IG51bGwge1xyXG4gICAgY29uc3Qgb3B0aW9uID0gdGhpcy5vcHRpb25zLmZpbmQobyA9PiBvLnR5cGUgPT09IDEpO1xyXG4gICAgaWYgKCFvcHRpb24gJiYgcmVxdWlyZWQpIHRocm93IG5ldyBFcnJvcignUmVxdWlyZWQgc3ViY29tbWFuZCBub3QgZm91bmQnKTtcclxuICAgIHJldHVybiBvcHRpb24/Lm5hbWUgfHwgbnVsbDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCB0aGUgZm9jdXNlZCBvcHRpb24gKGZvciBhdXRvY29tcGxldGUpXHJcbiAgICovXHJcbiAgZ2V0Rm9jdXNlZCgpOiB7IG5hbWU6IHN0cmluZzsgdmFsdWU6IHN0cmluZyB9IHwgbnVsbCB7XHJcbiAgICBjb25zdCBvcHRpb24gPSB0aGlzLm9wdGlvbnMuZmluZChvID0+IG8uZm9jdXNlZCk7XHJcbiAgICBpZiAoIW9wdGlvbikgcmV0dXJuIG51bGw7XHJcbiAgICByZXR1cm4geyBuYW1lOiBvcHRpb24ubmFtZSwgdmFsdWU6IG9wdGlvbi52YWx1ZSBhcyBzdHJpbmcgfTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBdXRvY29tcGxldGUgaW50ZXJhY3Rpb25cclxuICovXHJcbmV4cG9ydCBjbGFzcyBBdXRvY29tcGxldGVJbnRlcmFjdGlvbiBleHRlbmRzIEludGVyYWN0aW9uIHtcclxuICAvKiogQ29tbWFuZCBuYW1lICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGNvbW1hbmROYW1lOiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIENvbW1hbmQgb3B0aW9ucyAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBvcHRpb25zOiBDb21tYW5kSW50ZXJhY3Rpb25PcHRpb25zO1xyXG5cclxuICBjb25zdHJ1Y3RvcihjbGllbnQ6IENsaWVudCwgZGF0YTogQVBJSW50ZXJhY3Rpb24pIHtcclxuICAgIHN1cGVyKGNsaWVudCwgZGF0YSk7XHJcbiAgICB0aGlzLmNvbW1hbmROYW1lID0gZGF0YS5kYXRhPy5uYW1lIHx8ICcnO1xyXG4gICAgdGhpcy5vcHRpb25zID0gbmV3IENvbW1hbmRJbnRlcmFjdGlvbk9wdGlvbnMoZGF0YS5kYXRhPy5vcHRpb25zIHx8IFtdKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlc3BvbmQgd2l0aCBhdXRvY29tcGxldGUgY2hvaWNlc1xyXG4gICAqL1xyXG4gIGFzeW5jIHJlc3BvbmQoY2hvaWNlczogQXV0b2NvbXBsZXRlQ2hvaWNlW10pOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGF3YWl0IHRoaXMuY2xpZW50LnJlc3QuY3JlYXRlSW50ZXJhY3Rpb25SZXNwb25zZSh0aGlzLmlkLCB0aGlzLnRva2VuLCB7XHJcbiAgICAgIHR5cGU6IEludGVyYWN0aW9uUmVzcG9uc2VUeXBlLkFwcGxpY2F0aW9uQ29tbWFuZEF1dG9jb21wbGV0ZVJlc3VsdCxcclxuICAgICAgZGF0YTogeyBjaG9pY2VzIH1cclxuICAgIH0pO1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIEJ1dHRvbiBpbnRlcmFjdGlvblxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIEJ1dHRvbkludGVyYWN0aW9uIGV4dGVuZHMgSW50ZXJhY3Rpb24ge1xyXG4gIC8qKiBCdXR0b24gY3VzdG9tIElEICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGN1c3RvbUlkOiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIENvbXBvbmVudCB0eXBlIChhbHdheXMgMiBmb3IgYnV0dG9ucykgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgY29tcG9uZW50VHlwZTogbnVtYmVyID0gMjtcclxuICBcclxuICAvKiogTWVzc2FnZSB0aGUgYnV0dG9uIGlzIGF0dGFjaGVkIHRvICovXHJcbiAgcHVibGljIHJlYWRvbmx5IG1lc3NhZ2U/OiBhbnk7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGNsaWVudDogQ2xpZW50LCBkYXRhOiBBUElJbnRlcmFjdGlvbikge1xyXG4gICAgc3VwZXIoY2xpZW50LCBkYXRhKTtcclxuICAgIHRoaXMuY3VzdG9tSWQgPSBkYXRhLmRhdGE/LmN1c3RvbV9pZCB8fCAnJztcclxuICAgIHRoaXMubWVzc2FnZSA9IGRhdGEubWVzc2FnZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFVwZGF0ZSB0aGUgbWVzc2FnZSB0aGUgYnV0dG9uIGlzIGF0dGFjaGVkIHRvXHJcbiAgICovXHJcbiAgYXN5bmMgdXBkYXRlKG9wdGlvbnM6IEludGVyYWN0aW9uUmVwbHlPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICAvLyBDb252ZXJ0IEVtYmVkQnVpbGRlciBpbnN0YW5jZXMgdG8gcGxhaW4gb2JqZWN0c1xyXG4gICAgY29uc3QgZW1iZWRzID0gb3B0aW9ucy5lbWJlZHM/Lm1hcChlID0+IGUgaW5zdGFuY2VvZiBFbWJlZEJ1aWxkZXIgPyBlLnRvSlNPTigpIDogZSk7XHJcbiAgICBcclxuICAgIGF3YWl0IHRoaXMuY2xpZW50LnJlc3QuY3JlYXRlSW50ZXJhY3Rpb25SZXNwb25zZSh0aGlzLmlkLCB0aGlzLnRva2VuLCB7XHJcbiAgICAgIHR5cGU6IEludGVyYWN0aW9uUmVzcG9uc2VUeXBlLlVwZGF0ZU1lc3NhZ2UsXHJcbiAgICAgIGRhdGE6IHtcclxuICAgICAgICBjb250ZW50OiBvcHRpb25zLmNvbnRlbnQsXHJcbiAgICAgICAgZW1iZWRzLFxyXG4gICAgICAgIGNvbXBvbmVudHM6IG9wdGlvbnMuY29tcG9uZW50c1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICAgIHRoaXMucmVwbGllZCA9IHRydWU7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTaG93IGEgbW9kYWwgaW4gcmVzcG9uc2UgdG8gdGhpcyBidXR0b24gaW50ZXJhY3Rpb25cclxuICAgKi9cclxuICBhc3luYyBzaG93TW9kYWwobW9kYWw6IE1vZGFsRGF0YSB8IHsgdG9KU09OKCk6IE1vZGFsRGF0YSB9KTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBtb2RhbERhdGEgPSAndG9KU09OJyBpbiBtb2RhbCAmJiB0eXBlb2YgbW9kYWwudG9KU09OID09PSAnZnVuY3Rpb24nID8gbW9kYWwudG9KU09OKCkgOiBtb2RhbDtcclxuICAgIGF3YWl0IHRoaXMuY2xpZW50LnJlc3QuY3JlYXRlSW50ZXJhY3Rpb25SZXNwb25zZSh0aGlzLmlkLCB0aGlzLnRva2VuLCB7XHJcbiAgICAgIHR5cGU6IEludGVyYWN0aW9uUmVzcG9uc2VUeXBlLk1vZGFsLFxyXG4gICAgICBkYXRhOiBtb2RhbERhdGFcclxuICAgIH0pO1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIFNlbGVjdCBtZW51IGludGVyYWN0aW9uXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgU2VsZWN0TWVudUludGVyYWN0aW9uIGV4dGVuZHMgSW50ZXJhY3Rpb24ge1xyXG4gIC8qKiBTZWxlY3QgbWVudSBjdXN0b20gSUQgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgY3VzdG9tSWQ6IHN0cmluZztcclxuICBcclxuICAvKiogQ29tcG9uZW50IHR5cGUgKGFsd2F5cyAzIGZvciBzZWxlY3QgbWVudXMpICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGNvbXBvbmVudFR5cGU6IG51bWJlciA9IDM7XHJcbiAgXHJcbiAgLyoqIFNlbGVjdGVkIHZhbHVlcyAqL1xyXG4gIHB1YmxpYyByZWFkb25seSB2YWx1ZXM6IHN0cmluZ1tdO1xyXG4gIFxyXG4gIC8qKiBNZXNzYWdlIHRoZSBzZWxlY3QgbWVudSBpcyBhdHRhY2hlZCB0byAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBtZXNzYWdlPzogYW55O1xyXG5cclxuICBjb25zdHJ1Y3RvcihjbGllbnQ6IENsaWVudCwgZGF0YTogQVBJSW50ZXJhY3Rpb24pIHtcclxuICAgIHN1cGVyKGNsaWVudCwgZGF0YSk7XHJcbiAgICB0aGlzLmN1c3RvbUlkID0gZGF0YS5kYXRhPy5jdXN0b21faWQgfHwgJyc7XHJcbiAgICB0aGlzLnZhbHVlcyA9IGRhdGEuZGF0YT8udmFsdWVzIHx8IFtdO1xyXG4gICAgdGhpcy5tZXNzYWdlID0gZGF0YS5tZXNzYWdlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVXBkYXRlIHRoZSBtZXNzYWdlIHRoZSBzZWxlY3QgbWVudSBpcyBhdHRhY2hlZCB0b1xyXG4gICAqL1xyXG4gIGFzeW5jIHVwZGF0ZShvcHRpb25zOiBJbnRlcmFjdGlvblJlcGx5T3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgLy8gQ29udmVydCBFbWJlZEJ1aWxkZXIgaW5zdGFuY2VzIHRvIHBsYWluIG9iamVjdHNcclxuICAgIGNvbnN0IGVtYmVkcyA9IG9wdGlvbnMuZW1iZWRzPy5tYXAoZSA9PiBlIGluc3RhbmNlb2YgRW1iZWRCdWlsZGVyID8gZS50b0pTT04oKSA6IGUpO1xyXG4gICAgXHJcbiAgICBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LmNyZWF0ZUludGVyYWN0aW9uUmVzcG9uc2UodGhpcy5pZCwgdGhpcy50b2tlbiwge1xyXG4gICAgICB0eXBlOiBJbnRlcmFjdGlvblJlc3BvbnNlVHlwZS5VcGRhdGVNZXNzYWdlLFxyXG4gICAgICBkYXRhOiB7XHJcbiAgICAgICAgY29udGVudDogb3B0aW9ucy5jb250ZW50LFxyXG4gICAgICAgIGVtYmVkcyxcclxuICAgICAgICBjb21wb25lbnRzOiBvcHRpb25zLmNvbXBvbmVudHNcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICB0aGlzLnJlcGxpZWQgPSB0cnVlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2hvdyBhIG1vZGFsIGluIHJlc3BvbnNlIHRvIHRoaXMgc2VsZWN0IG1lbnUgaW50ZXJhY3Rpb25cclxuICAgKi9cclxuICBhc3luYyBzaG93TW9kYWwobW9kYWw6IE1vZGFsRGF0YSB8IHsgdG9KU09OKCk6IE1vZGFsRGF0YSB9KTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBtb2RhbERhdGEgPSAndG9KU09OJyBpbiBtb2RhbCAmJiB0eXBlb2YgbW9kYWwudG9KU09OID09PSAnZnVuY3Rpb24nID8gbW9kYWwudG9KU09OKCkgOiBtb2RhbDtcclxuICAgIGF3YWl0IHRoaXMuY2xpZW50LnJlc3QuY3JlYXRlSW50ZXJhY3Rpb25SZXNwb25zZSh0aGlzLmlkLCB0aGlzLnRva2VuLCB7XHJcbiAgICAgIHR5cGU6IEludGVyYWN0aW9uUmVzcG9uc2VUeXBlLk1vZGFsLFxyXG4gICAgICBkYXRhOiBtb2RhbERhdGFcclxuICAgIH0pO1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIE1vZGFsIHN1Ym1pdCBpbnRlcmFjdGlvblxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIE1vZGFsU3VibWl0SW50ZXJhY3Rpb24gZXh0ZW5kcyBJbnRlcmFjdGlvbiB7XHJcbiAgLyoqIE1vZGFsIGN1c3RvbSBJRCAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBjdXN0b21JZDogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBNb2RhbCBmaWVsZHMgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgZmllbGRzOiBNb2RhbEZpZWxkcztcclxuXHJcbiAgY29uc3RydWN0b3IoY2xpZW50OiBDbGllbnQsIGRhdGE6IEFQSUludGVyYWN0aW9uKSB7XHJcbiAgICBzdXBlcihjbGllbnQsIGRhdGEpO1xyXG4gICAgdGhpcy5jdXN0b21JZCA9IGRhdGEuZGF0YT8uY3VzdG9tX2lkIHx8ICcnO1xyXG4gICAgLy8gTW9kYWwgdmFsdWVzIGNvbWUgZnJvbSBjb21wb25lbnRzIGFycmF5IChhY3Rpb24gcm93cyBjb250YWluaW5nIHRleHQgaW5wdXRzKVxyXG4gICAgY29uc3QgY29tcG9uZW50cyA9IChkYXRhLmRhdGEgYXMgYW55KT8uY29tcG9uZW50cyB8fCBbXTtcclxuICAgIHRoaXMuZmllbGRzID0gbmV3IE1vZGFsRmllbGRzKGNvbXBvbmVudHMpO1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIE1vZGFsIGZpZWxkcyBoZWxwZXJcclxuICovXHJcbmV4cG9ydCBjbGFzcyBNb2RhbEZpZWxkcyB7XHJcbiAgcHJpdmF0ZSBmaWVsZE1hcDogTWFwPHN0cmluZywgc3RyaW5nPjtcclxuXHJcbiAgY29uc3RydWN0b3IoY29tcG9uZW50czogYW55W10pIHtcclxuICAgIHRoaXMuZmllbGRNYXAgPSBuZXcgTWFwKCk7XHJcbiAgICAvLyBQYXJzZSBhY3Rpb24gcm93cyDihpIgdGV4dCBpbnB1dHNcclxuICAgIGZvciAoY29uc3Qgcm93IG9mIGNvbXBvbmVudHMpIHtcclxuICAgICAgY29uc3QgaW5uZXJDb21wb25lbnRzID0gcm93Py5jb21wb25lbnRzIHx8IFtdO1xyXG4gICAgICBmb3IgKGNvbnN0IGNvbXAgb2YgaW5uZXJDb21wb25lbnRzKSB7XHJcbiAgICAgICAgaWYgKGNvbXAuY3VzdG9tX2lkICYmIGNvbXAudmFsdWUgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgdGhpcy5maWVsZE1hcC5zZXQoY29tcC5jdXN0b21faWQsIGNvbXAudmFsdWUpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGEgdGV4dCBpbnB1dCB2YWx1ZSBieSBjdXN0b21faWRcclxuICAgKi9cclxuICBnZXRUZXh0SW5wdXRWYWx1ZShjdXN0b21JZDogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XHJcbiAgICByZXR1cm4gdGhpcy5maWVsZE1hcC5nZXQoY3VzdG9tSWQpID8/IG51bGw7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSBmaWVsZCAoYWxpYXMgZm9yIGdldFRleHRJbnB1dFZhbHVlKVxyXG4gICAqL1xyXG4gIGdldEZpZWxkKGN1c3RvbUlkOiBzdHJpbmcpOiB7IHZhbHVlOiBzdHJpbmcgfSB8IG51bGwge1xyXG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLmZpZWxkTWFwLmdldChjdXN0b21JZCk7XHJcbiAgICByZXR1cm4gdmFsdWUgIT09IHVuZGVmaW5lZCA/IHsgdmFsdWUgfSA6IG51bGw7XHJcbiAgfVxyXG59XHJcblxyXG4vLyBUeXBlc1xyXG5leHBvcnQgaW50ZXJmYWNlIEludGVyYWN0aW9uUmVwbHlPcHRpb25zIHtcclxuICBjb250ZW50Pzogc3RyaW5nO1xyXG4gIGVtYmVkcz86IChBUElFbWJlZCB8IEVtYmVkQnVpbGRlcilbXTtcclxuICBjb21wb25lbnRzPzogYW55W107XHJcbiAgZXBoZW1lcmFsPzogYm9vbGVhbjtcclxuICBmaWxlcz86IEFycmF5PHsgbmFtZTogc3RyaW5nOyBkYXRhOiBCdWZmZXI7IGNvbnRlbnRUeXBlPzogc3RyaW5nIH0+O1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEF1dG9jb21wbGV0ZUNob2ljZSB7XHJcbiAgbmFtZTogc3RyaW5nO1xyXG4gIHZhbHVlOiBzdHJpbmcgfCBudW1iZXI7XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgTW9kYWxEYXRhIHtcclxuICBjdXN0b21faWQ6IHN0cmluZztcclxuICB0aXRsZTogc3RyaW5nO1xyXG4gIGNvbXBvbmVudHM6IGFueVtdO1xyXG59XHJcblxyXG4vKipcclxuICogQ3JlYXRlIGFwcHJvcHJpYXRlIGludGVyYWN0aW9uIGNsYXNzIGJhc2VkIG9uIHR5cGVcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVJbnRlcmFjdGlvbihjbGllbnQ6IENsaWVudCwgZGF0YTogQVBJSW50ZXJhY3Rpb24pOiBJbnRlcmFjdGlvbiB7XHJcbiAgc3dpdGNoIChkYXRhLnR5cGUpIHtcclxuICAgIGNhc2UgSW50ZXJhY3Rpb25UeXBlLkFwcGxpY2F0aW9uQ29tbWFuZDpcclxuICAgICAgcmV0dXJuIG5ldyBDb21tYW5kSW50ZXJhY3Rpb24oY2xpZW50LCBkYXRhKTtcclxuICAgIGNhc2UgSW50ZXJhY3Rpb25UeXBlLkFwcGxpY2F0aW9uQ29tbWFuZEF1dG9jb21wbGV0ZTpcclxuICAgICAgcmV0dXJuIG5ldyBBdXRvY29tcGxldGVJbnRlcmFjdGlvbihjbGllbnQsIGRhdGEpO1xyXG4gICAgY2FzZSBJbnRlcmFjdGlvblR5cGUuTW9kYWxTdWJtaXQ6XHJcbiAgICAgIHJldHVybiBuZXcgTW9kYWxTdWJtaXRJbnRlcmFjdGlvbihjbGllbnQsIGRhdGEpO1xyXG4gICAgY2FzZSBJbnRlcmFjdGlvblR5cGUuTWVzc2FnZUNvbXBvbmVudDpcclxuICAgICAgLy8gY29tcG9uZW50X3R5cGU6IDIgPSBCdXR0b24sIDMgPSBTZWxlY3QgTWVudVxyXG4gICAgICBpZiAoZGF0YS5kYXRhPy5jb21wb25lbnRfdHlwZSA9PT0gMikge1xyXG4gICAgICAgIHJldHVybiBuZXcgQnV0dG9uSW50ZXJhY3Rpb24oY2xpZW50LCBkYXRhKTtcclxuICAgICAgfSBlbHNlIGlmIChkYXRhLmRhdGE/LmNvbXBvbmVudF90eXBlID09PSAzKSB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBTZWxlY3RNZW51SW50ZXJhY3Rpb24oY2xpZW50LCBkYXRhKTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gbmV3IEludGVyYWN0aW9uKGNsaWVudCwgZGF0YSk7XHJcbiAgICBkZWZhdWx0OlxyXG4gICAgICByZXR1cm4gbmV3IEludGVyYWN0aW9uKGNsaWVudCwgZGF0YSk7XHJcbiAgfVxyXG59XHJcbiJdfQ==