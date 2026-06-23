const SHAPES = {
  I: [[0,0],[1,0],[2,0],[3,0]],
  O: [[0,0],[1,0],[0,1],[1,1]],
  T: [[0,0],[1,0],[2,0],[1,1]],
  S: [[1,0],[2,0],[0,1],[1,1]],
  Z: [[0,0],[1,0],[1,1],[2,1]],
  J: [[0,0],[1,0],[2,0],[0,1]],
  L: [[0,0],[1,0],[2,0],[2,1]]
};

const SHAPE_KEYS = Object.keys(SHAPES);

function rotate(shape) {
  const maxX = Math.max(...shape.map(p => p[0]));
  return shape.map(([x, y]) => [y, maxX - x]);
}

function createBag() {
  const bag = [...SHAPE_KEYS];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

function initTetrisBoard(w, h) {
  return Array.from({ length: h }, () => Array(w).fill(0));
}

function collides(board, shape, ox, oy) {
  const w = board[0].length;
  const h = board.length;
  return shape.some(([x, y]) => {
    const nx = ox + x;
    const ny = oy + y;
    return nx < 0 || nx >= w || ny >= h || (ny >= 0 && board[ny][nx]);
  });
}

function lock(board, shape, ox, oy, val) {
  shape.forEach(([x, y]) => {
    const ny = oy + y;
    const nx = ox + x;
    if (ny >= 0 && ny < board.length && nx >= 0 && nx < board[0].length) {
      board[ny][nx] = val;
    }
  });
}

function clearLines(board) {
  let cleared = 0;
  for (let y = board.length - 1; y >= 0; y--) {
    if (board[y].every(c => c !== 0)) {
      board.splice(y, 1);
      board.unshift(Array(board[0].length).fill(0));
      cleared++;
      y++;
    }
  }
  return cleared;
}

function garbageCount(lines) {
  if (lines <= 0) return 0;
  if (lines === 1) return 0;
  if (lines === 2) return 1;
  if (lines === 3) return 2;
  return 4;
}

function addGarbage(board, count) {
  const w = board[0].length;
  const hole = Math.floor(Math.random() * w);
  for (let i = 0; i < count; i++) {
    board.shift();
    const row = Array(w).fill(9);
    row[hole] = 0;
    board.push(row);
  }
}

function initBattle(room) {
  const COLS = 10;
  const ROWS = 20;
  room.state = {
    mode: "battle",
    boards: {}, score: {}, level: {}, lines: {},
    current: {}, next: {}, bags: {}, alive: {}, speed: {},
    tickCount: 0
  };
  room.players.forEach(p => {
    const bag = createBag();
    const piece = bag.pop();
    room.state.boards[p.id] = initTetrisBoard(COLS, ROWS);
    room.state.score[p.id] = 0;
    room.state.level[p.id] = 1;
    room.state.lines[p.id] = 0;
    room.state.current[p.id] = { shape: SHAPES[piece], key: piece, x: 3, y: 0 };
    room.state.next[p.id] = bag.pop() || createBag().pop();
    room.state.bags[p.id] = bag;
    room.state.alive[p.id] = true;
    room.state.speed[p.id] = 800;
  });
  return room.state;
}

function tickBattle(room) {
  room.state.tickCount++;
  const players = room.players.filter(p => room.state.alive[p.id]);
  const pendingGarbage = {};

  players.forEach(p => {
    const cur = room.state.current[p.id];
    const board = room.state.boards[p.id];
    if (collides(board, cur.shape, cur.x, cur.y + 1)) {
      lock(board, cur.shape, cur.x, cur.y, 1);
      const cleared = clearLines(board);
      room.state.lines[p.id] += cleared;
      room.state.score[p.id] += cleared * 100 * room.state.level[p.id];
      room.state.level[p.id] = Math.floor(room.state.lines[p.id] / 10) + 1;
      room.state.speed[p.id] = Math.max(100, 800 - (room.state.level[p.id] - 1) * 70);
      const garbage = garbageCount(cleared);
      if (garbage > 0) {
        const opponent = room.players.find(op => op.id !== p.id);
        if (opponent) {
          pendingGarbage[opponent.id] = (pendingGarbage[opponent.id] || 0) + garbage;
        }
      }
      spawnNext(room, p.id);
      if (collides(board, room.state.current[p.id].shape, room.state.current[p.id].x, room.state.current[p.id].y)) {
        room.state.alive[p.id] = false;
      }
    } else {
      cur.y++;
    }
  });

  // Apply deferred garbage AFTER both players processed
  for (const [pid, count] of Object.entries(pendingGarbage)) {
    if (room.state.alive[pid]) {
      addGarbage(room.state.boards[pid], count);
    }
  }

  const alive = room.players.filter(p => room.state.alive[p.id]);
  if (alive.length <= 1 && room.players.length > 1) {
    const winner = alive[0];
    return { type: "game-over", winner: winner ? (room.players.find(p => p.id === winner.id)?.name || "Player") : null, reason: winner ? "Победа!" : "Ничья!" };
  }
  return null;
}

function spawnNext(room, playerId) {
  let bag = room.state.bags[playerId];
  if (bag.length === 0) bag = createBag();
  const nextKey = room.state.next[playerId];
  const nextNext = bag.pop() || createBag().pop();
  room.state.current[playerId] = { shape: SHAPES[nextKey], key: nextKey, x: 3, y: 0 };
  room.state.next[playerId] = nextNext;
  room.state.bags[playerId] = bag;
}

function handleBattleAction(room, playerId, action, data) {
  const cur = room.state.current[playerId];
  const board = room.state.boards[playerId];
  if (!cur || !board || !room.state.alive[playerId]) return null;
  switch (action) {
    case "left": if (!collides(board, cur.shape, cur.x - 1, cur.y)) cur.x--; break;
    case "right": if (!collides(board, cur.shape, cur.x + 1, cur.y)) cur.x++; break;
    case "rotate": {
      const rotated = rotate(cur.shape);
      if (!collides(board, rotated, cur.x, cur.y)) cur.shape = rotated;
      else if (!collides(board, rotated, cur.x - 1, cur.y)) { cur.shape = rotated; cur.x--; }
      else if (!collides(board, rotated, cur.x + 1, cur.y)) { cur.shape = rotated; cur.x++; }
      break;
    }
    case "drop": {
      while (!collides(board, cur.shape, cur.x, cur.y + 1)) cur.y++;
      lock(board, cur.shape, cur.x, cur.y, 1);
      const cleared = clearLines(board);
      room.state.lines[playerId] += cleared;
      room.state.score[playerId] += cleared * 100 * room.state.level[playerId];
      room.state.level[playerId] = Math.floor(room.state.lines[playerId] / 10) + 1;
      room.state.speed[playerId] = Math.max(100, 800 - (room.state.level[playerId] - 1) * 70);
      const garbage = garbageCount(cleared);
      if (garbage > 0) {
        const opponent = room.players.find(p => p.id !== playerId);
        if (opponent && room.state.alive[opponent.id]) addGarbage(room.state.boards[opponent.id], garbage);
      }
      spawnNext(room, playerId);
      if (collides(board, room.state.current[playerId].shape, room.state.current[playerId].x, room.state.current[playerId].y)) {
        room.state.alive[playerId] = false;
        const opponent = room.players.find(p => p.id !== playerId);
        if (opponent && room.state.alive[opponent.id]) return { type: "game-over", winner: room.players.find(p => p.id === opponent.id)?.name || "Player", reason: "Победа!" };
      }
      break;
    }
    case "softDrop": if (!collides(board, cur.shape, cur.x, cur.y + 1)) { cur.y++; room.state.score[playerId] += 1; } break;
  }
  return null;
}

function initCoop(room) {
  const COLS = 10; const ROWS = 20;
  const bag = createBag(); const piece = bag.pop();
  room.state = {
    mode: "coop", board: initTetrisBoard(COLS, ROWS), score: 0, lines: 0, level: 1,
    current: { shape: SHAPES[piece], key: piece, x: 3, y: 0 },
    next: bag.pop() || createBag().pop(), bag, currentPlayer: 0, speed: 800, tickCount: 0
  };
  return room.state;
}

function tickCoop(room) {
  room.state.tickCount++;
  const cur = room.state.current; const board = room.state.board;
  if (collides(board, cur.shape, cur.x, cur.y + 1)) {
    lock(board, cur.shape, cur.x, cur.y, 1);
    const cleared = clearLines(board);
    room.state.lines += cleared;
    room.state.score += cleared * 100 * room.state.level;
    room.state.level = Math.floor(room.state.lines / 10) + 1;
    room.state.speed = Math.max(100, 800 - (room.state.level - 1) * 70);
    room.state.currentPlayer = (room.state.currentPlayer + 1) % room.players.length;
    spawnNextCoop(room);
    if (collides(board, room.state.current.shape, room.state.current.x, room.state.current.y)) {
      return { type: "game-over", winner: null, reason: `Игра окончена! Счёт: ${room.state.score}` };
    }
  } else { cur.y++; }
  return null;
}

function spawnNextCoop(room) {
  let bag = room.state.bag;
  if (bag.length === 0) bag = createBag();
  const nextKey = room.state.next;
  const nextNext = bag.pop() || createBag().pop();
  room.state.current = { shape: SHAPES[nextKey], key: nextKey, x: 3, y: 0 };
  room.state.next = nextNext;
  room.state.bag = bag;
}

function handleCoopAction(room, playerId, action, data) {
  if (room.players[room.state.currentPlayer]?.id !== playerId) return null;
  const cur = room.state.current; const board = room.state.board;
  switch (action) {
    case "left": if (!collides(board, cur.shape, cur.x - 1, cur.y)) cur.x--; break;
    case "right": if (!collides(board, cur.shape, cur.x + 1, cur.y)) cur.x++; break;
    case "rotate": {
      const rotated = rotate(cur.shape);
      if (!collides(board, rotated, cur.x, cur.y)) cur.shape = rotated;
      else if (!collides(board, rotated, cur.x - 1, cur.y)) { cur.shape = rotated; cur.x--; }
      else if (!collides(board, rotated, cur.x + 1, cur.y)) { cur.shape = rotated; cur.x++; }
      break;
    }
    case "drop": {
      while (!collides(board, cur.shape, cur.x, cur.y + 1)) cur.y++;
      lock(board, cur.shape, cur.x, cur.y, 1);
      const cleared = clearLines(board);
      room.state.lines += cleared;
      room.state.score += cleared * 100 * room.state.level;
      room.state.level = Math.floor(room.state.lines / 10) + 1;
      room.state.speed = Math.max(100, 800 - (room.state.level - 1) * 70);
      room.state.currentPlayer = (room.state.currentPlayer + 1) % room.players.length;
      spawnNextCoop(room);
      if (collides(board, room.state.current.shape, room.state.current.x, room.state.current.y)) {
        return { type: "game-over", winner: null, reason: `Игра окончена! Счёт: ${room.state.score}` };
      }
      break;
    }
    case "softDrop": if (!collides(board, cur.shape, cur.x, cur.y + 1)) { cur.y++; room.state.score += 1; } break;
  }
  return null;
}

const timers = new Map();

function init(room) { return null; }

function handleAction(room, playerId, action, data) {
  if (action === "set-mode") {
    const mode = data?.mode || "battle";
    if (mode === "coop") initCoop(room); else initBattle(room);
    if (room.readyPlayers && room.readyPlayers.size >= room.players.length) {
      room.readyPlayers = null;
      startTicking(room);
    }
    broadcastState(room);
    return null;
  }
  let result = null;
  if (room.state.mode === "battle") result = handleBattleAction(room, playerId, action, data);
  else if (room.state.mode === "coop") result = handleCoopAction(room, playerId, action, data);
  if (!result) broadcastState(room);
  return result;
}

function startTicking(room) {
  if (timers.has(room.id)) return;
  const tick = () => {
    if (!room.state) return;
    let result = null;
    if (room.state.mode === "battle") result = tickBattle(room);
    else if (room.state.mode === "coop") result = tickCoop(room);
    broadcastState(room);
    if (result) { broadcastToRoom(room, result); clearTimeout(timers.get(room.id)); timers.delete(room.id); return; }
    timers.set(room.id, setTimeout(tick, room.state.speed));
  };
  timers.set(room.id, setTimeout(tick, room.state.speed));
}

function broadcastState(room) {
  const players = room.players;
  if (room.state.mode === "battle") {
    players.forEach(p => {
      const opponent = players.find(op => op.id !== p.id);
      p._ws && p._ws.send(JSON.stringify({
        type: "game-state",
        state: {
          mode: "battle", board: room.state.boards[p.id], score: room.state.score[p.id],
          level: room.state.level[p.id], lines: room.state.lines[p.id],
          current: room.state.current[p.id], next: room.state.next[p.id],
          opponentBoard: opponent ? room.state.boards[opponent.id] : null,
          opponentScore: opponent ? room.state.score[opponent.id] : 0,
          alive: room.state.alive[p.id], myName: p.name, opponentName: opponent?.name
        }
      }));
    });
  } else if (room.state.mode === "coop") {
    const state = {
      mode: "coop", board: room.state.board, score: room.state.score,
      lines: room.state.lines, level: room.state.level, current: room.state.current,
      next: room.state.next, currentPlayer: room.state.currentPlayer,
      currentPlayerName: room.players[room.state.currentPlayer]?.name,
      players: players.map(p => p.name)
    };
    players.forEach(p => { p._ws && p._ws.send(JSON.stringify({ type: "game-state", state })); });
  }
}

function broadcastToRoom(room, msg) {
  const data = JSON.stringify(msg);
  room.players.forEach(p => { if (p._ws && p._ws.readyState === 1) p._ws.send(data); });
}

function cleanup(room) {
  if (timers.has(room.id)) { clearTimeout(timers.get(room.id)); timers.delete(room.id); }
}

module.exports = { init, handleAction, cleanup };
