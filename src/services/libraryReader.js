const fs = require('fs')
const path = require('path')

const IMAGE_EXTS = /\.(png|jpg|jpeg|webp|gif)$/i

const extractNumber = (str) => {
  const m = str.match(/\d+/)
  return m ? parseInt(m[0], 10) : 0
}

const formatTitle = (slug) =>
  slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

const readMetadata = (mangaPath) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(mangaPath, 'metadata.json'), 'utf-8'))
  } catch {
    return {}
  }
}

const asArray = (value) => (Array.isArray(value) ? value : [])

const getMetadataChapterCount = (meta) =>
  Array.isArray(meta.chapterList) ? meta.chapterList.length : null

const getChapterFiles = (chapterPath) => {
  const entries = fs.readdirSync(chapterPath)

  const images = entries
    .filter((f) => IMAGE_EXTS.test(f))
    .sort((a, b) => extractNumber(a) - extractNumber(b))
    .map((f) => path.join(chapterPath, f))

  const pdfName = entries.find((f) => f.toLowerCase().endsWith('.pdf'))

  return {
    images,
    pdf: pdfName ? path.join(chapterPath, pdfName) : null,
  }
}

const getChapters = (mangaPath) => {
  const entries = fs.readdirSync(mangaPath, { withFileTypes: true })
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => {
      const chapterPath = path.join(mangaPath, e.name)
      const files = getChapterFiles(chapterPath)
      return { name: e.name, path: chapterPath, ...files }
    })
    .filter((c) => c.images.length > 0)
    .sort((a, b) => extractNumber(a.name) - extractNumber(b.name))
}

const getLibrary = (downloadPath) => {
  const entries = fs.readdirSync(downloadPath, { withFileTypes: true })
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => {
      const mangaPath = path.join(downloadPath, e.name)
      const meta = readMetadata(mangaPath)
      const chapters = getChapters(mangaPath)
      const metadataChapterCount = getMetadataChapterCount(meta)
      return {
        slug: e.name,
        path: mangaPath,
        title: meta.mangaInfo?.title || formatTitle(e.name),
        chapterCount: metadataChapterCount ?? chapters.length,
        chaptersOnDisk: chapters.length,
      }
    })
    .filter((m) => m.chaptersOnDisk > 0)
}

const getManga = (downloadPath, slug) => {
  const mangaPath = path.join(downloadPath, slug)
  if (!fs.existsSync(mangaPath)) return null

  const meta = readMetadata(mangaPath)
  const info = meta.mangaInfo || {}
  const chapters = getChapters(mangaPath)
  const metadataChapterCount = getMetadataChapterCount(meta)

  const coverPath = path.join(mangaPath, 'cover.jpg')

  return {
    slug,
    path: mangaPath,
    title: info.title || formatTitle(slug),
    altTitles: asArray(info.altTitles),
    author: info.author || 'Unknown',
    artist: info.artist || 'Unknown',
    status: info.status || 'Unknown',
    publicationYear: info.publicationYear || 'Unknown',
    genres: asArray(info.genres),
    tags: asArray(info.tags),
    description: info.description || '',
    startDate: info.startDate || 'Unknown',
    endDate: info.endDate || 'Unknown',
    totalChapters: metadataChapterCount ?? chapters.length,
    coverPath: fs.existsSync(coverPath) ? coverPath : null,
    chapters,
  }
}

module.exports = { getLibrary, getManga }
