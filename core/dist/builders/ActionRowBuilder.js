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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQWN0aW9uUm93QnVpbGRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9idWlsZGVycy9BY3Rpb25Sb3dCdWlsZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7R0FFRzs7O0FBWUg7O0dBRUc7QUFDSCxNQUFhLGdCQUFnQjtJQUNYLElBQUksQ0FBK0I7SUFFbkQsWUFBWSxPQUE4QixFQUFFO1FBQzFDLElBQUksQ0FBQyxJQUFJLEdBQUc7WUFDVixJQUFJLEVBQUUsQ0FBQztZQUNQLFVBQVUsRUFBRyxJQUFJLENBQUMsVUFBa0IsSUFBSSxFQUFFO1NBQzNDLENBQUM7SUFDSixDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsYUFBYSxDQUFDLEdBQUcsVUFBbUM7UUFDbEQsS0FBSyxNQUFNLFNBQVMsSUFBSSxVQUFVLEVBQUUsQ0FBQztZQUNuQyxJQUFJLFFBQVEsSUFBSSxTQUFTLElBQUksT0FBTyxTQUFTLENBQUMsTUFBTSxLQUFLLFVBQVUsRUFBRSxDQUFDO2dCQUNwRSxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7WUFDaEQsQ0FBQztpQkFBTSxDQUFDO2dCQUNOLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxTQUFjLENBQUMsQ0FBQztZQUM1QyxDQUFDO1FBQ0gsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEOzs7T0FHRztJQUNILGFBQWEsQ0FBQyxHQUFHLFVBQW1DO1FBQ2xELElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxHQUFHLEVBQUUsQ0FBQztRQUMxQixPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxVQUFVLENBQUMsQ0FBQztJQUMzQyxDQUFDO0lBRUQ7Ozs7O09BS0c7SUFDSCxnQkFBZ0IsQ0FBQyxLQUFhLEVBQUUsV0FBbUIsRUFBRSxHQUFHLFVBQW1DO1FBQ3pGLE1BQU0sUUFBUSxHQUFHLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FDbEMsUUFBUSxJQUFJLENBQUMsSUFBSSxPQUFPLENBQUMsQ0FBQyxNQUFNLEtBQUssVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQU0sQ0FDdEUsQ0FBQztRQUNGLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsV0FBVyxFQUFFLEdBQUcsUUFBUSxDQUFDLENBQUM7UUFDN0QsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxNQUFNO1FBQ0osT0FBTyxFQUFFLEdBQUcsSUFBSSxDQUFDLElBQUksRUFBa0IsQ0FBQztJQUMxQyxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsTUFBTSxDQUFDLElBQUksQ0FBa0MsS0FBa0Q7UUFDN0YsT0FBTyxJQUFJLGdCQUFnQixDQUFJLEtBQUssWUFBWSxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDekYsQ0FBQztDQUNGO0FBOURELDRDQThEQztBQUVELGtCQUFlLGdCQUFnQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIEFjdGlvblJvd0J1aWxkZXIgZm9yIGNyZWF0aW5nIGNvbXBvbmVudCByb3dzXHJcbiAqL1xyXG5cclxuaW1wb3J0IHsgQVBJQnV0dG9uQ29tcG9uZW50IH0gZnJvbSAnLi9CdXR0b25CdWlsZGVyJztcclxuaW1wb3J0IHsgQVBJU2VsZWN0TWVudUNvbXBvbmVudCB9IGZyb20gJy4vU2VsZWN0TWVudUJ1aWxkZXInO1xyXG5cclxuZXhwb3J0IHR5cGUgQVBJQWN0aW9uUm93Q29tcG9uZW50ID0gQVBJQnV0dG9uQ29tcG9uZW50IHwgQVBJU2VsZWN0TWVudUNvbXBvbmVudDtcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgQVBJQWN0aW9uUm93IHtcclxuICB0eXBlOiAxO1xyXG4gIGNvbXBvbmVudHM6IEFQSUFjdGlvblJvd0NvbXBvbmVudFtdO1xyXG59XHJcblxyXG4vKipcclxuICogQSBidWlsZGVyIGZvciBjcmVhdGluZyBhY3Rpb24gcm93c1xyXG4gKi9cclxuZXhwb3J0IGNsYXNzIEFjdGlvblJvd0J1aWxkZXI8VCBleHRlbmRzIEFQSUFjdGlvblJvd0NvbXBvbmVudCA9IEFQSUFjdGlvblJvd0NvbXBvbmVudD4ge1xyXG4gIHB1YmxpYyByZWFkb25seSBkYXRhOiB7IHR5cGU6IDE7IGNvbXBvbmVudHM6IFRbXSB9O1xyXG5cclxuICBjb25zdHJ1Y3RvcihkYXRhOiBQYXJ0aWFsPEFQSUFjdGlvblJvdz4gPSB7fSkge1xyXG4gICAgdGhpcy5kYXRhID0geyBcclxuICAgICAgdHlwZTogMSwgXHJcbiAgICAgIGNvbXBvbmVudHM6IChkYXRhLmNvbXBvbmVudHMgYXMgVFtdKSB8fCBbXSBcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBZGRzIGNvbXBvbmVudHMgdG8gdGhpcyBhY3Rpb24gcm93XHJcbiAgICogQHBhcmFtIGNvbXBvbmVudHMgVGhlIGNvbXBvbmVudHMgdG8gYWRkXHJcbiAgICovXHJcbiAgYWRkQ29tcG9uZW50cyguLi5jb21wb25lbnRzOiAoVCB8IHsgdG9KU09OKCk6IFQgfSlbXSk6IHRoaXMge1xyXG4gICAgZm9yIChjb25zdCBjb21wb25lbnQgb2YgY29tcG9uZW50cykge1xyXG4gICAgICBpZiAoJ3RvSlNPTicgaW4gY29tcG9uZW50ICYmIHR5cGVvZiBjb21wb25lbnQudG9KU09OID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgdGhpcy5kYXRhLmNvbXBvbmVudHMucHVzaChjb21wb25lbnQudG9KU09OKCkpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHRoaXMuZGF0YS5jb21wb25lbnRzLnB1c2goY29tcG9uZW50IGFzIFQpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldHMgdGhlIGNvbXBvbmVudHMgb2YgdGhpcyBhY3Rpb24gcm93XHJcbiAgICogQHBhcmFtIGNvbXBvbmVudHMgVGhlIGNvbXBvbmVudHMgdG8gc2V0XHJcbiAgICovXHJcbiAgc2V0Q29tcG9uZW50cyguLi5jb21wb25lbnRzOiAoVCB8IHsgdG9KU09OKCk6IFQgfSlbXSk6IHRoaXMge1xyXG4gICAgdGhpcy5kYXRhLmNvbXBvbmVudHMgPSBbXTtcclxuICAgIHJldHVybiB0aGlzLmFkZENvbXBvbmVudHMoLi4uY29tcG9uZW50cyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZW1vdmVzLCByZXBsYWNlcywgb3IgaW5zZXJ0cyBjb21wb25lbnRzXHJcbiAgICogQHBhcmFtIGluZGV4IFRoZSBpbmRleCB0byBzdGFydCBhdFxyXG4gICAqIEBwYXJhbSBkZWxldGVDb3VudCBUaGUgbnVtYmVyIG9mIGNvbXBvbmVudHMgdG8gcmVtb3ZlXHJcbiAgICogQHBhcmFtIGNvbXBvbmVudHMgVGhlIGNvbXBvbmVudHMgdG8gaW5zZXJ0XHJcbiAgICovXHJcbiAgc3BsaWNlQ29tcG9uZW50cyhpbmRleDogbnVtYmVyLCBkZWxldGVDb3VudDogbnVtYmVyLCAuLi5jb21wb25lbnRzOiAoVCB8IHsgdG9KU09OKCk6IFQgfSlbXSk6IHRoaXMge1xyXG4gICAgY29uc3QgcmVzb2x2ZWQgPSBjb21wb25lbnRzLm1hcChjID0+IFxyXG4gICAgICAndG9KU09OJyBpbiBjICYmIHR5cGVvZiBjLnRvSlNPTiA9PT0gJ2Z1bmN0aW9uJyA/IGMudG9KU09OKCkgOiBjIGFzIFRcclxuICAgICk7XHJcbiAgICB0aGlzLmRhdGEuY29tcG9uZW50cy5zcGxpY2UoaW5kZXgsIGRlbGV0ZUNvdW50LCAuLi5yZXNvbHZlZCk7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJldHVybnMgdGhlIEpTT04gcmVwcmVzZW50YXRpb24gb2YgdGhpcyBhY3Rpb24gcm93XHJcbiAgICovXHJcbiAgdG9KU09OKCk6IEFQSUFjdGlvblJvdyB7XHJcbiAgICByZXR1cm4geyAuLi50aGlzLmRhdGEgfSBhcyBBUElBY3Rpb25Sb3c7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGVzIGEgbmV3IGFjdGlvbiByb3cgYnVpbGRlciBmcm9tIGV4aXN0aW5nIGRhdGFcclxuICAgKiBAcGFyYW0gb3RoZXIgVGhlIGFjdGlvbiByb3cgZGF0YSB0byBjb3B5XHJcbiAgICovXHJcbiAgc3RhdGljIGZyb208VCBleHRlbmRzIEFQSUFjdGlvblJvd0NvbXBvbmVudD4ob3RoZXI6IFBhcnRpYWw8QVBJQWN0aW9uUm93PiB8IEFjdGlvblJvd0J1aWxkZXI8VD4pOiBBY3Rpb25Sb3dCdWlsZGVyPFQ+IHtcclxuICAgIHJldHVybiBuZXcgQWN0aW9uUm93QnVpbGRlcjxUPihvdGhlciBpbnN0YW5jZW9mIEFjdGlvblJvd0J1aWxkZXIgPyBvdGhlci5kYXRhIDogb3RoZXIpO1xyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgQWN0aW9uUm93QnVpbGRlcjtcclxuIl19