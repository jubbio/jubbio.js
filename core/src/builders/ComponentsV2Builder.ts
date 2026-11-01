import { DataResolver } from '../utils/DataResolver';
import { SeparatorSpacingSize } from '../enums';
import { serializeComponentNode } from '../utils/serialize';
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
export type APIContainerChildComponent =
  | APIActionRow
  | APISectionComponent
  | APITextDisplayComponent
  | APIMediaGalleryComponent
  | APIFileComponent
  | APISeparatorComponent;
export interface APIContainerComponent extends IdentifiedComponent {
  type: 17;
  components: APIContainerChildComponent[];
  accent_color?: number | null;
  spoiler?: boolean;
}
export type APIMessageLayoutComponent = APIContainerChildComponent | APIContainerComponent;
type Input<D, B> = D | B | ((builder: B) => B);

function resolve<D, B extends { toJSON(): D }>(input: Input<D, B>, create: () => B): D {
  const value = typeof input === 'function' ? (input as (builder: B) => B)(create()) : input;
  return serializeComponentNode(value) as D;
}

abstract class ComponentBuilder<D extends IdentifiedComponent> {
  constructor(public readonly data: D) {}
  setId(id: number): this {
    if (!Number.isInteger(id) || id < 0 || id > 0xffffffff)
      throw new RangeError('Component id must be an unsigned 32-bit integer');
    this.data.id = id;
    return this;
  }
  toJSON(): D {
    return serializeComponentNode(this.data) as D;
  }
}

/** Markdown message text, including normal Jubbio mentions. */
export class TextDisplayBuilder extends ComponentBuilder<APITextDisplayComponent> {
  constructor(data: Partial<APITextDisplayComponent> | string = {}) {
    super(
      typeof data === 'string'
        ? { type: 10, content: data }
        : { ...data, type: 10, content: data.content ?? '' },
    );
  }
  setContent(content: string): this {
    this.data.content = content;
    return this;
  }
  static from(data: APITextDisplayComponent | TextDisplayBuilder | string): TextDisplayBuilder {
    return new TextDisplayBuilder(typeof data === 'string' ? data : serializeComponentNode(data));
  }
}

/** Image accessory for a Section. */
export class ThumbnailBuilder extends ComponentBuilder<APIThumbnailComponent> {
  constructor(data: Partial<APIThumbnailComponent> = {}) {
    super({ ...data, type: 11, media: { ...data.media, url: data.media?.url ?? '' } });
  }
  setURL(url: string): this {
    this.data.media = { url };
    return this;
  }
  setMedia(media: APIUnfurledMediaItem | string): this {
    this.data.media = typeof media === 'string' ? { url: media } : { ...media };
    return this;
  }
  setDescription(description: string): this {
    this.data.description = description;
    return this;
  }
  setSpoiler(spoiler = true): this {
    this.data.spoiler = spoiler;
    return this;
  }
  static from(data: APIThumbnailComponent | ThumbnailBuilder): ThumbnailBuilder {
    return new ThumbnailBuilder(serializeComponentNode(data));
  }
}

/** One to three text displays with a button or thumbnail accessory. */
export class SectionBuilder extends ComponentBuilder<APISectionComponent> {
  constructor(data: Partial<APISectionComponent> = {}) {
    super({ ...data, type: 9, components: serializeComponentNode(data.components ?? []) });
  }
  addTextDisplayComponents(
    ...inputs: (Input<APITextDisplayComponent, TextDisplayBuilder> | string)[]
  ): this {
    this.data.components.push(
      ...inputs.map((input) =>
        typeof input === 'string'
          ? new TextDisplayBuilder(input).toJSON()
          : resolve(input, () => new TextDisplayBuilder()),
      ),
    );
    return this;
  }
  setThumbnailAccessory(input: Input<APIThumbnailComponent, ThumbnailBuilder> | string): this {
    this.data.accessory =
      typeof input === 'string'
        ? new ThumbnailBuilder().setURL(input).toJSON()
        : resolve(input, () => new ThumbnailBuilder());
    return this;
  }
  setButtonAccessory(input: Input<APIButtonComponent, ButtonBuilder>): this {
    this.data.accessory = resolve(input, () => new ButtonBuilder());
    return this;
  }
  static from(data: APISectionComponent | SectionBuilder): SectionBuilder {
    return new SectionBuilder(serializeComponentNode(data));
  }
}

/** One image or video within a media gallery. */
export class MediaGalleryItemBuilder {
  public readonly data: APIMediaGalleryItem;
  constructor(data: Partial<APIMediaGalleryItem> = {}) {
    this.data = { ...data, media: { ...data.media, url: data.media?.url ?? '' } };
  }
  setURL(url: string): this {
    this.data.media = { url };
    return this;
  }
  setMedia(media: APIUnfurledMediaItem | string): this {
    this.data.media = typeof media === 'string' ? { url: media } : { ...media };
    return this;
  }
  setDescription(description: string): this {
    this.data.description = description;
    return this;
  }
  setSpoiler(spoiler = true): this {
    this.data.spoiler = spoiler;
    return this;
  }
  toJSON(): APIMediaGalleryItem {
    return serializeComponentNode(this.data);
  }
  static from(data: APIMediaGalleryItem | MediaGalleryItemBuilder): MediaGalleryItemBuilder {
    return new MediaGalleryItemBuilder(serializeComponentNode(data));
  }
}

/** Gallery containing one to ten media items. */
export class MediaGalleryBuilder extends ComponentBuilder<APIMediaGalleryComponent> {
  constructor(data: Partial<APIMediaGalleryComponent> = {}) {
    super({ ...data, type: 12, items: serializeComponentNode(data.items ?? []) });
  }
  addItems(...items: Input<APIMediaGalleryItem, MediaGalleryItemBuilder>[]): this {
    this.data.items.push(
      ...items.map((input) => resolve(input, () => new MediaGalleryItemBuilder())),
    );
    return this;
  }
  setItems(...items: Input<APIMediaGalleryItem, MediaGalleryItemBuilder>[]): this {
    this.data.items = [];
    return this.addItems(...items);
  }
  static from(data: APIMediaGalleryComponent | MediaGalleryBuilder): MediaGalleryBuilder {
    return new MediaGalleryBuilder(serializeComponentNode(data));
  }
}

/** Download card for an HTTP(S) URL or attachment://filename reference. */
export class FileBuilder extends ComponentBuilder<APIFileComponent> {
  constructor(data: Partial<APIFileComponent> | string = {}) {
    super(
      typeof data === 'string'
        ? { type: 13, file: { url: data } }
        : { ...data, type: 13, file: { ...data.file, url: data.file?.url ?? '' } },
    );
  }
  setURL(url: string): this {
    this.data.file = { url };
    return this;
  }
  setFile(file: APIUnfurledMediaItem | string): this {
    this.data.file = typeof file === 'string' ? { url: file } : { ...file };
    return this;
  }
  setName(name: string): this {
    this.data.name = name;
    return this;
  }
  setSize(size: number): this {
    if (!Number.isSafeInteger(size) || size < 0)
      throw new RangeError('File size must be a non-negative safe integer');
    this.data.size = size;
    return this;
  }
  setSpoiler(spoiler = true): this {
    this.data.spoiler = spoiler;
    return this;
  }
  static from(data: APIFileComponent | FileBuilder): FileBuilder {
    return new FileBuilder(serializeComponentNode(data));
  }
}

/** Optional divider and small/large vertical spacing. */
export class SeparatorBuilder extends ComponentBuilder<APISeparatorComponent> {
  constructor(data: Partial<APISeparatorComponent> = {}) {
    super({ divider: true, spacing: SeparatorSpacingSize.Small, ...data, type: 14 });
  }
  setDivider(divider = true): this {
    this.data.divider = divider;
    return this;
  }
  setSpacing(spacing: SeparatorSpacingSize): this {
    this.data.spacing = spacing;
    return this;
  }
  static from(data: APISeparatorComponent | SeparatorBuilder): SeparatorBuilder {
    return new SeparatorBuilder(serializeComponentNode(data));
  }
}

/** Groups message components with an optional accent color and spoiler cover. */
export class ContainerBuilder extends ComponentBuilder<APIContainerComponent> {
  constructor(data: Partial<APIContainerComponent> = {}) {
    super({ ...data, type: 17, components: serializeComponentNode(data.components ?? []) });
  }
  setAccentColor(color: number | string | [number, number, number] | null): this {
    const resolved = DataResolver.resolveColor(color);
    if (resolved !== null && (!Number.isInteger(resolved) || resolved < 0 || resolved > 0xffffff))
      throw new RangeError('Invalid accent color');
    this.data.accent_color = resolved;
    return this;
  }
  setSpoiler(spoiler = true): this {
    this.data.spoiler = spoiler;
    return this;
  }
  addTextDisplayComponents(
    ...inputs: (Input<APITextDisplayComponent, TextDisplayBuilder> | string)[]
  ): this {
    this.data.components.push(
      ...inputs.map((input) =>
        typeof input === 'string'
          ? new TextDisplayBuilder(input).toJSON()
          : resolve(input, () => new TextDisplayBuilder()),
      ),
    );
    return this;
  }
  addSectionComponents(...inputs: Input<APISectionComponent, SectionBuilder>[]): this {
    this.data.components.push(...inputs.map((input) => resolve(input, () => new SectionBuilder())));
    return this;
  }
  addMediaGalleryComponents(
    ...inputs: Input<APIMediaGalleryComponent, MediaGalleryBuilder>[]
  ): this {
    this.data.components.push(
      ...inputs.map((input) => resolve(input, () => new MediaGalleryBuilder())),
    );
    return this;
  }
  addFileComponents(...inputs: Input<APIFileComponent, FileBuilder>[]): this {
    this.data.components.push(...inputs.map((input) => resolve(input, () => new FileBuilder())));
    return this;
  }
  addSeparatorComponents(...inputs: Input<APISeparatorComponent, SeparatorBuilder>[]): this {
    this.data.components.push(
      ...inputs.map((input) => resolve(input, () => new SeparatorBuilder())),
    );
    return this;
  }
  addActionRowComponents(...inputs: Input<APIActionRow, ActionRowBuilder>[]): this {
    this.data.components.push(
      ...inputs.map((input) => resolve(input, () => new ActionRowBuilder())),
    );
    return this;
  }
  static from(data: APIContainerComponent | ContainerBuilder): ContainerBuilder {
    return new ContainerBuilder(serializeComponentNode(data));
  }
}
