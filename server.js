const moment = require('moment')
const socket = require('socket.io-client')
const Spreadsheet = require('edit-google-spreadsheet')

const io = socket('https://happy-dolphin.gomix.me')

const emojiMap = {
    '💩': 'poop',
    '💑': 'sex',
    '🚿': 'shower',
    '😴': 'asleep',
    '🌞': 'awake',
    '🍷': 'wine',
    '🥃': 'cocktail',
    '🍺': 'beer'
}

io.on('connect', () => {
    console.log('connected')
})

io.on('sms', (data) => {
    console.log('event', data)
    let action = {
        original: data.Body
    }
    let text = action.original
    for (let emoji in emojiMap) {
        let word = emojiMap[emoji]
        text = text.replace(new RegExp(`^${emoji}`), word)
    }
    action.text = text
    console.log(action)
})

io.on('disconnect', () => {
    console.log('disconncted')
})

Spreadsheet.load({
    debug: true,
    spreadsheetId: '1jaiPDuvwC91XTF-99wyqjsK8nwRO5E43rvfj9XlkXC0',
    worksheetId: 'od6',
    'oauth2': {
        'client_id': '370437036455-34msu4mrfd8j0skah6gnlep6b5b7einl.apps.googleusercontent.com',
        'client_secret': 'St1buqKN-d05PUTlK2ZUDbTQ',
        'refresh_token': '1/p-KoavdcCgwXkjlJZ84vDmmJQcIi3JRL1awfZmzduHg'
    }
}, (error, spreadsheet) => {

    if (error) throw error

    spreadsheet.metadata((error, metadata) => {
        if (error) throw error
        console.log(`connected to spreadsheet: ${metadata.rowCount} rows, ${metadata.colCount} columns, last updated: ${metadata.updated}`)
    })

    spreadsheet.receive((error, rows, info) => {
        if (error) throw err
        let data = formatRows(rows)
        let today = getToday(data)
        console.log(today)
    })

})

function convertRowsToArray(rows) {
    let array = []
    for (let key in rows) {
        let row = rows[key]
        array.push(row)
    }
    return array
}

function convertIntegerColumnsToNamedColumns(legend, row) {
    let rowWithNamedColumns = {}
    for (let key in row) {
        let column = row[key]
        rowWithNamedColumns[legend[key]] = column
    }
    return rowWithNamedColumns
}

function formatRows(rows) {
    let rowsArray = convertRowsToArray(rows)
    let legend = rowsArray.shift()
    let data = rowsArray.map(row => {
        return convertIntegerColumnsToNamedColumns(legend, row)
    })
    return data
}

function getToday(data) {
    let today = data.filter(row => {
        return row.Date === moment().format('YYYY-MM-DD')
    })
    if (today.length) {
        return today[0]
    } else {
        return null
    }
}
