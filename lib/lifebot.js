const fs = require('fs')
const https = require('https')
const moment = require('moment')
const async = require('async')
const Spreadsheet = require('edit-google-spreadsheet')
const regenerate = require('regenerate')

const numberOfHeaderRows = 3
const emojiMap = JSON.parse(fs.readFileSync('emoji-map.json'))
const fitbitAuthData = JSON.parse(fs.readFileSync('store/fitbit.json'))

const flow = [
    function(action, done) {
        loadSpreadsheet((data, spreadsheet) => {
            action.entry = action.original
            action.data = data.data
            action.labels = data.labels
            action.spreadsheet = spreadsheet
            return done(null, action)
        })
    },
    function parseEmoji(action, done) {
        for (let emoji in emojiMap) {
            let actionTemplate = emojiMap[emoji]
            let regex = new RegExp(`^${regenerate(emoji).toString()}`)
            if (regex.test(action.original)) {
                action.emoji = emoji
                action.entry = action.entry.replace(regex, '').trim()
                Object.assign(action, actionTemplate)
                return done(null, action)
            }
        }
    },
    function parseTime(action, done) {
        if (!action.time) {
            action.time = moment().tz(process.env.TIMEZONE)
        }
        let time = action.original.match(/(\d{1,2}):([0-5][0-9])/)
        if (time && time.length === 3) {
            let match = time[0]
            let hour = time[1]
            let minute = time[2]
            action.time.hour(hour).minute(minute)
            action.entry = action.entry.replace(match, '').trim()
        }
        return done(null, action)
    },
    function asleepTimeEdgeCase(action, done) {
        if (action.columnName === 'Asleep' && action.time.hour() >= 18) {
            action.time.add(1, 'days')
        }
        return done(null, action)
    },
    function createRowForTodayIfItDoesNotExist(action, done) {
        if (!action.columnName) {
            return done(null, action)
        }
        action.row = getRowForAction(action)
        if (!action.row) {
            createToday(action, _ => {
                action.spreadsheet.receive((error, rows, info) => {
                    if (error) throw error
                    let data = parseRows(rows)
                    action.data = data.data
                    action.labels = data.labels
                    action.row = getRowForAction(action)
                    done(null, action)
                })
            })
        } else {
            done(null, action)
        }
    },
    function editSpreadsheet(action, done) {
        if (!action.columnName) {
            return done(null, action)
        }
        let text
        if (action.row[action.columnName]) {
            if (action.mode === 'single') {
                text = []
            } else {
                text = action.row[action.columnName].split('\n')
            }
        } else {
            text = []
        }
        let columnNumber = action.labels[action.columnName]
        let entry = []
        if (action.recordTime !== 'no') {
            entry.push(action.time.format('HH:mm'))
        }
        if (action.entry) {
            entry.push(action.entry)
        }
        text.push(entry.join(' '))
        let todayRowNumber = action.data.indexOf(action.row) + numberOfHeaderRows + 1
        let edit = {}
        edit[todayRowNumber] = {}
        edit[todayRowNumber][columnNumber] = [[`'${text.join('\n')}`]]
        action.spreadsheet.add(edit)
        done(null, action)
    },
    function sendUpdatesToSpreadsheet(action, done) {
        action.spreadsheet.send(error => {
            if (error) throw error
            done(null, action)
        })
    }
]



function loadSpreadsheet(done) {
    Spreadsheet.load({
        debug: true,
        spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
        worksheetId: process.env.GOOGLE_WORKSHEET_ID,
        'oauth2': {
            'client_id': process.env.GOOGLE_CLIENT_ID,
            'client_secret': process.env.GOOGLE_CLIENT_SECRET,
            'refresh_token': process.env.GOOGLE_REFRESH_TOKEN
        }
    }, (error, spreadsheet) => {

        if (error) throw error

        spreadsheet.metadata((error, metadata) => {
            if (error) throw error
            console.log(`connected to spreadsheet: ${metadata.rowCount} rows, ${metadata.colCount} columns, last updated: ${metadata.updated}`)
        })

        spreadsheet.receive((error, rows, info) => {
            if (error) throw err
            let data = parseRows(rows)
            done(data, spreadsheet)
        })

    })
}

function convertRowsToArray(rows) {
    let array = []
    for (let key in rows) {
        let row = rows[key]
        array.push(row)
    }
    return array
}

function convertIntegerColumnsToNamedColumns(labels, row) {
    let rowWithNamedColumns = {}
    for (let key in row) {
        let column = row[key]
        rowWithNamedColumns[labels[key]] = column
    }
    return rowWithNamedColumns
}

function parseRows(rows) {
    let rowsArray = convertRowsToArray(rows)
    let headerArray = rowsArray.slice(0, numberOfHeaderRows)
    let daysArray = rowsArray.slice(numberOfHeaderRows)
    let emojis = headerArray.shift()
    let columnNumbersToLabelsMap = headerArray.shift()
    let columnKeys = headerArray.shift()
    let labelToColumnNumbersMap = []
    for (let column in columnNumbersToLabelsMap) {
        let label = columnNumbersToLabelsMap[column]
        labelToColumnNumbersMap[label] = column
    }
    let data = daysArray.map(row => {
        return convertIntegerColumnsToNamedColumns(columnNumbersToLabelsMap, row)
    })
    return {
        data,
        emojis,
        labels: labelToColumnNumbersMap
    }
}

function getRowForAction(action) {
    let today = action.data.filter(row => {
        return row.Date === action.time.tz(process.env.TIMEZONE).format('YYYY-MM-DD')
    })
    if (today.length) {
        return today[0]
    } else {
        return null
    }
}

function createToday(action, done) {
    action.spreadsheet.metadata((error, metadata) => {
        if (error) throw error
        action.spreadsheet.metadata({
            rowCount: metadata.rowCount + 1
        }, (error, metadata) => {
            if (error) throw error
            let data = {}
            data[metadata.rowCount] = [[action.time.tz(process.env.TIMEZONE).format('YYYY-MM-DD')]]
            action.spreadsheet.add(data)
            action.spreadsheet.send(error => {
                done(error)
            })
        })
    })
}

function run(actions, done) {
    if (!actions.length) {
        actions = [actions]
    }
    async.each(actions, (action, done) => {
        async.waterfall([
            async.constant(action),
            ...flow
        ], (error, result) => {
            done(error)
        })
    }, done)
}

function getFitbitActivityData(date, done) {
    let yyyymmdd = date.tz(process.env.TIMEZONE).format('YYYY-MM-DD')
    let options = {
        host: 'api.fitbit.com',
        path: `/1/user/-/activities/date/${yyyymmdd}.json`,
        headers: {
          'Authorization': `Bearer ${fitbitAuthData.access_token}`,
        }
    }
    https.get(options, (response) => {
        let body = ''
        response.on('data', (partial) => {
            body += partial.toString()
        })
        response.on('end', () => {
            let data = JSON.parse(body)
            if (data.errors) {
                return done(data.errors)
            }
            return done(null, data)
        })
    })
}

function getFitbitSleepData(date, done) {
    let yyyymmdd = date.tz(process.env.TIMEZONE).format('YYYY-MM-DD')
    let options = {
        host: 'api.fitbit.com',
        path: `/1/user/-/sleep/date/${yyyymmdd}.json`,
        headers: {
          'Authorization': `Bearer ${fitbitAuthData.access_token}`,
        }
    }
    https.get(options, (response) => {
        let body = ''
        response.on('data', (partial) => {
            body += partial.toString()
        })
        response.on('end', () => {
            let data = JSON.parse(body)
            if (data.errors) {
                return done(data.errors)
            }
            return done(null, data)
        })
    })
}

function getMainSleep(data) {
    for (let i in data.sleep) {
        let sleep = data.sleep[i]
        if (sleep.isMainSleep) {
            return sleep
        }
    }
}

function updateDayFromFitbitData(data, done) {
    let steps = data.activity.summary.steps
    let restingHeartRate = data.activity.summary.restingHeartRate
    let sleep = getMainSleep(data.sleep)
    let actions = [
        {
            original: `🚶${steps}`,
            source: 'fitbit',
            user: false,
            time: data.date
        },
        {
            original: `❤️${restingHeartRate}`,
            source: 'fitbit',
            user: false,
            time: data.date
        }
    ]
    if (sleep) {
        let asleep = moment(sleep.startTime, moment.ISO_8601)
        let awake = asleep.clone().add(sleep.duration / 1000 / 60, 'minutes')
        let minutes = sleep.duration / 1000 / 60 % 60
        let hours = Math.floor(sleep.duration / 1000 / 60 / 60)
        let duration = moment().tz(process.env.TIMEZONE).hour(hours).minute(minutes)
        actions.push(
            {
                original: `😴${asleep.format('HH:mm')}`,
                source: 'fitbit',
                user: false,
                time: data.date
            },
            {
                original: `🌞${awake.format('HH:mm')}`,
                source: 'fitbit',
                user: false,
                time: data.date
            },
            {
                original: `💤${duration.format('HH:mm')}`,
                source: 'fitbit',
                user: false,
                time: data.date
            }
        )
    }
    run(actions, done)
}

function getFitbitAuthToken(done) {
    let authorization = Buffer.from(`${process.env.FITBIT_CLIENT_ID}:${process.env.FITBIT_CLIENT_SECRET}`).toString('base64')
    const querystring = require('querystring')
    let body = querystring.stringify({
        clientId: process.env.FITBIT_CLIENT_ID,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.MIDDLEMAN_URL}/fitbit/auth/callback`,
        expires_in: 365 * 24 * 60 * 60,
        code: process.env.FITBIT_AUTH_CODE
    })
    let options = {
        host: 'api.fitbit.com',
        path: `/oauth2/token`,
        method: 'POST',
        headers: {
            'Authorization': `Basic ${authorization}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': body.length
        }
    }
    let request = https.request(options, (response) => {
        let body = ''
        response.on('data', (partial) => {
            body += partial.toString()
        })
        response.on('error', console.error)
        response.on('end', () => {
            let data = JSON.parse(body)
            if (response.statusCode !== 200) {
                return done(new Error('problem authorizing with fitbit'))
            }
            fs.writeFileSync('store/fitbit.json', JSON.stringify(data))
            return done(null, data)
        })
    })
    request.on('error', done)
    request.write(body)
    request.end()
}

function updateSpreadsheetWithLatestData(date = moment(), done = () => {}) {
    async.series({
        activity: done => {
            getFitbitActivityData(date, done)
        },
        sleep: done => {
            getFitbitSleepData(date, done)
        }
    }, (error, result) => {
        if (error) {
            return done(error)
        }
        result.date = date
        updateDayFromFitbitData(result, done)
    })
}

module.exports = { run, updateSpreadsheetWithLatestData }
