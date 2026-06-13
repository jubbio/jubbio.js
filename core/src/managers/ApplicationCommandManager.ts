import { Collection } from '../structures/Collection';
import { REST } from '../rest/REST';
import type { APIApplicationCommand } from '../types';

/**
 * Command data input — accepts plain objects or builders with toJSON()
 */
type ApplicationCommandData = APIApplicationCommand | { toJSON(): APIApplicationCommand };

/**
 * Resolves command data to a plain API object
 */
function resolveCommand(data: ApplicationCommandData): APIApplicationCommand {
  if ('toJSON' in data && typeof data.toJSON === 'function') {
    return data.toJSON();
  }
  return data as APIApplicationCommand;
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
export class ApplicationCommandManager {
  /** Cached commands */
  public readonly cache: Collection<string, APIApplicationCommand & { id: string }> = new Collection();

  constructor(
    private readonly rest: REST,
    private readonly guildId?: string,
  ) {}

  /**
   * Bulk overwrite all commands (removes commands not in the list)
   * Discord.js: client.application.commands.set(commands)
   */
  async set(commands: ApplicationCommandData[]): Promise<Collection<string, APIApplicationCommand & { id: string }>> {
    const resolved = commands.map(resolveCommand);

    const result = this.guildId
      ? await this.rest.bulkOverwriteGuildCommands(this.guildId, resolved)
      : await this.rest.bulkOverwriteGlobalCommands(resolved);

    // Update cache from response
    this.cache.clear();
    for (const cmd of result || []) {
      const withId = { ...cmd, id: (cmd as any).id || (cmd as any).name } as APIApplicationCommand & { id: string };
      this.cache.set(withId.id, withId);
    }

    return this.cache;
  }

  /**
   * Create a single command
   * Discord.js: client.application.commands.create(command)
   */
  async create(command: ApplicationCommandData): Promise<APIApplicationCommand> {
    const resolved = resolveCommand(command);

    if (this.guildId) {
      await this.rest.registerGuildCommands(this.guildId, [resolved]);
    } else {
      await this.rest.registerGlobalCommands([resolved]);
    }

    // Refresh cache
    await this.fetch();

    // Return the matching command from cache
    const created = this.cache.find(c => c.name === resolved.name);
    return created || resolved;
  }

  /**
   * Fetch all commands (and update cache)
   * Discord.js: client.application.commands.fetch()
   */
  async fetch(): Promise<Collection<string, APIApplicationCommand & { id: string }>>;
  async fetch(commandId: string): Promise<APIApplicationCommand & { id: string }>;
  async fetch(commandId?: string): Promise<any> {
    if (commandId) {
      const cmd = this.guildId
        ? await this.rest.getGuildCommand(this.guildId, commandId)
        : await this.rest.getGlobalCommand(commandId);
      const withId = { ...cmd, id: (cmd as any).id || commandId } as APIApplicationCommand & { id: string };
      this.cache.set(withId.id, withId);
      return withId;
    }

    const commands = this.guildId
      ? await this.rest.listGuildCommands(this.guildId)
      : await this.rest.listGlobalCommands();

    this.cache.clear();
    for (const cmd of commands || []) {
      const withId = { ...cmd, id: (cmd as any).id || (cmd as any).name } as APIApplicationCommand & { id: string };
      this.cache.set(withId.id, withId);
    }

    return this.cache;
  }

  /**
   * Delete a command by ID
   * Discord.js: client.application.commands.delete(commandId)
   */
  async delete(commandId: string): Promise<void> {
    if (this.guildId) {
      await this.rest.deleteGuildCommand(this.guildId, commandId);
    } else {
      await this.rest.deleteGlobalCommand(commandId);
    }

    this.cache.delete(commandId);
  }

  /**
   * Edit a command by ID
   * Discord.js: client.application.commands.edit(commandId, data)
   */
  async edit(commandId: string, data: Partial<APIApplicationCommand>): Promise<APIApplicationCommand> {
    const result = this.guildId
      ? await this.rest.updateGuildCommand(this.guildId, commandId, data)
      : await this.rest.updateGlobalCommand(commandId, data);

    const withId = { ...result, id: (result as any).id || commandId } as APIApplicationCommand & { id: string };
    this.cache.set(withId.id, withId);
    return withId;
  }
}
