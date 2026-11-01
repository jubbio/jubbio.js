<p align="center">
  <img src="https://cdn.jubbio.com/assets/logo/jubbio-logo.png" alt="Jubbio" width="70" />
</p>

<h1 align="center">@jubbio/core</h1>

<p align="center">
  <strong>Core bot library for Jubbio platform</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@jubbio/core"><img src="https://img.shields.io/npm/v/@jubbio/core?color=blue" alt="npm"></a>
  <a href="https://github.com/jubbio/jubbio.js/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License"></a>
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen" alt="Node.js">
</p>

---

## Installation

```bash
npm install @jubbio/core
```

## Quick Start

```typescript
import { Client, GatewayIntentBits } from '@jubbio/core';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.on('ready', () => {
  console.log(`✅ ${client.user?.username} is online!`);
});

client.on('messageCreate', async (message) => {
  if (message.content === '!ping') {
    await message.reply('🏓 Pong!');
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;
  
  if (interaction.commandName === 'hello') {
    await interaction.reply('Hello! 👋');
  }
});

client.login(process.env.BOT_TOKEN);
```

## Features

- 🔌 **WebSocket Gateway** - Real-time events with auto-reconnection
- 🌐 **REST API Client** - Full API coverage
- ⚡ **Slash Commands** - Easy interaction handling
- 📦 **Builders** - Embed, Button, SelectMenu, Modal builders
- 🔄 **Collectors** - Message and interaction collectors
- 🎯 **Sharding** - Multi-process support for large bots
- 📝 **TypeScript** - Full type definitions

## Client Options

```typescript
const client = new Client({
  intents: [...],           // Required gateway intents
  shards: [0, 1],           // Optional: [shard_id, total_shards]
  gatewayUrl: 'ws://...',   // Optional: Custom gateway URL
  apiUrl: 'http://...'      // Optional: Custom API URL
});
```

## Gateway Intents

```typescript
GatewayIntentBits.Guilds              // Guild events
GatewayIntentBits.GuildMembers        // Member events  
GatewayIntentBits.GuildMessages       // Message events
GatewayIntentBits.GuildVoiceStates    // Voice state events
GatewayIntentBits.MessageContent      // Message content access
```

## Events

| Event | Description |
|-------|-------------|
| `ready` | Bot is connected and ready |
| `messageCreate` | New message received |
| `messageUpdate` | Message was edited |
| `messageDelete` | Message was deleted |
| `messageDeleteBulk` | Multiple messages deleted |
| `interactionCreate` | Slash command or component interaction |
| `guildCreate` | Bot joined a guild |
| `guildUpdate` | Guild was updated |
| `guildDelete` | Bot left a guild |
| `guildMemberAdd` | Member joined a guild |
| `guildMemberUpdate` | Member was updated |
| `guildMemberRemove` | Member left a guild |
| `channelCreate` | Channel was created |
| `channelUpdate` | Channel was updated |
| `channelDelete` | Channel was deleted |
| `roleCreate` | Role was created |
| `roleUpdate` | Role was updated |
| `roleDelete` | Role was deleted |
| `voiceStateUpdate` | Voice state changed |
| `typingStart` | User started typing |
| `error` | Error occurred |
| `debug` | Debug information |
| `raw` | Raw gateway event (unhandled events) |

## Builders

### Components V2

Text, sections, containers, galleries, thumbnails, file cards and separators can be combined with existing embeds and controls. See [Components V2](./COMPONENTS_V2.md) for builders, examples, protocol limits, deployment prerequisites.

### EmbedBuilder

```typescript
import { EmbedBuilder, Colors } from '@jubbio/core';

const embed = new EmbedBuilder()
  .setTitle('Hello!')
  .setDescription('This is an embed')
  .setColor(Colors.Blue)
  .addFields(
    { name: 'Field 1', value: 'Value 1', inline: true },
    { name: 'Field 2', value: 'Value 2', inline: true }
  )
  .setFooter({ text: 'Footer text' })
  .setTimestamp();

await message.reply({ embeds: [embed] });
```

### ButtonBuilder

```typescript
import { ButtonBuilder, ButtonStyle, ActionRowBuilder } from '@jubbio/core';

const button = new ButtonBuilder()
  .setCustomId('my-button')
  .setLabel('Click me!')
  .setStyle(ButtonStyle.Primary);

const row = new ActionRowBuilder().addComponents(button);

await interaction.reply({ components: [row] });
```

### SlashCommandBuilder

```typescript
import { SlashCommandBuilder } from '@jubbio/core';

const command = new SlashCommandBuilder()
  .setName('greet')
  .setDescription('Greet a user')
  .addUserOption(option =>
    option.setName('user')
      .setDescription('User to greet')
      .setRequired(true)
  );
```

## Interaction updates, select menus and DMs

`isSelectMenu()` recognizes string (3), user (5), role (6), mentionable (7) and channel (8) selects. `isStringSelectMenu()` only matches type 3. The original `componentType` and selected `values` are preserved.

Buttons, selects and modals opened from a message support `update(options)` and `deferUpdate()`. A command-opened modal has no source message and must use `reply()` or `deferReply()`. Initial acknowledgement is allowed once, including `showModal()`.

```typescript
client.on('interactionCreate', async interaction => {
  if (!interaction.isModalSubmit() || !interaction.message) return;
  await interaction.deferUpdate();
  await interaction.editReply({ content: 'Saved', components: [] });
});
```

Deploy message-service (the additive protobuf patch field) first, then apply community-service migrations `000059_interaction_message_ephemeral` and `000060_interaction_response_flags` and deploy community-service and the web client. Public message edits persist in storage; ephemeral source updates remain private and are sent through interaction events.

`deferReply({ ephemeral: true })` fixes the visibility of the original reply. Subsequent `editReply()` calls use the interaction webhook and remain private; follow-ups choose their own visibility independently. The backend stores initial response flags so deferred private replies are never persisted as public messages. Apply migration `000060_interaction_response_flags` before deploying that backend change.

This modal flow requires the accompanying backend and web client changes: the client sends the opening interaction ID and the server validates its user, application, channel, guild and expiration before associating the source message. Message edits preserve omitted fields; explicit empty arrays clear embeds/components.

```typescript
await user.send({ content: 'Hello', components: [row] });
await dmChannel.send({ files: [{ name: 'hello.txt', data: Buffer.from('Hello') }] });
await client.rest.createDMMessage(userId, { content: 'Hello' });
await client.rest.createDMMessageToChannel(channelId, { content: 'Hello' });
await client.rest.createDMMessageToChannelWithFile(channelId, {}, files);
```

`DMChannel.send()` always targets the channel; it does not require `recipientId`. Both `User.send()` and `followUp()` accept nested component builders without mutating caller-owned rows.

String select options accept raw objects or `StringSelectMenuOptionBuilder`. Use `setDefault(true)` (wire field `option.default`); the web client applies defaults initially and on message edits. No extra menu-level `value/values` fields are needed.

`EmbedBuilder.setFooter()` and `setAuthor()` accept both `iconURL` and `icon_url`. If both are supplied, `iconURL` takes precedence. Pass `null` to clear the footer/author.

## REST rate limits and diagnostics

JSON and buffered multipart requests share the same transport. HTTP 429 retries at most three times (four total attempts), respecting server `retry_after` seconds or `Retry-After` seconds/HTTP date. Global cooldowns apply to all routes on the REST instance; route cooldowns apply to the matching method and route. Multipart retries reuse the exact bytes and boundary. Other HTTP and network errors are surfaced without automatic retries.

After retry exhaustion, `RateLimitError.retryAfter` is in milliseconds. REST request logs are disabled by default; set `DEBUG_REST=1` for diagnostics. Request diagnostics omit message bodies and redact interaction tokens.

Run regression tests from `core/` with `npm test` (builds before running).

## Voice Support

Use with `@jubbio/voice` for voice channel support:

```typescript
import { Client, GatewayIntentBits } from '@jubbio/core';
import { joinVoiceChannel, createAudioPlayer } from '@jubbio/voice';

// See @jubbio/voice documentation for full voice support
```

## REST API

Access the REST API via `client.rest`:

### Messages

```javascript
// Send message
await client.rest.createMessage(guildId, channelId, {
  content: 'Hello!',
  embeds: [embed]
});

// Edit message
await client.rest.editMessage(guildId, channelId, messageId, {
  content: 'Updated!'
});

// Delete message
await client.rest.deleteMessage(guildId, channelId, messageId);

// Bulk delete messages
await client.rest.bulkDeleteMessages(guildId, channelId, messageIds);

// Get messages
const messages = await client.rest.getMessages(guildId, channelId, {
  limit: 50,
  before: messageId
});

// Add reaction
await client.rest.addReaction(guildId, channelId, messageId, '👍');

// Pin/Unpin message
await client.rest.pinMessage(guildId, channelId, messageId);
await client.rest.unpinMessage(guildId, channelId, messageId);
await client.rest.getPinnedMessages(guildId, channelId);
```

### Members

```javascript
// Get member
const member = await client.rest.getMember(guildId, userId);

// Timeout member (duration in seconds, null to remove)
await client.rest.timeoutMember(guildId, userId, 3600, 'Spam');

// Kick member
await client.rest.kickMember(guildId, userId, 'Rule violation');

// Ban member
await client.rest.banMember(guildId, userId, {
  deleteMessageDays: 7,
  reason: 'Severe violation'
});

// Unban member
await client.rest.unbanMember(guildId, userId);

// Edit member
await client.rest.editMember(guildId, userId, {
  nick: 'New Nickname',
  roles: ['roleId1', 'roleId2']
});

// Add/Remove role
await client.rest.addMemberRole(guildId, userId, roleId);
await client.rest.removeMemberRole(guildId, userId, roleId);
```

### Roles

```javascript
// Get roles
const roles = await client.rest.getRoles(guildId);

// Create role
const role = await client.rest.createRole(guildId, {
  name: 'New Role',
  color: 0xFF0000,
  permissions: '8'
});

// Edit role
await client.rest.editRole(guildId, roleId, {
  name: 'Updated Role',
  color: 0x00FF00
});

// Delete role
await client.rest.deleteRole(guildId, roleId);
```

### Channels

```javascript
// Get guild channels
const channels = await client.rest.getGuildChannels(guildId);

// Create channel
const channel = await client.rest.createChannel(guildId, {
  name: 'new-channel',
  type: 0, // 0 = text, 2 = voice
  parent_id: categoryId
});

// Delete channel
await client.rest.deleteChannel(guildId, channelId);

// Edit channel permissions
await client.rest.editChannelPermissions(channelId, roleOrUserId, {
  allow: '1024',
  deny: '2048',
  type: 0 // 0 = role, 1 = member
});
```

### Threads

```javascript
// Create thread from message
await client.rest.createThreadFromMessage(guildId, channelId, messageId, {
  name: 'Discussion',
  auto_archive_duration: 1440
});

// Create thread
await client.rest.createThread(guildId, channelId, {
  name: 'New Thread',
  type: 11 // 11 = public, 12 = private
});

// Join/Leave thread
await client.rest.joinThread(threadId);
await client.rest.leaveThread(threadId);
```

### Guild

```javascript
// Get guild info
const guild = await client.rest.getGuild(guildId);

// Get bans
const bans = await client.rest.getBans(guildId);
const ban = await client.rest.getBan(guildId, userId);

// Get emojis
const emojis = await client.rest.getEmojis(guildId);

// Get invites
const invites = await client.rest.getGuildInvites(guildId);
```

### Invites

```javascript
// Create invite
const invite = await client.rest.createInvite(guildId, channelId, {
  max_age: 86400,
  max_uses: 10
});

// Get invite
const inviteInfo = await client.rest.getInvite(inviteCode);

// Delete invite
await client.rest.deleteInvite(inviteCode);
```

### Users

```javascript
// Get user
const user = await client.rest.getUser(userId);

// Get current bot user
const botUser = await client.rest.getCurrentUser();
```

### Slash Commands

```javascript
// Register global commands
await client.rest.registerGlobalCommands([
  { name: 'ping', description: 'Pong!' },
  { name: 'help', description: 'Show help' }
]);

// Register guild commands (instant, for testing)
await client.rest.registerGuildCommands(guildId, commands);

// Delete global command
await client.rest.deleteGlobalCommand(commandId);
```

### Webhooks

```javascript
// Get channel webhooks
const webhooks = await client.rest.getChannelWebhooks(guildId, channelId);

// Create webhook
const webhook = await client.rest.createWebhook(guildId, channelId, {
  name: 'My Webhook'
});
```

## License

MIT © [Jubbio Team](https://jubbio.com)
