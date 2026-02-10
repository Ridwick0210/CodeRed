// Game state management
const { shuffleArray, randomElement } = require("./utils");

// Store all active rooms
const rooms = new Map();

// Sample code snippets for the game
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

  // Basic Operations
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
        description: "Subtract method returns 'b - a' instead of 'a - b'",
        location: "Line 19",
        difficulty: "easy"
      },
      {
        id: "bug2",
        description: "Increment method subtracts 1 instead of adding 1",
        location: "Line 59",
        difficulty: "easy"
      },
      {
        id: "bug3",
        description: "Divide method missing zero check before division",
        location: "Line 33",
        difficulty: "medium"
      },
      {
        id: "bug4",
        description: "squareRoot missing check for negative numbers",
        location: "Line 49",
        difficulty: "medium"
      },
      {
        id: "bug5",
        description: "memoryStore returns 0 instead of stored value",
        location: "Line 123",
        difficulty: "hard"
      },
    ],
    testCases: [
      { method: 'add', args: [10, 5], expected: 15 },
      { method: 'subtract', args: [10, 4], expected: 6, description: 'Normal subtraction' }, 
      { method: 'subtract', args: [5, 10], expected: -5, description: 'Negative result' },
      { method: 'multiply', args: [3, 7], expected: 21 },
      { method: 'divide', args: [20, 4], expected: 5 },
      { method: 'divide', args: [5, 0], expected: 'Error', errorMsg: 'Cannot divide by zero' },
      { method: 'power', args: [2, 4], expected: 16 },
      { method: 'squareRoot', args: [25], expected: 5 },
      { method: 'squareRoot', args: [-9], expected: 'Error', errorMsg: 'Cannot calculate square root of negative number' },
      { method: 'increment', args: [9], expected: 10 },
      { method: 'decrement', args: [10], expected: 9 },
      { method: 'memoryStore', args: [123], expected: 123 },
      { method: 'memoryRecall', args: [], expected: 123 }
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

  // Determine if this player should be host
  // If room has no players, or if the original host is gone and we're filling the spot
  const isFirstPlayer = room.players.size === 0;
  
  room.players.set(playerId, {
    id: playerId,
    name: playerName,
    isHost: isFirstPlayer, // First player in is host
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

  // If host left, assign new host
  if (room.hostId === playerId) {
    if (room.players.size > 0) {
      const newHost = Array.from(room.players.values())[0];
      newHost.isHost = true;
      room.hostId = newHost.id;
    } else {
      // Room is empty, no host needed yet
      room.hostId = null;
    }
  }

  // Handle empty room with grace period
  if (room.players.size === 0) {
    // Don't delete immediately. Wait 30 seconds for reconnect.
    console.log(`Room ${roomCode} is empty. Scheduling cleanup in 30s.`);
    room.emptyTimeout = setTimeout(() => {
      if (rooms.has(roomCode) && rooms.get(roomCode).players.size === 0) {
        rooms.delete(roomCode);
        console.log(`Room ${roomCode} deleted after 30s timeout.`);
      }
    }, 30000); // 30 seconds grace period
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

  // First player is the bugger
  room.bugger = shuffled[0];
  room.debuggers = shuffled.slice(1);

  // Update player roles
  room.players.get(room.bugger).role = "bugger";
  room.debuggers.forEach((id) => {
    room.players.get(id).role = "debugger";
  });
}

function injectBug(correctCode, bugId) {
  // Inject specific bug into the correct code
  let buggedCode = correctCode;
  
  switch(bugId) {
    case 'bug1': // Subtract: b - a instead of a - b
      buggedCode = buggedCode.replace(
        /subtract\(a, b\)\s*{\s*const result = a - b;/,
        'subtract(a, b) {\n    const result = b - a;'
      );
      break;
      
    case 'bug2': // Increment: subtract instead of add
      buggedCode = buggedCode.replace(
        /increment\(n\)\s*{\s*const result = n \+ 1;/,
        'increment(n) {\n    const result = n - 1;'
      );
      break;
      
    case 'bug3': // Divide: missing zero check
      buggedCode = buggedCode.replace(
        /divide\(a, b\)\s*{\s*if \(b === 0\) {\s*throw new Error\('Cannot divide by zero'\);\s*}\s*/,
        'divide(a, b) {\n    '
      );
      break;
      
    case 'bug4': // SquareRoot: missing negative check
      buggedCode = buggedCode.replace(
        /squareRoot\(n\)\s*{\s*if \(n < 0\) {\s*throw new Error\('Cannot calculate square root of negative number'\);\s*}\s*/,
        'squareRoot(n) {\n    '
      );
      break;
      
    case 'bug5': // MemoryStore: return 0 instead of value
      buggedCode = buggedCode.replace(
        /memoryStore\(value\)\s*{\s*this\.memory = value;\s*this\.history\.push\([^)]+\);\s*return this\.memory;/,
        'memoryStore(value) {\n    this.memory = value;\n    this.history.push(`Memory stored: ${value}`);\n    return 0;'
      );
      break;
  }
  
  return buggedCode;
}

function startRound(room) {
  // Select the calculator code sample
  const sample = codeSamples[0];
  
  // Assign bugs randomly to debuggers (fixers)
  const availableBugs = [...sample.bugs];
  const bugAssignments = new Map(); // debuggerId -> bug
  
  room.debuggers.forEach(debuggerId => {
    if (availableBugs.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableBugs.length);
      const assignedBug = availableBugs.splice(randomIndex, 1)[0];
      bugAssignments.set(debuggerId, assignedBug);
    }
  });

  // Create initial buggy code with ALL assigned bugs injected
  let initialBuggyCode = sample.correctCode;
  bugAssignments.forEach((bug) => {
    initialBuggyCode = injectBug(initialBuggyCode, bug.id);
  });

  room.currentCode = {
    ...sample,
    bugAssignments, // Store which bug each fixer needs to fix
    correctCode: sample.correctCode, // Store correct code for validation
    initialBuggyCode // Code with all bugs injected at start
  };

  room.roundStartTime = Date.now();
  room.buzzedPlayer = null;
  room.activeVote = null;
}

function handleBuzz(roomCode, playerId) {
  const room = rooms.get(roomCode);
  if (!room || room.gameState !== "playing") return null;

  const player = room.players.get(playerId);

  // Check if player is disabled
  if (player?.disabled) {
    return { error: "You are disabled and cannot buzz" };
  }

  // Allow multiple buzzes - just set the current buzzer
  room.buzzedPlayer = playerId;

  room.activeVote = {
    initiatorId: playerId,
    initiatorName: player.name,
    type: "vote_kick",
    votes: new Map(), // voterId -> targetPlayerId
    skips: new Set(), // Track who skipped voting
    startTime: Date.now(),
    duration: 60000, // 60 seconds for voting
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

  // Check if voter is disabled
  if (voter?.disabled) {
    return { error: "You are disabled and cannot vote" };
  }

  // Check if already voted or skipped
  if (room.activeVote.votes.has(voterId) || room.activeVote.skips.has(voterId)) {
    return { error: "You have already voted" };
  }

  // Handle skip vote
  if (targetVoteId === "skip") {
    room.activeVote.skips.add(voterId);

    // Check if all enabled players have voted or skipped
    const enabledPlayers = Array.from(room.players.values()).filter(
      (p) => !p.disabled,
    );
    const totalVotesAndSkips =
      room.activeVote.votes.size + room.activeVote.skips.size;
    const allVoted = totalVotesAndSkips >= enabledPlayers.length;

    return { success: true, vote: room.activeVote, allVoted };
  }

  // Validate target player exists
  if (!room.players.has(targetVoteId)) {
    return { error: "Target player not found" };
  }

  const targetPlayer = room.players.get(targetVoteId);

  // Cannot vote for a disabled player
  if (targetPlayer?.disabled) {
    return { error: "Cannot vote for an already disabled player" };
  }

  // Cannot vote for yourself
  if (voterId === targetVoteId) {
    return { error: "You cannot vote for yourself" };
  }

  room.activeVote.votes.set(voterId, targetVoteId);

  // Check if all enabled players have voted or skipped
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

  // Count only enabled (non-disabled) players
  const enabledPlayers = Array.from(room.players.values()).filter(
    (p) => !p.disabled,
  );
  const totalPlayers = enabledPlayers.length;

  // Count votes for each player
  const voteCount = new Map();
  for (const targetPlayerId of votes.values()) {
    voteCount.set(targetPlayerId, (voteCount.get(targetPlayerId) || 0) + 1);
  }

  // Find player with most votes and check for clear majority
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

  // Check for clear majority - max votes must be strictly greater than all others
  const hasClearMajority = maxVotes > 0 && maxVotes > secondMaxVotes;
  const shouldKick = hasClearMajority;
  const kickedPlayerName = playerToKick
    ? room.players.get(playerToKick)?.name
    : null;

  // Check if bugger was voted out
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

  // Check if player is the buzzed player
  if (room.buzzedPlayer !== playerId) {
    return { error: "Only the buzzed player can submit a fix" };
  }

  // Check if there's still an active vote
  if (room.activeVote) {
    return { error: "Wait for vote to complete" };
  }

  const isCorrect = fixedCode.trim() === room.currentCode.correctCode.trim();

  return { isCorrect, room };
}

function checkBuggerWin(room) {
  // Count enabled players by role
  const enabledDebuggers = room.debuggers.filter(
    (id) => room.players.has(id) && !room.players.get(id)?.disabled,
  );

  const buggerEnabled =
    room.players.has(room.bugger) && !room.players.get(room.bugger)?.disabled;

  // Buggers win if all debuggers are disabled
  if (enabledDebuggers.length === 0 && buggerEnabled) {
    return true;
  }

  // Buggers win if only bugger and 1 debugger remain enabled (can't reach majority)
  const enabledPlayers = Array.from(room.players.values()).filter(
    (p) => !p.disabled,
  );

  if (enabledPlayers.length === 2 && buggerEnabled) {
    return true;
  }

  return false;
}

function checkDebuggersWin(room) {
  // Debuggers win if bugger is disabled
  const buggerDisabled =
    !room.players.has(room.bugger) || room.players.get(room.bugger)?.disabled;

  return buggerDisabled;
}

function endRound(roomCode, finalCode = null) {
  const room = rooms.get(roomCode);
  if (!room) return null;

  // Check if game is over
  if (room.currentRound >= room.totalRounds) {
    room.gameState = "results";
    
    // Determine winner based on code quality
    let codeHasErrors = false;
    let errorDetails = [];
    
    if (finalCode && room.currentCode) {
      // Bug 1: subtract should be 'a - b', not 'b - a'
      if (finalCode.includes('result = b - a')) {
        codeHasErrors = true;
        errorDetails.push('Subtract bug: returns b - a instead of a - b');
      }
      
      // Bug 2: increment should add 1, not subtract
      if (finalCode.match(/increment\([^)]*\)\s*{[^}]*n\s*-\s*1/s)) {
        codeHasErrors = true;
        errorDetails.push('Increment bug: subtracts instead of adds');
      }
      
      // Bug 3: divide missing zero check
      const divideMatch = finalCode.match(/divide\([^)]*\)\s*{[^}]*return/s);
      if (divideMatch && !divideMatch[0].includes('=== 0')) {
        codeHasErrors = true;
        errorDetails.push('Divide bug: missing zero check');
      }
      
      // Bug 4: squareRoot missing negative check
      const sqrtMatch = finalCode.match(/squareRoot\([^)]*\)\s*{[^}]*return/s);
      if (sqrtMatch && !sqrtMatch[0].includes('< 0')) {
        codeHasErrors = true;
        errorDetails.push('SquareRoot bug: missing negative check');
      }
      
      // Bug 5: memoryStore returning wrong value
      if (finalCode.match(/memoryStore\([^)]*\)\s*{[^}]*return\s+0/s)) {
        codeHasErrors = true;
        errorDetails.push('MemoryStore bug: returns 0 instead of value');
      }
      
      // Check for syntax errors
      try {
        new Function(finalCode);
      } catch (e) {
        codeHasErrors = true;
        errorDetails.push('Syntax error: ' + e.message);
      }
    }
    
    // Determine winner
    if (codeHasErrors) {
      room.winner = "bugger";
      room.winReason = `Sabotager wins! ${errorDetails.length > 0 ? errorDetails.join(', ') : 'Bugs still in code'}`;
    } else {
      room.winner = "debuggers";
      room.winReason = "Fixers win! All bugs resolved!";
    }
  } else {
    room.currentRound++;
    assignRoles(room); // Rotate roles
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


  // Reset ready status and disabled state
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

// Run cleanup every 30 minutes
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