/**
 * Test Bot - jubbio.js'i ilk defa deneyen bir developer olarak yazıyorum
 */

const { Client, GatewayIntentBits, EmbedBuilder, Colors } = require('@jubbio/core');

// Bot token'ı nereden alacağım? README'de yazmıyor!
// Jubbio'da bot nasıl oluşturulur? Developer portal var mı?
const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN environment variable gerekli!');
  console.error('Nasıl alınır? ... README\'de bilgi yok :(');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent // Mesaj içeriğini okumak için gerekli mi?
  ]
});

client.on('ready', () => {
  console.log(`✅ ${client.user?.username} is online!`);
  console.log(`📍 ${client.guilds.size} guild'de`);
  
  // Slash komutlarını nasıl kaydedeceğim?
  // README'de registerCommands veya benzeri bir method göremedim
  // Discord.js'de REST API ile yapılıyor, burada nasıl?
});

client.on('messageCreate', async (message) => {
  // Bot'un kendi mesajlarını ignore et
  if (message.author.bot) return;
  
  if (message.content === '!ping') {
    await message.reply('🏓 Pong!');
  }
  
  if (message.content === '!embed') {
    const embed = new EmbedBuilder()
      .setTitle('Test Embed')
      .setDescription('Bu bir test embed\'i')
      .setColor(Colors.Blue)
      .addFields(
        { name: 'Field 1', value: 'Value 1', inline: true },
        { name: 'Field 2', value: 'Value 2', inline: true }
      )
      .setTimestamp();
    
    await message.reply({ embeds: [embed] });
  }
  
  if (message.content === '!userinfo') {
    // message.author'da hangi bilgiler var?
    // avatarURL() method'u var mı? displayAvatarURL()?
    const embed = new EmbedBuilder()
      .setTitle(`${message.author.username}`)
      .setDescription(`ID: ${message.author.id}`)
      .setColor(Colors.Green);
    
    await message.reply({ embeds: [embed] });
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;
  
  // Slash komutları çalışacak mı? Nasıl kaydedeceğim?
  if (interaction.commandName === 'ping') {
    await interaction.reply('🏓 Pong!');
  }
  
  if (interaction.commandName === 'userinfo') {
    // interaction.user var mı? interaction.member var mı?
    const user = interaction.user;
    await interaction.reply(`User: ${user.username} (${user.id})`);
  }
});

client.on('error', (error) => {
  console.error('❌ Client error:', error);
});

// Debug event var mı? Bağlantı sorunlarını nasıl debug edeceğim?
client.on('debug', (msg) => {
  console.log(`[DEBUG] ${msg}`);
});

console.log('🔌 Connecting...');
client.login(BOT_TOKEN).catch(console.error);
