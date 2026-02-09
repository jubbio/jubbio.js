/**
 * Test bot - @jubbio/core ve @jubbio/voice paketlerini test eder
 * 
 * Kullanım:
 * BOT_TOKEN=xxx APP_ID=xxx node test-bot.js
 */

// Doğrudan dist klasörlerinden import
const { Client, GatewayIntentBits } = require('./core/dist');
const { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResourceFromUrl,
  probeAudioInfo,
  AudioPlayerStatus,
  getVoiceConnection
} = require('./voice/dist');

const BOT_TOKEN = process.env.BOT_TOKEN;
const APP_ID = process.env.APP_ID;

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN gerekli!');
  process.exit(1);
}

// Client oluştur
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// Queue yönetimi
const queues = new Map();
const players = new Map();

function getPlayer(guildId) {
  let player = players.get(guildId);
  if (!player) {
    player = createAudioPlayer();
    players.set(guildId, player);
    
    player.on('stateChange', (oldState, newState) => {
      console.log(`🎵 Player state: ${oldState.status} -> ${newState.status}`);
      if (newState.status === AudioPlayerStatus.Idle && oldState.status !== AudioPlayerStatus.Idle) {
        playNext(guildId);
      }
    });
    
    player.on('error', (error) => {
      console.error(`❌ Player error:`, error.message);
      playNext(guildId);
    });
  }
  return player;
}

async function playNext(guildId) {
  const queue = queues.get(guildId) || [];
  
  if (queue.length === 0) {
    console.log('📭 Sıra boş');
    return;
  }
  
  const song = queue.shift();
  queues.set(guildId, queue);
  
  console.log(`🎵 Çalınıyor: ${song.title}`);
  
  try {
    const resource = createAudioResourceFromUrl(song.url, {
      metadata: song
    });
    
    const player = getPlayer(guildId);
    player.play(resource);
  } catch (error) {
    console.error(`❌ Çalma hatası:`, error.message);
    playNext(guildId);
  }
}

// Ready event
client.on('ready', () => {
  console.log(`✅ Bot hazır: ${client.user?.username}`);
  console.log(`📍 ${client.guilds.size} guild'de`);
  
  // Slash komutlarını kaydet
  if (APP_ID) {
    registerCommands();
  }
});

// Debug event
client.on('debug', (msg) => {
  if (msg.includes('Dispatch')) {
    console.log(`📨 ${msg}`);
  }
});

// Interaction handler
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;
  
  const { commandName, guildId } = interaction;
  console.log(`📥 Komut: /${commandName}`);
  
  if (!guildId) {
    return interaction.reply({ content: 'Bu komut sadece sunucularda kullanılabilir!', ephemeral: true });
  }
  
  try {
    switch (commandName) {
      case 'ping': {
        await interaction.reply('🏓 Pong!');
        break;
      }
      
      case 'play': {
        const url = interaction.options.getString('url', true);
        const voiceChannelId = interaction.member?.voice?.channelId;
        
        if (!voiceChannelId) {
          return interaction.reply({ content: '❌ Önce bir ses kanalına katılmalısın!', ephemeral: true });
        }
        
        // Hemen yanıt ver, sonra arka planda işle
        await interaction.reply('🔍 Şarkı aranıyor...');
        
        try {
          // Şarkı bilgisi al
          console.log(`🔍 Video bilgisi alınıyor: ${url}`);
          const info = await probeAudioInfo(url);
          console.log(`📝 Başlık: ${info.title}`);
          
          // Ses kanalına katıl
          let connection = getVoiceConnection(guildId);
          if (!connection) {
            console.log(`🎤 Ses kanalına katılınıyor: ${voiceChannelId}`);
            connection = joinVoiceChannel({
              channelId: voiceChannelId,
              guildId: guildId,
              adapterCreator: client.voice.adapters.get(guildId)
            });
            
            const player = getPlayer(guildId);
            connection.subscribe(player);
          }
          
          // Sıraya ekle
          const song = {
            url: info.url,  // probeAudioInfo'dan dönen gerçek YouTube URL'ini kullan
            title: info.title,
            duration: info.duration,
            requestedBy: interaction.user.id
          };
          
          const queue = queues.get(guildId) || [];
          queue.push(song);
          queues.set(guildId, queue);
          
          // Çalmıyorsa başlat
          const player = getPlayer(guildId);
          if (player.state.status === AudioPlayerStatus.Idle) {
            playNext(guildId);
          }
          
          await interaction.editReply(`✅ Sıraya eklendi: **${song.title}**`);
        } catch (playError) {
          console.error('❌ Play hatası:', playError.message);
          try {
            await interaction.editReply(`❌ Hata: ${playError.message}`);
          } catch (editError) {
            console.error('❌ Edit reply hatası:', editError.message);
          }
        }
        break;
      }
      
      case 'skip': {
        const player = getPlayer(guildId);
        player.stop();
        await interaction.reply('⏭️ Atlandı!');
        break;
      }
      
      case 'stop': {
        const player = getPlayer(guildId);
        player.stop();
        queues.set(guildId, []);
        
        const connection = getVoiceConnection(guildId);
        connection?.disconnect();
        
        await interaction.reply('⏹️ Durduruldu!');
        break;
      }
      
      case 'queue': {
        const queue = queues.get(guildId) || [];
        const player = getPlayer(guildId);
        
        if (queue.length === 0 && player.state.status === AudioPlayerStatus.Idle) {
          return interaction.reply('📭 Sıra boş!');
        }
        
        let response = '🎵 **Sıra:**\n';
        
        if (player.state.status === AudioPlayerStatus.Playing && player.state.resource) {
          const current = player.state.resource.metadata;
          response += `▶️ **${current.title}**\n\n`;
        }
        
        queue.slice(0, 10).forEach((song, i) => {
          response += `${i + 1}. ${song.title}\n`;
        });
        
        if (queue.length > 10) {
          response += `... +${queue.length - 10} şarkı`;
        }
        
        await interaction.reply(response);
        break;
      }
      
      default:
        await interaction.reply({ content: 'Bilinmeyen komut!', ephemeral: true });
    }
  } catch (error) {
    console.error('❌ Komut hatası:', error);
    
    const errorMsg = `❌ Hata: ${error.message}`;
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errorMsg);
      } else {
        await interaction.reply({ content: errorMsg, ephemeral: true });
      }
    } catch (replyError) {
      console.error('❌ Hata yanıtı gönderilemedi:', replyError.message);
    }
  }
});

// Slash komutlarını kaydet
async function registerCommands() {
  const commands = [
    { name: 'ping', description: 'Bot yanıt süresini kontrol et' },
    { 
      name: 'play', 
      description: 'YouTube linkinden müzik çal',
      options: [{ name: 'url', description: 'YouTube linki', type: 3, required: true }]
    },
    { name: 'skip', description: 'Şarkıyı atla' },
    { name: 'stop', description: 'Müziği durdur' },
    { name: 'queue', description: 'Sırayı göster' }
  ];
  
  console.log('📝 Slash komutları kaydediliyor...');
  
  try {
    await client.rest.registerGlobalCommands(commands);
    console.log('✅ Komutlar kaydedildi');
  } catch (error) {
    console.error('❌ Komut kayıt hatası:', error.message);
  }
}

// Error handling
client.on('error', (error) => {
  console.error('❌ Client error:', error);
});

// Login
console.log('🔌 Bağlanılıyor...');
client.login(BOT_TOKEN).catch(console.error);
