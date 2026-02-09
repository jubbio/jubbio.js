"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModalFields = exports.ModalSubmitInteraction = exports.SelectMenuInteraction = exports.ButtonInteraction = exports.AutocompleteInteraction = exports.CommandInteractionOptions = exports.CommandInteraction = exports.Interaction = void 0;
exports.createInteraction = createInteraction;
const enums_1 = require("../enums");
const User_1 = require("./User");
const GuildMember_1 = require("./GuildMember");
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
        const embeds = typeof options === 'string' ? undefined : options.embeds;
        const components = typeof options === 'string' ? undefined : options.components;
        const ephemeral = typeof options === 'string' ? false : options.ephemeral;
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
    async deleteReply() {
        await this.client.rest.deleteInteractionResponse(this.token);
    }
    /**
     * Send a followup message
     */
    async followUp(options) {
        const content = typeof options === 'string' ? options : options.content;
        const embeds = typeof options === 'string' ? undefined : options.embeds;
        const ephemeral = typeof options === 'string' ? false : options.ephemeral;
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
        await this.client.rest.createInteractionResponse(this.id, this.token, {
            type: enums_1.InteractionResponseType.Modal,
            data: modal
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
        await this.client.rest.createInteractionResponse(this.id, this.token, {
            type: enums_1.InteractionResponseType.UpdateMessage,
            data: {
                content: options.content,
                embeds: options.embeds,
                components: options.components
            }
        });
        this.replied = true;
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
        await this.client.rest.createInteractionResponse(this.id, this.token, {
            type: enums_1.InteractionResponseType.UpdateMessage,
            data: {
                content: options.content,
                embeds: options.embeds,
                components: options.components
            }
        });
        this.replied = true;
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
        this.fields = new ModalFields(data.data?.values || []);
    }
}
exports.ModalSubmitInteraction = ModalSubmitInteraction;
/**
 * Modal fields helper
 */
class ModalFields {
    values;
    constructor(values) {
        this.values = values;
    }
    /**
     * Get a text input value
     */
    getTextInputValue(customId) {
        // Modal values are typically parsed from components
        // This is a simplified implementation
        return null;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSW50ZXJhY3Rpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvc3RydWN0dXJlcy9JbnRlcmFjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFvY0EsOENBbUJDO0FBdGRELG9DQUFrRjtBQUNsRixpQ0FBOEI7QUFDOUIsK0NBQTRDO0FBRzVDOztHQUVHO0FBQ0gsTUFBYSxXQUFXO0lBQ3RCLDhCQUE4QjtJQUNkLE1BQU0sQ0FBUztJQUUvQixxQkFBcUI7SUFDTCxFQUFFLENBQVM7SUFFM0IscUJBQXFCO0lBQ0wsYUFBYSxDQUFTO0lBRXRDLHVCQUF1QjtJQUNQLElBQUksQ0FBa0I7SUFFdEMsZUFBZTtJQUNDLE9BQU8sQ0FBVTtJQUVqQyxpQkFBaUI7SUFDRCxTQUFTLENBQVU7SUFFbkMsd0JBQXdCO0lBQ1IsS0FBSyxDQUFTO0lBRTlCLHlDQUF5QztJQUN6QixJQUFJLENBQU87SUFFM0IsbUNBQW1DO0lBQ25CLE1BQU0sQ0FBZTtJQUVyQyxrREFBa0Q7SUFDM0MsT0FBTyxHQUFHLEtBQUssQ0FBQztJQUV2QixnREFBZ0Q7SUFDekMsUUFBUSxHQUFHLEtBQUssQ0FBQztJQUV4QixZQUFZLE1BQWMsRUFBRSxJQUFvQjtRQUM5QyxJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztRQUNyQixvQ0FBb0M7UUFDcEMsSUFBSSxDQUFDLEVBQUUsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQzFCLElBQUksQ0FBQyxhQUFhLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUNqRCxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7UUFDdEIsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7UUFDakUsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7UUFDdkUsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDO1FBRXhCLHVEQUF1RDtRQUN2RCxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDO1FBQ2hELElBQUksQ0FBQyxJQUFJLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLFdBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxXQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDO1FBRXZGLDRCQUE0QjtRQUM1QixJQUFJLElBQUksQ0FBQyxNQUFNLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ2hDLE1BQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUM5QyxJQUFJLEtBQUssRUFBRSxDQUFDO2dCQUNWLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSx5QkFBVyxDQUFDLE1BQU0sRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQzVELENBQUM7UUFDSCxDQUFDO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0gsU0FBUztRQUNQLE9BQU8sSUFBSSxDQUFDLElBQUksS0FBSyx1QkFBZSxDQUFDLGtCQUFrQixDQUFDO0lBQzFELENBQUM7SUFFRDs7T0FFRztJQUNILGNBQWM7UUFDWixPQUFPLElBQUksQ0FBQyxJQUFJLEtBQUssdUJBQWUsQ0FBQyw4QkFBOEIsQ0FBQztJQUN0RSxDQUFDO0lBRUQ7O09BRUc7SUFDSCxhQUFhO1FBQ1gsT0FBTyxJQUFJLENBQUMsSUFBSSxLQUFLLHVCQUFlLENBQUMsV0FBVyxDQUFDO0lBQ25ELENBQUM7SUFFRDs7T0FFRztJQUNILFFBQVE7UUFDTixPQUFPLElBQUksQ0FBQyxJQUFJLEtBQUssdUJBQWUsQ0FBQyxnQkFBZ0IsSUFBSyxJQUFZLENBQUMsYUFBYSxLQUFLLENBQUMsQ0FBQztJQUM3RixDQUFDO0lBRUQ7O09BRUc7SUFDSCxZQUFZO1FBQ1YsT0FBTyxJQUFJLENBQUMsSUFBSSxLQUFLLHVCQUFlLENBQUMsZ0JBQWdCLElBQUssSUFBWSxDQUFDLGFBQWEsS0FBSyxDQUFDLENBQUM7SUFDN0YsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLEtBQUssQ0FBQyxPQUF5QztRQUNuRCxJQUFJLElBQUksQ0FBQyxPQUFPLElBQUksSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ2xDLE1BQU0sSUFBSSxLQUFLLENBQUMscURBQXFELENBQUMsQ0FBQztRQUN6RSxDQUFDO1FBRUQsTUFBTSxPQUFPLEdBQUcsT0FBTyxPQUFPLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUM7UUFDeEUsTUFBTSxNQUFNLEdBQUcsT0FBTyxPQUFPLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUM7UUFDeEUsTUFBTSxVQUFVLEdBQUcsT0FBTyxPQUFPLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUM7UUFDaEYsTUFBTSxTQUFTLEdBQUcsT0FBTyxPQUFPLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUM7UUFFMUUsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxLQUFLLEVBQUU7WUFDcEUsSUFBSSxFQUFFLCtCQUF1QixDQUFDLHdCQUF3QjtZQUN0RCxJQUFJLEVBQUU7Z0JBQ0osT0FBTztnQkFDUCxNQUFNO2dCQUNOLFVBQVU7Z0JBQ1YsS0FBSyxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUMsb0JBQVksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7YUFDOUM7U0FDRixDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQztJQUN0QixDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsVUFBVSxDQUFDLE9BQWlDO1FBQ2hELElBQUksSUFBSSxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDbEMsTUFBTSxJQUFJLEtBQUssQ0FBQyxxREFBcUQsQ0FBQyxDQUFDO1FBQ3pFLENBQUM7UUFFRCxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLHlCQUF5QixDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRTtZQUNwRSxJQUFJLEVBQUUsK0JBQXVCLENBQUMsZ0NBQWdDO1lBQzlELElBQUksRUFBRSxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxvQkFBWSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQyxTQUFTO1NBQ3pFLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDO0lBQ3ZCLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxTQUFTLENBQUMsT0FBeUM7UUFDdkQsTUFBTSxPQUFPLEdBQUcsT0FBTyxPQUFPLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUM7UUFDeEUsTUFBTSxNQUFNLEdBQUcsT0FBTyxPQUFPLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUM7UUFDeEUsTUFBTSxVQUFVLEdBQUcsT0FBTyxPQUFPLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUM7UUFDaEYsTUFBTSxLQUFLLEdBQUcsT0FBTyxPQUFPLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUM7UUFFdEUsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFO1lBQ3pELE9BQU87WUFDUCxNQUFNO1lBQ04sVUFBVTtZQUNWLEtBQUs7U0FDTixFQUFFLElBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDNUMsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLFdBQVc7UUFDZixNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLHlCQUF5QixDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUMvRCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsUUFBUSxDQUFDLE9BQXlDO1FBQ3RELE1BQU0sT0FBTyxHQUFHLE9BQU8sT0FBTyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDO1FBQ3hFLE1BQU0sTUFBTSxHQUFHLE9BQU8sT0FBTyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDO1FBQ3hFLE1BQU0sU0FBUyxHQUFHLE9BQU8sT0FBTyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDO1FBRTFFLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUU7WUFDaEQsT0FBTztZQUNQLE1BQU07WUFDTixLQUFLLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQyxvQkFBWSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUM5QyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUE1S0Qsa0NBNEtDO0FBRUQ7O0dBRUc7QUFDSCxNQUFhLGtCQUFtQixTQUFRLFdBQVc7SUFDakQsbUJBQW1CO0lBQ0gsV0FBVyxDQUFTO0lBRXBDLHNCQUFzQjtJQUNOLE9BQU8sQ0FBNEI7SUFFbkQsWUFBWSxNQUFjLEVBQUUsSUFBb0I7UUFDOUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNwQixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxJQUFJLEVBQUUsQ0FBQztRQUN6QyxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUkseUJBQXlCLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxPQUFPLElBQUksRUFBRSxDQUFDLENBQUM7SUFDekUsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLFNBQVMsQ0FBQyxLQUFnQjtRQUM5QixNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLHlCQUF5QixDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRTtZQUNwRSxJQUFJLEVBQUUsK0JBQXVCLENBQUMsS0FBSztZQUNuQyxJQUFJLEVBQUUsS0FBSztTQUNaLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQXRCRCxnREFzQkM7QUFFRDs7R0FFRztBQUNILE1BQWEseUJBQXlCO0lBQzVCLE9BQU8sQ0FBeUI7SUFFeEMsWUFBWSxPQUErQjtRQUN6QyxJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztJQUN6QixDQUFDO0lBRUQ7O09BRUc7SUFDSCxTQUFTLENBQUMsSUFBWSxFQUFFLFFBQWtCO1FBQ3hDLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsQ0FBQztRQUN2RCxJQUFJLENBQUMsTUFBTSxJQUFJLFFBQVE7WUFBRSxNQUFNLElBQUksS0FBSyxDQUFDLG9CQUFvQixJQUFJLGFBQWEsQ0FBQyxDQUFDO1FBQ2hGLE9BQU8sTUFBTSxFQUFFLEtBQWUsSUFBSSxJQUFJLENBQUM7SUFDekMsQ0FBQztJQUVEOztPQUVHO0lBQ0gsVUFBVSxDQUFDLElBQVksRUFBRSxRQUFrQjtRQUN6QyxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLENBQUM7UUFDdkQsSUFBSSxDQUFDLE1BQU0sSUFBSSxRQUFRO1lBQUUsTUFBTSxJQUFJLEtBQUssQ0FBQyxvQkFBb0IsSUFBSSxhQUFhLENBQUMsQ0FBQztRQUNoRixPQUFPLE1BQU0sRUFBRSxLQUFlLElBQUksSUFBSSxDQUFDO0lBQ3pDLENBQUM7SUFFRDs7T0FFRztJQUNILFNBQVMsQ0FBQyxJQUFZLEVBQUUsUUFBa0I7UUFDeEMsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQztJQUN6QyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxVQUFVLENBQUMsSUFBWSxFQUFFLFFBQWtCO1FBQ3pDLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsQ0FBQztRQUN2RCxJQUFJLENBQUMsTUFBTSxJQUFJLFFBQVE7WUFBRSxNQUFNLElBQUksS0FBSyxDQUFDLG9CQUFvQixJQUFJLGFBQWEsQ0FBQyxDQUFDO1FBQ2hGLE9BQU8sTUFBTSxFQUFFLEtBQWdCLElBQUksSUFBSSxDQUFDO0lBQzFDLENBQUM7SUFFRDs7T0FFRztJQUNILE9BQU8sQ0FBQyxJQUFZLEVBQUUsUUFBa0I7UUFDdEMsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQyxDQUFDO1FBQ3ZELElBQUksQ0FBQyxNQUFNLElBQUksUUFBUTtZQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMsb0JBQW9CLElBQUksYUFBYSxDQUFDLENBQUM7UUFDaEYsT0FBTyxNQUFNLEVBQUUsS0FBZSxJQUFJLElBQUksQ0FBQztJQUN6QyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxVQUFVLENBQUMsSUFBWSxFQUFFLFFBQWtCO1FBQ3pDLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsQ0FBQztRQUN2RCxJQUFJLENBQUMsTUFBTSxJQUFJLFFBQVE7WUFBRSxNQUFNLElBQUksS0FBSyxDQUFDLG9CQUFvQixJQUFJLGFBQWEsQ0FBQyxDQUFDO1FBQ2hGLE9BQU8sTUFBTSxFQUFFLEtBQWUsSUFBSSxJQUFJLENBQUM7SUFDekMsQ0FBQztJQUVEOztPQUVHO0lBQ0gsYUFBYSxDQUFDLFFBQWtCO1FBQzlCLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQztRQUNwRCxJQUFJLENBQUMsTUFBTSxJQUFJLFFBQVE7WUFBRSxNQUFNLElBQUksS0FBSyxDQUFDLCtCQUErQixDQUFDLENBQUM7UUFDMUUsT0FBTyxNQUFNLEVBQUUsSUFBSSxJQUFJLElBQUksQ0FBQztJQUM5QixDQUFDO0lBRUQ7O09BRUc7SUFDSCxVQUFVO1FBQ1IsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDakQsSUFBSSxDQUFDLE1BQU07WUFBRSxPQUFPLElBQUksQ0FBQztRQUN6QixPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLEVBQUUsS0FBSyxFQUFFLE1BQU0sQ0FBQyxLQUFlLEVBQUUsQ0FBQztJQUM5RCxDQUFDO0NBQ0Y7QUE1RUQsOERBNEVDO0FBRUQ7O0dBRUc7QUFDSCxNQUFhLHVCQUF3QixTQUFRLFdBQVc7SUFDdEQsbUJBQW1CO0lBQ0gsV0FBVyxDQUFTO0lBRXBDLHNCQUFzQjtJQUNOLE9BQU8sQ0FBNEI7SUFFbkQsWUFBWSxNQUFjLEVBQUUsSUFBb0I7UUFDOUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNwQixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxJQUFJLEVBQUUsQ0FBQztRQUN6QyxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUkseUJBQXlCLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxPQUFPLElBQUksRUFBRSxDQUFDLENBQUM7SUFDekUsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLE9BQU8sQ0FBQyxPQUE2QjtRQUN6QyxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLHlCQUF5QixDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRTtZQUNwRSxJQUFJLEVBQUUsK0JBQXVCLENBQUMsb0NBQW9DO1lBQ2xFLElBQUksRUFBRSxFQUFFLE9BQU8sRUFBRTtTQUNsQixDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUF0QkQsMERBc0JDO0FBRUQ7O0dBRUc7QUFDSCxNQUFhLGlCQUFrQixTQUFRLFdBQVc7SUFDaEQsdUJBQXVCO0lBQ1AsUUFBUSxDQUFTO0lBRWpDLDRDQUE0QztJQUM1QixhQUFhLEdBQVcsQ0FBQyxDQUFDO0lBRTFDLHdDQUF3QztJQUN4QixPQUFPLENBQU87SUFFOUIsWUFBWSxNQUFjLEVBQUUsSUFBb0I7UUFDOUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNwQixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxJQUFJLEVBQUUsU0FBUyxJQUFJLEVBQUUsQ0FBQztRQUMzQyxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUM7SUFDOUIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLE1BQU0sQ0FBQyxPQUFnQztRQUMzQyxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLHlCQUF5QixDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRTtZQUNwRSxJQUFJLEVBQUUsK0JBQXVCLENBQUMsYUFBYTtZQUMzQyxJQUFJLEVBQUU7Z0JBQ0osT0FBTyxFQUFFLE9BQU8sQ0FBQyxPQUFPO2dCQUN4QixNQUFNLEVBQUUsT0FBTyxDQUFDLE1BQU07Z0JBQ3RCLFVBQVUsRUFBRSxPQUFPLENBQUMsVUFBVTthQUMvQjtTQUNGLENBQUMsQ0FBQztRQUNILElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDO0lBQ3RCLENBQUM7Q0FDRjtBQTlCRCw4Q0E4QkM7QUFFRDs7R0FFRztBQUNILE1BQWEscUJBQXNCLFNBQVEsV0FBVztJQUNwRCw0QkFBNEI7SUFDWixRQUFRLENBQVM7SUFFakMsaURBQWlEO0lBQ2pDLGFBQWEsR0FBVyxDQUFDLENBQUM7SUFFMUMsc0JBQXNCO0lBQ04sTUFBTSxDQUFXO0lBRWpDLDZDQUE2QztJQUM3QixPQUFPLENBQU87SUFFOUIsWUFBWSxNQUFjLEVBQUUsSUFBb0I7UUFDOUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNwQixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxJQUFJLEVBQUUsU0FBUyxJQUFJLEVBQUUsQ0FBQztRQUMzQyxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxJQUFJLEVBQUUsTUFBTSxJQUFJLEVBQUUsQ0FBQztRQUN0QyxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUM7SUFDOUIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsS0FBSyxDQUFDLE1BQU0sQ0FBQyxPQUFnQztRQUMzQyxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLHlCQUF5QixDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRTtZQUNwRSxJQUFJLEVBQUUsK0JBQXVCLENBQUMsYUFBYTtZQUMzQyxJQUFJLEVBQUU7Z0JBQ0osT0FBTyxFQUFFLE9BQU8sQ0FBQyxPQUFPO2dCQUN4QixNQUFNLEVBQUUsT0FBTyxDQUFDLE1BQU07Z0JBQ3RCLFVBQVUsRUFBRSxPQUFPLENBQUMsVUFBVTthQUMvQjtTQUNGLENBQUMsQ0FBQztRQUNILElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDO0lBQ3RCLENBQUM7Q0FDRjtBQWxDRCxzREFrQ0M7QUFFRDs7R0FFRztBQUNILE1BQWEsc0JBQXVCLFNBQVEsV0FBVztJQUNyRCxzQkFBc0I7SUFDTixRQUFRLENBQVM7SUFFakMsbUJBQW1CO0lBQ0gsTUFBTSxDQUFjO0lBRXBDLFlBQVksTUFBYyxFQUFFLElBQW9CO1FBQzlDLEtBQUssQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDcEIsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsSUFBSSxFQUFFLFNBQVMsSUFBSSxFQUFFLENBQUM7UUFDM0MsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLE1BQU0sSUFBSSxFQUFFLENBQUMsQ0FBQztJQUN6RCxDQUFDO0NBQ0Y7QUFaRCx3REFZQztBQUVEOztHQUVHO0FBQ0gsTUFBYSxXQUFXO0lBQ2QsTUFBTSxDQUFXO0lBRXpCLFlBQVksTUFBZ0I7UUFDMUIsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7SUFDdkIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsaUJBQWlCLENBQUMsUUFBZ0I7UUFDaEMsb0RBQW9EO1FBQ3BELHNDQUFzQztRQUN0QyxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7Q0FDRjtBQWZELGtDQWVDO0FBc0JEOztHQUVHO0FBQ0gsU0FBZ0IsaUJBQWlCLENBQUMsTUFBYyxFQUFFLElBQW9CO0lBQ3BFLFFBQVEsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ2xCLEtBQUssdUJBQWUsQ0FBQyxrQkFBa0I7WUFDckMsT0FBTyxJQUFJLGtCQUFrQixDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztRQUM5QyxLQUFLLHVCQUFlLENBQUMsOEJBQThCO1lBQ2pELE9BQU8sSUFBSSx1QkFBdUIsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDbkQsS0FBSyx1QkFBZSxDQUFDLFdBQVc7WUFDOUIsT0FBTyxJQUFJLHNCQUFzQixDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNsRCxLQUFLLHVCQUFlLENBQUMsZ0JBQWdCO1lBQ25DLDhDQUE4QztZQUM5QyxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUUsY0FBYyxLQUFLLENBQUMsRUFBRSxDQUFDO2dCQUNwQyxPQUFPLElBQUksaUJBQWlCLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQzdDLENBQUM7aUJBQU0sSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFLGNBQWMsS0FBSyxDQUFDLEVBQUUsQ0FBQztnQkFDM0MsT0FBTyxJQUFJLHFCQUFxQixDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztZQUNqRCxDQUFDO1lBQ0QsT0FBTyxJQUFJLFdBQVcsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDdkM7WUFDRSxPQUFPLElBQUksV0FBVyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztJQUN6QyxDQUFDO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFQSUludGVyYWN0aW9uLCBBUElJbnRlcmFjdGlvbk9wdGlvbiwgQVBJRW1iZWQgfSBmcm9tICcuLi90eXBlcyc7XHJcbmltcG9ydCB7IEludGVyYWN0aW9uVHlwZSwgSW50ZXJhY3Rpb25SZXNwb25zZVR5cGUsIE1lc3NhZ2VGbGFncyB9IGZyb20gJy4uL2VudW1zJztcclxuaW1wb3J0IHsgVXNlciB9IGZyb20gJy4vVXNlcic7XHJcbmltcG9ydCB7IEd1aWxkTWVtYmVyIH0gZnJvbSAnLi9HdWlsZE1lbWJlcic7XHJcbmltcG9ydCB0eXBlIHsgQ2xpZW50IH0gZnJvbSAnLi4vQ2xpZW50JztcclxuXHJcbi8qKlxyXG4gKiBCYXNlIGludGVyYWN0aW9uIGNsYXNzXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgSW50ZXJhY3Rpb24ge1xyXG4gIC8qKiBSZWZlcmVuY2UgdG8gdGhlIGNsaWVudCAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBjbGllbnQ6IENsaWVudDtcclxuICBcclxuICAvKiogSW50ZXJhY3Rpb24gSUQgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgaWQ6IHN0cmluZztcclxuICBcclxuICAvKiogQXBwbGljYXRpb24gSUQgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgYXBwbGljYXRpb25JZDogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBJbnRlcmFjdGlvbiB0eXBlICovXHJcbiAgcHVibGljIHJlYWRvbmx5IHR5cGU6IEludGVyYWN0aW9uVHlwZTtcclxuICBcclxuICAvKiogR3VpbGQgSUQgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgZ3VpbGRJZD86IHN0cmluZztcclxuICBcclxuICAvKiogQ2hhbm5lbCBJRCAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBjaGFubmVsSWQ/OiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIEludGVyYWN0aW9uIHRva2VuICovXHJcbiAgcHVibGljIHJlYWRvbmx5IHRva2VuOiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIFVzZXIgd2hvIHRyaWdnZXJlZCB0aGUgaW50ZXJhY3Rpb24gKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgdXNlcjogVXNlcjtcclxuICBcclxuICAvKiogR3VpbGQgbWVtYmVyIChpZiBpbiBhIGd1aWxkKSAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBtZW1iZXI/OiBHdWlsZE1lbWJlcjtcclxuICBcclxuICAvKiogV2hldGhlciB0aGUgaW50ZXJhY3Rpb24gaGFzIGJlZW4gcmVwbGllZCB0byAqL1xyXG4gIHB1YmxpYyByZXBsaWVkID0gZmFsc2U7XHJcbiAgXHJcbiAgLyoqIFdoZXRoZXIgdGhlIGludGVyYWN0aW9uIGhhcyBiZWVuIGRlZmVycmVkICovXHJcbiAgcHVibGljIGRlZmVycmVkID0gZmFsc2U7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGNsaWVudDogQ2xpZW50LCBkYXRhOiBBUElJbnRlcmFjdGlvbikge1xyXG4gICAgdGhpcy5jbGllbnQgPSBjbGllbnQ7XHJcbiAgICAvLyBIYW5kbGUgYm90aCBzdHJpbmcgYW5kIG51bWJlciBJRHNcclxuICAgIHRoaXMuaWQgPSBTdHJpbmcoZGF0YS5pZCk7XHJcbiAgICB0aGlzLmFwcGxpY2F0aW9uSWQgPSBTdHJpbmcoZGF0YS5hcHBsaWNhdGlvbl9pZCk7XHJcbiAgICB0aGlzLnR5cGUgPSBkYXRhLnR5cGU7XHJcbiAgICB0aGlzLmd1aWxkSWQgPSBkYXRhLmd1aWxkX2lkID8gU3RyaW5nKGRhdGEuZ3VpbGRfaWQpIDogdW5kZWZpbmVkO1xyXG4gICAgdGhpcy5jaGFubmVsSWQgPSBkYXRhLmNoYW5uZWxfaWQgPyBTdHJpbmcoZGF0YS5jaGFubmVsX2lkKSA6IHVuZGVmaW5lZDtcclxuICAgIHRoaXMudG9rZW4gPSBkYXRhLnRva2VuO1xyXG4gICAgXHJcbiAgICAvLyBVc2VyIGNhbiBjb21lIGZyb20gbWVtYmVyLnVzZXIgb3IgZGlyZWN0bHkgZnJvbSB1c2VyXHJcbiAgICBjb25zdCB1c2VyRGF0YSA9IGRhdGEubWVtYmVyPy51c2VyIHx8IGRhdGEudXNlcjtcclxuICAgIHRoaXMudXNlciA9IHVzZXJEYXRhID8gbmV3IFVzZXIodXNlckRhdGEpIDogbmV3IFVzZXIoeyBpZDogJzAnLCB1c2VybmFtZTogJ1Vua25vd24nIH0pO1xyXG4gICAgXHJcbiAgICAvLyBDcmVhdGUgbWVtYmVyIGlmIGluIGd1aWxkXHJcbiAgICBpZiAoZGF0YS5tZW1iZXIgJiYgdGhpcy5ndWlsZElkKSB7XHJcbiAgICAgIGNvbnN0IGd1aWxkID0gY2xpZW50Lmd1aWxkcy5nZXQodGhpcy5ndWlsZElkKTtcclxuICAgICAgaWYgKGd1aWxkKSB7XHJcbiAgICAgICAgdGhpcy5tZW1iZXIgPSBuZXcgR3VpbGRNZW1iZXIoY2xpZW50LCBndWlsZCwgZGF0YS5tZW1iZXIpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDaGVjayBpZiB0aGlzIGlzIGEgY29tbWFuZCBpbnRlcmFjdGlvblxyXG4gICAqL1xyXG4gIGlzQ29tbWFuZCgpOiB0aGlzIGlzIENvbW1hbmRJbnRlcmFjdGlvbiB7XHJcbiAgICByZXR1cm4gdGhpcy50eXBlID09PSBJbnRlcmFjdGlvblR5cGUuQXBwbGljYXRpb25Db21tYW5kO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2hlY2sgaWYgdGhpcyBpcyBhbiBhdXRvY29tcGxldGUgaW50ZXJhY3Rpb25cclxuICAgKi9cclxuICBpc0F1dG9jb21wbGV0ZSgpOiB0aGlzIGlzIEF1dG9jb21wbGV0ZUludGVyYWN0aW9uIHtcclxuICAgIHJldHVybiB0aGlzLnR5cGUgPT09IEludGVyYWN0aW9uVHlwZS5BcHBsaWNhdGlvbkNvbW1hbmRBdXRvY29tcGxldGU7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDaGVjayBpZiB0aGlzIGlzIGEgbW9kYWwgc3VibWl0IGludGVyYWN0aW9uXHJcbiAgICovXHJcbiAgaXNNb2RhbFN1Ym1pdCgpOiB0aGlzIGlzIE1vZGFsU3VibWl0SW50ZXJhY3Rpb24ge1xyXG4gICAgcmV0dXJuIHRoaXMudHlwZSA9PT0gSW50ZXJhY3Rpb25UeXBlLk1vZGFsU3VibWl0O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2hlY2sgaWYgdGhpcyBpcyBhIGJ1dHRvbiBpbnRlcmFjdGlvblxyXG4gICAqL1xyXG4gIGlzQnV0dG9uKCk6IHRoaXMgaXMgQnV0dG9uSW50ZXJhY3Rpb24ge1xyXG4gICAgcmV0dXJuIHRoaXMudHlwZSA9PT0gSW50ZXJhY3Rpb25UeXBlLk1lc3NhZ2VDb21wb25lbnQgJiYgKHRoaXMgYXMgYW55KS5jb21wb25lbnRUeXBlID09PSAyO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2hlY2sgaWYgdGhpcyBpcyBhIHNlbGVjdCBtZW51IGludGVyYWN0aW9uXHJcbiAgICovXHJcbiAgaXNTZWxlY3RNZW51KCk6IHRoaXMgaXMgU2VsZWN0TWVudUludGVyYWN0aW9uIHtcclxuICAgIHJldHVybiB0aGlzLnR5cGUgPT09IEludGVyYWN0aW9uVHlwZS5NZXNzYWdlQ29tcG9uZW50ICYmICh0aGlzIGFzIGFueSkuY29tcG9uZW50VHlwZSA9PT0gMztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlcGx5IHRvIHRoZSBpbnRlcmFjdGlvblxyXG4gICAqL1xyXG4gIGFzeW5jIHJlcGx5KG9wdGlvbnM6IHN0cmluZyB8IEludGVyYWN0aW9uUmVwbHlPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBpZiAodGhpcy5yZXBsaWVkIHx8IHRoaXMuZGVmZXJyZWQpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnRlcmFjdGlvbiBoYXMgYWxyZWFkeSBiZWVuIHJlcGxpZWQgdG8gb3IgZGVmZXJyZWQnKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgY29uc3QgY29udGVudCA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IG9wdGlvbnMgOiBvcHRpb25zLmNvbnRlbnQ7XHJcbiAgICBjb25zdCBlbWJlZHMgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyB1bmRlZmluZWQgOiBvcHRpb25zLmVtYmVkcztcclxuICAgIGNvbnN0IGNvbXBvbmVudHMgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyB1bmRlZmluZWQgOiBvcHRpb25zLmNvbXBvbmVudHM7XHJcbiAgICBjb25zdCBlcGhlbWVyYWwgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyBmYWxzZSA6IG9wdGlvbnMuZXBoZW1lcmFsO1xyXG4gICAgXHJcbiAgICBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LmNyZWF0ZUludGVyYWN0aW9uUmVzcG9uc2UodGhpcy5pZCwgdGhpcy50b2tlbiwge1xyXG4gICAgICB0eXBlOiBJbnRlcmFjdGlvblJlc3BvbnNlVHlwZS5DaGFubmVsTWVzc2FnZVdpdGhTb3VyY2UsXHJcbiAgICAgIGRhdGE6IHtcclxuICAgICAgICBjb250ZW50LFxyXG4gICAgICAgIGVtYmVkcyxcclxuICAgICAgICBjb21wb25lbnRzLFxyXG4gICAgICAgIGZsYWdzOiBlcGhlbWVyYWwgPyBNZXNzYWdlRmxhZ3MuRXBoZW1lcmFsIDogMFxyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgdGhpcy5yZXBsaWVkID0gdHJ1ZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlZmVyIHRoZSByZXBseSAoc2hvd3MgXCJ0aGlua2luZy4uLlwiKVxyXG4gICAqL1xyXG4gIGFzeW5jIGRlZmVyUmVwbHkob3B0aW9ucz86IHsgZXBoZW1lcmFsPzogYm9vbGVhbiB9KTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBpZiAodGhpcy5yZXBsaWVkIHx8IHRoaXMuZGVmZXJyZWQpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnRlcmFjdGlvbiBoYXMgYWxyZWFkeSBiZWVuIHJlcGxpZWQgdG8gb3IgZGVmZXJyZWQnKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5jcmVhdGVJbnRlcmFjdGlvblJlc3BvbnNlKHRoaXMuaWQsIHRoaXMudG9rZW4sIHtcclxuICAgICAgdHlwZTogSW50ZXJhY3Rpb25SZXNwb25zZVR5cGUuRGVmZXJyZWRDaGFubmVsTWVzc2FnZVdpdGhTb3VyY2UsXHJcbiAgICAgIGRhdGE6IG9wdGlvbnM/LmVwaGVtZXJhbCA/IHsgZmxhZ3M6IE1lc3NhZ2VGbGFncy5FcGhlbWVyYWwgfSA6IHVuZGVmaW5lZFxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIHRoaXMuZGVmZXJyZWQgPSB0cnVlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRWRpdCB0aGUgcmVwbHlcclxuICAgKi9cclxuICBhc3luYyBlZGl0UmVwbHkob3B0aW9uczogc3RyaW5nIHwgSW50ZXJhY3Rpb25SZXBseU9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGNvbnN0IGNvbnRlbnQgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyBvcHRpb25zIDogb3B0aW9ucy5jb250ZW50O1xyXG4gICAgY29uc3QgZW1iZWRzID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gdW5kZWZpbmVkIDogb3B0aW9ucy5lbWJlZHM7XHJcbiAgICBjb25zdCBjb21wb25lbnRzID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gdW5kZWZpbmVkIDogb3B0aW9ucy5jb21wb25lbnRzO1xyXG4gICAgY29uc3QgZmlsZXMgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyB1bmRlZmluZWQgOiBvcHRpb25zLmZpbGVzO1xyXG4gICAgXHJcbiAgICBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LmVkaXRJbnRlcmFjdGlvblJlc3BvbnNlKHRoaXMudG9rZW4sIHtcclxuICAgICAgY29udGVudCxcclxuICAgICAgZW1iZWRzLFxyXG4gICAgICBjb21wb25lbnRzLFxyXG4gICAgICBmaWxlc1xyXG4gICAgfSwgdGhpcy5ndWlsZElkLCB0aGlzLmNoYW5uZWxJZCwgdGhpcy5pZCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZWxldGUgdGhlIHJlcGx5XHJcbiAgICovXHJcbiAgYXN5bmMgZGVsZXRlUmVwbHkoKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LmRlbGV0ZUludGVyYWN0aW9uUmVzcG9uc2UodGhpcy50b2tlbik7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZW5kIGEgZm9sbG93dXAgbWVzc2FnZVxyXG4gICAqL1xyXG4gIGFzeW5jIGZvbGxvd1VwKG9wdGlvbnM6IHN0cmluZyB8IEludGVyYWN0aW9uUmVwbHlPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBjb250ZW50ID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gb3B0aW9ucyA6IG9wdGlvbnMuY29udGVudDtcclxuICAgIGNvbnN0IGVtYmVkcyA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IHVuZGVmaW5lZCA6IG9wdGlvbnMuZW1iZWRzO1xyXG4gICAgY29uc3QgZXBoZW1lcmFsID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gZmFsc2UgOiBvcHRpb25zLmVwaGVtZXJhbDtcclxuICAgIFxyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5jcmVhdGVGb2xsb3d1cCh0aGlzLnRva2VuLCB7XHJcbiAgICAgIGNvbnRlbnQsXHJcbiAgICAgIGVtYmVkcyxcclxuICAgICAgZmxhZ3M6IGVwaGVtZXJhbCA/IE1lc3NhZ2VGbGFncy5FcGhlbWVyYWwgOiAwXHJcbiAgICB9KTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb21tYW5kIGludGVyYWN0aW9uXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgQ29tbWFuZEludGVyYWN0aW9uIGV4dGVuZHMgSW50ZXJhY3Rpb24ge1xyXG4gIC8qKiBDb21tYW5kIG5hbWUgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgY29tbWFuZE5hbWU6IHN0cmluZztcclxuICBcclxuICAvKiogQ29tbWFuZCBvcHRpb25zICovXHJcbiAgcHVibGljIHJlYWRvbmx5IG9wdGlvbnM6IENvbW1hbmRJbnRlcmFjdGlvbk9wdGlvbnM7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGNsaWVudDogQ2xpZW50LCBkYXRhOiBBUElJbnRlcmFjdGlvbikge1xyXG4gICAgc3VwZXIoY2xpZW50LCBkYXRhKTtcclxuICAgIHRoaXMuY29tbWFuZE5hbWUgPSBkYXRhLmRhdGE/Lm5hbWUgfHwgJyc7XHJcbiAgICB0aGlzLm9wdGlvbnMgPSBuZXcgQ29tbWFuZEludGVyYWN0aW9uT3B0aW9ucyhkYXRhLmRhdGE/Lm9wdGlvbnMgfHwgW10pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2hvdyBhIG1vZGFsXHJcbiAgICovXHJcbiAgYXN5bmMgc2hvd01vZGFsKG1vZGFsOiBNb2RhbERhdGEpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGF3YWl0IHRoaXMuY2xpZW50LnJlc3QuY3JlYXRlSW50ZXJhY3Rpb25SZXNwb25zZSh0aGlzLmlkLCB0aGlzLnRva2VuLCB7XHJcbiAgICAgIHR5cGU6IEludGVyYWN0aW9uUmVzcG9uc2VUeXBlLk1vZGFsLFxyXG4gICAgICBkYXRhOiBtb2RhbFxyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogQ29tbWFuZCBpbnRlcmFjdGlvbiBvcHRpb25zIGhlbHBlclxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIENvbW1hbmRJbnRlcmFjdGlvbk9wdGlvbnMge1xyXG4gIHByaXZhdGUgb3B0aW9uczogQVBJSW50ZXJhY3Rpb25PcHRpb25bXTtcclxuXHJcbiAgY29uc3RydWN0b3Iob3B0aW9uczogQVBJSW50ZXJhY3Rpb25PcHRpb25bXSkge1xyXG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhIHN0cmluZyBvcHRpb25cclxuICAgKi9cclxuICBnZXRTdHJpbmcobmFtZTogc3RyaW5nLCByZXF1aXJlZD86IGJvb2xlYW4pOiBzdHJpbmcgfCBudWxsIHtcclxuICAgIGNvbnN0IG9wdGlvbiA9IHRoaXMub3B0aW9ucy5maW5kKG8gPT4gby5uYW1lID09PSBuYW1lKTtcclxuICAgIGlmICghb3B0aW9uICYmIHJlcXVpcmVkKSB0aHJvdyBuZXcgRXJyb3IoYFJlcXVpcmVkIG9wdGlvbiBcIiR7bmFtZX1cIiBub3QgZm91bmRgKTtcclxuICAgIHJldHVybiBvcHRpb24/LnZhbHVlIGFzIHN0cmluZyB8fCBudWxsO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGFuIGludGVnZXIgb3B0aW9uXHJcbiAgICovXHJcbiAgZ2V0SW50ZWdlcihuYW1lOiBzdHJpbmcsIHJlcXVpcmVkPzogYm9vbGVhbik6IG51bWJlciB8IG51bGwge1xyXG4gICAgY29uc3Qgb3B0aW9uID0gdGhpcy5vcHRpb25zLmZpbmQobyA9PiBvLm5hbWUgPT09IG5hbWUpO1xyXG4gICAgaWYgKCFvcHRpb24gJiYgcmVxdWlyZWQpIHRocm93IG5ldyBFcnJvcihgUmVxdWlyZWQgb3B0aW9uIFwiJHtuYW1lfVwiIG5vdCBmb3VuZGApO1xyXG4gICAgcmV0dXJuIG9wdGlvbj8udmFsdWUgYXMgbnVtYmVyIHx8IG51bGw7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSBudW1iZXIgb3B0aW9uXHJcbiAgICovXHJcbiAgZ2V0TnVtYmVyKG5hbWU6IHN0cmluZywgcmVxdWlyZWQ/OiBib29sZWFuKTogbnVtYmVyIHwgbnVsbCB7XHJcbiAgICByZXR1cm4gdGhpcy5nZXRJbnRlZ2VyKG5hbWUsIHJlcXVpcmVkKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhIGJvb2xlYW4gb3B0aW9uXHJcbiAgICovXHJcbiAgZ2V0Qm9vbGVhbihuYW1lOiBzdHJpbmcsIHJlcXVpcmVkPzogYm9vbGVhbik6IGJvb2xlYW4gfCBudWxsIHtcclxuICAgIGNvbnN0IG9wdGlvbiA9IHRoaXMub3B0aW9ucy5maW5kKG8gPT4gby5uYW1lID09PSBuYW1lKTtcclxuICAgIGlmICghb3B0aW9uICYmIHJlcXVpcmVkKSB0aHJvdyBuZXcgRXJyb3IoYFJlcXVpcmVkIG9wdGlvbiBcIiR7bmFtZX1cIiBub3QgZm91bmRgKTtcclxuICAgIHJldHVybiBvcHRpb24/LnZhbHVlIGFzIGJvb2xlYW4gPz8gbnVsbDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhIHVzZXIgb3B0aW9uXHJcbiAgICovXHJcbiAgZ2V0VXNlcihuYW1lOiBzdHJpbmcsIHJlcXVpcmVkPzogYm9vbGVhbik6IHN0cmluZyB8IG51bGwge1xyXG4gICAgY29uc3Qgb3B0aW9uID0gdGhpcy5vcHRpb25zLmZpbmQobyA9PiBvLm5hbWUgPT09IG5hbWUpO1xyXG4gICAgaWYgKCFvcHRpb24gJiYgcmVxdWlyZWQpIHRocm93IG5ldyBFcnJvcihgUmVxdWlyZWQgb3B0aW9uIFwiJHtuYW1lfVwiIG5vdCBmb3VuZGApO1xyXG4gICAgcmV0dXJuIG9wdGlvbj8udmFsdWUgYXMgc3RyaW5nIHx8IG51bGw7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSBjaGFubmVsIG9wdGlvblxyXG4gICAqL1xyXG4gIGdldENoYW5uZWwobmFtZTogc3RyaW5nLCByZXF1aXJlZD86IGJvb2xlYW4pOiBzdHJpbmcgfCBudWxsIHtcclxuICAgIGNvbnN0IG9wdGlvbiA9IHRoaXMub3B0aW9ucy5maW5kKG8gPT4gby5uYW1lID09PSBuYW1lKTtcclxuICAgIGlmICghb3B0aW9uICYmIHJlcXVpcmVkKSB0aHJvdyBuZXcgRXJyb3IoYFJlcXVpcmVkIG9wdGlvbiBcIiR7bmFtZX1cIiBub3QgZm91bmRgKTtcclxuICAgIHJldHVybiBvcHRpb24/LnZhbHVlIGFzIHN0cmluZyB8fCBudWxsO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGEgc3ViY29tbWFuZCBuYW1lXHJcbiAgICovXHJcbiAgZ2V0U3ViY29tbWFuZChyZXF1aXJlZD86IGJvb2xlYW4pOiBzdHJpbmcgfCBudWxsIHtcclxuICAgIGNvbnN0IG9wdGlvbiA9IHRoaXMub3B0aW9ucy5maW5kKG8gPT4gby50eXBlID09PSAxKTtcclxuICAgIGlmICghb3B0aW9uICYmIHJlcXVpcmVkKSB0aHJvdyBuZXcgRXJyb3IoJ1JlcXVpcmVkIHN1YmNvbW1hbmQgbm90IGZvdW5kJyk7XHJcbiAgICByZXR1cm4gb3B0aW9uPy5uYW1lIHx8IG51bGw7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgdGhlIGZvY3VzZWQgb3B0aW9uIChmb3IgYXV0b2NvbXBsZXRlKVxyXG4gICAqL1xyXG4gIGdldEZvY3VzZWQoKTogeyBuYW1lOiBzdHJpbmc7IHZhbHVlOiBzdHJpbmcgfSB8IG51bGwge1xyXG4gICAgY29uc3Qgb3B0aW9uID0gdGhpcy5vcHRpb25zLmZpbmQobyA9PiBvLmZvY3VzZWQpO1xyXG4gICAgaWYgKCFvcHRpb24pIHJldHVybiBudWxsO1xyXG4gICAgcmV0dXJuIHsgbmFtZTogb3B0aW9uLm5hbWUsIHZhbHVlOiBvcHRpb24udmFsdWUgYXMgc3RyaW5nIH07XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogQXV0b2NvbXBsZXRlIGludGVyYWN0aW9uXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgQXV0b2NvbXBsZXRlSW50ZXJhY3Rpb24gZXh0ZW5kcyBJbnRlcmFjdGlvbiB7XHJcbiAgLyoqIENvbW1hbmQgbmFtZSAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBjb21tYW5kTmFtZTogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBDb21tYW5kIG9wdGlvbnMgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgb3B0aW9uczogQ29tbWFuZEludGVyYWN0aW9uT3B0aW9ucztcclxuXHJcbiAgY29uc3RydWN0b3IoY2xpZW50OiBDbGllbnQsIGRhdGE6IEFQSUludGVyYWN0aW9uKSB7XHJcbiAgICBzdXBlcihjbGllbnQsIGRhdGEpO1xyXG4gICAgdGhpcy5jb21tYW5kTmFtZSA9IGRhdGEuZGF0YT8ubmFtZSB8fCAnJztcclxuICAgIHRoaXMub3B0aW9ucyA9IG5ldyBDb21tYW5kSW50ZXJhY3Rpb25PcHRpb25zKGRhdGEuZGF0YT8ub3B0aW9ucyB8fCBbXSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZXNwb25kIHdpdGggYXV0b2NvbXBsZXRlIGNob2ljZXNcclxuICAgKi9cclxuICBhc3luYyByZXNwb25kKGNob2ljZXM6IEF1dG9jb21wbGV0ZUNob2ljZVtdKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LmNyZWF0ZUludGVyYWN0aW9uUmVzcG9uc2UodGhpcy5pZCwgdGhpcy50b2tlbiwge1xyXG4gICAgICB0eXBlOiBJbnRlcmFjdGlvblJlc3BvbnNlVHlwZS5BcHBsaWNhdGlvbkNvbW1hbmRBdXRvY29tcGxldGVSZXN1bHQsXHJcbiAgICAgIGRhdGE6IHsgY2hvaWNlcyB9XHJcbiAgICB9KTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBCdXR0b24gaW50ZXJhY3Rpb25cclxuICovXHJcbmV4cG9ydCBjbGFzcyBCdXR0b25JbnRlcmFjdGlvbiBleHRlbmRzIEludGVyYWN0aW9uIHtcclxuICAvKiogQnV0dG9uIGN1c3RvbSBJRCAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBjdXN0b21JZDogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBDb21wb25lbnQgdHlwZSAoYWx3YXlzIDIgZm9yIGJ1dHRvbnMpICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGNvbXBvbmVudFR5cGU6IG51bWJlciA9IDI7XHJcbiAgXHJcbiAgLyoqIE1lc3NhZ2UgdGhlIGJ1dHRvbiBpcyBhdHRhY2hlZCB0byAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBtZXNzYWdlPzogYW55O1xyXG5cclxuICBjb25zdHJ1Y3RvcihjbGllbnQ6IENsaWVudCwgZGF0YTogQVBJSW50ZXJhY3Rpb24pIHtcclxuICAgIHN1cGVyKGNsaWVudCwgZGF0YSk7XHJcbiAgICB0aGlzLmN1c3RvbUlkID0gZGF0YS5kYXRhPy5jdXN0b21faWQgfHwgJyc7XHJcbiAgICB0aGlzLm1lc3NhZ2UgPSBkYXRhLm1lc3NhZ2U7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBVcGRhdGUgdGhlIG1lc3NhZ2UgdGhlIGJ1dHRvbiBpcyBhdHRhY2hlZCB0b1xyXG4gICAqL1xyXG4gIGFzeW5jIHVwZGF0ZShvcHRpb25zOiBJbnRlcmFjdGlvblJlcGx5T3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5jcmVhdGVJbnRlcmFjdGlvblJlc3BvbnNlKHRoaXMuaWQsIHRoaXMudG9rZW4sIHtcclxuICAgICAgdHlwZTogSW50ZXJhY3Rpb25SZXNwb25zZVR5cGUuVXBkYXRlTWVzc2FnZSxcclxuICAgICAgZGF0YToge1xyXG4gICAgICAgIGNvbnRlbnQ6IG9wdGlvbnMuY29udGVudCxcclxuICAgICAgICBlbWJlZHM6IG9wdGlvbnMuZW1iZWRzLFxyXG4gICAgICAgIGNvbXBvbmVudHM6IG9wdGlvbnMuY29tcG9uZW50c1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICAgIHRoaXMucmVwbGllZCA9IHRydWU7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogU2VsZWN0IG1lbnUgaW50ZXJhY3Rpb25cclxuICovXHJcbmV4cG9ydCBjbGFzcyBTZWxlY3RNZW51SW50ZXJhY3Rpb24gZXh0ZW5kcyBJbnRlcmFjdGlvbiB7XHJcbiAgLyoqIFNlbGVjdCBtZW51IGN1c3RvbSBJRCAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBjdXN0b21JZDogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBDb21wb25lbnQgdHlwZSAoYWx3YXlzIDMgZm9yIHNlbGVjdCBtZW51cykgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgY29tcG9uZW50VHlwZTogbnVtYmVyID0gMztcclxuICBcclxuICAvKiogU2VsZWN0ZWQgdmFsdWVzICovXHJcbiAgcHVibGljIHJlYWRvbmx5IHZhbHVlczogc3RyaW5nW107XHJcbiAgXHJcbiAgLyoqIE1lc3NhZ2UgdGhlIHNlbGVjdCBtZW51IGlzIGF0dGFjaGVkIHRvICovXHJcbiAgcHVibGljIHJlYWRvbmx5IG1lc3NhZ2U/OiBhbnk7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGNsaWVudDogQ2xpZW50LCBkYXRhOiBBUElJbnRlcmFjdGlvbikge1xyXG4gICAgc3VwZXIoY2xpZW50LCBkYXRhKTtcclxuICAgIHRoaXMuY3VzdG9tSWQgPSBkYXRhLmRhdGE/LmN1c3RvbV9pZCB8fCAnJztcclxuICAgIHRoaXMudmFsdWVzID0gZGF0YS5kYXRhPy52YWx1ZXMgfHwgW107XHJcbiAgICB0aGlzLm1lc3NhZ2UgPSBkYXRhLm1lc3NhZ2U7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBVcGRhdGUgdGhlIG1lc3NhZ2UgdGhlIHNlbGVjdCBtZW51IGlzIGF0dGFjaGVkIHRvXHJcbiAgICovXHJcbiAgYXN5bmMgdXBkYXRlKG9wdGlvbnM6IEludGVyYWN0aW9uUmVwbHlPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LmNyZWF0ZUludGVyYWN0aW9uUmVzcG9uc2UodGhpcy5pZCwgdGhpcy50b2tlbiwge1xyXG4gICAgICB0eXBlOiBJbnRlcmFjdGlvblJlc3BvbnNlVHlwZS5VcGRhdGVNZXNzYWdlLFxyXG4gICAgICBkYXRhOiB7XHJcbiAgICAgICAgY29udGVudDogb3B0aW9ucy5jb250ZW50LFxyXG4gICAgICAgIGVtYmVkczogb3B0aW9ucy5lbWJlZHMsXHJcbiAgICAgICAgY29tcG9uZW50czogb3B0aW9ucy5jb21wb25lbnRzXHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgdGhpcy5yZXBsaWVkID0gdHJ1ZTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBNb2RhbCBzdWJtaXQgaW50ZXJhY3Rpb25cclxuICovXHJcbmV4cG9ydCBjbGFzcyBNb2RhbFN1Ym1pdEludGVyYWN0aW9uIGV4dGVuZHMgSW50ZXJhY3Rpb24ge1xyXG4gIC8qKiBNb2RhbCBjdXN0b20gSUQgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgY3VzdG9tSWQ6IHN0cmluZztcclxuICBcclxuICAvKiogTW9kYWwgZmllbGRzICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGZpZWxkczogTW9kYWxGaWVsZHM7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGNsaWVudDogQ2xpZW50LCBkYXRhOiBBUElJbnRlcmFjdGlvbikge1xyXG4gICAgc3VwZXIoY2xpZW50LCBkYXRhKTtcclxuICAgIHRoaXMuY3VzdG9tSWQgPSBkYXRhLmRhdGE/LmN1c3RvbV9pZCB8fCAnJztcclxuICAgIHRoaXMuZmllbGRzID0gbmV3IE1vZGFsRmllbGRzKGRhdGEuZGF0YT8udmFsdWVzIHx8IFtdKTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBNb2RhbCBmaWVsZHMgaGVscGVyXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgTW9kYWxGaWVsZHMge1xyXG4gIHByaXZhdGUgdmFsdWVzOiBzdHJpbmdbXTtcclxuXHJcbiAgY29uc3RydWN0b3IodmFsdWVzOiBzdHJpbmdbXSkge1xyXG4gICAgdGhpcy52YWx1ZXMgPSB2YWx1ZXM7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSB0ZXh0IGlucHV0IHZhbHVlXHJcbiAgICovXHJcbiAgZ2V0VGV4dElucHV0VmFsdWUoY3VzdG9tSWQ6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xyXG4gICAgLy8gTW9kYWwgdmFsdWVzIGFyZSB0eXBpY2FsbHkgcGFyc2VkIGZyb20gY29tcG9uZW50c1xyXG4gICAgLy8gVGhpcyBpcyBhIHNpbXBsaWZpZWQgaW1wbGVtZW50YXRpb25cclxuICAgIHJldHVybiBudWxsO1xyXG4gIH1cclxufVxyXG5cclxuLy8gVHlwZXNcclxuZXhwb3J0IGludGVyZmFjZSBJbnRlcmFjdGlvblJlcGx5T3B0aW9ucyB7XHJcbiAgY29udGVudD86IHN0cmluZztcclxuICBlbWJlZHM/OiBBUElFbWJlZFtdO1xyXG4gIGNvbXBvbmVudHM/OiBhbnlbXTtcclxuICBlcGhlbWVyYWw/OiBib29sZWFuO1xyXG4gIGZpbGVzPzogQXJyYXk8eyBuYW1lOiBzdHJpbmc7IGRhdGE6IEJ1ZmZlcjsgY29udGVudFR5cGU/OiBzdHJpbmcgfT47XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgQXV0b2NvbXBsZXRlQ2hvaWNlIHtcclxuICBuYW1lOiBzdHJpbmc7XHJcbiAgdmFsdWU6IHN0cmluZyB8IG51bWJlcjtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBNb2RhbERhdGEge1xyXG4gIGN1c3RvbV9pZDogc3RyaW5nO1xyXG4gIHRpdGxlOiBzdHJpbmc7XHJcbiAgY29tcG9uZW50czogYW55W107XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDcmVhdGUgYXBwcm9wcmlhdGUgaW50ZXJhY3Rpb24gY2xhc3MgYmFzZWQgb24gdHlwZVxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUludGVyYWN0aW9uKGNsaWVudDogQ2xpZW50LCBkYXRhOiBBUElJbnRlcmFjdGlvbik6IEludGVyYWN0aW9uIHtcclxuICBzd2l0Y2ggKGRhdGEudHlwZSkge1xyXG4gICAgY2FzZSBJbnRlcmFjdGlvblR5cGUuQXBwbGljYXRpb25Db21tYW5kOlxyXG4gICAgICByZXR1cm4gbmV3IENvbW1hbmRJbnRlcmFjdGlvbihjbGllbnQsIGRhdGEpO1xyXG4gICAgY2FzZSBJbnRlcmFjdGlvblR5cGUuQXBwbGljYXRpb25Db21tYW5kQXV0b2NvbXBsZXRlOlxyXG4gICAgICByZXR1cm4gbmV3IEF1dG9jb21wbGV0ZUludGVyYWN0aW9uKGNsaWVudCwgZGF0YSk7XHJcbiAgICBjYXNlIEludGVyYWN0aW9uVHlwZS5Nb2RhbFN1Ym1pdDpcclxuICAgICAgcmV0dXJuIG5ldyBNb2RhbFN1Ym1pdEludGVyYWN0aW9uKGNsaWVudCwgZGF0YSk7XHJcbiAgICBjYXNlIEludGVyYWN0aW9uVHlwZS5NZXNzYWdlQ29tcG9uZW50OlxyXG4gICAgICAvLyBjb21wb25lbnRfdHlwZTogMiA9IEJ1dHRvbiwgMyA9IFNlbGVjdCBNZW51XHJcbiAgICAgIGlmIChkYXRhLmRhdGE/LmNvbXBvbmVudF90eXBlID09PSAyKSB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBCdXR0b25JbnRlcmFjdGlvbihjbGllbnQsIGRhdGEpO1xyXG4gICAgICB9IGVsc2UgaWYgKGRhdGEuZGF0YT8uY29tcG9uZW50X3R5cGUgPT09IDMpIHtcclxuICAgICAgICByZXR1cm4gbmV3IFNlbGVjdE1lbnVJbnRlcmFjdGlvbihjbGllbnQsIGRhdGEpO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBuZXcgSW50ZXJhY3Rpb24oY2xpZW50LCBkYXRhKTtcclxuICAgIGRlZmF1bHQ6XHJcbiAgICAgIHJldHVybiBuZXcgSW50ZXJhY3Rpb24oY2xpZW50LCBkYXRhKTtcclxuICB9XHJcbn1cclxuIl19