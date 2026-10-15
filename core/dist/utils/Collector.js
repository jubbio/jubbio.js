"use strict";
/**
 * Collectors for awaiting messages, reactions, and interactions
 * API compatible with Discord.js Collectors
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReactionCollector = exports.InteractionCollector = exports.MessageCollector = exports.Collector = void 0;
exports.awaitMessages = awaitMessages;
exports.awaitReactions = awaitReactions;
const events_1 = require("events");
const Collection_1 = require("./Collection");
/**
 * Abstract base class for collectors
 */
class Collector extends events_1.EventEmitter {
    /** The client that instantiated this collector */
    client;
    /** The items collected */
    collected = new Collection_1.Collection();
    /** Whether the collector has ended */
    ended = false;
    /** The reason the collector ended */
    endReason = null;
    /**
     * Filter function.
     * WARNING: Async filters may cause items to queue up if slow.
     * For best performance, keep filters synchronous.
     */
    filter;
    /** Collector options */
    options;
    /** Number of items processed */
    _processedCount = 0;
    /** Timeout for time limit */
    _timeout = null;
    /** Timeout for idle limit */
    _idleTimeout = null;
    constructor(client, options = {}) {
        super();
        this.client = client;
        this.options = options;
        this.filter = options.filter ?? (() => true);
        this.handleCollect = this.handleCollect.bind(this);
        this.handleDispose = this.handleDispose.bind(this);
        if (options.time) {
            this._timeout = setTimeout(() => this.stop('time'), options.time);
        }
        if (options.idle) {
            this._idleTimeout = setTimeout(() => this.stop('idle'), options.idle);
        }
    }
    /**
     * Handle an item being collected
     */
    async handleCollect(item) {
        if (this.ended)
            return;
        this._processedCount++;
        const filterResult = await this.filter(item, this.collected);
        if (!filterResult)
            return;
        const key = this.collect(item);
        if (key === null)
            return;
        this.collected.set(key, item);
        this.emit('collect', item);
        // Reset idle timer
        if (this._idleTimeout) {
            clearTimeout(this._idleTimeout);
            this._idleTimeout = setTimeout(() => this.stop('idle'), this.options.idle);
        }
        // Check limits
        if (this.options.max && this.collected.size >= this.options.max) {
            this.stop('limit');
        }
        if (this.options.maxProcessed && this._processedCount >= this.options.maxProcessed) {
            this.stop('processedLimit');
        }
    }
    /**
     * Handle an item being disposed
     */
    handleDispose(item) {
        if (!this.options.dispose)
            return;
        const key = this.dispose(item);
        if (key === null)
            return;
        if (this.collected.has(key)) {
            this.collected.delete(key);
            this.emit('dispose', item);
        }
    }
    /**
     * Stop the collector
     */
    stop(reason = 'user') {
        if (this.ended)
            return;
        this.ended = true;
        this.endReason = reason;
        if (this._timeout) {
            clearTimeout(this._timeout);
            this._timeout = null;
        }
        if (this._idleTimeout) {
            clearTimeout(this._idleTimeout);
            this._idleTimeout = null;
        }
        this.emit('end', this.collected, reason);
    }
    /**
     * Reset the collector's timer
     */
    resetTimer(options = {}) {
        if (this._timeout) {
            clearTimeout(this._timeout);
            this._timeout = null;
        }
        if (this._idleTimeout) {
            clearTimeout(this._idleTimeout);
            this._idleTimeout = null;
        }
        if (options.time ?? this.options.time) {
            this._timeout = setTimeout(() => this.stop('time'), options.time ?? this.options.time);
        }
        if (options.idle ?? this.options.idle) {
            this._idleTimeout = setTimeout(() => this.stop('idle'), options.idle ?? this.options.idle);
        }
    }
    /**
     * Check the end conditions
     */
    checkEnd() {
        const reason = this.endReason;
        if (reason) {
            this.stop(reason);
            return true;
        }
        return false;
    }
    /**
     * Get the next item
     */
    get next() {
        return new Promise((resolve, reject) => {
            if (this.ended) {
                reject(new Error('Collector has ended'));
                return;
            }
            const cleanup = () => {
                this.removeListener('collect', onCollect);
                this.removeListener('end', onEnd);
            };
            const onCollect = (item) => {
                cleanup();
                resolve(item);
            };
            const onEnd = () => {
                cleanup();
                reject(new Error('Collector ended'));
            };
            this.on('collect', onCollect);
            this.on('end', onEnd);
        });
    }
}
exports.Collector = Collector;
/**
 * Collector for messages
 */
class MessageCollector extends Collector {
    channelId;
    messageHandler;
    constructor(client, channelId, options = {}) {
        super(client, options);
        this.channelId = channelId;
        // Get bot's user ID to filter out bot's own messages
        const botUserId = client.user?.id;
        this.messageHandler = (message) => {
            const messageChannelId = message.channel_id ?? message.channelId;
            if (messageChannelId === this.channelId) {
                // Automatically filter out bot's own messages
                const authorId = message.author?.id;
                if (botUserId && authorId === botUserId)
                    return;
                // Also filter by application_id (bot messages have this)
                if (message.application_id ||
                    message.applicationId)
                    return;
                this.handleCollect(message);
            }
        };
        client.on('messageCreate', this.messageHandler);
        this.once('end', () => {
            client.removeListener('messageCreate', this.messageHandler);
        });
    }
    collect(message) {
        return message.id ?? null;
    }
    dispose(message) {
        return message.id ?? null;
    }
}
exports.MessageCollector = MessageCollector;
/**
 * Collector for interactions (buttons, select menus, etc.)
 */
class InteractionCollector extends Collector {
    channelId;
    guildId;
    messageId;
    interactionType;
    componentType;
    interactionHandler;
    constructor(client, options = {}) {
        super(client, options);
        this.channelId = options.channelId;
        this.guildId = options.guildId;
        this.messageId = options.messageId;
        this.interactionType = options.interactionType
            ? Array.isArray(options.interactionType) ? options.interactionType : [options.interactionType]
            : undefined;
        this.componentType = options.componentType
            ? Array.isArray(options.componentType) ? options.componentType : [options.componentType]
            : undefined;
        this.interactionHandler = (interaction) => {
            // Filter by channel
            if (this.channelId && interaction.channelId !== this.channelId)
                return;
            // Filter by guild
            if (this.guildId && interaction.guildId !== this.guildId)
                return;
            // Filter by message
            if (this.messageId && interaction.message?.id !== this.messageId)
                return;
            // Filter by interaction type
            if (this.interactionType && !this.interactionType.includes(interaction.type))
                return;
            // Filter by component type
            const componentType = interaction.componentType;
            if (this.componentType && componentType && !this.componentType.includes(componentType))
                return;
            this.handleCollect(interaction);
        };
        client.on('interactionCreate', this.interactionHandler);
        this.once('end', () => {
            client.removeListener('interactionCreate', this.interactionHandler);
        });
    }
    collect(interaction) {
        return interaction.id ?? null;
    }
    dispose(interaction) {
        return interaction.id ?? null;
    }
}
exports.InteractionCollector = InteractionCollector;
/**
 * Collector for reactions
 */
class ReactionCollector extends Collector {
    messageId;
    reactionHandler;
    constructor(client, messageId, options) {
        super(client, options);
        this.messageId = messageId;
        this.reactionHandler = (reaction) => {
            if (reaction.message_id === this.messageId || reaction.messageId === this.messageId) {
                this.handleCollect(reaction);
            }
        };
        client.on('messageReactionAdd', this.reactionHandler);
        this.once('end', () => {
            client.removeListener('messageReactionAdd', this.reactionHandler);
        });
    }
    collect(reaction) {
        // Key is emoji identifier
        return reaction.emoji?.id ?? reaction.emoji?.name ?? null;
    }
    dispose(reaction) {
        return reaction.emoji?.id ?? reaction.emoji?.name ?? null;
    }
}
exports.ReactionCollector = ReactionCollector;
/**
 * Await messages helper
 */
function awaitMessages(client, channelId, options = {}) {
    return new Promise((resolve, reject) => {
        const collector = new MessageCollector(client, channelId, options);
        collector.once('end', (collected, reason) => {
            if (options.max && collected.size < options.max) {
                reject(new Error(`Collector ended with reason: ${reason}`));
            }
            else {
                resolve(collected);
            }
        });
    });
}
/**
 * Await reactions helper
 */
function awaitReactions(client, messageId, options) {
    return new Promise((resolve, reject) => {
        const collector = new ReactionCollector(client, messageId, options);
        collector.once('end', (collected, reason) => {
            if (options.max && collected.size < options.max) {
                reject(new Error(`Collector ended with reason: ${reason}`));
            }
            else {
                resolve(collected);
            }
        });
    });
}
exports.default = Collector;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ29sbGVjdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3V0aWxzL0NvbGxlY3Rvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOzs7QUErWUgsc0NBZ0JDO0FBS0Qsd0NBZ0JDO0FBbGJELG1DQUFzQztBQUN0Qyw2Q0FBMEM7QUF3QjFDOztHQUVHO0FBQ0gsTUFBc0IsU0FBK0IsU0FBUSxxQkFBWTtJQUN2RSxrREFBa0Q7SUFDbEMsTUFBTSxDQUFNO0lBRTVCLDBCQUEwQjtJQUNWLFNBQVMsR0FBcUIsSUFBSSx1QkFBVSxFQUFFLENBQUM7SUFFL0Qsc0NBQXNDO0lBQy9CLEtBQUssR0FBRyxLQUFLLENBQUM7SUFFckIscUNBQXFDO0lBQzlCLFNBQVMsR0FBa0IsSUFBSSxDQUFDO0lBRXZDOzs7O09BSUc7SUFDSSxNQUFNLENBQXVFO0lBRXBGLHdCQUF3QjtJQUNqQixPQUFPLENBQXNCO0lBRXBDLGdDQUFnQztJQUN4QixlQUFlLEdBQUcsQ0FBQyxDQUFDO0lBRTVCLDZCQUE2QjtJQUNyQixRQUFRLEdBQTBCLElBQUksQ0FBQztJQUUvQyw2QkFBNkI7SUFDckIsWUFBWSxHQUEwQixJQUFJLENBQUM7SUFFbkQsWUFBWSxNQUFXLEVBQUUsVUFBK0IsRUFBRTtRQUN4RCxLQUFLLEVBQUUsQ0FBQztRQUNSLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1FBQ3JCLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxNQUFNLEdBQUksT0FBTyxDQUFDLE1BQWMsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRXRELElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDbkQsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLENB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LE1BQU0sRUFBRSxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFFcEUsU0FBUyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQyxTQUFTLEVBQUUsTUFBTSxFQUFFLEVBQUU7WUFDMUMsSUFBSSxPQUFPLENBQUMsR0FBRyxJQUFJLFNBQVMsQ0FBQyxJQUFJLEdBQUcsT0FBTyxDQUFDLEdBQUcsRUFBRSxDQUFDO2dCQUNoRCxNQUFNLENBQUMsSUFBSSxLQUFLLENBQUMsZ0NBQWdDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztZQUM5RCxDQUFDO2lCQUFNLENBQUM7Z0JBQ04sT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ3JCLENBQUM7UUFDSCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUVELGtCQUFlLFNBQVMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBDb2xsZWN0b3JzIGZvciBhd2FpdGluZyBtZXNzYWdlcywgcmVhY3Rpb25zLCBhbmQgaW50ZXJhY3Rpb25zXHJcbiAqIEFQSSBjb21wYXRpYmxlIHdpdGggRGlzY29yZC5qcyBDb2xsZWN0b3JzXHJcbiAqL1xyXG5cclxuaW1wb3J0IHsgRXZlbnRFbWl0dGVyIH0gZnJvbSAnZXZlbnRzJztcclxuaW1wb3J0IHsgQ29sbGVjdGlvbiB9IGZyb20gJy4vQ29sbGVjdGlvbic7XHJcbmltcG9ydCB0eXBlIHsgTWVzc2FnZSB9IGZyb20gJy4uL3N0cnVjdHVyZXMvTWVzc2FnZSc7XHJcbmltcG9ydCB0eXBlIHsgSW50ZXJhY3Rpb24gfSBmcm9tICcuLi9zdHJ1Y3R1cmVzL0ludGVyYWN0aW9uJztcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgQ29sbGVjdG9yT3B0aW9uczxUPiB7XHJcbiAgLyoqIEhvdyBsb25nIHRvIHJ1biB0aGUgY29sbGVjdG9yIGZvciBpbiBtaWxsaXNlY29uZHMgKi9cclxuICB0aW1lPzogbnVtYmVyO1xyXG4gIC8qKiBIb3cgbG9uZyB0byB3YWl0IGZvciB0aGUgbmV4dCBpdGVtIGluIG1pbGxpc2Vjb25kcyAqL1xyXG4gIGlkbGU/OiBudW1iZXI7XHJcbiAgLyoqIE1heGltdW0gbnVtYmVyIG9mIGl0ZW1zIHRvIGNvbGxlY3QgKi9cclxuICBtYXg/OiBudW1iZXI7XHJcbiAgLyoqIE1heGltdW0gbnVtYmVyIG9mIGl0ZW1zIHRvIHByb2Nlc3MgKi9cclxuICBtYXhQcm9jZXNzZWQ/OiBudW1iZXI7XHJcbiAgLyoqIEZpbHRlciBmdW5jdGlvbiAqL1xyXG4gIGZpbHRlcj86IChpdGVtOiBULCBjb2xsZWN0ZWQ6IENvbGxlY3Rpb248c3RyaW5nLCBUPikgPT4gYm9vbGVhbiB8IFByb21pc2U8Ym9vbGVhbj47XHJcbiAgLyoqIFdoZXRoZXIgdG8gZGlzcG9zZSBvZiBpdGVtcyB3aGVuIHRoZSBjb2xsZWN0b3IgZW5kcyAqL1xyXG4gIGRpc3Bvc2U/OiBib29sZWFuO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIENvbGxlY3RvclJlc2V0VGltZXJPcHRpb25zIHtcclxuICB0aW1lPzogbnVtYmVyO1xyXG4gIGlkbGU/OiBudW1iZXI7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBYnN0cmFjdCBiYXNlIGNsYXNzIGZvciBjb2xsZWN0b3JzXHJcbiAqL1xyXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQ29sbGVjdG9yPEsgZXh0ZW5kcyBzdHJpbmcsIFY+IGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcclxuICAvKiogVGhlIGNsaWVudCB0aGF0IGluc3RhbnRpYXRlZCB0aGlzIGNvbGxlY3RvciAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBjbGllbnQ6IGFueTtcclxuICBcclxuICAvKiogVGhlIGl0ZW1zIGNvbGxlY3RlZCAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBjb2xsZWN0ZWQ6IENvbGxlY3Rpb248SywgVj4gPSBuZXcgQ29sbGVjdGlvbigpO1xyXG4gIFxyXG4gIC8qKiBXaGV0aGVyIHRoZSBjb2xsZWN0b3IgaGFzIGVuZGVkICovXHJcbiAgcHVibGljIGVuZGVkID0gZmFsc2U7XHJcbiAgXHJcbiAgLyoqIFRoZSByZWFzb24gdGhlIGNvbGxlY3RvciBlbmRlZCAqL1xyXG4gIHB1YmxpYyBlbmRSZWFzb246IHN0cmluZyB8IG51bGwgPSBudWxsO1xyXG4gIFxyXG4gIC8qKiBcclxuICAgKiBGaWx0ZXIgZnVuY3Rpb24uXHJcbiAgICogV0FSTklORzogQXN5bmMgZmlsdGVycyBtYXkgY2F1c2UgaXRlbXMgdG8gcXVldWUgdXAgaWYgc2xvdy4gXHJcbiAgICogRm9yIGJlc3QgcGVyZm9ybWFuY2UsIGtlZXAgZmlsdGVycyBzeW5jaHJvbm91cy5cclxuICAgKi9cclxuICBwdWJsaWMgZmlsdGVyOiAoaXRlbTogViwgY29sbGVjdGVkOiBDb2xsZWN0aW9uPEssIFY+KSA9PiBib29sZWFuIHwgUHJvbWlzZTxib29sZWFuPjtcclxuICBcclxuICAvKiogQ29sbGVjdG9yIG9wdGlvbnMgKi9cclxuICBwdWJsaWMgb3B0aW9uczogQ29sbGVjdG9yT3B0aW9uczxWPjtcclxuICBcclxuICAvKiogTnVtYmVyIG9mIGl0ZW1zIHByb2Nlc3NlZCAqL1xyXG4gIHByaXZhdGUgX3Byb2Nlc3NlZENvdW50ID0gMDtcclxuICBcclxuICAvKiogVGltZW91dCBmb3IgdGltZSBsaW1pdCAqL1xyXG4gIHByaXZhdGUgX3RpbWVvdXQ6IE5vZGVKUy5UaW1lb3V0IHwgbnVsbCA9IG51bGw7XHJcbiAgXHJcbiAgLyoqIFRpbWVvdXQgZm9yIGlkbGUgbGltaXQgKi9cclxuICBwcml2YXRlIF9pZGxlVGltZW91dDogTm9kZUpTLlRpbWVvdXQgfCBudWxsID0gbnVsbDtcclxuXHJcbiAgY29uc3RydWN0b3IoY2xpZW50OiBhbnksIG9wdGlvbnM6IENvbGxlY3Rvck9wdGlvbnM8Vj4gPSB7fSkge1xyXG4gICAgc3VwZXIoKTtcclxuICAgIHRoaXMuY2xpZW50ID0gY2xpZW50O1xyXG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcclxuICAgIHRoaXMuZmlsdGVyID0gKG9wdGlvbnMuZmlsdGVyIGFzIGFueSkgPz8gKCgpID0+IHRydWUpO1xyXG4gICAgXHJcbiAgICB0aGlzLmhhbmRsZUNvbGxlY3QgPSB0aGlzLmhhbmRsZUNvbGxlY3QuYmluZCh0aGlzKTtcclxuICAgIHRoaXMuaGFuZGxlRGlzcG9zZSA9IHRoaXMuaGFuZGxlRGlzcG9zZS5iaW5kKHRoaXMpO1xyXG4gICAgXHJcbiAgICBpZiAob3B0aW9ucy50aW1lKSB7XHJcbiAgICAgIHRoaXMuX3RpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHRoaXMuc3RvcCgndGltZScpLCBvcHRpb25zLnRpbWUpO1xyXG4gICAgfVxyXG4gICAgaWYgKG9wdGlvbnMuaWRsZSkge1xyXG4gICAgICB0aGlzLl9pZGxlVGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4gdGhpcy5zdG9wKCdpZGxlJyksIG9wdGlvbnMuaWRsZSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBIYW5kbGUgYW4gaXRlbSBiZWluZyBjb2xsZWN0ZWRcclxuICAgKi9cclxuICBhc3luYyBoYW5kbGVDb2xsZWN0KGl0ZW06IFYpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGlmICh0aGlzLmVuZGVkKSByZXR1cm47XHJcbiAgICBcclxuICAgIHRoaXMuX3Byb2Nlc3NlZENvdW50Kys7XHJcbiAgICBcclxuICAgIGNvbnN0IGZpbHRlclJlc3VsdCA9IGF3YWl0IHRoaXMuZmlsdGVyKGl0ZW0sIHRoaXMuY29sbGVjdGVkKTtcclxuICAgIGlmICghZmlsdGVyUmVzdWx0KSByZXR1cm47XHJcbiAgICBcclxuICAgIGNvbnN0IGtleSA9IHRoaXMuY29sbGVjdChpdGVtKTtcclxuICAgIGlmIChrZXkgPT09IG51bGwpIHJldHVybjtcclxuICAgIFxyXG4gICAgdGhpcy5jb2xsZWN0ZWQuc2V0KGtleSwgaXRlbSk7XHJcbiAgICB0aGlzLmVtaXQoJ2NvbGxlY3QnLCBpdGVtKTtcclxuICAgIFxyXG4gICAgLy8gUmVzZXQgaWRsZSB0aW1lclxyXG4gICAgaWYgKHRoaXMuX2lkbGVUaW1lb3V0KSB7XHJcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLl9pZGxlVGltZW91dCk7XHJcbiAgICAgIHRoaXMuX2lkbGVUaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB0aGlzLnN0b3AoJ2lkbGUnKSwgdGhpcy5vcHRpb25zLmlkbGUhKTtcclxuICAgIH1cclxuICAgIFxyXG4gICAgLy8gQ2hlY2sgbGltaXRzXHJcbiAgICBpZiAodGhpcy5vcHRpb25zLm1heCAmJiB0aGlzLmNvbGxlY3RlZC5zaXplID49IHRoaXMub3B0aW9ucy5tYXgpIHtcclxuICAgICAgdGhpcy5zdG9wKCdsaW1pdCcpO1xyXG4gICAgfVxyXG4gICAgaWYgKHRoaXMub3B0aW9ucy5tYXhQcm9jZXNzZWQgJiYgdGhpcy5fcHJvY2Vzc2VkQ291bnQgPj0gdGhpcy5vcHRpb25zLm1heFByb2Nlc3NlZCkge1xyXG4gICAgICB0aGlzLnN0b3AoJ3Byb2Nlc3NlZExpbWl0Jyk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBIYW5kbGUgYW4gaXRlbSBiZWluZyBkaXNwb3NlZFxyXG4gICAqL1xyXG4gIGhhbmRsZURpc3Bvc2UoaXRlbTogVik6IHZvaWQge1xyXG4gICAgaWYgKCF0aGlzLm9wdGlvbnMuZGlzcG9zZSkgcmV0dXJuO1xyXG4gICAgXHJcbiAgICBjb25zdCBrZXkgPSB0aGlzLmRpc3Bvc2UoaXRlbSk7XHJcbiAgICBpZiAoa2V5ID09PSBudWxsKSByZXR1cm47XHJcbiAgICBcclxuICAgIGlmICh0aGlzLmNvbGxlY3RlZC5oYXMoa2V5KSkge1xyXG4gICAgICB0aGlzLmNvbGxlY3RlZC5kZWxldGUoa2V5KTtcclxuICAgICAgdGhpcy5lbWl0KCdkaXNwb3NlJywgaXRlbSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgdGhlIGtleSBmb3IgYW4gaXRlbVxyXG4gICAqL1xyXG4gIGFic3RyYWN0IGNvbGxlY3QoaXRlbTogVik6IEsgfCBudWxsO1xyXG5cclxuICAvKipcclxuICAgKiBHZXQgdGhlIGtleSBmb3IgZGlzcG9zaW5nIGFuIGl0ZW1cclxuICAgKi9cclxuICBhYnN0cmFjdCBkaXNwb3NlKGl0ZW06IFYpOiBLIHwgbnVsbDtcclxuXHJcbiAgLyoqXHJcbiAgICogU3RvcCB0aGUgY29sbGVjdG9yXHJcbiAgICovXHJcbiAgc3RvcChyZWFzb24gPSAndXNlcicpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLmVuZGVkKSByZXR1cm47XHJcbiAgICBcclxuICAgIHRoaXMuZW5kZWQgPSB0cnVlO1xyXG4gICAgdGhpcy5lbmRSZWFzb24gPSByZWFzb247XHJcbiAgICBcclxuICAgIGlmICh0aGlzLl90aW1lb3V0KSB7XHJcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLl90aW1lb3V0KTtcclxuICAgICAgdGhpcy5fdGltZW91dCA9IG51bGw7XHJcbiAgICB9XHJcbiAgICBpZiAodGhpcy5faWRsZVRpbWVvdXQpIHtcclxuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuX2lkbGVUaW1lb3V0KTtcclxuICAgICAgdGhpcy5faWRsZVRpbWVvdXQgPSBudWxsO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICB0aGlzLmVtaXQoJ2VuZCcsIHRoaXMuY29sbGVjdGVkLCByZWFzb24pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVzZXQgdGhlIGNvbGxlY3RvcidzIHRpbWVyXHJcbiAgICovXHJcbiAgcmVzZXRUaW1lcihvcHRpb25zOiBDb2xsZWN0b3JSZXNldFRpbWVyT3B0aW9ucyA9IHt9KTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy5fdGltZW91dCkge1xyXG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5fdGltZW91dCk7XHJcbiAgICAgIHRoaXMuX3RpbWVvdXQgPSBudWxsO1xyXG4gICAgfVxyXG4gICAgaWYgKHRoaXMuX2lkbGVUaW1lb3V0KSB7XHJcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLl9pZGxlVGltZW91dCk7XHJcbiAgICAgIHRoaXMuX2lkbGVUaW1lb3V0ID0gbnVsbDtcclxuICAgIH1cclxuICAgIFxyXG4gICAgaWYgKG9wdGlvbnMudGltZSA/PyB0aGlzLm9wdGlvbnMudGltZSkge1xyXG4gICAgICB0aGlzLl90aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB0aGlzLnN0b3AoJ3RpbWUnKSwgb3B0aW9ucy50aW1lID8/IHRoaXMub3B0aW9ucy50aW1lKTtcclxuICAgIH1cclxuICAgIGlmIChvcHRpb25zLmlkbGUgPz8gdGhpcy5vcHRpb25zLmlkbGUpIHtcclxuICAgICAgdGhpcy5faWRsZVRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHRoaXMuc3RvcCgnaWRsZScpLCBvcHRpb25zLmlkbGUgPz8gdGhpcy5vcHRpb25zLmlkbGUpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2hlY2sgdGhlIGVuZCBjb25kaXRpb25zXHJcbiAgICovXHJcbiAgY2hlY2tFbmQoKTogYm9vbGVhbiB7XHJcbiAgICBjb25zdCByZWFzb24gPSB0aGlzLmVuZFJlYXNvbjtcclxuICAgIGlmIChyZWFzb24pIHtcclxuICAgICAgdGhpcy5zdG9wKHJlYXNvbik7XHJcbiAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IHRoZSBuZXh0IGl0ZW1cclxuICAgKi9cclxuICBnZXQgbmV4dCgpOiBQcm9taXNlPFY+IHtcclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgIGlmICh0aGlzLmVuZGVkKSB7XHJcbiAgICAgICAgcmVqZWN0KG5ldyBFcnJvcignQ29sbGVjdG9yIGhhcyBlbmRlZCcpKTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuICAgICAgXHJcbiAgICAgIGNvbnN0IGNsZWFudXAgPSAoKSA9PiB7XHJcbiAgICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcignY29sbGVjdCcsIG9uQ29sbGVjdCk7XHJcbiAgICAgICAgdGhpcy5yZW1vdmVMaXN0ZW5lcignZW5kJywgb25FbmQpO1xyXG4gICAgICB9O1xyXG4gICAgICBcclxuICAgICAgY29uc3Qgb25Db2xsZWN0ID0gKGl0ZW06IFYpID0+IHtcclxuICAgICAgICBjbGVhbnVwKCk7XHJcbiAgICAgICAgcmVzb2x2ZShpdGVtKTtcclxuICAgICAgfTtcclxuICAgICAgXHJcbiAgICAgIGNvbnN0IG9uRW5kID0gKCkgPT4ge1xyXG4gICAgICAgIGNsZWFudXAoKTtcclxuICAgICAgICByZWplY3QobmV3IEVycm9yKCdDb2xsZWN0b3IgZW5kZWQnKSk7XHJcbiAgICAgIH07XHJcbiAgICAgIFxyXG4gICAgICB0aGlzLm9uKCdjb2xsZWN0Jywgb25Db2xsZWN0KTtcclxuICAgICAgdGhpcy5vbignZW5kJywgb25FbmQpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogTWVzc2FnZSBjb2xsZWN0b3Igb3B0aW9uc1xyXG4gKi9cclxuZXhwb3J0IGludGVyZmFjZSBNZXNzYWdlQ29sbGVjdG9yT3B0aW9ucyBleHRlbmRzIENvbGxlY3Rvck9wdGlvbnM8TWVzc2FnZT4ge1xyXG4gIC8qKiBDaGFubmVsIHRvIGNvbGxlY3QgbWVzc2FnZXMgZnJvbSAqL1xyXG4gIGNoYW5uZWxJZD86IHN0cmluZztcclxufVxyXG5cclxuLyoqXHJcbiAqIENvbGxlY3RvciBmb3IgbWVzc2FnZXNcclxuICovXHJcbmV4cG9ydCBjbGFzcyBNZXNzYWdlQ29sbGVjdG9yIGV4dGVuZHMgQ29sbGVjdG9yPHN0cmluZywgTWVzc2FnZT4ge1xyXG4gIHB1YmxpYyByZWFkb25seSBjaGFubmVsSWQ6IHN0cmluZztcclxuICBwcml2YXRlIHJlYWRvbmx5IG1lc3NhZ2VIYW5kbGVyOiAobWVzc2FnZTogTWVzc2FnZSkgPT4gdm9pZDtcclxuXHJcbiAgY29uc3RydWN0b3IoY2xpZW50OiB1bmtub3duLCBjaGFubmVsSWQ6IHN0cmluZywgb3B0aW9uczogTWVzc2FnZUNvbGxlY3Rvck9wdGlvbnMgPSB7fSkge1xyXG4gICAgc3VwZXIoY2xpZW50LCBvcHRpb25zKTtcclxuICAgIHRoaXMuY2hhbm5lbElkID0gY2hhbm5lbElkO1xyXG4gICAgXHJcbiAgICAvLyBHZXQgYm90J3MgdXNlciBJRCB0byBmaWx0ZXIgb3V0IGJvdCdzIG93biBtZXNzYWdlc1xyXG4gICAgY29uc3QgYm90VXNlcklkID0gKGNsaWVudCBhcyB7IHVzZXI/OiB7IGlkOiBzdHJpbmcgfSB9KS51c2VyPy5pZDtcclxuICAgIFxyXG4gICAgdGhpcy5tZXNzYWdlSGFuZGxlciA9IChtZXNzYWdlOiBNZXNzYWdlKSA9PiB7XHJcbiAgICAgIGNvbnN0IG1lc3NhZ2VDaGFubmVsSWQgPSAobWVzc2FnZSBhcyB7IGNoYW5uZWxfaWQ/OiBzdHJpbmc7IGNoYW5uZWxJZD86IHN0cmluZyB9KS5jaGFubmVsX2lkID8/IG1lc3NhZ2UuY2hhbm5lbElkO1xyXG4gICAgICBpZiAobWVzc2FnZUNoYW5uZWxJZCA9PT0gdGhpcy5jaGFubmVsSWQpIHtcclxuICAgICAgICAvLyBBdXRvbWF0aWNhbGx5IGZpbHRlciBvdXQgYm90J3Mgb3duIG1lc3NhZ2VzXHJcbiAgICAgICAgY29uc3QgYXV0aG9ySWQgPSBtZXNzYWdlLmF1dGhvcj8uaWQ7XHJcbiAgICAgICAgaWYgKGJvdFVzZXJJZCAmJiBhdXRob3JJZCA9PT0gYm90VXNlcklkKSByZXR1cm47XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8gQWxzbyBmaWx0ZXIgYnkgYXBwbGljYXRpb25faWQgKGJvdCBtZXNzYWdlcyBoYXZlIHRoaXMpXHJcbiAgICAgICAgaWYgKChtZXNzYWdlIGFzIHsgYXBwbGljYXRpb25faWQ/OiBzdHJpbmc7IGFwcGxpY2F0aW9uSWQ/OiBzdHJpbmcgfSkuYXBwbGljYXRpb25faWQgfHwgXHJcbiAgICAgICAgICAgIChtZXNzYWdlIGFzIHsgYXBwbGljYXRpb25JZD86IHN0cmluZyB9KS5hcHBsaWNhdGlvbklkKSByZXR1cm47XHJcbiAgICAgICAgXHJcbiAgICAgICAgdGhpcy5oYW5kbGVDb2xsZWN0KG1lc3NhZ2UpO1xyXG4gICAgICB9XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICAoY2xpZW50IGFzIEV2ZW50RW1pdHRlcikub24oJ21lc3NhZ2VDcmVhdGUnLCB0aGlzLm1lc3NhZ2VIYW5kbGVyKTtcclxuICAgIFxyXG4gICAgdGhpcy5vbmNlKCdlbmQnLCAoKSA9PiB7XHJcbiAgICAgIChjbGllbnQgYXMgRXZlbnRFbWl0dGVyKS5yZW1vdmVMaXN0ZW5lcignbWVzc2FnZUNyZWF0ZScsIHRoaXMubWVzc2FnZUhhbmRsZXIpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBjb2xsZWN0KG1lc3NhZ2U6IE1lc3NhZ2UpOiBzdHJpbmcgfCBudWxsIHtcclxuICAgIHJldHVybiBtZXNzYWdlLmlkID8/IG51bGw7XHJcbiAgfVxyXG5cclxuICBkaXNwb3NlKG1lc3NhZ2U6IE1lc3NhZ2UpOiBzdHJpbmcgfCBudWxsIHtcclxuICAgIHJldHVybiBtZXNzYWdlLmlkID8/IG51bGw7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogSW50ZXJhY3Rpb24gY29sbGVjdG9yIG9wdGlvbnNcclxuICovXHJcbmV4cG9ydCBpbnRlcmZhY2UgSW50ZXJhY3Rpb25Db2xsZWN0b3JPcHRpb25zIGV4dGVuZHMgQ29sbGVjdG9yT3B0aW9uczxJbnRlcmFjdGlvbj4ge1xyXG4gIC8qKiBDaGFubmVsIHRvIGNvbGxlY3QgaW50ZXJhY3Rpb25zIGZyb20gKi9cclxuICBjaGFubmVsSWQ/OiBzdHJpbmc7XHJcbiAgLyoqIEd1aWxkIHRvIGNvbGxlY3QgaW50ZXJhY3Rpb25zIGZyb20gKi9cclxuICBndWlsZElkPzogc3RyaW5nO1xyXG4gIC8qKiBNZXNzYWdlIHRvIGNvbGxlY3QgaW50ZXJhY3Rpb25zIGZyb20gKi9cclxuICBtZXNzYWdlSWQ/OiBzdHJpbmc7XHJcbiAgLyoqIEludGVyYWN0aW9uIHR5cGVzIHRvIGNvbGxlY3QgKi9cclxuICBpbnRlcmFjdGlvblR5cGU/OiBudW1iZXIgfCBudW1iZXJbXTtcclxuICAvKiogQ29tcG9uZW50IHR5cGVzIHRvIGNvbGxlY3QgKi9cclxuICBjb21wb25lbnRUeXBlPzogbnVtYmVyIHwgbnVtYmVyW107XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb2xsZWN0b3IgZm9yIGludGVyYWN0aW9ucyAoYnV0dG9ucywgc2VsZWN0IG1lbnVzLCBldGMuKVxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIEludGVyYWN0aW9uQ29sbGVjdG9yIGV4dGVuZHMgQ29sbGVjdG9yPHN0cmluZywgSW50ZXJhY3Rpb24+IHtcclxuICBwdWJsaWMgcmVhZG9ubHkgY2hhbm5lbElkPzogc3RyaW5nO1xyXG4gIHB1YmxpYyByZWFkb25seSBndWlsZElkPzogc3RyaW5nO1xyXG4gIHB1YmxpYyByZWFkb25seSBtZXNzYWdlSWQ/OiBzdHJpbmc7XHJcbiAgcHVibGljIHJlYWRvbmx5IGludGVyYWN0aW9uVHlwZT86IG51bWJlcltdO1xyXG4gIHB1YmxpYyByZWFkb25seSBjb21wb25lbnRUeXBlPzogbnVtYmVyW107XHJcbiAgcHJpdmF0ZSByZWFkb25seSBpbnRlcmFjdGlvbkhhbmRsZXI6IChpbnRlcmFjdGlvbjogSW50ZXJhY3Rpb24pID0+IHZvaWQ7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGNsaWVudDogdW5rbm93biwgb3B0aW9uczogSW50ZXJhY3Rpb25Db2xsZWN0b3JPcHRpb25zID0ge30pIHtcclxuICAgIHN1cGVyKGNsaWVudCwgb3B0aW9ucyk7XHJcbiAgICB0aGlzLmNoYW5uZWxJZCA9IG9wdGlvbnMuY2hhbm5lbElkO1xyXG4gICAgdGhpcy5ndWlsZElkID0gb3B0aW9ucy5ndWlsZElkO1xyXG4gICAgdGhpcy5tZXNzYWdlSWQgPSBvcHRpb25zLm1lc3NhZ2VJZDtcclxuICAgIHRoaXMuaW50ZXJhY3Rpb25UeXBlID0gb3B0aW9ucy5pbnRlcmFjdGlvblR5cGUgXHJcbiAgICAgID8gQXJyYXkuaXNBcnJheShvcHRpb25zLmludGVyYWN0aW9uVHlwZSkgPyBvcHRpb25zLmludGVyYWN0aW9uVHlwZSA6IFtvcHRpb25zLmludGVyYWN0aW9uVHlwZV1cclxuICAgICAgOiB1bmRlZmluZWQ7XHJcbiAgICB0aGlzLmNvbXBvbmVudFR5cGUgPSBvcHRpb25zLmNvbXBvbmVudFR5cGVcclxuICAgICAgPyBBcnJheS5pc0FycmF5KG9wdGlvbnMuY29tcG9uZW50VHlwZSkgPyBvcHRpb25zLmNvbXBvbmVudFR5cGUgOiBbb3B0aW9ucy5jb21wb25lbnRUeXBlXVxyXG4gICAgICA6IHVuZGVmaW5lZDtcclxuICAgIFxyXG4gICAgdGhpcy5pbnRlcmFjdGlvbkhhbmRsZXIgPSAoaW50ZXJhY3Rpb246IEludGVyYWN0aW9uKSA9PiB7XHJcbiAgICAgIC8vIEZpbHRlciBieSBjaGFubmVsXHJcbiAgICAgIGlmICh0aGlzLmNoYW5uZWxJZCAmJiBpbnRlcmFjdGlvbi5jaGFubmVsSWQgIT09IHRoaXMuY2hhbm5lbElkKSByZXR1cm47XHJcbiAgICAgIC8vIEZpbHRlciBieSBndWlsZFxyXG4gICAgICBpZiAodGhpcy5ndWlsZElkICYmIGludGVyYWN0aW9uLmd1aWxkSWQgIT09IHRoaXMuZ3VpbGRJZCkgcmV0dXJuO1xyXG4gICAgICAvLyBGaWx0ZXIgYnkgbWVzc2FnZVxyXG4gICAgICBpZiAodGhpcy5tZXNzYWdlSWQgJiYgKGludGVyYWN0aW9uIGFzIHsgbWVzc2FnZT86IHsgaWQ6IHN0cmluZyB9IH0pLm1lc3NhZ2U/LmlkICE9PSB0aGlzLm1lc3NhZ2VJZCkgcmV0dXJuO1xyXG4gICAgICAvLyBGaWx0ZXIgYnkgaW50ZXJhY3Rpb24gdHlwZVxyXG4gICAgICBpZiAodGhpcy5pbnRlcmFjdGlvblR5cGUgJiYgIXRoaXMuaW50ZXJhY3Rpb25UeXBlLmluY2x1ZGVzKGludGVyYWN0aW9uLnR5cGUpKSByZXR1cm47XHJcbiAgICAgIC8vIEZpbHRlciBieSBjb21wb25lbnQgdHlwZVxyXG4gICAgICBjb25zdCBjb21wb25lbnRUeXBlID0gKGludGVyYWN0aW9uIGFzIHsgY29tcG9uZW50VHlwZT86IG51bWJlciB9KS5jb21wb25lbnRUeXBlO1xyXG4gICAgICBpZiAodGhpcy5jb21wb25lbnRUeXBlICYmIGNvbXBvbmVudFR5cGUgJiYgIXRoaXMuY29tcG9uZW50VHlwZS5pbmNsdWRlcyhjb21wb25lbnRUeXBlKSkgcmV0dXJuO1xyXG4gICAgICBcclxuICAgICAgdGhpcy5oYW5kbGVDb2xsZWN0KGludGVyYWN0aW9uKTtcclxuICAgIH07XHJcbiAgICBcclxuICAgIChjbGllbnQgYXMgRXZlbnRFbWl0dGVyKS5vbignaW50ZXJhY3Rpb25DcmVhdGUnLCB0aGlzLmludGVyYWN0aW9uSGFuZGxlcik7XHJcbiAgICBcclxuICAgIHRoaXMub25jZSgnZW5kJywgKCkgPT4ge1xyXG4gICAgICAoY2xpZW50IGFzIEV2ZW50RW1pdHRlcikucmVtb3ZlTGlzdGVuZXIoJ2ludGVyYWN0aW9uQ3JlYXRlJywgdGhpcy5pbnRlcmFjdGlvbkhhbmRsZXIpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBjb2xsZWN0KGludGVyYWN0aW9uOiBJbnRlcmFjdGlvbik6IHN0cmluZyB8IG51bGwge1xyXG4gICAgcmV0dXJuIGludGVyYWN0aW9uLmlkID8/IG51bGw7XHJcbiAgfVxyXG5cclxuICBkaXNwb3NlKGludGVyYWN0aW9uOiBJbnRlcmFjdGlvbik6IHN0cmluZyB8IG51bGwge1xyXG4gICAgcmV0dXJuIGludGVyYWN0aW9uLmlkID8/IG51bGw7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogUmVhY3Rpb24gZGF0YSBzdHJ1Y3R1cmVcclxuICovXHJcbmV4cG9ydCBpbnRlcmZhY2UgUmVhY3Rpb25EYXRhIHtcclxuICBtZXNzYWdlX2lkPzogc3RyaW5nO1xyXG4gIG1lc3NhZ2VJZD86IHN0cmluZztcclxuICBlbW9qaT86IHsgaWQ/OiBzdHJpbmc7IG5hbWU/OiBzdHJpbmcgfTtcclxufVxyXG5cclxuLyoqXHJcbiAqIFJlYWN0aW9uIGNvbGxlY3RvciBvcHRpb25zXHJcbiAqL1xyXG5leHBvcnQgaW50ZXJmYWNlIFJlYWN0aW9uQ29sbGVjdG9yT3B0aW9ucyBleHRlbmRzIENvbGxlY3Rvck9wdGlvbnM8UmVhY3Rpb25EYXRhPiB7XHJcbiAgLyoqIE1lc3NhZ2UgdG8gY29sbGVjdCByZWFjdGlvbnMgZnJvbSAqL1xyXG4gIG1lc3NhZ2VJZDogc3RyaW5nO1xyXG59XHJcblxyXG4vKipcclxuICogQ29sbGVjdG9yIGZvciByZWFjdGlvbnNcclxuICovXHJcbmV4cG9ydCBjbGFzcyBSZWFjdGlvbkNvbGxlY3RvciBleHRlbmRzIENvbGxlY3RvcjxzdHJpbmcsIFJlYWN0aW9uRGF0YT4ge1xyXG4gIHB1YmxpYyByZWFkb25seSBtZXNzYWdlSWQ6IHN0cmluZztcclxuICBwcml2YXRlIHJlYWRvbmx5IHJlYWN0aW9uSGFuZGxlcjogKHJlYWN0aW9uOiBSZWFjdGlvbkRhdGEpID0+IHZvaWQ7XHJcblxyXG4gIGNvbnN0cnVjdG9yKGNsaWVudDogdW5rbm93biwgbWVzc2FnZUlkOiBzdHJpbmcsIG9wdGlvbnM6IFJlYWN0aW9uQ29sbGVjdG9yT3B0aW9ucykge1xyXG4gICAgc3VwZXIoY2xpZW50LCBvcHRpb25zKTtcclxuICAgIHRoaXMubWVzc2FnZUlkID0gbWVzc2FnZUlkO1xyXG4gICAgXHJcbiAgICB0aGlzLnJlYWN0aW9uSGFuZGxlciA9IChyZWFjdGlvbjogUmVhY3Rpb25EYXRhKSA9PiB7XHJcbiAgICAgIGlmIChyZWFjdGlvbi5tZXNzYWdlX2lkID09PSB0aGlzLm1lc3NhZ2VJZCB8fCByZWFjdGlvbi5tZXNzYWdlSWQgPT09IHRoaXMubWVzc2FnZUlkKSB7XHJcbiAgICAgICAgdGhpcy5oYW5kbGVDb2xsZWN0KHJlYWN0aW9uKTtcclxuICAgICAgfVxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgKGNsaWVudCBhcyBFdmVudEVtaXR0ZXIpLm9uKCdtZXNzYWdlUmVhY3Rpb25BZGQnLCB0aGlzLnJlYWN0aW9uSGFuZGxlcik7XHJcbiAgICBcclxuICAgIHRoaXMub25jZSgnZW5kJywgKCkgPT4ge1xyXG4gICAgICAoY2xpZW50IGFzIEV2ZW50RW1pdHRlcikucmVtb3ZlTGlzdGVuZXIoJ21lc3NhZ2VSZWFjdGlvbkFkZCcsIHRoaXMucmVhY3Rpb25IYW5kbGVyKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgY29sbGVjdChyZWFjdGlvbjogUmVhY3Rpb25EYXRhKTogc3RyaW5nIHwgbnVsbCB7XHJcbiAgICAvLyBLZXkgaXMgZW1vamkgaWRlbnRpZmllclxyXG4gICAgcmV0dXJuIHJlYWN0aW9uLmVtb2ppPy5pZCA/PyByZWFjdGlvbi5lbW9qaT8ubmFtZSA/PyBudWxsO1xyXG4gIH1cclxuXHJcbiAgZGlzcG9zZShyZWFjdGlvbjogUmVhY3Rpb25EYXRhKTogc3RyaW5nIHwgbnVsbCB7XHJcbiAgICByZXR1cm4gcmVhY3Rpb24uZW1vamk/LmlkID8/IHJlYWN0aW9uLmVtb2ppPy5uYW1lID8/IG51bGw7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogQXdhaXQgbWVzc2FnZXMgaGVscGVyXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gYXdhaXRNZXNzYWdlcyhcclxuICBjbGllbnQ6IHVua25vd24sXHJcbiAgY2hhbm5lbElkOiBzdHJpbmcsXHJcbiAgb3B0aW9uczogTWVzc2FnZUNvbGxlY3Rvck9wdGlvbnMgPSB7fVxyXG4pOiBQcm9taXNlPENvbGxlY3Rpb248c3RyaW5nLCBNZXNzYWdlPj4ge1xyXG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICBjb25zdCBjb2xsZWN0b3IgPSBuZXcgTWVzc2FnZUNvbGxlY3RvcihjbGllbnQsIGNoYW5uZWxJZCwgb3B0aW9ucyk7XHJcbiAgICBcclxuICAgIGNvbGxlY3Rvci5vbmNlKCdlbmQnLCAoY29sbGVjdGVkLCByZWFzb24pID0+IHtcclxuICAgICAgaWYgKG9wdGlvbnMubWF4ICYmIGNvbGxlY3RlZC5zaXplIDwgb3B0aW9ucy5tYXgpIHtcclxuICAgICAgICByZWplY3QobmV3IEVycm9yKGBDb2xsZWN0b3IgZW5kZWQgd2l0aCByZWFzb246ICR7cmVhc29ufWApKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICByZXNvbHZlKGNvbGxlY3RlZCk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH0pO1xyXG59XHJcblxyXG4vKipcclxuICogQXdhaXQgcmVhY3Rpb25zIGhlbHBlclxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGF3YWl0UmVhY3Rpb25zKFxyXG4gIGNsaWVudDogdW5rbm93bixcclxuICBtZXNzYWdlSWQ6IHN0cmluZyxcclxuICBvcHRpb25zOiBSZWFjdGlvbkNvbGxlY3Rvck9wdGlvbnNcclxuKTogUHJvbWlzZTxDb2xsZWN0aW9uPHN0cmluZywgUmVhY3Rpb25EYXRhPj4ge1xyXG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICBjb25zdCBjb2xsZWN0b3IgPSBuZXcgUmVhY3Rpb25Db2xsZWN0b3IoY2xpZW50LCBtZXNzYWdlSWQsIG9wdGlvbnMpO1xyXG4gICAgXHJcbiAgICBjb2xsZWN0b3Iub25jZSgnZW5kJywgKGNvbGxlY3RlZCwgcmVhc29uKSA9PiB7XHJcbiAgICAgIGlmIChvcHRpb25zLm1heCAmJiBjb2xsZWN0ZWQuc2l6ZSA8IG9wdGlvbnMubWF4KSB7XHJcbiAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihgQ29sbGVjdG9yIGVuZGVkIHdpdGggcmVhc29uOiAke3JlYXNvbn1gKSk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgcmVzb2x2ZShjb2xsZWN0ZWQpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9KTtcclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgQ29sbGVjdG9yO1xyXG4iXX0=