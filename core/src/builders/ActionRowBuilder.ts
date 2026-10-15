/**
 * ActionRowBuilder for creating component rows
 */

import { APIButtonComponent } from './ButtonBuilder';
import { APISelectMenuComponent } from './SelectMenuBuilder';

export type APIActionRowComponent = APIButtonComponent | APISelectMenuComponent;

export interface APIActionRow {
  type: 1;
  components: APIActionRowComponent[];
}

/** Component type constants */
const COMPONENT_TYPE = {
  BUTTON: 2,
  STRING_SELECT: 3,
  TEXT_INPUT: 4,
  USER_SELECT: 5,
  ROLE_SELECT: 6,
  MENTIONABLE_SELECT: 7,
  CHANNEL_SELECT: 8,
} as const;

/** Check if a component type is a select menu */
function isSelectMenu(type: number): boolean {
  return type >= COMPONENT_TYPE.STRING_SELECT && type !== COMPONENT_TYPE.TEXT_INPUT;
}

/**
 * A builder for creating action rows
 */
export class ActionRowBuilder<T extends APIActionRowComponent = APIActionRowComponent> {
  public readonly data: { type: 1; components: T[] };

  constructor(data: Partial<APIActionRow> = {}) {
    this.data = { 
      type: 1, 
      components: (data.components as T[]) || [] 
    };
  }

  /**
   * Get the existing component type in the row (button vs select menu)
   * @returns 'button' | 'select' | null
   */
  private _getExistingComponentCategory(): 'button' | 'select' | null {
    if (this.data.components.length === 0) return null;
    const firstType = (this.data.components[0] as any).type;
    if (firstType === COMPONENT_TYPE.BUTTON) return 'button';
    if (isSelectMenu(firstType)) return 'select';
    return null;
  }

  /**
   * Validate that a component is compatible with existing components in the row
   * @throws {Error} if component type is incompatible
   */
  private _validateComponentType(component: any): void {
    const existingCategory = this._getExistingComponentCategory();
    if (existingCategory === null) return;

    const componentType = component.type;
    const componentCategory = componentType === COMPONENT_TYPE.BUTTON ? 'button' : 
      isSelectMenu(componentType) ? 'select' : null;
    
    if (componentCategory && componentCategory !== existingCategory) {
      throw new Error(
        `Cannot mix ${existingCategory}s and ${componentCategory === 'select' ? 'select menus' : 'buttons'} in the same action row. ` +
        `This row already contains ${existingCategory}s.`
      );
    }
  }

  /**
   * Adds components to this action row
   * Accepts individual components or an array of components
   * @throws {Error} if component types are incompatible (buttons cannot mix with select menus)
   */
  addComponents(...components: (T | { toJSON(): T } | (T | { toJSON(): T })[])[]): this {
    for (const component of components) {
      if (Array.isArray(component)) {
        this.addComponents(...component);
      } else if ('toJSON' in (component as any) && typeof (component as any).toJSON === 'function') {
        const resolved = (component as any).toJSON();
        this._validateComponentType(resolved);
        this.data.components.push(resolved);
      } else {
        this._validateComponentType(component);
        this.data.components.push(component as T);
      }
    }
    return this;
  }

  /**
   * Sets the components of this action row
   * Accepts individual components or an array of components
   */
  setComponents(...components: (T | { toJSON(): T } | (T | { toJSON(): T })[])[]): this {
    this.data.components = [];
    return this.addComponents(...components);
  }

  /**
   * Removes, replaces, or inserts components
   * @param index The index to start at
   * @param deleteCount The number of components to remove
   * @param components The components to insert
   */
  spliceComponents(index: number, deleteCount: number, ...components: (T | { toJSON(): T })[]): this {
    const resolved = components.map(c => 
      'toJSON' in c && typeof c.toJSON === 'function' ? c.toJSON() : c as T
    );
    this.data.components.splice(index, deleteCount, ...resolved);
    return this;
  }

  /**
   * Returns the JSON representation of this action row
   */
  toJSON(): APIActionRow {
    return { ...this.data } as APIActionRow;
  }

  /**
   * Creates a new action row builder from existing data
   * @param other The action row data to copy
   */
  static from<T extends APIActionRowComponent>(other: Partial<APIActionRow> | ActionRowBuilder<T>): ActionRowBuilder<T> {
    return new ActionRowBuilder<T>(other instanceof ActionRowBuilder ? other.data : other);
  }
}

export default ActionRowBuilder;
