const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { REST } = require('../dist/rest/REST');
const { StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('../dist/builders/SelectMenuBuilder');

test('real HTTP sends replayable multipart to the DM channel and JSON defaults to the recipient endpoint', async t => {
  const requests = [];
  const server = createServer(async (request, response) => {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    requests.push({ path: request.url, body, headers: request.headers });
    response.setHeader('Content-Type', 'application/json');
    if (requests.filter(item => item.path === request.url).length === 1) {
      response.writeHead(429, { 'Retry-After': '0.01' }); response.end('{}');
    } else response.end(JSON.stringify({ id: '100', channel_id: '99' }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections?.(); server.close(resolve); }));
  const rest = new REST(`http://127.0.0.1:${server.address().port}`);
  const menu = new StringSelectMenuBuilder().setCustomId('select').addOptions(new StringSelectMenuOptionBuilder().setLabel('A').setValue('a').setDefault());
  const components = [{ type: 1, components: [menu] }];
  await rest.createDMMessageToChannelWithFile('99', { components }, [{ name: 'test.txt', data: Buffer.from('payload-bytes') }]);
  await rest.createDMMessage('4', { components });
  assert.equal(requests.length, 4);
  assert.deepEqual(requests[0].body, requests[1].body);
  assert.match(requests[0].headers['content-type'], /multipart\/form-data; boundary=/);
  assert.ok(requests[0].body.includes(Buffer.from('payload-bytes')));
  assert.ok(!requests[0].body.includes(Buffer.from('recipient_user_id')));
  const json = JSON.parse(requests[3].body);
  assert.equal(json.recipient_user_id, '4');
  assert.equal(json.components[0].components[0].options[0].default, true);
  assert.deepEqual(requests[2].body, requests[3].body);
});
