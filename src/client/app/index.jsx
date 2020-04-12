import {h, render} from 'preact'
import {useState, useEffect, useRef} from 'preact/hooks'
import {Router, route} from 'preact-router'

import io from 'socket.io-client'

// todo: Show question after response. give owner opportunity to proceed to next question


const App = () => {
    const [socket, setSocket] = useState(null)
    const [isOwner, setIsOwner] = useState(null)

    

    // name specifics ------------
    const [name, setName] = useState(null)
    const nameEntry = useRef(null)
    const setUsername = () => {
        const name = nameEntry.current.value
        setName(name)
        route('/set-room')
    }
    const keySetUsername = (ev) => {
        if (ev.key === 'Enter') setUsername()
    }
    // -----------------


    // room setting specifics -----
    const [room, setRoom] = useState(null)
    const [notFound, setNotFound] = useState(false)
    const roomEntry = useRef(null)
    //   owner bits
    const createRoom = () => {
        socket.emit('create-room', name)
        socket.on('room-id', (resp) => {
            setNotFound(false)
            setRoom(resp)
            setIsOwner(true)
            route('/game')
        })
    }
    //   participant bits
    const joinRoom = () => {
        const roomName = roomEntry.current.value.toUpperCase()
        socket.emit('join-room', {name, room: roomName})
        socket.on('joined', () => {
            setRoom(roomName)
            route('/game')
        })
    }

    const keyJoinRoom = (ev) => {
        if (ev.key === 'Enter') joinRoom()
    }
    // ------------------


    // game bits ---------
    const [isReady, setIsReady] = useState(false) // ready once we have all participants required
    const [waiting, setWaiting] = useState(true) // used to grey out buttons
    const [participants, setParticipants] = useState([]) // list of names
    const [curQuestion, setCurQuestion] = useState(null)

    const [showPrevRound, setShowPrevRound] = useState(true) // for pausing between rounds
    const [prevResponse, setPrevResponse] = useState([]) // previous round responses to shows

    const startGame = () => {
        socket.emit('start-game', room)
    }

    const goToNextRound = () => {
        socket.emit('next-round', room)
    }
    
    
    const sendColour = (colour) => () => {
        socket.emit('response', {room, colour})
        setWaiting(true)
    }
    // -------------------


    // response bits ---------
    const [responses, setResponses] = useState([])
    // -----------------------


    useEffect(() => {
        if (!name) route('/')
        const newSocket = io()
        setSocket(newSocket)

        newSocket.on('new-user', (data) => {
            setNotFound(false)
            setParticipants(data)
        })

        newSocket.on('not-found', () => {
            setNotFound(true)
        })

        newSocket.on('question', (question) => {
            setWaiting(false)
            setShowPrevRound(false)
            setCurQuestion(question)
        })

        newSocket.on('round-response', (responses) => {
            setShowPrevRound(true)
            setPrevResponse(responses)
        })

        newSocket.on('game-start', () => {
            setIsReady(true)
        })

        newSocket.on('game-ended', () => {
            route('/ended-disconnect')
        })

        newSocket.on('complete', (responses) => {
            route('/results')
            setResponses(responses)
        })
    }, [])


    return (
        <main>
            {name && <p>Welcome, {name}</p>}
            {room && <p>You are in room {room}</p>}
            {notFound && <p><strong>Game not found</strong></p>}
            <Router>
                <section path="/" className="name">
                    <label htmlFor="name-input" className="name-label">
                        Enter Name: 
                        <input key='name' onKeyUp={keySetUsername}ref={nameEntry} type="text" className="name-input"/>
                    </label>
                    <button onClick={setUsername}>Next</button>
                </section>


                <section path="/set-room" className="setroom">
                        <label htmlFor="setroom-input" className="setroom-label">
                            Enter a room code: 
                            <input ref={roomEntry} onKeyUp={keyJoinRoom} key='room' type="text" className="setroom-input"/>
                        </label>
                        <button onClick={joinRoom} className="setroom-btn">
                            Join room
                        </button>
                    <section className="startroom">
                        <p>Or, start your own room</p>
                        <button onClick={createRoom} className="startroom-start">Start Room</button>
                    </section>
                </section>


                <section path="/game">
                        <p>You are {isOwner || 'not'} the room owner. Participants:</p>
                        <div className="participants">
                            <ul className="participant-list">
                                {participants.map(participant => <li key={participant}>{participant}</li>)}
                            </ul>
                        </div>
                        <div className="isready">
                            {!isReady && <p>Waiting for game to begin</p>}
                            {(!isReady && isOwner) && <button onClick={startGame} className='isready-readier'>Ready-up</button>}
                        </div>
                    <section>
                        {isReady && (
                            <div>
                            {(curQuestion) && (
                            <div>
                                <div className="question">
                                    <h2>{curQuestion.title}</h2>
                                </div>
                                <div className="title-descriptions">
                                    <h3>Green:</h3>
                                    <p>{curQuestion.green}</p>
                                    <h3>Red:</h3>
                                    <p>{curQuestion.red}</p>
                                </div>
                            </div>
                        )}

                        {(showPrevRound && (
                            <div className="previousresponse">
                                <h3>Previous Round</h3>
                                {JSON.stringify(prevResponse)}
                            </div>
                        ))}

                        {isOwner && showPrevRound && (
                            <div className="nextround">
                                <button onClick={goToNextRound}>Next Round</button>
                            </div>
                        )}
                       
                        {(!isOwner) && (
                            <div className="responsePanel">
                                <button disabled={waiting} onClick={sendColour('red')}>Red</button>
                                <button disabled={waiting} onClick={sendColour('yellow')}>Yellow</button>
                                <button disabled={waiting} onClick={sendColour('green')}>Green</button>
                            </div>
                        )}
                        </div>
                        )}       
                    </section>
                </section>



                <section path="/results" className="results">
                    <h2>Results</h2>
                    <ul className="results-list">
                        {responses && responses.map((response) => 
                            <li className="results-list__result" key={response}>
                                <h3>{response.title}</h3>
                                <h4>Green: {response.green}</h4>
                                <h4>Red: {response.red}</h4>
                                <p><strong>Red: </strong>{response.responses.red}</p>
                                <p><strong>Yellow: </strong>{response.responses.yellow}</p>
                                <p><strong>Green: </strong>{response.responses.green}</p>
                            </li>
                        )}
                    </ul>
                </section>

                <section path="ended-disconnect" className="ended-early">
                    <h1>Game over</h1>
                    <h2>The host disconnected early</h2>
                </section>
            </Router>
        </main>
    )
}

const entry = document.getElementById('preact')

render(<App />, entry)