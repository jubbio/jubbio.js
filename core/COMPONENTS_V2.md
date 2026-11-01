# Components V2 for Jubbio

Components V2 is an additive message layout API. Existing embeds, buttons, select menus and stored messages continue to work. The protocol uses the [Discord component type numbers](https://docs.discord.com/developers/components/reference); Jubbio also allows `content` and classic `embeds` alongside the new layouts, and accepts HTTP(S) URLs for file cards.

This requires the updated SDK build, message-service, community-service and web client. The repository changes do not update already installed npm packages; publish/install an updated SDK build before using these exports.

## Builders

| Builder | Type | Main methods |
| --- | --- | --- |
| `ContainerBuilder` | 17 | `setAccentColor`, `setSpoiler`, `addSectionComponents`, `addTextDisplayComponents`, `addActionRowComponents`, `addMediaGalleryComponents`, `addFileComponents`, `addSeparatorComponents` |
| `SectionBuilder` | 9 | `addTextDisplayComponents`, `setButtonAccessory`, `setThumbnailAccessory` |
| `TextDisplayBuilder` | 10 | `setContent` |
| `ThumbnailBuilder` | 11 | `setURL` / `setMedia`, `setDescription`, `setSpoiler` |
| `MediaGalleryBuilder` | 12 | `addItems`, `setItems` |
| `MediaGalleryItemBuilder` | item | `setURL` / `setMedia`, `setDescription`, `setSpoiler` |
| `FileBuilder` | 13 | `setURL` / `setFile`, `setName`, `setSize`, `setSpoiler` |
| `SeparatorBuilder` | 14 | `setDivider`, `setSpacing` |

Component builders support `setId`, `toJSON` and `from`. IDs are optional uint32 values; the server assigns omitted/zero IDs and rejects duplicates. Add methods accept raw JSON, builder instances, or callbacks. Text display add methods also accept strings. Serialization clones nested arrays, media items and accessories without mutating caller-owned objects.

```js
const {
  ContainerBuilder, SectionBuilder, ButtonStyle, EmbedBuilder, MessageFlags
} = require('@jubbio/core');

function panel(count) {
  return new ContainerBuilder()
    .setAccentColor('#84CC16')
    .addSectionComponents(section => section
      .addTextDisplayComponents('## Server panel', `Refreshes: **${count}**`)
      .setButtonAccessory(button => button
        .setCustomId('panel_refresh').setLabel('Refresh').setStyle(ButtonStyle.Primary)))
    .addSeparatorComponents(separator => separator.setDivider(true).setSpacing(1))
    .addTextDisplayComponents('Text, media and controls share the same card.');
}

await channel.send({
  embeds: [new EmbedBuilder().setDescription('Classic embeds still work.')],
  components: [panel(0)],
  flags: MessageFlags.IsComponentsV2
});

let count = 0;
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton() || interaction.customId !== 'panel_refresh') return;
  await interaction.update({ components: [panel(++count)] });
});
```

The SDK infers `MessageFlags.IsComponentsV2` (`32768`) from the supported layout types and combines it with explicit flags and `ephemeral`. The backend independently validates/infer this flag; once enabled on a stored message it cannot be removed. Component-only payloads work in channel/DM sends, replies, follow-ups and edits. `TextDisplay` mentions use the existing mention validation and rendering paths.

## Media and files

Use HTTP(S) URLs or `attachment://filename` references. References resolve against the message's attachment metadata, so the file name must match a file uploaded with that message. Components V2 attachments are displayed through the layout instead of also appearing in the normal attachment grid.

```js
const { FileBuilder, MediaGalleryBuilder } = require('@jubbio/core');

await channel.send({
  components: [new FileBuilder('attachment://report.txt').setName('report.txt')],
  files: [{ name: 'report.txt', data: Buffer.from('Report') }]
});

const gallery = new MediaGalleryBuilder().addItems(
  item => item.setURL('https://cdn.example.com/photo.png').setDescription('Photo'),
  item => item.setURL('https://cdn.example.com/clip.webm').setSpoiler()
);
```

`Thumbnail` is a Section accessory. Galleries contain 1–10 items. File cards support a readable name and byte size. Spoilers hide media/controls until explicitly revealed. The renderer uses Jubbio's markdown/mention renderer and existing button/select handlers; HTTP(S) URLs and explicit attachment references are accepted, while executable/local URL schemes are rejected.

## Limits and placement

- At most 40 total components per message, including accessories and nested controls.
- At most 4000 characters across all TextDisplays in a layout.
- A Section has 1–3 TextDisplays and exactly one button or thumbnail accessory.
- Containers may contain rows, sections, text, galleries, files and separators; Container-in-Container is rejected.
- Action rows keep the existing 5-button or single-select rule.
- Interactive `custom_id` values and explicit component IDs must be unique.
- Separators use `SeparatorSpacingSize.Small` (1) or `Large` (2).

## Availability and deployment

Components V2 is available to all bots without an allowlist or feature environment variables. Existing bot authentication, permissions and component validation still apply.

Deploy in this order:

1. Apply message-service migration `000034_component_layout` and deploy its updated gRPC/storage implementation.
2. Deploy community-service. Apply `000059_interaction_message_ephemeral` and `000060_interaction_response_flags` if not already deployed; the latter preserves deferred reply visibility independently of component source messages.
3. Deploy the updated web client and SDK. Public docs include an interactive preview under `/dev/docs/js/builders#components-v2`.
4. Verify classic embeds and V2 create/read/edit/click/media cases with the test bot.

The new JSONB column stores complete roots in `message_components.layout`; classic rows keep their existing representation. REST, live create/update events, internal gRPC and component interaction source messages all preserve the nested tree. No production settings or npm releases are changed by these source edits.

## Validation

- SDK: `cd core && npm test`.
- Protocol: `cd pkg && go test ./components`.
- Message service: `go test ./internal/models ./internal/handlers ./internal/grpc ./internal/validation`.
- Interaction service: `go test ./internal/interaction/...`.
- Frontend: `test/componentsV2.test.tsx`, public docs example tests, TypeScript and locale validation.
- The optional `TestComponentLayoutPostgres` uses `COMPONENTS_V2_TEST_DSN` pointing only to an isolated localhost `/v2_test` database. It applies the actual migration and exercises GORM JSONB insert/read/update within a rolled-back transaction.

Browser checks cover the public preview at desktop and mobile sizes, local refresh interaction, spoiler reveal and horizontal overflow. The preview does not send bot interactions to the backend.
