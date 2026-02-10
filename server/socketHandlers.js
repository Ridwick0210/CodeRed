// Socket.IO event handlers
const {
  createRoom,
  getRoom,
  addPlayerToRoom,
  removePlayerFromRoom,
  startGame,
  handleBuzz,
  castBuzzVote,
  getBuzzVoteResult,
  clearBuzzVote,
  validateFix,
  endRound,
  resetGame,
  checkBuggerWin,
  checkDebuggersWin,
} = require("./gameState");

const {
  generateRoomCode,
  generatePlayerId,
  isValidPlayerName,
} = require("./utils");

const { initializeRoomCode, getCurrentCode, cleanupRoom } = require('./yjsServer');
const { validateCalculatorCode } = require('./validation');

const socketToPlayer = new Map();
const playerToSocket = new Map();
const buzzVoteTimers = new Map();
const roundTimers = new Map();

/**
 * Setup all socket event handlers
 */
function setupSocketHandlers(io) {
  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on("createRoom", ({ playerName }, callback) => {
      if (!isValidPlayerName(playerName)) {
        return callback({ success: false, error: "Invalid player name" });
      }

      const roomCode = generateRoomCode();
      const playerId = generatePlayerId();

      const room = createRoom(roomCode, playerId, playerName);

      socketToPlayer.set(socket.id, { playerId, roomCode });
      playerToSocket.set(playerId, socket.id);

      socket.join(roomCode);

      callback({
        success: true,
        roomCode,
        playerId,
        room: serializeRoom(room),
      });

      console.log(`Room created: ${roomCode} by ${playerName}`);
    });

    socket.on("joinRoom", ({ roomCode, playerName }, callback) => {
      if (!isValidPlayerName(playerName)) {
        return callback({ success: false, error: "Invalid player name" });
      }

      const room = getRoom(roomCode);
      if (!room) {
        return callback({ success: false, error: "Room not found" });
      }

      const playerId = generatePlayerId();
      const result = addPlayerToRoom(roomCode, playerId, playerName);

      if (result.error) {
        return callback({ success: false, error: result.error });
      }

      socketToPlayer.set(socket.id, { playerId, roomCode });
      playerToSocket.set(playerId, socket.id);

      socket.join(roomCode);
      
      const serialized = serializeRoom(result);
      console.log(`Player ${playerName} joined room ${roomCode}. Room now has ${serialized.players.length} players`);
      
      callback({
        success: true,
        playerId,
        room: serialized
      });

      socket.to(roomCode).emit("playerJoined", {
        player: result.players.get(playerId),
        room: serialized
      });

      socket.to(roomCode).emit('chatMessage', {
        username: 'System',
        message: `${playerName} joined the lobby`,
        color: '#00ff88'
      });

      console.log(`${playerName} joined room ${roomCode}`);
    });

    socket.on("playerReady", (callback) => {
      const playerData = socketToPlayer.get(socket.id);
      if (!playerData) return;

      const { playerId, roomCode } = playerData;
      const room = getRoom(roomCode);
      if (!room) return;

      const player = room.players.get(playerId);
      if (player) {
        player.isReady = !player.isReady;

        io.to(roomCode).emit("roomUpdated", {
          room: serializeRoom(room),
        });

        if (callback) callback({ success: true });
      }
    });

    socket.on('chatMessage', ({ message }, callback) => {
      const playerData = socketToPlayer.get(socket.id);
      if (!playerData) return;

      const { playerId, roomCode } = playerData;
      const room = getRoom(roomCode);
      if (!room) return;

      const player = room.players.get(playerId);
      if (player && message.trim()) {
        socket.to(roomCode).emit('chatMessage', {
          username: player.name,
          message: message.trim(),
          color: '#ffffff'
        });

        if (callback) callback({ success: true });
      }
    });

    socket.on("startGame", (callback) => {
      const playerData = socketToPlayer.get(socket.id);
      if (!playerData) return;

      const { playerId, roomCode } = playerData;
      const room = getRoom(roomCode);

      if (!room) {
        return callback({ success: false, error: "Room not found" });
      }

      if (room.hostId !== playerId) {
        return callback({ success: false, error: "Only host can start game" });
      }

      const result = startGame(roomCode);

      if (result.error) {
        return callback({ success: false, error: result.error });
      }

      if (result.currentCode) {
        initializeRoomCode(roomCode, result.currentCode.initialBuggyCode);
      }

      io.to(roomCode).emit("gameStarted", {
        room: serializeRoom(result),
      });

      startRoundTimer(io, roomCode);

      callback({ success: true });
      console.log(`Game started in room ${roomCode}`);
    });

    socket.on("buzz", (callback) => {
      const playerData = socketToPlayer.get(socket.id);
      if (!playerData) return;

      const { playerId, roomCode } = playerData;
      const result = handleBuzz(roomCode, playerId);

      if (result && result.error) {
        return callback({ success: false, error: result.error });
      }

      if (result) {
        const player = result.players.get(playerId);

        pauseRoundTimer(io, roomCode);

        io.to(roomCode).emit("playerBuzzed", {
          playerId,
          playerName: player.name,
          vote: serializeBuzzVote(result.activeVote),
        });

        startBuzzVoteTimer(io, roomCode);

        callback({ success: true });
      }
    });

    socket.on("castBuzzVote", ({ targetPlayerId }, callback) => {
      const playerData = socketToPlayer.get(socket.id);
      if (!playerData) {
        return callback({ success: false, error: "Not in a room" });
      }

      const { playerId, roomCode } = playerData;
      const result = castBuzzVote(roomCode, playerId, targetPlayerId);

      if (result.error) {
        return callback({ success: false, error: result.error });
      }

      callback({ success: true });

      const room = getRoom(roomCode);

      io.to(roomCode).emit("buzzVoteUpdated", {
        vote: serializeBuzzVote(room.activeVote),
      });

      if (result.allVoted) {
        clearTimeout(buzzVoteTimers.get(roomCode));
        handleBuzzVoteEnd(io, roomCode);
      }
    });

    socket.on("submitFix", ({ fixedCode }, callback) => {
      const playerData = socketToPlayer.get(socket.id);
      if (!playerData) return;

      const { playerId, roomCode } = playerData;
      const result = validateFix(roomCode, playerId, fixedCode);

      if (!result || result.error) {
        return callback({
          success: false,
          error: result?.error || "Invalid submission",
        });
      }

      const { isCorrect, room } = result;

      callback({ success: true, isCorrect });

      io.to(roomCode).emit("fixSubmitted", {
        playerId,
        playerName: room.players.get(playerId).name,
        isCorrect,
        correctCode: room.currentCode.correctCode,
        bugDescription: "Code submitted for review",
      });

      room.buzzedPlayer = null;

      setTimeout(() => {
        handleEndRound(io, roomCode);
      }, 3000);
    });

    socket.on("submitBug", ({ buggedCode }, callback) => {
      const playerData = socketToPlayer.get(socket.id);
      if (!playerData) return;

      const { playerId, roomCode } = playerData;
      const room = getRoom(roomCode);

      if (!room || room.bugger !== playerId) {
        if (callback) return callback({ success: false, error: 'Only bugger can submit bugs' });
        return;
      }

      room.currentCode.buggedCode = buggedCode;

      if (callback) callback({ success: true });
    });

    socket.on("validateBugFix", async ({ code }, callback) => {
       const playerData = socketToPlayer.get(socket.id);
       if (!playerData) return callback({ success: false, error: 'Not in a room' });

       const { playerId, roomCode } = playerData;
       const room = getRoom(roomCode);
       
       if (!room) return callback({ success: false, error: 'Room not found' });
       
       let method = null;
       if (room.currentCode && room.currentCode.bugAssignments) {
         const bugAssignment = room.currentCode.bugAssignments.get(playerId);
         if (bugAssignment) {
            method = bugAssignment.method;
            if (!method) {
               const bugIdToMethod = {
                  'bug1': 'divide',
                  'bug2': 'squareRoot'
               };
               method = bugIdToMethod[bugAssignment.id];
            }
         }
       }

       if (!method) {
          console.log(`Player ${playerId} has no bug assignment or method invalid`);
       }

       const FALLBACK_TEST_CASES = [
          
          { method: 'divide', args: [20, 4], expected: 5 },
          { method: 'divide', args: [5, 0], expected: 'Error', errorMsg: 'Cannot divide by zero' },
          { method: 'squareRoot', args: [25], expected: 5 },
          { method: 'squareRoot', args: [-9], expected: 'Error', errorMsg: 'Cannot calculate square root of negative number' },

       ];

       const testCases = (room.currentCode?.testCases && room.currentCode.testCases.length > 0) 
            ? room.currentCode.testCases 
            : FALLBACK_TEST_CASES;
       
       console.log(`[Validation] Room ${roomCode}, Player ${playerId}. TestCases applied: ${testCases.length}`);
       console.log(`[Validation] Using fallback? ${room.currentCode?.testCases?.length ? 'No' : 'Yes'}`);

       const validation = await validateCalculatorCode(code, testCases);
       console.log(`[Validation] Result: success=${validation.success}, allPassed=${validation.allPassed}, results=${validation.results?.length}`);
       
       if (!validation.success) {
          return callback({ 
            success: false, 
            error: validation.error || 'Validation failed to run' 
          });
       }

       let assignedFixed = false;
       if (method) {
         const assignedResult = validation.results.find(r => r.method === method);
         assignedFixed = assignedResult ? assignedResult.passed : false;
       }
       
       const allPassed = validation.allPassed;

       callback({
         success: true,
         assignedFixed,
         allPassed,
         bugMethod: method,
         results: validation.results,
         message: assignedFixed 
            ? (allPassed ? 'PERFECT! All bugs fixed.' : `Good job! Your bug (${method}) is fixed, but the system is not fully operational yet.`)
            : `Your assigned bug check (${method}) failed. Keep debugging.`
       });
    });

    socket.on('cursorUpdate', ({ position }) => {
      const playerData = socketToPlayer.get(socket.id);
      if (!playerData) return;

      const { playerId, roomCode } = playerData;
      const room = getRoom(roomCode);
      if (!room) return;

      const player = room.players.get(playerId);
      if (!player) return;

      const playerIndex = Array.from(room.players.keys()).indexOf(playerId);
      const colors = ['#00ddff', '#00ff88', '#dd00ff', '#ffcc00', '#ff9900', '#ff3366'];
      const playerColor = colors[playerIndex % colors.length];

      socket.to(roomCode).emit('cursorMoved', {
        playerId,
        playerName: player.name,
        position,
        color: playerColor
      });
    });

    socket.on("nextRound", () => {
      const playerData = socketToPlayer.get(socket.id);
      if (!playerData) return;

      const { roomCode } = playerData;
      const room = getRoom(roomCode);

      if (room && room.gameState === "playing") {
        io.to(roomCode).emit("roundStarted", {
          room: serializeRoom(room),
        });

        startRoundTimer(io, roomCode);
      }
    });

    socket.on("playAgain", (callback) => {
      const playerData = socketToPlayer.get(socket.id);
      if (!playerData) return;

      const { roomCode } = playerData;
      const room = resetGame(roomCode);

      if (room) {
        io.to(roomCode).emit("gameReset", {
          room: serializeRoom(room),
        });

        callback({ success: true });
      }
    });

    socket.on("leaveRoom", (callback) => {
      const playerData = socketToPlayer.get(socket.id);
      if (!playerData) {
        if (callback) callback({ success: false, error: 'Not in a room' });
        return;
      }

      const { playerId, roomCode } = playerData;
      const room = getRoom(roomCode);

      if (room && room.activeVote) {
        clearTimeout(buzzVoteTimers.get(roomCode));
        clearBuzzVote(roomCode);
        io.to(roomCode).emit("voteCancelled", {
          reason: "A player left the room",
        });
      }

      const updatedRoom = removePlayerFromRoom(roomCode, playerId);

      if (updatedRoom) {
        io.to(roomCode).emit("playerLeft", {
          playerId,
          room: serializeRoom(updatedRoom),
        });

        io.to(roomCode).emit('chatMessage', {
          username: 'System',
          message: 'A player left the room',
          color: '#ff3366'
        });
      }

      socketToPlayer.delete(socket.id);
      playerToSocket.delete(playerId);

      console.log(`Player ${playerId} left room ${roomCode}`);
      
      if (callback) callback({ success: true });
    });

    socket.on("disconnect", () => {
      const playerData = socketToPlayer.get(socket.id);

      if (playerData) {
        const { playerId, roomCode } = playerData;
        const room = getRoom(roomCode);

        if (room && room.activeVote) {
          clearTimeout(buzzVoteTimers.get(roomCode));
          clearBuzzVote(roomCode);
          io.to(roomCode).emit("voteCancelled", {
            reason: "A player disconnected",
          });
        }

        const updatedRoom = removePlayerFromRoom(roomCode, playerId);

        if (updatedRoom) {
          io.to(roomCode).emit("playerLeft", {
            playerId,
            room: serializeRoom(updatedRoom),
          });

          io.to(roomCode).emit('chatMessage', {
            username: 'System',
            message: 'A player left the lobby',
            color: '#ff3366'
          });

          io.to(roomCode).emit('chatMessage', {
            username: 'System',
            message: 'A player left the lobby',
            color: '#ff3366'
          });
        }

        socketToPlayer.delete(socket.id);
        playerToSocket.delete(playerId);
      }

      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}

function startRoundTimer(io, roomCode) {
  const room = getRoom(roomCode);
  if (!room) return;

  if (roundTimers.has(roomCode)) {
    clearInterval(roundTimers.get(roomCode));
  }

  const timer = setInterval(() => {
    const room = getRoom(roomCode);
    if (!room || room.gameState !== "playing") {
      clearInterval(timer);
      roundTimers.delete(roomCode);
      return;
    }

    if (room.timerPaused) {
      return;
    }

    const elapsed = Math.floor((Date.now() - room.roundStartTime) / 1000);
    const remaining = room.roundDuration - elapsed;

    io.to(roomCode).emit("timerUpdate", { remaining });

    if (remaining <= 0) {
      clearInterval(timer);
      roundTimers.delete(roomCode);
      handleEndRound(io, roomCode);
    }
  }, 1000);

  roundTimers.set(roomCode, timer);
}

function pauseRoundTimer(io, roomCode) {
  const room = getRoom(roomCode);
  if (!room || room.timerPaused) return;

  const elapsed = Math.floor((Date.now() - room.roundStartTime) / 1000);
  const remaining = room.roundDuration - elapsed;
  
  room.timerPaused = true;
  room.pausedTimeRemaining = Math.max(0, remaining);
  
  console.log(`Timer paused in room ${roomCode}, remaining: ${room.pausedTimeRemaining}s`);
}

function resumeRoundTimer(io, roomCode) {
  const room = getRoom(roomCode);
  if (!room || !room.timerPaused) return;

  room.roundStartTime = Date.now() - ((room.roundDuration - room.pausedTimeRemaining) * 1000);
  room.timerPaused = false;
  delete room.pausedTimeRemaining;
  
  console.log(`Timer resumed in room ${roomCode}`);
  
  const elapsed = Math.floor((Date.now() - room.roundStartTime) / 1000);
  const remaining = room.roundDuration - elapsed;
  io.to(roomCode).emit("timerUpdate", { remaining });
}

/**
 * Handle end of round
 */
function handleEndRound(io, roomCode) {
  const finalCode = getCurrentCode(roomCode);
  
  const room = endRound(roomCode, finalCode);

  if (!room) return;

  if (room.gameState === "results") {
    // Game over - show final results
    io.to(roomCode).emit("gameEnded", {
      room: serializeRoom(room),
      winner: room.winner || null,
      reason: room.winReason || "Game completed",
    });
    cleanupRoom(roomCode);
  } else {
    // Next round
    io.to(roomCode).emit("roundEnded", {
      room: serializeRoom(room),
    });

    setTimeout(() => {
      if (room.currentCode) {
        initializeRoomCode(roomCode, room.currentCode.initialBuggyCode);
      }

      io.to(roomCode).emit("roundStarted", {
        room: serializeRoom(room),
      });

      startRoundTimer(io, roomCode);
    }, 5000);
  }
}

function serializeBuzzVote(vote) {
  if (!vote) return null;

  return {
    initiatorId: vote.initiatorId,
    initiatorName: vote.initiatorName,
    type: vote.type,
    votes: Array.from(vote.votes.entries()).map(([voterId, targetId]) => ({
      voterId,
      targetId,
    })),
    skips: Array.from(vote.skips || []),
    votedCount: vote.votes.size,
    skipCount: (vote.skips || new Set()).size,
    startTime: vote.startTime,
    duration: vote.duration,
  };
}

function startBuzzVoteTimer(io, roomCode) {
  const room = getRoom(roomCode);
  if (!room || !room.activeVote) return;

  const duration = room.activeVote.duration || 60000;

  if (buzzVoteTimers.has(roomCode)) {
    clearTimeout(buzzVoteTimers.get(roomCode));
  }

  const timerId = setTimeout(() => {
    handleBuzzVoteEnd(io, roomCode);
  }, duration);

  buzzVoteTimers.set(roomCode, timerId);

  const updateInterval = setInterval(() => {
    const room = getRoom(roomCode);
    if (!room || !room.activeVote) {
      clearInterval(updateInterval);
      return;
    }

    const elapsed = Date.now() - room.activeVote.startTime;
    const remaining = Math.ceil((duration - elapsed) / 1000);

    if (remaining > 0) {
      io.to(roomCode).emit("voteTimeUpdate", { remaining });
    } else {
      clearInterval(updateInterval);
    }
  }, 1000);
}

function handleBuzzVoteEnd(io, roomCode) {
  const room = getRoom(roomCode);
  if (!room || !room.activeVote) return;

  const voteResult = getBuzzVoteResult(room);

  if (!voteResult) return;

  const {
    shouldKick,
    playerToKick,
    kickedPlayerName,
    maxVotes,
    voteCount,
    votedCount,
    skipCount,
    totalPlayers,
    hasClearMajority,
    buggerVotedOut,
  } = voteResult;

  console.log(`Vote ended in room ${roomCode}:`, {
    shouldKick,
    kickedPlayerName,
    maxVotes,
    voteCount,
    skipCount,
    hasClearMajority,
  });

  // Emit vote result to all players
  io.to(roomCode).emit("buzzVoteEnded", {
    shouldKick,
    playerToKick,
    kickedPlayerName,
    maxVotes,
    voteCount,
    votedCount,
    skipCount,
    totalPlayers,
    hasClearMajority,
    reason: !hasClearMajority ? "No clear majority - game continues" : null,
  });

  // Check if there's a clear majority
  if (!hasClearMajority) {
    console.log(
      `No clear majority in room ${roomCode}. Votes: ${JSON.stringify(voteCount)}, Skips: ${skipCount}`,
    );

    room.buzzedPlayer = null;
    clearBuzzVote(roomCode);
    buzzVoteTimers.delete(roomCode);
    
    resumeRoundTimer(io, roomCode);
    
    io.to(roomCode).emit("buzzVoteEnded", {
      shouldKick: false,
      kickedPlayerName: null,
      room: serializeRoom(room),
    });
    return;
  }

  const player = room.players.get(playerToKick);
  if (player) {
    player.disabled = true;
  }

  console.log(
    `Player ${kickedPlayerName} was disabled in room ${roomCode} with ${maxVotes} votes`,
  );

  io.to(roomCode).emit("playerDisabled", {
    playerId: playerToKick,
    playerName: kickedPlayerName,
    room: serializeRoom(room),
  });

  if (buggerVotedOut) {
    console.log(`Bugger was voted out in room ${roomCode}! Debuggers win!`);
    room.gameState = "results";
    io.to(roomCode).emit("gameEnded", {
      room: serializeRoom(room),
      winner: "debuggers",
      reason: "Bugger was voted out",
    });
    clearBuzzVote(roomCode);
    buzzVoteTimers.delete(roomCode);
    return;
  }

  if (checkBuggerWin(room)) {
    console.log(`Buggers won in room ${roomCode}!`);
    room.gameState = "results";
    io.to(roomCode).emit("gameEnded", {
      room: serializeRoom(room),
      winner: "buggers",
      reason: "All debuggers eliminated or only 2 players remain",
    });
    clearBuzzVote(roomCode);
    buzzVoteTimers.delete(roomCode);
    return;
  }

  room.buzzedPlayer = null;
  clearBuzzVote(roomCode);
  buzzVoteTimers.delete(roomCode);
  
  resumeRoundTimer(io, roomCode);
  
  io.to(roomCode).emit("buzzVoteEnded", {
    shouldKick,
    kickedPlayerName,
    room: serializeRoom(room),
  });
}

function serializeRoom(room) {
  if (!room) {
    console.error('serializeRoom called with null/undefined room');
    return null;
  }

  let currentCodeSerialized = room.currentCode;
  if (room.currentCode && room.currentCode.bugAssignments) {
    currentCodeSerialized = {
      ...room.currentCode,
      bugAssignments: Object.fromEntries(room.currentCode.bugAssignments)
    };
  }

  const serialized = {
    code: room.code,
    hostId: room.hostId,
    players: Array.from(room.players.values()),
    gameState: room.gameState,
    currentRound: room.currentRound,
    totalRounds: room.totalRounds,
    currentCode: currentCodeSerialized,
    bugger: room.bugger,
    debuggers: room.debuggers,
    buzzedPlayer: room.buzzedPlayer,
    activeVote: serializeBuzzVote(room.activeVote),
  };

  console.log(`Serialized room ${room.code} with ${serialized.players.length} players`);
  
  return serialized;
}

module.exports = { setupSocketHandlers };