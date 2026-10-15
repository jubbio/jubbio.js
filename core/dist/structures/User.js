"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
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
        const files = typeof options === 'string' ? undefined : options.files;
        // Convert EmbedBuilder instances to plain objects
        const embeds = rawEmbeds?.map(e => typeof e.toJSON === 'function' ? e.toJSON() : e);
        // Convert component builder instances to plain objects
        const components = rawComponents?.map(c => typeof c.toJSON === 'function' ? c.toJSON() : c);
        // ponytail: use createDMMessageWithFile for file uploads, createDMMessage otherwise
        if (files && files.length > 0) {
            return this.client.rest.createDMMessageWithFile(this.id, { content, embeds, components }, files);
        }
        return this.client.rest.createDMMessage(this.id, { content, embeds, components });
    }
}
exports.User = User;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVXNlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zdHJ1Y3R1cmVzL1VzZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBY0E7O0dBRUc7QUFDSCxNQUFhLElBQUk7SUFDZixvRUFBb0U7SUFDcEQsTUFBTSxDQUFVO0lBRWhDLGNBQWM7SUFDRSxFQUFFLENBQVM7SUFFM0IsZUFBZTtJQUNDLFFBQVEsQ0FBUztJQUVqQyxtQkFBbUI7SUFDSCxXQUFXLENBQVU7SUFFckMsaUJBQWlCO0lBQ0QsU0FBUyxDQUFVO0lBRW5DLDRCQUE0QjtJQUNaLEdBQUcsQ0FBVTtJQUU3QixZQUFZLElBQWEsRUFBRSxNQUFlO1FBQ3hDLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1FBQ3JCLGdFQUFnRTtRQUNoRSxJQUFJLENBQUMsRUFBRSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDMUIsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxJQUFJLFFBQVEsSUFBSSxDQUFDLEVBQUUsRUFBRSxDQUFDO1FBQ25ELElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQztRQUNyQyxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUM7UUFDakMsSUFBSSxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxJQUFJLEtBQUssQ0FBQztJQUMvQixDQUFDO0lBRUQ7O09BRUc7SUFDSCxJQUFJLEdBQUc7UUFDTCxPQUFPLElBQUksQ0FBQyxRQUFRLENBQUM7SUFDdkIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsSUFBSSxnQkFBZ0I7UUFDbEIsT0FBTyx3Q0FBd0MsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQztJQUM3RSxDQUFDO0lBRUQ7O09BRUc7SUFDSCxnQkFBZ0I7UUFDZCxPQUFPLElBQUksQ0FBQyxTQUFTLElBQUksSUFBSSxDQUFDLGdCQUFnQixDQUFDO0lBQ2pELENBQUM7SUFFRDs7T0FFRztJQUNILFFBQVE7UUFDTixPQUFPLEtBQUssSUFBSSxDQUFDLEVBQUUsR0FBRyxDQUFDO0lBQ3pCLENBQUM7SUFFRDs7O09BR0c7SUFDSCxNQUFNLENBQUMsSUFBc0I7UUFDM0IsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLFNBQVM7WUFBRyxJQUE2QixDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDO1FBQ3pGLElBQUksSUFBSSxDQUFDLFlBQVksS0FBSyxTQUFTO1lBQUcsSUFBaUMsQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQztRQUN4RyxJQUFJLElBQUksQ0FBQyxVQUFVLEtBQUssU0FBUztZQUFHLElBQStCLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUM7UUFDaEcsSUFBSSxJQUFJLENBQUMsR0FBRyxLQUFLLFNBQVM7WUFBRyxJQUF5QixDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDO0lBQ3hFLENBQUM7SUFFRDs7Ozs7Ozs7T0FRRztJQUNILEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBa0M7UUFDM0MsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNqQixNQUFNLElBQUksS0FBSyxDQUFDLDJEQUEyRCxDQUFDLENBQUM7UUFDL0UsQ0FBQztRQUVELE1BQU0sT0FBTyxHQUFHLE9BQU8sT0FBTyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDO1FBQ3hFLE1BQU0sU0FBUyxHQUFHLE9BQU8sT0FBTyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDO1FBQzNFLE1BQU0sYUFBYSxHQUFHLE9BQU8sT0FBTyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDO1FBQ25GLE1BQU0sS0FBSyxHQUFHLE9BQU8sT0FBTyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDO1FBRXRFLGtEQUFrRDtRQUNsRCxNQUFNLE1BQU0sR0FBRyxTQUFTLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQ2hDLE9BQVEsQ0FBUyxDQUFDLE1BQU0sS0FBSyxVQUFVLENBQUMsQ0FBQyxDQUFFLENBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUNsRSxDQUFDO1FBRUYsdURBQXVEO1FBQ3ZELE1BQU0sVUFBVSxHQUFHLGFBQWEsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FDeEMsT0FBUSxDQUFTLENBQUMsTUFBTSxLQUFLLFVBQVUsQ0FBQyxDQUFDLENBQUUsQ0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQ2xFLENBQUM7UUFFRixvRkFBb0Y7UUFDcEYsSUFBSSxLQUFLLElBQUksS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUM5QixPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLHVCQUF1QixDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ25HLENBQUM7UUFFRCxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsQ0FBQyxDQUFDO0lBQ3BGLENBQUM7Q0FDRjtBQXhHRCxvQkF3R0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBUElVc2VyLCBBUElFbWJlZCB9IGZyb20gJy4uL3R5cGVzJztcclxuaW1wb3J0IHR5cGUgeyBDbGllbnQgfSBmcm9tICcuLi9DbGllbnQnO1xyXG5pbXBvcnQgdHlwZSB7IEVtYmVkQnVpbGRlciB9IGZyb20gJy4uL2J1aWxkZXJzL0VtYmVkQnVpbGRlcic7XHJcblxyXG4vKipcclxuICogT3B0aW9ucyBmb3Igc2VuZGluZyBhIERNIG1lc3NhZ2VcclxuICovXHJcbmV4cG9ydCBpbnRlcmZhY2UgRE1NZXNzYWdlT3B0aW9ucyB7XHJcbiAgY29udGVudD86IHN0cmluZztcclxuICBlbWJlZHM/OiAoQVBJRW1iZWQgfCBFbWJlZEJ1aWxkZXIpW107XHJcbiAgY29tcG9uZW50cz86IGFueVtdO1xyXG4gIGZpbGVzPzogQXJyYXk8eyBuYW1lOiBzdHJpbmc7IGRhdGE6IEJ1ZmZlciB8IHN0cmluZyB9PjtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJlcHJlc2VudHMgYSB1c2VyXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgVXNlciB7XHJcbiAgLyoqIFJlZmVyZW5jZSB0byB0aGUgY2xpZW50IChvcHRpb25hbCBmb3IgYmFja3dhcmQgY29tcGF0aWJpbGl0eSkgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgY2xpZW50PzogQ2xpZW50O1xyXG4gIFxyXG4gIC8qKiBVc2VyIElEICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGlkOiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIFVzZXJuYW1lICovXHJcbiAgcHVibGljIHJlYWRvbmx5IHVzZXJuYW1lOiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIERpc3BsYXkgbmFtZSAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBkaXNwbGF5TmFtZT86IHN0cmluZztcclxuICBcclxuICAvKiogQXZhdGFyIFVSTCAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBhdmF0YXJVUkw/OiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIFdoZXRoZXIgdGhpcyBpcyBhIGJvdCAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBib3Q6IGJvb2xlYW47XHJcblxyXG4gIGNvbnN0cnVjdG9yKGRhdGE6IEFQSVVzZXIsIGNsaWVudD86IENsaWVudCkge1xyXG4gICAgdGhpcy5jbGllbnQgPSBjbGllbnQ7XHJcbiAgICAvLyBIYW5kbGUgYm90aCBzdHJpbmcgYW5kIG51bWJlciBJRHMgKHNub3dmbGFrZSBwcmVjaXNpb24gaXNzdWUpXHJcbiAgICB0aGlzLmlkID0gU3RyaW5nKGRhdGEuaWQpO1xyXG4gICAgdGhpcy51c2VybmFtZSA9IGRhdGEudXNlcm5hbWUgfHwgYFVzZXJfJHt0aGlzLmlkfWA7XHJcbiAgICB0aGlzLmRpc3BsYXlOYW1lID0gZGF0YS5kaXNwbGF5X25hbWU7XHJcbiAgICB0aGlzLmF2YXRhclVSTCA9IGRhdGEuYXZhdGFyX3VybDtcclxuICAgIHRoaXMuYm90ID0gZGF0YS5ib3QgPz8gZmFsc2U7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgdGhlIHVzZXIncyB0YWcgKHVzZXJuYW1lKVxyXG4gICAqL1xyXG4gIGdldCB0YWcoKTogc3RyaW5nIHtcclxuICAgIHJldHVybiB0aGlzLnVzZXJuYW1lO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IHRoZSBkZWZhdWx0IGF2YXRhciBVUkxcclxuICAgKi9cclxuICBnZXQgZGVmYXVsdEF2YXRhclVSTCgpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIGBodHRwczovL2Nkbi5qdWJiaW8uY29tL2VtYmVkL2F2YXRhcnMvJHtwYXJzZUludCh0aGlzLmlkKSAlIDV9LnBuZ2A7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgdGhlIGRpc3BsYXkgYXZhdGFyIFVSTFxyXG4gICAqL1xyXG4gIGRpc3BsYXlBdmF0YXJVUkwoKTogc3RyaW5nIHtcclxuICAgIHJldHVybiB0aGlzLmF2YXRhclVSTCB8fCB0aGlzLmRlZmF1bHRBdmF0YXJVUkw7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDb252ZXJ0IHRvIHN0cmluZyAobWVudGlvbiBmb3JtYXQpXHJcbiAgICovXHJcbiAgdG9TdHJpbmcoKTogc3RyaW5nIHtcclxuICAgIHJldHVybiBgPEAke3RoaXMuaWR9PmA7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBVcGRhdGUgdXNlciBkYXRhXHJcbiAgICogVXNlcyB0eXBlIGFzc2VydGlvbiB0byBhbGxvdyB1cGRhdGVzIHRvIHJlYWRvbmx5IHByb3BlcnRpZXNcclxuICAgKi9cclxuICBfcGF0Y2goZGF0YTogUGFydGlhbDxBUElVc2VyPik6IHZvaWQge1xyXG4gICAgaWYgKGRhdGEudXNlcm5hbWUgIT09IHVuZGVmaW5lZCkgKHRoaXMgYXMgeyB1c2VybmFtZTogc3RyaW5nIH0pLnVzZXJuYW1lID0gZGF0YS51c2VybmFtZTtcclxuICAgIGlmIChkYXRhLmRpc3BsYXlfbmFtZSAhPT0gdW5kZWZpbmVkKSAodGhpcyBhcyB7IGRpc3BsYXlOYW1lPzogc3RyaW5nIH0pLmRpc3BsYXlOYW1lID0gZGF0YS5kaXNwbGF5X25hbWU7XHJcbiAgICBpZiAoZGF0YS5hdmF0YXJfdXJsICE9PSB1bmRlZmluZWQpICh0aGlzIGFzIHsgYXZhdGFyVVJMPzogc3RyaW5nIH0pLmF2YXRhclVSTCA9IGRhdGEuYXZhdGFyX3VybDtcclxuICAgIGlmIChkYXRhLmJvdCAhPT0gdW5kZWZpbmVkKSAodGhpcyBhcyB7IGJvdDogYm9vbGVhbiB9KS5ib3QgPSBkYXRhLmJvdDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNlbmQgYSBkaXJlY3QgbWVzc2FnZSB0byB0aGlzIHVzZXJcclxuICAgKiBSZXF1aXJlcyBjbGllbnQgcmVmZXJlbmNlIHRvIGJlIHNldFxyXG4gICAqIFxyXG4gICAqIEBleGFtcGxlXHJcbiAgICogYXdhaXQgdXNlci5zZW5kKHsgY29udGVudDogJ0hlbGxvIScgfSk7XHJcbiAgICogYXdhaXQgdXNlci5zZW5kKHsgZW1iZWRzOiBbZW1iZWRdIH0pO1xyXG4gICAqIGF3YWl0IHVzZXIuc2VuZCh7IGZpbGVzOiBbeyBuYW1lOiAndGVzdC50eHQnLCBkYXRhOiBCdWZmZXIuZnJvbSgnaGVsbG8nKSB9XSB9KTtcclxuICAgKi9cclxuICBhc3luYyBzZW5kKG9wdGlvbnM6IHN0cmluZyB8IERNTWVzc2FnZU9wdGlvbnMpOiBQcm9taXNlPGFueT4ge1xyXG4gICAgaWYgKCF0aGlzLmNsaWVudCkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBzZW5kIERNOiBVc2VyIHdhcyBjcmVhdGVkIHdpdGhvdXQgY2xpZW50IHJlZmVyZW5jZScpO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGNvbnRlbnQgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyBvcHRpb25zIDogb3B0aW9ucy5jb250ZW50O1xyXG4gICAgY29uc3QgcmF3RW1iZWRzID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gdW5kZWZpbmVkIDogb3B0aW9ucy5lbWJlZHM7XHJcbiAgICBjb25zdCByYXdDb21wb25lbnRzID0gdHlwZW9mIG9wdGlvbnMgPT09ICdzdHJpbmcnID8gdW5kZWZpbmVkIDogb3B0aW9ucy5jb21wb25lbnRzO1xyXG4gICAgY29uc3QgZmlsZXMgPSB0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycgPyB1bmRlZmluZWQgOiBvcHRpb25zLmZpbGVzO1xyXG4gICAgXHJcbiAgICAvLyBDb252ZXJ0IEVtYmVkQnVpbGRlciBpbnN0YW5jZXMgdG8gcGxhaW4gb2JqZWN0c1xyXG4gICAgY29uc3QgZW1iZWRzID0gcmF3RW1iZWRzPy5tYXAoZSA9PiBcclxuICAgICAgdHlwZW9mIChlIGFzIGFueSkudG9KU09OID09PSAnZnVuY3Rpb24nID8gKGUgYXMgYW55KS50b0pTT04oKSA6IGVcclxuICAgICk7XHJcblxyXG4gICAgLy8gQ29udmVydCBjb21wb25lbnQgYnVpbGRlciBpbnN0YW5jZXMgdG8gcGxhaW4gb2JqZWN0c1xyXG4gICAgY29uc3QgY29tcG9uZW50cyA9IHJhd0NvbXBvbmVudHM/Lm1hcChjID0+XHJcbiAgICAgIHR5cGVvZiAoYyBhcyBhbnkpLnRvSlNPTiA9PT0gJ2Z1bmN0aW9uJyA/IChjIGFzIGFueSkudG9KU09OKCkgOiBjXHJcbiAgICApO1xyXG5cclxuICAgIC8vIHBvbnl0YWlsOiB1c2UgY3JlYXRlRE1NZXNzYWdlV2l0aEZpbGUgZm9yIGZpbGUgdXBsb2FkcywgY3JlYXRlRE1NZXNzYWdlIG90aGVyd2lzZVxyXG4gICAgaWYgKGZpbGVzICYmIGZpbGVzLmxlbmd0aCA+IDApIHtcclxuICAgICAgcmV0dXJuIHRoaXMuY2xpZW50LnJlc3QuY3JlYXRlRE1NZXNzYWdlV2l0aEZpbGUodGhpcy5pZCwgeyBjb250ZW50LCBlbWJlZHMsIGNvbXBvbmVudHMgfSwgZmlsZXMpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB0aGlzLmNsaWVudC5yZXN0LmNyZWF0ZURNTWVzc2FnZSh0aGlzLmlkLCB7IGNvbnRlbnQsIGVtYmVkcywgY29tcG9uZW50cyB9KTtcclxuICB9XHJcbn1cclxuIl19