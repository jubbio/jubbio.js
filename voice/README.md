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
- 📺 **Source-independent inputs** - Readable, async byte iterables, files and HTTP(S) media
- 🔊 **LiveKit Backend** - High-quality, low-latency audio
- ⏯️ **Playback Controls** - Play, pause, stop, volume
- 📊 **Easy Queue Management** - Build music bots easily

## Quick Start

```javascript
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

// Store players per guild
const players = new Map();

function getPlayer(guildId) {
  let player = players.get(guildId);
  if (!player) {
    player = createAudioPlayer();
    players.set(guildId, player);
  }
  return player;
}

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;
  
  if (interaction.commandName === 'play') {
    const url = interaction.options.getString('url', true);
    const voiceChannel = interaction.member?.voice?.channelId;
    
    if (!voiceChannel) {
      return interaction.reply('❌ Join a voice channel first!');
    }
    
    await interaction.deferReply();
    
    try {
      const info = await probeAudioInfo(url);
      
      // Check for existing connection, only join if not connected
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
      const resource = createAudioResourceFromUrl(info.url, { useYtDlp: true });
      player.play(resource);
      
      const minutes = Math.floor(info.duration / 60);
      const seconds = info.duration % 60;
      const durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      
      const embed = new EmbedBuilder()
        .setTitle('🎵 Now Playing')
        .setDescription(`**${info.title}**`)
        .setColor(Colors.Blue)
        .addFields({ name: 'Duration', value: durationStr, inline: true })
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

Create an `AudioResource` from a local file, HTTP(S) media URL, Node Readable or async byte iterable. The bot developer resolves platform pages into media; the player does not search or select a platform.

```typescript
const resource = createAudioResource('/path/to/audio.mp3', {
  metadata: { title: 'My Song' }
});
```

### Streams and formats

```typescript
import { createReadStream } from 'node:fs';
import { createAudioResource, StreamType } from '@jubbio/voice';

// A resolver is supplied by the bot author, for any platform.
const stream = await myResolver.openMedia(platformLink);
player.play(createAudioResource(stream));

// Raw s16le PCM: 48 kHz stereo bypasses FFmpeg entirely.
player.play(createAudioResource(pcmStream, {
  inputType: StreamType.Raw, sampleRate: 48000, numChannels: 2,
}));

// Other input rates/channel counts are resampled to 48 kHz stereo.
player.play(createAudioResource(monoPcmStream, {
  inputType: StreamType.Raw, sampleRate: 44100, numChannels: 1,
}));

player.play(createAudioResource(createReadStream('song.ogg'), { inputType: StreamType.OggOpus }));
player.play(createAudioResource('https://my-cdn.example/audio.m3u8', {
  headers: { Authorization: 'Bearer ' + accessToken },
}));
```

- `Arbitrary`: FFmpeg detects MP3, WAV, AAC, FLAC and other supported media.
- `OggOpus` / `WebmOpus`: containerized Opus byte streams.
- `Opus`: an async iterable or object-mode Readable yielding **one complete Opus packet per item**. Packet boundaries must be preserved. The library frames these packets as Ogg for decoding.
- `Raw`: signed 16-bit little-endian PCM, with `sampleRate` and `numChannels`.

Streams must yield Buffer/Uint8Array chunks. Playback takes ownership of the stream and closes
it on stop, replacement, completion or error. Create a new stream/resource for another play.
For async iterables, upstream cancellation follows the iterator's own return/cleanup behavior.

HTTP(S) URLs may be direct audio or HLS manifests, including signed URLs and custom headers.
The library does not impose a platform host list. Bot authors control which URLs/headers their
resolver accepts. Platform web pages and search terms are not playable media inputs.

### createAudioResourceFromUrl(url, options?)

Create an `AudioResource` from a direct HTTP(S) media URL. Platform page extraction is opt-in through the legacy helper shown below.

```typescript
const resource = createAudioResourceFromUrl('https://youtube.com/watch?v=...', {
  useYtDlp: true, // Optional compatibility helper; requires yt-dlp
  metadata: { title: 'YouTube Video' }
});
```

### probeAudioInfo(url)

Optional yt-dlp metadata helper. Calling it explicitly requires yt-dlp; generic playback does not.

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
- **FFmpeg** for encoded media or PCM resampling (`ffmpegPath` can override PATH).
- Native 48 kHz stereo s16le PCM needs no FFmpeg.
- **yt-dlp** only when explicitly calling `probeAudioInfo` or setting `useYtDlp: true`.

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

## Migration from implicit extraction

Plain strings are file paths or media URLs, never automatic YouTube searches. Existing code
that passes a platform page must supply its own resolved stream/URL, or explicitly opt into
`createAudioResourceFromUrl(pageUrl, { useYtDlp: true })`. The compatibility helper is separate
from the generic player and is not required for any other input.

## Development checks

The RTC runtime is pinned to `@livekit/rtc-node` 1.2.1. Install optional dependencies as well:
they contain the native bindings for the deployment platform. Native verification on one
operating system does not replace testing on the production operating system.

Run `npm test` and `npm run build` from `voice/`. The regression tests use Node.js 22 or newer.
The FFmpeg integration test runs when FFmpeg is installed; other tests replace the process and
LiveKit boundaries. The native player regression test verifies recovery after a source failure without joining a room.
These checks do not require network access or credentials.

Gateway adapters must forward only the connected bot's own voice-state updates. Update
`@jubbio/core` together with this package to include its voice-event filtering and adapter cleanup.
For multiple bot clients in one process, use `getVoiceConnection(guildId, adapterCreator)` to
select the client's connection explicitly.

Playback keeps a bounded native audio queue. Pausing stops reading decoded audio rather than
discarding it; a short amount of audio already queued natively can still play. Replacing a resource
does not emit an intermediate `Idle` event. Natural completion and `stop()` still do.
A replacement waits for any pending native capture to settle before submitting its first frame,
including replacements started by an error/Idle handler.

## License

MIT © [Jubbio Team](https://jubbio.com)
