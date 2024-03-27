const messagesType = {
    stickerMessage: [
        'Thanks for the sticker! 🤩',
        "That's a cool sticker! 😎",
        'Nice sticker choice! 👍',
        'Awesome sticker! 🌟',
        'Cool sticker, where did you get it? 😊',
        'Lovely sticker! ❤️',
        'Fantastic sticker choice! 👏',
        'Great sticker, it made my day! 😃',
        'Stickers like these brighten up the conversation! 🌈',
        'You have a knack for picking awesome stickers! 🚀'
    ],
    videoMessage: [
        'Awesome video! 🎥',
        'Amazing video content! 🌟',
        'Impressive video, keep it up! 👏',
        'Great video, really enjoyed it! 😊',
        'Fantastic video! 👍',
        'Cool video, where did you find it? 🤔',
        'The video you shared is top-notch! 👌',
        'Incredible video, thanks for sharing! 🚀',
        'Your video skills are on point! 🔥',
        "I'm always excited to see the videos you share! 🤩"
    ],
    imageMessage: [
        'Lovely image! 📷',
        'Beautiful image you shared! 🌈',
        'Fantastic photo! 👌',
        'Great shot! 📸',
        'Incredible image, it caught my eye! 😍',
        'You have a talent for capturing stunning moments! 🌟',
        'The image you shared is a work of art! 🎨',
        'Impressive photography skills! 👏',
        'Thanks for sharing such a beautiful image! 😊',
        'Your images always bring a smile to my face! 😄'
    ],
    documentMessage: [
        'Great document! 📄',
        'Thanks for the document! 📝',
        'Excellent content in the document! 👍',
        'Very informative document! 🤓',
        'I appreciate the effort you put into this document! 🙌',
        'The document you shared is quite insightful! 💡',
        'Well-organized and useful document! 📊',
        'Thanks for providing such a helpful document! 🌐',
        'Your document is a valuable resource, thank you! 📚',
        'I learned a lot from the document you shared! 🧠'
    ]
}

const Keys = Object.keys(messagesType)

const complement = (Type) => {
    const messages = messagesType[Type]
    return messages[Math.floor(Math.random() * messages.length)]
}

module.exports = {
    messagesType,
    Keys,
    complement
}
