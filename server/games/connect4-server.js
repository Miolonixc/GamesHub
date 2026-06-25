const ROWS = 6, COLS = 7;

function initC4(room) {
  room.state = {
    mode: "connect4", board: Array.from({ length: ROWS }, () => Array(COLS).fill(0)),
    currentTurn: 0, players: [room.players[0]?.id, room.players[1]?.id], discs: {},
    wins: { [room.players[0]?.id]: 0, [room.players[1]?.id]: 0 }, draws: 0,
    gameOver: false, winner: null, winCells: null
  };
  if (room.players[0]) room.state.discs[room.players[0].id] = 1;
  if (room.players[1]) room.state.discs[room.players[1].id] = 2;
  return room.state;
}

function checkWin(board) {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c <= COLS - 4; c++) { const v = board[r][c]; if (v && v === board[r][c+1] && v === board[r][c+2] && v === board[r][c+3]) return { w: v, cells: [[r,c],[r,c+1],[r,c+2],[r,c+3]] }; }
  for (let r = 0; r <= ROWS - 4; r++) for (let c = 0; c < COLS; c++) { const v = board[r][c]; if (v && v === board[r+1][c] && v === board[r+2][c] && v === board[r+3][c]) return { w: v, cells: [[r,c],[r+1,c],[r+2,c],[r+3,c]] }; }
  for (let r = 0; r <= ROWS - 4; r++) for (let c = 0; c <= COLS - 4; c++) { const v = board[r][c]; if (v && v === board[r+1][c+1] && v === board[r+2][c+2] && v === board[r+3][c+3]) return { w: v, cells: [[r,c],[r+1,c+1],[r+2,c+2],[r+3,c+3]] }; }
  for (let r = 0; r <= ROWS - 4; r++) for (let c = 3; c < COLS; c++) { const v = board[r][c]; if (v && v === board[r+1][c-1] && v === board[r+2][c-2] && v === board[r+3][c-3]) return { w: v, cells: [[r,c],[r+1,c-1],[r+2,c-2],[r+3,c-3]] }; }
  if (board[0].every(c => c !== 0)) return { w: 0, cells: null };
  return null;
}

function handleC4(room, pid, action, data) {
  if (!room.state || room.state.gameOver || room.state.players[room.state.currentTurn] !== pid || action !== "drop") return null;
  const col = data?.col; if (!Number.isInteger(col) || col < 0 || col >= COLS) return null;
  let row = -1; for (let r = ROWS - 1; r >= 0; r--) { if (room.state.board[r][col] === 0) { row = r; break; } }
  if (row === -1) return null;
  room.state.board[row][col] = room.state.discs[pid];
  const r = checkWin(room.state.board);
  if (r) {
    room.state.gameOver = true; room.state.winCells = r.cells;
    if (r.w === 0) { room.state.draws++; return { type: "game-over", winner: null, reason: "Ничья!", winCells: null }; }
    room.state.wins[pid]++;
    return { type: "game-over", winner: room.players.find(p => p.id === pid)?.name, reason: `${room.players.find(p => p.id === pid)?.name} победил!`, winCells: r.cells };
  }
  room.state.currentTurn = (room.state.currentTurn + 1) % 2;
  return null;
}

function init(room) { return null; }
function handleAction(room, pid, action, data) {
  if (action === "start") { initC4(room); broadcastState(room); return null; }
  const r = handleC4(room, pid, action, data); broadcastState(room); return r;
}
function broadcastState(room) {
  if (!room.state) return;
  room.players.forEach(p => {
    if (p._ws && p._ws.readyState === 1) p._ws.send(JSON.stringify({
      type: "game-state", state: {
        mode: "connect4", board: room.state.board, myDisc: room.state.discs[p.id],
        isMyTurn: room.state.players[room.state.currentTurn] === p.id && !room.state.gameOver,
        wins: room.state.wins[p.id] || 0, draws: room.state.draws,
        gameOver: room.state.gameOver, winCells: room.state.winCells,
        rows: ROWS, cols: COLS, myName: p.name, opponentName: room.players.find(op => op.id !== p.id)?.name
      }
    }));
  });
}
function cleanup() {}
module.exports = { init, handleAction, cleanup };
