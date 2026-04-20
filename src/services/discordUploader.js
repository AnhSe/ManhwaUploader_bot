const fs = require('fs')
const { AttachmentBuilder, ChannelType } = require('discord.js')

const SEPARATOR = '─'.repeat(40)
const MAX_FILES_PER_BATCH = 10
const MAX_BATCH_BYTES = 9 * 1024 * 1024 // 9 MB — safe limit under Discord's 10 MB cap (no boost)

const formatDate = (isoDate) => {
  if (!isoDate) return 'Unknown'
  return new Date(isoDate).toLocaleDateString('vi-VN')
}

const getFileSize = (filePath) => {
  try {
    return fs.statSync(filePath).size
  } catch {
    return null
  }
}

const toMB = (bytes) => (bytes / 1024 / 1024).toFixed(1)

/**
 * Split image paths into batches respecting both file count (10) and
 * total message size (9 MB safe limit) constraints.
 */
const buildBatches = (imagePaths) => {
  const batches = []
  let currentBatch = []
  let currentSize = 0

  for (const imgPath of imagePaths) {
    const size = getFileSize(imgPath)
    if (size === null) continue

    if (size > MAX_BATCH_BYTES) {
      console.warn(`[uploader] Skipping oversized image (${toMB(size)} MB): ${imgPath}`)
      continue
    }

    const wouldExceedSize = currentSize + size > MAX_BATCH_BYTES
    const wouldExceedCount = currentBatch.length >= MAX_FILES_PER_BATCH

    if ((wouldExceedSize || wouldExceedCount) && currentBatch.length > 0) {
      batches.push(currentBatch)
      currentBatch = []
      currentSize = 0
    }

    currentBatch.push(imgPath)
    currentSize += size
  }

  if (currentBatch.length > 0) batches.push(currentBatch)
  return batches
}

const safeSend = async (channel, options, label) => {
  try {
    await channel.send(options)
  } catch (err) {
    console.error(`[uploader] Failed to send ${label}: ${err.message}`)
    await channel.send({ content: `⚠️ Không thể upload: \`${label}\` (${err.message})` })
  }
}

const buildInfoText = (manga) => {
  const description =
    manga.description.length > 500
      ? manga.description.slice(0, 497) + '...'
      : manga.description

  const lines = [
    `📖 **${manga.title}**`,
    `👤 **Author:** ${manga.author}`,
    `🎨 **Artist:** ${manga.artist}`,
    `🏷️ **Genres:** ${manga.genres.join(', ') || 'N/A'}`,
    `📅 **Latest Chapter:** ${formatDate(manga.latestChapterDate)}`,
  ]
  if (description) lines.push(`\n📝 ${description}`)
  return lines.join('\n')
}

/**
 * Upload all chapters into a channel/thread (no cover or info header).
 */
const uploadChapters = async (channel, manga) => {
  await channel.send({ content: SEPARATOR })

  for (const chapter of manga.chapters) {
    await channel.send({ content: `📄 **${chapter.name}**` })

    const batches = buildBatches(chapter.images)
    for (let i = 0; i < batches.length; i++) {
      await safeSend(
        channel,
        { files: batches[i].map((p) => new AttachmentBuilder(p)) },
        `${chapter.name} batch ${i + 1}/${batches.length}`
      )
    }

    if (chapter.pdf) {
      const pdfSize = getFileSize(chapter.pdf)
      if (pdfSize !== null && pdfSize <= MAX_BATCH_BYTES) {
        await safeSend(
          channel,
          { files: [new AttachmentBuilder(chapter.pdf)] },
          `${chapter.name}.pdf`
        )
      } else {
        const sizeLabel = pdfSize ? `${toMB(pdfSize)} MB` : 'unknown size'
        await channel.send({
          content: `⚠️ PDF quá lớn (${sizeLabel}), bỏ qua: \`${chapter.pdf}\``,
        })
      }
    }

    await channel.send({ content: SEPARATOR })
  }
}

/**
 * Upload to a regular text channel: cover → info → chapters.
 */
const uploadToTextChannel = async (channel, manga) => {
  if (manga.coverPath) {
    await safeSend(channel, { files: [new AttachmentBuilder(manga.coverPath)] }, 'cover')
  }
  await channel.send({ content: buildInfoText(manga) })
  await uploadChapters(channel, manga)
}

/**
 * Upload to a Forum channel: create a new post with cover + info as the
 * opening message, then upload chapters inside the resulting thread.
 */
const uploadToForum = async (forumChannel, manga) => {
  const coverFiles = manga.coverPath
    ? [new AttachmentBuilder(manga.coverPath)]
    : []

  const thread = await forumChannel.threads.create({
    name: manga.title,
    message: {
      content: buildInfoText(manga),
      files: coverFiles,
    },
  })

  await uploadChapters(thread, manga)
}

/**
 * Main entry — auto-detects channel type and routes accordingly.
 */
const uploadManga = async (channel, manga) => {
  if (channel.type === ChannelType.GuildForum) {
    return uploadToForum(channel, manga)
  }
  return uploadToTextChannel(channel, manga)
}

module.exports = { uploadManga }
