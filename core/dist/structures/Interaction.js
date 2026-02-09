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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSW50ZXJhY3Rpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvc3RydWN0dXJlcy9JbnRlcmFjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFvZEEsOENBbUJDO0FBdGVELG9DQUFrRjtBQUNsRixpQ0FBOEI7QUFDOUIsK0NBQTRDO0FBQzVDLDJEQUF3RDtBQUd4RDs7R0FFRztBQUNILE1BQWEsV0FBVztJQUN0Qiw4QkFBOEI7SUFDZCxNQUFNLENBQVM7SUFFL0IscUJBQXFCO0lBQ0wsRUFBRSxDQUFTO0lBRTNCLHFCQUFxQjtJQUNMLGFBQWEsQ0FBUztJQUV0Qyx1QkFBdUI7SUFDUCxJQUFJLENBQWtCO0lBRXRDLGVBQWU7SUFDQyxPQUFPLENBQVU7SUFFakMsaUJBQWlCO0lBQ0QsU0FBUyxDQUFVO0lBRW5DLHdCQUF3QjtJQUNSLEtBQUssQ0FBUztJQUU5Qix5Q0FBeUM7SUFDekIsSUFBSSxDQUFPO0lBRTNCLG1DQUFtQztJQUNuQixNQUFNLENBQWU7SUFFckMsa0RBQWtEO0lBQzNDLE9BQU8sR0FBRyxLQUFLLENBQUM7SUFFdkIsZ0RBQWdEO0lBQ3pDLFFBQVEsR0FBRyxLQUFLLENBQUM7SUFFeEIsWUFBWSxNQUFjLEVBQUUsSUFBb0I7UUFDOUMsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7UUFDckIsb0NBQW9DO1FBQ3BDLElBQUksQ0FBQyxFQUFFLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUMxQixJQUFJLENBQUMsYUFBYSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDakQsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO1FBQ3RCLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1FBQ2pFLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1FBQ3ZFLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQztRQUV4Qix1REFBdUQ7UUFDdkQsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQztRQUNoRCxJQUFJLENBQUMsSUFBSSxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxXQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksV0FBSSxDQUFDLEVBQUUsRUFBRSxFQUFFLEdBQUcsRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQztRQUV2Riw0QkFBNEI7UUFDNUIsSUFBSSxJQUFJLENBQUMsTUFBTSxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNoQyxNQUFNLEtBQUssR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDOUMsSUFBSSxLQUFLLEVBQUUsQ0FBQztnQkFDVixJQUFJLENBQUMsTUFBTSxHQUFHLElBQUkseUJBQVcsQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUM1RCxDQUFDO1FBQ0gsQ0FBQztJQUNILENBQUM7SUFFRDs7T0FFRztJQUNILFNBQVM7UUFDUCxPQUFPLElBQUksQ0FBQyxJQUFJLEtBQUssdUJBQWUsQ0FBQyxrQkFBa0IsQ0FBQztJQUMxRCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxjQUFjO1FBQ1osT0FBTyxJQUFJLENBQUMsSUFBSSxLQUFLLHVCQUFlLENBQUMsOEJBQThCLENBQUM7SUFDdEUsQ0FBQztJQUVEOztPQUVHO0lBQ0gsYUFBYTtRQUNYLE9BQU8sSUFBSSxDQUFDLElBQUksS0FBSyx1QkFBZSxDQUFDLFdBQVcsQ0FBQztJQUNuRCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxRQUFRO1FBQ04sT0FBTyxJQUFJLENBQUMsSUFBSSxLQUFLLHVCQUFlLENBQUMsZ0JBQWdCLElBQUssSUFBWSxDQUFDLGFBQWEsS0FBSyxDQUFDLENBQUM7SUFDN0YsQ0FBQztJQUVEOztPQUVHO0lBQ0gsWUFBWTtRQUNWLE9BQU8sSUFBSSxDQUFDLElBQUksS0FBSyx1QkFBZSxDQUFDLGdCQUFnQixJQUFLLElBQVksQ0FBQyxhQUFhLEtBQUssQ0FBQyxDQUFDO0lBQzdGLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxLQUFLLENBQUMsT0FBeUM7UUFDbkQsSUFBSSxJQUFJLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUNsQyxNQUFNLElBQUksS0FBSyxDQUFDLHFEQUFxRCxDQUFDLENBQUM7UUFDekUsQ0FBQztRQUVELE1BQU0sT0FBTyxHQUFHLE9BQU8sT0FBTyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDO1FBQ3hFLE1BQU0sU0FBUyxHQUFHLE9BQU8sT0FBTyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDO1FBQzNFLE1BQU0sVUFBVSxHQUFHLE9BQU8sT0FBTyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDO1FBQ2hGLE1BQU0sU0FBUyxHQUFHLE9BQU8sT0FBTyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDO1FBRTFFLGtEQUFrRDtRQUNsRCxNQUFNLE1BQU0sR0FBRyxTQUFTLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxZQUFZLDJCQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFL0UsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxLQUFLLEVBQUU7WUFDcEUsSUFBSSxFQUFFLCtCQUF1QixDQUFDLHdCQUF3QjtZQUN0RCxJQUFJLEVBQUU7Z0JBQ0osT0FBTztnQkFDUCxNQUFNO2dCQUNOLFVBQVU7Z0JBQ1YsS0FBSyxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUMsb0JBQVksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7YUFDOUM7U0FDRixDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQztJQUN0QixDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsVUFBVSxDQUFDLE9BQWlDO1FBQ2hELElBQUksSUFBSSxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDbEMsTUFBTSxJQUFJLEtBQUssQ0FBQyxxREFBcUQsQ0FBQyxDQUFDO1FBQ3pFLENBQUM7UUFFRCxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLHlCQUF5QixDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRTtZQUNwRSxJQUFJLEVBQUUsK0JBQXVCLENBQUMsZ0NBQWdDO1lBQzlELElBQUksRUFBRSxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxvQkFBWSxDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsQ0FBQyxTQUFTO1NBQ3pFLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDO0lBQ3ZCLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxTQUFTLENBQUMsT0FBeUM7UUFDdkQsTUFBTSxPQUFPLEdBQUcsT0FBTyxPQUFPLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUM7UUFDeEUsTUFBTSxTQUFTLEdBQUcsT0FBTyxPQUFPLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUM7UUFDM0UsTUFBTSxVQUFVLEdBQUcsT0FBTyxPQUFPLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUM7UUFDaEYsTUFBTSxLQUFLLEdBQUcsT0FBTyxPQUFPLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUM7UUFFdEUsa0RBQWtEO1FBQ2xELE1BQU0sTUFBTSxHQUFHLFNBQVMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLFlBQVksMkJBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUUvRSxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLHVCQUF1QixDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUU7WUFDekQsT0FBTztZQUNQLE1BQU07WUFDTixVQUFVO1lBQ1YsS0FBSztTQUNOLEVBQUUsSUFBSSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUM1QyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxLQUFLLENBQUMsV0FBVztRQUNmLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMseUJBQXlCLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQy9ELENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxRQUFRLENBQUMsT0FBeUM7UUFDdEQsTUFBTSxPQUFPLEdBQUcsT0FBTyxPQUFPLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUM7UUFDeEUsTUFBTSxTQUFTLEdBQUcsT0FBTyxPQUFPLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUM7UUFDM0UsTUFBTSxTQUFTLEdBQUcsT0FBTyxPQUFPLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUM7UUFFMUUsa0RBQWtEO1FBQ2xELE1BQU0sTUFBTSxHQUFHLFNBQVMsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLFlBQVksMkJBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUUvRSxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFO1lBQ2hELE9BQU87WUFDUCxNQUFNO1lBQ04sS0FBSyxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUMsb0JBQVksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDOUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBckxELGtDQXFMQztBQUVEOztHQUVHO0FBQ0gsTUFBYSxrQkFBbUIsU0FBUSxXQUFXO0lBQ2pELG1CQUFtQjtJQUNILFdBQVcsQ0FBUztJQUVwQyxzQkFBc0I7SUFDTixPQUFPLENBQTRCO0lBRW5ELFlBQVksTUFBYyxFQUFFLElBQW9CO1FBQzlDLEtBQUssQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDcEIsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksSUFBSSxFQUFFLENBQUM7UUFDekMsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLHlCQUF5QixDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsT0FBTyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQ3pFLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxTQUFTLENBQUMsS0FBZ0I7UUFDOUIsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxLQUFLLEVBQUU7WUFDcEUsSUFBSSxFQUFFLCtCQUF1QixDQUFDLEtBQUs7WUFDbkMsSUFBSSxFQUFFLEtBQUs7U0FDWixDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUF0QkQsZ0RBc0JDO0FBRUQ7O0dBRUc7QUFDSCxNQUFhLHlCQUF5QjtJQUM1QixPQUFPLENBQXlCO0lBRXhDLFlBQVksT0FBK0I7UUFDekMsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7SUFDekIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsU0FBUyxDQUFDLElBQVksRUFBRSxRQUFrQjtRQUN4QyxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLENBQUM7UUFDdkQsSUFBSSxDQUFDLE1BQU0sSUFBSSxRQUFRO1lBQUUsTUFBTSxJQUFJLEtBQUssQ0FBQyxvQkFBb0IsSUFBSSxhQUFhLENBQUMsQ0FBQztRQUNoRixPQUFPLE1BQU0sRUFBRSxLQUFlLElBQUksSUFBSSxDQUFDO0lBQ3pDLENBQUM7SUFFRDs7T0FFRztJQUNILFVBQVUsQ0FBQyxJQUFZLEVBQUUsUUFBa0I7UUFDekMsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQyxDQUFDO1FBQ3ZELElBQUksQ0FBQyxNQUFNLElBQUksUUFBUTtZQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMsb0JBQW9CLElBQUksYUFBYSxDQUFDLENBQUM7UUFDaEYsT0FBTyxNQUFNLEVBQUUsS0FBZSxJQUFJLElBQUksQ0FBQztJQUN6QyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxTQUFTLENBQUMsSUFBWSxFQUFFLFFBQWtCO1FBQ3hDLE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFDekMsQ0FBQztJQUVEOztPQUVHO0lBQ0gsVUFBVSxDQUFDLElBQVksRUFBRSxRQUFrQjtRQUN6QyxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLENBQUM7UUFDdkQsSUFBSSxDQUFDLE1BQU0sSUFBSSxRQUFRO1lBQUUsTUFBTSxJQUFJLEtBQUssQ0FBQyxvQkFBb0IsSUFBSSxhQUFhLENBQUMsQ0FBQztRQUNoRixPQUFPLE1BQU0sRUFBRSxLQUFnQixJQUFJLElBQUksQ0FBQztJQUMxQyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxPQUFPLENBQUMsSUFBWSxFQUFFLFFBQWtCO1FBQ3RDLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsQ0FBQztRQUN2RCxJQUFJLENBQUMsTUFBTSxJQUFJLFFBQVE7WUFBRSxNQUFNLElBQUksS0FBSyxDQUFDLG9CQUFvQixJQUFJLGFBQWEsQ0FBQyxDQUFDO1FBQ2hGLE9BQU8sTUFBTSxFQUFFLEtBQWUsSUFBSSxJQUFJLENBQUM7SUFDekMsQ0FBQztJQUVEOztPQUVHO0lBQ0gsVUFBVSxDQUFDLElBQVksRUFBRSxRQUFrQjtRQUN6QyxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLENBQUM7UUFDdkQsSUFBSSxDQUFDLE1BQU0sSUFBSSxRQUFRO1lBQUUsTUFBTSxJQUFJLEtBQUssQ0FBQyxvQkFBb0IsSUFBSSxhQUFhLENBQUMsQ0FBQztRQUNoRixPQUFPLE1BQU0sRUFBRSxLQUFlLElBQUksSUFBSSxDQUFDO0lBQ3pDLENBQUM7SUFFRDs7T0FFRztJQUNILGFBQWEsQ0FBQyxRQUFrQjtRQUM5QixNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUM7UUFDcEQsSUFBSSxDQUFDLE1BQU0sSUFBSSxRQUFRO1lBQUUsTUFBTSxJQUFJLEtBQUssQ0FBQywrQkFBK0IsQ0FBQyxDQUFDO1FBQzFFLE9BQU8sTUFBTSxFQUFFLElBQUksSUFBSSxJQUFJLENBQUM7SUFDOUIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsVUFBVTtRQUNSLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ2pELElBQUksQ0FBQyxNQUFNO1lBQUUsT0FBTyxJQUFJLENBQUM7UUFDekIsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxNQUFNLENBQUMsS0FBZSxFQUFFLENBQUM7SUFDOUQsQ0FBQztDQUNGO0FBNUVELDhEQTRFQztBQUVEOztHQUVHO0FBQ0gsTUFBYSx1QkFBd0IsU0FBUSxXQUFXO0lBQ3RELG1CQUFtQjtJQUNILFdBQVcsQ0FBUztJQUVwQyxzQkFBc0I7SUFDTixPQUFPLENBQTRCO0lBRW5ELFlBQVksTUFBYyxFQUFFLElBQW9CO1FBQzlDLEtBQUssQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDcEIsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksSUFBSSxFQUFFLENBQUM7UUFDekMsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLHlCQUF5QixDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsT0FBTyxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQ3pFLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxPQUFPLENBQUMsT0FBNkI7UUFDekMsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxLQUFLLEVBQUU7WUFDcEUsSUFBSSxFQUFFLCtCQUF1QixDQUFDLG9DQUFvQztZQUNsRSxJQUFJLEVBQUUsRUFBRSxPQUFPLEVBQUU7U0FDbEIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBdEJELDBEQXNCQztBQUVEOztHQUVHO0FBQ0gsTUFBYSxpQkFBa0IsU0FBUSxXQUFXO0lBQ2hELHVCQUF1QjtJQUNQLFFBQVEsQ0FBUztJQUVqQyw0Q0FBNEM7SUFDNUIsYUFBYSxHQUFXLENBQUMsQ0FBQztJQUUxQyx3Q0FBd0M7SUFDeEIsT0FBTyxDQUFPO0lBRTlCLFlBQVksTUFBYyxFQUFFLElBQW9CO1FBQzlDLEtBQUssQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDcEIsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsSUFBSSxFQUFFLFNBQVMsSUFBSSxFQUFFLENBQUM7UUFDM0MsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDO0lBQzlCLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxNQUFNLENBQUMsT0FBZ0M7UUFDM0Msa0RBQWtEO1FBQ2xELE1BQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxNQUFNLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxZQUFZLDJCQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFcEYsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxLQUFLLEVBQUU7WUFDcEUsSUFBSSxFQUFFLCtCQUF1QixDQUFDLGFBQWE7WUFDM0MsSUFBSSxFQUFFO2dCQUNKLE9BQU8sRUFBRSxPQUFPLENBQUMsT0FBTztnQkFDeEIsTUFBTTtnQkFDTixVQUFVLEVBQUUsT0FBTyxDQUFDLFVBQVU7YUFDL0I7U0FDRixDQUFDLENBQUM7UUFDSCxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQztJQUN0QixDQUFDO0NBQ0Y7QUFqQ0QsOENBaUNDO0FBRUQ7O0dBRUc7QUFDSCxNQUFhLHFCQUFzQixTQUFRLFdBQVc7SUFDcEQsNEJBQTRCO0lBQ1osUUFBUSxDQUFTO0lBRWpDLGlEQUFpRDtJQUNqQyxhQUFhLEdBQVcsQ0FBQyxDQUFDO0lBRTFDLHNCQUFzQjtJQUNOLE1BQU0sQ0FBVztJQUVqQyw2Q0FBNkM7SUFDN0IsT0FBTyxDQUFPO0lBRTlCLFlBQVksTUFBYyxFQUFFLElBQW9CO1FBQzlDLEtBQUssQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDcEIsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsSUFBSSxFQUFFLFNBQVMsSUFBSSxFQUFFLENBQUM7UUFDM0MsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsSUFBSSxFQUFFLE1BQU0sSUFBSSxFQUFFLENBQUM7UUFDdEMsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDO0lBQzlCLENBQUM7SUFFRDs7T0FFRztJQUNILEtBQUssQ0FBQyxNQUFNLENBQUMsT0FBZ0M7UUFDM0Msa0RBQWtEO1FBQ2xELE1BQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxNQUFNLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxZQUFZLDJCQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFcEYsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxLQUFLLEVBQUU7WUFDcEUsSUFBSSxFQUFFLCtCQUF1QixDQUFDLGFBQWE7WUFDM0MsSUFBSSxFQUFFO2dCQUNKLE9BQU8sRUFBRSxPQUFPLENBQUMsT0FBTztnQkFDeEIsTUFBTTtnQkFDTixVQUFVLEVBQUUsT0FBTyxDQUFDLFVBQVU7YUFDL0I7U0FDRixDQUFDLENBQUM7UUFDSCxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQztJQUN0QixDQUFDO0NBQ0Y7QUFyQ0Qsc0RBcUNDO0FBRUQ7O0dBRUc7QUFDSCxNQUFhLHNCQUF1QixTQUFRLFdBQVc7SUFDckQsc0JBQXNCO0lBQ04sUUFBUSxDQUFTO0lBRWpDLG1CQUFtQjtJQUNILE1BQU0sQ0FBYztJQUVwQyxZQUFZLE1BQWMsRUFBRSxJQUFvQjtRQUM5QyxLQUFLLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ3BCLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLElBQUksRUFBRSxTQUFTLElBQUksRUFBRSxDQUFDO1FBQzNDLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxNQUFNLElBQUksRUFBRSxDQUFDLENBQUM7SUFDekQsQ0FBQztDQUNGO0FBWkQsd0RBWUM7QUFFRDs7R0FFRztBQUNILE1BQWEsV0FBVztJQUNkLE1BQU0sQ0FBVztJQUV6QixZQUFZLE1BQWdCO1FBQzFCLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO0lBQ3ZCLENBQUM7SUFFRDs7T0FFRztJQUNILGlCQUFpQixDQUFDLFFBQWdCO1FBQ2hDLG9EQUFvRDtRQUNwRCxzQ0FBc0M7UUFDdEMsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0NBQ0Y7QUFmRCxrQ0FlQztBQXNCRDs7R0FFRztBQUNILFNBQWdCLGlCQUFpQixDQUFDLE1BQWMsRUFBRSxJQUFvQjtJQUNwRSxRQUFRLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNsQixLQUFLLHVCQUFlLENBQUMsa0JBQWtCO1lBQ3JDLE9BQU8sSUFBSSxrQkFBa0IsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDOUMsS0FBSyx1QkFBZSxDQUFDLDhCQUE4QjtZQUNqRCxPQUFPLElBQUksdUJBQXVCLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ25ELEtBQUssdUJBQWUsQ0FBQyxXQUFXO1lBQzlCLE9BQU8sSUFBSSxzQkFBc0IsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDbEQsS0FBSyx1QkFBZSxDQUFDLGdCQUFnQjtZQUNuQyw4Q0FBOEM7WUFDOUMsSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFLGNBQWMsS0FBSyxDQUFDLEVBQUUsQ0FBQztnQkFDcEMsT0FBTyxJQUFJLGlCQUFpQixDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztZQUM3QyxDQUFDO2lCQUFNLElBQUksSUFBSSxDQUFDLElBQUksRUFBRSxjQUFjLEtBQUssQ0FBQyxFQUFFLENBQUM7Z0JBQzNDLE9BQU8sSUFBSSxxQkFBcUIsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDakQsQ0FBQztZQUNELE9BQU8sSUFBSSxXQUFXLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ3ZDO1lBQ0UsT0FBTyxJQUFJLFdBQVcsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDekMsQ0FBQztBQUNILENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBUElJbnRlcmFjdGlvbiwgQVBJSW50ZXJhY3Rpb25PcHRpb24sIEFQSUVtYmVkIH0gZnJvbSAnLi4vdHlwZXMnO1xyXG5pbXBvcnQgeyBJbnRlcmFjdGlvblR5cGUsIEludGVyYWN0aW9uUmVzcG9uc2VUeXBlLCBNZXNzYWdlRmxhZ3MgfSBmcm9tICcuLi9lbnVtcyc7XHJcbmltcG9ydCB7IFVzZXIgfSBmcm9tICcuL1VzZXInO1xyXG5pbXBvcnQgeyBHdWlsZE1lbWJlciB9IGZyb20gJy4vR3VpbGRNZW1iZXInO1xyXG5pbXBvcnQgeyBFbWJlZEJ1aWxkZXIgfSBmcm9tICcuLi9idWlsZGVycy9FbWJlZEJ1aWxkZXInO1xyXG5pbXBvcnQgdHlwZSB7IENsaWVudCB9IGZyb20gJy4uL0NsaWVudCc7XHJcblxyXG4vKipcclxuICogQmFzZSBpbnRlcmFjdGlvbiBjbGFzc1xyXG4gKi9cclxuZXhwb3J0IGNsYXNzIEludGVyYWN0aW9uIHtcclxuICAvKiogUmVmZXJlbmNlIHRvIHRoZSBjbGllbnQgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgY2xpZW50OiBDbGllbnQ7XHJcbiAgXHJcbiAgLyoqIEludGVyYWN0aW9uIElEICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGlkOiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIEFwcGxpY2F0aW9uIElEICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGFwcGxpY2F0aW9uSWQ6IHN0cmluZztcclxuICBcclxuICAvKiogSW50ZXJhY3Rpb24gdHlwZSAqL1xyXG4gIHB1YmxpYyByZWFkb25seSB0eXBlOiBJbnRlcmFjdGlvblR5cGU7XHJcbiAgXHJcbiAgLyoqIEd1aWxkIElEICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGd1aWxkSWQ/OiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIENoYW5uZWwgSUQgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgY2hhbm5lbElkPzogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBJbnRlcmFjdGlvbiB0b2tlbiAqL1xyXG4gIHB1YmxpYyByZWFkb25seSB0b2tlbjogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBVc2VyIHdobyB0cmlnZ2VyZWQgdGhlIGludGVyYWN0aW9uICovXHJcbiAgcHVibGljIHJlYWRvbmx5IHVzZXI6IFVzZXI7XHJcbiAgXHJcbiAgLyoqIEd1aWxkIG1lbWJlciAoaWYgaW4gYSBndWlsZCkgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgbWVtYmVyPzogR3VpbGRNZW1iZXI7XHJcbiAgXHJcbiAgLyoqIFdoZXRoZXIgdGhlIGludGVyYWN0aW9uIGhhcyBiZWVuIHJlcGxpZWQgdG8gKi9cclxuICBwdWJsaWMgcmVwbGllZCA9IGZhbHNlO1xyXG4gIFxyXG4gIC8qKiBXaGV0aGVyIHRoZSBpbnRlcmFjdGlvbiBoYXMgYmVlbiBkZWZlcnJlZCAqL1xyXG4gIHB1YmxpYyBkZWZlcnJlZCA9IGZhbHNlO1xyXG5cclxuICBjb25zdHJ1Y3RvcihjbGllbnQ6IENsaWVudCwgZGF0YTogQVBJSW50ZXJhY3Rpb24pIHtcclxuICAgIHRoaXMuY2xpZW50ID0gY2xpZW50O1xyXG4gICAgLy8gSGFuZGxlIGJvdGggc3RyaW5nIGFuZCBudW1iZXIgSURzXHJcbiAgICB0aGlzLmlkID0gU3RyaW5nKGRhdGEuaWQpO1xyXG4gICAgdGhpcy5hcHBsaWNhdGlvbklkID0gU3RyaW5nKGRhdGEuYXBwbGljYXRpb25faWQpO1xyXG4gICAgdGhpcy50eXBlID0gZGF0YS50eXBlO1xyXG4gICAgdGhpcy5ndWlsZElkID0gZGF0YS5ndWlsZF9pZCA/IFN0cmluZyhkYXRhLmd1aWxkX2lkKSA6IHVuZGVmaW5lZDtcclxuICAgIHRoaXMuY2hhbm5lbElkID0gZGF0YS5jaGFubmVsX2lkID8gU3RyaW5nKGRhdGEuY2hhbm5lbF9pZCkgOiB1bmRlZmluZWQ7XHJcbiAgICB0aGlzLnRva2VuID0gZGF0YS50b2tlbjtcclxuICAgIFxyXG4gICAgLy8gVXNlciBjYW4gY29tZSBmcm9tIG1lbWJlci51c2VyIG9yIGRpcmVjdGx5IGZyb20gdXNlclxyXG4gICAgY29uc3QgdXNlckRhdGEgPSBkYXRhLm1lbWJlcj8udXNlciB8fCBkYXRhLnVzZXI7XHJcbiAgICB0aGlzLnVzZXIgPSB1c2VyRGF0YSA/IG5ldyBVc2VyKHVzZXJEYXRhKSA6IG5ldyBVc2VyKHsgaWQ6ICcwJywgdXNlcm5hbWU6ICdVbmtub3duJyB9KTtcclxuICAgIFxyXG4gICAgLy8gQ3JlYXRlIG1lbWJlciBpZiBpbiBndWlsZFxyXG4gICAgaWYgKGRhdGEubWVtYmVyICYmIHRoaXMuZ3VpbGRJZCkge1xyXG4gICAgICBjb25zdCBndWlsZCA9IGNsaWVudC5ndWlsZHMuZ2V0KHRoaXMuZ3VpbGRJZCk7XHJcbiAgICAgIGlmIChndWlsZCkge1xyXG4gICAgICAgIHRoaXMubWVtYmVyID0gbmV3IEd1aWxkTWVtYmVyKGNsaWVudCwgZ3VpbGQsIGRhdGEubWVtYmVyKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2hlY2sgaWYgdGhpcyBpcyBhIGNvbW1hbmQgaW50ZXJhY3Rpb25cclxuICAgKi9cclxuICBpc0NvbW1hbmQoKTogdGhpcyBpcyBDb21tYW5kSW50ZXJhY3Rpb24ge1xyXG4gICAgcmV0dXJuIHRoaXMudHlwZSA9PT0gSW50ZXJhY3Rpb25UeXBlLkFwcGxpY2F0aW9uQ29tbWFuZDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENoZWNrIGlmIHRoaXMgaXMgYW4gYXV0b2NvbXBsZXRlIGludGVyYWN0aW9uXHJcbiAgICovXHJcbiAgaXNBdXRvY29tcGxldGUoKTogdGhpcyBpcyBBdXRvY29tcGxldGVJbnRlcmFjdGlvbiB7XHJcbiAgICByZXR1cm4gdGhpcy50eXBlID09PSBJbnRlcmFjdGlvblR5cGUuQXBwbGljYXRpb25Db21tYW5kQXV0b2NvbXBsZXRlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2hlY2sgaWYgdGhpcyBpcyBhIG1vZGFsIHN1Ym1pdCBpbnRlcmFjdGlvblxyXG4gICAqL1xyXG4gIGlzTW9kYWxTdWJtaXQoKTogdGhpcyBpcyBNb2RhbFN1Ym1pdEludGVyYWN0aW9uIHtcclxuICAgIHJldHVybiB0aGlzLnR5cGUgPT09IEludGVyYWN0aW9uVHlwZS5Nb2RhbFN1Ym1pdDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENoZWNrIGlmIHRoaXMgaXMgYSBidXR0b24gaW50ZXJhY3Rpb25cclxuICAgKi9cclxuICBpc0J1dHRvbigpOiB0aGlzIGlzIEJ1dHRvbkludGVyYWN0aW9uIHtcclxuICAgIHJldHVybiB0aGlzLnR5cGUgPT09IEludGVyYWN0aW9uVHlwZS5NZXNzYWdlQ29tcG9uZW50ICYmICh0aGlzIGFzIGFueSkuY29tcG9uZW50VHlwZSA9PT0gMjtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENoZWNrIGlmIHRoaXMgaXMgYSBzZWxlY3QgbWVudSBpbnRlcmFjdGlvblxyXG4gICAqL1xyXG4gIGlzU2VsZWN0TWVudSgpOiB0aGlzIGlzIFNlbGVjdE1lbnVJbnRlcmFjdGlvbiB7XHJcbiAgICByZXR1cm4gdGhpcy50eXBlID09PSBJbnRlcmFjdGlvblR5cGUuTWVzc2FnZUNvbXBvbmVudCAmJiAodGhpcyBhcyBhbnkpLmNvbXBvbmVudFR5cGUgPT09IDM7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZXBseSB0byB0aGUgaW50ZXJhY3Rpb25cclxuICAgKi9cclxuICBhc3luYyByZXBseShvcHRpb25zOiBzdHJpbmcgfCBJbnRlcmFjdGlvblJlcGx5T3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgaWYgKHRoaXMucmVwbGllZCB8fCB0aGlzLmRlZmVycmVkKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW50ZXJhY3Rpb24gaGFzIGFscmVhZHkgYmVlbiByZXBsaWVkIHRvIG9yIGRlZmVycmVkJyk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGNvbnN0IGNvbnRlbnQgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyBvcHRpb25zIDogb3B0aW9ucy5jb250ZW50O1xyXG4gICAgY29uc3QgcmF3RW1iZWRzID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gdW5kZWZpbmVkIDogb3B0aW9ucy5lbWJlZHM7XHJcbiAgICBjb25zdCBjb21wb25lbnRzID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gdW5kZWZpbmVkIDogb3B0aW9ucy5jb21wb25lbnRzO1xyXG4gICAgY29uc3QgZXBoZW1lcmFsID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gZmFsc2UgOiBvcHRpb25zLmVwaGVtZXJhbDtcclxuICAgIFxyXG4gICAgLy8gQ29udmVydCBFbWJlZEJ1aWxkZXIgaW5zdGFuY2VzIHRvIHBsYWluIG9iamVjdHNcclxuICAgIGNvbnN0IGVtYmVkcyA9IHJhd0VtYmVkcz8ubWFwKGUgPT4gZSBpbnN0YW5jZW9mIEVtYmVkQnVpbGRlciA/IGUudG9KU09OKCkgOiBlKTtcclxuICAgIFxyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5jcmVhdGVJbnRlcmFjdGlvblJlc3BvbnNlKHRoaXMuaWQsIHRoaXMudG9rZW4sIHtcclxuICAgICAgdHlwZTogSW50ZXJhY3Rpb25SZXNwb25zZVR5cGUuQ2hhbm5lbE1lc3NhZ2VXaXRoU291cmNlLFxyXG4gICAgICBkYXRhOiB7XHJcbiAgICAgICAgY29udGVudCxcclxuICAgICAgICBlbWJlZHMsXHJcbiAgICAgICAgY29tcG9uZW50cyxcclxuICAgICAgICBmbGFnczogZXBoZW1lcmFsID8gTWVzc2FnZUZsYWdzLkVwaGVtZXJhbCA6IDBcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIHRoaXMucmVwbGllZCA9IHRydWU7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZWZlciB0aGUgcmVwbHkgKHNob3dzIFwidGhpbmtpbmcuLi5cIilcclxuICAgKi9cclxuICBhc3luYyBkZWZlclJlcGx5KG9wdGlvbnM/OiB7IGVwaGVtZXJhbD86IGJvb2xlYW4gfSk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgaWYgKHRoaXMucmVwbGllZCB8fCB0aGlzLmRlZmVycmVkKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcignSW50ZXJhY3Rpb24gaGFzIGFscmVhZHkgYmVlbiByZXBsaWVkIHRvIG9yIGRlZmVycmVkJyk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGF3YWl0IHRoaXMuY2xpZW50LnJlc3QuY3JlYXRlSW50ZXJhY3Rpb25SZXNwb25zZSh0aGlzLmlkLCB0aGlzLnRva2VuLCB7XHJcbiAgICAgIHR5cGU6IEludGVyYWN0aW9uUmVzcG9uc2VUeXBlLkRlZmVycmVkQ2hhbm5lbE1lc3NhZ2VXaXRoU291cmNlLFxyXG4gICAgICBkYXRhOiBvcHRpb25zPy5lcGhlbWVyYWwgPyB7IGZsYWdzOiBNZXNzYWdlRmxhZ3MuRXBoZW1lcmFsIH0gOiB1bmRlZmluZWRcclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICB0aGlzLmRlZmVycmVkID0gdHJ1ZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEVkaXQgdGhlIHJlcGx5XHJcbiAgICovXHJcbiAgYXN5bmMgZWRpdFJlcGx5KG9wdGlvbnM6IHN0cmluZyB8IEludGVyYWN0aW9uUmVwbHlPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBjb250ZW50ID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gb3B0aW9ucyA6IG9wdGlvbnMuY29udGVudDtcclxuICAgIGNvbnN0IHJhd0VtYmVkcyA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IHVuZGVmaW5lZCA6IG9wdGlvbnMuZW1iZWRzO1xyXG4gICAgY29uc3QgY29tcG9uZW50cyA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IHVuZGVmaW5lZCA6IG9wdGlvbnMuY29tcG9uZW50cztcclxuICAgIGNvbnN0IGZpbGVzID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gdW5kZWZpbmVkIDogb3B0aW9ucy5maWxlcztcclxuICAgIFxyXG4gICAgLy8gQ29udmVydCBFbWJlZEJ1aWxkZXIgaW5zdGFuY2VzIHRvIHBsYWluIG9iamVjdHNcclxuICAgIGNvbnN0IGVtYmVkcyA9IHJhd0VtYmVkcz8ubWFwKGUgPT4gZSBpbnN0YW5jZW9mIEVtYmVkQnVpbGRlciA/IGUudG9KU09OKCkgOiBlKTtcclxuICAgIFxyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5lZGl0SW50ZXJhY3Rpb25SZXNwb25zZSh0aGlzLnRva2VuLCB7XHJcbiAgICAgIGNvbnRlbnQsXHJcbiAgICAgIGVtYmVkcyxcclxuICAgICAgY29tcG9uZW50cyxcclxuICAgICAgZmlsZXNcclxuICAgIH0sIHRoaXMuZ3VpbGRJZCwgdGhpcy5jaGFubmVsSWQsIHRoaXMuaWQpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVsZXRlIHRoZSByZXBseVxyXG4gICAqL1xyXG4gIGFzeW5jIGRlbGV0ZVJlcGx5KCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5kZWxldGVJbnRlcmFjdGlvblJlc3BvbnNlKHRoaXMudG9rZW4pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2VuZCBhIGZvbGxvd3VwIG1lc3NhZ2VcclxuICAgKi9cclxuICBhc3luYyBmb2xsb3dVcChvcHRpb25zOiBzdHJpbmcgfCBJbnRlcmFjdGlvblJlcGx5T3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgY29udGVudCA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IG9wdGlvbnMgOiBvcHRpb25zLmNvbnRlbnQ7XHJcbiAgICBjb25zdCByYXdFbWJlZHMgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyB1bmRlZmluZWQgOiBvcHRpb25zLmVtYmVkcztcclxuICAgIGNvbnN0IGVwaGVtZXJhbCA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IGZhbHNlIDogb3B0aW9ucy5lcGhlbWVyYWw7XHJcbiAgICBcclxuICAgIC8vIENvbnZlcnQgRW1iZWRCdWlsZGVyIGluc3RhbmNlcyB0byBwbGFpbiBvYmplY3RzXHJcbiAgICBjb25zdCBlbWJlZHMgPSByYXdFbWJlZHM/Lm1hcChlID0+IGUgaW5zdGFuY2VvZiBFbWJlZEJ1aWxkZXIgPyBlLnRvSlNPTigpIDogZSk7XHJcbiAgICBcclxuICAgIGF3YWl0IHRoaXMuY2xpZW50LnJlc3QuY3JlYXRlRm9sbG93dXAodGhpcy50b2tlbiwge1xyXG4gICAgICBjb250ZW50LFxyXG4gICAgICBlbWJlZHMsXHJcbiAgICAgIGZsYWdzOiBlcGhlbWVyYWwgPyBNZXNzYWdlRmxhZ3MuRXBoZW1lcmFsIDogMFxyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogQ29tbWFuZCBpbnRlcmFjdGlvblxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIENvbW1hbmRJbnRlcmFjdGlvbiBleHRlbmRzIEludGVyYWN0aW9uIHtcclxuICAvKiogQ29tbWFuZCBuYW1lICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGNvbW1hbmROYW1lOiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIENvbW1hbmQgb3B0aW9ucyAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBvcHRpb25zOiBDb21tYW5kSW50ZXJhY3Rpb25PcHRpb25zO1xyXG5cclxuICBjb25zdHJ1Y3RvcihjbGllbnQ6IENsaWVudCwgZGF0YTogQVBJSW50ZXJhY3Rpb24pIHtcclxuICAgIHN1cGVyKGNsaWVudCwgZGF0YSk7XHJcbiAgICB0aGlzLmNvbW1hbmROYW1lID0gZGF0YS5kYXRhPy5uYW1lIHx8ICcnO1xyXG4gICAgdGhpcy5vcHRpb25zID0gbmV3IENvbW1hbmRJbnRlcmFjdGlvbk9wdGlvbnMoZGF0YS5kYXRhPy5vcHRpb25zIHx8IFtdKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNob3cgYSBtb2RhbFxyXG4gICAqL1xyXG4gIGFzeW5jIHNob3dNb2RhbChtb2RhbDogTW9kYWxEYXRhKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBhd2FpdCB0aGlzLmNsaWVudC5yZXN0LmNyZWF0ZUludGVyYWN0aW9uUmVzcG9uc2UodGhpcy5pZCwgdGhpcy50b2tlbiwge1xyXG4gICAgICB0eXBlOiBJbnRlcmFjdGlvblJlc3BvbnNlVHlwZS5Nb2RhbCxcclxuICAgICAgZGF0YTogbW9kYWxcclxuICAgIH0pO1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIENvbW1hbmQgaW50ZXJhY3Rpb24gb3B0aW9ucyBoZWxwZXJcclxuICovXHJcbmV4cG9ydCBjbGFzcyBDb21tYW5kSW50ZXJhY3Rpb25PcHRpb25zIHtcclxuICBwcml2YXRlIG9wdGlvbnM6IEFQSUludGVyYWN0aW9uT3B0aW9uW107XHJcblxyXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnM6IEFQSUludGVyYWN0aW9uT3B0aW9uW10pIHtcclxuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSBzdHJpbmcgb3B0aW9uXHJcbiAgICovXHJcbiAgZ2V0U3RyaW5nKG5hbWU6IHN0cmluZywgcmVxdWlyZWQ/OiBib29sZWFuKTogc3RyaW5nIHwgbnVsbCB7XHJcbiAgICBjb25zdCBvcHRpb24gPSB0aGlzLm9wdGlvbnMuZmluZChvID0+IG8ubmFtZSA9PT0gbmFtZSk7XHJcbiAgICBpZiAoIW9wdGlvbiAmJiByZXF1aXJlZCkgdGhyb3cgbmV3IEVycm9yKGBSZXF1aXJlZCBvcHRpb24gXCIke25hbWV9XCIgbm90IGZvdW5kYCk7XHJcbiAgICByZXR1cm4gb3B0aW9uPy52YWx1ZSBhcyBzdHJpbmcgfHwgbnVsbDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhbiBpbnRlZ2VyIG9wdGlvblxyXG4gICAqL1xyXG4gIGdldEludGVnZXIobmFtZTogc3RyaW5nLCByZXF1aXJlZD86IGJvb2xlYW4pOiBudW1iZXIgfCBudWxsIHtcclxuICAgIGNvbnN0IG9wdGlvbiA9IHRoaXMub3B0aW9ucy5maW5kKG8gPT4gby5uYW1lID09PSBuYW1lKTtcclxuICAgIGlmICghb3B0aW9uICYmIHJlcXVpcmVkKSB0aHJvdyBuZXcgRXJyb3IoYFJlcXVpcmVkIG9wdGlvbiBcIiR7bmFtZX1cIiBub3QgZm91bmRgKTtcclxuICAgIHJldHVybiBvcHRpb24/LnZhbHVlIGFzIG51bWJlciB8fCBudWxsO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGEgbnVtYmVyIG9wdGlvblxyXG4gICAqL1xyXG4gIGdldE51bWJlcihuYW1lOiBzdHJpbmcsIHJlcXVpcmVkPzogYm9vbGVhbik6IG51bWJlciB8IG51bGwge1xyXG4gICAgcmV0dXJuIHRoaXMuZ2V0SW50ZWdlcihuYW1lLCByZXF1aXJlZCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSBib29sZWFuIG9wdGlvblxyXG4gICAqL1xyXG4gIGdldEJvb2xlYW4obmFtZTogc3RyaW5nLCByZXF1aXJlZD86IGJvb2xlYW4pOiBib29sZWFuIHwgbnVsbCB7XHJcbiAgICBjb25zdCBvcHRpb24gPSB0aGlzLm9wdGlvbnMuZmluZChvID0+IG8ubmFtZSA9PT0gbmFtZSk7XHJcbiAgICBpZiAoIW9wdGlvbiAmJiByZXF1aXJlZCkgdGhyb3cgbmV3IEVycm9yKGBSZXF1aXJlZCBvcHRpb24gXCIke25hbWV9XCIgbm90IGZvdW5kYCk7XHJcbiAgICByZXR1cm4gb3B0aW9uPy52YWx1ZSBhcyBib29sZWFuID8/IG51bGw7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSB1c2VyIG9wdGlvblxyXG4gICAqL1xyXG4gIGdldFVzZXIobmFtZTogc3RyaW5nLCByZXF1aXJlZD86IGJvb2xlYW4pOiBzdHJpbmcgfCBudWxsIHtcclxuICAgIGNvbnN0IG9wdGlvbiA9IHRoaXMub3B0aW9ucy5maW5kKG8gPT4gby5uYW1lID09PSBuYW1lKTtcclxuICAgIGlmICghb3B0aW9uICYmIHJlcXVpcmVkKSB0aHJvdyBuZXcgRXJyb3IoYFJlcXVpcmVkIG9wdGlvbiBcIiR7bmFtZX1cIiBub3QgZm91bmRgKTtcclxuICAgIHJldHVybiBvcHRpb24/LnZhbHVlIGFzIHN0cmluZyB8fCBudWxsO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGEgY2hhbm5lbCBvcHRpb25cclxuICAgKi9cclxuICBnZXRDaGFubmVsKG5hbWU6IHN0cmluZywgcmVxdWlyZWQ/OiBib29sZWFuKTogc3RyaW5nIHwgbnVsbCB7XHJcbiAgICBjb25zdCBvcHRpb24gPSB0aGlzLm9wdGlvbnMuZmluZChvID0+IG8ubmFtZSA9PT0gbmFtZSk7XHJcbiAgICBpZiAoIW9wdGlvbiAmJiByZXF1aXJlZCkgdGhyb3cgbmV3IEVycm9yKGBSZXF1aXJlZCBvcHRpb24gXCIke25hbWV9XCIgbm90IGZvdW5kYCk7XHJcbiAgICByZXR1cm4gb3B0aW9uPy52YWx1ZSBhcyBzdHJpbmcgfHwgbnVsbDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBhIHN1YmNvbW1hbmQgbmFtZVxyXG4gICAqL1xyXG4gIGdldFN1YmNvbW1hbmQocmVxdWlyZWQ/OiBib29sZWFuKTogc3RyaW5nIHwgbnVsbCB7XHJcbiAgICBjb25zdCBvcHRpb24gPSB0aGlzLm9wdGlvbnMuZmluZChvID0+IG8udHlwZSA9PT0gMSk7XHJcbiAgICBpZiAoIW9wdGlvbiAmJiByZXF1aXJlZCkgdGhyb3cgbmV3IEVycm9yKCdSZXF1aXJlZCBzdWJjb21tYW5kIG5vdCBmb3VuZCcpO1xyXG4gICAgcmV0dXJuIG9wdGlvbj8ubmFtZSB8fCBudWxsO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IHRoZSBmb2N1c2VkIG9wdGlvbiAoZm9yIGF1dG9jb21wbGV0ZSlcclxuICAgKi9cclxuICBnZXRGb2N1c2VkKCk6IHsgbmFtZTogc3RyaW5nOyB2YWx1ZTogc3RyaW5nIH0gfCBudWxsIHtcclxuICAgIGNvbnN0IG9wdGlvbiA9IHRoaXMub3B0aW9ucy5maW5kKG8gPT4gby5mb2N1c2VkKTtcclxuICAgIGlmICghb3B0aW9uKSByZXR1cm4gbnVsbDtcclxuICAgIHJldHVybiB7IG5hbWU6IG9wdGlvbi5uYW1lLCB2YWx1ZTogb3B0aW9uLnZhbHVlIGFzIHN0cmluZyB9O1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIEF1dG9jb21wbGV0ZSBpbnRlcmFjdGlvblxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIEF1dG9jb21wbGV0ZUludGVyYWN0aW9uIGV4dGVuZHMgSW50ZXJhY3Rpb24ge1xyXG4gIC8qKiBDb21tYW5kIG5hbWUgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgY29tbWFuZE5hbWU6IHN0cmluZztcclxuICBcclxuICAvKiogQ29tbWFuZCBvcHRpb25zICovXHJcbiAgcHVibGljIHJlYWRvbmx5IG9wdGlvbnM6IENvbW1hbmRJbnRlcmFjdGlvbk9wdGlvbnM7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGNsaWVudDogQ2xpZW50LCBkYXRhOiBBUElJbnRlcmFjdGlvbikge1xyXG4gICAgc3VwZXIoY2xpZW50LCBkYXRhKTtcclxuICAgIHRoaXMuY29tbWFuZE5hbWUgPSBkYXRhLmRhdGE/Lm5hbWUgfHwgJyc7XHJcbiAgICB0aGlzLm9wdGlvbnMgPSBuZXcgQ29tbWFuZEludGVyYWN0aW9uT3B0aW9ucyhkYXRhLmRhdGE/Lm9wdGlvbnMgfHwgW10pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVzcG9uZCB3aXRoIGF1dG9jb21wbGV0ZSBjaG9pY2VzXHJcbiAgICovXHJcbiAgYXN5bmMgcmVzcG9uZChjaG9pY2VzOiBBdXRvY29tcGxldGVDaG9pY2VbXSk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5jcmVhdGVJbnRlcmFjdGlvblJlc3BvbnNlKHRoaXMuaWQsIHRoaXMudG9rZW4sIHtcclxuICAgICAgdHlwZTogSW50ZXJhY3Rpb25SZXNwb25zZVR5cGUuQXBwbGljYXRpb25Db21tYW5kQXV0b2NvbXBsZXRlUmVzdWx0LFxyXG4gICAgICBkYXRhOiB7IGNob2ljZXMgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogQnV0dG9uIGludGVyYWN0aW9uXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgQnV0dG9uSW50ZXJhY3Rpb24gZXh0ZW5kcyBJbnRlcmFjdGlvbiB7XHJcbiAgLyoqIEJ1dHRvbiBjdXN0b20gSUQgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgY3VzdG9tSWQ6IHN0cmluZztcclxuICBcclxuICAvKiogQ29tcG9uZW50IHR5cGUgKGFsd2F5cyAyIGZvciBidXR0b25zKSAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBjb21wb25lbnRUeXBlOiBudW1iZXIgPSAyO1xyXG4gIFxyXG4gIC8qKiBNZXNzYWdlIHRoZSBidXR0b24gaXMgYXR0YWNoZWQgdG8gKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgbWVzc2FnZT86IGFueTtcclxuXHJcbiAgY29uc3RydWN0b3IoY2xpZW50OiBDbGllbnQsIGRhdGE6IEFQSUludGVyYWN0aW9uKSB7XHJcbiAgICBzdXBlcihjbGllbnQsIGRhdGEpO1xyXG4gICAgdGhpcy5jdXN0b21JZCA9IGRhdGEuZGF0YT8uY3VzdG9tX2lkIHx8ICcnO1xyXG4gICAgdGhpcy5tZXNzYWdlID0gZGF0YS5tZXNzYWdlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVXBkYXRlIHRoZSBtZXNzYWdlIHRoZSBidXR0b24gaXMgYXR0YWNoZWQgdG9cclxuICAgKi9cclxuICBhc3luYyB1cGRhdGUob3B0aW9uczogSW50ZXJhY3Rpb25SZXBseU9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIC8vIENvbnZlcnQgRW1iZWRCdWlsZGVyIGluc3RhbmNlcyB0byBwbGFpbiBvYmplY3RzXHJcbiAgICBjb25zdCBlbWJlZHMgPSBvcHRpb25zLmVtYmVkcz8ubWFwKGUgPT4gZSBpbnN0YW5jZW9mIEVtYmVkQnVpbGRlciA/IGUudG9KU09OKCkgOiBlKTtcclxuICAgIFxyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5jcmVhdGVJbnRlcmFjdGlvblJlc3BvbnNlKHRoaXMuaWQsIHRoaXMudG9rZW4sIHtcclxuICAgICAgdHlwZTogSW50ZXJhY3Rpb25SZXNwb25zZVR5cGUuVXBkYXRlTWVzc2FnZSxcclxuICAgICAgZGF0YToge1xyXG4gICAgICAgIGNvbnRlbnQ6IG9wdGlvbnMuY29udGVudCxcclxuICAgICAgICBlbWJlZHMsXHJcbiAgICAgICAgY29tcG9uZW50czogb3B0aW9ucy5jb21wb25lbnRzXHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgdGhpcy5yZXBsaWVkID0gdHJ1ZTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTZWxlY3QgbWVudSBpbnRlcmFjdGlvblxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFNlbGVjdE1lbnVJbnRlcmFjdGlvbiBleHRlbmRzIEludGVyYWN0aW9uIHtcclxuICAvKiogU2VsZWN0IG1lbnUgY3VzdG9tIElEICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGN1c3RvbUlkOiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIENvbXBvbmVudCB0eXBlIChhbHdheXMgMyBmb3Igc2VsZWN0IG1lbnVzKSAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBjb21wb25lbnRUeXBlOiBudW1iZXIgPSAzO1xyXG4gIFxyXG4gIC8qKiBTZWxlY3RlZCB2YWx1ZXMgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgdmFsdWVzOiBzdHJpbmdbXTtcclxuICBcclxuICAvKiogTWVzc2FnZSB0aGUgc2VsZWN0IG1lbnUgaXMgYXR0YWNoZWQgdG8gKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgbWVzc2FnZT86IGFueTtcclxuXHJcbiAgY29uc3RydWN0b3IoY2xpZW50OiBDbGllbnQsIGRhdGE6IEFQSUludGVyYWN0aW9uKSB7XHJcbiAgICBzdXBlcihjbGllbnQsIGRhdGEpO1xyXG4gICAgdGhpcy5jdXN0b21JZCA9IGRhdGEuZGF0YT8uY3VzdG9tX2lkIHx8ICcnO1xyXG4gICAgdGhpcy52YWx1ZXMgPSBkYXRhLmRhdGE/LnZhbHVlcyB8fCBbXTtcclxuICAgIHRoaXMubWVzc2FnZSA9IGRhdGEubWVzc2FnZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFVwZGF0ZSB0aGUgbWVzc2FnZSB0aGUgc2VsZWN0IG1lbnUgaXMgYXR0YWNoZWQgdG9cclxuICAgKi9cclxuICBhc3luYyB1cGRhdGUob3B0aW9uczogSW50ZXJhY3Rpb25SZXBseU9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIC8vIENvbnZlcnQgRW1iZWRCdWlsZGVyIGluc3RhbmNlcyB0byBwbGFpbiBvYmplY3RzXHJcbiAgICBjb25zdCBlbWJlZHMgPSBvcHRpb25zLmVtYmVkcz8ubWFwKGUgPT4gZSBpbnN0YW5jZW9mIEVtYmVkQnVpbGRlciA/IGUudG9KU09OKCkgOiBlKTtcclxuICAgIFxyXG4gICAgYXdhaXQgdGhpcy5jbGllbnQucmVzdC5jcmVhdGVJbnRlcmFjdGlvblJlc3BvbnNlKHRoaXMuaWQsIHRoaXMudG9rZW4sIHtcclxuICAgICAgdHlwZTogSW50ZXJhY3Rpb25SZXNwb25zZVR5cGUuVXBkYXRlTWVzc2FnZSxcclxuICAgICAgZGF0YToge1xyXG4gICAgICAgIGNvbnRlbnQ6IG9wdGlvbnMuY29udGVudCxcclxuICAgICAgICBlbWJlZHMsXHJcbiAgICAgICAgY29tcG9uZW50czogb3B0aW9ucy5jb21wb25lbnRzXHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgdGhpcy5yZXBsaWVkID0gdHJ1ZTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBNb2RhbCBzdWJtaXQgaW50ZXJhY3Rpb25cclxuICovXHJcbmV4cG9ydCBjbGFzcyBNb2RhbFN1Ym1pdEludGVyYWN0aW9uIGV4dGVuZHMgSW50ZXJhY3Rpb24ge1xyXG4gIC8qKiBNb2RhbCBjdXN0b20gSUQgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgY3VzdG9tSWQ6IHN0cmluZztcclxuICBcclxuICAvKiogTW9kYWwgZmllbGRzICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGZpZWxkczogTW9kYWxGaWVsZHM7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGNsaWVudDogQ2xpZW50LCBkYXRhOiBBUElJbnRlcmFjdGlvbikge1xyXG4gICAgc3VwZXIoY2xpZW50LCBkYXRhKTtcclxuICAgIHRoaXMuY3VzdG9tSWQgPSBkYXRhLmRhdGE/LmN1c3RvbV9pZCB8fCAnJztcclxuICAgIHRoaXMuZmllbGRzID0gbmV3IE1vZGFsRmllbGRzKGRhdGEuZGF0YT8udmFsdWVzIHx8IFtdKTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBNb2RhbCBmaWVsZHMgaGVscGVyXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgTW9kYWxGaWVsZHMge1xyXG4gIHByaXZhdGUgdmFsdWVzOiBzdHJpbmdbXTtcclxuXHJcbiAgY29uc3RydWN0b3IodmFsdWVzOiBzdHJpbmdbXSkge1xyXG4gICAgdGhpcy52YWx1ZXMgPSB2YWx1ZXM7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSB0ZXh0IGlucHV0IHZhbHVlXHJcbiAgICovXHJcbiAgZ2V0VGV4dElucHV0VmFsdWUoY3VzdG9tSWQ6IHN0cmluZyk6IHN0cmluZyB8IG51bGwge1xyXG4gICAgLy8gTW9kYWwgdmFsdWVzIGFyZSB0eXBpY2FsbHkgcGFyc2VkIGZyb20gY29tcG9uZW50c1xyXG4gICAgLy8gVGhpcyBpcyBhIHNpbXBsaWZpZWQgaW1wbGVtZW50YXRpb25cclxuICAgIHJldHVybiBudWxsO1xyXG4gIH1cclxufVxyXG5cclxuLy8gVHlwZXNcclxuZXhwb3J0IGludGVyZmFjZSBJbnRlcmFjdGlvblJlcGx5T3B0aW9ucyB7XHJcbiAgY29udGVudD86IHN0cmluZztcclxuICBlbWJlZHM/OiAoQVBJRW1iZWQgfCBFbWJlZEJ1aWxkZXIpW107XHJcbiAgY29tcG9uZW50cz86IGFueVtdO1xyXG4gIGVwaGVtZXJhbD86IGJvb2xlYW47XHJcbiAgZmlsZXM/OiBBcnJheTx7IG5hbWU6IHN0cmluZzsgZGF0YTogQnVmZmVyOyBjb250ZW50VHlwZT86IHN0cmluZyB9PjtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBBdXRvY29tcGxldGVDaG9pY2Uge1xyXG4gIG5hbWU6IHN0cmluZztcclxuICB2YWx1ZTogc3RyaW5nIHwgbnVtYmVyO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIE1vZGFsRGF0YSB7XHJcbiAgY3VzdG9tX2lkOiBzdHJpbmc7XHJcbiAgdGl0bGU6IHN0cmluZztcclxuICBjb21wb25lbnRzOiBhbnlbXTtcclxufVxyXG5cclxuLyoqXHJcbiAqIENyZWF0ZSBhcHByb3ByaWF0ZSBpbnRlcmFjdGlvbiBjbGFzcyBiYXNlZCBvbiB0eXBlXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlSW50ZXJhY3Rpb24oY2xpZW50OiBDbGllbnQsIGRhdGE6IEFQSUludGVyYWN0aW9uKTogSW50ZXJhY3Rpb24ge1xyXG4gIHN3aXRjaCAoZGF0YS50eXBlKSB7XHJcbiAgICBjYXNlIEludGVyYWN0aW9uVHlwZS5BcHBsaWNhdGlvbkNvbW1hbmQ6XHJcbiAgICAgIHJldHVybiBuZXcgQ29tbWFuZEludGVyYWN0aW9uKGNsaWVudCwgZGF0YSk7XHJcbiAgICBjYXNlIEludGVyYWN0aW9uVHlwZS5BcHBsaWNhdGlvbkNvbW1hbmRBdXRvY29tcGxldGU6XHJcbiAgICAgIHJldHVybiBuZXcgQXV0b2NvbXBsZXRlSW50ZXJhY3Rpb24oY2xpZW50LCBkYXRhKTtcclxuICAgIGNhc2UgSW50ZXJhY3Rpb25UeXBlLk1vZGFsU3VibWl0OlxyXG4gICAgICByZXR1cm4gbmV3IE1vZGFsU3VibWl0SW50ZXJhY3Rpb24oY2xpZW50LCBkYXRhKTtcclxuICAgIGNhc2UgSW50ZXJhY3Rpb25UeXBlLk1lc3NhZ2VDb21wb25lbnQ6XHJcbiAgICAgIC8vIGNvbXBvbmVudF90eXBlOiAyID0gQnV0dG9uLCAzID0gU2VsZWN0IE1lbnVcclxuICAgICAgaWYgKGRhdGEuZGF0YT8uY29tcG9uZW50X3R5cGUgPT09IDIpIHtcclxuICAgICAgICByZXR1cm4gbmV3IEJ1dHRvbkludGVyYWN0aW9uKGNsaWVudCwgZGF0YSk7XHJcbiAgICAgIH0gZWxzZSBpZiAoZGF0YS5kYXRhPy5jb21wb25lbnRfdHlwZSA9PT0gMykge1xyXG4gICAgICAgIHJldHVybiBuZXcgU2VsZWN0TWVudUludGVyYWN0aW9uKGNsaWVudCwgZGF0YSk7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIG5ldyBJbnRlcmFjdGlvbihjbGllbnQsIGRhdGEpO1xyXG4gICAgZGVmYXVsdDpcclxuICAgICAgcmV0dXJuIG5ldyBJbnRlcmFjdGlvbihjbGllbnQsIGRhdGEpO1xyXG4gIH1cclxufVxyXG4iXX0=