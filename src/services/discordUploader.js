const fs = require('fs')
const { AttachmentBuilder } = require('discord.js')

const SEPARATOR = '─'.repeat(40)
const BATCH_SIZE = 10
const FILE_SIZE_LIMIT = 25 * 1024 * 1024 // 25 MB

const formatDate = (isoDate) => {
  if (!isoDate) return 'Unknown'
  return new Date(isoDate).toLocaleDateString('vi-VN')
}

const isFileSafe = (filePath) => {
  try {
    return fs.statSync(filePath).size <= FILE_SIZE_LIMIT
  } catch {
    return false
  }
}

const sendImageBatch = async (channel, imagePaths) => {
  const safe = imagePaths.filter(isFileSafe)
  if (safe.length > 0) {
    await channel.send({ files: safe.map((p) => new AttachmentBuilder(p)) })
  }
}

const uploadManga = async (channel, manga) => {
  // Cover
  if (manga.coverPath) {
    await channel.send({ files: [new AttachmentBuilder(manga.coverPath)] })
  }

  // Manga info
  const description =
    manga.description.length > 500
      ? manga.description.slice(0, 497) + '...'
      : manga.description

  const infoLines = [
    `📖 **${manga.title}**`,
    `👤 **Author:** ${manga.author}`,
    `🎨 **Artist:** ${manga.artist}`,
    `🏷️ **Genres:** ${manga.genres.join(', ') || 'N/A'}`,
    `📅 **Latest Chapter:** ${formatDate(manga.latestChapterDate)}`,
  ]
  if (description) infoLines.push(`\n📝 ${description}`)

  await channel.send({ content: infoLines.join('\n') })
  await channel.send({ content: SEPARATOR })

  // Chapter loop
  for (const chapter of manga.chapters) {
    await channel.send({ content: `📄 **${chapter.name}**` })

    // PNGs in order, batched
    for (let i = 0; i < chapter.images.length; i += BATCH_SIZE) {
      await sendImageBatch(channel, chapter.images.slice(i, i + BATCH_SIZE))
    }

    // PDF
    if (chapter.pdf) {
      if (isFileSafe(chapter.pdf)) {
        await channel.send({ files: [new AttachmentBuilder(chapter.pdf)] })
      } else {
        await channel.send({
          content: `⚠️ PDF quá lớn (>25MB), bỏ qua: \`${chapter.pdf}\``,
        })
      }
    }

    await channel.send({ content: SEPARATOR })
  }
}

module.exports = { uploadManga }
