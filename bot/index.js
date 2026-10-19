import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, REST, Routes, SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { itemUrl, getItems } from './lib/items.js';
import { parseItemList, logParsedTrade, verdictFor, allTrades, topTradedItems, tradeStats } from './lib/trades.js';
import { getConfig, updateConfig, addBlocklistWord, removeBlocklistWord, inspectMessage, recordHit, recentLog, logStats } from './lib/moderation.js';
import { bump, syncTierRoles, tierFor, grantStarterRole } from './lib/roles.js';

dotenv.config();

// Categories present in items.json, for the /top command
const TOP_CATEGORIES = [...new Set(getItems().map(i => i.category))].sort((a, b) => a.localeCompare(b, 'ru'));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Poll the site's build-meta.json to announce new site updates
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


// Record a qualifying activity and sync the member's tier roles (roles.js)
async function updateUserActivity(userId, guild, channel, member) {
  if (!guild || !userId) return;

  const prevTier = tierFor(userId);
  const newCount = bump(userId, 1);
  const newTier = tierFor(userId);

  const target = member || await guild.members.fetch(userId).catch(() => null);
  if (target) {
    await syncTierRoles(target);
  }

  // Notify the channel when the member crosses into a new tier
  if (channel && newTier && prevTier && newTier.need > prevTier.need) {
    const isLegendary = newTier.key === 'legendary';
    const tierEmbed = new EmbedBuilder()
      .setTitle(isLegendary ? '👑 Легендарный Трейдер сервера!' : '🎉 Повышение ранга трейдера!')
      .setDescription(isLegendary
        ? `Невероятно! <@${userId}> совершил ${newCount} проверок цен/сделок и удостоен высшего звания **${newTier.role}**!`
        : `Поздравляем <@${userId}>! Ты выполнил ${newCount} проверок цен/сделок и получаешь роль **${newTier.role}**!`)
      .setColor(newTier.color)
      .setFooter({ text: 'Продолжай использовать бота, чтобы расти дальше!' });
    await channel.send({ embeds: [tierEmbed] }).catch(() => null);
  }

  // Special auto-role for the Creator (User ID 1193225483932930159)
  if (userId === '1193225483932930159') {
    let creatorRole = guild.roles.cache.find(r => r.name === '👑 Создатель BSS Index');
    if (!creatorRole) {
      creatorRole = await guild.roles.create({
        name: '👑 Создатель BSS Index',
        color: '#06b6d4',
        reason: 'Особая роль создателя проекта BSS Index'
      }).catch(() => null);
    }
    if (creatorRole && target && !target.roles.cache.has(creatorRole.id)) {
      await target.roles.add(creatorRole).catch(() => null);
      console.log(`[Roles] Успешно выдана роль Создателя пользователю (${userId})`);
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
    .setName('meta')
    .setDescription('Посмотреть самые хайповые и востребованные предметы BSS!'),

  new SlashCommandBuilder()
    .setName('price-changes')
    .setDescription('Последние изменения цен на стикеры и биквипы!'),

  new SlashCommandBuilder()
    .setName('site')
    .setDescription('Ссылка на сайт BSS Index и информацию'),

  new SlashCommandBuilder()
    .setName('logtrade')
    .setDescription('Записать трейд в журнал BSS Index')
    .addStringOption(option =>
      option.setName('giving')
        .setDescription('Что отдаете (пр. 2x Star Cub, 1x Nessie)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('getting')
        .setDescription('Что получаете (пр. 1x Bee Cub)')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('trades')
    .setDescription('Журнал трейдов: последние, топ предметов или статистика')
    .addStringOption(option =>
      option.setName('mode')
        .setDescription('Режим: recent, top или stats')
        .setRequired(false)
        .addChoices(
          { name: 'Последние трейды', value: 'recent' },
          { name: 'Топ предметов', value: 'top' },
          { name: 'Статистика', value: 'stats' }
        )
    ),

  new SlashCommandBuilder()
    .setName('mod')
    .setDescription('Управление автомодерацией (только для админов)')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('Действие')
        .setRequired(true)
        .addChoices(
          { name: 'Статус', value: 'status' },
          { name: 'Сменить режим (укажите значение)', value: 'mode' },
          { name: 'Enforce', value: 'enforce' },
          { name: 'Watch', value: 'watch' },
          { name: 'Off', value: 'off' },
          { name: 'Добавить стоп-слово', value: 'addword' },
          { name: 'Убрать стоп-слово', value: 'removeword' },
          { name: 'Журнал', value: 'log' },
          { name: 'Статистика', value: 'stats' }
        )
    )
    .addStringOption(option =>
      option.setName('value')
        .setDescription('Значение (режим или слово)')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('top')
    .setDescription('Топ предметов BSS по цене')
    .addStringOption(option =>
      option.setName('category')
        .setDescription('Категория предметов')
        .setRequired(false)
        .addChoices(...TOP_CATEGORIES.map(c => ({ name: c, value: c })))
    )
    .addIntegerOption(option =>
      option.setName('limit')
        .setDescription('Сколько предметов показать (1-20, по умолчанию 10)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(20)
    ),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Список всех команд бота'),

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

// Message Content is a *privileged* intent that must be switched on in the
// Discord Developer Portal (Bot → Privileged Gateway Intents). When it is not
// enabled there, Discord rejects the whole gateway connection with
// "Used disallowed intents" and the bot never reaches ready().
//
// So it is opt-in via env var. Leave it off and the bot runs normally, only
// without automatic message moderation. Turn it on together with the portal
// switch and moderation comes alive.
const WANT_MESSAGE_CONTENT = process.env.BOT_MESSAGE_CONTENT === '1';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    ...(WANT_MESSAGE_CONTENT ? [GatewayIntentBits.MessageContent] : []),
  ]
});

// Whether we are actually allowed to read message content. Controls the
// moderation handler so it never claims to work while blind.
const canSeeMessageContent = WANT_MESSAGE_CONTENT;

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

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Открыть в BSS Index')
          .setStyle(ButtonStyle.Link)
          .setURL(itemUrl(item, 'en'))
      );

    updateUserActivity(interaction.user.id, interaction.guild, interaction.channel, interaction.member).catch(err => console.error("Error updating user activity:", err.message));
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

    updateUserActivity(interaction.user.id, interaction.guild, interaction.channel, interaction.member).catch(err => console.error("Error updating user activity:", err.message));
    await interaction.reply({ embeds: [embed] }).catch(err => console.error("Calc command reply error:", err.message));
  }

  else if (commandName === 'meta') {
    const hypeItems = itemsData.filter(i => i.demand === 'Хайп' || i.demand === 'Высокий')
                               .sort((a, b) => b.value - a.value)
                               .slice(0, 10);
    
    const embed = new EmbedBuilder()
      .setTitle('🔥 Мета Трейдинга: Самые Хайповые Предметы')
      .setDescription('Топ-10 предметов, которые сейчас ищут все! Храни их или меняй с выгодой.')
      .setColor('#f97316');
      
    hypeItems.forEach((item, index) => {
      let emoji = item.demand === 'Хайп' ? '🔥' : '📈';
      embed.addFields({ 
        name: `${index + 1}. ${item.name}`, 
        value: `**Цена:** ${item.value} ★ | **Спрос:** ${emoji} ${item.demand}`, 
        inline: false 
      });
    });
    
    embed.setFooter({ text: 'BSS Index Live Data', iconURL: 'https://raw.githubusercontent.com/happy-g0ose/bss-index/main/public/favicon.png' });
    
    updateUserActivity(interaction.user.id, interaction.guild, interaction.channel, interaction.member).catch(err => console.error(err));
    await interaction.reply({ embeds: [embed] }).catch(err => console.error(err));
  }
  
  else if (commandName === 'price-changes') {
    const changes = itemsData.map(item => {
      let oldPrice = item.value;
      if (item.historicalPrices && item.historicalPrices.length > 0) {
        for (let i = item.historicalPrices.length - 1; i >= 0; i--) {
          if (item.historicalPrices[i] !== item.value) {
            oldPrice = item.historicalPrices[i];
            break;
          }
        }
      }
      return { item, oldPrice, diff: item.value - oldPrice };
    }).filter(x => x.diff !== 0);
    
    const risers = changes.filter(x => x.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, 5);
    const fallers = changes.filter(x => x.diff < 0).sort((a, b) => a.diff - b.diff).slice(0, 5);
    
    const embed = new EmbedBuilder()
      .setTitle('📉 Последние изменения цен')
      .setDescription('Предметы, которые недавно выросли или упали в цене.')
      .setColor('#06b6d4');
      
    if (risers.length > 0) {
      const risersText = risers.map(x => `📈 **${x.item.name}**: ${x.oldPrice} ★ ➡️ **${x.item.value} ★** (+${x.diff.toFixed(2)})`).join('\n');
      embed.addFields({ name: '🚀 Сильно выросли', value: risersText, inline: false });
    } else {
      embed.addFields({ name: '🚀 Сильно выросли', value: 'Пока нет свежих данных о росте.', inline: false });
    }
    
    if (fallers.length > 0) {
      const fallersText = fallers.map(x => `📉 **${x.item.name}**: ${x.oldPrice} ★ ➡️ **${x.item.value} ★** (${x.diff.toFixed(2)})`).join('\n');
      embed.addFields({ name: '⏬ Сильно упали', value: fallersText, inline: false });
    } else {
      embed.addFields({ name: '⏬ Сильно упали', value: 'Пока нет свежих данных о падении.', inline: false });
    }
    
    embed.setFooter({ text: 'BSS Index Live Data', iconURL: 'https://raw.githubusercontent.com/happy-g0ose/bss-index/main/public/favicon.png' });
    
    updateUserActivity(interaction.user.id, interaction.guild, interaction.channel, interaction.member).catch(err => console.error(err));
    await interaction.reply({ embeds: [embed] }).catch(err => console.error(err));
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

  else if (commandName === 'logtrade') {
    const givingRaw = interaction.options.getString('giving');
    const gettingRaw = interaction.options.getString('getting');

    const giving = parseItemList(givingRaw);
    const getting = parseItemList(gettingRaw);

    if (!giving || !getting) {
      return interaction.reply({
        content: '❌ Не удалось распознать предметы. Формат: `2x Star Cub, 1x Nessie` — предметы через запятую, количество через `Nx`.',
        ephemeral: true
      }).catch(() => {});
    }

    const givingTotal = giving.reduce((s, e) => s + e.value, 0);
    const gettingTotal = getting.reduce((s, e) => s + e.value, 0);
    const verdict = verdictFor(givingTotal, gettingTotal);
    logParsedTrade({ giving, getting, givingTotal, gettingTotal }, interaction.user);

    const fmt = (e) => `${e.qty > 1 ? `**${e.qty}x** ` : ''}${e.label} (${e.value} ★)`;

    const embed = new EmbedBuilder()
      .setTitle('📝 Трейд записан в журнал BSS Index')
      .setColor(verdict.tone)
      .addFields(
        { name: '🔴 Вы отдаете:', value: giving.map(fmt).join('\n'), inline: true },
        { name: '🟢 Вы получаете:', value: getting.map(fmt).join('\n'), inline: true },
        { name: '📊 Итог сделки:', value: `Отдаете: **${givingTotal.toFixed(2)} ★**\nПолучаете: **${gettingTotal.toFixed(2)} ★**\nВердикт: **${verdict.label}** (${verdict.diffPct >= 0 ? '+' : ''}${verdict.diffPct.toFixed(1)}%)`, inline: false }
      )
      .setFooter({ text: 'BSS Index Trade Log' })
      .setTimestamp();

    updateUserActivity(interaction.user.id, interaction.guild, interaction.channel, interaction.member).catch(err => console.error("Error updating user activity:", err.message));
    await interaction.reply({ embeds: [embed] }).catch(err => console.error("Logtrade command reply error:", err.message));
  }

  else if (commandName === 'trades') {
    const mode = interaction.options.getString('mode') || 'recent';
    const embed = new EmbedBuilder()
      .setFooter({ text: 'BSS Index Trade Log' });

    if (mode === 'recent') {
      embed.setTitle('🕒 Последние трейды').setColor('#f59e0b');
      const recent = allTrades().slice(-10).reverse();
      if (recent.length === 0) {
        embed.setDescription('Пока нет записанных трейдов. Будь первым — используй `/logtrade`!');
      } else {
        embed.setDescription(recent.map(t => {
          const g = t.giving.map(e => `${e.qty > 1 ? `**${e.qty}x** ` : ''}${e.label}`).join(', ');
          const ge = t.getting.map(e => `${e.qty > 1 ? `**${e.qty}x** ` : ''}${e.label}`).join(', ');
          const v = t.verdict || verdictFor(t.givingTotal, t.gettingTotal).label;
          return `**${t.user}**: ${g} ➡️ ${ge} — **${v}**`;
        }).join('\n'));
      }
    } else if (mode === 'top') {
      embed.setTitle('🔥 Топ предметов по популярности в трейдах').setColor('#f97316');
      const top = topTradedItems(10);
      if (top.length === 0) {
        embed.setDescription('Статистика пока пуста — записанных трейдов нет.');
      } else {
        embed.addFields(top.map((t, i) => ({
          name: `${i + 1}. ${t.label}`,
          value: `Упоминаний в трейдах: **${t.count}**`,
          inline: true
        })));
      }
    } else if (mode === 'stats') {
      embed.setTitle('📊 Статистика трейдов и модерации').setColor('#06b6d4');
      const ts = tradeStats();
      const ms = logStats();
      embed.addFields(
        { name: '📝 Трейдов всего', value: `${ts.total}`, inline: true },
        { name: '🕒 За 24 часа', value: `${ts.last24h}`, inline: true },
        { name: '📅 За 7 дней', value: `${ts.last7d}`, inline: true },
        { name: '🛡 Срабатываний модерации', value: `${ms.total}`, inline: false }
      );
      if (Object.keys(ms.byRule).length > 0) {
        embed.addFields({
          name: '⚖️ По правилам',
          value: Object.entries(ms.byRule).map(([r, c]) => `${r}: **${c}**`).join(', '),
          inline: false
        });
      }
    } else {
      embed.setTitle('❓ Неизвестный режим').setDescription('Доступные режимы: `recent`, `top`, `stats`.');
    }

    await interaction.reply({ embeds: [embed] }).catch(err => console.error("Trades command reply error:", err.message));
  }

  else if (commandName === 'mod') {
    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)
      || interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
      || interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)
      || interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild);
    if (!isAdmin) {
      return interaction.reply({ content: '❌ Управлять модерацией могут только администраторы сервера!', ephemeral: true }).catch(() => {});
    }

    const action = interaction.options.getString('action');
    const value = interaction.options.getString('value');
    const cleanValue = value?.trim().toLowerCase() || '';

    const embed = new EmbedBuilder()
      .setTitle('🛡 Модерация BSS Index')
      .setColor('#f59e0b')
      .setFooter({ text: 'BSS Index Moderation' });

    if (action === 'status') {
      const cfg = getConfig();
      embed.addFields(
        { name: '🔧 Режим', value: `\`${cfg.mode}\``, inline: true },
        { name: '📢 Канал логов', value: cfg.logChannelId ? `<#${cfg.logChannelId}>` : 'не задан', inline: true },
        { name: '📝 Стоп-слова', value: cfg.blocklist.length ? cfg.blocklist.map(w => `\`${w}\``).join(', ') : 'список пуст', inline: false },
        { name: '⚙️ Правила', value: Object.entries(cfg.rules).map(([k, v]) => `${v ? '✅' : '❌'} ${k}`).join('\n'), inline: false }
      );
    } else if (action === 'enforce' || action === 'watch' || action === 'off') {
      updateConfig({ mode: action });
      embed.setDescription(`✅ Режим модерации изменён на **${action}**${action === 'enforce' ? '.\n⚠️ Теперь нарушения удаляются автоматически!' : '.'}`);
    } else if (action === 'mode') {
      if (!cleanValue || !['enforce', 'watch', 'off'].includes(cleanValue)) {
        return interaction.reply({ content: '❌ Укажите режим: `enforce`, `watch` или `off`.', ephemeral: true }).catch(() => {});
      }
      updateConfig({ mode: cleanValue });
      embed.setDescription(`✅ Режим модерации изменён на **${cleanValue}**.`);
    } else if (action === 'addword') {
      if (!cleanValue) {
        return interaction.reply({ content: '❌ Укажите слово для добавления.', ephemeral: true }).catch(() => {});
      }
      embed.setDescription(addBlocklistWord(value)
        ? `✅ Слово \`${cleanValue}\` добавлено в стоп-лист.`
        : `⚠️ Слово \`${cleanValue}\` уже есть в стоп-листе.`);
    } else if (action === 'removeword') {
      if (!cleanValue) {
        return interaction.reply({ content: '❌ Укажите слово для удаления.', ephemeral: true }).catch(() => {});
      }
      embed.setDescription(removeBlocklistWord(value)
        ? `✅ Слово \`${cleanValue}\` удалено из стоп-листа.`
        : `⚠️ Слово \`${cleanValue}\` не найдено в стоп-листе.`);
    } else if (action === 'log') {
      const entries = recentLog(10);
      if (entries.length === 0) {
        embed.setDescription('Журнал пуст — нарушений не зафиксировано.');
      } else {
        embed.setDescription(entries.map(e => {
          const time = new Date(e.at).toLocaleString('ru-RU');
          const who = e.user || e.userId || 'unknown';
          return `**${time}** — ${who}\n\`${e.rule}\` — ${e.detail}`;
        }).join('\n\n'));
      }
    } else if (action === 'stats') {
      const s = logStats();
      const fields = [{ name: '🛡 Всего срабатываний', value: `${s.total}`, inline: true }];
      for (const [rule, count] of Object.entries(s.byRule)) {
        fields.push({ name: rule, value: `${count}`, inline: true });
      }
      if (Object.keys(s.byRule).length === 0) {
        fields.push({ name: '📭 По правилам', value: 'пока ничего не срабатывало', inline: true });
      }
      embed.addFields(fields);
    }

    await interaction.reply({ embeds: [embed] }).catch(err => console.error("Mod command reply error:", err.message));
  }

  else if (commandName === 'top') {
    const category = interaction.options.getString('category');
    const limit = Math.min(Math.max(interaction.options.getInteger('limit') || 10, 1), 20);

    let list = getItems();
    if (category) list = list.filter(i => i.category === category);
    list = [...list].sort((a, b) => b.value - a.value).slice(0, limit);

    const embed = new EmbedBuilder()
      .setTitle(`🏆 Топ предметов BSS${category ? ` — ${category}` : ''}`)
      .setColor('#f59e0b')
      .setFooter({ text: 'BSS Index Live Data' });

    if (list.length === 0) {
      embed.setDescription('Предметы в этой категории не найдены.');
    } else {
      embed.addFields(list.map((item, i) => ({
        name: `${i + 1}. ${item.name}`,
        value: `**${item.value} ★** | Спрос: ${item.demand} | ${item.category}`,
        inline: false
      })));
    }

    await interaction.reply({ embeds: [embed] }).catch(err => console.error("Top command reply error:", err.message));
  }

  else if (commandName === 'help') {
    const embed = new EmbedBuilder()
      .setTitle('📖 Команды бота BSS Index')
      .setDescription('Все команды вводятся через слэш (/) в Discord.')
      .setColor('#f59e0b')
      .addFields(
        { name: '/price <предмет>', value: 'Актуальная цена и информация о предмете', inline: false },
        { name: '/calc <отдаю> <получаю>', value: 'Проверка выгоды трейда (Win/Fair/Loss)', inline: false },
        { name: '/logtrade <отдаю> <получаю>', value: 'Записать трейд в журнал', inline: false },
        { name: '/trades [recent|top|stats]', value: 'Журнал трейдов, топ предметов, статистика', inline: false },
        { name: '/top [категория] [лимит]', value: 'Топ предметов по цене', inline: false },
        { name: '/meta', value: 'Самые хайповые и востребованные предметы', inline: false },
        { name: '/price-changes', value: 'Последние изменения цен', inline: false },
        { name: '/site', value: 'Ссылка на сайт BSS Index', inline: false },
        { name: '/mod <действие>', value: 'Управление автомодерацией (для админов)', inline: false },
        { name: '/help', value: 'Это сообщение', inline: false },
        { name: '/ban, /kick, /mute, /unmute', value: 'Модерация сервера (для админов)', inline: false },
        { name: '/add-role, /remove-role', value: 'Выдача и снятие ролей (для админов)', inline: false }
      )
      .setFooter({ text: 'BSS Index • Актуальные цены Bee Swarm Simulator', iconURL: 'https://raw.githubusercontent.com/happy-g0ose/bss-index/main/public/favicon.png' });

    await interaction.reply({ embeds: [embed] }).catch(err => console.error("Help command reply error:", err.message));
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

// Automatic moderation: inspect every non-bot guild message
// Only inspect messages when Discord actually delivered their content
// (privileged Message Content intent, enabled in the Developer Portal).
if (canSeeMessageContent) {
  client.on('messageCreate', async message => {
    if (message.author?.bot) return;
    if (!message.guild) return;

    const { hits } = inspectMessage({ content: message.content, member: message.member });
    if (!hits.length) return;

  const cfg = getConfig();

  for (const hit of hits) {
    recordHit({
      rule: hit.rule,
      detail: hit.detail,
      user: `${message.author.tag} (${message.author.id})`,
      userId: message.author.id,
      channel: message.channelId,
      snippet: String(message.content || '').slice(0, 200)
    });
  }

  if (cfg.mode === 'enforce') {
    await message.delete().catch(() => null);
    try {
      await message.author.send({
        content: `⚠️ Ваше сообщение на сервере **${message.guild.name}** было удалено автомодерацией (${hits.map(h => h.rule).join(', ')}).`
      });
    } catch { /* у пользователя закрыты ЛС */ }
  }

  if (cfg.logChannelId) {
    const logChannel = message.guild.channels.cache.get(cfg.logChannelId);
    if (logChannel) {
      const embed = new EmbedBuilder()
        .setTitle('🛡 Автомодерация: срабатывание')
        .setColor('#ef4444')
        .setDescription(`**Пользователь:** <@${message.author.id}> (${message.author.id})\n**Канал:** <#${message.channelId}>\n**Причина:** ${hits.map(h => `\`${h.rule}\` — ${h.detail}`).join('\n')}`)
        .setTimestamp();
      await logChannel.send({ embeds: [embed] }).catch(() => null);
    }
  }
  });
}

// Register slash commands and start bot
async function main() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;

  if (!canSeeMessageContent) {
    console.warn('⚠️  Message Content intent is not granted — automatic message moderation is DISABLED.');
    console.warn('    Enable it in the Discord Developer Portal → Bot → Privileged Gateway Intents.');
  }

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
    await grantStarterRole(member);
    console.log(`[Join] Выдана роль '🐝 Трейдер' для ${member.user.tag}`);
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
