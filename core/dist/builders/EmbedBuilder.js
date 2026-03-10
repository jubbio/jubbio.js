"use strict";
/**
 * EmbedBuilder for creating rich embeds
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Colors = exports.EmbedBuilder = void 0;
/**
 * A builder for creating embeds
 */
class EmbedBuilder {
    data;
    constructor(data = {}) {
        this.data = { ...data };
        if (data.fields) {
            this.data.fields = [...data.fields];
        }
    }
    /**
     * Sets the title of this embed
     * @param title The title
     */
    setTitle(title) {
        this.data.title = title ?? undefined;
        return this;
    }
    /**
     * Sets the description of this embed
     * @param description The description
     */
    setDescription(description) {
        this.data.description = description ?? undefined;
        return this;
    }
    /**
     * Sets the URL of this embed
     * @param url The URL
     */
    setURL(url) {
        this.data.url = url ?? undefined;
        return this;
    }
    /**
     * Sets the timestamp of this embed
     * @param timestamp The timestamp or date
     */
    setTimestamp(timestamp = Date.now()) {
        this.data.timestamp = timestamp === null
            ? undefined
            : new Date(timestamp).toISOString();
        return this;
    }
    /**
     * Sets the color of this embed
     * @param color The color (number, hex string, or RGB array)
     */
    setColor(color) {
        if (color === null) {
            this.data.color = undefined;
        }
        else if (typeof color === 'number') {
            this.data.color = color;
        }
        else if (typeof color === 'string') {
            this.data.color = parseInt(color.replace('#', ''), 16);
        }
        else if (Array.isArray(color)) {
            this.data.color = (color[0] << 16) + (color[1] << 8) + color[2];
        }
        return this;
    }
    /**
     * Sets the footer of this embed
     * @param options The footer options
     */
    setFooter(options) {
        if (options === null) {
            this.data.footer = undefined;
        }
        else {
            this.data.footer = {
                text: options.text,
                icon_url: options.iconURL,
            };
        }
        return this;
    }
    /**
     * Sets the image of this embed
     * @param url The image URL
     */
    setImage(url) {
        this.data.image = url === null ? undefined : { url };
        return this;
    }
    /**
     * Sets the thumbnail of this embed
     * @param url The thumbnail URL
     */
    setThumbnail(url) {
        this.data.thumbnail = url === null ? undefined : { url };
        return this;
    }
    /**
     * Sets the author of this embed
     * @param options The author options
     */
    setAuthor(options) {
        if (options === null) {
            this.data.author = undefined;
        }
        else {
            this.data.author = {
                name: options.name,
                icon_url: options.iconURL,
                url: options.url,
            };
        }
        return this;
    }
    /**
     * Adds fields to this embed (max 25 fields per embed)
     * @param fields The fields to add
     */
    addFields(...fields) {
        if (!this.data.fields)
            this.data.fields = [];
        if (this.data.fields.length + fields.length > 25) {
            throw new RangeError(`Embed fields cannot exceed 25. Current: ${this.data.fields.length}, adding: ${fields.length}`);
        }
        this.data.fields.push(...fields);
        return this;
    }
    /**
     * Sets the fields of this embed (max 25 fields per embed)
     * @param fields The fields to set
     */
    setFields(...fields) {
        if (fields.length > 25) {
            throw new RangeError(`Embed fields cannot exceed 25. Provided: ${fields.length}`);
        }
        this.data.fields = fields;
        return this;
    }
    /**
     * Removes, replaces, or inserts fields (max 25 fields per embed)
     * @param index The index to start at
     * @param deleteCount The number of fields to remove
     * @param fields The fields to insert
     */
    spliceFields(index, deleteCount, ...fields) {
        if (!this.data.fields)
            this.data.fields = [];
        this.data.fields.splice(index, deleteCount, ...fields);
        if (this.data.fields.length > 25) {
            throw new RangeError(`Embed fields cannot exceed 25. Result would have: ${this.data.fields.length}`);
        }
        return this;
    }
    /**
     * Returns the JSON representation of this embed
     */
    toJSON() {
        return { ...this.data };
    }
    /**
     * Creates a new embed builder from existing data
     * @param other The embed data to copy
     */
    static from(other) {
        return new EmbedBuilder(other instanceof EmbedBuilder ? other.data : other);
    }
}
exports.EmbedBuilder = EmbedBuilder;
// Color constants (DJS compatibility)
exports.Colors = {
    Default: 0x000000,
    White: 0xffffff,
    Aqua: 0x1abc9c,
    Green: 0x57f287,
    Blue: 0x3498db,
    Yellow: 0xfee75c,
    Purple: 0x9b59b6,
    LuminousVividPink: 0xe91e63,
    Fuchsia: 0xeb459e,
    Gold: 0xf1c40f,
    Orange: 0xe67e22,
    Red: 0xed4245,
    Grey: 0x95a5a6,
    Navy: 0x34495e,
    DarkAqua: 0x11806a,
    DarkGreen: 0x1f8b4c,
    DarkBlue: 0x206694,
    DarkPurple: 0x71368a,
    DarkVividPink: 0xad1457,
    DarkGold: 0xc27c0e,
    DarkOrange: 0xa84300,
    DarkRed: 0x992d22,
    DarkGrey: 0x979c9f,
    DarkerGrey: 0x7f8c8d,
    LightGrey: 0xbcc0c0,
    DarkNavy: 0x2c3e50,
    Blurple: 0x5865f2,
    Greyple: 0x99aab5,
    DarkButNotBlack: 0x2c2f33,
    NotQuiteBlack: 0x23272a,
};
exports.default = EmbedBuilder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRW1iZWRCdWlsZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2J1aWxkZXJzL0VtYmVkQnVpbGRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7O0dBRUc7OztBQTRDSDs7R0FFRztBQUNILE1BQWEsWUFBWTtJQUNQLElBQUksQ0FBVztJQUUvQixZQUFZLE9BQWlCLEVBQUU7UUFDN0IsSUFBSSxDQUFDLElBQUksR0FBRyxFQUFFLEdBQUcsSUFBSSxFQUFFLENBQUM7UUFDeEIsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDaEIsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN0QyxDQUFDO0lBQ0gsQ0FBQztJQUVEOzs7T0FHRztJQUNILFFBQVEsQ0FBQyxLQUFvQjtRQUMzQixJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLElBQUksU0FBUyxDQUFDO1FBQ3JDLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEOzs7T0FHRztJQUNILGNBQWMsQ0FBQyxXQUEwQjtRQUN2QyxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsR0FBRyxXQUFXLElBQUksU0FBUyxDQUFDO1FBQ2pELE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEOzs7T0FHRztJQUNILE1BQU0sQ0FBQyxHQUFrQjtRQUN2QixJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsR0FBRyxHQUFHLElBQUksU0FBUyxDQUFDO1FBQ2pDLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEOzs7T0FHRztJQUNILFlBQVksQ0FBQyxZQUFrQyxJQUFJLENBQUMsR0FBRyxFQUFFO1FBQ3ZELElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxHQUFHLFNBQVMsS0FBSyxJQUFJO1lBQ3RDLENBQUMsQ0FBQyxTQUFTO1lBQ1gsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLFNB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QUFFLFFBQVE7Q0FDZixDQUFDO0FBRVgsa0JBQWUsWUFBWSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBFbWJlZEJ1aWxkZXIgZm9yIGNyZWF0aW5nIHJpY2ggZW1iZWRzXG4gKi9cblxuZXhwb3J0IGludGVyZmFjZSBBUElFbWJlZEZpZWxkIHtcbiAgbmFtZTogc3RyaW5nO1xuICB2YWx1ZTogc3RyaW5nO1xuICBpbmxpbmU/OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEFQSUVtYmVkQXV0aG9yIHtcbiAgbmFtZTogc3RyaW5nO1xuICB1cmw/OiBzdHJpbmc7XG4gIGljb25fdXJsPzogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEFQSUVtYmVkRm9vdGVyIHtcbiAgdGV4dDogc3RyaW5nO1xuICBpY29uX3VybD86IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBBUElFbWJlZEltYWdlIHtcbiAgdXJsOiBzdHJpbmc7XG4gIGhlaWdodD86IG51bWJlcjtcbiAgd2lkdGg/OiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgQVBJRW1iZWRUaHVtYm5haWwge1xuICB1cmw6IHN0cmluZztcbiAgaGVpZ2h0PzogbnVtYmVyO1xuICB3aWR0aD86IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBBUElFbWJlZCB7XG4gIHRpdGxlPzogc3RyaW5nO1xuICBkZXNjcmlwdGlvbj86IHN0cmluZztcbiAgdXJsPzogc3RyaW5nO1xuICB0aW1lc3RhbXA/OiBzdHJpbmc7XG4gIGNvbG9yPzogbnVtYmVyO1xuICBmb290ZXI/OiBBUElFbWJlZEZvb3RlcjtcbiAgaW1hZ2U/OiBBUElFbWJlZEltYWdlO1xuICB0aHVtYm5haWw/OiBBUElFbWJlZFRodW1ibmFpbDtcbiAgYXV0aG9yPzogQVBJRW1iZWRBdXRob3I7XG4gIGZpZWxkcz86IEFQSUVtYmVkRmllbGRbXTtcbn1cblxuLyoqXG4gKiBBIGJ1aWxkZXIgZm9yIGNyZWF0aW5nIGVtYmVkc1xuICovXG5leHBvcnQgY2xhc3MgRW1iZWRCdWlsZGVyIHtcbiAgcHVibGljIHJlYWRvbmx5IGRhdGE6IEFQSUVtYmVkO1xuXG4gIGNvbnN0cnVjdG9yKGRhdGE6IEFQSUVtYmVkID0ge30pIHtcbiAgICB0aGlzLmRhdGEgPSB7IC4uLmRhdGEgfTtcbiAgICBpZiAoZGF0YS5maWVsZHMpIHtcbiAgICAgIHRoaXMuZGF0YS5maWVsZHMgPSBbLi4uZGF0YS5maWVsZHNdO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSB0aXRsZSBvZiB0aGlzIGVtYmVkXG4gICAqIEBwYXJhbSB0aXRsZSBUaGUgdGl0bGVcbiAgICovXG4gIHNldFRpdGxlKHRpdGxlOiBzdHJpbmcgfCBudWxsKTogdGhpcyB7XG4gICAgdGhpcy5kYXRhLnRpdGxlID0gdGl0bGUgPz8gdW5kZWZpbmVkO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgdGhlIGRlc2NyaXB0aW9uIG9mIHRoaXMgZW1iZWRcbiAgICogQHBhcmFtIGRlc2NyaXB0aW9uIFRoZSBkZXNjcmlwdGlvblxuICAgKi9cbiAgc2V0RGVzY3JpcHRpb24oZGVzY3JpcHRpb246IHN0cmluZyB8IG51bGwpOiB0aGlzIHtcbiAgICB0aGlzLmRhdGEuZGVzY3JpcHRpb24gPSBkZXNjcmlwdGlvbiA/PyB1bmRlZmluZWQ7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU2V0cyB0aGUgVVJMIG9mIHRoaXMgZW1iZWRcbiAgICogQHBhcmFtIHVybCBUaGUgVVJMXG4gICAqL1xuICBzZXRVUkwodXJsOiBzdHJpbmcgfCBudWxsKTogdGhpcyB7XG4gICAgdGhpcy5kYXRhLnVybCA9IHVybCA/PyB1bmRlZmluZWQ7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU2V0cyB0aGUgdGltZXN0YW1wIG9mIHRoaXMgZW1iZWRcbiAgICogQHBhcmFtIHRpbWVzdGFtcCBUaGUgdGltZXN0YW1wIG9yIGRhdGVcbiAgICovXG4gIHNldFRpbWVzdGFtcCh0aW1lc3RhbXA6IERhdGUgfCBudW1iZXIgfCBudWxsID0gRGF0ZS5ub3coKSk6IHRoaXMge1xuICAgIHRoaXMuZGF0YS50aW1lc3RhbXAgPSB0aW1lc3RhbXAgPT09IG51bGwgXG4gICAgICA/IHVuZGVmaW5lZCBcbiAgICAgIDogbmV3IERhdGUodGltZXN0YW1wKS50b0lTT1N0cmluZygpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgdGhlIGNvbG9yIG9mIHRoaXMgZW1iZWRcbiAgICogQHBhcmFtIGNvbG9yIFRoZSBjb2xvciAobnVtYmVyLCBoZXggc3RyaW5nLCBvciBSR0IgYXJyYXkpXG4gICAqL1xuICBzZXRDb2xvcihjb2xvcjogbnVtYmVyIHwgYCMke3N0cmluZ31gIHwgW251bWJlciwgbnVtYmVyLCBudW1iZXJdIHwgbnVsbCk6IHRoaXMge1xuICAgIGlmIChjb2xvciA9PT0gbnVsbCkge1xuICAgICAgdGhpcy5kYXRhLmNvbG9yID0gdW5kZWZpbmVkO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIGNvbG9yID09PSAnbnVtYmVyJykge1xuICAgICAgdGhpcy5kYXRhLmNvbG9yID0gY29sb3I7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgY29sb3IgPT09ICdzdHJpbmcnKSB7XG4gICAgICB0aGlzLmRhdGEuY29sb3IgPSBwYXJzZUludChjb2xvci5yZXBsYWNlKCcjJywgJycpLCAxNik7XG4gICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGNvbG9yKSkge1xuICAgICAgdGhpcy5kYXRhLmNvbG9yID0gKGNvbG9yWzBdIDw8IDE2KSArIChjb2xvclsxXSA8PCA4KSArIGNvbG9yWzJdO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSBmb290ZXIgb2YgdGhpcyBlbWJlZFxuICAgKiBAcGFyYW0gb3B0aW9ucyBUaGUgZm9vdGVyIG9wdGlvbnNcbiAgICovXG4gIHNldEZvb3RlcihvcHRpb25zOiB7IHRleHQ6IHN0cmluZzsgaWNvblVSTD86IHN0cmluZyB9IHwgbnVsbCk6IHRoaXMge1xuICAgIGlmIChvcHRpb25zID09PSBudWxsKSB7XG4gICAgICB0aGlzLmRhdGEuZm9vdGVyID0gdW5kZWZpbmVkO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRhdGEuZm9vdGVyID0ge1xuICAgICAgICB0ZXh0OiBvcHRpb25zLnRleHQsXG4gICAgICAgIGljb25fdXJsOiBvcHRpb25zLmljb25VUkwsXG4gICAgICB9O1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSBpbWFnZSBvZiB0aGlzIGVtYmVkXG4gICAqIEBwYXJhbSB1cmwgVGhlIGltYWdlIFVSTFxuICAgKi9cbiAgc2V0SW1hZ2UodXJsOiBzdHJpbmcgfCBudWxsKTogdGhpcyB7XG4gICAgdGhpcy5kYXRhLmltYWdlID0gdXJsID09PSBudWxsID8gdW5kZWZpbmVkIDogeyB1cmwgfTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSB0aHVtYm5haWwgb2YgdGhpcyBlbWJlZFxuICAgKiBAcGFyYW0gdXJsIFRoZSB0aHVtYm5haWwgVVJMXG4gICAqL1xuICBzZXRUaHVtYm5haWwodXJsOiBzdHJpbmcgfCBudWxsKTogdGhpcyB7XG4gICAgdGhpcy5kYXRhLnRodW1ibmFpbCA9IHVybCA9PT0gbnVsbCA/IHVuZGVmaW5lZCA6IHsgdXJsIH07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU2V0cyB0aGUgYXV0aG9yIG9mIHRoaXMgZW1iZWRcbiAgICogQHBhcmFtIG9wdGlvbnMgVGhlIGF1dGhvciBvcHRpb25zXG4gICAqL1xuICBzZXRBdXRob3Iob3B0aW9uczogeyBuYW1lOiBzdHJpbmc7IGljb25VUkw/OiBzdHJpbmc7IHVybD86IHN0cmluZyB9IHwgbnVsbCk6IHRoaXMge1xuICAgIGlmIChvcHRpb25zID09PSBudWxsKSB7XG4gICAgICB0aGlzLmRhdGEuYXV0aG9yID0gdW5kZWZpbmVkO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRhdGEuYXV0aG9yID0ge1xuICAgICAgICBuYW1lOiBvcHRpb25zLm5hbWUsXG4gICAgICAgIGljb25fdXJsOiBvcHRpb25zLmljb25VUkwsXG4gICAgICAgIHVybDogb3B0aW9ucy51cmwsXG4gICAgICB9O1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGRzIGZpZWxkcyB0byB0aGlzIGVtYmVkIChtYXggMjUgZmllbGRzIHBlciBlbWJlZClcbiAgICogQHBhcmFtIGZpZWxkcyBUaGUgZmllbGRzIHRvIGFkZFxuICAgKi9cbiAgYWRkRmllbGRzKC4uLmZpZWxkczogQVBJRW1iZWRGaWVsZFtdKTogdGhpcyB7XG4gICAgaWYgKCF0aGlzLmRhdGEuZmllbGRzKSB0aGlzLmRhdGEuZmllbGRzID0gW107XG4gICAgaWYgKHRoaXMuZGF0YS5maWVsZHMubGVuZ3RoICsgZmllbGRzLmxlbmd0aCA+IDI1KSB7XG4gICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihgRW1iZWQgZmllbGRzIGNhbm5vdCBleGNlZWQgMjUuIEN1cnJlbnQ6ICR7dGhpcy5kYXRhLmZpZWxkcy5sZW5ndGh9LCBhZGRpbmc6ICR7ZmllbGRzLmxlbmd0aH1gKTtcbiAgICB9XG4gICAgdGhpcy5kYXRhLmZpZWxkcy5wdXNoKC4uLmZpZWxkcyk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU2V0cyB0aGUgZmllbGRzIG9mIHRoaXMgZW1iZWQgKG1heCAyNSBmaWVsZHMgcGVyIGVtYmVkKVxuICAgKiBAcGFyYW0gZmllbGRzIFRoZSBmaWVsZHMgdG8gc2V0XG4gICAqL1xuICBzZXRGaWVsZHMoLi4uZmllbGRzOiBBUElFbWJlZEZpZWxkW10pOiB0aGlzIHtcbiAgICBpZiAoZmllbGRzLmxlbmd0aCA+IDI1KSB7XG4gICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihgRW1iZWQgZmllbGRzIGNhbm5vdCBleGNlZWQgMjUuIFByb3ZpZGVkOiAke2ZpZWxkcy5sZW5ndGh9YCk7XG4gICAgfVxuICAgIHRoaXMuZGF0YS5maWVsZHMgPSBmaWVsZHM7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlcywgcmVwbGFjZXMsIG9yIGluc2VydHMgZmllbGRzIChtYXggMjUgZmllbGRzIHBlciBlbWJlZClcbiAgICogQHBhcmFtIGluZGV4IFRoZSBpbmRleCB0byBzdGFydCBhdFxuICAgKiBAcGFyYW0gZGVsZXRlQ291bnQgVGhlIG51bWJlciBvZiBmaWVsZHMgdG8gcmVtb3ZlXG4gICAqIEBwYXJhbSBmaWVsZHMgVGhlIGZpZWxkcyB0byBpbnNlcnRcbiAgICovXG4gIHNwbGljZUZpZWxkcyhpbmRleDogbnVtYmVyLCBkZWxldGVDb3VudDogbnVtYmVyLCAuLi5maWVsZHM6IEFQSUVtYmVkRmllbGRbXSk6IHRoaXMge1xuICAgIGlmICghdGhpcy5kYXRhLmZpZWxkcykgdGhpcy5kYXRhLmZpZWxkcyA9IFtdO1xuICAgIHRoaXMuZGF0YS5maWVsZHMuc3BsaWNlKGluZGV4LCBkZWxldGVDb3VudCwgLi4uZmllbGRzKTtcbiAgICBpZiAodGhpcy5kYXRhLmZpZWxkcy5sZW5ndGggPiAyNSkge1xuICAgICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoYEVtYmVkIGZpZWxkcyBjYW5ub3QgZXhjZWVkIDI1LiBSZXN1bHQgd291bGQgaGF2ZTogJHt0aGlzLmRhdGEuZmllbGRzLmxlbmd0aH1gKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBKU09OIHJlcHJlc2VudGF0aW9uIG9mIHRoaXMgZW1iZWRcbiAgICovXG4gIHRvSlNPTigpOiBBUElFbWJlZCB7XG4gICAgcmV0dXJuIHsgLi4udGhpcy5kYXRhIH07XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBlbWJlZCBidWlsZGVyIGZyb20gZXhpc3RpbmcgZGF0YVxuICAgKiBAcGFyYW0gb3RoZXIgVGhlIGVtYmVkIGRhdGEgdG8gY29weVxuICAgKi9cbiAgc3RhdGljIGZyb20ob3RoZXI6IEFQSUVtYmVkIHwgRW1iZWRCdWlsZGVyKTogRW1iZWRCdWlsZGVyIHtcbiAgICByZXR1cm4gbmV3IEVtYmVkQnVpbGRlcihvdGhlciBpbnN0YW5jZW9mIEVtYmVkQnVpbGRlciA/IG90aGVyLmRhdGEgOiBvdGhlcik7XG4gIH1cbn1cblxuLy8gQ29sb3IgY29uc3RhbnRzIChESlMgY29tcGF0aWJpbGl0eSlcbmV4cG9ydCBjb25zdCBDb2xvcnMgPSB7XG4gIERlZmF1bHQ6IDB4MDAwMDAwLFxuICBXaGl0ZTogMHhmZmZmZmYsXG4gIEFxdWE6IDB4MWFiYzljLFxuICBHcmVlbjogMHg1N2YyODcsXG4gIEJsdWU6IDB4MzQ5OGRiLFxuICBZZWxsb3c6IDB4ZmVlNzVjLFxuICBQdXJwbGU6IDB4OWI1OWI2LFxuICBMdW1pbm91c1ZpdmlkUGluazogMHhlOTFlNjMsXG4gIEZ1Y2hzaWE6IDB4ZWI0NTllLFxuICBHb2xkOiAweGYxYzQwZixcbiAgT3JhbmdlOiAweGU2N2UyMixcbiAgUmVkOiAweGVkNDI0NSxcbiAgR3JleTogMHg5NWE1YTYsXG4gIE5hdnk6IDB4MzQ0OTVlLFxuICBEYXJrQXF1YTogMHgxMTgwNmEsXG4gIERhcmtHcmVlbjogMHgxZjhiNGMsXG4gIERhcmtCbHVlOiAweDIwNjY5NCxcbiAgRGFya1B1cnBsZTogMHg3MTM2OGEsXG4gIERhcmtWaXZpZFBpbms6IDB4YWQxNDU3LFxuICBEYXJrR29sZDogMHhjMjdjMGUsXG4gIERhcmtPcmFuZ2U6IDB4YTg0MzAwLFxuICBEYXJrUmVkOiAweDk5MmQyMixcbiAgRGFya0dyZXk6IDB4OTc5YzlmLFxuICBEYXJrZXJHcmV5OiAweDdmOGM4ZCxcbiAgTGlnaHRHcmV5OiAweGJjYzBjMCxcbiAgRGFya05hdnk6IDB4MmMzZTUwLFxuICBCbHVycGxlOiAweDU4NjVmMixcbiAgR3JleXBsZTogMHg5OWFhYjUsXG4gIERhcmtCdXROb3RCbGFjazogMHgyYzJmMzMsXG4gIE5vdFF1aXRlQmxhY2s6IDB4MjMyNzJhLFxufSBhcyBjb25zdDtcblxuZXhwb3J0IGRlZmF1bHQgRW1iZWRCdWlsZGVyO1xuIl19