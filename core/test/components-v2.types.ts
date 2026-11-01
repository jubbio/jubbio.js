import {
  ActionRowBuilder, ContainerBuilder, SectionBuilder, TextDisplayBuilder, FileBuilder,
  UserSelectMenuBuilder, RoleSelectMenuBuilder, MentionableSelectMenuBuilder, ChannelSelectMenuBuilder,
  MediaGalleryBuilder, MessageFlags, SeparatorSpacingSize, type APIMessageLayoutComponent
} from '../dist';

const rows = [
  new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId('users')),
  new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('roles')),
  new ActionRowBuilder().addComponents(new MentionableSelectMenuBuilder().setCustomId('mentions')),
  new ActionRowBuilder().addComponents(new ChannelSelectMenuBuilder().setCustomId('channels')),
];
const layout: APIMessageLayoutComponent = new ContainerBuilder()
  .addActionRowComponents(...rows)
  .addSectionComponents(new SectionBuilder().addTextDisplayComponents('Text').setThumbnailAccessory('https://example.com/a.png'))
  .addTextDisplayComponents(new TextDisplayBuilder('Text'), text => text.setContent('More'))
  .addFileComponents(file => file.setURL('attachment://report.txt').setName('Report').setSize(42))
  .addMediaGalleryComponents(new MediaGalleryBuilder().addItems(item => item.setURL('https://example.com/photo.png')))
  .addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small))
  .toJSON();
const file = new FileBuilder('https://example.com/report.txt');
void [layout, file, MessageFlags.IsComponentsV2];
