const SIZE = 8;

function initBoard() {
  const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if ((r + c) % 2 === 1) {
        if (r < 3) board[r][c] = 2;
        else if (r > 4) board[r][c] = 1;
      }
    }
  }
  return board;
}

function getMoves(board, r, c, player) {
  const piece = board[r][c];
  if (piece === 0) return [];
  const isKing = piece === 3 || piece === 4;
  const forward = player === 1 ? -1 : 1;
  const dirs = isKing ? [[-1,-1],[-1,1],[1,-1],[1,1]] :
    player === 1 ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]];

  const moves = [];
  const jumps = [];

  for (const [dr, dc] of dirs) {
    const nr = r + dr, nc = c + dc;
    if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) {
      if (board[nr][nc] === 0) {
        moves.push({ r: nr, c: nc, jump: false });
      } else if ((player === 1 && board[nr][nc] >= 2) || (player === 2 && board[nr][nc] <= 1 && board[nr][nc] !== 0)) {
        const jr = nr + dr, jc = nc + dc;
        if (jr >= 0 && jr < SIZE && jc >= 0 && jc < SIZE && board[jr][jc] === 0) {
          jumps.push({ r: jr, c: jc, jump: true, capturedR: nr, capturedC: nc });
        }
      }
    }
  }

  if (jumps.length > 0) return jumps;
  return moves;
}

function getAllMoves(board, player) {
  const all = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if ((player === 1 && (board[r][c] === 1 || board[r][c] === 3)) ||
          (player === 2 && (board[r][c] === 2 || board[r][c] === 4))) {
        const moves = getMoves(board, r, c, player);
        if (moves.length > 0) {
          all.push({ fromR: r, fromC: c, moves });
        }
      }
    }
  }
  return all;
}

function hasCaptures(board, player) {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if ((player === 1 && (board[r][c] === 1 || board[r][c] === 3)) ||
          (player === 2 && (board[r][c] === 2 || board[r][c] === 4))) {
        const moves = getMoves(board, r, c, player);
        if (moves.some(m => m.jump)) return true;
      }
  return false;
}

function countPieces(board) {
  let p1 = 0, p2 = 0;
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === 1 || board[r][c] === 3) p1++;
      if (board[r][c] === 2 || board[r][c] === 4) p2++;
    }
  return { p1, p2 };
}

function promote(board) {
  for (let c = 0; c < SIZE; c++) {
    if (board[0][c] === 1) board[0][c] = 3;
    if (board[SIZE-1][c] === 2) board[SIZE-1][c] = 4;
  }
}

function initCheckers(room) {
  room.state = {
    mode: "checkers",
    board: initBoard(),
    turn: 1,
    players: [room.players[0]?.id, room.players[1]?.id],
    pieceMap: { [room.players[0]?.id]: 1, [room.players[1]?.id]: 2 },
    mustContinue: null
  };
  return room.state;
}

function handleCheckersAction(room, playerId, action, data) {
  if (!room.state || room.state.mode !== "checkers") return null;
  if (room.state.mustContinue) {
    if (action !== "move") return null;
    const { fromR, fromC, toR, toC } = data;
    if (fromR !== room.state.mustContinue.r || fromC !== room.state.mustContinue.c) return null;

    const player = room.state.pieceMap[playerId];
    const moves = getMoves(room.state.board, fromR, fromC, player);
    const move = moves.find(m => m.r === toR && m.c === toC);
    if (!move) return null;

    room.state.board[toR][toC] = room.state.board[fromR][fromC];
    room.state.board[fromR][fromC] = 0;
    if (move.jump) {
      room.state.board[move.capturedR][move.capturedC] = 0;
    }

    promote(room.state.board);

    const furtherMoves = move.jump ? getMoves(room.state.board, toR, toC, player) : [];
    const furtherJumps = furtherMoves.filter(m => m.jump);

    if (move.jump && furtherJumps.length > 0) {
      room.state.mustContinue = { r: toR, c: toC };
    } else {
      room.state.mustContinue = null;
      room.state.turn = room.state.turn === 1 ? 2 : 1;
    }

    const counts = countPieces(room.state.board);
    if (counts.p1 === 0 || counts.p2 === 0) {
      const winnerId = counts.p1 > 0 ? room.state.players[0] : room.state.players[1];
      const winnerName = room.players.find(p => p.id === winnerId)?.name;
      broadcastCheckersState(room);
      return { type: "game-over", winner: winnerName, reason: `${winnerName} победил!` };
    }

    if (getAllMoves(room.state.board, room.state.turn).length === 0) {
      const loser = room.state.turn;
      const winnerId = loser === 1 ? room.state.players[1] : room.state.players[0];
      const winnerName = room.players.find(p => p.id === winnerId)?.name;
      broadcastCheckersState(room);
      return { type: "game-over", winner: winnerName, reason: `${winnerName} победил (у противника нет ходов)!` };
    }

    broadcastCheckersState(room);
    return null;
  }

  if (action === "move") {
    const player = room.state.pieceMap[playerId];
    if (room.state.turn !== player) return null;

    const { fromR, fromC, toR, toC } = data;
    const piece = room.state.board[fromR]?.[fromC];
    if (!piece) return null;
    if ((player === 1 && piece !== 1 && piece !== 3) || (player === 2 && piece !== 2 && piece !== 4)) return null;

    const mustCapture = hasCaptures(room.state.board, player);
    const moves = getMoves(room.state.board, fromR, fromC, player);
    const move = moves.find(m => m.r === toR && m.c === toC);
    if (!move) return null;
    if (mustCapture && !move.jump) return null;

    room.state.board[toR][toC] = room.state.board[fromR][fromC];
    room.state.board[fromR][fromC] = 0;
    if (move.jump) {
      room.state.board[move.capturedR][move.capturedC] = 0;
    }

    promote(room.state.board);

    const furtherMoves = move.jump ? getMoves(room.state.board, toR, toC, player) : [];
    const furtherJumps = furtherMoves.filter(m => m.jump);

    if (move.jump && furtherJumps.length > 0) {
      room.state.mustContinue = { r: toR, c: toC };
    } else {
      room.state.mustContinue = null;
      room.state.turn = room.state.turn === 1 ? 2 : 1;
    }

    const counts = countPieces(room.state.board);
    if (counts.p1 === 0 || counts.p2 === 0) {
      const winnerId = counts.p1 > 0 ? room.state.players[0] : room.state.players[1];
      const winnerName = room.players.find(p => p.id === winnerId)?.name;
      broadcastCheckersState(room);
      return { type: "game-over", winner: winnerName, reason: `${winnerName} победил!` };
    }

    if (getAllMoves(room.state.board, room.state.turn).length === 0) {
      const loser = room.state.turn;
      const winnerId = loser === 1 ? room.state.players[1] : room.state.players[0];
      const winnerName = room.players.find(p => p.id === winnerId)?.name;
      broadcastCheckersState(room);
      return { type: "game-over", winner: winnerName, reason: `${winnerName} победил (у противника нет ходов)!` };
    }

    broadcastCheckersState(room);
    return null;
  }

  return null;
}

function broadcastCheckersState(room) {
  if (!room.state) return;
  room.players.forEach(p => {
    const piece = room.state.pieceMap[p.id];
    const opponent = room.state.players.find(op => op.id !== p.id);
    const flipped = piece === 2;
    const board = room.state.board.map((row, r) =>
      row.map((cell, c) => {
        if (cell === 0) return 0;
        if (flipped) {
          if (cell === 1) return 2;
          if (cell === 2) return 1;
          if (cell === 3) return 4;
          if (cell === 4) return 3;
        }
        return cell;
      })
    );
    if (piece === 2) board.reverse();

    if (p._ws && p._ws.readyState === 1) {
      p._ws.send(JSON.stringify({
        type: "game-state",
        state: {
          mode: "checkers",
          board,
          isMyTurn: room.state.turn === piece,
          mustContinue: room.state.mustContinue,
          myName: p.name,
          opponentName: opponent?.name,
          myPiece: 1
        }
      }));
    }
  });
}

function init(room) { return null; }

function handleAction(room, playerId, action, data) {
  if (action === "move") {
    return handleCheckersAction(room, playerId, action, data);
  }
  return null;
}

function startTicking() {}
function cleanup(room) {}
module.exports = { init, handleAction, cleanup, startTicking };
