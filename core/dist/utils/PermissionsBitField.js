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
    /** Whether this represents a guild owner (owners have all permissions) */
    isOwner;
    /** All permission flags */
    static Flags = enums_1.PermissionFlagsBits;
    /** All permissions combined */
    static All = Object.values(enums_1.PermissionFlagsBits).reduce((acc, val) => acc | val, 0n);
    /** Default permissions */
    static Default = BigInt(0);
    constructor(bits = 0n, isOwner = false) {
        this.bitfield = PermissionsBitField.resolve(bits);
        this.isOwner = isOwner;
    }
    /**
     * Check if this bitfield has a permission
     */
    has(permission, checkAdmin = true) {
        // Owner has all permissions
        if (this.isOwner) {
            return true;
        }
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
        // Owner has all permissions
        if (this.isOwner) {
            return true;
        }
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
        // Resolve once outside the loop (MEDIUM-9 fix)
        const resolved = PermissionsBitField.resolve(permissions);
        for (const [name, bit] of Object.entries(enums_1.PermissionFlagsBits)) {
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
        return new PermissionsBitField(this.bitfield, this.isOwner);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUGVybWlzc2lvbnNCaXRGaWVsZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91dGlscy9QZXJtaXNzaW9uc0JpdEZpZWxkLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG9DQUErQztBQWlCL0M7OztHQUdHO0FBQ0gsTUFBYSxtQkFBbUI7SUFDOUIsbUJBQW1CO0lBQ1osUUFBUSxDQUFTO0lBRXhCLDBFQUEwRTtJQUNsRSxPQUFPLENBQVU7SUFFekIsMkJBQTJCO0lBQzNCLE1BQU0sQ0FBQyxLQUFLLEdBQUcsMkJBQW1CLENBQUM7SUFFbkMsK0JBQStCO0lBQy9CLE1BQU0sQ0FBQyxHQUFHLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQywyQkFBbUIsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLEdBQUcsR0FBRyxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFFcEYsMEJBQTBCO0lBQzFCLE1BQU0sQ0FBQyxPQUFPLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRTNCLFlBQVksT0FBNkIsRUFBRSxFQUFFLE9BQU8sR0FBRyxLQUFLO1FBQzFELElBQUksQ0FBQyxRQUFRLEdBQUcsbUJBQW1CLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2xELElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO0lBQ3pCLENBQUM7SUFFRDs7T0FFRztJQUNILEdBQUcsQ0FBQyxVQUFnQyxFQUFFLFVBQVUsR0FBRyxJQUFJO1FBQ3JELDRCQUE0QjtRQUM1QixJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNqQixPQUFPLElBQUksQ0FBQztRQUNkLENBQUM7UUFFRCw0QkFBNEI7UUFDNUIsSUFBSSxVQUFVLElBQUksSUFBSSxDQUFDLFFBQVEsR0FBRywyQkFBbUIsQ0FBQyxhQUFhLEVBQUUsQ0FBQztZQUNwRSxPQUFPLElBQUksQ0FBQztRQUNk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LFVBQVUsRUFBRSxDQUFDLENBQUM7SUFDdkQsQ0FBQzs7QUE5S0gsa0RBK0tDO0FBRUQsa0JBQWUsbUJBQW1CLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBQZXJtaXNzaW9uRmxhZ3NCaXRzIH0gZnJvbSAnLi4vZW51bXMnO1xyXG5cclxuLyoqXHJcbiAqIFBlcm1pc3Npb24gbmFtZXMgdHlwZVxyXG4gKi9cclxuZXhwb3J0IHR5cGUgUGVybWlzc2lvblN0cmluZyA9IGtleW9mIHR5cGVvZiBQZXJtaXNzaW9uRmxhZ3NCaXRzO1xyXG5cclxuLyoqXHJcbiAqIFJlc29sdmFibGUgcGVybWlzc2lvbiB0eXBlXHJcbiAqL1xyXG5leHBvcnQgdHlwZSBQZXJtaXNzaW9uUmVzb2x2YWJsZSA9IFxyXG4gIHwgYmlnaW50IFxyXG4gIHwgYmlnaW50W10gXHJcbiAgfCBQZXJtaXNzaW9uU3RyaW5nIFxyXG4gIHwgUGVybWlzc2lvblN0cmluZ1tdIFxyXG4gIHwgUGVybWlzc2lvbnNCaXRGaWVsZDtcclxuXHJcbi8qKlxyXG4gKiBCaXQgZmllbGQgZm9yIHBlcm1pc3Npb25zXHJcbiAqIEFQSSBjb21wYXRpYmxlIHdpdGggRGlzY29yZC5qcyBQZXJtaXNzaW9uc0JpdEZpZWxkXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgUGVybWlzc2lvbnNCaXRGaWVsZCB7XHJcbiAgLyoqIFRoZSByYXcgYml0cyAqL1xyXG4gIHB1YmxpYyBiaXRmaWVsZDogYmlnaW50O1xyXG5cclxuICAvKiogV2hldGhlciB0aGlzIHJlcHJlc2VudHMgYSBndWlsZCBvd25lciAob3duZXJzIGhhdmUgYWxsIHBlcm1pc3Npb25zKSAqL1xyXG4gIHByaXZhdGUgaXNPd25lcjogYm9vbGVhbjtcclxuXHJcbiAgLyoqIEFsbCBwZXJtaXNzaW9uIGZsYWdzICovXHJcbiAgc3RhdGljIEZsYWdzID0gUGVybWlzc2lvbkZsYWdzQml0cztcclxuXHJcbiAgLyoqIEFsbCBwZXJtaXNzaW9ucyBjb21iaW5lZCAqL1xyXG4gIHN0YXRpYyBBbGwgPSBPYmplY3QudmFsdWVzKFBlcm1pc3Npb25GbGFnc0JpdHMpLnJlZHVjZSgoYWNjLCB2YWwpID0+IGFjYyB8IHZhbCwgMG4pO1xyXG5cclxuICAvKiogRGVmYXVsdCBwZXJtaXNzaW9ucyAqL1xyXG4gIHN0YXRpYyBEZWZhdWx0ID0gQmlnSW50KDApO1xyXG5cclxuICBjb25zdHJ1Y3RvcihiaXRzOiBQZXJtaXNzaW9uUmVzb2x2YWJsZSA9IDBuLCBpc093bmVyID0gZmFsc2UpIHtcclxuICAgIHRoaXMuYml0ZmllbGQgPSBQZXJtaXNzaW9uc0JpdEZpZWxkLnJlc29sdmUoYml0cyk7XHJcbiAgICB0aGlzLmlzT3duZXIgPSBpc093bmVyO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2hlY2sgaWYgdGhpcyBiaXRmaWVsZCBoYXMgYSBwZXJtaXNzaW9uXHJcbiAgICovXHJcbiAgaGFzKHBlcm1pc3Npb246IFBlcm1pc3Npb25SZXNvbHZhYmxlLCBjaGVja0FkbWluID0gdHJ1ZSk6IGJvb2xlYW4ge1xyXG4gICAgLy8gT3duZXIgaGFzIGFsbCBwZXJtaXNzaW9uc1xyXG4gICAgaWYgKHRoaXMuaXNPd25lcikge1xyXG4gICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBBZG1pbiBoYXMgYWxsIHBlcm1pc3Npb25zXHJcbiAgICBpZiAoY2hlY2tBZG1pbiAmJiB0aGlzLmJpdGZpZWxkICYgUGVybWlzc2lvbkZsYWdzQml0cy5BZG1pbmlzdHJhdG9yKSB7XHJcbiAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGJpdCA9IFBlcm1pc3Npb25zQml0RmllbGQucmVzb2x2ZShwZXJtaXNzaW9uKTtcclxuICAgIHJldHVybiAodGhpcy5iaXRmaWVsZCAmIGJpdCkgPT09IGJpdDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENoZWNrIGlmIHRoaXMgYml0ZmllbGQgaGFzIGFueSBvZiB0aGUgcGVybWlzc2lvbnNcclxuICAgKi9cclxuICBhbnkocGVybWlzc2lvbnM6IFBlcm1pc3Npb25SZXNvbHZhYmxlLCBjaGVja0FkbWluID0gdHJ1ZSk6IGJvb2xlYW4ge1xyXG4gICAgLy8gT3duZXIgaGFzIGFsbCBwZXJtaXNzaW9uc1xyXG4gICAgaWYgKHRoaXMuaXNPd25lcikge1xyXG4gICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBBZG1pbiBoYXMgYWxsIHBlcm1pc3Npb25zXHJcbiAgICBpZiAoY2hlY2tBZG1pbiAmJiB0aGlzLmJpdGZpZWxkICYgUGVybWlzc2lvbkZsYWdzQml0cy5BZG1pbmlzdHJhdG9yKSB7XHJcbiAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGJpdCA9IFBlcm1pc3Npb25zQml0RmllbGQucmVzb2x2ZShwZXJtaXNzaW9ucyk7XHJcbiAgICByZXR1cm4gKHRoaXMuYml0ZmllbGQgJiBiaXQpICE9PSAwbjtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENoZWNrIGlmIHRoaXMgYml0ZmllbGQgaXMgbWlzc2luZyBhbnkgcGVybWlzc2lvbnNcclxuICAgKi9cclxuICBtaXNzaW5nKHBlcm1pc3Npb25zOiBQZXJtaXNzaW9uUmVzb2x2YWJsZSwgY2hlY2tBZG1pbiA9IHRydWUpOiBQZXJtaXNzaW9uU3RyaW5nW10ge1xyXG4gICAgY29uc3QgbWlzc2luZzogUGVybWlzc2lvblN0cmluZ1tdID0gW107XHJcbiAgICBcclxuICAgIC8vIFJlc29sdmUgb25jZSBvdXRzaWRlIHRoZSBsb29wIChNRURJVU0tOSBmaXgpXHJcbiAgICBjb25zdCByZXNvbHZlZCA9IFBlcm1pc3Npb25zQml0RmllbGQucmVzb2x2ZShwZXJtaXNzaW9ucyk7XHJcbiAgICBcclxuICAgIGZvciAoY29uc3QgW25hbWUsIGJpdF0gb2YgT2JqZWN0LmVudHJpZXMoUGVybWlzc2lvbkZsYWdzQml0cykpIHtcclxuICAgICAgaWYgKChyZXNvbHZlZCAmIGJpdCkgJiYgIXRoaXMuaGFzKGJpdCwgY2hlY2tBZG1pbikpIHtcclxuICAgICAgICBtaXNzaW5nLnB1c2gobmFtZSBhcyBQZXJtaXNzaW9uU3RyaW5nKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICByZXR1cm4gbWlzc2luZztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEFkZCBwZXJtaXNzaW9ucyB0byB0aGlzIGJpdGZpZWxkXHJcbiAgICovXHJcbiAgYWRkKC4uLnBlcm1pc3Npb25zOiBQZXJtaXNzaW9uUmVzb2x2YWJsZVtdKTogdGhpcyB7XHJcbiAgICBmb3IgKGNvbnN0IHBlcm1pc3Npb24gb2YgcGVybWlzc2lvbnMpIHtcclxuICAgICAgdGhpcy5iaXRmaWVsZCB8PSBQZXJtaXNzaW9uc0JpdEZpZWxkLnJlc29sdmUocGVybWlzc2lvbik7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlbW92ZSBwZXJtaXNzaW9ucyBmcm9tIHRoaXMgYml0ZmllbGRcclxuICAgKi9cclxuICByZW1vdmUoLi4ucGVybWlzc2lvbnM6IFBlcm1pc3Npb25SZXNvbHZhYmxlW10pOiB0aGlzIHtcclxuICAgIGZvciAoY29uc3QgcGVybWlzc2lvbiBvZiBwZXJtaXNzaW9ucykge1xyXG4gICAgICB0aGlzLmJpdGZpZWxkICY9IH5QZXJtaXNzaW9uc0JpdEZpZWxkLnJlc29sdmUocGVybWlzc2lvbik7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNlcmlhbGl6ZSB0aGlzIGJpdGZpZWxkIHRvIGFuIGFycmF5IG9mIHBlcm1pc3Npb24gbmFtZXNcclxuICAgKi9cclxuICB0b0FycmF5KCk6IFBlcm1pc3Npb25TdHJpbmdbXSB7XHJcbiAgICBjb25zdCByZXN1bHQ6IFBlcm1pc3Npb25TdHJpbmdbXSA9IFtdO1xyXG4gICAgXHJcbiAgICBmb3IgKGNvbnN0IFtuYW1lLCBiaXRdIG9mIE9iamVjdC5lbnRyaWVzKFBlcm1pc3Npb25GbGFnc0JpdHMpKSB7XHJcbiAgICAgIGlmICh0aGlzLmJpdGZpZWxkICYgYml0KSB7XHJcbiAgICAgICAgcmVzdWx0LnB1c2gobmFtZSBhcyBQZXJtaXNzaW9uU3RyaW5nKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2VyaWFsaXplIHRoaXMgYml0ZmllbGQgdG8gYSBKU09OLWNvbXBhdGlibGUgdmFsdWVcclxuICAgKi9cclxuICB0b0pTT04oKTogc3RyaW5nIHtcclxuICAgIHJldHVybiB0aGlzLmJpdGZpZWxkLnRvU3RyaW5nKCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgdGhlIHN0cmluZyByZXByZXNlbnRhdGlvblxyXG4gICAqL1xyXG4gIHRvU3RyaW5nKCk6IHN0cmluZyB7XHJcbiAgICByZXR1cm4gdGhpcy5iaXRmaWVsZC50b1N0cmluZygpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRnJlZXplIHRoaXMgYml0ZmllbGRcclxuICAgKi9cclxuICBmcmVlemUoKTogUmVhZG9ubHk8dGhpcz4ge1xyXG4gICAgcmV0dXJuIE9iamVjdC5mcmVlemUodGhpcyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDaGVjayBlcXVhbGl0eSB3aXRoIGFub3RoZXIgYml0ZmllbGRcclxuICAgKi9cclxuICBlcXVhbHMob3RoZXI6IFBlcm1pc3Npb25SZXNvbHZhYmxlKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gdGhpcy5iaXRmaWVsZCA9PT0gUGVybWlzc2lvbnNCaXRGaWVsZC5yZXNvbHZlKG90aGVyKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIG5ldyBiaXRmaWVsZCB3aXRoIHRoZSBzYW1lIGJpdHNcclxuICAgKi9cclxuICBjbG9uZSgpOiBQZXJtaXNzaW9uc0JpdEZpZWxkIHtcclxuICAgIHJldHVybiBuZXcgUGVybWlzc2lvbnNCaXRGaWVsZCh0aGlzLmJpdGZpZWxkLCB0aGlzLmlzT3duZXIpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVzb2x2ZSBhIHBlcm1pc3Npb24gdG8gYSBiaWdpbnRcclxuICAgKi9cclxuICBzdGF0aWMgcmVzb2x2ZShwZXJtaXNzaW9uOiBQZXJtaXNzaW9uUmVzb2x2YWJsZSk6IGJpZ2ludCB7XHJcbiAgICBpZiAodHlwZW9mIHBlcm1pc3Npb24gPT09ICdiaWdpbnQnKSB7XHJcbiAgICAgIHJldHVybiBwZXJtaXNzaW9uO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChwZXJtaXNzaW9uIGluc3RhbmNlb2YgUGVybWlzc2lvbnNCaXRGaWVsZCkge1xyXG4gICAgICByZXR1cm4gcGVybWlzc2lvbi5iaXRmaWVsZDtcclxuICAgIH1cclxuXHJcbiAgICBpZiAodHlwZW9mIHBlcm1pc3Npb24gPT09ICdzdHJpbmcnKSB7XHJcbiAgICAgIGNvbnN0IGJpdCA9IFBlcm1pc3Npb25GbGFnc0JpdHNbcGVybWlzc2lvbiBhcyBQZXJtaXNzaW9uU3RyaW5nXTtcclxuICAgICAgaWYgKGJpdCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIHBlcm1pc3Npb246ICR7cGVybWlzc2lvbn1gKTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gYml0O1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChBcnJheS5pc0FycmF5KHBlcm1pc3Npb24pKSB7XHJcbiAgICAgIGxldCByZXN1bHQgPSAwbjtcclxuICAgICAgZm9yIChjb25zdCBwIG9mIHBlcm1pc3Npb24pIHtcclxuICAgICAgICByZXN1bHQgfD0gUGVybWlzc2lvbnNCaXRGaWVsZC5yZXNvbHZlKHApO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9XHJcblxyXG4gICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHBlcm1pc3Npb246ICR7cGVybWlzc2lvbn1gKTtcclxuICB9XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IFBlcm1pc3Npb25zQml0RmllbGQ7XHJcbiJdfQ==