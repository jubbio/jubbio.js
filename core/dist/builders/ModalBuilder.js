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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTW9kYWxCdWlsZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2J1aWxkZXJzL01vZGFsQnVpbGRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7O0dBRUc7OztBQUVIOztHQUVHO0FBQ0gsSUFBWSxjQUdYO0FBSEQsV0FBWSxjQUFjO0lBQ3hCLHFEQUFTLENBQUE7SUFDVCw2REFBYSxDQUFBO0FBQ2YsQ0FBQyxFQUhXLGNBQWMsOEJBQWQsY0FBYyxRQUd6QjtBQXlCRDs7R0FFRztBQUNILE1BQWEsZ0JBQWdCO0lBQ1gsSUFBSSxDQUFpQztJQUVyRCxZQUFZLE9BQXVDLEVBQUU7UUFDbkQsSUFBSSxDQUFDLElBQUksR0FBRyxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUUsR0FBRyxJQUFJLEVBQUUsQ0FBQztJQUNuQyxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsV0FBVyxDQUFDLFFBQWdCO1FBQzFCLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxHQUFHLFFBQVEsQ0FBQztRQUMvQixPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRDs7O09BR0c7SUFDSCxRQUFRLENBQUMsS0FBYTtRQUNwQixJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7UUFDeEIsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsUUFBUSxDQUFDLEtBQXFCO1FBQzVCLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUN4QixPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRDs7O09BR0c7SUFDSCxZQUFZLENBQUMsU0FBaUI7UUFDNUIsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEdBQUcsU0FBUyxDQUFDO1FBQ2pDLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEOzs7T0FHRztJQUNILFlBQVksQ0FBQyxTQUFpQjtRQUM1QixJQUFJLENBQUMsSUFBSSxDQUFDLFVB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KipcclxuICogTW9kYWxCdWlsZGVyIGZvciBjcmVhdGluZyBtb2RhbHNcclxuICovXHJcblxyXG4vKipcclxuICogVGV4dCBpbnB1dCBzdHlsZXNcclxuICovXHJcbmV4cG9ydCBlbnVtIFRleHRJbnB1dFN0eWxlIHtcclxuICBTaG9ydCA9IDEsXHJcbiAgUGFyYWdyYXBoID0gMixcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBBUElUZXh0SW5wdXRDb21wb25lbnQge1xyXG4gIHR5cGU6IDQ7XHJcbiAgY3VzdG9tX2lkOiBzdHJpbmc7XHJcbiAgc3R5bGU6IFRleHRJbnB1dFN0eWxlO1xyXG4gIGxhYmVsOiBzdHJpbmc7XHJcbiAgbWluX2xlbmd0aD86IG51bWJlcjtcclxuICBtYXhfbGVuZ3RoPzogbnVtYmVyO1xyXG4gIHJlcXVpcmVkPzogYm9vbGVhbjtcclxuICB2YWx1ZT86IHN0cmluZztcclxuICBwbGFjZWhvbGRlcj86IHN0cmluZztcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBBUElNb2RhbEFjdGlvblJvdyB7XHJcbiAgdHlwZTogMTtcclxuICBjb21wb25lbnRzOiBBUElUZXh0SW5wdXRDb21wb25lbnRbXTtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBBUElNb2RhbCB7XHJcbiAgY3VzdG9tX2lkOiBzdHJpbmc7XHJcbiAgdGl0bGU6IHN0cmluZztcclxuICBjb21wb25lbnRzOiBBUElNb2RhbEFjdGlvblJvd1tdO1xyXG59XHJcblxyXG4vKipcclxuICogQSBidWlsZGVyIGZvciBjcmVhdGluZyB0ZXh0IGlucHV0c1xyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFRleHRJbnB1dEJ1aWxkZXIge1xyXG4gIHB1YmxpYyByZWFkb25seSBkYXRhOiBQYXJ0aWFsPEFQSVRleHRJbnB1dENvbXBvbmVudD47XHJcblxyXG4gIGNvbnN0cnVjdG9yKGRhdGE6IFBhcnRpYWw8QVBJVGV4dElucHV0Q29tcG9uZW50PiA9IHt9KSB7XHJcbiAgICB0aGlzLmRhdGEgPSB7IHR5cGU6IDQsIC4uLmRhdGEgfTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldHMgdGhlIGN1c3RvbSBJRCBvZiB0aGlzIHRleHQgaW5wdXRcclxuICAgKiBAcGFyYW0gY3VzdG9tSWQgVGhlIGN1c3RvbSBJRFxyXG4gICAqL1xyXG4gIHNldEN1c3RvbUlkKGN1c3RvbUlkOiBzdHJpbmcpOiB0aGlzIHtcclxuICAgIHRoaXMuZGF0YS5jdXN0b21faWQgPSBjdXN0b21JZDtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2V0cyB0aGUgbGFiZWwgb2YgdGhpcyB0ZXh0IGlucHV0XHJcbiAgICogQHBhcmFtIGxhYmVsIFRoZSBsYWJlbFxyXG4gICAqL1xyXG4gIHNldExhYmVsKGxhYmVsOiBzdHJpbmcpOiB0aGlzIHtcclxuICAgIHRoaXMuZGF0YS5sYWJlbCA9IGxhYmVsO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZXRzIHRoZSBzdHlsZSBvZiB0aGlzIHRleHQgaW5wdXRcclxuICAgKiBAcGFyYW0gc3R5bGUgVGhlIHN0eWxlXHJcbiAgICovXHJcbiAgc2V0U3R5bGUoc3R5bGU6IFRleHRJbnB1dFN0eWxlKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEuc3R5bGUgPSBzdHlsZTtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2V0cyB0aGUgbWluaW11bSBsZW5ndGggb2YgdGhpcyB0ZXh0IGlucHV0XHJcbiAgICogQHBhcmFtIG1pbkxlbmd0aCBUaGUgbWluaW11bSBsZW5ndGhcclxuICAgKi9cclxuICBzZXRNaW5MZW5ndGgobWluTGVuZ3RoOiBudW1iZXIpOiB0aGlzIHtcclxuICAgIHRoaXMuZGF0YS5taW5fbGVuZ3RoID0gbWluTGVuZ3RoO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZXRzIHRoZSBtYXhpbXVtIGxlbmd0aCBvZiB0aGlzIHRleHQgaW5wdXRcclxuICAgKiBAcGFyYW0gbWF4TGVuZ3RoIFRoZSBtYXhpbXVtIGxlbmd0aFxyXG4gICAqL1xyXG4gIHNldE1heExlbmd0aChtYXhMZW5ndGg6IG51bWJlcik6IHRoaXMge1xyXG4gICAgdGhpcy5kYXRhLm1heF9sZW5ndGggPSBtYXhMZW5ndGg7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldHMgd2hldGhlciB0aGlzIHRleHQgaW5wdXQgaXMgcmVxdWlyZWRcclxuICAgKiBAcGFyYW0gcmVxdWlyZWQgV2hldGhlciB0aGUgdGV4dCBpbnB1dCBpcyByZXF1aXJlZFxyXG4gICAqL1xyXG4gIHNldFJlcXVpcmVkKHJlcXVpcmVkID0gdHJ1ZSk6IHRoaXMge1xyXG4gICAgdGhpcy5kYXRhLnJlcXVpcmVkID0gcmVxdWlyZWQ7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldHMgdGhlIHZhbHVlIG9mIHRoaXMgdGV4dCBpbnB1dFxyXG4gICAqIEBwYXJhbSB2YWx1ZSBUaGUgdmFsdWVcclxuICAgKi9cclxuICBzZXRWYWx1ZSh2YWx1ZTogc3RyaW5nKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEudmFsdWUgPSB2YWx1ZTtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2V0cyB0aGUgcGxhY2Vob2xkZXIgb2YgdGhpcyB0ZXh0IGlucHV0XHJcbiAgICogQHBhcmFtIHBsYWNlaG9sZGVyIFRoZSBwbGFjZWhvbGRlclxyXG4gICAqL1xyXG4gIHNldFBsYWNlaG9sZGVyKHBsYWNlaG9sZGVyOiBzdHJpbmcpOiB0aGlzIHtcclxuICAgIHRoaXMuZGF0YS5wbGFjZWhvbGRlciA9IHBsYWNlaG9sZGVyO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZXR1cm5zIHRoZSBKU09OIHJlcHJlc2VudGF0aW9uIG9mIHRoaXMgdGV4dCBpbnB1dFxyXG4gICAqL1xyXG4gIHRvSlNPTigpOiBBUElUZXh0SW5wdXRDb21wb25lbnQge1xyXG4gICAgcmV0dXJuIHsgLi4udGhpcy5kYXRhIH0gYXMgQVBJVGV4dElucHV0Q29tcG9uZW50O1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIEEgYnVpbGRlciBmb3IgY3JlYXRpbmcgbW9kYWxzXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgTW9kYWxCdWlsZGVyIHtcclxuICBwdWJsaWMgcmVhZG9ubHkgZGF0YTogUGFydGlhbDxBUElNb2RhbD47XHJcblxyXG4gIGNvbnN0cnVjdG9yKGRhdGE6IFBhcnRpYWw8QVBJTW9kYWw+ID0ge30pIHtcclxuICAgIHRoaXMuZGF0YSA9IHsgLi4uZGF0YSB9O1xyXG4gICAgaWYgKCF0aGlzLmRhdGEuY29tcG9uZW50cykgdGhpcy5kYXRhLmNvbXBvbmVudHMgPSBbXTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldHMgdGhlIGN1c3RvbSBJRCBvZiB0aGlzIG1vZGFsXHJcbiAgICogQHBhcmFtIGN1c3RvbUlkIFRoZSBjdXN0b20gSURcclxuICAgKi9cclxuICBzZXRDdXN0b21JZChjdXN0b21JZDogc3RyaW5nKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEuY3VzdG9tX2lkID0gY3VzdG9tSWQ7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldHMgdGhlIHRpdGxlIG9mIHRoaXMgbW9kYWxcclxuICAgKiBAcGFyYW0gdGl0bGUgVGhlIHRpdGxlXHJcbiAgICovXHJcbiAgc2V0VGl0bGUodGl0bGU6IHN0cmluZyk6IHRoaXMge1xyXG4gICAgdGhpcy5kYXRhLnRpdGxlID0gdGl0bGU7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEFkZHMgY29tcG9uZW50cyAoYWN0aW9uIHJvd3Mgd2l0aCB0ZXh0IGlucHV0cykgdG8gdGhpcyBtb2RhbFxyXG4gICAqIEBwYXJhbSBjb21wb25lbnRzIFRoZSBjb21wb25lbnRzIHRvIGFkZFxyXG4gICAqL1xyXG4gIGFkZENvbXBvbmVudHMoLi4uY29tcG9uZW50czogKEFQSU1vZGFsQWN0aW9uUm93IHwgeyB0b0pTT04oKTogQVBJTW9kYWxBY3Rpb25Sb3cgfSlbXSk6IHRoaXMge1xyXG4gICAgaWYgKCF0aGlzLmRhdGEuY29tcG9uZW50cykgdGhpcy5kYXRhLmNvbXBvbmVudHMgPSBbXTtcclxuICAgIGZvciAoY29uc3QgY29tcG9uZW50IG9mIGNvbXBvbmVudHMpIHtcclxuICAgICAgaWYgKCd0b0pTT04nIGluIGNvbXBvbmVudCAmJiB0eXBlb2YgY29tcG9uZW50LnRvSlNPTiA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgIHRoaXMuZGF0YS5jb21wb25lbnRzLnB1c2goY29tcG9uZW50LnRvSlNPTigpKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICB0aGlzLmRhdGEuY29tcG9uZW50cy5wdXNoKGNvbXBvbmVudCBhcyBBUElNb2RhbEFjdGlvblJvdyk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2V0cyB0aGUgY29tcG9uZW50cyBvZiB0aGlzIG1vZGFsXHJcbiAgICogQHBhcmFtIGNvbXBvbmVudHMgVGhlIGNvbXBvbmVudHMgdG8gc2V0XHJcbiAgICovXHJcbiAgc2V0Q29tcG9uZW50cyguLi5jb21wb25lbnRzOiAoQVBJTW9kYWxBY3Rpb25Sb3cgfCB7IHRvSlNPTigpOiBBUElNb2RhbEFjdGlvblJvdyB9KVtdKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEuY29tcG9uZW50cyA9IFtdO1xyXG4gICAgcmV0dXJuIHRoaXMuYWRkQ29tcG9uZW50cyguLi5jb21wb25lbnRzKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJldHVybnMgdGhlIEpTT04gcmVwcmVzZW50YXRpb24gb2YgdGhpcyBtb2RhbFxyXG4gICAqL1xyXG4gIHRvSlNPTigpOiBBUElNb2RhbCB7XHJcbiAgICByZXR1cm4geyAuLi50aGlzLmRhdGEgfSBhcyBBUElNb2RhbDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZXMgYSBuZXcgbW9kYWwgYnVpbGRlciBmcm9tIGV4aXN0aW5nIGRhdGFcclxuICAgKiBAcGFyYW0gb3RoZXIgVGhlIG1vZGFsIGRhdGEgdG8gY29weVxyXG4gICAqL1xyXG4gIHN0YXRpYyBmcm9tKG90aGVyOiBQYXJ0aWFsPEFQSU1vZGFsPiB8IE1vZGFsQnVpbGRlcik6IE1vZGFsQnVpbGRlciB7XHJcbiAgICByZXR1cm4gbmV3IE1vZGFsQnVpbGRlcihvdGhlciBpbnN0YW5jZW9mIE1vZGFsQnVpbGRlciA/IG90aGVyLmRhdGEgOiBvdGhlcik7XHJcbiAgfVxyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBNb2RhbEJ1aWxkZXI7XHJcbiJdfQ==