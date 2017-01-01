const moment = require('moment-timezone')
const Spreadsheet = require('edit-google-spreadsheet')

exports.handler = (event, context, callback) => {
    let action = {
        original: event.Body
    }
    let todo = stack.slice(0)
    stack.push((action, done) => {
        callback(null, 'success')
    })
    doAction(action, todo)
}

let stack = [
    function(action, done) {
        loadSpreadsheet((data, spreadsheet) => {
            action.data = data.data
            action.labels = data.labels
            action.spreadsheet = spreadsheet
            done(action)
        })
    },
    function(action, done) {
        if (!/^💩/.test(action.original)) {
            return done(action)
        }
        action.columnName = ['Poop']
        return done(action)
    },
    function(action, done) {
        if (!action.columnName) {
            return done(action)
        }
        action.today = getToday(action.data)
        if (!action.today) {
            createToday(action.spreadsheet, _ => {
                // spreadsheet.receive((error, rows, info) => {
                //     if (error) throw error
                let data = parseRows(spreadsheet.rows)
                action.data = data.data
                action.labels = data.labels
                //     action.spreadsheet =
                // })
                action.today = getToday(action.data)
                console.log('added row for today')
                done(action)
            })
        } else {
            done(action)
        }
    },
    function(action, done) {
        if (!action.columnName) {
            return done(action)
        }
        let text
        if (action.today[action.columnName]) {
            text = action.today[action.columnName].split('\n')
        } else {
            text = []
        }
        let columnNumber = action.labels[action.columnName]
        text.push(moment().tz('America/New_York').format('HH:mm'))
        let todayRowNumber = action.data.indexOf(action.today) + 3
        let edit = {}
        edit[todayRowNumber] = {}
        console.log(text)
        edit[todayRowNumber][columnNumber] = [[`'${text.join('\n')}`]]
        console.log(edit)
        action.spreadsheet.add(edit)
        action.spreadsheet.send(error => {
            if (error) throw error
            let data = parseRows(action.spreadsheet.rows)
            action.data = data.data
            done(action)
        })
    }
]

function doAction(action, stack) {
    if (stack.length) {
        stack.shift()(action, (action) => {
            doAction(action, stack)
        })
    }
}

function loadSpreadsheet(done) {
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
    let emojis = rowsArray.shift()
    let columnNumbersToLabelsMap = rowsArray.shift()
    let labelToColumnNumbersMap = []
    for (let column in columnNumbersToLabelsMap) {
        let label = columnNumbersToLabelsMap[column]
        labelToColumnNumbersMap[label] = column
    }
    let data = rowsArray.map(row => {
        return convertIntegerColumnsToNamedColumns(columnNumbersToLabelsMap, row)
    })
    return {
        data,
        emojis,
        labels: labelToColumnNumbersMap
    }
}

function getToday(data) {
    let today = data.filter(row => {
        return row.Date === moment().tz('America/New_York').format('YYYY-MM-DD')
    })
    if (today.length) {
        return today[0]
    } else {
        return null
    }
}

function createToday(spreadsheet, done) {
    spreadsheet.metadata((error, metadata) => {
        if (error) throw error
        spreadsheet.metadata({
            rowCount: metadata.rowCount + 1
        }, (error, metadata) => {
            if (error) throw error
            let data = {}
            data[metadata.rowCount] = [[moment().tz('America/New_York').format('YYYY-MM-DD')]]
            spreadsheet.add(data)
            spreadsheet.send(error => {
                if (error) throw error
                done()
            })
        })
    })
}
