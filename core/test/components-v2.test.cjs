const { test, afterEach } = require('node:test');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const assert = require('node:assert/strict');
const sdk = require('../dist');
const { REST } = require('../dist/rest/REST');
const { createInteraction } = require('../dist/structures/Interaction');
const { User } = require('../dist/structures/User');
const { Message } = require('../dist/structures/Message');
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

function panel() {
  return new sdk.ContainerBuilder().setAccentColor('#5865F2')
    .addSectionComponents(section => section.addTextDisplayComponents('## Panel', 'Hello <@42>')
      .setButtonAccessory(button => button.setCustomId('refresh').setLabel('Refresh').setStyle(1)))
    .addSectionComponents(section => section.addTextDisplayComponents('Profile').setThumbnailAccessory('https://cdn.jubbio.com/avatar.png'))
    .addSeparatorComponents(separator => separator.setSpacing(sdk.SeparatorSpacingSize.Large))
    .addMediaGalleryComponents(gallery => gallery.addItems(item => item.setURL('https://cdn.jubbio.com/image.png').setDescription('Image'), item => item.setURL('https://cdn.jubbio.com/clip.webm').setSpoiler()))
    .addFileComponents(file => file.setFile('attachment://report.txt'))
    .addActionRowComponents(row => row.addComponents(new sdk.StringSelectMenuBuilder().setCustomId('choice').addOptions({ label: 'A', value: 'a', default: true })));
}
test('all builders and enums are available from the public package', () => {
  for (const name of ['ContainerBuilder', 'SectionBuilder', 'TextDisplayBuilder', 'ThumbnailBuilder', 'MediaGalleryBuilder', 'MediaGalleryItemBuilder', 'FileBuilder', 'SeparatorBuilder']) assert.equal(typeof sdk[name], 'function');
  assert.equal(sdk.MessageFlags.IsComponentsV2, 32768);
  assert.equal(sdk.ComponentType.Container, 17);
  const json = panel().toJSON();
  assert.equal(json.components[0].accessory.custom_id, 'refresh');
  assert.equal(json.components[1].accessory.media.url, 'https://cdn.jubbio.com/avatar.png');
  assert.equal(json.components[3].items[1].spoiler, true);
  assert.equal(json.components[4].file.url, 'attachment://report.txt');
  assert.equal(json.components[5].components[0].options[0].default, true);
});
test('native ESM imports expose the new builders and flags', () => {
  execFileSync(process.execPath, ['--input-type=module', '-e', "import { ContainerBuilder, SectionBuilder, MessageFlags, ComponentType, SeparatorSpacingSize } from './dist/index.js'; if (new ContainerBuilder().addSectionComponents(new SectionBuilder().addTextDisplayComponents('Text').setThumbnailAccessory('https://example.com/a.png')).toJSON().type !== ComponentType.Container || MessageFlags.IsComponentsV2 !== 32768 || SeparatorSpacingSize.Large !== 2) throw new Error('missing ESM exports');"], { cwd: path.resolve(__dirname, '..'), stdio: 'pipe' });
});
test('published TypeScript declarations accept all existing select builders in V2 rows', () => {
  execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--noEmit', '--target', 'ES2022', '--module', 'commonjs', '--moduleResolution', 'node', '--esModuleInterop', '--skipLibCheck', '--strictNullChecks', 'test/components-v2.types.ts'], { cwd: path.resolve(__dirname, '..'), stdio: 'pipe' });
});
test('builder copies and JSON results do not alias caller-owned trees', () => {
  const original = panel().setId(99); const clone = sdk.ContainerBuilder.from(original);
  clone.data.components[0].accessory.label = 'Changed';
  assert.equal(original.toJSON().components[0].accessory.label, 'Refresh');
  const json = original.toJSON(); json.components[0].content = 'Changed';
  assert.equal(original.toJSON().components[0].content, undefined);
  assert.throws(() => original.setAccentColor('invalid'), RangeError);
  assert.throws(() => original.setId(-1), RangeError);
  assert.equal(new sdk.FileBuilder('https://example.com/report.txt').setName('Report').setSize(42).toJSON().size, 42);
  assert.throws(() => new sdk.FileBuilder().setSize(-1), RangeError);
});
function capture() {
  const calls = [];
  global.fetch = async (url, init) => { calls.push({ url, init, json: typeof init.body === 'string' ? JSON.parse(init.body) : undefined }); return new Response(JSON.stringify({ id: '5', channel_id: '3', guild_id: '2' }), { status: 200 }); };
  const rest = new REST('http://local.invalid'); rest.setApplicationId('1'); rest.cacheUser({ id: '42', username: 'user' });
  return { rest, calls, client: { rest, guilds: new Map(), channels: new Map() } };
}
test('REST create, edit, DM and followup infer V2 while preserving flags and mentions', async () => {
  const { rest, calls } = capture();
  const data = { content: 'Hybrid content', embeds: [{ title: 'Classic embed' }], components: [panel()], flags: 4 };
  await rest.createMessage('2', '3', data);
  await rest.editMessage('2', '3', '5', data);
  await rest.createDMMessage('42', data);
  await rest.createDMMessageToChannel('3', data);
  await rest.createFollowup('token', data);
  for (const call of calls) {
    assert.equal(call.json.flags, 32772); assert.equal(call.json.content, 'Hybrid content');
    assert.equal(call.json.embeds[0].title, 'Classic embed');
    assert.equal(call.json.components[0].components[0].accessory.custom_id, 'refresh');
    assert.equal(call.json.mentions.users[0].id, '42');
  }
});
test('interaction reply, followup and update retain explicit and ephemeral flags', async () => {
  const { client, calls } = capture();
  const interaction = createInteraction(client, { id: '7', application_id: '1', type: 3, channel_id: '3', guild_id: '2', token: 'token', data: { component_type: 2, custom_id: 'refresh' }, message: { id: '5', channel_id: '3' } });
  await interaction.reply({ components: [panel()], ephemeral: true, flags: 4 });
  assert.equal(calls[0].json.data.flags, 32768 | 64 | 4);
  await interaction.followUp({ components: [panel()], ephemeral: true, flags: 4 });
  assert.equal(calls[1].json.flags, 32768 | 64 | 4);
  const component = createInteraction(client, { id: '8', application_id: '1', type: 3, channel_id: '3', guild_id: '2', token: 't', data: { component_type: 2 }, message: { id: '5', channel_id: '3' } });
  await component.update({ components: [panel()], flags: 4 });
  assert.equal(calls[2].json.data.flags, 32772);
});
test('component-only callbacks normalize accessory builders and text mentions', async () => {
  const { rest, calls } = capture();
  const raw = { type: 9, components: [new sdk.TextDisplayBuilder('Hello <@42>')], accessory: new sdk.ButtonBuilder().setStyle(1).setCustomId('x').setLabel('X') };
  await rest.createInteractionResponse('7', 'token', { type: 4, data: { components: [raw] } });
  assert.equal(calls[0].json.data.components[0].accessory.custom_id, 'x');
  assert.equal(calls[0].json.data.flags, 32768);
  assert.equal(calls[0].json.data.mentions.users[0].id, '42');
  assert.equal(typeof raw.accessory.toJSON, 'function');
});
test('multipart guild, DM and followup include inferred V2 flags and nested trees', async () => {
  const { rest, calls } = capture(); const file = { name: 'report.txt', data: Buffer.from('report') };
  await rest.createMessageWithFile('2', '3', { components: [panel()], file });
  await rest.createDMMessageToChannelWithFile('3', { components: [panel()] }, [file]);
  await rest.createFollowup('token', { components: [panel()], files: [file], flags: 64 });
  for (const call of calls) { const body = call.init.body.toString(); assert.match(body, /name="flags"/); assert.match(body, /32768|32832/); assert.match(body, /"type":17/); assert.match(body, /"custom_id":"refresh"/); assert.match(body, /report/); }
});
test('User.send and Message.edit preserve layout flags through structure wrappers', async () => {
  const { client, calls } = capture();
  await new User({ id: '42', username: 'user' }, client).send({ components: [panel()], flags: 4 });
  await new Message(client, { id: '5', channel_id: '3', guild_id: '2' }).edit({ components: [panel()], flags: 4 });
  assert.equal(calls[0].json.flags, 32772); assert.equal(calls[1].json.flags, 32772);
});
