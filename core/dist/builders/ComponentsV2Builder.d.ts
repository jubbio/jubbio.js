import { SeparatorSpacingSize } from '../enums';
import { APIActionRow, ActionRowBuilder } from './ActionRowBuilder';
import { APIButtonComponent, ButtonBuilder } from './ButtonBuilder';
export interface APIUnfurledMediaItem {
    url: string;
    content_type?: string;
    width?: number;
    height?: number;
}
interface IdentifiedComponent {
    id?: number;
}
export interface APITextDisplayComponent extends IdentifiedComponent {
    type: 10;
    content: string;
}
export interface APIThumbnailComponent extends IdentifiedComponent {
    type: 11;
    media: APIUnfurledMediaItem;
    description?: string;
    spoiler?: boolean;
}
export type APISectionAccessory = APIThumbnailComponent | APIButtonComponent;
export interface APISectionComponent extends IdentifiedComponent {
    type: 9;
    components: APITextDisplayComponent[];
    accessory?: APISectionAccessory;
}
export interface APIMediaGalleryItem {
    media: APIUnfurledMediaItem;
    description?: string;
    spoiler?: boolean;
}
export interface APIMediaGalleryComponent extends IdentifiedComponent {
    type: 12;
    items: APIMediaGalleryItem[];
}
export interface APIFileComponent extends IdentifiedComponent {
    type: 13;
    file: APIUnfurledMediaItem;
    spoiler?: boolean;
    name?: string;
    size?: number;
}
export interface APISeparatorComponent extends IdentifiedComponent {
    type: 14;
    divider?: boolean;
    spacing?: SeparatorSpacingSize;
}
export type APIContainerChildComponent = APIActionRow | APISectionComponent | APITextDisplayComponent | APIMediaGalleryComponent | APIFileComponent | APISeparatorComponent;
export interface APIContainerComponent extends IdentifiedComponent {
    type: 17;
    components: APIContainerChildComponent[];
    accent_color?: number | null;
    spoiler?: boolean;
}
export type APIMessageLayoutComponent = APIContainerChildComponent | APIContainerComponent;
type Input<D, B> = D | B | ((builder: B) => B);
declare abstract class ComponentBuilder<D extends IdentifiedComponent> {
    readonly data: D;
    constructor(data: D);
    setId(id: number): this;
    toJSON(): D;
}
/** Markdown message text, including normal Jubbio mentions. */
export declare class TextDisplayBuilder extends ComponentBuilder<APITextDisplayComponent> {
    constructor(data?: Partial<APITextDisplayComponent> | string);
    setContent(content: string): this;
    static from(data: APITextDisplayComponent | TextDisplayBuilder | string): TextDisplayBuilder;
}
/** Image accessory for a Section. */
export declare class ThumbnailBuilder extends ComponentBuilder<APIThumbnailComponent> {
    constructor(data?: Partial<APIThumbnailComponent>);
    setURL(url: string): this;
    setMedia(media: APIUnfurledMediaItem | string): this;
    setDescription(description: string): this;
    setSpoiler(spoiler?: boolean): this;
    static from(data: APIThumbnailComponent | ThumbnailBuilder): ThumbnailBuilder;
}
/** One to three text displays with a button or thumbnail accessory. */
export declare class SectionBuilder extends ComponentBuilder<APISectionComponent> {
    constructor(data?: Partial<APISectionComponent>);
    addTextDisplayComponents(...inputs: (Input<APITextDisplayComponent, TextDisplayBuilder> | string)[]): this;
    setThumbnailAccessory(input: Input<APIThumbnailComponent, ThumbnailBuilder> | string): this;
    setButtonAccessory(input: Input<APIButtonComponent, ButtonBuilder>): this;
    static from(data: APISectionComponent | SectionBuilder): SectionBuilder;
}
/** One image or video within a media gallery. */
export declare class MediaGalleryItemBuilder {
    readonly data: APIMediaGalleryItem;
    constructor(data?: Partial<APIMediaGalleryItem>);
    setURL(url: string): this;
    setMedia(media: APIUnfurledMediaItem | string): this;
    setDescription(description: string): this;
    setSpoiler(spoiler?: boolean): this;
    toJSON(): APIMediaGalleryItem;
    static from(data: APIMediaGalleryItem | MediaGalleryItemBuilder): MediaGalleryItemBuilder;
}
/** Gallery containing one to ten media items. */
export declare class MediaGalleryBuilder extends ComponentBuilder<APIMediaGalleryComponent> {
    constructor(data?: Partial<APIMediaGalleryComponent>);
    addItems(...items: Input<APIMediaGalleryItem, MediaGalleryItemBuilder>[]): this;
    setItems(...items: Input<APIMediaGalleryItem, MediaGalleryItemBuilder>[]): this;
    static from(data: APIMediaGalleryComponent | MediaGalleryBuilder): MediaGalleryBuilder;
}
/** Download card for an HTTP(S) URL or attachment://filename reference. */
export declare class FileBuilder extends ComponentBuilder<APIFileComponent> {
    constructor(data?: Partial<APIFileComponent> | string);
    setURL(url: string): this;
    setFile(file: APIUnfurledMediaItem | string): this;
    setName(name: string): this;
    setSize(size: number): this;
    setSpoiler(spoiler?: boolean): this;
    static from(data: APIFileComponent | FileBuilder): FileBuilder;
}
/** Optional divider and small/large vertical spacing. */
export declare class SeparatorBuilder extends ComponentBuilder<APISeparatorComponent> {
    constructor(data?: Partial<APISeparatorComponent>);
    setDivider(divider?: boolean): this;
    setSpacing(spacing: SeparatorSpacingSize): this;
    static from(data: APISeparatorComponent | SeparatorBuilder): SeparatorBuilder;
}
/** Groups message components with an optional accent color and spoiler cover. */
export declare class ContainerBuilder extends ComponentBuilder<APIContainerComponent> {
    constructor(data?: Partial<APIContainerComponent>);
    setAccentColor(color: number | string | [number, number, number] | null): this;
    setSpoiler(spoiler?: boolean): this;
    addTextDisplayComponents(...inputs: (Input<APITextDisplayComponent, TextDisplayBuilder> | string)[]): this;
    addSectionComponents(...inputs: Input<APISectionComponent, SectionBuilder>[]): this;
    addMediaGalleryComponents(...inputs: Input<APIMediaGalleryComponent, MediaGalleryBuilder>[]): this;
    addFileComponents(...inputs: Input<APIFileComponent, FileBuilder>[]): this;
    addSeparatorComponents(...inputs: Input<APISeparatorComponent, SeparatorBuilder>[]): this;
    addActionRowComponents(...inputs: Input<APIActionRow, ActionRowBuilder>[]): this;
    static from(data: APIContainerComponent | ContainerBuilder): ContainerBuilder;
}
export {};
