"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamType = exports.AudioPlayerStatus = exports.VoiceConnectionStatus = void 0;
/**
 * Voice connection status
 */
var VoiceConnectionStatus;
(function (VoiceConnectionStatus) {
    /** Connection is being established */
    VoiceConnectionStatus["Connecting"] = "connecting";
    /** Connection is ready to use */
    VoiceConnectionStatus["Ready"] = "ready";
    /** Connection is disconnected */
    VoiceConnectionStatus["Disconnected"] = "disconnected";
    /** Connection is destroyed */
    VoiceConnectionStatus["Destroyed"] = "destroyed";
    /** Connection is signalling (exchanging info with server) */
    VoiceConnectionStatus["Signalling"] = "signalling";
})(VoiceConnectionStatus || (exports.VoiceConnectionStatus = VoiceConnectionStatus = {}));
/**
 * Audio player status
 */
var AudioPlayerStatus;
(function (AudioPlayerStatus) {
    /** Player is idle (not playing anything) */
    AudioPlayerStatus["Idle"] = "idle";
    /** Player is buffering audio */
    AudioPlayerStatus["Buffering"] = "buffering";
    /** Player is playing audio */
    AudioPlayerStatus["Playing"] = "playing";
    /** Player is paused */
    AudioPlayerStatus["Paused"] = "paused";
    /** Player is auto-paused (no subscribers) */
    AudioPlayerStatus["AutoPaused"] = "autopaused";
})(AudioPlayerStatus || (exports.AudioPlayerStatus = AudioPlayerStatus = {}));
/**
 * Audio resource type
 */
var StreamType;
(function (StreamType) {
    /** Arbitrary audio stream */
    StreamType["Arbitrary"] = "arbitrary";
    /** Raw PCM audio */
    StreamType["Raw"] = "raw";
    /** Opus encoded audio */
    StreamType["Opus"] = "opus";
    /** OGG/Opus container */
    StreamType["OggOpus"] = "ogg/opus";
    /** WebM/Opus container */
    StreamType["WebmOpus"] = "webm/opus";
})(StreamType || (exports.StreamType = StreamType = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW51bXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvZW51bXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUE7O0dBRUc7QUFDSCxJQUFZLHFCQVdYO0FBWEQsV0FBWSxxQkFBcUI7SUFDL0Isc0NBQXNDO0lBQ3RDLGtEQUF5QixDQUFBO0lBQ3pCLGlDQUFpQztJQUNqQyx3Q0FBZSxDQUFBO0lBQ2YsaUNBQWlDO0lBQ2pDLHNEQUE2QixDQUFBO0lBQzdCLDhCQUE4QjtJQUM5QixnREFBdUIsQ0FBQTtJQUN2Qiw2REFBNkQ7SUFDN0Qsa0RBQXlCLENBQUE7QUFDM0IsQ0FBQyxFQVhXLHFCQUFxQixxQ0FBckIscUJBQXFCLFFBV2hDO0FBRUQ7O0dBRUc7QUFDSCxJQUFZLGlCQVdYO0FBWEQsV0FBWSxpQkFBaUI7SUFDM0IsNENBQTRDO0lBQzVDLGtDQUFhLENBQUE7SUFDYixnQ0FBZ0M7SUFDaEMsNENBQXVCLENBQUE7SUFDdkIsOEJBQThCO0lBQzlCLHdDQUFtQixDQUFBO0lBQ25CLHVCQUF1QjtJQUN2QixzQ0FBaUIsQ0FBQTtJQUNqQiw2Q0FBNkM7SUFDN0MsOENBQXlCLENBQUE7QUFDM0IsQ0FBQyxFQVhXLGlCQUFpQixpQ0FBakIsaUJBQWlCLFFBVzVCO0FBRUQ7O0dBRUc7QUFDSCxJQUFZLFVBV1g7QUFYRCxXQUFZLFVBQVU7SUFDcEIsNkJBQTZCO0lBQzdCLHFDQUF1QixDQUFBO0lBQ3ZCLG9CQUFvQjtJQUNwQix5QkFBVyxDQUFBO0lBQ1gseUJBQXlCO0lBQ3pCLDJCQUFhLENBQUE7SUFDYix5QkFBeUI7SUFDekIsa0NBQW9CLENBQUE7SUFDcEIsMEJBQTBCO0lBQzFCLG9DQUFzQixDQUFBO0FBQ3hCLENBQUMsRUFYVyxVQUFVLDBCQUFWLFVBQVUsUUFXckIiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogVm9pY2UgY29ubmVjdGlvbiBzdGF0dXNcclxuICovXHJcbmV4cG9ydCBlbnVtIFZvaWNlQ29ubmVjdGlvblN0YXR1cyB7XHJcbiAgLyoqIENvbm5lY3Rpb24gaXMgYmVpbmcgZXN0YWJsaXNoZWQgKi9cclxuICBDb25uZWN0aW5nID0gJ2Nvbm5lY3RpbmcnLFxyXG4gIC8qKiBDb25uZWN0aW9uIGlzIHJlYWR5IHRvIHVzZSAqL1xyXG4gIFJlYWR5ID0gJ3JlYWR5JyxcclxuICAvKiogQ29ubmVjdGlvbiBpcyBkaXNjb25uZWN0ZWQgKi9cclxuICBEaXNjb25uZWN0ZWQgPSAnZGlzY29ubmVjdGVkJyxcclxuICAvKiogQ29ubmVjdGlvbiBpcyBkZXN0cm95ZWQgKi9cclxuICBEZXN0cm95ZWQgPSAnZGVzdHJveWVkJyxcclxuICAvKiogQ29ubmVjdGlvbiBpcyBzaWduYWxsaW5nIChleGNoYW5naW5nIGluZm8gd2l0aCBzZXJ2ZXIpICovXHJcbiAgU2lnbmFsbGluZyA9ICdzaWduYWxsaW5nJ1xyXG59XHJcblxyXG4vKipcclxuICogQXVkaW8gcGxheWVyIHN0YXR1c1xyXG4gKi9cclxuZXhwb3J0IGVudW0gQXVkaW9QbGF5ZXJTdGF0dXMge1xyXG4gIC8qKiBQbGF5ZXIgaXMgaWRsZSAobm90IHBsYXlpbmcgYW55dGhpbmcpICovXHJcbiAgSWRsZSA9ICdpZGxlJyxcclxuICAvKiogUGxheWVyIGlzIGJ1ZmZlcmluZyBhdWRpbyAqL1xyXG4gIEJ1ZmZlcmluZyA9ICdidWZmZXJpbmcnLFxyXG4gIC8qKiBQbGF5ZXIgaXMgcGxheWluZyBhdWRpbyAqL1xyXG4gIFBsYXlpbmcgPSAncGxheWluZycsXHJcbiAgLyoqIFBsYXllciBpcyBwYXVzZWQgKi9cclxuICBQYXVzZWQgPSAncGF1c2VkJyxcclxuICAvKiogUGxheWVyIGlzIGF1dG8tcGF1c2VkIChubyBzdWJzY3JpYmVycykgKi9cclxuICBBdXRvUGF1c2VkID0gJ2F1dG9wYXVzZWQnXHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBdWRpbyByZXNvdXJjZSB0eXBlXHJcbiAqL1xyXG5leHBvcnQgZW51bSBTdHJlYW1UeXBlIHtcclxuICAvKiogQXJiaXRyYXJ5IGF1ZGlvIHN0cmVhbSAqL1xyXG4gIEFyYml0cmFyeSA9ICdhcmJpdHJhcnknLFxyXG4gIC8qKiBSYXcgUENNIGF1ZGlvICovXHJcbiAgUmF3ID0gJ3JhdycsXHJcbiAgLyoqIE9wdXMgZW5jb2RlZCBhdWRpbyAqL1xyXG4gIE9wdXMgPSAnb3B1cycsXHJcbiAgLyoqIE9HRy9PcHVzIGNvbnRhaW5lciAqL1xyXG4gIE9nZ09wdXMgPSAnb2dnL29wdXMnLFxyXG4gIC8qKiBXZWJNL09wdXMgY29udGFpbmVyICovXHJcbiAgV2VibU9wdXMgPSAnd2VibS9vcHVzJ1xyXG59XHJcbiJdfQ==