import { Collection } from '../utils/Collection';
import { REST } from '../rest/REST';
import type { APIApplicationCommand } from '../types';
/**
 * Command data input — accepts plain objects or builders with toJSON()
 */
type ApplicationCommandData = APIApplicationCommand | {
    toJSON(): APIApplicationCommand;
};
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
export declare class ApplicationCommandManager {
    private readonly rest;
    private readonly guildId?;
    /** Cached commands */
    readonly cache: Collection<string, APIApplicationCommand & {
        id: string;
    }>;
    constructor(rest: REST, guildId?: string | undefined);
    /**
     * Bulk overwrite all commands (removes commands not in the list)
     * Discord.js: client.application.commands.set(commands)
     */
    set(commands: ApplicationCommandData[]): Promise<Collection<string, APIApplicationCommand & {
        id: string;
    }>>;
    /**
     * Create a single command
     * Discord.js: client.application.commands.create(command)
     */
    create(command: ApplicationCommandData): Promise<APIApplicationCommand>;
    /**
     * Fetch all commands (and update cache)
     * Discord.js: client.application.commands.fetch()
     */
    fetch(): Promise<Collection<string, APIApplicationCommand & {
        id: string;
    }>>;
    fetch(commandId: string): Promise<APIApplicationCommand & {
        id: string;
    }>;
    /**
     * Delete a command by ID
     * Discord.js: client.application.commands.delete(commandId)
     */
    delete(commandId: string): Promise<void>;
    /**
     * Edit a command by ID
     * Discord.js: client.application.commands.edit(commandId, data)
     */
    edit(commandId: string, data: Partial<APIApplicationCommand>): Promise<APIApplicationCommand>;
}
export {};
