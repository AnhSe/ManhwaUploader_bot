const path = require('path')
const fs = require('fs')

require('dotenv').config()

const getDownloadPath = () => {
  if (process.env.MANGA_PATH) return process.env.MANGA_PATH
  try {
    const configPath = path.join(process.env.APPDATA, 'The Archive', 'config.json')
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    return config.downloadPath
  } catch {
    return path.join(process.env.USERPROFILE, 'Documents', 'MangaDownloader')
  }
}

module.exports = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  downloadPath: getDownloadPath(),
}
