"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GatewayIntentBits = exports.Client = void 0;
const events_1 = require("events");
const ws_1 = __importDefault(require("ws"));
const enums_1 = require("./enums");
Object.defineProperty(exports, "GatewayIntentBits", { enumerable: true, get: function () { return enums_1.GatewayIntentBits; } });
const Collection_1 = require("./structures/Collection");
const User_1 = require("./structures/User");
const Guild_1 = require("./structures/Guild");
const Message_1 = require("./structures/Message");
const Interaction_1 = require("./structures/Interaction");
const REST_1 = require("./rest/REST");
/**
 * Main client class
 */
class Client extends events_1.EventEmitter {
    /** Client options */
    options;
    /** REST API client */
    rest;
    /** The bot user */
    user = null;
    /** Application ID */
    applicationId = null;
    /** Cached guilds */
    guilds = new Collection_1.Collection();
    /** Cached channels */
    channels = new Collection_1.Collection();
    /** Cached users */
    users = new Collection_1.Collection();
    /** Voice adapter management */
    voice;
    /** WebSocket connection */
    ws = null;
    /** Bot token */
    token = '';
    /** Session ID */
    sessionId = null;
    /** Sequence number */
    sequence = null;
    /** Heartbeat interval */
    heartbeatInterval = null;
    /** Gateway URL */
    gatewayUrl;
    /** Voice state update handlers (for voice adapters) */
    voiceStateHandlers = new Map();
    voiceServerHandlers = new Map();
    /** Whether the client is currently in the login flow */
    _loginState = 'idle';
    /** Reconnect attempt counter */
    _reconnectAttempts = 0;
    /** Maximum reconnect attempts before giving up */
    _maxReconnectAttempts = 5;
    constructor(options) {
        super();
        this.options = options;
        this.gatewayUrl = options.gatewayUrl || 'wss://realtime.jubbio.com/ws/bot';
        this.rest = new REST_1.REST(options.apiUrl);
        // Initialize voice adapter system
        this.voice = {
            adapters: new Map()
        };
    }
    /**
     * Calculate intents value
     */
    getIntentsValue() {
        if (typeof this.options.intents === 'number') {
            return this.options.intents;
        }
        return this.options.intents.reduce((acc, intent) => acc | intent, 0);
    }
    /**
     * Gateway close code descriptions
     */
    static CLOSE_CODES = {
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
    async login(token) {
        if (!token || typeof token !== 'string') {
            throw new Error('Geçerli bir bot token\'ı sağlanmalıdır. Örnek: client.login(process.env.BOT_TOKEN)');
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
                reject(new Error('Gateway\'e bağlanılamadı: 30 saniye içinde READY event\'i alınamadı. ' +
                    'Olası sebepler: gateway sunucusu erişilemez, token geçersiz veya ağ sorunu.'));
            }, 30000);
            const onReady = () => {
                cleanup();
                this._loginState = 'ready';
                this._reconnectAttempts = 0;
                resolve(this.token);
            };
            const onError = (error) => {
                cleanup();
                this._loginState = 'idle';
                reject(error);
            };
            const onGatewayClose = (code, reason) => {
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
    connect() {
        this.ws = new ws_1.default(this.gatewayUrl);
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
            }
            else {
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
                this.emit('error', new Error(`Gateway bağlantısı ${this._maxReconnectAttempts} denemeden sonra kurulamadı. Son kapanma kodu: ${code}`));
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
    handleMessage(data) {
        // Handle multiple messages in one frame
        const messages = data.split('\n').filter(m => m.trim());
        for (const msg of messages) {
            try {
                const payload = JSON.parse(msg);
                this.handlePayload(payload);
            }
            catch (e) {
                this.emit('debug', `Failed to parse message: ${msg}`);
            }
        }
    }
    /**
     * Handle gateway payload
     */
    handlePayload(payload) {
        if (payload.s) {
            this.sequence = payload.s;
        }
        switch (payload.op) {
            case enums_1.GatewayOpcodes.Hello:
                this.handleHello(payload.d);
                break;
            case enums_1.GatewayOpcodes.Dispatch:
                this.handleDispatch(payload.t, payload.d);
                break;
            case enums_1.GatewayOpcodes.HeartbeatAck:
                this.emit('debug', 'Heartbeat acknowledged');
                break;
            case enums_1.GatewayOpcodes.InvalidSession:
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
            case enums_1.GatewayOpcodes.Reconnect:
                this.emit('debug', 'Reconnect requested');
                this.ws?.close();
                setTimeout(() => this.connect(), 1000);
                break;
        }
    }
    /**
     * Handle Hello payload
     */
    handleHello(data) {
        this.emit('debug', `Received Hello, heartbeat interval: ${data.heartbeat_interval}ms`);
        this.startHeartbeat(data.heartbeat_interval);
        this.identify();
    }
    /**
     * Handle Dispatch events
     */
    handleDispatch(eventType, data) {
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
    handleReady(data) {
        this.sessionId = data.session_id;
        this.user = new User_1.User(data.user);
        // Handle both string and number application IDs
        this.applicationId = data.application?.id ? String(data.application.id) : null;
        if (this.applicationId) {
            this.rest.setApplicationId(this.applicationId);
        }
        // Cache guilds (as unavailable initially)
        if (data.guilds) {
            for (const guild of data.guilds) {
                this.guilds.set(String(guild.id), new Guild_1.Guild(this, guild));
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
    setupVoiceAdapters() {
        for (const [guildId] of this.guilds) {
            this.createVoiceAdapter(guildId);
        }
    }
    /**
     * Create a voice adapter for a guild
     */
    createVoiceAdapter(guildId) {
        const adapter = (methods) => {
            // Store handlers for this guild
            this.voiceStateHandlers.set(guildId, methods.onVoiceStateUpdate);
            this.voiceServerHandlers.set(guildId, methods.onVoiceServerUpdate);
            return {
                sendPayload: (payload) => {
                    if (this.ws?.readyState === ws_1.default.OPEN) {
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
    handleGuildCreate(data) {
        let guild = this.guilds.get(data.id);
        if (guild) {
            guild._patch(data);
        }
        else {
            guild = new Guild_1.Guild(this, data);
            this.guilds.set(data.id, guild);
            this.createVoiceAdapter(data.id);
        }
        this.emit('guildCreate', guild);
    }
    /**
     * Handle Guild Update event
     */
    handleGuildUpdate(data) {
        const guild = this.guilds.get(data.id);
        if (guild) {
            guild._patch(data);
            this.emit('guildUpdate', guild);
        }
    }
    /**
     * Handle Guild Delete event
     */
    handleGuildDelete(data) {
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
    handleMessageCreate(data) {
        // Backend sends user_id separately, map it to author.id for compatibility
        if (data.user_id && data.author && !data.author.id) {
            data.author.id = data.user_id;
        }
        // Cache the author
        if (data.author) {
            const user = new User_1.User(data.author);
            this.users.set(user.id, user);
            // Also cache in REST for mention resolution
            this.rest.cacheUser(data.author);
        }
        const message = new Message_1.Message(this, data);
        // Mark message as from bot if author ID matches the bot's own user ID
        if (this.user && String(message.author.id) === String(this.user.id)) {
            message.author.bot = true;
        }
        this.emit('messageCreate', message);
    }
    /**
     * Handle Interaction Create event
     */
    handleInteractionCreate(data) {
        console.log('[DEBUG] handleInteractionCreate called with:', JSON.stringify(data, null, 2));
        // Cache the user
        const userData = data.member?.user || data.user;
        if (userData) {
            const user = new User_1.User(userData);
            this.users.set(user.id, user);
            this.rest.cacheUser(userData);
        }
        const interaction = (0, Interaction_1.createInteraction)(this, data);
        console.log('[DEBUG] Created interaction type:', interaction.constructor.name, 'customId:', interaction.customId);
        this.emit('interactionCreate', interaction);
    }
    /**
     * Handle Voice State Update event
     */
    handleVoiceStateUpdate(data) {
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
    handleVoiceServerUpdate(data) {
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
    identify() {
        const payload = {
            op: enums_1.GatewayOpcodes.Identify,
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
    startHeartbeat(interval) {
        this.heartbeatInterval = setInterval(() => {
            this.send({
                op: enums_1.GatewayOpcodes.Heartbeat,
                d: this.sequence
            });
        }, interval);
    }
    /**
     * Send payload to gateway
     */
    send(payload) {
        if (this.ws?.readyState === ws_1.default.OPEN) {
            this.ws.send(JSON.stringify(payload));
        }
    }
    /**
     * Cleanup on disconnect
     */
    cleanup() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    /**
     * Destroy the client
     */
    destroy() {
        this._loginState = 'idle';
        this._reconnectAttempts = this._maxReconnectAttempts + 1; // Prevent reconnect
        this.cleanup();
        this.ws?.close(1000);
        this.ws = null;
        this.removeAllListeners();
    }
}
exports.Client = Client;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ2xpZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL0NsaWVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxtQ0FBc0M7QUFDdEMsNENBQTJCO0FBWTNCLG1DQUE0RDtBQWdzQm5ELGtHQWhzQmdCLHlCQUFpQixPQWdzQmhCO0FBL3JCMUIsd0RBQXFEO0FBQ3JELDRDQUF5QztBQUN6Qyw4Q0FBMkM7QUFDM0Msa0RBQStDO0FBQy9DLDBEQUEwRTtBQUUxRSxzQ0FBbUM7QUFjbkM7O0dBRUc7QUFDSCxNQUFhLE1BQU8sU0FBUSxxQkFBWTtJQUN0QyxxQkFBcUI7SUFDTCxPQUFPLENBQWdCO0lBRXZDLHNCQUFzQjtJQUNOLElBQUksQ0FBTztJQUUzQixtQkFBbUI7SUFDWixJQUFJLEdBQWdCLElBQUksQ0FBQztJQUVoQyxxQkFBcUI7SUFDZCxhQUFhLEdBQWtCLElBQUksQ0FBQztJQUUzQyxvQkFBb0I7SUFDYixNQUFNLEdBQThCLElBQUksdUJBQVUsRUFBRSxDQUFDO0lBRTVELHNCQUFzQjtJQUNmLFFBQVEsR0FBb0MsSUFBSSx1QkFBVSxFQUFFLENBQUM7SUFFcEUsbUJBQW1CO0lBQ1osS0FBSyxHQUE2QixJQUFJLHVCQUFVLEVBQUUsQ0FBQztJQUUxRCwrQkFBK0I7SUFDeEIsS0FBSyxDQUVWO0lBRUYsMkJBQTJCO0lBQ25CLEVBQUUsR0FBcUIsSUFBSSxDQUFDO0lBRXBDLGdCQUFnQjtJQUNSLEtBQUssR0FBVyxFQUFFLENBQUM7SUFFM0IsaUJBQWlCO0lBQ1QsU0FBUyxHQUFrQixJQUFJLENBQUM7SUFFeEMsc0JBQXNCO0lBQ2QsUUFBUSxHQUFrQixJQUFJLENBQUM7SUFFdkMseUJBQXlCO0lBQ2pCLGlCQUFpQixHQUEwQixJQUFJLENBQUM7SUFFeEQsa0JBQWtCO0lBQ1YsVUFBVSxDQUFTO0lBRTNCLHVEQUF1RDtJQUMvQyxrQkFBa0IsR0FBcUMsSUFBSSxHQUFHLEVBQUUsQ0FBQztJQUNqRSxtQkFBbUIs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VUFBVSxLQUFLLFlBQVMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUMzQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7UUFDeEMsQ0FBQztJQUNILENBQUM7SUFFRDs7T0FFRztJQUNLLE9BQU87UUFDYixJQUFJLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1lBQzNCLGFBQWEsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQztZQUN0QyxJQUFJLENBQUMsaUJBQWlCLEdBQUcsSUFBSSxDQUFDO1FBQ2hDLENBQUM7SUFDSCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxPQUFPO1FBQ0wsSUFBSSxDQUFDLFdBQVcsR0FBRyxNQUFNLENBQUM7UUFDMUIsSUFBSSxDQUFDLGtCQUFrQixHQUFHLElBQUksQ0FBQyxxQkFBcUIsR0FBRyxDQUFDLENBQUMsQ0FBQyxvQkFBb0I7UUFDOUUsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ2YsSUFBSSxDQUFDLEVBQUUsRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDckIsSUFBSSxDQUFDLEVBQUUsR0FBRyxJQUFJLENBQUM7UUFDZixJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztJQUM1QixDQUFDOztBQXBxQkgsd0JBcXFCQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gJ2V2ZW50cyc7XHJcbmltcG9ydCBXZWJTb2NrZXQgZnJvbSAnd3MnO1xyXG5pbXBvcnQgeyBcclxuICBDbGllbnRPcHRpb25zLCBcclxuICBHYXRld2F5UGF5bG9hZCwgXHJcbiAgUmVhZHlFdmVudERhdGEsXHJcbiAgQVBJR3VpbGQsXHJcbiAgQVBJSW50ZXJhY3Rpb24sXHJcbiAgQVBJTWVzc2FnZSxcclxuICBBUElWb2ljZVNlcnZlclVwZGF0ZSxcclxuICBBUElDaGFubmVsLFxyXG4gIEFQSVVzZXJcclxufSBmcm9tICcuL3R5cGVzJztcclxuaW1wb3J0IHsgR2F0ZXdheU9wY29kZXMsIEdhdGV3YXlJbnRlbnRCaXRzIH0gZnJvbSAnLi9lbnVtcyc7XHJcbmltcG9ydCB7IENvbGxlY3Rpb24gfSBmcm9tICcuL3N0cnVjdHVyZXMvQ29sbGVjdGlvbic7XHJcbmltcG9ydCB7IFVzZXIgfSBmcm9tICcuL3N0cnVjdHVyZXMvVXNlcic7XHJcbmltcG9ydCB7IEd1aWxkIH0gZnJvbSAnLi9zdHJ1Y3R1cmVzL0d1aWxkJztcclxuaW1wb3J0IHsgTWVzc2FnZSB9IGZyb20gJy4vc3RydWN0dXJlcy9NZXNzYWdlJztcclxuaW1wb3J0IHsgY3JlYXRlSW50ZXJhY3Rpb24sIEludGVyYWN0aW9uIH0gZnJvbSAnLi9zdHJ1Y3R1cmVzL0ludGVyYWN0aW9uJztcclxuaW1wb3J0IHsgQmFzZUNoYW5uZWwsIGNyZWF0ZUNoYW5uZWwgfSBmcm9tICcuL3N0cnVjdHVyZXMvQ2hhbm5lbCc7XHJcbmltcG9ydCB7IFJFU1QgfSBmcm9tICcuL3Jlc3QvUkVTVCc7XHJcblxyXG4vKipcclxuICogVm9pY2UgYWRhcHRlciBjcmVhdG9yIHR5cGUgZm9yIEBqdWJiaW8vdm9pY2UgY29tcGF0aWJpbGl0eVxyXG4gKi9cclxudHlwZSBWb2ljZUFkYXB0ZXJDcmVhdG9yID0gKG1ldGhvZHM6IHtcclxuICBvblZvaWNlU2VydmVyVXBkYXRlKGRhdGE6IGFueSk6IHZvaWQ7XHJcbiAgb25Wb2ljZVN0YXRlVXBkYXRlKGRhdGE6IGFueSk6IHZvaWQ7XHJcbiAgZGVzdHJveSgpOiB2b2lkO1xyXG59KSA9PiB7XHJcbiAgc2VuZFBheWxvYWQocGF5bG9hZDogYW55KTogYm9vbGVhbjtcclxuICBkZXN0cm95KCk6IHZvaWQ7XHJcbn07XHJcblxyXG4vKipcclxuICogTWFpbiBjbGllbnQgY2xhc3NcclxuICovXHJcbmV4cG9ydCBjbGFzcyBDbGllbnQgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xyXG4gIC8qKiBDbGllbnQgb3B0aW9ucyAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBvcHRpb25zOiBDbGllbnRPcHRpb25zO1xyXG4gIFxyXG4gIC8qKiBSRVNUIEFQSSBjbGllbnQgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgcmVzdDogUkVTVDtcclxuICBcclxuICAvKiogVGhlIGJvdCB1c2VyICovXHJcbiAgcHVibGljIHVzZXI6IFVzZXIgfCBudWxsID0gbnVsbDtcclxuICBcclxuICAvKiogQXBwbGljYXRpb24gSUQgKi9cclxuICBwdWJsaWMgYXBwbGljYXRpb25JZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XHJcbiAgXHJcbiAgLyoqIENhY2hlZCBndWlsZHMgKi9cclxuICBwdWJsaWMgZ3VpbGRzOiBDb2xsZWN0aW9uPHN0cmluZywgR3VpbGQ+ID0gbmV3IENvbGxlY3Rpb24oKTtcclxuICBcclxuICAvKiogQ2FjaGVkIGNoYW5uZWxzICovXHJcbiAgcHVibGljIGNoYW5uZWxzOiBDb2xsZWN0aW9uPHN0cmluZywgQmFzZUNoYW5uZWw+ID0gbmV3IENvbGxlY3Rpb24oKTtcclxuICBcclxuICAvKiogQ2FjaGVkIHVzZXJzICovXHJcbiAgcHVibGljIHVzZXJzOiBDb2xsZWN0aW9uPHN0cmluZywgVXNlcj4gPSBuZXcgQ29sbGVjdGlvbigpO1xyXG4gIFxyXG4gIC8qKiBWb2ljZSBhZGFwdGVyIG1hbmFnZW1lbnQgKi9cclxuICBwdWJsaWMgdm9pY2U6IHtcclxuICAgIGFkYXB0ZXJzOiBNYXA8c3RyaW5nLCBWb2ljZUFkYXB0ZXJDcmVhdG9yPjtcclxuICB9O1xyXG4gIFxyXG4gIC8qKiBXZWJTb2NrZXQgY29ubmVjdGlvbiAqL1xyXG4gIHByaXZhdGUgd3M6IFdlYlNvY2tldCB8IG51bGwgPSBudWxsO1xyXG4gIFxyXG4gIC8qKiBCb3QgdG9rZW4gKi9cclxuICBwcml2YXRlIHRva2VuOiBzdHJpbmcgPSAnJztcclxuICBcclxuICAvKiogU2Vzc2lvbiBJRCAqL1xyXG4gIHByaXZhdGUgc2Vzc2lvbklkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcclxuICBcclxuICAvKiogU2VxdWVuY2UgbnVtYmVyICovXHJcbiAgcHJpdmF0ZSBzZXF1ZW5jZTogbnVtYmVyIHwgbnVsbCA9IG51bGw7XHJcbiAgXHJcbiAgLyoqIEhlYXJ0YmVhdCBpbnRlcnZhbCAqL1xyXG4gIHByaXZhdGUgaGVhcnRiZWF0SW50ZXJ2YWw6IE5vZGVKUy5UaW1lb3V0IHwgbnVsbCA9IG51bGw7XHJcbiAgXHJcbiAgLyoqIEdhdGV3YXkgVVJMICovXHJcbiAgcHJpdmF0ZSBnYXRld2F5VXJsOiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIFZvaWNlIHN0YXRlIHVwZGF0ZSBoYW5kbGVycyAoZm9yIHZvaWNlIGFkYXB0ZXJzKSAqL1xyXG4gIHByaXZhdGUgdm9pY2VTdGF0ZUhhbmRsZXJzOiBNYXA8c3RyaW5nLCAoZGF0YTogYW55KSA9PiB2b2lkPiA9IG5ldyBNYXAoKTtcclxuICBwcml2YXRlIHZvaWNlU2VydmVySGFuZGxlcnM6IE1hcDxzdHJpbmcsIChkYXRhOiBhbnkpID0+IHZvaWQ+ID0gbmV3IE1hcCgpO1xyXG5cclxuICAvKiogV2hldGhlciB0aGUgY2xpZW50IGlzIGN1cnJlbnRseSBpbiB0aGUgbG9naW4gZmxvdyAqL1xyXG4gIHByaXZhdGUgX2xvZ2luU3RhdGU6ICdpZGxlJyB8ICdjb25uZWN0aW5nJyB8ICdyZWFkeScgPSAnaWRsZSc7XHJcblxyXG4gIC8qKiBSZWNvbm5lY3QgYXR0ZW1wdCBjb3VudGVyICovXHJcbiAgcHJpdmF0ZSBfcmVjb25uZWN0QXR0ZW1wdHM6IG51bWJlciA9IDA7XHJcblxyXG4gIC8qKiBNYXhpbXVtIHJlY29ubmVjdCBhdHRlbXB0cyBiZWZvcmUgZ2l2aW5nIHVwICovXHJcbiAgcHJpdmF0ZSByZWFkb25seSBfbWF4UmVjb25uZWN0QXR0ZW1wdHM6IG51bWJlciA9IDU7XHJcblxyXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnM6IENsaWVudE9wdGlvbnMpIHtcclxuICAgIHN1cGVyKCk7XHJcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xyXG4gICAgdGhpcy5nYXRld2F5VXJsID0gb3B0aW9ucy5nYXRld2F5VXJsIHx8ICd3c3M6Ly9yZWFsdGltZS5qdWJiaW8uY29tL3dzL2JvdCc7XHJcbiAgICB0aGlzLnJlc3QgPSBuZXcgUkVTVChvcHRpb25zLmFwaVVybCk7XHJcbiAgICBcclxuICAgIC8vIEluaXRpYWxpemUgdm9pY2UgYWRhcHRlciBzeXN0ZW1cclxuICAgIHRoaXMudm9pY2UgPSB7XHJcbiAgICAgIGFkYXB0ZXJzOiBuZXcgTWFwKClcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDYWxjdWxhdGUgaW50ZW50cyB2YWx1ZVxyXG4gICAqL1xyXG4gIHByaXZhdGUgZ2V0SW50ZW50c1ZhbHVlKCk6IG51bWJlciB7XHJcbiAgICBpZiAodHlwZW9mIHRoaXMub3B0aW9ucy5pbnRlbnRzID09PSAnbnVtYmVyJykge1xyXG4gICAgICByZXR1cm4gdGhpcy5vcHRpb25zLmludGVudHM7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGhpcy5vcHRpb25zLmludGVudHMucmVkdWNlKChhY2MsIGludGVudCkgPT4gYWNjIHwgaW50ZW50LCAwKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdhdGV3YXkgY2xvc2UgY29kZSBkZXNjcmlwdGlvbnNcclxuICAgKi9cclxuICBwcml2YXRlIHN0YXRpYyByZWFkb25seSBDTE9TRV9DT0RFUzogUmVjb3JkPG51bWJlciwgeyBtZXNzYWdlOiBzdHJpbmc7IHJlY29ubmVjdGFibGU6IGJvb2xlYW4gfT4gPSB7XHJcbiAgICA0MDAwOiB7IG1lc3NhZ2U6ICdCaWxpbm1leWVuIGhhdGEgKFVua25vd24gZXJyb3IpJywgcmVjb25uZWN0YWJsZTogdHJ1ZSB9LFxyXG4gICAgNDAwMTogeyBtZXNzYWdlOiAnQmlsaW5tZXllbiBvcGNvZGUgZ8O2bmRlcmlsZGkgKFVua25vd24gb3Bjb2RlKScsIHJlY29ubmVjdGFibGU6IHRydWUgfSxcclxuICAgIDQwMDI6IHsgbWVzc2FnZTogJ0dlw6dlcnNpeiBwYXlsb2FkIGfDtm5kZXJpbGRpIChEZWNvZGUgZXJyb3IpJywgcmVjb25uZWN0YWJsZTogdHJ1ZSB9LFxyXG4gICAgNDAwMzogeyBtZXNzYWdlOiAnSGVuw7x6IGtpbWxpayBkb8SfcnVsYW1hc8SxIHlhcMSxbG1hZMSxIChOb3QgYXV0aGVudGljYXRlZCknLCByZWNvbm5lY3RhYmxlOiB0cnVlIH0sXHJcbiAgICA0MDA0OiB7IG1lc3NhZ2U6ICdHZcOnZXJzaXogYm90IHRva2VuXFwnxLEgKEF1dGhlbnRpY2F0aW9uIGZhaWxlZCknLCByZWNvbm5lY3RhYmxlOiBmYWxzZSB9LFxyXG4gICAgNDAwNTogeyBtZXNzYWdlOiAnWmF0ZW4ga2ltbGlrIGRvxJ9ydWxhbWFzxLEgeWFwxLFsbcSxxZ8gKEFscmVhZHkgYXV0aGVudGljYXRlZCknLCByZWNvbm5lY3RhYmxlOiB0cnVlIH0sXHJcbiAgICA0MDA3OiB7IG1lc3NhZ2U6ICdHZcOnZXJzaXogc2VxdWVuY2UgbnVtYXJhc8SxIChJbnZhbGlkIHNlcSknLCByZWNvbm5lY3RhYmxlOiB0cnVlIH0sXHJcbiAgICA0MDA4OiB7IG1lc3NhZ2U6ICdSYXRlIGxpbWl0IGHFn8SxbGTEsSAoUmF0ZSBsaW1pdGVkKScsIHJlY29ubmVjdGFibGU6IHRydWUgfSxcclxuICAgIDQwMDk6IHsgbWVzc2FnZTogJ090dXJ1bSB6YW1hbiBhxZ/EsW3EsW5hIHXEn3JhZMSxIChTZXNzaW9uIHRpbWVkIG91dCknLCByZWNvbm5lY3RhYmxlOiB0cnVlIH0sXHJcbiAgICA0MDEwOiB7IG1lc3NhZ2U6ICdHZcOnZXJzaXogc2hhcmQgeWFwxLFsYW5kxLFybWFzxLEgKEludmFsaWQgc2hhcmQpJywgcmVjb25uZWN0YWJsZTogZmFsc2UgfSxcclxuICAgIDQwMTE6IHsgbWVzc2FnZTogJ1NoYXJkaW5nIGdlcmVrbGkgKFNoYXJkaW5nIHJlcXVpcmVkKScsIHJlY29ubmVjdGFibGU6IGZhbHNlIH0sXHJcbiAgICA0MDE0OiB7IG1lc3NhZ2U6ICfEsHppbiB2ZXJpbG1leWVuIGludGVudFxcJ2xlciBpc3RlbmRpIChEaXNhbGxvd2VkIGludGVudHMpJywgcmVjb25uZWN0YWJsZTogZmFsc2UgfSxcclxuICB9O1xyXG5cclxuICAvKipcclxuICAgKiBMb2dpbiB0byB0aGUgZ2F0ZXdheVxyXG4gICAqL1xyXG4gIGFzeW5jIGxvZ2luKHRva2VuOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xyXG4gICAgaWYgKCF0b2tlbiB8fCB0eXBlb2YgdG9rZW4gIT09ICdzdHJpbmcnKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihcclxuICAgICAgICAnR2XDp2VybGkgYmlyIGJvdCB0b2tlblxcJ8SxIHNhxJ9sYW5tYWzEsWTEsXIuIMOWcm5lazogY2xpZW50LmxvZ2luKHByb2Nlc3MuZW52LkJPVF9UT0tFTiknXHJcbiAgICAgICk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy50b2tlbiA9IHRva2VuLnJlcGxhY2UoL15Cb3RcXHMrL2ksICcnKTtcclxuICAgIHRoaXMucmVzdC5zZXRUb2tlbih0aGlzLnRva2VuKTtcclxuICAgIHRoaXMuX2xvZ2luU3RhdGUgPSAnY29ubmVjdGluZyc7XHJcbiAgICB0aGlzLl9yZWNvbm5lY3RBdHRlbXB0cyA9IDA7XHJcblxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgY29uc3QgY2xlYW51cCA9ICgpID0+IHtcclxuICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XHJcbiAgICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcigncmVhZHknLCBvblJlYWR5KTtcclxuICAgICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKCdlcnJvcicsIG9uRXJyb3IpO1xyXG4gICAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIoJ2dhdGV3YXlDbG9zZScsIG9uR2F0ZXdheUNsb3NlKTtcclxuICAgICAgfTtcclxuXHJcbiAgICAgIGNvbnN0IHRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICBjbGVhbnVwKCk7XHJcbiAgICAgICAgdGhpcy5fbG9naW5TdGF0ZSA9ICdpZGxlJztcclxuICAgICAgICByZWplY3QobmV3IEVycm9yKFxyXG4gICAgICAgICAgJ0dhdGV3YXlcXCdlIGJhxJ9sYW7EsWxhbWFkxLE6IDMwIHNhbml5ZSBpw6dpbmRlIFJFQURZIGV2ZW50XFwnaSBhbMSxbmFtYWTEsS4gJyArXHJcbiAgICAgICAgICAnT2xhc8SxIHNlYmVwbGVyOiBnYXRld2F5IHN1bnVjdXN1IGVyacWfaWxlbWV6LCB0b2tlbiBnZcOnZXJzaXogdmV5YSBhxJ8gc29ydW51LidcclxuICAgICAgICApKTtcclxuICAgICAgfSwgMzAwMDApO1xyXG5cclxuICAgICAgY29uc3Qgb25SZWFkeSA9ICgpID0+IHtcclxuICAgICAgICBjbGVhbnVwKCk7XHJcbiAgICAgICAgdGhpcy5fbG9naW5TdGF0ZSA9ICdyZWFkeSc7XHJcbiAgICAgICAgdGhpcy5fcmVjb25uZWN0QXR0ZW1wdHMgPSAwO1xyXG4gICAgICAgIHJlc29sdmUodGhpcy50b2tlbik7XHJcbiAgICAgIH07XHJcblxyXG4gICAgICBjb25zdCBvbkVycm9yID0gKGVycm9yOiBFcnJvcikgPT4ge1xyXG4gICAgICAgIGNsZWFudXAoKTtcclxuICAgICAgICB0aGlzLl9sb2dpblN0YXRlID0gJ2lkbGUnO1xyXG4gICAgICAgIHJlamVjdChlcnJvcik7XHJcbiAgICAgIH07XHJcblxyXG4gICAgICBjb25zdCBvbkdhdGV3YXlDbG9zZSA9IChjb2RlOiBudW1iZXIsIHJlYXNvbjogc3RyaW5nKSA9PiB7XHJcbiAgICAgICAgY29uc3QgaW5mbyA9IENsaWVudC5DTE9TRV9DT0RFU1tjb2RlXTtcclxuICAgICAgICBpZiAoaW5mbyAmJiAhaW5mby5yZWNvbm5lY3RhYmxlKSB7XHJcbiAgICAgICAgICBjbGVhbnVwKCk7XHJcbiAgICAgICAgICB0aGlzLl9sb2dpblN0YXRlID0gJ2lkbGUnO1xyXG4gICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihgR2F0ZXdheSBiYcSfbGFudMSxc8SxIHJlZGRlZGlsZGkgWyR7Y29kZX1dOiAke2luZm8ubWVzc2FnZX0ke3JlYXNvbiA/ICcgLSAnICsgcmVhc29uIDogJyd9YCkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICAvLyBSZWNvbm5lY3RhYmxlIGNvZGVzOiBsb2dpbiBwcm9taXNlIHN0YXlzIGFsaXZlLCBjb25uZWN0KCkgd2lsbCByZXRyeVxyXG4gICAgICB9O1xyXG5cclxuICAgICAgdGhpcy5vbmNlKCdyZWFkeScsIG9uUmVhZHkpO1xyXG4gICAgICB0aGlzLm9uY2UoJ2Vycm9yJywgb25FcnJvcik7XHJcbiAgICAgIHRoaXMub24oJ2dhdGV3YXlDbG9zZScsIG9uR2F0ZXdheUNsb3NlKTtcclxuXHJcbiAgICAgIHRoaXMuY29ubmVjdCgpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDb25uZWN0IHRvIHRoZSBnYXRld2F5XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBjb25uZWN0KCk6IHZvaWQge1xyXG4gICAgdGhpcy53cyA9IG5ldyBXZWJTb2NrZXQodGhpcy5nYXRld2F5VXJsKTtcclxuICAgIFxyXG4gICAgdGhpcy53cy5vbignb3BlbicsICgpID0+IHtcclxuICAgICAgdGhpcy5lbWl0KCdkZWJ1ZycsICdXZWJTb2NrZXQgYmHEn2xhbnTEsXPEsSBhw6fEsWxkxLEnKTtcclxuICAgICAgdGhpcy5fcmVjb25uZWN0QXR0ZW1wdHMgPSAwO1xyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIHRoaXMud3Mub24oJ21lc3NhZ2UnLCAoZGF0YSkgPT4ge1xyXG4gICAgICB0aGlzLmhhbmRsZU1lc3NhZ2UoZGF0YS50b1N0cmluZygpKTtcclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICB0aGlzLndzLm9uKCdjbG9zZScsIChjb2RlLCByZWFzb24pID0+IHtcclxuICAgICAgY29uc3QgcmVhc29uU3RyID0gcmVhc29uPy50b1N0cmluZygpIHx8ICcnO1xyXG4gICAgICBjb25zdCBpbmZvID0gQ2xpZW50LkNMT1NFX0NPREVTW2NvZGVdO1xyXG4gICAgICBcclxuICAgICAgaWYgKGluZm8pIHtcclxuICAgICAgICB0aGlzLmVtaXQoJ2RlYnVnJywgYEdhdGV3YXkgYmHEn2xhbnTEsXPEsSBrYXBhbmTEsSBbJHtjb2RlfV06ICR7aW5mby5tZXNzYWdlfSR7cmVhc29uU3RyID8gJyAtICcgKyByZWFzb25TdHIgOiAnJ31gKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICB0aGlzLmVtaXQoJ2RlYnVnJywgYFdlYlNvY2tldCBrYXBhbmTEsTogJHtjb2RlfSAtICR7cmVhc29uU3RyfWApO1xyXG4gICAgICB9XHJcbiAgICAgIFxyXG4gICAgICB0aGlzLmNsZWFudXAoKTtcclxuXHJcbiAgICAgIC8vIEVtaXQgZ2F0ZXdheUNsb3NlIHNvIGxvZ2luKCkgY2FuIGhhbmRsZSBub24tcmVjb25uZWN0YWJsZSBjb2Rlc1xyXG4gICAgICB0aGlzLmVtaXQoJ2dhdGV3YXlDbG9zZScsIGNvZGUsIHJlYXNvblN0cik7XHJcblxyXG4gICAgICAvLyBOb24tcmVjb25uZWN0YWJsZSBjb2RlczogZG9uJ3QgcmV0cnlcclxuICAgICAgaWYgKGluZm8gJiYgIWluZm8ucmVjb25uZWN0YWJsZSkge1xyXG4gICAgICAgIHRoaXMuZW1pdCgnZGVidWcnLCBgS29kICR7Y29kZX0geWVuaWRlbiBiYcSfbGFuxLFsYW1heiwgYmHEn2xhbnTEsSBzb25sYW5kxLFyxLFsxLF5b3IuYCk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyBOb3JtYWwgY2xvc2U6IGRvbid0IHJldHJ5XHJcbiAgICAgIGlmIChjb2RlID09PSAxMDAwKSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyBSZWNvbm5lY3RhYmxlOiByZXRyeSB3aXRoIGJhY2tvZmZcclxuICAgICAgdGhpcy5fcmVjb25uZWN0QXR0ZW1wdHMrKztcclxuICAgICAgaWYgKHRoaXMuX3JlY29ubmVjdEF0dGVtcHRzID4gdGhpcy5fbWF4UmVjb25uZWN0QXR0ZW1wdHMpIHtcclxuICAgICAgICB0aGlzLmVtaXQoJ2RlYnVnJywgYE1ha3NpbXVtIHllbmlkZW4gYmHEn2xhbm1hIGRlbmVtZXNpIGHFn8SxbGTEsSAoJHt0aGlzLl9tYXhSZWNvbm5lY3RBdHRlbXB0c30pYCk7XHJcbiAgICAgICAgdGhpcy5lbWl0KCdlcnJvcicsIG5ldyBFcnJvcihcclxuICAgICAgICAgIGBHYXRld2F5IGJhxJ9sYW50xLFzxLEgJHt0aGlzLl9tYXhSZWNvbm5lY3RBdHRlbXB0c30gZGVuZW1lZGVuIHNvbnJhIGt1cnVsYW1hZMSxLiBTb24ga2FwYW5tYSBrb2R1OiAke2NvZGV9YFxyXG4gICAgICAgICkpO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG5cclxuICAgICAgY29uc3QgZGVsYXkgPSBNYXRoLm1pbigxMDAwICogTWF0aC5wb3coMiwgdGhpcy5fcmVjb25uZWN0QXR0ZW1wdHMgLSAxKSwgMzAwMDApO1xyXG4gICAgICB0aGlzLmVtaXQoJ2RlYnVnJywgYFllbmlkZW4gYmHEn2xhbsSxbMSxeW9yIChkZW5lbWUgJHt0aGlzLl9yZWNvbm5lY3RBdHRlbXB0c30vJHt0aGlzLl9tYXhSZWNvbm5lY3RBdHRlbXB0c30pLCAke2RlbGF5fW1zIHNvbnJhLi4uYCk7XHJcbiAgICAgIHNldFRpbWVvdXQoKCkgPT4gdGhpcy5jb25uZWN0KCksIGRlbGF5KTtcclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICB0aGlzLndzLm9uKCdlcnJvcicsIChlcnJvcikgPT4ge1xyXG4gICAgICB0aGlzLmVtaXQoJ2RlYnVnJywgYFdlYlNvY2tldCBoYXRhc8SxOiAke2Vycm9yLm1lc3NhZ2V9YCk7XHJcbiAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCBlcnJvcik7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZSBpbmNvbWluZyBnYXRld2F5IG1lc3NhZ2VcclxuICAgKi9cclxuICBwcml2YXRlIGhhbmRsZU1lc3NhZ2UoZGF0YTogc3RyaW5nKTogdm9pZCB7XHJcbiAgICAvLyBIYW5kbGUgbXVsdGlwbGUgbWVzc2FnZXMgaW4gb25lIGZyYW1lXHJcbiAgICBjb25zdCBtZXNzYWdlcyA9IGRhdGEuc3BsaXQoJ1xcbicpLmZpbHRlcihtID0+IG0udHJpbSgpKTtcclxuICAgIFxyXG4gICAgZm9yIChjb25zdCBtc2cgb2YgbWVzc2FnZXMpIHtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBjb25zdCBwYXlsb2FkOiBHYXRld2F5UGF5bG9hZCA9IEpTT04ucGFyc2UobXNnKTtcclxuICAgICAgICB0aGlzLmhhbmRsZVBheWxvYWQocGF5bG9hZCk7XHJcbiAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICB0aGlzLmVtaXQoJ2RlYnVnJywgYEZhaWxlZCB0byBwYXJzZSBtZXNzYWdlOiAke21zZ31gKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSGFuZGxlIGdhdGV3YXkgcGF5bG9hZFxyXG4gICAqL1xyXG4gIHByaXZhdGUgaGFuZGxlUGF5bG9hZChwYXlsb2FkOiBHYXRld2F5UGF5bG9hZCk6IHZvaWQge1xyXG4gICAgaWYgKHBheWxvYWQucykge1xyXG4gICAgICB0aGlzLnNlcXVlbmNlID0gcGF5bG9hZC5zO1xyXG4gICAgfVxyXG5cclxuICAgIHN3aXRjaCAocGF5bG9hZC5vcCkge1xyXG4gICAgICBjYXNlIEdhdGV3YXlPcGNvZGVzLkhlbGxvOlxyXG4gICAgICAgIHRoaXMuaGFuZGxlSGVsbG8ocGF5bG9hZC5kKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSBHYXRld2F5T3Bjb2Rlcy5EaXNwYXRjaDpcclxuICAgICAgICB0aGlzLmhhbmRsZURpc3BhdGNoKHBheWxvYWQudCEsIHBheWxvYWQuZCk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgR2F0ZXdheU9wY29kZXMuSGVhcnRiZWF0QWNrOlxyXG4gICAgICAgIHRoaXMuZW1pdCgnZGVidWcnLCAnSGVhcnRiZWF0IGFja25vd2xlZGdlZCcpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlIEdhdGV3YXlPcGNvZGVzLkludmFsaWRTZXNzaW9uOlxyXG4gICAgICAgIHRoaXMuZW1pdCgnZGVidWcnLCAnR2XDp2Vyc2l6IG90dXJ1bSwgeWVuaWRlbiBraW1saWsgZG/En3J1bGFuxLF5b3IuLi4nKTtcclxuICAgICAgICAvLyBJbnZhbGlkU2Vzc2lvbiBtYXkgY2FycnkgZXJyb3IgZGF0YSBmcm9tIHNlbmRFcnJvcigpXHJcbiAgICAgICAgaWYgKHBheWxvYWQuZCAmJiB0eXBlb2YgcGF5bG9hZC5kID09PSAnb2JqZWN0JyAmJiBwYXlsb2FkLmQuY29kZSAmJiBwYXlsb2FkLmQubWVzc2FnZSkge1xyXG4gICAgICAgICAgdGhpcy5lbWl0KCdkZWJ1ZycsIGBTdW51Y3UgaGF0YXPEsSBbJHtwYXlsb2FkLmQuY29kZX1dOiAke3BheWxvYWQuZC5tZXNzYWdlfWApO1xyXG4gICAgICAgICAgY29uc3QgaW5mbyA9IENsaWVudC5DTE9TRV9DT0RFU1twYXlsb2FkLmQuY29kZV07XHJcbiAgICAgICAgICBpZiAoaW5mbyAmJiAhaW5mby5yZWNvbm5lY3RhYmxlKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCBuZXcgRXJyb3IoYEdhdGV3YXkgaGF0YXPEsSBbJHtwYXlsb2FkLmQuY29kZX1dOiAke2luZm8ubWVzc2FnZX1gKSk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB0aGlzLmlkZW50aWZ5KCksIDUwMDApO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlIEdhdGV3YXlPcGNvZGVzLlJlY29ubmVjdDpcclxuICAgICAgICB0aGlzLmVtaXQoJ2RlYnVnJywgJ1JlY29ubmVjdCByZXF1ZXN0ZWQnKTtcclxuICAgICAgICB0aGlzLndzPy5jbG9zZSgpO1xyXG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4gdGhpcy5jb25uZWN0KCksIDEwMDApO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSGFuZGxlIEhlbGxvIHBheWxvYWRcclxuICAgKi9cclxuICBwcml2YXRlIGhhbmRsZUhlbGxvKGRhdGE6IHsgaGVhcnRiZWF0X2ludGVydmFsOiBudW1iZXIgfSk6IHZvaWQge1xyXG4gICAgdGhpcy5lbWl0KCdkZWJ1ZycsIGBSZWNlaXZlZCBIZWxsbywgaGVhcnRiZWF0IGludGVydmFsOiAke2RhdGEuaGVhcnRiZWF0X2ludGVydmFsfW1zYCk7XHJcbiAgICB0aGlzLnN0YXJ0SGVhcnRiZWF0KGRhdGEuaGVhcnRiZWF0X2ludGVydmFsKTtcclxuICAgIHRoaXMuaWRlbnRpZnkoKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZSBEaXNwYXRjaCBldmVudHNcclxuICAgKi9cclxuICBwcml2YXRlIGhhbmRsZURpc3BhdGNoKGV2ZW50VHlwZTogc3RyaW5nLCBkYXRhOiBhbnkpOiB2b2lkIHtcclxuICAgIHRoaXMuZW1pdCgnZGVidWcnLCBgRGlzcGF0Y2g6ICR7ZXZlbnRUeXBlfWApO1xyXG4gICAgXHJcbiAgICBzd2l0Y2ggKGV2ZW50VHlwZSkge1xyXG4gICAgICBjYXNlICdSRUFEWSc6XHJcbiAgICAgICAgdGhpcy5oYW5kbGVSZWFkeShkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnR1VJTERfQ1JFQVRFJzpcclxuICAgICAgICB0aGlzLmhhbmRsZUd1aWxkQ3JlYXRlKGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdHVUlMRF9VUERBVEUnOlxyXG4gICAgICAgIHRoaXMuaGFuZGxlR3VpbGRVcGRhdGUoZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ0dVSUxEX0RFTEVURSc6XHJcbiAgICAgICAgdGhpcy5oYW5kbGVHdWlsZERlbGV0ZShkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnTUVTU0FHRV9DUkVBVEUnOlxyXG4gICAgICAgIHRoaXMuaGFuZGxlTWVzc2FnZUNyZWF0ZShkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnTUVTU0FHRV9VUERBVEUnOlxyXG4gICAgICAgIHRoaXMuZW1pdCgnbWVzc2FnZVVwZGF0ZScsIGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdNRVNTQUdFX0RFTEVURSc6XHJcbiAgICAgICAgdGhpcy5lbWl0KCdtZXNzYWdlRGVsZXRlJywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ01FU1NBR0VfREVMRVRFX0JVTEsnOlxyXG4gICAgICAgIHRoaXMuZW1pdCgnbWVzc2FnZURlbGV0ZUJ1bGsnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnQ0hBTk5FTF9DUkVBVEUnOiB7XHJcbiAgICAgICAgLy8gVXBkYXRlIGd1aWxkIGNoYW5uZWwgY2FjaGVcclxuICAgICAgICBjb25zdCBndWlsZElkID0gZGF0YS5ndWlsZF9pZDtcclxuICAgICAgICBjb25zdCBjaGFubmVsSWQgPSBkYXRhLmlkIHx8IGRhdGEuY2hhbm5lbF9pZDtcclxuICAgICAgICBpZiAoZ3VpbGRJZCAmJiBjaGFubmVsSWQpIHtcclxuICAgICAgICAgIGNvbnN0IGd1aWxkID0gdGhpcy5ndWlsZHMuZ2V0KGd1aWxkSWQpO1xyXG4gICAgICAgICAgaWYgKGd1aWxkKSB7XHJcbiAgICAgICAgICAgIGd1aWxkLmNoYW5uZWxzLnNldChjaGFubmVsSWQsIGRhdGEpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmVtaXQoJ2NoYW5uZWxDcmVhdGUnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdDSEFOTkVMX1VQREFURSc6IHtcclxuICAgICAgICBjb25zdCBndWlsZElkID0gZGF0YS5ndWlsZF9pZDtcclxuICAgICAgICBjb25zdCBjaGFubmVsSWQgPSBkYXRhLmlkIHx8IGRhdGEuY2hhbm5lbF9pZDtcclxuICAgICAgICBpZiAoZ3VpbGRJZCAmJiBjaGFubmVsSWQpIHtcclxuICAgICAgICAgIGNvbnN0IGd1aWxkID0gdGhpcy5ndWlsZHMuZ2V0KGd1aWxkSWQpO1xyXG4gICAgICAgICAgaWYgKGd1aWxkKSB7XHJcbiAgICAgICAgICAgIGd1aWxkLmNoYW5uZWxzLnNldChjaGFubmVsSWQsIGRhdGEpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmVtaXQoJ2NoYW5uZWxVcGRhdGUnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdDSEFOTkVMX0RFTEVURSc6IHtcclxuICAgICAgICBjb25zdCBndWlsZElkID0gZGF0YS5ndWlsZF9pZDtcclxuICAgICAgICBjb25zdCBjaGFubmVsSWQgPSBkYXRhLmlkIHx8IGRhdGEuY2hhbm5lbF9pZDtcclxuICAgICAgICBpZiAoZ3VpbGRJZCAmJiBjaGFubmVsSWQpIHtcclxuICAgICAgICAgIGNvbnN0IGd1aWxkID0gdGhpcy5ndWlsZHMuZ2V0KGd1aWxkSWQpO1xyXG4gICAgICAgICAgaWYgKGd1aWxkKSB7XHJcbiAgICAgICAgICAgIGd1aWxkLmNoYW5uZWxzLmRlbGV0ZShjaGFubmVsSWQpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmVtaXQoJ2NoYW5uZWxEZWxldGUnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdHVUlMRF9NRU1CRVJfQUREJzpcclxuICAgICAgICB0aGlzLmVtaXQoJ2d1aWxkTWVtYmVyQWRkJywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ0dVSUxEX01FTUJFUl9VUERBVEUnOlxyXG4gICAgICAgIHRoaXMuZW1pdCgnZ3VpbGRNZW1iZXJVcGRhdGUnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnR1VJTERfTUVNQkVSX1JFTU9WRSc6XHJcbiAgICAgICAgdGhpcy5lbWl0KCdndWlsZE1lbWJlclJlbW92ZScsIGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdHVUlMRF9ST0xFX0NSRUFURSc6XHJcbiAgICAgICAgdGhpcy5lbWl0KCdyb2xlQ3JlYXRlJywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ0dVSUxEX1JPTEVfVVBEQVRFJzpcclxuICAgICAgICB0aGlzLmVtaXQoJ3JvbGVVcGRhdGUnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnR1VJTERfUk9MRV9ERUxFVEUnOlxyXG4gICAgICAgIHRoaXMuZW1pdCgncm9sZURlbGV0ZScsIGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdHVUlMRF9CQU5fQUREJzpcclxuICAgICAgICB0aGlzLmVtaXQoJ2d1aWxkQmFuQWRkJywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ0dVSUxEX0JBTl9SRU1PVkUnOlxyXG4gICAgICAgIHRoaXMuZW1pdCgnZ3VpbGRCYW5SZW1vdmUnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnSU5WSVRFX0NSRUFURSc6XHJcbiAgICAgICAgdGhpcy5lbWl0KCdpbnZpdGVDcmVhdGUnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnSU5WSVRFX0RFTEVURSc6XHJcbiAgICAgICAgdGhpcy5lbWl0KCdpbnZpdGVEZWxldGUnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnVFlQSU5HX1NUQVJUJzpcclxuICAgICAgICB0aGlzLmVtaXQoJ3R5cGluZ1N0YXJ0JywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ1BSRVNFTkNFX1VQREFURSc6XHJcbiAgICAgICAgdGhpcy5lbWl0KCdwcmVzZW5jZVVwZGF0ZScsIGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdJTlRFUkFDVElPTl9DUkVBVEUnOlxyXG4gICAgICAgIHRoaXMuaGFuZGxlSW50ZXJhY3Rpb25DcmVhdGUoZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ1ZPSUNFX1NUQVRFX1VQREFURSc6XHJcbiAgICAgICAgdGhpcy5oYW5kbGVWb2ljZVN0YXRlVXBkYXRlKGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdWT0lDRV9TRVJWRVJfVVBEQVRFJzpcclxuICAgICAgICB0aGlzLmhhbmRsZVZvaWNlU2VydmVyVXBkYXRlKGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBkZWZhdWx0OlxyXG4gICAgICAgIC8vIEVtaXQgcmF3IGV2ZW50IGZvciB1bmhhbmRsZWQgdHlwZXNcclxuICAgICAgICB0aGlzLmVtaXQoJ3JhdycsIHsgdDogZXZlbnRUeXBlLCBkOiBkYXRhIH0pO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSGFuZGxlIFJlYWR5IGV2ZW50XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBoYW5kbGVSZWFkeShkYXRhOiBSZWFkeUV2ZW50RGF0YSk6IHZvaWQge1xyXG4gICAgdGhpcy5zZXNzaW9uSWQgPSBkYXRhLnNlc3Npb25faWQ7XHJcbiAgICB0aGlzLnVzZXIgPSBuZXcgVXNlcihkYXRhLnVzZXIpO1xyXG4gICAgLy8gSGFuZGxlIGJvdGggc3RyaW5nIGFuZCBudW1iZXIgYXBwbGljYXRpb24gSURzXHJcbiAgICB0aGlzLmFwcGxpY2F0aW9uSWQgPSBkYXRhLmFwcGxpY2F0aW9uPy5pZCA/IFN0cmluZyhkYXRhLmFwcGxpY2F0aW9uLmlkKSA6IG51bGw7XHJcbiAgICBpZiAodGhpcy5hcHBsaWNhdGlvbklkKSB7XHJcbiAgICAgIHRoaXMucmVzdC5zZXRBcHBsaWNhdGlvbklkKHRoaXMuYXBwbGljYXRpb25JZCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIENhY2hlIGd1aWxkcyAoYXMgdW5hdmFpbGFibGUgaW5pdGlhbGx5KVxyXG4gICAgaWYgKGRhdGEuZ3VpbGRzKSB7XHJcbiAgICAgIGZvciAoY29uc3QgZ3VpbGQgb2YgZGF0YS5ndWlsZHMpIHtcclxuICAgICAgICB0aGlzLmd1aWxkcy5zZXQoU3RyaW5nKGd1aWxkLmlkKSwgbmV3IEd1aWxkKHRoaXMsIGd1aWxkKSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgLy8gU2V0dXAgdm9pY2UgYWRhcHRlcnMgZm9yIGVhY2ggZ3VpbGRcclxuICAgIHRoaXMuc2V0dXBWb2ljZUFkYXB0ZXJzKCk7XHJcbiAgICBcclxuICAgIGNvbnNvbGUubG9nKGDinIUgQm90IGhhesSxciEgVXNlcjogJHt0aGlzLnVzZXIudXNlcm5hbWV9ICgke3RoaXMudXNlci5pZH0pLCBBcHA6ICR7dGhpcy5hcHBsaWNhdGlvbklkfWApO1xyXG4gICAgdGhpcy5lbWl0KCdyZWFkeScsIHRoaXMpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2V0dXAgdm9pY2UgYWRhcHRlcnMgZm9yIGFsbCBndWlsZHNcclxuICAgKi9cclxuICBwcml2YXRlIHNldHVwVm9pY2VBZGFwdGVycygpOiB2b2lkIHtcclxuICAgIGZvciAoY29uc3QgW2d1aWxkSWRdIG9mIHRoaXMuZ3VpbGRzKSB7XHJcbiAgICAgIHRoaXMuY3JlYXRlVm9pY2VBZGFwdGVyKGd1aWxkSWQpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgdm9pY2UgYWRhcHRlciBmb3IgYSBndWlsZFxyXG4gICAqL1xyXG4gIHByaXZhdGUgY3JlYXRlVm9pY2VBZGFwdGVyKGd1aWxkSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgYWRhcHRlcjogVm9pY2VBZGFwdGVyQ3JlYXRvciA9IChtZXRob2RzKSA9PiB7XHJcbiAgICAgIC8vIFN0b3JlIGhhbmRsZXJzIGZvciB0aGlzIGd1aWxkXHJcbiAgICAgIHRoaXMudm9pY2VTdGF0ZUhhbmRsZXJzLnNldChndWlsZElkLCBtZXRob2RzLm9uVm9pY2VTdGF0ZVVwZGF0ZSk7XHJcbiAgICAgIHRoaXMudm9pY2VTZXJ2ZXJIYW5kbGVycy5zZXQoZ3VpbGRJZCwgbWV0aG9kcy5vblZvaWNlU2VydmVyVXBkYXRlKTtcclxuICAgICAgXHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAgc2VuZFBheWxvYWQ6IChwYXlsb2FkKSA9PiB7XHJcbiAgICAgICAgICBpZiAodGhpcy53cz8ucmVhZHlTdGF0ZSA9PT0gV2ViU29ja2V0Lk9QRU4pIHtcclxuICAgICAgICAgICAgdGhpcy53cy5zZW5kKEpTT04uc3RyaW5naWZ5KHBheWxvYWQpKTtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBkZXN0cm95OiAoKSA9PiB7XHJcbiAgICAgICAgICB0aGlzLnZvaWNlU3RhdGVIYW5kbGVycy5kZWxldGUoZ3VpbGRJZCk7XHJcbiAgICAgICAgICB0aGlzLnZvaWNlU2VydmVySGFuZGxlcnMuZGVsZXRlKGd1aWxkSWQpO1xyXG4gICAgICAgIH1cclxuICAgICAgfTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMudm9pY2UuYWRhcHRlcnMuc2V0KGd1aWxkSWQsIGFkYXB0ZXIpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSGFuZGxlIEd1aWxkIENyZWF0ZSBldmVudFxyXG4gICAqL1xyXG4gIHByaXZhdGUgaGFuZGxlR3VpbGRDcmVhdGUoZGF0YTogQVBJR3VpbGQpOiB2b2lkIHtcclxuICAgIGxldCBndWlsZCA9IHRoaXMuZ3VpbGRzLmdldChkYXRhLmlkKTtcclxuICAgIFxyXG4gICAgaWYgKGd1aWxkKSB7XHJcbiAgICAgIGd1aWxkLl9wYXRjaChkYXRhKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGd1aWxkID0gbmV3IEd1aWxkKHRoaXMsIGRhdGEpO1xyXG4gICAgICB0aGlzLmd1aWxkcy5zZXQoZGF0YS5pZCwgZ3VpbGQpO1xyXG4gICAgICB0aGlzLmNyZWF0ZVZvaWNlQWRhcHRlcihkYXRhLmlkKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgdGhpcy5lbWl0KCdndWlsZENyZWF0ZScsIGd1aWxkKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZSBHdWlsZCBVcGRhdGUgZXZlbnRcclxuICAgKi9cclxuICBwcml2YXRlIGhhbmRsZUd1aWxkVXBkYXRlKGRhdGE6IEFQSUd1aWxkKTogdm9pZCB7XHJcbiAgICBjb25zdCBndWlsZCA9IHRoaXMuZ3VpbGRzLmdldChkYXRhLmlkKTtcclxuICAgIGlmIChndWlsZCkge1xyXG4gICAgICBndWlsZC5fcGF0Y2goZGF0YSk7XHJcbiAgICAgIHRoaXMuZW1pdCgnZ3VpbGRVcGRhdGUnLCBndWlsZCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBIYW5kbGUgR3VpbGQgRGVsZXRlIGV2ZW50XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBoYW5kbGVHdWlsZERlbGV0ZShkYXRhOiB7IGlkOiBzdHJpbmcgfSk6IHZvaWQge1xyXG4gICAgY29uc3QgZ3VpbGQgPSB0aGlzLmd1aWxkcy5nZXQoZGF0YS5pZCk7XHJcbiAgICBpZiAoZ3VpbGQpIHtcclxuICAgICAgdGhpcy5ndWlsZHMuZGVsZXRlKGRhdGEuaWQpO1xyXG4gICAgICB0aGlzLnZvaWNlLmFkYXB0ZXJzLmRlbGV0ZShkYXRhLmlkKTtcclxuICAgICAgdGhpcy5lbWl0KCdndWlsZERlbGV0ZScsIGd1aWxkKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZSBNZXNzYWdlIENyZWF0ZSBldmVudFxyXG4gICAqL1xyXG4gIHByaXZhdGUgaGFuZGxlTWVzc2FnZUNyZWF0ZShkYXRhOiBBUElNZXNzYWdlKTogdm9pZCB7XHJcbiAgICAvLyBCYWNrZW5kIHNlbmRzIHVzZXJfaWQgc2VwYXJhdGVseSwgbWFwIGl0IHRvIGF1dGhvci5pZCBmb3IgY29tcGF0aWJpbGl0eVxyXG4gICAgaWYgKGRhdGEudXNlcl9pZCAmJiBkYXRhLmF1dGhvciAmJiAhZGF0YS5hdXRob3IuaWQpIHtcclxuICAgICAgKGRhdGEuYXV0aG9yIGFzIGFueSkuaWQgPSBkYXRhLnVzZXJfaWQ7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIENhY2hlIHRoZSBhdXRob3JcclxuICAgIGlmIChkYXRhLmF1dGhvcikge1xyXG4gICAgICBjb25zdCB1c2VyID0gbmV3IFVzZXIoZGF0YS5hdXRob3IpO1xyXG4gICAgICB0aGlzLnVzZXJzLnNldCh1c2VyLmlkLCB1c2VyKTtcclxuICAgICAgLy8gQWxzbyBjYWNoZSBpbiBSRVNUIGZvciBtZW50aW9uIHJlc29sdXRpb25cclxuICAgICAgdGhpcy5yZXN0LmNhY2hlVXNlcihkYXRhLmF1dGhvcik7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGNvbnN0IG1lc3NhZ2UgPSBuZXcgTWVzc2FnZSh0aGlzLCBkYXRhKTtcclxuXHJcbiAgICAvLyBNYXJrIG1lc3NhZ2UgYXMgZnJvbSBib3QgaWYgYXV0aG9yIElEIG1hdGNoZXMgdGhlIGJvdCdzIG93biB1c2VyIElEXHJcbiAgICBpZiAodGhpcy51c2VyICYmIFN0cmluZyhtZXNzYWdlLmF1dGhvci5pZCkgPT09IFN0cmluZyh0aGlzLnVzZXIuaWQpKSB7XHJcbiAgICAgIChtZXNzYWdlLmF1dGhvciBhcyBhbnkpLmJvdCA9IHRydWU7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5lbWl0KCdtZXNzYWdlQ3JlYXRlJywgbWVzc2FnZSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBIYW5kbGUgSW50ZXJhY3Rpb24gQ3JlYXRlIGV2ZW50XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBoYW5kbGVJbnRlcmFjdGlvbkNyZWF0ZShkYXRhOiBBUElJbnRlcmFjdGlvbik6IHZvaWQge1xyXG4gICAgY29uc29sZS5sb2coJ1tERUJVR10gaGFuZGxlSW50ZXJhY3Rpb25DcmVhdGUgY2FsbGVkIHdpdGg6JywgSlNPTi5zdHJpbmdpZnkoZGF0YSwgbnVsbCwgMikpO1xyXG4gICAgXHJcbiAgICAvLyBDYWNoZSB0aGUgdXNlclxyXG4gICAgY29uc3QgdXNlckRhdGEgPSBkYXRhLm1lbWJlcj8udXNlciB8fCBkYXRhLnVzZXI7XHJcbiAgICBpZiAodXNlckRhdGEpIHtcclxuICAgICAgY29uc3QgdXNlciA9IG5ldyBVc2VyKHVzZXJEYXRhKTtcclxuICAgICAgdGhpcy51c2Vycy5zZXQodXNlci5pZCwgdXNlcik7XHJcbiAgICAgIHRoaXMucmVzdC5jYWNoZVVzZXIodXNlckRhdGEpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBjb25zdCBpbnRlcmFjdGlvbiA9IGNyZWF0ZUludGVyYWN0aW9uKHRoaXMsIGRhdGEpO1xyXG4gICAgY29uc29sZS5sb2coJ1tERUJVR10gQ3JlYXRlZCBpbnRlcmFjdGlvbiB0eXBlOicsIGludGVyYWN0aW9uLmNvbnN0cnVjdG9yLm5hbWUsICdjdXN0b21JZDonLCAoaW50ZXJhY3Rpb24gYXMgYW55KS5jdXN0b21JZCk7XHJcbiAgICB0aGlzLmVtaXQoJ2ludGVyYWN0aW9uQ3JlYXRlJywgaW50ZXJhY3Rpb24pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSGFuZGxlIFZvaWNlIFN0YXRlIFVwZGF0ZSBldmVudFxyXG4gICAqL1xyXG4gIHByaXZhdGUgaGFuZGxlVm9pY2VTdGF0ZVVwZGF0ZShkYXRhOiBhbnkpOiB2b2lkIHtcclxuICAgIGNvbnN0IGd1aWxkSWQgPSBkYXRhLmd1aWxkX2lkO1xyXG4gICAgXHJcbiAgICAvLyBGb3J3YXJkIHRvIHZvaWNlIGFkYXB0ZXIgaWYgZXhpc3RzXHJcbiAgICBjb25zdCBoYW5kbGVyID0gdGhpcy52b2ljZVN0YXRlSGFuZGxlcnMuZ2V0KGd1aWxkSWQpO1xyXG4gICAgaWYgKGhhbmRsZXIpIHtcclxuICAgICAgaGFuZGxlcihkYXRhKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgdGhpcy5lbWl0KCd2b2ljZVN0YXRlVXBkYXRlJywgZGF0YSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBIYW5kbGUgVm9pY2UgU2VydmVyIFVwZGF0ZSBldmVudFxyXG4gICAqL1xyXG4gIHByaXZhdGUgaGFuZGxlVm9pY2VTZXJ2ZXJVcGRhdGUoZGF0YTogQVBJVm9pY2VTZXJ2ZXJVcGRhdGUpOiB2b2lkIHtcclxuICAgIGNvbnN0IGd1aWxkSWQgPSBkYXRhLmd1aWxkX2lkO1xyXG4gICAgXHJcbiAgICAvLyBGb3J3YXJkIHRvIHZvaWNlIGFkYXB0ZXIgaWYgZXhpc3RzXHJcbiAgICBjb25zdCBoYW5kbGVyID0gdGhpcy52b2ljZVNlcnZlckhhbmRsZXJzLmdldChndWlsZElkKTtcclxuICAgIGlmIChoYW5kbGVyKSB7XHJcbiAgICAgIGhhbmRsZXIoe1xyXG4gICAgICAgIHRva2VuOiBkYXRhLnRva2VuLFxyXG4gICAgICAgIGVuZHBvaW50OiBkYXRhLmVuZHBvaW50LFxyXG4gICAgICAgIHJvb206IGRhdGEucm9vbVxyXG4gICAgICB9KTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgdGhpcy5lbWl0KCd2b2ljZVNlcnZlclVwZGF0ZScsIGRhdGEpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2VuZCBJZGVudGlmeSBwYXlsb2FkXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBpZGVudGlmeSgpOiB2b2lkIHtcclxuICAgIGNvbnN0IHBheWxvYWQ6IEdhdGV3YXlQYXlsb2FkID0ge1xyXG4gICAgICBvcDogR2F0ZXdheU9wY29kZXMuSWRlbnRpZnksXHJcbiAgICAgIGQ6IHtcclxuICAgICAgICB0b2tlbjogYEJvdCAke3RoaXMudG9rZW59YCxcclxuICAgICAgICBpbnRlbnRzOiB0aGlzLmdldEludGVudHNWYWx1ZSgpLFxyXG4gICAgICAgIHNoYXJkOiB0aGlzLm9wdGlvbnMuc2hhcmRzIHx8IFswLCAxXVxyXG4gICAgICB9XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLnNlbmQocGF5bG9hZCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTdGFydCBoZWFydGJlYXRcclxuICAgKi9cclxuICBwcml2YXRlIHN0YXJ0SGVhcnRiZWF0KGludGVydmFsOiBudW1iZXIpOiB2b2lkIHtcclxuICAgIHRoaXMuaGVhcnRiZWF0SW50ZXJ2YWwgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XHJcbiAgICAgIHRoaXMuc2VuZCh7XHJcbiAgICAgICAgb3A6IEdhdGV3YXlPcGNvZGVzLkhlYXJ0YmVhdCxcclxuICAgICAgICBkOiB0aGlzLnNlcXVlbmNlXHJcbiAgICAgIH0pO1xyXG4gICAgfSwgaW50ZXJ2YWwpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2VuZCBwYXlsb2FkIHRvIGdhdGV3YXlcclxuICAgKi9cclxuICBwcml2YXRlIHNlbmQocGF5bG9hZDogR2F0ZXdheVBheWxvYWQpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLndzPy5yZWFkeVN0YXRlID09PSBXZWJTb2NrZXQuT1BFTikge1xyXG4gICAgICB0aGlzLndzLnNlbmQoSlNPTi5zdHJpbmdpZnkocGF5bG9hZCkpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2xlYW51cCBvbiBkaXNjb25uZWN0XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBjbGVhbnVwKCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMuaGVhcnRiZWF0SW50ZXJ2YWwpIHtcclxuICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLmhlYXJ0YmVhdEludGVydmFsKTtcclxuICAgICAgdGhpcy5oZWFydGJlYXRJbnRlcnZhbCA9IG51bGw7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZXN0cm95IHRoZSBjbGllbnRcclxuICAgKi9cclxuICBkZXN0cm95KCk6IHZvaWQge1xyXG4gICAgdGhpcy5fbG9naW5TdGF0ZSA9ICdpZGxlJztcclxuICAgIHRoaXMuX3JlY29ubmVjdEF0dGVtcHRzID0gdGhpcy5fbWF4UmVjb25uZWN0QXR0ZW1wdHMgKyAxOyAvLyBQcmV2ZW50IHJlY29ubmVjdFxyXG4gICAgdGhpcy5jbGVhbnVwKCk7XHJcbiAgICB0aGlzLndzPy5jbG9zZSgxMDAwKTtcclxuICAgIHRoaXMud3MgPSBudWxsO1xyXG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoKTtcclxuICB9XHJcbn1cclxuXHJcbi8vIFJlLWV4cG9ydCBmb3IgY29udmVuaWVuY2VcclxuZXhwb3J0IHsgR2F0ZXdheUludGVudEJpdHMgfTtcclxuIl19