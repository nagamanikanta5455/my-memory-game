import { useState, useEffect } from 'react';
import Board from './components/Board';
import { socket } from './socket';
import './App.css';

function App() {
  const [roomCode, setRoomCode] = useState('');
  const [inRoom, setInRoom] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [initialData, setInitialData] = useState<any>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const [theme, setTheme] = useState('animals');
  const [size, setSize] = useState(16);
  const [playerName, setPlayerName] = useState('');
  const [lobbyCopied, setLobbyCopied] = useState(false);

  const handleCopyLobbyId = () => {
    navigator.clipboard.writeText(roomCode);
    setLobbyCopied(true);
    setTimeout(() => setLobbyCopied(false), 2000);
  };

  const [isFullscreen, setIsFullscreen] = useState(false);

  // Keeps our React state synced with the actual browser state
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      // Request fullscreen on the entire HTML document
      document.documentElement.requestFullscreen().catch((err) => {
        console.log(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      // Exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  useEffect(() => {
    const handleRoomCreated = (code: string) => {
      setRoomCode(code);
      setInRoom(true);
    };

    const handleGameStart = (state: any) => {
      setInitialData((prev: any) => {
        if (prev) return prev; // THE FRONTEND SHIELD: If we are already mid-game, ignore this event entirely!
        if (state.roomCode) setRoomCode(state.roomCode); // Sync code for the joiner
        setInRoom(true);
        return state;
      });
    };

    // NEW: Gracefully catch backend rejection without crashing
    const handleJoinError = (msg: string) => {
      showNotification(msg);
      setJoinCode(''); // Clear the bad code so they can try again
    };

    const resetToLobby = (msg: string) => {
      showNotification(msg);
      setInRoom(false);
      setRoomCode('');
      setInitialData(null);
    };

    socket.on('roomCreated', handleRoomCreated);
    socket.on('gameStart', handleGameStart);
    socket.on('joinError', handleJoinError); // Listen for bad code rejections
    socket.on('disconnect', () => {
      // If we are not in a game yet, reset to lobby. If in game, let Board component render the Connection Lost overlay.
      setInitialData((prev: any) => {
        if (!prev) {
          setInRoom(false);
          setRoomCode('');
        }
        return prev;
      });
      showNotification('Connection lost. Trying to reconnect...');
    });
    socket.on('opponentDisconnected', () => resetToLobby('Opponent left the match.'));

    return () => {
      socket.off('roomCreated', handleRoomCreated);
      socket.off('gameStart', handleGameStart);
      socket.off('joinError', handleJoinError);
      socket.off('disconnect');
      socket.off('opponentDisconnected');
    };
  }, []);

  const createRoom = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    socket.emit('createRoom', { roomCode: code, settings: { theme, size }, playerName });
  };

  const joinRoom = () => {
    if (joinCode.trim().length === 4) {
      socket.emit('joinRoom', { roomCode: joinCode.toUpperCase(), playerName });
    } else {
      showNotification('Code must be exactly 4 characters.');
    }
  };

  if (inRoom) {
    return (
      <div className="app-layout">
        {/* THE PREMIUM FULLSCREEN TOGGLE */}
        <button 
          className="btn-fullscreen" 
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit Fullscreen" : "Play in Fullscreen"}
        >
          {isFullscreen ? (
            // "Shrink" Icon
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
            </svg>
          ) : (
            // "Expand" Icon
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            </svg>
          )}
        </button>

        {notification && (
          <div className="toast-notification">
            <div className="toast-accent"></div>
            <span className="toast-text">{notification}</span>
          </div>
        )}
        {!initialData ? (
          /* THE FIX: Replaced inline styles with pure class components */
          <div className="matchmaking-container">
            <div className="matchmaking-card">
              <h2 className="matchmaking-label">MATCHMAKING ID</h2>

              <div
                className="matchmaking-code"
                onClick={handleCopyLobbyId}
                style={{ cursor: 'pointer', position: 'relative' }}
              >
                {/* Keep your original Room ID text exactly as it was */}
                <span>{roomCode}</span>

                {/* THE FIX: Add this floating confirmation that only appears when clicked */}
                <div className={`floating-copy-confirm ${lobbyCopied ? 'show-copy' : ''}`}>
                  ✔ COPIED
                </div>
              </div>

              <div className="premium-pulse-line"></div>

              <p className="matchmaking-subtext">
                Awaiting opponent connection and server sync...
              </p>
            </div>
          </div>
        ) : (
          <Board roomCode={roomCode} initialData={initialData} />
        )}
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* THE PREMIUM FULLSCREEN TOGGLE */}
      <button 
        className="btn-fullscreen" 
        onClick={toggleFullscreen}
        title={isFullscreen ? "Exit Fullscreen" : "Play in Fullscreen"}
      >
        {isFullscreen ? (
          // "Shrink" Icon
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
          </svg>
        ) : (
          // "Expand" Icon
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
          </svg>
        )}
      </button>

      {notification && (
        <div className="toast-notification">
          <div className="toast-accent"></div>
          <span className="toast-text">{notification}</span>
        </div>
      )}

      <div className="lobby-wrapper">
        <h1 className="main-title cinematic-glow">Memory Match</h1>
        <div className="premium-lobby-card">

          <div className="settings-container">
            {/* NEW NAME INPUT */}
            <div className="select-field">
              <span className="field-label">DISPLAY NAME (OPTIONAL)</span>
              <input
                type="text"
                placeholder="Enter your name..."
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={12}
                className="clean-join-input"
                style={{ textAlign: 'left', padding: '1.1rem 1.2rem', letterSpacing: '1px', fontSize: '0.95rem' }}
              />
            </div>

            <div className="select-field">
              <span className="field-label">THEME</span>
              <div className="select-wrapper">
                <select value={theme} onChange={(e) => setTheme(e.target.value)} className="clean-select">
                  <option value="animals">Talking Tom (Animals)</option>
                  <option value="cosmic">Deep Space (Cosmic)</option>
                  <option value="fruits">Juicy (Fruits)</option>
                  <option value="mythical">Legends (Mythical)</option>
                  <option value="arcane">Spellbound (Arcane)</option>
                </select>
              </div>
            </div>

            <div className="select-field">
              <span className="field-label">DIFFICULTY</span>
              <div className="select-wrapper">
                <select value={size} onChange={(e) => setSize(Number(e.target.value))} className="clean-select">
                  <option value={16}>Easy (4×4)</option>
                  <option value={30}>Medium (5×6)</option>
                  <option value={48}>Hard (6×8)</option>
                </select>
              </div>
            </div>
          </div>

          <button onClick={createRoom} className="btn-action-primary">Create New Game</button>

          <div className="premium-divider">
            <div className="line"></div>
            <span className="divider-text">OR</span>
            <div className="line"></div>
          </div>

          <div className="join-container">
            <input
              type="text"
              placeholder="ENTER CODE"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              maxLength={4}
              className="clean-join-input"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  joinRoom();
                }
              }}
            />
            {/* THE FIX: Dynamic class added when code length is 4 */}
            <button
              onClick={joinRoom}
              className={`btn-action-secondary ${joinCode.length === 4 ? 'ready-to-join' : ''}`}
            >
              Join Game
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;