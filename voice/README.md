# @jubbio/voice

Voice library for Jubbio bots. Powered by LiveKit for high-quality audio streaming.

## Installation

```bash
npm install @jubbio/voice
```

## Usage

Simple and intuitive API for voice functionality:

```typescript
import { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource,
  createAudioResourceFromUrl,
  AudioPlayerStatus,
  VoiceConnectionStatus
} from '@jubbio/voice';

// Join a voice channel
const connection = joinVoiceChannel({
  channelId: '123456789',
  guildId: '987654321',
  adapterCreator: client.voice.adapters.get('987654321')
});

// Create an audio player
const player = createAudioPlayer();

// Subscribe the connection to the player
connection.subscribe(player);

// Play a local file
const resource = createAudioResource('/path/to/audio.mp3');
player.play(resource);

// Or play from YouTube (uses yt-dlp)
const ytResource = createAudioResourceFromUrl('https://youtube.com/watch?v=...', {
  useYtDlp: true
});
player.play(ytResource);

// Listen for events
player.on('stateChange', (oldState, newState) => {
  if (newState.status === AudioPlayerStatus.Idle) {
    console.log('Playback finished!');
  }
});

connection.on('stateChange', (oldState, newState) => {
  if (newState.status === VoiceConnectionStatus.Disconnected) {
    console.log('Disconnected from voice channel');
  }
});

// Control playback
player.pause();
player.unpause();
player.stop();

// Disconnect
connection.disconnect();
```

## API Reference

### `joinVoiceChannel(options)`

Join a voice channel and return a `VoiceConnection`.

Options:
- `channelId` - The voice channel ID
- `guildId` - The guild ID
- `adapterCreator` - Gateway adapter creator from your bot client
- `selfMute` - Whether to join muted (default: false)
- `selfDeaf` - Whether to join deafened (default: false)

### `createAudioPlayer(options?)`

Create an `AudioPlayer` instance.

Options:
- `behaviors.noSubscriber` - What to do when no connections are subscribed: `'pause'`, `'play'`, or `'stop'`

### `createAudioResource(input, options?)`

Create an `AudioResource` from a file path or URL.

### `createAudioResourceFromUrl(url, options?)`

Create an `AudioResource` from a streaming URL (YouTube, SoundCloud, etc.).
Automatically uses yt-dlp to extract the audio URL.

Options:
- `useYtDlp` - Whether to use yt-dlp (default: true for streaming URLs)
- `ytDlpPath` - Path to yt-dlp binary (default: 'yt-dlp')
- `metadata` - Custom metadata to attach to the resource

### `probeAudioInfo(url)`

Get information about an audio URL (title, duration, thumbnail).

## Architecture

- Uses LiveKit for real-time audio streaming
- FFmpeg for audio processing and format conversion
- yt-dlp integration for YouTube and streaming services

## Requirements

- Node.js 18+
- FFmpeg installed and in PATH
- yt-dlp installed (for YouTube/streaming support)
- LiveKit server (provided by Jubbio backend)

## License

MIT
