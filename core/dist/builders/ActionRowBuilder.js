"use strict";
/**
 * ActionRowBuilder for creating component rows
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionRowBuilder = void 0;
/**
 * A builder for creating action rows
 */
class ActionRowBuilder {
    data;
    constructor(data = {}) {
        this.data = {
            type: 1,
            components: data.components || []
        };
    }
    /**
     * Adds components to this action row
     * @param components The components to add
     */
    addComponents(...components) {
        for (const component of components) {
            if ('toJSON' in component && typeof component.toJSON === 'function') {
                this.data.components.push(component.toJSON());
            }
            else {
                this.data.components.push(component);
            }
        }
        return this;
    }
    /**
     * Sets the components of this action row
     * @param components The components to set
     */
    setComponents(...components) {
        this.data.components = [];
        return this.addComponents(...components);
    }
    /**
     * Removes, replaces, or inserts components
     * @param index The index to start at
     * @param deleteCount The number of components to remove
     * @param components The components to insert
     */
    spliceComponents(index, deleteCount, ...components) {
        const resolved = components.map(c => 'toJSON' in c && typeof c.toJSON === 'function' ? c.toJSON() : c);
        this.data.components.splice(index, deleteCount, ...resolved);
        return this;
    }
    /**
     * Returns the JSON representation of this action row
     */
    toJSON() {
        return { ...this.data };
    }
    /**
     * Creates a new action row builder from existing data
     * @param other The action row data to copy
     */
    static from(other) {
        return new ActionRowBuilder(other instanceof ActionRowBuilder ? other.data : other);
    }
}
exports.ActionRowBuilder = ActionRowBuilder;
exports.default = ActionRowBuilder;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQWN0aW9uUm93QnVpbGRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9idWlsZGVycy9BY3Rpb25Sb3dCdWlsZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7R0FFRzs7O0FBWUg7O0dBRUc7QUFDSCxNQUFhLGdCQUFnQjtJQUNYLElBQUksQ0FBK0I7SUFFbkQsWUFBWSxPQUE4QixFQUFFO1FBQzFDLElBQUksQ0FBQyxJQUFJLEdBQUc7WUFDVixJQUFJLEVBQUUsQ0FBQztZQUNQLFVBQVUsRUFBRyxJQUFJLENBQUMsVUFBa0IsSUFBSSxFQUFFO1NBQzNDLENBQUM7SUFDSixDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsYUFBYSxDQUFDLEdBQUcsVUFBbUM7UUFDbEQsS0FBSyxNQUFNLFNBQVMsSUFBSSxVQUFVLEVBQUUsQ0FBQztZQUNuQyxJQUFJLFFBQVEsSUFBSSxTQUFTLElBQUksT0FBTyxTQUFTLENBQUMsTUFBTSxLQUFLLFVBQVUsRUFBRSxDQUFDO2dCQUNwRSxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7WUFDaEQsQ0FBQztpQkFBTSxDQUFDO2dCQUNOLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxTQUFjLENBQUMsQ0FBQztZQUM1QyxDQUFDO1FBQ0gsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEOzs7T0FHRztJQUNILGFBQWEsQ0FBQyxHQUFHLFVBQW1DO1FBQ2xELElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxHQUFHLEVBQUUsQ0FBQztRQUMxQixPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxVQUFVLENBQUMsQ0FBQztJQUMzQyxDQUFDO0lBRUQ7Ozs7O09BS0c7SUFDSCxnQkFBZ0IsQ0FBQyxLQUFhLEVBQUUsV0FBbUIsRUFBRSxHQUFHLFVBQW1DO1FBQ3pGLE1BQU0sUUFBUSxHQUFHLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FDbEMsUUFBUSxJQUFJLENBQUMsSUFBSSxPQUFPLENBQUMsQ0FBQyxNQUFNLEtBQUssVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQU0sQ0FDdEUsQ0FBQztRQUNGLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsV0FBVyxFQUFFLEdBQUcsUUFBUSxDQUFDLENBQUM7UUFDN0QsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxNQUFNO1FBQ0osT0FBTyxFQUFFLEdBQUcsSUFBSSxDQUFDLElBQUksRUFBa0IsQ0FBQztJQUMxQyxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsTUFBTSxDQUFDLElBQUksQ0FBa0MsS0FBa0Q7UUFDN0YsT0FBTyxJQUFJLGdCQUFnQixDQUFJLEtBQUssWUFBWSxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDekYsQ0FBQztDQUNGO0FBOURELDRDQThEQztBQUVELGtCQUFlLGdCQUFnQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBBY3Rpb25Sb3dCdWlsZGVyIGZvciBjcmVhdGluZyBjb21wb25lbnQgcm93c1xuICovXG5cbmltcG9ydCB7IEFQSUJ1dHRvbkNvbXBvbmVudCB9IGZyb20gJy4vQnV0dG9uQnVpbGRlcic7XG5pbXBvcnQgeyBBUElTZWxlY3RNZW51Q29tcG9uZW50IH0gZnJvbSAnLi9TZWxlY3RNZW51QnVpbGRlcic7XG5cbmV4cG9ydCB0eXBlIEFQSUFjdGlvblJvd0NvbXBvbmVudCA9IEFQSUJ1dHRvbkNvbXBvbmVudCB8IEFQSVNlbGVjdE1lbnVDb21wb25lbnQ7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQVBJQWN0aW9uUm93IHtcbiAgdHlwZTogMTtcbiAgY29tcG9uZW50czogQVBJQWN0aW9uUm93Q29tcG9uZW50W107XG59XG5cbi8qKlxuICogQSBidWlsZGVyIGZvciBjcmVhdGluZyBhY3Rpb24gcm93c1xuICovXG5leHBvcnQgY2xhc3MgQWN0aW9uUm93QnVpbGRlcjxUIGV4dGVuZHMgQVBJQWN0aW9uUm93Q29tcG9uZW50ID0gQVBJQWN0aW9uUm93Q29tcG9uZW50PiB7XG4gIHB1YmxpYyByZWFkb25seSBkYXRhOiB7IHR5cGU6IDE7IGNvbXBvbmVudHM6IFRbXSB9O1xuXG4gIGNvbnN0cnVjdG9yKGRhdGE6IFBhcnRpYWw8QVBJQWN0aW9uUm93PiA9IHt9KSB7XG4gICAgdGhpcy5kYXRhID0geyBcbiAgICAgIHR5cGU6IDEsIFxuICAgICAgY29tcG9uZW50czogKGRhdGEuY29tcG9uZW50cyBhcyBUW10pIHx8IFtdIFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogQWRkcyBjb21wb25lbnRzIHRvIHRoaXMgYWN0aW9uIHJvd1xuICAgKiBAcGFyYW0gY29tcG9uZW50cyBUaGUgY29tcG9uZW50cyB0byBhZGRcbiAgICovXG4gIGFkZENvbXBvbmVudHMoLi4uY29tcG9uZW50czogKFQgfCB7IHRvSlNPTigpOiBUIH0pW10pOiB0aGlzIHtcbiAgICBmb3IgKGNvbnN0IGNvbXBvbmVudCBvZiBjb21wb25lbnRzKSB7XG4gICAgICBpZiAoJ3RvSlNPTicgaW4gY29tcG9uZW50ICYmIHR5cGVvZiBjb21wb25lbnQudG9KU09OID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHRoaXMuZGF0YS5jb21wb25lbnRzLnB1c2goY29tcG9uZW50LnRvSlNPTigpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZGF0YS5jb21wb25lbnRzLnB1c2goY29tcG9uZW50IGFzIFQpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSBjb21wb25lbnRzIG9mIHRoaXMgYWN0aW9uIHJvd1xuICAgKiBAcGFyYW0gY29tcG9uZW50cyBUaGUgY29tcG9uZW50cyB0byBzZXRcbiAgICovXG4gIHNldENvbXBvbmVudHMoLi4uY29tcG9uZW50czogKFQgfCB7IHRvSlNPTigpOiBUIH0pW10pOiB0aGlzIHtcbiAgICB0aGlzLmRhdGEuY29tcG9uZW50cyA9IFtdO1xuICAgIHJldHVybiB0aGlzLmFkZENvbXBvbmVudHMoLi4uY29tcG9uZW50cyk7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlcywgcmVwbGFjZXMsIG9yIGluc2VydHMgY29tcG9uZW50c1xuICAgKiBAcGFyYW0gaW5kZXggVGhlIGluZGV4IHRvIHN0YXJ0IGF0XG4gICAqIEBwYXJhbSBkZWxldGVDb3VudCBUaGUgbnVtYmVyIG9mIGNvbXBvbmVudHMgdG8gcmVtb3ZlXG4gICAqIEBwYXJhbSBjb21wb25lbnRzIFRoZSBjb21wb25lbnRzIHRvIGluc2VydFxuICAgKi9cbiAgc3BsaWNlQ29tcG9uZW50cyhpbmRleDogbnVtYmVyLCBkZWxldGVDb3VudDogbnVtYmVyLCAuLi5jb21wb25lbnRzOiAoVCB8IHsgdG9KU09OKCk6IFQgfSlbXSk6IHRoaXMge1xuICAgIGNvbnN0IHJlc29sdmVkID0gY29tcG9uZW50cy5tYXAoYyA9PiBcbiAgICAgICd0b0pTT04nIGluIGMgJiYgdHlwZW9mIGMudG9KU09OID09PSAnZnVuY3Rpb24nID8gYy50b0pTT04oKSA6IGMgYXMgVFxuICAgICk7XG4gICAgdGhpcy5kYXRhLmNvbXBvbmVudHMuc3BsaWNlKGluZGV4LCBkZWxldGVDb3VudCwgLi4ucmVzb2x2ZWQpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIEpTT04gcmVwcmVzZW50YXRpb24gb2YgdGhpcyBhY3Rpb24gcm93XG4gICAqL1xuICB0b0pTT04oKTogQVBJQWN0aW9uUm93IHtcbiAgICByZXR1cm4geyAuLi50aGlzLmRhdGEgfSBhcyBBUElBY3Rpb25Sb3c7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBhY3Rpb24gcm93IGJ1aWxkZXIgZnJvbSBleGlzdGluZyBkYXRhXG4gICAqIEBwYXJhbSBvdGhlciBUaGUgYWN0aW9uIHJvdyBkYXRhIHRvIGNvcHlcbiAgICovXG4gIHN0YXRpYyBmcm9tPFQgZXh0ZW5kcyBBUElBY3Rpb25Sb3dDb21wb25lbnQ+KG90aGVyOiBQYXJ0aWFsPEFQSUFjdGlvblJvdz4gfCBBY3Rpb25Sb3dCdWlsZGVyPFQ+KTogQWN0aW9uUm93QnVpbGRlcjxUPiB7XG4gICAgcmV0dXJuIG5ldyBBY3Rpb25Sb3dCdWlsZGVyPFQ+KG90aGVyIGluc3RhbmNlb2YgQWN0aW9uUm93QnVpbGRlciA/IG90aGVyLmRhdGEgOiBvdGhlcik7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQWN0aW9uUm93QnVpbGRlcjtcbiJdfQ==