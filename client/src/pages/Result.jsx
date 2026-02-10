// Result page - Cyberpunk Neon UI
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Trophy, RotateCcw, DoorOpen } from 'lucide-react';
import socket from '../socket';

function Result() {
  const navigate = useNavigate();
  const location = useLocation();
  const { roomCode, playerId, playerName, room: initialRoom, winner: gameWinner, reason: gameReason } = location.state || {};

  const [room, setRoom] = useState(initialRoom);

  useEffect(() => {
    if (!roomCode || !playerId || !room) {
      navigate('/');
      return;
    }

    socket.on('gameReset', ({ room: updatedRoom }) => {
      navigate('/lobby', {
        state: {
          roomCode,
          playerId,
          playerName,
          isHost: updatedRoom.hostId === playerId,
          room: updatedRoom
        }
      });
    });

    socket.on('playerLeft', ({ room: updatedRoom }) => {
      setRoom(updatedRoom);
      if (!updatedRoom.players.find((p) => p.id === playerId)) {
        navigate('/');
      }
    });

    return () => {
      socket.off('gameReset');
      socket.off('playerLeft');
    };
  }, [roomCode, playerId, playerName, navigate, room]);

  const handlePlayAgain = () => {
    socket.emit('playAgain', (response) => {
      if (!response.success) {
        alert('Failed to restart game');
      }
    });
  };

  const handleLeave = () => {
    socket.emit('leaveRoom', (response) => {
      if (response.success || !response) {
        socket.disconnect();
        navigate('/');
      } else {
        console.error('Failed to leave room:', response.error);
        socket.disconnect();
        navigate('/');
      }
    });
  };

  if (!room) {
    return (
      <div className="result-container">
        <div className="loading">Loading results...</div>
        <style jsx>{`
          .result-container {
            min-height: 100vh;
            background: linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%);
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .loading {
            color: #00ff88;
            font-size: 20px;
            font-family: 'Press Start 2P', 'Courier New', monospace;
            text-shadow: 0 0 10px #00ff88;
          }
        `}</style>
      </div>
    );
  }

  // Determine winner display based on game outcome
  let winnerDisplay;
  let winnersList = [];
  let losersList = [];
  
  if (gameWinner === 'debuggers') {
    winnerDisplay = 'DEBUGGERS WIN!';
    // Debuggers won - they are the winners
    winnersList = room.players.filter(p => room.debuggers.includes(p.id));
    losersList = room.players.filter(p => p.id === room.bugger);
  } else if (gameWinner === 'bugger') {
    winnerDisplay = 'BUGGER WINS!';
    // Bugger won - they are the winner
    winnersList = room.players.filter(p => p.id === room.bugger);
    losersList = room.players.filter(p => room.debuggers.includes(p.id));
  } else {
    // Fallback
    winnerDisplay = 'GAME OVER';
    winnersList = room.players;
  }

  const playerColors = ['#00ff88', '#00ddff', '#dd00ff', '#ffcc00', '#ff9900', '#ff3366'];

  return (
    <div className="result-container">
      <div className="result-content">
        {/* Header */}
        <div className="result-header">
          <h1 className="game-over-title">GAME OVER</h1>
        </div>

        {/* Winner Card */}
        <div className="winner-card">
          <div className="winner-info">
            <span className="winner-name">{winnerDisplay}</span>
            {gameReason && <span className="winner-reason">{gameReason}</span>}
          </div>
        </div>

        {/* Final Scores */}
        <div className="scores-card">
          <h2 className="scores-title">WINNERS</h2>
          <div className="scores-list">
            {winnersList.map((player, index) => (
              <div
                key={player.id}
                className={`score-row ${player.id === playerId ? 'highlight' : ''}`}
                style={{ borderColor: '#00ff88' }}
              >
                <span className="score-name">{player.name}</span>
                {player.id === playerId && <span className="you-badge">YOU</span>}
                <span className="score-role">
                  {player.id === room.bugger ? 'Bugger' : 'Debugger'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {losersList.length > 0 && (
          <div className="scores-card">
            <h2 className="scores-title">LOSERS</h2>
            <div className="scores-list">
              {losersList.map((player, index) => (
                <div
                  key={player.id}
                  className={`score-row ${player.id === playerId ? 'highlight' : ''}`}
                  style={{ borderColor: '#ff3366' }}
                >
                  <span className="score-rank">❌</span>
                  <span className="score-name">{player.name}</span>
                  {player.id === playerId && <span className="you-badge">YOU</span>}
                  <span className="score-role">
                    {player.id === room.bugger ? 'Bugger' : 'Debugger'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Game Stats */}
        <div className="stats-card">
          <h2 className="stats-title">GAME STATS</h2>
          <div className="stat-row">
            <span className="stat-label">Total Rounds:</span>
            <span className="stat-value">{room.totalRounds}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Players:</span>
            <span className="stat-value">{room.players.length}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Room Code:</span>
            <span className="stat-value">{roomCode}</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="result-buttons">
          <button className="btn-play-again" onClick={handlePlayAgain}>
            <RotateCcw size={16} style={{marginRight: '8px'}} /> PLAY AGAIN
          </button>
          <button className="btn-leave" onClick={handleLeave}>
            <DoorOpen size={16} style={{marginRight: '8px'}} /> LEAVE GAME
          </button>
        </div>
      </div>

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');

        .result-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%);
          font-family: 'Press Start 2P', 'Courier New', monospace;
          color: #e0f0ff;
          padding: 24px;
          position: relative;
          overflow: hidden;
        }

        .result-container::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: 
            radial-gradient(circle at 20% 20%, rgba(0, 255, 136, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(0, 221, 255, 0.1) 0%, transparent 50%);
          pointer-events: none;
        }

        .result-content {
          width: 100%;
          max-width: 560px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
          position: relative;
          z-index: 1;
        }

        /* Header */
        .result-header {
          display: flex;
          align-items: center;
          gap: 16px;
          animation: glow-pulse 2s ease-in-out infinite;
        }

        .game-over-emoji {
          font-size: 2.5rem;
        }

        .game-over-title {
          font-size: 2.5rem;
          color: #00ff88;
          text-shadow: 
            0 0 10px #00ff88,
            0 0 20px #00ff88,
            0 0 40px #00ff88;
          letter-spacing: 4px;
          margin: 0;
        }

        /* Winner Card */
        .winner-card {
          width: 100%;
          background: rgba(0, 255, 136, 0.05);
          border: 2px solid #ffcc00;
          border-radius: 8px;
          padding: 24px 28px;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: 
            0 0 20px rgba(255, 204, 0, 0.2),
            inset 0 0 30px rgba(255, 204, 0, 0.05);
        }

        .winner-crown {
          font-size: 2.5rem;
        }

        .winner-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .winner-label {
          font-size: 0.7rem;
          color: #ffcc00;
          letter-spacing: 2px;
          text-shadow: 0 0 10px #ffcc00;
        }

        .winner-name {
          font-size: 1.5rem;
          color: #00ff88;
          text-shadow: 0 0 10px #00ff88;
        }

        .winner-reason {
          font-size: 0.8rem;
          color: #ffcc00;
          margin-top: 4px;
          opacity: 0.9;
        }

        .winner-points {
          font-size: 0.9rem;
          color: #00ddff;
          text-shadow: 0 0 10px #00ddff;
        }

        /* Scores Card */
        .scores-card {
          width: 100%;
          background: rgba(0, 221, 255, 0.05);
          border: 2px solid #00ddff;
          border-radius: 8px;
          padding: 20px 24px;
          box-shadow: 0 0 20px rgba(0, 221, 255, 0.1);
        }

        .scores-title {
          font-size: 0.9rem;
          color: #00ddff;
          margin: 0 0 16px 0;
          letter-spacing: 2px;
          text-shadow: 0 0 10px #00ddff;
        }

        .scores-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .score-row {
          display: flex;
          align-items: center;
          padding: 12px 16px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.02);
          border: 2px solid rgba(0, 221, 255, 0.3);
          transition: all 0.3s ease;
        }

        .score-row:hover {
          background: rgba(255, 255, 255, 0.05);
          transform: translateX(5px);
        }

        .score-row.highlight {
          background: rgba(0, 255, 136, 0.1);
          border-color: #00ff88;
          box-shadow: 0 0 15px rgba(0, 255, 136, 0.2);
        }

        .score-rank {
          font-size: 1.3rem;
          margin-right: 12px;
          min-width: 35px;
          text-align: center;
        }

        .score-name {
          font-size: 0.9rem;
          color: #e0f0ff;
          flex: 1;
        }

        .you-badge {
          font-size: 0.6rem;
          background: rgba(0, 255, 136, 0.2);
          color: #00ff88;
          padding: 3px 8px;
          border-radius: 4px;
          margin-right: 15px;
          letter-spacing: 1px;
          border: 1px solid #00ff88;
        }

        .score-role {
          margin-left: auto;
          font-size: 0.8rem;
          color: #00ddff;
          opacity: 0.9;
        }

        /* Stats Card */
        .stats-card {
          width: 100%;
          background: rgba(221, 0, 255, 0.05);
          border: 2px solid #dd00ff;
          border-radius: 8px;
          padding: 20px 24px;
          box-shadow: 0 0 20px rgba(221, 0, 255, 0.1);
        }

        .stats-title {
          font-size: 0.9rem;
          color: #dd00ff;
          margin: 0 0 12px 0;
          letter-spacing: 2px;
          text-shadow: 0 0 10px #dd00ff;
        }

        .stat-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          font-size: 0.85rem;
          border-bottom: 1px solid rgba(221, 0, 255, 0.2);
        }

        .stat-row:last-child {
          border-bottom: none;
        }

        .stat-label {
          color: #888;
        }

        .stat-value {
          color: #dd00ff;
          text-shadow: 0 0 5px #dd00ff;
        }

        /* Buttons */
        .result-buttons {
          width: 100%;
          display: flex;
          gap: 12px;
        }

        .btn-play-again {
          flex: 1;
          padding: 16px 24px;
          border: none;
          border-radius: 6px;
          font-family: 'Press Start 2P', 'Courier New', monospace;
          font-size: 0.85rem;
          font-weight: bold;
          cursor: pointer;
          background: linear-gradient(135deg, #00ff88, #00cc6a);
          color: #0a0e27;
          letter-spacing: 1px;
          transition: all 0.3s ease;
          box-shadow: 0 0 20px rgba(0, 255, 136, 0.3);
        }

        .btn-play-again:hover {
          transform: translateY(-3px);
          box-shadow: 0 0 30px rgba(0, 255, 136, 0.5);
        }

        .btn-leave {
          flex: 1;
          padding: 16px 24px;
          border: 2px solid #ff3366;
          border-radius: 6px;
          font-family: 'Press Start 2P', 'Courier New', monospace;
          font-size: 0.85rem;
          font-weight: bold;
          cursor: pointer;
          background: transparent;
          color: #ff3366;
          letter-spacing: 1px;
          transition: all 0.3s ease;
        }

        .btn-leave:hover {
          background: rgba(255, 51, 102, 0.1);
          box-shadow: 0 0 20px rgba(255, 51, 102, 0.3);
          transform: translateY(-3px);
        }

        @keyframes glow-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }

        @media (max-width: 600px) {
          .game-over-title {
            font-size: 1.8rem;
          }
          
          .result-buttons {
            flex-direction: column;
          }
          
          .winner-name {
            font-size: 1.2rem;
          }
        }
      `}</style>
    </div>
  );
}

export default Result;
