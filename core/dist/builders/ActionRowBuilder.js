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
    return [3, 5, 6, 7, 8].includes(type);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQWN0aW9uUm93QnVpbGRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9idWlsZGVycy9BY3Rpb25Sb3dCdWlsZGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7R0FFRzs7O0FBWUgsK0JBQStCO0FBQy9CLE1BQU0sY0FBYyxHQUFHO0lBQ3JCLE1BQU0sRUFBRSxDQUFDO0lBQ1QsYUFBYSxFQUFFLENBQUM7SUFDaEIsVUFBVSxFQUFFLENBQUM7SUFDYixXQUFXLEVBQUUsQ0FBQztJQUNkLFdBQVcsRUFBRSxDQUFDO0lBQ2Qsa0JBQWtCLEVBQUUsQ0FBQztJQUNyQixjQUFjLEVBQUUsQ0FBQztDQUNULENBQUM7QUFFWCxpREFBaUQ7QUFDakQsU0FBUyxZQUFZLENBQUMsSUFBWTtJQUNoQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUN4QyxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxNQUFhLGdCQUFnQjtJQUNYLElBQUksQ0FBK0I7SUFFbkQsWUFBWSxPQUE4QixFQUFFO1FBQzFDLElBQUksQ0FBQyxJQUFJLEdBQUc7WUFDVixJQUFJLEVBQUUsQ0FBQztZQUNQLFVBQVUsRUFBRyxJQUFJLENBQUMsVUFBa0IsSUFBSSxFQUFFO1NBQzNDLENBQUM7SUFDSixDQUFDO0lBRUQ7OztPQUdHO0lBQ0ssNkJBQTZCO1FBQ25DLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxLQUFLLENBQUM7WUFBRSxPQUFPLElBQUksQ0FBQztRQUNuRCxNQUFNLFNBQVMsR0FBSSxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQVMsQ0FBQyxJQUFJLENBQUM7UUFDeEQsSUFBSSxTQUFTLEtBQUssY0FBYyxDQUFDLE1BQU07WUFBRSxPQUFPLFFBQVEsQ0FBQztRQUN6RCxJQUFJLFlBQVksQ0FBQyxTQUFTLENBQUM7WUFBRSxPQUFPLFFBQVEsQ0FBQztRQUM3QyxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRDs7O09BR0c7SUFDSyxzQkFBc0IsQ0FBQyxTQUFjO1FBQzNDLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLDZCQUE2QixFQUFFLENBQUM7UUFDOUQsSUFBSSxnQkFBZ0IsS0FBSyxJQUFJO1lBQUUsT0FBTztRQUV0QyxNQUFNLGFBQWEsR0FBRyxTQUFTLENBQUMsSUFBSSxDQUFDO1FBQ3JDLE1BQU0saUJBQWlCLEdBQUcsYUFBYSxLQUFLLGNBQWMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQzVFLFlBQVksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7UUFFaEQsSUFBSSxpQkFBaUIsSUFBSSxpQkFBaUIsS0FBSyxnQkFBZ0IsRUFBRSxDQUFDO1lBQ2hFLE1BQU0sSUFBSSxLQUFLLENBQ2IsY0FBYyxnQkFBZ0IsU0FBUyxpQkFBaUIsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsU0FBUywyQkFBMkI7Z0JBQzdILDZCQUE2QixnQkFBZ0IsSUFBSSxDQUNsRCxDQUFDO1FBQ0osQ0FBQztJQUNILENBQUM7SUFFRDs7OztPQUlHO0lBQ0gsYUFBYSxDQUFDLEdBQUcsVUFBNkQ7UUFDNUUsS0FBSyxNQUFNLFNBQVMsSUFBSSxVQUFVLEVBQUUsQ0FBQztZQUNuQyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQztnQkFDN0IsSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxDQUFDO1lBQ25DLENBQUM7aUJBQU0sSUFBSSxRQUFRLElBQUssU0FBaUIsSUFBSSxPQUFRLFNBQWlCLENBQUMsTUFBTSxLQUFLLFVBQVUsRUFBRSxDQUFDO2dCQUM3RixNQUFNLFFBQVEsR0FBSSxTQUFpQixDQUFDLE1BQU0sRUFBRSxDQUFDO2dCQUM3QyxJQUFJLENBQUMsc0JBQXNCLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQ3RDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUN0QyxDQUFDO2lCQUFNLENBQUM7Z0JBQ04sSUFBSSxDQUFDLHNCQUFzQixDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUN2QyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsU0FBYyxDQUFDLENBQUM7WUFDNUMsQ0FBQztRQUNILENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRDs7O09BR0c7SUFDSCxhQUFhLENBQUMsR0FBRyxVQUE2RDtRQUM1RSxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsR0FBRyxFQUFFLENBQUM7UUFDMUIsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsVUFBVSxDQUFDLENBQUM7SUFDM0MsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0gsZ0JBQWdCLENBQUMsS0FBYSxFQUFFLFdBQW1CLEVBQUUsR0FBRyxVQUFtQztRQUN6RixNQUFNLFFBQVEsR0FBRyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQ2xDLFFBQVEsSUFBSSxDQUFDLElBQUksT0FBTyxDQUFDLENBQUMsTUFBTSxLQUFLLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFNLENBQ3RFLENBQUM7UUFDRixJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLFdBQVcsRUFBRSxHQUFHLFFBQVEsQ0FBQyxDQUFDO1FBQzdELE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEOztPQUVHO0lBQ0gsTUFBTTtRQUNKLE9BQU8sRUFBRSxHQUFHLElBQUksQ0FBQyxJQUFJLEVBQWtCLENBQUM7SUFDMUMsQ0FBQztJQUVEOzs7T0FHRztJQUNILE1BQU0sQ0FBQyxJQUFJLENBQWtDLEtBQWtEO1FBQzdGLE9BQU8sSUFBSSxnQkFBZ0IsQ0FBSSxLQUFLLFlBQVksZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ3pGLENBQUM7Q0FDRjtBQXBHRCw0Q0FvR0M7QUFFRCxrQkFBZSxnQkFBZ0IsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBBY3Rpb25Sb3dCdWlsZGVyIGZvciBjcmVhdGluZyBjb21wb25lbnQgcm93c1xyXG4gKi9cclxuXHJcbmltcG9ydCB7IEFQSUJ1dHRvbkNvbXBvbmVudCB9IGZyb20gJy4vQnV0dG9uQnVpbGRlcic7XHJcbmltcG9ydCB7IEFQSVNlbGVjdE1lbnVDb21wb25lbnQsIEFQSUF1dG9TZWxlY3RNZW51Q29tcG9uZW50IH0gZnJvbSAnLi9TZWxlY3RNZW51QnVpbGRlcic7XHJcblxyXG5leHBvcnQgdHlwZSBBUElBY3Rpb25Sb3dDb21wb25lbnQgPSBBUElCdXR0b25Db21wb25lbnQgfCBBUElTZWxlY3RNZW51Q29tcG9uZW50IHwgQVBJQXV0b1NlbGVjdE1lbnVDb21wb25lbnQ7XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEFQSUFjdGlvblJvdyB7XHJcbiAgdHlwZTogMTtcclxuICBjb21wb25lbnRzOiBBUElBY3Rpb25Sb3dDb21wb25lbnRbXTtcclxufVxyXG5cclxuLyoqIENvbXBvbmVudCB0eXBlIGNvbnN0YW50cyAqL1xyXG5jb25zdCBDT01QT05FTlRfVFlQRSA9IHtcclxuICBCVVRUT046IDIsXHJcbiAgU1RSSU5HX1NFTEVDVDogMyxcclxuICBURVhUX0lOUFVUOiA0LFxyXG4gIFVTRVJfU0VMRUNUOiA1LFxyXG4gIFJPTEVfU0VMRUNUOiA2LFxyXG4gIE1FTlRJT05BQkxFX1NFTEVDVDogNyxcclxuICBDSEFOTkVMX1NFTEVDVDogOCxcclxufSBhcyBjb25zdDtcclxuXHJcbi8qKiBDaGVjayBpZiBhIGNvbXBvbmVudCB0eXBlIGlzIGEgc2VsZWN0IG1lbnUgKi9cclxuZnVuY3Rpb24gaXNTZWxlY3RNZW51KHR5cGU6IG51bWJlcik6IGJvb2xlYW4ge1xyXG4gIHJldHVybiBbMywgNSwgNiwgNywgOF0uaW5jbHVkZXModHlwZSk7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBBIGJ1aWxkZXIgZm9yIGNyZWF0aW5nIGFjdGlvbiByb3dzXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgQWN0aW9uUm93QnVpbGRlcjxUIGV4dGVuZHMgQVBJQWN0aW9uUm93Q29tcG9uZW50ID0gQVBJQWN0aW9uUm93Q29tcG9uZW50PiB7XHJcbiAgcHVibGljIHJlYWRvbmx5IGRhdGE6IHsgdHlwZTogMTsgY29tcG9uZW50czogVFtdIH07XHJcblxyXG4gIGNvbnN0cnVjdG9yKGRhdGE6IFBhcnRpYWw8QVBJQWN0aW9uUm93PiA9IHt9KSB7XHJcbiAgICB0aGlzLmRhdGEgPSB7IFxyXG4gICAgICB0eXBlOiAxLCBcclxuICAgICAgY29tcG9uZW50czogKGRhdGEuY29tcG9uZW50cyBhcyBUW10pIHx8IFtdIFxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCB0aGUgZXhpc3RpbmcgY29tcG9uZW50IHR5cGUgaW4gdGhlIHJvdyAoYnV0dG9uIHZzIHNlbGVjdCBtZW51KVxyXG4gICAqIEByZXR1cm5zICdidXR0b24nIHwgJ3NlbGVjdCcgfCBudWxsXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBfZ2V0RXhpc3RpbmdDb21wb25lbnRDYXRlZ29yeSgpOiAnYnV0dG9uJyB8ICdzZWxlY3QnIHwgbnVsbCB7XHJcbiAgICBpZiAodGhpcy5kYXRhLmNvbXBvbmVudHMubGVuZ3RoID09PSAwKSByZXR1cm4gbnVsbDtcclxuICAgIGNvbnN0IGZpcnN0VHlwZSA9ICh0aGlzLmRhdGEuY29tcG9uZW50c1swXSBhcyBhbnkpLnR5cGU7XHJcbiAgICBpZiAoZmlyc3RUeXBlID09PSBDT01QT05FTlRfVFlQRS5CVVRUT04pIHJldHVybiAnYnV0dG9uJztcclxuICAgIGlmIChpc1NlbGVjdE1lbnUoZmlyc3RUeXBlKSkgcmV0dXJuICdzZWxlY3QnO1xyXG4gICAgcmV0dXJuIG51bGw7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBWYWxpZGF0ZSB0aGF0IGEgY29tcG9uZW50IGlzIGNvbXBhdGlibGUgd2l0aCBleGlzdGluZyBjb21wb25lbnRzIGluIHRoZSByb3dcclxuICAgKiBAdGhyb3dzIHtFcnJvcn0gaWYgY29tcG9uZW50IHR5cGUgaXMgaW5jb21wYXRpYmxlXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBfdmFsaWRhdGVDb21wb25lbnRUeXBlKGNvbXBvbmVudDogYW55KTogdm9pZCB7XHJcbiAgICBjb25zdCBleGlzdGluZ0NhdGVnb3J5ID0gdGhpcy5fZ2V0RXhpc3RpbmdDb21wb25lbnRDYXRlZ29yeSgpO1xyXG4gICAgaWYgKGV4aXN0aW5nQ2F0ZWdvcnkgPT09IG51bGwpIHJldHVybjtcclxuXHJcbiAgICBjb25zdCBjb21wb25lbnRUeXBlID0gY29tcG9uZW50LnR5cGU7XHJcbiAgICBjb25zdCBjb21wb25lbnRDYXRlZ29yeSA9IGNvbXBvbmVudFR5cGUgPT09IENPTVBPTkVOVF9UWVBFLkJVVFRPTiA/ICdidXR0b24nIDogXHJcbiAgICAgIGlzU2VsZWN0TWVudShjb21wb25lbnRUeXBlKSA/ICdzZWxlY3QnIDogbnVsbDtcclxuICAgIFxyXG4gICAgaWYgKGNvbXBvbmVudENhdGVnb3J5ICYmIGNvbXBvbmVudENhdGVnb3J5ICE9PSBleGlzdGluZ0NhdGVnb3J5KSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihcclxuICAgICAgICBgQ2Fubm90IG1peCAke2V4aXN0aW5nQ2F0ZWdvcnl9cyBhbmQgJHtjb21wb25lbnRDYXRlZ29yeSA9PT0gJ3NlbGVjdCcgPyAnc2VsZWN0IG1lbnVzJyA6ICdidXR0b25zJ30gaW4gdGhlIHNhbWUgYWN0aW9uIHJvdy4gYCArXHJcbiAgICAgICAgYFRoaXMgcm93IGFscmVhZHkgY29udGFpbnMgJHtleGlzdGluZ0NhdGVnb3J5fXMuYFxyXG4gICAgICApO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQWRkcyBjb21wb25lbnRzIHRvIHRoaXMgYWN0aW9uIHJvd1xyXG4gICAqIEFjY2VwdHMgaW5kaXZpZHVhbCBjb21wb25lbnRzIG9yIGFuIGFycmF5IG9mIGNvbXBvbmVudHNcclxuICAgKiBAdGhyb3dzIHtFcnJvcn0gaWYgY29tcG9uZW50IHR5cGVzIGFyZSBpbmNvbXBhdGlibGUgKGJ1dHRvbnMgY2Fubm90IG1peCB3aXRoIHNlbGVjdCBtZW51cylcclxuICAgKi9cclxuICBhZGRDb21wb25lbnRzKC4uLmNvbXBvbmVudHM6IChUIHwgeyB0b0pTT04oKTogVCB9IHwgKFQgfCB7IHRvSlNPTigpOiBUIH0pW10pW10pOiB0aGlzIHtcclxuICAgIGZvciAoY29uc3QgY29tcG9uZW50IG9mIGNvbXBvbmVudHMpIHtcclxuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoY29tcG9uZW50KSkge1xyXG4gICAgICAgIHRoaXMuYWRkQ29tcG9uZW50cyguLi5jb21wb25lbnQpO1xyXG4gICAgICB9IGVsc2UgaWYgKCd0b0pTT04nIGluIChjb21wb25lbnQgYXMgYW55KSAmJiB0eXBlb2YgKGNvbXBvbmVudCBhcyBhbnkpLnRvSlNPTiA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgIGNvbnN0IHJlc29sdmVkID0gKGNvbXBvbmVudCBhcyBhbnkpLnRvSlNPTigpO1xyXG4gICAgICAgIHRoaXMuX3ZhbGlkYXRlQ29tcG9uZW50VHlwZShyZXNvbHZlZCk7XHJcbiAgICAgICAgdGhpcy5kYXRhLmNvbXBvbmVudHMucHVzaChyZXNvbHZlZCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdGhpcy5fdmFsaWRhdGVDb21wb25lbnRUeXBlKGNvbXBvbmVudCk7XHJcbiAgICAgICAgdGhpcy5kYXRhLmNvbXBvbmVudHMucHVzaChjb21wb25lbnQgYXMgVCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogU2V0cyB0aGUgY29tcG9uZW50cyBvZiB0aGlzIGFjdGlvbiByb3dcclxuICAgKiBBY2NlcHRzIGluZGl2aWR1YWwgY29tcG9uZW50cyBvciBhbiBhcnJheSBvZiBjb21wb25lbnRzXHJcbiAgICovXHJcbiAgc2V0Q29tcG9uZW50cyguLi5jb21wb25lbnRzOiAoVCB8IHsgdG9KU09OKCk6IFQgfSB8IChUIHwgeyB0b0pTT04oKTogVCB9KVtdKVtdKTogdGhpcyB7XHJcbiAgICB0aGlzLmRhdGEuY29tcG9uZW50cyA9IFtdO1xyXG4gICAgcmV0dXJuIHRoaXMuYWRkQ29tcG9uZW50cyguLi5jb21wb25lbnRzKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlbW92ZXMsIHJlcGxhY2VzLCBvciBpbnNlcnRzIGNvbXBvbmVudHNcclxuICAgKiBAcGFyYW0gaW5kZXggVGhlIGluZGV4IHRvIHN0YXJ0IGF0XHJcbiAgICogQHBhcmFtIGRlbGV0ZUNvdW50IFRoZSBudW1iZXIgb2YgY29tcG9uZW50cyB0byByZW1vdmVcclxuICAgKiBAcGFyYW0gY29tcG9uZW50cyBUaGUgY29tcG9uZW50cyB0byBpbnNlcnRcclxuICAgKi9cclxuICBzcGxpY2VDb21wb25lbnRzKGluZGV4OiBudW1iZXIsIGRlbGV0ZUNvdW50OiBudW1iZXIsIC4uLmNvbXBvbmVudHM6IChUIHwgeyB0b0pTT04oKTogVCB9KVtdKTogdGhpcyB7XHJcbiAgICBjb25zdCByZXNvbHZlZCA9IGNvbXBvbmVudHMubWFwKGMgPT4gXHJcbiAgICAgICd0b0pTT04nIGluIGMgJiYgdHlwZW9mIGMudG9KU09OID09PSAnZnVuY3Rpb24nID8gYy50b0pTT04oKSA6IGMgYXMgVFxyXG4gICAgKTtcclxuICAgIHRoaXMuZGF0YS5jb21wb25lbnRzLnNwbGljZShpbmRleCwgZGVsZXRlQ291bnQsIC4uLnJlc29sdmVkKTtcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmV0dXJucyB0aGUgSlNPTiByZXByZXNlbnRhdGlvbiBvZiB0aGlzIGFjdGlvbiByb3dcclxuICAgKi9cclxuICB0b0pTT04oKTogQVBJQWN0aW9uUm93IHtcclxuICAgIHJldHVybiB7IC4uLnRoaXMuZGF0YSB9IGFzIEFQSUFjdGlvblJvdztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZXMgYSBuZXcgYWN0aW9uIHJvdyBidWlsZGVyIGZyb20gZXhpc3RpbmcgZGF0YVxyXG4gICAqIEBwYXJhbSBvdGhlciBUaGUgYWN0aW9uIHJvdyBkYXRhIHRvIGNvcHlcclxuICAgKi9cclxuICBzdGF0aWMgZnJvbTxUIGV4dGVuZHMgQVBJQWN0aW9uUm93Q29tcG9uZW50PihvdGhlcjogUGFydGlhbDxBUElBY3Rpb25Sb3c+IHwgQWN0aW9uUm93QnVpbGRlcjxUPik6IEFjdGlvblJvd0J1aWxkZXI8VD4ge1xyXG4gICAgcmV0dXJuIG5ldyBBY3Rpb25Sb3dCdWlsZGVyPFQ+KG90aGVyIGluc3RhbmNlb2YgQWN0aW9uUm93QnVpbGRlciA/IG90aGVyLmRhdGEgOiBvdGhlcik7XHJcbiAgfVxyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBBY3Rpb25Sb3dCdWlsZGVyO1xyXG4iXX0=