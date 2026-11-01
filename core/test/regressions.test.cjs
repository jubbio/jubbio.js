const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { REST } = require('../dist/rest/REST');
const { RESTError, RateLimitError } = require('../dist/rest/errors');
const { createInteraction, SelectMenuInteraction } = require('../dist/structures/Interaction');
const { User } = require('../dist/structures/User');
const { DMChannel } = require('../dist/structures/Channel');
const { EmbedBuilder } = require('../dist/builders/EmbedBuilder');
const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('../dist/builders/SelectMenuBuilder');
const { serializeComponents } = require('../dist/utils/serialize');
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

function fixture(type = 5, componentType = 3, message = { id: '99' }) {
  const calls = [];
  const rest = new Proxy({}, { get: (_, method) => async (...args) => { calls.push({ method, args }); return { id: '100', channel_id: '99' }; } });
  const client = { rest, guilds: new Map(), channels: new Map() };
  const interaction = createInteraction(client, { id: '1', application_id: '2', token: 'secret', type, channel_id: '3', data: { custom_id: 'test', component_type: componentType, values: ['selected'] }, message });
  return { client, calls, interaction };
}
const nested = () => [{ type: 1, components: [{ toJSON: () => ({ type: 2, custom_id: 'button', style: 1 }) }] }];

for (const componentType of [3, 5, 6, 7, 8]) test(`select type ${componentType} is dispatched with its original type`, () => {
  const { interaction } = fixture(3, componentType);
  assert.ok(interaction instanceof SelectMenuInteraction);
  assert.equal(interaction.componentType, componentType);
  assert.equal(interaction.isSelectMenu(), true);
  assert.equal(interaction.isStringSelectMenu(), componentType === 3);
  assert.deepEqual(interaction.values, ['selected']);
});
test('unknown component types remain base interactions', () => assert.equal(fixture(3, 99).interaction.isSelectMenu(), false));
test('modal update serializes builders and acknowledges once', async () => {
  const { interaction, calls } = fixture();
  await interaction.update({ content: '', embeds: [new EmbedBuilder().setTitle('updated')], components: nested() });
  assert.equal(calls[0].args[2].type, 7);
  assert.equal(calls[0].args[2].data.content, '');
  assert.equal(calls[0].args[2].data.embeds[0].title, 'updated');
  assert.equal(calls[0].args[2].data.components[0].components[0].custom_id, 'button');
  assert.equal(interaction.replied, true);
  await assert.rejects(interaction.deferUpdate(), /already/);
  await assert.rejects(interaction.reply('duplicate'), /already/);
  assert.equal(calls.length, 1);
});
test('modal deferUpdate acknowledges with type 6 and rejects duplicate update', async () => {
  const { interaction, calls } = fixture();
  await interaction.deferUpdate();
  assert.equal(interaction.deferred, true);
  assert.equal(calls[0].args[2].type, 6);
  await assert.rejects(interaction.update('duplicate'), /already/);
});
test('editReply after deferUpdate edits the source through the webhook rather than creating a message', async () => {
  const { interaction, calls } = fixture();
  await interaction.deferUpdate();
  await interaction.editReply({ embeds: [], components: [] });
  assert.equal(calls[1].method, 'editInteractionResponse');
  assert.equal(calls[1].args.length, 2);
  assert.deepEqual(calls[1].args[1].components, []);
});
test('command-opened modals cannot update an unrelated message', async () => {
  const { interaction, calls } = fixture(5, 3, undefined);
  // Explicitly omit the message; fixture's default applies to undefined.
  const modal = createInteraction(interaction.client, { id: '1', application_id: '2', type: 5, token: 't', channel_id: '3', data: { custom_id: 'form' } });
  await assert.rejects(modal.update('invalid'), /opened from a message/);
  await assert.rejects(modal.deferUpdate(), /opened from a message/);
  assert.equal(calls.length, 0);
});
test('failed acknowledgement leaves modal retryable', async () => {
  const { interaction, client } = fixture();
  client.rest = { createInteractionResponse: async () => { throw new Error('offline'); } };
  await assert.rejects(interaction.update('x'), /offline/);
  assert.equal(interaction.replied, false);
  assert.equal(interaction.deferred, false);
});
test('showModal acknowledges buttons and select menus', async () => {
  for (const type of [2, 3, 5]) {
    const { interaction, calls } = fixture(3, type);
    await interaction.showModal({ custom_id: 'form', title: 'Form', components: [] });
    assert.equal(interaction.replied, true);
    await assert.rejects(interaction.update('duplicate'), /already/);
    assert.equal(calls.length, 1);
  }
});
test('default select options support raw objects and builders without extra wire fields', () => {
  const menu = new StringSelectMenuBuilder().setCustomId('select').addOptions(
    new StringSelectMenuOptionBuilder().setLabel('A').setValue('a').setDefault(),
    { label: 'B', value: 'b', default: false });
  const wire = JSON.parse(JSON.stringify(menu));
  assert.deepEqual(wire.options, [{ label: 'A', value: 'a', default: true }, { label: 'B', value: 'b', default: false }]);
  assert.equal('values' in wire, false);
});
test('embed footer and author support both icon names, null clearing and camelCase precedence', () => {
  for (const key of ['iconURL', 'icon_url']) {
    const embed = new EmbedBuilder().setFooter({ text: 'F', [key]: 'footer' }).setAuthor({ name: 'A', [key]: 'author' });
    assert.equal(embed.toJSON().footer.icon_url, 'footer');
    assert.equal(embed.toJSON().author.icon_url, 'author');
    assert.equal('iconURL' in embed.toJSON().footer, false);
    embed.setFooter(null).setAuthor(null);
    assert.equal(embed.toJSON().footer, undefined);
    assert.equal(embed.toJSON().author, undefined);
  }
  assert.equal(new EmbedBuilder().setFooter({ text: 'F', iconURL: 'camel', icon_url: 'raw' }).toJSON().footer.icon_url, 'camel');
});
test('nested component serialization does not mutate caller-owned rows', async () => {
  const components = nested(); const original = components[0].components[0];
  Object.freeze(components[0]); Object.freeze(components[0].components);
  assert.equal(serializeComponents(components)[0].components[0].custom_id, 'button');
  assert.equal(components[0].components[0], original);
  const { interaction, client, calls } = fixture();
  await interaction.followUp({ components });
  await new User({ id: '4', username: 'test' }, client).send({ components });
  assert.equal(calls[0].args[1].components[0].components[0].custom_id, 'button');
  assert.equal(calls[1].args[1].components[0].components[0].custom_id, 'button');
});
test('DMChannel sends text, builders and files by channel ID even without recipient metadata', async () => {
  for (const recipient_id of [undefined, '777']) {
    const { client, calls } = fixture();
    const channel = new DMChannel(client, { id: '999', type: 1, recipient_id });
    await channel.send('text');
    await channel.send({ embed: new EmbedBuilder().setTitle('title'), components: nested(), files: [{ name: 'a.txt', data: Buffer.from('bytes') }] });
    assert.equal(calls[0].method, 'createDMMessageToChannel');
    assert.equal(calls[1].method, 'createDMMessageToChannelWithFile');
    assert.equal(calls[1].args[0], '999');
    assert.equal(calls[1].args[1].embeds[0].title, 'title');
    assert.equal(calls[1].args[2][0].data.toString(), 'bytes');
  }
});

const response = (status, body = {}, headers = {}) => new Response(JSON.stringify(body), { status, headers });
test('JSON 429 retries use server delay, and persistent 429 stops after 4 attempts', async () => {
  const rest = new REST('http://local.invalid'); let calls = 0;
  global.fetch = async () => { calls++; return calls === 1 ? response(429, { retry_after: 0.01 }) : response(200, { id: 'ok' }); };
  assert.equal((await rest.createDMMessage('4', { content: 'hi' })).id, 'ok');
  assert.equal(calls, 2);
  calls = 0; global.fetch = async () => { calls++; return response(429, {}, { 'Retry-After': '0.01' }); };
  await assert.rejects(rest.createDMMessage('4', {}), error => error instanceof RateLimitError && error.retryAfter === 10);
  assert.equal(calls, 4);
});
test('multipart uploads replay identical bytes after 429 in all upload methods', async () => {
  const rest = new REST('http://local.invalid'); rest.setToken('1.fixture'); rest.setApplicationId('1');
  const file = { name: 'song.txt', data: Buffer.from('unique-file-bytes') };
  for (const send of [
    () => rest.createDMMessageWithFile('4', { components: nested() }, [file]),
    () => rest.createDMMessageToChannelWithFile('99', { content: 'hi' }, [file]),
    () => rest.uploadAttachment('2', '3', file),
    () => rest.createMessageWithFile('2', '3', { file }),
    () => rest.createFollowup('secret', { files: [file] }),
  ]) {
    const bodies = [], types = [];
    global.fetch = async (_, init) => { bodies.push(init.body); types.push(init.headers['content-type']); return bodies.length === 1 ? response(429, { retry_after: 0.01 }) : response(200); };
    await send();
    assert.equal(bodies.length, 2); assert.ok(Buffer.isBuffer(bodies[0]));
    assert.deepEqual(bodies[0], bodies[1]); assert.equal(types[0], types[1]);
    assert.ok(bodies[1].includes(file.data));
  }
});
test('non-429 and network failures are not retried', async () => {
  let calls = 0; const rest = new REST('http://local.invalid');
  global.fetch = async () => { calls++; return response(403, { error: 'denied' }); };
  await assert.rejects(rest.createDMMessage('4', {}), error => error instanceof RESTError && error.status === 403);
  assert.equal(calls, 1);
  global.fetch = async () => { calls++; throw new Error('network'); };
  await assert.rejects(rest.createDMMessage('4', {}), /network/); assert.equal(calls, 2);
});
test('a global 429 delays another route while a route 429 allows unrelated routes', async () => {
  for (const globalLimit of [true, false]) {
    const rest = new REST('http://local.invalid'); let notify;
    const limited = new Promise(resolve => { notify = resolve; });
    const times = []; let first = true;
    global.fetch = async url => {
      times.push({ url, time: Date.now() });
      if (first) { first = false; notify(); return response(429, { retry_after: 0.06, global: globalLimit }); }
      return response(200);
    };
    const pending = rest.createDMMessage('4', {});
    await limited; await new Promise(resolve => setImmediate(resolve));
    await rest.createDMMessageToChannel('99', {}); await pending;
    const unrelated = times.find(item => item.url.endsWith('/99'));
    assert.ok(globalLimit ? unrelated.time - times[0].time >= 50 : unrelated.time - times[0].time < 50);
  }
});
test('REST is quiet by default, including failed interaction callbacks', async () => {
  const log = console.log, error = console.error, debug = process.env.DEBUG_REST; const logs = [];
  delete process.env.DEBUG_REST; console.log = console.error = (...args) => logs.push(args);
  try {
    global.fetch = async () => response(403);
    await assert.rejects(new REST().createInteractionResponse('1', 'secret', { type: 6 }));
    assert.deepEqual(logs, []);
  } finally { console.log = log; console.error = error; if (debug === undefined) delete process.env.DEBUG_REST; else process.env.DEBUG_REST = debug; }
});
