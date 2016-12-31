// Set this up on Gomix

const fitbitClientID = ''
const locationOfThisScript = 'http://myserver.example.com'

const querystring = require('querystring')
const express = require('express')
const bodyParser = require('body-parser')

const app = express()

app.use(bodyParser.urlencoded())

const server = app.listen(process.env.PORT)
const io = require('socket.io')(server)

app.post('/receive', (request, response) => {
  console.log('request received', request.body.Body)
  io.sockets.emit('sms', request.body)
  response.sendStatus(200)
})

app.get('/fitbit/auth', (request, response) => {
  let query = querystring.stringify({
    response_type: 'code',
    client_id: fitbitClientID,
    redirect_uri: `${locationOfThisScript}/fitbit/auth/callback`,
    scope: ['activity', 'heartrate', 'location', 'nutrition', 'profile', 'settings', 'sleep', 'social', 'weight'].join(' '),
    expires_in: 10 * 365 * 24 * 60 * 60
  })
  response.redirect(`https://www.fitbit.com/oauth2/authorize?${query}`)
})

app.get('/fitbit/auth/callback', (request, response) => {
  response.send(request.query.code)
})

io.on('connection', (socket) => {
  console.log('new connection')
})
