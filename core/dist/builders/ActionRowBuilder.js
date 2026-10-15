"use strict";
/**
 * ActionRowBuilder for creating component rows
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionRowBuilder = void 0;
/** Component type constants */
const COMPONENT_TYPE = {
    BUTTON: 2,
    STRING_SELECT: 3,
    TEXT_INPUT: 4,
    USER_SELECT: 5,
    ROLE_SELECT: 6,
    MENTIONABLE_SELECT: 7,
    CHANNEL_SELECT: 8,
};
/** Check if a component type is a select menu */
function isSelectMenu(type) {
    return type >= COMPONENT_TYPE.STRING_SELECT && type !== COMPONENT_TYPE.TEXT_INPUT;
}
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
     * Get the existing component type in the row (button vs select menu)
     * @returns 'button' | 'select' | null
     */
    _getExistingComponentCategory() {
        if (this.data.components.length === 0)
            return null;
        const firstType = this.data.components[0].type;
        if (firstType === COMPONENT_TYPE.BUTTON)
            return 'button';
        if (isSelectMenu(firstType))
            return 'select';
        return null;
    }
    /**
     * Validate that a component is compatible with existing components in the row
     * @throws {Error} if component type is incompatible
     */
    _validateComponentType(component) {
        const existingCategory = this._getExistingComponentCategory();
        if (existingCategory === null)
            return;
        const componentType = component.type;
        const componentCategory = componentType === COMPONENT_TYPE.BUTTON ? 'button' :
            isSelectMenu(componentType) ? 'select' : null;
        if (componentCategory && componentCategory !== existingCategory) {
            throw new Error(`Cannot mix ${existingCategory}s and ${componentCategory === 'select' ? 'select menus' : 'buttons'} in the same action row. ` +
                `This row already contains ${existingCategory}s.`);
        }
    }
    /**
     * Adds components to this action row
     * Accepts individual components or an array of components
     * @throws {Error} if component types are incompatible (buttons cannot mix with select menus)
     */
    addComponents(...components) {
        for (const component of components) {
            if (Array.isArray(component)) {
                this.addComponents(...component);
            }
            else if ('toJSON' in component && typeof component.toJSON === 'function') {
                const resolved = component.toJSON();
                this._validateComponentType(resolved);
                this.data.components.push(resolved);
            }
            else {
                this._validateComponentType(component);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQWN0aW9uUm93QnVpbGRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9idWlsZGVycy9BY3Rpb25Sb3dCdWlsZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7R0FFRzs7O0FBWUgsK0JBQStCO0FBQy9CLE1BQU0sY0FBYyxHQUFHO0lBQ3JCLE1BQU0sRUFBRSxDQUFDO0lBQ1QsYUFBYSxFQUFFLENBQUM7SUFDaEIsVUFBVSxFQUFFLENBQUM7SUFDYixXQUFXLEVBQUUsQ0FBQztJQUNkLFdBQVcsRUFBRSxDQUFDO0lBQ2Qsa0JBQWtCLEVBQUUsQ0FBQztJQUNyQixjQUFjLEVBQUUsQ0FBQztDQUNULENBQUM7QUFFWCxpREFBaUQ7QUFDakQsU0FBUyxZQUFZLENBQUMsSUFBWTtJQUNoQyxPQUFPLElBQUksSUFBSSxjQUFjLENBQUMsYUFBYSxJQUFJLElBQUksS0FBSyxjQUFjLENBQUMsVUFBVSxDQUFDO0FBQ3BGLENBQUM7QUFFRDs7R0FFRztBQUNILE1BQWEsZ0JBQWdCO0lBQ1gsSUFBSSxDQUErQjtJQUVuRCxZQUFZLE9BQThCLEVBQUU7UUFDMUMsSUFBSSxDQUFDLElBQUksR0FBRztZQUNWLElBQUksRUFBRSxDQUFDO1lBQ1AsVUFBVSxFQUFHLElBQUksQ0FBQyxVQUFrQixJQUFJLEVBQUU7U0FDM0MsQ0FBQztJQUNKLENBQUM7SUFFRDs7O09BR0c7SUFDSyw2QkFBNkI7UUFDbkMsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLEtBQUssQ0FBQztZQUFFLE9BQU8sSUFBSSxDQUFDO1FBQ25ELE1BQU0sU0FBUyxHQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBUyxDQUFDLElBQUksQ0FBQztRQUN4RCxJQUFJLFNBQVMsS0FBSyxjQUFjLENBQUMsTUFBTTtZQUFFLE9BQU8sUUFBUSxDQUFDO1FBQ3pELElBQUksWUFBWSxDQUFDLFNBQVMsQ0FBQztZQUFFLE9B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TyxJQUFJLGdCQUFnQixDQUFJLEtBQUssWUFBWSxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDekYsQ0FBQztDQUNGO0FBcEdELDRDQW9HQztBQUVELGtCQUFlLGdCQUFnQixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIEFjdGlvblJvd0J1aWxkZXIgZm9yIGNyZWF0aW5nIGNvbXBvbmVudCByb3dzXHJcbiAqL1xyXG5cclxuaW1wb3J0IHsgQVBJQnV0dG9uQ29tcG9uZW50IH0gZnJvbSAnLi9CdXR0b25CdWlsZGVyJztcclxuaW1wb3J0IHsgQVBJU2VsZWN0TWVudUNvbXBvbmVudCB9IGZyb20gJy4vU2VsZWN0TWVudUJ1aWxkZXInO1xyXG5cclxuZXhwb3J0IHR5cGUgQVBJQWN0aW9uUm93Q29tcG9uZW50ID0gQVBJQnV0dG9uQ29tcG9uZW50IHwgQVBJU2VsZWN0TWVudUNvbXBvbmVudDtcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgQVBJQWN0aW9uUm93IHtcclxuICB0eXBlOiAxO1xyXG4gIGNvbXBvbmVudHM6IEFQSUFjdGlvblJvd0NvbXBvbmVudFtdO1xyXG59XHJcblxyXG4vKiogQ29tcG9uZW50IHR5cGUgY29uc3RhbnRzICovXHJcbmNvbnN0IENPTVBPTkVOVF9UWVBFID0ge1xyXG4gIEJVVFRPTjogMixcclxuICBTVFJJTkdfU0VMRUNUOiAzLFxyXG4gIFRFWFRfSU5QVVQ6IDQsXHJcbiAgVVNFUl9TRUxFQ1Q6IDUsXHJcbiAgUk9MRV9TRUxFQ1Q6IDYsXHJcbiAgTUVOVElPTkFCTEVfU0VMRUNUOiA3LFxyXG4gIENIQU5ORUxfU0VMRUNUOiA4LFxyXG59IGFzIGNvbnN0O1xyXG5cclxuLyoqIENoZWNrIGlmIGEgY29tcG9uZW50IHR5cGUgaXMgYSBzZWxlY3QgbWVudSAqL1xyXG5mdW5jdGlvbiBpc1NlbGVjdE1lbnUodHlwZTogbnVtYmVyKTogYm9vbGVhbiB7XHJcbiAgcmV0dXJuIHR5cGUgPj0gQ09NUE9ORU5UX1RZUEUuU1RSSU5HX1NFTEVDVCAmJiB0eXBlICE9PSBDT01QT05FTlRfVFlQRS5URVhUX0lOUFVUO1xyXG59XHJcblxyXG4vKipcclxuICogQSBidWlsZGVyIGZvciBjcmVhdGluZyBhY3Rpb24gcm93c1xyXG4gKi9cclxuZXhwb3J0IGNsYXNzIEFjdGlvblJvd0J1aWxkZXI8VCBleHRlbmRzIEFQSUFjdGlvblJvd0NvbXBvbmVudCA9IEFQSUFjdGlvblJvd0NvbXBvbmVudD4ge1xyXG4gIHB1YmxpYyByZWFkb25seSBkYXRhOiB7IHR5cGU6IDE7IGNvbXBvbmVudHM6IFRbXSB9O1xyXG5cclxuICBjb25zdHJ1Y3RvcihkYXRhOiBQYXJ0aWFsPEFQSUFjdGlvblJvdz4gPSB7fSkge1xyXG4gICAgdGhpcy5kYXRhID0geyBcclxuICAgICAgdHlwZTogMSwgXHJcbiAgICAgIGNvbXBvbmVudHM6IChkYXRhLmNvbXBvbmVudHMgYXMgVFtdKSB8fCBbXSBcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgdGhlIGV4aXN0aW5nIGNvbXBvbmVudCB0eXBlIGluIHRoZSByb3cgKGJ1dHRvbiB2cyBzZWxlY3QgbWVudSlcclxuICAgKiBAcmV0dXJucyAnYnV0dG9uJyB8ICdzZWxlY3QnIHwgbnVsbFxyXG4gICAqL1xyXG4gIHByaXZhdGUgX2dldEV4aXN0aW5nQ29tcG9uZW50Q2F0ZWdvcnkoKTogJ2J1dHRvbicgfCAnc2VsZWN0JyB8IG51bGwge1xyXG4gICAgaWYgKHRoaXMuZGF0YS5jb21wb25lbnRzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIG51bGw7XHJcbiAgICBjb25zdCBmaXJzdFR5cGUgPSAodGhpcy5kYXRhLmNvbXBvbmVudHNbMF0gYXMgYW55KS50eXBlO1xyXG4gICAgaWYgKGZpcnN0VHlwZSA9PT0gQ09NUE9ORU5UX1RZUEUuQlVUVE9OKSByZXR1cm4gJ2J1dHRvbic7XHJcbiAgICBpZiAoaXNTZWxlY3RNZW51KGZpcnN0VHlwZSkpIHJldHVybiAnc2VsZWN0JztcclxuICAgIHJldHVybiBudWxsO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVmFsaWRhdGUgdGhhdCBhIGNvbXBvbmVudCBpcyBjb21wYXRpYmxlIHdpdGggZXhpc3RpbmcgY29tcG9uZW50cyBpbiB0aGUgcm93XHJcbiAgICogQHRocm93cyB7RXJyb3J9IGlmIGNvbXBvbmVudCB0eXBlIGlzIGluY29tcGF0aWJsZVxyXG4gICAqL1xyXG4gIHByaXZhdGUgX3ZhbGlkYXRlQ29tcG9uZW50VHlwZShjb21wb25lbnQ6IGFueSk6IHZvaWQge1xyXG4gICAgY29uc3QgZXhpc3RpbmdDYXRlZ29yeSA9IHRoaXMuX2dldEV4aXN0aW5nQ29tcG9uZW50Q2F0ZWdvcnkoKTtcclxuICAgIGlmIChleGlzdGluZ0NhdGVnb3J5ID09PSBudWxsKSByZXR1cm47XHJcblxyXG4gICAgY29uc3QgY29tcG9uZW50VHlwZSA9IGNvbXBvbmVudC50eXBlO1xyXG4gICAgY29uc3QgY29tcG9uZW50Q2F0ZWdvcnkgPSBjb21wb25lbnRUeXBlID09PSBDT01QT05FTlRfVFlQRS5CVVRUT04gPyAnYnV0dG9uJyA6IFxyXG4gICAgICBpc1NlbGVjdE1lbnUoY29tcG9uZW50VHlwZSkgPyAnc2VsZWN0JyA6IG51bGw7XHJcbiAgICBcclxuICAgIGlmIChjb21wb25lbnRDYXRlZ29yeSAmJiBjb21wb25lbnRDYXRlZ29yeSAhPT0gZXhpc3RpbmdDYXRlZ29yeSkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXHJcbiAgICAgICAgYENhbm5vdCBtaXggJHtleGlzdGluZ0NhdGVnb3J5fXMgYW5kICR7Y29tcG9uZW50Q2F0ZWdvcnkgPT09ICdzZWxlY3QnID8gJ3NlbGVjdCBtZW51cycgOiAnYnV0dG9ucyd9IGluIHRoZSBzYW1lIGFjdGlvbiByb3cuIGAgK1xyXG4gICAgICAgIGBUaGlzIHJvdyBhbHJlYWR5IGNvbnRhaW5zICR7ZXhpc3RpbmdDYXRlZ29yeX1zLmBcclxuICAgICAgKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEFkZHMgY29tcG9uZW50cyB0byB0aGlzIGFjdGlvbiByb3dcclxuICAgKiBBY2NlcHRzIGluZGl2aWR1YWwgY29tcG9uZW50cyBvciBhbiBhcnJheSBvZiBjb21wb25lbnRzXHJcbiAgICogQHRocm93cyB7RXJyb3J9IGlmIGNvbXBvbmVudCB0eXBlcyBhcmUgaW5jb21wYXRpYmxlIChidXR0b25zIGNhbm5vdCBtaXggd2l0aCBzZWxlY3QgbWVudXMpXHJcbiAgICovXHJcbiAgYWRkQ29tcG9uZW50cyguLi5jb21wb25lbnRzOiAoVCB8IHsgdG9KU09OKCk6IFQgfSB8IChUIHwgeyB0b0pTT04oKTogVCB9KVtdKVtdKTogdGhpcyB7XHJcbiAgICBmb3IgKGNvbnN0IGNvbXBvbmVudCBvZiBjb21wb25lbnRzKSB7XHJcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KGNvbXBvbmVudCkpIHtcclxuICAgICAgICB0aGlzLmFkZENvbXBvbmVudHMoLi4uY29tcG9uZW50KTtcclxuICAgICAgfSBlbHNlIGlmICgndG9KU09OJyBpbiAoY29tcG9uZW50IGFzIGFueSkgJiYgdHlwZW9mIChjb21wb25lbnQgYXMgYW55KS50b0pTT04gPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICBjb25zdCByZXNvbHZlZCA9IChjb21wb25lbnQgYXMgYW55KS50b0pTT04oKTtcclxuICAgICAgICB0aGlzLl92YWxpZGF0ZUNvbXBvbmVudFR5cGUocmVzb2x2ZWQpO1xyXG4gICAgICAgIHRoaXMuZGF0YS5jb21wb25lbnRzLnB1c2gocmVzb2x2ZWQpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHRoaXMuX3ZhbGlkYXRlQ29tcG9uZW50VHlwZShjb21wb25lbnQpO1xyXG4gICAgICAgIHRoaXMuZGF0YS5jb21wb25lbnRzLnB1c2goY29tcG9uZW50IGFzIFQpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldHMgdGhlIGNvbXBvbmVudHMgb2YgdGhpcyBhY3Rpb24gcm93XHJcbiAgICogQWNjZXB0cyBpbmRpdmlkdWFsIGNvbXBvbmVudHMgb3IgYW4gYXJyYXkgb2YgY29tcG9uZW50c1xyXG4gICAqL1xyXG4gIHNldENvbXBvbmVudHMoLi4uY29tcG9uZW50czogKFQgfCB7IHRvSlNPTigpOiBUIH0gfCAoVCB8IHsgdG9KU09OKCk6IFQgfSlbXSlbXSk6IHRoaXMge1xyXG4gICAgdGhpcy5kYXRhLmNvbXBvbmVudHMgPSBbXTtcclxuICAgIHJldHVybiB0aGlzLmFkZENvbXBvbmVudHMoLi4uY29tcG9uZW50cyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZW1vdmVzLCByZXBsYWNlcywgb3IgaW5zZXJ0cyBjb21wb25lbnRzXHJcbiAgICogQHBhcmFtIGluZGV4IFRoZSBpbmRleCB0byBzdGFydCBhdFxyXG4gICAqIEBwYXJhbSBkZWxldGVDb3VudCBUaGUgbnVtYmVyIG9mIGNvbXBvbmVudHMgdG8gcmVtb3ZlXHJcbiAgICogQHBhcmFtIGNvbXBvbmVudHMgVGhlIGNvbXBvbmVudHMgdG8gaW5zZXJ0XHJcbiAgICovXHJcbiAgc3BsaWNlQ29tcG9uZW50cyhpbmRleDogbnVtYmVyLCBkZWxldGVDb3VudDogbnVtYmVyLCAuLi5jb21wb25lbnRzOiAoVCB8IHsgdG9KU09OKCk6IFQgfSlbXSk6IHRoaXMge1xyXG4gICAgY29uc3QgcmVzb2x2ZWQgPSBjb21wb25lbnRzLm1hcChjID0+IFxyXG4gICAgICAndG9KU09OJyBpbiBjICYmIHR5cGVvZiBjLnRvSlNPTiA9PT0gJ2Z1bmN0aW9uJyA/IGMudG9KU09OKCkgOiBjIGFzIFRcclxuICAgICk7XHJcbiAgICB0aGlzLmRhdGEuY29tcG9uZW50cy5zcGxpY2UoaW5kZXgsIGRlbGV0ZUNvdW50LCAuLi5yZXNvbHZlZCk7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJldHVybnMgdGhlIEpTT04gcmVwcmVzZW50YXRpb24gb2YgdGhpcyBhY3Rpb24gcm93XHJcbiAgICovXHJcbiAgdG9KU09OKCk6IEFQSUFjdGlvblJvdyB7XHJcbiAgICByZXR1cm4geyAuLi50aGlzLmRhdGEgfSBhcyBBUElBY3Rpb25Sb3c7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGVzIGEgbmV3IGFjdGlvbiByb3cgYnVpbGRlciBmcm9tIGV4aXN0aW5nIGRhdGFcclxuICAgKiBAcGFyYW0gb3RoZXIgVGhlIGFjdGlvbiByb3cgZGF0YSB0byBjb3B5XHJcbiAgICovXHJcbiAgc3RhdGljIGZyb208VCBleHRlbmRzIEFQSUFjdGlvblJvd0NvbXBvbmVudD4ob3RoZXI6IFBhcnRpYWw8QVBJQWN0aW9uUm93PiB8IEFjdGlvblJvd0J1aWxkZXI8VD4pOiBBY3Rpb25Sb3dCdWlsZGVyPFQ+IHtcclxuICAgIHJldHVybiBuZXcgQWN0aW9uUm93QnVpbGRlcjxUPihvdGhlciBpbnN0YW5jZW9mIEFjdGlvblJvd0J1aWxkZXIgPyBvdGhlci5kYXRhIDogb3RoZXIpO1xyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgQWN0aW9uUm93QnVpbGRlcjtcclxuIl19