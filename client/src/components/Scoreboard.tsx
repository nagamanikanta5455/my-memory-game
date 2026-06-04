import './Scoreboard.css';

interface ScoreboardProps {
  roomCode: string;
  playerScore: number;
  opponentScore: number;
  pairsFound: number;
  totalPairs: number;
  myName: string;
  opponentName: string;
  myTime: number;
  opponentTime: number;
  isMyTurn: boolean;
  formatTime: (seconds: number) => string;
}

export default function Scoreboard({
  roomCode,
  playerScore,
  opponentScore,
  pairsFound,
  totalPairs,
  myName,
  opponentName,
  myTime,
  opponentTime,
  isMyTurn,
  formatTime
}: ScoreboardProps) {
  return (
    <div className="scoreboard-container">
      {/* THE FIX: Static badge. No useless click handlers or icons. */}
      <div className="room-badge">
        <span className="room-label">ROOM</span>
        <span className="room-code">{roomCode}</span>
      </div>

      <div className="scores-wrapper">
        <div className={`score-box player ${isMyTurn ? 'active-turn' : ''}`}>
          {/* Clock back on top */}
          <div className={`chess-clock ${myTime <= 60 ? 'time-low' : ''}`}>
            {formatTime(myTime)}
          </div>
          <div className="score-value">{playerScore}</div>
          <div className="score-label">{myName}</div>
        </div>
        
        <div className="vs-badge">VS</div>
        
        <div className={`score-box opponent ${!isMyTurn ? 'active-turn' : ''}`}>
          {/* Clock back on top */}
          <div className={`chess-clock ${opponentTime <= 60 ? 'time-low' : ''}`}>
            {formatTime(opponentTime)}
          </div>
          <div className="score-value">{opponentScore}</div>
          <div className="score-label">{opponentName}</div>
        </div>
      </div>

      <div className="progress-badge">
        <div className="progress-numbers">{pairsFound} <span className="progress-divider">/</span> {totalPairs}</div>
        <div className="progress-label">PAIRS FOUND</div>
      </div>
    </div>
  );
}