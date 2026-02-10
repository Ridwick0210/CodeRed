const { shuffleArray, randomElement } = require("./utils");

const rooms = new Map();

const codeSamples = [
  {
    id: 1,
    language: "javascript",
    title: "Scientific Calculator",
    correctCode: `class ScientificCalculator {
  constructor() {
    this.memory = 0;
    this.history = [];
  }

  add(a, b) {
    const result = a + b;
    this.history.push(\`\${a} + \${b} = \${result}\`);
    return result;
  }

  subtract(a, b) {
    const result = a - b;
    this.history.push(\`\${a} - \${b} = \${result}\`);
    return result;
  }

  multiply(a, b) {
    const result = a * b;
    this.history.push(\`\${a} * \${b} = \${result}\`);
    return result;
  }

  divide(a, b) {
    if (b === 0) {
      throw new Error('Cannot divide by zero');
    }
    const result = a / b;
    this.history.push(\`\${a} / \${b} = \${result}\`);
    return result;
  }

  power(base, exponent) {
    const result = Math.pow(base, exponent);
    this.history.push(\`\${base} ^ \${exponent} = \${result}\`);
    return result;
  }

  squareRoot(n) {
    if (n < 0) {
      throw new Error('Cannot calculate square root of negative number');
    }
    const result = Math.sqrt(n);
    this.history.push(\`√\${n} = \${result}\`);
    return result;
  }

  increment(n) {
    const result = n + 1;
    this.history.push(\`++\${n} = \${result}\`);
    return result;
  }

  decrement(n) {
    const result = n - 1;
    this.history.push(\`--\${n} = \${result}\`);
    return result;
  }


  getHistory() {
    return this.history;
  }
}`,
    bugs: [
      {
        id: "bug1",
        description: "Divide method missing zero check before division",
        location: "Line 33",
        difficulty: "medium"
      },
      {
        id: "bug2",
        description: "squareRoot missing check for negative numbers",
        location: "Line 49",
        difficulty: "medium"
      },
    ],
    testCases: [
      { method: 'divide', args: [20, 4], expected: 5 },
      { method: 'divide', args: [5, 0], expected: 'Error', errorMsg: 'Cannot divide by zero' },
      { method: 'squareRoot', args: [25], expected: 5 },
      { method: 'squareRoot', args: [-9], expected: 'Error', errorMsg: 'Cannot calculate square root of negative number' },
    ]
  }
];

function createRoom(roomCode, hostId, hostName) {
  const room = {
    code: roomCode,
    hostId: hostId,
    players: new Map(),
    gameState: "lobby", // lobby, playing, results
    currentRound: 0,
    totalRounds: 1,
    roundStartTime: null,
    roundDuration: 90, // seconds
    currentCode: null,
    currentBug: null,
    bugger: null,
    debuggers: [],
    buzzedPlayer: null,
    activeVote: null,
    winner: null,
    winReason: null,
    createdAt: Date.now(),
  };

  // Add host as first player
  room.players.set(hostId, {
    id: hostId,
    name: hostName,
    isHost: true,
    isReady: false,
    role: null,
    disabled: false,
  });

  rooms.set(roomCode, room);

  return room;
}

function getRoom(roomCode) {
  return rooms.get(roomCode);
}

function addPlayerToRoom(roomCode, playerId, playerName) {
  const room = rooms.get(roomCode);
  if (!room) return null;

  if (room.players.size >= 6) {
    return { error: "Room is full" };
  }

  if (room.gameState !== "lobby") {
    return { error: "Game already in progress" };
  }

  // Clear empty timer if it exists
  if (room.emptyTimeout) {
    clearTimeout(room.emptyTimeout);
    room.emptyTimeout = null;
  }

  const isFirstPlayer = room.players.size === 0;
  
  room.players.set(playerId, {
    id: playerId,
    name: playerName,
    isHost: isFirstPlayer,
    isReady: false,
    role: null,
    disabled: false,
  });

  if (isFirstPlayer) {
    room.hostId = playerId;
  }

  return room;
}

function removePlayerFromRoom(roomCode, playerId) {
  const room = rooms.get(roomCode);
  if (!room) return null;

  room.players.delete(playerId);

  if (room.hostId === playerId) {
    if (room.players.size > 0) {
      const newHost = Array.from(room.players.values())[0];
      newHost.isHost = true;
      room.hostId = newHost.id;
    } else {
      room.hostId = null;
    }
  }

  if (room.players.size === 0) {
    console.log(`Room ${roomCode} is empty. Scheduling cleanup in 30s.`);
    room.emptyTimeout = setTimeout(() => {
      if (rooms.has(roomCode) && rooms.get(roomCode).players.size === 0) {
        rooms.delete(roomCode);
        console.log(`Room ${roomCode} deleted after 30s timeout.`);
      }
    }, 30000);
  }

  return room;
}

function startGame(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return null;

  if (room.players.size < 3) {
    return { error: "Need at least 3 players to start" };
  }

  room.gameState = "playing";
  room.currentRound = 1;
  assignRoles(room);
  startRound(room);

  return room;
}

function assignRoles(room) {
  const playerIds = Array.from(room.players.keys());
  const shuffled = shuffleArray(playerIds);

  room.bugger = shuffled[0];
  room.debuggers = shuffled.slice(1);

  room.players.get(room.bugger).role = "bugger";
  room.debuggers.forEach((id) => {
    room.players.get(id).role = "debugger";
  });
}

function injectBug(correctCode, bugId) {
  let buggedCode = correctCode;
  
  switch(bugId) {
    case 'bug1':
      buggedCode = buggedCode.replace(
        /divide\(a, b\)\s*{\s*if \(b === 0\) {\s*throw new Error\('Cannot divide by zero'\);\s*}\s*/,
        'divide(a, b) {\n    '
      );
      break;
      
    case 'bug2':
      buggedCode = buggedCode.replace(
        /squareRoot\(n\)\s*{\s*if \(n < 0\) {\s*throw new Error\('Cannot calculate square root of negative number'\);\s*}\s*/,
        'squareRoot(n) {\n    '
      );
      break;
  }
  
  return buggedCode;
}

function startRound(room) {
  const sample = codeSamples[0];
  
  const availableBugs = [...sample.bugs];
  const bugAssignments = new Map();
  
  room.debuggers.forEach(debuggerId => {
    if (availableBugs.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableBugs.length);
      const assignedBug = availableBugs.splice(randomIndex, 1)[0];
      bugAssignments.set(debuggerId, assignedBug);
    }
  });

  let initialBuggyCode = sample.correctCode;
  bugAssignments.forEach((bug) => {
    initialBuggyCode = injectBug(initialBuggyCode, bug.id);
  });

  room.currentCode = {
    ...sample,
    bugAssignments,
    correctCode: sample.correctCode,
    initialBuggyCode
  };

  room.roundStartTime = Date.now();
  room.buzzedPlayer = null;
  room.activeVote = null;
}

function handleBuzz(roomCode, playerId) {
  const room = rooms.get(roomCode);
  if (!room || room.gameState !== "playing") return null;

  const player = room.players.get(playerId);

  if (player?.disabled) {
    return { error: "You are disabled and cannot buzz" };
  }

  room.buzzedPlayer = playerId;

  room.activeVote = {
    initiatorId: playerId,
    initiatorName: player.name,
    type: "vote_kick",
    votes: new Map(),
    skips: new Set(),
    startTime: Date.now(),
    duration: 60000
  };

  return room;
}

function castBuzzVote(roomCode, voterId, targetVoteId) {
  const room = rooms.get(roomCode);
  if (!room) return { error: "Room not found" };

  if (!room.activeVote || room.activeVote.type !== "vote_kick") {
    return { error: "No active vote" };
  }

  if (!room.players.has(voterId)) {
    return { error: "You are not in this room" };
  }

  const voter = room.players.get(voterId);

  if (voter?.disabled) {
    return { error: "You are disabled and cannot vote" };
  }

  if (room.activeVote.votes.has(voterId) || room.activeVote.skips.has(voterId)) {
    return { error: "You have already voted" };
  }

  if (targetVoteId === "skip") {
    room.activeVote.skips.add(voterId);

    const enabledPlayers = Array.from(room.players.values()).filter(
      (p) => !p.disabled,
    );
    const totalVotesAndSkips =
      room.activeVote.votes.size + room.activeVote.skips.size;
    const allVoted = totalVotesAndSkips >= enabledPlayers.length;

    return { success: true, vote: room.activeVote, allVoted };
  }

  if (!room.players.has(targetVoteId)) {
    return { error: "Target player not found" };
  }

  const targetPlayer = room.players.get(targetVoteId);

  if (targetPlayer?.disabled) {
    return { error: "Cannot vote for an already disabled player" };
  }

  if (voterId === targetVoteId) {
    return { error: "You cannot vote for yourself" };
  }

  room.activeVote.votes.set(voterId, targetVoteId);

  const enabledPlayers = Array.from(room.players.values()).filter(
    (p) => !p.disabled,
  );
  const totalVotesAndSkips =
    room.activeVote.votes.size + room.activeVote.skips.size;
  const allVoted = totalVotesAndSkips >= enabledPlayers.length;

  return { success: true, vote: room.activeVote, allVoted };
}

function getBuzzVoteResult(room) {
  if (!room.activeVote) return null;

  const votes = room.activeVote.votes;
  const skips = room.activeVote.skips;
  const votedCount = votes.size;
  const skipCount = skips.size;

  const enabledPlayers = Array.from(room.players.values()).filter(
    (p) => !p.disabled,
  );
  const totalPlayers = enabledPlayers.length;

  const voteCount = new Map();
  for (const targetPlayerId of votes.values()) {
    voteCount.set(targetPlayerId, (voteCount.get(targetPlayerId) || 0) + 1);
  }

  let playerToKick = null;
  let maxVotes = 0;
  let secondMaxVotes = 0;

  for (const [playerId, count] of voteCount.entries()) {
    if (count > maxVotes) {
      secondMaxVotes = maxVotes;
      maxVotes = count;
      playerToKick = playerId;
    } else if (count > secondMaxVotes) {
      secondMaxVotes = count;
    }
  }

  const hasClearMajority = maxVotes > 0 && maxVotes > secondMaxVotes;
  const shouldKick = hasClearMajority;
  const kickedPlayerName = playerToKick
    ? room.players.get(playerToKick)?.name
    : null;

  const buggerVotedOut = shouldKick && playerToKick === room.bugger;

  return {
    shouldKick,
    playerToKick,
    kickedPlayerName,
    maxVotes,
    voteCount: Object.fromEntries(voteCount),
    votedCount,
    skipCount,
    totalPlayers,
    hasClearMajority,
    buggerVotedOut,
  };
}

function clearBuzzVote(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return null;

  room.activeVote = null;
  return room;
}

function validateFix(roomCode, playerId, fixedCode) {
  const room = rooms.get(roomCode);
  if (!room) return null;

  if (room.buzzedPlayer !== playerId) {
    return { error: "Only the buzzed player can submit a fix" };
  }

  if (room.activeVote) {
    return { error: "Wait for vote to complete" };
  }

  const isCorrect = fixedCode.trim() === room.currentCode.correctCode.trim();

  return { isCorrect, room };
}

function checkBuggerWin(room) {
  const enabledDebuggers = room.debuggers.filter(
    (id) => room.players.has(id) && !room.players.get(id)?.disabled,
  );

  const buggerEnabled =
    room.players.has(room.bugger) && !room.players.get(room.bugger)?.disabled;

  if (enabledDebuggers.length === 0 && buggerEnabled) {
    return true;
  }

  const enabledPlayers = Array.from(room.players.values()).filter(
    (p) => !p.disabled,
  );

  if (enabledPlayers.length === 2 && buggerEnabled) {
    return true;
  }

  return false;
}

function checkDebuggersWin(room) {
  const buggerDisabled =
    !room.players.has(room.bugger) || room.players.get(room.bugger)?.disabled;

  return buggerDisabled;
}

function endRound(roomCode, finalCode = null) {
  const room = rooms.get(roomCode);
  if (!room) return null;

  if (room.currentRound >= room.totalRounds) {
    room.gameState = "results";
    
    let codeHasErrors = false;
    let errorDetails = [];
    
    if (finalCode && room.currentCode) {
      const divideMatch = finalCode.match(/divide\([^)]*\)\s*{[^}]*return/s);
      if (divideMatch && !divideMatch[0].includes('=== 0')) {
        codeHasErrors = true;
        errorDetails.push('Divide bug: missing zero check');
      }
      
      const sqrtMatch = finalCode.match(/squareRoot\([^)]*\)\s*{[^}]*return/s);
      if (sqrtMatch && !sqrtMatch[0].includes('< 0')) {
        codeHasErrors = true;
        errorDetails.push('SquareRoot bug: missing negative check');
      }
      
      try {
        new Function(finalCode);
      } catch (e) {
        codeHasErrors = true;
        errorDetails.push('Syntax error: ' + e.message);
      }
    }
    
    if (codeHasErrors) {
      room.winner = "bugger";
      room.winReason = `Sabotager wins! ${errorDetails.length > 0 ? errorDetails.join(', ') : 'Bugs still in code'}`;
    } else {
      room.winner = "debuggers";
      room.winReason = "Fixers win! All bugs resolved!";
    }
  } else {
    room.currentRound++;
    assignRoles(room);
    startRound(room);
  }

  return room;
}

function resetGame(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return null;

  room.gameState = "lobby";
  room.currentRound = 0;
  room.roundStartTime = null;
  room.currentCode = null;
  room.bugger = null;
  room.debuggers = [];
  room.buzzedPlayer = null;
  room.activeVote = null;
  room.winner = null;
  room.winReason = null;

  room.players.forEach((player) => {
    player.isReady = false;
    player.role = null;
    player.disabled = false;
  });

  return room;
}

function getAllRooms() {
  return Array.from(rooms.values());
}

function getRoomStats() {
  const allRooms = Array.from(rooms.values());
  const totalPlayers = allRooms.reduce(
    (sum, room) => sum + room.players.size,
    0,
  );
  const activeGames = allRooms.filter((r) => r.gameState === "playing").length;
  const lobbyRooms = allRooms.filter((r) => r.gameState === "lobby").length;

  return {
    totalRooms: allRooms.length,
    totalPlayers,
    activeGames,
    lobbyRooms,
    roomsInResults: allRooms.filter((r) => r.gameState === "results").length,
  };
}

function cleanupOldRooms() {
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  const now = Date.now();

  for (const [code, room] of rooms.entries()) {
    if (now - room.createdAt > TWO_HOURS) {
      rooms.delete(code);
      console.log(`Cleaned up old room: ${code}`);
    }
  }
}

setInterval(cleanupOldRooms, 30 * 60 * 1000);

module.exports = {
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
  getAllRooms,
  getRoomStats,
  codeSamples,
  checkBuggerWin,
  checkDebuggersWin,
};