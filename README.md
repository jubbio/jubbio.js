<p align="center">
  <img src="https://jubbio.com/logo.png" alt="Jubbio" width="200" />
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
  <a href="#-documentation">Documentation</a>
</p>

---

## 📦 Packages

| Package | Description | Version |
|---------|-------------|---------|
| [@jubbio/core](./core) | Core bot library - gateway, REST API, structures | ![npm](https://img.shields.io/npm/v/@jubbio/core?color=blue) |
| [@jubbio/voice](./voice) | Voice support - audio playback, LiveKit integration | ![npm](https://img.shields.io/npm/v/@jubbio/voice?color=blue) |

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
    GatewayIntentBits.GuildMessages
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

### Music Bot

```typescript
import { Client, GatewayIntentBits } from '@jubbio/core';
import { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResourceFromUrl,
  AudioPlayerStatus 
} from '@jubbio/voice';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;
  
  if (interaction.commandName === 'play') {
    const url = interaction.options.getString('url', true);
    const voiceChannel = interaction.member?.voice?.channelId;
    
    if (!voiceChannel) {
      return interaction.reply('❌ Join a voice channel first!');
    }
    
    const connection = joinVoiceChannel({
      channelId: voiceChannel,
      guildId: interaction.guildId!,
      adapterCreator: client.voice.adapters.get(interaction.guildId!)!
    });
    
    const player = createAudioPlayer();
    const resource = createAudioResourceFromUrl(url);
    
    connection.subscribe(player);
    player.play(resource);
    
    await interaction.reply('🎵 Now playing!');
  }
});

client.login(process.env.BOT_TOKEN);
```

## ✨ Features

### @jubbio/core
- 🔌 **WebSocket Gateway** - Real-time events with auto-reconnection
- 🌐 **REST API Client** - Full API coverage with rate limiting
- ⚡ **Slash Commands** - Easy interaction handling
- 📦 **Builders** - EmbedBuilder, ButtonBuilder, SelectMenuBuilder, ModalBuilder
- 🔄 **Collectors** - Message and interaction collectors
- 🎯 **Sharding** - Multi-process support for large bots
- 📝 **TypeScript** - Full type definitions included

### @jubbio/voice
- 🎵 **Audio Playback** - Play local files or stream from URLs
- 📺 **YouTube Support** - Built-in yt-dlp integration
- 🔊 **LiveKit Backend** - High-quality, low-latency audio
- ⏯️ **Playback Controls** - Play, pause, stop, volume
- 📊 **Queue Management** - Easy to implement music queues

## 📁 Examples

Check out the [examples](./examples) folder for complete bot implementations:

- **Music Bot** - Full-featured music bot with queue, skip, stop
- **Moderation Bot** - Auto-mod, warnings, bans, mutes
- **Support Bot** - Ticket system with categories and claiming

## 📖 Documentation

### Client Options

```typescript
const client = new Client({
  intents: [...],           // Required gateway intents
  shards: [0, 1],           // Optional: [shard_id, total_shards]
  gatewayUrl: 'ws://...',   // Optional: Custom gateway URL
  apiUrl: 'http://...'      // Optional: Custom API URL
});
```

### Gateway Intents

```typescript
GatewayIntentBits.Guilds              // Guild events
GatewayIntentBits.GuildMembers        // Member events
GatewayIntentBits.GuildMessages       // Message events
GatewayIntentBits.GuildVoiceStates    // Voice state events
GatewayIntentBits.MessageContent      // Message content access
```

### Events

| Event | Description |
|-------|-------------|
| `ready` | Bot is connected and ready |
| `messageCreate` | New message received |
| `interactionCreate` | Slash command or component interaction |
| `guildCreate` | Bot joined a guild |
| `guildDelete` | Bot left a guild |
| `voiceStateUpdate` | Voice state changed |
| `error` | Error occurred |

## 🛠️ Requirements

- **Node.js** 18.0.0 or higher
- **FFmpeg** (for voice support)
- **yt-dlp** (for YouTube playback)

## 📄 License

MIT © [Jubbio Team](https://jubbio.com)

---

<p align="center">
  Made with ❤️ for the Jubbio community
</p>
