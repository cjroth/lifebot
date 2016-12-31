// Live at https://gomix.com/#!/project/happy-dolphin

const express = require('express')
const bodyParser = require('body-parser')

const app = express()

app.use(bodyParser.urlencoded())

const server = app.listen(process.env.PORT)
// var server = require('http').Server(app)
const io = require('socket.io')(server)

app.post('/receive', (request, response) => {
  console.log('request received', request.body.Body)
  io.sockets.emit('sms', request.body)
  response.sendStatus(200)
})

io.on('connection', (socket) => {
  console.log('new connection')
})
