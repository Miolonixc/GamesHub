const WIN_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

function initTTT(room) {
  room.state = {
    mode: "tictactoe", board: Array(9).fill(null), currentTurn: 0,
    players: [room.players[0]?.id, room.players[1]?.id], marks: {},
    wins: { [room.players[0]?.id]: 0, [room.players[1]?.id]: 0 }, draws: 0,
    gameOver: false, winner: null, winLine: null
  };
  if (room.players[0]) room.state.marks[room.players[0].id] = "X";
  if (room.players[1]) room.state.marks[room.players[1].id] = "O";
  return room.state;
}

function checkWin(board) {
  for (const [a, b, c] of WIN_LINES) { if (board[a] && board[a] === board[b] && board[a] === board[c]) return { winner: board[a], line: [a, b, c] }; }
  if (board.every(c => c !== null)) return { winner: "draw", line: null };
  return null;
}

function handleTTT(room, pid, action, data) {
  if (!room.state || room.state.gameOver || room.state.players[room.state.currentTurn] !== pid || action !== "move") return null;
  const cell = data?.cell; if (cell < 0 || cell > 8 || room.state.board[cell]) return null;
  room.state.board[cell] = room.state.marks[pid];
  const r = checkWin(room.state.board);
  if (r) {
    room.state.gameOver = true;
    if (r.winner === "draw") { room.state.draws++; return { type: "game-over", winner: null, reason: "Ничья!", winLine: null }; }
    room.state.winner = pid; room.state.winLine = r.line; room.state.wins[pid]++;
    return { type: "game-over", winner: room.players.find(p => p.id === pid)?.name, reason: `${room.players.find(p => p.id === pid)?.name} победил!`, winLine: r.line };
  }
  room.state.currentTurn = (room.state.currentTurn + 1) % 2;
  return null;
}

function init(room) { return null; }
function handleAction(room, pid, action, data) {
  if (action === "start") { initTTT(room); broadcastState(room); return null; }
  const r = handleTTT(room, pid, action, data); broadcastState(room); return r;
}
function broadcastState(room) {
  if (!room.state) return;
  room.players.forEach(p => {
    if (p._ws && p._ws.readyState === 1) p._ws.send(JSON.stringify({
      type: "game-state", state: {
        mode: "tictactoe", board: room.state.board, myMark: room.state.marks[p.id],
        isMyTurn: room.state.players[room.state.currentTurn] === p.id && !room.state.gameOver,
        wins: room.state.wins[p.id] || 0, draws: room.state.draws,
        gameOver: room.state.gameOver, winLine: room.state.winLine,
        myName: p.name, opponentName: room.players.find(op => op.id !== p.id)?.name
      }
    }));
  });
}
function cleanup() {}
module.exports = { init, handleAction, cleanup };
