<p align="center">
  <img src="https://cdn.jubbio.com/assets/logo/jubbio-logo.png" alt="Jubbio" width="70" />
</p>

<h1 align="center">jubbio.js API Documentation</h1>

<p align="center">
  <strong>Complete API reference for @jubbio/core and @jubbio/voice</strong>
</p>

---

## Table of Contents

- [Client](#client)
- [Events](#events)
- [Structures](#structures)
- [Interactions](#interactions)
- [Builders](#builders)
- [Permissions](#permissions)
- [Collectors](#collectors)
- [Sharding](#sharding)
- [REST API](#rest-api)
- [Voice](#voice)
- [Enums & Constants](#enums--constants)
- [Formatting Utilities](#formatting-utilities)

---

## Client

### Creating a Client

```javascript
import { Client, GatewayIntentBits } from '@jubbio/core';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ]
});
```

### Client Options

| Option | Type | Description |
|--------|------|-------------|
| `intents` | `GatewayIntentBits[]` | Required. Gateway intents to subscribe to |
| `shards` | `[number, number]` | Optional. `[shard_id, total_shards]` for sharding |
| `gatewayUrl` | `string` | Optional. Custom gateway WebSocket URL |
| `apiUrl` | `string` | Optional. Custom REST API base URL |

### Client Properties

| Property | Type | Description |
|----------|------|-------------|
| `user` | `User \| null` | The bot user (available after ready) |
| `guilds` | `Collection<string, Guild>` | Cache of guilds the bot is in |
| `channels` | `Collection<string, Channel>` | Cache of channels |
| `rest` | `REST` | REST API client |
| `voice` | `{ adapters: Map }` | Voice adapter manager |
| `ping` | `number` | Gateway heartbeat latency in ms (-1 until first heartbeat ack) |

### Client Methods

#### login(token)
Connect to the gateway and authenticate.

```javascript
await client.login(process.env.BOT_TOKEN);
```

#### destroy()
Disconnect from the gateway and cleanup resources.

```javascript
client.destroy();
```

---

## Events

Subscribe to events using `client.on(event, callback)`.

### ready
Emitted when the client is connected and ready.

```javascript
client.on('ready', () => {
  console.log(`Logged in as ${client.user.username}`);
});
```

### messageCreate
Emitted when a message is created.

```javascript
client.on('messageCreate', async (message) => {
  // message: Message
  console.log(`${message.author.username}: ${message.content}`);
  
  if (message.content === '!ping') {
    await message.reply('Pong!');
  }
});
```

### messageUpdate
Emitted when a message is edited.

```javascript
client.on('messageUpdate', (oldMessage, newMessage) => {
  console.log(`Message edited: ${newMessage.content}`);
});
```

### messageDelete
Emitted when a message is deleted.

```javascript
client.on('messageDelete', (message) => {
  console.log(`Message deleted: ${message.id}`);
});
```

### messageDeleteBulk
Emitted when multiple messages are deleted.

```javascript
client.on('messageDeleteBulk', (messages) => {
  console.log(`${messages.length} messages deleted`);
});
```

### interactionCreate
Emitted when an interaction is received (slash commands, buttons, etc.).

```javascript
client.on('interactionCreate', async (interaction) => {
  if (interaction.isCommand()) {
    // Handle slash command
  } else if (interaction.isButton()) {
    // Handle button click
  } else if (interaction.isSelectMenu()) {
    // Handle select menu
  } else if (interaction.isModalSubmit()) {
    // Handle modal submit
  }
});
```

### guildCreate
Emitted when the bot joins a guild.

```javascript
client.on('guildCreate', (guild) => {
  console.log(`Joined guild: ${guild.name}`);
});
```

### guildUpdate
Emitted when a guild is updated.

```javascript
client.on('guildUpdate', (oldGuild, newGuild) => {
  console.log(`Guild updated: ${newGuild.name}`);
});
```

### guildDelete
Emitted when the bot leaves a guild.

```javascript
client.on('guildDelete', (guild) => {
  console.log(`Left guild: ${guild.id}`);
});
```

### guildMemberAdd
Emitted when a member joins a guild.

```javascript
client.on('guildMemberAdd', (member) => {
  console.log(`${member.user.username} joined ${member.guild.name}`);
});
```

### guildMemberUpdate
Emitted when a member is updated (roles, nickname, etc.).

```javascript
client.on('guildMemberUpdate', (oldMember, newMember) => {
  console.log(`Member updated: ${newMember.user.username}`);
});
```

### guildMemberRemove
Emitted when a member leaves a guild.

```javascript
client.on('guildMemberRemove', (member) => {
  console.log(`${member.user.username} left`);
});
```

### channelCreate
Emitted when a channel is created.

```javascript
client.on('channelCreate', (channel) => {
  console.log(`Channel created: ${channel.name}`);
});
```

### channelUpdate
Emitted when a channel is updated.

```javascript
client.on('channelUpdate', (oldChannel, newChannel) => {
  console.log(`Channel updated: ${newChannel.name}`);
});
```

### channelDelete
Emitted when a channel is deleted.

```javascript
client.on('channelDelete', (channel) => {
  console.log(`Channel deleted: ${channel.name}`);
});
```

### roleCreate
Emitted when a role is created.

```javascript
client.on('roleCreate', (role) => {
  console.log(`Role created: ${role.name}`);
});
```

### roleUpdate
Emitted when a role is updated.

```javascript
client.on('roleUpdate', (oldRole, newRole) => {
  console.log(`Role updated: ${newRole.name}`);
});
```

### roleDelete
Emitted when a role is deleted.

```javascript
client.on('roleDelete', (role) => {
  console.log(`Role deleted: ${role.id}`);
});
```

### voiceStateUpdate
Emitted when a user's voice state changes.

```javascript
client.on('voiceStateUpdate', (oldState, newState) => {
  if (!oldState.channelId && newState.channelId) {
    console.log(`${newState.userId} joined voice channel`);
  } else if (oldState.channelId && !newState.channelId) {
    console.log(`${oldState.userId} left voice channel`);
  }
});
```

### typingStart
Emitted when a user starts typing.

```javascript
client.on('typingStart', (data) => {
  console.log(`User ${data.userId} is typing in ${data.channelId}`);
});
```

### error
Emitted when an error occurs.

```javascript
client.on('error', (error) => {
  console.error('Client error:', error);
});
```

### debug
Emitted for debug information.

```javascript
client.on('debug', (message) => {
  console.log('[DEBUG]', message);
});
```

### raw
Emitted for unhandled gateway events.

```javascript
client.on('raw', (eventType, data) => {
  console.log(`Raw event: ${eventType}`, data);
});
```

---

## Structures

### User

Represents a Jubbio user.

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | User ID |
| `username` | `string` | Username |
| `displayName` | `string` | Display name |
| `avatarUrl` | `string \| null` | Avatar URL |
| `bot` | `boolean` | Whether user is a bot |

#### Methods

```javascript
// Get user tag
user.tag // "username"

// Get avatar URL (with fallback to default)
user.displayAvatarURL()

// Get default avatar URL
user.defaultAvatarURL
```

### Guild

Represents a Jubbio guild (server).

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Guild ID |
| `name` | `string` | Guild name |
| `icon` | `string \| null` | Icon hash |
| `ownerId` | `string` | Owner user ID |
| `memberCount` | `number` | Member count |
| `channels` | `Collection<string, Channel>` | Guild channels |
| `roles` | `Collection<string, Role>` | Guild roles |
| `members` | `Collection<string, GuildMember>` | Cached members |

#### Methods

```javascript
// Get icon URL
guild.iconURL({ size: 128 })

// Fetch a member
const member = await guild.fetchMember(userId);

// Fetch members list (paginated)
const result = await guild.fetchMembers({ limit: 50 });
const nextPage = await guild.fetchMembers({ limit: 50, cursor: result.next_cursor });

// Get voice adapter (for @jubbio/voice)
guild.voiceAdapterCreator
```

### GuildMember

Represents a member in a guild.

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `user` | `User` | The user |
| `guild` | `Guild` | The guild |
| `nickname` | `string \| null` | Guild nickname |
| `roles` | `string[]` | Role IDs |
| `joinedAt` | `Date` | When member joined |
| `permissions` | `Permissions` | Member permissions |
| `voice` | `object` | Voice state |

#### Methods

```javascript
// Check permission
member.permissions.has('ManageMessages') // true/false
member.permissions.has(PermissionFlagsBits.BanMembers)

// Get all permissions as array
member.permissions.toArray() // ['SendMessages', 'ViewChannel', ...]

// Voice state
member.voice.channelId // Current voice channel ID or null
member.voice.selfMute  // Is self-muted
member.voice.selfDeaf  // Is self-deafened
```

### Message

Represents a message.

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Message ID |
| `content` | `string` | Message content |
| `author` | `User` | Message author |
| `channelId` | `string` | Channel ID |
| `guildId` | `string \| undefined` | Guild ID |
| `createdAt` | `Date` | Creation timestamp |
| `editedAt` | `Date \| null` | Edit timestamp |
| `embeds` | `Embed[]` | Message embeds |
| `attachments` | `Attachment[]` | Message attachments |
| `mentions` | `MessageMentions` | Mentioned users/roles |

#### Methods

```javascript
// Reply to message
await message.reply('Hello!');
await message.reply({ content: 'Hello!', embeds: [embed] });

// Edit message (if author is bot)
await message.edit('Updated content');

// Delete message
await message.delete();

// Add reaction
await message.react('👍');
```

### Channel

Represents a channel.

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Channel ID |
| `name` | `string` | Channel name |
| `type` | `ChannelType` | Channel type |
| `guildId` | `string \| undefined` | Guild ID |
| `parentId` | `string \| null` | Parent category ID |
| `position` | `number` | Position in list |

#### Methods

```javascript
// Check channel type
channel.isTextBased() // true for text channels
channel.isVoiceBased() // true for voice channels

// Send message (TextChannel)
await channel.send('Hello!');
await channel.send({ embeds: [embed] });

// Await messages (TextChannel)
const collected = await channel.awaitMessages({
  filter: (m) => m.author.id === userId,
  max: 1,
  time: 30000
});
```

### Collection

Extended Map with utility methods.

```javascript
// Get first item
collection.first()

// Get last item
collection.last()

// Get random item
collection.random()

// Find item
collection.find(item => item.name === 'test')

// Filter items
collection.filter(item => item.type === 0)

// Map items
collection.map(item => item.name)
```

---

## Interactions

### Base Interaction

All interactions share these properties and methods.

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Interaction ID |
| `type` | `InteractionType` | Interaction type |
| `guildId` | `string \| undefined` | Guild ID |
| `channelId` | `string \| undefined` | Channel ID |
| `user` | `User` | User who triggered |
| `member` | `GuildMember \| undefined` | Guild member |
| `token` | `string` | Interaction token |
| `replied` | `boolean` | Whether replied |
| `deferred` | `boolean` | Whether deferred |

#### Type Guards

```javascript
interaction.isCommand()     // CommandInteraction
interaction.isButton()      // ButtonInteraction
interaction.isSelectMenu()  // SelectMenuInteraction
interaction.isModalSubmit() // ModalSubmitInteraction
interaction.isAutocomplete() // AutocompleteInteraction
```

#### Methods

```javascript
// Reply to interaction
await interaction.reply('Hello!');
await interaction.reply({ content: 'Hello!', ephemeral: true });
await interaction.reply({ embeds: [embed], components: [row] });

// Defer reply (shows "thinking...")
await interaction.deferReply();
await interaction.deferReply({ ephemeral: true });

// Edit reply (after reply or deferReply)
await interaction.editReply('Updated!');
await interaction.editReply({ embeds: [embed] });

// Delete reply
await interaction.deleteReply();

// Send followup message
await interaction.followUp('Another message!');
await interaction.followUp({ content: 'Secret', ephemeral: true });
```

### CommandInteraction

Slash command interaction.

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `commandName` | `string` | Command name |
| `options` | `CommandInteractionOptions` | Command options |

#### Getting Options

```javascript
// String option
const name = interaction.options.getString('name');
const name = interaction.options.getString('name', true); // Required, throws if missing

// Integer option
const count = interaction.options.getInteger('count');

// Number option (float)
const amount = interaction.options.getNumber('amount');

// Boolean option
const enabled = interaction.options.getBoolean('enabled');

// User option (returns user ID)
const userId = interaction.options.getUser('target');

// Channel option (returns channel ID)
const channelId = interaction.options.getChannel('channel');

// Subcommand
const subcommand = interaction.options.getSubcommand();
```

#### Show Modal

```javascript
await interaction.showModal({
  custom_id: 'my-modal',
  title: 'My Modal',
  components: [
    {
      type: 1, // Action Row
      components: [{
        type: 4, // Text Input
        custom_id: 'input-1',
        label: 'Enter text',
        style: 1, // Short
        required: true
      }]
    }
  ]
});
```

### ButtonInteraction

Button click interaction.

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `customId` | `string` | Button custom ID |
| `message` | `Message` | Message with button |

#### Methods

```javascript
// Update the message
await interaction.update({ content: 'Button clicked!' });
await interaction.update({ embeds: [newEmbed], components: [newRow] });

// Or reply normally
await interaction.reply('You clicked the button!');
```

### SelectMenuInteraction

Select menu interaction.

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `customId` | `string` | Menu custom ID |
| `values` | `string[]` | Selected values |
| `message` | `Message` | Message with menu |

#### Methods

```javascript
// Get selected values
console.log(interaction.values); // ['option1', 'option2']

// Update the message
await interaction.update({ content: `You selected: ${interaction.values.join(', ')}` });
```

### ModalSubmitInteraction

Modal form submission.

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `customId` | `string` | Modal custom ID |
| `fields` | `ModalFields` | Form fields |

#### Methods

```javascript
// Get field value
const value = interaction.fields.getTextInputValue('input-1');

// Reply
await interaction.reply('Form submitted!');
```

### AutocompleteInteraction

Autocomplete for slash command options.

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `commandName` | `string` | Command name |
| `options` | `CommandInteractionOptions` | Current options |

#### Methods

```javascript
// Get focused option
const focused = interaction.options.getFocused();
// { name: 'query', value: 'user input' }

// Respond with choices
await interaction.respond([
  { name: 'Option 1', value: 'opt1' },
  { name: 'Option 2', value: 'opt2' },
  { name: 'Option 3', value: 'opt3' }
]);
```

---

## Builders

### EmbedBuilder

Build rich embeds for messages.

```javascript
import { EmbedBuilder, Colors } from '@jubbio/core';

const embed = new EmbedBuilder()
  .setTitle('Title')
  .setDescription('Description text')
  .setURL('https://jubbio.com')
  .setColor(Colors.Blue)
  .setColor('#FF5733')           // Hex string
  .setColor(0xFF5733)            // Number
  .setColor([255, 87, 51])       // RGB array
  .setAuthor({ 
    name: 'Author Name', 
    iconURL: 'https://...', 
    url: 'https://...' 
  })
  .setThumbnail('https://...')   // Small image (top right)
  .setImage('https://...')       // Large image (bottom)
  .addFields(
    { name: 'Field 1', value: 'Value 1', inline: true },
    { name: 'Field 2', value: 'Value 2', inline: true },
    { name: 'Field 3', value: 'Value 3' }
  )
  .setFooter({ text: 'Footer', iconURL: 'https://...' })
  .setTimestamp()                // Current time
  .setTimestamp(new Date())      // Specific date

// Use in reply
await interaction.reply({ embeds: [embed] });

// Convert to JSON
embed.toJSON()

// Create from existing
const copy = EmbedBuilder.from(existingEmbed);
```

#### Available Colors

```javascript
Colors.Default        // 0x000000
Colors.White          // 0xFFFFFF
Colors.Aqua           // 0x1ABC9C
Colors.Green          // 0x57F287
Colors.Blue           // 0x3498DB
Colors.Yellow         // 0xFEE75C
Colors.Purple         // 0x9B59B6
Colors.LuminousVividPink // 0xE91E63
Colors.Fuchsia        // 0xEB459E
Colors.Gold           // 0xF1C40F
Colors.Orange         // 0xE67E22
Colors.Red            // 0xED4245
Colors.Grey           // 0x95A5A6
Colors.Navy           // 0x34495E
Colors.DarkAqua       // 0x11806A
Colors.DarkGreen      // 0x1F8B4C
Colors.DarkBlue       // 0x206694
Colors.DarkPurple     // 0x71368A
Colors.DarkVividPink  // 0xAD1457
Colors.DarkGold       // 0xC27C0E
Colors.DarkOrange     // 0xA84300
Colors.DarkRed        // 0x992D22
Colors.DarkGrey       // 0x979C9F
Colors.DarkerGrey     // 0x7F8C8D
Colors.LightGrey      // 0xBCC0C0
Colors.DarkNavy       // 0x2C3E50
Colors.Blurple        // 0x5865F2
Colors.Greyple        // 0x99AAB5
Colors.DarkButNotBlack // 0x2C2F33
Colors.NotQuiteBlack  // 0x23272A
```

### ButtonBuilder

Build interactive buttons.

```javascript
import { ButtonBuilder, ButtonStyle, ActionRowBuilder } from '@jubbio/core';

const button = new ButtonBuilder()
  .setCustomId('my-button')      // Required for non-link buttons
  .setLabel('Click Me!')
  .setStyle(ButtonStyle.Primary)
  .setEmoji('👍')                // Optional emoji
  .setDisabled(false);           // Enable/disable

// Link button (no customId)
const linkButton = new ButtonBuilder()
  .setLabel('Visit Website')
  .setStyle(ButtonStyle.Link)
  .setURL('https://jubbio.com');

// Add to action row
const row = new ActionRowBuilder().addComponents(button, linkButton);

await interaction.reply({ components: [row] });
```

#### Button Styles

| Style | Value | Description |
|-------|-------|-------------|
| `ButtonStyle.Primary` | 1 | Blue button |
| `ButtonStyle.Secondary` | 2 | Grey button |
| `ButtonStyle.Success` | 3 | Green button |
| `ButtonStyle.Danger` | 4 | Red button |
| `ButtonStyle.Link` | 5 | Link button (opens URL) |

### StringSelectMenuBuilder

Build dropdown select menus.

```javascript
import { StringSelectMenuBuilder, ActionRowBuilder } from '@jubbio/core';

const select = new StringSelectMenuBuilder()
  .setCustomId('my-select')
  .setPlaceholder('Choose an option')
  .setMinValues(1)               // Minimum selections
  .setMaxValues(3)               // Maximum selections
  .addOptions(
    { label: 'Option 1', value: 'opt1', description: 'First option', emoji: '1️⃣' },
    { label: 'Option 2', value: 'opt2', description: 'Second option', emoji: '2️⃣' },
    { label: 'Option 3', value: 'opt3', description: 'Third option', default: true }
  );

const row = new ActionRowBuilder().addComponents(select);

await interaction.reply({ 
  content: 'Select options:', 
  components: [row] 
});
```

### ActionRowBuilder

Container for buttons and select menus.

```javascript
import { ActionRowBuilder } from '@jubbio/core';

// Add components
const row = new ActionRowBuilder()
  .addComponents(button1, button2, button3);

// Set components (replaces existing)
row.setComponents(button1, button2);

// Multiple rows (max 5)
await interaction.reply({
  components: [row1, row2, row3]
});
```

**Limits:**
- Max 5 action rows per message
- Max 5 buttons per row
- Max 1 select menu per row

### SlashCommandBuilder

Build slash commands for registration.

```javascript
import { SlashCommandBuilder } from '@jubbio/core';

const command = new SlashCommandBuilder()
  .setName('greet')
  .setDescription('Greet a user')
  .addStringOption(option =>
    option
      .setName('message')
      .setDescription('Custom greeting message')
      .setRequired(false)
      .addChoices(
        { name: 'Hello', value: 'hello' },
        { name: 'Hi', value: 'hi' },
        { name: 'Hey', value: 'hey' }
      )
  )
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('User to greet')
      .setRequired(true)
  )
  .addIntegerOption(option =>
    option
      .setName('times')
      .setDescription('Number of times')
      .setMinValue(1)
      .setMaxValue(10)
  )
  .addBooleanOption(option =>
    option
      .setName('ephemeral')
      .setDescription('Send privately')
  )
  .addChannelOption(option =>
    option
      .setName('channel')
      .setDescription('Target channel')
  )
  .addSubcommand(sub =>
    sub
      .setName('formal')
      .setDescription('Formal greeting')
  );

// Register commands
await client.rest.registerGlobalCommands([command.toJSON()]);
```

### ModalBuilder

Build modal dialogs with text inputs.

```javascript
import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from '@jubbio/core';

const modal = new ModalBuilder()
  .setCustomId('feedback-modal')
  .setTitle('Submit Feedback');

const titleInput = new TextInputBuilder()
  .setCustomId('title')
  .setLabel('Title')
  .setStyle(TextInputStyle.Short)
  .setPlaceholder('Enter a title')
  .setRequired(true)
  .setMinLength(3)
  .setMaxLength(100);

const descInput = new TextInputBuilder()
  .setCustomId('description')
  .setLabel('Description')
  .setStyle(TextInputStyle.Paragraph)
  .setPlaceholder('Enter your feedback')
  .setRequired(true)
  .setMinLength(10)
  .setMaxLength(1000);

modal.addComponents(
  new ActionRowBuilder().addComponents(titleInput),
  new ActionRowBuilder().addComponents(descInput)
);

// Show modal (from command interaction)
await interaction.showModal(modal.toJSON());
```

#### TextInputStyle

| Style | Value | Description |
|-------|-------|-------------|
| `TextInputStyle.Short` | 1 | Single line input |
| `TextInputStyle.Paragraph` | 2 | Multi-line textarea |

---

## REST API

Access via `client.rest`.

### Messages

```javascript
// Send message
await client.rest.createMessage(guildId, channelId, {
  content: 'Hello!',
  embeds: [embed.toJSON()]
});

// Send ephemeral message (only visible to one user)
await client.rest.createEphemeralMessage(guildId, channelId, targetUserId, {
  content: 'Only you can see this'
});

// Edit message
await client.rest.editMessage(guildId, channelId, messageId, {
  content: 'Updated!'
});

// Delete message
await client.rest.deleteMessage(guildId, channelId, messageId);

// Bulk delete (2-100 messages, max 14 days old)
await client.rest.bulkDeleteMessages(guildId, channelId, [msgId1, msgId2]);

// Get messages
const messages = await client.rest.getMessages(guildId, channelId, {
  limit: 50,
  before: messageId,
  after: messageId
});

// Add reaction
await client.rest.addReaction(guildId, channelId, messageId, '👍');

// Pin/Unpin
await client.rest.pinMessage(guildId, channelId, messageId);
await client.rest.unpinMessage(guildId, channelId, messageId);
const pinned = await client.rest.getPinnedMessages(guildId, channelId);

// Upload file
const attachment = await client.rest.uploadAttachment(guildId, channelId, {
  name: 'image.png',
  data: buffer,
  contentType: 'image/png'
});

// Send message with file
await client.rest.createMessageWithFile(guildId, channelId, {
  content: 'Check this out!',
  file: { name: 'doc.pdf', data: buffer }
});

// Send DM message
await client.rest.createDMMessage(dmChannelId, {
  content: 'Hello via DM!'
});
```

### Members

```javascript
// Get members list (paginated, max 50 per page)
const result = await client.rest.getMembers(guildId, { limit: 50 });
// result.members — member array
// result.next_cursor — cursor for next page (null if no more)

// Next page
const page2 = await client.rest.getMembers(guildId, { limit: 50, cursor: result.next_cursor });

// Via Guild structure (also caches members automatically)
const data = await guild.fetchMembers({ limit: 50 });
const nextPage = await guild.fetchMembers({ limit: 50, cursor: data.next_cursor });

// Get single member
const member = await client.rest.getMember(guildId, userId);

// Edit member
await client.rest.editMember(guildId, userId, {
  nick: 'New Nickname',
  roles: ['roleId1', 'roleId2'],
  mute: false,
  deaf: false
});

// Timeout (duration in seconds, null to remove)
await client.rest.timeoutMember(guildId, userId, 3600, 'Spam');
await client.rest.timeoutMember(guildId, userId, null); // Remove timeout

// Kick
await client.rest.kickMember(guildId, userId, 'Rule violation');

// Ban
await client.rest.banMember(guildId, userId, {
  deleteMessageDays: 7,
  reason: 'Severe violation'
});

// Unban
await client.rest.unbanMember(guildId, userId, 'Appeal accepted');

// Add/Remove role
await client.rest.addMemberRole(guildId, userId, roleId, 'Earned role');
await client.rest.removeMemberRole(guildId, userId, roleId, 'Role expired');
```

### Roles

```javascript
// Get all roles
const roles = await client.rest.getRoles(guildId);

// Create role
const role = await client.rest.createRole(guildId, {
  name: 'Moderator',
  color: 0x3498DB,
  hoist: true,           // Show separately in member list
  mentionable: true,
  permissions: '8'       // Permission bits as string
});

// Edit role
await client.rest.editRole(guildId, roleId, {
  name: 'Senior Mod',
  color: 0xE74C3C
});

// Delete role
await client.rest.deleteRole(guildId, roleId);
```

### Channels

```javascript
// Get guild channels
const channels = await client.rest.getGuildChannels(guildId);

// Create text channel
const textChannel = await client.rest.createChannel(guildId, {
  name: 'general-chat',
  type: 0,                    // 0 = text
  topic: 'General discussion',
  parent_id: categoryId,      // Optional category
  nsfw: false
});

// Create voice channel
const voiceChannel = await client.rest.createChannel(guildId, {
  name: 'Music',
  type: 2,                    // 2 = voice
  parent_id: categoryId,
  bitrate: 64000,
  user_limit: 10
});

// Create category
const category = await client.rest.createChannel(guildId, {
  name: 'Text Channels',
  type: 4                     // 4 = category
});

// Delete channel
await client.rest.deleteChannel(guildId, channelId);

// Edit channel permissions
await client.rest.editChannelPermissions(channelId, roleOrUserId, {
  allow: '1024',              // Permission bits to allow
  deny: '2048',               // Permission bits to deny
  type: 0                     // 0 = role, 1 = member
});

// Delete permission overwrite
await client.rest.deleteChannelPermission(channelId, roleOrUserId);
```

### Threads

```javascript
// Create thread from message
await client.rest.createThreadFromMessage(guildId, channelId, messageId, {
  name: 'Discussion',
  auto_archive_duration: 1440  // Minutes: 60, 1440, 4320, 10080
});

// Create thread without message
await client.rest.createThread(guildId, channelId, {
  name: 'New Thread',
  type: 11,                    // 11 = public, 12 = private
  auto_archive_duration: 1440
});

// Join/Leave thread
await client.rest.joinThread(threadId);
await client.rest.leaveThread(threadId);
```

### Guild

```javascript
// Get guild info
const guild = await client.rest.getGuild(guildId);

// Get bans
const bans = await client.rest.getBans(guildId);
const ban = await client.rest.getBan(guildId, userId);

// Get emojis
const emojis = await client.rest.getEmojis(guildId);

// Get invites
const invites = await client.rest.getGuildInvites(guildId);
```

### Invites

```javascript
// Create invite
const invite = await client.rest.createInvite(guildId, channelId, {
  max_age: 86400,      // Seconds (0 = never expire)
  max_uses: 10,        // 0 = unlimited
  temporary: false,    // Kick when disconnected
  unique: true         // Create new invite
});

// Get invite info
const info = await client.rest.getInvite(inviteCode);

// Delete invite
await client.rest.deleteInvite(inviteCode);
```

### Users

```javascript
// Get user
const user = await client.rest.getUser(userId);

// Get current bot user
const bot = await client.rest.getCurrentUser();
```

### Slash Commands

```javascript
// Register global commands (takes up to 1 hour to propagate)
await client.rest.registerGlobalCommands([
  { name: 'ping', description: 'Pong!' },
  { name: 'help', description: 'Show help' }
]);

// Register guild commands (instant, for testing)
await client.rest.registerGuildCommands(guildId, commands);

// Delete global command
await client.rest.deleteGlobalCommand(commandId);
```

### Webhooks

```javascript
// Get channel webhooks
const webhooks = await client.rest.getChannelWebhooks(guildId, channelId);

// Create webhook
const webhook = await client.rest.createWebhook(guildId, channelId, {
  name: 'My Webhook',
  avatar: 'base64_image_data'  // Optional
});
```

---

## Voice

Voice support via `@jubbio/voice` package.

### Installation

```bash
npm install @jubbio/voice
```

### Requirements

- FFmpeg installed and in PATH
- yt-dlp installed (for YouTube support)

### Basic Usage

```javascript
import { Client, GatewayIntentBits } from '@jubbio/core';
import { 
  joinVoiceChannel,
  getVoiceConnection,
  createAudioPlayer,
  createAudioResource,
  createAudioResourceFromUrl,
  probeAudioInfo,
  AudioPlayerStatus,
  VoiceConnectionStatus
} from '@jubbio/voice';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});
```

### joinVoiceChannel(options)

Join a voice channel.

```javascript
const connection = joinVoiceChannel({
  channelId: voiceChannelId,
  guildId: guildId,
  adapterCreator: client.voice.adapters.get(guildId),
  selfMute: false,    // Join muted
  selfDeaf: false     // Join deafened
});
```

### getVoiceConnection(guildId)

Get existing voice connection for a guild.

```javascript
let connection = getVoiceConnection(guildId);
if (!connection) {
  connection = joinVoiceChannel({ ... });
}
```

### createAudioPlayer(options?)

Create an audio player.

```javascript
const player = createAudioPlayer({
  behaviors: {
    noSubscriber: 'pause'  // 'pause' | 'play' | 'stop'
  }
});

// Subscribe connection to player
connection.subscribe(player);
```

### createAudioResource(input, options?)

Create audio resource from file path.

```javascript
const resource = createAudioResource('/path/to/audio.mp3', {
  metadata: { title: 'My Song' }
});

player.play(resource);
```

### createAudioResourceFromUrl(url, options?)

Create audio resource from URL (YouTube, etc.).

```javascript
const resource = createAudioResourceFromUrl('https://youtube.com/watch?v=...', {
  metadata: { title: 'YouTube Video' }
});

player.play(resource);
```

### probeAudioInfo(input)

Get audio information before playing.

```javascript
// From URL
const info = await probeAudioInfo('https://youtube.com/watch?v=...');

// From search query
const info = await probeAudioInfo('imagine dragons believer');

console.log(info.title);      // Video title
console.log(info.duration);   // Duration in seconds
console.log(info.thumbnail);  // Thumbnail URL
console.log(info.url);        // Actual playable URL

// Use the resolved URL
const resource = createAudioResourceFromUrl(info.url);
```

### Player Controls

```javascript
// Play
player.play(resource);

// Pause
player.pause();

// Resume
player.unpause();

// Stop
player.stop();

// Check status
player.state.status === AudioPlayerStatus.Playing
player.state.status === AudioPlayerStatus.Idle
player.state.status === AudioPlayerStatus.Paused
player.state.status === AudioPlayerStatus.Buffering
```

### Player Events

```javascript
player.on('stateChange', (oldState, newState) => {
  console.log(`${oldState.status} -> ${newState.status}`);
  
  if (newState.status === AudioPlayerStatus.Idle) {
    // Playback finished, play next song
    playNextSong();
  }
});

player.on('error', (error) => {
  console.error('Player error:', error.message);
});
```

### Connection Controls

```javascript
// Disconnect
connection.disconnect();

// Destroy (full cleanup)
connection.destroy();

// Check status
connection.state.status === VoiceConnectionStatus.Ready
connection.state.status === VoiceConnectionStatus.Connecting
connection.state.status === VoiceConnectionStatus.Disconnected
```

### Connection Events

```javascript
connection.on('stateChange', (oldState, newState) => {
  if (newState.status === VoiceConnectionStatus.Disconnected) {
    // Handle disconnect
  }
});

connection.on('error', (error) => {
  console.error('Connection error:', error);
});
```

### Complete Music Bot Example

```javascript
import { Client, GatewayIntentBits, EmbedBuilder, Colors } from '@jubbio/core';
import { 
  joinVoiceChannel, 
  getVoiceConnection,
  createAudioPlayer, 
  createAudioResourceFromUrl,
  probeAudioInfo,
  AudioPlayerStatus 
} from '@jubbio/voice';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// Store players and queues per guild
const players = new Map();
const queues = new Map();

function getPlayer(guildId) {
  let player = players.get(guildId);
  if (!player) {
    player = createAudioPlayer();
    players.set(guildId, player);
    
    // Auto-play next song when current ends
    player.on('stateChange', (oldState, newState) => {
      if (newState.status === AudioPlayerStatus.Idle && 
          oldState.status !== AudioPlayerStatus.Idle) {
        playNext(guildId);
      }
    });
  }
  return player;
}

async function playNext(guildId) {
  const queue = queues.get(guildId) || [];
  if (queue.length === 0) return;
  
  const song = queue.shift();
  queues.set(guildId, queue);
  
  const resource = createAudioResourceFromUrl(song.url);
  const player = getPlayer(guildId);
  player.play(resource);
}

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;
  
  const { commandName, guildId } = interaction;
  
  if (commandName === 'play') {
    const query = interaction.options.getString('query', true);
    const voiceChannel = interaction.member?.voice?.channelId;
    
    if (!voiceChannel) {
      return interaction.reply({ content: '❌ Join a voice channel first!', ephemeral: true });
    }
    
    await interaction.deferReply();
    
    try {
      const info = await probeAudioInfo(query);
      
      // Join if not connected
      let connection = getVoiceConnection(guildId);
      if (!connection) {
        connection = joinVoiceChannel({
          channelId: voiceChannel,
          guildId: guildId,
          adapterCreator: client.voice.adapters.get(guildId)
        });
        connection.subscribe(getPlayer(guildId));
      }
      
      // Add to queue
      const queue = queues.get(guildId) || [];
      queue.push({ url: info.url, title: info.title, duration: info.duration });
      queues.set(guildId, queue);
      
      // Start playing if idle
      const player = getPlayer(guildId);
      if (player.state.status === AudioPlayerStatus.Idle) {
        playNext(guildId);
      }
      
      const embed = new EmbedBuilder()
        .setTitle('🎵 Added to Queue')
        .setDescription(`**${info.title}**`)
        .setColor(Colors.Green)
        .setThumbnail(info.thumbnail)
        .setTimestamp();
      
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply(`❌ Error: ${error.message}`);
    }
  }
  
  if (commandName === 'skip') {
    const player = getPlayer(guildId);
    player.stop(); // Triggers stateChange -> playNext
    await interaction.reply('⏭️ Skipped!');
  }
  
  if (commandName === 'stop') {
    const player = getPlayer(guildId);
    player.stop();
    queues.set(guildId, []);
    getVoiceConnection(guildId)?.disconnect();
    await interaction.reply('⏹️ Stopped!');
  }
  
  if (commandName === 'queue') {
    const queue = queues.get(guildId) || [];
    if (queue.length === 0) {
      return interaction.reply('📭 Queue is empty!');
    }
    
    const list = queue.slice(0, 10).map((s, i) => `${i + 1}. ${s.title}`).join('\n');
    await interaction.reply(`🎵 **Queue:**\n${list}`);
  }
});

client.login(process.env.BOT_TOKEN);
```

---

## Enums & Constants

### GatewayIntentBits

```javascript
GatewayIntentBits.Guilds                    // Guild events
GatewayIntentBits.GuildMembers              // Member join/leave/update
GatewayIntentBits.GuildModeration           // Ban/unban events
GatewayIntentBits.GuildEmojisAndStickers    // Emoji/sticker events
GatewayIntentBits.GuildIntegrations         // Integration events
GatewayIntentBits.GuildWebhooks             // Webhook events
GatewayIntentBits.GuildInvites              // Invite events
GatewayIntentBits.GuildVoiceStates          // Voice state events
GatewayIntentBits.GuildPresences            // Presence events
GatewayIntentBits.GuildMessages             // Message events
GatewayIntentBits.GuildMessageReactions     // Reaction events
GatewayIntentBits.GuildMessageTyping        // Typing events
GatewayIntentBits.DirectMessages            // DM events
GatewayIntentBits.DirectMessageReactions    // DM reaction events
GatewayIntentBits.DirectMessageTyping       // DM typing events
GatewayIntentBits.MessageContent            // Access message.content
GatewayIntentBits.GuildScheduledEvents      // Scheduled event events
GatewayIntentBits.AutoModerationConfiguration // AutoMod config events
GatewayIntentBits.AutoModerationExecution   // AutoMod execution events
```

### ChannelType

```javascript
ChannelType.GuildText         // 0 - Text channel
ChannelType.DM                // 1 - Direct message
ChannelType.GuildVoice        // 2 - Voice channel
ChannelType.GroupDM           // 3 - Group DM
ChannelType.GuildCategory     // 4 - Category
ChannelType.GuildAnnouncement // 5 - Announcement channel
ChannelType.AnnouncementThread // 10 - Announcement thread
ChannelType.PublicThread      // 11 - Public thread
ChannelType.PrivateThread     // 12 - Private thread
ChannelType.GuildStageVoice   // 13 - Stage channel
ChannelType.GuildDirectory    // 14 - Directory
ChannelType.GuildForum        // 15 - Forum channel
```

### InteractionType

```javascript
InteractionType.Ping                          // 1
InteractionType.ApplicationCommand            // 2 - Slash command
InteractionType.MessageComponent              // 3 - Button/Select
InteractionType.ApplicationCommandAutocomplete // 4 - Autocomplete
InteractionType.ModalSubmit                   // 5 - Modal form
```

### ApplicationCommandOptionType

```javascript
ApplicationCommandOptionType.Subcommand      // 1
ApplicationCommandOptionType.SubcommandGroup // 2
ApplicationCommandOptionType.String          // 3
ApplicationCommandOptionType.Integer         // 4
ApplicationCommandOptionType.Boolean         // 5
ApplicationCommandOptionType.User            // 6
ApplicationCommandOptionType.Channel         // 7
ApplicationCommandOptionType.Role            // 8
ApplicationCommandOptionType.Mentionable     // 9
ApplicationCommandOptionType.Number          // 10 (float)
ApplicationCommandOptionType.Attachment      // 11
```

### PermissionFlagsBits

```javascript
PermissionFlagsBits.CreateInstantInvite  // Create invites
PermissionFlagsBits.KickMembers          // Kick members
PermissionFlagsBits.BanMembers           // Ban members
PermissionFlagsBits.Administrator        // Full admin access
PermissionFlagsBits.ManageChannels       // Manage channels
PermissionFlagsBits.ManageGuild          // Manage server
PermissionFlagsBits.AddReactions         // Add reactions
PermissionFlagsBits.ViewAuditLog         // View audit log
PermissionFlagsBits.ViewChannel          // View channels
PermissionFlagsBits.SendMessages         // Send messages
PermissionFlagsBits.ManageMessages       // Delete/pin messages
PermissionFlagsBits.EmbedLinks           // Embed links
PermissionFlagsBits.AttachFiles          // Attach files
PermissionFlagsBits.ReadMessageHistory   // Read history
PermissionFlagsBits.MentionEveryone      // @everyone/@here
PermissionFlagsBits.UseExternalEmojis    // External emojis
PermissionFlagsBits.Connect              // Connect to voice
PermissionFlagsBits.Speak                // Speak in voice
PermissionFlagsBits.MuteMembers          // Mute others
PermissionFlagsBits.DeafenMembers        // Deafen others
PermissionFlagsBits.MoveMembers          // Move members
PermissionFlagsBits.ManageRoles          // Manage roles
PermissionFlagsBits.ManageEmojis         // Manage emojis
PermissionFlagsBits.ModerateMembers      // Timeout members
```

### MessageFlags

```javascript
MessageFlags.Crossposted           // Published to following channels
MessageFlags.IsCrosspost           // Is a crosspost
MessageFlags.SuppressEmbeds        // Embeds suppressed
MessageFlags.Ephemeral             // Only visible to user
MessageFlags.Loading               // Deferred response
MessageFlags.SuppressNotifications // Silent message
```

### AudioPlayerStatus

```javascript
AudioPlayerStatus.Idle        // Not playing
AudioPlayerStatus.Buffering   // Loading audio
AudioPlayerStatus.Playing     // Currently playing
AudioPlayerStatus.Paused      // Paused by user
AudioPlayerStatus.AutoPaused  // Paused (no subscribers)
```

### VoiceConnectionStatus

```javascript
VoiceConnectionStatus.Connecting   // Establishing connection
VoiceConnectionStatus.Ready        // Connected and ready
VoiceConnectionStatus.Disconnected // Disconnected
VoiceConnectionStatus.Destroyed    // Fully destroyed
VoiceConnectionStatus.Signalling   // Exchanging info
```

---

## Permissions

Check member permissions.

```javascript
// Check single permission
member.permissions.has('ManageMessages')
member.permissions.has(PermissionFlagsBits.BanMembers)

// Check multiple permissions
member.permissions.has(['ManageMessages', 'KickMembers'])

// Get all permissions as array
member.permissions.toArray()
// ['SendMessages', 'ViewChannel', 'ManageMessages', ...]

// Check if admin
member.permissions.has('Administrator')

// Raw permission bits
member.permissions.bits // BigInt
```

### PermissionsBitField

Work with permission bits directly.

```javascript
import { PermissionsBitField, PermissionFlagsBits } from '@jubbio/core';

// Create from bits
const perms = new PermissionsBitField(8n); // Administrator

// Create from array
const perms = new PermissionsBitField(['SendMessages', 'ViewChannel']);

// Add permissions
perms.add('ManageMessages');
perms.add(PermissionFlagsBits.KickMembers);

// Remove permissions
perms.remove('ManageMessages');

// Check permissions
perms.has('SendMessages'); // true/false

// Serialize
perms.toArray();  // ['SendMessages', 'ViewChannel']
perms.bitfield;   // BigInt value
```

---

## Collectors

Collect messages, interactions, or reactions over time.

### MessageCollector

```javascript
import { MessageCollector } from '@jubbio/core';

const collector = new MessageCollector(client, channelId, {
  filter: (message) => message.author.id === userId,
  max: 5,           // Stop after 5 messages
  time: 30000,      // Stop after 30 seconds
  idle: 10000       // Stop after 10s of no messages
});

collector.on('collect', (message) => {
  console.log(`Collected: ${message.content}`);
});

collector.on('end', (collected, reason) => {
  console.log(`Collected ${collected.size} messages. Reason: ${reason}`);
});

// Stop manually
collector.stop('manual');
```

### awaitMessages

Simpler promise-based collection.

```javascript
import { awaitMessages } from '@jubbio/core';

const collected = await awaitMessages(client, channelId, {
  filter: (m) => m.author.id === userId,
  max: 1,
  time: 30000,
  errors: ['time']  // Reject on timeout
});

const response = collected.first();
```

### InteractionCollector

```javascript
import { InteractionCollector } from '@jubbio/core';

const collector = new InteractionCollector(client, {
  filter: (i) => i.user.id === userId,
  componentType: 2,  // Buttons only
  max: 1,
  time: 60000
});

collector.on('collect', async (interaction) => {
  await interaction.update({ content: 'Button clicked!' });
});
```

### Collector Options

| Option | Type | Description |
|--------|------|-------------|
| `filter` | `function` | Filter function |
| `time` | `number` | Max time in ms |
| `idle` | `number` | Max idle time in ms |
| `max` | `number` | Max items to collect |
| `maxProcessed` | `number` | Max items to process |
| `dispose` | `boolean` | Emit dispose events |

---

## Sharding

For large bots that need multiple processes.

### ShardingManager

Main process that spawns shards.

```javascript
// index.js (main file)
import { ShardingManager } from '@jubbio/core';

const manager = new ShardingManager('./bot.js', {
  totalShards: 'auto',  // Auto-detect or specify number
  token: process.env.BOT_TOKEN
});

manager.on('shardCreate', (shard) => {
  console.log(`Shard ${shard.id} launched`);
});

manager.spawn();
```

### Shard Events

```javascript
manager.on('shardCreate', (shard) => {
  shard.on('ready', () => {
    console.log(`Shard ${shard.id} ready`);
  });
  
  shard.on('disconnect', () => {
    console.log(`Shard ${shard.id} disconnected`);
  });
  
  shard.on('death', (process) => {
    console.log(`Shard ${shard.id} died`);
  });
});
```

### Broadcasting

```javascript
// Send message to all shards
await manager.broadcast({ type: 'reload' });

// Evaluate code on all shards
const results = await manager.broadcastEval((client) => {
  return client.guilds.size;
});
console.log(`Total guilds: ${results.reduce((a, b) => a + b, 0)}`);

// Fetch values from all shards
const guildCounts = await manager.fetchClientValues('guilds.size');
```

### ShardClientUtil

Used in bot.js to communicate with manager.

```javascript
// bot.js
import { Client, ShardClientUtil } from '@jubbio/core';

const client = new Client({ ... });

client.on('ready', () => {
  console.log(`Shard ${client.shard.ids[0]} ready`);
});

// Get shard ID for a guild
const shardId = ShardClientUtil.shardIdForGuildId(guildId, totalShards);

// Fetch from all shards
const allGuilds = await client.shard.fetchClientValues('guilds.size');

// Broadcast eval
const results = await client.shard.broadcastEval((c) => c.user.username);
```

### ShardingManager Options

| Option | Type | Description |
|--------|------|-------------|
| `totalShards` | `number \| 'auto'` | Number of shards |
| `shardList` | `number[]` | Specific shards to spawn |
| `mode` | `'process' \| 'worker'` | Spawn mode |
| `respawn` | `boolean` | Auto-respawn dead shards |
| `token` | `string` | Bot token |
| `execArgv` | `string[]` | Node.js arguments |

---

## Formatting Utilities

```javascript
import { 
  bold, 
  italic, 
  underline, 
  strikethrough,
  spoiler,
  quote,
  blockQuote,
  inlineCode,
  codeBlock,
  hyperlink,
  hideLinkEmbed,
  userMention,
  channelMention,
  roleMention,
  time,
  heading,
  unorderedList,
  orderedList,
  TimestampStyles
} from '@jubbio/core';

// Text formatting
bold('text')           // **text**
italic('text')         // *text*
underline('text')      // __text__
strikethrough('text')  // ~~text~~
spoiler('text')        // ||text||

// Quotes
quote('text')          // > text
blockQuote('text')     // >>> text

// Code
inlineCode('code')     // `code`
codeBlock('js', code)  // ```js\ncode\n```

// Links
hyperlink('Click', 'https://...')     // [Click](https://...)
hideLinkEmbed('https://...')          // <https://...>

// Mentions
userMention('123')     // <@123>
channelMention('456')  // <#456>
roleMention('789')     // <@&789>

// Timestamps
time(new Date())                      // <t:1234567890>
time(date, TimestampStyles.RelativeTime)  // "2 hours ago"
time(date, TimestampStyles.ShortTime)     // "12:00"
time(date, TimestampStyles.LongTime)      // "12:00:00"
time(date, TimestampStyles.ShortDate)     // "01/01/2026"
time(date, TimestampStyles.LongDate)      // "1 January 2026"
time(date, TimestampStyles.ShortDateTime) // "1 January 2026 12:00"
time(date, TimestampStyles.LongDateTime)  // "Monday, 1 January 2026 12:00"

// Headings
heading('Title', 1)    // # Title
heading('Title', 2)    // ## Title
heading('Title', 3)    // ### Title

// Lists
unorderedList(['item 1', 'item 2', 'item 3'])
// - item 1
// - item 2
// - item 3

orderedList(['first', 'second', 'third'])
// 1. first
// 2. second
// 3. third
```

---

<p align="center">
  Made with ❤️ for the Jubbio community
</p>
