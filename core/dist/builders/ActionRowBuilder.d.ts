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
     * Adds components to this action row
     * @param components The components to add
     */
    addComponents(...components: (T | {
        toJSON(): T;
    })[]): this;
    /**
     * Sets the components of this action row
     * @param components The components to set
     */
    setComponents(...components: (T | {
        toJSON(): T;
    })[]): this;
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
