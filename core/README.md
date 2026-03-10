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
