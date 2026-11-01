"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OverwriteType = exports.PermissionFlagsBits = exports.PresenceStatus = exports.ActivityType = exports.SeparatorSpacingSize = exports.ComponentType = exports.MessageFlags = exports.InteractionResponseType = exports.ChannelType = exports.ApplicationCommandOptionType = exports.ApplicationCommandType = exports.InteractionType = exports.GatewayOpcodes = exports.GatewayIntentBits = void 0;
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
    MessageFlags[MessageFlags["IsComponentsV2"] = 32768] = "IsComponentsV2";
})(MessageFlags || (exports.MessageFlags = MessageFlags = {}));
/** Message component wire types. */
var ComponentType;
(function (ComponentType) {
    ComponentType[ComponentType["ActionRow"] = 1] = "ActionRow";
    ComponentType[ComponentType["Button"] = 2] = "Button";
    ComponentType[ComponentType["StringSelect"] = 3] = "StringSelect";
    ComponentType[ComponentType["TextInput"] = 4] = "TextInput";
    ComponentType[ComponentType["UserSelect"] = 5] = "UserSelect";
    ComponentType[ComponentType["RoleSelect"] = 6] = "RoleSelect";
    ComponentType[ComponentType["MentionableSelect"] = 7] = "MentionableSelect";
    ComponentType[ComponentType["ChannelSelect"] = 8] = "ChannelSelect";
    ComponentType[ComponentType["Section"] = 9] = "Section";
    ComponentType[ComponentType["TextDisplay"] = 10] = "TextDisplay";
    ComponentType[ComponentType["Thumbnail"] = 11] = "Thumbnail";
    ComponentType[ComponentType["MediaGallery"] = 12] = "MediaGallery";
    ComponentType[ComponentType["File"] = 13] = "File";
    ComponentType[ComponentType["Separator"] = 14] = "Separator";
    ComponentType[ComponentType["Container"] = 17] = "Container";
})(ComponentType || (exports.ComponentType = ComponentType = {}));
var SeparatorSpacingSize;
(function (SeparatorSpacingSize) {
    SeparatorSpacingSize[SeparatorSpacingSize["Small"] = 1] = "Small";
    SeparatorSpacingSize[SeparatorSpacingSize["Large"] = 2] = "Large";
})(SeparatorSpacingSize || (exports.SeparatorSpacingSize = SeparatorSpacingSize = {}));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW51bXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvZW51bXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUE7O0dBRUc7QUFDSCxJQUFZLGlCQW9CWDtBQXBCRCxXQUFZLGlCQUFpQjtJQUMzQiw2REFBZSxDQUFBO0lBQ2YseUVBQXFCLENBQUE7SUFDckIsK0VBQXdCLENBQUE7SUFDeEIsNkZBQStCLENBQUE7SUFDL0Isb0ZBQTBCLENBQUE7SUFDMUIsNEVBQXNCLENBQUE7SUFDdEIsMEVBQXFCLENBQUE7SUFDckIsbUZBQXlCLENBQUE7SUFDekIsK0VBQXVCLENBQUE7SUFDdkIsNkVBQXNCLENBQUE7SUFDdEIsOEZBQStCLENBQUE7SUFDL0Isd0ZBQTRCLENBQUE7SUFDNUIsZ0ZBQXdCLENBQUE7SUFDeEIsZ0dBQWdDLENBQUE7SUFDaEMsMkZBQTZCLENBQUE7SUFDN0IsaUZBQXdCLENBQUE7SUFDeEIsNkZBQThCLENBQUE7SUFDOUIsNkdBQXFDLENBQUE7SUFDckMscUdBQWlDLENBQUE7QUFDbkMsQ0FBQyxFQXBCVyxpQkFBaUIsaUNBQWpCLGlCQUFpQixRQW9CNUI7QUFFRDs7R0FFRztBQUNILElBQVksY0FZWDtBQVpELFdBQVksY0FBYztJQUN4QiwyREFBWSxDQUFBO0lBQ1osNkRBQWEsQ0FBQTtJQUNiLDJEQUFZLENBQUE7SUFDWix1RUFBa0IsQ0FBQTtJQUNsQiwyRUFBb0IsQ0FBQTtJQUNwQix1REFBVSxDQUFBO0lBQ1YsNkRBQWEsQ0FBQTtJQUNiLGlGQUF1QixDQUFBO0lBQ3ZCLHVFQUFrQixDQUFBO0lBQ2xCLHNEQUFVLENBQUE7SUFDVixvRUFBaUIsQ0FBQTtBQUNuQixDQUFDLEVBWlcsY0FBYyw4QkFBZCxjQUFjLFFBWXpCO0FBRUQ7O0dBRUc7QUFDSCxJQUFZLGVBTVg7QUFORCxXQUFZLGVBQWU7SUFDekIscURBQVEsQ0FBQTtJQUNSLGlGQUFzQixDQUFBO0lBQ3RCLDZFQUFvQixDQUFBO0lBQ3BCLHlH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QVEsQ0FBQTtJQUNSLHFEQUFVLENBQUE7QUFDWixDQUFDLEVBSFcsYUFBYSw2QkFBYixhQUFhLFFBR3hCIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIEdhdGV3YXkgSW50ZW50IEJpdHNcclxuICovXHJcbmV4cG9ydCBlbnVtIEdhdGV3YXlJbnRlbnRCaXRzIHtcclxuICBHdWlsZHMgPSAxIDw8IDAsXHJcbiAgR3VpbGRNZW1iZXJzID0gMSA8PCAxLFxyXG4gIEd1aWxkTW9kZXJhdGlvbiA9IDEgPDwgMixcclxuICBHdWlsZEVtb2ppc0FuZFN0aWNrZXJzID0gMSA8PCAzLFxyXG4gIEd1aWxkSW50ZWdyYXRpb25zID0gMSA8PCA0LFxyXG4gIEd1aWxkV2ViaG9va3MgPSAxIDw8IDUsXHJcbiAgR3VpbGRJbnZpdGVzID0gMSA8PCA2LFxyXG4gIEd1aWxkVm9pY2VTdGF0ZXMgPSAxIDw8IDcsXHJcbiAgR3VpbGRQcmVzZW5jZXMgPSAxIDw8IDgsXHJcbiAgR3VpbGRNZXNzYWdlcyA9IDEgPDwgOSxcclxuICBHdWlsZE1lc3NhZ2VSZWFjdGlvbnMgPSAxIDw8IDEwLFxyXG4gIEd1aWxkTWVzc2FnZVR5cGluZyA9IDEgPDwgMTEsXHJcbiAgRGlyZWN0TWVzc2FnZXMgPSAxIDw8IDEyLFxyXG4gIERpcmVjdE1lc3NhZ2VSZWFjdGlvbnMgPSAxIDw8IDEzLFxyXG4gIERpcmVjdE1lc3NhZ2VUeXBpbmcgPSAxIDw8IDE0LFxyXG4gIE1lc3NhZ2VDb250ZW50ID0gMSA8PCAxNSxcclxuICBHdWlsZFNjaGVkdWxlZEV2ZW50cyA9IDEgPDwgMTYsXHJcbiAgQXV0b01vZGVyYXRpb25Db25maWd1cmF0aW9uID0gMSA8PCAyMCxcclxuICBBdXRvTW9kZXJhdGlvbkV4ZWN1dGlvbiA9IDEgPDwgMjFcclxufVxyXG5cclxuLyoqXHJcbiAqIEdhdGV3YXkgT3Bjb2Rlc1xyXG4gKi9cclxuZXhwb3J0IGVudW0gR2F0ZXdheU9wY29kZXMge1xyXG4gIERpc3BhdGNoID0gMCxcclxuICBIZWFydGJlYXQgPSAxLFxyXG4gIElkZW50aWZ5ID0gMixcclxuICBQcmVzZW5jZVVwZGF0ZSA9IDMsXHJcbiAgVm9pY2VTdGF0ZVVwZGF0ZSA9IDQsXHJcbiAgUmVzdW1lID0gNixcclxuICBSZWNvbm5lY3QgPSA3LFxyXG4gIFJlcXVlc3RHdWlsZE1lbWJlcnMgPSA4LFxyXG4gIEludmFsaWRTZXNzaW9uID0gOSxcclxuICBIZWxsbyA9IDEwLFxyXG4gIEhlYXJ0YmVhdEFjayA9IDExXHJcbn1cclxuXHJcbi8qKlxyXG4gKiBJbnRlcmFjdGlvbiBUeXBlc1xyXG4gKi9cclxuZXhwb3J0IGVudW0gSW50ZXJhY3Rpb25UeXBlIHtcclxuICBQaW5nID0gMSxcclxuICBBcHBsaWNhdGlvbkNvbW1hbmQgPSAyLFxyXG4gIE1lc3NhZ2VDb21wb25lbnQgPSAzLFxyXG4gIEFwcGxpY2F0aW9uQ29tbWFuZEF1dG9jb21wbGV0ZSA9IDQsXHJcbiAgTW9kYWxTdWJtaXQgPSA1XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBcHBsaWNhdGlvbiBDb21tYW5kIFR5cGVzXHJcbiAqL1xyXG5leHBvcnQgZW51bSBBcHBsaWNhdGlvbkNvbW1hbmRUeXBlIHtcclxuICBDaGF0SW5wdXQgPSAxLFxyXG4gIFVzZXIgPSAyLFxyXG4gIE1lc3NhZ2UgPSAzXHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBcHBsaWNhdGlvbiBDb21tYW5kIE9wdGlvbiBUeXBlc1xyXG4gKi9cclxuZXhwb3J0IGVudW0gQXBwbGljYXRpb25Db21tYW5kT3B0aW9uVHlwZSB7XHJcbiAgU3ViY29tbWFuZCA9IDEsXHJcbiAgU3ViY29tbWFuZEdyb3VwID0gMixcclxuICBTdHJpbmcgPSAzLFxyXG4gIEludGVnZXIgPSA0LFxyXG4gIEJvb2xlYW4gPSA1LFxyXG4gIFVzZXIgPSA2LFxyXG4gIENoYW5uZWwgPSA3LFxyXG4gIFJvbGUgPSA4LFxyXG4gIE1lbnRpb25hYmxlID0gOSxcclxuICBOdW1iZXIgPSAxMCxcclxuICBBdHRhY2htZW50ID0gMTFcclxufVxyXG5cclxuLyoqXHJcbiAqIENoYW5uZWwgVHlwZXNcclxuICovXHJcbmV4cG9ydCBlbnVtIENoYW5uZWxUeXBlIHtcclxuICBHdWlsZFRleHQgPSAwLFxyXG4gIERNID0gMSxcclxuICBHdWlsZFZvaWNlID0gMixcclxuICBHcm91cERNID0gMyxcclxuICBHdWlsZENhdGVnb3J5ID0gNCxcclxuICBHdWlsZEFubm91bmNlbWVudCA9IDUsXHJcbiAgQW5ub3VuY2VtZW50VGhyZWFkID0gMTAsXHJcbiAgUHVibGljVGhyZWFkID0gMTEsXHJcbiAgUHJpdmF0ZVRocmVhZCA9IDEyLFxyXG4gIEd1aWxkU3RhZ2VWb2ljZSA9IDEzLFxyXG4gIEd1aWxkRGlyZWN0b3J5ID0gMTQsXHJcbiAgR3VpbGRGb3J1bSA9IDE1LFxyXG4gIC8qKiBSdWxlcyBjaGFubmVsIC0gc2VydmVyIHJ1bGVzIGFuZCBndWlkZWxpbmVzICovXHJcbiAgR3VpbGRSdWxlcyA9IDIwLFxyXG4gIC8qKiBTdHJlYW0gY2hhbm5lbCAtIGZvciBsaXZlIHN0cmVhbWluZyAqL1xyXG4gIEd1aWxkU3RyZWFtID0gMjEsXHJcbiAgR3VpbGRBcHAgPSAyMixcclxufVxyXG5cclxuLyoqXHJcbiAqIEludGVyYWN0aW9uIFJlc3BvbnNlIFR5cGVzXHJcbiAqL1xyXG5leHBvcnQgZW51bSBJbnRlcmFjdGlvblJlc3BvbnNlVHlwZSB7XHJcbiAgUG9uZyA9IDEsXHJcbiAgQ2hhbm5lbE1lc3NhZ2VXaXRoU291cmNlID0gNCxcclxuICBEZWZlcnJlZENoYW5uZWxNZXNzYWdlV2l0aFNvdXJjZSA9IDUsXHJcbiAgRGVmZXJyZWRVcGRhdGVNZXNzYWdlID0gNixcclxuICBVcGRhdGVNZXNzYWdlID0gNyxcclxuICBBcHBsaWNhdGlvbkNvbW1hbmRBdXRvY29tcGxldGVSZXN1bHQgPSA4LFxyXG4gIE1vZGFsID0gOVxyXG59XHJcblxyXG4vKipcclxuICogTWVzc2FnZSBGbGFnc1xyXG4gKi9cclxuZXhwb3J0IGVudW0gTWVzc2FnZUZsYWdzIHtcclxuICBDcm9zc3Bvc3RlZCA9IDEgPDwgMCxcclxuICBJc0Nyb3NzcG9zdCA9IDEgPDwgMSxcclxuICBTdXBwcmVzc0VtYmVkcyA9IDEgPDwgMixcclxuICBTb3VyY2VNZXNzYWdlRGVsZXRlZCA9IDEgPDwgMyxcclxuICBVcmdlbnQgPSAxIDw8IDQsXHJcbiAgRXBoZW1lcmFsID0gMSA8PCA2LFxyXG4gIExvYWRpbmcgPSAxIDw8IDcsXHJcbiAgU3VwcHJlc3NOb3RpZmljYXRpb25zID0gMSA8PCAxMixcclxuICBJc0NvbXBvbmVudHNWMiA9IDEgPDwgMTVcclxufVxyXG5cclxuLyoqIE1lc3NhZ2UgY29tcG9uZW50IHdpcmUgdHlwZXMuICovXHJcbmV4cG9ydCBlbnVtIENvbXBvbmVudFR5cGUge1xyXG4gIEFjdGlvblJvdyA9IDEsIEJ1dHRvbiA9IDIsIFN0cmluZ1NlbGVjdCA9IDMsIFRleHRJbnB1dCA9IDQsXHJcbiAgVXNlclNlbGVjdCA9IDUsIFJvbGVTZWxlY3QgPSA2LCBNZW50aW9uYWJsZVNlbGVjdCA9IDcsIENoYW5uZWxTZWxlY3QgPSA4LFxyXG4gIFNlY3Rpb24gPSA5LCBUZXh0RGlzcGxheSA9IDEwLCBUaHVtYm5haWwgPSAxMSwgTWVkaWFHYWxsZXJ5ID0gMTIsXHJcbiAgRmlsZSA9IDEzLCBTZXBhcmF0b3IgPSAxNCwgQ29udGFpbmVyID0gMTdcclxufVxyXG5cclxuZXhwb3J0IGVudW0gU2VwYXJhdG9yU3BhY2luZ1NpemUgeyBTbWFsbCA9IDEsIExhcmdlID0gMiB9XHJcblxyXG4vKipcclxuICogQWN0aXZpdHkgVHlwZXNcclxuICovXHJcbmV4cG9ydCBlbnVtIEFjdGl2aXR5VHlwZSB7XHJcbiAgUGxheWluZyA9IDAsXHJcbiAgU3RyZWFtaW5nID0gMSxcclxuICBMaXN0ZW5pbmcgPSAyLFxyXG4gIFdhdGNoaW5nID0gMyxcclxuICBDdXN0b20gPSA0LFxyXG4gIENvbXBldGluZyA9IDVcclxufVxyXG5cclxuLyoqXHJcbiAqIFByZXNlbmNlIFN0YXR1c1xyXG4gKi9cclxuZXhwb3J0IGVudW0gUHJlc2VuY2VTdGF0dXMge1xyXG4gIE9ubGluZSA9ICdvbmxpbmUnLFxyXG4gIElkbGUgPSAnaWRsZScsXHJcbiAgRG9Ob3REaXN0dXJiID0gJ2RuZCcsXHJcbiAgSW52aXNpYmxlID0gJ2ludmlzaWJsZScsXHJcbiAgT2ZmbGluZSA9ICdvZmZsaW5lJ1xyXG59XHJcblxyXG4vKipcclxuICogUGVybWlzc2lvbiBGbGFncyBCaXRzXHJcbiAqIFVzZWQgZm9yIGNoYW5uZWwgcGVybWlzc2lvbiBvdmVyd3JpdGVzXHJcbiAqL1xyXG5leHBvcnQgY29uc3QgUGVybWlzc2lvbkZsYWdzQml0cyA9IHtcclxuICAvLyBHZW5lcmFsICgwLTkpXHJcbiAgQ3JlYXRlSW5zdGFudEludml0ZTogMW4gPDwgMG4sXHJcbiAgS2lja01lbWJlcnM6IDFuIDw8IDFuLFxyXG4gIEJhbk1lbWJlcnM6IDFuIDw8IDJuLFxyXG4gIEFkbWluaXN0cmF0b3I6IDFuIDw8IDNuLFxyXG4gIE1hbmFnZUNoYW5uZWxzOiAxbiA8PCA0bixcclxuICBNYW5hZ2VHdWlsZDogMW4gPDwgNW4sXHJcbiAgQWRkUmVhY3Rpb25zOiAxbiA8PCA2bixcclxuICBWaWV3QXVkaXRMb2c6IDFuIDw8IDduLFxyXG4gIFZpZXdHdWlsZEluc2lnaHRzOiAxbiA8PCA4bixcclxuICBTdHJlYW06IDFuIDw8IDluLFxyXG4gIFZpZXdDaGFubmVsOiAxbiA8PCAxMG4sXHJcblxyXG4gIC8vIE1lc3NhZ2VzICgxMS0xOSlcclxuICBTZW5kTWVzc2FnZXM6IDFuIDw8IDExbixcclxuICBTZW5kVFRTTWVzc2FnZXM6IDFuIDw8IDEybixcclxuICBNYW5hZ2VNZXNzYWdlczogMW4gPDwgMTNuLFxyXG4gIEVtYmVkTGlua3M6IDFuIDw8IDE0bixcclxuICBBdHRhY2hGaWxlczogMW4gPDwgMTVuLFxyXG4gIFJlYWRNZXNzYWdlSGlzdG9yeTogMW4gPDwgMTZuLFxyXG4gIFVzZUV4dGVybmFsRW1vamlzOiAxbiA8PCAxN24sXHJcbiAgVXNlU2xhc2hDb21tYW5kczogMW4gPDwgMThuLFxyXG4gIE1lbnRpb25FdmVyeW9uZTogMW4gPDwgMTluLFxyXG5cclxuICAvLyBWb2ljZSAoMjAtMjcpXHJcbiAgQ29ubmVjdDogMW4gPDwgMjBuLFxyXG4gIFNwZWFrOiAxbiA8PCAyMW4sXHJcbiAgTXV0ZU1lbWJlcnM6IDFuIDw8IDIybixcclxuICBEZWFmZW5NZW1iZXJzOiAxbiA8PCAyM24sXHJcbiAgTW92ZU1lbWJlcnM6IDFuIDw8IDI0bixcclxuICBVc2VWQUQ6IDFuIDw8IDI1bixcclxuICBDaGFuZ2VDb2RlYzogMW4gPDwgMjZuLFxyXG4gIEF1ZGlvUXVhbGl0eUFkbWluOiAxbiA8PCAyN24sXHJcblxyXG4gIC8vIFZpZGVvIGFuZCBTY3JlZW4gU2hhcmluZyAoMjgtMzcpXHJcbiAgVmlkZW9DYWxsOiAxbiA8PCAyOG4sXHJcbiAgU2hhcmVTY3JlZW46IDFuIDw8IDI5bixcclxuICBTaGFyZUNhbWVyYTogMW4gPDwgMzBuLFxyXG4gIENvbnRyb2xRdWFsaXR5OiAxbiA8PCAzMW4sXHJcbiAgUmVxdWVzdFRvU3BlYWs6IDFuIDw8IDMybixcclxuICBNYW5hZ2VFdmVudHM6IDFuIDw8IDMzbixcclxuICBBZGRNZW1iZXJzOiAxbiA8PCAzNG4sXHJcbiAgUmVtb3ZlTWVtYmVyczogMW4gPDwgMzVuLFxyXG4gIENoYW5nZUdyb3VwSWNvbjogMW4gPDwgMzZuLFxyXG4gIENoYW5nZURNU2V0dGluZ3M6IDFuIDw8IDM3bixcclxuXHJcbiAgLy8gQWR2YW5jZWQgKDM4LTQzKVxyXG4gIE1hbmFnZUdyb3VwOiAxbiA8PCAzOG4sXHJcbiAgVXNlQWN0aXZpdGllczogMW4gPDwgMzluLFxyXG4gIE1vZGVyYXRlTWVtYmVyczogMW4gPDwgNDBuLFxyXG4gIE1hbmFnZVJvbGVzOiAxbiA8PCA0MW4sXHJcbiAgTWFuYWdlRW1vamlzOiAxbiA8PCA0Mm4sXHJcbiAgUHJpb3JpdHlTcGVha2VyOiAxbiA8PCA0M24sXHJcbn0gYXMgY29uc3Q7XHJcblxyXG4vKipcclxuICogT3ZlcndyaXRlIFR5cGUgLSBmb3IgcGVybWlzc2lvbiBvdmVyd3JpdGVzXHJcbiAqL1xyXG5leHBvcnQgZW51bSBPdmVyd3JpdGVUeXBlIHtcclxuICBSb2xlID0gMCxcclxuICBNZW1iZXIgPSAxLFxyXG59XHJcbiJdfQ==