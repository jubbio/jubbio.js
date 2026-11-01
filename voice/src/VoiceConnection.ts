import { EventEmitter } from 'events';
import { Room, RoomEvent } from '@livekit/rtc-node';
import { VoiceConnectionStatus } from './enums';
import { JoinVoiceChannelOptions, VoiceConnectionState, VoiceServerUpdate, VoiceStateUpdate, GatewayAdapterCreator } from './types';
import type { AudioPlayer } from './AudioPlayer';

export class VoiceConnection extends EventEmitter {
  public state: VoiceConnectionState = { status: VoiceConnectionStatus.Connecting };
  public channelId: string;
  public readonly guildId: string;
  private room: Room | null = null;
  private subscribedPlayer: AudioPlayer | null = null;
  private adapter: ReturnType<GatewayAdapterCreator>;
  private generation = 0;
  private connecting: Promise<void> = Promise.resolve();
  private cancelConnecting: (() => void) | null = null;
  private readonly selfMute: boolean;
  private readonly selfDeaf: boolean;

  constructor(options: JoinVoiceChannelOptions) {
    super();
    this.channelId = options.channelId;
    this.guildId = options.guildId;
    this.selfMute = options.selfMute ?? false;
    this.selfDeaf = options.selfDeaf ?? false;
    this.on('error', (error: Error) => {
      if (this.listenerCount('error') === 1) console.error('[VoiceConnection]', error.message);
    });
    this.adapter = options.adapterCreator({
      onVoiceServerUpdate: data => this.handleVoiceServerUpdate(data),
      onVoiceStateUpdate: data => this.handleVoiceStateUpdate(data),
      destroy: () => this.destroy(),
    });
    if (!this.sendVoiceStateUpdate(this.channelId)) this.setState(VoiceConnectionStatus.Disconnected);
  }

  subscribe(player: AudioPlayer): void {
    if (this.subscribedPlayer === player) return;
    this.unsubscribe();
    this.subscribedPlayer = player;
    player.subscribe(this);
  }

  unsubscribe(): void {
    this.subscribedPlayer?.unsubscribe(this);
    this.subscribedPlayer = null;
  }

  getRoom(): Room | null {
    return this.state.status === VoiceConnectionStatus.Ready ? this.room : null;
  }

  disconnect(): boolean {
    if (this.state.status === VoiceConnectionStatus.Destroyed) return false;
    const sent = this.sendVoiceStateUpdate(null);
    this.generation++;
    this.releaseRoom();
    this.setState(VoiceConnectionStatus.Disconnected);
    return sent;
  }

  destroy(sendLeave = true): void {
    if (this.state.status === VoiceConnectionStatus.Destroyed) return;
    this.generation++;
    if (sendLeave) this.sendVoiceStateUpdate(null);
    this.releaseRoom();
    this.unsubscribe();
    this.setState(VoiceConnectionStatus.Destroyed);
    this.adapter?.destroy();
  }

  rejoin(): boolean {
    if (this.state.status === VoiceConnectionStatus.Destroyed) return false;
    const sent = this.sendVoiceStateUpdate(this.channelId);
    if (sent) this.setState(VoiceConnectionStatus.Connecting);
    return sent;
  }

  private sendVoiceStateUpdate(channelId: string | null): boolean {
    return this.adapter?.sendPayload({
      op: 4,
      d: { guild_id: this.guildId, channel_id: channelId, self_mute: this.selfMute, self_deaf: this.selfDeaf },
    }) ?? false;
  }

  private handleVoiceServerUpdate(data: VoiceServerUpdate): void {
    if (this.state.status === VoiceConnectionStatus.Destroyed) return;
    const generation = ++this.generation;
    this.releaseRoom();
    this.setState(VoiceConnectionStatus.Signalling);
    // Serialize native connects. A late result can only close its own room.
    this.connecting = this.connecting.then(async () => {
      if (generation !== this.generation) return;
      if (!data.endpoint || !data.token) {
        this.setState(VoiceConnectionStatus.Disconnected);
        this.emit('error', new Error('Missing LiveKit connection info'));
        return;
      }
      const room = new Room();
      this.room = room;
      const isCurrent = () => generation === this.generation && this.room === room;
      room.on(RoomEvent.Disconnected, () => {
        if (!isCurrent()) return;
        this.subscribedPlayer?.onConnectionDisconnected(this);
        this.setState(VoiceConnectionStatus.Disconnected);
      });
      room.on(RoomEvent.Reconnecting, () => {
        if (!isCurrent()) return;
        this.subscribedPlayer?.onConnectionDisconnected(this);
        this.setState(VoiceConnectionStatus.Connecting);
      });
      room.on(RoomEvent.Reconnected, () => {
        if (!isCurrent()) return;
        this.setState(VoiceConnectionStatus.Ready);
        this.subscribedPlayer?.onConnectionReady(this);
      });
      let cancel!: () => void;
      const cancelled = new Promise<void>(resolve => { cancel = resolve; });
      this.cancelConnecting = cancel;
      let timeout: NodeJS.Timeout | undefined;
      const timedOut = new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('Timeout connecting to LiveKit')), 15000);
        timeout.unref();
      });
      try {
        const connected = room.connect(data.endpoint, data.token).then(async () => {
          if (!isCurrent()) await room.disconnect();
        });
        await Promise.race([connected, cancelled, timedOut]);
        if (!isCurrent()) return;
        this.setState(VoiceConnectionStatus.Ready);
        this.subscribedPlayer?.onConnectionReady(this);
      } catch (error) {
        if (!isCurrent()) return;
        this.releaseRoom();
        this.setState(VoiceConnectionStatus.Disconnected);
        this.emit('error', error);
      } finally {
        clearTimeout(timeout);
        if (this.cancelConnecting === cancel) this.cancelConnecting = null;
      }
    }).catch(error => {
      if (generation === this.generation) this.emit('error', error);
    });
  }

  // Core adapters forward only this bot's voice state, never other members' events.
  private handleVoiceStateUpdate(data: VoiceStateUpdate): void {
    if (this.state.status === VoiceConnectionStatus.Destroyed || String(data.guild_id) !== this.guildId) return;
    if (data.channel_id === null) {
      this.generation++;
      this.releaseRoom();
      this.setState(VoiceConnectionStatus.Disconnected);
    } else {
      this.channelId = String(data.channel_id);
    }
  }

  private releaseRoom(): void {
    this.cancelConnecting?.();
    this.cancelConnecting = null;
    const room = this.room;
    this.room = null;
    if (!room) return;
    this.subscribedPlayer?.onConnectionDisconnected(this);
    room.removeAllListeners();
    void room.disconnect().catch(() => {});
  }

  private setState(status: VoiceConnectionStatus): void {
    if (this.state.status === status) return;
    const previous = this.state;
    this.state = { status };
    this.emit('stateChange', previous, this.state);
  }
}

// Connections are scoped to their adapter creator (bot client) and guild.
const connections = new Map<string, Map<GatewayAdapterCreator, VoiceConnection>>();

export function joinVoiceChannel(options: JoinVoiceChannelOptions): VoiceConnection {
  let guildConnections = connections.get(options.guildId);
  // The new join moves the bot. Sending a separate leave would deliver a stale null
  // voice state to the replacement adapter while it is already connecting.
  guildConnections?.get(options.adapterCreator)?.destroy(false);
  guildConnections = connections.get(options.guildId) ?? new Map();
  connections.set(options.guildId, guildConnections);
  const connection = new VoiceConnection(options);
  guildConnections.set(options.adapterCreator, connection);
  connection.on('stateChange', (_old: VoiceConnectionState, state: VoiceConnectionState) => {
    if (state.status !== VoiceConnectionStatus.Destroyed) return;
    if (guildConnections.get(options.adapterCreator) === connection) guildConnections.delete(options.adapterCreator);
    if (guildConnections.size === 0) connections.delete(options.guildId);
  });
  return connection;
}

export function getVoiceConnection(guildId: string, adapterCreator?: GatewayAdapterCreator): VoiceConnection | undefined {
  const guildConnections = connections.get(guildId);
  return adapterCreator ? guildConnections?.get(adapterCreator) : guildConnections?.values().next().value;
}
