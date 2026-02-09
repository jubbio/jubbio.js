"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionsBitField = void 0;
const enums_1 = require("../enums");
/**
 * Bit field for permissions
 * API compatible with Discord.js PermissionsBitField
 */
class PermissionsBitField {
    /** The raw bits */
    bitfield;
    /** All permission flags */
    static Flags = enums_1.PermissionFlagsBits;
    /** All permissions combined */
    static All = Object.values(enums_1.PermissionFlagsBits).reduce((acc, val) => acc | val, 0n);
    /** Default permissions */
    static Default = BigInt(0);
    constructor(bits = 0n) {
        this.bitfield = PermissionsBitField.resolve(bits);
    }
    /**
     * Check if this bitfield has a permission
     */
    has(permission, checkAdmin = true) {
        // Admin has all permissions
        if (checkAdmin && this.bitfield & enums_1.PermissionFlagsBits.Administrator) {
            return true;
        }
        const bit = PermissionsBitField.resolve(permission);
        return (this.bitfield & bit) === bit;
    }
    /**
     * Check if this bitfield has any of the permissions
     */
    any(permissions, checkAdmin = true) {
        // Admin has all permissions
        if (checkAdmin && this.bitfield & enums_1.PermissionFlagsBits.Administrator) {
            return true;
        }
        const bit = PermissionsBitField.resolve(permissions);
        return (this.bitfield & bit) !== 0n;
    }
    /**
     * Check if this bitfield is missing any permissions
     */
    missing(permissions, checkAdmin = true) {
        const missing = [];
        for (const [name, bit] of Object.entries(enums_1.PermissionFlagsBits)) {
            const resolved = PermissionsBitField.resolve(permissions);
            if ((resolved & bit) && !this.has(bit, checkAdmin)) {
                missing.push(name);
            }
        }
        return missing;
    }
    /**
     * Add permissions to this bitfield
     */
    add(...permissions) {
        for (const permission of permissions) {
            this.bitfield |= PermissionsBitField.resolve(permission);
        }
        return this;
    }
    /**
     * Remove permissions from this bitfield
     */
    remove(...permissions) {
        for (const permission of permissions) {
            this.bitfield &= ~PermissionsBitField.resolve(permission);
        }
        return this;
    }
    /**
     * Serialize this bitfield to an array of permission names
     */
    toArray() {
        const result = [];
        for (const [name, bit] of Object.entries(enums_1.PermissionFlagsBits)) {
            if (this.bitfield & bit) {
                result.push(name);
            }
        }
        return result;
    }
    /**
     * Serialize this bitfield to a JSON-compatible value
     */
    toJSON() {
        return this.bitfield.toString();
    }
    /**
     * Get the string representation
     */
    toString() {
        return this.bitfield.toString();
    }
    /**
     * Freeze this bitfield
     */
    freeze() {
        return Object.freeze(this);
    }
    /**
     * Check equality with another bitfield
     */
    equals(other) {
        return this.bitfield === PermissionsBitField.resolve(other);
    }
    /**
     * Create a new bitfield with the same bits
     */
    clone() {
        return new PermissionsBitField(this.bitfield);
    }
    /**
     * Resolve a permission to a bigint
     */
    static resolve(permission) {
        if (typeof permission === 'bigint') {
            return permission;
        }
        if (permission instanceof PermissionsBitField) {
            return permission.bitfield;
        }
        if (typeof permission === 'string') {
            const bit = enums_1.PermissionFlagsBits[permission];
            if (bit === undefined) {
                throw new Error(`Unknown permission: ${permission}`);
            }
            return bit;
        }
        if (Array.isArray(permission)) {
            let result = 0n;
            for (const p of permission) {
                result |= PermissionsBitField.resolve(p);
            }
            return result;
        }
        throw new Error(`Invalid permission: ${permission}`);
    }
}
exports.PermissionsBitField = PermissionsBitField;
exports.default = PermissionsBitField;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUGVybWlzc2lvbnNCaXRGaWVsZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91dGlscy9QZXJtaXNzaW9uc0JpdEZpZWxkLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG9DQUErQztBQWlCL0M7OztHQUdHO0FBQ0gsTUFBYSxtQkFBbUI7SUFDOUIsbUJBQW1CO0lBQ1osUUFBUSxDQUFTO0lBRXhCLDJCQUEyQjtJQUMzQixNQUFNLENBQUMsS0FBSyxHQUFHLDJCQUFtQixDQUFDO0lBRW5DLCtCQUErQjtJQUMvQixNQUFNLENBQUMsR0FBRyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsMkJBQW1CLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxHQUFHLEdBQUcsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBRXBGLDBCQUEwQjtJQUMxQixNQUFNLENBQUMsT0FBTyxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUUzQixZQUFZLE9BQTZCLEVBQUU7UUFDekMsSUFBSSxDQUFDLFFBQVEsR0FBRyxtQkFBbUIsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDcEQsQ0FBQztJQUVEOztPQUVHO0lBQ0gsR0FBRyxDQUFDLFVBQWdDLEVBQUUsVUFBVSxHQUFHLElBQUk7UUFDckQsNEJBQTRCO1FBQzVCLElBQUksVUFBVSxJQUFJLElBQUksQ0FBQyxRQUFRLEdBQUcsMkJBQW1CLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDcEUsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDO1FBRUQsTUFBTSxHQUFHLEdBQUcsbUJBQW1CLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3BELE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxHQUFHLEdBQUcsQ0FBQyxLQUFLLEdBQUcsQ0FBQztJQUN2QyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxHQUFHLENBQUMsV0FB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Z0M7UUFDN0MsSUFBSSxPQUFPLFVBQVUsS0FBSyxRQUFRLEVBQUUsQ0FBQztZQUNuQyxPQUFPLFVBQVUsQ0FBQztRQUNwQixDQUFDO1FBRUQsSUFBSSxVQUFVLFlBQVksbUJBQW1CLEVBQUUsQ0FBQztZQUM5QyxPQUFPLFVBQVUsQ0FBQyxRQUFRLENBQUM7UUFDN0IsQ0FBQztRQUVELElBQUksT0FBTyxVQUFVLEtBQUssUUFBUSxFQUFFLENBQUM7WUFDbkMsTUFBTSxHQUFHLEdBQUcsMkJBQW1CLENBQUMsVUFBOEIsQ0FBQyxDQUFDO1lBQ2hFLElBQUksR0FBRyxLQUFLLFNBQVMsRUFBRSxDQUFDO2dCQUN0QixNQUFNLElBQUksS0FBSyxDQUFDLHVCQUF1QixVQUFVLEVBQUUsQ0FBQyxDQUFDO1lBQ3ZELENBQUM7WUFDRCxPQUFPLEdBQUcsQ0FBQztRQUNiLENBQUM7UUFFRCxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQztZQUM5QixJQUFJLE1BQU0sR0FBRyxFQUFFLENBQUM7WUFDaEIsS0FBSyxNQUFNLENBQUMsSUFBSSxVQUFVLEVBQUUsQ0FBQztnQkFDM0IsTUFBTSxJQUFJLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMzQyxDQUFDO1lBQ0QsT0FBTyxNQUFNLENBQUM7UUFDaEIsQ0FBQztRQUVELE1BQU0sSUFBSSxLQUFLLENBQUMsdUJBQXVCLFVBQVUsRUFBRSxDQUFDLENBQUM7SUFDdkQsQ0FBQzs7QUE5Skgsa0RBK0pDO0FBRUQsa0JBQWUsbUJBQW1CLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBQZXJtaXNzaW9uRmxhZ3NCaXRzIH0gZnJvbSAnLi4vZW51bXMnO1xyXG5cclxuLyoqXHJcbiAqIFBlcm1pc3Npb24gbmFtZXMgdHlwZVxyXG4gKi9cclxuZXhwb3J0IHR5cGUgUGVybWlzc2lvblN0cmluZyA9IGtleW9mIHR5cGVvZiBQZXJtaXNzaW9uRmxhZ3NCaXRzO1xyXG5cclxuLyoqXHJcbiAqIFJlc29sdmFibGUgcGVybWlzc2lvbiB0eXBlXHJcbiAqL1xyXG5leHBvcnQgdHlwZSBQZXJtaXNzaW9uUmVzb2x2YWJsZSA9IFxyXG4gIHwgYmlnaW50IFxyXG4gIHwgYmlnaW50W10gXHJcbiAgfCBQZXJtaXNzaW9uU3RyaW5nIFxyXG4gIHwgUGVybWlzc2lvblN0cmluZ1tdIFxyXG4gIHwgUGVybWlzc2lvbnNCaXRGaWVsZDtcclxuXHJcbi8qKlxyXG4gKiBCaXQgZmllbGQgZm9yIHBlcm1pc3Npb25zXHJcbiAqIEFQSSBjb21wYXRpYmxlIHdpdGggRGlzY29yZC5qcyBQZXJtaXNzaW9uc0JpdEZpZWxkXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgUGVybWlzc2lvbnNCaXRGaWVsZCB7XHJcbiAgLyoqIFRoZSByYXcgYml0cyAqL1xyXG4gIHB1YmxpYyBiaXRmaWVsZDogYmlnaW50O1xyXG5cclxuICAvKiogQWxsIHBlcm1pc3Npb24gZmxhZ3MgKi9cclxuICBzdGF0aWMgRmxhZ3MgPSBQZXJtaXNzaW9uRmxhZ3NCaXRzO1xyXG5cclxuICAvKiogQWxsIHBlcm1pc3Npb25zIGNvbWJpbmVkICovXHJcbiAgc3RhdGljIEFsbCA9IE9iamVjdC52YWx1ZXMoUGVybWlzc2lvbkZsYWdzQml0cykucmVkdWNlKChhY2MsIHZhbCkgPT4gYWNjIHwgdmFsLCAwbik7XHJcblxyXG4gIC8qKiBEZWZhdWx0IHBlcm1pc3Npb25zICovXHJcbiAgc3RhdGljIERlZmF1bHQgPSBCaWdJbnQoMCk7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGJpdHM6IFBlcm1pc3Npb25SZXNvbHZhYmxlID0gMG4pIHtcclxuICAgIHRoaXMuYml0ZmllbGQgPSBQZXJtaXNzaW9uc0JpdEZpZWxkLnJlc29sdmUoYml0cyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDaGVjayBpZiB0aGlzIGJpdGZpZWxkIGhhcyBhIHBlcm1pc3Npb25cclxuICAgKi9cclxuICBoYXMocGVybWlzc2lvbjogUGVybWlzc2lvblJlc29sdmFibGUsIGNoZWNrQWRtaW4gPSB0cnVlKTogYm9vbGVhbiB7XHJcbiAgICAvLyBBZG1pbiBoYXMgYWxsIHBlcm1pc3Npb25zXHJcbiAgICBpZiAoY2hlY2tBZG1pbiAmJiB0aGlzLmJpdGZpZWxkICYgUGVybWlzc2lvbkZsYWdzQml0cy5BZG1pbmlzdHJhdG9yKSB7XHJcbiAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGJpdCA9IFBlcm1pc3Npb25zQml0RmllbGQucmVzb2x2ZShwZXJtaXNzaW9uKTtcclxuICAgIHJldHVybiAodGhpcy5iaXRmaWVsZCAmIGJpdCkgPT09IGJpdDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENoZWNrIGlmIHRoaXMgYml0ZmllbGQgaGFzIGFueSBvZiB0aGUgcGVybWlzc2lvbnNcclxuICAgKi9cclxuICBhbnkocGVybWlzc2lvbnM6IFBlcm1pc3Npb25SZXNvbHZhYmxlLCBjaGVja0FkbWluID0gdHJ1ZSk6IGJvb2xlYW4ge1xyXG4gICAgLy8gQWRtaW4gaGFzIGFsbCBwZXJtaXNzaW9uc1xyXG4gICAgaWYgKGNoZWNrQWRtaW4gJiYgdGhpcy5iaXRmaWVsZCAmIFBlcm1pc3Npb25GbGFnc0JpdHMuQWRtaW5pc3RyYXRvcikge1xyXG4gICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBiaXQgPSBQZXJtaXNzaW9uc0JpdEZpZWxkLnJlc29sdmUocGVybWlzc2lvbnMpO1xyXG4gICAgcmV0dXJuICh0aGlzLmJpdGZpZWxkICYgYml0KSAhPT0gMG47XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDaGVjayBpZiB0aGlzIGJpdGZpZWxkIGlzIG1pc3NpbmcgYW55IHBlcm1pc3Npb25zXHJcbiAgICovXHJcbiAgbWlzc2luZyhwZXJtaXNzaW9uczogUGVybWlzc2lvblJlc29sdmFibGUsIGNoZWNrQWRtaW4gPSB0cnVlKTogUGVybWlzc2lvblN0cmluZ1tdIHtcclxuICAgIGNvbnN0IG1pc3Npbmc6IFBlcm1pc3Npb25TdHJpbmdbXSA9IFtdO1xyXG4gICAgXHJcbiAgICBmb3IgKGNvbnN0IFtuYW1lLCBiaXRdIG9mIE9iamVjdC5lbnRyaWVzKFBlcm1pc3Npb25GbGFnc0JpdHMpKSB7XHJcbiAgICAgIGNvbnN0IHJlc29sdmVkID0gUGVybWlzc2lvbnNCaXRGaWVsZC5yZXNvbHZlKHBlcm1pc3Npb25zKTtcclxuICAgICAgaWYgKChyZXNvbHZlZCAmIGJpdCkgJiYgIXRoaXMuaGFzKGJpdCwgY2hlY2tBZG1pbikpIHtcclxuICAgICAgICBtaXNzaW5nLnB1c2gobmFtZSBhcyBQZXJtaXNzaW9uU3RyaW5nKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICByZXR1cm4gbWlzc2luZztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEFkZCBwZXJtaXNzaW9ucyB0byB0aGlzIGJpdGZpZWxkXHJcbiAgICovXHJcbiAgYWRkKC4uLnBlcm1pc3Npb25zOiBQZXJtaXNzaW9uUmVzb2x2YWJsZVtdKTogdGhpcyB7XHJcbiAgICBmb3IgKGNvbnN0IHBlcm1pc3Npb24gb2YgcGVybWlzc2lvbnMpIHtcclxuICAgICAgdGhpcy5iaXRmaWVsZCB8PSBQZXJtaXNzaW9uc0JpdEZpZWxkLnJlc29sdmUocGVybWlzc2lvbik7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlbW92ZSBwZXJtaXNzaW9ucyBmcm9tIHRoaXMgYml0ZmllbGRcclxuICAgKi9cclxuICByZW1vdmUoLi4ucGVybWlzc2lvbnM6IFBlcm1pc3Npb25SZXNvbHZhYmxlW10pOiB0aGlzIHtcclxuICAgIGZvciAoY29uc3QgcGVybWlzc2lvbiBvZiBwZXJtaXNzaW9ucykge1xyXG4gICAgICB0aGlzLmJpdGZpZWxkICY9IH5QZXJtaXNzaW9uc0JpdEZpZWxkLnJlc29sdmUocGVybWlzc2lvbik7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNlcmlhbGl6ZSB0aGlzIGJpdGZpZWxkIHRvIGFuIGFycmF5IG9mIHBlcm1pc3Npb24gbmFtZXNcclxuICAgKi9cclxuICB0b0FycmF5KCk6IFBlcm1pc3Npb25TdHJpbmdbXSB7XHJcbiAgICBjb25zdCByZXN1bHQ6IFBlcm1pc3Npb25TdHJpbmdbXSA9IFtdO1xyXG4gICAgXHJcbiAgICBmb3IgKGNvbnN0IFtuYW1lLCBiaXRdIG9mIE9iamVjdC5lbnRyaWVzKFBlcm1pc3Npb25GbGFnc0JpdHMpKSB7XHJcbiAgICAgIGlmICh0aGlzLmJpdGZpZWxkICYgYml0KSB7XHJcbiAgICAgICAgcmVzdWx0LnB1c2gobmFtZSBhcyBQZXJtaXNzaW9uU3RyaW5nKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2VyaWFsaXplIHRoaXMgYml0ZmllbGQgdG8gYSBKU09OLWNvbXBhdGlibGUgdmFsdWVcclxuICAgKi9cclxuICB0b0pTT04oKTogc3RyaW5nIHtcclxuICAgIHJldHVybiB0aGlzLmJpdGZpZWxkLnRvU3RyaW5nKCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgdGhlIHN0cmluZyByZXByZXNlbnRhdGlvblxyXG4gICAqL1xyXG4gIHRvU3RyaW5nKCk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gdGhpcy5iaXRmaWVsZC50b1N0cmluZygpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRnJlZXplIHRoaXMgYml0ZmllbGRcclxuICAgKi9cclxuICBmcmVlemUoKTogUmVhZG9ubHk8dGhpcz4ge1xyXG4gICAgcmV0dXJuIE9iamVjdC5mcmVlemUodGhpcyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDaGVjayBlcXVhbGl0eSB3aXRoIGFub3RoZXIgYml0ZmllbGRcclxuICAgKi9cclxuICBlcXVhbHMob3RoZXI6IFBlcm1pc3Npb25SZXNvbHZhYmxlKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gdGhpcy5iaXRmaWVsZCA9PT0gUGVybWlzc2lvbnNCaXRGaWVsZC5yZXNvbHZlKG90aGVyKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIG5ldyBiaXRmaWVsZCB3aXRoIHRoZSBzYW1lIGJpdHNcclxuICAgKi9cclxuICBjbG9uZSgpOiBQZXJtaXNzaW9uc0JpdEZpZWxkIHtcclxuICAgIHJldHVybiBuZXcgUGVybWlzc2lvbnNCaXRGaWVsZCh0aGlzLmJpdGZpZWxkKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlc29sdmUgYSBwZXJtaXNzaW9uIHRvIGEgYmlnaW50XHJcbiAgICovXHJcbiAgc3RhdGljIHJlc29sdmUocGVybWlzc2lvbjogUGVybWlzc2lvblJlc29sdmFibGUpOiBiaWdpbnQge1xyXG4gICAgaWYgKHR5cGVvZiBwZXJtaXNzaW9uID09PSAnYmlnaW50Jykge1xyXG4gICAgICByZXR1cm4gcGVybWlzc2lvbjtcclxuICAgIH1cclxuXHJcbiAgICBpZiAocGVybWlzc2lvbiBpbnN0YW5jZW9mIFBlcm1pc3Npb25zQml0RmllbGQpIHtcclxuICAgICAgcmV0dXJuIHBlcm1pc3Npb24uYml0ZmllbGQ7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHR5cGVvZiBwZXJtaXNzaW9uID09PSAnc3RyaW5nJykge1xyXG4gICAgICBjb25zdCBiaXQgPSBQZXJtaXNzaW9uRmxhZ3NCaXRzW3Blcm1pc3Npb24gYXMgUGVybWlzc2lvblN0cmluZ107XHJcbiAgICAgIGlmIChiaXQgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBwZXJtaXNzaW9uOiAke3Blcm1pc3Npb259YCk7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIGJpdDtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoQXJyYXkuaXNBcnJheShwZXJtaXNzaW9uKSkge1xyXG4gICAgICBsZXQgcmVzdWx0ID0gMG47XHJcbiAgICAgIGZvciAoY29uc3QgcCBvZiBwZXJtaXNzaW9uKSB7XHJcbiAgICAgICAgcmVzdWx0IHw9IFBlcm1pc3Npb25zQml0RmllbGQucmVzb2x2ZShwKTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfVxyXG5cclxuICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBwZXJtaXNzaW9uOiAke3Blcm1pc3Npb259YCk7XHJcbiAgfVxyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBQZXJtaXNzaW9uc0JpdEZpZWxkO1xyXG4iXX0=