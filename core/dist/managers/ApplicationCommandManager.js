"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplicationCommandManager = void 0;
const Collection_1 = require("../utils/Collection");
/**
 * Resolves command data to a plain API object
 */
function resolveCommand(data) {
    if ('toJSON' in data && typeof data.toJSON === 'function') {
        return data.toJSON();
    }
    return data;
}
/**
 * Manages application commands (slash commands)
 *
 * Discord.js compatible API:
 * ```js
 * // Register global commands (bulk overwrite)
 * await client.application.commands.set([...commands]);
 *
 * // Register a single command
 * await client.application.commands.create({ name: 'ping', description: 'Pong!' });
 *
 * // List all commands
 * const commands = await client.application.commands.fetch();
 *
 * // Delete a command
 * await client.application.commands.delete('commandId');
 *
 * // Edit a command
 * await client.application.commands.edit('commandId', { description: 'Updated' });
 * ```
 */
class ApplicationCommandManager {
    rest;
    guildId;
    /** Cached commands */
    cache = new Collection_1.Collection();
    constructor(rest, guildId) {
        this.rest = rest;
        this.guildId = guildId;
    }
    /**
     * Bulk overwrite all commands (removes commands not in the list)
     * Discord.js: client.application.commands.set(commands)
     */
    async set(commands) {
        const resolved = commands.map(resolveCommand);
        const result = this.guildId
            ? await this.rest.bulkOverwriteGuildCommands(this.guildId, resolved)
            : await this.rest.bulkOverwriteGlobalCommands(resolved);
        // Update cache from response
        this.cache.clear();
        for (const cmd of result || []) {
            const withId = { ...cmd, id: cmd.id || cmd.name };
            this.cache.set(withId.id, withId);
        }
        return this.cache;
    }
    /**
     * Create a single command
     * Discord.js: client.application.commands.create(command)
     */
    async create(command) {
        const resolved = resolveCommand(command);
        if (this.guildId) {
            await this.rest.registerGuildCommands(this.guildId, [resolved]);
        }
        else {
            await this.rest.registerGlobalCommands([resolved]);
        }
        // Refresh cache
        await this.fetch();
        // Return the matching command from cache
        const created = this.cache.find(c => c.name === resolved.name);
        return created || resolved;
    }
    async fetch(commandId) {
        if (commandId) {
            const cmd = this.guildId
                ? await this.rest.getGuildCommand(this.guildId, commandId)
                : await this.rest.getGlobalCommand(commandId);
            const withId = { ...cmd, id: cmd.id || commandId };
            this.cache.set(withId.id, withId);
            return withId;
        }
        const commands = this.guildId
            ? await this.rest.listGuildCommands(this.guildId)
            : await this.rest.listGlobalCommands();
        this.cache.clear();
        for (const cmd of commands || []) {
            const withId = { ...cmd, id: cmd.id || cmd.name };
            this.cache.set(withId.id, withId);
        }
        return this.cache;
    }
    /**
     * Delete a command by ID
     * Discord.js: client.application.commands.delete(commandId)
     */
    async delete(commandId) {
        if (this.guildId) {
            await this.rest.deleteGuildCommand(this.guildId, commandId);
        }
        else {
            await this.rest.deleteGlobalCommand(commandId);
        }
        this.cache.delete(commandId);
    }
    /**
     * Edit a command by ID
     * Discord.js: client.application.commands.edit(commandId, data)
     */
    async edit(commandId, data) {
        const result = this.guildId
            ? await this.rest.updateGuildCommand(this.guildId, commandId, data)
            : await this.rest.updateGlobalCommand(commandId, data);
        const withId = { ...result, id: result.id || commandId };
        this.cache.set(withId.id, withId);
        return withId;
    }
}
exports.ApplicationCommandManager = ApplicationCommandManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQXBwbGljYXRpb25Db21tYW5kTWFuYWdlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9tYW5hZ2Vycy9BcHBsaWNhdGlvbkNvbW1hbmRNYW5hZ2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG9EQUFpRDtBQVNqRDs7R0FFRztBQUNILFNBQVMsY0FBYyxDQUFDLElBQTRCO0lBQ2xELElBQUksUUFBUSxJQUFJLElBQUksSUFBSSxPQUFPLElBQUksQ0FBQyxNQUFNLEtBQUssVUFBVSxFQUFFLENBQUM7UUFDMUQsT0FBTyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7SUFDdkIsQ0FBQztJQUNELE9BQU8sSUFBNkIsQ0FBQztBQUN2QyxDQUFDO0FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBb0JHO0FBQ0gsTUFBYSx5QkFBeUI7SUFLakI7SUFDQTtJQUxuQixzQkFBc0I7SUFDTixLQUFLLEdBQStELElBQUksdUJBQVUsRUFBRSxDQUFDO0lBRXJHLFlBQ21CLElBQVUsRUFDVixPQUFnQjtRQURoQixTQUFJLEdBQUosSUFBSSxDQUFNO1FBQ1YsWUFBTyxHQUFQLE9BQU8sQ0FBUztJQUNoQyxDQUFDO0lBRUo7OztPQUdHO0lBQ0gsS0FBSyxDQUFDLEdBQUcsQ0FBQyxRQUFrQztRQUMxQyxNQUFNLFFBQVEsR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBRTlDLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxPQUFPO1lBQ3pCLENBQUMsQ0FBQyxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsMEJBQTBCLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxRQUFRLENBQUM7WUFDcEUsQ0FBQyxDQUFDLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQywyQkFBMkIsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUUxRCw2QkFBNkI7UUFDN0IsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNuQixLQUFLLE1BQU0sR0FBRyxJQUFJLE1BQU0sSUFBSSxFQUFFLEVBQUUsQ0FBQztZQUMvQixNQUFNLE1BQU0sR0FBRyxFQUFFLEdBQUcsR0FBRyxFQUFFLEVBQUUsRUFBRyxHQUFXLENBQUMsRUFBRSxJQUFLLEdBQVcsQ0FBQyxJQUFJLEVBQTRDLENBQUM7WUFDOUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUNwQyxDQUFDO1FBRUQsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDO0lBQ3BCLENBQUM7SUFFRDs7O09BR0c7SUFDSCxLQUFLLENBQUMsTUFBTSxDQUFDLE9BQStCO1FBQzFDLE1BQU0sUUFBUSxHQUFHLGNBQWMsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUV6QyxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNqQixNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7UUFDbEUsQ0FBQzthQUFNLENBQUM7WUFDTixNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO1FBQ3JELENBQUM7UUFFRCxnQkFBZ0I7UUFDaEIsTUFBTSxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7UUFFbkIseUNBQXlDO1FBQ3pDLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDL0QsT0FBTyxPQUFPLElBQUksUUFBUSxDQUFDO0lBQzdCLENBQUM7SUFRRCxLQUFLLENBQUMsS0FBSyxDQUFDLFNBQWtCO1FBQzVCLElBQUksU0FBUyxFQUFFLENBQUM7WUFDZCxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsT0FBTztnQkFDdEIsQ0FBQyxDQUFDLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUM7Z0JBQzFELENBQUMsQ0FBQyxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDaEQsTUFBTSxNQUFNLEdBQUcsRUFBRSxHQUFHLEdBQUcsRUFBRSxFQUFFLEVBQUcsR0FBVyxDQUFDLEVBQUUsSUFBSSxTQUFTLEVBQTRDLENBQUM7WUFDdEcsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQztZQUNsQyxPQUFPLE1BQU0sQ0FBQztRQUNoQixDQUFDO1FBRUQsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLE9BQU87WUFDM0IsQ0FBQyxDQUFDLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDO1lBQ2pELENBQUMsQ0FBQyxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztRQUV6QyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ25CLEtBQUssTUFBTSxHQUFHLElBQUksUUFBUSxJQUFJLEVBQUUsRUFBRSxDQUFDO1lBQ2pDLE1BQU0sTUFBTSxHQUFHLEVBQUUsR0FBRyxHQUFHLEVBQUUsRUFBRSxFQUFHLEdBQVcsQ0FBQyxFQUFFLElBQUssR0FBVyxDQUFDLElBQUksRUFBNEMsQ0FBQztZQUM5RyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ3BDLENBQUM7UUFFRCxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUM7SUFDcEIsQ0FBQztJQUVEOzs7T0FHRztJQUNILEtBQUssQ0FBQyxNQUFNLENBQUMsU0FBaUI7UUFDNUIsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDakIsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFDOUQsQ0FBQzthQUFNLENBQUM7WUFDTixNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDakQsQ0FBQztRQUVELElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQy9CLENBQUM7SUFFRDs7O09BR0c7SUFDSCxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQWlCLEVBQUUsSUFBb0M7UUFDaEUsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLE9BQU87WUFDekIsQ0FBQyxDQUFDLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLFNBQVMsRUFBRSxJQUFJLENBQUM7WUFDbkUsQ0FBQyxDQUFDLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFFekQsTUFBTSxNQUFNLEdBQUcsRUFBRSxHQUFHLE1BQU0sRUFBRSxFQUFFLEVBQUcsTUFBYyxDQUFDLEVBQUUsSUFBSSxTQUFTLEVBQTRDLENBQUM7UUFDNUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUNsQyxPQUFPLE1BQU0sQ0FBQztJQUNoQixDQUFDO0NBQ0Y7QUEzR0QsOERBMkdDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ29sbGVjdGlvbiB9IGZyb20gJy4uL3V0aWxzL0NvbGxlY3Rpb24nO1xyXG5pbXBvcnQgeyBSRVNUIH0gZnJvbSAnLi4vcmVzdC9SRVNUJztcclxuaW1wb3J0IHR5cGUgeyBBUElBcHBsaWNhdGlvbkNvbW1hbmQgfSBmcm9tICcuLi90eXBlcyc7XHJcblxyXG4vKipcclxuICogQ29tbWFuZCBkYXRhIGlucHV0IOKAlCBhY2NlcHRzIHBsYWluIG9iamVjdHMgb3IgYnVpbGRlcnMgd2l0aCB0b0pTT04oKVxyXG4gKi9cclxudHlwZSBBcHBsaWNhdGlvbkNvbW1hbmREYXRhID0gQVBJQXBwbGljYXRpb25Db21tYW5kIHwgeyB0b0pTT04oKTogQVBJQXBwbGljYXRpb25Db21tYW5kIH07XHJcblxyXG4vKipcclxuICogUmVzb2x2ZXMgY29tbWFuZCBkYXRhIHRvIGEgcGxhaW4gQVBJIG9iamVjdFxyXG4gKi9cclxuZnVuY3Rpb24gcmVzb2x2ZUNvbW1hbmQoZGF0YTogQXBwbGljYXRpb25Db21tYW5kRGF0YSk6IEFQSUFwcGxpY2F0aW9uQ29tbWFuZCB7XHJcbiAgaWYgKCd0b0pTT04nIGluIGRhdGEgJiYgdHlwZW9mIGRhdGEudG9KU09OID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICByZXR1cm4gZGF0YS50b0pTT04oKTtcclxuICB9XHJcbiAgcmV0dXJuIGRhdGEgYXMgQVBJQXBwbGljYXRpb25Db21tYW5kO1xyXG59XHJcblxyXG4vKipcclxuICogTWFuYWdlcyBhcHBsaWNhdGlvbiBjb21tYW5kcyAoc2xhc2ggY29tbWFuZHMpXHJcbiAqIFxyXG4gKiBEaXNjb3JkLmpzIGNvbXBhdGlibGUgQVBJOlxyXG4gKiBgYGBqc1xyXG4gKiAvLyBSZWdpc3RlciBnbG9iYWwgY29tbWFuZHMgKGJ1bGsgb3ZlcndyaXRlKVxyXG4gKiBhd2FpdCBjbGllbnQuYXBwbGljYXRpb24uY29tbWFuZHMuc2V0KFsuLi5jb21tYW5kc10pO1xyXG4gKiBcclxuICogLy8gUmVnaXN0ZXIgYSBzaW5nbGUgY29tbWFuZFxyXG4gKiBhd2FpdCBjbGllbnQuYXBwbGljYXRpb24uY29tbWFuZHMuY3JlYXRlKHsgbmFtZTogJ3BpbmcnLCBkZXNjcmlwdGlvbjogJ1BvbmchJyB9KTtcclxuICogXHJcbiAqIC8vIExpc3QgYWxsIGNvbW1hbmRzXHJcbiAqIGNvbnN0IGNvbW1hbmRzID0gYXdhaXQgY2xpZW50LmFwcGxpY2F0aW9uLmNvbW1hbmRzLmZldGNoKCk7XHJcbiAqIFxyXG4gKiAvLyBEZWxldGUgYSBjb21tYW5kXHJcbiAqIGF3YWl0IGNsaWVudC5hcHBsaWNhdGlvbi5jb21tYW5kcy5kZWxldGUoJ2NvbW1hbmRJZCcpO1xyXG4gKiBcclxuICogLy8gRWRpdCBhIGNvbW1hbmRcclxuICogYXdhaXQgY2xpZW50LmFwcGxpY2F0aW9uLmNvbW1hbmRzLmVkaXQoJ2NvbW1hbmRJZCcsIHsgZGVzY3JpcHRpb246ICdVcGRhdGVkJyB9KTtcclxuICogYGBgXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgQXBwbGljYXRpb25Db21tYW5kTWFuYWdlciB7XHJcbiAgLyoqIENhY2hlZCBjb21tYW5kcyAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBjYWNoZTogQ29sbGVjdGlvbjxzdHJpbmcsIEFQSUFwcGxpY2F0aW9uQ29tbWFuZCAmIHsgaWQ6IHN0cmluZyB9PiA9IG5ldyBDb2xsZWN0aW9uKCk7XHJcblxyXG4gIGNvbnN0cnVjdG9yKFxyXG4gICAgcHJpdmF0ZSByZWFkb25seSByZXN0OiBSRVNULFxyXG4gICAgcHJpdmF0ZSByZWFkb25seSBndWlsZElkPzogc3RyaW5nLFxyXG4gICkge31cclxuXHJcbiAgLyoqXHJcbiAgICogQnVsayBvdmVyd3JpdGUgYWxsIGNvbW1hbmRzIChyZW1vdmVzIGNvbW1hbmRzIG5vdCBpbiB0aGUgbGlzdClcclxuICAgKiBEaXNjb3JkLmpzOiBjbGllbnQuYXBwbGljYXRpb24uY29tbWFuZHMuc2V0KGNvbW1hbmRzKVxyXG4gICAqL1xyXG4gIGFzeW5jIHNldChjb21tYW5kczogQXBwbGljYXRpb25Db21tYW5kRGF0YVtdKTogUHJvbWlzZTxDb2xsZWN0aW9uPHN0cmluZywgQVBJQXBwbGljYXRpb25Db21tYW5kICYgeyBpZDogc3RyaW5nIH0+PiB7XHJcbiAgICBjb25zdCByZXNvbHZlZCA9IGNvbW1hbmRzLm1hcChyZXNvbHZlQ29tbWFuZCk7XHJcblxyXG4gICAgY29uc3QgcmVzdWx0ID0gdGhpcy5ndWlsZElkXHJcbiAgICAgID8gYXdhaXQgdGhpcy5yZXN0LmJ1bGtPdmVyd3JpdGVHdWlsZENvbW1hbmRzKHRoaXMuZ3VpbGRJZCwgcmVzb2x2ZWQpXHJcbiAgICAgIDogYXdhaXQgdGhpcy5yZXN0LmJ1bGtPdmVyd3JpdGVHbG9iYWxDb21tYW5kcyhyZXNvbHZlZCk7XHJcblxyXG4gICAgLy8gVXBkYXRlIGNhY2hlIGZyb20gcmVzcG9uc2VcclxuICAgIHRoaXMuY2FjaGUuY2xlYXIoKTtcclxuICAgIGZvciAoY29uc3QgY21kIG9mIHJlc3VsdCB8fCBbXSkge1xyXG4gICAgICBjb25zdCB3aXRoSWQgPSB7IC4uLmNtZCwgaWQ6IChjbWQgYXMgYW55KS5pZCB8fCAoY21kIGFzIGFueSkubmFtZSB9IGFzIEFQSUFwcGxpY2F0aW9uQ29tbWFuZCAmIHsgaWQ6IHN0cmluZyB9O1xyXG4gICAgICB0aGlzLmNhY2hlLnNldCh3aXRoSWQuaWQsIHdpdGhJZCk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHRoaXMuY2FjaGU7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgYSBzaW5nbGUgY29tbWFuZFxyXG4gICAqIERpc2NvcmQuanM6IGNsaWVudC5hcHBsaWNhdGlvbi5jb21tYW5kcy5jcmVhdGUoY29tbWFuZClcclxuICAgKi9cclxuICBhc3luYyBjcmVhdGUoY29tbWFuZDogQXBwbGljYXRpb25Db21tYW5kRGF0YSk6IFByb21pc2U8QVBJQXBwbGljYXRpb25Db21tYW5kPiB7XHJcbiAgICBjb25zdCByZXNvbHZlZCA9IHJlc29sdmVDb21tYW5kKGNvbW1hbmQpO1xyXG5cclxuICAgIGlmICh0aGlzLmd1aWxkSWQpIHtcclxuICAgICAgYXdhaXQgdGhpcy5yZXN0LnJlZ2lzdGVyR3VpbGRDb21tYW5kcyh0aGlzLmd1aWxkSWQsIFtyZXNvbHZlZF0pO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgYXdhaXQgdGhpcy5yZXN0LnJlZ2lzdGVyR2xvYmFsQ29tbWFuZHMoW3Jlc29sdmVkXSk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gUmVmcmVzaCBjYWNoZVxyXG4gICAgYXdhaXQgdGhpcy5mZXRjaCgpO1xyXG5cclxuICAgIC8vIFJldHVybiB0aGUgbWF0Y2hpbmcgY29tbWFuZCBmcm9tIGNhY2hlXHJcbiAgICBjb25zdCBjcmVhdGVkID0gdGhpcy5jYWNoZS5maW5kKGMgPT4gYy5uYW1lID09PSByZXNvbHZlZC5uYW1lKTtcclxuICAgIHJldHVybiBjcmVhdGVkIHx8IHJlc29sdmVkO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRmV0Y2ggYWxsIGNvbW1hbmRzIChhbmQgdXBkYXRlIGNhY2hlKVxyXG4gICAqIERpc2NvcmQuanM6IGNsaWVudC5hcHBsaWNhdGlvbi5jb21tYW5kcy5mZXRjaCgpXHJcbiAgICovXHJcbiAgYXN5bmMgZmV0Y2goKTogUHJvbWlzZTxDb2xsZWN0aW9uPHN0cmluZywgQVBJQXBwbGljYXRpb25Db21tYW5kICYgeyBpZDogc3RyaW5nIH0+PjtcclxuICBhc3luYyBmZXRjaChjb21tYW5kSWQ6IHN0cmluZyk6IFByb21pc2U8QVBJQXBwbGljYXRpb25Db21tYW5kICYgeyBpZDogc3RyaW5nIH0+O1xyXG4gIGFzeW5jIGZldGNoKGNvbW1hbmRJZD86IHN0cmluZyk6IFByb21pc2U8YW55PiB7XHJcbiAgICBpZiAoY29tbWFuZElkKSB7XHJcbiAgICAgIGNvbnN0IGNtZCA9IHRoaXMuZ3VpbGRJZFxyXG4gICAgICAgID8gYXdhaXQgdGhpcy5yZXN0LmdldEd1aWxkQ29tbWFuZCh0aGlzLmd1aWxkSWQsIGNvbW1hbmRJZClcclxuICAgICAgICA6IGF3YWl0IHRoaXMucmVzdC5nZXRHbG9iYWxDb21tYW5kKGNvbW1hbmRJZCk7XHJcbiAgICAgIGNvbnN0IHdpdGhJZCA9IHsgLi4uY21kLCBpZDogKGNtZCBhcyBhbnkpLmlkIHx8IGNvbW1hbmRJZCB9IGFzIEFQSUFwcGxpY2F0aW9uQ29tbWFuZCAmIHsgaWQ6IHN0cmluZyB9O1xyXG4gICAgICB0aGlzLmNhY2hlLnNldCh3aXRoSWQuaWQsIHdpdGhJZCk7XHJcbiAgICAgIHJldHVybiB3aXRoSWQ7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgY29tbWFuZHMgPSB0aGlzLmd1aWxkSWRcclxuICAgICAgPyBhd2FpdCB0aGlzLnJlc3QubGlzdEd1aWxkQ29tbWFuZHModGhpcy5ndWlsZElkKVxyXG4gICAgICA6IGF3YWl0IHRoaXMucmVzdC5saXN0R2xvYmFsQ29tbWFuZHMoKTtcclxuXHJcbiAgICB0aGlzLmNhY2hlLmNsZWFyKCk7XHJcbiAgICBmb3IgKGNvbnN0IGNtZCBvZiBjb21tYW5kcyB8fCBbXSkge1xyXG4gICAgICBjb25zdCB3aXRoSWQgPSB7IC4uLmNtZCwgaWQ6IChjbWQgYXMgYW55KS5pZCB8fCAoY21kIGFzIGFueSkubmFtZSB9IGFzIEFQSUFwcGxpY2F0aW9uQ29tbWFuZCAmIHsgaWQ6IHN0cmluZyB9O1xyXG4gICAgICB0aGlzLmNhY2hlLnNldCh3aXRoSWQuaWQsIHdpdGhJZCk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHRoaXMuY2FjaGU7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZWxldGUgYSBjb21tYW5kIGJ5IElEXHJcbiAgICogRGlzY29yZC5qczogY2xpZW50LmFwcGxpY2F0aW9uLmNvbW1hbmRzLmRlbGV0ZShjb21tYW5kSWQpXHJcbiAgICovXHJcbiAgYXN5bmMgZGVsZXRlKGNvbW1hbmRJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBpZiAodGhpcy5ndWlsZElkKSB7XHJcbiAgICAgIGF3YWl0IHRoaXMucmVzdC5kZWxldGVHdWlsZENvbW1hbmQodGhpcy5ndWlsZElkLCBjb21tYW5kSWQpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgYXdhaXQgdGhpcy5yZXN0LmRlbGV0ZUdsb2JhbENvbW1hbmQoY29tbWFuZElkKTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmNhY2hlLmRlbGV0ZShjb21tYW5kSWQpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRWRpdCBhIGNvbW1hbmQgYnkgSURcclxuICAgKiBEaXNjb3JkLmpzOiBjbGllbnQuYXBwbGljYXRpb24uY29tbWFuZHMuZWRpdChjb21tYW5kSWQsIGRhdGEpXHJcbiAgICovXHJcbiAgYXN5bmMgZWRpdChjb21tYW5kSWQ6IHN0cmluZywgZGF0YTogUGFydGlhbDxBUElBcHBsaWNhdGlvbkNvbW1hbmQ+KTogUHJvbWlzZTxBUElBcHBsaWNhdGlvbkNvbW1hbmQ+IHtcclxuICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuZ3VpbGRJZFxyXG4gICAgICA/IGF3YWl0IHRoaXMucmVzdC51cGRhdGVHdWlsZENvbW1hbmQodGhpcy5ndWlsZElkLCBjb21tYW5kSWQsIGRhdGEpXHJcbiAgICAgIDogYXdhaXQgdGhpcy5yZXN0LnVwZGF0ZUdsb2JhbENvbW1hbmQoY29tbWFuZElkLCBkYXRhKTtcclxuXHJcbiAgICBjb25zdCB3aXRoSWQgPSB7IC4uLnJlc3VsdCwgaWQ6IChyZXN1bHQgYXMgYW55KS5pZCB8fCBjb21tYW5kSWQgfSBhcyBBUElBcHBsaWNhdGlvbkNvbW1hbmQgJiB7IGlkOiBzdHJpbmcgfTtcclxuICAgIHRoaXMuY2FjaGUuc2V0KHdpdGhJZC5pZCwgd2l0aElkKTtcclxuICAgIHJldHVybiB3aXRoSWQ7XHJcbiAgfVxyXG59XHJcbiJdfQ==