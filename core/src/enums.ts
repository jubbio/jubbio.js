/**
 * Gateway Intent Bits
 */
export enum GatewayIntentBits {
  Guilds = 1 << 0,
  GuildMembers = 1 << 1,
  GuildModeration = 1 << 2,
  GuildEmojisAndStickers = 1 << 3,
  GuildIntegrations = 1 << 4,
  GuildWebhooks = 1 << 5,
  GuildInvites = 1 << 6,
  GuildVoiceStates = 1 << 7,
  GuildPresences = 1 << 8,
  GuildMessages = 1 << 9,
  GuildMessageReactions = 1 << 10,
  GuildMessageTyping = 1 << 11,
  DirectMessages = 1 << 12,
  DirectMessageReactions = 1 << 13,
  DirectMessageTyping = 1 << 14,
  MessageContent = 1 << 15,
  GuildScheduledEvents = 1 << 16,
  AutoModerationConfiguration = 1 << 20,
  AutoModerationExecution = 1 << 21
}

/**
 * Gateway Opcodes
 */
export enum GatewayOpcodes {
  Dispatch = 0,
  Heartbeat = 1,
  Identify = 2,
  PresenceUpdate = 3,
  VoiceStateUpdate = 4,
  Resume = 6,
  Reconnect = 7,
  RequestGuildMembers = 8,
  InvalidSession = 9,
  Hello = 10,
  HeartbeatAck = 11
}

/**
 * Interaction Types
 */
export enum InteractionType {
  Ping = 1,
  ApplicationCommand = 2,
  MessageComponent = 3,
  ApplicationCommandAutocomplete = 4,
  ModalSubmit = 5
}

/**
 * Application Command Types
 */
export enum ApplicationCommandType {
  ChatInput = 1,
  User = 2,
  Message = 3
}

/**
 * Application Command Option Types
 */
export enum ApplicationCommandOptionType {
  Subcommand = 1,
  SubcommandGroup = 2,
  String = 3,
  Integer = 4,
  Boolean = 5,
  User = 6,
  Channel = 7,
  Role = 8,
  Mentionable = 9,
  Number = 10,
  Attachment = 11
}

/**
 * Channel Types
 */
export enum ChannelType {
  GuildText = 0,
  DM = 1,
  GuildVoice = 2,
  GroupDM = 3,
  GuildCategory = 4,
  GuildAnnouncement = 5,
  AnnouncementThread = 10,
  PublicThread = 11,
  PrivateThread = 12,
  GuildStageVoice = 13,
  GuildDirectory = 14,
  GuildForum = 15
}

/**
 * Interaction Response Types
 */
export enum InteractionResponseType {
  Pong = 1,
  ChannelMessageWithSource = 4,
  DeferredChannelMessageWithSource = 5,
  DeferredUpdateMessage = 6,
  UpdateMessage = 7,
  ApplicationCommandAutocompleteResult = 8,
  Modal = 9
}

/**
 * Message Flags
 */
export enum MessageFlags {
  Crossposted = 1 << 0,
  IsCrosspost = 1 << 1,
  SuppressEmbeds = 1 << 2,
  SourceMessageDeleted = 1 << 3,
  Urgent = 1 << 4,
  HasThread = 1 << 5,
  Ephemeral = 1 << 6,
  Loading = 1 << 7,
  FailedToMentionSomeRolesInThread = 1 << 8,
  SuppressNotifications = 1 << 12
}

/**
 * Activity Types
 */
export enum ActivityType {
  Playing = 0,
  Streaming = 1,
  Listening = 2,
  Watching = 3,
  Custom = 4,
  Competing = 5
}

/**
 * Presence Status
 */
export enum PresenceStatus {
  Online = 'online',
  Idle = 'idle',
  DoNotDisturb = 'dnd',
  Invisible = 'invisible',
  Offline = 'offline'
}

/**
 * Permission Flags Bits
 * Used for channel permission overwrites
 */
export const PermissionFlagsBits = {
  // General (0-9)
  CreateInstantInvite: 1n << 0n,
  KickMembers: 1n << 1n,
  BanMembers: 1n << 2n,
  Administrator: 1n << 3n,
  ManageChannels: 1n << 4n,
  ManageGuild: 1n << 5n,
  AddReactions: 1n << 6n,
  ViewAuditLog: 1n << 7n,
  ViewGuildInsights: 1n << 8n,
  Stream: 1n << 9n,
  ViewChannel: 1n << 10n,

  // Messages (11-19)
  SendMessages: 1n << 11n,
  SendTTSMessages: 1n << 12n,
  ManageMessages: 1n << 13n,
  EmbedLinks: 1n << 14n,
  AttachFiles: 1n << 15n,
  ReadMessageHistory: 1n << 16n,
  UseExternalEmojis: 1n << 17n,
  UseSlashCommands: 1n << 18n,
  MentionEveryone: 1n << 19n,

  // Voice (20-27)
  Connect: 1n << 20n,
  Speak: 1n << 21n,
  MuteMembers: 1n << 22n,
  DeafenMembers: 1n << 23n,
  MoveMembers: 1n << 24n,
  UseVAD: 1n << 25n,
  ChangeCodec: 1n << 26n,
  AudioQualityAdmin: 1n << 27n,

  // Video and Screen Sharing (28-37)
  VideoCall: 1n << 28n,
  ShareScreen: 1n << 29n,
  ShareCamera: 1n << 30n,
  ControlQuality: 1n << 31n,
  RequestToSpeak: 1n << 32n,
  ManageEvents: 1n << 33n,
  AddMembers: 1n << 34n,
  RemoveMembers: 1n << 35n,
  ChangeGroupIcon: 1n << 36n,
  ChangeDMSettings: 1n << 37n,

  // Advanced (38-43)
  ManageGroup: 1n << 38n,
  UseActivities: 1n << 39n,
  ModerateMembers: 1n << 40n,
  ManageRoles: 1n << 41n,
  ManageEmojis: 1n << 42n,
  PrioritySpeaker: 1n << 43n,
} as const;

/**
 * Overwrite Type - for permission overwrites
 */
export enum OverwriteType {
  Role = 0,
  Member = 1,
}
