const fs = require('fs')
const path = require('path')

const IMAGE_EXTS = /\.(png|jpg|jpeg|webp|gif)$/i

const extractNumber = (str) => {
  const m = str.match(/\d+/)
  return m ? parseInt(m[0], 10) : 0
}

const formatTitle = (slug) =>
  slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

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
      let meta = {}
      try {
        meta = JSON.parse(fs.readFileSync(path.join(mangaPath, 'metadata.json'), 'utf-8'))
      } catch {}
      return {
        slug: e.name,
        path: mangaPath,
        title: meta.mangaInfo?.title || formatTitle(e.name),
        chapterCount: getChapters(mangaPath).length,
      }
    })
    .filter((m) => m.chapterCount > 0)
}

const getManga = (downloadPath, slug) => {
  const mangaPath = path.join(downloadPath, slug)
  if (!fs.existsSync(mangaPath)) return null

  let meta = {}
  try {
    meta = JSON.parse(fs.readFileSync(path.join(mangaPath, 'metadata.json'), 'utf-8'))
  } catch {}

  const coverPath = path.join(mangaPath, 'cover.jpg')

  return {
    slug,
    path: mangaPath,
    title: meta.mangaInfo?.title || formatTitle(slug),
    author: meta.mangaInfo?.author || 'Unknown',
    artist: meta.mangaInfo?.artist || 'Unknown',
    genres: meta.mangaInfo?.genres || [],
    description: meta.mangaInfo?.description || '',
    latestChapterDate: meta.mangaInfo?.latestChapterDate || null,
    coverPath: fs.existsSync(coverPath) ? coverPath : null,
    chapters: getChapters(mangaPath),
  }
}

module.exports = { getLibrary, getManga }
