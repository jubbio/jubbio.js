/**
 * @jubbio/core - Bot library for Jubbio
 */

// Core
export { Client, GatewayIntentBits } from './Client';
export * from './types';
export * from './enums';

// REST
export { REST, type MentionsData, type MentionUser, type MentionRole } from './rest/REST';

// Structures
export { Collection } from './structures/Collection';
export { User } from './structures/User';
export { Guild } from './structures/Guild';
export { GuildMember } from './structures/GuildMember';
export { Message, type MessageMentions } from './structures/Message';
export { 
  Interaction, 
  CommandInteraction, 
  ButtonInteraction, 
  SelectMenuInteraction,
  AutocompleteInteraction,
  ModalSubmitInteraction,
  CommandInteractionOptions,
  createInteraction,
  type InteractionReplyOptions,
  type AutocompleteChoice,
  type ModalData,
} from './structures/Interaction';
export { 
  BaseChannel, 
  TextChannel, 
  VoiceChannel, 
  DMChannel,
  createChannel,
  type MessageCreateOptions,
} from './structures/Channel';

// Collectors (from utils - more comprehensive)
export {
  Collector,
  MessageCollector,
  InteractionCollector,
  ReactionCollector,
  awaitMessages,
  awaitReactions,
  type CollectorOptions,
  type MessageCollectorOptions,
  type InteractionCollectorOptions,
  type ReactionCollectorOptions,
} from './utils/Collector';

// Builders
export { 
  EmbedBuilder, 
  Colors,
  type APIEmbed,
  type APIEmbedField,
  type APIEmbedAuthor,
  type APIEmbedFooter,
  type APIEmbedImage,
  type APIEmbedThumbnail,
} from './builders/EmbedBuilder';

export { 
  ButtonBuilder, 
  ButtonStyle,
  type APIButtonComponent,
} from './builders/ButtonBuilder';

export { 
  StringSelectMenuBuilder, 
  SelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type APISelectMenuOption,
  type APISelectMenuComponent,
} from './builders/SelectMenuBuilder';

export { 
  ActionRowBuilder,
  type APIActionRow,
  type APIActionRowComponent,
} from './builders/ActionRowBuilder';

export { 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle,
  type APITextInputComponent,
  type APIModalActionRow,
  type APIModal,
} from './builders/ModalBuilder';

export { 
  SlashCommandBuilder,
  SlashCommandStringOption,
  SlashCommandIntegerOption,
  SlashCommandNumberOption,
  SlashCommandBooleanOption,
  SlashCommandUserOption,
  SlashCommandChannelOption,
  SlashCommandRoleOption,
  SlashCommandMentionableOption,
  SlashCommandAttachmentOption,
  ApplicationCommandOptionType as SlashCommandOptionType,
} from './builders/SlashCommandBuilder';

// Utils - Formatters
export { 
  Formatters,
  userMention,
  channelMention,
  roleMention,
  formatEmoji,
  bold,
  italic,
  underline,
  strikethrough,
  spoiler,
  inlineCode,
  codeBlock,
  blockQuote,
  quote,
  hyperlink,
  hideLinkEmbed,
  time,
  heading,
  unorderedList,
  orderedList,
  TimestampStyles,
} from './utils/Formatters';

// Utils - BitFields
export { BitField, type BitFieldResolvable } from './utils/BitField';
export { 
  PermissionsBitField, 
  type PermissionString, 
  type PermissionResolvable 
} from './utils/PermissionsBitField';

// Sharding
export {
  ShardingManager,
  Shard,
  ShardClientUtil,
  ShardStatus,
  type ShardingManagerOptions,
} from './sharding/ShardingManager';
