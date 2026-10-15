import { GatewayIntentBits, InteractionType, ApplicationCommandType, ChannelType } from './enums';

/**
 * Snowflake type alias for Discord-style string IDs
 */
export type Snowflake = string;

/**
 * Client options
 */
export interface ClientOptions {
  /** Gateway intents */
  intents: GatewayIntentBits[] | number;
  /** Shard configuration [shard_id, num_shards] */
  shards?: [number, number];
  /** Gateway URL override */
  gatewayUrl?: string;
  /** API URL override */
  apiUrl?: string;
}

/**
 * User structure
 * Note: Backend may return id as number, SDK normalizes to string
 */
export interface APIUser {
  id: string | number;
  username: string;
  display_name?: string;
  avatar_url?: string;
  bot?: boolean;
}

/**
 * Guild structure
 */
export interface APIGuild {
  id: string;
  name: string;
  icon?: string;
  owner_id: string;
  member_count?: number;
  online_count?: number;
  unavailable?: boolean;
  channels?: APIChannel[];
}

/**
 * Channel structure
 */
export interface APIChannel {
  app_installation_id?: string;
  app_version?: string;
  id: string;
  type: ChannelType;
  guild_id?: string;
  name?: string;
  topic?: string;
  position?: number;
  parent_id?: string;
  /** Slowmode delay in seconds */
  slowmode_seconds?: number;
  /** User limit for voice channels (0 = unlimited) */
  user_limit?: number;
}

/**
 * Message structure
 */
export interface APIMessage {
  id: string;
  channel_id: string;
  guild_id?: string;
  author: APIUser;
  user_id?: number; // Backend sends user_id separately from author
  content: string | null;
  timestamp: string;
  edited_timestamp?: string;
  attachments?: APIAttachment[];
  embeds?: APIEmbed[];
  /** Webhook ID if message was sent via webhook */
  webhook_id?: string;
  /** Application ID for bot messages (needed for component interactions) */
  application_id?: string;
  /** Nonce for message deduplication */
  nonce?: string;
  /** Forwarded message info */
  forwarded_from?: APIForwardedFrom;
}

/**
 * Attachment structure
 */
export interface APIAttachment {
  id: string;
  filename: string;
  size: number;
  url: string;
  proxy_url?: string;
  content_type?: string;
}

/**
 * Embed structure
 */
export interface APIEmbed {
  title?: string;
  description?: string;
  url?: string;
  timestamp?: string;
  color?: number;
  footer?: { text: string; icon_url?: string };
  image?: { url: string };
  thumbnail?: { url: string };
  author?: { name: string; url?: string; icon_url?: string };
  fields?: { name: string; value: string; inline?: boolean }[];
}

/**
 * Interaction structure
 */
export interface APIInteraction {
  id: string;
  application_id: string;
  type: InteractionType;
  data?: APIInteractionData;
  guild_id?: string;
  channel_id?: string;
  member?: APIGuildMember;
  user?: APIUser;
  token: string;
  version: number;
  message?: APIMessage;
}

/**
 * Interaction data
 */
export interface APIInteractionData {
  id?: string;
  name?: string;
  type?: ApplicationCommandType;
  options?: APIInteractionOption[];
  custom_id?: string;
  component_type?: number;
  values?: string[];
  target_id?: string;
  resolved?: APIInteractionResolved;
}

/**
 * Interaction option
 */
export interface APIInteractionOption {
  name: string;
  type: number;
  value?: string | number | boolean;
  options?: APIInteractionOption[];
  focused?: boolean;
}

/**
 * Interaction resolved data
 */
export interface APIInteractionResolved {
  users?: Record<string, APIUser>;
  members?: Record<string, APIGuildMember>;
  roles?: Record<string, APIRole>;
  channels?: Record<string, APIChannel>;
  messages?: Record<string, APIMessage>;
  attachments?: Record<string, APIAttachment>;
}

/**
 * Guild member structure
 */
export interface APIGuildMember {
  user?: APIUser;
  nick?: string;
  avatar?: string;
  roles: string[];
  joined_at: string;
  deaf?: boolean;
  mute?: boolean;
  permissions?: string;
  voice?: {
    channel_id?: string;
    self_mute?: boolean;
    self_deaf?: boolean;
  };
}

/**
 * Role structure
 */
export interface APIRole {
  id: string;
  name: string;
  color: number;
  position: number;
  permissions: string;
  mentionable: boolean;
}

/**
 * Voice state structure
 */
export interface APIVoiceState {
  guild_id?: string;
  channel_id?: string;
  user_id: string;
  session_id?: string;
  self_mute: boolean;
  self_deaf: boolean;
  mute?: boolean;
  deaf?: boolean;
}

/**
 * Voice server update
 */
export interface APIVoiceServerUpdate {
  token: string;
  guild_id: string;
  endpoint: string;
  room?: string;
}

/**
 * Application command structure
 */
export interface APIApplicationCommand {
  name: string;
  description: string;
  type?: ApplicationCommandType;
  options?: APIApplicationCommandOption[];
  default_permission?: boolean;
}

/**
 * Application command option
 */
export interface APIApplicationCommandOption {
  name: string;
  description: string;
  type: number;
  required?: boolean;
  choices?: { name: string; value: string | number }[];
  options?: APIApplicationCommandOption[];
  autocomplete?: boolean;
  min_value?: number;
  max_value?: number;
  min_length?: number;
  max_length?: number;
}

/**
 * Gateway payload
 */
export interface GatewayPayload {
  op: number;
  d?: any;
  s?: number;
  t?: string;
}

/**
 * Ready event data
 */
export interface ReadyEventData {
  v: number;
  user: APIUser;
  guilds: APIGuild[];
  session_id: string;
  shard?: [number, number];
  application: { id: string };
}

// ==================== API Response Types ====================

/**
 * API response for guild data (fresh from API, not cached)
 */
export interface APIGuildData {
  id: string;
  name: string;
  icon?: string;
  owner_id: string;
  member_count?: number;
  online_count?: number;
}

/**
 * API response for ban data
 */
export interface APIBan {
  user: APIUser;
  reason?: string;
}

/**
 * API response for invite data
 */
export interface APIInvite {
  code: string;
  channel_id?: string;
  guild_id?: string;
  uses?: number;
  max_uses?: number;
  max_age?: number;
  temporary?: boolean;
  inviter?: APIUser;
}

/**
 * API response for member data (extends APIGuildMember)
 */
export interface APIMemberData extends APIGuildMember {}

/**
 * API response for role data (extends APIRole)
 */
export interface APIRoleData extends APIRole {}

/**
 * API response for emoji data
 */
export interface APIEmoji {
  id: string;
  name: string;
  animated?: boolean;
  available?: boolean;
  roles?: string[];
  user?: APIUser;
  require_colons?: boolean;
  managed?: boolean;
}

/**
 * API response for webhook data
 */
export interface APIWebhook {
  id: string;
  type: number;
  guild_id?: string;
  channel_id?: string;
  user?: APIUser;
  name?: string;
  avatar_url?: string;
  token?: string;
  url?: string;
}

/**
 * Component types for REST methods
 */
export type AnyComponent = { type: number; [key: string]: unknown };

/**
 * Action row component type
 */
export type AnyActionRow = { type: 1; components: AnyComponent[] };

/**
 * Paginated response with members
 */
export interface APIMembersResponse {
  members: APIMemberData[];
  page_info: {
    cursor?: string;
    has_more?: boolean;
  };
}

/**
 * Forwarded message information
 */
export interface APIForwardedFrom {
  message_id: string;
  channel_id: string;
  guild_id?: string;
  author?: APIUser;
}

/**
 * Audit log entry
 */
export interface APIAuditLogEntry {
  id: string;
  action_type: number;
  user_id?: string;
  target_id?: string;
  changes?: Array<{
    key: string;
    old_value?: unknown;
    new_value?: unknown;
  }>;
  options?: Record<string, unknown>;
  reason?: string;
}

/**
 * Audit log response
 */
export interface APIAuditLog {
  audit_log_entries: APIAuditLogEntry[];
  users?: APIUser[];
}

// ==================== Reaction Event Types ====================

/**
 * Reaction add event data from gateway
 * Emitted when a user adds a reaction to a message
 */
export interface APIReactionAddEvent {
  /** The message ID that was reacted to */
  message_id: string;
  /** The user ID who added the reaction */
  user_id: number | string;
  /** The emoji used (unicode, :name:, or <:name:id>) */
  emoji: string;
  /** The channel ID containing the message */
  channel_id: string;
  /** The guild ID (if in a guild) */
  guild_id?: string;
}

/**
 * Reaction remove event data from gateway
 * Emitted when a user removes a reaction from a message
 */
export interface APIReactionRemoveEvent {
  /** The message ID that had the reaction removed */
  message_id: string;
  /** The user ID who removed the reaction */
  user_id: number | string;
  /** The emoji that was removed */
  emoji: string;
  /** The channel ID containing the message */
  channel_id: string;
  /** The guild ID (if in a guild) */
  guild_id?: string;
}

/**
 * Reaction remove all event data from gateway
 * Emitted when all reactions are removed from a message
 */
export interface APIReactionRemoveAllEvent {
  /** The message ID that had all reactions removed */
  message_id: string;
  /** The channel ID containing the message */
  channel_id: string;
  /** The guild ID (if in a guild) */
  guild_id?: string;
  /** Optional: specific emoji if only one emoji's reactions were removed */
  emoji?: string;
}
