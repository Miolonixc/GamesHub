const GRID = 10;
const SHIPS = [4, 3, 2, 1];

function createGrid() { return Array.from({ length: GRID }, () => Array(GRID).fill(0)); }

function canPlace(grid, ship, row, col, dir) {
  for (let i = 0; i < ship; i++) {
    const r = dir === 0 ? row : row + i;
    const c = dir === 0 ? col + i : col;
    if (r < 0 || r >= GRID || c < 0 || c >= GRID) return false;
    if (grid[r][c] !== 0) return false;
  }
  return true;
}

function placeShip(grid, ship, row, col, dir) {
  for (let i = 0; i < ship; i++) {
    const r = dir === 0 ? row : row + i;
    const c = dir === 0 ? col + i : col;
    grid[r][c] = 1;
  }
}

function autoPlace(grid) {
  for (const ship of SHIPS) {
    let placed = false;
    let attempts = 0;
    while (!placed && attempts < 200) {
      const dir = Math.random() < 0.5 ? 0 : 1;
      const row = Math.floor(Math.random() * GRID);
      const col = Math.floor(Math.random() * GRID);
      if (canPlace(grid, ship, row, col, dir)) {
        placeShip(grid, ship, row, col, dir);
        placed = true;
      }
      attempts++;
    }
  }
}

function checkSunk(grid, shots, r, c) {
  const dirs = [[0,1],[0,-1],[1,0],[-1,0]];
  const visited = new Set();
  const stack = [[r, c]];
  visited.add(`${r},${c}`);
  while (stack.length) {
    const [cr, cc] = stack.pop();
    for (const [dr, dc] of dirs) {
      const nr = cr + dr, nc = cc + dc;
      const key = `${nr},${nc}`;
      if (nr >= 0 && nr < GRID && nc >= 0 && nc < GRID && !visited.has(key)) {
        if (grid[nr][nc] === 1 && !shots.has(key)) return false;
        if (grid[nr][nc] === 1 && shots.has(key)) { visited.add(key); stack.push([nr, nc]); }
      }
    }
  }
  return true;
}

function allSunk(grid, shots) {
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++)
      if (grid[r][c] === 1 && !shots.has(`${r},${c}`)) return false;
  return true;
}

function initSeaBattle(room) {
  room.state = {
    mode: "seabattle",
    grids: {},
    shots: {},
    turn: 0,
    players: [room.players[0]?.id, room.players[1]?.id],
    phase: "placing",
    ready: {},
    hits: { [room.players[0]?.id]: 0, [room.players[1]?.id]: 0 },
    misses: { [room.players[0]?.id]: 0, [room.players[1]?.id]: 0 }
  };
  room.players.forEach(p => {
    room.state.grids[p.id] = createGrid();
    room.state.shots[p.id] = new Set();
    autoPlace(room.state.grids[p.id]);
  });
  return room.state;
}

function handleSBAction(room, playerId, action, data) {
  if (!room.state || room.state.mode !== "seabattle") return null;

  if (action === "sb-ready") {
    room.state.ready[playerId] = true;
    if (Object.keys(room.state.ready).length >= 2) {
      room.state.phase = "playing";
    }
    broadcastSBState(room);
    return null;
  }

  if (action === "sb-shoot" && room.state.phase === "playing") {
    if (room.state.players[room.state.turn] !== playerId) return null;
    const { row, col } = data;
    if (row < 0 || row >= GRID || col < 0 || col >= GRID) return null;
    const opponent = room.state.players.find(p => p.id !== playerId);
    const key = `${row},${col}`;
    if (room.state.shots[playerId].has(key)) return null;

    room.state.shots[playerId].add(key);
    const hit = room.state.grids[opponent.id][row][col] === 1;
    if (hit) {
      room.state.hits[playerId]++;
    } else {
      room.state.misses[playerId]++;
    }

    let sunk = false;
    if (hit) {
      sunk = checkSunk(room.state.grids[opponent.id], room.state.shots[playerId], row, col);
    }

    if (allSunk(room.state.grids[opponent.id], room.state.shots[playerId])) {
      const winnerName = room.players.find(p => p.id === playerId)?.name;
      broadcastSBState(room);
      return { type: "game-over", winner: winnerName, reason: `${winnerName} потопил весь флот!` };
    }

    if (!hit) {
      room.state.turn = (room.state.turn + 1) % 2;
    }

    broadcastSBState(room);
    return null;
  }

  return null;
}

function broadcastSBState(room) {
  if (!room.state) return;
  room.players.forEach(p => {
    const opponent = room.state.players.find(op => op.id !== p.id);
    const myShots = room.state.shots[p.id];
    const oppGrid = opponent ? room.state.grids[opponent.id] : createGrid();

    const enemyView = Array.from({ length: GRID }, () => Array(GRID).fill(0));
    myShots.forEach(key => {
      const [r, c] = key.split(",").map(Number);
      enemyView[r][c] = oppGrid[r][c] === 1 ? 2 : 3;
    });

    const myView = room.state.grids[p.id].map((row, r) =>
      row.map((cell, c) => {
        const oppShotKey = `${r},${c}`;
        const oppShots = opponent ? room.state.shots[opponent.id] : new Set();
        if (oppShots.has(oppShotKey)) return cell === 1 ? 2 : 3;
        return 0;
      })
    );

    if (p._ws && p._ws.readyState === 1) {
      p._ws.send(JSON.stringify({
        type: "game-state",
        state: {
          mode: "seabattle",
          myGrid: myView,
          enemyGrid: enemyView,
          myShots: Array.from(myShots).map(k => k.split(",").map(Number)),
          myHits: room.state.hits[p.id],
          myMisses: room.state.misses[p.id],
          isMyTurn: room.state.players[room.state.turn] === p.id,
          phase: room.state.phase,
          myName: p.name,
          opponentName: opponent?.name
        }
      }));
    }
  });
}

function init(room) { return null; }

function handleAction(room, playerId, action, data) {
  if (action === "sb-ready" || action === "sb-shoot") {
    return handleSBAction(room, playerId, action, data);
  }
  return null;
}

function startTicking() {}
function cleanup(room) {}
module.exports = { init, handleAction, cleanup, startTicking };
