"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OverwriteType = exports.PermissionFlagsBits = exports.PresenceStatus = exports.ActivityType = exports.MessageFlags = exports.InteractionResponseType = exports.ChannelType = exports.ApplicationCommandOptionType = exports.ApplicationCommandType = exports.InteractionType = exports.GatewayOpcodes = exports.GatewayIntentBits = void 0;
/**
 * Gateway Intent Bits
 */
var GatewayIntentBits;
(function (GatewayIntentBits) {
    GatewayIntentBits[GatewayIntentBits["Guilds"] = 1] = "Guilds";
    GatewayIntentBits[GatewayIntentBits["GuildMembers"] = 2] = "GuildMembers";
    GatewayIntentBits[GatewayIntentBits["GuildModeration"] = 4] = "GuildModeration";
    GatewayIntentBits[GatewayIntentBits["GuildEmojisAndStickers"] = 8] = "GuildEmojisAndStickers";
    GatewayIntentBits[GatewayIntentBits["GuildIntegrations"] = 16] = "GuildIntegrations";
    GatewayIntentBits[GatewayIntentBits["GuildWebhooks"] = 32] = "GuildWebhooks";
    GatewayIntentBits[GatewayIntentBits["GuildInvites"] = 64] = "GuildInvites";
    GatewayIntentBits[GatewayIntentBits["GuildVoiceStates"] = 128] = "GuildVoiceStates";
    GatewayIntentBits[GatewayIntentBits["GuildPresences"] = 256] = "GuildPresences";
    GatewayIntentBits[GatewayIntentBits["GuildMessages"] = 512] = "GuildMessages";
    GatewayIntentBits[GatewayIntentBits["GuildMessageReactions"] = 1024] = "GuildMessageReactions";
    GatewayIntentBits[GatewayIntentBits["GuildMessageTyping"] = 2048] = "GuildMessageTyping";
    GatewayIntentBits[GatewayIntentBits["DirectMessages"] = 4096] = "DirectMessages";
    GatewayIntentBits[GatewayIntentBits["DirectMessageReactions"] = 8192] = "DirectMessageReactions";
    GatewayIntentBits[GatewayIntentBits["DirectMessageTyping"] = 16384] = "DirectMessageTyping";
    GatewayIntentBits[GatewayIntentBits["MessageContent"] = 32768] = "MessageContent";
    GatewayIntentBits[GatewayIntentBits["GuildScheduledEvents"] = 65536] = "GuildScheduledEvents";
    GatewayIntentBits[GatewayIntentBits["AutoModerationConfiguration"] = 1048576] = "AutoModerationConfiguration";
    GatewayIntentBits[GatewayIntentBits["AutoModerationExecution"] = 2097152] = "AutoModerationExecution";
})(GatewayIntentBits || (exports.GatewayIntentBits = GatewayIntentBits = {}));
/**
 * Gateway Opcodes
 */
var GatewayOpcodes;
(function (GatewayOpcodes) {
    GatewayOpcodes[GatewayOpcodes["Dispatch"] = 0] = "Dispatch";
    GatewayOpcodes[GatewayOpcodes["Heartbeat"] = 1] = "Heartbeat";
    GatewayOpcodes[GatewayOpcodes["Identify"] = 2] = "Identify";
    GatewayOpcodes[GatewayOpcodes["PresenceUpdate"] = 3] = "PresenceUpdate";
    GatewayOpcodes[GatewayOpcodes["VoiceStateUpdate"] = 4] = "VoiceStateUpdate";
    GatewayOpcodes[GatewayOpcodes["Resume"] = 6] = "Resume";
    GatewayOpcodes[GatewayOpcodes["Reconnect"] = 7] = "Reconnect";
    GatewayOpcodes[GatewayOpcodes["RequestGuildMembers"] = 8] = "RequestGuildMembers";
    GatewayOpcodes[GatewayOpcodes["InvalidSession"] = 9] = "InvalidSession";
    GatewayOpcodes[GatewayOpcodes["Hello"] = 10] = "Hello";
    GatewayOpcodes[GatewayOpcodes["HeartbeatAck"] = 11] = "HeartbeatAck";
})(GatewayOpcodes || (exports.GatewayOpcodes = GatewayOpcodes = {}));
/**
 * Interaction Types
 */
var InteractionType;
(function (InteractionType) {
    InteractionType[InteractionType["Ping"] = 1] = "Ping";
    InteractionType[InteractionType["ApplicationCommand"] = 2] = "ApplicationCommand";
    InteractionType[InteractionType["MessageComponent"] = 3] = "MessageComponent";
    InteractionType[InteractionType["ApplicationCommandAutocomplete"] = 4] = "ApplicationCommandAutocomplete";
    InteractionType[InteractionType["ModalSubmit"] = 5] = "ModalSubmit";
})(InteractionType || (exports.InteractionType = InteractionType = {}));
/**
 * Application Command Types
 */
var ApplicationCommandType;
(function (ApplicationCommandType) {
    ApplicationCommandType[ApplicationCommandType["ChatInput"] = 1] = "ChatInput";
    ApplicationCommandType[ApplicationCommandType["User"] = 2] = "User";
    ApplicationCommandType[ApplicationCommandType["Message"] = 3] = "Message";
})(ApplicationCommandType || (exports.ApplicationCommandType = ApplicationCommandType = {}));
/**
 * Application Command Option Types
 */
var ApplicationCommandOptionType;
(function (ApplicationCommandOptionType) {
    ApplicationCommandOptionType[ApplicationCommandOptionType["Subcommand"] = 1] = "Subcommand";
    ApplicationCommandOptionType[ApplicationCommandOptionType["SubcommandGroup"] = 2] = "SubcommandGroup";
    ApplicationCommandOptionType[ApplicationCommandOptionType["String"] = 3] = "String";
    ApplicationCommandOptionType[ApplicationCommandOptionType["Integer"] = 4] = "Integer";
    ApplicationCommandOptionType[ApplicationCommandOptionType["Boolean"] = 5] = "Boolean";
    ApplicationCommandOptionType[ApplicationCommandOptionType["User"] = 6] = "User";
    ApplicationCommandOptionType[ApplicationCommandOptionType["Channel"] = 7] = "Channel";
    ApplicationCommandOptionType[ApplicationCommandOptionType["Role"] = 8] = "Role";
    ApplicationCommandOptionType[ApplicationCommandOptionType["Mentionable"] = 9] = "Mentionable";
    ApplicationCommandOptionType[ApplicationCommandOptionType["Number"] = 10] = "Number";
    ApplicationCommandOptionType[ApplicationCommandOptionType["Attachment"] = 11] = "Attachment";
})(ApplicationCommandOptionType || (exports.ApplicationCommandOptionType = ApplicationCommandOptionType = {}));
/**
 * Channel Types
 */
var ChannelType;
(function (ChannelType) {
    ChannelType[ChannelType["GuildText"] = 0] = "GuildText";
    ChannelType[ChannelType["DM"] = 1] = "DM";
    ChannelType[ChannelType["GuildVoice"] = 2] = "GuildVoice";
    ChannelType[ChannelType["GroupDM"] = 3] = "GroupDM";
    ChannelType[ChannelType["GuildCategory"] = 4] = "GuildCategory";
    ChannelType[ChannelType["GuildAnnouncement"] = 5] = "GuildAnnouncement";
    ChannelType[ChannelType["AnnouncementThread"] = 10] = "AnnouncementThread";
    ChannelType[ChannelType["PublicThread"] = 11] = "PublicThread";
    ChannelType[ChannelType["PrivateThread"] = 12] = "PrivateThread";
    ChannelType[ChannelType["GuildStageVoice"] = 13] = "GuildStageVoice";
    ChannelType[ChannelType["GuildDirectory"] = 14] = "GuildDirectory";
    ChannelType[ChannelType["GuildForum"] = 15] = "GuildForum";
})(ChannelType || (exports.ChannelType = ChannelType = {}));
/**
 * Interaction Response Types
 */
var InteractionResponseType;
(function (InteractionResponseType) {
    InteractionResponseType[InteractionResponseType["Pong"] = 1] = "Pong";
    InteractionResponseType[InteractionResponseType["ChannelMessageWithSource"] = 4] = "ChannelMessageWithSource";
    InteractionResponseType[InteractionResponseType["DeferredChannelMessageWithSource"] = 5] = "DeferredChannelMessageWithSource";
    InteractionResponseType[InteractionResponseType["DeferredUpdateMessage"] = 6] = "DeferredUpdateMessage";
    InteractionResponseType[InteractionResponseType["UpdateMessage"] = 7] = "UpdateMessage";
    InteractionResponseType[InteractionResponseType["ApplicationCommandAutocompleteResult"] = 8] = "ApplicationCommandAutocompleteResult";
    InteractionResponseType[InteractionResponseType["Modal"] = 9] = "Modal";
})(InteractionResponseType || (exports.InteractionResponseType = InteractionResponseType = {}));
/**
 * Message Flags
 */
var MessageFlags;
(function (MessageFlags) {
    MessageFlags[MessageFlags["Crossposted"] = 1] = "Crossposted";
    MessageFlags[MessageFlags["IsCrosspost"] = 2] = "IsCrosspost";
    MessageFlags[MessageFlags["SuppressEmbeds"] = 4] = "SuppressEmbeds";
    MessageFlags[MessageFlags["SourceMessageDeleted"] = 8] = "SourceMessageDeleted";
    MessageFlags[MessageFlags["Urgent"] = 16] = "Urgent";
    MessageFlags[MessageFlags["HasThread"] = 32] = "HasThread";
    MessageFlags[MessageFlags["Ephemeral"] = 64] = "Ephemeral";
    MessageFlags[MessageFlags["Loading"] = 128] = "Loading";
    MessageFlags[MessageFlags["FailedToMentionSomeRolesInThread"] = 256] = "FailedToMentionSomeRolesInThread";
    MessageFlags[MessageFlags["SuppressNotifications"] = 4096] = "SuppressNotifications";
})(MessageFlags || (exports.MessageFlags = MessageFlags = {}));
/**
 * Activity Types
 */
var ActivityType;
(function (ActivityType) {
    ActivityType[ActivityType["Playing"] = 0] = "Playing";
    ActivityType[ActivityType["Streaming"] = 1] = "Streaming";
    ActivityType[ActivityType["Listening"] = 2] = "Listening";
    ActivityType[ActivityType["Watching"] = 3] = "Watching";
    ActivityType[ActivityType["Custom"] = 4] = "Custom";
    ActivityType[ActivityType["Competing"] = 5] = "Competing";
})(ActivityType || (exports.ActivityType = ActivityType = {}));
/**
 * Presence Status
 */
var PresenceStatus;
(function (PresenceStatus) {
    PresenceStatus["Online"] = "online";
    PresenceStatus["Idle"] = "idle";
    PresenceStatus["DoNotDisturb"] = "dnd";
    PresenceStatus["Invisible"] = "invisible";
    PresenceStatus["Offline"] = "offline";
})(PresenceStatus || (exports.PresenceStatus = PresenceStatus = {}));
/**
 * Permission Flags Bits
 * Used for channel permission overwrites
 */
exports.PermissionFlagsBits = {
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
};
/**
 * Overwrite Type - for permission overwrites
 */
var OverwriteType;
(function (OverwriteType) {
    OverwriteType[OverwriteType["Role"] = 0] = "Role";
    OverwriteType[OverwriteType["Member"] = 1] = "Member";
})(OverwriteType || (exports.OverwriteType = OverwriteType = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW51bXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvZW51bXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUE7O0dBRUc7QUFDSCxJQUFZLGlCQW9CWDtBQXBCRCxXQUFZLGlCQUFpQjtJQUMzQiw2REFBZSxDQUFBO0lBQ2YseUVBQXFCLENBQUE7SUFDckIsK0VBQXdCLENBQUE7SUFDeEIsNkZBQStCLENBQUE7SUFDL0Isb0ZBQTBCLENBQUE7SUFDMUIsNEVBQXNCLENBQUE7SUFDdEIsMEVBQXFCLENBQUE7SUFDckIsbUZBQXlCLENBQUE7SUFDekIsK0VBQXVCLENBQUE7SUFDdkIsNkVBQXNCLENBQUE7SUFDdEIsOEZBQStCLENBQUE7SUFDL0Isd0ZBQTRCLENBQUE7SUFDNUIsZ0ZBQXdCLENBQUE7SUFDeEIsZ0dBQWdDLENBQUE7SUFDaEMsMkZBQTZCLENBQUE7SUFDN0IsaUZBQXdCLENBQUE7SUFDeEIsNkZBQThCLENBQUE7SUFDOUIsNkdBQXFDLENBQUE7SUFDckMscUdBQWlDLENBQUE7QUFDbkMsQ0FBQyxFQXBCVyxpQkFBaUIsaUNBQWpCLGlCQUFpQixRQW9CNUI7QUFFRDs7R0FFRztBQUNILElBQVksY0FZWDtBQVpELFdBQVksY0FBYztJQUN4QiwyREFBWSxDQUFBO0lBQ1osNkRBQWEsQ0FBQTtJQUNiLDJEQUFZLENBQUE7SUFDWix1RUFBa0IsQ0FBQTtJQUNsQiwyRUFBb0IsQ0FBQTtJQUNwQix1REFBVSxDQUFBO0lBQ1YsNkRBQWEsQ0FBQTtJQUNiLGlGQUF1QixDQUFBO0lBQ3ZCLHVFQUFrQixDQUFBO0lBQ2xCLHNEQUFVLENBQUE7SUFDVixvRUFBaUIsQ0FBQTtBQUNuQixDQUFDLEVBWlcsY0FBYyw4QkFBZCxjQUFjLFFBWXpCO0FBRUQ7O0dBRUc7QUFDSCxJQUFZLGVBTVg7QUFORCxXQUFZLGVBQWU7SUFDekIscURBQVEsQ0FBQTtJQUNSLGlGQUFzQixDQUFBO0lBQ3RCLDZFQUFvQixDQUFBO0lBQ3BCLHlH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RSxJQUFJLEdBQUc7SUFDdkIsVUFBVSxFQUFFLEVBQUUsSUFBSSxHQUFHO0lBQ3JCLGFBQWEsRUFBRSxFQUFFLElBQUksR0FBRztJQUN4QixlQUFlLEVBQUUsRUFBRSxJQUFJLEdBQUc7SUFDMUIsZ0JBQWdCLEVBQUUsRUFBRSxJQUFJLEdBQUc7SUFFM0IsbUJBQW1CO0lBQ25CLFdBQVcsRUFBRSxFQUFFLElBQUksR0FBRztJQUN0QixhQUFhLEVBQUUsRUFBRSxJQUFJLEdBQUc7SUFDeEIsZUFBZSxFQUFFLEVBQUUsSUFBSSxHQUFHO0lBQzFCLFdBQVcsRUFBRSxFQUFFLElBQUksR0FBRztJQUN0QixZQUFZLEVBQUUsRUFBRSxJQUFJLEdBQUc7SUFDdkIsZUFBZSxFQUFFLEVBQUUsSUFBSSxHQUFHO0NBQ2xCLENBQUM7QUFFWDs7R0FFRztBQUNILElBQVksYUFHWDtBQUhELFdBQVksYUFBYTtJQUN2QixpREFBUSxDQUFBO0lBQ1IscURBQVUsQ0FBQTtBQUNaLENBQUMsRUFIVyxhQUFhLDZCQUFiLGFBQWEsUUFHeEIiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogR2F0ZXdheSBJbnRlbnQgQml0c1xyXG4gKi9cclxuZXhwb3J0IGVudW0gR2F0ZXdheUludGVudEJpdHMge1xyXG4gIEd1aWxkcyA9IDEgPDwgMCxcclxuICBHdWlsZE1lbWJlcnMgPSAxIDw8IDEsXHJcbiAgR3VpbGRNb2RlcmF0aW9uID0gMSA8PCAyLFxyXG4gIEd1aWxkRW1vamlzQW5kU3RpY2tlcnMgPSAxIDw8IDMsXHJcbiAgR3VpbGRJbnRlZ3JhdGlvbnMgPSAxIDw8IDQsXHJcbiAgR3VpbGRXZWJob29rcyA9IDEgPDwgNSxcclxuICBHdWlsZEludml0ZXMgPSAxIDw8IDYsXHJcbiAgR3VpbGRWb2ljZVN0YXRlcyA9IDEgPDwgNyxcclxuICBHdWlsZFByZXNlbmNlcyA9IDEgPDwgOCxcclxuICBHdWlsZE1lc3NhZ2VzID0gMSA8PCA5LFxyXG4gIEd1aWxkTWVzc2FnZVJlYWN0aW9ucyA9IDEgPDwgMTAsXHJcbiAgR3VpbGRNZXNzYWdlVHlwaW5nID0gMSA8PCAxMSxcclxuICBEaXJlY3RNZXNzYWdlcyA9IDEgPDwgMTIsXHJcbiAgRGlyZWN0TWVzc2FnZVJlYWN0aW9ucyA9IDEgPDwgMTMsXHJcbiAgRGlyZWN0TWVzc2FnZVR5cGluZyA9IDEgPDwgMTQsXHJcbiAgTWVzc2FnZUNvbnRlbnQgPSAxIDw8IDE1LFxyXG4gIEd1aWxkU2NoZWR1bGVkRXZlbnRzID0gMSA8PCAxNixcclxuICBBdXRvTW9kZXJhdGlvbkNvbmZpZ3VyYXRpb24gPSAxIDw8IDIwLFxyXG4gIEF1dG9Nb2RlcmF0aW9uRXhlY3V0aW9uID0gMSA8PCAyMVxyXG59XHJcblxyXG4vKipcclxuICogR2F0ZXdheSBPcGNvZGVzXHJcbiAqL1xyXG5leHBvcnQgZW51bSBHYXRld2F5T3Bjb2RlcyB7XHJcbiAgRGlzcGF0Y2ggPSAwLFxyXG4gIEhlYXJ0YmVhdCA9IDEsXHJcbiAgSWRlbnRpZnkgPSAyLFxyXG4gIFByZXNlbmNlVXBkYXRlID0gMyxcclxuICBWb2ljZVN0YXRlVXBkYXRlID0gNCxcclxuICBSZXN1bWUgPSA2LFxyXG4gIFJlY29ubmVjdCA9IDcsXHJcbiAgUmVxdWVzdEd1aWxkTWVtYmVycyA9IDgsXHJcbiAgSW52YWxpZFNlc3Npb24gPSA5LFxyXG4gIEhlbGxvID0gMTAsXHJcbiAgSGVhcnRiZWF0QWNrID0gMTFcclxufVxyXG5cclxuLyoqXHJcbiAqIEludGVyYWN0aW9uIFR5cGVzXHJcbiAqL1xyXG5leHBvcnQgZW51bSBJbnRlcmFjdGlvblR5cGUge1xyXG4gIFBpbmcgPSAxLFxyXG4gIEFwcGxpY2F0aW9uQ29tbWFuZCA9IDIsXHJcbiAgTWVzc2FnZUNvbXBvbmVudCA9IDMsXHJcbiAgQXBwbGljYXRpb25Db21tYW5kQXV0b2NvbXBsZXRlID0gNCxcclxuICBNb2RhbFN1Ym1pdCA9IDVcclxufVxyXG5cclxuLyoqXHJcbiAqIEFwcGxpY2F0aW9uIENvbW1hbmQgVHlwZXNcclxuICovXHJcbmV4cG9ydCBlbnVtIEFwcGxpY2F0aW9uQ29tbWFuZFR5cGUge1xyXG4gIENoYXRJbnB1dCA9IDEsXHJcbiAgVXNlciA9IDIsXHJcbiAgTWVzc2FnZSA9IDNcclxufVxyXG5cclxuLyoqXHJcbiAqIEFwcGxpY2F0aW9uIENvbW1hbmQgT3B0aW9uIFR5cGVzXHJcbiAqL1xyXG5leHBvcnQgZW51bSBBcHBsaWNhdGlvbkNvbW1hbmRPcHRpb25UeXBlIHtcclxuICBTdWJjb21tYW5kID0gMSxcclxuICBTdWJjb21tYW5kR3JvdXAgPSAyLFxyXG4gIFN0cmluZyA9IDMsXHJcbiAgSW50ZWdlciA9IDQsXHJcbiAgQm9vbGVhbiA9IDUsXHJcbiAgVXNlciA9IDYsXHJcbiAgQ2hhbm5lbCA9IDcsXHJcbiAgUm9sZSA9IDgsXHJcbiAgTWVudGlvbmFibGUgPSA5LFxyXG4gIE51bWJlciA9IDEwLFxyXG4gIEF0dGFjaG1lbnQgPSAxMVxyXG59XHJcblxyXG4vKipcclxuICogQ2hhbm5lbCBUeXBlc1xyXG4gKi9cclxuZXhwb3J0IGVudW0gQ2hhbm5lbFR5cGUge1xyXG4gIEd1aWxkVGV4dCA9IDAsXHJcbiAgRE0gPSAxLFxyXG4gIEd1aWxkVm9pY2UgPSAyLFxyXG4gIEdyb3VwRE0gPSAzLFxyXG4gIEd1aWxkQ2F0ZWdvcnkgPSA0LFxyXG4gIEd1aWxkQW5ub3VuY2VtZW50ID0gNSxcclxuICBBbm5vdW5jZW1lbnRUaHJlYWQgPSAxMCxcclxuICBQdWJsaWNUaHJlYWQgPSAxMSxcclxuICBQcml2YXRlVGhyZWFkID0gMTIsXHJcbiAgR3VpbGRTdGFnZVZvaWNlID0gMTMsXHJcbiAgR3VpbGREaXJlY3RvcnkgPSAxNCxcclxuICBHdWlsZEZvcnVtID0gMTVcclxufVxyXG5cclxuLyoqXHJcbiAqIEludGVyYWN0aW9uIFJlc3BvbnNlIFR5cGVzXHJcbiAqL1xyXG5leHBvcnQgZW51bSBJbnRlcmFjdGlvblJlc3BvbnNlVHlwZSB7XHJcbiAgUG9uZyA9IDEsXHJcbiAgQ2hhbm5lbE1lc3NhZ2VXaXRoU291cmNlID0gNCxcclxuICBEZWZlcnJlZENoYW5uZWxNZXNzYWdlV2l0aFNvdXJjZSA9IDUsXHJcbiAgRGVmZXJyZWRVcGRhdGVNZXNzYWdlID0gNixcclxuICBVcGRhdGVNZXNzYWdlID0gNyxcclxuICBBcHBsaWNhdGlvbkNvbW1hbmRBdXRvY29tcGxldGVSZXN1bHQgPSA4LFxyXG4gIE1vZGFsID0gOVxyXG59XHJcblxyXG4vKipcclxuICogTWVzc2FnZSBGbGFnc1xyXG4gKi9cclxuZXhwb3J0IGVudW0gTWVzc2FnZUZsYWdzIHtcclxuICBDcm9zc3Bvc3RlZCA9IDEgPDwgMCxcclxuICBJc0Nyb3NzcG9zdCA9IDEgPDwgMSxcclxuICBTdXBwcmVzc0VtYmVkcyA9IDEgPDwgMixcclxuICBTb3VyY2VNZXNzYWdlRGVsZXRlZCA9IDEgPDwgMyxcclxuICBVcmdlbnQgPSAxIDw8IDQsXHJcbiAgSGFzVGhyZWFkID0gMSA8PCA1LFxyXG4gIEVwaGVtZXJhbCA9IDEgPDwgNixcclxuICBMb2FkaW5nID0gMSA8PCA3LFxyXG4gIEZhaWxlZFRvTWVudGlvblNvbWVSb2xlc0luVGhyZWFkID0gMSA8PCA4LFxyXG4gIFN1cHByZXNzTm90aWZpY2F0aW9ucyA9IDEgPDwgMTJcclxufVxyXG5cclxuLyoqXHJcbiAqIEFjdGl2aXR5IFR5cGVzXHJcbiAqL1xyXG5leHBvcnQgZW51bSBBY3Rpdml0eVR5cGUge1xyXG4gIFBsYXlpbmcgPSAwLFxyXG4gIFN0cmVhbWluZyA9IDEsXHJcbiAgTGlzdGVuaW5nID0gMixcclxuICBXYXRjaGluZyA9IDMsXHJcbiAgQ3VzdG9tID0gNCxcclxuICBDb21wZXRpbmcgPSA1XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBQcmVzZW5jZSBTdGF0dXNcclxuICovXHJcbmV4cG9ydCBlbnVtIFByZXNlbmNlU3RhdHVzIHtcclxuICBPbmxpbmUgPSAnb25saW5lJyxcclxuICBJZGxlID0gJ2lkbGUnLFxyXG4gIERvTm90RGlzdHVyYiA9ICdkbmQnLFxyXG4gIEludmlzaWJsZSA9ICdpbnZpc2libGUnLFxyXG4gIE9mZmxpbmUgPSAnb2ZmbGluZSdcclxufVxyXG5cclxuLyoqXHJcbiAqIFBlcm1pc3Npb24gRmxhZ3MgQml0c1xyXG4gKiBVc2VkIGZvciBjaGFubmVsIHBlcm1pc3Npb24gb3ZlcndyaXRlc1xyXG4gKi9cclxuZXhwb3J0IGNvbnN0IFBlcm1pc3Npb25GbGFnc0JpdHMgPSB7XHJcbiAgLy8gR2VuZXJhbCAoMC05KVxyXG4gIENyZWF0ZUluc3RhbnRJbnZpdGU6IDFuIDw8IDBuLFxyXG4gIEtpY2tNZW1iZXJzOiAxbiA8PCAxbixcclxuICBCYW5NZW1iZXJzOiAxbiA8PCAybixcclxuICBBZG1pbmlzdHJhdG9yOiAxbiA8PCAzbixcclxuICBNYW5hZ2VDaGFubmVsczogMW4gPDwgNG4sXHJcbiAgTWFuYWdlR3VpbGQ6IDFuIDw8IDVuLFxyXG4gIEFkZFJlYWN0aW9uczogMW4gPDwgNm4sXHJcbiAgVmlld0F1ZGl0TG9nOiAxbiA8PCA3bixcclxuICBWaWV3R3VpbGRJbnNpZ2h0czogMW4gPDwgOG4sXHJcbiAgU3RyZWFtOiAxbiA8PCA5bixcclxuICBWaWV3Q2hhbm5lbDogMW4gPDwgMTBuLFxyXG5cclxuICAvLyBNZXNzYWdlcyAoMTEtMTkpXHJcbiAgU2VuZE1lc3NhZ2VzOiAxbiA8PCAxMW4sXHJcbiAgU2VuZFRUU01lc3NhZ2VzOiAxbiA8PCAxMm4sXHJcbiAgTWFuYWdlTWVzc2FnZXM6IDFuIDw8IDEzbixcclxuICBFbWJlZExpbmtzOiAxbiA8PCAxNG4sXHJcbiAgQXR0YWNoRmlsZXM6IDFuIDw8IDE1bixcclxuICBSZWFkTWVzc2FnZUhpc3Rvcnk6IDFuIDw8IDE2bixcclxuICBVc2VFeHRlcm5hbEVtb2ppczogMW4gPDwgMTduLFxyXG4gIFVzZVNsYXNoQ29tbWFuZHM6IDFuIDw8IDE4bixcclxuICBNZW50aW9uRXZlcnlvbmU6IDFuIDw8IDE5bixcclxuXHJcbiAgLy8gVm9pY2UgKDIwLTI3KVxyXG4gIENvbm5lY3Q6IDFuIDw8IDIwbixcclxuICBTcGVhazogMW4gPDwgMjFuLFxyXG4gIE11dGVNZW1iZXJzOiAxbiA8PCAyMm4sXHJcbiAgRGVhZmVuTWVtYmVyczogMW4gPDwgMjNuLFxyXG4gIE1vdmVNZW1iZXJzOiAxbiA8PCAyNG4sXHJcbiAgVXNlVkFEOiAxbiA8PCAyNW4sXHJcbiAgQ2hhbmdlQ29kZWM6IDFuIDw8IDI2bixcclxuICBBdWRpb1F1YWxpdHlBZG1pbjogMW4gPDwgMjduLFxyXG5cclxuICAvLyBWaWRlbyBhbmQgU2NyZWVuIFNoYXJpbmcgKDI4LTM3KVxyXG4gIFZpZGVvQ2FsbDogMW4gPDwgMjhuLFxyXG4gIFNoYXJlU2NyZWVuOiAxbiA8PCAyOW4sXHJcbiAgU2hhcmVDYW1lcmE6IDFuIDw8IDMwbixcclxuICBDb250cm9sUXVhbGl0eTogMW4gPDwgMzFuLFxyXG4gIFJlcXVlc3RUb1NwZWFrOiAxbiA8PCAzMm4sXHJcbiAgTWFuYWdlRXZlbnRzOiAxbiA8PCAzM24sXHJcbiAgQWRkTWVtYmVyczogMW4gPDwgMzRuLFxyXG4gIFJlbW92ZU1lbWJlcnM6IDFuIDw8IDM1bixcclxuICBDaGFuZ2VHcm91cEljb246IDFuIDw8IDM2bixcclxuICBDaGFuZ2VETVNldHRpbmdzOiAxbiA8PCAzN24sXHJcblxyXG4gIC8vIEFkdmFuY2VkICgzOC00MylcclxuICBNYW5hZ2VHcm91cDogMW4gPDwgMzhuLFxyXG4gIFVzZUFjdGl2aXRpZXM6IDFuIDw8IDM5bixcclxuICBNb2RlcmF0ZU1lbWJlcnM6IDFuIDw8IDQwbixcclxuICBNYW5hZ2VSb2xlczogMW4gPDwgNDFuLFxyXG4gIE1hbmFnZUVtb2ppczogMW4gPDwgNDJuLFxyXG4gIFByaW9yaXR5U3BlYWtlcjogMW4gPDwgNDNuLFxyXG59IGFzIGNvbnN0O1xyXG5cclxuLyoqXHJcbiAqIE92ZXJ3cml0ZSBUeXBlIC0gZm9yIHBlcm1pc3Npb24gb3ZlcndyaXRlc1xyXG4gKi9cclxuZXhwb3J0IGVudW0gT3ZlcndyaXRlVHlwZSB7XHJcbiAgUm9sZSA9IDAsXHJcbiAgTWVtYmVyID0gMSxcclxufVxyXG4iXX0=