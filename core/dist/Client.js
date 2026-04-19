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
    /** Last heartbeat sent timestamp (for ping calculation) */
    _lastHeartbeatSent = 0;
    /** WebSocket ping (round-trip latency in ms) */
    ping = -1;
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
                if (this._lastHeartbeatSent > 0) {
                    this.ping = Date.now() - this._lastHeartbeatSent;
                }
                this.emit('debug', `Heartbeat acknowledged (ping: ${this.ping}ms)`);
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
            case 'GUILD_MEMBER_ADD': {
                const guild = this.guilds.get(String(data.guild_id));
                if (guild && data.user) {
                    const member = guild._addMember(data);
                    this.emit('guildMemberAdd', member);
                }
                else {
                    this.emit('guildMemberAdd', data);
                }
                break;
            }
            case 'GUILD_MEMBER_UPDATE': {
                const guild = this.guilds.get(String(data.guild_id));
                const rawUserId = data.user?.id || data.user_id;
                if (guild && rawUserId) {
                    const existing = guild.members.get(String(rawUserId));
                    if (existing) {
                        existing._patch(data);
                        this.emit('guildMemberUpdate', existing);
                    }
                    else {
                        this.emit('guildMemberUpdate', data);
                    }
                }
                else {
                    this.emit('guildMemberUpdate', data);
                }
                break;
            }
            case 'GUILD_MEMBER_REMOVE': {
                const guild = this.guilds.get(String(data.guild_id));
                const rawUserId = data.user?.id || data.user_id;
                if (guild && rawUserId) {
                    const userId = String(rawUserId);
                    const member = guild.members.get(userId);
                    guild.members.delete(userId);
                    this.emit('guildMemberRemove', member || data);
                }
                else {
                    this.emit('guildMemberRemove', data);
                }
                break;
            }
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
        // Signal shard manager that this shard is ready (if running as a shard)
        if (process.send) {
            process.send({ _ready: true });
        }
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
        // Resolve guild member if in a guild
        if (message.guildId) {
            const guild = this.guilds.get(message.guildId);
            const memberData = data.member;
            if (memberData && guild) {
                // Gateway sent member data with the message — cache it
                memberData.user = data.author;
                const member = guild._addMember(memberData);
                message.member = member;
            }
            else if (memberData) {
                // No guild in cache but member data exists
                memberData.user = data.author;
                const resolvedGuild = { id: message.guildId, ownerId: null };
                message.member = new (require('./structures/GuildMember').GuildMember)(this, resolvedGuild, memberData);
            }
            else if (guild) {
                // Try cache
                const cached = guild.members?.get(String(message.author.id));
                if (cached?.permissions?.has) {
                    message.member = cached;
                }
            }
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
            this._lastHeartbeatSent = Date.now();
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ2xpZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL0NsaWVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxtQ0FBc0M7QUFDdEMsNENBQTJCO0FBWTNCLG1DQUE0RDtBQW93Qm5ELGtHQXB3QmdCLHlCQUFpQixPQW93QmhCO0FBbndCMUIsd0RBQXFEO0FBQ3JELDRDQUF5QztBQUN6Qyw4Q0FBMkM7QUFDM0Msa0RBQStDO0FBQy9DLDBEQUEwRTtBQUUxRSxzQ0FBbUM7QUFjbkM7O0dBRUc7QUFDSCxNQUFhLE1BQU8sU0FBUSxxQkFBWTtJQUN0QyxxQkFBcUI7SUFDTCxPQUFPLENBQWdCO0lBRXZDLHNCQUFzQjtJQUNOLElBQUksQ0FBTztJQUUzQixtQkFBbUI7SUFDWixJQUFJLEdBQWdCLElBQUksQ0FBQztJQUVoQyxxQkFBcUI7SUFDZCxhQUFhLEdBQWtCLElBQUksQ0FBQztJQUUzQyxvQkFBb0I7SUFDYixNQUFNLEdBQThCLElBQUksdUJBQVUsRUFBRSxDQUFDO0lBRTVELHNCQUFzQjtJQUNmLFFBQVEsR0FBb0MsSUFBSSx1QkFBVSxFQUFFLENBQUM7SUFFcEUsbUJBQW1CO0lBQ1osS0FBSyxHQUE2QixJQUFJLHVCQUFVLEVBQUUsQ0FBQztJQUUxRCwrQkFBK0I7SUFDeEIsS0FBSyxDQUVWO0lBRUYsMkJBQTJCO0lBQ25CLEVBQUUsR0FBcUIsSUFBSSxDQUFDO0lBRXBDLGdCQUFnQjtJQUNSLEtBQUssR0FBVyxFQUFFLENBQUM7SUFFM0IsaUJBQWlCO0lBQ1QsU0FBUyxHQUFrQixJQUFJLENBQUM7SUFFeEMsc0JBQXNCO0lBQ2QsUUFBUSxHQUFrQixJQUFJLENBQUM7SUFFdkMseUJBQXlCO0lBQ2pCLGlCQUFpQixHQUEwQixJQUFJLENBQUM7SUFFeEQsa0JBQWtCO0lBQ1YsVUFBVSxDQUFTO0lBRTNCLDJEQUEyRDtJQUNuRCxrQkFBa0IsR0FBVyxDQUFDLENBQUM7SUFFdkMsZ0RBQWdEO0lBQ3pDLElBQUks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RUFBRSxDQUFDO1lBQzNDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUN4QyxDQUFDO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0ssT0FBTztRQUNiLElBQUksSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7WUFDM0IsYUFBYSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1lBQ3RDLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLENBQUM7UUFDaEMsQ0FBQztJQUNILENBQUM7SUFFRDs7T0FFRztJQUNILE9BQU87UUFDTCxJQUFJLENBQUMsV0FBVyxHQUFHLE1BQU0sQ0FBQztRQUMxQixJQUFJLENBQUMsa0JBQWtCLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixHQUFHLENBQUMsQ0FBQyxDQUFDLG9CQUFvQjtRQUM5RSxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDZixJQUFJLENBQUMsRUFBRSxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNyQixJQUFJLENBQUMsRUFBRSxHQUFHLElBQUksQ0FBQztRQUNmLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO0lBQzVCLENBQUM7O0FBeHVCSCx3QkF5dUJDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRXZlbnRFbWl0dGVyIH0gZnJvbSAnZXZlbnRzJztcclxuaW1wb3J0IFdlYlNvY2tldCBmcm9tICd3cyc7XHJcbmltcG9ydCB7IFxyXG4gIENsaWVudE9wdGlvbnMsIFxyXG4gIEdhdGV3YXlQYXlsb2FkLCBcclxuICBSZWFkeUV2ZW50RGF0YSxcclxuICBBUElHdWlsZCxcclxuICBBUElJbnRlcmFjdGlvbixcclxuICBBUElNZXNzYWdlLFxyXG4gIEFQSVZvaWNlU2VydmVyVXBkYXRlLFxyXG4gIEFQSUNoYW5uZWwsXHJcbiAgQVBJVXNlclxyXG59IGZyb20gJy4vdHlwZXMnO1xyXG5pbXBvcnQgeyBHYXRld2F5T3Bjb2RlcywgR2F0ZXdheUludGVudEJpdHMgfSBmcm9tICcuL2VudW1zJztcclxuaW1wb3J0IHsgQ29sbGVjdGlvbiB9IGZyb20gJy4vc3RydWN0dXJlcy9Db2xsZWN0aW9uJztcclxuaW1wb3J0IHsgVXNlciB9IGZyb20gJy4vc3RydWN0dXJlcy9Vc2VyJztcclxuaW1wb3J0IHsgR3VpbGQgfSBmcm9tICcuL3N0cnVjdHVyZXMvR3VpbGQnO1xyXG5pbXBvcnQgeyBNZXNzYWdlIH0gZnJvbSAnLi9zdHJ1Y3R1cmVzL01lc3NhZ2UnO1xyXG5pbXBvcnQgeyBjcmVhdGVJbnRlcmFjdGlvbiwgSW50ZXJhY3Rpb24gfSBmcm9tICcuL3N0cnVjdHVyZXMvSW50ZXJhY3Rpb24nO1xyXG5pbXBvcnQgeyBCYXNlQ2hhbm5lbCwgY3JlYXRlQ2hhbm5lbCB9IGZyb20gJy4vc3RydWN0dXJlcy9DaGFubmVsJztcclxuaW1wb3J0IHsgUkVTVCB9IGZyb20gJy4vcmVzdC9SRVNUJztcclxuXHJcbi8qKlxyXG4gKiBWb2ljZSBhZGFwdGVyIGNyZWF0b3IgdHlwZSBmb3IgQGp1YmJpby92b2ljZSBjb21wYXRpYmlsaXR5XHJcbiAqL1xyXG50eXBlIFZvaWNlQWRhcHRlckNyZWF0b3IgPSAobWV0aG9kczoge1xyXG4gIG9uVm9pY2VTZXJ2ZXJVcGRhdGUoZGF0YTogYW55KTogdm9pZDtcclxuICBvblZvaWNlU3RhdGVVcGRhdGUoZGF0YTogYW55KTogdm9pZDtcclxuICBkZXN0cm95KCk6IHZvaWQ7XHJcbn0pID0+IHtcclxuICBzZW5kUGF5bG9hZChwYXlsb2FkOiBhbnkpOiBib29sZWFuO1xyXG4gIGRlc3Ryb3koKTogdm9pZDtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBNYWluIGNsaWVudCBjbGFzc1xyXG4gKi9cclxuZXhwb3J0IGNsYXNzIENsaWVudCBleHRlbmRzIEV2ZW50RW1pdHRlciB7XHJcbiAgLyoqIENsaWVudCBvcHRpb25zICovXHJcbiAgcHVibGljIHJlYWRvbmx5IG9wdGlvbnM6IENsaWVudE9wdGlvbnM7XHJcbiAgXHJcbiAgLyoqIFJFU1QgQVBJIGNsaWVudCAqL1xyXG4gIHB1YmxpYyByZWFkb25seSByZXN0OiBSRVNUO1xyXG4gIFxyXG4gIC8qKiBUaGUgYm90IHVzZXIgKi9cclxuICBwdWJsaWMgdXNlcjogVXNlciB8IG51bGwgPSBudWxsO1xyXG4gIFxyXG4gIC8qKiBBcHBsaWNhdGlvbiBJRCAqL1xyXG4gIHB1YmxpYyBhcHBsaWNhdGlvbklkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcclxuICBcclxuICAvKiogQ2FjaGVkIGd1aWxkcyAqL1xyXG4gIHB1YmxpYyBndWlsZHM6IENvbGxlY3Rpb248c3RyaW5nLCBHdWlsZD4gPSBuZXcgQ29sbGVjdGlvbigpO1xyXG4gIFxyXG4gIC8qKiBDYWNoZWQgY2hhbm5lbHMgKi9cclxuICBwdWJsaWMgY2hhbm5lbHM6IENvbGxlY3Rpb248c3RyaW5nLCBCYXNlQ2hhbm5lbD4gPSBuZXcgQ29sbGVjdGlvbigpO1xyXG4gIFxyXG4gIC8qKiBDYWNoZWQgdXNlcnMgKi9cclxuICBwdWJsaWMgdXNlcnM6IENvbGxlY3Rpb248c3RyaW5nLCBVc2VyPiA9IG5ldyBDb2xsZWN0aW9uKCk7XHJcbiAgXHJcbiAgLyoqIFZvaWNlIGFkYXB0ZXIgbWFuYWdlbWVudCAqL1xyXG4gIHB1YmxpYyB2b2ljZToge1xyXG4gICAgYWRhcHRlcnM6IE1hcDxzdHJpbmcsIFZvaWNlQWRhcHRlckNyZWF0b3I+O1xyXG4gIH07XHJcbiAgXHJcbiAgLyoqIFdlYlNvY2tldCBjb25uZWN0aW9uICovXHJcbiAgcHJpdmF0ZSB3czogV2ViU29ja2V0IHwgbnVsbCA9IG51bGw7XHJcbiAgXHJcbiAgLyoqIEJvdCB0b2tlbiAqL1xyXG4gIHByaXZhdGUgdG9rZW46IHN0cmluZyA9ICcnO1xyXG4gIFxyXG4gIC8qKiBTZXNzaW9uIElEICovXHJcbiAgcHJpdmF0ZSBzZXNzaW9uSWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xyXG4gIFxyXG4gIC8qKiBTZXF1ZW5jZSBudW1iZXIgKi9cclxuICBwcml2YXRlIHNlcXVlbmNlOiBudW1iZXIgfCBudWxsID0gbnVsbDtcclxuICBcclxuICAvKiogSGVhcnRiZWF0IGludGVydmFsICovXHJcbiAgcHJpdmF0ZSBoZWFydGJlYXRJbnRlcnZhbDogTm9kZUpTLlRpbWVvdXQgfCBudWxsID0gbnVsbDtcclxuICBcclxuICAvKiogR2F0ZXdheSBVUkwgKi9cclxuICBwcml2YXRlIGdhdGV3YXlVcmw6IHN0cmluZztcclxuXHJcbiAgLyoqIExhc3QgaGVhcnRiZWF0IHNlbnQgdGltZXN0YW1wIChmb3IgcGluZyBjYWxjdWxhdGlvbikgKi9cclxuICBwcml2YXRlIF9sYXN0SGVhcnRiZWF0U2VudDogbnVtYmVyID0gMDtcclxuXHJcbiAgLyoqIFdlYlNvY2tldCBwaW5nIChyb3VuZC10cmlwIGxhdGVuY3kgaW4gbXMpICovXHJcbiAgcHVibGljIHBpbmc6IG51bWJlciA9IC0xO1xyXG4gIFxyXG4gIC8qKiBWb2ljZSBzdGF0ZSB1cGRhdGUgaGFuZGxlcnMgKGZvciB2b2ljZSBhZGFwdGVycykgKi9cclxuICBwcml2YXRlIHZvaWNlU3RhdGVIYW5kbGVyczogTWFwPHN0cmluZywgKGRhdGE6IGFueSkgPT4gdm9pZD4gPSBuZXcgTWFwKCk7XHJcbiAgcHJpdmF0ZSB2b2ljZVNlcnZlckhhbmRsZXJzOiBNYXA8c3RyaW5nLCAoZGF0YTogYW55KSA9PiB2b2lkPiA9IG5ldyBNYXAoKTtcclxuXHJcbiAgLyoqIFdoZXRoZXIgdGhlIGNsaWVudCBpcyBjdXJyZW50bHkgaW4gdGhlIGxvZ2luIGZsb3cgKi9cclxuICBwcml2YXRlIF9sb2dpblN0YXRlOiAnaWRsZScgfCAnY29ubmVjdGluZycgfCAncmVhZHknID0gJ2lkbGUnO1xyXG5cclxuICAvKiogUmVjb25uZWN0IGF0dGVtcHQgY291bnRlciAqL1xyXG4gIHByaXZhdGUgX3JlY29ubmVjdEF0dGVtcHRzOiBudW1iZXIgPSAwO1xyXG5cclxuICAvKiogTWF4aW11bSByZWNvbm5lY3QgYXR0ZW1wdHMgYmVmb3JlIGdpdmluZyB1cCAqL1xyXG4gIHByaXZhdGUgcmVhZG9ubHkgX21heFJlY29ubmVjdEF0dGVtcHRzOiBudW1iZXIgPSA1O1xyXG5cclxuICBjb25zdHJ1Y3RvcihvcHRpb25zOiBDbGllbnRPcHRpb25zKSB7XHJcbiAgICBzdXBlcigpO1xyXG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcclxuICAgIHRoaXMuZ2F0ZXdheVVybCA9IG9wdGlvbnMuZ2F0ZXdheVVybCB8fCAnd3NzOi8vcmVhbHRpbWUuanViYmlvLmNvbS93cy9ib3QnO1xyXG4gICAgdGhpcy5yZXN0ID0gbmV3IFJFU1Qob3B0aW9ucy5hcGlVcmwpO1xyXG4gICAgXHJcbiAgICAvLyBJbml0aWFsaXplIHZvaWNlIGFkYXB0ZXIgc3lzdGVtXHJcbiAgICB0aGlzLnZvaWNlID0ge1xyXG4gICAgICBhZGFwdGVyczogbmV3IE1hcCgpXHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2FsY3VsYXRlIGludGVudHMgdmFsdWVcclxuICAgKi9cclxuICBwcml2YXRlIGdldEludGVudHNWYWx1ZSgpOiBudW1iZXIge1xyXG4gICAgaWYgKHR5cGVvZiB0aGlzLm9wdGlvbnMuaW50ZW50cyA9PT0gJ251bWJlcicpIHtcclxuICAgICAgcmV0dXJuIHRoaXMub3B0aW9ucy5pbnRlbnRzO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRoaXMub3B0aW9ucy5pbnRlbnRzLnJlZHVjZSgoYWNjLCBpbnRlbnQpID0+IGFjYyB8IGludGVudCwgMCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHYXRld2F5IGNsb3NlIGNvZGUgZGVzY3JpcHRpb25zXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgQ0xPU0VfQ09ERVM6IFJlY29yZDxudW1iZXIsIHsgbWVzc2FnZTogc3RyaW5nOyByZWNvbm5lY3RhYmxlOiBib29sZWFuIH0+ID0ge1xyXG4gICAgNDAwMDogeyBtZXNzYWdlOiAnQmlsaW5tZXllbiBoYXRhIChVbmtub3duIGVycm9yKScsIHJlY29ubmVjdGFibGU6IHRydWUgfSxcclxuICAgIDQwMDE6IHsgbWVzc2FnZTogJ0JpbGlubWV5ZW4gb3Bjb2RlIGfDtm5kZXJpbGRpIChVbmtub3duIG9wY29kZSknLCByZWNvbm5lY3RhYmxlOiB0cnVlIH0sXHJcbiAgICA0MDAyOiB7IG1lc3NhZ2U6ICdHZcOnZXJzaXogcGF5bG9hZCBnw7ZuZGVyaWxkaSAoRGVjb2RlIGVycm9yKScsIHJlY29ubmVjdGFibGU6IHRydWUgfSxcclxuICAgIDQwMDM6IHsgbWVzc2FnZTogJ0hlbsO8eiBraW1saWsgZG/En3J1bGFtYXPEsSB5YXDEsWxtYWTEsSAoTm90IGF1dGhlbnRpY2F0ZWQpJywgcmVjb25uZWN0YWJsZTogdHJ1ZSB9LFxyXG4gICAgNDAwNDogeyBtZXNzYWdlOiAnR2XDp2Vyc2l6IGJvdCB0b2tlblxcJ8SxIChBdXRoZW50aWNhdGlvbiBmYWlsZWQpJywgcmVjb25uZWN0YWJsZTogZmFsc2UgfSxcclxuICAgIDQwMDU6IHsgbWVzc2FnZTogJ1phdGVuIGtpbWxpayBkb8SfcnVsYW1hc8SxIHlhcMSxbG3EscWfIChBbHJlYWR5IGF1dGhlbnRpY2F0ZWQpJywgcmVjb25uZWN0YWJsZTogdHJ1ZSB9LFxyXG4gICAgNDAwNzogeyBtZXNzYWdlOiAnR2XDp2Vyc2l6IHNlcXVlbmNlIG51bWFyYXPEsSAoSW52YWxpZCBzZXEpJywgcmVjb25uZWN0YWJsZTogdHJ1ZSB9LFxyXG4gICAgNDAwODogeyBtZXNzYWdlOiAnUmF0ZSBsaW1pdCBhxZ/EsWxkxLEgKFJhdGUgbGltaXRlZCknLCByZWNvbm5lY3RhYmxlOiB0cnVlIH0sXHJcbiAgICA0MDA5OiB7IG1lc3NhZ2U6ICdPdHVydW0gemFtYW4gYcWfxLFtxLFuYSB1xJ9yYWTEsSAoU2Vzc2lvbiB0aW1lZCBvdXQpJywgcmVjb25uZWN0YWJsZTogdHJ1ZSB9LFxyXG4gICAgNDAxMDogeyBtZXNzYWdlOiAnR2XDp2Vyc2l6IHNoYXJkIHlhcMSxbGFuZMSxcm1hc8SxIChJbnZhbGlkIHNoYXJkKScsIHJlY29ubmVjdGFibGU6IGZhbHNlIH0sXHJcbiAgICA0MDExOiB7IG1lc3NhZ2U6ICdTaGFyZGluZyBnZXJla2xpIChTaGFyZGluZyByZXF1aXJlZCknLCByZWNvbm5lY3RhYmxlOiBmYWxzZSB9LFxyXG4gICAgNDAxNDogeyBtZXNzYWdlOiAnxLB6aW4gdmVyaWxtZXllbiBpbnRlbnRcXCdsZXIgaXN0ZW5kaSAoRGlzYWxsb3dlZCBpbnRlbnRzKScsIHJlY29ubmVjdGFibGU6IGZhbHNlIH0sXHJcbiAgfTtcclxuXHJcbiAgLyoqXHJcbiAgICogTG9naW4gdG8gdGhlIGdhdGV3YXlcclxuICAgKi9cclxuICBhc3luYyBsb2dpbih0b2tlbjogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcclxuICAgIGlmICghdG9rZW4gfHwgdHlwZW9mIHRva2VuICE9PSAnc3RyaW5nJykge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXHJcbiAgICAgICAgJ0dlw6dlcmxpIGJpciBib3QgdG9rZW5cXCfEsSBzYcSfbGFubWFsxLFkxLFyLiDDlnJuZWs6IGNsaWVudC5sb2dpbihwcm9jZXNzLmVudi5CT1RfVE9LRU4pJ1xyXG4gICAgICApO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMudG9rZW4gPSB0b2tlbi5yZXBsYWNlKC9eQm90XFxzKy9pLCAnJyk7XHJcbiAgICB0aGlzLnJlc3Quc2V0VG9rZW4odGhpcy50b2tlbik7XHJcbiAgICB0aGlzLl9sb2dpblN0YXRlID0gJ2Nvbm5lY3RpbmcnO1xyXG4gICAgdGhpcy5fcmVjb25uZWN0QXR0ZW1wdHMgPSAwO1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgIGNvbnN0IGNsZWFudXAgPSAoKSA9PiB7XHJcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xyXG4gICAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIoJ3JlYWR5Jywgb25SZWFkeSk7XHJcbiAgICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcignZXJyb3InLCBvbkVycm9yKTtcclxuICAgICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKCdnYXRld2F5Q2xvc2UnLCBvbkdhdGV3YXlDbG9zZSk7XHJcbiAgICAgIH07XHJcblxyXG4gICAgICBjb25zdCB0aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgY2xlYW51cCgpO1xyXG4gICAgICAgIHRoaXMuX2xvZ2luU3RhdGUgPSAnaWRsZSc7XHJcbiAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihcclxuICAgICAgICAgICdHYXRld2F5XFwnZSBiYcSfbGFuxLFsYW1hZMSxOiAzMCBzYW5peWUgacOnaW5kZSBSRUFEWSBldmVudFxcJ2kgYWzEsW5hbWFkxLEuICcgK1xyXG4gICAgICAgICAgJ09sYXPEsSBzZWJlcGxlcjogZ2F0ZXdheSBzdW51Y3VzdSBlcmnFn2lsZW1leiwgdG9rZW4gZ2XDp2Vyc2l6IHZleWEgYcSfIHNvcnVudS4nXHJcbiAgICAgICAgKSk7XHJcbiAgICAgIH0sIDMwMDAwKTtcclxuXHJcbiAgICAgIGNvbnN0IG9uUmVhZHkgPSAoKSA9PiB7XHJcbiAgICAgICAgY2xlYW51cCgpO1xyXG4gICAgICAgIHRoaXMuX2xvZ2luU3RhdGUgPSAncmVhZHknO1xyXG4gICAgICAgIHRoaXMuX3JlY29ubmVjdEF0dGVtcHRzID0gMDtcclxuICAgICAgICByZXNvbHZlKHRoaXMudG9rZW4pO1xyXG4gICAgICB9O1xyXG5cclxuICAgICAgY29uc3Qgb25FcnJvciA9IChlcnJvcjogRXJyb3IpID0+IHtcclxuICAgICAgICBjbGVhbnVwKCk7XHJcbiAgICAgICAgdGhpcy5fbG9naW5TdGF0ZSA9ICdpZGxlJztcclxuICAgICAgICByZWplY3QoZXJyb3IpO1xyXG4gICAgICB9O1xyXG5cclxuICAgICAgY29uc3Qgb25HYXRld2F5Q2xvc2UgPSAoY29kZTogbnVtYmVyLCByZWFzb246IHN0cmluZykgPT4ge1xyXG4gICAgICAgIGNvbnN0IGluZm8gPSBDbGllbnQuQ0xPU0VfQ09ERVNbY29kZV07XHJcbiAgICAgICAgaWYgKGluZm8gJiYgIWluZm8ucmVjb25uZWN0YWJsZSkge1xyXG4gICAgICAgICAgY2xlYW51cCgpO1xyXG4gICAgICAgICAgdGhpcy5fbG9naW5TdGF0ZSA9ICdpZGxlJztcclxuICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoYEdhdGV3YXkgYmHEn2xhbnTEsXPEsSByZWRkZWRpbGRpIFske2NvZGV9XTogJHtpbmZvLm1lc3NhZ2V9JHtyZWFzb24gPyAnIC0gJyArIHJlYXNvbiA6ICcnfWApKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gUmVjb25uZWN0YWJsZSBjb2RlczogbG9naW4gcHJvbWlzZSBzdGF5cyBhbGl2ZSwgY29ubmVjdCgpIHdpbGwgcmV0cnlcclxuICAgICAgfTtcclxuXHJcbiAgICAgIHRoaXMub25jZSgncmVhZHknLCBvblJlYWR5KTtcclxuICAgICAgdGhpcy5vbmNlKCdlcnJvcicsIG9uRXJyb3IpO1xyXG4gICAgICB0aGlzLm9uKCdnYXRld2F5Q2xvc2UnLCBvbkdhdGV3YXlDbG9zZSk7XHJcblxyXG4gICAgICB0aGlzLmNvbm5lY3QoKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ29ubmVjdCB0byB0aGUgZ2F0ZXdheVxyXG4gICAqL1xyXG4gIHByaXZhdGUgY29ubmVjdCgpOiB2b2lkIHtcclxuICAgIHRoaXMud3MgPSBuZXcgV2ViU29ja2V0KHRoaXMuZ2F0ZXdheVVybCk7XHJcbiAgICBcclxuICAgIHRoaXMud3Mub24oJ29wZW4nLCAoKSA9PiB7XHJcbiAgICAgIHRoaXMuZW1pdCgnZGVidWcnLCAnV2ViU29ja2V0IGJhxJ9sYW50xLFzxLEgYcOnxLFsZMSxJyk7XHJcbiAgICAgIHRoaXMuX3JlY29ubmVjdEF0dGVtcHRzID0gMDtcclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICB0aGlzLndzLm9uKCdtZXNzYWdlJywgKGRhdGEpID0+IHtcclxuICAgICAgdGhpcy5oYW5kbGVNZXNzYWdlKGRhdGEudG9TdHJpbmcoKSk7XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgdGhpcy53cy5vbignY2xvc2UnLCAoY29kZSwgcmVhc29uKSA9PiB7XHJcbiAgICAgIGNvbnN0IHJlYXNvblN0ciA9IHJlYXNvbj8udG9TdHJpbmcoKSB8fCAnJztcclxuICAgICAgY29uc3QgaW5mbyA9IENsaWVudC5DTE9TRV9DT0RFU1tjb2RlXTtcclxuICAgICAgXHJcbiAgICAgIGlmIChpbmZvKSB7XHJcbiAgICAgICAgdGhpcy5lbWl0KCdkZWJ1ZycsIGBHYXRld2F5IGJhxJ9sYW50xLFzxLEga2FwYW5kxLEgWyR7Y29kZX1dOiAke2luZm8ubWVzc2FnZX0ke3JlYXNvblN0ciA/ICcgLSAnICsgcmVhc29uU3RyIDogJyd9YCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdGhpcy5lbWl0KCdkZWJ1ZycsIGBXZWJTb2NrZXQga2FwYW5kxLE6ICR7Y29kZX0gLSAke3JlYXNvblN0cn1gKTtcclxuICAgICAgfVxyXG4gICAgICBcclxuICAgICAgdGhpcy5jbGVhbnVwKCk7XHJcblxyXG4gICAgICAvLyBFbWl0IGdhdGV3YXlDbG9zZSBzbyBsb2dpbigpIGNhbiBoYW5kbGUgbm9uLXJlY29ubmVjdGFibGUgY29kZXNcclxuICAgICAgdGhpcy5lbWl0KCdnYXRld2F5Q2xvc2UnLCBjb2RlLCByZWFzb25TdHIpO1xyXG5cclxuICAgICAgLy8gTm9uLXJlY29ubmVjdGFibGUgY29kZXM6IGRvbid0IHJldHJ5XHJcbiAgICAgIGlmIChpbmZvICYmICFpbmZvLnJlY29ubmVjdGFibGUpIHtcclxuICAgICAgICB0aGlzLmVtaXQoJ2RlYnVnJywgYEtvZCAke2NvZGV9IHllbmlkZW4gYmHEn2xhbsSxbGFtYXosIGJhxJ9sYW50xLEgc29ubGFuZMSxcsSxbMSxeW9yLmApO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gTm9ybWFsIGNsb3NlOiBkb24ndCByZXRyeVxyXG4gICAgICBpZiAoY29kZSA9PT0gMTAwMCkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gUmVjb25uZWN0YWJsZTogcmV0cnkgd2l0aCBiYWNrb2ZmXHJcbiAgICAgIHRoaXMuX3JlY29ubmVjdEF0dGVtcHRzKys7XHJcbiAgICAgIGlmICh0aGlzLl9yZWNvbm5lY3RBdHRlbXB0cyA+IHRoaXMuX21heFJlY29ubmVjdEF0dGVtcHRzKSB7XHJcbiAgICAgICAgdGhpcy5lbWl0KCdkZWJ1ZycsIGBNYWtzaW11bSB5ZW5pZGVuIGJhxJ9sYW5tYSBkZW5lbWVzaSBhxZ/EsWxkxLEgKCR7dGhpcy5fbWF4UmVjb25uZWN0QXR0ZW1wdHN9KWApO1xyXG4gICAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCBuZXcgRXJyb3IoXHJcbiAgICAgICAgICBgR2F0ZXdheSBiYcSfbGFudMSxc8SxICR7dGhpcy5fbWF4UmVjb25uZWN0QXR0ZW1wdHN9IGRlbmVtZWRlbiBzb25yYSBrdXJ1bGFtYWTEsS4gU29uIGthcGFubWEga29kdTogJHtjb2RlfWBcclxuICAgICAgICApKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNvbnN0IGRlbGF5ID0gTWF0aC5taW4oMTAwMCAqIE1hdGgucG93KDIsIHRoaXMuX3JlY29ubmVjdEF0dGVtcHRzIC0gMSksIDMwMDAwKTtcclxuICAgICAgdGhpcy5lbWl0KCdkZWJ1ZycsIGBZZW5pZGVuIGJhxJ9sYW7EsWzEsXlvciAoZGVuZW1lICR7dGhpcy5fcmVjb25uZWN0QXR0ZW1wdHN9LyR7dGhpcy5fbWF4UmVjb25uZWN0QXR0ZW1wdHN9KSwgJHtkZWxheX1tcyBzb25yYS4uLmApO1xyXG4gICAgICBzZXRUaW1lb3V0KCgpID0+IHRoaXMuY29ubmVjdCgpLCBkZWxheSk7XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgdGhpcy53cy5vbignZXJyb3InLCAoZXJyb3IpID0+IHtcclxuICAgICAgdGhpcy5lbWl0KCdkZWJ1ZycsIGBXZWJTb2NrZXQgaGF0YXPEsTogJHtlcnJvci5tZXNzYWdlfWApO1xyXG4gICAgICB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyb3IpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBIYW5kbGUgaW5jb21pbmcgZ2F0ZXdheSBtZXNzYWdlXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBoYW5kbGVNZXNzYWdlKGRhdGE6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgLy8gSGFuZGxlIG11bHRpcGxlIG1lc3NhZ2VzIGluIG9uZSBmcmFtZVxyXG4gICAgY29uc3QgbWVzc2FnZXMgPSBkYXRhLnNwbGl0KCdcXG4nKS5maWx0ZXIobSA9PiBtLnRyaW0oKSk7XHJcbiAgICBcclxuICAgIGZvciAoY29uc3QgbXNnIG9mIG1lc3NhZ2VzKSB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgcGF5bG9hZDogR2F0ZXdheVBheWxvYWQgPSBKU09OLnBhcnNlKG1zZyk7XHJcbiAgICAgICAgdGhpcy5oYW5kbGVQYXlsb2FkKHBheWxvYWQpO1xyXG4gICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgdGhpcy5lbWl0KCdkZWJ1ZycsIGBGYWlsZWQgdG8gcGFyc2UgbWVzc2FnZTogJHttc2d9YCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZSBnYXRld2F5IHBheWxvYWRcclxuICAgKi9cclxuICBwcml2YXRlIGhhbmRsZVBheWxvYWQocGF5bG9hZDogR2F0ZXdheVBheWxvYWQpOiB2b2lkIHtcclxuICAgIGlmIChwYXlsb2FkLnMpIHtcclxuICAgICAgdGhpcy5zZXF1ZW5jZSA9IHBheWxvYWQucztcclxuICAgIH1cclxuXHJcbiAgICBzd2l0Y2ggKHBheWxvYWQub3ApIHtcclxuICAgICAgY2FzZSBHYXRld2F5T3Bjb2Rlcy5IZWxsbzpcclxuICAgICAgICB0aGlzLmhhbmRsZUhlbGxvKHBheWxvYWQuZCk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgR2F0ZXdheU9wY29kZXMuRGlzcGF0Y2g6XHJcbiAgICAgICAgdGhpcy5oYW5kbGVEaXNwYXRjaChwYXlsb2FkLnQhLCBwYXlsb2FkLmQpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlIEdhdGV3YXlPcGNvZGVzLkhlYXJ0YmVhdEFjazpcclxuICAgICAgICBpZiAodGhpcy5fbGFzdEhlYXJ0YmVhdFNlbnQgPiAwKSB7XHJcbiAgICAgICAgICB0aGlzLnBpbmcgPSBEYXRlLm5vdygpIC0gdGhpcy5fbGFzdEhlYXJ0YmVhdFNlbnQ7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuZW1pdCgnZGVidWcnLCBgSGVhcnRiZWF0IGFja25vd2xlZGdlZCAocGluZzogJHt0aGlzLnBpbmd9bXMpYCk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgR2F0ZXdheU9wY29kZXMuSW52YWxpZFNlc3Npb246XHJcbiAgICAgICAgdGhpcy5lbWl0KCdkZWJ1ZycsICdHZcOnZXJzaXogb3R1cnVtLCB5ZW5pZGVuIGtpbWxpayBkb8SfcnVsYW7EsXlvci4uLicpO1xyXG4gICAgICAgIC8vIEludmFsaWRTZXNzaW9uIG1heSBjYXJyeSBlcnJvciBkYXRhIGZyb20gc2VuZEVycm9yKClcclxuICAgICAgICBpZiAocGF5bG9hZC5kICYmIHR5cGVvZiBwYXlsb2FkLmQgPT09ICdvYmplY3QnICYmIHBheWxvYWQuZC5jb2RlICYmIHBheWxvYWQuZC5tZXNzYWdlKSB7XHJcbiAgICAgICAgICB0aGlzLmVtaXQoJ2RlYnVnJywgYFN1bnVjdSBoYXRhc8SxIFske3BheWxvYWQuZC5jb2RlfV06ICR7cGF5bG9hZC5kLm1lc3NhZ2V9YCk7XHJcbiAgICAgICAgICBjb25zdCBpbmZvID0gQ2xpZW50LkNMT1NFX0NPREVTW3BheWxvYWQuZC5jb2RlXTtcclxuICAgICAgICAgIGlmIChpbmZvICYmICFpbmZvLnJlY29ubmVjdGFibGUpIHtcclxuICAgICAgICAgICAgdGhpcy5lbWl0KCdlcnJvcicsIG5ldyBFcnJvcihgR2F0ZXdheSBoYXRhc8SxIFske3BheWxvYWQuZC5jb2RlfV06ICR7aW5mby5tZXNzYWdlfWApKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHRoaXMuaWRlbnRpZnkoKSwgNTAwMCk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgR2F0ZXdheU9wY29kZXMuUmVjb25uZWN0OlxyXG4gICAgICAgIHRoaXMuZW1pdCgnZGVidWcnLCAnUmVjb25uZWN0IHJlcXVlc3RlZCcpO1xyXG4gICAgICAgIHRoaXMud3M/LmNsb3NlKCk7XHJcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB0aGlzLmNvbm5lY3QoKSwgMTAwMCk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBIYW5kbGUgSGVsbG8gcGF5bG9hZFxyXG4gICAqL1xyXG4gIHByaXZhdGUgaGFuZGxlSGVsbG8oZGF0YTogeyBoZWFydGJlYXRfaW50ZXJ2YWw6IG51bWJlciB9KTogdm9pZCB7XHJcbiAgICB0aGlzLmVtaXQoJ2RlYnVnJywgYFJlY2VpdmVkIEhlbGxvLCBoZWFydGJlYXQgaW50ZXJ2YWw6ICR7ZGF0YS5oZWFydGJlYXRfaW50ZXJ2YWx9bXNgKTtcclxuICAgIHRoaXMuc3RhcnRIZWFydGJlYXQoZGF0YS5oZWFydGJlYXRfaW50ZXJ2YWwpO1xyXG4gICAgdGhpcy5pZGVudGlmeSgpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSGFuZGxlIERpc3BhdGNoIGV2ZW50c1xyXG4gICAqL1xyXG4gIHByaXZhdGUgaGFuZGxlRGlzcGF0Y2goZXZlbnRUeXBlOiBzdHJpbmcsIGRhdGE6IGFueSk6IHZvaWQge1xyXG4gICAgdGhpcy5lbWl0KCdkZWJ1ZycsIGBEaXNwYXRjaDogJHtldmVudFR5cGV9YCk7XHJcbiAgICBcclxuICAgIHN3aXRjaCAoZXZlbnRUeXBlKSB7XHJcbiAgICAgIGNhc2UgJ1JFQURZJzpcclxuICAgICAgICB0aGlzLmhhbmRsZVJlYWR5KGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdHVUlMRF9DUkVBVEUnOlxyXG4gICAgICAgIHRoaXMuaGFuZGxlR3VpbGRDcmVhdGUoZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ0dVSUxEX1VQREFURSc6XHJcbiAgICAgICAgdGhpcy5oYW5kbGVHdWlsZFVwZGF0ZShkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnR1VJTERfREVMRVRFJzpcclxuICAgICAgICB0aGlzLmhhbmRsZUd1aWxkRGVsZXRlKGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdNRVNTQUdFX0NSRUFURSc6XHJcbiAgICAgICAgdGhpcy5oYW5kbGVNZXNzYWdlQ3JlYXRlKGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdNRVNTQUdFX1VQREFURSc6XHJcbiAgICAgICAgdGhpcy5lbWl0KCdtZXNzYWdlVXBkYXRlJywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ01FU1NBR0VfREVMRVRFJzpcclxuICAgICAgICB0aGlzLmVtaXQoJ21lc3NhZ2VEZWxldGUnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnTUVTU0FHRV9ERUxFVEVfQlVMSyc6XHJcbiAgICAgICAgdGhpcy5lbWl0KCdtZXNzYWdlRGVsZXRlQnVsaycsIGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdDSEFOTkVMX0NSRUFURSc6IHtcclxuICAgICAgICAvLyBVcGRhdGUgZ3VpbGQgY2hhbm5lbCBjYWNoZVxyXG4gICAgICAgIGNvbnN0IGd1aWxkSWQgPSBkYXRhLmd1aWxkX2lkO1xyXG4gICAgICAgIGNvbnN0IGNoYW5uZWxJZCA9IGRhdGEuaWQgfHwgZGF0YS5jaGFubmVsX2lkO1xyXG4gICAgICAgIGlmIChndWlsZElkICYmIGNoYW5uZWxJZCkge1xyXG4gICAgICAgICAgY29uc3QgZ3VpbGQgPSB0aGlzLmd1aWxkcy5nZXQoZ3VpbGRJZCk7XHJcbiAgICAgICAgICBpZiAoZ3VpbGQpIHtcclxuICAgICAgICAgICAgZ3VpbGQuY2hhbm5lbHMuc2V0KGNoYW5uZWxJZCwgZGF0YSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuZW1pdCgnY2hhbm5lbENyZWF0ZScsIGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ0NIQU5ORUxfVVBEQVRFJzoge1xyXG4gICAgICAgIGNvbnN0IGd1aWxkSWQgPSBkYXRhLmd1aWxkX2lkO1xyXG4gICAgICAgIGNvbnN0IGNoYW5uZWxJZCA9IGRhdGEuaWQgfHwgZGF0YS5jaGFubmVsX2lkO1xyXG4gICAgICAgIGlmIChndWlsZElkICYmIGNoYW5uZWxJZCkge1xyXG4gICAgICAgICAgY29uc3QgZ3VpbGQgPSB0aGlzLmd1aWxkcy5nZXQoZ3VpbGRJZCk7XHJcbiAgICAgICAgICBpZiAoZ3VpbGQpIHtcclxuICAgICAgICAgICAgZ3VpbGQuY2hhbm5lbHMuc2V0KGNoYW5uZWxJZCwgZGF0YSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuZW1pdCgnY2hhbm5lbFVwZGF0ZScsIGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ0NIQU5ORUxfREVMRVRFJzoge1xyXG4gICAgICAgIGNvbnN0IGd1aWxkSWQgPSBkYXRhLmd1aWxkX2lkO1xyXG4gICAgICAgIGNvbnN0IGNoYW5uZWxJZCA9IGRhdGEuaWQgfHwgZGF0YS5jaGFubmVsX2lkO1xyXG4gICAgICAgIGlmIChndWlsZElkICYmIGNoYW5uZWxJZCkge1xyXG4gICAgICAgICAgY29uc3QgZ3VpbGQgPSB0aGlzLmd1aWxkcy5nZXQoZ3VpbGRJZCk7XHJcbiAgICAgICAgICBpZiAoZ3VpbGQpIHtcclxuICAgICAgICAgICAgZ3VpbGQuY2hhbm5lbHMuZGVsZXRlKGNoYW5uZWxJZCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuZW1pdCgnY2hhbm5lbERlbGV0ZScsIGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ0dVSUxEX01FTUJFUl9BREQnOiB7XHJcbiAgICAgICAgY29uc3QgZ3VpbGQgPSB0aGlzLmd1aWxkcy5nZXQoU3RyaW5nKGRhdGEuZ3VpbGRfaWQpKTtcclxuICAgICAgICBpZiAoZ3VpbGQgJiYgZGF0YS51c2VyKSB7XHJcbiAgICAgICAgICBjb25zdCBtZW1iZXIgPSBndWlsZC5fYWRkTWVtYmVyKGRhdGEpO1xyXG4gICAgICAgICAgdGhpcy5lbWl0KCdndWlsZE1lbWJlckFkZCcsIG1lbWJlcik7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIHRoaXMuZW1pdCgnZ3VpbGRNZW1iZXJBZGQnLCBkYXRhKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgY2FzZSAnR1VJTERfTUVNQkVSX1VQREFURSc6IHtcclxuICAgICAgICBjb25zdCBndWlsZCA9IHRoaXMuZ3VpbGRzLmdldChTdHJpbmcoZGF0YS5ndWlsZF9pZCkpO1xyXG4gICAgICAgIGNvbnN0IHJhd1VzZXJJZCA9IGRhdGEudXNlcj8uaWQgfHwgZGF0YS51c2VyX2lkO1xyXG4gICAgICAgIGlmIChndWlsZCAmJiByYXdVc2VySWQpIHtcclxuICAgICAgICAgIGNvbnN0IGV4aXN0aW5nID0gZ3VpbGQubWVtYmVycy5nZXQoU3RyaW5nKHJhd1VzZXJJZCkpO1xyXG4gICAgICAgICAgaWYgKGV4aXN0aW5nKSB7XHJcbiAgICAgICAgICAgIGV4aXN0aW5nLl9wYXRjaChkYXRhKTtcclxuICAgICAgICAgICAgdGhpcy5lbWl0KCdndWlsZE1lbWJlclVwZGF0ZScsIGV4aXN0aW5nKTtcclxuICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuZW1pdCgnZ3VpbGRNZW1iZXJVcGRhdGUnLCBkYXRhKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgdGhpcy5lbWl0KCdndWlsZE1lbWJlclVwZGF0ZScsIGRhdGEpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBicmVhaztcclxuICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdHVUlMRF9NRU1CRVJfUkVNT1ZFJzoge1xyXG4gICAgICAgIGNvbnN0IGd1aWxkID0gdGhpcy5ndWlsZHMuZ2V0KFN0cmluZyhkYXRhLmd1aWxkX2lkKSk7XHJcbiAgICAgICAgY29uc3QgcmF3VXNlcklkID0gZGF0YS51c2VyPy5pZCB8fCBkYXRhLnVzZXJfaWQ7XHJcbiAgICAgICAgaWYgKGd1aWxkICYmIHJhd1VzZXJJZCkge1xyXG4gICAgICAgICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJhd1VzZXJJZCk7XHJcbiAgICAgICAgICBjb25zdCBtZW1iZXIgPSBndWlsZC5tZW1iZXJzLmdldCh1c2VySWQpO1xyXG4gICAgICAgICAgZ3VpbGQubWVtYmVycy5kZWxldGUodXNlcklkKTtcclxuICAgICAgICAgIHRoaXMuZW1pdCgnZ3VpbGRNZW1iZXJSZW1vdmUnLCBtZW1iZXIgfHwgZGF0YSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIHRoaXMuZW1pdCgnZ3VpbGRNZW1iZXJSZW1vdmUnLCBkYXRhKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgY2FzZSAnR1VJTERfUk9MRV9DUkVBVEUnOlxyXG4gICAgICAgIHRoaXMuZW1pdCgncm9sZUNyZWF0ZScsIGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdHVUlMRF9ST0xFX1VQREFURSc6XHJcbiAgICAgICAgdGhpcy5lbWl0KCdyb2xlVXBkYXRlJywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ0dVSUxEX1JPTEVfREVMRVRFJzpcclxuICAgICAgICB0aGlzLmVtaXQoJ3JvbGVEZWxldGUnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnR1VJTERfQkFOX0FERCc6XHJcbiAgICAgICAgdGhpcy5lbWl0KCdndWlsZEJhbkFkZCcsIGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdHVUlMRF9CQU5fUkVNT1ZFJzpcclxuICAgICAgICB0aGlzLmVtaXQoJ2d1aWxkQmFuUmVtb3ZlJywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ0lOVklURV9DUkVBVEUnOlxyXG4gICAgICAgIHRoaXMuZW1pdCgnaW52aXRlQ3JlYXRlJywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ0lOVklURV9ERUxFVEUnOlxyXG4gICAgICAgIHRoaXMuZW1pdCgnaW52aXRlRGVsZXRlJywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ1RZUElOR19TVEFSVCc6XHJcbiAgICAgICAgdGhpcy5lbWl0KCd0eXBpbmdTdGFydCcsIGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdQUkVTRU5DRV9VUERBVEUnOlxyXG4gICAgICAgIHRoaXMuZW1pdCgncHJlc2VuY2VVcGRhdGUnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnSU5URVJBQ1RJT05fQ1JFQVRFJzpcclxuICAgICAgICB0aGlzLmhhbmRsZUludGVyYWN0aW9uQ3JlYXRlKGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdWT0lDRV9TVEFURV9VUERBVEUnOlxyXG4gICAgICAgIHRoaXMuaGFuZGxlVm9pY2VTdGF0ZVVwZGF0ZShkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnVk9JQ0VfU0VSVkVSX1VQREFURSc6XHJcbiAgICAgICAgdGhpcy5oYW5kbGVWb2ljZVNlcnZlclVwZGF0ZShkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgZGVmYXVsdDpcclxuICAgICAgICAvLyBFbWl0IHJhdyBldmVudCBmb3IgdW5oYW5kbGVkIHR5cGVzXHJcbiAgICAgICAgdGhpcy5lbWl0KCdyYXcnLCB7IHQ6IGV2ZW50VHlwZSwgZDogZGF0YSB9KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZSBSZWFkeSBldmVudFxyXG4gICAqL1xyXG4gIHByaXZhdGUgaGFuZGxlUmVhZHkoZGF0YTogUmVhZHlFdmVudERhdGEpOiB2b2lkIHtcclxuICAgIHRoaXMuc2Vzc2lvbklkID0gZGF0YS5zZXNzaW9uX2lkO1xyXG4gICAgdGhpcy51c2VyID0gbmV3IFVzZXIoZGF0YS51c2VyKTtcclxuICAgIC8vIEhhbmRsZSBib3RoIHN0cmluZyBhbmQgbnVtYmVyIGFwcGxpY2F0aW9uIElEc1xyXG4gICAgdGhpcy5hcHBsaWNhdGlvbklkID0gZGF0YS5hcHBsaWNhdGlvbj8uaWQgPyBTdHJpbmcoZGF0YS5hcHBsaWNhdGlvbi5pZCkgOiBudWxsO1xyXG4gICAgaWYgKHRoaXMuYXBwbGljYXRpb25JZCkge1xyXG4gICAgICB0aGlzLnJlc3Quc2V0QXBwbGljYXRpb25JZCh0aGlzLmFwcGxpY2F0aW9uSWQpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvLyBDYWNoZSBndWlsZHMgKGFzIHVuYXZhaWxhYmxlIGluaXRpYWxseSlcclxuICAgIGlmIChkYXRhLmd1aWxkcykge1xyXG4gICAgICBmb3IgKGNvbnN0IGd1aWxkIG9mIGRhdGEuZ3VpbGRzKSB7XHJcbiAgICAgICAgdGhpcy5ndWlsZHMuc2V0KFN0cmluZyhndWlsZC5pZCksIG5ldyBHdWlsZCh0aGlzLCBndWlsZCkpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIFNldHVwIHZvaWNlIGFkYXB0ZXJzIGZvciBlYWNoIGd1aWxkXHJcbiAgICB0aGlzLnNldHVwVm9pY2VBZGFwdGVycygpO1xyXG4gICAgXHJcbiAgICBjb25zb2xlLmxvZyhg4pyFIEJvdCBoYXrEsXIhIFVzZXI6ICR7dGhpcy51c2VyLnVzZXJuYW1lfSAoJHt0aGlzLnVzZXIuaWR9KSwgQXBwOiAke3RoaXMuYXBwbGljYXRpb25JZH1gKTtcclxuICAgIHRoaXMuZW1pdCgncmVhZHknLCB0aGlzKTtcclxuXHJcbiAgICAvLyBTaWduYWwgc2hhcmQgbWFuYWdlciB0aGF0IHRoaXMgc2hhcmQgaXMgcmVhZHkgKGlmIHJ1bm5pbmcgYXMgYSBzaGFyZClcclxuICAgIGlmIChwcm9jZXNzLnNlbmQpIHtcclxuICAgICAgcHJvY2Vzcy5zZW5kKHsgX3JlYWR5OiB0cnVlIH0pO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2V0dXAgdm9pY2UgYWRhcHRlcnMgZm9yIGFsbCBndWlsZHNcclxuICAgKi9cclxuICBwcml2YXRlIHNldHVwVm9pY2VBZGFwdGVycygpOiB2b2lkIHtcclxuICAgIGZvciAoY29uc3QgW2d1aWxkSWRdIG9mIHRoaXMuZ3VpbGRzKSB7XHJcbiAgICAgIHRoaXMuY3JlYXRlVm9pY2VBZGFwdGVyKGd1aWxkSWQpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgdm9pY2UgYWRhcHRlciBmb3IgYSBndWlsZFxyXG4gICAqL1xyXG4gIHByaXZhdGUgY3JlYXRlVm9pY2VBZGFwdGVyKGd1aWxkSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgYWRhcHRlcjogVm9pY2VBZGFwdGVyQ3JlYXRvciA9IChtZXRob2RzKSA9PiB7XHJcbiAgICAgIC8vIFN0b3JlIGhhbmRsZXJzIGZvciB0aGlzIGd1aWxkXHJcbiAgICAgIHRoaXMudm9pY2VTdGF0ZUhhbmRsZXJzLnNldChndWlsZElkLCBtZXRob2RzLm9uVm9pY2VTdGF0ZVVwZGF0ZSk7XHJcbiAgICAgIHRoaXMudm9pY2VTZXJ2ZXJIYW5kbGVycy5zZXQoZ3VpbGRJZCwgbWV0aG9kcy5vblZvaWNlU2VydmVyVXBkYXRlKTtcclxuICAgICAgXHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAgc2VuZFBheWxvYWQ6IChwYXlsb2FkKSA9PiB7XHJcbiAgICAgICAgICBpZiAodGhpcy53cz8ucmVhZHlTdGF0ZSA9PT0gV2ViU29ja2V0Lk9QRU4pIHtcclxuICAgICAgICAgICAgdGhpcy53cy5zZW5kKEpTT04uc3RyaW5naWZ5KHBheWxvYWQpKTtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBkZXN0cm95OiAoKSA9PiB7XHJcbiAgICAgICAgICB0aGlzLnZvaWNlU3RhdGVIYW5kbGVycy5kZWxldGUoZ3VpbGRJZCk7XHJcbiAgICAgICAgICB0aGlzLnZvaWNlU2VydmVySGFuZGxlcnMuZGVsZXRlKGd1aWxkSWQpO1xyXG4gICAgICAgIH1cclxuICAgICAgfTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMudm9pY2UuYWRhcHRlcnMuc2V0KGd1aWxkSWQsIGFkYXB0ZXIpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSGFuZGxlIEd1aWxkIENyZWF0ZSBldmVudFxyXG4gICAqL1xyXG4gIHByaXZhdGUgaGFuZGxlR3VpbGRDcmVhdGUoZGF0YTogQVBJR3VpbGQpOiB2b2lkIHtcclxuICAgIGxldCBndWlsZCA9IHRoaXMuZ3VpbGRzLmdldChkYXRhLmlkKTtcclxuICAgIFxyXG4gICAgaWYgKGd1aWxkKSB7XHJcbiAgICAgIGd1aWxkLl9wYXRjaChkYXRhKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGd1aWxkID0gbmV3IEd1aWxkKHRoaXMsIGRhdGEpO1xyXG4gICAgICB0aGlzLmd1aWxkcy5zZXQoZGF0YS5pZCwgZ3VpbGQpO1xyXG4gICAgICB0aGlzLmNyZWF0ZVZvaWNlQWRhcHRlcihkYXRhLmlkKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgdGhpcy5lbWl0KCdndWlsZENyZWF0ZScsIGd1aWxkKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZSBHdWlsZCBVcGRhdGUgZXZlbnRcclxuICAgKi9cclxuICBwcml2YXRlIGhhbmRsZUd1aWxkVXBkYXRlKGRhdGE6IEFQSUd1aWxkKTogdm9pZCB7XHJcbiAgICBjb25zdCBndWlsZCA9IHRoaXMuZ3VpbGRzLmdldChkYXRhLmlkKTtcclxuICAgIGlmIChndWlsZCkge1xyXG4gICAgICBndWlsZC5fcGF0Y2goZGF0YSk7XHJcbiAgICAgIHRoaXMuZW1pdCgnZ3VpbGRVcGRhdGUnLCBndWlsZCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBIYW5kbGUgR3VpbGQgRGVsZXRlIGV2ZW50XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBoYW5kbGVHdWlsZERlbGV0ZShkYXRhOiB7IGlkOiBzdHJpbmcgfSk6IHZvaWQge1xyXG4gICAgY29uc3QgZ3VpbGQgPSB0aGlzLmd1aWxkcy5nZXQoZGF0YS5pZCk7XHJcbiAgICBpZiAoZ3VpbGQpIHtcclxuICAgICAgdGhpcy5ndWlsZHMuZGVsZXRlKGRhdGEuaWQpO1xyXG4gICAgICB0aGlzLnZvaWNlLmFkYXB0ZXJzLmRlbGV0ZShkYXRhLmlkKTtcclxuICAgICAgdGhpcy5lbWl0KCdndWlsZERlbGV0ZScsIGd1aWxkKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZSBNZXNzYWdlIENyZWF0ZSBldmVudFxyXG4gICAqL1xyXG4gIHByaXZhdGUgaGFuZGxlTWVzc2FnZUNyZWF0ZShkYXRhOiBBUElNZXNzYWdlKTogdm9pZCB7XHJcbiAgICAvLyBCYWNrZW5kIHNlbmRzIHVzZXJfaWQgc2VwYXJhdGVseSwgbWFwIGl0IHRvIGF1dGhvci5pZCBmb3IgY29tcGF0aWJpbGl0eVxyXG4gICAgaWYgKGRhdGEudXNlcl9pZCAmJiBkYXRhLmF1dGhvciAmJiAhZGF0YS5hdXRob3IuaWQpIHtcclxuICAgICAgKGRhdGEuYXV0aG9yIGFzIGFueSkuaWQgPSBkYXRhLnVzZXJfaWQ7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIENhY2hlIHRoZSBhdXRob3JcclxuICAgIGlmIChkYXRhLmF1dGhvcikge1xyXG4gICAgICBjb25zdCB1c2VyID0gbmV3IFVzZXIoZGF0YS5hdXRob3IpO1xyXG4gICAgICB0aGlzLnVzZXJzLnNldCh1c2VyLmlkLCB1c2VyKTtcclxuICAgICAgLy8gQWxzbyBjYWNoZSBpbiBSRVNUIGZvciBtZW50aW9uIHJlc29sdXRpb25cclxuICAgICAgdGhpcy5yZXN0LmNhY2hlVXNlcihkYXRhLmF1dGhvcik7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGNvbnN0IG1lc3NhZ2UgPSBuZXcgTWVzc2FnZSh0aGlzLCBkYXRhKTtcclxuXHJcbiAgICAvLyBNYXJrIG1lc3NhZ2UgYXMgZnJvbSBib3QgaWYgYXV0aG9yIElEIG1hdGNoZXMgdGhlIGJvdCdzIG93biB1c2VyIElEXHJcbiAgICBpZiAodGhpcy51c2VyICYmIFN0cmluZyhtZXNzYWdlLmF1dGhvci5pZCkgPT09IFN0cmluZyh0aGlzLnVzZXIuaWQpKSB7XHJcbiAgICAgIChtZXNzYWdlLmF1dGhvciBhcyBhbnkpLmJvdCA9IHRydWU7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gUmVzb2x2ZSBndWlsZCBtZW1iZXIgaWYgaW4gYSBndWlsZFxyXG4gICAgaWYgKG1lc3NhZ2UuZ3VpbGRJZCkge1xyXG4gICAgICBjb25zdCBndWlsZCA9IHRoaXMuZ3VpbGRzLmdldChtZXNzYWdlLmd1aWxkSWQpO1xyXG4gICAgICBjb25zdCBtZW1iZXJEYXRhID0gKGRhdGEgYXMgYW55KS5tZW1iZXI7XHJcbiAgICAgIGlmIChtZW1iZXJEYXRhICYmIGd1aWxkKSB7XHJcbiAgICAgICAgLy8gR2F0ZXdheSBzZW50IG1lbWJlciBkYXRhIHdpdGggdGhlIG1lc3NhZ2Ug4oCUIGNhY2hlIGl0XHJcbiAgICAgICAgbWVtYmVyRGF0YS51c2VyID0gZGF0YS5hdXRob3I7XHJcbiAgICAgICAgY29uc3QgbWVtYmVyID0gZ3VpbGQuX2FkZE1lbWJlcihtZW1iZXJEYXRhKTtcclxuICAgICAgICBtZXNzYWdlLm1lbWJlciA9IG1lbWJlcjtcclxuICAgICAgfSBlbHNlIGlmIChtZW1iZXJEYXRhKSB7XHJcbiAgICAgICAgLy8gTm8gZ3VpbGQgaW4gY2FjaGUgYnV0IG1lbWJlciBkYXRhIGV4aXN0c1xyXG4gICAgICAgIG1lbWJlckRhdGEudXNlciA9IGRhdGEuYXV0aG9yO1xyXG4gICAgICAgIGNvbnN0IHJlc29sdmVkR3VpbGQgPSB7IGlkOiBtZXNzYWdlLmd1aWxkSWQsIG93bmVySWQ6IG51bGwgfSBhcyBhbnk7XHJcbiAgICAgICAgbWVzc2FnZS5tZW1iZXIgPSBuZXcgKHJlcXVpcmUoJy4vc3RydWN0dXJlcy9HdWlsZE1lbWJlcicpLkd1aWxkTWVtYmVyKSh0aGlzLCByZXNvbHZlZEd1aWxkLCBtZW1iZXJEYXRhKTtcclxuICAgICAgfSBlbHNlIGlmIChndWlsZCkge1xyXG4gICAgICAgIC8vIFRyeSBjYWNoZVxyXG4gICAgICAgIGNvbnN0IGNhY2hlZCA9IGd1aWxkLm1lbWJlcnM/LmdldChTdHJpbmcobWVzc2FnZS5hdXRob3IuaWQpKTtcclxuICAgICAgICBpZiAoY2FjaGVkPy5wZXJtaXNzaW9ucz8uaGFzKSB7XHJcbiAgICAgICAgICBtZXNzYWdlLm1lbWJlciA9IGNhY2hlZDtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmVtaXQoJ21lc3NhZ2VDcmVhdGUnLCBtZXNzYWdlKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZSBJbnRlcmFjdGlvbiBDcmVhdGUgZXZlbnRcclxuICAgKi9cclxuICBwcml2YXRlIGhhbmRsZUludGVyYWN0aW9uQ3JlYXRlKGRhdGE6IEFQSUludGVyYWN0aW9uKTogdm9pZCB7XHJcbiAgICBjb25zb2xlLmxvZygnW0RFQlVHXSBoYW5kbGVJbnRlcmFjdGlvbkNyZWF0ZSBjYWxsZWQgd2l0aDonLCBKU09OLnN0cmluZ2lmeShkYXRhLCBudWxsLCAyKSk7XHJcbiAgICBcclxuICAgIC8vIENhY2hlIHRoZSB1c2VyXHJcbiAgICBjb25zdCB1c2VyRGF0YSA9IGRhdGEubWVtYmVyPy51c2VyIHx8IGRhdGEudXNlcjtcclxuICAgIGlmICh1c2VyRGF0YSkge1xyXG4gICAgICBjb25zdCB1c2VyID0gbmV3IFVzZXIodXNlckRhdGEpO1xyXG4gICAgICB0aGlzLnVzZXJzLnNldCh1c2VyLmlkLCB1c2VyKTtcclxuICAgICAgdGhpcy5yZXN0LmNhY2hlVXNlcih1c2VyRGF0YSk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGNvbnN0IGludGVyYWN0aW9uID0gY3JlYXRlSW50ZXJhY3Rpb24odGhpcywgZGF0YSk7XHJcbiAgICBjb25zb2xlLmxvZygnW0RFQlVHXSBDcmVhdGVkIGludGVyYWN0aW9uIHR5cGU6JywgaW50ZXJhY3Rpb24uY29uc3RydWN0b3IubmFtZSwgJ2N1c3RvbUlkOicsIChpbnRlcmFjdGlvbiBhcyBhbnkpLmN1c3RvbUlkKTtcclxuICAgIHRoaXMuZW1pdCgnaW50ZXJhY3Rpb25DcmVhdGUnLCBpbnRlcmFjdGlvbik7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBIYW5kbGUgVm9pY2UgU3RhdGUgVXBkYXRlIGV2ZW50XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBoYW5kbGVWb2ljZVN0YXRlVXBkYXRlKGRhdGE6IGFueSk6IHZvaWQge1xyXG4gICAgY29uc3QgZ3VpbGRJZCA9IGRhdGEuZ3VpbGRfaWQ7XHJcbiAgICBcclxuICAgIC8vIEZvcndhcmQgdG8gdm9pY2UgYWRhcHRlciBpZiBleGlzdHNcclxuICAgIGNvbnN0IGhhbmRsZXIgPSB0aGlzLnZvaWNlU3RhdGVIYW5kbGVycy5nZXQoZ3VpbGRJZCk7XHJcbiAgICBpZiAoaGFuZGxlcikge1xyXG4gICAgICBoYW5kbGVyKGRhdGEpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICB0aGlzLmVtaXQoJ3ZvaWNlU3RhdGVVcGRhdGUnLCBkYXRhKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZSBWb2ljZSBTZXJ2ZXIgVXBkYXRlIGV2ZW50XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBoYW5kbGVWb2ljZVNlcnZlclVwZGF0ZShkYXRhOiBBUElWb2ljZVNlcnZlclVwZGF0ZSk6IHZvaWQge1xyXG4gICAgY29uc3QgZ3VpbGRJZCA9IGRhdGEuZ3VpbGRfaWQ7XHJcbiAgICBcclxuICAgIC8vIEZvcndhcmQgdG8gdm9pY2UgYWRhcHRlciBpZiBleGlzdHNcclxuICAgIGNvbnN0IGhhbmRsZXIgPSB0aGlzLnZvaWNlU2VydmVySGFuZGxlcnMuZ2V0KGd1aWxkSWQpO1xyXG4gICAgaWYgKGhhbmRsZXIpIHtcclxuICAgICAgaGFuZGxlcih7XHJcbiAgICAgICAgdG9rZW46IGRhdGEudG9rZW4sXHJcbiAgICAgICAgZW5kcG9pbnQ6IGRhdGEuZW5kcG9pbnQsXHJcbiAgICAgICAgcm9vbTogZGF0YS5yb29tXHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICB0aGlzLmVtaXQoJ3ZvaWNlU2VydmVyVXBkYXRlJywgZGF0YSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZW5kIElkZW50aWZ5IHBheWxvYWRcclxuICAgKi9cclxuICBwcml2YXRlIGlkZW50aWZ5KCk6IHZvaWQge1xyXG4gICAgY29uc3QgcGF5bG9hZDogR2F0ZXdheVBheWxvYWQgPSB7XHJcbiAgICAgIG9wOiBHYXRld2F5T3Bjb2Rlcy5JZGVudGlmeSxcclxuICAgICAgZDoge1xyXG4gICAgICAgIHRva2VuOiBgQm90ICR7dGhpcy50b2tlbn1gLFxyXG4gICAgICAgIGludGVudHM6IHRoaXMuZ2V0SW50ZW50c1ZhbHVlKCksXHJcbiAgICAgICAgc2hhcmQ6IHRoaXMub3B0aW9ucy5zaGFyZHMgfHwgWzAsIDFdXHJcbiAgICAgIH1cclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMuc2VuZChwYXlsb2FkKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFN0YXJ0IGhlYXJ0YmVhdFxyXG4gICAqL1xyXG4gIHByaXZhdGUgc3RhcnRIZWFydGJlYXQoaW50ZXJ2YWw6IG51bWJlcik6IHZvaWQge1xyXG4gICAgdGhpcy5oZWFydGJlYXRJbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHtcclxuICAgICAgdGhpcy5fbGFzdEhlYXJ0YmVhdFNlbnQgPSBEYXRlLm5vdygpO1xyXG4gICAgICB0aGlzLnNlbmQoe1xyXG4gICAgICAgIG9wOiBHYXRld2F5T3Bjb2Rlcy5IZWFydGJlYXQsXHJcbiAgICAgICAgZDogdGhpcy5zZXF1ZW5jZVxyXG4gICAgICB9KTtcclxuICAgIH0sIGludGVydmFsKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNlbmQgcGF5bG9hZCB0byBnYXRld2F5XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBzZW5kKHBheWxvYWQ6IEdhdGV3YXlQYXlsb2FkKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy53cz8ucmVhZHlTdGF0ZSA9PT0gV2ViU29ja2V0Lk9QRU4pIHtcclxuICAgICAgdGhpcy53cy5zZW5kKEpTT04uc3RyaW5naWZ5KHBheWxvYWQpKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENsZWFudXAgb24gZGlzY29ubmVjdFxyXG4gICAqL1xyXG4gIHByaXZhdGUgY2xlYW51cCgpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLmhlYXJ0YmVhdEludGVydmFsKSB7XHJcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5oZWFydGJlYXRJbnRlcnZhbCk7XHJcbiAgICAgIHRoaXMuaGVhcnRiZWF0SW50ZXJ2YWwgPSBudWxsO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVzdHJveSB0aGUgY2xpZW50XHJcbiAgICovXHJcbiAgZGVzdHJveSgpOiB2b2lkIHtcclxuICAgIHRoaXMuX2xvZ2luU3RhdGUgPSAnaWRsZSc7XHJcbiAgICB0aGlzLl9yZWNvbm5lY3RBdHRlbXB0cyA9IHRoaXMuX21heFJlY29ubmVjdEF0dGVtcHRzICsgMTsgLy8gUHJldmVudCByZWNvbm5lY3RcclxuICAgIHRoaXMuY2xlYW51cCgpO1xyXG4gICAgdGhpcy53cz8uY2xvc2UoMTAwMCk7XHJcbiAgICB0aGlzLndzID0gbnVsbDtcclxuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCk7XHJcbiAgfVxyXG59XHJcblxyXG4vLyBSZS1leHBvcnQgZm9yIGNvbnZlbmllbmNlXHJcbmV4cG9ydCB7IEdhdGV3YXlJbnRlbnRCaXRzIH07XHJcbiJdfQ==