"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
/**
 * Represents a user
 */
class User {
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
    constructor(data) {
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
}
exports.User = User;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVXNlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zdHJ1Y3R1cmVzL1VzZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBRUE7O0dBRUc7QUFDSCxNQUFhLElBQUk7SUFDZixjQUFjO0lBQ0UsRUFBRSxDQUFTO0lBRTNCLGVBQWU7SUFDUixRQUFRLENBQVM7SUFFeEIsbUJBQW1CO0lBQ1osV0FBVyxDQUFVO0lBRTVCLGlCQUFpQjtJQUNWLFNBQVMsQ0FBVTtJQUUxQiw0QkFBNEI7SUFDckIsR0FBRyxDQUFVO0lBRXBCLFlBQVksSUFBYTtRQUN2QixnRUFBZ0U7UUFDaEUsSUFBSSxDQUFDLEVBQUUsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQzFCLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLFFBQVEsSUFBSSxRQUFRLElBQUksQ0FBQyxFQUFFLEVBQUUsQ0FBQztRQUNuRCxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUM7UUFDckMsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDO1FBQ2pDLElBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsSUFBSSxLQUFLLENBQUM7SUFDL0IsQ0FBQztJQUVEOztPQUVHO0lBQ0gsSUFBSSxHQUFHO1FBQ0wsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDO0lBQ3ZCLENBQUM7SUFFRDs7T0FFRztJQUNILElBQUksZ0JBQWdCO1FBQ2xCLE9BQU8sd0NBQXdDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUM7SUFDN0UsQ0FBQztJQUVEOztPQUVHO0lBQ0gsZ0JBQWdCO1FBQ2QsT0FBTyxJQUFJLENBQUMsU0FBUyxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQztJQUNqRCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxRQUFRO1FBQ04sT0FBTyxLQUFLLElBQUksQ0FBQyxFQUFFLEdBQUcsQ0FBQztJQUN6QixDQUFDO0lBRUQ7O09BRUc7SUFDSCxNQUFNLENBQUMsSUFBc0I7UUFDM0IsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLFNBQVM7WUFBRSxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUM7UUFDL0QsSUFBSSxJQUFJLENBQUMsWUFBWSxLQUFLLFNBQVM7WUFBRSxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUM7UUFDMUUsSUFBSSxJQUFJLENBQUMsVUFBVSxLQUFLLFNBQVM7WUFBRSxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUM7UUFDcEUsSUFBSSxJQUFJLENBQUMsR0FBRyxLQUFLLFNBQVM7WUFBRSxJQUFJLENBQUMsR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUM7SUFDbEQsQ0FBQztDQUNGO0FBOURELG9CQThEQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFQSVVzZXIgfSBmcm9tICcuLi90eXBlcyc7XHJcblxyXG4vKipcclxuICogUmVwcmVzZW50cyBhIHVzZXJcclxuICovXHJcbmV4cG9ydCBjbGFzcyBVc2VyIHtcclxuICAvKiogVXNlciBJRCAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBpZDogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBVc2VybmFtZSAqL1xyXG4gIHB1YmxpYyB1c2VybmFtZTogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBEaXNwbGF5IG5hbWUgKi9cclxuICBwdWJsaWMgZGlzcGxheU5hbWU/OiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIEF2YXRhciBVUkwgKi9cclxuICBwdWJsaWMgYXZhdGFyVVJMPzogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBXaGV0aGVyIHRoaXMgaXMgYSBib3QgKi9cclxuICBwdWJsaWMgYm90OiBib29sZWFuO1xyXG5cclxuICBjb25zdHJ1Y3RvcihkYXRhOiBBUElVc2VyKSB7XHJcbiAgICAvLyBIYW5kbGUgYm90aCBzdHJpbmcgYW5kIG51bWJlciBJRHMgKHNub3dmbGFrZSBwcmVjaXNpb24gaXNzdWUpXHJcbiAgICB0aGlzLmlkID0gU3RyaW5nKGRhdGEuaWQpO1xyXG4gICAgdGhpcy51c2VybmFtZSA9IGRhdGEudXNlcm5hbWUgfHwgYFVzZXJfJHt0aGlzLmlkfWA7XHJcbiAgICB0aGlzLmRpc3BsYXlOYW1lID0gZGF0YS5kaXNwbGF5X25hbWU7XHJcbiAgICB0aGlzLmF2YXRhclVSTCA9IGRhdGEuYXZhdGFyX3VybDtcclxuICAgIHRoaXMuYm90ID0gZGF0YS5ib3QgPz8gZmFsc2U7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgdGhlIHVzZXIncyB0YWcgKHVzZXJuYW1lKVxyXG4gICAqL1xyXG4gIGdldCB0YWcoKTogc3RyaW5nIHtcclxuICAgIHJldHVybiB0aGlzLnVzZXJuYW1lO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IHRoZSBkZWZhdWx0IGF2YXRhciBVUkxcclxuICAgKi9cclxuICBnZXQgZGVmYXVsdEF2YXRhclVSTCgpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIGBodHRwczovL2Nkbi5qdWJiaW8uY29tL2VtYmVkL2F2YXRhcnMvJHtwYXJzZUludCh0aGlzLmlkKSAlIDV9LnBuZ2A7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgdGhlIGRpc3BsYXkgYXZhdGFyIFVSTFxyXG4gICAqL1xyXG4gIGRpc3BsYXlBdmF0YXJVUkwoKTogc3RyaW5nIHtcclxuICAgIHJldHVybiB0aGlzLmF2YXRhclVSTCB8fCB0aGlzLmRlZmF1bHRBdmF0YXJVUkw7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDb252ZXJ0IHRvIHN0cmluZyAobWVudGlvbiBmb3JtYXQpXHJcbiAgICovXHJcbiAgdG9TdHJpbmcoKTogc3RyaW5nIHtcclxuICAgIHJldHVybiBgPEAke3RoaXMuaWR9PmA7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBVcGRhdGUgdXNlciBkYXRhXHJcbiAgICovXHJcbiAgX3BhdGNoKGRhdGE6IFBhcnRpYWw8QVBJVXNlcj4pOiB2b2lkIHtcclxuICAgIGlmIChkYXRhLnVzZXJuYW1lICE9PSB1bmRlZmluZWQpIHRoaXMudXNlcm5hbWUgPSBkYXRhLnVzZXJuYW1lO1xyXG4gICAgaWYgKGRhdGEuZGlzcGxheV9uYW1lICE9PSB1bmRlZmluZWQpIHRoaXMuZGlzcGxheU5hbWUgPSBkYXRhLmRpc3BsYXlfbmFtZTtcclxuICAgIGlmIChkYXRhLmF2YXRhcl91cmwgIT09IHVuZGVmaW5lZCkgdGhpcy5hdmF0YXJVUkwgPSBkYXRhLmF2YXRhcl91cmw7XHJcbiAgICBpZiAoZGF0YS5ib3QgIT09IHVuZGVmaW5lZCkgdGhpcy5ib3QgPSBkYXRhLmJvdDtcclxuICB9XHJcbn1cclxuIl19