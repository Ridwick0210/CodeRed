import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import socket from "../socket";
import CodeEditor from "../components/CodeEditor";
import { Bell, LogOut } from "lucide-react";
import RoleReveal from "../components/RoleReveal";
import VoteModal from "../components/VoteModal";

function Game() {
  const navigate = useNavigate();
  const location = useLocation();
  const { roomCode, playerId, playerName, room: initialRoom } = location.state || {};

  const [room, setRoom] = useState(initialRoom);
  const [code, setCode] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(90);
  const [buzzedPlayerName, setBuzzedPlayerName] = useState(null);
  const [buzzedPlayerId, setBuzzedPlayerId] = useState(null);
  const [showVoteModal, setShowVoteModal] = useState(false);
  const [voteData, setVoteData] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [voteTimeRemaining, setVoteTimeRemaining] = useState(60);
  const [feedback, setFeedback] = useState(null);
  const [showRoleReveal, setShowRoleReveal] = useState(true);

  // Refs for values that change often but are read inside event handlers
  const codeRef = useRef(code);
  const roomRef = useRef(room);
  useEffect(() => { codeRef.current = code; }, [code]);
  useEffect(() => { roomRef.current = room; }, [room]);

  // Debounced submitBug — only for server state tracking, not real-time sync
  const submitBugTimerRef = useRef(null);
  const debouncedSubmitBug = useCallback((newCode) => {
    if (submitBugTimerRef.current) clearTimeout(submitBugTimerRef.current);
    submitBugTimerRef.current = setTimeout(() => {
      socket.emit("submitBug", { buggedCode: newCode });
    }, 500);
  }, []);

  // Initialize code from room on first render
  useEffect(() => {
    if (room?.currentCode) {
      setCode(room.currentCode.initialBuggyCode || room.currentCode.correctCode);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!roomCode || !playerId) {
      navigate("/");
      return;
    }

    // Make socket available to CodeEditor
    window.gameSocket = socket;

    const handleTimerUpdate = ({ remaining }) => {
      setTimeRemaining(remaining);
    };

    const handlePlayerBuzzed = ({ playerId: buzzerId, playerName: buzzerName, vote }) => {
      setBuzzedPlayerName(buzzerName);
      setBuzzedPlayerId(buzzerId);
      
      // Show vote modal for ALL players
      if (vote) {
        setVoteData(vote);
        setShowVoteModal(true);
        setHasVoted(false);
      }
    };

    const handleFixSubmitted = ({ playerId: submitterId, isCorrect, correctCode, bugDescription }) => {
      setFeedback({ isCorrect, correctCode, bugDescription, submittedBy: submitterId });
      setBuzzedPlayerName(null);
      setTimeout(() => setFeedback(null), 5000);
    };

    const handleRoundEnded = ({ room: updatedRoom }) => {
      setRoom(updatedRoom);
    };

    const handleRoundStarted = ({ room: updatedRoom }) => {
      setRoom(updatedRoom);
      setBuzzedPlayerName(null);
      setBuzzedPlayerId(null);
      setShowVoteModal(false);
      setVoteData(null);
      setHasVoted(false);
      setFeedback(null);
      if (updatedRoom.currentCode) {
        setCode(updatedRoom.currentCode.initialBuggyCode || updatedRoom.currentCode.correctCode);
      }
    };

    const handleGameEnded = ({ room: updatedRoom, winner, reason }) => {
      navigate("/result", {
        state: { roomCode, playerId, playerName, room: updatedRoom, winner, reason },
      });
    };

    const handlePlayerLeft = ({ room: updatedRoom }) => {
      setRoom(updatedRoom);
    };

    const handleVoteTimeUpdate = ({ remaining }) => {
      setVoteTimeRemaining(remaining);
    };

    const handleBuzzVoteUpdated = ({ vote }) => {
      setVoteData(vote);
    };

    const handleBuzzVoteEnded = ({ shouldKick, kickedPlayerName, room: updatedRoom }) => {
      setShowVoteModal(false);
      setVoteData(null);
      setHasVoted(false);
      setBuzzedPlayerName(null);
      setBuzzedPlayerId(null);
      setRoom(updatedRoom);
      
      if (shouldKick && kickedPlayerName) {
        // Show notification that player was kicked
        setFeedback({ 
          isCorrect: false, 
          message: `${kickedPlayerName} was voted out!`,
          submittedBy: null 
        });
        setTimeout(() => setFeedback(null), 3000);
      }
    };

    socket.on("timerUpdate", handleTimerUpdate);
    socket.on("playerBuzzed", handlePlayerBuzzed);
    socket.on("fixSubmitted", handleFixSubmitted);
    socket.on("roundEnded", handleRoundEnded);
    socket.on("roundStarted", handleRoundStarted);
    socket.on("gameEnded", handleGameEnded);
    socket.on("playerLeft", handlePlayerLeft);
    socket.on("voteTimeUpdate", handleVoteTimeUpdate);
    socket.on("buzzVoteUpdated", handleBuzzVoteUpdated);
    socket.on("buzzVoteEnded", handleBuzzVoteEnded);

    return () => {
      socket.off("timerUpdate", handleTimerUpdate);
      socket.off("playerBuzzed", handlePlayerBuzzed);
      socket.off("fixSubmitted", handleFixSubmitted);
      socket.off("roundEnded", handleRoundEnded);
      socket.off("roundStarted", handleRoundStarted);
      socket.off("gameEnded", handleGameEnded);
      socket.off("playerLeft", handlePlayerLeft);
      socket.off("voteTimeUpdate", handleVoteTimeUpdate);
      socket.off("buzzVoteUpdated", handleBuzzVoteUpdated);
      socket.off("buzzVoteEnded", handleBuzzVoteEnded);
      
      // Cleanup global socket reference
      if (window.gameSocket) {
        delete window.gameSocket;
      }
    };
  }, [roomCode, playerId, playerName, navigate]);

  const getCurrentPlayer = () => {
    return room?.players.find((p) => p.id === playerId);
  };

  const handleBuzz = () => {
    socket.emit('buzz', (response) => {
      if (!response.success) {
        alert(response.error || 'Failed to buzz');
      }
    });
  };

  const handleCastVote = (targetPlayerId) => {
    socket.emit('castBuzzVote', { targetPlayerId }, (response) => {
      if (!response.success) {
        alert(response.error || 'Failed to vote');
      } else {
        setHasVoted(true);
      }
    });
  };

  const handleSkipVote = () => {
    socket.emit('castBuzzVote', { targetPlayerId: 'skip' }, (response) => {
      if (!response.success) {
        alert(response.error || 'Failed to skip');
      } else {
        setHasVoted(true);
      }
    });
  };



  const handleCodeChange = (newCode) => {
    setCode(newCode);
    // Only bugger needs to update server state (debounced, not real-time — Yjs handles sync)
    const currentPlayer = roomRef.current?.players.find((p) => p.id === playerId);
    if (currentPlayer?.role === "bugger") {
      debouncedSubmitBug(newCode);
    }
  };

  const handleLeaveRoom = () => {
    if (window.confirm('Are you sure you want to leave the game?')) {
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
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (!room) {
    return (
      <div className="game-container">
        <div className="loading">Loading game...</div>
        <style jsx>{`
          .game-container {
            min-height: 100vh;
            background: linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%);
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .loading {
            color: #00ff88;
            font-size: 20px;
            font-family: 'Share Tech Mono', monospace;
          }
        `}</style>
      </div>
    );
  }

  const currentPlayer = getCurrentPlayer();
  const isBugger = currentPlayer?.role === 'bugger';
  const isDisabled = currentPlayer?.disabled;
  const canBuzz = !isBugger && !buzzedPlayerName && !isDisabled;
  
  // Get bug assignment for current debugger (bugAssignments is now a plain object)
  const myBugAssignment = room.currentCode?.bugAssignments?.[playerId];
  const bugsList = myBugAssignment ? [
    { 
      id: myBugAssignment.id, 
      title: myBugAssignment.description, 
      location: myBugAssignment.location,
      difficulty: myBugAssignment.difficulty 
    }
  ] : [];

  const playerColors = ['#00ddff', '#00ff88', '#dd00ff', '#ffcc00', '#ff9900', '#ff3366'];

  return (
    <div className="game-container">
      {/* Role Reveal Animation */}
      {showRoleReveal && currentPlayer?.role && (
        <RoleReveal 
          role={currentPlayer.role} 
          onComplete={() => setShowRoleReveal(false)} 
        />
      )}
      
      <div className="top-bar">
        <div className="left">
          <span className="title">CODERED</span>
          <span className="status">● ROUND {room.currentRound}/{room.totalRounds}</span>
        </div>
        <div className="right">
          <span className="room-code">ROOM: #{roomCode}</span>
          <span className={`role-badge ${isBugger ? 'bugger' : 'debugger'}`}>
            {isBugger ? 'BUGGER' : 'DEBUGGER'}
          </span>
          {isDisabled && <span className="disabled-badge">❌ DISABLED</span>}
        </div>
      </div>

      <div className="game-header">
        <div className="timer-display">
          <span className="timer-icon">⏱</span>
          <span className="timer-text">{formatTime(timeRemaining)}</span>
        </div>

        <div className="header-right">
          <div className="players-display">
            {room.players.slice(0, 6).map((player, idx) => (
              <div
                key={player.id}
                className={`player-dot ${player.disabled ? 'disabled' : ''}`}
                style={{ backgroundColor: player.disabled ? '#666' : playerColors[idx] }}
                title={`${player.name}${player.disabled ? ' (disabled)' : ''}`}
              />
            ))}
          </div>

          <div className="bugs-counter">
            <span className="bug-emoji">🐛</span>
            <span className="count">{bugsList.length}</span>
            <span className="label">BUGS</span>
          </div>
        </div>
      </div>

      <div className="main-content">
        <div className="left-panel">
          <div className="bugs-panel">
            <div className="panel-header">
              <span className="icon">🐛</span>
              <span>CURRENT BUG</span>
            </div>
            <div className="bugs-list">
              {bugsList.map(bug => (
                <div key={bug.id} className="bug-item">
                  <div className="bug-info">
                    <div className="bug-title">{bug.title}</div>
                    <div className="bug-location">in {bug.location}</div>
                  </div>
                </div>
              ))}
              {bugsList.length === 0 && (
                <div className="no-bugs">No bugs to display</div>
              )}
            </div>
          </div>

          {isBugger && (
            <div className="tools-panel">
              <div className="panel-header purple">
                <span className="icon">🔧</span>
                <span>BUGGER TOOLS</span>
              </div>
              <div className="tools-content">
                <p className="tools-text">Edit the code to introduce subtle bugs:</p>
                <div className="tool-info">
                  <span className="info-icon">💡</span>
                  <span>Real-time editing enabled</span>
                </div>
              </div>
            </div>
          )}

          {!isBugger && !isDisabled && (
            <div className="info-panel">
              <div className="panel-header">
                <span>GAME INFO</span>
              </div>
              <div className="info-content">
                <div className="info-item">
                  <span className="info-label">Your Role:</span>
                  <span className="info-value">Debugger</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Status:</span>
                  <span className="info-value">{buzzedPlayerName ? 'Voting...' : 'Active'}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="center-panel">
          <div className="code-editor-container">
            {room.currentCode && (
              <CodeEditor
                code={code}
                onChange={handleCodeChange}
                readOnly={false}
                language={room.currentCode.language}
                height="calc(100vh - 180px)"
                roomCode={roomCode}
                playerId={playerId}
                playerName={playerName}
                playerColor={playerColors[room.players.findIndex(p => p.id === playerId) % playerColors.length]}
                playerRole={currentPlayer?.role}
              />
            )}
          </div>
        </div>
      </div>

      {!isBugger && !isDisabled && (
        <div className="buzzer-section">
          <button
            className={`buzzer-button ${!canBuzz ? 'disabled' : ''}`}
            onClick={handleBuzz}
            disabled={!canBuzz}
          >
            <Bell size={40} />
          </button>
          <div className="buzzer-text">
            {buzzedPlayerName 
              ? `${buzzedPlayerName} buzzed!` 
              : 'Press to start voting'}
          </div>
          <button className="leave-btn" onClick={handleLeaveRoom}>
            <LogOut size={18} />
            LEAVE ROOM
          </button>
        </div>
      )}

      {/* Vote Modal Component */}
      <VoteModal
        isOpen={showVoteModal}
        voteData={voteData}
        voteTimeRemaining={voteTimeRemaining}
        buzzedPlayerName={buzzedPlayerName}
        players={room.players}
        currentPlayerId={playerId}
        isDisabled={isDisabled}
        hasVoted={hasVoted}
        onCastVote={handleCastVote}
        onSkipVote={handleSkipVote}
      />

      {/* Feedback */}
      {feedback && (
        <div className={`feedback ${feedback.isCorrect ? 'success' : 'error'}`}>
          <div className="feedback-title">
            {feedback.isCorrect ? '✅ Correct Fix!' : feedback.message ? '📢' : '❌ Incorrect Fix'}
          </div>
          <div className="feedback-text">
            {feedback.message || (
              <><strong>Bug:</strong> {feedback.bugDescription}</>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');

        .game-container {
          min-height: 100vh;
          background: linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%);
          color: #00ff88;
          font-family: 'Share Tech Mono', monospace;
          position: relative;
          overflow: hidden;
        }

        .top-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px 30px;
          border-bottom: 2px solid #00ff88;
          background: rgba(0, 255, 136, 0.05);
        }

        .top-bar .left {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .top-bar .title {
          font-size: 20px;
          font-weight: bold;
          letter-spacing: 2px;
          color: #00ff88;
          text-shadow: 0 0 10px #00ff88;
        }

        .top-bar .status {
          font-size: 12px;
          color: #00ddff;
        }

        .top-bar .right {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .top-bar .room-code {
          font-size: 14px;
          color: #999;
        }

        .top-bar .role-badge {
          padding: 5px 15px;
          border-radius: 3px;
          font-size: 12px;
          font-weight: bold;
        }

        .top-bar .role-badge.bugger {
          background: #ff3366;
          color: #fff;
        }

        .top-bar .role-badge.debugger {
          background: #00ff88;
          color: #0a0e27;
        }

        .top-bar .disabled-badge {
          background: #666;
          color: #fff;
          padding: 5px 15px;
          border-radius: 3px;
          font-size: 12px;
        }

        .game-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 15px 20px;
          gap: 20px;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .main-content {
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 20px;
          padding: 20px;
          height: calc(100vh - 140px);
        }

        .left-panel {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .bugs-panel, .tools-panel, .info-panel {
          border: 2px solid #00ff88;
          border-radius: 8px;
          background: rgba(0, 255, 136, 0.05);
          overflow: hidden;
        }

        .tools-panel {
          border-color: #dd00ff;
          background: rgba(221, 0, 255, 0.05);
        }

        .panel-header {
          background: rgba(0, 255, 136, 0.1);
          padding: 12px 15px;
          display: flex;
          align-items: center;
          gap: 10px;
          border-bottom: 2px solid #00ff88;
          font-size: 12px;
          font-weight: bold;
          letter-spacing: 1px;
        }

        .panel-header.purple {
          background: rgba(221, 0, 255, 0.1);
          border-bottom-color: #dd00ff;
          color: #dd00ff;
        }

        .panel-header .icon {
          font-size: 16px;
        }

        .bugs-list {
          padding: 15px;
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .bug-item {
          display: flex;
          gap: 10px;
          align-items: flex-start;
        }

        .bug-icon {
          font-size: 20px;
          flex-shrink: 0;
        }

        .bug-info {
          flex: 1;
        }

        .bug-title {
          color: #00ff88;
          font-size: 11px;
          line-height: 1.4;
          margin-bottom: 3px;
        }

        .bug-location {
          color: #666;
          font-size: 10px;
        }

        .no-bugs {
          color: #666;
          font-size: 11px;
          text-align: center;
          padding: 20px;
        }

        .tools-content, .info-content {
          padding: 15px;
        }

        .tools-text {
          color: #999;
          font-size: 11px;
          margin-bottom: 15px;
          line-height: 1.5;
        }

        .tool-info {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #dd00ff;
          font-size: 10px;
        }

        .info-icon {
          font-size: 14px;
        }

        .info-item {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid rgba(0, 255, 136, 0.1);
          font-size: 11px;
        }

        .info-label {
          color: #999;
        }

        .info-value {
          color: #00ff88;
          font-weight: bold;
        }

        .center-panel {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .timer-display {
          border: 2px solid #00ddff;
          border-radius: 8px;
          padding: 10px 25px;
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(0, 221, 255, 0.05);
        }

        .timer-icon {
          font-size: 20px;
        }

        .timer-text {
          font-size: 24px;
          font-weight: bold;
          color: #00ddff;
          letter-spacing: 2px;
        }

        .code-editor-container {
          flex: 1;
          border: 2px solid #00ff88;
          border-radius: 8px;
          overflow: hidden;
          background: #1e1e1e;
        }

        .players-display {
          display: flex;
          gap: 8px;
        }

        .player-dot {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.3);
          box-shadow: 0 0 10px currentColor;
          transition: all 0.3s ease;
        }

        .player-dot.disabled {
          opacity: 0.3;
          box-shadow: none;
        }

        .bugs-counter {
          border: 2px solid #ffcc00;
          border-radius: 8px;
          padding: 8px 20px;
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 204, 0, 0.05);
        }

        .bugs-counter .bug-emoji {
          font-size: 20px;
        }

        .bugs-counter .count {
          font-size: 20px;
          font-weight: bold;
          color: #ffcc00;
        }

        .bugs-counter .label {
          font-size: 12px;
          color: #ffcc00;
          letter-spacing: 1px;
        }

        .buzzer-section {
          position: fixed;
          bottom: 30px;
          left: 30px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 15px;
          z-index: 100;
        }

        .buzzer-button {
          width: 120px;
          height: 120px;
          border-radius: 50%;
          border: 4px solid #ff3366;
          background: radial-gradient(circle, #ff6b6b 0%, #ff3366 50%, #cc0033 100%);
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
          box-shadow: 0 0 40px rgba(255, 51, 102, 0.6),
                      inset 0 0 20px rgba(255, 255, 255, 0.2);
        }

        .buzzer-button:hover:not(.disabled) {
          transform: scale(1.05);
          box-shadow: 0 0 50px rgba(255, 51, 102, 0.8),
                      inset 0 0 25px rgba(255, 255, 255, 0.3);
        }

        .buzzer-button:active:not(.disabled) {
          transform: scale(0.95);
        }

        .buzzer-button.disabled {
          opacity: 0.5;
          cursor: not-allowed;
          background: #666;
          border-color: #444;
          box-shadow: none;
        }

        .buzzer-text {
          color: #999;
          font-size: 11px;
          text-align: center;
          max-width: 150px;
        }

        .leave-btn {
          background: transparent;
          border: 2px solid #ff3366;
          color: #ff3366;
          padding: 10px 20px;
          border-radius: 5px;
          font-family: 'Share Tech Mono', monospace;
          font-size: 11px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.3s ease;
        }

        .leave-btn:hover {
          background: rgba(255, 51, 102, 0.1);
          box-shadow: 0 0 15px rgba(255, 51, 102, 0.5);
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
          backdrop-filter: blur(10px);
        }

        .modal-content {
          background: #1a1f3a;
          border: 2px solid #00ff88;
          border-radius: 8px;
          padding: 30px;
          max-width: 800px;
          width: 100%;
          max-height: 90vh;
          overflow: auto;
        }

        .modal-content h2 {
          color: #00ff88;
          font-size: 24px;
          margin-bottom: 10px;
          text-shadow: 0 0 10px #00ff88;
        }

        .modal-content p {
          color: #999;
          font-size: 14px;
          margin-bottom: 20px;
        }

        .modal-actions {
          display: flex;
          gap: 15px;
          margin-top: 20px;
        }

        .submit-btn, .cancel-btn {
          flex: 1;
          padding: 15px;
          border-radius: 5px;
          font-family: 'Share Tech Mono', monospace;
          font-size: 14px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .submit-btn {
          background: #00ff88;
          border: none;
          color: #0a0e27;
        }

        .submit-btn:hover {
          box-shadow: 0 0 20px rgba(0, 255, 136, 0.5);
        }

        .cancel-btn {
          background: transparent;
          border: 2px solid #666;
          color: #999;
        }

        .cancel-btn:hover {
          border-color: #00ff88;
          color: #00ff88;
        }

        .feedback {
          position: fixed;
          top: 80px;
          right: 30px;
          padding: 20px;
          border-radius: 8px;
          max-width: 350px;
          z-index: 200;
          animation: slideIn 0.3s ease;
        }

        .feedback.success {
          background: rgba(0, 255, 136, 0.1);
          border: 2px solid #00ff88;
          color: #00ff88;
        }

        .feedback.error {
          background: rgba(255, 51, 102, 0.1);
          border: 2px solid #ff3366;
          color: #ff3366;
        }

        .feedback-title {
          font-size: 16px;
          font-weight: bold;
          margin-bottom: 10px;
        }

        .feedback-text {
          font-size: 12px;
          color: #999;
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @media (max-width: 1024px) {
          .main-content {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default Game;