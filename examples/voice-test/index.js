/**
 * Jubbio.js Kütüphane Test Botu
 * 
 * Yapılan tüm değişiklikleri test eder:
 * 
 * !test1  → Voice state cache (VOICE_STATE_UPDATE member cache'i güncelliyor mu)
 * !test2  → fetchMember sonrası voice state korunuyor mu
 * !test3  → interaction.guild, message.guild, client.guilds.cache getter'ları
 * !test4  → Stub guild crash testi (guild.members, guild.channels erişimi)
 * !test5  → ApplicationCommandManager (client.application.commands.set/fetch)
 * !test6  → Guild commands (guild.commands.set/fetch)
 * !test7  → voiceAdapterCreator erişim yolları
 * 
 * Ses kanalına girdikten sonra komutları çalıştır.
 */

const { Client, GatewayIntentBits } = require('../../core/dist');

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN gerekli!');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent
  ]
});

// ── Voice state logla ──
client.on('voiceStateUpdate', (data) => {
  const guild = client.guilds.get(data.guild_id);
  const member = guild?.members.get(String(data.user_id));
  console.log(`\n🔊 VOICE_STATE_UPDATE → user:${data.user_id} channel:${data.channel_id} cached:${member?.voice?.channelId ?? 'yok'}`);
});

// ── Tüm komutlar tek handler'da ──
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const cmd = message.content.trim();
  if (!cmd.startsWith('!test')) return;

  const guildId = message.guildId;
  if (!guildId) return message.reply('Sunucuda çalıştır.');

  const guild = client.guilds.get(guildId);
  const userId = String(message.author.id);
  const pass = (t) => `✅ ${t}`;
  const fail = (t) => `❌ ${t}`;
  const check = (ok, t) => ok ? pass(t) : fail(t);

  try {
    // ═══════════════════════════════════════════
    // TEST 1: Voice state cache
    // ═══════════════════════════════════════════
    if (cmd === '!test1') {
      const cached = guild?.members.get(userId);
      const fromMessage = message.member;

      const lines = [
        '**TEST 1: Voice State Cache**',
        '',
        check(cached?.voice?.channelId, `guild.members cache → channelId: ${cached?.voice?.channelId ?? 'undefined'}`),
        check(fromMessage?.voice?.channelId, `message.member.voice → channelId: ${fromMessage?.voice?.channelId ?? 'undefined'}`),
        '',
        cached?.voice?.channelId
          ? pass('VOICE_STATE_UPDATE member cache\'i güncelliyor')
          : fail('Önce ses kanalına gir, sonra tekrar dene')
      ];
      return message.reply(lines.join('\n'));
    }

    // ═══════════════════════════════════════════
    // TEST 2: fetchMember voice state koruması
    // ═══════════════════════════════════════════
    if (cmd === '!test2') {
      const before = guild?.members.get(userId)?.voice?.channelId;

      let fetched, fetchErr;
      try { fetched = await guild.fetchMember(userId); }
      catch (e) { fetchErr = e.message; }

      const after = fetched?.voice?.channelId;
      const cacheAfter = guild?.members.get(userId)?.voice?.channelId;

      const lines = [
        '**TEST 2: fetchMember Voice State Koruması**',
        '',
        `Öncesi: \`${before ?? 'undefined'}\``,
        fetchErr ? fail(`fetchMember hata: ${fetchErr}`) : `Sonrası: \`${after ?? 'undefined'}\``,
        `Cache: \`${cacheAfter ?? 'undefined'}\``,
        '',
        !before ? '⚠️ Önce ses kanalına gir' :
        after ? pass('fetchMember voice state\'i koruyor') :
        fail('fetchMember voice state\'i sildi!')
      ];
      return message.reply(lines.join('\n'));
    }

    // ═══════════════════════════════════════════
    // TEST 3: Guild getter'ları
    // ═══════════════════════════════════════════
    if (cmd === '!test3') {
      const msgGuild = message.guild;
      const cacheGuild = client.guilds.cache.get(guildId);

      const lines = [
        '**TEST 3: Guild Getter\'ları**',
        '',
        check(msgGuild, `message.guild → ${msgGuild?.name ?? 'null'}`),
        check(msgGuild?.id === guildId, `message.guild.id eşleşiyor → ${msgGuild?.id}`),
        check(cacheGuild, `client.guilds.cache.get() → ${cacheGuild?.name ?? 'null'}`),
        check(cacheGuild === msgGuild, `cache.get() === message.guild → ${cacheGuild === msgGuild}`),
        check(typeof msgGuild?.voiceAdapterCreator === 'function', `guild.voiceAdapterCreator → ${typeof msgGuild?.voiceAdapterCreator}`),
        check(msgGuild?.members, `guild.members → ${msgGuild?.members?.size ?? 'yok'} üye`),
        check(msgGuild?.channels, `guild.channels → ${msgGuild?.channels?.size ?? 'yok'} kanal`),
        check(msgGuild?.commands, `guild.commands → ${typeof msgGuild?.commands?.set}`),
      ];
      return message.reply(lines.join('\n'));
    }

    // ═══════════════════════════════════════════
    // TEST 4: Stub guild crash testi
    // ═══════════════════════════════════════════
    if (cmd === '!test4') {
      const lines = ['**TEST 4: Stub Guild Crash Testi**', ''];

      // message.member.guild erişimi
      try {
        const memberGuild = message.member?.guild;
        const members = memberGuild?.members;
        const channels = memberGuild?.channels;
        lines.push(pass(`member.guild erişimi crash etmedi`));
        lines.push(check(members !== undefined, `member.guild.members → ${members ? 'var' : 'undefined'}`));
        lines.push(check(channels !== undefined, `member.guild.channels → ${channels ? 'var' : 'undefined'}`));

        // .get() çağrısı crash etmemeli
        const testGet = members?.get?.('nonexistent');
        lines.push(pass(`members.get() crash etmedi → ${testGet ?? 'undefined'}`));
      } catch (e) {
        lines.push(fail(`CRASH: ${e.message}`));
      }

      // Collection.cache erişimi
      try {
        const cache = client.guilds.cache;
        lines.push(check(cache === client.guilds, `client.guilds.cache === client.guilds → ${cache === client.guilds}`));
      } catch (e) {
        lines.push(fail(`cache CRASH: ${e.message}`));
      }

      return message.reply(lines.join('\n'));
    }

    // ═══════════════════════════════════════════
    // TEST 5: ApplicationCommandManager
    // ═══════════════════════════════════════════
    if (cmd === '!test5') {
      const lines = ['**TEST 5: ApplicationCommandManager**', ''];

      // API varlık kontrolü
      lines.push(check(client.application, `client.application → ${client.application ? 'var' : 'null'}`));
      lines.push(check(typeof client.application?.commands?.set === 'function', `commands.set → ${typeof client.application?.commands?.set}`));
      lines.push(check(typeof client.application?.commands?.create === 'function', `commands.create → ${typeof client.application?.commands?.create}`));
      lines.push(check(typeof client.application?.commands?.fetch === 'function', `commands.fetch → ${typeof client.application?.commands?.fetch}`));
      lines.push(check(typeof client.application?.commands?.delete === 'function', `commands.delete → ${typeof client.application?.commands?.delete}`));
      lines.push(check(typeof client.application?.commands?.edit === 'function', `commands.edit → ${typeof client.application?.commands?.edit}`));
      lines.push(check(client.application?.commands?.cache, `commands.cache → ${client.application?.commands?.cache ? 'var' : 'yok'}`));
      lines.push(`**applicationId:** \`${client.applicationId}\``);
      lines.push('');

      // fetch testi
      if (client.application?.commands?.fetch) {
        try {
          const cmds = await client.application.commands.fetch();
          lines.push(pass(`fetch() → ${cmds.size} komut`));
          for (const [, c] of cmds) {
            lines.push(`  • \`/${c.name}\``);
          }
        } catch (e) {
          lines.push(fail(`fetch() hata: ${e.message}`));
        }
      }

      return message.reply(lines.join('\n'));
    }

    // ═══════════════════════════════════════════
    // TEST 6: Guild commands
    // ═══════════════════════════════════════════
    if (cmd === '!test6') {
      const lines = ['**TEST 6: Guild Commands**', ''];

      lines.push(check(guild?.commands, `guild.commands → ${guild?.commands ? 'var' : 'yok'}`));
      lines.push(check(typeof guild?.commands?.set === 'function', `guild.commands.set → ${typeof guild?.commands?.set}`));
      lines.push(check(typeof guild?.commands?.fetch === 'function', `guild.commands.fetch → ${typeof guild?.commands?.fetch}`));
      lines.push('');

      // set + fetch testi
      if (guild?.commands?.set) {
        const testCmds = [
          { name: 'testping', description: 'Guild test komutu' },
        ];
        try {
          const result = await guild.commands.set(testCmds);
          lines.push(pass(`guild.commands.set() → ${result.size} komut`));
        } catch (e) {
          lines.push(fail(`set() hata: ${e.message}`));
        }

        try {
          const fetched = await guild.commands.fetch();
          lines.push(pass(`guild.commands.fetch() → ${fetched.size} komut`));
          for (const [, c] of fetched) {
            lines.push(`  • \`/${c.name}\``);
          }
        } catch (e) {
          lines.push(fail(`fetch() hata: ${e.message}`));
        }
      }

      return message.reply(lines.join('\n'));
    }

    // ═══════════════════════════════════════════
    // TEST 7: voiceAdapterCreator erişim yolları
    // ═══════════════════════════════════════════
    if (cmd === '!test7') {
      const cached = guild?.members.get(userId);
      const channelId = cached?.voice?.channelId;

      const lines = ['**TEST 7: voiceAdapterCreator Erişim Yolları**', ''];

      // guild.voiceAdapterCreator
      const fromGuild = guild?.voiceAdapterCreator;
      lines.push(check(typeof fromGuild === 'function', `guild.voiceAdapterCreator → ${typeof fromGuild}`));

      // client.voice.adapters.get()
      const fromAdapters = client.voice.adapters.get(guildId);
      lines.push(check(typeof fromAdapters === 'function', `client.voice.adapters.get() → ${typeof fromAdapters}`));

      // İkisi aynı mı
      lines.push(check(fromGuild === fromAdapters, `guild.voiceAdapterCreator === adapters.get() → ${fromGuild === fromAdapters}`));

      // message.guild üzerinden
      const fromMsgGuild = message.guild?.voiceAdapterCreator;
      lines.push(check(typeof fromMsgGuild === 'function', `message.guild.voiceAdapterCreator → ${typeof fromMsgGuild}`));

      lines.push('');
      lines.push(channelId
        ? pass(`Ses kanalındasın: ${channelId} — joinVoiceChannel çağrılabilir`)
        : '⚠️ Ses kanalına gir, sonra tekrar dene'
      );

      return message.reply(lines.join('\n'));
    }

  } catch (err) {
    console.error(`❌ ${cmd} hatası:`, err);
    await message.reply(`❌ Hata: \`${err.message}\``);
  }
});

// ── Interaction testi ──
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;
  if (interaction.commandName !== 'voicetest') return;

  try {
    const guild = interaction.guild;
    const cached = guild?.members.get(String(interaction.user.id));
    const adapter = guild?.voiceAdapterCreator;

    const lines = [
      '**Interaction Voice Test**',
      '',
      `interaction.guild → ${guild?.name ?? 'null'}`,
      `interaction.guild.voiceAdapterCreator → ${typeof adapter}`,
      `interaction.member.voice.channelId → ${interaction.member?.voice?.channelId ?? 'undefined'}`,
      `cache voice.channelId → ${cached?.voice?.channelId ?? 'undefined'}`,
      '',
      (interaction.member?.voice?.channelId || cached?.voice?.channelId)
        ? '✅ Seni seste görüyorum!'
        : '❌ Seste göremiyorum, önce ses kanalına gir'
    ];

    await interaction.reply(lines.join('\n'));
  } catch (err) {
    console.error('❌ Interaction hatası:', err);
    await interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
  }
});

client.on('ready', () => {
  console.log(`✅ ${client.user?.username} hazır — ${client.guilds.size} guild`);
  console.log('');
  console.log('Komutlar:');
  console.log('  !test1 → Voice state cache');
  console.log('  !test2 → fetchMember voice koruması');
  console.log('  !test3 → Guild getter\'ları (message.guild, cache)');
  console.log('  !test4 → Stub guild crash testi');
  console.log('  !test5 → ApplicationCommandManager');
  console.log('  !test6 → Guild commands');
  console.log('  !test7 → voiceAdapterCreator erişim yolları');
  console.log('  /voicetest → Interaction voice testi');
});

client.on('error', (err) => console.error('❌', err));
client.login(BOT_TOKEN).catch(console.error);
