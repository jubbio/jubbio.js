import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { 
  ClientOptions, 
  GatewayPayload, 
  ReadyEventData,
  APIGuild,
  APIInteraction,
  APIMessage,
  APIVoiceServerUpdate,
  APIChannel,
  APIUser
} from './types';
import { GatewayOpcodes, GatewayIntentBits } from './enums';
import { Collection } from './structures/Collection';
import { User } from './structures/User';
import { Guild } from './structures/Guild';
import { Message } from './structures/Message';
import { createInteraction, Interaction } from './structures/Interaction';
import { BaseChannel, createChannel } from './structures/Channel';
import { REST } from './rest/REST';

/**
 * Voice adapter creator type for @jubbio/voice compatibility
 */
type VoiceAdapterCreator = (methods: {
  onVoiceServerUpdate(data: any): void;
  onVoiceStateUpdate(data: any): void;
  destroy(): void;
}) => {
  sendPayload(payload: any): boolean;
  destroy(): void;
};

/**
 * Main client class
 */
export class Client extends EventEmitter {
  /** Client options */
  public readonly options: ClientOptions;
  
  /** REST API client */
  public readonly rest: REST;
  
  /** The bot user */
  public user: User | null = null;
  
  /** Application ID */
  public applicationId: string | null = null;
  
  /** Cached guilds */
  public guilds: Collection<string, Guild> = new Collection();
  
  /** Cached channels */
  public channels: Collection<string, BaseChannel> = new Collection();
  
  /** Cached users */
  public users: Collection<string, User> = new Collection();
  
  /** Voice adapter management */
  public voice: {
    adapters: Map<string, VoiceAdapterCreator>;
  };
  
  /** WebSocket connection */
  private ws: WebSocket | null = null;
  
  /** Bot token */
  private token: string = '';
  
  /** Session ID */
  private sessionId: string | null = null;
  
  /** Sequence number */
  private sequence: number | null = null;
  
  /** Heartbeat interval */
  private heartbeatInterval: NodeJS.Timeout | null = null;
  
  /** Gateway URL */
  private gatewayUrl: string;
  
  /** Voice state update handlers (for voice adapters) */
  private voiceStateHandlers: Map<string, (data: any) => void> = new Map();
  private voiceServerHandlers: Map<string, (data: any) => void> = new Map();

  constructor(options: ClientOptions) {
    super();
    this.options = options;
    this.gatewayUrl = options.gatewayUrl || 'wss://realtime.jubbio.com/ws/bot';
    this.rest = new REST(options.apiUrl);
    
    // Initialize voice adapter system
    this.voice = {
      adapters: new Map()
    };
  }

  /**
   * Calculate intents value
   */
  private getIntentsValue(): number {
    if (typeof this.options.intents === 'number') {
      return this.options.intents;
    }
    return this.options.intents.reduce((acc, intent) => acc | intent, 0);
  }

  /**
   * Login to the gateway
   */
  async login(token: string): Promise<string> {
    this.token = token.replace(/^Bot\s+/i, '');
    this.rest.setToken(this.token);
    
    return new Promise((resolve, reject) => {
      this.connect();
      
      // Wait for ready event
      const timeout = setTimeout(() => {
        reject(new Error('Login timeout'));
      }, 30000);
      
      this.once('ready', () => {
        clearTimeout(timeout);
        resolve(this.token);
      });
      
      this.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Connect to the gateway
   */
  private connect(): void {
    this.ws = new WebSocket(this.gatewayUrl);
    
    this.ws.on('open', () => {
      this.emit('debug', 'WebSocket connection opened');
    });
    
    this.ws.on('message', (data) => {
      this.handleMessage(data.toString());
    });
    
    this.ws.on('close', (code, reason) => {
      this.emit('debug', `WebSocket closed: ${code} - ${reason}`);
      this.cleanup();
      
      // Reconnect on certain close codes
      if (code !== 1000 && code !== 4004) {
        setTimeout(() => this.connect(), 5000);
      }
    });
    
    this.ws.on('error', (error) => {
      this.emit('error', error);
    });
  }

  /**
   * Handle incoming gateway message
   */
  private handleMessage(data: string): void {
    // Handle multiple messages in one frame
    const messages = data.split('\n').filter(m => m.trim());
    
    for (const msg of messages) {
      try {
        const payload: GatewayPayload = JSON.parse(msg);
        this.handlePayload(payload);
      } catch (e) {
        this.emit('debug', `Failed to parse message: ${msg}`);
      }
    }
  }

  /**
   * Handle gateway payload
   */
  private handlePayload(payload: GatewayPayload): void {
    if (payload.s) {
      this.sequence = payload.s;
    }

    switch (payload.op) {
      case GatewayOpcodes.Hello:
        this.handleHello(payload.d);
        break;
        
      case GatewayOpcodes.Dispatch:
        this.handleDispatch(payload.t!, payload.d);
        break;
        
      case GatewayOpcodes.HeartbeatAck:
        this.emit('debug', 'Heartbeat acknowledged');
        break;
        
      case GatewayOpcodes.InvalidSession:
        this.emit('debug', 'Invalid session, re-identifying...');
        setTimeout(() => this.identify(), 5000);
        break;
        
      case GatewayOpcodes.Reconnect:
        this.emit('debug', 'Reconnect requested');
        this.ws?.close();
        setTimeout(() => this.connect(), 1000);
        break;
    }
  }

  /**
   * Handle Hello payload
   */
  private handleHello(data: { heartbeat_interval: number }): void {
    this.emit('debug', `Received Hello, heartbeat interval: ${data.heartbeat_interval}ms`);
    this.startHeartbeat(data.heartbeat_interval);
    this.identify();
  }

  /**
   * Handle Dispatch events
   */
  private handleDispatch(eventType: string, data: any): void {
    this.emit('debug', `Dispatch: ${eventType}`);
    
    switch (eventType) {
      case 'READY':
        this.handleReady(data);
        break;
        
      case 'GUILD_CREATE':
        this.handleGuildCreate(data);
        break;
        
      case 'GUILD_UPDATE':
        this.handleGuildUpdate(data);
        break;
        
      case 'GUILD_DELETE':
        this.handleGuildDelete(data);
        break;
        
      case 'MESSAGE_CREATE':
        this.handleMessageCreate(data);
        break;
        
      case 'MESSAGE_UPDATE':
        this.emit('messageUpdate', data);
        break;
        
      case 'MESSAGE_DELETE':
        this.emit('messageDelete', data);
        break;
        
      case 'MESSAGE_DELETE_BULK':
        this.emit('messageDeleteBulk', data);
        break;
        
      case 'CHANNEL_CREATE':
        this.emit('channelCreate', data);
        break;
        
      case 'CHANNEL_UPDATE':
        this.emit('channelUpdate', data);
        break;
        
      case 'CHANNEL_DELETE':
        this.emit('channelDelete', data);
        break;
        
      case 'GUILD_MEMBER_ADD':
        this.emit('guildMemberAdd', data);
        break;
        
      case 'GUILD_MEMBER_UPDATE':
        this.emit('guildMemberUpdate', data);
        break;
        
      case 'GUILD_MEMBER_REMOVE':
        this.emit('guildMemberRemove', data);
        break;
        
      case 'GUILD_ROLE_CREATE':
        this.emit('roleCreate', data);
        break;
        
      case 'GUILD_ROLE_UPDATE':
        this.emit('roleUpdate', data);
        break;
        
      case 'GUILD_ROLE_DELETE':
        this.emit('roleDelete', data);
        break;
        
      case 'GUILD_BAN_ADD':
        this.emit('guildBanAdd', data);
        break;
        
      case 'GUILD_BAN_REMOVE':
        this.emit('guildBanRemove', data);
        break;
        
      case 'INVITE_CREATE':
        this.emit('inviteCreate', data);
        break;
        
      case 'INVITE_DELETE':
        this.emit('inviteDelete', data);
        break;
        
      case 'THREAD_CREATE':
        this.emit('threadCreate', data);
        break;
        
      case 'THREAD_UPDATE':
        this.emit('threadUpdate', data);
        break;
        
      case 'THREAD_DELETE':
        this.emit('threadDelete', data);
        break;
        
      case 'TYPING_START':
        this.emit('typingStart', data);
        break;
        
      case 'PRESENCE_UPDATE':
        this.emit('presenceUpdate', data);
        break;
        
      case 'INTERACTION_CREATE':
        this.handleInteractionCreate(data);
        break;
        
      case 'VOICE_STATE_UPDATE':
        this.handleVoiceStateUpdate(data);
        break;
        
      case 'VOICE_SERVER_UPDATE':
        this.handleVoiceServerUpdate(data);
        break;
        
      default:
        // Emit raw event for unhandled types
        this.emit('raw', { t: eventType, d: data });
    }
  }

  /**
   * Handle Ready event
   */
  private handleReady(data: ReadyEventData): void {
    this.sessionId = data.session_id;
    this.user = new User(data.user);
    // Handle both string and number application IDs
    this.applicationId = data.application?.id ? String(data.application.id) : null;
    if (this.applicationId) {
      this.rest.setApplicationId(this.applicationId);
    }
    
    // Cache guilds (as unavailable initially)
    if (data.guilds) {
      for (const guild of data.guilds) {
        this.guilds.set(String(guild.id), new Guild(this, guild));
      }
    }
    
    // Setup voice adapters for each guild
    this.setupVoiceAdapters();
    
    console.log(`✅ Bot hazır! User: ${this.user.username} (${this.user.id}), App: ${this.applicationId}`);
    this.emit('ready', this);
  }

  /**
   * Setup voice adapters for all guilds
   */
  private setupVoiceAdapters(): void {
    for (const [guildId] of this.guilds) {
      this.createVoiceAdapter(guildId);
    }
  }

  /**
   * Create a voice adapter for a guild
   */
  private createVoiceAdapter(guildId: string): void {
    const adapter: VoiceAdapterCreator = (methods) => {
      // Store handlers for this guild
      this.voiceStateHandlers.set(guildId, methods.onVoiceStateUpdate);
      this.voiceServerHandlers.set(guildId, methods.onVoiceServerUpdate);
      
      return {
        sendPayload: (payload) => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(payload));
            return true;
          }
          return false;
        },
        destroy: () => {
          this.voiceStateHandlers.delete(guildId);
          this.voiceServerHandlers.delete(guildId);
        }
      };
    };
    
    this.voice.adapters.set(guildId, adapter);
  }

  /**
   * Handle Guild Create event
   */
  private handleGuildCreate(data: APIGuild): void {
    let guild = this.guilds.get(data.id);
    
    if (guild) {
      guild._patch(data);
    } else {
      guild = new Guild(this, data);
      this.guilds.set(data.id, guild);
      this.createVoiceAdapter(data.id);
    }
    
    this.emit('guildCreate', guild);
  }

  /**
   * Handle Guild Update event
   */
  private handleGuildUpdate(data: APIGuild): void {
    const guild = this.guilds.get(data.id);
    if (guild) {
      guild._patch(data);
      this.emit('guildUpdate', guild);
    }
  }

  /**
   * Handle Guild Delete event
   */
  private handleGuildDelete(data: { id: string }): void {
    const guild = this.guilds.get(data.id);
    if (guild) {
      this.guilds.delete(data.id);
      this.voice.adapters.delete(data.id);
      this.emit('guildDelete', guild);
    }
  }

  /**
   * Handle Message Create event
   */
  private handleMessageCreate(data: APIMessage): void {
    // Backend sends user_id separately, map it to author.id for compatibility
    if (data.user_id && data.author && !data.author.id) {
      (data.author as any).id = data.user_id;
    }
    
    // Cache the author
    if (data.author) {
      const user = new User(data.author);
      this.users.set(user.id, user);
      // Also cache in REST for mention resolution
      this.rest.cacheUser(data.author);
    }
    
    const message = new Message(this, data);
    this.emit('messageCreate', message);
  }

  /**
   * Handle Interaction Create event
   */
  private handleInteractionCreate(data: APIInteraction): void {
    console.log('[DEBUG] handleInteractionCreate called with:', JSON.stringify(data, null, 2));
    
    // Cache the user
    const userData = data.member?.user || data.user;
    if (userData) {
      const user = new User(userData);
      this.users.set(user.id, user);
      this.rest.cacheUser(userData);
    }
    
    const interaction = createInteraction(this, data);
    console.log('[DEBUG] Created interaction type:', interaction.constructor.name, 'customId:', (interaction as any).customId);
    this.emit('interactionCreate', interaction);
  }

  /**
   * Handle Voice State Update event
   */
  private handleVoiceStateUpdate(data: any): void {
    const guildId = data.guild_id;
    
    // Forward to voice adapter if exists
    const handler = this.voiceStateHandlers.get(guildId);
    if (handler) {
      handler(data);
    }
    
    this.emit('voiceStateUpdate', data);
  }

  /**
   * Handle Voice Server Update event
   */
  private handleVoiceServerUpdate(data: APIVoiceServerUpdate): void {
    const guildId = data.guild_id;
    
    // Forward to voice adapter if exists
    const handler = this.voiceServerHandlers.get(guildId);
    if (handler) {
      handler({
        token: data.token,
        endpoint: data.endpoint,
        room: data.room
      });
    }
    
    this.emit('voiceServerUpdate', data);
  }

  /**
   * Send Identify payload
   */
  private identify(): void {
    const payload: GatewayPayload = {
      op: GatewayOpcodes.Identify,
      d: {
        token: `Bot ${this.token}`,
        intents: this.getIntentsValue(),
        shard: this.options.shards || [0, 1]
      }
    };
    
    this.send(payload);
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(interval: number): void {
    this.heartbeatInterval = setInterval(() => {
      this.send({
        op: GatewayOpcodes.Heartbeat,
        d: this.sequence
      });
    }, interval);
  }

  /**
   * Send payload to gateway
   */
  private send(payload: GatewayPayload): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  /**
   * Cleanup on disconnect
   */
  private cleanup(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Destroy the client
   */
  destroy(): void {
    this.cleanup();
    this.ws?.close(1000);
    this.ws = null;
    this.removeAllListeners();
  }
}

// Re-export for convenience
export { GatewayIntentBits };
