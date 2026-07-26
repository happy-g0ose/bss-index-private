import os

bot_file = 'bot/index.js'

with open(bot_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Define the build meta path and startSiteUpdateDetector function
detector_code = """const buildMetaDbPath = path.join(__dirname, 'last_build.json');

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
              .setDescription('Сайт [bss-index.vercel.app](https://bss-index.vercel.app/) был успешно обновлен и перезапущен Vercel!')
              .setColor('#a855f7')
              .addFields(
                { name: '📝 Описание изменений:', value: `\`\`\`${meta.message || 'Без описания коммита'}\`\`\`` },
                { name: '👤 Автор:', value: meta.author || 'Разработчик', inline: true },
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
"""

# Place it in the code (e.g. before ensureBssRoles or main)
ensure_sig = "async function ensureBssRoles(guild) {"
ensure_idx = content.find(ensure_sig)

if ensure_idx != -1:
    content = content[:ensure_idx] + detector_code + "\n\n" + content[ensure_idx:]
    print("Injected startSiteUpdateDetector function declaration!")

# Call startSiteUpdateDetector when client is ready
ready_sig = """client.once('ready', () => {
    console.log(`🤖 Бот BSS Index успешно запущен под именем: ${client.user.tag}`);
    client.user.setActivity('BSS Prices & Trades | /price', { type: 3 });
  });"""

new_ready_sig = """client.once('ready', () => {
    console.log(`🤖 Бот BSS Index успешно запущен под именем: ${client.user.tag}`);
    client.user.setActivity('BSS Prices & Trades | /price', { type: 3 });
    startSiteUpdateDetector(client);
  });"""

content = content.replace(ready_sig, new_ready_sig)

with open(bot_file, 'w', encoding='utf-8') as f:
    f.write(content)

print("Saved updated bot index.js with Vercel deploy detection polling!")
