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
    /** Rules channel - server rules and guidelines */
    ChannelType[ChannelType["GuildRules"] = 20] = "GuildRules";
    /** Stream channel - for live streaming */
    ChannelType[ChannelType["GuildStream"] = 21] = "GuildStream";
    ChannelType[ChannelType["GuildApp"] = 22] = "GuildApp";
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
    MessageFlags[MessageFlags["Ephemeral"] = 64] = "Ephemeral";
    MessageFlags[MessageFlags["Loading"] = 128] = "Loading";
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW51bXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvZW51bXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUE7O0dBRUc7QUFDSCxJQUFZLGlCQW9CWDtBQXBCRCxXQUFZLGlCQUFpQjtJQUMzQiw2REFBZSxDQUFBO0lBQ2YseUVBQXFCLENBQUE7SUFDckIsK0VBQXdCLENBQUE7SUFDeEIsNkZBQStCLENBQUE7SUFDL0Isb0ZBQTBCLENBQUE7SUFDMUIsNEVBQXNCLENBQUE7SUFDdEIsMEVBQXFCLENBQUE7SUFDckIsbUZBQXlCLENBQUE7SUFDekIsK0VBQXVCLENBQUE7SUFDdkIsNkVBQXNCLENBQUE7SUFDdEIsOEZBQStCLENBQUE7SUFDL0Isd0ZBQTRCLENBQUE7SUFDNUIsZ0ZBQXdCLENBQUE7SUFDeEIsZ0dBQWdDLENBQUE7SUFDaEMsMkZBQTZCLENBQUE7SUFDN0IsaUZBQXdCLENBQUE7SUFDeEIsNkZBQThCLENBQUE7SUFDOUIsNkdBQXFDLENBQUE7SUFDckMscUdBQWlDLENBQUE7QUFDbkMsQ0FBQyxFQXBCVyxpQkFBaUIsaUNBQWpCLGlCQUFpQixRQW9CNUI7QUFFRDs7R0FFRztBQUNILElBQVksY0FZWDtBQVpELFdBQVksY0FBYztJQUN4QiwyREFBWSxDQUFBO0lBQ1osNkRBQWEsQ0FBQTtJQUNiLDJEQUFZLENBQUE7SUFDWix1RUFBa0IsQ0FBQTtJQUNsQiwyRUFBb0IsQ0FBQTtJQUNwQix1REFBVSxDQUFBO0lBQ1YsNkRBQWEsQ0FBQTtJQUNiLGlGQUF1QixDQUFBO0lBQ3ZCLHVFQUFrQixDQUFBO0lBQ2xCLHNEQUFVLENBQUE7SUFDVixvRUFBaUIsQ0FBQTtBQUNuQixDQUFDLEVBWlcsY0FBYyw4QkFBZCxjQUFjLFFBWXpCO0FBRUQ7O0dBRUc7QUFDSCxJQUFZLGVBTVg7QUFORCxXQUFZLGVBQWU7SUFDekIscURBQVEsQ0FBQTtJQUNSLGlGQUFzQixDQUFBO0lBQ3RCLDZFQUFvQixDQUFBO0lBQ3BCLHlH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QUFjLEVBQUUsRUFBRSxJQUFJLEdBQUc7SUFDekIsWUFBWSxFQUFFLEVBQUUsSUFBSSxHQUFHO0lBQ3ZCLFVBQVUsRUFBRSxFQUFFLElBQUksR0FBRztJQUNyQixhQUFhLEVBQUUsRUFBRSxJQUFJLEdBQUc7SUFDeEIsZUFBZSxFQUFFLEVBQUUsSUFBSSxHQUFHO0lBQzFCLGdCQUFnQixFQUFFLEVBQUUsSUFBSSxHQUFHO0lBRTNCLG1CQUFtQjtJQUNuQixXQUFXLEVBQUUsRUFBRSxJQUFJLEdBQUc7SUFDdEIsYUFBYSxFQUFFLEVBQUUsSUFBSSxHQUFHO0lBQ3hCLGVBQWUsRUFBRSxFQUFFLElBQUksR0FBRztJQUMxQixXQUFXLEVBQUUsRUFBRSxJQUFJLEdBQUc7SUFDdEIsWUFBWSxFQUFFLEVBQUUsSUFBSSxHQUFHO0lBQ3ZCLGVBQWUsRUFBRSxFQUFFLElBQUksR0FBRztDQUNsQixDQUFDO0FBRVg7O0dBRUc7QUFDSCxJQUFZLGFBR1g7QUFIRCxXQUFZLGFBQWE7SUFDdkIsaURBQVEsQ0FBQTtJQUNSLHFEQUFVLENBQUE7QUFDWixDQUFDLEVBSFcsYUFBYSw2QkFBYixhQUFhLFFBR3hCIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIEdhdGV3YXkgSW50ZW50IEJpdHNcclxuICovXHJcbmV4cG9ydCBlbnVtIEdhdGV3YXlJbnRlbnRCaXRzIHtcclxuICBHdWlsZHMgPSAxIDw8IDAsXHJcbiAgR3VpbGRNZW1iZXJzID0gMSA8PCAxLFxyXG4gIEd1aWxkTW9kZXJhdGlvbiA9IDEgPDwgMixcclxuICBHdWlsZEVtb2ppc0FuZFN0aWNrZXJzID0gMSA8PCAzLFxyXG4gIEd1aWxkSW50ZWdyYXRpb25zID0gMSA8PCA0LFxyXG4gIEd1aWxkV2ViaG9va3MgPSAxIDw8IDUsXHJcbiAgR3VpbGRJbnZpdGVzID0gMSA8PCA2LFxyXG4gIEd1aWxkVm9pY2VTdGF0ZXMgPSAxIDw8IDcsXHJcbiAgR3VpbGRQcmVzZW5jZXMgPSAxIDw8IDgsXHJcbiAgR3VpbGRNZXNzYWdlcyA9IDEgPDwgOSxcclxuICBHdWlsZE1lc3NhZ2VSZWFjdGlvbnMgPSAxIDw8IDEwLFxyXG4gIEd1aWxkTWVzc2FnZVR5cGluZyA9IDEgPDwgMTEsXHJcbiAgRGlyZWN0TWVzc2FnZXMgPSAxIDw8IDEyLFxyXG4gIERpcmVjdE1lc3NhZ2VSZWFjdGlvbnMgPSAxIDw8IDEzLFxyXG4gIERpcmVjdE1lc3NhZ2VUeXBpbmcgPSAxIDw8IDE0LFxyXG4gIE1lc3NhZ2VDb250ZW50ID0gMSA8PCAxNSxcclxuICBHdWlsZFNjaGVkdWxlZEV2ZW50cyA9IDEgPDwgMTYsXHJcbiAgQXV0b01vZGVyYXRpb25Db25maWd1cmF0aW9uID0gMSA8PCAyMCxcclxuICBBdXRvTW9kZXJhdGlvbkV4ZWN1dGlvbiA9IDEgPDwgMjFcclxufVxyXG5cclxuLyoqXHJcbiAqIEdhdGV3YXkgT3Bjb2Rlc1xyXG4gKi9cclxuZXhwb3J0IGVudW0gR2F0ZXdheU9wY29kZXMge1xyXG4gIERpc3BhdGNoID0gMCxcclxuICBIZWFydGJlYXQgPSAxLFxyXG4gIElkZW50aWZ5ID0gMixcclxuICBQcmVzZW5jZVVwZGF0ZSA9IDMsXHJcbiAgVm9pY2VTdGF0ZVVwZGF0ZSA9IDQsXHJcbiAgUmVzdW1lID0gNixcclxuICBSZWNvbm5lY3QgPSA3LFxyXG4gIFJlcXVlc3RHdWlsZE1lbWJlcnMgPSA4LFxyXG4gIEludmFsaWRTZXNzaW9uID0gOSxcclxuICBIZWxsbyA9IDEwLFxyXG4gIEhlYXJ0YmVhdEFjayA9IDExXHJcbn1cclxuXHJcbi8qKlxyXG4gKiBJbnRlcmFjdGlvbiBUeXBlc1xyXG4gKi9cclxuZXhwb3J0IGVudW0gSW50ZXJhY3Rpb25UeXBlIHtcclxuICBQaW5nID0gMSxcclxuICBBcHBsaWNhdGlvbkNvbW1hbmQgPSAyLFxyXG4gIE1lc3NhZ2VDb21wb25lbnQgPSAzLFxyXG4gIEFwcGxpY2F0aW9uQ29tbWFuZEF1dG9jb21wbGV0ZSA9IDQsXHJcbiAgTW9kYWxTdWJtaXQgPSA1XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBcHBsaWNhdGlvbiBDb21tYW5kIFR5cGVzXHJcbiAqL1xyXG5leHBvcnQgZW51bSBBcHBsaWNhdGlvbkNvbW1hbmRUeXBlIHtcclxuICBDaGF0SW5wdXQgPSAxLFxyXG4gIFVzZXIgPSAyLFxyXG4gIE1lc3NhZ2UgPSAzXHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBcHBsaWNhdGlvbiBDb21tYW5kIE9wdGlvbiBUeXBlc1xyXG4gKi9cclxuZXhwb3J0IGVudW0gQXBwbGljYXRpb25Db21tYW5kT3B0aW9uVHlwZSB7XHJcbiAgU3ViY29tbWFuZCA9IDEsXHJcbiAgU3ViY29tbWFuZEdyb3VwID0gMixcclxuICBTdHJpbmcgPSAzLFxyXG4gIEludGVnZXIgPSA0LFxyXG4gIEJvb2xlYW4gPSA1LFxyXG4gIFVzZXIgPSA2LFxyXG4gIENoYW5uZWwgPSA3LFxyXG4gIFJvbGUgPSA4LFxyXG4gIE1lbnRpb25hYmxlID0gOSxcclxuICBOdW1iZXIgPSAxMCxcclxuICBBdHRhY2htZW50ID0gMTFcclxufVxyXG5cclxuLyoqXHJcbiAqIENoYW5uZWwgVHlwZXNcclxuICovXHJcbmV4cG9ydCBlbnVtIENoYW5uZWxUeXBlIHtcclxuICBHdWlsZFRleHQgPSAwLFxyXG4gIERNID0gMSxcclxuICBHdWlsZFZvaWNlID0gMixcclxuICBHcm91cERNID0gMyxcclxuICBHdWlsZENhdGVnb3J5ID0gNCxcclxuICBHdWlsZEFubm91bmNlbWVudCA9IDUsXHJcbiAgQW5ub3VuY2VtZW50VGhyZWFkID0gMTAsXHJcbiAgUHVibGljVGhyZWFkID0gMTEsXHJcbiAgUHJpdmF0ZVRocmVhZCA9IDEyLFxyXG4gIEd1aWxkU3RhZ2VWb2ljZSA9IDEzLFxyXG4gIEd1aWxkRGlyZWN0b3J5ID0gMTQsXHJcbiAgR3VpbGRGb3J1bSA9IDE1LFxyXG4gIC8qKiBSdWxlcyBjaGFubmVsIC0gc2VydmVyIHJ1bGVzIGFuZCBndWlkZWxpbmVzICovXHJcbiAgR3VpbGRSdWxlcyA9IDIwLFxyXG4gIC8qKiBTdHJlYW0gY2hhbm5lbCAtIGZvciBsaXZlIHN0cmVhbWluZyAqL1xyXG4gIEd1aWxkU3RyZWFtID0gMjEsXG4gIEd1aWxkQXBwID0gMjIsXG59XHJcblxyXG4vKipcclxuICogSW50ZXJhY3Rpb24gUmVzcG9uc2UgVHlwZXNcclxuICovXHJcbmV4cG9ydCBlbnVtIEludGVyYWN0aW9uUmVzcG9uc2VUeXBlIHtcclxuICBQb25nID0gMSxcclxuICBDaGFubmVsTWVzc2FnZVdpdGhTb3VyY2UgPSA0LFxyXG4gIERlZmVycmVkQ2hhbm5lbE1lc3NhZ2VXaXRoU291cmNlID0gNSxcclxuICBEZWZlcnJlZFVwZGF0ZU1lc3NhZ2UgPSA2LFxyXG4gIFVwZGF0ZU1lc3NhZ2UgPSA3LFxyXG4gIEFwcGxpY2F0aW9uQ29tbWFuZEF1dG9jb21wbGV0ZVJlc3VsdCA9IDgsXHJcbiAgTW9kYWwgPSA5XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBNZXNzYWdlIEZsYWdzXHJcbiAqL1xyXG5leHBvcnQgZW51bSBNZXNzYWdlRmxhZ3Mge1xyXG4gIENyb3NzcG9zdGVkID0gMSA8PCAwLFxyXG4gIElzQ3Jvc3Nwb3N0ID0gMSA8PCAxLFxyXG4gIFN1cHByZXNzRW1iZWRzID0gMSA8PCAyLFxyXG4gIFNvdXJjZU1lc3NhZ2VEZWxldGVkID0gMSA8PCAzLFxyXG4gIFVyZ2VudCA9IDEgPDwgNCxcclxuICBFcGhlbWVyYWwgPSAxIDw8IDYsXHJcbiAgTG9hZGluZyA9IDEgPDwgNyxcclxuICBTdXBwcmVzc05vdGlmaWNhdGlvbnMgPSAxIDw8IDEyXHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBY3Rpdml0eSBUeXBlc1xyXG4gKi9cclxuZXhwb3J0IGVudW0gQWN0aXZpdHlUeXBlIHtcclxuICBQbGF5aW5nID0gMCxcclxuICBTdHJlYW1pbmcgPSAxLFxyXG4gIExpc3RlbmluZyA9IDIsXHJcbiAgV2F0Y2hpbmcgPSAzLFxyXG4gIEN1c3RvbSA9IDQsXHJcbiAgQ29tcGV0aW5nID0gNVxyXG59XHJcblxyXG4vKipcclxuICogUHJlc2VuY2UgU3RhdHVzXHJcbiAqL1xyXG5leHBvcnQgZW51bSBQcmVzZW5jZVN0YXR1cyB7XHJcbiAgT25saW5lID0gJ29ubGluZScsXHJcbiAgSWRsZSA9ICdpZGxlJyxcclxuICBEb05vdERpc3R1cmIgPSAnZG5kJyxcclxuICBJbnZpc2libGUgPSAnaW52aXNpYmxlJyxcclxuICBPZmZsaW5lID0gJ29mZmxpbmUnXHJcbn1cclxuXHJcbi8qKlxyXG4gKiBQZXJtaXNzaW9uIEZsYWdzIEJpdHNcclxuICogVXNlZCBmb3IgY2hhbm5lbCBwZXJtaXNzaW9uIG92ZXJ3cml0ZXNcclxuICovXHJcbmV4cG9ydCBjb25zdCBQZXJtaXNzaW9uRmxhZ3NCaXRzID0ge1xyXG4gIC8vIEdlbmVyYWwgKDAtOSlcclxuICBDcmVhdGVJbnN0YW50SW52aXRlOiAxbiA8PCAwbixcclxuICBLaWNrTWVtYmVyczogMW4gPDwgMW4sXHJcbiAgQmFuTWVtYmVyczogMW4gPDwgMm4sXHJcbiAgQWRtaW5pc3RyYXRvcjogMW4gPDwgM24sXHJcbiAgTWFuYWdlQ2hhbm5lbHM6IDFuIDw8IDRuLFxyXG4gIE1hbmFnZUd1aWxkOiAxbiA8PCA1bixcclxuICBBZGRSZWFjdGlvbnM6IDFuIDw8IDZuLFxyXG4gIFZpZXdBdWRpdExvZzogMW4gPDwgN24sXHJcbiAgVmlld0d1aWxkSW5zaWdodHM6IDFuIDw8IDhuLFxyXG4gIFN0cmVhbTogMW4gPDwgOW4sXHJcbiAgVmlld0NoYW5uZWw6IDFuIDw8IDEwbixcclxuXHJcbiAgLy8gTWVzc2FnZXMgKDExLTE5KVxyXG4gIFNlbmRNZXNzYWdlczogMW4gPDwgMTFuLFxyXG4gIFNlbmRUVFNNZXNzYWdlczogMW4gPDwgMTJuLFxyXG4gIE1hbmFnZU1lc3NhZ2VzOiAxbiA8PCAxM24sXHJcbiAgRW1iZWRMaW5rczogMW4gPDwgMTRuLFxyXG4gIEF0dGFjaEZpbGVzOiAxbiA8PCAxNW4sXHJcbiAgUmVhZE1lc3NhZ2VIaXN0b3J5OiAxbiA8PCAxNm4sXHJcbiAgVXNlRXh0ZXJuYWxFbW9qaXM6IDFuIDw8IDE3bixcclxuICBVc2VTbGFzaENvbW1hbmRzOiAxbiA8PCAxOG4sXHJcbiAgTWVudGlvbkV2ZXJ5b25lOiAxbiA8PCAxOW4sXHJcblxyXG4gIC8vIFZvaWNlICgyMC0yNylcclxuICBDb25uZWN0OiAxbiA8PCAyMG4sXHJcbiAgU3BlYWs6IDFuIDw8IDIxbixcclxuICBNdXRlTWVtYmVyczogMW4gPDwgMjJuLFxyXG4gIERlYWZlbk1lbWJlcnM6IDFuIDw8IDIzbixcclxuICBNb3ZlTWVtYmVyczogMW4gPDwgMjRuLFxyXG4gIFVzZVZBRDogMW4gPDwgMjVuLFxyXG4gIENoYW5nZUNvZGVjOiAxbiA8PCAyNm4sXHJcbiAgQXVkaW9RdWFsaXR5QWRtaW46IDFuIDw8IDI3bixcclxuXHJcbiAgLy8gVmlkZW8gYW5kIFNjcmVlbiBTaGFyaW5nICgyOC0zNylcclxuICBWaWRlb0NhbGw6IDFuIDw8IDI4bixcclxuICBTaGFyZVNjcmVlbjogMW4gPDwgMjluLFxyXG4gIFNoYXJlQ2FtZXJhOiAxbiA8PCAzMG4sXHJcbiAgQ29udHJvbFF1YWxpdHk6IDFuIDw8IDMxbixcclxuICBSZXF1ZXN0VG9TcGVhazogMW4gPDwgMzJuLFxyXG4gIE1hbmFnZUV2ZW50czogMW4gPDwgMzNuLFxyXG4gIEFkZE1lbWJlcnM6IDFuIDw8IDM0bixcclxuICBSZW1vdmVNZW1iZXJzOiAxbiA8PCAzNW4sXHJcbiAgQ2hhbmdlR3JvdXBJY29uOiAxbiA8PCAzNm4sXHJcbiAgQ2hhbmdlRE1TZXR0aW5nczogMW4gPDwgMzduLFxyXG5cclxuICAvLyBBZHZhbmNlZCAoMzgtNDMpXHJcbiAgTWFuYWdlR3JvdXA6IDFuIDw8IDM4bixcclxuICBVc2VBY3Rpdml0aWVzOiAxbiA8PCAzOW4sXHJcbiAgTW9kZXJhdGVNZW1iZXJzOiAxbiA8PCA0MG4sXHJcbiAgTWFuYWdlUm9sZXM6IDFuIDw8IDQxbixcclxuICBNYW5hZ2VFbW9qaXM6IDFuIDw8IDQybixcclxuICBQcmlvcml0eVNwZWFrZXI6IDFuIDw8IDQzbixcclxufSBhcyBjb25zdDtcclxuXHJcbi8qKlxyXG4gKiBPdmVyd3JpdGUgVHlwZSAtIGZvciBwZXJtaXNzaW9uIG92ZXJ3cml0ZXNcclxuICovXHJcbmV4cG9ydCBlbnVtIE92ZXJ3cml0ZVR5cGUge1xyXG4gIFJvbGUgPSAwLFxyXG4gIE1lbWJlciA9IDEsXHJcbn1cclxuIl19