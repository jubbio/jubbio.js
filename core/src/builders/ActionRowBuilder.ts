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
   * Adds components to this action row
   * @param components The components to add
   */
  addComponents(...components: (T | { toJSON(): T })[]): this {
    for (const component of components) {
      if ('toJSON' in component && typeof component.toJSON === 'function') {
        this.data.components.push(component.toJSON());
      } else {
        this.data.components.push(component as T);
      }
    }
    return this;
  }

  /**
   * Sets the components of this action row
   * @param components The components to set
   */
  setComponents(...components: (T | { toJSON(): T })[]): this {
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
