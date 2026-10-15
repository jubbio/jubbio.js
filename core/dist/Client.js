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
                // ponytail: update guild onlineCount based on status change
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ2xpZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL0NsaWVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxtQ0FBc0M7QUFDdEMsNENBQTJCO0FBWTNCLG1DQUE0RDtBQXkyQm5ELGtHQXoyQmdCLHlCQUFpQixPQXkyQmhCO0FBeDJCMUIsbURBQWdEO0FBQ2hELDRDQUF5QztBQUN6Qyw4Q0FBMkM7QUFDM0Msa0RBQStDO0FBQy9DLDBEQUEwRTtBQUUxRSxzQ0FBbUM7QUFDbkMsb0ZBQWlGO0FBY2pGOztHQUVHO0FBQ0gsTUFBYSxNQUFPLFNBQVEscUJBQVk7SUFDdEMscUJBQXFCO0lBQ0wsT0FBTyxDQUFnQjtJQUV2QyxzQkFBc0I7SUFDTixJQUFJLENBQU87SUFFM0IsbUJBQW1CO0lBQ1osSUFBSSxHQUFnQixJQUFJLENBQUM7SUFFaEMscUJBQXFCO0lBQ2QsYUFBYSxHQUFrQixJQUFJLENBQUM7SUFFM0MsdUVBQXVFO0lBQ2hFLFdBQVcsR0FHUCxJQUFJLENBQUM7SUFFaEIsb0JBQW9CO0lBQ2IsTUFBTSxHQUE4QixJQUFJLHVCQUFVLEVBQUUsQ0FBQztJQUU1RCxzQkFBc0I7SUFDZixRQUFRLEdBQW9DLElBQUksdUJBQVUsRUFBRSxDQUFDO0lBRXBFLG1CQUFtQjtJQUNaLEtBQUssR0FBNkIsSUFBSSx1QkFBVSxFQUFFLENBQUM7SUFFMUQsK0JBQStCO0lBQ3hCLEtBQUssQ0FFVjtJQUVGLDJCQUEyQjtJQUNuQixFQUFFLEdBQXFCLElBQUksQ0FBQztJQUVwQyxnQkFBZ0I7SUFDUixLQUFLLEdBQVcsRUFBRSxDQUFDO0lBRTNCLGlCQUFpQjtJQUNULFNBQVMsR0FBa0IsSUFBSSxDQUFDO0lBRXhDLHNCQUFzQjtJQUNkLFFBQVEsR0FBa0IsSUFBSSxDQUFDO0lBRXZDLHlCQUF5QjtJQUNqQixpQkFBaUIsR0FBMEIsSUFBSSxDQUFDO0lBRXhELGtCQUFrQjtJQUNWLFVBQVUsQ0FBUztJQUUzQiwyREFBMkQ7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SSxDQUFDLGlCQUFpQixFQUFFLENBQUM7WUFDM0IsYUFBYSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1lBQ3RDLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLENBQUM7UUFDaEMsQ0FBQztJQUNILENBQUM7SUFFRDs7T0FFRztJQUNILE9BQU87UUFDTCxJQUFJLENBQUMsV0FBVyxHQUFHLE1BQU0sQ0FBQztRQUMxQixJQUFJLENBQUMsa0JBQWtCLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixHQUFHLENBQUMsQ0FBQyxDQUFDLG9CQUFvQjtRQUM5RSxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDZixJQUFJLENBQUMsRUFBRSxFQUFFLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNyQixJQUFJLENBQUMsRUFBRSxHQUFHLElBQUksQ0FBQztRQUNmLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO0lBQzVCLENBQUM7O0FBNTBCSCx3QkE2MEJDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgRXZlbnRFbWl0dGVyIH0gZnJvbSAnZXZlbnRzJztcclxuaW1wb3J0IFdlYlNvY2tldCBmcm9tICd3cyc7XHJcbmltcG9ydCB7IFxyXG4gIENsaWVudE9wdGlvbnMsIFxyXG4gIEdhdGV3YXlQYXlsb2FkLCBcclxuICBSZWFkeUV2ZW50RGF0YSxcclxuICBBUElHdWlsZCxcclxuICBBUElJbnRlcmFjdGlvbixcclxuICBBUElNZXNzYWdlLFxyXG4gIEFQSVZvaWNlU2VydmVyVXBkYXRlLFxyXG4gIEFQSUNoYW5uZWwsXHJcbiAgQVBJVXNlclxyXG59IGZyb20gJy4vdHlwZXMnO1xyXG5pbXBvcnQgeyBHYXRld2F5T3Bjb2RlcywgR2F0ZXdheUludGVudEJpdHMgfSBmcm9tICcuL2VudW1zJztcclxuaW1wb3J0IHsgQ29sbGVjdGlvbiB9IGZyb20gJy4vdXRpbHMvQ29sbGVjdGlvbic7XHJcbmltcG9ydCB7IFVzZXIgfSBmcm9tICcuL3N0cnVjdHVyZXMvVXNlcic7XHJcbmltcG9ydCB7IEd1aWxkIH0gZnJvbSAnLi9zdHJ1Y3R1cmVzL0d1aWxkJztcclxuaW1wb3J0IHsgTWVzc2FnZSB9IGZyb20gJy4vc3RydWN0dXJlcy9NZXNzYWdlJztcclxuaW1wb3J0IHsgY3JlYXRlSW50ZXJhY3Rpb24sIEludGVyYWN0aW9uIH0gZnJvbSAnLi9zdHJ1Y3R1cmVzL0ludGVyYWN0aW9uJztcclxuaW1wb3J0IHsgQmFzZUNoYW5uZWwsIGNyZWF0ZUNoYW5uZWwgfSBmcm9tICcuL3N0cnVjdHVyZXMvQ2hhbm5lbCc7XHJcbmltcG9ydCB7IFJFU1QgfSBmcm9tICcuL3Jlc3QvUkVTVCc7XHJcbmltcG9ydCB7IEFwcGxpY2F0aW9uQ29tbWFuZE1hbmFnZXIgfSBmcm9tICcuL21hbmFnZXJzL0FwcGxpY2F0aW9uQ29tbWFuZE1hbmFnZXInO1xyXG5cclxuLyoqXHJcbiAqIFZvaWNlIGFkYXB0ZXIgY3JlYXRvciB0eXBlIGZvciBAanViYmlvL3ZvaWNlIGNvbXBhdGliaWxpdHlcclxuICovXHJcbnR5cGUgVm9pY2VBZGFwdGVyQ3JlYXRvciA9IChtZXRob2RzOiB7XHJcbiAgb25Wb2ljZVNlcnZlclVwZGF0ZShkYXRhOiBhbnkpOiB2b2lkO1xyXG4gIG9uVm9pY2VTdGF0ZVVwZGF0ZShkYXRhOiBhbnkpOiB2b2lkO1xyXG4gIGRlc3Ryb3koKTogdm9pZDtcclxufSkgPT4ge1xyXG4gIHNlbmRQYXlsb2FkKHBheWxvYWQ6IGFueSk6IGJvb2xlYW47XHJcbiAgZGVzdHJveSgpOiB2b2lkO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIE1haW4gY2xpZW50IGNsYXNzXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgQ2xpZW50IGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcclxuICAvKiogQ2xpZW50IG9wdGlvbnMgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgb3B0aW9uczogQ2xpZW50T3B0aW9ucztcclxuICBcclxuICAvKiogUkVTVCBBUEkgY2xpZW50ICovXHJcbiAgcHVibGljIHJlYWRvbmx5IHJlc3Q6IFJFU1Q7XHJcbiAgXHJcbiAgLyoqIFRoZSBib3QgdXNlciAqL1xyXG4gIHB1YmxpYyB1c2VyOiBVc2VyIHwgbnVsbCA9IG51bGw7XHJcbiAgXHJcbiAgLyoqIEFwcGxpY2F0aW9uIElEICovXHJcbiAgcHVibGljIGFwcGxpY2F0aW9uSWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xyXG4gIFxyXG4gIC8qKiBBcHBsaWNhdGlvbiBvYmplY3Qgd2l0aCBjb21tYW5kcyBtYW5hZ2VyIChEaXNjb3JkLmpzIGNvbXBhdGlibGUpICovXHJcbiAgcHVibGljIGFwcGxpY2F0aW9uOiB7XHJcbiAgICBpZDogc3RyaW5nIHwgbnVsbDtcclxuICAgIGNvbW1hbmRzOiBBcHBsaWNhdGlvbkNvbW1hbmRNYW5hZ2VyO1xyXG4gIH0gfCBudWxsID0gbnVsbDtcclxuICBcclxuICAvKiogQ2FjaGVkIGd1aWxkcyAqL1xyXG4gIHB1YmxpYyBndWlsZHM6IENvbGxlY3Rpb248c3RyaW5nLCBHdWlsZD4gPSBuZXcgQ29sbGVjdGlvbigpO1xyXG4gIFxyXG4gIC8qKiBDYWNoZWQgY2hhbm5lbHMgKi9cclxuICBwdWJsaWMgY2hhbm5lbHM6IENvbGxlY3Rpb248c3RyaW5nLCBCYXNlQ2hhbm5lbD4gPSBuZXcgQ29sbGVjdGlvbigpO1xyXG4gIFxyXG4gIC8qKiBDYWNoZWQgdXNlcnMgKi9cclxuICBwdWJsaWMgdXNlcnM6IENvbGxlY3Rpb248c3RyaW5nLCBVc2VyPiA9IG5ldyBDb2xsZWN0aW9uKCk7XHJcbiAgXHJcbiAgLyoqIFZvaWNlIGFkYXB0ZXIgbWFuYWdlbWVudCAqL1xyXG4gIHB1YmxpYyB2b2ljZToge1xyXG4gICAgYWRhcHRlcnM6IE1hcDxzdHJpbmcsIFZvaWNlQWRhcHRlckNyZWF0b3I+O1xyXG4gIH07XHJcbiAgXHJcbiAgLyoqIFdlYlNvY2tldCBjb25uZWN0aW9uICovXHJcbiAgcHJpdmF0ZSB3czogV2ViU29ja2V0IHwgbnVsbCA9IG51bGw7XHJcbiAgXHJcbiAgLyoqIEJvdCB0b2tlbiAqL1xyXG4gIHByaXZhdGUgdG9rZW46IHN0cmluZyA9ICcnO1xyXG4gIFxyXG4gIC8qKiBTZXNzaW9uIElEICovXHJcbiAgcHJpdmF0ZSBzZXNzaW9uSWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xyXG4gIFxyXG4gIC8qKiBTZXF1ZW5jZSBudW1iZXIgKi9cclxuICBwcml2YXRlIHNlcXVlbmNlOiBudW1iZXIgfCBudWxsID0gbnVsbDtcclxuICBcclxuICAvKiogSGVhcnRiZWF0IGludGVydmFsICovXHJcbiAgcHJpdmF0ZSBoZWFydGJlYXRJbnRlcnZhbDogTm9kZUpTLlRpbWVvdXQgfCBudWxsID0gbnVsbDtcclxuICBcclxuICAvKiogR2F0ZXdheSBVUkwgKi9cclxuICBwcml2YXRlIGdhdGV3YXlVcmw6IHN0cmluZztcclxuXHJcbiAgLyoqIExhc3QgaGVhcnRiZWF0IHNlbnQgdGltZXN0YW1wIChmb3IgcGluZyBjYWxjdWxhdGlvbikgKi9cclxuICBwcml2YXRlIF9sYXN0SGVhcnRiZWF0U2VudDogbnVtYmVyID0gMDtcclxuXHJcbiAgLyoqIFdlYlNvY2tldCBwaW5nIChyb3VuZC10cmlwIGxhdGVuY3kgaW4gbXMpICovXHJcbiAgcHVibGljIHBpbmc6IG51bWJlciA9IC0xO1xyXG4gIFxyXG4gIC8qKiBWb2ljZSBzdGF0ZSB1cGRhdGUgaGFuZGxlcnMgKGZvciB2b2ljZSBhZGFwdGVycykgKi9cclxuICBwcml2YXRlIHZvaWNlU3RhdGVIYW5kbGVyczogTWFwPHN0cmluZywgKGRhdGE6IGFueSkgPT4gdm9pZD4gPSBuZXcgTWFwKCk7XHJcbiAgcHJpdmF0ZSB2b2ljZVNlcnZlckhhbmRsZXJzOiBNYXA8c3RyaW5nLCAoZGF0YTogYW55KSA9PiB2b2lkPiA9IG5ldyBNYXAoKTtcclxuXHJcbiAgLyoqIFdoZXRoZXIgdGhlIGNsaWVudCBpcyBjdXJyZW50bHkgaW4gdGhlIGxvZ2luIGZsb3cgKi9cclxuICBwcml2YXRlIF9sb2dpblN0YXRlOiAnaWRsZScgfCAnY29ubmVjdGluZycgfCAncmVhZHknID0gJ2lkbGUnO1xyXG5cclxuICAvKiogUmVjb25uZWN0IGF0dGVtcHQgY291bnRlciAqL1xyXG4gIHByaXZhdGUgX3JlY29ubmVjdEF0dGVtcHRzOiBudW1iZXIgPSAwO1xyXG5cclxuICAvKiogTWF4aW11bSByZWNvbm5lY3QgYXR0ZW1wdHMgYmVmb3JlIGdpdmluZyB1cCAqL1xyXG4gIHByaXZhdGUgcmVhZG9ubHkgX21heFJlY29ubmVjdEF0dGVtcHRzOiBudW1iZXIgPSA1O1xyXG5cclxuICAvKiogQ2FjaGVkIGludGVudHMgdmFsdWUgKi9cclxuICBwcml2YXRlIF9pbnRlbnRzVmFsdWU/OiBudW1iZXI7XHJcblxyXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnM6IENsaWVudE9wdGlvbnMpIHtcclxuICAgIHN1cGVyKCk7XHJcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xyXG4gICAgdGhpcy5nYXRld2F5VXJsID0gb3B0aW9ucy5nYXRld2F5VXJsIHx8ICd3c3M6Ly9yZWFsdGltZS5qdWJiaW8uY29tL3dzL2JvdCc7XHJcbiAgICB0aGlzLnJlc3QgPSBuZXcgUkVTVChvcHRpb25zLmFwaVVybCk7XHJcbiAgICBcclxuICAgIC8vIEluaXRpYWxpemUgdm9pY2UgYWRhcHRlciBzeXN0ZW1cclxuICAgIHRoaXMudm9pY2UgPSB7XHJcbiAgICAgIGFkYXB0ZXJzOiBuZXcgTWFwKClcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDYWxjdWxhdGUgaW50ZW50cyB2YWx1ZVxyXG4gICAqL1xyXG4gIHByaXZhdGUgZ2V0SW50ZW50c1ZhbHVlKCk6IG51bWJlciB7XHJcbiAgICAvLyBDYWNoZSB0aGUgaW50ZW50cyB2YWx1ZSBmb3IgY2hlY2tJbnRlbnQoKSBsb29rdXBzXHJcbiAgICBpZiAodGhpcy5faW50ZW50c1ZhbHVlICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgcmV0dXJuIHRoaXMuX2ludGVudHNWYWx1ZTtcclxuICAgIH1cclxuICAgIGlmICh0eXBlb2YgdGhpcy5vcHRpb25zLmludGVudHMgPT09ICdudW1iZXInKSB7XHJcbiAgICAgIHRoaXMuX2ludGVudHNWYWx1ZSA9IHRoaXMub3B0aW9ucy5pbnRlbnRzO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpcy5faW50ZW50c1ZhbHVlID0gdGhpcy5vcHRpb25zLmludGVudHMucmVkdWNlKChhY2MsIGludGVudCkgPT4gYWNjIHwgaW50ZW50LCAwKTtcclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzLl9pbnRlbnRzVmFsdWU7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDaGVjayBpZiBhIHNwZWNpZmljIGludGVudCBpcyBlbmFibGVkLiBFbWl0cyBhICd3YXJuJyBldmVudCBpZiB0aGUgaW50ZW50XHJcbiAgICogaXMgbm90IGVuYWJsZWQsIGFsbG93aW5nIGxpYnJhcnkgY29uc3VtZXJzIHRvIGNhdGNoIG1pc2NvbmZpZ3VyYXRpb24gZWFybHkuXHJcbiAgICogXHJcbiAgICogQHBhcmFtIGludGVudCAtIFRoZSBHYXRld2F5SW50ZW50Qml0cyBmbGFnIHRvIGNoZWNrXHJcbiAgICogQHBhcmFtIGZlYXR1cmUgLSBIdW1hbi1yZWFkYWJsZSBkZXNjcmlwdGlvbiBvZiB0aGUgZmVhdHVyZSByZXF1aXJpbmcgdGhpcyBpbnRlbnRcclxuICAgKiBAcmV0dXJucyB0cnVlIGlmIHRoZSBpbnRlbnQgaXMgZW5hYmxlZCwgZmFsc2Ugb3RoZXJ3aXNlXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBjaGVja0ludGVudChpbnRlbnQ6IEdhdGV3YXlJbnRlbnRCaXRzLCBmZWF0dXJlOiBzdHJpbmcpOiBib29sZWFuIHtcclxuICAgIGNvbnN0IGludGVudHMgPSB0aGlzLmdldEludGVudHNWYWx1ZSgpO1xyXG4gICAgY29uc3QgaGFzSW50ZW50ID0gKGludGVudHMgJiBpbnRlbnQpID09PSBpbnRlbnQ7XHJcbiAgICBpZiAoIWhhc0ludGVudCkge1xyXG4gICAgICB0aGlzLmVtaXQoJ3dhcm4nLCBgTWlzc2luZyBpbnRlbnQgZm9yICR7ZmVhdHVyZX0uIEVuYWJsZSBHYXRld2F5SW50ZW50Qml0cy4ke0dhdGV3YXlJbnRlbnRCaXRzW2ludGVudF19IHRvIHVzZSB0aGlzIGZlYXR1cmUuYCk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gaGFzSW50ZW50O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2F0ZXdheSBjbG9zZSBjb2RlIGRlc2NyaXB0aW9uc1xyXG4gICAqL1xyXG4gIHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IENMT1NFX0NPREVTOiBSZWNvcmQ8bnVtYmVyLCB7IG1lc3NhZ2U6IHN0cmluZzsgcmVjb25uZWN0YWJsZTogYm9vbGVhbiB9PiA9IHtcclxuICAgIDQwMDA6IHsgbWVzc2FnZTogJ0JpbGlubWV5ZW4gaGF0YSAoVW5rbm93biBlcnJvciknLCByZWNvbm5lY3RhYmxlOiB0cnVlIH0sXHJcbiAgICA0MDAxOiB7IG1lc3NhZ2U6ICdCaWxpbm1leWVuIG9wY29kZSBnw7ZuZGVyaWxkaSAoVW5rbm93biBvcGNvZGUpJywgcmVjb25uZWN0YWJsZTogdHJ1ZSB9LFxyXG4gICAgNDAwMjogeyBtZXNzYWdlOiAnR2XDp2Vyc2l6IHBheWxvYWQgZ8O2bmRlcmlsZGkgKERlY29kZSBlcnJvciknLCByZWNvbm5lY3RhYmxlOiB0cnVlIH0sXHJcbiAgICA0MDAzOiB7IG1lc3NhZ2U6ICdIZW7DvHoga2ltbGlrIGRvxJ9ydWxhbWFzxLEgeWFwxLFsbWFkxLEgKE5vdCBhdXRoZW50aWNhdGVkKScsIHJlY29ubmVjdGFibGU6IHRydWUgfSxcclxuICAgIDQwMDQ6IHsgbWVzc2FnZTogJ0dlw6dlcnNpeiBib3QgdG9rZW5cXCfEsSAoQXV0aGVudGljYXRpb24gZmFpbGVkKScsIHJlY29ubmVjdGFibGU6IGZhbHNlIH0sXHJcbiAgICA0MDA1OiB7IG1lc3NhZ2U6ICdaYXRlbiBraW1saWsgZG/En3J1bGFtYXPEsSB5YXDEsWxtxLHFnyAoQWxyZWFkeSBhdXRoZW50aWNhdGVkKScsIHJlY29ubmVjdGFibGU6IHRydWUgfSxcclxuICAgIDQwMDc6IHsgbWVzc2FnZTogJ0dlw6dlcnNpeiBzZXF1ZW5jZSBudW1hcmFzxLEgKEludmFsaWQgc2VxKScsIHJlY29ubmVjdGFibGU6IHRydWUgfSxcclxuICAgIDQwMDg6IHsgbWVzc2FnZTogJ1JhdGUgbGltaXQgYcWfxLFsZMSxIChSYXRlIGxpbWl0ZWQpJywgcmVjb25uZWN0YWJsZTogdHJ1ZSB9LFxyXG4gICAgNDAwOTogeyBtZXNzYWdlOiAnT3R1cnVtIHphbWFuIGHFn8SxbcSxbmEgdcSfcmFkxLEgKFNlc3Npb24gdGltZWQgb3V0KScsIHJlY29ubmVjdGFibGU6IHRydWUgfSxcclxuICAgIDQwMTA6IHsgbWVzc2FnZTogJ0dlw6dlcnNpeiBzaGFyZCB5YXDEsWxhbmTEsXJtYXPEsSAoSW52YWxpZCBzaGFyZCknLCByZWNvbm5lY3RhYmxlOiBmYWxzZSB9LFxyXG4gICAgNDAxMTogeyBtZXNzYWdlOiAnU2hhcmRpbmcgZ2VyZWtsaSAoU2hhcmRpbmcgcmVxdWlyZWQpJywgcmVjb25uZWN0YWJsZTogZmFsc2UgfSxcclxuICAgIDQwMTQ6IHsgbWVzc2FnZTogJ8SwemluIHZlcmlsbWV5ZW4gaW50ZW50XFwnbGVyIGlzdGVuZGkgKERpc2FsbG93ZWQgaW50ZW50cyknLCByZWNvbm5lY3RhYmxlOiBmYWxzZSB9LFxyXG4gIH07XHJcblxyXG4gIC8qKlxyXG4gICAqIExvZ2luIHRvIHRoZSBnYXRld2F5XHJcbiAgICovXHJcbiAgYXN5bmMgbG9naW4odG9rZW46IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XHJcbiAgICBpZiAoIXRva2VuIHx8IHR5cGVvZiB0b2tlbiAhPT0gJ3N0cmluZycpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKFxyXG4gICAgICAgICdHZcOnZXJsaSBiaXIgYm90IHRva2VuXFwnxLEgc2HEn2xhbm1hbMSxZMSxci4gw5ZybmVrOiBjbGllbnQubG9naW4ocHJvY2Vzcy5lbnYuQk9UX1RPS0VOKSdcclxuICAgICAgKTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLnRva2VuID0gdG9rZW4ucmVwbGFjZSgvXkJvdFxccysvaSwgJycpO1xyXG4gICAgdGhpcy5yZXN0LnNldFRva2VuKHRoaXMudG9rZW4pO1xyXG4gICAgdGhpcy5fbG9naW5TdGF0ZSA9ICdjb25uZWN0aW5nJztcclxuICAgIHRoaXMuX3JlY29ubmVjdEF0dGVtcHRzID0gMDtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICBjb25zdCBjbGVhbnVwID0gKCkgPT4ge1xyXG4gICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcclxuICAgICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKCdyZWFkeScsIG9uUmVhZHkpO1xyXG4gICAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIoJ2Vycm9yJywgb25FcnJvcik7XHJcbiAgICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcignZ2F0ZXdheUNsb3NlJywgb25HYXRld2F5Q2xvc2UpO1xyXG4gICAgICB9O1xyXG5cclxuICAgICAgY29uc3QgdGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgIGNsZWFudXAoKTtcclxuICAgICAgICB0aGlzLl9sb2dpblN0YXRlID0gJ2lkbGUnO1xyXG4gICAgICAgIHJlamVjdChuZXcgRXJyb3IoXHJcbiAgICAgICAgICAnR2F0ZXdheVxcJ2UgYmHEn2xhbsSxbGFtYWTEsTogMzAgc2FuaXllIGnDp2luZGUgUkVBRFkgZXZlbnRcXCdpIGFsxLFuYW1hZMSxLiAnICtcclxuICAgICAgICAgICdPbGFzxLEgc2ViZXBsZXI6IGdhdGV3YXkgc3VudWN1c3UgZXJpxZ9pbGVtZXosIHRva2VuIGdlw6dlcnNpeiB2ZXlhIGHEnyBzb3J1bnUuJ1xyXG4gICAgICAgICkpO1xyXG4gICAgICB9LCAzMDAwMCk7XHJcblxyXG4gICAgICBjb25zdCBvblJlYWR5ID0gKCkgPT4ge1xyXG4gICAgICAgIGNsZWFudXAoKTtcclxuICAgICAgICB0aGlzLl9sb2dpblN0YXRlID0gJ3JlYWR5JztcclxuICAgICAgICB0aGlzLl9yZWNvbm5lY3RBdHRlbXB0cyA9IDA7XHJcbiAgICAgICAgcmVzb2x2ZSh0aGlzLnRva2VuKTtcclxuICAgICAgfTtcclxuXHJcbiAgICAgIGNvbnN0IG9uRXJyb3IgPSAoZXJyb3I6IEVycm9yKSA9PiB7XHJcbiAgICAgICAgY2xlYW51cCgpO1xyXG4gICAgICAgIHRoaXMuX2xvZ2luU3RhdGUgPSAnaWRsZSc7XHJcbiAgICAgICAgcmVqZWN0KGVycm9yKTtcclxuICAgICAgfTtcclxuXHJcbiAgICAgIGNvbnN0IG9uR2F0ZXdheUNsb3NlID0gKGNvZGU6IG51bWJlciwgcmVhc29uOiBzdHJpbmcpID0+IHtcclxuICAgICAgICBjb25zdCBpbmZvID0gQ2xpZW50LkNMT1NFX0NPREVTW2NvZGVdO1xyXG4gICAgICAgIGlmIChpbmZvICYmICFpbmZvLnJlY29ubmVjdGFibGUpIHtcclxuICAgICAgICAgIGNsZWFudXAoKTtcclxuICAgICAgICAgIHRoaXMuX2xvZ2luU3RhdGUgPSAnaWRsZSc7XHJcbiAgICAgICAgICByZWplY3QobmV3IEVycm9yKGBHYXRld2F5IGJhxJ9sYW50xLFzxLEgcmVkZGVkaWxkaSBbJHtjb2RlfV06ICR7aW5mby5tZXNzYWdlfSR7cmVhc29uID8gJyAtICcgKyByZWFzb24gOiAnJ31gKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIFJlY29ubmVjdGFibGUgY29kZXM6IGxvZ2luIHByb21pc2Ugc3RheXMgYWxpdmUsIGNvbm5lY3QoKSB3aWxsIHJldHJ5XHJcbiAgICAgIH07XHJcblxyXG4gICAgICB0aGlzLm9uY2UoJ3JlYWR5Jywgb25SZWFkeSk7XHJcbiAgICAgIHRoaXMub25jZSgnZXJyb3InLCBvbkVycm9yKTtcclxuICAgICAgdGhpcy5vbignZ2F0ZXdheUNsb3NlJywgb25HYXRld2F5Q2xvc2UpO1xyXG5cclxuICAgICAgdGhpcy5jb25uZWN0KCk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENvbm5lY3QgdG8gdGhlIGdhdGV3YXlcclxuICAgKi9cclxuICBwcml2YXRlIGNvbm5lY3QoKTogdm9pZCB7XHJcbiAgICB0aGlzLndzID0gbmV3IFdlYlNvY2tldCh0aGlzLmdhdGV3YXlVcmwpO1xyXG4gICAgXHJcbiAgICB0aGlzLndzLm9uKCdvcGVuJywgKCkgPT4ge1xyXG4gICAgICB0aGlzLmVtaXQoJ2RlYnVnJywgJ1dlYlNvY2tldCBiYcSfbGFudMSxc8SxIGHDp8SxbGTEsScpO1xyXG4gICAgICB0aGlzLl9yZWNvbm5lY3RBdHRlbXB0cyA9IDA7XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgdGhpcy53cy5vbignbWVzc2FnZScsIChkYXRhKSA9PiB7XHJcbiAgICAgIHRoaXMuaGFuZGxlTWVzc2FnZShkYXRhLnRvU3RyaW5nKCkpO1xyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIHRoaXMud3Mub24oJ2Nsb3NlJywgKGNvZGUsIHJlYXNvbikgPT4ge1xyXG4gICAgICBjb25zdCByZWFzb25TdHIgPSByZWFzb24/LnRvU3RyaW5nKCkgfHwgJyc7XHJcbiAgICAgIGNvbnN0IGluZm8gPSBDbGllbnQuQ0xPU0VfQ09ERVNbY29kZV07XHJcbiAgICAgIFxyXG4gICAgICBpZiAoaW5mbykge1xyXG4gICAgICAgIHRoaXMuZW1pdCgnZGVidWcnLCBgR2F0ZXdheSBiYcSfbGFudMSxc8SxIGthcGFuZMSxIFske2NvZGV9XTogJHtpbmZvLm1lc3NhZ2V9JHtyZWFzb25TdHIgPyAnIC0gJyArIHJlYXNvblN0ciA6ICcnfWApO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHRoaXMuZW1pdCgnZGVidWcnLCBgV2ViU29ja2V0IGthcGFuZMSxOiAke2NvZGV9IC0gJHtyZWFzb25TdHJ9YCk7XHJcbiAgICAgIH1cclxuICAgICAgXHJcbiAgICAgIHRoaXMuY2xlYW51cCgpO1xyXG5cclxuICAgICAgLy8gRW1pdCBnYXRld2F5Q2xvc2Ugc28gbG9naW4oKSBjYW4gaGFuZGxlIG5vbi1yZWNvbm5lY3RhYmxlIGNvZGVzXHJcbiAgICAgIHRoaXMuZW1pdCgnZ2F0ZXdheUNsb3NlJywgY29kZSwgcmVhc29uU3RyKTtcclxuXHJcbiAgICAgIC8vIE5vbi1yZWNvbm5lY3RhYmxlIGNvZGVzOiBkb24ndCByZXRyeVxyXG4gICAgICBpZiAoaW5mbyAmJiAhaW5mby5yZWNvbm5lY3RhYmxlKSB7XHJcbiAgICAgICAgdGhpcy5lbWl0KCdkZWJ1ZycsIGBLb2QgJHtjb2RlfSB5ZW5pZGVuIGJhxJ9sYW7EsWxhbWF6LCBiYcSfbGFudMSxIHNvbmxhbmTEsXLEsWzEsXlvci5gKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIE5vcm1hbCBjbG9zZTogZG9uJ3QgcmV0cnlcclxuICAgICAgaWYgKGNvZGUgPT09IDEwMDApIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIFJlY29ubmVjdGFibGU6IHJldHJ5IHdpdGggYmFja29mZlxyXG4gICAgICB0aGlzLl9yZWNvbm5lY3RBdHRlbXB0cysrO1xyXG4gICAgICBpZiAodGhpcy5fcmVjb25uZWN0QXR0ZW1wdHMgPiB0aGlzLl9tYXhSZWNvbm5lY3RBdHRlbXB0cykge1xyXG4gICAgICAgIHRoaXMuZW1pdCgnZGVidWcnLCBgTWFrc2ltdW0geWVuaWRlbiBiYcSfbGFubWEgZGVuZW1lc2kgYcWfxLFsZMSxICgke3RoaXMuX21heFJlY29ubmVjdEF0dGVtcHRzfSlgKTtcclxuICAgICAgICB0aGlzLmVtaXQoJ2Vycm9yJywgbmV3IEVycm9yKFxyXG4gICAgICAgICAgYEdhdGV3YXkgYmHEn2xhbnTEsXPEsSAke3RoaXMuX21heFJlY29ubmVjdEF0dGVtcHRzfSBkZW5lbWVkZW4gc29ucmEga3VydWxhbWFkxLEuIFNvbiBrYXBhbm1hIGtvZHU6ICR7Y29kZX1gXHJcbiAgICAgICAgKSk7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zdCBkZWxheSA9IE1hdGgubWluKDEwMDAgKiBNYXRoLnBvdygyLCB0aGlzLl9yZWNvbm5lY3RBdHRlbXB0cyAtIDEpLCAzMDAwMCk7XHJcbiAgICAgIHRoaXMuZW1pdCgnZGVidWcnLCBgWWVuaWRlbiBiYcSfbGFuxLFsxLF5b3IgKGRlbmVtZSAke3RoaXMuX3JlY29ubmVjdEF0dGVtcHRzfS8ke3RoaXMuX21heFJlY29ubmVjdEF0dGVtcHRzfSksICR7ZGVsYXl9bXMgc29ucmEuLi5gKTtcclxuICAgICAgc2V0VGltZW91dCgoKSA9PiB0aGlzLmNvbm5lY3QoKSwgZGVsYXkpO1xyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIHRoaXMud3Mub24oJ2Vycm9yJywgKGVycm9yKSA9PiB7XHJcbiAgICAgIHRoaXMuZW1pdCgnZGVidWcnLCBgV2ViU29ja2V0IGhhdGFzxLE6ICR7ZXJyb3IubWVzc2FnZX1gKTtcclxuICAgICAgdGhpcy5lbWl0KCdlcnJvcicsIGVycm9yKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSGFuZGxlIGluY29taW5nIGdhdGV3YXkgbWVzc2FnZVxyXG4gICAqL1xyXG4gIHByaXZhdGUgaGFuZGxlTWVzc2FnZShkYXRhOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgIC8vIEhhbmRsZSBtdWx0aXBsZSBtZXNzYWdlcyBpbiBvbmUgZnJhbWVcclxuICAgIGNvbnN0IG1lc3NhZ2VzID0gZGF0YS5zcGxpdCgnXFxuJykuZmlsdGVyKG0gPT4gbS50cmltKCkpO1xyXG4gICAgXHJcbiAgICBmb3IgKGNvbnN0IG1zZyBvZiBtZXNzYWdlcykge1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGNvbnN0IHBheWxvYWQ6IEdhdGV3YXlQYXlsb2FkID0gSlNPTi5wYXJzZShtc2cpO1xyXG4gICAgICAgIHRoaXMuaGFuZGxlUGF5bG9hZChwYXlsb2FkKTtcclxuICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgIHRoaXMuZW1pdCgnZGVidWcnLCBgRmFpbGVkIHRvIHBhcnNlIG1lc3NhZ2U6ICR7bXNnfWApO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBIYW5kbGUgZ2F0ZXdheSBwYXlsb2FkXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBoYW5kbGVQYXlsb2FkKHBheWxvYWQ6IEdhdGV3YXlQYXlsb2FkKTogdm9pZCB7XHJcbiAgICBpZiAocGF5bG9hZC5zKSB7XHJcbiAgICAgIHRoaXMuc2VxdWVuY2UgPSBwYXlsb2FkLnM7XHJcbiAgICB9XHJcblxyXG4gICAgc3dpdGNoIChwYXlsb2FkLm9wKSB7XHJcbiAgICAgIGNhc2UgR2F0ZXdheU9wY29kZXMuSGVsbG86XHJcbiAgICAgICAgdGhpcy5oYW5kbGVIZWxsbyhwYXlsb2FkLmQpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlIEdhdGV3YXlPcGNvZGVzLkRpc3BhdGNoOlxyXG4gICAgICAgIHRoaXMuaGFuZGxlRGlzcGF0Y2gocGF5bG9hZC50ISwgcGF5bG9hZC5kKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSBHYXRld2F5T3Bjb2Rlcy5IZWFydGJlYXRBY2s6XHJcbiAgICAgICAgaWYgKHRoaXMuX2xhc3RIZWFydGJlYXRTZW50ID4gMCkge1xyXG4gICAgICAgICAgdGhpcy5waW5nID0gRGF0ZS5ub3coKSAtIHRoaXMuX2xhc3RIZWFydGJlYXRTZW50O1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmVtaXQoJ2RlYnVnJywgYEhlYXJ0YmVhdCBhY2tub3dsZWRnZWQgKHBpbmc6ICR7dGhpcy5waW5nfW1zKWApO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlIEdhdGV3YXlPcGNvZGVzLkludmFsaWRTZXNzaW9uOlxyXG4gICAgICAgIHRoaXMuZW1pdCgnZGVidWcnLCAnR2XDp2Vyc2l6IG90dXJ1bSwgeWVuaWRlbiBraW1saWsgZG/En3J1bGFuxLF5b3IuLi4nKTtcclxuICAgICAgICAvLyBJbnZhbGlkU2Vzc2lvbiBtYXkgY2FycnkgZXJyb3IgZGF0YSBmcm9tIHNlbmRFcnJvcigpXHJcbiAgICAgICAgaWYgKHBheWxvYWQuZCAmJiB0eXBlb2YgcGF5bG9hZC5kID09PSAnb2JqZWN0JyAmJiBwYXlsb2FkLmQuY29kZSAmJiBwYXlsb2FkLmQubWVzc2FnZSkge1xyXG4gICAgICAgICAgdGhpcy5lbWl0KCdkZWJ1ZycsIGBTdW51Y3UgaGF0YXPEsSBbJHtwYXlsb2FkLmQuY29kZX1dOiAke3BheWxvYWQuZC5tZXNzYWdlfWApO1xyXG4gICAgICAgICAgY29uc3QgaW5mbyA9IENsaWVudC5DTE9TRV9DT0RFU1twYXlsb2FkLmQuY29kZV07XHJcbiAgICAgICAgICBpZiAoaW5mbyAmJiAhaW5mby5yZWNvbm5lY3RhYmxlKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCBuZXcgRXJyb3IoYEdhdGV3YXkgaGF0YXPEsSBbJHtwYXlsb2FkLmQuY29kZX1dOiAke2luZm8ubWVzc2FnZX1gKSk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB0aGlzLmlkZW50aWZ5KCksIDUwMDApO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlIEdhdGV3YXlPcGNvZGVzLlJlY29ubmVjdDpcclxuICAgICAgICB0aGlzLmVtaXQoJ2RlYnVnJywgJ1JlY29ubmVjdCByZXF1ZXN0ZWQnKTtcclxuICAgICAgICB0aGlzLndzPy5jbG9zZSgpO1xyXG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4gdGhpcy5jb25uZWN0KCksIDEwMDApO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSGFuZGxlIEhlbGxvIHBheWxvYWRcclxuICAgKi9cclxuICBwcml2YXRlIGhhbmRsZUhlbGxvKGRhdGE6IHsgaGVhcnRiZWF0X2ludGVydmFsOiBudW1iZXIgfSk6IHZvaWQge1xyXG4gICAgdGhpcy5lbWl0KCdkZWJ1ZycsIGBSZWNlaXZlZCBIZWxsbywgaGVhcnRiZWF0IGludGVydmFsOiAke2RhdGEuaGVhcnRiZWF0X2ludGVydmFsfW1zYCk7XHJcbiAgICB0aGlzLnN0YXJ0SGVhcnRiZWF0KGRhdGEuaGVhcnRiZWF0X2ludGVydmFsKTtcclxuICAgIHRoaXMuaWRlbnRpZnkoKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZSBEaXNwYXRjaCBldmVudHNcclxuICAgKi9cclxuICBwcml2YXRlIGhhbmRsZURpc3BhdGNoKGV2ZW50VHlwZTogc3RyaW5nLCBkYXRhOiBhbnkpOiB2b2lkIHtcclxuICAgIHRoaXMuZW1pdCgnZGVidWcnLCBgRGlzcGF0Y2g6ICR7ZXZlbnRUeXBlfWApO1xyXG4gICAgXHJcbiAgICBzd2l0Y2ggKGV2ZW50VHlwZSkge1xyXG4gICAgICBjYXNlICdSRUFEWSc6XHJcbiAgICAgICAgdGhpcy5oYW5kbGVSZWFkeShkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnR1VJTERfQ1JFQVRFJzpcclxuICAgICAgICB0aGlzLmhhbmRsZUd1aWxkQ3JlYXRlKGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdHVUlMRF9VUERBVEUnOlxyXG4gICAgICAgIHRoaXMuaGFuZGxlR3VpbGRVcGRhdGUoZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ0dVSUxEX0RFTEVURSc6XHJcbiAgICAgICAgdGhpcy5oYW5kbGVHdWlsZERlbGV0ZShkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnTUVTU0FHRV9DUkVBVEUnOlxyXG4gICAgICAgIHRoaXMuaGFuZGxlTWVzc2FnZUNyZWF0ZShkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnTUVTU0FHRV9VUERBVEUnOlxyXG4gICAgICAgIHRoaXMuZW1pdCgnbWVzc2FnZVVwZGF0ZScsIGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdNRVNTQUdFX0RFTEVURSc6XHJcbiAgICAgICAgdGhpcy5lbWl0KCdtZXNzYWdlRGVsZXRlJywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ01FU1NBR0VfREVMRVRFX0JVTEsnOlxyXG4gICAgICAgIHRoaXMuZW1pdCgnbWVzc2FnZURlbGV0ZUJ1bGsnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnTUVTU0FHRV9SRUFDVElPTl9BREQnOlxyXG4gICAgICAgIHRoaXMuZW1pdCgnbWVzc2FnZVJlYWN0aW9uQWRkJywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ01FU1NBR0VfUkVBQ1RJT05fUkVNT1ZFJzpcclxuICAgICAgICB0aGlzLmVtaXQoJ21lc3NhZ2VSZWFjdGlvblJlbW92ZScsIGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdDSEFOTkVMX0NSRUFURSc6IHtcclxuICAgICAgICAvLyBVcGRhdGUgZ3VpbGQgY2hhbm5lbCBjYWNoZVxyXG4gICAgICAgIGNvbnN0IGd1aWxkSWQgPSBkYXRhLmd1aWxkX2lkO1xyXG4gICAgICAgIGNvbnN0IGNoYW5uZWxJZCA9IGRhdGEuaWQgfHwgZGF0YS5jaGFubmVsX2lkO1xyXG4gICAgICAgIGlmIChndWlsZElkICYmIGNoYW5uZWxJZCkge1xyXG4gICAgICAgICAgY29uc3QgZ3VpbGQgPSB0aGlzLmd1aWxkcy5nZXQoZ3VpbGRJZCk7XHJcbiAgICAgICAgICBpZiAoZ3VpbGQpIHtcclxuICAgICAgICAgICAgZ3VpbGQuY2hhbm5lbHMuc2V0KGNoYW5uZWxJZCwgZGF0YSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuZW1pdCgnY2hhbm5lbENyZWF0ZScsIGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ0NIQU5ORUxfVVBEQVRFJzoge1xyXG4gICAgICAgIGNvbnN0IGd1aWxkSWQgPSBkYXRhLmd1aWxkX2lkO1xyXG4gICAgICAgIGNvbnN0IGNoYW5uZWxJZCA9IGRhdGEuaWQgfHwgZGF0YS5jaGFubmVsX2lkO1xyXG4gICAgICAgIGlmIChndWlsZElkICYmIGNoYW5uZWxJZCkge1xyXG4gICAgICAgICAgY29uc3QgZ3VpbGQgPSB0aGlzLmd1aWxkcy5nZXQoZ3VpbGRJZCk7XHJcbiAgICAgICAgICBpZiAoZ3VpbGQpIHtcclxuICAgICAgICAgICAgZ3VpbGQuY2hhbm5lbHMuc2V0KGNoYW5uZWxJZCwgZGF0YSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuZW1pdCgnY2hhbm5lbFVwZGF0ZScsIGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ0NIQU5ORUxfREVMRVRFJzoge1xyXG4gICAgICAgIGNvbnN0IGd1aWxkSWQgPSBkYXRhLmd1aWxkX2lkO1xyXG4gICAgICAgIGNvbnN0IGNoYW5uZWxJZCA9IGRhdGEuaWQgfHwgZGF0YS5jaGFubmVsX2lkO1xyXG4gICAgICAgIGlmIChndWlsZElkICYmIGNoYW5uZWxJZCkge1xyXG4gICAgICAgICAgY29uc3QgZ3VpbGQgPSB0aGlzLmd1aWxkcy5nZXQoZ3VpbGRJZCk7XHJcbiAgICAgICAgICBpZiAoZ3VpbGQpIHtcclxuICAgICAgICAgICAgZ3VpbGQuY2hhbm5lbHMuZGVsZXRlKGNoYW5uZWxJZCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuZW1pdCgnY2hhbm5lbERlbGV0ZScsIGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ0dVSUxEX01FTUJFUl9BREQnOiB7XHJcbiAgICAgICAgY29uc3QgZ3VpbGQgPSB0aGlzLmd1aWxkcy5nZXQoU3RyaW5nKGRhdGEuZ3VpbGRfaWQpKTtcclxuICAgICAgICBpZiAoZ3VpbGQgJiYgZGF0YS51c2VyKSB7XHJcbiAgICAgICAgICBjb25zdCBtZW1iZXIgPSBndWlsZC5fYWRkTWVtYmVyKGRhdGEpO1xyXG4gICAgICAgICAgdGhpcy5lbWl0KCdndWlsZE1lbWJlckFkZCcsIG1lbWJlcik7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIHRoaXMuZW1pdCgnZ3VpbGRNZW1iZXJBZGQnLCBkYXRhKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgY2FzZSAnR1VJTERfTUVNQkVSX1VQREFURSc6IHtcclxuICAgICAgICBjb25zdCBndWlsZCA9IHRoaXMuZ3VpbGRzLmdldChTdHJpbmcoZGF0YS5ndWlsZF9pZCkpO1xyXG4gICAgICAgIGNvbnN0IHJhd1VzZXJJZCA9IGRhdGEudXNlcj8uaWQgfHwgZGF0YS51c2VyX2lkO1xyXG4gICAgICAgIGlmIChndWlsZCAmJiByYXdVc2VySWQpIHtcclxuICAgICAgICAgIGNvbnN0IGV4aXN0aW5nID0gZ3VpbGQubWVtYmVycy5nZXQoU3RyaW5nKHJhd1VzZXJJZCkpO1xyXG4gICAgICAgICAgaWYgKGV4aXN0aW5nKSB7XHJcbiAgICAgICAgICAgIGV4aXN0aW5nLl9wYXRjaChkYXRhKTtcclxuICAgICAgICAgICAgdGhpcy5lbWl0KCdndWlsZE1lbWJlclVwZGF0ZScsIGV4aXN0aW5nKTtcclxuICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHRoaXMuZW1pdCgnZ3VpbGRNZW1iZXJVcGRhdGUnLCBkYXRhKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgdGhpcy5lbWl0KCdndWlsZE1lbWJlclVwZGF0ZScsIGRhdGEpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBicmVhaztcclxuICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdHVUlMRF9NRU1CRVJfUkVNT1ZFJzoge1xyXG4gICAgICAgIGNvbnN0IGd1aWxkID0gdGhpcy5ndWlsZHMuZ2V0KFN0cmluZyhkYXRhLmd1aWxkX2lkKSk7XHJcbiAgICAgICAgY29uc3QgcmF3VXNlcklkID0gZGF0YS51c2VyPy5pZCB8fCBkYXRhLnVzZXJfaWQ7XHJcbiAgICAgICAgaWYgKGd1aWxkICYmIHJhd1VzZXJJZCkge1xyXG4gICAgICAgICAgY29uc3QgdXNlcklkID0gU3RyaW5nKHJhd1VzZXJJZCk7XHJcbiAgICAgICAgICBjb25zdCBtZW1iZXIgPSBndWlsZC5tZW1iZXJzLmdldCh1c2VySWQpO1xyXG4gICAgICAgICAgZ3VpbGQubWVtYmVycy5kZWxldGUodXNlcklkKTtcclxuICAgICAgICAgIHRoaXMuZW1pdCgnZ3VpbGRNZW1iZXJSZW1vdmUnLCBtZW1iZXIgfHwgZGF0YSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIHRoaXMuZW1pdCgnZ3VpbGRNZW1iZXJSZW1vdmUnLCBkYXRhKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgY2FzZSAnR1VJTERfUk9MRV9DUkVBVEUnOlxyXG4gICAgICAgIHRoaXMuZW1pdCgncm9sZUNyZWF0ZScsIGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdHVUlMRF9ST0xFX1VQREFURSc6XHJcbiAgICAgICAgdGhpcy5lbWl0KCdyb2xlVXBkYXRlJywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ0dVSUxEX1JPTEVfREVMRVRFJzpcclxuICAgICAgICB0aGlzLmVtaXQoJ3JvbGVEZWxldGUnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnR1VJTERfQkFOX0FERCc6XHJcbiAgICAgICAgdGhpcy5lbWl0KCdndWlsZEJhbkFkZCcsIGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdHVUlMRF9CQU5fUkVNT1ZFJzpcclxuICAgICAgICB0aGlzLmVtaXQoJ2d1aWxkQmFuUmVtb3ZlJywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ0lOVklURV9DUkVBVEUnOlxyXG4gICAgICAgIHRoaXMuZW1pdCgnaW52aXRlQ3JlYXRlJywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ0lOVklURV9ERUxFVEUnOlxyXG4gICAgICAgIHRoaXMuZW1pdCgnaW52aXRlRGVsZXRlJywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ0NIQU5ORUxfUElOU19VUERBVEUnOlxyXG4gICAgICAgIHRoaXMuZW1pdCgnY2hhbm5lbFBpbnNVcGRhdGUnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnVFlQSU5HX1NUQVJUJzpcclxuICAgICAgICB0aGlzLmVtaXQoJ3R5cGluZ1N0YXJ0JywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ1BSRVNFTkNFX1VQREFURSc6IHtcclxuICAgICAgICAvLyBwb255dGFpbDogdXBkYXRlIGd1aWxkIG9ubGluZUNvdW50IGJhc2VkIG9uIHN0YXR1cyBjaGFuZ2VcclxuICAgICAgICBjb25zdCBndWlsZElkID0gZGF0YS5ndWlsZF9pZDtcclxuICAgICAgICBjb25zdCBzdGF0dXMgPSBkYXRhLnN0YXR1cztcclxuICAgICAgICBpZiAoZ3VpbGRJZCkge1xyXG4gICAgICAgICAgY29uc3QgZ3VpbGQgPSB0aGlzLmd1aWxkcy5nZXQoU3RyaW5nKGd1aWxkSWQpKTtcclxuICAgICAgICAgIGlmIChndWlsZCkge1xyXG4gICAgICAgICAgICBpZiAoc3RhdHVzID09PSAnb2ZmbGluZScpIHtcclxuICAgICAgICAgICAgICBndWlsZC5vbmxpbmVDb3VudCA9IE1hdGgubWF4KDAsIGd1aWxkLm9ubGluZUNvdW50IC0gMSk7XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoc3RhdHVzID09PSAnb25saW5lJyB8fCBzdGF0dXMgPT09ICdpZGxlJyB8fCBzdGF0dXMgPT09ICdkbmQnKSB7XHJcbiAgICAgICAgICAgICAgZ3VpbGQub25saW5lQ291bnQrKztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmVtaXQoJ3ByZXNlbmNlVXBkYXRlJywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgY2FzZSAnSU5URVJBQ1RJT05fQ1JFQVRFJzpcclxuICAgICAgICB0aGlzLmhhbmRsZUludGVyYWN0aW9uQ3JlYXRlKGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdWT0lDRV9TVEFURV9VUERBVEUnOlxyXG4gICAgICAgIHRoaXMuaGFuZGxlVm9pY2VTdGF0ZVVwZGF0ZShkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnVk9JQ0VfU0VSVkVSX1VQREFURSc6XHJcbiAgICAgICAgdGhpcy5oYW5kbGVWb2ljZVNlcnZlclVwZGF0ZShkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgZGVmYXVsdDpcclxuICAgICAgICAvLyBFbWl0IHJhdyBldmVudCBmb3IgdW5oYW5kbGVkIHR5cGVzXHJcbiAgICAgICAgdGhpcy5lbWl0KCdyYXcnLCB7IHQ6IGV2ZW50VHlwZSwgZDogZGF0YSB9KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZSBSZWFkeSBldmVudFxyXG4gICAqL1xyXG4gIHByaXZhdGUgaGFuZGxlUmVhZHkoZGF0YTogUmVhZHlFdmVudERhdGEpOiB2b2lkIHtcclxuICAgIHRoaXMuc2Vzc2lvbklkID0gZGF0YS5zZXNzaW9uX2lkO1xyXG4gICAgdGhpcy51c2VyID0gbmV3IFVzZXIoZGF0YS51c2VyKTtcclxuICAgIC8vIEhhbmRsZSBib3RoIHN0cmluZyBhbmQgbnVtYmVyIGFwcGxpY2F0aW9uIElEc1xyXG4gICAgdGhpcy5hcHBsaWNhdGlvbklkID0gZGF0YS5hcHBsaWNhdGlvbj8uaWQgPyBTdHJpbmcoZGF0YS5hcHBsaWNhdGlvbi5pZCkgOiBudWxsO1xyXG4gICAgaWYgKHRoaXMuYXBwbGljYXRpb25JZCkge1xyXG4gICAgICB0aGlzLnJlc3Quc2V0QXBwbGljYXRpb25JZCh0aGlzLmFwcGxpY2F0aW9uSWQpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvLyBJbml0aWFsaXplIGFwcGxpY2F0aW9uIG9iamVjdCB3aXRoIGNvbW1hbmRzIG1hbmFnZXJcclxuICAgIHRoaXMuYXBwbGljYXRpb24gPSB7XHJcbiAgICAgIGlkOiB0aGlzLmFwcGxpY2F0aW9uSWQsXHJcbiAgICAgIGNvbW1hbmRzOiBuZXcgQXBwbGljYXRpb25Db21tYW5kTWFuYWdlcih0aGlzLnJlc3QpLFxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgLy8gQ2FjaGUgZ3VpbGRzIChhcyB1bmF2YWlsYWJsZSBpbml0aWFsbHkpXHJcbiAgICBpZiAoZGF0YS5ndWlsZHMpIHtcclxuICAgICAgZm9yIChjb25zdCBndWlsZCBvZiBkYXRhLmd1aWxkcykge1xyXG4gICAgICAgIHRoaXMuZ3VpbGRzLnNldChTdHJpbmcoZ3VpbGQuaWQpLCBuZXcgR3VpbGQodGhpcywgZ3VpbGQpKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvLyBTZXR1cCB2b2ljZSBhZGFwdGVycyBmb3IgZWFjaCBndWlsZFxyXG4gICAgdGhpcy5zZXR1cFZvaWNlQWRhcHRlcnMoKTtcclxuICAgIFxyXG4gICAgdGhpcy5lbWl0KCdkZWJ1ZycsIGBCb3QgcmVhZHkhIFVzZXI6ICR7dGhpcy51c2VyLnVzZXJuYW1lfSAoJHt0aGlzLnVzZXIuaWR9KSwgQXBwOiAke3RoaXMuYXBwbGljYXRpb25JZH1gKTtcclxuICAgIHRoaXMuZW1pdCgncmVhZHknLCB0aGlzKTtcclxuXHJcbiAgICAvLyBTaWduYWwgc2hhcmQgbWFuYWdlciB0aGF0IHRoaXMgc2hhcmQgaXMgcmVhZHkgKGlmIHJ1bm5pbmcgYXMgYSBzaGFyZClcclxuICAgIGlmIChwcm9jZXNzLnNlbmQpIHtcclxuICAgICAgcHJvY2Vzcy5zZW5kKHsgX3JlYWR5OiB0cnVlIH0pO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2V0dXAgdm9pY2UgYWRhcHRlcnMgZm9yIGFsbCBndWlsZHNcclxuICAgKi9cclxuICBwcml2YXRlIHNldHVwVm9pY2VBZGFwdGVycygpOiB2b2lkIHtcclxuICAgIGZvciAoY29uc3QgW2d1aWxkSWRdIG9mIHRoaXMuZ3VpbGRzKSB7XHJcbiAgICAgIHRoaXMuY3JlYXRlVm9pY2VBZGFwdGVyKGd1aWxkSWQpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgdm9pY2UgYWRhcHRlciBmb3IgYSBndWlsZFxyXG4gICAqL1xyXG4gIHByaXZhdGUgY3JlYXRlVm9pY2VBZGFwdGVyKGd1aWxkSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgYWRhcHRlcjogVm9pY2VBZGFwdGVyQ3JlYXRvciA9IChtZXRob2RzKSA9PiB7XHJcbiAgICAgIC8vIFN0b3JlIGhhbmRsZXJzIGZvciB0aGlzIGd1aWxkXHJcbiAgICAgIHRoaXMudm9pY2VTdGF0ZUhhbmRsZXJzLnNldChndWlsZElkLCBtZXRob2RzLm9uVm9pY2VTdGF0ZVVwZGF0ZSk7XHJcbiAgICAgIHRoaXMudm9pY2VTZXJ2ZXJIYW5kbGVycy5zZXQoZ3VpbGRJZCwgbWV0aG9kcy5vblZvaWNlU2VydmVyVXBkYXRlKTtcclxuICAgICAgXHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAgc2VuZFBheWxvYWQ6IChwYXlsb2FkKSA9PiB7XHJcbiAgICAgICAgICBpZiAodGhpcy53cz8ucmVhZHlTdGF0ZSA9PT0gV2ViU29ja2V0Lk9QRU4pIHtcclxuICAgICAgICAgICAgdGhpcy53cy5zZW5kKEpTT04uc3RyaW5naWZ5KHBheWxvYWQpKTtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBkZXN0cm95OiAoKSA9PiB7XHJcbiAgICAgICAgICB0aGlzLnZvaWNlU3RhdGVIYW5kbGVycy5kZWxldGUoZ3VpbGRJZCk7XHJcbiAgICAgICAgICB0aGlzLnZvaWNlU2VydmVySGFuZGxlcnMuZGVsZXRlKGd1aWxkSWQpO1xyXG4gICAgICAgIH1cclxuICAgICAgfTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMudm9pY2UuYWRhcHRlcnMuc2V0KGd1aWxkSWQsIGFkYXB0ZXIpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSGFuZGxlIEd1aWxkIENyZWF0ZSBldmVudFxyXG4gICAqL1xyXG4gIHByaXZhdGUgaGFuZGxlR3VpbGRDcmVhdGUoZGF0YTogQVBJR3VpbGQpOiB2b2lkIHtcclxuICAgIGxldCBndWlsZCA9IHRoaXMuZ3VpbGRzLmdldChkYXRhLmlkKTtcclxuICAgIFxyXG4gICAgaWYgKGd1aWxkKSB7XHJcbiAgICAgIGd1aWxkLl9wYXRjaChkYXRhKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGd1aWxkID0gbmV3IEd1aWxkKHRoaXMsIGRhdGEpO1xyXG4gICAgICB0aGlzLmd1aWxkcy5zZXQoZGF0YS5pZCwgZ3VpbGQpO1xyXG4gICAgICB0aGlzLmNyZWF0ZVZvaWNlQWRhcHRlcihkYXRhLmlkKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgdGhpcy5lbWl0KCdndWlsZENyZWF0ZScsIGd1aWxkKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZSBHdWlsZCBVcGRhdGUgZXZlbnRcclxuICAgKi9cclxuICBwcml2YXRlIGhhbmRsZUd1aWxkVXBkYXRlKGRhdGE6IEFQSUd1aWxkKTogdm9pZCB7XHJcbiAgICBjb25zdCBndWlsZCA9IHRoaXMuZ3VpbGRzLmdldChkYXRhLmlkKTtcclxuICAgIGlmIChndWlsZCkge1xyXG4gICAgICBndWlsZC5fcGF0Y2goZGF0YSk7XHJcbiAgICAgIHRoaXMuZW1pdCgnZ3VpbGRVcGRhdGUnLCBndWlsZCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBIYW5kbGUgR3VpbGQgRGVsZXRlIGV2ZW50XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBoYW5kbGVHdWlsZERlbGV0ZShkYXRhOiB7IGlkOiBzdHJpbmcgfSk6IHZvaWQge1xyXG4gICAgY29uc3QgZ3VpbGQgPSB0aGlzLmd1aWxkcy5nZXQoZGF0YS5pZCk7XHJcbiAgICBpZiAoZ3VpbGQpIHtcclxuICAgICAgdGhpcy5ndWlsZHMuZGVsZXRlKGRhdGEuaWQpO1xyXG4gICAgICB0aGlzLnZvaWNlLmFkYXB0ZXJzLmRlbGV0ZShkYXRhLmlkKTtcclxuICAgICAgdGhpcy5lbWl0KCdndWlsZERlbGV0ZScsIGd1aWxkKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZSBNZXNzYWdlIENyZWF0ZSBldmVudFxyXG4gICAqL1xyXG4gIHByaXZhdGUgaGFuZGxlTWVzc2FnZUNyZWF0ZShkYXRhOiBBUElNZXNzYWdlKTogdm9pZCB7XHJcbiAgICAvLyBCYWNrZW5kIHNlbmRzIHVzZXJfaWQgc2VwYXJhdGVseSwgbWFwIGl0IHRvIGF1dGhvci5pZCBmb3IgY29tcGF0aWJpbGl0eVxyXG4gICAgaWYgKGRhdGEudXNlcl9pZCAmJiBkYXRhLmF1dGhvciAmJiAhZGF0YS5hdXRob3IuaWQpIHtcclxuICAgICAgKGRhdGEuYXV0aG9yIGFzIGFueSkuaWQgPSBkYXRhLnVzZXJfaWQ7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIENhY2hlIHRoZSBhdXRob3JcclxuICAgIGlmIChkYXRhLmF1dGhvcikge1xyXG4gICAgICBjb25zdCB1c2VyID0gbmV3IFVzZXIoZGF0YS5hdXRob3IpO1xyXG4gICAgICB0aGlzLnVzZXJzLnNldCh1c2VyLmlkLCB1c2VyKTtcclxuICAgICAgLy8gQWxzbyBjYWNoZSBpbiBSRVNUIGZvciBtZW50aW9uIHJlc29sdXRpb25cclxuICAgICAgdGhpcy5yZXN0LmNhY2hlVXNlcihkYXRhLmF1dGhvcik7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGNvbnN0IG1lc3NhZ2UgPSBuZXcgTWVzc2FnZSh0aGlzLCBkYXRhKTtcclxuXHJcbiAgICAvLyBNYXJrIG1lc3NhZ2UgYXMgZnJvbSBib3QgaWYgYXV0aG9yIElEIG1hdGNoZXMgdGhlIGJvdCdzIG93biB1c2VyIElEXHJcbiAgICBpZiAodGhpcy51c2VyICYmIFN0cmluZyhtZXNzYWdlLmF1dGhvci5pZCkgPT09IFN0cmluZyh0aGlzLnVzZXIuaWQpKSB7XHJcbiAgICAgIChtZXNzYWdlLmF1dGhvciBhcyBhbnkpLmJvdCA9IHRydWU7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gUmVzb2x2ZSBndWlsZCBtZW1iZXIgaWYgaW4gYSBndWlsZFxyXG4gICAgaWYgKG1lc3NhZ2UuZ3VpbGRJZCkge1xyXG4gICAgICBjb25zdCBndWlsZCA9IHRoaXMuZ3VpbGRzLmdldChtZXNzYWdlLmd1aWxkSWQpO1xyXG4gICAgICBjb25zdCBtZW1iZXJEYXRhID0gKGRhdGEgYXMgYW55KS5tZW1iZXI7XHJcbiAgICAgIGlmIChtZW1iZXJEYXRhICYmIGd1aWxkKSB7XHJcbiAgICAgICAgLy8gR2F0ZXdheSBzZW50IG1lbWJlciBkYXRhIHdpdGggdGhlIG1lc3NhZ2Ug4oCUIGNhY2hlIGl0XHJcbiAgICAgICAgLy8gX2FkZE1lbWJlciBwcmVzZXJ2ZXMgdm9pY2Ugc3RhdGUgZnJvbSBleGlzdGluZyBjYWNoZSBhdXRvbWF0aWNhbGx5XHJcbiAgICAgICAgbWVtYmVyRGF0YS51c2VyID0gZGF0YS5hdXRob3I7XHJcbiAgICAgICAgY29uc3QgbWVtYmVyID0gZ3VpbGQuX2FkZE1lbWJlcihtZW1iZXJEYXRhKTtcclxuICAgICAgICBtZXNzYWdlLm1lbWJlciA9IG1lbWJlcjtcclxuICAgICAgfSBlbHNlIGlmIChtZW1iZXJEYXRhKSB7XHJcbiAgICAgICAgLy8gTm8gZ3VpbGQgaW4gY2FjaGUgYnV0IG1lbWJlciBkYXRhIGV4aXN0c1xyXG4gICAgICAgIG1lbWJlckRhdGEudXNlciA9IGRhdGEuYXV0aG9yO1xyXG4gICAgICAgIGNvbnN0IHJlc29sdmVkR3VpbGQgPSB7IGlkOiBtZXNzYWdlLmd1aWxkSWQsIG93bmVySWQ6IG51bGwsIG1lbWJlcnM6IG5ldyBDb2xsZWN0aW9uKCksIGNoYW5uZWxzOiBuZXcgQ29sbGVjdGlvbigpIH0gYXMgYW55O1xyXG4gICAgICAgIG1lc3NhZ2UubWVtYmVyID0gbmV3IChyZXF1aXJlKCcuL3N0cnVjdHVyZXMvR3VpbGRNZW1iZXInKS5HdWlsZE1lbWJlcikodGhpcywgcmVzb2x2ZWRHdWlsZCwgbWVtYmVyRGF0YSk7XHJcbiAgICAgIH0gZWxzZSBpZiAoZ3VpbGQpIHtcclxuICAgICAgICAvLyBObyBtZW1iZXIgZGF0YSBmcm9tIGdhdGV3YXkg4oCUIHVzZSBjYWNoZWQgbWVtYmVyIChtYXkgaGF2ZSB2b2ljZSBzdGF0ZSBmcm9tIFZPSUNFX1NUQVRFX1VQREFURSlcclxuICAgICAgICBjb25zdCBjYWNoZWQgPSBndWlsZC5tZW1iZXJzPy5nZXQoU3RyaW5nKG1lc3NhZ2UuYXV0aG9yLmlkKSk7XHJcbiAgICAgICAgaWYgKGNhY2hlZCkge1xyXG4gICAgICAgICAgbWVzc2FnZS5tZW1iZXIgPSBjYWNoZWQ7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5lbWl0KCdtZXNzYWdlQ3JlYXRlJywgbWVzc2FnZSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBIYW5kbGUgSW50ZXJhY3Rpb24gQ3JlYXRlIGV2ZW50XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBoYW5kbGVJbnRlcmFjdGlvbkNyZWF0ZShkYXRhOiBBUElJbnRlcmFjdGlvbik6IHZvaWQge1xyXG4gICAgaWYgKHByb2Nlc3MuZW52LkRFQlVHX0NMSUVOVCkge1xyXG4gICAgICBjb25zb2xlLmxvZygnW0RFQlVHXSBoYW5kbGVJbnRlcmFjdGlvbkNyZWF0ZSBjYWxsZWQgd2l0aDonLCBKU09OLnN0cmluZ2lmeShkYXRhLCBudWxsLCAyKSk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHRyeSB7XHJcbiAgICAgIC8vIENhY2hlIHRoZSB1c2VyXHJcbiAgICAgIGNvbnN0IHVzZXJEYXRhID0gZGF0YS5tZW1iZXI/LnVzZXIgfHwgZGF0YS51c2VyO1xyXG4gICAgICBpZiAodXNlckRhdGEpIHtcclxuICAgICAgICBjb25zdCB1c2VyID0gbmV3IFVzZXIodXNlckRhdGEpO1xyXG4gICAgICAgIHRoaXMudXNlcnMuc2V0KHVzZXIuaWQsIHVzZXIpO1xyXG4gICAgICAgIHRoaXMucmVzdC5jYWNoZVVzZXIodXNlckRhdGEpO1xyXG4gICAgICB9XHJcbiAgICAgIFxyXG4gICAgICBjb25zdCBpbnRlcmFjdGlvbiA9IGNyZWF0ZUludGVyYWN0aW9uKHRoaXMsIGRhdGEpO1xyXG4gICAgICBpZiAocHJvY2Vzcy5lbnYuREVCVUdfQ0xJRU5UKSB7XHJcbiAgICAgICAgY29uc29sZS5sb2coJ1tERUJVR10gQ3JlYXRlZCBpbnRlcmFjdGlvbiB0eXBlOicsIGludGVyYWN0aW9uLmNvbnN0cnVjdG9yLm5hbWUsICdjdXN0b21JZDonLCAoaW50ZXJhY3Rpb24gYXMgYW55KS5jdXN0b21JZCk7XHJcbiAgICAgIH1cclxuICAgICAgdGhpcy5lbWl0KCdpbnRlcmFjdGlvbkNyZWF0ZScsIGludGVyYWN0aW9uKTtcclxuICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICBjb25zb2xlLmVycm9yKCdbRVJST1JdIGhhbmRsZUludGVyYWN0aW9uQ3JlYXRlIGNyYXNoZWQ6JywgZXJyKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZSBWb2ljZSBTdGF0ZSBVcGRhdGUgZXZlbnRcclxuICAgKi9cclxuICBwcml2YXRlIGhhbmRsZVZvaWNlU3RhdGVVcGRhdGUoZGF0YTogYW55KTogdm9pZCB7XHJcbiAgICBjb25zdCBndWlsZElkID0gZGF0YS5ndWlsZF9pZDtcclxuICAgIGNvbnN0IHVzZXJJZCA9IGRhdGEudXNlcl9pZDtcclxuICAgIFxyXG4gICAgLy8gVXBkYXRlIG1lbWJlciB2b2ljZSBzdGF0ZSBpbiBjYWNoZVxyXG4gICAgaWYgKGd1aWxkSWQgJiYgdXNlcklkKSB7XHJcbiAgICAgIGNvbnN0IGd1aWxkID0gdGhpcy5ndWlsZHMuZ2V0KFN0cmluZyhndWlsZElkKSk7XHJcbiAgICAgIGlmIChndWlsZCkge1xyXG4gICAgICAgIGNvbnN0IHVzZXJJZFN0ciA9IFN0cmluZyh1c2VySWQpO1xyXG4gICAgICAgIGxldCBtZW1iZXIgPSBndWlsZC5tZW1iZXJzLmdldCh1c2VySWRTdHIpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmICghbWVtYmVyICYmIGRhdGEudXNlcikge1xyXG4gICAgICAgICAgLy8gTWVtYmVyIG5vdCBpbiBjYWNoZSB5ZXQg4oCUIGNyZWF0ZSBhIG1pbmltYWwgZW50cnkgZnJvbSB2b2ljZSBzdGF0ZSBkYXRhXHJcbiAgICAgICAgICBtZW1iZXIgPSBndWlsZC5fYWRkTWVtYmVyKHtcclxuICAgICAgICAgICAgdXNlcjogZGF0YS51c2VyLFxyXG4gICAgICAgICAgICByb2xlczogW10sXHJcbiAgICAgICAgICAgIGpvaW5lZF9hdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIFxyXG4gICAgICAgIGlmIChtZW1iZXIpIHtcclxuICAgICAgICAgIG1lbWJlci52b2ljZSA9IHtcclxuICAgICAgICAgICAgY2hhbm5lbElkOiBkYXRhLmNoYW5uZWxfaWQgPz8gdW5kZWZpbmVkLFxyXG4gICAgICAgICAgICBzZWxmTXV0ZTogZGF0YS5zZWxmX211dGUgPz8gZmFsc2UsXHJcbiAgICAgICAgICAgIHNlbGZEZWFmOiBkYXRhLnNlbGZfZGVhZiA/PyBmYWxzZSxcclxuICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIEZvcndhcmQgdG8gdm9pY2UgYWRhcHRlciBpZiBleGlzdHNcclxuICAgIGNvbnN0IGhhbmRsZXIgPSB0aGlzLnZvaWNlU3RhdGVIYW5kbGVycy5nZXQoZ3VpbGRJZCk7XHJcbiAgICBpZiAoaGFuZGxlcikge1xyXG4gICAgICBoYW5kbGVyKGRhdGEpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICB0aGlzLmVtaXQoJ3ZvaWNlU3RhdGVVcGRhdGUnLCBkYXRhKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZSBWb2ljZSBTZXJ2ZXIgVXBkYXRlIGV2ZW50XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBoYW5kbGVWb2ljZVNlcnZlclVwZGF0ZShkYXRhOiBBUElWb2ljZVNlcnZlclVwZGF0ZSk6IHZvaWQge1xyXG4gICAgY29uc3QgZ3VpbGRJZCA9IGRhdGEuZ3VpbGRfaWQ7XHJcbiAgICBcclxuICAgIC8vIEZvcndhcmQgdG8gdm9pY2UgYWRhcHRlciBpZiBleGlzdHNcclxuICAgIGNvbnN0IGhhbmRsZXIgPSB0aGlzLnZvaWNlU2VydmVySGFuZGxlcnMuZ2V0KGd1aWxkSWQpO1xyXG4gICAgaWYgKGhhbmRsZXIpIHtcclxuICAgICAgaGFuZGxlcih7XHJcbiAgICAgICAgdG9rZW46IGRhdGEudG9rZW4sXHJcbiAgICAgICAgZW5kcG9pbnQ6IGRhdGEuZW5kcG9pbnQsXHJcbiAgICAgICAgcm9vbTogZGF0YS5yb29tXHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICB0aGlzLmVtaXQoJ3ZvaWNlU2VydmVyVXBkYXRlJywgZGF0YSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZW5kIElkZW50aWZ5IHBheWxvYWRcclxuICAgKi9cclxuICBwcml2YXRlIGlkZW50aWZ5KCk6IHZvaWQge1xyXG4gICAgY29uc3QgcGF5bG9hZDogR2F0ZXdheVBheWxvYWQgPSB7XHJcbiAgICAgIG9wOiBHYXRld2F5T3Bjb2Rlcy5JZGVudGlmeSxcclxuICAgICAgZDoge1xyXG4gICAgICAgIHRva2VuOiBgQm90ICR7dGhpcy50b2tlbn1gLFxyXG4gICAgICAgIGludGVudHM6IHRoaXMuZ2V0SW50ZW50c1ZhbHVlKCksXHJcbiAgICAgICAgc2hhcmQ6IHRoaXMub3B0aW9ucy5zaGFyZHMgfHwgWzAsIDFdXHJcbiAgICAgIH1cclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMuc2VuZChwYXlsb2FkKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFN0YXJ0IGhlYXJ0YmVhdFxyXG4gICAqL1xyXG4gIHByaXZhdGUgc3RhcnRIZWFydGJlYXQoaW50ZXJ2YWw6IG51bWJlcik6IHZvaWQge1xyXG4gICAgdGhpcy5oZWFydGJlYXRJbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHtcclxuICAgICAgdGhpcy5fbGFzdEhlYXJ0YmVhdFNlbnQgPSBEYXRlLm5vdygpO1xyXG4gICAgICB0aGlzLnNlbmQoe1xyXG4gICAgICAgIG9wOiBHYXRld2F5T3Bjb2Rlcy5IZWFydGJlYXQsXHJcbiAgICAgICAgZDogdGhpcy5zZXF1ZW5jZVxyXG4gICAgICB9KTtcclxuICAgIH0sIGludGVydmFsKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNlbmQgcGF5bG9hZCB0byBnYXRld2F5XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBzZW5kKHBheWxvYWQ6IEdhdGV3YXlQYXlsb2FkKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy53cz8ucmVhZHlTdGF0ZSA9PT0gV2ViU29ja2V0Lk9QRU4pIHtcclxuICAgICAgdGhpcy53cy5zZW5kKEpTT04uc3RyaW5naWZ5KHBheWxvYWQpKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENsZWFudXAgb24gZGlzY29ubmVjdFxyXG4gICAqL1xyXG4gIHByaXZhdGUgY2xlYW51cCgpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLmhlYXJ0YmVhdEludGVydmFsKSB7XHJcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5oZWFydGJlYXRJbnRlcnZhbCk7XHJcbiAgICAgIHRoaXMuaGVhcnRiZWF0SW50ZXJ2YWwgPSBudWxsO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVzdHJveSB0aGUgY2xpZW50XHJcbiAgICovXHJcbiAgZGVzdHJveSgpOiB2b2lkIHtcclxuICAgIHRoaXMuX2xvZ2luU3RhdGUgPSAnaWRsZSc7XHJcbiAgICB0aGlzLl9yZWNvbm5lY3RBdHRlbXB0cyA9IHRoaXMuX21heFJlY29ubmVjdEF0dGVtcHRzICsgMTsgLy8gUHJldmVudCByZWNvbm5lY3RcclxuICAgIHRoaXMuY2xlYW51cCgpO1xyXG4gICAgdGhpcy53cz8uY2xvc2UoMTAwMCk7XHJcbiAgICB0aGlzLndzID0gbnVsbDtcclxuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCk7XHJcbiAgfVxyXG59XHJcblxyXG4vLyBSZS1leHBvcnQgZm9yIGNvbnZlbmllbmNlXHJcbmV4cG9ydCB7IEdhdGV3YXlJbnRlbnRCaXRzIH07XHJcbiJdfQ==