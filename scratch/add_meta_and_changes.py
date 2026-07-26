import os

bot_file = 'bot/index.js'

with open(bot_file, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Inject SlashCommandBuilder definitions
cmd_defs = """  new SlashCommandBuilder()
    .setName('meta')
    .setDescription('Посмотреть самые хайповые и востребованные предметы BSS!'),

  new SlashCommandBuilder()
    .setName('price-changes')
    .setDescription('Последние изменения цен на стикеры и биквипы!'),

"""

# Insert before 'site' command
if "new SlashCommandBuilder()\n    .setName('site')" in content:
    content = content.replace(
        "new SlashCommandBuilder()\n    .setName('site')",
        cmd_defs + "  new SlashCommandBuilder()\n    .setName('site')"
    )
elif "new SlashCommandBuilder().setName('site')" in content:
    content = content.replace(
        "new SlashCommandBuilder().setName('site')",
        cmd_defs + "  new SlashCommandBuilder().setName('site')"
    )

# 2. Inject command handlers
cmd_handlers = """  else if (commandName === 'meta') {
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
    
    updateUserActivity(interaction.user.id, interaction.guild, interaction.channel).catch(err => console.error(err));
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
      const risersText = risers.map(x => `📈 **${x.item.name}**: ${x.oldPrice} ★ ➡️ **${x.item.value} ★** (+${x.diff.toFixed(2)})`).join('\\n');
      embed.addFields({ name: '🚀 Сильно выросли', value: risersText, inline: false });
    } else {
      embed.addFields({ name: '🚀 Сильно выросли', value: 'Пока нет свежих данных о росте.', inline: false });
    }
    
    if (fallers.length > 0) {
      const fallersText = fallers.map(x => `📉 **${x.item.name}**: ${x.oldPrice} ★ ➡️ **${x.item.value} ★** (${x.diff.toFixed(2)})`).join('\\n');
      embed.addFields({ name: '⏬ Сильно упали', value: fallersText, inline: false });
    } else {
      embed.addFields({ name: '⏬ Сильно упали', value: 'Пока нет свежих данных о падении.', inline: false });
    }
    
    embed.setFooter({ text: 'BSS Index Live Data', iconURL: 'https://raw.githubusercontent.com/happy-g0ose/bss-index/main/public/favicon.png' });
    
    updateUserActivity(interaction.user.id, interaction.guild, interaction.channel).catch(err => console.error(err));
    await interaction.reply({ embeds: [embed] }).catch(err => console.error(err));
  }
"""

if "else if (commandName === 'site')" in content:
    content = content.replace("  else if (commandName === 'site')", cmd_handlers + "\n  else if (commandName === 'site')")

with open(bot_file, 'w', encoding='utf-8') as f:
    f.write(content)

print("Saved updated bot index.js with /meta and /price-changes commands!")
