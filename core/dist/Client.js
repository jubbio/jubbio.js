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
const Collection_1 = require("./utils/Collection");
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
    voiceDestroyHandlers = new Map();
    /** Whether the client is currently in the login flow */
    _loginState = 'idle';
    /** Reconnect attempt counter */
    _reconnectAttempts = 0;
    /** Maximum reconnect attempts before giving up */
    _maxReconnectAttempts = 5;
    /** Cached intents value */
    _intentsValue;
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
        // Cache the intents value for checkIntent() lookups
        if (this._intentsValue !== undefined) {
            return this._intentsValue;
        }
        if (typeof this.options.intents === 'number') {
            this._intentsValue = this.options.intents;
        }
        else {
            this._intentsValue = this.options.intents.reduce((acc, intent) => acc | intent, 0);
        }
        return this._intentsValue;
    }
    /**
     * Check if a specific intent is enabled. Emits a 'warn' event if the intent
     * is not enabled, allowing library consumers to catch misconfiguration early.
     *
     * @param intent - The GatewayIntentBits flag to check
     * @param feature - Human-readable description of the feature requiring this intent
     * @returns true if the intent is enabled, false otherwise
     */
    checkIntent(intent, feature) {
        const intents = this.getIntentsValue();
        const hasIntent = (intents & intent) === intent;
        if (!hasIntent) {
            this.emit('warn', `Missing intent for ${feature}. Enable GatewayIntentBits.${enums_1.GatewayIntentBits[intent]} to use this feature.`);
        }
        return hasIntent;
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
            case 'MESSAGE_REACTION_ADD':
                this.emit('messageReactionAdd', data);
                break;
            case 'MESSAGE_REACTION_REMOVE':
                this.emit('messageReactionRemove', data);
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
            case 'CHANNEL_PINS_UPDATE':
                this.emit('channelPinsUpdate', data);
                break;
            case 'TYPING_START':
                this.emit('typingStart', data);
                break;
            case 'PRESENCE_UPDATE': {
                // update guild onlineCount based on status change
                const guildId = data.guild_id;
                const status = data.status;
                if (guildId) {
                    const guild = this.guilds.get(String(guildId));
                    if (guild) {
                        if (status === 'offline') {
                            guild.onlineCount = Math.max(0, guild.onlineCount - 1);
                        }
                        else if (status === 'online' || status === 'idle' || status === 'dnd') {
                            guild.onlineCount++;
                        }
                    }
                }
                this.emit('presenceUpdate', data);
                break;
            }
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
        this.emit('debug', `Bot ready! User: ${this.user.username} (${this.user.id}), App: ${this.applicationId}`);
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
        if (this.voice.adapters.has(guildId))
            return;
        const adapter = (methods) => {
            // A guild has one active connection per client.
            this.voiceDestroyHandlers.get(guildId)?.();
            this.voiceDestroyHandlers.set(guildId, methods.destroy);
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
                    if (this.voiceDestroyHandlers.get(guildId) !== methods.destroy)
                        return;
                    this.voiceDestroyHandlers.delete(guildId);
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
            this.voiceDestroyHandlers.get(data.id)?.();
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
        if (process.env.DEBUG_CLIENT) {
            console.log('[DEBUG] handleInteractionCreate called with:', JSON.stringify(data, null, 2));
        }
        try {
            // Cache the user
            const userData = data.member?.user || data.user;
            if (userData) {
                const user = new User_1.User(userData);
                this.users.set(user.id, user);
                this.rest.cacheUser(userData);
            }
            const interaction = (0, Interaction_1.createInteraction)(this, data);
            if (process.env.DEBUG_CLIENT) {
                console.log('[DEBUG] Created interaction type:', interaction.constructor.name, 'customId:', interaction.customId);
            }
            this.emit('interactionCreate', interaction);
        }
        catch (err) {
            console.error('[ERROR] handleInteractionCreate crashed:', err);
        }
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
        const handler = this.voiceStateHandlers.get(String(guildId));
        if (handler && this.user && String(userId) === String(this.user.id)) {
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
        const handler = this.voiceServerHandlers.get(String(guildId));
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
        for (const destroy of [...this.voiceDestroyHandlers.values()])
            destroy();
        this.voiceDestroyHandlers.clear();
        this.voiceStateHandlers.clear();
        this.voiceServerHandlers.clear();
        this.voice.adapters.clear();
        this._loginState = 'idle';
        this._reconnectAttempts = this._maxReconnectAttempts + 1; // Prevent reconnect
        this.cleanup();
        this.ws?.close(1000);
        this.ws = null;
        this.removeAllListeners();
    }
}
exports.Client = Client;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ2xpZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL0NsaWVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxtQ0FBc0M7QUFDdEMsNENBQTJCO0FBWTNCLG1DQUE0RDtBQXMzQm5ELGtHQXQzQmdCLHlCQUFpQixPQXMzQmhCO0FBcjNCMUIsbURBQWdEO0FBQ2hELDRDQUF5QztBQUN6Qyw4Q0FBMkM7QUFDM0Msa0RBQStDO0FBQy9DLDBEQUEwRTtBQUUxRSxzQ0FBbUM7QUFDbkMsb0ZBQWlGO0FBY2pGOztHQUVHO0FBQ0gsTUFBYSxNQUFPLFNBQVEscUJBQVk7SUFDdEMscUJBQXFCO0lBQ0wsT0FBTyxDQUFnQjtJQUV2QyxzQkFBc0I7SUFDTixJQUFJLENBQU87SUFFM0IsbUJBQW1CO0lBQ1osSUFBSSxHQUFnQixJQUFJLENBQUM7SUFFaEMscUJBQXFCO0lBQ2QsYUFBYSxHQUFrQixJQUFJLENBQUM7SUFFM0MsdUVBQXVFO0lBQ2hFLFdBQVcsR0FHUCxJQUFJLENBQUM7SUFFaEIsb0JBQW9CO0lBQ2IsTUFBTSxHQUE4QixJQUFJLHVCQUFVLEVBQUUsQ0FBQztJQUU1RCxzQkFBc0I7SUFDZixRQUFRLEdBQW9DLElBQUksdUJBQVUsRUFBRSxDQUFDO0lBRXBFLG1CQUFtQjtJQUNaLEtBQUssR0FBNkIsSUFBSSx1QkFBVSxFQUFFLENBQUM7SUFFMUQsK0JBQStCO0lBQ3hCLEtBQUssQ0FFVjtJQUVGLDJCQUEyQjtJQUNuQixFQUFFLEdBQXFCLElBQUksQ0FBQztJQUVwQyxnQkFBZ0I7SUFDUixLQUFLLEdBQVcsRUFBRSxDQUFDO0lBRTNCLGlCQUFpQjtJQUNULFNBQVMsR0FBa0IsSUFBSSxDQUFDO0lBRXhDLHNCQUFzQjtJQUNkLFFBQVEsR0FBa0IsSUFBSSxDQUFDO0lBRXZDLHlCQUF5QjtJQUNqQixpQkFBaUIsR0FBMEIsSUFBSSxDQUFDO0lBRXhELGtCQUFrQjtJQUNWLFVBQVUsQ0FBUztJQUUzQiwyREFBMkQ7SUFDbkQsa0JBQWtCLEdBQVcsQ0FBQyxDQUFDO0lBRXZDLGdEQUFnRDtJQUN6QyxJQUFJLEdBQVcsQ0FBQyxDQUFDLENBQUM7SUFFekIsdURBQXVEO0lBQy9DLGtCQUFrQixHQUFxQyxJQUFJLEdBQUcsRUFBRSxDQUFDO0lBQ2pFLG1CQUFtQixHQUFxQyxJQUFJLEdBQUcsRUFBRSxDQUFDO0lBQ2xFLG9CQUFvQixHQUE0QixJQUFJLEdBQUcsRUFBRSxDQUFDO0lBRWxFLHdEQUF3RDtJQUNoRCxXQUFXLEdBQW9DLE1BQU0sQ0FBQztJQUU5RCxnQ0FBZ0M7SUFDeEIsa0JBQWtCLEdBQVcsQ0FBQyxDQUFDO0lBRXZDLGtEQUFrRDtJQUNqQyxxQkFBcUIsR0FBVyxDQUFDLENBQUM7SUFFbkQsMkJBQTJCO0lBQ25CLGFBQWEsQ0FBVTtJQUUvQixZQUFZLE9BQXNCO1FBQ2hDLEtBQUssRUFBRSxDQUFDO1FBQ1IsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7UUFDdkIsSUFBSSxDQUFDLFVBQVUsR0FBRyxPQUFPLENBQUMsVUFBVSxJQUFJLGtDQUFrQyxDQUFDO1FBQzNFLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxXQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBRXJDLGtDQUFrQztRQUNsQyxJQUFJLENBQUMsS0FBSyxHQUFHO1lBQ1gsUUFBUSxFQUFFLElBQUksR0FBRyxFQUFFO1NBQ3BCLENBQUM7SUFDSixDQUFDO0lBRUQ7O09BRUc7SUFDSyxlQUFlO1FBQ3JCLG9EQUFvRDtRQUNwRCxJQUFJLElBQUksQ0FBQyxhQUFhLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDckMsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDO1FBQzVCLENBQUM7UUFDRCxJQUFJLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEtBQUssUUFBUSxFQUFFLENBQUM7WUFDN0MsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQztRQUM1QyxDQUFDO2FBQU0sQ0FBQztZQUNOLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxFQUFFLE1BQU0sRUFBRSxFQUFFLENBQUMsR0FBRyxHQUFHLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztRQUNyRixDQUFDO1FBQ0QsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDO0lBQzVCLENBQUM7SUFFRDs7Ozs7OztPQU9HO0lBQ0ssV0FBVyxDQUFDLE1BQXlCLEVBQUUsT0FBZTtRQUM1RCxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7UUFDdkMsTUFBTSxTQUFTLEdBQUcsQ0FBQyxPQUFPLEdBQUcsTUFBTSxDQUFDLEtBQUssTUFBTSxDQUFDO1FBQ2hELElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUNmLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLHNCQUFzQixPQUFPLDhCQUE4Qix5QkFBaUIsQ0FBQyxNQUFNLENBQUMsdUJBQXVCLENBQUMsQ0FBQztRQUNqSSxDQUFDO1FBQ0QsT0FBTyxTQUFTLENBQUM7SUFDbkIsQ0FBQztJQUVEOztPQUVHO0lBQ0ssTUFBTSxDQUFVLFdBQVcsR0FBZ0U7UUFDakcsSUFBSSxFQUFFLEVBQUUsT0FBTyxFQUFFLGlDQUFpQyxFQUFFLGFBQWEsRUFBRSxJQUFJLEVBQUU7UUFDekUsSUFBSSxFQUFFLEVBQUUsT0FBTyxFQUFFLCtDQUErQyxFQUFFLGFBQWEsRUFBRSxJQUFJLEVBQUU7UUFDdkYsSUFBSSxFQUFFLEVBQUUsT0FBTyxFQUFFLDRDQUE0QyxFQUFFLGFBQWEsRUFBRSxJQUFJLEVBQUU7UUFDcEYsSUFBSSxFQUFFLEVBQUUsT0FBTyxFQUFFLHdEQUF3RCxFQUFFLGFBQWEsRUFBRSxJQUFJLEVBQUU7UUFDaEcsSUFBSSxFQUFFLEVBQUUsT0FBTyxFQUFFLCtDQUErQyxFQUFFLGFBQWEsRUFBRSxLQUFLLEVBQUU7UUFDeEYsSUFBSSxFQUFFLEVBQUUsT0FBTyxFQUFFLDJEQUEyRCxFQUFFLGFBQWEsRUFBRSxJQUFJLEVBQUU7UUFDbkcsSUFBSSxFQUFFLEVBQUUsT0FBTyxFQUFFLDBDQUEwQyxFQUFFLGFBQWEsRUFBRSxJQUFJLEVBQUU7UUFDbEYsSUFBSSxFQUFFLEVBQUUsT0FBTyxFQUFFLGtDQUFrQyxFQUFFLGFBQWEsRUFBRSxJQUFJLEVBQUU7UUFDMUUsSUFBSSxFQUFFLEVBQUUsT0FBTyxFQUFFLGlEQUFpRCxFQUFFLGFBQWEsRUFBRSxJQUFJLEVBQUU7UUFDekYsSUFBSSxFQUFFLEVBQUUsT0FBTyxFQUFFLCtDQUErQyxFQUFFLGFBQWEsRUFBRSxLQUFLLEVBQUU7UUFDeEYsSUFBSSxFQUFFLEVBQUUsT0FBTyxFQUFFLHNDQUFzQyxFQUFFLGFBQWEsRUFBRSxLQUFLLEVBQUU7UUFDL0UsSUFBSSxFQUFFLEVBQUUsT0FBTyxFQUFFLDBEQUEwRCxFQUFFLGFBQWEsRUFBRSxLQUFLLEVBQUU7S0FDcEcsQ0FBQztJQUVGOztPQUVHO0lBQ0gsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFhO1FBQ3ZCLElBQUksQ0FBQyxLQUFLLElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxFQUFFLENBQUM7WUFDeEMsTUFBTSxJQUFJLEtBQUssQ0FDYixvRkFBb0YsQ0FDckYsQ0FBQztRQUNKLENBQUM7UUFFRCxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQzNDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUMvQixJQUFJLENBQUMsV0FBVyxHQUFHLFlBQVksQ0FBQztRQUNoQyxJQUFJLENBQUMsa0JBQWtCLEdBQUcsQ0FBQyxDQUFDO1FBRTVCLE9BQU8sSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUU7WUFDckMsTUFBTSxPQUFPLEdBQUcsR0FBRyxFQUFFO2dCQUNuQixZQUFZLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQ3RCLElBQUksQ0FBQyxjQUFjLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO2dCQUN0QyxJQUFJLENBQUMsY0FBYyxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsQ0FBQztnQkFDdEMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxjQUFjLEVBQUUsY0FBYyxDQUFDLENBQUM7WUFDdEQsQ0FBQyxDQUFDO1lBRUYsTUFBTSxPQUFPLEdBQUcsVUFBVSxDQUFDLEdBQUcsRUFBRTtnQkFDOUIsT0FBTyxFQUFFLENBQUM7Z0JBQ1YsSUFBSSxDQUFDLFdBQVcsR0FBRyxNQUFNLENBQUM7Z0JBQzFCLE1BQU0sQ0FBQyxJQUFJLEtBQUssQ0FDZCx1RUFBdUU7b0JBQ3ZFLDZFQUE2RSxDQUM5RSxDQUFDLENBQUM7WUFDTCxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFFVixNQUFNLE9BQU8sR0FBRyxHQUFHLEVBQUU7Z0JBQ25CLE9BQU8sRUFBRSxDQUFDO2dCQUNWLElBQUksQ0FBQyxXQUFXLEdBQUcsT0FBTyxDQUFDO2dCQUMzQixJQUFJLENBQUMsa0JBQWtCLEdBQUcsQ0FBQyxDQUFDO2dCQUM1QixPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ3RCLENBQUMsQ0FBQztZQUVGLE1BQU0sT0FBTyxHQUFHLENBQUMsS0FBWSxFQUFFLEVBQUU7Z0JBQy9CLE9BQU8sRUFBRSxDQUFDO2dCQUNWLElBQUksQ0FBQyxXQUFXLEdBQUcsTUFBTSxDQUFDO2dCQUMxQixNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDaEIsQ0FBQyxDQUFDO1lBRUYsTUFBTSxjQUFjLEdBQUcsQ0FBQyxJQUFZLEVBQUUsTUFBYyxFQUFFLEVBQUU7Z0JBQ3RELE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ3RDLElBQUksSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO29CQUNoQyxPQUFPLEVBQUUsQ0FBQztvQkFDVixJQUFJLENBQUMsV0FBVyxHQUFHLE1BQU0sQ0FBQztvQkFDMUIsTUFBTSxDQUFDLElBQUksS0FBSyxDQUFDLGtDQUFrQyxJQUFJLE1BQU0sSUFBSSxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDL0csQ0FBQztnQkFDRCx1RUFBdUU7WUFDekUsQ0FBQyxDQUFDO1lBRUYsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDNUIsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7WUFDNUIsSUFBSSxDQUFDLEVBQUUsQ0FBQyxjQUFjLEVBQUUsY0FBYyxDQUFDLENBQUM7WUFFeEMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ2pCLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOztPQUVHO0lBQ0ssT0FBTztRQUNiLElBQUksQ0FBQyxFQUFFLEdBQUcsSUFBSSxZQUFTLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBRXpDLElBQUksQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLE1BQU0sRUFBRSxHQUFHLEVBQUU7WUFDdEIsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsNkJBQTZCLENBQUMsQ0FBQztZQUNsRCxJQUFJLENBQUMsa0JBQWtCLEdBQUcsQ0FBQyxDQUFDO1FBQzlCLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsU0FBUyxFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUU7WUFDN0IsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztRQUN0QyxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsRUFBRTtZQUNuQyxNQUFNLFNBQVMsR0FBRyxNQUFNLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxDQUFDO1lBQzNDLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7WUFFdEMsSUFBSSxJQUFJLEVBQUUsQ0FBQztnQkFDVCxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSwrQkFBK0IsSUFBSSxNQUFNLElBQUksQ0FBQyxPQUFPLEdBQUcsU0FBUyxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsU0FBUyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQ25ILENBQUM7aUJBQU0sQ0FBQztnQkFDTixJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxzQkFBc0IsSUFBSSxNQUFNLFNBQVMsRUFBRSxDQUFDLENBQUM7WUFDbEUsQ0FBQztZQUVELElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUVmLGtFQUFrRTtZQUNsRSxJQUFJLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxJQUFJLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFFM0MsdUNBQXVDO1lBQ3ZDLElBQUksSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO2dCQUNoQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxPQUFPLElBQUksa0RBQWtELENBQUMsQ0FBQztnQkFDbEYsT0FBTztZQUNULENBQUM7WUFFRCw0QkFBNEI7WUFDNUIsSUFBSSxJQUFJLEtBQUssSUFBSSxFQUFFLENBQUM7Z0JBQ2xCLE9BQU87WUFDVCxDQUFDO1lBRUQsb0NBQW9DO1lBQ3BDLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1lBQzFCLElBQUksSUFBSSxDQUFDLGtCQUFrQixHQUFHLElBQUksQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO2dCQUN6RCxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSw4Q0FBOEMsSUFBSSxDQUFDLHFCQUFxQixHQUFHLENBQUMsQ0FBQztnQkFDaEcsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxLQUFLLENBQzFCLHNCQUFzQixJQUFJLENBQUMscUJBQXFCLGtEQUFrRCxJQUFJLEVBQUUsQ0FDekcsQ0FBQyxDQUFDO2dCQUNILE9BQU87WUFDVCxDQUFDO1lBRUQsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLGtCQUFrQixHQUFHLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQy9FLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLGdDQUFnQyxJQUFJLENBQUMsa0JBQWtCLElBQUksSUFBSSxDQUFDLHFCQUFxQixNQUFNLEtBQUssYUFBYSxDQUFDLENBQUM7WUFDbEksVUFBVSxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUMxQyxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDLEtBQUssRUFBRSxFQUFFO1lBQzVCLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLHFCQUFxQixLQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztZQUN6RCxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsQ0FBQztRQUM1QixDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRDs7T0FFRztJQUNLLGFBQWEsQ0FBQyxJQUFZO1FBQ2hDLHdDQUF3QztRQUN4QyxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBRXhELEtBQUssTUFBTSxHQUFHLElBQUksUUFBUSxFQUFFLENBQUM7WUFDM0IsSUFBSSxDQUFDO2dCQUNILE1BQU0sT0FBTyxHQUFtQixJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUNoRCxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQzlCLENBQUM7WUFBQyxPQUFPLENBQUMsRUFBRSxDQUFDO2dCQUNYLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLDRCQUE0QixHQUFHLEVBQUUsQ0FBQyxDQUFDO1lBQ3hELENBQUM7UUFDSCxDQUFDO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0ssYUFBYSxDQUFDLE9BQXVCO1FBQzNDLElBQUksT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDO1lBQ2QsSUFBSSxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDO1FBQzVCLENBQUM7UUFFRCxRQUFRLE9BQU8sQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUNuQixLQUFLLHNCQUFjLENBQUMsS0FBSztnQkFDdkIsSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzVCLE1BQU07WUFFUixLQUFLLHNCQUFjLENBQUMsUUFBUTtnQkFDMUIsSUFBSSxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUMsQ0FBRSxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDM0MsTUFBTTtZQUVSLEtBQUssc0JBQWMsQ0FBQyxZQUFZO2dCQUM5QixJQUFJLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxDQUFDLEVBQUUsQ0FBQztvQkFDaEMsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDO2dCQUNuRCxDQUFDO2dCQUNELElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLGlDQUFpQyxJQUFJLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQztnQkFDcEUsTUFBTTtZQUVSLEtBQUssc0JBQWMsQ0FBQyxjQUFjO2dCQUNoQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxpREFBaUQsQ0FBQyxDQUFDO2dCQUN0RSx1REFBdUQ7Z0JBQ3ZELElBQUksT0FBTyxDQUFDLENBQUMsSUFBSSxPQUFPLE9BQU8sQ0FBQyxDQUFDLEtBQUssUUFBUSxJQUFJLE9BQU8sQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJLE9BQU8sQ0FBQyxDQUFDLENBQUMsT0FBTyxFQUFFLENBQUM7b0JBQ3RGLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLGtCQUFrQixPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksTUFBTSxPQUFPLENBQUMsQ0FBQyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7b0JBQzlFLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDaEQsSUFBSSxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7d0JBQ2hDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLElBQUksS0FBSyxDQUFDLG1CQUFtQixPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksTUFBTSxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDO3dCQUNyRixPQUFPO29CQUNULENBQUM7Z0JBQ0gsQ0FBQztnQkFDRCxVQUFVLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUN4QyxNQUFNO1lBRVIsS0FBSyxzQkFBYyxDQUFDLFNBQVM7Z0JBQzNCLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLHFCQUFxQixDQUFDLENBQUM7Z0JBQzFDLElBQUksQ0FBQyxFQUFFLEVBQUUsS0FBSyxFQUFFLENBQUM7Z0JBQ2pCLFVBQVUsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQ3ZDLE1BQU07UUFDVixDQUFDO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0ssV0FBVyxDQUFDLElBQW9DO1FBQ3RELElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLHVDQUF1QyxJQUFJLENBQUMsa0JBQWtCLElBQUksQ0FBQyxDQUFDO1FBQ3ZGLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFDN0MsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBQ2xCLENBQUM7SUFFRDs7T0FFRztJQUNLLGNBQWMsQ0FBQyxTQUFpQixFQUFFLElBQVM7UUFDakQsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsYUFBYSxTQUFTLEVBQUUsQ0FBQyxDQUFDO1FBRTdDLFFBQVEsU0FBUyxFQUFFLENBQUM7WUFDbEIsS0FBSyxPQUFPO2dCQUNWLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ3ZCLE1BQU07WUFFUixLQUFLLGNBQWM7Z0JBQ2pCLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDN0IsTUFBTTtZQUVSLEtBQUssY0FBYztnQkFDakIsSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUM3QixNQUFNO1lBRVIsS0FBSyxjQUFjO2dCQUNqQixJQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQzdCLE1BQU07WUFFUixLQUFLLGdCQUFnQjtnQkFDbkIsSUFBSSxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUMvQixNQUFNO1lBRVIsS0FBSyxnQkFBZ0I7Z0JBQ25CLElBQUksQ0FBQyxJQUFJLENBQUMsZUFBZSxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUNqQyxNQUFNO1lBRVIsS0FBSyxnQkFBZ0I7Z0JBQ25CLElBQUksQ0FBQyxJQUFJLENBQUMsZUFBZSxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUNqQyxNQUFNO1lBRVIsS0FBSyxxQkFBcUI7Z0JBQ3hCLElBQUksQ0FBQyxJQUFJLENBQUMsbUJBQW1CLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQ3JDLE1BQU07WUFFUixLQUFLLHNCQUFzQjtnQkFDekIsSUFBSSxDQUFDLElBQUksQ0FBQyxvQkFBb0IsRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFDdEMsTUFBTTtZQUVSLEtBQUsseUJBQXlCO2dCQUM1QixJQUFJLENBQUMsSUFBSSxDQUFDLHVCQUF1QixFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUN6QyxNQUFNO1lBRVIsS0FBSyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUM7Z0JBQ3RCLDZCQUE2QjtnQkFDN0IsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQztnQkFDOUIsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLEVBQUUsSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDO2dCQUM3QyxJQUFJLE9BQU8sSUFBSSxTQUFTLEVBQUUsQ0FBQztvQkFDekIsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7b0JBQ3ZDLElBQUksS0FBSyxFQUFFLENBQUM7d0JBQ1YsS0FBSyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxDQUFDO29CQUN0QyxDQUFDO2dCQUNILENBQUM7Z0JBQ0QsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQ2pDLE1BQU07WUFDUixDQUFDO1lBRUQsS0FBSyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUM7Z0JBQ3RCLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUM7Z0JBQzlCLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxFQUFFLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQztnQkFDN0MsSUFBSSxPQUFPLElBQUksU0FBUyxFQUFFLENBQUM7b0JBQ3pCLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO29CQUN2QyxJQUFJLEtBQUssRUFBRSxDQUFDO3dCQUNWLEtBQUssQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztvQkFDdEMsQ0FBQztnQkFDSCxDQUFDO2dCQUNELElBQUksQ0FBQyxJQUFJLENBQUMsZUFBZSxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUNqQyxNQUFNO1lBQ1IsQ0FBQztZQUVELEtBQUssZ0JBQWdCLENBQUMsQ0FBQyxDQUFDO2dCQUN0QixNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDO2dCQUM5QixNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsRUFBRSxJQUFJLElBQUksQ0FBQyxVQUFVLENBQUM7Z0JBQzdDLElBQUksT0FBTyxJQUFJLFNBQVMsRUFBRSxDQUFDO29CQUN6QixNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztvQkFDdkMsSUFBSSxLQUFLLEVBQUUsQ0FBQzt3QkFDVixLQUFLLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQztvQkFDbkMsQ0FBQztnQkFDSCxDQUFDO2dCQUNELElBQUksQ0FBQyxJQUFJLENBQUMsZUFBZSxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUNqQyxNQUFNO1lBQ1IsQ0FBQztZQUVELEtBQUssa0JBQWtCLENBQUMsQ0FBQyxDQUFDO2dCQUN4QixNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7Z0JBQ3JELElBQUksS0FBSyxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztvQkFDdkIsTUFBTSxNQUFNLEdBQUcsS0FBSyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDdEMsSUFBSSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxNQUFNLENBQUMsQ0FBQztnQkFDdEMsQ0FBQztxQkFBTSxDQUFDO29CQUNOLElBQUksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQ3BDLENBQUM7Z0JBQ0QsTUFBTTtZQUNSLENBQUM7WUFFRCxLQUFLLHFCQUFxQixDQUFDLENBQUMsQ0FBQztnQkFDM0IsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO2dCQUNyRCxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsSUFBSSxFQUFFLEVBQUUsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDO2dCQUNoRCxJQUFJLEtBQUssSUFBSSxTQUFTLEVBQUUsQ0FBQztvQkFDdkIsTUFBTSxRQUFRLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7b0JBQ3RELElBQUksUUFBUSxFQUFFLENBQUM7d0JBQ2IsUUFBUSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQzt3QkFDdEIsSUFBSSxDQUFDLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxRQUFRLENBQUMsQ0FBQztvQkFDM0MsQ0FBQzt5QkFBTSxDQUFDO3dCQUNOLElBQUksQ0FBQyxJQUFJLENBQUMsbUJBQW1CLEVBQUUsSUFBSSxDQUFDLENBQUM7b0JBQ3ZDLENBQUM7Z0JBQ0gsQ0FBQztxQkFBTSxDQUFDO29CQUNOLElBQUksQ0FBQyxJQUFJLENBQUMsbUJBQW1CLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQ3ZDLENBQUM7Z0JBQ0QsTUFBTTtZQUNSLENBQUM7WUFFRCxLQUFLLHFCQUFxQixDQUFDLENBQUMsQ0FBQztnQkFDM0IsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO2dCQUNyRCxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsSUFBSSxFQUFFLEVBQUUsSUFBSSxJQUFJLENBQUMsT0FBTyxDQUFDO2dCQUNoRCxJQUFJLEtBQUssSUFBSSxTQUFTLEVBQUUsQ0FBQztvQkFDdkIsTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDO29CQUNqQyxNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQztvQkFDekMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7b0JBQzdCLElBQUksQ0FBQyxJQUFJLENBQUMsbUJBQW1CLEVBQUUsTUFBTSxJQUFJLElBQUksQ0FBQyxDQUFDO2dCQUNqRCxDQUFDO3FCQUFNLENBQUM7b0JBQ04sSUFBSSxDQUFDLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFDdkMsQ0FBQztnQkFDRCxNQUFNO1lBQ1IsQ0FBQztZQUVELEtBQUssbUJBQW1CO2dCQUN0QixJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFDOUIsTUFBTTtZQUVSLEtBQUssbUJBQW1CO2dCQUN0QixJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFDOUIsTUFBTTtZQUVSLEtBQUssbUJBQW1CO2dCQUN0QixJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFDOUIsTUFBTTtZQUVSLEtBQUssZUFBZTtnQkFDbEIsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQy9CLE1BQU07WUFFUixLQUFLLGtCQUFrQjtnQkFDckIsSUFBSSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFDbEMsTUFBTTtZQUVSLEtBQUssZUFBZTtnQkFDbEIsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQ2hDLE1BQU07WUFFUixLQUFLLGVBQWU7Z0JBQ2xCLElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUNoQyxNQUFNO1lBRVIsS0FBSyxxQkFBcUI7Z0JBQ3hCLElBQUksQ0FBQyxJQUFJLENBQUMsbUJBQW1CLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQ3JDLE1BQU07WUFFUixLQUFLLGNBQWM7Z0JBQ2pCLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUMvQixNQUFNO1lBRVIsS0FBSyxpQkFBaUIsQ0FBQyxDQUFDLENBQUM7Z0JBQ3ZCLGtEQUFrRDtnQkFDbEQsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQztnQkFDOUIsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQztnQkFDM0IsSUFBSSxPQUFPLEVBQUUsQ0FBQztvQkFDWixNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztvQkFDL0MsSUFBSSxLQUFLLEVBQUUsQ0FBQzt3QkFDVixJQUFJLE1BQU0sS0FBSyxTQUFTLEVBQUUsQ0FBQzs0QkFDekIsS0FBSyxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxLQUFLLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQyxDQUFDO3dCQUN6RCxDQUFDOzZCQUFNLElBQUksTUFBTSxLQUFLLFFBQVEsSUFBSSxNQUFNLEtBQUssTUFBTSxJQUFJLE1BQU0sS0FBSyxLQUFLLEVBQUUsQ0FBQzs0QkFDeEUsS0FBSyxDQUFDLFdBQVcsRUFBRSxDQUFDO3dCQUN0QixDQUFDO29CQUNILENBQUM7Z0JBQ0gsQ0FBQztnQkFDRCxJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQixFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUNsQyxNQUFNO1lBQ1IsQ0FBQztZQUVELEtBQUssb0JBQW9CO2dCQUN2QixJQUFJLENBQUMsdUJBQXVCLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ25DLE1BQU07WUFFUixLQUFLLG9CQUFvQjtnQkFDdkIsSUFBSSxDQUFDLHNCQUFzQixDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNsQyxNQUFNO1lBRVIsS0FBSyxxQkFBcUI7Z0JBQ3hCLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDbkMsTUFBTTtZQUVSO2dCQUNFLHFDQUFxQztnQkFDckMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ2hELENBQUM7SUFDSCxDQUFDO0lBRUQ7O09BRUc7SUFDSyxXQUFXLENBQUMsSUFBb0I7UUFDdEMsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDO1FBQ2pDLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxXQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2hDLGdEQUFnRDtRQUNoRCxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQyxXQUFXLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO1FBQy9FLElBQUksSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQ3ZCLElBQUksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO1FBQ2pELENBQUM7UUFFRCxzREFBc0Q7UUFDdEQsSUFBSSxDQUFDLFdBQVcsR0FBRztZQUNqQixFQUFFLEVBQUUsSUFBSSxDQUFDLGFBQWE7WUFDdEIsUUFBUSxFQUFFLElBQUkscURBQXlCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztTQUNuRCxDQUFDO1FBRUYsMENBQTBDO1FBQzFDLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ2hCLEtBQUssTUFBTSxLQUFLLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO2dCQUNoQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxFQUFFLElBQUksYUFBSyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQzVELENBQUM7UUFDSCxDQUFDO1FBRUQsc0NBQXNDO1FBQ3RDLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1FBRTFCLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLG9CQUFvQixJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsS0FBSyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsV0FBVyxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUMsQ0FBQztRQUMzRyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQztRQUV6Qix3RUFBd0U7UUFDeEUsSUFBSSxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDakIsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ2pDLENBQUM7SUFDSCxDQUFDO0lBRUQ7O09BRUc7SUFDSyxrQkFBa0I7UUFDeEIsS0FBSyxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ3BDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNuQyxDQUFDO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0ssa0JBQWtCLENBQUMsT0FBZTtRQUN4QyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUM7WUFBRSxPQUFPO1FBQzdDLE1BQU0sT0FBTyxHQUF3QixDQUFDLE9BQU8sRUFBRSxFQUFFO1lBQy9DLGdEQUFnRDtZQUNoRCxJQUFJLENBQUMsb0JBQW9CLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUMzQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsR0FBRyxDQUFDLE9BQU8sRUFBRSxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDeEQsZ0NBQWdDO1lBQ2hDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1lBQ2pFLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1lBRW5FLE9BQU87Z0JBQ0wsV0FBVyxFQUFFLENBQUMsT0FBTyxFQUFFLEVBQUU7b0JBQ3ZCLElBQUksSUFBSSxDQUFDLEVBQUUsRUFBRSxVQUFVLEtBQUssWUFBUyxDQUFDLElBQUksRUFBRSxDQUFDO3dCQUMzQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7d0JBQ3RDLE9BQU8sSUFBSSxDQUFDO29CQUNkLENBQUM7b0JBQ0QsT0FBTyxLQUFLLENBQUM7Z0JBQ2YsQ0FBQztnQkFDRCxPQUFPLEVBQUUsR0FBRyxFQUFFO29CQUNaLElBQUksSUFBSSxDQUFDLG9CQUFvQixDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsS0FBSyxPQUFPLENBQUMsT0FBTzt3QkFBRSxPQUFPO29CQUN2RSxJQUFJLENBQUMsb0JBQW9CLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO29CQUMxQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO29CQUN4QyxJQUFJLENBQUMsbUJBQW1CLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUMzQyxDQUFDO2FBQ0YsQ0FBQztRQUNKLENBQUMsQ0FBQztRQUVGLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDNUMsQ0FBQztJQUVEOztPQUVHO0lBQ0ssaUJBQWlCLENBQUMsSUFBYztRQUN0QyxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7UUFFckMsSUFBSSxLQUFLLEVBQUUsQ0FBQztZQUNWLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDckIsQ0FBQzthQUFNLENBQUM7WUFDTixLQUFLLEdBQUcsSUFBSSxhQUFLLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQzlCLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDaEMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUNuQyxDQUFDO1FBRUQsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDbEMsQ0FBQztJQUVEOztPQUVHO0lBQ0ssaUJBQWlCLENBQUMsSUFBYztRQUN0QyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDdkMsSUFBSSxLQUFLLEVBQUUsQ0FBQztZQUNWLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDbkIsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDbEMsQ0FBQztJQUNILENBQUM7SUFFRDs7T0FFRztJQUNLLGlCQUFpQixDQUFDLElBQW9CO1FBQzVDLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUN2QyxJQUFJLEtBQUssRUFBRSxDQUFDO1lBQ1YsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQzVCLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUMzQyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQ3BDLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ2xDLENBQUM7SUFDSCxDQUFDO0lBRUQ7O09BRUc7SUFDSyxtQkFBbUIsQ0FBQyxJQUFnQjtRQUMxQywwRUFBMEU7UUFDMUUsSUFBSSxJQUFJLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxDQUFDO1lBQ2xELElBQUksQ0FBQyxNQUFjLENBQUMsRUFBRSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUM7UUFDekMsQ0FBQztRQUVELG1CQUFtQjtRQUNuQixJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUNoQixNQUFNLElBQUksR0FBRyxJQUFJLFdBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDbkMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUM5Qiw0Q0FBNEM7WUFDNUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ25DLENBQUM7UUFFRCxNQUFNLE9BQU8sR0FBRyxJQUFJLGlCQUFPLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBRXhDLHNFQUFzRTtRQUN0RSxJQUFJLElBQUksQ0FBQyxJQUFJLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLEtBQUssTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQztZQUNuRSxPQUFPLENBQUMsTUFBYyxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUM7UUFDckMsQ0FBQztRQUVELHFDQUFxQztRQUNyQyxJQUFJLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNwQixNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDL0MsTUFBTSxVQUFVLEdBQUksSUFBWSxDQUFDLE1BQU0sQ0FBQztZQUN4QyxJQUFJLFVBQVUsSUFBSSxLQUFLLEVBQUUsQ0FBQztnQkFDeEIsdURBQXVEO2dCQUN2RCxxRUFBcUU7Z0JBQ3JFLFVBQVUsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQztnQkFDOUIsTUFBTSxNQUFNLEdBQUcsS0FBSyxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsQ0FBQztnQkFDNUMsT0FBTyxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7WUFDMUIsQ0FBQztpQkFBTSxJQUFJLFVBQVUsRUFBRSxDQUFDO2dCQUN0QiwyQ0FBMkM7Z0JBQzNDLFVBQVUsQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQztnQkFDOUIsTUFBTSxhQUFhLEdBQUcsRUFBRSxFQUFFLEVBQUUsT0FBTyxDQUFDLE9BQU8sRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxJQUFJLHVCQUFVLEVBQUUsRUFBRSxRQUFRLEVBQUUsSUFBSSx1QkFBVSxFQUFFLEVBQVMsQ0FBQztnQkFDM0gsT0FBTyxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLDBCQUEwQixDQUFDLENBQUMsV0FBVyxDQUFDLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRSxVQUFVLENBQUMsQ0FBQztZQUMxRyxDQUFDO2lCQUFNLElBQUksS0FBSyxFQUFFLENBQUM7Z0JBQ2pCLGlHQUFpRztnQkFDakcsTUFBTSxNQUFNLEdBQUcsS0FBSyxDQUFDLE9BQU8sRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDN0QsSUFBSSxNQUFNLEVBQUUsQ0FBQztvQkFDWCxPQUFPLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztnQkFDMUIsQ0FBQztZQUNILENBQUM7UUFDSCxDQUFDO1FBRUQsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDdEMsQ0FBQztJQUVEOztPQUVHO0lBQ0ssdUJBQXVCLENBQUMsSUFBb0I7UUFDbEQsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQzdCLE9BQU8sQ0FBQyxHQUFHLENBQUMsOENBQThDLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDN0YsQ0FBQztRQUVELElBQUksQ0FBQztZQUNILGlCQUFpQjtZQUNqQixNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDO1lBQ2hELElBQUksUUFBUSxFQUFFLENBQUM7Z0JBQ2IsTUFBTSxJQUFJLEdBQUcsSUFBSSxXQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQ2hDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQzlCLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ2hDLENBQUM7WUFFRCxNQUFNLFdBQVcsR0FBRyxJQUFBLCtCQUFpQixFQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztZQUNsRCxJQUFJLE9BQU8sQ0FBQyxHQUFHLENBQUMsWUFBWSxFQUFFLENBQUM7Z0JBQzdCLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUNBQW1DLEVBQUUsV0FBVyxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsV0FBVyxFQUFHLFdBQW1CLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDN0gsQ0FBQztZQUNELElBQUksQ0FBQyxJQUFJLENBQUMsbUJBQW1CLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFDOUMsQ0FBQztRQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7WUFDYixPQUFPLENBQUMsS0FBSyxDQUFDLDBDQUEwQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ2pFLENBQUM7SUFDSCxDQUFDO0lBRUQ7O09BRUc7SUFDSyxzQkFBc0IsQ0FBQyxJQUFTO1FBQ3RDLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUM7UUFDOUIsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQztRQUU1QixxQ0FBcUM7UUFDckMsSUFBSSxPQUFPLElBQUksTUFBTSxFQUFFLENBQUM7WUFDdEIsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDL0MsSUFBSSxLQUFLLEVBQUUsQ0FBQztnQkFDVixNQUFNLFNBQVMsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQ2pDLElBQUksTUFBTSxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUUxQyxJQUFJLENBQUMsTUFBTSxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztvQkFDekIseUVBQXlFO29CQUN6RSxNQUFNLEdBQUcsS0FBSyxDQUFDLFVBQVUsQ0FBQzt3QkFDeEIsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO3dCQUNmLEtBQUssRUFBRSxFQUFFO3dCQUNULFNBQVMsRUFBRSxJQUFJLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRTtxQkFDcEMsQ0FBQyxDQUFDO2dCQUNMLENBQUM7Z0JBRUQsSUFBSSxNQUFNLEVBQUUsQ0FBQztvQkFDWCxNQUFNLENBQUMsS0FBSyxHQUFHO3dCQUNiLFNBQVMsRUFBRSxJQUFJLENBQUMsVUFBVSxJQUFJLFNBQVM7d0JBQ3ZDLFFBQVEsRUFBRSxJQUFJLENBQUMsU0FBUyxJQUFJLEtBQUs7d0JBQ2pDLFFBQVEsRUFBRSxJQUFJLENBQUMsU0FBUyxJQUFJLEtBQUs7cUJBQ2xDLENBQUM7Z0JBQ0osQ0FBQztZQUNILENBQUM7UUFDSCxDQUFDO1FBRUQscUNBQXFDO1FBQ3JDLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7UUFDN0QsSUFBSSxPQUFPLElBQUksSUFBSSxDQUFDLElBQUksSUFBSSxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQztZQUNwRSxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDaEIsQ0FBQztRQUVELElBQUksQ0FBQyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDdEMsQ0FBQztJQUVEOztPQUVHO0lBQ0ssdUJBQXVCLENBQUMsSUFBMEI7UUFDeEQsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQztRQUU5QixxQ0FBcUM7UUFDckMsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUM5RCxJQUFJLE9BQU8sRUFBRSxDQUFDO1lBQ1osT0FBTyxDQUFDO2dCQUNOLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSztnQkFDakIsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRO2dCQUN2QixJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7YUFDaEIsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUVELElBQUksQ0FBQyxJQUFJLENBQUMsbUJBQW1CLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDdkMsQ0FBQztJQUVEOztPQUVHO0lBQ0ssUUFBUTtRQUNkLE1BQU0sT0FBTyxHQUFtQjtZQUM5QixFQUFFLEVBQUUsc0JBQWMsQ0FBQyxRQUFRO1lBQzNCLENBQUMsRUFBRTtnQkFDRCxLQUFLLEVBQUUsT0FBTyxJQUFJLENBQUMsS0FBSyxFQUFFO2dCQUMxQixPQUFPLEVBQUUsSUFBSSxDQUFDLGVBQWUsRUFBRTtnQkFDL0IsS0FBSyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQzthQUNyQztTQUNGLENBQUM7UUFFRixJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ3JCLENBQUM7SUFFRDs7T0FFRztJQUNLLGNBQWMsQ0FBQyxRQUFnQjtRQUNyQyxJQUFJLENBQUMsaUJBQWlCLEdBQUcsV0FBVyxDQUFDLEdBQUcsRUFBRTtZQUN4QyxJQUFJLENBQUMsa0JBQWtCLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO1lBQ3JDLElBQUksQ0FBQyxJQUFJLENBQUM7Z0JBQ1IsRUFBRSxFQUFFLHNCQUFjLENBQUMsU0FBUztnQkFDNUIsQ0FBQyxFQUFFLElBQUksQ0FBQyxRQUFRO2FBQ2pCLENBQUMsQ0FBQztRQUNMLENBQUMsRUFBRSxRQUFRLENBQUMsQ0FBQztJQUNmLENBQUM7SUFFRDs7T0FFRztJQUNLLElBQUksQ0FBQyxPQUF1QjtRQUNsQyxJQUFJLElBQUksQ0FBQyxFQUFFLEVBQUUsVUFBVSxLQUFLLFlBQVMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUMzQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7UUFDeEMsQ0FBQztJQUNILENBQUM7SUFFRDs7T0FFRztJQUNLLE9BQU87UUFDYixJQUFJLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1lBQzNCLGFBQWEsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQztZQUN0QyxJQUFJLENBQUMsaUJBQWlCLEdBQUcsSUFBSSxDQUFDO1FBQ2hDLENBQUM7SUFDSCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxPQUFPO1FBQ0wsS0FBSyxNQUFNLE9BQU8sSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQUUsT0FBTyxFQUFFLENBQUM7UUFDekUsSUFBSSxDQUFDLG9CQUFvQixDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ2xDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUNoQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDakMsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDNUIsSUFBSSxDQUFDLFdBQVcsR0FBRyxNQUFNLENBQUM7UUFDMUIsSUFBSSxDQUFDLGtCQUFrQixHQUFHLElBQUksQ0FBQyxxQkFBcUIsR0FBRyxDQUFDLENBQUMsQ0FBQyxvQkFBb0I7UUFDOUUsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ2YsSUFBSSxDQUFDLEVBQUUsRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDckIsSUFBSSxDQUFDLEVBQUUsR0FBRyxJQUFJLENBQUM7UUFDZixJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztJQUM1QixDQUFDOztBQXoxQkgsd0JBMDFCQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gJ2V2ZW50cyc7XHJcbmltcG9ydCBXZWJTb2NrZXQgZnJvbSAnd3MnO1xyXG5pbXBvcnQgeyBcclxuICBDbGllbnRPcHRpb25zLCBcclxuICBHYXRld2F5UGF5bG9hZCwgXHJcbiAgUmVhZHlFdmVudERhdGEsXHJcbiAgQVBJR3VpbGQsXHJcbiAgQVBJSW50ZXJhY3Rpb24sXHJcbiAgQVBJTWVzc2FnZSxcclxuICBBUElWb2ljZVNlcnZlclVwZGF0ZSxcclxuICBBUElDaGFubmVsLFxyXG4gIEFQSVVzZXJcclxufSBmcm9tICcuL3R5cGVzJztcclxuaW1wb3J0IHsgR2F0ZXdheU9wY29kZXMsIEdhdGV3YXlJbnRlbnRCaXRzIH0gZnJvbSAnLi9lbnVtcyc7XHJcbmltcG9ydCB7IENvbGxlY3Rpb24gfSBmcm9tICcuL3V0aWxzL0NvbGxlY3Rpb24nO1xyXG5pbXBvcnQgeyBVc2VyIH0gZnJvbSAnLi9zdHJ1Y3R1cmVzL1VzZXInO1xyXG5pbXBvcnQgeyBHdWlsZCB9IGZyb20gJy4vc3RydWN0dXJlcy9HdWlsZCc7XHJcbmltcG9ydCB7IE1lc3NhZ2UgfSBmcm9tICcuL3N0cnVjdHVyZXMvTWVzc2FnZSc7XHJcbmltcG9ydCB7IGNyZWF0ZUludGVyYWN0aW9uLCBJbnRlcmFjdGlvbiB9IGZyb20gJy4vc3RydWN0dXJlcy9JbnRlcmFjdGlvbic7XHJcbmltcG9ydCB7IEJhc2VDaGFubmVsLCBjcmVhdGVDaGFubmVsIH0gZnJvbSAnLi9zdHJ1Y3R1cmVzL0NoYW5uZWwnO1xyXG5pbXBvcnQgeyBSRVNUIH0gZnJvbSAnLi9yZXN0L1JFU1QnO1xyXG5pbXBvcnQgeyBBcHBsaWNhdGlvbkNvbW1hbmRNYW5hZ2VyIH0gZnJvbSAnLi9tYW5hZ2Vycy9BcHBsaWNhdGlvbkNvbW1hbmRNYW5hZ2VyJztcclxuXHJcbi8qKlxyXG4gKiBWb2ljZSBhZGFwdGVyIGNyZWF0b3IgdHlwZSBmb3IgQGp1YmJpby92b2ljZSBjb21wYXRpYmlsaXR5XHJcbiAqL1xyXG50eXBlIFZvaWNlQWRhcHRlckNyZWF0b3IgPSAobWV0aG9kczoge1xyXG4gIG9uVm9pY2VTZXJ2ZXJVcGRhdGUoZGF0YTogYW55KTogdm9pZDtcclxuICBvblZvaWNlU3RhdGVVcGRhdGUoZGF0YTogYW55KTogdm9pZDtcclxuICBkZXN0cm95KCk6IHZvaWQ7XHJcbn0pID0+IHtcclxuICBzZW5kUGF5bG9hZChwYXlsb2FkOiBhbnkpOiBib29sZWFuO1xyXG4gIGRlc3Ryb3koKTogdm9pZDtcclxufTtcclxuXHJcbi8qKlxyXG4gKiBNYWluIGNsaWVudCBjbGFzc1xyXG4gKi9cclxuZXhwb3J0IGNsYXNzIENsaWVudCBleHRlbmRzIEV2ZW50RW1pdHRlciB7XHJcbiAgLyoqIENsaWVudCBvcHRpb25zICovXHJcbiAgcHVibGljIHJlYWRvbmx5IG9wdGlvbnM6IENsaWVudE9wdGlvbnM7XHJcbiAgXHJcbiAgLyoqIFJFU1QgQVBJIGNsaWVudCAqL1xyXG4gIHB1YmxpYyByZWFkb25seSByZXN0OiBSRVNUO1xyXG4gIFxyXG4gIC8qKiBUaGUgYm90IHVzZXIgKi9cclxuICBwdWJsaWMgdXNlcjogVXNlciB8IG51bGwgPSBudWxsO1xyXG4gIFxyXG4gIC8qKiBBcHBsaWNhdGlvbiBJRCAqL1xyXG4gIHB1YmxpYyBhcHBsaWNhdGlvbklkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcclxuICBcclxuICAvKiogQXBwbGljYXRpb24gb2JqZWN0IHdpdGggY29tbWFuZHMgbWFuYWdlciAoRGlzY29yZC5qcyBjb21wYXRpYmxlKSAqL1xyXG4gIHB1YmxpYyBhcHBsaWNhdGlvbjoge1xyXG4gICAgaWQ6IHN0cmluZyB8IG51bGw7XHJcbiAgICBjb21tYW5kczogQXBwbGljYXRpb25Db21tYW5kTWFuYWdlcjtcclxuICB9IHwgbnVsbCA9IG51bGw7XHJcbiAgXHJcbiAgLyoqIENhY2hlZCBndWlsZHMgKi9cclxuICBwdWJsaWMgZ3VpbGRzOiBDb2xsZWN0aW9uPHN0cmluZywgR3VpbGQ+ID0gbmV3IENvbGxlY3Rpb24oKTtcclxuICBcclxuICAvKiogQ2FjaGVkIGNoYW5uZWxzICovXHJcbiAgcHVibGljIGNoYW5uZWxzOiBDb2xsZWN0aW9uPHN0cmluZywgQmFzZUNoYW5uZWw+ID0gbmV3IENvbGxlY3Rpb24oKTtcclxuICBcclxuICAvKiogQ2FjaGVkIHVzZXJzICovXHJcbiAgcHVibGljIHVzZXJzOiBDb2xsZWN0aW9uPHN0cmluZywgVXNlcj4gPSBuZXcgQ29sbGVjdGlvbigpO1xyXG4gIFxyXG4gIC8qKiBWb2ljZSBhZGFwdGVyIG1hbmFnZW1lbnQgKi9cclxuICBwdWJsaWMgdm9pY2U6IHtcclxuICAgIGFkYXB0ZXJzOiBNYXA8c3RyaW5nLCBWb2ljZUFkYXB0ZXJDcmVhdG9yPjtcclxuICB9O1xyXG4gIFxyXG4gIC8qKiBXZWJTb2NrZXQgY29ubmVjdGlvbiAqL1xyXG4gIHByaXZhdGUgd3M6IFdlYlNvY2tldCB8IG51bGwgPSBudWxsO1xyXG4gIFxyXG4gIC8qKiBCb3QgdG9rZW4gKi9cclxuICBwcml2YXRlIHRva2VuOiBzdHJpbmcgPSAnJztcclxuICBcclxuICAvKiogU2Vzc2lvbiBJRCAqL1xyXG4gIHByaXZhdGUgc2Vzc2lvbklkOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcclxuICBcclxuICAvKiogU2VxdWVuY2UgbnVtYmVyICovXHJcbiAgcHJpdmF0ZSBzZXF1ZW5jZTogbnVtYmVyIHwgbnVsbCA9IG51bGw7XHJcbiAgXHJcbiAgLyoqIEhlYXJ0YmVhdCBpbnRlcnZhbCAqL1xyXG4gIHByaXZhdGUgaGVhcnRiZWF0SW50ZXJ2YWw6IE5vZGVKUy5UaW1lb3V0IHwgbnVsbCA9IG51bGw7XHJcbiAgXHJcbiAgLyoqIEdhdGV3YXkgVVJMICovXHJcbiAgcHJpdmF0ZSBnYXRld2F5VXJsOiBzdHJpbmc7XHJcblxyXG4gIC8qKiBMYXN0IGhlYXJ0YmVhdCBzZW50IHRpbWVzdGFtcCAoZm9yIHBpbmcgY2FsY3VsYXRpb24pICovXHJcbiAgcHJpdmF0ZSBfbGFzdEhlYXJ0YmVhdFNlbnQ6IG51bWJlciA9IDA7XHJcblxyXG4gIC8qKiBXZWJTb2NrZXQgcGluZyAocm91bmQtdHJpcCBsYXRlbmN5IGluIG1zKSAqL1xyXG4gIHB1YmxpYyBwaW5nOiBudW1iZXIgPSAtMTtcclxuICBcclxuICAvKiogVm9pY2Ugc3RhdGUgdXBkYXRlIGhhbmRsZXJzIChmb3Igdm9pY2UgYWRhcHRlcnMpICovXHJcbiAgcHJpdmF0ZSB2b2ljZVN0YXRlSGFuZGxlcnM6IE1hcDxzdHJpbmcsIChkYXRhOiBhbnkpID0+IHZvaWQ+ID0gbmV3IE1hcCgpO1xyXG4gIHByaXZhdGUgdm9pY2VTZXJ2ZXJIYW5kbGVyczogTWFwPHN0cmluZywgKGRhdGE6IGFueSkgPT4gdm9pZD4gPSBuZXcgTWFwKCk7XHJcbiAgcHJpdmF0ZSB2b2ljZURlc3Ryb3lIYW5kbGVyczogTWFwPHN0cmluZywgKCkgPT4gdm9pZD4gPSBuZXcgTWFwKCk7XHJcblxyXG4gIC8qKiBXaGV0aGVyIHRoZSBjbGllbnQgaXMgY3VycmVudGx5IGluIHRoZSBsb2dpbiBmbG93ICovXHJcbiAgcHJpdmF0ZSBfbG9naW5TdGF0ZTogJ2lkbGUnIHwgJ2Nvbm5lY3RpbmcnIHwgJ3JlYWR5JyA9ICdpZGxlJztcclxuXHJcbiAgLyoqIFJlY29ubmVjdCBhdHRlbXB0IGNvdW50ZXIgKi9cclxuICBwcml2YXRlIF9yZWNvbm5lY3RBdHRlbXB0czogbnVtYmVyID0gMDtcclxuXHJcbiAgLyoqIE1heGltdW0gcmVjb25uZWN0IGF0dGVtcHRzIGJlZm9yZSBnaXZpbmcgdXAgKi9cclxuICBwcml2YXRlIHJlYWRvbmx5IF9tYXhSZWNvbm5lY3RBdHRlbXB0czogbnVtYmVyID0gNTtcclxuXHJcbiAgLyoqIENhY2hlZCBpbnRlbnRzIHZhbHVlICovXHJcbiAgcHJpdmF0ZSBfaW50ZW50c1ZhbHVlPzogbnVtYmVyO1xyXG5cclxuICBjb25zdHJ1Y3RvcihvcHRpb25zOiBDbGllbnRPcHRpb25zKSB7XHJcbiAgICBzdXBlcigpO1xyXG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcclxuICAgIHRoaXMuZ2F0ZXdheVVybCA9IG9wdGlvbnMuZ2F0ZXdheVVybCB8fCAnd3NzOi8vcmVhbHRpbWUuanViYmlvLmNvbS93cy9ib3QnO1xyXG4gICAgdGhpcy5yZXN0ID0gbmV3IFJFU1Qob3B0aW9ucy5hcGlVcmwpO1xyXG4gICAgXHJcbiAgICAvLyBJbml0aWFsaXplIHZvaWNlIGFkYXB0ZXIgc3lzdGVtXHJcbiAgICB0aGlzLnZvaWNlID0ge1xyXG4gICAgICBhZGFwdGVyczogbmV3IE1hcCgpXHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2FsY3VsYXRlIGludGVudHMgdmFsdWVcclxuICAgKi9cclxuICBwcml2YXRlIGdldEludGVudHNWYWx1ZSgpOiBudW1iZXIge1xyXG4gICAgLy8gQ2FjaGUgdGhlIGludGVudHMgdmFsdWUgZm9yIGNoZWNrSW50ZW50KCkgbG9va3Vwc1xyXG4gICAgaWYgKHRoaXMuX2ludGVudHNWYWx1ZSAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgIHJldHVybiB0aGlzLl9pbnRlbnRzVmFsdWU7XHJcbiAgICB9XHJcbiAgICBpZiAodHlwZW9mIHRoaXMub3B0aW9ucy5pbnRlbnRzID09PSAnbnVtYmVyJykge1xyXG4gICAgICB0aGlzLl9pbnRlbnRzVmFsdWUgPSB0aGlzLm9wdGlvbnMuaW50ZW50cztcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMuX2ludGVudHNWYWx1ZSA9IHRoaXMub3B0aW9ucy5pbnRlbnRzLnJlZHVjZSgoYWNjLCBpbnRlbnQpID0+IGFjYyB8IGludGVudCwgMCk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGhpcy5faW50ZW50c1ZhbHVlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2hlY2sgaWYgYSBzcGVjaWZpYyBpbnRlbnQgaXMgZW5hYmxlZC4gRW1pdHMgYSAnd2FybicgZXZlbnQgaWYgdGhlIGludGVudFxyXG4gICAqIGlzIG5vdCBlbmFibGVkLCBhbGxvd2luZyBsaWJyYXJ5IGNvbnN1bWVycyB0byBjYXRjaCBtaXNjb25maWd1cmF0aW9uIGVhcmx5LlxyXG4gICAqIFxyXG4gICAqIEBwYXJhbSBpbnRlbnQgLSBUaGUgR2F0ZXdheUludGVudEJpdHMgZmxhZyB0byBjaGVja1xyXG4gICAqIEBwYXJhbSBmZWF0dXJlIC0gSHVtYW4tcmVhZGFibGUgZGVzY3JpcHRpb24gb2YgdGhlIGZlYXR1cmUgcmVxdWlyaW5nIHRoaXMgaW50ZW50XHJcbiAgICogQHJldHVybnMgdHJ1ZSBpZiB0aGUgaW50ZW50IGlzIGVuYWJsZWQsIGZhbHNlIG90aGVyd2lzZVxyXG4gICAqL1xyXG4gIHByaXZhdGUgY2hlY2tJbnRlbnQoaW50ZW50OiBHYXRld2F5SW50ZW50Qml0cywgZmVhdHVyZTogc3RyaW5nKTogYm9vbGVhbiB7XHJcbiAgICBjb25zdCBpbnRlbnRzID0gdGhpcy5nZXRJbnRlbnRzVmFsdWUoKTtcclxuICAgIGNvbnN0IGhhc0ludGVudCA9IChpbnRlbnRzICYgaW50ZW50KSA9PT0gaW50ZW50O1xyXG4gICAgaWYgKCFoYXNJbnRlbnQpIHtcclxuICAgICAgdGhpcy5lbWl0KCd3YXJuJywgYE1pc3NpbmcgaW50ZW50IGZvciAke2ZlYXR1cmV9LiBFbmFibGUgR2F0ZXdheUludGVudEJpdHMuJHtHYXRld2F5SW50ZW50Qml0c1tpbnRlbnRdfSB0byB1c2UgdGhpcyBmZWF0dXJlLmApO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGhhc0ludGVudDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdhdGV3YXkgY2xvc2UgY29kZSBkZXNjcmlwdGlvbnNcclxuICAgKi9cclxuICBwcml2YXRlIHN0YXRpYyByZWFkb25seSBDTE9TRV9DT0RFUzogUmVjb3JkPG51bWJlciwgeyBtZXNzYWdlOiBzdHJpbmc7IHJlY29ubmVjdGFibGU6IGJvb2xlYW4gfT4gPSB7XHJcbiAgICA0MDAwOiB7IG1lc3NhZ2U6ICdCaWxpbm1leWVuIGhhdGEgKFVua25vd24gZXJyb3IpJywgcmVjb25uZWN0YWJsZTogdHJ1ZSB9LFxyXG4gICAgNDAwMTogeyBtZXNzYWdlOiAnQmlsaW5tZXllbiBvcGNvZGUgZ8O2bmRlcmlsZGkgKFVua25vd24gb3Bjb2RlKScsIHJlY29ubmVjdGFibGU6IHRydWUgfSxcclxuICAgIDQwMDI6IHsgbWVzc2FnZTogJ0dlw6dlcnNpeiBwYXlsb2FkIGfDtm5kZXJpbGRpIChEZWNvZGUgZXJyb3IpJywgcmVjb25uZWN0YWJsZTogdHJ1ZSB9LFxyXG4gICAgNDAwMzogeyBtZXNzYWdlOiAnSGVuw7x6IGtpbWxpayBkb8SfcnVsYW1hc8SxIHlhcMSxbG1hZMSxIChOb3QgYXV0aGVudGljYXRlZCknLCByZWNvbm5lY3RhYmxlOiB0cnVlIH0sXHJcbiAgICA0MDA0OiB7IG1lc3NhZ2U6ICdHZcOnZXJzaXogYm90IHRva2VuXFwnxLEgKEF1dGhlbnRpY2F0aW9uIGZhaWxlZCknLCByZWNvbm5lY3RhYmxlOiBmYWxzZSB9LFxyXG4gICAgNDAwNTogeyBtZXNzYWdlOiAnWmF0ZW4ga2ltbGlrIGRvxJ9ydWxhbWFzxLEgeWFwxLFsbcSxxZ8gKEFscmVhZHkgYXV0aGVudGljYXRlZCknLCByZWNvbm5lY3RhYmxlOiB0cnVlIH0sXHJcbiAgICA0MDA3OiB7IG1lc3NhZ2U6ICdHZcOnZXJzaXogc2VxdWVuY2UgbnVtYXJhc8SxIChJbnZhbGlkIHNlcSknLCByZWNvbm5lY3RhYmxlOiB0cnVlIH0sXHJcbiAgICA0MDA4OiB7IG1lc3NhZ2U6ICdSYXRlIGxpbWl0IGHFn8SxbGTEsSAoUmF0ZSBsaW1pdGVkKScsIHJlY29ubmVjdGFibGU6IHRydWUgfSxcclxuICAgIDQwMDk6IHsgbWVzc2FnZTogJ090dXJ1bSB6YW1hbiBhxZ/EsW3EsW5hIHXEn3JhZMSxIChTZXNzaW9uIHRpbWVkIG91dCknLCByZWNvbm5lY3RhYmxlOiB0cnVlIH0sXHJcbiAgICA0MDEwOiB7IG1lc3NhZ2U6ICdHZcOnZXJzaXogc2hhcmQgeWFwxLFsYW5kxLFybWFzxLEgKEludmFsaWQgc2hhcmQpJywgcmVjb25uZWN0YWJsZTogZmFsc2UgfSxcclxuICAgIDQwMTE6IHsgbWVzc2FnZTogJ1NoYXJkaW5nIGdlcmVrbGkgKFNoYXJkaW5nIHJlcXVpcmVkKScsIHJlY29ubmVjdGFibGU6IGZhbHNlIH0sXHJcbiAgICA0MDE0OiB7IG1lc3NhZ2U6ICfEsHppbiB2ZXJpbG1leWVuIGludGVudFxcJ2xlciBpc3RlbmRpIChEaXNhbGxvd2VkIGludGVudHMpJywgcmVjb25uZWN0YWJsZTogZmFsc2UgfSxcclxuICB9O1xyXG5cclxuICAvKipcclxuICAgKiBMb2dpbiB0byB0aGUgZ2F0ZXdheVxyXG4gICAqL1xyXG4gIGFzeW5jIGxvZ2luKHRva2VuOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xyXG4gICAgaWYgKCF0b2tlbiB8fCB0eXBlb2YgdG9rZW4gIT09ICdzdHJpbmcnKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihcclxuICAgICAgICAnR2XDp2VybGkgYmlyIGJvdCB0b2tlblxcJ8SxIHNhxJ9sYW5tYWzEsWTEsXIuIMOWcm5lazogY2xpZW50LmxvZ2luKHByb2Nlc3MuZW52LkJPVF9UT0tFTiknXHJcbiAgICAgICk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy50b2tlbiA9IHRva2VuLnJlcGxhY2UoL15Cb3RcXHMrL2ksICcnKTtcclxuICAgIHRoaXMucmVzdC5zZXRUb2tlbih0aGlzLnRva2VuKTtcclxuICAgIHRoaXMuX2xvZ2luU3RhdGUgPSAnY29ubmVjdGluZyc7XHJcbiAgICB0aGlzLl9yZWNvbm5lY3RBdHRlbXB0cyA9IDA7XHJcblxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgY29uc3QgY2xlYW51cCA9ICgpID0+IHtcclxuICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XHJcbiAgICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcigncmVhZHknLCBvblJlYWR5KTtcclxuICAgICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKCdlcnJvcicsIG9uRXJyb3IpO1xyXG4gICAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIoJ2dhdGV3YXlDbG9zZScsIG9uR2F0ZXdheUNsb3NlKTtcclxuICAgICAgfTtcclxuXHJcbiAgICAgIGNvbnN0IHRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICBjbGVhbnVwKCk7XHJcbiAgICAgICAgdGhpcy5fbG9naW5TdGF0ZSA9ICdpZGxlJztcclxuICAgICAgICByZWplY3QobmV3IEVycm9yKFxyXG4gICAgICAgICAgJ0dhdGV3YXlcXCdlIGJhxJ9sYW7EsWxhbWFkxLE6IDMwIHNhbml5ZSBpw6dpbmRlIFJFQURZIGV2ZW50XFwnaSBhbMSxbmFtYWTEsS4gJyArXHJcbiAgICAgICAgICAnT2xhc8SxIHNlYmVwbGVyOiBnYXRld2F5IHN1bnVjdXN1IGVyacWfaWxlbWV6LCB0b2tlbiBnZcOnZXJzaXogdmV5YSBhxJ8gc29ydW51LidcclxuICAgICAgICApKTtcclxuICAgICAgfSwgMzAwMDApO1xyXG5cclxuICAgICAgY29uc3Qgb25SZWFkeSA9ICgpID0+IHtcclxuICAgICAgICBjbGVhbnVwKCk7XHJcbiAgICAgICAgdGhpcy5fbG9naW5TdGF0ZSA9ICdyZWFkeSc7XHJcbiAgICAgICAgdGhpcy5fcmVjb25uZWN0QXR0ZW1wdHMgPSAwO1xyXG4gICAgICAgIHJlc29sdmUodGhpcy50b2tlbik7XHJcbiAgICAgIH07XHJcblxyXG4gICAgICBjb25zdCBvbkVycm9yID0gKGVycm9yOiBFcnJvcikgPT4ge1xyXG4gICAgICAgIGNsZWFudXAoKTtcclxuICAgICAgICB0aGlzLl9sb2dpblN0YXRlID0gJ2lkbGUnO1xyXG4gICAgICAgIHJlamVjdChlcnJvcik7XHJcbiAgICAgIH07XHJcblxyXG4gICAgICBjb25zdCBvbkdhdGV3YXlDbG9zZSA9IChjb2RlOiBudW1iZXIsIHJlYXNvbjogc3RyaW5nKSA9PiB7XHJcbiAgICAgICAgY29uc3QgaW5mbyA9IENsaWVudC5DTE9TRV9DT0RFU1tjb2RlXTtcclxuICAgICAgICBpZiAoaW5mbyAmJiAhaW5mby5yZWNvbm5lY3RhYmxlKSB7XHJcbiAgICAgICAgICBjbGVhbnVwKCk7XHJcbiAgICAgICAgICB0aGlzLl9sb2dpblN0YXRlID0gJ2lkbGUnO1xyXG4gICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihgR2F0ZXdheSBiYcSfbGFudMSxc8SxIHJlZGRlZGlsZGkgWyR7Y29kZX1dOiAke2luZm8ubWVzc2FnZX0ke3JlYXNvbiA/ICcgLSAnICsgcmVhc29uIDogJyd9YCkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICAvLyBSZWNvbm5lY3RhYmxlIGNvZGVzOiBsb2dpbiBwcm9taXNlIHN0YXlzIGFsaXZlLCBjb25uZWN0KCkgd2lsbCByZXRyeVxyXG4gICAgICB9O1xyXG5cclxuICAgICAgdGhpcy5vbmNlKCdyZWFkeScsIG9uUmVhZHkpO1xyXG4gICAgICB0aGlzLm9uY2UoJ2Vycm9yJywgb25FcnJvcik7XHJcbiAgICAgIHRoaXMub24oJ2dhdGV3YXlDbG9zZScsIG9uR2F0ZXdheUNsb3NlKTtcclxuXHJcbiAgICAgIHRoaXMuY29ubmVjdCgpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDb25uZWN0IHRvIHRoZSBnYXRld2F5XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBjb25uZWN0KCk6IHZvaWQge1xyXG4gICAgdGhpcy53cyA9IG5ldyBXZWJTb2NrZXQodGhpcy5nYXRld2F5VXJsKTtcclxuICAgIFxyXG4gICAgdGhpcy53cy5vbignb3BlbicsICgpID0+IHtcclxuICAgICAgdGhpcy5lbWl0KCdkZWJ1ZycsICdXZWJTb2NrZXQgYmHEn2xhbnTEsXPEsSBhw6fEsWxkxLEnKTtcclxuICAgICAgdGhpcy5fcmVjb25uZWN0QXR0ZW1wdHMgPSAwO1xyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIHRoaXMud3Mub24oJ21lc3NhZ2UnLCAoZGF0YSkgPT4ge1xyXG4gICAgICB0aGlzLmhhbmRsZU1lc3NhZ2UoZGF0YS50b1N0cmluZygpKTtcclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICB0aGlzLndzLm9uKCdjbG9zZScsIChjb2RlLCByZWFzb24pID0+IHtcclxuICAgICAgY29uc3QgcmVhc29uU3RyID0gcmVhc29uPy50b1N0cmluZygpIHx8ICcnO1xyXG4gICAgICBjb25zdCBpbmZvID0gQ2xpZW50LkNMT1NFX0NPREVTW2NvZGVdO1xyXG4gICAgICBcclxuICAgICAgaWYgKGluZm8pIHtcclxuICAgICAgICB0aGlzLmVtaXQoJ2RlYnVnJywgYEdhdGV3YXkgYmHEn2xhbnTEsXPEsSBrYXBhbmTEsSBbJHtjb2RlfV06ICR7aW5mby5tZXNzYWdlfSR7cmVhc29uU3RyID8gJyAtICcgKyByZWFzb25TdHIgOiAnJ31gKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICB0aGlzLmVtaXQoJ2RlYnVnJywgYFdlYlNvY2tldCBrYXBhbmTEsTogJHtjb2RlfSAtICR7cmVhc29uU3RyfWApO1xyXG4gICAgICB9XHJcbiAgICAgIFxyXG4gICAgICB0aGlzLmNsZWFudXAoKTtcclxuXHJcbiAgICAgIC8vIEVtaXQgZ2F0ZXdheUNsb3NlIHNvIGxvZ2luKCkgY2FuIGhhbmRsZSBub24tcmVjb25uZWN0YWJsZSBjb2Rlc1xyXG4gICAgICB0aGlzLmVtaXQoJ2dhdGV3YXlDbG9zZScsIGNvZGUsIHJlYXNvblN0cik7XHJcblxyXG4gICAgICAvLyBOb24tcmVjb25uZWN0YWJsZSBjb2RlczogZG9uJ3QgcmV0cnlcclxuICAgICAgaWYgKGluZm8gJiYgIWluZm8ucmVjb25uZWN0YWJsZSkge1xyXG4gICAgICAgIHRoaXMuZW1pdCgnZGVidWcnLCBgS29kICR7Y29kZX0geWVuaWRlbiBiYcSfbGFuxLFsYW1heiwgYmHEn2xhbnTEsSBzb25sYW5kxLFyxLFsxLF5b3IuYCk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyBOb3JtYWwgY2xvc2U6IGRvbid0IHJldHJ5XHJcbiAgICAgIGlmIChjb2RlID09PSAxMDAwKSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyBSZWNvbm5lY3RhYmxlOiByZXRyeSB3aXRoIGJhY2tvZmZcclxuICAgICAgdGhpcy5fcmVjb25uZWN0QXR0ZW1wdHMrKztcclxuICAgICAgaWYgKHRoaXMuX3JlY29ubmVjdEF0dGVtcHRzID4gdGhpcy5fbWF4UmVjb25uZWN0QXR0ZW1wdHMpIHtcclxuICAgICAgICB0aGlzLmVtaXQoJ2RlYnVnJywgYE1ha3NpbXVtIHllbmlkZW4gYmHEn2xhbm1hIGRlbmVtZXNpIGHFn8SxbGTEsSAoJHt0aGlzLl9tYXhSZWNvbm5lY3RBdHRlbXB0c30pYCk7XHJcbiAgICAgICAgdGhpcy5lbWl0KCdlcnJvcicsIG5ldyBFcnJvcihcclxuICAgICAgICAgIGBHYXRld2F5IGJhxJ9sYW50xLFzxLEgJHt0aGlzLl9tYXhSZWNvbm5lY3RBdHRlbXB0c30gZGVuZW1lZGVuIHNvbnJhIGt1cnVsYW1hZMSxLiBTb24ga2FwYW5tYSBrb2R1OiAke2NvZGV9YFxyXG4gICAgICAgICkpO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG5cclxuICAgICAgY29uc3QgZGVsYXkgPSBNYXRoLm1pbigxMDAwICogTWF0aC5wb3coMiwgdGhpcy5fcmVjb25uZWN0QXR0ZW1wdHMgLSAxKSwgMzAwMDApO1xyXG4gICAgICB0aGlzLmVtaXQoJ2RlYnVnJywgYFllbmlkZW4gYmHEn2xhbsSxbMSxeW9yIChkZW5lbWUgJHt0aGlzLl9yZWNvbm5lY3RBdHRlbXB0c30vJHt0aGlzLl9tYXhSZWNvbm5lY3RBdHRlbXB0c30pLCAke2RlbGF5fW1zIHNvbnJhLi4uYCk7XHJcbiAgICAgIHNldFRpbWVvdXQoKCkgPT4gdGhpcy5jb25uZWN0KCksIGRlbGF5KTtcclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICB0aGlzLndzLm9uKCdlcnJvcicsIChlcnJvcikgPT4ge1xyXG4gICAgICB0aGlzLmVtaXQoJ2RlYnVnJywgYFdlYlNvY2tldCBoYXRhc8SxOiAke2Vycm9yLm1lc3NhZ2V9YCk7XHJcbiAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCBlcnJvcik7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZSBpbmNvbWluZyBnYXRld2F5IG1lc3NhZ2VcclxuICAgKi9cclxuICBwcml2YXRlIGhhbmRsZU1lc3NhZ2UoZGF0YTogc3RyaW5nKTogdm9pZCB7XHJcbiAgICAvLyBIYW5kbGUgbXVsdGlwbGUgbWVzc2FnZXMgaW4gb25lIGZyYW1lXHJcbiAgICBjb25zdCBtZXNzYWdlcyA9IGRhdGEuc3BsaXQoJ1xcbicpLmZpbHRlcihtID0+IG0udHJpbSgpKTtcclxuICAgIFxyXG4gICAgZm9yIChjb25zdCBtc2cgb2YgbWVzc2FnZXMpIHtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBjb25zdCBwYXlsb2FkOiBHYXRld2F5UGF5bG9hZCA9IEpTT04ucGFyc2UobXNnKTtcclxuICAgICAgICB0aGlzLmhhbmRsZVBheWxvYWQocGF5bG9hZCk7XHJcbiAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICB0aGlzLmVtaXQoJ2RlYnVnJywgYEZhaWxlZCB0byBwYXJzZSBtZXNzYWdlOiAke21zZ31gKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSGFuZGxlIGdhdGV3YXkgcGF5bG9hZFxyXG4gICAqL1xyXG4gIHByaXZhdGUgaGFuZGxlUGF5bG9hZChwYXlsb2FkOiBHYXRld2F5UGF5bG9hZCk6IHZvaWQge1xyXG4gICAgaWYgKHBheWxvYWQucykge1xyXG4gICAgICB0aGlzLnNlcXVlbmNlID0gcGF5bG9hZC5zO1xyXG4gICAgfVxyXG5cclxuICAgIHN3aXRjaCAocGF5bG9hZC5vcCkge1xyXG4gICAgICBjYXNlIEdhdGV3YXlPcGNvZGVzLkhlbGxvOlxyXG4gICAgICAgIHRoaXMuaGFuZGxlSGVsbG8ocGF5bG9hZC5kKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSBHYXRld2F5T3Bjb2Rlcy5EaXNwYXRjaDpcclxuICAgICAgICB0aGlzLmhhbmRsZURpc3BhdGNoKHBheWxvYWQudCEsIHBheWxvYWQuZCk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgR2F0ZXdheU9wY29kZXMuSGVhcnRiZWF0QWNrOlxyXG4gICAgICAgIGlmICh0aGlzLl9sYXN0SGVhcnRiZWF0U2VudCA+IDApIHtcclxuICAgICAgICAgIHRoaXMucGluZyA9IERhdGUubm93KCkgLSB0aGlzLl9sYXN0SGVhcnRiZWF0U2VudDtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5lbWl0KCdkZWJ1ZycsIGBIZWFydGJlYXQgYWNrbm93bGVkZ2VkIChwaW5nOiAke3RoaXMucGluZ31tcylgKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSBHYXRld2F5T3Bjb2Rlcy5JbnZhbGlkU2Vzc2lvbjpcclxuICAgICAgICB0aGlzLmVtaXQoJ2RlYnVnJywgJ0dlw6dlcnNpeiBvdHVydW0sIHllbmlkZW4ga2ltbGlrIGRvxJ9ydWxhbsSxeW9yLi4uJyk7XHJcbiAgICAgICAgLy8gSW52YWxpZFNlc3Npb24gbWF5IGNhcnJ5IGVycm9yIGRhdGEgZnJvbSBzZW5kRXJyb3IoKVxyXG4gICAgICAgIGlmIChwYXlsb2FkLmQgJiYgdHlwZW9mIHBheWxvYWQuZCA9PT0gJ29iamVjdCcgJiYgcGF5bG9hZC5kLmNvZGUgJiYgcGF5bG9hZC5kLm1lc3NhZ2UpIHtcclxuICAgICAgICAgIHRoaXMuZW1pdCgnZGVidWcnLCBgU3VudWN1IGhhdGFzxLEgWyR7cGF5bG9hZC5kLmNvZGV9XTogJHtwYXlsb2FkLmQubWVzc2FnZX1gKTtcclxuICAgICAgICAgIGNvbnN0IGluZm8gPSBDbGllbnQuQ0xPU0VfQ09ERVNbcGF5bG9hZC5kLmNvZGVdO1xyXG4gICAgICAgICAgaWYgKGluZm8gJiYgIWluZm8ucmVjb25uZWN0YWJsZSkge1xyXG4gICAgICAgICAgICB0aGlzLmVtaXQoJ2Vycm9yJywgbmV3IEVycm9yKGBHYXRld2F5IGhhdGFzxLEgWyR7cGF5bG9hZC5kLmNvZGV9XTogJHtpbmZvLm1lc3NhZ2V9YCkpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4gdGhpcy5pZGVudGlmeSgpLCA1MDAwKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSBHYXRld2F5T3Bjb2Rlcy5SZWNvbm5lY3Q6XHJcbiAgICAgICAgdGhpcy5lbWl0KCdkZWJ1ZycsICdSZWNvbm5lY3QgcmVxdWVzdGVkJyk7XHJcbiAgICAgICAgdGhpcy53cz8uY2xvc2UoKTtcclxuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHRoaXMuY29ubmVjdCgpLCAxMDAwKTtcclxuICAgICAgICBicmVhaztcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZSBIZWxsbyBwYXlsb2FkXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBoYW5kbGVIZWxsbyhkYXRhOiB7IGhlYXJ0YmVhdF9pbnRlcnZhbDogbnVtYmVyIH0pOiB2b2lkIHtcclxuICAgIHRoaXMuZW1pdCgnZGVidWcnLCBgUmVjZWl2ZWQgSGVsbG8sIGhlYXJ0YmVhdCBpbnRlcnZhbDogJHtkYXRhLmhlYXJ0YmVhdF9pbnRlcnZhbH1tc2ApO1xyXG4gICAgdGhpcy5zdGFydEhlYXJ0YmVhdChkYXRhLmhlYXJ0YmVhdF9pbnRlcnZhbCk7XHJcbiAgICB0aGlzLmlkZW50aWZ5KCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBIYW5kbGUgRGlzcGF0Y2ggZXZlbnRzXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBoYW5kbGVEaXNwYXRjaChldmVudFR5cGU6IHN0cmluZywgZGF0YTogYW55KTogdm9pZCB7XHJcbiAgICB0aGlzLmVtaXQoJ2RlYnVnJywgYERpc3BhdGNoOiAke2V2ZW50VHlwZX1gKTtcclxuICAgIFxyXG4gICAgc3dpdGNoIChldmVudFR5cGUpIHtcclxuICAgICAgY2FzZSAnUkVBRFknOlxyXG4gICAgICAgIHRoaXMuaGFuZGxlUmVhZHkoZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ0dVSUxEX0NSRUFURSc6XHJcbiAgICAgICAgdGhpcy5oYW5kbGVHdWlsZENyZWF0ZShkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnR1VJTERfVVBEQVRFJzpcclxuICAgICAgICB0aGlzLmhhbmRsZUd1aWxkVXBkYXRlKGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdHVUlMRF9ERUxFVEUnOlxyXG4gICAgICAgIHRoaXMuaGFuZGxlR3VpbGREZWxldGUoZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ01FU1NBR0VfQ1JFQVRFJzpcclxuICAgICAgICB0aGlzLmhhbmRsZU1lc3NhZ2VDcmVhdGUoZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ01FU1NBR0VfVVBEQVRFJzpcclxuICAgICAgICB0aGlzLmVtaXQoJ21lc3NhZ2VVcGRhdGUnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnTUVTU0FHRV9ERUxFVEUnOlxyXG4gICAgICAgIHRoaXMuZW1pdCgnbWVzc2FnZURlbGV0ZScsIGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdNRVNTQUdFX0RFTEVURV9CVUxLJzpcclxuICAgICAgICB0aGlzLmVtaXQoJ21lc3NhZ2VEZWxldGVCdWxrJywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ01FU1NBR0VfUkVBQ1RJT05fQUREJzpcclxuICAgICAgICB0aGlzLmVtaXQoJ21lc3NhZ2VSZWFjdGlvbkFkZCcsIGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdNRVNTQUdFX1JFQUNUSU9OX1JFTU9WRSc6XHJcbiAgICAgICAgdGhpcy5lbWl0KCdtZXNzYWdlUmVhY3Rpb25SZW1vdmUnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnQ0hBTk5FTF9DUkVBVEUnOiB7XHJcbiAgICAgICAgLy8gVXBkYXRlIGd1aWxkIGNoYW5uZWwgY2FjaGVcclxuICAgICAgICBjb25zdCBndWlsZElkID0gZGF0YS5ndWlsZF9pZDtcclxuICAgICAgICBjb25zdCBjaGFubmVsSWQgPSBkYXRhLmlkIHx8IGRhdGEuY2hhbm5lbF9pZDtcclxuICAgICAgICBpZiAoZ3VpbGRJZCAmJiBjaGFubmVsSWQpIHtcclxuICAgICAgICAgIGNvbnN0IGd1aWxkID0gdGhpcy5ndWlsZHMuZ2V0KGd1aWxkSWQpO1xyXG4gICAgICAgICAgaWYgKGd1aWxkKSB7XHJcbiAgICAgICAgICAgIGd1aWxkLmNoYW5uZWxzLnNldChjaGFubmVsSWQsIGRhdGEpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmVtaXQoJ2NoYW5uZWxDcmVhdGUnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdDSEFOTkVMX1VQREFURSc6IHtcclxuICAgICAgICBjb25zdCBndWlsZElkID0gZGF0YS5ndWlsZF9pZDtcclxuICAgICAgICBjb25zdCBjaGFubmVsSWQgPSBkYXRhLmlkIHx8IGRhdGEuY2hhbm5lbF9pZDtcclxuICAgICAgICBpZiAoZ3VpbGRJZCAmJiBjaGFubmVsSWQpIHtcclxuICAgICAgICAgIGNvbnN0IGd1aWxkID0gdGhpcy5ndWlsZHMuZ2V0KGd1aWxkSWQpO1xyXG4gICAgICAgICAgaWYgKGd1aWxkKSB7XHJcbiAgICAgICAgICAgIGd1aWxkLmNoYW5uZWxzLnNldChjaGFubmVsSWQsIGRhdGEpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmVtaXQoJ2NoYW5uZWxVcGRhdGUnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdDSEFOTkVMX0RFTEVURSc6IHtcclxuICAgICAgICBjb25zdCBndWlsZElkID0gZGF0YS5ndWlsZF9pZDtcclxuICAgICAgICBjb25zdCBjaGFubmVsSWQgPSBkYXRhLmlkIHx8IGRhdGEuY2hhbm5lbF9pZDtcclxuICAgICAgICBpZiAoZ3VpbGRJZCAmJiBjaGFubmVsSWQpIHtcclxuICAgICAgICAgIGNvbnN0IGd1aWxkID0gdGhpcy5ndWlsZHMuZ2V0KGd1aWxkSWQpO1xyXG4gICAgICAgICAgaWYgKGd1aWxkKSB7XHJcbiAgICAgICAgICAgIGd1aWxkLmNoYW5uZWxzLmRlbGV0ZShjaGFubmVsSWQpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmVtaXQoJ2NoYW5uZWxEZWxldGUnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdHVUlMRF9NRU1CRVJfQUREJzoge1xyXG4gICAgICAgIGNvbnN0IGd1aWxkID0gdGhpcy5ndWlsZHMuZ2V0KFN0cmluZyhkYXRhLmd1aWxkX2lkKSk7XHJcbiAgICAgICAgaWYgKGd1aWxkICYmIGRhdGEudXNlcikge1xyXG4gICAgICAgICAgY29uc3QgbWVtYmVyID0gZ3VpbGQuX2FkZE1lbWJlcihkYXRhKTtcclxuICAgICAgICAgIHRoaXMuZW1pdCgnZ3VpbGRNZW1iZXJBZGQnLCBtZW1iZXIpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICB0aGlzLmVtaXQoJ2d1aWxkTWVtYmVyQWRkJywgZGF0YSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ0dVSUxEX01FTUJFUl9VUERBVEUnOiB7XHJcbiAgICAgICAgY29uc3QgZ3VpbGQgPSB0aGlzLmd1aWxkcy5nZXQoU3RyaW5nKGRhdGEuZ3VpbGRfaWQpKTtcclxuICAgICAgICBjb25zdCByYXdVc2VySWQgPSBkYXRhLnVzZXI/LmlkIHx8IGRhdGEudXNlcl9pZDtcclxuICAgICAgICBpZiAoZ3VpbGQgJiYgcmF3VXNlcklkKSB7XHJcbiAgICAgICAgICBjb25zdCBleGlzdGluZyA9IGd1aWxkLm1lbWJlcnMuZ2V0KFN0cmluZyhyYXdVc2VySWQpKTtcclxuICAgICAgICAgIGlmIChleGlzdGluZykge1xyXG4gICAgICAgICAgICBleGlzdGluZy5fcGF0Y2goZGF0YSk7XHJcbiAgICAgICAgICAgIHRoaXMuZW1pdCgnZ3VpbGRNZW1iZXJVcGRhdGUnLCBleGlzdGluZyk7XHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB0aGlzLmVtaXQoJ2d1aWxkTWVtYmVyVXBkYXRlJywgZGF0YSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIHRoaXMuZW1pdCgnZ3VpbGRNZW1iZXJVcGRhdGUnLCBkYXRhKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgY2FzZSAnR1VJTERfTUVNQkVSX1JFTU9WRSc6IHtcclxuICAgICAgICBjb25zdCBndWlsZCA9IHRoaXMuZ3VpbGRzLmdldChTdHJpbmcoZGF0YS5ndWlsZF9pZCkpO1xyXG4gICAgICAgIGNvbnN0IHJhd1VzZXJJZCA9IGRhdGEudXNlcj8uaWQgfHwgZGF0YS51c2VyX2lkO1xyXG4gICAgICAgIGlmIChndWlsZCAmJiByYXdVc2VySWQpIHtcclxuICAgICAgICAgIGNvbnN0IHVzZXJJZCA9IFN0cmluZyhyYXdVc2VySWQpO1xyXG4gICAgICAgICAgY29uc3QgbWVtYmVyID0gZ3VpbGQubWVtYmVycy5nZXQodXNlcklkKTtcclxuICAgICAgICAgIGd1aWxkLm1lbWJlcnMuZGVsZXRlKHVzZXJJZCk7XHJcbiAgICAgICAgICB0aGlzLmVtaXQoJ2d1aWxkTWVtYmVyUmVtb3ZlJywgbWVtYmVyIHx8IGRhdGEpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICB0aGlzLmVtaXQoJ2d1aWxkTWVtYmVyUmVtb3ZlJywgZGF0YSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ0dVSUxEX1JPTEVfQ1JFQVRFJzpcclxuICAgICAgICB0aGlzLmVtaXQoJ3JvbGVDcmVhdGUnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnR1VJTERfUk9MRV9VUERBVEUnOlxyXG4gICAgICAgIHRoaXMuZW1pdCgncm9sZVVwZGF0ZScsIGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdHVUlMRF9ST0xFX0RFTEVURSc6XHJcbiAgICAgICAgdGhpcy5lbWl0KCdyb2xlRGVsZXRlJywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ0dVSUxEX0JBTl9BREQnOlxyXG4gICAgICAgIHRoaXMuZW1pdCgnZ3VpbGRCYW5BZGQnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnR1VJTERfQkFOX1JFTU9WRSc6XHJcbiAgICAgICAgdGhpcy5lbWl0KCdndWlsZEJhblJlbW92ZScsIGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdJTlZJVEVfQ1JFQVRFJzpcclxuICAgICAgICB0aGlzLmVtaXQoJ2ludml0ZUNyZWF0ZScsIGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdJTlZJVEVfREVMRVRFJzpcclxuICAgICAgICB0aGlzLmVtaXQoJ2ludml0ZURlbGV0ZScsIGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdDSEFOTkVMX1BJTlNfVVBEQVRFJzpcclxuICAgICAgICB0aGlzLmVtaXQoJ2NoYW5uZWxQaW5zVXBkYXRlJywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ1RZUElOR19TVEFSVCc6XHJcbiAgICAgICAgdGhpcy5lbWl0KCd0eXBpbmdTdGFydCcsIGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdQUkVTRU5DRV9VUERBVEUnOiB7XHJcbiAgICAgICAgLy8gdXBkYXRlIGd1aWxkIG9ubGluZUNvdW50IGJhc2VkIG9uIHN0YXR1cyBjaGFuZ2VcclxuICAgICAgICBjb25zdCBndWlsZElkID0gZGF0YS5ndWlsZF9pZDtcclxuICAgICAgICBjb25zdCBzdGF0dXMgPSBkYXRhLnN0YXR1cztcclxuICAgICAgICBpZiAoZ3VpbGRJZCkge1xyXG4gICAgICAgICAgY29uc3QgZ3VpbGQgPSB0aGlzLmd1aWxkcy5nZXQoU3RyaW5nKGd1aWxkSWQpKTtcclxuICAgICAgICAgIGlmIChndWlsZCkge1xyXG4gICAgICAgICAgICBpZiAoc3RhdHVzID09PSAnb2ZmbGluZScpIHtcclxuICAgICAgICAgICAgICBndWlsZC5vbmxpbmVDb3VudCA9IE1hdGgubWF4KDAsIGd1aWxkLm9ubGluZUNvdW50IC0gMSk7XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoc3RhdHVzID09PSAnb25saW5lJyB8fCBzdGF0dXMgPT09ICdpZGxlJyB8fCBzdGF0dXMgPT09ICdkbmQnKSB7XHJcbiAgICAgICAgICAgICAgZ3VpbGQub25saW5lQ291bnQrKztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmVtaXQoJ3ByZXNlbmNlVXBkYXRlJywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgY2FzZSAnSU5URVJBQ1RJT05fQ1JFQVRFJzpcclxuICAgICAgICB0aGlzLmhhbmRsZUludGVyYWN0aW9uQ3JlYXRlKGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdWT0lDRV9TVEFURV9VUERBVEUnOlxyXG4gICAgICAgIHRoaXMuaGFuZGxlVm9pY2VTdGF0ZVVwZGF0ZShkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnVk9JQ0VfU0VSVkVSX1VQREFURSc6XHJcbiAgICAgICAgdGhpcy5oYW5kbGVWb2ljZVNlcnZlclVwZGF0ZShkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgZGVmYXVsdDpcclxuICAgICAgICAvLyBFbWl0IHJhdyBldmVudCBmb3IgdW5oYW5kbGVkIHR5cGVzXHJcbiAgICAgICAgdGhpcy5lbWl0KCdyYXcnLCB7IHQ6IGV2ZW50VHlwZSwgZDogZGF0YSB9KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZSBSZWFkeSBldmVudFxyXG4gICAqL1xyXG4gIHByaXZhdGUgaGFuZGxlUmVhZHkoZGF0YTogUmVhZHlFdmVudERhdGEpOiB2b2lkIHtcclxuICAgIHRoaXMuc2Vzc2lvbklkID0gZGF0YS5zZXNzaW9uX2lkO1xyXG4gICAgdGhpcy51c2VyID0gbmV3IFVzZXIoZGF0YS51c2VyKTtcclxuICAgIC8vIEhhbmRsZSBib3RoIHN0cmluZyBhbmQgbnVtYmVyIGFwcGxpY2F0aW9uIElEc1xyXG4gICAgdGhpcy5hcHBsaWNhdGlvbklkID0gZGF0YS5hcHBsaWNhdGlvbj8uaWQgPyBTdHJpbmcoZGF0YS5hcHBsaWNhdGlvbi5pZCkgOiBudWxsO1xyXG4gICAgaWYgKHRoaXMuYXBwbGljYXRpb25JZCkge1xyXG4gICAgICB0aGlzLnJlc3Quc2V0QXBwbGljYXRpb25JZCh0aGlzLmFwcGxpY2F0aW9uSWQpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvLyBJbml0aWFsaXplIGFwcGxpY2F0aW9uIG9iamVjdCB3aXRoIGNvbW1hbmRzIG1hbmFnZXJcclxuICAgIHRoaXMuYXBwbGljYXRpb24gPSB7XHJcbiAgICAgIGlkOiB0aGlzLmFwcGxpY2F0aW9uSWQsXHJcbiAgICAgIGNvbW1hbmRzOiBuZXcgQXBwbGljYXRpb25Db21tYW5kTWFuYWdlcih0aGlzLnJlc3QpLFxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgLy8gQ2FjaGUgZ3VpbGRzIChhcyB1bmF2YWlsYWJsZSBpbml0aWFsbHkpXHJcbiAgICBpZiAoZGF0YS5ndWlsZHMpIHtcclxuICAgICAgZm9yIChjb25zdCBndWlsZCBvZiBkYXRhLmd1aWxkcykge1xyXG4gICAgICAgIHRoaXMuZ3VpbGRzLnNldChTdHJpbmcoZ3VpbGQuaWQpLCBuZXcgR3VpbGQodGhpcywgZ3VpbGQpKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvLyBTZXR1cCB2b2ljZSBhZGFwdGVycyBmb3IgZWFjaCBndWlsZFxyXG4gICAgdGhpcy5zZXR1cFZvaWNlQWRhcHRlcnMoKTtcclxuICAgIFxyXG4gICAgdGhpcy5lbWl0KCdkZWJ1ZycsIGBCb3QgcmVhZHkhIFVzZXI6ICR7dGhpcy51c2VyLnVzZXJuYW1lfSAoJHt0aGlzLnVzZXIuaWR9KSwgQXBwOiAke3RoaXMuYXBwbGljYXRpb25JZH1gKTtcclxuICAgIHRoaXMuZW1pdCgncmVhZHknLCB0aGlzKTtcclxuXHJcbiAgICAvLyBTaWduYWwgc2hhcmQgbWFuYWdlciB0aGF0IHRoaXMgc2hhcmQgaXMgcmVhZHkgKGlmIHJ1bm5pbmcgYXMgYSBzaGFyZClcclxuICAgIGlmIChwcm9jZXNzLnNlbmQpIHtcclxuICAgICAgcHJvY2Vzcy5zZW5kKHsgX3JlYWR5OiB0cnVlIH0pO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2V0dXAgdm9pY2UgYWRhcHRlcnMgZm9yIGFsbCBndWlsZHNcclxuICAgKi9cclxuICBwcml2YXRlIHNldHVwVm9pY2VBZGFwdGVycygpOiB2b2lkIHtcclxuICAgIGZvciAoY29uc3QgW2d1aWxkSWRdIG9mIHRoaXMuZ3VpbGRzKSB7XHJcbiAgICAgIHRoaXMuY3JlYXRlVm9pY2VBZGFwdGVyKGd1aWxkSWQpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgdm9pY2UgYWRhcHRlciBmb3IgYSBndWlsZFxyXG4gICAqL1xyXG4gIHByaXZhdGUgY3JlYXRlVm9pY2VBZGFwdGVyKGd1aWxkSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMudm9pY2UuYWRhcHRlcnMuaGFzKGd1aWxkSWQpKSByZXR1cm47XHJcbiAgICBjb25zdCBhZGFwdGVyOiBWb2ljZUFkYXB0ZXJDcmVhdG9yID0gKG1ldGhvZHMpID0+IHtcclxuICAgICAgLy8gQSBndWlsZCBoYXMgb25lIGFjdGl2ZSBjb25uZWN0aW9uIHBlciBjbGllbnQuXHJcbiAgICAgIHRoaXMudm9pY2VEZXN0cm95SGFuZGxlcnMuZ2V0KGd1aWxkSWQpPy4oKTtcclxuICAgICAgdGhpcy52b2ljZURlc3Ryb3lIYW5kbGVycy5zZXQoZ3VpbGRJZCwgbWV0aG9kcy5kZXN0cm95KTtcclxuICAgICAgLy8gU3RvcmUgaGFuZGxlcnMgZm9yIHRoaXMgZ3VpbGRcclxuICAgICAgdGhpcy52b2ljZVN0YXRlSGFuZGxlcnMuc2V0KGd1aWxkSWQsIG1ldGhvZHMub25Wb2ljZVN0YXRlVXBkYXRlKTtcclxuICAgICAgdGhpcy52b2ljZVNlcnZlckhhbmRsZXJzLnNldChndWlsZElkLCBtZXRob2RzLm9uVm9pY2VTZXJ2ZXJVcGRhdGUpO1xyXG4gICAgICBcclxuICAgICAgcmV0dXJuIHtcclxuICAgICAgICBzZW5kUGF5bG9hZDogKHBheWxvYWQpID0+IHtcclxuICAgICAgICAgIGlmICh0aGlzLndzPy5yZWFkeVN0YXRlID09PSBXZWJTb2NrZXQuT1BFTikge1xyXG4gICAgICAgICAgICB0aGlzLndzLnNlbmQoSlNPTi5zdHJpbmdpZnkocGF5bG9hZCkpO1xyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGRlc3Ryb3k6ICgpID0+IHtcclxuICAgICAgICAgIGlmICh0aGlzLnZvaWNlRGVzdHJveUhhbmRsZXJzLmdldChndWlsZElkKSAhPT0gbWV0aG9kcy5kZXN0cm95KSByZXR1cm47XHJcbiAgICAgICAgICB0aGlzLnZvaWNlRGVzdHJveUhhbmRsZXJzLmRlbGV0ZShndWlsZElkKTtcclxuICAgICAgICAgIHRoaXMudm9pY2VTdGF0ZUhhbmRsZXJzLmRlbGV0ZShndWlsZElkKTtcclxuICAgICAgICAgIHRoaXMudm9pY2VTZXJ2ZXJIYW5kbGVycy5kZWxldGUoZ3VpbGRJZCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9O1xyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy52b2ljZS5hZGFwdGVycy5zZXQoZ3VpbGRJZCwgYWRhcHRlcik7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBIYW5kbGUgR3VpbGQgQ3JlYXRlIGV2ZW50XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBoYW5kbGVHdWlsZENyZWF0ZShkYXRhOiBBUElHdWlsZCk6IHZvaWQge1xyXG4gICAgbGV0IGd1aWxkID0gdGhpcy5ndWlsZHMuZ2V0KGRhdGEuaWQpO1xyXG4gICAgXHJcbiAgICBpZiAoZ3VpbGQpIHtcclxuICAgICAgZ3VpbGQuX3BhdGNoKGRhdGEpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgZ3VpbGQgPSBuZXcgR3VpbGQodGhpcywgZGF0YSk7XHJcbiAgICAgIHRoaXMuZ3VpbGRzLnNldChkYXRhLmlkLCBndWlsZCk7XHJcbiAgICAgIHRoaXMuY3JlYXRlVm9pY2VBZGFwdGVyKGRhdGEuaWQpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICB0aGlzLmVtaXQoJ2d1aWxkQ3JlYXRlJywgZ3VpbGQpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSGFuZGxlIEd1aWxkIFVwZGF0ZSBldmVudFxyXG4gICAqL1xyXG4gIHByaXZhdGUgaGFuZGxlR3VpbGRVcGRhdGUoZGF0YTogQVBJR3VpbGQpOiB2b2lkIHtcclxuICAgIGNvbnN0IGd1aWxkID0gdGhpcy5ndWlsZHMuZ2V0KGRhdGEuaWQpO1xyXG4gICAgaWYgKGd1aWxkKSB7XHJcbiAgICAgIGd1aWxkLl9wYXRjaChkYXRhKTtcclxuICAgICAgdGhpcy5lbWl0KCdndWlsZFVwZGF0ZScsIGd1aWxkKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZSBHdWlsZCBEZWxldGUgZXZlbnRcclxuICAgKi9cclxuICBwcml2YXRlIGhhbmRsZUd1aWxkRGVsZXRlKGRhdGE6IHsgaWQ6IHN0cmluZyB9KTogdm9pZCB7XHJcbiAgICBjb25zdCBndWlsZCA9IHRoaXMuZ3VpbGRzLmdldChkYXRhLmlkKTtcclxuICAgIGlmIChndWlsZCkge1xyXG4gICAgICB0aGlzLmd1aWxkcy5kZWxldGUoZGF0YS5pZCk7XHJcbiAgICAgIHRoaXMudm9pY2VEZXN0cm95SGFuZGxlcnMuZ2V0KGRhdGEuaWQpPy4oKTtcclxuICAgICAgdGhpcy52b2ljZS5hZGFwdGVycy5kZWxldGUoZGF0YS5pZCk7XHJcbiAgICAgIHRoaXMuZW1pdCgnZ3VpbGREZWxldGUnLCBndWlsZCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBIYW5kbGUgTWVzc2FnZSBDcmVhdGUgZXZlbnRcclxuICAgKi9cclxuICBwcml2YXRlIGhhbmRsZU1lc3NhZ2VDcmVhdGUoZGF0YTogQVBJTWVzc2FnZSk6IHZvaWQge1xyXG4gICAgLy8gQmFja2VuZCBzZW5kcyB1c2VyX2lkIHNlcGFyYXRlbHksIG1hcCBpdCB0byBhdXRob3IuaWQgZm9yIGNvbXBhdGliaWxpdHlcclxuICAgIGlmIChkYXRhLnVzZXJfaWQgJiYgZGF0YS5hdXRob3IgJiYgIWRhdGEuYXV0aG9yLmlkKSB7XHJcbiAgICAgIChkYXRhLmF1dGhvciBhcyBhbnkpLmlkID0gZGF0YS51c2VyX2lkO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvLyBDYWNoZSB0aGUgYXV0aG9yXHJcbiAgICBpZiAoZGF0YS5hdXRob3IpIHtcclxuICAgICAgY29uc3QgdXNlciA9IG5ldyBVc2VyKGRhdGEuYXV0aG9yKTtcclxuICAgICAgdGhpcy51c2Vycy5zZXQodXNlci5pZCwgdXNlcik7XHJcbiAgICAgIC8vIEFsc28gY2FjaGUgaW4gUkVTVCBmb3IgbWVudGlvbiByZXNvbHV0aW9uXHJcbiAgICAgIHRoaXMucmVzdC5jYWNoZVVzZXIoZGF0YS5hdXRob3IpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBjb25zdCBtZXNzYWdlID0gbmV3IE1lc3NhZ2UodGhpcywgZGF0YSk7XHJcblxyXG4gICAgLy8gTWFyayBtZXNzYWdlIGFzIGZyb20gYm90IGlmIGF1dGhvciBJRCBtYXRjaGVzIHRoZSBib3QncyBvd24gdXNlciBJRFxyXG4gICAgaWYgKHRoaXMudXNlciAmJiBTdHJpbmcobWVzc2FnZS5hdXRob3IuaWQpID09PSBTdHJpbmcodGhpcy51c2VyLmlkKSkge1xyXG4gICAgICAobWVzc2FnZS5hdXRob3IgYXMgYW55KS5ib3QgPSB0cnVlO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIFJlc29sdmUgZ3VpbGQgbWVtYmVyIGlmIGluIGEgZ3VpbGRcclxuICAgIGlmIChtZXNzYWdlLmd1aWxkSWQpIHtcclxuICAgICAgY29uc3QgZ3VpbGQgPSB0aGlzLmd1aWxkcy5nZXQobWVzc2FnZS5ndWlsZElkKTtcclxuICAgICAgY29uc3QgbWVtYmVyRGF0YSA9IChkYXRhIGFzIGFueSkubWVtYmVyO1xyXG4gICAgICBpZiAobWVtYmVyRGF0YSAmJiBndWlsZCkge1xyXG4gICAgICAgIC8vIEdhdGV3YXkgc2VudCBtZW1iZXIgZGF0YSB3aXRoIHRoZSBtZXNzYWdlIOKAlCBjYWNoZSBpdFxyXG4gICAgICAgIC8vIF9hZGRNZW1iZXIgcHJlc2VydmVzIHZvaWNlIHN0YXRlIGZyb20gZXhpc3RpbmcgY2FjaGUgYXV0b21hdGljYWxseVxyXG4gICAgICAgIG1lbWJlckRhdGEudXNlciA9IGRhdGEuYXV0aG9yO1xyXG4gICAgICAgIGNvbnN0IG1lbWJlciA9IGd1aWxkLl9hZGRNZW1iZXIobWVtYmVyRGF0YSk7XHJcbiAgICAgICAgbWVzc2FnZS5tZW1iZXIgPSBtZW1iZXI7XHJcbiAgICAgIH0gZWxzZSBpZiAobWVtYmVyRGF0YSkge1xyXG4gICAgICAgIC8vIE5vIGd1aWxkIGluIGNhY2hlIGJ1dCBtZW1iZXIgZGF0YSBleGlzdHNcclxuICAgICAgICBtZW1iZXJEYXRhLnVzZXIgPSBkYXRhLmF1dGhvcjtcclxuICAgICAgICBjb25zdCByZXNvbHZlZEd1aWxkID0geyBpZDogbWVzc2FnZS5ndWlsZElkLCBvd25lcklkOiBudWxsLCBtZW1iZXJzOiBuZXcgQ29sbGVjdGlvbigpLCBjaGFubmVsczogbmV3IENvbGxlY3Rpb24oKSB9IGFzIGFueTtcclxuICAgICAgICBtZXNzYWdlLm1lbWJlciA9IG5ldyAocmVxdWlyZSgnLi9zdHJ1Y3R1cmVzL0d1aWxkTWVtYmVyJykuR3VpbGRNZW1iZXIpKHRoaXMsIHJlc29sdmVkR3VpbGQsIG1lbWJlckRhdGEpO1xyXG4gICAgICB9IGVsc2UgaWYgKGd1aWxkKSB7XHJcbiAgICAgICAgLy8gTm8gbWVtYmVyIGRhdGEgZnJvbSBnYXRld2F5IOKAlCB1c2UgY2FjaGVkIG1lbWJlciAobWF5IGhhdmUgdm9pY2Ugc3RhdGUgZnJvbSBWT0lDRV9TVEFURV9VUERBVEUpXHJcbiAgICAgICAgY29uc3QgY2FjaGVkID0gZ3VpbGQubWVtYmVycz8uZ2V0KFN0cmluZyhtZXNzYWdlLmF1dGhvci5pZCkpO1xyXG4gICAgICAgIGlmIChjYWNoZWQpIHtcclxuICAgICAgICAgIG1lc3NhZ2UubWVtYmVyID0gY2FjaGVkO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuZW1pdCgnbWVzc2FnZUNyZWF0ZScsIG1lc3NhZ2UpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSGFuZGxlIEludGVyYWN0aW9uIENyZWF0ZSBldmVudFxyXG4gICAqL1xyXG4gIHByaXZhdGUgaGFuZGxlSW50ZXJhY3Rpb25DcmVhdGUoZGF0YTogQVBJSW50ZXJhY3Rpb24pOiB2b2lkIHtcclxuICAgIGlmIChwcm9jZXNzLmVudi5ERUJVR19DTElFTlQpIHtcclxuICAgICAgY29uc29sZS5sb2coJ1tERUJVR10gaGFuZGxlSW50ZXJhY3Rpb25DcmVhdGUgY2FsbGVkIHdpdGg6JywgSlNPTi5zdHJpbmdpZnkoZGF0YSwgbnVsbCwgMikpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICB0cnkge1xyXG4gICAgICAvLyBDYWNoZSB0aGUgdXNlclxyXG4gICAgICBjb25zdCB1c2VyRGF0YSA9IGRhdGEubWVtYmVyPy51c2VyIHx8IGRhdGEudXNlcjtcclxuICAgICAgaWYgKHVzZXJEYXRhKSB7XHJcbiAgICAgICAgY29uc3QgdXNlciA9IG5ldyBVc2VyKHVzZXJEYXRhKTtcclxuICAgICAgICB0aGlzLnVzZXJzLnNldCh1c2VyLmlkLCB1c2VyKTtcclxuICAgICAgICB0aGlzLnJlc3QuY2FjaGVVc2VyKHVzZXJEYXRhKTtcclxuICAgICAgfVxyXG4gICAgICBcclxuICAgICAgY29uc3QgaW50ZXJhY3Rpb24gPSBjcmVhdGVJbnRlcmFjdGlvbih0aGlzLCBkYXRhKTtcclxuICAgICAgaWYgKHByb2Nlc3MuZW52LkRFQlVHX0NMSUVOVCkge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKCdbREVCVUddIENyZWF0ZWQgaW50ZXJhY3Rpb24gdHlwZTonLCBpbnRlcmFjdGlvbi5jb25zdHJ1Y3Rvci5uYW1lLCAnY3VzdG9tSWQ6JywgKGludGVyYWN0aW9uIGFzIGFueSkuY3VzdG9tSWQpO1xyXG4gICAgICB9XHJcbiAgICAgIHRoaXMuZW1pdCgnaW50ZXJhY3Rpb25DcmVhdGUnLCBpbnRlcmFjdGlvbik7XHJcbiAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgY29uc29sZS5lcnJvcignW0VSUk9SXSBoYW5kbGVJbnRlcmFjdGlvbkNyZWF0ZSBjcmFzaGVkOicsIGVycik7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBIYW5kbGUgVm9pY2UgU3RhdGUgVXBkYXRlIGV2ZW50XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBoYW5kbGVWb2ljZVN0YXRlVXBkYXRlKGRhdGE6IGFueSk6IHZvaWQge1xyXG4gICAgY29uc3QgZ3VpbGRJZCA9IGRhdGEuZ3VpbGRfaWQ7XHJcbiAgICBjb25zdCB1c2VySWQgPSBkYXRhLnVzZXJfaWQ7XHJcbiAgICBcclxuICAgIC8vIFVwZGF0ZSBtZW1iZXIgdm9pY2Ugc3RhdGUgaW4gY2FjaGVcclxuICAgIGlmIChndWlsZElkICYmIHVzZXJJZCkge1xyXG4gICAgICBjb25zdCBndWlsZCA9IHRoaXMuZ3VpbGRzLmdldChTdHJpbmcoZ3VpbGRJZCkpO1xyXG4gICAgICBpZiAoZ3VpbGQpIHtcclxuICAgICAgICBjb25zdCB1c2VySWRTdHIgPSBTdHJpbmcodXNlcklkKTtcclxuICAgICAgICBsZXQgbWVtYmVyID0gZ3VpbGQubWVtYmVycy5nZXQodXNlcklkU3RyKTtcclxuICAgICAgICBcclxuICAgICAgICBpZiAoIW1lbWJlciAmJiBkYXRhLnVzZXIpIHtcclxuICAgICAgICAgIC8vIE1lbWJlciBub3QgaW4gY2FjaGUgeWV0IOKAlCBjcmVhdGUgYSBtaW5pbWFsIGVudHJ5IGZyb20gdm9pY2Ugc3RhdGUgZGF0YVxyXG4gICAgICAgICAgbWVtYmVyID0gZ3VpbGQuX2FkZE1lbWJlcih7XHJcbiAgICAgICAgICAgIHVzZXI6IGRhdGEudXNlcixcclxuICAgICAgICAgICAgcm9sZXM6IFtdLFxyXG4gICAgICAgICAgICBqb2luZWRfYXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICBpZiAobWVtYmVyKSB7XHJcbiAgICAgICAgICBtZW1iZXIudm9pY2UgPSB7XHJcbiAgICAgICAgICAgIGNoYW5uZWxJZDogZGF0YS5jaGFubmVsX2lkID8/IHVuZGVmaW5lZCxcclxuICAgICAgICAgICAgc2VsZk11dGU6IGRhdGEuc2VsZl9tdXRlID8/IGZhbHNlLFxyXG4gICAgICAgICAgICBzZWxmRGVhZjogZGF0YS5zZWxmX2RlYWYgPz8gZmFsc2UsXHJcbiAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvLyBGb3J3YXJkIHRvIHZvaWNlIGFkYXB0ZXIgaWYgZXhpc3RzXHJcbiAgICBjb25zdCBoYW5kbGVyID0gdGhpcy52b2ljZVN0YXRlSGFuZGxlcnMuZ2V0KFN0cmluZyhndWlsZElkKSk7XHJcbiAgICBpZiAoaGFuZGxlciAmJiB0aGlzLnVzZXIgJiYgU3RyaW5nKHVzZXJJZCkgPT09IFN0cmluZyh0aGlzLnVzZXIuaWQpKSB7XHJcbiAgICAgIGhhbmRsZXIoZGF0YSk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHRoaXMuZW1pdCgndm9pY2VTdGF0ZVVwZGF0ZScsIGRhdGEpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSGFuZGxlIFZvaWNlIFNlcnZlciBVcGRhdGUgZXZlbnRcclxuICAgKi9cclxuICBwcml2YXRlIGhhbmRsZVZvaWNlU2VydmVyVXBkYXRlKGRhdGE6IEFQSVZvaWNlU2VydmVyVXBkYXRlKTogdm9pZCB7XHJcbiAgICBjb25zdCBndWlsZElkID0gZGF0YS5ndWlsZF9pZDtcclxuICAgIFxyXG4gICAgLy8gRm9yd2FyZCB0byB2b2ljZSBhZGFwdGVyIGlmIGV4aXN0c1xyXG4gICAgY29uc3QgaGFuZGxlciA9IHRoaXMudm9pY2VTZXJ2ZXJIYW5kbGVycy5nZXQoU3RyaW5nKGd1aWxkSWQpKTtcclxuICAgIGlmIChoYW5kbGVyKSB7XHJcbiAgICAgIGhhbmRsZXIoe1xyXG4gICAgICAgIHRva2VuOiBkYXRhLnRva2VuLFxyXG4gICAgICAgIGVuZHBvaW50OiBkYXRhLmVuZHBvaW50LFxyXG4gICAgICAgIHJvb206IGRhdGEucm9vbVxyXG4gICAgICB9KTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgdGhpcy5lbWl0KCd2b2ljZVNlcnZlclVwZGF0ZScsIGRhdGEpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2VuZCBJZGVudGlmeSBwYXlsb2FkXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBpZGVudGlmeSgpOiB2b2lkIHtcclxuICAgIGNvbnN0IHBheWxvYWQ6IEdhdGV3YXlQYXlsb2FkID0ge1xyXG4gICAgICBvcDogR2F0ZXdheU9wY29kZXMuSWRlbnRpZnksXHJcbiAgICAgIGQ6IHtcclxuICAgICAgICB0b2tlbjogYEJvdCAke3RoaXMudG9rZW59YCxcclxuICAgICAgICBpbnRlbnRzOiB0aGlzLmdldEludGVudHNWYWx1ZSgpLFxyXG4gICAgICAgIHNoYXJkOiB0aGlzLm9wdGlvbnMuc2hhcmRzIHx8IFswLCAxXVxyXG4gICAgICB9XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICB0aGlzLnNlbmQocGF5bG9hZCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTdGFydCBoZWFydGJlYXRcclxuICAgKi9cclxuICBwcml2YXRlIHN0YXJ0SGVhcnRiZWF0KGludGVydmFsOiBudW1iZXIpOiB2b2lkIHtcclxuICAgIHRoaXMuaGVhcnRiZWF0SW50ZXJ2YWwgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XHJcbiAgICAgIHRoaXMuX2xhc3RIZWFydGJlYXRTZW50ID0gRGF0ZS5ub3coKTtcclxuICAgICAgdGhpcy5zZW5kKHtcclxuICAgICAgICBvcDogR2F0ZXdheU9wY29kZXMuSGVhcnRiZWF0LFxyXG4gICAgICAgIGQ6IHRoaXMuc2VxdWVuY2VcclxuICAgICAgfSk7XHJcbiAgICB9LCBpbnRlcnZhbCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZW5kIHBheWxvYWQgdG8gZ2F0ZXdheVxyXG4gICAqL1xyXG4gIHByaXZhdGUgc2VuZChwYXlsb2FkOiBHYXRld2F5UGF5bG9hZCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMud3M/LnJlYWR5U3RhdGUgPT09IFdlYlNvY2tldC5PUEVOKSB7XHJcbiAgICAgIHRoaXMud3Muc2VuZChKU09OLnN0cmluZ2lmeShwYXlsb2FkKSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDbGVhbnVwIG9uIGRpc2Nvbm5lY3RcclxuICAgKi9cclxuICBwcml2YXRlIGNsZWFudXAoKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy5oZWFydGJlYXRJbnRlcnZhbCkge1xyXG4gICAgICBjbGVhckludGVydmFsKHRoaXMuaGVhcnRiZWF0SW50ZXJ2YWwpO1xyXG4gICAgICB0aGlzLmhlYXJ0YmVhdEludGVydmFsID0gbnVsbDtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlc3Ryb3kgdGhlIGNsaWVudFxyXG4gICAqL1xyXG4gIGRlc3Ryb3koKTogdm9pZCB7XHJcbiAgICBmb3IgKGNvbnN0IGRlc3Ryb3kgb2YgWy4uLnRoaXMudm9pY2VEZXN0cm95SGFuZGxlcnMudmFsdWVzKCldKSBkZXN0cm95KCk7XHJcbiAgICB0aGlzLnZvaWNlRGVzdHJveUhhbmRsZXJzLmNsZWFyKCk7XHJcbiAgICB0aGlzLnZvaWNlU3RhdGVIYW5kbGVycy5jbGVhcigpO1xyXG4gICAgdGhpcy52b2ljZVNlcnZlckhhbmRsZXJzLmNsZWFyKCk7XHJcbiAgICB0aGlzLnZvaWNlLmFkYXB0ZXJzLmNsZWFyKCk7XHJcbiAgICB0aGlzLl9sb2dpblN0YXRlID0gJ2lkbGUnO1xyXG4gICAgdGhpcy5fcmVjb25uZWN0QXR0ZW1wdHMgPSB0aGlzLl9tYXhSZWNvbm5lY3RBdHRlbXB0cyArIDE7IC8vIFByZXZlbnQgcmVjb25uZWN0XHJcbiAgICB0aGlzLmNsZWFudXAoKTtcclxuICAgIHRoaXMud3M/LmNsb3NlKDEwMDApO1xyXG4gICAgdGhpcy53cyA9IG51bGw7XHJcbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygpO1xyXG4gIH1cclxufVxyXG5cclxuLy8gUmUtZXhwb3J0IGZvciBjb252ZW5pZW5jZVxyXG5leHBvcnQgeyBHYXRld2F5SW50ZW50Qml0cyB9O1xyXG4iXX0=