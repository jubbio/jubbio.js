"use strict";
/**
 * ButtonBuilder for creating interactive buttons
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ButtonBuilder = exports.ButtonStyle = void 0;
/**
 * Button styles
 */
var ButtonStyle;
(function (ButtonStyle) {
    ButtonStyle[ButtonStyle["Primary"] = 1] = "Primary";
    ButtonStyle[ButtonStyle["Secondary"] = 2] = "Secondary";
    ButtonStyle[ButtonStyle["Success"] = 3] = "Success";
    ButtonStyle[ButtonStyle["Danger"] = 4] = "Danger";
    ButtonStyle[ButtonStyle["Link"] = 5] = "Link";
})(ButtonStyle || (exports.ButtonStyle = ButtonStyle = {}));
/**
 * A builder for creating buttons
 */
class ButtonBuilder {
    data;
    constructor(data = {}) {
        this.data = { type: 2, ...data };
    }
    /**
     * Sets the custom ID of this button
     * @param customId The custom ID
     */
    setCustomId(customId) {
        this.data.custom_id = customId;
        return this;
    }
    /**
     * Sets the label of this button
     * @param label The label
     */
    setLabel(label) {
        this.data.label = label;
        return this;
    }
    /**
     * Sets the style of this button
     * @param style The style
     */
    setStyle(style) {
        this.data.style = style;
        return this;
    }
    /**
     * Sets the emoji of this button
     * @param emoji The emoji
     */
    setEmoji(emoji) {
        if (typeof emoji === 'string') {
            // Unicode emoji
            this.data.emoji = { name: emoji };
        }
        else {
            this.data.emoji = emoji;
        }
        return this;
    }
    /**
     * Sets the URL of this button (only for Link style)
     * @param url The URL
     */
    setURL(url) {
        this.data.url = url;
        return this;
    }
    /**
     * Sets whether this button is disabled
     * @param disabled Whether the button is disabled
     */
    setDisabled(disabled = true) {
        this.data.disabled = disabled;
        return this;
    }
    /**
     * Returns the JSON representation of this button
     */
    toJSON() {
        return { ...this.data };
    }
    /**
     * Creates a new button builder from existing data
     * @param other The button data to copy
     */
    static from(other) {
        return new ButtonBuilder(other instanceof ButtonBuilder ? other.data : other);
    }
}
exports.ButtonBuilder = ButtonBuilder;
exports.default = ButtonBuilder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQnV0dG9uQnVpbGRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9idWlsZGVycy9CdXR0b25CdWlsZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7R0FFRzs7O0FBRUg7O0dBRUc7QUFDSCxJQUFZLFdBTVg7QUFORCxXQUFZLFdBQVc7SUFDckIsbURBQVcsQ0FBQTtJQUNYLHVEQUFhLENBQUE7SUFDYixtREFBVyxDQUFBO0lBQ1gsaURBQVUsQ0FBQTtJQUNWLDZDQUFRLENBQUE7QUFDVixDQUFDLEVBTlcsV0FBVywyQkFBWCxXQUFXLFFBTXRCO0FBWUQ7O0dBRUc7QUFDSCxNQUFhLGFBQWE7SUFDUixJQUFJLENBQThCO0lBRWxELFlBQVksT0FBb0MsRUFBRTtRQUNoRCxJQUFJLENBQUMsSUFBSSxHQUFHLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxHQUFHLElBQUksRUFBRSxDQUFDO0lBQ25DLENBQUM7SUFFRDs7O09BR0c7SUFDSCxXQUFXLENBQUMsUUFBZ0I7UUFDMUIsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEdBQUcsUUFBUSxDQUFDO1FBQy9CLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEOzs7T0FHRztJQUNILFFBQVEsQ0FBQyxLQUFhO1FBQ3BCLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUN4QixPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRDs7O09BR0c7SUFDSCxRQUFRLENBQUMsS0FBa0I7UUFDekIsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO1FBQ3hCLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEOzs7T0FHRztJQUNILFFBQVEsQ0FBQyxLQUFrRTtRQUN6RSxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQzlCLGdCQUFnQjtZQUNoQixJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBRyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsQ0FBQztRQUNwQyxDQUFDO2FBQU0sQ0FBQztZQUNOLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUMxQixDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsTUFBTSxDQUFDLEdBQVc7UUFDaEIsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDO1FBQ3BCLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEOzs7T0FHRztJQUNILFdBQVcsQ0FBQyxRQUFRLEdBQUcsSUFBSTtRQUN6QixJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7UUFDOUIsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxNQUFNO1FBQ0osT0FBTyxFQUFFLEdBQUcsSUFBSSxDQUFDLElBQUksRUFBd0IsQ0FBQztJQUNoRCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFrRDtRQUM1RCxPQUFPLElBQUksYUFBYSxDQUFDLEtBQUssWUFBWSxhQUFhLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ2hGLENBQUM7Q0FDRjtBQWhGRCxzQ0FnRkM7QUFFRCxrQkFBZSxhQUFhLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogQnV0dG9uQnVpbGRlciBmb3IgY3JlYXRpbmcgaW50ZXJhY3RpdmUgYnV0dG9uc1xyXG4gKi9cclxuXHJcbi8qKlxyXG4gKiBCdXR0b24gc3R5bGVzXHJcbiAqL1xyXG5leHBvcnQgZW51bSBCdXR0b25TdHlsZSB7XHJcbiAgUHJpbWFyeSA9IDEsXHJcbiAgU2Vjb25kYXJ5ID0gMixcclxuICBTdWNjZXNzID0gMyxcclxuICBEYW5nZXIgPSA0LFxyXG4gIExpbmsgPSA1LFxyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEFQSUJ1dHRvbkNvbXBvbmVudCB7XHJcbiAgdHlwZTogMjtcclxuICBzdHlsZTogQnV0dG9uU3R5bGU7XHJcbiAgbGFiZWw/OiBzdHJpbmc7XHJcbiAgZW1vamk/OiB7IGlkPzogc3RyaW5nOyBuYW1lPzogc3RyaW5nOyBhbmltYXRlZD86IGJvb2xlYW4gfTtcclxuICBjdXN0b21faWQ/OiBzdHJpbmc7XHJcbiAgdXJsPzogc3RyaW5nO1xyXG4gIGRpc2FibGVkPzogYm9vbGVhbjtcclxufVxyXG5cclxuLyoqXHJcbiAqIEEgYnVpbGRlciBmb3IgY3JlYXRpbmcgYnV0dG9uc1xyXG4gKi9cclxuZXhwb3J0IGNsYXNzIEJ1dHRvbkJ1aWxkZXIge1xyXG4gIHB1YmxpYyByZWFkb25seSBkYXRhOiBQYXJ0aWFsPEFQSUJ1dHRvbkNvbXBvbmVudD47XHJcblxyXG4gIGNvbnN0cnVjdG9yKGRhdGE6IFBhcnRpYWw8QVBJQnV0dG9uQ29tcG9uZW50PiA9IHt9KSB7XHJcbiAgICB0aGlzLmRhdGEgPSB7IHR5cGU6IDIsIC4uLmRhdGEgfTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldHMgdGhlIGN1c3RvbSBJRCBvZiB0aGlzIGJ1dHRvblxyXG4gICAqIEBwYXJhbSBjdXN0b21JZCBUaGUgY3VzdG9tIElEXHJcbiAgICovXHJcbiAgc2V0Q3VzdG9tSWQoY3VzdG9tSWQ6IHN0cmluZyk6IHRoaXMge1xyXG4gICAgdGhpcy5kYXRhLmN1c3RvbV9pZCA9IGN1c3RvbUlkO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZXRzIHRoZSBsYWJlbCBvZiB0aGlzIGJ1dHRvblxyXG4gICAqIEBwYXJhbSBsYWJlbCBUaGUgbGFiZWxcclxuICAgKi9cclxuICBzZXRMYWJlbChsYWJlbDogc3RyaW5nKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEubGFiZWwgPSBsYWJlbDtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2V0cyB0aGUgc3R5bGUgb2YgdGhpcyBidXR0b25cclxuICAgKiBAcGFyYW0gc3R5bGUgVGhlIHN0eWxlXHJcbiAgICovXHJcbiAgc2V0U3R5bGUoc3R5bGU6IEJ1dHRvblN0eWxlKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEuc3R5bGUgPSBzdHlsZTtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2V0cyB0aGUgZW1vamkgb2YgdGhpcyBidXR0b25cclxuICAgKiBAcGFyYW0gZW1vamkgVGhlIGVtb2ppXHJcbiAgICovXHJcbiAgc2V0RW1vamkoZW1vamk6IHsgaWQ/OiBzdHJpbmc7IG5hbWU/OiBzdHJpbmc7IGFuaW1hdGVkPzogYm9vbGVhbiB9IHwgc3RyaW5nKTogdGhpcyB7XHJcbiAgICBpZiAodHlwZW9mIGVtb2ppID09PSAnc3RyaW5nJykge1xyXG4gICAgICAvLyBVbmljb2RlIGVtb2ppXHJcbiAgICAgIHRoaXMuZGF0YS5lbW9qaSA9IHsgbmFtZTogZW1vamkgfTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMuZGF0YS5lbW9qaSA9IGVtb2ppO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZXRzIHRoZSBVUkwgb2YgdGhpcyBidXR0b24gKG9ubHkgZm9yIExpbmsgc3R5bGUpXHJcbiAgICogQHBhcmFtIHVybCBUaGUgVVJMXHJcbiAgICovXHJcbiAgc2V0VVJMKHVybDogc3RyaW5nKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEudXJsID0gdXJsO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZXRzIHdoZXRoZXIgdGhpcyBidXR0b24gaXMgZGlzYWJsZWRcclxuICAgKiBAcGFyYW0gZGlzYWJsZWQgV2hldGhlciB0aGUgYnV0dG9uIGlzIGRpc2FibGVkXHJcbiAgICovXHJcbiAgc2V0RGlzYWJsZWQoZGlzYWJsZWQgPSB0cnVlKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEuZGlzYWJsZWQgPSBkaXNhYmxlZDtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmV0dXJucyB0aGUgSlNPTiByZXByZXNlbnRhdGlvbiBvZiB0aGlzIGJ1dHRvblxyXG4gICAqL1xyXG4gIHRvSlNPTigpOiBBUElCdXR0b25Db21wb25lbnQge1xyXG4gICAgcmV0dXJuIHsgLi4udGhpcy5kYXRhIH0gYXMgQVBJQnV0dG9uQ29tcG9uZW50O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlcyBhIG5ldyBidXR0b24gYnVpbGRlciBmcm9tIGV4aXN0aW5nIGRhdGFcclxuICAgKiBAcGFyYW0gb3RoZXIgVGhlIGJ1dHRvbiBkYXRhIHRvIGNvcHlcclxuICAgKi9cclxuICBzdGF0aWMgZnJvbShvdGhlcjogUGFydGlhbDxBUElCdXR0b25Db21wb25lbnQ+IHwgQnV0dG9uQnVpbGRlcik6IEJ1dHRvbkJ1aWxkZXIge1xyXG4gICAgcmV0dXJuIG5ldyBCdXR0b25CdWlsZGVyKG90aGVyIGluc3RhbmNlb2YgQnV0dG9uQnVpbGRlciA/IG90aGVyLmRhdGEgOiBvdGhlcik7XHJcbiAgfVxyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBCdXR0b25CdWlsZGVyO1xyXG4iXX0=