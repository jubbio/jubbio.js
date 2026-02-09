import { VoiceConnectionStatus, AudioPlayerStatus, StreamType } from './enums';
import { Readable } from 'stream';

/**
 * Options for joining a voice channel
 */
export interface JoinVoiceChannelOptions {
  /** The ID of the voice channel to join */
  channelId: string;
  /** The ID of the guild the voice channel belongs to */
  guildId: string;
  /** Adapter creator from the guild */
  adapterCreator: GatewayAdapterCreator;
  /** Whether to join self-muted */
  selfMute?: boolean;
  /** Whether to join self-deafened */
  selfDeaf?: boolean;
}

/**
 * Gateway adapter creator - interface for gateway communication
 */
export interface GatewayAdapterCreator {
  (methods: GatewayAdapterLibraryMethods): GatewayAdapterImplementerMethods;
}

export interface GatewayAdapterLibraryMethods {
  onVoiceServerUpdate(data: VoiceServerUpdate): void;
  onVoiceStateUpdate(data: VoiceStateUpdate): void;
  destroy(): void;
}

export interface GatewayAdapterImplementerMethods {
  sendPayload(payload: any): boolean;
  destroy(): void;
}

export interface VoiceServerUpdate {
  token: string;
  endpoint: string;
  room: string;
}

export interface VoiceStateUpdate {
  channel_id: string | null;
  guild_id: string;
  user_id: string;
  self_mute: boolean;
  self_deaf: boolean;
}

/**
 * Options for creating an audio player
 */
export interface CreateAudioPlayerOptions {
  /** Behaviors for the audio player */
  behaviors?: {
    /** Whether to pause when no subscribers */
    noSubscriber?: 'pause' | 'play' | 'stop';
    /** Max missed frames before considering connection dead */
    maxMissedFrames?: number;
  };
}

/**
 * Options for creating an audio resource
 */
export interface CreateAudioResourceOptions<T = unknown> {
  /** The type of the input stream */
  inputType?: StreamType;
  /** Metadata to attach to the resource */
  metadata?: T;
  /** Whether to inline the volume transformer */
  inlineVolume?: boolean;
  /** Number of silence frames to append */
  silencePaddingFrames?: number;
}

/**
 * Audio resource input - can be string URL, readable stream, or file path
 */
export type AudioResourceInput = string | Readable;

/**
 * Voice connection events
 */
export interface VoiceConnectionEvents {
  stateChange: (oldState: VoiceConnectionState, newState: VoiceConnectionState) => void;
  error: (error: Error) => void;
}

export interface VoiceConnectionState {
  status: VoiceConnectionStatus;
}

/**
 * Audio player events
 */
export interface AudioPlayerEvents {
  stateChange: (oldState: AudioPlayerState, newState: AudioPlayerState) => void;
  error: (error: AudioPlayerError) => void;
  idle: () => void;
}

export interface AudioPlayerState {
  status: AudioPlayerStatus;
  resource?: any;
}

export interface AudioPlayerError {
  message: string;
  resource: any;
}
