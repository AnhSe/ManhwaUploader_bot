const { REST, Routes } = require('discord.js')
const fs = require('fs')
const path = require('path')
const { token, clientId, guildId } = require('./src/config')

const commands = []
const commandFiles = fs
  .readdirSync(path.join(__dirname, 'src', 'commands'))
  .filter((f) => f.endsWith('.js'))

for (const file of commandFiles) {
  const command = require(path.join(__dirname, 'src', 'commands', file))
  commands.push(command.data.toJSON())
}

const rest = new REST().setToken(token)

;(async () => {
  console.log(`Registering ${commands.length} slash commands to guild ${guildId}...`)
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands })
  console.log('✅ Commands registered!')
})().catch(console.error)
