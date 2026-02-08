// Landing page
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
  const floatingShapesRef = useRef([]);

  useEffect(() => {
    socket.connect();
    
    // Random glitch effect
    const glitchInterval = setInterval(() => {
      setGlitchActive(true);
      setTimeout(() => setGlitchActive(false), 200);
    }, 8000);

    // Initialize floating shapes
    floatingShapesRef.current = [
      { type: 'star', x: 85, y: 15, duration: 20 },
      { type: 'cube', x: 90, y: 65, duration: 25 },
      { type: 'hex', x: 15, y: 80, duration: 18 },
      { type: 'circle', x: 18, y: 45, duration: 22 },
    ];
    
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
    <div style={styles.container}>
      {/* Floating Shapes */}
      {floatingShapesRef.current.map((shape, index) => (
        <div
          key={index}
          style={{
            ...styles.floatingShape,
            left: `${shape.x}%`,
            top: `${shape.y}%`,
            animation: `float ${shape.duration}s ease-in-out infinite`,
          }}
        >
          {shape.type === 'star' && '⭐'}
          {shape.type === 'cube' && '🟥'}
          {shape.type === 'hex' && '⬡'}
          {shape.type === 'circle' && '🟣'}
        </div>
      ))}

      {/* System Status Badge */}
      <div style={styles.systemStatus}>
        <span style={styles.statusSquare}>■</span>
        SYSTEM ONLINE
      </div>

      {/* Main Content */}
      <div style={styles.mainContent}>
        {/* Logo Section */}
        <div style={styles.logoSection}>
          <h1 style={{
            ...styles.logo,
            ...(glitchActive ? styles.logoGlitch : {})
          }}>
            CODERED
          </h1>
          <div style={styles.logoDots}>
            <span style={styles.dotRed}>●</span>
            <span style={styles.dotRed}>●</span>
            <span style={styles.dotRed}>●</span>
            <span style={styles.dotRed}>●</span>
            <span style={styles.dotRed}>●</span>
          </div>
          <p style={styles.tagline}>COMPETITIVE CODING ARENA</p>
        </div>

        {/* Action Buttons */}
        <div style={styles.buttonContainer}>
          <button 
            style={styles.createButton}
            onClick={() => setShowCreateModal(true)}
          >
            + CREATE ROOM
          </button>
          <button 
            style={styles.joinButton}
            onClick={() => setShowJoinModal(true)}
          >
            {'{">"}'} JOIN ROOM
          </button>
        </div>

        {/* Pixel Art Icon */}
        <div style={styles.pixelIcon}>
          <div style={styles.pixelIconInner}>⚠</div>
        </div>

        {/* Semicolon Tagline */}
        <p style={styles.semicolonText}>
          WHERE EVERY <span style={styles.semicolonHighlight}>;</span> COUNTS
        </p>
        
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div style={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>CREATE ROOM</h2>
              <button style={styles.closeButton} onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <div style={styles.modalBody}>
              <label style={styles.label}>YOUR NAME</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                style={styles.input}
                maxLength={20}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateRoom()}
                autoFocus
              />
              {error && <div style={styles.error}>{error}</div>}
              <button onClick={handleCreateRoom} style={styles.modalButton}>
                CREATE ROOM
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join Room Modal */}
      {showJoinModal && (
        <div style={styles.modalOverlay} onClick={() => setShowJoinModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>JOIN ROOM</h2>
              <button style={styles.closeButton} onClick={() => setShowJoinModal(false)}>×</button>
            </div>
            <div style={styles.modalBody}>
              <label style={styles.label}>YOUR NAME</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                style={styles.input}
                maxLength={20}
                autoFocus
              />
              <label style={styles.label}>ROOM CODE</label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Enter 6-character code"
                style={styles.input}
                maxLength={6}
                onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
              />
              {error && <div style={styles.error}>{error}</div>}
              <button 
                onClick={handleJoinRoom} 
                style={styles.modalButton}
                disabled={isJoining}
              >
                {isJoining ? 'JOINING...' : 'JOIN ROOM'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'radial-gradient(ellipse at center, #1a1d3a 0%, #0a0d1f 70%, #000000 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: '"Press Start 2P", "Courier New", monospace',
    imageRendering: 'pixelated'
  },
  floatingShape: {
    position: 'absolute',
    fontSize: '24px',
    opacity: 0.4,
    zIndex: 0,
    pointerEvents: 'none'
  },
  systemStatus: {
    position: 'absolute',
    top: '30px',
    left: '30px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: '#00ff00',
    fontSize: '10px',
    fontWeight: '400',
    letterSpacing: '2px',
    textShadow: '0 0 10px #00ff00'
  },
  statusSquare: {
    fontSize: '12px',
    color: '#00ff00',
    animation: 'pulse 2s infinite'
  },
  mainContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    zIndex: 1
  },
  logoSection: {
    textAlign: 'center',
    marginBottom: '60px'
  },
  logo: {
    fontSize: '72px',
    fontWeight: '400',
    letterSpacing: '12px',
    margin: '0',
    color: '#ffffff',
    textShadow: `
      0 0 5px #fff,
      0 0 10px #fff,
      0 0 20px #ff0000,
      0 0 30px #ff0000,
      0 0 40px #ff0000,
      2px 2px 0px #ff0000,
      -2px -2px 0px #00ffff
    `,
    fontFamily: '"Press Start 2P", monospace',
    filter: 'contrast(1.2)',
    transform: 'scaleY(1.1)'
  },
  logoGlitch: {
    animation: 'glitch 0.3s infinite',
    textShadow: `
      2px 0 #ff0000,
      -2px 0 #00ffff,
      0 0 20px #ff0000
    `
  },
  logoDots: {
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
    margin: '20px 0',
    fontSize: '12px'
  },
  dotRed: {
    color: '#ff0000',
    textShadow: '0 0 10px #ff0000'
  },
  tagline: {
    fontSize: '11px',
    letterSpacing: '3px',
    color: '#00ff88',
    fontWeight: '400',
    textTransform: 'uppercase'
  },
  buttonContainer: {
    display: 'flex',
    gap: '30px',
    marginBottom: '60px',
    flexWrap: 'wrap',
    justifyContent: 'center'
  },
  createButton: {
    padding: '18px 35px',
    fontSize: '12px',
    fontWeight: '400',
    letterSpacing: '2px',
    color: '#ffffff',
    backgroundColor: '#ff3333',
    border: '3px solid #ff0000',
    borderRadius: '0',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 0 20px rgba(255, 0, 0, 0.5), inset 0 0 20px rgba(255, 255, 255, 0.1)',
    textTransform: 'uppercase',
    fontFamily: '"Press Start 2P", monospace',
    position: 'relative',
    textShadow: '2px 2px 0px rgba(0, 0, 0, 0.5)'
  },
  joinButton: {
    padding: '18px 35px',
    fontSize: '12px',
    fontWeight: '400',
    letterSpacing: '2px',
    color: '#00ff88',
    backgroundColor: 'transparent',
    border: '3px solid #00ff88',
    borderRadius: '0',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 0 20px rgba(0, 255, 136, 0.3)',
    textTransform: 'uppercase',
    fontFamily: '"Press Start 2P", monospace',
    textShadow: '0 0 10px #00ff88'
  },
  pixelIcon: {
    width: '80px',
    height: '80px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '30px',
    position: 'relative'
  },
  pixelIconInner: {
    fontSize: '48px',
    color: '#ff0000',
    background: 'rgba(255, 0, 0, 0.1)',
    borderRadius: '12px',
    padding: '15px',
    border: '2px solid #ff0000',
    boxShadow: '0 0 20px rgba(255, 0, 0, 0.4), inset 0 0 20px rgba(255, 0, 0, 0.2)',
    filter: 'drop-shadow(0 0 10px #ff0000)'
  },
  semicolonText: {
    fontSize: '14px',
    color: '#ffffff',
    marginBottom: '50px',
    fontWeight: '400',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    fontFamily: '"Press Start 2P", monospace'
  },
  semicolonHighlight: {
    color: '#ff0000',
    textShadow: '0 0 10px #ff0000',
    fontSize: '18px',
    fontWeight: 'bold'
  },
  stats: {
    display: 'flex',
    gap: '80px',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center'
  },
  stat: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '10px',
    color: '#ffffff',
    letterSpacing: '1.5px',
    fontWeight: '400',
    textTransform: 'uppercase'
  },
  statDotGreen: {
    fontSize: '14px',
    color: '#00ff00',
    textShadow: '0 0 10px #00ff00'
  },
  statIcon: {
    fontSize: '16px'
  },
  statNumber: {
    color: '#ffffff',
    fontWeight: '400',
    fontSize: '12px',
    textShadow: '0 0 5px #ffffff'
  },
  footer: {
    position: 'absolute',
    bottom: '40px',
    fontSize: '10px',
    letterSpacing: '3px',
    color: 'rgba(255, 255, 255, 0.4)',
    fontWeight: '400',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
    textTransform: 'uppercase'
  },
  arrow: {
    fontSize: '16px',
    animation: 'bounce 2s infinite'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(10px)'
  },
  modal: {
    backgroundColor: '#1a1d3a',
    border: '3px solid #00ff88',
    borderRadius: '0',
    width: '90%',
    maxWidth: '500px',
    boxShadow: '0 0 40px rgba(0, 255, 136, 0.4), inset 0 0 40px rgba(0, 255, 136, 0.05)'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '24px',
    borderBottom: '2px solid #00ff88',
    backgroundColor: 'rgba(0, 255, 136, 0.05)'
  },
  modalTitle: {
    fontSize: '16px',
    fontWeight: '400',
    color: '#00ff88',
    margin: 0,
    letterSpacing: '3px',
    fontFamily: '"Press Start 2P", monospace',
    textShadow: '0 0 10px #00ff88'
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '28px',
    color: '#ff3333',
    cursor: 'pointer',
    padding: 0,
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'color 0.2s',
    fontFamily: 'Arial, sans-serif'
  },
  modalBody: {
    padding: '32px 24px'
  },
  label: {
    display: 'block',
    fontSize: '10px',
    fontWeight: '400',
    color: '#00ff88',
    marginBottom: '12px',
    marginTop: '20px',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    fontFamily: '"Press Start 2P", monospace'
  },
  input: {
    width: '100%',
    padding: '16px',
    fontSize: '14px',
    backgroundColor: 'rgba(0, 255, 136, 0.05)',
    border: '2px solid #00ff88',
    borderRadius: '0',
    outline: 'none',
    transition: 'all 0.3s',
    color: '#ffffff',
    fontFamily: '"Courier New", monospace',
    boxSizing: 'border-box',
    boxShadow: 'inset 0 0 10px rgba(0, 255, 136, 0.1)'
  },
  error: {
    padding: '16px',
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    color: '#ff3333',
    border: '2px solid #ff0000',
    borderRadius: '0',
    fontSize: '10px',
    marginTop: '20px',
    fontFamily: '"Press Start 2P", monospace',
    lineHeight: '1.6',
    textShadow: '0 0 5px #ff0000'
  },
  modalButton: {
    width: '100%',
    padding: '18px 24px',
    fontSize: '12px',
    fontWeight: '400',
    letterSpacing: '2px',
    color: '#ffffff',
    backgroundColor: '#ff3333',
    border: '3px solid #ff0000',
    borderRadius: '0',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    marginTop: '28px',
    boxShadow: '0 0 20px rgba(255, 0, 0, 0.5)',
    textTransform: 'uppercase',
    fontFamily: '"Press Start 2P", monospace',
    textShadow: '2px 2px 0px rgba(0, 0, 0, 0.5)'
  }
};

export default Landing;
