/**
 * Intents BitField for calculating gateway intents
 */
import { BitField, BitFieldResolvable } from './BitField';
/**
 * Intent flag names
 */
export type IntentFlagsString = keyof typeof IntentsBitField.Flags;
/**
 * Gateway Intent Bits
 */
export declare const GatewayIntentBits: {
    readonly Guilds: number;
    readonly GuildMembers: number;
    readonly GuildModeration: number;
    readonly GuildEmojisAndStickers: number;
    readonly GuildIntegrations: number;
    readonly GuildWebhooks: number;
    readonly GuildInvites: number;
    readonly GuildVoiceStates: number;
    readonly GuildPresences: number;
    readonly GuildMessages: number;
    readonly GuildMessageReactions: number;
    readonly GuildMessageTyping: number;
    readonly DirectMessages: number;
    readonly DirectMessageReactions: number;
    readonly DirectMessageTyping: number;
    readonly MessageContent: number;
    readonly GuildScheduledEvents: number;
    readonly AutoModerationConfiguration: number;
    readonly AutoModerationExecution: number;
};
/**
 * All non-privileged intents
 */
export declare const IntentsAll: number;
/**
 * Privileged intents that require approval
 */
export declare const PrivilegedIntents: number;
/**
 * Data structure for gateway intents
 */
export declare class IntentsBitField extends BitField<IntentFlagsString, number> {
    static Flags: {
        readonly Guilds: number;
        readonly GuildMembers: number;
        readonly GuildModeration: number;
        readonly GuildEmojisAndStickers: number;
        readonly GuildIntegrations: number;
        readonly GuildWebhooks: number;
        readonly GuildInvites: number;
        readonly GuildVoiceStates: number;
        readonly GuildPresences: number;
        readonly GuildMessages: number;
        readonly GuildMessageReactions: number;
        readonly GuildMessageTyping: number;
        readonly DirectMessages: number;
        readonly DirectMessageReactions: number;
        readonly DirectMessageTyping: number;
        readonly MessageContent: number;
        readonly GuildScheduledEvents: number;
        readonly AutoModerationConfiguration: number;
        readonly AutoModerationExecution: number;
    };
    static DefaultBit: number;
    constructor(bits?: BitFieldResolvable<IntentFlagsString, number>);
    /**
     * Check if any privileged intents are enabled
     */
    hasPrivileged(): boolean;
    /**
     * Get all privileged intents that are enabled
     */
    getPrivileged(): IntentFlagsString[];
}
/**
 * Calculate intents from an array of intent names or values
 */
export declare function calculateIntents(intents: (IntentFlagsString | number)[]): number;
/**
 * Get all intent names from a bitfield value
 */
export declare function resolveIntents(bits: number): IntentFlagsString[];
export default IntentsBitField;
