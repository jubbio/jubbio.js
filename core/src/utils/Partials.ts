/**
 * Partials - Handle uncached/partial data structures
 */

/**
 * Partial types that can be enabled
 */
export enum Partials {
  User = 0,
  Channel = 1,
  GuildMember = 2,
  Message = 3,
  Reaction = 4,
  GuildScheduledEvent = 5,
  ThreadMember = 6,
}

/**
 * Check if a structure is partial (missing data)
 */
export function isPartial(obj: any): boolean {
  return obj?.partial === true;
}

/**
 * Create a partial user structure
 */
export function createPartialUser(id: string): PartialUser {
  return {
    id,
    partial: true,
    username: null,
    discriminator: null,
    avatar: null,
    bot: null,
    
    async fetch() {
      throw new Error('Cannot fetch partial user without client context');
    },
    
    toString() {
      return `<@${id}>`;
    },
  };
}

/**
 * Create a partial channel structure
 */
export function createPartialChannel(id: string): PartialChannel {
  return {
    id,
    partial: true,
    type: null,
    name: null,
    
    async fetch() {
      throw new Error('Cannot fetch partial channel without client context');
    },
    
    toString() {
      return `<#${id}>`;
    },
  };
}

/**
 * Create a partial message structure
 */
export function createPartialMessage(id: string, channelId: string): PartialMessage {
  return {
    id,
    channelId,
    partial: true,
    content: null,
    author: null,
    embeds: null,
    attachments: null,
    
    async fetch() {
      throw new Error('Cannot fetch partial message without client context');
    },
    
    toString() {
      return `Message(${id})`;
    },
  };
}

/**
 * Create a partial guild member structure
 */
export function createPartialGuildMember(userId: string, guildId: string): PartialGuildMember {
  return {
    id: userId,
    guildId,
    partial: true,
    user: null,
    nick: null,
    roles: null,
    joinedAt: null,
    
    async fetch() {
      throw new Error('Cannot fetch partial member without client context');
    },
    
    toString() {
      return `<@${userId}>`;
    },
  };
}

/**
 * Create a partial reaction structure
 */
export function createPartialReaction(messageId: string, emoji: string): PartialReaction {
  return {
    messageId,
    emoji,
    partial: true,
    count: null,
    me: null,
    
    async fetch() {
      throw new Error('Cannot fetch partial reaction without client context');
    },
    
    toString() {
      return emoji;
    },
  };
}

/**
 * Partial structure types
 */
export interface PartialUser {
  id: string;
  partial: true;
  username: string | null;
  discriminator: string | null;
  avatar: string | null;
  bot: boolean | null;
  fetch(): Promise<any>;
  toString(): string;
}

export interface PartialChannel {
  id: string;
  partial: true;
  type: number | null;
  name: string | null;
  fetch(): Promise<any>;
  toString(): string;
}

export interface PartialMessage {
  id: string;
  channelId: string;
  partial: true;
  content: string | null;
  author: any | null;
  embeds: any[] | null;
  attachments: any[] | null;
  fetch(): Promise<any>;
  toString(): string;
}

export interface PartialGuildMember {
  id: string;
  guildId: string;
  partial: true;
  user: any | null;
  nick: string | null;
  roles: string[] | null;
  joinedAt: Date | null;
  fetch(): Promise<any>;
  toString(): string;
}

export interface PartialReaction {
  messageId: string;
  emoji: string;
  partial: true;
  count: number | null;
  me: boolean | null;
  fetch(): Promise<any>;
  toString(): string;
}

/**
 * Make a structure partial-aware with fetch capability
 */
export function makePartialAware<T extends { id: string }>(
  structure: T,
  client: any,
  fetchFn: (id: string) => Promise<T>
): T & { partial: boolean; fetch: () => Promise<T> } {
  return {
    ...structure,
    partial: false,
    async fetch() {
      const fetched = await fetchFn(structure.id);
      Object.assign(this, fetched, { partial: false });
      return this as T;
    },
  };
}

/**
 * Check if partials are enabled for a type
 */
export function hasPartial(client: any, partial: Partials): boolean {
  return client.options?.partials?.includes(partial) ?? false;
}

export default Partials;
