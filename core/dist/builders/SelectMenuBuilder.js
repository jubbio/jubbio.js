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
exports.default = StringSelectMenuBuilder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiU2VsZWN0TWVudUJ1aWxkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvYnVpbGRlcnMvU2VsZWN0TWVudUJ1aWxkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOztHQUVHOzs7QUFvQkg7O0dBRUc7QUFDSCxNQUFhLHVCQUF1QjtJQUNsQixJQUFJLENBQWtDO0lBRXRELFlBQVksT0FBd0MsRUFBRTtRQUNwRCxJQUFJLENBQUMsSUFBSSxHQUFHLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxHQUFHLElBQUksRUFBRSxDQUFDO1FBQ2pDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU87WUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7SUFDakQsQ0FBQztJQUVEOzs7T0FHRztJQUNILFdBQVcsQ0FBQyxRQUFnQjtRQUMxQixJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsR0FBRyxRQUFRLENBQUM7UUFDL0IsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsY0FBYyxDQUFDLFdBQW1CO1FBQ2hDLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQztRQUNwQyxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRDs7O09BR0c7SUFDSCxZQUFZLENBQUMsU0FBaUI7UUFDNUIsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEdBQUcsU0FBUyxDQUFDO1FBQ2pDLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEOzs7T0FHRztJQUNILFlBQVksQ0FBQyxTQUFpQjtRQUM1QixJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsR0FBRyxTQUFTLENBQUM7UUFDakMsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsV0FBVyxDQUFDLFFBQVEsR0FBRyxJQUFJO1FBQ3pCLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxH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UUFDcEMsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsUUFBUSxDQUFDLEtBQWtFO1FBQ3pFLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxFQUFFLENBQUM7WUFDOUIsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLEdBQUcsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLENBQUM7UUFDcEMsQ0FBQzthQUFNLENBQUM7WUFDTixJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7UUFDMUIsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEOzs7T0FHRztJQUNILFVBQVUsQ0FBQyxTQUFTLEdBQUcsSUFBSTtRQUN6QixJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sR0FBRyxTQUFTLENBQUM7UUFDOUIsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxNQUFNO1FBQ0osT0FBTyxFQUFFLEdBQUcsSUFBSSxDQUFDLElBQUksRUFBeUIsQ0FBQztJQUNqRCxDQUFDO0NBQ0Y7QUE5REQsc0VBOERDO0FBS0Qsa0JBQWUsdUJBQXVCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFNlbGVjdE1lbnVCdWlsZGVyIGZvciBjcmVhdGluZyBzZWxlY3QgbWVudXNcbiAqL1xuXG5leHBvcnQgaW50ZXJmYWNlIEFQSVNlbGVjdE1lbnVPcHRpb24ge1xuICBsYWJlbDogc3RyaW5nO1xuICB2YWx1ZTogc3RyaW5nO1xuICBkZXNjcmlwdGlvbj86IHN0cmluZztcbiAgZW1vamk/OiB7IGlkPzogc3RyaW5nOyBuYW1lPzogc3RyaW5nOyBhbmltYXRlZD86IGJvb2xlYW4gfTtcbiAgZGVmYXVsdD86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQVBJU2VsZWN0TWVudUNvbXBvbmVudCB7XG4gIHR5cGU6IDM7XG4gIGN1c3RvbV9pZDogc3RyaW5nO1xuICBvcHRpb25zPzogQVBJU2VsZWN0TWVudU9wdGlvbltdO1xuICBwbGFjZWhvbGRlcj86IHN0cmluZztcbiAgbWluX3ZhbHVlcz86IG51bWJlcjtcbiAgbWF4X3ZhbHVlcz86IG51bWJlcjtcbiAgZGlzYWJsZWQ/OiBib29sZWFuO1xufVxuXG4vKipcbiAqIEEgYnVpbGRlciBmb3IgY3JlYXRpbmcgc3RyaW5nIHNlbGVjdCBtZW51c1xuICovXG5leHBvcnQgY2xhc3MgU3RyaW5nU2VsZWN0TWVudUJ1aWxkZXIge1xuICBwdWJsaWMgcmVhZG9ubHkgZGF0YTogUGFydGlhbDxBUElTZWxlY3RNZW51Q29tcG9uZW50PjtcblxuICBjb25zdHJ1Y3RvcihkYXRhOiBQYXJ0aWFsPEFQSVNlbGVjdE1lbnVDb21wb25lbnQ+ID0ge30pIHtcbiAgICB0aGlzLmRhdGEgPSB7IHR5cGU6IDMsIC4uLmRhdGEgfTtcbiAgICBpZiAoIXRoaXMuZGF0YS5vcHRpb25zKSB0aGlzLmRhdGEub3B0aW9ucyA9IFtdO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgdGhlIGN1c3RvbSBJRCBvZiB0aGlzIHNlbGVjdCBtZW51XG4gICAqIEBwYXJhbSBjdXN0b21JZCBUaGUgY3VzdG9tIElEXG4gICAqL1xuICBzZXRDdXN0b21JZChjdXN0b21JZDogc3RyaW5nKTogdGhpcyB7XG4gICAgdGhpcy5kYXRhLmN1c3RvbV9pZCA9IGN1c3RvbUlkO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgdGhlIHBsYWNlaG9sZGVyIG9mIHRoaXMgc2VsZWN0IG1lbnVcbiAgICogQHBhcmFtIHBsYWNlaG9sZGVyIFRoZSBwbGFjZWhvbGRlclxuICAgKi9cbiAgc2V0UGxhY2Vob2xkZXIocGxhY2Vob2xkZXI6IHN0cmluZyk6IHRoaXMge1xuICAgIHRoaXMuZGF0YS5wbGFjZWhvbGRlciA9IHBsYWNlaG9sZGVyO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgdGhlIG1pbmltdW0gdmFsdWVzIG9mIHRoaXMgc2VsZWN0IG1lbnVcbiAgICogQHBhcmFtIG1pblZhbHVlcyBUaGUgbWluaW11bSB2YWx1ZXNcbiAgICovXG4gIHNldE1pblZhbHVlcyhtaW5WYWx1ZXM6IG51bWJlcik6IHRoaXMge1xuICAgIHRoaXMuZGF0YS5taW5fdmFsdWVzID0gbWluVmFsdWVzO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgdGhlIG1heGltdW0gdmFsdWVzIG9mIHRoaXMgc2VsZWN0IG1lbnVcbiAgICogQHBhcmFtIG1heFZhbHVlcyBUaGUgbWF4aW11bSB2YWx1ZXNcbiAgICovXG4gIHNldE1heFZhbHVlcyhtYXhWYWx1ZXM6IG51bWJlcik6IHRoaXMge1xuICAgIHRoaXMuZGF0YS5tYXhfdmFsdWVzID0gbWF4VmFsdWVzO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgd2hldGhlciB0aGlzIHNlbGVjdCBtZW51IGlzIGRpc2FibGVkXG4gICAqIEBwYXJhbSBkaXNhYmxlZCBXaGV0aGVyIHRoZSBzZWxlY3QgbWVudSBpcyBkaXNhYmxlZFxuICAgKi9cbiAgc2V0RGlzYWJsZWQoZGlzYWJsZWQgPSB0cnVlKTogdGhpcyB7XG4gICAgdGhpcy5kYXRhLmRpc2FibGVkID0gZGlzYWJsZWQ7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogQWRkcyBvcHRpb25zIHRvIHRoaXMgc2VsZWN0IG1lbnVcbiAgICogQWNjZXB0cyBpbmRpdmlkdWFsIG9wdGlvbnMgb3IgYW4gYXJyYXkgb2Ygb3B0aW9uc1xuICAgKi9cbiAgYWRkT3B0aW9ucyguLi5vcHRpb25zOiAoQVBJU2VsZWN0TWVudU9wdGlvbiB8IEFQSVNlbGVjdE1lbnVPcHRpb25bXSlbXSk6IHRoaXMge1xuICAgIGlmICghdGhpcy5kYXRhLm9wdGlvbnMpIHRoaXMuZGF0YS5vcHRpb25zID0gW107XG4gICAgZm9yIChjb25zdCBvcHQgb2Ygb3B0aW9ucykge1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkob3B0KSkge1xuICAgICAgICB0aGlzLmRhdGEub3B0aW9ucy5wdXNoKC4uLm9wdCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmRhdGEub3B0aW9ucy5wdXNoKG9wdCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgdGhlIG9wdGlvbnMgb2YgdGhpcyBzZWxlY3QgbWVudVxuICAgKiBBY2NlcHRzIGluZGl2aWR1YWwgb3B0aW9ucyBvciBhbiBhcnJheSBvZiBvcHRpb25zXG4gICAqL1xuICBzZXRPcHRpb25zKC4uLm9wdGlvbnM6IChBUElTZWxlY3RNZW51T3B0aW9uIHwgQVBJU2VsZWN0TWVudU9wdGlvbltdKVtdKTogdGhpcyB7XG4gICAgdGhpcy5kYXRhLm9wdGlvbnMgPSBbXTtcbiAgICBmb3IgKGNvbnN0IG9wdCBvZiBvcHRpb25zKSB7XG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShvcHQpKSB7XG4gICAgICAgIHRoaXMuZGF0YS5vcHRpb25zLnB1c2goLi4ub3B0KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZGF0YS5vcHRpb25zLnB1c2gob3B0KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlcywgcmVwbGFjZXMsIG9yIGluc2VydHMgb3B0aW9uc1xuICAgKiBAcGFyYW0gaW5kZXggVGhlIGluZGV4IHRvIHN0YXJ0IGF0XG4gICAqIEBwYXJhbSBkZWxldGVDb3VudCBUaGUgbnVtYmVyIG9mIG9wdGlvbnMgdG8gcmVtb3ZlXG4gICAqIEBwYXJhbSBvcHRpb25zIFRoZSBvcHRpb25zIHRvIGluc2VydFxuICAgKi9cbiAgc3BsaWNlT3B0aW9ucyhpbmRleDogbnVtYmVyLCBkZWxldGVDb3VudDogbnVtYmVyLCAuLi5vcHRpb25zOiBBUElTZWxlY3RNZW51T3B0aW9uW10pOiB0aGlzIHtcbiAgICBpZiAoIXRoaXMuZGF0YS5vcHRpb25zKSB0aGlzLmRhdGEub3B0aW9ucyA9IFtdO1xuICAgIHRoaXMuZGF0YS5vcHRpb25zLnNwbGljZShpbmRleCwgZGVsZXRlQ291bnQsIC4uLm9wdGlvbnMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIEpTT04gcmVwcmVzZW50YXRpb24gb2YgdGhpcyBzZWxlY3QgbWVudVxuICAgKi9cbiAgdG9KU09OKCk6IEFQSVNlbGVjdE1lbnVDb21wb25lbnQge1xuICAgIHJldHVybiB7IC4uLnRoaXMuZGF0YSB9IGFzIEFQSVNlbGVjdE1lbnVDb21wb25lbnQ7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBzZWxlY3QgbWVudSBidWlsZGVyIGZyb20gZXhpc3RpbmcgZGF0YVxuICAgKiBAcGFyYW0gb3RoZXIgVGhlIHNlbGVjdCBtZW51IGRhdGEgdG8gY29weVxuICAgKi9cbiAgc3RhdGljIGZyb20ob3RoZXI6IFBhcnRpYWw8QVBJU2VsZWN0TWVudUNvbXBvbmVudD4gfCBTdHJpbmdTZWxlY3RNZW51QnVpbGRlcik6IFN0cmluZ1NlbGVjdE1lbnVCdWlsZGVyIHtcbiAgICByZXR1cm4gbmV3IFN0cmluZ1NlbGVjdE1lbnVCdWlsZGVyKG90aGVyIGluc3RhbmNlb2YgU3RyaW5nU2VsZWN0TWVudUJ1aWxkZXIgPyBvdGhlci5kYXRhIDogb3RoZXIpO1xuICB9XG59XG5cbi8qKlxuICogQSBidWlsZGVyIGZvciBjcmVhdGluZyBzZWxlY3QgbWVudSBvcHRpb25zXG4gKi9cbmV4cG9ydCBjbGFzcyBTdHJpbmdTZWxlY3RNZW51T3B0aW9uQnVpbGRlciB7XG4gIHB1YmxpYyByZWFkb25seSBkYXRhOiBQYXJ0aWFsPEFQSVNlbGVjdE1lbnVPcHRpb24+O1xuXG4gIGNvbnN0cnVjdG9yKGRhdGE6IFBhcnRpYWw8QVBJU2VsZWN0TWVudU9wdGlvbj4gPSB7fSkge1xuICAgIHRoaXMuZGF0YSA9IHsgLi4uZGF0YSB9O1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgdGhlIGxhYmVsIG9mIHRoaXMgb3B0aW9uXG4gICAqIEBwYXJhbSBsYWJlbCBUaGUgbGFiZWxcbiAgICovXG4gIHNldExhYmVsKGxhYmVsOiBzdHJpbmcpOiB0aGlzIHtcbiAgICB0aGlzLmRhdGEubGFiZWwgPSBsYWJlbDtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSB2YWx1ZSBvZiB0aGlzIG9wdGlvblxuICAgKiBAcGFyYW0gdmFsdWUgVGhlIHZhbHVlXG4gICAqL1xuICBzZXRWYWx1ZSh2YWx1ZTogc3RyaW5nKTogdGhpcyB7XG4gICAgdGhpcy5kYXRhLnZhbHVlID0gdmFsdWU7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU2V0cyB0aGUgZGVzY3JpcHRpb24gb2YgdGhpcyBvcHRpb25cbiAgICogQHBhcmFtIGRlc2NyaXB0aW9uIFRoZSBkZXNjcmlwdGlvblxuICAgKi9cbiAgc2V0RGVzY3JpcHRpb24oZGVzY3JpcHRpb246IHN0cmluZyk6IHRoaXMge1xuICAgIHRoaXMuZGF0YS5kZXNjcmlwdGlvbiA9IGRlc2NyaXB0aW9uO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgdGhlIGVtb2ppIG9mIHRoaXMgb3B0aW9uXG4gICAqIEBwYXJhbSBlbW9qaSBUaGUgZW1vamlcbiAgICovXG4gIHNldEVtb2ppKGVtb2ppOiB7IGlkPzogc3RyaW5nOyBuYW1lPzogc3RyaW5nOyBhbmltYXRlZD86IGJvb2xlYW4gfSB8IHN0cmluZyk6IHRoaXMge1xuICAgIGlmICh0eXBlb2YgZW1vamkgPT09ICdzdHJpbmcnKSB7XG4gICAgICB0aGlzLmRhdGEuZW1vamkgPSB7IG5hbWU6IGVtb2ppIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZGF0YS5lbW9qaSA9IGVtb2ppO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHdoZXRoZXIgdGhpcyBvcHRpb24gaXMgdGhlIGRlZmF1bHRcbiAgICogQHBhcmFtIGlzRGVmYXVsdCBXaGV0aGVyIHRoaXMgb3B0aW9uIGlzIHRoZSBkZWZhdWx0XG4gICAqL1xuICBzZXREZWZhdWx0KGlzRGVmYXVsdCA9IHRydWUpOiB0aGlzIHtcbiAgICB0aGlzLmRhdGEuZGVmYXVsdCA9IGlzRGVmYXVsdDtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBKU09OIHJlcHJlc2VudGF0aW9uIG9mIHRoaXMgb3B0aW9uXG4gICAqL1xuICB0b0pTT04oKTogQVBJU2VsZWN0TWVudU9wdGlvbiB7XG4gICAgcmV0dXJuIHsgLi4udGhpcy5kYXRhIH0gYXMgQVBJU2VsZWN0TWVudU9wdGlvbjtcbiAgfVxufVxuXG4vLyBBbGlhcyBmb3IgREpTIGNvbXBhdGliaWxpdHlcbmV4cG9ydCB7IFN0cmluZ1NlbGVjdE1lbnVCdWlsZGVyIGFzIFNlbGVjdE1lbnVCdWlsZGVyIH07XG5cbmV4cG9ydCBkZWZhdWx0IFN0cmluZ1NlbGVjdE1lbnVCdWlsZGVyO1xuIl19