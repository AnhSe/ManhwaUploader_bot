const fs = require('fs')
const path = require('path')
const { AttachmentBuilder, ChannelType } = require('discord.js')

const SEPARATOR = '-'.repeat(40)
const MAX_FILES_PER_BATCH = 10
const MAX_BATCH_BYTES = 9 * 1024 * 1024 // 9 MB safe limit under Discord's 10 MB cap (no boost)
const MAX_INFO_TEXT_CHARS = 1900

const getFileSize = (filePath) => {
  try {
    return fs.statSync(filePath).size
  } catch {
    return null
  }
}

const toMB = (bytes) => (bytes / 1024 / 1024).toFixed(1)

const formatValue = (value) => value || 'Unknown'

const formatList = (items) =>
  Array.isArray(items) && items.length > 0 ? items.join(', ') : 'N/A'

const truncate = (text, maxLength) => {
  if (!text || text.length <= maxLength) return text
  if (maxLength <= 3) return '...'.slice(0, maxLength)
  return text.slice(0, maxLength - 3) + '...'
}

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
    await channel.send({ content: `Warning: could not upload \`${label}\` (${err.message})` })
  }
}

const buildInfoText = (manga) => {
  const lines = [
    `📖 **${manga.title}**`,
    `🔖 **Alt Titles:** ${formatList(manga.altTitles)}`,
    `✍️ **Author:** ${formatValue(manga.author)}`,
    `🎨 **Artist:** ${formatValue(manga.artist)}`,
    `📌 **Status:** ${formatValue(manga.status)}`,
    `🗓️ **Publication Year:** ${formatValue(manga.publicationYear)}`,
    `🏷️ **Genres:** ${formatList(manga.genres)}`,
    `🧾 **Tags:** ${formatList(manga.tags)}`,
    `▶️ **Start Date:** ${formatValue(manga.startDate)}`,
    `⏹️ **End Date:** ${formatValue(manga.endDate)}`,
    `📚 **Total Chapters:** ${formatValue(manga.totalChapters)}`,
  ]

  if (manga.description) {
    const prefix = lines.join('\n')
    const descriptionPrefix = '\n\n📝 **Description:** '
    const remaining = MAX_INFO_TEXT_CHARS - prefix.length - descriptionPrefix.length
    if (remaining > 0) {
      lines.push(`${descriptionPrefix}${truncate(manga.description, remaining)}`)
    }
  }

  return lines.join('\n')
}

/**
 * Upload all chapters into a channel/thread (no cover or info header).
 */
const uploadChapters = async (channel, manga) => {
  await channel.send({ content: SEPARATOR })

  for (const chapter of manga.chapters) {
    await channel.send({ content: `**${chapter.name}**` })

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
        const pdfName = path.basename(chapter.pdf)
        await channel.send({
          content: `PDF is too large (${sizeLabel}), skipped: \`${pdfName}\``,
        })
      }
    }

    await channel.send({ content: SEPARATOR })
  }
}

/**
 * Upload to a regular text channel: cover, info, then chapters.
 */
const uploadToTextChannel = async (channel, manga) => {
  if (manga.coverPath) {
    await safeSend(channel, { files: [new AttachmentBuilder(manga.coverPath)] }, 'cover')
  }
  await channel.send({ content: buildInfoText(manga) })
  await uploadChapters(channel, manga)
}

/**
 * Resolve genre names to forum tag IDs.
 * Creates missing tags automatically (up to Discord's 20-tag forum limit).
 * Returns at most 5 tag IDs (Discord's per-post limit).
 */
const resolveForumTags = async (forumChannel, genres) => {
  if (!genres || genres.length === 0) return []

  const targetGenres = genres.slice(0, 5)
  const existingTags = forumChannel.availableTags
  const tagIds = []
  const toCreate = []

  for (const genre of targetGenres) {
    const match = existingTags.find((t) => t.name.toLowerCase() === genre.toLowerCase())
    if (match) {
      tagIds.push(match.id)
    } else {
      toCreate.push(genre)
    }
  }

  if (toCreate.length > 0) {
    const slotsLeft = 20 - existingTags.length
    const canCreate = toCreate.slice(0, slotsLeft)

    if (canCreate.length > 0) {
      console.log(`[forum] Creating ${canCreate.length} new tag(s): ${canCreate.join(', ')}`)
      const newTagDefs = canCreate.map((name) => ({ name, moderated: false }))
      const updated = await forumChannel.edit({
        availableTags: [...existingTags, ...newTagDefs],
      })
      for (const genre of canCreate) {
        const tag = updated.availableTags.find(
          (t) => t.name.toLowerCase() === genre.toLowerCase()
        )
        if (tag) tagIds.push(tag.id)
      }
    }
  }

  return tagIds.slice(0, 5)
}

/**
 * Upload to a Forum channel: create a new post with cover + info as the
 * opening message, then upload chapters inside the resulting thread.
 * Forum tags are auto-resolved from manga genres only.
 */
const uploadToForum = async (forumChannel, manga) => {
  const coverFiles = manga.coverPath ? [new AttachmentBuilder(manga.coverPath)] : []

  let appliedTags = []
  try {
    appliedTags = await resolveForumTags(forumChannel, manga.genres)
  } catch (err) {
    console.warn(`[forum] Could not resolve tags: ${err.message}`)
  }

  const thread = await forumChannel.threads.create({
    name: manga.title,
    appliedTags,
    message: {
      content: buildInfoText(manga),
      files: coverFiles,
    },
  })

  await uploadChapters(thread, manga)
}

/**
 * Main entry. Auto-detects channel type and routes accordingly.
 */
const uploadManga = async (channel, manga) => {
  if (channel.type === ChannelType.GuildForum) {
    return uploadToForum(channel, manga)
  }
  return uploadToTextChannel(channel, manga)
}

module.exports = { uploadManga }
