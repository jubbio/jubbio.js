"use strict";
/**
 * SelectMenuBuilder for creating select menus
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelSelectMenuBuilder = exports.MentionableSelectMenuBuilder = exports.RoleSelectMenuBuilder = exports.UserSelectMenuBuilder = exports.SelectMenuType = exports.SelectMenuBuilder = exports.StringSelectMenuOptionBuilder = exports.StringSelectMenuBuilder = void 0;
/**
 * A builder for creating string select menus
 */
class StringSelectMenuBuilder {
    data;
    constructor(data = {}) {
        this.data = { type: 3, ...data };
        if (!this.data.options)
            this.data.options = [];
    }
    /**
     * Sets the custom ID of this select menu
     * @param customId The custom ID
     */
    setCustomId(customId) {
        this.data.custom_id = customId;
        return this;
    }
    /**
     * Sets the placeholder of this select menu
     * @param placeholder The placeholder
     */
    setPlaceholder(placeholder) {
        this.data.placeholder = placeholder;
        return this;
    }
    /**
     * Sets the minimum values of this select menu
     * @param minValues The minimum values
     */
    setMinValues(minValues) {
        this.data.min_values = minValues;
        return this;
    }
    /**
     * Sets the maximum values of this select menu
     * @param maxValues The maximum values
     */
    setMaxValues(maxValues) {
        this.data.max_values = maxValues;
        return this;
    }
    /**
     * Sets whether this select menu is disabled
     * @param disabled Whether the select menu is disabled
     */
    setDisabled(disabled = true) {
        this.data.disabled = disabled;
        return this;
    }
    /**
     * Adds options to this select menu
     * Accepts individual options or an array of options
     */
    addOptions(...options) {
        if (!this.data.options)
            this.data.options = [];
        for (const opt of options) {
            if (Array.isArray(opt)) {
                this.data.options.push(...opt.map(option => option instanceof StringSelectMenuOptionBuilder ? option.toJSON() : option));
            }
            else {
                this.data.options.push(opt instanceof StringSelectMenuOptionBuilder ? opt.toJSON() : opt);
            }
        }
        return this;
    }
    /**
     * Sets the options of this select menu
     * Accepts individual options or an array of options
     */
    setOptions(...options) {
        this.data.options = [];
        for (const opt of options) {
            if (Array.isArray(opt)) {
                this.data.options.push(...opt.map(option => option instanceof StringSelectMenuOptionBuilder ? option.toJSON() : option));
            }
            else {
                this.data.options.push(opt instanceof StringSelectMenuOptionBuilder ? opt.toJSON() : opt);
            }
        }
        return this;
    }
    /**
     * Removes, replaces, or inserts options
     * @param index The index to start at
     * @param deleteCount The number of options to remove
     * @param options The options to insert
     */
    spliceOptions(index, deleteCount, ...options) {
        if (!this.data.options)
            this.data.options = [];
        this.data.options.splice(index, deleteCount, ...options);
        return this;
    }
    /**
     * Returns the JSON representation of this select menu
     */
    toJSON() {
        return { ...this.data };
    }
    /**
     * Creates a new select menu builder from existing data
     * @param other The select menu data to copy
     */
    static from(other) {
        return new StringSelectMenuBuilder(other instanceof StringSelectMenuBuilder ? other.data : other);
    }
}
exports.StringSelectMenuBuilder = StringSelectMenuBuilder;
exports.SelectMenuBuilder = StringSelectMenuBuilder;
/**
 * A builder for creating select menu options
 */
class StringSelectMenuOptionBuilder {
    data;
    constructor(data = {}) {
        this.data = { ...data };
    }
    /**
     * Sets the label of this option
     * @param label The label
     */
    setLabel(label) {
        this.data.label = label;
        return this;
    }
    /**
     * Sets the value of this option
     * @param value The value
     */
    setValue(value) {
        this.data.value = value;
        return this;
    }
    /**
     * Sets the description of this option
     * @param description The description
     */
    setDescription(description) {
        this.data.description = description;
        return this;
    }
    /**
     * Sets the emoji of this option
     * @param emoji The emoji
     */
    setEmoji(emoji) {
        if (typeof emoji === 'string') {
            this.data.emoji = { name: emoji };
        }
        else {
            this.data.emoji = emoji;
        }
        return this;
    }
    /**
     * Sets whether this option is the default
     * @param isDefault Whether this option is the default
     */
    setDefault(isDefault = true) {
        this.data.default = isDefault;
        return this;
    }
    /**
     * Returns the JSON representation of this option
     */
    toJSON() {
        return { ...this.data };
    }
}
exports.StringSelectMenuOptionBuilder = StringSelectMenuOptionBuilder;
/**
 * Component types for select menus
 */
var SelectMenuType;
(function (SelectMenuType) {
    SelectMenuType[SelectMenuType["String"] = 3] = "String";
    SelectMenuType[SelectMenuType["User"] = 5] = "User";
    SelectMenuType[SelectMenuType["Role"] = 6] = "Role";
    SelectMenuType[SelectMenuType["Mentionable"] = 7] = "Mentionable";
    SelectMenuType[SelectMenuType["Channel"] = 8] = "Channel";
})(SelectMenuType || (exports.SelectMenuType = SelectMenuType = {}));
/**
 * A builder for creating user select menus
 * Users are auto-populated from the guild
 */
class UserSelectMenuBuilder {
    data;
    constructor(data = {}) {
        this.data = { type: SelectMenuType.User, ...data };
    }
    setCustomId(customId) {
        this.data.custom_id = customId;
        return this;
    }
    setPlaceholder(placeholder) {
        this.data.placeholder = placeholder;
        return this;
    }
    setMinValues(minValues) {
        this.data.min_values = minValues;
        return this;
    }
    setMaxValues(maxValues) {
        this.data.max_values = maxValues;
        return this;
    }
    setDisabled(disabled = true) {
        this.data.disabled = disabled;
        return this;
    }
    toJSON() {
        return { ...this.data };
    }
}
exports.UserSelectMenuBuilder = UserSelectMenuBuilder;
/**
 * A builder for creating role select menus
 * Roles are auto-populated from the guild
 */
class RoleSelectMenuBuilder {
    data;
    constructor(data = {}) {
        this.data = { type: SelectMenuType.Role, ...data };
    }
    setCustomId(customId) {
        this.data.custom_id = customId;
        return this;
    }
    setPlaceholder(placeholder) {
        this.data.placeholder = placeholder;
        return this;
    }
    setMinValues(minValues) {
        this.data.min_values = minValues;
        return this;
    }
    setMaxValues(maxValues) {
        this.data.max_values = maxValues;
        return this;
    }
    setDisabled(disabled = true) {
        this.data.disabled = disabled;
        return this;
    }
    toJSON() {
        return { ...this.data };
    }
}
exports.RoleSelectMenuBuilder = RoleSelectMenuBuilder;
/**
 * A builder for creating mentionable select menus (users + roles)
 */
class MentionableSelectMenuBuilder {
    data;
    constructor(data = {}) {
        this.data = { type: SelectMenuType.Mentionable, ...data };
    }
    setCustomId(customId) {
        this.data.custom_id = customId;
        return this;
    }
    setPlaceholder(placeholder) {
        this.data.placeholder = placeholder;
        return this;
    }
    setMinValues(minValues) {
        this.data.min_values = minValues;
        return this;
    }
    setMaxValues(maxValues) {
        this.data.max_values = maxValues;
        return this;
    }
    setDisabled(disabled = true) {
        this.data.disabled = disabled;
        return this;
    }
    toJSON() {
        return { ...this.data };
    }
}
exports.MentionableSelectMenuBuilder = MentionableSelectMenuBuilder;
/**
 * A builder for creating channel select menus
 * Channels are auto-populated from the guild
 */
class ChannelSelectMenuBuilder {
    data;
    constructor(data = {}) {
        this.data = { type: SelectMenuType.Channel, ...data };
    }
    setCustomId(customId) {
        this.data.custom_id = customId;
        return this;
    }
    setPlaceholder(placeholder) {
        this.data.placeholder = placeholder;
        return this;
    }
    setMinValues(minValues) {
        this.data.min_values = minValues;
        return this;
    }
    setMaxValues(maxValues) {
        this.data.max_values = maxValues;
        return this;
    }
    setDisabled(disabled = true) {
        this.data.disabled = disabled;
        return this;
    }
    /**
     * Sets the channel types that can be selected
     * @param types Array of ChannelType values
     */
    setChannelTypes(types) {
        this.data.channel_types = types;
        return this;
    }
    toJSON() {
        return { ...this.data };
    }
}
exports.ChannelSelectMenuBuilder = ChannelSelectMenuBuilder;
exports.default = StringSelectMenuBuilder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU2VsZWN0TWVudUJ1aWxkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvYnVpbGRlcnMvU2VsZWN0TWVudUJ1aWxkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOztHQUVHOzs7QUFvQkg7O0dBRUc7QUFDSCxNQUFhLHVCQUF1QjtJQUNsQixJQUFJLENBQWtDO0lBRXRELFlBQVksT0FBd0MsRUFBRTtRQUNwRCxJQUFJLENBQUMsSUFBSSxHQUFHLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxHQUFHLElBQUksRUFBRSxDQUFDO1FBQ2pDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU87WUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7SUFDakQsQ0FBQztJQUVEOzs7T0FHRztJQUNILFdBQVcsQ0FBQyxRQUFnQjtRQUMxQixJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsR0FBRyxRQUFRLENBQUM7UUFDL0IsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsY0FBYyxDQUFDLFdBQW1CO1FBQ2hDLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQztRQUNwQyxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRDs7O09BR0c7SUFDSCxZQUFZLENBQUMsU0FBaUI7UUFDNUIsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEdBQUcsU0FBUyxDQUFDO1FBQ2pDLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEOzs7T0FHRztJQUNILFlBQVksQ0FBQyxTQUFpQjtRQUM1QixJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsR0FBRyxTQUFTLENBQUM7UUFDakMsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsV0FBVyxDQUFDLFFBQVEsR0FBRyxJQUFJO1FBQ3pCLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxH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RUQsWUFBWSxDQUFDLFNBQWlCO1FBQzVCLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxHQUFHLFNBQVMsQ0FBQztRQUNqQyxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRCxZQUFZLENBQUMsU0FBaUI7UUFDNUIsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEdBQUcsU0FBUyxDQUFDO1FBQ2pDLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVELFdBQVcsQ0FBQyxRQUFRLEdBQUcsSUFBSTtRQUN6QixJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7UUFDOUIsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsZUFBZSxDQUFDLEtBQWU7UUFDN0IsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEdBQUcsS0FBSyxDQUFDO1FBQ2hDLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVELE1BQU07UUFDSixPQUFPLEVBQUUsR0FBRyxJQUFJLENBQUMsSUFBSSxFQUFnQyxDQUFDO0lBQ3hELENBQUM7Q0FDRjtBQTVDRCw0REE0Q0M7QUFFRCxrQkFBZSx1QkFBdUIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogU2VsZWN0TWVudUJ1aWxkZXIgZm9yIGNyZWF0aW5nIHNlbGVjdCBtZW51c1xuICovXG5cbmV4cG9ydCBpbnRlcmZhY2UgQVBJU2VsZWN0TWVudU9wdGlvbiB7XG4gIGxhYmVsOiBzdHJpbmc7XG4gIHZhbHVlOiBzdHJpbmc7XG4gIGRlc2NyaXB0aW9uPzogc3RyaW5nO1xuICBlbW9qaT86IHsgaWQ/OiBzdHJpbmc7IG5hbWU/OiBzdHJpbmc7IGFuaW1hdGVkPzogYm9vbGVhbiB9O1xuICBkZWZhdWx0PzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBBUElTZWxlY3RNZW51Q29tcG9uZW50IHtcbiAgdHlwZTogMztcbiAgY3VzdG9tX2lkOiBzdHJpbmc7XG4gIG9wdGlvbnM/OiBBUElTZWxlY3RNZW51T3B0aW9uW107XG4gIHBsYWNlaG9sZGVyPzogc3RyaW5nO1xuICBtaW5fdmFsdWVzPzogbnVtYmVyO1xuICBtYXhfdmFsdWVzPzogbnVtYmVyO1xuICBkaXNhYmxlZD86IGJvb2xlYW47XG59XG5cbi8qKlxuICogQSBidWlsZGVyIGZvciBjcmVhdGluZyBzdHJpbmcgc2VsZWN0IG1lbnVzXG4gKi9cbmV4cG9ydCBjbGFzcyBTdHJpbmdTZWxlY3RNZW51QnVpbGRlciB7XG4gIHB1YmxpYyByZWFkb25seSBkYXRhOiBQYXJ0aWFsPEFQSVNlbGVjdE1lbnVDb21wb25lbnQ+O1xuXG4gIGNvbnN0cnVjdG9yKGRhdGE6IFBhcnRpYWw8QVBJU2VsZWN0TWVudUNvbXBvbmVudD4gPSB7fSkge1xuICAgIHRoaXMuZGF0YSA9IHsgdHlwZTogMywgLi4uZGF0YSB9O1xuICAgIGlmICghdGhpcy5kYXRhLm9wdGlvbnMpIHRoaXMuZGF0YS5vcHRpb25zID0gW107XG4gIH1cblxuICAvKipcbiAgICogU2V0cyB0aGUgY3VzdG9tIElEIG9mIHRoaXMgc2VsZWN0IG1lbnVcbiAgICogQHBhcmFtIGN1c3RvbUlkIFRoZSBjdXN0b20gSURcbiAgICovXG4gIHNldEN1c3RvbUlkKGN1c3RvbUlkOiBzdHJpbmcpOiB0aGlzIHtcbiAgICB0aGlzLmRhdGEuY3VzdG9tX2lkID0gY3VzdG9tSWQ7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU2V0cyB0aGUgcGxhY2Vob2xkZXIgb2YgdGhpcyBzZWxlY3QgbWVudVxuICAgKiBAcGFyYW0gcGxhY2Vob2xkZXIgVGhlIHBsYWNlaG9sZGVyXG4gICAqL1xuICBzZXRQbGFjZWhvbGRlcihwbGFjZWhvbGRlcjogc3RyaW5nKTogdGhpcyB7XG4gICAgdGhpcy5kYXRhLnBsYWNlaG9sZGVyID0gcGxhY2Vob2xkZXI7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU2V0cyB0aGUgbWluaW11bSB2YWx1ZXMgb2YgdGhpcyBzZWxlY3QgbWVudVxuICAgKiBAcGFyYW0gbWluVmFsdWVzIFRoZSBtaW5pbXVtIHZhbHVlc1xuICAgKi9cbiAgc2V0TWluVmFsdWVzKG1pblZhbHVlczogbnVtYmVyKTogdGhpcyB7XG4gICAgdGhpcy5kYXRhLm1pbl92YWx1ZXMgPSBtaW5WYWx1ZXM7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU2V0cyB0aGUgbWF4aW11bSB2YWx1ZXMgb2YgdGhpcyBzZWxlY3QgbWVudVxuICAgKiBAcGFyYW0gbWF4VmFsdWVzIFRoZSBtYXhpbXVtIHZhbHVlc1xuICAgKi9cbiAgc2V0TWF4VmFsdWVzKG1heFZhbHVlczogbnVtYmVyKTogdGhpcyB7XG4gICAgdGhpcy5kYXRhLm1heF92YWx1ZXMgPSBtYXhWYWx1ZXM7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU2V0cyB3aGV0aGVyIHRoaXMgc2VsZWN0IG1lbnUgaXMgZGlzYWJsZWRcbiAgICogQHBhcmFtIGRpc2FibGVkIFdoZXRoZXIgdGhlIHNlbGVjdCBtZW51IGlzIGRpc2FibGVkXG4gICAqL1xuICBzZXREaXNhYmxlZChkaXNhYmxlZCA9IHRydWUpOiB0aGlzIHtcbiAgICB0aGlzLmRhdGEuZGlzYWJsZWQgPSBkaXNhYmxlZDtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGRzIG9wdGlvbnMgdG8gdGhpcyBzZWxlY3QgbWVudVxuICAgKiBBY2NlcHRzIGluZGl2aWR1YWwgb3B0aW9ucyBvciBhbiBhcnJheSBvZiBvcHRpb25zXG4gICAqL1xuICBhZGRPcHRpb25zKC4uLm9wdGlvbnM6IChBUElTZWxlY3RNZW51T3B0aW9uIHwgU3RyaW5nU2VsZWN0TWVudU9wdGlvbkJ1aWxkZXIgfCAoQVBJU2VsZWN0TWVudU9wdGlvbiB8IFN0cmluZ1NlbGVjdE1lbnVPcHRpb25CdWlsZGVyKVtdKVtdKTogdGhpcyB7XG4gICAgaWYgKCF0aGlzLmRhdGEub3B0aW9ucykgdGhpcy5kYXRhLm9wdGlvbnMgPSBbXTtcbiAgICBmb3IgKGNvbnN0IG9wdCBvZiBvcHRpb25zKSB7XG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShvcHQpKSB7XG4gICAgICAgIHRoaXMuZGF0YS5vcHRpb25zLnB1c2goLi4ub3B0Lm1hcChvcHRpb24gPT4gb3B0aW9uIGluc3RhbmNlb2YgU3RyaW5nU2VsZWN0TWVudU9wdGlvbkJ1aWxkZXIgPyBvcHRpb24udG9KU09OKCkgOiBvcHRpb24pKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZGF0YS5vcHRpb25zLnB1c2gob3B0IGluc3RhbmNlb2YgU3RyaW5nU2VsZWN0TWVudU9wdGlvbkJ1aWxkZXIgPyBvcHQudG9KU09OKCkgOiBvcHQpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSBvcHRpb25zIG9mIHRoaXMgc2VsZWN0IG1lbnVcbiAgICogQWNjZXB0cyBpbmRpdmlkdWFsIG9wdGlvbnMgb3IgYW4gYXJyYXkgb2Ygb3B0aW9uc1xuICAgKi9cbiAgc2V0T3B0aW9ucyguLi5vcHRpb25zOiAoQVBJU2VsZWN0TWVudU9wdGlvbiB8IFN0cmluZ1NlbGVjdE1lbnVPcHRpb25CdWlsZGVyIHwgKEFQSVNlbGVjdE1lbnVPcHRpb24gfCBTdHJpbmdTZWxlY3RNZW51T3B0aW9uQnVpbGRlcilbXSlbXSk6IHRoaXMge1xuICAgIHRoaXMuZGF0YS5vcHRpb25zID0gW107XG4gICAgZm9yIChjb25zdCBvcHQgb2Ygb3B0aW9ucykge1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkob3B0KSkge1xuICAgICAgICB0aGlzLmRhdGEub3B0aW9ucy5wdXNoKC4uLm9wdC5tYXAob3B0aW9uID0+IG9wdGlvbiBpbnN0YW5jZW9mIFN0cmluZ1NlbGVjdE1lbnVPcHRpb25CdWlsZGVyID8gb3B0aW9uLnRvSlNPTigpIDogb3B0aW9uKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmRhdGEub3B0aW9ucy5wdXNoKG9wdCBpbnN0YW5jZW9mIFN0cmluZ1NlbGVjdE1lbnVPcHRpb25CdWlsZGVyID8gb3B0LnRvSlNPTigpIDogb3B0KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlcywgcmVwbGFjZXMsIG9yIGluc2VydHMgb3B0aW9uc1xuICAgKiBAcGFyYW0gaW5kZXggVGhlIGluZGV4IHRvIHN0YXJ0IGF0XG4gICAqIEBwYXJhbSBkZWxldGVDb3VudCBUaGUgbnVtYmVyIG9mIG9wdGlvbnMgdG8gcmVtb3ZlXG4gICAqIEBwYXJhbSBvcHRpb25zIFRoZSBvcHRpb25zIHRvIGluc2VydFxuICAgKi9cbiAgc3BsaWNlT3B0aW9ucyhpbmRleDogbnVtYmVyLCBkZWxldGVDb3VudDogbnVtYmVyLCAuLi5vcHRpb25zOiBBUElTZWxlY3RNZW51T3B0aW9uW10pOiB0aGlzIHtcbiAgICBpZiAoIXRoaXMuZGF0YS5vcHRpb25zKSB0aGlzLmRhdGEub3B0aW9ucyA9IFtdO1xuICAgIHRoaXMuZGF0YS5vcHRpb25zLnNwbGljZShpbmRleCwgZGVsZXRlQ291bnQsIC4uLm9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIEpTT04gcmVwcmVzZW50YXRpb24gb2YgdGhpcyBzZWxlY3QgbWVudVxuICAgKi9cbiAgdG9KU09OKCk6IEFQSVNlbGVjdE1lbnVDb21wb25lbnQge1xuICAgIHJldHVybiB7IC4uLnRoaXMuZGF0YSB9IGFzIEFQSVNlbGVjdE1lbnVDb21wb25lbnQ7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBzZWxlY3QgbWVudSBidWlsZGVyIGZyb20gZXhpc3RpbmcgZGF0YVxuICAgKiBAcGFyYW0gb3RoZXIgVGhlIHNlbGVjdCBtZW51IGRhdGEgdG8gY29weVxuICAgKi9cbiAgc3RhdGljIGZyb20ob3RoZXI6IFBhcnRpYWw8QVBJU2VsZWN0TWVudUNvbXBvbmVudD4gfCBTdHJpbmdTZWxlY3RNZW51QnVpbGRlcik6IFN0cmluZ1NlbGVjdE1lbnVCdWlsZGVyIHtcbiAgICByZXR1cm4gbmV3IFN0cmluZ1NlbGVjdE1lbnVCdWlsZGVyKG90aGVyIGluc3RhbmNlb2YgU3RyaW5nU2VsZWN0TWVudUJ1aWxkZXIgPyBvdGhlci5kYXRhIDogb3RoZXIpO1xuICB9XG59XG5cbi8qKlxuICogQSBidWlsZGVyIGZvciBjcmVhdGluZyBzZWxlY3QgbWVudSBvcHRpb25zXG4gKi9cbmV4cG9ydCBjbGFzcyBTdHJpbmdTZWxlY3RNZW51T3B0aW9uQnVpbGRlciB7XG4gIHB1YmxpYyByZWFkb25seSBkYXRhOiBQYXJ0aWFsPEFQSVNlbGVjdE1lbnVPcHRpb24+O1xuXG4gIGNvbnN0cnVjdG9yKGRhdGE6IFBhcnRpYWw8QVBJU2VsZWN0TWVudU9wdGlvbj4gPSB7fSkge1xuICAgIHRoaXMuZGF0YSA9IHsgLi4uZGF0YSB9O1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgdGhlIGxhYmVsIG9mIHRoaXMgb3B0aW9uXG4gICAqIEBwYXJhbSBsYWJlbCBUaGUgbGFiZWxcbiAgICovXG4gIHNldExhYmVsKGxhYmVsOiBzdHJpbmcpOiB0aGlzIHtcbiAgICB0aGlzLmRhdGEubGFiZWwgPSBsYWJlbDtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSB2YWx1ZSBvZiB0aGlzIG9wdGlvblxuICAgKiBAcGFyYW0gdmFsdWUgVGhlIHZhbHVlXG4gICAqL1xuICBzZXRWYWx1ZSh2YWx1ZTogc3RyaW5nKTogdGhpcyB7XG4gICAgdGhpcy5kYXRhLnZhbHVlID0gdmFsdWU7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU2V0cyB0aGUgZGVzY3JpcHRpb24gb2YgdGhpcyBvcHRpb25cbiAgICogQHBhcmFtIGRlc2NyaXB0aW9uIFRoZSBkZXNjcmlwdGlvblxuICAgKi9cbiAgc2V0RGVzY3JpcHRpb24oZGVzY3JpcHRpb246IHN0cmluZyk6IHRoaXMge1xuICAgIHRoaXMuZGF0YS5kZXNjcmlwdGlvbiA9IGRlc2NyaXB0aW9uO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgdGhlIGVtb2ppIG9mIHRoaXMgb3B0aW9uXG4gICAqIEBwYXJhbSBlbW9qaSBUaGUgZW1vamlcbiAgICovXG4gIHNldEVtb2ppKGVtb2ppOiB7IGlkPzogc3RyaW5nOyBuYW1lPzogc3RyaW5nOyBhbmltYXRlZD86IGJvb2xlYW4gfSB8IHN0cmluZyk6IHRoaXMge1xuICAgIGlmICh0eXBlb2YgZW1vamkgPT09ICdzdHJpbmcnKSB7XG4gICAgICB0aGlzLmRhdGEuZW1vamkgPSB7IG5hbWU6IGVtb2ppIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZGF0YS5lbW9qaSA9IGVtb2ppO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHdoZXRoZXIgdGhpcyBvcHRpb24gaXMgdGhlIGRlZmF1bHRcbiAgICogQHBhcmFtIGlzRGVmYXVsdCBXaGV0aGVyIHRoaXMgb3B0aW9uIGlzIHRoZSBkZWZhdWx0XG4gICAqL1xuICBzZXREZWZhdWx0KGlzRGVmYXVsdCA9IHRydWUpOiB0aGlzIHtcbiAgICB0aGlzLmRhdGEuZGVmYXVsdCA9IGlzRGVmYXVsdDtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBKU09OIHJlcHJlc2VudGF0aW9uIG9mIHRoaXMgb3B0aW9uXG4gICAqL1xuICB0b0pTT04oKTogQVBJU2VsZWN0TWVudU9wdGlvbiB7XG4gICAgcmV0dXJuIHsgLi4udGhpcy5kYXRhIH0gYXMgQVBJU2VsZWN0TWVudU9wdGlvbjtcbiAgfVxufVxuXG4vLyBBbGlhcyBmb3IgREpTIGNvbXBhdGliaWxpdHlcbmV4cG9ydCB7IFN0cmluZ1NlbGVjdE1lbnVCdWlsZGVyIGFzIFNlbGVjdE1lbnVCdWlsZGVyIH07XG5cbi8qKlxuICogQ29tcG9uZW50IHR5cGVzIGZvciBzZWxlY3QgbWVudXNcbiAqL1xuZXhwb3J0IGVudW0gU2VsZWN0TWVudVR5cGUge1xuICBTdHJpbmcgPSAzLFxuICBVc2VyID0gNSxcbiAgUm9sZSA9IDYsXG4gIE1lbnRpb25hYmxlID0gNyxcbiAgQ2hhbm5lbCA9IDgsXG59XG5cbi8qKlxuICogQmFzZSBpbnRlcmZhY2UgZm9yIGF1dG8tcG9wdWxhdGVkIHNlbGVjdCBtZW51cyAoVXNlciwgUm9sZSwgTWVudGlvbmFibGUsIENoYW5uZWwpXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQVBJQXV0b1NlbGVjdE1lbnVDb21wb25lbnQge1xuICB0eXBlOiA1IHwgNiB8IDcgfCA4O1xuICBjdXN0b21faWQ6IHN0cmluZztcbiAgcGxhY2Vob2xkZXI/OiBzdHJpbmc7XG4gIG1pbl92YWx1ZXM/OiBudW1iZXI7XG4gIG1heF92YWx1ZXM/OiBudW1iZXI7XG4gIGRpc2FibGVkPzogYm9vbGVhbjtcbiAgLyoqIENoYW5uZWwgdHlwZXMgdG8gaW5jbHVkZSAob25seSBmb3IgQ2hhbm5lbFNlbGVjdE1lbnUpICovXG4gIGNoYW5uZWxfdHlwZXM/OiBudW1iZXJbXTtcbn1cblxuLyoqXG4gKiBBIGJ1aWxkZXIgZm9yIGNyZWF0aW5nIHVzZXIgc2VsZWN0IG1lbnVzXG4gKiBVc2VycyBhcmUgYXV0by1wb3B1bGF0ZWQgZnJvbSB0aGUgZ3VpbGRcbiAqL1xuZXhwb3J0IGNsYXNzIFVzZXJTZWxlY3RNZW51QnVpbGRlciB7XG4gIHB1YmxpYyByZWFkb25seSBkYXRhOiBQYXJ0aWFsPEFQSUF1dG9TZWxlY3RNZW51Q29tcG9uZW50PjtcblxuICBjb25zdHJ1Y3RvcihkYXRhOiBQYXJ0aWFsPEFQSUF1dG9TZWxlY3RNZW51Q29tcG9uZW50PiA9IHt9KSB7XG4gICAgdGhpcy5kYXRhID0geyB0eXBlOiBTZWxlY3RNZW51VHlwZS5Vc2VyLCAuLi5kYXRhIH07XG4gIH1cblxuICBzZXRDdXN0b21JZChjdXN0b21JZDogc3RyaW5nKTogdGhpcyB7XG4gICAgdGhpcy5kYXRhLmN1c3RvbV9pZCA9IGN1c3RvbUlkO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgc2V0UGxhY2Vob2xkZXIocGxhY2Vob2xkZXI6IHN0cmluZyk6IHRoaXMge1xuICAgIHRoaXMuZGF0YS5wbGFjZWhvbGRlciA9IHBsYWNlaG9sZGVyO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgc2V0TWluVmFsdWVzKG1pblZhbHVlczogbnVtYmVyKTogdGhpcyB7XG4gICAgdGhpcy5kYXRhLm1pbl92YWx1ZXMgPSBtaW5WYWx1ZXM7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBzZXRNYXhWYWx1ZXMobWF4VmFsdWVzOiBudW1iZXIpOiB0aGlzIHtcbiAgICB0aGlzLmRhdGEubWF4X3ZhbHVlcyA9IG1heFZhbHVlcztcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHNldERpc2FibGVkKGRpc2FibGVkID0gdHJ1ZSk6IHRoaXMge1xuICAgIHRoaXMuZGF0YS5kaXNhYmxlZCA9IGRpc2FibGVkO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgdG9KU09OKCk6IEFQSUF1dG9TZWxlY3RNZW51Q29tcG9uZW50IHtcbiAgICByZXR1cm4geyAuLi50aGlzLmRhdGEgfSBhcyBBUElBdXRvU2VsZWN0TWVudUNvbXBvbmVudDtcbiAgfVxufVxuXG4vKipcbiAqIEEgYnVpbGRlciBmb3IgY3JlYXRpbmcgcm9sZSBzZWxlY3QgbWVudXNcbiAqIFJvbGVzIGFyZSBhdXRvLXBvcHVsYXRlZCBmcm9tIHRoZSBndWlsZFxuICovXG5leHBvcnQgY2xhc3MgUm9sZVNlbGVjdE1lbnVCdWlsZGVyIHtcbiAgcHVibGljIHJlYWRvbmx5IGRhdGE6IFBhcnRpYWw8QVBJQXV0b1NlbGVjdE1lbnVDb21wb25lbnQ+O1xuXG4gIGNvbnN0cnVjdG9yKGRhdGE6IFBhcnRpYWw8QVBJQXV0b1NlbGVjdE1lbnVDb21wb25lbnQ+ID0ge30pIHtcbiAgICB0aGlzLmRhdGEgPSB7IHR5cGU6IFNlbGVjdE1lbnVUeXBlLlJvbGUsIC4uLmRhdGEgfTtcbiAgfVxuXG4gIHNldEN1c3RvbUlkKGN1c3RvbUlkOiBzdHJpbmcpOiB0aGlzIHtcbiAgICB0aGlzLmRhdGEuY3VzdG9tX2lkID0gY3VzdG9tSWQ7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBzZXRQbGFjZWhvbGRlcihwbGFjZWhvbGRlcjogc3RyaW5nKTogdGhpcyB7XG4gICAgdGhpcy5kYXRhLnBsYWNlaG9sZGVyID0gcGxhY2Vob2xkZXI7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBzZXRNaW5WYWx1ZXMobWluVmFsdWVzOiBudW1iZXIpOiB0aGlzIHtcbiAgICB0aGlzLmRhdGEubWluX3ZhbHVlcyA9IG1pblZhbHVlcztcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHNldE1heFZhbHVlcyhtYXhWYWx1ZXM6IG51bWJlcik6IHRoaXMge1xuICAgIHRoaXMuZGF0YS5tYXhfdmFsdWVzID0gbWF4VmFsdWVzO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgc2V0RGlzYWJsZWQoZGlzYWJsZWQgPSB0cnVlKTogdGhpcyB7XG4gICAgdGhpcy5kYXRhLmRpc2FibGVkID0gZGlzYWJsZWQ7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICB0b0pTT04oKTogQVBJQXV0b1NlbGVjdE1lbnVDb21wb25lbnQge1xuICAgIHJldHVybiB7IC4uLnRoaXMuZGF0YSB9IGFzIEFQSUF1dG9TZWxlY3RNZW51Q29tcG9uZW50O1xuICB9XG59XG5cbi8qKlxuICogQSBidWlsZGVyIGZvciBjcmVhdGluZyBtZW50aW9uYWJsZSBzZWxlY3QgbWVudXMgKHVzZXJzICsgcm9sZXMpXG4gKi9cbmV4cG9ydCBjbGFzcyBNZW50aW9uYWJsZVNlbGVjdE1lbnVCdWlsZGVyIHtcbiAgcHVibGljIHJlYWRvbmx5IGRhdGE6IFBhcnRpYWw8QVBJQXV0b1NlbGVjdE1lbnVDb21wb25lbnQ+O1xuXG4gIGNvbnN0cnVjdG9yKGRhdGE6IFBhcnRpYWw8QVBJQXV0b1NlbGVjdE1lbnVDb21wb25lbnQ+ID0ge30pIHtcbiAgICB0aGlzLmRhdGEgPSB7IHR5cGU6IFNlbGVjdE1lbnVUeXBlLk1lbnRpb25hYmxlLCAuLi5kYXRhIH07XG4gIH1cblxuICBzZXRDdXN0b21JZChjdXN0b21JZDogc3RyaW5nKTogdGhpcyB7XG4gICAgdGhpcy5kYXRhLmN1c3RvbV9pZCA9IGN1c3RvbUlkO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgc2V0UGxhY2Vob2xkZXIocGxhY2Vob2xkZXI6IHN0cmluZyk6IHRoaXMge1xuICAgIHRoaXMuZGF0YS5wbGFjZWhvbGRlciA9IHBsYWNlaG9sZGVyO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgc2V0TWluVmFsdWVzKG1pblZhbHVlczogbnVtYmVyKTogdGhpcyB7XG4gICAgdGhpcy5kYXRhLm1pbl92YWx1ZXMgPSBtaW5WYWx1ZXM7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBzZXRNYXhWYWx1ZXMobWF4VmFsdWVzOiBudW1iZXIpOiB0aGlzIHtcbiAgICB0aGlzLmRhdGEubWF4X3ZhbHVlcyA9IG1heFZhbHVlcztcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHNldERpc2FibGVkKGRpc2FibGVkID0gdHJ1ZSk6IHRoaXMge1xuICAgIHRoaXMuZGF0YS5kaXNhYmxlZCA9IGRpc2FibGVkO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgdG9KU09OKCk6IEFQSUF1dG9TZWxlY3RNZW51Q29tcG9uZW50IHtcbiAgICByZXR1cm4geyAuLi50aGlzLmRhdGEgfSBhcyBBUElBdXRvU2VsZWN0TWVudUNvbXBvbmVudDtcbiAgfVxufVxuXG4vKipcbiAqIEEgYnVpbGRlciBmb3IgY3JlYXRpbmcgY2hhbm5lbCBzZWxlY3QgbWVudXNcbiAqIENoYW5uZWxzIGFyZSBhdXRvLXBvcHVsYXRlZCBmcm9tIHRoZSBndWlsZFxuICovXG5leHBvcnQgY2xhc3MgQ2hhbm5lbFNlbGVjdE1lbnVCdWlsZGVyIHtcbiAgcHVibGljIHJlYWRvbmx5IGRhdGE6IFBhcnRpYWw8QVBJQXV0b1NlbGVjdE1lbnVDb21wb25lbnQ+O1xuXG4gIGNvbnN0cnVjdG9yKGRhdGE6IFBhcnRpYWw8QVBJQXV0b1NlbGVjdE1lbnVDb21wb25lbnQ+ID0ge30pIHtcbiAgICB0aGlzLmRhdGEgPSB7IHR5cGU6IFNlbGVjdE1lbnVUeXBlLkNoYW5uZWwsIC4uLmRhdGEgfTtcbiAgfVxuXG4gIHNldEN1c3RvbUlkKGN1c3RvbUlkOiBzdHJpbmcpOiB0aGlzIHtcbiAgICB0aGlzLmRhdGEuY3VzdG9tX2lkID0gY3VzdG9tSWQ7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBzZXRQbGFjZWhvbGRlcihwbGFjZWhvbGRlcjogc3RyaW5nKTogdGhpcyB7XG4gICAgdGhpcy5kYXRhLnBsYWNlaG9sZGVyID0gcGxhY2Vob2xkZXI7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBzZXRNaW5WYWx1ZXMobWluVmFsdWVzOiBudW1iZXIpOiB0aGlzIHtcbiAgICB0aGlzLmRhdGEubWluX3ZhbHVlcyA9IG1pblZhbHVlcztcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHNldE1heFZhbHVlcyhtYXhWYWx1ZXM6IG51bWJlcik6IHRoaXMge1xuICAgIHRoaXMuZGF0YS5tYXhfdmFsdWVzID0gbWF4VmFsdWVzO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgc2V0RGlzYWJsZWQoZGlzYWJsZWQgPSB0cnVlKTogdGhpcyB7XG4gICAgdGhpcy5kYXRhLmRpc2FibGVkID0gZGlzYWJsZWQ7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU2V0cyB0aGUgY2hhbm5lbCB0eXBlcyB0aGF0IGNhbiBiZSBzZWxlY3RlZFxuICAgKiBAcGFyYW0gdHlwZXMgQXJyYXkgb2YgQ2hhbm5lbFR5cGUgdmFsdWVzXG4gICAqL1xuICBzZXRDaGFubmVsVHlwZXModHlwZXM6IG51bWJlcltdKTogdGhpcyB7XG4gICAgdGhpcy5kYXRhLmNoYW5uZWxfdHlwZXMgPSB0eXBlcztcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHRvSlNPTigpOiBBUElBdXRvU2VsZWN0TWVudUNvbXBvbmVudCB7XG4gICAgcmV0dXJuIHsgLi4udGhpcy5kYXRhIH0gYXMgQVBJQXV0b1NlbGVjdE1lbnVDb21wb25lbnQ7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgU3RyaW5nU2VsZWN0TWVudUJ1aWxkZXI7XG4iXX0=