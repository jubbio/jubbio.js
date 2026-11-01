"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const serialize_1 = require("../utils/serialize");
/**
 * Represents a user
 */
class User {
    /** Reference to the client (optional for backward compatibility) */
    client;
    /** User ID */
    id;
    /** Username */
    username;
    /** Display name */
    displayName;
    /** Avatar URL */
    avatarURL;
    /** Whether this is a bot */
    bot;
    constructor(data, client) {
        this.client = client;
        // Handle both string and number IDs (snowflake precision issue)
        this.id = String(data.id);
        this.username = data.username || `User_${this.id}`;
        this.displayName = data.display_name;
        this.avatarURL = data.avatar_url;
        this.bot = data.bot ?? false;
    }
    /**
     * Get the user's tag (username)
     */
    get tag() {
        return this.username;
    }
    /**
     * Get the default avatar URL
     */
    get defaultAvatarURL() {
        return `https://cdn.jubbio.com/embed/avatars/${parseInt(this.id) % 5}.png`;
    }
    /**
     * Get the display avatar URL
     */
    displayAvatarURL() {
        return this.avatarURL || this.defaultAvatarURL;
    }
    /**
     * Convert to string (mention format)
     */
    toString() {
        return `<@${this.id}>`;
    }
    /**
     * Update user data
     * Uses type assertion to allow updates to readonly properties
     */
    _patch(data) {
        if (data.username !== undefined)
            this.username = data.username;
        if (data.display_name !== undefined)
            this.displayName = data.display_name;
        if (data.avatar_url !== undefined)
            this.avatarURL = data.avatar_url;
        if (data.bot !== undefined)
            this.bot = data.bot;
    }
    /**
     * Send a direct message to this user
     * Requires client reference to be set
     *
     * @example
     * await user.send({ content: 'Hello!' });
     * await user.send({ embeds: [embed] });
     * await user.send({ files: [{ name: 'test.txt', data: Buffer.from('hello') }] });
     */
    async send(options) {
        if (!this.client) {
            throw new Error('Cannot send DM: User was created without client reference');
        }
        const content = typeof options === 'string' ? options : options.content;
        const rawEmbeds = typeof options === 'string' ? undefined : options.embeds;
        const rawComponents = typeof options === 'string' ? undefined : options.components;
        const flags = typeof options === 'string' ? undefined : options.flags;
        const files = typeof options === 'string' ? undefined : options.files;
        // Convert EmbedBuilder instances to plain objects
        const embeds = rawEmbeds?.map(e => typeof e.toJSON === 'function' ? e.toJSON() : e);
        // Convert component builder instances to plain objects
        const components = (0, serialize_1.serializeComponents)(rawComponents);
        // use createDMMessageWithFile for file uploads, createDMMessage otherwise
        if (files && files.length > 0) {
            return this.client.rest.createDMMessageWithFile(this.id, { content, embeds, components, flags }, files);
        }
        return this.client.rest.createDMMessage(this.id, { content, embeds, components, flags });
    }
}
exports.User = User;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVXNlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zdHJ1Y3R1cmVzL1VzZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQ0Esa0RBQXlEO0FBZXpEOztHQUVHO0FBQ0gsTUFBYSxJQUFJO0lBQ2Ysb0VBQW9FO0lBQ3BELE1BQU0sQ0FBVTtJQUVoQyxjQUFjO0lBQ0UsRUFBRSxDQUFTO0lBRTNCLGVBQWU7SUFDQyxRQUFRLENBQVM7SUFFakMsbUJBQW1CO0lBQ0gsV0FBVyxDQUFVO0lBRXJDLGlCQUFpQjtJQUNELFNBQVMsQ0FBVTtJQUVuQyw0QkFBNEI7SUFDWixHQUFHLENBQVU7SUFFN0IsWUFBWSxJQUFhLEVBQUUsTUFBZTtRQUN4QyxJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztRQUNyQixnRUFBZ0U7UUFDaEUsSUFBSSxDQUFDLEVBQUUsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQzFCLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLFFBQVEsSUFBSSxRQUFRLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQztRQUNuRCxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUM7UUFDckMsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDO1FBQ2pDLElBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsSUFBSSxLQUFLLENBQUM7SUFDL0IsQ0FBQztJQUVEOztPQUVHO0lBQ0gsSUFBSSxHQUFHO1FBQ0wsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDO0lBQ3ZCLENBQUM7SUFFRDs7T0FFRztJQUNILElBQUksZ0JBQWdCO1FBQ2xCLE9BQU8sd0NBQXdDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUM7SUFDN0UsQ0FBQztJQUVEOztPQUVHO0lBQ0gsZ0JBQWdCO1FBQ2QsT0FBTyxJQUFJLENBQUMsU0FBUyxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQztJQUNqRCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxRQUFRO1FBQ04sT0FBTyxLQUFLLElBQUksQ0FBQyxFQUFFLEdBQUcsQ0FBQztJQUN6QixDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsTUFBTSxDQUFDLElBQXNCO1FBQzNCLElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxTQUFTO1lBQUcsSUFBNkIsQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQztRQUN6RixJQUFJLElBQUksQ0FBQyxZQUFZLEtBQUssU0FBUztZQUFHLElBQWlDLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUM7UUFDeEcsSUFBSSxJQUFJLENBQUMsVUFBVSxLQUFLLFNBQVM7WUFBRyxJQUErQixDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDO1FBQ2hHLElBQUksSUFBSSxDQUFDLEdBQUcsS0FBSyxTQUFTO1lBQUcsSUFBeUIsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQztJQUN4RSxDQUFDO0lBRUQ7Ozs7Ozs7O09BUUc7SUFDSCxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQWtDO1FBQzNDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDakIsTUFBTSxJQUFJLEtBQUssQ0FBQywyREFBMkQsQ0FBQyxDQUFDO1FBQy9FLENBQUM7UUFFRCxNQUFNLE9BQU8sR0FBRyxPQUFPLE9BQU8sS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQztRQUN4RSxNQUFNLFNBQVMsR0FBRyxPQUFPLE9BQU8sS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQztRQUMzRSxNQUFNLGFBQWEsR0FBRyxPQUFPLE9BQU8sS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQztRQUNuRixNQUFNLEtBQUssR0FBRyxPQUFPLE9BQU8sS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQztRQUN0RSxNQUFNLEtBQUssR0FBRyxPQUFPLE9BQU8sS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQztRQUV0RSxrREFBa0Q7UUFDbEQsTUFBTSxNQUFNLEdBQUcsU0FBUyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUNoQyxPQUFRLENBQVMsQ0FBQyxNQUFNLEtBQUssVUFBVSxDQUFDLENBQUMsQ0FBRSxDQUFTLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FDbEUsQ0FBQztRQUVGLHVEQUF1RDtRQUN2RCxNQUFNLFVBQVUsR0FBRyxJQUFBLCtCQUFtQixFQUFDLGFBQWEsQ0FBQyxDQUFDO1FBRXRELDBFQUEwRTtRQUMxRSxJQUFJLEtBQUssSUFBSSxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQzlCLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRSxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsVUFBVSxFQUFFLEtBQUssRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzFHLENBQUM7UUFFRCxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQztJQUMzRixDQUFDO0NBQ0Y7QUF2R0Qsb0JBdUdDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQVBJVXNlciwgQVBJRW1iZWQgfSBmcm9tICcuLi90eXBlcyc7XHJcbmltcG9ydCB7IHNlcmlhbGl6ZUNvbXBvbmVudHMgfSBmcm9tICcuLi91dGlscy9zZXJpYWxpemUnO1xyXG5pbXBvcnQgdHlwZSB7IENsaWVudCB9IGZyb20gJy4uL0NsaWVudCc7XHJcbmltcG9ydCB0eXBlIHsgRW1iZWRCdWlsZGVyIH0gZnJvbSAnLi4vYnVpbGRlcnMvRW1iZWRCdWlsZGVyJztcclxuXHJcbi8qKlxyXG4gKiBPcHRpb25zIGZvciBzZW5kaW5nIGEgRE0gbWVzc2FnZVxyXG4gKi9cclxuZXhwb3J0IGludGVyZmFjZSBETU1lc3NhZ2VPcHRpb25zIHtcclxuICBmbGFncz86IG51bWJlcjtcclxuICBjb250ZW50Pzogc3RyaW5nO1xyXG4gIGVtYmVkcz86IChBUElFbWJlZCB8IEVtYmVkQnVpbGRlcilbXTtcclxuICBjb21wb25lbnRzPzogYW55W107XHJcbiAgZmlsZXM/OiBBcnJheTx7IG5hbWU6IHN0cmluZzsgZGF0YTogQnVmZmVyIHwgc3RyaW5nIH0+O1xyXG59XHJcblxyXG4vKipcclxuICogUmVwcmVzZW50cyBhIHVzZXJcclxuICovXHJcbmV4cG9ydCBjbGFzcyBVc2VyIHtcclxuICAvKiogUmVmZXJlbmNlIHRvIHRoZSBjbGllbnQgKG9wdGlvbmFsIGZvciBiYWNrd2FyZCBjb21wYXRpYmlsaXR5KSAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBjbGllbnQ/OiBDbGllbnQ7XHJcbiAgXHJcbiAgLyoqIFVzZXIgSUQgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgaWQ6IHN0cmluZztcclxuICBcclxuICAvKiogVXNlcm5hbWUgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgdXNlcm5hbWU6IHN0cmluZztcclxuICBcclxuICAvKiogRGlzcGxheSBuYW1lICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGRpc3BsYXlOYW1lPzogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBBdmF0YXIgVVJMICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGF2YXRhclVSTD86IHN0cmluZztcclxuICBcclxuICAvKiogV2hldGhlciB0aGlzIGlzIGEgYm90ICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGJvdDogYm9vbGVhbjtcclxuXHJcbiAgY29uc3RydWN0b3IoZGF0YTogQVBJVXNlciwgY2xpZW50PzogQ2xpZW50KSB7XHJcbiAgICB0aGlzLmNsaWVudCA9IGNsaWVudDtcclxuICAgIC8vIEhhbmRsZSBib3RoIHN0cmluZyBhbmQgbnVtYmVyIElEcyAoc25vd2ZsYWtlIHByZWNpc2lvbiBpc3N1ZSlcclxuICAgIHRoaXMuaWQgPSBTdHJpbmcoZGF0YS5pZCk7XHJcbiAgICB0aGlzLnVzZXJuYW1lID0gZGF0YS51c2VybmFtZSB8fCBgVXNlcl8ke3RoaXMuaWR9YDtcclxuICAgIHRoaXMuZGlzcGxheU5hbWUgPSBkYXRhLmRpc3BsYXlfbmFtZTtcclxuICAgIHRoaXMuYXZhdGFyVVJMID0gZGF0YS5hdmF0YXJfdXJsO1xyXG4gICAgdGhpcy5ib3QgPSBkYXRhLmJvdCA/PyBmYWxzZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCB0aGUgdXNlcidzIHRhZyAodXNlcm5hbWUpXHJcbiAgICovXHJcbiAgZ2V0IHRhZygpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIHRoaXMudXNlcm5hbWU7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgdGhlIGRlZmF1bHQgYXZhdGFyIFVSTFxyXG4gICAqL1xyXG4gIGdldCBkZWZhdWx0QXZhdGFyVVJMKCk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gYGh0dHBzOi8vY2RuLmp1YmJpby5jb20vZW1iZWQvYXZhdGFycy8ke3BhcnNlSW50KHRoaXMuaWQpICUgNX0ucG5nYDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCB0aGUgZGlzcGxheSBhdmF0YXIgVVJMXHJcbiAgICovXHJcbiAgZGlzcGxheUF2YXRhclVSTCgpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIHRoaXMuYXZhdGFyVVJMIHx8IHRoaXMuZGVmYXVsdEF2YXRhclVSTDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENvbnZlcnQgdG8gc3RyaW5nIChtZW50aW9uIGZvcm1hdClcclxuICAgKi9cclxuICB0b1N0cmluZygpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIGA8QCR7dGhpcy5pZH0+YDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFVwZGF0ZSB1c2VyIGRhdGFcclxuICAgKiBVc2VzIHR5cGUgYXNzZXJ0aW9uIHRvIGFsbG93IHVwZGF0ZXMgdG8gcmVhZG9ubHkgcHJvcGVydGllc1xyXG4gICAqL1xyXG4gIF9wYXRjaChkYXRhOiBQYXJ0aWFsPEFQSVVzZXI+KTogdm9pZCB7XHJcbiAgICBpZiAoZGF0YS51c2VybmFtZSAhPT0gdW5kZWZpbmVkKSAodGhpcyBhcyB7IHVzZXJuYW1lOiBzdHJpbmcgfSkudXNlcm5hbWUgPSBkYXRhLnVzZXJuYW1lO1xyXG4gICAgaWYgKGRhdGEuZGlzcGxheV9uYW1lICE9PSB1bmRlZmluZWQpICh0aGlzIGFzIHsgZGlzcGxheU5hbWU/OiBzdHJpbmcgfSkuZGlzcGxheU5hbWUgPSBkYXRhLmRpc3BsYXlfbmFtZTtcclxuICAgIGlmIChkYXRhLmF2YXRhcl91cmwgIT09IHVuZGVmaW5lZCkgKHRoaXMgYXMgeyBhdmF0YXJVUkw/OiBzdHJpbmcgfSkuYXZhdGFyVVJMID0gZGF0YS5hdmF0YXJfdXJsO1xyXG4gICAgaWYgKGRhdGEuYm90ICE9PSB1bmRlZmluZWQpICh0aGlzIGFzIHsgYm90OiBib29sZWFuIH0pLmJvdCA9IGRhdGEuYm90O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2VuZCBhIGRpcmVjdCBtZXNzYWdlIHRvIHRoaXMgdXNlclxyXG4gICAqIFJlcXVpcmVzIGNsaWVudCByZWZlcmVuY2UgdG8gYmUgc2V0XHJcbiAgICogXHJcbiAgICogQGV4YW1wbGVcclxuICAgKiBhd2FpdCB1c2VyLnNlbmQoeyBjb250ZW50OiAnSGVsbG8hJyB9KTtcclxuICAgKiBhd2FpdCB1c2VyLnNlbmQoeyBlbWJlZHM6IFtlbWJlZF0gfSk7XHJcbiAgICogYXdhaXQgdXNlci5zZW5kKHsgZmlsZXM6IFt7IG5hbWU6ICd0ZXN0LnR4dCcsIGRhdGE6IEJ1ZmZlci5mcm9tKCdoZWxsbycpIH1dIH0pO1xyXG4gICAqL1xyXG4gIGFzeW5jIHNlbmQob3B0aW9uczogc3RyaW5nIHwgRE1NZXNzYWdlT3B0aW9ucyk6IFByb21pc2U8YW55PiB7XHJcbiAgICBpZiAoIXRoaXMuY2xpZW50KSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IHNlbmQgRE06IFVzZXIgd2FzIGNyZWF0ZWQgd2l0aG91dCBjbGllbnQgcmVmZXJlbmNlJyk7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgY29udGVudCA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IG9wdGlvbnMgOiBvcHRpb25zLmNvbnRlbnQ7XHJcbiAgICBjb25zdCByYXdFbWJlZHMgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyB1bmRlZmluZWQgOiBvcHRpb25zLmVtYmVkcztcclxuICAgIGNvbnN0IHJhd0NvbXBvbmVudHMgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyB1bmRlZmluZWQgOiBvcHRpb25zLmNvbXBvbmVudHM7XHJcbiAgICBjb25zdCBmbGFncyA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IHVuZGVmaW5lZCA6IG9wdGlvbnMuZmxhZ3M7XHJcbiAgICBjb25zdCBmaWxlcyA9IHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJyA/IHVuZGVmaW5lZCA6IG9wdGlvbnMuZmlsZXM7XHJcbiAgICBcclxuICAgIC8vIENvbnZlcnQgRW1iZWRCdWlsZGVyIGluc3RhbmNlcyB0byBwbGFpbiBvYmplY3RzXHJcbiAgICBjb25zdCBlbWJlZHMgPSByYXdFbWJlZHM/Lm1hcChlID0+IFxyXG4gICAgICB0eXBlb2YgKGUgYXMgYW55KS50b0pTT04gPT09ICdmdW5jdGlvbicgPyAoZSBhcyBhbnkpLnRvSlNPTigpIDogZVxyXG4gICAgKTtcclxuXHJcbiAgICAvLyBDb252ZXJ0IGNvbXBvbmVudCBidWlsZGVyIGluc3RhbmNlcyB0byBwbGFpbiBvYmplY3RzXHJcbiAgICBjb25zdCBjb21wb25lbnRzID0gc2VyaWFsaXplQ29tcG9uZW50cyhyYXdDb21wb25lbnRzKTtcclxuXHJcbiAgICAvLyB1c2UgY3JlYXRlRE1NZXNzYWdlV2l0aEZpbGUgZm9yIGZpbGUgdXBsb2FkcywgY3JlYXRlRE1NZXNzYWdlIG90aGVyd2lzZVxyXG4gICAgaWYgKGZpbGVzICYmIGZpbGVzLmxlbmd0aCA+IDApIHtcclxuICAgICAgcmV0dXJuIHRoaXMuY2xpZW50LnJlc3QuY3JlYXRlRE1NZXNzYWdlV2l0aEZpbGUodGhpcy5pZCwgeyBjb250ZW50LCBlbWJlZHMsIGNvbXBvbmVudHMsIGZsYWdzIH0sIGZpbGVzKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gdGhpcy5jbGllbnQucmVzdC5jcmVhdGVETU1lc3NhZ2UodGhpcy5pZCwgeyBjb250ZW50LCBlbWJlZHMsIGNvbXBvbmVudHMsIGZsYWdzIH0pO1xyXG4gIH1cclxufVxyXG4iXX0=