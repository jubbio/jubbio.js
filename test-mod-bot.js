/**
 * Jubbio Mod Bot - Kapsamlı Moderasyon Botu
 * Tüm jubbio.js özelliklerini test eder:
 * - Collection, Collector, MessageCollector, InteractionCollector
 * - EmbedBuilder, ButtonBuilder, ActionRowBuilder, SelectMenuBuilder
 * - Formatters (userMention, bold, codeBlock vs.)
 * - PermissionsBitField
 * 
 * Prefix: !
 */

const { 
  Client, 
  GatewayIntentBits,
  EmbedBuilder,
  Colors,
  Collection,
  userMention,
  channelMention,
  bold,
  italic,
  codeBlock,
  inlineCode,
  time,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  MessageCollector,
  InteractionCollector,
  PermissionsBitField,
  PermissionsBits
} = require('./core/dist');

// ==================== CONFIG ====================
const PREFIX = '!';
const CONFIG = {
  capsThreshold: 0.7,
  capsMinLength: 8,
  spamTimeWindow: 10000,
  spamMaxRepeats: 3,
  floodTimeWindow: 5000,
  floodMaxMessages: 5,
  warningsForTimeout: 3,
  warningsForBan: 5,
  timeoutDuration: 5 * 60 * 1000,
  bannedWords: ['badword1', 'badword2'],
  modRoles: [],
  logChannelId: null,
  exemptRoles: []
};

// ==================== DATA STORES ====================
const warnings = new Collection();
const messageHistory = new Collection();
const activeGiveaways = new Collection();

// ==================== CLIENT ====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions
  ]
});

// ==================== HELPER FUNCTIONS ====================

function getUserId(message) {
  return message.user_id || message.author?.id || message.author_id;
}

// Helper: İlk mention edilen kullanıcıyı al
function getFirstMentionedUser(message) {
  // Backend'den gelen mentions.users array'i
  if (message.mentions?.users && message.mentions.users.length > 0) {
    return message.mentions.users[0];
  }
  return null;
}

// Member cache - 5 dakika TTL
const memberCache = new Collection();
const MEMBER_CACHE_TTL = 5 * 60 * 1000; // 5 dakika

async function getMemberWithCache(guildId, userId) {
  const cacheKey = `${guildId}-${userId}`;
  const cached = memberCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < MEMBER_CACHE_TTL) {
    return cached.member;
  }
  
  try {
    const member = await client.rest.getMember(guildId, userId);
    memberCache.set(cacheKey, { member, timestamp: Date.now() });
    return member;
  } catch (e) {
    console.error(`getMember hatası: ${e.message}`);
    return null;
  }
}

async function isModerator(guildId, userId) {
  const member = await getMemberWithCache(guildId, userId);
  if (!member) return false;
  
  // Owner kontrolü
  if (member.isOwner) return true;
  
  // Admin kontrolü (permissions bit check)
  // Backend artık permissions field'ını string olarak döndürüyor
  const permissions = BigInt(member.permissions || 0);
  const ADMINISTRATOR = BigInt(0x8); // 1 << 3
  if ((permissions & ADMINISTRATOR) === ADMINISTRATOR) return true;
  
  // Mod rolleri kontrolü
  if (CONFIG.modRoles.length > 0 && member.roles) {
    const memberRoleIds = member.roles.map(r => typeof r === 'object' ? r.id : String(r));
    const hasModRole = memberRoleIds.some(roleId => CONFIG.modRoles.includes(String(roleId)));
    if (hasModRole) return true;
  }
  
  // ModerateMembers permission kontrolü
  const MODERATE_MEMBERS = BigInt(0x10000000000); // 1 << 40
  if ((permissions & MODERATE_MEMBERS) === MODERATE_MEMBERS) return true;
  
  return false;
}

async function isExempt(guildId, userId) {
  // Önce moderatör kontrolü
  if (await isModerator(guildId, userId)) return true;
  
  // Exempt rolleri kontrolü
  if (CONFIG.exemptRoles.length > 0) {
    const member = await getMemberWithCache(guildId, userId);
    if (member?.roles) {
      return member.roles.some(roleId => CONFIG.exemptRoles.includes(String(roleId)));
    }
  }
  
  return false;
}

// Komutlar için yetki kontrolü helper
async function checkModPermission(message) {
  const guildId = message.guildId || message.guild_id;
  const userId = getUserId(message);
  return await isModerator(guildId, userId);
}

function getWarnings(userId) {
  let data = warnings.get(userId);
  if (!data) {
    data = { count: 0, reasons: [] };
    warnings.set(userId, data);
  }
  return data;
}

function addWarning(userId, reason) {
  const data = getWarnings(userId);
  data.count++;
  data.reasons.push({ reason, date: new Date() });
  warnings.set(userId, data);
  return data;
}

function clearWarnings(userId) {
  warnings.delete(userId);
}

function hasTooManyCaps(text) {
  if (text.length < CONFIG.capsMinLength) return false;
  const letters = text.replace(/[^a-zA-ZğüşıöçĞÜŞİÖÇ]/g, '');
  if (letters.length < CONFIG.capsMinLength) return false;
  const upperCount = (text.match(/[A-ZĞÜŞİÖÇ]/g) || []).length;
  return upperCount / letters.length > CONFIG.capsThreshold;
}

function containsBannedWord(text) {
  const lower = text.toLowerCase();
  return CONFIG.bannedWords.some(word => lower.includes(word));
}

function checkSpam(channelId, userId, content) {
  const key = `${channelId}-${userId}`;
  let history = messageHistory.get(key);
  if (!history) {
    history = [];
    messageHistory.set(key, history);
  }
  const now = Date.now();
  const recent = history.filter(m => now - m.time < CONFIG.spamTimeWindow);
  recent.push({ content, time: now });
  messageHistory.set(key, recent.slice(-10));
  const sameMessages = recent.filter(m => m.content === content);
  return sameMessages.length >= CONFIG.spamMaxRepeats;
}

function checkFlood(channelId, userId) {
  const key = `${channelId}-${userId}`;
  const history = messageHistory.get(key) || [];
  const now = Date.now();
  const recentCount = history.filter(m => now - m.time < CONFIG.floodTimeWindow).length;
  return recentCount >= CONFIG.floodMaxMessages;
}

// ==================== EMBED BUILDERS ====================

function createModEmbed(title, description, color = Colors.Red) {
  return new EmbedBuilder()
    .setTitle(`🛡️ ${title}`)
    .setDescription(description)
    .setColor(color)
    .setTimestamp(new Date())
    .setFooter({ text: 'Jubbio Mod Bot' });
}

function createSuccessEmbed(title, description) {
  return new EmbedBuilder()
    .setTitle(`✅ ${title}`)
    .setDescription(description)
    .setColor(Colors.Green)
    .setTimestamp(new Date());
}

function createErrorEmbed(title, description) {
  return new EmbedBuilder()
    .setTitle(`❌ ${title}`)
    .setDescription(description)
    .setColor(Colors.Red)
    .setTimestamp(new Date());
}

function createInfoEmbed(title, description) {
  return new EmbedBuilder()
    .setTitle(`ℹ️ ${title}`)
    .setDescription(description)
    .setColor(Colors.Blue)
    .setTimestamp(new Date());
}

// ==================== SEND HELPERS ====================

async function sendMessage(guildId, channelId, data) {
  return client.rest.createMessage(guildId, channelId, data);
}

async function editMessage(guildId, channelId, messageId, data) {
  return client.rest.editMessage(guildId, channelId, messageId, data);
}

async function deleteMessage(guildId, channelId, messageId) {
  return client.rest.deleteMessage(guildId, channelId, messageId);
}

async function respondInteraction(interactionId, token, data) {
  return client.rest.createInteractionResponse(interactionId, token, data);
}

// ==================== COMMAND HANDLERS ====================
const commands = new Collection();

// !help
commands.set('help', {
  name: 'help',
  description: 'Komut listesi',
  usage: '!help [komut]',
  async execute(message, args) {
    if (args[0]) {
      const cmd = commands.get(args[0].toLowerCase());
      if (!cmd) {
        return message.reply({ embeds: [createErrorEmbed('Hata', 'Komut bulunamadı!')] });
      }
      const embed = createInfoEmbed(cmd.name, cmd.description)
        .addFields(
          { name: 'Kullanım', value: inlineCode(cmd.usage || `!${cmd.name}`), inline: true },
          { name: 'Mod Komutu', value: cmd.modOnly ? 'Evet' : 'Hayır', inline: true },
          { name: 'Kategori', value: cmd.category || 'Genel', inline: true }
        );
      return message.reply({ embeds: [embed] });
    }
    
    // Kategorilere göre grupla
    const generalCmds = [];
    const modCmds = [];
    const collectorCmds = [];
    const testCmds = [];
    
    commands.forEach(cmd => {
      const name = inlineCode(cmd.name);
      if (cmd.category === 'collector') {
        collectorCmds.push(name);
      } else if (cmd.category === 'test') {
        testCmds.push(name);
      } else if (cmd.modOnly) {
        modCmds.push(name);
      } else {
        generalCmds.push(name);
      }
    });
    
    const embed = createInfoEmbed('Komut Listesi', `Prefix: ${inlineCode(PREFIX)}`)
      .addFields(
        { name: '📌 Genel Komutlar', value: generalCmds.join(', ') || 'Yok' },
        { name: '🛡️ Mod Komutları', value: modCmds.join(', ') || 'Yok' },
        { name: '🔄 Collector Test', value: collectorCmds.join(', ') || 'Yok' },
        { name: '🧪 Diğer Testler', value: testCmds.join(', ') || 'Yok' }
      )
      .setFooter({ text: `${commands.size} komut | !help <komut> detay için` });
    
    return message.reply({ embeds: [embed] });
  }
});

// !ping
commands.set('ping', {
  name: 'ping',
  description: 'Bot gecikmesini gösterir',
  usage: '!ping',
  async execute(message) {
    const start = Date.now();
    const reply = await message.reply({ content: '🏓 Pinging...' });
    const latency = Date.now() - start;
    
    const embed = createSuccessEmbed('Pong!', '')
      .addFields(
        { name: '📡 Mesaj Gecikmesi', value: `${latency}ms`, inline: true }
      );
    
    await editMessage(message.guildId, message.channelId, reply.id, {
      content: '🏓',
      embeds: [embed.toJSON()]
    });
  }
});

// !userinfo
commands.set('userinfo', {
  name: 'userinfo',
  description: 'Kullanıcı bilgilerini gösterir',
  usage: '!userinfo [@kullanıcı]',
  async execute(message, args) {
    let userId = getUserId(message);
    const mention = getFirstMentionedUser(message);
    if (mention) userId = mention.id;
    else if (args[0]) userId = args[0].replace(/[<@!>]/g, '');
    
    try {
      const member = await client.rest.getMember(message.guildId, userId);
      const warnData = getWarnings(userId);
      
      const embed = createInfoEmbed('Kullanıcı Bilgisi', '')
        .addFields(
          { name: '👤 Kullanıcı', value: member.user?.username || 'Bilinmiyor', inline: true },
          { name: '🆔 ID', value: inlineCode(userId), inline: true },
          { name: '⚠️ Uyarılar', value: `${warnData.count}`, inline: true }
        );
      
      return message.reply({ embeds: [embed] });
    } catch (e) {
      return message.reply({ embeds: [createErrorEmbed('Hata', 'Kullanıcı bulunamadı!')] });
    }
  }
});

// !poll - Anket (Button + InteractionCollector testi)
commands.set('poll', {
  name: 'poll',
  description: 'Anket oluşturur (InteractionCollector)',
  usage: '!poll <soru> | <seçenek1> | <seçenek2> ...',
  category: 'collector',
  async execute(message, args) {
    const parts = args.join(' ').split('|').map(p => p.trim());
    if (parts.length < 3) {
      return message.reply({ embeds: [createErrorEmbed('Hata', 'Kullanım: !poll Soru | Seçenek1 | Seçenek2')] });
    }
    
    const question = parts[0];
    const options = parts.slice(1, 6);
    const votes = new Collection();
    options.forEach((_, i) => votes.set(i, new Set()));
    
    const buttons = options.map((opt, i) => 
      new ButtonBuilder()
        .setCustomId(`poll_${i}`)
        .setLabel(`${opt} (0)`)
        .setStyle(ButtonStyle.Primary)
    );
    
    const row = new ActionRowBuilder().addComponents(...buttons);
    
    const embed = createInfoEmbed('📊 Anket', question)
      .addFields(...options.map((opt, i) => ({
        name: `Seçenek ${i + 1}`,
        value: opt,
        inline: true
      })))
      .setFooter({ text: '30 saniye içinde oy verin!' });
    
    const pollMsg = await message.reply({ 
      embeds: [embed], 
      components: [row.toJSON()] 
    });
    
    const collector = new InteractionCollector(client, {
      messageId: pollMsg.id,
      time: 30000,
      componentType: 2
    });
    
    collector.on('collect', async (interaction) => {
      const optionIndex = parseInt(interaction.customId.split('_')[1]);
      const odası = interaction.user?.id || interaction.member?.user?.id;
      
      votes.forEach(set => set.delete(odası));
      votes.get(optionIndex)?.add(odası);
      
      // Buttons with personal highlight (green for the option user selected)
      const personalButtons = options.map((opt, i) => 
        new ButtonBuilder()
          .setCustomId(`poll_${i}`)
          .setLabel(`${opt} (${votes.get(i)?.size || 0})`)
          .setStyle(votes.get(i)?.has(odası) ? ButtonStyle.Success : ButtonStyle.Primary)
      );
      
      // Buttons for everyone else (neutral colors, just updated counts)
      const publicButtons = options.map((opt, i) => 
        new ButtonBuilder()
          .setCustomId(`poll_${i}`)
          .setLabel(`${opt} (${votes.get(i)?.size || 0})`)
          .setStyle(ButtonStyle.Primary)
      );
      
      const personalRow = new ActionRowBuilder().addComponents(...personalButtons);
      const publicRow = new ActionRowBuilder().addComponents(...publicButtons);
      
      // Respond to interaction (instant feedback with personal highlight)
      await respondInteraction(interaction.id, interaction.token, {
        type: 7,
        data: { components: [personalRow.toJSON()] }
      });
      
      // Edit the message for everyone (neutral colors, updated counts)
      await editMessage(message.guildId, message.channelId, pollMsg.id, {
        components: [publicRow.toJSON()]
      });
    });
    
    collector.on('end', async () => {
      const results = options.map((opt, i) => `${opt}: ${bold(String(votes.get(i)?.size || 0))} oy`);
      
      // Find max vote count
      const maxVotes = Math.max(...options.map((_, i) => votes.get(i)?.size || 0));
      
      // Find all options with max votes (could be multiple in case of draw)
      const winners = options.filter((_, i) => (votes.get(i)?.size || 0) === maxVotes);
      
      // Determine winner text
      let winnerText;
      if (maxVotes === 0) {
        winnerText = 'Kimse oy vermedi';
      } else if (winners.length > 1) {
        winnerText = `Berabere: ${winners.join(', ')}`;
      } else {
        winnerText = winners[0];
      }
      
      const finalEmbed = createSuccessEmbed('📊 Anket Sonuçları', question)
        .addFields({ name: 'Sonuçlar', value: results.join('\n') })
        .addFields({ name: '🏆 Kazanan', value: winnerText });
      
      await editMessage(message.guildId, message.channelId, pollMsg.id, {
        embeds: [finalEmbed.toJSON()],
        components: []
      });
    });
  }
});

// !ask - MessageCollector testi
commands.set('ask', {
  name: 'ask',
  description: 'Kullanıcıdan cevap bekler (MessageCollector)',
  usage: '!ask',
  category: 'collector',
  async execute(message) {
    const embed = createInfoEmbed('Soru', 'Favori rengin ne? (15 saniye)')
      .setFooter({ text: 'Cevabını yaz...' });
    
    await message.reply({ embeds: [embed] });
    const authorId = String(getUserId(message));
    console.log(`[ASK] Waiting for messages from authorId: ${authorId} (type: ${typeof authorId})`);
    
    // jubbio.js artık bot mesajlarını otomatik filtreliyor
    // Sadece komutu yazan kişinin mesajlarını almak için filter kullanıyoruz
    const collector = new MessageCollector(client, message.channelId, {
      filter: (m) => {
        const msgAuthorId = String(m.author?.id || m.author_id || m.user_id);
        console.log(`[ASK] Received message from: ${msgAuthorId} (type: ${typeof msgAuthorId}), expected: ${authorId}, match: ${msgAuthorId === authorId}`);
        return msgAuthorId === authorId;
      },
      time: 15000,
      max: 1
    });
    
    collector.on('collect', async (response) => {
      console.log(`[ASK] Collected message: ${response.content}`);
      const answer = response.content || '[boş mesaj]';
      const responseEmbed = createSuccessEmbed('Cevap Alındı!', '')
        .addFields(
          { name: 'Soru', value: 'Favori rengin ne?' },
          { name: 'Cevabın', value: answer }
        );
      
      await sendMessage(message.guildId, message.channelId, {
        embeds: [responseEmbed.toJSON()]
      });
    });
    
    collector.on('end', (collected, reason) => {
      console.log(`[ASK] Collector ended - reason: ${reason}, collected: ${collected.size}`);
      if (reason === 'time' && collected.size === 0) {
        sendMessage(message.guildId, message.channelId, {
          embeds: [createErrorEmbed('Zaman Aşımı', 'Cevap vermek için çok geç kaldın!').toJSON()]
        });
      }
    });
  }
});

// !menu - SelectMenu testi
commands.set('menu', {
  name: 'menu',
  description: 'Select menu örneği (InteractionCollector)',
  usage: '!menu',
  category: 'collector',
  async execute(message) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('color_select')
      .setPlaceholder('Bir renk seç...')
      .addOptions(
        { label: '🔴 Kırmızı', value: 'red', description: 'Ateşli ve tutkulu' },
        { label: '🔵 Mavi', value: 'blue', description: 'Sakin ve huzurlu' },
        { label: '🟢 Yeşil', value: 'green', description: 'Doğal ve taze' },
        { label: '🟡 Sarı', value: 'yellow', description: 'Neşeli ve enerjik' },
        { label: '🟣 Mor', value: 'purple', description: 'Gizemli ve asil' }
      );
    
    const row = new ActionRowBuilder().addComponents(selectMenu);
    const embed = createInfoEmbed('Renk Seçici', 'Aşağıdan favori rengini seç!');
    
    const menuMsg = await message.reply({ 
      embeds: [embed], 
      components: [row.toJSON()] 
    });
    
    const collector = new InteractionCollector(client, {
      messageId: menuMsg.id,
      time: 30000,
      componentType: 3
    });
    
    collector.on('collect', async (interaction) => {
      const selected = interaction.values?.[0];
      const colorMap = {
        red: { name: 'Kırmızı', color: Colors.Red },
        blue: { name: 'Mavi', color: Colors.Blue },
        green: { name: 'Yeşil', color: Colors.Green },
        yellow: { name: 'Sarı', color: Colors.Yellow },
        purple: { name: 'Mor', color: Colors.Purple }
      };
      
      const choice = colorMap[selected];
      const resultEmbed = new EmbedBuilder()
        .setTitle(`${choice.name} Seçildi!`)
        .setColor(choice.color)
        .setDescription(`${userMention(interaction.user?.id || interaction.member?.user?.id)} ${bold(choice.name)} rengini seçti!`);
      
      await respondInteraction(interaction.id, interaction.token, {
        type: 7,
        data: { embeds: [resultEmbed.toJSON()], components: [] }
      });
      
      collector.stop('selected');
    });
  }
});

// !giveaway - Çekiliş
commands.set('giveaway', {
  name: 'giveaway',
  description: 'Çekiliş başlatır (InteractionCollector)',
  usage: '!giveaway <süre(s)> <ödül>',
  modOnly: true,
  category: 'collector',
  async execute(message, args) {
    if (!(await checkModPermission(message))) {
      return message.reply({ embeds: [createErrorEmbed('Yetki Yok', 'Bu komutu kullanma yetkin yok!')] });
    }
    
    const duration = parseInt(args[0]) * 1000 || 60000;
    const prize = args.slice(1).join(' ') || 'Gizemli Ödül';
    const participants = new Set();
    
    const button = new ButtonBuilder()
      .setCustomId('giveaway_join')
      .setLabel('🎉 Katıl (0)')
      .setStyle(ButtonStyle.Success);
    
    const row = new ActionRowBuilder().addComponents(button);
    const endTime = new Date(Date.now() + duration);
    
    const embed = createInfoEmbed('🎉 ÇEKİLİŞ!', '')
      .addFields(
        { name: '🎁 Ödül', value: prize },
        { name: '⏰ Bitiş', value: time(endTime, 'R') },
        { name: '👥 Katılımcı', value: '0' }
      )
      .setColor(Colors.Gold);
    
    const giveawayMsg = await message.reply({ 
      embeds: [embed], 
      components: [row.toJSON()] 
    });
    
    activeGiveaways.set(giveawayMsg.id, { prize, participants, endTime });
    
    const collector = new InteractionCollector(client, {
      messageId: giveawayMsg.id,
      time: duration,
      componentType: 2
    });
    
    // Batch update için debounce
    let updatePending = false;
    let lastUpdateTime = 0;
    const UPDATE_INTERVAL = 1000; // 1 saniye minimum aralık
    
    const scheduleUpdate = async () => {
      if (updatePending) return;
      
      const now = Date.now();
      const timeSinceLastUpdate = now - lastUpdateTime;
      
      if (timeSinceLastUpdate >= UPDATE_INTERVAL) {
        // Hemen güncelle
        await doUpdate();
      } else {
        // Bekle ve güncelle
        updatePending = true;
        setTimeout(async () => {
          updatePending = false;
          await doUpdate();
        }, UPDATE_INTERVAL - timeSinceLastUpdate);
      }
    };
    
    const doUpdate = async () => {
      lastUpdateTime = Date.now();
      
      const publicButton = new ButtonBuilder()
        .setCustomId('giveaway_join')
        .setLabel(`🎉 Katıl (${participants.size})`)
        .setStyle(ButtonStyle.Success);
      
      const publicRow = new ActionRowBuilder().addComponents(publicButton);
      
      const publicEmbed = createInfoEmbed('🎉 ÇEKİLİŞ!', '')
        .addFields(
          { name: '🎁 Ödül', value: prize },
          { name: '⏰ Bitiş', value: time(endTime, 'R') },
          { name: '👥 Katılımcı', value: String(participants.size) }
        )
        .setColor(Colors.Gold);
      
      await editMessage(message.guildId, message.channelId, giveawayMsg.id, {
        embeds: [publicEmbed.toJSON()],
        components: [publicRow.toJSON()]
      });
    };
    
    collector.on('collect', async (interaction) => {
      const odası = interaction.user?.id || interaction.member?.user?.id;
      
      if (participants.has(odası)) {
        participants.delete(odası);
      } else {
        participants.add(odası);
      }
      
      // Kişisel feedback - katılıp katılmadığını göster
      const personalButton = new ButtonBuilder()
        .setCustomId('giveaway_join')
        .setLabel(`🎉 Katıl (${participants.size})`)
        .setStyle(participants.has(odası) ? ButtonStyle.Primary : ButtonStyle.Success);
      
      const personalRow = new ActionRowBuilder().addComponents(personalButton);
      
      const personalEmbed = createInfoEmbed('🎉 ÇEKİLİŞ!', '')
        .addFields(
          { name: '🎁 Ödül', value: prize },
          { name: '⏰ Bitiş', value: time(endTime, 'R') },
          { name: '👥 Katılımcı', value: String(participants.size) }
        )
        .setColor(Colors.Gold);
      
      // Hızlı response - kişiye özel
      await respondInteraction(interaction.id, interaction.token, {
        type: 7,
        data: { embeds: [personalEmbed.toJSON()], components: [personalRow.toJSON()] }
      });
      
      // Batch update - herkes için
      scheduleUpdate();
    });
    
    collector.on('end', async () => {
      activeGiveaways.delete(giveawayMsg.id);
      
      if (participants.size === 0) {
        const noWinnerEmbed = createErrorEmbed('Çekiliş Bitti', 'Kimse katılmadı!')
          .addFields({ name: '🎁 Ödül', value: prize });
        
        await editMessage(message.guildId, message.channelId, giveawayMsg.id, {
          content: '🎉',
          embeds: [noWinnerEmbed.toJSON()],
          components: []
        });
        return;
      }
      
      const participantArray = [...participants];
      const winnerId = participantArray[Math.floor(Math.random() * participantArray.length)];
      
      const winnerEmbed = createSuccessEmbed('🎉 Çekiliş Sonuçlandı!', '')
        .addFields(
          { name: '🎁 Ödül', value: prize },
          { name: '🏆 Kazanan', value: userMention(winnerId) },
          { name: '👥 Toplam Katılımcı', value: String(participants.size) }
        )
        .setColor(Colors.Gold);
      
      await editMessage(message.guildId, message.channelId, giveawayMsg.id, {
        content: '🎉',
        embeds: [winnerEmbed.toJSON()],
        components: []
      });
      
      await sendMessage(message.guildId, message.channelId, {
        content: `🎊 Tebrikler ${userMention(winnerId)}! ${bold(prize)} kazandın!`
      });
    });
  }
});

// ==================== MOD COMMANDS ====================

// !warn
commands.set('warn', {
  name: 'warn',
  description: 'Kullanıcıya uyarı verir',
  usage: '!warn <@kullanıcı> [sebep]',
  modOnly: true,
  async execute(message, args) {
    if (!(await checkModPermission(message))) {
      return message.reply({ embeds: [createErrorEmbed('Yetki Yok', 'Bu komutu kullanma yetkin yok!')] });
    }
    
    const mention = getFirstMentionedUser(message);
    if (!mention) {
      return message.reply({ embeds: [createErrorEmbed('Hata', 'Bir kullanıcı etiketle!')] });
    }
    
    // Moderatör bilgisi
    const modUserId = getUserId(message);
    const modUsername = message.author?.username || 'Moderatör';
    
    const reason = args.slice(1).join(' ') || 'Sebep belirtilmedi';
    const warnData = addWarning(mention.id, reason);
    
    const embed = createModEmbed('Uyarı Verildi', '')
      .addFields(
        { name: '👤 Kullanıcı', value: `@${mention.username}`, inline: true },
        { name: '👮 Moderatör', value: `@${modUsername}`, inline: true },
        { name: '📝 Sebep', value: reason },
        { name: '⚠️ Toplam Uyarı', value: `${warnData.count}/${CONFIG.warningsForBan}` }
      )
      .setColor(Colors.Orange);
    
    await message.reply({ embeds: [embed] });
    
    if (warnData.count >= CONFIG.warningsForBan) {
      try {
        await client.rest.banMember(message.guildId, mention.id, { deleteMessageSeconds: 86400 });
        await message.reply({ embeds: [createModEmbed('Otomatik Ban', `@${mention.username} ${CONFIG.warningsForBan} uyarıya ulaştığı için banlandı!`)] });
      } catch (e) {
        console.error('Ban hatası:', e.message);
      }
    } else if (warnData.count >= CONFIG.warningsForTimeout) {
      try {
        await client.rest.timeoutMember(message.guildId, mention.id, CONFIG.timeoutDuration);
        await message.reply({ embeds: [createModEmbed('Otomatik Timeout', `@${mention.username} ${CONFIG.warningsForTimeout} uyarıya ulaştığı için susturuldu!`)] });
      } catch (e) {
        console.error('Timeout hatası:', e.message);
      }
    }
  }
});

// !warnings
commands.set('warnings', {
  name: 'warnings',
  description: 'Kullanıcının uyarılarını gösterir',
  usage: '!warnings [@kullanıcı]',
  async execute(message, args) {
    let userId = getUserId(message);
    let username = message.author?.username || 'Kullanıcı';
    const mention = getFirstMentionedUser(message);
    if (mention) {
      userId = mention.id;
      username = mention.username;
    }
    
    const warnData = getWarnings(userId);
    
    if (warnData.count === 0) {
      return message.reply({ embeds: [createSuccessEmbed('Temiz!', `@${username} hiç uyarı almamış.`)] });
    }
    
    const reasonList = warnData.reasons.slice(-5).map((r, i) => 
      `${i + 1}. ${r.reason} - ${time(r.date, 'R')}`
    ).join('\n');
    
    const embed = createInfoEmbed('Uyarı Geçmişi', '')
      .addFields(
        { name: '👤 Kullanıcı', value: `@${username}` },
        { name: '⚠️ Toplam Uyarı', value: `${warnData.count}` },
        { name: '📜 Son Uyarılar', value: reasonList || 'Yok' }
      );
    
    return message.reply({ embeds: [embed] });
  }
});

// !clearwarns
commands.set('clearwarns', {
  name: 'clearwarns',
  description: 'Kullanıcının uyarılarını temizler',
  usage: '!clearwarns <@kullanıcı>',
  modOnly: true,
  async execute(message, args) {
    if (!(await checkModPermission(message))) {
      return message.reply({ embeds: [createErrorEmbed('Yetki Yok', 'Bu komutu kullanma yetkin yok!')] });
    }
    
    const mention = getFirstMentionedUser(message);
    if (!mention) {
      return message.reply({ embeds: [createErrorEmbed('Hata', 'Bir kullanıcı etiketle!')] });
    }
    
    clearWarnings(mention.id);
    const embed = createSuccessEmbed('Uyarılar Temizlendi', `@${mention.username} kullanıcısının tüm uyarıları silindi.`);
    return message.reply({ embeds: [embed] });
  }
});

// !kick
commands.set('kick', {
  name: 'kick',
  description: 'Kullanıcıyı sunucudan atar',
  usage: '!kick <@kullanıcı> [sebep]',
  modOnly: true,
  async execute(message, args) {
    if (!(await checkModPermission(message))) {
      return message.reply({ embeds: [createErrorEmbed('Yetki Yok', 'Bu komutu kullanma yetkin yok!')] });
    }
    
    const mention = getFirstMentionedUser(message);
    if (!mention) {
      return message.reply({ embeds: [createErrorEmbed('Hata', 'Bir kullanıcı etiketle!')] });
    }
    
    const modUsername = message.author?.username || 'Moderatör';
    const reason = args.slice(1).join(' ') || 'Sebep belirtilmedi';
    
    try {
      await client.rest.kickMember(message.guildId, mention.id, reason);
      
      const embed = createModEmbed('Kullanıcı Atıldı', '')
        .addFields(
          { name: '👤 Kullanıcı', value: `@${mention.username}`, inline: true },
          { name: '👮 Moderatör', value: `@${modUsername}`, inline: true },
          { name: '📝 Sebep', value: reason }
        );
      
      await message.reply({ embeds: [embed] });
    } catch (e) {
      return message.reply({ embeds: [createErrorEmbed('Hata', `Kullanıcı atılamadı: ${e.message}`)] });
    }
  }
});

// !ban
commands.set('ban', {
  name: 'ban',
  description: 'Kullanıcıyı banlar',
  usage: '!ban <@kullanıcı> [sebep]',
  modOnly: true,
  async execute(message, args) {
    if (!(await checkModPermission(message))) {
      return message.reply({ embeds: [createErrorEmbed('Yetki Yok', 'Bu komutu kullanma yetkin yok!')] });
    }
    
    const mention = getFirstMentionedUser(message);
    if (!mention) {
      return message.reply({ embeds: [createErrorEmbed('Hata', 'Bir kullanıcı etiketle!')] });
    }
    
    const modUsername = message.author?.username || 'Moderatör';
    const reason = args.slice(1).join(' ') || 'Sebep belirtilmedi';
    
    // Onay butonu
    const confirmBtn = new ButtonBuilder()
      .setCustomId('ban_confirm')
      .setLabel('Onayla')
      .setStyle(ButtonStyle.Danger);
    
    const cancelBtn = new ButtonBuilder()
      .setCustomId('ban_cancel')
      .setLabel('İptal')
      .setStyle(ButtonStyle.Secondary);
    
    const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);
    
    const confirmEmbed = createInfoEmbed('Ban Onayı', `@${mention.username} kullanıcısını banlamak istediğine emin misin?`)
      .addFields({ name: '📝 Sebep', value: reason });
    
    const confirmMsg = await message.reply({ embeds: [confirmEmbed], components: [row.toJSON()] });
    
    const collector = new InteractionCollector(client, {
      messageId: confirmMsg.id,
      time: 30000,
      componentType: 2
    });
    
    collector.on('collect', async (interaction) => {
      const clickerId = interaction.user?.id || interaction.member?.user?.id;
      if (clickerId !== getUserId(message)) {
        await respondInteraction(interaction.id, interaction.token, {
          type: 4,
          data: { content: 'Bu buton sana ait değil!', flags: 64 }
        });
        return;
      }
      
      if (interaction.customId === 'ban_confirm') {
        try {
          await client.rest.banMember(message.guildId, mention.id, { 
            deleteMessageSeconds: 86400,
            reason 
          });
          
          const embed = createModEmbed('Kullanıcı Banlandı', '')
            .addFields(
              { name: '👤 Kullanıcı', value: `@${mention.username}`, inline: true },
              { name: '👮 Moderatör', value: `@${modUsername}`, inline: true },
              { name: '📝 Sebep', value: reason }
            );
          
          await respondInteraction(interaction.id, interaction.token, {
            type: 7,
            data: { embeds: [embed.toJSON()], components: [] }
          });
        } catch (e) {
          await respondInteraction(interaction.id, interaction.token, {
            type: 7,
            data: { embeds: [createErrorEmbed('Hata', `Ban başarısız: ${e.message}`).toJSON()], components: [] }
          });
        }
      } else {
        await respondInteraction(interaction.id, interaction.token, {
          type: 7,
          data: { embeds: [createInfoEmbed('İptal Edildi', 'Ban işlemi iptal edildi.').toJSON()], components: [] }
        });
      }
      
      collector.stop();
    });
  }
});

// !timeout
commands.set('timeout', {
  name: 'timeout',
  description: 'Kullanıcıyı susturur',
  usage: '!timeout <@kullanıcı> <dakika> [sebep]',
  modOnly: true,
  async execute(message, args) {
    if (!(await checkModPermission(message))) {
      return message.reply({ embeds: [createErrorEmbed('Yetki Yok', 'Bu komutu kullanma yetkin yok!')] });
    }
    
    const mention = getFirstMentionedUser(message);
    if (!mention) {
      return message.reply({ embeds: [createErrorEmbed('Hata', 'Bir kullanıcı etiketle!')] });
    }
    
    const modUsername = message.author?.username || 'Moderatör';
    const minutes = parseInt(args[1]) || 5;
    const reason = args.slice(2).join(' ') || 'Sebep belirtilmedi';
    
    try {
      await client.rest.timeoutMember(message.guildId, mention.id, minutes * 60 * 1000, reason);
      
      const embed = createModEmbed('Kullanıcı Susturuldu', '')
        .addFields(
          { name: '👤 Kullanıcı', value: `@${mention.username}`, inline: true },
          { name: '👮 Moderatör', value: `@${modUsername}`, inline: true },
          { name: '⏰ Süre', value: `${minutes} dakika`, inline: true },
          { name: '📝 Sebep', value: reason }
        );
      
      await message.reply({ embeds: [embed] });
    } catch (e) {
      return message.reply({ embeds: [createErrorEmbed('Hata', `Timeout başarısız: ${e.message}`)] });
    }
  }
});

// !untimeout
commands.set('untimeout', {
  name: 'untimeout',
  description: 'Susturmayı kaldırır',
  usage: '!untimeout <@kullanıcı>',
  modOnly: true,
  async execute(message, args) {
    if (!(await checkModPermission(message))) {
      return message.reply({ embeds: [createErrorEmbed('Yetki Yok', 'Bu komutu kullanma yetkin yok!')] });
    }
    
    const mention = getFirstMentionedUser(message);
    if (!mention) {
      return message.reply({ embeds: [createErrorEmbed('Hata', 'Bir kullanıcı etiketle!')] });
    }
    
    try {
      await client.rest.timeoutMember(message.guildId, mention.id, null);
      const embed = createSuccessEmbed('Susturma Kaldırıldı', `@${mention.username} artık konuşabilir.`);
      await message.reply({ embeds: [embed] });
    } catch (e) {
      return message.reply({ embeds: [createErrorEmbed('Hata', `İşlem başarısız: ${e.message}`)] });
    }
  }
});

// !clear
commands.set('clear', {
  name: 'clear',
  description: 'Mesajları temizler',
  usage: '!clear <miktar>',
  modOnly: true,
  async execute(message, args) {
    if (!(await checkModPermission(message))) {
      return message.reply({ embeds: [createErrorEmbed('Yetki Yok', 'Bu komutu kullanma yetkin yok!')] });
    }
    
    const amount = Math.min(Math.max(parseInt(args[0]) || 10, 1), 100);
    const userId = getUserId(message);
    
    try {
      const messages = await client.rest.getMessages(message.guildId, message.channelId, { limit: amount + 1 });
      const messageIds = messages.map(m => m.id);
      
      if (messageIds.length > 0) {
        await client.rest.bulkDeleteMessages(message.guildId, message.channelId, messageIds);
      }
      
      // Send ephemeral confirmation only visible to the command user
      await client.rest.createEphemeralMessage(message.guildId, message.channelId, userId, {
        embeds: [createSuccessEmbed('Temizlendi', `${messageIds.length} mesaj silindi.`).toJSON()]
      });
    } catch (e) {
      // Send ephemeral error message
      await client.rest.createEphemeralMessage(message.guildId, message.channelId, userId, {
        embeds: [createErrorEmbed('Hata', `Temizleme başarısız: ${e.message}`).toJSON()]
      });
    }
  }
});

// !role
commands.set('role', {
  name: 'role',
  description: 'Kullanıcıya rol verir veya alır',
  usage: '!role <@kullanıcı> <@rol>',
  modOnly: true,
  async execute(message, args) {
    if (!(await checkModPermission(message))) {
      return message.reply({ embeds: [createErrorEmbed('Yetki Yok', 'Bu komutu kullanma yetkin yok!')] });
    }
    
    const userMentionMatch = args[0]?.match(/<@!?(\d+)>/);
    const roleMentionMatch = args[1]?.match(/<@&(\d+)>/);
    
    if (!userMentionMatch || !roleMentionMatch) {
      return message.reply({ embeds: [createErrorEmbed('Hata', 'Kullanım: !role @kullanıcı @rol')] });
    }
    
    const userId = userMentionMatch[1];
    const roleId = roleMentionMatch[1];
    
    try {
      const member = await client.rest.getMember(message.guildId, userId);
      const hasRole = member.roles?.includes(roleId);
      
      if (hasRole) {
        await client.rest.removeMemberRole(message.guildId, userId, roleId);
        const embed = createSuccessEmbed('Rol Alındı', `${userMention(userId)} kullanıcısından <@&${roleId}> rolü alındı.`);
        await message.reply({ embeds: [embed] });
      } else {
        await client.rest.addMemberRole(message.guildId, userId, roleId);
        const embed = createSuccessEmbed('Rol Verildi', `${userMention(userId)} kullanıcısına <@&${roleId}> rolü verildi.`);
        await message.reply({ embeds: [embed] });
      }
    } catch (e) {
      return message.reply({ embeds: [createErrorEmbed('Hata', `Rol işlemi başarısız: ${e.message}`)] });
    }
  }
});

// !stats
commands.set('stats', {
  name: 'stats',
  description: 'Bot istatistiklerini gösterir',
  usage: '!stats',
  async execute(message) {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    
    const embed = createInfoEmbed('Bot İstatistikleri', '')
      .addFields(
        { name: '⏱️ Uptime', value: `${hours}s ${minutes}d ${seconds}sn`, inline: true },
        { name: '💾 Bellek', value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`, inline: true },
        { name: '📊 Komutlar', value: `${commands.size}`, inline: true },
        { name: '⚠️ Aktif Uyarılar', value: `${warnings.size} kullanıcı`, inline: true },
        { name: '🎉 Aktif Çekilişler', value: `${activeGiveaways.size}`, inline: true }
      )
      .setFooter({ text: `Node.js ${process.version}` });
    
    return message.reply({ embeds: [embed] });
  }
});

// !embed
commands.set('embed', {
  name: 'embed',
  description: 'Özel embed mesajı oluşturur',
  usage: '!embed <başlık> | <açıklama> | [renk]',
  modOnly: true,
  async execute(message, args) {
    if (!(await checkModPermission(message))) {
      return message.reply({ embeds: [createErrorEmbed('Yetki Yok', 'Bu komutu kullanma yetkin yok!')] });
    }
    
    const parts = args.join(' ').split('|').map(p => p.trim());
    if (parts.length < 2) {
      return message.reply({ embeds: [createErrorEmbed('Hata', 'Kullanım: !embed Başlık | Açıklama | Renk(opsiyonel)')] });
    }
    
    const [title, description, colorName] = parts;
    const color = Colors[colorName] || Colors.Blue;
    
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(color)
      .setTimestamp(new Date())
      .setFooter({ text: `${message.author.username} tarafından oluşturuldu` });
    
    try {
      await deleteMessage(message.guildId, message.channelId, message.id);
    } catch (e) {}
    
    await sendMessage(message.guildId, message.channelId, {
      embeds: [embed.toJSON()]
    });
  }
});

// ==================== AUTO-MODERATION ====================

async function handleAutoMod(message) {
  if (message.author?.bot) return false;
  
  const content = message.content || '';
  const userId = getUserId(message);
  const channelId = message.channelId || message.channel_id;
  const guildId = message.guildId || message.guild_id;
  
  // userId veya guildId yoksa işlem yapma
  if (!userId || !guildId) return false;
  
  // Owner/Admin/Mod kontrolü - muaf mı?
  if (await isExempt(guildId, userId)) {
    return false;
  }
  
  // Yasaklı kelime
  if (containsBannedWord(content)) {
    try {
      await deleteMessage(guildId, channelId, message.id);
      const warnData = addWarning(userId, 'Yasaklı kelime kullanımı');
      
      const embed = createModEmbed('Mesaj Silindi', `Yasaklı kelime kullandın!`)
        .addFields({ name: '⚠️ Uyarı', value: `${warnData.count}/${CONFIG.warningsForBan}` })
        .setColor(Colors.Red);
      
      // Ephemeral mesaj gönder - sadece kullanıcı görür
      await client.rest.createEphemeralMessage(guildId, channelId, userId, { 
        embeds: [embed.toJSON()] 
      });
      
      return true;
    } catch (e) {
      console.error('Yasaklı kelime işlemi hatası:', e.message);
    }
  }
  
  // Caps lock
  if (hasTooManyCaps(content)) {
    try {
      await deleteMessage(guildId, channelId, message.id);
      
      const embed = createModEmbed('Caps Lock!', `Lütfen caps lock kullanma!`)
        .setColor(Colors.Orange);
      
      // Ephemeral mesaj gönder - sadece kullanıcı görür
      await client.rest.createEphemeralMessage(guildId, channelId, userId, { 
        embeds: [embed.toJSON()] 
      });
      
      return true;
    } catch (e) {
      console.error('Caps lock işlemi hatası:', e.message);
    }
  }
  
  // Spam
  if (checkSpam(channelId, userId, content)) {
    try {
      await deleteMessage(guildId, channelId, message.id);
      const warnData = addWarning(userId, 'Spam');
      
      const embed = createModEmbed('Spam Algılandı', `Spam yapma!`)
        .addFields({ name: '⚠️ Uyarı', value: `${warnData.count}/${CONFIG.warningsForBan}` })
        .setColor(Colors.Red);
      
      // Ephemeral mesaj gönder - sadece kullanıcı görür
      await client.rest.createEphemeralMessage(guildId, channelId, userId, { 
        embeds: [embed.toJSON()] 
      });
      
      return true;
    } catch (e) {
      console.error('Spam işlemi hatası:', e.message);
    }
  }
  
  // Flood
  if (checkFlood(channelId, userId)) {
    try {
      await deleteMessage(guildId, channelId, message.id);
      
      const embed = createModEmbed('Yavaşla!', `Çok hızlı mesaj atıyorsun!`)
        .setColor(Colors.Orange);
      
      // Ephemeral mesaj gönder - sadece kullanıcı görür
      await client.rest.createEphemeralMessage(guildId, channelId, userId, { 
        embeds: [embed.toJSON()] 
      });
      
      return true;
    } catch (e) {
      console.error('Flood işlemi hatası:', e.message);
    }
  }
  
  return false;
}

// ==================== EVENT HANDLERS ====================

client.on('ready', () => {
  console.log('═'.repeat(50));
  console.log(`🤖 ${client.user?.username || 'Bot'} hazır!`);
  console.log(`📊 ${commands.size} komut yüklendi`);
  console.log(`🔧 Prefix: ${PREFIX}`);
  console.log('═'.repeat(50));
  console.log('\n📋 Komut Listesi:');
  
  const generalCmds = commands.filter(c => !c.modOnly);
  const modCmds = commands.filter(c => c.modOnly);
  
  console.log('\n  Genel Komutlar:');
  generalCmds.forEach(cmd => console.log(`    ${PREFIX}${cmd.name} - ${cmd.description}`));
  
  console.log('\n  Mod Komutları:');
  modCmds.forEach(cmd => console.log(`    ${PREFIX}${cmd.name} - ${cmd.description}`));
  
  console.log('\n' + '═'.repeat(50));
});

client.on('messageCreate', async (message) => {
  // Mesaj logla
  const author = message.author?.username || 'Unknown';
  const content = message.content || '[embed/attachment]';
  const channel = message.channelId || message.channel_id;
  console.log(`[MSG] #${channel} | ${author}: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`);
  
  // Bot mesajlarını atla
  if (message.author?.bot) return;
  
  // Auto-mod kontrolü
  const wasModerated = await handleAutoMod(message);
  if (wasModerated) return;
  
  // Prefix kontrolü
  if (!content.startsWith(PREFIX)) return;
  
  // Komutu parse et
  const args = content.slice(PREFIX.length).trim().split(/\s+/);
  const commandName = args.shift()?.toLowerCase();
  
  if (!commandName) return;
  
  // Komutu bul ve çalıştır
  const command = commands.get(commandName);
  if (!command) return;
  
  try {
    // Reply helper ekle
    message.reply = async (data) => {
      if (typeof data === 'string') {
        data = { content: data };
      }
      
      if (data.embeds) {
        data.embeds = data.embeds.map(e => e.toJSON ? e.toJSON() : e);
      }
      
      const guildId = message.guildId || message.guild_id;
      const channelId = message.channelId || message.channel_id;
      
      return sendMessage(guildId, channelId, {
        ...data,
        message_reference: { message_id: message.id }
      });
    };
    
    await command.execute(message, args);
  } catch (error) {
    console.error(`Komut hatası (${commandName}):`, error);
    
    try {
      const guildId = message.guildId || message.guild_id;
      const channelId = message.channelId || message.channel_id;
      
      await sendMessage(guildId, channelId, {
        embeds: [createErrorEmbed('Hata', `Komut çalıştırılırken bir hata oluştu: ${error.message}`).toJSON()],
        message_reference: { message_id: message.id }
      });
    } catch (e) {}
  }
});

client.on('interactionCreate', async (interaction) => {
  console.log(`[Interaction] Type: ${interaction.type}, CustomId: ${interaction.customId || 'N/A'}`);
});

client.on('error', (error) => {
  console.error('Client error:', error);
});

// ==================== START BOT ====================

const TOKEN = process.env.BOT_TOKEN;

if (!TOKEN) {
  console.error('❌ Token bulunamadı! BOT_TOKEN environment variable ayarla.');
  process.exit(1);
}

client.login(TOKEN).catch(err => {
  console.error('❌ Giriş başarısız:', err.message);
  process.exit(1);
});
