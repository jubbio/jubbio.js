"use strict";
/**
 * SelectMenuBuilder for creating select menus
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SelectMenuBuilder = exports.StringSelectMenuOptionBuilder = exports.StringSelectMenuBuilder = void 0;
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
     * @param options The options to add
     */
    addOptions(...options) {
        if (!this.data.options)
            this.data.options = [];
        this.data.options.push(...options);
        return this;
    }
    /**
     * Sets the options of this select menu
     * @param options The options to set
     */
    setOptions(...options) {
        this.data.options = options;
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
exports.default = StringSelectMenuBuilder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU2VsZWN0TWVudUJ1aWxkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvYnVpbGRlcnMvU2VsZWN0TWVudUJ1aWxkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOztHQUVHOzs7QUFvQkg7O0dBRUc7QUFDSCxNQUFhLHVCQUF1QjtJQUNsQixJQUFJLENBQWtDO0lBRXRELFlBQVksT0FBd0MsRUFBRTtRQUNwRCxJQUFJLENBQUMsSUFBSSxHQUFHLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxHQUFHLElBQUksRUFBRSxDQUFDO1FBQ2pDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU87WUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7SUFDakQsQ0FBQztJQUVEOzs7T0FHRztJQUNILFdBQVcsQ0FBQyxRQUFnQjtRQUMxQixJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsR0FBRyxRQUFRLENBQUM7UUFDL0IsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsY0FBYyxDQUFDLFdBQW1CO1FBQ2hDLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQztRQUNwQyxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRDs7O09BR0c7SUFDSCxZQUFZLENBQUMsU0FBaUI7UUFDNUIsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEdBQUcsU0FBUyxDQUFDO1FBQ2pDLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEOzs7T0FHRztJQUNILFlBQVksQ0FBQyxTQUFpQjtRQUM1QixJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsR0FBRyxTQUFTLENBQUM7UUFDakMsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsV0FBVyxDQUFDLFFBQVEsR0FBRyxJQUFJO1FBQ3pCLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxH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LENBQUM7SUFDakQsQ0FBQztDQUNGO0FBOURELHNFQThEQztBQUtELGtCQUFlLHVCQUF1QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIFNlbGVjdE1lbnVCdWlsZGVyIGZvciBjcmVhdGluZyBzZWxlY3QgbWVudXNcclxuICovXHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEFQSVNlbGVjdE1lbnVPcHRpb24ge1xyXG4gIGxhYmVsOiBzdHJpbmc7XHJcbiAgdmFsdWU6IHN0cmluZztcclxuICBkZXNjcmlwdGlvbj86IHN0cmluZztcclxuICBlbW9qaT86IHsgaWQ/OiBzdHJpbmc7IG5hbWU/OiBzdHJpbmc7IGFuaW1hdGVkPzogYm9vbGVhbiB9O1xyXG4gIGRlZmF1bHQ/OiBib29sZWFuO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEFQSVNlbGVjdE1lbnVDb21wb25lbnQge1xyXG4gIHR5cGU6IDM7XHJcbiAgY3VzdG9tX2lkOiBzdHJpbmc7XHJcbiAgb3B0aW9ucz86IEFQSVNlbGVjdE1lbnVPcHRpb25bXTtcclxuICBwbGFjZWhvbGRlcj86IHN0cmluZztcclxuICBtaW5fdmFsdWVzPzogbnVtYmVyO1xyXG4gIG1heF92YWx1ZXM/OiBudW1iZXI7XHJcbiAgZGlzYWJsZWQ/OiBib29sZWFuO1xyXG59XHJcblxyXG4vKipcclxuICogQSBidWlsZGVyIGZvciBjcmVhdGluZyBzdHJpbmcgc2VsZWN0IG1lbnVzXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgU3RyaW5nU2VsZWN0TWVudUJ1aWxkZXIge1xyXG4gIHB1YmxpYyByZWFkb25seSBkYXRhOiBQYXJ0aWFsPEFQSVNlbGVjdE1lbnVDb21wb25lbnQ+O1xyXG5cclxuICBjb25zdHJ1Y3RvcihkYXRhOiBQYXJ0aWFsPEFQSVNlbGVjdE1lbnVDb21wb25lbnQ+ID0ge30pIHtcclxuICAgIHRoaXMuZGF0YSA9IHsgdHlwZTogMywgLi4uZGF0YSB9O1xyXG4gICAgaWYgKCF0aGlzLmRhdGEub3B0aW9ucykgdGhpcy5kYXRhLm9wdGlvbnMgPSBbXTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldHMgdGhlIGN1c3RvbSBJRCBvZiB0aGlzIHNlbGVjdCBtZW51XHJcbiAgICogQHBhcmFtIGN1c3RvbUlkIFRoZSBjdXN0b20gSURcclxuICAgKi9cclxuICBzZXRDdXN0b21JZChjdXN0b21JZDogc3RyaW5nKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEuY3VzdG9tX2lkID0gY3VzdG9tSWQ7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldHMgdGhlIHBsYWNlaG9sZGVyIG9mIHRoaXMgc2VsZWN0IG1lbnVcclxuICAgKiBAcGFyYW0gcGxhY2Vob2xkZXIgVGhlIHBsYWNlaG9sZGVyXHJcbiAgICovXHJcbiAgc2V0UGxhY2Vob2xkZXIocGxhY2Vob2xkZXI6IHN0cmluZyk6IHRoaXMge1xyXG4gICAgdGhpcy5kYXRhLnBsYWNlaG9sZGVyID0gcGxhY2Vob2xkZXI7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldHMgdGhlIG1pbmltdW0gdmFsdWVzIG9mIHRoaXMgc2VsZWN0IG1lbnVcclxuICAgKiBAcGFyYW0gbWluVmFsdWVzIFRoZSBtaW5pbXVtIHZhbHVlc1xyXG4gICAqL1xyXG4gIHNldE1pblZhbHVlcyhtaW5WYWx1ZXM6IG51bWJlcik6IHRoaXMge1xyXG4gICAgdGhpcy5kYXRhLm1pbl92YWx1ZXMgPSBtaW5WYWx1ZXM7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldHMgdGhlIG1heGltdW0gdmFsdWVzIG9mIHRoaXMgc2VsZWN0IG1lbnVcclxuICAgKiBAcGFyYW0gbWF4VmFsdWVzIFRoZSBtYXhpbXVtIHZhbHVlc1xyXG4gICAqL1xyXG4gIHNldE1heFZhbHVlcyhtYXhWYWx1ZXM6IG51bWJlcik6IHRoaXMge1xyXG4gICAgdGhpcy5kYXRhLm1heF92YWx1ZXMgPSBtYXhWYWx1ZXM7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldHMgd2hldGhlciB0aGlzIHNlbGVjdCBtZW51IGlzIGRpc2FibGVkXHJcbiAgICogQHBhcmFtIGRpc2FibGVkIFdoZXRoZXIgdGhlIHNlbGVjdCBtZW51IGlzIGRpc2FibGVkXHJcbiAgICovXHJcbiAgc2V0RGlzYWJsZWQoZGlzYWJsZWQgPSB0cnVlKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEuZGlzYWJsZWQgPSBkaXNhYmxlZDtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRkcyBvcHRpb25zIHRvIHRoaXMgc2VsZWN0IG1lbnVcclxuICAgKiBAcGFyYW0gb3B0aW9ucyBUaGUgb3B0aW9ucyB0byBhZGRcclxuICAgKi9cclxuICBhZGRPcHRpb25zKC4uLm9wdGlvbnM6IEFQSVNlbGVjdE1lbnVPcHRpb25bXSk6IHRoaXMge1xyXG4gICAgaWYgKCF0aGlzLmRhdGEub3B0aW9ucykgdGhpcy5kYXRhLm9wdGlvbnMgPSBbXTtcclxuICAgIHRoaXMuZGF0YS5vcHRpb25zLnB1c2goLi4ub3B0aW9ucyk7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldHMgdGhlIG9wdGlvbnMgb2YgdGhpcyBzZWxlY3QgbWVudVxyXG4gICAqIEBwYXJhbSBvcHRpb25zIFRoZSBvcHRpb25zIHRvIHNldFxyXG4gICAqL1xyXG4gIHNldE9wdGlvbnMoLi4ub3B0aW9uczogQVBJU2VsZWN0TWVudU9wdGlvbltdKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEub3B0aW9ucyA9IG9wdGlvbnM7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlbW92ZXMsIHJlcGxhY2VzLCBvciBpbnNlcnRzIG9wdGlvbnNcclxuICAgKiBAcGFyYW0gaW5kZXggVGhlIGluZGV4IHRvIHN0YXJ0IGF0XHJcbiAgICogQHBhcmFtIGRlbGV0ZUNvdW50IFRoZSBudW1iZXIgb2Ygb3B0aW9ucyB0byByZW1vdmVcclxuICAgKiBAcGFyYW0gb3B0aW9ucyBUaGUgb3B0aW9ucyB0byBpbnNlcnRcclxuICAgKi9cclxuICBzcGxpY2VPcHRpb25zKGluZGV4OiBudW1iZXIsIGRlbGV0ZUNvdW50OiBudW1iZXIsIC4uLm9wdGlvbnM6IEFQSVNlbGVjdE1lbnVPcHRpb25bXSk6IHRoaXMge1xyXG4gICAgaWYgKCF0aGlzLmRhdGEub3B0aW9ucykgdGhpcy5kYXRhLm9wdGlvbnMgPSBbXTtcclxuICAgIHRoaXMuZGF0YS5vcHRpb25zLnNwbGljZShpbmRleCwgZGVsZXRlQ291bnQsIC4uLm9wdGlvbnMpO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZXR1cm5zIHRoZSBKU09OIHJlcHJlc2VudGF0aW9uIG9mIHRoaXMgc2VsZWN0IG1lbnVcclxuICAgKi9cclxuICB0b0pTT04oKTogQVBJU2VsZWN0TWVudUNvbXBvbmVudCB7XHJcbiAgICByZXR1cm4geyAuLi50aGlzLmRhdGEgfSBhcyBBUElTZWxlY3RNZW51Q29tcG9uZW50O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlcyBhIG5ldyBzZWxlY3QgbWVudSBidWlsZGVyIGZyb20gZXhpc3RpbmcgZGF0YVxyXG4gICAqIEBwYXJhbSBvdGhlciBUaGUgc2VsZWN0IG1lbnUgZGF0YSB0byBjb3B5XHJcbiAgICovXHJcbiAgc3RhdGljIGZyb20ob3RoZXI6IFBhcnRpYWw8QVBJU2VsZWN0TWVudUNvbXBvbmVudD4gfCBTdHJpbmdTZWxlY3RNZW51QnVpbGRlcik6IFN0cmluZ1NlbGVjdE1lbnVCdWlsZGVyIHtcclxuICAgIHJldHVybiBuZXcgU3RyaW5nU2VsZWN0TWVudUJ1aWxkZXIob3RoZXIgaW5zdGFuY2VvZiBTdHJpbmdTZWxlY3RNZW51QnVpbGRlciA/IG90aGVyLmRhdGEgOiBvdGhlcik7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogQSBidWlsZGVyIGZvciBjcmVhdGluZyBzZWxlY3QgbWVudSBvcHRpb25zXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgU3RyaW5nU2VsZWN0TWVudU9wdGlvbkJ1aWxkZXIge1xyXG4gIHB1YmxpYyByZWFkb25seSBkYXRhOiBQYXJ0aWFsPEFQSVNlbGVjdE1lbnVPcHRpb24+O1xyXG5cclxuICBjb25zdHJ1Y3RvcihkYXRhOiBQYXJ0aWFsPEFQSVNlbGVjdE1lbnVPcHRpb24+ID0ge30pIHtcclxuICAgIHRoaXMuZGF0YSA9IHsgLi4uZGF0YSB9O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2V0cyB0aGUgbGFiZWwgb2YgdGhpcyBvcHRpb25cclxuICAgKiBAcGFyYW0gbGFiZWwgVGhlIGxhYmVsXHJcbiAgICovXHJcbiAgc2V0TGFiZWwobGFiZWw6IHN0cmluZyk6IHRoaXMge1xyXG4gICAgdGhpcy5kYXRhLmxhYmVsID0gbGFiZWw7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldHMgdGhlIHZhbHVlIG9mIHRoaXMgb3B0aW9uXHJcbiAgICogQHBhcmFtIHZhbHVlIFRoZSB2YWx1ZVxyXG4gICAqL1xyXG4gIHNldFZhbHVlKHZhbHVlOiBzdHJpbmcpOiB0aGlzIHtcclxuICAgIHRoaXMuZGF0YS52YWx1ZSA9IHZhbHVlO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZXRzIHRoZSBkZXNjcmlwdGlvbiBvZiB0aGlzIG9wdGlvblxyXG4gICAqIEBwYXJhbSBkZXNjcmlwdGlvbiBUaGUgZGVzY3JpcHRpb25cclxuICAgKi9cclxuICBzZXREZXNjcmlwdGlvbihkZXNjcmlwdGlvbjogc3RyaW5nKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEuZGVzY3JpcHRpb24gPSBkZXNjcmlwdGlvbjtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2V0cyB0aGUgZW1vamkgb2YgdGhpcyBvcHRpb25cclxuICAgKiBAcGFyYW0gZW1vamkgVGhlIGVtb2ppXHJcbiAgICovXHJcbiAgc2V0RW1vamkoZW1vamk6IHsgaWQ/OiBzdHJpbmc7IG5hbWU/OiBzdHJpbmc7IGFuaW1hdGVkPzogYm9vbGVhbiB9IHwgc3RyaW5nKTogdGhpcyB7XHJcbiAgICBpZiAodHlwZW9mIGVtb2ppID09PSAnc3RyaW5nJykge1xyXG4gICAgICB0aGlzLmRhdGEuZW1vamkgPSB7IG5hbWU6IGVtb2ppIH07XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLmRhdGEuZW1vamkgPSBlbW9qaTtcclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2V0cyB3aGV0aGVyIHRoaXMgb3B0aW9uIGlzIHRoZSBkZWZhdWx0XHJcbiAgICogQHBhcmFtIGlzRGVmYXVsdCBXaGV0aGVyIHRoaXMgb3B0aW9uIGlzIHRoZSBkZWZhdWx0XHJcbiAgICovXHJcbiAgc2V0RGVmYXVsdChpc0RlZmF1bHQgPSB0cnVlKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEuZGVmYXVsdCA9IGlzRGVmYXVsdDtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmV0dXJucyB0aGUgSlNPTiByZXByZXNlbnRhdGlvbiBvZiB0aGlzIG9wdGlvblxyXG4gICAqL1xyXG4gIHRvSlNPTigpOiBBUElTZWxlY3RNZW51T3B0aW9uIHtcclxuICAgIHJldHVybiB7IC4uLnRoaXMuZGF0YSB9IGFzIEFQSVNlbGVjdE1lbnVPcHRpb247XHJcbiAgfVxyXG59XHJcblxyXG4vLyBBbGlhcyBmb3IgREpTIGNvbXBhdGliaWxpdHlcclxuZXhwb3J0IHsgU3RyaW5nU2VsZWN0TWVudUJ1aWxkZXIgYXMgU2VsZWN0TWVudUJ1aWxkZXIgfTtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IFN0cmluZ1NlbGVjdE1lbnVCdWlsZGVyO1xyXG4iXX0=