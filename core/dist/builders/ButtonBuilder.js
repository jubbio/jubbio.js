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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQnV0dG9uQnVpbGRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9idWlsZGVycy9CdXR0b25CdWlsZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7R0FFRzs7O0FBRUg7O0dBRUc7QUFDSCxJQUFZLFdBTVg7QUFORCxXQUFZLFdBQVc7SUFDckIsbURBQVcsQ0FBQTtJQUNYLHVEQUFhLENBQUE7SUFDYixtREFBVyxDQUFBO0lBQ1gsaURBQVUsQ0FBQTtJQUNWLDZDQUFRLENBQUE7QUFDVixDQUFDLEVBTlcsV0FBVywyQkFBWCxXQUFXLFFBTXRCO0FBWUQ7O0dBRUc7QUFDSCxNQUFhLGFBQWE7SUFDUixJQUFJLENBQThCO0lBRWxELFlBQVksT0FBb0MsRUFBRTtRQUNoRCxJQUFJLENBQUMsSUFBSSxHQUFHLEVBQUUsSUFBSSxFQUFFLENBQUMsRUFBRSxHQUFHLElBQUksRUFBRSxDQUFDO0lBQ25DLENBQUM7SUFFRDs7O09BR0c7SUFDSCxXQUFXLENBQUMsUUFBZ0I7UUFDMUIsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEdBQUcsUUFBUSxDQUFDO1FBQy9CLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEOzs7T0FHRztJQUNILFFBQVEsQ0FBQyxLQUFhO1FBQ3BCLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUN4QixPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRDs7O09BR0c7SUFDSCxRQUFRLENBQUMsS0FBa0I7UUFDekIsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO1FBQ3hCLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEOzs7T0FHRztJQUNILFFBQVEsQ0FBQyxLQUFrRTtRQUN6RSxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQzlCLGdCQUFnQjtZQUNoQixJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBRyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsQ0FBQztRQUNwQyxDQUFDO2FBQU0sQ0FBQztZQUNOLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUMxQixDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsTUFBTSxDQUFDLEdBQVc7UUFDaEIsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDO1FBQ3BCLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEOzs7T0FHRztJQUNILFdBQVcsQ0FBQyxRQUFRLEdBQUcsSUFBSTtRQUN6QixJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7UUFDOUIsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxNQUFNO1FBQ0osT0FBTyxFQUFFLEdBQUcsSUFBSSxDQUFDLElBQUksRUFBd0IsQ0FBQztJQUNoRCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFrRDtRQUM1RCxPQUFPLElBQUksYUFBYSxDQUFDLEtBQUssWUFBWSxhQUFhLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ2hGLENBQUM7Q0FDRjtBQWhGRCxzQ0FnRkM7QUFFRCxrQkFBZSxhQUFhLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEJ1dHRvbkJ1aWxkZXIgZm9yIGNyZWF0aW5nIGludGVyYWN0aXZlIGJ1dHRvbnNcbiAqL1xuXG4vKipcbiAqIEJ1dHRvbiBzdHlsZXNcbiAqL1xuZXhwb3J0IGVudW0gQnV0dG9uU3R5bGUge1xuICBQcmltYXJ5ID0gMSxcbiAgU2Vjb25kYXJ5ID0gMixcbiAgU3VjY2VzcyA9IDMsXG4gIERhbmdlciA9IDQsXG4gIExpbmsgPSA1LFxufVxuXG5leHBvcnQgaW50ZXJmYWNlIEFQSUJ1dHRvbkNvbXBvbmVudCB7XG4gIHR5cGU6IDI7XG4gIHN0eWxlOiBCdXR0b25TdHlsZTtcbiAgbGFiZWw/OiBzdHJpbmc7XG4gIGVtb2ppPzogeyBpZD86IHN0cmluZzsgbmFtZT86IHN0cmluZzsgYW5pbWF0ZWQ/OiBib29sZWFuIH07XG4gIGN1c3RvbV9pZD86IHN0cmluZztcbiAgdXJsPzogc3RyaW5nO1xuICBkaXNhYmxlZD86IGJvb2xlYW47XG59XG5cbi8qKlxuICogQSBidWlsZGVyIGZvciBjcmVhdGluZyBidXR0b25zXG4gKi9cbmV4cG9ydCBjbGFzcyBCdXR0b25CdWlsZGVyIHtcbiAgcHVibGljIHJlYWRvbmx5IGRhdGE6IFBhcnRpYWw8QVBJQnV0dG9uQ29tcG9uZW50PjtcblxuICBjb25zdHJ1Y3RvcihkYXRhOiBQYXJ0aWFsPEFQSUJ1dHRvbkNvbXBvbmVudD4gPSB7fSkge1xuICAgIHRoaXMuZGF0YSA9IHsgdHlwZTogMiwgLi4uZGF0YSB9O1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgdGhlIGN1c3RvbSBJRCBvZiB0aGlzIGJ1dHRvblxuICAgKiBAcGFyYW0gY3VzdG9tSWQgVGhlIGN1c3RvbSBJRFxuICAgKi9cbiAgc2V0Q3VzdG9tSWQoY3VzdG9tSWQ6IHN0cmluZyk6IHRoaXMge1xuICAgIHRoaXMuZGF0YS5jdXN0b21faWQgPSBjdXN0b21JZDtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSBsYWJlbCBvZiB0aGlzIGJ1dHRvblxuICAgKiBAcGFyYW0gbGFiZWwgVGhlIGxhYmVsXG4gICAqL1xuICBzZXRMYWJlbChsYWJlbDogc3RyaW5nKTogdGhpcyB7XG4gICAgdGhpcy5kYXRhLmxhYmVsID0gbGFiZWw7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU2V0cyB0aGUgc3R5bGUgb2YgdGhpcyBidXR0b25cbiAgICogQHBhcmFtIHN0eWxlIFRoZSBzdHlsZVxuICAgKi9cbiAgc2V0U3R5bGUoc3R5bGU6IEJ1dHRvblN0eWxlKTogdGhpcyB7XG4gICAgdGhpcy5kYXRhLnN0eWxlID0gc3R5bGU7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU2V0cyB0aGUgZW1vamkgb2YgdGhpcyBidXR0b25cbiAgICogQHBhcmFtIGVtb2ppIFRoZSBlbW9qaVxuICAgKi9cbiAgc2V0RW1vamkoZW1vamk6IHsgaWQ/OiBzdHJpbmc7IG5hbWU/OiBzdHJpbmc7IGFuaW1hdGVkPzogYm9vbGVhbiB9IHwgc3RyaW5nKTogdGhpcyB7XG4gICAgaWYgKHR5cGVvZiBlbW9qaSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIC8vIFVuaWNvZGUgZW1vamlcbiAgICAgIHRoaXMuZGF0YS5lbW9qaSA9IHsgbmFtZTogZW1vamkgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5kYXRhLmVtb2ppID0gZW1vamk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgdGhlIFVSTCBvZiB0aGlzIGJ1dHRvbiAob25seSBmb3IgTGluayBzdHlsZSlcbiAgICogQHBhcmFtIHVybCBUaGUgVVJMXG4gICAqL1xuICBzZXRVUkwodXJsOiBzdHJpbmcpOiB0aGlzIHtcbiAgICB0aGlzLmRhdGEudXJsID0gdXJsO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgd2hldGhlciB0aGlzIGJ1dHRvbiBpcyBkaXNhYmxlZFxuICAgKiBAcGFyYW0gZGlzYWJsZWQgV2hldGhlciB0aGUgYnV0dG9uIGlzIGRpc2FibGVkXG4gICAqL1xuICBzZXREaXNhYmxlZChkaXNhYmxlZCA9IHRydWUpOiB0aGlzIHtcbiAgICB0aGlzLmRhdGEuZGlzYWJsZWQgPSBkaXNhYmxlZDtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBKU09OIHJlcHJlc2VudGF0aW9uIG9mIHRoaXMgYnV0dG9uXG4gICAqL1xuICB0b0pTT04oKTogQVBJQnV0dG9uQ29tcG9uZW50IHtcbiAgICByZXR1cm4geyAuLi50aGlzLmRhdGEgfSBhcyBBUElCdXR0b25Db21wb25lbnQ7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBidXR0b24gYnVpbGRlciBmcm9tIGV4aXN0aW5nIGRhdGFcbiAgICogQHBhcmFtIG90aGVyIFRoZSBidXR0b24gZGF0YSB0byBjb3B5XG4gICAqL1xuICBzdGF0aWMgZnJvbShvdGhlcjogUGFydGlhbDxBUElCdXR0b25Db21wb25lbnQ+IHwgQnV0dG9uQnVpbGRlcik6IEJ1dHRvbkJ1aWxkZXIge1xuICAgIHJldHVybiBuZXcgQnV0dG9uQnVpbGRlcihvdGhlciBpbnN0YW5jZW9mIEJ1dHRvbkJ1aWxkZXIgPyBvdGhlci5kYXRhIDogb3RoZXIpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEJ1dHRvbkJ1aWxkZXI7XG4iXX0=