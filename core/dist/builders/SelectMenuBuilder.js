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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU2VsZWN0TWVudUJ1aWxkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvYnVpbGRlcnMvU2VsZWN0TWVudUJ1aWxkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOztHQUVHOzs7QUFvQkg7O0dBRUc7QUFDSCxNQUFhLHVCQUF1QjtJQUNsQixJQUFJLENBQWtDO0lBRXRELFlBQVksT0FBd0MsRUFBRTtRQUNwRCxJQUFJLENBQUMsSUFBSSxHQUFHLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxHQUFHLElBQUksRUFBRSxDQUFDO1FBQ2pDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU87WUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7SUFDakQsQ0FBQztJQUVEOzs7T0FHRztJQUNILFdBQVcsQ0FBQyxRQUFnQjtRQUMxQixJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsR0FBRyxRQUFRLENBQUM7UUFDL0IsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsY0FBYyxDQUFDLFdBQW1CO1FBQ2hDLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQztRQUNwQyxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRDs7O09BR0c7SUFDSCxZQUFZLENBQUMsU0FBaUI7UUFDNUIsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEdBQUcsU0FBUyxDQUFDO1FBQ2pDLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEOzs7T0FHRztJQUNILFlBQVksQ0FBQyxTQUFpQjtRQUM1QixJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsR0FBRyxTQUFTLENBQUM7UUFDakMsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsV0FBVyxDQUFDLFFBQVEsR0FBRyxJQUFJO1FBQ3pCLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxH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LENBQUM7SUFDakQsQ0FBQztDQUNGO0FBOURELHNFQThEQztBQUtELGtCQUFlLHVCQUF1QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBTZWxlY3RNZW51QnVpbGRlciBmb3IgY3JlYXRpbmcgc2VsZWN0IG1lbnVzXG4gKi9cblxuZXhwb3J0IGludGVyZmFjZSBBUElTZWxlY3RNZW51T3B0aW9uIHtcbiAgbGFiZWw6IHN0cmluZztcbiAgdmFsdWU6IHN0cmluZztcbiAgZGVzY3JpcHRpb24/OiBzdHJpbmc7XG4gIGVtb2ppPzogeyBpZD86IHN0cmluZzsgbmFtZT86IHN0cmluZzsgYW5pbWF0ZWQ/OiBib29sZWFuIH07XG4gIGRlZmF1bHQ/OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEFQSVNlbGVjdE1lbnVDb21wb25lbnQge1xuICB0eXBlOiAzO1xuICBjdXN0b21faWQ6IHN0cmluZztcbiAgb3B0aW9ucz86IEFQSVNlbGVjdE1lbnVPcHRpb25bXTtcbiAgcGxhY2Vob2xkZXI/OiBzdHJpbmc7XG4gIG1pbl92YWx1ZXM/OiBudW1iZXI7XG4gIG1heF92YWx1ZXM/OiBudW1iZXI7XG4gIGRpc2FibGVkPzogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiBBIGJ1aWxkZXIgZm9yIGNyZWF0aW5nIHN0cmluZyBzZWxlY3QgbWVudXNcbiAqL1xuZXhwb3J0IGNsYXNzIFN0cmluZ1NlbGVjdE1lbnVCdWlsZGVyIHtcbiAgcHVibGljIHJlYWRvbmx5IGRhdGE6IFBhcnRpYWw8QVBJU2VsZWN0TWVudUNvbXBvbmVudD47XG5cbiAgY29uc3RydWN0b3IoZGF0YTogUGFydGlhbDxBUElTZWxlY3RNZW51Q29tcG9uZW50PiA9IHt9KSB7XG4gICAgdGhpcy5kYXRhID0geyB0eXBlOiAzLCAuLi5kYXRhIH07XG4gICAgaWYgKCF0aGlzLmRhdGEub3B0aW9ucykgdGhpcy5kYXRhLm9wdGlvbnMgPSBbXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSBjdXN0b20gSUQgb2YgdGhpcyBzZWxlY3QgbWVudVxuICAgKiBAcGFyYW0gY3VzdG9tSWQgVGhlIGN1c3RvbSBJRFxuICAgKi9cbiAgc2V0Q3VzdG9tSWQoY3VzdG9tSWQ6IHN0cmluZyk6IHRoaXMge1xuICAgIHRoaXMuZGF0YS5jdXN0b21faWQgPSBjdXN0b21JZDtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSBwbGFjZWhvbGRlciBvZiB0aGlzIHNlbGVjdCBtZW51XG4gICAqIEBwYXJhbSBwbGFjZWhvbGRlciBUaGUgcGxhY2Vob2xkZXJcbiAgICovXG4gIHNldFBsYWNlaG9sZGVyKHBsYWNlaG9sZGVyOiBzdHJpbmcpOiB0aGlzIHtcbiAgICB0aGlzLmRhdGEucGxhY2Vob2xkZXIgPSBwbGFjZWhvbGRlcjtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSBtaW5pbXVtIHZhbHVlcyBvZiB0aGlzIHNlbGVjdCBtZW51XG4gICAqIEBwYXJhbSBtaW5WYWx1ZXMgVGhlIG1pbmltdW0gdmFsdWVzXG4gICAqL1xuICBzZXRNaW5WYWx1ZXMobWluVmFsdWVzOiBudW1iZXIpOiB0aGlzIHtcbiAgICB0aGlzLmRhdGEubWluX3ZhbHVlcyA9IG1pblZhbHVlcztcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSBtYXhpbXVtIHZhbHVlcyBvZiB0aGlzIHNlbGVjdCBtZW51XG4gICAqIEBwYXJhbSBtYXhWYWx1ZXMgVGhlIG1heGltdW0gdmFsdWVzXG4gICAqL1xuICBzZXRNYXhWYWx1ZXMobWF4VmFsdWVzOiBudW1iZXIpOiB0aGlzIHtcbiAgICB0aGlzLmRhdGEubWF4X3ZhbHVlcyA9IG1heFZhbHVlcztcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHdoZXRoZXIgdGhpcyBzZWxlY3QgbWVudSBpcyBkaXNhYmxlZFxuICAgKiBAcGFyYW0gZGlzYWJsZWQgV2hldGhlciB0aGUgc2VsZWN0IG1lbnUgaXMgZGlzYWJsZWRcbiAgICovXG4gIHNldERpc2FibGVkKGRpc2FibGVkID0gdHJ1ZSk6IHRoaXMge1xuICAgIHRoaXMuZGF0YS5kaXNhYmxlZCA9IGRpc2FibGVkO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZHMgb3B0aW9ucyB0byB0aGlzIHNlbGVjdCBtZW51XG4gICAqIEBwYXJhbSBvcHRpb25zIFRoZSBvcHRpb25zIHRvIGFkZFxuICAgKi9cbiAgYWRkT3B0aW9ucyguLi5vcHRpb25zOiBBUElTZWxlY3RNZW51T3B0aW9uW10pOiB0aGlzIHtcbiAgICBpZiAoIXRoaXMuZGF0YS5vcHRpb25zKSB0aGlzLmRhdGEub3B0aW9ucyA9IFtdO1xuICAgIHRoaXMuZGF0YS5vcHRpb25zLnB1c2goLi4ub3B0aW9ucyk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU2V0cyB0aGUgb3B0aW9ucyBvZiB0aGlzIHNlbGVjdCBtZW51XG4gICAqIEBwYXJhbSBvcHRpb25zIFRoZSBvcHRpb25zIHRvIHNldFxuICAgKi9cbiAgc2V0T3B0aW9ucyguLi5vcHRpb25zOiBBUElTZWxlY3RNZW51T3B0aW9uW10pOiB0aGlzIHtcbiAgICB0aGlzLmRhdGEub3B0aW9ucyA9IG9wdGlvbnM7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlcywgcmVwbGFjZXMsIG9yIGluc2VydHMgb3B0aW9uc1xuICAgKiBAcGFyYW0gaW5kZXggVGhlIGluZGV4IHRvIHN0YXJ0IGF0XG4gICAqIEBwYXJhbSBkZWxldGVDb3VudCBUaGUgbnVtYmVyIG9mIG9wdGlvbnMgdG8gcmVtb3ZlXG4gICAqIEBwYXJhbSBvcHRpb25zIFRoZSBvcHRpb25zIHRvIGluc2VydFxuICAgKi9cbiAgc3BsaWNlT3B0aW9ucyhpbmRleDogbnVtYmVyLCBkZWxldGVDb3VudDogbnVtYmVyLCAuLi5vcHRpb25zOiBBUElTZWxlY3RNZW51T3B0aW9uW10pOiB0aGlzIHtcbiAgICBpZiAoIXRoaXMuZGF0YS5vcHRpb25zKSB0aGlzLmRhdGEub3B0aW9ucyA9IFtdO1xuICAgIHRoaXMuZGF0YS5vcHRpb25zLnNwbGljZShpbmRleCwgZGVsZXRlQ291bnQsIC4uLm9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIEpTT04gcmVwcmVzZW50YXRpb24gb2YgdGhpcyBzZWxlY3QgbWVudVxuICAgKi9cbiAgdG9KU09OKCk6IEFQSVNlbGVjdE1lbnVDb21wb25lbnQge1xuICAgIHJldHVybiB7IC4uLnRoaXMuZGF0YSB9IGFzIEFQSVNlbGVjdE1lbnVDb21wb25lbnQ7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBzZWxlY3QgbWVudSBidWlsZGVyIGZyb20gZXhpc3RpbmcgZGF0YVxuICAgKiBAcGFyYW0gb3RoZXIgVGhlIHNlbGVjdCBtZW51IGRhdGEgdG8gY29weVxuICAgKi9cbiAgc3RhdGljIGZyb20ob3RoZXI6IFBhcnRpYWw8QVBJU2VsZWN0TWVudUNvbXBvbmVudD4gfCBTdHJpbmdTZWxlY3RNZW51QnVpbGRlcik6IFN0cmluZ1NlbGVjdE1lbnVCdWlsZGVyIHtcbiAgICByZXR1cm4gbmV3IFN0cmluZ1NlbGVjdE1lbnVCdWlsZGVyKG90aGVyIGluc3RhbmNlb2YgU3RyaW5nU2VsZWN0TWVudUJ1aWxkZXIgPyBvdGhlci5kYXRhIDogb3RoZXIpO1xuICB9XG59XG5cbi8qKlxuICogQSBidWlsZGVyIGZvciBjcmVhdGluZyBzZWxlY3QgbWVudSBvcHRpb25zXG4gKi9cbmV4cG9ydCBjbGFzcyBTdHJpbmdTZWxlY3RNZW51T3B0aW9uQnVpbGRlciB7XG4gIHB1YmxpYyByZWFkb25seSBkYXRhOiBQYXJ0aWFsPEFQSVNlbGVjdE1lbnVPcHRpb24+O1xuXG4gIGNvbnN0cnVjdG9yKGRhdGE6IFBhcnRpYWw8QVBJU2VsZWN0TWVudU9wdGlvbj4gPSB7fSkge1xuICAgIHRoaXMuZGF0YSA9IHsgLi4uZGF0YSB9O1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgdGhlIGxhYmVsIG9mIHRoaXMgb3B0aW9uXG4gICAqIEBwYXJhbSBsYWJlbCBUaGUgbGFiZWxcbiAgICovXG4gIHNldExhYmVsKGxhYmVsOiBzdHJpbmcpOiB0aGlzIHtcbiAgICB0aGlzLmRhdGEubGFiZWwgPSBsYWJlbDtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSB2YWx1ZSBvZiB0aGlzIG9wdGlvblxuICAgKiBAcGFyYW0gdmFsdWUgVGhlIHZhbHVlXG4gICAqL1xuICBzZXRWYWx1ZSh2YWx1ZTogc3RyaW5nKTogdGhpcyB7XG4gICAgdGhpcy5kYXRhLnZhbHVlID0gdmFsdWU7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU2V0cyB0aGUgZGVzY3JpcHRpb24gb2YgdGhpcyBvcHRpb25cbiAgICogQHBhcmFtIGRlc2NyaXB0aW9uIFRoZSBkZXNjcmlwdGlvblxuICAgKi9cbiAgc2V0RGVzY3JpcHRpb24oZGVzY3JpcHRpb246IHN0cmluZyk6IHRoaXMge1xuICAgIHRoaXMuZGF0YS5kZXNjcmlwdGlvbiA9IGRlc2NyaXB0aW9uO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgdGhlIGVtb2ppIG9mIHRoaXMgb3B0aW9uXG4gICAqIEBwYXJhbSBlbW9qaSBUaGUgZW1vamlcbiAgICovXG4gIHNldEVtb2ppKGVtb2ppOiB7IGlkPzogc3RyaW5nOyBuYW1lPzogc3RyaW5nOyBhbmltYXRlZD86IGJvb2xlYW4gfSB8IHN0cmluZyk6IHRoaXMge1xuICAgIGlmICh0eXBlb2YgZW1vamkgPT09ICdzdHJpbmcnKSB7XG4gICAgICB0aGlzLmRhdGEuZW1vamkgPSB7IG5hbWU6IGVtb2ppIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZGF0YS5lbW9qaSA9IGVtb2ppO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHdoZXRoZXIgdGhpcyBvcHRpb24gaXMgdGhlIGRlZmF1bHRcbiAgICogQHBhcmFtIGlzRGVmYXVsdCBXaGV0aGVyIHRoaXMgb3B0aW9uIGlzIHRoZSBkZWZhdWx0XG4gICAqL1xuICBzZXREZWZhdWx0KGlzRGVmYXVsdCA9IHRydWUpOiB0aGlzIHtcbiAgICB0aGlzLmRhdGEuZGVmYXVsdCA9IGlzRGVmYXVsdDtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBKU09OIHJlcHJlc2VudGF0aW9uIG9mIHRoaXMgb3B0aW9uXG4gICAqL1xuICB0b0pTT04oKTogQVBJU2VsZWN0TWVudU9wdGlvbiB7XG4gICAgcmV0dXJuIHsgLi4udGhpcy5kYXRhIH0gYXMgQVBJU2VsZWN0TWVudU9wdGlvbjtcbiAgfVxufVxuXG4vLyBBbGlhcyBmb3IgREpTIGNvbXBhdGliaWxpdHlcbmV4cG9ydCB7IFN0cmluZ1NlbGVjdE1lbnVCdWlsZGVyIGFzIFNlbGVjdE1lbnVCdWlsZGVyIH07XG5cbmV4cG9ydCBkZWZhdWx0IFN0cmluZ1NlbGVjdE1lbnVCdWlsZGVyO1xuIl19