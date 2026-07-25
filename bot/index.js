import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, REST, Routes, SlashCommandBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    .setName('setup-welcome')
    .setDescription('Оформить приветственное сообщение и правила в текущем канале (для админов)')
];

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
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

// Command handler
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
          .setURL('https://happy-g0ose.github.io/bss-index/')
      );

    await interaction.reply({ embeds: [embed], components: [row] });
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

    await interaction.reply({ embeds: [embed] });
  }

  else if (commandName === 'site') {
    const embed = new EmbedBuilder()
      .setTitle('🐝 BSS Index — Лучший База Цен и Калькулятор BSS')
      .setDescription('BSS Index — это современный русскоязычный сайт цен и калькулятор трейдов для Bee Swarm Simulator!\n\n✨ **Возможности:**\n• Цены на 330+ предметов, стикеров и биквипов\n• Интерактивный W/F/L Калькулятор обмена\n• 📸 AI-Сканер трейдов по скриншотам!\n• История динамики цен и графики')
      .setColor('#f59e0b')
      .setThumbnail('https://raw.githubusercontent.com/happy-g0ose/bss-index/main/public/favicon.png');

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Перейти на сайт BSS Index')
          .setStyle(ButtonStyle.Link)
          .setURL('https://happy-g0ose.github.io/bss-index/')
      );

    await interaction.reply({ embeds: [embed], components: [row] });
  }

  else if (commandName === 'setup-welcome') {
    if (!interaction.memberPermissions?.has('Administrator')) {
      return interaction.reply({ content: '❌ Эта команда доступна только администраторам.', ephemeral: true });
    }

    const welcomeEmbed = new EmbedBuilder()
      .setTitle('👋 Добро пожаловать на официальный сервер BSS Index!')
      .setDescription('Приветствуем вас в лучшем русскоязычном сообществе по обменам и ценам в **Bee Swarm Simulator**!\n\nЗдесь вы найдете самый точный калькулятор сделок, свежие цены, помощь сообщества по трейдам и умный ИИ-сканер.')
      .setColor('#f59e0b')
      .addFields(
        { name: '🌐 Наш сайт цен:', value: '[BSS Index Website](https://happy-g0ose.github.io/bss-index/)' },
        { name: '🤖 Команды бота:', value: '• `/price [предмет]` — узнать точную цену предмета\n• `/calc` — быстро рассчитать выгоду трейда\n• `/site` — получить ссылку на наш сайт' }
      )
      .setImage('https://raw.githubusercontent.com/happy-g0ose/bss-index/main/public/favicon.png');

    await interaction.channel.send({ embeds: [welcomeEmbed] });
    await interaction.reply({ content: '✅ Приветственное сообщение успешно отправлено!', ephemeral: true });
  }
});

// Register slash commands and start bot
async function main() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;

  if (!token || token === 'YOUR_DISCORD_BOT_TOKEN_HERE') {
    console.error('❌ ОШИБКА: В файле bot/.env не указан DISCORD_TOKEN!');
    console.log('👉 Пожалуйста, создайте бота на https://discord.com/developers/applications, скопируйте Token и вставьте его в bot/.env');
    process.exit(1);
  }

  try {
    console.log('🔄 Регистрация слэш-команд (/price, /calc, /site)...');
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

  client.once('ready', () => {
    console.log(`🤖 Бот BSS Index успешно запущен под именем: ${client.user.tag}`);
    client.user.setActivity('BSS Prices & Trades | /price', { type: 3 }); // Watching
  });

  client.login(token);
}

main();
