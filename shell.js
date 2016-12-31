#!/usr/bin/env node

require('dotenv').config()

const moment = require('moment-range').extendMoment(require('moment-timezone'))
const async = require('async')
const lifebot = require('./lib/lifebot')

let dates = []

switch (process.argv.length) {
    case 3:
        let date = moment(process.argv[2], 'YYYY-MM-DD').tz(process.env.TIMEZONE)
        if (!date.isValid()) throw new Error(`invalid date ${process.argv[2]}`)
        dates.push(date)
        break

    case 4:
        let range = [
            moment(process.argv[2], 'YYYY-MM-DD').tz(process.env.TIMEZONE),
            moment(process.argv[3], 'YYYY-MM-DD').tz(process.env.TIMEZONE)
        ]
        if (!range[0].isValid()) throw new Error(`invalid date ${process.argv[2]}`)
        if (!range[1].isValid()) throw new Error(`invalid date ${process.argv[3]}`)
        if (range[1].isBefore(range[0])) {
            range.reverse()
        }
        dates = Array.from(moment.range(range[0], range[1]).by('day'))
        break

    default:
        dates.push(moment().tz(process.env.TIMEZONE))
}

async.eachSeries(dates, (date, done) => {
    console.log(`updating spreadsheet for ${date.format('YYYY-MM-DD')}`)
    lifebot.updateSpreadsheetWithLatestData(date, done)
}, error => {
    if (error) throw error
    console.log('update complete')
})
