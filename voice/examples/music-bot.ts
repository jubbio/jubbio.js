/**
 * Example Music Bot using @jubbio/voice
 * 
 * This demonstrates how to build a music bot with Jubbio
 */

import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResourceFromUrl,
  probeAudioInfo,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  getVoiceConnection
} from '../src';

// Simulated bot client (would be @jubbio/core in real usage)
interface BotClient {
  on(event: string, handler: (...args: any[]) => void): void;
  voice: {
    adapters: Map<string, any>;
  };
}

// Queue management
interface Song {
  url: string;
  title: string;
  duration: number;
  requestedBy: string;
}

const queues = new Map<string, Song[]>();
const players = new Map<string, ReturnType<typeof createAudioPlayer>>();

// Get or create player for a guild
function getPlayer(guildId: string) {
  let player = players.get(guildId);
  if (!player) {
    player = createAudioPlayer();
    players.set(guildId, player);
    
    // Handle playback end
    player.on('stateChange', (oldState, newState) => {
      if (newState.status === AudioPlayerStatus.Idle && oldState.status !== AudioPlayerStatus.Idle) {
        // Play next song in queue
        playNext(guildId);
      }
    });
    
    player.on('error', (error) => {
      console.error(`Player error in guild ${guildId}:`, error.message);
      playNext(guildId);
    });
  }
  return player;
}

// Play next song in queue
async function playNext(guildId: string) {
  const queue = queues.get(guildId) || [];
  
  if (queue.length === 0) {
    console.log(`Queue empty for guild ${guildId}`);
    return;
  }
  
  const song = queue.shift()!;
  queues.set(guildId, queue);
  
  console.log(`Now playing: ${song.title}`);
  
  try {
    const resource = createAudioResourceFromUrl(song.url, {
      metadata: song
    });
    
    const player = getPlayer(guildId);
    player.play(resource);
  } catch (error) {
    console.error(`Failed to play ${song.title}:`, error);
    playNext(guildId);
  }
}

// Command handlers
async function handlePlay(
  client: BotClient,
  guildId: string,
  channelId: string,
  voiceChannelId: string,
  url: string,
  userId: string
) {
  // Get or create voice connection
  let connection = getVoiceConnection(guildId);
  
  if (!connection || connection.state.status === VoiceConnectionStatus.Disconnected) {
    connection = joinVoiceChannel({
      channelId: voiceChannelId,
      guildId: guildId,
      adapterCreator: client.voice.adapters.get(guildId)!
    });
    
    // Subscribe player to connection
    const player = getPlayer(guildId);
    connection.subscribe(player);
  }
  
  // Get song info
  const info = await probeAudioInfo(url);
  
  const song: Song = {
    url: url,
    title: info.title,
    duration: info.duration,
    requestedBy: userId
  };
  
  // Add to queue
  const queue = queues.get(guildId) || [];
  queue.push(song);
  queues.set(guildId, queue);
  
  console.log(`Added to queue: ${song.title}`);
  
  // If nothing is playing, start playback
  const player = getPlayer(guildId);
  if (player.state.status === AudioPlayerStatus.Idle) {
    playNext(guildId);
  }
  
  return `Added to queue: **${song.title}**`;
}

function handleSkip(guildId: string) {
  const player = getPlayer(guildId);
  player.stop();
  return 'Skipped!';
}

function handleStop(guildId: string) {
  const player = getPlayer(guildId);
  player.stop();
  queues.set(guildId, []);
  
  const connection = getVoiceConnection(guildId);
  connection?.disconnect();
  
  return 'Stopped and cleared queue!';
}

function handleQueue(guildId: string) {
  const queue = queues.get(guildId) || [];
  const player = getPlayer(guildId);
  
  if (queue.length === 0 && player.state.status === AudioPlayerStatus.Idle) {
    return 'Queue is empty!';
  }
  
  let response = '**Queue:**\n';
  
  // Current song
  if (player.state.status === AudioPlayerStatus.Playing && player.state.resource) {
    const current = player.state.resource.metadata as Song;
    response += `▶️ **${current.title}**\n\n`;
  }
  
  // Upcoming songs
  queue.slice(0, 10).forEach((song, i) => {
    response += `${i + 1}. ${song.title}\n`;
  });
  
  if (queue.length > 10) {
    response += `... and ${queue.length - 10} more`;
  }
  
  return response;
}

function handlePause(guildId: string) {
  const player = getPlayer(guildId);
  if (player.pause()) {
    return 'Paused!';
  }
  return 'Nothing is playing!';
}

function handleResume(guildId: string) {
  const player = getPlayer(guildId);
  if (player.unpause()) {
    return 'Resumed!';
  }
  return 'Nothing is paused!';
}

// Export for use in bot
export {
  handlePlay,
  handleSkip,
  handleStop,
  handleQueue,
  handlePause,
  handleResume
};
