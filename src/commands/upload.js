const { SlashCommandBuilder, ChannelType } = require('discord.js')
const { getManga } = require('../services/libraryReader')
const { uploadManga } = require('../services/discordUploader')
const { downloadPath } = require('../config')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('upload')
    .setDescription('Upload toàn bộ một manhwa lên Discord channel')
    .addStringOption((opt) =>
      opt
        .setName('manga')
        .setDescription('Slug của manga (dùng /list để xem danh sách)')
        .setRequired(true)
    )
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Channel để upload (mặc định: channel hiện tại)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  async execute(interaction) {
    const slug = interaction.options.getString('manga')
    const targetChannel = interaction.options.getChannel('channel') ?? interaction.channel

    const manga = getManga(downloadPath, slug)
    if (!manga) {
      return interaction.reply({
        content: `❌ Không tìm thấy manga: \`${slug}\`\nDùng \`/list\` để xem danh sách.`,
        ephemeral: true,
      })
    }

    await interaction.reply({
      content: `✅ Bắt đầu upload **${manga.title}** (${manga.chapters.length} chapters) → ${targetChannel}`,
      ephemeral: true,
    })

    try {
      await uploadManga(targetChannel, manga)
      await interaction.followUp({
        content: `🎉 Upload hoàn tất **${manga.title}**!`,
        ephemeral: true,
      })
    } catch (err) {
      console.error('[upload]', err)
      await interaction.followUp({
        content: `❌ Lỗi khi upload: ${err.message}`,
        ephemeral: true,
      })
    }
  },
}
