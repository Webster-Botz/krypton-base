const axios = require('axios').default
const { tmpdir } = require('os')
const { promisify } = require('util')
const exec = promisify(require('child_process').exec)
const linkify = require('linkifyjs')
const FormData = require('form-data')
const PDFDocument = require('pdfkit')
const { uploadByBuffer } = require('telegraph-uploader')
const { load } = require('cheerio')
const { createCanvas } = require('canvas')
const { sizeFormatter } = require('human-readable')
const { createWriteStream, readFile, unlink, writeFile } = require('fs-extra')
const { removeBackgroundFromImageBase64 } = require('remove.bg')

/**
 * @param {string} url
 * @returns {Promise<Buffer>}
 */

const getBuffer = async (url) =>
    (
        await axios.get(url, {
            responseType: 'arraybuffer'
        })
    ).data

/**
 * @param {string} content
 * @param {boolean} all
 * @returns {string}
 */

const capitalize = (content, all = false) => {
    if (!all) return `${content.charAt(0).toUpperCase()}${content.slice(1)}`
    return `${content
        .split('')
        .map((text) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`)
        .join('')}`
}

/**
 * @param {Buffer} input
 * @returns {Promise<Buffer>}
 */

const removeBG = async (input) => {
    try {
        const response = await removeBackgroundFromImageBase64({
            base64img: input.toString('base64'),
            apiKey: process.env.BG_API_KEY,
            size: 'auto',
            type: 'auto'
        })
        return Buffer.from(response.base64img, 'base64')
    } catch (error) {
        throw error
    }
}

/**
 * Copyright by (AliAryanTech), give credit!
 * @param {string} cardName
 * @param {string} expiryDate
 * @returns {Promise<Buffer>}
 */

const generateCreditCardImage = (cardName, expiryDate) => {
    const canvas = createCanvas(800, 500)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, 800, 500)
    ctx.fillStyle = '#1e90ff'
    ctx.fillRect(0, 0, 800, 80)
    ctx.fillStyle = '#555'
    ctx.font = '24px Arial, sans-serif'
    ctx.fillText('Credit Card', 40, 150)
    ctx.fillStyle = '#000'
    ctx.font = '48px Arial, sans-serif'
    ctx.fillText('1234 5678 9012 3456', 40, 250) // card numbers
    ctx.fillStyle = '#555'
    ctx.font = '24px Arial, sans-serif'
    ctx.fillText('Card Name', 40, 350)
    ctx.fillStyle = '#000'
    ctx.font = '32px Arial, sans-serif'
    ctx.fillText(cardName, 40, 400)
    ctx.fillStyle = '#555'
    ctx.font = '24px Arial, sans-serif'
    ctx.fillText('Expiry Date', 450, 350)
    ctx.fillStyle = '#000'
    ctx.font = '32px Arial, sans-serif'
    ctx.fillText(expiryDate, 450, 400)
    return canvas.toBuffer()
}

/**
 * @returns {string}
 */

const generateRandomHex = () => `#${(~~(Math.random() * (1 << 24))).toString(16)}`

/**
 * @param {string} content
 * @returns {number[]}
 */

const extractNumbers = (content) => {
    const numbers = content.match(/(-?\d+)/g)
    return numbers ? numbers.map((n) => Math.max(parseInt(n), 0)) : []
}

/**
 * @param {string} content
 * @returns {url[]}
 */

const extractUrls = (content) => linkify.find(content).map((url) => url.value)

/**
 * @param {string} url
 */

const fetch = async (url) => (await axios.get(url)).data

/**
 * @param {Buffer} buffer
 * @returns {string} url
 */

const bufferToUrl = async (buffer) => (await uploadByBuffer(buffer)).link

/**
 * @param {Buffer} webp
 * @returns {Promise<Buffer>}
 */

const webpToPng = async (webp) => {
    const filename = `${tmpdir()}/${Math.random().toString(36)}`
    await writeFile(`${filename}.webp`, webp)
    await exec(`dwebp "${filename}.webp" -o "${filename}.png"`)
    const buffer = await readFile(`${filename}.png`)
    Promise.all([unlink(`${filename}.png`), unlink(`${filename}.webp`)])
    return buffer
}

const mp3ToOpus = async (mp3) => {
    const filename = `${tmpdir()}/${Math.random().toString(36)}`
    await writeFile(`${filename}.mp3`, mp3)
    await exec(`ffmpeg -i ${filename}.mp3 -c:a libopus ${filename}.opus`)
    const buffer = await readFile(`${filename}.opus`)
    Promise.all([unlink(`${filename}.mp3`), unlink(`${filename}.opus`)])
    return buffer
}

/**
 * @param {Buffer} webp
 * @returns {Promise<Buffer>}
 */

const webpToMp4 = async (webp) => {
    const responseFile = async (form, buffer = '') => {
        return axios.post(buffer ? `https://ezgif.com/webp-to-mp4/${buffer}` : 'https://ezgif.com/webp-to-mp4', form, {
            headers: {
                'Content-Type': `multipart/form-data; boundary=${form._boundary}`
            }
        })
    }
    return new Promise(async (resolve, reject) => {
        const form = new FormData()
        form.append('new-image-url', '')
        form.append('new-image', webp, { filename: 'blob' })
        responseFile(form)
            .then(({ data }) => {
                const datafrom = new FormData()
                const $ = load(data)
                const file = $('input[name="file"]').attr('value')
                datafrom.append('file', file)
                datafrom.append('convert', 'Convert WebP to MP4!')
                responseFile(datafrom, file)
                    .then(async ({ data }) => {
                        const $ = load(data)
                        const result = await getBuffer(
                            `https:${$('div#output > p.outfile > video > source').attr('src')}`
                        )
                        resolve(result)
                    })
                    .catch(reject)
            })
            .catch(reject)
    })
}

/**
 * @param {Buffer} gif
 * @param {boolean} write
 * @returns {Promise<Buffer | string>}
 */

const gifToMp4 = async (gif, write = false) => {
    const filename = `${tmpdir()}/${Math.random().toString(36)}`
    await writeFile(`${filename}.gif`, gif)
    await exec(
        `ffmpeg -f gif -i ${filename}.gif -movflags faststart -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" ${filename}.mp4`
    )
    if (write) return `${filename}.mp4`
    const buffer = await readFile(`${filename}.mp4`)
    Promise.all([unlink(`${filename}.gif`), unlink(`${filename}.mp4`)])
    return buffer
}

const getRandomItem = (array) => array[Math.floor(Math.random() * array.length)]

const calculatePing = (timestamp, now) => (now - timestamp) / 1000

const convertMs = (ms, to = 'seconds') => {
    const conversions = {
        days: 1000 * 60 * 60 * 24,
        hours: 1000 * 60 * 60,
        minutes: 1000 * 60,
        seconds: 1000
    }
    const result = Math.floor(ms / conversions[to])
    return result
}

const formatSize = sizeFormatter({
    std: 'JEDEC',
    decimalPlaces: '2',
    keepTrailingZeroes: false,
    render: (literal, symbol) => `${literal} ${symbol}B`
})

const term = (param) =>
    new Promise((resolve, reject) => {
        console.log('Run terminal =>', param)
        exec(param, (error, stdout, stderr) => {
            if (error) {
                console.log(error.message)
                resolve(error.message)
            }
            if (stderr) {
                console.log(stderr)
                resolve(stderr)
            }
            console.log(stdout)
            resolve(stdout)
        })
    })

const restart = () => {
    exec('pm2 start src/binx.js', (err, stdout, stderr) => {
        if (err) {
            console.log(err)
            return
        }
        console.log(`stdout: ${stdout}`)
        console.log(`stderr: ${stderr}`)
    })
}

const imagesToPDF = async (imageUrls) => {
    const pdf = new PDFDocument({ autoFirstPage: false })
    let filename = `${tmpdir()}/${Math.random().toString(36)}.pdf`
    const stream = createWriteStream(filename)
    pdf.pipe(stream)
    for (const image of imageUrls) {
        const data = typeof image === 'string' ? await getBuffer(image) : image
        const img = pdf.openImage(data)
        pdf.addPage({ size: [img.width, img.height] })
        pdf.image(img, 0, 0)
    }
    pdf.end()
    await new Promise((resolve, reject) => {
        stream.on('finish', () => resolve(filename))
        stream.on('error', reject)
    })
    const buffer = await readFile(filename)
    await unlink(filename)
    return buffer
}

const ocrImage = async (image) => {
    try {
        const form = new FormData()
        form.append('image', image, { filename: 'blob' })
        const res = (
            await axios.post(
                'https://oaucsc.treasureuvietobore.com/api/ocr-convert/98ccb3cd-09a8-4353-9edb-158dcc1f24d0',
                form
            )
        ).data
        if (res?.data?.text) {
            return `Text on Image: ${res.data.text}`
        } else if (res?.interpretation) {
            return `Image Interpretation: ${res.interpretation}`
        }
    } catch (err) {
        console.log(err.message)
        return { error: 'Failed' }
    }
}

module.exports = {
    calculatePing,
    imagesToPDF,
    capitalize,
    exec,
    ocrImage,
    extractNumbers,
    fetch,
    formatSize,
    convertMs,
    removeBG,
    extractUrls,
    bufferToUrl,
    generateCreditCardImage,
    generateRandomHex,
    getBuffer,
    getRandomItem,
    gifToMp4,
    restart,
    term,
    webpToMp4,
    webpToPng,
    mp3ToOpus
}
