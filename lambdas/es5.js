const moment = require('moment-timezone')
const Spreadsheet = require('edit-google-spreadsheet')

exports.handler = function(event, context, callback) {
    var action = {
        original: event.Body
    }
    var todo = stack.slice(0)
    stack.push(function(action, done) {
        callback(null, 'success')
    })
    doAction(action, todo)
}

var stack = [
    function(action, done) {
        loadSpreadsheet(function(data, spreadsheet) {
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
            createToday(action.spreadsheet, function() {
                // spreadsheet.receive((error, rows, info) => {
                //     if (error) throw error
                var data = parseRows(action.spreadsheet.rows)
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
        var text
        if (action.today[action.columnName]) {
            text = action.today[action.columnName].split('\n')
        } else {
            text = []
        }
        var columnNumber = action.labels[action.columnName]
        text.push(moment().tz('America/New_York').format('HH:mm'))
        var todayRowNumber = action.data.indexOf(action.today) + 3
        var edit = {}
        edit[todayRowNumber] = {}
        console.log(text)
        edit[todayRowNumber][columnNumber] = [['\'' + text.join('\n')]]
        console.log(edit)
        action.spreadsheet.add(edit)
        action.spreadsheet.send(function(error) {
            if (error) throw error
            var data = parseRows(action.spreadsheet.rows)
            action.data = data.data
            done(action)
        })
    }
]

function doAction(action, stack) {
    if (stack.length) {
        stack.shift()(action, function(action) {
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
    }, function(error, spreadsheet) {

        if (error) throw error

        spreadsheet.receive(function(error, rows, info) {
            if (error) throw err
            var data = parseRows(rows)
            done(data, spreadsheet)
        })

    })
}

function convertRowsToArray(rows) {
    var array = []
    for (var key in rows) {
        var row = rows[key]
        array.push(row)
    }
    return array
}

function convertIntegerColumnsToNamedColumns(labels, row) {
    var rowWithNamedColumns = {}
    for (var key in row) {
        var column = row[key]
        rowWithNamedColumns[labels[key]] = column
    }
    return rowWithNamedColumns
}

function parseRows(rows) {
    var rowsArray = convertRowsToArray(rows)
    var emojis = rowsArray.shift()
    var columnNumbersToLabelsMap = rowsArray.shift()
    var labelToColumnNumbersMap = []
    for (var column in columnNumbersToLabelsMap) {
        var label = columnNumbersToLabelsMap[column]
        labelToColumnNumbersMap[label] = column
    }
    var data = rowsArray.map(function(row) {
        return convertIntegerColumnsToNamedColumns(columnNumbersToLabelsMap, row)
    })
    return {
        data,
        emojis,
        labels: labelToColumnNumbersMap
    }
}

function getToday(data) {
    var today = data.filter(function(row) {
        return row.Date === moment().tz('America/New_York').format('YYYY-MM-DD')
    })
    if (today.length) {
        return today[0]
    } else {
        return null
    }
}

function createToday(spreadsheet, done) {
    spreadsheet.metadata(function(error, metadata) {
        if (error) throw error
        spreadsheet.metadata({
            rowCount: metadata.rowCount + 1
        }, function(error, metadata) {
            if (error) throw error
            var data = {}
            data[metadata.rowCount] = [[moment().tz('America/New_York').format('YYYY-MM-DD')]]
            spreadsheet.add(data)
            spreadsheet.send(function(error) {
                if (error) throw error
                done()
            })
        })
    })
}
