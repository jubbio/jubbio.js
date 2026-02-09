"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceConnection = void 0;
exports.joinVoiceChannel = joinVoiceChannel;
exports.getVoiceConnection = getVoiceConnection;
const events_1 = require("events");
const rtc_node_1 = require("@livekit/rtc-node");
const enums_1 = require("./enums");
/**
 * Represents a voice connection to a channel
 */
class VoiceConnection extends events_1.EventEmitter {
    /** Current connection state */
    state = { status: enums_1.VoiceConnectionStatus.Connecting };
    /** The channel ID this connection is for */
    channelId;
    /** The guild ID this connection is for */
    guildId;
    /** LiveKit room instance */
    room = null;
    /** LiveKit connection info */
    livekitEndpoint = null;
    livekitToken = null;
    livekitRoomName = null;
    /** Subscribed audio player */
    subscribedPlayer = null;
    /** Gateway adapter methods */
    adapterMethods;
    /** Adapter implementer (for sending payloads) */
    adapter = null;
    constructor(options) {
        super();
        this.channelId = options.channelId;
        this.guildId = options.guildId;
        // Create adapter methods that will receive gateway events
        this.adapterMethods = {
            onVoiceServerUpdate: (data) => this.handleVoiceServerUpdate(data),
            onVoiceStateUpdate: (data) => this.handleVoiceStateUpdate(data),
            destroy: () => this.destroy()
        };
        // Get adapter from creator
        this.adapter = options.adapterCreator(this.adapterMethods);
        // Send voice state update to join channel
        this.sendVoiceStateUpdate(options.channelId, options.selfMute, options.selfDeaf);
    }
    /**
     * Subscribe an audio player to this connection
     */
    subscribe(player) {
        if (this.subscribedPlayer) {
            this.subscribedPlayer.unsubscribe(this);
        }
        this.subscribedPlayer = player;
        player.subscribe(this);
    }
    /**
     * Unsubscribe the current audio player
     */
    unsubscribe() {
        if (this.subscribedPlayer) {
            this.subscribedPlayer.unsubscribe(this);
            this.subscribedPlayer = null;
        }
    }
    /**
     * Get the LiveKit room (for audio player to publish tracks)
     */
    getRoom() {
        return this.room;
    }
    /**
     * Disconnect from the voice channel
     */
    disconnect() {
        this.sendVoiceStateUpdate(null);
        return true;
    }
    /**
     * Destroy the connection completely
     */
    destroy() {
        this.unsubscribe();
        this.disconnectFromLiveKit();
        this.adapter?.destroy();
        this.setState({ status: enums_1.VoiceConnectionStatus.Destroyed });
    }
    /**
     * Rejoin the voice channel (after disconnect)
     */
    rejoin() {
        this.sendVoiceStateUpdate(this.channelId);
        return true;
    }
    sendVoiceStateUpdate(channelId, selfMute = false, selfDeaf = false) {
        if (!this.adapter)
            return;
        this.adapter.sendPayload({
            op: 4, // VOICE_STATE_UPDATE
            d: {
                guild_id: this.guildId,
                channel_id: channelId,
                self_mute: selfMute,
                self_deaf: selfDeaf
            }
        });
    }
    handleVoiceServerUpdate(data) {
        this.livekitEndpoint = data.endpoint;
        this.livekitToken = data.token;
        this.livekitRoomName = data.room;
        this.setState({ status: enums_1.VoiceConnectionStatus.Signalling });
        this.connectToLiveKit();
    }
    handleVoiceStateUpdate(data) {
        if (data.channel_id === null) {
            // Disconnected
            this.disconnectFromLiveKit();
            this.setState({ status: enums_1.VoiceConnectionStatus.Disconnected });
        }
    }
    async connectToLiveKit() {
        if (!this.livekitEndpoint || !this.livekitToken) {
            this.emit('error', new Error('Missing LiveKit connection info'));
            return;
        }
        try {
            // Disconnect existing room if any
            await this.disconnectFromLiveKit();
            this.room = new rtc_node_1.Room();
            this.room.on(rtc_node_1.RoomEvent.Disconnected, () => {
                this.setState({ status: enums_1.VoiceConnectionStatus.Disconnected });
            });
            await this.room.connect(this.livekitEndpoint, this.livekitToken);
            this.setState({ status: enums_1.VoiceConnectionStatus.Ready });
            // Notify subscribed player that connection is ready
            if (this.subscribedPlayer) {
                this.subscribedPlayer.onConnectionReady(this);
            }
        }
        catch (error) {
            this.emit('error', error);
            this.setState({ status: enums_1.VoiceConnectionStatus.Disconnected });
        }
    }
    async disconnectFromLiveKit() {
        if (this.room) {
            try {
                await this.room.disconnect();
            }
            catch (e) {
                // Ignore disconnect errors
            }
            this.room = null;
        }
    }
    setState(newState) {
        const oldState = this.state;
        this.state = newState;
        this.emit('stateChange', oldState, newState);
    }
}
exports.VoiceConnection = VoiceConnection;
// Store active connections
const connections = new Map();
/**
 * Join a voice channel - main entry point
 */
function joinVoiceChannel(options) {
    const key = `${options.guildId}:${options.channelId}`;
    // Destroy existing connection if any
    const existing = connections.get(key);
    if (existing) {
        existing.destroy();
        connections.delete(key);
    }
    const connection = new VoiceConnection(options);
    connections.set(key, connection);
    return connection;
}
/**
 * Get an existing voice connection
 */
function getVoiceConnection(guildId) {
    for (const [key, connection] of connections) {
        if (key.startsWith(`${guildId}:`)) {
            return connection;
        }
    }
    return undefined;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVm9pY2VDb25uZWN0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL1ZvaWNlQ29ubmVjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUF1TUEsNENBY0M7QUFLRCxnREFPQztBQWpPRCxtQ0FBc0M7QUFDdEMsZ0RBQW9EO0FBQ3BELG1DQUFnRDtBQVNoRDs7R0FFRztBQUNILE1BQWEsZUFBZ0IsU0FBUSxxQkFBWTtJQUMvQywrQkFBK0I7SUFDeEIsS0FBSyxHQUF5QixFQUFFLE1BQU0sRUFBRSw2QkFBcUIsQ0FBQyxVQUFVLEVBQUUsQ0FBQztJQUVsRiw0Q0FBNEM7SUFDNUIsU0FBUyxDQUFTO0lBRWxDLDBDQUEwQztJQUMxQixPQUFPLENBQVM7SUFFaEMsNEJBQTRCO0lBQ3BCLElBQUksR0FBZ0IsSUFBSSxDQUFDO0lBRWpDLDhCQUE4QjtJQUN0QixlQUFlLEdBQWtCLElBQUksQ0FBQztJQUN0QyxZQUFZLEdBQWtCLElBQUksQ0FBQztJQUNuQyxlQUFlLEdBQWtCLElBQUksQ0FBQztJQUU5Qyw4QkFBOEI7SUFDdEIsZ0JBQWdCLEdBQXVCLElBQUksQ0FBQztJQUVwRCw4QkFBOEI7SUFDdEIsY0FBYyxDQUErQjtJQUVyRCxpREFBaUQ7SUFDekMsT0FBTyxHQUEyRSxJQUFJLENBQUM7SUFFL0YsWUFBWSxPQUFnQztRQUMxQyxLQUFLLEVBQUUsQ0FBQztRQUNSLElBQUksQ0FBQyxTQUFTLEdBQUcsT0FBTyxDQUFDLFNBQVMsQ0FBQztRQUNuQyxJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUM7UUFFL0IsMERBQTBEO1FBQzFELElBQUksQ0FBQyxjQUFjLEdBQUc7WUFDcEIsbUJBQW1CLEVBQUUsQ0FBQyxJQUF1QixFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsSUFBSSxDQUFDO1lBQ3BGLGtCQUFrQixFQUFFLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsc0JBQXNCLENBQUMsSUFBSSxDQUFDO1lBQy9ELE9BQU8sRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFO1NBQzlCLENBQUM7UUFFRiwyQkFBMkI7UUFDM0IsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUUzRCwwQ0FBMEM7UUFDMUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsT0FBTyxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDbkYsQ0FBQztJQUVEOztPQUVHO0lBQ0gsU0FBUyxDQUFDLE1BQW1CO1FBQzNCLElBQUksSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7WUFDMUIsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUMxQyxDQUFDO1FBQ0QsSUFBSSxDQUFDLGdCQUFnQixHQUFHLE1BQU0sQ0FBQztRQUMvQixNQUFNLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3pCLENBQUM7SUFFRDs7T0FFRztJQUNILFdBQVc7UUFDVCxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1lBQzFCLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDeEMsSUFBSSxDQUFDLGdCQUFnQixHQUFHLElBQUksQ0FBQztRQUMvQixDQUFDO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0gsT0FBTztRQUNMLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQztJQUNuQixDQUFDO0lBRUQ7O09BRUc7SUFDSCxVQUFVO1FBQ1IsSUFBSSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2hDLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEOztPQUVHO0lBQ0gsT0FBTztRQUNMLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUNuQixJQUFJLENBQUMscUJBQXFCLEVBQUUsQ0FBQztRQUM3QixJQUFJLENBQUMsT0FBTyxFQUFFLE9BQU8sRUFBRSxDQUFDO1FBQ3hCLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxNQUFNLEVBQUUsNkJBQXFCLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQztJQUM3RCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxNQUFNO1FBQ0osSUFBSSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUMxQyxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFTyxvQkFBb0IsQ0FBQyxTQUF3QixFQUFFLFFBQVEsR0FBRyxLQUFLLEVBQUUsUUFBUSxHQUFHLEtBQUs7UUFDdkYsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPO1lBQUUsT0FBTztRQUUxQixJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQztZQUN2QixFQUFFLEVBQUUsQ0FBQyxFQUFFLHFCQUFxQjtZQUM1QixDQUFDLEVBQUU7Z0JBQ0QsUUFBUSxFQUFFLElBQUksQ0FBQyxPQUFPO2dCQUN0QixVQUFVLEVBQUUsU0FBUztnQkFDckIsU0FBUyxFQUFFLFFBQVE7Z0JBQ25CLFNBQVMsRUFBRSxRQUFRO2FBQ3BCO1NBQ0YsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVPLHVCQUF1QixDQUFDLElBQXVCO1FBQ3JELElBQUksQ0FBQyxlQUFlLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQztRQUNyQyxJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7UUFDL0IsSUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO1FBRWpDLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxNQUFNLEVBQUUsNkJBQXFCLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQztRQUM1RCxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztJQUMxQixDQUFDO0lBRU8sc0JBQXNCLENBQUMsSUFBUztRQUN0QyxJQUFJLElBQUksQ0FBQyxVQUFVLEtBQUssSUFBSSxFQUFFLENBQUM7WUFDN0IsZUFBZTtZQUNmLElBQUksQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO1lBQzdCLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxNQUFNLEVBQUUsNkJBQXFCLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQztRQUNoRSxDQUFDO0lBQ0gsQ0FBQztJQUVPLEtBQUssQ0FBQyxnQkFBZ0I7UUFDNUIsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDaEQsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxLQUFLLENBQUMsaUNBQWlDLENBQUMsQ0FBQyxDQUFDO1lBQ2pFLE9BQU87UUFDVCxDQUFDO1FBRUQsSUFBSSxDQUFDO1lBQ0gsa0NBQWtDO1lBQ2xDLE1BQU0sSUFBSSxDQUFDLHFCQUFxQixFQUFFLENBQUM7WUFFbkMsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLGVBQUksRUFBRSxDQUFDO1lBRXZCLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLG9CQUFTLENBQUMsWUFBWSxFQUFFLEdBQUcsRUFBRTtnQkFDeEMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLE1BQU0sRUFBRSw2QkFBcUIsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDO1lBQ2hFLENBQUMsQ0FBQyxDQUFDO1lBRUgsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsZUFBZSxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUVqRSxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsTUFBTSxFQUFFLDZCQUFxQixDQUFDLEtBQUssRUFBRSxDQUFDLENBQUM7WUFFdkQsb0RBQW9EO1lBQ3BELElBQUksSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7Z0JBQzFCLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNoRCxDQUFDO1FBQ0gsQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDZixJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxLQUFLLENBQUMsQ0FBQztZQUMxQixJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsTUFBTSxFQUFFLDZCQUFxQixDQUFDLFlBQVksRUFBRSxDQUFDLENBQUM7UUFDaEUsQ0FBQztJQUNILENBQUM7SUFFTyxLQUFLLENBQUMscUJBQXFCO1FBQ2pDLElBQUksSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ2QsSUFBSSxDQUFDO2dCQUNILE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUMvQixDQUFDO1lBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztnQkFDWCwyQkFBMkI7WUFDN0IsQ0FBQztZQUNELElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO1FBQ25CLENBQUM7SUFDSCxDQUFDO0lBRU8sUUFBUSxDQUFDLFFBQThCO1FBQzdDLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7UUFDNUIsSUFBSSxDQUFDLEtBQUssR0FBRyxRQUFRLENBQUM7UUFDdEIsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsUUFBUSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQy9DLENBQUM7Q0FDRjtBQWpMRCwwQ0FpTEM7QUFFRCwyQkFBMkI7QUFDM0IsTUFBTSxXQUFXLEdBQUcsSUFBSSxHQUFHLEVBQTJCLENBQUM7QUFFdkQ7O0dBRUc7QUFDSCxTQUFnQixnQkFBZ0IsQ0FBQyxPQUFnQztJQUMvRCxNQUFNLEdBQUcsR0FBRyxHQUFHLE9BQU8sQ0FBQyxPQUFPLElBQUksT0FBTyxDQUFDLFNBQVMsRUFBRSxDQUFDO0lBRXRELHFDQUFxQztJQUNyQyxNQUFNLFFBQVEsR0FBRyxXQUFXLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3RDLElBQUksUUFBUSxFQUFFLENBQUM7UUFDYixRQUFRLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDbkIsV0FBVyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUMxQixDQUFDO0lBRUQsTUFBTSxVQUFVLEdBQUcsSUFBSSxlQUFlLENBQUMsT0FBTyxDQUFDLENBQUM7SUFDaEQsV0FBVyxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsVUFBVSxDQUFDLENBQUM7SUFFakMsT0FBTyxVQUFVLENBQUM7QUFDcEIsQ0FBQztBQUVEOztHQUVHO0FBQ0gsU0FBZ0Isa0JBQWtCLENBQUMsT0FBZTtJQUNoRCxLQUFLLE1BQU0sQ0FBQyxHQUFHLEVBQUUsVUFBVSxDQUFDLElBQUksV0FBVyxFQUFFLENBQUM7UUFDNUMsSUFBSSxHQUFHLENBQUMsVUFBVSxDQUFDLEdBQUcsT0FBTyxHQUFHLENBQUMsRUFBRSxDQUFDO1lBQ2xDLE9BQU8sVUFBVSxDQUFDO1FBQ3BCLENBQUM7SUFDSCxDQUFDO0lBQ0QsT0FBTyxTQUFTLENBQUM7QUFDbkIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gJ2V2ZW50cyc7XHJcbmltcG9ydCB7IFJvb20sIFJvb21FdmVudCB9IGZyb20gJ0BsaXZla2l0L3J0Yy1ub2RlJztcclxuaW1wb3J0IHsgVm9pY2VDb25uZWN0aW9uU3RhdHVzIH0gZnJvbSAnLi9lbnVtcyc7XHJcbmltcG9ydCB7IFxyXG4gIEpvaW5Wb2ljZUNoYW5uZWxPcHRpb25zLCBcclxuICBWb2ljZUNvbm5lY3Rpb25TdGF0ZSxcclxuICBHYXRld2F5QWRhcHRlckxpYnJhcnlNZXRob2RzLFxyXG4gIFZvaWNlU2VydmVyVXBkYXRlXHJcbn0gZnJvbSAnLi90eXBlcyc7XHJcbmltcG9ydCB7IEF1ZGlvUGxheWVyIH0gZnJvbSAnLi9BdWRpb1BsYXllcic7XHJcblxyXG4vKipcclxuICogUmVwcmVzZW50cyBhIHZvaWNlIGNvbm5lY3Rpb24gdG8gYSBjaGFubmVsXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgVm9pY2VDb25uZWN0aW9uIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcclxuICAvKiogQ3VycmVudCBjb25uZWN0aW9uIHN0YXRlICovXHJcbiAgcHVibGljIHN0YXRlOiBWb2ljZUNvbm5lY3Rpb25TdGF0ZSA9IHsgc3RhdHVzOiBWb2ljZUNvbm5lY3Rpb25TdGF0dXMuQ29ubmVjdGluZyB9O1xyXG4gIFxyXG4gIC8qKiBUaGUgY2hhbm5lbCBJRCB0aGlzIGNvbm5lY3Rpb24gaXMgZm9yICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGNoYW5uZWxJZDogc3RyaW5nO1xyXG4gIFxyXG4gIC8qKiBUaGUgZ3VpbGQgSUQgdGhpcyBjb25uZWN0aW9uIGlzIGZvciAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBndWlsZElkOiBzdHJpbmc7XHJcbiAgXHJcbiAgLyoqIExpdmVLaXQgcm9vbSBpbnN0YW5jZSAqL1xyXG4gIHByaXZhdGUgcm9vbTogUm9vbSB8IG51bGwgPSBudWxsO1xyXG4gIFxyXG4gIC8qKiBMaXZlS2l0IGNvbm5lY3Rpb24gaW5mbyAqL1xyXG4gIHByaXZhdGUgbGl2ZWtpdEVuZHBvaW50OiBzdHJpbmcgfCBudWxsID0gbnVsbDtcclxuICBwcml2YXRlIGxpdmVraXRUb2tlbjogc3RyaW5nIHwgbnVsbCA9IG51bGw7XHJcbiAgcHJpdmF0ZSBsaXZla2l0Um9vbU5hbWU6IHN0cmluZyB8IG51bGwgPSBudWxsO1xyXG4gIFxyXG4gIC8qKiBTdWJzY3JpYmVkIGF1ZGlvIHBsYXllciAqL1xyXG4gIHByaXZhdGUgc3Vic2NyaWJlZFBsYXllcjogQXVkaW9QbGF5ZXIgfCBudWxsID0gbnVsbDtcclxuICBcclxuICAvKiogR2F0ZXdheSBhZGFwdGVyIG1ldGhvZHMgKi9cclxuICBwcml2YXRlIGFkYXB0ZXJNZXRob2RzOiBHYXRld2F5QWRhcHRlckxpYnJhcnlNZXRob2RzO1xyXG4gIFxyXG4gIC8qKiBBZGFwdGVyIGltcGxlbWVudGVyIChmb3Igc2VuZGluZyBwYXlsb2FkcykgKi9cclxuICBwcml2YXRlIGFkYXB0ZXI6IHsgc2VuZFBheWxvYWQ6IChwYXlsb2FkOiBhbnkpID0+IGJvb2xlYW47IGRlc3Ryb3k6ICgpID0+IHZvaWQgfSB8IG51bGwgPSBudWxsO1xyXG5cclxuICBjb25zdHJ1Y3RvcihvcHRpb25zOiBKb2luVm9pY2VDaGFubmVsT3B0aW9ucykge1xyXG4gICAgc3VwZXIoKTtcclxuICAgIHRoaXMuY2hhbm5lbElkID0gb3B0aW9ucy5jaGFubmVsSWQ7XHJcbiAgICB0aGlzLmd1aWxkSWQgPSBvcHRpb25zLmd1aWxkSWQ7XHJcbiAgICBcclxuICAgIC8vIENyZWF0ZSBhZGFwdGVyIG1ldGhvZHMgdGhhdCB3aWxsIHJlY2VpdmUgZ2F0ZXdheSBldmVudHNcclxuICAgIHRoaXMuYWRhcHRlck1ldGhvZHMgPSB7XHJcbiAgICAgIG9uVm9pY2VTZXJ2ZXJVcGRhdGU6IChkYXRhOiBWb2ljZVNlcnZlclVwZGF0ZSkgPT4gdGhpcy5oYW5kbGVWb2ljZVNlcnZlclVwZGF0ZShkYXRhKSxcclxuICAgICAgb25Wb2ljZVN0YXRlVXBkYXRlOiAoZGF0YSkgPT4gdGhpcy5oYW5kbGVWb2ljZVN0YXRlVXBkYXRlKGRhdGEpLFxyXG4gICAgICBkZXN0cm95OiAoKSA9PiB0aGlzLmRlc3Ryb3koKVxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgLy8gR2V0IGFkYXB0ZXIgZnJvbSBjcmVhdG9yXHJcbiAgICB0aGlzLmFkYXB0ZXIgPSBvcHRpb25zLmFkYXB0ZXJDcmVhdG9yKHRoaXMuYWRhcHRlck1ldGhvZHMpO1xyXG4gICAgXHJcbiAgICAvLyBTZW5kIHZvaWNlIHN0YXRlIHVwZGF0ZSB0byBqb2luIGNoYW5uZWxcclxuICAgIHRoaXMuc2VuZFZvaWNlU3RhdGVVcGRhdGUob3B0aW9ucy5jaGFubmVsSWQsIG9wdGlvbnMuc2VsZk11dGUsIG9wdGlvbnMuc2VsZkRlYWYpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU3Vic2NyaWJlIGFuIGF1ZGlvIHBsYXllciB0byB0aGlzIGNvbm5lY3Rpb25cclxuICAgKi9cclxuICBzdWJzY3JpYmUocGxheWVyOiBBdWRpb1BsYXllcik6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMuc3Vic2NyaWJlZFBsYXllcikge1xyXG4gICAgICB0aGlzLnN1YnNjcmliZWRQbGF5ZXIudW5zdWJzY3JpYmUodGhpcyk7XHJcbiAgICB9XHJcbiAgICB0aGlzLnN1YnNjcmliZWRQbGF5ZXIgPSBwbGF5ZXI7XHJcbiAgICBwbGF5ZXIuc3Vic2NyaWJlKHRoaXMpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVW5zdWJzY3JpYmUgdGhlIGN1cnJlbnQgYXVkaW8gcGxheWVyXHJcbiAgICovXHJcbiAgdW5zdWJzY3JpYmUoKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy5zdWJzY3JpYmVkUGxheWVyKSB7XHJcbiAgICAgIHRoaXMuc3Vic2NyaWJlZFBsYXllci51bnN1YnNjcmliZSh0aGlzKTtcclxuICAgICAgdGhpcy5zdWJzY3JpYmVkUGxheWVyID0gbnVsbDtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCB0aGUgTGl2ZUtpdCByb29tIChmb3IgYXVkaW8gcGxheWVyIHRvIHB1Ymxpc2ggdHJhY2tzKVxyXG4gICAqL1xyXG4gIGdldFJvb20oKTogUm9vbSB8IG51bGwge1xyXG4gICAgcmV0dXJuIHRoaXMucm9vbTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERpc2Nvbm5lY3QgZnJvbSB0aGUgdm9pY2UgY2hhbm5lbFxyXG4gICAqL1xyXG4gIGRpc2Nvbm5lY3QoKTogYm9vbGVhbiB7XHJcbiAgICB0aGlzLnNlbmRWb2ljZVN0YXRlVXBkYXRlKG51bGwpO1xyXG4gICAgcmV0dXJuIHRydWU7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBEZXN0cm95IHRoZSBjb25uZWN0aW9uIGNvbXBsZXRlbHlcclxuICAgKi9cclxuICBkZXN0cm95KCk6IHZvaWQge1xyXG4gICAgdGhpcy51bnN1YnNjcmliZSgpO1xyXG4gICAgdGhpcy5kaXNjb25uZWN0RnJvbUxpdmVLaXQoKTtcclxuICAgIHRoaXMuYWRhcHRlcj8uZGVzdHJveSgpO1xyXG4gICAgdGhpcy5zZXRTdGF0ZSh7IHN0YXR1czogVm9pY2VDb25uZWN0aW9uU3RhdHVzLkRlc3Ryb3llZCB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlam9pbiB0aGUgdm9pY2UgY2hhbm5lbCAoYWZ0ZXIgZGlzY29ubmVjdClcclxuICAgKi9cclxuICByZWpvaW4oKTogYm9vbGVhbiB7XHJcbiAgICB0aGlzLnNlbmRWb2ljZVN0YXRlVXBkYXRlKHRoaXMuY2hhbm5lbElkKTtcclxuICAgIHJldHVybiB0cnVlO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzZW5kVm9pY2VTdGF0ZVVwZGF0ZShjaGFubmVsSWQ6IHN0cmluZyB8IG51bGwsIHNlbGZNdXRlID0gZmFsc2UsIHNlbGZEZWFmID0gZmFsc2UpOiB2b2lkIHtcclxuICAgIGlmICghdGhpcy5hZGFwdGVyKSByZXR1cm47XHJcbiAgICBcclxuICAgIHRoaXMuYWRhcHRlci5zZW5kUGF5bG9hZCh7XHJcbiAgICAgIG9wOiA0LCAvLyBWT0lDRV9TVEFURV9VUERBVEVcclxuICAgICAgZDoge1xyXG4gICAgICAgIGd1aWxkX2lkOiB0aGlzLmd1aWxkSWQsXHJcbiAgICAgICAgY2hhbm5lbF9pZDogY2hhbm5lbElkLFxyXG4gICAgICAgIHNlbGZfbXV0ZTogc2VsZk11dGUsXHJcbiAgICAgICAgc2VsZl9kZWFmOiBzZWxmRGVhZlxyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgaGFuZGxlVm9pY2VTZXJ2ZXJVcGRhdGUoZGF0YTogVm9pY2VTZXJ2ZXJVcGRhdGUpOiB2b2lkIHtcclxuICAgIHRoaXMubGl2ZWtpdEVuZHBvaW50ID0gZGF0YS5lbmRwb2ludDtcclxuICAgIHRoaXMubGl2ZWtpdFRva2VuID0gZGF0YS50b2tlbjtcclxuICAgIHRoaXMubGl2ZWtpdFJvb21OYW1lID0gZGF0YS5yb29tO1xyXG4gICAgXHJcbiAgICB0aGlzLnNldFN0YXRlKHsgc3RhdHVzOiBWb2ljZUNvbm5lY3Rpb25TdGF0dXMuU2lnbmFsbGluZyB9KTtcclxuICAgIHRoaXMuY29ubmVjdFRvTGl2ZUtpdCgpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBoYW5kbGVWb2ljZVN0YXRlVXBkYXRlKGRhdGE6IGFueSk6IHZvaWQge1xyXG4gICAgaWYgKGRhdGEuY2hhbm5lbF9pZCA9PT0gbnVsbCkge1xyXG4gICAgICAvLyBEaXNjb25uZWN0ZWRcclxuICAgICAgdGhpcy5kaXNjb25uZWN0RnJvbUxpdmVLaXQoKTtcclxuICAgICAgdGhpcy5zZXRTdGF0ZSh7IHN0YXR1czogVm9pY2VDb25uZWN0aW9uU3RhdHVzLkRpc2Nvbm5lY3RlZCB9KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgYXN5bmMgY29ubmVjdFRvTGl2ZUtpdCgpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGlmICghdGhpcy5saXZla2l0RW5kcG9pbnQgfHwgIXRoaXMubGl2ZWtpdFRva2VuKSB7XHJcbiAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCBuZXcgRXJyb3IoJ01pc3NpbmcgTGl2ZUtpdCBjb25uZWN0aW9uIGluZm8nKSk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICB0cnkge1xyXG4gICAgICAvLyBEaXNjb25uZWN0IGV4aXN0aW5nIHJvb20gaWYgYW55XHJcbiAgICAgIGF3YWl0IHRoaXMuZGlzY29ubmVjdEZyb21MaXZlS2l0KCk7XHJcbiAgICAgIFxyXG4gICAgICB0aGlzLnJvb20gPSBuZXcgUm9vbSgpO1xyXG4gICAgICBcclxuICAgICAgdGhpcy5yb29tLm9uKFJvb21FdmVudC5EaXNjb25uZWN0ZWQsICgpID0+IHtcclxuICAgICAgICB0aGlzLnNldFN0YXRlKHsgc3RhdHVzOiBWb2ljZUNvbm5lY3Rpb25TdGF0dXMuRGlzY29ubmVjdGVkIH0pO1xyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIGF3YWl0IHRoaXMucm9vbS5jb25uZWN0KHRoaXMubGl2ZWtpdEVuZHBvaW50LCB0aGlzLmxpdmVraXRUb2tlbik7XHJcbiAgICAgIFxyXG4gICAgICB0aGlzLnNldFN0YXRlKHsgc3RhdHVzOiBWb2ljZUNvbm5lY3Rpb25TdGF0dXMuUmVhZHkgfSk7XHJcbiAgICAgIFxyXG4gICAgICAvLyBOb3RpZnkgc3Vic2NyaWJlZCBwbGF5ZXIgdGhhdCBjb25uZWN0aW9uIGlzIHJlYWR5XHJcbiAgICAgIGlmICh0aGlzLnN1YnNjcmliZWRQbGF5ZXIpIHtcclxuICAgICAgICB0aGlzLnN1YnNjcmliZWRQbGF5ZXIub25Db25uZWN0aW9uUmVhZHkodGhpcyk7XHJcbiAgICAgIH1cclxuICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgIHRoaXMuZW1pdCgnZXJyb3InLCBlcnJvcik7XHJcbiAgICAgIHRoaXMuc2V0U3RhdGUoeyBzdGF0dXM6IFZvaWNlQ29ubmVjdGlvblN0YXR1cy5EaXNjb25uZWN0ZWQgfSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFzeW5jIGRpc2Nvbm5lY3RGcm9tTGl2ZUtpdCgpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGlmICh0aGlzLnJvb20pIHtcclxuICAgICAgdHJ5IHtcclxuICAgICAgICBhd2FpdCB0aGlzLnJvb20uZGlzY29ubmVjdCgpO1xyXG4gICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgLy8gSWdub3JlIGRpc2Nvbm5lY3QgZXJyb3JzXHJcbiAgICAgIH1cclxuICAgICAgdGhpcy5yb29tID0gbnVsbDtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgc2V0U3RhdGUobmV3U3RhdGU6IFZvaWNlQ29ubmVjdGlvblN0YXRlKTogdm9pZCB7XHJcbiAgICBjb25zdCBvbGRTdGF0ZSA9IHRoaXMuc3RhdGU7XHJcbiAgICB0aGlzLnN0YXRlID0gbmV3U3RhdGU7XHJcbiAgICB0aGlzLmVtaXQoJ3N0YXRlQ2hhbmdlJywgb2xkU3RhdGUsIG5ld1N0YXRlKTtcclxuICB9XHJcbn1cclxuXHJcbi8vIFN0b3JlIGFjdGl2ZSBjb25uZWN0aW9uc1xyXG5jb25zdCBjb25uZWN0aW9ucyA9IG5ldyBNYXA8c3RyaW5nLCBWb2ljZUNvbm5lY3Rpb24+KCk7XHJcblxyXG4vKipcclxuICogSm9pbiBhIHZvaWNlIGNoYW5uZWwgLSBtYWluIGVudHJ5IHBvaW50XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gam9pblZvaWNlQ2hhbm5lbChvcHRpb25zOiBKb2luVm9pY2VDaGFubmVsT3B0aW9ucyk6IFZvaWNlQ29ubmVjdGlvbiB7XHJcbiAgY29uc3Qga2V5ID0gYCR7b3B0aW9ucy5ndWlsZElkfToke29wdGlvbnMuY2hhbm5lbElkfWA7XHJcbiAgXHJcbiAgLy8gRGVzdHJveSBleGlzdGluZyBjb25uZWN0aW9uIGlmIGFueVxyXG4gIGNvbnN0IGV4aXN0aW5nID0gY29ubmVjdGlvbnMuZ2V0KGtleSk7XHJcbiAgaWYgKGV4aXN0aW5nKSB7XHJcbiAgICBleGlzdGluZy5kZXN0cm95KCk7XHJcbiAgICBjb25uZWN0aW9ucy5kZWxldGUoa2V5KTtcclxuICB9XHJcbiAgXHJcbiAgY29uc3QgY29ubmVjdGlvbiA9IG5ldyBWb2ljZUNvbm5lY3Rpb24ob3B0aW9ucyk7XHJcbiAgY29ubmVjdGlvbnMuc2V0KGtleSwgY29ubmVjdGlvbik7XHJcbiAgXHJcbiAgcmV0dXJuIGNvbm5lY3Rpb247XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBHZXQgYW4gZXhpc3Rpbmcgdm9pY2UgY29ubmVjdGlvblxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGdldFZvaWNlQ29ubmVjdGlvbihndWlsZElkOiBzdHJpbmcpOiBWb2ljZUNvbm5lY3Rpb24gfCB1bmRlZmluZWQge1xyXG4gIGZvciAoY29uc3QgW2tleSwgY29ubmVjdGlvbl0gb2YgY29ubmVjdGlvbnMpIHtcclxuICAgIGlmIChrZXkuc3RhcnRzV2l0aChgJHtndWlsZElkfTpgKSkge1xyXG4gICAgICByZXR1cm4gY29ubmVjdGlvbjtcclxuICAgIH1cclxuICB9XHJcbiAgcmV0dXJuIHVuZGVmaW5lZDtcclxufVxyXG4iXX0=