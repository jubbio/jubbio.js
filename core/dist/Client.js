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
     * Login to the gateway
     */
    async login(token) {
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
    connect() {
        this.ws = new ws_1.default(this.gatewayUrl);
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
                this.emit('debug', 'Invalid session, re-identifying...');
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
        this.cleanup();
        this.ws?.close(1000);
        this.ws = null;
        this.removeAllListeners();
    }
}
exports.Client = Client;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ2xpZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL0NsaWVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxtQ0FBc0M7QUFDdEMsNENBQTJCO0FBWTNCLG1DQUE0RDtBQStqQm5ELGtHQS9qQmdCLHlCQUFpQixPQStqQmhCO0FBOWpCMUIsd0RBQXFEO0FBQ3JELDRDQUF5QztBQUN6Qyw4Q0FBMkM7QUFDM0Msa0RBQStDO0FBQy9DLDBEQUEwRTtBQUUxRSxzQ0FBbUM7QUFjbkM7O0dBRUc7QUFDSCxNQUFhLE1BQU8sU0FBUSxxQkFBWTtJQUN0QyxxQkFBcUI7SUFDTCxPQUFPLENBQWdCO0lBRXZDLHNCQUFzQjtJQUNOLElBQUksQ0FBTztJQUUzQixtQkFBbUI7SUFDWixJQUFJLEdBQWdCLElBQUksQ0FBQztJQUVoQyxxQkFBcUI7SUFDZCxhQUFhLEdBQWtCLElBQUksQ0FBQztJQUUzQyxvQkFBb0I7SUFDYixNQUFNLEdBQThCLElBQUksdUJBQVUsRUFBRSxDQUFDO0lBRTVELHNCQUFzQjtJQUNmLFFBQVEsR0FBb0MsSUFBSSx1QkFBVSxFQUFFLENBQUM7SUFFcEUsbUJBQW1CO0lBQ1osS0FBSyxHQUE2QixJQUFJLHVCQUFVLEVBQUUsQ0FBQztJQUUxRCwrQkFBK0I7SUFDeEIsS0FBSyxDQUVWO0lBRUYsMkJBQTJCO0lBQ25CLEVBQUUsR0FBcUIsSUFBSSxDQUFDO0lBRXBDLGdCQUFnQjtJQUNSLEtBQUssR0FBVyxFQUFFLENBQUM7SUFFM0IsaUJBQWlCO0lBQ1QsU0FBUyxHQUFrQixJQUFJLENBQUM7SUFFeEMsc0JBQXNCO0lBQ2QsUUFBUSxHQUFrQixJQUFJLENBQUM7SUFFdkMseUJBQXlCO0lBQ2pCLGlCQUFpQixHQUEwQixJQUFJLENBQUM7SUFFeEQsa0JBQWtCO0lBQ1YsVUFBVSxDQUFTO0lBRTNCLHVEQUF1RDtJQUMvQyxrQkFBa0IsR0FBcUMsSUFBSSxHQUFHLEVBQUUsQ0FBQztJQUNqRSxtQkFBbUIs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QyxJQUFJLENBQUMsaUJBQWlCLEdBQUcsSUFBSSxDQUFDO1FBQ2hDLENBQUM7SUFDSCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxPQUFPO1FBQ0wsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ2YsSUFBSSxDQUFDLEVBQUUsRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDckIsSUFBSSxDQUFDLEVBQUUsR0FBRyxJQUFJLENBQUM7UUFDZixJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztJQUM1QixDQUFDO0NBQ0Y7QUFwaUJELHdCQW9pQkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBFdmVudEVtaXR0ZXIgfSBmcm9tICdldmVudHMnO1xyXG5pbXBvcnQgV2ViU29ja2V0IGZyb20gJ3dzJztcclxuaW1wb3J0IHsgXHJcbiAgQ2xpZW50T3B0aW9ucywgXHJcbiAgR2F0ZXdheVBheWxvYWQsIFxyXG4gIFJlYWR5RXZlbnREYXRhLFxyXG4gIEFQSUd1aWxkLFxyXG4gIEFQSUludGVyYWN0aW9uLFxyXG4gIEFQSU1lc3NhZ2UsXHJcbiAgQVBJVm9pY2VTZXJ2ZXJVcGRhdGUsXHJcbiAgQVBJQ2hhbm5lbCxcclxuICBBUElVc2VyXHJcbn0gZnJvbSAnLi90eXBlcyc7XHJcbmltcG9ydCB7IEdhdGV3YXlPcGNvZGVzLCBHYXRld2F5SW50ZW50Qml0cyB9IGZyb20gJy4vZW51bXMnO1xyXG5pbXBvcnQgeyBDb2xsZWN0aW9uIH0gZnJvbSAnLi9zdHJ1Y3R1cmVzL0NvbGxlY3Rpb24nO1xyXG5pbXBvcnQgeyBVc2VyIH0gZnJvbSAnLi9zdHJ1Y3R1cmVzL1VzZXInO1xyXG5pbXBvcnQgeyBHdWlsZCB9IGZyb20gJy4vc3RydWN0dXJlcy9HdWlsZCc7XHJcbmltcG9ydCB7IE1lc3NhZ2UgfSBmcm9tICcuL3N0cnVjdHVyZXMvTWVzc2FnZSc7XHJcbmltcG9ydCB7IGNyZWF0ZUludGVyYWN0aW9uLCBJbnRlcmFjdGlvbiB9IGZyb20gJy4vc3RydWN0dXJlcy9JbnRlcmFjdGlvbic7XHJcbmltcG9ydCB7IEJhc2VDaGFubmVsLCBjcmVhdGVDaGFubmVsIH0gZnJvbSAnLi9zdHJ1Y3R1cmVzL0NoYW5uZWwnO1xyXG5pbXBvcnQgeyBSRVNUIH0gZnJvbSAnLi9yZXN0L1JFU1QnO1xyXG5cclxuLyoqXHJcbiAqIFZvaWNlIGFkYXB0ZXIgY3JlYXRvciB0eXBlIGZvciBAanViYmlvL3ZvaWNlIGNvbXBhdGliaWxpdHlcclxuICovXHJcbnR5cGUgVm9pY2VBZGFwdGVyQ3JlYXRvciA9IChtZXRob2RzOiB7XHJcbiAgb25Wb2ljZVNlcnZlclVwZGF0ZShkYXRhOiBhbnkpOiB2b2lkO1xyXG4gIG9uVm9pY2VTdGF0ZVVwZGF0ZShkYXRhOiBhbnkpOiB2b2lkO1xyXG4gIGRlc3Ryb3koKTogdm9pZDtcclxufSkgPT4ge1xyXG4gIHNlbmRQYXlsb2FkKHBheWxvYWQ6IGFueSk6IGJvb2xlYW47XHJcbiAgZGVzdHJveSgpOiB2b2lkO1xyXG59O1xyXG5cclxuLyoqXHJcbiAqIE1haW4gY2xpZW50IGNsYXNzXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgQ2xpZW50IGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcclxuICAvKiogQ2xpZW50IG9wdGlvbnMgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgb3B0aW9uczogQ2xpZW50T3B0aW9ucztcclxuICBcclxuICAvKiogUkVTVCBBUEkgY2xpZW50ICovXHJcbiAgcHVibGljIHJlYWRvbmx5IHJlc3Q6IFJFU1Q7XHJcbiAgXHJcbiAgLyoqIFRoZSBib3QgdXNlciAqL1xyXG4gIHB1YmxpYyB1c2VyOiBVc2VyIHwgbnVsbCA9IG51bGw7XHJcbiAgXHJcbiAgLyoqIEFwcGxpY2F0aW9uIElEICovXHJcbiAgcHVibGljIGFwcGxpY2F0aW9uSWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xyXG4gIFxyXG4gIC8qKiBDYWNoZWQgZ3VpbGRzICovXHJcbiAgcHVibGljIGd1aWxkczogQ29sbGVjdGlvbjxzdHJpbmcsIEd1aWxkPiA9IG5ldyBDb2xsZWN0aW9uKCk7XHJcbiAgXHJcbiAgLyoqIENhY2hlZCBjaGFubmVscyAqL1xyXG4gIHB1YmxpYyBjaGFubmVsczogQ29sbGVjdGlvbjxzdHJpbmcsIEJhc2VDaGFubmVsPiA9IG5ldyBDb2xsZWN0aW9uKCk7XHJcbiAgXHJcbiAgLyoqIENhY2hlZCB1c2VycyAqL1xyXG4gIHB1YmxpYyB1c2VyczogQ29sbGVjdGlvbjxzdHJpbmcsIFVzZXI+ID0gbmV3IENvbGxlY3Rpb24oKTtcclxuICBcclxuICAvKiogVm9pY2UgYWRhcHRlciBtYW5hZ2VtZW50ICovXHJcbiAgcHVibGljIHZvaWNlOiB7XHJcbiAgICBhZGFwdGVyczogTWFwPHN0cmluZywgVm9pY2VBZGFwdGVyQ3JlYXRvcj47XHJcbiAgfTtcclxuICBcclxuICAvKiogV2ViU29ja2V0IGNvbm5lY3Rpb24gKi9cclxuICBwcml2YXRlIHdzOiBXZWJTb2NrZXQgfCBudWxsID0gbnVsbDtcclxuICBcclxuICAvKiogQm90IHRva2VuICovXHJcbiAgcHJpdmF0ZSB0b2tlbjogc3RyaW5nID0gJyc7XHJcbiAgXHJcbiAgLyoqIFNlc3Npb24gSUQgKi9cclxuICBwcml2YXRlIHNlc3Npb25JZDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XHJcbiAgXHJcbiAgLyoqIFNlcXVlbmNlIG51bWJlciAqL1xyXG4gIHByaXZhdGUgc2VxdWVuY2U6IG51bWJlciB8IG51bGwgPSBudWxsO1xyXG4gIFxyXG4gIC8qKiBIZWFydGJlYXQgaW50ZXJ2YWwgKi9cclxuICBwcml2YXRlIGhlYXJ0YmVhdEludGVydmFsOiBOb2RlSlMuVGltZW91dCB8IG51bGwgPSBudWxsO1xyXG4gIFxyXG4gIC8qKiBHYXRld2F5IFVSTCAqL1xyXG4gIHByaXZhdGUgZ2F0ZXdheVVybDogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBWb2ljZSBzdGF0ZSB1cGRhdGUgaGFuZGxlcnMgKGZvciB2b2ljZSBhZGFwdGVycykgKi9cclxuICBwcml2YXRlIHZvaWNlU3RhdGVIYW5kbGVyczogTWFwPHN0cmluZywgKGRhdGE6IGFueSkgPT4gdm9pZD4gPSBuZXcgTWFwKCk7XHJcbiAgcHJpdmF0ZSB2b2ljZVNlcnZlckhhbmRsZXJzOiBNYXA8c3RyaW5nLCAoZGF0YTogYW55KSA9PiB2b2lkPiA9IG5ldyBNYXAoKTtcclxuXHJcbiAgY29uc3RydWN0b3Iob3B0aW9uczogQ2xpZW50T3B0aW9ucykge1xyXG4gICAgc3VwZXIoKTtcclxuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XHJcbiAgICB0aGlzLmdhdGV3YXlVcmwgPSBvcHRpb25zLmdhdGV3YXlVcmwgfHwgJ3dzczovL3JlYWx0aW1lLmp1YmJpby5jb20vd3MvYm90JztcclxuICAgIHRoaXMucmVzdCA9IG5ldyBSRVNUKG9wdGlvbnMuYXBpVXJsKTtcclxuICAgIFxyXG4gICAgLy8gSW5pdGlhbGl6ZSB2b2ljZSBhZGFwdGVyIHN5c3RlbVxyXG4gICAgdGhpcy52b2ljZSA9IHtcclxuICAgICAgYWRhcHRlcnM6IG5ldyBNYXAoKVxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENhbGN1bGF0ZSBpbnRlbnRzIHZhbHVlXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBnZXRJbnRlbnRzVmFsdWUoKTogbnVtYmVyIHtcclxuICAgIGlmICh0eXBlb2YgdGhpcy5vcHRpb25zLmludGVudHMgPT09ICdudW1iZXInKSB7XHJcbiAgICAgIHJldHVybiB0aGlzLm9wdGlvbnMuaW50ZW50cztcclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzLm9wdGlvbnMuaW50ZW50cy5yZWR1Y2UoKGFjYywgaW50ZW50KSA9PiBhY2MgfCBpbnRlbnQsIDApO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogTG9naW4gdG8gdGhlIGdhdGV3YXlcclxuICAgKi9cclxuICBhc3luYyBsb2dpbih0b2tlbjogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcclxuICAgIHRoaXMudG9rZW4gPSB0b2tlbi5yZXBsYWNlKC9eQm90XFxzKy9pLCAnJyk7XHJcbiAgICB0aGlzLnJlc3Quc2V0VG9rZW4odGhpcy50b2tlbik7XHJcbiAgICBcclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgIHRoaXMuY29ubmVjdCgpO1xyXG4gICAgICBcclxuICAgICAgLy8gV2FpdCBmb3IgcmVhZHkgZXZlbnRcclxuICAgICAgY29uc3QgdGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgIHJlamVjdChuZXcgRXJyb3IoJ0xvZ2luIHRpbWVvdXQnKSk7XHJcbiAgICAgIH0sIDMwMDAwKTtcclxuICAgICAgXHJcbiAgICAgIHRoaXMub25jZSgncmVhZHknLCAoKSA9PiB7XHJcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xyXG4gICAgICAgIHJlc29sdmUodGhpcy50b2tlbik7XHJcbiAgICAgIH0pO1xyXG4gICAgICBcclxuICAgICAgdGhpcy5vbmNlKCdlcnJvcicsIChlcnJvcikgPT4ge1xyXG4gICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcclxuICAgICAgICByZWplY3QoZXJyb3IpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ29ubmVjdCB0byB0aGUgZ2F0ZXdheVxyXG4gICAqL1xyXG4gIHByaXZhdGUgY29ubmVjdCgpOiB2b2lkIHtcclxuICAgIHRoaXMud3MgPSBuZXcgV2ViU29ja2V0KHRoaXMuZ2F0ZXdheVVybCk7XHJcbiAgICBcclxuICAgIHRoaXMud3Mub24oJ29wZW4nLCAoKSA9PiB7XHJcbiAgICAgIHRoaXMuZW1pdCgnZGVidWcnLCAnV2ViU29ja2V0IGNvbm5lY3Rpb24gb3BlbmVkJyk7XHJcbiAgICB9KTtcclxuICAgIFxyXG4gICAgdGhpcy53cy5vbignbWVzc2FnZScsIChkYXRhKSA9PiB7XHJcbiAgICAgIHRoaXMuaGFuZGxlTWVzc2FnZShkYXRhLnRvU3RyaW5nKCkpO1xyXG4gICAgfSk7XHJcbiAgICBcclxuICAgIHRoaXMud3Mub24oJ2Nsb3NlJywgKGNvZGUsIHJlYXNvbikgPT4ge1xyXG4gICAgICB0aGlzLmVtaXQoJ2RlYnVnJywgYFdlYlNvY2tldCBjbG9zZWQ6ICR7Y29kZX0gLSAke3JlYXNvbn1gKTtcclxuICAgICAgdGhpcy5jbGVhbnVwKCk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBSZWNvbm5lY3Qgb24gY2VydGFpbiBjbG9zZSBjb2Rlc1xyXG4gICAgICBpZiAoY29kZSAhPT0gMTAwMCAmJiBjb2RlICE9PSA0MDA0KSB7XHJcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB0aGlzLmNvbm5lY3QoKSwgNTAwMCk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgXHJcbiAgICB0aGlzLndzLm9uKCdlcnJvcicsIChlcnJvcikgPT4ge1xyXG4gICAgICB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyb3IpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBIYW5kbGUgaW5jb21pbmcgZ2F0ZXdheSBtZXNzYWdlXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBoYW5kbGVNZXNzYWdlKGRhdGE6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgLy8gSGFuZGxlIG11bHRpcGxlIG1lc3NhZ2VzIGluIG9uZSBmcmFtZVxyXG4gICAgY29uc3QgbWVzc2FnZXMgPSBkYXRhLnNwbGl0KCdcXG4nKS5maWx0ZXIobSA9PiBtLnRyaW0oKSk7XHJcbiAgICBcclxuICAgIGZvciAoY29uc3QgbXNnIG9mIG1lc3NhZ2VzKSB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgcGF5bG9hZDogR2F0ZXdheVBheWxvYWQgPSBKU09OLnBhcnNlKG1zZyk7XHJcbiAgICAgICAgdGhpcy5oYW5kbGVQYXlsb2FkKHBheWxvYWQpO1xyXG4gICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgdGhpcy5lbWl0KCdkZWJ1ZycsIGBGYWlsZWQgdG8gcGFyc2UgbWVzc2FnZTogJHttc2d9YCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZSBnYXRld2F5IHBheWxvYWRcclxuICAgKi9cclxuICBwcml2YXRlIGhhbmRsZVBheWxvYWQocGF5bG9hZDogR2F0ZXdheVBheWxvYWQpOiB2b2lkIHtcclxuICAgIGlmIChwYXlsb2FkLnMpIHtcclxuICAgICAgdGhpcy5zZXF1ZW5jZSA9IHBheWxvYWQucztcclxuICAgIH1cclxuXHJcbiAgICBzd2l0Y2ggKHBheWxvYWQub3ApIHtcclxuICAgICAgY2FzZSBHYXRld2F5T3Bjb2Rlcy5IZWxsbzpcclxuICAgICAgICB0aGlzLmhhbmRsZUhlbGxvKHBheWxvYWQuZCk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgR2F0ZXdheU9wY29kZXMuRGlzcGF0Y2g6XHJcbiAgICAgICAgdGhpcy5oYW5kbGVEaXNwYXRjaChwYXlsb2FkLnQhLCBwYXlsb2FkLmQpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlIEdhdGV3YXlPcGNvZGVzLkhlYXJ0YmVhdEFjazpcclxuICAgICAgICB0aGlzLmVtaXQoJ2RlYnVnJywgJ0hlYXJ0YmVhdCBhY2tub3dsZWRnZWQnKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSBHYXRld2F5T3Bjb2Rlcy5JbnZhbGlkU2Vzc2lvbjpcclxuICAgICAgICB0aGlzLmVtaXQoJ2RlYnVnJywgJ0ludmFsaWQgc2Vzc2lvbiwgcmUtaWRlbnRpZnlpbmcuLi4nKTtcclxuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHRoaXMuaWRlbnRpZnkoKSwgNTAwMCk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgR2F0ZXdheU9wY29kZXMuUmVjb25uZWN0OlxyXG4gICAgICAgIHRoaXMuZW1pdCgnZGVidWcnLCAnUmVjb25uZWN0IHJlcXVlc3RlZCcpO1xyXG4gICAgICAgIHRoaXMud3M/LmNsb3NlKCk7XHJcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB0aGlzLmNvbm5lY3QoKSwgMTAwMCk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBIYW5kbGUgSGVsbG8gcGF5bG9hZFxyXG4gICAqL1xyXG4gIHByaXZhdGUgaGFuZGxlSGVsbG8oZGF0YTogeyBoZWFydGJlYXRfaW50ZXJ2YWw6IG51bWJlciB9KTogdm9pZCB7XHJcbiAgICB0aGlzLmVtaXQoJ2RlYnVnJywgYFJlY2VpdmVkIEhlbGxvLCBoZWFydGJlYXQgaW50ZXJ2YWw6ICR7ZGF0YS5oZWFydGJlYXRfaW50ZXJ2YWx9bXNgKTtcclxuICAgIHRoaXMuc3RhcnRIZWFydGJlYXQoZGF0YS5oZWFydGJlYXRfaW50ZXJ2YWwpO1xyXG4gICAgdGhpcy5pZGVudGlmeSgpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSGFuZGxlIERpc3BhdGNoIGV2ZW50c1xyXG4gICAqL1xyXG4gIHByaXZhdGUgaGFuZGxlRGlzcGF0Y2goZXZlbnRUeXBlOiBzdHJpbmcsIGRhdGE6IGFueSk6IHZvaWQge1xyXG4gICAgdGhpcy5lbWl0KCdkZWJ1ZycsIGBEaXNwYXRjaDogJHtldmVudFR5cGV9YCk7XHJcbiAgICBcclxuICAgIHN3aXRjaCAoZXZlbnRUeXBlKSB7XHJcbiAgICAgIGNhc2UgJ1JFQURZJzpcclxuICAgICAgICB0aGlzLmhhbmRsZVJlYWR5KGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdHVUlMRF9DUkVBVEUnOlxyXG4gICAgICAgIHRoaXMuaGFuZGxlR3VpbGRDcmVhdGUoZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ0dVSUxEX1VQREFURSc6XHJcbiAgICAgICAgdGhpcy5oYW5kbGVHdWlsZFVwZGF0ZShkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnR1VJTERfREVMRVRFJzpcclxuICAgICAgICB0aGlzLmhhbmRsZUd1aWxkRGVsZXRlKGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdNRVNTQUdFX0NSRUFURSc6XHJcbiAgICAgICAgdGhpcy5oYW5kbGVNZXNzYWdlQ3JlYXRlKGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdNRVNTQUdFX1VQREFURSc6XHJcbiAgICAgICAgdGhpcy5lbWl0KCdtZXNzYWdlVXBkYXRlJywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ01FU1NBR0VfREVMRVRFJzpcclxuICAgICAgICB0aGlzLmVtaXQoJ21lc3NhZ2VEZWxldGUnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnTUVTU0FHRV9ERUxFVEVfQlVMSyc6XHJcbiAgICAgICAgdGhpcy5lbWl0KCdtZXNzYWdlRGVsZXRlQnVsaycsIGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdDSEFOTkVMX0NSRUFURSc6XHJcbiAgICAgICAgdGhpcy5lbWl0KCdjaGFubmVsQ3JlYXRlJywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ0NIQU5ORUxfVVBEQVRFJzpcclxuICAgICAgICB0aGlzLmVtaXQoJ2NoYW5uZWxVcGRhdGUnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnQ0hBTk5FTF9ERUxFVEUnOlxyXG4gICAgICAgIHRoaXMuZW1pdCgnY2hhbm5lbERlbGV0ZScsIGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdHVUlMRF9NRU1CRVJfQUREJzpcclxuICAgICAgICB0aGlzLmVtaXQoJ2d1aWxkTWVtYmVyQWRkJywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ0dVSUxEX01FTUJFUl9VUERBVEUnOlxyXG4gICAgICAgIHRoaXMuZW1pdCgnZ3VpbGRNZW1iZXJVcGRhdGUnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnR1VJTERfTUVNQkVSX1JFTU9WRSc6XHJcbiAgICAgICAgdGhpcy5lbWl0KCdndWlsZE1lbWJlclJlbW92ZScsIGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdHVUlMRF9ST0xFX0NSRUFURSc6XHJcbiAgICAgICAgdGhpcy5lbWl0KCdyb2xlQ3JlYXRlJywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ0dVSUxEX1JPTEVfVVBEQVRFJzpcclxuICAgICAgICB0aGlzLmVtaXQoJ3JvbGVVcGRhdGUnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnR1VJTERfUk9MRV9ERUxFVEUnOlxyXG4gICAgICAgIHRoaXMuZW1pdCgncm9sZURlbGV0ZScsIGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdHVUlMRF9CQU5fQUREJzpcclxuICAgICAgICB0aGlzLmVtaXQoJ2d1aWxkQmFuQWRkJywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ0dVSUxEX0JBTl9SRU1PVkUnOlxyXG4gICAgICAgIHRoaXMuZW1pdCgnZ3VpbGRCYW5SZW1vdmUnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnSU5WSVRFX0NSRUFURSc6XHJcbiAgICAgICAgdGhpcy5lbWl0KCdpbnZpdGVDcmVhdGUnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnSU5WSVRFX0RFTEVURSc6XHJcbiAgICAgICAgdGhpcy5lbWl0KCdpbnZpdGVEZWxldGUnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnVEhSRUFEX0NSRUFURSc6XHJcbiAgICAgICAgdGhpcy5lbWl0KCd0aHJlYWRDcmVhdGUnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnVEhSRUFEX1VQREFURSc6XHJcbiAgICAgICAgdGhpcy5lbWl0KCd0aHJlYWRVcGRhdGUnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnVEhSRUFEX0RFTEVURSc6XHJcbiAgICAgICAgdGhpcy5lbWl0KCd0aHJlYWREZWxldGUnLCBkYXRhKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgICBcclxuICAgICAgY2FzZSAnVFlQSU5HX1NUQVJUJzpcclxuICAgICAgICB0aGlzLmVtaXQoJ3R5cGluZ1N0YXJ0JywgZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ1BSRVNFTkNFX1VQREFURSc6XHJcbiAgICAgICAgdGhpcy5lbWl0KCdwcmVzZW5jZVVwZGF0ZScsIGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdJTlRFUkFDVElPTl9DUkVBVEUnOlxyXG4gICAgICAgIHRoaXMuaGFuZGxlSW50ZXJhY3Rpb25DcmVhdGUoZGF0YSk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgXHJcbiAgICAgIGNhc2UgJ1ZPSUNFX1NUQVRFX1VQREFURSc6XHJcbiAgICAgICAgdGhpcy5oYW5kbGVWb2ljZVN0YXRlVXBkYXRlKGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBjYXNlICdWT0lDRV9TRVJWRVJfVVBEQVRFJzpcclxuICAgICAgICB0aGlzLmhhbmRsZVZvaWNlU2VydmVyVXBkYXRlKGRhdGEpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICAgIFxyXG4gICAgICBkZWZhdWx0OlxyXG4gICAgICAgIC8vIEVtaXQgcmF3IGV2ZW50IGZvciB1bmhhbmRsZWQgdHlwZXNcclxuICAgICAgICB0aGlzLmVtaXQoJ3JhdycsIHsgdDogZXZlbnRUeXBlLCBkOiBkYXRhIH0pO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSGFuZGxlIFJlYWR5IGV2ZW50XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBoYW5kbGVSZWFkeShkYXRhOiBSZWFkeUV2ZW50RGF0YSk6IHZvaWQge1xyXG4gICAgdGhpcy5zZXNzaW9uSWQgPSBkYXRhLnNlc3Npb25faWQ7XHJcbiAgICB0aGlzLnVzZXIgPSBuZXcgVXNlcihkYXRhLnVzZXIpO1xyXG4gICAgLy8gSGFuZGxlIGJvdGggc3RyaW5nIGFuZCBudW1iZXIgYXBwbGljYXRpb24gSURzXHJcbiAgICB0aGlzLmFwcGxpY2F0aW9uSWQgPSBkYXRhLmFwcGxpY2F0aW9uPy5pZCA/IFN0cmluZyhkYXRhLmFwcGxpY2F0aW9uLmlkKSA6IG51bGw7XHJcbiAgICBpZiAodGhpcy5hcHBsaWNhdGlvbklkKSB7XHJcbiAgICAgIHRoaXMucmVzdC5zZXRBcHBsaWNhdGlvbklkKHRoaXMuYXBwbGljYXRpb25JZCk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIENhY2hlIGd1aWxkcyAoYXMgdW5hdmFpbGFibGUgaW5pdGlhbGx5KVxyXG4gICAgaWYgKGRhdGEuZ3VpbGRzKSB7XHJcbiAgICAgIGZvciAoY29uc3QgZ3VpbGQgb2YgZGF0YS5ndWlsZHMpIHtcclxuICAgICAgICB0aGlzLmd1aWxkcy5zZXQoU3RyaW5nKGd1aWxkLmlkKSwgbmV3IEd1aWxkKHRoaXMsIGd1aWxkKSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIFxyXG4gICAgLy8gU2V0dXAgdm9pY2UgYWRhcHRlcnMgZm9yIGVhY2ggZ3VpbGRcclxuICAgIHRoaXMuc2V0dXBWb2ljZUFkYXB0ZXJzKCk7XHJcbiAgICBcclxuICAgIGNvbnNvbGUubG9nKGDinIUgQm90IGhhesSxciEgVXNlcjogJHt0aGlzLnVzZXIudXNlcm5hbWV9ICgke3RoaXMudXNlci5pZH0pLCBBcHA6ICR7dGhpcy5hcHBsaWNhdGlvbklkfWApO1xyXG4gICAgdGhpcy5lbWl0KCdyZWFkeScsIHRoaXMpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2V0dXAgdm9pY2UgYWRhcHRlcnMgZm9yIGFsbCBndWlsZHNcclxuICAgKi9cclxuICBwcml2YXRlIHNldHVwVm9pY2VBZGFwdGVycygpOiB2b2lkIHtcclxuICAgIGZvciAoY29uc3QgW2d1aWxkSWRdIG9mIHRoaXMuZ3VpbGRzKSB7XHJcbiAgICAgIHRoaXMuY3JlYXRlVm9pY2VBZGFwdGVyKGd1aWxkSWQpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgdm9pY2UgYWRhcHRlciBmb3IgYSBndWlsZFxyXG4gICAqL1xyXG4gIHByaXZhdGUgY3JlYXRlVm9pY2VBZGFwdGVyKGd1aWxkSWQ6IHN0cmluZyk6IHZvaWQge1xyXG4gICAgY29uc3QgYWRhcHRlcjogVm9pY2VBZGFwdGVyQ3JlYXRvciA9IChtZXRob2RzKSA9PiB7XHJcbiAgICAgIC8vIFN0b3JlIGhhbmRsZXJzIGZvciB0aGlzIGd1aWxkXHJcbiAgICAgIHRoaXMudm9pY2VTdGF0ZUhhbmRsZXJzLnNldChndWlsZElkLCBtZXRob2RzLm9uVm9pY2VTdGF0ZVVwZGF0ZSk7XHJcbiAgICAgIHRoaXMudm9pY2VTZXJ2ZXJIYW5kbGVycy5zZXQoZ3VpbGRJZCwgbWV0aG9kcy5vblZvaWNlU2VydmVyVXBkYXRlKTtcclxuICAgICAgXHJcbiAgICAgIHJldHVybiB7XHJcbiAgICAgICAgc2VuZFBheWxvYWQ6IChwYXlsb2FkKSA9PiB7XHJcbiAgICAgICAgICBpZiAodGhpcy53cz8ucmVhZHlTdGF0ZSA9PT0gV2ViU29ja2V0Lk9QRU4pIHtcclxuICAgICAgICAgICAgdGhpcy53cy5zZW5kKEpTT04uc3RyaW5naWZ5KHBheWxvYWQpKTtcclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBkZXN0cm95OiAoKSA9PiB7XHJcbiAgICAgICAgICB0aGlzLnZvaWNlU3RhdGVIYW5kbGVycy5kZWxldGUoZ3VpbGRJZCk7XHJcbiAgICAgICAgICB0aGlzLnZvaWNlU2VydmVySGFuZGxlcnMuZGVsZXRlKGd1aWxkSWQpO1xyXG4gICAgICAgIH1cclxuICAgICAgfTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIHRoaXMudm9pY2UuYWRhcHRlcnMuc2V0KGd1aWxkSWQsIGFkYXB0ZXIpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSGFuZGxlIEd1aWxkIENyZWF0ZSBldmVudFxyXG4gICAqL1xyXG4gIHByaXZhdGUgaGFuZGxlR3VpbGRDcmVhdGUoZGF0YTogQVBJR3VpbGQpOiB2b2lkIHtcclxuICAgIGxldCBndWlsZCA9IHRoaXMuZ3VpbGRzLmdldChkYXRhLmlkKTtcclxuICAgIFxyXG4gICAgaWYgKGd1aWxkKSB7XHJcbiAgICAgIGd1aWxkLl9wYXRjaChkYXRhKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGd1aWxkID0gbmV3IEd1aWxkKHRoaXMsIGRhdGEpO1xyXG4gICAgICB0aGlzLmd1aWxkcy5zZXQoZGF0YS5pZCwgZ3VpbGQpO1xyXG4gICAgICB0aGlzLmNyZWF0ZVZvaWNlQWRhcHRlcihkYXRhLmlkKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgdGhpcy5lbWl0KCdndWlsZENyZWF0ZScsIGd1aWxkKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZSBHdWlsZCBVcGRhdGUgZXZlbnRcclxuICAgKi9cclxuICBwcml2YXRlIGhhbmRsZUd1aWxkVXBkYXRlKGRhdGE6IEFQSUd1aWxkKTogdm9pZCB7XHJcbiAgICBjb25zdCBndWlsZCA9IHRoaXMuZ3VpbGRzLmdldChkYXRhLmlkKTtcclxuICAgIGlmIChndWlsZCkge1xyXG4gICAgICBndWlsZC5fcGF0Y2goZGF0YSk7XHJcbiAgICAgIHRoaXMuZW1pdCgnZ3VpbGRVcGRhdGUnLCBndWlsZCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBIYW5kbGUgR3VpbGQgRGVsZXRlIGV2ZW50XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBoYW5kbGVHdWlsZERlbGV0ZShkYXRhOiB7IGlkOiBzdHJpbmcgfSk6IHZvaWQge1xyXG4gICAgY29uc3QgZ3VpbGQgPSB0aGlzLmd1aWxkcy5nZXQoZGF0YS5pZCk7XHJcbiAgICBpZiAoZ3VpbGQpIHtcclxuICAgICAgdGhpcy5ndWlsZHMuZGVsZXRlKGRhdGEuaWQpO1xyXG4gICAgICB0aGlzLnZvaWNlLmFkYXB0ZXJzLmRlbGV0ZShkYXRhLmlkKTtcclxuICAgICAgdGhpcy5lbWl0KCdndWlsZERlbGV0ZScsIGd1aWxkKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZSBNZXNzYWdlIENyZWF0ZSBldmVudFxyXG4gICAqL1xyXG4gIHByaXZhdGUgaGFuZGxlTWVzc2FnZUNyZWF0ZShkYXRhOiBBUElNZXNzYWdlKTogdm9pZCB7XHJcbiAgICAvLyBCYWNrZW5kIHNlbmRzIHVzZXJfaWQgc2VwYXJhdGVseSwgbWFwIGl0IHRvIGF1dGhvci5pZCBmb3IgY29tcGF0aWJpbGl0eVxyXG4gICAgaWYgKGRhdGEudXNlcl9pZCAmJiBkYXRhLmF1dGhvciAmJiAhZGF0YS5hdXRob3IuaWQpIHtcclxuICAgICAgKGRhdGEuYXV0aG9yIGFzIGFueSkuaWQgPSBkYXRhLnVzZXJfaWQ7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIC8vIENhY2hlIHRoZSBhdXRob3JcclxuICAgIGlmIChkYXRhLmF1dGhvcikge1xyXG4gICAgICBjb25zdCB1c2VyID0gbmV3IFVzZXIoZGF0YS5hdXRob3IpO1xyXG4gICAgICB0aGlzLnVzZXJzLnNldCh1c2VyLmlkLCB1c2VyKTtcclxuICAgICAgLy8gQWxzbyBjYWNoZSBpbiBSRVNUIGZvciBtZW50aW9uIHJlc29sdXRpb25cclxuICAgICAgdGhpcy5yZXN0LmNhY2hlVXNlcihkYXRhLmF1dGhvcik7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIGNvbnN0IG1lc3NhZ2UgPSBuZXcgTWVzc2FnZSh0aGlzLCBkYXRhKTtcclxuICAgIHRoaXMuZW1pdCgnbWVzc2FnZUNyZWF0ZScsIG1lc3NhZ2UpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSGFuZGxlIEludGVyYWN0aW9uIENyZWF0ZSBldmVudFxyXG4gICAqL1xyXG4gIHByaXZhdGUgaGFuZGxlSW50ZXJhY3Rpb25DcmVhdGUoZGF0YTogQVBJSW50ZXJhY3Rpb24pOiB2b2lkIHtcclxuICAgIGNvbnNvbGUubG9nKCdbREVCVUddIGhhbmRsZUludGVyYWN0aW9uQ3JlYXRlIGNhbGxlZCB3aXRoOicsIEpTT04uc3RyaW5naWZ5KGRhdGEsIG51bGwsIDIpKTtcclxuICAgIFxyXG4gICAgLy8gQ2FjaGUgdGhlIHVzZXJcclxuICAgIGNvbnN0IHVzZXJEYXRhID0gZGF0YS5tZW1iZXI/LnVzZXIgfHwgZGF0YS51c2VyO1xyXG4gICAgaWYgKHVzZXJEYXRhKSB7XHJcbiAgICAgIGNvbnN0IHVzZXIgPSBuZXcgVXNlcih1c2VyRGF0YSk7XHJcbiAgICAgIHRoaXMudXNlcnMuc2V0KHVzZXIuaWQsIHVzZXIpO1xyXG4gICAgICB0aGlzLnJlc3QuY2FjaGVVc2VyKHVzZXJEYXRhKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgY29uc3QgaW50ZXJhY3Rpb24gPSBjcmVhdGVJbnRlcmFjdGlvbih0aGlzLCBkYXRhKTtcclxuICAgIGNvbnNvbGUubG9nKCdbREVCVUddIENyZWF0ZWQgaW50ZXJhY3Rpb24gdHlwZTonLCBpbnRlcmFjdGlvbi5jb25zdHJ1Y3Rvci5uYW1lLCAnY3VzdG9tSWQ6JywgKGludGVyYWN0aW9uIGFzIGFueSkuY3VzdG9tSWQpO1xyXG4gICAgdGhpcy5lbWl0KCdpbnRlcmFjdGlvbkNyZWF0ZScsIGludGVyYWN0aW9uKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZSBWb2ljZSBTdGF0ZSBVcGRhdGUgZXZlbnRcclxuICAgKi9cclxuICBwcml2YXRlIGhhbmRsZVZvaWNlU3RhdGVVcGRhdGUoZGF0YTogYW55KTogdm9pZCB7XHJcbiAgICBjb25zdCBndWlsZElkID0gZGF0YS5ndWlsZF9pZDtcclxuICAgIFxyXG4gICAgLy8gRm9yd2FyZCB0byB2b2ljZSBhZGFwdGVyIGlmIGV4aXN0c1xyXG4gICAgY29uc3QgaGFuZGxlciA9IHRoaXMudm9pY2VTdGF0ZUhhbmRsZXJzLmdldChndWlsZElkKTtcclxuICAgIGlmIChoYW5kbGVyKSB7XHJcbiAgICAgIGhhbmRsZXIoZGF0YSk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHRoaXMuZW1pdCgndm9pY2VTdGF0ZVVwZGF0ZScsIGRhdGEpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSGFuZGxlIFZvaWNlIFNlcnZlciBVcGRhdGUgZXZlbnRcclxuICAgKi9cclxuICBwcml2YXRlIGhhbmRsZVZvaWNlU2VydmVyVXBkYXRlKGRhdGE6IEFQSVZvaWNlU2VydmVyVXBkYXRlKTogdm9pZCB7XHJcbiAgICBjb25zdCBndWlsZElkID0gZGF0YS5ndWlsZF9pZDtcclxuICAgIFxyXG4gICAgLy8gRm9yd2FyZCB0byB2b2ljZSBhZGFwdGVyIGlmIGV4aXN0c1xyXG4gICAgY29uc3QgaGFuZGxlciA9IHRoaXMudm9pY2VTZXJ2ZXJIYW5kbGVycy5nZXQoZ3VpbGRJZCk7XHJcbiAgICBpZiAoaGFuZGxlcikge1xyXG4gICAgICBoYW5kbGVyKHtcclxuICAgICAgICB0b2tlbjogZGF0YS50b2tlbixcclxuICAgICAgICBlbmRwb2ludDogZGF0YS5lbmRwb2ludCxcclxuICAgICAgICByb29tOiBkYXRhLnJvb21cclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHRoaXMuZW1pdCgndm9pY2VTZXJ2ZXJVcGRhdGUnLCBkYXRhKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNlbmQgSWRlbnRpZnkgcGF5bG9hZFxyXG4gICAqL1xyXG4gIHByaXZhdGUgaWRlbnRpZnkoKTogdm9pZCB7XHJcbiAgICBjb25zdCBwYXlsb2FkOiBHYXRld2F5UGF5bG9hZCA9IHtcclxuICAgICAgb3A6IEdhdGV3YXlPcGNvZGVzLklkZW50aWZ5LFxyXG4gICAgICBkOiB7XHJcbiAgICAgICAgdG9rZW46IGBCb3QgJHt0aGlzLnRva2VufWAsXHJcbiAgICAgICAgaW50ZW50czogdGhpcy5nZXRJbnRlbnRzVmFsdWUoKSxcclxuICAgICAgICBzaGFyZDogdGhpcy5vcHRpb25zLnNoYXJkcyB8fCBbMCwgMV1cclxuICAgICAgfVxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgdGhpcy5zZW5kKHBheWxvYWQpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU3RhcnQgaGVhcnRiZWF0XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBzdGFydEhlYXJ0YmVhdChpbnRlcnZhbDogbnVtYmVyKTogdm9pZCB7XHJcbiAgICB0aGlzLmhlYXJ0YmVhdEludGVydmFsID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xyXG4gICAgICB0aGlzLnNlbmQoe1xyXG4gICAgICAgIG9wOiBHYXRld2F5T3Bjb2Rlcy5IZWFydGJlYXQsXHJcbiAgICAgICAgZDogdGhpcy5zZXF1ZW5jZVxyXG4gICAgICB9KTtcclxuICAgIH0sIGludGVydmFsKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNlbmQgcGF5bG9hZCB0byBnYXRld2F5XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBzZW5kKHBheWxvYWQ6IEdhdGV3YXlQYXlsb2FkKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy53cz8ucmVhZHlTdGF0ZSA9PT0gV2ViU29ja2V0Lk9QRU4pIHtcclxuICAgICAgdGhpcy53cy5zZW5kKEpTT04uc3RyaW5naWZ5KHBheWxvYWQpKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENsZWFudXAgb24gZGlzY29ubmVjdFxyXG4gICAqL1xyXG4gIHByaXZhdGUgY2xlYW51cCgpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLmhlYXJ0YmVhdEludGVydmFsKSB7XHJcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy5oZWFydGJlYXRJbnRlcnZhbCk7XHJcbiAgICAgIHRoaXMuaGVhcnRiZWF0SW50ZXJ2YWwgPSBudWxsO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVzdHJveSB0aGUgY2xpZW50XHJcbiAgICovXHJcbiAgZGVzdHJveSgpOiB2b2lkIHtcclxuICAgIHRoaXMuY2xlYW51cCgpO1xyXG4gICAgdGhpcy53cz8uY2xvc2UoMTAwMCk7XHJcbiAgICB0aGlzLndzID0gbnVsbDtcclxuICAgIHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCk7XHJcbiAgfVxyXG59XHJcblxyXG4vLyBSZS1leHBvcnQgZm9yIGNvbnZlbmllbmNlXHJcbmV4cG9ydCB7IEdhdGV3YXlJbnRlbnRCaXRzIH07XHJcbiJdfQ==