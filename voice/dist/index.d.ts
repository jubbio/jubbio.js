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
export * from './VoiceConnection';
export * from './AudioPlayer';
export * from './AudioResource';
export * from './types';
export * from './enums';
