"use strict";
/**
 * ModalBuilder for creating modals
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModalBuilder = exports.TextInputBuilder = exports.TextInputStyle = void 0;
/**
 * Text input styles
 */
var TextInputStyle;
(function (TextInputStyle) {
    TextInputStyle[TextInputStyle["Short"] = 1] = "Short";
    TextInputStyle[TextInputStyle["Paragraph"] = 2] = "Paragraph";
})(TextInputStyle || (exports.TextInputStyle = TextInputStyle = {}));
/**
 * A builder for creating text inputs
 */
class TextInputBuilder {
    data;
    constructor(data = {}) {
        this.data = { type: 4, ...data };
    }
    /**
     * Sets the custom ID of this text input
     * @param customId The custom ID
     */
    setCustomId(customId) {
        this.data.custom_id = customId;
        return this;
    }
    /**
     * Sets the label of this text input
     * @param label The label
     */
    setLabel(label) {
        this.data.label = label;
        return this;
    }
    /**
     * Sets the style of this text input
     * @param style The style
     */
    setStyle(style) {
        this.data.style = style;
        return this;
    }
    /**
     * Sets the minimum length of this text input
     * @param minLength The minimum length
     */
    setMinLength(minLength) {
        this.data.min_length = minLength;
        return this;
    }
    /**
     * Sets the maximum length of this text input
     * @param maxLength The maximum length
     */
    setMaxLength(maxLength) {
        this.data.max_length = maxLength;
        return this;
    }
    /**
     * Sets whether this text input is required
     * @param required Whether the text input is required
     */
    setRequired(required = true) {
        this.data.required = required;
        return this;
    }
    /**
     * Sets the value of this text input
     * @param value The value
     */
    setValue(value) {
        this.data.value = value;
        return this;
    }
    /**
     * Sets the placeholder of this text input
     * @param placeholder The placeholder
     */
    setPlaceholder(placeholder) {
        this.data.placeholder = placeholder;
        return this;
    }
    /**
     * Returns the JSON representation of this text input
     */
    toJSON() {
        return { ...this.data };
    }
}
exports.TextInputBuilder = TextInputBuilder;
/**
 * A builder for creating modals
 */
class ModalBuilder {
    data;
    constructor(data = {}) {
        this.data = { ...data };
        if (!this.data.components)
            this.data.components = [];
    }
    /**
     * Sets the custom ID of this modal
     * @param customId The custom ID
     */
    setCustomId(customId) {
        this.data.custom_id = customId;
        return this;
    }
    /**
     * Sets the title of this modal
     * @param title The title
     */
    setTitle(title) {
        this.data.title = title;
        return this;
    }
    /**
     * Adds components (action rows with text inputs) to this modal
     * @param components The components to add
     */
    addComponents(...components) {
        if (!this.data.components)
            this.data.components = [];
        for (const component of components) {
            if ('toJSON' in component && typeof component.toJSON === 'function') {
                this.data.components.push(component.toJSON());
            }
            else {
                this.data.components.push(component);
            }
        }
        return this;
    }
    /**
     * Sets the components of this modal
     * @param components The components to set
     */
    setComponents(...components) {
        this.data.components = [];
        return this.addComponents(...components);
    }
    /**
     * Returns the JSON representation of this modal
     */
    toJSON() {
        return { ...this.data };
    }
    /**
     * Creates a new modal builder from existing data
     * @param other The modal data to copy
     */
    static from(other) {
        return new ModalBuilder(other instanceof ModalBuilder ? other.data : other);
    }
}
exports.ModalBuilder = ModalBuilder;
exports.default = ModalBuilder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTW9kYWxCdWlsZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2J1aWxkZXJzL01vZGFsQnVpbGRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7O0dBRUc7OztBQUVIOztHQUVHO0FBQ0gsSUFBWSxjQUdYO0FBSEQsV0FBWSxjQUFjO0lBQ3hCLHFEQUFTLENBQUE7SUFDVCw2REFBYSxDQUFBO0FBQ2YsQ0FBQyxFQUhXLGNBQWMsOEJBQWQsY0FBYyxRQUd6QjtBQXlCRDs7R0FFRztBQUNILE1BQWEsZ0JBQWdCO0lBQ1gsSUFBSSxDQUFpQztJQUVyRCxZQUFZLE9BQXVDLEVBQUU7UUFDbkQsSUFBSSxDQUFDLElBQUksR0FBRyxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUUsR0FBRyxJQUFJLEVBQUUsQ0FBQztJQUNuQyxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsV0FBVyxDQUFDLFFBQWdCO1FBQzFCLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxHQUFHLFFBQVEsQ0FBQztRQUMvQixPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRDs7O09BR0c7SUFDSCxRQUFRLENBQUMsS0FBYTtRQUNwQixJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7UUFDeEIsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsUUFBUSxDQUFDLEtBQXFCO1FBQzVCLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUN4QixPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRDs7O09BR0c7SUFDSCxZQUFZLENBQUMsU0FBaUI7UUFDNUIsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEdBQUcsU0FBUyxDQUFDO1FBQ2pDLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEOzs7T0FHRztJQUNILFlBQVksQ0FBQyxTQUFpQjtRQUM1QixJQUFJLENBQUMsSUFBSSxDQUFDLFVB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KipcbiAqIE1vZGFsQnVpbGRlciBmb3IgY3JlYXRpbmcgbW9kYWxzXG4gKi9cblxuLyoqXG4gKiBUZXh0IGlucHV0IHN0eWxlc1xuICovXG5leHBvcnQgZW51bSBUZXh0SW5wdXRTdHlsZSB7XG4gIFNob3J0ID0gMSxcbiAgUGFyYWdyYXBoID0gMixcbn1cblxuZXhwb3J0IGludGVyZmFjZSBBUElUZXh0SW5wdXRDb21wb25lbnQge1xuICB0eXBlOiA0O1xuICBjdXN0b21faWQ6IHN0cmluZztcbiAgc3R5bGU6IFRleHRJbnB1dFN0eWxlO1xuICBsYWJlbDogc3RyaW5nO1xuICBtaW5fbGVuZ3RoPzogbnVtYmVyO1xuICBtYXhfbGVuZ3RoPzogbnVtYmVyO1xuICByZXF1aXJlZD86IGJvb2xlYW47XG4gIHZhbHVlPzogc3RyaW5nO1xuICBwbGFjZWhvbGRlcj86IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBBUElNb2RhbEFjdGlvblJvdyB7XG4gIHR5cGU6IDE7XG4gIGNvbXBvbmVudHM6IEFQSVRleHRJbnB1dENvbXBvbmVudFtdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEFQSU1vZGFsIHtcbiAgY3VzdG9tX2lkOiBzdHJpbmc7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIGNvbXBvbmVudHM6IEFQSU1vZGFsQWN0aW9uUm93W107XG59XG5cbi8qKlxuICogQSBidWlsZGVyIGZvciBjcmVhdGluZyB0ZXh0IGlucHV0c1xuICovXG5leHBvcnQgY2xhc3MgVGV4dElucHV0QnVpbGRlciB7XG4gIHB1YmxpYyByZWFkb25seSBkYXRhOiBQYXJ0aWFsPEFQSVRleHRJbnB1dENvbXBvbmVudD47XG5cbiAgY29uc3RydWN0b3IoZGF0YTogUGFydGlhbDxBUElUZXh0SW5wdXRDb21wb25lbnQ+ID0ge30pIHtcbiAgICB0aGlzLmRhdGEgPSB7IHR5cGU6IDQsIC4uLmRhdGEgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSBjdXN0b20gSUQgb2YgdGhpcyB0ZXh0IGlucHV0XG4gICAqIEBwYXJhbSBjdXN0b21JZCBUaGUgY3VzdG9tIElEXG4gICAqL1xuICBzZXRDdXN0b21JZChjdXN0b21JZDogc3RyaW5nKTogdGhpcyB7XG4gICAgdGhpcy5kYXRhLmN1c3RvbV9pZCA9IGN1c3RvbUlkO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgdGhlIGxhYmVsIG9mIHRoaXMgdGV4dCBpbnB1dFxuICAgKiBAcGFyYW0gbGFiZWwgVGhlIGxhYmVsXG4gICAqL1xuICBzZXRMYWJlbChsYWJlbDogc3RyaW5nKTogdGhpcyB7XG4gICAgdGhpcy5kYXRhLmxhYmVsID0gbGFiZWw7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU2V0cyB0aGUgc3R5bGUgb2YgdGhpcyB0ZXh0IGlucHV0XG4gICAqIEBwYXJhbSBzdHlsZSBUaGUgc3R5bGVcbiAgICovXG4gIHNldFN0eWxlKHN0eWxlOiBUZXh0SW5wdXRTdHlsZSk6IHRoaXMge1xuICAgIHRoaXMuZGF0YS5zdHlsZSA9IHN0eWxlO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgdGhlIG1pbmltdW0gbGVuZ3RoIG9mIHRoaXMgdGV4dCBpbnB1dFxuICAgKiBAcGFyYW0gbWluTGVuZ3RoIFRoZSBtaW5pbXVtIGxlbmd0aFxuICAgKi9cbiAgc2V0TWluTGVuZ3RoKG1pbkxlbmd0aDogbnVtYmVyKTogdGhpcyB7XG4gICAgdGhpcy5kYXRhLm1pbl9sZW5ndGggPSBtaW5MZW5ndGg7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU2V0cyB0aGUgbWF4aW11bSBsZW5ndGggb2YgdGhpcyB0ZXh0IGlucHV0XG4gICAqIEBwYXJhbSBtYXhMZW5ndGggVGhlIG1heGltdW0gbGVuZ3RoXG4gICAqL1xuICBzZXRNYXhMZW5ndGgobWF4TGVuZ3RoOiBudW1iZXIpOiB0aGlzIHtcbiAgICB0aGlzLmRhdGEubWF4X2xlbmd0aCA9IG1heExlbmd0aDtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHdoZXRoZXIgdGhpcyB0ZXh0IGlucHV0IGlzIHJlcXVpcmVkXG4gICAqIEBwYXJhbSByZXF1aXJlZCBXaGV0aGVyIHRoZSB0ZXh0IGlucHV0IGlzIHJlcXVpcmVkXG4gICAqL1xuICBzZXRSZXF1aXJlZChyZXF1aXJlZCA9IHRydWUpOiB0aGlzIHtcbiAgICB0aGlzLmRhdGEucmVxdWlyZWQgPSByZXF1aXJlZDtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSB2YWx1ZSBvZiB0aGlzIHRleHQgaW5wdXRcbiAgICogQHBhcmFtIHZhbHVlIFRoZSB2YWx1ZVxuICAgKi9cbiAgc2V0VmFsdWUodmFsdWU6IHN0cmluZyk6IHRoaXMge1xuICAgIHRoaXMuZGF0YS52YWx1ZSA9IHZhbHVlO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgdGhlIHBsYWNlaG9sZGVyIG9mIHRoaXMgdGV4dCBpbnB1dFxuICAgKiBAcGFyYW0gcGxhY2Vob2xkZXIgVGhlIHBsYWNlaG9sZGVyXG4gICAqL1xuICBzZXRQbGFjZWhvbGRlcihwbGFjZWhvbGRlcjogc3RyaW5nKTogdGhpcyB7XG4gICAgdGhpcy5kYXRhLnBsYWNlaG9sZGVyID0gcGxhY2Vob2xkZXI7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyB0aGUgSlNPTiByZXByZXNlbnRhdGlvbiBvZiB0aGlzIHRleHQgaW5wdXRcbiAgICovXG4gIHRvSlNPTigpOiBBUElUZXh0SW5wdXRDb21wb25lbnQge1xuICAgIHJldHVybiB7IC4uLnRoaXMuZGF0YSB9IGFzIEFQSVRleHRJbnB1dENvbXBvbmVudDtcbiAgfVxufVxuXG4vKipcbiAqIEEgYnVpbGRlciBmb3IgY3JlYXRpbmcgbW9kYWxzXG4gKi9cbmV4cG9ydCBjbGFzcyBNb2RhbEJ1aWxkZXIge1xuICBwdWJsaWMgcmVhZG9ubHkgZGF0YTogUGFydGlhbDxBUElNb2RhbD47XG5cbiAgY29uc3RydWN0b3IoZGF0YTogUGFydGlhbDxBUElNb2RhbD4gPSB7fSkge1xuICAgIHRoaXMuZGF0YSA9IHsgLi4uZGF0YSB9O1xuICAgIGlmICghdGhpcy5kYXRhLmNvbXBvbmVudHMpIHRoaXMuZGF0YS5jb21wb25lbnRzID0gW107XG4gIH1cblxuICAvKipcbiAgICogU2V0cyB0aGUgY3VzdG9tIElEIG9mIHRoaXMgbW9kYWxcbiAgICogQHBhcmFtIGN1c3RvbUlkIFRoZSBjdXN0b20gSURcbiAgICovXG4gIHNldEN1c3RvbUlkKGN1c3RvbUlkOiBzdHJpbmcpOiB0aGlzIHtcbiAgICB0aGlzLmRhdGEuY3VzdG9tX2lkID0gY3VzdG9tSWQ7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU2V0cyB0aGUgdGl0bGUgb2YgdGhpcyBtb2RhbFxuICAgKiBAcGFyYW0gdGl0bGUgVGhlIHRpdGxlXG4gICAqL1xuICBzZXRUaXRsZSh0aXRsZTogc3RyaW5nKTogdGhpcyB7XG4gICAgdGhpcy5kYXRhLnRpdGxlID0gdGl0bGU7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogQWRkcyBjb21wb25lbnRzIChhY3Rpb24gcm93cyB3aXRoIHRleHQgaW5wdXRzKSB0byB0aGlzIG1vZGFsXG4gICAqIEBwYXJhbSBjb21wb25lbnRzIFRoZSBjb21wb25lbnRzIHRvIGFkZFxuICAgKi9cbiAgYWRkQ29tcG9uZW50cyguLi5jb21wb25lbnRzOiAoQVBJTW9kYWxBY3Rpb25Sb3cgfCB7IHRvSlNPTigpOiBBUElNb2RhbEFjdGlvblJvdyB9KVtdKTogdGhpcyB7XG4gICAgaWYgKCF0aGlzLmRhdGEuY29tcG9uZW50cykgdGhpcy5kYXRhLmNvbXBvbmVudHMgPSBbXTtcbiAgICBmb3IgKGNvbnN0IGNvbXBvbmVudCBvZiBjb21wb25lbnRzKSB7XG4gICAgICBpZiAoJ3RvSlNPTicgaW4gY29tcG9uZW50ICYmIHR5cGVvZiBjb21wb25lbnQudG9KU09OID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHRoaXMuZGF0YS5jb21wb25lbnRzLnB1c2goY29tcG9uZW50LnRvSlNPTigpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZGF0YS5jb21wb25lbnRzLnB1c2goY29tcG9uZW50IGFzIEFQSU1vZGFsQWN0aW9uUm93KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU2V0cyB0aGUgY29tcG9uZW50cyBvZiB0aGlzIG1vZGFsXG4gICAqIEBwYXJhbSBjb21wb25lbnRzIFRoZSBjb21wb25lbnRzIHRvIHNldFxuICAgKi9cbiAgc2V0Q29tcG9uZW50cyguLi5jb21wb25lbnRzOiAoQVBJTW9kYWxBY3Rpb25Sb3cgfCB7IHRvSlNPTigpOiBBUElNb2RhbEFjdGlvblJvdyB9KVtdKTogdGhpcyB7XG4gICAgdGhpcy5kYXRhLmNvbXBvbmVudHMgPSBbXTtcbiAgICByZXR1cm4gdGhpcy5hZGRDb21wb25lbnRzKC4uLmNvbXBvbmVudHMpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIEpTT04gcmVwcmVzZW50YXRpb24gb2YgdGhpcyBtb2RhbFxuICAgKi9cbiAgdG9KU09OKCk6IEFQSU1vZGFsIHtcbiAgICByZXR1cm4geyAuLi50aGlzLmRhdGEgfSBhcyBBUElNb2RhbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IG1vZGFsIGJ1aWxkZXIgZnJvbSBleGlzdGluZyBkYXRhXG4gICAqIEBwYXJhbSBvdGhlciBUaGUgbW9kYWwgZGF0YSB0byBjb3B5XG4gICAqL1xuICBzdGF0aWMgZnJvbShvdGhlcjogUGFydGlhbDxBUElNb2RhbD4gfCBNb2RhbEJ1aWxkZXIpOiBNb2RhbEJ1aWxkZXIge1xuICAgIHJldHVybiBuZXcgTW9kYWxCdWlsZGVyKG90aGVyIGluc3RhbmNlb2YgTW9kYWxCdWlsZGVyID8gb3RoZXIuZGF0YSA6IG90aGVyKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBNb2RhbEJ1aWxkZXI7XG4iXX0=