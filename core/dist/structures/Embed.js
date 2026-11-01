"use strict";
/**
 * Embed - Read-only embed wrapper with toBuilder() support
 * message.embeds[0].toBuilder() ergonomisi için
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Embed = void 0;
const EmbedBuilder_1 = require("../builders/EmbedBuilder");
/**
 * Represents an embed received from the API
 * Provides read-only access to embed properties and toBuilder() for editing
 */
class Embed {
    data;
    constructor(data) {
        this.data = data;
    }
    /** Embed title */
    get title() {
        return this.data.title;
    }
    /** Embed description */
    get description() {
        return this.data.description;
    }
    /** Embed URL */
    get url() {
        return this.data.url;
    }
    /** Embed timestamp */
    get timestamp() {
        return this.data.timestamp;
    }
    /** Embed color */
    get color() {
        return this.data.color;
    }
    /** Embed footer */
    get footer() {
        return this.data.footer;
    }
    /** Embed image */
    get image() {
        return this.data.image;
    }
    /** Embed thumbnail */
    get thumbnail() {
        return this.data.thumbnail;
    }
    /** Embed author */
    get author() {
        return this.data.author;
    }
    /** Embed fields */
    get fields() {
        return this.data.fields ?? [];
    }
    /**
     * Total character count of this embed
     */
    get length() {
        let total = 0;
        if (this.data.title)
            total += this.data.title.length;
        if (this.data.description)
            total += this.data.description.length;
        if (this.data.footer?.text)
            total += this.data.footer.text.length;
        if (this.data.author?.name)
            total += this.data.author.name.length;
        if (this.data.fields) {
            for (const field of this.data.fields) {
                total += (field.name?.length || 0) + (field.value?.length || 0);
            }
        }
        return total;
    }
    /**
     * Convert this embed to an EmbedBuilder for editing
     * @example
     * const newEmbed = message.embeds[0].toBuilder()
     *   .setDescription('Updated description');
     * await message.edit({ embeds: [newEmbed] });
     */
    toBuilder() {
        return EmbedBuilder_1.EmbedBuilder.from(this.data);
    }
    /**
     * Get the raw API embed data
     */
    toJSON() {
        return { ...this.data };
    }
}
exports.Embed = Embed;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRW1iZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvc3RydWN0dXJlcy9FbWJlZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOzs7QUFFSCwyREFBbUo7QUFFbko7OztHQUdHO0FBQ0gsTUFBYSxLQUFLO0lBQ0MsSUFBSSxDQUFXO0lBRWhDLFlBQVksSUFBYztRQUN4QixJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztJQUNuQixDQUFDO0lBRUQsa0JBQWtCO0lBQ2xCLElBQUksS0FBSztRQUNQLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUM7SUFDekIsQ0FBQztJQUVELHdCQUF3QjtJQUN4QixJQUFJLFdBQVc7UUFDYixPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDO0lBQy9CLENBQUM7SUFFRCxnQkFBZ0I7SUFDaEIsSUFBSSxHQUFHO1FBQ0wsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQztJQUN2QixDQUFDO0lBRUQsc0JBQXNCO0lBQ3RCLElBQUksU0FBUztRQUNYLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUM7SUFDN0IsQ0FBQztJQUVELGtCQUFrQjtJQUNsQixJQUFJLEtBQUs7UUFDUCxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDO0lBQ3pCLENBQUM7SUFFRCxtQkFBbUI7SUFDbkIsSUFBSSxNQUFNO1FBQ1IsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztJQUMxQixDQUFDO0lBRUQsa0JBQWtCO0lBQ2xCLElBQUksS0FBSztRQUNQLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUM7SUFDekIsQ0FBQztJQUVELHNCQUFzQjtJQUN0QixJQUFJLFNBQVM7UUFDWCxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDO0lBQzdCLENBQUM7SUFFRCxtQkFBbUI7SUFDbkIsSUFBSSxNQUFNO1FBQ1IsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQztJQUMxQixDQUFDO0lBRUQsbUJBQW1CO0lBQ25CLElBQUksTUFBTTtRQUNSLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLElBQUksRUFBRSxDQUFDO0lBQ2hDLENBQUM7SUFFRDs7T0FFRztJQUNILElBQUksTUFBTTtRQUNSLElBQUksS0FBSyxHQUFHLENBQUMsQ0FBQztRQUNkLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLO1lBQUUsS0FBSyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQztRQUNyRCxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVztZQUFFLEtBQUssSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUM7UUFDakUsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJO1lBQUUsS0FBSyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7UUFDbEUsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJO1lBQUUsS0FBSyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7UUFDbEUsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ3JCLEtBQUssTUFBTSxLQUFLLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDckMsS0FBSyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxNQUFNLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFFLE1BQU0sSUFBSSxDQUFDLENBQUMsQ0FBQztZQUNsRSxDQUFDO1FBQ0gsQ0FBQztRQUNELE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUVEOzs7Ozs7T0FNRztJQUNILFNBQVM7UUFDUCxPQUFPLDJCQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN0QyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxNQUFNO1FBQ0osT0FBTyxFQUFFLEdBQUcsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO0lBQzFCLENBQUM7Q0FDRjtBQTNGRCxzQkEyRkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogRW1iZWQgLSBSZWFkLW9ubHkgZW1iZWQgd3JhcHBlciB3aXRoIHRvQnVpbGRlcigpIHN1cHBvcnRcclxuICogbWVzc2FnZS5lbWJlZHNbMF0udG9CdWlsZGVyKCkgZXJnb25vbWlzaSBpw6dpblxyXG4gKi9cclxuXHJcbmltcG9ydCB7IEVtYmVkQnVpbGRlciwgQVBJRW1iZWQsIEFQSUVtYmVkRmllbGQsIEFQSUVtYmVkQXV0aG9yLCBBUElFbWJlZEZvb3RlciwgQVBJRW1iZWRJbWFnZSwgQVBJRW1iZWRUaHVtYm5haWwgfSBmcm9tICcuLi9idWlsZGVycy9FbWJlZEJ1aWxkZXInO1xyXG5cclxuLyoqXHJcbiAqIFJlcHJlc2VudHMgYW4gZW1iZWQgcmVjZWl2ZWQgZnJvbSB0aGUgQVBJXHJcbiAqIFByb3ZpZGVzIHJlYWQtb25seSBhY2Nlc3MgdG8gZW1iZWQgcHJvcGVydGllcyBhbmQgdG9CdWlsZGVyKCkgZm9yIGVkaXRpbmdcclxuICovXHJcbmV4cG9ydCBjbGFzcyBFbWJlZCB7XHJcbiAgcHJpdmF0ZSByZWFkb25seSBkYXRhOiBBUElFbWJlZDtcclxuXHJcbiAgY29uc3RydWN0b3IoZGF0YTogQVBJRW1iZWQpIHtcclxuICAgIHRoaXMuZGF0YSA9IGRhdGE7XHJcbiAgfVxyXG5cclxuICAvKiogRW1iZWQgdGl0bGUgKi9cclxuICBnZXQgdGl0bGUoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcclxuICAgIHJldHVybiB0aGlzLmRhdGEudGl0bGU7XHJcbiAgfVxyXG5cclxuICAvKiogRW1iZWQgZGVzY3JpcHRpb24gKi9cclxuICBnZXQgZGVzY3JpcHRpb24oKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcclxuICAgIHJldHVybiB0aGlzLmRhdGEuZGVzY3JpcHRpb247XHJcbiAgfVxyXG5cclxuICAvKiogRW1iZWQgVVJMICovXHJcbiAgZ2V0IHVybCgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xyXG4gICAgcmV0dXJuIHRoaXMuZGF0YS51cmw7XHJcbiAgfVxyXG5cclxuICAvKiogRW1iZWQgdGltZXN0YW1wICovXHJcbiAgZ2V0IHRpbWVzdGFtcCgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xyXG4gICAgcmV0dXJuIHRoaXMuZGF0YS50aW1lc3RhbXA7XHJcbiAgfVxyXG5cclxuICAvKiogRW1iZWQgY29sb3IgKi9cclxuICBnZXQgY29sb3IoKTogbnVtYmVyIHwgdW5kZWZpbmVkIHtcclxuICAgIHJldHVybiB0aGlzLmRhdGEuY29sb3I7XHJcbiAgfVxyXG5cclxuICAvKiogRW1iZWQgZm9vdGVyICovXHJcbiAgZ2V0IGZvb3RlcigpOiBBUElFbWJlZEZvb3RlciB8IHVuZGVmaW5lZCB7XHJcbiAgICByZXR1cm4gdGhpcy5kYXRhLmZvb3RlcjtcclxuICB9XHJcblxyXG4gIC8qKiBFbWJlZCBpbWFnZSAqL1xyXG4gIGdldCBpbWFnZSgpOiBBUElFbWJlZEltYWdlIHwgdW5kZWZpbmVkIHtcclxuICAgIHJldHVybiB0aGlzLmRhdGEuaW1hZ2U7XHJcbiAgfVxyXG5cclxuICAvKiogRW1iZWQgdGh1bWJuYWlsICovXHJcbiAgZ2V0IHRodW1ibmFpbCgpOiBBUElFbWJlZFRodW1ibmFpbCB8IHVuZGVmaW5lZCB7XHJcbiAgICByZXR1cm4gdGhpcy5kYXRhLnRodW1ibmFpbDtcclxuICB9XHJcblxyXG4gIC8qKiBFbWJlZCBhdXRob3IgKi9cclxuICBnZXQgYXV0aG9yKCk6IEFQSUVtYmVkQXV0aG9yIHwgdW5kZWZpbmVkIHtcclxuICAgIHJldHVybiB0aGlzLmRhdGEuYXV0aG9yO1xyXG4gIH1cclxuXHJcbiAgLyoqIEVtYmVkIGZpZWxkcyAqL1xyXG4gIGdldCBmaWVsZHMoKTogQVBJRW1iZWRGaWVsZFtdIHtcclxuICAgIHJldHVybiB0aGlzLmRhdGEuZmllbGRzID8/IFtdO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVG90YWwgY2hhcmFjdGVyIGNvdW50IG9mIHRoaXMgZW1iZWRcclxuICAgKi9cclxuICBnZXQgbGVuZ3RoKCk6IG51bWJlciB7XHJcbiAgICBsZXQgdG90YWwgPSAwO1xyXG4gICAgaWYgKHRoaXMuZGF0YS50aXRsZSkgdG90YWwgKz0gdGhpcy5kYXRhLnRpdGxlLmxlbmd0aDtcclxuICAgIGlmICh0aGlzLmRhdGEuZGVzY3JpcHRpb24pIHRvdGFsICs9IHRoaXMuZGF0YS5kZXNjcmlwdGlvbi5sZW5ndGg7XHJcbiAgICBpZiAodGhpcy5kYXRhLmZvb3Rlcj8udGV4dCkgdG90YWwgKz0gdGhpcy5kYXRhLmZvb3Rlci50ZXh0Lmxlbmd0aDtcclxuICAgIGlmICh0aGlzLmRhdGEuYXV0aG9yPy5uYW1lKSB0b3RhbCArPSB0aGlzLmRhdGEuYXV0aG9yLm5hbWUubGVuZ3RoO1xyXG4gICAgaWYgKHRoaXMuZGF0YS5maWVsZHMpIHtcclxuICAgICAgZm9yIChjb25zdCBmaWVsZCBvZiB0aGlzLmRhdGEuZmllbGRzKSB7XHJcbiAgICAgICAgdG90YWwgKz0gKGZpZWxkLm5hbWU/Lmxlbmd0aCB8fCAwKSArIChmaWVsZC52YWx1ZT8ubGVuZ3RoIHx8IDApO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdG90YWw7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDb252ZXJ0IHRoaXMgZW1iZWQgdG8gYW4gRW1iZWRCdWlsZGVyIGZvciBlZGl0aW5nXHJcbiAgICogQGV4YW1wbGVcclxuICAgKiBjb25zdCBuZXdFbWJlZCA9IG1lc3NhZ2UuZW1iZWRzWzBdLnRvQnVpbGRlcigpXHJcbiAgICogICAuc2V0RGVzY3JpcHRpb24oJ1VwZGF0ZWQgZGVzY3JpcHRpb24nKTtcclxuICAgKiBhd2FpdCBtZXNzYWdlLmVkaXQoeyBlbWJlZHM6IFtuZXdFbWJlZF0gfSk7XHJcbiAgICovXHJcbiAgdG9CdWlsZGVyKCk6IEVtYmVkQnVpbGRlciB7XHJcbiAgICByZXR1cm4gRW1iZWRCdWlsZGVyLmZyb20odGhpcy5kYXRhKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCB0aGUgcmF3IEFQSSBlbWJlZCBkYXRhXHJcbiAgICovXHJcbiAgdG9KU09OKCk6IEFQSUVtYmVkIHtcclxuICAgIHJldHVybiB7IC4uLnRoaXMuZGF0YSB9O1xyXG4gIH1cclxufVxyXG4iXX0=