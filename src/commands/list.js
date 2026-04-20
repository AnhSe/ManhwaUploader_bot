const { SlashCommandBuilder } = require('discord.js')
const { getLibrary } = require('../services/libraryReader')
const { downloadPath } = require('../config')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('list')
    .setDescription('Liệt kê tất cả manga đã download'),

  async execute(interaction) {
    let library
    try {
      library = getLibrary(downloadPath)
    } catch (err) {
      return interaction.reply({
        content: `❌ Không đọc được thư mục: \`${downloadPath}\`\n${err.message}`,
        ephemeral: true,
      })
    }

    if (library.length === 0) {
      return interaction.reply({ content: '❌ Không tìm thấy manga nào.', ephemeral: true })
    }

    const lines = library.map(
      (m, i) => `${i + 1}. **${m.title}** (\`${m.slug}\`) — ${m.chapterCount} chapters`
    )

    // Split into chunks respecting the 2000-char Discord limit
    const chunks = []
    let current = ''
    for (const line of lines) {
      if (current.length + line.length + 1 > 1900) {
        chunks.push(current)
        current = line
      } else {
        current += (current ? '\n' : '') + line
      }
    }
    if (current) chunks.push(current)

    await interaction.reply({ content: chunks[0], ephemeral: true })
    for (const chunk of chunks.slice(1)) {
      await interaction.followUp({ content: chunk, ephemeral: true })
    }
  },
}
