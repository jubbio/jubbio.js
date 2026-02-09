<p align="center">
  <img src="https://cdn.jubbio.com/assets/logo/jubbio-logo.png" alt="Jubbio" width="70" />
</p>

<h1 align="center">@jubbio/voice</h1>

<p align="center">
  <strong>Voice library for Jubbio bots</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@jubbio/voice"><img src="https://img.shields.io/npm/v/@jubbio/voice?color=blue" alt="npm"></a>
  <a href="https://github.com/jubbio/jubbio.js/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License"></a>
  <img src="https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen" alt="Node.js">
</p>

---

## Installation

```bash
npm install @jubbio/voice
```

## Features

- 🎵 **Audio Playback** - Play local files or stream from URLs
- 📺 **YouTube Support** - Built-in yt-dlp integration
- 🔊 **LiveKit Backend** - High-quality, low-latency audio
- ⏯️ **Playback Controls** - Play, pause, stop, volume
- 📊 **Easy Queue Management** - Build music bots easily

## Quick Start

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
    
    // Join voice channel
    const connection = joinVoiceChannel({
      channelId: voiceChannel,
      guildId: interaction.guildId!,
      adapterCreator: client.voice.adapters.get(interaction.guildId!)!
    });
    
    // Create player and play
    const player = createAudioPlayer();
    const resource = createAudioResourceFromUrl(url);
    
    connection.subscribe(player);
    player.play(resource);
    
    // Handle playback end
    player.on('stateChange', (oldState, newState) => {
      if (newState.status === AudioPlayerStatus.Idle) {
        console.log('Playback finished!');
      }
    });
    
    await interaction.reply('🎵 Now playing!');
  }
});

client.login(process.env.BOT_TOKEN);
```

## API Reference

### joinVoiceChannel(options)

Join a voice channel and return a `VoiceConnection`.

```typescript
const connection = joinVoiceChannel({
  channelId: '123456789',        // Voice channel ID
  guildId: '987654321',          // Guild ID
  adapterCreator: adapter,       // From client.voice.adapters
  selfMute: false,               // Join muted (default: false)
  selfDeaf: false                // Join deafened (default: false)
});
```

### createAudioPlayer(options?)

Create an `AudioPlayer` instance.

```typescript
const player = createAudioPlayer({
  behaviors: {
    noSubscriber: 'pause'  // 'pause' | 'play' | 'stop'
  }
});
```

### createAudioResource(input, options?)

Create an `AudioResource` from a file path.

```typescript
const resource = createAudioResource('/path/to/audio.mp3', {
  metadata: { title: 'My Song' }
});
```

### createAudioResourceFromUrl(url, options?)

Create an `AudioResource` from a URL (YouTube, SoundCloud, etc.).

```typescript
const resource = createAudioResourceFromUrl('https://youtube.com/watch?v=...', {
  metadata: { title: 'YouTube Video' }
});
```

### probeAudioInfo(url)

Get information about an audio URL.

```typescript
const info = await probeAudioInfo('https://youtube.com/watch?v=...');
console.log(info.title);     // Video title
console.log(info.duration);  // Duration in seconds
console.log(info.thumbnail); // Thumbnail URL
```

## Player Controls

```typescript
// Play
player.play(resource);

// Pause
player.pause();

// Resume
player.unpause();

// Stop
player.stop();

// Check status
if (player.state.status === AudioPlayerStatus.Playing) {
  console.log('Currently playing!');
}
```

## Connection Controls

```typescript
// Disconnect
connection.disconnect();

// Destroy (cleanup)
connection.destroy();

// Check status
if (connection.state.status === VoiceConnectionStatus.Ready) {
  console.log('Connected!');
}
```

## Events

### AudioPlayer Events

```typescript
player.on('stateChange', (oldState, newState) => {
  console.log(`${oldState.status} -> ${newState.status}`);
});

player.on('error', (error) => {
  console.error('Player error:', error);
});
```

### VoiceConnection Events

```typescript
connection.on('stateChange', (oldState, newState) => {
  if (newState.status === VoiceConnectionStatus.Disconnected) {
    console.log('Disconnected from voice channel');
  }
});

connection.on('error', (error) => {
  console.error('Connection error:', error);
});
```

## Status Enums

### AudioPlayerStatus

| Status | Description |
|--------|-------------|
| `Idle` | Not playing anything |
| `Buffering` | Loading audio |
| `Playing` | Currently playing |
| `Paused` | Playback paused |
| `AutoPaused` | Paused (no subscribers) |

### VoiceConnectionStatus

| Status | Description |
|--------|-------------|
| `Connecting` | Establishing connection |
| `Ready` | Connected and ready |
| `Disconnected` | Disconnected |
| `Destroyed` | Connection destroyed |
| `Signalling` | Exchanging connection info |

## Requirements

- **Node.js** 18.0.0 or higher
- **FFmpeg** installed and in PATH
- **yt-dlp** installed (for YouTube support)

### Installing Dependencies

```bash
# Ubuntu/Debian
sudo apt install ffmpeg
pip install yt-dlp

# macOS
brew install ffmpeg yt-dlp

# Windows
# Download from ffmpeg.org and yt-dlp GitHub releases
```

## License

MIT © [Jubbio Team](https://jubbio.com)
