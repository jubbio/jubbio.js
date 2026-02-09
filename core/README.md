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

## License

MIT © [Jubbio Team](https://jubbio.com)
