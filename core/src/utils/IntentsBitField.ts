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
export const GatewayIntentBits = {
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
} as const;

/**
 * All non-privileged intents
 */
export const IntentsAll = Object.values(GatewayIntentBits).reduce((all, i) => all | i, 0);

/**
 * Privileged intents that require approval
 */
export const PrivilegedIntents = 
  GatewayIntentBits.GuildMembers | 
  GatewayIntentBits.GuildPresences | 
  GatewayIntentBits.MessageContent;

/**
 * Data structure for gateway intents
 */
export class IntentsBitField extends BitField<IntentFlagsString, number> {
  static Flags = GatewayIntentBits;
  static DefaultBit = 0;

  constructor(bits: BitFieldResolvable<IntentFlagsString, number> = 0) {
    super(bits);
  }

  /**
   * Check if any privileged intents are enabled
   */
  hasPrivileged(): boolean {
    return this.any(PrivilegedIntents);
  }

  /**
   * Get all privileged intents that are enabled
   */
  getPrivileged(): IntentFlagsString[] {
    const privileged: IntentFlagsString[] = [];
    if (this.has(GatewayIntentBits.GuildMembers)) privileged.push('GuildMembers');
    if (this.has(GatewayIntentBits.GuildPresences)) privileged.push('GuildPresences');
    if (this.has(GatewayIntentBits.MessageContent)) privileged.push('MessageContent');
    return privileged;
  }
}

/**
 * Calculate intents from an array of intent names or values
 */
export function calculateIntents(intents: (IntentFlagsString | number)[]): number {
  return intents.reduce<number>((acc, intent) => {
    if (typeof intent === 'number') return acc | intent;
    if (intent in GatewayIntentBits) return acc | GatewayIntentBits[intent as keyof typeof GatewayIntentBits];
    return acc;
  }, 0);
}

/**
 * Get all intent names from a bitfield value
 */
export function resolveIntents(bits: number): IntentFlagsString[] {
  const names: IntentFlagsString[] = [];
  for (const [name, value] of Object.entries(GatewayIntentBits)) {
    if ((bits & value) === value) {
      names.push(name as IntentFlagsString);
    }
  }
  return names;
}

export default IntentsBitField;
