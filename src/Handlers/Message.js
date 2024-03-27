const { HelperPrompt, transcribe, wikipedia, google, countryTime, weather, toSpeech } = require('../lib/Helper')
const { Keys, complement } = require('../lib/Messages')
const { serialize, decodeJid } = require('../lib/WAclient')
const { GoogleGenerativeAI } = require('@google/generative-ai')
const { audioToSlice, audioMerge } = require('audio-slicer')
const emojis = require('emoji-strip')
let helper = ''

module.exports = async ({ messages }, client) => {
    const M = serialize(messages[0], client)
    if (!M.message || ['protocolMessage', 'senderKeyDistributionMessage'].includes(M.type) || !M.type) return null
    let { isGroup, sender, from, body } = M
    const result = isGroup ? await client.groupMetadata(from) : {}
    const admins = isGroup ? result.participants.filter(({ admin }) => admin).map(({ id }) => id) : []
    client.isAdmin = isGroup && admins?.includes(decodeJid(client.user?.id))
    const args = body.trim().split(' ')
    const isCmd = args[0].startsWith(client.prefix)
    let info = await client.daily.get(M.sender)

    const public = [isCmd, M.key.fromMe, !isGroup]
    if (!public.some(Boolean)) {
        const botJid = decodeJid(client.user.id)
        if (M.quoted || M.mentions.length) {
            const mentioned = M.quoted ? [M.quoted.participant] : M.mentions
            if (mentioned.includes(botJid)) {
                if (Keys.includes(M.type)) return void M.reply(complement(M.type))
                if (!body) return void M.reply('Go dm')
                const text = body.replace(/@\d+/g, '')
                let result = await getHelper(client.apiKey, text)
                if (!/^{\s*".*"\s*}$/.test(result)) result = '{ "normal": null }'
                const type = JSON.parse(result)
                return void (await getGemini(M, client, text, info?.voice))
            }
        }
    }

    const conditions = [isCmd, isGroup, M.key.fromMe]
    if (!conditions.some(Boolean)) {
        if (Keys.includes(M.type)) return void M.reply(complement(M.type))
        if (M.type === 'imageMessage' && !M.message.imageMessage.caption) {
            helper = await client.utils.ocrImage(await M.download())
            const details = `Provide a concise and interesting response based on the text in the image. Try to use emojis in your response. Avoid using the phrase 'Image Interpretation' and provide the description directly without any additional introductory statements. If the text on the image is a question or math problem, solve it. ${M.message?.imageMessage?.caption}`
            return void (await getGemini(M, client, details))
        }

        if (M.type === 'audioMessage') {
            const voice = M.message?.audioMessage?.ptt
            await M.reply(voice ? '👩🏻👂🎧' : '👩🏻🎧✍️')
            if (!voice) {
                let text = 'Write a Quick and Short Summary of text below:\n\n'
                const duration = M.message?.audioMessage?.seconds
                if (duration > 600) return void M.reply('You are only allowed to use audio less than 10 minutes')
                if (duration > 75) {
                    const audios = await audioToSlice(await M.download(), 75)
                    if (!audios || !audios.length) return void M.reply('An error occurred')
                    if (audios.length) {
                        const total = audios.length
                        for (let i = 0; i < total; i++) {
                            const result = await transcribe(audios[i], client)
                            text += result + '\n'
                            await M.reply(`🎙️ *${1 + i}/${total}* ▶️ _"${result}"_`)
                        }
                    }
                    return void (await getGemini(M, client, text))
                }
                const response = await transcribe(await M.download(), client)
                await M.reply(`🎙️ *1/1* ▶️ _"${response}"_`)
                text += response
                return void (await getGemini(M, client, text))
            }
            body = await transcribe(await M.download(), client)
            await M.reply(`I heard you saying 👩🏻👂🎧\n\n _"${body}_"`)
        }


        if (!body) return void null
        let result = await getHelper(client.apiKey, body)
        if (!/^{(\s*".*"\s*:\s*".*"\s*)}$/.test(result)) result = '{ "normal": null }'
        const type = JSON.parse(result)
        if (type.google) {
            helper = await google(type.google)
        } else if (type.time) {
            helper = await countryTime(type.time)
        } else if (type.weather) {
            helper = await weather(type.weather)
        } else if (type.voice) {
            info.voice = type.voice
            helper = type.voice ? '🟩 Enable' : '🟥 Disable'
        }
        return void (await getGemini(M, client, body, info?.voice))
    }

    if (!args[0] || !args[0].startsWith(client.prefix))
        return void client.log(
            `${chalk.cyanBright('Message')} from ${chalk.yellowBright(M.pushName)} in ${chalk.blueBright(
                result.subject || 'DM'
            )}`
        )
}

const createSpeech = async (client, text) => {
    const audios = await toSpeech(text)
    if (!audios.length) return 'Unable to make long text as audio'
    const audio = await audioMerge(audios)
    const buffer = await client.utils.mp3ToOpus(audio)
    return buffer
}

const getHelper = async (apiKey, content) => {
    if (!apiKey) return null
    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: 'gemini-pro' })
    try {
        const messages = [
            { role: 'user', parts: [{ text: `System Prompt: ${HelperPrompt}` }] },
            { role: 'model', parts: [{ text: 'Understood.' }] }
        ]
        const chat = model.startChat({
            history: messages,
            generationConfig: {
                maxOutputTokens: 4096
            }
        })
        const { response } = await chat.sendMessage(content)
        return response.text().replace(/\```/g, '')
    } catch (err) {
        console.log(err.message)
        return '{ "normal": null }'
    }
}

const getGemini = async (M, client, context, voice = false) => {
    if (!client.apiKey) return null
    const model = new GoogleGenerativeAI(client.apiKey).getGenerativeModel({ model: 'gemini-pro' })
    if (helper) helper = `\n\nHelper: ${helper}`
    try {
        const messages = (await client.messagesMap.get(M.from)) || []
        const content = `UTC: ${new Date().toUTCString()}\nName: ${
            M.username
        }\nMessage: ${context.trim()}\n\n ${helper}`
        const Systemprompt = `System Prompt: You are Ai, a friendly WhatsApp Text and Voice based AI Bot developed for the purpose of helping or solving any waec questions. Always give a very short & precise response not more than 240 words. You are updated up-to ${new Date().getFullYear()}, Always use emojis in your response.
                    To get any information, Waec Answers, exchanges rate, livescore, get media link url or upload medias, football realtime update, latest news, internet search, today's information, weather, time, google search, send images, stickers etc, You must always use the context provided by the Helper below the user's message to provide a more updated and correct response (Any information provided by the helper is correct and upto date, so never dispute it and never mention 'Helper' word in your response).`
        if (!messages.length) {
            messages.push({ role: 'user', parts: [{ text: Systemprompt }] })
            messages.push({ role: 'model', parts: [{ text: 'Understood.' }] })
        }
        if (messages[0].parts[0].text !== Systemprompt) messages[0].parts[0].text = Systemprompt
        const chat = model.startChat({
            history: messages,
            generationConfig: {
                maxOutputTokens: 4096
            }
        })
        const tokens = await displayChatTokens(model, chat, content)
        const { response } = await chat.sendMessage(content)
        const historyMessages = await chat.getHistory()
        console.log(tokens, historyMessages.length)
        if (tokens > 3800 && historyMessages.length > 6) historyMessages.splice(2, 6)
        await client.messagesMap.set(M.from, historyMessages)
        helper = ''
        const text = response.text().replace(new RegExp(`^${client.name}: `), '')
        if (voice === 'true') {
            const audio = await createSpeech(client, emojis(text))
            if (Buffer.isBuffer(audio)) {
                await M.status('recording')
                return void (await client.sendMessage(M.from, { audio }, { quoted: M }))
            }
        }
        await M.status('composing')
        return void (await M.reply(text || 'Well...'))
    } catch (error) {
        console.log(error.message)
        return void (await M.reply(
            error?.response?.data?.error?.message ?? 'An error occurred while processing the request.'
        ))
    }
}

const displayChatTokens = async (model, chat, text) => {
    const history = await chat.getHistory()
    const message = { role: 'user', parts: [{ text }] }
    const contents = [...history, message]
    const { totalTokens } = await model.countTokens({ contents })
    return totalTokens
}