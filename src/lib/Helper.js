const axios = require('axios').default
const FormData = require('form-data')
const googleTTS = require('google-tts-api')
const { search, summary } = require('wikipedia')

const HelperPrompt = `Analyse the up coming message and use the following format: you need to extract it and return something 
e.g
To obtain information on a variety of topics such as league tables, live football scores, real-time sports updates, currency exchange rates, notable individuals, royalty, political figures, obituaries, or the latest news events,
Example question: Who is currently leading the Premier League?
return { "google": "current Premier League leader" }

To Get current time & date info of (Country/City),
Q: Can you tell current time of Pakistan?
Note: it'll take country/city
return { "time": "Pakistan" }

To reply in text or disable voicemode or stop talking or want to exist voicemode or write ...,
Q: reply me in text or exist voicemode or help me write something 
return { "voice": "false" }

if the user requests to write something or type, 
return { "voice": "false" },

To reply in voicenote 
Q: reply using voicenote or use voice to reply me or reply in voice or talk / speak to me
return { "voice": "true" }

To Get information related to weather,
Q: Can you tell info about today weather in lagos?
Note: it'll take country/city
return { "weather": "Lahore" }

To Get movie, song, album, artist, or music information,
Example Question: Do you know the movie "Hidden Strike" released in 2023 or who sang the song "Ask about me"?
Return: { "google": "Hidden Strike movie | Ask about me artist" }

For normal discussion topics related to chatting:
Incase, it's a simple message like: "hi", "dm" or anything else
return { "normal": null }`

const toSpeech = (text) =>
    googleTTS
        .getAllAudioBase64(text, {
            lang: 'en',
            slow: false,
            host: 'https://translate.google.com',
            timeout: 10000,
            splitPunct: ',.?'
        })
        .then((results) => {
            const buffers = results.map(({ base64 }) => Buffer.from(base64, 'base64'))
            return buffers
        })
        .catch((error) => {
            console.error(error.message)
            return []
        })

const fetch = async (url) => (await axios.get(url)).data

const transcribe = async (buffer, client) => {
    const from = new FormData()
    from.append('file', buffer, {
        filename: 'audio.mp3',
        contentType: 'audio/mp3'
    })
    from.append('model', 'whisper-1')
    const headers = {
        Authorization: `Bearer ${client.chatgpt_apiKey}`,
        ...from.getHeaders()
    }
    try {
        const {
            data: { text }
        } = await axios.post('https://api.openai.com/v1/audio/transcriptions', from, { headers })
        return text
    } catch (error) {
        console.log(error.message)
        return 'Oops! Unfortunately, something did not go as expected.'
    }
}

const wikipedia = async (query) => {
    const { results } = await search(query)
    if (!results.length) return 'Cannot find related Info.'
    const result = await summary(results[0].title)
    const { title, description, content_urls, extract } = result
    const text = `Title: ${title}, Description: ${description}, URL: ${content_urls.desktop.page}, Summary Info: ${extract}`
    return text
}

const google = async (query) => {
    const results = await fetch(`https://weeb-api.vercel.app/google?query=${query}`)
    let text = ''
    for (let i = 0; i < Math.min(results.length, 10); i++) {
        const { link, snippet, title } = results[i]
        text += `Title: ${title}, Snippet: ${snippet}, Link: ${link}\n`
    }
    return text
}

const countryTime = async (query) => {
    const result = await fetch(`https://weeb-api.vercel.app/timeinfo?query=${query}&key=Baka`)
    if (result.error) return `Couldn't find Country/City as ${query}`
    const text = `Location: ${query} \nCurrent Time: ${result.currentTime}, Current Date: ${result.currentDate}\n`
    return text
}

const weather = async (query) => {
    try {
        const results = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?q=${query}&units=metric&appid=e409825a497a0c894d2dd975542234b0&language=tr`
        )
        if (results.message) return `Couldn't find Country/City as ${query}`
        const { sys, name, main, wind, clouds } = results
        const sunrise = new Date(sys.sunrise * 1000).toLocaleTimeString()
        const sunset = new Date(sys.sunset * 1000).toLocaleTimeString()
        const weatherDescription = results.weather[0].description
        const text = `
Country: ${sys.country}, Location: ${name}
Temperature: ${main.temp}°C, Feels Like: ${main.feels_like}°C
Min Temperature: ${main.temp_min}°C, Max Temperature: ${main.temp_max}°C
Pressure: ${main.pressure} hPa, Humidity: ${main.humidity}%
Wind Speed: ${wind.speed} km/h, Clouds: ${clouds.all}%
Sunrise: ${sunrise}, Sunset: ${sunset}
Weather Description: ${weatherDescription}
`
        return text
    } catch (error) {
        console.error(error.message)
        return 'Unable To Find Country/City'
    }
}

module.exports = {
    HelperPrompt,
    toSpeech,
    fetch,
    transcribe,
    wikipedia,
    google,
    countryTime,
    weather
}
