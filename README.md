<p align="center">
  <img src="https://cdn.jubbio.com/assets/logo/jubbio-logo.png" alt="Jubbio" width="70" />
</p>

<h1 align="center">jubbio.js</h1>

<p align="center">
  <strong>Official JavaScript/TypeScript SDK for building Jubbio bots</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@jubbio/core"><img src="https://img.shields.io/npm/v/@jubbio/core?color=blue&label=%40jubbio%2Fcore" alt="npm @jubbio/core"></a>
  <a href="https://www.npmjs.com/package/@jubbio/voice"><img src="https://img.shields.io/npm/v/@jubbio/voice?color=blue&label=%40jubbio%2Fvoice" alt="npm @jubbio/voice"></a>
  <a href="https://github.com/jubbio/jubbio.js/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License"></a>
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen" alt="Node.js">
</p>

<p align="center">
  <a href="#-packages">Packages</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-features">Features</a> •
  <a href="#-examples">Examples</a> •
  <a href="#-api-reference">API Reference</a>
</p>

---

## 📦 Packages

| Package | Description | Version |
|---------|-------------|---------|
| [@jubbio/core](./core) | Core bot library - gateway, REST API, structures, builders | ![npm](https://img.shields.io/npm/v/@jubbio/core?color=blue) |
| [@jubbio/voice](./voice) | Voice support - audio playback with LiveKit backend | ![npm](https://img.shields.io/npm/v/@jubbio/voice?color=blue) |

## 🚀 Quick Start

### Installation

```bash
# Core library (required)
npm install @jubbio/core

# Voice support (optional)
npm install @jubbio/voice
```

### Basic Bot

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

## ✨ Features

### @jubbio/core

- 🔌 **WebSocket Gateway** - Real-time events with auto-reconnection
- 🌐 **REST API Client** - Full API coverage with rate limiting
- ⚡ **Slash Commands** - Easy interaction handling with ApplicationCommandManager
- 📦 **Builders** - EmbedBuilder, ButtonBuilder, SelectMenuBuilder, ModalBuilder, SlashCommandBuilder
- 🔄 **Collectors** - Message, interaction, and reaction collectors
- 🎯 **Sharding** - Multi-process support for large bots
- 🔧 **Utilities** - Formatters, BitField, PermissionsBitField, emoji utilities
- 📝 **TypeScript** - Full type definitions included

### @jubbio/voice

- 🎵 **Audio Playback** - Play local files or stream from URLs
- 📺 **YouTube Support** - Built-in yt-dlp integration with `probeAudioInfo`
- 🔊 **LiveKit Backend** - High-quality, low-latency audio
- ⏯️ **Playback Controls** - Play, pause, stop, volume control
- 📊 **State Management** - Track player and connection status

## 📁 Examples

### Sending Embeds

```typescript
import { EmbedBuilder, Colors } from '@jubbio/core';

const embed = new EmbedBuilder()
  .setTitle('Hello World')
  .setDescription('This is an embed')
  .setColor(Colors.Blue)
  .setFooter({ text: 'Footer text', iconURL: 'https://example.com/icon.png' })
  .setTimestamp()
  .addFields(
    { name: 'Field 1', value: 'Value 1', inline: true },
    { name: 'Field 2', value: 'Value 2', inline: true }
  );

await message.reply({ embeds: [embed] });
```

You can also use color names directly:

```typescript
embed.setColor('Red');    // Color name
embed.setColor('Random'); // Random color
embed.setColor(0x5865f2); // Hex number
embed.setColor('#5865f2'); // Hex string
embed.setColor([88, 101, 242]); // RGB array
```

### Building Components

```typescript
import { 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  StringSelectMenuBuilder 
} from '@jubbio/core';

// Button row
const buttonRow = new ActionRowBuilder()
  .addComponents(
    new ButtonBuilder()
      .setCustomId('primary')
      .setLabel('Click me')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('danger')
      .setLabel('Delete')
      .setStyle(ButtonStyle.Danger)
  );

// Select menu row
const selectRow = new ActionRowBuilder()
  .addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('select')
      .setPlaceholder('Choose an option')
      .addOptions([
        { label: 'Option 1', value: 'opt1', description: 'First option' },
        { label: 'Option 2', value: 'opt2', description: 'Second option' }
      ])
  );

await interaction.reply({ 
  content: 'Choose:', 
  components: [buttonRow, selectRow] 
});
```

### Slash Command Registration

```typescript
import { SlashCommandBuilder } from '@jubbio/core';

const command = new SlashCommandBuilder()
  .setName('greet')
  .setDescription('Greet a user')
  .addUserOption(option =>
    option.setName('user')
      .setDescription('User to greet')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('message')
      .setDescription('Custom message')
      .setRequired(false)
  );

// Register globally
await client.application.commands.set([command]);

// Or register to a specific guild
const guild = client.guilds.get('guildId');
await guild?.commands.set([command]);
```

### Handling Interactions

```typescript
client.on('interactionCreate', async (interaction) => {
  if (interaction.isCommand()) {
    if (interaction.commandName === 'greet') {
      const user = interaction.options.getUser('user', true);
      const message = interaction.options.getString('message') || 'Hello!';
      await interaction.reply(`${message} ${user}`);
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId === 'primary') {
      await interaction.update({ content: 'Button clicked!' });
    }
  }

  if (interaction.isSelectMenu()) {
    await interaction.reply(`You selected: ${interaction.values.join(', ')}`);
  }

  if (interaction.isAutocomplete()) {
    const focused = interaction.options.getFocused();
    const choices = ['apple', 'banana', 'cherry']
      .filter(c => c.startsWith(focused))
      .map(c => ({ name: c, value: c }));
    await interaction.respond(choices);
  }

  if (interaction.isModalSubmit()) {
    const value = interaction.fields.getTextInputValue('input_id');
    await interaction.reply(`You submitted: ${value}`);
  }
});
```

### Using Modals

```typescript
import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from '@jubbio/core';

const modal = new ModalBuilder()
  .setCustomId('feedback_modal')
  .setTitle('Feedback Form');

const input = new TextInputBuilder()
  .setCustomId('feedback_input')
  .setLabel('Your feedback')
  .setStyle(TextInputStyle.Paragraph)
  .setPlaceholder('Enter your feedback here...')
  .setRequired(true);

const row = new ActionRowBuilder().addComponents(input);
modal.addComponents(row);

await interaction.showModal(modal);
```

### Using Collectors

```typescript
import { MessageCollector, InteractionCollector } from '@jubbio/core';

// Message collector - requires channelId as second parameter
const collector = new MessageCollector(client, channelId, {
  filter: (msg) => msg.author.id === userId,
  max: 5,
  time: 30000
});

collector.on('collect', (msg) => {
  console.log(`Collected: ${msg.content}`);
});

collector.on('end', (collected, reason) => {
  console.log(`Collected ${collected.size} messages. Reason: ${reason}`);
});
```

### Using Formatters

```typescript
import { 
  userMention, 
  channelMention, 
  roleMention, 
  bold, 
  italic, 
  codeBlock,
  time,
  TimestampStyles 
} from '@jubbio/core';

const content = `
  Hello ${userMention('123456789')}!
  Check out ${channelMention('987654321')}.
  You have the ${roleMention('111222333')} role.
  
  ${bold('Important:')} ${italic('Please read the rules.')}
  
  ${codeBlock('console.log("Hello!");', 'javascript')}
  
  Event starts ${time(new Date(), TimestampStyles.RelativeTime)}
`;
```

### Music Bot

```typescript
import { Client, GatewayIntentBits, EmbedBuilder, Colors } from '@jubbio/core';
import { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResourceFromUrl,
  probeAudioInfo,
  getVoiceConnection,
  AudioPlayerStatus 
} from '@jubbio/voice';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const players = new Map();

function getPlayer(guildId) {
  let player = players.get(guildId);
  if (!player) {
    player = createAudioPlayer();
    players.set(guildId, player);
    
    player.on('stateChange', (oldState, newState) => {
      if (newState.status === AudioPlayerStatus.Idle) {
        console.log('Playback finished');
      }
    });
  }
  return player;
}

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;
  
  if (interaction.commandName === 'play') {
    const query = interaction.options.getString('query', true);
    const voiceChannel = interaction.member?.voice?.channelId;
    
    if (!voiceChannel) {
      return interaction.reply('❌ Join a voice channel first!');
    }
    
    await interaction.deferReply();
    
    try {
      // probeAudioInfo accepts URLs or search queries
      const info = await probeAudioInfo(query);
      
      let connection = getVoiceConnection(interaction.guildId);
      if (!connection) {
        connection = joinVoiceChannel({
          channelId: voiceChannel,
          guildId: interaction.guildId,
          adapterCreator: client.voice.adapters.get(interaction.guildId)
        });
        
        const player = getPlayer(interaction.guildId);
        connection.subscribe(player);
      }
      
      const player = getPlayer(interaction.guildId);
      const resource = createAudioResourceFromUrl(info.url);
      player.play(resource);
      
      const embed = new EmbedBuilder()
        .setTitle('🎵 Now Playing')
        .setDescription(`**${info.title}**`)
        .setColor(Colors.Blue)
        .addFields({ 
          name: 'Duration', 
          value: `${Math.floor(info.duration / 60)}:${(info.duration % 60).toString().padStart(2, '0')}`, 
          inline: true 
        })
        .setTimestamp();
      
      if (info.thumbnail) {
        embed.setThumbnail(info.thumbnail);
      }
      
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply(`❌ Error: ${error.message}`);
    }
  }
});

client.login(process.env.BOT_TOKEN);
```

## 📖 API Reference

### Client Options

```typescript
const client = new Client({
  intents: [...],           // Required: gateway intents
  shards: [0, 1],           // Optional: [shard_id, total_shards]
  gatewayUrl: 'wss://...',  // Optional: custom gateway URL
  apiUrl: 'https://...'     // Optional: custom API URL
});
```

### Client Properties

| Property | Type | Description |
|----------|------|-------------|
| `user` | `User \| null` | The bot user (set after ready) |
| `applicationId` | `string \| null` | Application ID |
| `application` | `{ id, commands }` | Application with commands manager |
| `guilds` | `Collection<string, Guild>` | Cached guilds |
| `channels` | `Collection<string, BaseChannel>` | Cached channels |
| `users` | `Collection<string, User>` | Cached users |
| `rest` | `REST` | REST API client |
| `voice` | `{ adapters: Map }` | Voice adapters for connections |
| `ping` | `number` | WebSocket latency in ms |

### Gateway Intents

```typescript
GatewayIntentBits.Guilds                  // Guild events
GatewayIntentBits.GuildMembers            // Member events (privileged)
GatewayIntentBits.GuildModeration         // Ban/kick events
GatewayIntentBits.GuildEmojisAndStickers  // Emoji events
GatewayIntentBits.GuildIntegrations       // Integration events
GatewayIntentBits.GuildWebhooks           // Webhook events
GatewayIntentBits.GuildInvites            // Invite events
GatewayIntentBits.GuildVoiceStates        // Voice state events
GatewayIntentBits.GuildPresences          // Presence events (privileged)
GatewayIntentBits.GuildMessages           // Message events
GatewayIntentBits.GuildMessageReactions   // Reaction events
GatewayIntentBits.GuildMessageTyping      // Typing events
GatewayIntentBits.DirectMessages          // DM events
GatewayIntentBits.DirectMessageReactions  // DM reaction events
GatewayIntentBits.DirectMessageTyping     // DM typing events
GatewayIntentBits.MessageContent          // Message content (privileged)
GatewayIntentBits.GuildScheduledEvents    // Scheduled events
```

### Events

| Event | Description |
|-------|-------------|
| `ready` | Bot is connected and ready |
| `messageCreate` | New message received |
| `messageUpdate` | Message was edited |
| `messageDelete` | Message was deleted |
| `messageDeleteBulk` | Multiple messages deleted |
| `messageReactionAdd` | Reaction added to a message |
| `messageReactionRemove` | Reaction removed from a message |
| `interactionCreate` | Slash command or component interaction |
| `guildCreate` | Bot joined a guild |
| `guildUpdate` | Guild was updated |
| `guildDelete` | Bot left a guild |
| `guildMemberAdd` | Member joined a guild |
| `guildMemberUpdate` | Member was updated |
| `guildMemberRemove` | Member left a guild |
| `guildBanAdd` | User was banned |
| `guildBanRemove` | User was unbanned |
| `channelCreate` | Channel was created |
| `channelUpdate` | Channel was updated |
| `channelDelete` | Channel was deleted |
| `roleCreate` | Role was created |
| `roleUpdate` | Role was updated |
| `roleDelete` | Role was deleted |
| `inviteCreate` | Invite was created |
| `inviteDelete` | Invite was deleted |
| `voiceStateUpdate` | Voice state changed |
| `voiceServerUpdate` | Voice server info received |
| `presenceUpdate` | Presence changed |
| `typingStart` | User started typing |
| `error` | Error occurred |
| `warn` | Warning (e.g., missing intents) |
| `debug` | Debug information |
| `raw` | Raw gateway event (unhandled events) |

### Interaction Type Guards

```typescript
interaction.isCommand()       // CommandInteraction
interaction.isButton()        // ButtonInteraction
interaction.isSelectMenu()    // SelectMenuInteraction
interaction.isAutocomplete()  // AutocompleteInteraction
interaction.isModalSubmit()   // ModalSubmitInteraction
```

### Exported Classes and Types

#### Core

| Export | Description |
|--------|-------------|
| `Client` | Main bot client |
| `GatewayIntentBits` | Gateway intent flags |
| `REST` | REST API client |
| `RESTError` | Error thrown on API failures |
| `RateLimitError` | Error thrown when rate limited |

#### Structures

| Export | Description |
|--------|-------------|
| `Collection` | Discord.js-compatible Map with utility methods |
| `User` | User structure with DM support |
| `Guild` | Guild structure with member/channel caching |
| `GuildMember` | Guild member with permissions |
| `Message` | Message with reply, edit, delete, react |
| `MessageReaction` | Reaction with remove() |
| `Embed` | Read-only embed with toBuilder() |
| `BaseChannel`, `TextChannel`, `VoiceChannel`, `DMChannel` | Channel types |
| `Interaction`, `CommandInteraction`, `ButtonInteraction`, `SelectMenuInteraction`, `AutocompleteInteraction`, `ModalSubmitInteraction` | Interaction types |

#### Builders

| Export | Description |
|--------|-------------|
| `EmbedBuilder` | Rich embed builder with validation |
| `Colors` | Color constants (Red, Blue, Green, etc.) |
| `ButtonBuilder` | Button component builder |
| `ButtonStyle` | Button styles (Primary, Secondary, Success, Danger, Link) |
| `StringSelectMenuBuilder` | String select menu builder |
| `SelectMenuBuilder` | Alias for StringSelectMenuBuilder |
| `StringSelectMenuOptionBuilder` | Select menu option builder |
| `UserSelectMenuBuilder` | User select menu builder |
| `RoleSelectMenuBuilder` | Role select menu builder |
| `MentionableSelectMenuBuilder` | Mentionable select menu builder |
| `ChannelSelectMenuBuilder` | Channel select menu builder |
| `ActionRowBuilder` | Container for components |
| `ModalBuilder` | Modal dialog builder |
| `TextInputBuilder` | Text input component builder |
| `TextInputStyle` | Text input styles (Short, Paragraph) |
| `SlashCommandBuilder` | Slash command builder |
| `SlashCommandStringOption`, `SlashCommandIntegerOption`, `SlashCommandNumberOption`, `SlashCommandBooleanOption`, `SlashCommandUserOption`, `SlashCommandChannelOption`, `SlashCommandRoleOption`, `SlashCommandMentionableOption`, `SlashCommandAttachmentOption` | Command option builders |
| `SlashCommandSubcommandBuilder`, `SlashCommandSubcommandGroupBuilder` | Subcommand builders |

#### Managers

| Export | Description |
|--------|-------------|
| `ApplicationCommandManager` | Slash commands manager (set, create, fetch, delete, edit) |

#### Collectors

| Export | Description |
|--------|-------------|
| `Collector` | Abstract base collector class |
| `MessageCollector` | Collect messages |
| `InteractionCollector` | Collect interactions |
| `ReactionCollector` | Collect reactions |
| `awaitMessages` | Helper function |
| `awaitReactions` | Helper function |

#### Formatters

| Export | Description |
|--------|-------------|
| `userMention`, `channelMention`, `roleMention` | Mention formatters |
| `formatEmoji` | Custom emoji formatter |
| `bold`, `italic`, `underline`, `strikethrough`, `spoiler` | Text formatters |
| `inlineCode`, `codeBlock` | Code formatters |
| `blockQuote`, `quote` | Quote formatters |
| `hyperlink`, `hideLinkEmbed` | Link formatters |
| `time`, `TimestampStyles` | Timestamp formatters |
| `heading`, `unorderedList`, `orderedList` | List formatters |

#### Utilities

| Export | Description |
|--------|-------------|
| `BitField` | Generic bit field class |
| `PermissionsBitField` | Permissions handling |
| `Permissions` | Alias for PermissionsBitField |
| `PermissionFlags` | Alias for PermissionFlagsBits |
| `unicodeToShortcode`, `normalizeEmoji`, `isUnicodeEmoji`, `isShortcode`, `isCustomEmoji` | Emoji utilities |

#### Sharding

| Export | Description |
|--------|-------------|
| `ShardingManager` | Multi-process bot manager |
| `Shard` | Individual shard instance |
| `ShardClientUtil` | Client-side shard utilities |
| `ShardStatus` | Shard status enum |

### @jubbio/voice Exports

| Export | Description |
|--------|-------------|
| `joinVoiceChannel` | Join a voice channel |
| `getVoiceConnection` | Get existing connection by guild ID |
| `createAudioPlayer` | Create an audio player |
| `createAudioResource` | Create audio resource from URL/path |
| `createAudioResourceFromUrl` | Create from YouTube/streaming URL |
| `probeAudioInfo` | Get title, duration, thumbnail from URL/search |
| `VoiceConnection` | Voice connection class |
| `AudioPlayer` | Audio player class |
| `AudioResource` | Audio resource class |
| `VoiceConnectionStatus` | Connecting, Ready, Disconnected, Destroyed, Signalling |
| `AudioPlayerStatus` | Idle, Buffering, Playing, Paused, AutoPaused |
| `StreamType` | Arbitrary, Raw, Opus, OggOpus, WebmOpus |

## 🛠️ Requirements

- **Node.js** 18.0.0 or higher
- **FFmpeg** (required for voice)
- **yt-dlp** (required for YouTube playback)

## 📄 License

MIT © [Jubbio Team](https://jubbio.com)

---

<p align="center">
  Made with ❤️ for the Jubbio community
</p>
