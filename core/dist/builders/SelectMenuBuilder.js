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
                this.data.options.push(...opt);
            }
            else {
                this.data.options.push(opt);
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
                this.data.options.push(...opt);
            }
            else {
                this.data.options.push(opt);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU2VsZWN0TWVudUJ1aWxkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvYnVpbGRlcnMvU2VsZWN0TWVudUJ1aWxkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOztHQUVHOzs7QUFvQkg7O0dBRUc7QUFDSCxNQUFhLHVCQUF1QjtJQUNsQixJQUFJLENBQWtDO0lBRXRELFlBQVksT0FBd0MsRUFBRTtRQUNwRCxJQUFJLENBQUMsSUFBSSxHQUFHLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxHQUFHLElBQUksRUFBRSxDQUFDO1FBQ2pDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU87WUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7SUFDakQsQ0FBQztJQUVEOzs7T0FHRztJQUNILFdBQVcsQ0FBQyxRQUFnQjtRQUMxQixJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsR0FBRyxRQUFRLENBQUM7UUFDL0IsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsY0FBYyxDQUFDLFdBQW1CO1FBQ2hDLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQztRQUNwQyxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRDs7O09BR0c7SUFDSCxZQUFZLENBQUMsU0FBaUI7UUFDNUIsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEdBQUcsU0FBUyxDQUFDO1FBQ2pDLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEOzs7T0FHRztJQUNILFlBQVksQ0FBQyxTQUFpQjtRQUM1QixJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsR0FBRyxTQUFTLENBQUM7UUFDakMsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsV0FBVyxDQUFDLFFBQVEsR0FBRyxJQUFJO1FBQ3pCLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxH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LGFBQWEsR0FBRyxLQUFLLENBQUM7UUFDaEMsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQsTUFBTTtRQUNKLE9BQU8sRUFBRSxHQUFHLElBQUksQ0FBQyxJQUFJLEVBQWdDLENBQUM7SUFDeEQsQ0FBQztDQUNGO0FBNUNELDREQTRDQztBQUVELGtCQUFlLHVCQUF1QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIFNlbGVjdE1lbnVCdWlsZGVyIGZvciBjcmVhdGluZyBzZWxlY3QgbWVudXNcclxuICovXHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEFQSVNlbGVjdE1lbnVPcHRpb24ge1xyXG4gIGxhYmVsOiBzdHJpbmc7XHJcbiAgdmFsdWU6IHN0cmluZztcclxuICBkZXNjcmlwdGlvbj86IHN0cmluZztcclxuICBlbW9qaT86IHsgaWQ/OiBzdHJpbmc7IG5hbWU/OiBzdHJpbmc7IGFuaW1hdGVkPzogYm9vbGVhbiB9O1xyXG4gIGRlZmF1bHQ/OiBib29sZWFuO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEFQSVNlbGVjdE1lbnVDb21wb25lbnQge1xyXG4gIHR5cGU6IDM7XHJcbiAgY3VzdG9tX2lkOiBzdHJpbmc7XHJcbiAgb3B0aW9ucz86IEFQSVNlbGVjdE1lbnVPcHRpb25bXTtcclxuICBwbGFjZWhvbGRlcj86IHN0cmluZztcclxuICBtaW5fdmFsdWVzPzogbnVtYmVyO1xyXG4gIG1heF92YWx1ZXM/OiBudW1iZXI7XHJcbiAgZGlzYWJsZWQ/OiBib29sZWFuO1xyXG59XHJcblxyXG4vKipcclxuICogQSBidWlsZGVyIGZvciBjcmVhdGluZyBzdHJpbmcgc2VsZWN0IG1lbnVzXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgU3RyaW5nU2VsZWN0TWVudUJ1aWxkZXIge1xyXG4gIHB1YmxpYyByZWFkb25seSBkYXRhOiBQYXJ0aWFsPEFQSVNlbGVjdE1lbnVDb21wb25lbnQ+O1xyXG5cclxuICBjb25zdHJ1Y3RvcihkYXRhOiBQYXJ0aWFsPEFQSVNlbGVjdE1lbnVDb21wb25lbnQ+ID0ge30pIHtcclxuICAgIHRoaXMuZGF0YSA9IHsgdHlwZTogMywgLi4uZGF0YSB9O1xyXG4gICAgaWYgKCF0aGlzLmRhdGEub3B0aW9ucykgdGhpcy5kYXRhLm9wdGlvbnMgPSBbXTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldHMgdGhlIGN1c3RvbSBJRCBvZiB0aGlzIHNlbGVjdCBtZW51XHJcbiAgICogQHBhcmFtIGN1c3RvbUlkIFRoZSBjdXN0b20gSURcclxuICAgKi9cclxuICBzZXRDdXN0b21JZChjdXN0b21JZDogc3RyaW5nKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEuY3VzdG9tX2lkID0gY3VzdG9tSWQ7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldHMgdGhlIHBsYWNlaG9sZGVyIG9mIHRoaXMgc2VsZWN0IG1lbnVcclxuICAgKiBAcGFyYW0gcGxhY2Vob2xkZXIgVGhlIHBsYWNlaG9sZGVyXHJcbiAgICovXHJcbiAgc2V0UGxhY2Vob2xkZXIocGxhY2Vob2xkZXI6IHN0cmluZyk6IHRoaXMge1xyXG4gICAgdGhpcy5kYXRhLnBsYWNlaG9sZGVyID0gcGxhY2Vob2xkZXI7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldHMgdGhlIG1pbmltdW0gdmFsdWVzIG9mIHRoaXMgc2VsZWN0IG1lbnVcclxuICAgKiBAcGFyYW0gbWluVmFsdWVzIFRoZSBtaW5pbXVtIHZhbHVlc1xyXG4gICAqL1xyXG4gIHNldE1pblZhbHVlcyhtaW5WYWx1ZXM6IG51bWJlcik6IHRoaXMge1xyXG4gICAgdGhpcy5kYXRhLm1pbl92YWx1ZXMgPSBtaW5WYWx1ZXM7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldHMgdGhlIG1heGltdW0gdmFsdWVzIG9mIHRoaXMgc2VsZWN0IG1lbnVcclxuICAgKiBAcGFyYW0gbWF4VmFsdWVzIFRoZSBtYXhpbXVtIHZhbHVlc1xyXG4gICAqL1xyXG4gIHNldE1heFZhbHVlcyhtYXhWYWx1ZXM6IG51bWJlcik6IHRoaXMge1xyXG4gICAgdGhpcy5kYXRhLm1heF92YWx1ZXMgPSBtYXhWYWx1ZXM7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldHMgd2hldGhlciB0aGlzIHNlbGVjdCBtZW51IGlzIGRpc2FibGVkXHJcbiAgICogQHBhcmFtIGRpc2FibGVkIFdoZXRoZXIgdGhlIHNlbGVjdCBtZW51IGlzIGRpc2FibGVkXHJcbiAgICovXHJcbiAgc2V0RGlzYWJsZWQoZGlzYWJsZWQgPSB0cnVlKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEuZGlzYWJsZWQgPSBkaXNhYmxlZDtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRkcyBvcHRpb25zIHRvIHRoaXMgc2VsZWN0IG1lbnVcclxuICAgKiBBY2NlcHRzIGluZGl2aWR1YWwgb3B0aW9ucyBvciBhbiBhcnJheSBvZiBvcHRpb25zXHJcbiAgICovXHJcbiAgYWRkT3B0aW9ucyguLi5vcHRpb25zOiAoQVBJU2VsZWN0TWVudU9wdGlvbiB8IEFQSVNlbGVjdE1lbnVPcHRpb25bXSlbXSk6IHRoaXMge1xyXG4gICAgaWYgKCF0aGlzLmRhdGEub3B0aW9ucykgdGhpcy5kYXRhLm9wdGlvbnMgPSBbXTtcclxuICAgIGZvciAoY29uc3Qgb3B0IG9mIG9wdGlvbnMpIHtcclxuICAgICAgaWYgKEFycmF5LmlzQXJyYXkob3B0KSkge1xyXG4gICAgICAgIHRoaXMuZGF0YS5vcHRpb25zLnB1c2goLi4ub3B0KTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICB0aGlzLmRhdGEub3B0aW9ucy5wdXNoKG9wdCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2V0cyB0aGUgb3B0aW9ucyBvZiB0aGlzIHNlbGVjdCBtZW51XHJcbiAgICogQWNjZXB0cyBpbmRpdmlkdWFsIG9wdGlvbnMgb3IgYW4gYXJyYXkgb2Ygb3B0aW9uc1xyXG4gICAqL1xyXG4gIHNldE9wdGlvbnMoLi4ub3B0aW9uczogKEFQSVNlbGVjdE1lbnVPcHRpb24gfCBBUElTZWxlY3RNZW51T3B0aW9uW10pW10pOiB0aGlzIHtcclxuICAgIHRoaXMuZGF0YS5vcHRpb25zID0gW107XHJcbiAgICBmb3IgKGNvbnN0IG9wdCBvZiBvcHRpb25zKSB7XHJcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KG9wdCkpIHtcclxuICAgICAgICB0aGlzLmRhdGEub3B0aW9ucy5wdXNoKC4uLm9wdCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdGhpcy5kYXRhLm9wdGlvbnMucHVzaChvcHQpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlbW92ZXMsIHJlcGxhY2VzLCBvciBpbnNlcnRzIG9wdGlvbnNcclxuICAgKiBAcGFyYW0gaW5kZXggVGhlIGluZGV4IHRvIHN0YXJ0IGF0XHJcbiAgICogQHBhcmFtIGRlbGV0ZUNvdW50IFRoZSBudW1iZXIgb2Ygb3B0aW9ucyB0byByZW1vdmVcclxuICAgKiBAcGFyYW0gb3B0aW9ucyBUaGUgb3B0aW9ucyB0byBpbnNlcnRcclxuICAgKi9cclxuICBzcGxpY2VPcHRpb25zKGluZGV4OiBudW1iZXIsIGRlbGV0ZUNvdW50OiBudW1iZXIsIC4uLm9wdGlvbnM6IEFQSVNlbGVjdE1lbnVPcHRpb25bXSk6IHRoaXMge1xyXG4gICAgaWYgKCF0aGlzLmRhdGEub3B0aW9ucykgdGhpcy5kYXRhLm9wdGlvbnMgPSBbXTtcclxuICAgIHRoaXMuZGF0YS5vcHRpb25zLnNwbGljZShpbmRleCwgZGVsZXRlQ291bnQsIC4uLm9wdGlvbnMpO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZXR1cm5zIHRoZSBKU09OIHJlcHJlc2VudGF0aW9uIG9mIHRoaXMgc2VsZWN0IG1lbnVcclxuICAgKi9cclxuICB0b0pTT04oKTogQVBJU2VsZWN0TWVudUNvbXBvbmVudCB7XHJcbiAgICByZXR1cm4geyAuLi50aGlzLmRhdGEgfSBhcyBBUElTZWxlY3RNZW51Q29tcG9uZW50O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlcyBhIG5ldyBzZWxlY3QgbWVudSBidWlsZGVyIGZyb20gZXhpc3RpbmcgZGF0YVxyXG4gICAqIEBwYXJhbSBvdGhlciBUaGUgc2VsZWN0IG1lbnUgZGF0YSB0byBjb3B5XHJcbiAgICovXHJcbiAgc3RhdGljIGZyb20ob3RoZXI6IFBhcnRpYWw8QVBJU2VsZWN0TWVudUNvbXBvbmVudD4gfCBTdHJpbmdTZWxlY3RNZW51QnVpbGRlcik6IFN0cmluZ1NlbGVjdE1lbnVCdWlsZGVyIHtcclxuICAgIHJldHVybiBuZXcgU3RyaW5nU2VsZWN0TWVudUJ1aWxkZXIob3RoZXIgaW5zdGFuY2VvZiBTdHJpbmdTZWxlY3RNZW51QnVpbGRlciA/IG90aGVyLmRhdGEgOiBvdGhlcik7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogQSBidWlsZGVyIGZvciBjcmVhdGluZyBzZWxlY3QgbWVudSBvcHRpb25zXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgU3RyaW5nU2VsZWN0TWVudU9wdGlvbkJ1aWxkZXIge1xyXG4gIHB1YmxpYyByZWFkb25seSBkYXRhOiBQYXJ0aWFsPEFQSVNlbGVjdE1lbnVPcHRpb24+O1xyXG5cclxuICBjb25zdHJ1Y3RvcihkYXRhOiBQYXJ0aWFsPEFQSVNlbGVjdE1lbnVPcHRpb24+ID0ge30pIHtcclxuICAgIHRoaXMuZGF0YSA9IHsgLi4uZGF0YSB9O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2V0cyB0aGUgbGFiZWwgb2YgdGhpcyBvcHRpb25cclxuICAgKiBAcGFyYW0gbGFiZWwgVGhlIGxhYmVsXHJcbiAgICovXHJcbiAgc2V0TGFiZWwobGFiZWw6IHN0cmluZyk6IHRoaXMge1xyXG4gICAgdGhpcy5kYXRhLmxhYmVsID0gbGFiZWw7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldHMgdGhlIHZhbHVlIG9mIHRoaXMgb3B0aW9uXHJcbiAgICogQHBhcmFtIHZhbHVlIFRoZSB2YWx1ZVxyXG4gICAqL1xyXG4gIHNldFZhbHVlKHZhbHVlOiBzdHJpbmcpOiB0aGlzIHtcclxuICAgIHRoaXMuZGF0YS52YWx1ZSA9IHZhbHVlO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZXRzIHRoZSBkZXNjcmlwdGlvbiBvZiB0aGlzIG9wdGlvblxyXG4gICAqIEBwYXJhbSBkZXNjcmlwdGlvbiBUaGUgZGVzY3JpcHRpb25cclxuICAgKi9cclxuICBzZXREZXNjcmlwdGlvbihkZXNjcmlwdGlvbjogc3RyaW5nKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEuZGVzY3JpcHRpb24gPSBkZXNjcmlwdGlvbjtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2V0cyB0aGUgZW1vamkgb2YgdGhpcyBvcHRpb25cclxuICAgKiBAcGFyYW0gZW1vamkgVGhlIGVtb2ppXHJcbiAgICovXHJcbiAgc2V0RW1vamkoZW1vamk6IHsgaWQ/OiBzdHJpbmc7IG5hbWU/OiBzdHJpbmc7IGFuaW1hdGVkPzogYm9vbGVhbiB9IHwgc3RyaW5nKTogdGhpcyB7XHJcbiAgICBpZiAodHlwZW9mIGVtb2ppID09PSAnc3RyaW5nJykge1xyXG4gICAgICB0aGlzLmRhdGEuZW1vamkgPSB7IG5hbWU6IGVtb2ppIH07XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLmRhdGEuZW1vamkgPSBlbW9qaTtcclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2V0cyB3aGV0aGVyIHRoaXMgb3B0aW9uIGlzIHRoZSBkZWZhdWx0XHJcbiAgICogQHBhcmFtIGlzRGVmYXVsdCBXaGV0aGVyIHRoaXMgb3B0aW9uIGlzIHRoZSBkZWZhdWx0XHJcbiAgICovXHJcbiAgc2V0RGVmYXVsdChpc0RlZmF1bHQgPSB0cnVlKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEuZGVmYXVsdCA9IGlzRGVmYXVsdDtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmV0dXJucyB0aGUgSlNPTiByZXByZXNlbnRhdGlvbiBvZiB0aGlzIG9wdGlvblxyXG4gICAqL1xyXG4gIHRvSlNPTigpOiBBUElTZWxlY3RNZW51T3B0aW9uIHtcclxuICAgIHJldHVybiB7IC4uLnRoaXMuZGF0YSB9IGFzIEFQSVNlbGVjdE1lbnVPcHRpb247XHJcbiAgfVxyXG59XHJcblxyXG4vLyBBbGlhcyBmb3IgREpTIGNvbXBhdGliaWxpdHlcclxuZXhwb3J0IHsgU3RyaW5nU2VsZWN0TWVudUJ1aWxkZXIgYXMgU2VsZWN0TWVudUJ1aWxkZXIgfTtcclxuXHJcbi8qKlxyXG4gKiBDb21wb25lbnQgdHlwZXMgZm9yIHNlbGVjdCBtZW51c1xyXG4gKi9cclxuZXhwb3J0IGVudW0gU2VsZWN0TWVudVR5cGUge1xyXG4gIFN0cmluZyA9IDMsXHJcbiAgVXNlciA9IDUsXHJcbiAgUm9sZSA9IDYsXHJcbiAgTWVudGlvbmFibGUgPSA3LFxyXG4gIENoYW5uZWwgPSA4LFxyXG59XHJcblxyXG4vKipcclxuICogQmFzZSBpbnRlcmZhY2UgZm9yIGF1dG8tcG9wdWxhdGVkIHNlbGVjdCBtZW51cyAoVXNlciwgUm9sZSwgTWVudGlvbmFibGUsIENoYW5uZWwpXHJcbiAqL1xyXG5pbnRlcmZhY2UgQVBJQXV0b1NlbGVjdE1lbnVDb21wb25lbnQge1xyXG4gIHR5cGU6IG51bWJlcjtcclxuICBjdXN0b21faWQ6IHN0cmluZztcclxuICBwbGFjZWhvbGRlcj86IHN0cmluZztcclxuICBtaW5fdmFsdWVzPzogbnVtYmVyO1xyXG4gIG1heF92YWx1ZXM/OiBudW1iZXI7XHJcbiAgZGlzYWJsZWQ/OiBib29sZWFuO1xyXG4gIC8qKiBDaGFubmVsIHR5cGVzIHRvIGluY2x1ZGUgKG9ubHkgZm9yIENoYW5uZWxTZWxlY3RNZW51KSAqL1xyXG4gIGNoYW5uZWxfdHlwZXM/OiBudW1iZXJbXTtcclxufVxyXG5cclxuLyoqXHJcbiAqIEEgYnVpbGRlciBmb3IgY3JlYXRpbmcgdXNlciBzZWxlY3QgbWVudXNcclxuICogVXNlcnMgYXJlIGF1dG8tcG9wdWxhdGVkIGZyb20gdGhlIGd1aWxkXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgVXNlclNlbGVjdE1lbnVCdWlsZGVyIHtcclxuICBwdWJsaWMgcmVhZG9ubHkgZGF0YTogUGFydGlhbDxBUElBdXRvU2VsZWN0TWVudUNvbXBvbmVudD47XHJcblxyXG4gIGNvbnN0cnVjdG9yKGRhdGE6IFBhcnRpYWw8QVBJQXV0b1NlbGVjdE1lbnVDb21wb25lbnQ+ID0ge30pIHtcclxuICAgIHRoaXMuZGF0YSA9IHsgdHlwZTogU2VsZWN0TWVudVR5cGUuVXNlciwgLi4uZGF0YSB9O1xyXG4gIH1cclxuXHJcbiAgc2V0Q3VzdG9tSWQoY3VzdG9tSWQ6IHN0cmluZyk6IHRoaXMge1xyXG4gICAgdGhpcy5kYXRhLmN1c3RvbV9pZCA9IGN1c3RvbUlkO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICBzZXRQbGFjZWhvbGRlcihwbGFjZWhvbGRlcjogc3RyaW5nKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEucGxhY2Vob2xkZXIgPSBwbGFjZWhvbGRlcjtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgc2V0TWluVmFsdWVzKG1pblZhbHVlczogbnVtYmVyKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEubWluX3ZhbHVlcyA9IG1pblZhbHVlcztcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgc2V0TWF4VmFsdWVzKG1heFZhbHVlczogbnVtYmVyKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEubWF4X3ZhbHVlcyA9IG1heFZhbHVlcztcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgc2V0RGlzYWJsZWQoZGlzYWJsZWQgPSB0cnVlKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEuZGlzYWJsZWQgPSBkaXNhYmxlZDtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgdG9KU09OKCk6IEFQSUF1dG9TZWxlY3RNZW51Q29tcG9uZW50IHtcclxuICAgIHJldHVybiB7IC4uLnRoaXMuZGF0YSB9IGFzIEFQSUF1dG9TZWxlY3RNZW51Q29tcG9uZW50O1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIEEgYnVpbGRlciBmb3IgY3JlYXRpbmcgcm9sZSBzZWxlY3QgbWVudXNcclxuICogUm9sZXMgYXJlIGF1dG8tcG9wdWxhdGVkIGZyb20gdGhlIGd1aWxkXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgUm9sZVNlbGVjdE1lbnVCdWlsZGVyIHtcclxuICBwdWJsaWMgcmVhZG9ubHkgZGF0YTogUGFydGlhbDxBUElBdXRvU2VsZWN0TWVudUNvbXBvbmVudD47XHJcblxyXG4gIGNvbnN0cnVjdG9yKGRhdGE6IFBhcnRpYWw8QVBJQXV0b1NlbGVjdE1lbnVDb21wb25lbnQ+ID0ge30pIHtcclxuICAgIHRoaXMuZGF0YSA9IHsgdHlwZTogU2VsZWN0TWVudVR5cGUuUm9sZSwgLi4uZGF0YSB9O1xyXG4gIH1cclxuXHJcbiAgc2V0Q3VzdG9tSWQoY3VzdG9tSWQ6IHN0cmluZyk6IHRoaXMge1xyXG4gICAgdGhpcy5kYXRhLmN1c3RvbV9pZCA9IGN1c3RvbUlkO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICBzZXRQbGFjZWhvbGRlcihwbGFjZWhvbGRlcjogc3RyaW5nKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEucGxhY2Vob2xkZXIgPSBwbGFjZWhvbGRlcjtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgc2V0TWluVmFsdWVzKG1pblZhbHVlczogbnVtYmVyKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEubWluX3ZhbHVlcyA9IG1pblZhbHVlcztcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgc2V0TWF4VmFsdWVzKG1heFZhbHVlczogbnVtYmVyKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEubWF4X3ZhbHVlcyA9IG1heFZhbHVlcztcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgc2V0RGlzYWJsZWQoZGlzYWJsZWQgPSB0cnVlKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEuZGlzYWJsZWQgPSBkaXNhYmxlZDtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgdG9KU09OKCk6IEFQSUF1dG9TZWxlY3RNZW51Q29tcG9uZW50IHtcclxuICAgIHJldHVybiB7IC4uLnRoaXMuZGF0YSB9IGFzIEFQSUF1dG9TZWxlY3RNZW51Q29tcG9uZW50O1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIEEgYnVpbGRlciBmb3IgY3JlYXRpbmcgbWVudGlvbmFibGUgc2VsZWN0IG1lbnVzICh1c2VycyArIHJvbGVzKVxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIE1lbnRpb25hYmxlU2VsZWN0TWVudUJ1aWxkZXIge1xyXG4gIHB1YmxpYyByZWFkb25seSBkYXRhOiBQYXJ0aWFsPEFQSUF1dG9TZWxlY3RNZW51Q29tcG9uZW50PjtcclxuXHJcbiAgY29uc3RydWN0b3IoZGF0YTogUGFydGlhbDxBUElBdXRvU2VsZWN0TWVudUNvbXBvbmVudD4gPSB7fSkge1xyXG4gICAgdGhpcy5kYXRhID0geyB0eXBlOiBTZWxlY3RNZW51VHlwZS5NZW50aW9uYWJsZSwgLi4uZGF0YSB9O1xyXG4gIH1cclxuXHJcbiAgc2V0Q3VzdG9tSWQoY3VzdG9tSWQ6IHN0cmluZyk6IHRoaXMge1xyXG4gICAgdGhpcy5kYXRhLmN1c3RvbV9pZCA9IGN1c3RvbUlkO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICBzZXRQbGFjZWhvbGRlcihwbGFjZWhvbGRlcjogc3RyaW5nKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEucGxhY2Vob2xkZXIgPSBwbGFjZWhvbGRlcjtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgc2V0TWluVmFsdWVzKG1pblZhbHVlczogbnVtYmVyKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEubWluX3ZhbHVlcyA9IG1pblZhbHVlcztcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgc2V0TWF4VmFsdWVzKG1heFZhbHVlczogbnVtYmVyKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEubWF4X3ZhbHVlcyA9IG1heFZhbHVlcztcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgc2V0RGlzYWJsZWQoZGlzYWJsZWQgPSB0cnVlKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEuZGlzYWJsZWQgPSBkaXNhYmxlZDtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgdG9KU09OKCk6IEFQSUF1dG9TZWxlY3RNZW51Q29tcG9uZW50IHtcclxuICAgIHJldHVybiB7IC4uLnRoaXMuZGF0YSB9IGFzIEFQSUF1dG9TZWxlY3RNZW51Q29tcG9uZW50O1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIEEgYnVpbGRlciBmb3IgY3JlYXRpbmcgY2hhbm5lbCBzZWxlY3QgbWVudXNcclxuICogQ2hhbm5lbHMgYXJlIGF1dG8tcG9wdWxhdGVkIGZyb20gdGhlIGd1aWxkXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgQ2hhbm5lbFNlbGVjdE1lbnVCdWlsZGVyIHtcclxuICBwdWJsaWMgcmVhZG9ubHkgZGF0YTogUGFydGlhbDxBUElBdXRvU2VsZWN0TWVudUNvbXBvbmVudD47XHJcblxyXG4gIGNvbnN0cnVjdG9yKGRhdGE6IFBhcnRpYWw8QVBJQXV0b1NlbGVjdE1lbnVDb21wb25lbnQ+ID0ge30pIHtcclxuICAgIHRoaXMuZGF0YSA9IHsgdHlwZTogU2VsZWN0TWVudVR5cGUuQ2hhbm5lbCwgLi4uZGF0YSB9O1xyXG4gIH1cclxuXHJcbiAgc2V0Q3VzdG9tSWQoY3VzdG9tSWQ6IHN0cmluZyk6IHRoaXMge1xyXG4gICAgdGhpcy5kYXRhLmN1c3RvbV9pZCA9IGN1c3RvbUlkO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICBzZXRQbGFjZWhvbGRlcihwbGFjZWhvbGRlcjogc3RyaW5nKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEucGxhY2Vob2xkZXIgPSBwbGFjZWhvbGRlcjtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgc2V0TWluVmFsdWVzKG1pblZhbHVlczogbnVtYmVyKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEubWluX3ZhbHVlcyA9IG1pblZhbHVlcztcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgc2V0TWF4VmFsdWVzKG1heFZhbHVlczogbnVtYmVyKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEubWF4X3ZhbHVlcyA9IG1heFZhbHVlcztcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgc2V0RGlzYWJsZWQoZGlzYWJsZWQgPSB0cnVlKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEuZGlzYWJsZWQgPSBkaXNhYmxlZDtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2V0cyB0aGUgY2hhbm5lbCB0eXBlcyB0aGF0IGNhbiBiZSBzZWxlY3RlZFxyXG4gICAqIEBwYXJhbSB0eXBlcyBBcnJheSBvZiBDaGFubmVsVHlwZSB2YWx1ZXNcclxuICAgKi9cclxuICBzZXRDaGFubmVsVHlwZXModHlwZXM6IG51bWJlcltdKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEuY2hhbm5lbF90eXBlcyA9IHR5cGVzO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICB0b0pTT04oKTogQVBJQXV0b1NlbGVjdE1lbnVDb21wb25lbnQge1xyXG4gICAgcmV0dXJuIHsgLi4udGhpcy5kYXRhIH0gYXMgQVBJQXV0b1NlbGVjdE1lbnVDb21wb25lbnQ7XHJcbiAgfVxyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBTdHJpbmdTZWxlY3RNZW51QnVpbGRlcjtcclxuIl19