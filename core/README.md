# @jubbio/core

Official bot library for Jubbio platform. Build powerful bots with an intuitive API.

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
    GatewayIntentBits.GuildVoiceStates
  ]
});

client.on('ready', () => {
  console.log(`Logged in as ${client.user?.username}!`);
});

client.on('messageCreate', async (message) => {
  if (message.content === '!ping') {
    await message.reply('Pong!');
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;
  
  if (interaction.commandName === 'ping') {
    await interaction.reply('Pong!');
  }
});

client.login('YOUR_BOT_TOKEN');
```

## Voice Support

Use with `@jubbio/voice` for voice channel support:

```typescript
import { Client, GatewayIntentBits } from '@jubbio/core';
import { joinVoiceChannel, createAudioPlayer, createAudioResourceFromUrl } from '@jubbio/voice';

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
    const voiceChannel = interaction.member?.voice.channelId;
    
    if (!voiceChannel) {
      return interaction.reply('You need to be in a voice channel!');
    }
    
    // Join voice channel
    const connection = joinVoiceChannel({
      channelId: voiceChannel,
      guildId: interaction.guildId!,
      adapterCreator: client.voice.adapters.get(interaction.guildId!)!
    });
    
    // Create player and play
    const player = createAudioPlayer();
    const resource = createAudioResourceFromUrl(url);
    
    player.play(resource);
    connection.subscribe(player);
    
    await interaction.reply(`Now playing!`);
  }
});

client.login('YOUR_BOT_TOKEN');
```

## API Reference

### Client

The main client class for connecting to the Jubbio gateway.

```typescript
const client = new Client({
  intents: [...],      // Required intents
  shards: [0, 1],      // Optional: [shard_id, num_shards]
  gatewayUrl: '...',   // Optional: Custom gateway URL
  apiUrl: '...'        // Optional: Custom API URL
});
```

#### Events

- `ready` - Emitted when the client is ready
- `messageCreate` - Emitted when a message is created
- `interactionCreate` - Emitted when an interaction is created
- `guildCreate` - Emitted when the bot joins a guild
- `guildDelete` - Emitted when the bot leaves a guild
- `voiceStateUpdate` - Emitted when a voice state changes
- `error` - Emitted on errors
- `debug` - Emitted for debug information

### Structures

Available structures:

- `User` - Represents a user
- `Guild` - Represents a guild
- `GuildMember` - Represents a guild member
- `Message` - Represents a message
- `Interaction` - Base interaction class
- `CommandInteraction` - Slash command interaction
- `AutocompleteInteraction` - Autocomplete interaction
- `Collection` - Extended Map with utility methods

### Enums

- `GatewayIntentBits` - Gateway intents
- `InteractionType` - Interaction types
- `ApplicationCommandType` - Command types
- `ApplicationCommandOptionType` - Option types
- `ChannelType` - Channel types
- `MessageFlags` - Message flags

## Features

- Full gateway connection with automatic reconnection
- REST API client for all endpoints
- Slash commands and interactions support
- Message collectors and reaction collectors
- Sharding support for large bots
- Voice channel integration with `@jubbio/voice`

## License

MIT
