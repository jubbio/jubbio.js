/**
 * Support Bot - @jubbio/core ile tam fonksiyonel destek botu
 * 
 * Özellikler:
 * - Ticket sistemi (buton ile açma/kapatma)
 * - Destek kategorileri
 * - Ticket claim (yetkili sahiplenme)
 * - Transcript kaydetme
 * - Ticket log kanalı
 * 
 * Kullanım:
 * BOT_TOKEN=xxx APP_ID=xxx node test-support-bot.js
 */

const { Client, GatewayIntentBits } = require('./core/dist');

const BOT_TOKEN = process.env.BOT_TOKEN;
const APP_ID = process.env.APP_ID;

// Konfigürasyon - bunları kendi sunucuna göre ayarla
const CONFIG = {
  // Ticket ayarları
  ticketCategoryId: null,        // Ticket kanallarının oluşturulacağı kategori (null = kategori olmadan)
  logChannelId: null,            // Ticket loglarının gönderileceği kanal
  supportRoleId: null,           // Destek ekibi rolü
  
  // Ticket kategorileri
  categories: [
    { id: 'general', label: '💬 Genel Destek', emoji: '💬', description: 'Genel sorular ve yardım' },
    { id: 'technical', label: '🔧 Teknik Destek', emoji: '🔧', description: 'Teknik sorunlar' },
    { id: 'payment', label: '💳 Ödeme', emoji: '💳', description: 'Ödeme ve fatura sorunları' },
    { id: 'report', label: '🚨 Şikayet', emoji: '🚨', description: 'Kullanıcı şikayetleri' }
  ]
};

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN gerekli!');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers
  ]
});

// Ticket veritabanı (gerçek projede DB kullan)
const tickets = new Map();
let ticketCounter = 1000;

// Interaction lock - aynı interaction'a art arda tıklamayı engeller
const interactionLocks = new Map();
const INTERACTION_LOCK_DURATION = 3000; // 3 saniye

function acquireInteractionLock(interactionId, customId) {
  const key = `${interactionId}:${customId}`;
  const now = Date.now();
  
  // Eski lock'u kontrol et
  const existingLock = interactionLocks.get(key);
  if (existingLock && now - existingLock < INTERACTION_LOCK_DURATION) {
    return false; // Lock hala aktif
  }
  
  // Yeni lock al
  interactionLocks.set(key, now);
  
  // Eski lock'ları temizle (memory leak önleme)
  if (interactionLocks.size > 1000) {
    const cutoff = now - INTERACTION_LOCK_DURATION * 2;
    for (const [k, v] of interactionLocks) {
      if (v < cutoff) interactionLocks.delete(k);
    }
  }
  
  return true;
}

// Yardımcı fonksiyonlar
function generateTicketId() {
  return ++ticketCounter;
}

function getTicketByChannel(channelId) {
  for (const [id, ticket] of tickets) {
    if (ticket.channelId === channelId) return ticket;
  }
  return null;
}

function formatDate(date) {
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
}

// Ready event
client.on('ready', () => {
  console.log(`✅ Destek Botu hazır: ${client.user?.username}`);
  console.log(`📍 ${client.guilds.size} guild'de`);
  
  if (APP_ID) {
    registerCommands();
  }
});

// Interaction handler
client.on('interactionCreate', async (interaction) => {
  try {
    // Cache user for mention resolution (Discord-style <@ID> -> @username)
    if (interaction.user) {
      client.rest.cacheUser(interaction.user);
    }
    // Also cache member if available (has more info)
    if (interaction.member?.user) {
      client.rest.cacheUser(interaction.member.user);
    }
    
    if (interaction.isCommand()) {
      await handleCommand(interaction);
    } else if (interaction.isButton()) {
      await handleButton(interaction);
    } else if (interaction.isSelectMenu()) {
      await handleSelectMenu(interaction);
    }
  } catch (error) {
    console.error('❌ Interaction hatası:', error);
    
    const errorEmbed = {
      title: '❌ Hata',
      description: `Bir hata oluştu: ${error.message}`,
      color: 0xED4245
    };
    
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    } catch (e) {
      console.error('❌ Hata yanıtı gönderilemedi');
    }
  }
});

// Komut handler
async function handleCommand(interaction) {
  const { commandName, guildId } = interaction;
  console.log(`📥 Komut: /${commandName}`);
  
  if (!guildId) {
    return interaction.reply({ 
      embeds: [{
        title: '❌ Hata',
        description: 'Bu komut sadece sunucularda kullanılabilir!',
        color: 0xED4245
      }],
      ephemeral: true 
    });
  }
  
  switch (commandName) {
    case 'ticket-setup':
      await setupTicketPanel(interaction);
      break;
      
    case 'ticket-close':
      await closeTicket(interaction);
      break;
      
    case 'ticket-add':
      await addUserToTicket(interaction);
      break;
      
    case 'ticket-remove':
      await removeUserFromTicket(interaction);
      break;
      
    case 'ticket-claim':
      await claimTicket(interaction);
      break;
      
    case 'ticket-transcript':
      await createTranscript(interaction);
      break;
      
    default:
      await interaction.reply({ 
        embeds: [{
          title: '❓ Bilinmeyen Komut',
          description: 'Bu komut tanınmıyor.',
          color: 0xFEE75C
        }],
        ephemeral: true 
      });
  }
}

// Buton handler
async function handleButton(interaction) {
  const customId = interaction.customId;
  console.log(`🔘 Buton: ${customId}`);
  
  // Art arda tıklama kontrolü
  if (!acquireInteractionLock(interaction.id, customId)) {
    console.log(`⚠️ Interaction lock aktif: ${customId}`);
    return interaction.reply({
      embeds: [{
        title: '⏳ Lütfen Bekleyin',
        description: 'Bu işlem zaten devam ediyor, lütfen birkaç saniye bekleyin.',
        color: 0xFEE75C
      }],
      ephemeral: true
    });
  }
  
  if (customId === 'open_ticket') {
    await showCategorySelect(interaction);
  } else if (customId === 'close_ticket') {
    await showCloseConfirm(interaction);
  } else if (customId === 'confirm_close') {
    await confirmCloseTicket(interaction);
  } else if (customId === 'cancel_close') {
    await interaction.update({ 
      embeds: [{
        title: '❌ İptal Edildi',
        description: 'Ticket kapatma işlemi iptal edildi.',
        color: 0xED4245
      }],
      components: [] 
    });
  } else if (customId === 'claim_ticket') {
    await claimTicketButton(interaction);
  } else if (customId === 'transcript_ticket') {
    await createTranscriptButton(interaction);
  }
}

// Select menu handler
async function handleSelectMenu(interaction) {
  const customId = interaction.customId;
  console.log(`📋 Select: ${customId}`);
  
  // Art arda tıklama kontrolü
  if (!acquireInteractionLock(interaction.id, customId)) {
    console.log(`⚠️ Interaction lock aktif: ${customId}`);
    return interaction.reply({
      embeds: [{
        title: '⏳ Lütfen Bekleyin',
        description: 'Bu işlem zaten devam ediyor, lütfen birkaç saniye bekleyin.',
        color: 0xFEE75C
      }],
      ephemeral: true
    });
  }
  
  if (customId === 'ticket_category') {
    await createTicket(interaction, interaction.values[0]);
  }
}

// Ticket panel kurulumu
async function setupTicketPanel(interaction) {
  // Debug
  console.log('🔍 Permission check:');
  console.log('  - member:', !!interaction.member);
  console.log('  - permissions:', interaction.member?.permissions);
  console.log('  - has Admin:', interaction.member?.permissions?.has?.('Administrator'));
  
  // Yetki kontrolü - owner veya admin
  if (!interaction.member?.permissions?.has('Administrator')) {
    return interaction.reply({ 
      embeds: [{
        title: '🔒 Yetkisiz',
        description: 'Bu komutu kullanmak için sunucu sahibi veya yönetici olmalısınız!',
        color: 0xED4245
      }],
      ephemeral: true 
    });
  }
  
  console.log('✅ Permission check passed!');
  
  const embed = {
    title: '🎫 Destek Sistemi',
    description: 'Yardıma mı ihtiyacınız var? Aşağıdaki butona tıklayarak bir destek talebi oluşturabilirsiniz.\n\n' +
                 '**Kurallar:**\n' +
                 '• Ticket açmadan önce SSS kanalını kontrol edin\n' +
                 '• Her konu için ayrı ticket açın\n' +
                 '• Spam ticket açmak yasaktır\n' +
                 '• Destek ekibine saygılı olun',
    color: 0x5865F2,
    footer: { text: 'Destek ekibimiz en kısa sürede size yardımcı olacaktır' }
  };
  
  const button = {
    type: 1,
    components: [{
      type: 2,
      style: 1, // Primary (mavi)
      label: '📩 Ticket Oluştur',
      custom_id: 'open_ticket'
    }]
  };
  
  await interaction.reply({ embeds: [embed], components: [button] });
}

// Kategori seçimi göster
async function showCategorySelect(interaction) {
  const options = CONFIG.categories.map(cat => ({
    label: cat.label,
    value: cat.id,
    description: cat.description
    // emoji kaldırıldı - backend object bekliyor, string değil
  }));
  
  const selectMenu = {
    type: 1,
    components: [{
      type: 3, // Select menu
      custom_id: 'ticket_category',
      placeholder: 'Bir kategori seçin...',
      options: options
    }]
  };
  
  await interaction.reply({
    embeds: [{
      title: '📋 Kategori Seçimi',
      description: 'Lütfen destek talebiniz için bir kategori seçin:',
      color: 0x5865F2
    }],
    components: [selectMenu],
    ephemeral: true
  });
}

// Ticket oluştur
async function createTicket(interaction, categoryId) {
  const { guildId, user } = interaction;
  
  // Kullanıcının açık ticket'ı var mı kontrol et
  for (const [, ticket] of tickets) {
    if (ticket.guildId === guildId && ticket.userId === user.id && ticket.status === 'open') {
      return interaction.update({
        embeds: [{
          title: '❌ Ticket Zaten Açık',
          description: `Zaten açık bir ticket'ınız var: <#${ticket.channelId}>`,
          color: 0xED4245
        }],
        components: []
      });
    }
  }
  
  const category = CONFIG.categories.find(c => c.id === categoryId);
  const ticketId = generateTicketId();
  const channelName = `ticket-${ticketId}`;
  
  await interaction.update({ content: '⏳ Ticket oluşturuluyor...', components: [] });
  
  // Permission flags (bizim sistemde):
  // VIEW_CHANNEL = 1 << 10 = 1024
  // SEND_MESSAGES = 1 << 11 = 2048
  // READ_MESSAGE_HISTORY = 1 << 16 = 65536
  // Combined: 1024 + 2048 + 65536 = 68608
  const CHANNEL_PERMS = '68608';
  
  // Kanal oluştur - permission_overwrites ile özel kanal
  // Not: guildId'yi "all" rolü ID'si olarak kullanıyoruz (bizim sistemde @everyone = all rolü)
  const channelData = {
    name: channelName,
    type: 0, // Text channel
    parent_id: CONFIG.ticketCategoryId,
    permission_overwrites: [
      // "all" rolü (guildId ile aynı) göremez - özel kanal yapar
      { id: guildId, type: 0, deny: CHANNEL_PERMS },
      // Ticket sahibi görebilir ve yazabilir
      { id: user.id, type: 1, allow: CHANNEL_PERMS },
      // Bot görebilir ve yazabilir
      { id: client.user.id, type: 1, allow: CHANNEL_PERMS }
    ]
  };
  
  // Destek rolü varsa ekle
  if (CONFIG.supportRoleId) {
    channelData.permission_overwrites.push({
      id: CONFIG.supportRoleId,
      type: 0,
      allow: CHANNEL_PERMS
    });
  }
  
  const channel = await client.rest.createChannel(guildId, channelData);
  
  // Ticket kaydet
  const ticket = {
    id: ticketId,
    guildId,
    channelId: channel.id,
    userId: user.id,
    username: user.displayName || user.username,
    category: categoryId,
    categoryLabel: category.label,
    status: 'open',
    claimedBy: null,
    createdAt: new Date(),
    messages: []
  };
  tickets.set(ticketId, ticket);
  
  // Hoşgeldin mesajı
  const welcomeEmbed = {
    title: `${category.emoji} Ticket #${ticketId}`,
    description: `Merhaba ${user.displayName || user.username}!\n\n` +
                 `**Kategori:** ${category.label}\n` +
                 `**Açılış:** ${formatDate(ticket.createdAt)}\n\n` +
                 `Lütfen sorununuzu detaylı bir şekilde açıklayın. Destek ekibimiz en kısa sürede size yardımcı olacaktır.`,
    color: 0x57F287,
    footer: { text: `Ticket ID: ${ticketId}` }
  };
  
  const actionButtons = {
    type: 1,
    components: [
      { type: 2, style: 3, label: '✋ Sahiplen', custom_id: 'claim_ticket' },
      { type: 2, style: 2, label: '📝 Transcript', custom_id: 'transcript_ticket' },
      { type: 2, style: 4, label: '🔒 Kapat', custom_id: 'close_ticket' }
    ]
  };
  
  // Discord-style mention format - jubbio.js otomatik olarak @username formatına çevirir
  await client.rest.createMessage(guildId, channel.id, {
    content: `<@${user.id}>${CONFIG.supportRoleId ? ` <@&${CONFIG.supportRoleId}>` : ''}`,
    embeds: [welcomeEmbed],
    components: [actionButtons]
  });
  
  await interaction.editReply({ 
    embeds: [{
      title: '✅ Ticket Oluşturuldu',
      description: `Ticket kanalınız hazır: <#${channel.id}>`,
      color: 0x57F287,
      footer: { text: `Ticket #${ticketId}` }
    }]
  });
  
  // Log gönder
  const userDisplay = user.displayName || user.username;
  await sendLog(guildId, {
    title: '🎫 Yeni Ticket',
    description: `**Kullanıcı:** ${userDisplay} (@${user.username})\n` +
                 `**Kategori:** ${category.label}\n` +
                 `**Kanal:** <#${channel.id}>`,
    color: 0x57F287,
    footer: { text: `Ticket #${ticketId}` },
    timestamp: new Date().toISOString()
  });
}

// Ticket kapatma onayı
async function showCloseConfirm(interaction) {
  const ticket = getTicketByChannel(interaction.channelId);
  
  if (!ticket) {
    return interaction.reply({ 
      embeds: [{
        title: '❌ Hata',
        description: 'Bu kanal bir ticket değil!',
        color: 0xED4245
      }],
      ephemeral: true 
    });
  }
  
  const confirmButtons = {
    type: 1,
    components: [
      { type: 2, style: 4, label: 'Evet, Kapat', custom_id: 'confirm_close' },
      { type: 2, style: 2, label: 'İptal', custom_id: 'cancel_close' }
    ]
  };
  
  await interaction.reply({
    embeds: [{
      title: '⚠️ Ticket Kapatma',
      description: 'Bu ticket\'ı kapatmak istediğinize emin misiniz?',
      color: 0xFEE75C
    }],
    components: [confirmButtons],
    ephemeral: true
  });
}

// Ticket kapatma onaylandı
async function confirmCloseTicket(interaction) {
  const ticket = getTicketByChannel(interaction.channelId);
  
  if (!ticket) {
    return interaction.update({ 
      embeds: [{
        title: '❌ Hata',
        description: 'Bu kanal bir ticket değil!',
        color: 0xED4245
      }],
      components: [] 
    });
  }
  
  ticket.status = 'closed';
  ticket.closedAt = new Date();
  ticket.closedBy = interaction.user.id;
  
  await interaction.update({ 
    embeds: [{
      title: '⏳ İşleniyor',
      description: 'Ticket kapatılıyor...',
      color: 0xFEE75C
    }],
    components: [] 
  });
  
  // Log gönder
  await sendLog(interaction.guildId, {
    title: '🔒 Ticket Kapatıldı',
    description: `**Ticket:** #${ticket.id}\n` +
                 `**Açan:** <@${ticket.userId}>\n` +
                 `**Kapatan:** <@${interaction.user.id}>\n` +
                 `**Süre:** ${getTicketDuration(ticket)}`,
    color: 0xED4245,
    footer: { text: `Ticket #${ticket.id}` },
    timestamp: new Date().toISOString()
  });
  
  // Kanalı hemen sil
  try {
    await client.rest.deleteChannel(interaction.guildId, interaction.channelId);
    tickets.delete(ticket.id);
  } catch (e) {
    console.error('Kanal silinemedi:', e.message);
  }
}

// Ticket sahiplenme (buton)
async function claimTicketButton(interaction) {
  const ticket = getTicketByChannel(interaction.channelId);
  
  if (!ticket) {
    return interaction.reply({ 
      embeds: [{
        title: '❌ Hata',
        description: 'Bu kanal bir ticket değil!',
        color: 0xED4245
      }],
      ephemeral: true 
    });
  }
  
  if (ticket.claimedBy) {
    return interaction.reply({ 
      embeds: [{
        title: '❌ Hata',
        description: 'Bu ticket zaten başka biri tarafından sahiplenilmiş!',
        color: 0xED4245
      }],
      ephemeral: true 
    });
  }
  
  ticket.claimedBy = interaction.user.id;
  ticket.claimedByName = interaction.user.displayName || interaction.user.username;
  ticket.claimedAt = new Date();
  
  // Discord-style mention - jubbio.js otomatik çevirir
  const claimEmbed = {
    title: '✋ Ticket Sahiplenildi',
    description: `Bu ticket <@${interaction.user.id}> tarafından sahiplenildi.`,
    color: 0x5865F2,
    timestamp: new Date().toISOString()
  };
  
  await interaction.reply({ embeds: [claimEmbed] });
}

// Transcript oluştur (buton)
async function createTranscriptButton(interaction) {
  const ticket = getTicketByChannel(interaction.channelId);
  
  if (!ticket) {
    return interaction.reply({ 
      embeds: [{
        title: '❌ Hata',
        description: 'Bu kanal bir ticket değil!',
        color: 0xED4245
      }],
      ephemeral: true 
    });
  }
  
  await interaction.deferReply();
  
  // Mesajları al
  const response = await client.rest.getMessages(interaction.guildId, interaction.channelId, { limit: 100 });
  const messages = Array.isArray(response) ? response : (response.messages || []);
  
  // Transcript oluştur - Türkçe karakterler destekleniyor
  let transcript = `=== TICKET TRANSCRIPT ===\n`;
  transcript += `Ticket ID: #${ticket.id}\n`;
  transcript += `Kategori: ${ticket.categoryLabel}\n`;
  transcript += `Açan: ${ticket.username}\n`;
  transcript += `Açılış: ${formatDate(ticket.createdAt)}\n`;
  transcript += `========================\n\n`;
  
  // Mesajları ters çevir (eskiden yeniye)
  const sortedMessages = [...messages].reverse();
  
  for (const msg of sortedMessages) {
    let time = 'Bilinmiyor';
    try {
      const timestamp = msg.timestamp || msg.created_at;
      if (timestamp) {
        time = formatDate(new Date(timestamp));
      }
    } catch (e) {
      // ignore
    }
    // Gerçek kullanıcı adını al (display_name > username > Unknown)
    const author = msg.author?.display_name || msg.author?.username || 'Bilinmeyen';
    const content = msg.content || '[Embed/Dosya]';
    transcript += `[${time}] ${author}: ${content}\n`;
  }
  
  // Dosya olarak gönder - UTF-8 BOM ekle (Windows uyumluluğu için)
  const BOM = '\uFEFF';
  const buffer = Buffer.from(BOM + transcript, 'utf-8');
  
  await interaction.editReply({
    embeds: [{
      title: '📝 Transcript Oluşturuldu',
      description: `Ticket #${ticket.id} için transcript dosyası hazırlandı.`,
      color: 0x5865F2,
      footer: { text: `${messages.length} mesaj` }
    }],
    files: [{
      name: `transcript-${ticket.id}.txt`,
      data: buffer,
      contentType: 'text/plain; charset=utf-8'
    }]
  });
}

// Ticket'a kullanıcı ekle
async function addUserToTicket(interaction) {
  const ticket = getTicketByChannel(interaction.channelId);
  
  if (!ticket) {
    return interaction.reply({ 
      embeds: [{
        title: '❌ Hata',
        description: 'Bu kanal bir ticket değil!',
        color: 0xED4245
      }],
      ephemeral: true 
    });
  }
  
  // Debug: log options
  console.log('[DEBUG] ticket-add options:', JSON.stringify(interaction.options, null, 2));
  
  // getUser returns user ID as string, not an object
  const userId = interaction.options.getUser('user', true);
  console.log('[DEBUG] userId:', userId);
  
  if (!userId) {
    return interaction.reply({ 
      embeds: [{
        title: '❌ Hata',
        description: 'Kullanıcı bulunamadı!',
        color: 0xED4245
      }],
      ephemeral: true 
    });
  }
  
  // Kanal izinlerini güncelle - VIEW_CHANNEL + SEND_MESSAGES + READ_MESSAGE_HISTORY
  const CHANNEL_PERMS = '68608';
  await client.rest.editChannelPermissions(interaction.channelId, userId, {
    type: 1, // Member
    allow: CHANNEL_PERMS
  });
  
  await interaction.reply({ 
    embeds: [{
      title: '✅ Kullanıcı Eklendi',
      description: `<@${userId}> ticket'a eklendi.`,
      color: 0x57F287
    }]
  });
}

// Ticket'tan kullanıcı çıkar
async function removeUserFromTicket(interaction) {
  const ticket = getTicketByChannel(interaction.channelId);
  
  if (!ticket) {
    return interaction.reply({ 
      embeds: [{
        title: '❌ Hata',
        description: 'Bu kanal bir ticket değil!',
        color: 0xED4245
      }],
      ephemeral: true 
    });
  }
  
  // getUser returns user ID as string, not an object
  const userId = interaction.options.getUser('user', true);
  
  // Ticket sahibini çıkaramaz
  if (userId === ticket.userId) {
    return interaction.reply({ 
      embeds: [{
        title: '❌ Hata',
        description: 'Ticket sahibini çıkaramazsınız!',
        color: 0xED4245
      }],
      ephemeral: true 
    });
  }
  
  // Kanal izinlerini güncelle
  await client.rest.deleteChannelPermission(interaction.channelId, userId);
  
  await interaction.reply({ 
    embeds: [{
      title: '✅ Kullanıcı Çıkarıldı',
      description: `<@${userId}> ticket'tan çıkarıldı.`,
      color: 0x57F287
    }]
  });
}

// Ticket sahiplenme (komut)
async function claimTicket(interaction) {
  const ticket = getTicketByChannel(interaction.channelId);
  
  if (!ticket) {
    return interaction.reply({ 
      embeds: [{
        title: '❌ Hata',
        description: 'Bu kanal bir ticket değil!',
        color: 0xED4245
      }],
      ephemeral: true 
    });
  }
  
  if (ticket.claimedBy) {
    return interaction.reply({ 
      embeds: [{
        title: '❌ Hata',
        description: 'Bu ticket zaten başka biri tarafından sahiplenilmiş!',
        color: 0xED4245
      }],
      ephemeral: true 
    });
  }
  
  ticket.claimedBy = interaction.user.id;
  ticket.claimedByName = interaction.user.displayName || interaction.user.username;
  ticket.claimedAt = new Date();
  
  // Discord-style mention - jubbio.js otomatik çevirir
  await interaction.reply({ 
    embeds: [{
      title: '✅ Ticket Sahiplenildi',
      description: `Ticket <@${interaction.user.id}> tarafından sahiplenildi.`,
      color: 0x57F287,
      timestamp: new Date().toISOString()
    }]
  });
}

// Ticket kapat (komut)
async function closeTicket(interaction) {
  const ticket = getTicketByChannel(interaction.channelId);
  
  if (!ticket) {
    return interaction.reply({ 
      embeds: [{
        title: '❌ Hata',
        description: 'Bu kanal bir ticket değil!',
        color: 0xED4245
      }],
      ephemeral: true 
    });
  }
  
  await showCloseConfirm(interaction);
}

// Transcript oluştur (komut)
async function createTranscript(interaction) {
  await createTranscriptButton(interaction);
}

// Log gönder
async function sendLog(guildId, embed) {
  if (!CONFIG.logChannelId) return;
  
  try {
    await client.rest.createMessage(guildId, CONFIG.logChannelId, { embeds: [embed] });
  } catch (e) {
    console.error('Log gönderilemedi:', e.message);
  }
}

// Ticket süresi hesapla
function getTicketDuration(ticket) {
  const start = ticket.createdAt;
  const end = ticket.closedAt || new Date();
  const diff = end - start;
  
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  
  if (hours > 0) {
    return `${hours} saat ${minutes} dakika`;
  }
  return `${minutes} dakika`;
}

// Slash komutlarını kaydet
async function registerCommands() {
  const commands = [
    {
      name: 'ticket-setup',
      description: 'Ticket panelini oluştur (Yönetici)'
    },
    {
      name: 'ticket-close',
      description: 'Bu ticket\'ı kapat'
    },
    {
      name: 'ticket-add',
      description: 'Ticket\'a kullanıcı ekle',
      options: [{
        name: 'user',
        description: 'Eklenecek kullanıcı',
        type: 6, // USER
        required: true
      }]
    },
    {
      name: 'ticket-remove',
      description: 'Ticket\'tan kullanıcı çıkar',
      options: [{
        name: 'user',
        description: 'Çıkarılacak kullanıcı',
        type: 6, // USER
        required: true
      }]
    },
    {
      name: 'ticket-claim',
      description: 'Bu ticket\'ı sahiplen'
    },
    {
      name: 'ticket-transcript',
      description: 'Ticket transcript\'i oluştur'
    }
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
