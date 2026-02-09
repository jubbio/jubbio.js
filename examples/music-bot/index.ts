/**
 * Example Music Bot using @jubbio/core and @jubbio/voice
 * 
 * This demonstrates how Discord.js developers can easily create bots for Jubbio
 */

import { Client, GatewayIntentBits } from '../../core/src';
import { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResourceFromUrl,
  probeAudioInfo,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  getVoiceConnection
} from '../../voice/src';

// Configuration
const BOT_TOKEN = process.env.BOT_TOKEN!;

// Create client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates
  ]
});

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
    
    player.on('stateChange', (oldState, newState) => {
      if (newState.status === AudioPlayerStatus.Idle && oldState.status !== AudioPlayerStatus.Idle) {
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

// Play next song
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

// Ready event
client.on('ready', () => {
  console.log(`🎵 Music Bot logged in as ${client.user?.username}!`);
  console.log(`📍 In ${client.guilds.size} guilds`);
});

// Interaction handler
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;
  
  const { commandName, guildId } = interaction;
  
  if (!guildId) {
    return interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
  }
  
  try {
    switch (commandName) {
      case 'play': {
        const url = interaction.options.getString('url', true);
        const voiceChannelId = interaction.member?.voice.channelId;
        
        if (!voiceChannelId) {
          return interaction.reply({ content: '❌ You need to be in a voice channel!', ephemeral: true });
        }
        
        await interaction.deferReply();
        
        // Get song info
        const info = await probeAudioInfo(url);
        
        // Join voice channel if not already
        let connection = getVoiceConnection(guildId);
        if (!connection || connection.state.status === VoiceConnectionStatus.Disconnected) {
          connection = joinVoiceChannel({
            channelId: voiceChannelId,
            guildId: guildId,
            adapterCreator: client.voice.adapters.get(guildId)!
          });
          
          const player = getPlayer(guildId);
          connection.subscribe(player);
        }
        
        // Add to queue
        const song: Song = {
          url,
          title: info.title,
          duration: info.duration,
          requestedBy: interaction.user.id
        };
        
        const queue = queues.get(guildId) || [];
        queue.push(song);
        queues.set(guildId, queue);
        
        // Start playing if idle
        const player = getPlayer(guildId);
        if (player.state.status === AudioPlayerStatus.Idle) {
          playNext(guildId);
        }
        
        await interaction.editReply(`✅ Added to queue: **${song.title}**`);
        break;
      }
      
      case 'skip': {
        const player = getPlayer(guildId);
        player.stop();
        await interaction.reply('⏭️ Skipped!');
        break;
      }
      
      case 'stop': {
        const player = getPlayer(guildId);
        player.stop();
        queues.set(guildId, []);
        
        const connection = getVoiceConnection(guildId);
        connection?.disconnect();
        
        await interaction.reply('⏹️ Stopped and cleared queue!');
        break;
      }
      
      case 'queue': {
        const queue = queues.get(guildId) || [];
        const player = getPlayer(guildId);
        
        if (queue.length === 0 && player.state.status === AudioPlayerStatus.Idle) {
          return interaction.reply('📭 Queue is empty!');
        }
        
        let response = '🎵 **Queue:**\n';
        
        if (player.state.status === AudioPlayerStatus.Playing && player.state.resource) {
          const current = player.state.resource.metadata as Song;
          response += `▶️ **${current.title}**\n\n`;
        }
        
        queue.slice(0, 10).forEach((song, i) => {
          response += `${i + 1}. ${song.title}\n`;
        });
        
        if (queue.length > 10) {
          response += `... and ${queue.length - 10} more`;
        }
        
        await interaction.reply(response);
        break;
      }
      
      case 'pause': {
        const player = getPlayer(guildId);
        if (player.pause()) {
          await interaction.reply('⏸️ Paused!');
        } else {
          await interaction.reply('❌ Nothing is playing!');
        }
        break;
      }
      
      case 'resume': {
        const player = getPlayer(guildId);
        if (player.unpause()) {
          await interaction.reply('▶️ Resumed!');
        } else {
          await interaction.reply('❌ Nothing is paused!');
        }
        break;
      }
      
      default:
        await interaction.reply({ content: 'Unknown command!', ephemeral: true });
    }
  } catch (error) {
    console.error('Command error:', error);
    
    if (interaction.deferred) {
      await interaction.editReply(`❌ Error: ${(error as Error).message}`);
    } else {
      await interaction.reply({ content: `❌ Error: ${(error as Error).message}`, ephemeral: true });
    }
  }
});

// Error handling
client.on('error', (error) => {
  console.error('Client error:', error);
});

// Login
client.login(BOT_TOKEN).catch(console.error);
