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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU2xhc2hDb21tYW5kQnVpbGRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9idWlsZGVycy9TbGFzaENvbW1hbmRCdWlsZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7R0FFRzs7O0FBRUg7O0dBRUc7QUFDSCxJQUFZLDRCQVlYO0FBWkQsV0FBWSw0QkFBNEI7SUFDdEMsMkZBQWMsQ0FBQTtJQUNkLHFHQUFtQixDQUFBO0lBQ25CLG1GQUFVLENBQUE7SUFDVixxRkFBVyxDQUFBO0lBQ1gscUZBQVcsQ0FBQTtJQUNYLCtFQUFRLENBQUE7SUFDUixxRkFBVyxDQUFBO0lBQ1gsK0VBQVEsQ0FBQTtJQUNSLDZGQUFlLENBQUE7SUFDZixvRkFBVyxDQUFBO0lBQ1gsNEZBQWUsQ0FBQTtBQUNqQixDQUFDLEVBWlcsNEJBQTRCLDRDQUE1Qiw0QkFBNEIsUUFZdkM7QUErQkQ7O0dBRUc7QUFDSCxNQUFNLHlCQUF5QjtJQUNuQixJQUFJLENBQXVDO0lBRXJELFlBQVksSUFBa0M7UUFDNUMsSUFBSSxDQUFDLElBQUksR0FBRyxFQUFFLElBQUksRUFBRSxDQUFDO0lBQ3ZCLENBQUM7SUFFRCxPQUFPLENBQUMsSUFBWTtRQUNsQixJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7UUFDdEIsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQsY0FBYyxDQUFDLFdBQW1CO1FBQ2hDLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQztRQUNwQyxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRCxXQUFXLENBQUMsUUFBUSxHQUFHLElBQUk7UUFDekIsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDO1FBQzlCLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVELE1BQU07UUFDSixPQUFPLEVBQUUsR0FBRyxJQUFJLENBQUMsSUFBSSxFQUFpQyxDQUFDO0lB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Q3pDLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEOztPQUVHO0lBQ0gsTUFBTTtRQUNKLE9BQU8sRUFBRSxHQUFHLElBQUksQ0FBQyxJQUFJLEVBQTJCLENBQUM7SUFDbkQsQ0FBQztDQUNGO0FBN0lELGtEQTZJQztBQUVELGtCQUFlLG1CQUFtQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIFNsYXNoQ29tbWFuZEJ1aWxkZXIgZm9yIGNyZWF0aW5nIHNsYXNoIGNvbW1hbmRzXHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIEFwcGxpY2F0aW9uIGNvbW1hbmQgb3B0aW9uIHR5cGVzXHJcbiAqL1xyXG5leHBvcnQgZW51bSBBcHBsaWNhdGlvbkNvbW1hbmRPcHRpb25UeXBlIHtcclxuICBTdWJjb21tYW5kID0gMSxcclxuICBTdWJjb21tYW5kR3JvdXAgPSAyLFxyXG4gIFN0cmluZyA9IDMsXHJcbiAgSW50ZWdlciA9IDQsXHJcbiAgQm9vbGVhbiA9IDUsXHJcbiAgVXNlciA9IDYsXHJcbiAgQ2hhbm5lbCA9IDcsXHJcbiAgUm9sZSA9IDgsXHJcbiAgTWVudGlvbmFibGUgPSA5LFxyXG4gIE51bWJlciA9IDEwLFxyXG4gIEF0dGFjaG1lbnQgPSAxMSxcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBBUElBcHBsaWNhdGlvbkNvbW1hbmRPcHRpb25DaG9pY2Uge1xyXG4gIG5hbWU6IHN0cmluZztcclxuICB2YWx1ZTogc3RyaW5nIHwgbnVtYmVyO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEFQSUFwcGxpY2F0aW9uQ29tbWFuZE9wdGlvbiB7XHJcbiAgdHlwZTogQXBwbGljYXRpb25Db21tYW5kT3B0aW9uVHlwZTtcclxuICBuYW1lOiBzdHJpbmc7XHJcbiAgZGVzY3JpcHRpb246IHN0cmluZztcclxuICByZXF1aXJlZD86IGJvb2xlYW47XHJcbiAgY2hvaWNlcz86IEFQSUFwcGxpY2F0aW9uQ29tbWFuZE9wdGlvbkNob2ljZVtdO1xyXG4gIG9wdGlvbnM/OiBBUElBcHBsaWNhdGlvbkNvbW1hbmRPcHRpb25bXTtcclxuICBtaW5fdmFsdWU/OiBudW1iZXI7XHJcbiAgbWF4X3ZhbHVlPzogbnVtYmVyO1xyXG4gIG1pbl9sZW5ndGg/OiBudW1iZXI7XHJcbiAgbWF4X2xlbmd0aD86IG51bWJlcjtcclxuICBhdXRvY29tcGxldGU/OiBib29sZWFuO1xyXG4gIGNoYW5uZWxfdHlwZXM/OiBudW1iZXJbXTtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBBUElBcHBsaWNhdGlvbkNvbW1hbmQge1xyXG4gIG5hbWU6IHN0cmluZztcclxuICBkZXNjcmlwdGlvbjogc3RyaW5nO1xyXG4gIG9wdGlvbnM/OiBBUElBcHBsaWNhdGlvbkNvbW1hbmRPcHRpb25bXTtcclxuICBkZWZhdWx0X21lbWJlcl9wZXJtaXNzaW9ucz86IHN0cmluZztcclxuICBkbV9wZXJtaXNzaW9uPzogYm9vbGVhbjtcclxuICBuc2Z3PzogYm9vbGVhbjtcclxufVxyXG5cclxuLyoqXHJcbiAqIEEgYnVpbGRlciBmb3IgY3JlYXRpbmcgc2xhc2ggY29tbWFuZCBvcHRpb25zXHJcbiAqL1xyXG5jbGFzcyBTbGFzaENvbW1hbmRPcHRpb25CdWlsZGVyIHtcclxuICBwcm90ZWN0ZWQgZGF0YTogUGFydGlhbDxBUElBcHBsaWNhdGlvbkNvbW1hbmRPcHRpb24+O1xyXG5cclxuICBjb25zdHJ1Y3Rvcih0eXBlOiBBcHBsaWNhdGlvbkNvbW1hbmRPcHRpb25UeXBlKSB7XHJcbiAgICB0aGlzLmRhdGEgPSB7IHR5cGUgfTtcclxuICB9XHJcblxyXG4gIHNldE5hbWUobmFtZTogc3RyaW5nKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEubmFtZSA9IG5hbWU7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIHNldERlc2NyaXB0aW9uKGRlc2NyaXB0aW9uOiBzdHJpbmcpOiB0aGlzIHtcclxuICAgIHRoaXMuZGF0YS5kZXNjcmlwdGlvbiA9IGRlc2NyaXB0aW9uO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICBzZXRSZXF1aXJlZChyZXF1aXJlZCA9IHRydWUpOiB0aGlzIHtcclxuICAgIHRoaXMuZGF0YS5yZXF1aXJlZCA9IHJlcXVpcmVkO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICB0b0pTT04oKTogQVBJQXBwbGljYXRpb25Db21tYW5kT3B0aW9uIHtcclxuICAgIHJldHVybiB7IC4uLnRoaXMuZGF0YSB9IGFzIEFQSUFwcGxpY2F0aW9uQ29tbWFuZE9wdGlvbjtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBTdHJpbmcgb3B0aW9uIGJ1aWxkZXJcclxuICovXHJcbmV4cG9ydCBjbGFzcyBTbGFzaENvbW1hbmRTdHJpbmdPcHRpb24gZXh0ZW5kcyBTbGFzaENvbW1hbmRPcHRpb25CdWlsZGVyIHtcclxuICBjb25zdHJ1Y3RvcigpIHtcclxuICAgIHN1cGVyKEFwcGxpY2F0aW9uQ29tbWFuZE9wdGlvblR5cGUuU3RyaW5nKTtcclxuICB9XHJcblxyXG4gIGFkZENob2ljZXMoLi4uY2hvaWNlczogQVBJQXBwbGljYXRpb25Db21tYW5kT3B0aW9uQ2hvaWNlW10pOiB0aGlzIHtcclxuICAgIGlmICghdGhpcy5kYXRhLmNob2ljZXMpIHRoaXMuZGF0YS5jaG9pY2VzID0gW107XHJcbiAgICB0aGlzLmRhdGEuY2hvaWNlcy5wdXNoKC4uLmNob2ljZXMpO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICBzZXRDaG9pY2VzKC4uLmNob2ljZXM6IEFQSUFwcGxpY2F0aW9uQ29tbWFuZE9wdGlvbkNob2ljZVtdKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEuY2hvaWNlcyA9IGNob2ljZXM7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIHNldE1pbkxlbmd0aChtaW5MZW5ndGg6IG51bWJlcik6IHRoaXMge1xyXG4gICAgdGhpcy5kYXRhLm1pbl9sZW5ndGggPSBtaW5MZW5ndGg7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIHNldE1heExlbmd0aChtYXhMZW5ndGg6IG51bWJlcik6IHRoaXMge1xyXG4gICAgdGhpcy5kYXRhLm1heF9sZW5ndGggPSBtYXhMZW5ndGg7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIHNldEF1dG9jb21wbGV0ZShhdXRvY29tcGxldGUgPSB0cnVlKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEuYXV0b2NvbXBsZXRlID0gYXV0b2NvbXBsZXRlO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogSW50ZWdlciBvcHRpb24gYnVpbGRlclxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFNsYXNoQ29tbWFuZEludGVnZXJPcHRpb24gZXh0ZW5kcyBTbGFzaENvbW1hbmRPcHRpb25CdWlsZGVyIHtcclxuICBjb25zdHJ1Y3RvcigpIHtcclxuICAgIHN1cGVyKEFwcGxpY2F0aW9uQ29tbWFuZE9wdGlvblR5cGUuSW50ZWdlcik7XHJcbiAgfVxyXG5cclxuICBhZGRDaG9pY2VzKC4uLmNob2ljZXM6IEFQSUFwcGxpY2F0aW9uQ29tbWFuZE9wdGlvbkNob2ljZVtdKTogdGhpcyB7XHJcbiAgICBpZiAoIXRoaXMuZGF0YS5jaG9pY2VzKSB0aGlzLmRhdGEuY2hvaWNlcyA9IFtdO1xyXG4gICAgdGhpcy5kYXRhLmNob2ljZXMucHVzaCguLi5jaG9pY2VzKTtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgc2V0TWluVmFsdWUobWluVmFsdWU6IG51bWJlcik6IHRoaXMge1xyXG4gICAgdGhpcy5kYXRhLm1pbl92YWx1ZSA9IG1pblZhbHVlO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICBzZXRNYXhWYWx1ZShtYXhWYWx1ZTogbnVtYmVyKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEubWF4X3ZhbHVlID0gbWF4VmFsdWU7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIHNldEF1dG9jb21wbGV0ZShhdXRvY29tcGxldGUgPSB0cnVlKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEuYXV0b2NvbXBsZXRlID0gYXV0b2NvbXBsZXRlO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogTnVtYmVyIG9wdGlvbiBidWlsZGVyXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgU2xhc2hDb21tYW5kTnVtYmVyT3B0aW9uIGV4dGVuZHMgU2xhc2hDb21tYW5kT3B0aW9uQnVpbGRlciB7XHJcbiAgY29uc3RydWN0b3IoKSB7XHJcbiAgICBzdXBlcihBcHBsaWNhdGlvbkNvbW1hbmRPcHRpb25UeXBlLk51bWJlcik7XHJcbiAgfVxyXG5cclxuICBhZGRDaG9pY2VzKC4uLmNob2ljZXM6IEFQSUFwcGxpY2F0aW9uQ29tbWFuZE9wdGlvbkNob2ljZVtdKTogdGhpcyB7XHJcbiAgICBpZiAoIXRoaXMuZGF0YS5jaG9pY2VzKSB0aGlzLmRhdGEuY2hvaWNlcyA9IFtdO1xyXG4gICAgdGhpcy5kYXRhLmNob2ljZXMucHVzaCguLi5jaG9pY2VzKTtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgc2V0TWluVmFsdWUobWluVmFsdWU6IG51bWJlcik6IHRoaXMge1xyXG4gICAgdGhpcy5kYXRhLm1pbl92YWx1ZSA9IG1pblZhbHVlO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICBzZXRNYXhWYWx1ZShtYXhWYWx1ZTogbnVtYmVyKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEubWF4X3ZhbHVlID0gbWF4VmFsdWU7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIHNldEF1dG9jb21wbGV0ZShhdXRvY29tcGxldGUgPSB0cnVlKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEuYXV0b2NvbXBsZXRlID0gYXV0b2NvbXBsZXRlO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogQm9vbGVhbiBvcHRpb24gYnVpbGRlclxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFNsYXNoQ29tbWFuZEJvb2xlYW5PcHRpb24gZXh0ZW5kcyBTbGFzaENvbW1hbmRPcHRpb25CdWlsZGVyIHtcclxuICBjb25zdHJ1Y3RvcigpIHtcclxuICAgIHN1cGVyKEFwcGxpY2F0aW9uQ29tbWFuZE9wdGlvblR5cGUuQm9vbGVhbik7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogVXNlciBvcHRpb24gYnVpbGRlclxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFNsYXNoQ29tbWFuZFVzZXJPcHRpb24gZXh0ZW5kcyBTbGFzaENvbW1hbmRPcHRpb25CdWlsZGVyIHtcclxuICBjb25zdHJ1Y3RvcigpIHtcclxuICAgIHN1cGVyKEFwcGxpY2F0aW9uQ29tbWFuZE9wdGlvblR5cGUuVXNlcik7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogQ2hhbm5lbCBvcHRpb24gYnVpbGRlclxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFNsYXNoQ29tbWFuZENoYW5uZWxPcHRpb24gZXh0ZW5kcyBTbGFzaENvbW1hbmRPcHRpb25CdWlsZGVyIHtcclxuICBjb25zdHJ1Y3RvcigpIHtcclxuICAgIHN1cGVyKEFwcGxpY2F0aW9uQ29tbWFuZE9wdGlvblR5cGUuQ2hhbm5lbCk7XHJcbiAgfVxyXG5cclxuICBhZGRDaGFubmVsVHlwZXMoLi4udHlwZXM6IG51bWJlcltdKTogdGhpcyB7XHJcbiAgICBpZiAoIXRoaXMuZGF0YS5jaGFubmVsX3R5cGVzKSB0aGlzLmRhdGEuY2hhbm5lbF90eXBlcyA9IFtdO1xyXG4gICAgdGhpcy5kYXRhLmNoYW5uZWxfdHlwZXMucHVzaCguLi50eXBlcyk7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBSb2xlIG9wdGlvbiBidWlsZGVyXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgU2xhc2hDb21tYW5kUm9sZU9wdGlvbiBleHRlbmRzIFNsYXNoQ29tbWFuZE9wdGlvbkJ1aWxkZXIge1xyXG4gIGNvbnN0cnVjdG9yKCkge1xyXG4gICAgc3VwZXIoQXBwbGljYXRpb25Db21tYW5kT3B0aW9uVHlwZS5Sb2xlKTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBNZW50aW9uYWJsZSBvcHRpb24gYnVpbGRlclxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFNsYXNoQ29tbWFuZE1lbnRpb25hYmxlT3B0aW9uIGV4dGVuZHMgU2xhc2hDb21tYW5kT3B0aW9uQnVpbGRlciB7XHJcbiAgY29uc3RydWN0b3IoKSB7XHJcbiAgICBzdXBlcihBcHBsaWNhdGlvbkNvbW1hbmRPcHRpb25UeXBlLk1lbnRpb25hYmxlKTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBdHRhY2htZW50IG9wdGlvbiBidWlsZGVyXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgU2xhc2hDb21tYW5kQXR0YWNobWVudE9wdGlvbiBleHRlbmRzIFNsYXNoQ29tbWFuZE9wdGlvbkJ1aWxkZXIge1xyXG4gIGNvbnN0cnVjdG9yKCkge1xyXG4gICAgc3VwZXIoQXBwbGljYXRpb25Db21tYW5kT3B0aW9uVHlwZS5BdHRhY2htZW50KTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBIGJ1aWxkZXIgZm9yIGNyZWF0aW5nIHNsYXNoIGNvbW1hbmRzXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgU2xhc2hDb21tYW5kQnVpbGRlciB7XHJcbiAgcHVibGljIHJlYWRvbmx5IGRhdGE6IFBhcnRpYWw8QVBJQXBwbGljYXRpb25Db21tYW5kPjtcclxuXHJcbiAgY29uc3RydWN0b3IoKSB7XHJcbiAgICB0aGlzLmRhdGEgPSB7IG9wdGlvbnM6IFtdIH07XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZXRzIHRoZSBuYW1lIG9mIHRoaXMgY29tbWFuZFxyXG4gICAqIEBwYXJhbSBuYW1lIFRoZSBuYW1lXHJcbiAgICovXHJcbiAgc2V0TmFtZShuYW1lOiBzdHJpbmcpOiB0aGlzIHtcclxuICAgIHRoaXMuZGF0YS5uYW1lID0gbmFtZTtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2V0cyB0aGUgZGVzY3JpcHRpb24gb2YgdGhpcyBjb21tYW5kXHJcbiAgICogQHBhcmFtIGRlc2NyaXB0aW9uIFRoZSBkZXNjcmlwdGlvblxyXG4gICAqL1xyXG4gIHNldERlc2NyaXB0aW9uKGRlc2NyaXB0aW9uOiBzdHJpbmcpOiB0aGlzIHtcclxuICAgIHRoaXMuZGF0YS5kZXNjcmlwdGlvbiA9IGRlc2NyaXB0aW9uO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZXRzIHRoZSBkZWZhdWx0IG1lbWJlciBwZXJtaXNzaW9ucyByZXF1aXJlZCB0byB1c2UgdGhpcyBjb21tYW5kXHJcbiAgICogQHBhcmFtIHBlcm1pc3Npb25zIFRoZSBwZXJtaXNzaW9uc1xyXG4gICAqL1xyXG4gIHNldERlZmF1bHRNZW1iZXJQZXJtaXNzaW9ucyhwZXJtaXNzaW9uczogYmlnaW50IHwgc3RyaW5nIHwgbnVsbCk6IHRoaXMge1xyXG4gICAgdGhpcy5kYXRhLmRlZmF1bHRfbWVtYmVyX3Blcm1pc3Npb25zID0gcGVybWlzc2lvbnMgPT09IG51bGwgXHJcbiAgICAgID8gdW5kZWZpbmVkIFxyXG4gICAgICA6IFN0cmluZyhwZXJtaXNzaW9ucyk7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldHMgd2hldGhlciB0aGlzIGNvbW1hbmQgaXMgYXZhaWxhYmxlIGluIERNc1xyXG4gICAqIEBwYXJhbSBlbmFibGVkIFdoZXRoZXIgdGhlIGNvbW1hbmQgaXMgYXZhaWxhYmxlIGluIERNc1xyXG4gICAqL1xyXG4gIHNldERNUGVybWlzc2lvbihlbmFibGVkOiBib29sZWFuKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEuZG1fcGVybWlzc2lvbiA9IGVuYWJsZWQ7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldHMgd2hldGhlciB0aGlzIGNvbW1hbmQgaXMgTlNGV1xyXG4gICAqIEBwYXJhbSBuc2Z3IFdoZXRoZXIgdGhlIGNvbW1hbmQgaXMgTlNGV1xyXG4gICAqL1xyXG4gIHNldE5TRlcobnNmdyA9IHRydWUpOiB0aGlzIHtcclxuICAgIHRoaXMuZGF0YS5uc2Z3ID0gbnNmdztcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRkcyBhIHN0cmluZyBvcHRpb25cclxuICAgKi9cclxuICBhZGRTdHJpbmdPcHRpb24oZm46IChvcHRpb246IFNsYXNoQ29tbWFuZFN0cmluZ09wdGlvbikgPT4gU2xhc2hDb21tYW5kU3RyaW5nT3B0aW9uKTogdGhpcyB7XHJcbiAgICBjb25zdCBvcHRpb24gPSBmbihuZXcgU2xhc2hDb21tYW5kU3RyaW5nT3B0aW9uKCkpO1xyXG4gICAgdGhpcy5kYXRhLm9wdGlvbnMhLnB1c2gob3B0aW9uLnRvSlNPTigpKTtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRkcyBhbiBpbnRlZ2VyIG9wdGlvblxyXG4gICAqL1xyXG4gIGFkZEludGVnZXJPcHRpb24oZm46IChvcHRpb246IFNsYXNoQ29tbWFuZEludGVnZXJPcHRpb24pID0+IFNsYXNoQ29tbWFuZEludGVnZXJPcHRpb24pOiB0aGlzIHtcclxuICAgIGNvbnN0IG9wdGlvbiA9IGZuKG5ldyBTbGFzaENvbW1hbmRJbnRlZ2VyT3B0aW9uKCkpO1xyXG4gICAgdGhpcy5kYXRhLm9wdGlvbnMhLnB1c2gob3B0aW9uLnRvSlNPTigpKTtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRkcyBhIG51bWJlciBvcHRpb25cclxuICAgKi9cclxuICBhZGROdW1iZXJPcHRpb24oZm46IChvcHRpb246IFNsYXNoQ29tbWFuZE51bWJlck9wdGlvbikgPT4gU2xhc2hDb21tYW5kTnVtYmVyT3B0aW9uKTogdGhpcyB7XHJcbiAgICBjb25zdCBvcHRpb24gPSBmbihuZXcgU2xhc2hDb21tYW5kTnVtYmVyT3B0aW9uKCkpO1xyXG4gICAgdGhpcy5kYXRhLm9wdGlvbnMhLnB1c2gob3B0aW9uLnRvSlNPTigpKTtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRkcyBhIGJvb2xlYW4gb3B0aW9uXHJcbiAgICovXHJcbiAgYWRkQm9vbGVhbk9wdGlvbihmbjogKG9wdGlvbjogU2xhc2hDb21tYW5kQm9vbGVhbk9wdGlvbikgPT4gU2xhc2hDb21tYW5kQm9vbGVhbk9wdGlvbik6IHRoaXMge1xyXG4gICAgY29uc3Qgb3B0aW9uID0gZm4obmV3IFNsYXNoQ29tbWFuZEJvb2xlYW5PcHRpb24oKSk7XHJcbiAgICB0aGlzLmRhdGEub3B0aW9ucyEucHVzaChvcHRpb24udG9KU09OKCkpO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBZGRzIGEgdXNlciBvcHRpb25cclxuICAgKi9cclxuICBhZGRVc2VyT3B0aW9uKGZuOiAob3B0aW9uOiBTbGFzaENvbW1hbmRVc2VyT3B0aW9uKSA9PiBTbGFzaENvbW1hbmRVc2VyT3B0aW9uKTogdGhpcyB7XHJcbiAgICBjb25zdCBvcHRpb24gPSBmbihuZXcgU2xhc2hDb21tYW5kVXNlck9wdGlvbigpKTtcclxuICAgIHRoaXMuZGF0YS5vcHRpb25zIS5wdXNoKG9wdGlvbi50b0pTT04oKSk7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEFkZHMgYSBjaGFubmVsIG9wdGlvblxyXG4gICAqL1xyXG4gIGFkZENoYW5uZWxPcHRpb24oZm46IChvcHRpb246IFNsYXNoQ29tbWFuZENoYW5uZWxPcHRpb24pID0+IFNsYXNoQ29tbWFuZENoYW5uZWxPcHRpb24pOiB0aGlzIHtcclxuICAgIGNvbnN0IG9wdGlvbiA9IGZuKG5ldyBTbGFzaENvbW1hbmRDaGFubmVsT3B0aW9uKCkpO1xyXG4gICAgdGhpcy5kYXRhLm9wdGlvbnMhLnB1c2gob3B0aW9uLnRvSlNPTigpKTtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRkcyBhIHJvbGUgb3B0aW9uXHJcbiAgICovXHJcbiAgYWRkUm9sZU9wdGlvbihmbjogKG9wdGlvbjogU2xhc2hDb21tYW5kUm9sZU9wdGlvbikgPT4gU2xhc2hDb21tYW5kUm9sZU9wdGlvbik6IHRoaXMge1xyXG4gICAgY29uc3Qgb3B0aW9uID0gZm4obmV3IFNsYXNoQ29tbWFuZFJvbGVPcHRpb24oKSk7XHJcbiAgICB0aGlzLmRhdGEub3B0aW9ucyEucHVzaChvcHRpb24udG9KU09OKCkpO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBZGRzIGEgbWVudGlvbmFibGUgb3B0aW9uXHJcbiAgICovXHJcbiAgYWRkTWVudGlvbmFibGVPcHRpb24oZm46IChvcHRpb246IFNsYXNoQ29tbWFuZE1lbnRpb25hYmxlT3B0aW9uKSA9PiBTbGFzaENvbW1hbmRNZW50aW9uYWJsZU9wdGlvbik6IHRoaXMge1xyXG4gICAgY29uc3Qgb3B0aW9uID0gZm4obmV3IFNsYXNoQ29tbWFuZE1lbnRpb25hYmxlT3B0aW9uKCkpO1xyXG4gICAgdGhpcy5kYXRhLm9wdGlvbnMhLnB1c2gob3B0aW9uLnRvSlNPTigpKTtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRkcyBhbiBhdHRhY2htZW50IG9wdGlvblxyXG4gICAqL1xyXG4gIGFkZEF0dGFjaG1lbnRPcHRpb24oZm46IChvcHRpb246IFNsYXNoQ29tbWFuZEF0dGFjaG1lbnRPcHRpb24pID0+IFNsYXNoQ29tbWFuZEF0dGFjaG1lbnRPcHRpb24pOiB0aGlzIHtcclxuICAgIGNvbnN0IG9wdGlvbiA9IGZuKG5ldyBTbGFzaENvbW1hbmRBdHRhY2htZW50T3B0aW9uKCkpO1xyXG4gICAgdGhpcy5kYXRhLm9wdGlvbnMhLnB1c2gob3B0aW9uLnRvSlNPTigpKTtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmV0dXJucyB0aGUgSlNPTiByZXByZXNlbnRhdGlvbiBvZiB0aGlzIGNvbW1hbmRcclxuICAgKi9cclxuICB0b0pTT04oKTogQVBJQXBwbGljYXRpb25Db21tYW5kIHtcclxuICAgIHJldHVybiB7IC4uLnRoaXMuZGF0YSB9IGFzIEFQSUFwcGxpY2F0aW9uQ29tbWFuZDtcclxuICB9XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IFNsYXNoQ29tbWFuZEJ1aWxkZXI7XHJcbiJdfQ==