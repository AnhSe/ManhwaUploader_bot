const { Client, GatewayIntentBits, Collection } = require('discord.js')
const fs = require('fs')
const path = require('path')
const { token } = require('./config')

const client = new Client({ intents: [GatewayIntentBits.Guilds] })
client.commands = new Collection()

const commandFiles = fs
  .readdirSync(path.join(__dirname, 'commands'))
  .filter((f) => f.endsWith('.js'))

for (const file of commandFiles) {
  const command = require(path.join(__dirname, 'commands', file))
  client.commands.set(command.data.name, command)
}

client.once('ready', () => {
  console.log(`✅ Bot online: ${client.user.tag}`)
  console.log(`📚 Commands loaded: ${[...client.commands.keys()].join(', ')}`)
})

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return

  const command = client.commands.get(interaction.commandName)
  if (!command) return

  try {
    await command.execute(interaction)
  } catch (err) {
    console.error(`[${interaction.commandName}]`, err)
    const reply = { content: '❌ Có lỗi xảy ra khi thực hiện lệnh.', ephemeral: true }
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply)
    } else {
      await interaction.reply(reply)
    }
  }
})

client.login(token)
