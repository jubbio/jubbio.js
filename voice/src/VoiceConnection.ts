import { EventEmitter } from 'events';
import { Room, RoomEvent } from '@livekit/rtc-node';
import { VoiceConnectionStatus } from './enums';
import { 
  JoinVoiceChannelOptions, 
  VoiceConnectionState,
  GatewayAdapterLibraryMethods,
  VoiceServerUpdate
} from './types';
import { AudioPlayer } from './AudioPlayer';

/**
 * Represents a voice connection to a channel
 */
export class VoiceConnection extends EventEmitter {
  /** Current connection state */
  public state: VoiceConnectionState = { status: VoiceConnectionStatus.Connecting };
  
  /** The channel ID this connection is for */
  public readonly channelId: string;
  
  /** The guild ID this connection is for */
  public readonly guildId: string;
  
  /** LiveKit room instance */
  private room: Room | null = null;
  
  /** LiveKit connection info */
  private livekitEndpoint: string | null = null;
  private livekitToken: string | null = null;
  private livekitRoomName: string | null = null;
  
  /** Subscribed audio player */
  private subscribedPlayer: AudioPlayer | null = null;
  
  /** Gateway adapter methods */
  private adapterMethods: GatewayAdapterLibraryMethods;
  
  /** Adapter implementer (for sending payloads) */
  private adapter: { sendPayload: (payload: any) => boolean; destroy: () => void } | null = null;

  constructor(options: JoinVoiceChannelOptions) {
    super();
    this.channelId = options.channelId;
    this.guildId = options.guildId;
    
    // Create adapter methods that will receive gateway events
    this.adapterMethods = {
      onVoiceServerUpdate: (data: VoiceServerUpdate) => this.handleVoiceServerUpdate(data),
      onVoiceStateUpdate: (data) => this.handleVoiceStateUpdate(data),
      destroy: () => this.destroy()
    };
    
    // Get adapter from creator
    this.adapter = options.adapterCreator(this.adapterMethods);
    
    // Send voice state update to join channel
    this.sendVoiceStateUpdate(options.channelId, options.selfMute, options.selfDeaf);
  }

  /**
   * Subscribe an audio player to this connection
   */
  subscribe(player: AudioPlayer): void {
    if (this.subscribedPlayer) {
      this.subscribedPlayer.unsubscribe(this);
    }
    this.subscribedPlayer = player;
    player.subscribe(this);
  }

  /**
   * Unsubscribe the current audio player
   */
  unsubscribe(): void {
    if (this.subscribedPlayer) {
      this.subscribedPlayer.unsubscribe(this);
      this.subscribedPlayer = null;
    }
  }

  /**
   * Get the LiveKit room (for audio player to publish tracks)
   */
  getRoom(): Room | null {
    return this.room;
  }

  /**
   * Disconnect from the voice channel
   */
  disconnect(): boolean {
    this.sendVoiceStateUpdate(null);
    return true;
  }

  /**
   * Destroy the connection completely
   */
  destroy(): void {
    this.unsubscribe();
    this.disconnectFromLiveKit();
    this.adapter?.destroy();
    this.setState({ status: VoiceConnectionStatus.Destroyed });
  }

  /**
   * Rejoin the voice channel (after disconnect)
   */
  rejoin(): boolean {
    this.sendVoiceStateUpdate(this.channelId);
    return true;
  }

  private sendVoiceStateUpdate(channelId: string | null, selfMute = false, selfDeaf = false): void {
    if (!this.adapter) return;
    
    this.adapter.sendPayload({
      op: 4, // VOICE_STATE_UPDATE
      d: {
        guild_id: this.guildId,
        channel_id: channelId,
        self_mute: selfMute,
        self_deaf: selfDeaf
      }
    });
  }

  private handleVoiceServerUpdate(data: VoiceServerUpdate): void {
    this.livekitEndpoint = data.endpoint;
    this.livekitToken = data.token;
    this.livekitRoomName = data.room;
    
    this.setState({ status: VoiceConnectionStatus.Signalling });
    this.connectToLiveKit();
  }

  private handleVoiceStateUpdate(data: any): void {
    if (data.channel_id === null) {
      // Disconnected
      this.disconnectFromLiveKit();
      this.setState({ status: VoiceConnectionStatus.Disconnected });
    }
  }

  private async connectToLiveKit(): Promise<void> {
    if (!this.livekitEndpoint || !this.livekitToken) {
      this.emit('error', new Error('Missing LiveKit connection info'));
      return;
    }

    try {
      // Disconnect existing room if any
      await this.disconnectFromLiveKit();
      
      this.room = new Room();
      
      this.room.on(RoomEvent.Disconnected, () => {
        this.setState({ status: VoiceConnectionStatus.Disconnected });
      });

      await this.room.connect(this.livekitEndpoint, this.livekitToken);
      
      this.setState({ status: VoiceConnectionStatus.Ready });
      
      // Notify subscribed player that connection is ready
      if (this.subscribedPlayer) {
        this.subscribedPlayer.onConnectionReady(this);
      }
    } catch (error) {
      this.emit('error', error);
      this.setState({ status: VoiceConnectionStatus.Disconnected });
    }
  }

  private async disconnectFromLiveKit(): Promise<void> {
    if (this.room) {
      try {
        await this.room.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
      this.room = null;
    }
  }

  private setState(newState: VoiceConnectionState): void {
    const oldState = this.state;
    this.state = newState;
    this.emit('stateChange', oldState, newState);
  }
}

// Store active connections
const connections = new Map<string, VoiceConnection>();

/**
 * Join a voice channel - main entry point
 */
export function joinVoiceChannel(options: JoinVoiceChannelOptions): VoiceConnection {
  const key = `${options.guildId}:${options.channelId}`;
  
  // Destroy existing connection if any
  const existing = connections.get(key);
  if (existing) {
    existing.destroy();
    connections.delete(key);
  }
  
  const connection = new VoiceConnection(options);
  connections.set(key, connection);
  
  return connection;
}

/**
 * Get an existing voice connection
 */
export function getVoiceConnection(guildId: string): VoiceConnection | undefined {
  for (const [key, connection] of connections) {
    if (key.startsWith(`${guildId}:`)) {
      return connection;
    }
  }
  return undefined;
}
