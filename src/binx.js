require('dotenv').config()
const {
    default: Baileys,
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys')
const { QuickDB } = require('quick.db')
const MessageHandler = require('./Handlers/Message')
const EventsHandler = require('./Handlers/Events')
const contact = require('./lib/contacts')
const utils = require('./lib/function')
const chalk = require('chalk')
const P = require('pino')
const { Boom } = require('@hapi/boom')
const { imageSync } = require('qr-image')
const { remove } = require('fs-extra')

const port = process.env.PORT || 3000
const driver = new QuickDB()

const start = async () => {
    const { state, saveCreds } = await useMultiFileAuthState('session')
    const client = Baileys({
        version: (await fetchLatestBaileysVersion()).version,
        auth: state,
        logger: P({ level: 'silent' }),
        browser: ['AI', 'silent', '4.0.0'],
        printQRInTerminal: true
    })

    client.name = process.env.NAME || ''
    client.prefix = process.env.PREFIX || ''
    client.chatgpt_apiKey = process.env.OPENAI_KEY || ''
    client.apiKey = process.env.GEMINI_KEY || ''
    client.mods = (process.env.MODS || '2349041368361').split(', ').map((jid) => `${jid}@s.whatsapp.net`)

    client.DB = new QuickDB({ driver })
    client.messagesMap = client.DB.table('messages')
    client.contactDB = client.DB.table('contacts')
    client.daily = new Map()
    client.contact = contact
    client.utils = utils

    client.getAllGroups = async () => Object.keys(await client.groupFetchAllParticipating())

    /**
     * @returns {Promise<string[]>}
     */

    client.getAllUsers = async () => {
        const data = (await client.contactDB.all()).map((x) => x.id)
        const users = data.filter((element) => /^\d+@s$/.test(element)).map((element) => `${element}.whatsapp.net`)
        return users
    }

    client.log = (text, color = 'green') =>
        color ? console.log(chalk.keyword(color)(text)) : console.log(chalk.green(text))

    client.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update
        if (update.qr) {
            client.log(`[${chalk.red('!')}]`, 'white')
            client.log(`Scan the QR code above | You can also authenicate in http://localhost:${port}`, 'blue')
            client.QR = imageSync(update.qr)
        }
        if (connection === 'close') {
            const { statusCode } = new Boom(lastDisconnect?.error).output
            if (statusCode !== DisconnectReason.loggedOut) {
                console.log('Connecting...')
                setTimeout(() => start(), 3000)
            } else {
                client.log('Disconnected.', 'red')
                await remove('session')
                console.log('Starting...')
                setTimeout(() => start(), 3000)
            }
        }
        if (connection === 'connecting') {
            client.state = 'connecting'
            console.log('Connecting to WhatsApp...')
        }
        if (connection === 'open') {
            client.state = 'open'
            loadCommands()
            client.log('Connected to WhatsApp')
        }
    })

    app.get('/', (req, res) => res.status(200).setHeader('Content-Type', 'image/png').send(client.QR))

    client.ev.on('messages.upsert', async (messages) => await MessageHandler(messages, client))

    client.ev.on('group-participants.update', async (event) => await EventsHandler(event, client))

    client.ev.on('contacts.update', async (update) => await contact.saveContacts(update, client))

    client.ev.on('creds.update', saveCreds)
    return client
}

driver
    .connect()
    .then(() => {
        console.log('Connected to the database!')
        start()
    })
    .catch((err) => console.error(err))

app.listen(port, () => console.log(`Server started on PORT : ${port}`))
