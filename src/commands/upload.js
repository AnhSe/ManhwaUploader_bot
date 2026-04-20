const { SlashCommandBuilder, ChannelType } = require('discord.js')
const { getManga } = require('../services/libraryReader')
const { uploadManga } = require('../services/discordUploader')
const { downloadPath } = require('../config')

module.exports = {
  data: new SlashCommandBuilder()
    .setName('upload')
    .setDescription('Upload toàn bộ một manhwa lên Discord channel hoặc Forum')
    .addStringOption((opt) =>
      opt
        .setName('manga')
        .setDescription('Slug của manga (dùng /list để xem danh sách)')
        .setRequired(true)
    )
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Text channel hoặc Forum channel để upload')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildForum)
        .setRequired(false)
    ),

  async execute(interaction) {
    const slug = interaction.options.getString('manga')
    const targetChannel = interaction.options.getChannel('channel') ?? interaction.channel

    const manga = getManga(downloadPath, slug)
    if (!manga) {
      return interaction.reply({
        content: `❌ Không tìm thấy manga: \`${slug}\`\nDùng \`/list\` để xem danh sách.`,
        flags: 64,
      })
    }

    const isForum = targetChannel.type === ChannelType.GuildForum
    const destination = isForum
      ? `Forum **${targetChannel.name}** (tạo post mới)`
      : `${targetChannel}`

    await interaction.reply({
      content: `✅ Bắt đầu upload **${manga.title}** (${manga.chapters.length} chapters) → ${destination}`,
      flags: 64,
    })

    try {
      await uploadManga(targetChannel, manga)
      await interaction.followUp({
        content: `🎉 Upload hoàn tất **${manga.title}**!`,
        flags: 64,
      })
    } catch (err) {
      console.error('[upload]', err)
      await interaction.followUp({
        content: `❌ Lỗi khi upload: ${err.message}`,
        flags: 64,
      })
    }
  },
}
