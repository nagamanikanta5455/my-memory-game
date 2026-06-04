const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

const rooms = new Map();

// --- THEME ASSETS ---
const THEMES = {
  cosmic: [
    '👽', '🚀', '🛸', '🛰️', '🌌', '🌑', '🌕', '☀️', '⭐', '🪐', '👨‍🚀', '🔭', 
    '🌠', '👾', '🌍', '💫', '☄️', '✨', '🤖', '🌙', '🌞', '🧑‍🔬', '🪨', '🧊'
  ],
  mythical: [
    '🦄', '🐉', '🧜‍♀️', '🧚', '🧞‍♂️', '🧝‍♀️', '🧛‍♂️', '🧟', '🧌', '👹', '👺', '👻', 
    '👼', '👿', '🦇', '🐺', '🦉', '🕷️', '🏰', '🗡️', '👑', '🦖', '🐍', '🐴'
  ],
  arcane: [
    '🔮', '🪄', '🧿', '💠', '⚡', '🔥', '💧', '🌪️', '🌀', '🔱', '👁️', '📜', 
    '🗝️', '🕯️', '⚔️', '🛡️', '⏳', '🧪', '🩸', '💍', '🪬', '📿', '🏺', '⚖️'
  ],
  fruits: [
    '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', 
    '🥭', '🍍', '🥥', '🥝', '🍅', '🥑', '🍏', '🌽', '🌶️', '🍄', '🥜', '🌰'
  ],
  animals: [
    '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', 
    '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇'
  ]
};

// --- DECK GENERATOR ---
function generateDeck(themeKey, totalCards) {
  const selectedTheme = THEMES[themeKey] || THEMES.cosmic; 
  const pairsNeeded = totalCards / 2;

  // 1. Grab enough unique emojis for this specific board size
  const baseCards = selectedTheme.slice(0, pairsNeeded);

  // 2. Duplicate them to make the pairs
  const deck = [...baseCards, ...baseCards];

  // 3. Fisher-Yates Shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

io.on('connection', (socket) => {
  
  // 1. DEDICATED CREATE ROOM EVENT
  // 1. DEDICATED CREATE ROOM EVENT
  socket.on('createRoom', ({ roomCode, settings, playerName }) => {
    if (!rooms.has(roomCode)) {
      socket.join(roomCode);
      const deck = generateDeck(settings.theme, settings.size);
      
      rooms.set(roomCode, {
        players: [socket.id],
        // THE FIX: Store custom name or default
        playerNames: { [socket.id]: playerName.trim() || 'Player 1' }, 
        scores: { [socket.id]: 0 },
        deck: deck,
        flipped: [],
        matched: [],
        turn: socket.id,
        settings: settings,
        phase: 'PEEK',
        hasStarted: false
      });
      socket.emit('roomCreated', roomCode);
    }
  });

  // 2. DEDICATED JOIN ROOM EVENT
  socket.on('joinRoom', ({ roomCode, playerName }) => {
    const room = io.sockets.adapter.rooms.get(roomCode);
    const numClients = room ? room.size : 0;
    const state = rooms.get(roomCode);

    if (!state) {
      socket.emit('joinError', 'Invalid Room Code. Please check and try again.');
      return;
    } 

    // Reconnection handling: if the room is fully set up, but has disconnected players
    if (state.players.length === 2 && numClients < 2) {
      let disconnectedPlayerId = null;

      if (numClients === 1) {
        // Find the player who is still connected
        const connectedPlayerId = Array.from(room)[0];
        disconnectedPlayerId = state.players.find(id => id !== connectedPlayerId);
      } else if (numClients === 0) {
        // Find by name matching if both disconnected
        const cleanName = playerName?.trim().toLowerCase();
        disconnectedPlayerId = state.players.find(id => 
          state.playerNames[id]?.trim().toLowerCase() === cleanName
        ) || state.players[0]; // fallback to first slot if name didn't match
      }

      if (disconnectedPlayerId) {
        // Clear disconnect timer if any
        if (state.disconnectTimers && state.disconnectTimers[disconnectedPlayerId]) {
          clearTimeout(state.disconnectTimers[disconnectedPlayerId]);
          delete state.disconnectTimers[disconnectedPlayerId];
        }

        // Swap the socket ID in players, playerNames, and scores
        state.players = state.players.map(id => id === disconnectedPlayerId ? socket.id : id);
        
        state.playerNames[socket.id] = state.playerNames[disconnectedPlayerId];
        delete state.playerNames[disconnectedPlayerId];
        
        state.scores[socket.id] = state.scores[disconnectedPlayerId];
        delete state.scores[disconnectedPlayerId];

        if (state.turn === disconnectedPlayerId) {
          state.turn = socket.id;
        }

        socket.join(roomCode);

        // Notify client about re-joining the ongoing game
        socket.emit('gameStart', {
          roomCode: roomCode,
          turn: state.turn,
          players: state.players,
          playerNames: state.playerNames,
          scores: state.scores,
          settings: state.settings,
          deck: state.deck,
          phase: state.phase
        });

        // Notify opponent that player has reconnected (if opponent is online)
        socket.to(roomCode).emit('playerReconnected');
        socket.to(roomCode).emit('opponent_rejoined', socket.id);
        return;
      }
    }
    
    if (numClients === 1) {
      socket.join(roomCode);
      state.players.push(socket.id);
      state.scores[socket.id] = 0; 
      // THE FIX: Store joiner's custom name or default
      state.playerNames[socket.id] = playerName?.trim() || 'Player 2';
      
      // THE FIX: Check if the game has already started (should be false for fresh matches)
      if (state.hasStarted) {
        // This is a RECONNECT. Do NOT start a new game. 
        socket.to(roomCode).emit('opponent_rejoined', socket.id);
      } else {
        state.hasStarted = true; // Lock the room

        io.to(roomCode).emit('gameStart', {
          roomCode: roomCode,
          turn: state.turn,
          players: state.players,
          playerNames: state.playerNames, // Pass names to frontend
          scores: state.scores,
          settings: state.settings,
          deck: state.deck,
          phase: 'PEEK'
        });

        // 2. THE FIX: Dynamic memorize phase duration based on room/deck size
        const peekDuration = state.settings.size <= 16 ? 3000 : state.settings.size <= 30 ? 4000 : 5000;
        setTimeout(() => {
          io.to(roomCode).emit('startShuffle');
          
          // 3. Wait 1.5s for the shuffle animation, then DEAL and PLAY
          setTimeout(() => {
            if (rooms.has(roomCode)) {
              rooms.get(roomCode).phase = 'PLAY';
              io.to(roomCode).emit('endShuffleAndPlay');
            }
          }, 1500); 

        }, peekDuration);
      }
    } else {
      socket.emit('joinError', 'This room is already full!');
    }
  });

  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    
    // THE FIX: Announce to the survivor that the ghost has returned
    // We send the new socket.id so the survivor knows exactly who to send the data to
    socket.to(roomId).emit('opponent_rejoined', socket.id); 
  });

  // 1. The Ghost says "I am ready, give me the data"
  socket.on('request_rehydration', (roomId) => {
    // 2. The Server asks the OTHER player (the Survivor) to send it
    socket.to(roomId).emit('please_sync_state', socket.id);
  });

  // THE FIX: The pipeline that carries the save-state from the Survivor to the Ghost
  socket.on('sync_state_to_opponent', (data) => {
    io.to(data.targetSocketId).emit('rehydrate_game', data.state);
  });

    socket.on('flipCard', ({ roomCode, index }) => {
        const state = rooms.get(roomCode);
        if (!state || state.phase !== 'PLAY' || state.turn !== socket.id) return;
        if (state.matched.includes(index) || state.flipped.includes(index) || state.flipped.length >= 2) return;

        state.flipped.push(index);
        io.to(roomCode).emit('cardFlipped', { index });

        if (state.flipped.length === 2) {
            const [idx1, idx2] = state.flipped;
            const isMatch = state.deck[idx1] === state.deck[idx2];

            setTimeout(() => {
                if (isMatch) {
                    state.matched.push(idx1, idx2);
                    // THE FIX: Exactly 1 point per correct pair
                    state.scores[socket.id] += 1;

                    io.to(roomCode).emit('matchFound', {
                        matchedIndexes: state.matched,
                        scores: state.scores,
                        pairsFound: state.matched.length / 2
                    });

                    if (state.matched.length === state.deck.length) {
                        state.phase = 'OVER';
                        io.to(roomCode).emit('gameOver', state.scores);
                    }
                } else {
                    const nextIndex = state.players.indexOf(socket.id) === 0 ? 1 : 0;
                    state.turn = state.players[nextIndex];

                    io.to(roomCode).emit('noMatch', { failedIndexes: state.flipped });
                    io.to(roomCode).emit('turnChanged', state.turn);
                }
                state.flipped = [];
            }, 1000);
        }
    });

  // 1. OPPONENT DISCONNECT HANDLING WITH GRACE PERIOD
  socket.on('disconnect', () => {
    // Search all rooms to see if the disconnected user was in one
    for (const [roomCode, state] of rooms.entries()) {
      if (state.players.includes(socket.id)) {
        if (state.phase === 'OVER') {
          socket.to(roomCode).emit('opponent_disconnected');
          socket.to(roomCode).emit('playerDisconnected');
          rooms.delete(roomCode);
          continue;
        }
        
        // Notify the remaining player immediately that connection was temporarily lost
        socket.to(roomCode).emit('opponentTempDisconnected');

        state.disconnectTimers = state.disconnectTimers || {};
        state.disconnectTimers[socket.id] = setTimeout(() => {
          io.to(roomCode).emit('opponent_disconnected');
          io.to(roomCode).emit('playerDisconnected');
          rooms.delete(roomCode); // Clean up server memory
        }, 120000);
      }
    }
  });

  // THE NAME EXCHANGE RELAY
  socket.on('share_name', (data) => {
    // Send the name to the other player in the room
    socket.to(data.roomId).emit('receive_name', data.name);
  });

  // 2. THE REMATCH LOGIC
  socket.on('requestRematch', (roomCode) => {
    const state = rooms.get(roomCode);
    if (state) {
      state.rematchRequests = (state.rematchRequests || 0) + 1;
      
      // If both players clicked "Play Again"
      if (state.rematchRequests === 2) {
        // Generate a fresh board
        state.deck = generateDeck(state.settings.theme, state.settings.size);
        state.flipped = [];
        state.matched = [];
        state.scores = { [state.players[0]]: 0, [state.players[1]]: 0 };
        state.rematchRequests = 0;
        state.turn = state.players[0]; // Player 1 starts
        state.phase = 'PEEK';

        // Send the fresh board to both clients
        io.to(roomCode).emit('rematchStarted', {
          deck: state.deck,
          scores: state.scores,
          turn: state.turn
        });

        // Trigger the cinematic phase timers again!
        const peekDuration = state.settings.size <= 16 ? 3000 : state.settings.size <= 30 ? 4000 : 5000;
        setTimeout(() => {
          io.to(roomCode).emit('startShuffle');
          setTimeout(() => {
            if (rooms.has(roomCode)) {
              rooms.get(roomCode).phase = 'PLAY';
              io.to(roomCode).emit('endShuffleAndPlay');
            }
          }, 1500); 
        }, peekDuration);
      } else {
        // Tell the other guy you want to play again
        socket.to(roomCode).emit('rematchRequestedByOpponent');
      }
    }
  });
});

server.listen(3001, () => console.log(`Backend listening on port 3001`));
