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
    /** Filter function */
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
            if (message.channel_id === this.channelId || message.channelId === this.channelId) {
                // Automatically filter out bot's own messages
                const authorId = message.author?.id || message.author_id;
                if (botUserId && authorId === botUserId)
                    return;
                // Also filter by application_id (bot messages have this)
                if (message.application_id || message.applicationId)
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
            if (this.componentType && interaction.componentType && !this.componentType.includes(interaction.componentType))
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ29sbGVjdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3V0aWxzL0NvbGxlY3Rvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7OztHQUdHOzs7QUE2WEgsc0NBZ0JDO0FBS0Qsd0NBZ0JDO0FBaGFELG1DQUFzQztBQUN0Qyw2Q0FBMEM7QUFzQjFDOztHQUVHO0FBQ0gsTUFBc0IsU0FBK0IsU0FBUSxxQkFBWTtJQUN2RSxrREFBa0Q7SUFDbEMsTUFBTSxDQUFNO0lBRTVCLDBCQUEwQjtJQUNWLFNBQVMsR0FBcUIsSUFBSSx1QkFBVSxFQUFFLENBQUM7SUFFL0Qsc0NBQXNDO0lBQy9CLEtBQUssR0FBRyxLQUFLLENBQUM7SUFFckIscUNBQXFDO0lBQzlCLFNBQVMsR0FBa0IsSUFBSSxDQUFDO0lBRXZDLHNCQUFzQjtJQUNmLE1BQU0sQ0FBdUU7SUFFcEYsd0JBQXdCO0lBQ2pCLE9BQU8sQ0FBc0I7SUFFcEMsZ0NBQWdDO0lBQ3hCLGVBQWUsR0FBRyxDQUFDLENBQUM7SUFFNUIsNkJBQTZCO0lBQ3JCLFFBQVEsR0FBMEIsSUFBSSxDQUFDO0lBRS9DLDZCQUE2QjtJQUNyQixZQUFZLEdBQTBCLElBQUksQ0FBQztJQUVuRCxZQUFZLE1BQVcsRUFBRSxVQUErQixFQUFFO1FBQ3hELEtBQUssRUFBRSxDQUFDO1FBQ1IsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7UUFDckIsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7UUFDdkIsSUFBSSxDQUFDLE1BQU0sR0FBSSxPQUFPLENBQUMsTUFBYyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFdEQsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNuRCxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FB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RXBFLFNBQVMsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUMsU0FBUyxFQUFFLE1BQU0sRUFBRSxFQUFFO1lBQzFDLElBQUksT0FBTyxDQUFDLEdBQUcsSUFBSSxTQUFTLENBQUMsSUFBSSxHQUFHLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQztnQkFDaEQsTUFBTSxDQUFDLElBQUksS0FBSyxDQUFDLGdDQUFnQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDOUQsQ0FBQztpQkFBTSxDQUFDO2dCQUNOLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUNyQixDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUM7QUFFRCxrQkFBZSxTQUFTLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogQ29sbGVjdG9ycyBmb3IgYXdhaXRpbmcgbWVzc2FnZXMsIHJlYWN0aW9ucywgYW5kIGludGVyYWN0aW9uc1xyXG4gKiBBUEkgY29tcGF0aWJsZSB3aXRoIERpc2NvcmQuanMgQ29sbGVjdG9yc1xyXG4gKi9cclxuXHJcbmltcG9ydCB7IEV2ZW50RW1pdHRlciB9IGZyb20gJ2V2ZW50cyc7XHJcbmltcG9ydCB7IENvbGxlY3Rpb24gfSBmcm9tICcuL0NvbGxlY3Rpb24nO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBDb2xsZWN0b3JPcHRpb25zPFQ+IHtcclxuICAvKiogSG93IGxvbmcgdG8gcnVuIHRoZSBjb2xsZWN0b3IgZm9yIGluIG1pbGxpc2Vjb25kcyAqL1xyXG4gIHRpbWU/OiBudW1iZXI7XHJcbiAgLyoqIEhvdyBsb25nIHRvIHdhaXQgZm9yIHRoZSBuZXh0IGl0ZW0gaW4gbWlsbGlzZWNvbmRzICovXHJcbiAgaWRsZT86IG51bWJlcjtcclxuICAvKiogTWF4aW11bSBudW1iZXIgb2YgaXRlbXMgdG8gY29sbGVjdCAqL1xyXG4gIG1heD86IG51bWJlcjtcclxuICAvKiogTWF4aW11bSBudW1iZXIgb2YgaXRlbXMgdG8gcHJvY2VzcyAqL1xyXG4gIG1heFByb2Nlc3NlZD86IG51bWJlcjtcclxuICAvKiogRmlsdGVyIGZ1bmN0aW9uICovXHJcbiAgZmlsdGVyPzogKGl0ZW06IFQsIGNvbGxlY3RlZDogQ29sbGVjdGlvbjxzdHJpbmcsIFQ+KSA9PiBib29sZWFuIHwgUHJvbWlzZTxib29sZWFuPjtcclxuICAvKiogV2hldGhlciB0byBkaXNwb3NlIG9mIGl0ZW1zIHdoZW4gdGhlIGNvbGxlY3RvciBlbmRzICovXHJcbiAgZGlzcG9zZT86IGJvb2xlYW47XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgQ29sbGVjdG9yUmVzZXRUaW1lck9wdGlvbnMge1xyXG4gIHRpbWU/OiBudW1iZXI7XHJcbiAgaWRsZT86IG51bWJlcjtcclxufVxyXG5cclxuLyoqXHJcbiAqIEFic3RyYWN0IGJhc2UgY2xhc3MgZm9yIGNvbGxlY3RvcnNcclxuICovXHJcbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBDb2xsZWN0b3I8SyBleHRlbmRzIHN0cmluZywgVj4gZXh0ZW5kcyBFdmVudEVtaXR0ZXIge1xyXG4gIC8qKiBUaGUgY2xpZW50IHRoYXQgaW5zdGFudGlhdGVkIHRoaXMgY29sbGVjdG9yICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGNsaWVudDogYW55O1xyXG4gIFxyXG4gIC8qKiBUaGUgaXRlbXMgY29sbGVjdGVkICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGNvbGxlY3RlZDogQ29sbGVjdGlvbjxLLCBWPiA9IG5ldyBDb2xsZWN0aW9uKCk7XHJcbiAgXHJcbiAgLyoqIFdoZXRoZXIgdGhlIGNvbGxlY3RvciBoYXMgZW5kZWQgKi9cclxuICBwdWJsaWMgZW5kZWQgPSBmYWxzZTtcclxuICBcclxuICAvKiogVGhlIHJlYXNvbiB0aGUgY29sbGVjdG9yIGVuZGVkICovXHJcbiAgcHVibGljIGVuZFJlYXNvbjogc3RyaW5nIHwgbnVsbCA9IG51bGw7XHJcbiAgXHJcbiAgLyoqIEZpbHRlciBmdW5jdGlvbiAqL1xyXG4gIHB1YmxpYyBmaWx0ZXI6IChpdGVtOiBWLCBjb2xsZWN0ZWQ6IENvbGxlY3Rpb248SywgVj4pID0+IGJvb2xlYW4gfCBQcm9taXNlPGJvb2xlYW4+O1xyXG4gIFxyXG4gIC8qKiBDb2xsZWN0b3Igb3B0aW9ucyAqL1xyXG4gIHB1YmxpYyBvcHRpb25zOiBDb2xsZWN0b3JPcHRpb25zPFY+O1xyXG4gIFxyXG4gIC8qKiBOdW1iZXIgb2YgaXRlbXMgcHJvY2Vzc2VkICovXHJcbiAgcHJpdmF0ZSBfcHJvY2Vzc2VkQ291bnQgPSAwO1xyXG4gIFxyXG4gIC8qKiBUaW1lb3V0IGZvciB0aW1lIGxpbWl0ICovXHJcbiAgcHJpdmF0ZSBfdGltZW91dDogTm9kZUpTLlRpbWVvdXQgfCBudWxsID0gbnVsbDtcclxuICBcclxuICAvKiogVGltZW91dCBmb3IgaWRsZSBsaW1pdCAqL1xyXG4gIHByaXZhdGUgX2lkbGVUaW1lb3V0OiBOb2RlSlMuVGltZW91dCB8IG51bGwgPSBudWxsO1xyXG5cclxuICBjb25zdHJ1Y3RvcihjbGllbnQ6IGFueSwgb3B0aW9uczogQ29sbGVjdG9yT3B0aW9uczxWPiA9IHt9KSB7XHJcbiAgICBzdXBlcigpO1xyXG4gICAgdGhpcy5jbGllbnQgPSBjbGllbnQ7XHJcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xyXG4gICAgdGhpcy5maWx0ZXIgPSAob3B0aW9ucy5maWx0ZXIgYXMgYW55KSA/PyAoKCkgPT4gdHJ1ZSk7XHJcbiAgICBcclxuICAgIHRoaXMuaGFuZGxlQ29sbGVjdCA9IHRoaXMuaGFuZGxlQ29sbGVjdC5iaW5kKHRoaXMpO1xyXG4gICAgdGhpcy5oYW5kbGVEaXNwb3NlID0gdGhpcy5oYW5kbGVEaXNwb3NlLmJpbmQodGhpcyk7XHJcbiAgICBcclxuICAgIGlmIChvcHRpb25zLnRpbWUpIHtcclxuICAgICAgdGhpcy5fdGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4gdGhpcy5zdG9wKCd0aW1lJyksIG9wdGlvbnMudGltZSk7XHJcbiAgICB9XHJcbiAgICBpZiAob3B0aW9ucy5pZGxlKSB7XHJcbiAgICAgIHRoaXMuX2lkbGVUaW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB0aGlzLnN0b3AoJ2lkbGUnKSwgb3B0aW9ucy5pZGxlKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZSBhbiBpdGVtIGJlaW5nIGNvbGxlY3RlZFxyXG4gICAqL1xyXG4gIGFzeW5jIGhhbmRsZUNvbGxlY3QoaXRlbTogVik6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgaWYgKHRoaXMuZW5kZWQpIHJldHVybjtcclxuICAgIFxyXG4gICAgdGhpcy5fcHJvY2Vzc2VkQ291bnQrKztcclxuICAgIFxyXG4gICAgY29uc3QgZmlsdGVyUmVzdWx0ID0gYXdhaXQgdGhpcy5maWx0ZXIoaXRlbSwgdGhpcy5jb2xsZWN0ZWQpO1xyXG4gICAgaWYgKCFmaWx0ZXJSZXN1bHQpIHJldHVybjtcclxuICAgIFxyXG4gICAgY29uc3Qga2V5ID0gdGhpcy5jb2xsZWN0KGl0ZW0pO1xyXG4gICAgaWYgKGtleSA9PT0gbnVsbCkgcmV0dXJuO1xyXG4gICAgXHJcbiAgICB0aGlzLmNvbGxlY3RlZC5zZXQoa2V5LCBpdGVtKTtcclxuICAgIHRoaXMuZW1pdCgnY29sbGVjdCcsIGl0ZW0pO1xyXG4gICAgXHJcbiAgICAvLyBSZXNldCBpZGxlIHRpbWVyXHJcbiAgICBpZiAodGhpcy5faWRsZVRpbWVvdXQpIHtcclxuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuX2lkbGVUaW1lb3V0KTtcclxuICAgICAgdGhpcy5faWRsZVRpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHRoaXMuc3RvcCgnaWRsZScpLCB0aGlzLm9wdGlvbnMuaWRsZSEpO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICAvLyBDaGVjayBsaW1pdHNcclxuICAgIGlmICh0aGlzLm9wdGlvbnMubWF4ICYmIHRoaXMuY29sbGVjdGVkLnNpemUgPj0gdGhpcy5vcHRpb25zLm1heCkge1xyXG4gICAgICB0aGlzLnN0b3AoJ2xpbWl0Jyk7XHJcbiAgICB9XHJcbiAgICBpZiAodGhpcy5vcHRpb25zLm1heFByb2Nlc3NlZCAmJiB0aGlzLl9wcm9jZXNzZWRDb3VudCA+PSB0aGlzLm9wdGlvbnMubWF4UHJvY2Vzc2VkKSB7XHJcbiAgICAgIHRoaXMuc3RvcCgncHJvY2Vzc2VkTGltaXQnKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEhhbmRsZSBhbiBpdGVtIGJlaW5nIGRpc3Bvc2VkXHJcbiAgICovXHJcbiAgaGFuZGxlRGlzcG9zZShpdGVtOiBWKTogdm9pZCB7XHJcbiAgICBpZiAoIXRoaXMub3B0aW9ucy5kaXNwb3NlKSByZXR1cm47XHJcbiAgICBcclxuICAgIGNvbnN0IGtleSA9IHRoaXMuZGlzcG9zZShpdGVtKTtcclxuICAgIGlmIChrZXkgPT09IG51bGwpIHJldHVybjtcclxuICAgIFxyXG4gICAgaWYgKHRoaXMuY29sbGVjdGVkLmhhcyhrZXkpKSB7XHJcbiAgICAgIHRoaXMuY29sbGVjdGVkLmRlbGV0ZShrZXkpO1xyXG4gICAgICB0aGlzLmVtaXQoJ2Rpc3Bvc2UnLCBpdGVtKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCB0aGUga2V5IGZvciBhbiBpdGVtXHJcbiAgICovXHJcbiAgYWJzdHJhY3QgY29sbGVjdChpdGVtOiBWKTogSyB8IG51bGw7XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCB0aGUga2V5IGZvciBkaXNwb3NpbmcgYW4gaXRlbVxyXG4gICAqL1xyXG4gIGFic3RyYWN0IGRpc3Bvc2UoaXRlbTogVik6IEsgfCBudWxsO1xyXG5cclxuICAvKipcclxuICAgKiBTdG9wIHRoZSBjb2xsZWN0b3JcclxuICAgKi9cclxuICBzdG9wKHJlYXNvbiA9ICd1c2VyJyk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMuZW5kZWQpIHJldHVybjtcclxuICAgIFxyXG4gICAgdGhpcy5lbmRlZCA9IHRydWU7XHJcbiAgICB0aGlzLmVuZFJlYXNvbiA9IHJlYXNvbjtcclxuICAgIFxyXG4gICAgaWYgKHRoaXMuX3RpbWVvdXQpIHtcclxuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuX3RpbWVvdXQpO1xyXG4gICAgICB0aGlzLl90aW1lb3V0ID0gbnVsbDtcclxuICAgIH1cclxuICAgIGlmICh0aGlzLl9pZGxlVGltZW91dCkge1xyXG4gICAgICBjbGVhclRpbWVvdXQodGhpcy5faWRsZVRpbWVvdXQpO1xyXG4gICAgICB0aGlzLl9pZGxlVGltZW91dCA9IG51bGw7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHRoaXMuZW1pdCgnZW5kJywgdGhpcy5jb2xsZWN0ZWQsIHJlYXNvbik7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZXNldCB0aGUgY29sbGVjdG9yJ3MgdGltZXJcclxuICAgKi9cclxuICByZXNldFRpbWVyKG9wdGlvbnM6IENvbGxlY3RvclJlc2V0VGltZXJPcHRpb25zID0ge30pOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLl90aW1lb3V0KSB7XHJcbiAgICAgIGNsZWFyVGltZW91dCh0aGlzLl90aW1lb3V0KTtcclxuICAgICAgdGhpcy5fdGltZW91dCA9IG51bGw7XHJcbiAgICB9XHJcbiAgICBpZiAodGhpcy5faWRsZVRpbWVvdXQpIHtcclxuICAgICAgY2xlYXJUaW1lb3V0KHRoaXMuX2lkbGVUaW1lb3V0KTtcclxuICAgICAgdGhpcy5faWRsZVRpbWVvdXQgPSBudWxsO1xyXG4gICAgfVxyXG4gICAgXHJcbiAgICBpZiAob3B0aW9ucy50aW1lID8/IHRoaXMub3B0aW9ucy50aW1lKSB7XHJcbiAgICAgIHRoaXMuX3RpbWVvdXQgPSBzZXRUaW1lb3V0KCgpID0+IHRoaXMuc3RvcCgndGltZScpLCBvcHRpb25zLnRpbWUgPz8gdGhpcy5vcHRpb25zLnRpbWUpO1xyXG4gICAgfVxyXG4gICAgaWYgKG9wdGlvbnMuaWRsZSA/PyB0aGlzLm9wdGlvbnMuaWRsZSkge1xyXG4gICAgICB0aGlzLl9pZGxlVGltZW91dCA9IHNldFRpbWVvdXQoKCkgPT4gdGhpcy5zdG9wKCdpZGxlJyksIG9wdGlvbnMuaWRsZSA/PyB0aGlzLm9wdGlvbnMuaWRsZSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDaGVjayB0aGUgZW5kIGNvbmRpdGlvbnNcclxuICAgKi9cclxuICBjaGVja0VuZCgpOiBib29sZWFuIHtcclxuICAgIGNvbnN0IHJlYXNvbiA9IHRoaXMuZW5kUmVhc29uO1xyXG4gICAgaWYgKHJlYXNvbikge1xyXG4gICAgICB0aGlzLnN0b3AocmVhc29uKTtcclxuICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gZmFsc2U7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgdGhlIG5leHQgaXRlbVxyXG4gICAqL1xyXG4gIGdldCBuZXh0KCk6IFByb21pc2U8Vj4ge1xyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgaWYgKHRoaXMuZW5kZWQpIHtcclxuICAgICAgICByZWplY3QobmV3IEVycm9yKCdDb2xsZWN0b3IgaGFzIGVuZGVkJykpO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG4gICAgICBcclxuICAgICAgY29uc3QgY2xlYW51cCA9ICgpID0+IHtcclxuICAgICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKCdjb2xsZWN0Jywgb25Db2xsZWN0KTtcclxuICAgICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKCdlbmQnLCBvbkVuZCk7XHJcbiAgICAgIH07XHJcbiAgICAgIFxyXG4gICAgICBjb25zdCBvbkNvbGxlY3QgPSAoaXRlbTogVikgPT4ge1xyXG4gICAgICAgIGNsZWFudXAoKTtcclxuICAgICAgICByZXNvbHZlKGl0ZW0pO1xyXG4gICAgICB9O1xyXG4gICAgICBcclxuICAgICAgY29uc3Qgb25FbmQgPSAoKSA9PiB7XHJcbiAgICAgICAgY2xlYW51cCgpO1xyXG4gICAgICAgIHJlamVjdChuZXcgRXJyb3IoJ0NvbGxlY3RvciBlbmRlZCcpKTtcclxuICAgICAgfTtcclxuICAgICAgXHJcbiAgICAgIHRoaXMub24oJ2NvbGxlY3QnLCBvbkNvbGxlY3QpO1xyXG4gICAgICB0aGlzLm9uKCdlbmQnLCBvbkVuZCk7XHJcbiAgICB9KTtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBNZXNzYWdlIGNvbGxlY3RvciBvcHRpb25zXHJcbiAqL1xyXG5leHBvcnQgaW50ZXJmYWNlIE1lc3NhZ2VDb2xsZWN0b3JPcHRpb25zIGV4dGVuZHMgQ29sbGVjdG9yT3B0aW9uczxhbnk+IHtcclxuICAvKiogQ2hhbm5lbCB0byBjb2xsZWN0IG1lc3NhZ2VzIGZyb20gKi9cclxuICBjaGFubmVsSWQ/OiBzdHJpbmc7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb2xsZWN0b3IgZm9yIG1lc3NhZ2VzXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgTWVzc2FnZUNvbGxlY3RvciBleHRlbmRzIENvbGxlY3RvcjxzdHJpbmcsIGFueT4ge1xyXG4gIHB1YmxpYyByZWFkb25seSBjaGFubmVsSWQ6IHN0cmluZztcclxuICBwcml2YXRlIHJlYWRvbmx5IG1lc3NhZ2VIYW5kbGVyOiAobWVzc2FnZTogYW55KSA9PiB2b2lkO1xyXG5cclxuICBjb25zdHJ1Y3RvcihjbGllbnQ6IGFueSwgY2hhbm5lbElkOiBzdHJpbmcsIG9wdGlvbnM6IE1lc3NhZ2VDb2xsZWN0b3JPcHRpb25zID0ge30pIHtcclxuICAgIHN1cGVyKGNsaWVudCwgb3B0aW9ucyk7XHJcbiAgICB0aGlzLmNoYW5uZWxJZCA9IGNoYW5uZWxJZDtcclxuICAgIFxyXG4gICAgLy8gR2V0IGJvdCdzIHVzZXIgSUQgdG8gZmlsdGVyIG91dCBib3QncyBvd24gbWVzc2FnZXNcclxuICAgIGNvbnN0IGJvdFVzZXJJZCA9IGNsaWVudC51c2VyPy5pZDtcclxuICAgIFxyXG4gICAgdGhpcy5tZXNzYWdlSGFuZGxlciA9IChtZXNzYWdlOiBhbnkpID0+IHtcclxuICAgICAgaWYgKG1lc3NhZ2UuY2hhbm5lbF9pZCA9PT0gdGhpcy5jaGFubmVsSWQgfHwgbWVzc2FnZS5jaGFubmVsSWQgPT09IHRoaXMuY2hhbm5lbElkKSB7XHJcbiAgICAgICAgLy8gQXV0b21hdGljYWxseSBmaWx0ZXIgb3V0IGJvdCdzIG93biBtZXNzYWdlc1xyXG4gICAgICAgIGNvbnN0IGF1dGhvcklkID0gbWVzc2FnZS5hdXRob3I/LmlkIHx8IG1lc3NhZ2UuYXV0aG9yX2lkO1xyXG4gICAgICAgIGlmIChib3RVc2VySWQgJiYgYXV0aG9ySWQgPT09IGJvdFVzZXJJZCkgcmV0dXJuO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIEFsc28gZmlsdGVyIGJ5IGFwcGxpY2F0aW9uX2lkIChib3QgbWVzc2FnZXMgaGF2ZSB0aGlzKVxyXG4gICAgICAgIGlmIChtZXNzYWdlLmFwcGxpY2F0aW9uX2lkIHx8IG1lc3NhZ2UuYXBwbGljYXRpb25JZCkgcmV0dXJuO1xyXG4gICAgICAgIFxyXG4gICAgICAgIHRoaXMuaGFuZGxlQ29sbGVjdChtZXNzYWdlKTtcclxuICAgICAgfVxyXG4gICAgfTtcclxuICAgIFxyXG4gICAgY2xpZW50Lm9uKCdtZXNzYWdlQ3JlYXRlJywgdGhpcy5tZXNzYWdlSGFuZGxlcik7XHJcbiAgICBcclxuICAgIHRoaXMub25jZSgnZW5kJywgKCkgPT4ge1xyXG4gICAgICBjbGllbnQucmVtb3ZlTGlzdGVuZXIoJ21lc3NhZ2VDcmVhdGUnLCB0aGlzLm1lc3NhZ2VIYW5kbGVyKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgY29sbGVjdChtZXNzYWdlOiBhbnkpOiBzdHJpbmcgfCBudWxsIHtcclxuICAgIHJldHVybiBtZXNzYWdlLmlkID8/IG51bGw7XHJcbiAgfVxyXG5cclxuICBkaXNwb3NlKG1lc3NhZ2U6IGFueSk6IHN0cmluZyB8IG51bGwge1xyXG4gICAgcmV0dXJuIG1lc3NhZ2UuaWQgPz8gbnVsbDtcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBJbnRlcmFjdGlvbiBjb2xsZWN0b3Igb3B0aW9uc1xyXG4gKi9cclxuZXhwb3J0IGludGVyZmFjZSBJbnRlcmFjdGlvbkNvbGxlY3Rvck9wdGlvbnMgZXh0ZW5kcyBDb2xsZWN0b3JPcHRpb25zPGFueT4ge1xyXG4gIC8qKiBDaGFubmVsIHRvIGNvbGxlY3QgaW50ZXJhY3Rpb25zIGZyb20gKi9cclxuICBjaGFubmVsSWQ/OiBzdHJpbmc7XHJcbiAgLyoqIEd1aWxkIHRvIGNvbGxlY3QgaW50ZXJhY3Rpb25zIGZyb20gKi9cclxuICBndWlsZElkPzogc3RyaW5nO1xyXG4gIC8qKiBNZXNzYWdlIHRvIGNvbGxlY3QgaW50ZXJhY3Rpb25zIGZyb20gKi9cclxuICBtZXNzYWdlSWQ/OiBzdHJpbmc7XHJcbiAgLyoqIEludGVyYWN0aW9uIHR5cGVzIHRvIGNvbGxlY3QgKi9cclxuICBpbnRlcmFjdGlvblR5cGU/OiBudW1iZXIgfCBudW1iZXJbXTtcclxuICAvKiogQ29tcG9uZW50IHR5cGVzIHRvIGNvbGxlY3QgKi9cclxuICBjb21wb25lbnRUeXBlPzogbnVtYmVyIHwgbnVtYmVyW107XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb2xsZWN0b3IgZm9yIGludGVyYWN0aW9ucyAoYnV0dG9ucywgc2VsZWN0IG1lbnVzLCBldGMuKVxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIEludGVyYWN0aW9uQ29sbGVjdG9yIGV4dGVuZHMgQ29sbGVjdG9yPHN0cmluZywgYW55PiB7XHJcbiAgcHVibGljIHJlYWRvbmx5IGNoYW5uZWxJZD86IHN0cmluZztcclxuICBwdWJsaWMgcmVhZG9ubHkgZ3VpbGRJZD86IHN0cmluZztcclxuICBwdWJsaWMgcmVhZG9ubHkgbWVzc2FnZUlkPzogc3RyaW5nO1xyXG4gIHB1YmxpYyByZWFkb25seSBpbnRlcmFjdGlvblR5cGU/OiBudW1iZXJbXTtcclxuICBwdWJsaWMgcmVhZG9ubHkgY29tcG9uZW50VHlwZT86IG51bWJlcltdO1xyXG4gIHByaXZhdGUgcmVhZG9ubHkgaW50ZXJhY3Rpb25IYW5kbGVyOiAoaW50ZXJhY3Rpb246IGFueSkgPT4gdm9pZDtcclxuXHJcbiAgY29uc3RydWN0b3IoY2xpZW50OiBhbnksIG9wdGlvbnM6IEludGVyYWN0aW9uQ29sbGVjdG9yT3B0aW9ucyA9IHt9KSB7XHJcbiAgICBzdXBlcihjbGllbnQsIG9wdGlvbnMpO1xyXG4gICAgdGhpcy5jaGFubmVsSWQgPSBvcHRpb25zLmNoYW5uZWxJZDtcclxuICAgIHRoaXMuZ3VpbGRJZCA9IG9wdGlvbnMuZ3VpbGRJZDtcclxuICAgIHRoaXMubWVzc2FnZUlkID0gb3B0aW9ucy5tZXNzYWdlSWQ7XHJcbiAgICB0aGlzLmludGVyYWN0aW9uVHlwZSA9IG9wdGlvbnMuaW50ZXJhY3Rpb25UeXBlIFxyXG4gICAgICA/IEFycmF5LmlzQXJyYXkob3B0aW9ucy5pbnRlcmFjdGlvblR5cGUpID8gb3B0aW9ucy5pbnRlcmFjdGlvblR5cGUgOiBbb3B0aW9ucy5pbnRlcmFjdGlvblR5cGVdXHJcbiAgICAgIDogdW5kZWZpbmVkO1xyXG4gICAgdGhpcy5jb21wb25lbnRUeXBlID0gb3B0aW9ucy5jb21wb25lbnRUeXBlXHJcbiAgICAgID8gQXJyYXkuaXNBcnJheShvcHRpb25zLmNvbXBvbmVudFR5cGUpID8gb3B0aW9ucy5jb21wb25lbnRUeXBlIDogW29wdGlvbnMuY29tcG9uZW50VHlwZV1cclxuICAgICAgOiB1bmRlZmluZWQ7XHJcbiAgICBcclxuICAgIHRoaXMuaW50ZXJhY3Rpb25IYW5kbGVyID0gKGludGVyYWN0aW9uOiBhbnkpID0+IHtcclxuICAgICAgLy8gRmlsdGVyIGJ5IGNoYW5uZWxcclxuICAgICAgaWYgKHRoaXMuY2hhbm5lbElkICYmIGludGVyYWN0aW9uLmNoYW5uZWxJZCAhPT0gdGhpcy5jaGFubmVsSWQpIHJldHVybjtcclxuICAgICAgLy8gRmlsdGVyIGJ5IGd1aWxkXHJcbiAgICAgIGlmICh0aGlzLmd1aWxkSWQgJiYgaW50ZXJhY3Rpb24uZ3VpbGRJZCAhPT0gdGhpcy5ndWlsZElkKSByZXR1cm47XHJcbiAgICAgIC8vIEZpbHRlciBieSBtZXNzYWdlXHJcbiAgICAgIGlmICh0aGlzLm1lc3NhZ2VJZCAmJiBpbnRlcmFjdGlvbi5tZXNzYWdlPy5pZCAhPT0gdGhpcy5tZXNzYWdlSWQpIHJldHVybjtcclxuICAgICAgLy8gRmlsdGVyIGJ5IGludGVyYWN0aW9uIHR5cGVcclxuICAgICAgaWYgKHRoaXMuaW50ZXJhY3Rpb25UeXBlICYmICF0aGlzLmludGVyYWN0aW9uVHlwZS5pbmNsdWRlcyhpbnRlcmFjdGlvbi50eXBlKSkgcmV0dXJuO1xyXG4gICAgICAvLyBGaWx0ZXIgYnkgY29tcG9uZW50IHR5cGVcclxuICAgICAgaWYgKHRoaXMuY29tcG9uZW50VHlwZSAmJiBpbnRlcmFjdGlvbi5jb21wb25lbnRUeXBlICYmICF0aGlzLmNvbXBvbmVudFR5cGUuaW5jbHVkZXMoaW50ZXJhY3Rpb24uY29tcG9uZW50VHlwZSkpIHJldHVybjtcclxuICAgICAgXHJcbiAgICAgIHRoaXMuaGFuZGxlQ29sbGVjdChpbnRlcmFjdGlvbik7XHJcbiAgICB9O1xyXG4gICAgXHJcbiAgICBjbGllbnQub24oJ2ludGVyYWN0aW9uQ3JlYXRlJywgdGhpcy5pbnRlcmFjdGlvbkhhbmRsZXIpO1xyXG4gICAgXHJcbiAgICB0aGlzLm9uY2UoJ2VuZCcsICgpID0+IHtcclxuICAgICAgY2xpZW50LnJlbW92ZUxpc3RlbmVyKCdpbnRlcmFjdGlvbkNyZWF0ZScsIHRoaXMuaW50ZXJhY3Rpb25IYW5kbGVyKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgY29sbGVjdChpbnRlcmFjdGlvbjogYW55KTogc3RyaW5nIHwgbnVsbCB7XHJcbiAgICByZXR1cm4gaW50ZXJhY3Rpb24uaWQgPz8gbnVsbDtcclxuICB9XHJcblxyXG4gIGRpc3Bvc2UoaW50ZXJhY3Rpb246IGFueSk6IHN0cmluZyB8IG51bGwge1xyXG4gICAgcmV0dXJuIGludGVyYWN0aW9uLmlkID8/IG51bGw7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogUmVhY3Rpb24gY29sbGVjdG9yIG9wdGlvbnNcclxuICovXHJcbmV4cG9ydCBpbnRlcmZhY2UgUmVhY3Rpb25Db2xsZWN0b3JPcHRpb25zIGV4dGVuZHMgQ29sbGVjdG9yT3B0aW9uczxhbnk+IHtcclxuICAvKiogTWVzc2FnZSB0byBjb2xsZWN0IHJlYWN0aW9ucyBmcm9tICovXHJcbiAgbWVzc2FnZUlkOiBzdHJpbmc7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBDb2xsZWN0b3IgZm9yIHJlYWN0aW9uc1xyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFJlYWN0aW9uQ29sbGVjdG9yIGV4dGVuZHMgQ29sbGVjdG9yPHN0cmluZywgYW55PiB7XHJcbiAgcHVibGljIHJlYWRvbmx5IG1lc3NhZ2VJZDogc3RyaW5nO1xyXG4gIHByaXZhdGUgcmVhZG9ubHkgcmVhY3Rpb25IYW5kbGVyOiAocmVhY3Rpb246IGFueSkgPT4gdm9pZDtcclxuXHJcbiAgY29uc3RydWN0b3IoY2xpZW50OiBhbnksIG1lc3NhZ2VJZDogc3RyaW5nLCBvcHRpb25zOiBSZWFjdGlvbkNvbGxlY3Rvck9wdGlvbnMpIHtcclxuICAgIHN1cGVyKGNsaWVudCwgb3B0aW9ucyk7XHJcbiAgICB0aGlzLm1lc3NhZ2VJZCA9IG1lc3NhZ2VJZDtcclxuICAgIFxyXG4gICAgdGhpcy5yZWFjdGlvbkhhbmRsZXIgPSAocmVhY3Rpb246IGFueSkgPT4ge1xyXG4gICAgICBpZiAocmVhY3Rpb24ubWVzc2FnZV9pZCA9PT0gdGhpcy5tZXNzYWdlSWQgfHwgcmVhY3Rpb24ubWVzc2FnZUlkID09PSB0aGlzLm1lc3NhZ2VJZCkge1xyXG4gICAgICAgIHRoaXMuaGFuZGxlQ29sbGVjdChyZWFjdGlvbik7XHJcbiAgICAgIH1cclxuICAgIH07XHJcbiAgICBcclxuICAgIGNsaWVudC5vbignbWVzc2FnZVJlYWN0aW9uQWRkJywgdGhpcy5yZWFjdGlvbkhhbmRsZXIpO1xyXG4gICAgXHJcbiAgICB0aGlzLm9uY2UoJ2VuZCcsICgpID0+IHtcclxuICAgICAgY2xpZW50LnJlbW92ZUxpc3RlbmVyKCdtZXNzYWdlUmVhY3Rpb25BZGQnLCB0aGlzLnJlYWN0aW9uSGFuZGxlcik7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIGNvbGxlY3QocmVhY3Rpb246IGFueSk6IHN0cmluZyB8IG51bGwge1xyXG4gICAgLy8gS2V5IGlzIGVtb2ppIGlkZW50aWZpZXJcclxuICAgIHJldHVybiByZWFjdGlvbi5lbW9qaT8uaWQgPz8gcmVhY3Rpb24uZW1vamk/Lm5hbWUgPz8gbnVsbDtcclxuICB9XHJcblxyXG4gIGRpc3Bvc2UocmVhY3Rpb246IGFueSk6IHN0cmluZyB8IG51bGwge1xyXG4gICAgcmV0dXJuIHJlYWN0aW9uLmVtb2ppPy5pZCA/PyByZWFjdGlvbi5lbW9qaT8ubmFtZSA/PyBudWxsO1xyXG4gIH1cclxufVxyXG5cclxuLyoqXHJcbiAqIEF3YWl0IG1lc3NhZ2VzIGhlbHBlclxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGF3YWl0TWVzc2FnZXMoXHJcbiAgY2xpZW50OiBhbnksXHJcbiAgY2hhbm5lbElkOiBzdHJpbmcsXHJcbiAgb3B0aW9uczogTWVzc2FnZUNvbGxlY3Rvck9wdGlvbnMgPSB7fVxyXG4pOiBQcm9taXNlPENvbGxlY3Rpb248c3RyaW5nLCBhbnk+PiB7XHJcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgIGNvbnN0IGNvbGxlY3RvciA9IG5ldyBNZXNzYWdlQ29sbGVjdG9yKGNsaWVudCwgY2hhbm5lbElkLCBvcHRpb25zKTtcclxuICAgIFxyXG4gICAgY29sbGVjdG9yLm9uY2UoJ2VuZCcsIChjb2xsZWN0ZWQsIHJlYXNvbikgPT4ge1xyXG4gICAgICBpZiAob3B0aW9ucy5tYXggJiYgY29sbGVjdGVkLnNpemUgPCBvcHRpb25zLm1heCkge1xyXG4gICAgICAgIHJlamVjdChuZXcgRXJyb3IoYENvbGxlY3RvciBlbmRlZCB3aXRoIHJlYXNvbjogJHtyZWFzb259YCkpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHJlc29sdmUoY29sbGVjdGVkKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfSk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBd2FpdCByZWFjdGlvbnMgaGVscGVyXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gYXdhaXRSZWFjdGlvbnMoXHJcbiAgY2xpZW50OiBhbnksXHJcbiAgbWVzc2FnZUlkOiBzdHJpbmcsXHJcbiAgb3B0aW9uczogUmVhY3Rpb25Db2xsZWN0b3JPcHRpb25zXHJcbik6IFByb21pc2U8Q29sbGVjdGlvbjxzdHJpbmcsIGFueT4+IHtcclxuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgY29uc3QgY29sbGVjdG9yID0gbmV3IFJlYWN0aW9uQ29sbGVjdG9yKGNsaWVudCwgbWVzc2FnZUlkLCBvcHRpb25zKTtcclxuICAgIFxyXG4gICAgY29sbGVjdG9yLm9uY2UoJ2VuZCcsIChjb2xsZWN0ZWQsIHJlYXNvbikgPT4ge1xyXG4gICAgICBpZiAob3B0aW9ucy5tYXggJiYgY29sbGVjdGVkLnNpemUgPCBvcHRpb25zLm1heCkge1xyXG4gICAgICAgIHJlamVjdChuZXcgRXJyb3IoYENvbGxlY3RvciBlbmRlZCB3aXRoIHJlYXNvbjogJHtyZWFzb259YCkpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHJlc29sdmUoY29sbGVjdGVkKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfSk7XHJcbn1cclxuXHJcbmV4cG9ydCBkZWZhdWx0IENvbGxlY3RvcjtcclxuIl19