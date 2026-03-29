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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ2xpZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL0NsaWVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxtQ0FBc0M7QUFDdEMsNENBQTJCO0FBWTNCLG1DQUE0RDtBQXF2Qm5ELGtHQXJ2QmdCLHlCQUFpQixPQXF2QmhCO0FBcHZCMUIsd0RBQXFEO0FBQ3JELDRDQUF5QztBQUN6Qyw4Q0FBMkM7QUFDM0Msa0RBQStDO0FBQy9DLDBEQUEwRTtBQUUxRSxzQ0FBbUM7QUFjbkM7O0dBRUc7QUFDSCxNQUFhLE1BQU8sU0FBUSxxQkFBWTtJQUN0QyxxQkFBcUI7SUFDTCxPQUFPLENBQWdCO0lBRXZDLHNCQUFzQjtJQUNOLElBQUksQ0FBTztJQUUzQixtQkFBbUI7SUFDWixJQUFJLEdBQWdCLElBQUksQ0FBQztJQUVoQyxxQkFBcUI7SUFDZCxhQUFhLEdBQWtCLElBQUksQ0FBQztJQUUzQyxvQkFBb0I7SUFDYixNQUFNLEdBQThCLElBQUksdUJBQVUsRUFBRSxDQUFDO0lBRTVELHNCQUFzQjtJQUNmLFFBQVEsR0FBb0MsSUFBSSx1QkFBVSxFQUFFLENBQUM7SUFFcEUsbUJBQW1CO0lBQ1osS0FBSyxHQUE2QixJQUFJLHVCQUFVLEVBQUUsQ0FBQztJQUUxRCwrQkFBK0I7SUFDeEIsS0FBSyxDQUVWO0lBRUYsMkJBQTJCO0lBQ25CLEVBQUUsR0FBcUIsSUFBSSxDQUFDO0lBRXBDLGdCQUFnQjtJQUNSLEtBQUssR0FBVyxFQUFFLENBQUM7SUFFM0IsaUJBQWlCO0lBQ1QsU0FBUyxHQUFrQixJQUFJLENBQUM7SUFFeEMsc0JBQXNCO0lBQ2QsUUFBUSxHQUFrQixJQUFJLENBQUM7SUFFdkMseUJBQXlCO0lBQ2pCLGlCQUFpQixHQUEwQixJQUFJLENBQUM7SUFFeEQsa0JBQWtCO0lBQ1YsVUFBVSxDQUFTO0lBRTNCLHVEQUF1RDtJQUMvQyxrQkFBa0IsR0FBcUMsSUFBSSxHQUFHLEVBQUUsQ0FBQztJQUNqRSxtQkFBbUIs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QUFPLEVBQUUsQ0FBQztRQUNmLElBQUksQ0FBQyxFQUFFLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3JCLElBQUksQ0FBQyxFQUFFLEdBQUcsSUFBSSxDQUFDO1FBQ2YsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7SUFDNUIsQ0FBQzs7QUF6dEJILHdCQTB0QkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBFdmVudEVtaXR0ZXIgfSBmcm9tICdldmVudHMnO1xyXG5pbXBvcnQgV2ViU29ja2V0IGZyb20gJ3dzJztcclxuaW1wb3J0IHsgXHJcbiAgQ2xpZW50T3B0aW9ucywgXHJcbiAgR2F0ZXdheVBheWxvYWQsIFxyXG4gIFJlYWR5RXZlbnREYXRhLFxyXG4gIEFQSUd1aWxkLFxyXG4gIEFQSUludGVyYWN0aW9uLFxyXG4gIEFQSU1lc3NhZ2UsXHJcbiAgQVBJVm9pY2VTZXJ2ZXJVcGRhdGUsXHJcbiAgQVBJQ2hhbm5lbCxcclxuICBBUElVc2VyXHJcbn0gZnJvbSAnLi90eXBlcyc7XHJcbmltcG9ydCB7IEdhdGV3YXlPcGNvZGVzLCBHYXRld2F5SW50ZW50Qml0cyB9IGZyb20gJy4vZW51bXMnO1xyXG5pbXBvcnQgeyBDb2xsZWN0aW9uIH0gZnJvbSAnLi9zdHJ1Y3R1cmVzL0NvbGxlY3Rpb24nO1xyXG5pbXBvcnQgeyBVc2VyIH0gZnJvbSAnLi9zdHJ1Y3R1cmVzL1VzZXInO1xyXG5pbXBvcnQgeyBHdWlsZCB9IGZyb20gJy4vc3RydWN0dXJlcy9HdWlsZCc7XHJcbmltcG9ydCB7IE1lc3NhZ2UgfSBmcm9tICcuL3N0cnVjdHVyZXMvTWVzc2FnZSc7XHJcbmltcG9ydCB7IGNyZWF0ZUludGVyYWN0aW9uLCBJbnRlcmFjdGlvbiB9IGZyb20gJy4vc3RydWN0dXJlcy9JbnRlcmFjdGlvbic7XHJcbmltcG9ydCB7IEJhc2VDaGFubmVsLCBjcmVhdGVDaGFubmVsIH0gZnJvbSAnLi9zdHJ1Y3R1cmVzL0NoYW5uZWwnO1xyXG5pbXBvcnQgeyBSRVNUIH0gZnJvbSAnLi9yZXN0L1JFU1QnO1xyXG5cclxuLyoqXHJcbiAqIFZvaWNlIGFkYXB0ZXIgY3JlYXRvciB0eXBlIGZvciBAanViYmlvL3ZvaWNlIGNvbXBhdGliaWxpdHlcclxuICovXHJcbnR5cGUgVm9pY2VBZGFwdGVyQ3JlYXRvciA9IChtZXRob2RzOiB7XHJcbiAgb25Wb2ljZVNlcnZlclVwZGF0ZShkYXRhOiBhbnkpOiB2b2lkO1xyXG4gIG9uVm9pY2VTdGF0ZVVwZGF0ZShkYXRhOiBhbnkpOiB2b2lkO1xyXG4gIGRlc3Ryb3koKTogdm9pZDtcclxufSkgPT4ge1xyXG4gIHNlbmRQYXlsb2FkKHBheWxvYWQ6IGFueSk6IGJvb2xlYW47XHJcbiAgZGVzdHJveSgpOiB2b2lkO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIE1haW4gY2xpZW50IGNsYXNzXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgQ2xpZW50IGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcclxuICAvKiogQ2xpZW50IG9wdGlvbnMgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgb3B0aW9uczogQ2xpZW50T3B0aW9ucztcclxuICBcclxuICAvKiogUkVTVCBBUEkgY2xpZW50ICovXHJcbiAgcHVibGljIHJlYWRvbmx5IHJlc3Q6IFJFU1Q7XHJcbiAgXHJcbiAgLyoqIFRoZSBib3QgdXNlciAqL1xyXG4gIHB1YmxpYyB1c2VyOiBVc2VyIHwgbnVsbCA9IG51bGw7XHJcbiAgXHJcbiAgLyoqIEFwcGxpY2F0aW9uIElEICovXHJcbiAgcHVibGljIGFwcGxpY2F0aW9uSWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xyXG4gIFxyXG4gIC8qKiBDYWNoZWQgZ3VpbGRzICovXHJcbiAgcHVibGljIGd1aWxkczogQ29sbGVjdGlvbjxzdHJpbmcsIEd1aWxkPiA9IG5ldyBDb2xsZWN0aW9uKCk7XHJcbiAgXHJcbiAgLyoqIENhY2hlZCBjaGFubmVscyAqL1xyXG4gIHB1YmxpYyBjaGFubmVsczogQ29sbGVjdGlvbjxzdHJpbmcsIEJhc2VDaGFubmVsPiA9IG5ldyBDb2xsZWN0aW9uKCk7XHJcbiAgXHJcbiAgLyoqIENhY2hlZCB1c2VycyAqL1xyXG4gIHB1YmxpYyB1c2VyczogQ29sbGVjdGlvbjxzdHJpbmcsIFVzZXI+ID0gbmV3IENvbGxlY3Rpb24oKTtcclxuICBcclxuICAvKiogVm9pY2UgYWRhcHRlciBtYW5hZ2VtZW50ICovXHJcbiAgcHVibGljIHZvaWNlOiB7XHJcbiAgICBhZGFwdGVyczogTWFwPHN0cmluZywgVm9pY2VBZGFwdGVyQ3JlYXRvcj47XHJcbiAgfTtcclxuICBcclxuICAvKiogV2ViU29ja2V0IGNvbm5lY3Rpb24gKi9cclxuICBwcml2YXRlIHdzOiBXZWJTb2NrZXQgfCBudWxsID0gbnVsbDtcclxuICBcclxuICAvKiogQm90IHRva2VuICovXHJcbiAgcHJpdmF0ZSB0b2tlbjogc3RyaW5nID0gJyc7XHJcbiAgXHJcbiAgLyoqIFNlc3Npb24gSUQgKi9cclxuICBwcml2YXRlIHNlc3Npb25JZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XHJcbiAgXHJcbiAgLyoqIFNlcXVlbmNlIG51bWJlciAqL1xyXG4gIHByaXZhdGUgc2VxdWVuY2U6IG51bWJlciB8IG51bGwgPSBudWxsO1xyXG4gIFxyXG4gIC8qKiBIZWFydGJlYXQgaW50ZXJ2YWwgKi9cclxuICBwcml2YXRlIGhlYXJ0YmVhdEludGVydmFsOiBOb2RlSlMuVGltZW91dCB8IG51bGwgPSBudWxsO1xyXG4gIFxyXG4gIC8qKiBHYXRld2F5IFVSTCAqL1xyXG4gIHByaXZhdGUgZ2F0ZXdheVVybDogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBWb2ljZSBzdGF0ZSB1cGRhdGUgaGFuZGxlcnMgKGZvciB2b2ljZSBhZGFwdGVycykgKi9cclxuICBwcml2YXRlIHZvaWNlU3RhdGVIYW5kbGVyczogTWFwPHN0cmluZywgKGRhdGE6IGFueSkgPT4gdm9pZD4gPSBuZXcgTWFwKCk7XHJcbiAgcHJpdmF0ZSB2b2ljZVNlcnZlckhhbmRsZXJzOiBNYXA8c3RyaW5nLCAoZGF0YTogYW55KSA9PiB2b2lkPiA9IG5ldyBNYXAoKTtcclxuXHJcbiAgLyoqIFdoZXRoZXIgdGhlIGNsaWVudCBpcyBjdXJyZW50bHkgaW4gdGhlIGxvZ2luIGZsb3cgKi9cclxuICBwcml2YXRlIF9sb2dpblN0YXRlOiAnaWRsZScgfCAnY29ubmVjdGluZycgfCAncmVhZHknID0gJ2lkbGUnO1xyXG5cclxuICAvKiogUmVjb25uZWN0IGF0dGVtcHQgY291bnRlciAqL1xyXG4gIHByaXZhdGUgX3JlY29ubmVjdEF0dGVtcHRzOiBudW1iZXIgPSAwO1xyXG5cclxuICAvKiogTWF4aW11bSByZWNvbm5lY3QgYXR0ZW1wdHMgYmVmb3JlIGdpdmluZyB1cCAqL1xyXG4gIHByaXZhdGUgcmVhZG9ubHkgX21heFJlY29ubmVjdEF0dGVtcHRzOiBudW1iZXIgPSA1O1xyXG5cclxuICBjb25zdHJ1Y3RvcihvcHRpb25zOiBDbGllbnRPcHRpb25zKSB7XHJcbiAgICBzdXBlcigpO1xyXG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcclxuICAgIHRoaXMuZ2F0ZXdheVVybCA9IG9wdGlvbnMuZ2F0ZXdheVVybCB8fCAnd3NzOi8vcmVhbHRpbWUuanViYmlvLmNvbS93cy9ib3QnO1xyXG4gICAgdGhpcy5yZXN0ID0gbmV3IFJFU1Qob3B0aW9ucy5hcGlVcmwpO1xyXG4gICAgXHJcbiAgICAvLyBJbml0aWFsaXplIHZvaWNlIGFkYXB0ZXIgc3lzdGVtXHJcbiAgICB0aGlzLnZvaWNlID0ge1xyXG4gICAgICBhZGFwdGVyczogbmV3IE1hcCgpXHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2FsY3VsYXRlIGludGVudHMgdmFsdWVcclxuICAgKi9cclxuICBwcml2YXRlIGdldEludGVudHNWYWx1ZSgpOiBudW1iZXIge1xyXG4gICAgaWYgKHR5cGVvZiB0aGlzLm9wdGlvbnMuaW50ZW50cyA9PT0gJ251bWJlcicpIHtcclxuICAgICAgcmV0dXJuIHRoaXMub3B0aW9ucy5pbnRlbnRzO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRoaXMub3B0aW9ucy5pbnRlbnRzLnJlZHVjZSgoYWNjLCBpbnRlbnQpID0+IGFjYyB8IGludGVudCwgMCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHYXRld2F5IGNsb3NlIGNvZGUgZGVzY3JpcHRpb25zXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgQ0xPU0VfQ09ERVM6IFJlY29yZDxudW1iZXIsIHsgbWVzc2FnZTogc3RyaW5nOyByZWNvbm5lY3RhYmxlOiBib29sZWFuIH0+ID0ge1xyXG4gICAgNDAwMDogeyBtZXNzYWdlOiAnQmlsaW5tZXllbiBoYXRhIChVbmtub3duIGVycm9yKScsIHJlY29ubmVjdGFibGU6IHRydWUgfSxcclxuICAgIDQwMDE6IHsgbWVzc2FnZTogJ0JpbGlubWV5ZW4gb3Bjb2RlIGfDtm5kZXJpbGRpIChVbmtub3duIG9wY29kZSknLCByZWNvbm5lY3RhYmxlOiB0cnVlIH0sXHJcbiAgICA0MDAyOiB7IG1lc3NhZ2U6ICdHZcOnZXJzaXogcGF5bG9hZCBnw7ZuZGVyaWxkaSAoRGVjb2RlIGVycm9yKScsIHJlY29ubmVjdGFibGU6IHRydWUgfSxcclxuICAgIDQwMDM6IHsgbWVzc2FnZTogJ0hlbsO8eiBraW1saWsgZG/En3J1bGFtYXPEsSB5YXDEsWxtYWTEsSAoTm90IGF1dGhlbnRpY2F0ZWQpJywgcmVjb25uZWN0YWJsZTogdHJ1ZSB9LFxyXG4gICAgNDAwNDogeyBtZXNzYWdlOiAnR2XDp2Vyc2l6IGJvdCB0b2tlblxcJ8SxIChBdXRoZW50aWNhdGlvbiBmYWlsZWQpJywgcmVjb25uZWN0YWJsZTogZmFsc2UgfSxcclxuICAgIDQwMDU6IHsgbWVzc2FnZTogJ1phdGVuIGtpbWxpayBkb8SfcnVsYW1hc8SxIHlhcMSxbG3EscWfIChBbHJlYWR5IGF1dGhlbnRpY2F0ZWQpJywgcmVjb25uZWN0YWJsZTogdHJ1ZSB9LFxyXG4gICAgNDAwNzogeyBtZXNzYWdlOiAnR2XDp2Vyc2l6IHNlcXVlbmNlIG51bWFyYXPEsSAoSW52YWxpZCBzZXEpJywgcmVjb25uZWN0YWJsZTogdHJ1ZSB9LFxyXG4gICAgNDAwODogeyBtZXNzYWdlOiAnUmF0ZSBsaW1pdCBhxZ/EsWxkxLEgKFJhdGUgbGltaXRlZCknLCByZWNvbm5lY3RhYmxlOiB0cnVlIH0sXHJcbiAgICA0MDA5OiB7IG1lc3NhZ2U6ICdPdHVydW0gemFtYW4gYcWfxLFtxLFuYSB1xJ9yYWTEsSAoU2Vzc2lvbiB0aW1lZCBvdXQpJywgcmVjb25uZWN0YWJsZTogdHJ1ZSB9LFxyXG4gICAgNDAxMDogeyBtZXNzYWdlOiAnR2XDp2Vyc2l6IHNoYXJkIHlhcMSxbGFuZMSxcm1hc8SxIChJbnZhbGlkIHNoYXJkKScsIHJlY29ubmVjdGFibGU6IGZhbHNlIH0sXHJcbiAgICA0MDExOiB7IG1lc3NhZ2U6ICdTaGFyZGluZyBnZXJla2xpIChTaGFyZGluZyByZXF1aXJlZCknLCByZWNvbm5lY3RhYmxlOiBmYWxzZSB9LFxyXG4gICAgNDAxNDogeyBtZXNzYWdlOiAnxLB6aW4gdmVyaWxtZXllbiBpbnRlbnRcXCdsZXIgaXN0ZW5kaSAoRGlzYWxsb3dlZCBpbnRlbnRzKScsIHJlY29ubmVjdGFibGU6IGZhbHNlIH0sXHJcbiAgfTtcclxuXHJcbiAgLyoqXHJcbiAgICogTG9naW4gdG8gdGhlIGdhdGV3YXlcclxuICAgKi9cclxuICBhc3luYyBsb2dpbih0b2tlbjogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcclxuICAgIGlmICghdG9rZW4gfHwgdHlwZW9mIHRva2VuICE9PSAnc3RyaW5nJykge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXHJcbiAgICAgICAgJ0dlw6dlcmxpIGJpciBib3QgdG9rZW5cXCfEsSBzYcSfbGFubWFsxLFkxLFyLiDDlnJuZWs6IGNsaWVudC5sb2dpbihwcm9jZXNzLmVudi5CT1RfVE9LRU4pJ1xyXG4gICAgICApO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMudG9rZW4gPSB0b2tlbi5yZXBsYWNlKC9eQm90XFxzKy9pLCAnJyk7XHJcbiAgICB0aGlzLnJlc3Quc2V0VG9rZW4odGhpcy50b2tlbik7XHJcbiAgICB0aGlzLl9sb2dpblN0YXRlID0gJ2Nvbm5lY3RpbmcnO1xyXG4gICAgdGhpcy5fcmVjb25uZWN0QXR0ZW1wdHMgPSAwO1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgIGNvbnN0IGNsZWFudXAgPSAoKSA9PiB7XHJcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xyXG4gICAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIoJ3JlYWR5Jywgb25SZWFkeSk7XHJcbiAgICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcignZXJyb3InLCBvbkVycm9yKTtcclxuICAgICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKCdnYXRld2F5Q2xvc2UnLCBvbkdhdGV3YXlDbG9zZSk7XHJcbiAgICAgIH07XHJcblxyXG4gICAgICBjb25zdCB0aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgY2xlYW51cCgpO1xyXG4gICAgICAgIHRoaXMuX2xvZ2luU3RhdGUgPSAnaWRsZSc7XHJcbiAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihcclxuICAgICAgICAgICdHYXRld2F5XFwnZSBiYcSfbGFuxLFsYW1hZMSxOiAzMCBzYW5peWUgacOnaW5kZSBSRUFEWSBldmVudFxcJ2kgYWzEsW5hbWFkxLEuICcgK1xyXG4gICAgICAgICAgJ09sYXPEsSBzZWJlcGxlcjogZ2F0ZXdheSBzdW51Y3VzdSBlcmnFn2lsZW1leiwgdG9rZW4gZ2XDp2Vyc2l6IHZleWEgYcSfIHNvcnVudS4nXHJcbiAgICAgICAgKSk7XHJcbiAgICAgIH0sIDMwMDAwKTtcclxuXHJcbiAgICAgIGNvbnN0IG9uUmVhZHkgPSAoKSA9PiB7XHJcbiAgICAgICAgY2xlYW51cCgpO1xyXG4gICAgICAgIHRoaXMuX2xvZ2luU3RhdGUgPSAncmVhZHknO1xyXG4gICAgICAgIHRoaXMuX3JlY29ubmVjdEF0dGVtcHRzID0gMDtcclxuICAgICAgICByZXNvbHZlKHRoaXMudG9rZW4pO1xyXG4gICAgICB9O1xyXG5cclxuICAgICAgY29uc3Qgb25FcnJvciA9IChlcnJvcjogRXJyb3IpID0+IHtcclxuICAgICAgICBjbGVhbnVwKCk7XHJcbiAgICAgICAgdGhpcy5fbG9naW5TdGF0ZSA9ICdpZGxlJztcclxuICAgICAgICByZWplY3QoZXJyb3IpO1xyXG4gICAgICB9O1xyXG5cclxuICAgICAgY29uc3Qgb25HYXRld2F5Q2xvc2UgPSAoY29kZTogbnVtYmVyLCByZWFzb246IHN0cmluZykgPT4ge1xyXG4gICAgICAgIGNvbnN0IGluZm8gPSBDbGllbnQuQ0xPU0VfQ09ERVNbY29kZV07XHJcbiAgICAgICAgaWYgKGluZm8gJiYgIWluZm8ucmVjb25uZWN0YWJsZSkge1xyXG4gICAgICAgICAgY2xlYW51cCgpO1xyXG4gICAgICAgICAgdGhpcy5fbG9naW5TdGF0ZSA9ICdpZGxlJztcclxuICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoYEdhdGV3YXkgYmHEn2xhbnTEsXPEsSByZWRkZWRpbGRpIFske2NvZGV9XTogJHtpbmZvLm1lc3NhZ2V9JHtyZWFzb24gPyAnIC0gJyArIHJlYXNvbiA6ICcnfWApKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gUmVjb25uZWN0YWJsZSBjb2RlczogbG9naW4gcHJvbWlzZSBzdGF5cyBhbGl2ZSwgY29ubmVjdCgpIHdpbGwgcmV0cnlcclxuICAgICAgfTtcclxuXHJcbiAgICAgIHRoaXMub25jZSgncmVhZHknLCBvblJlYWR5KTtcclxuICAgICAgdGhpcy5vbmNlKCdlcnJvcicsIG9uRXJyb3IpO1xyXG4gICAgICB0aGlzLm9uKCdnYXRld2F5Q2xvc2UnLCBvbkdhdGV3YXlDbG9zZSk7XHJcblxyXG4gICAgICB0aGlzLmNvbm5lY3QoKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ29ubmVjdCB0byB0aGUgZ2F0ZXdheVxyXG4gICAqL1xyXG4gIHByaXZhdGUgY29ubmVjdCgpOiB2b2lkIHtcclxuICAgIHRoaXMud3MgPSBuZXcgV2ViU29ja2V0KHRoaXMuZ2F0ZXdheVVybCk7XHJcbiAgICBcclxuICAgIHRoaXMud3Mub24oJ29wZW4nLCAoKSA9PiB7XHJcbiAgICAgIHRoaXMuZW1pdCgnZGVidWcnLCAnV2ViU29ja2V0IGJhxJ9sYW50xLFzxLEgYcOnxLFsZMSxJyk7XHJcbiAgICAgIHRoaXMuX3JlY29ubmVjdEF0dGVtcHRzID0gMDtcclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICB0aGlzLndzLm9uKCdtZXNzYWdlJywgKGRhdGEpID0+IHtcclxuICAgICAgdGhpcy5oYW5kbGVNZXNzYWdlKGRhdGEudG9TdHJpbmcoKSk7XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgdGhpcy53cy5vbignY2xvc2UnLCAoY29kZSwgcmVhc29uKSA9PiB7XHJcbiAgICAgIGNvbnN0IHJlYXNvblN0ciA9IHJlYXNvbj8udG9TdHJpbmcoKSB8fCAnJztcclxuICAgICAgY29uc3QgaW5mbyA9IENsaWVudC5DTE9TRV9DT0RFU1tjb2RlXTtcclxuICAgICAgXHJcbiAgICAgIGlmIChpbmZvKSB7XHJcbiAgICAgICAgdGhpcy5lbWl0KCdkZWJ1ZycsIGBHYXRld2F5IGJhxJ9sYW50xLFzxLEga2FwYW5kxLEgWyR7Y29kZX1dOiAke2luZm8ubWVzc2FnZX0ke3JlYXNvblN0ciA/ICcgLSAnICsgcmVhc29uU3RyIDogJyd9YCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdGhpcy5lbWl0KCdkZWJ1ZycsIGBXZWJTb2NrZXQga2FwYW5kxLE6ICR7Y29kZX0gLSAke3JlYXNvblN0cn1gKTtcclxuICAgICAgfVxyXG4gICAgICBcclxuICAgICAgdGhpcy5jbGVhbnVwKCk7XHJcblxyXG4gICAgICAvLyBFbWl0IGdhdGV3YXlDbG9zZSBzbyBsb2dpbigpIGNhbiBoYW5kbGUgbm9uLXJlY29ubmVjdGFibGUgY29kZXNcclxuICAgICAgdGhpcy5lbWl0KCdnYXRld2F5Q2xvc2UnLCBjb2RlLCByZWFzb25TdHIpO1xyXG5cclxuICAgICAgLy8gTm9uLXJlY29ubmVjdGFibGUgY29kZXM6IGRvbid0IHJldHJ5XHJcbiAgICAgIGlmIChpbmZvICYmICFpbmZvLnJlY29ubmVjdGFibGUpIHtcclxuICAgICAgICB0aGlzLmVtaXQoJ2RlYnVnJywgYEtvZCAke2NvZGV9IHllbmlkZW4gYmHEn2xhbsSxbGFtYXosIGJhxJ9sYW50xLEgc29ubGFuZMSxcsSxbMSxeW9yLmApO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gTm9ybWFsIGNsb3NlOiBkb24ndCByZXRyeVxyXG4gICAgICBpZiAoY29kZSA9PT0gMTAwMCkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gUmVjb25uZWN0YWJsZTogcmV0cnkgd2l0aCBiYWNrb2ZmXHJcbiAgICAgIHRoaXMuX3JlY29ubmVjdEF0dGVtcHRzKys7XHJcbiAgICAgIGlmICh0aGlzLl9yZWNvbm5lY3RBdHRlbXB0cyA+IHRoaXMuX21heFJlY29ubmVjdEF0dGVtcHRzKSB7XHJcbiAgICAgICAgdGhpcy5lbWl0KCdkZWJ1ZycsIGBNYWtzaW11bSB5ZW5pZGVuIGJhxJ9sYW5tYSBkZW5lbWVzaSBhxZ/EsWxkxLEgKCR7dGhpcy5fbWF4UmVjb25uZWN0QXR0ZW1wdHN9KWApO1xyXG4gICAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCBuZXcgRXJyb3IoXHJcbiAgICAgICAgICBgR2F0ZXdheSBiYcSfbGFudMSxc8SxICR7dGhpcy5fbWF4UmVjb25uZWN0QXR0ZW1wdHN9IGRlbmVtZWRlbiBzb25yYSBrdXJ1bGFtYWTEsS4gU29uIGthcGFubWEga29kdTogJHtjb2RlfWBcclxuICAgICAgICApKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNvbnN0IGRlbGF5ID0gTWF0aC5taW4oMTAwMCAqIE1hdGgucG93KDIsIHRoaXMuX3JlY29ubmVjdEF0dGVtcHRzIC0gMSksIDMwMDAwKTtcclxuICAgICAgdGhpcy5lbWl0KCdkZWJ1ZycsIGBZZW5pZGVuIGJhxJ9sYW7EsWzEsXlvciAoZGVuZW1lICR7dGhpcy5fcmVjb25uZWN0QXR0ZW1wdHN9LyR7dGhpcy5fbWF4UmVjb25uZWN0QXR0ZW1wdHN9KSwgJHtkZWxheX1tcyBzb25yYS4uLmApO1xyXG4gICAgICBzZXRUaW1lb3V0KCgpID0+IHRoaXMuY29ubmVjdCgpLCBkZWxheSk7XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgdGhpcy53cy5vbignZXJyb3InLCAoZXJyb3IpID0+IHtcclxuICAgICAgdGhpcy5lbWl0KCdkZWJ1ZycsIGBXZWJTb2NrZXQgaGF0YXPEsTogJHtlcnJvci5tZXNzYWdlfWApO1xyXG4gICAgICB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyb3IpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBIYW5kbGUgaW5jb21pbmcgZ2F0ZXdheSBtZXNzYWdlXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBoYW5kbGVNZXNzYWdlKGRhdGE6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgLy8gSGFuZGxlIG11bHRpcGxlIG1lc3NhZ2VzIGluIG9uZSBmcmFtZVxyXG4gICAgY29uc3QgbWVzc2FnZXMgPSBkYXRhLnNwbGl0KCdcXG4nKS5maWx0ZXIobSA9PiBtLnRyaW0oKSk7XHJcbiAgICBcclxuICAgIGZvciAoY29uc3QgbXNnIG9mIG1lc3NhZ2VzKSB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgcGF5bG9hZDogR2F0ZXdheVBheWxvYWQgPSBKU09OLnBhcnNlKG1zZyk7XHJcbiAgICAgICAgdGhpcy5oYW5kbGVQYXlsb2FkKHBheWxvYWQpO1xyXG4gICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgdGhpcy5lbWl0KCdkZWJ1ZycsIGBGYWlsZWQgdG8gcGFyc2UgbWVzc2FnZTogJHttc2d9YCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZSBnYXRld2F5IHBheWxvYWRcclxuICAgKi9cclxuICBwcml2YXRlIGhhbmRsZVBheWxvYWQocGF5bG9hZDogR2F0ZXdheVBheWxvYWQpOiB2b2lkIHtcclxuICAgIGlmIChwYXlsb2FkLnMpIHtcclxuICAgICAgdGhpcy5zZXF1ZW5jZSA9IHBheWxvYWQucztcclxuICAgIH1cclxuXHJcbiAgICBzd2l0Y2ggKHBheWxvYWQub3ApIHtcclxuICAgICAgY2FzZSBHYXRld2F5T3Bjb2Rlcy5IZWxsbzpcclxuICAgICAgICB0aGlzLmhhbmRsZUhlbGxvKHBheWxvYWQuZCk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgR2F0ZXdheU9wY29kZXMuRGlzcGF0Y2g6XHJcbiAgICAgICAgdGhpcy5oYW5kbGVEaXNwYXRjaChwYXlsb2FkLnQhLCBwYXlsb2FkLmQpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlIEdhdGV3YXlPcGNvZGVzLkhlYXJ0YmVhdEFjazpcclxuICAgICAgICB0aGlzLmVtaXQoJ2RlYnVnJywgJ0hlYXJ0YmVhdCBhY2tub3dsZWRnZWQnKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSBHYXRld2F5T3Bjb2Rlcy5JbnZhbGlkU2Vzc2lvbjpcclxuICAgICAgICB0aGlzLmVtaXQoJ2RlYnVnJywgJ0dlw6dlcnNpeiBvdHVydW0sIHllbmlkZW4ga2ltbGlrIGRvxJ9ydWxhbsSxeW9yLi4uJyk7XHJcbiAgICAgICAgLy8gSW52YWxpZFNlc3Npb24gbWF5IGNhcnJ5IGVycm9yIGRhdGEgZnJvbSBzZW5kRXJyb3IoKVxyXG4gICAgICAgIGlmIChwYXlsb2FkLmQgJiYgdHlwZW9mIHBheWxvYWQuZCA9PT0gJ29iamVjdCcgJiYgcGF5bG9hZC5kLmNvZGUgJiYgcGF5bG9hZC5kLm1lc3NhZ2UpIHtcclxuICAgICAgICAgIHRoaXMuZW1pdCgnZGVidWcnLCBgU3VudWN1IGhhdGFzxLEgWyR7cGF5bG9hZC5kLmNvZGV9XTogJHtwYXlsb2FkLmQubWVzc2FnZX1gKTtcclxuICAgICAgICAgIGNvbnN0IGluZm8gPSBDbGllbnQuQ0xPU0VfQ09ERVNbcGF5bG9hZC5kLmNvZGVdO1xyXG4gICAgICAgICAgaWYgKGluZm8gJiYgIWluZm8ucmVjb25uZWN0YWJsZSkge1xyXG4gICAgICAgICAgICB0aGlzLmVtaXQoJ2Vycm9yJywgbmV3IEVycm9yKGBHYXRld2F5IGhhdGFzxLEgWyR7cGF5bG9hZC5kLmNvZGV9XTogJHtpbmZvLm1lc3NhZ2V9YCkpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4gdGhpcy5pZGVudGlmeSgpLCA1MDAwKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSBHYXRld2F5T3Bjb2Rlcy5SZWNvbm5lY3Q6XHJcbiAgICAgICAgdGhpcy5lbWl0KCdkZWJ1ZycsICdSZWNvbm5lY3QgcmVxdWVzdGVkJyk7XHJcbiAgICAgICAgdGhpcy53cz8uY2xvc2UoKTtcclxuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHRoaXMuY29ubmVjdCgpLCAxMDAwKTtcclxuICAgICAgICBicmVhaztcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZSBIZWxsbyBwYXlsb2FkXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBoYW5kbGVIZWxsbyhkYXRhOiB7IGhlYXJ0YmVhdF9pbnRlcnZhbDogbnVtYmVyIH0pOiB2b2lkIHtcclxuICAgIHRoaXMuZW1pdCgnZGVidWcnLCBgUmVjZWl2ZWQgSGVsbG8sIGhlYXJ0YmVhdCBpbnRlcnZhbDogJHtkYXRhLmhlYXJ0YmVhdF9pbnRlcnZhbH1tc2ApO1xyXG4gICAgdGhpcy5zdGFydEhlYXJ0YmVhdChkYXRhLmhlYXJ0YmVhdF9pbnRlcnZhbCk7XHJcbiAgICB0aGlzLmlkZW50aWZ5KCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBIYW5kbGUgRGlzcGF0Y2ggZXZlbnRzXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBoYW5kbGVEaXNwYXRjaChldmVudFR5cGU6IHN0cmluZywgZGF0YTogYW55KTogdm9pZCB7XHJcbiAgICB0aGlzLmVtaXQoJ2RlYnVnJywgYERpc3BhdGNoOiAke2V2ZW50VHlwZX1gKTtcclxuICAgIFxyXG4gICAgc3dpdGNoIChldmVudFR5cGUpIHtcclxuICAgICAgY2FzZSAnUkVBRFknOlxyXG4gICAgICAgIHRoaXMuaGFuZGxlUmVhZHkoZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ0dVSUxEX0NSRUFURSc6XHJcbiAgICAgICAgdGhpcy5oYW5kbGVHdWlsZENyZWF0ZShkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnR1VJTERfVVBEQVRFJzpcclxuICAgICAgICB0aGlzLmhhbmRsZUd1aWxkVXBkYXRlKGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdHVUlMRF9ERUxFVEUnOlxyXG4gICAgICAgIHRoaXMuaGFuZGxlR3VpbGREZWxldGUoZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ01FU1NBR0VfQ1JFQVRFJzpcclxuICAgICAgICB0aGlzLmhhbmRsZU1lc3NhZ2VDcmVhdGUoZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ01FU1NBR0VfVVBEQVRFJzpcclxuICAgICAgICB0aGlzLmVtaXQoJ21lc3NhZ2VVcGRhdGUnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnTUVTU0FHRV9ERUxFVEUnOlxyXG4gICAgICAgIHRoaXMuZW1pdCgnbWVzc2FnZURlbGV0ZScsIGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdNRVNTQUdFX0RFTEVURV9CVUxLJzpcclxuICAgICAgICB0aGlzLmVtaXQoJ21lc3NhZ2VEZWxldGVCdWxrJywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ0NIQU5ORUxfQ1JFQVRFJzoge1xyXG4gICAgICAgIC8vIFVwZGF0ZSBndWlsZCBjaGFubmVsIGNhY2hlXHJcbiAgICAgICAgY29uc3QgZ3VpbGRJZCA9IGRhdGEuZ3VpbGRfaWQ7XHJcbiAgICAgICAgY29uc3QgY2hhbm5lbElkID0gZGF0YS5pZCB8fCBkYXRhLmNoYW5uZWxfaWQ7XHJcbiAgICAgICAgaWYgKGd1aWxkSWQgJiYgY2hhbm5lbElkKSB7XHJcbiAgICAgICAgICBjb25zdCBndWlsZCA9IHRoaXMuZ3VpbGRzLmdldChndWlsZElkKTtcclxuICAgICAgICAgIGlmIChndWlsZCkge1xyXG4gICAgICAgICAgICBndWlsZC5jaGFubmVscy5zZXQoY2hhbm5lbElkLCBkYXRhKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5lbWl0KCdjaGFubmVsQ3JlYXRlJywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgY2FzZSAnQ0hBTk5FTF9VUERBVEUnOiB7XHJcbiAgICAgICAgY29uc3QgZ3VpbGRJZCA9IGRhdGEuZ3VpbGRfaWQ7XHJcbiAgICAgICAgY29uc3QgY2hhbm5lbElkID0gZGF0YS5pZCB8fCBkYXRhLmNoYW5uZWxfaWQ7XHJcbiAgICAgICAgaWYgKGd1aWxkSWQgJiYgY2hhbm5lbElkKSB7XHJcbiAgICAgICAgICBjb25zdCBndWlsZCA9IHRoaXMuZ3VpbGRzLmdldChndWlsZElkKTtcclxuICAgICAgICAgIGlmIChndWlsZCkge1xyXG4gICAgICAgICAgICBndWlsZC5jaGFubmVscy5zZXQoY2hhbm5lbElkLCBkYXRhKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5lbWl0KCdjaGFubmVsVXBkYXRlJywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgY2FzZSAnQ0hBTk5FTF9ERUxFVEUnOiB7XHJcbiAgICAgICAgY29uc3QgZ3VpbGRJZCA9IGRhdGEuZ3VpbGRfaWQ7XHJcbiAgICAgICAgY29uc3QgY2hhbm5lbElkID0gZGF0YS5pZCB8fCBkYXRhLmNoYW5uZWxfaWQ7XHJcbiAgICAgICAgaWYgKGd1aWxkSWQgJiYgY2hhbm5lbElkKSB7XHJcbiAgICAgICAgICBjb25zdCBndWlsZCA9IHRoaXMuZ3VpbGRzLmdldChndWlsZElkKTtcclxuICAgICAgICAgIGlmIChndWlsZCkge1xyXG4gICAgICAgICAgICBndWlsZC5jaGFubmVscy5kZWxldGUoY2hhbm5lbElkKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5lbWl0KCdjaGFubmVsRGVsZXRlJywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgY2FzZSAnR1VJTERfTUVNQkVSX0FERCc6IHtcclxuICAgICAgICBjb25zdCBndWlsZCA9IHRoaXMuZ3VpbGRzLmdldChTdHJpbmcoZGF0YS5ndWlsZF9pZCkpO1xyXG4gICAgICAgIGlmIChndWlsZCAmJiBkYXRhLnVzZXIpIHtcclxuICAgICAgICAgIGNvbnN0IG1lbWJlciA9IGd1aWxkLl9hZGRNZW1iZXIoZGF0YSk7XHJcbiAgICAgICAgICB0aGlzLmVtaXQoJ2d1aWxkTWVtYmVyQWRkJywgbWVtYmVyKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgdGhpcy5lbWl0KCdndWlsZE1lbWJlckFkZCcsIGRhdGEpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBicmVhaztcclxuICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdHVUlMRF9NRU1CRVJfVVBEQVRFJzoge1xyXG4gICAgICAgIGNvbnN0IGd1aWxkID0gdGhpcy5ndWlsZHMuZ2V0KFN0cmluZyhkYXRhLmd1aWxkX2lkKSk7XHJcbiAgICAgICAgY29uc3QgcmF3VXNlcklkID0gZGF0YS51c2VyPy5pZCB8fCBkYXRhLnVzZXJfaWQ7XHJcbiAgICAgICAgaWYgKGd1aWxkICYmIHJhd1VzZXJJZCkge1xyXG4gICAgICAgICAgY29uc3QgZXhpc3RpbmcgPSBndWlsZC5tZW1iZXJzLmdldChTdHJpbmcocmF3VXNlcklkKSk7XHJcbiAgICAgICAgICBpZiAoZXhpc3RpbmcpIHtcclxuICAgICAgICAgICAgZXhpc3RpbmcuX3BhdGNoKGRhdGEpO1xyXG4gICAgICAgICAgICB0aGlzLmVtaXQoJ2d1aWxkTWVtYmVyVXBkYXRlJywgZXhpc3RpbmcpO1xyXG4gICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5lbWl0KCdndWlsZE1lbWJlclVwZGF0ZScsIGRhdGEpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICB0aGlzLmVtaXQoJ2d1aWxkTWVtYmVyVXBkYXRlJywgZGF0YSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ0dVSUxEX01FTUJFUl9SRU1PVkUnOiB7XHJcbiAgICAgICAgY29uc3QgZ3VpbGQgPSB0aGlzLmd1aWxkcy5nZXQoU3RyaW5nKGRhdGEuZ3VpbGRfaWQpKTtcclxuICAgICAgICBjb25zdCByYXdVc2VySWQgPSBkYXRhLnVzZXI/LmlkIHx8IGRhdGEudXNlcl9pZDtcclxuICAgICAgICBpZiAoZ3VpbGQgJiYgcmF3VXNlcklkKSB7XHJcbiAgICAgICAgICBjb25zdCB1c2VySWQgPSBTdHJpbmcocmF3VXNlcklkKTtcclxuICAgICAgICAgIGNvbnN0IG1lbWJlciA9IGd1aWxkLm1lbWJlcnMuZ2V0KHVzZXJJZCk7XHJcbiAgICAgICAgICBndWlsZC5tZW1iZXJzLmRlbGV0ZSh1c2VySWQpO1xyXG4gICAgICAgICAgdGhpcy5lbWl0KCdndWlsZE1lbWJlclJlbW92ZScsIG1lbWJlciB8fCBkYXRhKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgdGhpcy5lbWl0KCdndWlsZE1lbWJlclJlbW92ZScsIGRhdGEpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBicmVhaztcclxuICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdHVUlMRF9ST0xFX0NSRUFURSc6XHJcbiAgICAgICAgdGhpcy5lbWl0KCdyb2xlQ3JlYXRlJywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ0dVSUxEX1JPTEVfVVBEQVRFJzpcclxuICAgICAgICB0aGlzLmVtaXQoJ3JvbGVVcGRhdGUnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnR1VJTERfUk9MRV9ERUxFVEUnOlxyXG4gICAgICAgIHRoaXMuZW1pdCgncm9sZURlbGV0ZScsIGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdHVUlMRF9CQU5fQUREJzpcclxuICAgICAgICB0aGlzLmVtaXQoJ2d1aWxkQmFuQWRkJywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ0dVSUxEX0JBTl9SRU1PVkUnOlxyXG4gICAgICAgIHRoaXMuZW1pdCgnZ3VpbGRCYW5SZW1vdmUnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnSU5WSVRFX0NSRUFURSc6XHJcbiAgICAgICAgdGhpcy5lbWl0KCdpbnZpdGVDcmVhdGUnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnSU5WSVRFX0RFTEVURSc6XHJcbiAgICAgICAgdGhpcy5lbWl0KCdpbnZpdGVEZWxldGUnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnVFlQSU5HX1NUQVJUJzpcclxuICAgICAgICB0aGlzLmVtaXQoJ3R5cGluZ1N0YXJ0JywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ1BSRVNFTkNFX1VQREFURSc6XHJcbiAgICAgICAgdGhpcy5lbWl0KCdwcmVzZW5jZVVwZGF0ZScsIGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdJTlRFUkFDVElPTl9DUkVBVEUnOlxyXG4gICAgICAgIHRoaXMuaGFuZGxlSW50ZXJhY3Rpb25DcmVhdGUoZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ1ZPSUNFX1NUQVRFX1VQREFURSc6XHJcbiAgICAgICAgdGhpcy5oYW5kbGVWb2ljZVN0YXRlVXBkYXRlKGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdWT0lDRV9TRVJWRVJfVVBEQVRFJzpcclxuICAgICAgICB0aGlzLmhhbmRsZVZvaWNlU2VydmVyVXBkYXRlKGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBkZWZhdWx0OlxyXG4gICAgICAgIC8vIEVtaXQgcmF3IGV2ZW50IGZvciB1bmhhbmRsZWQgdHlwZXNcclxuICAgICAgICB0aGlzLmVtaXQoJ3JhdycsIHsgdDogZXZlbnRUeXBlLCBkOiBkYXRhIH0pO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSGFuZGxlIFJlYWR5IGV2ZW50XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBoYW5kbGVSZWFkeShkYXRhOiBSZWFkeUV2ZW50RGF0YSk6IHZvaWQge1xyXG4gICAgdGhpcy5zZXNzaW9uSWQgPSBkYXRhLnNlc3Npb25faWQ7XHJcbiAgICB0aGlzLnVzZXIgPSBuZXcgVXNlcihkYXRhLnVzZXIpO1xyXG4gICAgLy8gSGFuZGxlIGJvdGggc3RyaW5nIGFuZCBudW1iZXIgYXBwbGljYXRpb24gSURzXHJcbiAgICB0aGlzLmFwcGxpY2F0aW9uSWQgPSBkYXRhLmFwcGxpY2F0aW9uPy5pZCA/IFN0cmluZyhkYXRhLmFwcGxpY2F0aW9uLmlkKSA6IG51bGw7XHJcbiAgICBpZiAodGhpcy5hcHBsaWNhdGlvbklkKSB7XHJcbiAgICAgIHRoaXMucmVzdC5zZXRBcHBsaWNhdGlvbklkKHRoaXMuYXBwbGljYXRpb25JZCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIENhY2hlIGd1aWxkcyAoYXMgdW5hdmFpbGFibGUgaW5pdGlhbGx5KVxyXG4gICAgaWYgKGRhdGEuZ3VpbGRzKSB7XHJcbiAgICAgIGZvciAoY29uc3QgZ3VpbGQgb2YgZGF0YS5ndWlsZHMpIHtcclxuICAgICAgICB0aGlzLmd1aWxkcy5zZXQoU3RyaW5nKGd1aWxkLmlkKSwgbmV3IEd1aWxkKHRoaXMsIGd1aWxkKSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgLy8gU2V0dXAgdm9pY2UgYWRhcHRlcnMgZm9yIGVhY2ggZ3VpbGRcclxuICAgIHRoaXMuc2V0dXBWb2ljZUFkYXB0ZXJzKCk7XHJcbiAgICBcclxuICAgIGNvbnNvbGUubG9nKGDinIUgQm90IGhhesSxciEgVXNlcjogJHt0aGlzLnVzZXIudXNlcm5hbWV9ICgke3RoaXMudXNlci5pZH0pLCBBcHA6ICR7dGhpcy5hcHBsaWNhdGlvbklkfWApO1xyXG4gICAgdGhpcy5lbWl0KCdyZWFkeScsIHRoaXMpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2V0dXAgdm9pY2UgYWRhcHRlcnMgZm9yIGFsbCBndWlsZHNcclxuICAgKi9cclxuICBwcml2YXRlIHNldHVwVm9pY2VBZGFwdGVycygpOiB2b2lkIHtcclxuICAgIGZvciAoY29uc3QgW2d1aWxkSWRdIG9mIHRoaXMuZ3VpbGRzKSB7XHJcbiAgICAgIHRoaXMuY3JlYXRlVm9pY2VBZGFwdGVyKGd1aWxkSWQpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgdm9pY2UgYWRhcHRlciBmb3IgYSBndWlsZFxyXG4gICAqL1xyXG4gIHByaXZhdGUgY3JlYXRlVm9pY2VBZGFwdGVyKGd1aWxkSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgYWRhcHRlcjogVm9pY2VBZGFwdGVyQ3JlYXRvciA9IChtZXRob2RzKSA9PiB7XHJcbiAgICAgIC8vIFN0b3JlIGhhbmRsZXJzIGZvciB0aGlzIGd1aWxkXHJcbiAgICAgIHRoaXMudm9pY2VTdGF0ZUhhbmRsZXJzLnNldChndWlsZElkLCBtZXRob2RzLm9uVm9pY2VTdGF0ZVVwZGF0ZSk7XHJcbiAgICAgIHRoaXMudm9pY2VTZXJ2ZXJIYW5kbGVycy5zZXQoZ3VpbGRJZCwgbWV0aG9kcy5vblZvaWNlU2VydmVyVXBkYXRlKTtcclxuICAgICAgXHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAgc2VuZFBheWxvYWQ6IChwYXlsb2FkKSA9PiB7XHJcbiAgICAgICAgICBpZiAodGhpcy53cz8ucmVhZHlTdGF0ZSA9PT0gV2ViU29ja2V0Lk9QRU4pIHtcclxuICAgICAgICAgICAgdGhpcy53cy5zZW5kKEpTT04uc3RyaW5naWZ5KHBheWxvYWQpKTtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBkZXN0cm95OiAoKSA9PiB7XHJcbiAgICAgICAgICB0aGlzLnZvaWNlU3RhdGVIYW5kbGVycy5kZWxldGUoZ3VpbGRJZCk7XHJcbiAgICAgICAgICB0aGlzLnZvaWNlU2VydmVySGFuZGxlcnMuZGVsZXRlKGd1aWxkSWQpO1xyXG4gICAgICAgIH1cclxuICAgICAgfTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMudm9pY2UuYWRhcHRlcnMuc2V0KGd1aWxkSWQsIGFkYXB0ZXIpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSGFuZGxlIEd1aWxkIENyZWF0ZSBldmVudFxyXG4gICAqL1xyXG4gIHByaXZhdGUgaGFuZGxlR3VpbGRDcmVhdGUoZGF0YTogQVBJR3VpbGQpOiB2b2lkIHtcclxuICAgIGxldCBndWlsZCA9IHRoaXMuZ3VpbGRzLmdldChkYXRhLmlkKTtcclxuICAgIFxyXG4gICAgaWYgKGd1aWxkKSB7XHJcbiAgICAgIGd1aWxkLl9wYXRjaChkYXRhKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGd1aWxkID0gbmV3IEd1aWxkKHRoaXMsIGRhdGEpO1xyXG4gICAgICB0aGlzLmd1aWxkcy5zZXQoZGF0YS5pZCwgZ3VpbGQpO1xyXG4gICAgICB0aGlzLmNyZWF0ZVZvaWNlQWRhcHRlcihkYXRhLmlkKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgdGhpcy5lbWl0KCdndWlsZENyZWF0ZScsIGd1aWxkKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZSBHdWlsZCBVcGRhdGUgZXZlbnRcclxuICAgKi9cclxuICBwcml2YXRlIGhhbmRsZUd1aWxkVXBkYXRlKGRhdGE6IEFQSUd1aWxkKTogdm9pZCB7XHJcbiAgICBjb25zdCBndWlsZCA9IHRoaXMuZ3VpbGRzLmdldChkYXRhLmlkKTtcclxuICAgIGlmIChndWlsZCkge1xyXG4gICAgICBndWlsZC5fcGF0Y2goZGF0YSk7XHJcbiAgICAgIHRoaXMuZW1pdCgnZ3VpbGRVcGRhdGUnLCBndWlsZCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBIYW5kbGUgR3VpbGQgRGVsZXRlIGV2ZW50XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBoYW5kbGVHdWlsZERlbGV0ZShkYXRhOiB7IGlkOiBzdHJpbmcgfSk6IHZvaWQge1xyXG4gICAgY29uc3QgZ3VpbGQgPSB0aGlzLmd1aWxkcy5nZXQoZGF0YS5pZCk7XHJcbiAgICBpZiAoZ3VpbGQpIHtcclxuICAgICAgdGhpcy5ndWlsZHMuZGVsZXRlKGRhdGEuaWQpO1xyXG4gICAgICB0aGlzLnZvaWNlLmFkYXB0ZXJzLmRlbGV0ZShkYXRhLmlkKTtcclxuICAgICAgdGhpcy5lbWl0KCdndWlsZERlbGV0ZScsIGd1aWxkKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZSBNZXNzYWdlIENyZWF0ZSBldmVudFxyXG4gICAqL1xyXG4gIHByaXZhdGUgaGFuZGxlTWVzc2FnZUNyZWF0ZShkYXRhOiBBUElNZXNzYWdlKTogdm9pZCB7XHJcbiAgICAvLyBCYWNrZW5kIHNlbmRzIHVzZXJfaWQgc2VwYXJhdGVseSwgbWFwIGl0IHRvIGF1dGhvci5pZCBmb3IgY29tcGF0aWJpbGl0eVxyXG4gICAgaWYgKGRhdGEudXNlcl9pZCAmJiBkYXRhLmF1dGhvciAmJiAhZGF0YS5hdXRob3IuaWQpIHtcclxuICAgICAgKGRhdGEuYXV0aG9yIGFzIGFueSkuaWQgPSBkYXRhLnVzZXJfaWQ7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIENhY2hlIHRoZSBhdXRob3JcclxuICAgIGlmIChkYXRhLmF1dGhvcikge1xyXG4gICAgICBjb25zdCB1c2VyID0gbmV3IFVzZXIoZGF0YS5hdXRob3IpO1xyXG4gICAgICB0aGlzLnVzZXJzLnNldCh1c2VyLmlkLCB1c2VyKTtcclxuICAgICAgLy8gQWxzbyBjYWNoZSBpbiBSRVNUIGZvciBtZW50aW9uIHJlc29sdXRpb25cclxuICAgICAgdGhpcy5yZXN0LmNhY2hlVXNlcihkYXRhLmF1dGhvcik7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGNvbnN0IG1lc3NhZ2UgPSBuZXcgTWVzc2FnZSh0aGlzLCBkYXRhKTtcclxuXHJcbiAgICAvLyBNYXJrIG1lc3NhZ2UgYXMgZnJvbSBib3QgaWYgYXV0aG9yIElEIG1hdGNoZXMgdGhlIGJvdCdzIG93biB1c2VyIElEXHJcbiAgICBpZiAodGhpcy51c2VyICYmIFN0cmluZyhtZXNzYWdlLmF1dGhvci5pZCkgPT09IFN0cmluZyh0aGlzLnVzZXIuaWQpKSB7XHJcbiAgICAgIChtZXNzYWdlLmF1dGhvciBhcyBhbnkpLmJvdCA9IHRydWU7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gUmVzb2x2ZSBndWlsZCBtZW1iZXIgaWYgaW4gYSBndWlsZFxyXG4gICAgaWYgKG1lc3NhZ2UuZ3VpbGRJZCkge1xyXG4gICAgICBjb25zdCBndWlsZCA9IHRoaXMuZ3VpbGRzLmdldChtZXNzYWdlLmd1aWxkSWQpO1xyXG4gICAgICBjb25zdCBtZW1iZXJEYXRhID0gKGRhdGEgYXMgYW55KS5tZW1iZXI7XHJcbiAgICAgIGlmIChtZW1iZXJEYXRhICYmIGd1aWxkKSB7XHJcbiAgICAgICAgLy8gR2F0ZXdheSBzZW50IG1lbWJlciBkYXRhIHdpdGggdGhlIG1lc3NhZ2Ug4oCUIGNhY2hlIGl0XHJcbiAgICAgICAgbWVtYmVyRGF0YS51c2VyID0gZGF0YS5hdXRob3I7XHJcbiAgICAgICAgY29uc3QgbWVtYmVyID0gZ3VpbGQuX2FkZE1lbWJlcihtZW1iZXJEYXRhKTtcclxuICAgICAgICBtZXNzYWdlLm1lbWJlciA9IG1lbWJlcjtcclxuICAgICAgfSBlbHNlIGlmIChtZW1iZXJEYXRhKSB7XHJcbiAgICAgICAgLy8gTm8gZ3VpbGQgaW4gY2FjaGUgYnV0IG1lbWJlciBkYXRhIGV4aXN0c1xyXG4gICAgICAgIG1lbWJlckRhdGEudXNlciA9IGRhdGEuYXV0aG9yO1xyXG4gICAgICAgIGNvbnN0IHJlc29sdmVkR3VpbGQgPSB7IGlkOiBtZXNzYWdlLmd1aWxkSWQsIG93bmVySWQ6IG51bGwgfSBhcyBhbnk7XHJcbiAgICAgICAgbWVzc2FnZS5tZW1iZXIgPSBuZXcgKHJlcXVpcmUoJy4vc3RydWN0dXJlcy9HdWlsZE1lbWJlcicpLkd1aWxkTWVtYmVyKSh0aGlzLCByZXNvbHZlZEd1aWxkLCBtZW1iZXJEYXRhKTtcclxuICAgICAgfSBlbHNlIGlmIChndWlsZCkge1xyXG4gICAgICAgIC8vIFRyeSBjYWNoZVxyXG4gICAgICAgIGNvbnN0IGNhY2hlZCA9IGd1aWxkLm1lbWJlcnM/LmdldChTdHJpbmcobWVzc2FnZS5hdXRob3IuaWQpKTtcclxuICAgICAgICBpZiAoY2FjaGVkPy5wZXJtaXNzaW9ucz8uaGFzKSB7XHJcbiAgICAgICAgICBtZXNzYWdlLm1lbWJlciA9IGNhY2hlZDtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmVtaXQoJ21lc3NhZ2VDcmVhdGUnLCBtZXNzYWdlKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZSBJbnRlcmFjdGlvbiBDcmVhdGUgZXZlbnRcclxuICAgKi9cclxuICBwcml2YXRlIGhhbmRsZUludGVyYWN0aW9uQ3JlYXRlKGRhdGE6IEFQSUludGVyYWN0aW9uKTogdm9pZCB7XHJcbiAgICBjb25zb2xlLmxvZygnW0RFQlVHXSBoYW5kbGVJbnRlcmFjdGlvbkNyZWF0ZSBjYWxsZWQgd2l0aDonLCBKU09OLnN0cmluZ2lmeShkYXRhLCBudWxsLCAyKSk7XHJcbiAgICBcclxuICAgIC8vIENhY2hlIHRoZSB1c2VyXHJcbiAgICBjb25zdCB1c2VyRGF0YSA9IGRhdGEubWVtYmVyPy51c2VyIHx8IGRhdGEudXNlcjtcclxuICAgIGlmICh1c2VyRGF0YSkge1xyXG4gICAgICBjb25zdCB1c2VyID0gbmV3IFVzZXIodXNlckRhdGEpO1xyXG4gICAgICB0aGlzLnVzZXJzLnNldCh1c2VyLmlkLCB1c2VyKTtcclxuICAgICAgdGhpcy5yZXN0LmNhY2hlVXNlcih1c2VyRGF0YSk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGNvbnN0IGludGVyYWN0aW9uID0gY3JlYXRlSW50ZXJhY3Rpb24odGhpcywgZGF0YSk7XHJcbiAgICBjb25zb2xlLmxvZygnW0RFQlVHXSBDcmVhdGVkIGludGVyYWN0aW9uIHR5cGU6JywgaW50ZXJhY3Rpb24uY29uc3RydWN0b3IubmFtZSwgJ2N1c3RvbUlkOicsIChpbnRlcmFjdGlvbiBhcyBhbnkpLmN1c3RvbUlkKTtcclxuICAgIHRoaXMuZW1pdCgnaW50ZXJhY3Rpb25DcmVhdGUnLCBpbnRlcmFjdGlvbik7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBIYW5kbGUgVm9pY2UgU3RhdGUgVXBkYXRlIGV2ZW50XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBoYW5kbGVWb2ljZVN0YXRlVXBkYXRlKGRhdGE6IGFueSk6IHZvaWQge1xyXG4gICAgY29uc3QgZ3VpbGRJZCA9IGRhdGEuZ3VpbGRfaWQ7XHJcbiAgICBcclxuICAgIC8vIEZvcndhcmQgdG8gdm9pY2UgYWRhcHRlciBpZiBleGlzdHNcclxuICAgIGNvbnN0IGhhbmRsZXIgPSB0aGlzLnZvaWNlU3RhdGVIYW5kbGVycy5nZXQoZ3VpbGRJZCk7XHJcbiAgICBpZiAoaGFuZGxlcikge1xyXG4gICAgICBoYW5kbGVyKGRhdGEpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICB0aGlzLmVtaXQoJ3ZvaWNlU3RhdGVVcGRhdGUnLCBkYXRhKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZSBWb2ljZSBTZXJ2ZXIgVXBkYXRlIGV2ZW50XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBoYW5kbGVWb2ljZVNlcnZlclVwZGF0ZShkYXRhOiBBUElWb2ljZVNlcnZlclVwZGF0ZSk6IHZvaWQge1xyXG4gICAgY29uc3QgZ3VpbGRJZCA9IGRhdGEuZ3VpbGRfaWQ7XHJcbiAgICBcclxuICAgIC8vIEZvcndhcmQgdG8gdm9pY2UgYWRhcHRlciBpZiBleGlzdHNcclxuICAgIGNvbnN0IGhhbmRsZXIgPSB0aGlzLnZvaWNlU2VydmVySGFuZGxlcnMuZ2V0KGd1aWxkSWQpO1xyXG4gICAgaWYgKGhhbmRsZXIpIHtcclxuICAgICAgaGFuZGxlcih7XHJcbiAgICAgICAgdG9rZW46IGRhdGEudG9rZW4sXHJcbiAgICAgICAgZW5kcG9pbnQ6IGRhdGEuZW5kcG9pbnQsXHJcbiAgICAgICAgcm9vbTogZGF0YS5yb29tXHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICB0aGlzLmVtaXQoJ3ZvaWNlU2VydmVyVXBkYXRlJywgZGF0YSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZW5kIElkZW50aWZ5IHBheWxvYWRcclxuICAgKi9cclxuICBwcml2YXRlIGlkZW50aWZ5KCk6IHZvaWQge1xyXG4gICAgY29uc3QgcGF5bG9hZDogR2F0ZXdheVBheWxvYWQgPSB7XHJcbiAgICAgIG9wOiBHYXRld2F5T3Bjb2Rlcy5JZGVudGlmeSxcclxuICAgICAgZDoge1xyXG4gICAgICAgIHRva2VuOiBgQm90ICR7dGhpcy50b2tlbn1gLFxyXG4gICAgICAgIGludGVudHM6IHRoaXMuZ2V0SW50ZW50c1ZhbHVlKCksXHJcbiAgICAgICAgc2hhcmQ6IHRoaXMub3B0aW9ucy5zaGFyZHMgfHwgWzAsIDFdXHJcbiAgICAgIH1cclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMuc2VuZChwYXlsb2FkKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFN0YXJ0IGhlYXJ0YmVhdFxyXG4gICAqL1xyXG4gIHByaXZhdGUgc3RhcnRIZWFydGJlYXQoaW50ZXJ2YWw6IG51bWJlcik6IHZvaWQge1xyXG4gICAgdGhpcy5oZWFydGJlYXRJbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHtcclxuICAgICAgdGhpcy5zZW5kKHtcclxuICAgICAgICBvcDogR2F0ZXdheU9wY29kZXMuSGVhcnRiZWF0LFxyXG4gICAgICAgIGQ6IHRoaXMuc2VxdWVuY2VcclxuICAgICAgfSk7XHJcbiAgICB9LCBpbnRlcnZhbCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZW5kIHBheWxvYWQgdG8gZ2F0ZXdheVxyXG4gICAqL1xyXG4gIHByaXZhdGUgc2VuZChwYXlsb2FkOiBHYXRld2F5UGF5bG9hZCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMud3M/LnJlYWR5U3RhdGUgPT09IFdlYlNvY2tldC5PUEVOKSB7XHJcbiAgICAgIHRoaXMud3Muc2VuZChKU09OLnN0cmluZ2lmeShwYXlsb2FkKSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDbGVhbnVwIG9uIGRpc2Nvbm5lY3RcclxuICAgKi9cclxuICBwcml2YXRlIGNsZWFudXAoKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy5oZWFydGJlYXRJbnRlcnZhbCkge1xyXG4gICAgICBjbGVhckludGVydmFsKHRoaXMuaGVhcnRiZWF0SW50ZXJ2YWwpO1xyXG4gICAgICB0aGlzLmhlYXJ0YmVhdEludGVydmFsID0gbnVsbDtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlc3Ryb3kgdGhlIGNsaWVudFxyXG4gICAqL1xyXG4gIGRlc3Ryb3koKTogdm9pZCB7XHJcbiAgICB0aGlzLl9sb2dpblN0YXRlID0gJ2lkbGUnO1xyXG4gICAgdGhpcy5fcmVjb25uZWN0QXR0ZW1wdHMgPSB0aGlzLl9tYXhSZWNvbm5lY3RBdHRlbXB0cyArIDE7IC8vIFByZXZlbnQgcmVjb25uZWN0XHJcbiAgICB0aGlzLmNsZWFudXAoKTtcclxuICAgIHRoaXMud3M/LmNsb3NlKDEwMDApO1xyXG4gICAgdGhpcy53cyA9IG51bGw7XHJcbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygpO1xyXG4gIH1cclxufVxyXG5cclxuLy8gUmUtZXhwb3J0IGZvciBjb252ZW5pZW5jZVxyXG5leHBvcnQgeyBHYXRld2F5SW50ZW50Qml0cyB9O1xyXG4iXX0=