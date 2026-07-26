import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, REST, Routes, SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// User Stats Database for auto-roles
const statsPath = path.join(__dirname, 'user_stats.json');
let userStats = {};
try {
  if (fs.existsSync(statsPath)) {
    userStats = JSON.parse(fs.readFileSync(statsPath, 'utf-8'));
  }
} catch (e) {
  console.error('Could not load user_stats.json:', e.message);
}

function saveUserStats() {
  try {
    fs.writeFileSync(statsPath, JSON.stringify(userStats, null, 2), 'utf-8');
  } catch (e) {
    console.error('Could not save user_stats.json:', e.message);
  }
}

// Ensure the automatic BSS roles exist on the server
async function ensureBssRoles(guild) {
  const rolesConfig = [
    { name: '🐝 Трейдер', color: '#f59e0b', reason: 'Начальная роль при входе на сервер BSS Index' },
    { name: '🍯 Опытный Трейдер', color: '#eab308', reason: 'Выдается за 50 проверок цен на BSS Index' },
    { name: '👑 Легендарный Трейдер', color: '#a855f7', reason: 'Выдается за 150 проверок цен на BSS Index' },
    { name: '👑 Создатель BSS Index', color: '#06b6d4', reason: 'Особая роль создателя проекта BSS Index' }
  ];

  const createdRoles = {};
  for (const rConf of rolesConfig) {
    let role = guild.roles.cache.find(r => r.name === rConf.name);
    if (!role) {
      try {
        role = await guild.roles.create({
          name: rConf.name,
          color: rConf.color,
          reason: rConf.reason
        });
        console.log(`[Roles] Создана роль: ${rConf.name}`);
      } catch (err) {
        console.error(`[Roles] Ошибка создания роли ${rConf.name}:`, err.message);
      }
    }
    createdRoles[rConf.name] = role;
  }
  return createdRoles;
}

// Update stats and assign roles based on command activity
async function updateUserActivity(userId, guild, channel) {
  if (!guild) return;
  
  if (!userStats[userId]) {
    userStats[userId] = { count: 0 };
  }
  userStats[userId].count += 1;
  saveUserStats();

  const count = userStats[userId].count;
  const roles = await ensureBssRoles(guild);
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return;

  // Special Auto-Role for the Creator (User ID 1193225483932930159)
  if (userId === '1193225483932930159') {
    const creatorRole = roles['👑 Создатель BSS Index'];
    if (creatorRole && !member.roles.cache.has(creatorRole.id)) {
      await member.roles.add(creatorRole).catch(() => null);
      console.log(`[Roles] Успешно выдана роль Создателя пользователю happy goose (${userId})`);
    }
  }

  // Fallback: If they don't have any BSS role yet and count is less than 50, assign them the starter role!
  const starterRole = roles['🐝 Трейдер'];
  const activeRole = roles['🍯 Опытный Трейдер'];
  const legendaryRole = roles['👑 Легендарный Трейдер'];
  
  if (count < 50) {
    if (starterRole && !member.roles.cache.has(starterRole.id) && 
        (!activeRole || !member.roles.cache.has(activeRole.id)) && 
        (!legendaryRole || !member.roles.cache.has(legendaryRole.id))) {
      await member.roles.add(starterRole).catch(() => null);
    }
  }

  // Level 1: 50 commands -> Opytny Trader
  if (count === 50) {
    if (activeRole) {
      await member.roles.add(activeRole);
      if (starterRole) await member.roles.remove(starterRole).catch(() => null);
      
      const levelEmbed = new EmbedBuilder()
        .setTitle('🎉 Повышение ранга трейдера!')
        .setDescription(`Поздравляем <@${userId}>! Ты выполнил 50 проверок цен/сделок и получаешь роль **🍯 Опытный Трейдер**!`)
        .setColor('#eab308')
        .setFooter({ text: 'Продолжай использовать бота, чтобы получить Легендарного Трейдера!' });
      
      await channel.send({ embeds: [levelEmbed] }).catch(() => null);
    }
  }
  
  // Level 2: 150 commands -> Legendary Trader
  if (count === 150) {
    if (legendaryRole) {
      await member.roles.add(legendaryRole);
      if (activeRole) await member.roles.remove(activeRole).catch(() => null);
      
      const levelEmbed = new EmbedBuilder()
        .setTitle('👑 Легендарный Трейдер сервера!')
        .setDescription(`Невероятно! <@${userId}> совершил 150 проверок цен/сделок и удостоен высшего звания **👑 Легендарный Трейдер**!`)
        .setColor('#a855f7')
        .setFooter({ text: 'Настоящий мастер обменов BSS Index!' });
      
      await channel.send({ embeds: [levelEmbed] }).catch(() => null);
    }
  }
}


// Load items database
const itemsPath = path.join(__dirname, 'items.json');
let itemsData = [];
try {
  itemsData = JSON.parse(fs.readFileSync(itemsPath, 'utf-8'));
} catch (e) {
  console.error('Could not load items.json. Run "npm run sync" first.');
}

const CATEGORY_COLORS = {
  "Скины на каба": "#f59e0b",
  "Скины на куба": "#f59e0b",
  "Скины на улей": "#a855f7",
  "Ваучеры": "#10b981",
  "Стикеры пчел": "#eab308",
  "Стикеры медведей": "#f97316",
  "Стикеры мобов": "#ef4444",
  "Искусство": "#ec4899",
  "Драгоценности": "#06b6d4",
  "Иконки нектара": "#f43f5e",
  "Цветы": "#d946ef",
  "Грибы": "#fb7185",
  "Листья": "#84cc16",
  "Инструменты": "#0ea5e9",
  "Марки": "#6366f1",
  "Стикеры Пчелождества": "#14b8a6",
  "Звездные знаки": "#c084fc",
  "Биквипы": "#3b82f6",
  "Разное": "#94a3b8"
};

function getCategoryColor(category) {
  return CATEGORY_COLORS[category] || "#94a3b8";
}

function findItems(query) {
  if (!query) return [];
  const q = query.toLowerCase().trim();
  return itemsData.filter(item => 
    item.name.toLowerCase().includes(q) || 
    item.englishName.toLowerCase().includes(q) ||
    item.category.toLowerCase().includes(q)
  );
}

// Build Slash Commands definitions
const commands = [
  new SlashCommandBuilder()
    .setName('price')
    .setDescription('Узнать актуальную цену и информацию о предмете BSS')
    .addStringOption(option => 
      option.setName('item')
        .setDescription('Название предмета или стикера')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  new SlashCommandBuilder()
    .setName('calc')
    .setDescription('Быстрая проверка выгоды трейда (Win/Fair/Loss)')
    .addStringOption(option =>
      option.setName('giving')
        .setDescription('Что отдаете (предметы через запятую)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('getting')
        .setDescription('Что получаете (предметы через запятую)')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('site')
    .setDescription('Ссылка на сайт BSS Index и информацию'),

  new SlashCommandBuilder()
    .setName('setup-server')
    .setDescription('Автоматически красиво оформить все каналы сервера красивыми Embed-сообщениями')
];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers
  ]
});

// Autocomplete handler
client.on('interactionCreate', async interaction => {
  if (interaction.isAutocomplete()) {
    if (interaction.commandName === 'price') {
      const focusedValue = interaction.options.getFocused();
      const matches = findItems(focusedValue).slice(0, 25);
      await interaction.respond(
        matches.map(item => ({
          name: `${item.name} (${item.value} ★)`,
          value: item.name
        }))
      );
    }
  }
});

// Helper function to format all channels
// Helper function to format all channels
// Helper function to format all channels
async function executeServerSetup(guild, interaction) {
  let createdCount = 0;
  const processedChannels = [];
  const keepChannelIds = new Set();
  const keepCategoryIds = new Set();

  if (interaction && interaction.channelId) {
    keepChannelIds.add(interaction.channelId);
  }

  // 1. Create Category 1: 👋︱ИНФОРМАЦИЯ (Read-Only)
  const infoCategory = await guild.channels.create({
    name: '👋︱ИНФОРМАЦИЯ',
    type: ChannelType.GuildCategory
  });
  keepCategoryIds.add(infoCategory.id);

  // 2. Create Category 2: 💬︱ОБЩЕНИЕ И ТРЕЙДИНГ (Read-Write)
  const chatCategory = await guild.channels.create({
    name: '💬︱ОБЩЕНИЕ И ТРЕЙДИНГ',
    type: ChannelType.GuildCategory
  });
  keepCategoryIds.add(chatCategory.id);

  const setupChannel = async (name, categoryId, isReadOnly, isVoice, embed = null, components = []) => {
    const permissionOverwrites = [
      {
        id: guild.roles.everyone.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
        deny: isReadOnly ? [PermissionFlagsBits.SendMessages] : []
      },
      {
        id: guild.members.me.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageChannels]
      }
    ];

    const ch = await guild.channels.create({
      name,
      type: isVoice ? ChannelType.GuildVoice : ChannelType.GuildText,
      parent: categoryId,
      permissionOverwrites
    });

    keepChannelIds.add(ch.id);

    if (embed) {
      try {
        await ch.send({ embeds: [embed], components });
        createdCount++;
        processedChannels.push(`#${ch.name}`);
      } catch (err) {
        console.error(`Error sending message to #${ch.name}:`, err.message);
      }
    } else if (!isVoice) {
      createdCount++;
      processedChannels.push(`#${ch.name}`);
    }
    return ch;
  };

  // Define Embeds
  const welcomeEmbed = new EmbedBuilder()
    .setTitle('👋 Добро пожаловать на официальный Discord-сервер BSS Index!')
    .setDescription(`Приветствуем тебя в главном русскоязычном трейдинг-сообществе **Bee Swarm Simulator**!\n\nЗдесь ты найдёшь самые свежие цены на стикеры, ульи и кубы, умный ИИ-сканер трейдов и интерактивный калькулятор обменов.`)
    .setColor('#f59e0b')
    .setThumbnail('https://raw.githubusercontent.com/happy-g0ose/bss-index/main/public/favicon.png')
    .addFields(
      { name: '🌐 Наш веб-сайт:', value: '[https://bss-index.vercel.app/](https://bss-index.vercel.app/)', inline: false },
      { name: '🤖 Основные команды бота в чате:', value: '• `/price [предмет]` — узнать точные цены и спрос любого стикера\n• `/calc [отдаю] [получаю]` — мгновенно рассчитать выгоду трейда (WIN/FAIR/LOSS)\n• `/site` — получить ссылку на наш портал', inline: false }
    )
    .setFooter({ text: 'BSS Index Community • Желаем успешных трейдов!' });

  const welcomeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel('🌐 Открыть сайт BSS Index').setStyle(ButtonStyle.Link).setURL('https://bss-index.vercel.app/')
  );

  const rulesEmbed = new EmbedBuilder()
    .setTitle('📜 Правила Сервера BSS Index')
    .setDescription('Для комфортного общения и безопасных трейдов соблюдайте простые правила:')
    .setColor('#eab308')
    .addFields(
      { name: '1. Уважение и вежливость', value: 'Запрещены оскорбления, токсичность, рознь и неадекватное поведение.' },
      { name: '2. Честный трейдинг (Без скама)', value: 'Любые попытки обмана, скама или подмены предметов караются мгновенным баном.' },
      { name: '3. Без спама и рекламы', value: 'Не флудите в чатах и не рекламируйте сторонние дискорд-серверы и услуги.' },
      { name: '4. Безопасность аккаунтов', value: 'Никогда не передавайте свои пароли, файлы или сомнительные ссылки.' }
    )
    .setFooter({ text: 'Соблюдение правил обязательно для всех участников.' });

  const updatesEmbed = new EmbedBuilder()
    .setTitle('🔄 Обновления Сайта BSS Index')
    .setDescription('В этом канале публикуются все свежие обновления, новые фичи и изменения цен на нашем сайте!')
    .setColor('#a855f7')
    .addFields(
      { name: '✨ Что нового на сайте:', value: '• ⚡ Мгновенная синхронизация цен с bssmvalues.com\n• 🎨 Фирменная система цветовой подсветки по категориям\n• 📸 Умный AI-сканер трейдов по скриншотам' }
    )
    .setFooter({ text: 'Следите за обновлениями!' });

  const wflEmbed = new EmbedBuilder()
    .setTitle('⚖️ Канал проверки сделок Win / Fair / Loss')
    .setDescription('Выкладывайте свои скриншоты трейдов или используйте бота для оценки выгоды сделки!\n\n👉 Напишите в чат `/calc` для мгновенного расчета выгоды трейда прямо в Discord!')
    .setColor('#10b981');

  const suggestionsEmbed = new EmbedBuilder()
    .setTitle('💡 Предложения и Идеи')
    .setDescription('Есть идеи по улучшению сайта или Discord-бота? Пишите свои предложения в этот канал! Мы читаем каждое сообщение.')
    .setColor('#06b6d4');

  const bugsEmbed = new EmbedBuilder()
    .setTitle('🐛 Ошибки и Баги')
    .setDescription('Нашли ошибку на сайте или в боте? Напишите подробности в этот канал, и мы оперативно исправим проблему!')
    .setColor('#ef4444');

  // Create channels under Category 1
  await setupChannel('👋︱добро-пожаловать', infoCategory.id, true, false, welcomeEmbed, [welcomeRow]);
  await setupChannel('📜︱правила', infoCategory.id, true, false, rulesEmbed);
  await setupChannel('📢︱обновления-сайта', infoCategory.id, true, false, updatesEmbed);

  // Create channels under Category 2
  const generalText = await setupChannel('💬︱основной-чат', chatCategory.id, false, false);
  await setupChannel('⚖︱win-fair-lose', chatCategory.id, false, false, wflEmbed);
  await setupChannel('💡︱предложения', chatCategory.id, false, false, suggestionsEmbed);
  await setupChannel('🐛︱баги-сайта', chatCategory.id, false, false, bugsEmbed);
  await setupChannel('🔊︱основной-voice', chatCategory.id, false, true);

  // Send initial welcome message to general text chat
  const generalWelcomeEmbed = new EmbedBuilder()
    .setTitle('🎉 Сервер успешно настроен!')
    .setDescription('Основной чат сервера успешно создан и настроен ботом **BSS Index Helper** под ключ! Все старые каналы удалены.')
    .setColor('#06b6d4')
    .setTimestamp();
  await generalText.send({ embeds: [generalWelcomeEmbed] }).catch(() => null);

  // Delete all old channels
  const allChannels = await guild.channels.fetch();
  for (const [id, ch] of allChannels) {
    if (keepChannelIds.has(ch.id) || keepCategoryIds.has(ch.id)) continue;
    try {
      await ch.delete();
    } catch (err) {
      console.error(`Could not delete channel/category #${ch.name}:`, err.message);
    }
  }

  return { createdCount, processedChannels };
}

// Slash Command handler
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'price') {
    const itemName = interaction.options.getString('item');
    const matches = findItems(itemName);

    if (matches.length === 0) {
      return interaction.reply({
        content: `❌ Предмет **"${itemName}"** не найден в базе данных BSS Index.`,
        ephemeral: true
      });
    }

    const item = matches[0];
    const color = getCategoryColor(item.category);
    const valueText = item.valueLow !== item.valueHigh 
      ? `${item.valueLow} - ${item.valueHigh} ★`
      : `${item.value} ★`;

    const stabilityIcon = item.stability === 'Растет' ? '📈' : item.stability === 'Падает' ? '📉' : '➡️';

    const embed = new EmbedBuilder()
      .setTitle(`✨ ${item.name}`)
      .setDescription(`*${item.englishName}*`)
      .setColor(color)
      .setThumbnail(item.image)
      .addFields(
        { name: '🏷 Категория', value: `\`${item.category}\``, inline: true },
        { name: '⭐ Ценность', value: `**${valueText}**`, inline: true },
        { name: '🔥 Спрос', value: `\`${item.demand}\``, inline: true },
        { name: '📊 Стабильность', value: `${stabilityIcon} ${item.stability}`, inline: true }
      )
      .setFooter({ text: 'BSS Index • Актуальные цены Bee Swarm Simulator', iconURL: 'https://raw.githubusercontent.com/happy-g0ose/bss-index/main/public/favicon.png' })
      .setTimestamp();

    if (item.description) {
      embed.addFields({ name: 'ℹ️ Описание', value: item.description.split('Индикаторы:')[0].trim() });
    }

    const itemSlug = encodeURIComponent(item.id || item.englishName || item.name);
    const itemUrl = `https://bss-index.vercel.app/?item=${itemSlug}`;

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Открыть в BSS Index')
          .setStyle(ButtonStyle.Link)
          .setURL(itemUrl)
      );

    updateUserActivity(interaction.user.id, interaction.guild, interaction.channel).catch(err => console.error("Error updating user activity:", err.message));
    await interaction.reply({ embeds: [embed], components: [row] }).catch(err => console.error("Price command reply error:", err.message));
  }

  else if (commandName === 'calc') {
    const givingRaw = interaction.options.getString('giving').split(',');
    const gettingRaw = interaction.options.getString('getting').split(',');

    const givingItems = givingRaw.map(s => findItems(s)[0]).filter(Boolean);
    const gettingItems = gettingRaw.map(s => findItems(s)[0]).filter(Boolean);

    const totalGiving = givingItems.reduce((acc, i) => acc + i.value, 0);
    const totalGetting = gettingItems.reduce((acc, i) => acc + i.value, 0);

    let resultStatus = '⚖️ Справедливый (Fair)';
    let resultColor = '#f59e0b'; // Amber

    const diff = totalGetting - totalGiving;
    const ratio = totalGiving > 0 ? (diff / totalGiving) * 100 : 0;

    if (ratio >= 15) {
      resultStatus = '🎉 Выгодный (WIN)!';
      resultColor = '#10b981'; // Green
    } else if (ratio <= -15) {
      resultStatus = '📉 Убыточный (LOSS)!';
      resultColor = '#ef4444'; // Red
    }

    const embed = new EmbedBuilder()
      .setTitle('⚖️ Калькулятор Сделки BSS Index')
      .setColor(resultColor)
      .addFields(
        { 
          name: '🔴 Вы отдаете:', 
          value: givingItems.length > 0 ? givingItems.map(i => `• ${i.name} (${i.value} ★)`).join('\n') : 'Ничего не выбрано', 
          inline: true 
        },
        { 
          name: '🟢 Вы получаете:', 
          value: gettingItems.length > 0 ? gettingItems.map(i => `• ${i.name} (${i.value} ★)`).join('\n') : 'Ничего не выбрано', 
          inline: true 
        },
        { 
          name: '📊 Итог сделки:', 
          value: `Отдаете: **${totalGiving.toFixed(2)} ★**\nПолучаете: **${totalGetting.toFixed(2)} ★**\nВердикт: **${resultStatus}**`, 
          inline: false 
        }
      )
      .setFooter({ text: 'BSS Index Trade Calculator' });

    updateUserActivity(interaction.user.id, interaction.guild, interaction.channel).catch(err => console.error("Error updating user activity:", err.message));
    await interaction.reply({ embeds: [embed] }).catch(err => console.error("Calc command reply error:", err.message));
  }

  else if (commandName === 'site') {
    const embed = new EmbedBuilder()
      .setTitle('🐝 BSS Index — Лучшая База Цен и Калькулятор BSS')
      .setDescription('BSS Index — это современный русскоязычный сайт цен и калькулятор трейдов для Bee Swarm Simulator!\n\n✨ **Возможности:**\n• Цены на 330+ предметов, стикеров и биквипов\n• Интерактивный W/F/L Калькулятор обмена\n• 📸 AI-Сканер трейдов по скриншотам!\n• История динамики цен и графики')
      .setColor('#f59e0b')
      .setThumbnail('https://raw.githubusercontent.com/happy-g0ose/bss-index/main/public/favicon.png');

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Перейти на сайт BSS Index')
          .setStyle(ButtonStyle.Link)
          .setURL('https://bss-index.vercel.app/')
      );

    await interaction.reply({ embeds: [embed], components: [row] }).catch(err => console.error("Site command reply error:", err.message));
  }

  else if (commandName === 'setup-server') {
    await interaction.deferReply({ ephemeral: true });

    try {
      const res = await executeServerSetup(interaction.guild, interaction);
      await interaction.editReply({ 
        content: `🎉 Сервер успешно оформлен! Отправлено баннеров в каналы: **${res.createdCount}** (${res.processedChannels.join(', ')}).` 
      }).catch(err => console.error("Error editing interaction reply:", err.message));
    } catch (err) {
      console.error("Setup server error:", err);
      await interaction.editReply({ content: `❌ Ошибка: ${err.message}` }).catch(e => {});
    }
  }
});

// Register slash commands and start bot
async function main() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;

  if (!token || token === 'YOUR_DISCORD_BOT_TOKEN_HERE') {
    console.error('❌ ОШИБКА: В файле bot/.env не указан DISCORD_TOKEN!');
    process.exit(1);
  }

  try {
    console.log('🔄 Регистрация слэш-команд...');
    const rest = new REST({ version: '10' }).setToken(token);
    
    if (clientId && clientId !== 'YOUR_CLIENT_ID_HERE') {
      await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands }
      );
      console.log('✅ Слэш-команды успешно зарегистрированы в Discord!');
    }
  } catch (error) {
    console.error('⚠️ Предупреждение при регистрации команд:', error.message);
  }

  
// Auto-role assignment when a member joins the server
client.on('guildMemberAdd', async member => {
  console.log(`[Join] Пользователь ${member.user.tag} зашел на сервер.`);
  try {
    const roles = await ensureBssRoles(member.guild);
    const starterRole = roles['🐝 Трейдер'];
    if (starterRole) {
      await member.roles.add(starterRole);
      console.log(`[Join] Выдана роль '🐝 Трейдер' для ${member.user.tag}`);
    }
  } catch (err) {
    console.error(`[Join] Не удалось выдать роль при входе:`, err.message);
  }
});

client.once('ready', () => {
    console.log(`🤖 Бот BSS Index успешно запущен под именем: ${client.user.tag}`);
    client.user.setActivity('BSS Prices & Trades | /price', { type: 3 });
  });

  client.login(token);
}

main();
