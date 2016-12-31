require('dotenv').config()
const moment = require('moment-timezone')
const socket = require('socket.io-client')
const cron = require('cron')
const io = socket(process.env.MIDDLEMAN_URL)
const lifebot = require('./lib/lifebot')

io.on('connect', () => {
    console.log('connected')
})

io.on('sms', (data) => {
    lifebot.run({
        original: data.Body,
        source: 'sms',
        user: true,
    }, (error, result) => {
        if (error) {
            console.error(error)
        }
    })
})

io.on('disconnect', () => {
    console.log('disconncted')
})

let job = new cron.CronJob(process.env.CRON_TIME, () => {
    let date = moment().subtract(1, 'days')
    lifebot.updateSpreadsheetWithLatestData(date)
}, () => {
    // done
  },
  true,
  process.env.TIMEZONE
)
