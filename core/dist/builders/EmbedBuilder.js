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
     * Adds fields to this embed
     * @param fields The fields to add
     */
    addFields(...fields) {
        if (!this.data.fields)
            this.data.fields = [];
        this.data.fields.push(...fields);
        return this;
    }
    /**
     * Sets the fields of this embed
     * @param fields The fields to set
     */
    setFields(...fields) {
        this.data.fields = fields;
        return this;
    }
    /**
     * Removes, replaces, or inserts fields
     * @param index The index to start at
     * @param deleteCount The number of fields to remove
     * @param fields The fields to insert
     */
    spliceFields(index, deleteCount, ...fields) {
        if (!this.data.fields)
            this.data.fields = [];
        this.data.fields.splice(index, deleteCount, ...fields);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRW1iZWRCdWlsZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL2J1aWxkZXJzL0VtYmVkQnVpbGRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7O0dBRUc7OztBQTRDSDs7R0FFRztBQUNILE1BQWEsWUFBWTtJQUNQLElBQUksQ0FBVztJQUUvQixZQUFZLE9BQWlCLEVBQUU7UUFDN0IsSUFBSSxDQUFDLElBQUksR0FBRyxFQUFFLEdBQUcsSUFBSSxFQUFFLENBQUM7UUFDeEIsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDaEIsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUN0QyxDQUFDO0lBQ0gsQ0FBQztJQUVEOzs7T0FHRztJQUNILFFBQVEsQ0FBQyxLQUFvQjtRQUMzQixJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLElBQUksU0FBUyxDQUFDO1FBQ3JDLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEOzs7T0FHRztJQUNILGNBQWMsQ0FBQyxXQUEwQjtRQUN2QyxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsR0FBRyxXQUFXLElBQUksU0FBUyxDQUFDO1FBQ2pELE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEOzs7T0FHRztJQUNILE1BQU0sQ0FBQyxHQUFrQjtRQUN2QixJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsR0FBRyxHQUFHLElBQUksU0FBUyxDQUFDO1FBQ2pDLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEOzs7T0FHRztJQUNILFlBQVksQ0FBQyxZQUFrQyxJQUFJLENBQUMsR0FBRyxFQUFFO1FBQ3ZELElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxHQUFHLFNBQVMsS0FBSyxJQUFJO1lBQ3RDLENBQUMsQ0FBQyxTQUFTO1lBQ1gsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLFNB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LElBQUksRUFBRSxRQUFRO0lBQ2QsTUFBTSxFQUFFLFFBQVE7SUFDaEIsR0FBRyxFQUFFLFFBQVE7SUFDYixJQUFJLEVBQUUsUUFBUTtJQUNkLElBQUksRUFBRSxRQUFRO0lBQ2QsUUFBUSxFQUFFLFFBQVE7SUFDbEIsU0FBUyxFQUFFLFFBQVE7SUFDbkIsUUFBUSxFQUFFLFFBQVE7SUFDbEIsVUFBVSxFQUFFLFFBQVE7SUFDcEIsYUFBYSxFQUFFLFFBQVE7SUFDdkIsUUFBUSxFQUFFLFFBQVE7SUFDbEIsVUFBVSxFQUFFLFFBQVE7SUFDcEIsT0FBTyxFQUFFLFFBQVE7SUFDakIsUUFBUSxFQUFFLFFBQVE7SUFDbEIsVUFBVSxFQUFFLFFBQVE7SUFDcEIsU0FBUyxFQUFFLFFBQVE7SUFDbkIsUUFBUSxFQUFFLFFBQVE7SUFDbEIsT0FBTyxFQUFFLFFBQVE7SUFDakIsT0FBTyxFQUFFLFFBQVE7SUFDakIsZUFBZSxFQUFFLFFBQVE7SUFDekIsYUFBYSxFQUFFLFFBQVE7Q0FDZixDQUFDO0FBRVgsa0JBQWUsWUFBWSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIEVtYmVkQnVpbGRlciBmb3IgY3JlYXRpbmcgcmljaCBlbWJlZHNcclxuICovXHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEFQSUVtYmVkRmllbGQge1xyXG4gIG5hbWU6IHN0cmluZztcclxuICB2YWx1ZTogc3RyaW5nO1xyXG4gIGlubGluZT86IGJvb2xlYW47XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgQVBJRW1iZWRBdXRob3Ige1xyXG4gIG5hbWU6IHN0cmluZztcclxuICB1cmw/OiBzdHJpbmc7XHJcbiAgaWNvbl91cmw/OiBzdHJpbmc7XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgQVBJRW1iZWRGb290ZXIge1xyXG4gIHRleHQ6IHN0cmluZztcclxuICBpY29uX3VybD86IHN0cmluZztcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBBUElFbWJlZEltYWdlIHtcclxuICB1cmw6IHN0cmluZztcclxuICBoZWlnaHQ/OiBudW1iZXI7XHJcbiAgd2lkdGg/OiBudW1iZXI7XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgQVBJRW1iZWRUaHVtYm5haWwge1xyXG4gIHVybDogc3RyaW5nO1xyXG4gIGhlaWdodD86IG51bWJlcjtcclxuICB3aWR0aD86IG51bWJlcjtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBBUElFbWJlZCB7XHJcbiAgdGl0bGU/OiBzdHJpbmc7XHJcbiAgZGVzY3JpcHRpb24/OiBzdHJpbmc7XHJcbiAgdXJsPzogc3RyaW5nO1xyXG4gIHRpbWVzdGFtcD86IHN0cmluZztcclxuICBjb2xvcj86IG51bWJlcjtcclxuICBmb290ZXI/OiBBUElFbWJlZEZvb3RlcjtcclxuICBpbWFnZT86IEFQSUVtYmVkSW1hZ2U7XHJcbiAgdGh1bWJuYWlsPzogQVBJRW1iZWRUaHVtYm5haWw7XHJcbiAgYXV0aG9yPzogQVBJRW1iZWRBdXRob3I7XHJcbiAgZmllbGRzPzogQVBJRW1iZWRGaWVsZFtdO1xyXG59XHJcblxyXG4vKipcclxuICogQSBidWlsZGVyIGZvciBjcmVhdGluZyBlbWJlZHNcclxuICovXHJcbmV4cG9ydCBjbGFzcyBFbWJlZEJ1aWxkZXIge1xyXG4gIHB1YmxpYyByZWFkb25seSBkYXRhOiBBUElFbWJlZDtcclxuXHJcbiAgY29uc3RydWN0b3IoZGF0YTogQVBJRW1iZWQgPSB7fSkge1xyXG4gICAgdGhpcy5kYXRhID0geyAuLi5kYXRhIH07XHJcbiAgICBpZiAoZGF0YS5maWVsZHMpIHtcclxuICAgICAgdGhpcy5kYXRhLmZpZWxkcyA9IFsuLi5kYXRhLmZpZWxkc107XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZXRzIHRoZSB0aXRsZSBvZiB0aGlzIGVtYmVkXHJcbiAgICogQHBhcmFtIHRpdGxlIFRoZSB0aXRsZVxyXG4gICAqL1xyXG4gIHNldFRpdGxlKHRpdGxlOiBzdHJpbmcgfCBudWxsKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEudGl0bGUgPSB0aXRsZSA/PyB1bmRlZmluZWQ7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldHMgdGhlIGRlc2NyaXB0aW9uIG9mIHRoaXMgZW1iZWRcclxuICAgKiBAcGFyYW0gZGVzY3JpcHRpb24gVGhlIGRlc2NyaXB0aW9uXHJcbiAgICovXHJcbiAgc2V0RGVzY3JpcHRpb24oZGVzY3JpcHRpb246IHN0cmluZyB8IG51bGwpOiB0aGlzIHtcclxuICAgIHRoaXMuZGF0YS5kZXNjcmlwdGlvbiA9IGRlc2NyaXB0aW9uID8/IHVuZGVmaW5lZDtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2V0cyB0aGUgVVJMIG9mIHRoaXMgZW1iZWRcclxuICAgKiBAcGFyYW0gdXJsIFRoZSBVUkxcclxuICAgKi9cclxuICBzZXRVUkwodXJsOiBzdHJpbmcgfCBudWxsKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEudXJsID0gdXJsID8/IHVuZGVmaW5lZDtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2V0cyB0aGUgdGltZXN0YW1wIG9mIHRoaXMgZW1iZWRcclxuICAgKiBAcGFyYW0gdGltZXN0YW1wIFRoZSB0aW1lc3RhbXAgb3IgZGF0ZVxyXG4gICAqL1xyXG4gIHNldFRpbWVzdGFtcCh0aW1lc3RhbXA6IERhdGUgfCBudW1iZXIgfCBudWxsID0gRGF0ZS5ub3coKSk6IHRoaXMge1xyXG4gICAgdGhpcy5kYXRhLnRpbWVzdGFtcCA9IHRpbWVzdGFtcCA9PT0gbnVsbCBcclxuICAgICAgPyB1bmRlZmluZWQgXHJcbiAgICAgIDogbmV3IERhdGUodGltZXN0YW1wKS50b0lTT1N0cmluZygpO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZXRzIHRoZSBjb2xvciBvZiB0aGlzIGVtYmVkXHJcbiAgICogQHBhcmFtIGNvbG9yIFRoZSBjb2xvciAobnVtYmVyLCBoZXggc3RyaW5nLCBvciBSR0IgYXJyYXkpXHJcbiAgICovXHJcbiAgc2V0Q29sb3IoY29sb3I6IG51bWJlciB8IGAjJHtzdHJpbmd9YCB8IFtudW1iZXIsIG51bWJlciwgbnVtYmVyXSB8IG51bGwpOiB0aGlzIHtcclxuICAgIGlmIChjb2xvciA9PT0gbnVsbCkge1xyXG4gICAgICB0aGlzLmRhdGEuY29sb3IgPSB1bmRlZmluZWQ7XHJcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBjb2xvciA9PT0gJ251bWJlcicpIHtcclxuICAgICAgdGhpcy5kYXRhLmNvbG9yID0gY29sb3I7XHJcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBjb2xvciA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgdGhpcy5kYXRhLmNvbG9yID0gcGFyc2VJbnQoY29sb3IucmVwbGFjZSgnIycsICcnKSwgMTYpO1xyXG4gICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGNvbG9yKSkge1xyXG4gICAgICB0aGlzLmRhdGEuY29sb3IgPSAoY29sb3JbMF0gPDwgMTYpICsgKGNvbG9yWzFdIDw8IDgpICsgY29sb3JbMl07XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldHMgdGhlIGZvb3RlciBvZiB0aGlzIGVtYmVkXHJcbiAgICogQHBhcmFtIG9wdGlvbnMgVGhlIGZvb3RlciBvcHRpb25zXHJcbiAgICovXHJcbiAgc2V0Rm9vdGVyKG9wdGlvbnM6IHsgdGV4dDogc3RyaW5nOyBpY29uVVJMPzogc3RyaW5nIH0gfCBudWxsKTogdGhpcyB7XHJcbiAgICBpZiAob3B0aW9ucyA9PT0gbnVsbCkge1xyXG4gICAgICB0aGlzLmRhdGEuZm9vdGVyID0gdW5kZWZpbmVkO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5kYXRhLmZvb3RlciA9IHtcclxuICAgICAgICB0ZXh0OiBvcHRpb25zLnRleHQsXHJcbiAgICAgICAgaWNvbl91cmw6IG9wdGlvbnMuaWNvblVSTCxcclxuICAgICAgfTtcclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2V0cyB0aGUgaW1hZ2Ugb2YgdGhpcyBlbWJlZFxyXG4gICAqIEBwYXJhbSB1cmwgVGhlIGltYWdlIFVSTFxyXG4gICAqL1xyXG4gIHNldEltYWdlKHVybDogc3RyaW5nIHwgbnVsbCk6IHRoaXMge1xyXG4gICAgdGhpcy5kYXRhLmltYWdlID0gdXJsID09PSBudWxsID8gdW5kZWZpbmVkIDogeyB1cmwgfTtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2V0cyB0aGUgdGh1bWJuYWlsIG9mIHRoaXMgZW1iZWRcclxuICAgKiBAcGFyYW0gdXJsIFRoZSB0aHVtYm5haWwgVVJMXHJcbiAgICovXHJcbiAgc2V0VGh1bWJuYWlsKHVybDogc3RyaW5nIHwgbnVsbCk6IHRoaXMge1xyXG4gICAgdGhpcy5kYXRhLnRodW1ibmFpbCA9IHVybCA9PT0gbnVsbCA/IHVuZGVmaW5lZCA6IHsgdXJsIH07XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldHMgdGhlIGF1dGhvciBvZiB0aGlzIGVtYmVkXHJcbiAgICogQHBhcmFtIG9wdGlvbnMgVGhlIGF1dGhvciBvcHRpb25zXHJcbiAgICovXHJcbiAgc2V0QXV0aG9yKG9wdGlvbnM6IHsgbmFtZTogc3RyaW5nOyBpY29uVVJMPzogc3RyaW5nOyB1cmw/OiBzdHJpbmcgfSB8IG51bGwpOiB0aGlzIHtcclxuICAgIGlmIChvcHRpb25zID09PSBudWxsKSB7XHJcbiAgICAgIHRoaXMuZGF0YS5hdXRob3IgPSB1bmRlZmluZWQ7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLmRhdGEuYXV0aG9yID0ge1xyXG4gICAgICAgIG5hbWU6IG9wdGlvbnMubmFtZSxcclxuICAgICAgICBpY29uX3VybDogb3B0aW9ucy5pY29uVVJMLFxyXG4gICAgICAgIHVybDogb3B0aW9ucy51cmwsXHJcbiAgICAgIH07XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEFkZHMgZmllbGRzIHRvIHRoaXMgZW1iZWRcclxuICAgKiBAcGFyYW0gZmllbGRzIFRoZSBmaWVsZHMgdG8gYWRkXHJcbiAgICovXHJcbiAgYWRkRmllbGRzKC4uLmZpZWxkczogQVBJRW1iZWRGaWVsZFtdKTogdGhpcyB7XHJcbiAgICBpZiAoIXRoaXMuZGF0YS5maWVsZHMpIHRoaXMuZGF0YS5maWVsZHMgPSBbXTtcclxuICAgIHRoaXMuZGF0YS5maWVsZHMucHVzaCguLi5maWVsZHMpO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZXRzIHRoZSBmaWVsZHMgb2YgdGhpcyBlbWJlZFxyXG4gICAqIEBwYXJhbSBmaWVsZHMgVGhlIGZpZWxkcyB0byBzZXRcclxuICAgKi9cclxuICBzZXRGaWVsZHMoLi4uZmllbGRzOiBBUElFbWJlZEZpZWxkW10pOiB0aGlzIHtcclxuICAgIHRoaXMuZGF0YS5maWVsZHMgPSBmaWVsZHM7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlbW92ZXMsIHJlcGxhY2VzLCBvciBpbnNlcnRzIGZpZWxkc1xyXG4gICAqIEBwYXJhbSBpbmRleCBUaGUgaW5kZXggdG8gc3RhcnQgYXRcclxuICAgKiBAcGFyYW0gZGVsZXRlQ291bnQgVGhlIG51bWJlciBvZiBmaWVsZHMgdG8gcmVtb3ZlXHJcbiAgICogQHBhcmFtIGZpZWxkcyBUaGUgZmllbGRzIHRvIGluc2VydFxyXG4gICAqL1xyXG4gIHNwbGljZUZpZWxkcyhpbmRleDogbnVtYmVyLCBkZWxldGVDb3VudDogbnVtYmVyLCAuLi5maWVsZHM6IEFQSUVtYmVkRmllbGRbXSk6IHRoaXMge1xyXG4gICAgaWYgKCF0aGlzLmRhdGEuZmllbGRzKSB0aGlzLmRhdGEuZmllbGRzID0gW107XHJcbiAgICB0aGlzLmRhdGEuZmllbGRzLnNwbGljZShpbmRleCwgZGVsZXRlQ291bnQsIC4uLmZpZWxkcyk7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJldHVybnMgdGhlIEpTT04gcmVwcmVzZW50YXRpb24gb2YgdGhpcyBlbWJlZFxyXG4gICAqL1xyXG4gIHRvSlNPTigpOiBBUElFbWJlZCB7XHJcbiAgICByZXR1cm4geyAuLi50aGlzLmRhdGEgfTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZXMgYSBuZXcgZW1iZWQgYnVpbGRlciBmcm9tIGV4aXN0aW5nIGRhdGFcclxuICAgKiBAcGFyYW0gb3RoZXIgVGhlIGVtYmVkIGRhdGEgdG8gY29weVxyXG4gICAqL1xyXG4gIHN0YXRpYyBmcm9tKG90aGVyOiBBUElFbWJlZCB8IEVtYmVkQnVpbGRlcik6IEVtYmVkQnVpbGRlciB7XHJcbiAgICByZXR1cm4gbmV3IEVtYmVkQnVpbGRlcihvdGhlciBpbnN0YW5jZW9mIEVtYmVkQnVpbGRlciA/IG90aGVyLmRhdGEgOiBvdGhlcik7XHJcbiAgfVxyXG59XHJcblxyXG4vLyBDb2xvciBjb25zdGFudHMgKERKUyBjb21wYXRpYmlsaXR5KVxyXG5leHBvcnQgY29uc3QgQ29sb3JzID0ge1xyXG4gIERlZmF1bHQ6IDB4MDAwMDAwLFxyXG4gIFdoaXRlOiAweGZmZmZmZixcclxuICBBcXVhOiAweDFhYmM5YyxcclxuICBHcmVlbjogMHg1N2YyODcsXHJcbiAgQmx1ZTogMHgzNDk4ZGIsXHJcbiAgWWVsbG93OiAweGZlZTc1YyxcclxuICBQdXJwbGU6IDB4OWI1OWI2LFxyXG4gIEx1bWlub3VzVml2aWRQaW5rOiAweGU5MWU2MyxcclxuICBGdWNoc2lhOiAweGViNDU5ZSxcclxuICBHb2xkOiAweGYxYzQwZixcclxuICBPcmFuZ2U6IDB4ZTY3ZTIyLFxyXG4gIFJlZDogMHhlZDQyNDUsXHJcbiAgR3JleTogMHg5NWE1YTYsXHJcbiAgTmF2eTogMHgzNDQ5NWUsXHJcbiAgRGFya0FxdWE6IDB4MTE4MDZhLFxyXG4gIERhcmtHcmVlbjogMHgxZjhiNGMsXHJcbiAgRGFya0JsdWU6IDB4MjA2Njk0LFxyXG4gIERhcmtQdXJwbGU6IDB4NzEzNjhhLFxyXG4gIERhcmtWaXZpZFBpbms6IDB4YWQxNDU3LFxyXG4gIERhcmtHb2xkOiAweGMyN2MwZSxcclxuICBEYXJrT3JhbmdlOiAweGE4NDMwMCxcclxuICBEYXJrUmVkOiAweDk5MmQyMixcclxuICBEYXJrR3JleTogMHg5NzljOWYsXHJcbiAgRGFya2VyR3JleTogMHg3ZjhjOGQsXHJcbiAgTGlnaHRHcmV5OiAweGJjYzBjMCxcclxuICBEYXJrTmF2eTogMHgyYzNlNTAsXHJcbiAgQmx1cnBsZTogMHg1ODY1ZjIsXHJcbiAgR3JleXBsZTogMHg5OWFhYjUsXHJcbiAgRGFya0J1dE5vdEJsYWNrOiAweDJjMmYzMyxcclxuICBOb3RRdWl0ZUJsYWNrOiAweDIzMjcyYSxcclxufSBhcyBjb25zdDtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IEVtYmVkQnVpbGRlcjtcclxuIl19