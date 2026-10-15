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
export declare class ActionRowBuilder<T extends APIActionRowComponent = APIActionRowComponent> {
    readonly data: {
        type: 1;
        components: T[];
    };
    constructor(data?: Partial<APIActionRow>);
    /**
     * Get the existing component type in the row (button vs select menu)
     * @returns 'button' | 'select' | null
     */
    private _getExistingComponentCategory;
    /**
     * Validate that a component is compatible with existing components in the row
     * @throws {Error} if component type is incompatible
     */
    private _validateComponentType;
    /**
     * Adds components to this action row
     * Accepts individual components or an array of components
     * @throws {Error} if component types are incompatible (buttons cannot mix with select menus)
     */
    addComponents(...components: (T | {
        toJSON(): T;
    } | (T | {
        toJSON(): T;
    })[])[]): this;
    /**
     * Sets the components of this action row
     * Accepts individual components or an array of components
     */
    setComponents(...components: (T | {
        toJSON(): T;
    } | (T | {
        toJSON(): T;
    })[])[]): this;
    /**
     * Removes, replaces, or inserts components
     * @param index The index to start at
     * @param deleteCount The number of components to remove
     * @param components The components to insert
     */
    spliceComponents(index: number, deleteCount: number, ...components: (T | {
        toJSON(): T;
    })[]): this;
    /**
     * Returns the JSON representation of this action row
     */
    toJSON(): APIActionRow;
    /**
     * Creates a new action row builder from existing data
     * @param other The action row data to copy
     */
    static from<T extends APIActionRowComponent>(other: Partial<APIActionRow> | ActionRowBuilder<T>): ActionRowBuilder<T>;
}
export default ActionRowBuilder;
