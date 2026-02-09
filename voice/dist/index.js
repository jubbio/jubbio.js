"use strict";
/**
 * @jubbio/voice - Voice library for Jubbio bots
 *
 * Usage:
 * ```typescript
 * import { joinVoiceChannel, createAudioPlayer, createAudioResource } from '@jubbio/voice';
 *
 * const connection = joinVoiceChannel({
 *   channelId: '123456789',
 *   guildId: '987654321',
 *   adapterCreator: client.guilds.cache.get('987654321')!.voiceAdapterCreator
 * });
 *
 * const player = createAudioPlayer();
 * const resource = createAudioResource('https://example.com/audio.mp3');
 *
 * player.play(resource);
 * connection.subscribe(player);
 * ```
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./VoiceConnection"), exports);
__exportStar(require("./AudioPlayer"), exports);
__exportStar(require("./AudioResource"), exports);
__exportStar(require("./types"), exports);
__exportStar(require("./enums"), exports);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBbUJHOzs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsb0RBQWtDO0FBQ2xDLGdEQUE4QjtBQUM5QixrREFBZ0M7QUFDaEMsMENBQXdCO0FBQ3hCLDBDQUF3QiIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBAanViYmlvL3ZvaWNlIC0gVm9pY2UgbGlicmFyeSBmb3IgSnViYmlvIGJvdHNcclxuICogXHJcbiAqIFVzYWdlOlxyXG4gKiBgYGB0eXBlc2NyaXB0XHJcbiAqIGltcG9ydCB7IGpvaW5Wb2ljZUNoYW5uZWwsIGNyZWF0ZUF1ZGlvUGxheWVyLCBjcmVhdGVBdWRpb1Jlc291cmNlIH0gZnJvbSAnQGp1YmJpby92b2ljZSc7XHJcbiAqIFxyXG4gKiBjb25zdCBjb25uZWN0aW9uID0gam9pblZvaWNlQ2hhbm5lbCh7XHJcbiAqICAgY2hhbm5lbElkOiAnMTIzNDU2Nzg5JyxcclxuICogICBndWlsZElkOiAnOTg3NjU0MzIxJyxcclxuICogICBhZGFwdGVyQ3JlYXRvcjogY2xpZW50Lmd1aWxkcy5jYWNoZS5nZXQoJzk4NzY1NDMyMScpIS52b2ljZUFkYXB0ZXJDcmVhdG9yXHJcbiAqIH0pO1xyXG4gKiBcclxuICogY29uc3QgcGxheWVyID0gY3JlYXRlQXVkaW9QbGF5ZXIoKTtcclxuICogY29uc3QgcmVzb3VyY2UgPSBjcmVhdGVBdWRpb1Jlc291cmNlKCdodHRwczovL2V4YW1wbGUuY29tL2F1ZGlvLm1wMycpO1xyXG4gKiBcclxuICogcGxheWVyLnBsYXkocmVzb3VyY2UpO1xyXG4gKiBjb25uZWN0aW9uLnN1YnNjcmliZShwbGF5ZXIpO1xyXG4gKiBgYGBcclxuICovXHJcblxyXG5leHBvcnQgKiBmcm9tICcuL1ZvaWNlQ29ubmVjdGlvbic7XHJcbmV4cG9ydCAqIGZyb20gJy4vQXVkaW9QbGF5ZXInO1xyXG5leHBvcnQgKiBmcm9tICcuL0F1ZGlvUmVzb3VyY2UnO1xyXG5leHBvcnQgKiBmcm9tICcuL3R5cGVzJztcclxuZXhwb3J0ICogZnJvbSAnLi9lbnVtcyc7XHJcbiJdfQ==