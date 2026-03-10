"use strict";
/**
 * Intents BitField for calculating gateway intents
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentsBitField = exports.PrivilegedIntents = exports.IntentsAll = exports.GatewayIntentBits = void 0;
exports.calculateIntents = calculateIntents;
exports.resolveIntents = resolveIntents;
const BitField_1 = require("./BitField");
/**
 * Gateway Intent Bits
 */
exports.GatewayIntentBits = {
    Guilds: 1 << 0,
    GuildMembers: 1 << 1,
    GuildModeration: 1 << 2,
    GuildEmojisAndStickers: 1 << 3,
    GuildIntegrations: 1 << 4,
    GuildWebhooks: 1 << 5,
    GuildInvites: 1 << 6,
    GuildVoiceStates: 1 << 7,
    GuildPresences: 1 << 8,
    GuildMessages: 1 << 9,
    GuildMessageReactions: 1 << 10,
    GuildMessageTyping: 1 << 11,
    DirectMessages: 1 << 12,
    DirectMessageReactions: 1 << 13,
    DirectMessageTyping: 1 << 14,
    MessageContent: 1 << 15,
    GuildScheduledEvents: 1 << 16,
    AutoModerationConfiguration: 1 << 20,
    AutoModerationExecution: 1 << 21,
};
/**
 * All non-privileged intents
 */
exports.IntentsAll = Object.values(exports.GatewayIntentBits).reduce((all, i) => all | i, 0);
/**
 * Privileged intents that require approval
 */
exports.PrivilegedIntents = exports.GatewayIntentBits.GuildMembers |
    exports.GatewayIntentBits.GuildPresences |
    exports.GatewayIntentBits.MessageContent;
/**
 * Data structure for gateway intents
 */
class IntentsBitField extends BitField_1.BitField {
    static Flags = exports.GatewayIntentBits;
    static DefaultBit = 0;
    constructor(bits = 0) {
        super(bits);
    }
    /**
     * Check if any privileged intents are enabled
     */
    hasPrivileged() {
        return this.any(exports.PrivilegedIntents);
    }
    /**
     * Get all privileged intents that are enabled
     */
    getPrivileged() {
        const privileged = [];
        if (this.has(exports.GatewayIntentBits.GuildMembers))
            privileged.push('GuildMembers');
        if (this.has(exports.GatewayIntentBits.GuildPresences))
            privileged.push('GuildPresences');
        if (this.has(exports.GatewayIntentBits.MessageContent))
            privileged.push('MessageContent');
        return privileged;
    }
}
exports.IntentsBitField = IntentsBitField;
/**
 * Calculate intents from an array of intent names or values
 */
function calculateIntents(intents) {
    return intents.reduce((acc, intent) => {
        if (typeof intent === 'number')
            return acc | intent;
        if (intent in exports.GatewayIntentBits)
            return acc | exports.GatewayIntentBits[intent];
        return acc;
    }, 0);
}
/**
 * Get all intent names from a bitfield value
 */
function resolveIntents(bits) {
    const names = [];
    for (const [name, value] of Object.entries(exports.GatewayIntentBits)) {
        if ((bits & value) === value) {
            names.push(name);
        }
    }
    return names;
}
exports.default = IntentsBitField;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSW50ZW50c0JpdEZpZWxkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3V0aWxzL0ludGVudHNCaXRGaWVsZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7O0dBRUc7OztBQWdGSCw0Q0FNQztBQUtELHdDQVFDO0FBakdELHlDQUEwRDtBQU8xRDs7R0FFRztBQUNVLFFBQUEsaUJBQWlCLEdBQUc7SUFDL0IsTUFBTSxFQUFFLENBQUMsSUFBSSxDQUFDO0lBQ2QsWUFBWSxFQUFFLENBQUMsSUFBSSxDQUFDO0lBQ3BCLGVBQWUsRUFBRSxDQUFDLElBQUksQ0FBQztJQUN2QixzQkFBc0IsRUFBRSxDQUFDLElBQUksQ0FBQztJQUM5QixpQkFBaUIsRUFBRSxDQUFDLElBQUksQ0FBQztJQUN6QixhQUFhLEVBQUUsQ0FBQyxJQUFJLENBQUM7SUFDckIsWUFBWSxFQUFFLENBQUMsSUFBSSxDQUFDO0lBQ3BCLGdCQUFnQixFQUFFLENBQUMsSUFBSSxDQUFDO0lBQ3hCLGNBQWMsRUFBRSxDQUFDLElBQUksQ0FBQztJQUN0QixhQUFhLEVBQUUsQ0FBQyxJQUFJLENBQUM7SUFDckIscUJBQXFCLEVBQUUsQ0FBQyxJQUFJLEVBQUU7SUFDOUIsa0JBQWtCLEVBQUUsQ0FBQyxJQUFJLEVBQUU7SUFDM0IsY0FBYyxFQUFFLENBQUMsSUFBSSxFQUFFO0lBQ3ZCLHNCQUFzQixFQUFFLENBQUMsSUFBSSxFQUFFO0lBQy9CLG1CQUFtQixFQUFFLENBQUMsSUFBSSxFQUFFO0lBQzVCLGNBQWMsRUFBRSxDQUFDLElBQUksRUFBRTtJQUN2QixvQkFBb0IsRUFBRSxDQUFDLElBQUksRUFBRTtJQUM3QiwyQkFBMkIsRUFBRSxDQUFDLElBQUksRUFBRTtJQUNwQyx1QkFBdUIsRUFBRSxDQUFDLElBQUksRUFBRTtDQUN4QixDQUFDO0FBRVg7O0dBRUc7QUFDVSxRQUFBLFVBQVUsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLHlCQUFpQixDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsR0FBRyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUUxRjs7R0FFRztBQUNVLFFBQUEsaUJBQWlCLEdBQzVCLHlCQUFpQixDQUFDLFlBQVk7SUFDOUIseUJBQWlCLENBQUMsY0FBYztJQUNoQyx5QkFBaUIsQ0FBQyxjQUFjLENBQUM7QUFFbkM7O0dBRUc7QUFDSCxNQUFhLGVBQWdCLFNBQVEsbUJBQW1DO0lBQ3RFLE1BQU0sQ0FBQyxLQUFLLEdBQUcseUJBQWlCLENBQUM7SUFDakMsTUFBTSxDQUFDLFVBQVUsR0FBRyxDQUFDLENBQUM7SUFFdEIsWUFBWSxPQUFzRCxDQUFDO1FBQ2pFLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNkLENBQUM7SUFFRDs7T0FFRztJQUNILGFBQWE7UUFDWCxPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMseUJBQWlCLENBQUMsQ0FBQztJQUNyQyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxhQUFhO1FBQ1gsTUFBTSxVQUFVLEdBQXdCLEVBQUUsQ0FBQztRQUMzQyxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMseUJBQWlCLENBQUMsWUFBWSxDQUFDO1lBQUUsVUFBVSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUM5RSxJQUFJLElBQUksQ0FBQyxHQUFHLENBQUMseUJBQWlCLENBQUMsY0FBYyxDQUFDO1lBQUUsVUFBVSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBQ2xGLElBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyx5QkFBaUIsQ0FBQyxjQUFjLENBQUM7WUFBRSxVQUFVLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFDbEYsT0FBTyxVQUFVLENBQUM7SUFDcEIsQ0FBQzs7QUF4QkgsMENBeUJDO0FBRUQ7O0dBRUc7QUFDSCxTQUFnQixnQkFBZ0IsQ0FBQyxPQUF1QztJQUN0RSxPQUFPLE9BQU8sQ0FBQyxNQUFNLENBQVMsQ0FBQyxHQUFHLEVBQUUsTUFBTSxFQUFFLEVBQUU7UUFDNUMsSUFBSSxPQUFPLE1BQU0sS0FBSyxRQUFRO1lBQUUsT0FBTyxHQUFHLEdBQUcsTUFBTSxDQUFDO1FBQ3BELElBQUksTUFBTSxJQUFJLHlCQUFpQjtZQUFFLE9BQU8sR0FBRyxHQUFHLHlCQUFpQixDQUFDLE1BQXdDLENBQUMsQ0FBQztRQUMxRyxPQUFPLEdBQUcsQ0FBQztJQUNiLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUNSLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQWdCLGNBQWMsQ0FBQyxJQUFZO0lBQ3pDLE1BQU0sS0FBSyxHQUF3QixFQUFFLENBQUM7SUFDdEMsS0FBSyxNQUFNLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMseUJBQWlCLENBQUMsRUFBRSxDQUFDO1FBQzlELElBQUksQ0FBQyxJQUFJLEdBQUcsS0FBSyxDQUFDLEtBQUssS0FBSyxFQUFFLENBQUM7WUFDN0IsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUF5QixDQUFDLENBQUM7UUFDeEMsQ0FBQztJQUNILENBQUM7SUFDRCxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUM7QUFFRCxrQkFBZSxlQUFlLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEludGVudHMgQml0RmllbGQgZm9yIGNhbGN1bGF0aW5nIGdhdGV3YXkgaW50ZW50c1xuICovXG5cbmltcG9ydCB7IEJpdEZpZWxkLCBCaXRGaWVsZFJlc29sdmFibGUgfSBmcm9tICcuL0JpdEZpZWxkJztcblxuLyoqXG4gKiBJbnRlbnQgZmxhZyBuYW1lc1xuICovXG5leHBvcnQgdHlwZSBJbnRlbnRGbGFnc1N0cmluZyA9IGtleW9mIHR5cGVvZiBJbnRlbnRzQml0RmllbGQuRmxhZ3M7XG5cbi8qKlxuICogR2F0ZXdheSBJbnRlbnQgQml0c1xuICovXG5leHBvcnQgY29uc3QgR2F0ZXdheUludGVudEJpdHMgPSB7XG4gIEd1aWxkczogMSA8PCAwLFxuICBHdWlsZE1lbWJlcnM6IDEgPDwgMSxcbiAgR3VpbGRNb2RlcmF0aW9uOiAxIDw8IDIsXG4gIEd1aWxkRW1vamlzQW5kU3RpY2tlcnM6IDEgPDwgMyxcbiAgR3VpbGRJbnRlZ3JhdGlvbnM6IDEgPDwgNCxcbiAgR3VpbGRXZWJob29rczogMSA8PCA1LFxuICBHdWlsZEludml0ZXM6IDEgPDwgNixcbiAgR3VpbGRWb2ljZVN0YXRlczogMSA8PCA3LFxuICBHdWlsZFByZXNlbmNlczogMSA8PCA4LFxuICBHdWlsZE1lc3NhZ2VzOiAxIDw8IDksXG4gIEd1aWxkTWVzc2FnZVJlYWN0aW9uczogMSA8PCAxMCxcbiAgR3VpbGRNZXNzYWdlVHlwaW5nOiAxIDw8IDExLFxuICBEaXJlY3RNZXNzYWdlczogMSA8PCAxMixcbiAgRGlyZWN0TWVzc2FnZVJlYWN0aW9uczogMSA8PCAxMyxcbiAgRGlyZWN0TWVzc2FnZVR5cGluZzogMSA8PCAxNCxcbiAgTWVzc2FnZUNvbnRlbnQ6IDEgPDwgMTUsXG4gIEd1aWxkU2NoZWR1bGVkRXZlbnRzOiAxIDw8IDE2LFxuICBBdXRvTW9kZXJhdGlvbkNvbmZpZ3VyYXRpb246IDEgPDwgMjAsXG4gIEF1dG9Nb2RlcmF0aW9uRXhlY3V0aW9uOiAxIDw8IDIxLFxufSBhcyBjb25zdDtcblxuLyoqXG4gKiBBbGwgbm9uLXByaXZpbGVnZWQgaW50ZW50c1xuICovXG5leHBvcnQgY29uc3QgSW50ZW50c0FsbCA9IE9iamVjdC52YWx1ZXMoR2F0ZXdheUludGVudEJpdHMpLnJlZHVjZSgoYWxsLCBpKSA9PiBhbGwgfCBpLCAwKTtcblxuLyoqXG4gKiBQcml2aWxlZ2VkIGludGVudHMgdGhhdCByZXF1aXJlIGFwcHJvdmFsXG4gKi9cbmV4cG9ydCBjb25zdCBQcml2aWxlZ2VkSW50ZW50cyA9IFxuICBHYXRld2F5SW50ZW50Qml0cy5HdWlsZE1lbWJlcnMgfCBcbiAgR2F0ZXdheUludGVudEJpdHMuR3VpbGRQcmVzZW5jZXMgfCBcbiAgR2F0ZXdheUludGVudEJpdHMuTWVzc2FnZUNvbnRlbnQ7XG5cbi8qKlxuICogRGF0YSBzdHJ1Y3R1cmUgZm9yIGdhdGV3YXkgaW50ZW50c1xuICovXG5leHBvcnQgY2xhc3MgSW50ZW50c0JpdEZpZWxkIGV4dGVuZHMgQml0RmllbGQ8SW50ZW50RmxhZ3NTdHJpbmcsIG51bWJlcj4ge1xuICBzdGF0aWMgRmxhZ3MgPSBHYXRld2F5SW50ZW50Qml0cztcbiAgc3RhdGljIERlZmF1bHRCaXQgPSAwO1xuXG4gIGNvbnN0cnVjdG9yKGJpdHM6IEJpdEZpZWxkUmVzb2x2YWJsZTxJbnRlbnRGbGFnc1N0cmluZywgbnVtYmVyPiA9IDApIHtcbiAgICBzdXBlcihiaXRzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVjayBpZiBhbnkgcHJpdmlsZWdlZCBpbnRlbnRzIGFyZSBlbmFibGVkXG4gICAqL1xuICBoYXNQcml2aWxlZ2VkKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLmFueShQcml2aWxlZ2VkSW50ZW50cyk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGFsbCBwcml2aWxlZ2VkIGludGVudHMgdGhhdCBhcmUgZW5hYmxlZFxuICAgKi9cbiAgZ2V0UHJpdmlsZWdlZCgpOiBJbnRlbnRGbGFnc1N0cmluZ1tdIHtcbiAgICBjb25zdCBwcml2aWxlZ2VkOiBJbnRlbnRGbGFnc1N0cmluZ1tdID0gW107XG4gICAgaWYgKHRoaXMuaGFzKEdhdGV3YXlJbnRlbnRCaXRzLkd1aWxkTWVtYmVycykpIHByaXZpbGVnZWQucHVzaCgnR3VpbGRNZW1iZXJzJyk7XG4gICAgaWYgKHRoaXMuaGFzKEdhdGV3YXlJbnRlbnRCaXRzLkd1aWxkUHJlc2VuY2VzKSkgcHJpdmlsZWdlZC5wdXNoKCdHdWlsZFByZXNlbmNlcycpO1xuICAgIGlmICh0aGlzLmhhcyhHYXRld2F5SW50ZW50Qml0cy5NZXNzYWdlQ29udGVudCkpIHByaXZpbGVnZWQucHVzaCgnTWVzc2FnZUNvbnRlbnQnKTtcbiAgICByZXR1cm4gcHJpdmlsZWdlZDtcbiAgfVxufVxuXG4vKipcbiAqIENhbGN1bGF0ZSBpbnRlbnRzIGZyb20gYW4gYXJyYXkgb2YgaW50ZW50IG5hbWVzIG9yIHZhbHVlc1xuICovXG5leHBvcnQgZnVuY3Rpb24gY2FsY3VsYXRlSW50ZW50cyhpbnRlbnRzOiAoSW50ZW50RmxhZ3NTdHJpbmcgfCBudW1iZXIpW10pOiBudW1iZXIge1xuICByZXR1cm4gaW50ZW50cy5yZWR1Y2U8bnVtYmVyPigoYWNjLCBpbnRlbnQpID0+IHtcbiAgICBpZiAodHlwZW9mIGludGVudCA9PT0gJ251bWJlcicpIHJldHVybiBhY2MgfCBpbnRlbnQ7XG4gICAgaWYgKGludGVudCBpbiBHYXRld2F5SW50ZW50Qml0cykgcmV0dXJuIGFjYyB8IEdhdGV3YXlJbnRlbnRCaXRzW2ludGVudCBhcyBrZXlvZiB0eXBlb2YgR2F0ZXdheUludGVudEJpdHNdO1xuICAgIHJldHVybiBhY2M7XG4gIH0sIDApO1xufVxuXG4vKipcbiAqIEdldCBhbGwgaW50ZW50IG5hbWVzIGZyb20gYSBiaXRmaWVsZCB2YWx1ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZUludGVudHMoYml0czogbnVtYmVyKTogSW50ZW50RmxhZ3NTdHJpbmdbXSB7XG4gIGNvbnN0IG5hbWVzOiBJbnRlbnRGbGFnc1N0cmluZ1tdID0gW107XG4gIGZvciAoY29uc3QgW25hbWUsIHZhbHVlXSBvZiBPYmplY3QuZW50cmllcyhHYXRld2F5SW50ZW50Qml0cykpIHtcbiAgICBpZiAoKGJpdHMgJiB2YWx1ZSkgPT09IHZhbHVlKSB7XG4gICAgICBuYW1lcy5wdXNoKG5hbWUgYXMgSW50ZW50RmxhZ3NTdHJpbmcpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gbmFtZXM7XG59XG5cbmV4cG9ydCBkZWZhdWx0IEludGVudHNCaXRGaWVsZDtcbiJdfQ==