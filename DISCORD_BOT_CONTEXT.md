# MangaDownloader — Context cho Discord Bot

Tài liệu này mô tả toàn bộ cấu trúc dữ liệu của ứng dụng **MangaDownloader** (Electron/React desktop app) để dùng làm context khi xây dựng Discord bot tự động upload ảnh manhwa.

---

## 1. Mục tiêu Discord Bot

Bot cần đọc trực tiếp từ filesystem (không qua Electron IPC), sau đó upload ảnh chapter lên Discord channel.

**Use case chính:**
- User gõ lệnh → bot list danh sách manga đã download
- User chọn manga + chapter → bot upload từng trang lên Discord

---

## 2. Cấu trúc Thư Mục Lưu Trữ

### Default download path
```
Windows: C:\Users\{username}\Documents\MangaDownloader\
```

Cấu hình thực tế được lưu ở:
```
C:\Users\{username}\AppData\Roaming\{appName}\config.json
```

### Cây thư mục
```
MangaDownloader/
├── sword-art-online/
│   ├── cover.jpg               ← Ảnh bìa
│   ├── metadata.json           ← Metadata của manga
│   ├── Chapter_001/
│   │   ├── Chapter_001_Page_001.jpg
│   │   ├── Chapter_001_Page_002.jpg
│   │   └── Chapter_001_Page_003.png
│   ├── Chapter_002/
│   │   ├── Chapter_002_Page_001.jpg
│   │   └── ...
│   └── ...
├── one-piece/
│   ├── cover.jpg
│   ├── metadata.json
│   ├── Chapter_001/
│   └── ...
└── ...
```

---

## 3. Quy Tắc Đặt Tên

### Tên folder manga
- Lấy từ URL path, đã sanitize (ký tự không hợp lệ → `_`)
- Ví dụ: URL `/manga/sword-art-online` → folder `sword-art-online`

### Tên folder chapter
- Format: `Chapter_` + số 3 chữ số (zero-padded)
- Chapter 1 → `Chapter_001`
- Chapter 12 → `Chapter_012`
- Chapter 5.5 → `Chapter_005` (phần thập phân bị bỏ)

### Tên file ảnh
- Format: `{TênFolderChapter}_Page_{3 chữ số}.{ext}`
- Ví dụ: `Chapter_001_Page_001.jpg`, `Chapter_012_Page_042.png`
- Extensions được hỗ trợ: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`

### Sắp xếp khi đọc
- Chapters và pages đều sort theo số trích xuất từ tên file (numeric sort, không phải lexicographic)

---

## 4. File `metadata.json`

Mỗi manga folder có một file `metadata.json`:

```json
{
  "sourceUrl": "https://manga18fx.com/manga/sword-art-online",
  "siteDomain": "manga18fx.com",
  "addedAt": "2026-04-20T10:30:00.000Z",
  "lastChecked": "2026-04-20T15:45:00.000Z",
  "chapterList": [1, 2, 3, 4, 5, 12.5, 13],
  "mangaInfo": {
    "title": "Sword Art Online",
    "author": "Reki Kawahara",
    "artist": "Abec",
    "genres": ["Action", "Adventure", "Fantasy"],
    "description": "...",
    "latestChapterDate": "2026-04-19T08:00:00.000Z"
  }
}
```

| Field | Mô tả |
|-------|-------|
| `sourceUrl` | URL gốc để check update |
| `addedAt` | Thời điểm thêm vào library |
| `lastChecked` | Lần cuối check chapter mới |
| `chapterList` | Danh sách số chapter đã download (array of numbers) |
| `mangaInfo.title` | Tên hiển thị (đẹp hơn tên folder) |
| `mangaInfo.genres` | Thể loại |
| `mangaInfo.latestChapterDate` | Ngày chapter mới nhất |

> **Note:** `metadata.json` có thể không tồn tại nếu manga được thêm thủ công. `mangaInfo` có thể là `null` nếu scraper không extract được.

---

## 5. File `config.json` (AppData)

```
C:\Users\{username}\AppData\Roaming\{appName}\config.json
```

```json
{
  "downloadPath": "C:\\Users\\username\\Documents\\MangaDownloader"
}
```

> Nếu `downloadPath` không có → dùng default: `Documents/MangaDownloader/`

---

## 6. File `reading-progress.json` (AppData)

```
C:\Users\{username}\AppData\Roaming\{appName}\reading-progress.json
```

```json
{
  "C:\\Users\\username\\Documents\\MangaDownloader\\sword-art-online": {
    "chapterIndex": 54,
    "page": 12,
    "lastReadAt": "2026-04-20T22:15:00.000Z"
  },
  "C:\\...\\one-piece": {
    "chapterIndex": 0,
    "page": 1,
    "lastReadAt": "2026-04-19T10:00:00.000Z"
  }
}
```

| Field | Mô tả |
|-------|-------|
| Key | Absolute path đến folder manga |
| `chapterIndex` | Index 0-based trong danh sách chapters (đã sort) |
| `page` | Trang đang đọc (1-based) |
| `lastReadAt` | ISO timestamp lần đọc cuối |

---

## 7. File `collections.json` (AppData)

```
C:\Users\{username}\AppData\Roaming\{appName}\collections.json
```

```json
{
  "collections": [
    {
      "id": "fav",
      "name": "Yêu Thích",
      "icon": "favorite",
      "color": "#f59e0b",
      "mangaPaths": [
        "C:\\...\\MangaDownloader\\sword-art-online"
      ]
    },
    {
      "id": "reread",
      "name": "Đọc Lại",
      "icon": "replay",
      "color": "#c084fc",
      "mangaPaths": []
    }
  ]
}
```

`mangaPaths` là array các **absolute path** đến folder manga.

---

## 8. Cách Đọc Library (Pseudo-code)

```javascript
const fs = require('fs')
const path = require('path')

const IMAGE_EXTS = /\.(jpg|jpeg|png|webp|gif)$/i

function getDownloadPath() {
  // Đọc config từ AppData
  const configPath = path.join(process.env.APPDATA, 'TheArchive', 'config.json')
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    return config.downloadPath
  } catch {
    return path.join(process.env.USERPROFILE, 'Documents', 'MangaDownloader')
  }
}

function getLibrary() {
  const downloadPath = getDownloadPath()
  const entries = fs.readdirSync(downloadPath, { withFileTypes: true })

  return entries
    .filter(e => e.isDirectory())
    .map(e => {
      const mangaPath = path.join(downloadPath, e.name)
      const metaPath  = path.join(mangaPath, 'metadata.json')
      const coverPath = path.join(mangaPath, 'cover.jpg')

      let meta = {}
      try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) } catch {}

      const chapters = getChapters(mangaPath)

      return {
        name: e.name,
        path: mangaPath,
        title: meta.mangaInfo?.title || formatName(e.name),
        coverPath: fs.existsSync(coverPath) ? coverPath : null,
        chapters: chapters.length,
        chapterList: chapters,
        sourceUrl: meta.sourceUrl || null,
        genres: meta.mangaInfo?.genres || [],
        addedAt: meta.addedAt || null,
      }
    })
    .filter(m => m.chapters > 0) // Bỏ manga đã soft-delete
}

function getChapters(mangaPath) {
  const entries = fs.readdirSync(mangaPath, { withFileTypes: true })
  return entries
    .filter(e => e.isDirectory())
    .map(e => {
      const chapterPath = path.join(mangaPath, e.name)
      const images = getImages(chapterPath)
      return { name: e.name, path: chapterPath, imageCount: images.length }
    })
    .filter(c => c.imageCount > 0)
    .sort((a, b) => extractNumber(a.name) - extractNumber(b.name))
}

function getImages(chapterPath) {
  return fs.readdirSync(chapterPath)
    .filter(f => IMAGE_EXTS.test(f))
    .sort((a, b) => extractNumber(a) - extractNumber(b))
    .map(f => path.join(chapterPath, f))
}

function extractNumber(str) {
  const m = str.match(/\d+/)
  return m ? parseInt(m[0], 10) : 0
}

function formatName(slug) {
  return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
```

---

## 9. Cách Discord Bot Upload Ảnh

Discord có giới hạn upload:
- **25 MB** mỗi file (tài khoản thường)
- **50 MB** với Nitro / Server boosted
- Có thể upload **nhiều file** trong 1 message (tối đa 10 attachments)

### Gợi ý flow bot:

```javascript
// Gửi 1 chapter lên Discord
async function sendChapter(channel, manga, chapterIndex) {
  const chapter = manga.chapterList[chapterIndex]
  const images  = getImages(chapter.path)

  // Gửi theo batch 10 ảnh/message
  for (let i = 0; i < images.length; i += 10) {
    const batch = images.slice(i, i + 10)
    await channel.send({
      content: i === 0 ? `📖 **${manga.title}** — ${chapter.name}` : '',
      files: batch.map(imgPath => ({ attachment: imgPath })),
    })
  }
}
```

---

## 10. Tên App (AppData Path)

App Electron dùng tên `"The Archive"` (package.json `productName`).

AppData path thực tế:
```
C:\Users\{username}\AppData\Roaming\The Archive\
```

Các file cần đọc:
| File | Dùng để |
|------|---------|
| `config.json` | Tìm đường dẫn download folder |
| `reading-progress.json` | Biết user đang đọc đến đâu |
| `collections.json` | Lấy danh sách collections (Yêu Thích, v.v.) |

---

## 11. Tóm Tắt Nhanh cho Bot

```
Download folder
  └── {manga-slug}/           ← tên từ URL
      ├── cover.jpg           ← ảnh bìa
      ├── metadata.json       ← title, genres, sourceUrl
      └── Chapter_001/        ← Chapter_NNN (3 digits, zero-padded)
          ├── Chapter_001_Page_001.jpg
          └── Chapter_001_Page_002.jpg

AppData/Roaming/The Archive/
  ├── config.json             ← downloadPath
  ├── collections.json        ← collections[].mangaPaths
  └── reading-progress.json   ← {mangaPath: {chapterIndex, page}}
```

**Bot chỉ cần đọc filesystem — không cần chạy Electron app.**
