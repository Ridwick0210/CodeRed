import React, { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MessageCircle, Send, LogOut, AlertCircle } from "lucide-react";
import socket from "../socket";

/* ---------------- Constants ---------------- */

const COLORS = ['#00ff88', '#00ddff', '#dd00ff', '#ffcc00', '#ff9900', '#ff3366'];

const ROLES_INFO = [
  { 
    title: 'Fixers', 
    description: 'Write clean code and catch the bugger before time runs out',
    icon: '</>', 
    color: '#00ddff',
    bgColor: 'rgba(0, 221, 255, 0.05)'
  },
  { 
    title: 'SABOTEUR', 
    description: 'Inject subtle bugs and survive until the timer ends',
    icon: '🐛', 
    color: '#ff3366',
    bgColor: 'rgba(255, 51, 102, 0.05)'
  },
  { 
    title: 'TIMER', 
    description: '14 minutes to complete tasks and identify the bugger',
    icon: '⏱', 
    color: '#00ff88',
    bgColor: 'rgba(0, 255, 136, 0.05)'
  },
  { 
    title: 'BUZZER', 
    description: "Press to accuse and review code. Wrong? You're penalized!",
    icon: '🔔', 
    color: '#ffcc00',
    bgColor: 'rgba(255, 204, 0, 0.05)'
  }
];

/* ---------------- Helpers ---------------- */

function normalizeRoom(room) {
  if (!room) return null;

  return {
    ...room,
    players: Array.isArray(room.players)
      ? room.players
      : Array.from(room.players.values()),
    scores:
      room.scores instanceof Map
        ? Object.fromEntries(room.scores)
        : room.scores ?? {},
  };
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ---------------- Component ---------------- */

export default function GameLobby() {
  const navigate = useNavigate();
  const location = useLocation();
  const floatingShapesRef = useRef([
    { type: 'star', x: 85, y: 15, duration: 20 },
    { type: 'cube', x: 90, y: 65, duration: 25 },
    { type: 'hex', x: 15, y: 80, duration: 18 },
    { type: 'circle', x: 18, y: 45, duration: 22 },
  ]);

  // Initialize state from location or localStorage
  const [room, setRoom] = useState(location.state?.room || null);
  const [playerId, setPlayerId] = useState(location.state?.playerId || localStorage.getItem('codeRed_playerId'));
  const [playerName, setPlayerName] = useState(location.state?.playerName || localStorage.getItem('codeRed_playerName'));

  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState([]);

  const [readyLoading, setReadyLoading] = useState(false);
  const [startLoading, setStartLoading] = useState(false);
  const [connected, setConnected] = useState(socket.connected);
  const [error, setError] = useState("");

  /* ---------------- Derived State ---------------- */

  const players = useMemo(() => {
    if (!room?.players) return [];
    return room.players.map((p, idx) => {
      const color = COLORS[idx % COLORS.length];
      return {
        ...p,
        color,
        bgColor: hexToRgba(color, 0.1),
        border: color
      };
    });
  }, [room]);

  const me = players.find((p) => p.id === playerId);
  const isHost = me?.isHost === true;

  const readyCount = players.filter((p) => p.isReady).length;
  // const allPlayersReady = players.length >= 2 && players.every((p) => p.isReady); // Min 2 players logic
  const allPlayersReady = players.length > 0 && players.every(p => p.isReady); // User's logic (simplified)

  /* ---------------- Socket Lifecycle ---------------- */

  useEffect(() => {
    const roomCode = location.state?.roomCode || localStorage.getItem('codeRed_roomCode');
    const pid = location.state?.playerId || localStorage.getItem('codeRed_playerId');
    const pname = location.state?.playerName || localStorage.getItem('codeRed_playerName');

    if (!roomCode || !pid || !pname) {
      navigate("/");
      return;
    }

    // Update state if recovered from storage
    if (!playerId) setPlayerId(pid);
    if (!playerName) setPlayerName(pname);

    if (!socket.connected) {
      socket.connect();
    }
    setConnected(socket.connected);

    socket.on("connect", () => {
      setConnected(true);
      // Re-join logic if simple reconnect
      socket.emit('joinRoom', { roomCode, playerName: pname }, (res) => {
        if (res.success) {
           setRoom(normalizeRoom(res.room));
           setPlayerId(res.playerId); 
        } else {
           if (res.error === "Room not found") {
             navigate("/");
           }
        }
      });
    });

    socket.on("roomUpdated", ({ room }) => {
      setRoom(normalizeRoom(room));
    });

    socket.on("playerJoined", ({ player, room }) => {
      setRoom(normalizeRoom(room));
      setChatMessages((prev) => [
        ...prev,
        {
          username: "System",
          message: `${player.name} joined the lobby`,
          color: "#00ff88",
        },
      ]);
    });

    socket.on("playerLeft", ({ playerId: leftPlayerId, room }) => {
       if (room) setRoom(normalizeRoom(room));
      setChatMessages((prev) => [
        ...prev,
        {
          username: "System",
          message: "A player left the lobby",
          color: "#ff3366",
        },
      ]);
    });

    socket.on("chatMessage", (msg) => {
      setChatMessages((prev) => [...prev, msg]);
    });

    socket.on("gameStarted", ({ room }) => {
      navigate("/game", {
        state: {
          roomCode: room.code,
          room,
          playerId,
          playerName,
        },
      });
    });

    socket.on("disconnect", () => {
      setConnected(false);
      setError("Disconnected from server");
    });

    return () => socket.removeAllListeners();
  }, [navigate, location, playerId, playerName]);

  /* ---------------- Actions ---------------- */

  const handleToggleReady = () => {
    if (readyLoading) return;
    setReadyLoading(true);

    socket.emit("playerReady", (res) => {
      setReadyLoading(false);
      if (!res?.success) setError("Failed to update ready status");
    });
  };

  const handleStartGame = () => {
    if (!isHost || !allPlayersReady || startLoading) return;
    setStartLoading(true);

    socket.emit("startGame", (res) => {
      if (!res?.success) {
        setError(res?.error || "Failed to start game");
        setStartLoading(false);
      }
    });
  };

  const sendMessage = () => {
    if (!message.trim()) return;
    socket.emit("chatMessage", { message });
    setMessage("");
  };

  const handleExitLobby = () => {
    if (window.confirm('Are you sure you want to leave the lobby?')) {
      socket.disconnect();
      navigate("/");
    }
  };

  /* ---------------- UI ---------------- */

  return (
    <div className="game-lobby">

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

      {error && (
        <div className="error-banner">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={() => setError('')}>×</button>
        </div>
      )}

      <header className="lobby-header">
        <div className="logo">
          <span className="dev">CODE</span>
          <span className="hunter">RED</span>
        </div>
        <div className="header-room">
          <span className="room-label">ROOM:</span>
          <span className="room-code">{room?.code}</span>
          <span className={`connection-status ${connected ? 'connected' : 'disconnected'}`}></span>
        </div>
        <div className="header-controls">
          <button 
            className="boom-btn"
            disabled={!allPlayersReady || startLoading || !isHost}
            onClick={handleStartGame}
            title={!isHost ? 'Only host can start' : allPlayersReady ? 'Start the game' : 'Wait for all players'}
          >
            {startLoading ? 'STARTING...' : 'START GAME'}
          </button>
          <button 
            className="exit-btn"
            onClick={handleExitLobby}
            title="Leave the lobby"
          >
            <LogOut size={18} style={{ marginRight: '0.5rem' }} />
            EXIT
          </button>
        </div>
      </header>

      <div className="lobby-container">
        <div className="players-panel">
          <div className="panel-header">
            <h2>PLAYERS ({readyCount}/{players.length})</h2>
            <span className="player-count">{readyCount}/{players.length}</span>
          </div>
          <div className="players-list">
            {players.map((player) => (
              <div 
                key={player.id} 
                className={`player-card ${player.id === playerId ? 'current-player' : ''}`}
                style={{ 
                  borderColor: player.border,
                  background: player.bgColor
                }}
              >
                <div className="player-avatar" style={{ background: player.color }}>
                  {player.name.substring(0, 2).toUpperCase()}
                </div>
                <div className="player-info">
                  <div className="player-role" style={{ color: player.color }}>
                    {player.isHost ? 'HOST' : 'PLAYER'}
                  </div>
                  <div className="player-name">{player.name}</div>
                </div>
                <div 
                  className={`player-status ${player.isReady ? 'ready' : 'waiting'}`}
                  style={{ background: player.isReady ? '#00ff88' : '#666' }}
                  title={player.isReady ? 'Ready' : 'Not ready'}
                ></div>
              </div>
            ))}
          </div>
          {playerId && (
            <button 
              className={`ready-btn ${me?.isReady ? 'ready' : 'not-ready'}`}
              onClick={handleToggleReady}
            >
              {readyLoading ? 'UPDATING...' : (me?.isReady ? '✓ READY' : 'NOT READY')}
            </button>
          )}
        </div>

        <div className="lobby-panel">
          <div className="lobby-title-section">
            <h1 className="lobby-title">LOBBY</h1>
            <p className="lobby-subtitle">{allPlayersReady ? 'All players ready! Host can start.' : 'Waiting for players to ready up...'}</p>
          </div>

          <div className="roles-grid">
            {ROLES_INFO.map((role, idx) => (
              <div 
                key={idx} 
                className="role-card"
                style={{ 
                  borderColor: role.color,
                  background: role.bgColor
                }}
              >
                <div className="role-icon" style={{ color: role.color }}>
                  {role.icon}
                </div>
                <div className="role-content">
                  <h3 style={{ color: role.color }}>{role.title}</h3>
                  <p>{role.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="game-settings">
            <div className="settings-header">
              <span className="cursor-icon">🖱️</span>
              <h3>GAME SETTINGS</h3>
            </div>
            <div className="settings-row">
              <div className="setting">
                <span className="setting-label">MAX PLAYERS</span>
                <div className="setting-value">
                  <span className="setting-icon">👥</span>
                  <span>8</span>
                </div>
              </div>
              <div className="setting">
                <span className="setting-label">GAME MODE</span>
                <div className="setting-value mode-classic">CLASSIC</div>
              </div>
              <div className="setting">
                <span className="setting-label">DIFFICULTY</span>
                <div className="setting-value mode-medium">MEDIUM</div>
              </div>
            </div>
          </div>

          <div className="chat-section">
            <div className="chat-header">
              <MessageCircle size={20} />
              <h3>CHAT</h3>
            </div>
            <div className="chat-messages">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className="chat-message">
                  <span className="chat-username" style={{ color: msg.color }}>
                    {msg.username}:
                  </span>
                  <span className="chat-text">{msg.message}</span>
                </div>
              ))}
            </div>
            <div className="chat-input-wrapper">
              <input
                type="text"
                placeholder="Type message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                className="chat-input"
              />
              <button onClick={sendMessage} className="send-btn">
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap');

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .game-lobby {
          min-height: 100vh;
          background: radial-gradient(ellipse at center, #1a1d3a 0%, #0a0d1f 70%, #000000 100%);
          color: #fff;
          font-family: 'Share Tech Mono', monospace;
          position: relative;
          overflow: hidden;
        }

        /* Error Banner */
        .error-banner {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: rgba(255, 51, 102, 0.9);
          border-bottom: 2px solid #ff3366;
          padding: 1rem 2rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          z-index: 100;
          animation: slideDown 0.3s ease;
        }

        @keyframes slideDown {
          from {
            transform: translateY(-100%);
          }
          to {
            transform: translateY(0);
          }
        }

        .error-banner button {
          margin-left: auto;
          background: none;
          border: none;
          color: #fff;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
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

        /* Header */
        .lobby-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 2rem;
          background: rgba(10, 14, 26, 0.9);
          border-bottom: 2px solid rgba(0, 255, 136, 0.3);
          position: relative;
          z-index: 10;
        }
  
          .logo {
            font-family: 'Orbitron', sans-serif;
            font-size: 1.8rem;
            font-weight: 900;
            letter-spacing: 2px;
          }
  
          .dev {
            color: #00ff88;
            text-shadow: 0 0 20px rgba(0, 255, 136, 0.5);
          }
  
          .hunter {
            color: #ff3366;
            text-shadow: 0 0 20px rgba(255, 51, 102, 0.5);
          }
  
          .header-room {
            display: flex;
            align-items: center;
            gap: 0.8rem;
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
          }
  
          .room-label {
            color: #666;
            font-size: 0.9rem;
            letter-spacing: 1px;
          }
  
          .room-code {
            color: #00ddff;
            font-weight: 700;
            font-size: 1rem;
            font-family: 'Orbitron', sans-serif;
          }
  
          .connection-status {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #666;
            animation: pulse 2s ease-in-out infinite;
          }
  
          .connection-status.connected {
            background: #00ff88;
          }
  
          .header-controls {
            display: flex;
            gap: 1rem;
          }
  
          .boom-btn, .exit-btn {
            font-family: 'Orbitron', sans-serif;
            font-weight: 700;
            padding: 0.6rem 1.5rem;
            border: 2px solid;
            background: transparent;
            cursor: pointer;
            text-transform: uppercase;
            font-size: 0.9rem;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }
  
          .boom-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
  
          .boom-btn {
            color: #ffcc00;
            border-color: #ffcc00;
          }
  
          .boom-btn:hover:not(:disabled) {
            background: #ffcc00;
            color: #0a0e1a;
            box-shadow: 0 0 20px rgba(255, 204, 0, 0.5);
          }
  
          .exit-btn {
            color: #ff3366;
            border-color: #ff3366;
          }
  
          .exit-btn:hover {
            background: #ff3366;
            color: #fff;
            box-shadow: 0 0 20px rgba(255, 51, 102, 0.5);
          }
  
          /* Main Container */
          .lobby-container {
            display: grid;
            grid-template-columns: 400px 1fr;
            gap: 2rem;
            padding: 2rem;
            max-width: 1800px;
            margin: 0 auto;
            position: relative;
            z-index: 1;
          }
  
          /* Players Panel */
          .players-panel {
            background: rgba(15, 20, 35, 0.8);
            border: 2px solid rgba(0, 221, 255, 0.3);
            border-radius: 8px;
            padding: 1.5rem;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0, 221, 255, 0.1);
          }
  
          .panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.5rem;
            padding-bottom: 1rem;
            border-bottom: 2px solid rgba(0, 221, 255, 0.2);
          }
  
          .panel-header h2 {
            font-family: 'Orbitron', sans-serif;
            font-size: 1.3rem;
            color: #00ddff;
            letter-spacing: 2px;
          }
  
          .player-count {
            color: #00ff88;
            font-weight: 700;
            font-size: 1.1rem;
          }
  
          .players-list {
            display: flex;
            flex-direction: column;
            gap: 0.8rem;
            margin-bottom: 1.5rem;
          }
  
          .player-card {
            display: flex;
            align-items: center;
            gap: 1rem;
            padding: 1rem;
            border: 2px solid;
            border-radius: 6px;
            transition: all 0.3s ease;
            animation: slideIn 0.5s ease forwards;
            opacity: 0;
          }
  
          .player-card:nth-child(1) { animation-delay: 0.1s; }
          .player-card:nth-child(2) { animation-delay: 0.2s; }
          .player-card:nth-child(3) { animation-delay: 0.3s; }
          .player-card:nth-child(4) { animation-delay: 0.4s; }
  
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateX(-20px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
  
          .player-card:hover {
            transform: translateX(5px);
            box-shadow: 0 4px 20px rgba(0, 221, 255, 0.2);
          }
  
          .player-avatar {
            width: 48px;
            height: 48px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 1.1rem;
            font-family: 'Orbitron', sans-serif;
          }
  
          .player-info {
            flex: 1;
          }
  
          .player-role {
            font-size: 0.75rem;
            font-weight: 700;
            letter-spacing: 1px;
            margin-bottom: 0.2rem;
          }
  
          .player-name {
            color: #ccc;
            font-size: 0.95rem;
          }
  
          .player-status {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            animation: glow 2s ease-in-out infinite;
          }
  
          @keyframes glow {
            0%, 100% { box-shadow: 0 0 5px currentColor; }
            50% { box-shadow: 0 0 15px currentColor; }
          }
  
          .current-player {
            box-shadow: inset 0 0 10px rgba(255, 204, 0, 0.2);
          }
  
          .waiting-indicator {
            display: flex;
            align-items: center;
            gap: 0.8rem;
            padding: 1rem;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 6px;
            color: #666;
          }
  
          .waiting-avatar {
            width: 32px;
            height: 32px;
            border-radius: 4px;
            background: #333;
            position: relative;
            overflow: hidden;
          }
  
          .waiting-avatar::after {
            content: '';
            position: absolute;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
            animation: shimmer 2s infinite;
          }
  
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
  
          .ready-btn {
            width: 100%;
            padding: 1rem;
            border-radius: 6px;
            border: 2px solid;
            font-family: 'Orbitron', sans-serif;
            font-weight: 700;
            font-size: 1rem;
            letter-spacing: 1px;
            cursor: pointer;
            transition: all 0.3s ease;
            text-transform: uppercase;
            margin-top: 1rem;
          }
  
          .ready-btn.not-ready {
            color: #ff9900;
            border-color: #ff9900;
            background: rgba(255, 153, 0, 0.1);
          }
  
          .ready-btn.not-ready:hover {
            background: #ff9900;
            color: #0a0e1a;
            box-shadow: 0 0 20px rgba(255, 153, 0, 0.5);
          }
  
          .ready-btn.ready {
            color: #00ff88;
            border-color: #00ff88;
            background: rgba(0, 255, 136, 0.1);
          }
  
          .ready-btn.ready:hover {
            background: #00ff88;
            color: #0a0e1a;
            box-shadow: 0 0 20px rgba(0, 255, 136, 0.5);
          }
  
          .current-player {
            box-shadow: inset 0 0 10px rgba(255, 204, 0, 0.2);
          }
  
          /* Lobby Panel */
          .lobby-panel {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
          }
  
          .lobby-title-section {
            background: rgba(15, 20, 35, 0.8);
            border: 2px solid rgba(221, 0, 255, 0.3);
            border-radius: 8px;
            padding: 2rem;
            text-align: center;
            backdrop-filter: blur(10px);
          }
  
          .lobby-title {
            font-family: 'Orbitron', sans-serif;
            font-size: 4rem;
            font-weight: 900;
            color: #dd00ff;
            letter-spacing: 8px;
            text-shadow: 0 0 40px rgba(221, 0, 255, 0.6);
            margin-bottom: 0.5rem;
            animation: titleGlow 3s ease-in-out infinite;
          }
  
          @keyframes titleGlow {
            0%, 100% { text-shadow: 0 0 40px rgba(221, 0, 255, 0.6); }
            50% { text-shadow: 0 0 60px rgba(221, 0, 255, 0.9); }
          }
  
          .lobby-subtitle {
            color: #aaa;
            font-size: 1rem;
          }
  
          /* Roles Grid */
          .roles-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 1rem;
          }
  
          .role-card {
            background: rgba(15, 20, 35, 0.8);
            border: 2px solid;
            border-radius: 8px;
            padding: 1.5rem;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
          }
  
          .role-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 8px 30px rgba(0, 221, 255, 0.2);
          }
  
          .role-icon {
            font-size: 2.5rem;
            margin-bottom: 1rem;
          }
  
          .role-content h3 {
            font-family: 'Orbitron', sans-serif;
            font-size: 1rem;
            margin-bottom: 0.5rem;
            letter-spacing: 1px;
          }
  
          .role-content p {
            color: #aaa;
            font-size: 0.85rem;
            line-height: 1.4;
          }
  
          /* Game Settings */
          .game-settings {
            background: rgba(15, 20, 35, 0.8);
            border: 2px solid rgba(100, 100, 100, 0.3);
            border-radius: 8px;
            padding: 1.5rem;
            backdrop-filter: blur(10px);
          }
  
          .settings-header {
            display: flex;
            align-items: center;
            gap: 0.8rem;
            margin-bottom: 1.2rem;
            padding-bottom: 0.8rem;
            border-bottom: 2px solid rgba(100, 100, 100, 0.2);
          }
  
          .cursor-icon {
            font-size: 1.3rem;
          }
  
          .settings-header h3 {
            font-family: 'Orbitron', sans-serif;
            font-size: 1rem;
            letter-spacing: 1px;
          }
  
          .settings-row {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 1.5rem;
          }
  
          .setting {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }
  
          .setting-label {
            font-size: 0.7rem;
            color: #888;
            letter-spacing: 1px;
          }
  
          .setting-value {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-weight: 700;
            font-size: 1rem;
          }
  
          .setting-icon {
            font-size: 1.2rem;
          }
  
          .mode-classic {
            color: #dd00ff;
          }
  
          .mode-medium {
            color: #00ff88;
          }
  
          /* Chat Section */
          .chat-section {
            background: rgba(15, 20, 35, 0.8);
            border: 2px solid rgba(100, 100, 100, 0.3);
            border-radius: 8px;
            padding: 1.5rem;
            backdrop-filter: blur(10px);
          }
  
          .chat-header {
            display: flex;
            align-items: center;
            gap: 0.8rem;
            margin-bottom: 1rem;
            padding-bottom: 0.8rem;
            border-bottom: 2px solid rgba(100, 100, 100, 0.2);
          }
  
          .chat-header h3 {
            font-family: 'Orbitron', sans-serif;
            font-size: 1rem;
            letter-spacing: 1px;
          }
  
          .chat-messages {
            height: 120px;
            overflow-y: auto;
            margin-bottom: 1rem;
            padding-right: 0.5rem;
          }
  
          .chat-messages::-webkit-scrollbar {
            width: 6px;
          }
  
          .chat-messages::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.2);
            border-radius: 3px;
          }
  
          .chat-messages::-webkit-scrollbar-thumb {
            background: rgba(0, 221, 255, 0.3);
            border-radius: 3px;
          }
  
          .chat-message {
            margin-bottom: 0.6rem;
            font-size: 0.9rem;
            animation: messageSlide 0.3s ease;
          }
  
          @keyframes messageSlide {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
  
          .chat-username {
            font-weight: 700;
            margin-right: 0.5rem;
          }
  
          .chat-text {
            color: #ddd;
          }
  
          .chat-input-wrapper {
            display: flex;
            gap: 0.5rem;
          }
  
          .chat-input {
            flex: 1;
            background: rgba(0, 0, 0, 0.3);
            border: 2px solid rgba(100, 100, 100, 0.3);
            border-radius: 6px;
            padding: 0.8rem 1rem;
            color: #fff;
            font-family: 'Share Tech Mono', monospace;
            font-size: 0.9rem;
            transition: all 0.3s ease;
          }
  
          .chat-input:focus {
            outline: none;
            border-color: #00ddff;
            box-shadow: 0 0 10px rgba(0, 221, 255, 0.3);
          }
  
          .chat-input::placeholder {
            color: #666;
          }
  
          .send-btn {
            background: #00ddff;
            border: none;
            border-radius: 6px;
            padding: 0.8rem 1rem;
            color: #0a0e1a;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
          }
  
          .send-btn:hover {
            background: #00ff88;
            box-shadow: 0 0 20px rgba(0, 255, 136, 0.5);
          }
  
          @keyframes pulse {
            0%, 100% { opacity: 0.5; }
            50% { opacity: 1; }
          }
  
          /* Responsive */
          @media (max-width: 1200px) {
            .lobby-container {
              grid-template-columns: 1fr;
            }
  
            .roles-grid {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
      </div>
    );
  }
