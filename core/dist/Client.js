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
const ApplicationCommandManager_1 = require("./managers/ApplicationCommandManager");
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
    /** Application object with commands manager (Discord.js compatible) */
    application = null;
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
        // Initialize application object with commands manager
        this.application = {
            id: this.applicationId,
            commands: new ApplicationCommandManager_1.ApplicationCommandManager(this.rest),
        };
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
                // _addMember preserves voice state from existing cache automatically
                memberData.user = data.author;
                const member = guild._addMember(memberData);
                message.member = member;
            }
            else if (memberData) {
                // No guild in cache but member data exists
                memberData.user = data.author;
                const resolvedGuild = { id: message.guildId, ownerId: null, members: new Collection_1.Collection(), channels: new Collection_1.Collection() };
                message.member = new (require('./structures/GuildMember').GuildMember)(this, resolvedGuild, memberData);
            }
            else if (guild) {
                // No member data from gateway — use cached member (may have voice state from VOICE_STATE_UPDATE)
                const cached = guild.members?.get(String(message.author.id));
                if (cached) {
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
        const userId = data.user_id;
        // Update member voice state in cache
        if (guildId && userId) {
            const guild = this.guilds.get(String(guildId));
            if (guild) {
                const userIdStr = String(userId);
                let member = guild.members.get(userIdStr);
                if (!member && data.user) {
                    // Member not in cache yet — create a minimal entry from voice state data
                    member = guild._addMember({
                        user: data.user,
                        roles: [],
                        joined_at: new Date().toISOString(),
                    });
                }
                if (member) {
                    member.voice = {
                        channelId: data.channel_id ?? undefined,
                        selfMute: data.self_mute ?? false,
                        selfDeaf: data.self_deaf ?? false,
                    };
                }
            }
        }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ2xpZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL0NsaWVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxtQ0FBc0M7QUFDdEMsNENBQTJCO0FBWTNCLG1DQUE0RDtBQTZ5Qm5ELGtHQTd5QmdCLHlCQUFpQixPQTZ5QmhCO0FBNXlCMUIsd0RBQXFEO0FBQ3JELDRDQUF5QztBQUN6Qyw4Q0FBMkM7QUFDM0Msa0RBQStDO0FBQy9DLDBEQUEwRTtBQUUxRSxzQ0FBbUM7QUFDbkMsb0ZBQWlGO0FBY2pGOztHQUVHO0FBQ0gsTUFBYSxNQUFPLFNBQVEscUJBQVk7SUFDdEMscUJBQXFCO0lBQ0wsT0FBTyxDQUFnQjtJQUV2QyxzQkFBc0I7SUFDTixJQUFJLENBQU87SUFFM0IsbUJBQW1CO0lBQ1osSUFBSSxHQUFnQixJQUFJLENBQUM7SUFFaEMscUJBQXFCO0lBQ2QsYUFBYSxHQUFrQixJQUFJLENBQUM7SUFFM0MsdUVBQXVFO0lBQ2hFLFdBQVcsR0FHUCxJQUFJLENBQUM7SUFFaEIsb0JBQW9CO0lBQ2IsTUFBTSxHQUE4QixJQUFJLHVCQUFVLEVBQUUsQ0FBQztJQUU1RCxzQkFBc0I7SUFDZixRQUFRLEdBQW9DLElBQUksdUJBQVUsRUFBRSxDQUFDO0lBRXBFLG1CQUFtQjtJQUNaLEtBQUssR0FBNkIsSUFBSSx1QkFBVSxFQUFFLENBQUM7SUFFMUQsK0JBQStCO0lBQ3hCLEtBQUssQ0FFVjtJQUVGLDJCQUEyQjtJQUNuQixFQUFFLEdBQXFCLElBQUksQ0FBQztJQUVwQyxnQkFBZ0I7SUFDUixLQUFLLEdBQVcsRUFBRSxDQUFDO0lBRTNCLGlCQUFpQjtJQUNULFNBQVMsR0FBa0IsSUFBSSxDQUFDO0lBRXhDLHNCQUFzQjtJQUNkLFFBQVEsR0FBa0IsSUFBSSxDQUFDO0lBRXZDLHlCQUF5QjtJQUNqQixpQkFBaUIsR0FBMEIsSUFBSSxDQUFDO0lBRXhELGtCQUFrQjtJQUNWLFVBQVUsQ0FBUztJQUUzQiwyREFBMkQ7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QUFDO0lBQ2YsQ0FBQztJQUVEOztPQUVHO0lBQ0ssSUFBSSxDQUFDLE9BQXVCO1FBQ2xDLElBQUksSUFBSSxDQUFDLEVBQUUsRUFBRSxVQUFVLEtBQUssWUFBUyxDQUFDLElBQUksRUFBRSxDQUFDO1lBQzNDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUN4QyxDQUFDO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0ssT0FBTztRQUNiLElBQUksSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7WUFDM0IsYUFBYSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1lBQ3RDLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLENBQUM7UUFDaEMsQ0FBQztJQUNILENBQUM7SUFFRDs7T0FFRztJQUNILE9BQU87UUFDTCxJQUFJLENBQUMsV0FBVyxHQUFHLE1BQU0sQ0FBQztRQUMxQixJQUFJLENBQUMsa0JBQWtCLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixHQUFHLENBQUMsQ0FBQyxDQUFDLG9CQUFvQjtRQUM5RSxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDZixJQUFJLENBQUMsRUFBRSxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNyQixJQUFJLENBQUMsRUFBRSxHQUFHLElBQUksQ0FBQztRQUNmLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO0lBQzVCLENBQUM7O0FBaHhCSCx3QkFpeEJDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRXZlbnRFbWl0dGVyIH0gZnJvbSAnZXZlbnRzJztcclxuaW1wb3J0IFdlYlNvY2tldCBmcm9tICd3cyc7XHJcbmltcG9ydCB7IFxyXG4gIENsaWVudE9wdGlvbnMsIFxyXG4gIEdhdGV3YXlQYXlsb2FkLCBcclxuICBSZWFkeUV2ZW50RGF0YSxcclxuICBBUElHdWlsZCxcclxuICBBUElJbnRlcmFjdGlvbixcclxuICBBUElNZXNzYWdlLFxyXG4gIEFQSVZvaWNlU2VydmVyVXBkYXRlLFxyXG4gIEFQSUNoYW5uZWwsXHJcbiAgQVBJVXNlclxyXG59IGZyb20gJy4vdHlwZXMnO1xyXG5pbXBvcnQgeyBHYXRld2F5T3Bjb2RlcywgR2F0ZXdheUludGVudEJpdHMgfSBmcm9tICcuL2VudW1zJztcclxuaW1wb3J0IHsgQ29sbGVjdGlvbiB9IGZyb20gJy4vc3RydWN0dXJlcy9Db2xsZWN0aW9uJztcclxuaW1wb3J0IHsgVXNlciB9IGZyb20gJy4vc3RydWN0dXJlcy9Vc2VyJztcclxuaW1wb3J0IHsgR3VpbGQgfSBmcm9tICcuL3N0cnVjdHVyZXMvR3VpbGQnO1xyXG5pbXBvcnQgeyBNZXNzYWdlIH0gZnJvbSAnLi9zdHJ1Y3R1cmVzL01lc3NhZ2UnO1xyXG5pbXBvcnQgeyBjcmVhdGVJbnRlcmFjdGlvbiwgSW50ZXJhY3Rpb24gfSBmcm9tICcuL3N0cnVjdHVyZXMvSW50ZXJhY3Rpb24nO1xyXG5pbXBvcnQgeyBCYXNlQ2hhbm5lbCwgY3JlYXRlQ2hhbm5lbCB9IGZyb20gJy4vc3RydWN0dXJlcy9DaGFubmVsJztcclxuaW1wb3J0IHsgUkVTVCB9IGZyb20gJy4vcmVzdC9SRVNUJztcclxuaW1wb3J0IHsgQXBwbGljYXRpb25Db21tYW5kTWFuYWdlciB9IGZyb20gJy4vbWFuYWdlcnMvQXBwbGljYXRpb25Db21tYW5kTWFuYWdlcic7XHJcblxyXG4vKipcclxuICogVm9pY2UgYWRhcHRlciBjcmVhdG9yIHR5cGUgZm9yIEBqdWJiaW8vdm9pY2UgY29tcGF0aWJpbGl0eVxyXG4gKi9cclxudHlwZSBWb2ljZUFkYXB0ZXJDcmVhdG9yID0gKG1ldGhvZHM6IHtcclxuICBvblZvaWNlU2VydmVyVXBkYXRlKGRhdGE6IGFueSk6IHZvaWQ7XHJcbiAgb25Wb2ljZVN0YXRlVXBkYXRlKGRhdGE6IGFueSk6IHZvaWQ7XHJcbiAgZGVzdHJveSgpOiB2b2lkO1xyXG59KSA9PiB7XHJcbiAgc2VuZFBheWxvYWQocGF5bG9hZDogYW55KTogYm9vbGVhbjtcclxuICBkZXN0cm95KCk6IHZvaWQ7XHJcbn07XHJcblxyXG4vKipcclxuICogTWFpbiBjbGllbnQgY2xhc3NcclxuICovXHJcbmV4cG9ydCBjbGFzcyBDbGllbnQgZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xyXG4gIC8qKiBDbGllbnQgb3B0aW9ucyAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBvcHRpb25zOiBDbGllbnRPcHRpb25zO1xyXG4gIFxyXG4gIC8qKiBSRVNUIEFQSSBjbGllbnQgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgcmVzdDogUkVTVDtcclxuICBcclxuICAvKiogVGhlIGJvdCB1c2VyICovXHJcbiAgcHVibGljIHVzZXI6IFVzZXIgfCBudWxsID0gbnVsbDtcclxuICBcclxuICAvKiogQXBwbGljYXRpb24gSUQgKi9cclxuICBwdWJsaWMgYXBwbGljYXRpb25JZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XHJcbiAgXHJcbiAgLyoqIEFwcGxpY2F0aW9uIG9iamVjdCB3aXRoIGNvbW1hbmRzIG1hbmFnZXIgKERpc2NvcmQuanMgY29tcGF0aWJsZSkgKi9cclxuICBwdWJsaWMgYXBwbGljYXRpb246IHtcclxuICAgIGlkOiBzdHJpbmcgfCBudWxsO1xyXG4gICAgY29tbWFuZHM6IEFwcGxpY2F0aW9uQ29tbWFuZE1hbmFnZXI7XHJcbiAgfSB8IG51bGwgPSBudWxsO1xyXG4gIFxyXG4gIC8qKiBDYWNoZWQgZ3VpbGRzICovXHJcbiAgcHVibGljIGd1aWxkczogQ29sbGVjdGlvbjxzdHJpbmcsIEd1aWxkPiA9IG5ldyBDb2xsZWN0aW9uKCk7XHJcbiAgXHJcbiAgLyoqIENhY2hlZCBjaGFubmVscyAqL1xyXG4gIHB1YmxpYyBjaGFubmVsczogQ29sbGVjdGlvbjxzdHJpbmcsIEJhc2VDaGFubmVsPiA9IG5ldyBDb2xsZWN0aW9uKCk7XHJcbiAgXHJcbiAgLyoqIENhY2hlZCB1c2VycyAqL1xyXG4gIHB1YmxpYyB1c2VyczogQ29sbGVjdGlvbjxzdHJpbmcsIFVzZXI+ID0gbmV3IENvbGxlY3Rpb24oKTtcclxuICBcclxuICAvKiogVm9pY2UgYWRhcHRlciBtYW5hZ2VtZW50ICovXHJcbiAgcHVibGljIHZvaWNlOiB7XHJcbiAgICBhZGFwdGVyczogTWFwPHN0cmluZywgVm9pY2VBZGFwdGVyQ3JlYXRvcj47XHJcbiAgfTtcclxuICBcclxuICAvKiogV2ViU29ja2V0IGNvbm5lY3Rpb24gKi9cclxuICBwcml2YXRlIHdzOiBXZWJTb2NrZXQgfCBudWxsID0gbnVsbDtcclxuICBcclxuICAvKiogQm90IHRva2VuICovXHJcbiAgcHJpdmF0ZSB0b2tlbjogc3RyaW5nID0gJyc7XHJcbiAgXHJcbiAgLyoqIFNlc3Npb24gSUQgKi9cclxuICBwcml2YXRlIHNlc3Npb25JZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XHJcbiAgXHJcbiAgLyoqIFNlcXVlbmNlIG51bWJlciAqL1xyXG4gIHByaXZhdGUgc2VxdWVuY2U6IG51bWJlciB8IG51bGwgPSBudWxsO1xyXG4gIFxyXG4gIC8qKiBIZWFydGJlYXQgaW50ZXJ2YWwgKi9cclxuICBwcml2YXRlIGhlYXJ0YmVhdEludGVydmFsOiBOb2RlSlMuVGltZW91dCB8IG51bGwgPSBudWxsO1xyXG4gIFxyXG4gIC8qKiBHYXRld2F5IFVSTCAqL1xyXG4gIHByaXZhdGUgZ2F0ZXdheVVybDogc3RyaW5nO1xyXG5cclxuICAvKiogTGFzdCBoZWFydGJlYXQgc2VudCB0aW1lc3RhbXAgKGZvciBwaW5nIGNhbGN1bGF0aW9uKSAqL1xyXG4gIHByaXZhdGUgX2xhc3RIZWFydGJlYXRTZW50OiBudW1iZXIgPSAwO1xyXG5cclxuICAvKiogV2ViU29ja2V0IHBpbmcgKHJvdW5kLXRyaXAgbGF0ZW5jeSBpbiBtcykgKi9cclxuICBwdWJsaWMgcGluZzogbnVtYmVyID0gLTE7XHJcbiAgXHJcbiAgLyoqIFZvaWNlIHN0YXRlIHVwZGF0ZSBoYW5kbGVycyAoZm9yIHZvaWNlIGFkYXB0ZXJzKSAqL1xyXG4gIHByaXZhdGUgdm9pY2VTdGF0ZUhhbmRsZXJzOiBNYXA8c3RyaW5nLCAoZGF0YTogYW55KSA9PiB2b2lkPiA9IG5ldyBNYXAoKTtcclxuICBwcml2YXRlIHZvaWNlU2VydmVySGFuZGxlcnM6IE1hcDxzdHJpbmcsIChkYXRhOiBhbnkpID0+IHZvaWQ+ID0gbmV3IE1hcCgpO1xyXG5cclxuICAvKiogV2hldGhlciB0aGUgY2xpZW50IGlzIGN1cnJlbnRseSBpbiB0aGUgbG9naW4gZmxvdyAqL1xyXG4gIHByaXZhdGUgX2xvZ2luU3RhdGU6ICdpZGxlJyB8ICdjb25uZWN0aW5nJyB8ICdyZWFkeScgPSAnaWRsZSc7XHJcblxyXG4gIC8qKiBSZWNvbm5lY3QgYXR0ZW1wdCBjb3VudGVyICovXHJcbiAgcHJpdmF0ZSBfcmVjb25uZWN0QXR0ZW1wdHM6IG51bWJlciA9IDA7XHJcblxyXG4gIC8qKiBNYXhpbXVtIHJlY29ubmVjdCBhdHRlbXB0cyBiZWZvcmUgZ2l2aW5nIHVwICovXHJcbiAgcHJpdmF0ZSByZWFkb25seSBfbWF4UmVjb25uZWN0QXR0ZW1wdHM6IG51bWJlciA9IDU7XHJcblxyXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnM6IENsaWVudE9wdGlvbnMpIHtcclxuICAgIHN1cGVyKCk7XHJcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xyXG4gICAgdGhpcy5nYXRld2F5VXJsID0gb3B0aW9ucy5nYXRld2F5VXJsIHx8ICd3c3M6Ly9yZWFsdGltZS5qdWJiaW8uY29tL3dzL2JvdCc7XHJcbiAgICB0aGlzLnJlc3QgPSBuZXcgUkVTVChvcHRpb25zLmFwaVVybCk7XHJcbiAgICBcclxuICAgIC8vIEluaXRpYWxpemUgdm9pY2UgYWRhcHRlciBzeXN0ZW1cclxuICAgIHRoaXMudm9pY2UgPSB7XHJcbiAgICAgIGFkYXB0ZXJzOiBuZXcgTWFwKClcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDYWxjdWxhdGUgaW50ZW50cyB2YWx1ZVxyXG4gICAqL1xyXG4gIHByaXZhdGUgZ2V0SW50ZW50c1ZhbHVlKCk6IG51bWJlciB7XHJcbiAgICBpZiAodHlwZW9mIHRoaXMub3B0aW9ucy5pbnRlbnRzID09PSAnbnVtYmVyJykge1xyXG4gICAgICByZXR1cm4gdGhpcy5vcHRpb25zLmludGVudHM7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGhpcy5vcHRpb25zLmludGVudHMucmVkdWNlKChhY2MsIGludGVudCkgPT4gYWNjIHwgaW50ZW50LCAwKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdhdGV3YXkgY2xvc2UgY29kZSBkZXNjcmlwdGlvbnNcclxuICAgKi9cclxuICBwcml2YXRlIHN0YXRpYyByZWFkb25seSBDTE9TRV9DT0RFUzogUmVjb3JkPG51bWJlciwgeyBtZXNzYWdlOiBzdHJpbmc7IHJlY29ubmVjdGFibGU6IGJvb2xlYW4gfT4gPSB7XHJcbiAgICA0MDAwOiB7IG1lc3NhZ2U6ICdCaWxpbm1leWVuIGhhdGEgKFVua25vd24gZXJyb3IpJywgcmVjb25uZWN0YWJsZTogdHJ1ZSB9LFxyXG4gICAgNDAwMTogeyBtZXNzYWdlOiAnQmlsaW5tZXllbiBvcGNvZGUgZ8O2bmRlcmlsZGkgKFVua25vd24gb3Bjb2RlKScsIHJlY29ubmVjdGFibGU6IHRydWUgfSxcclxuICAgIDQwMDI6IHsgbWVzc2FnZTogJ0dlw6dlcnNpeiBwYXlsb2FkIGfDtm5kZXJpbGRpIChEZWNvZGUgZXJyb3IpJywgcmVjb25uZWN0YWJsZTogdHJ1ZSB9LFxyXG4gICAgNDAwMzogeyBtZXNzYWdlOiAnSGVuw7x6IGtpbWxpayBkb8SfcnVsYW1hc8SxIHlhcMSxbG1hZMSxIChOb3QgYXV0aGVudGljYXRlZCknLCByZWNvbm5lY3RhYmxlOiB0cnVlIH0sXHJcbiAgICA0MDA0OiB7IG1lc3NhZ2U6ICdHZcOnZXJzaXogYm90IHRva2VuXFwnxLEgKEF1dGhlbnRpY2F0aW9uIGZhaWxlZCknLCByZWNvbm5lY3RhYmxlOiBmYWxzZSB9LFxyXG4gICAgNDAwNTogeyBtZXNzYWdlOiAnWmF0ZW4ga2ltbGlrIGRvxJ9ydWxhbWFzxLEgeWFwxLFsbcSxxZ8gKEFscmVhZHkgYXV0aGVudGljYXRlZCknLCByZWNvbm5lY3RhYmxlOiB0cnVlIH0sXHJcbiAgICA0MDA3OiB7IG1lc3NhZ2U6ICdHZcOnZXJzaXogc2VxdWVuY2UgbnVtYXJhc8SxIChJbnZhbGlkIHNlcSknLCByZWNvbm5lY3RhYmxlOiB0cnVlIH0sXHJcbiAgICA0MDA4OiB7IG1lc3NhZ2U6ICdSYXRlIGxpbWl0IGHFn8SxbGTEsSAoUmF0ZSBsaW1pdGVkKScsIHJlY29ubmVjdGFibGU6IHRydWUgfSxcclxuICAgIDQwMDk6IHsgbWVzc2FnZTogJ090dXJ1bSB6YW1hbiBhxZ/EsW3EsW5hIHXEn3JhZMSxIChTZXNzaW9uIHRpbWVkIG91dCknLCByZWNvbm5lY3RhYmxlOiB0cnVlIH0sXHJcbiAgICA0MDEwOiB7IG1lc3NhZ2U6ICdHZcOnZXJzaXogc2hhcmQgeWFwxLFsYW5kxLFybWFzxLEgKEludmFsaWQgc2hhcmQpJywgcmVjb25uZWN0YWJsZTogZmFsc2UgfSxcclxuICAgIDQwMTE6IHsgbWVzc2FnZTogJ1NoYXJkaW5nIGdlcmVrbGkgKFNoYXJkaW5nIHJlcXVpcmVkKScsIHJlY29ubmVjdGFibGU6IGZhbHNlIH0sXHJcbiAgICA0MDE0OiB7IG1lc3NhZ2U6ICfEsHppbiB2ZXJpbG1leWVuIGludGVudFxcJ2xlciBpc3RlbmRpIChEaXNhbGxvd2VkIGludGVudHMpJywgcmVjb25uZWN0YWJsZTogZmFsc2UgfSxcclxuICB9O1xyXG5cclxuICAvKipcclxuICAgKiBMb2dpbiB0byB0aGUgZ2F0ZXdheVxyXG4gICAqL1xyXG4gIGFzeW5jIGxvZ2luKHRva2VuOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xyXG4gICAgaWYgKCF0b2tlbiB8fCB0eXBlb2YgdG9rZW4gIT09ICdzdHJpbmcnKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihcclxuICAgICAgICAnR2XDp2VybGkgYmlyIGJvdCB0b2tlblxcJ8SxIHNhxJ9sYW5tYWzEsWTEsXIuIMOWcm5lazogY2xpZW50LmxvZ2luKHByb2Nlc3MuZW52LkJPVF9UT0tFTiknXHJcbiAgICAgICk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy50b2tlbiA9IHRva2VuLnJlcGxhY2UoL15Cb3RcXHMrL2ksICcnKTtcclxuICAgIHRoaXMucmVzdC5zZXRUb2tlbih0aGlzLnRva2VuKTtcclxuICAgIHRoaXMuX2xvZ2luU3RhdGUgPSAnY29ubmVjdGluZyc7XHJcbiAgICB0aGlzLl9yZWNvbm5lY3RBdHRlbXB0cyA9IDA7XHJcblxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgY29uc3QgY2xlYW51cCA9ICgpID0+IHtcclxuICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XHJcbiAgICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcigncmVhZHknLCBvblJlYWR5KTtcclxuICAgICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKCdlcnJvcicsIG9uRXJyb3IpO1xyXG4gICAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIoJ2dhdGV3YXlDbG9zZScsIG9uR2F0ZXdheUNsb3NlKTtcclxuICAgICAgfTtcclxuXHJcbiAgICAgIGNvbnN0IHRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICBjbGVhbnVwKCk7XHJcbiAgICAgICAgdGhpcy5fbG9naW5TdGF0ZSA9ICdpZGxlJztcclxuICAgICAgICByZWplY3QobmV3IEVycm9yKFxyXG4gICAgICAgICAgJ0dhdGV3YXlcXCdlIGJhxJ9sYW7EsWxhbWFkxLE6IDMwIHNhbml5ZSBpw6dpbmRlIFJFQURZIGV2ZW50XFwnaSBhbMSxbmFtYWTEsS4gJyArXHJcbiAgICAgICAgICAnT2xhc8SxIHNlYmVwbGVyOiBnYXRld2F5IHN1bnVjdXN1IGVyacWfaWxlbWV6LCB0b2tlbiBnZcOnZXJzaXogdmV5YSBhxJ8gc29ydW51LidcclxuICAgICAgICApKTtcclxuICAgICAgfSwgMzAwMDApO1xyXG5cclxuICAgICAgY29uc3Qgb25SZWFkeSA9ICgpID0+IHtcclxuICAgICAgICBjbGVhbnVwKCk7XHJcbiAgICAgICAgdGhpcy5fbG9naW5TdGF0ZSA9ICdyZWFkeSc7XHJcbiAgICAgICAgdGhpcy5fcmVjb25uZWN0QXR0ZW1wdHMgPSAwO1xyXG4gICAgICAgIHJlc29sdmUodGhpcy50b2tlbik7XHJcbiAgICAgIH07XHJcblxyXG4gICAgICBjb25zdCBvbkVycm9yID0gKGVycm9yOiBFcnJvcikgPT4ge1xyXG4gICAgICAgIGNsZWFudXAoKTtcclxuICAgICAgICB0aGlzLl9sb2dpblN0YXRlID0gJ2lkbGUnO1xyXG4gICAgICAgIHJlamVjdChlcnJvcik7XHJcbiAgICAgIH07XHJcblxyXG4gICAgICBjb25zdCBvbkdhdGV3YXlDbG9zZSA9IChjb2RlOiBudW1iZXIsIHJlYXNvbjogc3RyaW5nKSA9PiB7XHJcbiAgICAgICAgY29uc3QgaW5mbyA9IENsaWVudC5DTE9TRV9DT0RFU1tjb2RlXTtcclxuICAgICAgICBpZiAoaW5mbyAmJiAhaW5mby5yZWNvbm5lY3RhYmxlKSB7XHJcbiAgICAgICAgICBjbGVhbnVwKCk7XHJcbiAgICAgICAgICB0aGlzLl9sb2dpblN0YXRlID0gJ2lkbGUnO1xyXG4gICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihgR2F0ZXdheSBiYcSfbGFudMSxc8SxIHJlZGRlZGlsZGkgWyR7Y29kZX1dOiAke2luZm8ubWVzc2FnZX0ke3JlYXNvbiA/ICcgLSAnICsgcmVhc29uIDogJyd9YCkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICAvLyBSZWNvbm5lY3RhYmxlIGNvZGVzOiBsb2dpbiBwcm9taXNlIHN0YXlzIGFsaXZlLCBjb25uZWN0KCkgd2lsbCByZXRyeVxyXG4gICAgICB9O1xyXG5cclxuICAgICAgdGhpcy5vbmNlKCdyZWFkeScsIG9uUmVhZHkpO1xyXG4gICAgICB0aGlzLm9uY2UoJ2Vycm9yJywgb25FcnJvcik7XHJcbiAgICAgIHRoaXMub24oJ2dhdGV3YXlDbG9zZScsIG9uR2F0ZXdheUNsb3NlKTtcclxuXHJcbiAgICAgIHRoaXMuY29ubmVjdCgpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDb25uZWN0IHRvIHRoZSBnYXRld2F5XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBjb25uZWN0KCk6IHZvaWQge1xyXG4gICAgdGhpcy53cyA9IG5ldyBXZWJTb2NrZXQodGhpcy5nYXRld2F5VXJsKTtcclxuICAgIFxyXG4gICAgdGhpcy53cy5vbignb3BlbicsICgpID0+IHtcclxuICAgICAgdGhpcy5lbWl0KCdkZWJ1ZycsICdXZWJTb2NrZXQgYmHEn2xhbnTEsXPEsSBhw6fEsWxkxLEnKTtcclxuICAgICAgdGhpcy5fcmVjb25uZWN0QXR0ZW1wdHMgPSAwO1xyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIHRoaXMud3Mub24oJ21lc3NhZ2UnLCAoZGF0YSkgPT4ge1xyXG4gICAgICB0aGlzLmhhbmRsZU1lc3NhZ2UoZGF0YS50b1N0cmluZygpKTtcclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICB0aGlzLndzLm9uKCdjbG9zZScsIChjb2RlLCByZWFzb24pID0+IHtcclxuICAgICAgY29uc3QgcmVhc29uU3RyID0gcmVhc29uPy50b1N0cmluZygpIHx8ICcnO1xyXG4gICAgICBjb25zdCBpbmZvID0gQ2xpZW50LkNMT1NFX0NPREVTW2NvZGVdO1xyXG4gICAgICBcclxuICAgICAgaWYgKGluZm8pIHtcclxuICAgICAgICB0aGlzLmVtaXQoJ2RlYnVnJywgYEdhdGV3YXkgYmHEn2xhbnTEsXPEsSBrYXBhbmTEsSBbJHtjb2RlfV06ICR7aW5mby5tZXNzYWdlfSR7cmVhc29uU3RyID8gJyAtICcgKyByZWFzb25TdHIgOiAnJ31gKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICB0aGlzLmVtaXQoJ2RlYnVnJywgYFdlYlNvY2tldCBrYXBhbmTEsTogJHtjb2RlfSAtICR7cmVhc29uU3RyfWApO1xyXG4gICAgICB9XHJcbiAgICAgIFxyXG4gICAgICB0aGlzLmNsZWFudXAoKTtcclxuXHJcbiAgICAgIC8vIEVtaXQgZ2F0ZXdheUNsb3NlIHNvIGxvZ2luKCkgY2FuIGhhbmRsZSBub24tcmVjb25uZWN0YWJsZSBjb2Rlc1xyXG4gICAgICB0aGlzLmVtaXQoJ2dhdGV3YXlDbG9zZScsIGNvZGUsIHJlYXNvblN0cik7XHJcblxyXG4gICAgICAvLyBOb24tcmVjb25uZWN0YWJsZSBjb2RlczogZG9uJ3QgcmV0cnlcclxuICAgICAgaWYgKGluZm8gJiYgIWluZm8ucmVjb25uZWN0YWJsZSkge1xyXG4gICAgICAgIHRoaXMuZW1pdCgnZGVidWcnLCBgS29kICR7Y29kZX0geWVuaWRlbiBiYcSfbGFuxLFsYW1heiwgYmHEn2xhbnTEsSBzb25sYW5kxLFyxLFsxLF5b3IuYCk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyBOb3JtYWwgY2xvc2U6IGRvbid0IHJldHJ5XHJcbiAgICAgIGlmIChjb2RlID09PSAxMDAwKSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyBSZWNvbm5lY3RhYmxlOiByZXRyeSB3aXRoIGJhY2tvZmZcclxuICAgICAgdGhpcy5fcmVjb25uZWN0QXR0ZW1wdHMrKztcclxuICAgICAgaWYgKHRoaXMuX3JlY29ubmVjdEF0dGVtcHRzID4gdGhpcy5fbWF4UmVjb25uZWN0QXR0ZW1wdHMpIHtcclxuICAgICAgICB0aGlzLmVtaXQoJ2RlYnVnJywgYE1ha3NpbXVtIHllbmlkZW4gYmHEn2xhbm1hIGRlbmVtZXNpIGHFn8SxbGTEsSAoJHt0aGlzLl9tYXhSZWNvbm5lY3RBdHRlbXB0c30pYCk7XHJcbiAgICAgICAgdGhpcy5lbWl0KCdlcnJvcicsIG5ldyBFcnJvcihcclxuICAgICAgICAgIGBHYXRld2F5IGJhxJ9sYW50xLFzxLEgJHt0aGlzLl9tYXhSZWNvbm5lY3RBdHRlbXB0c30gZGVuZW1lZGVuIHNvbnJhIGt1cnVsYW1hZMSxLiBTb24ga2FwYW5tYSBrb2R1OiAke2NvZGV9YFxyXG4gICAgICAgICkpO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG5cclxuICAgICAgY29uc3QgZGVsYXkgPSBNYXRoLm1pbigxMDAwICogTWF0aC5wb3coMiwgdGhpcy5fcmVjb25uZWN0QXR0ZW1wdHMgLSAxKSwgMzAwMDApO1xyXG4gICAgICB0aGlzLmVtaXQoJ2RlYnVnJywgYFllbmlkZW4gYmHEn2xhbsSxbMSxeW9yIChkZW5lbWUgJHt0aGlzLl9yZWNvbm5lY3RBdHRlbXB0c30vJHt0aGlzLl9tYXhSZWNvbm5lY3RBdHRlbXB0c30pLCAke2RlbGF5fW1zIHNvbnJhLi4uYCk7XHJcbiAgICAgIHNldFRpbWVvdXQoKCkgPT4gdGhpcy5jb25uZWN0KCksIGRlbGF5KTtcclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICB0aGlzLndzLm9uKCdlcnJvcicsIChlcnJvcikgPT4ge1xyXG4gICAgICB0aGlzLmVtaXQoJ2RlYnVnJywgYFdlYlNvY2tldCBoYXRhc8SxOiAke2Vycm9yLm1lc3NhZ2V9YCk7XHJcbiAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCBlcnJvcik7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZSBpbmNvbWluZyBnYXRld2F5IG1lc3NhZ2VcclxuICAgKi9cclxuICBwcml2YXRlIGhhbmRsZU1lc3NhZ2UoZGF0YTogc3RyaW5nKTogdm9pZCB7XHJcbiAgICAvLyBIYW5kbGUgbXVsdGlwbGUgbWVzc2FnZXMgaW4gb25lIGZyYW1lXHJcbiAgICBjb25zdCBtZXNzYWdlcyA9IGRhdGEuc3BsaXQoJ1xcbicpLmZpbHRlcihtID0+IG0udHJpbSgpKTtcclxuICAgIFxyXG4gICAgZm9yIChjb25zdCBtc2cgb2YgbWVzc2FnZXMpIHtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBjb25zdCBwYXlsb2FkOiBHYXRld2F5UGF5bG9hZCA9IEpTT04ucGFyc2UobXNnKTtcclxuICAgICAgICB0aGlzLmhhbmRsZVBheWxvYWQocGF5bG9hZCk7XHJcbiAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICB0aGlzLmVtaXQoJ2RlYnVnJywgYEZhaWxlZCB0byBwYXJzZSBtZXNzYWdlOiAke21zZ31gKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSGFuZGxlIGdhdGV3YXkgcGF5bG9hZFxyXG4gICAqL1xyXG4gIHByaXZhdGUgaGFuZGxlUGF5bG9hZChwYXlsb2FkOiBHYXRld2F5UGF5bG9hZCk6IHZvaWQge1xyXG4gICAgaWYgKHBheWxvYWQucykge1xyXG4gICAgICB0aGlzLnNlcXVlbmNlID0gcGF5bG9hZC5zO1xyXG4gICAgfVxyXG5cclxuICAgIHN3aXRjaCAocGF5bG9hZC5vcCkge1xyXG4gICAgICBjYXNlIEdhdGV3YXlPcGNvZGVzLkhlbGxvOlxyXG4gICAgICAgIHRoaXMuaGFuZGxlSGVsbG8ocGF5bG9hZC5kKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSBHYXRld2F5T3Bjb2Rlcy5EaXNwYXRjaDpcclxuICAgICAgICB0aGlzLmhhbmRsZURpc3BhdGNoKHBheWxvYWQudCEsIHBheWxvYWQuZCk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgR2F0ZXdheU9wY29kZXMuSGVhcnRiZWF0QWNrOlxyXG4gICAgICAgIGlmICh0aGlzLl9sYXN0SGVhcnRiZWF0U2VudCA+IDApIHtcclxuICAgICAgICAgIHRoaXMucGluZyA9IERhdGUubm93KCkgLSB0aGlzLl9sYXN0SGVhcnRiZWF0U2VudDtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5lbWl0KCdkZWJ1ZycsIGBIZWFydGJlYXQgYWNrbm93bGVkZ2VkIChwaW5nOiAke3RoaXMucGluZ31tcylgKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSBHYXRld2F5T3Bjb2Rlcy5JbnZhbGlkU2Vzc2lvbjpcclxuICAgICAgICB0aGlzLmVtaXQoJ2RlYnVnJywgJ0dlw6dlcnNpeiBvdHVydW0sIHllbmlkZW4ga2ltbGlrIGRvxJ9ydWxhbsSxeW9yLi4uJyk7XHJcbiAgICAgICAgLy8gSW52YWxpZFNlc3Npb24gbWF5IGNhcnJ5IGVycm9yIGRhdGEgZnJvbSBzZW5kRXJyb3IoKVxyXG4gICAgICAgIGlmIChwYXlsb2FkLmQgJiYgdHlwZW9mIHBheWxvYWQuZCA9PT0gJ29iamVjdCcgJiYgcGF5bG9hZC5kLmNvZGUgJiYgcGF5bG9hZC5kLm1lc3NhZ2UpIHtcclxuICAgICAgICAgIHRoaXMuZW1pdCgnZGVidWcnLCBgU3VudWN1IGhhdGFzxLEgWyR7cGF5bG9hZC5kLmNvZGV9XTogJHtwYXlsb2FkLmQubWVzc2FnZX1gKTtcclxuICAgICAgICAgIGNvbnN0IGluZm8gPSBDbGllbnQuQ0xPU0VfQ09ERVNbcGF5bG9hZC5kLmNvZGVdO1xyXG4gICAgICAgICAgaWYgKGluZm8gJiYgIWluZm8ucmVjb25uZWN0YWJsZSkge1xyXG4gICAgICAgICAgICB0aGlzLmVtaXQoJ2Vycm9yJywgbmV3IEVycm9yKGBHYXRld2F5IGhhdGFzxLEgWyR7cGF5bG9hZC5kLmNvZGV9XTogJHtpbmZvLm1lc3NhZ2V9YCkpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4gdGhpcy5pZGVudGlmeSgpLCA1MDAwKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSBHYXRld2F5T3Bjb2Rlcy5SZWNvbm5lY3Q6XHJcbiAgICAgICAgdGhpcy5lbWl0KCdkZWJ1ZycsICdSZWNvbm5lY3QgcmVxdWVzdGVkJyk7XHJcbiAgICAgICAgdGhpcy53cz8uY2xvc2UoKTtcclxuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHRoaXMuY29ubmVjdCgpLCAxMDAwKTtcclxuICAgICAgICBicmVhaztcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZSBIZWxsbyBwYXlsb2FkXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBoYW5kbGVIZWxsbyhkYXRhOiB7IGhlYXJ0YmVhdF9pbnRlcnZhbDogbnVtYmVyIH0pOiB2b2lkIHtcclxuICAgIHRoaXMuZW1pdCgnZGVidWcnLCBgUmVjZWl2ZWQgSGVsbG8sIGhlYXJ0YmVhdCBpbnRlcnZhbDogJHtkYXRhLmhlYXJ0YmVhdF9pbnRlcnZhbH1tc2ApO1xyXG4gICAgdGhpcy5zdGFydEhlYXJ0YmVhdChkYXRhLmhlYXJ0YmVhdF9pbnRlcnZhbCk7XHJcbiAgICB0aGlzLmlkZW50aWZ5KCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBIYW5kbGUgRGlzcGF0Y2ggZXZlbnRzXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBoYW5kbGVEaXNwYXRjaChldmVudFR5cGU6IHN0cmluZywgZGF0YTogYW55KTogdm9pZCB7XHJcbiAgICB0aGlzLmVtaXQoJ2RlYnVnJywgYERpc3BhdGNoOiAke2V2ZW50VHlwZX1gKTtcclxuICAgIFxyXG4gICAgc3dpdGNoIChldmVudFR5cGUpIHtcclxuICAgICAgY2FzZSAnUkVBRFknOlxyXG4gICAgICAgIHRoaXMuaGFuZGxlUmVhZHkoZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ0dVSUxEX0NSRUFURSc6XHJcbiAgICAgICAgdGhpcy5oYW5kbGVHdWlsZENyZWF0ZShkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnR1VJTERfVVBEQVRFJzpcclxuICAgICAgICB0aGlzLmhhbmRsZUd1aWxkVXBkYXRlKGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdHVUlMRF9ERUxFVEUnOlxyXG4gICAgICAgIHRoaXMuaGFuZGxlR3VpbGREZWxldGUoZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ01FU1NBR0VfQ1JFQVRFJzpcclxuICAgICAgICB0aGlzLmhhbmRsZU1lc3NhZ2VDcmVhdGUoZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ01FU1NBR0VfVVBEQVRFJzpcclxuICAgICAgICB0aGlzLmVtaXQoJ21lc3NhZ2VVcGRhdGUnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnTUVTU0FHRV9ERUxFVEUnOlxyXG4gICAgICAgIHRoaXMuZW1pdCgnbWVzc2FnZURlbGV0ZScsIGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdNRVNTQUdFX0RFTEVURV9CVUxLJzpcclxuICAgICAgICB0aGlzLmVtaXQoJ21lc3NhZ2VEZWxldGVCdWxrJywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ0NIQU5ORUxfQ1JFQVRFJzoge1xyXG4gICAgICAgIC8vIFVwZGF0ZSBndWlsZCBjaGFubmVsIGNhY2hlXHJcbiAgICAgICAgY29uc3QgZ3VpbGRJZCA9IGRhdGEuZ3VpbGRfaWQ7XHJcbiAgICAgICAgY29uc3QgY2hhbm5lbElkID0gZGF0YS5pZCB8fCBkYXRhLmNoYW5uZWxfaWQ7XHJcbiAgICAgICAgaWYgKGd1aWxkSWQgJiYgY2hhbm5lbElkKSB7XHJcbiAgICAgICAgICBjb25zdCBndWlsZCA9IHRoaXMuZ3VpbGRzLmdldChndWlsZElkKTtcclxuICAgICAgICAgIGlmIChndWlsZCkge1xyXG4gICAgICAgICAgICBndWlsZC5jaGFubmVscy5zZXQoY2hhbm5lbElkLCBkYXRhKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5lbWl0KCdjaGFubmVsQ3JlYXRlJywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgY2FzZSAnQ0hBTk5FTF9VUERBVEUnOiB7XHJcbiAgICAgICAgY29uc3QgZ3VpbGRJZCA9IGRhdGEuZ3VpbGRfaWQ7XHJcbiAgICAgICAgY29uc3QgY2hhbm5lbElkID0gZGF0YS5pZCB8fCBkYXRhLmNoYW5uZWxfaWQ7XHJcbiAgICAgICAgaWYgKGd1aWxkSWQgJiYgY2hhbm5lbElkKSB7XHJcbiAgICAgICAgICBjb25zdCBndWlsZCA9IHRoaXMuZ3VpbGRzLmdldChndWlsZElkKTtcclxuICAgICAgICAgIGlmIChndWlsZCkge1xyXG4gICAgICAgICAgICBndWlsZC5jaGFubmVscy5zZXQoY2hhbm5lbElkLCBkYXRhKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5lbWl0KCdjaGFubmVsVXBkYXRlJywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgY2FzZSAnQ0hBTk5FTF9ERUxFVEUnOiB7XHJcbiAgICAgICAgY29uc3QgZ3VpbGRJZCA9IGRhdGEuZ3VpbGRfaWQ7XHJcbiAgICAgICAgY29uc3QgY2hhbm5lbElkID0gZGF0YS5pZCB8fCBkYXRhLmNoYW5uZWxfaWQ7XHJcbiAgICAgICAgaWYgKGd1aWxkSWQgJiYgY2hhbm5lbElkKSB7XHJcbiAgICAgICAgICBjb25zdCBndWlsZCA9IHRoaXMuZ3VpbGRzLmdldChndWlsZElkKTtcclxuICAgICAgICAgIGlmIChndWlsZCkge1xyXG4gICAgICAgICAgICBndWlsZC5jaGFubmVscy5kZWxldGUoY2hhbm5lbElkKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5lbWl0KCdjaGFubmVsRGVsZXRlJywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgY2FzZSAnR1VJTERfTUVNQkVSX0FERCc6IHtcclxuICAgICAgICBjb25zdCBndWlsZCA9IHRoaXMuZ3VpbGRzLmdldChTdHJpbmcoZGF0YS5ndWlsZF9pZCkpO1xyXG4gICAgICAgIGlmIChndWlsZCAmJiBkYXRhLnVzZXIpIHtcclxuICAgICAgICAgIGNvbnN0IG1lbWJlciA9IGd1aWxkLl9hZGRNZW1iZXIoZGF0YSk7XHJcbiAgICAgICAgICB0aGlzLmVtaXQoJ2d1aWxkTWVtYmVyQWRkJywgbWVtYmVyKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgdGhpcy5lbWl0KCdndWlsZE1lbWJlckFkZCcsIGRhdGEpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBicmVhaztcclxuICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdHVUlMRF9NRU1CRVJfVVBEQVRFJzoge1xyXG4gICAgICAgIGNvbnN0IGd1aWxkID0gdGhpcy5ndWlsZHMuZ2V0KFN0cmluZyhkYXRhLmd1aWxkX2lkKSk7XHJcbiAgICAgICAgY29uc3QgcmF3VXNlcklkID0gZGF0YS51c2VyPy5pZCB8fCBkYXRhLnVzZXJfaWQ7XHJcbiAgICAgICAgaWYgKGd1aWxkICYmIHJhd1VzZXJJZCkge1xyXG4gICAgICAgICAgY29uc3QgZXhpc3RpbmcgPSBndWlsZC5tZW1iZXJzLmdldChTdHJpbmcocmF3VXNlcklkKSk7XHJcbiAgICAgICAgICBpZiAoZXhpc3RpbmcpIHtcclxuICAgICAgICAgICAgZXhpc3RpbmcuX3BhdGNoKGRhdGEpO1xyXG4gICAgICAgICAgICB0aGlzLmVtaXQoJ2d1aWxkTWVtYmVyVXBkYXRlJywgZXhpc3RpbmcpO1xyXG4gICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdGhpcy5lbWl0KCdndWlsZE1lbWJlclVwZGF0ZScsIGRhdGEpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICB0aGlzLmVtaXQoJ2d1aWxkTWVtYmVyVXBkYXRlJywgZGF0YSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ0dVSUxEX01FTUJFUl9SRU1PVkUnOiB7XHJcbiAgICAgICAgY29uc3QgZ3VpbGQgPSB0aGlzLmd1aWxkcy5nZXQoU3RyaW5nKGRhdGEuZ3VpbGRfaWQpKTtcclxuICAgICAgICBjb25zdCByYXdVc2VySWQgPSBkYXRhLnVzZXI/LmlkIHx8IGRhdGEudXNlcl9pZDtcclxuICAgICAgICBpZiAoZ3VpbGQgJiYgcmF3VXNlcklkKSB7XHJcbiAgICAgICAgICBjb25zdCB1c2VySWQgPSBTdHJpbmcocmF3VXNlcklkKTtcclxuICAgICAgICAgIGNvbnN0IG1lbWJlciA9IGd1aWxkLm1lbWJlcnMuZ2V0KHVzZXJJZCk7XHJcbiAgICAgICAgICBndWlsZC5tZW1iZXJzLmRlbGV0ZSh1c2VySWQpO1xyXG4gICAgICAgICAgdGhpcy5lbWl0KCdndWlsZE1lbWJlclJlbW92ZScsIG1lbWJlciB8fCBkYXRhKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgdGhpcy5lbWl0KCdndWlsZE1lbWJlclJlbW92ZScsIGRhdGEpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBicmVhaztcclxuICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdHVUlMRF9ST0xFX0NSRUFURSc6XHJcbiAgICAgICAgdGhpcy5lbWl0KCdyb2xlQ3JlYXRlJywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ0dVSUxEX1JPTEVfVVBEQVRFJzpcclxuICAgICAgICB0aGlzLmVtaXQoJ3JvbGVVcGRhdGUnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnR1VJTERfUk9MRV9ERUxFVEUnOlxyXG4gICAgICAgIHRoaXMuZW1pdCgncm9sZURlbGV0ZScsIGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdHVUlMRF9CQU5fQUREJzpcclxuICAgICAgICB0aGlzLmVtaXQoJ2d1aWxkQmFuQWRkJywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ0dVSUxEX0JBTl9SRU1PVkUnOlxyXG4gICAgICAgIHRoaXMuZW1pdCgnZ3VpbGRCYW5SZW1vdmUnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnSU5WSVRFX0NSRUFURSc6XHJcbiAgICAgICAgdGhpcy5lbWl0KCdpbnZpdGVDcmVhdGUnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnSU5WSVRFX0RFTEVURSc6XHJcbiAgICAgICAgdGhpcy5lbWl0KCdpbnZpdGVEZWxldGUnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnVFlQSU5HX1NUQVJUJzpcclxuICAgICAgICB0aGlzLmVtaXQoJ3R5cGluZ1N0YXJ0JywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ1BSRVNFTkNFX1VQREFURSc6XHJcbiAgICAgICAgdGhpcy5lbWl0KCdwcmVzZW5jZVVwZGF0ZScsIGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdJTlRFUkFDVElPTl9DUkVBVEUnOlxyXG4gICAgICAgIHRoaXMuaGFuZGxlSW50ZXJhY3Rpb25DcmVhdGUoZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ1ZPSUNFX1NUQVRFX1VQREFURSc6XHJcbiAgICAgICAgdGhpcy5oYW5kbGVWb2ljZVN0YXRlVXBkYXRlKGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdWT0lDRV9TRVJWRVJfVVBEQVRFJzpcclxuICAgICAgICB0aGlzLmhhbmRsZVZvaWNlU2VydmVyVXBkYXRlKGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBkZWZhdWx0OlxyXG4gICAgICAgIC8vIEVtaXQgcmF3IGV2ZW50IGZvciB1bmhhbmRsZWQgdHlwZXNcclxuICAgICAgICB0aGlzLmVtaXQoJ3JhdycsIHsgdDogZXZlbnRUeXBlLCBkOiBkYXRhIH0pO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSGFuZGxlIFJlYWR5IGV2ZW50XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBoYW5kbGVSZWFkeShkYXRhOiBSZWFkeUV2ZW50RGF0YSk6IHZvaWQge1xyXG4gICAgdGhpcy5zZXNzaW9uSWQgPSBkYXRhLnNlc3Npb25faWQ7XHJcbiAgICB0aGlzLnVzZXIgPSBuZXcgVXNlcihkYXRhLnVzZXIpO1xyXG4gICAgLy8gSGFuZGxlIGJvdGggc3RyaW5nIGFuZCBudW1iZXIgYXBwbGljYXRpb24gSURzXHJcbiAgICB0aGlzLmFwcGxpY2F0aW9uSWQgPSBkYXRhLmFwcGxpY2F0aW9uPy5pZCA/IFN0cmluZyhkYXRhLmFwcGxpY2F0aW9uLmlkKSA6IG51bGw7XHJcbiAgICBpZiAodGhpcy5hcHBsaWNhdGlvbklkKSB7XHJcbiAgICAgIHRoaXMucmVzdC5zZXRBcHBsaWNhdGlvbklkKHRoaXMuYXBwbGljYXRpb25JZCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIEluaXRpYWxpemUgYXBwbGljYXRpb24gb2JqZWN0IHdpdGggY29tbWFuZHMgbWFuYWdlclxyXG4gICAgdGhpcy5hcHBsaWNhdGlvbiA9IHtcclxuICAgICAgaWQ6IHRoaXMuYXBwbGljYXRpb25JZCxcclxuICAgICAgY29tbWFuZHM6IG5ldyBBcHBsaWNhdGlvbkNvbW1hbmRNYW5hZ2VyKHRoaXMucmVzdCksXHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICAvLyBDYWNoZSBndWlsZHMgKGFzIHVuYXZhaWxhYmxlIGluaXRpYWxseSlcclxuICAgIGlmIChkYXRhLmd1aWxkcykge1xyXG4gICAgICBmb3IgKGNvbnN0IGd1aWxkIG9mIGRhdGEuZ3VpbGRzKSB7XHJcbiAgICAgICAgdGhpcy5ndWlsZHMuc2V0KFN0cmluZyhndWlsZC5pZCksIG5ldyBHdWlsZCh0aGlzLCBndWlsZCkpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIFNldHVwIHZvaWNlIGFkYXB0ZXJzIGZvciBlYWNoIGd1aWxkXHJcbiAgICB0aGlzLnNldHVwVm9pY2VBZGFwdGVycygpO1xyXG4gICAgXHJcbiAgICBjb25zb2xlLmxvZyhg4pyFIEJvdCBoYXrEsXIhIFVzZXI6ICR7dGhpcy51c2VyLnVzZXJuYW1lfSAoJHt0aGlzLnVzZXIuaWR9KSwgQXBwOiAke3RoaXMuYXBwbGljYXRpb25JZH1gKTtcclxuICAgIHRoaXMuZW1pdCgncmVhZHknLCB0aGlzKTtcclxuXHJcbiAgICAvLyBTaWduYWwgc2hhcmQgbWFuYWdlciB0aGF0IHRoaXMgc2hhcmQgaXMgcmVhZHkgKGlmIHJ1bm5pbmcgYXMgYSBzaGFyZClcclxuICAgIGlmIChwcm9jZXNzLnNlbmQpIHtcclxuICAgICAgcHJvY2Vzcy5zZW5kKHsgX3JlYWR5OiB0cnVlIH0pO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2V0dXAgdm9pY2UgYWRhcHRlcnMgZm9yIGFsbCBndWlsZHNcclxuICAgKi9cclxuICBwcml2YXRlIHNldHVwVm9pY2VBZGFwdGVycygpOiB2b2lkIHtcclxuICAgIGZvciAoY29uc3QgW2d1aWxkSWRdIG9mIHRoaXMuZ3VpbGRzKSB7XHJcbiAgICAgIHRoaXMuY3JlYXRlVm9pY2VBZGFwdGVyKGd1aWxkSWQpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgdm9pY2UgYWRhcHRlciBmb3IgYSBndWlsZFxyXG4gICAqL1xyXG4gIHByaXZhdGUgY3JlYXRlVm9pY2VBZGFwdGVyKGd1aWxkSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgYWRhcHRlcjogVm9pY2VBZGFwdGVyQ3JlYXRvciA9IChtZXRob2RzKSA9PiB7XHJcbiAgICAgIC8vIFN0b3JlIGhhbmRsZXJzIGZvciB0aGlzIGd1aWxkXHJcbiAgICAgIHRoaXMudm9pY2VTdGF0ZUhhbmRsZXJzLnNldChndWlsZElkLCBtZXRob2RzLm9uVm9pY2VTdGF0ZVVwZGF0ZSk7XHJcbiAgICAgIHRoaXMudm9pY2VTZXJ2ZXJIYW5kbGVycy5zZXQoZ3VpbGRJZCwgbWV0aG9kcy5vblZvaWNlU2VydmVyVXBkYXRlKTtcclxuICAgICAgXHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAgc2VuZFBheWxvYWQ6IChwYXlsb2FkKSA9PiB7XHJcbiAgICAgICAgICBpZiAodGhpcy53cz8ucmVhZHlTdGF0ZSA9PT0gV2ViU29ja2V0Lk9QRU4pIHtcclxuICAgICAgICAgICAgdGhpcy53cy5zZW5kKEpTT04uc3RyaW5naWZ5KHBheWxvYWQpKTtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBkZXN0cm95OiAoKSA9PiB7XHJcbiAgICAgICAgICB0aGlzLnZvaWNlU3RhdGVIYW5kbGVycy5kZWxldGUoZ3VpbGRJZCk7XHJcbiAgICAgICAgICB0aGlzLnZvaWNlU2VydmVySGFuZGxlcnMuZGVsZXRlKGd1aWxkSWQpO1xyXG4gICAgICAgIH1cclxuICAgICAgfTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMudm9pY2UuYWRhcHRlcnMuc2V0KGd1aWxkSWQsIGFkYXB0ZXIpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSGFuZGxlIEd1aWxkIENyZWF0ZSBldmVudFxyXG4gICAqL1xyXG4gIHByaXZhdGUgaGFuZGxlR3VpbGRDcmVhdGUoZGF0YTogQVBJR3VpbGQpOiB2b2lkIHtcclxuICAgIGxldCBndWlsZCA9IHRoaXMuZ3VpbGRzLmdldChkYXRhLmlkKTtcclxuICAgIFxyXG4gICAgaWYgKGd1aWxkKSB7XHJcbiAgICAgIGd1aWxkLl9wYXRjaChkYXRhKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGd1aWxkID0gbmV3IEd1aWxkKHRoaXMsIGRhdGEpO1xyXG4gICAgICB0aGlzLmd1aWxkcy5zZXQoZGF0YS5pZCwgZ3VpbGQpO1xyXG4gICAgICB0aGlzLmNyZWF0ZVZvaWNlQWRhcHRlcihkYXRhLmlkKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgdGhpcy5lbWl0KCdndWlsZENyZWF0ZScsIGd1aWxkKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZSBHdWlsZCBVcGRhdGUgZXZlbnRcclxuICAgKi9cclxuICBwcml2YXRlIGhhbmRsZUd1aWxkVXBkYXRlKGRhdGE6IEFQSUd1aWxkKTogdm9pZCB7XHJcbiAgICBjb25zdCBndWlsZCA9IHRoaXMuZ3VpbGRzLmdldChkYXRhLmlkKTtcclxuICAgIGlmIChndWlsZCkge1xyXG4gICAgICBndWlsZC5fcGF0Y2goZGF0YSk7XHJcbiAgICAgIHRoaXMuZW1pdCgnZ3VpbGRVcGRhdGUnLCBndWlsZCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBIYW5kbGUgR3VpbGQgRGVsZXRlIGV2ZW50XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBoYW5kbGVHdWlsZERlbGV0ZShkYXRhOiB7IGlkOiBzdHJpbmcgfSk6IHZvaWQge1xyXG4gICAgY29uc3QgZ3VpbGQgPSB0aGlzLmd1aWxkcy5nZXQoZGF0YS5pZCk7XHJcbiAgICBpZiAoZ3VpbGQpIHtcclxuICAgICAgdGhpcy5ndWlsZHMuZGVsZXRlKGRhdGEuaWQpO1xyXG4gICAgICB0aGlzLnZvaWNlLmFkYXB0ZXJzLmRlbGV0ZShkYXRhLmlkKTtcclxuICAgICAgdGhpcy5lbWl0KCdndWlsZERlbGV0ZScsIGd1aWxkKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZSBNZXNzYWdlIENyZWF0ZSBldmVudFxyXG4gICAqL1xyXG4gIHByaXZhdGUgaGFuZGxlTWVzc2FnZUNyZWF0ZShkYXRhOiBBUElNZXNzYWdlKTogdm9pZCB7XHJcbiAgICAvLyBCYWNrZW5kIHNlbmRzIHVzZXJfaWQgc2VwYXJhdGVseSwgbWFwIGl0IHRvIGF1dGhvci5pZCBmb3IgY29tcGF0aWJpbGl0eVxyXG4gICAgaWYgKGRhdGEudXNlcl9pZCAmJiBkYXRhLmF1dGhvciAmJiAhZGF0YS5hdXRob3IuaWQpIHtcclxuICAgICAgKGRhdGEuYXV0aG9yIGFzIGFueSkuaWQgPSBkYXRhLnVzZXJfaWQ7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIENhY2hlIHRoZSBhdXRob3JcclxuICAgIGlmIChkYXRhLmF1dGhvcikge1xyXG4gICAgICBjb25zdCB1c2VyID0gbmV3IFVzZXIoZGF0YS5hdXRob3IpO1xyXG4gICAgICB0aGlzLnVzZXJzLnNldCh1c2VyLmlkLCB1c2VyKTtcclxuICAgICAgLy8gQWxzbyBjYWNoZSBpbiBSRVNUIGZvciBtZW50aW9uIHJlc29sdXRpb25cclxuICAgICAgdGhpcy5yZXN0LmNhY2hlVXNlcihkYXRhLmF1dGhvcik7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGNvbnN0IG1lc3NhZ2UgPSBuZXcgTWVzc2FnZSh0aGlzLCBkYXRhKTtcclxuXHJcbiAgICAvLyBNYXJrIG1lc3NhZ2UgYXMgZnJvbSBib3QgaWYgYXV0aG9yIElEIG1hdGNoZXMgdGhlIGJvdCdzIG93biB1c2VyIElEXHJcbiAgICBpZiAodGhpcy51c2VyICYmIFN0cmluZyhtZXNzYWdlLmF1dGhvci5pZCkgPT09IFN0cmluZyh0aGlzLnVzZXIuaWQpKSB7XHJcbiAgICAgIChtZXNzYWdlLmF1dGhvciBhcyBhbnkpLmJvdCA9IHRydWU7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gUmVzb2x2ZSBndWlsZCBtZW1iZXIgaWYgaW4gYSBndWlsZFxyXG4gICAgaWYgKG1lc3NhZ2UuZ3VpbGRJZCkge1xyXG4gICAgICBjb25zdCBndWlsZCA9IHRoaXMuZ3VpbGRzLmdldChtZXNzYWdlLmd1aWxkSWQpO1xyXG4gICAgICBjb25zdCBtZW1iZXJEYXRhID0gKGRhdGEgYXMgYW55KS5tZW1iZXI7XHJcbiAgICAgIGlmIChtZW1iZXJEYXRhICYmIGd1aWxkKSB7XHJcbiAgICAgICAgLy8gR2F0ZXdheSBzZW50IG1lbWJlciBkYXRhIHdpdGggdGhlIG1lc3NhZ2Ug4oCUIGNhY2hlIGl0XHJcbiAgICAgICAgLy8gX2FkZE1lbWJlciBwcmVzZXJ2ZXMgdm9pY2Ugc3RhdGUgZnJvbSBleGlzdGluZyBjYWNoZSBhdXRvbWF0aWNhbGx5XHJcbiAgICAgICAgbWVtYmVyRGF0YS51c2VyID0gZGF0YS5hdXRob3I7XHJcbiAgICAgICAgY29uc3QgbWVtYmVyID0gZ3VpbGQuX2FkZE1lbWJlcihtZW1iZXJEYXRhKTtcclxuICAgICAgICBtZXNzYWdlLm1lbWJlciA9IG1lbWJlcjtcclxuICAgICAgfSBlbHNlIGlmIChtZW1iZXJEYXRhKSB7XHJcbiAgICAgICAgLy8gTm8gZ3VpbGQgaW4gY2FjaGUgYnV0IG1lbWJlciBkYXRhIGV4aXN0c1xyXG4gICAgICAgIG1lbWJlckRhdGEudXNlciA9IGRhdGEuYXV0aG9yO1xyXG4gICAgICAgIGNvbnN0IHJlc29sdmVkR3VpbGQgPSB7IGlkOiBtZXNzYWdlLmd1aWxkSWQsIG93bmVySWQ6IG51bGwsIG1lbWJlcnM6IG5ldyBDb2xsZWN0aW9uKCksIGNoYW5uZWxzOiBuZXcgQ29sbGVjdGlvbigpIH0gYXMgYW55O1xyXG4gICAgICAgIG1lc3NhZ2UubWVtYmVyID0gbmV3IChyZXF1aXJlKCcuL3N0cnVjdHVyZXMvR3VpbGRNZW1iZXInKS5HdWlsZE1lbWJlcikodGhpcywgcmVzb2x2ZWRHdWlsZCwgbWVtYmVyRGF0YSk7XHJcbiAgICAgIH0gZWxzZSBpZiAoZ3VpbGQpIHtcclxuICAgICAgICAvLyBObyBtZW1iZXIgZGF0YSBmcm9tIGdhdGV3YXkg4oCUIHVzZSBjYWNoZWQgbWVtYmVyIChtYXkgaGF2ZSB2b2ljZSBzdGF0ZSBmcm9tIFZPSUNFX1NUQVRFX1VQREFURSlcclxuICAgICAgICBjb25zdCBjYWNoZWQgPSBndWlsZC5tZW1iZXJzPy5nZXQoU3RyaW5nKG1lc3NhZ2UuYXV0aG9yLmlkKSk7XHJcbiAgICAgICAgaWYgKGNhY2hlZCkge1xyXG4gICAgICAgICAgbWVzc2FnZS5tZW1iZXIgPSBjYWNoZWQ7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5lbWl0KCdtZXNzYWdlQ3JlYXRlJywgbWVzc2FnZSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBIYW5kbGUgSW50ZXJhY3Rpb24gQ3JlYXRlIGV2ZW50XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBoYW5kbGVJbnRlcmFjdGlvbkNyZWF0ZShkYXRhOiBBUElJbnRlcmFjdGlvbik6IHZvaWQge1xyXG4gICAgY29uc29sZS5sb2coJ1tERUJVR10gaGFuZGxlSW50ZXJhY3Rpb25DcmVhdGUgY2FsbGVkIHdpdGg6JywgSlNPTi5zdHJpbmdpZnkoZGF0YSwgbnVsbCwgMikpO1xyXG4gICAgXHJcbiAgICAvLyBDYWNoZSB0aGUgdXNlclxyXG4gICAgY29uc3QgdXNlckRhdGEgPSBkYXRhLm1lbWJlcj8udXNlciB8fCBkYXRhLnVzZXI7XHJcbiAgICBpZiAodXNlckRhdGEpIHtcclxuICAgICAgY29uc3QgdXNlciA9IG5ldyBVc2VyKHVzZXJEYXRhKTtcclxuICAgICAgdGhpcy51c2Vycy5zZXQodXNlci5pZCwgdXNlcik7XHJcbiAgICAgIHRoaXMucmVzdC5jYWNoZVVzZXIodXNlckRhdGEpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBjb25zdCBpbnRlcmFjdGlvbiA9IGNyZWF0ZUludGVyYWN0aW9uKHRoaXMsIGRhdGEpO1xyXG4gICAgY29uc29sZS5sb2coJ1tERUJVR10gQ3JlYXRlZCBpbnRlcmFjdGlvbiB0eXBlOicsIGludGVyYWN0aW9uLmNvbnN0cnVjdG9yLm5hbWUsICdjdXN0b21JZDonLCAoaW50ZXJhY3Rpb24gYXMgYW55KS5jdXN0b21JZCk7XHJcbiAgICB0aGlzLmVtaXQoJ2ludGVyYWN0aW9uQ3JlYXRlJywgaW50ZXJhY3Rpb24pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSGFuZGxlIFZvaWNlIFN0YXRlIFVwZGF0ZSBldmVudFxyXG4gICAqL1xyXG4gIHByaXZhdGUgaGFuZGxlVm9pY2VTdGF0ZVVwZGF0ZShkYXRhOiBhbnkpOiB2b2lkIHtcclxuICAgIGNvbnN0IGd1aWxkSWQgPSBkYXRhLmd1aWxkX2lkO1xyXG4gICAgY29uc3QgdXNlcklkID0gZGF0YS51c2VyX2lkO1xyXG4gICAgXHJcbiAgICAvLyBVcGRhdGUgbWVtYmVyIHZvaWNlIHN0YXRlIGluIGNhY2hlXHJcbiAgICBpZiAoZ3VpbGRJZCAmJiB1c2VySWQpIHtcclxuICAgICAgY29uc3QgZ3VpbGQgPSB0aGlzLmd1aWxkcy5nZXQoU3RyaW5nKGd1aWxkSWQpKTtcclxuICAgICAgaWYgKGd1aWxkKSB7XHJcbiAgICAgICAgY29uc3QgdXNlcklkU3RyID0gU3RyaW5nKHVzZXJJZCk7XHJcbiAgICAgICAgbGV0IG1lbWJlciA9IGd1aWxkLm1lbWJlcnMuZ2V0KHVzZXJJZFN0cik7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKCFtZW1iZXIgJiYgZGF0YS51c2VyKSB7XHJcbiAgICAgICAgICAvLyBNZW1iZXIgbm90IGluIGNhY2hlIHlldCDigJQgY3JlYXRlIGEgbWluaW1hbCBlbnRyeSBmcm9tIHZvaWNlIHN0YXRlIGRhdGFcclxuICAgICAgICAgIG1lbWJlciA9IGd1aWxkLl9hZGRNZW1iZXIoe1xyXG4gICAgICAgICAgICB1c2VyOiBkYXRhLnVzZXIsXHJcbiAgICAgICAgICAgIHJvbGVzOiBbXSxcclxuICAgICAgICAgICAgam9pbmVkX2F0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKG1lbWJlcikge1xyXG4gICAgICAgICAgbWVtYmVyLnZvaWNlID0ge1xyXG4gICAgICAgICAgICBjaGFubmVsSWQ6IGRhdGEuY2hhbm5lbF9pZCA/PyB1bmRlZmluZWQsXHJcbiAgICAgICAgICAgIHNlbGZNdXRlOiBkYXRhLnNlbGZfbXV0ZSA/PyBmYWxzZSxcclxuICAgICAgICAgICAgc2VsZkRlYWY6IGRhdGEuc2VsZl9kZWFmID8/IGZhbHNlLFxyXG4gICAgICAgICAgfTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgLy8gRm9yd2FyZCB0byB2b2ljZSBhZGFwdGVyIGlmIGV4aXN0c1xyXG4gICAgY29uc3QgaGFuZGxlciA9IHRoaXMudm9pY2VTdGF0ZUhhbmRsZXJzLmdldChndWlsZElkKTtcclxuICAgIGlmIChoYW5kbGVyKSB7XHJcbiAgICAgIGhhbmRsZXIoZGF0YSk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHRoaXMuZW1pdCgndm9pY2VTdGF0ZVVwZGF0ZScsIGRhdGEpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSGFuZGxlIFZvaWNlIFNlcnZlciBVcGRhdGUgZXZlbnRcclxuICAgKi9cclxuICBwcml2YXRlIGhhbmRsZVZvaWNlU2VydmVyVXBkYXRlKGRhdGE6IEFQSVZvaWNlU2VydmVyVXBkYXRlKTogdm9pZCB7XHJcbiAgICBjb25zdCBndWlsZElkID0gZGF0YS5ndWlsZF9pZDtcclxuICAgIFxyXG4gICAgLy8gRm9yd2FyZCB0byB2b2ljZSBhZGFwdGVyIGlmIGV4aXN0c1xyXG4gICAgY29uc3QgaGFuZGxlciA9IHRoaXMudm9pY2VTZXJ2ZXJIYW5kbGVycy5nZXQoZ3VpbGRJZCk7XHJcbiAgICBpZiAoaGFuZGxlcikge1xyXG4gICAgICBoYW5kbGVyKHtcclxuICAgICAgICB0b2tlbjogZGF0YS50b2tlbixcclxuICAgICAgICBlbmRwb2ludDogZGF0YS5lbmRwb2ludCxcclxuICAgICAgICByb29tOiBkYXRhLnJvb21cclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHRoaXMuZW1pdCgndm9pY2VTZXJ2ZXJVcGRhdGUnLCBkYXRhKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNlbmQgSWRlbnRpZnkgcGF5bG9hZFxyXG4gICAqL1xyXG4gIHByaXZhdGUgaWRlbnRpZnkoKTogdm9pZCB7XHJcbiAgICBjb25zdCBwYXlsb2FkOiBHYXRld2F5UGF5bG9hZCA9IHtcclxuICAgICAgb3A6IEdhdGV3YXlPcGNvZGVzLklkZW50aWZ5LFxyXG4gICAgICBkOiB7XHJcbiAgICAgICAgdG9rZW46IGBCb3QgJHt0aGlzLnRva2VufWAsXHJcbiAgICAgICAgaW50ZW50czogdGhpcy5nZXRJbnRlbnRzVmFsdWUoKSxcclxuICAgICAgICBzaGFyZDogdGhpcy5vcHRpb25zLnNoYXJkcyB8fCBbMCwgMV1cclxuICAgICAgfVxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5zZW5kKHBheWxvYWQpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU3RhcnQgaGVhcnRiZWF0XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBzdGFydEhlYXJ0YmVhdChpbnRlcnZhbDogbnVtYmVyKTogdm9pZCB7XHJcbiAgICB0aGlzLmhlYXJ0YmVhdEludGVydmFsID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xyXG4gICAgICB0aGlzLl9sYXN0SGVhcnRiZWF0U2VudCA9IERhdGUubm93KCk7XHJcbiAgICAgIHRoaXMuc2VuZCh7XHJcbiAgICAgICAgb3A6IEdhdGV3YXlPcGNvZGVzLkhlYXJ0YmVhdCxcclxuICAgICAgICBkOiB0aGlzLnNlcXVlbmNlXHJcbiAgICAgIH0pO1xyXG4gICAgfSwgaW50ZXJ2YWwpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2VuZCBwYXlsb2FkIHRvIGdhdGV3YXlcclxuICAgKi9cclxuICBwcml2YXRlIHNlbmQocGF5bG9hZDogR2F0ZXdheVBheWxvYWQpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLndzPy5yZWFkeVN0YXRlID09PSBXZWJTb2NrZXQuT1BFTikge1xyXG4gICAgICB0aGlzLndzLnNlbmQoSlNPTi5zdHJpbmdpZnkocGF5bG9hZCkpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2xlYW51cCBvbiBkaXNjb25uZWN0XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBjbGVhbnVwKCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMuaGVhcnRiZWF0SW50ZXJ2YWwpIHtcclxuICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLmhlYXJ0YmVhdEludGVydmFsKTtcclxuICAgICAgdGhpcy5oZWFydGJlYXRJbnRlcnZhbCA9IG51bGw7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZXN0cm95IHRoZSBjbGllbnRcclxuICAgKi9cclxuICBkZXN0cm95KCk6IHZvaWQge1xyXG4gICAgdGhpcy5fbG9naW5TdGF0ZSA9ICdpZGxlJztcclxuICAgIHRoaXMuX3JlY29ubmVjdEF0dGVtcHRzID0gdGhpcy5fbWF4UmVjb25uZWN0QXR0ZW1wdHMgKyAxOyAvLyBQcmV2ZW50IHJlY29ubmVjdFxyXG4gICAgdGhpcy5jbGVhbnVwKCk7XHJcbiAgICB0aGlzLndzPy5jbG9zZSgxMDAwKTtcclxuICAgIHRoaXMud3MgPSBudWxsO1xyXG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoKTtcclxuICB9XHJcbn1cclxuXHJcbi8vIFJlLWV4cG9ydCBmb3IgY29udmVuaWVuY2VcclxuZXhwb3J0IHsgR2F0ZXdheUludGVudEJpdHMgfTtcclxuIl19