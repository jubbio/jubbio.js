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

  /** Whether the client is currently in the login flow */
  private _loginState: 'idle' | 'connecting' | 'ready' = 'idle';

  /** Reconnect attempt counter */
  private _reconnectAttempts: number = 0;

  /** Maximum reconnect attempts before giving up */
  private readonly _maxReconnectAttempts: number = 5;

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
   * Gateway close code descriptions
   */
  private static readonly CLOSE_CODES: Record<number, { message: string; reconnectable: boolean }> = {
    4000: { message: 'Bilinmeyen hata (Unknown error)', reconnectable: true },
    4001: { message: 'Bilinmeyen opcode gönderildi (Unknown opcode)', reconnectable: true },
    4002: { message: 'Geçersiz payload gönderildi (Decode error)', reconnectable: true },
    4003: { message: 'Henüz kimlik doğrulaması yapılmadı (Not authenticated)', reconnectable: true },
    4004: { message: 'Geçersiz bot token\'ı (Authentication failed)', reconnectable: false },
    4005: { message: 'Zaten kimlik doğrulaması yapılmış (Already authenticated)', reconnectable: true },
    4007: { message: 'Geçersiz sequence numarası (Invalid seq)', reconnectable: true },
    4008: { message: 'Rate limit aşıldı (Rate limited)', reconnectable: true },
    4009: { message: 'Oturum zaman aşımına uğradı (Session timed out)', reconnectable: true },
    4010: { message: 'Geçersiz shard yapılandırması (Invalid shard)', reconnectable: false },
    4011: { message: 'Sharding gerekli (Sharding required)', reconnectable: false },
    4014: { message: 'İzin verilmeyen intent\'ler istendi (Disallowed intents)', reconnectable: false },
  };

  /**
   * Login to the gateway
   */
  async login(token: string): Promise<string> {
    if (!token || typeof token !== 'string') {
      throw new Error(
        'Geçerli bir bot token\'ı sağlanmalıdır. Örnek: client.login(process.env.BOT_TOKEN)'
      );
    }

    this.token = token.replace(/^Bot\s+/i, '');
    this.rest.setToken(this.token);
    this._loginState = 'connecting';
    this._reconnectAttempts = 0;

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timeout);
        this.removeListener('ready', onReady);
        this.removeListener('error', onError);
        this.removeListener('gatewayClose', onGatewayClose);
      };

      const timeout = setTimeout(() => {
        cleanup();
        this._loginState = 'idle';
        reject(new Error(
          'Gateway\'e bağlanılamadı: 30 saniye içinde READY event\'i alınamadı. ' +
          'Olası sebepler: gateway sunucusu erişilemez, token geçersiz veya ağ sorunu.'
        ));
      }, 30000);

      const onReady = () => {
        cleanup();
        this._loginState = 'ready';
        this._reconnectAttempts = 0;
        resolve(this.token);
      };

      const onError = (error: Error) => {
        cleanup();
        this._loginState = 'idle';
        reject(error);
      };

      const onGatewayClose = (code: number, reason: string) => {
        const info = Client.CLOSE_CODES[code];
        if (info && !info.reconnectable) {
          cleanup();
          this._loginState = 'idle';
          reject(new Error(`Gateway bağlantısı reddedildi [${code}]: ${info.message}${reason ? ' - ' + reason : ''}`));
        }
        // Reconnectable codes: login promise stays alive, connect() will retry
      };

      this.once('ready', onReady);
      this.once('error', onError);
      this.on('gatewayClose', onGatewayClose);

      this.connect();
    });
  }

  /**
   * Connect to the gateway
   */
  private connect(): void {
    this.ws = new WebSocket(this.gatewayUrl);
    
    this.ws.on('open', () => {
      this.emit('debug', 'WebSocket bağlantısı açıldı');
      this._reconnectAttempts = 0;
    });
    
    this.ws.on('message', (data) => {
      this.handleMessage(data.toString());
    });
    
    this.ws.on('close', (code, reason) => {
      const reasonStr = reason?.toString() || '';
      const info = Client.CLOSE_CODES[code];
      
      if (info) {
        this.emit('debug', `Gateway bağlantısı kapandı [${code}]: ${info.message}${reasonStr ? ' - ' + reasonStr : ''}`);
      } else {
        this.emit('debug', `WebSocket kapandı: ${code} - ${reasonStr}`);
      }
      
      this.cleanup();

      // Emit gatewayClose so login() can handle non-reconnectable codes
      this.emit('gatewayClose', code, reasonStr);

      // Non-reconnectable codes: don't retry
      if (info && !info.reconnectable) {
        this.emit('debug', `Kod ${code} yeniden bağlanılamaz, bağlantı sonlandırılıyor.`);
        return;
      }

      // Normal close: don't retry
      if (code === 1000) {
        return;
      }

      // Reconnectable: retry with backoff
      this._reconnectAttempts++;
      if (this._reconnectAttempts > this._maxReconnectAttempts) {
        this.emit('debug', `Maksimum yeniden bağlanma denemesi aşıldı (${this._maxReconnectAttempts})`);
        this.emit('error', new Error(
          `Gateway bağlantısı ${this._maxReconnectAttempts} denemeden sonra kurulamadı. Son kapanma kodu: ${code}`
        ));
        return;
      }

      const delay = Math.min(1000 * Math.pow(2, this._reconnectAttempts - 1), 30000);
      this.emit('debug', `Yeniden bağlanılıyor (deneme ${this._reconnectAttempts}/${this._maxReconnectAttempts}), ${delay}ms sonra...`);
      setTimeout(() => this.connect(), delay);
    });
    
    this.ws.on('error', (error) => {
      this.emit('debug', `WebSocket hatası: ${error.message}`);
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
        this.emit('debug', 'Geçersiz oturum, yeniden kimlik doğrulanıyor...');
        // InvalidSession may carry error data from sendError()
        if (payload.d && typeof payload.d === 'object' && payload.d.code && payload.d.message) {
          this.emit('debug', `Sunucu hatası [${payload.d.code}]: ${payload.d.message}`);
          const info = Client.CLOSE_CODES[payload.d.code];
          if (info && !info.reconnectable) {
            this.emit('error', new Error(`Gateway hatası [${payload.d.code}]: ${info.message}`));
            return;
          }
        }
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
        
      case 'CHANNEL_CREATE': {
        // Update guild channel cache
        const guildId = data.guild_id;
        const channelId = data.id || data.channel_id;
        if (guildId && channelId) {
          const guild = this.guilds.get(guildId);
          if (guild) {
            guild.channels.set(channelId, data);
          }
        }
        this.emit('channelCreate', data);
        break;
      }
        
      case 'CHANNEL_UPDATE': {
        const guildId = data.guild_id;
        const channelId = data.id || data.channel_id;
        if (guildId && channelId) {
          const guild = this.guilds.get(guildId);
          if (guild) {
            guild.channels.set(channelId, data);
          }
        }
        this.emit('channelUpdate', data);
        break;
      }
        
      case 'CHANNEL_DELETE': {
        const guildId = data.guild_id;
        const channelId = data.id || data.channel_id;
        if (guildId && channelId) {
          const guild = this.guilds.get(guildId);
          if (guild) {
            guild.channels.delete(channelId);
          }
        }
        this.emit('channelDelete', data);
        break;
      }
        
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

    // Mark message as from bot if author ID matches the bot's own user ID
    if (this.user && String(message.author.id) === String(this.user.id)) {
      (message.author as any).bot = true;
    }

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
    this._loginState = 'idle';
    this._reconnectAttempts = this._maxReconnectAttempts + 1; // Prevent reconnect
    this.cleanup();
    this.ws?.close(1000);
    this.ws = null;
    this.removeAllListeners();
  }
}

// Re-export for convenience
export { GatewayIntentBits };
