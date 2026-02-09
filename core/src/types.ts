import { GatewayIntentBits, InteractionType, ApplicationCommandType, ChannelType } from './enums';

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
 */
export interface APIUser {
  id: string;
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
  unavailable?: boolean;
}

/**
 * Channel structure
 */
export interface APIChannel {
  id: string;
  type: ChannelType;
  guild_id?: string;
  name?: string;
  topic?: string;
  position?: number;
  parent_id?: string;
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
  content: string;
  timestamp: string;
  edited_timestamp?: string;
  attachments?: APIAttachment[];
  embeds?: APIEmbed[];
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
