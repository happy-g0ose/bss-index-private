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
const buildMetaDbPath = path.join(__dirname, 'last_build.json');

async function startSiteUpdateDetector(client) {
  let lastBuild = { sha: '' };
  try {
    if (fs.existsSync(buildMetaDbPath)) {
      lastBuild = JSON.parse(fs.readFileSync(buildMetaDbPath, 'utf-8'));
    }
  } catch (err) {
    console.error('Error loading last_build.json:', err.message);
  }

  const checkUpdate = async () => {
    try {
      const res = await fetch('https://bss-index.vercel.app/build-meta.json?t=' + Date.now());
      if (!res.ok) return;
      const meta = await res.json();
      
      if (!meta.sha || meta.sha === 'dev') return;
      
      // If first run, save and skip notification to prevent spamming
      if (!lastBuild.sha) {
        lastBuild = meta;
        fs.writeFileSync(buildMetaDbPath, JSON.stringify(lastBuild, null, 2), 'utf-8');
        return;
      }
      
      if (meta.sha !== lastBuild.sha) {
        console.log(`[Detector] Обнаружено новое обновление сайта! SHA: ${meta.sha}`);
        
        lastBuild = meta;
        fs.writeFileSync(buildMetaDbPath, JSON.stringify(lastBuild, null, 2), 'utf-8');
        
        for (const guild of client.guilds.cache.values()) {
          const updateChannel = guild.channels.cache.find(c => 
            c.type === ChannelType.GuildText && 
            (c.name.includes('обновления-сайта') || c.name.includes('updates'))
          );
          
          if (updateChannel) {
            const embed = new EmbedBuilder()
              .setTitle('📢 Обновление сайта BSS Index!')
              .setDescription('Сайт [bss-index.vercel.app](https://bss-index.vercel.app/) был успешно обновлен!')
              .setColor('#a855f7')
              .addFields(
                { name: '📝 Описание изменений:', value: `\`\`\`${meta.message || 'Без описания коммита'}\`\`\`` },
                { name: '⚡ Версия (SHA):', value: `\`${meta.sha.substring(0, 7)}\``, inline: true }
              )
              .setTimestamp(new Date(meta.timestamp))
              .setFooter({ text: 'BSS Index Live Updates', iconURL: 'https://raw.githubusercontent.com/happy-g0ose/bss-index/main/public/favicon.png' });

            const row = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setLabel('🌐 Открыть сайт BSS Index')
                .setStyle(ButtonStyle.Link)
                .setURL('https://bss-index.vercel.app/')
            );

            await updateChannel.send({ embeds: [embed], components: [row] }).catch(err => 
              console.error(`Failed to send update to channel #${updateChannel.name}:`, err.message)
            );
          }
        }
      }
    } catch (err) {
      console.error('[Detector] Error checking update:', err.message);
    }
  };

  setTimeout(checkUpdate, 10000);
  setInterval(checkUpdate, 60000);
}


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

const translitMap = {
  'а': 'a', 'б': 'b', 'в': 'w', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
  'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
  'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
  'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '',
  'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
};

function transliterate(text) {
  return text.split('').map(char => translitMap[char] || char).join('');
}

let flattenedItems = [];

function getFlattenedItems() {
  if (flattenedItems.length > 0) return flattenedItems;
  
  const list = [];
  for (const item of itemsData) {
    if (item.category === 'Биквипы' && item.beequipData) {
      // Add the base item itself
      list.push(item);
      // Flatten all its rolls into virtual searchable BSS items
      for (const group of item.beequipData) {
        for (const roll of group.rolls) {
          list.push({
            id: `${item.id}-${roll.rollName}`,
            name: `${item.name} (${roll.rollName})`,
            englishName: `${item.englishName} (${roll.rollName})`,
            category: 'Биквипы',
            value: roll.value,
            valueLow: roll.valueLow,
            valueHigh: roll.valueHigh,
            demand: roll.demand,
            image: item.image,
            stability: item.stability,
            description: `Ролл: ${roll.rollName} для экипировки ${item.name}.`
          });
        }
      }
    } else {
      list.push(item);
    }
  }
  flattenedItems = list;
  return flattenedItems;
}

const STAT_ABBR_LABELS = {
  AR: 'Ability Rate',
  ATL: 'Ability Token Lifespan',
  BAP: 'Bee Ability Pollen',
  BAR: 'Bee Ability Rate',
  BP: 'Blue Pollen',
  BBP: 'Blue Bomb Pollen',
  BFC: 'Blue Field Capacity',
  BFT: 'Bond From Treats',
  BGP: 'Bee Gather Pollen',
  BMS: 'Bee Movespeed',
  CC: 'Critical Power',
  CR: 'Convert Rate',
  CRAH: 'Convert Rate at Hive',
  GBP: 'Gold Bubble Pollen',
  HAH: 'Honey at Hive',
  HFT: 'Honey From Tokens',
  HM: 'Honeymark',
  HPG: 'Honey Per Goo',
  HFIC: 'Honey From Instant Conversion',
  IC: 'Instant Conversion',
  MD: 'Mark Duration',
  MEL: 'Melody',
  MRT: 'Monster Respawn Time',
  PMS: 'Player Movespeed',
  RBA: 'Red Bee Attack',
  RP: 'Red Pollen',
  SCC: 'Super-Crit Chance',
  SCP: 'Super-Crit Power',
  TL: 'Token Link',
  WFC: 'White Field Capacity',
  WP: 'White Pollen',
  WGA: 'White Gather Amount',
  CAP: 'Capacity'
};

const RU_ABBR_MAP = {
  'хах': 'HAH',
  'вфс': 'WFC',
  'вп': 'WP',
  'вга': 'WGA',
  'бп': 'BP',
  'ббп': 'BBP',
  'бфс': 'BFC',
  'бфт': 'BFT',
  'бгп': 'BGP',
  'бмс': 'BMS',
  'кк': 'CC',
  'кр': 'CR',
  'крах': 'CRAH',
  'гбп': 'GBP',
  'хфт': 'HFT',
  'хм': 'HM',
  'хпг': 'HPG',
  'хфик': 'HFIC',
  'ик': 'IC',
  'мд': 'MD',
  'мел': 'MEL',
  'мрт': 'MRT',
  'пмс': 'PMS',
  'рба': 'RBA',
  'рп': 'RP',
  'скк': 'SCC',
  'скп': 'SCP',
  'тл': 'TL',
  'кап': 'CAP'
};

function findItems(query) {
  if (!query) return [];
  
  const cleanQuery = query.toLowerCase().trim();
  const words = cleanQuery.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  
  const list = getFlattenedItems();
  
  const matched = list.map(item => {
    let score = 0;
    const itemNameLower = item.name.toLowerCase();
    const itemEngNameLower = item.englishName.toLowerCase();
    const categoryLower = item.category.toLowerCase();
    
    for (const word of words) {
      const transWord = transliterate(word);
      
      let abbrValue = null;
      let abbrName = null;
      if (RU_ABBR_MAP[word]) {
        abbrValue = RU_ABBR_MAP[word];
        abbrName = STAT_ABBR_LABELS[abbrValue]?.toLowerCase();
      } else {
        const upperWord = word.toUpperCase();
        if (STAT_ABBR_LABELS[upperWord]) {
          abbrValue = upperWord;
          abbrName = STAT_ABBR_LABELS[abbrValue]?.toLowerCase();
        }
      }
      
      const isMatch = itemNameLower.includes(word) || 
                      itemEngNameLower.includes(word) || 
                      itemNameLower.includes(transWord) || 
                      itemEngNameLower.includes(transWord) ||
                      categoryLower.includes(word) ||
                      categoryLower.includes(transWord) ||
                      (abbrValue && (itemNameLower.includes(abbrValue.toLowerCase()) || itemEngNameLower.includes(abbrValue.toLowerCase()))) ||
                      (abbrName && (itemNameLower.includes(abbrName) || itemEngNameLower.includes(abbrName)));
                      
      if (isMatch) {
        score++;
      }
    }
    return { item, score };
  }).filter(res => res.score > 0);
  
  matched.sort((a, b) => b.score - a.score);
  
  return matched.map(res => res.item);
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
    .setName('ban')
    .setDescription('Забанить участника сервера')
    .addUserOption(option => option.setName('user').setDescription('Пользователь для бана').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Причина бана').setRequired(false)),

  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Выгнать участника с сервера')
    .addUserOption(option => option.setName('user').setDescription('Пользователь для кика').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Причина кика').setRequired(false)),

  new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Отправить участника в мут (таймаут)')
    .addUserOption(option => option.setName('user').setDescription('Пользователь для мута').setRequired(true))
    .addIntegerOption(option => option.setName('duration').setDescription('Длительность мута в минутах').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Причина мута').setRequired(false)),

  new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Снять мут (таймаут) с участника')
    .addUserOption(option => option.setName('user').setDescription('Пользователь для размута').setRequired(true)),

  new SlashCommandBuilder()
    .setName('add-role')
    .setDescription('Выдать роль пользователю')
    .addUserOption(option => option.setName('user').setDescription('Пользователь').setRequired(true))
    .addRoleOption(option => option.setName('role').setDescription('Роль для выдачи').setRequired(true)),

  new SlashCommandBuilder()
    .setName('remove-role')
    .setDescription('Снять роль с пользователя')
    .addUserOption(option => option.setName('user').setDescription('Пользователь').setRequired(true))
    .addRoleOption(option => option.setName('role').setDescription('Роль для снятия').setRequired(true))
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
        matches.map(item => {
          const valStr = item.valueLow !== item.valueHigh
            ? `${item.valueLow}-${item.valueHigh}`
            : `${item.value}`;
          return {
            name: `${item.name} (${valStr} ★)`,
            value: item.name
          };
        })
      ).catch(() => {});
    }
  }
});

// Helper function to format all channels
// Helper function to format all channels
// Helper function to format all channels


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
      .setDescription('BSS Index — это современный русскоязычный сайт цен и калькулятор трейдов для Bee Swarm Simulator!\n\n✨ **Возможности:**\n• Цены на 330+ предметов, стикеров и биквипов\n• Интерактивный W/F/L Калькулятор обмена\n• История динамики цен и графики')
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

  else if (commandName === 'ban') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return interaction.reply({ content: '❌ У вас нет прав на бан участников!', ephemeral: true }).catch(() => {});
    }
    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') || 'Без указания причины';

    if (!target) {
      return interaction.reply({ content: '❌ Пользователь не найден на сервере.', ephemeral: true }).catch(() => {});
    }
    if (!target.bannable) {
      return interaction.reply({ content: '❌ Я не могу забанить этого пользователя (он выше меня по роли или у меня нет прав администратора).', ephemeral: true }).catch(() => {});
    }

    try {
      await target.ban({ reason });
      await interaction.reply({ content: `✅ Пользователь **${target.user.tag}** успешно забанен!\n📝 Причина: *${reason}*` }).catch(() => {});
    } catch (err) {
      await interaction.reply({ content: `❌ Ошибка при бане: ${err.message}`, ephemeral: true }).catch(() => {});
    }
  }

  else if (commandName === 'kick') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
      return interaction.reply({ content: '❌ У вас нет прав на кик участников!', ephemeral: true }).catch(() => {});
    }
    const target = interaction.options.getMember('user');
    const reason = interaction.options.getString('reason') || 'Без указания причины';

    if (!target) {
      return interaction.reply({ content: '❌ Пользователь не найден на сервере.', ephemeral: true }).catch(() => {});
    }
    if (!target.kickable) {
      return interaction.reply({ content: '❌ Я не могу кикнуть этого пользователя.', ephemeral: true }).catch(() => {});
    }

    try {
      await target.kick(reason);
      await interaction.reply({ content: `✅ Пользователь **${target.user.tag}** успешно кикнут!\n📝 Причина: *${reason}*` }).catch(() => {});
    } catch (err) {
      await interaction.reply({ content: `❌ Ошибка при кике: ${err.message}`, ephemeral: true }).catch(() => {});
    }
  }

  else if (commandName === 'mute') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return interaction.reply({ content: '❌ У вас нет прав на мут участников!', ephemeral: true }).catch(() => {});
    }
    const target = interaction.options.getMember('user');
    const duration = interaction.options.getInteger('duration');
    const reason = interaction.options.getString('reason') || 'Без указания причины';

    if (!target) {
      return interaction.reply({ content: '❌ Пользователь не найден на сервере.', ephemeral: true }).catch(() => {});
    }
    if (!target.moderatable) {
      return interaction.reply({ content: '❌ Я не могу выдать мут этому пользователю.', ephemeral: true }).catch(() => {});
    }

    try {
      const durationMs = duration * 60 * 1000;
      await target.timeout(durationMs, reason);
      await interaction.reply({ content: `✅ Пользователь **${target.user.tag}** отправлен в мут на **${duration} мин.**!\n📝 Причина: *${reason}*` }).catch(() => {});
    } catch (err) {
      await interaction.reply({ content: `❌ Ошибка при выдаче мута: ${err.message}`, ephemeral: true }).catch(() => {});
    }
  }

  else if (commandName === 'unmute') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return interaction.reply({ content: '❌ У вас нет прав на снятие мута!', ephemeral: true }).catch(() => {});
    }
    const target = interaction.options.getMember('user');

    if (!target) {
      return interaction.reply({ content: '❌ Пользователь не найден на сервере.', ephemeral: true }).catch(() => {});
    }
    if (!target.isCommunicationDisabled()) {
      return interaction.reply({ content: '❌ У этого пользователя нет активного мута.', ephemeral: true }).catch(() => {});
    }

    try {
      await target.timeout(null);
      await interaction.reply({ content: `✅ Мут с пользователя **${target.user.tag}** успешно снят!` }).catch(() => {});
    } catch (err) {
      await interaction.reply({ content: `❌ Ошибка при снятии мута: ${err.message}`, ephemeral: true }).catch(() => {});
    }
  }

  else if (commandName === 'add-role') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.reply({ content: '❌ У вас нет прав на выдачу ролей!', ephemeral: true }).catch(() => {});
    }
    const target = interaction.options.getMember('user');
    const role = interaction.options.getRole('role');

    if (!target) {
      return interaction.reply({ content: '❌ Пользователь не найден.', ephemeral: true }).catch(() => {});
    }
    if (target.roles.cache.has(role.id)) {
      return interaction.reply({ content: '❌ У этого пользователя уже есть эта роль.', ephemeral: true }).catch(() => {});
    }

    try {
      await target.roles.add(role);
      await interaction.reply({ content: `✅ Роль **${role.name}** успешно выдана пользователю **${target.user.tag}**!` }).catch(() => {});
    } catch (err) {
      await interaction.reply({ content: `❌ Ошибка при выдаче роли: ${err.message}`, ephemeral: true }).catch(() => {});
    }
  }

  else if (commandName === 'remove-role') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.reply({ content: '❌ У вас нет прав на снятие ролей!', ephemeral: true }).catch(() => {});
    }
    const target = interaction.options.getMember('user');
    const role = interaction.options.getRole('role');

    if (!target) {
      return interaction.reply({ content: '❌ Пользователь не найден.', ephemeral: true }).catch(() => {});
    }
    if (!target.roles.cache.has(role.id)) {
      return interaction.reply({ content: '❌ У этого пользователя нет этой роли.', ephemeral: true }).catch(() => {});
    }

    try {
      await target.roles.remove(role);
      await interaction.reply({ content: `✅ Роль **${role.name}** успешно снята с пользователя **${target.user.tag}**!` }).catch(() => {});
    } catch (err) {
      await interaction.reply({ content: `❌ Ошибка при снятии роли: ${err.message}`, ephemeral: true }).catch(() => {});
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
    startSiteUpdateDetector(client);
  });

  client.login(token);
}

main();
