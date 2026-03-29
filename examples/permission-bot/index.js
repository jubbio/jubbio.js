/**
 * Permission Bot - Permissions sınıfının tüm metodlarını test eden bot
 *
 * Komutlar:
 *   !perms              - Tüm yetkileri listele
 *   !isadmin            - Admin mi kontrol et
 *   !hasperm <perm>     - Belirli bir yetkiye sahip mi (has)
 *   !hasany <p1> <p2>   - Herhangi birine sahip mi (any)
 *   !missing <p1> <p2>  - Eksik yetkileri göster (missing)
 *   !add <p1> <p2>      - Yetki ekle ve sonucu göster (add)
 *   !remove <p1> <p2>   - Yetki kaldır ve sonucu göster (remove)
 *   !equals             - İki permissions karşılaştır (equals)
 *   !clone              - Permissions klonla (clone)
 *   !freeze             - Freeze test (freeze)
 *   !serialize          - toJSON/toString/bits çıktısı (toJSON, toString, bits)
 *   !toarray            - Yetki isimlerini dizi olarak göster (toArray)
 *   !noadmin <perm>     - Admin bypass olmadan kontrol (checkAdmin=false)
 */

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  Colors,
  GuildMember,
  PermissionFlags,
} = require('@jubbio/core');

const BOT_TOKEN = process.env.BOT_TOKEN;
const PREFIX = '!';

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN environment variable gerekli!');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

client.on('ready', () => {
  console.log(`✅ ${client.user?.username} is online!`);
  console.log(`📋 Mevcut sunucular: ${client.guilds.size} adet`);
  for (const [id, guild] of client.guilds) {
    console.log(`   - ${guild.name} (${id})`);
  }
});

client.on('guildCreate', (guild) => {
  console.log(`🆕 [GUILD_CREATE] Yeni sunucuya eklendi: ${guild.name} (${guild.id})`);
  console.log(`   Toplam sunucu: ${client.guilds.size}`);
});

client.on('guildDelete', (guild) => {
  console.log(`🗑️ [GUILD_DELETE] Sunucudan çıkarıldı: ${guild.name} (${guild.id})`);
  console.log(`   Toplam sunucu: ${client.guilds.size}`);
});

/**
 * Mesajdan member resolve et (cache veya REST)
 */
async function resolveMember(message) {
  if (message.member) return message.member;
  if (!message.guildId) return null;

  try {
    const guild = client.guilds.get(message.guildId);
    if (!guild) return null;
    const data = await client.rest.getMember(message.guildId, String(message.author.id));
    if (!data) return null;
    data.user = data.user || { id: message.author.id, username: message.author.username };
    return new GuildMember(client, guild, data);
  } catch {
    return null;
  }
}

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args.shift()?.toLowerCase();
  const member = await resolveMember(message);
  const name = member?.displayName || message.author.username;

  if (!member?.permissions) {
    if (['perms', 'permissions', 'isadmin', 'hasperm', 'hasany', 'missing',
         'add', 'remove', 'equals', 'clone', 'freeze', 'serialize', 'toarray', 'noadmin'].includes(command)) {
      return message.reply('Üye bilgisi alınamadı.');
    }
    return;
  }

  const perms = member.permissions;

  // ─── !perms ───
  if (command === 'perms' || command === 'permissions') {
    const checkList = [
      { key: 'Administrator', label: 'Yönetici' },
      { key: 'ManageGuild', label: 'Sunucuyu Yönet' },
      { key: 'ManageChannels', label: 'Kanalları Yönet' },
      { key: 'ManageRoles', label: 'Rolleri Yönet' },
      { key: 'ManageMessages', label: 'Mesajları Yönet' },
      { key: 'KickMembers', label: 'Üyeleri At' },
      { key: 'BanMembers', label: 'Üyeleri Yasakla' },
      { key: 'ModerateMembers', label: 'Üyeleri Modere Et' },
      { key: 'SendMessages', label: 'Mesaj Gönder' },
      { key: 'ViewChannel', label: 'Kanalları Görüntüle' },
      { key: 'Connect', label: 'Ses Kanalına Bağlan' },
      { key: 'Speak', label: 'Konuş' },
    ];

    const lines = checkList.map(({ key, label }) =>
      `${perms.has(key) ? '✅' : '❌'} ${label} (\`${key}\`)`
    );

    const embed = new EmbedBuilder()
      .setTitle(`🔐 ${name} - Yetki Kontrolü`)
      .setDescription(lines.join('\n'))
      .setColor(perms.has('Administrator') ? Colors.Green : Colors.Orange)
      .setTimestamp();

    return message.reply({ embeds: [embed] });
  }

  // ─── !isadmin ───
  if (command === 'isadmin') {
    const isAdmin = perms.has('Administrator');
    return message.reply(isAdmin
      ? `✅ **${name}** yönetici yetkisine sahip.`
      : `❌ **${name}** yönetici yetkisine sahip değil.`
    );
  }

  // ─── !hasperm <perm> ───
  if (command === 'hasperm') {
    if (!args[0]) return message.reply('Kullanım: `!hasperm ManageMessages`');
    const result = perms.has(args[0]);
    return message.reply(result
      ? `✅ **${name}** \`${args[0]}\` yetkisine sahip.`
      : `❌ **${name}** \`${args[0]}\` yetkisine sahip değil.`
    );
  }

  // ─── !hasany <p1> <p2> ... ───
  if (command === 'hasany') {
    if (args.length === 0) return message.reply('Kullanım: `!hasany ManageMessages KickMembers`');
    const result = perms.any(args);
    return message.reply(result
      ? `✅ **${name}** şu yetkilerden en az birine sahip: \`${args.join('`, `')}\``
      : `❌ **${name}** şu yetkilerden hiçbirine sahip değil: \`${args.join('`, `')}\``
    );
  }

  // ─── !missing <p1> <p2> ... ───
  if (command === 'missing') {
    if (args.length === 0) return message.reply('Kullanım: `!missing ManageMessages KickMembers BanMembers`');
    const result = perms.missing(args);
    if (result.length === 0) {
      return message.reply(`✅ **${name}** istenen tüm yetkilere sahip.`);
    }
    return message.reply(`❌ **${name}** şu yetkilere sahip değil: \`${result.join('`, `')}\``);
  }

  // ─── !add <p1> <p2> ... ───
  if (command === 'add') {
    if (args.length === 0) return message.reply('Kullanım: `!add ManageMessages KickMembers`');
    const copy = perms.clone();
    copy.add(...args);
    const before = perms.toArray();
    const after = copy.toArray();
    const added = after.filter(p => !before.includes(p));
    const embed = new EmbedBuilder()
      .setTitle(`➕ Yetki Ekleme Simülasyonu`)
      .setDescription([
        `**Önceki:** ${before.length} yetki`,
        `**Sonraki:** ${after.length} yetki`,
        `**Eklenen:** ${added.length > 0 ? added.map(p => `\`${p}\``).join(', ') : 'Zaten hepsi mevcut'}`,
      ].join('\n'))
      .setColor(Colors.Blue)
      .setTimestamp();
    return message.reply({ embeds: [embed] });
  }

  // ─── !remove <p1> <p2> ... ───
  if (command === 'remove') {
    if (args.length === 0) return message.reply('Kullanım: `!remove ManageMessages KickMembers`');
    const copy = perms.clone();
    copy.remove(...args);
    const before = perms.toArray();
    const after = copy.toArray();
    const removed = before.filter(p => !after.includes(p));
    const embed = new EmbedBuilder()
      .setTitle(`➖ Yetki Kaldırma Simülasyonu`)
      .setDescription([
        `**Önceki:** ${before.length} yetki`,
        `**Sonraki:** ${after.length} yetki`,
        `**Kaldırılan:** ${removed.length > 0 ? removed.map(p => `\`${p}\``).join(', ') : 'Zaten hiçbiri yoktu'}`,
      ].join('\n'))
      .setColor(Colors.Red)
      .setTimestamp();
    return message.reply({ embeds: [embed] });
  }

  // ─── !equals ───
  if (command === 'equals') {
    const copy = perms.clone();
    const isEqual = perms.equals(copy);
    const modified = perms.clone();
    modified.add('PrioritySpeaker');
    const isNotEqual = perms.equals(modified);
    const embed = new EmbedBuilder()
      .setTitle(`⚖️ Equals Testi`)
      .setDescription([
        `**perms.equals(clone):** ${isEqual ? '✅ true' : '❌ false'}`,
        `**perms.equals(modified):** ${isNotEqual ? '✅ true' : '❌ false'}`,
        ``,
        `Orijinal bits: \`${perms.toJSON()}\``,
        `Clone bits: \`${copy.toJSON()}\``,
        `Modified bits: \`${modified.toJSON()}\``,
      ].join('\n'))
      .setColor(Colors.Purple)
      .setTimestamp();
    return message.reply({ embeds: [embed] });
  }

  // ─── !clone ───
  if (command === 'clone') {
    const copy = perms.clone();
    copy.add('PrioritySpeaker');
    const embed = new EmbedBuilder()
      .setTitle(`📋 Clone Testi`)
      .setDescription([
        `**Orijinal:** \`${perms.toJSON()}\` (${perms.toArray().length} yetki)`,
        `**Clone (PrioritySpeaker eklendi):** \`${copy.toJSON()}\` (${copy.toArray().length} yetki)`,
        `**Orijinal etkilendi mi:** ${perms.equals(copy) ? '❌ Evet (hata!)' : '✅ Hayır (doğru)'}`,
      ].join('\n'))
      .setColor(Colors.Aqua)
      .setTimestamp();
    return message.reply({ embeds: [embed] });
  }

  // ─── !freeze ───
  if (command === 'freeze') {
    const frozen = perms.clone().freeze();
    let frozeError = false;
    try {
      frozen.add('PrioritySpeaker');
    } catch (e) {
      frozeError = true;
    }
    const embed = new EmbedBuilder()
      .setTitle(`🧊 Freeze Testi`)
      .setDescription([
        `**freeze() sonrası add() çağrıldı**`,
        frozeError
          ? `✅ TypeError fırlatıldı — freeze çalışıyor.`
          : `❌ Hata fırlatılmadı — freeze çalışmıyor!`,
      ].join('\n'))
      .setColor(frozeError ? Colors.Green : Colors.Red)
      .setTimestamp();
    return message.reply({ embeds: [embed] });
  }

  // ─── !serialize ───
  if (command === 'serialize') {
    const embed = new EmbedBuilder()
      .setTitle(`📦 Serileştirme Testi`)
      .setDescription([
        `**toJSON():** \`${perms.toJSON()}\``,
        `**toString():** \`${perms.toString()}\``,
        `**bits:** \`${perms.bits}\``,
        `**typeof bits:** \`${typeof perms.bits}\``,
      ].join('\n'))
      .setColor(Colors.Gold)
      .setTimestamp();
    return message.reply({ embeds: [embed] });
  }

  // ─── !toarray ───
  if (command === 'toarray') {
    const arr = perms.toArray();
    const embed = new EmbedBuilder()
      .setTitle(`📃 toArray Testi`)
      .setDescription([
        `**Toplam:** ${arr.length} yetki`,
        ``,
        arr.map(p => `• \`${p}\``).join('\n') || 'Hiç yetki yok',
      ].join('\n'))
      .setColor(Colors.DarkGreen)
      .setTimestamp();
    return message.reply({ embeds: [embed] });
  }

  // ─── !noadmin <perm> ───
  if (command === 'noadmin') {
    if (!args[0]) return message.reply('Kullanım: `!noadmin ManageMessages`');
    const withAdmin = perms.has(args[0], true);
    const withoutAdmin = perms.has(args[0], false);
    const embed = new EmbedBuilder()
      .setTitle(`🔒 Admin Bypass Testi — \`${args[0]}\``)
      .setDescription([
        `**has('${args[0]}', true):** ${withAdmin ? '✅ true' : '❌ false'} (admin bypass açık)`,
        `**has('${args[0]}', false):** ${withoutAdmin ? '✅ true' : '❌ false'} (admin bypass kapalı)`,
      ].join('\n'))
      .setColor(Colors.DarkPurple)
      .setTimestamp();
    return message.reply({ embeds: [embed] });
  }
});

client.on('error', (error) => {
  console.error('❌ Client error:', error);
});

client.login(BOT_TOKEN).catch(console.error);
