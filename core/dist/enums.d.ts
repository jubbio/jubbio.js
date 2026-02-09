/**
 * Gateway Intent Bits
 */
export declare enum GatewayIntentBits {
    Guilds = 1,
    GuildMembers = 2,
    GuildModeration = 4,
    GuildEmojisAndStickers = 8,
    GuildIntegrations = 16,
    GuildWebhooks = 32,
    GuildInvites = 64,
    GuildVoiceStates = 128,
    GuildPresences = 256,
    GuildMessages = 512,
    GuildMessageReactions = 1024,
    GuildMessageTyping = 2048,
    DirectMessages = 4096,
    DirectMessageReactions = 8192,
    DirectMessageTyping = 16384,
    MessageContent = 32768,
    GuildScheduledEvents = 65536,
    AutoModerationConfiguration = 1048576,
    AutoModerationExecution = 2097152
}
/**
 * Gateway Opcodes
 */
export declare enum GatewayOpcodes {
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
export declare enum InteractionType {
    Ping = 1,
    ApplicationCommand = 2,
    MessageComponent = 3,
    ApplicationCommandAutocomplete = 4,
    ModalSubmit = 5
}
/**
 * Application Command Types
 */
export declare enum ApplicationCommandType {
    ChatInput = 1,
    User = 2,
    Message = 3
}
/**
 * Application Command Option Types
 */
export declare enum ApplicationCommandOptionType {
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
export declare enum ChannelType {
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
export declare enum InteractionResponseType {
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
export declare enum MessageFlags {
    Crossposted = 1,
    IsCrosspost = 2,
    SuppressEmbeds = 4,
    SourceMessageDeleted = 8,
    Urgent = 16,
    HasThread = 32,
    Ephemeral = 64,
    Loading = 128,
    FailedToMentionSomeRolesInThread = 256,
    SuppressNotifications = 4096
}
/**
 * Activity Types
 */
export declare enum ActivityType {
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
export declare enum PresenceStatus {
    Online = "online",
    Idle = "idle",
    DoNotDisturb = "dnd",
    Invisible = "invisible",
    Offline = "offline"
}
/**
 * Permission Flags Bits
 * Used for channel permission overwrites
 */
export declare const PermissionFlagsBits: {
    readonly CreateInstantInvite: bigint;
    readonly KickMembers: bigint;
    readonly BanMembers: bigint;
    readonly Administrator: bigint;
    readonly ManageChannels: bigint;
    readonly ManageGuild: bigint;
    readonly AddReactions: bigint;
    readonly ViewAuditLog: bigint;
    readonly ViewGuildInsights: bigint;
    readonly Stream: bigint;
    readonly ViewChannel: bigint;
    readonly SendMessages: bigint;
    readonly SendTTSMessages: bigint;
    readonly ManageMessages: bigint;
    readonly EmbedLinks: bigint;
    readonly AttachFiles: bigint;
    readonly ReadMessageHistory: bigint;
    readonly UseExternalEmojis: bigint;
    readonly UseSlashCommands: bigint;
    readonly MentionEveryone: bigint;
    readonly Connect: bigint;
    readonly Speak: bigint;
    readonly MuteMembers: bigint;
    readonly DeafenMembers: bigint;
    readonly MoveMembers: bigint;
    readonly UseVAD: bigint;
    readonly ChangeCodec: bigint;
    readonly AudioQualityAdmin: bigint;
    readonly VideoCall: bigint;
    readonly ShareScreen: bigint;
    readonly ShareCamera: bigint;
    readonly ControlQuality: bigint;
    readonly RequestToSpeak: bigint;
    readonly ManageEvents: bigint;
    readonly AddMembers: bigint;
    readonly RemoveMembers: bigint;
    readonly ChangeGroupIcon: bigint;
    readonly ChangeDMSettings: bigint;
    readonly ManageGroup: bigint;
    readonly UseActivities: bigint;
    readonly ModerateMembers: bigint;
    readonly ManageRoles: bigint;
    readonly ManageEmojis: bigint;
    readonly PrioritySpeaker: bigint;
};
/**
 * Overwrite Type - for permission overwrites
 */
export declare enum OverwriteType {
    Role = 0,
    Member = 1
}
