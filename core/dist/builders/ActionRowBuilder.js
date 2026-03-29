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
     * Accepts individual components or an array of components
     */
    addComponents(...components) {
        for (const component of components) {
            if (Array.isArray(component)) {
                this.addComponents(...component);
            }
            else if ('toJSON' in component && typeof component.toJSON === 'function') {
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
     * Accepts individual components or an array of components
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQWN0aW9uUm93QnVpbGRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9idWlsZGVycy9BY3Rpb25Sb3dCdWlsZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7R0FFRzs7O0FBWUg7O0dBRUc7QUFDSCxNQUFhLGdCQUFnQjtJQUNYLElBQUksQ0FBK0I7SUFFbkQsWUFBWSxPQUE4QixFQUFFO1FBQzFDLElBQUksQ0FBQyxJQUFJLEdBQUc7WUFDVixJQUFJLEVBQUUsQ0FBQztZQUNQLFVBQVUsRUFBRyxJQUFJLENBQUMsVUFBa0IsSUFBSSxFQUFFO1NBQzNDLENBQUM7SUFDSixDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsYUFBYSxDQUFDLEdBQUcsVUFBNkQ7UUFDNUUsS0FBSyxNQUFNLFNBQVMsSUFBSSxVQUFVLEVBQUUsQ0FBQztZQUNuQyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQztnQkFDN0IsSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxDQUFDO1lBQ25DLENBQUM7aUJBQU0sSUFBSSxRQUFRLElBQUssU0FBaUIsSUFBSSxPQUFRLFNBQWlCLENBQUMsTUFBTSxLQUFLLFVBQVUsRUFBRSxDQUFDO2dCQUM3RixJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUUsU0FBaUIsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO1lBQ3pELENBQUM7aUJBQU0sQ0FBQztnQkFDTixJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsU0FBYyxDQUFDLENBQUM7WUFDNUMsQ0FBQztRQUNILENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRDs7O09BR0c7SUFDSCxhQUFhLENBQUMsR0FBRyxVQUE2RDtRQUM1RSxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsR0FBRyxFQUFFLENBQUM7UUFDMUIsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsVUFBVSxDQUFDLENBQUM7SUFDM0MsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0gsZ0JBQWdCLENBQUMsS0FBYSxFQUFFLFdBQW1CLEVBQUUsR0FBRyxVQUFtQztRQUN6RixNQUFNLFFBQVEsR0FBRyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQ2xDLFFBQVEsSUFBSSxDQUFDLElBQUksT0FBTyxDQUFDLENBQUMsTUFBTSxLQUFLLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFNLENBQ3RFLENBQUM7UUFDRixJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLFdBQVcsRUFBRSxHQUFHLFFBQVEsQ0FBQyxDQUFDO1FBQzdELE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEOztPQUVHO0lBQ0gsTUFBTTtRQUNKLE9BQU8sRUFBRSxHQUFHLElBQUksQ0FBQyxJQUFJLEVBQWtCLENBQUM7SUFDMUMsQ0FBQztJQUVEOzs7T0FHRztJQUNILE1BQU0sQ0FBQyxJQUFJLENBQWtDLEtBQWtEO1FBQzdGLE9BQU8sSUFBSSxnQkFBZ0IsQ0FBSSxLQUFLLFlBQVksZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ3pGLENBQUM7Q0FDRjtBQWhFRCw0Q0FnRUM7QUFFRCxrQkFBZSxnQkFBZ0IsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQWN0aW9uUm93QnVpbGRlciBmb3IgY3JlYXRpbmcgY29tcG9uZW50IHJvd3NcbiAqL1xuXG5pbXBvcnQgeyBBUElCdXR0b25Db21wb25lbnQgfSBmcm9tICcuL0J1dHRvbkJ1aWxkZXInO1xuaW1wb3J0IHsgQVBJU2VsZWN0TWVudUNvbXBvbmVudCB9IGZyb20gJy4vU2VsZWN0TWVudUJ1aWxkZXInO1xuXG5leHBvcnQgdHlwZSBBUElBY3Rpb25Sb3dDb21wb25lbnQgPSBBUElCdXR0b25Db21wb25lbnQgfCBBUElTZWxlY3RNZW51Q29tcG9uZW50O1xuXG5leHBvcnQgaW50ZXJmYWNlIEFQSUFjdGlvblJvdyB7XG4gIHR5cGU6IDE7XG4gIGNvbXBvbmVudHM6IEFQSUFjdGlvblJvd0NvbXBvbmVudFtdO1xufVxuXG4vKipcbiAqIEEgYnVpbGRlciBmb3IgY3JlYXRpbmcgYWN0aW9uIHJvd3NcbiAqL1xuZXhwb3J0IGNsYXNzIEFjdGlvblJvd0J1aWxkZXI8VCBleHRlbmRzIEFQSUFjdGlvblJvd0NvbXBvbmVudCA9IEFQSUFjdGlvblJvd0NvbXBvbmVudD4ge1xuICBwdWJsaWMgcmVhZG9ubHkgZGF0YTogeyB0eXBlOiAxOyBjb21wb25lbnRzOiBUW10gfTtcblxuICBjb25zdHJ1Y3RvcihkYXRhOiBQYXJ0aWFsPEFQSUFjdGlvblJvdz4gPSB7fSkge1xuICAgIHRoaXMuZGF0YSA9IHsgXG4gICAgICB0eXBlOiAxLCBcbiAgICAgIGNvbXBvbmVudHM6IChkYXRhLmNvbXBvbmVudHMgYXMgVFtdKSB8fCBbXSBcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZHMgY29tcG9uZW50cyB0byB0aGlzIGFjdGlvbiByb3dcbiAgICogQWNjZXB0cyBpbmRpdmlkdWFsIGNvbXBvbmVudHMgb3IgYW4gYXJyYXkgb2YgY29tcG9uZW50c1xuICAgKi9cbiAgYWRkQ29tcG9uZW50cyguLi5jb21wb25lbnRzOiAoVCB8IHsgdG9KU09OKCk6IFQgfSB8IChUIHwgeyB0b0pTT04oKTogVCB9KVtdKVtdKTogdGhpcyB7XG4gICAgZm9yIChjb25zdCBjb21wb25lbnQgb2YgY29tcG9uZW50cykge1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoY29tcG9uZW50KSkge1xuICAgICAgICB0aGlzLmFkZENvbXBvbmVudHMoLi4uY29tcG9uZW50KTtcbiAgICAgIH0gZWxzZSBpZiAoJ3RvSlNPTicgaW4gKGNvbXBvbmVudCBhcyBhbnkpICYmIHR5cGVvZiAoY29tcG9uZW50IGFzIGFueSkudG9KU09OID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHRoaXMuZGF0YS5jb21wb25lbnRzLnB1c2goKGNvbXBvbmVudCBhcyBhbnkpLnRvSlNPTigpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZGF0YS5jb21wb25lbnRzLnB1c2goY29tcG9uZW50IGFzIFQpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSBjb21wb25lbnRzIG9mIHRoaXMgYWN0aW9uIHJvd1xuICAgKiBBY2NlcHRzIGluZGl2aWR1YWwgY29tcG9uZW50cyBvciBhbiBhcnJheSBvZiBjb21wb25lbnRzXG4gICAqL1xuICBzZXRDb21wb25lbnRzKC4uLmNvbXBvbmVudHM6IChUIHwgeyB0b0pTT04oKTogVCB9IHwgKFQgfCB7IHRvSlNPTigpOiBUIH0pW10pW10pOiB0aGlzIHtcbiAgICB0aGlzLmRhdGEuY29tcG9uZW50cyA9IFtdO1xuICAgIHJldHVybiB0aGlzLmFkZENvbXBvbmVudHMoLi4uY29tcG9uZW50cyk7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlcywgcmVwbGFjZXMsIG9yIGluc2VydHMgY29tcG9uZW50c1xuICAgKiBAcGFyYW0gaW5kZXggVGhlIGluZGV4IHRvIHN0YXJ0IGF0XG4gICAqIEBwYXJhbSBkZWxldGVDb3VudCBUaGUgbnVtYmVyIG9mIGNvbXBvbmVudHMgdG8gcmVtb3ZlXG4gICAqIEBwYXJhbSBjb21wb25lbnRzIFRoZSBjb21wb25lbnRzIHRvIGluc2VydFxuICAgKi9cbiAgc3BsaWNlQ29tcG9uZW50cyhpbmRleDogbnVtYmVyLCBkZWxldGVDb3VudDogbnVtYmVyLCAuLi5jb21wb25lbnRzOiAoVCB8IHsgdG9KU09OKCk6IFQgfSlbXSk6IHRoaXMge1xuICAgIGNvbnN0IHJlc29sdmVkID0gY29tcG9uZW50cy5tYXAoYyA9PiBcbiAgICAgICd0b0pTT04nIGluIGMgJiYgdHlwZW9mIGMudG9KU09OID09PSAnZnVuY3Rpb24nID8gYy50b0pTT04oKSA6IGMgYXMgVFxuICAgICk7XG4gICAgdGhpcy5kYXRhLmNvbXBvbmVudHMuc3BsaWNlKGluZGV4LCBkZWxldGVDb3VudCwgLi4ucmVzb2x2ZWQpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIEpTT04gcmVwcmVzZW50YXRpb24gb2YgdGhpcyBhY3Rpb24gcm93XG4gICAqL1xuICB0b0pTT04oKTogQVBJQWN0aW9uUm93IHtcbiAgICByZXR1cm4geyAuLi50aGlzLmRhdGEgfSBhcyBBUElBY3Rpb25Sb3c7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBhY3Rpb24gcm93IGJ1aWxkZXIgZnJvbSBleGlzdGluZyBkYXRhXG4gICAqIEBwYXJhbSBvdGhlciBUaGUgYWN0aW9uIHJvdyBkYXRhIHRvIGNvcHlcbiAgICovXG4gIHN0YXRpYyBmcm9tPFQgZXh0ZW5kcyBBUElBY3Rpb25Sb3dDb21wb25lbnQ+KG90aGVyOiBQYXJ0aWFsPEFQSUFjdGlvblJvdz4gfCBBY3Rpb25Sb3dCdWlsZGVyPFQ+KTogQWN0aW9uUm93QnVpbGRlcjxUPiB7XG4gICAgcmV0dXJuIG5ldyBBY3Rpb25Sb3dCdWlsZGVyPFQ+KG90aGVyIGluc3RhbmNlb2YgQWN0aW9uUm93QnVpbGRlciA/IG90aGVyLmRhdGEgOiBvdGhlcik7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQWN0aW9uUm93QnVpbGRlcjtcbiJdfQ==