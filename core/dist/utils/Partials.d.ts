/**
 * Partials - Handle uncached/partial data structures
 */
/**
 * Partial types that can be enabled
 */
export declare enum Partials {
    User = 0,
    Channel = 1,
    GuildMember = 2,
    Message = 3,
    Reaction = 4,
    GuildScheduledEvent = 5,
    ThreadMember = 6
}
/**
 * Check if a structure is partial (missing data)
 */
export declare function isPartial(obj: any): boolean;
/**
 * Create a partial user structure
 */
export declare function createPartialUser(id: string): PartialUser;
/**
 * Create a partial channel structure
 */
export declare function createPartialChannel(id: string): PartialChannel;
/**
 * Create a partial message structure
 */
export declare function createPartialMessage(id: string, channelId: string): PartialMessage;
/**
 * Create a partial guild member structure
 */
export declare function createPartialGuildMember(userId: string, guildId: string): PartialGuildMember;
/**
 * Create a partial reaction structure
 */
export declare function createPartialReaction(messageId: string, emoji: string): PartialReaction;
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
export declare function makePartialAware<T extends {
    id: string;
}>(structure: T, client: any, fetchFn: (id: string) => Promise<T>): T & {
    partial: boolean;
    fetch: () => Promise<T>;
};
/**
 * Check if partials are enabled for a type
 */
export declare function hasPartial(client: any, partial: Partials): boolean;
export default Partials;
