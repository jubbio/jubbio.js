const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { Client, MessageFlags, TextDisplayBuilder } = require('../dist');
const { createInteraction } = require('../dist/structures/Interaction');
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });
function fixture() {
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push({ url: String(url), method: init.method, body: JSON.parse(init.body || '{}') });
    return new Response('{}', { status: 200 });
  };
  const client = new Client({ intents: [], apiUrl: 'http://local.invalid' });
  client.rest.setToken('2.fixture'); client.rest.setApplicationId('2');
  const interaction = createInteraction(client, { id: '1', application_id: '2', type: 2, token: 'interaction-fixture', guild_id: '3', channel_id: '4', user: { id: '5', username: 'tester' }, data: { name: 'help' } });
  return { interaction, calls };
}
test('deferred private replies edit the webhook and never create a public guild message', async () => {
  const { interaction, calls } = fixture();
  await interaction.deferReply({ ephemeral: true });
  await interaction.editReply('private text');
  await interaction.editReply({ flags: 0, components: [new TextDisplayBuilder('private V2')] });
  assert.equal(interaction.ephemeral, true);
  assert.equal(calls[0].body.data.flags, MessageFlags.Ephemeral);
  for (const call of calls.slice(1)) {
    assert.equal(call.method, 'PATCH');
    assert.match(call.url, /\/interactions\/webhooks\/2\/interaction-fixture\/messages\/@original$/);
    assert.equal(call.body.flags & MessageFlags.Ephemeral, MessageFlags.Ephemeral);
  }
  assert.equal(calls[2].body.flags, MessageFlags.Ephemeral | MessageFlags.IsComponentsV2);
});
test('a followup visibility does not replace the visibility of the original reply', async () => {
  const { interaction, calls } = fixture();
  await interaction.reply({ content: 'private', flags: 64 });
  await interaction.followUp({ content: 'public followup' });
  await interaction.editReply({ content: 'still private' });
  assert.equal(calls[1].body.flags, 0);
  assert.equal(calls[2].method, 'PATCH'); assert.equal(calls[2].body.flags, 64);
});
test('failed defer does not change reply state and can be retried with different visibility', async () => {
  const { interaction } = fixture(); const fetch = global.fetch;
  global.fetch = async () => { throw new Error('offline'); };
  await assert.rejects(interaction.deferReply({ ephemeral: true }), /offline/);
  assert.equal(interaction.deferred, false); assert.equal(interaction.ephemeral, null);
  global.fetch = fetch;
  await interaction.deferReply(); assert.equal(interaction.ephemeral, false);
});
