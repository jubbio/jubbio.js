"use strict";
/**
 * SlashCommandBuilder for creating slash commands
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlashCommandBuilder = exports.SlashCommandAttachmentOption = exports.SlashCommandMentionableOption = exports.SlashCommandRoleOption = exports.SlashCommandChannelOption = exports.SlashCommandUserOption = exports.SlashCommandBooleanOption = exports.SlashCommandNumberOption = exports.SlashCommandIntegerOption = exports.SlashCommandStringOption = exports.ApplicationCommandOptionType = void 0;
/**
 * Application command option types
 */
var ApplicationCommandOptionType;
(function (ApplicationCommandOptionType) {
    ApplicationCommandOptionType[ApplicationCommandOptionType["Subcommand"] = 1] = "Subcommand";
    ApplicationCommandOptionType[ApplicationCommandOptionType["SubcommandGroup"] = 2] = "SubcommandGroup";
    ApplicationCommandOptionType[ApplicationCommandOptionType["String"] = 3] = "String";
    ApplicationCommandOptionType[ApplicationCommandOptionType["Integer"] = 4] = "Integer";
    ApplicationCommandOptionType[ApplicationCommandOptionType["Boolean"] = 5] = "Boolean";
    ApplicationCommandOptionType[ApplicationCommandOptionType["User"] = 6] = "User";
    ApplicationCommandOptionType[ApplicationCommandOptionType["Channel"] = 7] = "Channel";
    ApplicationCommandOptionType[ApplicationCommandOptionType["Role"] = 8] = "Role";
    ApplicationCommandOptionType[ApplicationCommandOptionType["Mentionable"] = 9] = "Mentionable";
    ApplicationCommandOptionType[ApplicationCommandOptionType["Number"] = 10] = "Number";
    ApplicationCommandOptionType[ApplicationCommandOptionType["Attachment"] = 11] = "Attachment";
})(ApplicationCommandOptionType || (exports.ApplicationCommandOptionType = ApplicationCommandOptionType = {}));
/**
 * A builder for creating slash command options
 */
class SlashCommandOptionBuilder {
    data;
    constructor(type) {
        this.data = { type };
    }
    setName(name) {
        this.data.name = name;
        return this;
    }
    setDescription(description) {
        this.data.description = description;
        return this;
    }
    setRequired(required = true) {
        this.data.required = required;
        return this;
    }
    toJSON() {
        return { ...this.data };
    }
}
/**
 * String option builder
 */
class SlashCommandStringOption extends SlashCommandOptionBuilder {
    constructor() {
        super(ApplicationCommandOptionType.String);
    }
    addChoices(...choices) {
        if (!this.data.choices)
            this.data.choices = [];
        this.data.choices.push(...choices);
        return this;
    }
    setChoices(...choices) {
        this.data.choices = choices;
        return this;
    }
    setMinLength(minLength) {
        this.data.min_length = minLength;
        return this;
    }
    setMaxLength(maxLength) {
        this.data.max_length = maxLength;
        return this;
    }
    setAutocomplete(autocomplete = true) {
        this.data.autocomplete = autocomplete;
        return this;
    }
}
exports.SlashCommandStringOption = SlashCommandStringOption;
/**
 * Integer option builder
 */
class SlashCommandIntegerOption extends SlashCommandOptionBuilder {
    constructor() {
        super(ApplicationCommandOptionType.Integer);
    }
    addChoices(...choices) {
        if (!this.data.choices)
            this.data.choices = [];
        this.data.choices.push(...choices);
        return this;
    }
    setMinValue(minValue) {
        this.data.min_value = minValue;
        return this;
    }
    setMaxValue(maxValue) {
        this.data.max_value = maxValue;
        return this;
    }
    setAutocomplete(autocomplete = true) {
        this.data.autocomplete = autocomplete;
        return this;
    }
}
exports.SlashCommandIntegerOption = SlashCommandIntegerOption;
/**
 * Number option builder
 */
class SlashCommandNumberOption extends SlashCommandOptionBuilder {
    constructor() {
        super(ApplicationCommandOptionType.Number);
    }
    addChoices(...choices) {
        if (!this.data.choices)
            this.data.choices = [];
        this.data.choices.push(...choices);
        return this;
    }
    setMinValue(minValue) {
        this.data.min_value = minValue;
        return this;
    }
    setMaxValue(maxValue) {
        this.data.max_value = maxValue;
        return this;
    }
    setAutocomplete(autocomplete = true) {
        this.data.autocomplete = autocomplete;
        return this;
    }
}
exports.SlashCommandNumberOption = SlashCommandNumberOption;
/**
 * Boolean option builder
 */
class SlashCommandBooleanOption extends SlashCommandOptionBuilder {
    constructor() {
        super(ApplicationCommandOptionType.Boolean);
    }
}
exports.SlashCommandBooleanOption = SlashCommandBooleanOption;
/**
 * User option builder
 */
class SlashCommandUserOption extends SlashCommandOptionBuilder {
    constructor() {
        super(ApplicationCommandOptionType.User);
    }
}
exports.SlashCommandUserOption = SlashCommandUserOption;
/**
 * Channel option builder
 */
class SlashCommandChannelOption extends SlashCommandOptionBuilder {
    constructor() {
        super(ApplicationCommandOptionType.Channel);
    }
    addChannelTypes(...types) {
        if (!this.data.channel_types)
            this.data.channel_types = [];
        this.data.channel_types.push(...types);
        return this;
    }
}
exports.SlashCommandChannelOption = SlashCommandChannelOption;
/**
 * Role option builder
 */
class SlashCommandRoleOption extends SlashCommandOptionBuilder {
    constructor() {
        super(ApplicationCommandOptionType.Role);
    }
}
exports.SlashCommandRoleOption = SlashCommandRoleOption;
/**
 * Mentionable option builder
 */
class SlashCommandMentionableOption extends SlashCommandOptionBuilder {
    constructor() {
        super(ApplicationCommandOptionType.Mentionable);
    }
}
exports.SlashCommandMentionableOption = SlashCommandMentionableOption;
/**
 * Attachment option builder
 */
class SlashCommandAttachmentOption extends SlashCommandOptionBuilder {
    constructor() {
        super(ApplicationCommandOptionType.Attachment);
    }
}
exports.SlashCommandAttachmentOption = SlashCommandAttachmentOption;
/**
 * A builder for creating slash commands
 */
class SlashCommandBuilder {
    data;
    constructor() {
        this.data = { options: [] };
    }
    /**
     * Sets the name of this command
     * @param name The name
     */
    setName(name) {
        this.data.name = name;
        return this;
    }
    /**
     * Sets the description of this command
     * @param description The description
     */
    setDescription(description) {
        this.data.description = description;
        return this;
    }
    /**
     * Sets the default member permissions required to use this command
     * @param permissions The permissions
     */
    setDefaultMemberPermissions(permissions) {
        this.data.default_member_permissions = permissions === null
            ? undefined
            : String(permissions);
        return this;
    }
    /**
     * Sets whether this command is available in DMs
     * @param enabled Whether the command is available in DMs
     */
    setDMPermission(enabled) {
        this.data.dm_permission = enabled;
        return this;
    }
    /**
     * Sets whether this command is NSFW
     * @param nsfw Whether the command is NSFW
     */
    setNSFW(nsfw = true) {
        this.data.nsfw = nsfw;
        return this;
    }
    /**
     * Adds a string option
     */
    addStringOption(fn) {
        const option = fn(new SlashCommandStringOption());
        this.data.options.push(option.toJSON());
        return this;
    }
    /**
     * Adds an integer option
     */
    addIntegerOption(fn) {
        const option = fn(new SlashCommandIntegerOption());
        this.data.options.push(option.toJSON());
        return this;
    }
    /**
     * Adds a number option
     */
    addNumberOption(fn) {
        const option = fn(new SlashCommandNumberOption());
        this.data.options.push(option.toJSON());
        return this;
    }
    /**
     * Adds a boolean option
     */
    addBooleanOption(fn) {
        const option = fn(new SlashCommandBooleanOption());
        this.data.options.push(option.toJSON());
        return this;
    }
    /**
     * Adds a user option
     */
    addUserOption(fn) {
        const option = fn(new SlashCommandUserOption());
        this.data.options.push(option.toJSON());
        return this;
    }
    /**
     * Adds a channel option
     */
    addChannelOption(fn) {
        const option = fn(new SlashCommandChannelOption());
        this.data.options.push(option.toJSON());
        return this;
    }
    /**
     * Adds a role option
     */
    addRoleOption(fn) {
        const option = fn(new SlashCommandRoleOption());
        this.data.options.push(option.toJSON());
        return this;
    }
    /**
     * Adds a mentionable option
     */
    addMentionableOption(fn) {
        const option = fn(new SlashCommandMentionableOption());
        this.data.options.push(option.toJSON());
        return this;
    }
    /**
     * Adds an attachment option
     */
    addAttachmentOption(fn) {
        const option = fn(new SlashCommandAttachmentOption());
        this.data.options.push(option.toJSON());
        return this;
    }
    /**
     * Returns the JSON representation of this command
     */
    toJSON() {
        return { ...this.data };
    }
}
exports.SlashCommandBuilder = SlashCommandBuilder;
exports.default = SlashCommandBuilder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU2xhc2hDb21tYW5kQnVpbGRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9idWlsZGVycy9TbGFzaENvbW1hbmRCdWlsZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7R0FFRzs7O0FBRUg7O0dBRUc7QUFDSCxJQUFZLDRCQVlYO0FBWkQsV0FBWSw0QkFBNEI7SUFDdEMsMkZBQWMsQ0FBQTtJQUNkLHFHQUFtQixDQUFBO0lBQ25CLG1GQUFVLENBQUE7SUFDVixxRkFBVyxDQUFBO0lBQ1gscUZBQVcsQ0FBQTtJQUNYLCtFQUFRLENBQUE7SUFDUixxRkFBVyxDQUFBO0lBQ1gsK0VBQVEsQ0FBQTtJQUNSLDZGQUFlLENBQUE7SUFDZixvRkFBVyxDQUFBO0lBQ1gsNEZBQWUsQ0FBQTtBQUNqQixDQUFDLEVBWlcsNEJBQTRCLDRDQUE1Qiw0QkFBNEIsUUFZdkM7QUErQkQ7O0dBRUc7QUFDSCxNQUFNLHlCQUF5QjtJQUNuQixJQUFJLENBQXVDO0lBRXJELFlBQVksSUFBa0M7UUFDNUMsSUFBSSxDQUFDLElBQUksR0FBRyxFQUFFLElBQUksRUFBRSxDQUFDO0lBQ3ZCLENBQUM7SUFFRCxPQUFPLENBQUMsSUFBWTtRQUNsQixJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7UUFDdEIsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQsY0FBYyxDQUFDLFdBQW1CO1FBQ2hDLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQztRQUNwQyxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRCxXQUFXLENBQUMsUUFBUSxHQUFHLElBQUk7UUFDekIsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDO1FBQzlCLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVELE1BQU07UUFDSixPQUFPLEVBQUUsR0FBRyxJQUFJLENBQUMsSUFBSSxFQUFpQyxDQUFDO0lB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Q3pDLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEOztPQUVHO0lBQ0gsTUFBTTtRQUNKLE9BQU8sRUFBRSxHQUFHLElBQUksQ0FBQyxJQUFJLEVBQTJCLENBQUM7SUFDbkQsQ0FBQztDQUNGO0FBN0lELGtEQTZJQztBQUVELGtCQUFlLG1CQUFtQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBTbGFzaENvbW1hbmRCdWlsZGVyIGZvciBjcmVhdGluZyBzbGFzaCBjb21tYW5kc1xuICovXG5cbi8qKlxuICogQXBwbGljYXRpb24gY29tbWFuZCBvcHRpb24gdHlwZXNcbiAqL1xuZXhwb3J0IGVudW0gQXBwbGljYXRpb25Db21tYW5kT3B0aW9uVHlwZSB7XG4gIFN1YmNvbW1hbmQgPSAxLFxuICBTdWJjb21tYW5kR3JvdXAgPSAyLFxuICBTdHJpbmcgPSAzLFxuICBJbnRlZ2VyID0gNCxcbiAgQm9vbGVhbiA9IDUsXG4gIFVzZXIgPSA2LFxuICBDaGFubmVsID0gNyxcbiAgUm9sZSA9IDgsXG4gIE1lbnRpb25hYmxlID0gOSxcbiAgTnVtYmVyID0gMTAsXG4gIEF0dGFjaG1lbnQgPSAxMSxcbn1cblxuZXhwb3J0IGludGVyZmFjZSBBUElBcHBsaWNhdGlvbkNvbW1hbmRPcHRpb25DaG9pY2Uge1xuICBuYW1lOiBzdHJpbmc7XG4gIHZhbHVlOiBzdHJpbmcgfCBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQVBJQXBwbGljYXRpb25Db21tYW5kT3B0aW9uIHtcbiAgdHlwZTogQXBwbGljYXRpb25Db21tYW5kT3B0aW9uVHlwZTtcbiAgbmFtZTogc3RyaW5nO1xuICBkZXNjcmlwdGlvbjogc3RyaW5nO1xuICByZXF1aXJlZD86IGJvb2xlYW47XG4gIGNob2ljZXM/OiBBUElBcHBsaWNhdGlvbkNvbW1hbmRPcHRpb25DaG9pY2VbXTtcbiAgb3B0aW9ucz86IEFQSUFwcGxpY2F0aW9uQ29tbWFuZE9wdGlvbltdO1xuICBtaW5fdmFsdWU/OiBudW1iZXI7XG4gIG1heF92YWx1ZT86IG51bWJlcjtcbiAgbWluX2xlbmd0aD86IG51bWJlcjtcbiAgbWF4X2xlbmd0aD86IG51bWJlcjtcbiAgYXV0b2NvbXBsZXRlPzogYm9vbGVhbjtcbiAgY2hhbm5lbF90eXBlcz86IG51bWJlcltdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEFQSUFwcGxpY2F0aW9uQ29tbWFuZCB7XG4gIG5hbWU6IHN0cmluZztcbiAgZGVzY3JpcHRpb246IHN0cmluZztcbiAgb3B0aW9ucz86IEFQSUFwcGxpY2F0aW9uQ29tbWFuZE9wdGlvbltdO1xuICBkZWZhdWx0X21lbWJlcl9wZXJtaXNzaW9ucz86IHN0cmluZztcbiAgZG1fcGVybWlzc2lvbj86IGJvb2xlYW47XG4gIG5zZnc/OiBib29sZWFuO1xufVxuXG4vKipcbiAqIEEgYnVpbGRlciBmb3IgY3JlYXRpbmcgc2xhc2ggY29tbWFuZCBvcHRpb25zXG4gKi9cbmNsYXNzIFNsYXNoQ29tbWFuZE9wdGlvbkJ1aWxkZXIge1xuICBwcm90ZWN0ZWQgZGF0YTogUGFydGlhbDxBUElBcHBsaWNhdGlvbkNvbW1hbmRPcHRpb24+O1xuXG4gIGNvbnN0cnVjdG9yKHR5cGU6IEFwcGxpY2F0aW9uQ29tbWFuZE9wdGlvblR5cGUpIHtcbiAgICB0aGlzLmRhdGEgPSB7IHR5cGUgfTtcbiAgfVxuXG4gIHNldE5hbWUobmFtZTogc3RyaW5nKTogdGhpcyB7XG4gICAgdGhpcy5kYXRhLm5hbWUgPSBuYW1lO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgc2V0RGVzY3JpcHRpb24oZGVzY3JpcHRpb246IHN0cmluZyk6IHRoaXMge1xuICAgIHRoaXMuZGF0YS5kZXNjcmlwdGlvbiA9IGRlc2NyaXB0aW9uO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgc2V0UmVxdWlyZWQocmVxdWlyZWQgPSB0cnVlKTogdGhpcyB7XG4gICAgdGhpcy5kYXRhLnJlcXVpcmVkID0gcmVxdWlyZWQ7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICB0b0pTT04oKTogQVBJQXBwbGljYXRpb25Db21tYW5kT3B0aW9uIHtcbiAgICByZXR1cm4geyAuLi50aGlzLmRhdGEgfSBhcyBBUElBcHBsaWNhdGlvbkNvbW1hbmRPcHRpb247XG4gIH1cbn1cblxuLyoqXG4gKiBTdHJpbmcgb3B0aW9uIGJ1aWxkZXJcbiAqL1xuZXhwb3J0IGNsYXNzIFNsYXNoQ29tbWFuZFN0cmluZ09wdGlvbiBleHRlbmRzIFNsYXNoQ29tbWFuZE9wdGlvbkJ1aWxkZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihBcHBsaWNhdGlvbkNvbW1hbmRPcHRpb25UeXBlLlN0cmluZyk7XG4gIH1cblxuICBhZGRDaG9pY2VzKC4uLmNob2ljZXM6IEFQSUFwcGxpY2F0aW9uQ29tbWFuZE9wdGlvbkNob2ljZVtdKTogdGhpcyB7XG4gICAgaWYgKCF0aGlzLmRhdGEuY2hvaWNlcykgdGhpcy5kYXRhLmNob2ljZXMgPSBbXTtcbiAgICB0aGlzLmRhdGEuY2hvaWNlcy5wdXNoKC4uLmNob2ljZXMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgc2V0Q2hvaWNlcyguLi5jaG9pY2VzOiBBUElBcHBsaWNhdGlvbkNvbW1hbmRPcHRpb25DaG9pY2VbXSk6IHRoaXMge1xuICAgIHRoaXMuZGF0YS5jaG9pY2VzID0gY2hvaWNlcztcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHNldE1pbkxlbmd0aChtaW5MZW5ndGg6IG51bWJlcik6IHRoaXMge1xuICAgIHRoaXMuZGF0YS5taW5fbGVuZ3RoID0gbWluTGVuZ3RoO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgc2V0TWF4TGVuZ3RoKG1heExlbmd0aDogbnVtYmVyKTogdGhpcyB7XG4gICAgdGhpcy5kYXRhLm1heF9sZW5ndGggPSBtYXhMZW5ndGg7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBzZXRBdXRvY29tcGxldGUoYXV0b2NvbXBsZXRlID0gdHJ1ZSk6IHRoaXMge1xuICAgIHRoaXMuZGF0YS5hdXRvY29tcGxldGUgPSBhdXRvY29tcGxldGU7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbn1cblxuLyoqXG4gKiBJbnRlZ2VyIG9wdGlvbiBidWlsZGVyXG4gKi9cbmV4cG9ydCBjbGFzcyBTbGFzaENvbW1hbmRJbnRlZ2VyT3B0aW9uIGV4dGVuZHMgU2xhc2hDb21tYW5kT3B0aW9uQnVpbGRlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKEFwcGxpY2F0aW9uQ29tbWFuZE9wdGlvblR5cGUuSW50ZWdlcik7XG4gIH1cblxuICBhZGRDaG9pY2VzKC4uLmNob2ljZXM6IEFQSUFwcGxpY2F0aW9uQ29tbWFuZE9wdGlvbkNob2ljZVtdKTogdGhpcyB7XG4gICAgaWYgKCF0aGlzLmRhdGEuY2hvaWNlcykgdGhpcy5kYXRhLmNob2ljZXMgPSBbXTtcbiAgICB0aGlzLmRhdGEuY2hvaWNlcy5wdXNoKC4uLmNob2ljZXMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgc2V0TWluVmFsdWUobWluVmFsdWU6IG51bWJlcik6IHRoaXMge1xuICAgIHRoaXMuZGF0YS5taW5fdmFsdWUgPSBtaW5WYWx1ZTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHNldE1heFZhbHVlKG1heFZhbHVlOiBudW1iZXIpOiB0aGlzIHtcbiAgICB0aGlzLmRhdGEubWF4X3ZhbHVlID0gbWF4VmFsdWU7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBzZXRBdXRvY29tcGxldGUoYXV0b2NvbXBsZXRlID0gdHJ1ZSk6IHRoaXMge1xuICAgIHRoaXMuZGF0YS5hdXRvY29tcGxldGUgPSBhdXRvY29tcGxldGU7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbn1cblxuLyoqXG4gKiBOdW1iZXIgb3B0aW9uIGJ1aWxkZXJcbiAqL1xuZXhwb3J0IGNsYXNzIFNsYXNoQ29tbWFuZE51bWJlck9wdGlvbiBleHRlbmRzIFNsYXNoQ29tbWFuZE9wdGlvbkJ1aWxkZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihBcHBsaWNhdGlvbkNvbW1hbmRPcHRpb25UeXBlLk51bWJlcik7XG4gIH1cblxuICBhZGRDaG9pY2VzKC4uLmNob2ljZXM6IEFQSUFwcGxpY2F0aW9uQ29tbWFuZE9wdGlvbkNob2ljZVtdKTogdGhpcyB7XG4gICAgaWYgKCF0aGlzLmRhdGEuY2hvaWNlcykgdGhpcy5kYXRhLmNob2ljZXMgPSBbXTtcbiAgICB0aGlzLmRhdGEuY2hvaWNlcy5wdXNoKC4uLmNob2ljZXMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgc2V0TWluVmFsdWUobWluVmFsdWU6IG51bWJlcik6IHRoaXMge1xuICAgIHRoaXMuZGF0YS5taW5fdmFsdWUgPSBtaW5WYWx1ZTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHNldE1heFZhbHVlKG1heFZhbHVlOiBudW1iZXIpOiB0aGlzIHtcbiAgICB0aGlzLmRhdGEubWF4X3ZhbHVlID0gbWF4VmFsdWU7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBzZXRBdXRvY29tcGxldGUoYXV0b2NvbXBsZXRlID0gdHJ1ZSk6IHRoaXMge1xuICAgIHRoaXMuZGF0YS5hdXRvY29tcGxldGUgPSBhdXRvY29tcGxldGU7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbn1cblxuLyoqXG4gKiBCb29sZWFuIG9wdGlvbiBidWlsZGVyXG4gKi9cbmV4cG9ydCBjbGFzcyBTbGFzaENvbW1hbmRCb29sZWFuT3B0aW9uIGV4dGVuZHMgU2xhc2hDb21tYW5kT3B0aW9uQnVpbGRlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKEFwcGxpY2F0aW9uQ29tbWFuZE9wdGlvblR5cGUuQm9vbGVhbik7XG4gIH1cbn1cblxuLyoqXG4gKiBVc2VyIG9wdGlvbiBidWlsZGVyXG4gKi9cbmV4cG9ydCBjbGFzcyBTbGFzaENvbW1hbmRVc2VyT3B0aW9uIGV4dGVuZHMgU2xhc2hDb21tYW5kT3B0aW9uQnVpbGRlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKEFwcGxpY2F0aW9uQ29tbWFuZE9wdGlvblR5cGUuVXNlcik7XG4gIH1cbn1cblxuLyoqXG4gKiBDaGFubmVsIG9wdGlvbiBidWlsZGVyXG4gKi9cbmV4cG9ydCBjbGFzcyBTbGFzaENvbW1hbmRDaGFubmVsT3B0aW9uIGV4dGVuZHMgU2xhc2hDb21tYW5kT3B0aW9uQnVpbGRlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKEFwcGxpY2F0aW9uQ29tbWFuZE9wdGlvblR5cGUuQ2hhbm5lbCk7XG4gIH1cblxuICBhZGRDaGFubmVsVHlwZXMoLi4udHlwZXM6IG51bWJlcltdKTogdGhpcyB7XG4gICAgaWYgKCF0aGlzLmRhdGEuY2hhbm5lbF90eXBlcykgdGhpcy5kYXRhLmNoYW5uZWxfdHlwZXMgPSBbXTtcbiAgICB0aGlzLmRhdGEuY2hhbm5lbF90eXBlcy5wdXNoKC4uLnR5cGVzKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxufVxuXG4vKipcbiAqIFJvbGUgb3B0aW9uIGJ1aWxkZXJcbiAqL1xuZXhwb3J0IGNsYXNzIFNsYXNoQ29tbWFuZFJvbGVPcHRpb24gZXh0ZW5kcyBTbGFzaENvbW1hbmRPcHRpb25CdWlsZGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoQXBwbGljYXRpb25Db21tYW5kT3B0aW9uVHlwZS5Sb2xlKTtcbiAgfVxufVxuXG4vKipcbiAqIE1lbnRpb25hYmxlIG9wdGlvbiBidWlsZGVyXG4gKi9cbmV4cG9ydCBjbGFzcyBTbGFzaENvbW1hbmRNZW50aW9uYWJsZU9wdGlvbiBleHRlbmRzIFNsYXNoQ29tbWFuZE9wdGlvbkJ1aWxkZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihBcHBsaWNhdGlvbkNvbW1hbmRPcHRpb25UeXBlLk1lbnRpb25hYmxlKTtcbiAgfVxufVxuXG4vKipcbiAqIEF0dGFjaG1lbnQgb3B0aW9uIGJ1aWxkZXJcbiAqL1xuZXhwb3J0IGNsYXNzIFNsYXNoQ29tbWFuZEF0dGFjaG1lbnRPcHRpb24gZXh0ZW5kcyBTbGFzaENvbW1hbmRPcHRpb25CdWlsZGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoQXBwbGljYXRpb25Db21tYW5kT3B0aW9uVHlwZS5BdHRhY2htZW50KTtcbiAgfVxufVxuXG4vKipcbiAqIEEgYnVpbGRlciBmb3IgY3JlYXRpbmcgc2xhc2ggY29tbWFuZHNcbiAqL1xuZXhwb3J0IGNsYXNzIFNsYXNoQ29tbWFuZEJ1aWxkZXIge1xuICBwdWJsaWMgcmVhZG9ubHkgZGF0YTogUGFydGlhbDxBUElBcHBsaWNhdGlvbkNvbW1hbmQ+O1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuZGF0YSA9IHsgb3B0aW9uczogW10gfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSBuYW1lIG9mIHRoaXMgY29tbWFuZFxuICAgKiBAcGFyYW0gbmFtZSBUaGUgbmFtZVxuICAgKi9cbiAgc2V0TmFtZShuYW1lOiBzdHJpbmcpOiB0aGlzIHtcbiAgICB0aGlzLmRhdGEubmFtZSA9IG5hbWU7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU2V0cyB0aGUgZGVzY3JpcHRpb24gb2YgdGhpcyBjb21tYW5kXG4gICAqIEBwYXJhbSBkZXNjcmlwdGlvbiBUaGUgZGVzY3JpcHRpb25cbiAgICovXG4gIHNldERlc2NyaXB0aW9uKGRlc2NyaXB0aW9uOiBzdHJpbmcpOiB0aGlzIHtcbiAgICB0aGlzLmRhdGEuZGVzY3JpcHRpb24gPSBkZXNjcmlwdGlvbjtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSBkZWZhdWx0IG1lbWJlciBwZXJtaXNzaW9ucyByZXF1aXJlZCB0byB1c2UgdGhpcyBjb21tYW5kXG4gICAqIEBwYXJhbSBwZXJtaXNzaW9ucyBUaGUgcGVybWlzc2lvbnNcbiAgICovXG4gIHNldERlZmF1bHRNZW1iZXJQZXJtaXNzaW9ucyhwZXJtaXNzaW9uczogYmlnaW50IHwgc3RyaW5nIHwgbnVsbCk6IHRoaXMge1xuICAgIHRoaXMuZGF0YS5kZWZhdWx0X21lbWJlcl9wZXJtaXNzaW9ucyA9IHBlcm1pc3Npb25zID09PSBudWxsIFxuICAgICAgPyB1bmRlZmluZWQgXG4gICAgICA6IFN0cmluZyhwZXJtaXNzaW9ucyk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU2V0cyB3aGV0aGVyIHRoaXMgY29tbWFuZCBpcyBhdmFpbGFibGUgaW4gRE1zXG4gICAqIEBwYXJhbSBlbmFibGVkIFdoZXRoZXIgdGhlIGNvbW1hbmQgaXMgYXZhaWxhYmxlIGluIERNc1xuICAgKi9cbiAgc2V0RE1QZXJtaXNzaW9uKGVuYWJsZWQ6IGJvb2xlYW4pOiB0aGlzIHtcbiAgICB0aGlzLmRhdGEuZG1fcGVybWlzc2lvbiA9IGVuYWJsZWQ7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU2V0cyB3aGV0aGVyIHRoaXMgY29tbWFuZCBpcyBOU0ZXXG4gICAqIEBwYXJhbSBuc2Z3IFdoZXRoZXIgdGhlIGNvbW1hbmQgaXMgTlNGV1xuICAgKi9cbiAgc2V0TlNGVyhuc2Z3ID0gdHJ1ZSk6IHRoaXMge1xuICAgIHRoaXMuZGF0YS5uc2Z3ID0gbnNmdztcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGRzIGEgc3RyaW5nIG9wdGlvblxuICAgKi9cbiAgYWRkU3RyaW5nT3B0aW9uKGZuOiAob3B0aW9uOiBTbGFzaENvbW1hbmRTdHJpbmdPcHRpb24pID0+IFNsYXNoQ29tbWFuZFN0cmluZ09wdGlvbik6IHRoaXMge1xuICAgIGNvbnN0IG9wdGlvbiA9IGZuKG5ldyBTbGFzaENvbW1hbmRTdHJpbmdPcHRpb24oKSk7XG4gICAgdGhpcy5kYXRhLm9wdGlvbnMhLnB1c2gob3B0aW9uLnRvSlNPTigpKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGRzIGFuIGludGVnZXIgb3B0aW9uXG4gICAqL1xuICBhZGRJbnRlZ2VyT3B0aW9uKGZuOiAob3B0aW9uOiBTbGFzaENvbW1hbmRJbnRlZ2VyT3B0aW9uKSA9PiBTbGFzaENvbW1hbmRJbnRlZ2VyT3B0aW9uKTogdGhpcyB7XG4gICAgY29uc3Qgb3B0aW9uID0gZm4obmV3IFNsYXNoQ29tbWFuZEludGVnZXJPcHRpb24oKSk7XG4gICAgdGhpcy5kYXRhLm9wdGlvbnMhLnB1c2gob3B0aW9uLnRvSlNPTigpKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGRzIGEgbnVtYmVyIG9wdGlvblxuICAgKi9cbiAgYWRkTnVtYmVyT3B0aW9uKGZuOiAob3B0aW9uOiBTbGFzaENvbW1hbmROdW1iZXJPcHRpb24pID0+IFNsYXNoQ29tbWFuZE51bWJlck9wdGlvbik6IHRoaXMge1xuICAgIGNvbnN0IG9wdGlvbiA9IGZuKG5ldyBTbGFzaENvbW1hbmROdW1iZXJPcHRpb24oKSk7XG4gICAgdGhpcy5kYXRhLm9wdGlvbnMhLnB1c2gob3B0aW9uLnRvSlNPTigpKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGRzIGEgYm9vbGVhbiBvcHRpb25cbiAgICovXG4gIGFkZEJvb2xlYW5PcHRpb24oZm46IChvcHRpb246IFNsYXNoQ29tbWFuZEJvb2xlYW5PcHRpb24pID0+IFNsYXNoQ29tbWFuZEJvb2xlYW5PcHRpb24pOiB0aGlzIHtcbiAgICBjb25zdCBvcHRpb24gPSBmbihuZXcgU2xhc2hDb21tYW5kQm9vbGVhbk9wdGlvbigpKTtcbiAgICB0aGlzLmRhdGEub3B0aW9ucyEucHVzaChvcHRpb24udG9KU09OKCkpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZHMgYSB1c2VyIG9wdGlvblxuICAgKi9cbiAgYWRkVXNlck9wdGlvbihmbjogKG9wdGlvbjogU2xhc2hDb21tYW5kVXNlck9wdGlvbikgPT4gU2xhc2hDb21tYW5kVXNlck9wdGlvbik6IHRoaXMge1xuICAgIGNvbnN0IG9wdGlvbiA9IGZuKG5ldyBTbGFzaENvbW1hbmRVc2VyT3B0aW9uKCkpO1xuICAgIHRoaXMuZGF0YS5vcHRpb25zIS5wdXNoKG9wdGlvbi50b0pTT04oKSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogQWRkcyBhIGNoYW5uZWwgb3B0aW9uXG4gICAqL1xuICBhZGRDaGFubmVsT3B0aW9uKGZuOiAob3B0aW9uOiBTbGFzaENvbW1hbmRDaGFubmVsT3B0aW9uKSA9PiBTbGFzaENvbW1hbmRDaGFubmVsT3B0aW9uKTogdGhpcyB7XG4gICAgY29uc3Qgb3B0aW9uID0gZm4obmV3IFNsYXNoQ29tbWFuZENoYW5uZWxPcHRpb24oKSk7XG4gICAgdGhpcy5kYXRhLm9wdGlvbnMhLnB1c2gob3B0aW9uLnRvSlNPTigpKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGRzIGEgcm9sZSBvcHRpb25cbiAgICovXG4gIGFkZFJvbGVPcHRpb24oZm46IChvcHRpb246IFNsYXNoQ29tbWFuZFJvbGVPcHRpb24pID0+IFNsYXNoQ29tbWFuZFJvbGVPcHRpb24pOiB0aGlzIHtcbiAgICBjb25zdCBvcHRpb24gPSBmbihuZXcgU2xhc2hDb21tYW5kUm9sZU9wdGlvbigpKTtcbiAgICB0aGlzLmRhdGEub3B0aW9ucyEucHVzaChvcHRpb24udG9KU09OKCkpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZHMgYSBtZW50aW9uYWJsZSBvcHRpb25cbiAgICovXG4gIGFkZE1lbnRpb25hYmxlT3B0aW9uKGZuOiAob3B0aW9uOiBTbGFzaENvbW1hbmRNZW50aW9uYWJsZU9wdGlvbikgPT4gU2xhc2hDb21tYW5kTWVudGlvbmFibGVPcHRpb24pOiB0aGlzIHtcbiAgICBjb25zdCBvcHRpb24gPSBmbihuZXcgU2xhc2hDb21tYW5kTWVudGlvbmFibGVPcHRpb24oKSk7XG4gICAgdGhpcy5kYXRhLm9wdGlvbnMhLnB1c2gob3B0aW9uLnRvSlNPTigpKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGRzIGFuIGF0dGFjaG1lbnQgb3B0aW9uXG4gICAqL1xuICBhZGRBdHRhY2htZW50T3B0aW9uKGZuOiAob3B0aW9uOiBTbGFzaENvbW1hbmRBdHRhY2htZW50T3B0aW9uKSA9PiBTbGFzaENvbW1hbmRBdHRhY2htZW50T3B0aW9uKTogdGhpcyB7XG4gICAgY29uc3Qgb3B0aW9uID0gZm4obmV3IFNsYXNoQ29tbWFuZEF0dGFjaG1lbnRPcHRpb24oKSk7XG4gICAgdGhpcy5kYXRhLm9wdGlvbnMhLnB1c2gob3B0aW9uLnRvSlNPTigpKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBKU09OIHJlcHJlc2VudGF0aW9uIG9mIHRoaXMgY29tbWFuZFxuICAgKi9cbiAgdG9KU09OKCk6IEFQSUFwcGxpY2F0aW9uQ29tbWFuZCB7XG4gICAgcmV0dXJuIHsgLi4udGhpcy5kYXRhIH0gYXMgQVBJQXBwbGljYXRpb25Db21tYW5kO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFNsYXNoQ29tbWFuZEJ1aWxkZXI7XG4iXX0=