const FIELD_W = 600, FIELD_H = 400, PAD_W = 12, PAD_H = 80, BALL_R = 8, WIN_SCORE = 11, PAD_SPEED = 6, BALL_BASE_SPEED = 5;

function initPong(room) {
  room.state = {
    mode: "pong",
    paddles: { [room.players[0]?.id]: { y: FIELD_H / 2 - PAD_H / 2 }, [room.players[1]?.id]: { y: FIELD_H / 2 - PAD_H / 2 } },
    ball: { x: FIELD_W / 2, y: FIELD_H / 2, vx: BALL_BASE_SPEED * (Math.random() > 0.5 ? 1 : -1), vy: BALL_BASE_SPEED * (Math.random() * 0.6 - 0.3) },
    score: { [room.players[0]?.id]: 0, [room.players[1]?.id]: 0 },
    running: false, winner: null
  };
  return room.state;
}

function startPong(room) { if (room.state.running) return; room.state.running = true; tickPong(room); }

function tickPong(room) {
  if (!room.state || !room.state.running) return;
  const ball = room.state.ball;
  ball.x += ball.vx; ball.y += ball.vy;
  if (ball.y - BALL_R <= 0) { ball.y = BALL_R; ball.vy = Math.abs(ball.vy); }
  else if (ball.y + BALL_R >= FIELD_H) { ball.y = FIELD_H - BALL_R; ball.vy = -Math.abs(ball.vy); }
  const players = room.players;
  if (players.length < 2) return;
  const pad0 = room.state.paddles[players[0].id];
  if (pad0 && ball.vx < 0 && ball.x - BALL_R <= PAD_W + 20 && ball.y >= pad0.y && ball.y <= pad0.y + PAD_H) {
    ball.vx = -ball.vx * 1.05; ball.vy += (ball.y - (pad0.y + PAD_H / 2)) * 0.1; ball.x = PAD_W + 20 + BALL_R;
  }
  const pad1 = room.state.paddles[players[1].id];
  if (pad1 && ball.vx > 0 && ball.x + BALL_R >= FIELD_W - PAD_W - 20 && ball.y >= pad1.y && ball.y <= pad1.y + PAD_H) {
    ball.vx = -ball.vx * 1.05; ball.vy += (ball.y - (pad1.y + PAD_H / 2)) * 0.1; ball.x = FIELD_W - PAD_W - 20 - BALL_R;
  }
  if (ball.x < -BALL_R) { room.state.score[players[1].id]++; resetBall(room, 1); }
  else if (ball.x > FIELD_W + BALL_R) { room.state.score[players[0].id]++; resetBall(room, -1); }
  for (const p of players) {
    if (room.state.score[p.id] >= WIN_SCORE) {
      room.state.running = false; room.state.winner = p.name;
      broadcastToRoom(room, { type: "game-over", winner: p.name, reason: `Победил ${p.name}!` }); return;
    }
  }
  broadcastState(room);
  setTimeout(() => tickPong(room), 1000 / 60);
}

function resetBall(room, dir) { room.state.ball = { x: FIELD_W / 2, y: FIELD_H / 2, vx: BALL_BASE_SPEED * dir, vy: BALL_BASE_SPEED * (Math.random() * 0.6 - 0.3) }; }

function handlePongAction(room, playerId, action) {
  if (!room.state || !room.state.running) return null;
  const pad = room.state.paddles[playerId]; if (!pad) return null;
  if (action === "up") pad.y = Math.max(0, pad.y - PAD_SPEED);
  else if (action === "down") pad.y = Math.min(FIELD_H - PAD_H, pad.y + PAD_SPEED);
  return null;
}

function init(room) { return null; }

function handleAction(room, playerId, action) {
  if (action === "start") { if (!room.state) initPong(room); startPong(room); return null; }
  return handlePongAction(room, playerId, action);
}

function broadcastState(room) {
  if (!room.state) return;
  room.players.forEach(p => {
    const op = room.players.find(o => o.id !== p.id);
    if (p._ws && p._ws.readyState === 1) p._ws.send(JSON.stringify({
      type: "game-state", state: {
        mode: "pong", paddle: room.state.paddles[p.id], opponentPaddle: op ? room.state.paddles[op.id] : null,
        ball: room.state.ball, myScore: room.state.score[p.id], opponentScore: op ? room.state.score[op.id] : 0,
        myName: p.name, opponentName: op?.name, fieldW: FIELD_W, fieldH: FIELD_H, padW: PAD_W, padH: PAD_H, ballR: BALL_R
      }
    }));
  });
}

function broadcastToRoom(room, msg) { const d = JSON.stringify(msg); room.players.forEach(p => { if (p._ws && p._ws.readyState === 1) p._ws.send(d); }); }
function cleanup(room) { if (room.state) room.state.running = false; }
module.exports = { init, handleAction, cleanup };
