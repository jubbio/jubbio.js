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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUGVybWlzc2lvbnNCaXRGaWVsZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91dGlscy9QZXJtaXNzaW9uc0JpdEZpZWxkLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG9DQUErQztBQWlCL0M7OztHQUdHO0FBQ0gsTUFBYSxtQkFBbUI7SUFDOUIsbUJBQW1CO0lBQ1osUUFBUSxDQUFTO0lBRXhCLDJCQUEyQjtJQUMzQixNQUFNLENBQUMsS0FBSyxHQUFHLDJCQUFtQixDQUFDO0lBRW5DLCtCQUErQjtJQUMvQixNQUFNLENBQUMsR0FBRyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsMkJBQW1CLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxHQUFHLEdBQUcsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBRXBGLDBCQUEwQjtJQUMxQixNQUFNLENBQUMsT0FBTyxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUUzQixZQUFZLE9BQTZCLEVBQUU7UUFDekMsSUFBSSxDQUFDLFFBQVEsR0FBRyxtQkFBbUIsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDcEQsQ0FBQztJQUVEOztPQUVHO0lBQ0gsR0FBRyxDQUFDLFVBQWdDLEVBQUUsVUFBVSxHQUFHLElBQUk7UUFDckQsNEJBQTRCO1FBQzVCLElBQUksVUFBVSxJQUFJLElBQUksQ0FBQyxRQUFRLEdBQUcsMkJBQW1CLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDcEUsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDO1FBRUQsTUFBTSxHQUFHLEdBQUcsbUJBQW1CLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3BELE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxHQUFHLEdBQUcsQ0FBQyxLQUFLLEdBQUcsQ0FBQztJQUN2QyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxHQUFHLENBQUMsV0FB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Z0M7UUFDN0MsSUFBSSxPQUFPLFVBQVUsS0FBSyxRQUFRLEVBQUUsQ0FBQztZQUNuQyxPQUFPLFVBQVUsQ0FBQztRQUNwQixDQUFDO1FBRUQsSUFBSSxVQUFVLFlBQVksbUJBQW1CLEVBQUUsQ0FBQztZQUM5QyxPQUFPLFVBQVUsQ0FBQyxRQUFRLENBQUM7UUFDN0IsQ0FBQztRQUVELElBQUksT0FBTyxVQUFVLEtBQUssUUFBUSxFQUFFLENBQUM7WUFDbkMsTUFBTSxHQUFHLEdBQUcsMkJBQW1CLENBQUMsVUFBOEIsQ0FBQyxDQUFDO1lBQ2hFLElBQUksR0FBRyxLQUFLLFNBQVMsRUFBRSxDQUFDO2dCQUN0QixNQUFNLElBQUksS0FBSyxDQUFDLHVCQUF1QixVQUFVLEVBQUUsQ0FBQyxDQUFDO1lBQ3ZELENBQUM7WUFDRCxPQUFPLEdBQUcsQ0FBQztRQUNiLENBQUM7UUFFRCxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQztZQUM5QixJQUFJLE1BQU0sR0FBRyxFQUFFLENBQUM7WUFDaEIsS0FBSyxNQUFNLENBQUMsSUFBSSxVQUFVLEVBQUUsQ0FBQztnQkFDM0IsTUFBTSxJQUFJLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMzQyxDQUFDO1lBQ0QsT0FBTyxNQUFNLENBQUM7UUFDaEIsQ0FBQztRQUVELE1BQU0sSUFBSSxLQUFLLENBQUMsdUJBQXVCLFVBQVUsRUFBRSxDQUFDLENBQUM7SUFDdkQsQ0FBQzs7QUE5Skgsa0RBK0pDO0FBRUQsa0JBQWUsbUJBQW1CLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBQZXJtaXNzaW9uRmxhZ3NCaXRzIH0gZnJvbSAnLi4vZW51bXMnO1xuXG4vKipcbiAqIFBlcm1pc3Npb24gbmFtZXMgdHlwZVxuICovXG5leHBvcnQgdHlwZSBQZXJtaXNzaW9uU3RyaW5nID0ga2V5b2YgdHlwZW9mIFBlcm1pc3Npb25GbGFnc0JpdHM7XG5cbi8qKlxuICogUmVzb2x2YWJsZSBwZXJtaXNzaW9uIHR5cGVcbiAqL1xuZXhwb3J0IHR5cGUgUGVybWlzc2lvblJlc29sdmFibGUgPSBcbiAgfCBiaWdpbnQgXG4gIHwgYmlnaW50W10gXG4gIHwgUGVybWlzc2lvblN0cmluZyBcbiAgfCBQZXJtaXNzaW9uU3RyaW5nW10gXG4gIHwgUGVybWlzc2lvbnNCaXRGaWVsZDtcblxuLyoqXG4gKiBCaXQgZmllbGQgZm9yIHBlcm1pc3Npb25zXG4gKiBBUEkgY29tcGF0aWJsZSB3aXRoIERpc2NvcmQuanMgUGVybWlzc2lvbnNCaXRGaWVsZFxuICovXG5leHBvcnQgY2xhc3MgUGVybWlzc2lvbnNCaXRGaWVsZCB7XG4gIC8qKiBUaGUgcmF3IGJpdHMgKi9cbiAgcHVibGljIGJpdGZpZWxkOiBiaWdpbnQ7XG5cbiAgLyoqIEFsbCBwZXJtaXNzaW9uIGZsYWdzICovXG4gIHN0YXRpYyBGbGFncyA9IFBlcm1pc3Npb25GbGFnc0JpdHM7XG5cbiAgLyoqIEFsbCBwZXJtaXNzaW9ucyBjb21iaW5lZCAqL1xuICBzdGF0aWMgQWxsID0gT2JqZWN0LnZhbHVlcyhQZXJtaXNzaW9uRmxhZ3NCaXRzKS5yZWR1Y2UoKGFjYywgdmFsKSA9PiBhY2MgfCB2YWwsIDBuKTtcblxuICAvKiogRGVmYXVsdCBwZXJtaXNzaW9ucyAqL1xuICBzdGF0aWMgRGVmYXVsdCA9IEJpZ0ludCgwKTtcblxuICBjb25zdHJ1Y3RvcihiaXRzOiBQZXJtaXNzaW9uUmVzb2x2YWJsZSA9IDBuKSB7XG4gICAgdGhpcy5iaXRmaWVsZCA9IFBlcm1pc3Npb25zQml0RmllbGQucmVzb2x2ZShiaXRzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVjayBpZiB0aGlzIGJpdGZpZWxkIGhhcyBhIHBlcm1pc3Npb25cbiAgICovXG4gIGhhcyhwZXJtaXNzaW9uOiBQZXJtaXNzaW9uUmVzb2x2YWJsZSwgY2hlY2tBZG1pbiA9IHRydWUpOiBib29sZWFuIHtcbiAgICAvLyBBZG1pbiBoYXMgYWxsIHBlcm1pc3Npb25zXG4gICAgaWYgKGNoZWNrQWRtaW4gJiYgdGhpcy5iaXRmaWVsZCAmIFBlcm1pc3Npb25GbGFnc0JpdHMuQWRtaW5pc3RyYXRvcikge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgY29uc3QgYml0ID0gUGVybWlzc2lvbnNCaXRGaWVsZC5yZXNvbHZlKHBlcm1pc3Npb24pO1xuICAgIHJldHVybiAodGhpcy5iaXRmaWVsZCAmIGJpdCkgPT09IGJpdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVjayBpZiB0aGlzIGJpdGZpZWxkIGhhcyBhbnkgb2YgdGhlIHBlcm1pc3Npb25zXG4gICAqL1xuICBhbnkocGVybWlzc2lvbnM6IFBlcm1pc3Npb25SZXNvbHZhYmxlLCBjaGVja0FkbWluID0gdHJ1ZSk6IGJvb2xlYW4ge1xuICAgIC8vIEFkbWluIGhhcyBhbGwgcGVybWlzc2lvbnNcbiAgICBpZiAoY2hlY2tBZG1pbiAmJiB0aGlzLmJpdGZpZWxkICYgUGVybWlzc2lvbkZsYWdzQml0cy5BZG1pbmlzdHJhdG9yKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBjb25zdCBiaXQgPSBQZXJtaXNzaW9uc0JpdEZpZWxkLnJlc29sdmUocGVybWlzc2lvbnMpO1xuICAgIHJldHVybiAodGhpcy5iaXRmaWVsZCAmIGJpdCkgIT09IDBuO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrIGlmIHRoaXMgYml0ZmllbGQgaXMgbWlzc2luZyBhbnkgcGVybWlzc2lvbnNcbiAgICovXG4gIG1pc3NpbmcocGVybWlzc2lvbnM6IFBlcm1pc3Npb25SZXNvbHZhYmxlLCBjaGVja0FkbWluID0gdHJ1ZSk6IFBlcm1pc3Npb25TdHJpbmdbXSB7XG4gICAgY29uc3QgbWlzc2luZzogUGVybWlzc2lvblN0cmluZ1tdID0gW107XG4gICAgXG4gICAgZm9yIChjb25zdCBbbmFtZSwgYml0XSBvZiBPYmplY3QuZW50cmllcyhQZXJtaXNzaW9uRmxhZ3NCaXRzKSkge1xuICAgICAgY29uc3QgcmVzb2x2ZWQgPSBQZXJtaXNzaW9uc0JpdEZpZWxkLnJlc29sdmUocGVybWlzc2lvbnMpO1xuICAgICAgaWYgKChyZXNvbHZlZCAmIGJpdCkgJiYgIXRoaXMuaGFzKGJpdCwgY2hlY2tBZG1pbikpIHtcbiAgICAgICAgbWlzc2luZy5wdXNoKG5hbWUgYXMgUGVybWlzc2lvblN0cmluZyk7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBtaXNzaW5nO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZCBwZXJtaXNzaW9ucyB0byB0aGlzIGJpdGZpZWxkXG4gICAqL1xuICBhZGQoLi4ucGVybWlzc2lvbnM6IFBlcm1pc3Npb25SZXNvbHZhYmxlW10pOiB0aGlzIHtcbiAgICBmb3IgKGNvbnN0IHBlcm1pc3Npb24gb2YgcGVybWlzc2lvbnMpIHtcbiAgICAgIHRoaXMuYml0ZmllbGQgfD0gUGVybWlzc2lvbnNCaXRGaWVsZC5yZXNvbHZlKHBlcm1pc3Npb24pO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgcGVybWlzc2lvbnMgZnJvbSB0aGlzIGJpdGZpZWxkXG4gICAqL1xuICByZW1vdmUoLi4ucGVybWlzc2lvbnM6IFBlcm1pc3Npb25SZXNvbHZhYmxlW10pOiB0aGlzIHtcbiAgICBmb3IgKGNvbnN0IHBlcm1pc3Npb24gb2YgcGVybWlzc2lvbnMpIHtcbiAgICAgIHRoaXMuYml0ZmllbGQgJj0gflBlcm1pc3Npb25zQml0RmllbGQucmVzb2x2ZShwZXJtaXNzaW9uKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU2VyaWFsaXplIHRoaXMgYml0ZmllbGQgdG8gYW4gYXJyYXkgb2YgcGVybWlzc2lvbiBuYW1lc1xuICAgKi9cbiAgdG9BcnJheSgpOiBQZXJtaXNzaW9uU3RyaW5nW10ge1xuICAgIGNvbnN0IHJlc3VsdDogUGVybWlzc2lvblN0cmluZ1tdID0gW107XG4gICAgXG4gICAgZm9yIChjb25zdCBbbmFtZSwgYml0XSBvZiBPYmplY3QuZW50cmllcyhQZXJtaXNzaW9uRmxhZ3NCaXRzKSkge1xuICAgICAgaWYgKHRoaXMuYml0ZmllbGQgJiBiaXQpIHtcbiAgICAgICAgcmVzdWx0LnB1c2gobmFtZSBhcyBQZXJtaXNzaW9uU3RyaW5nKTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXJpYWxpemUgdGhpcyBiaXRmaWVsZCB0byBhIEpTT04tY29tcGF0aWJsZSB2YWx1ZVxuICAgKi9cbiAgdG9KU09OKCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIHRoaXMuYml0ZmllbGQudG9TdHJpbmcoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIHN0cmluZyByZXByZXNlbnRhdGlvblxuICAgKi9cbiAgdG9TdHJpbmcoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5iaXRmaWVsZC50b1N0cmluZygpO1xuICB9XG5cbiAgLyoqXG4gICAqIEZyZWV6ZSB0aGlzIGJpdGZpZWxkXG4gICAqL1xuICBmcmVlemUoKTogUmVhZG9ubHk8dGhpcz4ge1xuICAgIHJldHVybiBPYmplY3QuZnJlZXplKHRoaXMpO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrIGVxdWFsaXR5IHdpdGggYW5vdGhlciBiaXRmaWVsZFxuICAgKi9cbiAgZXF1YWxzKG90aGVyOiBQZXJtaXNzaW9uUmVzb2x2YWJsZSk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLmJpdGZpZWxkID09PSBQZXJtaXNzaW9uc0JpdEZpZWxkLnJlc29sdmUob3RoZXIpO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBiaXRmaWVsZCB3aXRoIHRoZSBzYW1lIGJpdHNcbiAgICovXG4gIGNsb25lKCk6IFBlcm1pc3Npb25zQml0RmllbGQge1xuICAgIHJldHVybiBuZXcgUGVybWlzc2lvbnNCaXRGaWVsZCh0aGlzLmJpdGZpZWxkKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXNvbHZlIGEgcGVybWlzc2lvbiB0byBhIGJpZ2ludFxuICAgKi9cbiAgc3RhdGljIHJlc29sdmUocGVybWlzc2lvbjogUGVybWlzc2lvblJlc29sdmFibGUpOiBiaWdpbnQge1xuICAgIGlmICh0eXBlb2YgcGVybWlzc2lvbiA9PT0gJ2JpZ2ludCcpIHtcbiAgICAgIHJldHVybiBwZXJtaXNzaW9uO1xuICAgIH1cblxuICAgIGlmIChwZXJtaXNzaW9uIGluc3RhbmNlb2YgUGVybWlzc2lvbnNCaXRGaWVsZCkge1xuICAgICAgcmV0dXJuIHBlcm1pc3Npb24uYml0ZmllbGQ7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBwZXJtaXNzaW9uID09PSAnc3RyaW5nJykge1xuICAgICAgY29uc3QgYml0ID0gUGVybWlzc2lvbkZsYWdzQml0c1twZXJtaXNzaW9uIGFzIFBlcm1pc3Npb25TdHJpbmddO1xuICAgICAgaWYgKGJpdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBwZXJtaXNzaW9uOiAke3Blcm1pc3Npb259YCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gYml0O1xuICAgIH1cblxuICAgIGlmIChBcnJheS5pc0FycmF5KHBlcm1pc3Npb24pKSB7XG4gICAgICBsZXQgcmVzdWx0ID0gMG47XG4gICAgICBmb3IgKGNvbnN0IHAgb2YgcGVybWlzc2lvbikge1xuICAgICAgICByZXN1bHQgfD0gUGVybWlzc2lvbnNCaXRGaWVsZC5yZXNvbHZlKHApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgcGVybWlzc2lvbjogJHtwZXJtaXNzaW9ufWApO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFBlcm1pc3Npb25zQml0RmllbGQ7XG4iXX0=