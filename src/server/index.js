const express = require('express')
const http = require('http')
const socketio = require('socket.io')
const logger = require('morgan')('dev')
const path = require('path')

const public = path.join(process.cwd(), 'public')
const idx = path.join(public, 'index.html')

const app = express()
const server = http.createServer(app)
const io = socketio(server)

app.use(logger)
app.use(express.static(public))

app.get('*', (_, res) => res.sendFile(idx))

server.listen(process.env.PORT || 8080, () => {
    console.log('server listening')
})

const rooms = {}
io.on('connection', (socket) => {
    console.log(socket.id, 'connected')
    socket.on('create-room', (name) => {
        console.log('Creating room...')
        let roomID = createRoomID()
        while (roomID in rooms) {
            roomID = createRoomID() // avoid collisions
        }
        rooms[roomID] = createRoom(socket.id)
        rooms[roomID].participants.push({socket, name: `${name} (Owner)`})
        socket.emit('room-id', roomID)
        console.log('Created', roomID)
    })

    socket.on('join-room', (data) => {
        console.log('request to join', data.room, 'from', data.name)
        if (data.room in rooms) {
            const curRoom = rooms[data.room]
            curRoom.participants.push({socket, name: data.name})
            curRoom.participants.forEach(user => user.socket.emit('new-user', curRoom.participants.map(user => user.name)))
            socket.emit('joined')
            if (curRoom.started) {
                socket.emit('game-start')
                socket.emit('question', curRoom.questions[curRoom.questionIndex])
            }
        } else {
            socket.emit('not-found')
        }
    })

    socket.on('disconnect', () => {
        console.log(socket.id, 'disconnected')
        // cleanup rooms
        Object.entries(rooms).forEach(([id, room]) => {
            if (room.owner === socket.id) {
                console.log('cleaning up', id)
                // inform other participants
                room.participants.forEach(user => user.socket.emit('game-ended'))
            }
            // remove that socket from participants and re-emit
            const newParticipants = room.participants.filter(user => user.socket.id !== socket.id)
            if (newParticipants.length !== room.participants.length) { // there are differing participants
                delete newParticipants
                room.participants = newParticipants
                newParticipants.forEach(user => user.socket.emit('new-user', newParticipants.map(user => user.name)))
            }
        })
    })

    socket.on('start-game', (room) => {
        // check to see if socket is room.id
        if (rooms[room].owner !== socket.id) {
            console.log('unauthorized start')
            return
        }

        // let other sockets know we are starting
        rooms[room].participants.forEach(({socket}) => socket.emit('game-start'))
        rooms[room].started = true

        // send first question
        rooms[room].emitQuestion()

    })

    socket.on('next-round', (room) => {
        const curRoom = rooms[room]

        if (socket.id !== rooms[room].owner) return
        // might change to return the responses for each question
        const isComplete = curRoom.emitQuestion()

        if (!isComplete) return
    
        console.log('complete, emitting to all participants')
        curRoom.participants.forEach(({socket}) => {
            socket.emit('complete', curRoom.questions.map(question => ({
                title: question.title,
                green: question.green,
                red: question.red,
                responses: calculateResponses(question.responses)
            })))
        })
    })

    socket.on('response', ({room, colour}) => {
        console.log('recieved response', {colour, room})
        // in room, add response.
        const curRoom = rooms[room]
        
        const responses = curRoom.questions[curRoom.questionIndex].responses

        responses.push(colour)

        // if responses.length === participants.lengt (-1), send a new question
        // host will never answer. harder check required?
        if (responses.length === curRoom.participants.length - 1) {

            // have all responses, display round responses
            const curQuestion = curRoom.questions[curRoom.questionIndex]
            curRoom.participants.forEach(({socket}) => socket.emit('round-response', calculateResponses(curQuestion.responses)))
        }


    })
})

const createRoomID = () => Math.random().toString(36).substring(2,6).toUpperCase()

const calculateResponses = arr => arr.reduce((acc, cur) => {
    acc[cur] += 1
    return acc
}, {'red': 0, 'yellow': 0, 'green': 0})

function createRoom(socketID) {
    return {
        questionIndex: -1,
        started: false,
        owner: socketID,
        participants: [],
        emitQuestion() { // handle checking for participant answered in socket.on(response)
            this.questionIndex += 1
            if (this.questionIndex >= this.questions.length) return true// ? 'question' : 'complete'
            this.participants.forEach(({socket}) => {
                console.log('emitting to socket,', socket.id)
                socket.emit('question', this.questions[this.questionIndex])
            })
            return false
        },
        questions: [
            {
                title: "Delivering Value",
                green: "We deliver great stuff! We're proud of it and our stakeholders are really happy. ",
                red: "We deliver crap. We feel ashamed to deliver it. Our stakeholders hate us. ",
                responses: []
            },
            {
                title: "Easy to Release",
                green: "Releasing is simple, safe, painless and mostly automated. ",
                red: "Releasing is risky, painful, lots of manual work and takes forever. ",
                responses: []
            },
            {
                title: "Fun",
                green: "We love going to work and have great fun working together! ",
                red: "Boooooooring...",
                responses: []
            },
            {
                title: "Health of Codebase",
                green: "We're proud of the quality of our code! It is clean, easy to read and has great test coverage. ",
                red: "Our code is a pile of dung and technical debt is raging out of control. ",
                responses: []
            },
            {
                title: "Learning",
                green: "We're learning lots of interesting stuff all the time! ",
                red: "We never have time to learn anything. ",
                responses: []
            },
            {
                title: "Mission",
                green: "We know exactly why we are here and we’re really excited about it! ",
                red: "We have no idea why we are here, there's no high lever picture or focus. Our so called mission is completely unclear and uninspiring. ",
                responses: []
            },
            {
                title: "Pawns or Players",
                green: "We are in control of our own destiny! We decide what to build and how to build it. ",
                red: "We are just pawns in a game of chess with no influence over what we build or how we build it. ",
                responses: []
            },
            {
                title: "Speed",
                green: "We get stuff done really quickly! No waiting and no delays. ",
                red: "We never seem to get anything done. We keep getting stuck or interrupted. Stories keep getting stuck on dependencies. ",
                responses: []
            },
            {
                title: "Suitable Process",
                green: "Our way of working fits us perfectly!",
                red: "Our way of working sucks!",
                responses: []
            },
            {
                title: "Support",
                green: "We always get great support and help when we ask for it! ",
                red: "We keep getting stuck because we can't get the support and help that we ask for. ",
                responses: []
            },
            {
                title: "Teamwork",
                green: "We are a totally gelled super-team with awesome collaboration! ",
                red: "We are a bunch of individuals that neither know nor care about what the other people in the squad are doing. ",
                responses: []
            },
        ]
    }
}