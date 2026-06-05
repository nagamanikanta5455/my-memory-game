import { useState, useEffect } from 'react';
import { socket } from '../socket';
import Card from './Card';
import Scoreboard from './Scoreboard';
import { playSmoothCorrect, playSmoothError, playSmoothFlip, playShuffleSound } from '../soundEngine';
import './Board.css';


interface BoardProps {
  roomCode: string;
  initialData: {
    turn: string;
    players: string[];
    playerNames: Record<string, string>; // NEW
    scores: Record<string, number>;
    settings: { size: number; theme: string };
    deck: string[];
  };
}

export default function Board({ roomCode, initialData }: BoardProps) {
  const [deck, setDeck] = useState<string[]>(initialData.deck);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [errorCards, setErrorCards] = useState<number[]>([]);

  const [currentTurn, setCurrentTurn] = useState<string>(initialData.turn);
  const [scores, setScores] = useState<Record<string, number>>(initialData.scores);
  const [players, setPlayers] = useState<string[]>(initialData.players);
  const [gameHasStarted] = useState(true);
  const [pairsFound, setPairsFound] = useState<number>(0);
  const [moves, setMoves] = useState<Record<string, number>>({});

  // 1. State to hold the opponent's name (defaults to 'OPPONENT')
  const [opponentName, setOpponentName] = useState<string>(() => {
    const oppSocketId = initialData.players.find(id => id !== socket.id);
    let rawOppName = oppSocketId ? (initialData.playerNames?.[oppSocketId] || '') : '';
    if (rawOppName === 'Player 1' || rawOppName === 'Player 2') rawOppName = '';
    return rawOppName || 'OPPONENT';
  });

  const [isGameOver, setIsGameOver] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [phase, setPhase] = useState<'PEEK' | 'SHUFFLE' | 'PLAY'>('PEEK');
  const [countdown, setCountdown] = useState(() => {
    const deckSize = initialData.deck.length;
    if (deckSize <= 16) return 3;
    if (deckSize <= 30) return 4;
    return 5;
  });

  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [opponentTempDisconnected, setOpponentTempDisconnected] = useState(false);
  const [myConnectionLost, setMyConnectionLost] = useState(!socket.connected);
  const [rematchStatus, setRematchStatus] = useState<'idle' | 'waiting' | 'requested'>('idle');
  const [disconnectTimer, setDisconnectTimer] = useState(120);
  const [copied, setCopied] = useState(false);

  // --- CHESS CLOCK STATES ---
  const [myTime, setMyTime] = useState(() => {
    const deckSize = initialData.deck.length;
    if (deckSize <= 16) return 120;
    if (deckSize <= 30) return 300;
    return 720;
  });
  const [opponentTime, setOpponentTime] = useState(() => {
    const deckSize = initialData.deck.length;
    if (deckSize <= 16) return 120;
    if (deckSize <= 30) return 300;
    return 720;
  });
  const [timedOutPlayer, setTimedOutPlayer] = useState<string | null>(null);

  // --- EXISTING ID LOGIC ---
  const myId = socket.id || '';
  const [oppId, setOppId] = useState(() => {
    return initialData.players.find((id) => id !== myId) || '';
  });

  const isMyTurn = currentTurn === socket.id;
  const myScore = scores[socket.id || ''] || 0;
  const oppScore = scores[oppId] || 0;
  const myMoves = moves[socket.id || ''] || 0;
  const oppMoves = moves[oppId] || 0;

  // Helper to format seconds into MM:SS
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleLeaveRoom = () => {
    window.location.reload();
  };

  const handleCopyRoom = () => {
    navigator.clipboard.writeText(roomCode); 
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); 
  };

  const handlePlayAgain = () => {
    socket.emit('requestRematch', roomCode);
    setRematchStatus('waiting');
  };

  useEffect(() => {
    if (!opponentTempDisconnected) {
      setDisconnectTimer(120);
      return;
    }

    const interval = setInterval(() => {
      setDisconnectTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleLeaveRoom();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [opponentTempDisconnected]);

  useEffect(() => {
    let interval: any;
    if (phase === 'PEEK') {
      const initialCountdown = deck.length <= 16 ? 3 : deck.length <= 30 ? 4 : 5;
      setCountdown(initialCountdown);
      interval = setInterval(() => {
        setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [phase, deck.length]);

  // --- 1. THE GHOST HANDSHAKE ---
  useEffect(() => {
    // If we have a room code, tell the server we are ready to receive data
    if (roomCode) {
      socket.emit('request_rehydration', roomCode);
    }
    // THE FIX: Play the rapid dealing sound right as the cards hit the screen for fresh game starts
    playShuffleSound();
  }, [roomCode, socket]); 

  // --- 1.5. THE AUTO-EXCHANGE SYSTEM ---
  useEffect(() => {
    let rawMyName = initialData.playerNames?.[socket.id || ''] || '';
    if (rawMyName === 'Player 1' || rawMyName === 'Player 2') rawMyName = '';

    // Whenever the room loads, tell the opponent my name
    if (rawMyName) {
      socket.emit('share_name', { roomId: roomCode, name: rawMyName });
    }

    // Listen for the opponent telling us their name
    const handleReceiveName = (name: string) => {
      setOpponentName(name);
    };

    socket.on('receive_name', handleReceiveName);

    return () => {
      socket.off('receive_name', handleReceiveName);
    };
  }, [initialData.playerNames, roomCode, socket]); 

  // --- 2. THE SURVIVOR SYNC (Send the save state only when asked) ---
  useEffect(() => {
    const handlePleaseSync = (newOpponentId: string) => {
      // SHIELD: Only send data if we are ACTUALLY playing a game right now
      if (phase !== 'PLAY') return;

      // 1. Grab the exact points and moves right now using the OLD identities
      const survivorPoints = scores[socket.id || ''] || 0;
      const ghostPoints = scores[oppId] || 0; 
      const survivorMoves = moves[socket.id || ''] || 0;
      const ghostMoves = moves[oppId] || 0;

      // 2. THE FIX: Migrate the scores and moves locally to the NEW identity
      setScores({
        [socket.id || '']: survivorPoints,
        [newOpponentId]: ghostPoints 
      });
      setMoves({
        [socket.id || '']: survivorMoves,
        [newOpponentId]: ghostMoves
      });

      // 3. THE FIX: If it was the Ghost's turn, give the turn to their NEW identity
      if (currentTurn === oppId) {
        setCurrentTurn(newOpponentId);
      }

      // 4. THE FIX: Update the opponent ID tracker
      setOppId(newOpponentId);
      setOpponentTempDisconnected(false);
      setOpponentDisconnected(false);
      
      // 5. Send the perfect data package to the Ghost
      socket.emit('sync_state_to_opponent', {
        targetSocketId: newOpponentId,
        state: {
          cards: deck,
          matched: matched,
          flipped: flipped,
          myScore: ghostPoints,          // Give the Ghost their points back
          opponentScore: survivorPoints, // Send the Survivor's points
          myMoves: ghostMoves,           // Give the Ghost their moves back
          opponentMoves: survivorMoves,  // Send the Survivor's moves
          survivorId: socket.id,         // Stamp our ID so the Ghost remembers us
          myTime: opponentTime,
          opponentTime: myTime,
          isMyTurn: currentTurn !== (socket.id || ''), // True if it was NOT our turn
          phase: 'PLAY'
        }
      });
    };

    socket.on('please_sync_state', handlePleaseSync);
    return () => {
      socket.off('please_sync_state', handlePleaseSync);
    };
  }, [deck, matched, flipped, scores, moves, oppId, currentTurn, phase, myTime, opponentTime]);

  // --- 3. THE GHOST REHYDRATION (Receive the data safely) ---
  useEffect(() => {
    const handleRehydrate = (state: any) => {
      // 1. Set all the exact values from the Survivor
      setDeck(state.cards);
      setMatched(state.matched || []);
      setFlipped(state.flipped || []); // Copy the Survivor's exact visual state

      setScores({
        [socket.id || '']: state.myScore,
        [state.survivorId]: state.opponentScore
      });
      setMoves({
        [socket.id || '']: state.myMoves,
        [state.survivorId]: state.opponentMoves
      });
      setMyTime(state.myTime);
      setOpponentTime(state.opponentTime);
      setCurrentTurn(state.isMyTurn ? (socket.id || '') : state.survivorId);

      // 2. THE FIX FOR FLIPPED CARDS: 
      // Force the countdown to a negative number so the 'Memorize' effect ignores it entirely
      setCountdown(-1); 
      setPhase(state.phase || 'PLAY'); 
      setOpponentTempDisconnected(false);
      setOpponentDisconnected(false);
    };

    socket.on('rehydrate_game', handleRehydrate);
    return () => {
      socket.off('rehydrate_game', handleRehydrate);
    };
  }, [oppId]);

  useEffect(() => {
    // 1. Initial Peek setup
    if (deck.length > 0 && phase === 'PEEK') {
      const allIndexes = deck.map((_, i) => i);
      setFlipped(allIndexes);
    }

    // 2. Listen for the Gather/Shuffle trigger
    socket.on('startShuffle', () => {
      setPhase('SHUFFLE');
      playShuffleSound();
    });

    // 3. Listen for the Deal/Play trigger
    socket.on('endShuffleAndPlay', () => {
      setPhase('PLAY');
      setFlipped([]); // Snap them all face down instantly
      playShuffleSound(); // Re-use shuffle sound for dealing
    });

    // ... KEEP your existing socket.on('cardFlipped', etc) listeners here ...
    socket.on('cardFlipped', ({ index }) => {
      setFlipped((prev) => {
        if (prev.length === 1) {
          setMoves((m) => ({
            ...m,
            [currentTurn]: (m[currentTurn] || 0) + 1
          }));
        }
        return [...prev, index];
      });
    });
    socket.on('matchFound', ({ matchedIndexes, scores, pairsFound }) => {
      playSmoothCorrect(); setMatched(matchedIndexes); setScores(scores); setPairsFound(pairsFound); setFlipped([]);
      setIsLocked(false);
    });
    socket.on('noMatch', ({ failedIndexes }) => {
      playSmoothError(); setErrorCards(failedIndexes);
      setTimeout(() => { setErrorCards([]); setFlipped([]); setIsLocked(false); }, 600);
    });
    socket.on('turnChanged', (nextTurnId) => {
      setCurrentTurn(nextTurnId);
      setIsLocked(false);
    });
    socket.on('gameOver', () => setIsGameOver(true));
    
    socket.on('opponentTempDisconnected', () => {
      setOpponentTempDisconnected(true);
      setDisconnectTimer(120);
      setRematchStatus('idle'); // Kill the waiting state
      setPlayers(prev => prev.filter(id => id === socket.id));
    });
    socket.on('playerReconnected', () => {
      setOpponentTempDisconnected(false);
      setPlayers(prev => {
        if (oppId && !prev.includes(oppId)) {
          return [...prev, oppId];
        }
        return prev;
      });
    });
    socket.on('playerDisconnected', () => {
      setOpponentTempDisconnected(false);
      setOpponentDisconnected(true);
      setRematchStatus('idle'); // THE FIX: Kill the "Waiting for opponent" trap instantly
      setPlayers(prev => prev.filter(id => id === socket.id));
    });
    socket.on('opponent_disconnected', () => {
      setOpponentTempDisconnected(false);
      setOpponentDisconnected(true);
      setRematchStatus('idle');
      setPlayers(prev => prev.filter(id => id === socket.id));
    });

    const onDisconnect = () => setMyConnectionLost(true);
    const onConnect = () => setMyConnectionLost(false);

    socket.on('disconnect', onDisconnect);
    socket.on('connect', onConnect);

    socket.on('rematchRequestedByOpponent', () => setRematchStatus('requested'));
    socket.on('rematchStarted', (newData) => {
      // Complete state reset for round 2
      setDeck(newData.deck);
      setScores(newData.scores);
      setCurrentTurn(newData.turn);
      setPlayers(initialData.players);
      setMatched([]);
      setFlipped(newData.deck.map((_, i) => i)); // Flip all face-up for the peek
      setErrorCards([]);
      setPairsFound(0);
      setMoves({});
      setIsGameOver(false);
      setRematchStatus('idle');
      setPhase('PEEK');
      
      // Reset Chess Clocks & Timeout status
      const deckSize = newData.deck.length;
      const initialTime = deckSize <= 16 ? 120 : deckSize <= 30 ? 300 : 720;
      setMyTime(initialTime);
      setOpponentTime(initialTime);
      setTimedOutPlayer(null);

      // THE FIX: Play dealing sound on rematch start
      playShuffleSound();
    });

    return () => {
      socket.off('startShuffle');
      socket.off('endShuffleAndPlay');
      socket.off('cardFlipped');
      socket.off('matchFound');
      socket.off('noMatch');
      socket.off('turnChanged');
      socket.off('gameOver');
      socket.off('opponentTempDisconnected');
      socket.off('playerReconnected');
      socket.off('playerDisconnected');
      socket.off('opponent_disconnected');
      socket.off('disconnect', onDisconnect);
      socket.off('connect', onConnect);
      socket.off('rematchRequestedByOpponent');
      socket.off('rematchStarted');
    };
  }, [deck, phase, currentTurn]);

  const handleCardClick = (index: number) => {
    if (isLocked || phase !== 'PLAY' || currentTurn !== socket.id || flipped.includes(index) || matched.includes(index)) return;
    if (flipped.length === 1) {
      setIsLocked(true);
    }
    playSmoothFlip();
    socket.emit('flipCard', { roomCode, index });
  };



  // --- CHESS CLOCK ENGINE ---
  useEffect(() => {
    if (phase !== 'PLAY' || isGameOver || opponentTempDisconnected || opponentDisconnected) return;

    const timerInterval = setInterval(() => {
      if (isMyTurn) {
        setMyTime((prev) => {
          if (prev <= 1) {
            clearInterval(timerInterval);
            handleTimeOut(socket.id || '');
            return 0;
          }
          return prev - 1;
        });
      } else {
        setOpponentTime((prev) => {
          if (prev <= 1) {
            clearInterval(timerInterval);
            const oppId = players.find(id => id !== socket.id) || '';
            handleTimeOut(oppId);
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [phase, isGameOver, isMyTurn, opponentTempDisconnected, opponentDisconnected]);

  // --- TIMEOUT EVALUATION ---
  const handleTimeOut = (lostPlayerId: string) => {
    setTimedOutPlayer(lostPlayerId);
    setIsGameOver(true);
  };



  // --- THE FIX: SMART NAME FALLBACKS ---
  let rawMyName = initialData.playerNames?.[myId] || '';
  let rawOppName = initialData.playerNames?.[oppId] || '';

  // 1. Intercept and wipe out the generic server defaults if the user left the input blank
  if (rawMyName === 'Player 1' || rawMyName === 'Player 2') rawMyName = '';
  if (rawOppName === 'Player 1' || rawOppName === 'Player 2') rawOppName = '';

  // 2. Apply the custom name if it exists, otherwise use the premium YOU/OPPONENT labels
  const myName = rawMyName || 'YOU';
  const oppName = opponentName && opponentName !== 'OPPONENT' ? opponentName : (rawOppName || 'OPPONENT');

  // NEW: Calculate optimal columns for landscape screens
  let gridCols = 4;
  if (initialData.settings.size === 30) {
    gridCols = 6;
  } else if (initialData.settings.size === 48) {
    gridCols = 8;
  }

  // THE FIX: Determine difficulty scale based on total cards
  let scaleClass = 'scale-hard'; // Default to compact
  if (deck.length <= 16) {
    scaleClass = 'scale-easy';   // 4x4 gets massive cards
  } else if (deck.length <= 30) {
    scaleClass = 'scale-medium'; // 5x6 gets normal cards
  }

  return (
    <div className="game-wrapper">
      {/* 1. SELF CONNECTION LOST OVERLAY */}
      {myConnectionLost && (
        <div className="victory-overlay">
          <div className="victory-card theme-defeat">
            <h1 className="victory-title" style={{ fontSize: '2.5rem' }}>CONNECTION LOST</h1>
            <p className="matchmaking-subtext" style={{ color: '#888', textAlign: 'center', margin: '1rem 0' }}>
              We’re trying to reconnect to the game session...
            </p>
            <div className="modal-buttons">
              <button
                className="btn-endgame btn-play-again"
                onClick={() => window.location.reload()} // Quick re-init
              >
                RECONNECTING...
              </button>
              <button
                className="btn-endgame btn-leave-room"
                onClick={handleLeaveRoom}
              >
                EXIT TO LOBBY
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. OPPONENT TEMPORARILY DISCONNECTED OVERLAY */}
      {gameHasStarted && players.length < 2 && !myConnectionLost && opponentTempDisconnected && (
        <div className="disconnect-overlay-bulletproof">
          <div className="disconnect-modal-bulletproof">
            <div className="w-full flex flex-col items-center justify-center mb-6 text-center">
              <h2 className="text-3xl sm:text-4xl font-black text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)] uppercase leading-none">
                {/* Block 1: Forced to its own line, stretched to match width */}
                <div className="tracking-[0.35em] ml-2 mb-2">
                  OPPONENT
                </div>
                
                {/* Block 2: Forced to its own line below it */}
                <div className="tracking-widest">
                  DISCONNECTED
                </div>
              </h2>
            </div>

            <p className="disconnect-timer-bulletproof">
              Waiting <span>{formatTime(disconnectTimer)}</span> for them to rejoin...
            </p>

            <div className="disconnect-code-box-bulletproof" onClick={handleCopyRoom}>
              <span className="disconnect-code-label-bulletproof">ROOM CODE</span>
              <span className="disconnect-code-value-bulletproof">{roomCode}</span>
              <span 
                className="disconnect-code-action-bulletproof"
                style={{ color: copied ? '#00ffaa' : '#6b7280' }}
              >
                {copied ? '✔ COPIED TO CLIPBOARD' : 'CLICK TO COPY'}
              </span>
            </div>

            <button className="disconnect-exit-btn-bulletproof" onClick={handleLeaveRoom}>
              EXIT TO LOBBY
            </button>
          </div>
        </div>
      )}

      {/* 3. OPPONENT PERMANENTLY DISCONNECTED OVERLAY */}
      {gameHasStarted && players.length < 2 && !myConnectionLost && !opponentTempDisconnected && opponentDisconnected && !isGameOver && (
        <div className="victory-overlay">
          <div className="victory-card theme-defeat">
            <h1 className="victory-title" style={{ fontSize: '2.2rem' }}>GAME ABANDONED</h1>
            <p className="matchmaking-subtext" style={{ color: '#888', textAlign: 'center', margin: '1rem 0' }}>
              Your opponent has left the session.
            </p>
            <div className="modal-buttons">
              <button
                className="btn-endgame btn-leave-room"
                onClick={handleLeaveRoom}
              >
                EXIT TO LOBBY
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. GAME OVER OVERLAY */}
      {!myConnectionLost && !opponentTempDisconnected && isGameOver && (
        <div className="victory-overlay">
          <div className={`victory-card ${
            timedOutPlayer
              ? (timedOutPlayer === socket.id ? 'theme-defeat' : 'theme-victory')
              : (myScore >= oppScore ? 'theme-victory' : 'theme-defeat')
          }`}>
            <h1 className="victory-title">
              {timedOutPlayer 
                ? (timedOutPlayer === socket.id ? 'TIMEOUT DEFEAT' : 'TIMEOUT VICTORY')
                : (myScore > oppScore ? 'VICTORY' : myScore < oppScore ? 'DEFEAT' : 'DRAW')
              }
            </h1>

            {/* THE PREMIUM ANALYTICS DASHBOARD */}
            <div className="analytics-grid">
              <div className="stat-box">
                <div className="stat-label">
                  {myName && myName !== 'YOU' ? `${myName.toUpperCase()}'S PAIRS` : 'YOUR PAIRS'}
                </div>
                <div className="stat-value">{myScore}</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">
                  {myName && myName !== 'YOU' ? `${myName.toUpperCase()}'S ACCURACY` : 'YOUR ACCURACY'}
                </div>
                <div className="stat-value accuracy-glow">
                  {myMoves > 0 ? Math.round((myScore / myMoves) * 100) : 0}%
                </div>
              </div>
              <div className="stat-box">
                <div className="stat-label">
                  {oppName && oppName !== 'OPPONENT' ? `${oppName.toUpperCase()}'S PAIRS` : 'OPP PAIRS'}
                </div>
                <div className="stat-value">{oppScore}</div>
              </div>
              <div className="stat-box">
                <div className="stat-label">
                  {oppName && oppName !== 'OPPONENT' ? `${oppName.toUpperCase()}'S ACCURACY` : 'OPP ACCURACY'}
                </div>
                <div className="stat-value accuracy-glow">
                  {oppMoves > 0 ? Math.round((oppScore / oppMoves) * 100) : 0}%
                </div>
              </div>
            </div>

            {/* THE FIX: Real-time opponent status inside the endgame screen */}
            <div style={{ minHeight: '24px', margin: '0.5rem 0' }}>
              {opponentDisconnected ? (
                <p style={{ color: '#ff3344', textAlign: 'center', fontSize: '0.9rem', fontWeight: 'bold', margin: 0 }}>
                  Opponent has left the room.
                </p>
              ) : rematchStatus === 'waiting' ? (
                <p style={{ color: '#a0a0ab', textAlign: 'center', fontSize: '0.9rem', margin: 0 }}>
                  Waiting for opponent to accept...
                </p>
              ) : rematchStatus === 'requested' ? (
                <p style={{ color: '#a0a0ab', textAlign: 'center', fontSize: '0.9rem', margin: 0 }}>
                  {oppName} wants a rematch!
                </p>
              ) : null}
            </div>

            <div className="modal-buttons">
              <button
                className={`btn-endgame btn-play-again ${rematchStatus === 'requested' ? 'requested' : ''}`}
                onClick={handlePlayAgain}
                /* Disable the button if they left OR if we are waiting */
                disabled={opponentDisconnected || rematchStatus === 'waiting'}
                style={{
                  opacity: (opponentDisconnected || rematchStatus === 'waiting') ? 0.5 : 1,
                  cursor: (opponentDisconnected || rematchStatus === 'waiting') ? 'not-allowed' : 'pointer'
                }}
              >
                {opponentDisconnected ? 'OPPONENT LEFT' : (rematchStatus === 'requested' ? 'ACCEPT REMATCH' : rematchStatus === 'waiting' ? 'REQUEST SENT' : 'PLAY AGAIN')}
              </button>
              <button
                className="btn-endgame btn-leave-room"
                onClick={handleLeaveRoom}
              >
                LEAVE ROOM
              </button>
            </div>
          </div>
        </div>
      )}



      <Scoreboard
        roomCode={roomCode}
        playerScore={myScore}
        opponentScore={oppScore}
        pairsFound={pairsFound}
        totalPairs={initialData.settings.size / 2}
        myName={myName}
        opponentName={oppName}
        myTime={myTime}
        opponentTime={opponentTime}
        isMyTurn={isMyTurn}
        formatTime={formatTime}
      />

      {/* THE SMART STATUS BADGE */}
      <div className={`turn-status ${phase === 'PEEK' ? 'status-memorizing' :
          (isMyTurn ? 'status-yours' : 'status-opponents')
        }`}>
        {phase === 'PEEK'
          ? `MEMORIZE THE BOARD: ${countdown}`
          : (isMyTurn ? 'YOUR TURN' : 'OPPONENT\'S TURN')
        }
      </div>

      {/* THE FIX: Only render the centerpiece during SHUFFLE */}
      {phase === 'SHUFFLE' ? (
        <div className="shuffle-centerpiece">
          <div className="shuffle-card"></div>
          <div className="shuffle-card"></div>
          <div className="shuffle-card"></div>
          <div className="shuffle-text">SHUFFLING...</div>
        </div>
      ) : (
        /* THE FIX: key={phase} forces React to mount a fresh board, guaranteeing animations fire */
        <div
          key={`board-${phase}`}
          className={`board ${phase === 'PEEK' ? 'peeking' : ''} ${!isMyTurn || isGameOver ? 'disabled' : ''} ${scaleClass}`}
          style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}
        >
          {deck.map((content, index) => {
            const animationDelay = `${index * 0.03}s`;
            const isCurrentlyMismatched = errorCards.includes(index);
            const isJustMatched = matched.includes(index);

            return (
              <div
                key={index}
                className={`card-wrapper ${phase === 'PLAY' ? 'deal-animate' : ''} ${isJustMatched ? 'wrapper-match' : ''} ${isCurrentlyMismatched ? 'wrapper-mismatch' : ''}`}
                style={{ animationDelay }}
              >
                <Card
                  content={content}
                  isFlipped={flipped.includes(index) || matched.includes(index)}
                  isMatch={matched.includes(index)}
                  isError={errorCards.includes(index)}
                  onClick={() => handleCardClick(index)}
                  index={index}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  );
}