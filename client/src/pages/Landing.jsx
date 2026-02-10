import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket';

function Landing() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [glitchActive, setGlitchActive] = useState(false);
  const navigate = useNavigate();
  
  const floatingShapesRef = useRef([
    { type: 'star', x: 85, y: 15, duration: 20 },
    { type: 'cube', x: 90, y: 65, duration: 25 },
    { type: 'hex', x: 15, y: 80, duration: 18 },
    { type: 'circle', x: 18, y: 45, duration: 22 },
  ]);

  useEffect(() => {
    socket.connect();
    
    // Random glitch effect
    const glitchInterval = setInterval(() => {
      setGlitchActive(true);
      setTimeout(() => setGlitchActive(false), 200);
    }, 8000);
    
    return () => {
      clearInterval(glitchInterval);
    };
  }, []);

  const handleCreateRoom = () => {
    if (!playerName.trim() || playerName.length < 2) {
      setError('Please enter a valid name (at least 2 characters)');
      return;
    }

    setError('');
    socket.emit('createRoom', { playerName: playerName.trim() }, (response) => {
      if (response.success) {
        // Cache for recovery
        localStorage.setItem('codeRed_roomCode', response.roomCode);
        localStorage.setItem('codeRed_playerId', response.playerId);
        localStorage.setItem('codeRed_playerName', playerName.trim());

        navigate('/lobby', {
          state: {
            roomCode: response.roomCode,
            playerId: response.playerId,
            playerName: playerName.trim(),
            isHost: true,
            room: response.room
          }
        });
      } else {
        setError(response.error || 'Failed to create room');
      }
    });
  };

  const handleJoinRoom = () => {
    if (!playerName.trim() || playerName.length < 2) {
      setError('Please enter a valid name (at least 2 characters)');
      return;
    }

    if (!roomCode.trim() || roomCode.length !== 6) {
      setError('Please enter a valid 6-character room code');
      return;
    }

    setError('');
    setIsJoining(true);

    socket.emit(
      'joinRoom',
      { roomCode: roomCode.toUpperCase(), playerName: playerName.trim() },
      (response) => {
        setIsJoining(false);
        if (response.success) {
          // Cache for recovery
          localStorage.setItem('codeRed_roomCode', roomCode.toUpperCase());
          localStorage.setItem('codeRed_playerId', response.playerId);
          localStorage.setItem('codeRed_playerName', playerName.trim());

          navigate('/lobby', {
            state: {
              roomCode: roomCode.toUpperCase(),
              playerId: response.playerId,
              playerName: playerName.trim(),
              isHost: false,
              room: response.room
            }
          });
        } else {
          setError(response.error || 'Failed to join room');
        }
      }
    );
  };

  return (
    <div className="landing-page">
      {/* Floating Shapes */}
      {floatingShapesRef.current.map((shape, index) => (
        <div
          key={index}
          className="floating-shape"
          style={{
            left: `${shape.x}%`,
            top: `${shape.y}%`,
            animationDuration: `${shape.duration}s`
          }}
        >
          {shape.type === 'star' && '⭐'}
          {shape.type === 'cube' && '🟥'}
          {shape.type === 'hex' && '⬡'}
          {shape.type === 'circle' && '🟣'}
        </div>
      ))}

      {/* System Status Badge */}
      <div className="system-status">
        <span className="status-square">■</span>
        SYSTEM ONLINE
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Logo Section */}
        <div className="logo-section">
          <h1 className={`logo ${glitchActive ? 'logo-glitch' : ''}`}>
            CODE<span className="logo-red">RED</span>
          </h1>
          <div className="logo-dots">
            <span className="dot-red">●</span>
            <span className="dot-red">●</span>
            <span className="dot-red">●</span>
            <span className="dot-red">●</span>
            <span className="dot-red">●</span>
          </div>
          <p className="tagline">COMPETITIVE CODING ARENA</p>
        </div>

        {/* Action Buttons */}
        <div className="button-container">
          <button 
            className="create-button"
            onClick={() => setShowCreateModal(true)}
          >
            + CREATE ROOM
          </button>
          <button 
            className="join-button"
            onClick={() => setShowJoinModal(true)}
          >
            {'>'} JOIN ROOM
          </button>
        </div>

        {/* Pixel Art Icon */}
        <div className="pixel-icon">
          <div className="pixel-icon-inner">⚠</div>
        </div>

        {/* Semicolon Tagline */}
        <p className="semicolon-text">
          WHERE EVERY <span className="semicolon-highlight">;</span> COUNTS
        </p>
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">CREATE ROOM</h2>
              <button className="close-button" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <label className="label">YOUR NAME</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                className="input"
                maxLength={20}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateRoom()}
                autoFocus
              />
              {error && <div className="error">{error}</div>}
              <button onClick={handleCreateRoom} className="modal-button">
                CREATE ROOM
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Room Modal */}
      {showJoinModal && (
        <div className="modal-overlay" onClick={() => setShowJoinModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">JOIN ROOM</h2>
              <button className="close-button" onClick={() => setShowJoinModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <label className="label">YOUR NAME</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                className="input"
                maxLength={20}
                autoFocus
              />
              <label className="label">ROOM CODE</label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Enter 6-character code"
                className="input"
                maxLength={6}
                onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
              />
              {error && <div className="error">{error}</div>}
              <button 
                onClick={handleJoinRoom} 
                className="modal-button"
                disabled={isJoining}
              >
                {isJoining ? 'JOINING...' : 'JOIN ROOM'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .landing-page {
          min-height: 100vh;
          background: radial-gradient(ellipse at center, #1a1d3a 0%, #0a0d1f 70%, #000000 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          font-family: 'Press Start 2P', 'Courier New', monospace;
          image-rendering: pixelated;
        }

        /* Floating Shapes */
        .floating-shape {
          position: absolute;
          font-size: 24px;
          opacity: 0.4;
          z-index: 0;
          pointer-events: none;
          animation: float ease-in-out infinite;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(10deg); }
        }

        /* System Status */
        .system-status {
          position: absolute;
          top: 30px;
          left: 30px;
          display: flex;
          align-items: center;
          gap: 10px;
          color: #00ff88;
          font-size: 10px;
          font-weight: 400;
          letter-spacing: 2px;
          text-shadow: 0 0 10px #00ff88;
        }

        .status-square {
          font-size: 12px;
          color: #00ff88;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        /* Main Content */
        .main-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          z-index: 1;
        }

        /* Logo Section */
        .logo-section {
          text-align: center;
          margin-bottom: 60px;
        }

        .logo {
          font-size: 72px;
          font-weight: 400;
          letter-spacing: 12px;
          margin: 0;
          color: #00ff88;
          text-shadow: 
            0 0 5px #00ff88,
            0 0 10px #00ff88,
            0 0 20px #00ff88,
            0 0 30px #00ff88,
            2px 2px 0px #00ff88;
          filter: contrast(1.2);
          transform: scaleY(1.1);
          animation: logoGlow 3s ease-in-out infinite;
        }

        .logo-red {
          color: #ff3366;
          text-shadow: 
            0 0 5px #ff3366,
            0 0 10px #ff3366,
            0 0 20px #ff3366,
            0 0 30px #ff3366,
            2px 2px 0px #ff3366;
        }

        @keyframes logoGlow {
          0%, 100% { 
            text-shadow: 
              0 0 5px #00ff88,
              0 0 10px #00ff88,
              0 0 20px #00ff88;
          }
          50% { 
            text-shadow: 
              0 0 10px #00ff88,
              0 0 20px #00ff88,
              0 0 40px #00ff88;
          }
        }

        .logo-glitch {
          animation: glitch 0.3s infinite;
        }

        @keyframes glitch {
          0% {
            text-shadow: 
              2px 0 #ff3366,
              -2px 0 #00ddff;
          }
          25% {
            text-shadow: 
              -2px 0 #ff3366,
              2px 0 #00ddff;
          }
          50% {
            text-shadow: 
              2px -2px #ff3366,
              -2px 2px #00ddff;
          }
          75% {
            text-shadow: 
              -2px -2px #ff3366,
              2px 2px #00ddff;
          }
          100% {
            text-shadow: 
              2px 0 #ff3366,
              -2px 0 #00ddff;
          }
        }

        .logo-dots {
          display: flex;
          justify-content: center;
          gap: 12px;
          margin: 20px 0;
          font-size: 12px;
        }

        .dot-red {
          color: #ff3366;
          text-shadow: 0 0 10px #ff3366;
          animation: dotPulse 2s ease-in-out infinite;
        }

        .dot-red:nth-child(1) { animation-delay: 0s; }
        .dot-red:nth-child(2) { animation-delay: 0.2s; }
        .dot-red:nth-child(3) { animation-delay: 0.4s; }
        .dot-red:nth-child(4) { animation-delay: 0.6s; }
        .dot-red:nth-child(5) { animation-delay: 0.8s; }

        @keyframes dotPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        .tagline {
          font-size: 11px;
          letter-spacing: 3px;
          color: #00ddff;
          font-weight: 400;
          text-transform: uppercase;
          text-shadow: 0 0 10px #00ddff;
        }

        /* Buttons */
        .button-container {
          display: flex;
          gap: 30px;
          margin-bottom: 60px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .create-button,
        .join-button {
          padding: 18px 35px;
          font-size: 12px;
          font-weight: 400;
          letter-spacing: 2px;
          border: 3px solid;
          border-radius: 0;
          cursor: pointer;
          transition: all 0.3s ease;
          text-transform: uppercase;
          font-family: 'Press Start 2P', monospace;
          position: relative;
          background: transparent;
        }

        .create-button {
          color: #ff3366;
          border-color: #ff3366;
          box-shadow: 0 0 20px rgba(255, 51, 102, 0.3);
        }

        .create-button:hover {
          background: #ff3366;
          color: #0a0d1f;
          box-shadow: 0 0 30px rgba(255, 51, 102, 0.6);
          transform: translateY(-2px);
        }

        .join-button {
          color: #00ff88;
          border-color: #00ff88;
          box-shadow: 0 0 20px rgba(0, 255, 136, 0.3);
        }

        .join-button:hover {
          background: #00ff88;
          color: #0a0d1f;
          box-shadow: 0 0 30px rgba(0, 255, 136, 0.6);
          transform: translateY(-2px);
        }

        /* Pixel Icon */
        .pixel-icon {
          width: 80px;
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 30px;
          position: relative;
        }

        .pixel-icon-inner {
          font-size: 48px;
          color: #ff3366;
          background: rgba(255, 51, 102, 0.1);
          border-radius: 12px;
          padding: 15px;
          border: 2px solid #ff3366;
          box-shadow: 0 0 20px rgba(255, 51, 102, 0.4), inset 0 0 20px rgba(255, 51, 102, 0.2);
          animation: iconPulse 3s ease-in-out infinite;
        }

        @keyframes iconPulse {
          0%, 100% { 
            box-shadow: 0 0 20px rgba(255, 51, 102, 0.4), inset 0 0 20px rgba(255, 51, 102, 0.2);
          }
          50% { 
            box-shadow: 0 0 40px rgba(255, 51, 102, 0.6), inset 0 0 30px rgba(255, 51, 102, 0.3);
          }
        }

        /* Semicolon Text */
        .semicolon-text {
          font-size: 14px;
          color: #ffffff;
          margin-bottom: 50px;
          font-weight: 400;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .semicolon-highlight {
          color: #ff3366;
          text-shadow: 0 0 10px #ff3366;
          font-size: 18px;
          font-weight: bold;
        }

        /* Modal */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(10px);
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .modal {
          background: rgba(15, 20, 35, 0.95);
          border: 3px solid #00ff88;
          border-radius: 0;
          width: 90%;
          max-width: 500px;
          box-shadow: 0 0 40px rgba(0, 255, 136, 0.4), inset 0 0 40px rgba(0, 255, 136, 0.05);
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from {
            transform: translateY(50px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px;
          border-bottom: 2px solid #00ff88;
          background: rgba(0, 255, 136, 0.05);
        }

        .modal-title {
          font-size: 16px;
          font-weight: 400;
          color: #00ff88;
          margin: 0;
          letter-spacing: 3px;
          text-shadow: 0 0 10px #00ff88;
        }

        .close-button {
          background: none;
          border: none;
          font-size: 28px;
          color: #ff3366;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s;
          font-family: Arial, sans-serif;
        }

        .close-button:hover {
          color: #fff;
          transform: rotate(90deg);
        }

        .modal-body {
          padding: 32px 24px;
        }

        .label {
          display: block;
          font-size: 10px;
          font-weight: 400;
          color: #00ff88;
          margin-bottom: 12px;
          margin-top: 20px;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .label:first-child {
          margin-top: 0;
        }

        .input {
          width: 100%;
          padding: 16px;
          font-size: 14px;
          background: rgba(0, 255, 136, 0.05);
          border: 2px solid #00ff88;
          border-radius: 0;
          outline: none;
          transition: all 0.3s;
          color: #ffffff;
          font-family: 'Courier New', monospace;
          box-sizing: border-box;
          box-shadow: inset 0 0 10px rgba(0, 255, 136, 0.1);
        }

        .input:focus {
          border-color: #00ddff;
          box-shadow: 0 0 20px rgba(0, 221, 255, 0.3), inset 0 0 10px rgba(0, 221, 255, 0.1);
        }

        .input::placeholder {
          color: rgba(255, 255, 255, 0.3);
        }

        .error {
          padding: 16px;
          background: rgba(255, 51, 102, 0.1);
          color: #ff3366;
          border: 2px solid #ff3366;
          border-radius: 0;
          font-size: 10px;
          margin-top: 20px;
          line-height: 1.6;
          text-shadow: 0 0 5px #ff3366;
          animation: shake 0.5s ease;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }

        .modal-button {
          width: 100%;
          padding: 18px 24px;
          font-size: 12px;
          font-weight: 400;
          letter-spacing: 2px;
          color: #ffffff;
          background: transparent;
          border: 3px solid #00ff88;
          border-radius: 0;
          cursor: pointer;
          transition: all 0.3s ease;
          margin-top: 28px;
          box-shadow: 0 0 20px rgba(0, 255, 136, 0.3);
          text-transform: uppercase;
          font-family: 'Press Start 2P', monospace;
        }

        .modal-button:hover:not(:disabled) {
          background: #00ff88;
          color: #0a0d1f;
          box-shadow: 0 0 30px rgba(0, 255, 136, 0.6);
          transform: translateY(-2px);
        }

        .modal-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .logo {
            font-size: 48px;
            letter-spacing: 8px;
          }

          .tagline {
            font-size: 9px;
          }

          .button-container {
            flex-direction: column;
            gap: 20px;
          }

          .create-button,
          .join-button {
            width: 100%;
            max-width: 300px;
          }

          .semicolon-text {
            font-size: 12px;
          }

          .system-status {
            font-size: 8px;
          }
        }
      `}</style>
    </div>
  );
}

export default Landing;